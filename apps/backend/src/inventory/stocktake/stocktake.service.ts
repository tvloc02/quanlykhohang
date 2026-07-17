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
import { NotificationsService } from '../../notifications/notifications.service';

type SerializedStocktake = {
  id: string;
  stocktakeNo: string;
  requestNo?: string;
  locationCode: string;
  status: string;
  plannedDate?: string;
  requestDate?: string;
  dueDate?: string;
  branch?: string;
  purpose?: string;
  reference?: string;
  checkBy?: string;
  detailBy?: string;
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
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── CRUD ──────────────────────────────────────────────────────

  async create(dto: CreateStocktakeDto) {
    // Removed past date check to allow retroactive recording or slight delays in testing

    const stocktakeNo = await this.generateStocktakeNo();

    const stocktake = this.stocktakeRepo.create({
      stocktakeNo,
      locationCode: dto.locationCode.trim(),
      status: dto.isRequest ? 'REQUESTED' : 'DRAFT',
      plannedDate: dto.plannedDate ? new Date(dto.plannedDate) : undefined,
      assignee: dto.assignee?.trim() || undefined,
      note: dto.note?.trim() || undefined,
      createdBy: dto.createdBy?.trim() || undefined,
      branch: dto.branch?.trim() || undefined,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      purpose: dto.purpose?.trim() || undefined,
      reference: dto.reference?.trim() || undefined,
      checkBy: dto.checkBy?.trim() || undefined,
      detailBy: dto.detailBy?.trim() || undefined,
    });

    const saved = await this.stocktakeRepo.save(stocktake);

    // If created as a request, generate a requestNo and set requestDate
    if (dto.isRequest) {
      const requestNo = await this.generateRequestNo();
      saved.requestNo = requestNo;
      saved.requestDate = new Date();
      await this.stocktakeRepo.save(saved);
    }

    if (dto.productIds && dto.productIds.length > 0) {
      for (const productId of dto.productIds) {
        await this.addDetail(saved.id, { productId });
      }
    }

    const result = this.serialize(await this.findEntity(saved.id));

    // Gửi thông báo cho nhân viên được giao kiểm kê
    if (dto.assignee) {
      try {
        await this.notificationsService.notifyUserByIdentifier(dto.assignee, {
          title: 'Phiếu kiểm kê mới',
          message: `Bạn được giao kiểm kê phiên ${result.stocktakeNo} tại kho ${result.locationCode}. Vui lòng thực hiện kiểm kê.`,
          link: '/inventory/stocktake/my-tasks',
          referenceType: 'stocktake',
          referenceId: result.id,
          priority: 'high',
        });
      } catch (e) {
        // Không block nếu gửi thông báo lỗi
      }
    }

    return result;
  }

  async acceptRequest(id: string, acceptedBy?: string) {
    const stocktake = await this.findEntity(id);
    if (stocktake.status !== 'REQUESTED') {
      throw new BadRequestException('Chỉ có thể tiếp nhận yêu cầu ở trạng thái REQUESTED');
    }

    stocktake.status = 'COUNTING';
    await this.stocktakeRepo.save(stocktake);
    return this.serialize(await this.findEntity(id));
  }

  async findAll() {
    const stocktakes = await this.stocktakeRepo.find({
      relations: ['details', 'details.product'],
      order: { id: 'DESC' },
    });
    return stocktakes.map((s) => this.serialize(s));
  }

  async findMyTasks(userIdentifier: string) {
    const stocktakes = await this.stocktakeRepo.find({
      relations: ['details', 'details.product'],
      order: { id: 'DESC' },
    });
    // Filter by assignee or createdBy matching user identifier (case-insensitive)
    const filtered = stocktakes.filter(
      (s) => 
        (s.assignee && s.assignee.toLowerCase() === userIdentifier.toLowerCase()) ||
        (s.createdBy && s.createdBy.toLowerCase() === userIdentifier.toLowerCase())
    );
    return filtered.map((s) => this.serialize(s));
  }

  async findRequests() {
    const stocktakes = await this.stocktakeRepo.find({
      where: { status: 'REQUESTED' },
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
    if (stocktake.status !== 'DRAFT' && stocktake.status !== 'COUNTING' && stocktake.status !== 'REQUESTED') {
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

    if (detail.stocktake.status !== 'DRAFT' && detail.stocktake.status !== 'COUNTING' && detail.stocktake.status !== 'REQUESTED') {
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

    // Gửi thông báo cho quản lý duyệt
    try {
      await this.notificationsService.notifyRole('admin', {
        title: 'Kiểm kê chờ duyệt',
        message: `Phiên kiểm kê ${stocktake.stocktakeNo} đã hoàn tất đếm. Vui lòng xem xét và duyệt.`,
        link: '/inventory/stocktake',
        referenceType: 'stocktake',
        referenceId: stocktake.id,
        priority: 'high',
      });
      await this.notificationsService.notifyRole('manager', {
        title: 'Kiểm kê chờ duyệt',
        message: `Phiên kiểm kê ${stocktake.stocktakeNo} đã hoàn tất đếm. Vui lòng xem xét và duyệt.`,
        link: '/inventory/stocktake',
        referenceType: 'stocktake',
        referenceId: stocktake.id,
        priority: 'high',
      });
    } catch (e) {
      // Không block nếu gửi thông báo lỗi
    }

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

    // Gửi thông báo cho người tạo / nhân viên
    try {
      const msgData = {
        title: 'Kiểm kê đã duyệt',
        message: `Phiên kiểm kê ${stocktake.stocktakeNo} đã được duyệt bởi ${approvedBy || 'quản lý'}. Tồn kho đã được cập nhật.`,
        link: '/inventory/stocktake/my-tasks',
        referenceType: 'stocktake',
        referenceId: stocktake.id,
        priority: 'normal' as 'normal',
      };
      
      if (stocktake.assignee) {
        await this.notificationsService.notifyUserByIdentifier(stocktake.assignee, msgData);
      }
      if (stocktake.createdBy && stocktake.createdBy !== stocktake.assignee) {
        await this.notificationsService.notifyUserByIdentifier(stocktake.createdBy, msgData);
      }
    } catch (e) {}

    return this.serialize(await this.findEntity(id));
  }

  async reject(id: string) {
    const stocktake = await this.findEntity(id);

    if (stocktake.status !== 'COUNTING_DONE') {
      throw new BadRequestException('Chỉ có thể từ chối phiên kiểm kê đã hoàn tất đếm');
    }

    stocktake.status = 'REJECTED';
    await this.stocktakeRepo.save(stocktake);

    // Gửi thông báo cho người tạo / nhân viên
    try {
      const msgData = {
        title: 'Kiểm kê bị từ chối',
        message: `Phiên kiểm kê ${stocktake.stocktakeNo} đã bị từ chối. Vui lòng liên hệ quản lý để biết thêm chi tiết.`,
        link: '/inventory/stocktake/my-tasks',
        referenceType: 'stocktake',
        referenceId: stocktake.id,
        priority: 'high' as 'high',
      };

      if (stocktake.assignee) {
        await this.notificationsService.notifyUserByIdentifier(stocktake.assignee, msgData);
      }
      if (stocktake.createdBy && stocktake.createdBy !== stocktake.assignee) {
        await this.notificationsService.notifyUserByIdentifier(stocktake.createdBy, msgData);
      }
    } catch (e) {}

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
      requestNo: stocktake.requestNo,
      locationCode: stocktake.locationCode,
      status: stocktake.status,
      plannedDate: toDateString(stocktake.plannedDate),
      requestDate: toDateString(stocktake.requestDate),
      dueDate: toDateString(stocktake.dueDate),
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

  private async generateRequestNo() {
    // Prefix for request numbers
    let index = (await this.stocktakeRepo.count()) + 1;
    let code = `YCKK${String(index).padStart(5, '0')}`;
    while (await this.stocktakeRepo.findOne({ where: { requestNo: code } })) {
      index += 1;
      code = `YCKK${String(index).padStart(5, '0')}`;
    }
    return code;
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
