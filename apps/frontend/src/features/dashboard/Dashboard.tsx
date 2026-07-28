import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Layers,
  Lock,
  PackageCheck,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';

type DashboardOverview = {
  generatedAt: string;
  accessControl: {
    users: number;
    roles: number;
  };
  partners: {
    suppliers: number;
    customers: number;
  };
  catalog: {
    products: number;
    categories: number;
    barcodeMappedProducts: number;
  };
  inventory: {
    totalPhysical: number;
    allocated: number;
    available: number;
    locations: number;
    lowStockItems: number;
  };
  inbound: {
    totalReceipts: number;
    byStatus: Record<string, number>;
    openReceipts: number;
    completedReceipts: number;
  };
  outbound: {
    totalOrders: number;
    byStatus: Record<string, number>;
    openOrders: number;
    completedOrders: number;
    openPickingTasks: number;
  };
};

const formatter = new Intl.NumberFormat('vi-VN');

function formatNumber(value: number) {
  return formatter.format(value);
}

function getUserLabel() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.fullName || user.email || 'Quản trị viên';
  } catch {
    return 'Quản trị viên';
  }
}

function getUserRole() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (Array.isArray(user.roles) && user.roles.length > 0) {
      return user.roles[0].name || 'Administrator';
    }
    return 'Quản trị hệ thống';
  } catch {
    return 'Quản trị hệ thống';
  }
}

