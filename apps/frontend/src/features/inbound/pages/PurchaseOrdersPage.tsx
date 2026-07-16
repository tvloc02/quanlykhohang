import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  FileText,
  Filter,
  Package,
  Pencil,
  PlusCircle,
  RefreshCw,
  Search,
  Trash2,
  Truck,
  X,
  XCircle,
  MoreHorizontal,
  Send,
  Calendar,
  User,
} from 'lucide-react';
import InboundSectionPlaceholderPage from './InboundSectionPlaceholderPage';
import {
  getStoredWarehouses,
  mergeStoredWarehouses,
  normalizeWarehouseRecord,
  saveStoredWarehouses,
  type WarehouseRecord,
} from '../../../shared/utils/warehouseAssignments';
import BarcodeScanner, { ScanBarcodeButton, type ScannedProduct } from '../../../shared/components/BarcodeScanner';
import { PurchaseOrderFormModal } from '../components/PurchaseOrderFormModal';

type SupplierProduct = {
  id: string;
  supplierSku?: string;
  purchasePrice: string;
  isPrimary: boolean;
  product: {
    id: string;
    internalSku: string;
    name: string;
    unit?: string;
  } | null;
};

type Supplier = {
  id: string;
  supplierCode: string;
  name: string;
  status: 'active' | 'inactive';
  leadTimeDays: number;
  currency: string;
  contactPerson?: string;
  phone?: string;
  taxCode?: string;
  products?: SupplierProduct[];
};

type PurchaseOrderUser = {
  id: string;
  email: string;
  fullName?: string;
  roles?: {
    name: string;
  }[];
};

type PurchaseOrderLine = {
  id: string;
  warehouseCode?: string;
  expectedQty: number;
  receivedQty: number;
  unitPrice: number;
  totalLineAmount: number;
  product?: {
    id: string;
    internalSku: string;
    name: string;
    unit?: string;
  } | null;
};

type PurchaseOrder = {
  id: string;
  poNumber: string;
  receiptNo?: string;
  orderDate?: string;
  expectedDate?: string;
  status?: string;
  description?: string;
  totalAmount: number;
  supplier?: {
    id: string;
    supplierCode?: string;
    name: string;
  } | null;
  supplierName?: string;
  details?: PurchaseOrderLine[];
  items: number;
};

type OrderStatus = 'CREATED' | 'APPROVED' | 'SUPPLIER_APPROVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
type TimeFilter = 'this-month' | '7-days' | 'all';
type ModalMode = 'create' | 'edit' | 'delete' | 'view' | null;

type FormLine = {
  id?: string;
  rowId: string;
  productId: string;
  warehouseCode: string;
  expectedQty: string;
  receivedQty: string;
  unitPrice: string;
};

type OrderForm = {
  poNumber: string;
  supplierId: string;
  orderDate: string;
  expectedDate: string;
  status: OrderStatus;
  description: string;
  items: FormLine[];
  creatorName?: string;
  creatorPhone?: string;
  warehouseCode?: string;
  approverId?: string;
};

type Toast = {
  type: 'success' | 'error';
  message: string;
};

type AdvancedFilters = {
  startDate: string;
  endDate: string;
  supplierId: string;
  minAmount: string;
  maxAmount: string;
};

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function makeRow(warehouseCode = 'KHO-NVL'): FormLine {
  return {
    rowId: `${Date.now()}-${Math.random()}`,
    productId: '',
    warehouseCode,
    expectedQty: '1',
    receivedQty: '0',
    unitPrice: '0',
  };
}

function parseJwtPayload(token?: string) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(payload);
    return JSON.parse(decodeURIComponent(escape(decoded)));
  } catch {
    return null;
  }
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return null;
  }
}

function getUserDisplayName(payload: any): string {
  const storedUser = getStoredUser();
  return (
    storedUser?.fullName ||
    storedUser?.name ||
    storedUser?.email ||
    payload?.fullName ||
    payload?.name ||
    payload?.email ||
    payload?.sub ||
    payload?.id ||
    ''
  );
}

function getUserPhone(payload: any): string {
  const storedUser = getStoredUser();
  return (
    storedUser?.phone ||
    storedUser?.phoneNumber ||
    storedUser?.mobile ||
    payload?.phone ||
    payload?.phoneNumber ||
    payload?.mobile ||
    payload?.phone_number ||
    ''
  );
}

function getPrimaryRole(user: PurchaseOrderUser) {
  if (!Array.isArray(user.roles) || user.roles.length === 0) return 'staff';
  if (user.roles.some((role) => String(role?.name).toLowerCase() === 'admin')) return 'admin';
  if (user.roles.some((role) => String(role?.name).toLowerCase() === 'manager')) return 'manager';
  if (user.roles.some((role) => String(role?.name).toLowerCase() === 'staff')) return 'staff';
  return String(user.roles[0]?.name || 'staff');
}

function getCurrentUserId() {
  const storedUser = getStoredUser();
  if (storedUser?.id) return String(storedUser.id);
  if (storedUser?.email) return String(storedUser.email);

  const payload = parseJwtPayload(localStorage.getItem('token') || '');
  if (payload?.sub !== undefined && payload?.sub !== null) return String(payload.sub);
  if (payload?.email) return String(payload.email);

  return '';
}

function isWarehouseAssignedToUser(userId: string, warehouse: WarehouseRecord) {
  return warehouse.managerIds.includes(userId) || warehouse.staffIds.includes(userId);
}

function getWarehouseOptionsForUser(userId: string, warehouses: WarehouseRecord[]) {
  if (!userId) return warehouses;
  return warehouses.filter((warehouse) => isWarehouseAssignedToUser(userId, warehouse));
}

function getApproversForWarehouse(warehouse: WarehouseRecord | null, users: PurchaseOrderUser[]) {
  if (!warehouse) return [];
  const approvedWarehouseIds = new Set([
    ...warehouse.managerIds.map(String),
    ...warehouse.staffIds.map(String),
  ]);
  return users.filter(
    (user) =>
      approvedWarehouseIds.has(String(user.id)) &&
      Array.isArray(user.roles) &&
      user.roles.some((role) => String(role?.name).toLowerCase() === 'manager'),
  );
}

const modalSelectClass =
  'h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 pr-10 outline-none appearance-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10';

function toLocalDatetimeString(dateObj: Date) {
  const tzOffset = dateObj.getTimezoneOffset() * 60000;
  return new Date(dateObj.getTime() - tzOffset).toISOString().slice(0, 16);
}

function parseDateForInput(dateString?: string) {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '';
  return toLocalDatetimeString(d);
}

function buildEmptyForm(supplierId = '', warehouseCode = ''): OrderForm {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const randomId = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');

  return {
    poNumber: `PO-${randomId}`,
    supplierId,
    orderDate: toLocalDatetimeString(now),
    expectedDate: toLocalDatetimeString(nextWeek),
    status: 'CREATED',
    description: '',
    items: [makeRow(warehouseCode), makeRow(warehouseCode), makeRow(warehouseCode), makeRow(warehouseCode), makeRow(warehouseCode)],
    creatorName: '',
    creatorPhone: '',
    warehouseCode,
    approverId: '',
  };
}

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('vi-VN');
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
}

function parseMoney(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusLabel(status?: string) {
  switch ((status || 'CREATED').toUpperCase()) {
    case 'DRAFT':
      return 'Nháp';
    case 'APPROVED':
      return 'Chờ NCC xác nhận';
    case 'SUPPLIER_APPROVED':
      return 'NCC đã xác nhận';
    case 'PARTIALLY_RECEIVED':
      return 'Nhận một phần';
    case 'RECEIVED':
      return 'Hoàn thành';
    case 'CANCELLED':
      return 'Đã hủy';
    default:
      return 'Chờ duyệt';
  }
}

function statusClass(status?: string) {
  switch ((status || 'CREATED').toUpperCase()) {
    case 'DRAFT':
      return 'border-slate-300 bg-slate-100 text-slate-600';
    case 'APPROVED':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'SUPPLIER_APPROVED':
      return 'border-indigo-200 bg-indigo-50 text-indigo-700';
    case 'PARTIALLY_RECEIVED':
      return 'border-cyan-200 bg-cyan-50 text-cyan-700';
    case 'RECEIVED':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'CANCELLED':
      return 'border-red-200 bg-red-50 text-red-600';
    default:
      return 'border-amber-200 bg-amber-50 text-amber-700';
  }
}

function statusToFilter(status?: string): 'all' | 'waiting' | 'approved' | 'partial' | 'done' | 'cancelled' {
  switch ((status || 'CREATED').toUpperCase()) {
    case 'APPROVED':
    case 'SUPPLIER_APPROVED':
      return 'approved';
    case 'PARTIALLY_RECEIVED':
      return 'partial';
    case 'RECEIVED':
      return 'done';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'waiting';
  }
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-slate-700">{label}</label>
      <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700">
        {value || '-'}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <span className="text-sm font-semibold text-slate-500">{label}</span>
      <span className="text-sm font-black text-slate-900">{value}</span>
    </div>
  );
}

