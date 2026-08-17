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

const DEFAULT_SHIPPERS: Shipper[] = [
  {
    id: 'SHIPPER-001',
    name: 'Tạ Văn Thanh',
    phone: '0987654321',
    vehiclePlate: '30L-636.86',
    company: 'Đội xe nội bộ Hà Nội',
    status: 'ACTIVE',
    note: 'Tài xế xe tải 2.5 tấn',
    createdDate: new Date().toISOString(),
  },
  {
    id: 'SHIPPER-002',
    name: 'Nguyễn Văn Hùng',
    phone: '0912345678',
    vehiclePlate: '29C-123.45',
    company: 'Giao Hàng Nhanh (GHN)',
    status: 'ACTIVE',
    note: 'Tài xế giao kho chi nhánh HCM',
    createdDate: new Date().toISOString(),
  },
  {
    id: 'SHIPPER-003',
    name: 'Trần Đình Trọng',
    phone: '0905112233',
    vehiclePlate: '51D-987.65',
    company: 'Viettel Post Logistics',
    status: 'ACTIVE',
    note: 'Đối tác xe đông lạnh',
    createdDate: new Date().toISOString(),
  },
  {
    id: 'SHIPPER-004',
    name: 'Phạm Minh Hoàng',
    phone: '0933445566',
    vehiclePlate: '59F-543.21',
    company: 'Giao Hàng Tiết Kiệm (GHTK)',
    status: 'ACTIVE',
    note: 'Tài xế xe bán tải',
    createdDate: new Date().toISOString(),
  },
];

export function getStoredShippers(): Shipper[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SHIPPERS));
      return DEFAULT_SHIPPERS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SHIPPERS;
  } catch (error) {
    console.error('Error reading shippers from localStorage:', error);
    return DEFAULT_SHIPPERS;
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
