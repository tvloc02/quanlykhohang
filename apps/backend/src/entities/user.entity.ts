import { Column, Entity, JoinTable, ManyToMany, OneToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Role } from './role.entity';
import { Supplier } from './supplier.entity';
import { Customer } from './customer.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  fullName?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ default: 'active' })
  status: 'active' | 'inactive';

  @ManyToMany(() => Role)
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'userId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'roleId', referencedColumnName: 'id' },
  })
  roles: Role[];

  @OneToOne(() => Supplier, (supplier) => supplier.user)
  supplier?: Supplier;

  @OneToOne(() => Customer, (customer) => customer.user)
  customer?: Customer;
}
