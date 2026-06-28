import { Body, Controller, Delete, Get, Param, Patch, Post, Req, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { StocktakeService } from './stocktake.service';
import { CreateStocktakeDto } from './dto/create-stocktake.dto';
import { AddStocktakeDetailDto } from './dto/add-stocktake-detail.dto';
import { UpdateCountDto } from './dto/update-count.dto';

@Controller('inventory/stocktakes')
export class StocktakeController {
  constructor(private readonly service: StocktakeService) {}

  @Post()
  create(@Body() dto: CreateStocktakeDto, @Req() req: Request) {
    if (dto.isRequest) {
      const permsHeader = req.headers['x-permissions'] || (req as any).user?.permissions;
      const perms = Array.isArray(permsHeader) ? permsHeader : String(permsHeader || '').split(',').map((s) => s.trim()).filter(Boolean);
      if (!perms.includes('stocktake:request')) {
        throw new ForbiddenException('Không có quyền tạo yêu cầu kiểm kê');
      }
    }
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
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
    const permsHeader = req.headers['x-permissions'] || (req as any).user?.permissions;
    const perms = Array.isArray(permsHeader) ? permsHeader : String(permsHeader || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!perms.includes('stocktake:accept')) {
      throw new ForbiddenException('Không có quyền tiếp nhận yêu cầu kiểm kê');
    }
    return this.service.acceptRequest(id, body?.acceptedBy);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() body: { approvedBy?: string }) {
    return this.service.approve(id, body?.approvedBy);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string) {
    return this.service.reject(id);
  }
}
