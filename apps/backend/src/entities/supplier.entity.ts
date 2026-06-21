import { Column, Entity, Index, JoinColumn, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { SupplierProduct } from './supplier-product.entity';
import { User } from './user.entity';

@Entity('suppliers')
export class Supplier extends BaseEntity {
  @Index({ unique: true })
  @Column()
  supplierCode: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  taxCode?: string;

  @Column({ default: 'active' })
  status: 'active' | 'inactive';

  @Column({ nullable: true })
  contactPerson?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ type: 'int', default: 0 })
  leadTimeDays: number;

  @Column({ nullable: true })
  paymentTerms?: string;

  @Column({ default: 'VND' })
  currency: string;

  @Column({ default: 'secondary' })
  priorityLevel: 'strategic' | 'secondary';

  @OneToOne(() => User, (user) => user.supplier, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @OneToMany(() => SupplierProduct, (supplierProduct) => supplierProduct.supplier)
  products: SupplierProduct[];
}
