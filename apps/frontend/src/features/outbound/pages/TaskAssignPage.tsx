import React, { useEffect, useState, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  UserPlus,
  ClipboardList,
  Package,
  CheckCircle2,
  Clock3,
  User,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { outboundApi, type OutboundOrder, type PickingTask } from '../api/outboundApi';

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function statusLabel(status?: string) {
  switch (status) {
    case 'pending': return 'Chờ xử lý';
    case 'picking': return 'Đang lấy hàng';
    case 'READY_TO_SHIP': return 'Sẵn sàng xuất';
    case 'shipped': return 'Đã xuất kho';
    default: return status || 'Chờ xử lý';
  }
}

function statusColor(status?: string) {
  switch (status) {
    case 'pending': return 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/60';
    case 'picking': return 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/60';
    case 'READY_TO_SHIP': return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60';
    case 'shipped': return 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800';
    default: return 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800';
  }
}

function taskStatusLabel(status?: string) {
  switch (status) {
    case 'ASSIGNED': return 'Đã giao';
    case 'COMPLETED': return 'Hoàn thành';
    case 'OPEN': return 'Mở';
    default: return status || 'Mở';
  }
}

function taskStatusColor(status?: string) {
  switch (status) {
    case 'ASSIGNED': return 'bg-cyan-50 dark:bg-indigo-950 text-cyan-700 dark:text-indigo-300 border-cyan-200 dark:border-indigo-800';
    case 'COMPLETED': return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60';
    default: return 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800';
  }
}

export default function TaskAssignPage() {
  const [orders, setOrders] = useState<OutboundOrder[]>([]);
  const [tasks, setTasks] = useState<PickingTask[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersData, tasksData, staffRes] = await Promise.all([
        outboundApi.listOrders(),
        outboundApi.listTasks(),
        fetch(`${API_BASE_URL}/users`, { headers: authHeaders() }).then((r) => r.ok ? r.json() : []),
      ]);

      // Lọc đơn chưa shipped
      setOrders(ordersData.filter((o) => o.status !== 'shipped'));
      setTasks(tasksData);
      setStaffList(
        (staffRes || []).filter((u: any) => {
          const roles = u.roles?.map((r: any) => r.name || r) || [];
          return roles.includes('staff') || roles.includes('manager');
        }),
      );
    } catch (err) {
      console.error('Lỗi tải dữ liệu:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAssign = async () => {
    if (!selectedOrderId || !selectedStaffId) return;
    setAssigning(true);
    try {
      const staffUser = staffList.find((s) => s.id === selectedStaffId);
      await outboundApi.assignTask(selectedOrderId, staffUser?.fullName || staffUser?.email || selectedStaffId);
      alert('Đã giao việc thành công!');
      setSelectedStaffId('');
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Lỗi giao việc');
    } finally {
      setAssigning(false);
    }
  };

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) || null;
  const orderTasks = tasks.filter((t) => t.order?.id === selectedOrderId);

  const filteredOrders = orders.filter((o) => {
    const term = search.toLowerCase();
    return (
      (o.orderNo || '').toLowerCase().includes(term) ||
      (o.customer || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="flex h-full gap-6 p-6 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-hidden">
      {/* Left Panel — Orders List */}
      <div className="w-95 shrink-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-indigo-900/60 flex flex-col overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-indigo-900/40 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="m-0 text-lg font-extrabold text-slate-900 dark:text-slate-100">Đơn xuất kho</h2>
            <button onClick={fetchData} className="p-2 bg-transparent border-0 cursor-pointer text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg transition">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Tìm mã đơn, khách hàng..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-indigo-900/60 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-cyan-600 focus:dark:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs font-semibold">Đang tải...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs font-semibold">Không có đơn xuất kho nào.</div>
          ) : (
            filteredOrders.map((o) => {
              const assignedTasks = tasks.filter((t) => t.order?.id === o.id);
              const isSelected = o.id === selectedOrderId;
              return (
                <button
                  key={o.id}
                  onClick={() => setSelectedOrderId(o.id)}
                  className={`w-full text-left p-3 rounded-xl border mb-1 cursor-pointer flex flex-col gap-2 transition ${
                    isSelected
                      ? 'border-2 border-cyan-600 dark:border-indigo-500 bg-cyan-50/50 dark:bg-indigo-950/50 shadow-2xs'
                      : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{o.orderNo}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${statusColor(o.status)}`}>
                      {statusLabel(o.status)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-bold text-slate-700 dark:text-slate-300">{o.customer || 'Khách lẻ'}</span>
                    <span>{o.items} sản phẩm</span>
                  </div>
                  {assignedTasks.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {assignedTasks.map((t) => (
                        <span key={t.id} className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${taskStatusColor(t.status)}`}>
                          {t.assignedTo} — {taskStatusLabel(t.status)}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Panel — Detail + Assign */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-indigo-900/60 flex flex-col overflow-hidden shadow-sm">
        {selectedOrder ? (
          <>
            {/* Header */}
            <div className="p-6 border-b border-slate-200 dark:border-indigo-900/40 bg-slate-50/70 dark:bg-slate-950">
              <div className="flex gap-4 items-start">
                <div className="p-3 bg-cyan-50 dark:bg-indigo-950 rounded-2xl text-cyan-600 dark:text-indigo-400 border border-cyan-200 dark:border-indigo-800">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="m-0 text-xl font-extrabold text-slate-900 dark:text-slate-100">{selectedOrder.orderNo}</h3>
                  <div className="mt-1 flex gap-4 text-xs text-slate-500 dark:text-slate-400 font-bold">
                    <span className="flex items-center gap-1">
                      <Package className="w-3.5 h-3.5" />
                      {selectedOrder.customer || 'Khách lẻ'}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      {selectedOrder.items} sản phẩm
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Product Details Table */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <h4 className="m-0 mb-3 text-sm font-extrabold text-slate-900 dark:text-slate-100">Chi tiết hàng hóa</h4>
                <div className="border border-slate-200 dark:border-indigo-900/40 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full border-collapse bg-white dark:bg-slate-900">
                    <thead className="bg-slate-50 dark:bg-slate-950">
                      <tr className="border-b border-slate-200 dark:border-indigo-900/40">
                        <th className="py-2.5 px-4 text-center text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase w-12">STT</th>
                        <th className="py-2.5 px-4 text-left text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">SKU</th>
                        <th className="py-2.5 px-4 text-left text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">Sản phẩm</th>
                        <th className="py-2.5 px-4 text-right text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">SL yêu cầu</th>
                        <th className="py-2.5 px-4 text-right text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">SL đã lấy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-indigo-900/40">
                      {(selectedOrder.details || []).map((d, i) => (
                        <tr key={d.id} className="hover:bg-cyan-50/40 dark:hover:bg-indigo-950/40 transition-colors">
                          <td className="py-3 px-4 text-center text-xs font-bold text-slate-400 dark:text-slate-500">{i + 1}</td>
                          <td className="py-3 px-4 text-xs font-extrabold font-mono text-cyan-800 dark:text-indigo-300">{d.product?.internalSku}</td>
                          <td className="py-3 px-4 text-xs font-bold text-slate-800 dark:text-slate-100">{d.product?.name}</td>
                          <td className="py-3 px-4 text-right text-xs font-bold text-slate-600 dark:text-slate-400">{d.requiredQty}</td>
                          <td className={`py-3 px-4 text-right text-sm font-black ${d.pickedQty >= d.requiredQty ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}`}>{d.pickedQty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tasks */}
              <div>
                <h4 className="m-0 mb-3 text-sm font-extrabold text-slate-900 dark:text-slate-100">Nhiệm vụ đã giao</h4>
                {orderTasks.length === 0 ? (
                  <div className="p-5 text-center text-slate-400 dark:text-slate-500 text-xs font-semibold bg-slate-50/60 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-indigo-900/40">
                    Chưa có nhiệm vụ nào được giao cho đơn này.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {orderTasks.map((t) => (
                      <div key={t.id} className="flex justify-between items-center p-3 bg-slate-50/70 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-indigo-900/40">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-cyan-600 dark:text-indigo-400" />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{t.assignedTo || 'Chưa xác định'}</span>
                        </div>
                        <span className={`px-2.5 py-1 rounded-md text-xs font-extrabold border ${taskStatusColor(t.status)}`}>
                          {taskStatusLabel(t.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Assign Form */}
            <div className="p-4 px-6 border-t border-slate-200 dark:border-indigo-900/40 bg-slate-50/70 dark:bg-slate-950 flex gap-3 items-center">
              <UserPlus className="w-5 h-5 text-cyan-600 dark:text-indigo-400 shrink-0" />
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="flex-1 p-2.5 rounded-xl border border-slate-300 dark:border-indigo-900/60 text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 outline-none focus:border-cyan-600 focus:dark:border-indigo-500"
              >
                <option value="">-- Chọn nhân viên kho --</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName || s.email} {s.roles?.map((r: any) => `(${r.name || r})`).join(' ')}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAssign}
                disabled={assigning || !selectedStaffId}
                className={`px-5 py-2.5 rounded-xl border-0 font-extrabold text-xs cursor-pointer flex items-center gap-1.5 whitespace-nowrap text-white transition active:scale-95 ${
                  selectedStaffId
                    ? 'bg-cyan-600 dark:bg-indigo-600 hover:bg-cyan-700 dark:hover:bg-indigo-700 shadow-sm'
                    : 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed text-slate-500'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                {assigning ? 'Đang giao...' : 'Giao việc'}
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <ClipboardList className="w-16 h-16 text-slate-200 dark:text-slate-800 mb-4" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 m-0">Chọn đơn xuất kho</h3>
            <p className="text-xs mt-1">Chọn một đơn xuất kho bên trái để xem chi tiết và phân công.</p>
          </div>
        )}
      </div>
    </div>
  );
}
