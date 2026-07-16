import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { Category } from '../entities/category.entity';
import { Supplier } from '../entities/supplier.entity';
import { StockBalance } from '../inventory/entities/stock-balance.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Category) private categoryRepo: Repository<Category>,
    @InjectRepository(Supplier) private supplierRepo: Repository<Supplier>,
    @InjectRepository(StockBalance) private balanceRepo: Repository<StockBalance>,
  ) {}

  /**
   * Tra cứu sản phẩm theo mã vạch (supplierBarcode) hoặc mã SKU nội bộ (internalSku).
   * Trả về thông tin sản phẩm kèm tồn kho tại các vị trí kho.
   */
  async findByBarcode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) throw new BadRequestException('Mã barcode/SKU không được rỗng');

    // Tìm theo supplierBarcode trước
    let product = await this.productRepo.findOne({
      where: { supplierBarcode: trimmed },
      relations: ['category', 'supplier'],
    });

    // Nếu không tìm thấy, tìm theo internalSku
    if (!product) {
      product = await this.productRepo.findOne({
        where: { internalSku: trimmed },
        relations: ['category', 'supplier'],
      });
    }

    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với mã "${trimmed}"`);
    }

    // Lấy tồn kho tại tất cả các vị trí
    const balances = await this.balanceRepo.find({
      where: { product: { id: product.id } },
      relations: ['product'],
    });

    return {
      id: product.id,
      internalSku: product.internalSku,
      supplierBarcode: product.supplierBarcode,
      name: product.name,
      unit: product.unit,
      minimumStock: product.minimumStock,
      category: product.category ? { id: product.category.id, name: product.category.name } : null,
      supplier: product.supplier ? { id: product.supplier.id, name: product.supplier.name } : null,
      stockBalances: balances.map((b) => ({
        id: b.id,
        locationCode: b.locationCode,
        totalPhysical: b.totalPhysical,
        allocated: b.allocated,
        available: b.available,
      })),
      totalStock: balances.reduce((sum, b) => sum + b.available, 0),
    };
  }

  async create(dto: CreateProductDto) {
    const product = this.productRepo.create({
      internalSku: dto.internalSku,
      name: dto.name,
      unit: dto.unit,
      minimumStock: dto.minimumStock || 0,
    });
    if (dto.categoryId) {
      const cat = await this.categoryRepo.findOneBy({ id: dto.categoryId });
      if (cat) product.category = cat;
    }
    return this.productRepo.save(product);
  }

  async findAll() {
    // Chỉ trả về sản phẩm kho/chung, không trả về các sản phẩm được liên kết riêng với nhà cung cấp.
    return this.productRepo.find({
      where: { supplier: IsNull() },
      relations: ['category', 'supplier'],
    });
  }

  async findAllWithBalances() {
    const products = await this.productRepo.find({
      relations: ['category', 'supplier'],
    });

    const balances = await this.balanceRepo.find({
      relations: ['product'],
    });

    return products.map((product) => {
      const productBalances = balances.filter((b) => b.product && b.product.id === product.id);
      return {
        id: product.id,
        internalSku: product.internalSku,
        supplierBarcode: product.supplierBarcode,
        name: product.name,
        unit: product.unit,
        minimumStock: product.minimumStock,
        category: product.category ? { id: product.category.id, name: product.category.name } : null,
        supplier: product.supplier ? { id: product.supplier.id, name: product.supplier.name } : null,
        stockBalances: productBalances.map((b) => ({
          id: b.id,
          locationCode: b.locationCode,
          totalPhysical: b.totalPhysical,
          allocated: b.allocated,
          available: b.available,
        })),
        totalStock: productBalances.reduce((sum, b) => sum + b.available, 0),
      };
    });
  }

  async findOne(id: string) {
    const p = await this.productRepo.findOne({
      where: { id, supplier: IsNull() },
      relations: ['category', 'supplier'],
    });
    if (!p) throw new NotFoundException('Product not found');
    return p;
  }

  async update(id: string, dto: UpdateProductDto) {
    const p = await this.findOne(id);

    if (dto.name) p.name = dto.name;
    if (dto.unit) p.unit = dto.unit;
    if (dto.minimumStock !== undefined) p.minimumStock = dto.minimumStock;
    if (dto.categoryId) {
      const c = await this.categoryRepo.findOneBy({ id: dto.categoryId });
      if (c) p.category = c;
    }
    return this.productRepo.save(p);
  }

  async remove(id: string) {
    await this.productRepo.delete(id);
    return { deleted: true };
  }
}
