import React from 'react';
import {
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Zap,
  AlertTriangle,
  Search,
  HelpCircle,
  X,
  Server,
  ShieldCheck,
  Check,
} from 'lucide-react';
import Toast from '../../../shared/components/Toast';

const API_BASE = 'http://localhost:3000/api';
function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

type OutboxEvent = {
  id: string;
  eventType: string;
  status: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';
  retryCount: number;
  lastError?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
  payloadSummary: string;
};

type ApiResponse = {
  total: number;
  page: number;
  pageSize: number;
  items: OutboxEvent[];
  summary: { pending: number; processing: number; sent: number; failed: number };
};

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  PENDING: { label: 'Chờ gửi', cls: 'bg-amber-50 text-amber-700 border-amber-300', icon: <Clock size={13} /> },
  PROCESSING: { label: 'Đang gửi', cls: 'bg-cyan-50 text-cyan-700 border-cyan-300', icon: <Loader2 size={13} className="animate-spin" /> },
  SENT: { label: 'Đã gửi', cls: 'bg-emerald-50 text-emerald-700 border-emerald-300', icon: <CheckCircle2 size={13} /> },
  FAILED: { label: 'Thất bại', cls: 'bg-red-50 text-red-700 border-red-300', icon: <XCircle size={13} /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-bold ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

export default function ErpSyncStatusPage() {
  const [data, setData] = React.useState<ApiResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [retrying, setRetrying] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [showGuideModal, setShowGuideModal] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`${API_BASE}/erp/events?${params}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Không tải được danh sách sự kiện ERP');
      setData(await res.json());
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter]);

  React.useEffect(() => { load(); }, [load]);

  const handleRetry = async (id: string) => {
    setRetrying(id);
    try {
      const res = await fetch(`${API_BASE}/erp/events/${id}/retry`, { method: 'POST', headers: authHeaders() });
      if (!res.ok) throw new Error('Retry thất bại');
      setSuccess(`Đã đặt lại Event #${id} về trạng thái PENDING thành công.`);
      await load();
    } catch (e: any) {
      setError(e.message || 'Lỗi khi thử lại sự kiện');
    } finally {
      setRetrying(null);
    }
  };

  const s = data?.summary;

  const filteredItems = React.useMemo(() => {
    if (!data?.items) return [];
    if (!search.trim()) return data.items;
    const query = search.toLowerCase();
    return data.items.filter(
      (ev) =>
        ev.id.toLowerCase().includes(query) ||
        ev.eventType.toLowerCase().includes(query) ||
        (ev.lastError && ev.lastError.toLowerCase().includes(query))
    );
  }, [data?.items, search]);

  const totalItems = data?.total || 0;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, totalItems);

  return (
    <div>
      <Toast
        message={error || success}
        type={error ? 'error' : 'success'}
        onClose={() => {
          setError('');
          setSuccess('');
        }}
      />

      {/* Header Banner với Tiêu đề Pill Button chuẩn mẫu Suppliers */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-md">
            <Zap className="h-5 w-5 text-cyan-100" />
            <h1 className="text-lg font-bold tracking-tight text-white">Giám sát Đồng bộ ERP</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-500 bg-white px-4 py-2.5 text-sm font-bold text-cyan-700 shadow-sm transition hover:bg-cyan-50 cursor-pointer"
          >
            <HelpCircle className="h-4 w-4" />
            Xem hướng dẫn
          </button>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới dữ liệu
          </button>
        </div>
      </div>

      {/* 4 Nút Tổng Hợp (Giống hệt giao diện Suppliers) */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">{(s?.pending || 0).toLocaleString('vi-VN')} SỰ KIỆN CHỜ GỬI</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">{(s?.processing || 0).toLocaleString('vi-VN')} SỰ KIỆN ĐANG GỬI</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">{(s?.sent || 0).toLocaleString('vi-VN')} SỰ KIỆN ĐÃ GỬI</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">{(s?.failed || 0).toLocaleString('vi-VN')} SỰ KIỆN THẤT BẠI</p>
        </div>
      </div>

      {/* Thanh Tìm Kiếm & Lọc Trạng Thái (Giống hệt Suppliers) */}
      <div className="mt-5 rounded-xl border-2 border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_0.7fr]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500" />
            <input
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
              placeholder="Tìm theo mã ID, tên sự kiện (Event Type), thông báo lỗi..."
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="h-11 rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-semibold text-cyan-700 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 cursor-pointer"
          >
            <option value="">Trạng thái: Tất cả</option>
            <option value="PENDING">Trạng thái: Chờ gửi</option>
            <option value="PROCESSING">Trạng thái: Đang gửi</option>
            <option value="SENT">Trạng thái: Đã gửi</option>
            <option value="FAILED">Trạng thái: Thất bại</option>
          </select>
        </div>
      </div>

      {/* Bảng Sự Kiện ERP (Chuẩn định dạng Bảng Suppliers) */}
      <div className="mt-5 overflow-hidden rounded-xl border-2 border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse bg-white">
            <thead className="bg-cyan-50">
              <tr className="border-b-2 border-slate-200">
                <th className="w-16 border-x border-slate-200 px-3 py-4 text-center text-sm font-bold uppercase text-slate-800">STT</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-bold uppercase text-slate-800">Mã sự kiện</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-bold uppercase text-slate-800">Loại sự kiện</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-bold uppercase text-slate-800">Số lần thử</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-bold uppercase text-slate-800">Lỗi gần nhất</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-bold uppercase text-slate-800">Thời gian tạo</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-bold uppercase text-slate-800">Trạng thái</th>
                <th className="sticky right-0 w-36 border-l border-slate-200 bg-cyan-50 px-3 py-4 text-center text-sm font-bold uppercase text-slate-800 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm font-semibold text-slate-500">
                    <Loader2 className="inline animate-spin mr-2 text-cyan-600" size={18} />
                    Đang tải dữ liệu sự kiện ERP...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm font-semibold text-slate-500">
                    Chưa có sự kiện ERP nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredItems.map((ev, index) => (
                  <tr key={ev.id} className="group border-b border-slate-200 transition hover:bg-cyan-50/50">
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">
                      {startIndex + index}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center font-mono text-xs font-bold text-slate-700">
                      #{ev.id}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-800">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-800">
                        <Zap size={13} className="text-cyan-600" />
                        {ev.eventType}
                      </span>
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg font-bold text-xs ${ev.retryCount > 0 ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-500'}`}>
                        {ev.retryCount}
                      </span>
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center max-w-[260px] truncate text-xs font-semibold text-red-600" title={ev.lastError}>
                      {ev.lastError || <span className="text-slate-400 font-normal">–</span>}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-xs font-semibold text-slate-700">
                      {new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(ev.createdAt))}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                      <StatusBadge status={ev.status} />
                    </td>
                    <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-4 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                      <div className="flex items-center justify-center">
                        {ev.status === 'FAILED' ? (
                          <button
                            type="button"
                            onClick={() => handleRetry(ev.id)}
                            disabled={retrying === ev.id}
                            title="Thử lại sự kiện"
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-cyan-500 bg-cyan-600 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-50 cursor-pointer"
                          >
                            {retrying === ev.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                            Retry
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400">–</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Thanh Phân Trang */}
        {!loading && totalItems > 0 && (
          <div className="flex flex-col items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-3 sm:flex-row">
            <div className="text-sm text-slate-600">
              Tổng số: <b>{totalItems}</b> <span className="ml-2">Hiển thị {startIndex} - {endIndex}</span>
            </div>
            <div className="mt-4 flex items-center gap-2 sm:mt-0">
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 cursor-pointer"
              >
                <option value={5}>5</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>

              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setPage(1)} disabled={page === 1} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 cursor-pointer">«</button>
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 cursor-pointer">‹</button>
                <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-sm font-bold text-white">{page}</button>
                <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 cursor-pointer">›</button>
                <button type="button" onClick={() => setPage(totalPages)} disabled={page === totalPages} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 cursor-pointer">»</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Popup Xem Hướng Dẫn */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm transition-all">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600">
                  <Server className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">Hướng dẫn Giám sát Đồng bộ ERP</h2>
                  <p className="text-sm font-medium text-slate-500">
                    Cơ chế Outbox Pattern và quy trình xử lý sự kiện đồng bộ tự động.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(90vh-140px)] overflow-y-auto px-6 py-5 space-y-4">
              <div className="flex items-start gap-3.5 rounded-xl border-2 border-cyan-100 bg-cyan-50/60 p-4">
                <Clock className="h-5 w-5 text-cyan-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Cron Job tự động quét dữ liệu</h4>
                  <p className="text-xs font-semibold text-slate-600 mt-1">
                    Tiến trình ERP Sync Worker chạy ngầm theo chu kỳ <strong>30 giây</strong> một lần để kiểm tra và gửi các sự kiện ở trạng thái PENDING đến hệ thống ERP bên ngoài.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 rounded-xl border-2 border-amber-100 bg-amber-50/60 p-4">
                <RotateCcw className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Cơ chế Thử lại (Retry Mechanism)</h4>
                  <p className="text-xs font-semibold text-slate-600 mt-1">
                    Nếu xảy ra lỗi mạng hoặc ERP bị gián đoạn, hệ thống sẽ tự động thử lại tối đa <strong>3 lần</strong>. Sau 3 lần thất bại, sự kiện được chuyển sang trạng thái FAILED.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 rounded-xl border-2 border-emerald-100 bg-emerald-50/60 p-4">
                <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Bảo vệ tính toàn vẹn (Idempotency Key)</h4>
                  <p className="text-xs font-semibold text-slate-600 mt-1">
                    Mỗi sự kiện được cấp một khóa định danh duy nhất (Idempotency Key) nhằm đảm bảo ERP không bao giờ xử lý lặp lại cùng một giao dịch.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 rounded-xl border-2 border-cyan-100 bg-cyan-50/60 p-4">
                <Zap className="h-5 w-5 text-cyan-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Xử lý thủ công sự kiện lỗi</h4>
                  <p className="text-xs font-semibold text-slate-600 mt-1">
                    Quản trị viên có thể bấm trực tiếp nút <strong>Retry</strong> trên các hàng có trạng thái FAILED để đưa sự kiện về trạng thái PENDING và chờ tiến trình kế tiếp gửi lại.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm transition hover:bg-cyan-700 cursor-pointer"
              >
                <Check className="h-4 w-4" />
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
