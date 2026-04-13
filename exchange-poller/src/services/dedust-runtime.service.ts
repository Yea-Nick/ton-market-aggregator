import { Factory, MAINNET_FACTORY_ADDR } from '@dedust/sdk';
import { TonClient4 } from '@ton/ton';
import type { OpenedContract } from '@ton/core';

export class DedustRuntime {
    readonly tonClient: TonClient4;
    readonly factory: OpenedContract<Factory>;

    constructor(endpoint = 'https://mainnet-v4.tonhubapi.com') {
        this.tonClient = new TonClient4({ endpoint });

        this.factory = this.tonClient.open(
            Factory.createFromAddress(MAINNET_FACTORY_ADDR),
        );
    }
}