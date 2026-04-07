export type Exchange = 'bybit' | 'bitget' | 'stonfi' | 'dedust';
export type TimeRange = '15m' | '1h' | '4h' | '24h';

export interface PricePoint {
  eventId?: string;
  exchange: Exchange;
  symbol: string;
  price: number;
  timestamp: string;
}

export interface HistoryResponse {
  symbol: string;
  range: TimeRange;
  points: PricePoint[];
}

export interface LatestPrice {
  exchange: Exchange;
  symbol: string;
  price: number;
  timestamp: string;
}

export interface LatestResponse {
  symbol: string;
  items: LatestPrice[];
}

export interface ChartRow {
  timestamp: string;
  bybit: number | null;
  bitget: number | null;
  stonfi: number | null;
  dedust: number | null;
}

export const EXCHANGES: Exchange[] = ['bybit', 'bitget', 'stonfi', 'dedust'];
export const TIME_RANGES: TimeRange[] = ['15m', '1h', '4h', '24h'];
