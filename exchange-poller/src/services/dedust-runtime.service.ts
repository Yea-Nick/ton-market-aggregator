import { Factory, MAINNET_FACTORY_ADDR } from '@dedust/sdk';
import { TonClient4 } from '@ton/ton';
import type { OpenedContract } from '@ton/core';
import { env } from '../config/env';

export class DedustRuntime {
    readonly tonClient: TonClient4;
    readonly factory: OpenedContract<Factory>;

    constructor(endpoint = env.ton.apiUrl ?? 'https://mainnet-v4.tonhubapi.com') {
        this.tonClient = new TonClient4({ endpoint });

        this.factory = this.tonClient.open(
            Factory.createFromAddress(MAINNET_FACTORY_ADDR),
        );
    }

    async withTimeout<T>(promise: Promise<T>, timeoutMs = env.resilience.requestTimeoutMs): Promise<T> {
        return Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                const timer = setTimeout(() => {
                    reject(new Error(`DeDust runtime timed out after ${timeoutMs}ms`));
                }, timeoutMs);

                timer.unref?.();
            }),
        ]);
    }
}