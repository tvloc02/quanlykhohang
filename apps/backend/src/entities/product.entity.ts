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

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  price: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  importPrice: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  wholesalePrice: number;

  @Column({ type: 'json', nullable: true })
  images?: string[];

  @ManyToOne(() => Category, { nullable: true, onDelete: 'SET NULL' })
  category?: Category;

  @ManyToOne(() => Supplier, { nullable: true, onDelete: 'SET NULL' })
  supplier?: Supplier;

  @Column({ type: 'int', default: 0 })
  minimumStock: number;

  @Column({ type: 'boolean', default: false })
  isVisible: boolean;

  // Logistics & AI Slotting Parameters
  @Column({ type: 'decimal', precision: 10, scale: 3, default: 1.0 })
  weight: number; // kg

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 20.0 })
  length: number; // cm

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 15.0 })
  width: number; // cm

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 10.0 })
  height: number; // cm

  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0.003 })
  volume: number; // m³ (CBM)

  @Column({ type: 'decimal', precision: 10, scale: 3, default: 0.5 })
  volumetricWeight: number; // kg

  @Column({ length: 32, default: 'AMBIENT' })
  tempRequirement: string; // 'AMBIENT' | 'COLD' | 'THERMAL'

  @Column({ length: 8, default: 'B' })
  turnoverClass: string; // 'A' | 'B' | 'C'
}
