import React, { useEffect, useState, useCallback } from 'react';
import {
  AlertOctagon,
  RefreshCw,
  Trash2,
  CheckCircle2,
  ArrowLeft,
  FileText,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { OfflineQueueService } from '../services/offlineQueue.service';
import { SyncManagerService } from '../services/syncManager.service';
import type { QueueItem } from '../db/indexedDb';

function typeLabel(type: string) {
  switch (type) {
    case 'inbound': return 'Nhập kho';
    case 'outbound': return 'Xuất kho';
    case 'stocktake': return 'Kiểm kê';
    case 'barcode_mapping': return 'Liên kết mã vạch';
    default: return type;
  }
}

function formatDate(timestamp: number) {
  const d = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export default function SyncConflictsPage() {
  const [failedItems, setFailedItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);

  const fetchFailed = useCallback(async () => {
    setLoading(true);
    try {
      const items = await OfflineQueueService.getFailed();
      setFailedItems(items);
      if (items.length > 0 && !selectedItem) {
        setSelectedItem(items[0]);
      } else if (items.length === 0) {
        setSelectedItem(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedItem]);

  useEffect(() => {
    fetchFailed();
  }, [fetchFailed]);

  const handleRetry = async (item: QueueItem) => {
    if (!item.id) return;
    await OfflineQueueService.updateStatus(item.id, 'PENDING');
    alert('Đã đưa phiếu vào hàng đợi thử lại!');
    await fetchFailed();
    await SyncManagerService.syncNow();
  };

  const handleDelete = async (item: QueueItem) => {
    if (!item.id) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa/bỏ qua phiếu xung đột này?')) return;
    await OfflineQueueService.remove(item.id);
    alert('Đã xóa phiếu xung đột!');
    await fetchFailed();
  };

  const handleRetryAll = async () => {
    setSyncing(true);
    try {
      for (const item of failedItems) {
        if (item.id) {
          await OfflineQueueService.updateStatus(item.id, 'PENDING');
        }
      }
      await fetchFailed();
      await SyncManagerService.syncNow();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', gap: 24, padding: 24, background: '#f8fafc', overflow: 'hidden' }}>
      {/* Left Panel — Failed Items List */}
      <div style={{ width: 380, flexShrink: 0, background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: 16, borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Xung đột đồng bộ</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>Các phiếu bị lỗi khi sync từ thiết bị</p>
          </div>
          <button onClick={fetchFailed} style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', borderRadius: 8 }}>
            <RefreshCw style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Đang tải...</div>
          ) : failedItems.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              <CheckCircle2 style={{ width: 40, height: 40, color: '#10b981', margin: '0 auto 8px' }} />
              Không có xung đột đồng bộ nào.
            </div>
          ) : (
            failedItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: 12,
                  borderRadius: 12,
                  border: item.id === selectedItem?.id ? '2px solid #ef4444' : '1px solid transparent',
                  background: item.id === selectedItem?.id ? 'rgba(239,68,68,0.04)' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{typeLabel(item.type)}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}>
                    Xung đột
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {formatDate(item.timestamp)} • Thử {item.retryCount} lần
                </div>
                {item.errorMessage && (
                  <div style={{ fontSize: 11, color: '#b91c1c', fontWeight: 600, background: '#fff1f2', padding: '4px 8px', borderRadius: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.errorMessage}
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {failedItems.length > 0 && (
          <div style={{ padding: 12, borderTop: '1px solid #f1f5f9' }}>
            <button
              onClick={handleRetryAll}
              disabled={syncing}
              style={{ width: '100%', padding: '10px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <RotateCcw style={{ width: 14, height: 14 }} /> Thử lại tất cả
            </button>
          </div>
        )}
      </div>

      {/* Right Panel — Conflict Item Detail & Actions */}
      <div style={{ flex: 1, background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedItem ? (
          <>
            {/* Header */}
            <div style={{ padding: 24, borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ padding: 12, background: '#fef2f2', borderRadius: 14, color: '#dc2626' }}>
                  <AlertOctagon style={{ width: 24, height: 24 }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
                    Phiếu xung đột: {typeLabel(selectedItem.type)} #{selectedItem.id}
                  </h3>
                  <div style={{ marginTop: 4, fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                    Thời gian tạo ngoại tuyến: {formatDate(selectedItem.timestamp)}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => handleDelete(selectedItem)}
                  style={{ padding: '8px 16px', border: '1px solid #fca5a5', background: 'white', color: '#dc2626', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Trash2 style={{ width: 16, height: 16 }} /> Xóa / Bỏ qua
                </button>
                <button
                  onClick={() => handleRetry(selectedItem)}
                  style={{ padding: '8px 20px', background: '#06b6d4', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <RotateCcw style={{ width: 16, height: 16 }} /> Thử lại
                </button>
              </div>
            </div>

            {/* Error Message Box */}
            <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
              <div style={{ marginBottom: 20, padding: 16, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, display: 'flex', gap: 12, color: '#991b1b', fontSize: 14, fontWeight: 600 }}>
                <AlertTriangle style={{ width: 20, height: 20, flexShrink: 0, color: '#dc2626' }} />
                <div>
                  <strong>Nguyên nhân xung đột:</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#b91c1c' }}>
                    {selectedItem.errorMessage || 'Không thể đồng bộ dữ liệu với máy chủ.'}
                  </p>
                </div>
              </div>

              {/* JSON Payload View */}
              <h4 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Dữ liệu gốc gửi đi (Payload JSON):</h4>
              <pre style={{ padding: 16, background: '#0f172a', color: '#38bdf8', borderRadius: 12, fontSize: 13, fontFamily: 'monospace', overflowX: 'auto' }}>
                {JSON.stringify(selectedItem.payload, null, 2)}
              </pre>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            <CheckCircle2 style={{ width: 64, height: 64, color: '#10b981', marginBottom: 16 }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#475569', margin: 0 }}>Không có xung đột đồng bộ</h3>
            <p style={{ fontSize: 13, marginTop: 4 }}>Tất cả dữ liệu ngoại tuyến đã được đồng bộ thành công.</p>
          </div>
        )}
      </div>
    </div>
  );
}
