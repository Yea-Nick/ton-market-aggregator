import {
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppConfigService } from '../../../common/config/app-config.service';

@Injectable()
export class PricesRetentionService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PricesRetentionService.name);
    private timer?: NodeJS.Timeout;
    private isRunning = false;

    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly config: AppConfigService,
    ) { }

    onModuleInit(): void {
        void this.runRetention();

        this.timer = setInterval(() => {
            void this.runRetention();
        }, this.config.retentionRunIntervalMs);

        this.timer.unref?.();
    }

    onModuleDestroy(): void {
        if (this.timer) {
            clearInterval(this.timer);
        }
    }

    private async runRetention(): Promise<void> {
        if (this.isRunning) {
            this.logger.warn('Retention skipped: previous run is still active');
            return;
        }

        this.isRunning = true;

        try {
            const deletedPriceTicks = await this.deleteOldPriceTicks();
            const deletedConsumerInbox = await this.deleteOldConsumerInbox();

            this.logger.log(
                `Retention completed: deletedPriceTicks=${deletedPriceTicks}, deletedConsumerInbox=${deletedConsumerInbox}`,
            );
        } catch (error) {
            this.logger.error(
                `Retention failed: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error.stack : undefined,
            );
        } finally {
            this.isRunning = false;
        }
    }

    private async deleteOldPriceTicks(): Promise<number> {
        const result: Array<{ deleted_count: string; }> = await this.dataSource.query(
            `
            with latest_ticks as (
                select distinct on (symbol, exchange) id
                from price_ticks
                order by symbol, exchange, source_timestamp desc, id desc
            ),
            deleted as (
                delete from price_ticks pt
                where pt.source_timestamp < now() - ($1::int * interval '1 hour')
                and not exists (
                    select 1
                    from latest_ticks lt
                    where lt.id = pt.id
                )
                returning 1
            )
            select count(*)::text as deleted_count
            from deleted
      `,
            [this.config.priceTicksRetentionHours],
        );

        return Number(result[0]?.deleted_count ?? 0);
    }

    private async deleteOldConsumerInbox(): Promise<number> {
        const result: Array<{ deleted_count: string; }> = await this.dataSource.query(
            `
            with deleted as (
                delete from consumer_inbox
                where received_at < now() - ($1::int * interval '1 hour')
                returning 1
            )
            select count(*)::text as deleted_count
            from deleted
      `,
            [this.config.consumerInboxRetentionHours],
        );

        return Number(result[0]?.deleted_count ?? 0);
    }
}