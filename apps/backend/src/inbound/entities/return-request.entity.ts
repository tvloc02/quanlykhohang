import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../../entities/base.entity';
import { Customer } from '../../entities/customer.entity';
import { ReturnRequestDetail } from './return-request-detail.entity';

@Entity('return_requests')
export class ReturnRequest extends BaseEntity {
  @Column({ unique: true })
  requestNumber: string;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
  customer?: Customer;

  @Column({ type: 'datetime', nullable: true })
  requestDate?: Date;

  @Column({ type: 'datetime', nullable: true })
  expectedDate?: Date;

  @Column({ default: 'CREATED' })
  status: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalAmount: string;

  @Column({ nullable: true })
  creatorName?: string;

  @Column({ nullable: true })
  creatorPhone?: string;

  @Column({ nullable: true })
  warehouseCode?: string;

  @Column({ nullable: true })
  approverId?: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;

  @OneToMany(() => ReturnRequestDetail, (detail) => detail.returnRequest, { cascade: true })
  details: ReturnRequestDetail[];
}
