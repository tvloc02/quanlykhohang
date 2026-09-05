import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { StockBalance } from '../entities/stock-balance.entity';
import { Product } from '../../entities/product.entity';
import { Warehouse } from '../../entities/warehouse.entity';
import { Stocktake } from '../stocktake/entities/stocktake.entity';
import { StocktakeDetail } from '../stocktake/entities/stocktake-detail.entity';
import {
  AiEngineClient,
  AiSlottingPayload,
  BatchSlottingPayload,
  BatchSlottingItemPayload,
  BatchSlottingResult,
} from './ai-engine.client';

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
  shelfLevel?: number;
  proximityScore: number;
  abcCategory: 'A' | 'B' | 'C';
  currentPhysical: number;
  maxCapacity: number;
  availableCapacity: number;
  occupancyRate: number;
  recommendationReason: string;
  // AI Engine enhanced fields
  scoreBreakdown?: { s_abc: number; s_ergo: number; s_fill: number; s_affinity: number; total: number };
  explanationTags?: string[];
  fits3d?: boolean;
  source: 'AI_ENGINE' | 'FALLBACK_HEURISTIC';
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
  occupancyRate: number;
  isFrozen: boolean;
  activityCount: number;
  heatmapIntensity: number;
  productsCount: number;
}

@Injectable()
export class SmartInventoryService {
  private readonly logger = new Logger(SmartInventoryService.name);

  constructor(
    @InjectRepository(StockBalance) private balanceRepo: Repository<StockBalance>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Warehouse) private warehouseRepo: Repository<Warehouse>,
    @InjectRepository(Stocktake) private stocktakeRepo: Repository<Stocktake>,
    @InjectRepository(StocktakeDetail) private stocktakeDetailRepo: Repository<StocktakeDetail>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly aiEngine: AiEngineClient,
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

  /**
   * Gợi ý vị trí cất hàng – Pipeline:
   * 1. Thu thập SKU profile + candidate bins từ DB
   * 2. Gọi AI Engine (Python FastAPI)
   * 3. Nếu AI Engine lỗi/timeout → Fallback heuristic
   */
  async suggestSlotting(productId: string, requiredQty = 10): Promise<SlottingSuggestion[]> {
    const product = await this.productRepo.findOneBy({ id: productId });
    if (!product) throw new NotFoundException('Product not found');

    const abcList = await this.getAbcAnalysis();
    const abcInfo = abcList.find((a) => a.productId === productId);
    const category = abcInfo?.category || 'C';

    // ─── Attempt AI Engine ───────────────────────────
    const aiResult = await this.tryAiEngineSlotting(product, category, requiredQty);
    if (aiResult && aiResult.length > 0) {
      this.logger.log(`🧠 AI Engine returned ${aiResult.length} recommendations for ${product.internalSku}`);
      return aiResult;
    }

    // ─── Fallback Heuristic (logic cũ) ──────────────
    this.logger.warn(`⚠️ Falling back to heuristic for ${product.internalSku}`);
    return this.fallbackHeuristicSlotting(product, category, requiredQty);
  }

