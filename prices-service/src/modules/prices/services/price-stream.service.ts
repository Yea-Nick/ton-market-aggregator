import { Injectable } from '@nestjs/common';
import { SupportedExchange } from 'src/common/constants/prices.constants';

type StreamPoint = {
  eventId?: string;
  exchange: SupportedExchange | string;
  symbol: string;
  price: number;
  timestamp: string;
};

type SubscriptionFilter = {
  symbol: string;
  exchanges: string[];
};

type Subscriber = {
  id: string;
  filter: SubscriptionFilter;
  send: (payload: string) => void;
};

@Injectable()
export class PriceStreamService {
  private readonly subscribers = new Map<string, Subscriber>();

  register(subscriber: Subscriber): void {
    this.subscribers.set(subscriber.id, subscriber);
  }

  unregister(id: string): void {
    this.subscribers.delete(id);
  }

  broadcast(point: StreamPoint): void {
    const payload = JSON.stringify({ type: 'prices.tick', data: point });

    for (const subscriber of this.subscribers.values()) {
      const sameSymbol = subscriber.filter.symbol.toUpperCase() === point.symbol.toUpperCase();
      const exchangeAllowed =
        subscriber.filter.exchanges.length === 0 ||
        subscriber.filter.exchanges.includes(point.exchange.toLowerCase());

      if (sameSymbol && exchangeAllowed) {
        subscriber.send(payload);
      }
    }
  }
}
