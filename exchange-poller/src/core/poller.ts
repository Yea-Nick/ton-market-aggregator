import { buildDeterministicEventId } from './event-id';
import type pino from 'pino';
import type {
  ExchangeAdapter,
  HealthEvent,
  PriceEvent,
  ResilienceConfig,
} from './types';
import { ResilientAdapter } from './resilience';
import type { KafkaEventPublisher } from '../kafka/producer';

interface PollerParams {
  adapters: ExchangeAdapter[];
  publisher: KafkaEventPublisher;
  symbol: string;
  pollIntervalMs: number;
  logger: pino.Logger;
  resilienceConfig: ResilienceConfig;
}

export class Poller {
  private readonly resilientAdapters: ResilientAdapter[];
  private readonly publisher: KafkaEventPublisher;
  private readonly symbol: string;
  private readonly pollIntervalMs: number;
  private readonly logger: pino.Logger;

  private intervalRef: NodeJS.Timeout | null = null;
  private running = false;
  private stopping = false;
  private currentTickPromise: Promise<void> | null = null;

  constructor(params: PollerParams) {
    this.publisher = params.publisher;
    this.symbol = params.symbol;
    this.pollIntervalMs = params.pollIntervalMs;
    this.logger = params.logger;

    this.resilientAdapters = params.adapters.map(
      (adapter) =>
        new ResilientAdapter({
          adapter,
          symbol: params.symbol,
          logger: params.logger.child({ adapter: adapter.name }),
          config: params.resilienceConfig,
        }),
    );
  }

  async start(): Promise<void> {
    if (this.intervalRef) {
      this.logger.warn('Poller is already started');
      return;
    }

    this.stopping = false;

    this.logger.info(
      {
        symbol: this.symbol,
        pollIntervalMs: this.pollIntervalMs,
        adapters: this.resilientAdapters.map((adapter) => adapter.name),
      },
      'Starting poller',
    );

    await this.runTick();

    this.intervalRef = setInterval(() => {
      void this.runTick();
    }, this.pollIntervalMs);
  }

  async stop(): Promise<void> {
    this.stopping = true;

    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }

    if (this.currentTickPromise) {
      this.logger.info('Waiting for active polling cycle to finish');
      await this.currentTickPromise;
    }

    this.logger.info('Poller stopped');
  }

  private runTick(): Promise<void> {
    if (this.stopping) {
      this.logger.debug('Poller is stopping; skipping tick');
      return Promise.resolve();
    }

    if (this.running) {
      this.logger.warn('Previous polling cycle is still running; skipping tick');
      return this.currentTickPromise ?? Promise.resolve();
    }

    this.currentTickPromise = this.tick().finally(() => {
      this.currentTickPromise = null;
    });

    return this.currentTickPromise;
  }

  private async tick(): Promise<void> {
    this.running = true;
    const tickStartedAt = Date.now();

    try {
      this.logger.debug({ symbol: this.symbol }, 'Polling cycle started');

      const settledResults = await Promise.allSettled(
        this.resilientAdapters.map((adapter) => adapter.execute()),
      );

      const priceEvents: PriceEvent[] = [];
      const healthEvents: HealthEvent[] = [];

      for (const settled of settledResults) {
        if (settled.status === 'rejected') {
          this.logger.error(
            {
              err: settled.reason,
            },
            'Adapter crashed unexpectedly outside resilience layer',
          );
          continue;
        }

        const result = settled.value;

        healthEvents.push(...result.healthEvents);

        if (result.status === 'success') {
          const event = this.toPriceEvent(result.fetched);

          this.logger.info(
            {
              exchange: event.exchange,
              symbol: event.symbol,
              price: event.price,
              sourceTimestamp: event.sourceTimestamp,
              eventId: event.eventId,
              healthEventsCount: result.healthEvents.length,
            },
            'Adapter result accepted for Kafka',
          );

          priceEvents.push(event);
          continue;
        }

        if (result.status === 'suppressed') {
          this.logger.info(
            {
              reason: result.reason,
              attempts: result.attempts,
            },
            'Adapter result suppressed before Kafka',
          );
          continue;
        }

        this.logger.warn(
          {
            errorKind: result.error.kind,
            statusCode: result.error.statusCode,
            attempts: result.attempts,
            reason: result.error.message,
          },
          'Adapter execution failed',
        );
      }

      if (this.stopping) {
        this.logger.info(
          {
            skippedPriceEvents: priceEvents.length,
            skippedHealthEvents: healthEvents.length,
          },
          'Poller is stopping; skipping Kafka publish for completed tick',
        );
        return;
      }

      await this.publisher.publishPriceEvents(priceEvents);
      await this.publisher.publishHealthEvents(healthEvents);

      this.logger.info(
        {
          producedPriceEvents: priceEvents.length,
          producedHealthEvents: healthEvents.length,
          durationMs: Date.now() - tickStartedAt,
        },
        'Polling cycle finished',
      );
    } catch (error) {
      this.logger.error(
        {
          err: error,
          durationMs: Date.now() - tickStartedAt,
        },
        'Polling cycle crashed unexpectedly',
      );
    } finally {
      this.running = false;
    }
  }

  private toPriceEvent(fetched: {
    exchange: string;
    symbol: string;
    price: string;
    sourceTimestamp: string;
    fetchedAt: string;
    source: { name: string; endpoint: string; };
  }): PriceEvent {
    return {
      eventId: buildDeterministicEventId({
        exchange: fetched.exchange as PriceEvent['exchange'],
        symbol: fetched.symbol,
        sourceTimestamp: fetched.sourceTimestamp,
        price: fetched.price,
      }),
      exchange: fetched.exchange as PriceEvent['exchange'],
      symbol: fetched.symbol,
      price: fetched.price,
      sourceTimestamp: fetched.sourceTimestamp,
      fetchedAt: fetched.fetchedAt,
      source: fetched.source,
    };
  }
}