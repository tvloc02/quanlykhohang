import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockBalance } from './entities/stock-balance.entity';
import { Product } from '../entities/product.entity';
import { CreateStockBalanceDto } from './dto/create-stock-balance.dto';
import { AllocateStockDto } from './dto/allocate-stock.dto';
import { ReleaseStockDto } from './dto/release-stock.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(StockBalance) private balanceRepo: Repository<StockBalance>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
  ) {}

  async createBalance(dto: CreateStockBalanceDto) {
    const product = await this.productRepo.findOneBy({ id: dto.productId });
    if (!product) throw new NotFoundException('Product not found');

    const canonicalLoc = dto.locationCode.trim();

    // Find all balances for this product to clean up duplicate alias records (e.g., KH002 vs Kho Chi Nhánh HCM)
    const allBalances = await this.balanceRepo.find({
      where: { product: { id: dto.productId } },
      relations: ['product'],
    });

    const isMatchLoc = (loc: string) => {
      const a = (loc || '').trim().toLowerCase();
      const b = (canonicalLoc || '').trim().toLowerCase();
      if (a === b) return true;
      if ((b === 'kh002' || b.includes('chi nhánh hcm')) && (a === 'kh002' || a.includes('chi nhánh hcm') || a === 'wh_default_2')) return true;
      if ((b === 'kh001' || b.includes('tổng (hà nội)')) && (a === 'kh001' || a.includes('tổng (hà nội)') || a === 'wh_default_1')) return true;
      if ((b === 'kho-tong' || b.includes('spx express')) && (a === 'kho-tong' || a.includes('spx express') || a === 'wh_default_3')) return true;
      if ((b === 'kho-hn' || b.includes('trung tâm hà nội')) && (a === 'kho-hn' || a.includes('trung tâm hà nội') || a === 'wh_default_4')) return true;
      if ((b === 'kho-bd' || b.includes('nguyên vật liệu')) && (a === 'kho-bd' || a.includes('nguyên vật liệu') || a === 'wh_default_5')) return true;
      if ((b === 'kho-cuchi' || b.includes('lạnh củ chi')) && (a === 'kho-cuchi' || a.includes('lạnh củ chi') || a === 'wh_default_6')) return true;
      return false;
    };

    const matchingBalances = allBalances.filter((b) => isMatchLoc(b.locationCode));

    if (matchingBalances.length > 0) {
      const primary = matchingBalances[0];
      primary.locationCode = canonicalLoc;
      primary.totalPhysical = dto.totalPhysical;
      primary.allocated = dto.allocated || 0;
      primary.available = Math.max(dto.totalPhysical - primary.allocated, 0);

      // Clean up secondary duplicate alias rows from DB
      for (let i = 1; i < matchingBalances.length; i++) {
        await this.balanceRepo.remove(matchingBalances[i]).catch(() => null);
      }

      return this.balanceRepo.save(primary);
    }

    const balance = this.balanceRepo.create({
      product,
      locationCode: canonicalLoc,
      totalPhysical: dto.totalPhysical,
      allocated: dto.allocated || 0,
      available: Math.max(dto.totalPhysical - (dto.allocated || 0), 0),
    });
    return this.balanceRepo.save(balance);
  }

  async clearAllInventory() {
    await this.balanceRepo.clear();
    return { success: true, message: 'Cleared all stock balances' };
  }

  async findAll(user?: any) {
    const whereClause: any = {};
    if (user?.role === 'supplier' && user?.supplierId) {
      whereClause.product = { supplier: { id: user.supplierId } };
    } else if (user?.role === 'customer') {
      return [];
    }
    return this.balanceRepo.find({
      where: whereClause,
      relations: ['product', 'product.supplier'],
    });
  }

  async findOne(id: string, user?: any) {
    const whereClause: any = { id };
    if (user?.role === 'supplier' && user?.supplierId) {
      whereClause.product = { supplier: { id: user.supplierId } };
    }
    const balance = await this.balanceRepo.findOne({
      where: whereClause,
      relations: ['product', 'product.supplier'],
    });
    if (!balance) throw new NotFoundException('Stock balance not found or access denied');
    return balance;
  }

  async allocate(id: string, dto: AllocateStockDto) {
    const balance = await this.findOne(id);
    if (dto.qty > balance.available) {
      throw new BadRequestException('Not enough available inventory to allocate');
    }
    balance.allocated += dto.qty;
    balance.available = Math.max(balance.totalPhysical - balance.allocated, 0);
    return this.balanceRepo.save(balance);
  }

  async release(id: string, dto: ReleaseStockDto) {
    const balance = await this.findOne(id);
    if (dto.qty > balance.allocated) {
      throw new BadRequestException('Release quantity exceeds allocated quantity');
    }
    balance.allocated -= dto.qty;
    balance.available = Math.max(balance.totalPhysical - balance.allocated, 0);
    return this.balanceRepo.save(balance);
  }

  async adjust(id: string, dto: AdjustStockDto) {
    const balance = await this.findOne(id);
    balance.totalPhysical += dto.quantity;
    balance.available = Math.max(balance.totalPhysical - balance.allocated, 0);
    return this.balanceRepo.save(balance);
  }
}
