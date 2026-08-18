export interface Shipper {
  id: string;
  name: string;
  phone: string;
  vehiclePlate: string;
  company?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  note?: string;
  createdDate?: string;
}

const STORAGE_KEY = 'wms_shippers';
const MOCK_IDS = ['SHIPPER-001', 'SHIPPER-002', 'SHIPPER-003', 'SHIPPER-004'];

export function getStoredShippers(): Shipper[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    
    // Purge any legacy mock shippers if present in localStorage
    const cleanList = parsed.filter((s: Shipper) => !MOCK_IDS.includes(s.id));
    if (cleanList.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanList));
    }
    return cleanList;
  } catch (error) {
    console.error('Error reading shippers from localStorage:', error);
    return [];
  }
}

export function saveShipper(shipperData: Omit<Shipper, 'id'> & { id?: string }): Shipper {
  const currentList = getStoredShippers();

  let updatedShipper: Shipper;

  if (shipperData.id) {
    // Edit existing
    updatedShipper = {
      ...shipperData,
      id: shipperData.id,
      status: shipperData.status || 'ACTIVE',
    } as Shipper;

    const index = currentList.findIndex((s) => s.id === shipperData.id);
    if (index >= 0) {
      currentList[index] = updatedShipper;
    } else {
      currentList.unshift(updatedShipper);
    }
  } else {
    // Create new
    const newId = `SHIPPER-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
    updatedShipper = {
      ...shipperData,
      id: newId,
      status: 'ACTIVE',
      createdDate: new Date().toISOString(),
    };
    currentList.unshift(updatedShipper);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(currentList));
  window.dispatchEvent(new CustomEvent('shippers-updated', { detail: updatedShipper }));
  return updatedShipper;
}

export function deleteShipper(id: string): void {
  const currentList = getStoredShippers();
  const updatedList = currentList.filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
  window.dispatchEvent(new CustomEvent('shippers-updated'));
}
