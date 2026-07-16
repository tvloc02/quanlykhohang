import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateStockInOrderDto } from './dto/create-stock-in-order.dto';
import { UpdateStockInOrderDto } from './dto/update-stock-in-order.dto';
import { CompleteStockInOrderDto } from './dto/complete-stock-in-order.dto';
import { TransitionStockInOrderDto } from './dto/transition-stock-in-order.dto';
import { StockInOrdersService } from './stock-in-orders.service';

@Controller('inbound/stock-in-orders')
@UseGuards(JwtAuthGuard)
export class StockInOrdersController {
  constructor(private readonly service: StockInOrdersService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post('from-purchase-orders/:sourcePurchaseOrderId')
  createFromPurchaseOrder(
    @Param('sourcePurchaseOrderId') sourcePurchaseOrderId: string,
    @Body() dto: CreateStockInOrderDto,
    @CurrentUser() user: { id?: string; email?: string },
  ) {
    return this.service.createFromPurchaseOrder(sourcePurchaseOrderId, dto, user);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStockInOrderDto, @CurrentUser() user: { id?: string; email?: string }) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/transition')
  transition(
    @Param('id') id: string,
    @Body() dto: TransitionStockInOrderDto,
    @CurrentUser() user: { id?: string; email?: string },
  ) {
    return this.service.transition(id, dto, user);
  }

  @Post(':id/complete')
  complete(
    @Param('id') id: string,
    @Body() dto: CompleteStockInOrderDto,
    @CurrentUser() user: { id?: string; email?: string },
  ) {
    return this.service.complete(id, dto, user);
  }

  @Post(':id/details/:detailId/distribute')
  distribute(
    @Param('id') id: string,
    @Param('detailId') detailId: string,
    @Body() dto: { qty: number },
    @CurrentUser() user: { id?: string; email?: string },
  ) {
    return this.service.distribute(id, detailId, dto as any, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
