import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PriceStreamService } from './price-stream.service';

export interface IngestPriceMessage {
  eventId: string;
  exchange: string;
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

  async process(message: IngestPriceMessage): Promise<{ duplicate: boolean; }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const inboxInsert: { event_id: string; }[] = await queryRunner.query(
        `
        insert into consumer_inbox(event_id, topic, partition, partition_offset, exchange, symbol)
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

      const inserted = inboxInsert.length > 0;

      if (!inserted) {
        await queryRunner.commitTransaction();
        this.logger.debug(`Duplicate event skipped: ${message.eventId}`);
        return { duplicate: true };
      }

      await queryRunner.query(
        `
        insert into price_ticks(event_id, exchange, symbol, price, source_timestamp)
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

      await queryRunner.commitTransaction();

      try {
        this.priceStreamService.broadcast({
          eventId: message.eventId,
          exchange: message.exchange,
          symbol: message.symbol,
          price: message.price,
          timestamp: new Date(message.sourceTimestamp).toISOString(),
        });
      } catch (err) {
        this.logger.warn(`Broadcast failed for event ${message.eventId}: ${err instanceof Error ? err.message : String(err)}`);
      }

      return { duplicate: false };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
