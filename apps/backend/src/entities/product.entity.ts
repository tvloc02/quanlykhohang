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

  // ─── AI Slotting: Thuộc tính vật lý 3D ──────────────

  /** Chiều dài bao bì (cm) */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, comment: 'Chiều dài (cm)' })
  length?: number;

  /** Chiều rộng bao bì (cm) */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, comment: 'Chiều rộng (cm)' })
  width?: number;

  /** Chiều cao bao bì (cm) */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, comment: 'Chiều cao (cm)' })
  height?: number;

  /** Trọng lượng thực tế (kg) */
  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true, comment: 'Trọng lượng (kg)' })
  weight?: number;

  /** Yêu cầu bảo quản: COLD (-18°C), AMBIENT (thường), THERMAL (điều hòa) */
  @Column({
    type: 'enum',
    enum: ['COLD', 'AMBIENT', 'THERMAL'],
    default: 'AMBIENT',
    comment: 'Yêu cầu bảo quản',
  })
  requiredZoneType: 'COLD' | 'AMBIENT' | 'THERMAL';

  /** Phân loại nguy hiểm: FLAMMABLE, CORROSIVE, FOOD, TOXIC, null */
  @Column({ type: 'varchar', length: 50, nullable: true, comment: 'Phân loại nguy hiểm' })
  hazardClass?: string;

  /** Cache kết quả phân loại ABC (cập nhật bởi batch job) */
  @Column({
    type: 'enum',
    enum: ['A', 'B', 'C'],
    nullable: true,
    comment: 'Phân loại ABC (cache)',
  })
  abcClass?: 'A' | 'B' | 'C';
}
