import type pino from 'pino';
import { http } from '../utils/http';
import { nowIso } from '../utils/time';
import type { ExchangeAdapter, FetchedPrice } from '../core/types';

interface BybitTickerResponse {
  retCode: number;
  retMsg: string;
  result?: {
    category: string;
    list: Array<{
      symbol: string;
      lastPrice: string;
    }>;
  };
  time?: number;
}

export class BybitAdapter implements ExchangeAdapter {
  readonly name = 'bybit' as const;
  private readonly logger: pino.Logger;
  private readonly baseUrl = 'https://api.bybit.com';

  constructor(logger: pino.Logger) {
    this.logger = logger.child({ exchange: this.name });
  }

  async fetchPrice(symbol: string): Promise<FetchedPrice> {
    const endpoint = `/v5/market/tickers?category=spot&symbol=${encodeURIComponent(symbol)}`;
    const response = await http.get<BybitTickerResponse>(`${this.baseUrl}${endpoint}`);
    const payload = response.data;

    if (payload.retCode !== 0) {
      this.logger.warn({ response: payload }, 'Bybit returned error');
      throw new Error(`Bybit API error: ${payload.retMsg || payload.retCode}`);
    }

    const item = payload.result?.list?.[0];

    if (!item) {
      this.logger.warn({ response: payload }, 'Empty Bybit ticker list');
      throw new Error('Bybit ticker not found');
    }

    if (!item.lastPrice || Number.isNaN(Number(item.lastPrice))) {
      this.logger.warn({ response: payload }, 'Invalid Bybit lastPrice');
      throw new Error('Bybit returned invalid price');
    }

    return {
      exchange: this.name,
      symbol: item.symbol,
      price: item.lastPrice,
      sourceTimestamp: payload.time ? new Date(payload.time).toISOString() : nowIso(),
      fetchedAt: nowIso(),
      source: {
        name: this.name,
        endpoint,
      },
    };
  }
}