import { SubWarehouse, WarehouseRecord, getRackLetterPrefix, calculateGlobalShelfIndex } from '../../../shared/utils/warehouseAssignments';

export type ProductSlotInput = {
  productName: string;
  tempRequirement: 'COLD' | 'AMBIENT' | 'THERMAL';
  packageLength: number; // cm
  packageWidth: number;  // cm
  packageHeight: number; // cm
  totalWeight: number;    // kg
  turnoverClass: 'A' | 'B' | 'C'; // A = Bán rất nhanh, B = Trung bình, C = Chậm
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
  cellLength: number;
  cellWidth: number;
  cellHeight: number;
  maxWeightCapacity: number; // kg
  currentWeight: number;
  status: 'EMPTY' | 'PARTIAL' | 'FULL';
};

export type AiSlottingRecommendation = {
  bin: BinCellInfo;
  score: number; // 0 - 100%
  reasons: string[];
  isTopChoice: boolean;
};

// Generate all Bin Cells for a Warehouse record
export function generateWarehouseBinCells(warehouse: WarehouseRecord): BinCellInfo[] {
  const bins: BinCellInfo[] = [];

  const subWarehouses = warehouse.subWarehouses || [];
  subWarehouses.forEach((zone) => {
    const zoneType = zone.zoneType || 'AMBIENT';
    const racksCount = zone.racksCount || 4;
    const defaultShelves = zone.shelvesPerRack || 4;
    const defaultBinsPerShelf = zone.binsPerShelf || 4;
    const defaultMaxWeight = zone.maxWeightPerBin || 500;
    const defaultCellL = zone.cellLength || 120;
    const defaultCellW = zone.cellWidth || 80;
    const defaultCellH = zone.cellHeight || 100;

    const racksList = zone.racks && zone.racks.length > 0 ? zone.racks : undefined;

    for (let r = 1; r <= racksCount; r++) {
      const rackCode = `R${String(r).padStart(2, '0')}`;
      const rackObj = racksList?.find((rk) => rk.rackCode === rackCode || rk.id === `rack-${r}`);

      const shelvesCount = rackObj?.shelvesCount || defaultShelves;
      const baysCount = Math.max(1, (rackObj?.verticalPartitions || defaultBinsPerShelf) - 1);

      for (let s = 1; s <= shelvesCount; s++) {
        const globalShelfIndex = calculateGlobalShelfIndex(subWarehouses, zone.id, rackObj?.id || `rack-${r}`, s);
        const shelfPrefix = getRackLetterPrefix(globalShelfIndex);

        for (let c = 1; c <= baysCount; c++) {
          const binShortCode = `${shelfPrefix}${c}`;
          const fullBinCode = `${zone.code || 'ZONE'}-${rackCode}-${binShortCode}`;

          // Check if custom bin configuration exists
          const customBin = rackObj?.customBins?.[fullBinCode] || rackObj?.customBins?.[binShortCode];

          const cellL = customBin?.length || rackObj?.defaultBinLength || defaultCellL;
          const cellW = customBin?.width || rackObj?.defaultBinWidth || defaultCellW;
          const cellH = customBin?.height || rackObj?.defaultBinHeight || defaultCellH;
          const maxWeight = customBin?.maxWeight || rackObj?.defaultBinMaxWeight || defaultMaxWeight;

          // Simulated occupancy status
          const simulatedOccupancy = (r * s * c) % 5 === 0 ? 'FULL' : (r * s * c) % 3 === 0 ? 'PARTIAL' : 'EMPTY';
          const currentW = simulatedOccupancy === 'FULL' ? maxWeight : simulatedOccupancy === 'PARTIAL' ? Math.round(maxWeight * 0.4) : 0;

          bins.push({
            binCode: `${binShortCode} (${zone.code || 'ZONE'})`,
            zoneId: zone.id,
            zoneCode: zone.code || 'ZONE',
            zoneName: zone.name || 'Phân khu',
            zoneType,
            rackNumber: r,
            shelfLevel: s,
            cellIndex: c,
            cellLength: cellL,
            cellWidth: cellW,
            cellHeight: cellH,
            maxWeightCapacity: maxWeight,
            currentWeight: currentW,
            status: simulatedOccupancy,
          });
        }
      }
    }
  });

  return bins;
}

