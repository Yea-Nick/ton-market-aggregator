import { ChartRow, EXCHANGES, Exchange, PricePoint } from './types';

export function mergePointsToChartRows(points: PricePoint[]): ChartRow[] {
  const rows = new Map<string, ChartRow>();

  for (const point of points) {
    const bucket = point.timestamp;
    const existing = rows.get(bucket) ?? {
      timestamp: bucket,
      bybit: null,
      bitget: null,
      stonfi: null,
      dedust: null,
    };

    existing[point.exchange] = point.price;
    rows.set(bucket, existing);
  }

  return Array.from(rows.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

export function upsertLivePoint(rows: ChartRow[], point: PricePoint): ChartRow[] {
  const next = [...rows];
  const index = next.findIndex((row) => row.timestamp === point.timestamp);

  if (index >= 0) {
    next[index] = {
      ...next[index],
      [point.exchange]: point.price,
    };
    return next;
  }

  const newRow: ChartRow = {
    timestamp: point.timestamp,
    bybit: null,
    bitget: null,
    stonfi: null,
    dedust: null,
    [point.exchange]: point.price,
  };

  next.push(newRow);
  next.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return next;
}

export function formatExchangeName(exchange: Exchange): string {
  switch (exchange) {
    case 'stonfi':
      return 'STON.fi';
    case 'dedust':
      return 'DeDust';
    case 'bitget':
      return 'Bitget';
    case 'bybit':
      return 'Bybit';
    default:
      return exchange;
  }
}

export function formatChartTime(timestamp: string): string {
  const date = new Date(timestamp);

  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

export function getLastValue(rows: ChartRow[], exchange: Exchange): number | null {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const value = rows[i][exchange];
    if (typeof value === 'number') {
      return value;
    }
  }

  return null;
}

export function getLastTimestamp(rows: ChartRow[]): string | null {
  return rows.length ? rows[rows.length - 1].timestamp : null;
}

export function pruneRows(rows: ChartRow[], maxRows = 400): ChartRow[] {
  return rows.length > maxRows ? rows.slice(rows.length - maxRows) : rows;
}

export function hasExchangeData(rows: ChartRow[], exchange: Exchange): boolean {
  return rows.some((row) => typeof row[exchange] === 'number');
}

export { EXCHANGES };
