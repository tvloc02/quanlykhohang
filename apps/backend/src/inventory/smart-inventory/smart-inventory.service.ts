import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { StockBalance } from '../entities/stock-balance.entity';
import { Product } from '../../entities/product.entity';
import { Warehouse } from '../../entities/warehouse.entity';
import { Stocktake } from '../stocktake/entities/stocktake.entity';
import { StocktakeDetail } from '../stocktake/entities/stocktake-detail.entity';

export interface AbcProductClassification {
  productId: string;
  sku: string;
  name: string;
  unit?: string;
  totalTurnover: number;
  cumulativePercentage: number;
  category: 'A' | 'B' | 'C';
}

export interface SlottingSuggestion {
  locationCode: string;
  zone: string;
  rack: string;
  proximityScore: number; // 0 to 100
  abcCategory: 'A' | 'B' | 'C';
  currentPhysical: number;
  maxCapacity: number;
  availableCapacity: number;
  occupancyRate: number;
  recommendationReason: string;
}

export interface DigitalTwinCell {
  locationCode: string;
  zone: string;
  rack: string;
  bin: string;
  totalPhysical: number;
  allocated: number;
  available: number;
  maxCapacity: number;
  occupancyRate: number; // 0 to 100
  isFrozen: boolean;
  activityCount: number;
  heatmapIntensity: number; // 0.0 to 1.0
  productsCount: number;
}

@Injectable()
export class SmartInventoryService {
  constructor(
    @InjectRepository(StockBalance) private balanceRepo: Repository<StockBalance>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Warehouse) private warehouseRepo: Repository<Warehouse>,
    @InjectRepository(Stocktake) private stocktakeRepo: Repository<Stocktake>,
    @InjectRepository(StocktakeDetail) private stocktakeDetailRepo: Repository<StocktakeDetail>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── 1. SMART SLOTTING & ABC ANALYSIS ─────────────────────────

  async getAbcAnalysis(): Promise<AbcProductClassification[]> {
    const products = await this.productRepo.find();
    if (products.length === 0) return [];

    // Query outbound transaction volume per product
    const turnoverRows: Array<{ productId: string; totalQty: string }> = await this.dataSource.query(`
      SELECT productId, SUM(pickedQty) as totalQty 
      FROM outbound_details 
      GROUP BY productId
    `).catch(() => []);

    const turnoverMap = new Map<string, number>();
    turnoverRows.forEach((r) => {
      turnoverMap.set(r.productId, Number(r.totalQty) || 0);
    });

    // Also include inbound volume for initial activity
    const inboundRows: Array<{ productId: string; totalQty: string }> = await this.dataSource.query(`
      SELECT productId, SUM(receivedQty) as totalQty 
      FROM stock_in_receipt_details 
      GROUP BY productId
    `).catch(() => []);

    inboundRows.forEach((r) => {
      const current = turnoverMap.get(r.productId) || 0;
      turnoverMap.set(r.productId, current + (Number(r.totalQty) || 0) * 0.5);
    });

    const items = products.map((p) => ({
      productId: p.id,
      sku: p.internalSku,
      name: p.name,
      unit: p.unit,
      totalTurnover: turnoverMap.get(p.id) || 0,
    }));

    // Sort by turnover descending
    items.sort((a, b) => b.totalTurnover - a.totalTurnover);

    const grandTotal = items.reduce((sum, i) => sum + i.totalTurnover, 0) || 1;
    let accumulated = 0;

    return items.map((item) => {
      accumulated += item.totalTurnover;
      const pct = (accumulated / grandTotal) * 100;
      let category: 'A' | 'B' | 'C' = 'C';
      if (pct <= 70 || items.indexOf(item) < Math.ceil(items.length * 0.2)) {
        category = 'A';
      } else if (pct <= 90 || items.indexOf(item) < Math.ceil(items.length * 0.5)) {
        category = 'B';
      }

      return {
        ...item,
        cumulativePercentage: Math.round(pct * 10) / 10,
        category,
      };
    });
  }

