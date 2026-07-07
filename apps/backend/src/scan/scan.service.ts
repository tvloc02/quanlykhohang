import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { StockBalance } from '../inventory/entities/stock-balance.entity';

/**
 * Service tra cứu nhanh sản phẩm theo mã vạch (Scan-to-Identify).
 * Tối ưu tốc độ — API phải phản hồi dưới 50ms.
 */
@Injectable()
export class ScanService {
  constructor(
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(StockBalance) private readonly balanceRepo: Repository<StockBalance>,
  ) {}

  /**
   * Tra cứu sản phẩm theo barcode hoặc SKU.
   * Trả về response theo format tài liệu thiết kế.
   *
   * @param barcode - Mã vừa quét được từ thiết bị
   * @param zoneCode - (Tùy chọn) Khu vực nhân viên đang đứng
   */
  async lookup(barcode: string, zoneCode?: string) {
    // Tìm theo supplierBarcode trước (ưu tiên barcode từ nhà cung cấp)
    let product = await this.productRepo.findOne({
      where: { supplierBarcode: barcode },
      relations: ['category', 'supplier'],
    });

    // Nếu không tìm thấy, tìm theo internalSku
    if (!product) {
      product = await this.productRepo.findOne({
        where: { internalSku: barcode },
        relations: ['category', 'supplier'],
      });
    }

    if (!product) {
      const externalData = await this.fetchExternalProductData(barcode);
      return {
        success: true,
        data: {
          is_external: true,
          barcode: barcode,
          name: externalData?.name || '',
          supplier: externalData?.supplier || '',
        },
        meta: null,
      };
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
      },
      meta: null,
    };
  }

  private async fetchExternalProductData(barcode: string): Promise<{ name: string; supplier: string } | null> {
    try {
      // Check if it's an ISBN (starts with 978 or 979)
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
      } else {
        // Try OpenFoodFacts for other barcodes
        const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
        if (response.ok) {
          const data = await response.json();
          if (data.status === 1 && data.product) {
            return {
              name: data.product.product_name || '',
              supplier: data.product.brands || '',
            };
          }
        }
      }
    } catch (e) {
      // Ignore errors from external APIs
    }
    return null;
  }
}
