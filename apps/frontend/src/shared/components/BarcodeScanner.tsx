import React, { useEffect, useRef, useState, useCallback } from 'react';
import './BarcodeScanner.css';

// ──── Types ────────────────────────────────────────────────────

export interface ScannedProduct {
  id: string;
  internalSku: string;
  supplierBarcode?: string;
  name: string;
  unit?: string;
  minimumStock: number;
  category: { id: string; name: string } | null;
  supplier: { id: string; name: string } | null;
  stockBalances: Array<{
    id: string;
    locationCode: string;
    totalPhysical: number;
    allocated: number;
    available: number;
  }>;
  totalStock: number;
}

export interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when a product is found after scanning/manual input */
  onProductFound: (product: ScannedProduct, qty: number) => void;
  /** Whether to show qty dialog after scan. Default: true */
  showQtyDialog?: boolean;
  /** Default quantity. Default: 1 */
  defaultQty?: number;
  /** Title shown in modal header */
  title?: string;
}

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

async function lookupBarcode(code: string): Promise<ScannedProduct> {
  const res = await fetch(`${API_BASE_URL}/products/barcode-lookup/${encodeURIComponent(code)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.message || 'Không tìm thấy sản phẩm');
  }
  return res.json();
}

// ──── Component ────────────────────────────────────────────────

export default function BarcodeScanner({
  isOpen,
  onClose,
  onProductFound,
  showQtyDialog = true,
  defaultQty = 1,
  title = 'Quét mã vạch / QR',
}: BarcodeScannerProps) {
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [foundProduct, setFoundProduct] = useState<ScannedProduct | null>(null);
  const [qty, setQty] = useState(defaultQty);
  const [cameraActive, setCameraActive] = useState(false);
  const processingRef = useRef(false);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setManualCode('');
      setError('');
      setFoundProduct(null);
      setQty(defaultQty);
      processingRef.current = false;
    }
  }, [isOpen, defaultQty]);

  // Initialize html5-qrcode scanner
  useEffect(() => {
    if (!isOpen) return;

    let scanner: any = null;
    let mounted = true;
    let startPromise: Promise<any> | null = null;

    const initScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');

        if (!mounted || !containerRef.current) return;

        // Create a div for the scanner if not already there
        let scanEl = document.getElementById('barcode-scanner-viewport');
        if (!scanEl) {
          scanEl = document.createElement('div');
          scanEl.id = 'barcode-scanner-viewport';
          containerRef.current.appendChild(scanEl);
        }

        scanner = new Html5Qrcode('barcode-scanner-viewport');
        scannerRef.current = scanner;

        startPromise = scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.5,
          },
          (decodedText: string) => {
            if (!processingRef.current) {
              processingRef.current = true;
              handleScan(decodedText);
            }
          },
          () => { /* ignore scan failures */ }
        );

        await startPromise;
        if (mounted) setCameraActive(true);
      } catch (err: any) {
        console.warn('Camera init failed:', err);
        if (mounted) {
          setCameraActive(false);
          // Camera might not be available, user can use manual input
        }
      }
    };

    // Delay slightly to allow DOM to render
    const timer = setTimeout(initScanner, 300);

    return () => {
      mounted = false;
      clearTimeout(timer);
      const cleanupScanner = async () => {
        if (startPromise) {
          try { await startPromise; } catch (e) {}
        }
        if (scanner) {
          try {
            if (scanner.isScanning) {
              await scanner.stop();
            }
            scanner.clear();
          } catch (e) {}
        }
      };
      cleanupScanner();
      scannerRef.current = null;
      setCameraActive(false);
    };
  }, [isOpen]);

  const handleScan = useCallback(async (code: string) => {
    if (loading) return;
    setLoading(true);
    setError('');
    setFoundProduct(null);

    try {
      const product = await lookupBarcode(code);
      setFoundProduct(product);

      if (!showQtyDialog) {
        onProductFound(product, defaultQty);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi tra cứu sản phẩm');
      // Allow re-scanning after error
      setTimeout(() => {
        processingRef.current = false;
      }, 2000);
    } finally {
      setLoading(false);
    }
  }, [loading, showQtyDialog, defaultQty, onProductFound, onClose]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    processingRef.current = true;
    handleScan(manualCode.trim());
  };

  const handleConfirmQty = () => {
    if (foundProduct && qty > 0) {
      onProductFound(foundProduct, qty);
      // Reset for next scan
      setFoundProduct(null);
      setQty(defaultQty);
      setError('');
      processingRef.current = false;
      setManualCode('');
    }
  };

  const handleCancelProduct = () => {
    setFoundProduct(null);
    setError('');
    processingRef.current = false;
    setManualCode('');
  };

  if (!isOpen) return null;

  return (
    <div className="scanner-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="scanner-modal">
        {/* Header */}
        <div className="scanner-header">
          <h3>
            <span className="scanner-icon">📷</span>
            {title}
          </h3>
          <button className="scanner-close-btn" onClick={onClose} title="Đóng">
            ✕
          </button>
        </div>

        {/* Scanner Viewport */}
        <div className="scanner-viewport">
          <div ref={containerRef} style={{ width: '100%', minHeight: '260px' }} />
          {cameraActive && (
            <>
              <div className="scanner-laser" />
              <div className="scanner-corners">
                <div className="scanner-corner-bl" />
                <div className="scanner-corner-br" />
              </div>
            </>
          )}
          {!cameraActive && !loading && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              fontSize: '14px',
              gap: '8px',
            }}>
              <span style={{ fontSize: '40px' }}>📷</span>
              <span>Camera chưa sẵn sàng</span>
              <span style={{ fontSize: '12px', color: '#475569' }}>Sử dụng nhập thủ công bên dưới</span>
            </div>
          )}
        </div>

        {/* Camera status */}
        {cameraActive && (
          <div className="scanner-status">
            <div className="pulse" />
            Camera đang hoạt động — Hướng mã vạch vào khung hình
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="scanner-status">
            <span style={{ animation: 'pulse 1s ease-in-out infinite' }}>⏳</span>
            Đang tra cứu sản phẩm...
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="scanner-error">
            <span className="error-icon">❌</span>
            {error}
          </div>
        )}

        {/* Product Found */}
        {foundProduct && (
          <div className="scanner-result">
            <div className="scanner-result-header">
              <div className="check-icon">✓</div>
              <span className="product-name">{foundProduct.name}</span>
            </div>
            <div className="scanner-result-details">
              <div className="scanner-result-item">
                <strong>SKU:</strong> {foundProduct.internalSku}
              </div>
              <div className="scanner-result-item">
                <strong>ĐVT:</strong> {foundProduct.unit || '—'}
              </div>
              {foundProduct.supplierBarcode && (
                <div className="scanner-result-item">
                  <strong>Barcode:</strong> {foundProduct.supplierBarcode}
                </div>
              )}
              <div className="scanner-result-item">
                <strong>Tồn kho:</strong> {foundProduct.totalStock}
              </div>
            </div>
          </div>
        )}

        {/* Quantity Dialog */}
        {foundProduct && showQtyDialog && (
          <div className="scanner-qty-dialog">
            <label>Nhập số lượng:</label>
            <div className="scanner-qty-row">
              <input
                type="number"
                className="scanner-qty-input"
                value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmQty();
                }}
              />
              <button className="scanner-qty-confirm" onClick={handleConfirmQty}>
                ✓ Xác nhận
              </button>
              <button className="scanner-qty-cancel" onClick={handleCancelProduct}>
                Hủy
              </button>
            </div>
          </div>
        )}

        {/* Manual Input */}
        <form className="scanner-manual" onSubmit={handleManualSubmit}>
          <label className="scanner-manual-label">Hoặc nhập mã thủ công:</label>
          <div className="scanner-manual-row">
            <input
              type="text"
              className="scanner-manual-input"
              placeholder="Nhập mã vạch, SKU, hoặc mã QR..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              disabled={loading}
              autoFocus
            />
            <button type="submit" className="scanner-manual-btn" disabled={loading || !manualCode.trim()}>
              Tra cứu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ──── Scan Button (for embedding in forms) ─────────────────────

export function ScanBarcodeButton({
  onClick,
  label = 'Quét mã vạch',
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button type="button" className="scan-barcode-btn" onClick={onClick}>
      <span className="scan-icon">📷</span>
      {label}
    </button>
  );
}
