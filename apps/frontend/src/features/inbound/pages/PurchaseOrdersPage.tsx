import React from 'react';
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
} from 'lucide-react';
import InboundSectionPlaceholderPage from './InboundSectionPlaceholderPage';
import {
  getStoredWarehouses,
  mergeStoredWarehouses,
  normalizeWarehouseRecord,
  saveStoredWarehouses,
  type WarehouseRecord,
} from '../../../shared/utils/warehouseAssignments';

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
  details?: PurchaseOrderLine[];
  items: number;
};

type OrderStatus = 'CREATED' | 'APPROVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
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

function buildEmptyForm(supplierId = '', warehouseCode = ''): OrderForm {
  return {
    poNumber: '',
    supplierId,
    orderDate: new Date().toISOString().slice(0, 10),
    expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
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
    case 'APPROVED':
      return 'Đã duyệt';
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
    case 'APPROVED':
      return 'border-blue-200 bg-blue-50 text-blue-700';
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
  const [receiveOpen, setReceiveOpen] = React.useState(false);
  const [receiveRows, setReceiveRows] = React.useState<Array<{ detailId: string; label: string; qty: string }>>([]);
  const currentUserId = React.useMemo(() => getCurrentUserId(), []);

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

  const selectedOrder = React.useMemo(
    () => (selectedOrderDetails?.id === selectedId ? selectedOrderDetails : orders.find((order) => order.id === selectedId)) || null,
    [orders, selectedId, selectedOrderDetails],
  );

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
        order.supplier?.name.toLowerCase().includes(keyword) ||
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

  const supplierProducts = suppliers.find((supplier) => supplier.id === form.supplierId)?.products || [];

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
    const creatorPhone = getUserPhone(payload);
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

      setForm({
        poNumber: full.poNumber,
        supplierId: full.supplier?.id || suppliers[0]?.id || '',
        orderDate: full.orderDate ? full.orderDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
        expectedDate: full.expectedDate ? full.expectedDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
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
      setSelectedOrderDetails((await response.json()) as PurchaseOrder);
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
    if (!form.supplierId || form.items.length === 0) {
      setToast({ type: 'error', message: 'Vui lòng chọn nhà cung cấp và ít nhất một dòng hàng.' });
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

  const openReceive = (order: PurchaseOrder) => {
    setSelectedId(order.id);
    setReceiveRows(
      (order.details || []).map((detail) => ({
        detailId: detail.id,
        label: `${detail.product?.internalSku || '-'} · ${detail.product?.name || '-'}`,
        qty: String(Math.max(detail.expectedQty - detail.receivedQty, 0)),
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
    : null;

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
    updateRow(rowId, {
      productId,
      unitPrice: selectedProduct ? String(parseMoney(selectedProduct.purchasePrice)) : '0',
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
          {toast.type === 'error' ? <XCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
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

      {/* TỔNG QUAN 4 THẺ MÀU CYAN ĐẬM */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl bg-cyan-600 p-4 shadow-lg flex items-center justify-center transition-transform hover:-translate-y-1">
          <p className="text-lg font-bold text-white uppercase tracking-wide">{orders.length} Tổng PO</p>
        </div>
        <div className="rounded-xl bg-cyan-600 p-4 shadow-lg flex items-center justify-center transition-transform hover:-translate-y-1">
          <p className="text-lg font-bold text-white uppercase tracking-wide">{draftCount} Chờ duyệt</p>
        </div>
        <div className="rounded-xl bg-cyan-600 p-4 shadow-lg flex items-center justify-center transition-transform hover:-translate-y-1">
          <p className="text-lg font-bold text-white uppercase tracking-wide">{approvedCount} Đã duyệt</p>
        </div>
        <div className="rounded-xl bg-cyan-600 p-4 shadow-lg flex items-center justify-center transition-transform hover:-translate-y-1">
          <p className="text-lg font-bold text-white uppercase tracking-wide">{completedCount} Hoàn thành</p>
        </div>
      </div>

      {/* THANH TÌM KIẾM & LỌC (Các ô tách rời) */}
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

      {/* TÌM KIẾM CHUYÊN SÂU */}
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

      {/* BẢNG DỮ LIỆU CHÍNH */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse bg-white">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="w-16 border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold uppercase text-slate-700">STT</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold uppercase text-slate-700">Số đơn hàng</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold uppercase text-slate-700">Ngày đơn hàng</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold uppercase text-slate-700">Nhà cung cấp</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold uppercase text-slate-700">Diễn giải</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold uppercase text-slate-700">Tổng tiền</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold uppercase text-slate-700">Tình trạng</th>
                <th className="sticky right-0 w-40 border-l border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm font-semibold uppercase text-slate-700 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Đang tải danh sách đơn mua hàng...
                  </td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Chưa có đơn mua hàng phù hợp.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order, index) => (
                  <tr
                    key={order.id}
                    className="group border-b border-slate-200 transition hover:bg-slate-50"
                  >
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-600">{startIndex + index}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-600">{order.poNumber}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-4 w-4 text-slate-400" />
                        {formatDate(order.orderDate)}
                      </span>
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-600">
                      {order.supplier?.name || order.supplier?.supplierCode || '-'}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-600">{order.description || '-'}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-600">{formatMoney(order.totalAmount)}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                      <span className={`inline-flex rounded-lg border px-3 py-1 text-xs font-bold ${statusClass(order.status)}`}>
                        {statusLabel(order.status)}
                      </span>
                    </td>
                    <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-4 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-slate-50">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => openView(order)}
                          className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-2 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-100"
                        >
                          <ArrowUpRight className="h-3 w-3" />
                          Xem
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(order)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800"
                          title="Sửa"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteTarget(order);
                            setModalMode('delete');
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition-colors hover:bg-red-100"
                          title="Xóa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40">
                «
              </button>
              <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40">
                ‹
              </button>
              <button type="button" className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-cyan-600 px-3 text-sm font-bold text-white">
                {currentPage}
              </button>
              <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40">
                ›
              </button>
              <button type="button" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40">
                »
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* POPUP XEM CHI TIẾT ĐƠN HÀNG */}
      {modalMode === 'view' && selectedOrder && selectedOrderMetrics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-4 lg:flex-row lg:items-start lg:justify-between bg-slate-50">
              <div>
                <p className="text-2xl font-black text-slate-900">Chi tiết đơn hàng {selectedOrder.poNumber}</p>
                <p className="mt-1 text-sm font-medium text-slate-500">{selectedOrder.supplier?.name || '-'} · {formatDate(selectedOrder.orderDate)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${statusClass(selectedOrder.status)}`}>{statusLabel(selectedOrder.status)}</span>
                <button type="button" onClick={closeModal} className="rounded-xl p-2 text-slate-400 bg-white border border-slate-200 transition hover:bg-slate-100 hover:text-slate-700" title="Đóng">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] mb-6">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <h4 className="mb-4 text-sm font-bold uppercase text-slate-500">Thông tin chung</h4>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field label="Mã đơn hàng" value={selectedOrder.poNumber} />
                    <Field label="Nhà cung cấp" value={selectedOrder.supplier?.name || selectedOrder.supplier?.supplierCode || '-'} />
                    <Field label="Ngày đơn hàng" value={formatDate(selectedOrder.orderDate)} />
                    <Field label="Ngày giao hàng" value={formatDate(selectedOrder.expectedDate)} />
                    <Field label="Diễn giải" value={selectedOrder.description || '-'} />
                    <Field label="Tổng tiền" value={formatMoney(selectedOrder.totalAmount)} />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock3 className="h-5 w-5 text-cyan-600" />
                    <p className="text-sm font-bold uppercase text-slate-700">Tổng quan số lượng</p>
                  </div>
                  <div className="space-y-3">
                    <SummaryRow label="Số dòng hàng" value={`${selectedOrderMetrics.lines}`} />
                    <SummaryRow label="SL yêu cầu" value={`${selectedOrderMetrics.ordered}`} />
                    <SummaryRow label="SL đã nhận" value={`${selectedOrderMetrics.received}`} />
                    <SummaryRow label="Tổng tiền" value={formatMoney(selectedOrder.totalAmount)} />
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-cyan-600" />
                  <h3 className="text-lg font-black text-slate-900">Danh sách Hàng hóa</h3>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] border-collapse bg-white">
                      <thead className="bg-slate-50">
                        <tr className="border-b border-slate-200">
                          <th className="w-14 border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold uppercase text-slate-700">STT</th>
                          <th className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold uppercase text-slate-700">Mã hàng</th>
                          <th className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold uppercase text-slate-700">Tên hàng</th>
                          <th className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold uppercase text-slate-700">Kho</th>
                          <th className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold uppercase text-slate-700">ĐVT</th>
                          <th className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold uppercase text-slate-700">SL yêu cầu</th>
                          <th className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold uppercase text-slate-700">SL đã nhận</th>
                          <th className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold uppercase text-slate-700">Đơn giá</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedOrder.details || []).length ? (
                          (selectedOrder.details || []).map((detail, index) => (
                            <tr key={detail.id} className="border-b border-slate-200 transition hover:bg-slate-50">
                              <td className="border-x border-slate-200 px-3 py-3 text-center text-sm text-slate-600">{index + 1}</td>
                              <td className="border-x border-slate-200 px-3 py-3 text-center text-sm text-slate-600">{detail.product?.internalSku || '-'}</td>
                              <td className="border-x border-slate-200 px-3 py-3 text-center text-sm text-slate-600">{detail.product?.name || '-'}</td>
                              <td className="border-x border-slate-200 px-3 py-3 text-center text-sm text-slate-600">{detail.warehouseCode || '-'}</td>
                              <td className="border-x border-slate-200 px-3 py-3 text-center text-sm text-slate-600">{detail.product?.unit || '-'}</td>
                              <td className="border-x border-slate-200 px-3 py-3 text-center text-sm text-slate-600">{detail.expectedQty}</td>
                              <td className="border-x border-slate-200 px-3 py-3 text-center text-sm text-slate-600">{detail.receivedQty}</td>
                              <td className="border-x border-slate-200 px-3 py-3 text-center text-sm text-slate-600">{formatMoney(detail.unitPrice)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} className="px-6 py-12 text-center text-sm font-semibold text-slate-500">
                              Đơn hàng này chưa có dòng hàng nào.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => { closeModal(); approveOrder(selectedOrder); }} disabled={saving} className="inline-flex items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60">
                Lập lệnh nhập kho
              </button>
              <button type="button" onClick={() => { closeModal(); openReceive(selectedOrder); }} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-200 bg-cyan-50 px-5 py-2.5 text-sm font-bold text-cyan-700 transition hover:bg-cyan-100 disabled:opacity-60">
                <Truck className="h-4 w-4" />
                Nhận hàng
              </button>
              <button type="button" onClick={() => { closeModal(); completeOrder(selectedOrder); }} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60">
                <CheckCircle2 className="h-4 w-4" />
                Hoàn thành
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP TẠO / SỬA */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="max-h-[92vh] w-full max-w-7xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b-2 border-slate-100 px-6 py-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">{modalMode === 'edit' ? 'Sửa đơn mua hàng' : 'Tạo đơn mua hàng'}</h3>
                  <p className="text-sm font-medium text-slate-500">Chọn nhà cung cấp, sản phẩm và số lượng cần mua.</p>
                </div>
              </div>
              <button type="button" onClick={closeModal} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(92vh-150px)] space-y-6 overflow-y-auto px-8 py-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <Input label="Số đơn hàng" value={form.poNumber} onChange={(value) => setForm((current) => ({ ...current, poNumber: value }))} placeholder="Để trống để hệ thống tự sinh" />
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Nhà cung cấp</label>
                  <select
                    value={form.supplierId}
                    onChange={(event) => setForm((current) => ({ ...current, supplierId: event.target.value, items: current.items.map((item) => ({ ...item, productId: '' })) }))}
                    className={modalSelectClass}
                  >
                    <option value="">Chọn nhà cung cấp</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.supplierCode} - {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Input label="Ngày đơn hàng" type="date" value={form.orderDate} onChange={(value) => setForm((current) => ({ ...current, orderDate: value }))} />
                <Input label="Ngày giao hàng" type="date" value={form.expectedDate} onChange={(value) => setForm((current) => ({ ...current, expectedDate: value }))} />
                <Input label="Người tạo" value={form.creatorName || ''} onChange={(value) => setForm((current) => ({ ...current, creatorName: value }))} />
                <Input label="SĐT người tạo" value={form.creatorPhone || ''} onChange={(value) => setForm((current) => ({ ...current, creatorPhone: value }))} />
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Kho mặc định</label>
                  <select
                    value={form.warehouseCode || ''}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        warehouseCode: event.target.value,
                        approverId: '',
                        items: current.items.map((item) => ({
                          ...item,
                          warehouseCode: event.target.value || item.warehouseCode,
                        })),
                      }))
                    }
                    className={modalSelectClass}
                    disabled={warehouseOptions.length === 0}
                  >
                    <option value="">Chọn kho</option>
                    {warehouseOptions.map((w) => (
                      <option key={w.id} value={w.code}>
                        {w.code} - {w.name}
                      </option>
                    ))}
                  </select>
                  {accessibleWarehouses.length === 0 && (
                    <p className="mt-2 text-xs font-semibold text-amber-600">
                      Bạn chưa được gán kho nào. Hãy nhờ quản lý kho phân quyền trước khi tạo đơn.
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Người duyệt</label>
                  <select
                    value={form.approverId || ''}
                    onChange={(event) => setForm((current) => ({ ...current, approverId: event.target.value }))}
                    className={modalSelectClass}
                    disabled={approverOptions.length === 0 || !form.warehouseCode}
                  >
                    <option value="">Chọn người duyệt</option>
                    {approverOptions.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName || u.email}
                        </option>
                      ))}
                  </select>
                  {!form.warehouseCode ? (
                    <p className="mt-2 text-xs font-semibold text-slate-500">Chọn kho trước để lọc người duyệt.</p>
                  ) : approverOptions.length === 0 ? (
                    <p className="mt-2 text-xs font-semibold text-amber-600">
                      Kho này chưa có quản lý được gán. Hãy gán quản lý kho trong màn Nhân sự.
                    </p>
                  ) : null}
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Trạng thái</label>
                  <select
                    value={form.status}
                    onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as OrderStatus }))}
                    className={modalSelectClass}
                  >
                    <option value="CREATED">Chờ duyệt</option>
                    <option value="APPROVED">Đã duyệt</option>
                    <option value="PARTIALLY_RECEIVED">Nhận một phần</option>
                    <option value="RECEIVED">Hoàn thành</option>
                    <option value="CANCELLED">Đã hủy</option>
                  </select>
                </div>
                <div className="md:col-span-2 xl:col-span-3">
                  <label className="mb-2 block text-sm font-bold text-slate-700">Diễn giải</label>
                  <textarea
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    className="min-h-24 w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    placeholder="Ghi chú cho đơn mua hàng"
                  />
                </div>
              </div>

              <section>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-cyan-600" />
                    <h4 className="font-black text-slate-900">Hàng hóa</h4>
                  </div>
                  <button
                    type="button"
                    onClick={addRow}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-bold text-cyan-700 transition hover:bg-cyan-100"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Thêm dòng
                  </button>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1100px] bg-white">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="w-16 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">STT</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">Mặt hàng</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">SL yêu cầu</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">SL đã nhận</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">Đơn giá</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">Thành tiền</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">Xóa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {form.items.map((item, index) => {
                          const selectedProduct = supplierProducts.find((supplierProduct) => supplierProduct.product?.id === item.productId);
                          const expectedQty = parseMoney(item.expectedQty);
                          const unitPrice = parseMoney(item.unitPrice);
                          return (
                            <tr key={item.rowId}>
                              <td className="px-3 py-3 text-center text-sm text-slate-600">{index + 1}</td>
                              <td className="px-3 py-3">
                                <select
                                  value={item.productId}
                                  onChange={(event) => onProductChange(item.rowId, event.target.value)}
                                  className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-4 pr-10 text-sm outline-none appearance-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                >
                                  <option value="">Chọn mặt hàng</option>
                                  {supplierProducts.map((supplierProduct) => (
                                    <option key={supplierProduct.id} value={supplierProduct.product?.id || ''}>
                                      {supplierProduct.product?.internalSku} - {supplierProduct.product?.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-3">
                                <input
                                  type="number"
                                  min={0}
                                  value={item.expectedQty}
                                  onChange={(event) => updateRow(item.rowId, { expectedQty: event.target.value })}
                                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-center text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                />
                              </td>
                              <td className="px-3 py-3">
                                <input
                                  type="number"
                                  min={0}
                                  value={item.receivedQty}
                                  onChange={(event) => updateRow(item.rowId, { receivedQty: event.target.value })}
                                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-center text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                />
                              </td>
                              <td className="px-3 py-3">
                                <input
                                  type="number"
                                  min={0}
                                  value={item.unitPrice}
                                  onChange={(event) => updateRow(item.rowId, { unitPrice: event.target.value })}
                                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-center text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                />
                              </td>
                              <td className="px-3 py-3 text-center text-sm text-slate-600">{formatMoney(expectedQty * unitPrice)}</td>
                              <td className="px-3 py-3 text-center">
                                <button type="button" onClick={() => removeRow(item.rowId)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50">
                Hủy
              </button>
              <button type="button" onClick={addDefaultProduct} className="rounded-xl border-2 border-cyan-200 bg-cyan-50 px-5 py-2.5 font-bold text-cyan-700 hover:bg-cyan-100">
                Thêm dòng nhanh
              </button>
              <button type="submit" disabled={saving} className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-60">
                {saving ? 'Đang lưu...' : modalMode === 'edit' ? 'Lưu thay đổi' : 'Tạo đơn mua hàng'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* POPUP NHẬN HÀNG */}
      {receiveOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
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
              <div className="space-y-3">
                {receiveRows.map((row, index) => (
                  <div key={row.detailId} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[1.8fr_0.6fr]">
                    <div>
                      <p className="text-sm font-black text-slate-900">{index + 1}. {row.label}</p>
                      <p className="text-xs font-medium text-slate-500">Nhập số lượng muốn ghi nhận nhận kho.</p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={row.qty}
                      onChange={(event) => setReceiveRows((current) => current.map((item) => (item.detailId === row.detailId ? { ...item, qty: event.target.value } : item)))}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 text-center text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    />
                  </div>
                ))}
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