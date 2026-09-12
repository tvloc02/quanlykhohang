import { SubWarehouse, WarehouseRecord, getRackLetterPrefix, calculateGlobalShelfIndex } from '../../../shared/utils/warehouseAssignments';

export type ProductSlotInput = {
  productName: string;
  sku?: string;
  category?: string;
  tempRequirement: 'COLD' | 'AMBIENT' | 'THERMAL';
  packageLength: number; // cm
  packageWidth: number;  // cm
  packageHeight: number; // cm
  weightPerUnit: number; // kg per unit
  totalQty: number;      // total units to slot
  turnoverClass: 'A' | 'B' | 'C'; // A = Fast-moving, B = Medium, C = Slow
};

export type BinCellInfo = {
  binCode: string; // e.g. A1, B1, ZA-R01-A1
  zoneId: string;
  zoneCode: string;
  zoneName: string;
  zoneType: 'COLD' | 'AMBIENT' | 'THERMAL';
  rackNumber: number;
  shelfLevel: number;
  cellIndex: number;
  cellLengthCm: number;
  cellWidthCm: number;
  cellHeightCm: number;
  cellVolumeM3: number; // Calculated: L*W*H / 1_000_000
  maxWeightCapacityKg: number; // kg
  currentWeightKg: number;
  currentOccupancyPct: number;
  status: 'EMPTY' | 'PARTIAL' | 'FULL';
};

export type AiSlottingRecommendation = {
  bin: BinCellInfo;
  score: number; // 0 - 100
  reasons: string[];
  isTopChoice: boolean;
  allocatedQty: number; // How many items should go into this bin
};

// ============================================================================
// CORE: Compute physical capacity of a bin for a given item
// Single Source of Truth for all volume/weight calculations
// ============================================================================

export interface BinPhysicalCapacity {
  maxItemsByVolume: number;
  maxItemsByWeight: number;
  maxItems: number;
  limitingFactor: 'volume' | 'weight';
  volumeUtilPct: number;  // For maxItems items
  weightUtilPct: number;  // For maxItems items
  itemFitsInBin: boolean; // Whether at least 1 item physically fits
  rotationUsed: 'none' | 'LWH' | 'WLH' | 'LHW' | 'WHL' | 'HLW' | 'HWL';
}

/**
 * Calculate how many items can physically fit in a bin, considering:
 * 1. Weight capacity
 * 2. Volume capacity (with stacking/packing)
 * 3. Rotation of items to find best orientation
 * 4. Existing occupancy (remaining capacity)
 */
