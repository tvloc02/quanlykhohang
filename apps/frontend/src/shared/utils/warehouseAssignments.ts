export type CustomBinConfig = {
  binCode: string;
  length: number;  // cm
  width: number;   // cm
  height: number;  // cm
  maxWeight: number; // kg
  occupancyPct?: number;
  notes?: string;
  status?: string;
};

export type RackConfig = {
  id: string;
  rackCode: string; // VD: R01
  name: string;     // VD: Dãy Kệ Dọc Continuous Row A1
  length: number;   // Dài dãy kệ chạy dọc suốt kho (mét)
  width: number;    // Rộng dãy kệ (mét)
  height: number;   // Cao dãy kệ (mét)
  maxRackLoad: number; // Tải trọng tối đa cả dãy kệ (kg)
  baysCount: number;   // Số Khoang Kệ (Bay) nối tiếp dọc theo chiều dài dãy
  horizontalPartitions: number; // Số vách ngăn ngang (Shelves / Levels)
  verticalPartitions: number;   // Số vách ngăn dọc (Bins per shelf level in each Bay)
  columnsCount: number; // Số cột/khoang (Bay/Column)
  shelvesCount: number; // Số tầng hàng ngang (Level/Shelf)
  binsPerShelf: number; // Số ô/ngăn trong mỗi tầng
  defaultBinLength: number; // cm
  defaultBinWidth: number;  // cm
  defaultBinHeight: number; // cm
  defaultBinMaxWeight: number; // kg
  customBins?: Record<string, CustomBinConfig>; // Chi tiết ô tùy chỉnh
};

export function getRackLetterPrefix(index: number): string {
  let prefix = '';
  let n = index;
  while (n >= 0) {
    prefix = String.fromCharCode((n % 26) + 65) + prefix;
    n = Math.floor(n / 26) - 1;
  }
  return prefix;
}

export function calculateGlobalShelfIndex(
  subWarehouses: SubWarehouse[],
  targetZoneId: string,
  targetRackId: string,
  shelfNum: number // 1 for bottom shelf Tầng 1
): number {
  let globalIndex = 0;
  for (const zone of subWarehouses || []) {
    const racks = zone.racks || [];
    if (zone.id === targetZoneId) {
      for (const rack of racks) {
        if (rack.id === targetRackId) {
          globalIndex += Math.max(0, shelfNum - 1);
          return globalIndex;
        }
        const shelves = rack.shelvesCount || zone.shelvesPerRack || 5;
        globalIndex += Math.max(1, shelves);
      }
      break;
    } else {
      for (const rack of racks) {
        const shelves = rack.shelvesCount || zone.shelvesPerRack || 5;
        globalIndex += Math.max(1, shelves);
      }
    }
  }
  return globalIndex;
}

export type SubWarehouse = {
  id: string;
  code: string;
  name: string;
  status?: 'active' | 'inactive'; // Trạng thái phân khu
  zoneType?: 'COLD' | 'AMBIENT' | 'THERMAL'; // Kho lạnh / Kho thường / Kho nhiệt
  tempMin?: number; // °C
  tempMax?: number; // °C
  humidityTarget?: number; // %
  length: number; // mét
  width: number;  // mét
  height: number; // mét
  rackLength?: number; // mét - Dài kệ
  rackWidth?: number;  // mét - Rộng kệ
  rackHeight?: number; // mét - Cao kệ
  racksCount: number; // số kệ
  shelvesPerRack: number; // số tầng mỗi kệ
  binsPerShelf?: number; // số ô/ngăn trên mỗi tầng
  maxWeightPerBin?: number; // Tải trọng tối đa kg / ô
  cellLength?: number; // cm
  cellWidth?: number;  // cm
  cellHeight?: number; // cm
  wallRacksCount?: number; // kệ trên tường
  rackRowsCount?: number; // số hàng kệ
  racks?: RackConfig[]; // Danh sách dãy kệ trong phân khu
  structure?: {
    wallType?: string;    // Tường
    ceilingType?: string; // Trần
    floorType?: string;   // Sàn
    cornerInfo?: string;  // Góc kho
  };
  note?: string;
};

