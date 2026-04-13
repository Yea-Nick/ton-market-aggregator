import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from './common/config/app-config.module';
import { AppConfigService } from './common/config/app-config.service';
import { ConsumerInboxEntity } from './database/entities/consumer-inbox.entity';
import { PriceTickEntity } from './database/entities/price-tick.entity';
import { HealthModule } from './modules/health/health.module';
import { PricesModule } from './modules/prices/prices.module';

@Module({
  imports: [
    AppConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        type: 'postgres',
        host: config.postgresHost,
        port: config.postgresPort,
        username: config.postgresUser,
        password: config.postgresPassword,
        database: config.postgresDb,
        ssl: config.postgresSsl ? { rejectUnauthorized: false } : false,
        logging: config.postgresLogging,
        synchronize: config.dbSynchronize,
        autoLoadEntities: true,
        entities: [ConsumerInboxEntity, PriceTickEntity],
      }),
    }),
    HealthModule,
    PricesModule,
  ],
})
export class AppModule { }