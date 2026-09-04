import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  PlusCircle,
  Search,
  Filter,
  Truck,
  CheckCircle2,
  Clock,
  FileText,
  Pencil,
  Trash2,
  CalendarDays,
  RefreshCw,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  X,
  XCircle,
  Plus,
  Copy,
  Printer,
  FileSpreadsheet,
  Settings,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TransferOrderModal from './components/TransferOrderModal';
import InternalShippingNoteModal from './components/InternalShippingNoteModal';
import { deliveryApi, type TransferOrder, type TransferOrderStatus } from './api/deliveryApi';
import { getStoredWarehouses, type WarehouseRecord } from '../../shared/utils/warehouseAssignments';

const statusConfig: Record<string, { color: string; label: string }> = {
  DRAFT: { color: 'border-slate-200 bg-slate-50 text-slate-700', label: 'Nháp' },
  PENDING: { color: 'border-amber-200 bg-amber-50 text-amber-700', label: 'Chờ duyệt' },
  APPROVED: { color: 'border-cyan-200 bg-cyan-50 text-cyan-700', label: 'Đã duyệt' },
  IN_TRANSIT: { color: 'border-blue-200 bg-blue-50 text-blue-700', label: 'Đang điều chuyển' },
  DELIVERED: { color: 'border-emerald-200 bg-emerald-50 text-emerald-700', label: 'Hoàn thành' },
  COMPLETED: { color: 'border-emerald-200 bg-emerald-50 text-emerald-700', label: 'Hoàn thành' },
  CANCELLED: { color: 'border-red-200 bg-red-50 text-red-700', label: 'Đã hủy' },
};

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function renderWarehouse(wh?: string, warehousesList: WarehouseRecord[] = []) {
  if (!wh) return '-';
  const found = warehousesList.find(
    (w) => w.code === wh || w.id === wh || w.name === wh
  );
  if (found) {
    if (found.name && found.code && found.name !== found.code) {
      return `${found.name} (${found.code})`;
    }
    return found.name || found.code;
  }
  if (wh === 'KH006') return 'Kho Thanh Trì (KH006)';
  if (wh === 'KH002') return 'Kho Chi Nhánh HCM (KH002)';
  if (wh === 'KHO-TONG') return 'Kho Tổng Hà Nội (KHO-TONG)';
  if (wh === 'KHO-CN-HCM') return 'Kho Chi Nhánh HCM (KHO-CN-HCM)';
  return wh;
}

function renderCreator(creator?: string | null) {
  if (!creator || creator === 'NPT_Staff' || creator === 'admin@example.com') {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      return u.fullName || u.name || 'System Administrator';
    } catch {
      return 'System Administrator';
    }
  }
  return creator;
}

type TimeFilter = 'this-month' | '7-days' | 'all';
type StatusFilter = 'all' | TransferOrderStatus;

