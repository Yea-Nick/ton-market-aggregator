import { Injectable } from '@nestjs/common';
import { WebSocket } from 'ws';
import {
  SupportedExchange,
  SupportedRange,
} from '../../../common/constants/prices.constants';
import { bucketTimestamp } from '../utils/price-time.util';

export interface SubscriptionFilter {
  symbol: string;
  exchanges: SupportedExchange[];
  range: SupportedRange;
}

interface LatestValue {
  price: number;
  timestamp: string;
}

interface BroadcastPoint {
  exchange: SupportedExchange;
  symbol: string;
  price: number;
  timestamp: string;
}

interface StreamPayload {
  exchange: SupportedExchange;
  symbol: string;
  price: number;
  timestamp: string;
  sourceTimestamp: string;
}

const WS_STALE_AFTER_MS: Record<SupportedExchange, number> = {
  bybit: 30_000,
  bitget: 30_000,
  stonfi: 60_000,
  dedust: 60_000,
};

@Injectable()
export class PriceStreamService {
  private readonly clients = new Map<WebSocket, SubscriptionFilter>();

  private readonly latestBySymbol = new Map<
    string,
    Partial<Record<SupportedExchange, LatestValue>>
  >();

  registerClient(client: WebSocket, filter: SubscriptionFilter): void {
    this.clients.set(client, filter);
  }

  unregisterClient(client: WebSocket): void {
    this.clients.delete(client);
  }

  ingestTick(point: BroadcastPoint): void {
    const symbol = point.symbol.toUpperCase();
    const current = this.latestBySymbol.get(symbol) ?? {};

    current[point.exchange] = {
      price: point.price,
      timestamp: point.timestamp,
    };

    this.latestBySymbol.set(symbol, current);

    for (const [client, filter] of this.clients.entries()) {
      if (client.readyState !== WebSocket.OPEN) {
        continue;
      }

      if (filter.symbol !== symbol) {
        continue;
      }

      const alignedTimestamp = bucketTimestamp(point.timestamp, filter.range);
      const snapshot = this.latestBySymbol.get(symbol);

      if (!snapshot) {
        continue;
      }

      const nowMs = Date.now();

      for (const exchange of filter.exchanges) {
        const latest = snapshot[exchange];

        if (!latest) {
          continue;
        }

        const sourceTimestampMs = new Date(latest.timestamp).getTime();
        if (Number.isNaN(sourceTimestampMs)) {
          continue;
        }

        const ageMs = Math.max(0, nowMs - sourceTimestampMs);
        if (ageMs > WS_STALE_AFTER_MS[exchange]) {
          continue;
        }

        const payload: StreamPayload = {
          exchange,
          symbol,
          price: latest.price,
          timestamp: alignedTimestamp,
          sourceTimestamp: latest.timestamp,
        };

        client.send(JSON.stringify(payload));
      }
    }
  }
}