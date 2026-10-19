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
  currentSystemQty?: number;
  qty: number;
  occupancyPct?: number;
  newOccupancyPct?: number;
  keepOccupancy?: boolean;
  zoneName?: string;
  rackCode?: string;
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
  warehouseName: string;
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
          // Clean code: remove long warehouse prefixes
          // Handle both KH009-ZONE-A-R01-D4 (split by -) and KH009ZONEAR01D4 (regex extract)
          let cleanCode = rawCode;
          if (rawCode.includes('-')) {
            cleanCode = (rawCode.split('-').pop() || rawCode).trim().toUpperCase();
          } else {
            // Try to extract last shelf-like segment (e.g. D4, H1, A1)
            const shelfSegment = rawCode.match(/([A-Za-z]\d+)$/);
            cleanCode = shelfSegment ? shelfSegment[1].toUpperCase() : rawCode.toUpperCase();
          }
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
        warehouseName: '',
        shelves: parsed.shelves,
      };
    });
  });

  // Auto-preload shelves from warehouse customBins — the real source of truth
  React.useEffect(() => {
    let cancelled = false;

    const preloadFromWarehouse = async () => {
      try {
        const whCode = stocktake.locationCode || '';
        if (!whCode) return;

        // Fetch full warehouse list to find matching warehouse by code
        const res = await fetch(`${API_BASE}/warehouses`, {
          headers: authHeaders(),
        });
        if (!res.ok) return;

        const warehouses = await res.json();
        const arr = Array.isArray(warehouses) ? warehouses : (warehouses.data || warehouses.items || []);
        const wh = arr.find((w: any) => w.code === whCode);
        if (!wh || !wh.subWarehouses) return;

        if (cancelled) return;

        // Build a map: productSku -> [{binCode, qty, zoneName, rackCode, occupancyPct}]
        // IMPORTANT: Dedup globally by binCode to avoid counting the same shelf multiple times
        type BinInfo = { binCode: string; qty: number; zoneName: string; zoneCode: string; rackCode: string; occupancyPct: number };
        const productBinMap: Record<string, BinInfo[]> = {};

        // Only take the FIRST sub-warehouse (zone) that has each product's bins
        // to avoid cross-zone duplication
        wh.subWarehouses.forEach((zone: any) => {
          const zoneName = zone.name || zone.code || '';
          const zoneCode = zone.code || '';
          (zone.racks || []).forEach((rack: any) => {
            const rackCode = rack.rackCode || '';
            const bins = rack.customBins || {};
            // Deduplicate bins by binCode within this rack
            const seenBins = new Set<string>();
            Object.values(bins).forEach((bin: any) => {
              const binCode = bin.binCode;
              if (!binCode || seenBins.has(binCode)) return;
              seenBins.add(binCode);

              (bin.products || []).forEach((prod: any) => {
                const sku = prod.sku || '';
                if (!sku || !prod.qty || prod.qty <= 0) return;
                if (!productBinMap[sku]) productBinMap[sku] = [];
                // Global dedup by binCode — skip if we already have this bin for this product
                if (productBinMap[sku].some(b => b.binCode === binCode)) return;
                productBinMap[sku].push({
                  binCode,
                  qty: Number(prod.qty),
                  zoneName,
                  zoneCode,
                  rackCode,
                  occupancyPct: Number(prod.occupancyPct || 0),
                });
              });
            });
          });
        });

        if (cancelled) return;

        setItems((prevItems) =>
          prevItems.map((item) => {
            const binsForProduct = productBinMap[item.productSku] || [];
            if (binsForProduct.length === 0) {
              // No bins found — keep existing shelves from note
              return { ...item, warehouseName: wh.name || whCode };
            }

            // Use stocktake's systemQty as truth (NOT warehouse bin totals which may be duplicated)
            const stocktakeSystemQty = item.systemQty;
            const rawBinTotal = binsForProduct.reduce((sum, b) => sum + b.qty, 0);

            // Build shelves from actual warehouse bin data
            // Scale quantities proportionally if raw total differs from stocktake systemQty
            const newShelves: ShelfAllocation[] = binsForProduct.map((b, sIdx) => {
              const proportion = rawBinTotal > 0 ? b.qty / rawBinTotal : 1 / binsForProduct.length;
              const scaledQty = Math.round(stocktakeSystemQty * proportion);
              return {
                id: `shelf-${sIdx}-${Date.now()}`,
                binCode: b.binCode,
                currentSystemQty: scaledQty,
                qty: 0, // User enters actual count
                occupancyPct: b.occupancyPct,
                newOccupancyPct: b.occupancyPct,
                keepOccupancy: true,
                zoneName: b.zoneName,
                rackCode: b.rackCode,
              };
            });

            // Adjust rounding: ensure shelf qtys sum to exactly stocktakeSystemQty
            const shelfSum = newShelves.reduce((s, sh) => s + (sh.currentSystemQty || 0), 0);
            if (shelfSum !== stocktakeSystemQty && newShelves.length > 0) {
              newShelves[0].currentSystemQty = (newShelves[0].currentSystemQty || 0) + (stocktakeSystemQty - shelfSum);
            }

            // Update zonePrefix if we have zone info
            const zonePrefix = binsForProduct[0]?.zoneName || item.zonePrefix;

            return {
              ...item,
              zonePrefix,
              warehouseName: wh.name || whCode,
              // DO NOT override systemQty — keep the stocktake's value
              shelves: newShelves,
            };
          })
        );
      } catch (err) {
        console.error('Failed to preload warehouse bins:', err);
      }
    };

    preloadFromWarehouse();
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

  // Toggle keepOccupancy for a shelf
  const handleToggleKeepOccupancy = (pIdx: number, sIdx: number) => {
    setItems((prev) => {
      const next = [...prev];
      const pItem = { ...next[pIdx] };
      const nextShelves = [...pItem.shelves];
      const current = nextShelves[sIdx];
      nextShelves[sIdx] = {
        ...current,
        keepOccupancy: !current.keepOccupancy,
        newOccupancyPct: !current.keepOccupancy ? current.occupancyPct : current.newOccupancyPct,
      };
      pItem.shelves = nextShelves;
      next[pIdx] = pItem;
      return next;
    });
  };

  // Update shelf new occupancy pct
  const handleUpdateOccupancyPct = (pIdx: number, sIdx: number, val: number) => {
    setItems((prev) => {
      const next = [...prev];
      const pItem = { ...next[pIdx] };
      const nextShelves = [...pItem.shelves];
      nextShelves[sIdx] = { ...nextShelves[sIdx], newOccupancyPct: Math.max(0, Math.min(100, val)) };
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
          occupancyPct: 0,
          newOccupancyPct: 0,
          keepOccupancy: true,
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

  // Group shelves by zone for display
  const getShelvesGroupedByZone = (shelves: ShelfAllocation[]) => {
    const groups: Record<string, ShelfAllocation[]> = {};
    shelves.forEach((sh) => {
      const zone = sh.zoneName || 'Chung';
      if (!groups[zone]) groups[zone] = [];
      groups[zone].push(sh);
    });
    return groups;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-6xl max-h-[94vh] rounded-2xl bg-white shadow-2xl border-2 border-slate-200 overflow-hidden">
        {/* Modal Header — Cyan gradient */}
        <div className="flex items-center justify-between bg-gradient-to-r from-cyan-600 via-cyan-700 to-cyan-800 px-6 py-4 text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-xs shadow-inner">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-wide uppercase">
                  Duyệt Kiểm Kê Kho
                </h2>
                <span className="rounded-lg bg-white/25 px-2.5 py-0.5 text-xs font-black tracking-wider text-white">
                  {stocktake.stocktakeNo}
                </span>
              </div>
              <p className="text-xs font-medium text-cyan-100 flex items-center gap-2 mt-0.5">
                <Warehouse size={13} className="text-cyan-200" />
                <span>Kho: <strong className="text-white">{items[0]?.warehouseName || stocktake.locationCode}</strong> ({stocktake.locationCode})</span>
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

        {/* Products & Shelves List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar bg-slate-50/50">
          {items.map((item, pIdx) => {
            const productTotalActual = item.shelves.reduce((s, sh) => s + sh.qty, 0);
            const diff = productTotalActual - item.systemQty;
            const zoneGroups = getShelvesGroupedByZone(item.shelves);

            return (
              <div
                key={item.detailId || pIdx}
                className="rounded-2xl border-2 border-slate-200 bg-white shadow-xs overflow-hidden"
              >
                {/* Product Header */}
                <div className="bg-gradient-to-r from-cyan-50 to-slate-50 px-5 py-3 border-b border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600 text-white font-black text-sm shadow">
                        #{pIdx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-cyan-700 font-mono text-sm">[{item.productSku}]</span>
                          <h3 className="text-sm font-black text-slate-800">{item.productName}</h3>
                        </div>
                        <div className="text-xs font-semibold text-slate-500 mt-0.5">Đơn vị: {item.unit}</div>
                      </div>
                    </div>

                    {/* Summary Badges */}
                    <div className="flex flex-wrap items-center gap-2.5 text-xs">
                      <div className="flex items-center gap-1.5 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-1.5 font-bold text-cyan-800">
                        <Package size={13} />
                        <span>Tổng tồn kho:</span>
                        <strong className="font-black text-cyan-900 text-sm">{item.systemQty}</strong>
                        <span>{item.unit}</span>
                      </div>

                      <ArrowRight size={14} className="text-slate-400" />

                      <div className="flex items-center gap-1.5 rounded-xl border-2 border-cyan-500 bg-cyan-100 px-3 py-1.5 font-bold text-cyan-900">
                        <span>Sau kiểm kê:</span>
                        <strong className="font-black text-cyan-950 text-sm">{productTotalActual}</strong>
                        <span>{item.unit}</span>
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
                        Lệch: {diff > 0 ? `+${diff}` : diff} {item.unit}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Shelves Table grouped by Zone */}
                <div className="px-5 py-4">
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse min-w-[800px]">
                      <thead className="bg-cyan-700 text-white font-black uppercase text-[11px]">
                        <tr>
                          <th className="p-2.5 w-12 text-center border-r border-cyan-600">STT</th>
                          <th className="p-2.5 min-w-[160px] border-r border-cyan-600">Tên Kệ / Phân Khu</th>
                          <th className="p-2.5 w-28 text-center border-r border-cyan-600">Số lượng</th>
                          <th className="p-2.5 w-24 text-center border-r border-cyan-600">% Chứa</th>
                          <th className="p-2.5 w-36 text-center border-r border-cyan-600 bg-cyan-800">SL Sau Kiểm Kê</th>
                          <th className="p-2.5 w-48 text-center">% Lưu Trữ Mới</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          let globalIdx = 0;
                          return Object.entries(zoneGroups).map(([zoneName, zoneShelves]) => (
                            <React.Fragment key={zoneName}>
                              {/* Zone Header Row — spans full width */}
                              <tr className="bg-cyan-50 border-y border-cyan-200">
                                <td colSpan={6} className="p-2.5">
                                  <div className="flex items-center gap-2">
                                    <Layers size={15} className="text-cyan-700" />
                                    <span className="font-black text-cyan-800 uppercase text-xs tracking-wide">
                                      {zoneName}
                                    </span>
                                    <span className="text-[11px] font-semibold text-cyan-600">
                                      ({zoneShelves.length} kệ • {zoneShelves.reduce((s, sh) => s + (sh.currentSystemQty || 0), 0)} {item.unit})
                                    </span>
                                  </div>
                                </td>
                              </tr>
                              {/* Shelf rows within this zone */}
                              {zoneShelves.map((shelf, sIdx) => {
                                globalIdx++;
                                const originalShelfIdx = item.shelves.findIndex((s) => s.id === shelf.id);
                                return (
                                  <tr key={shelf.id} className="hover:bg-slate-50/80 transition border-b border-slate-100">
                                    {/* STT */}
                                    <td className="p-2.5 text-center font-extrabold text-slate-500 border-r border-slate-200">
                                      {globalIdx}
                                    </td>
                                    {/* Tên Kệ */}
                                    <td className="p-2 border-r border-slate-200">
                                      <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-lg bg-cyan-100 flex items-center justify-center text-cyan-700 font-black text-[11px] shrink-0">
                                          {shelf.rackCode || ''}-{shelf.binCode}
                                        </div>
                                        <div>
                                          <div className="font-black text-slate-800 text-xs">{shelf.rackCode ? `${shelf.rackCode}-` : ''}{shelf.binCode}</div>
                                          <div className="text-[10px] text-slate-400 font-medium">{shelf.rackCode || 'Dãy kệ'}</div>
                                        </div>
                                      </div>
                                    </td>
                                    {/* Số lượng hiện tại */}
                                    <td className="p-2 text-center border-r border-slate-200 font-black font-mono text-slate-700 text-xs bg-slate-50/50">
                                      {shelf.currentSystemQty ?? 0} <span className="text-slate-400 font-medium">{item.unit}</span>
                                    </td>
                                    {/* % Chứa hiện tại */}
                                    <td className="p-2 text-center border-r border-slate-200">
                                      <div className="flex flex-col items-center gap-1">
                                        <span className="font-black text-sm" style={{ color: (shelf.occupancyPct || 0) >= 80 ? '#dc2626' : (shelf.occupancyPct || 0) >= 50 ? '#d97706' : '#059669' }}>
                                          {shelf.occupancyPct ?? 0}%
                                        </span>
                                        <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                                          <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                              width: `${Math.min(100, shelf.occupancyPct || 0)}%`,
                                              backgroundColor: (shelf.occupancyPct || 0) >= 80 ? '#dc2626' : (shelf.occupancyPct || 0) >= 50 ? '#d97706' : '#059669',
                                            }}
                                          />
                                        </div>
                                      </div>
                                    </td>
                                    {/* SL Sau Kiểm Kê */}
                                    <td className="p-2 border-r border-slate-200 bg-cyan-50/30">
                                      <div className="flex items-center gap-1.5 max-w-[160px] mx-auto">
                                        <input
                                          type="number"
                                          min={0}
                                          value={shelf.qty}
                                          onChange={(e) => handleUpdateShelfQty(pIdx, originalShelfIdx, Number(e.target.value))}
                                          className="h-9 w-full text-center rounded-lg border-2 border-cyan-400 bg-white font-black text-cyan-900 text-sm outline-none focus:border-cyan-600 shadow-2xs"
                                        />
                                        <span className="text-[11px] font-bold text-slate-500 shrink-0">{item.unit}</span>
                                      </div>
                                    </td>
                                    {/* % Lưu Trữ Mới */}
                                    <td className="p-2 text-center">
                                      <div className="flex items-center justify-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleKeepOccupancy(pIdx, originalShelfIdx)}
                                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                                            shelf.keepOccupancy
                                              ? 'bg-cyan-100 border-cyan-300 text-cyan-800'
                                              : 'bg-slate-100 border-slate-300 text-slate-600'
                                          }`}
                                          title={shelf.keepOccupancy ? 'Đang giữ nguyên — bấm để tự nhập' : 'Đang tự nhập — bấm để giữ nguyên'}
                                        >
                                          {shelf.keepOccupancy ? 'Giữ nguyên' : 'Tự nhập'}
                                        </button>
                                        {shelf.keepOccupancy ? (
                                          <span className="font-black text-sm text-cyan-700">{shelf.occupancyPct ?? 0}%</span>
                                        ) : (
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="number"
                                              min={0}
                                              max={100}
                                              value={shelf.newOccupancyPct ?? 0}
                                              onChange={(e) => handleUpdateOccupancyPct(pIdx, originalShelfIdx, Number(e.target.value))}
                                              className="h-8 w-16 text-center rounded-lg border-2 border-cyan-400 bg-white font-black text-cyan-900 text-xs outline-none focus:border-cyan-600 shadow-2xs"
                                            />
                                            <span className="text-xs font-bold text-slate-500">%</span>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* Add shelf button */}
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleAddShelf(pIdx)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-cyan-700 hover:text-cyan-900 cursor-pointer bg-cyan-50 px-3 py-1.5 rounded-lg border border-cyan-200 hover:bg-cyan-100 transition"
                    >
                      <Plus size={14} />
                      Thêm kệ mới
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
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
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 px-6 py-2.5 text-xs font-black text-white shadow-md transition cursor-pointer active:scale-95 disabled:opacity-50"
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
