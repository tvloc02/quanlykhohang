import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../entities/base.entity';
import { Product } from '../../../entities/product.entity';
import { StockInOrder } from './stock-in-order.entity';

@Entity('stock_in_order_details')
export class StockInOrderDetail extends BaseEntity {
  @ManyToOne(() => StockInOrder, (order) => order.details, { onDelete: 'CASCADE' })
  stockInOrder: StockInOrder;

  @ManyToOne(() => Product, { nullable: false })
  product: Product;

  @Column({ nullable: true })
  warehouseCode?: string;

  @Column({ type: 'int', default: 0 })
  requestedQty: number;

  @Column({ type: 'int', default: 0 })
  actualQty: number;

  @Column({ type: 'int', default: 0 })
  distributedQty: number;

  @Column({ type: 'int', default: 0 })
  producedQty: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  unitPrice: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalLineAmount: string;

  @Column({ type: 'decimal', precision: 10, scale: 3, default: 0 })
  weight: number;

  @Column({ type: 'decimal', precision: 10, scale: 3, default: 0 })
  length: number;

  @Column({ type: 'decimal', precision: 10, scale: 3, default: 0 })
  width: number;

  @Column({ type: 'decimal', precision: 10, scale: 3, default: 0 })
  height: number;

  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 })
  volume: number;

  @Column({ type: 'decimal', precision: 10, scale: 3, default: 0 })
  volumetricWeight: number;

  @Column({ type: 'text', nullable: true })
  note?: string;
}
