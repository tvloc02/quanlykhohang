import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { StockBalance } from '../inventory/entities/stock-balance.entity';
import { SupplierProduct } from '../entities/supplier-product.entity';

/**
 * Service tra cứu nhanh sản phẩm theo mã vạch (Scan-to-Identify).
 * Tối ưu tốc độ — API phải phản hồi dưới 50ms.
 */
import { BarcodeMappingService } from '../inbound/barcode-mapping/barcode-mapping.service';

@Injectable()
export class ScanService {
  constructor(
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(StockBalance) private readonly balanceRepo: Repository<StockBalance>,
    @InjectRepository(SupplierProduct) private readonly supplierProductRepo: Repository<SupplierProduct>,
    private readonly mappingService: BarcodeMappingService,
  ) {}

  /**
   * Tra cứu sản phẩm theo barcode hoặc SKU.
   * Trả về response theo format tài liệu thiết kế.
   *
   * @param barcode - Mã vừa quét được từ thiết bị
   * @param zoneCode - (Tùy chọn) Khu vực nhân viên đang đứng
   */
  async lookup(barcode: string, zoneCode?: string) {
    // Kiểm tra trong bảng ánh xạ mã vạch ngoại lệ trước (US02.02)
    const mapping = await this.mappingService.findByBarcode(barcode);
    let product = null;

    if (mapping?.product) {
      product = await this.productRepo.findOne({
        where: { id: mapping.product.id },
        relations: ['category', 'supplier'],
      });
    }

    // Tìm theo supplierBarcode trước (ưu tiên barcode từ nhà cung cấp)
    if (!product) {
      product = await this.productRepo.findOne({
        where: { supplierBarcode: barcode },
        relations: ['category', 'supplier'],
      });
    }

    // Nếu không tìm thấy, tìm theo internalSku
    if (!product) {
      product = await this.productRepo.findOne({
        where: { internalSku: barcode },
        relations: ['category', 'supplier'],
      });
    }

    if (!product) {
      const externalData = await this.fetchExternalProductData(barcode);
      
      if (externalData) {
        return {
          success: true,
          data: {
            is_external: true,
            barcode: barcode,
            name: externalData.name,
            supplier: externalData.supplier,
          },
          meta: null,
        };
      } else {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Không tìm thấy thông tin sản phẩm trong kho hay hệ thống bên ngoài.',
            details: { scanned_code: barcode }
          }
        } as any;
      }
    }

    // Lấy tồn kho tại tất cả các vị trí
    const balances = await this.balanceRepo.find({
      where: { product: { id: product.id } },
    });

    // Tính tổng tồn kho
    const totalPhysical = balances.reduce((sum, b) => sum + b.totalPhysical, 0);
    const totalAvailable = balances.reduce((sum, b) => sum + b.available, 0);
    const totalAllocated = balances.reduce((sum, b) => sum + b.allocated, 0);

    // Xác định vị trí gần nhất (ưu tiên zone_code nếu có)
    let bestLocation: { zone_code: string; shelf_code: string } | null = null;

    if (balances.length > 0) {
      if (zoneCode) {
        // Tìm balance trong zone ưu tiên
        const zoneBalance = balances.find((b) =>
          b.locationCode.toUpperCase().startsWith(zoneCode.toUpperCase()),
        );
        if (zoneBalance) {
          const parts = zoneBalance.locationCode.split('-');
          bestLocation = {
            zone_code: parts[0] || zoneBalance.locationCode,
            shelf_code: zoneBalance.locationCode,
          };
        }
      }

      // Fallback: lấy vị trí có tồn kho available lớn nhất
      if (!bestLocation) {
        const best = balances.reduce((max, b) => (b.available > max.available ? b : max), balances[0]);
        const parts = best.locationCode.split('-');
        bestLocation = {
          zone_code: parts[0] || best.locationCode,
          shelf_code: best.locationCode,
        };
      }
    }

    // Lấy giá mặc định từ SupplierProduct (ưu tiên primary)
    const supplierProduct = await this.supplierProductRepo.findOne({
      where: { product: { id: product.id } as any },
      relations: ['product'],
      order: { isPrimary: 'DESC' as const },
    });
    const defaultPrice = supplierProduct ? Number(supplierProduct.purchasePrice) : 0;

    return {
      success: true,
      data: {
        product_id: product.id,
        internal_sku: product.internalSku,
        name: product.name,
        barcode: product.supplierBarcode || barcode,
        current_stock: {
          total_physical: totalPhysical,
          available: totalAvailable,
          allocated: totalAllocated,
        },
        location: bestLocation,
        unit: product.unit || null,
        purchase_price: defaultPrice || undefined,
      },
      meta: null,
    };
  }

  private async fetchExternalProductData(barcode: string): Promise<{ name: string; supplier: string } | null> {
    try {
      // 1. Nếu là sách (ISBN bắt đầu bằng 978 hoặc 979)
      if (barcode.startsWith('978') || barcode.startsWith('979')) {
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${barcode}`);
        if (response.ok) {
          const data = await response.json();
          if (data.items && data.items.length > 0) {
            const bookInfo = data.items[0].volumeInfo;
            return {
              name: bookInfo.title || '',
              supplier: bookInfo.publisher || '',
            };
          }
        }
      } 
      
      // 2. Thử tìm trên hệ thống UPCitemDB (Hệ thống dữ liệu khổng lồ cho gia dụng, điện tử, thời trang, tạp hóa...)
      // Dùng bản Trial (giới hạn ~100 request/ngày) không cần API Key
      const upcResponse = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`);
      if (upcResponse.ok) {
        const upcData = await upcResponse.json();
        if (upcData.code === 'OK' && upcData.items && upcData.items.length > 0) {
          return {
            name: upcData.items[0].title || '',
            supplier: upcData.items[0].brand || '',
          };
        }
      }

      // 3. Fallback cuối cùng: OpenFoodFacts (dành cho thực phẩm, đồ uống)
      const offResponse = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      if (offResponse.ok) {
        const offData = await offResponse.json();
        if (offData.status === 1 && offData.product) {
          return {
            name: offData.product.product_name || '',
            supplier: offData.product.brands || '',
          };
        }
      }

    } catch (e) {
      // Ignore errors from external APIs
      console.warn('Lỗi khi tra cứu external API:', e);
    }
    return null;
  }
}

