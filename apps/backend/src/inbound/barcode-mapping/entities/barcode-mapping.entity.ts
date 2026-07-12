import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../entities/base.entity';
import { Product } from '../../../entities/product.entity';

@Entity('barcode_mappings')
export class BarcodeMapping extends BaseEntity {
  @Index({ unique: true })
  @Column()
  barcode: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;
}
