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

  const heroPrice = useMemo(() => {
    const values = selectedExchanges
      .map((exchange) => latestMap[exchange]?.price)
      .filter((value): value is number => typeof value === 'number');

    if (!values.length) {
      return null;
    }

    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    return avg;
  }, [latestMap, selectedExchanges]);

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
            {heroPrice !== null ? heroPrice.toFixed(4) : '—'}
          </div>

          <div className="hero-sub">
            Aggregated live price across selected exchanges
          </div>
        </div>

        <div className="hero-side">
          <div className="hero-badge">{symbol}</div>
          <div className="hero-hint">
            {isLoading ? 'Updating history...' : 'Live mode enabled'}
          </div>
        </div>
      </section>

      <ControlBar
        range={range}
        exchanges={selectedExchanges}
        onRangeChange={setRange}
        onExchangeToggle={handleExchangeToggle}
      />

      <StatCards
        rows={rows}
        exchanges={selectedExchanges}
        connectionState={connectionState}
        lastUpdateAt={lastUpdateAt}
      />

      <section className="card chart-card">
        <div className="section-title-row">
          <div>
            <div className="section-title">Chart</div>
            <div className="section-subtitle">
              Range: {range}. Active sources: {selectedExchanges.length}
            </div>
          </div>
        </div>
        <PriceChart rows={rows} exchanges={selectedExchanges} range={range} />
      </section>
    </main>
  );
}