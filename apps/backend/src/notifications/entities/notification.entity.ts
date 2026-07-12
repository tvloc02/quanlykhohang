import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../entities/base.entity';

@Entity('notifications')
export class Notification extends BaseEntity {
  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Index()
  @Column({ nullable: true })
  recipientUserId?: string;

  @Index()
  @Column({ nullable: true })
  recipientRole?: string;

  @Column({ nullable: true })
  referenceType?: string;

  @Column({ nullable: true })
  referenceId?: string;

  @Column({ nullable: true })
  link?: string;

  @Column({ default: 'normal' })
  priority: 'low' | 'normal' | 'high' | 'urgent';

  @Column({ default: true })
  isUnread: boolean;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @Column({ type: 'datetime', nullable: true })
  readAt?: Date;
}
