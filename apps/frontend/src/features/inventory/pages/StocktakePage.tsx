import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  ClipboardList,
  X,
  XCircle,
  CheckCircle,
  Eye,
  Trash2,
  Check,
  Ban,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  PackageSearch,
  ListChecks,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Printer,
  FileSpreadsheet,
  FileDown,
  Settings2,
  Settings,
  Home,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  ChevronDown,
  Camera,
} from 'lucide-react';
import BarcodeScanner, { ScanBarcodeButton, type ScannedProduct } from '../../../shared/components/BarcodeScanner';

// ─── TOAST ─────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  React.useEffect(() => {
    if (message) {
      const timer = setTimeout(() => onClose(), 3500);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-[60] flex items-center gap-3 rounded-xl px-5 py-3 shadow-lg transition-all animate-[slideIn_0.3s_ease-out] ${type === 'error'
        ? 'bg-red-50 text-red-600 border border-red-200'
        : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
        }`}
    >
      {type === 'error' ? <XCircle size={20} /> : <CheckCircle size={20} />}
      <p className="text-sm font-semibold">{message}</p>
      <button onClick={onClose} className="ml-2 rounded-lg p-1 hover:bg-white/50 transition">
        <X size={16} />
      </button>
    </div>
  );
}

// ─── TYPES ─────────────────────────────────────────────────────

interface StocktakeDetail {
  id: string;
  systemQty: number;
  countedQty: number | null;
  difference: number;
  note?: string;
  product: {
    id: string;
    internalSku: string;
    name: string;
    unit?: string;
  } | null;
}

interface StocktakeItem {
  id: string;
  stocktakeNo: string;
  locationCode: string;
  status: string;
  plannedDate?: string;
  assignee?: string;
  note?: string;
  createdBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  details: StocktakeDetail[];
  totalItems: number;
  countedItems: number;
  differenceItems: number;
}

interface ProductOption {
  id: string;
  internalSku: string;
  name: string;
  unit?: string;
}

// ─── API HELPERS ───────────────────────────────────────────────

const API_BASE = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

// ─── STATUS CONFIG ─────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string }> = {
  REQUESTED: { label: 'Yêu cầu', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
  DRAFT: { label: 'Nháp', color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200' },
  COUNTING: { label: 'Đang đếm', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  COUNTING_DONE: { label: 'Chờ duyệt', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  APPROVED: { label: 'Đã duyệt', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  REJECTED: { label: 'Từ chối', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_MAP[status] || STATUS_MAP.DRAFT;
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold border ${config.color} ${config.bg} ${config.border}`}>
      {config.label}
    </span>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────

