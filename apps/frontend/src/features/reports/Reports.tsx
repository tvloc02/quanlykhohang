import React from 'react';
import { Download, Filter } from 'lucide-react';
import Button from '../../shared/components/Button';
import IconButton from '../../shared/components/IconButton';
import { reportsApi } from './api/reportsApi';

type ReportOverview = {
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

const formatNumber = (value: number) => new Intl.NumberFormat('vi-VN').format(value);

function StatusLabel({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-3 text-2xl font-semibold text-slate-900">{formatNumber(value)}</div>
    </div>
  );
}

export default function Reports() {
  const [overview, setOverview] = React.useState<ReportOverview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const loadReports = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = (await reportsApi.getDashboard()) as ReportOverview;
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu báo cáo');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadReports();
  }, [loadReports]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Báo cáo</h1>
          <p className="text-sm text-slate-500">Dữ liệu cập nhật: {updatedAt}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={loadReports} disabled={loading}>
            <Filter size={16} />
            Làm mới
          </Button>
          <Button variant="primary" className="flex items-center gap-2">
            <Download size={18} />
            Xuất báo cáo
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="grid gap-4 lg:grid-cols-2">
          <StatusLabel title="Tài khoản" value={overview?.accessControl.users ?? 0} />
          <StatusLabel title="Vai trò" value={overview?.accessControl.roles ?? 0} />
          <StatusLabel title="Sản phẩm" value={overview?.catalog.products ?? 0} />
          <StatusLabel title="Danh mục" value={overview?.catalog.categories ?? 0} />
          <StatusLabel title="NCC" value={overview?.partners.suppliers ?? 0} />
          <StatusLabel title="Khách hàng" value={overview?.partners.customers ?? 0} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <StatusLabel title="Tồn khả dụng" value={overview?.inventory.available ?? 0} />
          <StatusLabel title="Tồn thực tế" value={overview?.inventory.totalPhysical ?? 0} />
          <StatusLabel title="Đã phân bổ" value={overview?.inventory.allocated ?? 0} />
          <StatusLabel title="Vị trí" value={overview?.inventory.locations ?? 0} />
          <StatusLabel title="Sắp hết" value={overview?.inventory.lowStockItems ?? 0} />
          <StatusLabel title="Barcode" value={overview?.catalog.barcodeMappedProducts ?? 0} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Phiếu nhập</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <StatusLabel title="Tổng phiếu" value={overview?.inbound.totalReceipts ?? 0} />
            <StatusLabel title="Đang xử lý" value={overview?.inbound.openReceipts ?? 0} />
            <StatusLabel title="Hoàn thành" value={overview?.inbound.completedReceipts ?? 0} />
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Phiếu xuất</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <StatusLabel title="Tổng đơn" value={overview?.outbound.totalOrders ?? 0} />
            <StatusLabel title="Đơn mở" value={overview?.outbound.openOrders ?? 0} />
            <StatusLabel title="Hoàn thành" value={overview?.outbound.completedOrders ?? 0} />
            <StatusLabel title="Picking" value={overview?.outbound.openPickingTasks ?? 0} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Trạng thái nhập kho</h2>
          {overview ? (
            <div className="mt-5 space-y-3">
              {Object.entries(overview.inbound.byStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="font-medium text-slate-700">{status}</span>
                  <span className="text-slate-900">{formatNumber(count)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-slate-500">Đang tải dữ liệu...</div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Trạng thái xuất kho</h2>
          {overview ? (
            <div className="mt-5 space-y-3">
              {Object.entries(overview.outbound.byStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="font-medium text-slate-700">{status}</span>
                  <span className="text-slate-900">{formatNumber(count)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-slate-500">Đang tải dữ liệu...</div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Báo cáo gần đây</h2>
        <p className="mt-4 text-sm text-slate-600">
          Các báo cáo gần đây sẽ được hiển thị chi tiết hơn khi chức năng export/history được triển khai.
        </p>
      </div>
    </div>
  );
}
