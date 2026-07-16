import { Column, Entity, ManyToOne, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Category } from './category.entity';
import { Supplier } from './supplier.entity';

@Entity('products')
@Index('IDX_products_supplier_barcode', ['supplier', 'supplierBarcode'], { unique: true })
export class Product extends BaseEntity {
  @Index({ unique: true })
  @Column()
  internalSku: string;

  @Index()
  @Column({ nullable: true })
  supplierBarcode?: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  unit?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ type: 'json', nullable: true })
  images?: string[];

  @ManyToOne(() => Category, { nullable: true })
  category?: Category;

  @ManyToOne(() => Supplier, { nullable: true, onDelete: 'SET NULL' })
  supplier?: Supplier;

  @Column({ type: 'int', default: 0 })
  minimumStock: number;
}
