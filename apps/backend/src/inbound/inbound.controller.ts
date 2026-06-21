import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { InboundService } from './inbound.service';
import { CreateAsnDto } from './dto/create-asn.dto';
import { AddDetailDto } from './dto/add-detail.dto';
import { ReceiveDto } from './dto/receive.dto';

@Controller('inbound')
export class InboundController {
  constructor(private svc: InboundService) {}

  @Post()
  create(@Body() dto: CreateAsnDto) {
    return this.svc.createReceipt(dto);
  }

  @Get('purchase-orders')
  findPurchaseOrders() {
    return this.svc.findPurchaseOrders();
  }

  @Post('purchase-orders')
  createPurchaseOrder(@Body() dto: CreateAsnDto) {
    return this.svc.createPurchaseOrder(dto);
  }

  @Get('purchase-orders/:id')
  findPurchaseOrder(@Param('id') id: string) {
    return this.svc.findPurchaseOrder(id);
  }

  @Put('purchase-orders/:id')
  updatePurchaseOrder(@Param('id') id: string, @Body() dto: CreateAsnDto) {
    return this.svc.updatePurchaseOrder(id, dto);
  }

  @Delete('purchase-orders/:id')
  removePurchaseOrder(@Param('id') id: string) {
    return this.svc.removeReceipt(id);
  }

  @Post('purchase-orders/:id/approve')
  approvePurchaseOrder(@Param('id') id: string) {
    return this.svc.approveReceipt(id);
  }

  @Post('purchase-orders/:id/complete')
  completePurchaseOrder(@Param('id') id: string) {
    return this.svc.completeReceipt(id);
  }

  @Post('purchase-orders/:id/details')
  addDetail(@Param('id') id: string, @Body() dto: AddDetailDto) {
    return this.svc.addDetail(id, dto);
  }

  @Post('purchase-orders/details/:detailId/receive')
  receive(@Param('detailId') detailId: string, @Body() dto: ReceiveDto) {
    return this.svc.receive(detailId, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Get()
  findAll() {
    return this.svc.findAll();
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: CreateAsnDto) {
    return this.svc.updateReceipt(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.removeReceipt(id);
  }
}
