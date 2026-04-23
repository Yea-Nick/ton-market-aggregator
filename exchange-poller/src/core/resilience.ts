import { buildDeterministicHealthEventId } from './event-id';
import type pino from 'pino';
import type {
    AdapterExecutionResult,
    BreakerState,
    ExchangeAdapter,
    ExchangeName,
    FetchedPrice,
    HealthEvent,
    ResilienceConfig,
    ResilienceError,
} from './types';

interface ResilientAdapterParams {
    adapter: ExchangeAdapter;
    symbol: string;
    logger: pino.Logger;
    config: ResilienceConfig;
}

interface SourceState {
    breakerState: BreakerState;
    consecutiveFailures: number;
    openedUntilTs: number | null;
    lastSourceTimestamp: string | null;
    lastPrice: string | null;
    samePayloadCount: number;
    staleActive: boolean;
    duplicateSuppressions: number;
    lastStaleHealthAtTs: number | null;
    lastDuplicateHealthAtTs: number | null;
}

export class ResilientAdapter {
    readonly name: ExchangeName;

    private readonly adapter: ExchangeAdapter;
    private readonly symbol: string;
    private readonly logger: pino.Logger;
    private readonly config: ResilienceConfig;
    private readonly state: SourceState;

    constructor(params: ResilientAdapterParams) {
        this.adapter = params.adapter;
        this.name = params.adapter.name;
        this.symbol = params.symbol;
        this.logger = params.logger;
        this.config = params.config;

        this.state = {
            breakerState: 'closed',
            consecutiveFailures: 0,
            openedUntilTs: null,
            lastSourceTimestamp: null,
            lastPrice: null,
            samePayloadCount: 0,
            staleActive: false,
            duplicateSuppressions: 0,
            lastStaleHealthAtTs: null,
            lastDuplicateHealthAtTs: null,
        };
    }

    async execute(): Promise<AdapterExecutionResult> {
        const nowTs = Date.now();
        const precheck = this.precheckBreaker(nowTs);

        if (precheck) {
            return {
                status: 'suppressed',
                reason: 'breaker_open',
                healthEvents: [precheck],
                attempts: 0,
            };
        }

        const healthEvents: HealthEvent[] = [];

        if (this.state.breakerState === 'open') {
            this.state.breakerState = 'half-open';
            healthEvents.push(
                this.makeHealthEvent('source.breaker_half_open', 'info', 'breaker cooldown elapsed', {
                    breakerState: this.state.breakerState,
                }),
            );
        }

        let attempts = 0;
        let lastError: ResilienceError | null = null;

        while (attempts <= this.config.maxRetries) {
            attempts += 1;

            try {
                const fetched = await this.adapter.fetchPrice(this.symbol);
                this.validateFetchedPrice(fetched);

                const qualityDecision = this.applyQualityGate(fetched);

                if (qualityDecision.status === 'suppressed') {
                    this.onSuccessRecovery(healthEvents, fetched);
                    healthEvents.push(...qualityDecision.healthEvents);

                    return {
                        status: 'suppressed',
                        reason: qualityDecision.reason,
                        healthEvents,
                        attempts,
                    };
                }

                this.onSuccessRecovery(healthEvents, fetched);

                return {
                    status: 'success',
                    fetched,
                    healthEvents,
                    attempts,
                };
            } catch (error) {
                const normalized = this.normalizeResilienceError(error);
                lastError = normalized;

                const shouldRetry =
                    attempts <= this.config.maxRetries && normalized.isRetryable;

                this.logger.warn(
                    {
                        exchange: this.name,
                        symbol: this.symbol,
                        attempt: attempts,
                        maxRetries: this.config.maxRetries,
                        errorKind: normalized.kind,
                        statusCode: normalized.statusCode,
                        code: normalized.code,
                        message: normalized.message,
                        retrying: shouldRetry,
                    },
                    'Adapter execution failed',
                );

                if (!shouldRetry) {
                    break;
                }

                const backoffMs = this.computeBackoffMs({
                    attempt: attempts,
                    baseMs: this.config.retryBaseBackoffMs,
                    maxMs: this.config.retryMaxBackoffMs,
                });

                await this.sleep(backoffMs);
            }
        }

        const failureHealthEvents = this.onFailure(lastError);

        return {
            status: 'failure',
            error: lastError ?? this.normalizeResilienceError(new Error('Unknown adapter error')),
            healthEvents: [...healthEvents, ...failureHealthEvents],
            attempts,
        };
    }

