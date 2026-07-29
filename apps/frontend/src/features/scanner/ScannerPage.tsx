import React, { useState, useCallback } from 'react';
import BarcodeScanner, { ScanBarcodeButton, type ScannedProduct } from '../../shared/components/BarcodeScanner';
import GoodsReceiptModal from './GoodsReceiptModal';
import OutboundReceiptModal from './OutboundReceiptModal';
import StocktakeReceiptModal from './StocktakeReceiptModal';
import { saveOfflineReceipt, getOfflineReceipts, deleteOfflineReceipt } from '../offline-sync/db/indexedDb';
import {
  QrCode,
  Camera,
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  CheckCircle2,
  Trash2,
  Plus,
  Minus,
  X,
  AlertCircle,
  Loader2,
  RefreshCw,
  ScanLine,
  Package,
  Layers,
  Building2,
  Check,
} from 'lucide-react';

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

export default function ScannerPage() {
  const [mode, setMode] = useState<ScanMode>('inbound');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showOutboundModal, setShowOutboundModal] = useState(false);
  const [showStocktakeModal, setShowStocktakeModal] = useState(false);

  const modeConfigs: Record<
    ScanMode,
    {
      icon: React.ReactNode;
      label: string;
      desc: string;
      colorClass: string;
      badgeClass: string;
    }
  > = {
    inbound: {
      icon: <ArrowDownToLine className="h-5 w-5" />,
      label: 'Nhập kho',
      desc: 'Quét mã vạch sản phẩm để lập phiếu nhập kho nhanh',
      colorClass: 'bg-emerald-500 text-white',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    outbound: {
      icon: <ArrowUpFromLine className="h-5 w-5" />,
      label: 'Xuất kho',
      desc: 'Quét mã vạch sản phẩm để lập phiếu xuất kho',
      colorClass: 'bg-amber-500 text-white',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    stocktake: {
      icon: <ClipboardList className="h-5 w-5" />,
      label: 'Kiểm kê kho',
      desc: 'Quét mã vạch sản phẩm để đối soát số lượng tồn kho',
      colorClass: 'bg-indigo-500 text-white',
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
  };

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleProductFound = useCallback(
    (product: ScannedProduct, qty: number) => {
      setScannedItems((prev) => {
        const existing = prev.findIndex((item) => item.product.id === product.id);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = { ...updated[existing], qty: updated[existing].qty + qty };
          return updated;
        }
        return [{ product, qty, timestamp: new Date() }, ...prev];
      });
      showToast('success', `Đã thêm ${product.name} — Số lượng: ${qty}`);
    },
    [showToast]
  );

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

  // ──── Automatic Offline Synchronization ─────────────────────

  const syncOfflineReceipts = useCallback(async () => {
    try {
      const receipts = await getOfflineReceipts();
      if (receipts.length === 0) return;

      let successCount = 0;
      for (const receipt of receipts) {
        let res;
        if (receipt.type === 'inbound') {
          res = await fetch(`${API_BASE_URL}/inbound/purchase-orders`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
              items: receipt.items,
              supplierName: receipt.supplierName,
              supplierId: receipt.supplierId,
            }),
          });
        } else if (receipt.type === 'outbound') {
          res = await fetch(`${API_BASE_URL}/outbounds`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
              details: receipt.items,
            }),
          });
        } else if (receipt.type === 'stocktake') {
          res = await fetch(`${API_BASE_URL}/inventory/stocktakes`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
              locationCode: receipt.locationCode || 'DEFAULT',
              productIds: receipt.productIds,
            }),
          });
        }

        if (res && res.ok) {
          if (receipt.id !== undefined) {
            await deleteOfflineReceipt(receipt.id);
            successCount++;
          }
        }
      }

      if (successCount > 0) {
        showToast('success', `Đã tự động đồng bộ ${successCount} phiếu lưu ngoại tuyến lên hệ thống!`);
      }
    } catch (err) {
      console.warn('Lỗi khi tự động đồng bộ offline receipts:', err);
    }
  }, [showToast]);

  React.useEffect(() => {
    if (navigator.onLine) {
      syncOfflineReceipts();
    }

    const handleOnline = () => {
      syncOfflineReceipts();
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [syncOfflineReceipts]);

  // ──── Submit Handlers ───────────────────────────────────────

  const submitInbound = async () => {
    if (scannedItems.length === 0) return;
    setSubmitting(true);
    try {
      const firstSupplier = scannedItems.find((item) => item.product.supplier)?.product.supplier;

      if (!navigator.onLine) {
        await saveOfflineReceipt({
          timestamp: Date.now(),
          items: scannedItems.map((item) => ({
            productId: item.product.id,
            expectedQty: item.qty,
            receivedQty: 0,
          })),
          supplierName: firstSupplier?.name,
          supplierId: firstSupplier?.id,
          type: 'inbound',
        });
        showToast('success', 'Đang ngoại tuyến. Phiếu nhập kho đã được lưu cục bộ và sẽ tự động đồng bộ khi có kết nối.');
        setScannedItems([]);
        setShowReceiptModal(false);
        return;
      }

      const payload: any = {
        items: scannedItems.map((item) => ({
          productId: item.product.id,
          expectedQty: item.qty,
          receivedQty: 0,
        })),
      };
      if (firstSupplier?.name) {
        payload.supplierName = firstSupplier.name;
      }
      if (firstSupplier?.id) {
        payload.supplierId = firstSupplier.id;
      }
      const res = await fetch(`${API_BASE_URL}/inbound/purchase-orders`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Lỗi tạo phiếu nhập kho');
      showToast('success', `Đã tạo phiếu nhập kho với ${scannedItems.length} sản phẩm`);
      setScannedItems([]);
      setShowReceiptModal(false);
    } catch (err: any) {
      showToast('error', err.message || 'Lỗi tạo phiếu nhập kho');
    } finally {
      setSubmitting(false);
    }
  };

  const submitOutbound = async () => {
    if (scannedItems.length === 0) return;
    setSubmitting(true);
    try {
      if (!navigator.onLine) {
        await saveOfflineReceipt({
          timestamp: Date.now(),
          items: scannedItems.map((item) => ({
            productId: item.product.id,
            requiredQty: item.qty,
          })),
          type: 'outbound',
        });
        showToast('success', 'Đang ngoại tuyến. Phiếu xuất kho đã được lưu cục bộ và sẽ tự động đồng bộ khi có kết nối.');
        setScannedItems([]);
        return;
      }

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
      showToast('success', `Đã tạo phiếu xuất kho với ${scannedItems.length} sản phẩm`);
      setScannedItems([]);
    } catch (err: any) {
      showToast('error', err.message || 'Lỗi tạo phiếu xuất kho');
    } finally {
      setSubmitting(false);
    }
  };

  const submitStocktake = async () => {
    if (scannedItems.length === 0) return;
    setSubmitting(true);
    try {
      if (!navigator.onLine) {
        await saveOfflineReceipt({
          timestamp: Date.now(),
          items: [],
          productIds: scannedItems.map((item) => item.product.id),
          locationCode: 'DEFAULT',
          type: 'stocktake',
        });
        showToast('success', 'Đang ngoại tuyến. Phiếu kiểm kê đã được lưu cục bộ và sẽ tự động đồng bộ khi có kết nối.');
        setScannedItems([]);
        return;
      }

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
      showToast('success', `Đã tạo phiên kiểm kê với ${scannedItems.length} sản phẩm`);
      setScannedItems([]);
    } catch (err: any) {
      showToast('error', err.message || 'Lỗi tạo phiên kiểm kê');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (scannedItems.length === 0) return;
    if (mode === 'inbound') {
      setShowReceiptModal(true);
    } else if (mode === 'outbound') {
      setShowOutboundModal(true);
    } else {
      setShowStocktakeModal(true);
    }
  };

  const totalItems = scannedItems.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER SECTION - CYAN DESIGN SYSTEM */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-md">
            <QrCode className="h-5 w-5 text-cyan-100" />
            <h1 className="text-lg font-bold tracking-tight text-white">Trạm Quét Mã Vạch / QR Code</h1>
          </div>

        </div>

        {/* MODE SELECTOR */}
        <div className="inline-flex rounded-2xl border-2 border-slate-200 bg-white p-1.5 shadow-sm">
          {(Object.keys(modeConfigs) as ScanMode[]).map((m) => {
            const cfg = modeConfigs[m];
            const isActive = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all cursor-pointer ${isActive
                    ? 'bg-cyan-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
              >
                {cfg.icon}
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* SCAN ACTION BANNER CARD */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-cyan-500 bg-white p-8 text-center shadow-lg">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border-2 border-cyan-200 bg-cyan-50 text-cyan-600 shadow-inner">
          <ScanLine className="h-10 w-10 animate-pulse" />
        </div>

        <h2 className="mt-4 text-xl font-black text-slate-900">
          Chế độ hiện tại: <span className="text-cyan-600">{modeConfigs[mode].label}</span>
        </h2>
        <p className="mt-1 text-sm font-medium text-slate-500">{modeConfigs[mode].desc}</p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <ScanBarcodeButton onClick={() => setScannerOpen(true)} label="Bắt đầu quét Camera" />
        </div>

        <p className="mt-4 text-xs font-semibold text-slate-400">
          Định dạng hỗ trợ: QR Code, EAN-13, Code-128, UPC-A, Data Matrix và các mã vạch nhà cung cấp
        </p>

        {/* Decorative background glow */}
        <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-cyan-500/5 blur-2xl pointer-events-none" />
      </div>

      {/* SCANNED ITEMS LIST */}
      {scannedItems.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Package className="h-5 w-5 text-cyan-600" />
              Danh Sách Đã Quét ({scannedItems.length} Mặt hàng · {totalItems} Đơn vị)
            </h2>
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              Xóa tất cả
            </button>
          </div>

          <div className="space-y-3">
            {scannedItems.map((item, index) => (
              <div
                key={`${item.product.id}-${index}`}
                className="group relative flex flex-col gap-3 rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm transition hover:border-cyan-500 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-black text-slate-900 text-base">{item.product.name}</span>
                    <span className={`rounded-lg border px-2 py-0.5 text-xs font-bold ${modeConfigs[mode].badgeClass}`}>
                      {modeConfigs[mode].label}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500">
                    <span>
                      SKU: <strong className="text-slate-800">{item.product.internalSku}</strong>
                    </span>
                    {item.product.supplierBarcode && (
                      <span>
                        Barcode: <strong className="text-slate-800">{item.product.supplierBarcode}</strong>
                      </span>
                    )}
                    <span>
                      Tồn kho hiện tại:{' '}
                      <strong className={item.product.totalStock > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                        {item.product.totalStock}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* QUANTITY CONTROLS */}
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <button
                    type="button"
                    onClick={() => updateQty(index, item.qty - 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-200 bg-slate-50 font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    value={item.qty}
                    onChange={(e) => updateQty(index, parseInt(e.target.value) || 1)}
                    min={1}
                    className="h-9 w-16 rounded-xl border-2 border-slate-200 text-center font-black text-slate-900 focus:border-cyan-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => updateQty(index, item.qty + 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-200 bg-slate-50 font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="ml-2 flex h-9 w-9 items-center justify-center rounded-xl border-2 border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer"
                    title="Xóa sản phẩm này"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* SUBMIT ACTIONS BAR */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl border-2 border-cyan-500 bg-cyan-50 px-6 py-3 font-bold text-cyan-700 shadow-sm transition hover:bg-cyan-100 cursor-pointer"
            >
              <Camera className="h-5 w-5" />
              Quét thêm sản phẩm
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-2xl border-2 border-cyan-500 bg-cyan-600 px-8 py-3 font-bold text-white shadow-md transition hover:bg-cyan-700 disabled:opacity-50 cursor-pointer active:scale-95"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  <span>Tạo Phiếu {modeConfigs[mode].label}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* SCANNER MODAL */}
      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onProductFound={handleProductFound}
        title={`Quét ${modeConfigs[mode].label}`}
        allowQuickAdd={mode === 'inbound'}
      />

      {/* MODALS PREVIEW */}
      <GoodsReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        onConfirm={submitInbound}
        items={scannedItems}
        isSubmitting={submitting}
      />

      <OutboundReceiptModal
        isOpen={showOutboundModal}
        onClose={() => setShowOutboundModal(false)}
        onConfirm={() => {
          setShowOutboundModal(false);
          submitOutbound();
        }}
        items={scannedItems}
        isSubmitting={submitting}
      />

      <StocktakeReceiptModal
        isOpen={showStocktakeModal}
        onClose={() => setShowStocktakeModal(false)}
        onConfirm={() => {
          setShowStocktakeModal(false);
          submitStocktake();
        }}
        items={scannedItems}
        isSubmitting={submitting}
      />

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[10001] flex items-center gap-2.5 rounded-2xl px-6 py-3.5 font-bold text-white shadow-2xl animate-in fade-in slide-in-from-bottom-5 border-2 ${toast.type === 'success' ? 'bg-emerald-600 border-emerald-400' : 'bg-rose-600 border-rose-400'
            }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
