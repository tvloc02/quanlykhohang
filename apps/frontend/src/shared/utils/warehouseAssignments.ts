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
