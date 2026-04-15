import { Kafka, logLevel, type Producer, type Message } from 'kafkajs';
import type pino from 'pino';

interface ProducerParams {
  clientId: string;
  brokers: string[];
  logger: pino.Logger;
}

export interface KafkaProducer {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(params: {
    topic: string;
    key: string;
    value: string;
    headers?: Record<string, string>;
  }): Promise<void>;
}

export function createKafkaProducer(params: ProducerParams): KafkaProducer {
  const kafka = new Kafka({
    clientId: params.clientId,
    brokers: params.brokers,
    logLevel: logLevel.NOTHING,
  });

  const producer: Producer = kafka.producer();

  return {
    async connect() {
      await producer.connect();
      params.logger.info({ brokers: params.brokers, clientId: params.clientId }, 'Kafka producer connected');
    },

    async disconnect() {
      await producer.disconnect();
      params.logger.info('Kafka producer disconnected');
    },

    async send({ topic, key, value, headers }) {
      const message: Message = {
        key,
        value,
        headers,
      };

      await producer.send({
        topic,
        messages: [message],
        acks: -1  //Explicitly all
      });
    },
  };
}
