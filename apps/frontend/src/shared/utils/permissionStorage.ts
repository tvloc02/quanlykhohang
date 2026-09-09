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

// Ánh xạ các mã menu cũ sang mã chuẩn hiện hành trong ứng dụng
export const CANONICAL_MENU_ALIASES: Record<string, string> = {
  pos: 'dashboard',
  'trang-chu': 'dashboard',
  products: 'products-main',
  'product-categories': 'categories',
  'inventory-check': 'inventory-stocktake',
  'outbound-sales-order': 'outbound-sales-orders',
  'cash-receipts': 'finance-receipts',
  'cash-payments': 'finance-payment-vouchers',
  'customer-debts': 'report-customer-debt',
  'supplier-debts': 'report-supplier-debt',
  'vat-management': 'evat-config',
  'vat-config': 'evat-config',
  'warehouse-transfers': 'delivery-transfer-orders',
  areas: 'categories',
  'customer-groups': 'customers',
  'inbound-purchase-orders': 'inbound-stock-in-orders',
  'documents-quotes': 'outbound-orders',
  'inbound-assembly': 'inbound-stock-in-orders',
  'inventory-initial-stock': 'inbound-stock-in-orders',
  'sys-info': 'settings',
  'data-maintenance': 'settings',
};

export function resolveCanonicalMenuId(id: string): string {
  if (!id) return id;
  return CANONICAL_MENU_ALIASES[id] || id;
}

