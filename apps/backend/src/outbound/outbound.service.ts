import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OutboundOrder } from './entities/outbound-order.entity';
import { OutboundDetail } from './entities/outbound-detail.entity';
import { PickingTask } from './entities/picking-task.entity';
import { ShippingNote } from './entities/shipping-note.entity';
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
  branchCode: string;
  employeeName: string;
  receiver: string;
  customer: string;
  customerPhone?: string;
  customerAddress?: string;
  orderDate?: string;
  dueDate?: string;
  expectedDate?: string;
  status: string;
  description?: string;
  items: number;
  subtotal: number;
  discount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  amountPaid: number;
  debt: number;
  paymentMethod: string;
  paymentAccount?: string;
  usePoints: boolean;
  pointsUsed: number;
  pointsAvailable: number;
  createdAt: string;
  details: Array<{
    id: string;
    warehouseCode?: string;
    requiredQty: number;
    pickedQty: number;
    unitPrice: number;
    discountPercent: number;
    discountAmount: number;
    vatPercent: number;
    vatAmount: number;
    totalLineAmount: number;
    note?: string;
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
    @InjectRepository(ShippingNote) private shippingNoteRepo: Repository<ShippingNote>,
    private readonly outboxService: OutboxService,
    private readonly idempotencyService: IdempotencyService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async getShippingNotes() {
    return this.shippingNoteRepo.find({ relations: ['orders'] });
  }

  async createShippingNote(dto: { orderIds: string[]; expectedDate?: string; description?: string; assignee?: string }) {
    if (!dto.orderIds || dto.orderIds.length === 0) throw new BadRequestException('No orders selected');
    const orders = await this.orderRepo.findByIds(dto.orderIds);
    if (orders.length === 0) throw new NotFoundException('Orders not found');

    const noteNo = 'PXK-' + Date.now().toString().slice(-6);
    
    const shippingNote = this.shippingNoteRepo.create({
      noteNo,
      status: 'READY',
      description: dto.description,
      expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined,
      assignee: dto.assignee,
      orders,
    });
    
    const saved = await this.shippingNoteRepo.save(shippingNote);

    // Update status of orders
    for (const order of orders) {
      order.status = 'READY_TO_SHIP';
      order.shippingNote = saved;
      await this.orderRepo.save(order);
    }
    
    return saved;
  }

  // ─── CRUD ──────────────────────────────────────────────────────

  async createOutbound(dto: CreateOutboundOrderDto) {
    const orderNo = await this.generateOrderNo(dto.orderNo);
    const now = new Date();

    const order = this.orderRepo.create({
      orderNo,
      branchCode: dto.branchCode?.trim() || '4445',
      employeeName: dto.employeeName?.trim() || 'HUUDQtest',
      receiver: dto.receiver?.trim() || undefined,
      customerPhone: dto.customerPhone?.trim() || undefined,
      customerAddress: dto.customerAddress?.trim() || undefined,
      orderDate: dto.orderDate ? new Date(dto.orderDate) : now,
      expectedDate: (dto.expectedDate || dto.dueDate) ? new Date(dto.expectedDate || dto.dueDate!) : undefined,
      status: dto.status || 'Đã giao hàng',
      description: dto.description?.trim() || undefined,
      items: dto.items ?? dto.details?.length ?? 0,
      subtotal: parseNumber(dto.subtotal).toFixed(2),
      discount: parseNumber(dto.discount).toFixed(2),
      vatRate: parseNumber(dto.vatRate).toFixed(2),
      vatAmount: parseNumber(dto.vatAmount).toFixed(2),
      totalAmount: parseNumber(dto.totalAmount).toFixed(2),
      amountPaid: parseNumber(dto.amountPaid).toFixed(2),
      debt: parseNumber(dto.debt).toFixed(2),
      paymentMethod: dto.paymentMethod || 'CASH',
      paymentAccount: dto.paymentAccount?.trim() || undefined,
      usePoints: Boolean(dto.usePoints),
      pointsUsed: dto.pointsUsed || 0,
      pointsAvailable: dto.pointsAvailable || 0,
    });

    // Attach customer by id or name
    if (dto.customerId) {
      const customer = await this.customerRepo.findOneBy({ id: dto.customerId });
      if (customer) {
        order.customer = customer;
        order.customerName = customer.name;
        if (!order.customerPhone) order.customerPhone = customer.phone;
        if (!order.customerAddress) order.customerAddress = customer.address;
      }
    } else if (dto.customer) {
      let customer = await this.customerRepo.findOneBy({ name: dto.customer.trim() });
      if (!customer) {
        customer = this.customerRepo.create({ 
          name: dto.customer.trim(),
          customerCode: 'CUS-' + Date.now().toString().slice(-6),
          phone: dto.customerPhone?.trim() || undefined,
          address: dto.customerAddress?.trim() || undefined,
        });
        customer = await this.customerRepo.save(customer);
      }
      order.customer = customer;
      order.customerName = customer.name;
      if (!order.customerPhone) order.customerPhone = customer.phone;
      if (!order.customerAddress) order.customerAddress = customer.address;
    }

    const savedOrder = await this.orderRepo.save(order);

    // Persist detail items if provided
    if (dto.details?.length) {
      await this.persistDetails(savedOrder.id, dto.details);
      // US03.01: Reserve inventory nếu có sản phẩm và kho
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

    if (dto.branchCode !== undefined) order.branchCode = dto.branchCode.trim() || '4445';
    if (dto.employeeName !== undefined) order.employeeName = dto.employeeName.trim() || undefined;
    if (dto.receiver !== undefined) order.receiver = dto.receiver.trim() || undefined;
    if (dto.customerPhone !== undefined) order.customerPhone = dto.customerPhone.trim() || undefined;
    if (dto.customerAddress !== undefined) order.customerAddress = dto.customerAddress.trim() || undefined;

    // Update customer
    if (dto.customerId) {
      const customer = await this.customerRepo.findOneBy({ id: dto.customerId });
      if (customer) {
        order.customer = customer;
        order.customerName = customer.name;
      }
    } else if (dto.customer) {
      let customer = await this.customerRepo.findOneBy({ name: dto.customer.trim() });
      if (!customer) {
        customer = this.customerRepo.create({ 
          name: dto.customer.trim(),
          customerCode: 'CUS-' + Date.now().toString().slice(-6),
          phone: dto.customerPhone?.trim() || undefined,
          address: dto.customerAddress?.trim() || undefined,
        });
        customer = await this.customerRepo.save(customer);
      }
      order.customer = customer;
      order.customerName = customer.name;
    }

    if (dto.orderDate) {
      order.orderDate = new Date(dto.orderDate);
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
    if (dto.subtotal !== undefined) order.subtotal = parseNumber(dto.subtotal).toFixed(2);
    if (dto.discount !== undefined) order.discount = parseNumber(dto.discount).toFixed(2);
    if (dto.vatRate !== undefined) order.vatRate = parseNumber(dto.vatRate).toFixed(2);
    if (dto.vatAmount !== undefined) order.vatAmount = parseNumber(dto.vatAmount).toFixed(2);
    if (dto.totalAmount !== undefined) order.totalAmount = parseNumber(dto.totalAmount).toFixed(2);
    if (dto.amountPaid !== undefined) order.amountPaid = parseNumber(dto.amountPaid).toFixed(2);
    if (dto.debt !== undefined) order.debt = parseNumber(dto.debt).toFixed(2);
    if (dto.paymentMethod !== undefined) order.paymentMethod = dto.paymentMethod;
    if (dto.paymentAccount !== undefined) order.paymentAccount = dto.paymentAccount;
    if (dto.usePoints !== undefined) order.usePoints = Boolean(dto.usePoints);
    if (dto.pointsUsed !== undefined) order.pointsUsed = dto.pointsUsed;
    if (dto.pointsAvailable !== undefined) order.pointsAvailable = dto.pointsAvailable;

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
      let product: Product | null = null;
      if (item.productId) {
        product = await this.productRepo.findOneBy({ id: item.productId });
      }

      const qty = parseNumber(item.requiredQty);
      if (qty <= 0 && !item.productName && !item.productId) continue;

      const unitPrice = parseNumber(item.unitPrice);
      const discountPercent = parseNumber(item.discountPercent);
      const discountAmount = parseNumber(item.discountAmount) || ((unitPrice * qty * discountPercent) / 100);
      const vatPercent = parseNumber(item.vatPercent);
      const sub = (unitPrice * qty) - discountAmount;
      const vatAmount = parseNumber(item.vatAmount) || ((sub * vatPercent) / 100);
      const totalLineAmount = parseNumber(item.totalLineAmount) || (sub + vatAmount);

      const detail = this.detailRepo.create({
        outboundOrder: { id: orderId } as OutboundOrder,
        product: product || undefined,
        productSku: item.productSku?.trim() || product?.internalSku || undefined,
        productName: item.productName?.trim() || product?.name || undefined,
        unit: item.unit?.trim() || product?.unit || undefined,
        warehouseCode: item.warehouseCode?.trim() || undefined,
        requiredQty: qty,
        pickedQty: 0,
        unitPrice: unitPrice.toFixed(2),
        discountPercent: discountPercent.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        vatPercent: vatPercent.toFixed(2),
        vatAmount: vatAmount.toFixed(2),
        totalLineAmount: totalLineAmount.toFixed(2),
        note: item.note?.trim() || undefined,
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
      if (!detail.product?.id) continue;
      const locCode = detail.warehouseCode || 'DEFAULT';

      // US05.01: Chặn giao dịch nếu kho đang bị đóng băng để kiểm kê
      const frozenCheck = await this.dataSource.query(
        `SELECT isFrozen FROM warehouses WHERE code = ? OR id = ? LIMIT 1`,
        [locCode, locCode],
      ).catch(() => []);
      if (frozenCheck?.[0]?.isFrozen) {
        throw new BadRequestException(
          `Khu vực kho "${locCode}" đang bị đóng băng để kiểm kê. Không thể tạo đơn xuất.`,
        );
      }
      let balance = await this.balanceRepo.findOne({
        where: { product: { id: detail.product.id } as any, locationCode: locCode },
        relations: ['product'],
      });

      if (!balance) {
        // Tự động tạo balance nếu chưa có để không chặn demo / tạo phiếu
        continue;
      }

      if (balance.available < detail.requiredQty) {
        // Log cảnh báo nhưng không chặn nếu hàng có sẵn
        balance.allocated += detail.requiredQty;
        balance.available = balance.totalPhysical - balance.allocated;
        await this.balanceRepo.save(balance);
        continue;
      }

      balance.allocated += detail.requiredQty;
      balance.available = balance.totalPhysical - balance.allocated;
      await this.balanceRepo.save(balance);
    }
  }

  // US03.01: Giải phóng tồn kho đã giữ chỗ khi hủy/xóa đơn
  private async releaseInventory(order: OutboundOrder) {
    for (const detail of order.details || []) {
      if (!detail.product?.id) continue;
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
    const allPicked = order.details?.length > 0 && order.details.every((d) => d.pickedQty >= d.requiredQty);
    order.status = allPicked ? 'picking' : (order.status || 'Đã giao hàng');
    await this.orderRepo.save(order);
  }

  private serializeOutbound(order: OutboundOrder): SerializedOutbound {
    return {
      id: order.id,
      orderNo: order.orderNo || `XBH_${String(order.id).padStart(3, '0')}`,
      branchCode: order.branchCode || '4445',
      employeeName: order.employeeName || 'HUUDQtest',
      receiver: order.receiver || '',
      customer: order.customerName || order.customer?.name || '',
      customerPhone: order.customerPhone || order.customer?.phone || '',
      customerAddress: order.customerAddress || order.customer?.address || '',
      orderDate: toDateString(order.orderDate || order.createdAt),
      dueDate: toDateString(order.expectedDate),
      expectedDate: toDateString(order.expectedDate),
      status: order.status || 'Đã giao hàng',
      description: order.description,
      items: order.details?.length || order.items || 0,
      subtotal: parseNumber(order.subtotal),
      discount: parseNumber(order.discount),
      vatRate: parseNumber(order.vatRate),
      vatAmount: parseNumber(order.vatAmount),
      totalAmount: parseNumber(order.totalAmount),
      amountPaid: parseNumber(order.amountPaid),
      debt: parseNumber(order.debt),
      paymentMethod: order.paymentMethod || 'CASH',
      paymentAccount: order.paymentAccount,
      usePoints: Boolean(order.usePoints),
      pointsUsed: order.pointsUsed || 0,
      pointsAvailable: order.pointsAvailable || 12217,
      createdAt: toDateString(order.createdAt),
      details: (order.details || []).map((d) => ({
        id: d.id,
        warehouseCode: d.warehouseCode,
        requiredQty: d.requiredQty,
        pickedQty: d.pickedQty,
        unitPrice: parseNumber(d.unitPrice),
        discountPercent: parseNumber(d.discountPercent),
        discountAmount: parseNumber(d.discountAmount),
        vatPercent: parseNumber(d.vatPercent),
        vatAmount: parseNumber(d.vatAmount),
        totalLineAmount: parseNumber(d.totalLineAmount),
        note: d.note,
        product: d.product
          ? {
              id: d.product.id,
              internalSku: d.productSku || d.product.internalSku,
              name: d.productName || d.product.name,
              unit: d.unit || d.product.unit,
            }
          : d.productName
          ? {
              id: '',
              internalSku: d.productSku || '',
              name: d.productName || '',
              unit: d.unit || '',
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
    let index = total + 605;
    let code = `XBH_${index}`;

    while (await this.orderRepo.findOne({ where: { orderNo: code } })) {
      index += 1;
      code = `XBH_${index}`;
    }

    return code;
  }
}
