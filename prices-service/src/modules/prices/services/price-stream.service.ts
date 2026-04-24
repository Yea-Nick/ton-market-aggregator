import { Injectable, OnModuleDestroy } from '@nestjs/common';
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

interface StreamItemPayload {
  exchange: SupportedExchange;
  symbol: string;
  price: number;
  timestamp: string;
  sourceTimestamp: string;
}

interface StreamSnapshotPayload {
  type: 'snapshot';
  symbol: string;
  timestamp: string;
  items: StreamItemPayload[];
}

const WS_STALE_AFTER_MS: Record<SupportedExchange, number> = {
  bybit: 180_000,
  bitget: 180_000,
  stonfi: 300_000,
  dedust: 300_000,
};

@Injectable()
export class PriceStreamService implements OnModuleDestroy {
  private readonly FLUSH_THROTTLE_MS = 150;

  private readonly clients = new Map<WebSocket, SubscriptionFilter>();

  private readonly latestBySymbol = new Map<
    string,
    Partial<Record<SupportedExchange, LatestValue>>
  >();

  private readonly pendingFlushTimers = new Map<string, NodeJS.Timeout>();

  registerClient(client: WebSocket, filter: SubscriptionFilter): void {
    this.clients.set(client, {
      ...filter,
      symbol: filter.symbol.toUpperCase(),
    });
  }

  unregisterClient(client: WebSocket): void {
    this.clients.delete(client);
  }

  onModuleDestroy(): void {
    for (const timer of this.pendingFlushTimers.values()) {
      clearTimeout(timer);
    }

    this.pendingFlushTimers.clear();
  }

  ingestTick(point: BroadcastPoint): void {
    const symbol = point.symbol.toUpperCase();
    const incomingTimestampMs = new Date(point.timestamp).getTime();

    if (Number.isNaN(incomingTimestampMs)) {
      return;
    }

    const current = this.latestBySymbol.get(symbol) ?? {};
    const previous = current[point.exchange];

    if (previous) {
      const previousTimestampMs = new Date(previous.timestamp).getTime();

      if (
        !Number.isNaN(previousTimestampMs) &&
        incomingTimestampMs < previousTimestampMs
      ) {
        return;
      }
    }

    current[point.exchange] = {
      price: point.price,
      timestamp: point.timestamp,
    };

    this.latestBySymbol.set(symbol, current);
    this.scheduleFlush(symbol);
  }

  private scheduleFlush(symbol: string): void {
    if (this.pendingFlushTimers.has(symbol)) {
      return;
    }

    const timer = setTimeout(() => {
      this.pendingFlushTimers.delete(symbol);
      this.flushSymbol(symbol);
    }, this.FLUSH_THROTTLE_MS);

    this.pendingFlushTimers.set(symbol, timer);
  }

  private flushSymbol(symbol: string): void {
    const snapshot = this.latestBySymbol.get(symbol);
    if (!snapshot) {
      return;
    }

    const triggerTimestamp = this.getLatestSnapshotTimestamp(snapshot);
    if (!triggerTimestamp) {
      return;
    }

    const nowMs = Date.now();

    for (const [client, filter] of this.clients.entries()) {
      if (client.readyState !== WebSocket.OPEN) {
        this.clients.delete(client);
        continue;
      }

      if (filter.symbol !== symbol) {
        continue;
      }

      const alignedTimestamp = bucketTimestamp(triggerTimestamp, filter.range);
      const items: StreamItemPayload[] = [];

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

        items.push({
          exchange,
          symbol,
          price: latest.price,
          timestamp: alignedTimestamp,
          sourceTimestamp: latest.timestamp,
        });
      }

      if (items.length === 0) {
        continue;
      }

      const payload: StreamSnapshotPayload = {
        type: 'snapshot',
        symbol,
        timestamp: alignedTimestamp,
        items,
      };

      client.send(JSON.stringify(payload));
    }
  }

  private getLatestSnapshotTimestamp(
    snapshot: Partial<Record<SupportedExchange, LatestValue>>,
  ): string | null {
    let latestTimestamp: string | null = null;
    let latestTimestampMs = -Infinity;

    for (const value of Object.values(snapshot)) {
      if (!value) {
        continue;
      }

      const timestampMs = new Date(value.timestamp).getTime();

      if (Number.isNaN(timestampMs)) {
        continue;
      }

      if (timestampMs > latestTimestampMs) {
        latestTimestampMs = timestampMs;
        latestTimestamp = value.timestamp;
      }
    }

    return latestTimestamp;
  }
}