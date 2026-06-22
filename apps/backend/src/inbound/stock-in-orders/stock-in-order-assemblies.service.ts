import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { Assembly } from './entities/assembly.entity';
import { AssemblyDetail } from './entities/assembly-detail.entity';
import { StockInOrder } from './entities/stock-in-order.entity';
import { StockInOrderDetail } from './entities/stock-in-order-detail.entity';
import { Product } from '../../entities/product.entity';
import { StockBalance } from '../../inventory/entities/stock-balance.entity';
import { CreateAssemblyDto } from './dto/create-assembly.dto';
import { RecountAssemblyDto } from './dto/recount-assembly.dto';

type UserContext = {
  id?: string;
  email?: string;
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
export class StockInOrderAssembliesService {
  constructor(
    @InjectRepository(Assembly) private readonly assemblyRepo: Repository<Assembly>,
    @InjectRepository(AssemblyDetail) private readonly detailRepo: Repository<AssemblyDetail>,
    @InjectRepository(StockInOrder) private readonly orderRepo: Repository<StockInOrder>,
    @InjectRepository(StockInOrderDetail) private readonly orderDetailRepo: Repository<StockInOrderDetail>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(StockBalance) private readonly balanceRepo: Repository<StockBalance>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findByOrder(orderId: string) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['details', 'details.product'],
    });
    if (!order) {
      throw new NotFoundException('Stock in order not found');
    }

    const assemblies = await this.assemblyRepo.find({
      where: { sourceStockInOrder: { id: orderId } as any },
      relations: ['assembledProduct', 'details', 'details.componentProduct'],
      order: { createdAt: 'DESC' },
    });

    return Promise.all(assemblies.map((assembly) => this.serializeAssembly(assembly)));
  }

  async findOne(id: string) {
    const assembly = await this.findAssemblyEntity(id);
    return this.serializeAssembly(assembly, true);
  }

  async create(orderId: string, dto: CreateAssemblyDto, user?: UserContext) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['details', 'details.product'],
    });
    if (!order) {
      throw new NotFoundException('Stock in order not found');
    }
    if (order.status !== 'COMPLETED') {
      throw new BadRequestException('Không thể tạo mẫu lắp ráp trước khi lệnh nhập kho hoàn thành');
    }

    const assembledProduct = await this.productRepo.findOneBy({ id: dto.assembledProductId });
    if (!assembledProduct) {
      throw new NotFoundException('Sản phẩm lắp ráp không tồn tại');
    }

    const assemblyCode = await this.generateAssemblyCode();
    const assembly = this.assemblyRepo.create({
      assemblyCode,
      sourceStockInOrder: order,
      assembledProduct,
      warehouseCode: dto.warehouseCode?.trim() || order.details[0]?.warehouseCode || 'DEFAULT',
      quantity: Math.max(0, toNumber(dto.assembledQty)),
      barcode: dto.barcode?.trim() || undefined,
      note: dto.note?.trim() || undefined,
      status: 'COMPLETED',
      details: [],
    });

    if (assembly.quantity <= 0) {
      throw new BadRequestException('Số lượng sản phẩm lắp ráp phải lớn hơn 0');
    }

    const orderDetailMap = new Map(order.details.map((detail) => [detail.id, detail]));

    if (!dto.components?.length) {
      throw new BadRequestException('Phải chọn ít nhất một thành phần để lắp ráp');
    }

    for (const component of dto.components) {
      const orderDetail = orderDetailMap.get(component.detailId);
      if (!orderDetail) {
        throw new BadRequestException('Thành phần lắp ráp không hợp lệ');
      }
      const usedQty = Math.max(0, toNumber(component.usedQty));
      if (usedQty <= 0) {
        throw new BadRequestException('Số lượng thành phần phải lớn hơn 0');
      }
      if (usedQty > toNumber(orderDetail.actualQty)) {
        throw new BadRequestException(`Số lượng sử dụng của ${orderDetail.product?.internalSku || orderDetail.product?.name || 'sản phẩm'} vượt quá số lượng thực tế`);
      }

      assembly.details.push(
        this.detailRepo.create({
          assembly,
          componentProduct: orderDetail.product,
          usedQty,
          warehouseCode: orderDetail.warehouseCode || undefined,
          sourceOrderDetailId: String(orderDetail.id),
        }),
      );
    }

    const savedAssembly = await this.assemblyRepo.save(assembly);

    for (const detail of savedAssembly.details) {
      await this.adjustInventory(detail.componentProduct.id, detail.warehouseCode || savedAssembly.warehouseCode || 'DEFAULT', -detail.usedQty);
    }
    await this.adjustInventory(savedAssembly.assembledProduct.id, savedAssembly.warehouseCode || 'DEFAULT', savedAssembly.quantity);

    await this.auditLogService.append({
      actorId: user?.id,
      actorEmail: user?.email,
      action: 'assembly.create',
      resource: 'stock-in-order',
      resourceId: order.id,
      metadata: {
        assemblyCode: savedAssembly.assemblyCode,
        assembledProductId: assembledProduct.id,
        quantity: savedAssembly.quantity,
        barcode: savedAssembly.barcode,
      },
    });

    return this.serializeAssembly(await this.findAssemblyEntity(savedAssembly.id), true);
  }

  async recount(id: string, dto: RecountAssemblyDto, user?: UserContext) {
    const assembly = await this.findAssemblyEntity(id);
    const countedQty = Math.max(0, toNumber(dto.countedQty));
    if (countedQty < 0) {
      throw new BadRequestException('Số lượng kiểm kê không hợp lệ');
    }

    const delta = countedQty - assembly.quantity;
    if (delta !== 0) {
      await this.adjustInventory(assembly.assembledProduct.id, assembly.warehouseCode || 'DEFAULT', delta);
    }

    assembly.recountedQty = countedQty;
    assembly.recountedAt = new Date();
    assembly.status = 'RECOUNTED';
    await this.assemblyRepo.save(assembly);

    await this.auditLogService.append({
      actorId: user?.id,
      actorEmail: user?.email,
      action: 'assembly.recount',
      resource: 'assembly',
      resourceId: assembly.id,
      metadata: {
        assemblyCode: assembly.assemblyCode,
        countedQty,
        delta,
      },
    });

    return this.serializeAssembly(assembly, true);
  }

  private async findAssemblyEntity(id: string) {
    const assembly = await this.assemblyRepo.findOne({
      where: { id },
      relations: ['sourceStockInOrder', 'assembledProduct', 'details', 'details.componentProduct'],
    });
    if (!assembly) {
      throw new NotFoundException('Assembly record not found');
    }
    return assembly;
  }

  private async appendLog(resourceId: string, action: string, user?: UserContext, metadata?: Record<string, unknown>) {
    await this.auditLogService.append({
      actorId: user?.id,
      actorEmail: user?.email,
      action,
      resource: 'stock-in-order-assembly',
      resourceId,
      metadata,
    });
  }

  private async adjustInventory(productId: string, locationCode: string, qtyChange: number) {
    const product = await this.productRepo.findOneBy({ id: productId });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const existing = await this.balanceRepo.findOne({
      where: { product: { id: productId } as any, locationCode },
      relations: ['product'],
    });

    if (existing) {
      existing.totalPhysical += qtyChange;
      existing.available = Math.max(existing.totalPhysical - existing.allocated, 0);
      await this.balanceRepo.save(existing);
      return existing;
    }

    if (qtyChange < 0) {
      throw new BadRequestException('Không có đủ tồn kho để điều chỉnh');
    }

    return this.balanceRepo.save(
      this.balanceRepo.create({
        product,
        locationCode,
        totalPhysical: qtyChange,
        allocated: 0,
        available: qtyChange,
      }),
    );
  }

  private async generateAssemblyCode() {
    const total = await this.assemblyRepo.count();
    let index = total + 1;
    let code = `ASM${String(index).padStart(5, '0')}`;
    while (await this.assemblyRepo.findOne({ where: { assemblyCode: code } })) {
      index += 1;
      code = `ASM${String(index).padStart(5, '0')}`;
    }
    return code;
  }

  private serializeAssembly(assembly: Assembly, includeAudit = false) {
    return {
      id: assembly.id,
      assemblyCode: assembly.assemblyCode,
      sourceStockInOrderId: assembly.sourceStockInOrder?.id,
      assembledProduct: assembly.assembledProduct
        ? {
            id: assembly.assembledProduct.id,
            internalSku: assembly.assembledProduct.internalSku,
            name: assembly.assembledProduct.name,
            unit: assembly.assembledProduct.unit,
          }
        : null,
      warehouseCode: assembly.warehouseCode,
      quantity: assembly.quantity,
      barcode: assembly.barcode,
      note: assembly.note,
      status: assembly.status,
      recountedQty: assembly.recountedQty,
      recountedAt: toIso(assembly.recountedAt),
      createdAt: toIso(assembly.createdAt),
      updatedAt: toIso(assembly.updatedAt),
      details: (assembly.details || []).map((detail) => ({
        id: detail.id,
        componentProduct: detail.componentProduct
          ? {
              id: detail.componentProduct.id,
              internalSku: detail.componentProduct.internalSku,
              name: detail.componentProduct.name,
              unit: detail.componentProduct.unit,
            }
          : null,
        usedQty: detail.usedQty,
        warehouseCode: detail.warehouseCode,
        sourceOrderDetailId: detail.sourceOrderDetailId,
      })),
    };
  }
}
