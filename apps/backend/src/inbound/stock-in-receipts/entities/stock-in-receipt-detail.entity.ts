import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../entities/base.entity';
import { Product } from '../../../entities/product.entity';
import { StockInReceipt } from './stock-in-receipt.entity';

@Entity('stock_in_receipt_details')
export class StockInReceiptDetail extends BaseEntity {
  @ManyToOne(() => StockInReceipt, (receipt) => receipt.details, { onDelete: 'CASCADE' })
  receipt: StockInReceipt;

  @ManyToOne(() => Product, { nullable: false, onDelete: 'RESTRICT' })
  product: Product;

  @Column({ nullable: true })
  warehouseCode?: string;

  @Column({ type: 'int', default: 0 })
  orderedQty: number;

  @Column({ type: 'int', default: 0 })
  receivedQty: number;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  unitPrice: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalLineAmount: string;

  @Column({ type: 'text', nullable: true })
  note?: string;

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
}
