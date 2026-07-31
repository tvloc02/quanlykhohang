import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectTeam } from '../entities/project-team.entity';
import { CreateProjectTeamDto } from './dto/create-project-team.dto';

const ids = (value?: string[] | string | null) => Array.from(new Set((Array.isArray(value) ? value : String(value || '').split(',')).map(String).map((v) => v.trim()).filter(Boolean)));
const output = (team: ProjectTeam) => ({ ...team, storekeeperIds: ids(team.storekeeperIds), inventoryCheckerIds: ids(team.inventoryCheckerIds) });

@Injectable()
export class ProjectTeamsService {
  constructor(@InjectRepository(ProjectTeam) private readonly repo: Repository<ProjectTeam>) {}

  async findAll(warehouseId?: string) {
    const teams = await this.repo.find({ order: { name: 'ASC' } });
    return teams.filter((team) => !warehouseId || team.warehouseId === warehouseId).map(output);
  }

  async create(dto: CreateProjectTeamDto) {
    const team = this.repo.create({ ...dto, storekeeperIds: ids(dto.storekeeperIds).join(','), inventoryCheckerIds: ids(dto.inventoryCheckerIds).join(',') });
    return output(await this.repo.save(team));
  }

  async update(id: string, dto: Partial<CreateProjectTeamDto>) {
    const team = await this.repo.findOne({ where: { id } });
    if (!team) throw new NotFoundException('Đội dự án không tồn tại');
    Object.assign(team, dto);
    if (dto.storekeeperIds !== undefined) team.storekeeperIds = ids(dto.storekeeperIds).join(',');
    if (dto.inventoryCheckerIds !== undefined) team.inventoryCheckerIds = ids(dto.inventoryCheckerIds).join(',');
    return output(await this.repo.save(team));
  }

  async remove(id: string) {
    const result = await this.repo.delete(id);
    if (!result.affected) throw new NotFoundException('Đội dự án không tồn tại');
    return { deleted: true };
  }
}
