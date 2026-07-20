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

const API_BASE_URL = 'http://localhost:3000/api';

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
      <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Lấy hàng (Picking)</h1>
          <button onClick={fetchTasks} style={{ padding: '8px 16px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#475569' }}>
            <RefreshCw style={{ width: 14, height: 14 }} /> Làm mới
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Đang tải nhiệm vụ...</div>
        ) : tasks.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', background: 'white', borderRadius: 16, border: '1px solid #e2e8f0' }}>
            <CheckCircle2 style={{ width: 48, height: 48, color: '#e2e8f0', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 16, fontWeight: 700, color: '#475569' }}>Không có nhiệm vụ nào đang chờ</p>
            <p style={{ fontSize: 13 }}>Tất cả nhiệm vụ lấy hàng đã hoàn thành.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {tasks.map((t) => (
              <button
                key={t.id}
                onClick={() => selectTask(t)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '20px 24px',
                  background: 'white',
                  borderRadius: 16,
                  border: '1px solid #e2e8f0',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'box-shadow 0.15s',
                }}
              >
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div style={{ padding: 10, background: '#ecfeff', borderRadius: 12, color: '#06b6d4' }}>
                    <Package style={{ width: 24, height: 24 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                      {t.order?.orderNo || `Đơn #${t.order?.id?.slice(0, 8)}`}
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                      Giao cho: <strong>{t.assignedTo || 'Chưa xác định'}</strong> • Trạng thái: {t.status}
                    </div>
                  </div>
                </div>
                <ChevronRight style={{ width: 20, height: 20, color: '#94a3b8' }} />
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
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => { setSelectedTask(null); setOrderDetail(null); }}
            style={{ padding: 8, background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, cursor: 'pointer', color: '#475569' }}
          >
            <ArrowLeft style={{ width: 16, height: 16 }} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
              Lấy hàng — {orderDetail?.orderNo}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              Giao cho: {selectedTask.assignedTo} • {orderDetail?.customer || 'Khách lẻ'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setScannerOpen(true)}
            style={{ padding: '8px 16px', background: '#06b6d4', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ScanLine style={{ width: 16, height: 16 }} /> Quét mã
          </button>
          {allPicked && (
            <button
              onClick={handleCompleteTask}
              disabled={submitting}
              style={{ padding: '8px 16px', background: '#059669', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Check style={{ width: 16, height: 16 }} /> Hoàn thành
            </button>
          )}
        </div>
      </div>

      {/* Picking progress */}
      {orderDetail && (
        <div style={{ marginBottom: 16, padding: 16, background: allPicked ? '#ecfdf5' : '#fffbeb', border: `1px solid ${allPicked ? '#a7f3d0' : '#fde68a'}`, borderRadius: 12, display: 'flex', gap: 12, alignItems: 'center', fontSize: 14, fontWeight: 600, color: allPicked ? '#065f46' : '#92400e' }}>
          {allPicked ? (
            <><CheckCircle2 style={{ width: 20, height: 20 }} /> Tất cả sản phẩm đã được lấy đủ. Nhấn "Hoàn thành" để kết thúc.</>
          ) : (
            <><AlertTriangle style={{ width: 20, height: 20 }} /> Quét mã vạch hoặc nhấn vào dòng sản phẩm để nhập số lượng đã lấy.</>
          )}
        </div>
      )}

      {/* Products Table */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', background: 'white' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: 50 }}>STT</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>SKU</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Sản phẩm</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Vị trí kho</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Yêu cầu</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Đã lấy</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: 200 }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {(orderDetail?.details || []).map((d, i) => {
              const done = d.pickedQty >= d.requiredQty;
              const isActive = activeDetailId === d.id;
              return (
                <tr key={d.id} style={{
                  borderBottom: '1px solid #e2e8f0',
                  background: isActive ? 'rgba(6,182,212,0.04)' : done ? '#f0fdf4' : 'white',
                  cursor: done ? 'default' : 'pointer',
                }} onClick={() => { if (!done) { setActiveDetailId(d.id); setPickQty(d.requiredQty - d.pickedQty); } }}>
                  <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: 13, color: '#94a3b8', fontWeight: 700 }}>{i + 1}</td>
                  <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#475569' }}>{d.product?.internalSku}</td>
                  <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{d.product?.name}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#475569' }}>{d.warehouseCode || 'DEFAULT'}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#475569' }}>{d.requiredQty}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 14, fontWeight: 800, color: done ? '#059669' : '#0f172a' }}>{d.pickedQty}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    {done ? (
                      <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>✓ Đủ</span>
                    ) : isActive ? (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="number"
                          value={pickQty}
                          min={1}
                          max={d.requiredQty - d.pickedQty}
                          onChange={(e) => setPickQty(Math.max(1, Number(e.target.value)))}
                          style={{ width: 60, padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, textAlign: 'center' }}
                        />
                        <button
                          onClick={() => handlePick(d.id)}
                          disabled={submitting}
                          style={{ padding: '6px 12px', background: '#06b6d4', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}
                        >
                          Lấy
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>Nhấn để lấy</span>
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
