import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../entities/role.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  findAll() {
    return this.roleRepo.find({ order: { name: 'ASC' } });
  }

  async create(name: string) {
    const normalizedName = name.trim().toLowerCase();
    if (!normalizedName) {
      throw new BadRequestException('Role name is required');
    }

    const existing = await this.roleRepo.findOne({ where: { name: normalizedName } });
    if (existing) {
      return existing;
    }

    return this.roleRepo.save(this.roleRepo.create({ name: normalizedName }));
  }

  async remove(id: string) {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const assignedUsers = await this.userRepo
      .createQueryBuilder('user')
      .innerJoin('user.roles', 'role', 'role.id = :id', { id })
      .getCount();

    if (assignedUsers > 0) {
      throw new BadRequestException('Cannot delete a role assigned to users');
    }

    await this.roleRepo.delete(id);
    return { deleted: true };
  }
}
