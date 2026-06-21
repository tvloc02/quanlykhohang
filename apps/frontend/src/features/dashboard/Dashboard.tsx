import React from 'react';
import { Link } from 'react-router-dom';
import {
  Archive,
  BarChart3,
  Boxes,
  CheckCircle2,
  Lock,
  PackageCheck,
  RefreshCcw,
  Truck,
  Users,
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
    return user.email || 'Quản trị viên';
  } catch {
    return 'Quản trị viên';
  }
}

function StatusList({ title, statuses }: { title: string; statuses: Record<string, number> }) {
  const entries = Object.entries(statuses).filter(([, count]) => count > 0);

  return (
    <div className="rounded-3xl border border-cyan-100 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <div className="mt-5 space-y-3">
        {entries.length === 0 ? (
          <p className="rounded-2xl bg-cyan-50 px-4 py-3 text-sm text-cyan-700">
            Chưa có dữ liệu vận hành trong phân hệ này.
          </p>
        ) : (
          entries.map(([status, count]) => (
            <div key={status} className="flex items-center justify-between rounded-2xl bg-cyan-50/70 px-4 py-3">
              <span className="text-sm font-semibold text-slate-700">{status}</span>
              <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-cyan-700 shadow-sm">
                {formatNumber(count)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
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

  return (
    <div className="space-y-6">
      
      {/* Header gọn nhẹ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Tổng quan hệ thống</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Xin chào <span className="font-bold text-slate-700">{getUserLabel()}</span>. Dữ liệu được cập nhật lúc: {updatedAt}
          </p>
        </div>
        <button
          type="button"
          onClick={loadDashboard}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin text-cyan-600' : 'text-slate-400'}`} />
          Làm mới
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {loading && !overview ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-3xl bg-cyan-50/50 border border-slate-100" />
          ))}
        </div>
      ) : overview ? (
        <>
          {/* Main Stat Cards */}
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: 'Tài khoản nội bộ',
                value: overview.accessControl.users,
                sub: `${overview.accessControl.roles} vai trò RBAC`,
                icon: Users,
              },
              {
                label: 'Danh mục hàng hóa',
                value: overview.catalog.products,
                sub: `${overview.catalog.categories} danh mục · ${overview.catalog.barcodeMappedProducts} barcode`,
                icon: Boxes,
              },
              {
                label: 'Tồn kho khả dụng',
                value: overview.inventory.available,
                sub: `${overview.inventory.locations} vị trí · ${overview.inventory.lowStockItems} sắp hết`,
                icon: Archive,
              },
              {
                label: 'Đối tác dữ liệu',
                value: overview.partners.suppliers + overview.partners.customers,
                sub: `${overview.partners.suppliers} NCC · ${overview.partners.customers} khách hàng`,
                icon: Lock,
              },
              {
                label: 'Phiếu nhập kho',
                value: overview.inbound.totalReceipts,
                sub: `${overview.inbound.openReceipts} đang xử lý`,
                icon: PackageCheck,
              },
              {
                label: 'Phiếu xuất kho',
                value: overview.outbound.totalOrders,
                sub: `${overview.outbound.openOrders} đơn mở`,
                icon: Truck,
              },
              {
                label: 'Task picking',
                value: overview.outbound.openPickingTasks,
                sub: 'Công việc chưa hoàn tất',
                icon: CheckCircle2,
              },
              {
                label: 'Tỉ lệ hoàn tất luồng',
                value: completionRate,
                suffix: '%',
                sub: `${completedFlow}/${totalFlow} phiếu hoàn tất`,
                icon: BarChart3,
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="rounded-3xl border border-cyan-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-100/50 group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-500">{card.label}</p>
                      <p className="mt-3 text-4xl font-black text-cyan-800">
                        {formatNumber(card.value)}
                        {'suffix' in card ? card.suffix : ''}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-600 transition-colors group-hover:bg-cyan-600 group-hover:text-white">
                      <Icon className="h-7 w-7" />
                    </div>
                  </div>
                  <p className="mt-4 text-sm font-medium text-slate-500">{card.sub}</p>
                </div>
              );
            })}
          </section>

          {/* Detailed Sections */}
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_0.7fr]">
            <div className="rounded-[2rem] border border-cyan-100 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Hiệu suất kho theo dữ liệu thật</h2>
                  <p className="mt-1 text-sm text-slate-500">Tổng hợp tồn kho, phân bổ, khả dụng và cảnh báo hết hàng.</p>
                </div>
                <Link
                  to="/inventory"
                  className="inline-flex items-center justify-center rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-700 shadow-sm"
                >
                  Mở tồn kho
                </Link>
              </div>
              <div className="mt-8 space-y-6">
                {[
                  { label: 'Tổng vật lý', value: overview.inventory.totalPhysical, color: 'from-cyan-700 to-cyan-500' },
                  { label: 'Đã giữ chỗ / phân bổ', value: overview.inventory.allocated, color: 'from-amber-500 to-amber-300' },
                  { label: 'Khả dụng', value: overview.inventory.available, color: 'from-emerald-500 to-emerald-400' },
                ].map((item) => {
                  const maxValue = Math.max(
                    overview.inventory.totalPhysical,
                    overview.inventory.allocated,
                    overview.inventory.available,
                    1,
                  );
                  return (
                    <div key={item.label}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-600">{item.label}</span>
                        <span className="font-black text-slate-800">{formatNumber(item.value)}</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${item.color}`}
                          style={{ width: `${Math.max(2, (item.value / maxValue) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <StatusList title="Trạng thái nhập kho" statuses={overview.inbound.byStatus} />
              <StatusList title="Trạng thái xuất kho" statuses={overview.outbound.byStatus} />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}