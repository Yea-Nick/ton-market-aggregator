import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'price_ticks' })
@Index('idx_price_ticks_symbol_exchange_ts', ['symbol', 'exchange', 'sourceTimestamp'])
@Index('idx_price_ticks_symbol_ts', ['symbol', 'sourceTimestamp'])
export class PriceTickEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'text', unique: true, name: 'event_id' })
  eventId!: string;

  @Column({ type: 'varchar', length: 50 })
  exchange!: string;

  @Column({ type: 'varchar', length: 20 })
  symbol!: string;

  @Column({
    type: 'numeric', precision: 20, scale: 10, transformer: {
      to: (value: number | string) => value,
      from: (value: string) => Number(value),
    }
  })
  price!: number;

  @Column({ type: 'timestamptz', name: 'source_timestamp' })
  sourceTimestamp!: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
