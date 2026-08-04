import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectTeam } from '../entities/project-team.entity';
import { CreateProjectTeamDto } from './dto/create-project-team.dto';

const ids = (value?: string[] | string | null) =>
  Array.from(
    new Set(
      (Array.isArray(value) ? value : String(value || '').split(','))
        .map(String)
        .map((v) => v.trim())
        .filter(Boolean)
    )
  );

const output = (team: ProjectTeam) => {
  const storekeepers = ids(team.storekeeperIds);
  const checkers = ids(team.inventoryCheckerIds);
  const members = ids(team.memberIds);
  const mergedMembers = Array.from(new Set([...storekeepers, ...checkers, ...members]));

  return {
    ...team,
    storekeeperIds: storekeepers,
    inventoryCheckerIds: checkers,
    memberIds: mergedMembers,
    generalPermissions: team.generalPermissions || null,
    menuPermissions: team.menuPermissions || null,
  };
};

@Injectable()
export class ProjectTeamsService {
  constructor(@InjectRepository(ProjectTeam) private readonly repo: Repository<ProjectTeam>) {}

  async findAll(warehouseId?: string) {
    const teams = await this.repo.find({ order: { name: 'ASC' } });
    return teams.filter((team) => !warehouseId || team.warehouseId === warehouseId).map(output);
  }

  async create(dto: CreateProjectTeamDto) {
    const team = this.repo.create({
      ...dto,
      warehouseId: dto.warehouseId || '',
      storekeeperIds: ids(dto.storekeeperIds).join(','),
      inventoryCheckerIds: ids(dto.inventoryCheckerIds).join(','),
      memberIds: ids(dto.memberIds).join(','),
      generalPermissions: dto.generalPermissions || null,
      menuPermissions: dto.menuPermissions || null,
    });
    return output(await this.repo.save(team));
  }

  async update(id: string, dto: Partial<CreateProjectTeamDto>) {
    const team = await this.repo.findOne({ where: { id } });
    if (!team) throw new NotFoundException('Nhóm quyền không tồn tại');

    Object.assign(team, dto);
    if (dto.storekeeperIds !== undefined) team.storekeeperIds = ids(dto.storekeeperIds).join(',');
    if (dto.inventoryCheckerIds !== undefined) team.inventoryCheckerIds = ids(dto.inventoryCheckerIds).join(',');
    if (dto.memberIds !== undefined) team.memberIds = ids(dto.memberIds).join(',');
    if (dto.generalPermissions !== undefined) team.generalPermissions = dto.generalPermissions;
    if (dto.menuPermissions !== undefined) team.menuPermissions = dto.menuPermissions;

    return output(await this.repo.save(team));
  }

  async remove(id: string) {
    const result = await this.repo.delete(id);
    if (!result.affected) throw new NotFoundException('Nhóm quyền không tồn tại');
    return { deleted: true };
  }
}