export function computeBinPhysicalCapacity(
  bin: {
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    maxWeightKg: number;
    currentWeightKg?: number;
    currentOccupancyPct?: number;
  },
  item: {
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    weightKg: number;
  }
): BinPhysicalCapacity {
  const bL = Math.max(1, bin.lengthCm);
  const bW = Math.max(1, bin.widthCm);
  const bH = Math.max(1, bin.heightCm);
  const bMaxW = Math.max(0.1, bin.maxWeightKg);
  const bCurrentW = Math.max(0, bin.currentWeightKg || 0);
  const bCurrentPct = Math.max(0, bin.currentOccupancyPct || 0);

  const iL = Math.max(0.1, item.lengthCm);
  const iW = Math.max(0.1, item.widthCm);
  const iH = Math.max(0.1, item.heightCm);
  const iW_kg = Math.max(0.001, item.weightKg);

  // Remaining capacity
  const remainingWeightKg = Math.max(0, bMaxW - bCurrentW);
  const remainingVolumeFraction = Math.max(0, (100 - bCurrentPct) / 100);

  // Effective bin volume available
  const binVolCm3 = bL * bW * bH;
  const availableVolCm3 = binVolCm3 * remainingVolumeFraction;
  const itemVolCm3 = iL * iW * iH;

  // -----------------------------------------------------------------------
  // ROTATION CHECK: Try all 6 rotations to find best packing orientation
  // For each rotation, calculate how many items fit by 3D grid packing
  // -----------------------------------------------------------------------
  type RotationName = 'none' | 'LWH' | 'WLH' | 'LHW' | 'WHL' | 'HLW' | 'HWL';
  const rotations: Array<{ name: RotationName; l: number; w: number; h: number }> = [
    { name: 'none', l: iL, w: iW, h: iH },  // Original orientation
    { name: 'WLH', l: iW, w: iL, h: iH },   // Swap L<->W
    { name: 'LHW', l: iL, w: iH, h: iW },   // Swap W<->H
    { name: 'WHL', l: iW, w: iH, h: iL },   // Rotate all
    { name: 'HLW', l: iH, w: iL, h: iW },   // H as length
    { name: 'HWL', l: iH, w: iW, h: iL },   // H as length, swap W
  ];

  let bestRotation = rotations[0];
  let bestFitCount = 0;

  for (const rot of rotations) {
    // Check if single item fits in this orientation
    if (rot.l > bL || rot.w > bW || rot.h > bH) continue;

    // 3D grid packing: how many items fit along each axis
    const countL = Math.floor(bL / rot.l);
    const countW = Math.floor(bW / rot.w);
    const countH = Math.floor(bH / rot.h);
    const fitCount = countL * countW * countH;

    if (fitCount > bestFitCount) {
      bestFitCount = fitCount;
      bestRotation = rot;
    }
  }

  const itemFitsInBin = bestFitCount > 0;

  if (!itemFitsInBin) {
    return {
      maxItemsByVolume: 0,
      maxItemsByWeight: 0,
      maxItems: 0,
      limitingFactor: 'volume',
      volumeUtilPct: 0,
      weightUtilPct: 0,
      itemFitsInBin: false,
      rotationUsed: 'none',
    };
  }

  // Adjust for remaining volume (partial occupancy)
  // Use a packing efficiency factor (real-world shelves ~65-75% packing efficiency)
  const PACKING_EFFICIENCY = 0.70;
  const maxItemsByVolSimple = Math.floor(availableVolCm3 / itemVolCm3 * PACKING_EFFICIENCY);

  // Grid-based count is the geometric limit, volume-based is the volumetric limit
  // Take the smaller (more conservative) estimate, adjusted for remaining space
  const geometricMax = Math.floor(bestFitCount * remainingVolumeFraction);
  const maxItemsByVolume = Math.max(0, Math.min(geometricMax, maxItemsByVolSimple));

  // Weight-based limit
  const maxItemsByWeight = Math.max(0, Math.floor(remainingWeightKg / iW_kg));

  // Final: min of volume and weight
  const maxItems = Math.min(maxItemsByVolume, maxItemsByWeight);

  // Utilization percentages (for maxItems items)
  const usedVolCm3 = maxItems * itemVolCm3;
  const usedWeightKg = maxItems * iW_kg;
  const volumeUtilPct = binVolCm3 > 0 ? Math.round((usedVolCm3 / binVolCm3) * 100) : 0;
  const weightUtilPct = bMaxW > 0 ? Math.round((usedWeightKg / bMaxW) * 100) : 0;

  return {
    maxItemsByVolume,
    maxItemsByWeight,
    maxItems,
    limitingFactor: maxItemsByWeight <= maxItemsByVolume ? 'weight' : 'volume',
    volumeUtilPct: Math.min(100, volumeUtilPct + Math.round(bCurrentPct)),
    weightUtilPct: Math.min(100, weightUtilPct),
    itemFitsInBin,
    rotationUsed: bestRotation.name,
  };
}

/**
 * Quick helper: compute occupancy % for a given qty of items in a bin
 */
