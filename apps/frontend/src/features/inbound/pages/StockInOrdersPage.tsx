import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Eye,
  Building2,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Filter,
  Package,
  PlusCircle,
  RefreshCw,
  Search,
  Trash2,
  Workflow,
  X,
  XCircle,
  Clock3,
  ArrowRight,
  FileText,
  Printer
} from 'lucide-react';

import { PrintableStockInReceipt } from '../components/PrintableStockInReceipt';
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
    payload?.phone ||
    ''
  );
}

export type WarehouseRecord = {
  id: string;
  code: string;
  name: string;
  address: string;
  status: 'active' | 'inactive';
  managerIds: string[];
  staffIds: string[];
};

export function getStoredWarehouses(): WarehouseRecord[] {
  try {
    return JSON.parse(localStorage.getItem('warehouses') || '[]');
  } catch {
    return [];
  }
}

type Supplier = {
  id: string;
  supplierCode?: string;
  name: string;
  taxCode?: string;
  contactPerson?: string;
  phone?: string;
};

type PurchaseOrderDetail = {
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
  orderDate?: string;
  expectedDate?: string;
  warehouseCode?: string;
  status?: string;
  description?: string;
  totalAmount: number;
  supplier?: Supplier | null;
  details?: PurchaseOrderDetail[];
  approver?: { fullName?: string; email?: string } | null;
  creatorName?: string;
  creatorPhone?: string;
};

type StockInOrderDetail = {
  id: string;
  warehouseCode?: string;
  requestedQty: number;
  actualQty: number;
  unitPrice: number;
  totalLineAmount: number;
  product?: {
    id: string;
    internalSku: string;
    name: string;
    unit?: string;
  } | null;
};

type StockInOrderLog = {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  actorEmail?: string;
  actorId?: string;
};

type StockInOrder = {
  id: string;
  orderCode: string;
  sourcePurchaseOrderId?: string;
  sourcePurchaseOrderNo?: string;
  sourcePurchaseOrder?: {
    id: string;
    poNumber?: string;
    orderDate?: string;
    expectedDate?: string;
    supplier?: Supplier | null;
  } | null;
  status: 'DRAFT' | 'IN_PROGRESS' | 'READY' | 'COMPLETED' | 'CANCELLED';
  currentStepUserEmail?: string;
  note?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  details: StockInOrderDetail[];
  totalRequestedQty: number;
  totalActualQty: number;
  totalAmount: number;
  logs: StockInOrderLog[];
};

type TimeFilter = 'this-month' | '7-days' | 'all';
type ModalMode = 'create' | 'delete' | 'staff-select' | null;

type Toast = {
  type: 'success' | 'error';
  message: string;
};

type DraftRow = {
  id: string;
  warehouseCode: string;
  requestedQty: string;
  actualQty: string;
  unitPrice: string;
};

type DraftState = {
  currentStepUserEmail: string;
  nextStepUserEmail: string;
  note: string;
  orderCode?: string;
  expectedDate?: string;
  status?: string;
  rows: Record<string, DraftRow>;
};

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('vi-VN');
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('vi-VN');
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value || 0);
}

function parseNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusLabel(status?: string) {
  switch ((status || 'DRAFT').toUpperCase()) {
    case 'IN_PROGRESS':
      return 'Đang xử lý';
    case 'READY':
      return 'Sẵn sàng';
    case 'COMPLETED':
      return 'Hoàn thành';
    case 'CANCELLED':
      return 'Đã hủy';
    default:
      return 'Nháp';
  }
}

function statusClass(status?: string) {
  switch ((status || 'DRAFT').toUpperCase()) {
    case 'IN_PROGRESS':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'READY':
      return 'border-cyan-200 bg-cyan-50 text-cyan-700';
    case 'COMPLETED':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'CANCELLED':
      return 'border-red-200 bg-red-50 text-red-600';
    default:
      return 'border-amber-200 bg-amber-50 text-amber-700';
  }
}

function statusToFilter(status?: string): 'all' | 'draft' | 'in_progress' | 'ready' | 'completed' | 'cancelled' {
  switch ((status || 'DRAFT').toUpperCase()) {
    case 'IN_PROGRESS':
      return 'in_progress';
    case 'READY':
      return 'ready';
    case 'COMPLETED':
      return 'completed';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'draft';
  }
}

function isApprovedPurchaseOrder(order?: PurchaseOrder | null) {
  const status = String(order?.status || '').toUpperCase();
  return status === 'SUPPLIER_APPROVED' || status === 'PARTIALLY_RECEIVED' || status === 'RECEIVED';
}

