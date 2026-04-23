import { env } from './config/env';
import { Poller } from './core/poller';
import type { ExchangeAdapter } from './core/types';
import { BybitAdapter } from './adapters/bybit.adapter';
import { BitgetAdapter } from './adapters/bitget.adapter';
import { StonfiAdapter } from './adapters/stonfi.adapter';
import { DedustAdapter } from './adapters/dedust.adapter';
import { createLogger } from './utils/logger';
import { createKafkaProducer } from './kafka/producer';

const logger = createLogger({
  level: env.logLevel,
  nodeEnv: env.nodeEnv,
});

function buildAdapters(): ExchangeAdapter[] {
  const adapters: ExchangeAdapter[] = [];

  for (const exchange of env.enabledExchanges) {
    switch (exchange) {
      case 'bybit':
        adapters.push(new BybitAdapter());
        break;
      case 'bitget':
        adapters.push(new BitgetAdapter());
        break;
      case 'stonfi':
        adapters.push(new StonfiAdapter());
        break;
      case 'dedust':
        adapters.push(new DedustAdapter());
        break;
      default: {
        const neverExchange: never = exchange;
        throw new Error(`Unsupported exchange: ${neverExchange}`);
      }
    }
  }

  return adapters;
}

function timeoutPromise(ms: number, label: string): Promise<never> {
  return new Promise((_, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    timer.unref?.();
  });
}

async function main(): Promise<void> {
  logger.info(
    {
      symbol: env.symbol,
      pollIntervalMs: env.pollIntervalMs,
      enabledExchanges: env.enabledExchanges,
      kafkaBrokers: env.kafka.brokers,
      kafkaTopic: env.kafka.topic,
      kafkaHealthTopic: env.kafka.healthTopic,
      resilience: env.resilience,
    },
    'Bootstrapping exchange poller',
  );

  const kafkaPublisher = createKafkaProducer();
  await kafkaPublisher.connect();

  logger.info('Kafka producer connected');

  const adapters = buildAdapters();

  if (adapters.length === 0) {
    throw new Error('No exchange adapters enabled');
  }

  logger.info(
    {
      adapters: adapters.map((adapter) => adapter.name),
    },
    'Exchange adapters initialized',
  );

  const poller = new Poller({
    adapters,
    publisher: kafkaPublisher,
    symbol: env.symbol,
    pollIntervalMs: env.pollIntervalMs,
    logger,
    resilienceConfig: env.resilience,
  });

  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      logger.warn({ signal }, 'Shutdown already in progress');
      return;
    }

    shuttingDown = true;
    logger.warn({ signal }, 'Shutdown signal received');

    try {
      await Promise.race([
        poller.stop(),
        timeoutPromise(5_000, 'Poller stop'),
      ]);
      logger.info('Poller stopped');
    } catch (error) {
      logger.error({ err: error }, 'Failed to stop poller cleanly');
    }

    try {
      await Promise.race([
        kafkaPublisher.disconnect(),
        timeoutPromise(5_000, 'Kafka disconnect'),
      ]);
      logger.info('Kafka producer disconnected');
    } catch (error) {
      logger.error({ err: error }, 'Failed to disconnect Kafka producer cleanly');
    }

    process.exit(0);
  };

  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  process.once('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception');
    void shutdown('uncaughtException');
  });

  process.once('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled rejection');
    void shutdown('unhandledRejection');
  });

  await poller.start();
}

void main().catch((error) => {
  logger.fatal({ err: error }, 'Application failed to start');
  process.exit(1);
});