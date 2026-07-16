import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../../../entities/base.entity';
import { Supplier } from '../../../entities/supplier.entity';
import { StockInOrder } from '../../stock-in-orders/entities/stock-in-order.entity';
import { StockInReceiptDetail } from './stock-in-receipt-detail.entity';

@Entity('stock_in_receipts')
export class StockInReceipt extends BaseEntity {
  @Column({ unique: true })
  receiptCode: string;

  @Column({ default: 'PURCHASE_GOODS' })
  receiptType: 'PURCHASE_GOODS' | 'FINISHED_GOODS' | 'RETURNED_GOODS' | 'OTHER';

  @Column({ nullable: true })
  warehouseCode?: string;

  @ManyToOne(() => Supplier, { nullable: true, onDelete: 'SET NULL' })
  supplier?: Supplier;

  @ManyToOne(() => StockInOrder, { nullable: true, onDelete: 'SET NULL' })
  sourceStockInOrder?: StockInOrder;

  @Column({ nullable: true })
  sourceReferenceNo?: string;

  @Column({ type: 'simple-array', nullable: true })
  assignedStaffIds?: string[];

  @Column({ type: 'datetime' })
  receiptDate: Date;

  @Column({ default: 'DRAFT' })
  status: 'DRAFT' | 'ASSIGNED' | 'CHECKED' | 'POSTED';

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalAmount: string;

  @Column({ type: 'datetime', nullable: true })
  postedAt?: Date;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;

  @OneToMany(() => StockInReceiptDetail, (detail) => detail.receipt, { cascade: true })
  details: StockInReceiptDetail[];
}
