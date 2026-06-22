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

export function getStoredWarehouses(): WarehouseRecord[] {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (!rawData) return [];
    const parsedData = JSON.parse(rawData);
    return Array.isArray(parsedData) ? parsedData : [];
  } catch {
    return [];
  }
}

export function saveStoredWarehouses(warehouses: WarehouseRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(warehouses));
  window.dispatchEvent(new Event('storage'));
}

function mergeWarehouseRecord(base: WarehouseRecord, fallback?: WarehouseRecord): WarehouseRecord {
  return {
    ...fallback,
    ...base,
    address: base.address || fallback?.address || '',
    status: base.status || fallback?.status || 'active',
    managerIds: base.managerIds?.length ? base.managerIds : fallback?.managerIds || [],
    staffIds: base.staffIds?.length ? base.staffIds : fallback?.staffIds || [],
  };
}

export function mergeStoredWarehouses(remoteWarehouses: WarehouseRecord[], fallbackWarehouses = getStoredWarehouses()) {
  const fallbackById = new Map(fallbackWarehouses.map((warehouse) => [warehouse.id, warehouse]));
  const fallbackByCode = new Map(fallbackWarehouses.map((warehouse) => [warehouse.code.toUpperCase(), warehouse]));
  const seenKeys = new Set<string>();
  const mergedWarehouses = remoteWarehouses.map((warehouse) => {
    const fallback =
      fallbackById.get(warehouse.id) ||
      fallbackByCode.get(warehouse.code.toUpperCase()) ||
      undefined;
    const merged = mergeWarehouseRecord(warehouse, fallback);
    seenKeys.add(merged.id);
    seenKeys.add(merged.code.toUpperCase());
    return merged;
  });

  fallbackWarehouses.forEach((warehouse) => {
    if (seenKeys.has(warehouse.id) || seenKeys.has(warehouse.code.toUpperCase())) return;
    mergedWarehouses.push(warehouse);
  });

  return mergedWarehouses;
}

export function getUserWarehouseIds(userId: string, warehouses = getStoredWarehouses()) {
  return warehouses
    .filter((warehouse) => warehouse.managerIds.includes(userId) || warehouse.staffIds.includes(userId))
    .map((warehouse) => warehouse.id);
}

export function getUserWarehouseNames(userId: string, warehouses = getStoredWarehouses()) {
  return warehouses
    .filter((warehouse) => warehouse.managerIds.includes(userId) || warehouse.staffIds.includes(userId))
    .map((warehouse) => warehouse.name);
}
