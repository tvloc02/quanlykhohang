import { Column, CreateDateColumn, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Product } from './product.entity';
import { Supplier } from './supplier.entity';

@Entity('stock_in_history')
export class StockInHistory extends BaseEntity {
  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  product: Product;

  @Column({ nullable: true })
  productId: string;

  @Column({ nullable: true })
  orderCode: string;

  @ManyToOne(() => Supplier, { nullable: true, onDelete: 'SET NULL' })
  supplier?: Supplier;

  @Column({ nullable: true })
  supplierName?: string;

  @Column({ nullable: true })
  warehouseCode?: string;

  @Column({ nullable: true })
  warehouseName?: string;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ nullable: true })
  createdBy?: string;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}
