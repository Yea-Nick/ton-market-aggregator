import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  LOG_LEVEL: z.string().default('info'),
  PORT: z.string().default('3002'),
  POLL_INTERVAL_MS: z.string().default('5000'),
  SYMBOL: z.string().default('TONUSDT'),
  KAFKA_CLIENT_ID: z.string().default('exchange-poller'),
  KAFKA_BROKERS: z.string().default('kafka:9092'),
  KAFKA_TOPIC: z.string().default('ton.prices.raw'),
  ENABLED_EXCHANGES: z.string().default('bybit,bitget,stonfi,dedust'),
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig() {
  const env = schema.parse(process.env);

  return {
    nodeEnv: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
    port: Number(env.PORT),
    pollIntervalMs: Number(env.POLL_INTERVAL_MS),
    symbol: env.SYMBOL,
    enabledExchanges: env.ENABLED_EXCHANGES.split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
    kafka: {
      clientId: env.KAFKA_CLIENT_ID,
      brokers: env.KAFKA_BROKERS.split(',').map((item) => item.trim()).filter(Boolean),
      topic: env.KAFKA_TOPIC,
    }
  };
}