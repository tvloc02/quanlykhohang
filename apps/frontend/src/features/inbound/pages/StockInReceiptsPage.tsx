import React, { useState } from 'react';
import {
  ArrowUpRight,
  ChevronRight,
  FileText,
  Package,
  PackageCheck,
  Pencil,
  PlusCircle,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  Truck,
  X,
  Eye,
  Building2,
  CalendarDays,
  CheckCircle2,
  Filter,
  XCircle,
  Clock3,
  MoreHorizontal,
  Bell,
  ClipboardCheck,
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
  status: 'DRAFT' | 'ASSIGNED' | 'CHECKED' | 'POSTED';
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

const statusLabel = (status: string) => {
  switch ((status || 'DRAFT').toUpperCase()) {
    case 'POSTED': return 'Hoàn thành';
    case 'CHECKED': return 'Đã kiểm kê';
    case 'ASSIGNED': return 'Đã chốt (Giao việc)';
    default: return 'Chưa chốt (Nháp)';
  }
};

const statusClass = (status: string) => {
  switch ((status || 'DRAFT').toUpperCase()) {
    case 'POSTED': return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'CHECKED': return 'border-indigo-200 bg-indigo-50 text-indigo-700';
    case 'ASSIGNED': return 'border-blue-200 bg-blue-50 text-blue-700';
    default: return 'border-amber-200 bg-amber-50 text-amber-700';
  }
};

export default function StockInReceiptsPage({ receiptTypeFilter }: { receiptTypeFilter?: string }) {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  React.useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const [receipts, setReceipts] = useState<StockInReceipt[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [warehouses, setWarehouses] = React.useState<WarehouseRecord[]>(() => getStoredWarehouses());

  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'DRAFT' | 'ASSIGNED' | 'CHECKED' | 'POSTED'>('all');
  const [timeFilter, setTimeFilter] = React.useState<'all' | 'this-month' | '7-days'>('this-month');
  const [pageSize, setPageSize] = React.useState(10);
  const [currentPage, setCurrentPage] = React.useState(1);

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<Toast | null>(null);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | 'delete' | null>(null);
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
  const assignedCount = receipts.filter(r => r.status === 'ASSIGNED').length;
  const checkedCount = receipts.filter(r => r.status === 'CHECKED').length;
  const postedCount = receipts.filter(r => r.status === 'POSTED').length;

  const totalItems = filteredReceipts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(currentPage * pageSize, totalItems);
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-[#4295b4] px-4 shadow-sm text-center">
          <p className="text-sm font-bold text-white uppercase leading-tight">{receipts.length}<br/>TỔNG BIÊN BẢN</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-[#4295b4] px-4 shadow-sm text-center">
          <p className="text-sm font-bold text-white uppercase leading-tight">{draftCount}<br/>NHÁP</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-[#4295b4] px-4 shadow-sm text-center">
          <p className="text-sm font-bold text-white uppercase leading-tight">{assignedCount}<br/>ĐÃ CHỐT</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-[#4295b4] px-4 shadow-sm text-center">
          <p className="text-sm font-bold text-white uppercase leading-tight">{checkedCount}<br/>ĐÃ KIỂM KÊ</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-[#4295b4] px-4 shadow-sm text-center">
          <p className="text-sm font-bold text-white uppercase leading-tight">{postedCount}<br/>HOÀN THÀNH</p>
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
            <option value="ASSIGNED">Tình trạng: Đã chốt (Giao việc)</option>
            <option value="CHECKED">Tình trạng: Đã kiểm kê</option>
            <option value="POSTED">Tình trạng: Hoàn thành</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse bg-white">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="w-12 border-x border-slate-200 px-3 py-4 text-center align-middle">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600" />
                </th>
                <th className="w-16 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">STT</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Mã lệnh nhập kho</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Mã đơn hàng</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Kho hàng</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Quản lý</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Ngày nhận hàng</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Số lượng</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Tổng tiền</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Trạng thái</th>
                <th className="sticky right-0 w-32 border-l border-slate-200 bg-white px-3 py-4 text-center text-sm font-black uppercase text-slate-700 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-sm font-medium text-slate-500">Đang tải...</td>
                </tr>
              ) : paginatedReceipts.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-sm font-medium text-slate-500">Chưa có biên bản nào.</td>
                </tr>
              ) : (
                <>
                  {paginatedReceipts.map((r, i) => {
                  const totalQty = r.details?.reduce((sum, d) => sum + (d.quantity || d.receivedQty || d.orderedQty || 0), 0) || 0;
                  const totalAmt = r.details?.reduce((sum, d) => sum + ((d.quantity || d.receivedQty || d.orderedQty || 0) * (d.unitPrice || 0)), 0) || 0;

                  return (
                    <tr key={r.id} className="border-b border-slate-200 transition hover:bg-cyan-50/50">
                      <td className="border-x border-slate-200 px-3 py-4 text-center align-middle" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600" />
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{(currentPage - 1) * pageSize + i + 1}</td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{r.receiptCode}</td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{r.sourceReferenceNo || '-'}</td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{r.details?.[0]?.warehouseCode || 'KHO-NVL'}</td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{(r as any).approver?.fullName || '-'}</td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{formatDate(r.receiptDate)}</td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-bold text-slate-700">{formatNumber(totalQty)}</td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-bold text-slate-700">{formatMoney(totalAmt)}</td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                        <span className={`inline-flex rounded-lg border px-3 py-1 text-xs font-bold ${statusClass(r.status)}`}>
                          {statusLabel(r.status)}
                        </span>
                      </td>
                      <td className={`sticky right-0 border-l border-slate-200 bg-white px-3 py-4 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50 ${activeDropdown === r.id ? 'z-[60]' : 'z-10'}`}>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedId(r.id); setModalMode('view'); }}
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition hover:bg-cyan-100 hover:text-cyan-700"
                            title="Xem"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {r.status === 'ASSIGNED' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedId(r.id); setModalMode('view'); }}
                              className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100 hover:text-indigo-700"
                              title="Nhập số liệu kiểm kê"
                            >
                              <ClipboardCheck className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedId(r.id); setModalMode('edit'); }}
                            disabled={r.status === 'POSTED'}
                            className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${r.status === 'POSTED'
                                ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                                : 'bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700'
                              }`}
                            title="Sửa"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setActiveDropdown(activeDropdown === r.id ? null : r.id)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800"
                              title="Thao tác khác"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {activeDropdown === r.id && (
                              <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden py-1 text-left">
                                <button
                                  type="button"
                                  disabled={r.status !== 'CHECKED'}
                                  onClick={async () => {
                                    if (window.confirm('Bạn có chắc chắn muốn duyệt biên bản này?')) {
                                      try {
                                        const res = await fetch(`${API_BASE_URL}/inbound/stock-in-receipts/${r.id}/post`, {
                                          method: 'POST',
                                          headers: authHeaders(),
                                        });
                                        if (!res.ok) {
                                          const errData = await res.json().catch(()=>null);
                                          throw new Error(errData?.message || 'Có lỗi xảy ra khi duyệt biên bản');
                                        }
                                        await loadData();
                                      } catch(err: any) {
                                        alert(err.message || 'Lỗi khi duyệt');
                                      }
                                    }
                                    setActiveDropdown(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 disabled:hover:bg-white text-left"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                  Duyệt biên bản
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    alert('Gửi thông báo thành công!');
                                    setActiveDropdown(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-40 disabled:hover:bg-white text-left"
                                >
                                  <Bell className="h-4 w-4" />
                                  Thông báo
                                </button>

                                <button
                                  type="button"
                                  disabled={r.status !== 'POSTED'}
                                  onClick={() => {
                                    alert('Tính năng Xem hóa đơn đang phát triển!');
                                    setActiveDropdown(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-left"
                                  title="Hóa đơn xem được khi nhà cung cấp xuất"
                                >
                                  <FileText className="h-4 w-4" />
                                  Xem hóa đơn
                                </button>

                                <div className="my-1 border-t border-slate-100"></div>
                                <button
                                  type="button"
                                  disabled={r.status === 'POSTED'}
                                  onClick={() => {
                                    setDeleteTarget(r);
                                    setModalMode('delete');
                                    setActiveDropdown(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-white text-left"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Xóa
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {/* Spacer row to prevent overflow clipping of the dropdown */}
                {activeDropdown && (
                  <tr>
                    <td colSpan={11} className="p-0" style={{ height: '180px' }}></td>
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
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
              >
                &laquo;
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
              >
                &lsaquo;
              </button>
              <span className="flex h-8 min-w-[32px] items-center justify-center rounded-lg bg-cyan-600 px-2 text-sm font-bold text-white">
                {currentPage}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
              >
                &rsaquo;
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages || totalPages === 0}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
              >
                &raquo;
              </button>
            </div>
          </div>
        </div>
      </div>
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

      {(modalMode === 'create' || modalMode === 'edit' || modalMode === 'view') && (
        <CreateStockInReceiptModal
          isOpen={true}
          mode={modalMode}
          receiptId={(modalMode === 'edit' || modalMode === 'view') ? selectedId : undefined}
          onClose={closeModal}
          onSuccess={() => {
            closeModal();
            setToast({ type: 'success', message: 'Thao tác thành công' });
            loadData();
          }}
          sourceStockInOrderId={sourceSOId}
          sourcePurchaseOrderId={sourcePOId}
        />
      )}
    </div>
  );
}