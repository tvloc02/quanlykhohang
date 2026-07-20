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
    try {
      const product = this.productRepo.create({
        internalSku: dto.internalSku,
        name: dto.name,
        unit: dto.unit,
        minimumStock: dto.minimumStock || 0,
        price: dto.price || 0,
        images: dto.images || [],
      });
      if (dto.categoryId) {
        const cat = await this.categoryRepo.findOneBy({ id: dto.categoryId });
        if (cat) product.category = cat;
      }
      return await this.productRepo.save(product);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new BadRequestException(`Mã sản phẩm "${dto.internalSku}" đã tồn tại trong hệ thống (có thể thuộc Sản phẩm NCC). Vui lòng chọn mã khác.`);
      }
      throw new BadRequestException(error.sqlMessage || error.message || 'Lỗi khi tạo sản phẩm');
    }
  }

  async findAll() {
    try {
      const products = await this.productRepo.find({
        where: { supplier: IsNull() },
        relations: ['category', 'supplier'],
      });

      const balances = await this.balanceRepo.find({
        relations: ['product'],
      });

      return products.map((product) => {
        const productBalances = balances.filter((b) => b.product && b.product.id === product.id);
        return {
          ...product,
          totalStock: productBalances.reduce((sum, b) => sum + b.available, 0),
        };
      }).sort((a, b) => Number(b.id) - Number(a.id));
    } catch (e: any) {
      throw new BadRequestException('FINDALL_ERR: ' + e.message);
    }
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
    try {
      const p = await this.findOne(id);

      if (dto.name) p.name = dto.name;
      if (dto.unit) p.unit = dto.unit;
      if (dto.minimumStock !== undefined) p.minimumStock = dto.minimumStock;
      if (dto.price !== undefined) p.price = dto.price;
      if (dto.images !== undefined) p.images = dto.images;
      if (dto.categoryId) {
        const c = await this.categoryRepo.findOneBy({ id: dto.categoryId });
        if (c) p.category = c;
      }
      return await this.productRepo.save(p);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new BadRequestException(`Mã sản phẩm đã bị trùng lặp.`);
      }
      throw new BadRequestException(error.sqlMessage || error.message || 'Lỗi khi cập nhật sản phẩm');
    }
  }

  async remove(id: string) {
    // Không cho phép xóa nếu có tồn kho
    const hasBalances = await this.balanceRepo.count({
      where: { product: { id } }
    });

    if (hasBalances > 0) {
      throw new BadRequestException('Sản phẩm đang có dữ liệu tồn kho, không thể xóa');
    }

    try {
      await this.productRepo.delete(id);
      return { deleted: true };
    } catch (err: any) {
      // Bắt lỗi khóa ngoại nếu sản phẩm đang nằm trong đơn đặt hàng, phiếu xuất, v.v.
      if (err.code === 'ER_ROW_IS_REFERENCED_2') {
        throw new BadRequestException('Sản phẩm đang có giao dịch liên quan (chưa xóa hết), không thể xóa');
      }
      throw err;
    }
  }
}
