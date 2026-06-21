import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../../../entities/base.entity';
import { InboundReceipt } from '../../entities/inbound-receipt.entity';
import { StockInOrderDetail } from './stock-in-order-detail.entity';

@Entity('stock_in_orders')
export class StockInOrder extends BaseEntity {
  @Column({ unique: true })
  orderCode: string;

  @ManyToOne(() => InboundReceipt, { nullable: true, onDelete: 'SET NULL' })
  sourcePurchaseOrder?: InboundReceipt;

  @Column({ nullable: true })
  sourcePurchaseOrderNo?: string;

  @Column({ default: 'DRAFT' })
  status: 'DRAFT' | 'IN_PROGRESS' | 'READY' | 'COMPLETED' | 'CANCELLED';

  @Column({ nullable: true })
  currentStepUserId?: string;

  @Column({ nullable: true })
  currentStepUserEmail?: string;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @Column({ type: 'datetime', nullable: true })
  completedAt?: Date;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;

  @OneToMany(() => StockInOrderDetail, (detail) => detail.stockInOrder)
  details: StockInOrderDetail[];
}