function makeDraft(order: StockInOrder | null): DraftState {
  return {
    currentStepUserEmail: order?.currentStepUserEmail || '',
    nextStepUserEmail: order?.currentStepUserEmail || '',
    note: order?.note || '',
    orderCode: order?.orderCode || '',
    status: order?.status || 'DRAFT',
    expectedDate: (order?.sourcePurchaseOrder as any)?.expectedDate ? new Date((order?.sourcePurchaseOrder as any).expectedDate).toISOString().slice(0, 16) : '',
    rows: Object.fromEntries(
      (order?.details || []).map((detail) => [
        detail.id,
        {
          id: detail.id,
          warehouseCode: detail.warehouseCode || 'KHO-NVL',
          requestedQty: String(detail.requestedQty || 0),
          actualQty: String(detail.actualQty || 0),
          unitPrice: String(detail.unitPrice || 0),
        },
      ]),
    ),
  };
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

export default function StockInOrdersPage() {
  const token = localStorage.getItem('token') || '';
  const payload = parseJwtPayload(token);
  
  const location = useLocation();
  const navigate = useNavigate();
  const [orders, setOrders] = React.useState<StockInOrder[]>([]);
  const [purchaseOrders, setPurchaseOrders] = React.useState<PurchaseOrder[]>([]);
  const [warehouses, setWarehouses] = React.useState<WarehouseRecord[]>(() => getStoredWarehouses());
  
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'draft' | 'in_progress' | 'ready' | 'completed' | 'cancelled'>('all');
  const [timeFilter, setTimeFilter] = React.useState<TimeFilter>('this-month');
  const [pageSize, setPageSize] = React.useState(10);
  const [currentPage, setCurrentPage] = React.useState(1);
  
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<Toast | null>(null);
  const [modalMode, setModalMode] = React.useState<ModalMode>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<StockInOrder | null>(null);
  
  const [users, setUsers] = React.useState<Array<{id: string; email: string; fullName?: string; roles?: any[]}>>([]);
  const [selectedStaffIds, setSelectedStaffIds] = React.useState<string[]>([]);
  
  const [createForm, setCreateForm] = React.useState({ sourceId: '', currentStepUserEmail: '', note: '', orderCode: '', expectedDate: '', status: 'DRAFT' });
  const [draft, setDraft] = React.useState<DraftState>(() => makeDraft(null));
  const autoOpenSourcePurchaseOrderId = (location.state as { sourcePurchaseOrderId?: string } | null)?.sourcePurchaseOrderId;

  React.useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [ordersResponse, purchaseOrdersResponse, usersResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/inbound/stock-in-orders`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/inbound/purchase-orders`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/users`, { headers: authHeaders() }),
      ]);

      if (!ordersResponse.ok) {
        const data = await ordersResponse.json().catch(() => null);
        throw new Error(data?.message || 'Không tải được danh sách phiếu nhập kho');
      }
      if (!purchaseOrdersResponse.ok) {
        const data = await purchaseOrdersResponse.json().catch(() => null);
        throw new Error(data?.message || 'Không tải được danh sách đơn mua hàng');
      }

      const ordersData = (await ordersResponse.json()) as StockInOrder[];
      const purchaseOrdersData = (await purchaseOrdersResponse.json()) as PurchaseOrder[];
      const usersData = usersResponse.ok ? await usersResponse.json() : [];

      setOrders(ordersData);
      setPurchaseOrders(purchaseOrdersData);
      setUsers(Array.isArray(usersData) ? usersData : usersData.data || []);
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi tải dữ liệu phiếu nhập kho' });
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
    () => orders.find((order) => order.id === selectedId) || null,
    [orders, selectedId],
  );

  const fullSourcePO = React.useMemo(
    () => selectedOrder?.sourcePurchaseOrderId ? purchaseOrders.find((po) => po.id === selectedOrder.sourcePurchaseOrderId) || null : null,
    [selectedOrder, purchaseOrders]
  );

  React.useEffect(() => {
    const newDraft = makeDraft(selectedOrder);
    if (!newDraft.expectedDate && fullSourcePO?.expectedDate) {
      newDraft.expectedDate = new Date(fullSourcePO.expectedDate).toISOString().slice(0, 16);
    }
    setDraft(newDraft);
  }, [selectedOrder, fullSourcePO]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, timeFilter]);

  const usedPurchaseOrderIds = React.useMemo(() => new Set(orders.map((order) => order.sourcePurchaseOrderId).filter(Boolean)), [orders]);

  const filteredOrders = React.useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const now = new Date();

    return orders.filter((order) => {
      const sourceName = order.sourcePurchaseOrder?.supplier?.name || order.sourcePurchaseOrderNo || '';
      const matchesKeyword =
        !keyword ||
        order.orderCode.toLowerCase().includes(keyword) ||
        sourceName.toLowerCase().includes(keyword) ||
        order.note?.toLowerCase().includes(keyword) ||
        (order.details || []).some((detail) => detail.product?.name.toLowerCase().includes(keyword));

      const matchesStatus = statusFilter === 'all' || statusToFilter(order.status) === statusFilter;

      let matchesTime = true;
      if (timeFilter !== 'all') {
        const orderDate = order.createdAt ? new Date(order.createdAt) : null;
        if (!orderDate || Number.isNaN(orderDate.getTime())) {
          matchesTime = false;
        } else if (timeFilter === 'this-month') {
          matchesTime = orderDate.getFullYear() === now.getFullYear() && orderDate.getMonth() === now.getMonth();
        } else if (timeFilter === '7-days') {
          matchesTime = now.getTime() - orderDate.getTime() <= 7 * 24 * 60 * 60 * 1000;
        }
      }

      return matchesKeyword && matchesStatus && matchesTime;
    });
  }, [orders, search, statusFilter, timeFilter]);

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

  const draftCount = orders.filter((order) => statusToFilter(order.status) === 'draft').length;
  const inProgressCount = orders.filter((order) => statusToFilter(order.status) === 'in_progress').length;
  const completedCount = orders.filter((order) => statusToFilter(order.status) === 'completed').length;

  React.useEffect(() => {
    if (!autoOpenSourcePurchaseOrderId || modalMode === 'create' || purchaseOrders.length === 0) return;

    const target = purchaseOrders.find(
      (po) => po.id === autoOpenSourcePurchaseOrderId && isApprovedPurchaseOrder(po) && !usedPurchaseOrderIds.has(po.id),
    );

    if (target) {
      openCreate(target.id);
      navigate('/inbound/stock-in-orders', { replace: true });
    }
  }, [autoOpenSourcePurchaseOrderId, modalMode, navigate, purchaseOrders, usedPurchaseOrderIds]);

  const openCreate = (sourceId?: string) => {
    const defaultSourceId = sourceId || purchaseOrders.find((po) => isApprovedPurchaseOrder(po) && !usedPurchaseOrderIds.has(po.id))?.id || '';
    const selectedSourcePO = purchaseOrders.find(po => po.id === defaultSourceId);
    setCreateForm({
        sourceId: defaultSourceId,
        currentStepUserEmail: '',
        note: '',
        orderCode: '',
        expectedDate: selectedSourcePO?.expectedDate ? new Date(selectedSourcePO.expectedDate).toISOString().slice(0, 16) : '',
        status: 'DRAFT'
    });
    setModalMode('create');
  };

  React.useEffect(() => {
    if (modalMode === 'create' || !autoOpenSourcePurchaseOrderId) return;

    const target = purchaseOrders.find(
      (po) => po.id === autoOpenSourcePurchaseOrderId && isApprovedPurchaseOrder(po) && !usedPurchaseOrderIds.has(po.id),
    );

    if (target) {
      openCreate(target.id);
    }
  }, [autoOpenSourcePurchaseOrderId, modalMode, purchaseOrders, usedPurchaseOrderIds]);

  const closeModal = () => {
    setModalMode(null);
    setDeleteTarget(null);
    setSaving(false);
  };

  const createFromPurchaseOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createForm.sourceId) {
      setToast({ type: 'error', message: 'Hãy chọn một đơn mua hàng để tạo phiếu nhập kho' });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/inbound/stock-in-orders/from-purchase-orders/${createForm.sourceId}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          sourcePurchaseOrderId: createForm.sourceId,
          note: createForm.note || undefined,
          currentStepUserEmail: createForm.currentStepUserEmail || undefined,
          orderCode: createForm.orderCode || undefined,
          status: createForm.status || 'DRAFT',
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không tạo được phiếu nhập kho');
      }

      const created = (await response.json()) as StockInOrder;
      setToast({ type: 'success', message: `Đã tạo phiếu ${created.orderCode}` });
      closeModal();
      await loadData();
      setSelectedId(created.id);
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi tạo phiếu nhập kho' });
    } finally {
      setSaving(false);
    }
  };

  const updateDraftRow = (rowId: string, patch: Partial<DraftRow>) => {
    setDraft((current) => ({
      ...current,
      rows: {
        ...current.rows,
        [rowId]: {
          ...(current.rows[rowId] || { id: rowId, warehouseCode: 'KHO-NVL', requestedQty: '0', actualQty: '0', unitPrice: '0' }),
          ...patch,
        },
      },
    }));
  };

  const saveOrder = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    try {
      const payload = {
        currentStepUserEmail: draft.currentStepUserEmail || undefined,
        note: draft.note || undefined,
        status: draft.status || selectedOrder.status,
        details: selectedOrder.details.map((detail) => {
          const row = draft.rows[detail.id];
          return {
            id: detail.id,
            warehouseCode: row?.warehouseCode || detail.warehouseCode,
            requestedQty: parseNumber(row?.requestedQty ?? String(detail.requestedQty)),
            actualQty: parseNumber(row?.actualQty ?? String(detail.actualQty)),
            unitPrice: parseNumber(row?.unitPrice ?? String(detail.unitPrice)),
          };
        }),
      };

      const response = await fetch(`${API_BASE_URL}/inbound/stock-in-orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không lưu được phiếu nhập kho');
      }

      setToast({ type: 'success', message: 'Đã lưu thay đổi' });
      await loadData();
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi lưu phiếu nhập kho' });
    } finally {
      setSaving(false);
    }
  };

  const transitionOrder = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/inbound/stock-in-orders/${selectedOrder.id}/transition`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          nextStepUserEmail: draft.nextStepUserEmail || undefined,
          note: draft.note || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không chuyển bước được');
      }

      setToast({ type: 'success', message: 'Đã chuyển bước xử lý' });
      await loadData();
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi chuyển bước' });
    } finally {
      setSaving(false);
    }
  };

  const completeOrder = async () => {
    if (!selectedOrder) return;
    const hasDifference = selectedOrder.details.some((detail) => {
      const row = draft.rows[detail.id];
      const actualQty = parseNumber(row?.actualQty ?? String(detail.actualQty));
      const requestedQty = parseNumber(row?.requestedQty ?? String(detail.requestedQty));
      return actualQty !== requestedQty;
    });

    if (hasDifference && !window.confirm('Có chênh lệch số lượng. Bạn vẫn muốn duyệt phiếu này?')) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/inbound/stock-in-orders/${selectedOrder.id}/complete`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          confirmDifference: hasDifference,
          nextStepUserEmail: draft.nextStepUserEmail || undefined,
          note: draft.note || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không duyệt được phiếu nhập kho');
      }

      setToast({ type: 'success', message: 'Đã duyệt phiếu nhập kho' });
      await loadData();
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi duyệt phiếu' });
    } finally {
      setSaving(false);
    }
  };
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/inbound/stock-in-orders/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không xóa được phiếu nhập kho');
      }
      setToast({ type: 'success', message: 'Đã xóa phiếu nhập kho.' });
      closeModal();
      await loadData();
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi xóa' });
    } finally {
      setSaving(false);
    }
  };

  const selectedOrderDifferences = selectedOrder
    ? selectedOrder.details.filter((detail) => {
        const row = draft.rows[detail.id];
        const actualQty = parseNumber(row?.actualQty ?? String(detail.actualQty));
        const requestedQty = parseNumber(row?.requestedQty ?? String(detail.requestedQty));
        return actualQty !== requestedQty;
      }).length
    : 0;

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`fixed right-4 top-4 z-[9999] flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-xl ${toast.type === 'error' ? 'border-red-200 text-red-600' : 'border-emerald-200 text-emerald-600'}`}>
          {toast.type === 'error' ? <XCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          <p className="text-sm font-bold">{toast.message}</p>
          <button type="button" onClick={() => setToast(null)} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Phiếu nhập kho</h1>
        </div>
        <button
          type="button"
          onClick={() => openCreate()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700"
        >
          <PlusCircle className="h-4 w-4" />
          Tạo phiếu nhập kho
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-[#4295b4] px-4 shadow-sm">
          <p className="text-lg font-bold text-white uppercase">{orders.length} TỔNG PHIẾU</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-[#4295b4] px-4 shadow-sm">
          <p className="text-lg font-bold text-white uppercase">{draftCount} NHÁP</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-[#4295b4] px-4 shadow-sm">
          <p className="text-lg font-bold text-white uppercase">{inProgressCount} ĐANG XỬ LÝ</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-[#4295b4] px-4 shadow-sm">
          <p className="text-lg font-bold text-white uppercase">{completedCount} HOÀN THÀNH</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_0.9fr_0.9fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white pl-11 pr-4 text-sm font-medium outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
              placeholder="Tìm theo mã phiếu, nguồn, nhà cung cấp, diễn giải..."
            />
          </div>
          <select
            value={timeFilter}
            onChange={(event) => setTimeFilter(event.target.value as TimeFilter)}
            className="h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
          >
            <option value="this-month">Thời gian: Tháng này</option>
            <option value="7-days">Thời gian: 7 ngày gần đây</option>
            <option value="all">Thời gian: Tất cả</option>
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
          >
            <option value="all">Tình trạng: Tất cả</option>
            <option value="draft">Tình trạng: Nháp</option>
            <option value="in_progress">Tình trạng: Đang xử lý</option>
            <option value="ready">Tình trạng: Sẵn sàng</option>
            <option value="completed">Tình trạng: Hoàn thành</option>
            <option value="cancelled">Tình trạng: Đã hủy</option>
          </select>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setTimeFilter('this-month');
              }}
              className="inline-flex h-11 items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              title="Đặt lại bộ lọc"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              title="Cài đặt"
            >
              <Filter className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] border-collapse bg-white">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="w-12 border-x border-slate-200 px-3 py-4 text-center align-middle">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600" />
                </th>
                <th className="w-16 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">STT</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Mã Phiếu</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Ngày tạo</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Nguồn PO</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Nhà cung cấp</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Tổng SL</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Tổng tiền</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Tình trạng</th>
                <th className="sticky right-0 w-32 border-l border-slate-200 bg-white px-3 py-4 text-center text-sm font-black uppercase text-slate-700 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Đang tải danh sách phiếu nhập kho...
                  </td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Chưa có phiếu nhập kho phù hợp.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order, index) => {
                  // Tính tổng tiền dựa vào PO source (hoặc detail order nếu có)
                  // Tạm thời lấy từ details (nếu API có trả về unitPrice, không thì hiển thị N/A)
                  const totalAmount = order.details?.reduce((acc, detail) => acc + (Number(detail.requestedQty) * (Number(detail.unitPrice) || 0)), 0) || 0;
                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedId(order.id)}
                      className={`group cursor-pointer border-b border-slate-200 transition hover:bg-cyan-50/50 ${selectedOrder?.id === order.id ? 'bg-blue-50/50' : ''}`}
                    >
                      <td className="border-x border-slate-200 px-3 py-4 text-center align-middle" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600" />
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{startIndex + index}</td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{order.orderCode}</td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">
                        <span className="inline-flex items-center justify-center gap-2">
                          <CalendarDays className="h-4 w-4 text-slate-400" />
                          {new Date((order as any).createdAt || 0).toLocaleString('vi-VN')}
                        </span>
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">
                        {order.sourcePurchaseOrderNo || '-'}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">
                        {order.sourcePurchaseOrder?.supplier?.name || '-'}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">
                        {formatNumber(order.totalRequestedQty)}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalAmount)}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                        <span className={`inline-flex rounded-lg border px-3 py-1 text-xs font-bold ${statusClass(order.status)}`}>
                          {statusLabel(order.status)}
                        </span>
                      </td>
                      <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-4 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedId(order.id);
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100 hover:text-cyan-700"
                          title="Xem"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteTarget(order);
                            setModalMode('delete');
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600 transition-colors hover:bg-red-100"
                          title="Xóa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
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

      {}
      {/* POPUP XEM CHI TIẾT VÀ SỬA */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="max-h-[94vh] w-[95vw] max-w-[1500px] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col">
            {/* HEADER */}
            <div className="flex items-start justify-between border-b-2 border-slate-100 px-6 py-4 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-cyan-100 p-2 text-cyan-700">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Chi tiết Phiếu Nhập Kho {selectedOrder.orderCode}
                  </h3>
                  <p className="text-sm font-medium text-slate-500">
                    Từ đơn mua hàng: {selectedOrder.sourcePurchaseOrderNo || '-'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${statusClass(selectedOrder.status)}`}>
                  {statusLabel(selectedOrder.status)}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 transition"
                  title="Đóng"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden min-h-0">
              <div className="overflow-y-auto flex-1 px-8 py-6 space-y-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
                  {/* PHÍA TRÁI: THÔNG TIN NHÀ CUNG CẤP & ĐẶT HÀNG */}
                  <div className="rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 flex flex-col h-full">
                    <div>
                      <h4 className="mb-5 text-sm font-black uppercase text-slate-800">Thông tin nhà cung cấp</h4>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
                        <div>
                          <label className="mb-2 block text-sm font-bold text-slate-700">Nhà cung cấp</label>
                          <input type="text" value={fullSourcePO?.supplier?.name || selectedOrder.sourcePurchaseOrder?.supplier?.name || '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-bold text-slate-700">Mã số thuế</label>
                          <input type="text" value={fullSourcePO?.supplier?.taxCode || '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-6">
                        <div>
                          <label className="mb-2 block text-sm font-bold text-slate-700">Người liên hệ</label>
                          <input type="text" value={fullSourcePO?.supplier?.contactPerson || '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-bold text-slate-700">Số điện thoại</label>
                          <input type="text" value={fullSourcePO?.supplier?.phone || '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col">
                      <h4 className="mb-5 text-sm font-black uppercase text-slate-800">Thông tin đặt hàng</h4>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
                        <div>
                          <label className="mb-2 block text-sm font-bold text-slate-700">Người đặt hàng</label>
                          <input type="text" value={fullSourcePO?.creatorName || (selectedOrder as any).creatorName || '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-bold text-slate-700">SĐT người đặt</label>
                          <input type="text" value={fullSourcePO?.creatorPhone || (selectedOrder as any).creatorPhone || '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
                        <div>
                          <label className="mb-2 block text-sm font-bold text-slate-700">Kho hàng</label>
                          <input type="text" value={fullSourcePO?.warehouseCode || fullSourcePO?.details?.[0]?.warehouseCode || "KHO-NVL (Mặc định)"} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-bold text-slate-700">Quản lý (Người duyệt)</label>
                          <input type="text" value={(fullSourcePO?.approver as any)?.fullName || (fullSourcePO?.approver as any)?.email || '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col min-h-[100px]">
                        <label className="mb-2 block text-sm font-bold text-slate-700">Ghi chú (Đơn hàng)</label>
                        <textarea value={fullSourcePO?.description || '-'} disabled className="w-full flex-1 rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 cursor-not-allowed resize-none" />
                      </div>
                    </div>
                  </div>

                  {/* PHÍA GIỮA: THÔNG TIN ĐƠN HÀNG */}
                  <div className="rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 flex flex-col h-full">
                    <h4 className="mb-5 text-sm font-black uppercase text-slate-800">Thông tin đơn hàng</h4>
                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <label className="mb-2 block text-xs font-bold uppercase text-slate-600">Đơn mua hàng tham chiếu</label>
                        <input type="text" value={selectedOrder.sourcePurchaseOrderNo || '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 cursor-not-allowed" />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-bold uppercase text-slate-600">Ngày tạo đơn</label>
                        <input type="text" value={fullSourcePO?.orderDate ? new Date(fullSourcePO.orderDate).toLocaleString('vi-VN') : (selectedOrder.sourcePurchaseOrder?.orderDate ? new Date(selectedOrder.sourcePurchaseOrder.orderDate).toLocaleString('vi-VN') : '-')} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-bold uppercase text-slate-600">Ngày giao hàng dự kiến</label>
                        <input type="text" value={fullSourcePO?.expectedDate ? new Date(fullSourcePO.expectedDate).toLocaleString('vi-VN') : (selectedOrder.sourcePurchaseOrder?.expectedDate ? new Date(selectedOrder.sourcePurchaseOrder.expectedDate).toLocaleString('vi-VN') : '-')} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                      </div>

                      <div className="mt-2 rounded-2xl bg-cyan-50 p-5 border border-cyan-100 flex-1 flex flex-col justify-center">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-xs font-bold uppercase text-cyan-800">Tổng sản phẩm</span>
                          <span className="font-black text-cyan-900 text-lg">{selectedOrder.details?.length || 0}</span>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-cyan-200/50">
                          <span className="text-xs font-bold uppercase text-cyan-800">Tổng tiền dự kiến</span>
                          <span className="font-black text-cyan-700 text-xl">{formatMoney(selectedOrder.details?.reduce((acc, detail) => acc + (Number(detail.requestedQty) * (Number(detail.unitPrice) || 0)), 0) || 0)} ₫</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* BẢNG HÀNG HÓA */}
                <section>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-cyan-600" />
                      <h4 className="font-black text-slate-900">Chi tiết hàng hóa dự kiến</h4>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border-2 border-slate-200">
                    <div className="overflow-x-auto">
                      <table className="w-full bg-white">
                        <thead className="bg-slate-50">
                          <tr className="border-b border-slate-200">
                            <th className="w-12 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">STT</th>
                            <th className="px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">Mặt hàng</th>
                            <th className="w-32 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">Kho</th>
                            <th className="w-24 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">SL yêu cầu</th>
                            <th className="w-32 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">Đơn giá</th>
                            <th className="w-32 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">Thành tiền</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {selectedOrder.details?.map((detail, index) => {
                            const requestedQty = Number(detail.requestedQty) || 0;
                            const unitPrice = Number(detail.unitPrice) || 0;
                            return (
                              <tr key={detail.id} className="hover:bg-slate-50 transition">
                                <td className="px-3 py-3 text-center text-sm text-slate-600">{index + 1}</td>
                                <td className="px-3 py-3 text-sm font-bold text-slate-800">
                                  {detail.product?.internalSku || '-'} - {detail.product?.name || '-'}
                                </td>
                                <td className="px-3 py-3 text-center text-sm font-semibold text-slate-700">
                                  {detail.warehouseCode || 'KHO-NVL'}
                                </td>
                                <td className="px-3 py-3 text-center text-sm font-black text-cyan-700">
                                  {formatNumber(requestedQty)}
                                </td>
                                <td className="px-3 py-3 text-center text-sm font-semibold text-slate-700">
                                  {formatMoney(unitPrice)}
                                </td>
                                <td className="px-3 py-3 text-center text-sm font-black text-slate-800">
                                  {formatMoney(requestedQty * unitPrice)}
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

              <div className="w-[420px] shrink-0 border-l border-slate-200 bg-slate-50 overflow-y-auto flex flex-col">
                <div className="flex flex-col h-full p-6">
                  <h3 className="text-lg font-black text-slate-900 mb-6">Thông tin Phiếu Nhập Kho</h3>
                  <div className="space-y-6 flex-1">
                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-700">Mã phiếu nhập kho</label>
                      <input type="text" value={draft.orderCode || ''} onChange={(e) => setDraft((current) => ({ ...current, orderCode: e.target.value }))} className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500" />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-700">Trạng thái phiếu</label>
                      <select value={draft.status || 'DRAFT'} onChange={(e) => setDraft((current) => ({ ...current, status: e.target.value }))} className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500">
                        <option value="DRAFT">Nháp (Chưa gửi yêu cầu)</option>
                        <option value="IN_PROGRESS">Đang xử lý</option>
                        <option value="READY">Sẵn sàng (Chờ duyệt)</option>
                        <option value="COMPLETED">Hoàn thành</option>
                        <option value="CANCELLED">Đã hủy</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                        <CalendarDays className="h-4 w-4 text-cyan-600" />
                        Thời gian nhập kho (Dự kiến)
                      </label>
                      <input type="datetime-local" value={draft.expectedDate || ''} onChange={(e) => setDraft((current) => ({ ...current, expectedDate: e.target.value }))} className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500" />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-700">Người đang xử lý</label>
                      <input type="text" value={draft.currentStepUserEmail || ''} onChange={(event) => setDraft((current) => ({ ...current, currentStepUserEmail: event.target.value }))} className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500" placeholder="Email người xử lý (tùy chọn)..." />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-700">Ghi chú kiểm kê / Hướng dẫn</label>
                      <textarea value={draft.note || ''} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} rows={3} className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 resize-none" placeholder="Ví dụ: Kiểm tra kỹ tem mác..." />
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 p-6 bg-white shrink-0 flex flex-col gap-3">
                  {selectedOrder.status !== 'COMPLETED' && (
                    <button type="button" onClick={async () => { if (window.confirm('Bạn có chắc chắn muốn duyệt phiếu nhập kho này?')) { await completeOrder(); } }} disabled={saving} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60">
                      Duyệt phiếu nhập kho
                    </button>
                  )}
                  {selectedOrder.status === 'COMPLETED' && (
                    <button type="button" onClick={() => navigate('/inbound/stock-in-receipts', { state: { sourceStockInOrderId: selectedOrder.id } })} disabled={saving} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-60">
                      Lập lệnh nhập kho
                    </button>
                  )}
                  <div className="flex gap-3">
                    <button type="button" onClick={() => { setTimeout(() => { window.print(); }, 100); }} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60">
                      <Printer className="h-4 w-4" /> In
                    </button>
                    <button type="button" onClick={saveOrder} disabled={saving || selectedOrder.status === 'COMPLETED'} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60">
                      Lưu
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {}
      {modalMode === 'create' && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <form onSubmit={createFromPurchaseOrder} className="max-h-[94vh] w-[95vw] max-w-[1500px] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col">
            {(() => {
              const selectedPO = purchaseOrders.find((po) => po.id === createForm.sourceId);
              
              const totalAmount = selectedPO?.details?.reduce((sum, item) => {
                const qty = item.expectedQty || 0;
                const price = item.unitPrice || 0;
                return sum + qty * price;
              }, 0) || 0;
              const totalQuantity = selectedPO?.details?.reduce((sum, item) => sum + (item.expectedQty || 0), 0) || 0;

              return (
                <>
                  {/* HEADER */}
                  <div className="flex items-start justify-between border-b-2 border-slate-100 px-6 py-4 bg-gradient-to-r from-slate-50 to-white">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-cyan-100 p-2 text-cyan-700">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-900">
                          Tạo Phiếu Nhập Kho
                        </h3>
                        <p className="text-sm font-medium text-slate-500">
                          Ghi nhận hàng hóa đã nhận vào kho.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="flex flex-1 overflow-hidden min-h-0">
                    <div className="overflow-y-auto flex-1 px-8 py-6 space-y-6">
                      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
                        {/* PHÍA TRÁI: THÔNG TIN NHÀ CUNG CẤP & ĐẶT HÀNG */}
                        <div className="rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 flex flex-col h-full">
                          <div>
                            <h4 className="mb-5 text-sm font-black uppercase text-slate-800">Thông tin nhà cung cấp</h4>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
                              <div>
                                <label className="mb-2 block text-sm font-bold text-slate-700">Nhà cung cấp</label>
                                <input type="text" value={selectedPO?.supplier?.name || '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                              </div>
                              <div>
                                <label className="mb-2 block text-sm font-bold text-slate-700">Mã số thuế</label>
                                <input type="text" value={selectedPO?.supplier?.taxCode || '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-6">
                              <div>
                                <label className="mb-2 block text-sm font-bold text-slate-700">Người liên hệ</label>
                                <input type="text" value={selectedPO?.supplier?.contactPerson || '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                              </div>
                              <div>
                                <label className="mb-2 block text-sm font-bold text-slate-700">Số điện thoại</label>
                                <input type="text" value={selectedPO?.supplier?.phone || '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                              </div>
                            </div>
                          </div>

                          <div className="flex-1 flex flex-col">
                            <h4 className="mb-5 text-sm font-black uppercase text-slate-800">Thông tin đặt hàng</h4>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
                              <div>
                                <label className="mb-2 block text-sm font-bold text-slate-700">Người đặt hàng</label>
                                <input type="text" value={selectedPO ? ((selectedPO as any).creatorName || getUserDisplayName(payload)) : '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                              </div>
                              <div>
                                <label className="mb-2 block text-sm font-bold text-slate-700">SĐT người đặt</label>
                                <input type="text" value={selectedPO ? ((selectedPO as any).creatorPhone || getUserPhone(payload)) : '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
                              <div>
                                <label className="mb-2 block text-sm font-bold text-slate-700">Kho hàng</label>
                                <input type="text" value={selectedPO?.warehouseCode || selectedPO?.details?.[0]?.warehouseCode || 'KHO-NVL (Mặc định)'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                              </div>
                              <div>
                                <label className="mb-2 block text-sm font-bold text-slate-700">Quản lý (Người duyệt)</label>
                                <input type="text" value={(selectedPO?.approver as any)?.fullName || (selectedPO?.approver as any)?.email || '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                              </div>
                            </div>
                            <div className="flex-1 flex flex-col min-h-[100px]">
                              <label className="mb-2 block text-sm font-bold text-slate-700">Ghi chú (Đơn hàng)</label>
                              <textarea value={selectedPO?.description || '-'} disabled className="w-full flex-1 rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 cursor-not-allowed resize-none" />
                            </div>
                          </div>
                        </div>

                        {/* PHÍA GIỮA: THÔNG TIN ĐƠN HÀNG */}
                        <div className="rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 flex flex-col h-full">
                          <h4 className="mb-5 text-sm font-black uppercase text-slate-800">Thông tin đơn hàng</h4>
                          <div className="grid grid-cols-1 gap-6">
                            <div>
                              <label className="mb-2 block text-xs font-bold uppercase text-slate-600">Đơn mua hàng tham chiếu <span className="text-red-600">*</span></label>
                              <select
                                value={createForm.sourceId}
                                onChange={(event) => {
                                  const poId = event.target.value;
                                  const po = purchaseOrders.find(p => p.id === poId);
                                  setCreateForm((current) => ({ 
                                    ...current, 
                                    sourceId: poId,
                                    expectedDate: po?.expectedDate ? new Date(po.expectedDate).toISOString().slice(0, 16) : current.expectedDate
                                  }));
                                }}
                                className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-bold text-blue-600 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 cursor-pointer"
                              >
                                <option value="">Chọn đơn mua hàng</option>
                                {purchaseOrders.map((po) => (
                                  <option key={po.id} value={po.id} disabled={usedPurchaseOrderIds.has(po.id) || !isApprovedPurchaseOrder(po)}>
                                    {po.poNumber} {usedPurchaseOrderIds.has(po.id) ? '(đã tạo)' : !isApprovedPurchaseOrder(po) ? '(chưa duyệt)' : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-2 block text-xs font-bold uppercase text-slate-600">Ngày tạo đơn</label>
                              <input type="text" value={selectedPO?.orderDate ? new Date(selectedPO.orderDate).toLocaleString('vi-VN') : '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                            </div>
                            <div>
                              <label className="mb-2 block text-xs font-bold uppercase text-slate-600">Ngày giao hàng dự kiến</label>
                              <input type="text" value={selectedPO?.expectedDate ? new Date(selectedPO.expectedDate).toLocaleString('vi-VN') : '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                            </div>
                            <div>
                              <label className="mb-2 block text-xs font-bold uppercase text-slate-600">Trạng thái đơn hàng</label>
                              <input type="text" value={selectedPO?.status === 'SUPPLIER_APPROVED' ? 'NCC đã xác nhận' : selectedPO?.status === 'PARTIALLY_RECEIVED' ? 'Nhận một phần' : selectedPO?.status === 'RECEIVED' ? 'Đã nhận đủ' : selectedPO?.status || '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                            </div>

                            <div className="mt-2 rounded-2xl bg-cyan-50 p-5 border border-cyan-100 flex-1 flex flex-col justify-center">
                              <div className="flex justify-between items-center mb-3">
                                <span className="text-xs font-bold uppercase text-cyan-800">Tổng sản phẩm</span>
                                <span className="font-black text-cyan-900 text-lg">{selectedPO?.details?.length || 0}</span>
                              </div>
                              <div className="flex justify-between items-center mb-3">
                                <span className="text-xs font-bold uppercase text-cyan-800">Tổng số lượng</span>
                                <span className="font-black text-cyan-900 text-lg">{formatNumber(totalQuantity)}</span>
                              </div>
                              <div className="flex justify-between items-center pt-3 border-t border-cyan-200/50">
                                <span className="text-xs font-bold uppercase text-cyan-800">Tổng tiền</span>
                                <span className="font-black text-cyan-700 text-xl">{formatMoney(totalAmount)} ₫</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* BẢNG HÀNG HÓA */}
                      <section>
                        <h4 className="font-black text-slate-900 mb-4">Chi tiết hàng hóa dự kiến</h4>
                        <div className="overflow-hidden rounded-2xl border-2 border-slate-200">
                          <div className="overflow-x-auto">
                            <table className="w-full bg-white">
                              <thead className="bg-slate-50">
                                <tr className="border-b border-slate-200">
                                  <th className="w-12 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">STT</th>
                                  <th className="px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">Mặt hàng</th>
                                  <th className="w-32 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">Kho</th>
                                  <th className="w-24 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">SL yêu cầu</th>
                                  <th className="w-32 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">Đơn giá</th>
                                  <th className="w-32 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">Thành tiền</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 bg-white">
                                {selectedPO ? (
                                  selectedPO.details?.map((detail, index) => (
                                    <tr key={detail.id} className="hover:bg-slate-50 transition">
                                      <td className="px-3 py-3 text-center text-sm text-slate-600">{index + 1}</td>
                                      <td className="px-3 py-3 text-sm font-bold text-slate-800">{detail.product?.internalSku || '-'} - {detail.product?.name || '-'}</td>
                                      <td className="px-3 py-3 text-center text-sm font-semibold text-slate-700">{detail.warehouseCode || 'KHO-NVL'}</td>
                                      <td className="px-3 py-3 text-center text-sm font-black text-cyan-700">{formatNumber(detail.expectedQty)}</td>
                                      <td className="px-3 py-3 text-center text-sm font-semibold text-slate-700">{formatMoney(detail.unitPrice)}</td>
                                      <td className="px-3 py-3 text-center text-sm font-black text-slate-800">{formatMoney((detail.expectedQty || 0) * (detail.unitPrice || 0))}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-sm font-medium text-slate-500">
                                      Vui lòng chọn đơn mua hàng nguồn ở trên để xem chi tiết
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </section>
                    </div>

                    <div className="w-[420px] shrink-0 border-l border-slate-200 bg-slate-50 overflow-y-auto flex flex-col">
                      <div className="flex flex-col h-full p-6">
                        <h3 className="text-lg font-black text-slate-900 mb-6">Thông tin Phiếu Nhập Kho</h3>
                        <div className="space-y-6 flex-1">
                          <div>
                            <label className="mb-2 block text-sm font-bold text-slate-700">Mã phiếu nhập kho</label>
                            <input type="text" value={createForm.orderCode} onChange={(e) => setCreateForm((current) => ({ ...current, orderCode: e.target.value }))} placeholder="Để trống để tự động tạo..." className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500" />
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-bold text-slate-700">Trạng thái phiếu</label>
                            <select value={createForm.status} onChange={(e) => setCreateForm((current) => ({ ...current, status: e.target.value }))} className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500">
                              <option value="DRAFT">Nháp (Chưa gửi yêu cầu)</option>
                              <option value="IN_PROGRESS">Đang xử lý</option>
                              <option value="READY">Sẵn sàng (Chờ duyệt)</option>
                              <option value="COMPLETED">Hoàn thành</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                              <Calendar className="h-4 w-4 text-cyan-600" />
                              Thời gian nhập kho
                            </label>
                            <input type="datetime-local" value={createForm.expectedDate} onChange={(e) => setCreateForm((current) => ({ ...current, expectedDate: e.target.value }))} className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500" />
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-bold text-slate-700">Ghi chú kiểm kê / Hướng dẫn</label>
                            <textarea value={createForm.note} onChange={(event) => setCreateForm((current) => ({ ...current, note: event.target.value }))} rows={3} placeholder="Ví dụ: Kiểm tra kỹ tem mác..." className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 resize-none" />
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 p-6 bg-white shrink-0 flex items-center gap-3">
                        <button type="button" onClick={closeModal} className="flex-1 items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                          Đóng
                        </button>
                        <button type="submit" disabled={saving || !createForm.sourceId} className="flex-1 inline-flex items-center justify-center rounded-xl border-2 border-amber-200 bg-amber-50 px-5 py-2.5 text-sm font-bold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60">
                          Tạo phiếu
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </form>
        </div>
      )}

      {modalMode === 'delete' && deleteTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Xóa phiếu nhập kho</h3>
                <p className="text-sm font-medium text-slate-500">Thao tác này không thể hoàn tác.</p>
              </div>
              <button type="button" onClick={closeModal} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-700">
                Bạn có chắc muốn xóa phiếu nhập kho <span className="font-black text-slate-950">{deleteTarget.orderCode}</span> không?
              </p>
              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50">
                  Hủy
                </button>
                <button type="button" onClick={handleDelete} disabled={saving} className="rounded-xl bg-red-600 px-5 py-2.5 font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-60">
                  {saving ? 'Đang xóa...' : 'Xóa phiếu'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedOrder && (
        <PrintableStockInReceipt order={selectedOrder} />
      )}
    </div>
  );
}
