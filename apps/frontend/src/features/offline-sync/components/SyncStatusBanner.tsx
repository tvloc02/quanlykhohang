import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  WifiOff,
  RefreshCw,
  AlertOctagon,
  CheckCircle2,
  ChevronRight,
  X,
} from 'lucide-react';
import { useSyncStatus } from '../hooks/useSyncStatus';

export default function SyncStatusBanner() {
  const navigate = useNavigate();
  const { isOnline, isSyncing, pendingCount, failedCount, triggerSync } = useSyncStatus();
  const [dismissed, setDismissed] = useState(false);

  // If online and no pending or failed items, or if dismissed -> hide completely
  if ((isOnline && pendingCount === 0 && failedCount === 0) || dismissed) {
    return null;
  }

  // Determine toast color & gradient based on status
  const getBannerStyle = () => {
    if (!isOnline) {
      return {
        background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
        borderColor: '#f59e0b',
      };
    }
    if (failedCount > 0) {
      return {
        background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
        borderColor: '#ef4444',
      };
    }
    if (isSyncing) {
      return {
        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
        borderColor: '#38bdf8',
      };
    }
    return {
      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      borderColor: '#34d399',
    };
  };

  const bannerStyle = getBannerStyle();

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        zIndex: 99999,
        maxWidth: '380px',
        padding: '12px 16px',
        borderRadius: '12px',
        color: 'white',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
        border: `1px solid ${bannerStyle.borderColor}`,
        background: bannerStyle.background,
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        animation: 'slideUp 0.3s ease-out',
        fontSize: '12px',
        fontWeight: 600,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          {!isOnline ? (
            <>
              <WifiOff style={{ width: 16, height: 16, flexShrink: 0 }} />
              <span>Ngoại tuyến: {pendingCount} phiếu chờ đồng bộ</span>
            </>
          ) : isSyncing && pendingCount > 0 ? (
            <>
              <RefreshCw
                style={{
                  width: 16,
                  height: 16,
                  flexShrink: 0,
                  animation: 'spin 1s linear infinite',
                }}
              />
              <span>Đang đồng bộ {pendingCount} phiếu...</span>
            </>
          ) : failedCount > 0 ? (
            <>
              <AlertOctagon style={{ width: 16, height: 16, flexShrink: 0 }} />
              <span>{failedCount} phiếu gặp lỗi đồng bộ</span>
            </>
          ) : (
            <>
              <CheckCircle2 style={{ width: 16, height: 16, flexShrink: 0 }} />
              <span>Có {pendingCount} phiếu chờ đồng bộ</span>
            </>
          )}
        </div>

        <button
          onClick={() => setDismissed(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            padding: '2px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Đóng thông báo"
        >
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* Action buttons if needed */}
      {(failedCount > 0 || (isOnline && pendingCount > 0 && !isSyncing)) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '2px' }}>
          {failedCount > 0 && (
            <button
              onClick={() => navigate('/sync-conflicts')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                background: 'white',
                color: '#dc2626',
                fontWeight: 700,
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              Xử lý xung đột <ChevronRight style={{ width: 12, height: 12 }} />
            </button>
          )}

          {isOnline && pendingCount > 0 && !isSyncing && (
            <button
              onClick={() => triggerSync()}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.4)',
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                fontWeight: 700,
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <RefreshCw style={{ width: 11, height: 11 }} /> Đồng bộ ngay
            </button>
          )}
        </div>
      )}
    </div>
  );
}
