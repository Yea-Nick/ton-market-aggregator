'use client';

import { formatExchangeName, getLastValue } from '@/lib/chart';
import { ChartRow, Exchange } from '@/lib/types';

interface StatCardsProps {
  rows: ChartRow[];
  exchanges: Exchange[];
  connectionState: 'connecting' | 'connected' | 'disconnected';
  lastUpdateAt: string | null;
}

export function StatCards({ rows, exchanges, connectionState, lastUpdateAt }: StatCardsProps) {
  return (
    <div className="stat-grid">
      <div className="card stat-card">
        <div className="stat-label">WebSocket</div>
        <div className={`status-badge status-${connectionState}`}>{renderState(connectionState)}</div>
      </div>

      <div className="card stat-card">
        <div className="stat-label">Последнее обновление</div>
        <div className="stat-value-small">{lastUpdateAt ? formatDateTime(lastUpdateAt) : '—'}</div>
      </div>

      {exchanges.map((exchange) => {
        const value = getLastValue(rows, exchange);
        return (
          <div className="card stat-card" key={exchange}>
            <div className="stat-label">{formatExchangeName(exchange)}</div>
            <div className="stat-value">{typeof value === 'number' ? value.toFixed(4) : '—'}</div>
          </div>
        );
      })}
    </div>
  );
}

function renderState(state: 'connecting' | 'connected' | 'disconnected') {
  if (state === 'connected') return 'connected';
  if (state === 'connecting') return 'connecting';
  return 'disconnected';
}

function formatDateTime(timestamp: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp));
}