  async suggestSlotting(productId: string, requiredQty = 10): Promise<SlottingSuggestion[]> {
    const product = await this.productRepo.findOneBy({ id: productId });
    if (!product) throw new NotFoundException('Product not found');

    const abcList = await this.getAbcAnalysis();
    const abcInfo = abcList.find((a) => a.productId === productId);
    const category = abcInfo?.category || 'C';

    // Generate grid location topology
    const zones = ['A', 'B', 'C', 'D'];
    const suggestions: SlottingSuggestion[] = [];

    const balances = await this.balanceRepo.find({ relations: ['product'] });
    const frozenWarehouses = await this.warehouseRepo.find({ where: { isFrozen: true } });
    const frozenCodes = new Set(frozenWarehouses.map((w) => w.code.toUpperCase()));

    for (const zone of zones) {
      for (let rack = 1; rack <= 4; rack++) {
        for (let bin = 1; bin <= 3; bin++) {
          const locCode = `${zone}-0${rack}-0${bin}`;

          if (frozenCodes.has(locCode) || frozenCodes.has(zone)) continue;

          // Compute Gate Proximity Score (Zone A/Rack 1 closest to gate = 95-100)
          let proximityScore = 100;
          if (zone === 'A') proximityScore = 95 - (rack - 1) * 5 - (bin - 1) * 2;
          else if (zone === 'B') proximityScore = 80 - (rack - 1) * 5 - (bin - 1) * 2;
          else if (zone === 'C') proximityScore = 65 - (rack - 1) * 5 - (bin - 1) * 2;
          else proximityScore = 50 - (rack - 1) * 5 - (bin - 1) * 2;

          const locBalances = balances.filter((b) => b.locationCode === locCode);
          const currentPhysical = locBalances.reduce((sum, b) => sum + b.totalPhysical, 0);
          const maxCapacity = 500; // Standard bin capacity
          const availableCapacity = Math.max(maxCapacity - currentPhysical, 0);
          const occupancyRate = Math.round((currentPhysical / maxCapacity) * 100);

          if (availableCapacity >= requiredQty) {
            let reason = '';
            if (category === 'A' && zone === 'A') {
              reason = 'Tối ưu tuyệt đối: Hàng bán chạy nhóm A nằm ở Khu A gần cửa xuất nhập kho nhất';
            } else if (category === 'B' && (zone === 'A' || zone === 'B')) {
              reason = 'Vị trí lý tưởng cho hàng nhóm B luân chuyển vừa';
            } else if (category === 'C' && (zone === 'C' || zone === 'D')) {
              reason = 'Phù hợp hàng nhóm C bán chậm, lưu kho tầng sâu';
            } else {
              reason = `Khu vực ${zone} còn trống ${availableCapacity} đơn vị dung tích`;
            }

            suggestions.push({
              locationCode: locCode,
              zone: `Khu ${zone}`,
              rack: `Kệ ${zone}-0${rack}`,
              proximityScore,
              abcCategory: category,
              currentPhysical,
              maxCapacity,
              availableCapacity,
              occupancyRate,
              recommendationReason: reason,
            });
          }
        }
      }
    }

    // Sort by proximity score for Category A/B, or balanced score for C
    if (category === 'A') {
      suggestions.sort((a, b) => b.proximityScore - a.proximityScore);
    } else if (category === 'B') {
      suggestions.sort((a, b) => Math.abs(b.proximityScore - 75) - Math.abs(a.proximityScore - 75));
    } else {
      suggestions.sort((a, b) => a.proximityScore - b.proximityScore);
    }

    return suggestions.slice(0, 6);
  }

  // ─── 2. 2D DIGITAL TWIN & WAREHOUSE HEATMAP ────────────────────

  async getDigitalTwinTopology(days = 30): Promise<DigitalTwinCell[]> {
    const balances = await this.balanceRepo.find({ relations: ['product'] });
    const frozenWarehouses = await this.warehouseRepo.find({ where: { isFrozen: true } });
    const frozenCodes = new Set(frozenWarehouses.map((w) => w.code.toUpperCase()));

    // Activity log counts per location code
    const activityRows: Array<{ locationCode: string; cnt: string }> = await this.dataSource.query(`
      SELECT warehouseCode as locationCode, COUNT(*) as cnt 
      FROM outbound_details 
      WHERE warehouseCode IS NOT NULL 
      GROUP BY warehouseCode
      UNION ALL
      SELECT locationCode, COUNT(*) as cnt 
      FROM stock_balances 
      GROUP BY locationCode
    `).catch(() => []);

    const activityMap = new Map<string, number>();
    activityRows.forEach((r) => {
      if (r.locationCode) {
        const cur = activityMap.get(r.locationCode) || 0;
        activityMap.set(r.locationCode, cur + (Number(r.cnt) || 0));
      }
    });

    const maxActivity = Math.max(...Array.from(activityMap.values()), 1);

    const cells: DigitalTwinCell[] = [];
    const zones = ['A', 'B', 'C', 'D'];

    for (const zone of zones) {
      for (let rack = 1; rack <= 4; rack++) {
        for (let bin = 1; bin <= 3; bin++) {
          const locCode = `${zone}-0${rack}-0${bin}`;
          const locBalances = balances.filter((b) => b.locationCode === locCode);

          const totalPhysical = locBalances.reduce((sum, b) => sum + b.totalPhysical, 0);
          const allocated = locBalances.reduce((sum, b) => sum + b.allocated, 0);
          const available = locBalances.reduce((sum, b) => sum + b.available, 0);
          const maxCapacity = 500;
          const occupancyRate = Math.min(Math.round((totalPhysical / maxCapacity) * 100), 100);
          const activityCount = activityMap.get(locCode) || Math.floor(Math.random() * 5) + 1;
          const heatmapIntensity = Math.min(Math.round((activityCount / maxActivity) * 100) / 100, 1.0);

          cells.push({
            locationCode: locCode,
            zone: `Khu ${zone}`,
            rack: `Kệ ${zone}-0${rack}`,
            bin: `Ô ${bin}`,
            totalPhysical,
            allocated,
            available,
            maxCapacity,
            occupancyRate,
            isFrozen: frozenCodes.has(locCode) || frozenCodes.has(zone),
            activityCount,
            heatmapIntensity,
            productsCount: locBalances.length,
          });
        }
      }
    }

    return cells;
  }

