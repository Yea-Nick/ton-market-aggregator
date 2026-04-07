'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchLatestPrices, getWebSocketUrl } from '@/lib/api';
import { getLastTimestamp, mergePointsToChartRows, pruneRows, upsertLivePoint } from '@/lib/chart';
import { ChartRow, Exchange, PricePoint, TimeRange } from '@/lib/types';

interface UseTonPriceStreamParams {
  symbol: string;
  range: TimeRange;
  exchanges: Exchange[];
  initialPoints: PricePoint[];
}

interface WebSocketEnvelope {
  type?: string;
  data?: PricePoint;
  exchange?: Exchange;
  symbol?: string;
  price?: number;
  timestamp?: string;
}

export function useTonPriceStream({ symbol, range, exchanges, initialPoints }: UseTonPriceStreamParams) {
  const [rows, setRows] = useState<ChartRow[]>(() => mergePointsToChartRows(initialPoints));
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [lastUpdateAt, setLastUpdateAt] = useState<string | null>(() => getLastTimestamp(mergePointsToChartRows(initialPoints)));
  const [latestMap, setLatestMap] = useState<Record<string, { price: number; timestamp: string }>>({});
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    setRows(mergePointsToChartRows(initialPoints));
    setLastUpdateAt(getLastTimestamp(mergePointsToChartRows(initialPoints)));
  }, [initialPoints]);

  useEffect(() => {
    let cancelled = false;

    fetchLatestPrices(symbol).then((items) => {
      if (cancelled) {
        return;
      }

      const map = items.reduce<Record<string, { price: number; timestamp: string }>>((acc, item) => {
        acc[item.exchange] = { price: item.price, timestamp: item.timestamp };
        return acc;
      }, {});

      setLatestMap(map);
    });

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  useEffect(() => {
    setConnectionState('connecting');

    const socket = new WebSocket(getWebSocketUrl(symbol, range, exchanges));
    socketRef.current = socket;

    socket.onopen = () => setConnectionState('connected');
    socket.onclose = () => setConnectionState('disconnected');
    socket.onerror = () => setConnectionState('disconnected');

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as WebSocketEnvelope;
        const point = normalizeWebSocketPayload(payload);

        if (!point || !exchanges.includes(point.exchange)) {
          return;
        }

        setRows((prev) => pruneRows(upsertLivePoint(prev, point)));
        setLastUpdateAt(point.timestamp);
        setLatestMap((prev) => ({
          ...prev,
          [point.exchange]: { price: point.price, timestamp: point.timestamp },
        }));
      } catch {
        // Ignore malformed payloads.
      }
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [symbol, range, exchanges]);

  const filteredRows = useMemo(() => {
    return rows.map((row) => {
      const nextRow: ChartRow = { ...row };
      for (const exchange of ['bybit', 'bitget', 'stonfi', 'dedust'] as Exchange[]) {
        if (!exchanges.includes(exchange)) {
          nextRow[exchange] = null;
        }
      }
      return nextRow;
    });
  }, [rows, exchanges]);

  return {
    rows: filteredRows,
    connectionState,
    lastUpdateAt,
    latestMap,
  };
}

function normalizeWebSocketPayload(payload: WebSocketEnvelope): PricePoint | null {
  if (payload.data) {
    return payload.data;
  }

  if (payload.exchange && payload.symbol && payload.timestamp && typeof payload.price === 'number') {
    return {
      exchange: payload.exchange,
      symbol: payload.symbol,
      timestamp: payload.timestamp,
      price: payload.price,
    };
  }

  return null;
}