export function computeOccupancyPct(
  binLengthCm: number,
  binWidthCm: number,
  binHeightCm: number,
  binMaxWeightKg: number,
  itemLengthCm: number,
  itemWidthCm: number,
  itemHeightCm: number,
  itemWeightKg: number,
  qty: number,
  existingOccupancyPct: number = 0
): { occupancyPct: number; limitingFactor: 'volume' | 'weight' } {
  const binVolM3 = (binLengthCm * binWidthCm * binHeightCm) / 1_000_000;
  const itemVolM3 = (itemLengthCm * itemWidthCm * itemHeightCm) / 1_000_000;
  const totalItemVolM3 = qty * Math.max(0.000001, itemVolM3);
  const totalItemWeightKg = qty * Math.max(0.001, itemWeightKg);

  const effectiveBinVolM3 = Math.max(0.001, binVolM3);
  const effectiveBinWeightKg = Math.max(0.1, binMaxWeightKg);

  const volPct = Math.round((totalItemVolM3 / effectiveBinVolM3) * 100);
  const weightPct = Math.round((totalItemWeightKg / effectiveBinWeightKg) * 100);

  const newPct = Math.max(volPct, weightPct);
  const totalPct = Math.min(100, Math.max(1, newPct + existingOccupancyPct));

  return {
    occupancyPct: totalPct,
    limitingFactor: weightPct >= volPct ? 'weight' : 'volume',
  };
}

// ============================================================================
// Core: Calculate full slotting requirement (volume, weight, capacity, required bins)
// ============================================================================

export interface ProductSlottingRequirement {
  itemLengthCm: number;
  itemWidthCm: number;
  itemHeightCm: number;
  itemWeightKg: number;
  itemVolumeM3: number;
  totalVolumeM3: number;
  totalWeightKg: number;
  binMaxItems: number;
  binMaxVolumeM3: number;
  binMaxWeightKg: number;
  limitingFactor: 'volume' | 'weight';
  requiredBinsCount: number;
  fullBinsCount: number;
  remainderQty: number;
  remainderOccupancyPct: number;
  isHeavy: boolean;
  isLight: boolean;
  recommendedTiers: string;
  tierDescription: string;
}

export function calculateProductSlottingRequirement(
  item: {
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
    weightKg?: number;
    qty?: number;
  },
  binDimensions: {
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
    maxWeightKg?: number;
  } = {}
): ProductSlottingRequirement {
  const iL = Math.max(0.1, Number(item.lengthCm) || 20);
  const iW = Math.max(0.1, Number(item.widthCm) || 15);
  const iH = Math.max(0.1, Number(item.heightCm) || 10);
  const iWeight = Math.max(0.01, Number(item.weightKg) || 1.0);
  const qty = Math.max(1, Number(item.qty) || 1);

  const bL = Math.max(10, Number(binDimensions.lengthCm) || 120);
  const bW = Math.max(10, Number(binDimensions.widthCm) || 80);
  const bH = Math.max(10, Number(binDimensions.heightCm) || 100);
  const bMaxWeight = Math.max(1, Number(binDimensions.maxWeightKg) || 500);

  const itemVolumeM3 = (iL * iW * iH) / 1_000_000;
  const binMaxVolumeM3 = (bL * bW * bH) / 1_000_000;
  const totalVolumeM3 = qty * itemVolumeM3;
  const totalWeightKg = qty * iWeight;

  const cap = computeBinPhysicalCapacity(
    { lengthCm: bL, widthCm: bW, heightCm: bH, maxWeightKg: bMaxWeight, currentWeightKg: 0, currentOccupancyPct: 0 },
    { lengthCm: iL, widthCm: iW, heightCm: iH, weightKg: iWeight }
  );

  const binMaxItems = Math.max(1, cap.maxItems);
  const limitingFactor = cap.limitingFactor;

  const requiredBinsCount = Math.max(1, Math.ceil(qty / binMaxItems));
  const fullBinsCount = Math.floor(qty / binMaxItems);
  const remainderQty = qty % binMaxItems;
  const remainderOccupancyPct = remainderQty > 0
    ? computeOccupancyPct(bL, bW, bH, bMaxWeight, iL, iW, iH, iWeight, remainderQty, 0).occupancyPct
    : 0;

  const isHeavy = iWeight >= 20 || totalWeightKg >= 50;
  const isLight = iWeight < 5 && totalWeightKg < 30;

  let recommendedTiers = 'Tầng B, C (Tầm với trung bình)';
  let tierDescription = 'Hàng hóa có tải trọng vừa phải, phù hợp đặt tại tầng B hoặc C để thuận tiện bốc dỡ.';
  if (isHeavy) {
    recommendedTiers = 'Tầng A, B (Tầng dưới chịu tải)';
    tierDescription = 'Hàng nặng hoặc tổng tải trọng lớn, cần ưu tiên xếp ở tầng đáy A hoặc tầng B để hạ thấp trọng tâm và đảm bảo an toàn kết cấu kệ.';
  } else if (isLight) {
    recommendedTiers = 'Tầng C, D (Tầng cao)';
    tierDescription = 'Hàng nhẹ, kích thước gọn, phù hợp xếp lên các tầng cao C và D để tối ưu hóa không gian lưu trữ phía trên.';
  }

  return {
    itemLengthCm: iL,
    itemWidthCm: iW,
    itemHeightCm: iH,
    itemWeightKg: iWeight,
    itemVolumeM3,
    totalVolumeM3,
    totalWeightKg,
    binMaxItems,
    binMaxVolumeM3,
    binMaxWeightKg: bMaxWeight,
    limitingFactor,
    requiredBinsCount,
    fullBinsCount,
    remainderQty,
    remainderOccupancyPct,
    isHeavy,
    isLight,
    recommendedTiers,
    tierDescription,
  };
}

