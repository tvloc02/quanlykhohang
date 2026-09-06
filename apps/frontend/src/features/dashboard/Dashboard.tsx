import React from "react";
import { Link } from "react-router-dom";
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
  History,
  Layers,
  MapPin,
  PackageCheck,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";

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

type AuditLogItem = {
  id: string;
  actorEmail?: string;
  action: string;
  resource: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

const formatter = new Intl.NumberFormat("vi-VN");

function formatNumber(value: number) {
  return formatter.format(value);
}

function getUserLabel() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user.fullName || user.email || "Quản trị viên";
  } catch {
    return "Quản trị viên";
  }
}

function getUserRole() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (Array.isArray(user.roles) && user.roles.length > 0) {
      return user.roles[0].name || "Administrator";
    }
    return "Quản trị hệ thống";
  } catch {
    return "Quản trị hệ thống";
  }
}

function formatLogDescription(log: AuditLogItem): string {
  const act = (log.action || "").toUpperCase();
  const res = (log.resource || "").toUpperCase();
  const meta = log.metadata || {};

  if (act.includes("LOGIN")) return `Đăng nhập hệ thống`;
  if (act.includes("CREATE") && res.includes("SẢN PHẨM"))
    return `Thêm sản phẩm mới "${meta.name || meta.sku || ""}"`;
  if (act.includes("UPDATE") && res.includes("SẢN PHẨM"))
    return `Cập nhật sản phẩm ${meta.sku || meta.name || ""}`;
  if (act.includes("RECEIPT") || act.includes("STOCK_IN"))
    return `Nhập kho ${meta.poCode ? `đơn ${meta.poCode}` : ""}`;
  if (act.includes("OUTBOUND") || act.includes("STOCK_OUT"))
    return `Xuất kho ${meta.orderNo ? `đơn ${meta.orderNo}` : ""}`;

  let actionText = "Thao tác";
  if (act.includes("CREATE") || act.includes("ADD")) actionText = "Tạo mới";
  else if (act.includes("UPDATE") || act.includes("EDIT"))
    actionText = "Cập nhật";
  else if (act.includes("DELETE") || act.includes("REMOVE")) actionText = "Xóa";

  return `${actionText} dữ liệu ${log.resource}`;
}

