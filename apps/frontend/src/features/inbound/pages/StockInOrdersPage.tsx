import React from 'react';
import {
  ArrowUpRight,
  Building2,
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
  FileText
} from 'lucide-react';

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
  status?: string;
  description?: string;
  totalAmount: number;
  supplier?: Supplier | null;
  details?: PurchaseOrderDetail[];
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
type ModalMode = 'create' | 'delete' | null;

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

function makeDraft(order: StockInOrder | null): DraftState {
  return {
    currentStepUserEmail: order?.currentStepUserEmail || '',
    nextStepUserEmail: order?.currentStepUserEmail || '',
    note: order?.note || '',
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
  
  const [createForm, setCreateForm] = React.useState({ sourceId: '', currentStepUserEmail: '', note: '' });
  const [draft, setDraft] = React.useState<DraftState>(() => makeDraft(null));

  React.useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [ordersResponse, purchaseOrdersResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/inbound/stock-in-orders`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/inbound/purchase-orders`, { headers: authHeaders() }),
      ]);

      if (!ordersResponse.ok) {
        const data = await ordersResponse.json().catch(() => null);
        throw new Error(data?.message || 'Không tải được danh sách lệnh nhập kho');
      }
      if (!purchaseOrdersResponse.ok) {
        const data = await purchaseOrdersResponse.json().catch(() => null);
        throw new Error(data?.message || 'Không tải được danh sách đơn mua hàng');
      }

      const ordersData = (await ordersResponse.json()) as StockInOrder[];
      const purchaseOrdersData = (await purchaseOrdersResponse.json()) as PurchaseOrder[];

      setOrders(ordersData);
      setPurchaseOrders(purchaseOrdersData);
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi tải dữ liệu lệnh nhập kho' });
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
    () => orders.find((order) => order.id === selectedId) || orders[0] || null,
    [orders, selectedId],
  );

  React.useEffect(() => {
    if (!selectedId && orders[0]) {
      setSelectedId(orders[0].id);
    }
    if (selectedId && !orders.some((order) => order.id === selectedId)) {
      setSelectedId(orders[0]?.id || null);
    }
  }, [orders, selectedId]);

  React.useEffect(() => {
    setDraft(makeDraft(selectedOrder));
  }, [selectedOrder]);

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

  const openCreate = () => {
    setCreateForm({
        sourceId: purchaseOrders.find(po => !usedPurchaseOrderIds.has(po.id))?.id || '',
        currentStepUserEmail: '',
        note: ''
    });
    setModalMode('create');
  };

  const closeModal = () => {
    setModalMode(null);
    setDeleteTarget(null);
    setSaving(false);
  };

  const createFromPurchaseOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createForm.sourceId) {
      setToast({ type: 'error', message: 'Hãy chọn một đơn mua hàng để lập lệnh nhập kho' });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/inbound/stock-in-orders/from-purchase-orders/${createForm.sourceId}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          note: createForm.note || undefined,
          currentStepUserEmail: createForm.currentStepUserEmail || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không tạo được lệnh nhập kho');
      }

      const created = (await response.json()) as StockInOrder;
      setToast({ type: 'success', message: `Đã lập lệnh ${created.orderCode}` });
      closeModal();
      await loadData();
      setSelectedId(created.id);
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi lập lệnh nhập kho' });
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
        status: selectedOrder.status,
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
        throw new Error(data?.message || 'Không lưu được lệnh nhập kho');
      }

      setToast({ type: 'success', message: 'Đã lưu thay đổi' });
      await loadData();
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi lưu lệnh nhập kho' });
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

    if (hasDifference && !window.confirm('Có chênh lệch số lượng. Bạn vẫn muốn hoàn thành lệnh này?')) {
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
        throw new Error(data?.message || 'Không hoàn thành được lệnh nhập kho');
      }

      setToast({ type: 'success', message: 'Đã hoàn thành lệnh nhập kho' });
      await loadData();
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi hoàn thành lệnh' });
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
        throw new Error(data?.message || 'Không xóa được lệnh nhập kho');
      }
      setToast({ type: 'success', message: 'Đã xóa lệnh nhập kho.' });
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
          <h1 className="text-2xl font-black text-slate-900">Lệnh nhập kho</h1>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700"
        >
          <PlusCircle className="h-4 w-4" />
          Lập lệnh nhập kho
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase text-slate-500">Tổng Lệnh</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{orders.length}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-black uppercase text-amber-600">Nháp</p>
          <p className="mt-2 text-3xl font-black text-amber-700">{draftCount}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <p className="text-xs font-black uppercase text-blue-600">Đang xử lý</p>
          <p className="mt-2 text-3xl font-black text-blue-700">{inProgressCount}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs font-black uppercase text-emerald-600">Hoàn thành</p>
          <p className="mt-2 text-3xl font-black text-emerald-700">{completedCount}</p>
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
              placeholder="Tìm theo mã lệnh, nguồn, nhà cung cấp, diễn giải..."
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
          <table className="w-full min-w-[1180px] border-collapse bg-white">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="w-16 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">#</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Mã Lệnh</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Ngày tạo</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Nguồn PO</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Nhà cung cấp</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Tổng SL</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Tình trạng</th>
                <th className="sticky right-0 w-32 border-l border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm font-black uppercase text-slate-700 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Đang tải danh sách lệnh nhập kho...
                  </td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Chưa có lệnh nhập kho phù hợp.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order, index) => (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedId(order.id)}
                    className={`group cursor-pointer border-b border-slate-200 transition hover:bg-cyan-50/50 ${selectedOrder?.id === order.id ? 'bg-blue-50/50' : ''}`}
                  >
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-600">{startIndex + index}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-sm font-black text-blue-600">{order.orderCode}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">
                      <span className="inline-flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-slate-400" />
                        {formatDate(order.createdAt)}
                      </span>
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-sm font-semibold text-slate-700">
                      {order.sourcePurchaseOrderNo || '-'}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-sm text-slate-600">
                      {order.sourcePurchaseOrder?.supplier?.name || '-'}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black text-slate-900">
                      {formatNumber(order.totalRequestedQty)}
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
                          <ArrowUpRight className="h-4 w-4" />
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

      {}
      {selectedOrder && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-2xl font-black text-slate-900">Lệnh nhập kho {selectedOrder.orderCode}</p>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Nguồn: {selectedOrder.sourcePurchaseOrder?.poNumber || selectedOrder.sourcePurchaseOrderNo || '-'} · Tạo lúc {formatDateTime(selectedOrder.createdAt)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-lg border px-3 py-1 text-sm font-bold ${statusClass(selectedOrder.status)}`}>{statusLabel(selectedOrder.status)}</span>
              <button type="button" onClick={() => setSelectedId(null)} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" title="Đóng chi tiết">
                <ChevronLeft className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="col-span-1 md:col-span-2">
                  <Field label="Nhà cung cấp" value={selectedOrder.sourcePurchaseOrder?.supplier?.name || '-'} />
                </div>
                <div className="col-span-1">
                  <label className="mb-2 block text-sm font-bold text-slate-700">Người đang xử lý</label>
                  <input
                    value={draft.currentStepUserEmail}
                    onChange={(e) => setDraft(curr => ({...curr, currentStepUserEmail: e.target.value}))}
                    className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    placeholder="Email"
                  />
                </div>
                <div className="col-span-1">
                  <label className="mb-2 block text-sm font-bold text-slate-700">Chuyển tiếp cho</label>
                  <input
                    value={draft.nextStepUserEmail}
                    onChange={(e) => setDraft(curr => ({...curr, nextStepUserEmail: e.target.value}))}
                    className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    placeholder="Email"
                  />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <label className="mb-2 block text-sm font-bold text-slate-700">Ghi chú</label>
                  <textarea
                    value={draft.note}
                    onChange={(e) => setDraft(curr => ({...curr, note: e.target.value}))}
                    className="min-h-20 w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    placeholder="Ghi chú lệnh nhập kho..."
                  />
                </div>
              </div>
            </div>

            <div className="p-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-cyan-600" />
                  <p className="text-sm font-black uppercase text-slate-700">Tổng quan</p>
                </div>
                <div className="mt-4 space-y-3">
                  <SummaryRow label="Số dòng hàng" value={`${selectedOrder.details.length}`} />
                  <SummaryRow label="Tổng SL yêu cầu" value={`${formatNumber(selectedOrder.totalRequestedQty)}`} />
                  <SummaryRow label="Tổng SL thực tế" value={`${formatNumber(selectedOrder.totalActualQty)}`} />
                  <SummaryRow label="Tổng giá trị" value={formatMoney(selectedOrder.totalAmount)} />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-cyan-600" />
                <h3 className="text-lg font-black text-slate-900">Danh sách hàng hóa</h3>
              </div>
              {selectedOrderDifferences > 0 && (
                <div className="text-sm font-bold text-red-600">
                  Có {selectedOrderDifferences} dòng chênh lệch
                </div>
              )}
            </div>
            
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse bg-white">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="w-14 border-x border-slate-200 px-3 py-3 text-center text-sm font-black uppercase text-slate-700">#</th>
                      <th className="border-x border-slate-200 px-3 py-3 text-left text-sm font-black uppercase text-slate-700">Mã hàng</th>
                      <th className="border-x border-slate-200 px-3 py-3 text-left text-sm font-black uppercase text-slate-700">Tên hàng</th>
                      <th className="w-40 border-x border-slate-200 px-3 py-3 text-center text-sm font-black uppercase text-slate-700">Kho</th>
                      <th className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black uppercase text-slate-700">SL yêu cầu</th>
                      <th className="w-36 border-x border-slate-200 px-3 py-3 text-right text-sm font-black uppercase text-slate-700">SL thực nhập</th>
                      <th className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black uppercase text-slate-700">Đơn giá</th>
                      <th className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black uppercase text-slate-700">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.details.map((detail, index) => {
                      const row = draft.rows[detail.id] || {
                        id: detail.id,
                        warehouseCode: detail.warehouseCode || 'KHO-NVL',
                        requestedQty: String(detail.requestedQty || 0),
                        actualQty: String(detail.actualQty || 0),
                        unitPrice: String(detail.unitPrice || 0),
                      };
                      const actualQty = parseNumber(row.actualQty);
                      const requestedQty = parseNumber(row.requestedQty);
                      const isOver = actualQty > requestedQty;
                      const isUnder = actualQty < requestedQty;

                      return (
                        <tr key={detail.id} className="border-b border-slate-200 transition hover:bg-cyan-50/40">
                          <td className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold text-slate-700">{index + 1}</td>
                          <td className="border-x border-slate-200 px-3 py-3 text-sm font-bold text-slate-800">{detail.product?.internalSku || '-'}</td>
                          <td className="border-x border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700">{detail.product?.name || '-'}</td>
                          <td className="border-x border-slate-200 px-3 py-3 text-center">
                            <select
                                value={row.warehouseCode}
                                onChange={(event) => updateDraftRow(detail.id, { warehouseCode: event.target.value })}
                                className="h-9 w-full rounded-lg border-2 border-slate-200 bg-white px-2 text-sm font-semibold outline-none transition focus:border-cyan-500"
                            >
                                <option value="">Chọn kho</option>
                                {warehouses.map((warehouse) => (
                                    <option key={warehouse.code} value={warehouse.code}>
                                        {warehouse.code}
                                    </option>
                                ))}
                            </select>
                          </td>
                          <td className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black text-slate-900">{formatNumber(requestedQty)}</td>
                          <td className="border-x border-slate-200 px-3 py-3">
                             <input
                                type="number"
                                min={0}
                                value={row.actualQty}
                                onChange={(event) => updateDraftRow(detail.id, { actualQty: event.target.value })}
                                className={`h-9 w-full rounded-lg border-2 px-2 text-right text-sm font-bold outline-none transition ${
                                    isOver ? 'border-red-300 bg-red-50 text-red-700 focus:border-red-500' 
                                    : isUnder ? 'border-amber-300 bg-amber-50 text-amber-700 focus:border-amber-500'
                                    : 'border-slate-200 focus:border-cyan-500'
                                }`}
                            />
                          </td>
                          <td className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black text-slate-900">{formatMoney(parseNumber(row.unitPrice))}</td>
                          <td className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black text-slate-900">{formatMoney(actualQty * parseNumber(row.unitPrice))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 mt-5 pt-4 sm:flex-row sm:justify-end">
              <button 
                type="button" 
                onClick={saveOrder} 
                disabled={saving || selectedOrder.status === 'COMPLETED'} 
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCw className="h-4 w-4" />
                Lưu nháp
              </button>
              <button 
                type="button" 
                onClick={transitionOrder} 
                disabled={saving || selectedOrder.status === 'COMPLETED'} 
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-200 bg-cyan-50 px-5 py-2.5 text-sm font-bold text-cyan-700 transition hover:bg-cyan-100 disabled:opacity-60"
              >
                <ArrowRight className="h-4 w-4" />
                Chuyển bước
              </button>
              <button 
                type="button" 
                onClick={completeOrder} 
                disabled={saving || selectedOrder.status === 'COMPLETED'} 
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                Hoàn thành
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {modalMode === 'create' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <form onSubmit={createFromPurchaseOrder} className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b-2 border-slate-100 px-6 py-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600">
                  <Workflow className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Lập lệnh nhập kho</h3>
                  <p className="text-sm font-medium text-slate-500">Tạo lệnh mới từ đơn mua hàng.</p>
                </div>
              </div>
              <button type="button" onClick={closeModal} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 px-8 py-6">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Đơn mua hàng nguồn</label>
                <select
                    value={createForm.sourceId}
                    onChange={(event) => setCreateForm((current) => ({ ...current, sourceId: event.target.value }))}
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                >
                    <option value="">Chọn đơn mua hàng</option>
                    {purchaseOrders.map((po) => (
                        <option key={po.id} value={po.id} disabled={usedPurchaseOrderIds.has(po.id)}>
                            {po.poNumber} - {po.supplier?.name || 'Không có NCC'} {usedPurchaseOrderIds.has(po.id) ? '(đã lập lệnh)' : ''}
                        </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Người đang xử lý</label>
                <input
                    value={createForm.currentStepUserEmail}
                    onChange={(event) => setCreateForm((current) => ({ ...current, currentStepUserEmail: event.target.value }))}
                    placeholder="Email người xử lý"
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Ghi chú</label>
                <textarea
                    value={createForm.note}
                    onChange={(event) => setCreateForm((current) => ({ ...current, note: event.target.value }))}
                    placeholder="Ghi chú lệnh"
                    className="min-h-24 w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50">
                Hủy
              </button>
              <button type="submit" disabled={saving || !createForm.sourceId} className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-60">
                {saving ? 'Đang tạo...' : 'Lập lệnh'}
              </button>
            </div>
          </form>
        </div>
      )}

      {modalMode === 'delete' && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Xóa lệnh nhập kho</h3>
                <p className="text-sm font-medium text-slate-500">Thao tác này không thể hoàn tác.</p>
              </div>
              <button type="button" onClick={closeModal} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-700">
                Bạn có chắc muốn xóa lệnh nhập kho <span className="font-black text-slate-950">{deleteTarget.orderCode}</span> không?
              </p>
              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50">
                  Hủy
                </button>
                <button type="button" onClick={handleDelete} disabled={saving} className="rounded-xl bg-red-600 px-5 py-2.5 font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-60">
                  {saving ? 'Đang xóa...' : 'Xóa lệnh'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}