// Cây menu hệ thống chuẩn hóa 100% khớp với Sidebar và các chức năng thực tế hiện hữu
export const SYSTEM_MENU_TREE: MenuPermissionItem[] = [
  // 1. Trang chủ
  { id: 'trang-chu', label: 'Trang chủ', isHeader: true },
  { id: 'dashboard', label: 'Bảng điều khiển / Trang chủ', parentId: 'trang-chu' },

  // 2. Nhập - Xuất
  { id: 'nhap-xuat', label: 'Nhập - Xuất', isHeader: true },
  { id: 'outbound-orders', label: 'Xuất bán', parentId: 'nhap-xuat' },
  { id: 'outbound-retail', label: 'Xuất bán lẻ', parentId: 'nhap-xuat' },
  { id: 'inbound-stock-in-orders', label: 'Nhập hàng', parentId: 'nhap-xuat' },
  { id: 'inbound-return-requests', label: 'Xuất trả Nhà cung cấp', parentId: 'nhap-xuat' },
  { id: 'inbound-return-customers', label: 'Nhập hàng Khách trả lại', parentId: 'nhap-xuat' },
  { id: 'delivery-transfer-orders', label: 'Xuất kho nội bộ', parentId: 'nhap-xuat' },
  { id: 'delivery-transfer-requests', label: 'Nhập kho nội bộ', parentId: 'nhap-xuat' },
  { id: 'inventory-stocktake', label: 'Kiểm kho', parentId: 'nhap-xuat' },
  { id: 'outbound-sales-orders', label: 'Đơn đặt hàng', parentId: 'nhap-xuat' },
  { id: 'outbound-disposal', label: 'Xuất hủy', parentId: 'nhap-xuat' },

  // 3. Thu chi
  { id: 'thu-chi', label: 'Thu chi', isHeader: true },
  { id: 'finance-receipts', label: 'Viết phiếu thu', parentId: 'thu-chi' },
  { id: 'finance-receipt-from-bill', label: 'Thu tiền từ Phiếu xuất', parentId: 'thu-chi' },
  { id: 'finance-payment-vouchers', label: 'Viết phiếu chi', parentId: 'thu-chi' },

  // 4. Báo cáo Tổng hợp
  { id: 'bao-cao-tong-hop', label: 'Báo cáo Tổng hợp', isHeader: true },
  { id: 'report-sales', label: 'Báo cáo Bán hàng', parentId: 'bao-cao-tong-hop' },
  { id: 'report-revenue', label: 'Báo cáo Doanh thu', parentId: 'bao-cao-tong-hop' },
  { id: 'report-cashflow', label: 'Báo cáo Thu chi', parentId: 'bao-cao-tong-hop' },
  { id: 'report-inventory', label: 'Hàng tồn', parentId: 'bao-cao-tong-hop' },
  { id: 'report-inventory-base-unit', label: 'Hàng tồn Theo đơn vị gốc', parentId: 'bao-cao-tong-hop' },
  { id: 'report-inventory-summary', label: 'Hàng tồn Tổng hợp', parentId: 'bao-cao-tong-hop' },
  { id: 'report-customer-debt', label: 'Công nợ Khách hàng', parentId: 'bao-cao-tong-hop' },
  { id: 'report-supplier-debt', label: 'Công nợ Nhà cung cấp', parentId: 'bao-cao-tong-hop' },
  { id: 'report-fund-balance', label: 'Tồn quỹ', parentId: 'bao-cao-tong-hop' },
  { id: 'report-cashbook', label: 'Sao kê - Sổ quỹ', parentId: 'bao-cao-tong-hop' },
  { id: 'report-stock-card', label: 'Thẻ kho', parentId: 'bao-cao-tong-hop' },
  { id: 'report-sales-detail', label: 'Chi tiết hàng bán ra', parentId: 'bao-cao-tong-hop' },
  { id: 'report-sales-by-staff', label: 'Hàng bán ra theo Nhân viên', parentId: 'bao-cao-tong-hop' },
  { id: 'report-business-summary', label: 'Tổng hợp Kinh doanh', parentId: 'bao-cao-tong-hop' },
  { id: 'report-below-min-stock', label: 'Hàng tồn dưới định mức', parentId: 'bao-cao-tong-hop' },
  { id: 'report-stale-inventory', label: 'Báo cáo hàng hóa tồn đọng', parentId: 'bao-cao-tong-hop' },

  // 5. Báo cáo Phân tích
  { id: 'bao-cao-phan-tich', label: 'Báo cáo Phân tích', isHeader: true },
  { id: 'report-bill-profit', label: 'Lợi nhuận theo Hóa đơn', parentId: 'bao-cao-phan-tich' },
  { id: 'report-category-profit', label: 'Lợi nhuận theo Nhóm hàng', parentId: 'bao-cao-phan-tich' },
  { id: 'report-customer-profit', label: 'Lợi nhuận theo Khách hàng', parentId: 'bao-cao-phan-tich' },

  // 6. Danh mục
  { id: 'danh-muc', label: 'Danh mục', isHeader: true },
  { id: 'products-main', label: 'Hàng hóa', parentId: 'danh-muc' },
  { id: 'categories', label: 'Nhóm hàng', parentId: 'danh-muc' },
  { id: 'customers', label: 'Khách hàng', parentId: 'danh-muc' },
  { id: 'suppliers', label: 'Nhà cung cấp', parentId: 'danh-muc' },
  { id: 'warehouses', label: 'Kho hàng', parentId: 'danh-muc' },
  { id: 'units', label: 'Đơn vị quy đổi', parentId: 'danh-muc' },
  { id: 'currency', label: 'Ngoại tệ', parentId: 'danh-muc' },
  { id: 'bank-accounts', label: 'Tài khoản Ngân hàng|Ví TM', parentId: 'danh-muc' },

  // 7. Hệ thống
  { id: 'he-thong', label: 'Hệ thống', isHeader: true },
  { id: 'settings', label: 'Cấu hình hệ thống', parentId: 'he-thong' },
  { id: 'personnel', label: 'Nhân viên', parentId: 'he-thong' },
  { id: 'permission-groups', label: 'Nhóm người dùng', parentId: 'he-thong' },
  { id: 'evat-config', label: 'Hóa đơn & VAT', parentId: 'he-thong' },
  { id: 'print-templates', label: 'Mẫu in Chứng từ', parentId: 'he-thong' },
  { id: 'audit-log', label: 'Nhật ký Hoạt động', parentId: 'he-thong' },
];

