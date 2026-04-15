'use client';

import { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatAxisTime, formatTooltipTime } from '@/lib/chart';
import { ChartRow, Exchange, TimeRange } from '@/lib/types';

interface PriceChartProps {
  rows: ChartRow[];
  exchanges: Exchange[];
  range: TimeRange;
}

const EXCHANGE_COLORS: Record<Exchange, string> = {
  bybit: '#f59e0b',
  bitget: '#3b82f6',
  stonfi: '#10b981',
  dedust: '#a855f7',
};

const EXCHANGE_LABELS: Record<Exchange, string> = {
  bybit: 'Bybit',
  bitget: 'Bitget',
  stonfi: 'STON.fi',
  dedust: 'DeDust',
};

export function PriceChart({ rows, exchanges, range }: PriceChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="chart-shell">
      <ResponsiveContainer width="100%" height={420}>
        <LineChart data={rows}>
          <CartesianGrid stroke="#24262b" strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(value: string) =>
              mounted ? formatAxisTime(value, range) : ''
            }
            minTickGap={40}
            stroke="#7f848e"
            tickLine={false}
            axisLine={{ stroke: '#2a2a2e' }}
          />
          <YAxis
            domain={['auto', 'auto']}
            tickFormatter={(value: number) => value.toFixed(2)}
            stroke="#7f848e"
            width={72}
            tickLine={false}
            axisLine={{ stroke: '#2a2a2e' }}
          />
          <Tooltip
            labelFormatter={(value: string) =>
              mounted ? formatTooltipTime(value) : ''
            }
            formatter={(value, name) => {
              const formattedValue =
                typeof value === 'number'
                  ? value.toFixed(4)
                  : value == null
                    ? ''
                    : String(value);

              return [formattedValue, EXCHANGE_LABELS[String(name) as Exchange] ?? String(name)];
            }}
            contentStyle={{
              background: '#15161a',
              border: '1px solid #2a2a2e',
              borderRadius: 0,
              color: '#e6e6e6',
            }}
            itemStyle={{ color: '#e6e6e6' }}
            labelStyle={{ color: '#9aa0aa' }}
          />
          <Legend />

          {exchanges.map((exchange) => (
            <Line
              key={exchange}
              type="monotone"
              dataKey={exchange}
              name={exchange}
              connectNulls
              dot={false}
              stroke={EXCHANGE_COLORS[exchange]}
              strokeWidth={2}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}