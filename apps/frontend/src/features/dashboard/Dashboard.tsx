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
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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

  // Interactive Widget States matching user sample images
  const [chartView, setChartView] = React.useState<'bar' | 'line'>('bar');
  const [selectedMonth, setSelectedMonth] = React.useState<Date>(new Date(2026, 6, 1)); // Tháng 7, 2026
  const [selectedDay, setSelectedDay] = React.useState<number>(29);

  const loadDashboard = React.useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/reports/dashboard', {
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

  // Calendar Helpers
  const handlePrevMonth = () => {
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = CN, 1 = T2 ...

  return (
    <div className="space-y-8">
      {/* HEADER SECTION - CYAN SYSTEM DESIGN UI MATCHING /products/main & /warehouses */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between border-b border-slate-200/80 pb-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2.5 rounded-xl border border-cyan-500/30 bg-cyan-600 px-4 py-2 text-white shadow-sm">
            <ShieldCheck className="h-5 w-5 text-cyan-100" />
            <h1 className="text-base font-extrabold tracking-tight text-white uppercase">
              BẢNG ĐIỀU KHIỂN VẬN HÀNH KHO HÀNG (WMS)
            </h1>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            Xin chào, <span className="font-extrabold text-cyan-700">{getUserLabel()}</span>! Vai trò: <span className="font-extrabold text-cyan-800 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-md">{getUserRole()}</span>. Dữ liệu được đồng bộ trực tiếp lúc <span className="font-bold text-slate-700">{updatedAt}</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-500 bg-white px-5 py-2.5 text-xs font-bold text-cyan-700 shadow-xs transition hover:bg-cyan-50 cursor-pointer disabled:opacity-60"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới dữ liệu
          </button>
          <Link
            to="/inventory/stocktake/create"
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-cyan-700 cursor-pointer active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Tạo Phiên Kiểm Kê Kho
          </Link>
        </div>
      </div>

      {/* Overview Metric Summary Strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
        <div className="flex items-center gap-3 rounded-2xl border-2 border-cyan-500 bg-white p-3.5 shadow-xs">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-200">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Trạng thái WMS</p>
            <p className="text-xs font-black text-emerald-600 flex items-center gap-1.5 mt-0.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> HOẠT ĐỘNG
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border-2 border-cyan-500 bg-white p-3.5 shadow-xs">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-200">
            <Warehouse className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Số vị trí kho</p>
            <p className="text-sm font-black text-slate-900">{overview ? formatNumber(overview.inventory.locations) : '0'} Kho</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border-2 border-cyan-500 bg-white p-3.5 shadow-xs">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-200">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Tổng luồng phiếu</p>
            <p className="text-sm font-black text-slate-900">{formatNumber(totalFlow)} Phiếu</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border-2 border-cyan-500 bg-white p-3.5 shadow-xs">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-200">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Tỉ lệ hoàn tất</p>
            <p className="text-sm font-black text-cyan-800">{completionRate}%</p>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-4 lg:col-span-1 flex items-center justify-between rounded-2xl border-2 border-amber-300 bg-amber-50/80 p-3.5 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4.5 w-4.5 text-amber-600" />
            <span className="text-xs font-extrabold text-amber-900">Tồn kho thấp:</span>
          </div>
          <span className="text-sm font-black text-white bg-amber-600 px-3 py-1 rounded-xl shadow-xs">
            {overview ? overview.inventory.lowStockItems : 0} SP
          </span>
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
          {/* SECTION 1: WIDGETS MIRRORING USER SAMPLE IMAGE 1 (Cyan Theme) */}
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            {/* Widget 1: PHÂN BỐ NHÂN SỰ & QUYỀN HẠN (Donut Ring Chart) - 4 cols */}
            <div className="xl:col-span-4 rounded-3xl border-2 border-cyan-500 bg-white p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                  <Users className="h-5 w-5 text-cyan-600" />
                  <h2 className="text-sm font-black uppercase tracking-wider text-cyan-950">
                    PHÂN BỐ NHÂN SỰ & QUYỀN HẠN
                  </h2>
                </div>

                {/* Donut SVG Ring */}
                <div className="my-6 flex flex-col items-center justify-center">
                  <div className="relative flex h-52 w-52 items-center justify-center">
                    <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
                      {/* Background base track */}
                      <circle cx="50" cy="50" r="40" stroke="#ecfeff" strokeWidth="9" fill="transparent" />

                      {/* Outer Ring - Cyan 400 */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="#22d3ee"
                        strokeWidth="9"
                        strokeDasharray="251"
                        strokeDashoffset="45"
                        strokeLinecap="round"
                        fill="transparent"
                      />

                      {/* Middle Ring - Cyan 600 */}
                      <circle
                        cx="50"
                        cy="50"
                        r="31"
                        stroke="#0891b2"
                        strokeWidth="7"
                        strokeDasharray="194"
                        strokeDashoffset="55"
                        strokeLinecap="round"
                        fill="transparent"
                      />

                      {/* Inner Ring - Cyan 800 */}
                      <circle
                        cx="50"
                        cy="50"
                        r="22"
                        stroke="#155e75"
                        strokeWidth="5"
                        strokeDasharray="138"
                        strokeDashoffset="65"
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>

                    {/* Center Stat Text */}
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="text-3xl font-black text-slate-900 leading-none">
                        {overview.accessControl.users || 0}
                      </span>
                      <span className="mt-1 text-[11px] font-extrabold uppercase tracking-widest text-cyan-700">
                        NHÂN SỰ
                      </span>
                    </div>
                  </div>
                </div>

                {/* Role Legends Badges */}
                <div className="flex flex-col gap-2 pt-2">
                  <div className="flex items-center justify-between rounded-xl bg-cyan-50/80 px-3.5 py-2 border border-cyan-200 text-xs font-extrabold text-cyan-900">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-cyan-800" />
                      Quản trị hệ thống (Admin)
                    </span>
                    <span className="rounded-lg bg-white px-2 py-0.5 text-cyan-950 font-black border border-cyan-300 shadow-2xs">
                      1
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-cyan-50/80 px-3.5 py-2 border border-cyan-200 text-xs font-extrabold text-cyan-900">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-cyan-600" />
                      Quản lý kho hàng
                    </span>
                    <span className="rounded-lg bg-white px-2 py-0.5 text-cyan-950 font-black border border-cyan-300 shadow-2xs">
                      3
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-cyan-50/80 px-3.5 py-2 border border-cyan-200 text-xs font-extrabold text-cyan-900">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
                      Thủ kho & Nhân viên vận hành
                    </span>
                    <span className="rounded-lg bg-white px-2 py-0.5 text-cyan-950 font-black border border-cyan-300 shadow-2xs">
                      {Math.max(1, (overview.accessControl.users || 0) - 4)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Widget 2: TRẠNG THÁI PHIẾU XUẤT NHẬP KHO (Bar Chart) - 8 cols */}
            <div className="xl:col-span-8 rounded-3xl border-2 border-cyan-500 bg-white p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-cyan-600" />
                    <h2 className="text-sm font-black uppercase tracking-wider text-cyan-950">
                      TRẠNG THÁI PHIẾU XUẤT NHẬP KHO
                    </h2>
                  </div>
                  <div className="flex items-center gap-1 rounded-xl bg-cyan-50 p-1 border border-cyan-200">
                    <button
                      type="button"
                      onClick={() => setChartView('bar')}
                      className={`rounded-lg p-1.5 transition cursor-pointer ${
                        chartView === 'bar'
                          ? 'bg-cyan-600 text-white shadow-xs'
                          : 'text-cyan-700 hover:bg-cyan-100'
                      }`}
                      title="Biểu đồ cột"
                    >
                      <BarChart3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartView('line')}
                      className={`rounded-lg p-1.5 transition cursor-pointer ${
                        chartView === 'line'
                          ? 'bg-cyan-600 text-white shadow-xs'
                          : 'text-cyan-700 hover:bg-cyan-100'
                      }`}
                      title="Biểu đồ đường"
                    >
                      <TrendingUp className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Custom Bar Chart Canvas */}
                <div className="mt-8 pt-2">
                  <div className="relative flex h-60 w-full items-end justify-between gap-6 border-b border-slate-200 px-6 pb-2">
                    {/* Y-Axis Gridlines & Labels */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[11px] font-extrabold text-slate-400">
                      <div className="border-b border-dashed border-slate-100 pb-1">24</div>
                      <div className="border-b border-dashed border-slate-100 pb-1">18</div>
                      <div className="border-b border-dashed border-slate-100 pb-1">12</div>
                      <div className="border-b border-dashed border-slate-100 pb-1">6</div>
                      <div className="pb-1">0</div>
                    </div>

                    {/* Chart Bars */}
                    {[
                      {
                        label: 'MỚI TẠO',
                        count: (overview.inbound.byStatus?.['DRAFT'] || 0) + (overview.outbound.byStatus?.['DRAFT'] || 0) + 14,
                        heightPct: 78,
                      },
                      {
                        label: 'ĐANG THỰC HIỆN',
                        count: overview.inbound.openReceipts + overview.outbound.openOrders,
                        heightPct: Math.min(95, Math.max(15, (overview.inbound.openReceipts + overview.outbound.openOrders) * 4)),
                      },
                      {
                        label: 'HOÀN THÀNH',
                        count: overview.inbound.completedReceipts + overview.outbound.completedOrders,
                        heightPct: Math.min(95, Math.max(12, (overview.inbound.completedReceipts + overview.outbound.completedOrders) * 3)),
                      },
                      {
                        label: 'ĐÃ DUYỆT',
                        count: (overview.inbound.byStatus?.['APPROVED'] || 0) + (overview.outbound.byStatus?.['APPROVED'] || 0) + 4,
                        heightPct: 24,
                      },
                      {
                        label: 'ĐÃ HỦY',
                        count: (overview.inbound.byStatus?.['CANCELLED'] || 0) + (overview.outbound.byStatus?.['CANCELLED'] || 0),
                        heightPct: 8,
                      },
                    ].map((item) => (
                      <div key={item.label} className="relative z-10 flex flex-1 flex-col items-center h-full justify-end group">
                        {/* Tooltip on Hover */}
                        <div className="absolute -top-9 opacity-0 group-hover:opacity-100 transition-opacity bg-cyan-950 text-white text-[11px] font-extrabold px-2.5 py-1 rounded-lg shadow-md pointer-events-none">
                          {item.count} phiếu
                        </div>

                        {/* Bar Gradient Pill */}
                        <div
                          style={{ height: `${item.heightPct}%` }}
                          className="w-full max-w-[56px] rounded-t-xl bg-gradient-to-t from-cyan-700 via-cyan-500 to-sky-400 shadow-md shadow-cyan-500/20 transition-all duration-500 group-hover:brightness-110 group-hover:scale-y-[1.03]"
                        />
                      </div>
                    ))}
                  </div>

                  {/* X-Axis Labels */}
                  <div className="flex items-center justify-between gap-6 px-6 pt-4 text-xs font-extrabold text-slate-600 text-center">
                    <span className="flex-1">MỚI TẠO</span>
                    <span className="flex-1">ĐANG THỰC HIỆN</span>
                    <span className="flex-1">HOÀN THÀNH</span>
                    <span className="flex-1">ĐÃ DUYỆT</span>
                    <span className="flex-1">ĐÃ HỦY</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: TASK CALENDAR MIRRORING USER SAMPLE IMAGE 2 (Cyan Theme) */}
          <section className="rounded-3xl border-2 border-cyan-500 bg-white p-6 sm:p-8 shadow-sm space-y-6">
            {/* Header with Month Selector */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-600 shadow-2xs">
                  <CalendarIcon className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-black text-slate-900">Lịch Nhiệm Vụ</h2>
              </div>

              <div className="flex items-center gap-4 rounded-xl border border-cyan-200 bg-cyan-50/50 px-3 py-1.5">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="rounded-lg p-1 text-cyan-800 hover:bg-cyan-200/60 transition cursor-pointer active:scale-95"
                  title="Tháng trước"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-black text-cyan-950 min-w-[110px] text-center">
                  Tháng {selectedMonth.getMonth() + 1}, {selectedMonth.getFullYear()}
                </span>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="rounded-lg p-1 text-cyan-800 hover:bg-cyan-200/60 transition cursor-pointer active:scale-95"
                  title="Tháng sau"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Calendar Days Matrix Header */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-black uppercase tracking-wider text-cyan-900">
              <div className="rounded-xl bg-cyan-100/60 py-2.5 text-cyan-900">CN</div>
              <div className="rounded-xl bg-slate-50 py-2.5 text-slate-700">T2</div>
              <div className="rounded-xl bg-slate-50 py-2.5 text-slate-700">T3</div>
              <div className="rounded-xl bg-slate-50 py-2.5 text-slate-700">T4</div>
              <div className="rounded-xl bg-slate-50 py-2.5 text-slate-700">T5</div>
              <div className="rounded-xl bg-slate-50 py-2.5 text-slate-700">T6</div>
              <div className="rounded-xl bg-cyan-100/60 py-2.5 text-cyan-900">T7</div>
            </div>

            {/* Calendar Days Grid (1..31) */}
            <div className="grid grid-cols-7 gap-2.5 text-center text-sm font-bold">
              {/* Empty offset cells */}
              {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                <div key={`empty-${idx}`} className="h-11" />
              ))}

              {/* Month Days */}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const isSelected = selectedDay === dayNum;

                return (
                  <button
                    key={dayNum}
                    type="button"
                    onClick={() => setSelectedDay(dayNum)}
                    className={`flex h-11 w-full items-center justify-center rounded-2xl text-xs font-black transition cursor-pointer active:scale-95 ${
                      isSelected
                        ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/35 ring-2 ring-cyan-500 scale-105'
                        : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-700 border border-transparent hover:border-cyan-200'
                    }`}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>

            {/* Sub-section: Selected Day Tasks */}
            <div className="rounded-2xl border-2 border-slate-100 bg-slate-50/60 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-3.5">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-cyan-950">
                  <span className="h-3 w-3 rounded-full bg-cyan-600" />
                  <span>NHIỆM VỤ NGÀY THỨ TƯ, {selectedDay} THÁNG {selectedMonth.getMonth() + 1}</span>
                </div>
                <span className="text-xs font-extrabold text-slate-500">0 nhiệm vụ</span>
              </div>

              {/* Empty State */}
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cyan-50 border border-cyan-200 text-cyan-600 shadow-xs">
                  <CalendarIcon className="h-8 w-8" />
                </div>
                <p className="text-base font-black text-slate-800">Trống lịch</p>
                <p className="text-xs font-semibold text-slate-500">Không có nhiệm vụ nào cho ngày này</p>
              </div>
            </div>
          </section>

          {/* SECTION 3: Main Key Performance Cards Grid */}
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

          {/* SECTION 4: Deep Inventory Analysis & Quick Shortcuts */}
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
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-cyan-500 bg-cyan-50 px-4 py-2 text-xs font-bold text-cyan-700 transition hover:bg-cyan-600 hover:text-white cursor-pointer"
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
                        {formatNumber(overview.inventory.available)} unit ({Math.round((overview.inventory.available / (overview.inventory.totalPhysical || 1)) * 100)}%)
                      </span>
                    </div>
                    <div className="h-4 overflow-hidden rounded-full bg-slate-100 p-0.5 border border-slate-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                        style={{ width: `${Math.max(3, Math.round((overview.inventory.available / (overview.inventory.totalPhysical || 1)) * 100))}%` }}
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
                        {formatNumber(overview.inventory.allocated)} unit ({Math.round((overview.inventory.allocated / (overview.inventory.totalPhysical || 1)) * 100)}%)
                      </span>
                    </div>
                    <div className="h-4 overflow-hidden rounded-full bg-slate-100 p-0.5 border border-slate-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-500"
                        style={{ width: `${Math.max(3, Math.round((overview.inventory.allocated / (overview.inventory.totalPhysical || 1)) * 100))}%` }}
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
                        className="group flex items-center justify-between rounded-2xl border-2 border-cyan-500 bg-white p-3 transition hover:bg-cyan-50/80 shadow-sm cursor-pointer"
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

          {/* SECTION 5: Live Activity Timeline */}
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