import { generateMockHistory } from './mock-data';
import { HistoryResponse, LatestResponse, PricePoint, TimeRange, Exchange } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

function buildUrl(path: string, params: Record<string, string | undefined>) {
  const url = new URL(path, API_BASE_URL);

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

export async function fetchPriceHistory(symbol: string, range: TimeRange, exchanges: Exchange[]): Promise<PricePoint[]> {
  const url = buildUrl('/api/v1/prices/history', {
    symbol,
    range,
    exchanges: exchanges.join(','),
  });

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`History request failed: ${response.status}`);
    }

    const data = (await response.json()) as HistoryResponse;
    return data.points;
  } catch {
    return generateMockHistory(symbol, range).filter((point) => exchanges.includes(point.exchange));
  }
}

export async function fetchLatestPrices(symbol: string): Promise<LatestResponse['items']> {
  const url = buildUrl('/api/v1/prices/latest', { symbol });

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`Latest request failed: ${response.status}`);
    }

    const data = (await response.json()) as LatestResponse;
    return data.items;
  } catch {
    return [];
  }
}

export function getWebSocketUrl(symbol: string, range: TimeRange, exchanges: Exchange[]): string {
  const rawUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8080/ws/prices';
  const url = new URL(rawUrl);

  url.searchParams.set('symbol', symbol);
  url.searchParams.set('range', range);
  url.searchParams.set('exchanges', exchanges.join(','));

  return url.toString();
}
