import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { Category } from '../entities/category.entity';
import { Supplier } from '../entities/supplier.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Category) private categoryRepo: Repository<Category>,
    @InjectRepository(Supplier) private supplierRepo: Repository<Supplier>,
  ) {}

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
