import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboundOrder } from './entities/outbound-order.entity';
import { OutboundDetail } from './entities/outbound-detail.entity';
import { PickingTask } from './entities/picking-task.entity';
import { CreateOutboundOrderDto } from './dto/create-outbound-order.dto';
import { AddOutboundDetailDto } from './dto/add-outbound-detail.dto';
import { PickDetailDto } from './dto/pick-detail.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { Customer } from '../entities/customer.entity';
import { Product } from '../entities/product.entity';
import { IdempotencyService } from '../erp-integration/idempotency/idempotency.service';
import { OutboxService } from '../erp-integration/outbox/outbox.service';

@Injectable()
export class OutboundService {
  constructor(
    @InjectRepository(OutboundOrder) private orderRepo: Repository<OutboundOrder>,
    @InjectRepository(OutboundDetail) private detailRepo: Repository<OutboundDetail>,
    @InjectRepository(PickingTask) private taskRepo: Repository<PickingTask>,
    @InjectRepository(Customer) private customerRepo: Repository<Customer>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    private readonly outboxService: OutboxService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async createOrder(dto: CreateOutboundOrderDto) {
    const order = this.orderRepo.create({
      expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined,
      status: dto.status || 'CREATED',
    });
    if (dto.customerId) {
      const customer = await this.customerRepo.findOneBy({ id: dto.customerId });
      if (!customer) throw new NotFoundException('Customer not found');
      order.customer = customer;
    }
    return this.orderRepo.save(order);
  }

  async addDetail(orderId: string, dto: AddOutboundDetailDto) {
    const order = await this.orderRepo.findOneBy({ id: orderId });
    if (!order) throw new NotFoundException('Order not found');
    const product = await this.productRepo.findOneBy({ id: dto.productId });
    if (!product) throw new NotFoundException('Product not found');
    const detail = this.detailRepo.create({
      outboundOrder: order as any,
      product,
      requiredQty: dto.requiredQty,
      pickedQty: 0,
    });
    order.status = 'PENDING';
    await this.orderRepo.save(order);
    return this.detailRepo.save(detail);
  }

  async pickDetail(detailId: string, qty: number) {
    const detail = await this.detailRepo.findOne({ where: { id: detailId }, relations: ['outboundOrder'] });
    if (!detail) throw new NotFoundException('Detail not found');
    if (qty <= 0) throw new BadRequestException('Pick quantity must be positive');
    detail.pickedQty += qty;
    if (detail.pickedQty > detail.requiredQty) {
      throw new BadRequestException('Picked quantity cannot exceed required quantity');
    }
    await this.detailRepo.save(detail);
    await this.updateOrderStatus(detail.outboundOrder.id);
    return detail;
  }

  async confirmOrder(orderId: string, idempotencyKey?: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId }, relations: ['details', 'customer'] });
    if (!order) throw new NotFoundException('Order not found');

    if (await this.idempotencyService.isReplay(idempotencyKey)) {
      return {
        order,
        idempotentReplay: true,
      };
    }

    const allPicked = order.details.every((d) => d.pickedQty >= d.requiredQty);
    if (!allPicked) {
      throw new BadRequestException('Cannot confirm order until all items are picked');
    }
    order.status = 'CONFIRMED';
    const savedOrder = await this.orderRepo.save(order);
    const outboxEvent = await this.outboxService.enqueue({
      eventType: 'OUTBOUND_ORDER_CONFIRMED',
      idempotencyKey,
      payload: {
        orderId: savedOrder.id,
        customerId: savedOrder.customer?.id,
        confirmedAt: new Date().toISOString(),
        details: order.details.map((detail) => ({
          detailId: detail.id,
          requiredQty: detail.requiredQty,
          pickedQty: detail.pickedQty,
        })),
      },
    });

    return {
      order: savedOrder,
      outboxEvent,
      idempotentReplay: false,
    };
  }

  async assignTask(dto: AssignTaskDto) {
    const order = await this.orderRepo.findOneBy({ id: dto.orderId });
    if (!order) throw new NotFoundException('Order not found');
    const task = this.taskRepo.create({
      order: order as any,
      assignedTo: dto.assignedTo,
      status: 'ASSIGNED',
    });
    return this.taskRepo.save(task);
  }

  async confirmTask(taskId: string, submittedTaskId: string) {
    if (taskId !== submittedTaskId) {
      throw new BadRequestException('Task ID mismatch');
    }
    const task = await this.taskRepo.findOne({ where: { id: taskId }, relations: ['order'] });
    if (!task) throw new NotFoundException('Task not found');
    task.status = 'COMPLETED';
    await this.taskRepo.save(task);
    const order = await this.orderRepo.findOne({ where: { id: task.order.id }, relations: ['details'] });
    if (order && order.details.every((d) => d.pickedQty >= d.requiredQty)) {
      order.status = 'READY_TO_SHIP';
      await this.orderRepo.save(order);
    }
    return task;
  }

  async findAllOrders() {
    return this.orderRepo.find({ relations: ['customer', 'details', 'details.product'] });
  }

  async findOrder(id: string) {
    const order = await this.orderRepo.findOne({ where: { id }, relations: ['customer', 'details', 'details.product'] });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async findTasks() {
    return this.taskRepo.find({ relations: ['order'] });
  }

  private async updateOrderStatus(orderId: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId }, relations: ['details'] });
    if (!order) return;
    const allPicked = order.details.every((d) => d.pickedQty >= d.requiredQty);
    order.status = allPicked ? 'PICKED' : 'PICKING';
    await this.orderRepo.save(order);
  }
}
