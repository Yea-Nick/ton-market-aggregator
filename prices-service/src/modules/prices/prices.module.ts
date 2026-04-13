import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsumerInboxEntity } from '../../database/entities/consumer-inbox.entity';
import { PriceTickEntity } from '../../database/entities/price-tick.entity';
import { PricesController } from './controllers/prices.controller';
import { KafkaConsumerService } from './services/kafka-consumer.service';
import { PricesIngestService } from './services/prices-ingest.service';
import { PricesQueryService } from './services/prices-query.service';
import { PriceStreamService } from './services/price-stream.service';
import { PricesGateway } from './ws/prices.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([ConsumerInboxEntity, PriceTickEntity])],
  controllers: [PricesController],
  providers: [
    PricesQueryService,
    PricesIngestService,
    KafkaConsumerService,
    PriceStreamService,
    PricesGateway,
  ],
})
export class PricesModule { }
