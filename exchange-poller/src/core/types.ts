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
