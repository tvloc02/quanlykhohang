import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../entities/base.entity';
import { Assembly } from './assembly.entity';
import { Product } from '../../../entities/product.entity';

@Entity('assembly_details')
export class AssemblyDetail extends BaseEntity {
  @ManyToOne(() => Assembly, (assembly) => assembly.details, { onDelete: 'CASCADE' })
  assembly: Assembly;

  @ManyToOne(() => Product, { nullable: false })
  componentProduct: Product;

  @Column({ type: 'int', default: 0 })
  usedQty: number;

  @Column({ nullable: true })
  warehouseCode?: string;

  @Column({ nullable: true })
  sourceOrderDetailId?: string;
}
