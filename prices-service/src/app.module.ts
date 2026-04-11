import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigService } from './common/config/app-config.service';
import { ConsumerInboxEntity } from './database/entities/consumer-inbox.entity';
import { PriceTickEntity } from './database/entities/price-tick.entity';
import { HealthModule } from './modules/health/health.module';
import { PricesModule } from './modules/prices/prices.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
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
  providers: [AppConfigService],
})
export class AppModule {}
