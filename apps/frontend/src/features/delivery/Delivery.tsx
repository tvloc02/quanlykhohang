import React from 'react';
import { Plus, Search, Filter, Eye, Truck, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import Button from '../../shared/components/Button';
import IconButton from '../../shared/components/IconButton';

interface Delivery {
  id: string;
  deliveryNo: string;
  orderNo: string;
  customer: string;
  driver: string;
  vehicle: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'cancelled';
  scheduledDate: string;
  deliveredDate?: string;
  amount: number;
}

export default function Delivery() {
  const [deliveries] = React.useState<Delivery[]>([
    {
      id: '1',
      deliveryNo: 'DEL-2025-001',
      orderNo: 'SO-2025-001',
      customer: 'Khách hàng A',
      driver: 'Nguyễn Văn A',
      vehicle: 'BKS 29A-12345',
      status: 'in_transit',
      scheduledDate: '2026-06-20',
      amount: 5000000,
    },
    {
      id: '2',
      deliveryNo: 'DEL-2025-002',
      orderNo: 'SO-2025-002',
      customer: 'Khách hàng B',
      driver: 'Trần Văn B',
      vehicle: 'BKS 29A-54321',
      status: 'delivered',
      scheduledDate: '2026-06-18',
      deliveredDate: '2026-06-18',
      amount: 8000000,
    },
    {
      id: '3',
      deliveryNo: 'DEL-2025-003',
      orderNo: 'SO-2025-003',
      customer: 'Khách hàng C',
      driver: 'Lê Văn C',
      vehicle: 'BKS 29A-99999',
      status: 'pending',
      scheduledDate: '2026-06-22',
      amount: 3500000,
    },
  ]);

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Quản lý giao hàng</h1>
        <Button variant="primary" className="flex items-center gap-2">
          <Plus size={18} />
          Tạo đơn giao
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Chờ giao', value: '1', color: 'bg-yellow-50' },
          { label: 'Đang giao', value: '1', color: 'bg-cyan-50' },
          { label: 'Đã giao', value: '1', color: 'bg-cyan-50' },
          { label: 'Tổng', value: '3', color: 'bg-purple-50' },
        ].map((card, idx) => (
          <div key={idx} className={`${card.color} rounded-lg p-4 border border-gray-100`}>
            <p className="text-gray-600 text-sm font-medium">{card.label}</p>
            <p className="text-2xl font-bold text-primary mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 border border-gray-100 flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Tìm kiếm đơn giao..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <Button variant="white" className="p-2 flex items-center gap-2">
          <Filter size={18} className="text-gray-600" />
          <span className="text-sm text-gray-600">Lọc</span>
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead className="bg-accent border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Mã giao</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Mã SO</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Khách hàng</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Tài xế</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Phương tiện</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Trạng thái</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Ngày dự định</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Giá trị</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {deliveries.map((delivery) => {
              const config = statusConfig[delivery.status];
              const StatusIcon = config.icon;

              return (
                <tr key={delivery.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 text-sm font-medium text-primary">{delivery.deliveryNo}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{delivery.orderNo}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{delivery.customer}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{delivery.driver}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{delivery.vehicle}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${config.color}`}>
                      <StatusIcon size={14} />
                      {config.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{delivery.scheduledDate}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {(delivery.amount / 1000000).toFixed(1)}M ₫
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <IconButton className="text-cyan-500 hover:bg-cyan-50" aria-label="view">
                      <Eye size={16} />
                    </IconButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
