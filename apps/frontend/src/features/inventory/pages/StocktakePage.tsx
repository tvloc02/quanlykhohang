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

  // Base columns count for detail mode
  const baseColCount = showDetail ? 15 : 10;

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
            checked={showDetail}
            onChange={(e) => setShowDetail(e.target.checked)}
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

        {/* Settings gear */}
        <button
          onClick={loadData}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 transition"
          title="Cài đặt"
        >
          <Settings2 className="h-4 w-4" />
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
              <tr style={{ background: 'linear-gradient(180deg, #e8f5e9 0%, #c8e6c9 100%)' }}>
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
                <th className="border border-slate-300 px-2 py-2.5 text-center font-bold text-slate-700">
                  <div className="flex items-center justify-center gap-1">
                    NV <ChevronDown className="h-3 w-3 text-slate-400" />
                  </div>
                </th>
                <th className="border border-slate-300 px-2 py-2.5 text-center font-bold text-slate-700">
                  <div className="flex items-center justify-center gap-1">
                    Mã <ChevronDown className="h-3 w-3 text-slate-400" />
                  </div>
                </th>
                <th className="border border-slate-300 px-2 py-2.5 text-center font-bold text-slate-700">
                  <div className="flex items-center justify-center gap-1">
                    Ngày <ChevronDown className="h-3 w-3 text-slate-400" />
                  </div>
                </th>
                <th className="border border-slate-300 px-2 py-2.5 text-center font-bold text-slate-700">
                  <div className="flex items-center justify-center gap-1">
                    Tổng lệch <ChevronDown className="h-3 w-3 text-slate-400" />
                  </div>
                </th>
                <th className="border border-slate-300 px-2 py-2.5 text-center font-bold text-slate-700">
                  <div className="flex items-center justify-center gap-1">
                    Ghi chú <ChevronDown className="h-3 w-3 text-slate-400" />
                  </div>
                </th>
                <th className="border border-slate-300 px-2 py-2.5 text-center font-bold text-slate-700">
                  <div className="flex items-center justify-center gap-1">
                    Trạng thái <ChevronDown className="h-3 w-3 text-slate-400" />
                  </div>
                </th>
                {showDetail && (
                  <>
                    <th className="border border-slate-300 px-2 py-2.5 text-center font-bold text-slate-700" style={{ background: '#FFF3E0' }}>
                      <div className="flex items-center justify-center gap-1">
                        Mã hàng <ChevronDown className="h-3 w-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="border border-slate-300 px-2 py-2.5 text-center font-bold text-slate-700" style={{ background: '#FFF3E0' }}>
                      <div className="flex items-center justify-center gap-1">
                        Tên hàng <ChevronDown className="h-3 w-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="border border-slate-300 px-2 py-2.5 text-center font-bold text-slate-700" style={{ background: '#FFF3E0' }}>
                      <div className="flex items-center justify-center gap-1">
                        Tồn <ChevronDown className="h-3 w-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="border border-slate-300 px-2 py-2.5 text-center font-bold text-slate-700" style={{ background: '#FFF3E0' }}>
                      <div className="flex items-center justify-center gap-1">
                        Thực tồn <ChevronDown className="h-3 w-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="border border-slate-300 px-2 py-2.5 text-center font-bold text-slate-700" style={{ background: '#FFF3E0' }}>
                      <div className="flex items-center justify-center gap-1">
                        Lệch <ChevronDown className="h-3 w-3 text-slate-400" />
                      </div>
                    </th>
                  </>
                )}
                <th className="border border-slate-300 px-2 py-2.5 text-center font-bold text-slate-700">
                  <div className="flex items-center justify-center gap-1">
                    Ghi chú <ChevronDown className="h-3 w-3 text-slate-400" />
                  </div>
                </th>
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
                  const detailRows = showDetail && hasDetails ? item.details : [];
                  const firstDetail = detailRows.length > 0 ? detailRows[0] : null;
                  const extraDetails = detailRows.length > 1 ? detailRows.slice(1) : [];

                  return (
                    <React.Fragment key={item.id}>
                      {/* Main row */}
                      <tr className={`border-b border-slate-200 transition hover:bg-cyan-50/40 ${selectedIds.has(item.id) ? 'bg-cyan-50/60' : ''}`}>
                        <td className="border border-slate-200 px-2 py-2 text-center text-xs text-slate-600" rowSpan={showDetail && extraDetails.length > 0 ? extraDetails.length + 1 : 1}>
                          {startIndex + index}
                        </td>
                        <td className="border border-slate-200 px-2 py-2 text-center" rowSpan={showDetail && extraDetails.length > 0 ? extraDetails.length + 1 : 1}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleSelect(item.id)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                          />
                        </td>
                        <td className="border border-slate-200 px-2 py-2 text-center text-xs text-slate-600" rowSpan={showDetail && extraDetails.length > 0 ? extraDetails.length + 1 : 1}>
                          {item.assignee || item.createdBy || '—'}
                        </td>
                        <td className="border border-slate-200 px-2 py-2 text-center text-xs font-bold text-cyan-700" rowSpan={showDetail && extraDetails.length > 0 ? extraDetails.length + 1 : 1}>
                          <button
                            onClick={() => handleViewDetail(item.id)}
                            className="hover:underline hover:text-cyan-800 transition"
                          >
                            {item.stocktakeNo}
                          </button>
                        </td>
                        <td className="border border-slate-200 px-2 py-2 text-center text-xs text-slate-600" rowSpan={showDetail && extraDetails.length > 0 ? extraDetails.length + 1 : 1}>
                          {itemDate}
                        </td>
                        <td className="border border-slate-200 px-2 py-2 text-center text-xs font-bold" rowSpan={showDetail && extraDetails.length > 0 ? extraDetails.length + 1 : 1}>
                          <span className={totalDiff !== 0 ? 'text-red-600' : 'text-slate-400'}>
                            {totalDiff !== 0 ? totalDiff.toFixed(1) : '0.0'}
                          </span>
                        </td>
                        <td className="border border-slate-200 px-2 py-2 text-center text-xs text-slate-500" rowSpan={showDetail && extraDetails.length > 0 ? extraDetails.length + 1 : 1}>
                          {item.note || ''}
                        </td>
                        <td className="border border-slate-200 px-2 py-2 text-center" rowSpan={showDetail && extraDetails.length > 0 ? extraDetails.length + 1 : 1}>
                          <StatusBadge status={item.status} />
                        </td>
                        {showDetail && (
                          <>
                            <td className="border border-slate-200 px-2 py-2 text-center text-xs text-slate-600" style={{ background: '#FFFDE7' }}>
                              {firstDetail?.product?.internalSku || ''}
                            </td>
                            <td className="border border-slate-200 px-2 py-2 text-left text-xs text-slate-600" style={{ background: '#FFFDE7' }}>
                              {firstDetail?.product?.name || ''}
                            </td>
                            <td className="border border-slate-200 px-2 py-2 text-center text-xs font-semibold text-slate-700" style={{ background: '#FFFDE7' }}>
                              {firstDetail ? firstDetail.systemQty.toLocaleString('vi-VN') : ''}
                            </td>
                            <td className="border border-slate-200 px-2 py-2 text-center text-xs font-semibold text-slate-700" style={{ background: '#FFFDE7' }}>
                              {firstDetail?.countedQty != null ? firstDetail.countedQty.toLocaleString('vi-VN') : ''}
                            </td>
                            <td className="border border-slate-200 px-2 py-2 text-center text-xs font-bold" style={{ background: '#FFFDE7' }}>
                              {firstDetail?.countedQty != null ? (
                                <span className={firstDetail.difference !== 0 ? 'text-red-600' : 'text-slate-500'}>
                                  {firstDetail.difference}
                                </span>
                              ) : ''}
                            </td>
                          </>
                        )}
                        <td className="border border-slate-200 px-2 py-2 text-center text-xs text-slate-400" rowSpan={showDetail && extraDetails.length > 0 ? extraDetails.length + 1 : 1}>
                          {showDetail && firstDetail?.note ? firstDetail.note : ''}
                        </td>
                        <td className="border border-slate-200 px-2 py-2 text-center" rowSpan={showDetail && extraDetails.length > 0 ? extraDetails.length + 1 : 1}>
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
                            {item.status === 'DRAFT' && (
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="rounded p-1 text-red-400 transition hover:bg-red-50 hover:text-red-600"
                                title="Xóa"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Extra detail rows (if showDetail is on) */}
                      {showDetail && extraDetails.map((detail, dIdx) => (
                        <tr key={`${item.id}-d-${dIdx}`} className="border-b border-slate-100 hover:bg-amber-50/30">
                          <td className="border border-slate-200 px-2 py-1.5 text-center text-xs text-slate-600" style={{ background: '#FFFDE7' }}>
                            {detail.product?.internalSku || ''}
                          </td>
                          <td className="border border-slate-200 px-2 py-1.5 text-left text-xs text-slate-600" style={{ background: '#FFFDE7' }}>
                            {detail.product?.name || ''}
                          </td>
                          <td className="border border-slate-200 px-2 py-1.5 text-center text-xs font-semibold text-slate-700" style={{ background: '#FFFDE7' }}>
                            {detail.systemQty.toLocaleString('vi-VN')}
                          </td>
                          <td className="border border-slate-200 px-2 py-1.5 text-center text-xs font-semibold text-slate-700" style={{ background: '#FFFDE7' }}>
                            {detail.countedQty != null ? detail.countedQty.toLocaleString('vi-VN') : ''}
                          </td>
                          <td className="border border-slate-200 px-2 py-1.5 text-center text-xs font-bold" style={{ background: '#FFFDE7' }}>
                            {detail.countedQty != null ? (
                              <span className={detail.difference !== 0 ? 'text-red-600' : 'text-slate-500'}>
                                {detail.difference}
                              </span>
                            ) : ''}
                          </td>
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
                  <td colSpan={5} className="border border-slate-300 px-2 py-2 text-right text-xs font-bold text-slate-600">
                    Tổng cộng:
                  </td>
                  <td className="border border-slate-300 px-2 py-2 text-center text-xs font-bold text-red-600">
                    {footerTotalTongLech !== 0 ? footerTotalTongLech.toFixed(1) : '0.0'}
                  </td>
                  <td className="border border-slate-300 px-2 py-2" />
                  <td className="border border-slate-300 px-2 py-2" />
                  {showDetail && (
                    <>
                      <td className="border border-slate-300 px-2 py-2" />
                      <td className="border border-slate-300 px-2 py-2" />
                      <td className="border border-slate-300 px-2 py-2 text-center text-xs font-bold text-slate-700">
                        {footerTotalTon.toLocaleString('vi-VN')}
                      </td>
                      <td className="border border-slate-300 px-2 py-2 text-center text-xs font-bold text-slate-700">
                        {footerTotalThucTon.toLocaleString('vi-VN')}
                      </td>
                      <td className="border border-slate-300 px-2 py-2 text-center text-xs font-bold text-red-600">
                        {footerTotalLech.toLocaleString('vi-VN')}
                      </td>
                    </>
                  )}
                  <td className="border border-slate-300 px-2 py-2" />
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

    // Tải tất cả thông tin sản phẩm và số lượng tồn hệ thống của chúng
    fetch(`${API_BASE}/products`, { headers: authHeaders() })
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
    // Lấy tồn kho hệ thống ngẫu nhiên hoặc mặc định là 1-10 để demo giống RIC
    const systemQty = p.stockQty !== undefined ? p.stockQty : Math.floor(Math.random() * 20) + 1;
    setItems(prev => [
      ...prev,
      {
        product: { id: p.id, internalSku: p.internalSku, name: p.name, unit: p.unit, systemQty },
        countedQty: 0,
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

  const executeSubmit = async (status: string = 'DRAFT') => {
    if (!locationCode) {
      onError('Vui lòng chọn Kho / Vị trí kiểm kê');
      return;
    }
    setSubmitting(true);
    try {
      // 1. Tạo phiên kiểm kê
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
          status // 'DRAFT' hoặc 'COUNTING'
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Không thể tạo phiên kiểm kê');
      }
      const created = await res.json();

      // 2. Thêm từng sản phẩm và cập nhật số lượng đếm
      for (const item of items) {
        // Thêm sản phẩm vào chi tiết
        const detailRes = await fetch(`${API_BASE}/inventory/stocktakes/${created.id}/details`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ productId: item.product.id }),
        });
        if (detailRes.ok) {
          const detail = await detailRes.json();
          // Cập nhật số thực đếm
          await fetch(`${API_BASE}/inventory/stocktakes/details/${detail.id}/count`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({ countedQty: item.countedQty }),
          });
        }
      }

      onCreated(created);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Lỗi');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const kw = productSearch.toLowerCase();
    return p.name.toLowerCase().includes(kw) || p.internalSku.toLowerCase().includes(kw);
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
                onFocus={() => setShowDropdown(true)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Gõ vào mã/tên hàng hóa"
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
      <div className="flex h-12 items-center justify-between border-t border-slate-300 bg-slate-200 px-4 flex-shrink-0">
        <div className="flex items-center gap-1.5">
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
        </div>
        <div>
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
  const [selectedProductId, setSelectedProductId] = React.useState('');
  const [addingProduct, setAddingProduct] = React.useState(false);
  const [scannerOpen, setScannerOpen] = React.useState(false);

  // Editable counts - local state keyed by detail id
  const [editCounts, setEditCounts] = React.useState<Record<string, string>>({});

  // Load products list for the add dropdown
  React.useEffect(() => {
    fetch(`${API_BASE}/products`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProducts(data);
        else if (data?.data && Array.isArray(data.data)) setProducts(data.data);
      })
      .catch(() => { });
  }, []);

  const canEdit = stocktake.status === 'DRAFT' || stocktake.status === 'COUNTING';
  const canFinish = stocktake.status === 'COUNTING';
  const canApproveReject = stocktake.status === 'COUNTING_DONE' && isManager;

  // ── Add Product ─────────────────────────────────────────────

  const handleAddProduct = async () => {
    if (!selectedProductId) return;
    setAddingProduct(true);
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
      onSuccess('Đã thêm sản phẩm');
      onRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Lỗi');
    } finally {
      setAddingProduct(false);
    }
  };

  const handleProductScanned = async (product: ScannedProduct, qty: number) => {
    if (!canEdit) {
      onError('Phiên kiểm kê không ở trạng thái cho phép cập nhật số lượng.');
      return;
    }

    const detail = stocktake.details.find((d) => d.product?.id === product.id);

    if (detail) {
      // Đã có trong danh sách -> cộng dồn vào ô đang nhập (hoặc số đang đếm)
      const currentVal = editCounts[detail.id] !== undefined ? editCounts[detail.id] : (detail.countedQty?.toString() || '0');
      const nextQty = Number(currentVal) + qty;
      setEditCounts((prev) => ({ ...prev, [detail.id]: nextQty.toString() }));
      onSuccess(`Đã cộng dồn ${qty} cho ${product.name}. (Bấm "Lưu" để cập nhật lên hệ thống)`);
    } else {
      // Chưa có trong danh sách -> Gọi API thêm vào trước
      try {
        const res = await fetch(`${API_BASE}/inventory/stocktakes/${stocktake.id}/details`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ productId: product.id }),
        });
        if (!res.ok) {
          throw new Error('Không thể thêm sản phẩm mới từ máy quét');
        }

        // Ta cần onRefresh() để lấy detail id mới sinh.
        // Tạm thời, người dùng sẽ quét lại hoặc nhập tay số lượng sau khi nó xuất hiện.
        onSuccess(`Đã thêm ${product.name} vào danh sách kiểm kê.`);
        onRefresh();
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Lỗi quét mã');
      }
    }
  };

  // ── Remove Detail ───────────────────────────────────────────

  const handleRemoveDetail = async (detailId: string) => {
    try {
      const res = await fetch(`${API_BASE}/inventory/stocktakes/details/${detailId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Không thể xóa');
      }
      onSuccess('Đã xóa sản phẩm');
      onRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Lỗi');
    }
  };

  // ── Update Count ────────────────────────────────────────────

  const handleSaveCount = async (detailId: string) => {
    const val = editCounts[detailId];
    if (val === undefined || val === '') return;
    const qty = parseInt(val, 10);
    if (isNaN(qty) || qty < 0) {
      onError('Số lượng đếm phải là số nguyên không âm');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/inventory/stocktakes/details/${detailId}/count`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ countedQty: qty }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Không thể cập nhật');
      }
      // Clear local edit state
      setEditCounts((prev) => {
        const next = { ...prev };
        delete next[detailId];
        return next;
      });
      onRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Lỗi');
    }
  };

  // ── Finish Counting ─────────────────────────────────────────

  const handleFinishCounting = async () => {
    try {
      const res = await fetch(`${API_BASE}/inventory/stocktakes/${stocktake.id}/finish-counting`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Không thể hoàn tất');
      }
      onSuccess('Đã hoàn tất đếm, chờ duyệt');
      onRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Lỗi');
    }
  };

  // ── Approve / Reject ────────────────────────────────────────

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

  const handleReject = async () => {
    try {
      const res = await fetch(`${API_BASE}/inventory/stocktakes/${stocktake.id}/reject`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Không thể từ chối');
      }
      onSuccess('Đã từ chối phiên kiểm kê');
      onRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Lỗi');
    }
  };

  // Available products (not already in this stocktake)
  const usedProductIds = new Set(stocktake.details.map((d) => d.product?.id).filter(Boolean));
  const availableProducts = products.filter((p) => !usedProductIds.has(p.id));

  // Stats
  const totalDiff = stocktake.details.reduce((sum, d) => sum + Math.abs(d.difference), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b-2 border-slate-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)' }}
            >
              <ListChecks className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                Phiên kiểm kê {stocktake.stocktakeNo}
              </h2>
              <div className="mt-1 flex items-center gap-3 text-sm text-slate-500">
                <span>Kho: <b className="text-slate-700">{stocktake.locationCode}</b></span>
                <span>•</span>
                <StatusBadge status={stocktake.status} />
                {stocktake.plannedDate && (
                  <>
                    <span>•</span>
                    <span>Ngày: <b className="text-slate-700">{new Date(stocktake.plannedDate).toLocaleDateString('vi-VN')}</b></span>
                  </>
                )}
                {stocktake.assignee && (
                  <>
                    <span>•</span>
                    <span>NV: <b className="text-slate-700">{stocktake.assignee}</b></span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 transition hover:bg-slate-100">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Modal Body - scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border-2 border-cyan-200 bg-cyan-50 p-4 text-center">
              <p className="text-xs font-bold text-cyan-700 uppercase">Tổng SP</p>
              <p className="mt-1 text-2xl font-black text-cyan-600">{stocktake.totalItems}</p>
            </div>
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 text-center">
              <p className="text-xs font-bold text-amber-700 uppercase">Đã đếm</p>
              <p className="mt-1 text-2xl font-black text-amber-600">{stocktake.countedItems}/{stocktake.totalItems}</p>
            </div>
            <div className={`rounded-xl border-2 p-4 text-center ${totalDiff > 0 ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
              <p className={`text-xs font-bold uppercase ${totalDiff > 0 ? 'text-red-700' : 'text-emerald-700'}`}>Chênh lệch</p>
              <p className={`mt-1 text-2xl font-black ${totalDiff > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{totalDiff}</p>
            </div>
          </div>

          {/* Note */}
          {stocktake.note && (
            <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Ghi chú</p>
              <p className="text-sm text-slate-700">{stocktake.note}</p>
            </div>
          )}

          {/* Add product (only if editable) */}
          {canEdit && (
            <div className="flex items-end gap-3">
              <ScanBarcodeButton onClick={() => setScannerOpen(true)} />
              <div className="flex-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Thêm sản phẩm kiểm</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                >
                  <option value="">— Chọn sản phẩm —</option>
                  {availableProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.internalSku} — {p.name} {p.unit ? `(${p.unit})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAddProduct}
                disabled={!selectedProductId || addingProduct}
                className="h-11 rounded-xl px-5 text-sm font-bold text-white shadow-md transition hover:shadow-lg disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)' }}
              >
                <Plus size={18} />
              </button>
            </div>
          )}

          {/* Details Table */}
          <div className="overflow-hidden rounded-xl border-2 border-slate-200">
            <table className="w-full border-collapse bg-white">
              <thead className="bg-slate-50">
                <tr className="border-b-2 border-slate-200">
                  <th className="w-14 border-x border-slate-200 px-3 py-3 text-center text-xs font-black uppercase text-slate-700">STT</th>
                  <th className="border-x border-slate-200 px-3 py-3 text-center text-xs font-black uppercase text-slate-700">SKU</th>
                  <th className="border-x border-slate-200 px-3 py-3 text-left text-xs font-black uppercase text-slate-700">Tên sản phẩm</th>
                  <th className="border-x border-slate-200 px-3 py-3 text-center text-xs font-black uppercase text-cyan-700 bg-cyan-50/50">SL hệ thống</th>
                  <th className="border-x border-slate-200 px-3 py-3 text-center text-xs font-black uppercase text-amber-700 bg-amber-50/50">SL thực đếm</th>
                  <th className="border-x border-slate-200 px-3 py-3 text-center text-xs font-black uppercase text-slate-700">Chênh lệch</th>
                  {canEdit && <th className="w-20 border-x border-slate-200 px-3 py-3 text-center text-xs font-black uppercase text-slate-700">Xóa</th>}
                </tr>
              </thead>
              <tbody>
                {stocktake.details.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 7 : 6} className="px-6 py-10 text-center text-sm text-slate-500">
                      Chưa có sản phẩm nào. Hãy thêm sản phẩm cần kiểm kê.
                    </td>
                  </tr>
                ) : (
                  stocktake.details.map((detail, idx) => {
                    const isEditing = editCounts[detail.id] !== undefined;
                    const displayCount = isEditing ? editCounts[detail.id] : (detail.countedQty !== null ? String(detail.countedQty) : '');
                    const diff = detail.difference;

                    return (
                      <tr key={detail.id} className="border-b border-slate-200 transition hover:bg-slate-50/50">
                        <td className="border-x border-slate-200 px-3 py-3 text-center text-sm text-slate-600">{idx + 1}</td>
                        <td className="border-x border-slate-200 px-3 py-3 text-center text-sm font-bold text-slate-800">
                          {detail.product?.internalSku || '—'}
                        </td>
                        <td className="border-x border-slate-200 px-3 py-3 text-left text-sm text-slate-700">
                          {detail.product?.name || '—'}
                          {detail.product?.unit && <span className="ml-1 text-xs text-slate-400">({detail.product.unit})</span>}
                        </td>
                        <td className="border-x border-slate-200 px-3 py-3 text-center text-sm font-black text-cyan-600">
                          {detail.systemQty.toLocaleString('vi-VN')}
                        </td>
                        <td className="border-x border-slate-200 px-3 py-3 text-center">
                          {canEdit ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                value={displayCount}
                                onChange={(e) => setEditCounts((prev) => ({ ...prev, [detail.id]: e.target.value }))}
                                onBlur={() => {
                                  if (editCounts[detail.id] !== undefined && editCounts[detail.id] !== '') {
                                    handleSaveCount(detail.id);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveCount(detail.id);
                                }}
                                placeholder="Nhập SL"
                                className="h-9 w-24 rounded-lg border-2 border-amber-200 bg-amber-50/50 px-2 text-center text-sm font-bold text-amber-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                              />
                            </div>
                          ) : (
                            <span className="text-sm font-black text-amber-600">
                              {detail.countedQty !== null ? detail.countedQty.toLocaleString('vi-VN') : '—'}
                            </span>
                          )}
                        </td>
                        <td className="border-x border-slate-200 px-3 py-3 text-center text-sm font-black">
                          {detail.countedQty !== null ? (
                            <span className={diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-slate-500'}>
                              {diff > 0 ? `+${diff}` : diff}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        {canEdit && (
                          <td className="border-x border-slate-200 px-3 py-3 text-center">
                            <button
                              onClick={() => handleRemoveDetail(detail.id)}
                              className="rounded-lg p-1.5 text-red-400 transition hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Approved Info */}
          {stocktake.status === 'APPROVED' && stocktake.approvedBy && (
            <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm text-emerald-700">
                <b>Đã duyệt bởi:</b> {stocktake.approvedBy}
                {stocktake.approvedAt && ` — ${new Date(stocktake.approvedAt).toLocaleString('vi-VN')}`}
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t-2 border-slate-200 px-6 py-4 flex-shrink-0 bg-slate-50/50">
          <button
            onClick={onClose}
            className="rounded-xl border-2 border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
          >
            Đóng
          </button>
          <div className="flex items-center gap-3">
            {canFinish && (
              <button
                onClick={handleFinishCounting}
                disabled={!stocktake.details || stocktake.details.length === 0}
                className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-md transition ${!stocktake.details || stocktake.details.length === 0
                    ? 'opacity-50 cursor-not-allowed grayscale'
                    : 'hover:shadow-lg'
                  }`}
                style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' }}
              >
                <span className="flex items-center gap-2">
                  <ListChecks size={16} />
                  Hoàn tất đếm
                </span>
              </button>
            )}
            {canApproveReject && (
              <>
                <button
                  onClick={handleReject}
                  className="rounded-xl border-2 border-red-200 bg-white px-5 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50"
                >
                  <span className="flex items-center gap-2">
                    <Ban size={16} />
                    Từ chối
                  </span>
                </button>
                <button
                  onClick={handleApprove}
                  className="rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck size={16} />
                    Duyệt kiểm kê
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tích hợp Barcode Scanner */}
      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onProductFound={handleProductScanned}
        title="Quét mã vạch kiểm kê"
      />
    </div>
  );
}
