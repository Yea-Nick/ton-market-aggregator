'use client';

import { Exchange, EXCHANGES, TimeRange, TIME_RANGES } from '@/lib/types';

interface ControlBarProps {
  range: TimeRange;
  exchanges: Exchange[];
  onRangeChange: (value: TimeRange) => void;
  onExchangeToggle: (value: Exchange) => void;
}

export function ControlBar({ range, exchanges, onRangeChange, onExchangeToggle }: ControlBarProps) {
  return (
    <div className="control-panel card">
      <div className="control-group">
        <span className="control-title">Диапазон</span>
        <div className="button-group">
          {TIME_RANGES.map((item) => (
            <button
              key={item}
              className={item === range ? 'chip chip-active' : 'chip'}
              onClick={() => onRangeChange(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="control-group">
        <span className="control-title">Биржи</span>
        <div className="checkbox-grid">
          {EXCHANGES.map((exchange) => {
            const checked = exchanges.includes(exchange);
            return (
              <label key={exchange} className={checked ? 'checkbox-item checkbox-item-active' : 'checkbox-item'}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onExchangeToggle(exchange)}
                />
                <span>{formatExchangeLabel(exchange)}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatExchangeLabel(exchange: Exchange): string {
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
