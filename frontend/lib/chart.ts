import { Exchange, EXCHANGES, PricePoint, TimeRange } from './types';

export interface ChartRow {
  timestamp: string;
  bybit: number | null;
  bitget: number | null;
  stonfi: number | null;
  dedust: number | null;
}

export function toChartRows(points: PricePoint[], _range: TimeRange): ChartRow[] {
  const rowsMap = new Map<string, ChartRow>();

  for (const point of points) {
    const existing = rowsMap.get(point.timestamp);

    if (existing) {
      existing[point.exchange] = point.price;
      continue;
    }

    rowsMap.set(point.timestamp, {
      timestamp: point.timestamp,
      bybit: point.exchange === 'bybit' ? point.price : null,
      bitget: point.exchange === 'bitget' ? point.price : null,
      stonfi: point.exchange === 'stonfi' ? point.price : null,
      dedust: point.exchange === 'dedust' ? point.price : null,
    });
  }

  return Array.from(rowsMap.values()).sort(
    (left, right) =>
      new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
  );
}

export function upsertLivePoint(
  rows: ChartRow[],
  point: PricePoint,
  _range: TimeRange,
): ChartRow[] {
  const nextRows = [...rows];
  const existingIndex = nextRows.findIndex((row) => row.timestamp === point.timestamp);

  if (existingIndex >= 0) {
    nextRows[existingIndex] = {
      ...nextRows[existingIndex],
      [point.exchange]: point.price,
    };

    return nextRows;
  }

  nextRows.push({
    timestamp: point.timestamp,
    bybit: point.exchange === 'bybit' ? point.price : null,
    bitget: point.exchange === 'bitget' ? point.price : null,
    stonfi: point.exchange === 'stonfi' ? point.price : null,
    dedust: point.exchange === 'dedust' ? point.price : null,
  });

  nextRows.sort(
    (left, right) =>
      new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
  );

  return nextRows;
}

export function getLastValue(rows: ChartRow[], exchange: Exchange): number | null {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const value = rows[index][exchange];
    if (typeof value === 'number') {
      return value;
    }
  }

  return null;
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

function toDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatAxisTime(timestamp: string, range: TimeRange): string {
  const date = toDate(timestamp);

  if (!date) {
    return '—';
  }

  if (range === '15m' || range === '1h') {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatTooltipTime(timestamp: string): string {
  const date = toDate(timestamp);

  if (!date) {
    return '—';
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

export function formatUiDateTime(timestamp: string | null): string {
  if (!timestamp) {
    return '—';
  }

  const date = toDate(timestamp);

  if (!date) {
    return '—';
  }

  return new Intl.DateTimeFormat(undefined, {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

export { EXCHANGES };