import { Column, Entity, ManyToOne, Index } from 'typeorm';
import { BaseEntity } from '../../entities/base.entity';
import { Product } from '../../entities/product.entity';

@Entity('stock_balances')
@Index(['product', 'locationCode'], { unique: true })
export class StockBalance extends BaseEntity {
  @ManyToOne(() => Product, { nullable: false })
  product: Product;

  @Column()
  locationCode: string;

  @Column({ type: 'int', default: 0 })
  totalPhysical: number;

  @Column({ type: 'int', default: 0 })
  allocated: number;

  @Column({ type: 'int', default: 0 })
  available: number;
}
