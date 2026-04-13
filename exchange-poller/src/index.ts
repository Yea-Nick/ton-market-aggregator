import { loadConfig } from './config/env';
import { createLogger } from './utils/logger';
import { createKafkaProducer } from './kafka/producer';
import { createExchangeAdapters } from './adapters';
import { Poller } from './core/poller';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  const producer = createKafkaProducer({
    clientId: config.kafka.clientId,
    brokers: config.kafka.brokers,
    logger,
  });

  await producer.connect();

  const adapters = createExchangeAdapters(config, logger);

  const poller = new Poller({
    symbol: config.symbol,
    topic: config.kafka.topic,
    pollIntervalMs: config.pollIntervalMs,
    adapters,
    producer,
    logger,
    kafkaClientId: config.kafka.clientId
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down exchange-poller');
    await poller.stop();
    await producer.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await poller.start();
}

bootstrap().catch((error) => {
  console.error('Failed to start exchange-poller', error);
  process.exit(1);
});