export default function Dashboard() {
  const [overview, setOverview] = React.useState<DashboardOverview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const loadDashboard = React.useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:3000/api/reports/dashboard', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || 'Không tải được dữ liệu dashboard');
      }

      const data = (await response.json()) as DashboardOverview;
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const updatedAt = overview
    ? new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(overview.generatedAt))
    : '--';

  const totalFlow = overview ? overview.inbound.totalReceipts + overview.outbound.totalOrders : 0;
  const completedFlow = overview ? overview.inbound.completedReceipts + overview.outbound.completedOrders : 0;
  const completionRate = totalFlow > 0 ? Math.round((completedFlow / totalFlow) * 100) : 0;

  // Inventory usage breakdown
  const totalPhys = overview?.inventory.totalPhysical || 1;
  const availablePct = overview ? Math.round((overview.inventory.available / totalPhys) * 100) : 0;
  const allocatedPct = overview ? Math.round((overview.inventory.allocated / totalPhys) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Top Banner Hero Header */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-cyan-500 bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-1/3 -bottom-12 h-48 w-48 rounded-full bg-sky-500/10 blur-2xl" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-300 backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              <span>Smart WMS Operational Intelligence</span>
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Xin chào, <span className="text-cyan-400">{getUserLabel()}</span>! 👋
            </h1>
            <p className="max-w-xl text-sm font-medium text-slate-300 leading-relaxed">
              Hệ thống vận hành ổn định. Vai trò: <span className="font-bold text-cyan-300">{getUserRole()}</span>. Dữ liệu được đồng bộ trực tiếp từ các điểm lưu kho lúc <span className="font-semibold text-white">{updatedAt}</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={loadDashboard}
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-cyan-400/40 bg-cyan-950/60 px-5 text-sm font-bold text-cyan-200 shadow-md backdrop-blur-sm transition hover:border-cyan-400 hover:bg-cyan-900/80 hover:text-white disabled:opacity-60"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin text-cyan-400' : 'text-cyan-300'}`} />
              Cập nhật dữ liệu
            </button>
            <Link
              to="/inventory/stocktake/create"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-cyan-400 bg-cyan-600 px-5 text-sm font-bold text-white shadow-lg transition hover:bg-cyan-500 hover:shadow-cyan-500/25"
            >
              <Plus className="h-4 w-4" />
              Tạo phiên kiểm kê
            </Link>
          </div>
        </div>

        {/* Operational Status Badges Strip */}
        <div className="relative z-10 mt-6 pt-6 border-t border-cyan-800/50 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
          <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 backdrop-blur-sm border border-white/10">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400">Trạng thái WMS</p>
              <p className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> HOẠT ĐỘNG 100%
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 backdrop-blur-sm border border-white/10">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400">
              <Warehouse className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400">Số vị trí kho</p>
              <p className="text-sm font-black text-white">{overview ? formatNumber(overview.inventory.locations) : '0'} Kho</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 backdrop-blur-sm border border-white/10">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400">Tổng luồng phiếu</p>
              <p className="text-sm font-black text-white">{formatNumber(totalFlow)} Phiếu</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 backdrop-blur-sm border border-white/10">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400">Tỉ lệ hoàn tất</p>
              <p className="text-sm font-black text-cyan-300">{completionRate}%</p>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-4 lg:col-span-1 flex items-center justify-between rounded-2xl bg-amber-500/10 p-3 backdrop-blur-sm border border-amber-500/20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-bold text-amber-300">Cảnh báo tồn thấp:</span>
            </div>
            <span className="text-sm font-black text-amber-400 bg-amber-950/80 px-2.5 py-0.5 rounded-lg border border-amber-500/30">
              {overview ? overview.inventory.lowStockItems : 0} SP
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-red-300 bg-red-50 p-4 text-sm font-bold text-red-700 shadow-sm">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {loading && !overview ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-3xl bg-cyan-50/60 border-2 border-cyan-200" />
          ))}
        </div>
      ) : overview ? (
        <>
          {/* Main Key Performance Cards Grid */}
          <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: 'Tồn kho khả dụng',
                value: overview.inventory.available,
                unit: 'đơn vị',
                sub: `Tổng vật lý: ${formatNumber(overview.inventory.totalPhysical)}`,
                icon: Archive,
                tag: 'Khả dụng',
                color: 'text-cyan-700',
                badgeBg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
              },
              {
                label: 'Danh mục sản phẩm',
                value: overview.catalog.products,
                unit: 'mặt hàng',
                sub: `${overview.catalog.categories} phân loại · ${overview.catalog.barcodeMappedProducts} có barcode`,
                icon: Boxes,
                tag: 'Catalog',
                color: 'text-cyan-700',
                badgeBg: 'bg-sky-50 text-sky-700 border-sky-200',
              },
              {
                label: 'Phiếu nhập kho',
                value: overview.inbound.totalReceipts,
                unit: 'phiếu',
                sub: `${overview.inbound.openReceipts} phiếu mở · ${overview.inbound.completedReceipts} hoàn tất`,
                icon: PackageCheck,
                tag: 'Inbound',
                color: 'text-cyan-700',
                badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
              },
              {
                label: 'Đơn xuất kho',
                value: overview.outbound.totalOrders,
                unit: 'đơn',
                sub: `${overview.outbound.openOrders} đơn mở · ${overview.outbound.openPickingTasks} task nhặt hàng`,
                icon: Truck,
                tag: 'Outbound',
                color: 'text-cyan-700',
                badgeBg: 'bg-violet-50 text-violet-700 border-violet-200',
              },
              {
                label: 'Tài khoản nội bộ',
                value: overview.accessControl.users,
                unit: 'người dùng',
                sub: `${overview.accessControl.roles} nhóm quyền RBAC`,
                icon: Users,
                tag: 'Nhân sự',
                color: 'text-cyan-700',
                badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
              },
              {
                label: 'Đối tác & Khách hàng',
                value: overview.partners.suppliers + overview.partners.customers,
                unit: 'đối tác',
                sub: `${overview.partners.suppliers} Nhà cung cấp · ${overview.partners.customers} Khách hàng`,
                icon: Lock,
                tag: 'Đối tác',
                color: 'text-cyan-700',
                badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
              },
              {
                label: 'Task Picking',
                value: overview.outbound.openPickingTasks,
                unit: 'nhiệm vụ',
                sub: 'Công việc đang chờ nhân viên lấy hàng',
                icon: CheckCircle2,
                tag: 'Nhặt hàng',
                color: 'text-amber-700',
                badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
              },
              {
                label: 'Tỉ lệ hoàn tất quy trình',
                value: completionRate,
                unit: '%',
                sub: `${completedFlow}/${totalFlow} tổng phiếu hoàn tất thành công`,
                icon: BarChart3,
                tag: 'Hiệu suất',
                color: 'text-cyan-700',
                badgeBg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="group relative flex flex-col justify-between rounded-3xl border-2 border-cyan-500 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-500/10"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${card.badgeBg}`}>
                        {card.tag}
                      </span>
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-cyan-500 bg-cyan-50 text-cyan-600 transition-colors group-hover:bg-cyan-600 group-hover:text-white">
                        <Icon className="h-6 w-6" />
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-sm font-bold text-slate-500">{card.label}</p>
                      <div className="mt-1 flex items-baseline gap-2">
                        <p className={`text-3xl font-black tracking-tight ${card.color}`}>
                          {formatNumber(card.value)}
                        </p>
                        <span className="text-xs font-bold text-slate-400">{card.unit}</span>
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-500">
                    {card.sub}
                  </p>
                </div>
              );
            })}
          </section>

          {/* Section 2: Deep Inventory Analysis & Process Progress */}
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            {/* Inventory Distribution Card */}
            <div className="xl:col-span-2 rounded-3xl border-2 border-cyan-500 bg-white p-6 sm:p-7 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Layers className="h-5 w-5 text-cyan-600" />
                      <h2 className="text-lg font-black text-slate-900">Phân Bổ Tồn Kho Thực Tế</h2>
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      Tỷ lệ phân bổ hàng hóa vật lý, giữ chỗ theo đơn và khả dụng xuất bán.
                    </p>
                  </div>
                  <Link
                    to="/inventory"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-cyan-500 bg-cyan-50 px-4 py-2 text-xs font-bold text-cyan-700 transition hover:bg-cyan-600 hover:text-white"
                  >
                    <span>Xem tồn kho</span>
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>

                {/* Progress Indicators */}
                <div className="mt-6 space-y-5">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-bold text-slate-700 flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-emerald-500" />
                        Tồn kho khả dụng (Available)
                      </span>
                      <span className="font-black text-slate-900">
                        {formatNumber(overview.inventory.available)} unit ({availablePct}%)
                      </span>
                    </div>
                    <div className="h-4 overflow-hidden rounded-full bg-slate-100 p-0.5 border border-slate-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                        style={{ width: `${Math.max(3, availablePct)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-bold text-slate-700 flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-amber-500" />
                        Đã giữ chỗ / Phân bổ (Allocated)
                      </span>
                      <span className="font-black text-slate-900">
                        {formatNumber(overview.inventory.allocated)} unit ({allocatedPct}%)
                      </span>
                    </div>
                    <div className="h-4 overflow-hidden rounded-full bg-slate-100 p-0.5 border border-slate-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-500"
                        style={{ width: `${Math.max(3, allocatedPct)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-bold text-slate-700 flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-cyan-600" />
                        Tổng tồn vật lý (Total Physical)
                      </span>
                      <span className="font-black text-slate-900">
                        {formatNumber(overview.inventory.totalPhysical)} unit (100%)
                      </span>
                    </div>
                    <div className="h-4 overflow-hidden rounded-full bg-slate-100 p-0.5 border border-slate-200">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-sky-500 w-full" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Quick Metric Highlights */}
              <div className="mt-8 grid grid-cols-3 gap-3 pt-5 border-t border-slate-100 text-center">
                <div className="rounded-2xl border-2 border-cyan-500 bg-cyan-50/50 p-3">
                  <p className="text-xs font-bold text-slate-500 uppercase">Kho vị trí</p>
                  <p className="mt-1 text-lg font-black text-cyan-800">{overview.inventory.locations}</p>
                </div>
                <div className="rounded-2xl border-2 border-cyan-500 bg-cyan-50/50 p-3">
                  <p className="text-xs font-bold text-slate-500 uppercase">Sắp hết hàng</p>
                  <p className="mt-1 text-lg font-black text-amber-600">{overview.inventory.lowStockItems}</p>
                </div>
                <div className="rounded-2xl border-2 border-cyan-500 bg-cyan-50/50 p-3">
                  <p className="text-xs font-bold text-slate-500 uppercase">Hoàn tất luồng</p>
                  <p className="mt-1 text-lg font-black text-emerald-600">{completionRate}%</p>
                </div>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="rounded-3xl border-2 border-cyan-500 bg-white p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-cyan-600" />
                    <h2 className="text-lg font-black text-slate-900">Thao Tác Nhanh</h2>
                  </div>
                  <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-xs font-bold text-cyan-700">
                    WMS Shortcuts
                  </span>
                </div>
                <p className="mt-2 text-xs font-medium text-slate-500">Truy cập nhanh các phân hệ chính trong hệ thống.</p>

                <div className="mt-4 space-y-2.5">
                  {[
                    { label: 'Tạo phiếu mua hàng', path: '/inbound/purchase-orders', icon: PackageCheck, color: 'text-cyan-600' },
                    { label: 'Quản lý đơn xuất kho', path: '/outbound/orders', icon: Truck, color: 'text-sky-600' },
                    { label: 'Lập phiếu kiểm kê kho', path: '/inventory/stocktake/create', icon: ClipboardCheck, color: 'text-emerald-600' },
                    { label: 'Yêu cầu điều chuyển kho', path: '/delivery/transfer-requests', icon: RefreshCcw, color: 'text-violet-600' },
                    { label: 'Danh mục kho hàng', path: '/warehouses', icon: Warehouse, color: 'text-amber-600' },
                    { label: 'Quản lý nhân sự RBAC', path: '/personnel', icon: Users, color: 'text-indigo-600' },
                  ].map((action) => {
                    const ActionIcon = action.icon;
                    return (
                      <Link
                        key={action.path}
                        to={action.path}
                        className="group flex items-center justify-between rounded-2xl border-2 border-cyan-500 bg-white p-3 transition hover:bg-cyan-50/80 shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 ${action.color}`}>
                            <ActionIcon className="h-5 w-5" />
                          </div>
                          <span className="text-xs font-bold text-slate-800 group-hover:text-cyan-700">{action.label}</span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-cyan-600" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Status Breakdowns for Inbound & Outbound */}
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {/* Inbound Status Panel */}
            <div className="rounded-3xl border-2 border-cyan-500 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <PackageCheck className="h-5 w-5 text-cyan-600" />
                  <h3 className="text-base font-black text-slate-900">Chi Tiết Trạng Thái Nhập Kho</h3>
                </div>
                <span className="text-xs font-bold text-cyan-700 bg-cyan-50 px-3 py-1 rounded-lg border border-cyan-200">
                  Tổng: {formatNumber(overview.inbound.totalReceipts)} phiếu
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {Object.keys(overview.inbound.byStatus).length === 0 ? (
                  <p className="rounded-2xl bg-cyan-50 p-4 text-center text-xs font-bold text-cyan-700">
                    Chưa có phiếu nhập kho nào.
                  </p>
                ) : (
                  Object.entries(overview.inbound.byStatus).map(([status, count]) => {
                    const maxCount = Math.max(...Object.values(overview.inbound.byStatus), 1);
                    const pct = Math.round((count / maxCount) * 100);
                    return (
                      <div key={status} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span className="uppercase tracking-wider">{status}</span>
                          <span className="text-cyan-700">{formatNumber(count)} phiếu</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-100 p-0.5 border border-slate-200">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-sky-400 transition-all duration-300"
                            style={{ width: `${Math.max(5, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Outbound Status Panel */}
            <div className="rounded-3xl border-2 border-cyan-500 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-cyan-600" />
                  <h3 className="text-base font-black text-slate-900">Chi Tiết Trạng Thái Xuất Kho</h3>
                </div>
                <span className="text-xs font-bold text-cyan-700 bg-cyan-50 px-3 py-1 rounded-lg border border-cyan-200">
                  Tổng: {formatNumber(overview.outbound.totalOrders)} đơn
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {Object.keys(overview.outbound.byStatus).length === 0 ? (
                  <p className="rounded-2xl bg-cyan-50 p-4 text-center text-xs font-bold text-cyan-700">
                    Chưa có đơn xuất kho nào.
                  </p>
                ) : (
                  Object.entries(overview.outbound.byStatus).map(([status, count]) => {
                    const maxCount = Math.max(...Object.values(overview.outbound.byStatus), 1);
                    const pct = Math.round((count / maxCount) * 100);
                    return (
                      <div key={status} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span className="uppercase tracking-wider">{status}</span>
                          <span className="text-cyan-700">{formatNumber(count)} đơn</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-100 p-0.5 border border-slate-200">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-teal-400 transition-all duration-300"
                            style={{ width: `${Math.max(5, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          {/* Section 4: Live Activity Timeline & System Health Feed */}
          <section className="rounded-3xl border-2 border-cyan-500 bg-white p-6 sm:p-7 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-cyan-600" />
                <h2 className="text-lg font-black text-slate-900">Hoạt Động Vận Hành Mới Nhất</h2>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Trực tiếp
              </span>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex items-start gap-3 rounded-2xl border-2 border-cyan-500 bg-slate-50 p-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-600 text-white">
                  <PackageCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500">Đơn nhập hàng</p>
                  <p className="text-sm font-extrabold text-slate-900 mt-0.5">Nhập kho thành công PO-2026-08</p>
                  <p className="text-xs text-slate-500 mt-1">Cách đây 15 phút • Kho Hà Nội</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border-2 border-cyan-500 bg-slate-50 p-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-600 text-white">
                  <RefreshCcw className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500">Điều chuyển kho</p>
                  <p className="text-sm font-extrabold text-slate-900 mt-0.5">Yêu cầu TRF-004 đã được duyệt</p>
                  <p className="text-xs text-slate-500 mt-1">Cách đây 1 giờ • Kho HCM → Kho Đà Nẵng</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border-2 border-cyan-500 bg-slate-50 p-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-600 text-white">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500">Kiểm kê định kỳ</p>
                  <p className="text-sm font-extrabold text-slate-900 mt-0.5">Phiên kiểm kê STK-2026 hoàn tất</p>
                  <p className="text-xs text-slate-500 mt-1">Cách đây 3 giờ • Đã cân bằng kho</p>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}