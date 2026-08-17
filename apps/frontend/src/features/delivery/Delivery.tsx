import React from 'react';
import { Plus, Search, Filter, Truck, CheckCircle, Clock, AlertCircle, ArrowRight, FileText, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TransferOrderModal from './components/TransferOrderModal';
import InternalShippingNoteModal from './components/InternalShippingNoteModal';
import { deliveryApi, type TransferOrder } from './api/deliveryApi';

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
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('vi-VN');
}

export default function Delivery() {
  const navigate = useNavigate();
  const [orders, setOrders] = React.useState<TransferOrder[]>([]);
  const [search, setSearch] = React.useState('');
  const [pageSize, setPageSize] = React.useState(20);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [showModal, setShowModal] = React.useState(false);
  const [showShippingModal, setShowShippingModal] = React.useState(false);
  const [selectedOrder, setSelectedOrder] = React.useState<TransferOrder | null>(null);
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
  }, [search, pageSize]);

  const filteredOrders = orders.filter((order) => {
    const q = search.trim().toLowerCase();
    return (
      !q ||
      order.transferNo.toLowerCase().includes(q) ||
      (order.requestNumber || '').toLowerCase().includes(q) ||
      (order.sourceWarehouse || '').toLowerCase().includes(q) ||
      (order.destinationWarehouse || '').toLowerCase().includes(q)
    );
  });

  const total = orders.length;
  const pending = orders.filter((order) => order.status === 'PENDING').length;
  const moving = orders.filter((order) => order.status === 'IN_TRANSIT').length;
  const done = orders.filter((order) => order.status === 'DELIVERED').length;

  const totalItems = filteredOrders.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-md">
            <Truck className="h-5 w-5 text-cyan-100" />
            <h1 className="text-lg font-bold tracking-tight text-white">Quản Lý Xuất Kho Nội Bộ</h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setSelectedOrder(null);
              setShowShippingModal(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-500 bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-emerald-700"
          >
            <FileText className="h-4 w-4" />
            In phiếu xuất kho nội bộ
          </button>
          <button
            type="button"
            onClick={() => navigate('/delivery/create-transfer-order')}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Lập phiếu xuất kho nội bộ
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">{total} TỔNG PHIẾU</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">{pending} CHỜ XỬ LÝ</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">{moving} ĐANG VẬN CHUYỂN</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">{done} HOÀN THÀNH</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm kiếm phiếu xuất kho nội bộ..."
            className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
          />
        </div>
        <button
          type="button"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-bold text-cyan-600 transition hover:bg-cyan-50 shadow-sm"
        >
          <Filter className="h-4 w-4" />
          Lọc nâng cao
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse bg-white">
            <thead className="bg-cyan-50">
              <tr className="border-b border-slate-200">
                <th className="w-16 border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">STT</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Số phiếu</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Số yêu cầu</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Kho cần chuyển</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Kho nhận</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Ngày lập</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Trạng thái</th>
                <th className="sticky right-0 w-32 border-x border-slate-200 bg-cyan-50 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white font-medium">
              {paginatedOrders.length > 0 ? (
                paginatedOrders.map((order, index) => (
                  <tr key={order.id} className="group border-b border-slate-200 transition hover:bg-cyan-50/50">
                    <td className="border-x border-slate-200 px-3 py-3.5 text-center text-xs font-semibold text-slate-700">{startIndex + index}</td>
                    <td className="border-x border-slate-200 px-3 py-3.5 text-center text-xs font-bold text-cyan-900">{order.transferNo}</td>
                    <td className="border-x border-slate-200 px-3 py-3.5 text-center text-xs font-semibold text-slate-700">{order.requestNumber || '-'}</td>
                    <td className="border-x border-slate-200 px-3 py-3.5 text-center text-xs font-semibold text-slate-700">{order.sourceWarehouse}</td>
                    <td className="border-x border-slate-200 px-3 py-3.5 text-center text-xs font-semibold text-slate-700">{order.destinationWarehouse}</td>
                    <td className="border-x border-slate-200 px-3 py-3.5 text-center text-xs font-semibold text-slate-700">{formatDateTime(order.createdAt)}</td>
                    <td className="border-x border-slate-200 px-3 py-3.5 text-center align-middle">
                      <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-xs font-bold ${statusConfig[order.status]?.color || ''}`}>
                        {statusConfig[order.status]?.label || order.status}
                      </span>
                    </td>
                    <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-3.5 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => navigate('/delivery/create-transfer-order', { state: { editOrderData: order } })}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-cyan-500 bg-white text-cyan-600 shadow-xs transition hover:bg-cyan-50 cursor-pointer"
                          title="Chỉnh sửa phiếu điều chuyển"
                        >
                          <Pencil className="h-3.5 w-3.5 text-cyan-600" strokeWidth={2.2} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowShippingModal(true);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-emerald-500 bg-white text-emerald-600 shadow-xs transition hover:bg-emerald-50 cursor-pointer"
                          title="In / Xem phiếu điều chuyển"
                        >
                          <FileText className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : null}

              {/* Lớp kẻ dòng ô vuông bảng trống đủ 10 dòng tiêu chuẩn */}
              {Array.from({ length: Math.max(0, 10 - paginatedOrders.length) }).map((_, idx) => (
                <tr key={`empty-delivery-${idx}`} className={`h-11 ${paginatedOrders.length === 0 && idx === 3 ? 'bg-slate-50/50' : ''}`}>
                  <td className="border-x border-b border-slate-200 px-3 py-3 text-center text-slate-300 font-mono text-[11px]">
                    {paginatedOrders.length + idx + 1}
                  </td>
                  <td className="border-x border-b border-slate-200 px-3 py-3 text-center text-slate-400 text-xs italic" colSpan={6}>
                    {paginatedOrders.length === 0 && idx === 3 ? 'Chưa có phiếu xuất kho nội bộ. Hãy bấm nút "Lập phiếu xuất kho nội bộ" để bắt đầu.' : ''}
                  </td>
                  <td className="sticky right-0 border-l border-b border-slate-200 bg-white px-3 py-3"></td>
                </tr>
              ))}
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
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold shadow-sm ${page === currentPage
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
            <Clock className="h-4 w-4" />
          </button>
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
