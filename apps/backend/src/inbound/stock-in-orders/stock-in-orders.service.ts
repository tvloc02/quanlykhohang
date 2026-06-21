import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { StockBalance } from '../../inventory/entities/stock-balance.entity';
import { Product } from '../../entities/product.entity';
import { InboundReceipt } from '../entities/inbound-receipt.entity';
import { InboundDetail } from '../entities/inbound-detail.entity';
import { CreateStockInOrderDto } from './dto/create-stock-in-order.dto';
import { UpdateStockInOrderDto } from './dto/update-stock-in-order.dto';
import { CompleteStockInOrderDto } from './dto/complete-stock-in-order.dto';
import { StockInOrder } from './entities/stock-in-order.entity';
import { StockInOrderDetail } from './entities/stock-in-order-detail.entity';
import { StockInReceiptsService } from '../stock-in-receipts/stock-in-receipts.service';

type UserContext = {
  id?: string;
  email?: string;
};

type AuditLogItem = {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  actorEmail?: string;
  actorId?: string;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIso(value?: Date | string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

@Injectable()
export class StockInOrdersService {
  constructor(
    @InjectRepository(StockInOrder) private readonly orderRepo: Repository<StockInOrder>,
    @InjectRepository(StockInOrderDetail) private readonly detailRepo: Repository<StockInOrderDetail>,
    @InjectRepository(InboundReceipt) private readonly receiptRepo: Repository<InboundReceipt>,
    @InjectRepository(InboundDetail) private readonly receiptDetailRepo: Repository<InboundDetail>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(StockBalance) private readonly balanceRepo: Repository<StockBalance>,
    private readonly stockInReceiptsService: StockInReceiptsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll() {
    const orders = await this.orderRepo.find({
      relations: ['sourcePurchaseOrder', 'sourcePurchaseOrder.supplier', 'details', 'details.product'],
      order: { createdAt: 'DESC' },
    });

    return Promise.all(orders.map((order) => this.serializeOrder(order)));
  }

  async findOne(id: string) {
    const order = await this.findOrderEntity(id);
    return this.serializeOrder(order, true);
  }

  async createFromPurchaseOrder(sourcePurchaseOrderId: string, dto: CreateStockInOrderDto, user?: UserContext) {
    const purchaseOrder = await this.receiptRepo.findOne({
      where: { id: sourcePurchaseOrderId },
      relations: ['details', 'details.product', 'supplier'],
    });

    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }

    const orderCode = await this.generateOrderCode(dto.orderCode);
    const savedOrder = await this.orderRepo.save(
      this.orderRepo.create({
        orderCode,
        sourcePurchaseOrder: purchaseOrder,
        sourcePurchaseOrderNo: purchaseOrder.poNumber,
        status: 'DRAFT',
        currentStepUserEmail: dto.currentStepUserEmail?.trim() || user?.email,
        note: dto.note?.trim() || undefined,
      }),
    );

    const details = (purchaseOrder.details || []).map((purchaseDetail) =>
      this.detailRepo.create({
        stockInOrder: savedOrder,
        product: purchaseDetail.product,
        warehouseCode: purchaseDetail.warehouseCode || 'KHO-NVL',
        requestedQty: toNumber(purchaseDetail.expectedQty),
        actualQty: 0,
        unitPrice: toNumber(purchaseDetail.unitPrice).toFixed(2),
        totalLineAmount: (toNumber(purchaseDetail.unitPrice) * toNumber(purchaseDetail.expectedQty)).toFixed(2),
      }),
    );

    if (details.length) {
      await this.detailRepo.save(details);
    }

    await this.appendLog(savedOrder.id, 'workflow.create', user, {
      sourcePurchaseOrderId,
      sourcePurchaseOrderNo: purchaseOrder.poNumber,
      detailCount: details.length,
    });

    return this.serializeOrder(await this.findOrderEntity(savedOrder.id), true);
  }

  async update(id: string, dto: UpdateStockInOrderDto, user?: UserContext) {
    const order = await this.findOrderEntity(id);

    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new BadRequestException('Cannot update a finished stock in order');
    }

    if (dto.note !== undefined) {
      order.note = dto.note.trim() || undefined;
    }

    if (dto.currentStepUserEmail !== undefined) {
      order.currentStepUserEmail = dto.currentStepUserEmail.trim() || undefined;
    }

    if (dto.status) {
      order.status = dto.status;
    }

    if (dto.details?.length) {
      for (const line of dto.details) {
        const detail = order.details.find((item) => item.id === line.id);
        if (!detail) continue;

        const nextRequested = line.requestedQty !== undefined ? toNumber(line.requestedQty) : toNumber(detail.requestedQty);
        const nextActual = line.actualQty !== undefined ? toNumber(line.actualQty) : toNumber(detail.actualQty);

        if (nextActual > nextRequested) {
          throw new BadRequestException('Actual quantity cannot exceed requested quantity');
        }

        detail.requestedQty = nextRequested;
        detail.actualQty = nextActual;

        if (line.warehouseCode !== undefined) {
          detail.warehouseCode = line.warehouseCode.trim() || undefined;
        }

        if (line.unitPrice !== undefined) {
          const unitPrice = toNumber(line.unitPrice);
          detail.unitPrice = unitPrice.toFixed(2);
          detail.totalLineAmount = (unitPrice * nextRequested).toFixed(2);
        }
      }

      await this.detailRepo.save(order.details);
    }

    await this.orderRepo.save(order);
    await this.appendLog(id, 'workflow.update', user, {
      status: order.status,
      note: order.note,
    });

    return this.serializeOrder(await this.findOrderEntity(id), true);
  }

  async transition(id: string, dto: { nextStepUserEmail?: string; note?: string }, user?: UserContext) {
    const order = await this.findOrderEntity(id);

    if (order.status === 'COMPLETED') {
      throw new BadRequestException('Cannot transition a completed stock in order');
    }

    order.currentStepUserEmail = dto.nextStepUserEmail?.trim() || undefined;
    if (dto.note !== undefined) {
      order.note = dto.note.trim() || undefined;
    }
    order.status = 'IN_PROGRESS';
    await this.orderRepo.save(order);

    await this.appendLog(id, 'workflow.transition', user, {
      nextStepUserEmail: order.currentStepUserEmail,
      note: order.note,
    });

    return this.serializeOrder(await this.findOrderEntity(id), true);
  }

  async complete(id: string, dto: CompleteStockInOrderDto, user?: UserContext) {
    const order = await this.findOrderEntity(id);

    if (order.status === 'COMPLETED') {
      return this.serializeOrder(order, true);
    }

    const invalid = order.details.find((detail) => toNumber(detail.actualQty) > toNumber(detail.requestedQty));
    if (invalid) {
      throw new BadRequestException(
        `Mat hang ${invalid.product?.internalSku || invalid.product?.name || invalid.id} co SL thuc nhap vuot SL yeu cau`,
      );
    }

    const hasDifference = order.details.some((detail) => toNumber(detail.actualQty) !== toNumber(detail.requestedQty));
    if (hasDifference && !dto.confirmDifference) {
      throw new BadRequestException('Co chenh lech so luong. Hay xac nhan chenh lech truoc khi hoan thanh.');
    }

    for (const detail of order.details) {
      const qty = toNumber(detail.actualQty);
      if (qty <= 0) continue;
      await this.adjustInventory(detail.product.id, detail.warehouseCode || 'DEFAULT', qty);
    }

    order.status = 'COMPLETED';
    order.completedAt = new Date();
    order.currentStepUserEmail = dto.nextStepUserEmail?.trim() || order.currentStepUserEmail;
    await this.orderRepo.save(order);

    if (order.sourcePurchaseOrder) {
      order.sourcePurchaseOrder.status = hasDifference ? 'PARTIALLY_RECEIVED' : 'RECEIVED';
      await this.receiptRepo.save(order.sourcePurchaseOrder);
    }

    try {
      await this.stockInReceiptsService.createFromStockInOrder(order.id, { status: 'POSTED' }, user);
    } catch {
      // Phiếu có thể đã được tạo thủ công; không chặn hoàn thành lệnh.
    }

    await this.appendLog(id, 'workflow.complete', user, {
      confirmDifference: Boolean(dto.confirmDifference),
      nextStepUserEmail: order.currentStepUserEmail,
      actualQtyTotal: order.details.reduce((sum, detail) => sum + toNumber(detail.actualQty), 0),
    });

    return this.serializeOrder(await this.findOrderEntity(id), true);
  }

  async remove(id: string) {
    const order = await this.findOrderEntity(id);
    await this.orderRepo.remove(order);
    return { deleted: true };
  }

  private async findOrderEntity(id: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['sourcePurchaseOrder', 'sourcePurchaseOrder.supplier', 'details', 'details.product'],
    });

    if (!order) {
      throw new NotFoundException('Stock in order not found');
    }

    return order;
  }

  private async appendLog(resourceId: string, action: string, user?: UserContext, metadata?: Record<string, unknown>) {
    await this.auditLogService.append({
      actorId: user?.id,
      actorEmail: user?.email,
      action,
      resource: 'stock-in-order',
      resourceId,
      metadata,
    });
  }

  private async adjustInventory(productId: string, locationCode: string, qty: number) {
    const product = await this.productRepo.findOneBy({ id: productId });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const existing = await this.balanceRepo.findOne({
      where: { product: { id: productId } as any, locationCode },
      relations: ['product'],
    });

    if (existing) {
      existing.totalPhysical += qty;
      existing.available = Math.max(existing.totalPhysical - existing.allocated, 0);
      await this.balanceRepo.save(existing);
      return existing;
    }

    return this.balanceRepo.save(
      this.balanceRepo.create({
        product,
        locationCode,
        totalPhysical: qty,
        allocated: 0,
        available: qty,
      }),
    );
  }

  private async generateOrderCode(preferred?: string) {
    const requested = preferred?.trim().toUpperCase();
    if (requested) {
      const existing = await this.orderRepo.findOne({ where: { orderCode: requested } });
      if (!existing) return requested;
    }

    const total = await this.orderRepo.count();
    let index = total + 1;
    let code = `LNK${String(index).padStart(5, '0')}`;

    while (await this.orderRepo.findOne({ where: { orderCode: code } })) {
      index += 1;
      code = `LNK${String(index).padStart(5, '0')}`;
    }

    return code;
  }

  private async serializeOrder(order: StockInOrder, includeLogs = false) {
    const logs = includeLogs ? await this.auditLogService.findByResource('stock-in-order', order.id) : [];

    return {
      id: order.id,
      orderCode: order.orderCode,
      sourcePurchaseOrderId: order.sourcePurchaseOrder?.id,
      sourcePurchaseOrderNo: order.sourcePurchaseOrderNo || order.sourcePurchaseOrder?.poNumber || '-',
      sourcePurchaseOrder: order.sourcePurchaseOrder
        ? {
            id: order.sourcePurchaseOrder.id,
            poNumber: order.sourcePurchaseOrder.poNumber || `DMH${String(order.sourcePurchaseOrder.id).padStart(5, '0')}`,
            supplier: order.sourcePurchaseOrder.supplier
              ? {
                  id: order.sourcePurchaseOrder.supplier.id,
                  name: order.sourcePurchaseOrder.supplier.name,
                  supplierCode: order.sourcePurchaseOrder.supplier.supplierCode,
                }
              : null,
          }
        : null,
      status: order.status,
      currentStepUserEmail: order.currentStepUserEmail,
      note: order.note,
      completedAt: toIso(order.completedAt),
      createdAt: toIso(order.createdAt),
      updatedAt: toIso(order.updatedAt),
      details: (order.details || []).map((detail) => ({
        id: detail.id,
        warehouseCode: detail.warehouseCode,
        requestedQty: toNumber(detail.requestedQty),
        actualQty: toNumber(detail.actualQty),
        unitPrice: toNumber(detail.unitPrice),
        totalLineAmount: toNumber(detail.totalLineAmount),
        product: detail.product
          ? {
              id: detail.product.id,
              internalSku: detail.product.internalSku,
              name: detail.product.name,
              unit: detail.product.unit,
            }
          : null,
      })),
      totalRequestedQty: (order.details || []).reduce((sum, detail) => sum + toNumber(detail.requestedQty), 0),
      totalActualQty: (order.details || []).reduce((sum, detail) => sum + toNumber(detail.actualQty), 0),
      totalAmount: (order.details || []).reduce((sum, detail) => sum + toNumber(detail.totalLineAmount), 0),
      logs: (logs as AuditLogItem[]).map((log) => ({
        id: log.id,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        metadata: log.metadata,
        createdAt: toIso(log.createdAt),
        actorEmail: log.actorEmail,
        actorId: log.actorId,
      })),
    };
  }
}
