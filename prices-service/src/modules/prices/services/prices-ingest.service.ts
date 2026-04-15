import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SupportedExchange } from '../../../common/constants/prices.constants';
import { PriceStreamService } from './price-stream.service';

interface ProcessPriceTickParams {
  eventId: string;
  exchange: SupportedExchange;
  symbol: string;
  price: number;
  sourceTimestamp: string;
  topic: string;
  partition: number;
  partitionOffset: string;
}

@Injectable()
export class PricesIngestService {
  private readonly logger = new Logger(PricesIngestService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly priceStreamService: PriceStreamService,
  ) { }

  async process(message: ProcessPriceTickParams): Promise<void> {
    let shouldBroadcast = false;

    await this.dataSource.transaction(async (manager) => {
      const inserted = await manager.query(
        `
        insert into consumer_inbox (
          event_id,
          topic,
          partition,
          partition_offset,
          exchange,
          symbol
        )
        values ($1, $2, $3, $4, $5, $6)
        on conflict (event_id) do nothing
        returning event_id
        `,
        [
          message.eventId,
          message.topic,
          message.partition,
          message.partitionOffset,
          message.exchange,
          message.symbol,
        ],
      );

      if (!inserted.length) {
        this.logger.debug(`Skipped duplicate event: ${message.eventId}`);
        return;
      }

      await manager.query(
        `
        insert into price_ticks (
          event_id,
          exchange,
          symbol,
          price,
          source_timestamp
        )
        values ($1, $2, $3, $4, $5)
        `,
        [
          message.eventId,
          message.exchange,
          message.symbol,
          message.price,
          message.sourceTimestamp,
        ],
      );

      shouldBroadcast = true;
    });

    if (!shouldBroadcast) {
      return;
    }

    this.priceStreamService.ingestTick({
      exchange: message.exchange,
      symbol: message.symbol,
      price: message.price,
      timestamp: new Date(message.sourceTimestamp).toISOString(),
    });

    this.logger.debug(
      `Processed tick: ${message.symbol} ${message.exchange} ${message.price} @ ${message.sourceTimestamp}`,
    );
  }
}