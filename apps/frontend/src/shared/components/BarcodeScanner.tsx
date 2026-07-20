import React, { useEffect, useRef, useState, useCallback } from 'react';
import './BarcodeScanner.css';

// ──── Types (theo format response tài liệu thiết kế) ──────────

/** Response data từ API GET /api/v1/scan/lookup */
export interface ScanLookupData {
  product_id?: string;
  internal_sku?: string;
  name: string;
  barcode: string;
  supplier?: string;
  is_external?: boolean;
  current_stock?: {
    total_physical: number;
    available: number;
    allocated: number;
  };
  location?: {
    zone_code: string;
    shelf_code: string;
  } | null;
  unit?: string | null;
  purchase_price?: number;
}

/** Cấu trúc response từ API scan */
interface ScanApiResponse {
  success: boolean;
  data?: ScanLookupData;
  error?: {
    code: string;
    message: string;
    details?: { scanned_code?: string };
  };
  meta?: unknown;
}

/** Props cho component cũ — giữ tương thích ngược */
export interface ScannedProduct {
  id: string;
  internalSku: string;
  supplierBarcode?: string;
  name: string;
  unit?: string;
  minimumStock: number;
  category: { id: string; name: string } | null;
  supplier: { id: string; name: string } | null;
  isExternal?: boolean;
  purchasePrice?: number;
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
  /**
   * Chế độ hoạt động:
   * - 'lookup': Quét → gọi API tra cứu → trả thông tin sản phẩm (sản phẩm phải có trong hệ thống)
   * - 'scan': Quét → trả chuỗi mã vạch thô ngay lập tức (không cần sản phẩm có trong hệ thống,
   *          dùng cho nhập hàng khi sản phẩm chưa tồn tại trong kho)
   * Default: 'lookup'
   */
  mode?: 'lookup' | 'scan';
  /** Called when a product is found after scanning/manual input (mode='lookup') */
  onProductFound?: (product: ScannedProduct, qty: number, price?: number) => void;
  /** Called when a barcode is decoded (mode='scan'). Returns raw barcode string. */
  onBarcodeScanned?: (barcode: string) => void;
  /** Whether to show qty dialog after scan. Default: true (only in 'lookup' mode) */
  showQtyDialog?: boolean;
  /** Default quantity. Default: 1 */
  defaultQty?: number;
  /** Title shown in modal header */
  title?: string;
  /** Allow opening the quick-add product form if not found. Default: true */
  allowQuickAdd?: boolean;
}

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

/**
 * Tra cứu sản phẩm qua API scan/lookup theo tài liệu thiết kế.
 * Endpoint: GET /api/v1/scan/lookup?barcode=...
 */
async function lookupBarcode(code: string): Promise<ScannedProduct> {
  const res = await fetch(
    `${API_BASE_URL}/v1/scan/lookup?barcode=${encodeURIComponent(code)}`,
    { headers: authHeaders() },
  );

  const payload: ScanApiResponse = await res.json().catch(() => ({
    success: false,
    error: { code: 'PARSE_ERROR', message: 'Lỗi parse response' },
  }));

  if (!res.ok || !payload.success) {
    const message =
      payload.error?.message || 'Không tìm thấy sản phẩm';
    throw new Error(message);
  }

  const d = payload.data!;

  if (d.is_external) {
    return {
      id: 'NEW',
      internalSku: '',
      supplierBarcode: d.barcode,
      name: d.name,
      unit: d.unit || undefined,
      minimumStock: 0,
      category: null,
      supplier: d.supplier ? { id: '', name: d.supplier } : null,
      isExternal: true,
      stockBalances: [],
      totalStock: 0,
    };
  }

  // Chuyển đổi response format tài liệu → ScannedProduct interface (tương thích ngược)
  return {
    id: d.product_id!,
    internalSku: d.internal_sku!,
    supplierBarcode: d.barcode,
    name: d.name,
    unit: d.unit || undefined,
    minimumStock: 0,
    category: null,
    supplier: null,
    isExternal: false,
    purchasePrice: d.purchase_price,
    stockBalances: d.location
      ? [
        {
          id: '',
          locationCode: d.location.shelf_code,
          totalPhysical: d.current_stock!.total_physical,
          allocated: d.current_stock!.allocated,
          available: d.current_stock!.available,
        },
      ]
      : [],
    totalStock: d.current_stock!.available,
  };
}

