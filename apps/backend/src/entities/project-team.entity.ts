import { Column, Entity } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('project_teams')
export class ProjectTeam extends BaseEntity {
  @Column({ length: 64, nullable: true, default: '' })
  warehouseId?: string;

  @Column({ length: 50, nullable: true })
  warehouseCode?: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  storekeeperIds?: string;

  @Column({ type: 'text', nullable: true })
  inventoryCheckerIds?: string;

  @Column({ type: 'text', nullable: true })
  memberIds?: string;

  @Column({ type: 'json', nullable: true })
  generalPermissions?: any;

  @Column({ type: 'json', nullable: true })
  menuPermissions?: any;
}
