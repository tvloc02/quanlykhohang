import { Column, Entity, ManyToOne, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../entities/base.entity';
import { Customer } from '../../entities/customer.entity';
import { OutboundDetail } from './outbound-detail.entity';

@Entity('outbound_orders')
export class OutboundOrder extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 50, nullable: true })
  orderNo?: string;

  @ManyToOne(() => Customer, { nullable: true })
  customer?: Customer;

  @Column({ type: 'datetime', nullable: true })
  expectedDate?: Date;

  @Column({ nullable: true })
  status?: string;

  @Column({ length: 500, nullable: true })
  description?: string;

  @Column({ type: 'int', default: 0 })
  items: number;

  @OneToMany(() => OutboundDetail, (d) => d.outboundOrder)
  details: OutboundDetail[];
}
