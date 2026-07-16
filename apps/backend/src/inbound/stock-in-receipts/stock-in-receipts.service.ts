import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { Product } from '../../entities/product.entity';
import { Supplier } from '../../entities/supplier.entity';
import { StockBalance } from '../../inventory/entities/stock-balance.entity';
import { StockInOrder } from '../stock-in-orders/entities/stock-in-order.entity';
import { StockInReceiptDetail } from './entities/stock-in-receipt-detail.entity';
import { StockInReceipt } from './entities/stock-in-receipt.entity';
import { CreateStockInReceiptDto, StockInReceiptType } from './dto/create-stock-in-receipt.dto';
import { UpdateStockInReceiptDto } from './dto/update-stock-in-receipt.dto';

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
export class StockInReceiptsService {
  constructor(
    @InjectRepository(StockInReceipt) private readonly receiptRepo: Repository<StockInReceipt>,
    @InjectRepository(StockInReceiptDetail) private readonly detailRepo: Repository<StockInReceiptDetail>,
    @InjectRepository(Supplier) private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(StockBalance) private readonly balanceRepo: Repository<StockBalance>,
    @InjectRepository(StockInOrder) private readonly stockInOrderRepo: Repository<StockInOrder>,
    private readonly auditLogService: AuditLogService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll() {
    const receipts = await this.receiptRepo.find({
      relations: ['supplier', 'sourceStockInOrder', 'details', 'details.product'],
      order: { createdAt: 'DESC' },
    });

    return Promise.all(receipts.map((receipt) => this.serializeReceipt(receipt)));
  }

  async findOne(id: string) {
    return this.serializeReceipt(await this.findReceiptEntity(id), true);
  }

  async create(dto: CreateStockInReceiptDto, user?: UserContext) {
    const shouldPost = dto.status === 'POSTED';
    const receipt = await this.buildReceipt(dto);
    const saved = await this.receiptRepo.save(receipt);
    await this.saveDetails(saved.id, dto.items || []);

    const reloaded = await this.findReceiptEntity(saved.id);
    await this.recalculateTotalAmount(reloaded.id);
    await this.appendLog(reloaded.id, 'receipt.create', user, {
      receiptType: reloaded.receiptType,
      warehouseCode: reloaded.warehouseCode,
      sourceReferenceNo: reloaded.sourceReferenceNo,
    });

    if (shouldPost) {
      return this.post(saved.id, user);
    }

    return this.serializeReceipt(await this.findReceiptEntity(saved.id), true);
  }

  async createFromStockInOrder(sourceStockInOrderId: string, dto: Partial<CreateStockInReceiptDto> = {}, user?: UserContext) {
    const sourceOrder = await this.stockInOrderRepo.findOne({
      where: { id: sourceStockInOrderId },
      relations: ['sourcePurchaseOrder', 'sourcePurchaseOrder.supplier', 'details', 'details.product'],
    });

    if (!sourceOrder) {
      throw new NotFoundException('Stock in order not found');
    }

    const existing = await this.receiptRepo.findOne({
      where: { sourceStockInOrder: { id: sourceStockInOrderId } as any },
      relations: ['supplier', 'sourceStockInOrder', 'details', 'details.product'],
    });

    if (existing) {
      return this.serializeReceipt(existing, true);
    }

    const items =
      dto.items?.length
        ? dto.items
        : sourceOrder.details.map((detail) => ({
            productId: detail.product.id,
            warehouseCode: detail.warehouseCode || sourceOrder.details[0]?.warehouseCode || 'DEFAULT',
            orderedQty: toNumber(detail.requestedQty),
            receivedQty: toNumber(detail.actualQty),
            quantity: toNumber(detail.actualQty || detail.requestedQty),
            unitPrice: toNumber(detail.unitPrice),
            note: `Kế thừa từ ${sourceOrder.orderCode}`,
          }));

    return this.create(
      {
        receiptCode: dto.receiptCode,
        receiptType: 'PURCHASE_GOODS',
        warehouseCode: dto.warehouseCode || sourceOrder.details[0]?.warehouseCode || 'DEFAULT',
        supplierId: dto.supplierId || sourceOrder.sourcePurchaseOrder?.supplier?.id,
        sourceStockInOrderId,
        sourceReferenceNo: sourceOrder.orderCode,
        receiptDate: dto.receiptDate,
        status: dto.status || 'POSTED',
        description: dto.description || `Sinh tự động từ lệnh ${sourceOrder.orderCode}`,
        assignedStaffIds: dto.assignedStaffIds,
        items,
      },
      user,
    );
  }

  async update(id: string, dto: UpdateStockInReceiptDto, user?: UserContext) {
    const receipt = await this.findReceiptEntity(id);
    if (receipt.status === 'POSTED') {
      throw new BadRequestException('Không thể chỉnh sửa phiếu đã ghi sổ');
    }

    const shouldPost = dto.status === 'POSTED';
    const next = await this.applyHeader(receipt, dto);

    if (dto.items) {
      const currentDetails = await this.detailRepo.find({
        where: { receipt: { id } as any },
        relations: ['receipt', 'product'],
      });
      if (currentDetails.length) {
        await this.detailRepo.remove(currentDetails);
      }
      await this.saveDetails(id, dto.items);
    }

    await this.receiptRepo.save(next);
    await this.recalculateTotalAmount(id);
    await this.appendLog(id, 'receipt.update', user, {
      receiptType: next.receiptType,
      warehouseCode: next.warehouseCode,
    });

    if (shouldPost) {
      return this.post(id, user);
    }

    return this.serializeReceipt(await this.findReceiptEntity(id), true);
  }

  async post(id: string, user?: UserContext) {
    const receipt = await this.findReceiptEntity(id);
    if (receipt.status === 'POSTED') {
      return this.serializeReceipt(receipt, true);
    }

    const details = receipt.details || [];
    if (details.length === 0) {
      throw new BadRequestException('Phiếu nhập kho phải có ít nhất một dòng hàng');
    }

    for (const detail of details) {
      if (toNumber(detail.quantity) <= 0) {
        throw new BadRequestException('Số lượng nhập kho phải lớn hơn 0');
      }
      await this.adjustInventory(detail.product.id, detail.warehouseCode || receipt.warehouseCode || 'DEFAULT', toNumber(detail.quantity));
    }

    receipt.status = 'POSTED';
    receipt.postedAt = new Date();
    await this.receiptRepo.save(receipt);

    await this.appendLog(id, 'receipt.post', user, {
      receiptType: receipt.receiptType,
      warehouseCode: receipt.warehouseCode,
      totalAmount: receipt.totalAmount,
    });

    return this.serializeReceipt(await this.findReceiptEntity(id), true);
  }

  async remove(id: string) {
    const receipt = await this.findReceiptEntity(id);
    if (receipt.status === 'POSTED') {
      throw new BadRequestException('Không thể xóa phiếu đã ghi sổ');
    }
    await this.receiptRepo.remove(receipt);
    return { deleted: true };
  }

  private async buildReceipt(dto: CreateStockInReceiptDto) {
    const supplier = dto.supplierId ? await this.supplierRepo.findOneBy({ id: dto.supplierId }) : null;
    if (dto.supplierId && !supplier) {
      throw new NotFoundException('Supplier not found');
    }

    const sourceOrder = dto.sourceStockInOrderId
      ? await this.stockInOrderRepo.findOne({
          where: { id: dto.sourceStockInOrderId },
          relations: ['sourcePurchaseOrder', 'sourcePurchaseOrder.supplier'],
        })
      : null;

    if (dto.sourceStockInOrderId && !sourceOrder) {
      throw new NotFoundException('Source stock in order not found');
    }

    const receiptCode = await this.generateReceiptCode(dto.receiptCode);
    return this.receiptRepo.create({
      receiptCode,
      receiptType: dto.receiptType,
      warehouseCode: dto.warehouseCode?.trim() || sourceOrder?.details?.[0]?.warehouseCode || 'DEFAULT',
      supplier: supplier || sourceOrder?.sourcePurchaseOrder?.supplier || undefined,
      sourceStockInOrder: sourceOrder || undefined,
      sourceReferenceNo: dto.sourceReferenceNo?.trim() || sourceOrder?.orderCode || undefined,
      receiptDate: dto.receiptDate ? new Date(dto.receiptDate) : new Date(),
      status: dto.status || 'DRAFT',
      description: dto.description?.trim() || undefined,
      assignedStaffIds: dto.assignedStaffIds || undefined,
      totalAmount: '0',
    });
  }

  private async applyHeader(receipt: StockInReceipt, dto: UpdateStockInReceiptDto) {
    if (dto.receiptCode && dto.receiptCode !== receipt.receiptCode) {
      const duplicate = await this.receiptRepo.findOne({ where: { receiptCode: dto.receiptCode } });
      if (duplicate && duplicate.id !== receipt.id) {
        throw new BadRequestException('Mã phiếu đã tồn tại');
      }
      receipt.receiptCode = dto.receiptCode;
    }

    if (dto.receiptType) {
      receipt.receiptType = dto.receiptType;
    }

    if (dto.warehouseCode !== undefined) {
      receipt.warehouseCode = dto.warehouseCode.trim() || undefined;
    }

    if (dto.supplierId !== undefined) {
      if (!dto.supplierId) {
        receipt.supplier = undefined;
      } else {
        const supplier = await this.supplierRepo.findOneBy({ id: dto.supplierId });
        if (!supplier) throw new NotFoundException('Supplier not found');
        receipt.supplier = supplier;
      }
    }

    if (dto.sourceReferenceNo !== undefined) {
      receipt.sourceReferenceNo = dto.sourceReferenceNo.trim() || undefined;
    }

    if (dto.receiptDate) {
      receipt.receiptDate = new Date(dto.receiptDate);
    }

    if (dto.status) {
      receipt.status = dto.status;
    }

    if (dto.description !== undefined) {
      receipt.description = dto.description.trim() || undefined;
    }

    if (dto.assignedStaffIds !== undefined) {
      receipt.assignedStaffIds = dto.assignedStaffIds;
    }

    return receipt;
  }

  private async saveDetails(receiptId: string, items: CreateStockInReceiptDto['items']) {
    const created = [] as StockInReceiptDetail[];
    for (const item of items || []) {
      const product = await this.productRepo.findOneBy({ id: item.productId });
      if (!product) {
        throw new NotFoundException(`Product not found: ${item.productId}`);
      }

      const quantity = toNumber(item.quantity);
      if (quantity <= 0) {
        throw new BadRequestException('Quantity must be positive');
      }

      const unitPrice = toNumber(item.unitPrice ?? 0);
      const detail = this.detailRepo.create({
        receipt: { id: receiptId } as StockInReceipt,
        product,
        warehouseCode: item.warehouseCode?.trim() || undefined,
        orderedQty: toNumber(item.orderedQty || 0),
        receivedQty: toNumber(item.receivedQty || 0),
        quantity,
        unitPrice: unitPrice.toFixed(2),
        totalLineAmount: (quantity * unitPrice).toFixed(2),
        note: item.note?.trim() || undefined,
      });
      created.push(await this.detailRepo.save(detail));
    }
    return created;
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

  private async recalculateTotalAmount(receiptId: string) {
    const details = await this.detailRepo.find({
      where: { receipt: { id: receiptId } as any },
      relations: ['receipt', 'product'],
    });

    const totalAmount = details.reduce((sum, detail) => sum + toNumber(detail.totalLineAmount), 0);
    await this.receiptRepo.update(receiptId, { totalAmount: totalAmount.toFixed(2) });
  }

  private async findReceiptEntity(id: string) {
    const receipt = await this.receiptRepo.findOne({
      where: { id },
      relations: ['supplier', 'sourceStockInOrder', 'sourceStockInOrder.sourcePurchaseOrder', 'details', 'details.product'],
    });

    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }

    return receipt;
  }

  private async appendLog(resourceId: string, action: string, user?: UserContext, metadata?: Record<string, unknown>) {
    await this.auditLogService.append({
      actorId: user?.id,
      actorEmail: user?.email,
      action,
      resource: 'stock-in-receipt',
      resourceId,
      metadata,
    });
  }

  private async generateReceiptCode(preferred?: string) {
    const requested = preferred?.trim().toUpperCase();
    if (requested) {
      const existing = await this.receiptRepo.findOne({ where: { receiptCode: requested } });
      if (!existing) return requested;
    }

    const total = await this.receiptRepo.count();
    let index = total + 1;
    let code = `PNK${String(index).padStart(5, '0')}`;
    while (await this.receiptRepo.findOne({ where: { receiptCode: code } })) {
      index += 1;
      code = `PNK${String(index).padStart(5, '0')}`;
    }
    return code;
  }

  private async serializeReceipt(receipt: StockInReceipt, includeLogs = false) {
    const logs = includeLogs ? await this.auditLogService.findByResource('stock-in-receipt', receipt.id) : [];

    let poFields: any = null;
    if (receipt.sourceReferenceNo && receipt.sourceReferenceNo.startsWith('PO-')) {
      poFields = await this.dataSource.query(
        'SELECT poNumber, orderDate, expectedDate, creatorName, creatorPhone, approverName, status, description FROM inbound_receipts WHERE poNumber = ? LIMIT 1',
        [receipt.sourceReferenceNo]
      );
      poFields = poFields?.[0] || null;
    }

    return {
      id: receipt.id,
      receiptCode: receipt.receiptCode,
      receiptType: receipt.receiptType,
      warehouseCode: receipt.warehouseCode,
      sourceReferenceNo: receipt.sourceReferenceNo,
      sourceStockInOrderId: receipt.sourceStockInOrder?.id,
      sourceStockInOrder: receipt.sourceStockInOrder
        ? {
            id: receipt.sourceStockInOrder.id,
            orderCode: receipt.sourceStockInOrder.orderCode,
            orderDate: toIso((receipt.sourceStockInOrder as any).sourcePurchaseOrder?.orderDate),
            expectedDate: toIso((receipt.sourceStockInOrder as any).sourcePurchaseOrder?.expectedDate),
            creatorName: (receipt.sourceStockInOrder as any).sourcePurchaseOrder?.creatorName,
          }
        : null,
      poNumber: poFields?.poNumber || (receipt.sourceStockInOrder as any)?.sourcePurchaseOrder?.poNumber || receipt.sourceReferenceNo,
      orderDate: toIso(poFields?.orderDate || (receipt.sourceStockInOrder as any)?.sourcePurchaseOrder?.orderDate),
      expectedDate: toIso(poFields?.expectedDate || (receipt.sourceStockInOrder as any)?.sourcePurchaseOrder?.expectedDate),
      creatorName: poFields?.creatorName || (receipt.sourceStockInOrder as any)?.sourcePurchaseOrder?.creatorName,
      creatorPhone: poFields?.creatorPhone || (receipt.sourceStockInOrder as any)?.sourcePurchaseOrder?.creatorPhone,
      approver: {
        fullName: poFields?.approverName || (receipt.sourceStockInOrder as any)?.sourcePurchaseOrder?.approverName,
      },
      orderStatus: poFields?.status || (receipt.sourceStockInOrder as any)?.sourcePurchaseOrder?.status,
      orderDescription: poFields?.description || (receipt.sourceStockInOrder as any)?.sourcePurchaseOrder?.description,
      supplier: receipt.supplier
        ? {
            id: receipt.supplier.id,
            supplierCode: receipt.supplier.supplierCode,
            name: receipt.supplier.name,
            taxCode: receipt.supplier.taxCode,
            contactPerson: receipt.supplier.contactPerson,
            phone: receipt.supplier.phone,
          }
        : null,
      receiptDate: toIso(receipt.receiptDate),
      status: receipt.status,
      description: receipt.description,
      assignedStaffIds: receipt.assignedStaffIds || [],
      totalAmount: toNumber(receipt.totalAmount),
      postedAt: toIso(receipt.postedAt),
      createdAt: toIso(receipt.createdAt),
      updatedAt: toIso(receipt.updatedAt),
      details: (receipt.details || []).map((detail) => ({
        id: detail.id,
        warehouseCode: detail.warehouseCode,
        orderedQty: toNumber(detail.orderedQty),
        receivedQty: toNumber(detail.receivedQty),
        quantity: toNumber(detail.quantity),
        unitPrice: toNumber(detail.unitPrice),
        totalLineAmount: toNumber(detail.totalLineAmount),
        note: detail.note,
        product: detail.product
          ? {
              id: detail.product.id,
              internalSku: detail.product.internalSku,
              name: detail.product.name,
              unit: detail.product.unit,
            }
          : null,
      })),
      totalQuantity: (receipt.details || []).reduce((sum, detail) => sum + toNumber(detail.quantity), 0),
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
