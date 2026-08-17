import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, DataSource } from 'typeorm';
import { InboundReceipt } from './entities/inbound-receipt.entity';
import { InboundDetail } from './entities/inbound-detail.entity';
import { CreateAsnDto, PurchaseOrderItemDto } from './dto/create-asn.dto';
import { ReceiveDto } from './dto/receive.dto';
import { StockInReceiptDetail } from './stock-in-receipts/entities/stock-in-receipt-detail.entity';
import { Supplier } from '../entities/supplier.entity';
import { Product } from '../entities/product.entity';
import { SupplierProduct } from '../entities/supplier-product.entity';
import { StockBalance } from '../inventory/entities/stock-balance.entity';
import { NotificationsService } from '../notifications/notifications.service';

type SerializedPurchaseOrder = {
  id: string;
  poNumber: string;
  receiptNo: string;
  orderDate?: string;
  expectedDate?: string;
  status?: string;
  approverId?: string;
  approverName?: string;
  creatorName?: string;
  creatorPhone?: string;
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
    supplierPrice?: number | null;
    rounds?: Array<{ round: number; supplierPrice?: number | null; enterprisePrice?: number | null; enterpriseResponded?: boolean }>;
    listPrice?: number;
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

function parseCustomDate(val?: string | Date | null): Date {
  if (!val) return new Date();
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
  const str = String(val).trim();
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    return new Date(year, month, day, 12, 0, 0);
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
}

function toDateString(value?: Date | string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizeStatus(status?: string) {
  return status ? status.toUpperCase() : '';
}

export function isEditablePurchaseOrderStatus(status?: string) {
  const norm = normalizeStatus(status);
  return !status || norm === 'CREATED' || norm === 'DRAFT' || norm === 'REJECTED' || norm === 'RECEIVED' || norm === 'COMPLETED';
}

function isManagerApprovalReady(status?: string) {
  return normalizeStatus(status) === 'CREATED';
}

function isSupplierApprovalReady(status?: string) {
  return normalizeStatus(status) === 'APPROVED';
}

function isReceivingReady(status?: string) {
  const normalized = normalizeStatus(status);
  return normalized === 'SUPPLIER_APPROVED' || normalized === 'PARTIALLY_RECEIVED' || normalized === 'RECEIVED' || normalized === 'COMPLETED';
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
    @InjectRepository(StockInReceiptDetail) private stockInReceiptDetailRepo: Repository<StockInReceiptDetail>,
    private readonly notificationsService: NotificationsService,
    private dataSource: DataSource,
  ) { }

  async createReceipt(dto: CreateAsnDto, user?: any) {
    return this.createPurchaseOrder(dto, user);
  }

  async createPurchaseOrder(dto: CreateAsnDto, user?: any) {
    if (user?.role === 'supplier' && user?.supplierId) {
      dto.supplierId = user.supplierId;
    }
    let supplier: Supplier | null = null;
    if (dto.supplierId && /^\d+$/.test(String(dto.supplierId))) {
      supplier = await this.supplierRepo.findOneBy({ id: String(dto.supplierId) });
    }

    const supplierText = (dto.supplierName || '').trim();
    if (!supplier && supplierText) {
      supplier = await this.supplierRepo.findOne({
        where: [{ name: supplierText }, { supplierCode: supplierText }],
      });

      if (!supplier) {
        try {
          const newSup = this.supplierRepo.create({
            name: supplierText,
            supplierCode: 'NCC-' + Date.now().toString().slice(-6),
          });
          supplier = await this.supplierRepo.save(newSup);
        } catch {}
      }
    }

    const poNumber = await this.generatePoNumber(dto.poNumber || dto.receiptNo || dto.shipmentNumber);
    const supplierName = supplier?.name || supplierText || undefined;
    const orderDate = dto.orderDate ? parseCustomDate(dto.orderDate) : new Date();
    const expectedDate = dto.expectedDate ? parseCustomDate(dto.expectedDate) : undefined;

    const receipt = this.receiptRepo.create({
      poNumber,
      orderDate,
      expectedDate,
      status: dto.status || 'RECEIVED',
      approverId: dto.approverId?.trim() || undefined,
      approverName: dto.approverName?.trim() || undefined,
      creatorName: dto.creatorName?.trim() || undefined,
      creatorPhone: dto.creatorPhone?.trim() || undefined,
      description: dto.description?.trim() || undefined,
      supplier: supplier || undefined,
      supplierName,
      totalAmount: parseNumber(dto.totalAmount).toFixed(2),
    });

    const savedReceipt = await this.receiptRepo.save(receipt);
    const rawItems = (dto.details && dto.details.length) ? dto.details : (dto.items || []);
    const details = await this.persistDetails(savedReceipt, rawItems, dto.warehouseCode || dto.branchCode);

    if (details.length > 0) {
      savedReceipt.totalAmount = details.reduce((sum, detail) => sum + (parseNumber(detail.unitPrice) * parseNumber(detail.expectedQty || detail.receivedQty)), 0).toFixed(2);
      await this.receiptRepo.save(savedReceipt);
      // Tăng tồn kho thực tế trong MySQL
      await this.applyInboundStockAddition(savedReceipt, details);
    }

    if (savedReceipt.status !== 'DRAFT') {
      try {
        if (savedReceipt.approverId) {
          await this.notificationsService.notifyUser(savedReceipt.approverId, {
            title: `Đơn nhập hàng ${savedReceipt.poNumber}`,
            message: `Đơn nhập hàng ${savedReceipt.poNumber} đã được tạo thành công.`,
            link: '/inbound/stock-in-orders',
            referenceType: 'purchase-order',
            referenceId: savedReceipt.id,
            priority: 'high',
          });
        }
      } catch {}
    }

    return this.serializeReceipt(await this.findReceiptEntity(savedReceipt.id, user));
  }

  async updateReceipt(id: string, dto: CreateAsnDto, user?: any) {
    return this.updatePurchaseOrder(id, dto, user);
  }

  async updatePurchaseOrder(id: string, dto: CreateAsnDto, user?: any) {
    const receipt = await this.findReceiptEntity(id, user);

    const isDraft = ['DRAFT', 'draft', 'DRAFT_PO'].includes(receipt.status || '');
    if (!isDraft) {
      throw new BadRequestException(
        `Chỉ có thể chỉnh sửa phiếu nhập kho ở trạng thái Đơn nháp (DRAFT). Phiếu đã lưu chính thức (${receipt.status || 'Đã nhập kho'}) không thể chỉnh sửa.`
      );
    }

    if (user?.role === 'supplier' && user?.supplierId) {
      dto.supplierId = user.supplierId;
    }

    let supplier: Supplier | null = null;
    if (dto.supplierId && /^\d+$/.test(String(dto.supplierId))) {
      supplier = await this.supplierRepo.findOneBy({ id: String(dto.supplierId) });
      if (supplier) {
        receipt.supplier = supplier;
        receipt.supplierName = supplier.name;
      }
    }
    if (dto.supplierName !== undefined) {
      receipt.supplierName = dto.supplierName.trim() || receipt.supplierName;
    }

    const nextPoNumber = dto.poNumber || dto.receiptNo || dto.shipmentNumber || receipt.poNumber;
    if (nextPoNumber && nextPoNumber !== receipt.poNumber) {
      const duplicate = await this.receiptRepo.findOne({ where: { poNumber: nextPoNumber } });
      if (duplicate && duplicate.id !== receipt.id) {
        throw new BadRequestException('Mã phiếu nhập đã tồn tại');
      }
      receipt.poNumber = nextPoNumber;
    }

    if (dto.orderDate) receipt.orderDate = parseCustomDate(dto.orderDate);
    if (dto.expectedDate) receipt.expectedDate = parseCustomDate(dto.expectedDate);
    if (dto.description !== undefined) receipt.description = dto.description ? dto.description.trim() : undefined;
    if (dto.approverId !== undefined) receipt.approverId = dto.approverId ? dto.approverId.trim() : undefined;
    if (dto.approverName !== undefined) receipt.approverName = dto.approverName ? dto.approverName.trim() : undefined;
    if (dto.creatorName !== undefined) receipt.creatorName = dto.creatorName ? dto.creatorName.trim() : undefined;
    if (dto.creatorPhone !== undefined) receipt.creatorPhone = dto.creatorPhone ? dto.creatorPhone.trim() : undefined;

    if (dto.status !== undefined) {
      receipt.status = dto.status;
    }

    const rawItems = (dto.details && dto.details.length) ? dto.details : dto.items;
    if (rawItems && rawItems.length) {
      // Revert previous inventory addition
      await this.revertInboundStockAddition(receipt);

      const existingDetails = await this.detailRepo.find({
        where: { inboundReceipt: { id } as any },
        relations: ['inboundReceipt', 'product'],
      });
      if (existingDetails.length) {
        await this.detailRepo.remove(existingDetails);
      }

      const savedDetails = await this.persistDetails(receipt, rawItems, dto.warehouseCode || dto.branchCode);
      await this.applyInboundStockAddition(receipt, savedDetails);
    }

    await this.recalculateTotalAmount(receipt.id);
    await this.receiptRepo.save(receipt);

    return this.serializeReceipt(await this.findReceiptEntity(receipt.id));
  }

  async removeReceipt(id: string, user?: any) {
    const receipt = await this.findReceiptEntity(id, user);

    // Revert inventory before deletion
    await this.revertInboundStockAddition(receipt);

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

    if (receipt.status === 'REJECTED') {
      const details = receipt.details || [];
      let hasSupplierPrices = false;
      for (const d of details) {
        if (d.supplierPrice && Number(d.supplierPrice) > 0) {
          hasSupplierPrices = true;
          break;
        }
      }
      if (hasSupplierPrices) {
        // Manager agreed to supplier prices
        for (const detail of details) {
          if (detail.supplierPrice && Number(detail.supplierPrice) > 0) {
            detail.unitPrice = detail.supplierPrice;
            detail.totalLineAmount = (Number(detail.unitPrice) * detail.expectedQty).toFixed(2);
            await this.detailRepo.save(detail);
          }
        }
        await this.recalculateTotalAmount(receipt.id);
        receipt.status = 'SUPPLIER_APPROVED';
        await this.receiptRepo.save(receipt);

        if (receipt.supplier?.id) {
          await this.notificationsService.notifySupplier(receipt.supplier.id, {
            title: `Đơn mua hàng ${receipt.poNumber} đã thống nhất giá`,
            message: `Quản lý đã chấp nhận giá đề xuất của bạn cho đơn hàng ${receipt.poNumber}. Đơn hàng đã được duyệt hoàn tất.`,
            link: '/supplier-portal',
            referenceType: 'purchase-order',
            referenceId: receipt.id,
            priority: 'high',
          });
        }
        return this.serializeReceipt(await this.findReceiptEntity(id, user));
      }
    }

    receipt.status = 'APPROVED';
    await this.receiptRepo.save(receipt);

    // Thông báo cho nhà cung cấp khi Quản lý đã duyệt đơn
    if (receipt.supplier?.id) {
      await this.notificationsService.notifySupplier(receipt.supplier.id, {
        title: `Đơn mua hàng ${receipt.poNumber} đã được quản lý duyệt`,
        message: `Quản lý đã duyệt đơn mua hàng ${receipt.poNumber}. Vui lòng kiểm tra, xác nhận hoặc gửi báo giá phản hồi.`,
        link: '/supplier-portal',
        referenceType: 'purchase-order',
        referenceId: receipt.id,
        priority: 'high',
      });
    } else {
      await this.notificationsService.notifyRole('supplier', {
        title: `Đơn mua hàng mới ${receipt.poNumber} cần xác nhận`,
        message: `Đơn mua hàng ${receipt.poNumber} đã được quản lý duyệt. Vui lòng vào Cổng nhà cung cấp để kiểm tra.`,
        link: '/supplier-portal',
        referenceType: 'purchase-order',
        referenceId: receipt.id,
        priority: 'high',
      });
    }

    return this.serializeReceipt(await this.findReceiptEntity(id, user));
  }

  async completeReceipt(id: string, user?: any) {
    const receipt = await this.findReceiptEntity(id, user);
    if (!isReceivingReady(receipt.status)) {
      throw new BadRequestException('Purchase order must be approved by supplier before completion');
    }
    const details = receipt.details || [];

    const hasMissing = details.some((detail) => parseNumber(detail.receivedQty) < parseNumber(detail.expectedQty));
    if (hasMissing) {
      throw new BadRequestException('Vui lòng nhận đủ số lượng trước khi hoàn thành đơn mua hàng');
    }

    receipt.status = 'RECEIVED';
    await this.receiptRepo.save(receipt);

    await this.notificationsService.notifyRole('manager', {
      title: `Đơn mua hàng ${receipt.poNumber} đã hoàn thành`,
      message: `Đơn mua hàng ${receipt.poNumber} đã được nhập kho đầy đủ và hoàn thành.`,
      link: '/inbound/purchase-orders',
      referenceType: 'purchase-order',
      referenceId: receipt.id,
    });

    return this.serializeReceipt(await this.findReceiptEntity(id, user));
  }

  async supplierApproveReceipt(id: string, body: { expectedDate?: string; description?: string }, user?: any) {
    const receipt = await this.findReceiptEntity(id, user);
    if (receipt.status !== 'APPROVED' && receipt.status !== 'REJECTED' && receipt.status !== 'CREATED') {
      throw new BadRequestException('Chỉ có thể duyệt đơn hàng đang ở trạng thái Chờ NCC xác nhận');
    }
    receipt.status = 'SUPPLIER_APPROVED';
    if (body.expectedDate) receipt.expectedDate = new Date(body.expectedDate);
    if (body.description) receipt.description = body.description;
    await this.receiptRepo.save(receipt);

    // Thông báo cho Quản lý / Bên mua
    await this.notificationsService.notifyRole('manager', {
      title: `NCC đã xác nhận đơn hàng ${receipt.poNumber}`,
      message: `Nhà cung cấp ${receipt.supplierName || receipt.supplier?.name || ''} đã duyệt và xác nhận đơn mua hàng ${receipt.poNumber}.`,
      link: '/inbound/purchase-orders',
      referenceType: 'purchase-order',
      referenceId: receipt.id,
      priority: 'high',
    });

    return this.serializeReceipt(await this.findReceiptEntity(id, user));
  }

  async supplierRejectReceipt(id: string, body: { reason?: string }, user?: any) {
    const receipt = await this.findReceiptEntity(id, user);
    if (receipt.status !== 'APPROVED') {
      throw new BadRequestException('Chỉ có thể từ chối đơn hàng đang ở trạng thái Chờ NCC xác nhận');
    }
    receipt.status = 'REJECTED';
    if (body.reason) receipt.description = (receipt.description ? receipt.description + '\n' : '') + `Lý do từ chối: ${body.reason}`;
    await this.receiptRepo.save(receipt);

    // Thông báo cho Quản lý
    await this.notificationsService.notifyRole('manager', {
      title: `NCC từ chối đơn hàng ${receipt.poNumber}`,
      message: `Nhà cung cấp ${receipt.supplierName || receipt.supplier?.name || ''} đã từ chối đơn hàng ${receipt.poNumber}. Lý do: ${body.reason || 'Không rõ'}`,
      link: '/inbound/purchase-orders',
      referenceType: 'purchase-order',
      referenceId: receipt.id,
      priority: 'high',
    });

    return this.serializeReceipt(await this.findReceiptEntity(id, user));
  }

  async supplierNegotiateReceipt(id: string, body: { items?: Array<{ detailId: string; supplierPrice: number }>; reason?: string }, user?: any) {
    const receipt = await this.findReceiptEntity(id, user);
    // REJECTED trong luồng này có nghĩa là doanh nghiệp đã gửi giá thương lượng
    // và đang chờ nhà cung cấp phản hồi tiếp, không phải đơn bị hủy.
    if (receipt.status !== 'APPROVED' && receipt.status !== 'CREATED' && receipt.status !== 'REJECTED') {
      throw new BadRequestException('Chỉ có thể phản hồi giá với đơn hàng chưa chốt');
    }
    
    let priceNotes = '';
    if (body.items?.length) {
      for (const item of body.items) {
        const detail = await this.detailRepo.findOne({ where: { id: item.detailId }, relations: ['product'] });
        if (detail) {
          const oldPrice = Number(detail.unitPrice || 0);
          const newPrice = Number(item.supplierPrice || 0);

          detail.supplierPrice = newPrice.toFixed(2);
          const history = Array.isArray(detail.negotiationHistory) ? detail.negotiationHistory : [];
          detail.negotiationHistory = [...history, { round: history.length + 1, supplierPrice: newPrice, enterprisePrice: null, enterpriseResponded: false }];
          await this.detailRepo.save(detail);

          priceNotes += `• ${detail.product?.name || 'Mặt hàng'}: Báo giá NCC ${newPrice.toLocaleString('vi-VN')} VNĐ (Giá mua ${oldPrice.toLocaleString('vi-VN')} VNĐ)\n`;
        }
      }
    }

    const note = body.reason || 'Nhà cung cấp gửi phản hồi điều chỉnh báo giá.';
    receipt.description = `[PHẢN HỒI BÁO GIÁ TỪ NCC]: ${note}\n${priceNotes}` + (receipt.description ? `\n---\n${receipt.description}` : '');
    receipt.status = 'REJECTED';
    await this.receiptRepo.save(receipt);

    // Thông báo cho Quản lý
    await this.notificationsService.notifyRole('manager', {
      title: `Phản hồi giá từ NCC cho đơn hàng ${receipt.poNumber}`,
      message: `Nhà cung cấp ${receipt.supplierName || receipt.supplier?.name || ''} vừa gửi phản hồi giá cho đơn hàng ${receipt.poNumber}. Vui lòng kiểm tra và duyệt lại giá.`,
      link: '/inbound/purchase-orders',
      referenceType: 'purchase-order',
      referenceId: receipt.id,
      priority: 'high',
    });

    return this.serializeReceipt(await this.findReceiptEntity(id, user));
  }

  async enterprisePriceFeedback(id: string, body: { items?: Array<{ detailId: string; newPrice: number }>; note?: string; acceptedSupplierPrice?: boolean }, user?: any) {
    const receipt = await this.findReceiptEntity(id, user);
    if (!isEditablePurchaseOrderStatus(receipt.status)) {
      throw new BadRequestException('Chỉ có thể phản hồi giá với đơn hàng đang thương lượng');
    }
    for (const item of body.items || []) {
      const detail = await this.detailRepo.findOne({ where: { id: item.detailId }, relations: ['product'] });
      if (!detail) continue;
      const enterprisePrice = parseNumber(item.newPrice);
      const supplierPrice = parseNumber(detail.supplierPrice ?? detail.unitPrice);
      const history = Array.isArray(detail.negotiationHistory) ? detail.negotiationHistory : [];
      const openRoundIndex = [...history].reverse().findIndex((round) => round.enterprisePrice == null && round.supplierPrice != null);
      if (openRoundIndex >= 0) {
        const index = history.length - 1 - openRoundIndex;
        history[index] = { ...history[index], enterprisePrice, enterpriseResponded: true };
        detail.negotiationHistory = history;
      } else {
        detail.negotiationHistory = [...history, { round: history.length + 1, supplierPrice, enterprisePrice, enterpriseResponded: true }];
      }
      detail.unitPrice = (body.acceptedSupplierPrice ? supplierPrice : enterprisePrice).toFixed(2);
      detail.totalLineAmount = (parseNumber(detail.unitPrice) * parseNumber(detail.expectedQty)).toFixed(2);
      await this.detailRepo.save(detail);
    }
    receipt.status = body.acceptedSupplierPrice ? 'SUPPLIER_APPROVED' : 'REJECTED';
    if (body.note?.trim()) receipt.description = `[PHẢN HỒI GIÁ DOANH NGHIỆP]: ${body.note.trim()}${receipt.description ? `\n---\n${receipt.description}` : ''}`;
    await this.recalculateTotalAmount(receipt.id);
    await this.receiptRepo.save(receipt);

    // Gửi thông báo đến Nhà cung cấp
    if (receipt.supplier?.id) {
      await this.notificationsService.notifySupplier(receipt.supplier.id, {
        title: body.acceptedSupplierPrice
          ? `Doanh nghiệp đã đồng ý giá đơn hàng ${receipt.poNumber}`
          : `Phản hồi giá từ Doanh nghiệp cho đơn hàng ${receipt.poNumber}`,
        message: body.acceptedSupplierPrice
          ? `Doanh nghiệp đã chấp nhận báo giá đề xuất cho đơn hàng ${receipt.poNumber}.`
          : `Doanh nghiệp đã gửi đề xuất phản hồi giá mới cho đơn hàng ${receipt.poNumber}. Vui lòng kiểm tra và phản hồi lại.`,
        link: '/supplier-portal',
        referenceType: 'purchase-order',
        referenceId: receipt.id,
        priority: 'high',
      });
    }

    return this.serializeReceipt(await this.findReceiptEntity(id, user));
  }

  async addDetail(receiptId: string, dto: any, user?: any) {
    const receipt = await this.findReceiptEntity(receiptId, user);
    if (!isEditablePurchaseOrderStatus(receipt.status)) {
      throw new BadRequestException('Only draft purchase orders can add details');
    }
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
    if (!isReceivingReady(detail.inboundReceipt?.status)) {
      throw new BadRequestException('Purchase order must be approved by supplier before receiving goods');
    }

    const nextReceived = parseNumber(detail.receivedQty) + qty;
    if (nextReceived > parseNumber(detail.expectedQty)) {
      throw new BadRequestException('Received quantity cannot exceed ordered quantity');
    }

    detail.receivedQty = nextReceived;
    await this.detailRepo.save(detail);
    await this.syncReceiptStatus(detail.inboundReceipt.id);

    // Sync to corresponding StockInReceiptDetail if exists
    if (detail.inboundReceipt.poNumber) {
      await this.stockInReceiptDetailRepo
        .createQueryBuilder()
        .update(StockInReceiptDetail)
        .set({ receivedQty: nextReceived })
        .where('product.id = :productId', { productId: detail.product.id })
        .andWhere('receipt.id IN (SELECT id FROM stock_in_receipts WHERE sourceReferenceNo = :poNumber)', { poNumber: detail.inboundReceipt.poNumber })
        .execute();
    }

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
    });
    receipts.sort((a, b) => Number(b.id) - Number(a.id));
    return Promise.all(receipts.map((receipt) => this.serializeReceipt(receipt)));
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

  private async persistDetails(receipt: InboundReceipt, items: PurchaseOrderItemDto[], defaultWarehouseCode?: string) {
    const savedDetails: InboundDetail[] = [];

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
      if (!product && item.supplierProductId) {
        product = await this.resolveProductFromSupplierProduct(item.supplierProductId);
      }

      const qty = parseNumber(item.receivedQty ?? item.expectedQty ?? item.qty);
      if (qty <= 0 && !item.productName && !item.productSku && !item.productId) continue;

      const unitPrice = parseNumber(item.unitPrice ?? item.price ?? (product?.price || 0));
      const discPercent = parseNumber(item.discountPercent || (item as any).discount);
      const vatPercent = parseNumber(item.vatPercent || (item as any).vatRate);

      const lineTotalBeforeDisc = unitPrice * qty;
      const discAmount = (lineTotalBeforeDisc * discPercent) / 100;
      const lineTotalAfterDisc = Math.max(0, lineTotalBeforeDisc - discAmount);
      const vatAmount = (lineTotalAfterDisc * vatPercent) / 100;
      const calcTotalLine = lineTotalAfterDisc + vatAmount;
      const totalLineAmount = (item.totalAmount && parseNumber(item.totalAmount) > 0)
        ? parseNumber(item.totalAmount)
        : calcTotalLine;

      const targetWhCode = item.warehouseCode?.trim() || defaultWarehouseCode?.trim() || 'KHO-NVL';

      const assignedStr = (item as any).locationBin || (Array.isArray((item as any).assignedBins) ? (item as any).assignedBins.join(', ') : '');
      let noteContent = item.note ? String(item.note) : '';
      if (assignedStr && !noteContent.includes('[Vị trí Ô:')) {
        noteContent = noteContent
          ? `${noteContent} [Vị trí Ô: ${assignedStr}]`
          : `[Vị trí Ô: ${assignedStr}]`;
      }

      const detail = this.detailRepo.create({
        inboundReceipt: receipt,
        product: product || undefined,
        warehouseCode: targetWhCode,
        expectedQty: qty,
        receivedQty: qty,
        unitPrice: unitPrice.toFixed(2),
        requestedPrice: unitPrice.toFixed(2),
        discountPercent: discPercent,
        vatPercent: vatPercent,
        totalLineAmount: totalLineAmount.toFixed(2),
        weight: Math.min(999999.99, parseNumber(item.weight)),
        length: Math.min(999999.99, parseNumber(item.length)),
        width: Math.min(999999.99, parseNumber(item.width)),
        height: Math.min(999999.99, parseNumber(item.height)),
        volume: Math.min(999999.9999, parseNumber(item.volume)),
        volumetricWeight: Math.min(999999.99, parseNumber(item.volumetricWeight)),
        note: noteContent || undefined,
      });

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
    const expectedQty = parseNumber(item.expectedQty ?? item.qty);
    const receivedQty = Math.min(parseNumber(item.receivedQty ?? item.qty), expectedQty);

    return this.detailRepo.create({
      inboundReceipt: receipt,
      product,
      warehouseCode: item.warehouseCode?.trim() || undefined,
      expectedQty,
      receivedQty,
      unitPrice: unitPrice.toFixed(2),
      requestedPrice: unitPrice.toFixed(2),
      totalLineAmount: (unitPrice * expectedQty).toFixed(2),
      weight: parseNumber(item.weight),
      length: parseNumber(item.length),
      width: parseNumber(item.width),
      height: parseNumber(item.height),
      volume: parseNumber(item.volume),
      volumetricWeight: parseNumber(item.volumetricWeight),
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
    } else if (!receipt.status || receipt.status === 'SUPPLIER_APPROVED') {
      receipt.status = 'SUPPLIER_APPROVED';
    }

    await this.receiptRepo.save(receipt);
  }

  private async recalculateTotalAmount(receiptId: string) {
    const details = await this.detailRepo.find({
      where: { inboundReceipt: { id: receiptId } as any },
      relations: ['inboundReceipt', 'product'],
    });

    const totalAmount = details.reduce((sum, detail) => sum + parseNumber(detail.totalLineAmount || (parseNumber(detail.unitPrice) * parseNumber(detail.expectedQty))), 0);
    await this.receiptRepo.update(receiptId, { totalAmount: totalAmount.toFixed(2) });
  }

  private async applyInboundStockAddition(receipt: InboundReceipt, details: InboundDetail[]) {
    for (const detail of details) {
      let productId = detail.product?.id;
      if (!productId) continue;

      const mainWhCode = detail.warehouseCode || 'KHO-NVL';
      const noteText = detail.note || '';

      const specificBins: string[] = [];
      if (noteText.includes('[Vị trí Ô:')) {
        const match = noteText.match(/\[Vị trí Ô:\s*([^\]]+)\]/);
        if (match && match[1]) {
          match[1].split(',').forEach((c) => {
            const trimmed = c.trim();
            if (trimmed) specificBins.push(trimmed);
          });
        }
      }

      const qty = Number(detail.receivedQty || detail.expectedQty) || 0;
      const targetLocations = specificBins.length > 0 ? specificBins : [mainWhCode];
      const qtyPerBin = Math.max(1, Math.floor(qty / targetLocations.length));

      for (const locCode of targetLocations) {
        let [balance] = await this.dataSource.query(
          `SELECT id, totalPhysical, allocated, available FROM stock_balances WHERE productId = ? AND locationCode = ? LIMIT 1`,
          [productId, locCode],
        );

        if (!balance) {
          const insertRes = await this.dataSource.query(
            `INSERT INTO stock_balances (productId, locationCode, totalPhysical, allocated, available) VALUES (?, ?, 0, 0, 0)`,
            [productId, locCode],
          );
          balance = { id: insertRes.insertId, totalPhysical: 0, allocated: 0, available: 0 };
        }

        const newPhysical = Number(balance.totalPhysical) + qtyPerBin;
        const newAvailable = Math.max(0, newPhysical - Number(balance.allocated));

        await this.dataSource.query(
          `UPDATE stock_balances SET totalPhysical = ?, available = ? WHERE id = ?`,
          [newPhysical, newAvailable, balance.id],
        );
      }

      // Also ensure main warehouse code balance is updated if specific bins were targeted
      if (specificBins.length > 0 && !specificBins.includes(mainWhCode)) {
        let [mainBalance] = await this.dataSource.query(
          `SELECT id, totalPhysical, allocated, available FROM stock_balances WHERE productId = ? AND locationCode = ? LIMIT 1`,
          [productId, mainWhCode],
        );
        if (!mainBalance) {
          const insertRes = await this.dataSource.query(
            `INSERT INTO stock_balances (productId, locationCode, totalPhysical, allocated, available) VALUES (?, ?, 0, 0, 0)`,
            [productId, mainWhCode],
          );
          mainBalance = { id: insertRes.insertId, totalPhysical: 0, allocated: 0, available: 0 };
        }
        const mainPhysical = Number(mainBalance.totalPhysical) + qty;
        const mainAvailable = Math.max(0, mainPhysical - Number(mainBalance.allocated));
        await this.dataSource.query(
          `UPDATE stock_balances SET totalPhysical = ?, available = ? WHERE id = ?`,
          [mainPhysical, mainAvailable, mainBalance.id],
        );
      }

      const unitPrice = parseNumber(detail.unitPrice);
      const lineAmount = parseNumber(detail.totalLineAmount || (unitPrice * qty));
      const supplierName = receipt.supplierName || receipt.supplier?.name || 'Nhà cung cấp';
      const creatorName = receipt.creatorName || receipt.approverName || 'Quản lý kho';

      // 4. Ghi vết lịch sử nhập kho vào CSDL
      try {
        await this.dataSource.query(
          `INSERT INTO stock_in_history (productId, orderCode, supplierName, warehouseCode, warehouseName, quantity, unitPrice, totalAmount, createdBy, note, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            productId,
            receipt.poNumber || 'PNK-SYSTEM',
            supplierName,
            mainWhCode,
            `Kho ${mainWhCode}`,
            qty,
            unitPrice,
            lineAmount,
            creatorName,
            receipt.description || 'Nhập kho tự động',
          ],
        );
      } catch (histErr) {
        console.error('Lỗi lưu vết stock_in_history:', histErr);
      }

      // 5. Cập nhật giá nhập của sản phẩm nếu có
      if (unitPrice > 0) {
        try {
          await this.dataSource.query(
            `UPDATE products SET importPrice = ? WHERE id = ?`,
            [unitPrice, productId],
          );
        } catch (priceErr) {
          console.error('Lỗi cập nhật importPrice sản phẩm:', priceErr);
        }
      }
    }
  }

  private async revertInboundStockAddition(receipt: InboundReceipt) {
    const details = receipt.details && receipt.details.length
      ? receipt.details
      : await this.detailRepo.find({
          where: { inboundReceipt: { id: receipt.id } as any },
          relations: ['product'],
        });

    for (const detail of details) {
      let productId = detail.product?.id;
      if (!productId) continue;

      const locCode = detail.warehouseCode || 'KHO-NVL';

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

      if (!balance) continue;

      const qty = Number(detail.receivedQty || detail.expectedQty) || 0;
      const newPhysical = Math.max(0, Number(balance.totalPhysical) - qty);
      const newAvailable = Math.max(0, newPhysical - Number(balance.allocated));

      await this.dataSource.query(
        `UPDATE stock_balances SET totalPhysical = ?, available = ? WHERE id = ?`,
        [newPhysical, newAvailable, balance.id],
      );
    }
  }

  private async serializeReceipt(receipt: InboundReceipt): Promise<SerializedPurchaseOrder> {
    // Hiển thị NCC: ưu tiên supplier entity > supplierName text
    const supplierDisplay = receipt.supplier
      ? {
        id: receipt.supplier.id,
        supplierCode: receipt.supplier.supplierCode,
        name: receipt.supplier.name,
        taxCode: receipt.supplier.taxCode,
        contactPerson: receipt.supplier.contactPerson,
        phone: receipt.supplier.phone,
      }
      : receipt.supplierName
        ? { id: '', supplierCode: '', name: receipt.supplierName }
        : null;

    const details = receipt.details || [];
    const computedTotal = details.length > 0
      ? details.reduce((sum, d) => sum + (parseNumber(d.unitPrice) * parseNumber(d.expectedQty)), 0)
      : parseNumber(receipt.totalAmount);

    const supplierProducts = receipt.supplier?.id
      ? await this.supplierProductRepo.find({ where: { supplier: { id: receipt.supplier.id } }, relations: ['product'] })
      : [];
    const supplierProductByProductId = new Map(supplierProducts.map((item) => [String(item.product?.id), item]));

    return {
      id: receipt.id,
      poNumber: receipt.poNumber || `PNK_${receipt.id}`,
      receiptNo: receipt.poNumber || `PNK_${receipt.id}`,
      orderDate: toDateString(receipt.orderDate),
      expectedDate: toDateString(receipt.expectedDate),
      status: receipt.status,
      approverId: receipt.approverId,
      approverName: receipt.approverName,
      creatorName: receipt.creatorName,
      creatorPhone: receipt.creatorPhone,
      description: receipt.description,
      totalAmount: computedTotal,
      supplier: supplierDisplay as any,
      supplierName: receipt.supplierName || receipt.supplier?.name || undefined,
      details: details.map((detail) => this.serializeDetail(detail, supplierProductByProductId.get(String(detail.product?.id)))),
      items: details.length,
    };
  }

  private serializeDetail(detail: InboundDetail, supplierProduct?: SupplierProduct) {
    let parsedAssignedBins: string[] = [];
    if (detail.note && detail.note.includes('[Vị trí Ô:')) {
      const match = detail.note.match(/\[Vị trí Ô:\s*([^\]]+)\]/);
      if (match && match[1]) {
        parsedAssignedBins = match[1].split(',').map((c) => c.trim()).filter(Boolean);
      }
    }

    const unitPrice = parseNumber(detail.unitPrice);
    const qty = parseNumber(detail.expectedQty);
    const discP = parseNumber(detail.discountPercent);
    const vatP = parseNumber(detail.vatPercent);
    const lineTotalBeforeDisc = unitPrice * qty;
    const discAmt = (lineTotalBeforeDisc * discP) / 100;
    const lineAfterDisc = Math.max(0, lineTotalBeforeDisc - discAmt);
    const vatAmt = (lineAfterDisc * vatP) / 100;
    const calcTotal = lineAfterDisc + vatAmt;

    return {
      id: detail.id,
      warehouseCode: detail.warehouseCode,
      locationBin: parsedAssignedBins.join(', ') || detail.warehouseCode || '',
      assignedBins: parsedAssignedBins,
      expectedQty: qty,
      receivedQty: parseNumber(detail.receivedQty),
      unitPrice: unitPrice,
      discountPercent: discP,
      vatPercent: vatP,
      supplierPrice: detail.supplierPrice ? parseNumber(detail.supplierPrice) : null,
      rounds: Array.isArray(detail.negotiationHistory)
        ? detail.negotiationHistory.map((round) => ({ ...round, enterprisePrice: round.enterpriseResponded ? round.enterprisePrice : null }))
        : [],
      requestedPrice: parseNumber(detail.requestedPrice ?? detail.unitPrice),
      listPrice: parseNumber(detail.product?.price) || parseNumber(supplierProduct?.purchasePrice),
      supplierCatalogPrice: supplierProduct ? parseNumber(supplierProduct.purchasePrice) : null,
      totalLineAmount: detail.totalLineAmount ? parseNumber(detail.totalLineAmount) : calcTotal,
      weight: parseNumber(detail.weight),
      length: parseNumber(detail.length),
      width: parseNumber(detail.width),
      height: parseNumber(detail.height),
      volume: parseNumber(detail.volume),
      volumetricWeight: parseNumber(detail.volumetricWeight),
      note: detail.note || '',
      product: detail.product
        ? {
          id: detail.product.id,
          internalSku: detail.product.internalSku,
          name: detail.product.name,
          unit: detail.product.unit,
          price: parseNumber(detail.product.price),
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

    let code = `PNK_${Math.floor(100 + Math.random() * 900)}`;
    while (await this.receiptRepo.findOne({ where: { poNumber: code } })) {
      code = `PNK_${Math.floor(100 + Math.random() * 900)}`;
    }

    return code;
  }
}
