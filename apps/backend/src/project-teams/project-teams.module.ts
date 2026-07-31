import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectTeam } from '../entities/project-team.entity';
import { ProjectTeamsController } from './project-teams.controller';
import { ProjectTeamsService } from './project-teams.service';

@Module({ imports: [TypeOrmModule.forFeature([ProjectTeam])], controllers: [ProjectTeamsController], providers: [ProjectTeamsService] })
export class ProjectTeamsModule {}
