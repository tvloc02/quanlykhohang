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
  quantity: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  unitPrice: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalLineAmount: string;

  @Column({ type: 'text', nullable: true })
  note?: string;
}
