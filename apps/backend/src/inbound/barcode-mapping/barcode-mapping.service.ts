import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BarcodeMapping } from './entities/barcode-mapping.entity';
import { Product } from '../../entities/product.entity';

@Injectable()
export class BarcodeMappingService {
  constructor(
    @InjectRepository(BarcodeMapping)
    private readonly mappingRepo: Repository<BarcodeMapping>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async create(barcode: string, productId: string) {
    const product = await this.productRepo.findOneBy({ id: productId });
    if (!product) {
      throw new NotFoundException('Sản phẩm trong hệ thống không tồn tại');
    }

    // Xóa mapping cũ nếu đã tồn tại barcode này
    const existing = await this.mappingRepo.findOneBy({ barcode });
    if (existing) {
      await this.mappingRepo.remove(existing);
    }

    const mapping = this.mappingRepo.create({
      barcode,
      product,
    });

    return this.mappingRepo.save(mapping);
  }

  async findByBarcode(barcode: string) {
    return this.mappingRepo.findOne({
      where: { barcode },
      relations: ['product'],
    });
  }
}
