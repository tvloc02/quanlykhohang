export type CatalogCategoryType = 'item-group' | 'unit' | 'management-attribute' | 'storage-position';

export type CatalogCategoryStatus = 'active' | 'inactive';

export type CatalogCategory = {
  id: string;
  type: CatalogCategoryType;
  code: string;
  name: string;
  description: string;
  status: CatalogCategoryStatus;
  createdAt: string;
};

export const CATALOG_CATEGORY_STORAGE_KEY = 'smart-wms-catalog-categories';

export const CATALOG_CATEGORY_TYPES: Array<{
  value: CatalogCategoryType;
  label: string;
  description: string;
}> = [
  {
    value: 'item-group',
    label: 'Nhóm hàng vật tư hàng hóa',
    description: 'Dùng để phân loại báo cáo và làm danh mục chọn khi tạo sản phẩm.',
  },
  {
    value: 'unit',
    label: 'Đơn vị tính',
    description: 'Đơn vị quản lý chính như cái, thùng, kg; có thể mở rộng quy đổi sau.',
  },
  {
    value: 'management-attribute',
    label: 'Thuộc tính quản lý',
    description: 'Phân loại tính chất như hàng hóa, nguyên vật liệu, thành phẩm, công cụ dụng cụ.',
  },
  {
    value: 'storage-position',
    label: 'Vị trí lưu trữ',
    description: 'Danh mục ô/kệ/vị trí picking dùng khi cấu hình sản phẩm và kho.',
  },
];

export function getCatalogCategoryTypeLabel(type: CatalogCategoryType) {
  return CATALOG_CATEGORY_TYPES.find((item) => item.value === type)?.label || type;
}

export const DEFAULT_CATALOG_CATEGORIES: CatalogCategory[] = [
  {
    id: 'cat_default_1',
    type: 'item-group',
    code: 'NH001',
    name: 'Quần tây',
    description: 'Nhóm sản phẩm thời trang Quần tây',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cat_default_2',
    type: 'item-group',
    code: 'NH002',
    name: 'Đồ ngủ đông',
    description: 'Nhóm sản phẩm Đồ ngủ đông',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cat_default_3',
    type: 'item-group',
    code: 'NH003',
    name: 'Áo khoác gió',
    description: 'Nhóm sản phẩm Áo khoác gió',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cat_default_4',
    type: 'item-group',
    code: 'NH004',
    name: 'Hàng hóa chung',
    description: 'Nhóm sản phẩm hàng hóa chung',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cat_default_5',
    type: 'item-group',
    code: 'NH005',
    name: 'Điện tử & Công nghệ',
    description: 'Nhóm thiết bị điện tử, điện thoại, máy tính, phụ kiện công nghệ',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cat_default_6',
    type: 'item-group',
    code: 'NH006',
    name: 'Gia dụng & Thiết bị',
    description: 'Nhóm đồ gia dụng, máy móc thiết bị gia đình',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cat_default_7',
    type: 'item-group',
    code: 'NH007',
    name: 'Linh kiện & Phụ kiện',
    description: 'Nhóm linh kiện thay thế, phụ kiện vật tư',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cat_default_8',
    type: 'item-group',
    code: 'NH008',
    name: 'Thực phẩm & Đồ uống',
    description: 'Nhóm thực phẩm, đồ uống đóng gói',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cat_default_9',
    type: 'unit',
    code: 'DVT01',
    name: 'Cái',
    description: 'Đơn vị tính Cái',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
];

export function getStoredCatalogCategories(): CatalogCategory[] {
  try {
    const rawData = localStorage.getItem(CATALOG_CATEGORY_STORAGE_KEY);
    if (rawData) {
      const parsedData = JSON.parse(rawData);
      if (Array.isArray(parsedData) && parsedData.length > 0) {
        // Merge missing default categories into parsedData
        let updated = false;
        const existingNames = new Set(parsedData.map((c: any) => (c.name || '').trim().toLowerCase()));
        DEFAULT_CATALOG_CATEGORIES.forEach((defCat) => {
          if (!existingNames.has(defCat.name.trim().toLowerCase())) {
            parsedData.push(defCat);
            updated = true;
          }
        });
        if (updated) {
          saveStoredCatalogCategories(parsedData);
        }
        return parsedData;
      }
    }
  } catch {}

  saveStoredCatalogCategories(DEFAULT_CATALOG_CATEGORIES);
  return DEFAULT_CATALOG_CATEGORIES;
}

export function saveStoredCatalogCategories(categories: CatalogCategory[]) {
  localStorage.setItem(CATALOG_CATEGORY_STORAGE_KEY, JSON.stringify(categories));
  window.dispatchEvent(new Event('storage'));
}

export function getActiveItemGroupCategories(categories = getStoredCatalogCategories()) {
  const active = categories.filter((category) => category.type === 'item-group' && category.status === 'active');
  if (active.length > 0) return active;
  return DEFAULT_CATALOG_CATEGORIES.filter((category) => category.type === 'item-group');
}
