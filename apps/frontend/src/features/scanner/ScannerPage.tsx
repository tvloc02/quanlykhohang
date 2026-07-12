import React, { useState, useCallback } from 'react';
import BarcodeScanner, { ScanBarcodeButton, type ScannedProduct } from '../../shared/components/BarcodeScanner';
import GoodsReceiptModal from './GoodsReceiptModal';

// ──── Types ────────────────────────────────────────────────────

type ScanMode = 'inbound' | 'outbound' | 'stocktake';

export interface ScannedItem {
  product: ScannedProduct;
  qty: number;
  timestamp: Date;
}

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

// ──── Styles ───────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
  color: '#e2e8f0',
  fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
};

const containerStyle: React.CSSProperties = {
  maxWidth: '900px',
  margin: '0 auto',
  padding: '24px 16px',
};

const headerStyle: React.CSSProperties = {
  textAlign: 'center' as const,
  marginBottom: '32px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: 700,
  background: 'linear-gradient(135deg, #6366f1, #a78bfa)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  marginBottom: '8px',
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#64748b',
};

const modeBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  justifyContent: 'center',
  marginBottom: '28px',
  flexWrap: 'wrap' as const,
};

const modeBtnBase: React.CSSProperties = {
  padding: '12px 24px',
  borderRadius: '12px',
  border: '2px solid transparent',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const scanAreaStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  gap: '20px',
  padding: '40px 20px',
  background: 'rgba(255,255,255,0.03)',
  borderRadius: '16px',
  border: '1px solid rgba(255,255,255,0.06)',
  marginBottom: '24px',
};

const listHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '16px',
};

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px',
  padding: '16px',
  marginBottom: '10px',
  transition: 'all 0.2s',
};

