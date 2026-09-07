import React from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  CheckCircle,
  Pencil,
  PlusCircle,
  Search,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
  Sliders,
  MinusCircle,
  PlusCircle as PlusIcon,
  UserPlus,
  Users,
  CheckSquare,
  Square,
  Download,
  RotateCcw,
  History,
} from 'lucide-react';
import { normalizeWarehouseRecord, type WarehouseRecord } from '../../shared/utils/warehouseAssignments';

const API_BASE_URL = '/api';
const STORAGE_KEY = 'smart-wms-permission-groups';

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
  // Quyền xem thông tin ở trang chủ:
  showInvoiceCount: boolean;         // Số hóa đơn
  showRevenue: boolean;              // Doanh thu
  showActualRevenue: boolean;        // Thực thu
  showProfitLoss: boolean;           // Lãi lỗ
  showRevenueChart: boolean;         // Biểu đồ Doanh thu/Lợi nhuận
  showAuditLog: boolean;             // Lịch sử thao tác
  showEditAppPrice: boolean;         // Sửa giá đơn thị trường(App)
};

export type MenuPermissionItem = {
  id: string;
  label: string;
  isHeader?: boolean;
  parentId?: string;
};

export type PermissionGroup = {
  id: string;
  name: string;
  code?: string;
  description?: string;
  memberIds: string[];
  generalPermissions: GeneralPermissions;
  menuPermissions: Record<string, ActionPermission>;
};

export type UndoLogItem = {
  id: string;
  timestamp: string;
  type: 'EDIT' | 'DELETE';
  groupName: string;
  description: string;
  deletedGroup?: PermissionGroup;
  previousGroup?: PermissionGroup;
  updatedGroup?: PermissionGroup;
};

type GroupFormState = {
  name: string;
  description: string;
  memberIds: string[];
};

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

