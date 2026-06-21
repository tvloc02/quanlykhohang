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

export function getStoredCatalogCategories(): CatalogCategory[] {
  try {
    const rawData = localStorage.getItem(CATALOG_CATEGORY_STORAGE_KEY);
    if (!rawData) return [];
    const parsedData = JSON.parse(rawData);
    return Array.isArray(parsedData) ? parsedData : [];
  } catch {
    return [];
  }
}

export function saveStoredCatalogCategories(categories: CatalogCategory[]) {
  localStorage.setItem(CATALOG_CATEGORY_STORAGE_KEY, JSON.stringify(categories));
  window.dispatchEvent(new Event('storage'));
}

export function getActiveItemGroupCategories(categories = getStoredCatalogCategories()) {
  return categories.filter((category) => category.type === 'item-group' && category.status === 'active');
}