// ──── Audio Feedback ───────────────────────────────────────────

/** Phát tiếng beep ngắn khi quét thành công */
function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1200, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.15);

    // Cleanup
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      ctx.close();
    };
  } catch {
    // AudioContext không khả dụng — bỏ qua
  }
}

/** Rung nhẹ thiết bị (nếu hỗ trợ) */
function vibrate() {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }
  } catch {
    // Vibration API không khả dụng
  }
}

// ──── Component ────────────────────────────────────────────────

export default function BarcodeScanner({
  isOpen,
  onClose,
  mode = 'lookup',
  onProductFound,
  onBarcodeScanned,
  showQtyDialog = true,
  defaultQty = 1,
  title = 'Quét mã vạch / QR',
  allowQuickAdd = true,
}: BarcodeScannerProps) {
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [foundProduct, setFoundProduct] = useState<ScannedProduct | null>(null);
  const [scannedBarcode, setScannedBarcode] = useState<string>(''); // For scan mode
  const [qty, setQty] = useState(defaultQty);
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Quick Add State cho sản phẩm từ external API
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddPrice, setQuickAddPrice] = useState('');
  const [quickAddCategory, setQuickAddCategory] = useState('');

  // Barcode Exception Mapping State (US02.02)
  const [isMappingMode, setIsMappingMode] = useState(false);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [selectedMappingProductId, setSelectedMappingProductId] = useState('');

  const processingRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScannedRef = useRef<string>('');

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setManualCode('');
      setError('');
      setFoundProduct(null);
      setScannedBarcode('');
      setQty(defaultQty);
      setQuickAddName('');
      setQuickAddPrice('');
      setQuickAddCategory('');
      setIsMappingMode(false);
      setSelectedMappingProductId('');
      setAllProducts([]);
      processingRef.current = false;
      lastScannedRef.current = '';
    }
  }, [isOpen, defaultQty]);

  // Stop camera helper
  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    if (scanner) {
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
      } catch {
        // ignore cleanup errors
      }
    }
    setCameraActive(false);
  }, []);

  // Restart camera for next scan
  const restartCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner || !containerRef.current) return;

    try {
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.5,
        },
        (decodedText: string) => {
          if (!processingRef.current) {
            processingRef.current = true;
            handleScanWithDebounce(decodedText);
          }
        },
        () => { /* ignore scan failures */ },
      );
      setCameraActive(true);
    } catch {
      setCameraActive(false);
    }
  }, []);

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
              handleScanWithDebounce(decodedText);
            }
          },
          () => { /* ignore scan failures */ },
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
      // Clear debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const cleanupScanner = async () => {
        if (startPromise) {
          try { await startPromise; } catch { }
        }
        if (scanner) {
          try {
            if (scanner.isScanning) {
              await scanner.stop();
            }
            scanner.clear();
          } catch { }
        }
      };
      cleanupScanner();
      scannerRef.current = null;
      setCameraActive(false);
    };
  }, [isOpen]);

  /**
   * Debounce 300ms trước khi gọi API lookup.
   * Tránh spam API khi camera quét liên tục cùng một mã.
   */
  const handleScanWithDebounce = useCallback((code: string) => {
    // Bỏ qua nếu quét trùng mã vừa quét
    if (code === lastScannedRef.current) {
      processingRef.current = false;
      return;
    }

    // Phát beep + rung ngay khi nhận diện được mã (trước debounce)
    playBeep();
    vibrate();

    // Dừng camera ngay sau khi quét thành công
    stopCamera();

    // Debounce 300ms trước khi gọi API
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      lastScannedRef.current = code;
      handleScan(code);
    }, 300);
  }, [stopCamera]);

  const handleScan = useCallback(async (code: string) => {
    if (loading) return;

    // ─── Mode SCAN: trả raw barcode ngay, không cần gọi API ───
    if (mode === 'scan') {
      setScannedBarcode(code);
      if (onBarcodeScanned) {
        onBarcodeScanned(code);
        onClose();
      }
      return;
    }

    // ─── Mode LOOKUP: gọi API tra cứu sản phẩm trong hệ thống ───
    setLoading(true);
    setError('');
    setFoundProduct(null);

    try {
      const product = await lookupBarcode(code);
      
      // Nếu là chế độ không cho phép thêm nhanh (Xuất kho, Kiểm kê) mà sản phẩm lại chưa có trong hệ thống
      if (product.isExternal && allowQuickAdd === false) {
        throw new Error('Sản phẩm chưa có trong hệ thống. Không thể quét mã này ở chế độ hiện tại.');
      }

      setFoundProduct(product);

      if (product.isExternal) {
        setQuickAddName(product.name);
        setQuickAddPrice('0');
        setQuickAddCategory('');
      } else if (!showQtyDialog) {
        onProductFound?.(product, defaultQty);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi tra cứu sản phẩm');
      // Allow re-scanning after error — restart camera
      setTimeout(() => {
        processingRef.current = false;
        lastScannedRef.current = '';
        restartCamera();
      }, 2000);
    } finally {
      setLoading(false);
    }
  }, [loading, mode, showQtyDialog, defaultQty, allowQuickAdd, onProductFound, onBarcodeScanned, onClose, restartCamera]);

  const handleCreateExternalProduct = async () => {
    if (!quickAddName.trim()) {
      setError('Vui lòng nhập tên sản phẩm');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const internalSku = 'SKU' + Date.now().toString().slice(-6);
      const res = await fetch(`${API_BASE_URL}/products`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          internalSku,
          name: quickAddName,
          supplierBarcode: foundProduct?.supplierBarcode || scannedBarcode || lastScannedRef.current,
          price: Number(quickAddPrice) || 0,
        })
      });
      if (!res.ok) throw new Error('Lỗi tạo sản phẩm mới');
      const newProductData = await res.json();

      // Đồng bộ local storage cho fallback
      try {
        const stored = JSON.parse(localStorage.getItem('smart-wms-products') || '[]');
        stored.push({
          id: newProductData.id || crypto.randomUUID(),
          sku: internalSku,
          name: quickAddName,
          category: '',
          unit: '',
          defaultWarehouse: '',
          location: '',
          managementType: '',
          supplier: foundProduct?.supplier?.name || '',
          price: Number(quickAddPrice) || 0,
          stock: 0
        });
        localStorage.setItem('smart-wms-products', JSON.stringify(stored));
      } catch (e) { }

      const finalProduct: ScannedProduct = {
        id: newProductData.id || 'NEW_PROD',
        internalSku,
        supplierBarcode: foundProduct?.supplierBarcode || scannedBarcode || lastScannedRef.current,
        name: quickAddName,
        minimumStock: 0,
        category: null,
        supplier: foundProduct?.supplier || null,
        isExternal: false,
        purchasePrice: Number(quickAddPrice) || 0,
        stockBalances: [],
        totalStock: 0
      };

      onProductFound?.(finalProduct, qty, Number(quickAddPrice) || 0);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra khi tạo sản phẩm');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    processingRef.current = true;
    // Manual input: play beep, no need to stop camera
    playBeep();
    vibrate();
    stopCamera();
    handleScan(manualCode.trim());
  };

  const handleConfirmQty = () => {
    if (foundProduct && qty > 0) {
      onProductFound?.(foundProduct, qty, foundProduct.purchasePrice);
      // Reset for next scan
      setFoundProduct(null);
      setScannedBarcode('');
      setQty(defaultQty);
      setError('');
      processingRef.current = false;
      lastScannedRef.current = '';
      setManualCode('');
      // Restart camera for next scan
      restartCamera();
    }
  };

  const handleCancelProduct = () => {
    setFoundProduct(null);
    setScannedBarcode('');
    setError('');
    processingRef.current = false;
    lastScannedRef.current = '';
    setManualCode('');
    // Restart camera for next scan
    restartCamera();
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
          {!cameraActive && !loading && !foundProduct && (
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
          <div className="scanner-error" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="error-icon">❌</span>
              <span>{error}</span>
            </div>
            {error.includes('Không tìm thấy') && lastScannedRef.current && (
              <button
                type="button"
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await fetch(`${API_BASE_URL}/products`, { headers: authHeaders() });
                    if (res.ok) {
                      const data = await res.json();
                      setAllProducts(data || []);
                      setIsMappingMode(true);
                    }
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setLoading(false);
                  }
                }}
                style={{
                  marginTop: '4px',
                  padding: '8px 16px',
                  background: '#06b6d4',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(6,182,212,0.25)'
                }}
              >
                🔗 Liên kết mã vạch ngoại lệ
              </button>
            )}
          </div>
        )}

        {/* Scan Mode: hiển thị mã vạch đã quét */}
        {mode === 'scan' && scannedBarcode && (
          <div className="scanner-result">
            <div className="scanner-result-header">
              <div className="check-icon">✓</div>
              <span className="product-name">Đã nhận diện mã vạch</span>
            </div>
            <div className="scanner-result-details">
              <div className="scanner-result-item" style={{ gridColumn: '1 / -1' }}>
                <strong>Mã vạch:</strong> {scannedBarcode}
              </div>
            </div>
          </div>
        )}

        {/* Lookup Mode: hiển thị thông tin sản phẩm */}
        {mode === 'lookup' && foundProduct && !foundProduct.isExternal && (
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
              {foundProduct.stockBalances.length > 0 && (
                <div className="scanner-result-item">
                  <strong>Vị trí:</strong> {foundProduct.stockBalances[0].locationCode}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quantity Dialog (only in lookup mode & NOT external) */}
        {mode === 'lookup' && foundProduct && !foundProduct.isExternal && showQtyDialog && (
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

        {/* Quick Add Form cho sản phẩm External API */}
        {mode === 'lookup' && foundProduct && foundProduct.isExternal && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            borderRadius: 'inherit'
          }}>
            <div className="scanner-quick-add-form animate-fade-in-up" style={{
              width: '100%',
              maxWidth: '480px',
              textAlign: 'left',
              background: '#ffffff',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', background: '#06b6d4', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                  </div>
                  <h4 style={{ margin: 0, color: '#0f172a', fontSize: '18px', fontWeight: 700 }}>Tạo sản phẩm mới nhanh</h4>
                </div>
                <button
                  onClick={handleCancelProduct}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>

              {/* Form Body */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '6px', color: '#334155' }}>Mã vạch</label>
                  <input type="text" disabled value={foundProduct.supplierBarcode || scannedBarcode || lastScannedRef.current} style={{ width: '100%', background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', color: '#475569', fontSize: '14px', fontWeight: '500' }} />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '6px', color: '#334155' }}>Tên sản phẩm <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="text" value={quickAddName} onChange={(e) => setQuickAddName(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', color: '#0f172a', fontWeight: '500', transition: 'border-color 0.2s' }} placeholder="Nhập tên sản phẩm..." onFocus={(e) => e.target.style.borderColor = '#06b6d4'} onBlur={(e) => e.target.style.borderColor = '#cbd5e1'} autoFocus />
                </div>

                <div>
                  <label style={{ fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '6px', color: '#334155' }}>Nhà cung cấp</label>
                  <input type="text" disabled value={foundProduct.supplier?.name || ''} style={{ width: '100%', background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', color: '#475569', fontSize: '14px', fontWeight: '500' }} placeholder="Chưa có dữ liệu" />
                </div>

                <div>
                  <label style={{ fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '6px', color: '#334155' }}>Giá nhập (VND)</label>
                  <input type="number" value={quickAddPrice} onChange={(e) => setQuickAddPrice(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', color: '#0f172a', fontWeight: '500', transition: 'border-color 0.2s' }} placeholder="0" onFocus={(e) => e.target.style.borderColor = '#06b6d4'} onBlur={(e) => e.target.style.borderColor = '#cbd5e1'} />
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  style={{ padding: '8px 16px', borderRadius: '6px', background: '#ffffff', color: '#475569', fontWeight: '600', border: '1px solid #cbd5e1', cursor: 'pointer', transition: 'background 0.2s', fontSize: '14px' }}
                  onClick={handleCancelProduct}
                  disabled={loading}
                  onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#ffffff'}
                >
                  Hủy
                </button>
                <button
                  style={{ padding: '8px 20px', borderRadius: '6px', background: '#00a8a8', color: 'white', fontWeight: '600', border: 'none', cursor: 'pointer', transition: 'opacity 0.2s', fontSize: '14px' }}
                  onClick={handleCreateExternalProduct}
                  disabled={loading}
                  onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                  onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                >
                  {loading ? 'Đang tạo...' : 'Lưu và Thêm'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal ánh xạ mã vạch ngoại lệ */}
        {isMappingMode && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            borderRadius: 'inherit'
          }}>
            <div style={{
              width: '100%',
              maxWidth: '480px',
              textAlign: 'left',
              background: '#ffffff',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div>
                <h4 style={{ margin: 0, color: '#0f172a', fontSize: '18px', fontWeight: 700 }}>
                  Liên kết mã vạch ngoại lệ
                </h4>
                <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>
                  Ánh xạ mã vạch vừa quét với sản phẩm hiện có trong hệ thống
                </p>
              </div>

              <div>
                <label style={{ fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '6px', color: '#334155' }}>
                  Mã vạch lạ
                </label>
                <input
                  type="text"
                  disabled
                  value={lastScannedRef.current}
                  style={{ width: '100%', background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', color: '#475569', fontSize: '14px', fontWeight: '500' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '6px', color: '#334155' }}>
                  Chọn sản phẩm liên kết <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={selectedMappingProductId}
                  onChange={(e) => setSelectedMappingProductId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    outline: 'none',
                    fontSize: '14px',
                    color: '#0f172a',
                    background: 'white'
                  }}
                >
                  <option value="">-- Chọn sản phẩm hệ thống --</option>
                  {allProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.internalSku} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="button"
                  style={{ padding: '8px 16px', borderRadius: '6px', background: '#ffffff', color: '#475569', fontWeight: '600', border: '1px solid #cbd5e1', cursor: 'pointer', fontSize: '14px' }}
                  onClick={() => setIsMappingMode(false)}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={loading || !selectedMappingProductId}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '6px',
                    background: '#06b6d4',
                    color: 'white',
                    fontWeight: '600',
                    border: 'none',
                    cursor: selectedMappingProductId ? 'pointer' : 'not-allowed',
                    opacity: selectedMappingProductId ? 1 : 0.6
                  }}
                  onClick={async () => {
                    setLoading(true);
                    setError('');
                    try {
                      const res = await fetch(`${API_BASE_URL}/inbound/barcode-mappings`, {
                        method: 'POST',
                        headers: authHeaders(),
                        body: JSON.stringify({
                          barcode: lastScannedRef.current,
                          productId: selectedMappingProductId
                        })
                      });

                      if (!res.ok) throw new Error('Lỗi tạo liên kết mã vạch');

                      setIsMappingMode(false);
                      handleScan(lastScannedRef.current);
                    } catch (err: any) {
                      setError(err.message || 'Lỗi liên kết mã vạch');
                      setIsMappingMode(false);
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  {loading ? 'Đang liên kết...' : 'Liên kết & Thử lại'}
                </button>
              </div>
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
              {mode === 'scan' ? 'Sử dụng mã này' : 'Tra cứu'}
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
