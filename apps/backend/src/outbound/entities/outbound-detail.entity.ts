import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../entities/base.entity';
import { Product } from '../../entities/product.entity';
import { OutboundOrder } from './outbound-order.entity';

@Entity('outbound_details')
export class OutboundDetail extends BaseEntity {
  @ManyToOne(() => OutboundOrder, (o) => o.details)
  outboundOrder: OutboundOrder;

  @ManyToOne(() => Product)
  product: Product;

  @Column({ length: 50, nullable: true })
  warehouseCode?: string;

  @Column({ type: 'int', default: 0 })
  requiredQty: number;

  @Column({ type: 'int', default: 0 })
  pickedQty: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: '0.00' })
  unitPrice: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: '0.00' })
  totalLineAmount: string;
}
