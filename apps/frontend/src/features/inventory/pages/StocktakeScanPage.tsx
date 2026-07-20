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
  Search,
} from 'lucide-react';
import BarcodeScanner from '../../../shared/components/BarcodeScanner';
import { OfflineQueueService } from '../../offline-sync/services/offlineQueue.service';
import { SyncManagerService } from '../../offline-sync/services/syncManager.service';

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

export default function StocktakeScanPage() {
  const [stocktakes, setStocktakes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStocktake, setSelectedStocktake] = useState<any | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null);
  const [countQty, setCountQty] = useState<number>(0);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchStocktakes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/inventory/stocktakes`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        // Sessions in DRAFT or COUNTING status
        setStocktakes(data.filter((s: any) => s.status === 'DRAFT' || s.status === 'COUNTING'));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStocktakes();
  }, [fetchStocktakes]);

  const selectStocktake = async (st: any) => {
    setSelectedStocktake(st);
    setActiveDetailId(null);
    try {
      const res = await fetch(`${API_BASE_URL}/inventory/stocktakes/${st.id}`, { headers: authHeaders() });
      if (res.ok) {
        const detail = await res.json();
        setSelectedStocktake(detail);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveCount = async (detailId: string) => {
    setSubmitting(true);
    try {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

      if (!isOnline) {
        // Enqueue to IndexedDB queue for offline sync (US05.03)
        await OfflineQueueService.enqueue('stocktake', {
          stocktakeId: selectedStocktake?.id,
          detailId,
          countedQty: countQty,
          note,
        });
        alert('Đã lưu kết quả đếm ngoại tuyến! Dữ liệu sẽ tự động đồng bộ khi có mạng.');
      } else {
        // Online API call
        const res = await fetch(`${API_BASE_URL}/inventory/stocktakes/details/${detailId}/count`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ countedQty: countQty, note }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.message || 'Lỗi cập nhật số lượng đếm');
        }
      }

      // Refresh stocktake detail
      if (selectedStocktake?.id) {
        const updatedRes = await fetch(`${API_BASE_URL}/inventory/stocktakes/${selectedStocktake.id}`, { headers: authHeaders() });
        if (updatedRes.ok) {
          setSelectedStocktake(await updatedRes.json());
        }
      }
      setActiveDetailId(null);
      setCountQty(0);
      setNote('');
    } catch (err: any) {
      alert(err.message || 'Lỗi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinishCounting = async () => {
    if (!selectedStocktake) return;
    if (!window.confirm('Xác nhận hoàn tất đếm cho phiên kiểm kê này?')) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/inventory/stocktakes/${selectedStocktake.id}/finish-counting`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || 'Lỗi hoàn tất đếm');
      }
      alert('Đã hoàn tất đếm kiểm kê thành công! Đơn đã được chuyển cho Quản lý phê duyệt.');
      setSelectedStocktake(null);
      await fetchStocktakes();
    } catch (err: any) {
      alert(err.message || 'Lỗi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBarcodeScanned = (code: string) => {
    if (!selectedStocktake?.details) return;
    const matched = selectedStocktake.details.find(
      (d: any) =>
        d.product?.internalSku?.toLowerCase() === code.toLowerCase() ||
        code.toLowerCase().includes((d.product?.internalSku || '').toLowerCase()),
    );
    if (matched) {
      setActiveDetailId(matched.id);
      setCountQty(matched.countedQty ?? matched.systemQty);
    } else {
      alert(`Mã vạch "${code}" không khớp với bất kỳ sản phẩm nào trong phiên kiểm kê này!`);
    }
  };

  // Stocktake Session List View
  if (!selectedStocktake) {
    return (
      <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Quét Đếm Kiểm Kê</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Chọn phiên kiểm kê để bắt đầu quét đếm sản phẩm qua camera</p>
          </div>
          <button onClick={fetchStocktakes} style={{ padding: '8px 16px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#475569' }}>
            <RefreshCw style={{ width: 14, height: 14 }} /> Làm mới
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Đang tải phiên kiểm kê...</div>
        ) : stocktakes.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', background: 'white', borderRadius: 16, border: '1px solid #e2e8f0' }}>
            <CheckCircle2 style={{ width: 48, height: 48, color: '#e2e8f0', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 16, fontWeight: 700, color: '#475569' }}>Không có phiên kiểm kê nào đang chờ đếm</p>
            <p style={{ fontSize: 13 }}>Hãy tạo phiên kiểm kê mới từ menu "Kiểm kê".</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {stocktakes.map((st) => (
              <button
                key={st.id}
                onClick={() => selectStocktake(st)}
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
                }}
              >
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div style={{ padding: 10, background: '#ecfeff', borderRadius: 12, color: '#06b6d4' }}>
                    <Package style={{ width: 24, height: 24 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{st.stocktakeNo}</div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                      Vị trí kho: <strong>{st.locationCode}</strong> • Phân công: {st.assignee || 'Chưa gán'} • Trạng thái: {st.status}
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

  // Stocktake Detail Scan View
  const allCounted = selectedStocktake.details?.every((d: any) => d.countedQty !== null && d.countedQty !== undefined) ?? false;

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setSelectedStocktake(null)}
            style={{ padding: 8, background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, cursor: 'pointer', color: '#475569' }}
          >
            <ArrowLeft style={{ width: 16, height: 16 }} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
              Kiểm kê: {selectedStocktake.stocktakeNo}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              Kho: {selectedStocktake.locationCode} • Người đếm: {selectedStocktake.assignee || 'Tôi'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setScannerOpen(true)}
            style={{ padding: '8px 16px', background: '#06b6d4', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ScanLine style={{ width: 16, height: 16 }} /> Quét camera
          </button>
          {allCounted && (
            <button
              onClick={handleFinishCounting}
              disabled={submitting}
              style={{ padding: '8px 16px', background: '#059669', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Check style={{ width: 16, height: 16 }} /> Hoàn tất đếm
            </button>
          )}
        </div>
      </div>

      {/* Detail Table */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', background: 'white' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: 50 }}>STT</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>SKU</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Sản phẩm</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Tồn hệ thống</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Đếm thực tế</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: 220 }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {(selectedStocktake.details || []).map((d: any, i: number) => {
              const hasCounted = d.countedQty !== null && d.countedQty !== undefined;
              const isActive = activeDetailId === d.id;
              return (
                <tr key={d.id} style={{
                  borderBottom: '1px solid #e2e8f0',
                  background: isActive ? 'rgba(6,182,212,0.04)' : hasCounted ? '#f0fdf4' : 'white',
                  cursor: 'pointer',
                }} onClick={() => { setActiveDetailId(d.id); setCountQty(d.countedQty ?? d.systemQty); }}>
                  <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: 13, color: '#94a3b8', fontWeight: 700 }}>{i + 1}</td>
                  <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#475569' }}>{d.product?.internalSku}</td>
                  <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{d.product?.name}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#475569' }}>{d.systemQty}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 14, fontWeight: 800, color: hasCounted ? '#059669' : '#94a3b8' }}>
                    {hasCounted ? d.countedQty : 'Chưa đếm'}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                    {isActive ? (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                        <input
                          type="number"
                          value={countQty}
                          min={0}
                          onChange={(e) => setCountQty(Math.max(0, Number(e.target.value)))}
                          style={{ width: 60, padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, textAlign: 'center' }}
                        />
                        <button
                          onClick={() => handleSaveCount(d.id)}
                          disabled={submitting}
                          style={{ padding: '6px 12px', background: '#06b6d4', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}
                        >
                          Lưu
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>Nhấn để đếm</span>
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
        title="Quét mã vạch kiểm kê sản phẩm"
      />
    </div>
  );
}
