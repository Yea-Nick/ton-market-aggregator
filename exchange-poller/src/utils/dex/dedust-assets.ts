import { Asset } from '@dedust/sdk';
import { Address } from '@ton/core';

export const TON = Asset.native();

export const USDT = Asset.jetton(
    Address.parse('EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'),
);

export function isSameAsset(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

export function extractTonUsdtReserves(
    asset0: unknown,
    asset1: unknown,
    reserve0: bigint,
    reserve1: bigint,
): { tonReserve: bigint; usdtReserve: bigint; } | null {
    if (isSameAsset(asset0, TON) && isSameAsset(asset1, USDT)) {
        return { tonReserve: reserve0, usdtReserve: reserve1 };
    }

    if (isSameAsset(asset0, USDT) && isSameAsset(asset1, TON)) {
        return { tonReserve: reserve1, usdtReserve: reserve0 };
    }

    return null;
}