import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Stocktake } from './entities/stocktake.entity';
import { StocktakeDetail } from './entities/stocktake-detail.entity';
import { StockBalance } from '../entities/stock-balance.entity';
import { Product } from '../../entities/product.entity';
import { CreateStocktakeDto } from './dto/create-stocktake.dto';
import { AddStocktakeDetailDto } from './dto/add-stocktake-detail.dto';
import { UpdateCountDto } from './dto/update-count.dto';

type SerializedStocktake = {
  id: string;
  stocktakeNo: string;
  locationCode: string;
  status: string;
  plannedDate?: string;
  assignee?: string;
  note?: string;
  createdBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  details: SerializedDetail[];
  totalItems: number;
  countedItems: number;
  differenceItems: number;
};

type SerializedDetail = {
  id: string;
  systemQty: number;
  countedQty: number | null;
  difference: number;
  note?: string;
  product: {
    id: string;
    internalSku: string;
    name: string;
    unit?: string;
  } | null;
};

function toDateString(value?: Date | string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

@Injectable()
export class StocktakeService {
  constructor(
    @InjectRepository(Stocktake) private stocktakeRepo: Repository<Stocktake>,
    @InjectRepository(StocktakeDetail) private detailRepo: Repository<StocktakeDetail>,
    @InjectRepository(StockBalance) private balanceRepo: Repository<StockBalance>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
  ) {}

  // ─── CRUD ──────────────────────────────────────────────────────

  async create(dto: CreateStocktakeDto) {
    if (dto.plannedDate && new Date(dto.plannedDate) < new Date()) {
      throw new BadRequestException('Ngày dự kiến không được trong quá khứ');
    }

    const stocktakeNo = await this.generateStocktakeNo();

    const stocktake = this.stocktakeRepo.create({
      stocktakeNo,
      locationCode: dto.locationCode.trim(),
      status: 'DRAFT',
      plannedDate: dto.plannedDate ? new Date(dto.plannedDate) : undefined,
      assignee: dto.assignee?.trim() || undefined,
      note: dto.note?.trim() || undefined,
      createdBy: dto.createdBy?.trim() || undefined,
    });

    const saved = await this.stocktakeRepo.save(stocktake);

    if (dto.productIds && dto.productIds.length > 0) {
      for (const productId of dto.productIds) {
        await this.addDetail(saved.id, { productId });
      }
    }

    return this.serialize(await this.findEntity(saved.id));
  }

  async findAll() {
    const stocktakes = await this.stocktakeRepo.find({
      relations: ['details', 'details.product'],
      order: { id: 'DESC' },
    });
    return stocktakes.map((s) => this.serialize(s));
  }

  async findOne(id: string) {
    return this.serialize(await this.findEntity(id));
  }

  async remove(id: string) {
    const stocktake = await this.findEntity(id);
    if (stocktake.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ có thể xóa phiên kiểm kê ở trạng thái Nháp');
    }

    const details = await this.detailRepo.find({
      where: { stocktake: { id } as any },
      relations: ['stocktake', 'product'],
    });
    if (details.length) {
      await this.detailRepo.remove(details);
    }
    await this.stocktakeRepo.remove(stocktake);
    return { deleted: true };
  }

  // ─── DETAIL MANAGEMENT ────────────────────────────────────────

  async addDetail(stocktakeId: string, dto: AddStocktakeDetailDto) {
    const stocktake = await this.findEntity(stocktakeId);
    if (stocktake.status !== 'DRAFT' && stocktake.status !== 'COUNTING') {
      throw new BadRequestException('Không thể thêm sản phẩm ở trạng thái hiện tại');
    }

    const product = await this.productRepo.findOneBy({ id: dto.productId });
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');

    // Check duplicate product in same stocktake
    const existing = await this.detailRepo.findOne({
      where: {
        stocktake: { id: stocktakeId } as any,
        product: { id: dto.productId } as any,
      },
      relations: ['stocktake', 'product'],
    });
    if (existing) {
      throw new BadRequestException('Sản phẩm đã có trong phiên kiểm kê này');
    }

    // Get system quantity from StockBalance
    const balance = await this.balanceRepo.findOne({
      where: {
        product: { id: dto.productId } as any,
        locationCode: stocktake.locationCode,
      },
      relations: ['product'],
    });
    const systemQty = balance?.totalPhysical || 0;

    const detail = this.detailRepo.create({
      stocktake: { id: stocktakeId } as Stocktake,
      product,
      systemQty,
      countedQty: undefined,
      difference: 0,
    });

    await this.detailRepo.save(detail);

    // Auto transition to COUNTING if first detail added
    if (stocktake.status === 'DRAFT') {
      stocktake.status = 'COUNTING';
      await this.stocktakeRepo.save(stocktake);
    }

    return this.serialize(await this.findEntity(stocktakeId));
  }

  async removeDetail(detailId: string) {
    const detail = await this.detailRepo.findOne({
      where: { id: detailId },
      relations: ['stocktake', 'product'],
    });
    if (!detail) throw new NotFoundException('Chi tiết kiểm kê không tồn tại');

    if (detail.stocktake.status !== 'DRAFT' && detail.stocktake.status !== 'COUNTING') {
      throw new BadRequestException('Không thể xóa sản phẩm ở trạng thái hiện tại');
    }

    const stocktakeId = detail.stocktake.id;
    await this.detailRepo.remove(detail);
    return this.serialize(await this.findEntity(stocktakeId));
  }

  async updateCount(detailId: string, dto: UpdateCountDto) {
    const detail = await this.detailRepo.findOne({
      where: { id: detailId },
      relations: ['stocktake', 'product'],
    });
    if (!detail) throw new NotFoundException('Chi tiết kiểm kê không tồn tại');

    if (detail.stocktake.status !== 'COUNTING' && detail.stocktake.status !== 'DRAFT') {
      throw new BadRequestException('Không thể cập nhật số đếm ở trạng thái hiện tại');
    }

    detail.countedQty = dto.countedQty;
    detail.difference = dto.countedQty - detail.systemQty;
    if (dto.note !== undefined) detail.note = dto.note?.trim() || undefined;

    await this.detailRepo.save(detail);

    // Ensure stocktake is in COUNTING status
    const stocktake = await this.stocktakeRepo.findOneBy({ id: detail.stocktake.id });
    if (stocktake && stocktake.status === 'DRAFT') {
      stocktake.status = 'COUNTING';
      await this.stocktakeRepo.save(stocktake);
    }

    return this.serialize(await this.findEntity(detail.stocktake.id));
  }

  // ─── WORKFLOW ──────────────────────────────────────────────────

  async finishCounting(id: string) {
    const stocktake = await this.findEntity(id);

    if (stocktake.status !== 'COUNTING') {
      throw new BadRequestException('Phiên kiểm kê phải đang ở trạng thái Đang đếm');
    }

    const details = stocktake.details || [];
    if (details.length === 0) {
      throw new BadRequestException('Phiên kiểm kê chưa có sản phẩm nào');
    }

    const uncounted = details.filter((d) => d.countedQty === null || d.countedQty === undefined);
    if (uncounted.length > 0) {
      throw new BadRequestException(
        `Còn ${uncounted.length} sản phẩm chưa được đếm`,
      );
    }

    stocktake.status = 'COUNTING_DONE';
    await this.stocktakeRepo.save(stocktake);
    return this.serialize(await this.findEntity(id));
  }

  async approve(id: string, approvedBy?: string) {
    const stocktake = await this.findEntity(id);

    if (stocktake.status !== 'COUNTING_DONE') {
      throw new BadRequestException('Chỉ có thể duyệt phiên kiểm kê đã hoàn tất đếm');
    }

    // Apply inventory adjustments
    for (const detail of stocktake.details || []) {
      if (detail.countedQty !== null && detail.countedQty !== undefined) {
        await this.applyAdjustment(
          detail.product.id,
          stocktake.locationCode,
          detail.countedQty,
        );
      }
    }

    stocktake.status = 'APPROVED';
    stocktake.approvedBy = approvedBy?.trim() || undefined;
    stocktake.approvedAt = new Date();
    await this.stocktakeRepo.save(stocktake);
    return this.serialize(await this.findEntity(id));
  }

  async reject(id: string) {
    const stocktake = await this.findEntity(id);

    if (stocktake.status !== 'COUNTING_DONE') {
      throw new BadRequestException('Chỉ có thể từ chối phiên kiểm kê đã hoàn tất đếm');
    }

    stocktake.status = 'REJECTED';
    await this.stocktakeRepo.save(stocktake);
    return this.serialize(await this.findEntity(id));
  }

  // ─── PRIVATE HELPERS ──────────────────────────────────────────

  private async findEntity(id: string) {
    const stocktake = await this.stocktakeRepo.findOne({
      where: { id },
      relations: ['details', 'details.product'],
    });
    if (!stocktake) throw new NotFoundException('Phiên kiểm kê không tồn tại');
    return stocktake;
  }

  private async applyAdjustment(productId: string, locationCode: string, countedQty: number) {
    const product = await this.productRepo.findOneBy({ id: productId });
    if (!product) return;

    const balance = await this.balanceRepo.findOne({
      where: { product: { id: productId } as any, locationCode },
      relations: ['product'],
    });

    if (balance) {
      balance.totalPhysical = countedQty;
      balance.available = Math.max(countedQty - balance.allocated, 0);
      await this.balanceRepo.save(balance);
    } else {
      // Create new balance record if not exists
      const newBalance = this.balanceRepo.create({
        product,
        locationCode,
        totalPhysical: countedQty,
        allocated: 0,
        available: countedQty,
      });
      await this.balanceRepo.save(newBalance);
    }
  }

  private serialize(stocktake: Stocktake): SerializedStocktake {
    const details = (stocktake.details || []).map((d) => this.serializeDetail(d));
    const countedItems = details.filter((d) => d.countedQty !== null).length;
    const differenceItems = details.filter((d) => d.difference !== 0).length;

    return {
      id: stocktake.id,
      stocktakeNo: stocktake.stocktakeNo,
      locationCode: stocktake.locationCode,
      status: stocktake.status,
      plannedDate: toDateString(stocktake.plannedDate),
      assignee: stocktake.assignee,
      note: stocktake.note,
      createdBy: stocktake.createdBy,
      approvedBy: stocktake.approvedBy,
      approvedAt: toDateString(stocktake.approvedAt),
      createdAt: toDateString(stocktake.createdAt) || new Date().toISOString(),
      details,
      totalItems: details.length,
      countedItems,
      differenceItems,
    };
  }

  private serializeDetail(detail: StocktakeDetail): SerializedDetail {
    return {
      id: detail.id,
      systemQty: detail.systemQty,
      countedQty: detail.countedQty ?? null,
      difference: detail.difference,
      note: detail.note,
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

  private async generateStocktakeNo() {
    const total = await this.stocktakeRepo.count();
    let index = total + 1;
    let code = `KK${String(index).padStart(5, '0')}`;

    while (await this.stocktakeRepo.findOne({ where: { stocktakeNo: code } })) {
      index += 1;
      code = `KK${String(index).padStart(5, '0')}`;
    }

    return code;
  }
}
