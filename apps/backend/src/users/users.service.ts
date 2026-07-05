import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../entities/role.entity';
import { User } from '../entities/user.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private repo: Repository<User>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(): Promise<User[]> {
    return this.repo.find({ relations: ['roles'] });
  }

  async create(createUserDto: CreateUserDto, actor?: { id?: string; email?: string }): Promise<User> {
    const rawPassword = createUserDto.password ?? (Math.random().toString(36).slice(-8) + 'A1');
    const hashed = await bcrypt.hash(rawPassword, 10);
    const roleName = createUserDto.role || 'staff';
    let role = await this.roleRepo.findOne({ where: { name: roleName } });

    if (!role) {
      role = await this.roleRepo.save(this.roleRepo.create({ name: roleName }));
    }

    const user = this.repo.create({
      email: createUserDto.email,
      password: hashed,
      fullName: createUserDto.fullName,
      phone: createUserDto.phone,
      roles: [role],
      status: createUserDto.status || 'active',
    });
    const savedUser = await this.repo.save(user);
    await this.auditLogService.append({
      actorId: actor?.id,
      actorEmail: actor?.email,
      action: 'USER_CREATED',
      resource: 'users',
      resourceId: savedUser.id,
      metadata: { email: savedUser.email, role: role.name },
    });
    return savedUser;
  }

  async findOne(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id }, relations: ['roles'] });
  }

  async findByEmail(email: string): Promise<(User & { role?: string }) | null> {
    const user = await this.repo.findOne({ where: { email }, relations: ['roles', 'supplier', 'customer'] });
    if (!user) return null;

    return {
      ...user,
      role: user.roles?.[0]?.name,
    };
  }

  async update(id: string, updateUserDto: UpdateUserDto, actor?: { id?: string; email?: string }) {
    const user = await this.findOne(id);
    if (!user) throw new NotFoundException('User not found');
    if (actor?.id === id && updateUserDto.role) {
      throw new ForbiddenException('You cannot change your own role');
    }
    if (actor?.id === id && updateUserDto.status === 'inactive') {
      throw new ForbiddenException('You cannot deactivate your own account');
    }
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }
    if (updateUserDto.email !== undefined) {
      user.email = updateUserDto.email;
    }

    if (updateUserDto.fullName !== undefined) {
      user.fullName = updateUserDto.fullName;
    }

    if (updateUserDto.phone !== undefined) {
      user.phone = updateUserDto.phone;
    }

    if (updateUserDto.status !== undefined) {
      user.status = updateUserDto.status;
    }

    if (updateUserDto.role) {
      let role = await this.roleRepo.findOne({ where: { name: updateUserDto.role } });
      if (!role) {
        role = await this.roleRepo.save(this.roleRepo.create({ name: updateUserDto.role }));
      }
      user.roles = [role];
    }

    await this.repo.save(user);
    const updatedUser = await this.findOne(id);
    await this.auditLogService.append({
      actorId: actor?.id,
      actorEmail: actor?.email,
      action: 'USER_UPDATED',
      resource: 'users',
      resourceId: id,
      metadata: {
        email: updatedUser?.email,
        role: updatedUser?.roles?.[0]?.name,
      },
    });
    return updatedUser;
  }

  async remove(id: string, actor?: { id?: string; email?: string }) {
    if (actor?.id === id) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    const user = await this.findOne(id);
    if (!user) throw new NotFoundException('User not found');

    if (user.roles?.some((role) => role.name === 'admin')) {
      const adminCount = await this.repo
        .createQueryBuilder('user')
        .innerJoin('user.roles', 'role', 'role.name = :role', { role: 'admin' })
        .getCount();

      if (adminCount <= 1) {
        throw new BadRequestException('Cannot delete the last administrator');
      }
    }

    await this.repo.delete(id);
    await this.auditLogService.append({
      actorId: actor?.id,
      actorEmail: actor?.email,
      action: 'USER_DELETED',
      resource: 'users',
      resourceId: id,
      metadata: { email: user.email },
    });
    return { deleted: true };
  }
}
