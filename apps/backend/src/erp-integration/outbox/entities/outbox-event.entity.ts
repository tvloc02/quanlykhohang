import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('outbox_events')
export class OutboxEvent {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column()
  eventType: string;

  @Column({ type: 'simple-json' })
  payload: Record<string, unknown>;

  @Index({ unique: true })
  @Column({ nullable: true })
  idempotencyKey?: string;

  @Column({ default: 'PENDING' })
  status: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'text', nullable: true })
  lastError?: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
