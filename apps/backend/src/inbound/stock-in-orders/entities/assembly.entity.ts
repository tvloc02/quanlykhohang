import { Column, CreateDateColumn, Entity, Index, ManyToOne, OneToMany, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../../../entities/base.entity';
import { Product } from '../../../entities/product.entity';
import { StockInOrder } from './stock-in-order.entity';
import { AssemblyDetail } from './assembly-detail.entity';

@Entity('assemblies')
export class Assembly extends BaseEntity {
  @Index({ unique: true })
  @Column()
  assemblyCode: string;

  @ManyToOne(() => StockInOrder, { nullable: false })
  sourceStockInOrder: StockInOrder;

  @ManyToOne(() => Product, { nullable: false })
  assembledProduct: Product;

  @Column()
  warehouseCode: string;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @Column({ nullable: true })
  barcode?: string;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @Column({ default: 'COMPLETED' })
  status: 'COMPLETED' | 'RECOUNTED';

  @Column({ type: 'int', nullable: true })
  recountedQty?: number;

  @Column({ type: 'datetime', nullable: true })
  recountedAt?: Date;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;

  @OneToMany(() => AssemblyDetail, (detail) => detail.assembly, { cascade: true })
  details: AssemblyDetail[];
}
