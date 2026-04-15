'use client';

import { Exchange, EXCHANGES, TimeRange, TIME_RANGES } from '@/lib/types';

interface ControlBarProps {
  range: TimeRange;
  exchanges: Exchange[];
  onRangeChange: (value: TimeRange) => void;
  onExchangeToggle: (value: Exchange) => void;
}

const EXCHANGE_LABELS: Record<Exchange, string> = {
  bybit: 'Bybit',
  bitget: 'Bitget',
  stonfi: 'STON.fi',
  dedust: 'DeDust',
};

export function ControlBar({
  range,
  exchanges,
  onRangeChange,
  onExchangeToggle,
}: ControlBarProps) {
  return (
    <section className="terminal-toolbar card">
      <div className="toolbar-block">
        <div className="toolbar-label">Range</div>
        <div className="toolbar-chips">
          {TIME_RANGES.map((item) => {
            const active = item === range;

            return (
              <button
                key={item}
                type="button"
                onClick={() => onRangeChange(item)}
                className={active ? 'toolbar-chip toolbar-chip-active' : 'toolbar-chip'}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-block toolbar-block-grow">
        <div className="toolbar-label">Exchanges</div>
        <div className="toolbar-chips">
          {EXCHANGES.map((exchange) => {
            const active = exchanges.includes(exchange);

            return (
              <button
                key={exchange}
                type="button"
                onClick={() => onExchangeToggle(exchange)}
                className={active ? 'toolbar-chip toolbar-chip-active' : 'toolbar-chip'}
                aria-pressed={active}
              >
                {EXCHANGE_LABELS[exchange]}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}