import React from 'react';
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Filter,
  Package,
  Pencil,
  PlusCircle,
  RefreshCw,
  Search,
  Trash2,
  X,
  XCircle,
  Clock3,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CreateStockInReceiptModal } from '../components/CreateStockInReceiptModal';

export type WarehouseRecord = {
  id: string;
  code: string;
  name: string;
};

export function getStoredWarehouses(): WarehouseRecord[] {
  try {
    return JSON.parse(localStorage.getItem('warehouses') || '[]');
  } catch {
    return [];
  }
}

type User = {
  id: string;
  email: string;
  fullName?: string;
};

type StockInReceiptDetail = {
  id: string;
  warehouseCode?: string;
  orderedQty: number;
  receivedQty: number;
  quantity: number;
  unitPrice: number;
  totalLineAmount: number;
  product?: {
    id: string;
    internalSku: string;
    name: string;
    unit?: string;
  } | null;
};

type StockInReceipt = {
  id: string;
  receiptCode: string;
  receiptType: string;
  warehouseCode?: string;
  sourceReferenceNo?: string;
  receiptDate?: string;
  status: 'DRAFT' | 'POSTED';
  description?: string;
  totalAmount: number;
  assignedStaffIds?: string[];
  details?: StockInReceiptDetail[];
  totalQuantity: number;
  supplier?: {
    id: string;
    name: string;
    supplierCode?: string;
  } | null;
  sourceStockInOrder?: {
    id: string;
    orderCode: string;
  } | null;
};

type Toast = {
  type: 'success' | 'error';
  message: string;
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

function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value || 0);
}

function statusLabel(status?: string) {
  switch ((status || 'DRAFT').toUpperCase()) {
    case 'POSTED':
      return 'Đã chốt (Ghi sổ)';
    default:
      return 'Chưa chốt (Nháp)';
  }
}

function statusClass(status?: string) {
  switch ((status || 'DRAFT').toUpperCase()) {
    case 'POSTED':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    default:
      return 'border-amber-200 bg-amber-50 text-amber-700';
  }
}

