import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CreateTransferOrderDto, UpdateTransferOrderDto } from './dto/create-transfer-order.dto';
import { TransferOrder, TransferOrderItem } from './entities/delivery-order.entity';

function parseDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeItems(items?: TransferOrderItem[]) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => {
      const assignedBins = Array.isArray(item.assignedBins)
        ? item.assignedBins.map((b) => String(b).trim()).filter(Boolean)
        : (item.locationBin ? String(item.locationBin).split(',').map((b) => b.trim()).filter(Boolean) : []);
      const locationBin = item.locationBin
        ? String(item.locationBin).trim()
        : (assignedBins.length > 0 ? assignedBins.join(', ') : undefined);

      return {
        id: item.id || `item-${Date.now()}-${index}`,
        productCode: String(item.productCode || '').trim(),
        productName: String(item.productName || '').trim(),
        unit: String(item.unit || '').trim() || 'Cái',
        quantity: Math.max(0, Number(item.quantity) || 0),
        price: Math.max(0, Number(item.price) || 0),
        locationBin,
        assignedBins: assignedBins.length > 0 ? assignedBins : undefined,
        note: item.note ? String(item.note).trim() : undefined,
      };
    })
    .filter((item) => item.productCode || item.productName);
}

function summarizeItems(items: TransferOrderItem[]) {
  return {
    itemCount: items.length,
    totalQuantity: items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
  };
}