export function isActionSupported(menuId: string, actionKey: keyof ActionPermission): boolean {
  const canonicalId = resolveCanonicalMenuId(menuId);
  if (actionKey === 'view') return true;

  // Trang chủ: chỉ hỗ trợ quyền Xem
  if (canonicalId === 'dashboard' || canonicalId === 'pos' || canonicalId === 'trang-chu') {
    return false;
  }

  // Báo cáo thống kê & Phân tích: hỗ trợ Xem, In ấn và Xuất file
  if (canonicalId.startsWith('report-') || canonicalId.startsWith('bao-cao-')) {
    return actionKey === 'print' || actionKey === 'export';
  }

  // Cấu hình hệ thống & VAT: hỗ trợ Xem và Sửa
  if (canonicalId === 'settings' || canonicalId === 'evat-config') {
    return actionKey === 'edit';
  }

  // Nhật ký hoạt động: hỗ trợ Xem và Xuất file
  if (canonicalId === 'audit-log') {
    return actionKey === 'export';
  }

  // Mẫu in chứng từ: Xem, Thêm, Sửa, Xóa, In
  if (canonicalId === 'print-templates') {
    return (
      actionKey === 'create' ||
      actionKey === 'edit' ||
      actionKey === 'delete' ||
      actionKey === 'print'
    );
  }

  // Danh mục dữ liệu (Hàng hóa, Khách hàng, NCC, Kho hàng, Đơn vị, Ngoại tệ, Tài khoản ngân hàng, Nhân viên, Nhóm quyền)
  const masterDataIds = [
    'products-main',
    'categories',
    'customers',
    'suppliers',
    'warehouses',
    'units',
    'currency',
    'bank-accounts',
    'personnel',
    'permission-groups',
  ];
  if (masterDataIds.includes(canonicalId)) {
    if (actionKey === 'status') return false;
    if (canonicalId === 'permission-groups' || canonicalId === 'personnel') {
      return (
        actionKey === 'create' ||
        actionKey === 'edit' ||
        actionKey === 'delete' ||
        actionKey === 'export'
      );
    }
    // Master data: Xem, Thêm, Sửa, Xóa, Nhập file, Xuất file, In
    return (
      actionKey === 'create' ||
      actionKey === 'edit' ||
      actionKey === 'delete' ||
      actionKey === 'import' ||
      actionKey === 'export' ||
      actionKey === 'print'
    );
  }

  // Các nghiệp vụ Nhập - Xuất - Chuyển kho - Kiểm kê - Thu chi
  // Hỗ trợ: Xem, Thêm, Sửa, Xóa, In, Duyệt / Đổi trạng thái (status), Xuất file, Nhập file (cho Nhập hàng)
  if (actionKey === 'import') {
    return canonicalId === 'inbound-stock-in-orders';
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
    if (item.isHeader) return;
    map[item.id] = {
      view: isFull,
      create: isFull && isActionSupported(item.id, 'create'),
      edit: isFull && isActionSupported(item.id, 'edit'),
      delete: isFull && isActionSupported(item.id, 'delete'),
      print: isFull && isActionSupported(item.id, 'print'),
      status: isFull && isActionSupported(item.id, 'status'),
      import: isFull && isActionSupported(item.id, 'import'),
      export: isFull && isActionSupported(item.id, 'export'),
    };
  });

  // Đảm bảo đồng bộ cả các alias cũ
  Object.entries(CANONICAL_MENU_ALIASES).forEach(([alias, canon]) => {
    if (map[canon]) {
      map[alias] = { ...map[canon] };
    }
  });

  return map;
}

