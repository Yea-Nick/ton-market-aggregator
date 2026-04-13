import { v4 as uuidv4 } from 'uuid';
import type pino from 'pino';
import type { ExchangeAdapter, PriceEvent } from './types';
import type { KafkaProducer } from '../kafka/producer';

interface PollerParams {
  symbol: string;
  topic: string;
  pollIntervalMs: number;
  adapters: ExchangeAdapter[];
  producer: KafkaProducer;
  logger: pino.Logger;
  kafkaClientId: string;
}

export class Poller {
  private readonly symbol: string;
  private readonly topic: string;
  private readonly pollIntervalMs: number;
  private readonly adapters: ExchangeAdapter[];
  private readonly producer: KafkaProducer;
  private readonly logger: pino.Logger;
  private readonly kafkaClientId: string;
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;
  private running = false;

  constructor(params: PollerParams) {
    this.symbol = params.symbol;
    this.topic = params.topic;
    this.pollIntervalMs = params.pollIntervalMs;
    this.adapters = params.adapters;
    this.producer = params.producer;
    this.logger = params.logger;
    this.kafkaClientId = params.kafkaClientId;
  }

  async start(): Promise<void> {
    this.logger.info(
      {
        symbol: this.symbol,
        pollIntervalMs: this.pollIntervalMs,
        exchanges: this.adapters.map((adapter) => adapter.name),
      },
      'Starting poller',
    );

    await this.tick();
    this.timer = setInterval(() => {
      void this.tick();
    }, this.pollIntervalMs);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.stopped || this.running) {
      return;
    }

    this.running = true;
    const startedAt = Date.now();

    try {
      const settled = await Promise.allSettled(
        this.adapters.map(async (adapter) => {
          const fetched = await adapter.fetchPrice(this.symbol);

          const event: PriceEvent = {
            eventId: uuidv4(),
            ...fetched,
          };

          await this.producer.send({
            topic: this.topic,
            key: `${event.symbol}:${event.exchange}`,
            value: JSON.stringify(event),
            headers: {
              eventId: event.eventId,
              eventType: 'price.received',
              schemaVersion: '1',
              producer: this.kafkaClientId,
            },
          });

          this.logger.info(
            {
              eventId: event.eventId,
              exchange: event.exchange,
              symbol: event.symbol,
              price: event.price,
              sourceTimestamp: event.sourceTimestamp,
            },
            'Published price event',
          );
        }),
      );

      for (const result of settled) {
        if (result.status === 'rejected') {
          this.logger.error({ err: result.reason }, 'Exchange polling failed');
        }
      }

      this.logger.info(
        {
          durationMs: Date.now() - startedAt,
          exchangesCount: this.adapters.length,
        },
        'Polling cycle completed',
      );
    } finally {
      this.running = false;
    }
  }
}
