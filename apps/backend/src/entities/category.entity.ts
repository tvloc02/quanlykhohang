import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('categories')
@Index('IDX_categories_type_code', ['type', 'code'], { unique: true })
export class Category extends BaseEntity {
  @Column({ default: 'item-group' })
  type: string;

  @Column()
  name: string;

  @Column({ default: '' })
  code: string;

  @Column({ default: '' })
  description: string;

  @Column({ default: 'active' })
  status: 'active' | 'inactive';

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}
