import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  FileText,
  Printer
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
      return 'Äang xá»­ lĂ½';
    case 'READY':
      return 'Sáºµn sĂ ng';
    case 'COMPLETED':
      return 'HoĂ n thĂ nh';
    case 'CANCELLED':
      return 'ÄĂ£ há»§y';
    default:
      return 'NhĂ¡p';
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
  
  const [users, setUsers] = React.useState<Array<{id: string; email: string; fullName?: string}>>([]);
  const [selectedStaffIds, setSelectedStaffIds] = React.useState<string[]>([]);
  
  const [createForm, setCreateForm] = React.useState({ sourceId: '', currentStepUserEmail: '', note: '' });
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
        throw new Error(data?.message || 'KhĂ´ng táº£i Ä‘Æ°á»£c danh sĂ¡ch phiáº¿u nháº­p kho');
      }
      if (!purchaseOrdersResponse.ok) {
        const data = await purchaseOrdersResponse.json().catch(() => null);
        throw new Error(data?.message || 'KhĂ´ng táº£i Ä‘Æ°á»£c danh sĂ¡ch Ä‘Æ¡n mua hĂ ng');
      }

      const ordersData = (await ordersResponse.json()) as StockInOrder[];
      const purchaseOrdersData = (await purchaseOrdersResponse.json()) as PurchaseOrder[];
      const usersData = usersResponse.ok ? await usersResponse.json() : [];

      setOrders(ordersData);
      setPurchaseOrders(purchaseOrdersData);
      setUsers(Array.isArray(usersData) ? usersData : usersData.data || []);
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lá»—i táº£i dá»¯ liá»‡u phiáº¿u nháº­p kho' });
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
    setCreateForm({
        sourceId: sourceId || purchaseOrders.find((po) => isApprovedPurchaseOrder(po) && !usedPurchaseOrderIds.has(po.id))?.id || '',
        currentStepUserEmail: '',
        note: ''
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
      setToast({ type: 'error', message: 'HĂ£y chá»n má»™t Ä‘Æ¡n mua hĂ ng Ä‘á»ƒ táº¡o phiáº¿u nháº­p kho' });
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
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'KhĂ´ng táº¡o Ä‘Æ°á»£c phiáº¿u nháº­p kho');
      }

      const created = (await response.json()) as StockInOrder;
      setToast({ type: 'success', message: `ÄĂ£ táº¡o phiáº¿u ${created.orderCode}` });
      closeModal();
      await loadData();
      setSelectedId(created.id);
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lá»—i khi táº¡o phiáº¿u nháº­p kho' });
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
        throw new Error(data?.message || 'KhĂ´ng lÆ°u Ä‘Æ°á»£c phiáº¿u nháº­p kho');
      }

      setToast({ type: 'success', message: 'ÄĂ£ lÆ°u thay Ä‘á»•i' });
      await loadData();
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lá»—i khi lÆ°u phiáº¿u nháº­p kho' });
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
        throw new Error(data?.message || 'KhĂ´ng chuyá»ƒn bÆ°á»›c Ä‘Æ°á»£c');
      }

      setToast({ type: 'success', message: 'ÄĂ£ chuyá»ƒn bÆ°á»›c xá»­ lĂ½' });
      await loadData();
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lá»—i khi chuyá»ƒn bÆ°á»›c' });
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

    if (hasDifference && !window.confirm('CĂ³ chĂªnh lá»‡ch sá»‘ lÆ°á»£ng. Báº¡n váº«n muá»‘n hoĂ n thĂ nh phiáº¿u nĂ y?')) {
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
        throw new Error(data?.message || 'KhĂ´ng hoĂ n thĂ nh Ä‘Æ°á»£c phiáº¿u nháº­p kho');
      }

      setToast({ type: 'success', message: 'ÄĂ£ hoĂ n thĂ nh phiáº¿u nháº­p kho' });
      await loadData();
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lá»—i khi hoĂ n thĂ nh lá»‡nh' });
    } finally {
      setSaving(false);
    }
  };

  const createStockInReceipt = async () => {
    if (!selectedOrder) return;
    if (selectedStaffIds.length === 0) {
      setToast({ type: 'error', message: 'Vui lĂ²ng chá»n Ă­t nháº¥t má»™t nhĂ¢n viĂªn tham gia.' });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/inbound/stock-in-receipts/from-stock-in-orders/${selectedOrder.id}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          status: 'DRAFT',
          assignedStaffIds: selectedStaffIds,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'KhĂ´ng táº¡o Ä‘Æ°á»£c lá»‡nh nháº­p kho');
      }

      setToast({ type: 'success', message: 'ÄĂ£ táº¡o lá»‡nh nháº­p kho thĂ nh cĂ´ng.' });
      setModalMode(null);
      await loadData();
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lá»—i khi táº¡o lá»‡nh nháº­p kho' });
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
        throw new Error(data?.message || 'KhĂ´ng xĂ³a Ä‘Æ°á»£c phiáº¿u nháº­p kho');
      }
      setToast({ type: 'success', message: 'ÄĂ£ xĂ³a phiáº¿u nháº­p kho.' });
      closeModal();
      await loadData();
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lá»—i khi xĂ³a' });
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
          <h1 className="text-2xl font-black text-slate-900">Phiáº¿u nháº­p kho</h1>
        </div>
        <button
          type="button"
          onClick={() => openCreate()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700"
        >
          <PlusCircle className="h-4 w-4" />
          Táº¡o phiáº¿u nháº­p kho
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-[#4295b4] px-4 shadow-sm">
          <p className="text-lg font-bold text-white uppercase">{orders.length} Tá»”NG PHIáº¾U</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-[#4295b4] px-4 shadow-sm">
          <p className="text-lg font-bold text-white uppercase">{draftCount} NHĂP</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-[#4295b4] px-4 shadow-sm">
          <p className="text-lg font-bold text-white uppercase">{inProgressCount} ÄANG Xá»¬ LĂ</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-[#4295b4] px-4 shadow-sm">
          <p className="text-lg font-bold text-white uppercase">{completedCount} HOĂ€N THĂ€NH</p>
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
              placeholder="TĂ¬m theo mĂ£ phiáº¿u, nguá»“n, nhĂ  cung cáº¥p, diá»…n giáº£i..."
            />
          </div>
          <select
            value={timeFilter}
            onChange={(event) => setTimeFilter(event.target.value as TimeFilter)}
            className="h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
          >
            <option value="this-month">Thá»i gian: ThĂ¡ng nĂ y</option>
            <option value="7-days">Thá»i gian: 7 ngĂ y gáº§n Ä‘Ă¢y</option>
            <option value="all">Thá»i gian: Táº¥t cáº£</option>
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
          >
            <option value="all">TĂ¬nh tráº¡ng: Táº¥t cáº£</option>
            <option value="draft">TĂ¬nh tráº¡ng: NhĂ¡p</option>
            <option value="in_progress">TĂ¬nh tráº¡ng: Äang xá»­ lĂ½</option>
            <option value="ready">TĂ¬nh tráº¡ng: Sáºµn sĂ ng</option>
            <option value="completed">TĂ¬nh tráº¡ng: HoĂ n thĂ nh</option>
            <option value="cancelled">TĂ¬nh tráº¡ng: ÄĂ£ há»§y</option>
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
              title="Äáº·t láº¡i bá»™ lá»c"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              title="CĂ i Ä‘áº·t"
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
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">MĂ£ Phiáº¿u</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">NgĂ y táº¡o</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Nguá»“n PO</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">NhĂ  cung cáº¥p</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Tá»•ng SL</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">TĂ¬nh tráº¡ng</th>
                <th className="sticky right-0 w-32 border-l border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm font-black uppercase text-slate-700 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
                  Thao tĂ¡c
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Äang táº£i danh sĂ¡ch phiáº¿u nháº­p kho...
                  </td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    ChÆ°a cĂ³ phiáº¿u nháº­p kho phĂ¹ há»£p.
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
                          title="XĂ³a"
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
            Tá»•ng sá»‘: <b>{totalItems}</b>
            {totalItems > 0 && <span className="ml-2">Hiá»ƒn thá»‹ {startIndex} - {endIndex}</span>}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-600">Sá»‘ dĂ²ng/trang</span>
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
                Â«
              </button>
              <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40">
                â€¹
              </button>
              <button type="button" className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-cyan-600 px-3 text-sm font-bold text-white">
                {currentPage}
              </button>
              <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40">
                â€º
              </button>
              <button type="button" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40">
                Â»
              </button>
            </div>
          </div>
        </div>
      </div>

      {}
      {/* POPUP XEM CHI TIáº¾T VĂ€ Sá»¬A */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-4 lg:flex-row lg:items-start lg:justify-between bg-slate-50">
              <div>
                <p className="text-2xl font-black text-slate-900">Chi tiáº¿t phiáº¿u nháº­p kho {selectedOrder.orderCode}</p>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Tá»« Ä‘Æ¡n mua hĂ ng: {selectedOrder.sourcePurchaseOrderNo || '-'} Â· {selectedOrder.sourcePurchaseOrder?.supplier?.name || '-'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${statusClass(selectedOrder.status)}`}>
                  {statusLabel(selectedOrder.status)}
                </span>
                <button 
                  type="button" 
                  onClick={() => setSelectedId(null)} 
                  className="rounded-xl p-2 text-slate-400 bg-white border border-slate-200 transition hover:bg-slate-100 hover:text-slate-700" 
                  title="ÄĂ³ng"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] mb-6">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <h4 className="mb-4 text-sm font-bold uppercase text-slate-500">ThĂ´ng tin chung</h4>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">MĂ£ phiáº¿u nháº­p</label>
                      <p className="text-sm font-bold text-slate-900">{selectedOrder.orderCode}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Kho nháº­p</label>
                      <p className="text-sm font-bold text-slate-900">KHO-NVL (Máº·c Ä‘á»‹nh)</p>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">NgÆ°á»i giao</label>
                      <input 
                        value={draft.currentStepUserEmail || ''} 
                        onChange={e => setDraft(curr => ({...curr, currentStepUserEmail: e.target.value}))} 
                        className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" 
                        placeholder="Nháº­p ngÆ°á»i giao"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">NgĂ y nháº­p kho</label>
                      <input 
                        type="datetime-local" 
                        step="1" 
                        defaultValue={selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toISOString().slice(0, 19) : ''} 
                        className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" 
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Diá»…n giáº£i</label>
                      <input 
                        value={draft.note || ''} 
                        onChange={e => setDraft(curr => ({...curr, note: e.target.value}))} 
                        className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" 
                        placeholder="ThĂªm diá»…n giáº£i..."
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock3 className="h-5 w-5 text-cyan-600" />
                    <p className="text-sm font-bold uppercase text-slate-700">Tá»•ng quan tĂ¬nh tráº¡ng</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">TĂ¬nh tráº¡ng Ä‘á»“ng bá»™</span>
                      <span className="font-bold text-slate-900">ChÆ°a Ä‘á»“ng bá»™</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Sá»‘ dĂ²ng hĂ ng</span>
                      <span className="font-bold text-slate-900">{selectedOrder.details.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-cyan-600" />
                  <h3 className="text-lg font-black text-slate-900">Danh sĂ¡ch HĂ ng hĂ³a thá»±c nháº­p</h3>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] border-collapse bg-white">
                      <thead className="bg-slate-50">
                        <tr className="border-b border-slate-200">
                          <th className="w-14 border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold uppercase text-slate-700">STT</th>
                          <th className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold uppercase text-slate-700">MĂ£ hĂ ng</th>
                          <th className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold uppercase text-slate-700">TĂªn hĂ ng</th>
                          <th className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold uppercase text-slate-700">Kho</th>
                          <th className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold uppercase text-slate-700">ÄVT</th>
                          <th className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold uppercase text-slate-700">SL nháº­p</th>
                          <th className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold uppercase text-slate-700">SL theo ÄVT chĂ­nh</th>
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
                           return (
                              <tr key={detail.id} className="border-b border-slate-200 transition hover:bg-slate-50">
                                <td className="border-x border-slate-200 px-3 py-3 text-center text-sm text-slate-600">{index + 1}</td>
                                <td className="border-x border-slate-200 px-3 py-3 text-center text-sm font-bold text-slate-700">{detail.product?.internalSku || '-'}</td>
                                <td className="border-x border-slate-200 px-3 py-3 text-center text-sm font-bold text-slate-700">{detail.product?.name || '-'}</td>
                                <td className="border-x border-slate-200 px-3 py-3">
                                  <select
                                      value={row.warehouseCode}
                                      onChange={(event) => updateDraftRow(detail.id, { warehouseCode: event.target.value })}
                                      className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                  >
                                      {warehouses.map((warehouse) => (
                                          <option key={warehouse.code} value={warehouse.code}>{warehouse.name}</option>
                                      ))}
                                      {!warehouses.length && <option value="Kho cĂ´ng ty">Kho cĂ´ng ty</option>}
                                  </select>
                                </td>
                                <td className="border-x border-slate-200 px-3 py-3 text-center text-sm font-bold text-slate-700">{detail.product?.unit || '-'}</td>
                                <td className="border-x border-slate-200 px-3 py-3 text-center">
                                  <input
                                      type="number"
                                      min={0}
                                      value={row.actualQty}
                                      onChange={(event) => updateDraftRow(detail.id, { actualQty: event.target.value })}
                                      className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-center text-sm font-bold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 text-cyan-700"
                                  />
                                </td>
                                <td className="border-x border-slate-200 px-3 py-3 text-center text-sm font-bold text-slate-900">{formatNumber(parseNumber(row.actualQty))}</td>
                              </tr>
                           );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
               <button 
                 type="button" 
                 onClick={() => setSelectedId(null)} 
                 className="inline-flex items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
               >
                 Há»§y
               </button>
               <button 
                 type="button" 
                 onClick={transitionOrder} 
                 disabled={saving || selectedOrder.status === 'COMPLETED'} 
                 className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
               >
                 LÆ°u vĂ  ThĂªm
               </button>
               <button 
                 type="button" 
                 onClick={() => setModalMode('staff-select')} 
                 className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-60"
               >
                 Táº¡o lá»‡nh nháº­p kho
               </button>
               <button 
                 type="button" 
                 onClick={async () => {
                    await saveOrder();
                    if (selectedOrder.status !== 'COMPLETED') await completeOrder();
                 }} 
                 disabled={saving || selectedOrder.status === 'COMPLETED'} 
                 className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
               >
                 LÆ°u & HoĂ n ThĂ nh
               </button>
            </div>
          </div>
        </div>
      )}

      {}
      {modalMode === 'create' && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <form onSubmit={createFromPurchaseOrder} className="max-h-[94vh] w-[90%] max-w-[1200px] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col">
            {(() => {
              const selectedPO = purchaseOrders.find((po) => po.id === createForm.sourceId);
              
              const totalAmount = selectedPO?.details?.reduce((sum, item) => {
                const qty = item.expectedQty || 0;
                const price = item.unitPrice || 0;
                return sum + qty * price;
              }, 0) || 0;

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
                          Táº¡o phiáº¿u nháº­p kho
                        </h3>
                        <p className="text-sm font-medium text-slate-500">
                          Táº¡o phiáº¿u má»›i tá»« Ä‘Æ¡n mua hĂ ng Ä‘Ă£ Ä‘Æ°á»£c duyá»‡t.
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

                  {/* BODY */}
                  <div className="max-h-[calc(94vh-160px)] overflow-y-auto flex-1 px-8 py-6 space-y-6">
                    {/* THĂ”NG TIN CHUNG + TĂNH TRáº NG */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1.5fr]">
                      {/* PHĂA TRĂI: THĂ”NG TIN CHUNG */}
                      <div className="rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6">
                        <h4 className="mb-5 text-sm font-black uppercase text-slate-800">ThĂ´ng tin chung</h4>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
                          <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-bold text-slate-700">
                              ÄÆ¡n mua hĂ ng nguá»“n <span className="text-red-600">*</span>
                            </label>
                            <select
                              value={createForm.sourceId}
                              onChange={(event) => setCreateForm((current) => ({ ...current, sourceId: event.target.value }))}
                              className="h-11 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 text-slate-700 font-medium"
                            >
                              <option value="">Chá»n Ä‘Æ¡n mua hĂ ng</option>
                              {purchaseOrders.map((po) => (
                                <option key={po.id} value={po.id} disabled={usedPurchaseOrderIds.has(po.id) || !isApprovedPurchaseOrder(po)}>
                                  {po.poNumber} - {po.supplier?.name || 'KhĂ´ng cĂ³ NCC'} {usedPurchaseOrderIds.has(po.id) ? '(Ä‘Ă£ táº¡o phiáº¿u)' : !isApprovedPurchaseOrder(po) ? '(chÆ°a NCC xĂ¡c nháº­n)' : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
                          <div>
                            <label className="mb-2 block text-sm font-bold text-slate-700">
                              MĂ£ nhĂ  cung cáº¥p
                            </label>
                            <div className="flex h-11 items-center rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700">
                              {selectedPO?.supplier?.supplierCode || selectedPO?.supplier?.id || '-'}
                            </div>
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-bold text-slate-700">
                              TĂªn nhĂ  cung cáº¥p
                            </label>
                            <div className="flex h-11 items-center rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700">
                              {selectedPO?.supplier?.name || '-'}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
                          <div>
                            <label className="mb-2 block text-sm font-bold text-slate-700">
                              NgĂ y Ä‘Æ¡n hĂ ng gá»‘c
                            </label>
                            <div className="flex h-11 items-center rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700">
                              {formatDate(selectedPO?.orderDate)}
                            </div>
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-bold text-slate-700">
                              Kho nháº­n ngáº§m Ä‘á»‹nh
                            </label>
                            <div className="flex h-11 items-center rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700">
                              KHO-NVL (Máº·c Ä‘á»‹nh)
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-bold text-slate-700">Diá»…n giáº£i</label>
                          <textarea
                            value={createForm.note}
                            onChange={(event) => setCreateForm((current) => ({ ...current, note: event.target.value }))}
                            rows={3}
                            className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 resize-none font-medium text-slate-700"
                            placeholder="Nháº­p ghi chĂº hoáº·c diá»…n giáº£i..."
                          />
                        </div>
                      </div>

                      {/* PHĂA PHáº¢I: TĂNH TRáº NG */}
                      <div className="rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-cyan-50 to-white p-6">
                        <h4 className="mb-5 text-sm font-black uppercase text-slate-800">TĂ¬nh tráº¡ng phiáº¿u nháº­p</h4>

                        <div className="space-y-3">
                          <div>
                            <label className="mb-2 block text-xs font-bold uppercase text-slate-600">
                              Sá»‘ phiáº¿u nháº­p kho
                            </label>
                            <div className="flex h-10 items-center rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-400 italic">
                              (Tá»± Ä‘á»™ng sinh)
                            </div>
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-bold uppercase text-slate-600">
                              NgĂ y táº¡o phiáº¿u
                            </label>
                            <div className="flex h-10 items-center rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-400 italic">
                              (Tá»± Ä‘á»™ng sinh lĂºc lÆ°u)
                            </div>
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-bold uppercase text-slate-600">
                              TĂ¬nh tráº¡ng Ä‘á»“ng bá»™
                            </label>
                            <div className="flex h-10 items-center rounded-xl border-2 border-slate-200 bg-white px-3">
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock3 className="h-3 w-3" />
                                ChÆ°a thá»±c hiá»‡n
                              </span>
                            </div>
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-bold uppercase text-slate-600">
                              NgÆ°á»i Ä‘ang xá»­ lĂ½
                            </label>
                            <input
                              value={createForm.currentStepUserEmail}
                              onChange={(event) => setCreateForm((current) => ({ ...current, currentStepUserEmail: event.target.value }))}
                              className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 font-medium text-slate-700"
                              placeholder="Email ngÆ°á»i xá»­ lĂ½ (tĂ¹y chá»n)"
                            />
                          </div>

                          <div className="mt-4 rounded-xl border-2 border-cyan-200 bg-cyan-50 p-3">
                            <p className="text-xs font-bold uppercase text-cyan-700">Tá»•ng tiá»n dá»± kiáº¿n</p>
                            <p className="mt-1 text-xl font-black text-cyan-900">{formatMoney(totalAmount)}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Báº¢NG HĂ€NG HĂ“A */}
                    <section>
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Package className="h-5 w-5 text-cyan-600" />
                          <h4 className="font-black text-slate-900">Chi tiáº¿t hĂ ng hĂ³a dá»± kiáº¿n</h4>
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-2xl border-2 border-slate-200">
                        <div className="overflow-x-auto">
                          <table className="w-full bg-white">
                            <thead className="bg-slate-50">
                              <tr className="border-b border-slate-200">
                                <th className="w-12 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">
                                  STT
                                </th>
                                <th className="px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">
                                  Máº·t hĂ ng
                                </th>
                                <th className="w-32 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">
                                  Kho
                                </th>
                                <th className="w-24 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">
                                  SL yĂªu cáº§u
                                </th>
                                <th className="w-32 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">
                                  ÄÆ¡n giĂ¡
                                </th>
                                <th className="w-32 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">
                                  ThĂ nh tiá»n
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                              {selectedPO ? (
                                selectedPO.details?.map((detail, index) => {
                                  return (
                                    <tr key={detail.id} className="hover:bg-slate-50 transition">
                                      <td className="px-3 py-3 text-center text-sm text-slate-600">
                                        {index + 1}
                                      </td>
                                      <td className="px-3 py-3 text-sm font-bold text-slate-800">
                                        {detail.product?.internalSku || '-'} - {detail.product?.name || '-'}
                                      </td>
                                      <td className="px-3 py-3 text-center text-sm font-semibold text-slate-700">
                                        {detail.warehouseCode || 'KHO-NVL'}
                                      </td>
                                      <td className="px-3 py-3 text-center text-sm font-black text-cyan-700">
                                        {formatNumber(detail.expectedQty)}
                                      </td>
                                      <td className="px-3 py-3 text-center text-sm font-semibold text-slate-700">
                                        {formatMoney(detail.unitPrice)}
                                      </td>
                                      <td className="px-3 py-3 text-center text-sm font-black text-slate-800">
                                        {formatMoney((detail.expectedQty || 0) * (detail.unitPrice || 0))}
                                      </td>
                                    </tr>
                                  );
                                })
                              ) : (
                                <tr>
                                  <td colSpan={6} className="px-4 py-12 text-center text-sm font-medium text-slate-500">
                                    Vui lĂ²ng chá»n Ä‘Æ¡n mua hĂ ng nguá»“n á»Ÿ trĂªn Ä‘á»ƒ xem chi tiáº¿t
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </section>
                  </div>

                  {/* FOOTER */}
                  <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-gradient-to-r from-slate-50 to-white">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-2xl border-2 border-slate-200 px-6 py-2.5 font-bold text-slate-700 hover:bg-slate-100 transition"
                    >
                      Há»§y
                    </button>
                    <button
                      type="submit"
                      disabled={saving || !createForm.sourceId}
                      className="rounded-2xl bg-cyan-600 px-8 py-2.5 font-bold text-white shadow-lg hover:bg-cyan-700 disabled:opacity-60 transition"
                    >
                      {saving ? 'Äang táº¡o...' : 'Táº¡o phiáº¿u nháº­p kho'}
                    </button>
                  </div>
                </>
              );
            })()}
          </form>
        </div>
      )}

      {modalMode === 'delete' && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">XĂ³a phiáº¿u nháº­p kho</h3>
                <p className="text-sm font-medium text-slate-500">Thao tĂ¡c nĂ y khĂ´ng thá»ƒ hoĂ n tĂ¡c.</p>
              </div>
              <button type="button" onClick={closeModal} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-700">
                Báº¡n cĂ³ cháº¯c muá»‘n xĂ³a phiáº¿u nháº­p kho <span className="font-black text-slate-950">{deleteTarget.orderCode}</span> khĂ´ng?
              </p>
              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50">
                  Há»§y
                </button>
                <button type="button" onClick={handleDelete} disabled={saving} className="rounded-xl bg-red-600 px-5 py-2.5 font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-60">
                  {saving ? 'Äang xĂ³a...' : 'XĂ³a phiáº¿u'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {modalMode === 'staff-select' && selectedOrder && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Chá»n nhĂ¢n viĂªn tham gia nháº­p kho</h3>
                <p className="text-sm font-medium text-slate-500">Chá»‰ Ä‘á»‹nh nhĂ¢n viĂªn thá»±c hiá»‡n kiá»ƒm Ä‘áº¿m vĂ  lÆ°u kho.</p>
              </div>
              <button type="button" onClick={() => setModalMode(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
              <div className="space-y-3">
                {users.map((u) => (
                  <label key={u.id} className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-slate-200 p-3 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={selectedStaffIds.includes(u.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedStaffIds([...selectedStaffIds, u.id]);
                        else setSelectedStaffIds(selectedStaffIds.filter((id) => id !== u.id));
                      }}
                      className="h-5 w-5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600"
                    />
                    <div>
                      <p className="text-sm font-bold text-slate-900">{u.fullName || u.email}</p>
                      {u.fullName && <p className="text-xs text-slate-500">{u.email}</p>}
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t-2 border-slate-100 px-6 py-4">
              <button type="button" onClick={() => setModalMode(null)} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50">
                Há»§y
              </button>
              <button type="button" onClick={createStockInReceipt} disabled={saving || selectedStaffIds.length === 0} className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-60">
                {saving ? 'Äang táº¡o...' : 'XĂ¡c nháº­n táº¡o'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
