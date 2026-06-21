import React from 'react';
import { Download, Filter } from 'lucide-react';
import Button from '../../shared/components/Button';
import IconButton from '../../shared/components/IconButton';

export default function Reports() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Báo cáo</h1>
        <Button variant="primary" className="flex items-center gap-2">
          <Download size={18} />
          Xuất báo cáo
        </Button>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          {
            title: 'Báo cáo tồn kho',
            description: 'Thống kê tồn kho hiện tại theo sản phẩm và vị trí',
            icon: '📊',
          },
          {
            title: 'Báo cáo nhập hàng',
            description: 'Chi tiết các phiếu nhập theo thời gian và nhà cung cấp',
            icon: '📥',
          },
          {
            title: 'Báo cáo xuất hàng',
            description: 'Thống kê đơn hàng xuất theo khách hàng',
            icon: '📤',
          },
          {
            title: 'Báo cáo sản phẩm',
            description: 'Phân tích bán chạy, tồn chậm và sản phẩm mới',
            icon: '📈',
          },
        ].map((report, idx) => (
          <div
            key={idx}
            className="bg-white rounded-lg p-6 border border-gray-100 hover:shadow-md transition cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-3xl mb-3">{report.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900">{report.title}</h3>
                <p className="text-gray-600 text-sm mt-2">{report.description}</p>
              </div>
              <IconButton className="text-primary hover:bg-accent p-2" aria-label="download">
                <Download size={20} />
              </IconButton>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Reports */}
      <div className="bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Báo cáo gần đây</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {[
            { name: 'Báo cáo tồn kho', date: '2026-06-18 14:30', by: 'Dương Ngọc Anh' },
            { name: 'Báo cáo nhập hàng', date: '2026-06-17 10:15', by: 'Hệ thống' },
            { name: 'Báo cáo xuất hàng', date: '2026-06-16 09:00', by: 'Dương Ngọc Anh' },
          ].map((report, idx) => (
            <div
              key={idx}
              className="p-6 hover:bg-gray-50 transition flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-gray-900">{report.name}</p>
                <p className="text-sm text-gray-500">
                  {report.date} • {report.by}
                </p>
              </div>
              <IconButton className="text-primary hover:bg-accent p-2" aria-label="download">
                <Download size={18} />
              </IconButton>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
