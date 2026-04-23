import { env } from '../config/env';
import type { ExchangeAdapter, FetchedPrice } from '../core/types';
import { http } from '../utils/http';

interface BitgetTickerItem {
  symbol?: string;
  lastPr?: string;
  ts?: string;
}

interface BitgetTickersResponse {
  code: string;
  msg: string;
  requestTime?: number;
  data?: BitgetTickerItem[];
}

export class BitgetAdapter implements ExchangeAdapter {
  readonly name = 'bitget' as const;

  async fetchPrice(symbol: string): Promise<FetchedPrice> {
    const payload = await http.getJson<BitgetTickersResponse>({
      baseURL: env.exchanges.bitget.baseUrl,
      url: '/api/v2/spot/market/tickers',
      params: {
        symbol,
      },
      headers: {
        Accept: 'application/json',
      },
    });

    if (payload.code !== '00000') {
      throw new Error(
        `Bitget returned non-success code: ${payload.code}, msg: ${payload.msg}`,
      );
    }

    const item = payload.data?.[0];

    if (!item) {
      throw new Error('Bitget response does not contain ticker item');
    }

    if (!item.lastPr) {
      throw new Error('Bitget response does not contain lastPr');
    }

    const fetchedAt = new Date().toISOString();

    const ts =
      item.ts && /^\d+$/.test(item.ts)
        ? Number(item.ts)
        : payload.requestTime;

    const sourceTimestamp = ts
      ? new Date(ts).toISOString()
      : fetchedAt;

    return {
      exchange: this.name,
      symbol,
      price: item.lastPr,
      sourceTimestamp,
      fetchedAt,
      source: {
        name: 'bitget',
        endpoint: `${env.exchanges.bitget.baseUrl}/api/v2/spot/market/tickers`,
      },
    };
  }
}