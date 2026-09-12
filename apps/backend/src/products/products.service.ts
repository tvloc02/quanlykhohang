import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
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

export function normalizeWhCanonicalKey(rawLoc: string): string {
  const s = String(rawLoc || '').trim().toUpperCase();
  if (!s) return 'UNKNOWN';

  if (s === 'KH001' || s.includes('TỔNG (HÀ NỘI)') || s.includes('TONG (HA NOI)') || s === 'WH_DEFAULT_1') return 'KH001';
  if (s === 'KH002' || s.includes('CHI NHÁNH HCM') || s.includes('CHI NHANH HCM') || s === 'WH_DEFAULT_2') return 'KH002';
  if (s === 'KHO-TONG' || s.includes('SPX EXPRESS') || s === 'WH_DEFAULT_3') return 'KHO-TONG';
  if (s === 'KHO-HN' || s.includes('TRUNG TÂM HÀ NỘI') || s.includes('TRUNG TAM HA NOI') || s === 'WH_DEFAULT_4') return 'KHO-HN';
  if (s === 'KHO-BD' || s.includes('NGUYÊN VẬT LIỆU') || s.includes('NGUYEN VAT LIEU') || s === 'WH_DEFAULT_5') return 'KHO-BD';
  if (s === 'KHO-CUCHI' || s.includes('LẠNH CỦ CHI') || s.includes('LANH CU CHI') || s === 'WH_DEFAULT_6') return 'KHO-CUCHI';
  if (s === 'KH006' || s.includes('THANH TRÌ') || s.includes('KHO-NVL')) return 'KH006';

  const match = s.match(/(KH\d+|KHO-[A-Z0-9]+)/);
  if (match) return match[1];

  return s;
}

export function calculateAggregatedStock(productBalances: any[]) {
  if (!productBalances || productBalances.length === 0) return { totalStock: 0, availableStock: 0 };

  const mainWhBalances = productBalances.filter((b) => {
    const loc = String(b.locationCode || '').trim();
    return loc && !loc.includes('-R0') && !loc.includes('-S0') && !loc.includes('-C') && !loc.toUpperCase().startsWith('ZONE-');
  });

  const binBalances = productBalances.filter((b) => {
    const loc = String(b.locationCode || '').trim();
    return loc && (loc.includes('-R0') || loc.includes('-S0') || loc.includes('-C') || loc.toUpperCase().startsWith('ZONE-'));
  });

  let totalStock = 0;
  let availableStock = 0;

  if (mainWhBalances.length > 0) {
    const whMap = new Map<string, { totalPhysical: number; available: number }>();
    mainWhBalances.forEach((b) => {
      const canonicalKey = normalizeWhCanonicalKey(b.locationCode);
      const p = b.totalPhysical !== undefined ? Number(b.totalPhysical) : Number(b.available || 0);
      const a = Number(b.available || 0);

      if (!whMap.has(canonicalKey)) {
        whMap.set(canonicalKey, { totalPhysical: p, available: a });
      } else {
        const cur = whMap.get(canonicalKey)!;
        cur.totalPhysical = Math.max(cur.totalPhysical, p);
        cur.available = Math.max(cur.available, a);
      }
    });

    for (const [, v] of whMap) {
      totalStock += v.totalPhysical;
      availableStock += v.available;
    }
  } else if (binBalances.length > 0) {
    binBalances.forEach((b) => {
      const p = b.totalPhysical !== undefined ? Number(b.totalPhysical) : Number(b.available || 0);
      const a = Number(b.available || 0);
      totalStock += p;
      availableStock += a;
    });
  }

  return { totalStock, availableStock };
}

