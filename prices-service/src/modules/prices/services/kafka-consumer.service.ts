import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Kafka, Consumer, logLevel } from 'kafkajs';
import { AppConfigService } from 'src/common/config/app-config.service';
import { PricesIngestService } from './prices-ingest.service';

interface RawPriceEvent {
  eventId: string;
  exchange: string;
  symbol: string;
  price: number | string;
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
          exchange: parsed.exchange.toLowerCase(),
          symbol: parsed.symbol.toUpperCase(),
          price: Number(parsed.price),
          sourceTimestamp: parsed.sourceTimestamp,
          topic,
          partition,
          offset: message.offset,
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

  private parseMessage(raw: string): RawPriceEvent | null {
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

      return {
        eventId: payload.eventId,
        exchange: payload.exchange,
        symbol: payload.symbol,
        price: payload.price,
        sourceTimestamp: payload.sourceTimestamp,
        fetchedAt: payload.fetchedAt,
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