export default function StockInReceiptsPage({ receiptTypeFilter }: { receiptTypeFilter?: string }) {
  const [receipts, setReceipts] = React.useState<StockInReceipt[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [warehouses, setWarehouses] = React.useState<WarehouseRecord[]>(() => getStoredWarehouses());

  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'DRAFT' | 'POSTED'>('all');
  const [timeFilter, setTimeFilter] = React.useState<'all' | 'this-month' | '7-days'>('this-month');
  const [pageSize, setPageSize] = React.useState(10);
  const [currentPage, setCurrentPage] = React.useState(1);

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<Toast | null>(null);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [modalMode, setModalMode] = React.useState<'view' | 'delete' | 'create' | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<StockInReceipt | null>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { sourceStockInOrderId?: string; sourcePurchaseOrderId?: string } | null;

  const [sourcePOId, setSourcePOId] = React.useState<string | null>(null);
  const [sourceSOId, setSourceSOId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (state?.sourceStockInOrderId || state?.sourcePurchaseOrderId) {
      setModalMode('create');
      setSourcePOId(state.sourcePurchaseOrderId || null);
      setSourceSOId(state.sourceStockInOrderId || null);
      // Clear state so it doesn't reopen on refresh
      window.history.replaceState({}, document.title);
    }
  }, [state]);

  // Form editing
  const [editQuantities, setEditQuantities] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [receiptsRes, usersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/inbound/stock-in-receipts`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/users`, { headers: authHeaders() }),
      ]);

      if (!receiptsRes.ok) {
        throw new Error('Không tải được danh sách biên bản nhập kho');
      }

      const data = await receiptsRes.json();
      setReceipts(data);

      if (usersRes.ok) {
        const uData = await usersRes.json();
        setUsers(Array.isArray(uData) ? uData : uData.data || []);
      }
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi tải dữ liệu' });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredReceipts = React.useMemo(() => {
    const keyword = search.trim().toLowerCase();
    
    // Calculate date filter limits
    const now = new Date();
    let startDate: Date | null = null;
    if (timeFilter === 'this-month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (timeFilter === '7-days') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    
    return receipts.filter((r) => {
      const matchesKeyword =
        !keyword ||
        r.receiptCode.toLowerCase().includes(keyword) ||
        r.sourceReferenceNo?.toLowerCase().includes(keyword) ||
        r.description?.toLowerCase().includes(keyword);

      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchesType = !receiptTypeFilter || r.receiptType === receiptTypeFilter;
      
      let matchesTime = true;
      if (startDate) {
        const receiptDate = new Date(r.receiptDate || 0);
        matchesTime = receiptDate >= startDate;
      }
      
      return matchesKeyword && matchesStatus && matchesType && matchesTime;
    });
  }, [receipts, search, statusFilter, receiptTypeFilter, timeFilter]);

  const draftCount = receipts.filter(r => r.status === 'DRAFT').length;
  const postedCount = receipts.filter(r => r.status === 'POSTED').length;

  const totalItems = filteredReceipts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedReceipts = filteredReceipts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const selectedReceipt = React.useMemo(
    () => receipts.find((r) => r.id === selectedId) || null,
    [receipts, selectedId]
  );

  React.useEffect(() => {
    if (selectedReceipt) {
      const initQts: Record<string, string> = {};
      selectedReceipt.details?.forEach((d) => {
        initQts[d.id] = String(d.quantity);
      });
      setEditQuantities(initQts);
    }
  }, [selectedReceipt]);

  const closeModal = () => {
    setModalMode(null);
    setDeleteTarget(null);
    setSaving(false);
  };

  const saveChanges = async () => {
    if (!selectedReceipt) return;
    setSaving(true);
    try {
      const items = selectedReceipt.details?.map((d) => ({
        productId: d.product?.id,
        warehouseCode: d.warehouseCode,
        orderedQty: d.orderedQty,
        receivedQty: d.receivedQty,
        quantity: Number(editQuantities[d.id] || d.quantity),
        unitPrice: d.unitPrice,
      })) || [];

      const response = await fetch(`${API_BASE_URL}/inbound/stock-in-receipts/${selectedReceipt.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ items }),
      });

      if (!response.ok) throw new Error('Không lưu được');
      setToast({ type: 'success', message: 'Lưu thành công' });
      await loadData();
    } catch (error) {
      setToast({ type: 'error', message: 'Lỗi khi lưu dữ liệu' });
    } finally {
      setSaving(false);
    }
  };

  const postReceipt = async () => {
    if (!selectedReceipt) return;
    setSaving(true);
    try {
      // Đầu tiên lưu các thay đổi hiện tại
      const items = selectedReceipt.details?.map((d) => ({
        productId: d.product?.id,
        warehouseCode: d.warehouseCode,
        orderedQty: d.orderedQty,
        receivedQty: d.receivedQty,
        quantity: Number(editQuantities[d.id] || d.quantity),
        unitPrice: d.unitPrice,
      })) || [];

      await fetch(`${API_BASE_URL}/inbound/stock-in-receipts/${selectedReceipt.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ items }),
      });

      // Sau đó chốt (POSTED)
      const res = await fetch(`${API_BASE_URL}/inbound/stock-in-receipts/${selectedReceipt.id}/post`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Không chốt được phiếu');

      setToast({ type: 'success', message: 'Đã chốt phiếu thành công' });
      closeModal();
      await loadData();
    } catch (error) {
      setToast({ type: 'error', message: 'Lỗi khi chốt phiếu' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/inbound/stock-in-receipts/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.message || 'Lỗi xóa phiếu');
      }
      setToast({ type: 'success', message: 'Xóa thành công' });
      closeModal();
      await loadData();
    } catch (error: any) {
      setToast({ type: 'error', message: error.message || 'Lỗi xóa phiếu' });
    } finally {
      setSaving(false);
    }
  };

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
          <h1 className="text-2xl font-black text-slate-900">Biên Bản Nhập Kho & Kiểm Kê</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Quản lý việc kiểm đếm và ghi sổ hàng hóa</p>
        </div>
        <button
          type="button"
          onClick={() => setModalMode('create')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700"
        >
          <PlusCircle className="h-4 w-4" />
          Tạo biên bản nhập kho
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-[#4295b4] px-4 shadow-sm">
          <p className="text-lg font-bold text-white uppercase">{receipts.length} TỔNG BIÊN BẢN</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-amber-500 px-4 shadow-sm">
          <p className="text-lg font-bold text-white uppercase">{draftCount} CHƯA CHỐT (NHÁP)</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-emerald-500 px-4 shadow-sm">
          <p className="text-lg font-bold text-white uppercase">{postedCount} ĐÃ CHỐT (GHI SỔ)</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-indigo-500 px-4 shadow-sm">
          <p className="text-lg font-bold text-white uppercase">{users.filter(u => (u as any).roles?.some((r: any) => ['STAFF', 'INVENTORY_STAFF', 'WAREHOUSE_STAFF'].includes(r.name))).length} NV KHO</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white pl-11 pr-4 text-sm font-medium outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
            placeholder="Tìm theo mã biên bản, nguồn, diễn giải..."
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={timeFilter}
            onChange={(event) => setTimeFilter(event.target.value as 'all' | 'this-month' | '7-days')}
            className="h-11 min-w-[200px] rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
          >
            <option value="this-month">Thời gian: Tháng này</option>
            <option value="7-days">Thời gian: 7 ngày gần đây</option>
            <option value="all">Thời gian: Tất cả</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-11 min-w-[200px] rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
          >
            <option value="all">Tình trạng: Tất cả</option>
            <option value="DRAFT">Tình trạng: Chưa chốt (Nháp)</option>
            <option value="POSTED">Tình trạng: Đã chốt (Ghi sổ)</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse bg-white">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="w-16 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">#</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Mã Phiếu</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Ngày tạo</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Nguồn / Tham chiếu</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Trạng thái</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm font-medium text-slate-500">Đang tải...</td>
                </tr>
              ) : paginatedReceipts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm font-medium text-slate-500">Chưa có biên bản nào.</td>
                </tr>
              ) : (
                paginatedReceipts.map((r, i) => (
                  <tr key={r.id} className="border-b border-slate-200 transition hover:bg-cyan-50/50">
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-600">{(currentPage - 1) * pageSize + i + 1}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-sm font-black text-blue-600">{r.receiptCode}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{formatDate(r.receiptDate)}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-sm font-semibold text-slate-700">{r.sourceReferenceNo || '-'}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                      <span className={`inline-flex rounded-lg border px-3 py-1 text-xs font-bold ${statusClass(r.status)}`}>
                        {statusLabel(r.status)}
                      </span>
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => { setSelectedId(r.id); setModalMode('view'); }}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition hover:bg-cyan-100"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {r.status !== 'POSTED' && (
                          <button
                            onClick={() => { setDeleteTarget(r); setModalMode('delete'); }}
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600 transition hover:bg-red-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between border-t border-slate-200 px-6 py-3">
            <span className="text-sm font-bold text-slate-500">Tổng: {totalItems}</span>
        </div>
      </div>

      {/* CHI TIẾT MODAL */}
      {modalMode === 'view' && selectedReceipt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-start justify-between border-b-2 border-slate-100 px-6 py-4 bg-gradient-to-r from-slate-50 to-white">
              <div>
                <h3 className="text-xl font-black text-slate-900">Chi tiết biên bản: {selectedReceipt.receiptCode}</h3>
                <p className="text-sm font-medium text-slate-500">Từ lệnh: {selectedReceipt.sourceReferenceNo || '-'}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${statusClass(selectedReceipt.status)}`}>
                  {statusLabel(selectedReceipt.status)}
                </span>
                <button type="button" onClick={closeModal} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden min-h-0">
              <div className="overflow-y-auto flex-1 p-6 space-y-8 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Cột 1: Thông tin nhà cung cấp & Nguồn */}
                  <div className="space-y-6">
                    <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 h-full">
                      <h4 className="mb-4 text-sm font-black uppercase text-slate-800">Thông tin nhà cung cấp & Nguồn</h4>
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Nhà cung cấp</label>
                          <p className="font-semibold text-slate-900">{selectedReceipt.supplier?.name || '-'}</p>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Mã nhà cung cấp</label>
                          <p className="font-semibold text-slate-900">{selectedReceipt.supplier?.supplierCode || '-'}</p>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Từ lệnh / Nguồn</label>
                          <p className="font-semibold text-slate-900">{selectedReceipt.sourceReferenceNo || '-'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cột 2: Thông tin biên bản */}
                  <div className="rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 h-full">
                    <h4 className="mb-4 text-sm font-black uppercase text-slate-800">Thông tin biên bản</h4>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Mã biên bản</label>
                        <p className="font-bold text-slate-900">{selectedReceipt.receiptCode}</p>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Ngày tạo biên bản</label>
                        <p className="font-semibold text-slate-900">{formatDate(selectedReceipt.receiptDate)}</p>
                      </div>
                      <div className="mt-2 rounded-xl bg-cyan-50 p-4 border border-cyan-100">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold uppercase text-cyan-800">Tổng sản phẩm</span>
                          <span className="font-black text-cyan-900">{selectedReceipt.details?.length || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold uppercase text-cyan-800">Tổng số lượng</span>
                          <span className="font-black text-cyan-900">{formatNumber(selectedReceipt.totalQuantity)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="h-5 w-5 text-cyan-600" />
                    <h4 className="font-black text-slate-900">Chi tiết hàng hóa</h4>
                  </div>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full bg-white text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-3 text-sm font-black uppercase text-slate-700 text-center">STT</th>
                        <th className="px-3 py-3 text-sm font-black uppercase text-slate-700">Mã / Tên Hàng</th>
                        <th className="px-3 py-3 text-sm font-black uppercase text-slate-700 text-center">Số lượng Đặt</th>
                        <th className="px-3 py-3 text-sm font-black uppercase text-slate-700 text-center">Số lượng Giao / Nhận</th>
                        <th className="px-3 py-3 text-sm font-black uppercase text-slate-700 text-center">Số lượng Thực Tế (Kiểm kê)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(selectedReceipt.details || []).map((d, i) => (
                        <tr key={d.id} className="hover:bg-slate-50 transition">
                          <td className="px-3 py-3 text-sm text-slate-600 text-center">{i + 1}</td>
                          <td className="px-3 py-3 text-sm">
                            <p className="font-bold text-slate-800">{d.product?.internalSku}</p>
                            <p className="text-slate-600">{d.product?.name}</p>
                          </td>
                          <td className="px-3 py-3 text-sm font-black text-cyan-700 text-center">{formatNumber(d.orderedQty)}</td>
                          <td className="px-3 py-3 text-sm font-black text-indigo-700 text-center">{formatNumber(d.receivedQty)}</td>
                          <td className="px-3 py-3 text-center">
                            {selectedReceipt.status === 'POSTED' ? (
                              <span className="font-black text-emerald-700">{formatNumber(d.quantity)}</span>
                            ) : (
                              <input
                                type="number"
                                min={0}
                                value={editQuantities[d.id] ?? d.quantity}
                                onChange={(e) => setEditQuantities({ ...editQuantities, [d.id]: e.target.value })}
                                className="w-24 text-center rounded-lg border-2 border-slate-200 px-2 py-1 font-black text-emerald-700 outline-none transition focus:border-emerald-500"
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

              <div className="w-[380px] shrink-0 border-l border-slate-200 bg-slate-50 overflow-y-auto p-6 flex flex-col">
                <h3 className="text-lg font-black text-slate-900 mb-6">Thông tin giao việc</h3>
                <div className="space-y-6 flex-1">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase text-slate-500 mb-2">Nhân viên tham gia kiểm đếm</p>
                    <p className="font-semibold text-slate-800">
                      {selectedReceipt.assignedStaffIds && selectedReceipt.assignedStaffIds.length > 0
                        ? selectedReceipt.assignedStaffIds.map(id => {
                            const u = users.find(u => u.id === id);
                            return u ? u.fullName || u.email : id;
                          }).join(', ')
                        : 'Không có thông tin'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase text-slate-500 mb-2">Ghi chú chung</p>
                    <p className="font-semibold text-slate-800">{selectedReceipt.description || 'Không có ghi chú'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50">
              <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-6 py-2.5 font-bold text-slate-700 hover:bg-slate-100">
                Đóng
              </button>
              {selectedReceipt.status === 'DRAFT' && (
                <>
                  <button type="button" onClick={saveChanges} disabled={saving} className="rounded-xl border-2 border-cyan-200 bg-cyan-50 px-6 py-2.5 font-bold text-cyan-700 hover:bg-cyan-100">
                    Lưu tạm
                  </button>
                  <button type="button" onClick={postReceipt} disabled={saving} className="rounded-xl bg-emerald-600 px-6 py-2.5 font-bold text-white shadow-lg hover:bg-emerald-700">
                    Chốt hoàn thành & Ghi sổ
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* XÓA MODAL */}
      {modalMode === 'delete' && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl p-6">
            <h3 className="text-lg font-black text-slate-900 mb-2">Xóa biên bản</h3>
            <p className="text-sm text-slate-700 mb-6">Bạn có chắc muốn xóa {deleteTarget.receiptCode} không?</p>
            <div className="flex justify-end gap-3">
              <button onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50">Hủy</button>
              <button onClick={handleDelete} disabled={saving} className="rounded-xl bg-red-600 px-5 py-2.5 font-bold text-white hover:bg-red-700">Xóa</button>
            </div>
          </div>
        </div>
      )}

      <CreateStockInReceiptModal 
        isOpen={modalMode === 'create'}
        onClose={closeModal}
        onSuccess={() => {
          closeModal();
          setToast({ type: 'success', message: 'Lập lệnh nhập kho thành công' });
          loadData();
        }}
        sourceStockInOrderId={sourceSOId}
        sourcePurchaseOrderId={sourcePOId}
      />
    </div>
  );
}