  async getLocationDetails(locationCode: string) {
    const balances = await this.balanceRepo.find({
      where: { locationCode },
      relations: ['product'],
    });

    const totalPhysical = balances.reduce((sum, b) => sum + b.totalPhysical, 0);
    const allocated = balances.reduce((sum, b) => sum + b.allocated, 0);
    const available = balances.reduce((sum, b) => sum + b.available, 0);

    return {
      locationCode,
      totalPhysical,
      allocated,
      available,
      maxCapacity: 500,
      occupancyRate: Math.min(Math.round((totalPhysical / 500) * 100), 100),
      items: balances.map((b) => ({
        id: b.id,
        productId: b.product?.id,
        sku: b.product?.internalSku,
        name: b.product?.name,
        unit: b.product?.unit,
        totalPhysical: b.totalPhysical,
        allocated: b.allocated,
        available: b.available,
      })),
    };
  }

  // ─── 3. SMART STOCKTAKE RISK ANALYSIS & AUTO GENERATION ────────

  async getRiskAnalysis() {
    const abcList = await this.getAbcAnalysis();
    const balances = await this.balanceRepo.find({ relations: ['product'] });

    // Historical stocktake discrepancy count per product
    const diffRows: Array<{ productId: string; totalDiff: string; cnt: string }> = await this.dataSource.query(`
      SELECT productDate as productId, SUM(ABS(difference)) as totalDiff, COUNT(*) as cnt 
      FROM stocktake_details 
      GROUP BY productId
    `).catch(() => []);

    const diffMap = new Map<string, number>();
    diffRows.forEach((r) => {
      diffMap.set(r.productId, Number(r.totalDiff) || 0);
    });

    const riskItems = abcList.map((abc) => {
      const locBalance = balances.find((b) => b.product?.id === abc.productId);
      const pastDiff = diffMap.get(abc.productId) || 0;
      const turnoverFactor = abc.category === 'A' ? 40 : abc.category === 'B' ? 25 : 10;
      const diffFactor = Math.min(pastDiff * 10, 40);
      const randomAgeFactor = Math.floor(Math.random() * 20);

      const riskScore = Math.min(turnoverFactor + diffFactor + randomAgeFactor, 100);

      let riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      if (riskScore >= 70) riskLevel = 'HIGH';
      else if (riskScore >= 40) riskLevel = 'MEDIUM';

      return {
        productId: abc.productId,
        sku: abc.sku,
        name: abc.name,
        unit: abc.unit,
        category: abc.category,
        locationCode: locBalance?.locationCode || 'A-01-01',
        totalPhysical: locBalance?.totalPhysical || 0,
        pastDiscrepancy: pastDiff,
        riskScore,
        riskLevel,
        recommendation:
          riskLevel === 'HIGH'
            ? 'Khuyến nghị kiểm kê khẩn cấp (Hàng nhóm A / Lịch sử lệch tồn cao)'
            : riskLevel === 'MEDIUM'
            ? 'Kiểm kê định kỳ 30 ngày'
            : 'Kiểm kê xoay vòng tiêu chuẩn',
      };
    });

    riskItems.sort((a, b) => b.riskScore - a.riskScore);
    return riskItems;
  }

  async generateRecommendedStocktake(assignee?: string, createdBy?: string) {
    const riskItems = await this.getRiskAnalysis();
    const highRiskItems = riskItems.filter((i) => i.riskScore >= 40).slice(0, 10);

    if (highRiskItems.length === 0) {
      throw new BadRequestException('Không có sản phẩm nguy cơ cao nào cần tạo phiên kiểm kê');
    }

    const locationCode = highRiskItems[0].locationCode || 'A-01-01';
    const totalCount = await this.stocktakeRepo.count();
    const stocktakeNo = `KK-SMART-${String(totalCount + 1).padStart(4, '0')}`;

    const stocktake = this.stocktakeRepo.create({
      stocktakeNo,
      locationCode,
      status: 'DRAFT',
      note: 'Phiên kiểm kê tự động gợi ý dựa trên phân tích rủi ro Smart WMS (AI Risk Score)',
      assignee: assignee || 'Quản lý kho',
      createdBy: createdBy || 'Hệ thống Smart WMS',
      purpose: 'Kiểm kê thông minh phòng chống thất thoát',
    });

    const savedStocktake = await this.stocktakeRepo.save(stocktake);

    for (const item of highRiskItems) {
      const product = await this.productRepo.findOneBy({ id: item.productId });
      if (product) {
        const detail = this.stocktakeDetailRepo.create({
          stocktake: savedStocktake,
          product,
          systemQty: item.totalPhysical,
          countedQty: undefined,
          difference: 0,
          note: `Điểm rủi ro: ${item.riskScore}/100 (${item.recommendation})`,
        });
        await this.stocktakeDetailRepo.save(detail);
      }
    }

    return this.stocktakeRepo.findOne({
      where: { id: savedStocktake.id },
      relations: ['details', 'details.product'],
    });
  }
}
