import { Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('customers')
export class Customer extends BaseEntity {
  @Index({ unique: true })
  @Column()
  customerCode: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true, length: 500 })
  address?: string;

  @Column({ default: 'B2C' })
  type: 'B2B' | 'B2C';

  @Column({ default: 'active' })
  status: 'active' | 'inactive';

  @Column({ nullable: true })
  contactPerson?: string;

  @OneToOne(() => User, (user) => user.customer, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User;
}
