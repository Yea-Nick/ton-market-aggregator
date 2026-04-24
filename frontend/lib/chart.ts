import { Exchange, EXCHANGES, PricePoint, TimeRange } from './types';

export interface ChartRow {
  timestamp: string;
  bybit: number | null;
  bitget: number | null;
  stonfi: number | null;
  dedust: number | null;
}

const CHART_STALE_AFTER_MS: Record<TimeRange, Record<Exchange, number>> = {
  '15m': {
    bybit: 10_000,
    bitget: 10_000,
    stonfi: 15_000,
    dedust: 15_000,
  },
  '1h': {
    bybit: 20_000,
    bitget: 20_000,
    stonfi: 30_000,
    dedust: 30_000,
  },
  '4h': {
    bybit: 60_000,
    bitget: 60_000,
    stonfi: 90_000,
    dedust: 90_000,
  },
  '24h': {
    bybit: 120_000,
    bitget: 120_000,
    stonfi: 180_000,
    dedust: 180_000,
  },
};

type ExchangeState = {
  price: number;
  freshnessTimestampMs: number;
};

function emptyRow(timestamp: string): ChartRow {
  return {
    timestamp,
    bybit: null,
    bitget: null,
    stonfi: null,
    dedust: null,
  };
}

function toDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toMs(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function getFreshnessTimestampMs(point: PricePoint): number | null {
  return toMs(point.sourceTimestamp) ?? toMs(point.timestamp);
}

function getChartStaleAfterMs(range: TimeRange, exchange: Exchange): number {
  return CHART_STALE_AFTER_MS[range][exchange];
}

export function toChartRows(points: PricePoint[], range: TimeRange): ChartRow[] {
  if (points.length === 0) {
    return [];
  }

  const validPoints = [...points]
    .filter((point) => toMs(point.timestamp) !== null)
    .sort(
      (left, right) =>
        new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
    );

  if (validPoints.length === 0) {
    return [];
  }

  const rowsMap = new Map<string, ChartRow>();
  const timestamps: string[] = [];

  for (const point of validPoints) {
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

    timestamps.push(point.timestamp);
  }

  timestamps.sort(
    (left, right) => new Date(left).getTime() - new Date(right).getTime(),
  );

  const lastSeen: Partial<Record<Exchange, ExchangeState>> = {};
  const rows: ChartRow[] = [];

  for (const timestamp of timestamps) {
    const rowTimestampMs = toMs(timestamp);
    if (rowTimestampMs === null) {
      continue;
    }

    const row = rowsMap.get(timestamp);
    if (!row) {
      continue;
    }

    const nextRow = emptyRow(timestamp);

    for (const exchange of EXCHANGES) {
      const explicitValue = row[exchange];

      if (typeof explicitValue === 'number') {
        const matchingPoint = validPoints
          .filter(
            (point) =>
              point.timestamp === timestamp && point.exchange === exchange,
          )
          .sort(
            (left, right) =>
              (getFreshnessTimestampMs(right) ?? -Infinity) -
              (getFreshnessTimestampMs(left) ?? -Infinity),
          )[0];

        const freshnessTimestampMs =
          (matchingPoint && getFreshnessTimestampMs(matchingPoint)) ??
          rowTimestampMs;

        lastSeen[exchange] = {
          price: explicitValue,
          freshnessTimestampMs,
        };

        nextRow[exchange] = explicitValue;
        continue;
      }

      const previous = lastSeen[exchange];
      if (!previous) {
        nextRow[exchange] = null;
        continue;
      }

      const ageMs = rowTimestampMs - previous.freshnessTimestampMs;

      nextRow[exchange] =
        ageMs <= getChartStaleAfterMs(range, exchange)
          ? previous.price
          : null;
    }

    rows.push(nextRow);
  }

  return rows;
}

export function upsertLivePoint(points: PricePoint[], point: PricePoint): PricePoint[] {
  const nextPoints = [...points];
  const existingIndex = nextPoints.findIndex(
    (item) =>
      item.timestamp === point.timestamp && item.exchange === point.exchange,
  );

  if (existingIndex >= 0) {
    const existing = nextPoints[existingIndex];
    const existingFreshnessMs = getFreshnessTimestampMs(existing) ?? -Infinity;
    const incomingFreshnessMs = getFreshnessTimestampMs(point) ?? -Infinity;

    if (incomingFreshnessMs >= existingFreshnessMs) {
      nextPoints[existingIndex] = point;
    }
  } else {
    nextPoints.push(point);
  }

  nextPoints.sort(
    (left, right) =>
      new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
  );

  return nextPoints;
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