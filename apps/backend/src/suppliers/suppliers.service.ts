import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Product } from '../entities/product.entity';
import { Role } from '../entities/role.entity';
import { SupplierProduct } from '../entities/supplier-product.entity';
import { Supplier } from '../entities/supplier.entity';
import { User } from '../entities/user.entity';
import { CreateSupplierDto, UpdateSupplierDto, UpsertSupplierProductDto } from './dto/create-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier) private supplierRepo: Repository<Supplier>,
    @InjectRepository(SupplierProduct) private supplierProductRepo: Repository<SupplierProduct>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
  ) {}

  async create(dto: CreateSupplierDto) {
    const supplierCode = dto.supplierCode?.trim().toUpperCase() || (await this.generateSupplierCode());
    await this.ensureSupplierCodeAvailable(supplierCode);

    const supplier = this.supplierRepo.create(this.mapSupplierDto(dto, supplierCode, true));

    if (dto.accountEmail && dto.accountPassword) {
      supplier.user = await this.createSupplierAccount(dto.accountEmail, dto.accountPassword, dto.name);
    }

    const saved = await this.supplierRepo.save(supplier);
    return this.findOne(saved.id);
  }

  async findAll() {
    const suppliers = await this.supplierRepo.find({
      relations: ['user', 'products', 'products.product'],
      order: { id: 'DESC' },
    });
    return suppliers.map((supplier) => this.serializeSupplier(supplier));
  }

  async findOne(id: string) {
    return this.serializeSupplier(await this.getSupplierEntity(id));
  }

  async findMine(user: { supplierId?: string }) {
    if (!user?.supplierId) throw new NotFoundException('Supplier profile not found for this account');
    return this.findOne(user.supplierId);
  }

  async update(id: string, dto: UpdateSupplierDto) {
    const supplier = await this.getSupplierEntity(id);
    const nextCode = dto.supplierCode?.trim().toUpperCase() || supplier.supplierCode;

    if (nextCode !== supplier.supplierCode) {
      await this.ensureSupplierCodeAvailable(nextCode, id);
    }

    const mapped = this.mapSupplierDto(dto, nextCode);
    Object.entries(mapped).forEach(([key, value]) => {
      if (value !== undefined) {
        (supplier as any)[key] = value;
      }
    });

    if (dto.accountEmail && dto.accountPassword) {
      supplier.user = await this.createSupplierAccount(dto.accountEmail, dto.accountPassword, dto.name || supplier.name);
    }

    const saved = await this.supplierRepo.save(supplier);
    return this.findOne(saved.id);
  }

  async updateMine(user: { supplierId?: string }, dto: UpdateSupplierDto) {
    if (!user?.supplierId) throw new NotFoundException('Supplier profile not found for this account');
    const allowed: UpdateSupplierDto = {
      taxCode: dto.taxCode,
      contactPerson: dto.contactPerson,
      phone: dto.phone,
      email: dto.email,
      address: dto.address,
      leadTimeDays: dto.leadTimeDays,
      paymentTerms: dto.paymentTerms,
      currency: dto.currency,
      priorityLevel: dto.priorityLevel,
    };
    return this.update(user.supplierId, allowed);
  }

  async remove(id: string) {
    await this.getSupplierEntity(id);
    await this.supplierRepo.delete(id);
    return { deleted: true };
  }

  async addProduct(supplierId: string, dto: UpsertSupplierProductDto) {
    const supplier = await this.getSupplierEntity(supplierId);
    const product = await this.resolveSupplierProduct(supplier, dto);

    const existing = await this.supplierProductRepo.findOne({
      where: { supplier: { id: supplierId }, product: { id: product.id } },
      relations: ['supplier', 'product'],
    });

    if (existing) {
      throw new BadRequestException('Product is already linked to this supplier');
    }

    const supplierProduct = this.supplierProductRepo.create({
      supplier,
      product,
      supplierSku: dto.supplierSku?.trim(),
      itemGroup: dto.itemGroup?.trim(),
      managementType: dto.managementType?.trim(),
      storagePosition: dto.storagePosition?.trim(),
      purchasePrice: String(dto.purchasePrice ?? 0),
      isPrimary: Boolean(dto.isPrimary),
    });

    return this.supplierProductRepo.save(supplierProduct);
  }

  async updateProduct(supplierId: string, id: string, dto: UpsertSupplierProductDto) {
    const supplierProduct = await this.findSupplierProduct(supplierId, id);

    if (dto.productId && dto.productId !== supplierProduct.product.id) {
      const product = await this.productRepo.findOneBy({ id: dto.productId });
      if (!product) throw new NotFoundException('Product not found');
      supplierProduct.product = product;
    } else if (!dto.productId && dto.internalSku) {
      supplierProduct.product = await this.resolveSupplierProduct(supplierProduct.supplier, dto, supplierProduct.product.id);
    }

    supplierProduct.supplierSku = dto.supplierSku?.trim();
    supplierProduct.itemGroup = dto.itemGroup?.trim();
    supplierProduct.managementType = dto.managementType?.trim();
    supplierProduct.storagePosition = dto.storagePosition?.trim();
    supplierProduct.purchasePrice = String(dto.purchasePrice ?? 0);
    supplierProduct.isPrimary = Boolean(dto.isPrimary);

    return this.supplierProductRepo.save(supplierProduct);
  }

  async removeProduct(supplierId: string, id: string) {
    await this.findSupplierProduct(supplierId, id);
    await this.supplierProductRepo.delete(id);
    return { deleted: true };
  }

  private async findSupplierProduct(supplierId: string, id: string) {
    const supplierProduct = await this.supplierProductRepo.findOne({
      where: { id, supplier: { id: supplierId } },
      relations: ['supplier', 'product'],
    });
    if (!supplierProduct) throw new NotFoundException('Supplier product link not found');
    return supplierProduct;
  }

  private async resolveSupplierProduct(supplier: Supplier, dto: UpsertSupplierProductDto, currentProductId?: string) {
    if (dto.productId) {
      const product = await this.productRepo.findOneBy({ id: dto.productId });
      if (!product) throw new NotFoundException('Product not found');
      return product;
    }

    if (!dto.internalSku?.trim() || !dto.productName?.trim()) {
      throw new BadRequestException('internalSku and productName are required when productId is not provided');
    }

    const internalSku = dto.internalSku.trim().toUpperCase();
    let product = await this.productRepo.findOne({ where: { internalSku }, relations: ['supplier'] });

    if (product && product.id !== currentProductId) {
      return product;
    }

    if (!product) {
      product = this.productRepo.create({ internalSku });
    }

    product.name = dto.productName.trim();
    product.supplierBarcode = dto.supplierSku?.trim();
    product.unit = dto.unit?.trim();
    product.minimumStock = dto.minimumStock ?? 0;
    product.supplier = supplier;

    return this.productRepo.save(product);
  }

  private async getSupplierEntity(id: string) {
    const supplier = await this.supplierRepo.findOne({
      where: { id },
      relations: ['user', 'products', 'products.product'],
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  private serializeSupplier(supplier: Supplier) {
    const { user, products = [], ...rest } = supplier as Supplier & { user?: User; products?: SupplierProduct[] };

    return {
      ...rest,
      accountEmail: user?.email,
      productCount: products.length,
      products: products.map((link) => ({
        id: link.id,
        supplierSku: link.supplierSku,
        itemGroup: link.itemGroup,
        managementType: link.managementType,
        storagePosition: link.storagePosition,
        purchasePrice: link.purchasePrice,
        isPrimary: link.isPrimary,
        product: link.product
          ? {
              id: link.product.id,
              internalSku: link.product.internalSku,
              name: link.product.name,
              unit: link.product.unit,
              minimumStock: link.product.minimumStock,
            }
          : null,
      })),
    };
  }

  private mapSupplierDto(dto: UpdateSupplierDto, supplierCode: string, withDefaults = false) {
    return {
      supplierCode,
      name: dto.name?.trim(),
      taxCode: dto.taxCode?.trim(),
      status: dto.status ?? (withDefaults ? 'active' : undefined),
      contactPerson: dto.contactPerson?.trim(),
      phone: dto.phone?.trim(),
      email: dto.email?.trim(),
      address: dto.address?.trim(),
      leadTimeDays: dto.leadTimeDays ?? (withDefaults ? 0 : undefined),
      paymentTerms: dto.paymentTerms?.trim(),
      currency: dto.currency?.trim() || (withDefaults ? 'VND' : undefined),
      priorityLevel: dto.priorityLevel ?? (withDefaults ? 'secondary' : undefined),
    };
  }

  private async generateSupplierCode() {
    const total = await this.supplierRepo.count();
    let index = total + 1;
    let code = this.formatSupplierCode(index);

    while (await this.supplierRepo.findOne({ where: { supplierCode: code } })) {
      index += 1;
      code = this.formatSupplierCode(index);
    }

    return code;
  }

  private formatSupplierCode(index: number) {
    return `NCC${String(index).padStart(3, '0')}`;
  }

  private async ensureSupplierCodeAvailable(supplierCode: string, currentId?: string) {
    const duplicate = await this.supplierRepo.findOne({ where: { supplierCode } });
    if (duplicate && duplicate.id !== currentId) {
      throw new BadRequestException('Supplier code already exists');
    }
  }

  private async createSupplierAccount(email: string, password: string, fullName?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.userRepo.findOne({ where: { email: normalizedEmail } });
    if (existing) throw new BadRequestException('Supplier account email already exists');

    let role = await this.roleRepo.findOne({ where: { name: 'supplier' } });
    if (!role) {
      role = await this.roleRepo.save(this.roleRepo.create({ name: 'supplier' }));
    }

    return this.userRepo.save(
      this.userRepo.create({
        email: normalizedEmail,
        password: await bcrypt.hash(password, 10),
        fullName,
        roles: [role],
      }),
    );
  }
}
