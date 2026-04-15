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

interface LatestMapValue {
  price: number;
  timestamp: string;
}

type ConnectionState = 'connecting' | 'connected' | 'disconnected';

function normalizeIncomingPoint(payload: unknown): PricePoint | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate =
    'data' in payload &&
      payload.data &&
      typeof payload.data === 'object'
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
      : 'sourceTimestamp' in candidate
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

  return {
    exchange: rawExchange as Exchange,
    symbol: rawSymbol,
    price,
    timestamp: timestamp.toISOString(),
  };
}

export function useTonPriceStream({
  symbol,
  range,
  exchanges,
  initialPoints,
}: UseTonPriceStreamParams) {
  const [rows, setRows] = useState<ChartRow[]>(() => toChartRows(initialPoints, range));
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [lastUpdateAt, setLastUpdateAt] = useState<string | null>(null);
  const [latestMap, setLatestMap] = useState<Record<string, LatestMapValue>>({});

  useEffect(() => {
    setRows(toChartRows(initialPoints, range));

    const nextLatestMap: Record<string, LatestMapValue> = {};

    for (const point of initialPoints) {
      const current = nextLatestMap[point.exchange];

      if (
        !current ||
        new Date(point.timestamp).getTime() >= new Date(current.timestamp).getTime()
      ) {
        nextLatestMap[point.exchange] = {
          price: point.price,
          timestamp: point.timestamp,
        };
      }
    }

    setLatestMap(nextLatestMap);
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
          console.warn('Ignored websocket payload with unknown shape:', rawPayload);
          return;
        }

        if (point.symbol !== symbol) {
          return;
        }

        if (!exchanges.includes(point.exchange)) {
          return;
        }

        setRows((current) => {
          const next = upsertLivePoint(current, point, range);
          return next.length > 500 ? next.slice(next.length - 500) : next;
        });

        setLatestMap((current) => ({
          ...current,
          [point.exchange]: {
            price: point.price,
            timestamp: point.timestamp,
          },
        }));

        setLastUpdateAt(point.timestamp);
      } catch (error) {
        console.warn('Failed to process websocket message:', error);
      }
    };

    return () => {
      socket.close();
    };
  }, [symbol, range, exchanges]);

  const filteredRows = useMemo(() => {
    return rows.map((row) => ({
      timestamp: row.timestamp,
      bybit: exchanges.includes('bybit') ? row.bybit : null,
      bitget: exchanges.includes('bitget') ? row.bitget : null,
      stonfi: exchanges.includes('stonfi') ? row.stonfi : null,
      dedust: exchanges.includes('dedust') ? row.dedust : null,
    }));
  }, [rows, exchanges]);

  return {
    rows: filteredRows,
    connectionState,
    lastUpdateAt,
    latestMap,
  };
}