export default function Delivery() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<TransferOrder[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>(() => getStoredWarehouses());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('this-month');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<TransferOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TransferOrder | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fullscreen & Column Settings
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  // Column Visibility Configuration
  const DEFAULT_COLUMN_VIS = {
    stt: true,
    transferNo: true,
    sourceWarehouse: true,
    destinationWarehouse: true,
    dispatchDate: true,
    receiveDate: true,
    driver: true,
    vehiclePlate: true,
    createdBy: true,
    totalItems: true,
    totalQuantity: true,
    createdAt: true,
    status: true,
  };
  const [columnVis, setColumnVis] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('delivery_orders_column_vis');
      return saved ? { ...DEFAULT_COLUMN_VIS, ...JSON.parse(saved) } : DEFAULT_COLUMN_VIS;
    } catch {
      return DEFAULT_COLUMN_VIS;
    }
  });

  useEffect(() => {
    localStorage.setItem('delivery_orders_column_vis', JSON.stringify(columnVis));
  }, [columnVis]);

  // Fullscreen toggle
  useEffect(() => {
    const handleFSChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullScreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullScreen(false);
    }
  };

  useEffect(() => {
    async function loadWarehouses() {
      try {
        const res = await fetch('http://localhost:3000/api/warehouses', {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
        });
        if (res.ok) {
          const list = await res.json();
          setWarehouses(Array.isArray(list) ? list : list.data || []);
        }
      } catch (e) {
        console.error('Lỗi tải danh sách kho:', e);
      }
    }
    loadWarehouses();
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const data = await deliveryApi.listTransferOrders();
      setOrders(data);
    } catch (error) {
      console.error(error);
      setToast({ type: 'error', message: 'Không tải được phiếu điều chuyển' });
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, timeFilter]);

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setTimeFilter('this-month');
  };

  const handleApproveOrder = async (order: TransferOrder) => {
    try {
      await deliveryApi.updateTransferOrder(order.id, { status: 'APPROVED' });
      setToast({ type: 'success', message: `Đã duyệt thành công phiếu xuất kho ${order.transferNo}` });
      await loadOrders();
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Lỗi khi duyệt phiếu xuất kho' });
    }
  };

  const handleDeleteOrder = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deliveryApi.deleteTransferOrder(deleteTarget.id);
      setToast({ type: 'success', message: `Đã xóa phiếu điều chuyển ${deleteTarget.transferNo}` });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
      setDeleteTarget(null);
      await loadOrders();
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Lỗi khi xóa phiếu điều chuyển' });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      setToast({ type: 'error', message: 'Vui lòng chọn ít nhất 1 phiếu để xóa' });
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.size} phiếu xuất kho đã chọn?`)) return;

    try {
      for (const id of selectedIds) {
        await deliveryApi.deleteTransferOrder(id).catch(() => null);
      }
      setToast({ type: 'success', message: `Đã xóa thành công ${selectedIds.size} phiếu xuất kho` });
      setSelectedIds(new Set());
      loadOrders();
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Lỗi khi xóa các phiếu đã chọn' });
    }
  };

  const handleCopySelected = () => {
    if (selectedIds.size === 0) {
      setToast({ type: 'error', message: 'Vui lòng chọn 1 phiếu xuất kho để sao chép' });
      return;
    }
    const firstId = Array.from(selectedIds)[0];
    const target = orders.find((o) => o.id === firstId);
    if (target) {
      navigate('/delivery/create-transfer-order', { state: { copyFromOrder: target } });
      setToast({ type: 'success', message: `Đã sao chép thông tin phiếu: ${target.transferNo}` });
    }
  };

  const handleExportExcel = () => {
    const header = [
      'STT',
      'Số Phiếu',
      'Kho Chuyển',
      'Kho Nhận',
      'Ngày Chuyển',
      'Ngày Nhận',
      'Tài Xế',
      'SĐT Tài Xế',
      'Biển Số Xe',
      'Người Tạo',
      'Tổng Mặt Hàng',
      'Tổng Số Lượng',
      'Ngày Lập',
      'Trạng Thái',
    ];
    const rows = filteredOrders.map((o, idx) => [
      idx + 1,
      o.transferNo,
      renderWarehouse(o.sourceWarehouse, warehouses),
      renderWarehouse(o.destinationWarehouse, warehouses),
      formatDateTime(o.dispatchDate || o.scheduledDate || o.createdAt),
      formatDateTime(o.receiveDate || o.createdAt),
      o.driverName || '',
      o.driverPhone || '',
      o.vehiclePlate || '',
      renderCreator(o.createdBy),
      o.items?.length || o.itemCount || 0,
      o.totalQuantity || 0,
      formatDateTime(o.scheduledDate || (o as any).orderDate || o.createdAt),
      statusConfig[o.status]?.label || o.status,
    ]);
    const csv = [header, ...rows].map((r) => r.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xuat_kho_chuyen_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setToast({ type: 'success', message: 'Đã xuất dữ liệu Excel/CSV thành công!' });
  };

  const filteredOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const now = new Date();

    return orders.filter((order) => {
      const matchesKeyword =
        !keyword ||
        order.transferNo.toLowerCase().includes(keyword) ||
        (order.sourceWarehouse || '').toLowerCase().includes(keyword) ||
        (order.destinationWarehouse || '').toLowerCase().includes(keyword) ||
        (order.driverName || '').toLowerCase().includes(keyword) ||
        (order.driverPhone || '').toLowerCase().includes(keyword) ||
        (order.vehiclePlate || '').toLowerCase().includes(keyword) ||
        (order.createdBy || '').toLowerCase().includes(keyword) ||
        (order.note || '').toLowerCase().includes(keyword) ||
        (order.items || []).some((item) =>
          (item.productName || '').toLowerCase().includes(keyword) ||
          (item.productCode || '').toLowerCase().includes(keyword)
        );

      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

      let matchesTime = true;
      if (timeFilter !== 'all') {
        const rawD = order.scheduledDate || (order as any).orderDate || order.createdAt;
        const orderDate = rawD ? new Date(rawD) : null;
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredOrders.map((o) => o.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const isAllSelected = filteredOrders.length > 0 && selectedIds.size === filteredOrders.length;

  const total = orders.length;
  const pendingCount = orders.filter((order) => order.status === 'PENDING' || order.status === 'DRAFT').length;
  const movingCount = orders.filter((order) => order.status === 'IN_TRANSIT' || order.status === 'APPROVED').length;
  const doneCount = orders.filter((order) => order.status === 'DELIVERED').length;

  const totalItems = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-6">
      {/* Toast alert */}
      {toast && (
        <div className={`fixed right-4 top-4 z-[9999] flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-xl ${toast.type === 'error' ? 'border-red-200 text-red-600' : 'border-emerald-200 text-emerald-600'}`}>
          {toast.type === 'error' ? <XCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          <p className="text-sm font-bold">{toast.message}</p>
          <button type="button" onClick={() => setToast(null)} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header Banner & Action Buttons Bar (Exact match with Image 2) */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-md">
            <Truck className="h-5 w-5 text-cyan-100" />
            <h1 className="text-lg font-bold tracking-tight text-white">Quản Lý Xuất Kho Nội Bộ</h1>
          </div>
        </div>

        {/* Standard Toolbar Buttons Bar (Matching Image 2: + Thêm mới, Copy, Xóa, In báo cáo, Export Excel, Hiển thị, Maximize) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. + Thêm mới */}
          <button
            type="button"
            onClick={() => navigate('/delivery/create-transfer-order')}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-4 py-2 text-xs sm:text-sm font-extrabold text-cyan-700 shadow-2xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4 text-cyan-700" />
            Thêm mới
          </button>

          {/* 2. Copy */}
          <button
            type="button"
            onClick={handleCopySelected}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-4 py-2 text-xs sm:text-sm font-extrabold text-cyan-700 shadow-2xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
          >
            <Copy className="h-4 w-4 text-cyan-700" />
            Copy {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </button>

          {/* 3. Xóa */}
          <button
            type="button"
            onClick={handleDeleteSelected}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-4 py-2 text-xs sm:text-sm font-extrabold text-cyan-700 shadow-2xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
          >
            <Trash2 className="h-4 w-4 text-cyan-700" />
            Xóa {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </button>

          {/* 4. In báo cáo */}
          <button
            type="button"
            onClick={() => {
              if (orders.length > 0) {
                setSelectedOrder(orders[0]);
                setShowShippingModal(true);
              } else {
                setToast({ type: 'error', message: 'Không có phiếu để in' });
              }
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-4 py-2 text-xs sm:text-sm font-extrabold text-cyan-700 shadow-2xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
          >
            <Printer className="h-4 w-4 text-cyan-700" />
            In báo cáo
          </button>

          {/* 5. Export Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-4 py-2 text-xs sm:text-sm font-extrabold text-cyan-700 shadow-2xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-cyan-700" />
            Export Excel
          </button>

          {/* 6. Hiển thị */}
          <button
            type="button"
            onClick={() => setShowColumnSettings(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-4 py-2 text-xs sm:text-sm font-extrabold text-cyan-700 shadow-2xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            title="Cấu hình hiển thị cột"
          >
            <Settings className="h-4 w-4 text-cyan-700" />
            Hiển thị
          </button>

          {/* 7. Maximize */}
          <button
            type="button"
            onClick={toggleBrowserFullscreen}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-700 bg-white text-cyan-700 shadow-2xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            title="Toàn màn hình"
          >
            {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* 4 Summary Stat Boxes */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">{total} TỔNG PHIẾU</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">{pendingCount} CHỜ XỬ LÝ</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">{movingCount} ĐANG VẬN CHUYỂN</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">{doneCount} HOÀN THÀNH</p>
        </div>
      </div>

      {/* Filter & Search Panel */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Search input (h-12) */}
          <div className="relative flex-1 min-w-[320px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-cyan-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-12 w-full rounded-xl border-2 border-cyan-600/40 bg-white pl-11 pr-4 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-2xs"
              placeholder="Tìm theo số phiếu, kho chuyển/nhận, tài xế, SĐT, biển số xe, diễn giải..."
            />
          </div>

          {/* Date & Status Filters Container */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Time Filter Box (h-12) */}
            <div className="inline-flex h-12 items-center gap-2 rounded-xl border-2 border-cyan-600/30 bg-slate-50/80 px-3.5 shadow-2xs">
              <CalendarDays className="h-4.5 w-4.5 text-cyan-600 shrink-0" />
              <span className="text-xs font-extrabold uppercase text-cyan-950 tracking-wide whitespace-nowrap">Thời gian:</span>
              <select
                value={timeFilter}
                onChange={(event) => setTimeFilter(event.target.value as TimeFilter)}
                className="h-9 rounded-lg border-2 border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
              >
                <option value="this-month">Tháng này</option>
                <option value="7-days">7 ngày gần đây</option>
                <option value="all">Tất cả</option>
              </select>
            </div>

            {/* Status Filter Box (h-12) */}
            <div className="inline-flex h-12 items-center gap-2 rounded-xl border-2 border-cyan-600/30 bg-slate-50/80 px-3.5 shadow-2xs">
              <Filter className="h-4 w-4 text-cyan-600 shrink-0" />
              <span className="text-xs font-extrabold uppercase text-cyan-950 tracking-wide whitespace-nowrap">Trạng thái:</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="h-9 rounded-lg border-2 border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
              >
                <option value="all">Tất cả</option>
                <option value="DRAFT">Nháp</option>
                <option value="PENDING">Chờ duyệt</option>
                <option value="APPROVED">Đã duyệt</option>
                <option value="IN_TRANSIT">Đang điều chuyển</option>
                <option value="DELIVERED">Hoàn thành</option>
                <option value="CANCELLED">Đã hủy</option>
              </select>
            </div>

            {/* Reset Filter Button (h-12) */}
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-12 w-12 items-center justify-center rounded-xl border-2 border-cyan-700 bg-white text-cyan-700 shadow-2xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
              title="Đặt lại bộ lọc"
            >
              <RefreshCw className="h-4.5 w-4.5 text-cyan-700" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Transfer Orders Table with horizontal scroll support */}
      <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[1750px] border-collapse text-left">
            <thead className="bg-cyan-50 sticky top-0 z-20 shadow-sm">
              <tr className="border-b-2 border-slate-200 text-slate-800 font-extrabold uppercase text-xs sm:text-sm tracking-wider whitespace-nowrap">
                <th className="w-12 min-w-[50px] border-r border-slate-200 px-2 py-4 text-center whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4.5 w-4.5 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                  />
                </th>
                {columnVis.stt && <th className="w-14 min-w-[60px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">STT</th>}
                {columnVis.transferNo && <th className="min-w-[190px] border-r border-slate-200 px-4 py-4 text-center whitespace-nowrap">Số phiếu</th>}
                {columnVis.sourceWarehouse && <th className="min-w-[200px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Kho chuyển</th>}
                {columnVis.destinationWarehouse && <th className="min-w-[200px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Kho nhận</th>}
                {columnVis.dispatchDate && <th className="min-w-[170px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Ngày chuyển</th>}
                {columnVis.receiveDate && <th className="min-w-[170px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Ngày nhận</th>}
                {columnVis.driver && <th className="min-w-[200px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Tài xế & SĐT</th>}
                {columnVis.vehiclePlate && <th className="min-w-[130px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Biển số xe</th>}
                {columnVis.createdBy && <th className="min-w-[170px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Người tạo phiếu</th>}
                {columnVis.totalItems && <th className="min-w-[130px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Tổng mặt hàng</th>}
                {columnVis.totalQuantity && <th className="min-w-[130px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Tổng số lượng</th>}
                {columnVis.createdAt && <th className="min-w-[170px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Ngày lập</th>}
                {columnVis.status && <th className="min-w-[150px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Trạng thái</th>}
                <th className="sticky right-0 top-0 z-30 w-44 min-w-[160px] bg-cyan-100 px-3 py-4 text-center shadow-[-4px_0_12px_rgba(0,0,0,0.05)] border-l border-slate-200 text-cyan-950 font-black whitespace-nowrap">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white font-medium">
              {paginatedOrders.length > 0 ? (
                paginatedOrders.map((order, index) => {
                  const isDraftOrPending = order.status === 'DRAFT' || order.status === 'PENDING';
                  const totalItemsCount = order.items?.length || order.itemCount || 0;
                  const totalQuantityCount = order.totalQuantity || (order.items || []).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
                  const isChecked = selectedIds.has(order.id);

                  return (
                    <tr
                      key={order.id}
                      className="group border-b border-slate-200 transition hover:bg-cyan-50/60"
                    >
                      <td className="border-r border-slate-200 px-2 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleSelectOne(order.id, e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                        />
                      </td>
                      {columnVis.stt && (
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-medium text-slate-700">
                          {startIndex + index}
                        </td>
                      )}
                      {columnVis.transferNo && (
                        <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-extrabold text-cyan-700 whitespace-nowrap">
                          {order.transferNo}
                        </td>
                      )}
                      {columnVis.sourceWarehouse && (
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-bold text-slate-800">
                          {renderWarehouse(order.sourceWarehouse, warehouses)}
                        </td>
                      )}
                      {columnVis.destinationWarehouse && (
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-bold text-slate-800">
                          {renderWarehouse(order.destinationWarehouse, warehouses)}
                        </td>
                      )}
                      {columnVis.dispatchDate && (
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-semibold text-slate-700">
                          <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                            <Clock className="h-4 w-4 text-cyan-600 shrink-0" />
                            {formatDateTime(order.dispatchDate || order.scheduledDate || order.createdAt)}
                          </span>
                        </td>
                      )}
                      {columnVis.receiveDate && (
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-semibold text-slate-700">
                          <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                            <CalendarDays className="h-4 w-4 text-cyan-600 shrink-0" />
                            {formatDateTime(order.receiveDate || (order.dispatchDate ? new Date(new Date(order.dispatchDate).getTime() + 86400000).toISOString() : order.createdAt))}
                          </span>
                        </td>
                      )}
                      {columnVis.driver && (
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-semibold text-slate-800">
                          {order.driverName ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="font-extrabold text-slate-900">{order.driverName}</span>
                              {order.driverPhone && (
                                <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">
                                  {order.driverPhone}
                                </span>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                      )}
                      {columnVis.vehiclePlate && (
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-black text-slate-900 uppercase whitespace-nowrap">
                          {order.vehiclePlate || '-'}
                        </td>
                      )}
                      {columnVis.createdBy && (
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-semibold text-slate-700">
                          {renderCreator(order.createdBy)}
                        </td>
                      )}
                      {columnVis.totalItems && (
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-extrabold text-slate-900">
                          {totalItemsCount}
                        </td>
                      )}
                      {columnVis.totalQuantity && (
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-extrabold text-cyan-800 font-mono">
                          {totalQuantityCount.toLocaleString('vi-VN')}
                        </td>
                      )}
                      {columnVis.createdAt && (
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-semibold text-slate-700">
                          {formatDateTime(order.scheduledDate || (order as any).orderDate || order.createdAt)}
                        </td>
                      )}
                      {columnVis.status && (
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center align-middle">
                          <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-extrabold whitespace-nowrap ${statusConfig[order.status]?.color || 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                            {statusConfig[order.status]?.label || order.status}
                          </span>
                        </td>
                      )}
                      <td className="sticky right-0 z-10 w-44 min-w-[160px] bg-white group-hover:bg-cyan-50/90 px-3 py-3.5 text-center shadow-[-4px_0_12px_rgba(0,0,0,0.05)] border-l border-slate-200">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Nút Duyệt phiếu (chỉ xuất hiện đối với phiếu Nháp / Chờ duyệt) */}
                          {isDraftOrPending && (
                            <button
                              type="button"
                              onClick={() => handleApproveOrder(order)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-emerald-600 bg-white text-emerald-600 shadow-2xs transition hover:bg-emerald-50 cursor-pointer"
                              title="Duyệt phiếu xuất kho"
                            >
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" strokeWidth={2.5} />
                            </button>
                          )}

                          {/* Nút Chỉnh sửa */}
                          <button
                            type="button"
                            disabled={!isDraftOrPending}
                            onClick={() => navigate('/delivery/create-transfer-order', { state: { editOrderData: order } })}
                            className={`flex h-9 w-9 items-center justify-center rounded-xl border-2 shadow-2xs transition ${
                              isDraftOrPending
                                ? 'border-cyan-700 bg-white text-cyan-700 hover:bg-cyan-50 cursor-pointer'
                                : 'border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed opacity-50'
                            }`}
                            title={isDraftOrPending ? 'Chỉnh sửa phiếu nháp' : 'Phiếu đã duyệt / chính thức không thể chỉnh sửa'}
                          >
                            <Pencil className="h-4 w-4" strokeWidth={2.2} />
                          </button>

                          {/* Nút In / Xem phiếu */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowShippingModal(true);
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-700 bg-white text-cyan-700 shadow-2xs transition hover:bg-cyan-50 cursor-pointer"
                            title="In / Xem phiếu xuất kho"
                          >
                            <FileText className="h-4 w-4 text-cyan-700" strokeWidth={2.2} />
                          </button>

                          {/* Nút Xóa phiếu */}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(order)}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-red-600 bg-white text-red-600 shadow-2xs transition hover:bg-red-50 cursor-pointer"
                            title="Xóa phiếu xuất kho"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" strokeWidth={2.2} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-500 font-semibold text-sm">
                    Chưa có phiếu xuất kho nội bộ. Hãy bấm nút "Thêm mới" để bắt đầu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t-2 border-slate-200 bg-slate-50/90 px-4 py-3.5 text-sm font-bold text-slate-700">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-slate-700">Hiển thị:</span>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setCurrentPage(1);
                }}
                className="h-9 rounded-xl border-2 border-slate-300 bg-white px-3 text-sm font-black text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer shadow-xs"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
              </select>
              <span className="text-sm font-bold text-slate-600">dòng/trang</span>
            </div>
            <div className="border-l-2 border-slate-300 pl-3 text-sm font-semibold text-slate-600">
              Hiển thị <span className="font-extrabold text-slate-900">{totalItems > 0 ? startIndex : 0}</span> -{' '}
              <span className="font-extrabold text-slate-900">{endIndex}</span> trên tổng <span className="font-black text-cyan-800">{totalItems}</span> phiếu xuất
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm font-bold">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-slate-700 hover:bg-cyan-50 hover:border-cyan-600 hover:text-cyan-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-slate-300 disabled:hover:text-slate-700 transition cursor-pointer shadow-2xs"
              title="Trang đầu"
            >
              <ChevronsLeft size={18} strokeWidth={2.5} />
            </button>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-slate-700 hover:bg-cyan-50 hover:border-cyan-600 hover:text-cyan-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-slate-300 disabled:hover:text-slate-700 transition cursor-pointer shadow-2xs"
              title="Trang trước"
            >
              <ChevronLeft size={18} strokeWidth={2.5} />
            </button>
            <span className="px-2 text-sm font-extrabold text-slate-800">
              Trang <span className="text-cyan-700 font-black">{currentPage}</span> / {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-slate-700 hover:bg-cyan-50 hover:border-cyan-600 hover:text-cyan-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-slate-300 disabled:hover:text-slate-700 transition cursor-pointer shadow-2xs"
              title="Trang tiếp"
            >
              <ChevronRight size={18} strokeWidth={2.5} />
            </button>
            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(totalPages)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-slate-700 hover:bg-cyan-50 hover:border-cyan-600 hover:text-cyan-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-slate-300 disabled:hover:text-slate-700 transition cursor-pointer shadow-2xs"
              title="Trang cuối"
            >
              <ChevronsRight size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      {/* Column Settings Modal (Hiển thị) */}
      {showColumnSettings &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border-2 border-cyan-500">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-base font-black text-slate-900 uppercase flex items-center gap-2">
                  <Settings className="h-5 w-5 text-cyan-600" />
                  Cấu hình Cột Hiển Thị
                </h3>
                <button
                  type="button"
                  onClick={() => setShowColumnSettings(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 max-h-[60vh] overflow-y-auto space-y-2 text-xs font-bold text-slate-700">
                {[
                  { key: 'stt', label: 'Số Thứ Tự (STT)' },
                  { key: 'transferNo', label: 'Số Phiếu' },
                  { key: 'sourceWarehouse', label: 'Kho Chuyển' },
                  { key: 'destinationWarehouse', label: 'Kho Nhận' },
                  { key: 'dispatchDate', label: 'Ngày Chuyển' },
                  { key: 'receiveDate', label: 'Ngày Nhận' },
                  { key: 'driver', label: 'Tài Xế & SĐT' },
                  { key: 'vehiclePlate', label: 'Biển Số Xe' },
                  { key: 'createdBy', label: 'Người Tạo Phiếu' },
                  { key: 'totalItems', label: 'Tổng Mặt Hàng' },
                  { key: 'totalQuantity', label: 'Tổng Số Lượng' },
                  { key: 'createdAt', label: 'Ngày Lập' },
                  { key: 'status', label: 'Trạng Thái' },
                ].map((col) => (
                  <label key={col.key} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 hover:bg-cyan-50/50 cursor-pointer">
                    <span className="text-slate-800">{col.label}</span>
                    <input
                      type="checkbox"
                      checked={columnVis[col.key] ?? true}
                      onChange={(e) => setColumnVis((prev) => ({ ...prev, [col.key]: e.target.checked }))}
                      className="h-4.5 w-4.5 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                    />
                  </label>
                ))}
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowColumnSettings(false)}
                  className="rounded-xl border-2 border-cyan-600 bg-cyan-600 px-5 py-2 text-xs font-black text-white hover:bg-cyan-700 cursor-pointer"
                >
                  XÁC NHẬN & ĐÓNG
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="rounded-xl bg-red-100 p-2 text-red-600">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Xóa phiếu xuất kho nội bộ</h3>
            </div>
            <p className="text-sm font-semibold text-slate-600">
              Bạn có chắc chắn muốn xóa phiếu xuất kho nội bộ <span className="font-extrabold text-slate-900">{deleteTarget.transferNo}</span> không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleDeleteOrder}
                disabled={deleting}
                className="rounded-xl bg-red-600 px-5 py-2 text-sm font-bold text-white shadow-md transition hover:bg-red-700 cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      <TransferOrderModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSaved={loadOrders}
        setToast={(nextToast) => setToast(nextToast)}
      />

      <InternalShippingNoteModal
        open={showShippingModal}
        onClose={() => {
          setShowShippingModal(false);
          setSelectedOrder(null);
        }}
        initialData={
          selectedOrder
            ? {
                commandNo: `12/LDD-${selectedOrder.transferNo || 'KTTU'}`,
                sourceAddress: renderWarehouse(selectedOrder.sourceWarehouse, warehouses),
                receiverName: renderCreator(selectedOrder.createdBy),
                destinationAddress: renderWarehouse(selectedOrder.destinationWarehouse, warehouses),
                items: selectedOrder.items && selectedOrder.items.length > 0
                  ? selectedOrder.items.map((item, idx) => ({
                      id: item.id || String(idx + 1),
                      productName: item.productName || 'Sản phẩm điều chuyển',
                      productCode: item.productCode || 'SKU-001',
                      unit: item.unit || 'Cái',
                      quantityExported: Number(item.quantity) || 1,
                      quantityImported: Number(item.quantity) || 1,
                      price: 10000000,
                    }))
                  : undefined,
              }
            : undefined
        }
        setToast={setToast}
      />
    </div>
  );
}
