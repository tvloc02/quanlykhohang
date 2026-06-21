import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateStockBalanceDto } from './dto/create-stock-balance.dto';
import { AllocateStockDto } from './dto/allocate-stock.dto';
import { ReleaseStockDto } from './dto/release-stock.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';

@Controller('inventory')
export class InventoryController {
  constructor(private service: InventoryService) {}

  @Post('balances')
  createBalance(@Body() dto: CreateStockBalanceDto) {
    return this.service.createBalance(dto);
  }

  @Get('balances')
  findAllBalances() {
    return this.service.findAll();
  }

  @Get('balances/:id')
  findBalance(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post('balances/:id/allocate')
  allocate(@Param('id') id: string, @Body() dto: AllocateStockDto) {
    return this.service.allocate(id, dto);
  }

  @Post('balances/:id/release')
  release(@Param('id') id: string, @Body() dto: ReleaseStockDto) {
    return this.service.release(id, dto);
  }

  @Post('balances/:id/adjust')
  adjust(@Param('id') id: string, @Body() dto: AdjustStockDto) {
    return this.service.adjust(id, dto);
  }
}