// ============================================================================
// Generate all Bin Cells for a Warehouse record - using REAL data
// ============================================================================

export function generateWarehouseBinCells(
  warehouse: WarehouseRecord,
  occupiedMap?: Map<string, { qty: number; weightKg: number; occupancyPct: number }>
): BinCellInfo[] {
  const bins: BinCellInfo[] = [];
  const occMap = occupiedMap || new Map();

  const subWarehouses = warehouse.subWarehouses || [];
  subWarehouses.forEach((zone) => {
    const zoneType = zone.zoneType || 'AMBIENT';
    const racksCount = zone.racksCount || 1;
    const defaultShelves = zone.shelvesPerRack ? Math.max(1, zone.shelvesPerRack - 1) : 4;
    const defaultBinsPerShelf = zone.binsPerShelf || 2;
    const defaultMaxWeight = zone.maxWeightPerBin || 500;
    const defaultCellL = zone.cellLength || 120;
    const defaultCellW = zone.cellWidth || 80;
    const defaultCellH = zone.cellHeight || 100;

    const racksList = zone.racks && zone.racks.length > 0 ? zone.racks : undefined;

    for (let r = 1; r <= racksCount; r++) {
      const rackCode = `R${String(r).padStart(2, '0')}`;
      const rackObj = racksList?.find((rk) => rk.rackCode === rackCode || rk.id === `rack-${r}`);

      const shelvesCount = rackObj?.shelvesCount || defaultShelves;
      const baysCount = rackObj?.baysCount || Math.max(1, (rackObj?.verticalPartitions || defaultBinsPerShelf) - 1);

      // Per-rack dimension overrides
      const rackCellL = (rackObj as any)?.defaultBinLength || defaultCellL;
      const rackCellW = (rackObj as any)?.defaultBinWidth || defaultCellW;
      const rackCellH = (rackObj as any)?.defaultBinHeight || defaultCellH;
      const rackMaxWeight = (rackObj as any)?.defaultBinMaxWeight || defaultMaxWeight;

      for (let s = 1; s <= shelvesCount; s++) {
        const globalShelfIndex = calculateGlobalShelfIndex(subWarehouses, zone.id, rackObj?.id || `rack-${r}`, s);
        const shelfPrefix = getRackLetterPrefix(globalShelfIndex);

        for (let c = 1; c <= baysCount; c++) {
          const binShortCode = `${shelfPrefix}${c}`;
          const fullBinCode = `${zone.code || 'ZONE'}-${rackCode}-${binShortCode}`;

          // Check if custom bin configuration exists
          const customBin = rackObj?.customBins?.[fullBinCode] || rackObj?.customBins?.[binShortCode];

          const cellL = customBin?.length || rackCellL;
          const cellW = customBin?.width || rackCellW;
          const cellH = customBin?.height || rackCellH;
          const maxWeight = customBin?.maxWeight || rackMaxWeight;
          const cellVolumeM3 = (cellL * cellW * cellH) / 1_000_000;

          // REAL occupancy data from occupiedMap
          const normKey = fullBinCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
          const occData = occMap.get(fullBinCode) || occMap.get(binShortCode) || occMap.get(normKey);

          let status: 'EMPTY' | 'PARTIAL' | 'FULL' = 'EMPTY';
          let currentWeightKg = 0;
          let currentOccupancyPct = 0;

          if (occData) {
            currentWeightKg = occData.weightKg || 0;
            currentOccupancyPct = occData.occupancyPct || 0;
            if (currentOccupancyPct >= 95) {
              status = 'FULL';
            } else if (currentOccupancyPct > 0 || occData.qty > 0) {
              status = 'PARTIAL';
            }
          }

          bins.push({
            binCode: `${binShortCode} (${zone.code || 'ZONE'})`,
            zoneId: zone.id,
            zoneCode: zone.code || 'ZONE',
            zoneName: zone.name || 'Phan khu',
            zoneType,
            rackNumber: r,
            shelfLevel: s,
            cellIndex: c,
            cellLengthCm: cellL,
            cellWidthCm: cellW,
            cellHeightCm: cellH,
            cellVolumeM3,
            maxWeightCapacityKg: maxWeight,
            currentWeightKg,
            currentOccupancyPct,
            status,
          });
        }
      }
    }
  });

  return bins;
}

