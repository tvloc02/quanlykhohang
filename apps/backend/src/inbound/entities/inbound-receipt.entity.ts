import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../entities/base.entity';
import { Supplier } from '../../entities/supplier.entity';
import { InboundDetail } from './inbound-detail.entity';

@Entity('inbound_receipts')
export class InboundReceipt extends BaseEntity {
  @ManyToOne(() => Supplier, { nullable: true })
  supplier?: Supplier;

  @Column({ nullable: true, unique: true })
  poNumber?: string;

  @Column({ type: 'datetime', nullable: true })
  orderDate?: Date;

  @Column({ type: 'datetime', nullable: true })
  expectedDate?: Date;

  @Column({ nullable: true })
  status?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalAmount: string;

  @OneToMany(() => InboundDetail, (d) => d.inboundReceipt)
  details: InboundDetail[];
}
// Placeholder inbound receipt entity
