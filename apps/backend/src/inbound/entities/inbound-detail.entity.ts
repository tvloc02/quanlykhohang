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

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  requestedPrice?: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  supplierPrice?: string | null;

  @Column({ type: 'json', nullable: true })
  negotiationHistory?: Array<{ round: number; supplierPrice?: number | null; enterprisePrice?: number | null; enterpriseResponded?: boolean }>;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalLineAmount: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  discountPercent: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  vatPercent: number;

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
