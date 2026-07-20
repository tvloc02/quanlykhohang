import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OutboundOrder } from './entities/outbound-order.entity';
import { OutboundDetail } from './entities/outbound-detail.entity';
import { PickingTask } from './entities/picking-task.entity';
import { CreateOutboundOrderDto, OutboundItemDto } from './dto/create-outbound-order.dto';
import { AddOutboundDetailDto } from './dto/add-outbound-detail.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { Customer } from '../entities/customer.entity';
import { Product } from '../entities/product.entity';
import { StockBalance } from '../inventory/entities/stock-balance.entity';
import { IdempotencyService } from '../erp-integration/idempotency/idempotency.service';
import { OutboxService } from '../erp-integration/outbox/outbox.service';

type SerializedOutbound = {
  id: string;
  orderNo: string;
  customer: string;
  dueDate: string;
  status: string;
  description?: string;
  items: number;
  details: Array<{
    id: string;
    warehouseCode?: string;
    requiredQty: number;
    pickedQty: number;
    unitPrice: number;
    totalLineAmount: number;
    product?: {
      id: string;
      internalSku: string;
      name: string;
      unit?: string;
    } | null;
  }>;
};

function parseNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateString(value?: Date | string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

@Injectable()
export class OutboundService {
  constructor(
    @InjectRepository(OutboundOrder) private orderRepo: Repository<OutboundOrder>,
    @InjectRepository(OutboundDetail) private detailRepo: Repository<OutboundDetail>,
    @InjectRepository(PickingTask) private taskRepo: Repository<PickingTask>,
    @InjectRepository(Customer) private customerRepo: Repository<Customer>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(StockBalance) private balanceRepo: Repository<StockBalance>,
    private readonly outboxService: OutboxService,
    private readonly idempotencyService: IdempotencyService,
    private readonly dataSource: DataSource,
  ) {}

  // ─── CRUD ──────────────────────────────────────────────────────

  async createOutbound(dto: CreateOutboundOrderDto) {
    const orderNo = await this.generateOrderNo(dto.orderNo);

    const order = this.orderRepo.create({
      orderNo,
      expectedDate: (dto.expectedDate || dto.dueDate) ? new Date(dto.expectedDate || dto.dueDate!) : undefined,
      status: dto.status || 'pending',
      description: dto.description?.trim() || undefined,
      items: dto.items ?? dto.details?.length ?? 0,
    });

    // Attach customer by id or name
    if (dto.customerId) {
      const customer = await this.customerRepo.findOneBy({ id: dto.customerId });
      if (!customer) throw new NotFoundException('Customer not found');
      order.customer = customer;
    } else if (dto.customer) {
      // Try find existing customer by name, or create a stub
      let customer = await this.customerRepo.findOneBy({ name: dto.customer.trim() });
      if (!customer) {
        customer = this.customerRepo.create({ name: dto.customer.trim() });
        customer = await this.customerRepo.save(customer);
      }
      order.customer = customer;
    }

    const savedOrder = await this.orderRepo.save(order);

    // Persist detail items if provided
    if (dto.details?.length) {
      await this.persistDetails(savedOrder.id, dto.details);
      // US03.01: Reserve inventory — chuyển available sang allocated
      await this.reserveInventory(savedOrder.id);
    }

    return this.serializeOutbound(await this.findOrderEntity(savedOrder.id));
  }

  async updateOutbound(id: string, dto: CreateOutboundOrderDto) {
    const order = await this.findOrderEntity(id);

    // Update orderNo if provided and different
    if (dto.orderNo && dto.orderNo !== order.orderNo) {
      const nextNo = dto.orderNo.trim().toUpperCase();
      const dup = await this.orderRepo.findOne({ where: { orderNo: nextNo } });
      if (dup && dup.id !== order.id) {
        throw new BadRequestException('Mã đơn xuất đã tồn tại');
      }
      order.orderNo = nextNo;
    }

    // Update customer
    if (dto.customerId) {
      const customer = await this.customerRepo.findOneBy({ id: dto.customerId });
      if (!customer) throw new NotFoundException('Customer not found');
      order.customer = customer;
    } else if (dto.customer) {
      let customer = await this.customerRepo.findOneBy({ name: dto.customer.trim() });
      if (!customer) {
        customer = this.customerRepo.create({ name: dto.customer.trim() });
        customer = await this.customerRepo.save(customer);
      }
      order.customer = customer;
    }

    if (dto.expectedDate || dto.dueDate) {
      order.expectedDate = new Date(dto.expectedDate || dto.dueDate!);
    }
    if (dto.status) {
      order.status = dto.status;
    }
    if (dto.description !== undefined) {
      order.description = dto.description.trim() || undefined;
    }
    if (dto.items !== undefined) {
      order.items = dto.items;
    }

    // Replace details if provided
    if (dto.details?.length) {
      const existing = await this.detailRepo.find({
        where: { outboundOrder: { id } as any },
        relations: ['outboundOrder', 'product'],
      });
      if (existing.length) {
        await this.detailRepo.remove(existing);
      }
      await this.persistDetails(id, dto.details);
    }

    await this.orderRepo.save(order);
    return this.serializeOutbound(await this.findOrderEntity(id));
  }

  async removeOutbound(id: string) {
    const order = await this.findOrderEntity(id);

    // US03.01: Giải phóng reserved trước khi xóa (chỉ nếu chưa shipped)
    if (order.status !== 'shipped') {
      await this.releaseInventory(order);
    }

    // Delete details first
    const details = await this.detailRepo.find({
      where: { outboundOrder: { id } as any },
      relations: ['outboundOrder', 'product'],
    });
    if (details.length) {
      await this.detailRepo.remove(details);
    }

    // Delete tasks
    const tasks = await this.taskRepo.find({
      where: { order: { id } as any },
      relations: ['order'],
    });
    if (tasks.length) {
      await this.taskRepo.remove(tasks);
    }

    await this.orderRepo.remove(order);
    return { deleted: true };
  }

  async findAll() {
    const orders = await this.orderRepo.find({
      relations: ['customer', 'details', 'details.product'],
      order: { id: 'DESC' },
    });
    return orders.map((o) => this.serializeOutbound(o));
  }

  async findOne(id: string) {
    return this.serializeOutbound(await this.findOrderEntity(id));
  }

  // ─── CONFIRM (ACID trừ tồn kho — US03.05) ─────────────────────

  async confirmOutbound(id: string, idempotencyKey?: string) {
    const order = await this.findOrderEntity(id);

    if (await this.idempotencyService.isReplay(idempotencyKey)) {
      return { order: this.serializeOutbound(order), idempotentReplay: true };
    }

    // Bọc toàn bộ logic trong Database Transaction
    const result = await this.dataSource.transaction(async (manager) => {
      // 1. Cập nhật trạng thái đơn hàng
      order.status = 'shipped';
      const savedOrder = await manager.save(OutboundOrder, order);

      // 2. Trừ tồn kho cho từng detail trong transaction
      for (const detail of order.details || []) {
        const locCode = detail.warehouseCode || 'DEFAULT';
        const balance = await manager.findOne(StockBalance, {
          where: { product: { id: detail.product.id } as any, locationCode: locCode },
          relations: ['product'],
        });

        if (balance) {
          balance.totalPhysical -= detail.pickedQty;
          balance.allocated -= detail.requiredQty;
          balance.available = Math.max(balance.totalPhysical - balance.allocated, 0);
          await manager.save(StockBalance, balance);
        }
      }

      return savedOrder;
    });

    // 3. Ghi sự kiện Outbox (ngoài transaction chính vì outbox có lifecycle riêng)
    const outboxEvent = await this.outboxService.enqueue({
      eventType: 'OUTBOUND_ORDER_CONFIRMED',
      idempotencyKey,
      payload: {
        orderId: result.id,
        customerId: order.customer?.id,
        confirmedAt: new Date().toISOString(),
        details: (order.details || []).map((d) => ({
          detailId: d.id,
          requiredQty: d.requiredQty,
          pickedQty: d.pickedQty,
        })),
      },
    });

    return {
      order: this.serializeOutbound(await this.findOrderEntity(id)),
      outboxEvent,
      idempotentReplay: false,
    };
  }

  // ─── PICKING FLOW (giữ nguyên) ────────────────────────────────

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
    order.status = 'pending';
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
    return this.findAll();
  }

  async findOrder(id: string) {
    return this.findOne(id);
  }

  async findTasks() {
    return this.taskRepo.find({ relations: ['order'] });
  }

  // ─── PRIVATE HELPERS ──────────────────────────────────────────

  private async findOrderEntity(id: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['customer', 'details', 'details.product'],
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private async persistDetails(orderId: string, items: OutboundItemDto[]) {
    const saved: OutboundDetail[] = [];
    for (const item of items) {
      const product = await this.productRepo.findOneBy({ id: item.productId });
      if (!product) throw new NotFoundException(`Product ${item.productId} not found`);

      const unitPrice = parseNumber(item.unitPrice);
      const detail = this.detailRepo.create({
        outboundOrder: { id: orderId } as OutboundOrder,
        product,
        warehouseCode: item.warehouseCode?.trim() || undefined,
        requiredQty: item.requiredQty,
        pickedQty: 0,
        unitPrice: unitPrice.toFixed(2),
        totalLineAmount: (unitPrice * item.requiredQty).toFixed(2),
      });
      saved.push(await this.detailRepo.save(detail));
    }
    return saved;
  }

  // US03.01: Giữ chỗ tồn kho khi tạo đơn xuất
  private async reserveInventory(orderId: string) {
    const details = await this.detailRepo.find({
      where: { outboundOrder: { id: orderId } as any },
      relations: ['outboundOrder', 'product'],
    });

    for (const detail of details) {
      const locCode = detail.warehouseCode || 'DEFAULT';
      let balance = await this.balanceRepo.findOne({
        where: { product: { id: detail.product.id } as any, locationCode: locCode },
        relations: ['product'],
      });

      if (!balance) {
        throw new BadRequestException(
          `Sản phẩm "${detail.product.name}" (${detail.product.internalSku}) không có tồn kho tại vị trí ${locCode}`,
        );
      }

      if (balance.available < detail.requiredQty) {
        throw new BadRequestException(
          `Tồn kho không đủ cho "${detail.product.name}" (${detail.product.internalSku}). Khả dụng: ${balance.available}, Yêu cầu: ${detail.requiredQty}`,
        );
      }

      balance.allocated += detail.requiredQty;
      balance.available = balance.totalPhysical - balance.allocated;
      await this.balanceRepo.save(balance);
    }
  }

  // US03.01: Giải phóng tồn kho đã giữ chỗ khi hủy/xóa đơn
  private async releaseInventory(order: OutboundOrder) {
    for (const detail of order.details || []) {
      const locCode = detail.warehouseCode || 'DEFAULT';
      const balance = await this.balanceRepo.findOne({
        where: { product: { id: detail.product.id } as any, locationCode: locCode },
        relations: ['product'],
      });

      if (balance) {
        balance.allocated = Math.max(balance.allocated - detail.requiredQty, 0);
        balance.available = balance.totalPhysical - balance.allocated;
        await this.balanceRepo.save(balance);
      }
    }
  }

  private async updateOrderStatus(orderId: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId }, relations: ['details'] });
    if (!order) return;
    const allPicked = order.details.every((d) => d.pickedQty >= d.requiredQty);
    order.status = allPicked ? 'picking' : 'pending';
    await this.orderRepo.save(order);
  }

  private serializeOutbound(order: OutboundOrder): SerializedOutbound {
    return {
      id: order.id,
      orderNo: order.orderNo || `DXK${String(order.id).padStart(5, '0')}`,
      customer: order.customer?.name || '',
      dueDate: toDateString(order.expectedDate),
      status: order.status || 'pending',
      description: order.description,
      items: order.details?.length || order.items || 0,
      details: (order.details || []).map((d) => ({
        id: d.id,
        warehouseCode: d.warehouseCode,
        requiredQty: d.requiredQty,
        pickedQty: d.pickedQty,
        unitPrice: parseNumber(d.unitPrice),
        totalLineAmount: parseNumber(d.totalLineAmount),
        product: d.product
          ? {
              id: d.product.id,
              internalSku: d.product.internalSku,
              name: d.product.name,
              unit: d.product.unit,
            }
          : null,
      })),
    };
  }

  private async generateOrderNo(preferred?: string) {
    const requested = preferred?.trim().toUpperCase();
    if (requested) {
      const dup = await this.orderRepo.findOne({ where: { orderNo: requested } });
      if (!dup) return requested;
    }

    const total = await this.orderRepo.count();
    let index = total + 1;
    let code = `DXK${String(index).padStart(5, '0')}`;

    while (await this.orderRepo.findOne({ where: { orderNo: code } })) {
      index += 1;
      code = `DXK${String(index).padStart(5, '0')}`;
    }

    return code;
  }
}
