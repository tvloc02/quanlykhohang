import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  WifiOff,
  RefreshCw,
  AlertOctagon,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { useSyncStatus } from '../hooks/useSyncStatus';

export default function SyncStatusBanner() {
  const navigate = useNavigate();
  const { isOnline, isSyncing, pendingCount, failedCount, triggerSync } = useSyncStatus();

  // If online, not syncing, no pending and no failed count -> hide banner
  if (isOnline && !isSyncing && pendingCount === 0 && failedCount === 0) {
    return null;
  }

  return (
    <div
      style={{
        width: '100%',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '13px',
        fontWeight: 600,
        color: 'white',
        zIndex: 9999,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        background: !isOnline
          ? 'linear-gradient(90deg, #d97706 0%, #b45309 100%)'
          : failedCount > 0
          ? 'linear-gradient(90deg, #dc2626 0%, #b91c1c 100%)'
          : isSyncing
          ? 'linear-gradient(90deg, #0284c7 0%, #0369a1 100%)'
          : 'linear-gradient(90deg, #059669 0%, #047857 100%)',
        transition: 'all 0.3s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {!isOnline ? (
          <>
            <WifiOff style={{ width: 18, height: 18 }} />
            <span>
              ⚠️ Đang ngoại tuyến. Dữ liệu quét sẽ tự động lưu cục bộ ({pendingCount} phiếu chờ đồng bộ).
            </span>
          </>
        ) : isSyncing ? (
          <>
            <RefreshCw
              style={{
                width: 18,
                height: 18,
                animation: 'spin 1s linear infinite',
              }}
            />
            <span>🔄 Đang tự động đồng bộ {pendingCount} phiếu ngoại tuyến lên hệ thống...</span>
          </>
        ) : failedCount > 0 ? (
          <>
            <AlertOctagon style={{ width: 18, height: 18 }} />
            <span>
              ❌ Có {failedCount} phiếu gặp xung đột/lỗi đồng bộ dữ liệu.
            </span>
          </>
        ) : (
          <>
            <CheckCircle2 style={{ width: 18, height: 18 }} />
            <span>Có {pendingCount} phiếu đang chờ đồng bộ.</span>
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {failedCount > 0 && (
          <button
            onClick={() => navigate('/sync-conflicts')}
            style={{
              padding: '4px 12px',
              borderRadius: '6px',
              border: 'none',
              background: 'white',
              color: '#dc2626',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            Xử lý xung đột <ChevronRight style={{ width: 14, height: 14 }} />
          </button>
        )}

        {isOnline && pendingCount > 0 && !isSyncing && (
          <button
            onClick={() => triggerSync()}
            style={{
              padding: '4px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.4)',
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <RefreshCw style={{ width: 12, height: 12 }} /> Đồng bộ ngay
          </button>
        )}
      </div>
    </div>
  );
}
