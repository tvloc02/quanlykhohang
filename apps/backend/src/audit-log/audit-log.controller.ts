import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuditLogService } from './audit-log.service';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  /**
   * GET /api/audit-logs
   * Lọc đa chiều: actorId, resource, action, from, to
   */
  @Get()
  @Roles('admin', 'manager')
  findFiltered(
    @Query('actorId') actorId?: string,
    @Query('resource') resource?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditLogService.findFiltered({
      actorId,
      resource,
      action,
      from,
      to,
      limit: Number(limit) || 100,
    });
  }

  /**
   * GET /api/audit-logs/by-resource/:resource/:resourceId
   * Xem lịch sử thay đổi của một tài nguyên cụ thể
   */
  @Get('by-resource/:resource/:resourceId')
  @Roles('admin', 'manager')
  findByResource(
    @Param('resource') resource: string,
    @Param('resourceId') resourceId: string,
  ) {
    return this.auditLogService.findByResource(resource, resourceId);
  }

  /**
   * GET /api/audit-logs/verify-integrity
   * Kiểm tra tính toàn vẹn của chuỗi Hash Chain (cho kiểm toán viên)
   */
  @Get('verify-integrity')
  @Roles('admin')
  verifyIntegrity(@Query('limit') limit?: string) {
    return this.auditLogService.verifyIntegrity(Number(limit) || 1000);
  }
}
