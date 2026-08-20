import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  Package,
  Plus,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  Clock,
  CalendarDays,
  Truck,
  Eye,
  Pencil,
  Trash2,
  FileText,
  X,
  Sparkles,
  Copy,
  Printer,
  FileSpreadsheet,
  Settings,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Save,
  Check,
  Building2,
  MapPin,
  User,
  Calendar,
  Layers,
  Bot,
} from 'lucide-react';
import { deliveryApi, type TransferOrder, type TransferOrderItem } from '../api/deliveryApi';
import InternalShippingNoteModal from '../components/InternalShippingNoteModal';
import { SmartSlottingGridModal } from '../../warehouses/components/SmartSlottingGridModal';
import { getStoredWarehouses, mergeStoredWarehouses, type WarehouseRecord } from '../../../shared/utils/warehouseAssignments';


type Toast = {
  type: 'success' | 'error';
  message: string;
};

type TimeFilter = 'this-month' | '7-days' | 'all';
type StatusFilter = 'all' | 'DRAFT' | 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Nháp', color: 'border-slate-200 bg-slate-50 text-slate-700' },
  PENDING: { label: 'Chờ xử lý', color: 'border-amber-300 bg-amber-50 text-amber-800 font-bold' },
  APPROVED: { label: 'Đã duyệt', color: 'border-cyan-300 bg-cyan-50 text-cyan-800 font-bold' },
  IN_TRANSIT: { label: 'Đang giao', color: 'border-blue-400 bg-blue-50 text-blue-800 font-bold' },
  DELIVERED: { label: 'Đã nhận hàng', color: 'border-emerald-400 bg-emerald-50 text-emerald-800 font-bold' },
  COMPLETED: { label: 'Đã nhận hàng', color: 'border-emerald-400 bg-emerald-50 text-emerald-800 font-bold' },
  CANCELLED: { label: 'Đã hủy', color: 'border-red-300 bg-red-50 text-red-700 font-bold' },
};

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${hours}:${minutes} ${day}/${month}/${year}`;
}

function renderWarehouse(wh?: string, warehousesList: WarehouseRecord[] = []) {
  if (!wh) return '-';
  const found = warehousesList.find((w) => w.code === wh || w.id === wh || w.name === wh);
  if (found) {
    if (found.name && found.code && found.name !== found.code) {
      return `${found.name} (${found.code})`;
    }
    return found.name || found.code;
  }
  if (wh === 'KH006') return 'Kho Thanh Trì (KH006)';
  if (wh === 'KH002') return 'Kho Chi Nhánh HCM (KH002)';
  return wh;
}

function renderCreator(creator?: string | null) {
  if (!creator || creator === 'NPT_Staff') return 'System Administrator';
  return creator;
}

export default function TransferRequestsPage() {
  const navigate = useNavigate();
  const [toast, setToast] = useState<Toast | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('this-month');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [orders, setOrders] = useState<TransferOrder[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>(() => getStoredWarehouses());
  const [products, setProducts] = useState<any[]>([]);

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dedicated Stock-In Receive View state (Modeled directly on CreateTransferOrderPage layout)
  const [receiveModalOrder, setReceiveModalOrder] = useState<TransferOrder | null>(null);
  const [receiveItems, setReceiveItems] = useState<any[]>([]);
  const [receiveSaving, setReceiveSaving] = useState(false);

  // Pick Bin Slotting Modal state
  const [slottingModalOpen, setSlottingModalOpen] = useState(false);
  const [activeSlottingRowId, setActiveSlottingRowId] = useState<string | null>(null);

  const [shippingNoteOrder, setShippingNoteOrder] = useState<TransferOrder | null>(null);
  const [isShippingNoteModalOpen, setIsShippingNoteModalOpen] = useState(false);

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
      const saved = localStorage.getItem('transfer_requests_column_vis');
      return saved ? { ...DEFAULT_COLUMN_VIS, ...JSON.parse(saved) } : DEFAULT_COLUMN_VIS;
    } catch {
      return DEFAULT_COLUMN_VIS;
    }
  });

  useEffect(() => {
    localStorage.setItem('transfer_requests_column_vis', JSON.stringify(columnVis));
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

  // Pagination
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Load warehouses & products
  useEffect(() => {
    async function loadAuxData() {
      try {
        const token = localStorage.getItem('token') || '';
        const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

        const [whRes, prodRes] = await Promise.all([
          fetch('http://localhost:3000/api/warehouses', { headers }).catch(() => null),
          fetch('http://localhost:3000/api/products', { headers }).catch(() => null),
        ]);

        if (whRes && whRes.ok) {
          const list = await whRes.json();
          const rawList = Array.isArray(list) ? list : list.data || [];
          setWarehouses(mergeStoredWarehouses(rawList, getStoredWarehouses()));
        }
        if (prodRes && prodRes.ok) {
          const plist = await prodRes.json();
          setProducts(Array.isArray(plist) ? plist : plist.data || []);
        }
      } catch (e) {
        console.error('Lỗi tải danh mục kho/sản phẩm:', e);
      }
    }
    loadAuxData();
  }, []);

  // Fetch real transfer orders from CSDL
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await deliveryApi.listTransferOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (error: any) {
      setToast({ type: 'error', message: error.message || 'Không thể tải danh sách phiếu điều chuyển nhập kho' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Open Receive & Bin Slotting View mode (Inverted CreateTransferOrderPage for Stock-In)
  const openReceiveModal = (order: TransferOrder) => {
    setReceiveModalOrder(order);
    const preparedItems = (order.items || []).map((it, idx) => ({
      rowId: `rec-row-${it.id || idx}`,
      productId: it.id || '',
      productSku: it.productCode || '',
      productName: it.productName || '',
      unit: it.unit || 'Cái',
      qty: Number(it.quantity) || 1,
      receivedQty: Number(it.quantity) || 1,
      price: Number((it as any).price || 0),
      locationBin: (it as any).locationBin || (Array.isArray((it as any).assignedBins) ? (it as any).assignedBins.join(', ') : ''),
      assignedBins: Array.isArray((it as any).assignedBins)
        ? (it as any).assignedBins
        : (it as any).locationBin
        ? String((it as any).locationBin).split(',').map((b: string) => b.trim()).filter(Boolean)
        : [],
      note: (it as any).note || '',
    }));
    setReceiveItems(preparedItems);
  };

  // Open AI Bin Slotting Modal for Destination Warehouse
  const openSlottingModalForRow = (rowId: string) => {
    setActiveSlottingRowId(rowId);
    setSlottingModalOpen(true);
  };

  const handleConfirmSlottingBins = (updatedRows: any[]) => {
    setReceiveItems(updatedRows);
  };

  // Confirm Stock-In Receive & Bin Slotting
  const handleConfirmReceive = async () => {
    if (!receiveModalOrder) return;
    setReceiveSaving(true);
    try {
      const updatedItems: TransferOrderItem[] = receiveItems.map((it) => ({
        id: it.productId || it.rowId,
        productCode: it.productSku,
        productName: it.productName,
        unit: it.unit,
        quantity: Math.max(1, Number(it.receivedQty) || Number(it.qty) || 1),
        price: Number(it.price || 0),
        locationBin: it.locationBin ? String(it.locationBin).trim() : Array.isArray(it.assignedBins) && it.assignedBins.length > 0 ? it.assignedBins.join(', ') : undefined,
        assignedBins: Array.isArray(it.assignedBins) && it.assignedBins.length > 0 ? it.assignedBins : undefined,
        note: it.note ? String(it.note).trim() : undefined,
      }));

      await deliveryApi.updateTransferOrder(receiveModalOrder.id, {
        status: 'DELIVERED',
        receiveDate: new Date().toISOString(),
        items: updatedItems,
      });

      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('warehouse-goods-cleared'));

      setToast({ type: 'success', message: `Xác nhận nhập kho & phân bổ ô kệ thành công cho phiếu: ${receiveModalOrder.transferNo}` });
      setReceiveModalOrder(null);
      fetchOrders();
    } catch (e: any) {
      setToast({ type: 'error', message: e.message || 'Lỗi khi xác nhận nhập kho' });
    } finally {
      setReceiveSaving(false);
    }
  };

  // Handle Single Delete
  const handleDeleteOrder = async (order: TransferOrder) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa phiếu nhập chuyển kho ${order.transferNo}?`)) return;
    try {
      await deliveryApi.deleteTransferOrder(order.id);
      setToast({ type: 'success', message: `Đã xóa thành công phiếu: ${order.transferNo}` });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
      fetchOrders();
    } catch (e: any) {
      setToast({ type: 'error', message: e.message || 'Không thể xóa phiếu điều chuyển' });
    }
  };

  // Handle Selected Delete
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      setToast({ type: 'error', message: 'Vui lòng chọn ít nhất 1 phiếu để xóa' });
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.size} phiếu đã chọn?`)) return;

    try {
      for (const id of selectedIds) {
        await deliveryApi.deleteTransferOrder(id).catch(() => null);
      }
      setToast({ type: 'success', message: `Đã xóa thành công ${selectedIds.size} phiếu` });
      setSelectedIds(new Set());
      fetchOrders();
    } catch (e: any) {
      setToast({ type: 'error', message: e.message || 'Lỗi khi xóa các phiếu đã chọn' });
    }
  };

  // Handle Copy Selected
  const handleCopySelected = () => {
    if (selectedIds.size === 0) {
      setToast({ type: 'error', message: 'Vui lòng chọn 1 phiếu để sao chép' });
      return;
    }
    const firstId = Array.from(selectedIds)[0];
    const target = orders.find((o) => o.id === firstId);
    if (target) {
      navigate('/delivery/receive-transfer-order', { state: { copyFromOrder: target, mode: 'receive', fromRequests: true } });
      setToast({ type: 'success', message: `Đã sao chép thông tin phiếu: ${target.transferNo}` });
    }
  };

  // Export Excel / CSV
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
      formatDateTime(o.createdAt),
      statusConfig[o.status]?.label || o.status,
    ]);
    const csv = [header, ...rows].map((r) => r.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nhap_kho_chuyen_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setToast({ type: 'success', message: 'Đã xuất dữ liệu Excel/CSV thành công!' });
  };

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (order.transferNo && order.transferNo.toLowerCase().includes(q)) ||
        (order.driverName && order.driverName.toLowerCase().includes(q)) ||
        (order.createdBy && order.createdBy.toLowerCase().includes(q)) ||
        (order.sourceWarehouse && order.sourceWarehouse.toLowerCase().includes(q)) ||
        (order.destinationWarehouse && order.destinationWarehouse.toLowerCase().includes(q));

      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, timeFilter]);

  // Bulk Checkbox handlers
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

  const totalItems = filteredOrders.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);
  const paginatedOrders = useMemo(() => {
    return filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  // Statistics
  const total = orders.length;
  const pendingCount = useMemo(() => orders.filter((o) => o.status === 'DRAFT' || o.status === 'PENDING').length, [orders]);
  const movingCount = useMemo(() => orders.filter((o) => o.status === 'IN_TRANSIT').length, [orders]);
  const doneCount = useMemo(() => orders.filter((o) => o.status === 'DELIVERED' || o.status === 'COMPLETED' || o.status === 'APPROVED').length, [orders]);

  const resetFilters = () => {
    setSearch('');
    setTimeFilter('this-month');
    setStatusFilter('all');
  };

  // ════════════════════════════════════════════════════════════════
  // 🏢 RENDER DEDICATED RECEIVE / STOCK-IN VIEW (Inverted CreateTransferOrderPage style)
  // ════════════════════════════════════════════════════════════════
  if (receiveModalOrder) {
    const destWhName = renderWarehouse(receiveModalOrder.destinationWarehouse, warehouses);
    const sourceWhName = renderWarehouse(receiveModalOrder.sourceWarehouse, warehouses);

    const totalDispatchedQty = receiveItems.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
    const totalReceivedQty = receiveItems.reduce((acc, it) => acc + (Number(it.receivedQty) || 0), 0);

    return (
      <div className="space-y-6 pb-12">
        {/* Header & Back Navigation */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setReceiveModalOrder(null)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-slate-700 transition hover:bg-cyan-50 hover:border-cyan-600 hover:text-cyan-700 cursor-pointer shadow-xs"
              title="Quay lại danh sách phiếu"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-1 text-xs font-black text-white uppercase shadow-xs">
                  <Package className="h-3.5 w-3.5" /> Nhận Hàng & Phân Bổ Ô Kệ
                </span>
                <span className="text-sm font-extrabold text-cyan-800 font-mono">
                  #{receiveModalOrder.transferNo}
                </span>
              </div>
              <h1 className="text-xl font-black text-slate-900 mt-1">
                Lập Phiếu Nhập Kho Điều Chuyển Nội Bộ
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setReceiveModalOrder(null)}
              className="rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleConfirmReceive}
              disabled={receiveSaving}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-cyan-600 bg-cyan-600 px-6 py-2.5 text-xs sm:text-sm font-black text-white shadow-md transition hover:bg-cyan-700 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="h-4.5 w-4.5" />
              {receiveSaving ? 'Đang lưu...' : 'XÁC NHẬN NHẬP KHO & PHÂN BỔ Ô KỆ'}
            </button>
          </div>
        </div>

        {/* Transfer Order Details Header Panel */}
        <div className="rounded-2xl border-2 border-cyan-500/40 bg-white p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2 border-b border-slate-200 pb-3">
            <Building2 className="h-4.5 w-4.5 text-cyan-600" />
            Thông Tin Phiếu Điều Chuyển Đến
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs font-bold text-slate-800">
            {/* Kho chuyển */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <span className="text-slate-500 font-semibold block mb-1">Kho Chuyển (Nơi gửi):</span>
              <span className="text-sm font-black text-slate-900 block">{sourceWhName}</span>
            </div>

            {/* Kho nhận */}
            <div className="rounded-xl border-2 border-cyan-500/50 bg-cyan-50/60 p-3">
              <span className="text-cyan-800 font-bold block mb-1">Kho Nhận (Nơi cất hàng):</span>
              <span className="text-sm font-black text-cyan-950 block">{destWhName}</span>
            </div>

            {/* Tài xế & Xe */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <span className="text-slate-500 font-semibold block mb-1">Tài Xế & Biển Số Xe:</span>
              <span className="text-sm font-black text-slate-900 block">
                {receiveModalOrder.driverName || 'Chưa cập nhật'} {receiveModalOrder.vehiclePlate ? `(${receiveModalOrder.vehiclePlate})` : ''}
              </span>
            </div>

            {/* Ngày chuyển / Nhận */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <span className="text-slate-500 font-semibold block mb-1">Ngày Vận Chuyển:</span>
              <span className="text-sm font-black text-slate-900 block">
                {formatDateTime(receiveModalOrder.dispatchDate || receiveModalOrder.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Products Receive & Slotting Grid Table */}
        <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm space-y-4">
          <div className="flex items-center justify-between px-5 pt-4">
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <Layers className="h-5 w-5 text-cyan-600" />
                Danh Sách Mặt Hàng & Phân Bổ Ô Kệ Kho Nhận
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Nhập số lượng thực nhận và bấm nút <b className="text-cyan-700">"Chọn ô kệ nhập kho"</b> để phân bổ chính xác ô kệ trong kho nhận ({destWhName}).
              </p>
            </div>

            <button
              type="button"
              onClick={() => openSlottingModalForRow(receiveItems[0]?.rowId || '')}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-cyan-700 bg-cyan-50 px-4 py-2 text-xs font-black text-cyan-800 shadow-2xs transition hover:bg-cyan-100 cursor-pointer"
            >
              <Sparkles className="h-4 w-4 text-cyan-600" />
              Gợi ý phân bổ ô kệ AI toàn bộ
            </button>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[1200px] border-collapse text-left">
              <thead className="bg-cyan-50 sticky top-0 z-10 shadow-2xs">
                <tr className="border-b-2 border-slate-200 text-slate-800 font-extrabold uppercase text-xs tracking-wider whitespace-nowrap">
                  <th className="w-12 border-r border-slate-200 px-3 py-3.5 text-center">STT</th>
                  <th className="min-w-[150px] border-r border-slate-200 px-4 py-3.5 text-center">Mã SP (SKU)</th>
                  <th className="min-w-[240px] border-r border-slate-200 px-4 py-3.5">Tên Hàng Hóa</th>
                  <th className="w-24 border-r border-slate-200 px-3 py-3.5 text-center">ĐVT</th>
                  <th className="w-32 border-r border-slate-200 px-3 py-3.5 text-center">SL Gửi</th>
                  <th className="w-36 border-r border-slate-200 px-3 py-3.5 text-center">SL Thực Nhận</th>
                  <th className="min-w-[320px] border-r border-slate-200 px-4 py-3.5 text-center">Phân Khu & Ô Kệ Nhập Kho</th>
                  <th className="min-w-[200px] px-4 py-3.5">Ghi Chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white font-medium text-xs">
                {receiveItems.map((item, idx) => {
                  const assignedList = item.assignedBins || (item.locationBin ? String(item.locationBin).split(',').map((s: string) => s.trim()).filter(Boolean) : []);

                  return (
                    <tr key={item.rowId} className="hover:bg-cyan-50/40 transition">
                      <td className="border-r border-slate-200 px-3 py-3.5 text-center font-bold text-slate-700">
                        {idx + 1}
                      </td>
                      <td className="border-r border-slate-200 px-4 py-3.5 text-center font-extrabold text-cyan-800 whitespace-nowrap">
                        {item.productSku || 'SKU-00' + (idx + 1)}
                      </td>
                      <td className="border-r border-slate-200 px-4 py-3.5 font-bold text-slate-900">
                        {item.productName || 'Sản phẩm điều chuyển'}
                      </td>
                      <td className="border-r border-slate-200 px-3 py-3.5 text-center font-semibold text-slate-700">
                        {item.unit || 'Cái'}
                      </td>
                      <td className="border-r border-slate-200 px-3 py-3.5 text-center font-black text-slate-900 font-mono">
                        {Number(item.qty).toLocaleString('vi-VN')}
                      </td>
                      <td className="border-r border-slate-200 px-3 py-3 text-center">
                        <input
                          type="number"
                          min={1}
                          value={item.receivedQty}
                          onChange={(e) => {
                            const val = Math.max(1, Number(e.target.value) || 1);
                            setReceiveItems((prev) =>
                              prev.map((r) => (r.rowId === item.rowId ? { ...r, receivedQty: val } : r))
                            );
                          }}
                          className="h-9 w-28 rounded-xl border-2 border-cyan-600/40 bg-white px-2.5 text-center font-black text-cyan-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20"
                        />
                      </td>
                      <td className="border-r border-slate-200 px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-2">
                          {assignedList.length > 0 ? (
                            <div className="flex flex-wrap items-center justify-center gap-1.5">
                              {assignedList.map((bin: string) => (
                                <span
                                  key={bin}
                                  className="inline-flex items-center gap-1 rounded-lg border border-cyan-300 bg-cyan-100 px-2.5 py-1 text-[11px] font-black text-cyan-950 shadow-2xs"
                                >
                                  <MapPin className="h-3 w-3 text-cyan-700" />
                                  {bin}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 font-bold italic text-[11px]">Chưa phân bổ ô kệ</span>
                          )}

                          <button
                            type="button"
                            onClick={() => openSlottingModalForRow(item.rowId)}
                            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-cyan-700 bg-white px-3 py-1.5 text-[11px] font-extrabold text-cyan-800 shadow-2xs transition hover:bg-cyan-50 cursor-pointer"
                          >
                            <Sparkles className="h-3.5 w-3.5 text-cyan-600" />
                            {assignedList.length > 0 ? 'Đổi vị trí ô kệ' : 'Chọn ô kệ nhập kho'}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={item.note || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setReceiveItems((prev) =>
                              prev.map((r) => (r.rowId === item.rowId ? { ...r, note: val } : r))
                            );
                          }}
                          placeholder="Ghi chú nhận..."
                          className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-cyan-600"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Summary Bar */}
          <div className="flex flex-wrap items-center justify-between border-t-2 border-slate-200 bg-slate-50 px-6 py-4 text-xs font-bold text-slate-700">
            <div className="flex items-center gap-6">
              <span>Tổng mặt hàng: <b className="text-slate-900 font-black text-sm">{receiveItems.length}</b></span>
              <span>Tổng SL gửi: <b className="text-slate-900 font-black text-sm font-mono">{totalDispatchedQty.toLocaleString('vi-VN')}</b></span>
              <span>Tổng SL thực nhận: <b className="text-cyan-800 font-black text-base font-mono">{totalReceivedQty.toLocaleString('vi-VN')}</b></span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setReceiveModalOrder(null)}
                className="rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmReceive}
                disabled={receiveSaving}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-cyan-600 bg-cyan-600 px-6 py-2.5 text-xs font-black text-white shadow-md hover:bg-cyan-700 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {receiveSaving ? 'Đang lưu...' : 'XÁC NHẬN NHẬP KHO & PHÂN BỔ Ô KỆ'}
              </button>
            </div>
          </div>
        </div>

        {/* AI Smart Slotting Grid Modal for Destination Warehouse */}
        <SmartSlottingGridModal
          isOpen={slottingModalOpen}
          onClose={() => setSlottingModalOpen(false)}
          mode="INBOUND"
          warehouseCode={receiveModalOrder.destinationWarehouse || 'KH002'}
          items={receiveItems}
          targetRowId={activeSlottingRowId}
          products={products}
          onConfirmAll={handleConfirmSlottingBins}
        />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // 🏢 RENDER MAIN TRANSFER REQUESTS LIST PAGE
  // ════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* Header Banner & Action Buttons Bar (Exact match with Image 2) */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-md">
            <Package className="h-5 w-5 text-cyan-100" />
            <h1 className="text-lg font-bold tracking-tight text-white">Quản Lý Nhập Kho Nội Bộ</h1>
          </div>
        </div>

        {/* Toolbar Buttons Bar (Matching Image 2: + Thêm mới, Copy, Xóa, In báo cáo, Export Excel, Hiển thị, Maximize) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. + Thêm mới */}
          <button
            type="button"
            onClick={() => {
              navigate('/delivery/receive-transfer-order', { state: { mode: 'receive', fromRequests: true } });
            }}
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
                setShippingNoteOrder(orders[0]);
                setIsShippingNoteModalOpen(true);
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
                <option value="PENDING">Chờ xử lý</option>
                <option value="IN_TRANSIT">Đang vận chuyển</option>
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
              <RefreshCw className={`h-4.5 w-4.5 text-cyan-700 ${loading ? 'animate-spin' : ''}`} />
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
                  const isDraftOrPending = order.status === 'DRAFT' || order.status === 'PENDING' || order.status === 'IN_TRANSIT';
                  const totalItemsCount = order.items?.length || order.itemCount || 0;
                  const totalQuantityCount = order.totalQuantity || (order.items || []).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
                  const isChecked = selectedIds.has(order.id);

                  return (
                    <tr key={order.id} className="group border-b border-slate-200 transition hover:bg-cyan-50/60">
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
                          {formatDateTime(order.createdAt)}
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
                        {/* Action buttons matching exact design & user request */}
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Nút Duyệt / Nhận hàng -> Chỉ hiện đối với phiếu chưa hoàn thành */}
                          {isDraftOrPending && (
                            <button
                              type="button"
                              onClick={() => navigate('/delivery/receive-transfer-order', { state: { editOrderData: order, mode: 'receive', fromRequests: true } })}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-emerald-600 bg-white text-emerald-600 shadow-2xs transition hover:bg-emerald-50 cursor-pointer"
                              title="Đã nhận hàng & Chọn ô kệ nhập kho"
                            >
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" strokeWidth={2.5} />
                            </button>
                          )}

                          {/* Nút Xem / Sửa phiếu */}
                          {(order.status as string) === 'DELIVERED' || (order.status as string) === 'COMPLETED' || (order.status as string) === 'RECEIVED' ? (
                            <button
                              type="button"
                              onClick={() => navigate('/delivery/receive-transfer-order', { state: { editOrderData: order, mode: 'receive', fromRequests: true, isReadOnly: true } })}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-700 bg-white text-cyan-700 shadow-2xs transition hover:bg-cyan-50 cursor-pointer"
                              title="Xem chi tiết phiếu (Chỉ xem)"
                            >
                              <Eye className="h-4 w-4 text-cyan-700" strokeWidth={2.2} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => navigate('/delivery/receive-transfer-order', { state: { editOrderData: order, mode: 'receive', fromRequests: true } })}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-700 bg-white text-cyan-700 shadow-2xs transition hover:bg-cyan-50 cursor-pointer"
                              title="Xếp vào ô kệ kho nhận"
                            >
                              <Pencil className="h-4 w-4 text-cyan-700" strokeWidth={2.2} />
                            </button>
                          )}

                          {/* Nút In / Xem chứng từ */}
                          <button
                            type="button"
                            onClick={() => {
                              setShippingNoteOrder(order);
                              setIsShippingNoteModalOpen(true);
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-700 bg-white text-cyan-700 shadow-2xs transition hover:bg-cyan-50 cursor-pointer"
                            title="In / Xem chứng từ"
                          >
                            <FileText className="h-4 w-4 text-cyan-700" strokeWidth={2.2} />
                          </button>

                          {/* Nút Xóa phiếu */}
                          <button
                            type="button"
                            onClick={() => handleDeleteOrder(order)}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-red-600 bg-white text-red-600 shadow-2xs transition hover:bg-red-50 cursor-pointer"
                            title="Xóa phiếu"
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
                    Chưa có phiếu nhập kho nội bộ. Hãy bấm nút "Thêm mới" để bắt đầu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Section */}
        <div className="flex flex-col items-center justify-between border-t-2 border-slate-200 bg-white px-6 py-4 sm:flex-row">
          <div className="text-sm font-semibold text-slate-700">
            Hiển thị:
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="mx-2 h-9 rounded-lg border-2 border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            dòng/trang
            <span className="ml-3 font-medium text-slate-500">
              Hiển thị <b className="font-extrabold text-slate-900">{startIndex}</b> - <b className="font-extrabold text-slate-900">{endIndex}</b> trên tổng <b className="font-extrabold text-slate-900">{totalItems}</b> phiếu nhập
            </span>
          </div>

          <div className="mt-4 flex items-center gap-2 sm:mt-0">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-sm font-extrabold text-slate-600 transition hover:bg-cyan-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              «
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-sm font-extrabold text-slate-600 transition hover:bg-cyan-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              ‹
            </button>
            <span className="px-3 text-sm font-extrabold text-slate-800">
              Trang {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-sm font-extrabold text-slate-600 transition hover:bg-cyan-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages || totalPages === 0}
              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-sm font-extrabold text-slate-600 transition hover:bg-cyan-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              »
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

      {/* Internal Shipping Note Modal for printing */}
      <InternalShippingNoteModal
        open={isShippingNoteModalOpen}
        onClose={() => {
          setIsShippingNoteModalOpen(false);
          setShippingNoteOrder(null);
        }}
        initialData={
          shippingNoteOrder
            ? {
                commandNo: shippingNoteOrder.transferNo,
                sourceAddress: renderWarehouse(shippingNoteOrder.sourceWarehouse, warehouses),
                receiverName: renderCreator(shippingNoteOrder.createdBy),
                destinationAddress: renderWarehouse(shippingNoteOrder.destinationWarehouse, warehouses),
                transporterName: shippingNoteOrder.driverName || 'Chưa phân công',
                vehicle: shippingNoteOrder.vehiclePlate || 'Chưa cập nhật',
                items: (shippingNoteOrder.items || []).map((item, idx) => ({
                  id: item.id || String(idx + 1),
                  productName: item.productName || 'Sản phẩm điều chuyển',
                  productCode: item.productCode || 'SKU---',
                  unit: item.unit || 'Cái',
                  quantityExported: item.quantity || 1,
                  quantityImported: item.quantity || 1,
                  price: Number((item as any).price || 0),
                })),
              }
            : undefined
        }
        setToast={setToast}
      />

      {/* Global Toast */}
      {toast && (
        <div
          className={`fixed right-4 top-4 z-[999999] flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-2xl ${
            toast.type === 'error' ? 'border-red-200 text-red-600' : 'border-emerald-200 text-emerald-600'
          }`}
        >
          <p className="text-sm font-bold">{toast.message}</p>
          <button type="button" onClick={() => setToast(null)} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
