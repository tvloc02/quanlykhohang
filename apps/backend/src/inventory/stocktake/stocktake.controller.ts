import { Body, Controller, Delete, Get, Param, Patch, Post, Req, ForbiddenException, Query, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StocktakeService } from './stocktake.service';
import { CreateStocktakeDto } from './dto/create-stocktake.dto';
import { AddStocktakeDetailDto } from './dto/add-stocktake-detail.dto';
import { UpdateCountDto } from './dto/update-count.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

function getUserFromRequest(req: Request) {
  const userHeader = req.headers['x-user'] as string | undefined;
  if (userHeader) {
    try { return JSON.parse(userHeader); } catch { /* ignore */ }
  }
  return (req as any).user || {};
}

function getRoleFromRequest(req: Request): string {
  const user = getUserFromRequest(req);
  if (user.role) return user.role;
  const roleHeader = req.headers['x-role'] as string | undefined;
  return roleHeader || '';
}

function getPermissionsFromRequest(req: Request): string[] {
  const permsHeader = req.headers['x-permissions'] || getUserFromRequest(req)?.permissions;
  return Array.isArray(permsHeader) ? permsHeader : String(permsHeader || '').split(',').map((s) => s.trim()).filter(Boolean);
}

function getUserIdentifier(req: Request): string {
  const user = getUserFromRequest(req);
  return user.fullName || user.email || '';
}

@Controller('inventory/stocktakes')
@UseGuards(JwtAuthGuard)
export class StocktakeController {
  constructor(private readonly service: StocktakeService) {}

  @Post()
  create(@Body() dto: CreateStocktakeDto, @Req() req: Request) {
    const role = getRoleFromRequest(req);
    const userIdentifier = getUserIdentifier(req);

    // Staff: bắt buộc isRequest = true, assignee = chính mình
    if (role === 'staff') {
      dto.isRequest = true;
      dto.assignee = userIdentifier;
      dto.createdBy = userIdentifier;
    }

    return this.service.create(dto);
  }

  @Get()
  findAll(@Req() req: Request) {
    const role = getRoleFromRequest(req);
    if (role !== 'manager' && role !== 'admin') {
      throw new ForbiddenException('Chỉ quản lý mới có quyền xem toàn bộ kiểm kê');
    }
    return this.service.findAll();
  }

  @Get('my-tasks')
  findMyTasks(@Req() req: Request) {
    const userIdentifier = getUserIdentifier(req);
    if (!userIdentifier) {
      return [];
    }
    return this.service.findMyTasks(userIdentifier);
  }

  @Get('requests')
  findRequests(@Req() req: Request) {
    const role = getRoleFromRequest(req);
    // Chỉ manager/admin mới xem được danh sách yêu cầu
    if (role !== 'manager' && role !== 'admin') {
      throw new ForbiddenException('Chỉ quản lý mới có quyền xem yêu cầu kiểm kê');
    }
    return this.service.findRequests();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/details')
  addDetail(@Param('id') id: string, @Body() dto: AddStocktakeDetailDto) {
    return this.service.addDetail(id, dto);
  }

  @Delete('details/:detailId')
  removeDetail(@Param('detailId') detailId: string) {
    return this.service.removeDetail(detailId);
  }

  @Patch('details/:detailId/count')
  updateCount(@Param('detailId') detailId: string, @Body() dto: UpdateCountDto) {
    return this.service.updateCount(detailId, dto);
  }

  @Post(':id/finish-counting')
  finishCounting(@Param('id') id: string) {
    return this.service.finishCounting(id);
  }

  @Post(':id/accept')
  acceptRequest(@Param('id') id: string, @Body() body: { acceptedBy?: string }, @Req() req: Request) {
    const role = getRoleFromRequest(req);
    // Chỉ manager/admin mới được tiếp nhận yêu cầu
    if (role !== 'manager' && role !== 'admin') {
      const perms = getPermissionsFromRequest(req);
      if (!perms.includes('stocktake:accept')) {
        throw new ForbiddenException('Không có quyền tiếp nhận yêu cầu kiểm kê');
      }
    }
    return this.service.acceptRequest(id, body?.acceptedBy);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() body: { approvedBy?: string }, @Req() req: Request) {
    const role = getRoleFromRequest(req);
    // Chỉ manager/admin mới được duyệt
    if (role !== 'manager' && role !== 'admin') {
      throw new ForbiddenException('Chỉ quản lý mới có quyền duyệt kiểm kê');
    }
    return this.service.approve(id, body?.approvedBy);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Req() req: Request) {
    const role = getRoleFromRequest(req);
    // Chỉ manager/admin mới được từ chối
    if (role !== 'manager' && role !== 'admin') {
      throw new ForbiddenException('Chỉ quản lý mới có quyền từ chối kiểm kê');
    }
    return this.service.reject(id);
  }
}
