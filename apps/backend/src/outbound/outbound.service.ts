import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
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
import { NotificationsService } from '../notifications/notifications.service';
import { parseAssignedBinsFromNote } from '../inbound/inbound.service';

type SerializedOutbound = {
  id: string;
  orderNo: string;
  orderType?: string;
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

function parseCustomDate(dateStr?: string | Date | null): Date {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? new Date() : dateStr;
  const str = String(dateStr).trim();
  if (!str) return new Date();

  // 1. ISO strings with timezone (ends with Z or +/-offset)
  if (str.includes('Z') || /[+-]\d{2}(?::?\d{2})?$/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
  }

  // 2. DD/MM/YYYY [HH:mm[:ss]]
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = String(dmyMatch[1]).padStart(2, '0');
    const month = String(dmyMatch[2]).padStart(2, '0');
    const year = dmyMatch[3];
    const now = new Date();
    const hours = dmyMatch[4] !== undefined ? String(dmyMatch[4]).padStart(2, '0') : String(now.getHours()).padStart(2, '0');
    const minutes = dmyMatch[5] !== undefined ? String(dmyMatch[5]).padStart(2, '0') : String(now.getMinutes()).padStart(2, '0');
    const seconds = dmyMatch[6] !== undefined ? String(dmyMatch[6]).padStart(2, '0') : String(now.getSeconds()).padStart(2, '0');
    const d = new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}+07:00`);
    if (!isNaN(d.getTime())) return d;
    return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hours, 10), parseInt(minutes, 10), parseInt(seconds, 10));
  }

  // 3. YYYY-MM-DD [T| ] [HH:mm[:ss]] (without Z or offset -> GMT+7)
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = String(ymdMatch[2]).padStart(2, '0');
    const day = String(ymdMatch[3]).padStart(2, '0');
    const now = new Date();
    const hours = ymdMatch[4] !== undefined ? String(ymdMatch[4]).padStart(2, '0') : String(now.getHours()).padStart(2, '0');
    const minutes = ymdMatch[5] !== undefined ? String(ymdMatch[5]).padStart(2, '0') : String(now.getMinutes()).padStart(2, '0');
    const seconds = ymdMatch[6] !== undefined ? String(ymdMatch[6]).padStart(2, '0') : String(now.getSeconds()).padStart(2, '0');
    const d = new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}+07:00`);
    if (!isNaN(d.getTime())) return d;
    return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hours, 10), parseInt(minutes, 10), parseInt(seconds, 10));
  }

  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toDateString(value?: Date | string | null) {
  if (!value) return '';
  const date = parseCustomDate(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

@Injectable()
export class OutboundService implements OnModuleInit {
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
    private readonly notificationsService: NotificationsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) { }

  async onModuleInit() {
    try {
    } catch (e) {
      console.error('Lỗi dọn dẹp dữ liệu cũ outbound:', e);
    }
  }

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
      expectedDate: dto.expectedDate ? parseCustomDate(dto.expectedDate) : undefined,
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
    const orderNo = await this.generateOrderNo(dto.orderNo, dto.orderType);
    const parsedOrderDate = dto.orderDate ? parseCustomDate(dto.orderDate) : new Date();

    const order = this.orderRepo.create({
      orderNo,
      branchCode: dto.branchCode?.trim() || 'KHO-NVL',
      employeeName: dto.employeeName?.trim() || 'Quản trị viên hệ thống',
      receiver: dto.receiver?.trim() || undefined,
      customerPhone: dto.customerPhone?.trim() || undefined,
      customerAddress: dto.customerAddress?.trim() || undefined,
      orderDate: parsedOrderDate,
      expectedDate: (dto.expectedDate || dto.dueDate) ? parseCustomDate(dto.expectedDate || dto.dueDate!) : undefined,
      status: dto.status || 'Đã giao hàng',
      orderType: dto.orderType || 'outbound_sales',
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

    // Attach customer by id or name (Không tạo hoặc gán khách hàng nếu là đơn xuất hủy tiêu hủy hàng hóa)
    const isDisposalOrder = (dto.orderType === 'disposal') || (orderNo && orderNo.startsWith('XH'));
    if (isDisposalOrder) {
      order.customer = null as any;
      order.customerName = 'Xuất hủy nội bộ';
      order.customerPhone = undefined;
      order.customerAddress = undefined;
      order.debt = '0.00';
      order.amountPaid = '0.00';
    } else {
      let attachedCustomer: Customer | null = null;
      if (dto.customerId && /^\d+$/.test(String(dto.customerId))) {
        attachedCustomer = await this.customerRepo.findOneBy({ id: String(dto.customerId) });
      }

      const customerText = (dto.customer || dto.customerName || '').trim();
      if (!attachedCustomer && customerText) {
        attachedCustomer = await this.customerRepo.findOne({
          where: [{ name: customerText }, { customerCode: customerText }],
        });

        if (!attachedCustomer) {
          try {
            const newCust = this.customerRepo.create({
              name: customerText,
              customerCode: 'KH-' + Date.now().toString().slice(-6),
              phone: dto.customerPhone?.trim() || undefined,
              address: dto.customerAddress?.trim() || undefined,
            });
            attachedCustomer = await this.customerRepo.save(newCust);
          } catch { }
        }
      }

      if (attachedCustomer) {
        order.customer = attachedCustomer;
        order.customerName = attachedCustomer.name;
        if (!order.customerPhone) order.customerPhone = attachedCustomer.phone;
        if (!order.customerAddress) order.customerAddress = attachedCustomer.address;
      } else {
        order.customerName = customerText || '888 - Khách lẻ';
      }
    }

    const savedOrder = await this.orderRepo.save(order);

    // Persist detail items if provided
    if (dto.details?.length) {
      const savedDetails = await this.persistDetails(savedOrder.id, dto.details, savedOrder.branchCode);
      // Deduct inventory ONLY for finalized outbound orders, NEVER for drafts
      const isDraft = ['DRAFT', 'Lưu tạm', 'draft'].includes(savedOrder.status || '');
      if (!isDraft) {
        await this.applyInventoryDeduction(savedOrder, savedDetails);
      }
    }

    try {
      await this.notificationsService.createBroadcastNotification({
        title: `Phiếu xuất kho mới ${savedOrder.orderNo}`,
        message: `Phiếu xuất kho ${savedOrder.orderNo} (${savedOrder.branchCode || 'KHO-NVL'}) vừa được tạo thành công. Vui lòng chuẩn bị hàng xuất kho.`,
        link: '/outbound/orders',
        priority: 'normal',
        referenceType: 'OUTBOUND_ORDER',
        referenceId: savedOrder.id,
      });
    } catch {
      // Ignore notification creation error.
    }

    return this.serializeOutbound(await this.findOrderEntity(savedOrder.id));
  }

  async updateOutbound(id: string, dto: CreateOutboundOrderDto) {
    const order = await this.findOrderEntity(id);

    // Kiểm tra quyền sửa: Chỉ phiếu ở trạng thái Lưu nháp (DRAFT / Lưu tạm) mới được phép sửa
    const isCurrentDraft = ['DRAFT', 'Lưu tạm', 'draft'].includes(order.status || '');
    if (!isCurrentDraft) {
      throw new BadRequestException('Chỉ phiếu xuất ở trạng thái Lưu nháp mới được phép chỉnh sửa. Phiếu đã xuất kho/tạo mới chính thức không thể sửa!');
    }

    // Tuyệt đối không cho phép sửa mã phiếu: giữ nguyên order.orderNo
    // Bỏ qua dto.orderNo nếu có truyền lên

    if (dto.branchCode !== undefined) order.branchCode = dto.branchCode.trim() || 'KHO-NVL';
    if (dto.employeeName !== undefined) order.employeeName = dto.employeeName.trim() || 'Quản trị viên hệ thống';
    if (dto.receiver !== undefined) order.receiver = dto.receiver.trim() || undefined;
    if (dto.customerPhone !== undefined) order.customerPhone = dto.customerPhone.trim() || undefined;
    if (dto.customerAddress !== undefined) order.customerAddress = dto.customerAddress.trim() || undefined;

    // Update customer (Không tạo hoặc gán khách hàng nếu là đơn xuất hủy)
    const isDisposalOrder = (dto.orderType === 'disposal') || (order.orderType === 'disposal') || (order.orderNo && order.orderNo.startsWith('XH'));
    if (isDisposalOrder) {
      order.customer = null as any;
      order.customerName = 'Xuất hủy nội bộ';
      order.customerPhone = undefined;
      order.customerAddress = undefined;
      order.debt = '0.00';
      order.amountPaid = '0.00';
    } else {
      let attachedCustomer: Customer | null = null;
      if (dto.customerId && /^\d+$/.test(String(dto.customerId))) {
        attachedCustomer = await this.customerRepo.findOneBy({ id: String(dto.customerId) });
      }

      const updateCustText = (dto.customer || dto.customerName || '').trim();
      if (!attachedCustomer && updateCustText) {
        attachedCustomer = await this.customerRepo.findOne({
          where: [{ name: updateCustText }, { customerCode: updateCustText }],
        });

        if (!attachedCustomer) {
          try {
            const newCust = this.customerRepo.create({
              name: updateCustText,
              customerCode: 'KH-' + Date.now().toString().slice(-6),
              phone: dto.customerPhone?.trim() || undefined,
              address: dto.customerAddress?.trim() || undefined,
            });
            attachedCustomer = await this.customerRepo.save(newCust);
          } catch { }
        }
      }

      if (attachedCustomer) {
        order.customer = attachedCustomer;
        order.customerName = attachedCustomer.name;
        if (dto.customerPhone) order.customerPhone = dto.customerPhone.trim();
        if (dto.customerAddress) order.customerAddress = dto.customerAddress.trim();
      } else if (updateCustText) {
        order.customerName = updateCustText;
      }
    }

    if (dto.orderDate) {
      order.orderDate = parseCustomDate(dto.orderDate);
    }
    if (dto.expectedDate || dto.dueDate) {
      order.expectedDate = parseCustomDate(dto.expectedDate || dto.dueDate!);
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
      if (!isCurrentDraft) {
        await this.revertInventoryDeduction(order);
      }

      const existing = await this.detailRepo.find({
        where: { outboundOrder: { id } as any },
        relations: ['outboundOrder', 'product'],
      });
      if (existing.length) {
        await this.detailRepo.remove(existing);
      }
      const savedDetails = await this.persistDetails(id, dto.details, order.branchCode);

      const isNowDraft = ['DRAFT', 'Lưu tạm', 'draft'].includes(dto.status || order.status || '');
      if (!isNowDraft) {
        await this.applyInventoryDeduction(order, savedDetails);
      }
    } else if (dto.status && !['DRAFT', 'Lưu tạm', 'draft'].includes(dto.status || '') && isCurrentDraft) {
      // Chuyển từ DRAFT sang xuất chính thức mà không đổi details
      if (order.details?.length) {
        await this.applyInventoryDeduction(order, order.details);
      }
    }

    await this.orderRepo.save(order);
    return this.serializeOutbound(await this.findOrderEntity(id));
  }

  async removeOutbound(id: string) {
    const order = await this.findOrderEntity(id);

    // Revert inventory before deleting ONLY if order was officially deducted (not draft)
    const isDraft = ['DRAFT', 'Lưu tạm', 'draft'].includes(order.status || '');
    if (!isDraft) {
      await this.revertInventoryDeduction(order);
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
    });
    orders.sort((a, b) => Number(b.id) - Number(a.id));
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

  private async persistDetails(orderId: string, items: OutboundItemDto[], branchCode?: string) {
    const saved: OutboundDetail[] = [];
    const orderObj = await this.orderRepo.findOneBy({ id: orderId });
    const isDisposalOrder = orderObj?.orderType === 'disposal' || Boolean(orderObj?.orderNo && (orderObj.orderNo.startsWith('PXH') || orderObj.orderNo.includes('HỦY')));

    for (const item of items) {
      let product: Product | null = null;
      if (item.productId && /^\d+$/.test(String(item.productId))) {
        product = await this.productRepo.findOneBy({ id: String(item.productId) });
      }
      if (!product && item.productSku) {
        product = await this.productRepo.findOneBy({ internalSku: item.productSku.trim() });
      }
      if (!product && item.productName) {
        product = await this.productRepo.findOneBy({ name: item.productName.trim() });
      }

      const qty = parseNumber(item.requiredQty ?? item.qty);
      if (qty <= 0 && !item.productName && !item.productSku && !item.productId) continue;

      const unitPrice = parseNumber(item.unitPrice ?? item.price);
      const lossAmount = isDisposalOrder ? (item.lossAmount !== undefined ? parseNumber(item.lossAmount) : (unitPrice * qty)) : 0;
      const totalDisposalAmount = isDisposalOrder ? (item.totalDisposalAmount !== undefined ? parseNumber(item.totalDisposalAmount) : (unitPrice + lossAmount)) : 0;
      const discountPercent = parseNumber(item.discountPercent);
      const discountAmount = parseNumber(item.discountAmount) || ((unitPrice * qty * discountPercent) / 100);
      const vatPercent = parseNumber(item.vatPercent);
      const sub = (unitPrice * qty) - discountAmount;
      const vatAmount = parseNumber(item.vatAmount) || ((sub * vatPercent) / 100);
      const totalLineAmount = parseNumber(item.totalLineAmount) || (sub + vatAmount);

      const targetWhCode = item.warehouseCode?.trim() || branchCode?.trim();

      const detail = this.detailRepo.create({
        outboundOrder: { id: orderId } as OutboundOrder,
        product: product || undefined,
        productSku: item.productSku?.trim() || product?.internalSku || undefined,
        productName: item.productName?.trim() || product?.name || undefined,
        unit: item.unit?.trim() || product?.unit || 'Cái',
        warehouseCode: targetWhCode,
        locationBin: item.locationBin || (item.assignedBins && item.assignedBins.join(', ')) || undefined,
        requiredQty: qty,
        pickedQty: 0,
        unitPrice: unitPrice.toFixed(2),
        lossAmount: lossAmount.toFixed(2),
        totalDisposalAmount: totalDisposalAmount.toFixed(2),
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

  // Khấu trừ tồn kho khi tạo đơn xuất hàng
  private async applyInventoryDeduction(order: OutboundOrder, details: OutboundDetail[]) {
    for (const detail of details) {
      let productId = detail.product?.id;
      if (!productId && detail.productSku) {
        const [prod] = await this.dataSource.query(
          `SELECT id FROM products WHERE internalSku = ? LIMIT 1`,
          [detail.productSku.trim()],
        );
        productId = prod?.id;
      }
      if (!productId && detail.productName) {
        const [prod] = await this.dataSource.query(
          `SELECT id FROM products WHERE name = ? LIMIT 1`,
          [detail.productName.trim()],
        );
        productId = prod?.id;
      }
      if (!productId) continue;

      const locCode = detail.warehouseCode || order.branchCode;
      const qty = Number(detail.requiredQty) || 0;
      if (qty <= 0) continue;

      const isDirectShipped =
        !order.status ||
        ['Đã giao hàng', 'shipped', 'Đã xuất hủy', 'COMPLETED', 'Đã hoàn thành'].includes(order.status) ||
        order.orderType === 'disposal';

      // 1. Trừ tồn kho cấp kho tổng quát (KH010, KH006...)
      let [balance] = await this.dataSource.query(
        `SELECT id, totalPhysical, allocated, available FROM stock_balances WHERE productId = ? AND locationCode = ? LIMIT 1`,
        [productId, locCode],
      );

      if (!balance) {
        const rows = await this.dataSource.query(
          `SELECT id, totalPhysical, allocated, available FROM stock_balances WHERE productId = ? ORDER BY totalPhysical DESC LIMIT 1`,
          [productId],
        );
        if (rows.length > 0) {
          balance = rows[0];
        }
      }

      if (!balance) {
        const insertRes = await this.dataSource.query(
          `INSERT INTO stock_balances (productId, locationCode, totalPhysical, allocated, available) VALUES (?, ?, 0, 0, 0)`,
          [productId, locCode],
        );
        balance = { id: insertRes.insertId, totalPhysical: 0, allocated: 0, available: 0 };
      }

      if (isDirectShipped) {
        const newPhysical = Math.max(0, Number(balance.totalPhysical) - qty);
        const newAvailable = Math.max(0, newPhysical - Number(balance.allocated));
        await this.dataSource.query(
          `UPDATE stock_balances SET totalPhysical = ?, available = ? WHERE id = ?`,
          [newPhysical, newAvailable, balance.id],
        );
      } else {
        const newAllocated = Number(balance.allocated) + qty;
        const newAvailable = Math.max(0, Number(balance.totalPhysical) - newAllocated);
        await this.dataSource.query(
          `UPDATE stock_balances SET allocated = ?, available = ? WHERE id = ?`,
          [newAllocated, newAvailable, balance.id],
        );
      }

      // 2. Trừ tồn kho tại Ô KỆ cụ thể trong stock_balances (nếu có lưu balance theo mã ô)
      const binCodesToDeduct = this.extractBinCodesFromDetail(detail);
      if (binCodesToDeduct.length > 0 && isDirectShipped) {
        for (const bCode of binCodesToDeduct) {
          const shortCode = (bCode.split('-').pop() || bCode).trim();
          await this.dataSource.query(
            `UPDATE stock_balances 
             SET totalPhysical = GREATEST(0, totalPhysical - ?), 
                 available = GREATEST(0, available - ?) 
             WHERE productId = ? AND (locationCode = ? OR locationCode = ? OR locationCode LIKE ?)`,
            [qty, qty, productId, bCode, shortCode, `%${shortCode}%`],
          );
        }
      }

      // 3. Khấu trừ trực tiếp vào customBins trong bảng warehouses
      if (isDirectShipped) {
        await this.updateWarehouseSubWarehousesBinStock(
          locCode,
          binCodesToDeduct,
          detail.productSku || '',
          detail.productName || '',
          qty,
          true,
        );
      }
    }
  }

  // Hoàn trả tồn kho khi hủy/xóa đơn xuất hàng
  private async revertInventoryDeduction(order: OutboundOrder) {
    const details = (order.details && order.details.length)
      ? order.details
      : await this.detailRepo.find({
        where: { outboundOrder: { id: order.id } as any },
        relations: ['product'],
      });

    for (const detail of details) {
      let productId = detail.product?.id;
      if (!productId && detail.productSku) {
        const [prod] = await this.dataSource.query(
          `SELECT id FROM products WHERE internalSku = ? LIMIT 1`,
          [detail.productSku.trim()],
        );
        productId = prod?.id;
      }
      if (!productId && detail.productName) {
        const [prod] = await this.dataSource.query(
          `SELECT id FROM products WHERE name = ? LIMIT 1`,
          [detail.productName.trim()],
        );
        productId = prod?.id;
      }
      if (!productId) continue;

      const locCode = detail.warehouseCode || order.branchCode;
      const qty = Number(detail.requiredQty) || 0;
      if (qty <= 0) continue;

      const isDirectShipped =
        !order.status ||
        ['Đã giao hàng', 'shipped', 'Đã xuất hủy', 'COMPLETED', 'Đã hoàn thành'].includes(order.status) ||
        order.orderType === 'disposal';

      let [balance] = await this.dataSource.query(
        `SELECT id, totalPhysical, allocated, available FROM stock_balances WHERE productId = ? AND locationCode = ? LIMIT 1`,
        [productId, locCode],
      );

      if (!balance) {
        const rows = await this.dataSource.query(
          `SELECT id, totalPhysical, allocated, available FROM stock_balances WHERE productId = ? ORDER BY totalPhysical DESC LIMIT 1`,
          [productId],
        );
        if (rows.length > 0) {
          balance = rows[0];
        }
      }

      if (balance) {
        if (isDirectShipped) {
          const newPhysical = Number(balance.totalPhysical) + qty;
          const newAvailable = Math.max(0, newPhysical - Number(balance.allocated));
          await this.dataSource.query(
            `UPDATE stock_balances SET totalPhysical = ?, available = ? WHERE id = ?`,
            [newPhysical, newAvailable, balance.id],
          );
        } else {
          const newAllocated = Math.max(0, Number(balance.allocated) - qty);
          const newAvailable = Math.max(0, Number(balance.totalPhysical) - newAllocated);
          await this.dataSource.query(
            `UPDATE stock_balances SET allocated = ?, available = ? WHERE id = ?`,
            [newAllocated, newAvailable, balance.id],
          );
        }
      }

      // Hoàn trả vào stock_balances cấp ô kệ
      const binCodesToDeduct = this.extractBinCodesFromDetail(detail);
      if (binCodesToDeduct.length > 0 && isDirectShipped) {
        for (const bCode of binCodesToDeduct) {
          const shortCode = (bCode.split('-').pop() || bCode).trim();
          await this.dataSource.query(
            `UPDATE stock_balances 
             SET totalPhysical = totalPhysical + ?, 
                 available = available + ? 
             WHERE productId = ? AND (locationCode = ? OR locationCode = ? OR locationCode LIKE ?)`,
            [qty, qty, productId, bCode, shortCode, `%${shortCode}%`],
          );
        }
      }

      // Hoàn trả lại vào customBins trong bảng warehouses
      if (isDirectShipped) {
        await this.updateWarehouseSubWarehousesBinStock(
          locCode,
          binCodesToDeduct,
          detail.productSku || '',
          detail.productName || '',
          qty,
          false,
        );
      }
    }
  }

  private extractBinCodesFromDetail(detail: OutboundDetail): string[] {
    const raw = detail.locationBin || detail.note || '';
    if (!raw) return [];
    let binStr = raw;
    const noteMatch = raw.match(/\[Vị trí Ô:\s*([^\]]+)\]/i);
    if (noteMatch) {
      binStr = noteMatch[1];
    }
    return binStr
      .split(',')
      .map((s) => s.split('(')[0].trim())
      .filter((s) => Boolean(s) && s !== '-' && s !== 'Chưa chọn');
  }

  private async updateWarehouseSubWarehousesBinStock(
    whCode: string,
    binCodes: string[],
    sku: string,
    productName: string,
    qty: number,
    isDeduct: boolean,
  ) {
    if (!whCode) return;
    try {
      const [whRow] = await this.dataSource.query(
        `SELECT id, code, subWarehouses FROM warehouses WHERE code = ? OR id = ? LIMIT 1`,
        [whCode.trim(), whCode.trim()],
      );
      if (!whRow || !whRow.subWarehouses) return;

      let subWarehouses: any[];
      try {
        subWarehouses = typeof whRow.subWarehouses === 'string'
          ? JSON.parse(whRow.subWarehouses)
          : whRow.subWarehouses;
      } catch {
        return;
      }
      if (!Array.isArray(subWarehouses)) return;

      const norm = (s: string) =>
        s ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim() : '';

      const targetSku = (sku || '').trim().toUpperCase();
      const targetNameNorm = norm(productName || '');

      let changed = false;

      // Danh sách các key cần khớp cho các ô kệ
      const targetKeys = new Set<string>();
      binCodes.forEach((b) => {
        const clean = b.split('(')[0].trim();
        const short = (clean.split('-').pop() || clean).trim();
        const stripped = clean.toUpperCase().replace(/[^A-Z0-9]/g, '');
        targetKeys.add(clean.toUpperCase());
        targetKeys.add(short.toUpperCase());
        targetKeys.add(stripped);
      });

      subWarehouses.forEach((sub) => {
        (sub.racks || []).forEach((rk: any) => {
          const customBins = rk.customBins;
          if (!customBins || typeof customBins !== 'object') return;

          Object.keys(customBins).forEach((k) => {
            const kClean = k.split('(')[0].trim();
            const kShort = (kClean.split('-').pop() || kClean).trim();
            const kStripped = kClean.toUpperCase().replace(/[^A-Z0-9]/g, '');

            const isMatchedBin =
              targetKeys.size === 0 || // Nếu không chỉ định ô thì tìm ô chứa đúng sản phẩm
              targetKeys.has(k.toUpperCase()) ||
              targetKeys.has(kClean.toUpperCase()) ||
              targetKeys.has(kShort.toUpperCase()) ||
              targetKeys.has(kStripped);

            if (!isMatchedBin) return;

            const binData = customBins[k];
            if (!binData) return;

            let existingProds: Array<{ sku?: string; productName: string; qty: number; occupancyPct: number; unit?: string }> = [];
            if (Array.isArray(binData.products) && binData.products.length > 0) {
              existingProds = binData.products.map((p: any) => ({ ...p }));
            } else if (binData.productName && Number(binData.totalPhysical || 0) > 0) {
              existingProds = [{
                sku: binData.sku || '',
                productName: binData.productName,
                qty: Number(binData.totalPhysical || 0),
                occupancyPct: Number(binData.occupancyPct || 100),
                unit: binData.unit || 'cái',
              }];
            }

            let matchIdx = existingProds.findIndex((p) => {
              const pSku = (p.sku || '').trim().toUpperCase();
              const pNameNorm = norm(p.productName || '');
              return (targetSku && pSku && targetSku === pSku) ||
                (targetNameNorm && pNameNorm && (targetNameNorm.includes(pNameNorm) || pNameNorm.includes(targetNameNorm)));
            });

            if (isDeduct) {
              if (matchIdx >= 0) {
                const matchedProd = existingProds[matchIdx];
                const oldItemQty = Number(matchedProd.qty || 0);
                const oldItemPct = Number(matchedProd.occupancyPct || 0);
                const newItemQty = Math.max(0, oldItemQty - qty);
                const newItemPct = oldItemQty > 0 ? Math.max(0, Math.round((newItemQty / oldItemQty) * oldItemPct)) : 0;

                if (newItemQty > 0) {
                  existingProds[matchIdx] = { ...matchedProd, qty: newItemQty, occupancyPct: newItemPct };
                } else {
                  existingProds.splice(matchIdx, 1);
                }
              } else {
                const oldQty = Number(binData.totalPhysical || 0);
                const newQty = Math.max(0, oldQty - qty);
                const oldPct = Number(binData.occupancyPct || 0);
                const newPct = oldQty > 0 ? Math.max(0, Math.round((newQty / oldQty) * oldPct)) : 0;
                existingProds = newQty > 0 ? [{
                  sku: targetSku || 'SKU-001',
                  productName: productName || 'Hàng tồn kho',
                  qty: newQty,
                  occupancyPct: newPct,
                  unit: binData.unit || 'cái',
                }] : [];
              }
            } else {
              // Revert / Cộng trả lại
              if (matchIdx >= 0) {
                existingProds[matchIdx].qty = Number(existingProds[matchIdx].qty || 0) + qty;
                existingProds[matchIdx].occupancyPct = Math.min(100, Number(existingProds[matchIdx].occupancyPct || 0) + 10);
              } else {
                existingProds.push({
                  sku: targetSku || 'SKU-001',
                  productName: productName || 'Hàng tồn kho',
                  qty,
                  occupancyPct: 20,
                  unit: binData.unit || 'cái',
                });
              }
            }

            const newTotalQty = existingProds.reduce((sum, p) => sum + (Number(p.qty) || 0), 0);
            const newTotalPct = Math.min(100, existingProds.reduce((sum, p) => sum + (Number(p.occupancyPct) || 0), 0));
            const noteDesc = newTotalQty === 0
              ? 'Ô Trống'
              : `Đã chứa: ${newTotalPct}% (${existingProds.map((p) => `${p.productName}: ${p.qty} ${p.unit || 'cái'} [${p.occupancyPct}%]`).join(', ')})`;

            customBins[k] = {
              ...binData,
              totalPhysical: newTotalQty,
              occupancyPct: newTotalQty === 0 ? 0 : (newTotalPct || 10),
              products: existingProds,
              notes: noteDesc,
              productName: newTotalQty === 0 ? 'Ô Trống' : (existingProds.map((p) => p.productName).join(', ') || 'Hàng tồn kho'),
              sku: existingProds.map((p) => p.sku).filter(Boolean).join(', '),
            };
            changed = true;
          });
        });
      });

      if (changed) {
        await this.dataSource.query(
          `UPDATE warehouses SET subWarehouses = ? WHERE id = ?`,
          [JSON.stringify(subWarehouses), whRow.id],
        );
      }
    } catch (e) {
      console.error('Lỗi cập nhật subWarehouses kho hàng khi xuất kho:', e);
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
    const isRetail = order.orderType === 'retail' || order.orderType === 'RETAIL';
    const isDisposal = order.orderType === 'disposal';
    const prefix = isDisposal ? 'XH_' : (isRetail ? 'XBL_' : 'XBH_');
    return {
      id: order.id,
      orderNo: order.orderNo || `${prefix}${String(order.id).padStart(3, '0')}`,
      orderType: order.orderType || (isDisposal ? 'disposal' : (isRetail ? 'retail' : 'orders')),
      branchCode: (!order.branchCode) ? 'KHO-NVL' : order.branchCode,
      employeeName: (!order.employeeName) ? 'Quản trị viên hệ thống' : order.employeeName,
      receiver: order.receiver || '',
      customer: order.customerName || order.customer?.name || (isDisposal ? 'Hàng hết hạn / hư hỏng' : (isRetail ? 'Khách hàng bán lẻ' : '888 - Khách đại lý / Bán buôn')),
      customerPhone: order.customerPhone || order.customer?.phone || '',
      customerAddress: order.customerAddress || order.customer?.address || '',
      orderDate: toDateString(order.orderDate || order.createdAt),
      dueDate: toDateString(order.expectedDate),
      expectedDate: toDateString(order.expectedDate),
      status: order.status || (order.orderType === 'disposal' ? 'Đã xuất hủy' : 'Đã giao hàng'),
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
      details: (order.details || []).map((d) => {
        const reqQty = parseNumber(d.requiredQty);
        const picQty = parseNumber(d.pickedQty);
        const effectiveQty = reqQty > 0 ? reqQty : (picQty > 0 ? picQty : 1);
        const parsedNoteBins = parseAssignedBinsFromNote(d.note);
        const locBin = (d as any).locationBin || parsedNoteBins.join(', ');
        const rawAssigned = (d as any).assignedBins;
        const binArr = Array.isArray(rawAssigned) && rawAssigned.length > 0
          ? rawAssigned
          : (parsedNoteBins.length > 0 ? parsedNoteBins : (locBin ? locBin.split(',').map((s: string) => s.trim()) : []));

        return {
          id: d.id,
          warehouseCode: d.warehouseCode,
          locationBin: locBin,
          assignedBins: binArr,
          requiredQty: reqQty,
          pickedQty: picQty,
          qty: effectiveQty,
          quantity: effectiveQty,
          unitPrice: parseNumber(d.unitPrice),
          price: parseNumber(d.unitPrice),
          lossAmount: d.lossAmount !== undefined ? parseNumber(d.lossAmount) : (effectiveQty * parseNumber(d.unitPrice)),
          totalDisposalAmount: d.totalDisposalAmount !== undefined ? parseNumber(d.totalDisposalAmount) : (parseNumber(d.unitPrice) + (effectiveQty * parseNumber(d.unitPrice))),
          discountPercent: parseNumber(d.discountPercent),
          discountAmount: parseNumber(d.discountAmount),
          vatPercent: parseNumber(d.vatPercent),
          vatAmount: parseNumber(d.vatAmount),
          totalLineAmount: parseNumber(d.totalLineAmount),
          note: d.note,
          productSku: d.productSku || d.product?.internalSku,
          productName: d.productName || d.product?.name,
          product: d.product
            ? {
              id: d.product.id,
              internalSku: d.productSku || d.product.internalSku,
              name: d.productName || d.product.name,
              unit: d.unit || d.product.unit,
            }
            : (d.productName || d.productSku)
              ? {
                id: '',
                internalSku: d.productSku || '',
                name: d.productName || d.productSku || '',
                unit: d.unit || 'Cái',
              }
              : null,
        };
      }),
    };
  }

  private async generateOrderNo(preferred?: string, orderType?: string) {
    const requested = preferred?.trim().toUpperCase();
    if (requested) {
      const dup = await this.orderRepo.findOne({ where: { orderNo: requested } });
      if (!dup) return requested;
    }

    const isRet = orderType === 'retail' || orderType === 'RETAIL';
    const isDisp = orderType === 'disposal';
    const prefix = isDisp ? 'XH_' : (isRet ? 'XBL_' : 'XBH_');
    const total = await this.orderRepo.count();
    let index = total + (isDisp ? 101 : (isRet ? 501 : 605));
    let code = `${prefix}${index}`;

    while (await this.orderRepo.findOne({ where: { orderNo: code } })) {
      index += 1;
      code = `${prefix}${index}`;
    }

    return code;
  }
}
