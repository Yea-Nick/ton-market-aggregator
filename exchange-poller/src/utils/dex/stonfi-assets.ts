import { pTON } from '@ston-fi/sdk';

export const STONFI_PTON_V1 = new pTON.v1();

export const STONFI_USDT = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';

export const STONFI_NATIVE_TON = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';

export interface StonfiPairConfig {
    symbol: string;
    token0: string;
    token1: string;
    token0Decimals: number;
    token1Decimals: number;
    priceSide: 'token0InToken1' | 'token1InToken0';
}

export const STONFI_SUPPORTED_PAIRS: Record<string, StonfiPairConfig> = {
    TONUSDT: {
        symbol: 'TONUSDT',
        token0: STONFI_PTON_V1.address.toString(),
        token1: STONFI_USDT,
        token0Decimals: 9,
        token1Decimals: 6,
        priceSide: 'token0InToken1',
    },
};

export function isStonfiTonAddress(address: string): boolean {
    return (
        address === STONFI_NATIVE_TON ||
        address === STONFI_PTON_V1.address.toString()
    );
}