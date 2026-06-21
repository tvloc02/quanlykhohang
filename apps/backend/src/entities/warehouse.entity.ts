import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('warehouses')
export class Warehouse {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Column('varchar', { length: 50, unique: true })
  code: string;

  @Column('varchar', { length: 255 })
  name: string;

  @Column('varchar', { length: 500, nullable: true })
  address: string;

  @Column('enum', { enum: ['active', 'inactive'], default: 'active' })
  status: 'active' | 'inactive';

  @Column('simple-array', { default: '' })
  managerIds: string[];

  @Column('simple-array', { default: '' })
  staffIds: string[];

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
