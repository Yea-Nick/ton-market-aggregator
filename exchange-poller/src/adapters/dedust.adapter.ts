import { PoolType, ReadinessStatus } from '@dedust/sdk';
import type { ExchangeAdapter, FetchedPrice } from '../core/types';
import { DedustRuntime } from '../services/dedust-runtime.service';
import { TON, USDT, extractTonUsdtReserves } from '../utils/dex/dedust-assets';
import { calculateTonUsdtPrice, roundPriceString } from '../utils/dex/math';

function nowIso(): string {
  return new Date().toISOString();
}

export class DedustAdapter implements ExchangeAdapter {
  readonly name = 'dedust' as const;

  constructor(
    private readonly runtime: DedustRuntime = new DedustRuntime(),
  ) { }

  async fetchPrice(symbol: string): Promise<FetchedPrice> {
    const normalizedSymbol = symbol.toUpperCase();

    if (normalizedSymbol !== 'TONUSDT') {
      throw new Error(`DedustAdapter supports only TONUSDT, got: ${symbol}`);
    }

    const poolContract = await this.runtime.withTimeout(
      this.runtime.factory.getPool(PoolType.VOLATILE, [TON, USDT]),
    );

    const pool = this.runtime.tonClient.open(poolContract);

    const readiness = await this.runtime.withTimeout(
      pool.getReadinessStatus(),
    );

    if (readiness !== ReadinessStatus.READY) {
      throw new Error(`DeDust pool is not ready: ${String(readiness)}`);
    }

    const [asset0, asset1] = await this.runtime.withTimeout(
      pool.getAssets(),
    );

    const [reserve0, reserve1] = await this.runtime.withTimeout(
      pool.getReserves(),
    );

    const reserves = extractTonUsdtReserves(
      asset0,
      asset1,
      reserve0,
      reserve1,
    );

    if (!reserves) {
      throw new Error('Unexpected DeDust pool composition');
    }

    const { tonReserve, usdtReserve } = reserves;

    if (tonReserve <= 0n || usdtReserve <= 0n) {
      throw new Error('DeDust pool has empty reserves');
    }

    const rawPrice = calculateTonUsdtPrice(tonReserve, usdtReserve);
    const fetchedAt = nowIso();

    return {
      exchange: this.name,
      symbol: 'TONUSDT',
      price: roundPriceString(rawPrice, 3),
      sourceTimestamp: fetchedAt,
      fetchedAt,
      source: {
        name: 'dedust',
        endpoint: pool.address.toString(),
      },
    };
  }
}