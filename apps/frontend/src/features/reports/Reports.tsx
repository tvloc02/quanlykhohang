import React from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import {
  BarChart3,
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
  Printer,
  Calendar,
  Layers,
  Users,
  Building2,
  Boxes,
  ShieldCheck,
  Search,
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

const fmtNum = (v: number) => new Intl.NumberFormat('vi-VN').format(v || 0);

function translateStatus(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Nháp',
    CREATED: 'Khởi tạo',
    APPROVED: 'Đã duyệt',
    SUPPLIER_APPROVED: 'NCC chấp nhận',
    IN_PROGRESS: 'Đang xử lý',
    PARTIALLY_RECEIVED: 'Nhận một phần',
    RECEIVED: 'Đã nhận hàng',
    COMPLETED: 'Hoàn thành',
    CANCELLED: 'Đã hủy',
    REJECTED: 'Từ chối',
    PENDING: 'Chờ xử lý',
    ASSIGNED: 'Đã giao việc',
    PICKING: 'Đang lấy hàng',
    SHIPPED: 'Đã giao vận',
  };
  return map[status.toUpperCase()] || status;
}

function getStatusBadgeClass(status: string): string {
  switch (status.toUpperCase()) {
    case 'COMPLETED':
    case 'RECEIVED':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    case 'IN_PROGRESS':
    case 'ASSIGNED':
    case 'PICKING':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'CREATED':
    case 'APPROVED':
    case 'SUPPLIER_APPROVED':
      return 'bg-cyan-100 text-cyan-800 border-cyan-300';
    case 'CANCELLED':
    case 'REJECTED':
      return 'bg-rose-100 text-rose-800 border-rose-300';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-300';
  }
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  colorClass,
  borderColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  colorClass: string;
  borderColor?: string;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border-2 ${
        borderColor || 'border-slate-200'
      } bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-cyan-500 hover:shadow-lg`}
    >
      <div className="flex items-center justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${colorClass} shadow-inner`}>
          {icon}
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          Realtime
        </span>
      </div>

      <div className="mt-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
        <h3 className="mt-1 text-2xl font-black text-slate-900 tracking-tight">
          {typeof value === 'number' ? fmtNum(value) : value}
        </h3>
        {sub && <p className="mt-1 text-xs font-medium text-slate-500">{sub}</p>}
      </div>

      <div className="absolute -bottom-6 -right-6 h-20 w-20 rounded-full bg-cyan-500/5 transition-all group-hover:scale-150" />
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
    critical: { cls: 'bg-red-100 text-red-700 border-red-300', label: 'Hết hàng nghiêm trọng', icon: <XCircle size={13} /> },
    high: { cls: 'bg-orange-100 text-orange-700 border-orange-300', label: 'Cận mức tối thiểu', icon: <AlertTriangle size={13} /> },
    medium: { cls: 'bg-amber-100 text-amber-700 border-amber-300', label: 'Cần chú ý', icon: <AlertCircle size={13} /> },
  };
  const cfg = map[severity] || map.medium;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-bold ${cfg.cls}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