export type WarehouseRecord = {
  id: string;
  code: string;
  name: string;
  address: string;
  province?: string;
  ward?: string;
  detailAddress?: string;
  latitude?: number;
  longitude?: number;
  status: 'active' | 'inactive';
  isFrozen?: boolean;
  managerIds: string[];
  staffIds: string[];

  // Kích thước & Vật liệu kho tổng
  length?: number; // m
  width?: number;  // m
  height?: number; // m
  totalArea?: number; // m2
  totalVolume?: number; // m3
  wallSpec?: string;
  ceilingSpec?: string;
  floorSpec?: string;
  doorSpec?: string;

  // Danh sách kho nhỏ / Phân khu bên trong
  subWarehouses?: SubWarehouse[];
  occupancyRate?: number; // % Tỷ lệ lấp đầy / Đã chứa
};

const STORAGE_KEY = 'smart-wms-warehouses';
const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

export function normalizeWarehouseIds(value: unknown): string[] {
  if (value == null) return [];

  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((id) => String(id).trim()).filter(Boolean)));
  }

  if (typeof value === 'string') {
    return Array.from(
      new Set(
        value
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    );
  }

  return [];
}

export function normalizeWarehouseRecord(
  warehouse: Partial<WarehouseRecord> & Pick<WarehouseRecord, 'id' | 'code' | 'name'>,
): WarehouseRecord {
  const l = Number(warehouse.length) || 50;
  const w = Number(warehouse.width) || 30;
  const h = Number(warehouse.height) || 12;

  let rawSub = warehouse.subWarehouses;
  if (typeof rawSub === 'string') {
    try {
      rawSub = JSON.parse(rawSub);
    } catch {
      rawSub = [];
    }
  }

  const cleanedSubWarehouses = Array.isArray(rawSub) ? rawSub : [];

  return {
    id: String(warehouse.id),
    code: String(warehouse.code ?? '').trim().toUpperCase(),
    name: String(warehouse.name ?? '').trim(),
    address: String(warehouse.address ?? '').trim(),
    province: warehouse.province ? String(warehouse.province) : '',
    ward: warehouse.ward ? String(warehouse.ward) : '',
    detailAddress: warehouse.detailAddress ? String(warehouse.detailAddress) : '',
    latitude: warehouse.latitude ? Number(warehouse.latitude) : undefined,
    longitude: warehouse.longitude ? Number(warehouse.longitude) : undefined,
    status: warehouse.status === 'inactive' ? 'inactive' : 'active',
    isFrozen: Boolean(warehouse.isFrozen),
    managerIds: normalizeWarehouseIds(warehouse.managerIds),
    staffIds: normalizeWarehouseIds(warehouse.staffIds),
    length: l,
    width: w,
    height: h,
    totalArea: Number(warehouse.totalArea) || l * w,
    totalVolume: Number(warehouse.totalVolume) || l * w * h,
    wallSpec: warehouse.wallSpec ? String(warehouse.wallSpec) : 'Tường gạch 220mm, sơn Epoxy',
    ceilingSpec: warehouse.ceilingSpec ? String(warehouse.ceilingSpec) : 'Trần tôn PU cách nhiệt',
    floorSpec: warehouse.floorSpec ? String(warehouse.floorSpec) : 'Sàn bê tông chịu lực phủ Epoxy',
    doorSpec: warehouse.doorSpec ? String(warehouse.doorSpec) : 'Cửa cuộn tự động & cửa dock xuất nhập',
    subWarehouses: cleanedSubWarehouses,
  };
}

export function warehouseListEquals(a: WarehouseRecord, b: WarehouseRecord) {
  const normalizeIds = (ids: string[]) => normalizeWarehouseIds(ids).sort();
  const normalizedA = normalizeWarehouseRecord(a);
  const normalizedB = normalizeWarehouseRecord(b);

  return (
    normalizedA.id === normalizedB.id &&
    normalizedA.code === normalizedB.code &&
    normalizedA.name === normalizedB.name &&
    normalizedA.address === normalizedB.address &&
    normalizedA.status === normalizedB.status &&
    JSON.stringify(normalizeIds(normalizedA.managerIds)) === JSON.stringify(normalizeIds(normalizedB.managerIds)) &&
    JSON.stringify(normalizeIds(normalizedA.staffIds)) === JSON.stringify(normalizeIds(normalizedB.staffIds)) &&
    JSON.stringify(normalizedA.subWarehouses || []) === JSON.stringify(normalizedB.subWarehouses || [])
  );
}

