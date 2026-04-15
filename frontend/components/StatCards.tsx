'use client';

import { Exchange } from '@/lib/types';
import type { ChartRow } from '@/lib/chart';
import { ClientDateTime } from './ClientDateTime';

interface StatCardsProps {
  rows: ChartRow[];
  exchanges: Exchange[];
  connectionState: string;
  lastUpdateAt: string | null;
}

const EXCHANGE_LABELS: Record<Exchange, string> = {
  bybit: 'Bybit',
  bitget: 'Bitget',
  stonfi: 'STON.fi',
  dedust: 'DeDust',
};

function getLatestPrice(rows: ChartRow[], exchange: Exchange): number | null {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const value = rows[index][exchange];
    if (typeof value === 'number') {
      return value;
    }
  }

  return null;
}

function getAveragePrice(rows: ChartRow[], exchanges: Exchange[]): number | null {
  const values = exchanges
    .map((exchange) => getLatestPrice(rows, exchange))
    .filter((value): value is number => typeof value === 'number');

  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getSpread(rows: ChartRow[], exchanges: Exchange[]): number | null {
  const values = exchanges
    .map((exchange) => getLatestPrice(rows, exchange))
    .filter((value): value is number => typeof value === 'number');

  if (values.length < 2) {
    return null;
  }

  return Math.max(...values) - Math.min(...values);
}

export function StatCards({
  rows,
  exchanges,
  connectionState,
  lastUpdateAt,
}: StatCardsProps) {
  const averagePrice = getAveragePrice(rows, exchanges);
  const spread = getSpread(rows, exchanges);
  const latestChartTimestamp = rows.length ? rows[rows.length - 1].timestamp : null;

  return (
    <section className="stats-layout">
      <div className="stats-grid">
        <article className="stat-card stat-card-featured">
          <div className="stat-label">Average price</div>
          <div className="stat-value stat-value-large">
            {averagePrice !== null ? averagePrice.toFixed(4) : '—'}
          </div>
          <div className="stat-meta">Selected sources: {exchanges.length}</div>
        </article>

        <article className="stat-card">
          <div className="stat-label">Spread</div>
          <div className="stat-value">
            {spread !== null ? spread.toFixed(4) : '—'}
          </div>
          <div className="stat-meta">Max-min across exchanges</div>
        </article>

        <article className="stat-card">
          <div className="stat-label">Connection</div>
          <div className="stat-value">{connectionState}</div>
          <div className="stat-meta"></div>
        </article>

        <article className="stat-card">
          <div className="stat-label">Last tick</div>
          <div className="stat-value">
            <ClientDateTime value={latestChartTimestamp} />
          </div>
          <div className="stat-meta">Latest chart timestamp</div>
        </article>
      </div>

      <div className="stats-grid stats-grid-exchanges">
        {exchanges.map((exchange) => {
          const price = getLatestPrice(rows, exchange);

          return (
            <article key={exchange} className="stat-card">
              <div className="stat-label">{EXCHANGE_LABELS[exchange]}</div>
              <div className="stat-value">
                {price !== null ? price.toFixed(4) : '—'}
              </div>
              <div className="stat-meta"></div>
            </article>
          );
        })}
      </div>
    </section>
  );
}