// AI Slotting Engine: CSP + Multi-Criteria Utility Scoring Function
export function calculateAiSlottingRecommendations(
  product: ProductSlotInput,
  bins: BinCellInfo[]
): AiSlottingRecommendation[] {
  const recommendations: AiSlottingRecommendation[] = [];

  bins.forEach((bin) => {
    // 1. HARD CONSTRAINTS FILTERING (CSP)
    if (bin.status === 'FULL') return; // Cell is already full

    // Check Temperature Constraint
    const isTempMatch = product.tempRequirement === bin.zoneType;
    if (!isTempMatch) return; // Must match temperature environment

    // Check Max Weight Limit
    const availableWeight = bin.maxWeightCapacity - bin.currentWeight;
    if (product.totalWeight > availableWeight) return; // Over weight capacity

    // Check Physical Sizing Constraint
    if (
      product.packageLength > bin.cellLength ||
      product.packageWidth > bin.cellWidth ||
      product.packageHeight > bin.cellHeight
    ) {
      return; // Package is physically too large for this cell
    }

    // 2. SOFT CONSTRAINTS & UTILITY SCORING
    const reasons: string[] = [];

    // Temp Match Score (Weight 30%)
    let tempScore = 100;
    const tempName = bin.zoneType === 'COLD' ? 'Kho Lạnh (-18°C ~ 5°C)' : bin.zoneType === 'THERMAL' ? 'Kho Nhiệt / Điều Hòa (15°C ~ 22°C)' : 'Kho Thường';
    reasons.push(`Đạt yêu cầu bảo quản môi trường (${tempName})`);

    // Weight Safety Score (Weight 35%): Heavy items (>50kg) should be on lower shelves (Level 1-2)
    let weightSafetyScore = 100;
    if (product.totalWeight >= 50) {
      if (bin.shelfLevel <= 2) {
        weightSafetyScore = 100;
        reasons.push(`Hàng nặng (${product.totalWeight}kg) được ưu tiên xếp Tầng ${bin.shelfLevel} (Chịu lực an toàn)`);
      } else {
        weightSafetyScore = 40;
        reasons.push(`Cảnh báo: Hàng nặng xếp Tầng ${bin.shelfLevel} cần lưu ý kết cấu kệ`);
      }
    } else {
      if (bin.shelfLevel >= 2) {
        weightSafetyScore = 95;
        reasons.push(`Hàng nhẹ/vừa (${product.totalWeight}kg) xếp Tầng ${bin.shelfLevel} tối ưu diện tích`);
      } else {
        weightSafetyScore = 70;
      }
    }

    // Turnover ABC Score (Weight 20%): Fast-moving items (A) near main aisles (Rack 1-2, Shelf 1-2)
    let turnoverScore = 80;
    if (product.turnoverClass === 'A') {
      if (bin.rackNumber <= 2 && bin.shelfLevel <= 2) {
        turnoverScore = 100;
        reasons.push('Hàng luân chuyển nhanh (Loại A) nằm ngay đầu dãy kệ, tối ưu thời gian lấy hàng');
      } else {
        turnoverScore = 60;
      }
    } else if (product.turnoverClass === 'C') {
      if (bin.shelfLevel >= 3 || bin.rackNumber >= 3) {
        turnoverScore = 100;
        reasons.push('Hàng luân chuyển chậm (Loại C) xếp tầng trên/lùi sâu, tiết kiệm mặt bằng');
      }
    }

    // Volume Fill Score (Weight 15%)
    const binVol = bin.cellLength * bin.cellWidth * bin.cellHeight;
    const pkgVol = product.packageLength * product.packageWidth * product.packageHeight;
    const fillRatio = pkgVol / binVol;
    let fillScore = 100;
    if (fillRatio > 0.8) {
      fillScore = 100;
      reasons.push(`Tỷ lệ lấp đầy thể tích cực tốt (${(fillRatio * 100).toFixed(0)}%)`);
    } else if (fillRatio > 0.4) {
      fillScore = 85;
    } else {
      fillScore = 60;
    }

    // Total Composite Utility Score
    const finalScore = Math.round(
      tempScore * 0.3 + weightSafetyScore * 0.35 + turnoverScore * 0.2 + fillScore * 0.15
    );

    recommendations.push({
      bin,
      score: finalScore,
      reasons,
      isTopChoice: false,
    });
  });

  // Sort descending by score
  recommendations.sort((a, b) => b.score - a.score);

  if (recommendations.length > 0) {
    recommendations[0].isTopChoice = true;
  }

  return recommendations;
}
