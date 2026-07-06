import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcryptjs';
import { AuditLogService } from '../audit-log/audit-log.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService,
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
    const userRole = Array.isArray(user.roles) ? user.roles[0]?.name : user.role || 'staff';
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
        role: userRole,
        supplierId,
      },
    };
  }

  async googleLogin(credential: string) {
    if (!credential) {
      throw new UnauthorizedException('Thiếu thông tin đăng nhập Google');
    }

    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID') || '1079704717727-3c0hitge9b5sniqh619lassoc0pd9262.apps.googleusercontent.com';
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload();

    if (!payload?.email || !payload.email_verified) {
      throw new UnauthorizedException('Xác thực Google không thành công');
    }

    const existingUser = await this.usersService.findByEmail(payload.email);
    if (!existingUser) {
      const createdUser = await this.usersService.create({
        email: payload.email,
        password: undefined,
        fullName: payload.name || payload.email.split('@')[0],
        role: 'staff',
      });
      return this.login({ ...createdUser, role: 'staff' });
    }

    return this.login(existingUser);
  }
}
