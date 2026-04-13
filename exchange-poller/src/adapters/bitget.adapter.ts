import type pino from 'pino';
import { http } from '../utils/http';
import { nowIso } from '../utils/time';
import type { ExchangeAdapter, FetchedPrice } from '../core/types';

interface BitgetTickerResponse {
  code: string;
  msg: string;
  requestTime?: number;
  data?: Array<{
    symbol: string;
    lastPr: string;
    ts?: string;
  }>;
}

export class BitgetAdapter implements ExchangeAdapter {
  readonly name = 'bitget' as const;
  private readonly logger: pino.Logger;
  private readonly baseUrl = 'https://api.bitget.com';

  constructor(logger: pino.Logger) {
    this.logger = logger.child({ exchange: this.name });
  }

  async fetchPrice(symbol: string): Promise<FetchedPrice> {
    const endpoint = `/api/v2/spot/market/tickers?symbol=${encodeURIComponent(symbol)}`;
    const response = await http.get<BitgetTickerResponse>(`${this.baseUrl}${endpoint}`);
    const payload = response.data;

    if (payload.code !== '00000') {
      this.logger.warn({ response: payload }, 'Bitget returned error');
      throw new Error(`Bitget API error: ${payload.msg || payload.code}`);
    }

    const item = payload.data?.[0];

    if (!item) {
      this.logger.warn({ response: payload }, 'Empty Bitget ticker list');
      throw new Error('Bitget ticker not found');
    }

    if (!item.lastPr || Number.isNaN(Number(item.lastPr))) {
      this.logger.warn({ response: payload }, 'Invalid Bitget lastPr');
      throw new Error('Bitget returned invalid price');
    }

    const itemTs = item.ts ? Number(item.ts) : undefined;
    const ts = Number.isFinite(itemTs) ? itemTs : payload.requestTime;

    const sourceTimestamp =
      typeof ts === 'number' && Number.isFinite(ts)
        ? new Date(ts).toISOString()
        : nowIso();

    return {
      exchange: this.name,
      symbol: item.symbol,
      price: item.lastPr,
      sourceTimestamp,
      fetchedAt: nowIso(),
      source: {
        name: this.name,
        endpoint,
      },
    };
  }
}