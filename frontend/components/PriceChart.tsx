'use client';

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
import { formatChartTime } from '@/lib/chart';
import { ChartRow, Exchange } from '@/lib/types';

interface PriceChartProps {
  rows: ChartRow[];
  exchanges: Exchange[];
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

export function PriceChart({ rows, exchanges }: PriceChartProps) {
  return (
    <div className="chart-shell">
      <ResponsiveContainer width="100%" height={420}>
        <LineChart data={rows}>
          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatChartTime}
            minTickGap={40}
            stroke="#94a3b8"
          />
          <YAxis
            domain={["auto", "auto"]}
            tickFormatter={(value: number) => value.toFixed(2)}
            stroke="#94a3b8"
            width={72}
          />
          <Tooltip
            labelFormatter={(value: string) => formatChartTime(value)}
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
              background: '#020617',
              border: '1px solid #1e293b',
              borderRadius: 12,
            }}
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
