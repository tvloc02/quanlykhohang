import React, { useEffect, useState, useCallback } from 'react';
import {
  ScanLine,
  Package,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  Check,
  ArrowLeft,
} from 'lucide-react';
import BarcodeScanner from '../../../shared/components/BarcodeScanner';
import { outboundApi, type OutboundOrder, type PickingTask } from '../api/outboundApi';

const API_BASE_URL = '/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

export default function PickingPage() {
  const [tasks, setTasks] = useState<PickingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<PickingTask | null>(null);
  const [orderDetail, setOrderDetail] = useState<OutboundOrder | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null);
  const [pickQty, setPickQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await outboundApi.listTasks();
      // Lọc task được giao cho mình (hoặc hiển thị tất cả cho manager)
      setTasks(data.filter((t) => t.status !== 'COMPLETED'));
    } catch (err) {
      console.error('Lỗi tải tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const selectTask = async (task: PickingTask) => {
    setSelectedTask(task);
    setActiveDetailId(null);
    try {
      const detail = await outboundApi.getOrder(task.order.id);
      setOrderDetail(detail);
    } catch (err) {
      console.error('Lỗi tải chi tiết đơn:', err);
    }
  };

  const handlePick = async (detailId: string) => {
    if (pickQty <= 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/outbounds/details/${detailId}/pick`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ qty: pickQty }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || 'Lỗi cập nhật số lượng lấy');
      }

      // Refresh order detail
      if (selectedTask) {
        const updated = await outboundApi.getOrder(selectedTask.order.id);
        setOrderDetail(updated);
      }
      setActiveDetailId(null);
      setPickQty(1);
    } catch (err: any) {
      alert(err.message || 'Lỗi pick');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteTask = async () => {
    if (!selectedTask) return;
    if (!window.confirm('Xác nhận hoàn thành nhiệm vụ lấy hàng?')) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/outbounds/tasks/${selectedTask.id}/confirm`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ taskId: selectedTask.id }),
      });
      if (!res.ok) throw new Error('Lỗi hoàn thành task');
      alert('Hoàn thành nhiệm vụ lấy hàng thành công!');
      setSelectedTask(null);
      setOrderDetail(null);
      await fetchTasks();
    } catch (err: any) {
      alert(err.message || 'Lỗi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBarcodeScanned = (code: string) => {
    // Tìm detail line khớp với barcode (theo SKU hoặc supplierBarcode)
    if (!orderDetail?.details) return;
    const matched = orderDetail.details.find(
      (d) =>
        d.product?.internalSku?.toLowerCase() === code.toLowerCase() ||
        code.toLowerCase().includes((d.product?.internalSku || '').toLowerCase()),
    );
    if (matched) {
      setActiveDetailId(matched.id);
      const remaining = matched.requiredQty - matched.pickedQty;
      setPickQty(Math.max(remaining, 1));
    } else {
      alert(`Mã vạch "${code}" không khớp với bất kỳ sản phẩm nào trong đơn!`);
    }
  };

  // Task List View
  if (!selectedTask) {
    return (
      <div className="p-6 bg-slate-50 dark:bg-slate-950 min-h-full text-slate-800 dark:text-slate-100">
        <div className="flex justify-between items-center mb-5">
          <h1 className="m-0 text-2xl font-extrabold text-slate-900 dark:text-slate-100">Lấy hàng (Picking)</h1>
          <button onClick={fetchTasks} className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-indigo-900/60 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            <RefreshCw className="w-3.5 h-3.5" /> Làm mới
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500 font-semibold text-xs">Đang tải nhiệm vụ...</div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-indigo-900/60 shadow-xs">
            <CheckCircle2 className="w-12 h-12 text-slate-200 dark:text-slate-800 mx-auto mb-3" />
            <p className="text-base font-bold text-slate-700 dark:text-slate-300 m-0">Không có nhiệm vụ nào đang chờ</p>
            <p className="text-xs mt-1">Tất cả nhiệm vụ lấy hàng đã hoàn thành.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {tasks.map((t) => (
              <button
                key={t.id}
                onClick={() => selectTask(t)}
                className="w-full text-left p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-indigo-900/60 cursor-pointer flex justify-between items-center hover:border-cyan-500 dark:hover:border-indigo-500 hover:shadow-md transition"
              >
                <div className="flex gap-4 items-center">
                  <div className="p-2.5 bg-cyan-50 dark:bg-indigo-950 rounded-xl text-cyan-600 dark:text-indigo-400 border border-cyan-200 dark:border-indigo-800">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                      {t.order?.orderNo || `Đơn #${t.order?.id?.slice(0, 8)}`}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                      Giao cho: <strong className="text-slate-700 dark:text-slate-300">{t.assignedTo || 'Chưa xác định'}</strong> • Trạng thái: {t.status}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Picking Detail View
  const allPicked = orderDetail?.details?.every((d) => d.pickedQty >= d.requiredQty) ?? false;

  return (
    <div className="p-6 bg-slate-50 dark:bg-slate-950 min-h-full text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelectedTask(null); setOrderDetail(null); }}
            className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-indigo-900/60 rounded-xl cursor-pointer text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="m-0 text-xl font-extrabold text-slate-900 dark:text-slate-100">
              Lấy hàng — {orderDetail?.orderNo}
            </h1>
            <p className="m-0 text-xs text-slate-500 dark:text-slate-400 font-medium">
              Giao cho: {selectedTask.assignedTo} • {orderDetail?.customer || 'Khách lẻ'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setScannerOpen(true)}
            className="px-4 py-2 bg-cyan-600 dark:bg-indigo-600 hover:bg-cyan-700 dark:hover:bg-indigo-700 text-white border-0 rounded-xl cursor-pointer font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95"
          >
            <ScanLine className="w-4 h-4" /> Quét mã
          </button>
          {allPicked && (
            <button
              onClick={handleCompleteTask}
              disabled={submitting}
              className="px-4 py-2 bg-emerald-600 dark:bg-emerald-700 hover:bg-emerald-700 dark:hover:bg-emerald-600 text-white border-0 rounded-xl cursor-pointer font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95"
            >
              <Check className="w-4 h-4" /> Hoàn thành
            </button>
          )}
        </div>
      </div>

      {/* Picking progress */}
      {orderDetail && (
        <div className={`mb-4 p-4 border rounded-xl flex gap-3 items-center text-xs font-bold ${
          allPicked
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300'
            : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300'
        }`}>
          {allPicked ? (
            <><CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Tất cả sản phẩm đã được lấy đủ. Nhấn "Hoàn thành" để kết thúc.</>
          ) : (
            <><AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" /> Quét mã vạch hoặc nhấn vào dòng sản phẩm để nhập số lượng đã lấy.</>
          )}
        </div>
      )}

      {/* Products Table */}
      <div className="border border-slate-200 dark:border-indigo-900/60 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-950">
            <tr className="border-b border-slate-200 dark:border-indigo-900/40">
              <th className="py-3 px-4 text-center text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase w-12">STT</th>
              <th className="py-3 px-4 text-left text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">SKU</th>
              <th className="py-3 px-4 text-left text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">Sản phẩm</th>
              <th className="py-3 px-4 text-center text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">Vị trí kho</th>
              <th className="py-3 px-4 text-right text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">Yêu cầu</th>
              <th className="py-3 px-4 text-right text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">Đã lấy</th>
              <th className="py-3 px-4 text-center text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase w-48">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-indigo-900/40">
            {(orderDetail?.details || []).map((d, i) => {
              const done = d.pickedQty >= d.requiredQty;
              const isActive = activeDetailId === d.id;
              return (
                <tr
                  key={d.id}
                  className={`transition-colors ${
                    isActive
                      ? 'bg-cyan-50/60 dark:bg-indigo-950/60'
                      : done
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  } ${done ? 'cursor-default' : 'cursor-pointer'}`}
                  onClick={() => { if (!done) { setActiveDetailId(d.id); setPickQty(d.requiredQty - d.pickedQty); } }}
                >
                  <td className="py-3.5 px-4 text-center text-xs font-bold text-slate-400 dark:text-slate-500">{i + 1}</td>
                  <td className="py-3.5 px-4 text-xs font-extrabold font-mono text-cyan-800 dark:text-indigo-300">{d.product?.internalSku}</td>
                  <td className="py-3.5 px-4 text-xs font-bold text-slate-800 dark:text-slate-100">{d.product?.name}</td>
                  <td className="py-3.5 px-4 text-center text-xs font-bold text-slate-600 dark:text-slate-400">{d.warehouseCode || 'DEFAULT'}</td>
                  <td className="py-3.5 px-4 text-right text-xs font-bold text-slate-600 dark:text-slate-400">{d.requiredQty}</td>
                  <td className={`py-3.5 px-4 text-right text-sm font-black ${done ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}`}>{d.pickedQty}</td>
                  <td className="py-3.5 px-4 text-center">
                    {done ? (
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60">✓ Đủ</span>
                    ) : isActive ? (
                      <div className="flex gap-1.5 justify-center items-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="number"
                          value={pickQty}
                          min={1}
                          max={d.requiredQty - d.pickedQty}
                          onChange={(e) => setPickQty(Math.max(1, Number(e.target.value)))}
                          className="w-16 py-1 px-2 rounded-lg border border-slate-300 dark:border-indigo-900/60 bg-white dark:bg-slate-950 text-xs font-bold text-center text-slate-900 dark:text-slate-100 outline-none"
                        />
                        <button
                          onClick={() => handlePick(d.id)}
                          disabled={submitting}
                          className="py-1 px-3 bg-cyan-600 dark:bg-indigo-600 hover:bg-cyan-700 dark:hover:bg-indigo-700 text-white border-0 rounded-lg cursor-pointer font-bold text-xs shadow-2xs"
                        >
                          Lấy
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold">Nhấn để lấy</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        mode="scan"
        onBarcodeScanned={handleBarcodeScanned}
        title="Quét mã vạch sản phẩm lấy hàng"
      />
    </div>
  );
}
