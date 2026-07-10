import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InboundReceipt } from './entities/inbound-receipt.entity';
import { InboundDetail } from './entities/inbound-detail.entity';
import { CreateAsnDto, PurchaseOrderItemDto } from './dto/create-asn.dto';
import { ReceiveDto } from './dto/receive.dto';
import { Supplier } from '../entities/supplier.entity';
import { Product } from '../entities/product.entity';
import { SupplierProduct } from '../entities/supplier-product.entity';
import { StockBalance } from '../inventory/entities/stock-balance.entity';

type SerializedPurchaseOrder = {
  id: string;
  poNumber: string;
  receiptNo: string;
  orderDate?: string;
  expectedDate?: string;
  status?: string;
  description?: string;
  totalAmount: number;
  supplier?: {
    id: string;
    supplierCode?: string;
    name: string;
  } | null;
  supplierName?: string;
  details: Array<{
    id: string;
    warehouseCode?: string;
    expectedQty: number;
    receivedQty: number;
    unitPrice: number;
    totalLineAmount: number;
    product?: {
      id: string;
      internalSku: string;
      name: string;
      unit?: string;
    } | null;
  }>;
  items: number;
};

function parseNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateString(value?: Date | string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

@Injectable()
export class InboundService {
  constructor(
    @InjectRepository(InboundReceipt) private receiptRepo: Repository<InboundReceipt>,
    @InjectRepository(InboundDetail) private detailRepo: Repository<InboundDetail>,
    @InjectRepository(Supplier) private supplierRepo: Repository<Supplier>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(SupplierProduct) private supplierProductRepo: Repository<SupplierProduct>,
    @InjectRepository(StockBalance) private balanceRepo: Repository<StockBalance>,
  ) {}

  async createReceipt(dto: CreateAsnDto, user?: any) {
    return this.createPurchaseOrder(dto, user);
  }

  async createPurchaseOrder(dto: CreateAsnDto, user?: any) {
    if (user?.role === 'supplier' && user?.supplierId) {
      dto.supplierId = user.supplierId;
    }
    const supplierId = typeof dto.supplierId === 'string' ? dto.supplierId.trim() : dto.supplierId;
    const supplier = supplierId ? await this.supplierRepo.findOneBy({ id: supplierId }) : null;

    const poNumber = await this.generatePoNumber(dto.poNumber || dto.shipmentNumber);
    // Ưu tiên: supplier entity name > supplierName text > undefined
    const supplierName = supplier?.name || dto.supplierName?.trim() || undefined;
    const receipt = this.receiptRepo.create({
      poNumber,
      orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
      expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined,
      status: dto.status || 'CREATED',
      description: dto.description?.trim() || undefined,
      supplier: supplier || undefined,
      supplierName,
      totalAmount: '0',
    });

    const savedReceipt = await this.receiptRepo.save(receipt);
    const details = await this.persistDetails(savedReceipt, dto.items || []);
    savedReceipt.totalAmount = details.reduce((sum, detail) => sum + (parseNumber(detail.unitPrice) * parseNumber(detail.expectedQty)), 0).toFixed(2);
    await this.receiptRepo.save(savedReceipt);

    return this.serializeReceipt(await this.findReceiptEntity(savedReceipt.id, user));
  }

  async updateReceipt(id: string, dto: CreateAsnDto, user?: any) {
    return this.updatePurchaseOrder(id, dto, user);
  }

  async updatePurchaseOrder(id: string, dto: CreateAsnDto, user?: any) {
    const receipt = await this.findReceiptEntity(id, user);

    if (user?.role === 'supplier' && user?.supplierId) {
      dto.supplierId = user.supplierId;
    }

    const supplierId = typeof dto.supplierId === 'string' ? dto.supplierId.trim() : dto.supplierId;
    if (supplierId) {
      const supplier = await this.supplierRepo.findOneBy({ id: supplierId });
      if (supplier) {
        receipt.supplier = supplier;
        receipt.supplierName = supplier.name;
      }
    }
    if (dto.supplierName !== undefined) {
      receipt.supplierName = dto.supplierName.trim() || receipt.supplierName;
    }

    const nextPoNumber = dto.poNumber || dto.shipmentNumber || receipt.poNumber;
    if (nextPoNumber && nextPoNumber !== receipt.poNumber) {
      const duplicate = await this.receiptRepo.findOne({ where: { poNumber: nextPoNumber } });
      if (duplicate && duplicate.id !== receipt.id) {
        throw new BadRequestException('PO number already exists');
      }
      receipt.poNumber = nextPoNumber;
    }

    if (dto.orderDate) receipt.orderDate = new Date(dto.orderDate);
    if (dto.expectedDate) receipt.expectedDate = new Date(dto.expectedDate);
    if (dto.status) receipt.status = dto.status;
    if (dto.description !== undefined) receipt.description = dto.description.trim() || undefined;

    if (dto.items) {
      console.log('[InboundService] updatePurchaseOrder received items:', JSON.stringify(dto.items));
      // Upsert details: update existing ones, create new ones, remove deleted ones
      const existingDetails = await this.detailRepo.find({
        where: { inboundReceipt: { id } as any },
        relations: ['inboundReceipt', 'product'],
      });

      const existingById = new Map<string, InboundDetail>();
      for (const d of existingDetails) existingById.set(String(d.id), d);

      const incomingIds = new Set<string>();

      for (const item of dto.items) {
        if (item.id && existingById.has(String(item.id))) {
          // update existing detail
          const exist = existingById.get(String(item.id));
          if (!exist) continue;
          const product = item.supplierProductId
            ? await this.resolveProductFromSupplierProduct(item.supplierProductId)
            : item.productId
              ? await this.productRepo.findOneBy({ id: item.productId })
              : exist.product;
          if (!product) throw new NotFoundException('Product not found');

          exist.product = product;
          exist.warehouseCode = item.warehouseCode?.trim() || exist.warehouseCode;
          exist.expectedQty = parseNumber(item.expectedQty ?? exist.expectedQty);
          exist.receivedQty = Math.min(parseNumber(item.receivedQty ?? exist.receivedQty), exist.expectedQty);
          exist.unitPrice = (parseNumber(item.unitPrice ?? parseNumber(exist.unitPrice))).toFixed(2);
          exist.totalLineAmount = (parseNumber(exist.unitPrice) * parseNumber(exist.expectedQty)).toFixed(2);

          await this.detailRepo.save(exist);
          incomingIds.add(String(exist.id));
        } else {
          // create new detail
          const detail = await this.buildDetail(receipt, item);
          const saved = await this.detailRepo.save(detail);
          incomingIds.add(String(saved.id));
        }
      }

      // remove details not present in incoming payload
      const toRemove = existingDetails.filter((d) => !incomingIds.has(String(d.id)));
      if (toRemove.length) {
        await this.detailRepo.remove(toRemove);
      }
    }

    await this.recalculateTotalAmount(receipt.id);
    await this.receiptRepo.save(receipt);
    return this.serializeReceipt(await this.findReceiptEntity(receipt.id));
  }

  async removeReceipt(id: string, user?: any) {
    const receipt = await this.findReceiptEntity(id, user);
    const details = await this.detailRepo.find({
      where: { inboundReceipt: { id } as any },
      relations: ['inboundReceipt', 'product'],
    });
    if (details.length) {
      await this.detailRepo.remove(details);
    }
    await this.receiptRepo.remove(receipt);
    return { deleted: true };
  }

  async approveReceipt(id: string, user?: any) {
    const receipt = await this.findReceiptEntity(id, user);
    receipt.status = 'APPROVED';
    await this.receiptRepo.save(receipt);
    return this.serializeReceipt(await this.findReceiptEntity(id, user));
  }

  async completeReceipt(id: string, user?: any) {
    const receipt = await this.findReceiptEntity(id, user);
    const details = receipt.details || [];

    const hasMissing = details.some((detail) => parseNumber(detail.receivedQty) < parseNumber(detail.expectedQty));
    if (hasMissing) {
      throw new BadRequestException('Vui lòng nhận đủ số lượng trước khi hoàn thành đơn mua hàng');
    }

    receipt.status = 'RECEIVED';
    await this.receiptRepo.save(receipt);
    return this.serializeReceipt(await this.findReceiptEntity(id, user));
  }

  async addDetail(receiptId: string, dto: any, user?: any) {
    const receipt = await this.findReceiptEntity(receiptId, user);
    const detail = await this.buildDetail(receipt, dto);
    await this.detailRepo.save(detail);
    await this.recalculateTotalAmount(receipt.id);
    return this.serializeReceipt(await this.findReceiptEntity(receipt.id, user));
  }

  async receive(detailId: string, dto: ReceiveDto, user?: any) {
    if (dto.items?.length) {
      const results = [];
      for (const item of dto.items) {
        results.push(await this.receiveOne(item.detailId, item.qty));
      }
      return results;
    }

    if (!dto.detailId) {
      throw new BadRequestException('detailId is required');
    }

    return this.receiveOne(dto.detailId, parseNumber(dto.qty));
  }

  async receiveOne(detailId: string, qty: number) {
    const detail = await this.detailRepo.findOne({
      where: { id: detailId },
      relations: ['inboundReceipt', 'product'],
    });
    if (!detail) throw new NotFoundException('Detail not found');
    if (qty <= 0) throw new BadRequestException('qty must be positive');

    const nextReceived = parseNumber(detail.receivedQty) + qty;
    if (nextReceived > parseNumber(detail.expectedQty)) {
      throw new BadRequestException('Received quantity cannot exceed ordered quantity');
    }

    detail.receivedQty = nextReceived;
    await this.detailRepo.save(detail);
    await this.adjustInventory(detail.product.id, detail.warehouseCode || 'DEFAULT', qty);
    await this.syncReceiptStatus(detail.inboundReceipt.id);
    return this.serializeDetail(detail);
  }

  async findOne(id: string, user?: any) {
    return this.serializeReceipt(await this.findReceiptEntity(id, user));
  }

  async findAll(user?: any) {
    const whereClause: any = {};
    if (user?.role === 'supplier' && user?.supplierId) {
      whereClause.supplier = { id: user.supplierId };
    } else if (user?.role === 'customer') {
      return [];
    }

    const receipts = await this.receiptRepo.find({
      where: whereClause,
      relations: ['details', 'details.product', 'supplier'],
      order: { id: 'DESC' },
    });
    return receipts.map((receipt) => this.serializeReceipt(receipt));
  }

  async findPurchaseOrders(user?: any) {
    return this.findAll(user);
  }

  async findPurchaseOrder(id: string, user?: any) {
    return this.findOne(id, user);
  }

  private async findReceiptEntity(id: string, user?: any) {
    const whereClause: any = { id };
    if (user?.role === 'supplier' && user?.supplierId) {
      whereClause.supplier = { id: user.supplierId };
    }

    const receipt = await this.receiptRepo.findOne({
      where: whereClause,
      relations: ['details', 'details.product', 'supplier'],
    });

    if (!receipt) {
      throw new NotFoundException('Receipt not found or access denied');
    }

    return receipt;
  }

  private async persistDetails(receipt: InboundReceipt, items: PurchaseOrderItemDto[]) {
    const savedDetails: InboundDetail[] = [];

    for (const item of items) {
      const detail = await this.buildDetail(receipt, item);
      savedDetails.push(await this.detailRepo.save(detail));
    }

    return savedDetails;
  }

  private async buildDetail(receipt: InboundReceipt, item: PurchaseOrderItemDto) {
    const product = item.supplierProductId
      ? await this.resolveProductFromSupplierProduct(item.supplierProductId)
      : item.productId
        ? await this.productRepo.findOneBy({ id: item.productId })
        : null;

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const unitPrice = parseNumber(item.unitPrice ?? await this.resolveDefaultUnitPrice(product.id));
    const expectedQty = parseNumber(item.expectedQty);
    const receivedQty = Math.min(parseNumber(item.receivedQty), expectedQty);

    return this.detailRepo.create({
      inboundReceipt: receipt,
      product,
      warehouseCode: item.warehouseCode?.trim() || undefined,
      expectedQty,
      receivedQty,
      unitPrice: unitPrice.toFixed(2),
      totalLineAmount: (unitPrice * expectedQty).toFixed(2),
    });
  }

  private async resolveProductFromSupplierProduct(supplierProductId: string) {
    const supplierProduct = await this.supplierProductRepo.findOne({
      where: { id: supplierProductId },
      relations: ['product'],
    });
    if (!supplierProduct?.product) {
      throw new NotFoundException('Supplier product not found');
    }
    return supplierProduct.product;
  }

  private async resolveDefaultUnitPrice(productId: string) {
    const supplierProduct = await this.supplierProductRepo.findOne({
      where: { product: { id: productId } as any },
      relations: ['product'],
      order: { isPrimary: 'DESC' as const },
    });
    return parseNumber(supplierProduct?.purchasePrice);
  }

  private async syncReceiptStatus(receiptId: string) {
    const receipt = await this.findReceiptEntity(receiptId);
    const details = receipt.details || [];
    const allReceived = details.length > 0 && details.every((detail) => parseNumber(detail.receivedQty) >= parseNumber(detail.expectedQty));
    const someReceived = details.some((detail) => parseNumber(detail.receivedQty) > 0);

    if (allReceived) {
      receipt.status = 'RECEIVED';
    } else if (someReceived) {
      receipt.status = 'PARTIALLY_RECEIVED';
    } else if (!receipt.status || receipt.status === 'APPROVED') {
      receipt.status = 'CREATED';
    }

    await this.receiptRepo.save(receipt);
  }

  private async recalculateTotalAmount(receiptId: string) {
    const details = await this.detailRepo.find({
      where: { inboundReceipt: { id: receiptId } as any },
      relations: ['inboundReceipt', 'product'],
    });

    const totalAmount = details.reduce((sum, detail) => sum + (parseNumber(detail.unitPrice) * parseNumber(detail.expectedQty)), 0);
    await this.receiptRepo.update(receiptId, { totalAmount: totalAmount.toFixed(2) });
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

    const balance = this.balanceRepo.create({
      product,
      locationCode,
      totalPhysical: qty,
      allocated: 0,
      available: qty,
    });

    return this.balanceRepo.save(balance);
  }

  private serializeReceipt(receipt: InboundReceipt): SerializedPurchaseOrder {
    // Hiển thị NCC: ưu tiên supplier entity > supplierName text
    const supplierDisplay = receipt.supplier
      ? {
          id: receipt.supplier.id,
          supplierCode: receipt.supplier.supplierCode,
          name: receipt.supplier.name,
        }
      : receipt.supplierName
        ? { id: '', supplierCode: '', name: receipt.supplierName }
        : null;

    const details = receipt.details || [];
    const computedTotal = details.length > 0 
      ? details.reduce((sum, d) => sum + (parseNumber(d.unitPrice) * parseNumber(d.expectedQty)), 0)
      : parseNumber(receipt.totalAmount);

    return {
      id: receipt.id,
      poNumber: receipt.poNumber || `DMH${String(receipt.id).padStart(5, '0')}`,
      receiptNo: receipt.poNumber || `DMH${String(receipt.id).padStart(5, '0')}`,
      orderDate: toDateString(receipt.orderDate),
      expectedDate: toDateString(receipt.expectedDate),
      status: receipt.status,
      description: receipt.description,
      totalAmount: computedTotal,
      supplier: supplierDisplay,
      supplierName: receipt.supplierName || receipt.supplier?.name || undefined,
      details: details.map((detail) => this.serializeDetail(detail)),
      items: details.length,
    };
  }

  private serializeDetail(detail: InboundDetail) {
    return {
      id: detail.id,
      warehouseCode: detail.warehouseCode,
      expectedQty: parseNumber(detail.expectedQty),
      receivedQty: parseNumber(detail.receivedQty),
      unitPrice: parseNumber(detail.unitPrice),
      totalLineAmount: parseNumber(detail.unitPrice) * parseNumber(detail.expectedQty),
      product: detail.product
        ? {
            id: detail.product.id,
            internalSku: detail.product.internalSku,
            name: detail.product.name,
            unit: detail.product.unit,
          }
        : null,
    };
  }

  private async generatePoNumber(preferred?: string) {
    const requested = preferred?.trim().toUpperCase();
    if (requested) {
      const duplicate = await this.receiptRepo.findOne({ where: { poNumber: requested } });
      if (!duplicate) return requested;
    }

    const total = await this.receiptRepo.count();
    let index = total + 1;
    let code = `DMH${String(index).padStart(5, '0')}`;

    while (await this.receiptRepo.findOne({ where: { poNumber: code } })) {
      index += 1;
      code = `DMH${String(index).padStart(5, '0')}`;
    }

    return code;
  }
}
