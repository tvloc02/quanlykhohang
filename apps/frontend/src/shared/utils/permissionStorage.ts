export const STORAGE_KEY = 'smart-wms-permission-groups';

export type UserRole = { name: string };

export type PersonnelUser = {
  id: string;
  email: string;
  fullName?: string;
  phone?: string;
  roles?: UserRole[];
  groupIds?: string[];
};

export type ActionPermission = {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  print: boolean;
  status: boolean;
  import: boolean;
  export: boolean;
};

export type GeneralPermissions = {
  canViewImportPrice: boolean;        // Được xem giá nhập
  canViewExportPriceInCat: boolean;   // Xem giá xuất trong DM
  canCopyKit: boolean;               // Sao chép bộ
  canViewInvoiceByStaff: boolean;    // Xem Hóa đơn theo Nhân viên
  canManageCustomerByStaff: boolean;  // Quản lý Khách hàng theo Nhân viên
  canEditPriceWholesale: boolean;    // Sửa giá khi Xuất bán buôn
  canEditDateStock: boolean;          // Được sửa ngày phiếu Nhập/Xuất
  canEditDateCash: boolean;           // Được sửa ngày phiếu Thu/Chi
  showInvoiceCount?: boolean;        // Hiển thị Số lượng Hóa đơn trên Thống kê
  showRevenue?: boolean;             // Hiển thị Doanh thu trên Thống kê
  showActualRevenue?: boolean;       // Hiển thị Thực thu trên Thống kê
  showProfitLoss?: boolean;          // Hiển thị Lãi lỗ trên Thống kê
  showRevenueChart?: boolean;        // Hiển thị Biểu đồ doanh thu
  showAuditLog?: boolean;            // Hiển thị Nhật ký
  showEditAppPrice?: boolean;        // Cho phép sửa giá bán trên App
};

export type PermissionGroup = {
  id: string;
  name: string;
  code?: string;
  description: string;
  memberIds: string[];
  generalPermissions?: GeneralPermissions | null;
  menuPermissions?: Record<string, ActionPermission> | null;
  assignedWarehouseIds?: string[];
};

export type MenuPermissionItem = {
  id: string;
  label: string;
  parentId?: string;
  isHeader?: boolean;
};

