import type pino from 'pino';
import type { AppConfig } from '../config/env';
import type { ExchangeAdapter, ExchangeName } from '../core/types';
import { BybitAdapter } from './bybit.adapter';
import { BitgetAdapter } from './bitget.adapter';
import { StonfiAdapter } from './stonfi.adapter';
import { DedustAdapter } from './dedust.adapter';
import { DedustRuntime } from '../services/dedust-runtime.service';

export function createExchangeAdapters(config: AppConfig, logger: pino.Logger): ExchangeAdapter[] {
  const all: Record<ExchangeName, ExchangeAdapter> = {
    bybit: new BybitAdapter(logger),
    bitget: new BitgetAdapter(logger),
    stonfi: new StonfiAdapter(logger),
    dedust: new DedustAdapter(logger, new DedustRuntime()),
  };

  const adapters = config.enabledExchanges
    .map((name) => all[name as ExchangeName])
    .filter(Boolean);

  if (adapters.length === 0) {
    throw new Error('No exchange adapters enabled');
  }

  return adapters;
}