// System Menu Items Definition matching System Menu Hierarchy (14 Main Categories)
export const SYSTEM_MENU_TREE: MenuPermissionItem[] = [
  // 1. Trang chủ (Nút Vàng Nổi Bật)
  { id: 'pos', label: 'Trang chủ' },

  // 2. Nhập - Xuất
  { id: 'nhap-xuat', label: 'Nhập - Xuất', isHeader: true },
  { id: 'outbound-orders', label: 'Xuất bán', parentId: 'nhap-xuat' },
  { id: 'outbound-retail', label: 'Xuất bán lẻ', parentId: 'nhap-xuat' },
  { id: 'inbound-stock-in-orders', label: 'Nhập hàng', parentId: 'nhap-xuat' },
  { id: 'inbound-return-requests', label: 'Xuất trả Nhà cung cấp', parentId: 'nhap-xuat' },
  { id: 'inbound-return-customers', label: 'Nhập hàng Khách trả lại', parentId: 'nhap-xuat' },
  { id: 'delivery-transfer-orders', label: 'Xuất chuyển Kho', parentId: 'nhap-xuat' },
  { id: 'delivery-transfer-requests', label: 'Nhập chuyển Kho', parentId: 'nhap-xuat' },
  { id: 'inventory-initial-stock', label: 'Nhập hàng tồn đầu kỳ', parentId: 'nhap-xuat' },
  { id: 'inventory-stocktake', label: 'Kiểm kho', parentId: 'nhap-xuat' },
  { id: 'outbound-sales-orders', label: 'Đơn đặt hàng', parentId: 'nhap-xuat' },
  { id: 'inbound-purchase-orders', label: 'Đơn đặt hàng NCC', parentId: 'nhap-xuat' },
  { id: 'documents-quotes', label: 'Báo giá', parentId: 'nhap-xuat' },
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
  { id: 'report-revenue-huu', label: 'Báo cáo doanh thu - Huu', parentId: 'bao-cao-tong-hop' },

  // 5. Báo cáo Phân tích
  { id: 'bao-cao-phan-tich', label: 'Báo cáo Phân tích', isHeader: true },
  { id: 'report-bill-profit', label: 'Lợi nhuận theo Hóa đơn', parentId: 'bao-cao-phan-tich' },
  { id: 'report-category-profit', label: 'Lợi nhuận theo Nhóm hàng', parentId: 'bao-cao-phan-tich' },
  { id: 'report-customer-profit', label: 'Lợi nhuận theo Khách hàng', parentId: 'bao-cao-phan-tich' },
  // 7. Danh mục
  { id: 'danh-muc', label: 'Danh mục', isHeader: true },
  { id: 'products-main', label: 'Hàng hóa', parentId: 'danh-muc' },
  { id: 'categories', label: 'Nhóm hàng', parentId: 'danh-muc' },
  { id: 'customers', label: 'Khách hàng', parentId: 'danh-muc' },
  { id: 'suppliers', label: 'Nhà cung cấp', parentId: 'danh-muc' },
  { id: 'warehouses', label: 'Kho hàng', parentId: 'danh-muc' },
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

// Toast notification rendered in Portal at top right to avoid layout distortion
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  React.useEffect(() => {
    if (message) {
      const timer = setTimeout(() => onClose(), 3500);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  return createPortal(
    <div className={`fixed top-6 right-6 z-[9999] pointer-events-auto flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl transition-all border backdrop-blur-md animate-in slide-in-from-top-4 ${
      type === 'error' ? 'bg-red-50/95 text-red-700 border-red-200' : 'bg-emerald-50/95 text-emerald-800 border-emerald-200'
    }`}>
      {type === 'error' ? <XCircle className="h-5 w-5 flex-shrink-0 text-red-600" /> : <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-600" />}
      <p className="text-sm font-extrabold">{message}</p>
      <button type="button" onClick={onClose} className="ml-2 rounded-lg p-1 hover:bg-black/5 transition cursor-pointer">
        <X className="h-4 w-4" />
      </button>
    </div>,
    document.body
  );
}

export default function PermissionGroupsPage() {
  const [groups, setGroups] = React.useState<PermissionGroup[]>(readStoredPermissionGroups);
  const [users, setUsers] = React.useState<PersonnelUser[]>([]);
  const [warehouses, setWarehouses] = React.useState<WarehouseRecord[]>([]);

  // Filters
  const [search, setSearch] = React.useState('');

  // Pagination states
  const [pageSize, setPageSize] = React.useState(20);
  const [currentPage, setCurrentPage] = React.useState(1);

  // Bulk Selection & Deletion State
  const [selectedGroupIds, setSelectedGroupIds] = React.useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = React.useState(false);

  // Add/Edit Group Modal
  const [isGroupModalOpen, setIsGroupModalOpen] = React.useState(false);
  const [editingGroup, setEditingGroup] = React.useState<PermissionGroup | null>(null);
  const [groupForm, setGroupForm] = React.useState<GroupFormState>({
    name: '',
    description: '',
    memberIds: [],
  });
  const [memberSearch, setMemberSearch] = React.useState('');

  // Assign Personnel Modal State
  const [assignPersonnelGroup, setAssignPersonnelGroup] = React.useState<PermissionGroup | null>(null);
  const [tempAssignMemberIds, setTempAssignMemberIds] = React.useState<string[]>([]);
  const [assignUserSearch, setAssignUserSearch] = React.useState('');

  // Permission Matrix Modal State (PHÂN QUYỀN DÙNG MENU)
  const [permissionModalGroup, setPermissionModalGroup] = React.useState<PermissionGroup | null>(null);
  const [tempGeneralPermissions, setTempGeneralPermissions] = React.useState<GeneralPermissions>(getDefaultGeneralPermissions());
  const [tempMenuPermissions, setTempMenuPermissions] = React.useState<Record<string, ActionPermission>>(getDefaultMenuPermissions());
  const [matrixSearch, setMatrixSearch] = React.useState('');
  const [collapsedHeaders, setCollapsedHeaders] = React.useState<Record<string, boolean>>({});

  // Feedback State
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  // Delete Confirm Modal State
  const [deletingGroupId, setDeletingGroupId] = React.useState<string | null>(null);

  // Undo / History State
  const [undoHistory, setUndoHistory] = React.useState<UndoLogItem[]>([]);
  const [isUndoModalOpen, setIsUndoModalOpen] = React.useState(false);
  const [selectedUndoDeleteIds, setSelectedUndoDeleteIds] = React.useState<string[]>([]);
  const [undoTabFilter, setUndoTabFilter] = React.useState<'ALL' | 'DELETE' | 'EDIT'>('ALL');

  // Undo Action: Restore Deleted Groups (Batch or Single)
  const handleRestoreDeletedGroups = (logIdsToRestore: string[]) => {
    const logsToRestore = undoHistory.filter(
      (item) => item.type === 'DELETE' && logIdsToRestore.includes(item.id) && item.deletedGroup
    );

    if (logsToRestore.length === 0) return;

    const restoredGroups = logsToRestore.map((item) => item.deletedGroup!);

    setGroups((prev) => {
      const existingIds = new Set(prev.map((g) => g.id));
      const toAdd = restoredGroups.filter((g) => !existingIds.has(g.id));
      const next = [...prev, ...toAdd];
      saveStoredPermissionGroups(next);
      return next;
    });

    setUndoHistory((prev) => prev.filter((item) => !logIdsToRestore.includes(item.id)));
    setSelectedUndoDeleteIds((prev) => prev.filter((id) => !logIdsToRestore.includes(id)));

    setSuccess(`Đã hoàn tác khôi phục ${restoredGroups.length} nhóm quyền đã xóa.`);
  };

  // Undo Action: Revert Edit Group to Previous State
  const handleRevertEditedGroup = (logId: string) => {
    const log = undoHistory.find((item) => item.id === logId && item.type === 'EDIT');
    if (!log || !log.previousGroup) return;

    const prevGroup = log.previousGroup;

    setGroups((prev) => {
      const exists = prev.some((g) => g.id === prevGroup.id);
      const next = exists
        ? prev.map((g) => (g.id === prevGroup.id ? prevGroup : g))
        : [...prev, prevGroup];
      saveStoredPermissionGroups(next);
      return next;
    });

    setUndoHistory((prev) => prev.filter((item) => item.id !== logId));
    setSuccess(`Đã hoàn tác dữ liệu nhóm quyền "${prevGroup.name}" về ban đầu.`);
  };

  // Fetch API groups and backend data with Local Storage Merge
  const fetchData = React.useCallback(async () => {
    try {
      const [uRes, wRes, tRes] = await Promise.all([
        fetch(`${API_BASE_URL}/users`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/warehouses`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/project-teams`, { headers: authHeaders() }),
      ]);

      if (uRes.ok) {
        const uData = await uRes.json();
        const internalOnly = Array.isArray(uData)
          ? uData.filter((u: any) => {
              if (!u) return false;
              const roles = (u.roles || []).map((r: any) => (typeof r === 'string' ? r : r.name || ''));
              if (roles.includes('supplier') || roles.includes('customer')) return false;
              if (u.supplier || u.customer) return false;
              if (u.email && (u.email.endsWith('@supplier.local') || u.email.endsWith('@customer.local'))) return false;
              return true;
            })
          : [];
        setUsers(internalOnly);
      }
      if (wRes.ok) {
        const wData = await wRes.json();
        setWarehouses(Array.isArray(wData) ? wData.map(normalizeWarehouseRecord) : []);
      }
      if (tRes.ok) {
        const tData = await tRes.json();
        if (Array.isArray(tData)) {
          const apiGroups: PermissionGroup[] = tData.map((t: any) => ({
            id: t.id,
            name: t.name,
            code: t.code,
            description: t.description || '',
            memberIds: t.memberIds || Array.from(new Set([...(t.storekeeperIds || []), ...(t.inventoryCheckerIds || [])])),
            generalPermissions: t.generalPermissions || null,
            menuPermissions: t.menuPermissions || null,
          }));

          const localGroups = readStoredPermissionGroups();
          const groupMap = new Map<string, PermissionGroup>();

          // Fill local groups first
          localGroups.forEach((g) => groupMap.set(g.id, g));

          // Merge API groups
          apiGroups.forEach((g) => {
            const existing = groupMap.get(g.id);
            const mergedGeneral = (g.generalPermissions && Object.keys(g.generalPermissions).length > 0)
              ? g.generalPermissions
              : (existing?.generalPermissions || getDefaultGeneralPermissions());
            const mergedMenu = (g.menuPermissions && Object.keys(g.menuPermissions).length > 0)
              ? g.menuPermissions
              : (existing?.menuPermissions || getDefaultMenuPermissions(true));
            const mergedMembers = Array.from(new Set([...(g.memberIds || []), ...(existing?.memberIds || [])]));

            groupMap.set(g.id, {
              ...existing,
              ...g,
              generalPermissions: mergedGeneral,
              menuPermissions: mergedMenu,
              memberIds: mergedMembers,
            });
          });

          const finalGroups = Array.from(groupMap.values());
          setGroups(finalGroups);
          saveStoredPermissionGroups(finalGroups);

          // Auto-sync any unsynced local groups to backend MySQL database
          localGroups.forEach(async (lg) => {
            if (
              lg.id.startsWith('group-') ||
              !apiGroups.some((ag) => ag.id === lg.id || ag.name.trim().toLowerCase() === lg.name.trim().toLowerCase())
            ) {
              try {
                await fetch(`${API_BASE_URL}/project-teams`, {
                  method: 'POST',
                  headers: authHeaders(),
                  body: JSON.stringify({
                    name: lg.name,
                    description: lg.description || '',
                    memberIds: lg.memberIds || [],
                    generalPermissions: lg.generalPermissions || getDefaultGeneralPermissions(),
                    menuPermissions: lg.menuPermissions || getDefaultMenuPermissions(true),
                  }),
                });
              } catch {}
            }
          });
        }
      }
    } catch {
      // Local fallback active
    }
  }, []);

  React.useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Filtered Groups List
  const filteredGroups = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter((g) => {
      return (
        !q ||
        g.name.toLowerCase().includes(q) ||
        (g.description || '').toLowerCase().includes(q) ||
        (g.code || '').toLowerCase().includes(q)
      );
    });
  }, [groups, search]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  // Pagination calculations
  const totalItems = filteredGroups.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  const paginatedGroups = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredGroups.slice(start, start + pageSize);
  }, [filteredGroups, currentPage, pageSize]);

  // Open Create/Edit Group Modal
  const openGroupModal = (groupToEdit?: PermissionGroup) => {
    setError('');
    setMemberSearch('');
    if (groupToEdit) {
      setEditingGroup(groupToEdit);
      setGroupForm({
        name: groupToEdit.name,
        description: groupToEdit.description || '',
        memberIds: groupToEdit.memberIds || [],
      });
    } else {
      setEditingGroup(null);
      setGroupForm({
        name: '',
        description: '',
        memberIds: [],
      });
    }
    setIsGroupModalOpen(true);
  };

  const closeGroupModal = () => {
    setIsGroupModalOpen(false);
    setEditingGroup(null);
    setError('');
  };

  // Open Assign Personnel Modal
  const openAssignPersonnelModal = (group: PermissionGroup) => {
    setAssignPersonnelGroup(group);
    setTempAssignMemberIds(group.memberIds || []);
    setAssignUserSearch('');
  };

  // Save Group via API & update state
  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupForm.name.trim()) {
      setError('Vui lòng nhập tên nhóm quyền.');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      name: groupForm.name.trim(),
      description: groupForm.description.trim(),
      memberIds: groupForm.memberIds,
    };

    try {
      if (editingGroup) {
        const res = await fetch(`${API_BASE_URL}/project-teams/${editingGroup.id}`, {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify(payload),
        });

        const updatedGroup: PermissionGroup = res.ok
          ? { ...editingGroup, ...(await res.json()), memberIds: groupForm.memberIds }
          : { ...editingGroup, ...payload };

        setGroups((prev) => {
          const next = prev.map((g) => (g.id === editingGroup.id ? updatedGroup : g));
          saveStoredPermissionGroups(next);
          return next;
        });

        // Record Undo Log for EDIT
        setUndoHistory((prev) => [
          {
            id: `undo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            type: 'EDIT',
            groupName: editingGroup.name,
            description: `Đã sửa thông tin nhóm quyền "${editingGroup.name}"`,
            previousGroup: JSON.parse(JSON.stringify(editingGroup)),
            updatedGroup: JSON.parse(JSON.stringify(updatedGroup)),
          },
          ...prev,
        ]);

        setSuccess(`Đã cập nhật nhóm quyền "${payload.name}".`);
      } else {
        const res = await fetch(`${API_BASE_URL}/project-teams`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            ...payload,
            warehouseId: warehouses[0]?.id || '',
            generalPermissions: getDefaultGeneralPermissions(),
            menuPermissions: getDefaultMenuPermissions(true),
          }),
        });

        let newGroup: PermissionGroup;
        if (res.ok) {
          const data = await res.json();
          newGroup = {
            id: data.id,
            name: data.name,
            description: data.description,
            memberIds: groupForm.memberIds,
            generalPermissions: data.generalPermissions || getDefaultGeneralPermissions(),
            menuPermissions: data.menuPermissions || getDefaultMenuPermissions(true),
          };
        } else {
          const errData = await res.json().catch(() => null);
          const errMsg = errData?.message || 'Không thể lưu nhóm quyền vào CSDL backend';
          setError(Array.isArray(errMsg) ? errMsg.join(', ') : errMsg);
          setSaving(false);
          return;
        }

        setGroups((prev) => {
          const next = [...prev, newGroup];
          saveStoredPermissionGroups(next);
          return next;
        });

        setSuccess(`Đã tạo nhóm quyền mới "${payload.name}".`);
      }
      closeGroupModal();
    } catch {
      setError('Có lỗi xảy ra khi lưu nhóm quyền vào CSDL.');
    } finally {
      setSaving(false);
    }
  };

  // Save Assign Personnel
  const handleSaveAssignPersonnel = async () => {
    if (!assignPersonnelGroup) return;

    setSaving(true);
    setError('');

    const payload = {
      memberIds: tempAssignMemberIds,
    };

    try {
      await fetch(`${API_BASE_URL}/project-teams/${assignPersonnelGroup.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      }).catch(() => null);

      const updatedGroup: PermissionGroup = {
        ...assignPersonnelGroup,
        memberIds: tempAssignMemberIds,
      };

      setGroups((prev) => {
        const next = prev.map((g) => (g.id === assignPersonnelGroup.id ? updatedGroup : g));
        saveStoredPermissionGroups(next);
        return next;
      });

      // Record Undo Log for EDIT Personnel
      setUndoHistory((prev) => [
        {
          id: `undo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          type: 'EDIT',
          groupName: assignPersonnelGroup.name,
          description: `Đã sửa gán nhân sự cho nhóm "${assignPersonnelGroup.name}"`,
          previousGroup: JSON.parse(JSON.stringify(assignPersonnelGroup)),
          updatedGroup: JSON.parse(JSON.stringify(updatedGroup)),
        },
        ...prev,
      ]);

      // Sync groupIds for users on backend
      const allUsersRes = await fetch(`${API_BASE_URL}/users`, { headers: authHeaders() }).catch(() => null);
      if (allUsersRes && allUsersRes.ok) {
        const allUsers: any[] = await allUsersRes.json();
        const currentGroupId = assignPersonnelGroup.id;

        await Promise.all(
          allUsers.map((u) => {
            const isMember = tempAssignMemberIds.includes(u.id) || tempAssignMemberIds.includes(u.email);
            let userGroupIds: string[] = Array.isArray(u.groupIds) ? u.groupIds : [];
            const hasGroup = userGroupIds.includes(currentGroupId);

            if (isMember && !hasGroup) {
              userGroupIds = [...userGroupIds, currentGroupId];
            } else if (!isMember && hasGroup) {
              userGroupIds = userGroupIds.filter((gid) => gid !== currentGroupId);
            } else {
              return Promise.resolve();
            }

            return fetch(`${API_BASE_URL}/users/${u.id}`, {
              method: 'PATCH',
              headers: authHeaders(),
              body: JSON.stringify({ groupIds: userGroupIds }),
            }).catch(() => null);
          })
        );
      }

      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('permissions-updated'));

      setSuccess(`Đã gán nhân sự cho nhóm "${assignPersonnelGroup.name}".`);
      setAssignPersonnelGroup(null);
    } catch {
      setError('Có lỗi xảy ra khi gán nhân sự.');
    } finally {
      setSaving(false);
    }
  };

  // Delete Group via API
  const handleDeleteGroup = async (id: string) => {
    const targetGroup = groups.find((g) => g.id === id);

    try {
      await fetch(`${API_BASE_URL}/project-teams/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      }).catch(() => null);

      setGroups((prev) => {
        const next = prev.filter((g) => g.id !== id);
        saveStoredPermissionGroups(next);
        return next;
      });

      if (targetGroup) {
        // Record Undo Log for DELETE
        setUndoHistory((prev) => [
          {
            id: `undo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            type: 'DELETE',
            groupName: targetGroup.name,
            description: `Đã xóa nhóm quyền "${targetGroup.name}"`,
            deletedGroup: JSON.parse(JSON.stringify(targetGroup)),
          },
          ...prev,
        ]);
      }

      setSelectedGroupIds((prev) => prev.filter((item) => item !== id));
      setSuccess('Đã xóa nhóm quyền.');
      setDeletingGroupId(null);
    } catch {
      setError('Có lỗi xảy ra khi xóa nhóm quyền.');
    }
  };

  // Bulk Delete Selected Groups
  const handleBulkDelete = async () => {
    if (selectedGroupIds.length === 0) return;

    setSaving(true);
    setError('');

    const targetGroups = groups.filter((g) => selectedGroupIds.includes(g.id));

    try {
      await Promise.all(
        selectedGroupIds.map((id) =>
          fetch(`${API_BASE_URL}/project-teams/${id}`, {
            method: 'DELETE',
            headers: authHeaders(),
          }).catch(() => null)
        )
      );

      setGroups((prev) => {
        const next = prev.filter((g) => !selectedGroupIds.includes(g.id));
        saveStoredPermissionGroups(next);
        return next;
      });

      // Record Undo Logs for Bulk DELETE
      const newDeleteLogs: UndoLogItem[] = targetGroups.map((g) => ({
        id: `undo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: 'DELETE',
        groupName: g.name,
        description: `Đã xóa nhóm quyền "${g.name}"`,
        deletedGroup: JSON.parse(JSON.stringify(g)),
      }));
      setUndoHistory((prev) => [...newDeleteLogs, ...prev]);

      setSuccess(`Đã xóa ${selectedGroupIds.length} nhóm quyền được chọn.`);
      setSelectedGroupIds([]);
      setIsBulkDeleteModalOpen(false);
    } catch {
      setError('Có lỗi xảy ra khi xóa các nhóm quyền đã chọn.');
    } finally {
      setSaving(false);
    }
  };

  // Open Permission Matrix Modal (PHÂN QUYỀN DÙNG MENU)
  const openPermissionMatrixModal = (group: PermissionGroup) => {
    setPermissionModalGroup(group);
    setTempGeneralPermissions({
      ...getDefaultGeneralPermissions(),
      ...(group.generalPermissions || {}),
    });
    setTempMenuPermissions({
      ...getDefaultMenuPermissions(true),
      ...(group.menuPermissions || {}),
    });
    setMatrixSearch('');
    setCollapsedHeaders({});
  };

  const closePermissionMatrixModal = () => {
    setPermissionModalGroup(null);
  };

  // Save Permission Matrix State
  const handleSavePermissionMatrix = async () => {
    if (!permissionModalGroup) return;

    setSaving(true);
    setError('');

    const payload = {
      generalPermissions: tempGeneralPermissions,
      menuPermissions: tempMenuPermissions,
    };

    try {
      await fetch(`${API_BASE_URL}/project-teams/${permissionModalGroup.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      }).catch(() => null);

      const targetNameLower = permissionModalGroup.name.trim().toLowerCase();

      const updatedGroup: PermissionGroup = {
        ...permissionModalGroup,
        generalPermissions: tempGeneralPermissions,
        menuPermissions: tempMenuPermissions,
      };

      setGroups((prev) => {
        const next = prev.map((g) => {
          if (g.id === permissionModalGroup.id || (g.name && g.name.trim().toLowerCase() === targetNameLower)) {
            return {
              ...g,
              generalPermissions: tempGeneralPermissions,
              menuPermissions: tempMenuPermissions,
            };
          }
          return g;
        });
        saveStoredPermissionGroups(next);
        return next;
      });

      // Record Undo Log for Matrix Menu EDIT
      setUndoHistory((prev) => [
        {
          id: `undo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          type: 'EDIT',
          groupName: permissionModalGroup.name,
          description: `Đã sửa quyền Menu cho nhóm "${permissionModalGroup.name}"`,
          previousGroup: JSON.parse(JSON.stringify(permissionModalGroup)),
          updatedGroup: JSON.parse(JSON.stringify(updatedGroup)),
        },
        ...prev,
      ]);

      setSuccess(`Đã lưu cấu hình phân quyền menu cho "${permissionModalGroup.name}".`);
      closePermissionMatrixModal();
    } catch {
      setError('Có lỗi xảy ra khi lưu phân quyền menu.');
    } finally {
      setSaving(false);
    }
  };

  // Toggle Action Permission in Matrix
  const toggleActionPermission = (menuId: string, actionKey: keyof ActionPermission) => {
    setTempMenuPermissions((prev) => {
      const currentPerm = prev[menuId] || {
        view: false,
        create: false,
        edit: false,
        delete: false,
        print: false,
        status: false,
        import: false,
        export: false,
      };
      return {
        ...prev,
        [menuId]: {
          ...currentPerm,
          [actionKey]: !currentPerm[actionKey],
        },
      };
    });
  };

  // Toggle Vertical Column Permissions (Select All / Deselect All Vertically for a specific column)
  const toggleColumnPermissions = (actionKey: keyof ActionPermission) => {
    const supportedItems = SYSTEM_MENU_TREE.filter(
      (item) => !item.isHeader && isActionSupported(item.id, actionKey)
    );

    const allChecked = supportedItems.every(
      (item) => tempMenuPermissions[item.id]?.[actionKey] === true
    );

    setTempMenuPermissions((prev) => {
      const next = { ...prev };
      supportedItems.forEach((item) => {
        const current = next[item.id] || {
          view: false,
          create: false,
          edit: false,
          delete: false,
          print: false,
          status: false,
          import: false,
          export: false,
        };
        next[item.id] = {
          ...current,
          [actionKey]: !allChecked,
        };
      });
      return next;
    });
  };

  const isColumnAllChecked = (actionKey: keyof ActionPermission) => {
    const supportedItems = SYSTEM_MENU_TREE.filter(
      (item) => !item.isHeader && isActionSupported(item.id, actionKey)
    );
    if (supportedItems.length === 0) return false;
    return supportedItems.every((item) => tempMenuPermissions[item.id]?.[actionKey] === true);
  };

  // Toggle Header Row (Select All / Deselect All for Header Children)
  const toggleHeaderRowPermissions = (headerId: string, enable: boolean) => {
    const children = SYSTEM_MENU_TREE.filter((m) => m.parentId === headerId);
    const actionKeys: Array<keyof ActionPermission> = ['view', 'create', 'edit', 'delete', 'print', 'import', 'export'];

    setTempMenuPermissions((prev) => {
      const next = { ...prev };
      children.forEach((c) => {
        const itemPerm: ActionPermission = {
          view: false,
          create: false,
          edit: false,
          delete: false,
          print: false,
          status: false,
          import: false,
          export: false,
        };
        actionKeys.forEach((k) => {
          itemPerm[k] = enable && isActionSupported(c.id, k);
        });
        next[c.id] = itemPerm;
      });
      return next;
    });
  };

  // Toggle General Permission Checkbox
  const toggleGeneralPermission = (key: keyof GeneralPermissions) => {
    setTempGeneralPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // User display name helper
  const getUserDisplayName = React.useCallback(
    (memberIdOrEmail: string) => {
      const found = users.find(
        (u) =>
          u.id === memberIdOrEmail ||
          u.email.toLowerCase() === memberIdOrEmail.toLowerCase()
      );
      return found ? (found.fullName || found.email) : memberIdOrEmail;
    },
    [users]
  );

  // Active Menu Count Helper for table badge
  const getActiveMenuCount = (group: PermissionGroup) => {
    if (!group.menuPermissions) return 0;
    const items = SYSTEM_MENU_TREE.filter((m) => !m.isHeader);
    let count = 0;
    items.forEach((m) => {
      if (group.menuPermissions[m.id]?.view) count++;
    });
    return count;
  };

  // Filtered Users for Form Modals
  const filteredUsersForForm = React.useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return users.filter((u) => {
      return (
        !q ||
        (u.fullName || '').toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone || '').includes(q)
      );
    });
  }, [users, memberSearch]);

  const filteredAssignUsers = React.useMemo(() => {
    const q = assignUserSearch.trim().toLowerCase();
    return users.filter((u) => {
      return (
        !q ||
        (u.fullName || '').toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone || '').includes(q)
      );
    });
  }, [users, assignUserSearch]);

  // Export CSV Helper Function
  const handleExportCSV = () => {
    const exportData = selectedGroupIds.length > 0
      ? groups.filter((g) => selectedGroupIds.includes(g.id))
      : groups;

    if (exportData.length === 0) {
      setError('Không có dữ liệu nhóm quyền để xuất file.');
      return;
    }

    const headers = ['STT', 'Mã nhóm', 'Tên nhóm quyền', 'Mô tả chức năng', 'Số lượng nhân sự áp dụng', 'Danh sách nhân sự', 'Số lượng Menu có quyền'];
    const rows = exportData.map((g, idx) => {
      const memberNames = (g.memberIds || []).map(getUserDisplayName).join('; ');
      const activeMenuCount = getActiveMenuCount(g);
      return [
        idx + 1,
        `"${g.code || g.id}"`,
        `"${(g.name || '').replace(/"/g, '""')}"`,
        `"${(g.description || '').replace(/"/g, '""')}"`,
        g.memberIds?.length || 0,
        `"${memberNames.replace(/"/g, '""')}"`,
        `"${activeMenuCount}/${SYSTEM_MENU_TREE.length}"`,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Nhom_Quyen_WMS_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSuccess(`Đã xuất file CSV thành công cho ${exportData.length} nhóm quyền.`);
  };

  // Matrix Filtered List
  const filteredMenuTree = React.useMemo(() => {
    const q = matrixSearch.trim().toLowerCase();
    if (!q) return SYSTEM_MENU_TREE;

    return SYSTEM_MENU_TREE.filter((item) => {
      if (item.label.toLowerCase().includes(q)) return true;
      if (item.isHeader) {
        const children = SYSTEM_MENU_TREE.filter((c) => c.parentId === item.id);
        return children.some((c) => c.label.toLowerCase().includes(q));
      }
      return false;
    });
  }, [matrixSearch]);

  return (
    <div className="space-y-6">
      <Toast message={error || success} type={error ? 'error' : 'success'} onClose={() => { setError(''); setSuccess(''); }} />

      {/* Top Header Section styled as pill badge matching "Người dùng / Nhân viên" */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2.5 rounded-2xl bg-cyan-600 px-5 py-2.5 text-white shadow-md">
            <ShieldCheck className="h-5 w-5" />
            <h1 className="text-xl font-extrabold tracking-tight">Nhóm quyền</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* 1. Thêm mới */}
          <button
            type="button"
            onClick={() => openGroupModal()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
          >
            <PlusCircle className="h-4.5 w-4.5 text-cyan-700" />
            Thêm mới
          </button>

          {/* 2. Xóa */}
          <button
            type="button"
            onClick={() => {
              if (selectedGroupIds.length === 0) {
                setError('Vui lòng tích chọn ít nhất 1 nhóm quyền trong bảng để xóa.');
                return;
              }
              setIsBulkDeleteModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
          >
            <Trash2 className="h-4.5 w-4.5 text-cyan-700" />
            Xóa {selectedGroupIds.length > 0 ? `(${selectedGroupIds.length})` : ''}
          </button>

          {/* 3. Export */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
          >
            <Download className="h-4.5 w-4.5 text-cyan-700" />
            Export {selectedGroupIds.length > 0 ? `(${selectedGroupIds.length})` : ''}
          </button>

          {/* 4. Hoàn tác */}
          <button
            type="button"
            onClick={() => setIsUndoModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer relative"
            title="Mở lịch sử thao tác sửa và xóa để hoàn tác"
          >
            <RotateCcw className="h-4.5 w-4.5 text-cyan-700" />
            Hoàn tác {undoHistory.length > 0 ? `(${undoHistory.length})` : ''}
          </button>
        </div>
      </div>

      {/* Bulk Action Bar when items selected */}
      {selectedGroupIds.length > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-cyan-50 border-2 border-cyan-500 px-4 py-3 shadow-sm animate-in fade-in">
          <span className="text-sm font-bold text-cyan-900">
            Đã tích chọn <b className="text-cyan-700 font-extrabold text-base">{selectedGroupIds.length}</b> nhóm quyền trong bảng
          </span>
          <button
            type="button"
            onClick={() => setSelectedGroupIds([])}
            className="text-xs font-bold text-cyan-700 hover:text-cyan-900 underline cursor-pointer"
          >
            Bỏ chọn tất cả
          </button>
        </div>
      )}

      {/* High-density Permission Groups Table with Tickbox Header */}
      {filteredGroups.length > 0 ? (
        <div className="overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-sm">
          <div className="max-h-[640px] overflow-auto">
            <table className="w-full border-collapse text-left">
              <thead className="bg-cyan-50 sticky top-0 z-20 shadow-sm">
                <tr className="border-b-2 border-slate-200">
                  <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 w-12">
                    <input
                      type="checkbox"
                      checked={
                        paginatedGroups.length > 0 &&
                        paginatedGroups.every((g) => selectedGroupIds.includes(g.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedGroupIds(
                            Array.from(new Set([...selectedGroupIds, ...paginatedGroups.map((g) => g.id)]))
                          );
                        } else {
                          setSelectedGroupIds(
                            selectedGroupIds.filter((id) => !paginatedGroups.some((g) => g.id === id))
                          );
                        }
                      }}
                      className="h-4 w-4 rounded border-cyan-500 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                    />
                  </th>
                  <th className="border-r border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 w-16">
                    STT
                  </th>
                  <th className="border-r border-slate-200 px-4 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[200px]">
                    Tên Nhóm quyền
                  </th>
                  <th className="border-r border-slate-200 px-4 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[240px]">
                    Mô tả chức năng
                  </th>
                  <th className="border-r border-slate-200 px-4 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[240px]">
                    Nhân sự áp dụng
                  </th>
                  <th className="border-r border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 w-36">
                    Quyền Menu
                  </th>
                  <th className="sticky right-0 border-l border-slate-200 bg-cyan-50 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 shadow-[-4px_0_12px_rgba(0,0,0,0.03)] w-56">
                    THAO TÁC
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {paginatedGroups.map((group, index) => {
                  const globalIndex = (currentPage - 1) * pageSize + index + 1;
                  const memberList = (group.memberIds || []).map(getUserDisplayName);
                  const activeMenuCount = getActiveMenuCount(group);

                  const displayMembers = memberList.slice(0, 2);
                  const remainingCount = memberList.length - 2;
                  const isSelected = selectedGroupIds.includes(group.id);

                  return (
                    <tr
                      key={group.id}
                      className={`group border-b border-slate-200 transition ${
                        isSelected ? 'bg-cyan-50/70' : 'hover:bg-cyan-50/50'
                      }`}
                    >
                      <td className="border-r border-slate-200 px-3 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedGroupIds((prev) =>
                              prev.includes(group.id)
                                ? prev.filter((id) => id !== group.id)
                                : [...prev, group.id]
                            );
                          }}
                          className="h-4 w-4 rounded border-cyan-500 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                        />
                      </td>
                      <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-medium text-slate-700">
                        {globalIndex}
                      </td>
                      <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-bold text-slate-800">
                        {group.name}
                      </td>
                      <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-medium text-slate-700">
                        {group.description || 'Chưa có mô tả'}
                      </td>
                      <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-medium text-slate-700">
                        {memberList.length > 0 ? (
                          <div className="flex flex-wrap items-center justify-center gap-1.5">
                            {displayMembers.map((m, i) => (
                              <span key={i} className="inline-block rounded-md bg-cyan-50 px-2 py-0.5 text-xs text-cyan-800 font-semibold border border-cyan-200">
                                {m}
                              </span>
                            ))}
                            {remainingCount > 0 && (
                              <span
                                className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 font-bold border border-slate-200 cursor-help"
                                title={memberList.slice(2).join(', ')}
                              >
                                +{remainingCount} nhân sự
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">Chưa gán nhân sự</span>
                        )}
                      </td>
                      <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-bold text-cyan-700">
                        <span className="rounded-full bg-cyan-100 px-3 py-1 text-cyan-800 text-xs font-extrabold">
                          {activeMenuCount} / {SYSTEM_MENU_TREE.length} Menu
                        </span>
                      </td>
                      <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-3.5 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 hover:text-cyan-700 cursor-pointer"
                            title="Phân quyền dùng Menu"
                            onClick={() => openPermissionMatrixModal(group)}
                          >
                            <Sliders size={18} strokeWidth={2.5} />
                          </button>

                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 hover:text-cyan-700 cursor-pointer"
                            title="Gán nhân sự vào nhóm"
                            onClick={() => openAssignPersonnelModal(group)}
                          >
                            <UserPlus size={18} strokeWidth={2.5} />
                          </button>

                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 hover:text-cyan-700 cursor-pointer"
                            title="Sửa nhóm"
                            onClick={() => openGroupModal(group)}
                          >
                            <Pencil size={18} strokeWidth={2.5} />
                          </button>

                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 hover:text-cyan-700 cursor-pointer"
                            title="Xóa nhóm"
                            onClick={() => setDeletingGroupId(group.id)}
                          >
                            <Trash2 size={18} strokeWidth={2.5} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalItems > 0 && (
            <div className="flex flex-col items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-3 sm:flex-row">
              <div className="text-sm font-medium text-slate-600">
                Tổng số: <b className="font-extrabold text-slate-900">{totalItems}</b> nhóm quyền{' '}
                <span className="ml-2 text-slate-500">
                  Hiển thị {startIndex} - {endIndex}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-2 sm:mt-0">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-bold text-slate-700 outline-none"
                >
                  <option value={10}>10 dòng / trang</option>
                  <option value={20}>20 dòng / trang</option>
                  <option value={50}>50 dòng / trang</option>
                </select>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                  >
                    «
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-sm font-bold text-white shadow-xs"
                  >
                    {currentPage}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                  >
                    »
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 mb-4">
            <ShieldCheck size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Không tìm thấy nhóm quyền nào</h3>
          <p className="mt-1 text-sm text-slate-500">Thử thay đổi từ khóa tìm kiếm hoặc tạo nhóm quyền mới.</p>
        </div>
      )}

      {/* CREATE / EDIT GROUP MODAL WITH PERSONNEL SELECTION */}
      {isGroupModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-2xl transition-all">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="text-lg font-extrabold text-slate-800">
                  {editingGroup ? 'Chỉnh sửa Nhóm quyền' : 'Thêm mới Nhóm quyền'}
                </h3>
                <button
                  type="button"
                  onClick={closeGroupModal}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveGroup} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600">
                    Tên nhóm quyền <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={groupForm.name}
                    onChange={(e) => setGroupForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="VD: Quản lý kho, Thủ kho, NV Kiểm kê..."
                    className="mt-1 h-11 w-full rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600">Mô tả chức năng</label>
                  <textarea
                    value={groupForm.description}
                    onChange={(e) => setGroupForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Mô tả công việc & phạm vi quyền hạn của nhóm..."
                    rows={3}
                    className="mt-1 w-full rounded-xl border-2 border-cyan-500 bg-white p-3 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Nhân sự áp dụng nhóm quyền ({groupForm.memberIds.length} đã chọn)
                  </label>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm nhân sự theo tên, email..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs font-semibold outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1.5 bg-slate-50/50">
                    {filteredUsersForForm.length > 0 ? (
                      filteredUsersForForm.map((user) => {
                        const isChecked =
                          groupForm.memberIds.includes(user.id) || groupForm.memberIds.includes(user.email);
                        return (
                          <label
                            key={user.id}
                            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-100 hover:bg-cyan-50/50 transition cursor-pointer text-xs font-semibold text-slate-700"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setGroupForm((prev) => {
                                  const exists =
                                    prev.memberIds.includes(user.id) || prev.memberIds.includes(user.email);
                                  const newMemberIds = exists
                                    ? prev.memberIds.filter((m) => m !== user.id && m !== user.email)
                                    : [...prev.memberIds, user.id];
                                  return { ...prev, memberIds: newMemberIds };
                                });
                              }}
                              className="h-4 w-4 rounded border-cyan-500 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                            />
                            <div className="flex-1 overflow-hidden">
                              <p className="font-bold text-slate-800 truncate">{user.fullName || user.email}</p>
                              <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                            </div>
                          </label>
                        );
                      })
                    ) : (
                      <p className="text-center py-3 text-xs text-slate-400 italic">Không có nhân sự nào</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={closeGroupModal}
                    className="rounded-xl border-2 border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700 disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? 'Đang lưu...' : 'Lưu Nhóm quyền'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ASSIGN PERSONNEL MODAL FROM TABLE ACTION */}
      {assignPersonnelGroup &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-800">Gán nhân sự vào nhóm quyền</h3>
                  <p className="text-xs font-bold text-cyan-700 mt-0.5">
                    Nhóm quyền: <span className="font-extrabold">{assignPersonnelGroup.name}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAssignPersonnelGroup(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm nhân sự theo tên, email..."
                    value={assignUserSearch}
                    onChange={(e) => setAssignUserSearch(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-xs font-semibold outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1.5 bg-slate-50/50">
                  {filteredAssignUsers.length > 0 ? (
                    filteredAssignUsers.map((user) => {
                      const isChecked =
                        tempAssignMemberIds.includes(user.id) || tempAssignMemberIds.includes(user.email);
                      return (
                        <label
                          key={user.id}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white border border-slate-100 hover:bg-cyan-50/50 transition cursor-pointer text-xs font-semibold text-slate-700 shadow-2xs"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setTempAssignMemberIds((prev) => {
                                const exists = prev.includes(user.id) || prev.includes(user.email);
                                return exists
                                  ? prev.filter((m) => m !== user.id && m !== user.email)
                                  : [...prev, user.id];
                              });
                            }}
                            className="h-4 w-4 rounded border-cyan-500 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                          />
                          <div className="flex-1 overflow-hidden">
                            <p className="font-bold text-slate-800 truncate">{user.fullName || user.email}</p>
                            <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                          </div>
                        </label>
                      );
                    })
                  ) : (
                    <p className="text-center py-4 text-xs text-slate-400 italic">Không tìm thấy nhân sự</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-4">
                <span className="text-xs font-bold text-slate-500">
                  Đã chọn: <b className="text-cyan-700">{tempAssignMemberIds.length}</b> nhân sự
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAssignPersonnelGroup(null)}
                    className="rounded-xl border-2 border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAssignPersonnel}
                    disabled={saving}
                    className="rounded-xl bg-cyan-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-cyan-700 disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? 'Đang lưu...' : 'Lưu phân gán'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* SINGLE DELETE CONFIRMATION MODAL */}
      {deletingGroupId &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-2xl">
              <h3 className="text-lg font-extrabold text-slate-800">Xác nhận xóa Nhóm quyền</h3>
              <p className="mt-2 text-sm text-slate-600">
                Bạn có chắc chắn muốn xóa nhóm quyền này? Các nhân sự thuộc nhóm sẽ bị hủy liên kết nhóm quyền.
              </p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeletingGroupId(null)}
                  className="rounded-xl border-2 border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteGroup(deletingGroupId)}
                  className="rounded-xl bg-red-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:bg-red-700 cursor-pointer"
                >
                  Xóa ngay
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* BULK DELETE CONFIRMATION MODAL */}
      {isBulkDeleteModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-2xl">
              <h3 className="text-lg font-extrabold text-slate-800">Xác nhận xóa hàng loạt</h3>
              <p className="mt-2 text-sm text-slate-600">
                Bạn có chắc chắn muốn xóa <b className="text-red-600">{selectedGroupIds.length}</b> nhóm quyền đã chọn? Tất cả liên kết phân quyền của các nhóm này sẽ bị xóa.
              </p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsBulkDeleteModalOpen(false)}
                  className="rounded-xl border-2 border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={saving}
                  className="rounded-xl bg-red-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Đang xóa...' : 'Xóa ngay'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* EXPANDED & STYLISH "PHÂN QUYỀN DÙNG MENU" MODAL */}
      {permissionModalGroup &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
            <div className="w-full max-w-7xl max-h-[94vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200 bg-cyan-50/50 px-6 py-4">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-slate-800">
                    PHÂN QUYỀN DÙNG MENU
                  </h2>
                  <p className="text-sm font-bold text-slate-600 mt-0.5">
                    Nhóm quyền: <span className="text-cyan-700 font-extrabold">{permissionModalGroup.name}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closePermissionMatrixModal}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
                {/* General Permissions Checkboxes with Cyan accent */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 text-sm font-semibold text-slate-800">
                    <label className="flex items-center gap-2.5 cursor-pointer hover:text-cyan-700 transition">
                      <input
                        type="checkbox"
                        checked={tempGeneralPermissions.canViewImportPrice}
                        onChange={() => toggleGeneralPermission('canViewImportPrice')}
                        className="h-4.5 w-4.5 rounded-md border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                      />
                      <span>Được xem giá nhập</span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer hover:text-cyan-700 transition">
                      <input
                        type="checkbox"
                        checked={tempGeneralPermissions.canViewExportPriceInCat}
                        onChange={() => toggleGeneralPermission('canViewExportPriceInCat')}
                        className="h-4.5 w-4.5 rounded-md border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                      />
                      <span>Xem giá xuất trong DM</span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer hover:text-cyan-700 transition">
                      <input
                        type="checkbox"
                        checked={tempGeneralPermissions.canCopyKit}
                        onChange={() => toggleGeneralPermission('canCopyKit')}
                        className="h-4.5 w-4.5 rounded-md border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                      />
                      <span>Sao chép bộ</span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer hover:text-cyan-700 transition">
                      <input
                        type="checkbox"
                        checked={tempGeneralPermissions.canViewInvoiceByStaff}
                        onChange={() => toggleGeneralPermission('canViewInvoiceByStaff')}
                        className="h-4.5 w-4.5 rounded-md border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                      />
                      <span>Xem Hóa đơn theo Nhân viên</span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer hover:text-cyan-700 transition">
                      <input
                        type="checkbox"
                        checked={tempGeneralPermissions.canManageCustomerByStaff}
                        onChange={() => toggleGeneralPermission('canManageCustomerByStaff')}
                        className="h-4.5 w-4.5 rounded-md border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                      />
                      <span>Quản lý KH theo Nhân viên</span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer hover:text-cyan-700 transition">
                      <input
                        type="checkbox"
                        checked={tempGeneralPermissions.canEditPriceWholesale}
                        onChange={() => toggleGeneralPermission('canEditPriceWholesale')}
                        className="h-4.5 w-4.5 rounded-md border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                      />
                      <span>Sửa giá khi Xuất bán buôn</span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer hover:text-cyan-700 transition">
                      <input
                        type="checkbox"
                        checked={tempGeneralPermissions.canEditDateStock}
                        onChange={() => toggleGeneralPermission('canEditDateStock')}
                        className="h-4.5 w-4.5 rounded-md border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                      />
                      <span>Sửa ngày phiếu Nhập/Xuất</span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer hover:text-cyan-700 transition">
                      <input
                        type="checkbox"
                        checked={tempGeneralPermissions.canEditDateCash}
                        onChange={() => toggleGeneralPermission('canEditDateCash')}
                        className="h-4.5 w-4.5 rounded-md border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                      />
                      <span>Sửa ngày phiếu Thu/Chi</span>
                    </label>
                  </div>
                </div>

                {/* Dashboard Rights Checkboxes */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wide text-cyan-800">
                    Quyền xem thông tin ở trang chủ:
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs font-semibold text-slate-800">
                    <label className="flex items-center gap-2 cursor-pointer hover:text-cyan-700">
                      <input
                        type="checkbox"
                        checked={tempGeneralPermissions.showInvoiceCount}
                        onChange={() => toggleGeneralPermission('showInvoiceCount')}
                        className="h-4 w-4 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                      />
                      <span>Số hóa đơn</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer hover:text-cyan-700">
                      <input
                        type="checkbox"
                        checked={tempGeneralPermissions.showRevenue}
                        onChange={() => toggleGeneralPermission('showRevenue')}
                        className="h-4 w-4 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                      />
                      <span>Doanh thu</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer hover:text-cyan-700">
                      <input
                        type="checkbox"
                        checked={tempGeneralPermissions.showActualRevenue}
                        onChange={() => toggleGeneralPermission('showActualRevenue')}
                        className="h-4 w-4 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                      />
                      <span>Thực thu</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer hover:text-cyan-700">
                      <input
                        type="checkbox"
                        checked={tempGeneralPermissions.showProfitLoss}
                        onChange={() => toggleGeneralPermission('showProfitLoss')}
                        className="h-4 w-4 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                      />
                      <span>Lãi lỗ</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer hover:text-cyan-700">
                      <input
                        type="checkbox"
                        checked={tempGeneralPermissions.showRevenueChart}
                        onChange={() => toggleGeneralPermission('showRevenueChart')}
                        className="h-4 w-4 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                      />
                      <span>Biểu đồ DThu/LNhận</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer hover:text-cyan-700">
                      <input
                        type="checkbox"
                        checked={tempGeneralPermissions.showAuditLog}
                        onChange={() => toggleGeneralPermission('showAuditLog')}
                        className="h-4 w-4 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                      />
                      <span>Lịch sử thao tác</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer hover:text-cyan-700">
                      <input
                        type="checkbox"
                        checked={tempGeneralPermissions.showEditAppPrice}
                        onChange={() => toggleGeneralPermission('showEditAppPrice')}
                        className="h-4 w-4 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                      />
                      <span>Sửa giá đơn App</span>
                    </label>
                  </div>
                </div>

                {/* Search Bar for Permission Matrix */}
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-500" />
                  <input
                    type="text"
                    value={matrixSearch}
                    onChange={(e) => setMatrixSearch(e.target.value)}
                    placeholder="Tìm kiếm mục menu trong bảng phân quyền..."
                    className="h-10 w-full rounded-xl border border-cyan-500 bg-white pl-11 pr-4 text-xs font-semibold text-slate-800 outline-none shadow-xs"
                  />
                </div>

                {/* Matrix Table */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="max-h-[500px] overflow-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="bg-cyan-50 sticky top-0 z-20 shadow-xs">
                        <tr className="border-b border-slate-200 font-extrabold uppercase text-slate-800">
                          <th className="px-4 py-3 border-r border-slate-200 min-w-[220px]">
                            DANH MỤC MENU / CHỨC NĂNG
                          </th>
                          {[
                            { key: 'view', label: 'XEM' },
                            { key: 'create', label: 'THÊM MỚI' },
                            { key: 'edit', label: 'SỬA' },
                            { key: 'delete', label: 'XÓA' },
                            { key: 'print', label: 'IN CHỨNG TỪ' },
                            { key: 'import', label: 'NHẬP FILE' },
                            { key: 'export', label: 'XUẤT FILE' },
                          ].map((col) => (
                            <th key={col.key} className="px-2 py-2 text-center border-r border-slate-200 w-24">
                              <div className="flex flex-col items-center justify-center gap-1.5">
                                <span className="text-[11px] font-black">{col.label}</span>
                                <input
                                  type="checkbox"
                                  checked={isColumnAllChecked(col.key as keyof ActionPermission)}
                                  onChange={() => toggleColumnPermissions(col.key as keyof ActionPermission)}
                                  title={`Chọn / Bỏ chọn toàn bộ cột ${col.label}`}
                                  className="h-4 w-4 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                                />
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredMenuTree.map((item) => {
                          if (item.isHeader) {
                            const isCollapsed = collapsedHeaders[item.id];
                            return (
                              <tr key={item.id} className="bg-cyan-100/60 font-black text-cyan-900 border-t-2 border-cyan-200">
                                <td className="px-4 py-3 flex items-center justify-between border-r border-cyan-200">
                                  <span className="uppercase text-xs tracking-wider">{item.label}</span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => toggleHeaderRowPermissions(item.id, true)}
                                      className="text-[11px] font-bold text-cyan-800 hover:text-cyan-950 underline cursor-pointer"
                                      title="Bật tất cả quyền mục này"
                                    >
                                      Chọn tất cả
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => toggleHeaderRowPermissions(item.id, false)}
                                      className="text-[11px] font-bold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                                      title="Tắt tất cả quyền mục này"
                                    >
                                      Bỏ chọn
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setCollapsedHeaders((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                                      className="ml-2 p-1 text-cyan-800 hover:bg-cyan-200/50 rounded cursor-pointer"
                                    >
                                      {isCollapsed ? <PlusIcon size={14} /> : <MinusCircle size={14} />}
                                    </button>
                                  </div>
                                </td>
                                <td colSpan={7} className="bg-cyan-100/40"></td>
                              </tr>
                            );
                          }

                          if (item.parentId && collapsedHeaders[item.parentId]) {
                            return null;
                          }

                          const perm = tempMenuPermissions[item.id] || {
                            view: false,
                            create: false,
                            edit: false,
                            delete: false,
                            print: false,
                            status: false,
                            import: false,
                            export: false,
                          };

                          const columns: Array<{ key: keyof ActionPermission; label: string }> = [
                            { key: 'view', label: 'Xem' },
                            { key: 'create', label: 'Thêm mới' },
                            { key: 'edit', label: 'Sửa' },
                            { key: 'delete', label: 'Xóa' },
                            { key: 'print', label: 'In chứng từ' },
                            { key: 'import', label: 'Nhập file' },
                            { key: 'export', label: 'Xuất file' },
                          ];

                          return (
                            <tr key={item.id} className="hover:bg-cyan-50/50 transition">
                              <td className="px-4 py-2.5 border-r border-slate-200 font-semibold text-slate-800 pl-8">
                                {item.label}
                              </td>

                              {columns.map((col) => {
                                const supported = isActionSupported(item.id, col.key);
                                const isChecked = supported && Boolean(perm[col.key]);

                                if (!supported) {
                                  return (
                                    <td
                                      key={col.key}
                                      className="px-3 py-2.5 text-center border-r border-slate-200 bg-slate-100/40"
                                      title="Chức năng này không hỗ trợ / không có ở trang này"
                                    >
                                      <input
                                        type="checkbox"
                                        disabled
                                        checked={false}
                                        className="h-4 w-4 rounded border-slate-200 bg-slate-200 opacity-20 cursor-not-allowed pointer-events-none"
                                      />
                                    </td>
                                  );
                                }

                                return (
                                  <td key={col.key} className="px-3 py-2.5 text-center border-r border-slate-200">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleActionPermission(item.id, col.key)}
                                      className="h-4 w-4 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
                <button
                  type="button"
                  onClick={closePermissionMatrixModal}
                  className="rounded-xl border-2 border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSavePermissionMatrix}
                  disabled={saving}
                  className="rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-cyan-700 disabled:opacity-50 transition cursor-pointer"
                >
                  {saving ? 'Đang lưu...' : 'Lưu Phân Quyền Menu'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Undo / History Modal */}
      {isUndoModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in">
            <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-cyan-100 bg-gradient-to-r from-cyan-600 to-cyan-700 px-6 py-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white/20 p-2 text-white">
                    <RotateCcw className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold">Lịch Sử & Hoàn Tác Thao Tác</h2>
                    <p className="text-xs text-cyan-100 font-medium">
                      Hoàn tác các lệnh Sửa và Xóa nhóm quyền đã thực hiện
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUndoModalOpen(false)}
                  className="rounded-xl p-1.5 text-cyan-100 hover:bg-white/10 hover:text-white transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Toolbar & Filters */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-6 py-3">
                {/* Filter tabs */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setUndoTabFilter('ALL')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                      undoTabFilter === 'ALL'
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-300'
                    }`}
                  >
                    Tất cả ({undoHistory.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUndoTabFilter('DELETE')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                      undoTabFilter === 'DELETE'
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-300'
                    }`}
                  >
                    Lệnh Xóa ({undoHistory.filter((i) => i.type === 'DELETE').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUndoTabFilter('EDIT')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                      undoTabFilter === 'EDIT'
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-300'
                    }`}
                  >
                    Lệnh Sửa ({undoHistory.filter((i) => i.type === 'EDIT').length})
                  </button>
                </div>

                {/* Batch Delete Restore button */}
                {selectedUndoDeleteIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleRestoreDeletedGroups(selectedUndoDeleteIds)}
                    className="inline-flex items-center gap-1.5 rounded-xl border-2 border-cyan-700 bg-white px-4 py-1.5 text-xs font-extrabold text-cyan-700 shadow-xs hover:bg-cyan-50 transition cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-cyan-700" />
                    Hoàn tác các mục đã chọn ({selectedUndoDeleteIds.length})
                  </button>
                )}
              </div>

              {/* History Items List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {undoHistory.filter((item) => undoTabFilter === 'ALL' || item.type === undoTabFilter).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                    <History className="h-12 w-12 stroke-[1.5] mb-2 text-slate-300" />
                    <p className="text-sm font-bold text-slate-600">Chưa có thao tác Sửa hoặc Xóa nào để hoàn tác</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Các thao tác chỉnh sửa hoặc xóa nhóm quyền sẽ ghi vết tại đây để bạn khôi phục lại khi cần.
                    </p>
                  </div>
                ) : (
                  undoHistory
                    .filter((item) => undoTabFilter === 'ALL' || item.type === undoTabFilter)
                    .map((item) => {
                      const isDeleted = item.type === 'DELETE';
                      const isChecked = selectedUndoDeleteIds.includes(item.id);

                      return (
                        <div
                          key={item.id}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border-2 p-4 transition ${
                            isDeleted
                              ? 'border-red-200 bg-red-50/40 hover:bg-red-50/70'
                              : 'border-cyan-200 bg-cyan-50/30 hover:bg-cyan-50/60'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Checkbox for batch deleted item restore */}
                            {isDeleted ? (
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedUndoDeleteIds((prev) => [...prev, item.id]);
                                  } else {
                                    setSelectedUndoDeleteIds((prev) => prev.filter((id) => id !== item.id));
                                  }
                                }}
                                className="mt-1 h-4 w-4 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                                title="Tích chọn để hoàn tác khôi phục nhóm bị xóa này"
                              />
                            ) : (
                              <div className="mt-1 h-4 w-4 rounded border border-slate-300 bg-slate-100 flex items-center justify-center">
                                <span className="h-1.5 w-1.5 rounded-full bg-cyan-600" />
                              </div>
                            )}

                            <div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`rounded-md px-2 py-0.5 text-[11px] font-black uppercase tracking-wider ${
                                    isDeleted ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                                  }`}
                                >
                                  {isDeleted ? 'Lệnh Xóa' : 'Lệnh Sửa'}
                                </span>
                                <span className="text-xs font-semibold text-slate-400">{item.timestamp}</span>
                              </div>

                              <p className="mt-1.5 text-sm font-extrabold text-slate-800">{item.description}</p>
                              {item.groupName && (
                                <p className="text-xs font-medium text-slate-500">
                                  Tên nhóm: <b className="text-slate-700 font-bold">{item.groupName}</b>
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="flex items-center gap-2 self-end sm:self-center">
                            {isDeleted ? (
                              <button
                                type="button"
                                onClick={() => handleRestoreDeletedGroups([item.id])}
                                className="inline-flex items-center gap-1.5 rounded-xl border-2 border-cyan-700 bg-white px-4 py-2 text-xs font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
                              >
                                <RotateCcw className="h-3.5 w-3.5 text-cyan-700" />
                                Hoàn tác (Khôi phục)
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRevertEditedGroup(item.id)}
                                className="inline-flex items-center gap-1.5 rounded-xl border-2 border-cyan-700 bg-white px-4 py-2 text-xs font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
                              >
                                <RotateCcw className="h-3.5 w-3.5 text-cyan-700" />
                                Hoàn tác như cũ
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
                <span className="text-xs font-semibold text-slate-500">
                  * Chỉ hỗ trợ hoàn tác cho các thao tác Sửa và Xóa trong phiên làm việc hiện tại.
                </span>
                <button
                  type="button"
                  onClick={() => setIsUndoModalOpen(false)}
                  className="rounded-xl border-2 border-slate-300 bg-white px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer shadow-xs"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
