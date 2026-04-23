import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
} from 'typeorm';

@Entity({ name: 'consumer_inbox' })
export class ConsumerInboxEntity {
  @PrimaryColumn({ type: 'text', name: 'event_id' })
  eventId!: string;

  @Column({ type: 'varchar', length: 255 })
  topic!: string;

  @Column({ type: 'int' })
  partition!: number;

  @Column({ type: 'bigint', name: 'partition_offset' })
  partitionOffset!: string;

  @Column({ type: 'varchar', length: 50 })
  exchange!: string;

  @Column({ type: 'varchar', length: 20 })
  symbol!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'received_at' })
  receivedAt!: Date;
}
