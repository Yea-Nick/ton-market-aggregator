import { createHash } from 'crypto';
import type { FetchedPrice, HealthEvent } from './types';

export function buildDeterministicEventId(
    payload: Pick<
        FetchedPrice,
        'exchange' | 'symbol' | 'sourceTimestamp' | 'price'
    >,
): string {
    const raw = [
        'price.received',
        payload.exchange,
        payload.symbol,
        payload.sourceTimestamp,
        normalizePrice(payload.price),
    ].join('|');

    return sha256(raw);
}

export function buildDeterministicHealthEventId(
    event: Omit<HealthEvent, 'eventId' | 'occurredAt'> & {
        occurredAt?: string;
    },
): string {
    const fingerprint = buildHealthFingerprint(event);

    return sha256(fingerprint);
}

function buildHealthFingerprint(
    event: Omit<HealthEvent, 'eventId' | 'occurredAt'> & {
        occurredAt?: string;
    },
): string {
    const minuteBucket = toMinuteBucket(event.occurredAt);

    switch (event.type) {
        case 'source.fetch_failed':
            return [
                event.type,
                event.exchange,
                event.symbol,
                event.metadata?.errorKind ?? '',
                event.metadata?.statusCode ?? '',
                minuteBucket,
            ].join('|');

        case 'source.breaker_opened':
            return [
                event.type,
                event.exchange,
                event.symbol,
                event.metadata?.errorKind ?? '',
                event.metadata?.statusCode ?? '',
                event.metadata?.openUntil ?? '',
            ].join('|');

        case 'source.breaker_half_open':
        case 'source.breaker_closed':
        case 'source.recovered':
            return [
                event.type,
                event.exchange,
                event.symbol,
                minuteBucket,
            ].join('|');

        case 'source.stale_detected':
            return [
                event.type,
                event.exchange,
                event.symbol,
                event.metadata?.sourceTimestamp ?? '',
                normalizeMaybePrice(event.metadata?.price),
            ].join('|');

        default:
            return [
                event.type,
                event.exchange,
                event.symbol,
                minuteBucket,
            ].join('|');
    }
}

function toMinuteBucket(value?: string): string {
    if (!value) {
        return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    date.setSeconds(0, 0);

    return date.toISOString();
}

function normalizePrice(value: string): string {
    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {
        return value.trim();
    }

    return numeric.toString();
}

function normalizeMaybePrice(value: unknown): string {
    if (typeof value !== 'string') {
        return '';
    }

    return normalizePrice(value);
}

function sha256(raw: string): string {
    return createHash('sha256')
        .update(raw)
        .digest('hex');
}