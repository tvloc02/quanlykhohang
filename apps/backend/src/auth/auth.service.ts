import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { AuditLogService } from '../audit-log/audit-log.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async register(createUserDto: any) {
    const user = await this.usersService.create(createUserDto);
    const userRole = Array.isArray(user.roles) ? user.roles[0]?.name : createUserDto.role || 'staff';
    await this.auditLogService.append({
      actorId: user.id,
      actorEmail: user.email,
      action: 'USER_REGISTERED',
      resource: 'auth',
      resourceId: user.id,
      metadata: { email: user.email, role: userRole },
    });
    return user;
  }

  async validateUser(email: string, pass: string) {
    if (!email || !pass) {
      return null;
    }

    const user = await this.usersService.findByEmail(email);
    if (!user?.password) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(pass, user.password);
    if (user && isPasswordValid) {
      const { password, ...result } = user as any;
      return result;
    }
    return null;
  }

  async login(user: any) {
    if (!user) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    const supplierId = user.supplier?.id;
    const userRole = Array.isArray(user.roles) ? user.roles[0]?.name : 'staff';
    const payload = { sub: user.id, email: user.email, role: userRole, supplierId };
    const token = await this.jwtService.signAsync(payload);

    await this.auditLogService.append({
      actorId: user.id,
      actorEmail: user.email,
      action: 'USER_LOGGED_IN',
      resource: 'auth',
      resourceId: user.id,
      metadata: { email: user.email, role: userRole },
    });

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        supplierId,
      },
    };
  }
}
