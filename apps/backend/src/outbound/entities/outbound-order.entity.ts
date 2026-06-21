import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../entities/base.entity';
import { Customer } from '../../entities/customer.entity';
import { OutboundDetail } from './outbound-detail.entity';

@Entity('outbound_orders')
export class OutboundOrder extends BaseEntity {
  @ManyToOne(() => Customer, { nullable: true })
  customer?: Customer;

  @Column({ type: 'datetime', nullable: true })
  expectedDate?: Date;

  @Column({ nullable: true })
  status?: string;

  @OneToMany(() => OutboundDetail, (d) => d.outboundOrder)
  details: OutboundDetail[];
}
// Placeholder outbound order entity