export const SYSTEM_MENU_TREE: MenuPermissionItem[] = [
  // 1. Quản lý kho
  { id: 'quan-ly-kho', label: 'Quản lý kho', isHeader: true },
  { id: 'warehouses', label: 'Danh sách kho', parentId: 'quan-ly-kho' },
  { id: 'stock-balances', label: 'Tồn kho theo kho', parentId: 'quan-ly-kho' },
  { id: 'batch-expiry-tracking', label: 'Quản lý Hạn sử dụng', parentId: 'quan-ly-kho' },
  { id: 'warehouse-transfers', label: 'Chuyển kho nội bộ', parentId: 'quan-ly-kho' },
  { id: 'locations', label: 'Quản lý Vị trí / Kệ hàng', parentId: 'quan-ly-kho' },
  { id: 'inventory-check', label: 'Kiểm kê kho', parentId: 'quan-ly-kho' },

  // 2. Nhập kho
  { id: 'nhap-kho', label: 'Nhập kho', isHeader: true },
  { id: 'inbound-stock-in-orders', label: 'Nhập hàng nhà cung cấp', parentId: 'nhap-kho' },
  { id: 'inbound-purchase-orders', label: 'Đơn đặt mua hàng (PO)', parentId: 'nhap-kho' },
  { id: 'inbound-return-requests', label: 'Trả hàng nhà cung cấp', parentId: 'nhap-kho' },
  { id: 'inbound-shipments', label: 'Lô hàng nhập khẩu', parentId: 'nhap-kho' },
  { id: 'inbound-reports', label: 'Báo cáo nhập kho', parentId: 'nhap-kho' },

  // 3. Xuất kho
  { id: 'xuat-kho', label: 'Xuất kho', isHeader: true },
  { id: 'outbound-orders', label: 'Xuất bán buôn / Công ty', parentId: 'xuat-kho' },
  { id: 'outbound-retail', label: 'Xuất bán lẻ', parentId: 'xuat-kho' },
  { id: 'outbound-sales-order', label: 'Đơn đặt hàng xuất', parentId: 'xuat-kho' },
  { id: 'outbound-disposal', label: 'Xuất hủy hàng hỏng', parentId: 'xuat-kho' },
  { id: 'outbound-reports', label: 'Báo cáo xuất kho', parentId: 'xuat-kho' },

  // 4. Mua bán POS
  { id: 'pos', label: 'Bán lẻ tại quầy (POS)' },

  // 5. Báo cáo thống kê
  { id: 'bao-cao', label: 'Báo cáo thống kê', isHeader: true },
  { id: 'report-business-summary', label: 'Tổng hợp tình hình kinh doanh', parentId: 'bao-cao' },
  { id: 'report-fund-balance', label: 'Báo cáo số dư quỹ tiền', parentId: 'bao-cao' },
  { id: 'report-sales', label: 'Báo cáo bán hàng', parentId: 'bao-cao' },
  { id: 'report-inventory', label: 'Báo cáo Xuất - Nhập - Tồn', parentId: 'bao-cao' },
  { id: 'report-stock-balance-financial', label: 'Báo cáo giá trị tồn kho', parentId: 'bao-cao' },
  { id: 'report-inventory-status', label: 'Thực trạng hàng hóa', parentId: 'bao-cao' },
  { id: 'report-shelf-inventory', label: 'Báo cáo hàng hóa trên kệ', parentId: 'bao-cao' },
  { id: 'report-financial', label: 'Báo cáo tài chính & Lãi lỗ', parentId: 'bao-cao' },
  { id: 'report-slow-moving', label: 'Báo cáo cảnh báo hàng chậm luân chuyển', parentId: 'bao-cao' },
  { id: 'report-revenue-chart', label: 'Biểu đồ tăng trưởng doanh thu', parentId: 'bao-cao' },

  // 6. Quản lý Đơn giao hàng
  { id: 'giao-hang', label: 'Giao hàng', isHeader: true },
  { id: 'delivery-orders', label: 'Danh sách đơn vận chuyển', parentId: 'giao-hang' },
  { id: 'delivery-connect', label: 'Kết nối hãng vận chuyển', parentId: 'giao-hang' },
  { id: 'delivery-cross-docking', label: 'Điều phối Cross-docking', parentId: 'giao-hang' },

  // 7. Sổ quỹ & Công nợ
  { id: 'tai-chinh', label: 'Sổ quỹ & Tài chính', isHeader: true },
  { id: 'cash-receipts', label: 'Phiếu thu tiền', parentId: 'tai-chinh' },
  { id: 'cash-payments', label: 'Phiếu chi tiền', parentId: 'tai-chinh' },
  { id: 'customer-debts', label: 'Công nợ khách hàng', parentId: 'tai-chinh' },
  { id: 'supplier-debts', label: 'Công nợ nhà cung cấp', parentId: 'tai-chinh' },

  // 8. Danh mục dữ liệu
  { id: 'danh-muc', label: 'Danh mục dữ liệu', isHeader: true },
  { id: 'products', label: 'Hàng hóa / Sản phẩm', parentId: 'danh-muc' },
  { id: 'product-categories', label: 'Ngành hàng / Nhóm hàng', parentId: 'danh-muc' },
  { id: 'customers', label: 'Khách hàng', parentId: 'danh-muc' },
  { id: 'suppliers', label: 'Nhà cung cấp', parentId: 'danh-muc' },
  { id: 'units', label: 'Đơn vị quy đổi', parentId: 'danh-muc' },
  { id: 'currency', label: 'Ngoại tệ', parentId: 'danh-muc' },
  { id: 'bank-accounts', label: 'Tài khoản Ngân hàng|Ví TM', parentId: 'danh-muc' },
  { id: 'receipt-expense-types', label: 'Nội dung thu chi', parentId: 'danh-muc' },
  { id: 'customer-groups', label: 'Nhóm KH/NCC', parentId: 'danh-muc' },
  { id: 'price-lists', label: 'Bảng giá', parentId: 'danh-muc' },

  // 9. Hệ thống
  { id: 'he-thong', label: 'Hệ thống', isHeader: true },
  { id: 'settings', label: 'Cấu hình hệ thống', parentId: 'he-thong' },
  { id: 'personnel', label: 'Nhân viên', parentId: 'he-thong' },
  { id: 'permission-groups', label: 'Nhóm người dùng', parentId: 'he-thong' },
  { id: 'evat-config', label: 'Hóa đơn & VAT', parentId: 'he-thong' },
  { id: 'print-templates', label: 'Mẫu in Chứng từ', parentId: 'he-thong' },
  { id: 'audit-log', label: 'Nhật ký Hoạt động', parentId: 'he-thong' },
  { id: 'logout', label: 'Đăng xuất', parentId: 'he-thong' },
  { id: 'change-password', label: 'Đổi mật khẩu', parentId: 'he-thong' },

  // 10. Shipper
  { id: 'shipper', label: 'Shipper', isHeader: true },
  { id: 'shipper-delivery', label: 'Quản lý Giao hàng', parentId: 'shipper' },

  // 11. VAT Điện tử
  { id: 'vat-dien-tu', label: 'VAT Điện tử', isHeader: true },
  { id: 'vat-management', label: 'Quản lý VAT Điện tử', parentId: 'vat-dien-tu' },
  { id: 'vat-config', label: 'Thiết lập thông tin VAT', parentId: 'vat-dien-tu' },

  // 12. Hướng dẫn sử dụng
  { id: 'huong-dan-su-dung', label: 'Hướng dẫn sử dụng' },
];

