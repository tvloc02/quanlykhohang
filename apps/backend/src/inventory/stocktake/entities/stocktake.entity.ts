import { Column, CreateDateColumn, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../entities/base.entity';
import { StocktakeDetail } from './stocktake-detail.entity';

@Entity('stocktakes')
export class Stocktake extends BaseEntity {
  @Column({ unique: true })
  stocktakeNo: string;

  @Column()
  locationCode: string;

  @Column({
    type: 'enum',
    enum: ['DRAFT', 'COUNTING', 'COUNTING_DONE', 'APPROVED', 'REJECTED'],
    default: 'DRAFT',
  })
  status: string;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @Column({ type: 'datetime', nullable: true })
  plannedDate?: Date;

  @Column({ nullable: true })
  assignee?: string;

  @Column({ nullable: true })
  createdBy?: string;

  @Column({ nullable: true })
  approvedBy?: string;

  @Column({ type: 'datetime', nullable: true })
  approvedAt?: Date;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @OneToMany(() => StocktakeDetail, (d) => d.stocktake)
  details: StocktakeDetail[];
}
