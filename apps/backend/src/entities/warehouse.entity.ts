import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  AfterLoad,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';

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

  @Column({ type: 'text', nullable: true })
  managerIds: string;

  @Column({ type: 'text', nullable: true })
  staffIds: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;

  @AfterLoad()
  normalizeAssignmentIds() {
    this.managerIds = this.normalizeIds(this.managerIds);
    this.staffIds = this.normalizeIds(this.staffIds);
  }

  @BeforeInsert()
  @BeforeUpdate()
  sanitizeAssignmentIds() {
    this.managerIds = this.normalizeIds(this.managerIds);
    this.staffIds = this.normalizeIds(this.staffIds);
  }

  private normalizeIds(value?: string[] | string | null): string[] {
    if (value == null) return [];

    const rawValues = Array.isArray(value)
      ? value
      : String(value)
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);

    return Array.from(new Set(rawValues.map((item) => String(item).trim()).filter(Boolean)));
  }
}