// Chuẩn hóa và di chuyển dữ liệu quyền của một nhóm (chuyển các alias cũ sang canonical keys)
export function sanitizeGroupPermissions(group: PermissionGroup): PermissionGroup {
  if (!group) return group;

  const sanitizedMenu: Record<string, ActionPermission> = { ...(group.menuPermissions || {}) };

  // Đồng bộ hai chiều giữa Canonical ID và các alias
  Object.entries(CANONICAL_MENU_ALIASES).forEach(([alias, canon]) => {
    if (sanitizedMenu[alias] && !sanitizedMenu[canon]) {
      sanitizedMenu[canon] = { ...sanitizedMenu[alias] };
    } else if (sanitizedMenu[canon] && !sanitizedMenu[alias]) {
      sanitizedMenu[alias] = { ...sanitizedMenu[canon] };
    }
  });

  // Đảm bảo các menu trong SYSTEM_MENU_TREE có giá trị
  SYSTEM_MENU_TREE.forEach((item) => {
    if (item.isHeader) return;
    if (!sanitizedMenu[item.id]) {
      sanitizedMenu[item.id] = {
        view: false,
        create: false,
        edit: false,
        delete: false,
        print: false,
        status: false,
        import: false,
        export: false,
      };
    }
  });

  return {
    ...group,
    menuPermissions: sanitizedMenu,
    generalPermissions: group.generalPermissions || getDefaultGeneralPermissions(),
  };
}

