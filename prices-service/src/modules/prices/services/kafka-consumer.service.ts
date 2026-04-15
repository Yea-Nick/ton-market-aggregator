import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Kafka, Consumer, logLevel } from 'kafkajs';
import { AppConfigService } from '../../../common/config/app-config.service';
import {
  SUPPORTED_EXCHANGES,
  SupportedExchange,
} from '../../../common/constants/prices.constants';
import { PricesIngestService } from './prices-ingest.service';

interface RawPriceEvent {
  eventId: string;
  exchange: string;
  symbol: string;
  price: number | string;
  sourceTimestamp: string;
  fetchedAt?: string;
}

interface ParsedPriceEvent {
  eventId: string;
  exchange: SupportedExchange;
  symbol: string;
  price: number;
  sourceTimestamp: string;
  fetchedAt?: string;
}

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private readonly kafka: Kafka;
  private consumer?: Consumer;

  constructor(
    private readonly config: AppConfigService,
    private readonly pricesIngestService: PricesIngestService,
  ) {
    this.kafka = new Kafka({
      clientId: this.config.kafkaClientId,
      brokers: this.config.kafkaBrokers,
      ssl: this.config.kafkaSsl,
      logLevel: logLevel.NOTHING,
    });
  }

  async onModuleInit(): Promise<void> {
    this.consumer = this.kafka.consumer({
      groupId: this.config.kafkaGroupId,
      allowAutoTopicCreation: this.config.kafkaAllowAutoTopicCreation,
    });

    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: this.config.kafkaTopic,
      fromBeginning: this.config.kafkaFromBeginning,
    });

    await this.consumer.run({
      autoCommit: false,
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) {
          this.logger.warn(`Skipped empty message at ${topic}[${partition}]/${message.offset}`);
          await this.commitOffset(topic, partition, message.offset);
          return;
        }

        const parsed = this.parseMessage(message.value.toString());
        if (!parsed) {
          this.logger.warn(`Skipped malformed message at ${topic}[${partition}]/${message.offset}`);
          await this.commitOffset(topic, partition, message.offset);
          return;
        }

        await this.pricesIngestService.process({
          eventId: parsed.eventId,
          exchange: parsed.exchange.toLowerCase() as SupportedExchange,
          symbol: parsed.symbol.toUpperCase(),
          price: Number(parsed.price),
          sourceTimestamp: parsed.sourceTimestamp,
          topic,
          partition,
          partitionOffset: message.offset,
        });

        await this.commitOffset(topic, partition, message.offset);
      },
    });

    this.logger.log(`Kafka consumer subscribed to topic: ${this.config.kafkaTopic}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.consumer) {
      await this.consumer.disconnect();
    }
  }

  private parseMessage(raw: string): ParsedPriceEvent | null {
    try {
      const payload = JSON.parse(raw) as Partial<RawPriceEvent>;

      if (
        !payload.eventId ||
        !payload.exchange ||
        !payload.symbol ||
        payload.price === undefined ||
        !payload.sourceTimestamp
      ) {
        return null;
      }

      const exchange = String(payload.exchange).trim().toLowerCase();
      if (!SUPPORTED_EXCHANGES.includes(exchange as SupportedExchange)) {
        return null;
      }

      const symbol = String(payload.symbol).trim().toUpperCase();
      if (!symbol) {
        return null;
      }

      const price = Number(payload.price);
      if (!Number.isFinite(price)) {
        return null;
      }

      const sourceDate = new Date(payload.sourceTimestamp);
      if (Number.isNaN(sourceDate.getTime())) {
        return null;
      }

      return {
        eventId: String(payload.eventId),
        exchange: exchange as SupportedExchange,
        symbol,
        price,
        sourceTimestamp: sourceDate.toISOString(),
        fetchedAt: payload.fetchedAt ? String(payload.fetchedAt) : undefined,
      };
    } catch {
      return null;
    }
  }

  private async commitOffset(topic: string, partition: number, offset: string): Promise<void> {
    if (!this.consumer) {
      return;
    }

    await this.consumer.commitOffsets([
      {
        topic,
        partition,
        offset: (BigInt(offset) + 1n).toString(),
      },
    ]);
  }
}