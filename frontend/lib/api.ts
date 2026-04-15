import { generateMockHistory } from './mock-data';
import { HistoryResponse, LatestResponse, PricePoint, TimeRange, Exchange } from './types';

export const API_PREFIX =
  process.env.NEXT_PUBLIC_API_PREFIX ?? '/api/v1';

function getBaseOrigin(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost';
}

function buildHttpUrl(path: string, params: Record<string, string | undefined>) {
  const url = new URL(`${API_PREFIX}${path}`, getBaseOrigin());

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

export async function fetchPriceHistory(
  symbol: string,
  range: TimeRange,
  exchanges: Exchange[],
): Promise<PricePoint[]> {
  const url = buildHttpUrl('/prices/history', {
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
    return generateMockHistory(symbol, range).filter((point) =>
      exchanges.includes(point.exchange),
    );
  }
}

export async function fetchLatestPrices(symbol: string): Promise<LatestResponse['items']> {
  const url = buildHttpUrl('/prices/latest', { symbol });

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

export function getWebSocketUrl(
  symbol: string,
  range: TimeRange,
  exchanges: Exchange[],
): string {
  const protocol =
    typeof window !== 'undefined' && window.location.protocol === 'https:'
      ? 'wss:'
      : 'ws:';

  const host =
    typeof window !== 'undefined'
      ? window.location.host
      : 'localhost';

  const url = new URL(`${protocol}//${host}/ws/prices`);

  url.searchParams.set('symbol', symbol);
  url.searchParams.set('range', range);
  url.searchParams.set('exchanges', exchanges.join(','));

  return url.toString();
}