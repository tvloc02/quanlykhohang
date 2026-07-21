import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Download,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { reportsApi } from './api/reportsApi';

const API_BASE = 'http://localhost:3000/api';
function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

type ReportOverview = {
  generatedAt: string;
  accessControl: { users: number; roles: number };
  partners: { suppliers: number; customers: number };
  catalog: { products: number; categories: number; barcodeMappedProducts: number };
  inventory: { totalPhysical: number; allocated: number; available: number; locations: number; lowStockItems: number };
  inbound: { totalReceipts: number; byStatus: Record<string, number>; openReceipts: number; completedReceipts: number };
  outbound: { totalOrders: number; byStatus: Record<string, number>; openOrders: number; completedOrders: number; openPickingTasks: number };
};

type TrendPoint = { label: string; inbound: number; outbound: number; available: number };

type AlertItem = {
  id: string;
  locationCode: string;
  available: number;
  allocated: number;
  severity: 'critical' | 'high' | 'medium';
  product: { id: string; name: string; internalSku: string; minimumStock: number; unit: string };
};

const fmtNum = (v: number) => new Intl.NumberFormat('vi-VN').format(v);

function KpiCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color || 'bg-cyan-50 text-cyan-600'}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-0.5 text-2xl font-black text-slate-900">{typeof value === 'number' ? fmtNum(value) : value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
    critical: { cls: 'bg-red-100 text-red-700 border-red-200', label: 'Hết hàng', icon: <XCircle size={12} /> },
    high: { cls: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Nguy cơ cao', icon: <AlertTriangle size={12} /> },
    medium: { cls: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Cảnh báo', icon: <AlertCircle size={12} /> },
  };
  const cfg = map[severity] || map.medium;
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-bold ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

export default function Reports() {
  const [overview, setOverview] = React.useState<ReportOverview | null>(null);
  const [trend, setTrend] = React.useState<TrendPoint[]>([]);
  const [alerts, setAlerts] = React.useState<AlertItem[]>([]);
  const [trendPeriod, setTrendPeriod] = React.useState<'week' | 'month'>('week');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewData, trendData, alertsData] = await Promise.all([
        reportsApi.getDashboard() as Promise<ReportOverview>,
        fetch(`${API_BASE}/reports/trend?period=${trendPeriod}`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API_BASE}/reports/alerts`, { headers: authHeaders() }).then(r => r.json()),
      ]);
      setOverview(overviewData);
      setTrend(Array.isArray(trendData) ? trendData : []);
      setAlerts(Array.isArray(alertsData) ? alertsData : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [trendPeriod]);

  React.useEffect(() => { loadAll(); }, [loadAll]);

  const updatedAt = overview
    ? new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(overview.generatedAt))
    : '--';

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900">📊 Báo cáo & Phân tích</h1>
          <p className="text-sm text-slate-500 mt-1">Cập nhật lúc: {updatedAt}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={loadAll}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
          <button className="flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-cyan-700 transition">
            <Download size={16} />
            Xuất báo cáo
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <KpiCard icon={<Package size={22} />} label="Tổng sản phẩm" value={overview?.catalog.products ?? 0} color="bg-cyan-50 text-cyan-600" />
        <KpiCard icon={<ArrowDownToLine size={22} />} label="Tồn khả dụng" value={overview?.inventory.available ?? 0} color="bg-emerald-50 text-emerald-600" />
        <KpiCard icon={<ArrowUpFromLine size={22} />} label="Tổng nhập kho" value={overview?.inbound.totalReceipts ?? 0} color="bg-indigo-50 text-indigo-600" />
        <KpiCard icon={<CheckCircle2 size={22} />} label="Đơn xuất kho" value={overview?.outbound.totalOrders ?? 0} color="bg-violet-50 text-violet-600" />
        <KpiCard icon={<AlertTriangle size={22} />} label="Sản phẩm sắp hết" value={overview?.inventory.lowStockItems ?? 0} color="bg-orange-50 text-orange-500" sub="Dưới mức tối thiểu" />
        <KpiCard icon={<TrendingUp size={22} />} label="Đang picking" value={overview?.outbound.openPickingTasks ?? 0} color="bg-yellow-50 text-yellow-600" />
        <KpiCard icon={<Package size={22} />} label="NCC hoạt động" value={overview?.partners.suppliers ?? 0} color="bg-pink-50 text-pink-600" />
        <KpiCard icon={<Package size={22} />} label="Khách hàng" value={overview?.partners.customers ?? 0} color="bg-teal-50 text-teal-600" />
      </div>

      {/* US 6.3 – Trend Chart */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-black text-slate-900">📈 Xu hướng Xuất – Nhập – Tồn kho</h2>
            <p className="text-sm text-slate-500 mt-1">Theo từng {trendPeriod === 'week' ? 'tuần' : 'tháng'}</p>
          </div>
          <div className="flex rounded-xl border border-slate-200 overflow-hidden text-sm font-semibold">
            {(['week', 'month'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setTrendPeriod(p)}
                className={`px-4 py-2 transition ${trendPeriod === p ? 'bg-cyan-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                {p === 'week' ? 'Tuần' : 'Tháng'}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="flex h-64 items-center justify-center text-slate-400">
            <RefreshCw size={24} className="animate-spin mr-2" /> Đang tải biểu đồ...
          </div>
        ) : trend.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorOutbound" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorAvailable" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
                formatter={(val: any, name: any) => [fmtNum(Number(val || 0)), String(name) === 'inbound' ? 'Nhập kho' : String(name) === 'outbound' ? 'Xuất kho' : 'Tồn khả dụng']}
              />
              <Legend formatter={(val) => val === 'inbound' ? 'Nhập kho' : val === 'outbound' ? 'Xuất kho' : 'Tồn khả dụng'} />
              <Area type="monotone" dataKey="available" stroke="#10b981" strokeWidth={2.5} fill="url(#colorAvailable)" dot={false} />
              <Area type="monotone" dataKey="inbound" stroke="#6366f1" strokeWidth={2} fill="url(#colorInbound)" dot={false} />
              <Area type="monotone" dataKey="outbound" stroke="#f59e0b" strokeWidth={2} fill="url(#colorOutbound)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-64 items-center justify-center text-slate-400 text-sm">Chưa có dữ liệu xu hướng</div>
        )}
      </div>

      {/* US 6.4 – Low Stock Alerts */}
      {alerts.length > 0 && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50/60 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <AlertTriangle size={22} className="text-orange-500" />
            <h2 className="text-lg font-black text-slate-900">🚨 Cảnh báo Tồn kho Thấp</h2>
            <span className="ml-auto rounded-full bg-orange-500 px-2.5 py-0.5 text-xs font-bold text-white">{alerts.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-orange-200 text-left">
                  <th className="py-2 pr-4 font-bold text-slate-600">Sản phẩm</th>
                  <th className="py-2 pr-4 font-bold text-slate-600">SKU</th>
                  <th className="py-2 pr-4 font-bold text-slate-600">Vị trí</th>
                  <th className="py-2 pr-4 text-center font-bold text-slate-600">Khả dụng</th>
                  <th className="py-2 pr-4 text-center font-bold text-slate-600">Tối thiểu</th>
                  <th className="py-2 font-bold text-slate-600">Mức độ</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.id} className="border-b border-orange-100 hover:bg-orange-50 transition">
                    <td className="py-2 pr-4 font-medium text-slate-800">{a.product.name}</td>
                    <td className="py-2 pr-4 font-mono text-slate-500">{a.product.internalSku}</td>
                    <td className="py-2 pr-4 text-slate-600">{a.locationCode}</td>
                    <td className="py-2 pr-4 text-center font-bold text-red-600">{fmtNum(a.available)}</td>
                    <td className="py-2 pr-4 text-center text-slate-600">{fmtNum(a.product.minimumStock)}</td>
                    <td className="py-2"><SeverityBadge severity={a.severity} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Status by status grids */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-black text-slate-900 mb-4">📥 Trạng thái Nhập kho</h2>
          {overview ? (
            <div className="space-y-2">
              {Object.entries(overview.inbound.byStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5">
                  <span className="font-medium text-slate-700">{status}</span>
                  <span className="font-bold text-slate-900">{fmtNum(count)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-400 text-sm">Đang tải...</div>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-black text-slate-900 mb-4">📤 Trạng thái Xuất kho</h2>
          {overview ? (
            <div className="space-y-2">
              {Object.entries(overview.outbound.byStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5">
                  <span className="font-medium text-slate-700">{status}</span>
                  <span className="font-bold text-slate-900">{fmtNum(count)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-400 text-sm">Đang tải...</div>
          )}
        </div>
      </div>
    </div>
  );
}
