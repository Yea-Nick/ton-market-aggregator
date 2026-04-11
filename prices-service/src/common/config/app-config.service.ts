import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  get port(): number {
    return this.configService.get<number>('PORT', 8080);
  }

  get corsOrigin(): string {
    return this.configService.get<string>('CORS_ORIGIN', 'http://localhost:3000');
  }

  get postgresHost(): string {
    return this.configService.get<string>('POSTGRES_HOST', 'localhost');
  }

  get postgresPort(): number {
    return this.configService.get<number>('POSTGRES_PORT', 5432);
  }

  get postgresDb(): string {
    return this.configService.get<string>('POSTGRES_DB', 'ton_prices');
  }

  get postgresUser(): string {
    return this.configService.get<string>('POSTGRES_USER', 'postgres');
  }

  get postgresPassword(): string {
    return this.configService.get<string>('POSTGRES_PASSWORD', 'postgres');
  }

  get postgresSsl(): boolean {
    return this.configService.get<string>('POSTGRES_SSL', 'false') === 'true';
  }

  get postgresLogging(): boolean {
    return this.configService.get<string>('POSTGRES_LOGGING', 'false') === 'true';
  }

  get dbSynchronize(): boolean {
    return this.configService.get<string>('DB_SYNCHRONIZE', 'false') === 'true';
  }

  get kafkaBrokers(): string[] {
    return this.configService
      .get<string>('KAFKA_BROKERS', 'localhost:9092')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  get kafkaClientId(): string {
    return this.configService.get<string>('KAFKA_CLIENT_ID', 'prices-service');
  }

  get kafkaGroupId(): string {
    return this.configService.get<string>('KAFKA_GROUP_ID', 'prices-service-consumer');
  }

  get kafkaTopic(): string {
    return this.configService.get<string>('KAFKA_TOPIC', 'ton.prices.raw');
  }

  get kafkaFromBeginning(): boolean {
    return this.configService.get<string>('KAFKA_FROM_BEGINNING', 'false') === 'true';
  }

  get kafkaSsl(): boolean {
    return this.configService.get<string>('KAFKA_SSL', 'false') === 'true';
  }

  get kafkaAllowAutoTopicCreation(): boolean {
    return this.configService.get<string>('KAFKA_ALLOW_AUTO_TOPIC_CREATION', 'true') === 'true';
  }

  get wsPath(): string {
    return this.configService.get<string>('WS_PATH', '/ws/prices');
  }

  get wsHeartbeatMs(): number {
    return this.configService.get<number>('WS_HEARTBEAT_MS', 30000);
  }
}