export default function Dashboard() {
  const [overview, setOverview] = React.useState<DashboardOverview | null>(
    null,
  );
  const [recentLogs, setRecentLogs] = React.useState<AuditLogItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [chartView, setChartView] = React.useState<"bar" | "line">("bar");

  const loadDashboard = React.useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "http://localhost:3000/api/reports/dashboard",
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.message || "Không tải được dữ liệu dashboard",
        );
      }

      const data = (await response.json()) as DashboardOverview;
      setOverview(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không tải được dữ liệu dashboard",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const updatedAt = overview
    ? new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(overview.generatedAt))
    : "--";

  const totalFlow = overview
    ? overview.inbound.totalReceipts + overview.outbound.totalOrders
    : 0;
  const completedFlow = overview
    ? overview.inbound.completedReceipts + overview.outbound.completedOrders
    : 0;
  const completionRate =
    totalFlow > 0 ? Math.round((completedFlow / totalFlow) * 100) : 100;

  // Real Status Calculations
  const draftStatusCount = overview
    ? (overview.inbound.byStatus?.["DRAFT"] || 0) +
      (overview.outbound.byStatus?.["DRAFT"] || 0)
    : 0;
  const openStatusCount = overview
    ? overview.inbound.openReceipts + overview.outbound.openOrders
    : 0;
  const completedStatusCount = overview
    ? overview.inbound.completedReceipts + overview.outbound.completedOrders
    : 0;
  const approvedStatusCount = overview
    ? (overview.inbound.byStatus?.["APPROVED"] || 0) +
      (overview.outbound.byStatus?.["APPROVED"] || 0)
    : 0;
  const cancelledStatusCount = overview
    ? (overview.inbound.byStatus?.["CANCELLED"] || 0) +
      (overview.outbound.byStatus?.["CANCELLED"] || 0)
    : 0;

  const maxStatusCount = Math.max(
    1,
    draftStatusCount,
    openStatusCount,
    completedStatusCount,
    approvedStatusCount,
    cancelledStatusCount,
  );

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between border-b border-slate-200/80 pb-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2.5 rounded-xl border border-cyan-500/30 bg-cyan-600 px-4 py-2 text-white shadow-sm">
            <ShieldCheck className="h-5 w-5 text-cyan-100" />
            <h1 className="text-base font-extrabold tracking-tight text-white uppercase">
              BẢNG ĐIỀU KHIỂN VẬN HÀNH KHO HÀNG (WMS)
            </h1>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            Xin chào,{" "}
            <span className="font-extrabold text-cyan-700">
              {getUserLabel()}
            </span>
            ! Vai trò:{" "}
            <span className="font-extrabold text-cyan-800 bg-cyan-50 border border-cyan-200 px-2.5 py-0.5 rounded-md">
              {getUserRole()}
            </span>
            . Cập nhật dữ liệu thời gian thực lúc{" "}
            <span className="font-bold text-slate-700">{updatedAt}</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-500 bg-white px-5 py-2.5 text-xs font-bold text-cyan-700 shadow-xs transition hover:bg-cyan-50 cursor-pointer disabled:opacity-60"
          >
            <RefreshCcw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Làm mới dữ liệu
          </button>
          <Link
            to="/inventory/stocktake/create"
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-cyan-700 cursor-pointer active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Tạo Kiểm Kê Kho
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-red-300 bg-red-50 p-4 text-sm font-bold text-red-700 shadow-sm">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {loading && !overview ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-3xl bg-cyan-50/60 border-2 border-cyan-200"
            />
          ))}
        </div>
      ) : overview ? (
        <>
          {/* SECTION 1: 4 KEY HIGH-IMPACT KPI CARDS */}
          <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {/* KPI Card 1 */}
            <div className="group relative flex flex-col justify-between rounded-3xl border-2 border-cyan-500 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-500/10">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-cyan-800">
                    Tồn Khai Thác
                  </span>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-cyan-500 bg-cyan-50 text-cyan-600 transition-colors group-hover:bg-cyan-600 group-hover:text-white">
                    <Archive className="h-6 w-6" />
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Tồn kho khả dụng
                  </p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <p className="text-3xl font-black text-cyan-800 tracking-tight">
                      {formatNumber(overview.inventory.available)}
                    </p>
                    <span className="text-xs font-bold text-slate-400">
                      sản phẩm
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-500 flex items-center justify-between">
                <span>Tổng tồn vật lý:</span>
                <span className="font-extrabold text-slate-800">
                  {formatNumber(overview.inventory.totalPhysical)} SP
                </span>
              </p>
            </div>

            {/* KPI Card 2 */}
            <div className="group relative flex flex-col justify-between rounded-3xl border-2 border-cyan-500 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-500/10">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-sky-800">
                    Danh Mục
                  </span>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-cyan-500 bg-cyan-50 text-cyan-600 transition-colors group-hover:bg-cyan-600 group-hover:text-white">
                    <Boxes className="h-6 w-6" />
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Tổng số mặt hàng
                  </p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <p className="text-3xl font-black text-cyan-800 tracking-tight">
                      {formatNumber(overview.catalog.products)}
                    </p>
                    <span className="text-xs font-bold text-slate-400">
                      SKU
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-500 flex items-center justify-between">
                <span>{overview.catalog.categories} Nhóm hàng</span>
                <span className="font-extrabold text-cyan-700">
                  {overview.catalog.barcodeMappedProducts} có Barcode
                </span>
              </p>
            </div>

            {/* KPI Card 3 */}
            <div className="group relative flex flex-col justify-between rounded-3xl border-2 border-cyan-500 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-500/10">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Luồng Vận Hành
                  </span>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-cyan-500 bg-cyan-50 text-cyan-600 transition-colors group-hover:bg-cyan-600 group-hover:text-white">
                    <PackageCheck className="h-6 w-6" />
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Tổng phiếu Xuất/Nhập
                  </p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <p className="text-3xl font-black text-cyan-800 tracking-tight">
                      {formatNumber(totalFlow)}
                    </p>
                    <span className="text-xs font-bold text-slate-400">
                      phiếu
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-500 flex items-center justify-between">
                <span>Nhập: {overview.inbound.totalReceipts}</span>
                <span className="font-extrabold text-emerald-700">
                  Xuất: {overview.outbound.totalOrders}
                </span>
              </p>
            </div>

            {/* KPI Card 4 */}
            <div className="group relative flex flex-col justify-between rounded-3xl border-2 border-amber-400 bg-amber-50/60 p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/10">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex rounded-lg border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-amber-900">
                    Cảnh Báo Tồn Kho
                  </span>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-amber-500 bg-amber-500 text-white shadow-xs">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xs font-extrabold text-amber-900 uppercase tracking-wide">
                    Hàng dưới định mức
                  </p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <p className="text-3xl font-black text-amber-900 tracking-tight">
                      {overview.inventory.lowStockItems}
                    </p>
                    <span className="text-xs font-bold text-amber-700">
                      mặt hàng
                    </span>
                  </div>
                </div>
              </div>
              <Link
                to="/reports/below-min-stock"
                className="mt-4 pt-3 border-t border-amber-200 text-xs font-black text-amber-800 flex items-center justify-between hover:underline"
              >
                <span>Xem danh sách cảnh báo</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </section>

          {/* SECTION 2: CHARTS & INVENTORY ANALYSIS */}
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            {/* Chart 1: TRẠNG THÁI PHIẾU XUẤT NHẬP KHO (7 Cols) */}
            <div className="xl:col-span-7 rounded-3xl border-2 border-cyan-500 bg-white p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-cyan-600" />
                    <h2 className="text-sm font-black uppercase tracking-wider text-cyan-950">
                      TRẠNG THÁI LUỒNG HÀNG XUẤT NHẬP KHO
                    </h2>
                  </div>
                  <div className="flex items-center gap-1 rounded-xl bg-cyan-50 p-1 border border-cyan-200">
                    <button
                      type="button"
                      onClick={() => setChartView("bar")}
                      className={`rounded-lg p-1.5 transition cursor-pointer ${
                        chartView === "bar"
                          ? "bg-cyan-600 text-white shadow-xs"
                          : "text-cyan-700 hover:bg-cyan-100"
                      }`}
                      title="Biểu đồ cột"
                    >
                      <BarChart3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartView("line")}
                      className={`rounded-lg p-1.5 transition cursor-pointer ${
                        chartView === "line"
                          ? "bg-cyan-600 text-white shadow-xs"
                          : "text-cyan-700 hover:bg-cyan-100"
                      }`}
                      title="Biểu đồ xu hướng"
                    >
                      <TrendingUp className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Custom Accurate Dynamic Bar Chart */}
                <div className="mt-8 pt-2">
                  <div className="relative flex h-56 w-full items-end justify-between gap-6 border-b border-slate-200 px-4 pb-2">
                    {/* Y-Axis Gridlines */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[11px] font-extrabold text-slate-300">
                      <div className="border-b border-dashed border-slate-100 pb-1">
                        {maxStatusCount}
                      </div>
                      <div className="border-b border-dashed border-slate-100 pb-1">
                        {Math.round(maxStatusCount * 0.5)}
                      </div>
                      <div className="pb-1">0</div>
                    </div>

                    {/* Dynamic Status Bars */}
                    {[
                      { label: "MỚI TẠO", count: draftStatusCount },
                      { label: "ĐANG XỬ LÝ", count: openStatusCount },
                      { label: "HOÀN THÀNH", count: completedStatusCount },
                      { label: "ĐÃ DUYỆT", count: approvedStatusCount },
                      { label: "ĐÃ HỦY", count: cancelledStatusCount },
                    ].map((item) => {
                      const heightPct = Math.max(
                        8,
                        Math.min(
                          100,
                          Math.round((item.count / maxStatusCount) * 100),
                        ),
                      );
                      return (
                        <div
                          key={item.label}
                          className="relative z-10 flex flex-1 flex-col items-center h-full justify-end group"
                        >
                          <div className="mb-2 text-xs font-black text-cyan-900 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-200">
                            {item.count}
                          </div>
                          <div
                            style={{ height: `${heightPct}%` }}
                            className="w-full max-w-[50px] rounded-t-xl bg-gradient-to-t from-cyan-700 via-cyan-500 to-sky-400 shadow-md shadow-cyan-500/20 transition-all duration-500 group-hover:brightness-110"
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* X-Axis Labels */}
                  <div className="flex items-center justify-between gap-6 px-4 pt-4 text-[11px] font-extrabold text-slate-600 text-center">
                    <span className="flex-1">MỚI TẠO</span>
                    <span className="flex-1">ĐANG XỬ LÝ</span>
                    <span className="flex-1">HOÀN THÀNH</span>
                    <span className="flex-1">ĐÃ DUYỆT</span>
                    <span className="flex-1">ĐÃ HỦY</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Widget 2: TỶ LỆ PHÂN BỔ TỒN KHO THỰC TẾ (5 Cols) */}
            <div className="xl:col-span-5 rounded-3xl border-2 border-cyan-500 bg-white p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <Layers className="h-5 w-5 text-cyan-600" />
                    <h2 className="text-sm font-black uppercase tracking-wider text-cyan-950">
                      TỶ LỆ PHÂN BỔ TỒN KHO
                    </h2>
                  </div>
                  <Link
                    to="/reports/inventory-summary"
                    className="text-xs font-extrabold text-cyan-700 hover:underline flex items-center gap-1"
                  >
                    <span>Báo cáo</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <div className="mt-6 space-y-5">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-700">
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-emerald-500" />
                        Khả dụng xuất bán (Available)
                      </span>
                      <span className="font-black text-slate-900">
                        {formatNumber(overview.inventory.available)} unit (
                        {Math.round(
                          (overview.inventory.available /
                            (overview.inventory.totalPhysical || 1)) *
                            100,
                        )}
                        %)
                      </span>
                    </div>
                    <div className="h-3.5 overflow-hidden rounded-full bg-slate-100 p-0.5 border border-slate-200">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{
                          width: `${Math.max(
                            3,
                            Math.round(
                              (overview.inventory.available /
                                (overview.inventory.totalPhysical || 1)) *
                                100,
                            ),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-700">
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-amber-500" />
                        Đã giữ chỗ / Phân bổ (Allocated)
                      </span>
                      <span className="font-black text-slate-900">
                        {formatNumber(overview.inventory.allocated)} unit (
                        {Math.round(
                          (overview.inventory.allocated /
                            (overview.inventory.totalPhysical || 1)) *
                            100,
                        )}
                        %)
                      </span>
                    </div>
                    <div className="h-3.5 overflow-hidden rounded-full bg-slate-100 p-0.5 border border-slate-200">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all duration-500"
                        style={{
                          width: `${Math.max(
                            3,
                            Math.round(
                              (overview.inventory.allocated /
                                (overview.inventory.totalPhysical || 1)) *
                                100,
                            ),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-700">
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-cyan-600" />
                        Tổng tồn kho vật lý (Total Physical)
                      </span>
                      <span className="font-black text-slate-900">
                        {formatNumber(overview.inventory.totalPhysical)} unit
                        (100%)
                      </span>
                    </div>
                    <div className="h-3.5 overflow-hidden rounded-full bg-slate-100 p-0.5 border border-slate-200">
                      <div className="h-full rounded-full bg-cyan-600 w-full" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Quick System Stats */}
              <div className="mt-6 grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 text-center">
                <div className="rounded-2xl border-2 border-cyan-500 bg-cyan-50/50 p-3">
                  <p className="text-[11px] font-extrabold text-slate-500 uppercase">
                    Số lượng vị trí kho
                  </p>
                  <p className="mt-1 text-base font-black text-cyan-900">
                    {overview.inventory.locations} Vị trí / Kho
                  </p>
                </div>
                <div className="rounded-2xl border-2 border-cyan-500 bg-cyan-50/50 p-3">
                  <p className="text-[11px] font-extrabold text-slate-500 uppercase">
                    Tài khoản & Nhóm quyền
                  </p>
                  <p className="mt-1 text-base font-black text-cyan-900">
                    {overview.accessControl.users} User ·{" "}
                    {overview.accessControl.roles} Quyền
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: THAO TÁC NHANH & LIVE RECENT ACTIVITY */}
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            {/* Quick Actions (6 Cols) */}
            <div className="xl:col-span-6 rounded-3xl border-2 border-cyan-500 bg-white p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-cyan-600" />
                    <h2 className="text-base font-black text-slate-900">
                      Thao Tác Nhanh WMS
                    </h2>
                  </div>
                  <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-xs font-bold text-cyan-800">
                    Lối tắt
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    {
                      label: "Tạo đơn đặt mua",
                      path: "/inbound/purchase-orders",
                      icon: PackageCheck,
                      color: "text-cyan-600",
                    },
                    {
                      label: "Tạo đơn xuất kho",
                      path: "/outbound/orders/create",
                      icon: Truck,
                      color: "text-sky-600",
                    },
                    {
                      label: "Phiên kiểm kê kho",
                      path: "/inventory/stocktake/create",
                      icon: ClipboardCheck,
                      color: "text-emerald-600",
                    },
                    {
                      label: "Yêu cầu chuyển kho",
                      path: "/delivery/transfer-requests",
                      icon: RefreshCcw,
                      color: "text-violet-600",
                    },
                    {
                      label: "Sơ đồ & Kệ kho",
                      path: "/inventory/visualizer",
                      icon: MapPin,
                      color: "text-amber-600",
                    },
                    {
                      label: "Nhật ký hệ thống",
                      path: "/audit-log",
                      icon: History,
                      color: "text-indigo-600",
                    },
                  ].map((action) => {
                    const ActionIcon = action.icon;
                    return (
                      <Link
                        key={action.path}
                        to={action.path}
                        className="group flex items-center justify-between rounded-2xl border-2 border-cyan-500 bg-white p-3 transition hover:bg-cyan-50 shadow-xs cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50 ${action.color}`}
                          >
                            <ActionIcon className="h-4 w-4" />
                          </div>
                          <span className="text-xs font-bold text-slate-800 group-hover:text-cyan-700">
                            {action.label}
                          </span>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-cyan-600" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Live Activity Feed (6 Cols) */}
            <div className="xl:col-span-6 rounded-3xl border-2 border-cyan-500 bg-white p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-cyan-600" />
                    <h2 className="text-base font-black text-slate-900">
                      Hoạt Động Vận Hành Mới Nhất
                    </h2>
                  </div>
                  <Link
                    to="/audit-log"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 hover:bg-emerald-100"
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Trực tiếp
                  </Link>
                </div>

                <div className="mt-4 space-y-3">
                  {recentLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-xs font-bold text-slate-500">
                      <History className="h-8 w-8 text-cyan-400 mb-2" />
                      Hệ thống đang hoạt động bình thường
                    </div>
                  ) : (
                    recentLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 transition hover:bg-cyan-50/60"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-600 text-white font-black text-xs">
                            {log.resource
                              ? log.resource.charAt(0).toUpperCase()
                              : "W"}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">
                              {formatLogDescription(log)}
                            </p>
                            <p className="text-[11px] font-semibold text-slate-500">
                              Bởi {log.actorEmail || "Hệ thống"}
                            </p>
                          </div>
                        </div>
                        <span className="text-[11px] font-extrabold text-slate-400">
                          {new Date(log.createdAt).toLocaleTimeString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
