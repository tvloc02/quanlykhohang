import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateStockInReceiptDto } from './dto/create-stock-in-receipt.dto';
import { UpdateStockInReceiptDto } from './dto/update-stock-in-receipt.dto';
import { StockInReceiptsService } from './stock-in-receipts.service';

@Controller('inbound/stock-in-receipts')
@UseGuards(JwtAuthGuard)
export class StockInReceiptsController {
  constructor(private readonly service: StockInReceiptsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateStockInReceiptDto, @CurrentUser() user: { id?: string; email?: string }) {
    return this.service.create(dto, user);
  }

  @Post('from-stock-in-orders/:sourceStockInOrderId')
  createFromStockInOrder(
    @Param('sourceStockInOrderId') sourceStockInOrderId: string,
    @Body() dto: CreateStockInReceiptDto,
    @CurrentUser() user: { id?: string; email?: string },
  ) {
    return this.service.createFromStockInOrder(sourceStockInOrderId, dto, user);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStockInReceiptDto, @CurrentUser() user: { id?: string; email?: string }) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/post')
  post(@Param('id') id: string, @CurrentUser() user: { id?: string; email?: string }) {
    return this.service.post(id, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
