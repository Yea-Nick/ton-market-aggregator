'use client';

import { ClientDateTime } from './ClientDateTime';
import { Exchange } from '@/lib/types';
import type { LatestMapValue, PriceFreshness } from '@/hooks/useTonPriceStream';

interface StatCardsProps {
  exchanges: Exchange[];
  connectionState: string;
  lastUpdateAt: string | null;
  latestMap: Partial<Record<Exchange, LatestMapValue>>;
}

const EXCHANGE_LABELS: Record<Exchange, string> = {
  bybit: 'Bybit',
  bitget: 'Bitget',
  stonfi: 'STON.fi',
  dedust: 'DeDust',
};

function getPreferredValues(
  exchanges: Exchange[],
  latestMap: Partial<Record<Exchange, LatestMapValue>>,
): LatestMapValue[] {
  const live = exchanges
    .map((exchange) => latestMap[exchange])
    .filter(
      (item): item is LatestMapValue =>
        !!item && item.freshness === 'live',
    );

  if (live.length > 0) {
    return live;
  }

  return exchanges
    .map((exchange) => latestMap[exchange])
    .filter((item): item is LatestMapValue => !!item && item.freshness === 'stale');
}

function getAveragePrice(values: LatestMapValue[]): number | null {
  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value.price, 0) / values.length;
}

function getSpread(values: LatestMapValue[]): number | null {
  if (values.length < 2) {
    return null;
  }

  const prices = values.map((value) => value.price);
  return Math.max(...prices) - Math.min(...prices);
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

function formatFreshnessLabel(freshness: PriceFreshness): string {
  switch (freshness) {
    case 'live':
      return 'Live';
    case 'stale':
      return 'Stale';
    default:
      return 'No data';
  }
}

export function StatCards({
  exchanges,
  connectionState,
  lastUpdateAt,
  latestMap,
}: StatCardsProps) {
  const preferredValues = getPreferredValues(exchanges, latestMap);
  const averagePrice = getAveragePrice(preferredValues);
  const spread = getSpread(preferredValues);

  const liveCount = exchanges.filter(
    (exchange) => latestMap[exchange]?.freshness === 'live',
  ).length;

  const staleCount = exchanges.filter(
    (exchange) => latestMap[exchange]?.freshness === 'stale',
  ).length;

  const averageMeta =
    liveCount > 0
      ? `Using ${liveCount} live source${liveCount > 1 ? 's' : ''}`
      : staleCount > 0
        ? `No live sources, using ${staleCount} stale`
        : 'No available sources';

  return (
    <section className="stats-layout">
      <div className="stats-grid">
        <article className="stat-card stat-card-featured">
          <div className="stat-label">Average price</div>
          <div className="stat-value stat-value-large">
            {averagePrice !== null ? averagePrice.toFixed(4) : '—'}
          </div>
          <div className="stat-meta">{averageMeta}</div>
        </article>

        <article className="stat-card">
          <div className="stat-label">Spread</div>
          <div className="stat-value">
            {spread !== null ? spread.toFixed(4) : '—'}
          </div>
          <div className="stat-meta">
            {preferredValues.length >= 2
              ? 'Max-min across active sources'
              : 'Need at least 2 active sources'}
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-label">Connection</div>
          <div className="stat-value">{connectionState}</div>
          <div className="stat-meta">
            {lastUpdateAt ? <ClientDateTime value={lastUpdateAt} /> : 'No live updates yet'}
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-label">Last tick</div>
          <div className="stat-value">
            <ClientDateTime value={lastUpdateAt} />
          </div>
          <div className="stat-meta">Latest received point</div>
        </article>
      </div>

      <div className="stats-grid stats-grid-exchanges">
        {exchanges.map((exchange) => {
          const latest = latestMap[exchange];

          return (
            <article key={exchange} className="stat-card">
              <div className="stat-label">{EXCHANGE_LABELS[exchange]}</div>
              <div className="stat-value">
                {latest ? latest.price.toFixed(4) : '—'}
              </div>
              <div className="stat-meta">
                {latest
                  ? `${formatFreshnessLabel(latest.freshness)} • ${formatAge(latest.ageMs)}`
                  : 'No data in selected window'}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}