function PurchaseOrdersPageContent() {
  const navigate = useNavigate();
  const [orders, setOrders] = React.useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = React.useState<WarehouseRecord[]>(() => getStoredWarehouses());
  const [users, setUsers] = React.useState<PurchaseOrderUser[]>([]);

  // Filters
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'waiting' | 'approved' | 'partial' | 'done' | 'cancelled'>('all');
  const [timeFilter, setTimeFilter] = React.useState<TimeFilter>('this-month');

  // Advanced Filters
  const [showAdvancedFilters, setShowAdvancedFilters] = React.useState(false);
  const [advancedFilters, setAdvancedFilters] = React.useState<AdvancedFilters>({
    startDate: '',
    endDate: '',
    supplierId: '',
    minAmount: '',
    maxAmount: '',
  });

  const [pageSize, setPageSize] = React.useState(10);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = React.useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<Toast | null>(null);
  const [modalMode, setModalMode] = React.useState<ModalMode>(null);
  const [form, setForm] = React.useState<OrderForm>(() => buildEmptyForm());
  const [deleteTarget, setDeleteTarget] = React.useState<PurchaseOrder | null>(null);
  const [scannedProducts, setScannedProducts] = React.useState<ScannedProduct[]>([]);
  const [receiveOpen, setReceiveOpen] = React.useState(false);
  const [receiveRows, setReceiveRows] = React.useState<Array<{ detailId: string; label: string; sku: string; expectedQty: number; receivedQty: number; unitPrice: number; qty: string }>>([]);
  const [scannerOpen, setScannerOpen] = React.useState(false);
  const [activeDropdown, setActiveDropdown] = React.useState<string | null>(null);

  const [receiptCode, setReceiptCode] = React.useState('');
  const [receiptDate, setReceiptDate] = React.useState(new Date().toISOString().slice(0, 16));
  const [stockInNote, setStockInNote] = React.useState('');
  const [selectedStaffIds, setSelectedStaffIds] = React.useState<string[]>([]);
  const [duplicateReceipts, setDuplicateReceipts] = React.useState<any[]>([]);
  const [pendingOrderForStockIn, setPendingOrderForStockIn] = React.useState<PurchaseOrder | null>(null);

  React.useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);
  const currentUserId = React.useMemo(() => getCurrentUserId(), []);

  const supplierProducts = suppliers.find((supplier) => supplier.id === form.supplierId)?.products || [];

  const selectedOrder = React.useMemo(
    () => (selectedOrderDetails?.id === selectedId ? selectedOrderDetails : orders.find((order) => order.id === selectedId)) || null,
    [orders, selectedId, selectedOrderDetails],
  );

  const handleProductScanned = React.useCallback((product: ScannedProduct, qty: number, price?: number) => {
    setScannedProducts((prev) => {
      if (!prev.some((p) => p.id === product.id)) {
        return [...prev, product];
      }
      return prev;
    });

    setForm((current) => {
      const newItems = [...current.items];

      // Ưu tiên giá trị price truyền vào, nếu không có thì lấy purchasePrice từ product, nếu không thì mặc định là '0'
      let defaultPrice = price !== undefined ? String(price) : (product.purchasePrice !== undefined ? String(product.purchasePrice) : '0');

      // Nếu defaultPrice vẫn là 0, thử tìm trong supplierProducts hoặc existing order details
      if (defaultPrice === '0') {
        const selectedProduct = supplierProducts.find((item) => item.product?.id === product.id);
        if (selectedProduct) {
          defaultPrice = String(parseMoney(selectedProduct.purchasePrice));
        } else {
          const existingDetail = selectedOrder?.details?.find(d => d.product?.id === product.id);
          if (existingDetail) {
            defaultPrice = String(existingDetail.unitPrice || 0);
          }
        }
      }

      // Nếu dòng cuối cùng đang trống (chưa chọn sản phẩm), thì ghi đè lên dòng đó
      const lastIndex = newItems.length - 1;
      if (lastIndex >= 0 && !newItems[lastIndex].productId && Number(newItems[lastIndex].expectedQty) === 1) {
        newItems[lastIndex] = {
          ...newItems[lastIndex],
          productId: product.id,
          expectedQty: qty.toString(),
          unitPrice: defaultPrice, // CHỈNH SỬA: Đảm bảo cập nhật đơn giá cho dòng ghi đè
          warehouseCode: product.stockBalances?.length > 0 ? product.stockBalances[0].locationCode : current.warehouseCode || 'KHO-NVL',
        };
      } else {
        // Tìm xem sản phẩm đã có trong danh sách chưa, nếu có tăng số lượng
        const existingIndex = newItems.findIndex((d) => d.productId === product.id);
        if (existingIndex >= 0) {
          const currentQty = Number(newItems[existingIndex].expectedQty) || 0;
          newItems[existingIndex].expectedQty = (currentQty + qty).toString();
          // Cập nhật giá luôn nếu có giá mới hoặc chưa có giá
          if (price !== undefined || product.purchasePrice !== undefined || Number(newItems[existingIndex].unitPrice) === 0) {
            newItems[existingIndex].unitPrice = defaultPrice;
          }
        } else {
          // Thêm dòng mới
          newItems.push({
            rowId: `${Date.now()}-${Math.random()}`,
            productId: product.id,
            expectedQty: qty.toString(),
            receivedQty: '0',
            unitPrice: defaultPrice,
            warehouseCode: product.stockBalances?.length > 0 ? product.stockBalances[0].locationCode : current.warehouseCode || 'KHO-NVL',
          });
        }
      }
      return { ...current, items: newItems };
    });
    setToast({ type: 'success', message: `Đã thêm ${product.name} (SL: ${qty})` });
  }, [supplierProducts, selectedOrder]);

  React.useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [ordersResponse, suppliersResponse, warehousesResponse, usersResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/inbound/purchase-orders`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/suppliers`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/warehouses`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/users`, { headers: authHeaders() }),
      ]);

      if (!ordersResponse.ok) {
        const data = await ordersResponse.json().catch(() => null);
        throw new Error(data?.message || 'Không tải được danh sách đơn mua hàng');
      }

      const ordersData = (await ordersResponse.json()) as PurchaseOrder[];
      setOrders(ordersData);

      if (suppliersResponse.ok) {
        setSuppliers((await suppliersResponse.json()) as Supplier[]);
      }
      if (warehousesResponse && warehousesResponse.ok) {
        const warehouseData = await warehousesResponse.json();
        const normalizedWarehouses: WarehouseRecord[] = Array.isArray(warehouseData)
          ? warehouseData.map((warehouse: any) => normalizeWarehouseRecord({
            id: String(warehouse.id ?? warehouse.code ?? ''),
            code: String(warehouse.code ?? warehouse.id ?? ''),
            name: String(warehouse.name ?? warehouse.code ?? warehouse.id ?? ''),
            address: String(warehouse.address ?? ''),
            status: warehouse.status === 'inactive' ? 'inactive' : 'active',
            managerIds: warehouse.managerIds,
            staffIds: warehouse.staffIds,
          }))
          : [];
        const fallbackWarehouses = getStoredWarehouses();
        const nextWarehouses = normalizedWarehouses.length > 0
          ? mergeStoredWarehouses(normalizedWarehouses, fallbackWarehouses)
          : fallbackWarehouses;
        setWarehouses(nextWarehouses);
        if (normalizedWarehouses.length > 0) {
          saveStoredWarehouses(nextWarehouses);
        }
      }
      if (usersResponse && usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(
          Array.isArray(usersData)
            ? usersData.map((user: any) => ({
              id: String(user.id ?? user._id ?? ''),
              email: String(user.email ?? ''),
              fullName: String(user.fullName ?? user.name ?? ''),
              roles: Array.isArray(user.roles)
                ? user.roles.map((role: any) => ({ name: String(role?.name ?? role ?? '') }))
                : [],
            }))
            : [],
        );
      }
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi tải dữ liệu đơn mua hàng' });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    const syncWarehouses = () => setWarehouses(getStoredWarehouses());
    window.addEventListener('storage', syncWarehouses);
    return () => window.removeEventListener('storage', syncWarehouses);
  }, []);

  // selectedOrder moved to top

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, timeFilter, advancedFilters]);

  const filteredOrders = React.useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const now = new Date();

    return orders.filter((order) => {
      // 1. Keyword search
      const matchesKeyword =
        !keyword ||
        order.poNumber.toLowerCase().includes(keyword) ||
        (order.supplier?.name || order.supplierName || '').toLowerCase().includes(keyword) ||
        order.description?.toLowerCase().includes(keyword) ||
        (order.details || []).some((detail) => detail.product?.name.toLowerCase().includes(keyword));

      // 2. Status filter
      const matchesStatus = statusFilter === 'all' || statusToFilter(order.status) === statusFilter;

      // 3. Simple Time Filter
      let matchesTime = true;
      const orderDateObj = order.orderDate ? new Date(order.orderDate) : null;

      if (timeFilter !== 'all') {
        if (!orderDateObj || Number.isNaN(orderDateObj.getTime())) {
          matchesTime = false;
        } else if (timeFilter === 'this-month') {
          matchesTime = orderDateObj.getFullYear() === now.getFullYear() && orderDateObj.getMonth() === now.getMonth();
        } else if (timeFilter === '7-days') {
          matchesTime = now.getTime() - orderDateObj.getTime() <= 7 * 24 * 60 * 60 * 1000;
        }
      }

      // 4. Advanced Filters
      let matchesAdvStartDate = true;
      let matchesAdvEndDate = true;
      let matchesAdvSupplier = true;
      let matchesAdvMinAmt = true;
      let matchesAdvMaxAmt = true;

      if (advancedFilters.startDate && orderDateObj) {
        const start = new Date(advancedFilters.startDate);
        start.setHours(0, 0, 0, 0);
        if (orderDateObj < start) matchesAdvStartDate = false;
      }
      if (advancedFilters.endDate && orderDateObj) {
        const end = new Date(advancedFilters.endDate);
        end.setHours(23, 59, 59, 999);
        if (orderDateObj > end) matchesAdvEndDate = false;
      }
      if (advancedFilters.supplierId) {
        matchesAdvSupplier = order.supplier?.id === advancedFilters.supplierId;
      }
      if (advancedFilters.minAmount) {
        matchesAdvMinAmt = order.totalAmount >= Number(advancedFilters.minAmount);
      }
      if (advancedFilters.maxAmount) {
        matchesAdvMaxAmt = order.totalAmount <= Number(advancedFilters.maxAmount);
      }

      return matchesKeyword && matchesStatus && matchesTime && matchesAdvStartDate && matchesAdvEndDate && matchesAdvSupplier && matchesAdvMinAmt && matchesAdvMaxAmt;
    }).sort((a, b) => {
      const dateA = new Date((a as any).createdAt || a.orderDate || 0).getTime();
      const dateB = new Date((b as any).createdAt || b.orderDate || 0).getTime();
      // Secondary sort by ID desc if dates are identical
      if (dateB === dateA) {
        return (b.id || '').localeCompare(a.id || '');
      }
      return dateB - dateA;
    });
  }, [orders, search, statusFilter, timeFilter, advancedFilters]);

  const totalItems = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const draftCount = orders.filter((order) => statusToFilter(order.status) === 'waiting').length;
  const approvedCount = orders.filter((order) => statusToFilter(order.status) === 'approved').length;
  const completedCount = orders.filter((order) => statusToFilter(order.status) === 'done').length;

  const accessibleWarehouses = React.useMemo(
    () => getWarehouseOptionsForUser(currentUserId, warehouses),
    [currentUserId, warehouses],
  );
  const selectedWarehouseRecord = React.useMemo(
    () =>
      warehouses.find(
        (warehouse) => warehouse.code === form.warehouseCode || warehouse.id === form.warehouseCode,
      ) || null,
    [warehouses, form.warehouseCode],
  );
  const warehouseOptions = React.useMemo(() => {
    if (!form.warehouseCode) {
      return accessibleWarehouses;
    }

    const selectedExists = accessibleWarehouses.some(
      (warehouse) => warehouse.code === form.warehouseCode || warehouse.id === form.warehouseCode,
    );

    if (selectedExists) {
      return accessibleWarehouses;
    }

    return selectedWarehouseRecord ? [selectedWarehouseRecord, ...accessibleWarehouses] : accessibleWarehouses;
  }, [accessibleWarehouses, form.warehouseCode, selectedWarehouseRecord]);
  const approverOptions = React.useMemo(
    () => getApproversForWarehouse(selectedWarehouseRecord, users),
    [selectedWarehouseRecord, users],
  );

  React.useEffect(() => {
    if (modalMode !== 'create' && modalMode !== 'edit') return;
    if (!form.warehouseCode) {
      if (form.approverId) {
        setForm((current) => ({ ...current, approverId: '' }));
      }
      return;
    }

    const nextApproverId = approverOptions.some((user) => user.id === form.approverId)
      ? form.approverId
      : approverOptions[0]?.id || '';

    if (nextApproverId !== form.approverId) {
      setForm((current) => ({ ...current, approverId: nextApproverId }));
    }
  }, [approverOptions, form.approverId, form.warehouseCode, modalMode]);

  // Moved supplierProducts and selectedOrder to top
  const openCreate = async () => {
    const fallbackSupplier = suppliers[0]?.id || '';
    const defaultWarehouse = accessibleWarehouses[0]?.code || accessibleWarehouses[0]?.id || '';
    if (!defaultWarehouse) {
      setToast({ type: 'error', message: 'Bạn chưa được gán kho nào để tạo đơn mua hàng.' });
      return;
    }
    const token = localStorage.getItem('token') || '';
    const payload = parseJwtPayload(token);
    const creatorName = getUserDisplayName(payload);
    let creatorPhone = getUserPhone(payload);
    
    try {
      const response = await fetch(`${API_BASE_URL}/profile`, { headers: authHeaders() });
      if (response.ok) {
        const profile = await response.json();
        if (profile?.phone) {
          creatorPhone = profile.phone;
        }
      }
    } catch (e) {
      console.error('Failed to fetch profile', e);
    }
    
    setForm(buildEmptyForm(fallbackSupplier, defaultWarehouse));
    setForm((current) => ({ ...current, creatorName, creatorPhone, warehouseCode: defaultWarehouse }));
    setModalMode('create');
  };

  const openEdit = async (order: PurchaseOrder) => {
    setSelectedId(order.id);
    setSelectedOrderDetails(null);
    setModalMode('edit');

    try {
      const response = await fetch(`${API_BASE_URL}/inbound/purchase-orders/${order.id}`, {
        headers: authHeaders(),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không tải được chi tiết đơn mua hàng');
      }
      const full = (await response.json()) as PurchaseOrder;
      setSelectedOrderDetails(full);

      // Đưa các sản phẩm từ order details vào scannedProducts
      // để dropdown luôn hiển thị đúng (kể cả khi sản phẩm không thuộc NCC đã chọn)
      const detailProducts: ScannedProduct[] = (full.details || [])
        .filter((d) => d.product?.id)
        .map((d) => ({
          id: d.product!.id,
          internalSku: d.product!.internalSku || '',
          name: d.product!.name || '',
          unit: d.product!.unit,
          minimumStock: 0,
          category: null,
          supplier: full.supplier ? { id: full.supplier.id, name: full.supplier.name } : null,
          stockBalances: [],
          totalStock: 0,
        }));
      setScannedProducts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newProducts = detailProducts.filter((p) => !existingIds.has(p.id));
        return [...prev, ...newProducts];
      });

      setForm({
        poNumber: full.poNumber,
        supplierId: full.supplier?.id || '',
        orderDate: full.orderDate ? parseDateForInput(full.orderDate) : toLocalDatetimeString(new Date()),
        expectedDate: full.expectedDate ? parseDateForInput(full.expectedDate) : toLocalDatetimeString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        status: (full.status?.toUpperCase() as OrderStatus) || 'CREATED',
        description: full.description || '',
        items:
          full.details?.length
            ? full.details.map((detail) => ({
              id: detail.id,
              rowId: `${detail.id}-${Date.now()}`,
              productId: detail.product?.id || '',
              warehouseCode: detail.warehouseCode || 'KHO-NVL',
              expectedQty: String(detail.expectedQty || 0),
              receivedQty: String(detail.receivedQty || 0),
              unitPrice: String(detail.unitPrice || 0),
            }))
            : [makeRow((full as any).warehouseCode || accessibleWarehouses[0]?.code || 'KHO-NVL')],
        creatorName: (full as any).creatorName || '',
        creatorPhone: (full as any).creatorPhone || '',
        warehouseCode: (full as any).warehouseCode || accessibleWarehouses[0]?.code || '',
        approverId: (full as any).approverId || '',
      });
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi tải chi tiết đơn hàng' });
    }
  };
  const openView = async (order: PurchaseOrder) => {
    setSelectedId(order.id);
    setSelectedOrderDetails(null);
    setModalMode('view');

    try {
      const response = await fetch(`${API_BASE_URL}/inbound/purchase-orders/${order.id}`, {
        headers: authHeaders(),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không tải được chi tiết đơn mua hàng');
      }
      const full = (await response.json()) as PurchaseOrder;
      setSelectedOrderDetails(full);

      // Đưa các sản phẩm từ order details vào scannedProducts
      const detailProducts: ScannedProduct[] = (full.details || [])
        .filter((d) => d.product?.id)
        .map((d) => ({
          id: d.product!.id,
          internalSku: d.product!.internalSku || '',
          name: d.product!.name || '',
          unit: d.product!.unit,
          minimumStock: 0,
          category: null,
          supplier: full.supplier ? { id: full.supplier.id, name: full.supplier.name } : null,
          stockBalances: [],
          totalStock: 0,
        }));
      setScannedProducts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newProducts = detailProducts.filter((p) => !existingIds.has(p.id));
        return [...prev, ...newProducts];
      });

      setForm({
        poNumber: full.poNumber,
        supplierId: full.supplier?.id || '',
        orderDate: full.orderDate ? parseDateForInput(full.orderDate) : toLocalDatetimeString(new Date()),
        expectedDate: full.expectedDate ? parseDateForInput(full.expectedDate) : toLocalDatetimeString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        status: (full.status?.toUpperCase() as OrderStatus) || 'CREATED',
        description: full.description || '',
        items:
          full.details?.length
            ? full.details.map((detail) => ({
              id: detail.id,
              rowId: `${detail.id}-${Date.now()}`,
              productId: detail.product?.id || '',
              warehouseCode: detail.warehouseCode || 'KHO-NVL',
              expectedQty: String(detail.expectedQty || 0),
              receivedQty: String(detail.receivedQty || 0),
              unitPrice: String(detail.unitPrice || 0),
            }))
            : [makeRow((full as any).warehouseCode || accessibleWarehouses[0]?.code || 'KHO-NVL')],
        creatorName: (full as any).creatorName || '',
        creatorPhone: (full as any).creatorPhone || '',
        warehouseCode: (full as any).warehouseCode || accessibleWarehouses[0]?.code || '',
        approverId: (full as any).approverId || '',
      });
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi tải chi tiết đơn hàng' });
    }
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedOrderDetails(null);
    setDeleteTarget(null);
    setSaving(false);
  };

  const buildPayload = () => {
    const items = form.items
      .filter((item) => item.productId && Number(item.expectedQty) > 0)
      .map((item) => ({
        id: item.id,
        productId: item.productId,
        warehouseCode: item.warehouseCode.trim() || undefined,
        expectedQty: Number(item.expectedQty || 0),
        receivedQty: Number(item.receivedQty || 0),
        unitPrice: Number(item.unitPrice || 0),
      }));

    const payload: any = {
      poNumber: form.poNumber.trim() || undefined,
      supplierId: form.supplierId,
      orderDate: form.orderDate,
      expectedDate: form.expectedDate,
      status: form.status,
      description: form.description.trim() || undefined,
      creatorName: form.creatorName || undefined,
      creatorPhone: form.creatorPhone || undefined,
      warehouseCode: form.warehouseCode || undefined,
      approverId: form.approverId || undefined,
      approverName: users.find((u) => u.id === form.approverId)?.fullName || undefined,
    };

    // For create, always include items. For edit, include items only when there are valid lines to avoid wiping existing lines unintentionally.
    if (modalMode === 'edit') {
      if (items.length) payload.items = items;
    } else {
      payload.items = items;
    }

    return payload;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form.items.length === 0) {
      setToast({ type: 'error', message: 'Vui lòng thêm ít nhất một dòng hàng.' });
      return;
    }

    const selectedWarehouse = warehouses.find(
      (warehouse) => warehouse.code === form.warehouseCode || warehouse.id === form.warehouseCode,
    );
    if (!selectedWarehouse) {
      setToast({ type: 'error', message: 'Vui lòng chọn kho hợp lệ.' });
      return;
    }

    const canUseWarehouse = accessibleWarehouses.some(
      (warehouse) => warehouse.code === form.warehouseCode || warehouse.id === form.warehouseCode,
    );
    if (modalMode === 'create' && !canUseWarehouse) {
      setToast({ type: 'error', message: 'Bạn chỉ có thể tạo đơn với kho được gán cho mình.' });
      return;
    }

    const approverIsValid = approverOptions.some((user) => user.id === form.approverId);
    if (approverOptions.length > 0 && !approverIsValid) {
      setToast({ type: 'error', message: 'Vui lòng chọn người duyệt là quản lý của kho đã chọn.' });
      return;
    }

    const payload = buildPayload();
    if (!payload.items || !payload.items.length) {
      setToast({ type: 'error', message: 'Mỗi đơn mua hàng cần ít nhất một mặt hàng hợp lệ.' });
      return;
    }

    setSaving(true);
    try {
      const isEdit = modalMode === 'edit';
      const url = isEdit && selectedOrder ? `${API_BASE_URL}/inbound/purchase-orders/${selectedOrder.id}` : `${API_BASE_URL}/inbound/purchase-orders`;
      const response = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || (isEdit ? 'Không cập nhật được đơn mua hàng' : 'Không tạo được đơn mua hàng'));
      }

      setToast({ type: 'success', message: isEdit ? 'Đã cập nhật đơn mua hàng.' : 'Đã tạo đơn mua hàng mới.' });
      closeModal();
      await loadData();
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi lưu đơn mua hàng' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/inbound/purchase-orders/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không xóa được đơn mua hàng');
      }
      setToast({ type: 'success', message: 'Đã xóa đơn mua hàng.' });
      closeModal();
      await loadData();
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi xóa đơn mua hàng' });
    } finally {
      setSaving(false);
    }
  };

  const approveOrder = async (order: PurchaseOrder) => {
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/inbound/purchase-orders/${order.id}/approve`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không duyệt được đơn mua hàng');
      }
      setToast({ type: 'success', message: 'Đã duyệt đơn mua hàng.' });
      await loadData();
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi duyệt đơn' });
    } finally {
      setSaving(false);
    }
  };

  const completeOrder = async (order: PurchaseOrder) => {
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/inbound/purchase-orders/${order.id}/complete`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không hoàn thành được đơn mua hàng');
      }
      setToast({ type: 'success', message: 'Đã hoàn thành đơn mua hàng.' });
      await loadData();
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi hoàn thành đơn' });
    } finally {
      setSaving(false);
    }
  };

  const submitDraftOrder = async (order: PurchaseOrder) => {
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/inbound/purchase-orders/${order.id}`, {
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error('Không tải được chi tiết đơn hàng');
      const full = await response.json();
      
      const payload: any = {
        poNumber: full.poNumber,
        supplierId: full.supplier?.id,
        orderDate: full.orderDate,
        expectedDate: full.expectedDate,
        status: 'CREATED',
        description: full.description,
        creatorName: (full as any).creatorName,
        creatorPhone: (full as any).creatorPhone,
        warehouseCode: (full as any).warehouseCode,
        approverId: (full as any).approverId,
      };

      if (full.details?.length > 0) {
        payload.items = full.details.map((item: any) => ({
          id: item.id,
          productId: item.product?.id,
          warehouseCode: item.warehouseCode || 'KHO-NVL',
          expectedQty: item.expectedQty,
          receivedQty: item.receivedQty,
          unitPrice: item.unitPrice,
        }));
      } else {
        payload.items = [];
      }

      const putRes = await fetch(`${API_BASE_URL}/inbound/purchase-orders/${order.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });

      if (!putRes.ok) {
        const errData = await putRes.json().catch(() => null);
        let msg = 'Không thể gửi duyệt đơn hàng';
        if (errData && errData.message) {
          msg = Array.isArray(errData.message) ? errData.message.join(', ') : errData.message;
        }
        throw new Error(msg);
      }
      setToast({ type: 'success', message: 'Đã tạo mới/gửi duyệt đơn hàng thành công.' });
      await loadData();
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi gửi duyệt' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateStockInReceipt = async (status: 'DRAFT' | 'POSTED') => {
    if (!selectedOrder) return;
    if (selectedStaffIds.length === 0) {
      setToast({ type: 'error', message: 'Vui lòng chọn ít nhất một nhân viên kiểm kê.' });
      return;
    }
    setSaving(true);
    try {
      const items = form.items.map((item: any) => ({
        productId: item.productId,
        warehouseCode: item.warehouseCode || form.warehouseCode || 'KHO-NVL',
        orderedQty: Number(item.expectedQty) || 0,
        receivedQty: Number(item.receivedQty) || 0,
        quantity: item.inventoryQty !== undefined ? Number(item.inventoryQty) : (Number(item.expectedQty) || 0),
        unitPrice: Number(item.unitPrice) || 0,
      }));

      const res = await fetch(`${API_BASE_URL}/inbound/stock-in-receipts`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          poNumber: receiptCode || undefined,
          status: status,
          receiptType: 'PURCHASE_GOODS',
          warehouseCode: form.warehouseCode || 'KHO-NVL',
          supplierId: selectedOrder.supplier?.id,
          sourceReferenceNo: selectedOrder.poNumber,
          receiptDate: new Date(receiptDate).toISOString(),
          description: stockInNote,
          assignedStaffIds: selectedStaffIds,
          items,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Không tạo được lệnh nhập kho');
      }
      setToast({ type: 'success', message: status === 'DRAFT' ? 'Đã lưu nháp lệnh nhập kho thành công.' : 'Đã tạo lệnh nhập kho và giao việc thành công.' });
      closeModal();
      await loadData();
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi lập lệnh nhập kho' });
    } finally {
      setSaving(false);
    }
  };

  const openCreateStockIn = async (order: PurchaseOrder) => {
    try {
      const res = await fetch(`${API_BASE_URL}/inbound/stock-in-receipts`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.data || [];
        const matching = list.filter((o: any) => o.sourceReferenceNo === order.poNumber);
        if (matching.length > 0) {
          setDuplicateReceipts(matching);
          setPendingOrderForStockIn(order);
          return;
        }
      }
    } catch (e) {
      console.error(e);
    }
    proceedWithCreateStockIn(order);
  };

  const proceedWithCreateStockIn = async (order: PurchaseOrder) => {
    setSelectedId(order.id);
    setSelectedOrderDetails(null);
    setReceiptCode('');
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/inbound/purchase-orders/${order.id}`, {
        headers: authHeaders(),
      });
      if (!response.ok) {
        throw new Error('Không tải được chi tiết đơn mua hàng');
      }
      const full = (await response.json()) as PurchaseOrder;
      setSelectedOrderDetails(full);
      
      const detailProducts: ScannedProduct[] = (full.details || [])
        .filter((d) => d.product?.id)
        .map((d) => ({
          id: d.product!.id,
          internalSku: d.product!.internalSku || '',
          name: d.product!.name || '',
          unit: d.product!.unit,
          minimumStock: 0,
          category: null,
          supplier: full.supplier ? { id: full.supplier.id, name: full.supplier.name } : null,
          stockBalances: [],
          totalStock: 0,
        }));
      setScannedProducts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newProducts = detailProducts.filter((p) => !existingIds.has(p.id));
        return [...prev, ...newProducts];
      });

      setForm({
        poNumber: full.poNumber,
        supplierId: full.supplier?.id || '',
        orderDate: full.orderDate ? parseDateForInput(full.orderDate) : toLocalDatetimeString(new Date()),
        expectedDate: full.expectedDate ? parseDateForInput(full.expectedDate) : toLocalDatetimeString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        status: (full.status?.toUpperCase() as OrderStatus) || 'CREATED',
        description: full.description || '',
        items: full.details?.length
          ? full.details.map((detail) => ({
              id: detail.id,
              rowId: `${detail.id}-${Date.now()}`,
              productId: detail.product?.id || '',
              warehouseCode: detail.warehouseCode || 'KHO-NVL',
              expectedQty: String(detail.expectedQty || 0),
              receivedQty: String(detail.receivedQty || 0),
              inventoryQty: String(Math.max((detail.expectedQty || 0) - (detail.receivedQty || 0), 0)),
              unitPrice: String(detail.unitPrice || 0),
            }))
          : [makeRow((full as any).warehouseCode || accessibleWarehouses[0]?.code || 'KHO-NVL')],
        creatorName: (full as any).creatorName || '',
        creatorPhone: (full as any).creatorPhone || '',
        warehouseCode: (full as any).warehouseCode || accessibleWarehouses[0]?.code || '',
        approverId: (full as any).approverId || '',
      });
      
      setModalMode('create_order' as any);
      setReceiptDate(new Date().toISOString().slice(0, 16));
      setSelectedStaffIds([]);
      setStockInNote('');
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi tải dữ liệu' });
    } finally {
      setSaving(false);
    }
  };

  const openReceive = (order: PurchaseOrder) => {
    setSelectedId(order.id);
    setReceiveRows(
      (order.details || []).map((detail) => ({
        detailId: detail.id,
        sku: detail.product?.internalSku || '-',
        label: detail.product?.name || '-',
        expectedQty: detail.expectedQty || 0,
        receivedQty: detail.receivedQty || 0,
        unitPrice: detail.unitPrice || 0,
        qty: String(Math.max((detail.expectedQty || 0) - (detail.receivedQty || 0), 0)),
      })),
    );
    setReceiveOpen(true);
  };

  const saveReceive = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    try {
      const payload = {
        items: receiveRows
          .map((row) => ({ detailId: row.detailId, qty: Number(row.qty || 0) }))
          .filter((row) => row.qty > 0),
      };

      if (payload.items.length === 0) {
        setToast({ type: 'error', message: 'Vui lòng nhập ít nhất một số lượng nhận hợp lệ.' });
        setSaving(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/inbound/purchase-orders/details/${payload.items[0].detailId}/receive`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ items: payload.items }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không lưu được số lượng nhận hàng');
      }

      setToast({ type: 'success', message: 'Đã cập nhật số lượng nhận hàng.' });
      setReceiveOpen(false);
      await loadData();
      if (selectedId) {
        try {
          const res = await fetch(`${API_BASE_URL}/inbound/purchase-orders/${selectedId}`, { headers: authHeaders() });
          if (res.ok) setSelectedOrderDetails(await res.json());
        } catch (e) {
          console.error(e);
        }
      }
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi nhận hàng' });
    } finally {
      setSaving(false);
    }
  };

  const selectedOrderMetrics = selectedOrder
    ? {
        lines: selectedOrder.details?.length || 0,
        ordered: (selectedOrder.details || []).reduce((sum, line) => sum + Number(line.expectedQty || 0), 0),
        received: (selectedOrder.details || []).reduce((sum, line) => sum + Number(line.receivedQty || 0), 0),
      }
    : {
        lines: 0,
        ordered: 0,
        received: 0,
      };

  const token = localStorage.getItem('token') || '';
  const payload = parseJwtPayload(token);
  const storedUser = getStoredUser();
  let currentUserIsManager = false;
  if (storedUser) {
    if (storedUser.role && String(storedUser.role).toLowerCase() === 'manager') {
      currentUserIsManager = true;
    } else if (Array.isArray(storedUser.roles)) {
      currentUserIsManager = storedUser.roles.some((r: any) => String(r?.name || r).toLowerCase() === 'manager');
    }
  }

  const selectedOrderStatus = (selectedOrder?.status || 'CREATED').toUpperCase();
  const canManagerApprove = selectedOrderStatus === 'CREATED' && currentUserIsManager;
  
  const canReceiveRow = (order: PurchaseOrder) => ['SUPPLIER_APPROVED', 'PARTIALLY_RECEIVED'].includes((order.status || 'CREATED').toUpperCase());
  const canCreateOrderRow = (order: PurchaseOrder) => ['SUPPLIER_APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED'].includes((order.status || 'CREATED').toUpperCase());
  const canCreateReceiptRow = (order: PurchaseOrder) => ['PARTIALLY_RECEIVED', 'RECEIVED'].includes((order.status || 'CREATED').toUpperCase());

  const canApproveRow = (order: PurchaseOrder) => {
    return (order.status || 'CREATED').toUpperCase() === 'CREATED' && currentUserIsManager;
  };

  const canDelete = (order: PurchaseOrder) => {
    const s = statusToFilter(order.status);
    return s === 'waiting' || s === 'cancelled';
  };

  const addRow = () => {
    setForm((current) => ({ ...current, items: [...current.items, makeRow(current.warehouseCode || accessibleWarehouses[0]?.code || 'KHO-NVL')] }));
  };

  const updateRow = (rowId: string, patch: Partial<FormLine>) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.rowId === rowId ? { ...item, ...patch } : item)),
    }));
  };

  const removeRow = (rowId: string) => {
    setForm((current) => ({
      ...current,
      items: current.items.length > 1 ? current.items.filter((item) => item.rowId !== rowId) : [makeRow(current.warehouseCode || accessibleWarehouses[0]?.code || 'KHO-NVL')],
    }));
  };

  const onProductChange = (rowId: string, productId: string) => {
    const selectedProduct = supplierProducts.find((item) => item.product?.id === productId);
    let price = '0';
    if (selectedProduct) {
      price = String(parseMoney(selectedProduct.purchasePrice));
    } else {
      const scannedProduct = scannedProducts.find(p => p.id === productId);
      if (scannedProduct && scannedProduct.purchasePrice !== undefined) {
        price = String(scannedProduct.purchasePrice);
      } else {
        const existingDetail = selectedOrder?.details?.find(d => d.product?.id === productId);
        if (existingDetail) {
          price = String(existingDetail.unitPrice || 0);
        }
      }
    }

    updateRow(rowId, {
      productId,
      unitPrice: price,
    });
  };

  const addDefaultProduct = () => {
    const firstProduct = supplierProducts[0]?.product?.id || '';
    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          ...makeRow(current.warehouseCode || accessibleWarehouses[0]?.code || 'KHO-NVL'),
          productId: firstProduct,
          unitPrice: supplierProducts[0] ? String(parseMoney(supplierProducts[0].purchasePrice)) : '0',
        },
      ],
    }));
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setTimeFilter('this-month');
    setAdvancedFilters({
      startDate: '',
      endDate: '',
      supplierId: '',
      minAmount: '',
      maxAmount: '',
    });
  }

  React.useEffect(() => {
    if (modalMode === 'create' && form.supplierId && form.items.length === 1 && !form.items[0].productId && supplierProducts[0]?.product?.id) {
      setForm((current) => ({
        ...current,
        items: [
          {
            ...current.items[0],
            productId: supplierProducts[0].product!.id,
            unitPrice: String(parseMoney(supplierProducts[0].purchasePrice)),
          },
        ],
      }));
    }
  }, [form.items, form.supplierId, modalMode, supplierProducts]);

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed right-4 top-4 z-[70] flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-xl ${toast.type === 'error' ? 'border-red-200 text-red-600' : 'border-emerald-200 text-emerald-600'}`}>
          <p className="text-sm font-bold">{toast.message}</p>
          <button type="button" onClick={() => setToast(null)} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Đơn mua hàng</h1>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700"
        >
          <PlusCircle className="h-4 w-4" />
          Tạo đơn mua hàng
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-[#4295b4] px-4 shadow-sm">
          <p className="text-lg font-bold text-white uppercase">{orders.length} TỔNG PO</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-[#4295b4] px-4 shadow-sm">
          <p className="text-lg font-bold text-white uppercase">{draftCount} CHỜ DUYỆT</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-[#4295b4] px-4 shadow-sm">
          <p className="text-lg font-bold text-white uppercase">{approvedCount} ĐÃ DUYỆT</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-[#4295b4] px-4 shadow-sm">
          <p className="text-lg font-bold text-white uppercase">{completedCount} HOÀN THÀNH</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white pl-11 pr-4 text-sm font-medium outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
            placeholder="Tìm theo số đơn, nhà cung cấp, diễn giải, mặt hàng..."
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={timeFilter}
            onChange={(event) => setTimeFilter(event.target.value as TimeFilter)}
            className="h-11 min-w-[200px] rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
          >
            <option value="this-month">Thời gian: Tháng này</option>
            <option value="7-days">Thời gian: 7 ngày gần đây</option>
            <option value="all">Thời gian: Tất cả</option>
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="h-11 min-w-[200px] rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
          >
            <option value="all">Tình trạng: Tất cả</option>
            <option value="waiting">Tình trạng: Chờ duyệt</option>
            <option value="approved">Tình trạng: Đã duyệt</option>
            <option value="partial">Tình trạng: Nhận một phần</option>
            <option value="done">Tình trạng: Hoàn thành</option>
            <option value="cancelled">Tình trạng: Đã hủy</option>
          </select>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 shadow-sm"
            title="Đặt lại bộ lọc"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border-2 transition shadow-sm ${showAdvancedFilters ? 'border-cyan-500 bg-cyan-50 text-cyan-600' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            title="Tìm kiếm chuyên sâu"
          >
            <Filter className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showAdvancedFilters && (
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-cyan-200 bg-cyan-50/30 p-4 shadow-sm md:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Ngày bắt đầu"
            type="date"
            value={advancedFilters.startDate}
            onChange={(value) => setAdvancedFilters(cur => ({ ...cur, startDate: value }))}
          />
          <Input
            label="Ngày kết thúc"
            type="date"
            value={advancedFilters.endDate}
            onChange={(value) => setAdvancedFilters(cur => ({ ...cur, endDate: value }))}
          />
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">Nhà cung cấp</label>
            <select
              value={advancedFilters.supplierId}
              onChange={(e) => setAdvancedFilters(cur => ({ ...cur, supplierId: e.target.value }))}
              className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
            >
              <option value="">Tất cả nhà cung cấp</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                label="Tổng tiền từ"
                type="number"
                value={advancedFilters.minAmount}
                onChange={(value) => setAdvancedFilters(cur => ({ ...cur, minAmount: value }))}
                placeholder="VD: 100000"
              />
            </div>
            <div className="flex-1">
              <Input
                label="Tổng tiền đến"
                type="number"
                value={advancedFilters.maxAmount}
                onChange={(value) => setAdvancedFilters(cur => ({ ...cur, maxAmount: value }))}
                placeholder="VD: 5000000"
              />
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] border-collapse bg-white">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="w-12 border-x border-slate-200 px-3 py-4 text-center align-middle">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600" />
                </th>
                <th className="w-16 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">STT</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Số đơn hàng</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Người đặt</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Ngày tạo đơn</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Nhà cung cấp</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Diễn giải</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Tổng tiền</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Tình trạng</th>
                <th className="sticky right-0 w-40 border-l border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm font-black uppercase text-slate-700 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Đang tải danh sách đơn mua hàng...
                  </td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Chưa có đơn mua hàng phù hợp.
                  </td>
                </tr>
              ) : (
                <>
                  {paginatedOrders.map((order, index) => (
                  <tr
                    key={order.id}
                    className="group border-b border-slate-200 transition hover:bg-cyan-50/50"
                  >
                    <td className="border-x border-slate-200 px-3 py-4 text-center align-middle" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600" />
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{startIndex + index}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{order.poNumber}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">
                      {(order as any).creatorName || '-'}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">
                      {new Date((order as any).createdAt || order.orderDate).toLocaleString('vi-VN')}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">
                      {order.supplier?.name || order.supplierName || order.supplier?.supplierCode || '-'}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{order.description || '-'}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{formatMoney(order.totalAmount)}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                      <span className={`inline-flex rounded-lg border px-3 py-1 text-xs font-bold ${statusClass(order.status)}`}>
                        {statusLabel(order.status)}
                      </span>
                    </td>
                    <td className={`sticky right-0 border-l border-slate-200 bg-white px-3 py-4 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50 ${activeDropdown === order.id ? 'z-[60]' : 'z-10'}`}>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openView(order);
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100 hover:text-cyan-700"
                          title="Xem"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (order.status !== 'DRAFT') return;
                            openEdit(order);
                          }}
                          disabled={order.status !== 'DRAFT'}
                          className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${order.status === 'DRAFT' ? 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100 hover:text-cyan-700' : 'bg-slate-50 text-slate-300 cursor-not-allowed'}`}
                          title="Sửa"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (!canDelete(order)) return;
                            setDeleteTarget(order);
                            setModalMode('delete');
                          }}
                          disabled={!canDelete(order)}
                          className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${canDelete(order) ? 'bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700' : 'bg-slate-50 text-slate-300 cursor-not-allowed'}`}
                          title="Xóa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setActiveDropdown(activeDropdown === order.id ? null : order.id)}
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800"
                            title="Thao tác khác"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {activeDropdown === order.id && (
                            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden py-1 text-left">
                              <button
                                type="button"
                                disabled={order.status !== 'DRAFT'}
                                onClick={() => { submitDraftOrder(order); setActiveDropdown(null); }}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-cyan-50 disabled:opacity-40 disabled:hover:bg-white text-left"
                              >
                                <Send className="h-4 w-4" />
                                Gửi duyệt (Tạo mới)
                              </button>
                              <button
                                type="button"
                                disabled={!canApproveRow(order)}
                                onClick={() => { 
                                  if (window.confirm('Bạn có chắc chắn muốn duyệt đơn hàng này?')) {
                                    approveOrder(order); 
                                  }
                                  setActiveDropdown(null); 
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 disabled:hover:bg-white text-left"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Duyệt đơn hàng
                              </button>
                              <div className="my-1 border-t border-slate-100"></div>
                              <button
                                type="button"
                                disabled={!canReceiveRow(order)}
                                onClick={() => { 
                                  openReceive(order);
                                  setActiveDropdown(null); 
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 disabled:hover:bg-white text-left"
                              >
                                <Package className="h-4 w-4" />
                                Đã nhận hàng
                              </button>
                              <button
                                type="button"
                                disabled={!canCreateReceiptRow(order)}
                                onClick={() => { 
                                  navigate('/inbound/stock-in-orders', { state: { sourcePurchaseOrderId: order.id } });
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-50 disabled:opacity-40 disabled:hover:bg-white text-left"
                              >
                                <FileText className="h-4 w-4" />
                                Tạo phiếu nhập kho
                              </button>
                                <button
                                  type="button"
                                  disabled={!canCreateOrderRow(order)}
                                  onClick={() => {
                                    openCreateStockIn(order);
                                    setActiveDropdown(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-40 disabled:hover:bg-white text-left"
                                >
                                <Clock3 className="h-4 w-4" />
                                Tạo lệnh nhập kho
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
                {/* Spacer row to prevent overflow clipping of the dropdown */}
                {activeDropdown && (
                  <tr>
                    <td colSpan={10} className="p-0" style={{ height: '220px' }}></td>
                  </tr>
                )}
                </>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 bg-slate-50/50 px-6 py-3 sm:flex-row">
          <div className="text-sm text-slate-600">
            Tổng số: <b>{totalItems}</b>
            {totalItems > 0 && <span className="ml-2">Hiển thị {startIndex} - {endIndex}</span>}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-600">Số dòng/trang</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setCurrentPage(1);
              }}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {/* POPUP TẠO / SỬA / XEM */}
      <PurchaseOrderFormModal
        isOpen={modalMode === 'create' || modalMode === 'edit' || modalMode === 'view' || modalMode === ('create_order' as any)}
        mode={modalMode === 'create' ? 'create' : modalMode === 'view' ? 'view' : modalMode === ('create_order' as any) ? ('create_order' as any) : 'edit'}
        form={form}
        suppliers={suppliers}
        warehouses={warehouses}
        users={users}
        scannedProducts={scannedProducts}
        saving={saving}
        customActions={
          modalMode === ('create_order' as any) ? (
            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={() => handleCreateStockInReceipt('DRAFT')}
                disabled={saving || selectedStaffIds.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-amber-200 bg-amber-50 px-6 py-2.5 font-bold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60"
              >
                Lưu nháp
              </button>
              <button 
                type="button" 
                onClick={() => handleCreateStockInReceipt('POSTED')}
                disabled={saving || selectedStaffIds.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-600 px-8 py-2.5 font-bold text-white shadow-lg transition hover:bg-amber-700 disabled:opacity-60"
              >
                <Clock3 className="h-5 w-5" />
                {saving ? 'Đang tạo...' : 'Tạo mới & Giao việc'}
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              {canManagerApprove && (
                <button type="button" onClick={() => { closeModal(); approveOrder(selectedOrder!); }} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-transparent bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-cyan-700 disabled:opacity-60">
                  <CheckCircle2 className="h-4 w-4" />
                  Duyệt đơn hàng
                </button>
              )}
              {selectedOrder && canReceiveRow(selectedOrder) && (
                <button
                  type="button"
                  onClick={() => openReceive(selectedOrder)}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  <Package className="h-4 w-4" />
                  Đã nhận hàng
                </button>
              )}
              {selectedOrder && canCreateReceiptRow(selectedOrder) && (
                <button
                  type="button"
                  onClick={() => {
                    closeModal();
                    navigate('/inbound/stock-in-orders', { state: { sourcePurchaseOrderId: selectedOrder.id } });
                  }}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
                >
                  <FileText className="h-4 w-4" />
                  Tạo phiếu nhập kho
                </button>
              )}
              {selectedOrder && canCreateOrderRow(selectedOrder) && (
                <button
                  type="button"
                  onClick={() => openCreateStockIn(selectedOrder)}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-60"
                >
                  <Clock3 className="h-4 w-4" />
                  Tạo lệnh nhập kho
                </button>
              )}
            </div>
          )
        }
        renderRightPanel={
          modalMode === ('create_order' as any) && (
            <div className="flex flex-col h-full bg-white p-6 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-6">Tạo Lệnh Nhập Kho</h3>
              
              <div className="space-y-6 flex-1">
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                    <FileText className="h-4 w-4 text-cyan-600" />
                    Mã lệnh nhập kho (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={receiptCode}
                    onChange={(e) => setReceiptCode(e.target.value)}
                    placeholder="Bỏ trống để tự động tạo..."
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                    <Calendar className="h-4 w-4 text-cyan-600" />
                    Thời gian nhập kho (Dự kiến)
                  </label>
                  <input
                    type="datetime-local"
                    value={receiptDate}
                    onChange={(e) => setReceiptDate(e.target.value)}
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500"
                  />
                </div>
                
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Ghi chú kiểm kê / Hướng dẫn</label>
                  <input
                    type="text"
                    value={stockInNote}
                    onChange={(e) => setStockInNote(e.target.value)}
                    placeholder="Ví dụ: Kiểm tra kỹ tem mác..."
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500"
                  />
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
                    <p className="text-sm font-bold uppercase text-slate-700 flex items-center gap-2">
                      <User className="h-4 w-4 text-indigo-600" />
                      Nhân viên kho
                    </p>
                    <label className="flex items-center gap-2 text-sm cursor-pointer text-indigo-700 font-bold hover:text-indigo-800">
                      <input 
                        type="checkbox" 
                        onChange={(e) => {
                          const eligible = users.filter(u => u.roles?.some((r: any) => ['STAFF', 'INVENTORY_STAFF', 'WAREHOUSE_STAFF', 'Nhân viên kho'].includes(r.name) || String(r.name).toLowerCase() === 'staff'));
                          if (e.target.checked) setSelectedStaffIds(eligible.map(u => u.id));
                          else setSelectedStaffIds([]);
                        }} 
                        checked={
                          selectedStaffIds.length > 0 && 
                          selectedStaffIds.length === users.filter(u => u.roles?.some((r: any) => ['STAFF', 'INVENTORY_STAFF', 'WAREHOUSE_STAFF', 'Nhân viên kho'].includes(r.name) || String(r.name).toLowerCase() === 'staff')).length
                        } 
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" 
                      />
                      Chọn tất cả
                    </label>
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2">
                    {users.filter(u => u.roles?.some((r: any) => ['STAFF', 'INVENTORY_STAFF', 'WAREHOUSE_STAFF', 'Nhân viên kho'].includes(r.name) || String(r.name).toLowerCase() === 'staff')).map((u) => (
                      <label key={u.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:border-indigo-400 transition shadow-sm">
                        <input
                          type="checkbox"
                          checked={selectedStaffIds.includes(u.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedStaffIds([...selectedStaffIds, u.id]);
                            else setSelectedStaffIds(selectedStaffIds.filter((id) => id !== u.id));
                          }}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                        />
                        <div>
                          <p className="text-sm font-bold text-slate-900">{u.fullName || u.email}</p>
                          {u.fullName && <p className="text-xs text-slate-500">{u.email}</p>}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        }
        customWidthClass={['create', 'edit', 'view', 'create_order'].includes(modalMode || '') ? 'w-[95vw] max-w-[1500px]' : undefined}
        onFormChange={setForm as any}
        onSubmit={handleSubmit}
        onClose={closeModal}
        onAddRow={addRow}
        onRemoveRow={removeRow}
        onUpdateRow={updateRow}
        onProductChange={onProductChange}
        onScannerOpen={() => setScannerOpen(true)}
      />

      {/* POPUP NHẬN HÀNG */}
      {receiveOpen && selectedOrder && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Nhận hàng cho {selectedOrder.poNumber}</h3>
                <p className="text-sm font-medium text-slate-500">Nhập số lượng thực tế đã nhận vào kho.</p>
              </div>
              <button type="button" onClick={() => setReceiveOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(92vh-140px)] overflow-y-auto px-6 py-5">
              <div className="overflow-hidden rounded-xl border-2 border-slate-200">
                <table className="w-full text-left text-sm text-slate-600 border-collapse">
                  <thead className="bg-slate-50 uppercase text-slate-500 border-b-2 border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-black text-center w-12 border-r-2 border-slate-200">STT</th>
                      <th className="px-4 py-3 font-black border-r-2 border-slate-200">Sản phẩm</th>
                      <th className="px-4 py-3 font-black text-center w-28 border-r-2 border-slate-200">SL Đặt</th>
                      <th className="px-4 py-3 font-black text-center w-28 border-r-2 border-slate-200">Đã nhận</th>
                      <th className="px-4 py-3 font-black text-right w-40 border-r-2 border-slate-200">Đơn giá</th>
                      <th className="px-4 py-3 font-black text-center w-40">Nhận đợt này</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-slate-200">
                    {receiveRows.map((row, index) => (
                      <tr key={row.detailId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-center font-bold text-slate-400 border-r-2 border-slate-200">{index + 1}</td>
                        <td className="px-4 py-3 border-r-2 border-slate-200">
                          <p className="font-bold text-slate-900 line-clamp-2" title={row.label}>{row.label}</p>
                          <p className="text-xs font-semibold text-slate-500 mt-0.5">{row.sku}</p>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-slate-700 border-r-2 border-slate-200">{Number(row.expectedQty) || 0}</td>
                        <td className="px-4 py-3 text-center font-bold text-emerald-600 border-r-2 border-slate-200">{Number(row.receivedQty) || 0}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-600 border-r-2 border-slate-200">
                          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(row.unitPrice) || 0)}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min={0}
                            value={row.qty}
                            onChange={(event) => setReceiveRows((current) => current.map((item) => (item.detailId === row.detailId ? { ...item, qty: event.target.value } : item)))}
                            className="h-10 w-full rounded-xl border-2 border-slate-200 px-3 text-center text-sm font-bold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button type="button" onClick={() => setReceiveOpen(false)} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50">
                Hủy
              </button>
              <button type="button" onClick={saveReceive} disabled={saving} className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-60">
                {saving ? 'Đang lưu...' : 'Lưu nhận hàng'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP XÓA */}
      {modalMode === 'delete' && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Xóa đơn mua hàng</h3>
                <p className="text-sm font-medium text-slate-500">Thao tác này không thể hoàn tác.</p>
              </div>
              <button type="button" onClick={closeModal} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-700">
                Bạn có chắc muốn xóa đơn mua hàng <span className="font-black text-slate-950">{deleteTarget.poNumber}</span> không?
              </p>
              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50">
                  Hủy
                </button>
                <button type="button" onClick={handleDelete} disabled={saving} className="rounded-xl bg-red-600 px-5 py-2.5 font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-60">
                  {saving ? 'Đang xóa...' : 'Xóa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tích hợp Barcode Scanner */}
      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onProductFound={handleProductScanned}
        title="Quét mã vạch nhập kho"
      />

      {duplicateReceipts.length > 0 && pendingOrderForStockIn && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Đã tồn tại phiếu nhập kho</h3>
                <p className="text-sm font-medium text-slate-500">
                  Đơn mua hàng <span className="font-bold text-slate-700">{pendingOrderForStockIn.poNumber}</span> đã có {duplicateReceipts.length} phiếu nhập kho trước đó.
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  setDuplicateReceipts([]);
                  setPendingOrderForStockIn(null);
                }} 
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
              <div className="space-y-3">
                {duplicateReceipts.map((receipt) => (
                  <div key={receipt.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-slate-800">{receipt.receiptCode}</span>
                      <span className={`inline-flex rounded-lg border px-2 py-0.5 text-xs font-bold ${receipt.status === 'POSTED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-slate-100 text-slate-600'}`}>{receipt.status === 'POSTED' ? 'Đã chốt' : 'Lưu nháp'}</span>
                    </div>
                    <div className="text-sm text-slate-600">Ngày lập: {new Date(receipt.createdAt || receipt.receiptDate).toLocaleString('vi-VN')}</div>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm font-bold text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                Bạn có chắc chắn muốn tiếp tục tạo thêm lệnh nhập kho mới không?
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button 
                type="button" 
                onClick={() => {
                  setDuplicateReceipts([]);
                  setPendingOrderForStockIn(null);
                }} 
                className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button 
                type="button" 
                onClick={() => {
                  const order = pendingOrderForStockIn;
                  setDuplicateReceipts([]);
                  setPendingOrderForStockIn(null);
                  proceedWithCreateStockIn(order);
                }} 
                className="rounded-xl bg-amber-600 px-6 py-2.5 font-bold text-white shadow-sm hover:bg-amber-700"
              >
                Vẫn tiếp tục tạo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: React.InputHTMLAttributes<HTMLInputElement>['type'];
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
      />
    </div>
  );
}

export default function PurchaseOrdersPage() {
  return <PurchaseOrdersPageContent />;
}

export function InboundPurchaseOrdersComingSoon() {
  return (
    <InboundSectionPlaceholderPage
      title="Đề nghị nhập kho hàng trả lại"
      description="Màn hình này có thể được nối tiếp sau khi bạn chốt xong luồng đơn mua hàng và lệnh nhập kho."
    />
  );
}
