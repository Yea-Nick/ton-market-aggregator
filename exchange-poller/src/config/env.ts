import 'dotenv/config';
import { z } from 'zod';
import type { ExchangeName, ResilienceConfig } from '../core/types';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  SYMBOL: z.string().min(1).default('TONUSDT'),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),

  ENABLED_EXCHANGES: z
    .string()
    .default('bybit,bitget,stonfi,dedust'),

  KAFKA_CLIENT_ID: z.string().min(1).default('exchange-poller'),
  KAFKA_BROKERS: z.string().min(1).default('kafka:9092'),
  KAFKA_TOPIC: z.string().min(1).default('ton.prices.raw'),
  KAFKA_HEALTH_TOPIC: z.string().min(1).default('ton.sources.health'),

  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(2500),
  MAX_RETRIES: z.coerce.number().int().min(0).default(2),
  RETRY_BASE_BACKOFF_MS: z.coerce.number().int().positive().default(250),
  RETRY_MAX_BACKOFF_MS: z.coerce.number().int().positive().default(1500),

  BREAKER_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(5),
  BREAKER_OPEN_MS: z.coerce.number().int().positive().default(60_000),
  BREAKER_OPEN_MS_403: z.coerce.number().int().positive().default(600_000),

  STALE_AFTER_CONSECUTIVE: z.coerce.number().int().positive().default(3),
  STALE_HEALTH_COOLDOWN_MS: z.coerce.number().int().positive().default(60_000),
  DUPLICATE_HEALTH_COOLDOWN_MS: z.coerce.number().int().positive().default(60_000),

  BYBIT_BASE_URL: z.string().url().default('https://api.bybit.com'),
  BITGET_BASE_URL: z.string().url().default('https://api.bitget.com'),
  STONFI_BASE_URL: z.string().url().default('https://api.ston.fi'),

  TONCENTER_API_URL: z.string().url().optional(),
});

const parsed = envSchema.parse(process.env);

function parseEnabledExchanges(value: string): ExchangeName[] {
  const items = value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const allowed: ExchangeName[] = ['bybit', 'bitget', 'stonfi', 'dedust'];

  const invalid = items.filter(
    (item) => !allowed.includes(item as ExchangeName),
  );

  if (invalid.length > 0) {
    throw new Error(
      `Invalid ENABLED_EXCHANGES value(s): ${invalid.join(', ')}`,
    );
  }

  return items as ExchangeName[];
}

export const env = {
  nodeEnv: parsed.NODE_ENV,
  logLevel: parsed.LOG_LEVEL,

  symbol: parsed.SYMBOL,
  pollIntervalMs: parsed.POLL_INTERVAL_MS,
  enabledExchanges: parseEnabledExchanges(parsed.ENABLED_EXCHANGES),

  kafka: {
    clientId: parsed.KAFKA_CLIENT_ID,
    brokers: parsed.KAFKA_BROKERS.split(',')
      .map((broker) => broker.trim())
      .filter(Boolean),
    topic: parsed.KAFKA_TOPIC,
    healthTopic: parsed.KAFKA_HEALTH_TOPIC,
  },

  resilience: <ResilienceConfig>{
    requestTimeoutMs: parsed.REQUEST_TIMEOUT_MS,
    maxRetries: parsed.MAX_RETRIES,
    retryBaseBackoffMs: parsed.RETRY_BASE_BACKOFF_MS,
    retryMaxBackoffMs: parsed.RETRY_MAX_BACKOFF_MS,
    breakerFailureThreshold: parsed.BREAKER_FAILURE_THRESHOLD,
    breakerOpenMs: parsed.BREAKER_OPEN_MS,
    breakerOpenMs403: parsed.BREAKER_OPEN_MS_403,
    staleAfterConsecutive: parsed.STALE_AFTER_CONSECUTIVE,
    staleHealthCooldownMs: parsed.STALE_HEALTH_COOLDOWN_MS,
    duplicateHealthCooldownMs: parsed.DUPLICATE_HEALTH_COOLDOWN_MS,
  },

  exchanges: {
    bybit: {
      baseUrl: parsed.BYBIT_BASE_URL,
    },
    bitget: {
      baseUrl: parsed.BITGET_BASE_URL,
    },
    stonfi: {
      baseUrl: parsed.STONFI_BASE_URL,
    },
  },

  ton: {
    apiUrl: parsed.TONCENTER_API_URL,
  },
};

export type AppEnv = typeof env;