@Injectable()
export class ProductsService implements OnModuleInit {
  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Category) private categoryRepo: Repository<Category>,
    @InjectRepository(Supplier) private supplierRepo: Repository<Supplier>,
    @InjectRepository(StockBalance) private balanceRepo: Repository<StockBalance>,
    @InjectRepository(StockInHistory) private stockInHistoryRepo: Repository<StockInHistory>,
    @InjectRepository(InboundDetail) private inboundDetailRepo: Repository<InboundDetail>,
  ) { }

  async onModuleInit() {
    try {
      const defaultLogistics: Record<string, Partial<Product>> = {
        'SP-DT-006': { weight: 2.2, length: 35, width: 26, height: 6, volume: 0.0055, volumetricWeight: 0.91, tempRequirement: 'AMBIENT', turnoverClass: 'A' },
        'SP-DT-007': { weight: 0.45, length: 18, width: 10, height: 4, volume: 0.0007, volumetricWeight: 0.12, tempRequirement: 'AMBIENT', turnoverClass: 'A' },
        'SP-DT-001': { weight: 0.75, length: 25, width: 22, height: 8, volume: 0.0044, volumetricWeight: 0.73, tempRequirement: 'AMBIENT', turnoverClass: 'B' },
        'SP-DT-002': { weight: 0.15, length: 15, width: 10, height: 3, volume: 0.0005, volumetricWeight: 0.08, tempRequirement: 'THERMAL', turnoverClass: 'B' },
        'SP-DT-003': { weight: 0.35, length: 16, width: 14, height: 7, volume: 0.0016, volumetricWeight: 0.26, tempRequirement: 'AMBIENT', turnoverClass: 'A' },
        'SP-TP-001': { weight: 5.0, length: 45, width: 30, height: 10, volume: 0.0135, volumetricWeight: 2.25, tempRequirement: 'AMBIENT', turnoverClass: 'A' },
        'SP-TP-006': { weight: 13.0, length: 40, width: 25, height: 22, volume: 0.022, volumetricWeight: 3.67, tempRequirement: 'THERMAL', turnoverClass: 'A' },
        'SP-VL-001': { weight: 8.5, length: 110, width: 20, height: 20, volume: 0.044, volumetricWeight: 7.33, tempRequirement: 'AMBIENT', turnoverClass: 'C' },
        '24110806': { weight: 0.08, length: 10, width: 10, height: 2, volume: 0.0002, volumetricWeight: 0.03, tempRequirement: 'AMBIENT', turnoverClass: 'C' },
        'HH484105': { weight: 0.45, length: 18, width: 10, height: 4, volume: 0.0007, volumetricWeight: 0.12, tempRequirement: 'AMBIENT', turnoverClass: 'A' },
        'HH976498': { weight: 0.25, length: 10, width: 10, height: 5, volume: 0.0005, volumetricWeight: 0.08, tempRequirement: 'AMBIENT', turnoverClass: 'A' },
        'HH180338': { weight: 0.25, length: 10, width: 10, height: 5, volume: 0.0005, volumetricWeight: 0.08, tempRequirement: 'AMBIENT', turnoverClass: 'B' },
      };

      const products = await this.productRepo.find();
      for (const p of products) {
        const sku = p.internalSku;
        const seed = defaultLogistics[sku];
        if (seed) {
          p.weight = seed.weight!;
          p.length = seed.length!;
          p.width = seed.width!;
          p.height = seed.height!;
          p.volume = seed.volume!;
          p.volumetricWeight = seed.volumetricWeight!;
          p.tempRequirement = seed.tempRequirement!;
          p.turnoverClass = seed.turnoverClass!;
          await this.productRepo.save(p);
        }
      }
    } catch (e) {
      console.error('Seed logistics error:', e);
    }
  }

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

    const { totalStock, availableStock } = calculateAggregatedStock(balances);

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
      totalStock,
      availableStock,
    };
  }

  async create(dto: CreateProductDto) {
    try {
      // Auto-generate internalSku if empty
      let sku = dto.internalSku?.trim() || dto.supplierBarcode?.trim();
      if (!sku) {
        sku = 'HH' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 100).toString().padStart(2, '0');
      }

      const length = dto.length !== undefined ? Number(dto.length) : 20;
      const width = dto.width !== undefined ? Number(dto.width) : 15;
      const height = dto.height !== undefined ? Number(dto.height) : 10;
      const volume = dto.volume !== undefined ? Number(dto.volume) : Number(((length * width * height) / 1000000).toFixed(4));
      const volumetricWeight = dto.volumetricWeight !== undefined ? Number(dto.volumetricWeight) : Number(((length * width * height) / 6000).toFixed(3));
      const weight = dto.weight !== undefined ? Number(dto.weight) : 1.0;
      const tempRequirement = dto.tempRequirement || 'AMBIENT';
      const turnoverClass = dto.turnoverClass || 'B';

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
        weight,
        length,
        width,
        height,
        volume,
        volumetricWeight,
        tempRequirement,
        turnoverClass,
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
        const { totalStock } = calculateAggregatedStock(productBalances);

        const lastInbound = inboundDetails.find((d) => d.product && d.product.id === product.id);
        const lastStockInQty = lastInbound
          ? Number(lastInbound.receivedQty || lastInbound.expectedQty || 0)
          : (totalStock > 0 ? totalStock : 0);

        return {
          ...product,
          weight: Number(product.weight ?? 1.0),
          length: Number(product.length ?? 20.0),
          width: Number(product.width ?? 15.0),
          height: Number(product.height ?? 10.0),
          volume: Number(product.volume ?? 0.003),
          volumetricWeight: Number(product.volumetricWeight ?? 0.5),
          tempRequirement: product.tempRequirement || 'AMBIENT',
          turnoverClass: product.turnoverClass || 'B',
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
      const { totalStock } = calculateAggregatedStock(productBalances);
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
        weight: Number(product.weight ?? 1.0),
        length: Number(product.length ?? 20.0),
        width: Number(product.width ?? 15.0),
        height: Number(product.height ?? 10.0),
        volume: Number(product.volume ?? 0.003),
        volumetricWeight: Number(product.volumetricWeight ?? 0.5),
        tempRequirement: product.tempRequirement || 'AMBIENT',
        turnoverClass: product.turnoverClass || 'B',
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

      if (dto.weight !== undefined) p.weight = Number(dto.weight);
      if (dto.length !== undefined) p.length = Number(dto.length);
      if (dto.width !== undefined) p.width = Number(dto.width);
      if (dto.height !== undefined) p.height = Number(dto.height);

      if (dto.length !== undefined || dto.width !== undefined || dto.height !== undefined) {
        const l = Number(p.length || 20);
        const w = Number(p.width || 15);
        const h = Number(p.height || 10);
        p.volume = dto.volume !== undefined ? Number(dto.volume) : Number(((l * w * h) / 1000000).toFixed(4));
        p.volumetricWeight = dto.volumetricWeight !== undefined ? Number(dto.volumetricWeight) : Number(((l * w * h) / 6000).toFixed(3));
      } else {
        if (dto.volume !== undefined) p.volume = Number(dto.volume);
        if (dto.volumetricWeight !== undefined) p.volumetricWeight = Number(dto.volumetricWeight);
      }

      if (dto.tempRequirement !== undefined) p.tempRequirement = dto.tempRequirement;
      if (dto.turnoverClass !== undefined) p.turnoverClass = dto.turnoverClass;

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
      const orderCode = String(h.orderCode || '').trim().toUpperCase();
      if (orderCode) seenKeys.add(orderCode);

      const whCode = h.warehouseCode && h.warehouseCode !== 'KHO-NVL' ? h.warehouseCode : 'KH006';
      const whName = h.warehouseName && h.warehouseName !== 'Kho KHO-NVL' && h.warehouseName !== 'KHO-NVL' && h.warehouseName !== 'Kho KH006'
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
      const orderCode = String(d.inboundReceipt?.poNumber || '').trim().toUpperCase();
      if (orderCode && seenKeys.has(orderCode)) {
        continue;
      }
      if (orderCode) seenKeys.add(orderCode);

      const createdAt = d.inboundReceipt?.orderDate || new Date();
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
        orderCode: d.inboundReceipt?.poNumber || 'PNK-ORDER',
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

    // Sort by date descending
    return combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}
