import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) { }

  private getString(key: string, fallback: string): string {
    return this.configService.get<string>(key, fallback);
  }

  private getNumber(key: string, fallback: number): number {
    const value = this.configService.get<string>(key);
    if (value === undefined) return fallback;

    const parsed = Number(value);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  private getBoolean(key: string, fallback: boolean): boolean {
    const value = this.configService.get<string>(key);
    if (value === undefined) return fallback;
    return value === 'true';
  }

  get nodeEnv(): NodeEnv {
    return this.configService.get<NodeEnv>('NODE_ENV', NodeEnv.Development);
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === NodeEnv.Development;
  }

  get isProduction(): boolean {
    return this.nodeEnv === NodeEnv.Production;
  }

  get port(): number {
    return this.getNumber('PORT', 4000);
  }

  get postgresHost(): string {
    return this.getString('POSTGRES_HOST', 'localhost');
  }

  get postgresPort(): number {
    return this.getNumber('POSTGRES_PORT', 5432);
  }

  get postgresDb(): string {
    return this.getString('POSTGRES_DB', 'ton_prices');
  }

  get postgresUser(): string {
    return this.getString('POSTGRES_USER', 'postgres');
  }

  get postgresPassword(): string {
    return this.getString('POSTGRES_PASSWORD', 'postgres');
  }

  get postgresSsl(): boolean {
    return this.getBoolean('POSTGRES_SSL', false);
  }

  get postgresLogging(): boolean {
    return this.getBoolean('POSTGRES_LOGGING', false);
  }

  get dbSynchronize(): boolean {
    return this.getBoolean('DB_SYNCHRONIZE', false);
  }

  get kafkaBrokers(): string[] {
    return this.getString('KAFKA_BROKERS', 'localhost:9092')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  get kafkaClientId(): string {
    return this.getString('KAFKA_CLIENT_ID', 'prices-service');
  }

  get kafkaGroupId(): string {
    return this.getString('KAFKA_GROUP_ID', 'prices-service-consumer');
  }

  get kafkaTopic(): string {
    return this.getString('KAFKA_TOPIC', 'ton.prices.raw');
  }

  get kafkaFromBeginning(): boolean {
    return this.getBoolean('KAFKA_FROM_BEGINNING', false);
  }

  get kafkaSsl(): boolean {
    return this.getBoolean('KAFKA_SSL', false);
  }

  get kafkaAllowAutoTopicCreation(): boolean {
    return this.getBoolean('KAFKA_ALLOW_AUTO_TOPIC_CREATION', true);
  }

  get wsPath(): string {
    return this.getString('WS_PATH', '/ws/prices');
  }

  get wsHeartbeatMs(): number {
    return this.getNumber('WS_HEARTBEAT_MS', 30000);
  }
}