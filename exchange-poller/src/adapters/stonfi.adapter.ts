import { env } from '../config/env';
import { http } from '../utils/http';
import type { ExchangeAdapter, FetchedPrice } from '../core/types';
import {
  STONFI_SUPPORTED_PAIRS,
  STONFI_USDT,
  isStonfiTonAddress,
} from '../utils/dex/stonfi-assets';
import { priceFromReserves, roundPriceString } from '../utils/dex/math';

function nowIso(): string {
  return new Date().toISOString();
}

interface StonfiPool {
  address?: string;
  router_address?: string;
  reserve0?: string;
  reserve1?: string;
  token0_address?: string;
  token1_address?: string;
}

interface StonfiPoolsByMarketResponse {
  pool_list?: StonfiPool[];
}

export class StonfiAdapter implements ExchangeAdapter {
  readonly name = 'stonfi' as const;
  private readonly baseUrl = env.exchanges.stonfi.baseUrl;

  async fetchPrice(symbol: string): Promise<FetchedPrice> {
    const normalizedSymbol = symbol.toUpperCase();
    const pair = STONFI_SUPPORTED_PAIRS[normalizedSymbol];

    if (!pair) {
      throw new Error(`StonfiAdapter does not support symbol: ${symbol}`);
    }

    const endpoint =
      `/v1/pools/by_market/${encodeURIComponent(pair.token0)}/${encodeURIComponent(pair.token1)}`;

    const response = await http.getJson<StonfiPoolsByMarketResponse>({
      baseURL: this.baseUrl,
      url: endpoint,
      headers: {
        Accept: 'application/json',
      },
    });

    const pool = response.pool_list?.[0];

    if (
      !pool ||
      !pool.reserve0 ||
      !pool.reserve1 ||
      !pool.token0_address ||
      !pool.token1_address
    ) {
      throw new Error('STON.fi pool response is incomplete');
    }

    const reserve0 = BigInt(pool.reserve0);
    const reserve1 = BigInt(pool.reserve1);

    if (reserve0 <= 0n || reserve1 <= 0n) {
      throw new Error('STON.fi pool has empty reserves');
    }

    const isValidPool =
      (pool.token0_address === STONFI_USDT && isStonfiTonAddress(pool.token1_address)) ||
      (pool.token1_address === STONFI_USDT && isStonfiTonAddress(pool.token0_address));

    if (!isValidPool) {
      throw new Error('STON.fi pool token mismatch');
    }

    let rawPrice: string;

    if (pool.token0_address === STONFI_USDT) {
      // token0 = USDT, token1 = TON
      rawPrice = priceFromReserves(reserve1, reserve0, 9, 6);
    } else {
      // token0 = TON, token1 = USDT
      rawPrice = priceFromReserves(reserve0, reserve1, 9, 6);
    }

    const fetchedAt = nowIso();

    return {
      exchange: this.name,
      symbol: pair.symbol,
      price: roundPriceString(rawPrice, 3),
      sourceTimestamp: fetchedAt,
      fetchedAt,
      source: {
        name: 'stonfi',
        endpoint: `${this.baseUrl}${endpoint}`,
      },
    };
  }
}