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

    const existing = await this.balanceRepo.findOne({
      where: { product: { id: dto.productId }, locationCode: dto.locationCode },
      relations: ['product'],
    });
    if (existing) {
      existing.totalPhysical = dto.totalPhysical;
      existing.allocated = dto.allocated || existing.allocated;
      existing.available = Math.max(existing.totalPhysical - existing.allocated, 0);
      return this.balanceRepo.save(existing);
    }

    const balance = this.balanceRepo.create({
      product,
      locationCode: dto.locationCode,
      totalPhysical: dto.totalPhysical,
      allocated: dto.allocated || 0,
      available: Math.max(dto.totalPhysical - (dto.allocated || 0), 0),
    });
    return this.balanceRepo.save(balance);
  }

  async findAll() {
    return this.balanceRepo.find({ relations: ['product'] });
  }

  async findOne(id: string) {
    const balance = await this.balanceRepo.findOne({ where: { id }, relations: ['product'] });
    if (!balance) throw new NotFoundException('Stock balance not found');
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
