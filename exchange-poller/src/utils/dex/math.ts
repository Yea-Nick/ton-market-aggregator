export function pow10(exp: bigint): bigint {
    return 10n ** exp;
}

export function toDecimalString(
    numerator: bigint,
    denominator: bigint,
    fractionDigits = 9,
): string {
    if (denominator <= 0n) {
        throw new Error('Division by zero');
    }

    const scale = 10n ** BigInt(fractionDigits);
    const scaled = (numerator * scale) / denominator;

    const integerPart = scaled / scale;
    const fractionalPart = scaled % scale;
    const fractional = fractionalPart
        .toString()
        .padStart(fractionDigits, '0')
        .replace(/0+$/, '');

    return fractional.length > 0
        ? `${integerPart.toString()}.${fractional}`
        : integerPart.toString();
}

export function calculateTonUsdtPrice(
    tonReserve: bigint,
    usdtReserve: bigint,
): string {
    const tonDecimals = 9n;
    const usdtDecimals = 6n;

    return toDecimalString(
        usdtReserve * pow10(tonDecimals),
        tonReserve * pow10(usdtDecimals),
        9,
    );
}

export function priceFromReserves(
    baseReserve: bigint,
    quoteReserve: bigint,
    baseDecimals: number,
    quoteDecimals: number,
): string {
    return toDecimalString(
        quoteReserve * pow10(BigInt(baseDecimals)),
        baseReserve * pow10(BigInt(quoteDecimals)),
        9,
    );
}

export function roundPriceString(value: string, digits = 3): string {
    const num = Number(value);

    if (!Number.isFinite(num)) {
        throw new Error(`Invalid price value: ${value}`);
    }

    return num.toFixed(digits);
}