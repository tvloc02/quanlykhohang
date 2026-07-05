import { Controller, Get, UseGuards, Request, Put, Body, Param, Post, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CustomerPortalService } from './customer-portal.service';
import { CreateOutboundOrderDto } from '../outbound/dto/create-outbound-order.dto';

@Controller('customer-portal')
@UseGuards(JwtAuthGuard)
export class CustomerPortalController {
  constructor(private readonly service: CustomerPortalService) {}

  @Get('me')
  async getProfile(@Request() req: any) {
    const customerId = req.user?.customerId;
    if (!customerId) throw new UnauthorizedException('User is not linked to a customer account');
    return this.service.getProfile(customerId);
  }

  @Put('me')
  async updateProfile(@Request() req: any, @Body() dto: any) {
    const customerId = req.user?.customerId;
    if (!customerId) throw new UnauthorizedException('User is not linked to a customer account');
    return this.service.updateProfile(customerId, dto);
  }

  @Get('stock-availability')
  async getStockAvailability() {
    return this.service.getStockAvailability();
  }

  @Get('orders')
  async getOrders(@Request() req: any) {
    const customerId = req.user?.customerId;
    if (!customerId) throw new UnauthorizedException('User is not linked to a customer account');
    return this.service.getOrders(customerId);
  }

  @Get('orders/:id')
  async getOrder(@Request() req: any, @Param('id') id: string) {
    const customerId = req.user?.customerId;
    if (!customerId) throw new UnauthorizedException('User is not linked to a customer account');
    return this.service.getOrder(customerId, id);
  }

  @Post('orders')
  async createOrder(@Request() req: any, @Body() dto: CreateOutboundOrderDto) {
    const customerId = req.user?.customerId;
    if (!customerId) throw new UnauthorizedException('User is not linked to a customer account');
    
    // Force the order to be created for this customer
    dto.customerId = customerId;
    return this.service.createOrder(dto);
  }
}
