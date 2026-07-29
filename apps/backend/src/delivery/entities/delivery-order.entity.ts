import { Column, CreateDateColumn, Entity, Index, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../../entities/base.entity';

export type TransferOrderStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

export type TransferOrderItem = {
  id: string;
  productCode: string;
  productName: string;
  unit: string;
  quantity: number;
};

@Entity('transfer_orders')
export class TransferOrder extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 50 })
  transferNo: string;

  @Column({ length: 50, nullable: true })
  requestId?: string;

  @Column({ length: 50, nullable: true })
  requestNumber?: string;

  @Column({ length: 150 })
  sourceWarehouse: string;

  @Column({ length: 150 })
  destinationWarehouse: string;

  @Column({ type: 'datetime', nullable: true })
  scheduledDate?: Date;

  @Column({ default: 'DRAFT' })
  status: TransferOrderStatus;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @Column({ length: 150, nullable: true })
  createdBy?: string;

  @Column({ type: 'simple-json', nullable: true })
  items?: TransferOrderItem[];

  @Column({ type: 'int', default: 0 })
  itemCount: number;

  @Column({ type: 'int', default: 0 })
  totalQuantity: number;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