export function isActionSupported(menuId: string, actionKey: keyof ActionPermission): boolean {
  if (actionKey === 'view') return true;
  if (actionKey === 'status') return false;

  if (
    menuId === 'pos' ||
    menuId === 'trang-chu' ||
    menuId === 'logout' ||
    menuId === 'change-password' ||
    menuId === 'huong-dan-su-dung' ||
    menuId === 'print-barcode'
  ) {
    return false;
  }

  if (menuId.startsWith('report-') || menuId.startsWith('bao-cao-')) {
    return actionKey === 'print' || actionKey === 'export';
  }

  if (menuId === 'zalo-config' || menuId === 'evat-config') {
    return actionKey === 'edit';
  }

  return true;
}

export function getDefaultGeneralPermissions(): GeneralPermissions {
  return {
    canViewImportPrice: true,
    canViewExportPriceInCat: true,
    canCopyKit: true,
    canViewInvoiceByStaff: false,
    canManageCustomerByStaff: false,
    canEditPriceWholesale: true,
    canEditDateStock: true,
    canEditDateCash: true,
    showInvoiceCount: true,
    showRevenue: true,
    showActualRevenue: true,
    showProfitLoss: true,
    showRevenueChart: true,
    showAuditLog: true,
    showEditAppPrice: true,
  };
}

export function getDefaultMenuPermissions(isFull = false): Record<string, ActionPermission> {
  const map: Record<string, ActionPermission> = {};
  SYSTEM_MENU_TREE.forEach((item) => {
    map[item.id] = {
      view: isFull,
      create: isFull,
      edit: isFull,
      delete: isFull,
      print: isFull,
      status: isFull,
      import: isFull,
      export: isFull,
    };
  });
  return map;
}

export function getFallbackPermissionGroups(): PermissionGroup[] {
  return [];
}

export function readStoredPermissionGroups(): PermissionGroup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveStoredPermissionGroups(groups: PermissionGroup[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  window.dispatchEvent(new Event('storage'));
  setTimeout(() => {
    window.dispatchEvent(new Event('permissions-updated'));
  }, 0);
}
