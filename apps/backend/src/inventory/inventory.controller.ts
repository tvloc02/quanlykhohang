import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateStockBalanceDto } from './dto/create-stock-balance.dto';
import { AllocateStockDto } from './dto/allocate-stock.dto';
import { ReleaseStockDto } from './dto/release-stock.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private service: InventoryService) {}

  @Post('balances')
  @Roles('admin', 'manager')
  createBalance(@Body() dto: CreateStockBalanceDto) {
    return this.service.createBalance(dto);
  }

  @Get('balances')
  @Roles('admin', 'manager', 'staff', 'supplier')
  findAllBalances(@Req() req: any) {
    return this.service.findAll(req.user);
  }

  @Get('balances/:id')
  @Roles('admin', 'manager', 'staff', 'supplier')
  findBalance(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user);
  }

  @Post('balances/:id/allocate')
  @Roles('admin', 'manager', 'staff')
  allocate(@Param('id') id: string, @Body() dto: AllocateStockDto) {
    return this.service.allocate(id, dto);
  }

  @Post('balances/:id/release')
  @Roles('admin', 'manager', 'staff')
  release(@Param('id') id: string, @Body() dto: ReleaseStockDto) {
    return this.service.release(id, dto);
  }

  @Post('balances/:id/adjust')
  @Roles('admin', 'manager')
  adjust(@Param('id') id: string, @Body() dto: AdjustStockDto) {
    return this.service.adjust(id, dto);
  }
}
