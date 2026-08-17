export type CustomBinConfig = {
  binCode: string;
  length: number;  // cm
  width: number;   // cm
  height: number;  // cm
  maxWeight: number; // kg
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
  racksCount: number; // số kệ
  shelvesPerRack: number; // số tầng mỗi kệ
  binsPerShelf?: number; // số ô/ngăn trên mỗi tầng
  maxWeightPerBin?: number; // Tải trọng tối đa kg / ô
  cellLength?: number; // cm
  cellWidth?: number;  // cm
  cellHeight?: number; // cm
  wallRacksCount?: number; // kệ trên tường
  rackRowsCount?: number; // số hàng kệ
  racks?: RackConfig[]; // Cấu hình chi tiết từng Dãy Kệ
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
    subWarehouses: Array.isArray(warehouse.subWarehouses) ? warehouse.subWarehouses : [],
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
    JSON.stringify(normalizeIds(normalizedA.staffIds)) === JSON.stringify(normalizeIds(normalizedB.staffIds))
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
  }),
  normalizeWarehouseRecord({
    id: 'wh_default_2',
    code: 'KH002',
    name: 'Kho Chi Nhánh HCM',
    address: 'Quận 1, TP. Hồ Chí Minh',
    status: 'active',
    managerIds: [],
    staffIds: [],
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
    subWarehouses: (normalizedBase.subWarehouses && normalizedBase.subWarehouses.length > 0)
      ? normalizedBase.subWarehouses
      : normalizedFallback?.subWarehouses || [],
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
