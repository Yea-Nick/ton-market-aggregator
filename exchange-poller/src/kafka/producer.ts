import { Kafka, Producer, CompressionTypes } from 'kafkajs';
import { env } from '../config/env';
import type { HealthEvent, PriceEvent } from '../core/types';

export interface KafkaEventPublisher {
  connect(): Promise<void>;
  publishPriceEvents(events: PriceEvent[]): Promise<void>;
  publishHealthEvents(events: HealthEvent[]): Promise<void>;
  disconnect(): Promise<void>;
}

interface KafkaProducerServiceParams {
  clientId: string;
  brokers: string[];
  priceTopic: string;
  healthTopic: string;
}

class KafkaProducerService implements KafkaEventPublisher {
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  private readonly clientId: string;
  private readonly priceTopic: string;
  private readonly healthTopic: string;

  constructor(params: KafkaProducerServiceParams) {
    this.clientId = params.clientId;
    this.priceTopic = params.priceTopic;
    this.healthTopic = params.healthTopic;

    this.kafka = new Kafka({
      clientId: params.clientId,
      brokers: params.brokers,
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: false,
      transactionTimeout: 30 * 1000,
    });
  }

  async connect(): Promise<void> {
    await this.producer.connect();
  }

  async publishPriceEvents(events: PriceEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    await this.producer.send({
      topic: this.priceTopic,
      compression: CompressionTypes.GZIP,
      messages: events.map((event) => ({
        key: `${event.symbol}:${event.exchange}`,
        value: JSON.stringify(event),
        headers: {
          eventId: event.eventId,
          eventType: 'price.received',
          schemaVersion: '1',
          producer: this.clientId,
        },
      })),
    });
  }

  async publishHealthEvents(events: HealthEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    await this.producer.send({
      topic: this.healthTopic,
      compression: CompressionTypes.GZIP,
      messages: events.map((event) => ({
        key: `${event.symbol}:${event.exchange}:${event.type}`,
        value: JSON.stringify(event),
        headers: {
          eventId: event.eventId,
          eventType: event.type,
          schemaVersion: '1',
          producer: this.clientId,
          severity: event.severity,
        },
      })),
    });
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
  }
}

export function createKafkaProducer(): KafkaEventPublisher {
  return new KafkaProducerService({
    clientId: env.kafka.clientId,
    brokers: env.kafka.brokers,
    priceTopic: env.kafka.topic,
    healthTopic: env.kafka.healthTopic,
  });
}