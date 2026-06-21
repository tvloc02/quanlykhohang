import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../entities/base.entity';
import { Product } from '../../entities/product.entity';
import { InboundReceipt } from './inbound-receipt.entity';

@Entity('inbound_details')
export class InboundDetail extends BaseEntity {
  @ManyToOne(() => InboundReceipt, (r) => r.details)
  inboundReceipt: InboundReceipt;

  @ManyToOne(() => Product)
  product: Product;

  @Column({ nullable: true })
  warehouseCode?: string;

  @Column({ type: 'int', default: 0 })
  expectedQty: number;

  @Column({ type: 'int', default: 0 })
  receivedQty: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  unitPrice: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalLineAmount: string;
}
