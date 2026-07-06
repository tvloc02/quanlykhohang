import { Controller, Get, Put, Body, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getProfile(@Req() req: any) {
    const user = await this.usersService.findOne(req.user.id);
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.roles?.[0]?.name,
      phone: user.phone,
      department: user.department,
      location: user.location,
      joinedAt: user.createdAt,
    };
  }

  @Put()
  async updateProfile(@Req() req: any, @Body() body: any) {
    const user = await this.usersService.updateProfile(req.user.id, body);
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.roles?.[0]?.name,
      phone: user.phone,
      department: user.department,
      location: user.location,
      joinedAt: user.createdAt,
    };
  }

  @Put('password')
  async changePassword(@Req() req: any, @Body() body: any) {
    await this.usersService.changePassword(
      req.user.id,
      body.currentPassword,
      body.newPassword,
    );
    return { success: true };
  }
}
