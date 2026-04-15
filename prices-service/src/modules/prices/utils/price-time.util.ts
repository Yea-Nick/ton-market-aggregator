import { SupportedRange } from '../../../common/constants/prices.constants';

export const RANGE_TO_BUCKET_SECONDS: Record<SupportedRange, number> = {
    '15m': 2,
    '1h': 10,
    '4h': 30,
    '24h': 60,
};

export function bucketTimestamp(
    value: Date | string,
    range: SupportedRange,
): string {
    const date = value instanceof Date ? value : new Date(value);
    const time = date.getTime();

    if (Number.isNaN(time)) {
        return new Date().toISOString();
    }

    const bucketMs = RANGE_TO_BUCKET_SECONDS[range] * 1000;
    const bucketed = Math.floor(time / bucketMs) * bucketMs;

    return new Date(bucketed).toISOString();
}