    private precheckBreaker(nowTs: number): HealthEvent | null {
        if (this.state.breakerState !== 'open') {
            return null;
        }

        if (this.state.openedUntilTs !== null && nowTs < this.state.openedUntilTs) {
            return this.makeHealthEvent('source.fetch_failed', 'warn', 'breaker is open; fetch suppressed', {
                breakerState: this.state.breakerState,
                openedUntil: new Date(this.state.openedUntilTs).toISOString(),
            });
        }

        return null;
    }

    private onSuccessRecovery(healthEvents: HealthEvent[], fetched: FetchedPrice): void {
        const wasOpenish = this.state.breakerState === 'half-open' || this.state.breakerState === 'open';

        this.state.consecutiveFailures = 0;
        this.state.breakerState = 'closed';
        this.state.openedUntilTs = null;

        if (wasOpenish) {
            healthEvents.push(
                this.makeHealthEvent('source.breaker_closed', 'info', 'breaker closed after successful probe', {
                    sourceTimestamp: fetched.sourceTimestamp,
                    price: fetched.price,
                }),
            );
        }

        if (this.state.staleActive) {
            this.state.staleActive = false;
            healthEvents.push(
                this.makeHealthEvent('source.recovered', 'info', 'source timestamp recovered', {
                    sourceTimestamp: fetched.sourceTimestamp,
                    price: fetched.price,
                }),
            );
        }
    }

    private onFailure(error: ResilienceError | null): HealthEvent[] {
        this.state.consecutiveFailures += 1;

        const healthEvents: HealthEvent[] = [
            this.makeHealthEvent(
                'source.fetch_failed',
                error?.kind === 'http_403' ? 'error' : 'warn',
                error?.message ?? 'adapter execution failed',
                {
                    consecutiveFailures: this.state.consecutiveFailures,
                    errorKind: error?.kind,
                    statusCode: error?.statusCode,
                    code: error?.code,
                },
            ),
        ];

        const shouldOpenBreaker =
            this.state.consecutiveFailures >= this.config.breakerFailureThreshold &&
            (error?.isBreakerWorthy ?? true);

        const shouldOpenOn403 = error?.kind === 'http_403' && this.state.consecutiveFailures >= 2;

        if (shouldOpenBreaker || shouldOpenOn403) {
            const openMs =
                error?.kind === 'http_403'
                    ? this.config.breakerOpenMs403
                    : this.config.breakerOpenMs;

            this.state.breakerState = 'open';
            this.state.openedUntilTs = Date.now() + openMs;

            healthEvents.push(
                this.makeHealthEvent(
                    'source.breaker_opened',
                    error?.kind === 'http_403' ? 'error' : 'warn',
                    'breaker opened after repeated source failures',
                    {
                        consecutiveFailures: this.state.consecutiveFailures,
                        openMs,
                        openUntil: new Date(this.state.openedUntilTs).toISOString(),
                        errorKind: error?.kind,
                        statusCode: error?.statusCode,
                    },
                ),
            );
        }

        return healthEvents;
    }

    private applyQualityGate(
        fetched: FetchedPrice,
    ):
        | { status: 'pass'; }
        | { status: 'suppressed'; reason: 'stale' | 'duplicate'; healthEvents: HealthEvent[]; } {
        const sameTimestamp =
            this.state.lastSourceTimestamp !== null &&
            this.state.lastSourceTimestamp === fetched.sourceTimestamp;

        const samePrice =
            this.state.lastPrice !== null &&
            this.state.lastPrice === fetched.price;

        const samePayload = sameTimestamp && samePrice;

        if (samePayload) {
            this.state.samePayloadCount += 1;
        } else {
            this.state.samePayloadCount = 1;
        }

        this.state.lastSourceTimestamp = fetched.sourceTimestamp;
        this.state.lastPrice = fetched.price;

        if (
            samePayload &&
            this.state.samePayloadCount >= this.config.staleAfterConsecutive
        ) {
            const events: HealthEvent[] = [];
            const nowTs = Date.now();

            if (
                this.state.lastStaleHealthAtTs === null ||
                nowTs - this.state.lastStaleHealthAtTs >= this.config.staleHealthCooldownMs
            ) {
                this.state.lastStaleHealthAtTs = nowTs;
                this.state.staleActive = true;
                events.push(
                    this.makeHealthEvent(
                        'source.stale_detected',
                        'warn',
                        'source keeps returning the same timestamp and price',
                        {
                            sourceTimestamp: fetched.sourceTimestamp,
                            price: fetched.price,
                            samePayloadCount: this.state.samePayloadCount,
                        },
                    ),
                );
            }

            return {
                status: 'suppressed',
                reason: 'stale',
                healthEvents: events,
            };
        }

        this.state.duplicateSuppressions = 0;

        return { status: 'pass' };
    }

