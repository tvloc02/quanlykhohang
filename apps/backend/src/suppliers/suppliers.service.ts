import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
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

    if (dto.accountEmail || dto.accountPassword) {
      supplier.user = await this.updateOrCreateSupplierUser(supplier.user, dto, supplier.name);
    }

    const saved = await this.supplierRepo.save(supplier);
    return this.findOne(saved.id);
  }

  private async updateOrCreateSupplierUser(existingUser: User | undefined, dto: UpdateSupplierDto, supplierName?: string) {
    const email = dto.accountEmail?.trim().toLowerCase();
    const password = dto.accountPassword?.trim();

    if (!existingUser && !email) {
      throw new BadRequestException('Email đăng nhập NCC là bắt buộc khi tạo hoặc cập nhật tài khoản.');
    }

    if (!existingUser) {
      if (!password) {
        throw new BadRequestException('Mật khẩu là bắt buộc khi tạo tài khoản NCC mới.');
      }
      return this.createSupplierAccount(email!, password, supplierName);
    }

    if (email && email !== existingUser.email) {
      const duplicate = await this.userRepo.findOne({ where: { email } });
      if (duplicate && duplicate.id !== existingUser.id) {
        throw new BadRequestException('Email tài khoản NCC đã tồn tại');
      }
      existingUser.email = email;
    }

    if (password) {
      existingUser.password = await bcrypt.hash(password, 10);
    }

    if (supplierName) {
      existingUser.fullName = supplierName;
    }

    return this.userRepo.save(existingUser);
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

    let existing = await this.supplierProductRepo.findOne({
      where: { supplier: { id: supplierId }, product: { id: product.id } },
      relations: ['supplier', 'product'],
    });

    if (existing) {
      existing.supplierSku = dto.supplierSku?.trim() ?? existing.supplierSku;
      existing.itemGroup = dto.itemGroup?.trim() ?? existing.itemGroup;
      existing.managementType = dto.managementType?.trim() ?? existing.managementType;
      existing.storagePosition = dto.storagePosition?.trim() ?? existing.storagePosition;
      existing.purchasePrice = String(dto.purchasePrice ?? existing.purchasePrice);
      existing.isPrimary = dto.isPrimary !== undefined ? Boolean(dto.isPrimary) : existing.isPrimary;
      if (dto.description !== undefined) existing.description = dto.description?.trim();
      if (dto.quantity !== undefined) existing.quantity = Number(dto.quantity || 0);
      return await this.supplierProductRepo.save(existing);
    }

    try {
      const supplierProduct = this.supplierProductRepo.create({
        supplier,
        product,
        supplierSku: dto.supplierSku?.trim(),
        itemGroup: dto.itemGroup?.trim(),
        managementType: dto.managementType?.trim(),
        storagePosition: dto.storagePosition?.trim(),
        purchasePrice: String(dto.purchasePrice ?? 0),
        isPrimary: Boolean(dto.isPrimary),
        description: dto.description?.trim(),
        quantity: Number(dto.quantity || 0),
        quantityAdded: Number(dto.quantityAdded || 0),
        quantitySold: Number(dto.quantitySold || 0),
      });

      return await this.supplierProductRepo.save(supplierProduct);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const message = (error as any)?.message || 'Database error while saving supplier product';
        throw new BadRequestException(message);
      }
      throw error;
    }
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
    
    if (dto.description !== undefined) {
      supplierProduct.description = dto.description?.trim();
    }
    if (dto.quantity !== undefined) {
      supplierProduct.quantity = Number(dto.quantity || 0);
    }
    if (dto.quantityAdded !== undefined) {
      supplierProduct.quantityAdded = Number(dto.quantityAdded || 0);
    }
    if (dto.quantitySold !== undefined) {
      supplierProduct.quantitySold = Number(dto.quantitySold || 0);
    }

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

    const rawSku = dto.internalSku.trim().toUpperCase();
    const normalizedSupplierBarcode = dto.supplierSku?.trim();

    // Find if product with rawSku already exists
    let product = await this.productRepo.findOne({ where: { internalSku: rawSku }, relations: ['supplier'] });

    if (product) {
      // Update name/unit if changed
      if (dto.productName?.trim()) product.name = dto.productName.trim();
      if (dto.unit?.trim()) product.unit = dto.unit.trim();
      if (dto.productImage !== undefined) product.images = dto.productImage ? [dto.productImage] : undefined;
      try {
        await this.productRepo.save(product);
      } catch {
        // Ignore save error on shared product
      }
      return product;
    }

    // Try creating brand new product
    try {
      product = this.productRepo.create({
        internalSku: rawSku,
        name: dto.productName.trim(),
        supplierBarcode: normalizedSupplierBarcode,
        unit: dto.unit?.trim(),
        minimumStock: dto.minimumStock ?? 0,
        supplier: supplier,
        images: dto.productImage ? [dto.productImage] : undefined,
      });
      return await this.productRepo.save(product);
    } catch (error) {
      // Fallback: search again or construct scoped SKU so product creation NEVER fails
      const existingProduct = await this.productRepo.findOne({ where: { internalSku: rawSku } });
      if (existingProduct) return existingProduct;

      const scopedSku = `${rawSku}-${supplier.supplierCode || supplier.id.slice(0, 4).toUpperCase()}`;
      let scopedProduct = await this.productRepo.findOne({ where: { internalSku: scopedSku } });
      if (!scopedProduct) {
        scopedProduct = this.productRepo.create({
          internalSku: scopedSku,
          name: dto.productName.trim(),
          supplierBarcode: normalizedSupplierBarcode,
          unit: dto.unit?.trim(),
          minimumStock: dto.minimumStock ?? 0,
          supplier: supplier,
          images: dto.productImage ? [dto.productImage] : undefined,
        });
        scopedProduct = await this.productRepo.save(scopedProduct);
      }
      return scopedProduct;
    }
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
        description: link.description,
        quantity: link.quantity || 0,
        quantityAdded: link.quantityAdded || 0,
        quantitySold: link.quantitySold || 0,
        product: link.product
          ? {
              id: link.product.id,
              internalSku: link.product.internalSku,
              name: link.product.name,
              unit: link.product.unit,
              minimumStock: link.product.minimumStock,
              image: link.product.images?.[0] || '',
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
