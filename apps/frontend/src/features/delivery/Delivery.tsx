import React from 'react';
import { Plus, Search, Filter, Eye, Truck, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../shared/components/Button';
import IconButton from '../../shared/components/IconButton';

interface Delivery {
  id: string;
  transferNo: string;
  requestNo: string;
  sourceWarehouse: string;
  destinationWarehouse: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'cancelled';
  scheduledDate: string;
  amount: number;
}

export default function Delivery() {
  const navigate = useNavigate();
  const [deliveries] = React.useState<Delivery[]>([]);

  const statusConfig = {
    pending: {
      color: 'border-amber-200 bg-amber-50 text-amber-700',
      label: 'Chờ giao hàng',
      icon: Clock,
    },
    in_transit: {
      color: 'border-cyan-200 bg-cyan-50 text-cyan-700',
      label: 'Đang giao',
      icon: Truck,
    },
    delivered: {
      color: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      label: 'Đã giao',
      icon: CheckCircle,
    },
    cancelled: {
      color: 'border-red-200 bg-red-50 text-red-700',
      label: 'Hủy',
      icon: AlertCircle,
    },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-md">
            <Truck className="h-5 w-5 text-cyan-100" />
            <h1 className="text-lg font-bold tracking-tight text-white">Quản Lý Điều Chuyển</h1>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-500">Quản lý luồng điều chuyển hàng giữa các kho và khoáy số liệu tồn.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/delivery/create-transfer-order')}
          className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700"
        >
          <Plus className="h-4 w-4" />
          Lập phiếu điều chuyển
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-sm font-bold text-cyan-700 uppercase leading-tight text-center">{deliveries.length}<br/>TỔNG PHIẾU</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-sm font-bold text-cyan-700 uppercase leading-tight text-center">{deliveries.filter((d) => d.status === 'pending').length}<br/>CHỜ XỬ LÝ</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-sm font-bold text-cyan-700 uppercase leading-tight text-center">{deliveries.filter((d) => d.status === 'in_transit').length}<br/>ĐANG ĐIỀU CHUYỂN</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-sm font-bold text-cyan-700 uppercase leading-tight text-center">{deliveries.filter((d) => d.status === 'delivered').length}<br/>HOÀN THÀNH</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500" />
          <input
            type="text"
            placeholder="Tìm kiếm phiếu điều chuyển kho..."
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
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Kho xuất</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Kho nhập</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Ngày dự kiến</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Trạng thái</th>
                <th className="sticky right-0 w-32 border-l border-slate-200 bg-cyan-50 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    <p className="text-base font-bold text-slate-800 mb-1">Chưa có dữ liệu điều chuyển</p>
                    Hãy tạo phiếu điều chuyển mới hoặc liên kết từ yêu cầu điều chuyển để theo dõi luồng hàng hóa.
                  </td>
                </tr>
              ) : (
                deliveries.map((delivery, index) => (
                  <tr key={delivery.id} className="group border-b border-slate-200 transition hover:bg-slate-50">
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-600">{index + 1}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-bold text-slate-900">{delivery.transferNo}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-600">{delivery.requestNo}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-600">{delivery.sourceWarehouse}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-600">{delivery.destinationWarehouse}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-600">{delivery.scheduledDate}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                      <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-bold ${statusConfig[delivery.status]?.color || ''}`}>
                        {statusConfig[delivery.status]?.label || delivery.status}
                      </span>
                    </td>
                    <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-4 text-center align-middle group-hover:bg-slate-50">
                      <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 transition hover:bg-cyan-50"
                        title="Xem chi tiết"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
