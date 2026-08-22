import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ProjectTeamsService } from './project-teams.service';
import { CreateProjectTeamDto } from './dto/create-project-team.dto';

@Controller('project-teams')
@UseGuards(JwtAuthGuard)
export class ProjectTeamsController {
  constructor(private readonly service: ProjectTeamsService) {}

  @Get()
  findAll(@Query('warehouseId') warehouseId?: string) {
    return this.service.findAll(warehouseId);
  }

  @Post()
  create(@Body() dto: CreateProjectTeamDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateProjectTeamDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