export async function upsertWarehouseToApi(warehouse: WarehouseRecord, forceMethod?: 'POST' | 'PUT'): Promise<WarehouseRecord> {
  const payload = normalizeWarehouseRecord(warehouse);

  if (forceMethod === 'POST') {
    const createResponse = await fetch(`${API_BASE_URL}/warehouses`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });

    if (!createResponse.ok) {
      const data = await createResponse.json().catch(() => null);
      throw new Error(data?.message || 'Không tạo được kho hàng');
    }

    const created = (await createResponse.json()) as WarehouseRecord;
    return normalizeWarehouseRecord(created);
  }

  async function tryUpdate(id: string) {
    return fetch(`${API_BASE_URL}/warehouses/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  }

  let updateResponse = await tryUpdate(payload.id);

  if (updateResponse.status === 404) {
    const listResponse = await fetch(`${API_BASE_URL}/warehouses`, { headers: authHeaders() });
    if (listResponse.ok) {
      const remoteWarehouses = (await listResponse.json()) as WarehouseRecord[];
      const existing = remoteWarehouses.find(
        (item) => String(item.code).trim().toUpperCase() === payload.code,
      );
      if (existing) {
        payload.id = String(existing.id);
        updateResponse = await tryUpdate(payload.id);
      }
    }
  }

  if (updateResponse.ok) {
    const saved = (await updateResponse.json()) as WarehouseRecord;
    return normalizeWarehouseRecord(saved);
  }

  if (updateResponse.status !== 404) {
    const data = await updateResponse.json().catch(() => null);
    throw new Error(data?.message || 'Không lưu được kho hàng');
  }

  const createResponse = await fetch(`${API_BASE_URL}/warehouses`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!createResponse.ok) {
    const data = await createResponse.json().catch(() => null);
    throw new Error(data?.message || 'Không tạo được kho hàng');
  }

  const created = (await createResponse.json()) as WarehouseRecord;
  return normalizeWarehouseRecord(created);
}

export const DEFAULT_SYSTEM_WAREHOUSES: WarehouseRecord[] = [
  normalizeWarehouseRecord({
    id: 'wh_default_1',
    code: 'KH001',
    name: 'Kho Tổng (Hà Nội)',
    address: 'Thanh Trì, Hà Nội',
    status: 'active',
    managerIds: [],
    staffIds: [],
    subWarehouses: [],
  }),
  normalizeWarehouseRecord({
    id: 'wh_default_2',
    code: 'KH002',
    name: 'Kho Chi Nhánh HCM',
    address: 'Quận 1, TP. Hồ Chí Minh',
    status: 'active',
    managerIds: [],
    staffIds: [],
    subWarehouses: [],
  }),
];

export function getStoredWarehouses(): WarehouseRecord[] {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (!rawData) return DEFAULT_SYSTEM_WAREHOUSES;
    const parsedData = JSON.parse(rawData);
    if (Array.isArray(parsedData) && parsedData.length > 0) {
      return parsedData.map((warehouse) => normalizeWarehouseRecord(warehouse));
    }
    return DEFAULT_SYSTEM_WAREHOUSES;
  } catch {
    return DEFAULT_SYSTEM_WAREHOUSES;
  }
}

export function saveStoredWarehouses(warehouses: WarehouseRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(warehouses.map(normalizeWarehouseRecord)));
  window.dispatchEvent(new Event('storage'));
}

function mergeWarehouseRecord(base: WarehouseRecord, fallback?: WarehouseRecord): WarehouseRecord {
  const normalizedBase = normalizeWarehouseRecord(base);
  const normalizedFallback = fallback ? normalizeWarehouseRecord(fallback) : undefined;
  const baseManagers = normalizedBase.managerIds;
  const baseStaff = normalizedBase.staffIds;

  return {
    ...normalizedFallback,
    ...normalizedBase,
    address: normalizedBase.address || normalizedFallback?.address || '',
    status: normalizedBase.status || normalizedFallback?.status || 'active',
    managerIds: baseManagers.length > 0 ? baseManagers : normalizedFallback?.managerIds || [],
    staffIds: baseStaff.length > 0 ? baseStaff : normalizedFallback?.staffIds || [],
    subWarehouses: normalizedBase.subWarehouses || [],
  };
}

export function mergeStoredWarehouses(remoteWarehouses: WarehouseRecord[], fallbackWarehouses = getStoredWarehouses()) {
  const normalizedRemote = remoteWarehouses.map(normalizeWarehouseRecord);
  const normalizedFallback = fallbackWarehouses.map(normalizeWarehouseRecord);
  const fallbackById = new Map(normalizedFallback.map((warehouse) => [warehouse.id, warehouse]));
  const fallbackByCode = new Map(normalizedFallback.map((warehouse) => [warehouse.code, warehouse]));
  const seenKeys = new Set<string>();
  const mergedWarehouses = normalizedRemote.map((warehouse) => {
    const fallback = fallbackById.get(warehouse.id) || fallbackByCode.get(warehouse.code) || undefined;
    const merged = mergeWarehouseRecord(warehouse, fallback);
    seenKeys.add(merged.id);
    seenKeys.add(merged.code);
    return merged;
  });

  normalizedFallback.forEach((warehouse) => {
    if (seenKeys.has(warehouse.id) || seenKeys.has(warehouse.code)) return;
    mergedWarehouses.push(warehouse);
  });

  return mergedWarehouses.map(normalizeWarehouseRecord);
}

export function getStoredProjectTeams(): any[] {
  try {
    const rawData = localStorage.getItem('smart-wms-project-teams');
    if (!rawData) return [];
    const parsedData = JSON.parse(rawData);
    return Array.isArray(parsedData) ? parsedData : [];
  } catch {
    return [];
  }
}

export function getUserWarehouseIds(
  userId: string,
  warehouses = getStoredWarehouses(),
  teams = getStoredProjectTeams(),
) {
  const normalizedUserId = String(userId);
  const matchedWarehouseIds = new Set<string>();

  // 1. Check direct warehouse assignments (managerIds or staffIds)
  warehouses.forEach((warehouse) => {
    const managers = normalizeWarehouseIds(warehouse.managerIds);
    const staff = normalizeWarehouseIds(warehouse.staffIds);
    if (managers.includes(normalizedUserId) || staff.includes(normalizedUserId)) {
      matchedWarehouseIds.add(warehouse.id);
    }
  });

  // 2. Check project team assignments (storekeepers or inventory checkers assigned to team's warehouse)
  if (Array.isArray(teams)) {
    teams.forEach((team) => {
      const sks = normalizeWarehouseIds(team.storekeeperIds);
      const ics = normalizeWarehouseIds(team.inventoryCheckerIds);
      if (sks.includes(normalizedUserId) || ics.includes(normalizedUserId)) {
        if (team.warehouseId) {
          matchedWarehouseIds.add(team.warehouseId);
        }
      }
    });
  }

  return Array.from(matchedWarehouseIds);
}

export function getUserWarehouseNames(
  userId: string,
  warehouses = getStoredWarehouses(),
  teams = getStoredProjectTeams(),
) {
  const warehouseIds = getUserWarehouseIds(userId, warehouses, teams);
  return warehouses
    .filter((w) => warehouseIds.includes(w.id))
    .map((w) => w.name);
}

export interface BinCell {
  binCode: string;
  cellCode: string;
  bayCode: string;
  maxWeight: number;
  freeVol: number;
  isOccupied?: boolean;
  stockQty?: number;
  productId?: string;
  productSku?: string;
  productName?: string;
}

export interface ShelfFloor {
  floorId: string;
  floorName: string;
  floorDesc: string;
  cells: BinCell[];
}

export interface RackStructure {
  rackId: string;
  rackName: string;
  dimensions: string;
  spec: string;
  zoneName: string;
  floors: ShelfFloor[];
}

const normalizeBinKey = (code: string): string => {
  if (!code) return '';
  return code.trim().toUpperCase().replace(/_/g, '-');
};

export function buildWarehouseRackTopology(
  warehouse: WarehouseRecord | null | undefined,
  warehouseCode: string,
  dbOccupiedBinsMap: Map<string, number> = new Map(),
  binProductsMap?: Map<string, { productId: string; sku: string; productName: string; qty: number }>,
  currentOrderAssignedBins: Set<string> = new Set(),
): RackStructure[] {
  const whPrefix = warehouseCode ? warehouseCode.trim().toUpperCase() : 'KHO';
  const whName = warehouse?.name || whPrefix;

  const createFloorCells = (
    zonePrefix: string,
    rackId: string,
    floorId: string,
    cellsCount = 10
  ): BinCell[] => {
    return Array.from({ length: cellsCount }).map((_, idx) => {
      const cellNum = (idx + 1).toString().padStart(2, '0');
      const binCode = `${zonePrefix}-${rackId}-${floorId}-C${cellNum}`;
      const normCode = normalizeBinKey(binCode);

      let isOccupied = false;
      let stockQty = 0;
      let productId = '';
      let productSku = '';
      let productName = '';

      if (!currentOrderAssignedBins.has(binCode) && !currentOrderAssignedBins.has(normCode)) {
        if (dbOccupiedBinsMap.has(normCode) || dbOccupiedBinsMap.has(binCode)) {
          isOccupied = true;
          stockQty = dbOccupiedBinsMap.get(normCode) || dbOccupiedBinsMap.get(binCode) || 0;
          const info = binProductsMap?.get(normCode) || binProductsMap?.get(binCode);
          if (info) {
            productId = info.productId;
            productSku = info.sku;
            productName = info.productName;
          }
        }
      }

      return {
        binCode,
        cellCode: `Ô C${cellNum}`,
        bayCode: `Khoang B${Math.ceil((idx + 1) / 2).toString().padStart(2, '0')}`,
        maxWeight: 500,
        freeVol: 450,
        isOccupied,
        stockQty,
        productId,
        productSku,
        productName,
      };
    });
  };

  // Case A: Warehouse has custom subWarehouses (Phân khu)
  const activeSubs = (warehouse?.subWarehouses || []).filter((s) => s && s.status !== 'inactive');
  if (activeSubs.length > 0) {
    const topology: RackStructure[] = [];

    activeSubs.forEach((sub, zIdx) => {
      const zoneCode = (sub.code || `ZONE-${String.fromCharCode(65 + zIdx)}`).trim().toUpperCase();
      const zoneName = sub.name || `Phân Khu ${zoneCode}`;
      const zoneTypeLabel =
        sub.zoneType === 'COLD' ? 'Kho Lạnh' : sub.zoneType === 'THERMAL' ? 'Kho Điều Hòa' : 'Kho Thường';

      let racksList: Array<{
        rackCode: string;
        name?: string;
        shelvesCount?: number;
        binsPerShelf?: number;
        length?: number;
        width?: number;
      }> = [];

      if (Array.isArray(sub.racks) && sub.racks.length > 0) {
        racksList = sub.racks.map((rk) => ({
          rackCode: rk.rackCode || rk.id || 'R01',
          name: rk.name,
          shelvesCount:
            rk.shelvesCount ||
            ((rk as any).horizontalPartitions ? (rk as any).horizontalPartitions - 1 : sub.shelvesPerRack || 4),
          binsPerShelf: (rk as any).verticalPartitions
            ? (rk as any).verticalPartitions - 1
            : rk.binsPerShelf && rk.binsPerShelf > 2
              ? rk.binsPerShelf - 1
              : sub.binsPerShelf || 10,
          length: rk.length || sub.rackLength || 18,
          width: rk.width || sub.rackWidth || 1.2,
        }));
      } else {
        const racksCount = sub.racksCount && sub.racksCount > 0 ? sub.racksCount : 1;
        for (let r = 1; r <= racksCount; r++) {
          const rCode = `R${String(r).padStart(2, '0')}`;
          racksList.push({
            rackCode: rCode,
            name: `Dãy Kệ ${rCode} (${zoneName})`,
            shelvesCount: sub.shelvesPerRack || 4,
            binsPerShelf: sub.binsPerShelf || 10,
            length: sub.rackLength || 18,
            width: sub.rackWidth || 1.2,
          });
        }
      }

      racksList.forEach((rk) => {
        const rId = rk.rackCode.toUpperCase();
        const numShelves = rk.shelvesCount || 4;
        const numBins = rk.binsPerShelf || 10;

        const floors = Array.from({ length: numShelves }).map((_, flIdx) => {
          const floorNum = numShelves - flIdx;
          const floorId = `S${floorNum.toString().padStart(2, '0')}`;
          return {
            floorId,
            floorName: `Tầng ${floorId}`,
            floorDesc: `Mâm kệ tầng ${floorNum}`,
            cells: createFloorCells(zoneCode, rId, floorId, numBins),
          };
        });

        topology.push({
          rackId: rId,
          rackName: rk.name || `Dãy Kệ ${rId} (${zoneName})`,
          dimensions: `${rk.length || 18}m Dài × ${rk.width || 1.2}m Rộng`,
          spec: `${numShelves} Tầng × ${numBins} Ô`,
          zoneName: `${zoneName} (${zoneTypeLabel})`,
          floors,
        });
      });
    });

    if (topology.length > 0) return topology;
  }

  // Case B: Warehouse has no custom subWarehouses configured
  // Generate 2 standard racks (R01, R02) in 1 default zone (Khu A) for this warehouse
  return [
    {
      rackId: 'R01',
      rackName: `Dãy Kệ R01 (${whPrefix})`,
      dimensions: '18m Dài × 1.2m Rộng',
      spec: '4 Tầng × 10 Ô',
      zoneName: `Khu A - ${whName} (Kho Thường)`,
      floors: [
        { floorId: 'S04', floorName: 'Tầng S04', floorDesc: 'Mâm kệ tầng 4', cells: createFloorCells(`${whPrefix}-ZA`, 'R01', 'S04', 10) },
        { floorId: 'S03', floorName: 'Tầng S03', floorDesc: 'Mâm kệ tầng 3', cells: createFloorCells(`${whPrefix}-ZA`, 'R01', 'S03', 10) },
        { floorId: 'S02', floorName: 'Tầng S02', floorDesc: 'Mâm kệ tầng 2', cells: createFloorCells(`${whPrefix}-ZA`, 'R01', 'S02', 10) },
        { floorId: 'S01', floorName: 'Tầng S01', floorDesc: 'Mâm kệ tầng 1 (Tầng Trệt)', cells: createFloorCells(`${whPrefix}-ZA`, 'R01', 'S01', 10) },
      ],
    },
    {
      rackId: 'R02',
      rackName: `Dãy Kệ R02 (${whPrefix})`,
      dimensions: '18m Dài × 1.2m Rộng',
      spec: '4 Tầng × 10 Ô',
      zoneName: `Khu B - ${whName} (Kho Thường)`,
      floors: [
        { floorId: 'S04', floorName: 'Tầng S04', floorDesc: 'Mâm kệ tầng 4', cells: createFloorCells(`${whPrefix}-ZB`, 'R02', 'S04', 10) },
        { floorId: 'S03', floorName: 'Tầng S03', floorDesc: 'Mâm kệ tầng 3', cells: createFloorCells(`${whPrefix}-ZB`, 'R02', 'S03', 10) },
        { floorId: 'S02', floorName: 'Tầng S02', floorDesc: 'Mâm kệ tầng 2', cells: createFloorCells(`${whPrefix}-ZB`, 'R02', 'S02', 10) },
        { floorId: 'S01', floorName: 'Tầng S01', floorDesc: 'Mâm kệ tầng 1 (Tầng Trệt)', cells: createFloorCells(`${whPrefix}-ZB`, 'R02', 'S01', 10) },
      ],
    },
  ];
}

const DRAFT_LOCKS_STORAGE_KEY = 'smart-wms-active-draft-locks';

export interface DraftSlotLock {
  tabId: string;
  orderNo?: string;
  binCode: string;
  productName?: string;
  occupancyPct?: number;
  isOutbound?: boolean;
  updatedAt: number;
}

export function saveActiveDraftSlotLocks(
  tabId: string,
  orderNo: string,
  locks: { binCode: string; productName?: string; occupancyPct?: number }[],
  isOutbound?: boolean
) {
  try {
    const raw = localStorage.getItem(DRAFT_LOCKS_STORAGE_KEY);
    let allLocks: DraftSlotLock[] = raw ? JSON.parse(raw) : [];
    // Remove previous locks for this tabId
    allLocks = allLocks.filter((l) => l.tabId !== tabId);

    const now = Date.now();
    locks.forEach((lk) => {
      allLocks.push({
        tabId,
        orderNo,
        binCode: lk.binCode,
        productName: lk.productName,
        occupancyPct: lk.occupancyPct || 100,
        isOutbound: isOutbound || Boolean(orderNo && (orderNo.startsWith('PX') || orderNo.startsWith('XK') || orderNo.startsWith('XH') || orderNo.startsWith('XBL') || orderNo.startsWith('XBH'))),
        updatedAt: now,
      });
    });

    localStorage.setItem(DRAFT_LOCKS_STORAGE_KEY, JSON.stringify(allLocks));
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.error('Error saving active draft slot locks:', err);
  }
}

export function releaseActiveDraftSlotLocks(tabId: string) {
  try {
    const raw = localStorage.getItem(DRAFT_LOCKS_STORAGE_KEY);
    if (!raw) return;
    let allLocks: DraftSlotLock[] = JSON.parse(raw);
    allLocks = allLocks.filter((l) => l.tabId !== tabId);
    localStorage.setItem(DRAFT_LOCKS_STORAGE_KEY, JSON.stringify(allLocks));
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.error('Error releasing draft slot locks:', err);
  }
}

export function getActiveDraftSlotLocks(excludeTabId?: string): Record<string, { label: string; occupancyPct: number; isOutbound?: boolean }> {
  try {
    const raw = localStorage.getItem(DRAFT_LOCKS_STORAGE_KEY);
    if (!raw) return {};
    const allLocks: DraftSlotLock[] = JSON.parse(raw);
    const result: Record<string, { label: string; occupancyPct: number; isOutbound?: boolean }> = {};
    const now = Date.now();
    // Exclude locks older than 2 hours to avoid stale locks
    const validLocks = allLocks.filter((l) => now - l.updatedAt < 2 * 60 * 60 * 1000);

    validLocks.forEach((l) => {
      if (!excludeTabId || l.tabId !== excludeTabId) {
        const label = `${l.orderNo ? `Phiếu ${l.orderNo}` : 'Phiếu khác'}${l.productName ? `: ${l.productName}` : ''}`;
        result[l.binCode] = { label, occupancyPct: l.occupancyPct || 100, isOutbound: l.isOutbound };
      }
    });
    return result;
  } catch {
    return {};
  }
}

export function clearAllDraftSlotLocks(warehouseCode?: string) {
  try {
    if (!warehouseCode) {
      localStorage.removeItem(DRAFT_LOCKS_STORAGE_KEY);
    } else {
      const raw = localStorage.getItem(DRAFT_LOCKS_STORAGE_KEY);
      if (!raw) return;
      let allLocks: DraftSlotLock[] = JSON.parse(raw);
      const whUpper = warehouseCode.trim().toUpperCase();
      allLocks = allLocks.filter((l) => !l.binCode.toUpperCase().startsWith(whUpper));
      localStorage.setItem(DRAFT_LOCKS_STORAGE_KEY, JSON.stringify(allLocks));
    }
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.error('Error clearing draft slot locks:', err);
  }
}
