export type ExchangeName = 'bybit' | 'bitget' | 'stonfi' | 'dedust';

export interface FetchedPrice {
  exchange: ExchangeName;
  symbol: string;
  price: string;
  sourceTimestamp: string;
  fetchedAt: string;
  source: {
    name: string;
    endpoint: string;
  };
}

export interface PriceEvent extends FetchedPrice {
  eventId: string;
}

export interface ExchangeAdapter {
  readonly name: ExchangeName;
  fetchPrice(symbol: string): Promise<FetchedPrice>;
}

export type BreakerState = 'closed' | 'open' | 'half-open';

export type HealthEventType =
  | 'source.fetch_failed'
  | 'source.breaker_opened'
  | 'source.breaker_half_open'
  | 'source.breaker_closed'
  | 'source.stale_detected'
  | 'source.recovered';

export type ResilienceErrorKind =
  | 'timeout'
  | 'aborted'
  | 'network'
  | 'http_4xx'
  | 'http_5xx'
  | 'http_403'
  | 'http_429'
  | 'invalid_payload'
  | 'unknown';

export interface ResilienceError {
  kind: ResilienceErrorKind;
  message: string;
  statusCode?: number;
  code?: string;
  isRetryable: boolean;
  isBreakerWorthy: boolean;
  details?: Record<string, unknown>;
}

export interface HealthEvent {
  eventId: string;
  type: HealthEventType;
  exchange: ExchangeName;
  symbol: string;
  occurredAt: string;
  severity: 'info' | 'warn' | 'error';
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface ResilienceConfig {
  requestTimeoutMs: number;
  maxRetries: number;
  retryBaseBackoffMs: number;
  retryMaxBackoffMs: number;
  breakerFailureThreshold: number;
  breakerOpenMs: number;
  breakerOpenMs403: number;
  staleAfterConsecutive: number;
  staleHealthCooldownMs: number;
  duplicateHealthCooldownMs: number;
}

export interface AdapterExecutionSuccess {
  status: 'success';
  fetched: FetchedPrice;
  healthEvents: HealthEvent[];
  attempts: number;
}

export interface AdapterExecutionSuppressed {
  status: 'suppressed';
  reason: 'breaker_open' | 'stale' | 'duplicate';
  healthEvents: HealthEvent[];
  attempts: number;
}

export interface AdapterExecutionFailure {
  status: 'failure';
  error: ResilienceError;
  healthEvents: HealthEvent[];
  attempts: number;
}

export type AdapterExecutionResult =
  | AdapterExecutionSuccess
  | AdapterExecutionSuppressed
  | AdapterExecutionFailure;