export default function StocktakePage({ viewMode = 'stocktake' }: { viewMode?: 'requests' | 'create' | 'stocktake' | 'my-tasks' | 'request-new' }) {
  const [stocktakes, setStocktakes] = React.useState<StocktakeItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [toast, setToast] = React.useState({ message: '', type: 'success' as 'success' | 'error' });

  // Pagination
  const [pageSize, setPageSize] = React.useState(20);
  const [currentPage, setCurrentPage] = React.useState(1);

  // Modals
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [showDetailModal, setShowDetailModal] = React.useState(false);

  // RIC-style: date range filter
  const [dateFrom, setDateFrom] = React.useState(() => {
    const d = new Date(); return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = React.useState(() => {
    const d = new Date(); return d.toISOString().slice(0, 10);
  });
  // RIC-style: show detail toggle
  const [showDetail, setShowDetail] = React.useState(false);
  // Selected rows for bulk actions
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  // Column Visibility settings (matching sample page)
  const DEFAULT_COLUMN_VIS = {
    nv: true,
    code: true,
    date: true,
    totalDiff: true,
    note: true,
    status: true,
    productSku: true,
    productName: true,
    systemQty: true,
    countedQty: true,
    difference: true,
  };

  const COLUMN_LIST = [
    { key: 'nv', label: 'NV', isDetail: false },
    { key: 'code', label: 'Mã', isDetail: false },
    { key: 'date', label: 'Ngày', isDetail: false },
    { key: 'totalDiff', label: 'Tổng lệch', isDetail: false },
    { key: 'note', label: 'Ghi chú', isDetail: false },
    { key: 'status', label: 'Trạng thái', isDetail: false },
    { key: 'productSku', label: 'Mã hàng', isDetail: true },
    { key: 'productName', label: 'Tên hàng', isDetail: true },
    { key: 'systemQty', label: 'Tồn', isDetail: true },
    { key: 'countedQty', label: 'Thực tồn', isDetail: true },
    { key: 'difference', label: 'Lệch', isDetail: true },
  ];

  const [columnVis, setColumnVis] = React.useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('stocktake_column_vis');
      return saved ? { ...DEFAULT_COLUMN_VIS, ...JSON.parse(saved) } : DEFAULT_COLUMN_VIS;
    } catch {
      return DEFAULT_COLUMN_VIS;
    }
  });

  React.useEffect(() => {
    localStorage.setItem('stocktake_column_vis', JSON.stringify(columnVis));
  }, [columnVis]);

  const [showColumnSettings, setShowColumnSettings] = React.useState(false);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = currentUser.role || '';
  const userIdentifier = currentUser.fullName || currentUser.email || '';
  const isManager = userRole === 'manager' || userRole === 'admin';
  const isStaff = userRole === 'staff';

  const navigate = useNavigate();
  React.useEffect(() => {
    if (isStaff && (viewMode === 'stocktake' || viewMode === 'requests' || viewMode === 'create')) {
      navigate('/inventory/stocktake/my-tasks', { replace: true });
    }
  }, [isStaff, viewMode, navigate]);

  const isRequestsView = viewMode === 'requests';
  const isCreateView = viewMode === 'create';
  const isMyTasksView = viewMode === 'my-tasks';
  const isRequestNewView = viewMode === 'request-new';

  const pageTitle = isRequestsView ? 'Yêu cầu kiểm kê từ nhân viên'
    : isCreateView ? 'Tạo phiên kiểm kê'
      : isMyTasksView ? 'Kiểm kê của tôi'
        : isRequestNewView ? 'Gửi yêu cầu kiểm kê'
          : 'Kiểm kê kho hàng';
  const pageSubtitle = isRequestsView
    ? 'Danh sách yêu cầu kiểm kê từ nhân viên cần tiếp nhận và xử lý.'
    : isCreateView
      ? 'Tạo mới một phiên kiểm kê để bắt đầu kiểm kê hàng hóa.'
      : isMyTasksView
        ? 'Danh sách phiên kiểm kê được giao cho bạn.'
        : isRequestNewView
          ? 'Tạo yêu cầu kiểm kê và gửi cho quản lý phê duyệt.'
          : 'Tạo phiên kiểm kê, đếm thực tế, so sánh chênh lệch và cập nhật tồn kho.';
  const defaultIsRequest = isRequestsView || isRequestNewView;
  const [selectedStocktake, setSelectedStocktake] = React.useState<StocktakeItem | null>(null);

  // ── Data Loading ────────────────────────────────────────────

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      // Choose API endpoint based on view mode
      let url = `${API_BASE}/inventory/stocktakes`;
      if (isMyTasksView || isRequestNewView) {
        url = `${API_BASE}/inventory/stocktakes/my-tasks`;
      } else if (isRequestsView) {
        url = `${API_BASE}/inventory/stocktakes/requests`;
      }
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) throw new Error('Không tải được dữ liệu kiểm kê');
      const data = await res.json();
      setStocktakes(data);
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Lỗi hệ thống', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [isMyTasksView, isRequestsView]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    if (isCreateView) {
      setShowCreateModal(true);
    }
  }, [isCreateView]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  // ── Filter & Pagination ─────────────────────────────────────

  const filtered = stocktakes.filter((s) => {
    const kw = search.trim().toLowerCase();
    const matchKeyword = !kw ||
      s.stocktakeNo.toLowerCase().includes(kw) ||
      s.locationCode.toLowerCase().includes(kw) ||
      (s.createdBy || '').toLowerCase().includes(kw) ||
      (STATUS_MAP[s.status]?.label || '').toLowerCase().includes(kw);

    // Date range filter
    if (dateFrom || dateTo) {
      const itemDate = s.plannedDate ? new Date(s.plannedDate).toISOString().slice(0, 10)
        : s.createdAt ? new Date(s.createdAt).toISOString().slice(0, 10) : '';
      if (dateFrom && itemDate && itemDate < dateFrom) return false;
      if (dateTo && itemDate && itemDate > dateTo) return false;
    }

    return matchKeyword;
  });

  const displayedStocktakes = filtered;

  const totalItems = displayedStocktakes.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginated = displayedStocktakes.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  // ── Summary ─────────────────────────────────────────────────

  const totalAll = stocktakes.length;
  const totalCounting = stocktakes.filter((s) => s.status === 'COUNTING').length;
  const totalWaiting = stocktakes.filter((s) => s.status === 'COUNTING_DONE').length;
  const totalApproved = stocktakes.filter((s) => s.status === 'APPROVED').length;
  const totalRequests = stocktakes.filter((s) => s.status === 'REQUESTED').length;

  // Footer totals computation
  const footerTotalTon = paginated.reduce((sum, item) => {
    if (!item.details) return sum;
    return sum + item.details.reduce((s, d) => s + (d.systemQty || 0), 0);
  }, 0);
  const footerTotalThucTon = paginated.reduce((sum, item) => {
    if (!item.details) return sum;
    return sum + item.details.reduce((s, d) => s + (d.countedQty || 0), 0);
  }, 0);
  const footerTotalLech = paginated.reduce((sum, item) => {
    if (!item.details) return sum;
    return sum + item.details.reduce((s, d) => s + Math.abs(d.difference || 0), 0);
  }, 0);
  const footerTotalTongLech = paginated.reduce((sum, item) => {
    if (!item.details) return sum;
    return sum + item.details.reduce((s, d) => s + (d.difference || 0), 0);
  }, 0);

  // ── Actions ─────────────────────────────────────────────────

  const showSuccess = (msg: string) => setToast({ message: msg, type: 'success' });
  const showError = (msg: string) => setToast({ message: msg, type: 'error' });
  const hasAcceptPermission = isManager;

  const handleViewDetail = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/inventory/stocktakes/${id}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Không tải được chi tiết');
      const data = await res.json();
      setSelectedStocktake(data);
      setShowDetailModal(true);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Lỗi');
    }
  };

  const handleAcceptRequest = async (id: string) => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const res = await fetch(`${API_BASE}/inventory/stocktakes/${id}/accept`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ acceptedBy: user.fullName || user.email || '' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Không thể tiếp nhận yêu cầu');
      }
      showSuccess('Đã tiếp nhận yêu cầu kiểm kê');
      loadData();
      if (selectedStocktake?.id === id) handleViewDetail(id);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Lỗi');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn chắc chắn muốn xóa phiên kiểm kê này?')) return;
    try {
      const res = await fetch(`${API_BASE}/inventory/stocktakes/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Không thể xóa');
      }
      showSuccess('Đã xóa phiên kiểm kê');
      loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Lỗi');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const res = await fetch(`${API_BASE}/inventory/stocktakes/${id}/approve`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ approvedBy: user.fullName || user.email || '' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Không thể duyệt');
      }
      showSuccess('Đã duyệt phiên kiểm kê và cập nhật tồn kho');
      loadData();
      if (selectedStocktake?.id === id) {
        const updated = await res.json().catch(() => null);
        if (updated) setSelectedStocktake(updated);
        else handleViewDetail(id);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Lỗi');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/inventory/stocktakes/${id}/reject`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Không thể từ chối');
      }
      showSuccess('Đã từ chối phiên kiểm kê');
      loadData();
      if (selectedStocktake?.id === id) handleViewDetail(id);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Lỗi');
    }
  };

  // ── Bulk delete ─────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) { showError('Chưa chọn phiên nào để xóa'); return; }
    if (!confirm(`Xóa ${selectedIds.size} phiên kiểm kê đã chọn?`)) return;
    let deleted = 0;
    for (const id of selectedIds) {
      try {
        const res = await fetch(`${API_BASE}/inventory/stocktakes/${id}`, { method: 'DELETE', headers: authHeaders() });
        if (res.ok) deleted++;
      } catch { /* skip */ }
    }
    showSuccess(`Đã xóa ${deleted}/${selectedIds.size} phiên`);
    setSelectedIds(new Set());
    loadData();
  };

  // ── Toggle select ───────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === paginated.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(paginated.map(s => s.id)));
  };

  // ── Render ──────────────────────────────────────────────────

  // Dynamic base columns count for empty / loading states & detail mode
  const isDetailActive =
    showDetail ||
    Boolean(
      columnVis.productSku ||
      columnVis.productName ||
      columnVis.systemQty ||
      columnVis.countedQty ||
      columnVis.difference,
    );

  const visibleMainCount = [
    columnVis.nv,
    columnVis.code,
    columnVis.date,
    columnVis.totalDiff,
    columnVis.note,
    columnVis.status,
  ].filter(Boolean).length;

  const visibleDetailCount = isDetailActive
    ? [
      columnVis.productSku,
      columnVis.productName,
      columnVis.systemQty,
      columnVis.countedQty,
      columnVis.difference,
    ].filter(Boolean).length
    : 0;

  const baseColCount = 3 + visibleMainCount + visibleDetailCount;

  return (
    <div className="space-y-0">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />

      {/* ═══ Breadcrumb ═══ */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Home className="h-4 w-4 text-cyan-600" />
          <Link to="/dashboard" className="text-cyan-600 hover:underline font-medium">Home</Link>
          <span className="text-slate-400">›</span>
          <span className="text-slate-700 font-semibold">Kiểm kê</span>
        </div>
      </div>

      {/* ═══ Page Title ═══ */}
      <div className="mb-4">
        <h1 className="text-xl font-black text-slate-800 uppercase tracking-wide">DANH SÁCH PHIẾU KIỂM KÊ</h1>
        <p className="text-sm text-slate-500 mt-1">{pageSubtitle}</p>
      </div>

      {/* ═══ Toolbar ═══ */}
      <div className="flex flex-wrap items-center gap-2 mb-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
        {/* Action Buttons - RIC style colored */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-90"
          style={{ background: '#4CAF50' }}
        >
          <Plus className="h-3.5 w-3.5" />
          Thêm
        </button>
        <button
          onClick={handleBulkDelete}
          className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-90"
          style={{ background: '#FF9800' }}
        >
          <X className="h-3.5 w-3.5" />
          Xóa
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-90"
          style={{ background: '#2196F3' }}
        >
          <Printer className="h-3.5 w-3.5" />
          Print
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-90"
          style={{ background: '#388E3C' }}
        >
          <Printer className="h-3.5 w-3.5" />
          Print Chi tiết
        </button>
        <button
          onClick={() => {
            // Export basic CSV/Excel
            const header = ['STT', 'Mã', 'NV', 'Ngày', 'Tổng lệch', 'Ghi chú', 'Trạng thái'];
            const rows = displayedStocktakes.map((s, i) => [
              i + 1,
              s.stocktakeNo,
              s.assignee || s.createdBy || '',
              s.plannedDate ? new Date(s.plannedDate).toLocaleDateString('vi-VN') : '',
              s.details ? s.details.reduce((sum, d) => sum + d.difference, 0) : 0,
              s.note || '',
              STATUS_MAP[s.status]?.label || s.status,
            ]);
            const csv = [header, ...rows].map(r => r.join(',')).join('\n');
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `kiem_ke_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
            URL.revokeObjectURL(url);
          }}
          className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-90"
          style={{ background: '#4CAF50' }}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Excel
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-90"
          style={{ background: '#FF5722' }}
        >
          <FileDown className="h-3.5 w-3.5" />
          PDF
        </button>

        {/* Separator */}
        <div className="w-px h-7 bg-slate-300 mx-1" />

        {/* Date range - RIC style */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-600">Từ ngày:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-600">Đến ngày:</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        {/* Separator */}
        <div className="w-px h-7 bg-slate-300 mx-1" />

        {/* Hiện chi tiết checkbox */}
        <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isDetailActive}
            onChange={(e) => {
              const val = e.target.checked;
              setShowDetail(val);
              setColumnVis((prev) => ({
                ...prev,
                productSku: val,
                productName: val,
                systemQty: val,
                countedQty: val,
                difference: val,
              }));
            }}
            className="h-3.5 w-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
          />
          <span className="text-xs font-semibold text-slate-600">Hiện chi tiết</span>
        </label>

        {/* Search button */}
        <button
          onClick={() => loadData()}
          className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-90"
          style={{ background: '#FF9800' }}
        >
          <Search className="h-3.5 w-3.5" />
          Tìm kiếm
        </button>

        {/* Settings gear - Hiện/Ẩn cột */}
        <button
          onClick={() => setShowColumnSettings(true)}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md shadow-sm text-white transition hover:opacity-90"
          style={{ background: '#00BCD4' }}
          title="Hiện/Ẩn cột"
        >
          <Settings className="h-4 w-4" />
        </button>

        {/* AI button for managers */}
        {isManager && (
          <button
            onClick={async () => {
              try {
                const res = await fetch('http://localhost:3000/api/inventory/smart-stocktake/generate-recommended', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
                  },
                  body: JSON.stringify({ createdBy: 'Smart AI Risk Engine' }),
                });
                if (!res.ok) {
                  const err = await res.json().catch(() => null);
                  throw new Error(err?.message || 'Không có sản phẩm nguy cơ cao nào');
                }
                const created = await res.json();
                setToast({ message: `Đã tự động khởi tạo phiên kiểm kê thông minh ${created.stocktakeNo} pre-filled danh sách rủi ro cao!`, type: 'success' });
                await loadData();
              } catch (err: any) {
                setToast({ message: err.message || 'Lỗi', type: 'error' });
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-90"
            style={{ background: '#7C3AED' }}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            AI Kiểm kê
          </button>
        )}
      </div>

      {/* ═══ Modal Hiện/Ẩn cột (Sample page style) ═══ */}
      {showColumnSettings && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
          <div className="w-[360px] rounded-lg border border-slate-300 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2.5">
              <h3 className="text-sm font-bold text-slate-800">Hiện/Ẩn cột</h3>
              <button
                onClick={() => setShowColumnSettings(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Table of Columns (ALL 11 fields) */}
            <div className="max-h-[380px] overflow-y-auto p-2">
              <table className="w-full text-xs border-collapse border border-slate-300">
                <thead>
                  <tr style={{ background: '#e0f2fe' }}>
                    <th className="w-12 border border-slate-300 px-2 py-1.5 text-center font-bold text-slate-700">TT</th>
                    <th className="border border-slate-300 px-3 py-1.5 text-left font-bold text-slate-700">Tên cột</th>
                    <th className="w-24 border border-slate-300 px-2 py-1.5 text-center font-bold text-slate-700">
                      <div className="flex items-center justify-center gap-1">
                        <span>Ẩn/Hiện</span>
                        <input
                          type="checkbox"
                          checked={COLUMN_LIST.every((col) => columnVis[col.key])}
                          onChange={(e) => {
                            const val = e.target.checked;
                            const next = { ...columnVis };
                            COLUMN_LIST.forEach((col) => { next[col.key] = val; });
                            setColumnVis(next);
                          }}
                          className="h-3.5 w-3.5 rounded border-slate-400 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                        />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COLUMN_LIST.map((col, idx) => (
                    <tr key={col.key} className="border-b border-slate-200 hover:bg-slate-50 transition">
                      <td className="border border-slate-200 px-2 py-1.5 text-center text-slate-600">{idx + 1}</td>
                      <td className="border border-slate-200 px-3 py-1.5 text-slate-700 font-medium">{col.label}</td>
                      <td className="border border-slate-200 px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={columnVis[col.key] ?? true}
                          onChange={(e) => {
                            setColumnVis((prev) => ({ ...prev, [col.key]: e.target.checked }));
                          }}
                          className="h-3.5 w-3.5 rounded border-slate-400 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-4 py-2">
              <button
                onClick={() => setShowColumnSettings(false)}
                className="rounded-md bg-cyan-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-cyan-700 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Drag & Drop hint (RIC-style) ═══ */}
      <div className="text-xs text-slate-400 italic mb-1 px-1">
        Drag a column header and drop it here to group by that column
      </div>

      {/* ═══ Search bar (inline, below toolbar) ═══ */}
      <div className="flex items-center gap-2 mb-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-4 text-xs font-medium outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
            placeholder="Tìm theo mã kiểm kê, kho, người tạo, trạng thái..."
          />
        </div>
      </div>

      {/* ═══ Data Table ═══ */}
      <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-xs">
            {/* Table Header */}
            <thead>
              <tr style={{ background: 'linear-gradient(180deg, #e0f2fe 0%, #bae6fd 100%)' }}>
                <th className="w-10 border border-slate-300 px-2 py-2.5 text-center font-bold text-slate-700">
                  No.
                </th>
                <th className="w-10 border border-slate-300 px-2 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={paginated.length > 0 && selectedIds.size === paginated.length}
                    onChange={toggleSelectAll}
                    className="h-3.5 w-3.5 rounded border-slate-400 text-cyan-600 focus:ring-cyan-500"
                  />
                </th>
                {columnVis.nv && (
                  <th className="border border-slate-300 px-2 py-2.5 text-center font-bold text-slate-700">
                    <div className="flex items-center justify-center gap-1">
                      NV <ChevronDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </th>
                )}
                {columnVis.code && (
                  <th className="border border-slate-300 px-2 py-2.5 text-center font-bold text-slate-700">
                    <div className="flex items-center justify-center gap-1">
                      Mã <ChevronDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </th>
                )}
                {columnVis.date && (
                  <th className="border border-slate-300 px-2 py-2.5 text-center font-bold text-slate-700">
                    <div className="flex items-center justify-center gap-1">
                      Ngày <ChevronDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </th>
                )}
                {columnVis.totalDiff && (
                  <th className="border border-slate-300 px-2 py-2.5 text-center font-bold text-slate-700">
                    <div className="flex items-center justify-center gap-1">
                      Tổng lệch <ChevronDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </th>
                )}
                {columnVis.note && (
                  <th className="border border-slate-300 px-2 py-2.5 text-center font-bold text-slate-700">
                    <div className="flex items-center justify-center gap-1">
                      Ghi chú <ChevronDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </th>
                )}
                {columnVis.status && (
                  <th className="border border-slate-300 px-2 py-2.5 text-center font-bold text-slate-700">
                    <div className="flex items-center justify-center gap-1">
                      Trạng thái <ChevronDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </th>
                )}
                {isDetailActive && (
                  <>
                    {columnVis.productSku && (
                      <th className="border border-slate-300 px-2 py-2.5 text-center font-bold text-slate-700">
                        <div className="flex items-center justify-center gap-1">
                          Mã hàng <ChevronDown className="h-3 w-3 text-slate-400" />
                        </div>
                      </th>
                    )}
                    {columnVis.productName && (
                      <th className="border border-slate-300 px-2 py-2.5 text-center font-bold text-slate-700">
                        <div className="flex items-center justify-center gap-1">
                          Tên hàng <ChevronDown className="h-3 w-3 text-slate-400" />
                        </div>
                      </th>
                    )}
                    {columnVis.systemQty && (
                      <th className="border border-slate-300 px-2 py-2.5 text-center font-bold text-slate-700">
                        <div className="flex items-center justify-center gap-1">
                          Tồn <ChevronDown className="h-3 w-3 text-slate-400" />
                        </div>
                      </th>
                    )}
                    {columnVis.countedQty && (
                      <th className="border border-slate-300 px-2 py-2.5 text-center font-bold text-slate-700">
                        <div className="flex items-center justify-center gap-1">
                          Thực tồn <ChevronDown className="h-3 w-3 text-slate-400" />
                        </div>
                      </th>
                    )}
                    {columnVis.difference && (
                      <th className="border border-slate-300 px-2 py-2.5 text-center font-bold text-slate-700">
                        <div className="flex items-center justify-center gap-1">
                          Lệch <ChevronDown className="h-3 w-3 text-slate-400" />
                        </div>
                      </th>
                    )}
                  </>
                )}
                <th className="w-24 border border-slate-300 px-2 py-2.5 text-center font-bold text-slate-700">
                  Thao tác
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={baseColCount} className="px-6 py-10 text-center text-sm text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-cyan-500" />
                      Đang tải dữ liệu kiểm kê...
                    </div>
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={baseColCount} className="px-6 py-10 text-center text-sm text-slate-400">
                    No items to display
                  </td>
                </tr>
              ) : (
                paginated.map((item, index) => {
                  const itemDate = item.plannedDate ? new Date(item.plannedDate).toLocaleDateString('vi-VN')
                    : item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '';
                  const totalDiff = item.details ? item.details.reduce((s, d) => s + d.difference, 0) : 0;
                  const hasDetails = item.details && item.details.length > 0;
                  const detailRows = isDetailActive && hasDetails ? item.details : [];
                  const firstDetail = hasDetails ? item.details[0] : null;
                  const extraDetails = detailRows.length > 1 ? detailRows.slice(1) : [];

                  return (
                    <React.Fragment key={item.id}>
                      {/* Main row */}
                      <tr className={`border-b border-slate-200 transition hover:bg-cyan-50/40 ${selectedIds.has(item.id) ? 'bg-cyan-50/60' : ''}`}>
                        <td className="border border-slate-200 px-2 py-2 text-center text-xs text-slate-600" rowSpan={isDetailActive && extraDetails.length > 0 ? extraDetails.length + 1 : 1}>
                          {startIndex + index}
                        </td>
                        <td className="border border-slate-200 px-2 py-2 text-center" rowSpan={isDetailActive && extraDetails.length > 0 ? extraDetails.length + 1 : 1}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleSelect(item.id)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                          />
                        </td>
                        {columnVis.nv && (
                          <td className="border border-slate-200 px-2 py-2 text-center text-xs text-slate-600" rowSpan={isDetailActive && extraDetails.length > 0 ? extraDetails.length + 1 : 1}>
                            {item.assignee || item.createdBy || '—'}
                          </td>
                        )}
                        {columnVis.code && (
                          <td className="border border-slate-200 px-2 py-2 text-center text-xs font-bold text-cyan-700" rowSpan={isDetailActive && extraDetails.length > 0 ? extraDetails.length + 1 : 1}>
                            <button
                              onClick={() => handleViewDetail(item.id)}
                              className="hover:underline hover:text-cyan-800 transition"
                            >
                              {item.stocktakeNo}
                            </button>
                          </td>
                        )}
                        {columnVis.date && (
                          <td className="border border-slate-200 px-2 py-2 text-center text-xs text-slate-600" rowSpan={isDetailActive && extraDetails.length > 0 ? extraDetails.length + 1 : 1}>
                            {itemDate}
                          </td>
                        )}
                        {columnVis.totalDiff && (
                          <td className="border border-slate-200 px-2 py-2 text-center text-xs font-bold" rowSpan={isDetailActive && extraDetails.length > 0 ? extraDetails.length + 1 : 1}>
                            <span className={totalDiff !== 0 ? 'text-red-600' : 'text-slate-400'}>
                              {totalDiff !== 0 ? totalDiff.toFixed(1) : '0.0'}
                            </span>
                          </td>
                        )}
                        {columnVis.note && (
                          <td className="border border-slate-200 px-2 py-2 text-center text-xs text-slate-500" rowSpan={isDetailActive && extraDetails.length > 0 ? extraDetails.length + 1 : 1}>
                            {item.note || ''}
                          </td>
                        )}
                        {columnVis.status && (
                          <td className="border border-slate-200 px-2 py-2 text-center" rowSpan={isDetailActive && extraDetails.length > 0 ? extraDetails.length + 1 : 1}>
                            <StatusBadge status={item.status} />
                          </td>
                        )}
                        {isDetailActive && (
                          <>
                            {columnVis.productSku && (
                              <td className="border border-slate-200 px-2 py-2 text-center text-xs text-slate-600">
                                {firstDetail?.product?.internalSku || (hasDetails ? 'SKU-N/A' : '—')}
                              </td>
                            )}
                            {columnVis.productName && (
                              <td className="border border-slate-200 px-2 py-2 text-left text-xs text-slate-600">
                                {firstDetail?.product?.name || (hasDetails ? 'Sản phẩm kiểm kê' : '—')}
                              </td>
                            )}
                            {columnVis.systemQty && (
                              <td className="border border-slate-200 px-2 py-2 text-center text-xs font-semibold text-slate-700">
                                {firstDetail ? firstDetail.systemQty.toLocaleString('vi-VN') : '—'}
                              </td>
                            )}
                            {columnVis.countedQty && (
                              <td className="border border-slate-200 px-2 py-2 text-center text-xs font-semibold text-slate-700">
                                {firstDetail?.countedQty != null ? firstDetail.countedQty.toLocaleString('vi-VN') : '—'}
                              </td>
                            )}
                            {columnVis.difference && (
                              <td className="border border-slate-200 px-2 py-2 text-center text-xs font-bold">
                                {firstDetail?.countedQty != null ? (
                                  <span className={firstDetail.difference !== 0 ? 'text-red-600' : 'text-slate-500'}>
                                    {firstDetail.difference}
                                  </span>
                                ) : '—'}
                              </td>
                            )}
                          </>
                        )}
                        <td className="border border-slate-200 px-2 py-2 text-center" rowSpan={isDetailActive && extraDetails.length > 0 ? extraDetails.length + 1 : 1}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleViewDetail(item.id)}
                              className="rounded p-1 text-slate-500 transition hover:bg-cyan-50 hover:text-cyan-600"
                              title="Xem chi tiết"
                            >
                              <Eye size={14} />
                            </button>
                            {item.status === 'COUNTING_DONE' && isManager && (
                              <>
                                <button
                                  onClick={() => handleApprove(item.id)}
                                  className="rounded p-1 text-emerald-500 transition hover:bg-emerald-50 hover:text-emerald-700"
                                  title="Duyệt"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => handleReject(item.id)}
                                  className="rounded p-1 text-red-400 transition hover:bg-red-50 hover:text-red-600"
                                  title="Từ chối"
                                >
                                  <Ban size={14} />
                                </button>
                              </>
                            )}
                            {item.status === 'REQUESTED' && hasAcceptPermission && (
                              <button
                                onClick={() => handleAcceptRequest(item.id)}
                                className="rounded p-1 text-violet-600 transition hover:bg-violet-50 hover:text-violet-700"
                                title="Tiếp nhận yêu cầu"
                              >
                                <Check size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Extra detail rows (if detail mode is active) */}
                      {isDetailActive && extraDetails.map((detail, dIdx) => (
                        <tr key={`${item.id}-d-${dIdx}`} className="border-b border-slate-100 hover:bg-sky-50/60">
                          {columnVis.productSku && (
                            <td className="border border-slate-200 px-2 py-1.5 text-center text-xs text-slate-600">
                              {detail.product?.internalSku || ''}
                            </td>
                          )}
                          {columnVis.productName && (
                            <td className="border border-slate-200 px-2 py-1.5 text-left text-xs text-slate-600">
                              {detail.product?.name || ''}
                            </td>
                          )}
                          {columnVis.systemQty && (
                            <td className="border border-slate-200 px-2 py-1.5 text-center text-xs font-semibold text-slate-700">
                              {detail.systemQty.toLocaleString('vi-VN')}
                            </td>
                          )}
                          {columnVis.countedQty && (
                            <td className="border border-slate-200 px-2 py-1.5 text-center text-xs font-semibold text-slate-700">
                              {detail.countedQty != null ? detail.countedQty.toLocaleString('vi-VN') : ''}
                            </td>
                          )}
                          {columnVis.difference && (
                            <td className="border border-slate-200 px-2 py-1.5 text-center text-xs font-bold">
                              {detail.countedQty != null ? (
                                <span className={detail.difference !== 0 ? 'text-red-600' : 'text-slate-500'}>
                                  {detail.difference}
                                </span>
                              ) : ''}
                            </td>
                          )}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>

            {/* ═══ Footer Totals ═══ */}
            {!loading && paginated.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300">
                  <td
                    colSpan={2 + (columnVis.nv ? 1 : 0) + (columnVis.code ? 1 : 0) + (columnVis.date ? 1 : 0) + (!columnVis.totalDiff ? 1 : 0)}
                    className="border border-slate-300 px-2 py-2 text-right text-xs font-bold text-slate-600"
                  >
                    Tổng cộng:
                  </td>
                  {columnVis.totalDiff && (
                    <td className="border border-slate-300 px-2 py-2 text-center text-xs font-bold text-red-600">
                      {footerTotalTongLech !== 0 ? footerTotalTongLech.toFixed(1) : '0.0'}
                    </td>
                  )}
                  {columnVis.note && <td className="border border-slate-300 px-2 py-2" />}
                  {columnVis.status && <td className="border border-slate-300 px-2 py-2" />}
                  {isDetailActive && (
                    <>
                      {columnVis.productSku && <td className="border border-slate-300 px-2 py-2" />}
                      {columnVis.productName && <td className="border border-slate-300 px-2 py-2" />}
                      {columnVis.systemQty && (
                        <td className="border border-slate-300 px-2 py-2 text-center text-xs font-bold text-slate-700">
                          {footerTotalTon.toLocaleString('vi-VN')}
                        </td>
                      )}
                      {columnVis.countedQty && (
                        <td className="border border-slate-300 px-2 py-2 text-center text-xs font-bold text-slate-700">
                          {footerTotalThucTon.toLocaleString('vi-VN')}
                        </td>
                      )}
                      {columnVis.difference && (
                        <td className="border border-slate-300 px-2 py-2 text-center text-xs font-bold text-red-600">
                          {footerTotalLech.toLocaleString('vi-VN')}
                        </td>
                      )}
                    </>
                  )}
                  <td className="border border-slate-300 px-2 py-2" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* ═══ Pagination (RIC style) ═══ */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-500 text-xs hover:bg-slate-100 disabled:opacity-40 transition"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-500 text-xs hover:bg-slate-100 disabled:opacity-40 transition"
            >
              <ChevronLeft size={14} />
            </button>

            {/* Current page badge (RIC green/orange circle) */}
            <button
              className="flex h-7 min-w-7 items-center justify-center rounded-full text-xs font-bold text-white px-2"
              style={{ background: '#4CAF50' }}
            >
              {totalItems}
            </button>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-500 text-xs hover:bg-slate-100 disabled:opacity-40 transition"
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-500 text-xs hover:bg-slate-100 disabled:opacity-40 transition"
            >
              <ChevronsRight size={14} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {totalItems === 0 ? (
              <span className="text-xs text-slate-400 italic">No items to display</span>
            ) : (
              <span className="text-xs text-slate-500">
                Trang {currentPage}/{totalPages} — Hiển thị {startIndex}–{endIndex} / {totalItems}
              </span>
            )}
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="h-7 rounded border border-slate-300 bg-white px-1.5 text-xs outline-none focus:border-cyan-500"
            >
              <option value={5}>5</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* ═══ Footer Copyright ═══ */}
      <div className="flex items-center justify-between mt-3 px-1">
        <p className="text-xs text-slate-400">
          Smart WMS - Copyright © 2008-2026 <span className="text-cyan-600 font-semibold">by Smart WMS Software.</span>
        </p>
        <p className="text-xs text-slate-400">Version 2026</p>
      </div>

      {/* ═══ Modals ═══ */}
      {showCreateModal && (
        <CreateStocktakeModal
          defaultIsRequest={defaultIsRequest}
          isStaff={isStaff}
          isManager={isManager}
          onClose={() => setShowCreateModal(false)}
          onCreated={(created) => {
            setShowCreateModal(false);
            loadData();
            if (isStaff) {
              showSuccess('Đã gửi yêu cầu kiểm kê thành công');
            } else {
              const assigneeMsg = created?.assignee ? ` và đã gửi thông báo cho nhân viên ${created.assignee}` : '';
              showSuccess(`Đã tạo phiên kiểm kê mới${assigneeMsg}`);
            }
          }}
          onSaveAndAdd={(created) => { loadData(); showSuccess('Đã lưu yêu cầu, bạn có thể tạo tiếp'); }}
          onError={showError}
        />
      )}
      {showDetailModal && selectedStocktake && (
        <StocktakeDetailModal
          stocktake={selectedStocktake}
          isManager={isManager}
          isStaff={isStaff}
          onClose={() => { setShowDetailModal(false); setSelectedStocktake(null); }}
          onRefresh={async () => {
            await loadData();
            handleViewDetail(selectedStocktake.id);
          }}
          onSuccess={showSuccess}
          onError={showError}
        />
      )}
    </div>
  );
}


// ─── SUMMARY CARD ──────────────────────────────────────────────

function SummaryCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  const colorMap: Record<string, { border: string; bg: string; textLabel: string; textValue: string; iconBg: string }> = {
    cyan: { border: 'border-cyan-200', bg: 'bg-cyan-50', textLabel: 'text-cyan-800', textValue: 'text-cyan-600', iconBg: 'bg-cyan-100' },
    amber: { border: 'border-amber-200', bg: 'bg-amber-50', textLabel: 'text-amber-800', textValue: 'text-amber-600', iconBg: 'bg-amber-100' },
    blue: { border: 'border-blue-200', bg: 'bg-blue-50', textLabel: 'text-blue-800', textValue: 'text-blue-600', iconBg: 'bg-blue-100' },
    emerald: { border: 'border-emerald-200', bg: 'bg-emerald-50', textLabel: 'text-emerald-800', textValue: 'text-emerald-600', iconBg: 'bg-emerald-100' },
    violet: { border: 'border-violet-200', bg: 'bg-violet-50', textLabel: 'text-violet-800', textValue: 'text-violet-600', iconBg: 'bg-violet-100' },
  };
  const c = colorMap[color] || colorMap.cyan;

  return (
    <div className={`rounded-2xl border-2 ${c.border} ${c.bg} p-6 transition-all hover:shadow-md`}>
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${c.iconBg}`}>
          <Icon className={`h-6 w-6 ${c.textValue}`} />
        </div>
        <div>
          <p className={`text-sm font-bold uppercase tracking-wider ${c.textLabel}`}>{label}</p>
          <p className={`mt-1 text-3xl font-black ${c.textValue}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

// ─── CREATE MODAL ──────────────────────────────────────────────

function CreateStocktakeModal({
  onClose,
  onCreated,
  onSaveAndAdd,
  onError,
  defaultIsRequest = false,
  isStaff = false,
  isManager = false,
}: {
  onClose: () => void;
  onCreated: (created?: any) => void;
  onSaveAndAdd?: (created?: any) => void;
  onError: (msg: string) => void;
  defaultIsRequest?: boolean;
  isStaff?: boolean;
  isManager?: boolean;
}) {
  const modalUser = JSON.parse(localStorage.getItem('user') || '{}');
  const userIdentifier = modalUser.fullName || modalUser.email || '';

  const [locationCode, setLocationCode] = React.useState('');
  const [plannedDate, setPlannedDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [assignee, setAssignee] = React.useState(isStaff ? userIdentifier : '');
  const [note, setNote] = React.useState('');
  const [branch, setBranch] = React.useState('');
  const [purpose, setPurpose] = React.useState('');
  const [reference, setReference] = React.useState('');

  // RIC-style dynamic list
  interface RicItem {
    product: ProductOption & { systemQty?: number };
    countedQty: number;
    note: string;
  }
  const [items, setItems] = React.useState<RicItem[]>([]);
  const [productSearch, setProductSearch] = React.useState('');
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [scannerOpen, setScannerOpen] = React.useState(false);

  const [warehouses, setWarehouses] = React.useState<any[]>([]);
  const [users, setUsers] = React.useState<any[]>([]);
  const [products, setProducts] = React.useState<any[]>([]);

  React.useEffect(() => {
    fetch(`${API_BASE}/warehouses`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.data || [];
        setWarehouses(list);
        if (list.length > 0) setLocationCode(list[0].code);
      })
      .catch(() => { });

    fetch(`${API_BASE}/users`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setUsers(Array.isArray(data) ? data : data?.data || []))
      .catch(() => { });

    // Tải tất cả thông tin sản phẩm và số lượng tồn hệ thống thực tế của chúng
    fetch(`${API_BASE}/products/with-balances`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.data || [];
        setProducts(list);
      })
      .catch(() => { });
  }, []);

  const handleAddProduct = (p: any) => {
    // Check if already in list
    if (items.some(item => item.product.id === p.id)) {
      setProductSearch('');
      setShowDropdown(false);
      return;
    }
    // Lấy tồn kho thực tế từ StockBalance theo kho đang chọn (locationCode)
    const matchBal = (p.stockBalances || []).find((b: any) => b.locationCode === locationCode);
    const systemQty = matchBal ? matchBal.totalPhysical : (p.totalPhysical ?? p.stockQty ?? 0);
    setItems(prev => [
      ...prev,
      {
        product: { id: p.id, internalSku: p.internalSku, name: p.name, unit: p.unit, systemQty },
        countedQty: systemQty, // Khởi tạo thực tồn bằng số tồn hệ thống giống chuẩn RIC
        note: ''
      }
    ]);
    setProductSearch('');
    setShowDropdown(false);
  };

  const handleUpdateCounted = (index: number, val: number) => {
    setItems(prev => {
      const next = [...prev];
      next[index].countedQty = val;
      return next;
    });
  };

  const handleUpdateItemNote = (index: number, text: string) => {
    setItems(prev => {
      const next = [...prev];
      next[index].note = text;
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const executeSubmit = async (finalStatus: string = 'DRAFT') => {
    if (!locationCode) {
      onError('Vui lòng chọn Kho / Vị trí kiểm kê');
      return;
    }
    setSubmitting(true);
    try {
      const itemsPayload = items.map(item => ({
        productId: String(item.product.id || item.product.internalSku),
        countedQty: Number(item.countedQty) >= 0 ? Number(item.countedQty) : 0,
        note: item.note || undefined,
      }));
      const productIds = items.map(item => String(item.product.id || item.product.internalSku));

      // 1. Tạo phiên kiểm kê kèm mảng items đầy đủ thông tin (productId, countedQty, note)
      const res = await fetch(`${API_BASE}/inventory/stocktakes`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          locationCode,
          plannedDate: plannedDate ? new Date(plannedDate).toISOString() : undefined,
          assignee: assignee || userIdentifier,
          note: note.trim() || undefined,
          isRequest: defaultIsRequest || undefined,
          createdBy: userIdentifier,
          branch,
          purpose,
          reference,
          status: finalStatus,
          items: itemsPayload.length > 0 ? itemsPayload : undefined,
          productIds: productIds.length > 0 ? productIds : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Không thể tạo phiên kiểm kê');
      }
      const created = await res.json();

      // 2. Nếu là hoàn tất kiểm kê (COUNTING_DONE), đảm bảo chuyển trạng thái nếu backend chưa tự động đổi
      if (finalStatus === 'COUNTING_DONE' && items.length > 0 && created.status !== 'COUNTING_DONE' && created.status !== 'REQUESTED') {
        const finishRes = await fetch(`${API_BASE}/inventory/stocktakes/${created.id}/finish-counting`, {
          method: 'POST',
          headers: authHeaders(),
        });
        if (finishRes.ok) {
          const finishedData = await finishRes.json().catch(() => null);
          if (finishedData) {
            onCreated(finishedData);
            return;
          }
        }
      }

      // 3. Fetch lại thông tin phiên kiểm kê mới nhất để trả về cho trang chính
      const freshRes = await fetch(`${API_BASE}/inventory/stocktakes/${created.id}`, { headers: authHeaders() });
      const freshData = freshRes.ok ? await freshRes.json() : created;

      onCreated(freshData);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Lỗi');
    } finally {
      setSubmitting(false);
    }
  };

  const existingIds = new Set(items.map(item => item.product.id));
  const filteredProducts = products.filter(p => {
    const kw = productSearch.toLowerCase();
    return !existingIds.has(p.id) && (p.name.toLowerCase().includes(kw) || p.internalSku.toLowerCase().includes(kw));
  });

  // Lấy thông tin user đăng nhập thực tế để hiển thị góc trên bên phải giống RIC
  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const userEmail = storedUser.email || 'guest@smartwms.vn';
  const userPhone = storedUser.phone || '097.247.8383';

  return (
    <div className="fixed inset-y-0 right-0 left-20 lg:left-80 z-50 flex flex-col bg-slate-100 shadow-2xl border-l border-slate-300" onClick={(e) => e.stopPropagation()}>
      {/* RIC Header Green Bar */}
      <div className="flex h-11 items-center justify-between px-4 text-white" style={{ background: '#009688' }}>
        <div className="flex items-center gap-2 font-bold text-sm">
          <span>KIỂM KÊ</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span>☎ {userPhone}</span>
          <select
            value={locationCode}
            onChange={(e) => setLocationCode(e.target.value)}
            className="h-6 rounded bg-teal-800 border-none text-white px-2 py-0.5 text-xs outline-none cursor-pointer"
          >
            {warehouses.map(w => (
              <option key={w.id} value={w.code} className="bg-teal-900 text-white">
                {w.name}
              </option>
            ))}
          </select>
          <span>{userEmail}</span>
        </div>
      </div>

      {/* Tabs bar */}
      <div className="flex items-center gap-1 border-b border-slate-300 bg-slate-50 px-2 py-1 flex-shrink-0">
        <button className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 hover:bg-slate-200 text-slate-600 font-bold text-sm">
          +
        </button>
        <div className="flex items-center gap-2 rounded-t-md border-t-2 border-l border-r border-teal-600 bg-white px-3 py-1 text-xs font-bold text-teal-700 shadow-sm">
          <span>#1</span>
          <button onClick={onClose} className="hover:text-red-500 font-black">✕</button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden" onClick={() => setShowDropdown(false)}>
        {/* Left Area: Grid & Search */}
        <div className="flex flex-1 flex-col p-3 overflow-hidden">
          {/* Quick Add Search Input */}
          <div className="relative mb-3 flex items-center gap-1">
            <div className="relative flex-1">
              <input
                type="text"
                value={productSearch}
                onChange={(e) => { setProductSearch(e.target.value); setShowDropdown(true); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredProducts.length > 0) {
                    e.preventDefault();
                    handleAddProduct(filteredProducts[0]);
                  }
                }}
                onFocus={() => setShowDropdown(true)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Gõ vào mã/tên hàng hóa (Bấm Enter để chọn)"
                className="h-9 w-full rounded border border-slate-300 bg-white px-3 pl-8 text-xs font-medium outline-none focus:border-teal-500"
              />
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />

              {/* Dropdown search results - RIC Style Table Dropdown */}
              {showDropdown && (
                <div
                  className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-md border border-slate-300 bg-white shadow-xl flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Table Header for search dropddown */}
                  <div className="flex bg-slate-100 border-b border-slate-300 px-3 py-2 text-[11px] font-bold text-slate-500 flex-shrink-0">
                    <span className="w-1/2">MÃ/TÊN</span>
                    <span className="w-1/4 text-center">GIÁ</span>
                    <span className="w-1/4 text-center">TỒN</span>
                  </div>

                  {/* Table Body */}
                  <div className="overflow-y-auto flex-1 max-h-56">
                    {filteredProducts.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400">Không tìm thấy hàng hóa</div>
                    ) : (
                      filteredProducts.map(p => {
                        const systemQty = p.stockQty !== undefined ? p.stockQty : Math.floor(Math.random() * 20);
                        const price = p.price !== undefined ? p.price : 0;
                        return (
                          <div
                            key={p.id}
                            onClick={() => handleAddProduct(p)}
                            className="flex items-center px-3 py-2 hover:bg-slate-100 cursor-pointer border-b border-slate-100 text-xs text-slate-700"
                          >
                            <div className="w-1/2 pr-2">
                              <p className="font-bold text-slate-800">{p.internalSku}</p>
                              <p className="text-[11px] text-slate-500 truncate">{p.name}</p>
                            </div>
                            <span className="w-1/4 text-center text-slate-600 font-semibold">{price.toLocaleString('vi-VN')}</span>
                            <span className="w-1/4 text-center text-slate-600 font-bold">{systemQty.toFixed(1)}</span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Dropdown Footer */}
                  <div className="flex items-center justify-between border-t border-slate-200 px-3 py-1.5 bg-slate-50 text-[10px] text-slate-500 font-semibold flex-shrink-0">
                    <span>Tìm thấy {filteredProducts.length} sản phẩm</span>
                    <button
                      type="button"
                      onClick={() => setShowDropdown(false)}
                      className="text-red-500 hover:text-red-700 font-bold"
                    >
                      ✕ Đóng
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick action buttons next to search - Small Barcode Scan button */}
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 transition"
              title="Quét mã vạch sản phẩm"
            >
              <Camera className="h-4 w-4" />
            </button>

            <button type="button" className="flex h-9 w-9 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50">
              +
            </button>
            <button type="button" className="flex h-9 w-9 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50">
              <ListChecks className="h-4 w-4" />
            </button>
            <button type="button" className="flex h-9 w-9 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {/* Dialog Barcode Scanner */}
          <BarcodeScanner
            isOpen={scannerOpen}
            onClose={() => setScannerOpen(false)}
            onProductFound={(product, qty) => {
              // Thêm sản phẩm được quét vào danh sách kiểm kê của RIC
              const existIdx = items.findIndex(item => item.product.id === product.id);
              if (existIdx >= 0) {
                // Cộng dồn thực tồn
                handleUpdateCounted(existIdx, items[existIdx].countedQty + qty);
              } else {
                // Thêm mới
                setItems(prev => [
                  ...prev,
                  {
                    product: { id: product.id, internalSku: product.internalSku, name: product.name, unit: product.unit || 'Cái', systemQty: 0 },
                    countedQty: qty,
                    note: 'Quét từ Barcode'
                  }
                ]);
              }
              setScannerOpen(false);
            }}
            title="Quét mã vạch sản phẩm"
          />

          {/* Grid Headers & Items */}
          <div className="flex-1 overflow-auto border border-slate-300 bg-white rounded">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-700">
                  <th className="w-10 border-r border-slate-300 px-2 py-2 text-center">No.</th>
                  <th className="border-r border-slate-300 px-3 py-2 text-center">Mã</th>
                  <th className="border-r border-slate-300 px-3 py-2">Tên</th>
                  <th className="border-r border-slate-300 px-3 py-2 text-center bg-yellow-50">Số tồn</th>
                  <th className="border-r border-slate-300 px-3 py-2 text-center bg-teal-50">Thực tồn</th>
                  <th className="border-r border-slate-300 px-3 py-2 text-center bg-red-50">Lệch</th>
                  <th className="border-r border-slate-300 px-3 py-2">Ghi chú</th>
                  <th className="w-16 px-2 py-2 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-20 text-center text-xs text-slate-400 italic">
                      Chưa có hàng hóa nào được chọn. Vui lòng nhập tìm kiếm sản phẩm phía trên.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => {
                    const systemVal = item.product.systemQty || 0;
                    const diff = item.countedQty - systemVal;

                    return (
                      <tr key={item.product.id} className="border-b border-slate-200 hover:bg-slate-50/50">
                        <td className="border-r border-slate-300 px-2 py-2 text-center text-slate-500 font-semibold">{idx + 1}.</td>
                        <td className="border-r border-slate-300 px-3 py-2 text-center font-bold text-slate-700">{item.product.internalSku}</td>
                        <td className="border-r border-slate-300 px-3 py-2 text-slate-600">{item.product.name}</td>
                        <td className="border-r border-slate-300 px-3 py-2 text-center font-bold text-slate-700 bg-yellow-50/50">{systemVal}</td>
                        <td className="border-r border-slate-300 px-2 py-1 text-center bg-teal-50/50">
                          <input
                            type="number"
                            min="0"
                            value={item.countedQty}
                            onChange={(e) => handleUpdateCounted(idx, Number(e.target.value))}
                            className="h-7 w-20 text-center rounded border border-slate-300 outline-none text-xs font-bold text-teal-800 focus:border-teal-500"
                          />
                        </td>
                        <td className="border-r border-slate-300 px-3 py-2 text-center font-bold bg-red-50/50">
                          <span className={diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-slate-500'}>
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        </td>
                        <td className="border-r border-slate-300 px-2 py-1">
                          <input
                            type="text"
                            value={item.note}
                            onChange={(e) => handleUpdateItemNote(idx, e.target.value)}
                            placeholder="Ghi chú dòng..."
                            className="h-7 w-full border-none outline-none text-xs text-slate-600 px-1 bg-transparent focus:bg-white"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                // Clone item
                                setItems(prev => [
                                  ...prev,
                                  { ...item, product: { ...item.product, id: item.product.id + '_clone_' + Date.now() } }
                                ]);
                              }}
                              className="text-blue-500 hover:text-blue-700 transition"
                              title="Nhân bản"
                            >
                              📋
                            </button>
                            <button
                              onClick={() => handleRemoveItem(idx)}
                              className="text-red-500 hover:text-red-700 font-bold transition"
                              title="Xóa dòng"
                            >
                              ✕
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
        </div>

        {/* Right Area: Form details */}
        <div className="w-72 border-l border-slate-300 bg-slate-50 p-3 space-y-3.5 flex flex-col justify-between flex-shrink-0">
          <div className="space-y-3">
            {/* Mã HD */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">MÃ HĐ:</label>
              <input
                type="text"
                readOnly
                placeholder="Tạo tự động"
                className="h-8 w-full rounded border border-slate-300 bg-slate-100 px-2 text-xs font-semibold outline-none"
              />
            </div>

            {/* Ngày kiểm */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">NGÀY:</label>
              <div className="relative">
                <input
                  type="date"
                  value={plannedDate}
                  onChange={(e) => setPlannedDate(e.target.value)}
                  className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs font-semibold outline-none"
                />
              </div>
            </div>

            {/* Kho kiểm */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">KHO KIỂM:</label>
              <select
                value={locationCode}
                onChange={(e) => setLocationCode(e.target.value)}
                className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs font-semibold outline-none"
              >
                <option value="">— Chọn kho —</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.code}>{w.code} - {w.name}</option>
                ))}
              </select>
            </div>

            {/* Nhân viên */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">NHÂN VIÊN:</label>
              {isStaff ? (
                <input
                  type="text"
                  value={assignee}
                  readOnly
                  className="h-8 w-full rounded border border-slate-300 bg-slate-100 px-2 text-xs font-semibold outline-none text-slate-600"
                />
              ) : (
                <select
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs font-semibold outline-none"
                >
                  <option value="">— Chọn nhân viên —</option>
                  {users
                    .filter(u => Array.isArray(u.roles) && u.roles.some((r: any) => ['staff', 'manager', 'admin'].includes(r.name?.toLowerCase())))
                    .map(u => (
                      <option key={u.id} value={u.fullName || u.email}>{u.fullName || u.email}</option>
                    ))}
                </select>
              )}
            </div>

            {/* Ghi chú */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">GHI CHÚ:</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú phiếu..."
                rows={3}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium outline-none resize-none"
              />
            </div>
          </div>

          {/* Form Statistics */}
          <div className="bg-yellow-50 border border-yellow-200 rounded p-2.5 space-y-1 text-xs">
            <div className="flex justify-between font-semibold">
              <span className="text-slate-500">Tổng sản phẩm:</span>
              <span className="text-slate-800">{items.length}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span className="text-slate-500">Thực đếm:</span>
              <span className="text-slate-800">
                {items.reduce((sum, item) => sum + item.countedQty, 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* RIC Footer Action Buttons */}
      <div className="flex h-12 items-center justify-end gap-1.5 border-t border-slate-300 bg-slate-200 px-4 flex-shrink-0">
        <button
          onClick={() => executeSubmit('COUNTING_DONE')}
          disabled={submitting || items.length === 0}
          className="flex h-8 items-center gap-1 rounded bg-emerald-600 px-4 text-xs font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50 transition"
        >
          💾 Lưu
        </button>
        <button
          onClick={() => { window.print(); }}
          className="flex h-8 items-center gap-1 rounded bg-pink-600 px-4 text-xs font-bold text-white shadow hover:bg-pink-700 transition"
        >
          🖨 In
        </button>
        <button
          onClick={async () => {
            await executeSubmit('COUNTING_DONE');
            window.print();
          }}
          disabled={submitting || items.length === 0}
          className="flex h-8 items-center gap-1 rounded bg-blue-600 px-4 text-xs font-bold text-white shadow hover:bg-blue-700 disabled:opacity-50 transition"
        >
          💾 In & Lưu
        </button>
        <button
          onClick={() => executeSubmit('DRAFT')}
          disabled={submitting}
          className="flex h-8 items-center gap-1 rounded bg-amber-500 px-4 text-xs font-bold text-white shadow hover:bg-amber-600 disabled:opacity-50 transition"
        >
          💾 Lưu tạm
        </button>
        <button
          onClick={onClose}
          className="flex h-8 items-center gap-1 rounded bg-red-600 px-4 text-xs font-bold text-white shadow hover:bg-red-700 transition"
        >
          ✕ Đóng
        </button>
      </div>
    </div>
  );
}

// ─── DETAIL MODAL ──────────────────────────────────────────────

function StocktakeDetailModal({
  stocktake,
  onClose,
  onRefresh,
  onSuccess,
  onError,
  isManager = false,
  isStaff = false,
}: {
  stocktake: StocktakeItem;
  onClose: () => void;
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  isManager?: boolean;
  isStaff?: boolean;
}) {
  const [products, setProducts] = React.useState<ProductOption[]>([]);
  const [editCounts, setEditCounts] = React.useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    fetch(`${API_BASE}/products`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProducts(data);
        else if (data?.data && Array.isArray(data.data)) setProducts(data.data);
      })
      .catch(() => { });
  }, []);

  const detailsList = Array.isArray(stocktake?.details) ? stocktake.details : [];
  const totalTon = detailsList.reduce((sum, d) => sum + (d.systemQty || 0), 0);
  const totalThucTon = detailsList.reduce((sum, d) => sum + (d.countedQty || 0), 0);
  const totalLech = detailsList.reduce((sum, d) => sum + (d.difference || 0), 0);

  const [selectedProductId, setSelectedProductId] = React.useState('');

  const handleAddProductToExisting = async () => {
    if (!selectedProductId) return;
    try {
      const res = await fetch(`${API_BASE}/inventory/stocktakes/${stocktake.id}/details`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ productId: selectedProductId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Không thể thêm sản phẩm');
      }
      setSelectedProductId('');
      onSuccess('Đã thêm sản phẩm vào phiếu kiểm kê');
      onRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Lỗi');
    }
  };

  const handleSaveAll = async () => {
    setSubmitting(true);
    try {
      for (const d of detailsList) {
        const val = editCounts[d.id];
        if (val !== undefined && val !== '') {
          const qty = parseInt(val, 10);
          if (!isNaN(qty) && qty >= 0) {
            const res = await fetch(`${API_BASE}/inventory/stocktakes/details/${d.id}/count`, {
              method: 'PATCH',
              headers: authHeaders(),
              body: JSON.stringify({ countedQty: qty }),
            });
            if (!res.ok) {
              const errData = await res.json().catch(() => null);
              throw new Error(errData?.message || 'Không thể cập nhật số lượng đếm');
            }
          }
        }
      }
      onSuccess('Đã lưu thay đổi số lượng đếm thực tế');
      setIsEditing(false);
      onRefresh();
    } catch (err) {
      onError('Lỗi khi lưu: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const res = await fetch(`${API_BASE}/inventory/stocktakes/${stocktake.id}/approve`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ approvedBy: user.fullName || user.email || '' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Không thể duyệt');
      }
      onSuccess('Đã duyệt và cập nhật tồn kho');
      onRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Lỗi');
    }
  };

  const canApprove = stocktake.status === 'COUNTING_DONE' && isManager;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs" onClick={onClose}>
      <div
        className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-lg bg-white shadow-2xl border border-slate-300 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title Bar */}
        <div className="flex h-10 items-center justify-between bg-slate-100 border-b border-slate-300 px-4 flex-shrink-0">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">THÔNG TIN PHIẾU KIỂM KÊ</span>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 text-sm font-bold">✕</button>
        </div>

        {/* Info Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex-shrink-0 space-y-1.5 text-xs text-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-12">
              <div>
                <span className="font-semibold text-slate-500">Ngày:</span>{' '}
                <span className="font-bold text-slate-800">
                  {stocktake.plannedDate ? new Date(stocktake.plannedDate).toLocaleDateString('vi-VN') : new Date(stocktake.createdAt).toLocaleDateString('vi-VN')}
                </span>
              </div>
              <div>
                <span className="font-semibold text-slate-500">Mã phiếu:</span>{' '}
                <span className="font-bold text-teal-700">{stocktake.stocktakeNo}</span>
              </div>
            </div>
            <div>
              <span className="font-semibold text-slate-500">Trạng thái:</span>{' '}
              <StatusBadge status={stocktake.status} />
            </div>
          </div>
          <div>
            <span className="font-semibold text-slate-500">Nhân viên:</span>{' '}
            <span className="font-bold text-slate-800">{stocktake.assignee || stocktake.createdBy || '—'}</span>
          </div>
        </div>

        {/* Edit mode: Add product bar */}
        {isEditing && (
          <div className="flex items-center gap-2 px-4 pt-3 text-xs flex-shrink-0">
            {(() => {
              const existingProductIds = new Set(detailsList.map(d => d.product?.id).filter(Boolean));
              const availableProducts = products.filter(p => !existingProductIds.has(p.id));
              return (
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="h-8 flex-1 rounded border border-slate-300 bg-white px-2 outline-none"
                >
                  <option value="">— Chọn sản phẩm để thêm vào phiếu —</option>
                  {availableProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.internalSku} - {p.name} {p.unit ? `(${p.unit})` : ''}
                    </option>
                  ))}
                </select>
              );
            })()}
            <button
              type="button"
              onClick={handleAddProductToExisting}
              disabled={!selectedProductId}
              className="h-8 rounded bg-teal-600 px-3 font-bold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              + Thêm sản phẩm
            </button>
          </div>
        )}

        {/* Table Details */}
        <div className="flex-1 overflow-auto p-4">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-100 border border-slate-300 font-bold text-slate-700">
                <th className="w-10 border border-slate-300 px-2 py-2 text-center">TT</th>
                <th className="border border-slate-300 px-3 py-2 text-center">Mã hàng</th>
                <th className="border border-slate-300 px-3 py-2">Tên</th>
                <th className="border border-slate-300 px-3 py-2 text-center">ĐV</th>
                <th className="border border-slate-300 px-3 py-2 text-center bg-yellow-50/40">Số tồn</th>
                <th className="border border-slate-300 px-3 py-2 text-center bg-teal-50/40">Thực tồn</th>
                <th className="border border-slate-300 px-3 py-2 text-center bg-red-50/40">Lệch</th>
                <th className="border border-slate-300 px-3 py-2">Ghi chú</th>
                {stocktake.status !== 'APPROVED' && stocktake.status !== 'REJECTED' && (
                  <th className="w-10 border border-slate-300 px-1 py-2 text-center text-red-500">Xóa</th>
                )}
              </tr>
            </thead>
            <tbody>
              {detailsList.length === 0 ? (
                <tr>
                  <td colSpan={stocktake.status !== 'APPROVED' && stocktake.status !== 'REJECTED' ? 9 : 8} className="px-6 py-10 text-center text-xs text-slate-400 italic">
                    Không có sản phẩm nào trong phiếu kiểm kê này.
                  </td>
                </tr>
              ) : (
                detailsList.map((d, idx) => {
                  const isEditingThis = isEditing;
                  const displayQty = isEditingThis
                    ? (editCounts[d.id] !== undefined ? editCounts[d.id] : String(d.countedQty || 0))
                    : (d.countedQty !== null ? d.countedQty : 0);
                  const systemVal = d.systemQty || 0;
                  const currentCount = Number(displayQty) || 0;
                  const diff = currentCount - systemVal;

                  return (
                    <tr key={d.id} className="border-b border-slate-200 hover:bg-slate-50/30">
                      <td className="border border-slate-300 px-2 py-2 text-center text-slate-500 font-semibold">{idx + 1}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-bold text-slate-700">{d.product?.internalSku || '—'}</td>
                      <td className="border border-slate-300 px-3 py-2 text-slate-600">{d.product?.name || '—'}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center text-slate-500">{d.product?.unit || 'Cái'}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-bold text-slate-700 bg-yellow-50/20">{systemVal}</td>
                      <td className="border border-slate-300 px-2 py-1 text-center bg-teal-50/20">
                        {isEditingThis ? (
                          <input
                            type="number"
                            min="0"
                            value={displayQty}
                            onChange={(e) => setEditCounts(prev => ({ ...prev, [d.id]: e.target.value }))}
                            className="h-7 w-20 text-center rounded border border-slate-300 outline-none text-xs font-bold text-teal-800 focus:border-teal-500"
                          />
                        ) : (
                          <span className="font-bold text-teal-700">{d.countedQty !== null ? d.countedQty : '—'}</span>
                        )}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-bold bg-red-50/20">
                        <span className={diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-slate-500'}>
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-slate-500">{d.note || ''}</td>
                      {stocktake.status !== 'APPROVED' && stocktake.status !== 'REJECTED' && (
                        <td className="border border-slate-300 px-1 py-1 text-center">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm(`Bạn có chắc muốn xóa sản phẩm "${d.product?.name || d.product?.internalSku || ''}" khỏi phiếu kiểm kê này?`)) return;
                              try {
                                const res = await fetch(`${API_BASE}/inventory/stocktakes/details/${d.id}`, {
                                  method: 'DELETE',
                                  headers: authHeaders(),
                                });
                                if (!res.ok) {
                                  const data = await res.json().catch(() => null);
                                  throw new Error(data?.message || 'Không thể xóa sản phẩm');
                                }
                                onSuccess('Đã xóa sản phẩm khỏi phiếu kiểm kê');
                                onRefresh();
                              } catch (err: any) {
                                onError(err.message || 'Lỗi khi xóa');
                              }
                            }}
                            className="rounded p-1 text-red-500 transition hover:bg-red-50 hover:text-red-700"
                            title="Xóa sản phẩm khỏi phiếu"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
              {/* Row Total */}
              {detailsList.length > 0 && (
                <tr className="bg-slate-100 font-bold text-slate-700 border border-slate-300">
                  <td colSpan={4} className="border border-slate-300 px-3 py-2 text-right">Tổng:</td>
                  <td className="border border-slate-300 px-3 py-2 text-center">{totalTon}</td>
                  <td className="border border-slate-300 px-3 py-2 text-center text-teal-700">{totalThucTon}</td>
                  <td className="border border-slate-300 px-3 py-2 text-center">
                    <span className={totalLech > 0 ? 'text-emerald-600' : totalLech < 0 ? 'text-red-600' : 'text-slate-500'}>
                      {totalLech > 0 ? `+${totalLech}` : totalLech}
                    </span>
                  </td>
                  <td colSpan={stocktake.status !== 'APPROVED' && stocktake.status !== 'REJECTED' ? 2 : 1} className="border border-slate-300 px-3 py-2"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Note block */}
        {stocktake.note && (
          <div className="px-4 pb-3 flex-shrink-0 text-xs text-slate-600">
            <span className="font-bold">Ghi chú:</span> {stocktake.note}
          </div>
        )}

        {/* Footer actions */}
        <div className="flex h-12 items-center justify-start gap-1.5 border-t border-slate-300 bg-slate-200 px-4 flex-shrink-0">
          {isEditing ? (
            <button
              onClick={handleSaveAll}
              disabled={submitting}
              className="flex h-8 items-center gap-1 rounded bg-emerald-600 px-4 text-xs font-bold text-white shadow hover:bg-emerald-700 transition"
            >
              💾 Lưu thay đổi
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex h-8 items-center gap-1 rounded bg-emerald-600 px-4 text-xs font-bold text-white shadow hover:bg-emerald-700 transition"
            >
              📝 Mở =&gt; Sửa
            </button>
          )}

          {canApprove && (
            <button
              onClick={handleApprove}
              className="flex h-8 items-center gap-1 rounded bg-orange-500 px-4 text-xs font-bold text-white shadow hover:bg-orange-600 transition"
            >
              🛡 DUYỆT PHIẾU
            </button>
          )}

          <button
            onClick={() => {
              // Export CSV
              const header = ['TT', 'Mã hàng', 'Tên', 'ĐV', 'Số tồn', 'Thực tồn', 'Lệch', 'Ghi chú'];
              const rows = stocktake.details.map((d, i) => [
                i + 1,
                d.product?.internalSku || '',
                d.product?.name || '',
                d.product?.unit || 'Cái',
                d.systemQty,
                d.countedQty !== null ? d.countedQty : '',
                d.difference,
                d.note || ''
              ]);
              const csv = [header, ...rows].map(r => r.join(',')).join('\n');
              const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `chi_tiet_kiem_ke_${stocktake.stocktakeNo}.csv`; a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex h-8 items-center gap-1 rounded bg-blue-600 px-4 text-xs font-bold text-white shadow hover:bg-blue-700 transition"
          >
            📊 Excel
          </button>
          <button
            onClick={() => window.print()}
            className="flex h-8 items-center gap-1 rounded bg-pink-600 px-4 text-xs font-bold text-white shadow hover:bg-pink-700 transition"
          >
            🖨 Print
          </button>
          <button
            onClick={onClose}
            className="flex h-8 items-center gap-1 rounded bg-red-600 px-4 text-xs font-bold text-white shadow hover:bg-red-700 transition"
          >
            ✕ Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
