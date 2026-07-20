import { Column, Entity, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../entities/base.entity';
import { OutboundOrder } from './outbound-order.entity';

@Entity('shipping_notes')
export class ShippingNote extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 50 })
  noteNo: string;

  @Column({ default: 'DRAFT' })
  status: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'datetime', nullable: true })
  expectedDate?: Date;

  @Column({ nullable: true })
  assignee?: string;

  @OneToMany(() => OutboundOrder, (o) => o.shippingNote)
  orders: OutboundOrder[];
}
