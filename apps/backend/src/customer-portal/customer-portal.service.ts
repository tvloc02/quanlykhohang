import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../entities/customer.entity';
import { StockBalance } from '../inventory/entities/stock-balance.entity';
import { OutboundOrder } from '../outbound/entities/outbound-order.entity';
import { OutboundService } from '../outbound/outbound.service';
import { CreateOutboundOrderDto } from '../outbound/dto/create-outbound-order.dto';

@Injectable()
export class CustomerPortalService {
  constructor(
    @InjectRepository(Customer) private customerRepo: Repository<Customer>,
    @InjectRepository(StockBalance) private stockBalanceRepo: Repository<StockBalance>,
    @InjectRepository(OutboundOrder) private outboundOrderRepo: Repository<OutboundOrder>,
    private outboundService: OutboundService,
  ) {}

  async getProfile(customerId: string) {
    const profile = await this.customerRepo.findOne({
      where: { id: customerId },
      relations: ['user'],
    });
    if (!profile) throw new NotFoundException('Customer profile not found');
    return profile;
  }

  async updateProfile(customerId: string, dto: any) {
    const profile = await this.getProfile(customerId);
    
    if (dto.contactPerson !== undefined) profile.contactPerson = dto.contactPerson;
    if (dto.phone !== undefined) profile.phone = dto.phone;
    if (dto.email !== undefined) profile.email = dto.email;
    if (dto.address !== undefined) profile.address = dto.address;
    
    await this.customerRepo.save(profile);
    return this.getProfile(customerId);
  }

  async getStockAvailability() {
    // Return aggregated available stock per product
    const balances = await this.stockBalanceRepo.find({
      relations: ['product', 'product.category'],
    });

    // Aggregate by product ID in case there are multiple locations
    const aggregated = new Map();
    for (const balance of balances) {
      if (!balance.product) continue;
      
      const pId = balance.product.id;
      if (!aggregated.has(pId)) {
        aggregated.set(pId, {
          id: pId,
          internalSku: balance.product.internalSku,
          name: balance.product.name,
          unit: balance.product.unit,
          category: balance.product.category?.name,
          available: 0,
        });
      }
      
      const item = aggregated.get(pId);
      item.available += balance.available;
    }
    
    return Array.from(aggregated.values());
  }

  async getOrders(customerId: string) {
    const orders = await this.outboundOrderRepo.find({
      where: { customer: { id: customerId } as any },
      relations: ['details', 'details.product'],
      order: { id: 'DESC' },
    });
    
    // We format it similarly to what outbound service returns so frontend can reuse components
    return orders.map(o => ({
      id: o.id,
      orderNo: o.orderNo,
      expectedDate: o.expectedDate,
      status: o.status,
      description: o.description,
      items: o.items || o.details?.length || 0,
      createdAt: o.expectedDate || new Date().toISOString(),
      details: o.details?.map(d => ({
        id: d.id,
        requiredQty: d.requiredQty,
        pickedQty: d.pickedQty,
        unitPrice: d.unitPrice,
        totalLineAmount: d.totalLineAmount,
        product: d.product ? {
          id: d.product.id,
          internalSku: d.product.internalSku,
          name: d.product.name,
          unit: d.product.unit,
        } : null
      }))
    }));
  }

  async getOrder(customerId: string, orderId: string) {
    const order = await this.outboundOrderRepo.findOne({
      where: { id: orderId, customer: { id: customerId } as any },
      relations: ['details', 'details.product'],
    });
    
    if (!order) throw new NotFoundException('Order not found');
    
    return {
      id: order.id,
      orderNo: order.orderNo,
      expectedDate: order.expectedDate,
      status: order.status,
      description: order.description,
      items: order.items || order.details?.length || 0,
      createdAt: order.expectedDate || new Date().toISOString(),
      details: order.details?.map(d => ({
        id: d.id,
        requiredQty: d.requiredQty,
        pickedQty: d.pickedQty,
        unitPrice: d.unitPrice,
        totalLineAmount: d.totalLineAmount,
        product: d.product ? {
          id: d.product.id,
          internalSku: d.product.internalSku,
          name: d.product.name,
          unit: d.product.unit,
        } : null
      }))
    };
  }

  async createOrder(dto: CreateOutboundOrderDto) {
    // Utilize the existing outbound service to create the order
    // ensuring consistency with the standard workflow
    dto.status = 'pending'; 
    return this.outboundService.createOutbound(dto);
  }
}
