import React from 'react';
import {
  PlusCircle,
  Search,
  Filter,
  Truck,
  CheckCircle2,
  Clock,
  FileText,
  Pencil,
  Trash2,
  Calendar,
  CalendarDays,
  RefreshCw,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  X,
  XCircle,
  Phone,
  Car
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TransferOrderModal from './components/TransferOrderModal';
import InternalShippingNoteModal from './components/InternalShippingNoteModal';
import { deliveryApi, type TransferOrder, type TransferOrderStatus } from './api/deliveryApi';

const statusConfig: Record<string, { color: string; label: string }> = {
  DRAFT: { color: 'border-slate-200 bg-slate-50 text-slate-700', label: 'Nháp' },
  PENDING: { color: 'border-amber-200 bg-amber-50 text-amber-700', label: 'Chờ duyệt' },
  APPROVED: { color: 'border-cyan-200 bg-cyan-50 text-cyan-700', label: 'Đã duyệt' },
  IN_TRANSIT: { color: 'border-blue-200 bg-blue-50 text-blue-700', label: 'Đang điều chuyển' },
  DELIVERED: { color: 'border-emerald-200 bg-emerald-50 text-emerald-700', label: 'Hoàn thành' },
  CANCELLED: { color: 'border-red-200 bg-red-50 text-red-700', label: 'Đã hủy' },
};

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

type TimeFilter = 'this-month' | '7-days' | 'all';
type StatusFilter = 'all' | TransferOrderStatus;

export default function Delivery() {
  const navigate = useNavigate();
  const [orders, setOrders] = React.useState<TransferOrder[]>([]);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [timeFilter, setTimeFilter] = React.useState<TimeFilter>('this-month');
  const [pageSize, setPageSize] = React.useState(20);
  const [currentPage, setCurrentPage] = React.useState(1);

  const [showModal, setShowModal] = React.useState(false);
  const [showShippingModal, setShowShippingModal] = React.useState(false);
  const [selectedOrder, setSelectedOrder] = React.useState<TransferOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<TransferOrder | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [toast, setToast] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadOrders = React.useCallback(async () => {
    try {
      const data = await deliveryApi.listTransferOrders();
      setOrders(data);
    } catch (error) {
      console.error(error);
      setToast({ type: 'error', message: 'Không tải được phiếu điều chuyển' });
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
  }, [search, statusFilter, timeFilter]);

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setTimeFilter('this-month');
  };

  const handleDeleteOrder = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deliveryApi.deleteTransferOrder(deleteTarget.id);
      setToast({ type: 'success', message: `Đã xóa phiếu điều chuyển ${deleteTarget.transferNo}` });
      setDeleteTarget(null);
      await loadOrders();
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Lỗi khi xóa phiếu điều chuyển' });
    } finally {
      setDeleting(false);
    }
  };

  const filteredOrders = React.useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const now = new Date();

    return orders.filter((order) => {
      const matchesKeyword =
        !keyword ||
        order.transferNo.toLowerCase().includes(keyword) ||
        (order.requestNumber || '').toLowerCase().includes(keyword) ||
        (order.sourceWarehouse || '').toLowerCase().includes(keyword) ||
        (order.destinationWarehouse || '').toLowerCase().includes(keyword) ||
        (order.driverName || '').toLowerCase().includes(keyword) ||
        (order.driverPhone || '').toLowerCase().includes(keyword) ||
        (order.vehiclePlate || '').toLowerCase().includes(keyword) ||
        (order.createdBy || '').toLowerCase().includes(keyword) ||
        (order.note || '').toLowerCase().includes(keyword) ||
        (order.items || []).some((item) =>
          (item.productName || '').toLowerCase().includes(keyword) ||
          (item.productCode || '').toLowerCase().includes(keyword)
        );

      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

      let matchesTime = true;
      if (timeFilter !== 'all') {
        const orderDate = order.createdAt ? new Date(order.createdAt) : null;
        if (!orderDate || Number.isNaN(orderDate.getTime())) {
          matchesTime = false;
        } else if (timeFilter === 'this-month') {
          matchesTime = orderDate.getFullYear() === now.getFullYear() && orderDate.getMonth() === now.getMonth();
        } else if (timeFilter === '7-days') {
          matchesTime = now.getTime() - orderDate.getTime() <= 7 * 24 * 60 * 60 * 1000;
        }
      }

      return matchesKeyword && matchesStatus && matchesTime;
    });
  }, [orders, search, statusFilter, timeFilter]);

  const total = orders.length;
  const pendingCount = orders.filter((order) => order.status === 'PENDING' || order.status === 'DRAFT').length;
  const movingCount = orders.filter((order) => order.status === 'IN_TRANSIT' || order.status === 'APPROVED').length;
  const doneCount = orders.filter((order) => order.status === 'DELIVERED').length;

  const totalItems = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-6">
      {/* Toast alert */}
      {toast && (
        <div className={`fixed right-4 top-4 z-[9999] flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-xl ${toast.type === 'error' ? 'border-red-200 text-red-600' : 'border-emerald-200 text-emerald-600'}`}>
          {toast.type === 'error' ? <XCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          <p className="text-sm font-bold">{toast.message}</p>
          <button type="button" onClick={() => setToast(null)} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header Banner & Action Buttons */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-md">
            <Truck className="h-5 w-5 text-cyan-100" />
            <h1 className="text-lg font-bold tracking-tight text-white">Quản Lý Xuất Kho Nội Bộ</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setSelectedOrder(null);
              setShowShippingModal(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 cursor-pointer"
          >
            <FileText className="h-4 w-4" />
            In phiếu xuất kho nội bộ
          </button>
          <button
            type="button"
            onClick={() => navigate('/delivery/create-transfer-order')}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            Lập phiếu xuất kho nội bộ
          </button>
        </div>
      </div>

      {/* 4 Summary Stat Boxes */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">{total} TỔNG PHIẾU</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">{pendingCount} CHỜ XỬ LÝ</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">{movingCount} ĐANG VẬN CHUYỂN</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">{doneCount} HOÀN THÀNH</p>
        </div>
      </div>

      {/* Filter & Search Panel */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Search input (h-12) */}
          <div className="relative flex-1 min-w-[320px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-cyan-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-12 w-full rounded-xl border-2 border-cyan-600/40 bg-white pl-11 pr-4 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-2xs"
              placeholder="Tìm theo số phiếu, kho chuyển/nhận, tài xế, SĐT, biển số xe, diễn giải..."
            />
          </div>

          {/* Date & Status Filters Container */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Time Filter Box (h-12) */}
            <div className="inline-flex h-12 items-center gap-2 rounded-xl border-2 border-cyan-600/30 bg-slate-50/80 px-3.5 shadow-2xs">
              <Calendar className="h-4.5 w-4.5 text-cyan-600 shrink-0" />
              <span className="text-xs font-extrabold uppercase text-cyan-950 tracking-wide whitespace-nowrap">Thời gian:</span>
              <select
                value={timeFilter}
                onChange={(event) => setTimeFilter(event.target.value as TimeFilter)}
                className="h-9 rounded-lg border-2 border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
              >
                <option value="this-month">Tháng này</option>
                <option value="7-days">7 ngày gần đây</option>
                <option value="all">Tất cả</option>
              </select>
            </div>

            {/* Status Filter Box (h-12) */}
            <div className="inline-flex h-12 items-center gap-2 rounded-xl border-2 border-cyan-600/30 bg-slate-50/80 px-3.5 shadow-2xs">
              <Filter className="h-4 w-4 text-cyan-600 shrink-0" />
              <span className="text-xs font-extrabold uppercase text-cyan-950 tracking-wide whitespace-nowrap">Trạng thái:</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="h-9 rounded-lg border-2 border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
              >
                <option value="all">Tất cả</option>
                <option value="DRAFT">Nháp</option>
                <option value="PENDING">Chờ duyệt</option>
                <option value="APPROVED">Đã duyệt</option>
                <option value="IN_TRANSIT">Đang điều chuyển</option>
                <option value="DELIVERED">Hoàn thành</option>
                <option value="CANCELLED">Đã hủy</option>
              </select>
            </div>

            {/* Reset Filter Button (h-12) */}
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-12 w-12 items-center justify-center rounded-xl border-2 border-cyan-700 bg-white text-cyan-700 shadow-2xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
              title="Đặt lại bộ lọc"
            >
              <RefreshCw className="h-4.5 w-4.5 text-cyan-700" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Transfer Orders Table with horizontal scroll support */}
      <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[1750px] border-collapse text-left">
            <thead className="bg-cyan-50 sticky top-0 z-20 shadow-sm">
              <tr className="border-b-2 border-slate-200 text-slate-800 font-extrabold uppercase text-xs sm:text-sm tracking-wider whitespace-nowrap">
                <th className="w-12 min-w-[50px] border-r border-slate-200 px-2 py-4 text-center whitespace-nowrap">
                  <input type="checkbox" className="h-4.5 w-4.5 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer" />
                </th>
                <th className="w-14 min-w-[60px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">STT</th>
                <th className="min-w-[150px] border-r border-slate-200 px-4 py-4 text-center whitespace-nowrap">Số phiếu</th>
                <th className="min-w-[130px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Số yêu cầu</th>
                <th className="min-w-[160px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Kho chuyển</th>
                <th className="min-w-[160px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Kho nhận</th>
                <th className="min-w-[170px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Ngày chuyển</th>
                <th className="min-w-[170px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Ngày nhận</th>
                <th className="min-w-[200px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Tài xế & SĐT</th>
                <th className="min-w-[130px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Biển số xe</th>
                <th className="min-w-[160px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Người phụ trách</th>
                <th className="min-w-[110px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Tổng SL</th>
                <th className="min-w-[170px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Ngày lập</th>
                <th className="min-w-[150px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Trạng thái</th>
                <th className="sticky right-0 top-0 z-30 w-36 min-w-[140px] bg-cyan-100 px-3 py-4 text-center shadow-[-4px_0_12px_rgba(0,0,0,0.05)] border-l border-slate-200 text-cyan-950 font-black whitespace-nowrap">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white font-medium">
              {paginatedOrders.length > 0 ? (
                paginatedOrders.map((order, index) => (
                  <tr
                    key={order.id}
                    className="group border-b border-slate-200 transition hover:bg-cyan-50/60"
                  >
                    <td className="border-r border-slate-200 px-2 py-3.5 text-center">
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer" />
                    </td>
                    <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-medium text-slate-700">
                      {startIndex + index}
                    </td>
                    <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-extrabold text-cyan-700">
                      {order.transferNo}
                    </td>
                    <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-semibold text-slate-700">
                      {order.requestNumber || order.requestId || '-'}
                    </td>
                    <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-bold text-slate-800">
                      {order.sourceWarehouse}
                    </td>
                    <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-bold text-slate-800">
                      {order.destinationWarehouse}
                    </td>
                    <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-semibold text-slate-700">
                      <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                        <Clock className="h-4 w-4 text-cyan-600 shrink-0" />
                        {formatDateTime(order.dispatchDate || order.scheduledDate)}
                      </span>
                    </td>
                    <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-semibold text-slate-700">
                      <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                        <CalendarDays className="h-4 w-4 text-cyan-600 shrink-0" />
                        {formatDateTime(order.receiveDate)}
                      </span>
                    </td>
                    <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-semibold text-slate-800">
                      {order.driverName ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-extrabold text-slate-900">{order.driverName}</span>
                          {order.driverPhone && (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-semibold whitespace-nowrap">
                              <Phone className="h-3 w-3 text-cyan-600" />
                              {order.driverPhone}
                            </span>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-black text-slate-900 uppercase">
                      {order.vehiclePlate ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 border border-slate-300 whitespace-nowrap">
                          <Car className="h-3.5 w-3.5 text-slate-600" />
                          {order.vehiclePlate}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-semibold text-slate-700">
                      {order.createdBy || '-'}
                    </td>
                    <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-extrabold text-slate-900">
                      {order.totalQuantity || order.itemCount || 0}
                    </td>
                    <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-semibold text-slate-700">
                      {formatDateTime(order.createdAt)}
                    </td>
                    <td className="border-r border-slate-200 px-3 py-3.5 text-center align-middle">
                      <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-extrabold whitespace-nowrap ${statusConfig[order.status]?.color || 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                        {statusConfig[order.status]?.label || order.status}
                      </span>
                    </td>
                    <td className="sticky right-0 z-10 w-36 min-w-[140px] bg-white group-hover:bg-cyan-50/90 px-3 py-3.5 text-center shadow-[-4px_0_12px_rgba(0,0,0,0.05)] border-l border-slate-200">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => navigate('/delivery/create-transfer-order', { state: { editOrderData: order } })}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-700 bg-white text-cyan-700 shadow-2xs transition hover:bg-cyan-50 cursor-pointer"
                          title="Chỉnh sửa phiếu điều chuyển"
                        >
                          <Pencil className="h-4 w-4 text-cyan-700" strokeWidth={2.2} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowShippingModal(true);
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-700 bg-white text-cyan-700 shadow-2xs transition hover:bg-cyan-50 cursor-pointer"
                          title="In / Xem phiếu điều chuyển"
                        >
                          <FileText className="h-4 w-4 text-cyan-700" strokeWidth={2.2} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(order)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-red-600 bg-white text-red-600 shadow-2xs transition hover:bg-red-50 cursor-pointer"
                          title="Xóa phiếu điều chuyển"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" strokeWidth={2.2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-500 font-semibold text-sm">
                    Chưa có phiếu xuất kho nội bộ. Hãy bấm nút "Lập phiếu xuất kho nội bộ" để bắt đầu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t-2 border-slate-200 bg-slate-50/90 px-4 py-3.5 text-sm font-bold text-slate-700">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-slate-700">Hiển thị:</span>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setCurrentPage(1);
                }}
                className="h-9 rounded-xl border-2 border-slate-300 bg-white px-3 text-sm font-black text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer shadow-xs"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
              </select>
              <span className="text-sm font-bold text-slate-600">dòng/trang</span>
            </div>
            <div className="border-l-2 border-slate-300 pl-3 text-sm font-semibold text-slate-600">
              Hiển thị <span className="font-extrabold text-slate-900">{totalItems > 0 ? startIndex : 0}</span> -{' '}
              <span className="font-extrabold text-slate-900">{endIndex}</span> trên tổng <span className="font-black text-cyan-800">{totalItems}</span> phiếu xuất
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm font-bold">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-slate-700 hover:bg-cyan-50 hover:border-cyan-600 hover:text-cyan-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-slate-300 disabled:hover:text-slate-700 transition cursor-pointer shadow-2xs"
              title="Trang đầu"
            >
              <ChevronsLeft size={18} strokeWidth={2.5} />
            </button>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-slate-700 hover:bg-cyan-50 hover:border-cyan-600 hover:text-cyan-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-slate-300 disabled:hover:text-slate-700 transition cursor-pointer shadow-2xs"
              title="Trang trước"
            >
              <ChevronLeft size={18} strokeWidth={2.5} />
            </button>
            <span className="px-2 text-sm font-extrabold text-slate-800">
              Trang <span className="text-cyan-700 font-black">{currentPage}</span> / {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-slate-700 hover:bg-cyan-50 hover:border-cyan-600 hover:text-cyan-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-slate-300 disabled:hover:text-slate-700 transition cursor-pointer shadow-2xs"
              title="Trang tiếp"
            >
              <ChevronRight size={18} strokeWidth={2.5} />
            </button>
            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(totalPages)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-slate-700 hover:bg-cyan-50 hover:border-cyan-600 hover:text-cyan-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-slate-300 disabled:hover:text-slate-700 transition cursor-pointer shadow-2xs"
              title="Trang cuối"
            >
              <ChevronsRight size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="rounded-xl bg-red-100 p-2 text-red-600">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Xóa phiếu xuất kho nội bộ</h3>
            </div>
            <p className="text-sm font-semibold text-slate-600">
              Bạn có chắc chắn muốn xóa phiếu xuất kho nội bộ <span className="font-extrabold text-slate-900">{deleteTarget.transferNo}</span> không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleDeleteOrder}
                disabled={deleting}
                className="rounded-xl bg-red-600 px-5 py-2 text-sm font-bold text-white shadow-md transition hover:bg-red-700 cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      <TransferOrderModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSaved={loadOrders}
        setToast={(nextToast) => setToast(nextToast)}
      />

      <InternalShippingNoteModal
        open={showShippingModal}
        onClose={() => {
          setShowShippingModal(false);
          setSelectedOrder(null);
        }}
        initialData={
          selectedOrder
            ? {
              commandNo: `12/LDD-${selectedOrder.transferNo || 'KTTU'}`,
              sourceAddress: selectedOrder.sourceWarehouse || 'Kho tổng Hà Nội',
              receiverName: selectedOrder.createdBy || 'Nguyễn Thị Mai',
              destinationAddress: selectedOrder.destinationWarehouse || 'Kho chi nhánh TP.HCM',
              items: selectedOrder.items && selectedOrder.items.length > 0
                ? selectedOrder.items.map((item, idx) => ({
                  id: item.id || String(idx + 1),
                  productName: item.productName || 'Sản phẩm điều chuyển',
                  productCode: item.productCode || 'SKU-001',
                  unit: item.unit || 'Cái',
                  quantityExported: Number(item.quantity) || 1,
                  quantityImported: Number(item.quantity) || 1,
                  price: 10000000,
                }))
                : undefined,
            }
            : undefined
        }
        setToast={setToast}
      />
    </div>
  );
}
