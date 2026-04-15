export const SUPPORTED_RANGES = ['15m', '1h', '4h', '24h'] as const;
export type SupportedRange = (typeof SUPPORTED_RANGES)[number];

export const RANGE_TO_INTERVAL_SQL: Record<SupportedRange, string> = {
  '15m': '15 minutes',
  '1h': '1 hour',
  '4h': '4 hours',
  '24h': '24 hours',
};

export const SUPPORTED_EXCHANGES = ['bybit', 'bitget', 'stonfi', 'dedust'] as const;
export type SupportedExchange = (typeof SUPPORTED_EXCHANGES)[number];