import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DeliveryService implements OnModuleInit {
  constructor(
    @InjectRepository(TransferOrder)
    private readonly transferOrderRepo: Repository<TransferOrder>,
    private readonly notificationsService: NotificationsService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    try {
      const orders = await this.transferOrderRepo.find();
      for (const order of orders) {
        if (order.status && order.status.toUpperCase() !== 'DRAFT') {
          await this.applyTransferStockMovement(order);
        }
      }
    } catch (e) {
      console.error('Lỗi đồng bộ biến động kho điều chuyển:', e);
    }
  }

  async findAll() {
    const orders = await this.transferOrderRepo.find({ order: { createdAt: 'DESC' } });
    return orders.map((order) => this.serialize(order));
  }

  async findOne(id: string) {
    const order = await this.transferOrderRepo.findOneBy({ id });
    if (!order) throw new NotFoundException('Transfer order not found');
    return this.serialize(order);
  }

  async create(dto: CreateTransferOrderDto) {
    const transferNo = await this.generateTransferNo(dto.transferNo);
    const items = normalizeItems(dto.items);
    const { itemCount, totalQuantity } = summarizeItems(items);

    const sourceWarehouse = (
      dto.sourceWarehouse ||
      (dto as any).sourceWarehouseCode ||
      (dto as any).fromWarehouse ||
      'KH001'
    ).trim();

    let destinationWarehouse = (
      dto.destinationWarehouse ||
      (dto as any).destinationWarehouseCode ||
      (dto as any).toWarehouse ||
      'KH002'
    ).trim();

    if (sourceWarehouse === destinationWarehouse) {
      destinationWarehouse = sourceWarehouse === 'KH001' ? 'KH002' : 'KH001';
    }

    const rawOrderDate = dto.scheduledDate || (dto as any).orderDate || (dto as any).createdAt;
    const parsedScheduled = parseDate(rawOrderDate) || new Date();
    const parsedDispatch = parseDate(dto.dispatchDate || dto.scheduledDate || rawOrderDate) || parsedScheduled;
    const parsedReceive = parseDate(dto.receiveDate) || undefined;

    const entity = this.transferOrderRepo.create({
      transferNo,
      requestId: dto.requestId?.trim() || undefined,
      requestNumber: dto.requestNumber?.trim() || undefined,
      sourceWarehouse,
      destinationWarehouse,
      scheduledDate: parsedScheduled,
      dispatchDate: parsedDispatch,
      receiveDate: parsedReceive,
      driverName: dto.driverName?.trim() || undefined,
      driverPhone: dto.driverPhone?.trim() || undefined,
      vehiclePlate: dto.vehiclePlate?.trim() || undefined,
      status: dto.status || 'DRAFT',
      note: dto.note?.trim() || undefined,
      createdBy: dto.createdBy?.trim() || 'System Administrator',
      items,
      itemCount,
      totalQuantity,
    });

    const saved = await this.transferOrderRepo.save(entity);
    if (parsedScheduled) {
      try {
        await this.dataSource.query(
          `UPDATE transfer_orders SET scheduledDate = ?, createdAt = ? WHERE id = ?`,
          [parsedScheduled, parsedScheduled, saved.id],
        );
        saved.scheduledDate = parsedScheduled;
        saved.createdAt = parsedScheduled;
      } catch {}
    }
    await this.applyTransferStockMovement(saved);

    try {
      await this.notificationsService.createBroadcastNotification({
        title: `Đơn chuyển kho mới ${saved.transferNo}`,
        message: `Đơn chuyển kho ${saved.transferNo} từ ${saved.sourceWarehouse} đến ${saved.destinationWarehouse} vừa được khởi tạo thành công.`,
        link: '/delivery/transfer-requests',
        priority: 'normal',
        referenceType: 'TRANSFER_ORDER',
        referenceId: saved.id,
      });
    } catch {
      // Ignore notification creation error.
    }

    return this.serialize(saved);
  }

  async update(id: string, dto: UpdateTransferOrderDto) {
    const order = await this.transferOrderRepo.findOneBy({ id });
    if (!order) throw new NotFoundException('Transfer order not found');

    // Revert previous inventory balance impact before updating
    await this.revertTransferStockMovement(order);

    if (dto.transferNo && dto.transferNo.trim() !== order.transferNo) {
      const dup = await this.transferOrderRepo.findOneBy({ transferNo: dto.transferNo.trim() });
      if (dup && dup.id !== id) {
        throw new BadRequestException('Transfer number already exists');
      }
      order.transferNo = dto.transferNo.trim();
    }

    const rawSource = dto.sourceWarehouse || (dto as any).sourceWarehouseCode || (dto as any).fromWarehouse;
    if (rawSource !== undefined && rawSource !== null) {
      order.sourceWarehouse = String(rawSource).trim() || 'KH001';
    }

    const rawDest = dto.destinationWarehouse || (dto as any).destinationWarehouseCode || (dto as any).toWarehouse;
    if (rawDest !== undefined && rawDest !== null) {
      order.destinationWarehouse = String(rawDest).trim() || 'KH002';
    }
    const rawOrderDate = (dto as any).orderDate || (dto as any).createdAt || dto.scheduledDate;
    if (rawOrderDate !== undefined) {
      const parsedOrderDate = parseDate(rawOrderDate);
      if (parsedOrderDate) {
        order.scheduledDate = parsedOrderDate;
        order.createdAt = parsedOrderDate;
        try {
          await this.dataSource.query(
            `UPDATE transfer_orders SET scheduledDate = ?, createdAt = ? WHERE id = ?`,
            [parsedOrderDate, parsedOrderDate, id],
          );
        } catch {}
      }
    } else if (dto.scheduledDate !== undefined) {
      order.scheduledDate = parseDate(dto.scheduledDate) || order.scheduledDate;
    }
    if (dto.dispatchDate !== undefined) order.dispatchDate = parseDate(dto.dispatchDate) || order.dispatchDate;
    if (dto.receiveDate !== undefined) order.receiveDate = dto.receiveDate ? (parseDate(dto.receiveDate) || undefined) : undefined;
    if (dto.driverName !== undefined) order.driverName = dto.driverName.trim() || undefined;
    if (dto.driverPhone !== undefined) order.driverPhone = dto.driverPhone.trim() || undefined;
    if (dto.vehiclePlate !== undefined) order.vehiclePlate = dto.vehiclePlate.trim() || undefined;
    if (dto.status !== undefined) order.status = dto.status;
    if (dto.note !== undefined) order.note = dto.note.trim() || undefined;
    if (dto.createdBy !== undefined) order.createdBy = dto.createdBy.trim() || undefined;

    if (dto.items !== undefined) {
      const items = normalizeItems(dto.items);
      const summary = summarizeItems(items);
      order.items = items;
      order.itemCount = summary.itemCount;
      order.totalQuantity = summary.totalQuantity;
    }

    if (order.sourceWarehouse === order.destinationWarehouse) {
      throw new BadRequestException('Source and destination warehouses must be different');
    }

    const saved = await this.transferOrderRepo.save(order);
    await this.applyTransferStockMovement(saved);
    return this.serialize(saved);
  }

  async remove(id: string) {
    const order = await this.transferOrderRepo.findOneBy({ id });
    if (!order) throw new NotFoundException('Transfer order not found');
    await this.revertTransferStockMovement(order);
    await this.transferOrderRepo.remove(order);
    return { deleted: true };
  }

  private async findStockBalancesForWarehouse(productId: string, whCode: string) {
    const target = (whCode || '').trim().toUpperCase();
    const rows: Array<{ id: number; locationCode: string; totalPhysical: number; allocated: number; available: number }> =
      await this.dataSource.query(
        `SELECT id, locationCode, totalPhysical, allocated, available FROM stock_balances WHERE productId = ?`,
        [productId],
      );

    if (rows.length === 0) return [];

    return rows.filter((r) => {
      const lc = (r.locationCode || '').trim().toUpperCase();
      if (!lc) return false;
      if (lc === target) return true;
      if (lc.startsWith(`${target}-`) || lc.startsWith(`${target}_`) || lc.startsWith(`${target}/`)) return true;
      if (target === 'KH002' && (lc === 'KH002' || lc.includes('HCM') || lc.includes('CHI NHÁNH'))) return true;
      if (target === 'KH001' && (lc === 'KH001' || lc.includes('HÀ ĐÔNG') || lc.includes('HÀ NỘI'))) return true;
      return false;
    });
  }

  private async applyTransferStockMovement(order: TransferOrder) {
    const status = (order.status || '').toUpperCase();
    if (status === 'DRAFT') return;

    const sourceWh = (order.sourceWarehouse || 'KH001').trim().toUpperCase();
    const destWh = (order.destinationWarehouse || 'KH002').trim().toUpperCase();
    const items = order.items || [];

    for (const item of items) {
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) continue;

      let productId: string | null = null;
      if (item.id && /^\d+$/.test(String(item.id))) {
        productId = String(item.id);
      }
      if (!productId && item.productCode) {
        const [p] = await this.dataSource.query(
          `SELECT id FROM products WHERE internalSku = ? OR supplierBarcode = ? LIMIT 1`,
          [item.productCode.trim(), item.productCode.trim()],
        );
        if (p) productId = String(p.id);
      }
      if (!productId && item.productName) {
        const [p] = await this.dataSource.query(
          `SELECT id FROM products WHERE name = ? LIMIT 1`,
          [item.productName.trim()],
        );
        if (p) productId = String(p.id);
      }
      if (!productId) continue;

      // 1. DEDUCT stock from Source Warehouse
      const sourceBals = await this.findStockBalancesForWarehouse(productId, sourceWh);
      if (sourceBals.length > 0) {
        let remainingToDeduct = qty;
        const mainBal =
          sourceBals.find((b) => {
            const lc = b.locationCode.trim().toUpperCase();
            return lc === sourceWh || lc === 'KHO-NVL' || !lc.includes('-');
          }) || sourceBals[0];

        if (mainBal) {
          const deductAmt = Math.min(Number(mainBal.totalPhysical), remainingToDeduct);
          const newPhysical = Math.max(0, Number(mainBal.totalPhysical) - deductAmt);
          const newAvailable = Math.max(0, newPhysical - Number(mainBal.allocated));
          await this.dataSource.query(
            `UPDATE stock_balances SET totalPhysical = ?, available = ? WHERE id = ?`,
            [newPhysical, newAvailable, mainBal.id],
          );
          remainingToDeduct -= deductAmt;
        }

        if (remainingToDeduct > 0) {
          for (const bal of sourceBals) {
            if (mainBal && bal.id === mainBal.id) continue;
            if (remainingToDeduct <= 0) break;
            const deductAmt = Math.min(Number(bal.totalPhysical), remainingToDeduct);
            const newPhysical = Math.max(0, Number(bal.totalPhysical) - deductAmt);
            const newAvailable = Math.max(0, newPhysical - Number(bal.allocated));
            await this.dataSource.query(
              `UPDATE stock_balances SET totalPhysical = ?, available = ? WHERE id = ?`,
              [newPhysical, newAvailable, bal.id],
            );
            remainingToDeduct -= deductAmt;
          }
        }
      } else {
        await this.dataSource.query(
          `INSERT INTO stock_balances (productId, locationCode, totalPhysical, allocated, available) VALUES (?, ?, 0, 0, 0)`,
          [productId, sourceWh],
        );
      }

      // Also deduct from specific assigned bins if specified
      const assignedBins = Array.isArray(item.assignedBins)
        ? item.assignedBins
        : (item.locationBin ? String(item.locationBin).split(',').map((s) => s.trim()) : []);
      const sourceBins = assignedBins.filter((b) => b.startsWith(sourceWh));
      if (sourceBins.length > 0) {
        const qtyPerBin = Math.max(1, Math.floor(qty / sourceBins.length));
        for (const binCode of sourceBins) {
          const [binBal] = await this.dataSource.query(
            `SELECT id, totalPhysical, allocated, available FROM stock_balances WHERE productId = ? AND locationCode = ? LIMIT 1`,
            [productId, binCode],
          );
          if (binBal) {
            const binPhysical = Math.max(0, Number(binBal.totalPhysical) - qtyPerBin);
            const binAvail = Math.max(0, binPhysical - Number(binBal.allocated));
            await this.dataSource.query(
              `UPDATE stock_balances SET totalPhysical = ?, available = ? WHERE id = ?`,
              [binPhysical, binAvail, binBal.id],
            );
          }
        }
      }

      // 2. ADD stock to Destination Warehouse if DELIVERED, COMPLETED, or RECEIVED
      if (status === 'DELIVERED' || status === 'COMPLETED' || status === 'RECEIVED') {
        const destBals = await this.findStockBalancesForWarehouse(productId, destWh);
        const mainDestBal = destBals.find(
          (b) => b.locationCode.trim().toUpperCase() === destWh || !b.locationCode.includes('-'),
        );

        if (mainDestBal) {
          const newPhysical = Number(mainDestBal.totalPhysical) + qty;
          const newAvailable = Math.max(0, newPhysical - Number(mainDestBal.allocated));
          await this.dataSource.query(
            `UPDATE stock_balances SET totalPhysical = ?, available = ? WHERE id = ?`,
            [newPhysical, newAvailable, mainDestBal.id],
          );
        } else {
          await this.dataSource.query(
            `INSERT INTO stock_balances (productId, locationCode, totalPhysical, allocated, available) VALUES (?, ?, ?, 0, ?)`,
            [productId, destWh, qty, qty],
          );
        }

        const destBins = assignedBins.filter((b) => b.startsWith(destWh));
        if (destBins.length > 0) {
          const qtyPerBin = Math.max(1, Math.floor(qty / destBins.length));
          for (const binCode of destBins) {
            let [binBal] = await this.dataSource.query(
              `SELECT id, totalPhysical, allocated, available FROM stock_balances WHERE productId = ? AND locationCode = ? LIMIT 1`,
              [productId, binCode],
            );
            if (!binBal) {
              const insertRes = await this.dataSource.query(
                `INSERT INTO stock_balances (productId, locationCode, totalPhysical, allocated, available) VALUES (?, ?, 0, 0, 0)`,
                [productId, binCode],
              );
              binBal = { id: insertRes.insertId, totalPhysical: 0, allocated: 0, available: 0 };
            }
            const binPhysical = Number(binBal.totalPhysical) + qtyPerBin;
            const binAvail = Math.max(0, binPhysical - Number(binBal.allocated));
            await this.dataSource.query(
              `UPDATE stock_balances SET totalPhysical = ?, available = ? WHERE id = ?`,
              [binPhysical, binAvail, binBal.id],
            );
          }
        }
      }
    }
  }

  private async revertTransferStockMovement(order: TransferOrder) {
    const status = (order.status || '').toUpperCase();
    if (status === 'DRAFT') return;

    const sourceWh = (order.sourceWarehouse || 'KH001').trim().toUpperCase();
    const destWh = (order.destinationWarehouse || 'KH002').trim().toUpperCase();
    const items = order.items || [];

    for (const item of items) {
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) continue;

      let productId: string | null = null;
      if (item.id && /^\d+$/.test(String(item.id))) {
        productId = String(item.id);
      }
      if (!productId && item.productCode) {
        const [p] = await this.dataSource.query(
          `SELECT id FROM products WHERE internalSku = ? OR supplierBarcode = ? LIMIT 1`,
          [item.productCode.trim(), item.productCode.trim()],
        );
        if (p) productId = String(p.id);
      }
      if (!productId && item.productName) {
        const [p] = await this.dataSource.query(
          `SELECT id FROM products WHERE name = ? LIMIT 1`,
          [item.productName.trim()],
        );
        if (p) productId = String(p.id);
      }
      if (!productId) continue;

      // Revert Source Warehouse (Add back qty)
      const sourceBals = await this.findStockBalancesForWarehouse(productId, sourceWh);
      if (sourceBals.length > 0) {
        const mainBal = sourceBals[0];
        const newSourcePhysical = Number(mainBal.totalPhysical) + qty;
        const newSourceAvailable = Math.max(0, newSourcePhysical - Number(mainBal.allocated));
        await this.dataSource.query(
          `UPDATE stock_balances SET totalPhysical = ?, available = ? WHERE id = ?`,
          [newSourcePhysical, newSourceAvailable, mainBal.id],
        );
      }

      // Revert Destination Warehouse if DELIVERED/COMPLETED/RECEIVED (Deduct qty)
      if (status === 'DELIVERED' || status === 'COMPLETED' || status === 'RECEIVED') {
        const destBals = await this.findStockBalancesForWarehouse(productId, destWh);
        if (destBals.length > 0) {
          const mainBal = destBals[0];
          const newDestPhysical = Math.max(0, Number(mainBal.totalPhysical) - qty);
          const newDestAvailable = Math.max(0, newDestPhysical - Number(mainBal.allocated));
          await this.dataSource.query(
            `UPDATE stock_balances SET totalPhysical = ?, available = ? WHERE id = ?`,
            [newDestPhysical, newDestAvailable, mainBal.id],
          );
        }
      }
    }
  }

  private async generateTransferNo(preferredNo?: string) {
    const preferred = preferredNo?.trim();
    if (preferred) {
      const existing = await this.transferOrderRepo.findOneBy({ transferNo: preferred });
      if (!existing) {
        return preferred;
      }
      const year = new Date().getFullYear();
      let suffix = Math.floor(1000 + Math.random() * 9000).toString();
      let candidate = `${preferred}-${suffix}`;
      while (await this.transferOrderRepo.findOneBy({ transferNo: candidate })) {
        suffix = Math.floor(1000 + Math.random() * 9000).toString();
        candidate = `${preferred}-${suffix}`;
      }
      return candidate;
    }

    const year = new Date().getFullYear();
    let suffix = Date.now().toString().slice(-6);
    let candidate = `TRF-${year}-${suffix}`;
    while (await this.transferOrderRepo.findOneBy({ transferNo: candidate })) {
      suffix = (Number(suffix) + 1).toString().padStart(6, '0');
      candidate = `TRF-${year}-${suffix}`;
    }
    return candidate;
  }

  private serialize(order: TransferOrder) {
    const orderDate = order.scheduledDate || order.createdAt || order.dispatchDate;
    const dispatchDate = order.dispatchDate || order.scheduledDate || order.createdAt;
    const receiveDate = order.receiveDate ? new Date(order.receiveDate).toISOString() : null;

    const items = order.items || [];
    const itemCount = order.itemCount || items.length;
    const totalQuantity = order.totalQuantity || items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);

    return {
      ...order,
      orderDate: orderDate ? new Date(orderDate).toISOString() : null,
      scheduledDate: order.scheduledDate ? order.scheduledDate.toISOString() : (orderDate ? new Date(orderDate).toISOString() : null),
      dispatchDate: dispatchDate ? new Date(dispatchDate).toISOString() : null,
      receiveDate,
      createdAt: order.createdAt ? order.createdAt.toISOString() : (orderDate ? new Date(orderDate).toISOString() : null),
      updatedAt: order.updatedAt ? order.updatedAt.toISOString() : null,
      driverName: order.driverName || null,
      driverPhone: order.driverPhone || null,
      vehiclePlate: order.vehiclePlate || null,
      createdBy: order.createdBy && order.createdBy !== 'NPT_Staff' ? order.createdBy : 'System Administrator',
      items,
      itemCount,
      totalQuantity,
    };
  }
}
