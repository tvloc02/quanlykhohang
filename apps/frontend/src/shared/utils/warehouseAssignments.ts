export type WarehouseRecord = {
  id: string;
  code: string;
  name: string;
  address: string;
  status: 'active' | 'inactive';
  managerIds: string[];
  staffIds: string[];
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
  return {
    id: String(warehouse.id),
    code: String(warehouse.code ?? '').trim().toUpperCase(),
    name: String(warehouse.name ?? '').trim(),
    address: String(warehouse.address ?? '').trim(),
    status: warehouse.status === 'inactive' ? 'inactive' : 'active',
    managerIds: normalizeWarehouseIds(warehouse.managerIds),
    staffIds: normalizeWarehouseIds(warehouse.staffIds),
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

export async function upsertWarehouseToApi(warehouse: WarehouseRecord): Promise<WarehouseRecord> {
  const payload = normalizeWarehouseRecord(warehouse);

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

export function getStoredWarehouses(): WarehouseRecord[] {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (!rawData) return [];
    const parsedData = JSON.parse(rawData);
    return Array.isArray(parsedData)
      ? parsedData.map((warehouse) => normalizeWarehouseRecord(warehouse))
      : [];
  } catch {
    return [];
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

export function getUserWarehouseIds(userId: string, warehouses = getStoredWarehouses()) {
  const normalizedUserId = String(userId);
  return warehouses
    .filter(
      (warehouse) =>
        warehouse.managerIds.includes(normalizedUserId) || warehouse.staffIds.includes(normalizedUserId),
    )
    .map((warehouse) => warehouse.id);
}

export function getUserWarehouseNames(userId: string, warehouses = getStoredWarehouses()) {
  const normalizedUserId = String(userId);
  return warehouses
    .filter(
      (warehouse) =>
        warehouse.managerIds.includes(normalizedUserId) || warehouse.staffIds.includes(normalizedUserId),
    )
    .map((warehouse) => warehouse.name);
}
