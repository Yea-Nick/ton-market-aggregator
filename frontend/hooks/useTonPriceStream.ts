'use client';

import { useEffect, useMemo, useState } from 'react';
import { getWebSocketUrl } from '@/lib/api';
import { PricePoint, Exchange, TimeRange } from '@/lib/types';
import { ChartRow, toChartRows, upsertLivePoint } from '@/lib/chart';

interface UseTonPriceStreamParams {
  symbol: string;
  range: TimeRange;
  exchanges: Exchange[];
  initialPoints: PricePoint[];
}

export type PriceFreshness = 'live' | 'stale' | 'missing';

export interface LatestMapValue {
  price: number;
  timestamp: string;
  freshness: PriceFreshness;
  ageMs: number;
}

type ConnectionState = 'connecting' | 'connected' | 'disconnected';

const SOURCE_STALE_AFTER_MS: Record<Exchange, number> = {
  bybit: 30_000,
  bitget: 30_000,
  stonfi: 180_000,
  dedust: 180_000,
};

function toMs(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function getFreshnessTimestamp(point: Pick<PricePoint, 'timestamp' | 'sourceTimestamp'>): string {
  return point.sourceTimestamp ?? point.timestamp;
}

function normalizeIncomingPoint(payload: unknown): PricePoint | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate =
    'data' in payload && payload.data && typeof payload.data === 'object'
      ? payload.data
      : payload;

  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const rawExchange =
    'exchange' in candidate ? candidate.exchange : undefined;
  const rawSymbol =
    'symbol' in candidate ? candidate.symbol : undefined;
  const rawPrice =
    'price' in candidate ? candidate.price : undefined;
  const rawTimestamp =
    'timestamp' in candidate
      ? candidate.timestamp
      : undefined;
  const rawSourceTimestamp =
    'sourceTimestamp' in candidate
      ? candidate.sourceTimestamp
      : undefined;

  if (
    typeof rawExchange !== 'string' ||
    typeof rawSymbol !== 'string' ||
    (typeof rawPrice !== 'number' && typeof rawPrice !== 'string') ||
    typeof rawTimestamp !== 'string'
  ) {
    return null;
  }

  const price = Number(rawPrice);
  if (!Number.isFinite(price)) {
    return null;
  }

  const timestamp = new Date(rawTimestamp);
  if (Number.isNaN(timestamp.getTime())) {
    return null;
  }

  const normalizedSourceTimestamp =
    typeof rawSourceTimestamp === 'string' &&
      !Number.isNaN(new Date(rawSourceTimestamp).getTime())
      ? new Date(rawSourceTimestamp).toISOString()
      : undefined;

  return {
    exchange: rawExchange as Exchange,
    symbol: rawSymbol,
    price,
    timestamp: timestamp.toISOString(),
    sourceTimestamp: normalizedSourceTimestamp,
  };
}

function getFreshness(exchange: Exchange, timestamp: string, nowMs: number): PriceFreshness {
  const ts = new Date(timestamp).getTime();
  if (Number.isNaN(ts)) {
    return 'missing';
  }

  const ageMs = Math.max(0, nowMs - ts);
  return ageMs <= SOURCE_STALE_AFTER_MS[exchange] ? 'live' : 'stale';
}

function getRangeWindowMs(range: TimeRange): number {
  switch (range) {
    case '15m':
      return 15 * 60 * 1_000;
    case '1h':
      return 60 * 60 * 1_000;
    case '4h':
      return 4 * 60 * 60 * 1_000;
    case '24h':
      return 24 * 60 * 60 * 1_000;
    default:
      return 15 * 60 * 1_000;
  }
}

function trimPoints(points: PricePoint[], range: TimeRange): PricePoint[] {
  if (points.length === 0) {
    return points;
  }

  const latestMs = Math.max(
    ...points.map((point) => toMs(point.timestamp) ?? -Infinity),
  );

  if (!Number.isFinite(latestMs)) {
    return points;
  }

  const minMs = latestMs - getRangeWindowMs(range);

  return points.filter((point) => {
    const timestampMs = toMs(point.timestamp);
    return timestampMs !== null && timestampMs >= minMs;
  });
}

