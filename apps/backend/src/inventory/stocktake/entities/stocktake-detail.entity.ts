import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../entities/base.entity';
import { Product } from '../../../entities/product.entity';
import { Stocktake } from './stocktake.entity';

@Entity('stocktake_details')
export class StocktakeDetail extends BaseEntity {
  @ManyToOne(() => Stocktake, (s) => s.details)
  stocktake: Stocktake;

  @ManyToOne(() => Product)
  product: Product;

  @Column({ type: 'int', default: 0 })
  systemQty: number;

  @Column({ type: 'int', nullable: true })
  countedQty?: number;

  @Column({ type: 'int', default: 0 })
  difference: number;

  @Column({ type: 'text', nullable: true })
  note?: string;
}
