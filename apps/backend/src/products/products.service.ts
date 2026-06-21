import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    if (dto.supplierBarcode && !dto.supplierId) {
      throw new BadRequestException('supplierId is required when supplierBarcode is provided');
    }

    const product = this.productRepo.create({
      internalSku: dto.internalSku,
      supplierBarcode: dto.supplierBarcode,
      name: dto.name,
      unit: dto.unit,
      minimumStock: dto.minimumStock || 0,
    });
    if (dto.categoryId) {
      const cat = await this.categoryRepo.findOneBy({ id: dto.categoryId });
      if (cat) product.category = cat;
    }
    if (dto.supplierId) {
      const supplier = await this.supplierRepo.findOneBy({ id: dto.supplierId });
      if (!supplier) throw new NotFoundException('Supplier not found');
      product.supplier = supplier;
    }
    return this.productRepo.save(product);
  }

  async findAll() {
    return this.productRepo.find({ relations: ['category', 'supplier'] });
  }

  async findOne(id: string) {
    const p = await this.productRepo.findOne({ where: { id }, relations: ['category', 'supplier'] });
    if (!p) throw new NotFoundException('Product not found');
    return p;
  }

  async update(id: string, dto: UpdateProductDto) {
    const p = await this.findOne(id);
    if (dto.supplierBarcode && !dto.supplierId && !p.supplier) {
      throw new BadRequestException('supplierId is required when supplierBarcode is provided');
    }

    if (dto.name) p.name = dto.name;
    if (dto.supplierBarcode) p.supplierBarcode = dto.supplierBarcode;
    if (dto.unit) p.unit = dto.unit;
    if (dto.minimumStock !== undefined) p.minimumStock = dto.minimumStock;
    if (dto.categoryId) {
      const c = await this.categoryRepo.findOneBy({ id: dto.categoryId });
      if (c) p.category = c;
    }
    if (dto.supplierId) {
      const supplier = await this.supplierRepo.findOneBy({ id: dto.supplierId });
      if (!supplier) throw new NotFoundException('Supplier not found');
      p.supplier = supplier;
    }
    return this.productRepo.save(p);
  }

  async remove(id: string) {
    await this.productRepo.delete(id);
    return { deleted: true };
  }
}