// ============================================================================
// AI Slotting Engine: Enhanced Multi-Criteria Scoring + Physical Constraints
// ============================================================================

/**
 * Calculate AI Slotting recommendations with 6-criteria weighted scoring:
 * 1. Zone Temperature Match (20%)
 * 2. Weight Safety / Ergonomics (25%)
 * 3. ABC Velocity / Turnover Optimization (15%)
 * 4. Volume Fit Efficiency (15%)
 * 5. Proximity / Convenience (15%)
 * 6. Product Grouping / Consolidation (10%)
 */
export function calculateAiSlottingRecommendations(
  product: ProductSlotInput,
  bins: BinCellInfo[],
  existingProductBins?: Map<string, string[]> // SKU/category -> list of binCodes already used
): AiSlottingRecommendation[] {
  const recommendations: AiSlottingRecommendation[] = [];

  const itemL = Math.max(0.1, product.packageLength);
  const itemW = Math.max(0.1, product.packageWidth);
  const itemH = Math.max(0.1, product.packageHeight);
  const itemWeight = Math.max(0.001, product.weightPerUnit);
  const totalQty = Math.max(1, product.totalQty);
  const totalWeight = totalQty * itemWeight;

  // Pre-compute: find max rack number for proximity normalization
  const maxRackNum = Math.max(1, ...bins.map((b) => b.rackNumber));
  const maxShelfLevel = Math.max(1, ...bins.map((b) => b.shelfLevel));

  // Pre-compute: existing product locations for grouping score
  const existingBinCodes = new Set<string>();
  if (existingProductBins) {
    const key = product.sku || product.category || product.productName;
    const existing = existingProductBins.get(key) || [];
    existing.forEach((b) => existingBinCodes.add(b.toUpperCase()));
  }

  // Track remaining qty to allocate
  let remainingQty = totalQty;

  bins.forEach((bin) => {
    // =====================================================================
    // PHASE 1: HARD CONSTRAINTS FILTERING (CSP)
    // =====================================================================

    // 1. Skip FULL bins
    if (bin.status === 'FULL') return;

    // 2. Temperature environment MUST match
    const isTempMatch = product.tempRequirement === bin.zoneType;
    if (!isTempMatch) return;

    // 3. Physical fit check with rotation
    const capacity = computeBinPhysicalCapacity(
      {
        lengthCm: bin.cellLengthCm,
        widthCm: bin.cellWidthCm,
        heightCm: bin.cellHeightCm,
        maxWeightKg: bin.maxWeightCapacityKg,
        currentWeightKg: bin.currentWeightKg,
        currentOccupancyPct: bin.currentOccupancyPct,
      },
      {
        lengthCm: itemL,
        widthCm: itemW,
        heightCm: itemH,
        weightKg: itemWeight,
      }
    );

    // Item doesn't physically fit in any orientation
    if (!capacity.itemFitsInBin || capacity.maxItems <= 0) return;

    // =====================================================================
    // PHASE 2: SOFT CONSTRAINTS & MULTI-CRITERIA SCORING
    // =====================================================================
    const reasons: string[] = [];

    // --- Criterion 1: Zone Temperature Match (20%) ---
    const tempScore = 100; // Already passed hard constraint
    const tempName = bin.zoneType === 'COLD'
      ? 'Kho Lanh (-18C ~ 5C)'
      : bin.zoneType === 'THERMAL'
        ? 'Kho Nhiet / Dieu Hoa (15C ~ 22C)'
        : 'Kho Thuong';
    reasons.push(`Dat yeu cau bao quan (${tempName})`);

    // --- Criterion 2: Weight Safety / Ergonomics (25%) ---
    let weightSafetyScore = 80;
    const isHeavy = itemWeight >= 30 || totalWeight >= 50;
    const isMedium = itemWeight >= 5 && itemWeight < 30;

    if (isHeavy) {
      if (bin.shelfLevel <= 2) {
        weightSafetyScore = 100;
        reasons.push(`Hang nang (${itemWeight.toFixed(1)}kg/dv) xep Tang ${bin.shelfLevel} - An toan ket cau ke`);
      } else if (bin.shelfLevel === 3) {
        weightSafetyScore = 45;
        reasons.push(`Hang nang xep Tang ${bin.shelfLevel} - Khuyen cao tang thap hon`);
      } else {
        weightSafetyScore = 15;
        reasons.push(`Hang nang xep Tang ${bin.shelfLevel} - Nguy hiem, can tang thap`);
      }
    } else if (!isMedium) {
      // Light items (<5kg) -> top shelves preferred
      if (bin.shelfLevel >= maxShelfLevel - 1) {
        weightSafetyScore = 100;
        reasons.push(`Hang nhe (${itemWeight.toFixed(1)}kg/dv) xep Tang ${bin.shelfLevel} - Toi uu dien tich`);
      } else if (bin.shelfLevel <= 1) {
        weightSafetyScore = 55;
      } else {
        weightSafetyScore = 75;
      }
    } else {
      // Medium weight -> middle shelves preferred
      if (bin.shelfLevel >= 2 && bin.shelfLevel <= maxShelfLevel - 1) {
        weightSafetyScore = 100;
        reasons.push(`Hang trung binh (${itemWeight.toFixed(1)}kg/dv) xep Tang ${bin.shelfLevel} - Phu hop`);
      } else {
        weightSafetyScore = 70;
      }
    }

    // --- Criterion 3: ABC Velocity / Turnover (15%) ---
    let turnoverScore = 70;
    if (product.turnoverClass === 'A') {
      const rackProximity = 1 - ((bin.rackNumber - 1) / maxRackNum);
      const shelfAccess = bin.shelfLevel <= 2 ? 1.0 : bin.shelfLevel <= 3 ? 0.7 : 0.4;
      turnoverScore = Math.round(rackProximity * 50 + shelfAccess * 50);
      if (turnoverScore >= 80) {
        reasons.push(`Hang fast-moving (A) - Vi tri de tiep can (Day ${bin.rackNumber}, Tang ${bin.shelfLevel})`);
      }
    } else if (product.turnoverClass === 'C') {
      const rackDepth = (bin.rackNumber - 1) / maxRackNum;
      const shelfHeight = (bin.shelfLevel - 1) / maxShelfLevel;
      turnoverScore = Math.round(rackDepth * 40 + shelfHeight * 40 + 20);
      if (turnoverScore >= 80) {
        reasons.push(`Hang slow-moving (C) - Luu tru sau, tiet kiem mat bang`);
      }
    } else {
      turnoverScore = 75;
    }

    // --- Criterion 4: Volume Fit Efficiency (15%) ---
    const itemVolM3 = (itemL * itemW * itemH) / 1_000_000;
    const binVolM3 = bin.cellVolumeM3 || (bin.cellLengthCm * bin.cellWidthCm * bin.cellHeightCm) / 1_000_000;
    const allocableQty = Math.min(capacity.maxItems, remainingQty);
    const usedVolM3 = allocableQty * itemVolM3;
    const fillRatio = binVolM3 > 0 ? usedVolM3 / binVolM3 : 0;

    let fillScore = 60;
    if (fillRatio >= 0.7) {
      fillScore = 100;
      reasons.push(`Ty le lap day xuat sac (${(fillRatio * 100).toFixed(0)}%)`);
    } else if (fillRatio >= 0.4) {
      fillScore = 85;
      reasons.push(`Ty le lap day tot (${(fillRatio * 100).toFixed(0)}%)`);
    } else if (fillRatio >= 0.15) {
      fillScore = 65;
    } else {
      fillScore = 40;
    }

    // --- Criterion 5: Proximity / Convenience (15%) ---
    const proximityRatio = 1 - ((bin.rackNumber - 1) / maxRackNum);
    const aisleRatio = 1 - ((bin.cellIndex - 1) / Math.max(1, 10));
    const proximityScore = Math.round(proximityRatio * 60 + aisleRatio * 40);
    if (proximityScore >= 85) {
      reasons.push(`Vi tri thuan tien - Gan cua kho & dau loi di`);
    }

    // --- Criterion 6: Product Grouping / Consolidation (10%) ---
    let groupingScore = 50; // Neutral default
    if (existingBinCodes.size > 0) {
      const binRackKey = `R${String(bin.rackNumber).padStart(2, '0')}`;
      const sameRack = Array.from(existingBinCodes).some((b) => b.includes(binRackKey));
      if (sameRack) {
        groupingScore = 100;
        reasons.push(`Cung day ke voi san pham da xep - De quan ly & kiem ke`);
      } else {
        const sameZone = Array.from(existingBinCodes).some((b) => b.includes(bin.zoneCode));
        if (sameZone) {
          groupingScore = 75;
        }
      }
    }

    // =====================================================================
    // PHASE 3: COMPOSITE SCORE CALCULATION
    // =====================================================================
    const finalScore = Math.round(
      tempScore * 0.20 +
      weightSafetyScore * 0.25 +
      turnoverScore * 0.15 +
      fillScore * 0.15 +
      proximityScore * 0.15 +
      groupingScore * 0.10
    );

    // Penalize partial bins slightly (prefer empty bins for cleaner organization)
    const occupancyPenalty = bin.status === 'PARTIAL' ? 3 : 0;

    recommendations.push({
      bin,
      score: Math.max(0, Math.min(100, finalScore - occupancyPenalty)),
      reasons,
      isTopChoice: false,
      allocatedQty: allocableQty,
    });
  });

  // Sort descending by score
  recommendations.sort((a, b) => b.score - a.score);

  // Assign allocatedQty to top bins until totalQty is fulfilled
  let remaining = totalQty;
  recommendations.forEach((rec) => {
    if (remaining <= 0) {
      rec.allocatedQty = 0;
      return;
    }
    const cap = computeBinPhysicalCapacity(
      {
        lengthCm: rec.bin.cellLengthCm,
        widthCm: rec.bin.cellWidthCm,
        heightCm: rec.bin.cellHeightCm,
        maxWeightKg: rec.bin.maxWeightCapacityKg,
        currentWeightKg: rec.bin.currentWeightKg,
        currentOccupancyPct: rec.bin.currentOccupancyPct,
      },
      { lengthCm: itemL, widthCm: itemW, heightCm: itemH, weightKg: itemWeight }
    );
    const take = Math.min(cap.maxItems, remaining);
    rec.allocatedQty = take;
    remaining -= take;
  });

  // Mark top choice
  if (recommendations.length > 0) {
    recommendations[0].isTopChoice = true;
  }

  return recommendations;
}
