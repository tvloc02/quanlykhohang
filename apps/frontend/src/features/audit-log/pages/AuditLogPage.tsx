import React, { useState, useEffect } from 'react';
import { Clock, ShieldAlert, FileText, User, Box, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [resourceFilter, setResourceFilter] = useState('all');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/audit-logs?limit=500`, { headers: authHeaders() });
      if (response.ok) {
        setLogs(await response.json());
      }
    } catch (error) {
      console.error('Failed to load logs', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const getActionInfo = (log: any) => {
    const r = log.resource || '';
    const a = log.action || '';
    let name = a;
    let desc = '';
    let color = 'bg-slate-100 text-slate-700';

    if (a.includes('create')) {
      name = 'TẠO MỚI';
      color = 'bg-emerald-100 text-emerald-700';
    } else if (a.includes('update')) {
      name = 'CẬP NHẬT';
      color = 'bg-blue-100 text-blue-700';
    } else if (a.includes('delete') || a.includes('remove')) {
      name = 'XÓA';
      color = 'bg-red-100 text-red-700';
    } else if (a.includes('post') || a.includes('approve') || a.includes('complete') || a.includes('transition')) {
      name = 'XÁC NHẬN / DUYỆT';
      color = 'bg-purple-100 text-purple-700';
    }

    const m = log.metadata || {};

    if (r === 'user') {
      if (name === 'TẠO MỚI') desc = `Tạo người dùng ${m.email || ''}`;
      else if (name === 'CẬP NHẬT') desc = `Cập nhật người dùng ${m.email || ''}`;
      else if (name === 'XÓA') desc = `Xóa người dùng ${m.email || ''}`;
      else desc = `Thao tác trên người dùng`;
    } else if (r === 'product') {
      if (name === 'TẠO MỚI') desc = `Tạo sản phẩm ${m.name || m.internalSku || ''}`;
      else if (name === 'CẬP NHẬT') desc = `Cập nhật sản phẩm ${m.name || m.internalSku || ''}`;
      else if (name === 'XÓA') desc = `Xóa sản phẩm ${m.internalSku || ''}`;
      else desc = `Thao tác trên sản phẩm`;
    } else if (r === 'category') {
      if (name === 'TẠO MỚI') desc = `Tạo danh mục ${m.name || ''}`;
      else if (name === 'CẬP NHẬT') desc = `Cập nhật danh mục ${m.name || ''}`;
      else if (name === 'XÓA') desc = `Xóa danh mục ${m.name || ''}`;
      else desc = `Thao tác trên danh mục`;
    } else if (r === 'supplier') {
      if (name === 'TẠO MỚI') desc = `Tạo NCC ${m.name || ''}`;
      else if (name === 'CẬP NHẬT') desc = `Cập nhật NCC ${m.name || ''}`;
      else if (name === 'XÓA') desc = `Xóa NCC ${m.name || ''}`;
      else desc = `Thao tác trên NCC`;
    } else if (r === 'purchase-order') {
      if (name === 'TẠO MỚI') desc = `Tạo đơn mua hàng`;
      else if (name === 'CẬP NHẬT') desc = `Cập nhật đơn mua hàng`;
      else if (name === 'XÓA') desc = `Xóa đơn mua hàng`;
      else if (name === 'XÁC NHẬN / DUYỆT') desc = `Phê duyệt/Dịch chuyển đơn mua hàng ${m.nextStatus ? `sang ${m.nextStatus}` : ''}`;
      else desc = `Thao tác đơn mua hàng`;
    } else if (r === 'stock-in-order') {
      if (name === 'TẠO MỚI') desc = `Tạo phiếu nhập kho`;
      else if (name === 'CẬP NHẬT') desc = `Cập nhật phiếu nhập kho`;
      else if (name === 'XÓA') desc = `Xóa phiếu nhập kho`;
      else if (name === 'XÁC NHẬN / DUYỆT') desc = `Phê duyệt/Dịch chuyển phiếu nhập kho ${m.nextStatus ? `sang ${m.nextStatus}` : ''}`;
      else desc = `Thao tác phiếu nhập kho`;
    } else if (r === 'stock-in-receipt') {
      if (name === 'TẠO MỚI') desc = `Tạo lệnh nhập kho ${m.receiptType || ''}`;
      else if (name === 'CẬP NHẬT') desc = `Cập nhật lệnh nhập kho`;
      else if (name === 'XÓA') desc = `Xóa lệnh nhập kho`;
      else if (name === 'XÁC NHẬN / DUYỆT') desc = `Chốt & ghi sổ lệnh nhập kho`;
      else desc = `Thao tác lệnh nhập kho`;
    } else if (r === 'inventory-check') {
      if (name === 'TẠO MỚI') desc = `Tạo phiếu kiểm kê kho`;
      else if (name === 'CẬP NHẬT') desc = `Cập nhật phiếu kiểm kê kho`;
      else if (name === 'XÓA') desc = `Xóa phiếu kiểm kê kho`;
      else if (name === 'XÁC NHẬN / DUYỆT') desc = `Chốt kiểm kê và điều chỉnh kho`;
      else desc = `Thao tác kiểm kê`;
    } else {
      desc = `Thao tác ${a} trên ${r}`;
    }

    return { name, desc, color };
  };

  const getResourceName = (r: string) => {
    const map: Record<string, string> = {
      'user': 'Người dùng',
      'product': 'Sản phẩm',
      'category': 'Danh mục',
      'supplier': 'Nhà cung cấp',
      'purchase-order': 'Đơn mua hàng',
      'stock-in-order': 'Phiếu nhập kho',
      'stock-in-receipt': 'Lệnh nhập kho',
      'inventory-check': 'Kiểm kê',
    };
    return map[r] || r;
  };

  const filteredLogs = logs.filter((log) => {
    const q = search.toLowerCase();
    const matchSearch = 
      log.actorEmail?.toLowerCase().includes(q) || 
      log.action?.toLowerCase().includes(q) || 
      log.resourceId?.toLowerCase().includes(q) ||
      JSON.stringify(log.metadata || {}).toLowerCase().includes(q);
    
    const matchResource = resourceFilter === 'all' || log.resource === resourceFilter;
    
    return matchSearch && matchResource;
  });

  const uniqueResources = Array.from(new Set(logs.map(l => l.resource))).filter(Boolean);

  return (
    <div className="flex h-full flex-col bg-slate-50 p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Nhật ký hoạt động</h1>
        <p className="mt-2 text-sm font-medium text-slate-500">Giám sát và theo dõi mọi thao tác trên hệ thống</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex w-full max-w-sm items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm log, email, mã..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
          <Filter className="h-5 w-5 text-slate-400" />
          <select
            value={resourceFilter}
            onChange={(e) => setResourceFilter(e.target.value)}
            className="bg-transparent text-sm font-bold text-slate-700 outline-none"
          >
            <option value="all">Tất cả tài nguyên</option>
            {uniqueResources.map(r => (
              <option key={r} value={r}>{getResourceName(r)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="h-full overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50/90 shadow-sm backdrop-blur-sm">
              <tr>
                <th className="px-6 py-4 font-black text-slate-600">THỜI GIAN</th>
                <th className="px-6 py-4 font-black text-slate-600">NGƯỜI THỰC HIỆN</th>
                <th className="px-6 py-4 font-black text-slate-600">TÀI NGUYÊN</th>
                <th className="px-6 py-4 font-black text-slate-600">HÀNH ĐỘNG</th>
                <th className="px-6 py-4 font-black text-slate-600 w-1/3">MÔ TẢ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 font-medium">Đang tải nhật ký...</td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 font-medium">Không tìm thấy nhật ký phù hợp</td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const { name, desc, color } = getActionInfo(log);
                  return (
                    <tr key={log.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-6 py-4 font-semibold text-slate-700 whitespace-nowrap">
                        {format(new Date(log.createdAt), 'HH:mm:ss dd/MM/yyyy')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{log.actorEmail || 'Hệ thống'}</div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-700 whitespace-nowrap">
                        {getResourceName(log.resource)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-black ${color}`}>
                          {name}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        <p className="font-semibold text-slate-900 mb-1">{desc}</p>
                        <div className="text-xs text-slate-500 font-mono break-all line-clamp-2" title={JSON.stringify(log.metadata)}>
                          ID: {log.resourceId} {log.metadata ? `- ${JSON.stringify(log.metadata)}` : ''}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
