'use client';

import { formatExchangeName } from '@/lib/chart';
import { Exchange } from '@/lib/types';

interface PriceTableProps {
  latestMap: Record<string, { price: number; timestamp: string; }>;
  exchanges: Exchange[];
}

export function PriceTable({ latestMap, exchanges }: PriceTableProps) {
  return (
    <div className="card table-card">
      <div className="section-title">Latest prices</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Market</th>
              <th>Price</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {exchanges.map((exchange) => {
              const entry = latestMap[exchange];
              return (
                <tr key={exchange}>
                  <td>{formatExchangeName(exchange)}</td>
                  <td>{entry ? entry.price.toFixed(4) : '—'}</td>
                  <td>{entry ? formatTimestamp(entry.timestamp) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(timestamp));
}
