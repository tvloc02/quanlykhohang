import React from 'react';
import { Clock3, Filter, PlusCircle, Search, Trash2, Truck } from 'lucide-react';
import TransferOrderModal from '../components/TransferOrderModal';
import { deliveryApi, type TransferOrder } from '../api/deliveryApi';

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('vi-VN');
}

const statusMap: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Nháp', className: 'border-slate-200 bg-slate-100 text-slate-700' },
  PENDING: { label: 'Chờ duyệt', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  APPROVED: { label: 'Đã duyệt', className: 'border-cyan-200 bg-cyan-50 text-cyan-700' },
  IN_TRANSIT: { label: 'Đang điều chuyển', className: 'border-blue-200 bg-blue-50 text-blue-700' },
  DELIVERED: { label: 'Hoàn thành', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  CANCELLED: { label: 'Đã hủy', className: 'border-red-200 bg-red-50 text-red-700' },
};

export default function CreateTransferOrderPage() {
  const [orders, setOrders] = React.useState<TransferOrder[]>([]);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | TransferOrder['status']>('all');
  const [pageSize, setPageSize] = React.useState(20);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [showModal, setShowModal] = React.useState(false);
  const [toast, setToast] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadOrders = React.useCallback(async () => {
    try {
      const data = await deliveryApi.listTransferOrders();
      setOrders(data);
    } catch (error) {
      console.error(error);
      setToast({ type: 'error', message: 'Không tải được danh sách phiếu điều chuyển' });
    }
  }, []);

  React.useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  React.useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, pageSize]);

  const filteredOrders = orders.filter((order) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      order.transferNo.toLowerCase().includes(query) ||
      (order.requestNumber || '').toLowerCase().includes(query) ||
      (order.sourceWarehouse || '').toLowerCase().includes(query) ||
      (order.destinationWarehouse || '').toLowerCase().includes(query) ||
      (order.createdBy || '').toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalItems = filteredOrders.length;
  const draftCount = orders.filter((order) => order.status === 'DRAFT').length;
  const approvedCount = orders.filter((order) => order.status === 'APPROVED').length;
  const doneCount = orders.filter((order) => order.status === 'DELIVERED').length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa phiếu điều chuyển này?')) return;
    try {
      await deliveryApi.deleteTransferOrder(id);
      setToast({ type: 'success', message: 'Đã xóa phiếu điều chuyển' });
      await loadOrders();
    } catch (error: any) {
      setToast({ type: 'error', message: error?.message || 'Không thể xóa phiếu điều chuyển' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-md">
            <Truck className="h-5 w-5 text-cyan-100" />
            <h1 className="text-lg font-bold tracking-tight text-white">Phiếu điều chuyển</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700"
        >
          <PlusCircle className="h-4 w-4" />
          Tạo phiếu điều chuyển
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">{totalItems} TỔNG PHIẾU</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">{draftCount} NHÁP</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">{approvedCount} ĐÃ DUYỆT</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">{doneCount} HOÀN THÀNH</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
            placeholder="Tìm theo số phiếu, số yêu cầu, kho, người lập..."
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 px-4 text-sm font-bold transition shadow-sm ${
              statusFilter === 'all'
                ? 'border-cyan-500 bg-cyan-50 text-cyan-600'
                : 'border-cyan-500 bg-white text-cyan-600 hover:bg-cyan-50'
            }`}
          >
            <Filter className="h-4 w-4" />
            Tất cả
          </button>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="h-11 rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
          >
            <option value="all">Trạng thái: Tất cả</option>
            <option value="DRAFT">Trạng thái: Nháp</option>
            <option value="PENDING">Trạng thái: Chờ duyệt</option>
            <option value="APPROVED">Trạng thái: Đã duyệt</option>
            <option value="IN_TRANSIT">Trạng thái: Đang điều chuyển</option>
            <option value="DELIVERED">Trạng thái: Hoàn thành</option>
            <option value="CANCELLED">Trạng thái: Đã hủy</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse bg-white">
            <thead className="bg-cyan-50">
              <tr className="border-b border-slate-200">
                <th className="w-16 border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">STT</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Số phiếu</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Số yêu cầu</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Kho xuất</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Kho nhập</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Ngày lập</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Trạng thái</th>
                <th className="sticky right-0 w-24 border-l border-slate-200 bg-cyan-50 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    <p className="mb-1 text-base font-bold text-slate-800">Chưa có phiếu điều chuyển</p>
                    Hãy tạo phiếu mới bằng popup để bắt đầu quản lý điều chuyển.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order, index) => (
                  <tr key={order.id} className="group border-b border-slate-200 transition hover:bg-cyan-50/50">
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{startIndex + index}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{order.transferNo}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{order.requestNumber || '-'}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{order.sourceWarehouse}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{order.destinationWarehouse}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{formatDateTime(order.createdAt)}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                      <span className={`inline-flex rounded-lg border px-3 py-1 text-xs font-bold ${statusMap[order.status]?.className || 'border-slate-200 bg-slate-100 text-slate-700'}`}>
                        {statusMap[order.status]?.label || order.status}
                      </span>
                    </td>
                    <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-4 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDelete(order.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50"
                          title="Xóa phiếu"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 bg-slate-50/60 px-6 py-3 sm:flex-row">
          <div className="text-sm font-medium text-slate-600">
            Tổng số: <b className="font-bold text-slate-900">{totalItems}</b>{' '}
            {totalItems > 0 && (
              <span className="ml-2 text-slate-500">
                Hiển thị {startIndex} - {endIndex}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setCurrentPage(1);
              }}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                «
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .slice(Math.max(0, currentPage - 2), Math.min(totalPages, currentPage + 1))
                .map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold shadow-sm ${
                      page === currentPage
                        ? 'bg-cyan-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ›
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages || totalPages === 0}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                »
              </button>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className={`fixed right-4 top-4 z-[70] flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-xl ${toast.type === 'error' ? 'border-red-200 text-red-600' : 'border-emerald-200 text-emerald-600'}`}>
          <p className="text-sm font-bold">{toast.message}</p>
          <button type="button" onClick={() => setToast(null)} className="rounded-lg p-1 hover:bg-slate-100">
            <Clock3 className="h-4 w-4" />
          </button>
        </div>
      )}

      <TransferOrderModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSaved={loadOrders}
        setToast={(nextToast) => setToast(nextToast)}
      />
    </div>
  );
}
