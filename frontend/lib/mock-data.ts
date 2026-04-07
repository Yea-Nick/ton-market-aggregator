import { EXCHANGES, PricePoint, TimeRange } from './types';

const RANGE_TO_MINUTES: Record<TimeRange, number> = {
  '15m': 15,
  '1h': 60,
  '4h': 240,
  '24h': 1440,
};

const BASE_PRICE: Record<string, number> = {
  bybit: 1.12,
  bitget: 1.11,
  stonfi: 1.08,
  dedust: 1.09,
};

export function generateMockHistory(symbol: string, range: TimeRange): PricePoint[] {
  const now = Date.now();
  const points: PricePoint[] = [];
  const minutes = RANGE_TO_MINUTES[range];

  for (const exchange of EXCHANGES) {
    let current = BASE_PRICE[exchange];

    for (let i = minutes; i >= 0; i -= 1) {
      const noise = (Math.random() - 0.5) * 0.035;
      const trend = Math.sin((minutes - i) / 8) * 0.01;
      current = Number((current + noise + trend).toFixed(4));

      points.push({
        exchange,
        symbol,
        price: current,
        timestamp: new Date(now - i * 60_000).toISOString(),
      });
    }
  }

  return points;
}
