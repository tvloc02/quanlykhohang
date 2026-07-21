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
} from 'lucide-react';

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
  PENDING: { label: 'Chờ gửi', cls: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <Clock size={12} /> },
  PROCESSING: { label: 'Đang gửi', cls: 'bg-blue-100 text-blue-700 border-blue-200', icon: <Loader2 size={12} className="animate-spin" /> },
  SENT: { label: 'Đã gửi', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <CheckCircle2 size={12} /> },
  FAILED: { label: 'Thất bại', cls: 'bg-red-100 text-red-700 border-red-200', icon: <XCircle size={12} /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-bold ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border p-5 ${color}`}>
      <div className="text-2xl">{icon}</div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
        <p className="text-2xl font-black">{value}</p>
      </div>
    </div>
  );
}

export default function ErpSyncStatusPage() {
  const [data, setData] = React.useState<ApiResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [retrying, setRetrying] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [error, setError] = React.useState('');
  const [successMsg, setSuccessMsg] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`${API_BASE}/erp/events?${params}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Không tải được danh sách sự kiện ERP');
      setData(await res.json());
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  React.useEffect(() => { load(); }, [load]);

  const handleRetry = async (id: string) => {
    setRetrying(id);
    try {
      const res = await fetch(`${API_BASE}/erp/events/${id}/retry`, { method: 'POST', headers: authHeaders() });
      if (!res.ok) throw new Error('Retry thất bại');
      setSuccessMsg(`Đã đặt lại Event #${id} về PENDING`);
      setTimeout(() => setSuccessMsg(''), 3000);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRetrying(null);
    }
  };

  const s = data?.summary;

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Zap className="text-violet-500" size={30} />
            Giám sát Đồng bộ ERP
          </h1>
          <p className="text-sm text-slate-500 mt-1">Outbox Pattern – Trạng thái gửi sự kiện đến hệ thống ERP bên ngoài</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      {/* Toast */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Summary Cards */}
      {s && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard icon={<Clock size={22} className="text-yellow-600" />} label="Chờ gửi" value={s.pending} color="bg-yellow-50 border-yellow-200 text-yellow-900" />
          <SummaryCard icon={<Loader2 size={22} className="text-blue-600 animate-spin" />} label="Đang gửi" value={s.processing} color="bg-blue-50 border-blue-200 text-blue-900" />
          <SummaryCard icon={<CheckCircle2 size={22} className="text-emerald-600" />} label="Đã gửi" value={s.sent} color="bg-emerald-50 border-emerald-200 text-emerald-900" />
          <SummaryCard icon={<XCircle size={22} className="text-red-600" />} label="Thất bại" value={s.failed} color="bg-red-50 border-red-200 text-red-900" />
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-3 flex-wrap">
        {['', 'PENDING', 'PROCESSING', 'SENT', 'FAILED'].map((f) => (
          <button
            key={f}
            onClick={() => { setStatusFilter(f); setPage(1); }}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${statusFilter === f ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
          >
            {f || 'Tất cả'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-slate-600">ID</th>
                <th className="px-4 py-3 text-left font-bold text-slate-600">Event Type</th>
                <th className="px-4 py-3 text-left font-bold text-slate-600">Trạng thái</th>
                <th className="px-4 py-3 text-center font-bold text-slate-600">Retry</th>
                <th className="px-4 py-3 text-left font-bold text-slate-600">Lỗi cuối</th>
                <th className="px-4 py-3 text-left font-bold text-slate-600">Thời gian tạo</th>
                <th className="px-4 py-3 text-center font-bold text-slate-600">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <Loader2 className="inline animate-spin mr-2" size={18} />Đang tải...
                  </td>
                </tr>
              ) : !data?.items.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-sm">
                    Chưa có sự kiện nào.
                    {s && s.pending === 0 && s.failed === 0 && ' Tất cả đã được đồng bộ thành công! ✅'}
                  </td>
                </tr>
              ) : (
                data.items.map((ev) => (
                  <tr key={ev.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">#{ev.id}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-lg bg-violet-100 text-violet-700 px-2 py-0.5 text-xs font-bold">{ev.eventType}</span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={ev.status} /></td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-bold ${ev.retryCount > 0 ? 'text-orange-600' : 'text-slate-400'}`}>{ev.retryCount}</span>
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate text-xs text-slate-500" title={ev.lastError}>
                      {ev.lastError || '–'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(ev.createdAt))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {ev.status === 'FAILED' && (
                        <button
                          onClick={() => handleRetry(ev.id)}
                          disabled={retrying === ev.id}
                          title="Retry"
                          className="flex items-center gap-1 mx-auto rounded-lg bg-orange-100 text-orange-600 hover:bg-orange-200 px-3 py-1.5 text-xs font-bold transition disabled:opacity-50"
                        >
                          {retrying === ev.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total > data.pageSize && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <span className="text-xs text-slate-500">
              Hiển thị {(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} / {data.total} sự kiện
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1}
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
              >
                ← Trước
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * data.pageSize >= data.total}
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
              >
                Sau →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Worker Info */}
      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 text-sm">
        <h3 className="font-black text-violet-900 mb-2 flex items-center gap-2">
          <Zap size={16} className="text-violet-500" />
          Thông tin ERP Sync Worker
        </h3>
        <ul className="space-y-1 text-violet-700 text-xs">
          <li>⏱️ Cron job tự động chạy <strong>mỗi 30 giây</strong> để dispatch sự kiện PENDING.</li>
          <li>🔄 Tối đa <strong>3 lần retry</strong> trước khi đánh dấu FAILED.</li>
          <li>🔑 Idempotency Key đảm bảo không gửi trùng sự kiện.</li>
          <li>🛠️ Bạn có thể <strong>Retry thủ công</strong> các sự kiện FAILED từ bảng trên.</li>
        </ul>
      </div>
    </div>
  );
}
