import React, { useState, useMemo } from 'react';
import {
  X,
  Check,
  Plus,
  Trash2,
  Warehouse,
  Package,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { findStockBinForProduct } from '../pages/CreateStocktakeOrderPage';

const API_BASE = 'http://localhost:3000/api';

function authHeaders() {
  const token = localStorage.getItem('token') || '';
  const userStr = localStorage.getItem('user');
  let role = '';
  let permissions: string[] = [];
  try {
    if (userStr) {
      const u = JSON.parse(userStr);
      role = u.role || (u.roles && u.roles[0]?.name) || '';
      permissions = u.permissions || [];
    }
  } catch {}

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (userStr) {
    try {
      headers['x-user'] = encodeURIComponent(userStr);
    } catch {}
  }
  if (role) {
    try {
      headers['x-role'] = encodeURIComponent(role);
    } catch {}
  }
  if (permissions.length) {
    try {
      headers['x-permissions'] = encodeURIComponent(permissions.join(','));
    } catch {
      headers['x-permissions'] = permissions.join(',');
    }
  }
  return headers;
}

export interface ShelfAllocation {
  id: string;
  binCode: string;
  qty: number;
}

export interface ProductApprovalItem {
  detailId: string;
  productId: string;
  productSku: string;
  productName: string;
  unit: string;
  systemQty: number;
  originalCountedQty: number;
  zonePrefix: string;
  shelves: ShelfAllocation[];
}

interface StocktakeApproveShelfModalProps {
  stocktake: any;
  onClose: () => void;
  onApproved: (updatedStocktake: any) => void;
  onError: (msg: string) => void;
}

// Helper to parse shelf names & counts from note string
function parseShelvesFromNote(note: string, defaultQty: number, pId: string, pSku: string, pName: string, whCode: string): { zonePrefix: string; shelves: ShelfAllocation[] } {
  let zonePrefix = '';
  const shelves: ShelfAllocation[] = [];
  const foundBinCodes: Array<{ code: string; qty?: number }> = [];

  if (note) {
    // 1. Extract zone prefix if present: e.g. [Phân Khu Kho Thường 1]
    const zoneMatch = note.match(/\[(Phân Khu[^\]]+)\]/i);
    if (zoneMatch) {
      zonePrefix = zoneMatch[1];
    }

    // 2. Extract shelf section: [Kệ: ...] or Kệ: ...
    const shelfMatch = note.match(/\[?Kệ:\s*([^\]]+)\]?/i);
    if (shelfMatch) {
      const shelfContent = shelfMatch[1];
      // Split by comma
      const tokens = shelfContent.split(',').map((t) => t.trim()).filter(Boolean);
      tokens.forEach((t) => {
        // e.g. "H4 (400 cái)" or "H4 [400 cái]" or "H4: 400" or "H4"
        const qtyMatch = t.match(/^([^(:\\[]+)(?:[:(\[]\s*(\d+))?/);
        if (qtyMatch) {
          const rawCode = qtyMatch[1].trim();
          // Clean code: remove long warehouse prefixes if duplicate like KH009-ZONE-A-R01-D4 -> D4
          const cleanCode = (rawCode.split('-').pop() || rawCode).trim().toUpperCase();
          const parsedQty = qtyMatch[2] ? parseInt(qtyMatch[2], 10) : undefined;
          if (cleanCode && !foundBinCodes.some((b) => b.code === cleanCode)) {
            foundBinCodes.push({ code: cleanCode, qty: parsedQty });
          }
        }
      });
    }
  }

  // Fallback to findStockBinForProduct if no shelves in note
  if (foundBinCodes.length === 0) {
    const auto = findStockBinForProduct(pId, pSku, pName, whCode);
    if (auto.assignedBins && auto.assignedBins.length > 0) {
      auto.assignedBins.forEach((b) => {
        const clean = (b.split('-').pop() || b).trim().toUpperCase();
        if (clean && !foundBinCodes.some((x) => x.code === clean)) {
          foundBinCodes.push({ code: clean });
        }
      });
    }
  }

  // If still empty, provide default shelf
  if (foundBinCodes.length === 0) {
    foundBinCodes.push({ code: 'Kệ 1' });
  }

  // Assign quantities to shelves
  let remaining = defaultQty;
  const numExplicit = foundBinCodes.filter((b) => b.qty !== undefined).length;

  if (numExplicit === foundBinCodes.length) {
    // All shelves have explicit quantities
    foundBinCodes.forEach((b, idx) => {
      shelves.push({
        id: `shelf-${idx}-${Date.now()}`,
        binCode: b.code,
        qty: b.qty ?? 0,
      });
    });
  } else if (foundBinCodes.length === 1) {
    // Single shelf gets all quantity
    shelves.push({
      id: `shelf-0-${Date.now()}`,
      binCode: foundBinCodes[0].code,
      qty: defaultQty >= 0 ? defaultQty : 0,
    });
  } else {
    // Multiple shelves: give all to first shelf or divide
    foundBinCodes.forEach((b, idx) => {
      let q = 0;
      if (idx === 0) {
        q = defaultQty >= 0 ? defaultQty : 0;
      }
      shelves.push({
        id: `shelf-${idx}-${Date.now()}`,
        binCode: b.code,
        qty: q,
      });
    });
  }

  return { zonePrefix, shelves };
}

export default function StocktakeApproveShelfModal({
  stocktake,
  onClose,
  onApproved,
  onError,
}: StocktakeApproveShelfModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState(stocktake.note || '');

  // Initialize editable product list with their shelves
  const [items, setItems] = useState<ProductApprovalItem[]>(() => {
    const details = stocktake.details || [];
    return details.map((d: any) => {
      const p = d.product || {};
      const sysQty = Number(d.systemQty || 0);
      const counted = d.countedQty !== null && d.countedQty !== undefined ? Number(d.countedQty) : sysQty;
      const parsed = parseShelvesFromNote(
        d.note || '',
        counted,
        p.id,
        p.internalSku,
        p.name,
        stocktake.locationCode
      );

      return {
        detailId: String(d.id),
        productId: String(p.id || ''),
        productSku: p.internalSku || '—',
        productName: p.name || 'Sản phẩm',
        unit: p.unit || 'Cái',
        systemQty: sysQty,
        originalCountedQty: counted,
        zonePrefix: parsed.zonePrefix,
        shelves: parsed.shelves,
      };
    });
  });

  // Auto-preload existing shelf balances from database if product has no shelves in note
  React.useEffect(() => {
    let cancelled = false;

    const preloadDbShelves = async () => {
      try {
        const whCode = stocktake.locationCode || '';
        if (!whCode) return;

        const res = await fetch(`${API_BASE}/reports/shelf-inventory?warehouseCode=${encodeURIComponent(whCode)}`, {
          headers: authHeaders(),
        });
        if (!res.ok) return;

        const data = await res.json();
        const shelfRecords: any[] = data.items || [];
        if (shelfRecords.length === 0) return;

        if (cancelled) return;

        setItems((prevItems) =>
          prevItems.map((item) => {
            // Only replace if shelves are default/generic 'Kệ 1'
            const isGenericShelf =
              item.shelves.length === 1 &&
              (item.shelves[0].binCode.toLowerCase() === 'kệ 1' || item.shelves[0].binCode === 'KỆ 1');

            if (!isGenericShelf) return item;

            const matching = shelfRecords.filter((s: any) => String(s.productId) === String(item.productId));
            if (matching.length === 0) return item;

            const newShelves: ShelfAllocation[] = matching.map((s, sIdx) => ({
              id: `shelf-${sIdx}-${Date.now()}`,
              binCode: s.binCode || (s.fullLocationCode?.split('-').pop()) || `Kệ ${sIdx + 1}`,
              qty: Number(s.quantity || 0),
            }));

            return { ...item, shelves: newShelves };
          })
        );
      } catch {}
    };

    preloadDbShelves();
    return () => {
      cancelled = true;
    };
  }, [stocktake.locationCode]);

  // Update a shelf's bin code
  const handleUpdateBinCode = (pIdx: number, sIdx: number, newCode: string) => {
    setItems((prev) => {
      const next = [...prev];
      const pItem = { ...next[pIdx] };
      const nextShelves = [...pItem.shelves];
      nextShelves[sIdx] = { ...nextShelves[sIdx], binCode: newCode.toUpperCase().trim() };
      pItem.shelves = nextShelves;
      next[pIdx] = pItem;
      return next;
    });
  };

  // Update a shelf's quantity
  const handleUpdateShelfQty = (pIdx: number, sIdx: number, val: number) => {
    const validQty = Math.max(0, val || 0);
    setItems((prev) => {
      const next = [...prev];
      const pItem = { ...next[pIdx] };
      const nextShelves = [...pItem.shelves];
      nextShelves[sIdx] = { ...nextShelves[sIdx], qty: validQty };
      pItem.shelves = nextShelves;
      next[pIdx] = pItem;
      return next;
    });
  };

  // Add another shelf row to a product
  const handleAddShelf = (pIdx: number) => {
    setItems((prev) => {
      const next = [...prev];
      const pItem = { ...next[pIdx] };
      const nextShelves = [
        ...pItem.shelves,
        {
          id: `shelf-${pItem.shelves.length}-${Date.now()}`,
          binCode: `Kệ ${pItem.shelves.length + 1}`,
          qty: 0,
        },
      ];
      pItem.shelves = nextShelves;
      next[pIdx] = pItem;
      return next;
    });
  };

  // Remove a shelf row from a product
  const handleRemoveShelf = (pIdx: number, sIdx: number) => {
    setItems((prev) => {
      const next = [...prev];
      const pItem = { ...next[pIdx] };
      if (pItem.shelves.length <= 1) return prev;
      pItem.shelves = pItem.shelves.filter((_, i) => i !== sIdx);
      next[pIdx] = pItem;
      return next;
    });
  };

  // Summary computations
  const totalSystemQty = useMemo(() => items.reduce((sum, item) => sum + item.systemQty, 0), [items]);
  const totalCountedQty = useMemo(
    () => items.reduce((sum, item) => sum + item.shelves.reduce((s, sh) => s + sh.qty, 0), 0),
    [items]
  );
  const totalDifference = totalCountedQty - totalSystemQty;

  // Submit Approval
  const handleConfirmApproval = async () => {
    setSubmitting(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const approvedBy = user.fullName || user.email || 'Quản lý';

      // Build items payload with updated counted quantities and shelf allocations
      const itemsPayload = items.map((item) => {
        const totalActualForProduct = item.shelves.reduce((sum, sh) => sum + sh.qty, 0);
        const validShelves = item.shelves.filter((sh) => sh.binCode.trim());

        // Format shelf note: e.g. [Phân Khu Kho Thường 1] [Kệ: H4 (400 cái), H5 (274 cái)]
        const shelfAllocationsStr = validShelves
          .map((sh) => `${sh.binCode} (${sh.qty} ${item.unit})`)
          .join(', ');

        const formattedNote = item.zonePrefix
          ? `[${item.zonePrefix}] [Kệ: ${shelfAllocationsStr}]`
          : `[Kệ: ${shelfAllocationsStr}]`;

        return {
          detailId: item.detailId,
          productId: item.productId,
          countedQty: totalActualForProduct,
          shelfAllocations: validShelves.map((sh) => ({
            binCode: sh.binCode,
            qty: sh.qty,
          })),
          note: formattedNote,
        };
      });

      // 1. Call Backend Approve API
      const res = await fetch(`${API_BASE}/inventory/stocktakes/${stocktake.id}/approve`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          approvedBy,
          items: itemsPayload,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || 'Không thể phê duyệt phiếu kiểm kê');
      }

      const updatedStocktake = await res.json();

      // 2. Sync to local warehouse customBins so visualizer maps immediately reflect real counts
      try {
        const rawWhs = localStorage.getItem('smart-wms-warehouses');
        if (rawWhs) {
          const whList = JSON.parse(rawWhs);
          if (Array.isArray(whList)) {
            let changed = false;
            const targetWh = (stocktake.locationCode || '').toUpperCase();

            whList.forEach((wh: any) => {
              const wCode = String(wh.code || wh.id || '').toUpperCase();
              if (wCode === targetWh || targetWh.includes(wCode) || wCode.includes(targetWh)) {
                (wh.subWarehouses || []).forEach((sub: any) => {
                  (sub.racks || []).forEach((rk: any) => {
                    if (rk.customBins) {
                      items.forEach((item) => {
                        item.shelves.forEach((sh) => {
                          const binCode = sh.binCode.toUpperCase();
                          Object.entries(rk.customBins).forEach(([bKey, cfg]: [string, any]) => {
                            const shortKey = (bKey.split('-').pop() || bKey).toUpperCase();
                            if (shortKey === binCode || bKey.toUpperCase().endsWith(`-${binCode}`)) {
                              rk.customBins[bKey] = {
                                ...cfg,
                                occupancyPct: sh.qty > 0 ? Math.min(100, Math.round((sh.qty / 50) * 100)) : 0,
                                notes: `[Kiểm kê ${stocktake.stocktakeNo}] ${item.productName}: ${sh.qty} ${item.unit}`,
                              };
                              changed = true;
                            }
                          });
                        });
                      });
                    }
                  });
                });
              }
            });

            if (changed) {
              localStorage.setItem('smart-wms-warehouses', JSON.stringify(whList));
            }
          }
        }
      } catch {}

      window.dispatchEvent(new CustomEvent('stocktake-approved', { detail: updatedStocktake }));
      onApproved(updatedStocktake);
    } catch (err: any) {
      onError(err.message || 'Lỗi khi phê duyệt');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] rounded-2xl bg-white shadow-2xl border-2 border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-6 py-4 text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-xs shadow-inner">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-wide uppercase">
                  Duyệt Phiếu Kiểm Kê & Phân Bổ Kệ Hàng
                </h2>
                <span className="rounded-lg bg-white/25 px-2.5 py-0.5 text-xs font-black tracking-wider text-white">
                  {stocktake.stocktakeNo}
                </span>
              </div>
              <p className="text-xs font-medium text-emerald-100 flex items-center gap-2 mt-0.5">
                <span>Kho: <strong className="text-white">{stocktake.locationCode}</strong></span>
                <span>•</span>
                <span>Người tạo: <strong className="text-white">{stocktake.assignee || stocktake.createdBy || 'Hệ thống'}</strong></span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/25 text-white transition cursor-pointer"
            title="Đóng popup"
          >
            <X size={20} />
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-amber-50/90 border-b border-amber-200/80 px-6 py-2.5 flex items-center gap-2.5 text-xs font-bold text-amber-900">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <span>
            Vui lòng nhập chính xác số lượng kiểm đếm thực tế của từng kệ lưu trữ. Khi bấm <strong>"Xác nhận duyệt"</strong>, hệ thống sẽ tự động cập nhật số lượng thực tồn này vào kho và mở khóa xuất/nhập.
          </span>
        </div>

        {/* Products & Shelves List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50/50">
          {items.map((item, pIdx) => {
            const productTotalActual = item.shelves.reduce((s, sh) => s + sh.qty, 0);
            const diff = productTotalActual - item.systemQty;

            return (
              <div
                key={item.detailId || pIdx}
                className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-xs transition hover:border-cyan-400/60"
              >
                {/* Product Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-100 text-cyan-800 font-black text-xs">
                      #{pIdx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-cyan-700 font-mono text-sm">
                          [{item.productSku}]
                        </span>
                        <h3 className="text-sm font-black text-slate-800">{item.productName}</h3>
                      </div>
                      <span className="text-xs font-bold text-slate-500">Đơn vị: {item.unit}</span>
                    </div>
                  </div>

                  {/* Summary Badges for this Product */}
                  <div className="flex flex-wrap items-center gap-2.5 text-xs">
                    <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 font-bold text-slate-700">
                      <span>Tồn hệ thống:</span>
                      <strong className="font-black text-slate-900">{item.systemQty}</strong>
                      <span className="text-slate-500">{item.unit}</span>
                    </div>

                    <ArrowRight size={14} className="text-slate-400" />

                    <div className="flex items-center gap-1.5 rounded-xl border-2 border-cyan-400 bg-cyan-50 px-3 py-1.5 font-bold text-cyan-900">
                      <span>Tổng thực tế:</span>
                      <strong className="font-black text-cyan-800 text-sm">{productTotalActual}</strong>
                      <span className="text-cyan-700">{item.unit}</span>
                    </div>

                    <div
                      className={`flex items-center gap-1 rounded-xl px-3 py-1.5 font-black text-xs border ${
                        diff === 0
                          ? 'border-slate-300 bg-slate-100 text-slate-600'
                          : diff > 0
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : 'border-red-300 bg-red-50 text-red-600'
                      }`}
                    >
                      <span>Lệch:</span>
                      <span>
                        {diff > 0 ? `+${diff}` : diff} {item.unit}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Shelves Breakdown Table / List */}
                <div className="mt-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-extrabold text-slate-600 uppercase tracking-wide">
                    <div className="flex items-center gap-1.5">
                      <Layers size={14} className="text-cyan-600" />
                      <span>Chi tiết số lượng thực tế từng kệ lưu trữ:</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddShelf(pIdx)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-cyan-700 hover:text-cyan-900 hover:underline cursor-pointer"
                    >
                      <Plus size={14} />
                      Thêm vị trí kệ
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {item.shelves.map((shelf, sIdx) => (
                      <div
                        key={shelf.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 hover:bg-slate-50 transition shadow-2xs"
                      >
                        <div className="flex-1 min-w-0">
                          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                            Mã Kệ / Ô
                          </label>
                          <input
                            type="text"
                            value={shelf.binCode}
                            onChange={(e) => handleUpdateBinCode(pIdx, sIdx, e.target.value)}
                            placeholder="VD: H1, D4"
                            className="w-full h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-black text-slate-800 uppercase focus:border-cyan-600 outline-none"
                          />
                        </div>

                        <div className="w-28 shrink-0">
                          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                            SL Thực Tồn
                          </label>
                          <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden focus-within:border-cyan-600">
                            <input
                              type="number"
                              min={0}
                              value={shelf.qty}
                              onChange={(e) => handleUpdateShelfQty(pIdx, sIdx, Number(e.target.value))}
                              className="w-full h-8 px-2 text-xs font-black text-slate-800 text-center outline-none"
                            />
                            <span className="text-[10px] font-bold text-slate-400 pr-1.5 shrink-0 select-none">
                              {item.unit}
                            </span>
                          </div>
                        </div>

                        {item.shelves.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveShelf(pIdx, sIdx)}
                            className="mt-3.5 h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer shrink-0"
                            title="Xóa kệ này"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer Summary & Confirm Action */}
        <div className="border-t-2 border-slate-200 bg-slate-50 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-700">
            <div>
              <span>Tổng mặt hàng: </span>
              <strong className="text-slate-900 text-sm font-black">{items.length}</strong>
            </div>
            <div className="border-l-2 border-slate-300 pl-4">
              <span>Tổng tồn HT: </span>
              <strong className="text-slate-900 text-sm font-black">{totalSystemQty}</strong>
            </div>
            <div className="border-l-2 border-slate-300 pl-4">
              <span>Tổng thực tế: </span>
              <strong className="text-cyan-800 text-sm font-black">{totalCountedQty}</strong>
            </div>
            <div className="border-l-2 border-slate-300 pl-4">
              <span>Tổng chênh lệch: </span>
              <strong
                className={`text-sm font-black ${
                  totalDifference === 0
                    ? 'text-slate-600'
                    : totalDifference > 0
                    ? 'text-emerald-700'
                    : 'text-red-600'
                }`}
              >
                {totalDifference > 0 ? `+${totalDifference}` : totalDifference}
              </strong>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border-2 border-slate-300 bg-white px-5 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-100 transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleConfirmApproval}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-6 py-2.5 text-xs font-black text-white shadow-md transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Đang duyệt...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 stroke-[3]" />
                  <span>Xác nhận Duyệt & Cập nhật Tồn kho</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