export default function Reports() {
  const [overview, setOverview] = React.useState<ReportOverview | null>(null);
  const [trend, setTrend] = React.useState<TrendPoint[]>([]);
  const [alerts, setAlerts] = React.useState<AlertItem[]>([]);
  const [trendPeriod, setTrendPeriod] = React.useState<'week' | 'month'>('week');
  const [activeTab, setActiveTab] = React.useState<'overview' | 'inbound' | 'outbound' | 'alerts'>('overview');
  const [alertSearch, setAlertSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewData, trendData, alertsData] = await Promise.all([
        reportsApi.getDashboard() as Promise<ReportOverview>,
        fetch(`${API_BASE}/reports/trend?period=${trendPeriod}`, { headers: authHeaders() }).then((r) => r.json()),
        fetch(`${API_BASE}/reports/alerts`, { headers: authHeaders() }).then((r) => r.json()),
      ]);
      setOverview(overviewData);
      setTrend(Array.isArray(trendData) ? trendData : []);
      setAlerts(Array.isArray(alertsData) ? alertsData : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu báo cáo');
    } finally {
      setLoading(false);
    }
  }, [trendPeriod]);

  React.useEffect(() => {
    loadAll();
  }, [loadAll]);

  const updatedAt = overview
    ? new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(overview.generatedAt))
    : '--';

  const filteredAlerts = React.useMemo(() => {
    if (!alertSearch.trim()) return alerts;
    const q = alertSearch.toLowerCase();
    return alerts.filter(
      (a) =>
        a.product.name.toLowerCase().includes(q) ||
        a.product.internalSku.toLowerCase().includes(q) ||
        a.locationCode.toLowerCase().includes(q)
    );
  }, [alerts, alertSearch]);

  // Convert status dictionaries to chart data
  const inboundStatusData = React.useMemo(() => {
    if (!overview?.inbound.byStatus) return [];
    return Object.entries(overview.inbound.byStatus).map(([status, count]) => ({
      status: translateStatus(status),
      rawStatus: status,
      count,
    }));
  }, [overview]);

  const outboundStatusData = React.useMemo(() => {
    if (!overview?.outbound.byStatus) return [];
    return Object.entries(overview.outbound.byStatus).map(([status, count]) => ({
      status: translateStatus(status),
      rawStatus: status,
      count,
    }));
  }, [overview]);

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER SECTION - CYAN DESIGN SYSTEM */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-md">
            <BarChart3 className="h-5 w-5 text-cyan-100" />
            <h1 className="text-lg font-bold tracking-tight text-white">Báo Cáo & Phân Tích Kho Hàng</h1>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Hệ thống giám sát chỉ số kho hàng thời gian thực • Cập nhật gần nhất: <span className="font-bold text-slate-700">{updatedAt}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={loadAll}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-cyan-600' : 'text-slate-600'} />
            Làm mới dữ liệu
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700 cursor-pointer active:scale-95"
          >
            <Printer size={16} />
            In báo cáo
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700 shadow-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* NAVIGATION TABS & FILTER BAR */}
      <div className="flex flex-col gap-4 rounded-2xl border-2 border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'overview', label: 'Tổng Quan Hệ Thống', icon: <Boxes className="h-4 w-4" /> },
            { id: 'inbound', label: 'Báo Cáo Nhập Kho', icon: <ArrowDownToLine className="h-4 w-4" /> },
            { id: 'outbound', label: 'Báo Cáo Xuất Kho', icon: <ArrowUpFromLine className="h-4 w-4" /> },
            {
              id: 'alerts',
              label: `Cảnh Báo Tồn Kho (${alerts.length})`,
              icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* TIME PERIOD SELECTOR */}
        <div className="flex items-center gap-2 border-t border-slate-100 pt-2 sm:border-t-0 sm:pt-0">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Kỳ báo cáo:</span>
          <div className="inline-flex rounded-xl border-2 border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setTrendPeriod('week')}
              className={`rounded-lg px-3 py-1 text-xs font-black transition cursor-pointer ${
                trendPeriod === 'week' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
              }`}
            >
              Theo Tuần
            </button>
            <button
              type="button"
              onClick={() => setTrendPeriod('month')}
              className={`rounded-lg px-3 py-1 text-xs font-black transition cursor-pointer ${
                trendPeriod === 'month' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
              }`}
            >
              Theo Tháng
            </button>
          </div>
        </div>
      </div>

      {/* KPI METRICS GRID */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Package className="h-6 w-6 text-cyan-600" />}
          label="Tổng Sản Phẩm"
          value={overview?.catalog.products ?? 0}
          sub={`${overview?.catalog.barcodeMappedProducts ?? 0} sản phẩm đã gán mã vạch`}
          colorClass="bg-cyan-50 text-cyan-600"
          borderColor="border-cyan-500"
        />
        <KpiCard
          icon={<ArrowDownToLine className="h-6 w-6 text-emerald-600" />}
          label="Tồn Kho Khả Dụng"
          value={overview?.inventory.available ?? 0}
          sub={`Thực tế: ${fmtNum(overview?.inventory.totalPhysical ?? 0)} | Tạm giữ: ${fmtNum(overview?.inventory.allocated ?? 0)}`}
          colorClass="bg-emerald-50 text-emerald-600"
          borderColor="border-emerald-500"
        />
        <KpiCard
          icon={<ArrowUpFromLine className="h-6 w-6 text-indigo-600" />}
          label="Tổng Lệnh Nhập Kho"
          value={overview?.inbound.totalReceipts ?? 0}
          sub={`Đã hoàn thành: ${fmtNum(overview?.inbound.completedReceipts ?? 0)} phiếu`}
          colorClass="bg-indigo-50 text-indigo-600"
          borderColor="border-indigo-500"
        />
        <KpiCard
          icon={<CheckCircle2 className="h-6 w-6 text-violet-600" />}
          label="Tổng Đơn Xuất Kho"
          value={overview?.outbound.totalOrders ?? 0}
          sub={`Đang lấy hàng: ${fmtNum(overview?.outbound.openPickingTasks ?? 0)} nhiệm vụ`}
          colorClass="bg-violet-50 text-violet-600"
          borderColor="border-violet-500"
        />
      </div>

      {/* TAB CONTENT 1: OVERVIEW & TREND CHARTS */}
      {(activeTab === 'overview' || activeTab === 'inbound' || activeTab === 'outbound') && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* MAIN TREND AREA CHART (2 COLS) */}
          <div className="lg:col-span-2 rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-cyan-600" />
                  Biểu Đồ Xu Hướng Xuất – Nhập – Tồn Kho
                </h2>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                  Biến động số lượng sản phẩm giao dịch theo {trendPeriod === 'week' ? 'các tuần trong tháng' : 'các tháng trong năm'}
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <span className="h-3 w-3 rounded-full bg-emerald-500" /> Tồn khả dụng
                </span>
                <span className="flex items-center gap-1.5 text-indigo-600">
                  <span className="h-3 w-3 rounded-full bg-indigo-500" /> Nhập kho
                </span>
                <span className="flex items-center gap-1.5 text-amber-600">
                  <span className="h-3 w-3 rounded-full bg-amber-500" /> Xuất kho
                </span>
              </div>
            </div>

            {loading ? (
              <div className="flex h-72 items-center justify-center text-slate-400 font-bold">
                <RefreshCw size={24} className="animate-spin mr-3 text-cyan-600" /> Đang tổng hợp dữ liệu biểu đồ...
              </div>
            ) : trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAvailable" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorOutbound" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 16,
                      border: '2px solid #0891b2',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                      fontWeight: 'bold',
                    }}
                    formatter={(val: any, name: any) => [
                      fmtNum(Number(val || 0)),
                      String(name) === 'available' ? 'Tồn khả dụng' : String(name) === 'inbound' ? 'Nhập kho' : 'Xuất kho',
                    ]}
                  />
                  <Area type="monotone" dataKey="available" stroke="#10b981" strokeWidth={3} fill="url(#colorAvailable)" dot={{ r: 4, fill: '#10b981' }} />
                  <Area type="monotone" dataKey="inbound" stroke="#6366f1" strokeWidth={3} fill="url(#colorInbound)" dot={{ r: 4, fill: '#6366f1' }} />
                  <Area type="monotone" dataKey="outbound" stroke="#f59e0b" strokeWidth={3} fill="url(#colorOutbound)" dot={{ r: 4, fill: '#f59e0b' }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-72 items-center justify-center text-slate-400 text-sm font-bold">
                Chưa có dữ liệu xu hướng trong kỳ này
              </div>
            )}
          </div>

          {/* SECONDARY SIDE SUMMARY CARDS */}
          <div className="space-y-6">
            {/* PARTNERS & INFRASTRUCTURE */}
            <div className="rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2 mb-4">
                <Building2 className="h-5 w-5 text-indigo-600" />
                Đối Tác & Hạ Tầng Kho
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-indigo-100 p-2 text-indigo-600">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500">Nhà cung cấp</p>
                      <p className="text-sm font-black text-slate-900">{overview?.partners.suppliers ?? 0} đối tác</p>
                    </div>
                  </div>
                  <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">Đang hoạt động</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-teal-100 p-2 text-teal-600">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500">Khách hàng mua</p>
                      <p className="text-sm font-black text-slate-900">{overview?.partners.customers ?? 0} khách hàng</p>
                    </div>
                  </div>
                  <span className="rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700">Đơn hàng</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-cyan-100 p-2 text-cyan-600">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500">Vị trí lưu kho</p>
                      <p className="text-sm font-black text-slate-900">{overview?.inventory.locations ?? 0} khu vực</p>
                    </div>
                  </div>
                  <span className="rounded-lg bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-700">Đã thiết lập</span>
                </div>
              </div>
            </div>

            {/* SECURITY & ACCESS CONTROL */}
            <div className="rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2 mb-4">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                Quyền Hạn & Nhân Sự
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 text-center">
                  <p className="text-xs font-bold text-emerald-700">Tài khoản nhân viên</p>
                  <p className="text-2xl font-black text-emerald-900 mt-1">{overview?.accessControl.users ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-cyan-100 bg-cyan-50/50 p-4 text-center">
                  <p className="text-xs font-bold text-cyan-700">Vai trò phân quyền</p>
                  <p className="text-2xl font-black text-cyan-900 mt-1">{overview?.accessControl.roles ?? 0}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATUS BREAKDOWN CHARTS FOR INBOUND & OUTBOUND */}
      {(activeTab === 'overview' || activeTab === 'inbound' || activeTab === 'outbound') && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* INBOUND STATUS CHART */}
          <div className="rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <ArrowDownToLine className="h-5 w-5 text-indigo-600" />
                  Cơ Cấu Trạng Thái Nhập Kho
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">Phân bổ các lệnh nhập hàng theo giai đoạn xử lý</p>
              </div>
              <span className="rounded-xl bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                Tổng: {overview?.inbound.totalReceipts ?? 0}
              </span>
            </div>

            {inboundStatusData.length > 0 ? (
              <div className="space-y-3">
                {inboundStatusData.map((item) => {
                  const percentage = overview?.inbound.totalReceipts
                    ? Math.round((item.count / overview.inbound.totalReceipts) * 100)
                    : 0;
                  return (
                    <div key={item.rawStatus} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className={`px-2 py-0.5 rounded-md border ${getStatusBadgeClass(item.rawStatus)}`}>
                          {item.status} ({item.rawStatus})
                        </span>
                        <span className="text-slate-900 font-black">
                          {fmtNum(item.count)} lệnh ({percentage}%)
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-sm font-bold text-slate-400">Chưa có dữ liệu trạng thái nhập kho</div>
            )}
          </div>

          {/* OUTBOUND STATUS CHART */}
          <div className="rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <ArrowUpFromLine className="h-5 w-5 text-amber-600" />
                  Cơ Cấu Trạng Thái Xuất Kho
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">Phân bổ các đơn xuất kho theo giai đoạn xử lý</p>
              </div>
              <span className="rounded-xl bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                Tổng: {overview?.outbound.totalOrders ?? 0}
              </span>
            </div>

            {outboundStatusData.length > 0 ? (
              <div className="space-y-3">
                {outboundStatusData.map((item) => {
                  const percentage = overview?.outbound.totalOrders
                    ? Math.round((item.count / overview.outbound.totalOrders) * 100)
                    : 0;
                  return (
                    <div key={item.rawStatus} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className={`px-2 py-0.5 rounded-md border ${getStatusBadgeClass(item.rawStatus)}`}>
                          {item.status} ({item.rawStatus})
                        </span>
                        <span className="text-slate-900 font-black">
                          {fmtNum(item.count)} đơn ({percentage}%)
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-sm font-bold text-slate-400">Chưa có dữ liệu trạng thái xuất kho</div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: LOW STOCK ALERTS PANEL */}
      {(activeTab === 'overview' || activeTab === 'alerts') && (
        <div className="rounded-3xl border-2 border-amber-400 bg-amber-50/40 p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5 border-b border-amber-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-amber-500 p-2.5 text-white shadow-md">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">Danh Sách Cảnh Báo Tồn Kho Thấp</h2>
                <p className="text-xs font-semibold text-slate-600 mt-0.5">
                  Các mặt hàng có số lượng tồn khả dụng chạm ngưỡng hoặc dưới định mức tối thiểu
                </p>
              </div>
            </div>

            {/* Search Input in Alert Table */}
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm tên sản phẩm, SKU hoặc vị trí..."
                value={alertSearch}
                onChange={(e) => setAlertSearch(e.target.value)}
                className="h-10 w-full rounded-xl border-2 border-amber-200 bg-white pl-9 pr-4 text-xs font-bold text-slate-700 outline-none transition focus:border-cyan-500 sm:w-72"
              />
            </div>
          </div>

          {filteredAlerts.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border-2 border-amber-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-amber-200 bg-amber-100/50 uppercase text-slate-700 text-xs font-black">
                      <th className="py-3 px-4 text-left">Sản Phẩm</th>
                      <th className="py-3 px-4 text-center">Mã SKU</th>
                      <th className="py-3 px-4 text-center">Vị Trí Lưu Kho</th>
                      <th className="py-3 px-4 text-right">Tồn Khả Dụng</th>
                      <th className="py-3 px-4 text-right">Ngưỡng Tối Thiểu</th>
                      <th className="py-3 px-4 text-center">Mức Độ Cảnh Báo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {filteredAlerts.map((a) => (
                      <tr key={a.id} className="hover:bg-amber-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">{a.product.name}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-600">{a.product.internalSku}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                            {a.locationCode}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-red-600 text-base">{fmtNum(a.available)}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-700">
                          {fmtNum(a.product.minimumStock)} {a.product.unit || 'Cái'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <SeverityBadge severity={a.severity} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-white py-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-base font-bold text-slate-800">Không có cảnh báo tồn kho thấp</p>
              <p className="text-xs font-medium text-slate-500 mt-1">Tất cả các sản phẩm đều đạt số lượng tồn kho an toàn.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