export function useTonPriceStream({
  symbol,
  range,
  exchanges,
  initialPoints,
}: UseTonPriceStreamParams) {
  const [points, setPoints] = useState<PricePoint[]>(() => [...initialPoints]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [lastUpdateAt, setLastUpdateAt] = useState<string | null>(null);
  const [baseLatestMap, setBaseLatestMap] = useState<
    Partial<Record<Exchange, { price: number; timestamp: string; sourceTimestamp?: string; }>>
  >({});
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 5_000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const nextPoints = [...initialPoints].sort(
      (left, right) =>
        new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
    );

    setPoints(nextPoints);

    const nextLatestMap: Partial<
      Record<Exchange, { price: number; timestamp: string; sourceTimestamp?: string; }>
    > = {};
    let nextLastUpdateAt: string | null = null;

    for (const point of nextPoints) {
      const current = nextLatestMap[point.exchange];
      const pointFreshnessMs = toMs(getFreshnessTimestamp(point)) ?? -Infinity;
      const currentFreshnessMs = current
        ? (toMs(getFreshnessTimestamp(current)) ?? -Infinity)
        : -Infinity;

      if (!current || pointFreshnessMs >= currentFreshnessMs) {
        nextLatestMap[point.exchange] = {
          price: point.price,
          timestamp: point.timestamp,
          sourceTimestamp: point.sourceTimestamp,
        };
      }

      const pointBucketMs = toMs(point.timestamp) ?? -Infinity;
      const currentLastUpdateMs = nextLastUpdateAt
        ? (toMs(nextLastUpdateAt) ?? -Infinity)
        : -Infinity;

      if (!nextLastUpdateAt || pointBucketMs >= currentLastUpdateMs) {
        nextLastUpdateAt = point.timestamp;
      }
    }

    setBaseLatestMap(nextLatestMap);
    setLastUpdateAt(nextLastUpdateAt);
  }, [initialPoints, range]);

  useEffect(() => {
    const socket = new WebSocket(getWebSocketUrl(symbol, range, exchanges));

    setConnectionState('connecting');

    socket.onopen = () => {
      setConnectionState('connected');
    };

    socket.onclose = () => {
      setConnectionState('disconnected');
    };

    socket.onerror = () => {
      setConnectionState('disconnected');
    };

    socket.onmessage = (event) => {
      try {
        const rawPayload = JSON.parse(event.data);
        const point = normalizeIncomingPoint(rawPayload);

        if (!point) {
          return;
        }

        if (point.symbol !== symbol) {
          return;
        }

        if (!exchanges.includes(point.exchange)) {
          return;
        }

        setPoints((current) => trimPoints(upsertLivePoint(current, point), range));

        setBaseLatestMap((current) => {
          const existing = current[point.exchange];
          const existingFreshnessMs = existing
            ? (toMs(getFreshnessTimestamp(existing)) ?? -Infinity)
            : -Infinity;
          const incomingFreshnessMs =
            toMs(getFreshnessTimestamp(point)) ?? -Infinity;

          if (incomingFreshnessMs < existingFreshnessMs) {
            return current;
          }

          return {
            ...current,
            [point.exchange]: {
              price: point.price,
              timestamp: point.timestamp,
              sourceTimestamp: point.sourceTimestamp,
            },
          };
        });

        setLastUpdateAt((current) => {
          const currentMs = current ? (toMs(current) ?? -Infinity) : -Infinity;
          const incomingMs = toMs(point.timestamp) ?? -Infinity;

          return incomingMs >= currentMs ? point.timestamp : current;
        });

        setNowMs(Date.now());
      } catch (error) {
        console.warn('Failed to process websocket message:', error);
      }
    };

    return () => {
      socket.close();
    };
  }, [symbol, range, exchanges]);

  const rows = useMemo<ChartRow[]>(() => {
    return toChartRows(points, range);
  }, [points, range]);

  const filteredRows = useMemo(() => {
    return rows.map((row) => ({
      timestamp: row.timestamp,
      bybit: exchanges.includes('bybit') ? row.bybit : null,
      bitget: exchanges.includes('bitget') ? row.bitget : null,
      stonfi: exchanges.includes('stonfi') ? row.stonfi : null,
      dedust: exchanges.includes('dedust') ? row.dedust : null,
    }));
  }, [rows, exchanges]);

  const latestMap = useMemo(() => {
    const next: Partial<Record<Exchange, LatestMapValue>> = {};

    for (const exchange of exchanges) {
      const latest = baseLatestMap[exchange];
      if (!latest) {
        continue;
      }

      const freshnessTs = getFreshnessTimestamp(latest);
      const ts = new Date(freshnessTs).getTime();
      const ageMs = Number.isNaN(ts) ? 0 : Math.max(0, nowMs - ts);

      next[exchange] = {
        price: latest.price,
        timestamp: latest.timestamp,
        freshness: getFreshness(exchange, freshnessTs, nowMs),
        ageMs,
      };
    }

    return next;
  }, [baseLatestMap, exchanges, nowMs]);

  return {
    rows: filteredRows,
    connectionState,
    lastUpdateAt,
    latestMap,
  };
}