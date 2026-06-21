import { Column, Entity, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../../entities/base.entity';
import { OutboundOrder } from './outbound-order.entity';

@Entity('picking_tasks')
export class PickingTask extends BaseEntity {
  @ManyToOne(() => OutboundOrder, { nullable: false })
  order: OutboundOrder;

  @Column({ nullable: true })
  assignedTo?: string;

  @Column({ default: 'OPEN' })
  status: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
