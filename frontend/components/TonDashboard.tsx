'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { fetchPriceHistory } from '@/lib/api';
import { Exchange, EXCHANGES, PricePoint, TimeRange } from '@/lib/types';
import { ControlBar } from './ControlBar';
import { PriceChart } from './PriceChart';
import { PriceTable } from './PriceTable';
import { StatCards } from './StatCards';
import { useTonPriceStream } from '@/hooks/useTonPriceStream';

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

  return (
    <main className="page-shell">
      <section className="hero card">
        <div>
          <div className="hero-kicker">Real-time TON market stream</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image
              src="/toncoin.png"
              alt="Toncoin logo"
              width={128}
              height={128}
              priority
            />
            <h1>TON price dashboard</h1>
          </div>
        </div>

        <div className="hero-side">
          <div className="hero-badge">{symbol}</div>
          <div className="hero-hint">{isLoading ? 'Updating history...' : 'Live mode enabled'}</div>
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
        <PriceChart rows={rows} exchanges={selectedExchanges} />
      </section>

      <PriceTable latestMap={latestMap} exchanges={selectedExchanges} />
    </main>
  );
}