    private validateFetchedPrice(fetched: FetchedPrice): void {
        if (!fetched.exchange || !fetched.symbol || !fetched.price || !fetched.sourceTimestamp) {
            throw <ResilienceError>{
                kind: 'invalid_payload',
                message: 'Fetched price payload is incomplete',
                isRetryable: false,
                isBreakerWorthy: false,
            };
        }

        if (Number.isNaN(Number(fetched.price))) {
            throw <ResilienceError>{
                kind: 'invalid_payload',
                message: 'Fetched price is not a numeric string',
                isRetryable: false,
                isBreakerWorthy: false,
                details: { price: fetched.price },
            };
        }
    }

    private makeHealthEvent(
        type: HealthEvent['type'],
        severity: HealthEvent['severity'],
        reason: string,
        metadata?: Record<string, unknown>,
    ): HealthEvent {
        const occurredAt = new Date().toISOString();

        return {
            eventId: buildDeterministicHealthEventId({
                type,
                exchange: this.name,
                symbol: this.symbol,
                severity,
                reason,
                metadata,
                occurredAt,
            }),
            type,
            exchange: this.name,
            symbol: this.symbol,
            occurredAt,
            severity,
            reason,
            metadata,
        };
    }


    private normalizeResilienceError(error: unknown): ResilienceError {
        if (this.isResilienceError(error)) {
            return error;
        }

        const err = error as {
            message?: string;
            code?: string;
            name?: string;
            response?: {
                status?: number;
                data?: unknown;
            };
            statusCode?: number;
        };

        const statusCode = err?.response?.status ?? err?.statusCode;
        const message = err?.message ?? 'Unknown error';
        const code = err?.code;

        if (code === 'ERR_CANCELED') {
            return {
                kind: 'aborted',
                message,
                code,
                isRetryable: true,
                isBreakerWorthy: false,
            };
        }

        if (code === 'ECONNABORTED' || /timeout/i.test(message)) {
            return {
                kind: 'timeout',
                message,
                code,
                isRetryable: true,
                isBreakerWorthy: true,
                statusCode,
            };
        }

        if (statusCode === 403) {
            return {
                kind: 'http_403',
                message,
                code,
                statusCode,
                isRetryable: false,
                isBreakerWorthy: true,
                details: { response: err?.response?.data },
            };
        }

        if (statusCode === 429) {
            return {
                kind: 'http_429',
                message,
                code,
                statusCode,
                isRetryable: true,
                isBreakerWorthy: true,
                details: { response: err?.response?.data },
            };
        }

        if (typeof statusCode === 'number' && statusCode >= 500) {
            return {
                kind: 'http_5xx',
                message,
                code,
                statusCode,
                isRetryable: true,
                isBreakerWorthy: true,
                details: { response: err?.response?.data },
            };
        }

        if (typeof statusCode === 'number' && statusCode >= 400) {
            return {
                kind: 'http_4xx',
                message,
                code,
                statusCode,
                isRetryable: false,
                isBreakerWorthy: false,
                details: { response: err?.response?.data },
            };
        }

        if (
            code === 'ECONNRESET' ||
            code === 'ENOTFOUND' ||
            code === 'EAI_AGAIN' ||
            code === 'ETIMEDOUT' ||
            code === 'ECONNREFUSED'
        ) {
            return {
                kind: 'network',
                message,
                code,
                isRetryable: true,
                isBreakerWorthy: true,
            };
        }

        return {
            kind: 'unknown',
            message,
            code,
            statusCode,
            isRetryable: false,
            isBreakerWorthy: true,
        };
    }

    private computeBackoffMs(params: {
        attempt: number;
        baseMs: number;
        maxMs: number;
    }): number {
        const exp = Math.max(0, params.attempt - 1);
        const raw = Math.min(params.baseMs * 2 ** exp, params.maxMs);
        const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(raw * 0.2)));

        return raw + jitter;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private isResilienceError(error: unknown): error is ResilienceError {
        if (!error || typeof error !== 'object') {
            return false;
        }

        const value = error as Partial<ResilienceError>;

        return typeof value.kind === 'string' && typeof value.message === 'string';
    }
}