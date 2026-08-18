import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    .map((item, index) => ({
      id: item.id || `item-${Date.now()}-${index}`,
      productCode: String(item.productCode || '').trim(),
      productName: String(item.productName || '').trim(),
      unit: String(item.unit || '').trim() || 'Cái',
      quantity: Math.max(0, Number(item.quantity) || 0),
    }))
    .filter((item) => item.productCode || item.productName);
}

function summarizeItems(items: TransferOrderItem[]) {
  return {
    itemCount: items.length,
    totalQuantity: items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
  };
}

@Injectable()
export class DeliveryService {
  constructor(
    @InjectRepository(TransferOrder)
    private readonly transferOrderRepo: Repository<TransferOrder>,
  ) {}

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
      'KH006'
    ).trim();

    let destinationWarehouse = (
      dto.destinationWarehouse ||
      (dto as any).destinationWarehouseCode ||
      (dto as any).toWarehouse ||
      'KH002'
    ).trim();

    if (sourceWarehouse === destinationWarehouse) {
      destinationWarehouse = sourceWarehouse === 'KH006' ? 'KH002' : 'KH006';
    }

    const entity = this.transferOrderRepo.create({
      transferNo,
      requestId: dto.requestId?.trim() || undefined,
      requestNumber: dto.requestNumber?.trim() || undefined,
      sourceWarehouse,
      destinationWarehouse,
      scheduledDate: parseDate(dto.scheduledDate),
      dispatchDate: parseDate(dto.dispatchDate || dto.scheduledDate),
      receiveDate: parseDate(dto.receiveDate),
      driverName: dto.driverName?.trim() || undefined,
      driverPhone: dto.driverPhone?.trim() || undefined,
      vehiclePlate: dto.vehiclePlate?.trim() || undefined,
      status: dto.status || 'DRAFT',
      note: dto.note?.trim() || undefined,
      createdBy: dto.createdBy?.trim() || undefined,
      items,
      itemCount,
      totalQuantity,
    });

    const saved = await this.transferOrderRepo.save(entity);
    return this.serialize(saved);
  }

  async update(id: string, dto: UpdateTransferOrderDto) {
    const order = await this.transferOrderRepo.findOneBy({ id });
    if (!order) throw new NotFoundException('Transfer order not found');

    if (dto.transferNo && dto.transferNo.trim() !== order.transferNo) {
      const dup = await this.transferOrderRepo.findOneBy({ transferNo: dto.transferNo.trim() });
      if (dup && dup.id !== id) {
        throw new BadRequestException('Transfer number already exists');
      }
      order.transferNo = dto.transferNo.trim();
    }

    const rawSource = dto.sourceWarehouse || (dto as any).sourceWarehouseCode || (dto as any).fromWarehouse;
    if (rawSource !== undefined && rawSource !== null) {
      order.sourceWarehouse = String(rawSource).trim() || 'KH006';
    }

    const rawDest = dto.destinationWarehouse || (dto as any).destinationWarehouseCode || (dto as any).toWarehouse;
    if (rawDest !== undefined && rawDest !== null) {
      order.destinationWarehouse = String(rawDest).trim() || 'KH002';
    }
    if (dto.scheduledDate !== undefined) order.scheduledDate = parseDate(dto.scheduledDate);
    if (dto.dispatchDate !== undefined) order.dispatchDate = parseDate(dto.dispatchDate);
    if (dto.receiveDate !== undefined) order.receiveDate = parseDate(dto.receiveDate);
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
    return this.serialize(saved);
  }

  async remove(id: string) {
    const order = await this.transferOrderRepo.findOneBy({ id });
    if (!order) throw new NotFoundException('Transfer order not found');
    await this.transferOrderRepo.remove(order);
    return { deleted: true };
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
    return {
      ...order,
      scheduledDate: order.scheduledDate ? order.scheduledDate.toISOString() : null,
      dispatchDate: order.dispatchDate ? order.dispatchDate.toISOString() : null,
      receiveDate: order.receiveDate ? order.receiveDate.toISOString() : null,
      createdAt: order.createdAt ? order.createdAt.toISOString() : null,
      updatedAt: order.updatedAt ? order.updatedAt.toISOString() : null,
      items: order.items || [],
    };
  }
}
