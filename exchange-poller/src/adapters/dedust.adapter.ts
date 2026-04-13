import type pino from 'pino';
import { PoolType, ReadinessStatus } from '@dedust/sdk';
import type { ExchangeAdapter, FetchedPrice } from '../core/types';
import { nowIso } from '../utils/time';
import { DedustRuntime } from '../services/dedust-runtime.service';
import { TON, USDT, extractTonUsdtReserves } from '../utils/dex/dedust-assets';
import { calculateTonUsdtPrice, roundPriceString } from '../utils/dex/math';

export class DedustAdapter implements ExchangeAdapter {
  readonly name = 'dedust' as const;
  private readonly logger: pino.Logger;

  constructor(
    logger: pino.Logger,
    private readonly runtime: DedustRuntime,
  ) {
    this.logger = logger.child({ exchange: this.name });
  }

  async fetchPrice(symbol: string): Promise<FetchedPrice> {
    const normalizedSymbol = symbol.toUpperCase();

    if (normalizedSymbol !== 'TONUSDT') {
      throw new Error(`DedustAdapter supports only TONUSDT, got: ${symbol}`);
    }

    const pool = this.runtime.tonClient.open(
      await this.runtime.factory.getPool(PoolType.VOLATILE, [TON, USDT]),
    );

    const readiness = await pool.getReadinessStatus();
    if (readiness !== ReadinessStatus.READY) {
      this.logger.warn({ readiness }, 'DeDust TON/USDT pool is not ready');
      throw new Error(`DeDust pool is not ready: ${String(readiness)}`);
    }

    const [asset0, asset1] = await pool.getAssets();
    const [reserve0, reserve1] = await pool.getReserves();

    const reserves = extractTonUsdtReserves(
      asset0,
      asset1,
      reserve0,
      reserve1,
    );

    if (!reserves) {
      this.logger.warn(
        {
          asset0,
          asset1,
          poolAddress: pool.address.toString(),
        },
        'Unexpected DeDust pool composition',
      );
      throw new Error('Unexpected DeDust pool composition');
    }

    const { tonReserve, usdtReserve } = reserves;

    if (tonReserve <= 0n || usdtReserve <= 0n) {
      this.logger.warn(
        {
          tonReserve: tonReserve.toString(),
          usdtReserve: usdtReserve.toString(),
          poolAddress: pool.address.toString(),
        },
        'Empty DeDust pool reserves',
      );
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