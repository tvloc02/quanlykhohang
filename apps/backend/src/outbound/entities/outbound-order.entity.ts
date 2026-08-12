import { Column, Entity, ManyToOne, OneToMany, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../../entities/base.entity';
import { Customer } from '../../entities/customer.entity';
import { OutboundDetail } from './outbound-detail.entity';
import { ShippingNote } from './shipping-note.entity';

@Entity('outbound_orders')
export class OutboundOrder extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 50, nullable: true })
  orderNo?: string;

  @Column({ length: 50, default: '4445' })
  branchCode: string;

  @Column({ length: 100, nullable: true })
  employeeName?: string;

  @Column({ length: 100, nullable: true })
  receiver?: string;

  @ManyToOne(() => Customer, { nullable: true })
  customer?: Customer;

  @Column({ length: 255, nullable: true })
  customerName?: string;

  @Column({ length: 50, nullable: true })
  customerPhone?: string;

  @Column({ length: 500, nullable: true })
  customerAddress?: string;

  @Column({ type: 'datetime', nullable: true })
  orderDate?: Date;

  @Column({ type: 'datetime', nullable: true })
  expectedDate?: Date;

  @Column({ nullable: true, default: 'Đã giao hàng' })
  status?: string;

  @Column({ length: 500, nullable: true })
  description?: string;

  @Column({ type: 'int', default: 0 })
  items: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: '0.00' })
  subtotal: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: '0.00' })
  discount: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: '0.00' })
  vatRate: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: '0.00' })
  vatAmount: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: '0.00' })
  totalAmount: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: '0.00' })
  amountPaid: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: '0.00' })
  debt: string;

  @Column({ length: 50, default: 'CASH' })
  paymentMethod: string;

  @Column({ length: 100, nullable: true })
  paymentAccount?: string;

  @Column({ type: 'boolean', default: false })
  usePoints: boolean;

  @Column({ type: 'int', default: 0 })
  pointsUsed: number;

  @Column({ type: 'int', default: 0 })
  pointsAvailable: number;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;

  @OneToMany(() => OutboundDetail, (d) => d.outboundOrder)
  details: OutboundDetail[];

  @ManyToOne(() => ShippingNote, (sn) => sn.orders, { nullable: true })
  shippingNote?: ShippingNote;
}
