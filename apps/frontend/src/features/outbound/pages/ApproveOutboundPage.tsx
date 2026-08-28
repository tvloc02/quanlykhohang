import React, { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  RefreshCw,
  Package,
  Check,
  XCircle,
  Building,
  CalendarDays,
} from 'lucide-react';
import { outboundApi, type OutboundOrder } from '../api/outboundApi';

function statusLabel(status?: string) {
  switch (status) {
    case 'pending': return 'Chờ xử lý';
    case 'picking': return 'Đang lấy hàng';
    case 'READY_TO_SHIP': return 'Sẵn sàng xuất';
    case 'shipped': return 'Đã xuất kho';
    default: return status || 'Chờ xử lý';
  }
}

const formatMoney = (amount: number | string) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(amount));
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

export default function ApproveOutboundPage() {
  const [orders, setOrders] = useState<OutboundOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await outboundApi.listOrders();
      // Lọc đơn chưa xuất (chờ duyệt)
      const pending = data.filter((o) => o.status !== 'shipped');
      setOrders(pending);
      if (pending.length > 0 && !selectedId) {
        setSelectedId(pending[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleApprove = async (orderId: string) => {
    if (!window.confirm('Bạn có chắc chắn phê duyệt đơn xuất kho này? Tồn kho vật lý sẽ bị trừ chính thức.')) return;
    setApproving(true);
    try {
      await outboundApi.confirmOrder(orderId);
      alert('Phê duyệt đơn xuất kho và trừ tồn kho thành công!');
      setSelectedId(null);
      await fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Lỗi phê duyệt');
    } finally {
      setApproving(false);
    }
  };

  const handleCancel = async (orderId: string) => {
    if (!window.confirm('Bạn có chắc chắn hủy đơn xuất kho này? Tồn kho đã giữ chỗ sẽ được giải phóng.')) return;
    setApproving(true);
    try {
      await outboundApi.deleteOrder(orderId);
      alert('Đã hủy đơn xuất kho và giải phóng tồn kho thành công!');
      setSelectedId(null);
      await fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Lỗi hủy đơn');
    } finally {
      setApproving(false);
    }
  };

  const selected = orders.find((o) => o.id === selectedId) || null;
  const filtered = orders.filter((o) => {
    const term = search.toLowerCase();
    return (o.orderNo || '').toLowerCase().includes(term) || (o.customer || '').toLowerCase().includes(term);
  });

  return (
    <div className="flex h-full gap-6 p-6 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-hidden">
      {/* Left Panel */}
      <div className="w-95 shrink-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-indigo-900/60 flex flex-col overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-indigo-900/40 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h2 className="m-0 text-lg font-extrabold text-slate-900 dark:text-slate-100">Đơn chờ duyệt xuất</h2>
            <button onClick={fetchOrders} className="p-2 bg-transparent border-0 cursor-pointer text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg transition">
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
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs font-semibold">Không có đơn nào.</div>
          ) : (
            filtered.map((o) => {
              const isSelected = o.id === selectedId;
              return (
                <button
                  key={o.id}
                  onClick={() => setSelectedId(o.id)}
                  className={`w-full text-left p-3 rounded-xl border mb-1 cursor-pointer flex flex-col gap-2 transition ${
                    isSelected
                      ? 'border-2 border-cyan-600 dark:border-indigo-500 bg-cyan-50/50 dark:bg-indigo-950/50 shadow-2xs'
                      : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{o.orderNo}</span>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">
                      {statusLabel(o.status)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-bold text-slate-700 dark:text-slate-300">{o.customer || 'Khách lẻ'}</span>
                    <span>{o.items} sản phẩm</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-indigo-900/60 flex flex-col overflow-hidden shadow-sm">
        {selected ? (
          <>
            {/* Header */}
            <div className="p-6 border-b border-slate-200 dark:border-indigo-900/40 bg-slate-50/70 dark:bg-slate-950 flex justify-between items-start flex-wrap gap-4">
              <div className="flex gap-4 items-start">
                <div className="p-3 bg-cyan-50 dark:bg-indigo-950 rounded-2xl text-cyan-600 dark:text-indigo-400 border border-cyan-200 dark:border-indigo-800">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="m-0 text-xl font-extrabold text-slate-900 dark:text-slate-100">{selected.orderNo}</h3>
                  <div className="mt-1 flex gap-4 text-xs text-slate-500 dark:text-slate-400 font-bold flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5" />
                      {selected.customer || 'Khách lẻ'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5" />
                      Ngày giao: {formatDate(selected.dueDate)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleCancel(selected.id)}
                  disabled={approving}
                  className="px-4 py-2.5 border-2 border-rose-300 dark:border-rose-900/60 bg-white dark:bg-slate-950 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl font-bold text-xs cursor-pointer flex items-center gap-1.5 transition active:scale-95"
                >
                  <XCircle className="w-4 h-4" /> Hủy đơn
                </button>
                <button
                  onClick={() => handleApprove(selected.id)}
                  disabled={approving}
                  className="px-5 py-2.5 bg-emerald-600 dark:bg-emerald-700 hover:bg-emerald-700 dark:hover:bg-emerald-600 text-white border-0 rounded-xl font-black text-xs cursor-pointer flex items-center gap-1.5 shadow-md transition active:scale-95"
                >
                  <Check className="w-4 h-4" /> Phê duyệt & Xuất kho
                </button>
              </div>
            </div>

            {/* Reconciliation Table */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl flex gap-3 text-xs font-bold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
                <p className="m-0">
                  Đối chiếu số lượng đã lấy so với yêu cầu. Sau khi phê duyệt, tồn kho vật lý sẽ chính thức bị trừ.
                </p>
              </div>

              <div className="border border-slate-200 dark:border-indigo-900/40 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full border-collapse bg-white dark:bg-slate-900">
                  <thead className="bg-slate-50 dark:bg-slate-950">
                    <tr className="border-b border-slate-200 dark:border-indigo-900/40">
                      <th className="py-3 px-4 text-center text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase w-12">STT</th>
                      <th className="py-3 px-4 text-left text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">SKU</th>
                      <th className="py-3 px-4 text-left text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">Sản phẩm</th>
                      <th className="py-3 px-4 text-center text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">Vị trí</th>
                      <th className="py-3 px-4 text-right text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">SL yêu cầu</th>
                      <th className="py-3 px-4 text-right text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">SL đã lấy</th>
                      <th className="py-3 px-4 text-right text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">Chênh lệch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-indigo-900/40">
                    {(selected.details || []).map((d, i) => {
                      const diff = d.pickedQty - d.requiredQty;
                      return (
                        <tr key={d.id} className="hover:bg-cyan-50/40 dark:hover:bg-indigo-950/40 transition-colors">
                          <td className="py-3.5 px-4 text-center text-xs font-bold text-slate-400 dark:text-slate-500">{i + 1}</td>
                          <td className="py-3.5 px-4 text-xs font-extrabold font-mono text-cyan-800 dark:text-indigo-300">{d.product?.internalSku}</td>
                          <td className="py-3.5 px-4 text-xs font-bold text-slate-800 dark:text-slate-100">{d.product?.name}</td>
                          <td className="py-3.5 px-4 text-center text-xs font-bold text-slate-600 dark:text-slate-400">{d.warehouseCode || 'DEFAULT'}</td>
                          <td className="py-3.5 px-4 text-right text-xs font-bold text-slate-600 dark:text-slate-400">{d.requiredQty}</td>
                          <td className="py-3.5 px-4 text-right text-sm font-black text-slate-900 dark:text-slate-100">{d.pickedQty}</td>
                          <td className={`py-3.5 px-4 text-right text-sm font-black ${diff === 0 ? 'text-emerald-600 dark:text-emerald-400' : diff < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-cyan-700 dark:text-indigo-300'}`}>
                            {diff === 0 ? 'Khớp (0)' : diff > 0 ? `+${diff}` : diff}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Summary */}
            <div className="py-3 px-6 border-t border-slate-200 dark:border-indigo-900/40 bg-slate-50/70 dark:bg-slate-950 flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
              <span>Tổng mặt hàng: <strong className="text-slate-900 dark:text-slate-100">{(selected.details || []).length}</strong></span>
              <span>Tổng giá trị: <strong className="text-slate-900 dark:text-slate-100">{formatMoney((selected.details || []).reduce((sum, d) => sum + d.totalLineAmount, 0))}</strong></span>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <CheckCircle2 className="w-16 h-16 text-slate-200 dark:text-slate-800 mb-4" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 m-0">Tất cả đơn đã được xử lý</h3>
            <p className="text-xs mt-1">Không có đơn xuất kho nào đang chờ phê duyệt.</p>
          </div>
        )}
      </div>
    </div>
  );
}
