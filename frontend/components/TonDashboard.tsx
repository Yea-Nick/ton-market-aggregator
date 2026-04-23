'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { fetchPriceHistory } from '@/lib/api';
import { Exchange, EXCHANGES, PricePoint, TimeRange } from '@/lib/types';
import { ControlBar } from './ControlBar';
import { StatCards } from './StatCards';
import { useTonPriceStream } from '@/hooks/useTonPriceStream';

const PriceChart = dynamic(
  () => import('./PriceChart').then((mod) => mod.PriceChart),
  { ssr: false },
);

interface TonDashboardProps {
  symbol: string;
  initialRange: TimeRange;
  initialExchanges: Exchange[];
  initialPoints: PricePoint[];
}

function formatAge(ageMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(ageMs / 1000));

  if (totalSeconds < 60) {
    return `${totalSeconds}s ago`;
  }

  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes}m ago`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  return `${totalHours}h ago`;
}

export function TonDashboard({
  symbol,
  initialRange,
  initialExchanges,
  initialPoints,
}: TonDashboardProps) {
  const [range, setRange] = useState<TimeRange>(initialRange);
  const [selectedExchanges, setSelectedExchanges] = useState<Exchange[]>(initialExchanges);
  const [historyPoints, setHistoryPoints] = useState<PricePoint[]>(initialPoints);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    fetchPriceHistory(symbol, range, selectedExchanges)
      .then((points) => {
        if (!cancelled) {
          setHistoryPoints(points);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, range, selectedExchanges]);

  const { rows, connectionState, lastUpdateAt, latestMap } = useTonPriceStream({
    symbol,
    range,
    exchanges: selectedExchanges,
    initialPoints: historyPoints,
  });

  const handleExchangeToggle = (exchange: Exchange) => {
    setSelectedExchanges((prev) => {
      if (prev.includes(exchange)) {
        const next = prev.filter((item) => item !== exchange);
        return next.length ? next : prev;
      }

      return [...prev, exchange].sort(
        (a, b) => EXCHANGES.indexOf(a) - EXCHANGES.indexOf(b),
      );
    });
  };

  const liveValues = useMemo(() => {
    return selectedExchanges
      .map((exchange) => latestMap[exchange])
      .filter(
        (item): item is NonNullable<typeof item> =>
          !!item && item.freshness === 'live',
      );
  }, [latestMap, selectedExchanges]);

  const staleValues = useMemo(() => {
    return selectedExchanges
      .map((exchange) => latestMap[exchange])
      .filter(
        (item): item is NonNullable<typeof item> =>
          !!item && item.freshness === 'stale',
      );
  }, [latestMap, selectedExchanges]);

  const hero = useMemo(() => {
    const preferred = liveValues.length > 0 ? liveValues : staleValues;

    if (!preferred.length) {
      return {
        price: null as number | null,
        label: 'No recent data',
      };
    }

    const avg =
      preferred.reduce((sum, item) => sum + item.price, 0) / preferred.length;

    if (liveValues.length > 0) {
      return {
        price: avg,
        label: `Live from ${liveValues.length} source${liveValues.length > 1 ? 's' : ''}`,
      };
    }

    const oldestAgeMs = Math.max(...preferred.map((item) => item.ageMs));
    return {
      price: avg,
      label: `Stale • last update ${formatAge(oldestAgeMs)}`,
    };
  }, [liveValues, staleValues]);

  const chartStatus = useMemo(() => {
    if (isLoading) {
      return 'Loading history...';
    }

    if (rows.length === 0) {
      return `No ticks in selected ${range} window`;
    }

    if (liveValues.length > 0) {
      return `Live chart • ${rows.length} bucket${rows.length > 1 ? 's' : ''}`;
    }

    if (staleValues.length > 0) {
      return `No live sources • showing historical buckets only`;
    }

    return `No data in selected ${range} window`;
  }, [isLoading, rows.length, range, liveValues.length, staleValues.length]);

  return (
    <main className="page-shell">
      <section className="hero card">
        <div className="hero-left">
          <div className="hero-row">
            <Image
              src="/toncoin.png"
              alt="Toncoin logo"
              width={32}
              height={32}
              priority
            />
            <div className="hero-title">TON market terminal</div>
          </div>

          <div className="hero-price">
            {hero.price !== null ? hero.price.toFixed(4) : '—'}
          </div>

          <div className="hero-sub">{hero.label}</div>
        </div>

        <div className="hero-side">
          <div className="hero-badge">{symbol}</div>
          <div className="hero-badge">
            {connectionState === 'connected' ? 'WS connected' : connectionState}
          </div>
          <div className="hero-badge">{range}</div>
        </div>
      </section>

      <ControlBar
        range={range}
        exchanges={selectedExchanges}
        onRangeChange={setRange}
        onExchangeToggle={handleExchangeToggle}
      />

      <StatCards
        exchanges={selectedExchanges}
        connectionState={connectionState}
        lastUpdateAt={lastUpdateAt}
        latestMap={latestMap}
      />

      <section className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '12px',
            color: '#9aa0aa',
            fontSize: '14px',
          }}
        >
          <div>{chartStatus}</div>
          <div>{isLoading ? 'Refreshing…' : 'History + live ticks'}</div>
        </div>

        <PriceChart rows={rows} exchanges={selectedExchanges} range={range} />
      </section>
    </main>
  );
}