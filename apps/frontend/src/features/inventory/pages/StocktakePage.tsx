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
} from 'lucide-react';

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
      className={`fixed top-4 right-4 z-[60] flex items-center gap-3 rounded-xl px-5 py-3 shadow-lg transition-all animate-[slideIn_0.3s_ease-out] ${
        type === 'error'
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

export default function StocktakePage({ viewMode = 'stocktake' }: { viewMode?: 'requests' | 'create' | 'stocktake' }) {
  const [stocktakes, setStocktakes] = React.useState<StocktakeItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [toast, setToast] = React.useState({ message: '', type: 'success' as 'success' | 'error' });

  // Pagination
  const [pageSize, setPageSize] = React.useState(20);
  const [currentPage, setCurrentPage] = React.useState(1);

  // Modals
  const [showCreateModal, setShowCreateModal] = React.useState(viewMode === 'create');
  const [showDetailModal, setShowDetailModal] = React.useState(false);

  const isRequestsView = viewMode === 'requests';
  const isCreateView = viewMode === 'create';
  const pageTitle = isRequestsView ? 'Yêu cầu kiểm kê' : isCreateView ? 'Lập phiếu kiểm kê' : 'Kiểm kê kho hàng';
  const pageSubtitle = isRequestsView
    ? 'Danh sách yêu cầu kiểm kê cần tiếp nhận và xử lý.'
    : isCreateView
    ? 'Tạo mới một phiên kiểm kê để bắt đầu kiểm kê hàng hóa.'
    : 'Tạo phiên kiểm kê, đếm thực tế, so sánh chênh lệch và cập nhật tồn kho.';
  const defaultIsRequest = isRequestsView;

  React.useEffect(() => {
    setShowCreateModal(viewMode === 'create');
  }, [viewMode]);
  const [selectedStocktake, setSelectedStocktake] = React.useState<StocktakeItem | null>(null);

  // ── Data Loading ────────────────────────────────────────────

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/inventory/stocktakes`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Không tải được dữ liệu kiểm kê');
      const data = await res.json();
      setStocktakes(data);
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Lỗi hệ thống', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  // ── Filter & Pagination ─────────────────────────────────────

  const filtered = stocktakes.filter((s) => {
    const kw = search.trim().toLowerCase();
    return (
      !kw ||
      s.stocktakeNo.toLowerCase().includes(kw) ||
      s.locationCode.toLowerCase().includes(kw) ||
      (s.createdBy || '').toLowerCase().includes(kw) ||
      (STATUS_MAP[s.status]?.label || '').toLowerCase().includes(kw)
    );
  });

  const displayedStocktakes = isRequestsView
    ? filtered.filter((s) => s.status === 'REQUESTED')
    : filtered;

  const totalItems = displayedStocktakes.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginated = displayedStocktakes.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  // ── Summary ─────────────────────────────────────────────────

  const totalAll = stocktakes.length;
  const totalCounting = stocktakes.filter((s) => s.status === 'COUNTING').length;
  const totalWaiting = stocktakes.filter((s) => s.status === 'COUNTING_DONE').length;
  const totalApproved = stocktakes.filter((s) => s.status === 'APPROVED').length;
  const totalRequests = stocktakes.filter((s) => s.status === 'REQUESTED').length;

  // ── Actions ─────────────────────────────────────────────────

  const showSuccess = (msg: string) => setToast({ message: msg, type: 'success' });
  const showError = (msg: string) => setToast({ message: msg, type: 'error' });
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const hasAcceptPermission = Array.isArray(currentUser.permissions) ? currentUser.permissions.includes('stocktake:accept') : String(currentUser.permissions || '').split(',').includes('stocktake:accept');

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

  // ── Render ──────────────────────────────────────────────────

  return (
    <div>
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />

      {/* Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">{pageTitle}</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">{pageSubtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-xl bg-white border-2 border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <PackageSearch className="h-4 w-4" />
            Làm mới
          </button>
          {!isCreateView && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:shadow-lg"
              style={{ background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)' }}
            >
              <Plus className="h-4 w-4" />
              {isRequestsView ? 'Tạo yêu cầu kiểm kê' : 'Tạo phiên kiểm kê'}
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <SummaryCard icon={ClipboardList} label="Tổng phiên" value={totalAll} color="cyan" />
        <SummaryCard icon={Clock} label="Đang đếm" value={totalCounting} color="amber" />
        <SummaryCard icon={AlertTriangle} label="Chờ duyệt" value={totalWaiting} color="blue" />
        <SummaryCard icon={ShieldCheck} label="Đã duyệt" value={totalApproved} color="emerald" />
        <SummaryCard icon={ListChecks} label="Yêu cầu kiểm kê" value={totalRequests} color="violet" />
      </div>

      {/* Search */}
      <div className="mt-8">
        <div className="relative max-w-lg">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white pl-11 pr-4 text-base outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
            placeholder="Tìm theo mã kiểm kê, kho, người tạo..."
          />
        </div>
      </div>

      {/* Table */}
      <div className="mt-5 overflow-hidden rounded-xl border-2 border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse bg-white">
            <thead className="bg-slate-50">
              <tr className="border-b-2 border-slate-200">
                <th className="w-14 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">STT</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Mã kiểm kê</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Kho</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Trạng thái</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Sản phẩm</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Chênh lệch</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Ngày dự kiến</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Người kiểm kê</th>
                <th className="w-36 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Đang tải dữ liệu kiểm kê...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    {isRequestsView ? 'Chưa có yêu cầu kiểm kê nào.' : 'Chưa có phiên kiểm kê nào.'}
                  </td>
                </tr>
              ) : (
                paginated.map((item, index) => (
                  <tr key={item.id} className="group border-b border-slate-200 transition hover:bg-cyan-50/30">
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                      {startIndex + index}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-bold text-cyan-700">
                      {item.stocktakeNo}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                      <span className="inline-flex rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                        {item.locationCode}
                      </span>
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-bold text-slate-700">
                      {item.countedItems}/{item.totalItems}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm">
                      {item.differenceItems > 0 ? (
                        <span className="font-bold text-red-600">{item.differenceItems} SP lệch</span>
                      ) : item.totalItems > 0 && item.countedItems === item.totalItems ? (
                        <span className="font-bold text-emerald-600">Khớp</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-600">
                      {item.plannedDate ? new Date(item.plannedDate).toLocaleDateString('vi-VN') : (item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '—')}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-600">
                      {item.assignee || item.createdBy || '—'}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleViewDetail(item.id)}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-cyan-50 hover:text-cyan-600"
                          title="Xem chi tiết"
                        >
                          <Eye size={16} />
                        </button>
                        {item.status === 'COUNTING_DONE' && (
                          <>
                            <button
                              onClick={() => handleApprove(item.id)}
                              className="rounded-lg p-2 text-emerald-500 transition hover:bg-emerald-50 hover:text-emerald-700"
                              title="Duyệt"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={() => handleReject(item.id)}
                              className="rounded-lg p-2 text-red-400 transition hover:bg-red-50 hover:text-red-600"
                              title="Từ chối"
                            >
                              <Ban size={16} />
                            </button>
                          </>
                        )}
                        {item.status === 'REQUESTED' && hasAcceptPermission && (
                          <button
                            onClick={() => handleAcceptRequest(item.id)}
                            className="rounded-lg p-2 text-violet-600 transition hover:bg-violet-50 hover:text-violet-700"
                            title="Tiếp nhận yêu cầu"
                          >
                            <Check size={16} />
                          </button>
                        )}
                        {item.status === 'DRAFT' && (
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="rounded-lg p-2 text-red-400 transition hover:bg-red-50 hover:text-red-600"
                            title="Xóa"
                          >
                            <Trash2 size={16} />
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

        {/* Pagination */}
        {!loading && totalItems > 0 && (
          <div className="flex flex-col items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-3 sm:flex-row">
            <div className="text-sm text-slate-600">
              Tổng số: <b>{totalItems}</b> <span className="ml-2">Hiển thị {startIndex} - {endIndex}</span>
            </div>
            <div className="mt-4 flex items-center gap-2 sm:mt-0">
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              >
                <option value={5}>5</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"><ChevronsLeft size={16} /></button>
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"><ChevronLeft size={16} /></button>
                <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-sm font-bold text-white">{currentPage}</button>
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"><ChevronRight size={16} /></button>
                <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"><ChevronsRight size={16} /></button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateStocktakeModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); loadData(); showSuccess('Đã tạo phiên kiểm kê mới'); }}
          onSaveAndAdd={(created) => { loadData(); showSuccess('Đã lưu yêu cầu, bạn có thể tạo tiếp'); }}
          onError={showError}
        />
      )}
      {showDetailModal && selectedStocktake && (
        <StocktakeDetailModal
          stocktake={selectedStocktake}
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
}: {
  onClose: () => void;
  onCreated: () => void;
  onSaveAndAdd?: (created?: any) => void;
  onError: (msg: string) => void;
}) {
  const [locationCode, setLocationCode] = React.useState('');
  const [plannedDate, setPlannedDate] = React.useState('');
  const [assignee, setAssignee] = React.useState('');
  const [note, setNote] = React.useState('');
  const [selectedProductIds, setSelectedProductIds] = React.useState<string[]>([]);
  const [isRequest, setIsRequest] = React.useState(false);
  const [requestDate, setRequestDate] = React.useState<string>(new Date().toISOString().slice(0, 16));
  const [requestNo, setRequestNo] = React.useState<string>('');
  const [branch, setBranch] = React.useState<string>('');
  const [dueDate, setDueDate] = React.useState<string>('');
  const [purpose, setPurpose] = React.useState<string>('');
  const [reference, setReference] = React.useState<string>('');
  const [checkBy, setCheckBy] = React.useState<string>('ALL');
  const [detailBy, setDetailBy] = React.useState<string>('');
  const [submitting, setSubmitting] = React.useState(false);

  const [warehouses, setWarehouses] = React.useState<any[]>([]);
  const [users, setUsers] = React.useState<any[]>([]);
  const [products, setProducts] = React.useState<ProductOption[]>([]);

  const modalUser = JSON.parse(localStorage.getItem('user') || '{}');
  const canRequest = Array.isArray(modalUser.permissions) ? modalUser.permissions.includes('stocktake:request') : String(modalUser.permissions || '').split(',').includes('stocktake:request');

  React.useEffect(() => {
    fetch(`${API_BASE}/warehouses`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setWarehouses(Array.isArray(data) ? data : data?.data || []))
      .catch(() => {});
    // Try load branches if available
    fetch(`${API_BASE}/branches`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setWarehouses((prev) => prev.concat(data));
      })
      .catch(() => {});
      
    fetch(`${API_BASE}/users`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setUsers(Array.isArray(data) ? data : data?.data || []))
      .catch(() => {});

    fetch(`${API_BASE}/products`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setProducts(Array.isArray(data) ? data : data?.data || []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationCode.trim()) {
      onError('Vui lòng chọn mã kho / vị trí');
      return;
    }

    setSubmitting(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const res = await fetch(`${API_BASE}/inventory/stocktakes`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          locationCode: locationCode.trim(),
          plannedDate: plannedDate || undefined,
          assignee: assignee || undefined,
          note: note.trim() || undefined,
          isRequest: isRequest || undefined,
          createdBy: user.fullName || user.email || undefined,
          productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
          branch: branch || undefined,
          dueDate: dueDate || undefined,
          purpose: purpose.trim() || undefined,
          reference: reference.trim() || undefined,
          checkBy: checkBy || undefined,
          detailBy: detailBy || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Không thể tạo phiên kiểm kê');
      }
      const created = await res.json().catch(() => null);
      // If server returns a requestNo, display it
      if (created?.requestNo) setRequestNo(created.requestNo);
      onCreated();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Lỗi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitSaveAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const res = await fetch(`${API_BASE}/inventory/stocktakes`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          locationCode: locationCode.trim(),
          plannedDate: plannedDate || undefined,
          assignee: assignee || undefined,
          note: note.trim() || undefined,
          isRequest: isRequest || undefined,
          createdBy: user.fullName || user.email || undefined,
          productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
          branch: branch || undefined,
          dueDate: dueDate || undefined,
          purpose: purpose.trim() || undefined,
          reference: reference.trim() || undefined,
          checkBy: checkBy || undefined,
          detailBy: detailBy || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Không thể tạo phiên kiểm kê');
      }
      const created = await res.json().catch(() => null);
      if (created?.requestNo) setRequestNo(created.requestNo);
      // Reset form for new entry
      setLocationCode('');
      setPlannedDate('');
      setAssignee('');
      setNote('');
      setSelectedProductIds([]);
      setIsRequest(false);
      setBranch('');
      setDueDate('');
      setPurpose('');
      setReference('');
      setCheckBy('ALL');
      setDetailBy('');
      // Notify parent to refresh list and show message
      if (onSaveAndAdd) onSaveAndAdd(created);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Lỗi');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleProduct = (id: string) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-slate-200 px-6 py-4 flex-shrink-0">
            <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)' }}>
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-lg font-black text-slate-900">{isRequest ? 'Thêm yêu cầu kiểm kê' : 'Tạo phiên kiểm kê'}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 transition hover:bg-slate-100">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Ngày yêu cầu</label>
              <input type="datetime-local" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Số yêu cầu</label>
              <input value={requestNo} readOnly placeholder="(sẽ sinh tự động sau khi lưu)" className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 text-sm outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Kho / Vị trí <span className="text-red-500">*</span>
              </label>
              <select
                value={locationCode}
                onChange={(e) => setLocationCode(e.target.value)}
                className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                autoFocus
              >
                <option value="">— Chọn kho —</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.code}>{w.code} - {w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Ngày dự kiến</label>
                <input
                  type="datetime-local"
                  value={plannedDate}
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={(e) => setPlannedDate(e.target.value)}
                  className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Người kiểm kê</label>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
            >
              <option value="">— Chọn nhân viên —</option>
              {users.map(u => (
                <option key={u.id} value={u.fullName || u.email}>{u.fullName || u.email}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Sản phẩm cần kiểm</label>
            <div className="max-h-40 overflow-y-auto rounded-xl border-2 border-slate-200 bg-slate-50 p-2">
              {products.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">Chưa có sản phẩm</p>
              ) : (
                products.map(p => (
                  <label key={p.id} className="flex items-center gap-3 p-2 hover:bg-slate-100 rounded-lg cursor-pointer transition">
                    <input 
                      type="checkbox" 
                      checked={selectedProductIds.includes(p.id)}
                      onChange={() => toggleProduct(p.id)}
                      className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500"
                    />
                    <span className="text-sm font-bold text-slate-700">{p.internalSku}</span>
                    <span className="text-sm text-slate-500">— {p.name} {p.unit ? `(${p.unit})` : ''}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Ghi chú</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú cho phiên kiểm kê này..."
              rows={2}
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-base outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 resize-none"
            />
          </div>

          {canRequest && (
            <div className="flex items-center gap-3">
              <input id="isRequest" type="checkbox" checked={isRequest} onChange={(e) => setIsRequest(e.target.checked)} className="w-4 h-4 text-cyan-600" />
              <label htmlFor="isRequest" className="text-sm font-medium text-slate-700">Tạo là yêu cầu kiểm kê (gửi từ phòng ban)</label>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSubmitSaveAndAdd}
              disabled={submitting}
              className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {submitting ? 'Đang lưu...' : 'Lưu và Thêm'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl px-5 py-3 text-sm font-bold text-white shadow-md transition hover:shadow-lg disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)' }}
            >
              {submitting ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
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
}: {
  stocktake: StocktakeItem;
  onClose: () => void;
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [products, setProducts] = React.useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = React.useState('');
  const [addingProduct, setAddingProduct] = React.useState(false);

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
      .catch(() => {});
  }, []);

  const canEdit = stocktake.status === 'DRAFT' || stocktake.status === 'COUNTING';
  const canFinish = stocktake.status === 'COUNTING';
  const canApproveReject = stocktake.status === 'COUNTING_DONE';

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
                className="rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:shadow-lg"
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
    </div>
  );
}
