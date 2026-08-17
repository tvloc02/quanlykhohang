import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { Category } from '../entities/category.entity';
import { Supplier } from '../entities/supplier.entity';
import { StockBalance } from '../inventory/entities/stock-balance.entity';
import { StockInHistory } from '../entities/stock-in-history.entity';
import { InboundDetail } from '../inbound/entities/inbound-detail.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Category) private categoryRepo: Repository<Category>,
    @InjectRepository(Supplier) private supplierRepo: Repository<Supplier>,
    @InjectRepository(StockBalance) private balanceRepo: Repository<StockBalance>,
    @InjectRepository(StockInHistory) private stockInHistoryRepo: Repository<StockInHistory>,
    @InjectRepository(InboundDetail) private inboundDetailRepo: Repository<InboundDetail>,
  ) { }

  /**
   * Tra cứu hàng hóa theo mã vạch (supplierBarcode) hoặc mã SKU nội bộ (internalSku).
   * Trả về thông tin hàng hóa kèm tồn kho tại các vị trí kho.
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
      throw new NotFoundException(`Không tìm thấy hàng hóa với mã "${trimmed}"`);
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
      price: product.price,
      importPrice: product.importPrice || 0,
      wholesalePrice: product.wholesalePrice || 0,
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
      // Auto-generate internalSku if empty
      let sku = dto.internalSku?.trim() || dto.supplierBarcode?.trim();
      if (!sku) {
        sku = 'HH' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 100).toString().padStart(2, '0');
      }

      const product = this.productRepo.create({
        internalSku: sku,
        supplierBarcode: dto.supplierBarcode?.trim() || sku,
        name: dto.name.trim(),
        unit: dto.unit?.trim() || 'Cái',
        minimumStock: dto.minimumStock || 0,
        price: dto.price || 0,
        importPrice: dto.importPrice || 0,
        wholesalePrice: dto.wholesalePrice || 0,
        images: dto.images || [],
        isVisible: dto.isVisible ?? false,
      });

      if (dto.categoryId) {
        let cat = await this.categoryRepo.findOneBy({ id: dto.categoryId });
        if (!cat && dto.category) {
          cat = await this.categoryRepo.findOne({ where: { name: dto.category.trim() } });
        }
        if (cat) product.category = cat;
      } else if (dto.category) {
        const cat = await this.categoryRepo.findOne({ where: { name: dto.category.trim() } });
        if (cat) product.category = cat;
      }

      return await this.productRepo.save(product);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new BadRequestException(`Mã sản phẩm "${dto.internalSku}" đã tồn tại trong hệ thống. Vui lòng chọn mã khác.`);
      }
      throw new BadRequestException(error.sqlMessage || error.message || 'Lỗi khi tạo hàng hóa');
    }
  }

  async findAll() {
    try {
      const products = await this.productRepo.find({
        relations: ['category', 'supplier'],
      });

      const balances = await this.balanceRepo.find({
        relations: ['product'],
      });

      const inboundDetails = await this.inboundDetailRepo.find({
        relations: ['product'],
        order: { id: 'DESC' },
      });

      return products.map((product) => {
        const productBalances = balances.filter((b) => b.product && b.product.id === product.id);
        const totalStock = productBalances.reduce(
          (sum, b) => sum + (b.totalPhysical !== undefined ? Number(b.totalPhysical) : Number(b.available || 0)),
          0
        );

        const lastInbound = inboundDetails.find((d) => d.product && d.product.id === product.id);
        const lastStockInQty = lastInbound
          ? Number(lastInbound.receivedQty || lastInbound.expectedQty || 0)
          : (totalStock > 0 ? totalStock : 0);

        return {
          ...product,
          totalStock,
          retailPrice: Number(product.price || 0),
          wholesalePrice: Number(product.wholesalePrice || 0),
          importPrice: Number(product.importPrice || 0),
          lastStockInQty,
          stockBalances: productBalances.map((b) => ({
            id: b.id,
            locationCode: b.locationCode,
            totalPhysical: Number(b.totalPhysical || 0),
            allocated: Number(b.allocated || 0),
            available: Number(b.available || 0),
          })),
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

    const inboundDetails = await this.inboundDetailRepo.find({
      relations: ['product'],
      order: { id: 'DESC' },
    });

    return products.map((product) => {
      const productBalances = balances.filter((b) => b.product && b.product.id === product.id);
      const totalStock = productBalances.reduce((sum, b) => sum + (Number(b.available) || 0), 0);
      const lastInbound = inboundDetails.find((d) => d.product && d.product.id === product.id);
      const lastStockInQty = lastInbound
        ? Number(lastInbound.receivedQty || lastInbound.expectedQty || 0)
        : (totalStock > 0 ? totalStock : 0);

      return {
        id: product.id,
        internalSku: product.internalSku,
        supplierBarcode: product.supplierBarcode,
        name: product.name,
        unit: product.unit,
        minimumStock: product.minimumStock,
        price: product.price,
        retailPrice: Number(product.price || 0),
        importPrice: Number(product.importPrice || 0),
        wholesalePrice: Number(product.wholesalePrice || 0),
        lastStockInQty,
        category: product.category ? { id: product.category.id, name: product.category.name } : null,
        supplier: product.supplier ? { id: product.supplier.id, name: product.supplier.name } : null,
        stockBalances: productBalances.map((b) => ({
          id: b.id,
          locationCode: b.locationCode,
          totalPhysical: b.totalPhysical,
          allocated: b.allocated,
          available: b.available,
        })),
        totalStock,
      };
    });
  }

  async findOne(id: string) {
    const p = await this.productRepo.findOne({
      where: { id },
      relations: ['category', 'supplier'],
    });
    if (!p) throw new NotFoundException('Product not found');
    return p;
  }

  async update(id: string, dto: UpdateProductDto) {
    try {
      const p = await this.findOne(id);

      if (dto.name) p.name = dto.name.trim();
      if (dto.supplierBarcode) p.supplierBarcode = dto.supplierBarcode.trim();
      if (dto.unit) p.unit = dto.unit.trim();
      if (dto.minimumStock !== undefined) p.minimumStock = dto.minimumStock;
      if (dto.price !== undefined) p.price = dto.price;
      if (dto.importPrice !== undefined) p.importPrice = dto.importPrice;
      if (dto.wholesalePrice !== undefined) p.wholesalePrice = dto.wholesalePrice;
      if (dto.images !== undefined) p.images = dto.images;
      if (dto.isVisible !== undefined) p.isVisible = dto.isVisible;

      if (dto.categoryId) {
        let cat = await this.categoryRepo.findOneBy({ id: dto.categoryId });
        if (!cat && dto.category) {
          cat = await this.categoryRepo.findOne({ where: { name: dto.category.trim() } });
        }
        if (cat) p.category = cat;
      } else if (dto.category) {
        const cat = await this.categoryRepo.findOne({ where: { name: dto.category.trim() } });
        if (cat) p.category = cat;
      }

      return await this.productRepo.save(p);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new BadRequestException(`Mã hàng hóa đã bị trùng lặp.`);
      }
      throw new BadRequestException(error.sqlMessage || error.message || 'Lỗi khi cập nhật hàng hóa');
    }
  }

  async remove(id: string) {
    // Lấy tất cả bản ghi tồn kho của sản phẩm
    const balances = await this.balanceRepo.find({
      where: { product: { id } }
    });

    // Kiểm tra xem sản phẩm có thực sự còn tồn kho > 0 không
    const hasActiveStock = balances.some(
      (b) => Number(b.totalPhysical || 0) > 0 || Number(b.available || 0) > 0
    );

    if (hasActiveStock) {
      throw new BadRequestException('Hàng hóa đang có tồn kho > 0, không thể xóa. Vui lòng xuất hết kho trước.');
    }

    try {
      // Xóa các bản ghi tồn kho bằng 0 liên quan trước để tránh lỗi khóa ngoại
      if (balances.length > 0) {
        await this.balanceRepo.delete({ product: { id } as any }).catch(() => null);
      }
      await this.productRepo.delete(id);
      return { deleted: true };
    } catch (err: any) {
      if (err.code === 'ER_ROW_IS_REFERENCED_2') {
        throw new BadRequestException('Hàng hóa đang có giao dịch chứng từ liên quan, không thể xóa');
      }
      throw new BadRequestException(err.sqlMessage || err.message || 'Lỗi hệ thống khi xóa hàng hóa');
    }
  }

  /**
   * Lấy lịch sử nhập kho chi tiết của sản phẩm (bao gồm thời gian, nhà cung cấp, kho hàng, số lượng, đơn giá)
   */
  async getStockInHistory(productId: string) {
    // 1. Query dedicated stock_in_history table
    const explicitHistory = await this.stockInHistoryRepo.find({
      where: { productId },
      order: { createdAt: 'DESC' },
    });

    // 2. Query inbound_details joined with inbound_receipts for comprehensive history
    const inboundDetails = await this.inboundDetailRepo.find({
      where: { product: { id: productId } as any },
      relations: ['inboundReceipt', 'inboundReceipt.supplier', 'product'],
      order: { id: 'DESC' },
    });

    const combined: Array<{
      id: string;
      orderCode: string;
      createdAt: Date | string;
      supplierName: string;
      warehouseCode: string;
      warehouseName: string;
      quantity: number;
      unitPrice: number;
      totalAmount: number;
      createdBy: string;
      note: string;
      status: string;
    }> = [];

    const seenKeys = new Set<string>();

    for (const h of explicitHistory) {
      const key = `${h.orderCode}_${h.createdAt?.toString()}`;
      seenKeys.add(key);
      const whCode = h.warehouseCode && h.warehouseCode !== 'KHO-NVL' ? h.warehouseCode : 'KH006';
      const whName = h.warehouseName && h.warehouseName !== 'Kho KHO-NVL' && h.warehouseName !== 'KHO-NVL'
        ? h.warehouseName
        : (whCode === 'KH006' ? 'Kho Thanh Trì' : `Kho ${whCode}`);

      combined.push({
        id: h.id,
        orderCode: h.orderCode || 'PNK-SYSTEM',
        createdAt: h.createdAt || new Date(),
        supplierName: h.supplierName || h.supplier?.name || 'Nhà cung cấp chính',
        warehouseCode: whCode,
        warehouseName: whName,
        quantity: Number(h.quantity || 0),
        unitPrice: Number(h.unitPrice || 0),
        totalAmount: Number(h.totalAmount || (Number(h.quantity || 0) * Number(h.unitPrice || 0))),
        createdBy: h.createdBy || 'Quản lý kho',
        note: h.note || 'Nhập kho hàng hóa',
        status: 'Đã hoàn thành',
      });
    }

    for (const d of inboundDetails) {
      const orderCode = d.inboundReceipt?.poNumber || 'PNK-ORDER';
      const createdAt = d.inboundReceipt?.orderDate || new Date();
      const key = `${orderCode}_${createdAt.toString()}`;

      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        const qty = Number(d.receivedQty || d.expectedQty || 0);
        const unitPrice = Number(d.unitPrice || 0);
        const totalAmount = Number(d.totalLineAmount || (qty * unitPrice));
        const statusMap: Record<string, string> = {
          'RECEIVED': 'Đã hoàn thành',
          'COMPLETED': 'Đã hoàn thành',
          'APPROVED': 'Đã duyệt',
          'DRAFT': 'Đơn nháp',
        };
        const rawWh = d.warehouseCode || (d.inboundReceipt as any)?.warehouseCode;
        const whCode = rawWh && rawWh !== 'KHO-NVL' ? rawWh : 'KH006';
        const whName = whCode === 'KH006' ? 'Kho Thanh Trì' : `Kho ${whCode}`;

        combined.push({
          id: d.id,
          orderCode,
          createdAt,
          supplierName: d.inboundReceipt?.supplierName || d.inboundReceipt?.supplier?.name || 'Nhà cung cấp',
          warehouseCode: whCode,
          warehouseName: whName,
          quantity: qty,
          unitPrice,
          totalAmount,
          createdBy: d.inboundReceipt?.creatorName || d.inboundReceipt?.approverName || 'Quản lý kho',
          note: d.inboundReceipt?.description || 'Phiếu nhập kho hàng hóa',
          status: statusMap[d.inboundReceipt?.status || ''] || 'Đã hoàn thành',
        });
      }
    }

    // Sort by date descending
    return combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}
