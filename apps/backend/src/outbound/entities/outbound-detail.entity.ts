import { Column, Entity, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../../entities/base.entity';
import { Product } from '../../entities/product.entity';
import { OutboundOrder } from './outbound-order.entity';

@Entity('outbound_details')
export class OutboundDetail extends BaseEntity {
  @ManyToOne(() => OutboundOrder, (o) => o.details)
  outboundOrder: OutboundOrder;

  @ManyToOne(() => Product, { nullable: true })
  product: Product;

  @Column({ length: 100, nullable: true })
  productSku?: string;

  @Column({ length: 255, nullable: true })
  productName?: string;

  @Column({ length: 50, nullable: true })
  unit?: string;

  @Column({ length: 50, nullable: true })
  warehouseCode?: string;

  @Column({ type: 'int', default: 0 })
  requiredQty: number;

  @Column({ type: 'int', default: 0 })
  pickedQty: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: '0.00' })
  unitPrice: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: '0.00' })
  discountPercent: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: '0.00' })
  discountAmount: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: '0.00' })
  vatPercent: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: '0.00' })
  vatAmount: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: '0.00' })
  totalLineAmount: string;

  @Column({ length: 500, nullable: true })
  note?: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