export function getFallbackPermissionGroups(): PermissionGroup[] {
  return [
    {
      id: 'group-admin',
      name: 'Quản trị hệ thống (Toàn quyền)',
      code: 'ADMIN',
      description: 'Quyền cao nhất, toàn quyền truy cập tất cả các phân hệ và cấu hình hệ thống.',
      memberIds: [],
      generalPermissions: getDefaultGeneralPermissions(),
      menuPermissions: getDefaultMenuPermissions(true),
    },
    {
      id: 'group-warehouse-manager',
      name: 'Quản lý kho',
      code: 'QL_KHO',
      description: 'Quản lý toàn bộ hoạt động xuất nhập kho, chuyển kho, kiểm kê, định mức và xem báo cáo.',
      memberIds: [],
      generalPermissions: {
        ...getDefaultGeneralPermissions(),
        canViewImportPrice: true,
        canViewExportPriceInCat: true,
      },
      menuPermissions: (() => {
        const p = getDefaultMenuPermissions(true);
        // Không cho phép sửa cấu hình hệ thống sâu và phân quyền
        if (p['settings']) { p['settings'].edit = false; }
        if (p['permission-groups']) { p['permission-groups'].create = false; p['permission-groups'].edit = false; p['permission-groups'].delete = false; }
        return p;
      })(),
    },
    {
      id: 'group-storekeeper',
      name: 'Thủ kho / Nhân viên kho',
      code: 'THU_KHO',
      description: 'Thực hiện tạo và theo dõi phiếu Nhập, Xuất, Kiểm kê, Chuyển kho; không xem báo cáo tài chính hay xóa nhóm quyền.',
      memberIds: [],
      generalPermissions: {
        ...getDefaultGeneralPermissions(),
        canViewImportPrice: false,
        showProfitLoss: false,
        showRevenue: false,
        showActualRevenue: false,
      },
      menuPermissions: (() => {
        const p = getDefaultMenuPermissions(false);
        // Cho phép Trang chủ
        if (p['dashboard']) p['dashboard'].view = true;
        // Phân hệ Nhập - Xuất
        [
          'outbound-orders',
          'outbound-retail',
          'inbound-stock-in-orders',
          'inbound-return-requests',
          'inbound-return-customers',
          'delivery-transfer-orders',
          'delivery-transfer-requests',
          'inventory-stocktake',
          'outbound-sales-orders',
          'outbound-disposal',
        ].forEach((id) => {
          if (p[id]) {
            p[id].view = true;
            p[id].create = true;
            p[id].edit = true;
            p[id].print = true;
            p[id].status = true;
          }
        });
        // Xem danh mục
        ['products-main', 'categories', 'warehouses', 'units'].forEach((id) => {
          if (p[id]) {
            p[id].view = true;
          }
        });
        // Báo cáo kho
        ['report-inventory', 'report-inventory-base-unit', 'report-inventory-summary', 'report-stock-card', 'report-stale-inventory', 'report-below-min-stock'].forEach((id) => {
          if (p[id]) {
            p[id].view = true;
            p[id].print = true;
            p[id].export = true;
          }
        });
        return p;
      })(),
    },
    {
      id: 'group-accountant',
      name: 'Kế toán / Thủ quỹ',
      code: 'KE_TOAN',
      description: 'Quản lý thu chi, công nợ khách hàng & nhà cung cấp, sao kê sổ quỹ, xem đầy đủ báo cáo tài chính.',
      memberIds: [],
      generalPermissions: getDefaultGeneralPermissions(),
      menuPermissions: (() => {
        const p = getDefaultMenuPermissions(false);
        if (p['dashboard']) p['dashboard'].view = true;
        // Thu chi
        ['finance-receipts', 'finance-receipt-from-bill', 'finance-payment-vouchers'].forEach((id) => {
          if (p[id]) {
            p[id].view = true;
            p[id].create = true;
            p[id].edit = true;
            p[id].print = true;
            p[id].status = true;
            p[id].export = true;
          }
        });
        // Báo cáo
        SYSTEM_MENU_TREE.filter((item) => item.parentId === 'bao-cao-tong-hop' || item.parentId === 'bao-cao-phan-tich').forEach((item) => {
          if (p[item.id]) {
            p[item.id].view = true;
            p[item.id].print = true;
            p[item.id].export = true;
          }
        });
        // Xem khách hàng, NCC, ngân hàng, hoá đơn VAT
        ['customers', 'suppliers', 'bank-accounts', 'evat-config', 'currency'].forEach((id) => {
          if (p[id]) {
            p[id].view = true;
            p[id].create = true;
            p[id].edit = true;
          }
        });
        return p;
      })(),
    },
    {
      id: 'group-sales',
      name: 'Nhân viên bán hàng',
      code: 'BAN_HANG',
      description: 'Tạo đơn đặt hàng, xuất bán lẻ, quản lý khách hàng, xem báo cáo bán hàng cá nhân.',
      memberIds: [],
      generalPermissions: {
        ...getDefaultGeneralPermissions(),
        canViewImportPrice: false,
        showProfitLoss: false,
      },
      menuPermissions: (() => {
        const p = getDefaultMenuPermissions(false);
        if (p['dashboard']) p['dashboard'].view = true;
        ['outbound-orders', 'outbound-retail', 'outbound-sales-orders'].forEach((id) => {
          if (p[id]) {
            p[id].view = true;
            p[id].create = true;
            p[id].edit = true;
            p[id].print = true;
          }
        });
        ['products-main', 'categories', 'customers'].forEach((id) => {
          if (p[id]) {
            p[id].view = true;
            p[id].create = id === 'customers';
          }
        });
        ['report-sales', 'report-sales-by-staff'].forEach((id) => {
          if (p[id]) {
            p[id].view = true;
            p[id].print = true;
          }
        });
        return p;
      })(),
    },
  ];
}

export function readStoredPermissionGroups(): PermissionGroup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(sanitizeGroupPermissions);
      }
    }
    return getFallbackPermissionGroups();
  } catch {
    return getFallbackPermissionGroups();
  }
}

export function saveStoredPermissionGroups(groups: PermissionGroup[]) {
  const sanitized = groups.map(sanitizeGroupPermissions);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  window.dispatchEvent(new Event('storage'));
  setTimeout(() => {
    window.dispatchEvent(new Event('permissions-updated'));
  }, 0);
}