const badgeStyle = (mode: ScanMode): React.CSSProperties => {
  const colors = {
    inbound: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', text: '#4ade80' },
    outbound: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', text: '#f87171' },
    stocktake: { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', text: '#60a5fa' },
  };
  const c = colors[mode];
  return {
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 600,
    background: c.bg,
    border: `1px solid ${c.border}`,
    color: c.text,
  };
};

const actionBtnStyle: React.CSSProperties = {
  padding: '12px 28px',
  borderRadius: '12px',
  border: 'none',
  fontSize: '15px',
  fontWeight: 700,
  cursor: 'pointer',
  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
  color: '#fff',
  transition: 'all 0.2s',
  boxShadow: '0 4px 16px rgba(34,197,94,0.25)',
};

const toastStyle = (type: 'success' | 'error'): React.CSSProperties => ({
  position: 'fixed' as const,
  bottom: '24px',
  left: '50%',
  transform: 'translateX(-50%)',
  padding: '14px 28px',
  borderRadius: '12px',
  fontSize: '14px',
  fontWeight: 600,
  color: '#fff',
  zIndex: 10001,
  animation: 'scannerFadeIn 0.3s ease-out',
  background: type === 'success' ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
  boxShadow: type === 'success' ? '0 8px 32px rgba(34,197,94,0.3)' : '0 8px 32px rgba(239,68,68,0.3)',
});

// ──── Component ────────────────────────────────────────────────

export default function ScannerPage() {
  const [mode, setMode] = useState<ScanMode>('inbound');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const modeLabels: Record<ScanMode, { icon: string; label: string; desc: string }> = {
    inbound: { icon: '📥', label: 'Nhập kho', desc: 'Quét sản phẩm để tạo phiếu nhập kho' },
    outbound: { icon: '📤', label: 'Xuất kho', desc: 'Quét sản phẩm để tạo phiếu xuất kho' },
    stocktake: { icon: '📋', label: 'Kiểm kê', desc: 'Quét sản phẩm để thêm vào phiên kiểm kê' },
  };

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleProductFound = useCallback((product: ScannedProduct, qty: number) => {
    // Check if product already in list -> increase qty
    setScannedItems((prev) => {
      const existing = prev.findIndex((item) => item.product.id === product.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], qty: updated[existing].qty + qty };
        return updated;
      }
      return [{ product, qty, timestamp: new Date() }, ...prev];
    });
    showToast('success', `✓ ${product.name} — SL: ${qty}`);
  }, [showToast]);

  const removeItem = (index: number) => {
    setScannedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateQty = (index: number, newQty: number) => {
    if (newQty < 1) return;
    setScannedItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], qty: newQty };
      return updated;
    });
  };

  const clearAll = () => {
    setScannedItems([]);
  };

  // ──── Submit to backend ────────────────────────────────────

  const submitInbound = async () => {
    if (scannedItems.length === 0) return;
    setSubmitting(true);
    try {
      // Lấy thông tin NCC từ sản phẩm đã quét (không cần có trong DB)
      const firstSupplier = scannedItems.find((item) => item.product.supplier)?.product.supplier;
      const payload: any = {
        items: scannedItems.map((item) => ({
          productId: item.product.id,
          expectedQty: item.qty,
          receivedQty: 0,
          // Không truyền unitPrice để backend tự tra cứu giá từ bảng SupplierProduct
        })),
      };
      // Truyền supplierName (tên NCC text) để hiển thị đúng trên đơn hàng
      if (firstSupplier?.name) {
        payload.supplierName = firstSupplier.name;
      }
      // Truyền supplierId nếu NCC đã có trong DB
      if (firstSupplier?.id) {
        payload.supplierId = firstSupplier.id;
      }
      const res = await fetch(`${API_BASE_URL}/inbound/purchase-orders`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Lỗi tạo phiếu nhập kho');
      showToast('success', `✓ Đã tạo phiếu nhập kho với ${scannedItems.length} sản phẩm`);
      setScannedItems([]);
      setShowReceiptModal(false);
    } catch (err: any) {
      showToast('error', err.message || 'Lỗi tạo phiếu');
    } finally {
      setSubmitting(false);
    }
  };

  const submitOutbound = async () => {
    if (scannedItems.length === 0) return;
    setSubmitting(true);
    try {
      const payload = {
        details: scannedItems.map((item) => ({
          productId: item.product.id,
          requiredQty: item.qty,
        })),
      };
      const res = await fetch(`${API_BASE_URL}/outbounds`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Lỗi tạo phiếu xuất kho');
      showToast('success', `✓ Đã tạo phiếu xuất kho với ${scannedItems.length} sản phẩm`);
      setScannedItems([]);
    } catch (err: any) {
      showToast('error', err.message || 'Lỗi tạo phiếu');
    } finally {
      setSubmitting(false);
    }
  };

  const submitStocktake = async () => {
    if (scannedItems.length === 0) return;
    setSubmitting(true);
    try {
      const payload = {
        locationCode: 'DEFAULT',
        productIds: scannedItems.map((item) => item.product.id),
      };
      const res = await fetch(`${API_BASE_URL}/inventory/stocktakes`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Lỗi tạo phiên kiểm kê');
      showToast('success', `✓ Đã tạo phiên kiểm kê với ${scannedItems.length} sản phẩm`);
      setScannedItems([]);
    } catch (err: any) {
      showToast('error', err.message || 'Lỗi tạo phiên kiểm kê');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (mode === 'inbound') {
      if (scannedItems.length > 0) setShowReceiptModal(true);
    } else if (mode === 'outbound') {
      submitOutbound();
    } else {
      submitStocktake();
    }
  };

  const totalItems = scannedItems.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <h1 style={titleStyle}>📱 Quét mã vạch / QR</h1>
          <p style={subtitleStyle}>Quét sản phẩm bằng camera để nhập kho, xuất kho, hoặc kiểm kê</p>
        </div>

        {/* Mode Selector */}
        <div style={modeBarStyle}>
          {(Object.keys(modeLabels) as ScanMode[]).map((m) => (
            <button
              key={m}
              style={{
                ...modeBtnBase,
                background: mode === m ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                borderColor: mode === m ? '#6366f1' : 'rgba(255,255,255,0.08)',
                color: mode === m ? '#a5b4fc' : '#94a3b8',
              }}
              onClick={() => setMode(m)}
            >
              <span>{modeLabels[m].icon}</span>
              {modeLabels[m].label}
            </button>
          ))}
        </div>

        {/* Scan Area */}
        <div style={scanAreaStyle}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>
            {modeLabels[mode].icon}
          </div>
          <p style={{ color: '#94a3b8', fontSize: '15px', textAlign: 'center' }}>
            {modeLabels[mode].desc}
          </p>
          <ScanBarcodeButton
            onClick={() => setScannerOpen(true)}
            label="Bắt đầu quét"
          />
          <p style={{ color: '#475569', fontSize: '12px' }}>
            Hỗ trợ: QR Code, EAN-13, Code-128, UPC-A, và nhiều định dạng khác
          </p>
        </div>

        {/* Scanned Items List */}
        {scannedItems.length > 0 && (
          <>
            <div style={listHeaderStyle}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
                Danh sách đã quét ({scannedItems.length} SP · {totalItems} đơn vị)
              </h2>
              <button
                onClick={clearAll}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(239,68,68,0.3)',
                  background: 'rgba(239,68,68,0.08)',
                  color: '#f87171',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                🗑 Xóa tất cả
              </button>
            </div>

            {scannedItems.map((item, index) => (
              <div key={`${item.product.id}-${index}`} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '15px' }}>{item.product.name}</span>
                      <span style={badgeStyle(mode)}>{modeLabels[mode].label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#94a3b8', flexWrap: 'wrap' }}>
                      <span>SKU: <strong style={{ color: '#cbd5e1' }}>{item.product.internalSku}</strong></span>
                      {item.product.supplierBarcode && (
                        <span>Barcode: <strong style={{ color: '#cbd5e1' }}>{item.product.supplierBarcode}</strong></span>
                      )}
                      <span>Tồn kho: <strong style={{ color: item.product.totalStock > 0 ? '#4ade80' : '#f87171' }}>{item.product.totalStock}</strong></span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      onClick={() => updateQty(index, item.qty - 1)}
                      style={{
                        width: '28px', height: '28px', borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)',
                        color: '#94a3b8', cursor: 'pointer', fontSize: '16px',
                      }}
                    >−</button>
                    <input
                      type="number"
                      value={item.qty}
                      onChange={(e) => updateQty(index, parseInt(e.target.value) || 1)}
                      style={{
                        width: '50px', textAlign: 'center' as const, padding: '4px',
                        borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '14px',
                      }}
                      min={1}
                    />
                    <button
                      onClick={() => updateQty(index, item.qty + 1)}
                      style={{
                        width: '28px', height: '28px', borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)',
                        color: '#94a3b8', cursor: 'pointer', fontSize: '16px',
                      }}
                    >+</button>
                    <button
                      onClick={() => removeItem(index)}
                      style={{
                        width: '28px', height: '28px', borderRadius: '6px',
                        border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.08)',
                        color: '#f87171', cursor: 'pointer', fontSize: '14px', marginLeft: '4px',
                      }}
                    >✕</button>
                  </div>
                </div>
              </div>
            ))}

            {/* Submit Button */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
              <button
                onClick={() => setScannerOpen(true)}
                style={{
                  padding: '12px 28px',
                  borderRadius: '12px',
                  border: '2px solid rgba(99,102,241,0.3)',
                  background: 'rgba(99,102,241,0.08)',
                  color: '#a5b4fc',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                📷 Quét thêm
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  ...actionBtnStyle,
                  opacity: submitting ? 0.7 : 1,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? '⏳ Đang xử lý...' : `✓ Tạo phiếu ${modeLabels[mode].label}`}
              </button>
            </div>
          </>
        )}

        {/* Scanner Modal */}
        <BarcodeScanner
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onProductFound={handleProductFound}
          title={`Quét ${modeLabels[mode].label}`}
        />

        {/* Goods Receipt Preview Modal */}
        <GoodsReceiptModal
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          onConfirm={submitInbound}
          items={scannedItems}
          isSubmitting={submitting}
        />

        {/* Toast */}
        {toast && (
          <div style={toastStyle(toast.type)}>
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}
