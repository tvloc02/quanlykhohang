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

    if (!dto.sourceWarehouse?.trim()) {
      throw new BadRequestException('Source warehouse is required');
    }
    if (!dto.destinationWarehouse?.trim()) {
      throw new BadRequestException('Destination warehouse is required');
    }
    if (dto.sourceWarehouse.trim() === dto.destinationWarehouse.trim()) {
      throw new BadRequestException('Source and destination warehouses must be different');
    }

    const entity = this.transferOrderRepo.create({
      transferNo,
      requestId: dto.requestId?.trim() || undefined,
      requestNumber: dto.requestNumber?.trim() || undefined,
      sourceWarehouse: dto.sourceWarehouse.trim(),
      destinationWarehouse: dto.destinationWarehouse.trim(),
      scheduledDate: parseDate(dto.scheduledDate),
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

    if (dto.requestId !== undefined) order.requestId = dto.requestId?.trim() || undefined;
    if (dto.requestNumber !== undefined) order.requestNumber = dto.requestNumber?.trim() || undefined;
    if (dto.sourceWarehouse !== undefined) order.sourceWarehouse = dto.sourceWarehouse.trim();
    if (dto.destinationWarehouse !== undefined) order.destinationWarehouse = dto.destinationWarehouse.trim();
    if (dto.scheduledDate !== undefined) order.scheduledDate = parseDate(dto.scheduledDate);
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
      if (existing) {
        throw new BadRequestException('Transfer number already exists');
      }
      return preferred;
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
      createdAt: order.createdAt ? order.createdAt.toISOString() : null,
      updatedAt: order.updatedAt ? order.updatedAt.toISOString() : null,
      items: order.items || [],
    };
  }
}
