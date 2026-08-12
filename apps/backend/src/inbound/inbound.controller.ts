import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { InboundService } from './inbound.service';
import { CreateAsnDto } from './dto/create-asn.dto';
import { AddDetailDto } from './dto/add-detail.dto';
import { ReceiveDto } from './dto/receive.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller(['inbound', 'inbound/purchase-orders', 'inbound/stock-in-orders'])
export class InboundController {
  constructor(private svc: InboundService) {}

  @Get('purchase-orders')
  findPurchaseOrders(@Req() req: any) {
    return this.svc.findPurchaseOrders(req.user);
  }

  @Post('purchase-orders')
  createPurchaseOrder(@Body() dto: CreateAsnDto, @Req() req: any) {
    return this.svc.createPurchaseOrder(dto, req.user);
  }

  @Get('purchase-orders/:id')
  findPurchaseOrder(@Param('id') id: string, @Req() req: any) {
    return this.svc.findPurchaseOrder(id, req.user);
  }

  @Put('purchase-orders/:id')
  updatePurchaseOrder(@Param('id') id: string, @Body() dto: CreateAsnDto, @Req() req: any) {
    return this.svc.updatePurchaseOrder(id, dto, req.user);
  }

  @Delete('purchase-orders/:id')
  removePurchaseOrder(@Param('id') id: string, @Req() req: any) {
    return this.svc.removeReceipt(id, req.user);
  }

  @Post('purchase-orders/:id/approve')
  @Roles('admin', 'manager')
  approvePurchaseOrder(@Param('id') id: string, @Req() req: any) {
    return this.svc.approveReceipt(id, req.user);
  }

  @Post('purchase-orders/:id/supplier-approve')
  @Roles('supplier')
  approvePurchaseOrderBySupplier(@Param('id') id: string, @Body() body: { expectedDate?: string; description?: string }, @Req() req: any) {
    return this.svc.supplierApproveReceipt(id, body, req.user);
  }

  @Post('purchase-orders/:id/supplier-reject')
  @Roles('supplier')
  rejectPurchaseOrderBySupplier(@Param('id') id: string, @Body() body: { reason?: string }, @Req() req: any) {
    return this.svc.supplierRejectReceipt(id, body, req.user);
  }

  @Post('purchase-orders/:id/supplier-negotiate')
  @Roles('supplier', 'admin', 'manager')
  negotiatePurchaseOrderBySupplier(
    @Param('id') id: string,
    @Body() body: { items?: Array<{ detailId: string; supplierPrice: number }>; reason?: string },
    @Req() req: any,
  ) {
    return this.svc.supplierNegotiateReceipt(id, body, req.user);
  }

  @Post('purchase-orders/:id/price-feedback')
  @Roles('admin', 'manager')
  enterprisePriceFeedback(
    @Param('id') id: string,
    @Body() body: { items?: Array<{ detailId: string; newPrice: number }>; note?: string; acceptedSupplierPrice?: boolean },
    @Req() req: any,
  ) {
    return this.svc.enterprisePriceFeedback(id, body, req.user);
  }

  @Post('purchase-orders/:id/complete')
  @Roles('admin', 'manager')
  completePurchaseOrder(@Param('id') id: string, @Req() req: any) {
    return this.svc.completeReceipt(id, req.user);
  }

  @Post('purchase-orders/:id/details')
  @Roles('admin', 'manager', 'staff')
  addDetail(@Param('id') id: string, @Body() dto: AddDetailDto, @Req() req: any) {
    return this.svc.addDetail(id, dto, req.user);
  }

  @Post('purchase-orders/details/:detailId/receive')
  @Roles('admin', 'manager', 'staff')
  receive(@Param('detailId') detailId: string, @Body() dto: ReceiveDto, @Req() req: any) {
    return this.svc.receive(detailId, dto, req.user);
  }

  @Post()
  @Roles('admin', 'manager', 'supplier')
  create(@Body() dto: CreateAsnDto, @Req() req: any) {
    return this.svc.createReceipt(dto, req.user);
  }

  @Get()
  @Roles('admin', 'manager', 'staff', 'supplier')
  findAll(@Req() req: any) {
    return this.svc.findAll(req.user);
  }

  @Put('legacy/:id')
  @Roles('admin', 'manager', 'supplier')
  update(@Param('id') id: string, @Body() dto: CreateAsnDto, @Req() req: any) {
    return this.svc.updateReceipt(id, dto, req.user);
  }

  @Delete('legacy/:id')
  @Roles('admin', 'manager')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.svc.removeReceipt(id, req.user);
  }

  @Get('legacy/:id')
  @Roles('admin', 'manager', 'staff', 'supplier')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.svc.findOne(id, req.user);
  }
}

