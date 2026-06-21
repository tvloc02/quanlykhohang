import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Product } from './product.entity';
import { Supplier } from './supplier.entity';

@Entity('supplier_products')
@Index('IDX_supplier_products_supplier_product', ['supplier', 'product'], { unique: true })
export class SupplierProduct extends BaseEntity {
  @ManyToOne(() => Supplier, (supplier) => supplier.products, { onDelete: 'CASCADE' })
  supplier: Supplier;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  product: Product;

  @Column({ nullable: true })
  supplierSku?: string;

  @Column({ nullable: true })
  itemGroup?: string;

  @Column({ nullable: true })
  managementType?: string;

  @Column({ nullable: true })
  storagePosition?: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  purchasePrice: string;

  @Column({ default: false })
  isPrimary: boolean;
}
