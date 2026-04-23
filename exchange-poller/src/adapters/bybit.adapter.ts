import { env } from '../config/env';
import type { ExchangeAdapter, FetchedPrice } from '../core/types';
import { http } from '../utils/http';

interface BybitTickersResponse {
  retCode: number;
  retMsg: string;
  time?: number;
  result?: {
    category?: string;
    list?: Array<{
      symbol?: string;
      lastPrice?: string;
    }>;
  };
}

export class BybitAdapter implements ExchangeAdapter {
  readonly name = 'bybit' as const;

  async fetchPrice(symbol: string): Promise<FetchedPrice> {
    const payload = await http.getJson<BybitTickersResponse>({
      baseURL: env.exchanges.bybit.baseUrl,
      url: '/v5/market/tickers',
      params: {
        category: 'spot',
        symbol,
      },
      headers: {
        Accept: 'application/json',
      },
    });

    if (payload.retCode !== 0) {
      throw new Error(
        `Bybit returned non-zero retCode: ${payload.retCode}, retMsg: ${payload.retMsg}`,
      );
    }

    const item = payload.result?.list?.[0];

    if (!item) {
      throw new Error('Bybit response does not contain ticker item');
    }

    if (!item.lastPrice) {
      throw new Error('Bybit response does not contain lastPrice');
    }

    const fetchedAt = new Date().toISOString();
    const sourceTimestamp = payload.time
      ? new Date(payload.time).toISOString()
      : fetchedAt;

    return {
      exchange: this.name,
      symbol,
      price: item.lastPrice,
      sourceTimestamp,
      fetchedAt,
      source: {
        name: 'bybit',
        endpoint: `${env.exchanges.bybit.baseUrl}/v5/market/tickers`,
      },
    };
  }
}