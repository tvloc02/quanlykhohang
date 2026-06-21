import React from 'react';
import { Plus, Search, Filter, Edit, Trash2, MapPin, Phone } from 'lucide-react';
import Button from '../../shared/components/Button';
import IconButton from '../../shared/components/IconButton';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  type: 'retail' | 'wholesale';
  orderCount: number;
  totalSpent: number;
}

export default function Customers() {
  const [customers] = React.useState<Customer[]>([
    {
      id: '1',
      name: 'Khách hàng A',
      email: 'customer.a@example.com',
      phone: '0123456789',
      address: 'Hà Nội',
      type: 'retail',
      orderCount: 15,
      totalSpent: 50000000,
    },
    {
      id: '2',
      name: 'Khách hàng B',
      email: 'customer.b@example.com',
      phone: '0987654321',
      address: 'TP HCM',
      type: 'wholesale',
      orderCount: 8,
      totalSpent: 120000000,
    },
    {
      id: '3',
      name: 'Khách hàng C',
      email: 'customer.c@example.com',
      phone: '0912345678',
      address: 'Đà Nẵng',
      type: 'retail',
      orderCount: 5,
      totalSpent: 25000000,
    },
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Quản lý khách hàng</h1>
        <Button variant="primary" className="flex items-center gap-2">
          <Plus size={18} />
          Thêm khách hàng
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 border border-gray-100 flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Tìm kiếm khách hàng..."
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
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Tên khách hàng</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Điện thoại</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Địa chỉ</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Loại</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Đơn hàng</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Tổng chi tiêu</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {customers.map((customer) => (
              <tr key={customer.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4 text-sm font-medium text-primary">{customer.name}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{customer.email}</td>
                <td className="px-6 py-4 text-sm text-gray-600 flex items-center gap-1">
                  <Phone size={14} /> {customer.phone}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 flex items-center gap-1">
                  <MapPin size={14} /> {customer.address}
                </td>
                <td className="px-6 py-4 text-sm">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      customer.type === 'retail'
                        ? 'bg-cyan-50 text-cyan-700'
                        : 'bg-purple-50 text-purple-700'
                    }`}
                  >
                    {customer.type === 'retail' ? 'Lẻ' : 'Sỉ'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 font-medium">{customer.orderCount}</td>
                <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                  {(customer.totalSpent / 1000000).toFixed(1)}M ₫
                </td>
                <td className="px-6 py-4 text-sm flex items-center gap-2">
                  <IconButton className="text-cyan-500 hover:bg-cyan-50" aria-label="edit">
                    <Edit size={16} />
                  </IconButton>
                  <IconButton className="text-red-500 hover:bg-red-50" aria-label="delete">
                    <Trash2 size={16} />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
