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
}
