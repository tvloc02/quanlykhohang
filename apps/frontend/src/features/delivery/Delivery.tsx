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
      color: 'bg-yellow-50 text-yellow-700',
      label: 'Chờ giao hàng',
      icon: Clock,
    },
    in_transit: {
      color: 'bg-cyan-50 text-cyan-700',
      label: 'Đang giao',
      icon: Truck,
    },
    delivered: {
      color: 'bg-cyan-50 text-cyan-700',
      label: 'Đã giao',
      icon: CheckCircle,
    },
    cancelled: {
      color: 'bg-red-50 text-red-700',
      label: 'Hủy',
      icon: AlertCircle,
    },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Điều chuyển</h1>
          <p className="text-sm text-gray-500">Quản lý luồng điều chuyển hàng giữa các kho và khoáy số liệu tồn.</p>
        </div>
        <Button variant="primary" className="flex items-center gap-2" onClick={() => navigate('/delivery/create-transfer-order')}>
          <Plus size={18} />
          Lập phiếu điều chuyển
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl bg-cyan-600 p-4 shadow-lg text-white">
          <p className="text-sm uppercase tracking-wide">Tổng phiếu</p>
          <p className="mt-3 text-3xl font-black">0</p>
        </div>
        <div className="rounded-xl bg-cyan-600 p-4 shadow-lg text-white">
          <p className="text-sm uppercase tracking-wide">Chờ xử lý</p>
          <p className="mt-3 text-3xl font-black">0</p>
        </div>
        <div className="rounded-xl bg-cyan-600 p-4 shadow-lg text-white">
          <p className="text-sm uppercase tracking-wide">Đang điều chuyển</p>
          <p className="mt-3 text-3xl font-black">0</p>
        </div>
        <div className="rounded-xl bg-cyan-600 p-4 shadow-lg text-white">
          <p className="text-sm uppercase tracking-wide">Hoàn thành</p>
          <p className="mt-3 text-3xl font-black">0</p>
        </div>
      </div>

      <div className="bg-white rounded-lg p-4 border border-gray-100 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Tìm kiếm điều chuyển..."
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            disabled
          />
        </div>
        <Button variant="white" className="w-full sm:w-auto p-2 flex items-center gap-2" disabled>
          <Filter size={18} className="text-gray-600" />
          <span className="text-sm text-gray-600">Lọc</span>
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
        <p className="text-lg font-semibold text-slate-900">Chưa có dữ liệu điều chuyển</p>
        <p className="mt-2 text-sm">Hãy tạo phiếu điều chuyển mới hoặc liên kết từ yêu cầu điều chuyển để theo dõi luồng hàng hóa.</p>
      </div>
    </div>
  );
}