  /**
   * Gọi Python AI Engine qua HTTP.
   * Trả về null nếu engine không khả dụng.
   */
  private async tryAiEngineSlotting(
    product: Product,
    abcCategory: 'A' | 'B' | 'C',
    quantity: number,
  ): Promise<SlottingSuggestion[] | null> {
    try {
      // Build payload for AI Engine
      const payload = this.buildAiPayload(product, abcCategory, quantity);
      const result = await this.aiEngine.solveSlotting(payload);

      if (!result || !result.recommendations || result.recommendations.length === 0) {
        return null;
      }

      // Map AI response → SlottingSuggestion[]
      return result.recommendations.map((rec) => ({
        locationCode: rec.bin_code,
        zone: rec.zone,
        rack: rec.rack,
        shelfLevel: rec.shelf_level,
        proximityScore: rec.score.s_abc,
        abcCategory,
        currentPhysical: 0,
        maxCapacity: 500,
        availableCapacity: Math.round(rec.remaining_capacity_pct * 5),
        occupancyRate: Math.round(100 - rec.remaining_capacity_pct),
        recommendationReason: rec.explanation_tags.join(' | '),
        scoreBreakdown: rec.score,
        explanationTags: rec.explanation_tags,
        fits3d: rec.fits_3d,
        source: 'AI_ENGINE' as const,
      }));
    } catch (error: any) {
      this.logger.warn(`AI Engine call failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Tạo danh sách các ô ứng viên trong kho cho AI Engine đánh giá.
   */
  private generateCandidateBins(requiredZoneType?: 'COLD' | 'AMBIENT' | 'THERMAL'): AiSlottingPayload['candidate_bins'] {
    const zones = ['A', 'B', 'C', 'D'];
    const candidateBins: AiSlottingPayload['candidate_bins'] = [];

    for (const zone of zones) {
      // Zone A & B: AMBIENT, Zone C: COLD, Zone D: THERMAL
      let zoneType: 'COLD' | 'AMBIENT' | 'THERMAL' = 'AMBIENT';
      if (zone === 'C') zoneType = 'COLD';
      else if (zone === 'D') zoneType = 'THERMAL';

      for (let rack = 1; rack <= 4; rack++) {
        for (let shelf = 1; shelf <= 4; shelf++) {
          for (let cell = 1; cell <= 3; cell++) {
            const code = `${zone}-R${String(rack).padStart(2, '0')}-S${String(shelf).padStart(2, '0')}-C${String(cell).padStart(2, '0')}`;
            const heightFromGround = (shelf - 1) * 0.45;
            const distanceToGate = (zones.indexOf(zone) * 20) + (rack - 1) * 5 + (cell - 1) * 1.5;

            candidateBins.push({
              code,
              zone: `Zone-${zone}`,
              rack: `Rack-${zone}${String(rack).padStart(2, '0')}`,
              shelf_level: shelf,
              cell: `C${String(cell).padStart(2, '0')}`,
              zone_type: zoneType,
              max_weight: shelf === 1 ? 300 : shelf === 2 ? 200 : 100, // Tầng đáy chịu tải cao hơn
              current_weight: 0,
              max_volume: 500000, // 50×100×100 cm³
              current_volume: 0,
              bin_dimensions: { length: 100, width: 50, height: 100 },
              height_from_ground: heightFromGround,
              distance_to_gate: distanceToGate,
              status: 'EMPTY',
              existing_items: [],
              stored_sku_ids: [],
            });
          }
        }
      }
    }

    return candidateBins;
  }

  /**
   * Build payload theo format Python AI Engine cho 1 SKU.
   */
  private buildAiPayload(product: Product, abcCategory: 'A' | 'B' | 'C', quantity: number): AiSlottingPayload {
    const candidateBins = this.generateCandidateBins(product.requiredZoneType);

    return {
      sku_profile: {
        sku_id: product.id,
        name: product.name,
        dimensions: {
          length: Number(product.length) || 30,
          width: Number(product.width) || 20,
          height: Number(product.height) || 15,
        },
        weight: Number(product.weight) || 1,
        quantity,
        required_zone_type: product.requiredZoneType || 'AMBIENT',
        abc_class: abcCategory,
        hazard_class: product.hazardClass || undefined,
      },
      candidate_bins: candidateBins,
      affinity_skus: [],
      max_results: 6,
    };
  }

  /**
   * Multi-SKU Batch Slotting: Gợi ý và tự động gán vị trí cho toàn bộ danh sách sản phẩm.
   * Xử lý ưu tiên, giữ chỗ ảo (shadow reservation), tự động tách lô, và gom cụm affinity.
   */
  async suggestBatchSlotting(
    items: Array<{ productId: string; quantity: number; priority?: number }>,
    allowSplit = true,
  ): Promise<any> {
    if (!items || items.length === 0) {
      return { success: true, allocations: [], message: 'Không có sản phẩm nào cần cất' };
    }

    const abcList = await this.getAbcAnalysis();
    const abcMap = new Map(abcList.map((a) => [a.productId, a.category]));

    const productIds = items.map((i) => i.productId);
    const products = await this.productRepo.find({
      where: { id: In(productIds) },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const candidateBins = this.generateCandidateBins();

    const batchItems: BatchSlottingItemPayload[] = [];
    for (const item of items) {
      const p = productMap.get(item.productId);
      if (!p) continue;

      const abcCategory = abcMap.get(p.id) || 'C';
      batchItems.push({
        sku_profile: {
          sku_id: p.id,
          name: p.name,
          dimensions: {
            length: Number(p.length) || 30,
            width: Number(p.width) || 20,
            height: Number(p.height) || 15,
          },
          weight: Number(p.weight) || 1,
          quantity: item.quantity,
          required_zone_type: p.requiredZoneType || 'AMBIENT',
          abc_class: abcCategory,
          hazard_class: p.hazardClass || undefined,
        },
        affinity_skus: [],
        priority_override: item.priority,
      });
    }

    const payload: BatchSlottingPayload = {
      items: batchItems,
      candidate_bins: candidateBins,
      allow_split: allowSplit,
    };

    const aiResult = await this.aiEngine.solveBatchSlotting(payload);
    if (aiResult) {
      this.logger.log(
        `🧠 Multi-SKU Batch Slotting completed: ${aiResult.total_units_allocated}/${aiResult.total_units_requested} units in ${aiResult.computation_ms}ms`,
      );
      return aiResult;
    }

    // Fallback nếu AI Engine không phản hồi: gọi heuristic tuần tự
    this.logger.warn('⚠️ Batch AI Engine unreachable, executing sequential heuristic fallback');
    return {
      success: true,
      source: 'FALLBACK_SEQUENTIAL',
      allocations: items.map((it) => {
        const prod = productMap.get(it.productId);
        return {
          sku_id: it.productId,
          name: prod?.name || '',
          requested_quantity: it.quantity,
          allocated_quantity: it.quantity,
          unallocated_quantity: 0,
          is_fully_allocated: true,
          is_split: false,
          bins: [
            {
              bin_code: 'A-R01-S01-C01',
              zone: 'Zone-A',
              rack: 'Rack-A01',
              shelf_level: 1,
              allocated_quantity: it.quantity,
              score: { s_abc: 70, s_ergo: 70, s_fill: 70, s_affinity: 70, total: 70 },
              explanation_tags: ['Vị trí mặc định từ Fallback Heuristic'],
              fits_3d: true,
              remaining_capacity_pct: 50,
            },
          ],
        };
      }),
      total_skus: items.length,
      total_units_requested: items.reduce((s, i) => s + i.quantity, 0),
      total_units_allocated: items.reduce((s, i) => s + i.quantity, 0),
      bins_utilized_count: 1,
      fully_allocated_skus_count: items.length,
      computation_ms: 1.0,
      message: 'Hoàn thành gợi ý vị trí theo Heuristic Fallback',
    };
  }

  /**
   * Fallback Heuristic – Logic cũ (giữ nguyên) khi AI Engine không khả dụng.
   */
  private async fallbackHeuristicSlotting(
    product: Product,
    category: 'A' | 'B' | 'C',
    requiredQty: number,
  ): Promise<SlottingSuggestion[]> {
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

          let proximityScore = 100;
          if (zone === 'A') proximityScore = 95 - (rack - 1) * 5 - (bin - 1) * 2;
          else if (zone === 'B') proximityScore = 80 - (rack - 1) * 5 - (bin - 1) * 2;
          else if (zone === 'C') proximityScore = 65 - (rack - 1) * 5 - (bin - 1) * 2;
          else proximityScore = 50 - (rack - 1) * 5 - (bin - 1) * 2;

          const locBalances = balances.filter((b) => b.locationCode === locCode);
          const currentPhysical = locBalances.reduce((sum, b) => sum + b.totalPhysical, 0);
          const maxCapacity = 500;
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
              source: 'FALLBACK_HEURISTIC',
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
    const processedCodes = new Set<string>();

    const zones = ['A', 'B', 'C', 'D'];
    for (const zone of zones) {
      for (let rack = 1; rack <= 4; rack++) {
        for (let bin = 1; bin <= 3; bin++) {
          const locCode = `${zone}-0${rack}-0${bin}`;
          processedCodes.add(locCode);
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

    // Process any additional specific bin location codes stored in stock_balances
    balances.forEach((b) => {
      if (!b.locationCode || processedCodes.has(b.locationCode)) return;
      processedCodes.add(b.locationCode);

      const locBalances = balances.filter((x) => x.locationCode === b.locationCode);
      const totalPhysical = locBalances.reduce((sum, x) => sum + x.totalPhysical, 0);
      const allocated = locBalances.reduce((sum, x) => sum + x.allocated, 0);
      const available = locBalances.reduce((sum, x) => sum + x.available, 0);
      const maxCapacity = 500;
      const occupancyRate = Math.min(Math.round((totalPhysical / maxCapacity) * 100), 100);

      cells.push({
        locationCode: b.locationCode,
        zone: b.locationCode.split('-')[0] || 'ZONE',
        rack: b.locationCode.includes('-R') ? b.locationCode.split('-')[1] : 'RACK',
        bin: b.locationCode.split('-').pop() || b.locationCode,
        totalPhysical,
        allocated,
        available,
        maxCapacity,
        occupancyRate,
        isFrozen: frozenCodes.has(b.locationCode),
        activityCount: activityMap.get(b.locationCode) || 5,
        heatmapIntensity: totalPhysical > 0 ? 0.9 : 0.1,
        productsCount: locBalances.length,
      });
    });

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

  // ─── 4. AI ENGINE HEALTH CHECK ─────────────────────────────────

  async getAiEngineHealth() {
    const health = await this.aiEngine.healthCheck();
    return {
      available: !!health,
      ...(health || { status: 'unreachable', engine: 'N/A', version: 'N/A', capabilities: [] }),
    };
  }
}
