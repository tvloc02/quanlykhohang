import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  getStoredWarehouses,
  saveStoredWarehouses,
  mergeStoredWarehouses,
  upsertWarehouseToApi,
  getRackLetterPrefix,
  buildWarehouseRackTopology,
  type WarehouseRecord,
  type RackConfig,
  type BinCell,
  type ShelfFloor,
  type RackStructure,
  saveActiveDraftSlotLocks,
  releaseActiveDraftSlotLocks,
  getActiveDraftSlotLocks,
  parseAssignedBinsFromNote,
  stripAssignedBinsFromNote,
} from '../../../shared/utils/warehouseAssignments';
import { WarehouseSlottingGrid, findCachedBinInfo } from './WarehouseSlottingGrid';
import {
  Sparkles,
  X,
  Bot,
  Send,
  Layers,
  CheckCircle2,
  AlertCircle,
  Package,
  Lock,
  Boxes,
  Info,
  Check,
  RotateCcw,
  Settings,
  ShieldAlert,
} from 'lucide-react';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api';

function authHeaders() {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface SlottingItemRow {
  rowId: string;
  productId?: string;
  productSku?: string;
  productName?: string;
  unit?: string;
  qty?: number;
  warehouseCode?: string;
  assignedBins?: string[];
  locationBin?: string;
  note?: string;
}

export interface SmartSlottingGridModalProps<T extends SlottingItemRow = SlottingItemRow> {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'INBOUND' | 'INBOUND_STOCKIN' | 'OUTBOUND_TRANSFER' | 'STOCKTAKE';
  isDisposal?: boolean;
  warehouseCode: string;
  items: T[];
  targetRowId?: string | null;
  products?: any[];
  subWarehouses?: any[];
  orderNo?: string;
  tabId?: string;
  readOnly?: boolean;
  onConfirmAll: (updatedRows: T[], updatedSubWarehouses?: any[]) => void;
}

export type { BinCell, ShelfFloor, RackStructure };

export interface AiChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  time: string;
}

const normalizeBinKey = (code: string): string => {
  if (!code) return '';
  return code.trim().toUpperCase().replace(/_/g, '-');
};

export interface BinAllocationResult {
  formattedBins: string[];
  binQtyMap: Record<string, number>;
  binPctMap: Record<string, number>;
}

export const allocateBinsForInbound = (
  rawBinCodes: string[],
  targetQty: number,
  manualMap: Record<string, { qty: number; pct: number; isManual?: boolean; isCustomQty?: boolean }> = {},
  productMetrics?: {
    weight?: number;
    volume?: number;
    length?: number;
    width?: number;
    height?: number;
  },
  binMetrics?: {
    maxWeight?: number;
    maxVolume?: number;
  }
): BinAllocationResult => {
  if (!rawBinCodes || rawBinCodes.length === 0) {
    return { formattedBins: [], binQtyMap: {}, binPctMap: {} };
  }

  const uniqueBins: string[] = [];
  const seenKeys = new Set<string>();
  for (const b of rawBinCodes) {
    if (!b) continue;
    const clean = b.split('(')[0].trim();
    const key = normalizeBinKey(clean);
    if (key && !seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueBins.push(clean);
    }
  }

  const totalBins = uniqueBins.length;
  if (totalBins === 0) {
    return { formattedBins: [], binQtyMap: {}, binPctMap: {} };
  }

  const binQtyMap: Record<string, number> = {};
  const binPctMap: Record<string, number> = {};

  let manualTotalQty = 0;
  uniqueBins.forEach((cleanB) => {
    const key = normalizeBinKey(cleanB);
    const short = (cleanB.split('-').pop() || cleanB).toUpperCase();
    const strippedKey = cleanB.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const manualEntry = manualMap[key] || manualMap[cleanB] || manualMap[short] || manualMap[strippedKey];

    const hasCustomQty = Boolean(
      manualEntry &&
      manualEntry.isCustomQty &&
      manualEntry.qty !== undefined &&
      Number(manualEntry.qty) > 0
    );
    const effectiveQty = hasCustomQty ? Number(manualEntry!.qty) : 0;

    if (hasCustomQty) {
      manualTotalQty += effectiveQty;
    }
  });

  const flexibleBinsCount = uniqueBins.filter((cleanB) => {
    const key = normalizeBinKey(cleanB);
    const short = (cleanB.split('-').pop() || cleanB).toUpperCase();
    const strippedKey = cleanB.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const manualEntry = manualMap[key] || manualMap[cleanB] || manualMap[short] || manualMap[strippedKey];

    const hasCustomQty = Boolean(
      manualEntry &&
      manualEntry.isCustomQty &&
      manualEntry.qty !== undefined &&
      Number(manualEntry.qty) > 0
    );
    return !hasCustomQty;
  }).length;

  const remainingQty = Math.max(0, targetQty - manualTotalQty);
  const baseQty = flexibleBinsCount > 0 ? Math.floor(remainingQty / flexibleBinsCount) : 0;
  const remainderQty = flexibleBinsCount > 0 ? remainingQty % flexibleBinsCount : 0;

  let flexIdx = 0;
  uniqueBins.forEach((cleanB) => {
    const key = normalizeBinKey(cleanB);
    const short = (cleanB.split('-').pop() || cleanB).toUpperCase();
    const strippedKey = cleanB.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const manualEntry = manualMap[key] || manualMap[cleanB] || manualMap[short] || manualMap[strippedKey];

    const hasCustomQty = Boolean(
      manualEntry &&
      manualEntry.isCustomQty &&
      manualEntry.qty !== undefined &&
      Number(manualEntry.qty) > 0
    );
    const effectiveQty = hasCustomQty ? Number(manualEntry!.qty) : 0;

    let binQty = 0;
    if (hasCustomQty) {
      binQty = effectiveQty;
    } else {
      binQty = baseQty + (flexIdx < remainderQty ? 1 : 0);
      flexIdx++;
    }
    binQtyMap[key] = binQty;
    binQtyMap[cleanB] = binQty;
    binQtyMap[short] = binQty;
    binQtyMap[strippedKey] = binQty;

    // % represents how much of the SHELF is occupied, calculated physically by volume and weight
    let binPct = 0;
    if (manualEntry && manualEntry.isManual && manualEntry.pct !== undefined && manualEntry.pct >= 0) {
      binPct = manualEntry.pct;
    } else if (binQty <= 0) {
      binPct = 0;
    } else {
      const pWeight = Math.max(0.1, Number(productMetrics?.weight || 1.0));
      let pVol = Number(productMetrics?.volume || 0);
      if (!pVol || pVol <= 0) {
        const pL = Number(productMetrics?.length || 0);
        const pW = Number(productMetrics?.width || 0);
        const pH = Number(productMetrics?.height || 0);
        if (pL > 0 && pW > 0 && pH > 0) {
          pVol = (pL * pW * pH) / 1_000_000;
        } else {
          pVol = 0.005; // default 5 liters = 0.005 m3
        }
      }

      const binMaxVol = Number(binMetrics?.maxVolume || 0.96); // 120cm × 80cm × 100cm = 0.96 m3
      const binMaxWeight = Number(binMetrics?.maxWeight || 500); // 500 kg standard rack shelf

      const totalVol = binQty * pVol;
      const totalWeight = binQty * pWeight;

      const volOccupancyPct = Math.round((totalVol / binMaxVol) * 100);
      const weightOccupancyPct = Math.round((totalWeight / binMaxWeight) * 100);

      // AI Slotting occupancy is the maximum of volume usage % and weight capacity %
      binPct = Math.min(100, Math.max(1, Math.max(volOccupancyPct, weightOccupancyPct)));
    }

    binPctMap[key] = binPct;
    binPctMap[cleanB] = binPct;
    binPctMap[short] = binPct;
    binPctMap[strippedKey] = binPct;
  });

  const formattedBins = uniqueBins.map((cleanB) => {
    const key = normalizeBinKey(cleanB);
    const pct = binPctMap[key] !== undefined ? binPctMap[key] : (binPctMap[cleanB] ?? 0);
    const qty = binQtyMap[key] !== undefined ? binQtyMap[key] : (binQtyMap[cleanB] ?? 0);
    return qty > 0 ? `${cleanB} (${pct}%) [${qty} cái]` : `${cleanB} (${pct}%)`;
  });

  return { formattedBins, binQtyMap, binPctMap };
};

interface SmartSlottingCacheEntry {
  timestamp: number;
  occMap: Map<string, number>;
  prodMap: Map<string, { productId: string; sku: string; productName: string; qty: number }>;
}

const smartSlottingCache = new Map<string, SmartSlottingCacheEntry>();

export function clearSmartSlottingCache() {
  smartSlottingCache.clear();
}

function getCachedSmartSlotting(whCode?: string) {
  const key = (whCode || '').trim().toUpperCase() || 'ALL';
  const entry = smartSlottingCache.get(key);
  if (entry && Date.now() - entry.timestamp < 30000) {
    return {
      occMap: new Map(entry.occMap),
      prodMap: new Map(entry.prodMap),
    };
  }
  return null;
}

export function SmartSlottingGridModal<T extends SlottingItemRow = SlottingItemRow>({
  isOpen,
  onClose,
  mode,
  isDisposal = false,
  warehouseCode,
  items,
  targetRowId,
  products = [],
  subWarehouses,
  orderNo = 'PNK',
  tabId = 'default-draft',
  readOnly = false,
  onConfirmAll,
}: SmartSlottingGridModalProps<T>) {
  const [dbSubWarehouses, setDbSubWarehouses] = useState<any[]>([]);
  const [currentWarehouseObj, setCurrentWarehouseObj] = useState<WarehouseRecord | null>(null);
  const [activeRowId, setActiveRowId] = useState<string>('');
  const [activeRackId, setActiveRackId] = useState<string>('R01');
  const [currentWarehouse, setCurrentWarehouse] = useState<WarehouseRecord | null>(null);
  const [selectedBinsMap, setSelectedBinsMap] = useState<Record<string, string[]>>({});
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const initialSlottingCached = getCachedSmartSlotting(warehouseCode);
  const [dbOccupiedBinsMap, setDbOccupiedBinsMap] = useState<Map<string, number>>(
    () => initialSlottingCached ? new Map(initialSlottingCached.occMap) : new Map()
  );
  const [binProductsMap, setBinProductsMap] = useState<
    Map<string, { productId: string; sku: string; productName: string; qty: number }>
  >(() => initialSlottingCached ? new Map(initialSlottingCached.prodMap) : new Map());
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [manualBinAllocations, setManualBinAllocations] = useState<Record<string, Record<string, { qty: number; pct: number; isManual?: boolean; isCustomQty?: boolean }>>>({});
  const [allocatedQtyMap, setAllocatedQtyMap] = useState<Record<string, Record<string, number>>>({});

  // Filter out empty rows (rows that do NOT have a product assigned)
  const validItems = useMemo(() => {
    return (items || []).filter((it) => {
      const hasProdId = Boolean(it.productId && String(it.productId).trim() !== '');
      const hasProdName = Boolean(it.productName && String(it.productName).trim() !== '');
      const hasSku = Boolean((it as any).sku || (it as any).productSku);
      return hasProdId || hasProdName || hasSku;
    });
  }, [items]);

  // Helper to extract physical weight & volume dimensions for any item/product
  const getProductMetricsForItem = useCallback((item: any) => {
    if (!item) return { weight: 1, volume: 0.005, length: 20, width: 15, height: 10 };
    const prod = (products || []).find((p: any) =>
      (item.productId && (String(p.id) === String(item.productId) || String(p._id) === String(item.productId))) ||
      (item.productSku && (p.sku === item.productSku || p.internalSku === item.productSku)) ||
      (item.productName && p.name === item.productName)
    ) || item;

    const pWeight = Math.max(0.1, Number(prod?.weight ?? (item as any)?.weight ?? 1.0));
    const pLength = Number(prod?.length ?? (item as any)?.length ?? 0);
    const pWidth = Number(prod?.width ?? (item as any)?.width ?? 0);
    const pH = Number(prod?.height ?? (item as any)?.height ?? 0);
    let pVol = Number(prod?.volume ?? (item as any)?.volume ?? 0);
    if (!pVol || pVol <= 0) {
      if (pLength > 0 && pWidth > 0 && pH > 0) {
        pVol = (pLength * pWidth * pH) / 1_000_000;
      } else {
        pVol = 0.005;
      }
    }

    return {
      weight: pWeight,
      volume: pVol,
      length: pLength,
      width: pWidth,
      height: pH,
    };
  }, [products]);

  // Comprehensive check across all 6 data sources: BinCell, selectedBinsMap, dbOccupiedBinsMap, binProductsMap, findCachedBinInfo, customBins
  const isBinOccupiedOrUnavailableForInbound = useCallback((
    binCodeOrCell: string | BinCell,
    excludeRowId?: string
  ): { isOccupied: boolean; reason?: string } => {
    const rawCode = typeof binCodeOrCell === 'string' ? binCodeOrCell : binCodeOrCell.binCode;
    const cleanBinCode = rawCode.split('(')[0].trim();
    const normKey = normalizeBinKey(cleanBinCode);
    const shortCode = (cleanBinCode.split('-').pop() || cleanBinCode).toUpperCase();
    const strippedKey = cleanBinCode.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // 1. If passed as BinCell object, check cell flags
    if (typeof binCodeOrCell !== 'string') {
      const cellAny = binCodeOrCell as any;
      if (binCodeOrCell.isOccupied && (Number(binCodeOrCell.stockQty) > 0 || Number(cellAny.occupancyPct) > 0)) {
        return { isOccupied: true, reason: `Ô kệ đã có hàng (${binCodeOrCell.stockQty || cellAny.occupancyPct || 100}%)` };
      }
      if (Number(cellAny.occupancyPct) > 0 || Number(cellAny.stockQty) > 0) {
        return { isOccupied: true, reason: `Kệ đã chiếm dụng ${cellAny.occupancyPct || 100}%` };
      }
    }

    // 2. Check if ANY OTHER item in the current modal order is already using this bin
    const assignedOther = Object.entries(selectedBinsMap).find(([rId, bList]) => {
      if (excludeRowId && rId === excludeRowId) return false;
      return (bList || []).some((b) => {
        const cleanB = b.split('(')[0].trim();
        const normB = normalizeBinKey(cleanB);
        const shortB = (cleanB.split('-').pop() || cleanB).toUpperCase();
        return cleanB === cleanBinCode || (normKey && normB === normKey) || (shortCode && shortB === shortCode);
      });
    });
    if (assignedOther) {
      const otherRowId = assignedOther[0];
      const otherIdx = items.findIndex((it) => it.rowId === otherRowId);
      const otherName = items[otherIdx]?.productName || 'mặt hàng khác';
      return { isOccupied: true, reason: `Đã được gán cho dòng #${otherIdx + 1} "${otherName}"` };
    }

    // 3. Check dbOccupiedBinsMap (live database inventory stock)
    const stockInDb = dbOccupiedBinsMap.get(cleanBinCode) ||
      (normKey ? dbOccupiedBinsMap.get(normKey) : 0) ||
      (shortCode ? dbOccupiedBinsMap.get(shortCode) : 0) ||
      (strippedKey ? dbOccupiedBinsMap.get(strippedKey) : 0) || 0;
    if (stockInDb > 0) {
      const pInfo = binProductsMap.get(cleanBinCode) ||
        (normKey ? binProductsMap.get(normKey) : null) ||
        (shortCode ? binProductsMap.get(shortCode) : null);
      const pName = pInfo?.productName || 'Hàng tồn kho';
      return { isOccupied: true, reason: `Đang chứa ${stockInDb} cái (${pName})` };
    }

    // 4. Check binProductsMap
    const pInfo = binProductsMap.get(cleanBinCode) ||
      (normKey ? binProductsMap.get(normKey) : null) ||
      (shortCode ? binProductsMap.get(shortCode) : null);
    if (pInfo && Number(pInfo.qty || 0) > 0) {
      return { isOccupied: true, reason: `Đang chứa ${pInfo.qty} cái (${pInfo.productName})` };
    }

    // 5. Check findCachedBinInfo (cached warehouse inventory)
    const cached = findCachedBinInfo(cleanBinCode, warehouseCode);
    if (cached) {
      const cQty = Number(cached.totalPhysical || 0);
      const cPct = Number(cached.occupancyPct || 0);
      if (cQty > 0 || cPct > 0) {
        return { isOccupied: true, reason: `Đang lưu kho: ${cached.productName || 'Hàng hóa'} (${cQty} cái, ${cPct}%)` };
      }
    }

    // 6. Check customBins in dbSubWarehouses / currentWarehouseObj
    const currentSubs = dbSubWarehouses && dbSubWarehouses.length > 0 ? dbSubWarehouses : currentWarehouseObj?.subWarehouses || [];
    for (const sub of currentSubs) {
      for (const rk of (sub.racks || [])) {
        if (rk.customBins) {
          const cfg = rk.customBins[cleanBinCode] || (normKey ? rk.customBins[normKey] : null) || rk.customBins[shortCode];
          if (cfg) {
            const cNotes = String(cfg.notes || '').trim();
            const isEmpty = cNotes.includes('Ô Trống') || cNotes.includes('0%') || cNotes.includes('Trống');
            const cPct = Number(cfg.occupancyPct || 0);
            const cQty = Number(cfg.totalPhysical || 0);
            if (!isEmpty && (cPct > 0 || cQty > 0)) {
              return { isOccupied: true, reason: `Kệ có hàng theo sơ đồ (${cPct}%)` };
            }
          }
        }
      }
    }

    return { isOccupied: false };
  }, [selectedBinsMap, items, dbOccupiedBinsMap, binProductsMap, warehouseCode, dbSubWarehouses, currentWarehouseObj]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to latest message
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Real-time slot reservation locks across order drafts / tabs (OUTBOUND ONLY)
  // For INBOUND, unsaved draft orders must NEVER lock shelves; shelves remain in original clean state until order is officially saved!
  useEffect(() => {
    if (!isOpen || mode !== 'OUTBOUND_TRANSFER') return;
    const currentSubs = dbSubWarehouses && dbSubWarehouses.length > 0 ? dbSubWarehouses : currentWarehouseObj?.subWarehouses || [];
    const getBinPct = (bCode: string) => {
      let found = 100;
      currentSubs.forEach((sub: any) => {
        (sub.racks || []).forEach((rk: any) => {
          if (rk.customBins && rk.customBins[bCode]) {
            found = Number(rk.customBins[bCode].occupancyPct ?? 100);
          }
        });
      });
      return found;
    };

    const currentLocks: { binCode: string; productName?: string; occupancyPct?: number }[] = [];
    items.forEach((it) => {
      const bList = selectedBinsMap[it.rowId] || [];
      bList.forEach((bCode) => {
        const pct = getBinPct(bCode);
        currentLocks.push({ binCode: bCode, productName: it.productName, occupancyPct: pct });
      });
    });
    saveActiveDraftSlotLocks(tabId || orderNo, orderNo, currentLocks, true);
  }, [selectedBinsMap, isOpen, tabId, orderNo, items, dbSubWarehouses, currentWarehouseObj, mode]);

  // Auto-hide warning message after 4s
  useEffect(() => {
    if (!warningMessage) return;
    const timer = setTimeout(() => setWarningMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [warningMessage]);

  // Fetch real occupied bin codes & product balance mapping directly from CSDL & stock-in orders
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    async function loadOccupied() {
      try {
        const occMap = new Map<string, number>();
        const prodMap = new Map<string, { productId: string; sku: string; productName: string; qty: number }>();
        const headers = authHeaders();

        const targetWhUpper = (warehouseCode || '').trim().toUpperCase();

        // Check cache for instant load
        const cacheKey = targetWhUpper || 'ALL';
        const cached = smartSlottingCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 30000) {
          if (isMounted) {
            setDbOccupiedBinsMap(new Map(cached.occMap));
            setBinProductsMap(new Map(cached.prodMap));
          }
        }

        // Parallel Fetch for instant loading
        const [balRes, inRes] = await Promise.all([
          fetch(`${API_BASE_URL}/inventory/balances`, { headers }).catch(() => null),
          fetch(`${API_BASE_URL}/inbound/stock-in-orders`, { headers }).catch(() => null),
        ]);

        const [balancesData, ordersData] = await Promise.all([
          balRes && balRes.ok ? balRes.json().catch(() => []) : Promise.resolve([]),
          inRes && inRes.ok ? inRes.json().catch(() => []) : Promise.resolve([]),
        ]);

        // 1. Process physical inventory balances from CSDL
        const balances: any[] = Array.isArray(balancesData) ? balancesData : balancesData?.data || [];
        balances.forEach((b) => {
          const lc = String(b.locationCode || '').trim();
          const physical = Number(b.totalPhysical || b.available || b.allocated || 0);
          const bWhCode = String(b.warehouseCode || b.warehouse?.code || '').trim().toUpperCase();

          // Match if balance belongs to target warehouse or location code starts with warehouse code or targetWhUpper is not set
          const belongsToWh =
            !targetWhUpper ||
            (bWhCode && bWhCode === targetWhUpper) ||
            (lc && lc.toUpperCase().startsWith(targetWhUpper));

          if (lc && physical > 0 && belongsToWh) {
            const pItem = (products || []).find(
              (p) => String(p.id) === String(b.productId) || String(p.id) === String(b.product?.id)
            );
            const pId = String(pItem?.id || b.productId || b.product?.id || '');
            const pName = pItem?.name || b.productName || b.product?.name || 'Hàng hóa';
            const pSku = pItem?.internalSku || (pItem as any)?.sku || b.productSku || b.product?.sku || '';

            const norm = normalizeBinKey(lc);
            occMap.set(lc, physical);
            if (norm) occMap.set(norm, physical);
            prodMap.set(lc, { productId: pId, sku: pSku, productName: pName, qty: physical });
            if (norm) prodMap.set(norm, { productId: pId, sku: pSku, productName: pName, qty: physical });
          }
        });

        // 2. Process stock-in orders history
        const orders: any[] = Array.isArray(ordersData) ? ordersData : ordersData?.data || [];
        orders.forEach((ord) => {
          const ordWhCode = String(ord.warehouseCode || ord.warehouse?.code || '').trim().toUpperCase();
          if (targetWhUpper && ordWhCode && ordWhCode !== targetWhUpper) return;

            (ord.details || ord.items || []).forEach((item: any) => {
              const pItem = (products || []).find(
                (p) => String(p.id) === String(item.productId) || String(p.id) === String(item.product?.id)
              );
              const pId = String(pItem?.id || item.productId || item.product?.id || '');
              const pName = pItem?.name || item.productName || item.product?.name || 'Hàng hóa';
              const pSku = pItem?.internalSku || item.sku || item.product?.sku || '';
              const pQty = Number(item.qty || item.quantity || 1);

              let bins: string[] = item.assignedBins || [];
              if (bins.length === 0 && item.locationBin) {
                bins = item.locationBin.split(',').map((s: string) => s.trim());
              }
              if (bins.length === 0 && item.note) {
                bins = parseAssignedBinsFromNote(item.note);
              }

              bins.forEach((bCode) => {
                if (bCode) {
                  const cleanBin = bCode.split('(')[0].trim();
                  const norm = normalizeBinKey(cleanBin);
                  const short = (cleanBin.split('-').pop() || cleanBin).toUpperCase();
                  occMap.set(cleanBin, pQty);
                  if (norm) occMap.set(norm, pQty);
                  if (short) occMap.set(short, pQty);
                  prodMap.set(cleanBin, { productId: pId, sku: pSku, productName: pName, qty: pQty });
                  if (norm) prodMap.set(norm, { productId: pId, sku: pSku, productName: pName, qty: pQty });
                  if (short) prodMap.set(short, { productId: pId, sku: pSku, productName: pName, qty: pQty });
                }
              });
            });
          });

        // 3. Fallback: Parse from local stock-in orders & local inventory balances in localStorage
        try {
          const rawLocalOrders = localStorage.getItem('stored_stock_in_orders');
          if (rawLocalOrders) {
            const localOrders = JSON.parse(rawLocalOrders);
            if (Array.isArray(localOrders)) {
              localOrders.forEach((ord: any) => {
                (ord.details || ord.items || []).forEach((item: any) => {
                  const pName = item.productName || 'Hàng hóa';
                  const pSku = item.sku || item.productSku || '';
                  const pId = String(item.productId || '');
                  const pQty = Number(item.qty || item.quantity || 1);
                  let bins: string[] = item.assignedBins || (item.locationBin ? item.locationBin.split(',') : []);
                  bins.forEach((bCode: string) => {
                    const cleanBin = bCode.split('(')[0].trim();
                    const norm = normalizeBinKey(cleanBin);
                    const short = (cleanBin.split('-').pop() || cleanBin).toUpperCase();
                    occMap.set(cleanBin, pQty);
                    if (norm) occMap.set(norm, pQty);
                    if (short) occMap.set(short, pQty);
                    prodMap.set(cleanBin, { productId: pId, sku: pSku, productName: pName, qty: pQty });
                    if (norm) prodMap.set(norm, { productId: pId, sku: pSku, productName: pName, qty: pQty });
                    if (short) prodMap.set(short, { productId: pId, sku: pSku, productName: pName, qty: pQty });
                  });
                });
              });
            }
          }
        } catch {}

        // 4. Fallback: Parse customBins from current warehouse topology ONLY
        try {
          const sources = [dbSubWarehouses, currentWarehouseObj?.subWarehouses];
          sources.forEach((subList) => {
            if (!Array.isArray(subList)) return;
            subList.forEach((sub: any) => {
              (sub.racks || []).forEach((rk: any) => {
                if (rk.customBins) {
                  Object.entries(rk.customBins).forEach(([bKey, cfg]: [string, any]) => {
                    const pct = Number(cfg?.occupancyPct || 0);
                    const noteStr = String(cfg?.notes || '').trim();
                    const isStagingNote = noteStr.includes('Đã chọn nhập') || noteStr.includes('Đang xếp') || noteStr.includes('Đang chọn');
                    const isEmptyNote = noteStr.includes('Ô Trống') || noteStr.includes('0%') || noteStr.includes('Trống');
                    const cleanBin = bKey.split('(')[0].trim();
                    const norm = normalizeBinKey(cleanBin);
                    const short = (cleanBin.split('-').pop() || cleanBin).toUpperCase();

                    if (!isStagingNote && !isEmptyNote && pct > 0) {
                      let pName = '';
                      let pSku = '';
                      let pQty = pct;
                      if (Array.isArray(cfg?.products) && cfg.products.length > 0) {
                        pName = cfg.productName || cfg.products.map((p: any) => p.productName).join(', ');
                        pSku = cfg.sku || cfg.products.map((p: any) => p.sku).filter(Boolean).join(', ');
                        pQty = Number(cfg.totalPhysical || cfg.products.reduce((s: number, p: any) => s + (Number(p.qty) || 0), 0));
                      } else {
                        pName = cfg?.productName || noteStr.replace(/Đã chứa:\s*\d+%/gi, '').replace(/\(\d+%\)/gi, '').replace(/\[[^\]]+\]/gi, '').trim();
                        pSku = cfg?.sku || '';
                        pQty = Number(cfg?.totalPhysical || pct);
                      }
                      if (!pName || pName === 'Ô Trống') pName = 'Sản phẩm tồn kho';

                      occMap.set(cleanBin, pQty);
                      if (norm) occMap.set(norm, pQty);

                      const rackCell = `${rk.rackCode || rk.id}-${short}`;
                      const normRackCell = normalizeBinKey(rackCell);
                      occMap.set(rackCell, pQty);
                      if (normRackCell) occMap.set(normRackCell, pQty);

                      const prodObj = { productId: '', sku: pSku, productName: pName, qty: pQty };
                      prodMap.set(cleanBin, prodObj);
                      if (norm) prodMap.set(norm, prodObj);
                      if (short) prodMap.set(short, prodObj);
                      prodMap.set(rackCell, prodObj);
                      if (normRackCell) prodMap.set(normRackCell, prodObj);
                    } else if (pct <= 0 || isEmptyNote) {
                      // Explicitly clean up any empty bin keys
                      occMap.delete(cleanBin);
                      if (norm) occMap.delete(norm);
                      if (short) occMap.delete(short);
                      prodMap.delete(cleanBin);
                      if (norm) prodMap.delete(norm);
                      if (short) prodMap.delete(short);
                    }
                  });
                }
              });
            });
          });
        } catch {}

        if (isMounted) {
          setDbOccupiedBinsMap(occMap);
          setBinProductsMap(prodMap);
          smartSlottingCache.set(cacheKey, {
            timestamp: Date.now(),
            occMap: new Map(occMap),
            prodMap: new Map(prodMap),
          });
        }
      } catch (err) {
        console.error('Lỗi tải dữ liệu ô kệ CSDL:', err);
      }
    }

    loadOccupied();

    const handleStorage = () => {
      clearSmartSlottingCache();
      loadOccupied();
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('warehouse-goods-cleared', handleStorage);

    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('warehouse-goods-cleared', handleStorage);
    };
  }, [isOpen, warehouseCode, products, items, dbSubWarehouses]);

  // Fetch real warehouse subWarehouses & racks configuration from CSDL or localStorage
  useEffect(() => {
    if (!isOpen || !warehouseCode) return;
    let isMounted = true;

    let matchedWhObj: WarehouseRecord | null = null;
    try {
      const localWarehouses = getStoredWarehouses();
      const targetWhUpper = (warehouseCode || '').trim().toUpperCase();
      const found = localWarehouses.find(
        (w) => String(w.code || '').trim().toUpperCase() === targetWhUpper || String(w.id || '').trim().toUpperCase() === targetWhUpper
      );
      if (found) {
        matchedWhObj = found;
      }
    } catch {}

    const fallbackWh: WarehouseRecord = matchedWhObj || {
      id: warehouseCode || 'KHO',
      code: warehouseCode || 'KHO',
      name: `Kho ${warehouseCode || 'KHO'}`,
      address: '',
      status: 'active',
      managerIds: [],
      staffIds: [],
      subWarehouses: subWarehouses || [],
    };

    if (subWarehouses && subWarehouses.length > 0) {
      setDbSubWarehouses(subWarehouses);
      setCurrentWarehouseObj({ ...fallbackWh, subWarehouses });
      return;
    }

    if (matchedWhObj && isMounted) {
      if (matchedWhObj.subWarehouses && matchedWhObj.subWarehouses.length > 0) {
        setDbSubWarehouses(matchedWhObj.subWarehouses);
      }
      setCurrentWarehouseObj(matchedWhObj);
    } else if (isMounted) {
      setCurrentWarehouseObj(fallbackWh);
    }

    // 2. Fresh fetch from backend API
    async function loadWarehouseData() {
      try {
        const headers = authHeaders();
        const res = await fetch(`${API_BASE_URL}/warehouses`, { headers }).catch(() => null);
        if (res && res.ok) {
          const list = await res.json();
          const raw = Array.isArray(list) ? list : list.data || [];
          const targetWhUpper = (warehouseCode || '').trim().toUpperCase();
          const matchedWh = raw.find((w: any) =>
            String(w.code || '').trim().toUpperCase() === targetWhUpper ||
            String(w.id || '').trim().toUpperCase() === targetWhUpper
          );

          if (matchedWh && isMounted) {
            let subs = matchedWh.subWarehouses || [];
            if (typeof subs === 'string') {
              try {
                subs = JSON.parse(subs);
              } catch {
                subs = [];
              }
            }
            if (Array.isArray(subs) && subs.length > 0) {
              setDbSubWarehouses(subs);
              setCurrentWarehouseObj({ ...matchedWh, subWarehouses: subs });
            } else {
              setCurrentWarehouseObj(matchedWh);
            }
          }
        }
      } catch (err) {
        console.error('Lỗi tải cấu hình kho từ CSDL:', err);
      }
    }
    loadWarehouseData();
    return () => {
      isMounted = false;
    };
  }, [isOpen, warehouseCode]);

  // Outbound / Stocktake mode valid bins (only bins storing the specific product being checked)
  const outboundValidBins = useMemo(() => {
    if (mode !== 'OUTBOUND_TRANSFER' && mode !== 'STOCKTAKE') return [];
    const activeItem = items.find((i) => i.rowId === activeRowId) || items[0];
    if (!activeItem) return [];

    const targetPId = String(activeItem.productId || '').trim().toLowerCase();
    const targetSku = String(activeItem.productSku || '').trim().toLowerCase();
    const targetName = String(activeItem.productName || '').trim().toLowerCase();

    const validBins: string[] = [];

    binProductsMap.forEach((info, binKey) => {
      const infoPId = String(info.productId || '').trim().toLowerCase();
      const infoSku = String(info.sku || '').trim().toLowerCase();
      const infoName = String(info.productName || '').trim().toLowerCase();
      const isGeneric = !infoName ||
        infoName === 'sản phẩm tồn kho' ||
        infoName === 'hàng trong kho' ||
        infoName === 'hàng hóa' ||
        infoName === 'kho-luu' ||
        infoName.includes('đã chứa') ||
        infoName.includes('tồn kho');

      const matches =
        (targetPId && infoPId && targetPId === infoPId) ||
        (targetSku && infoSku && targetSku === infoSku) ||
        (targetName && infoName && (infoName.includes(targetName) || targetName.includes(infoName))) ||
        (info.qty > 0 && isGeneric);

      if (matches && info.qty > 0) {
        validBins.push(binKey);
        const clean = binKey.split('(')[0].trim();
        const norm = normalizeBinKey(clean);
        const short = (clean.split('-').pop() || clean).toUpperCase();
        if (norm) validBins.push(norm);
        if (short) validBins.push(short);
        if (short) validBins.push(normalizeBinKey(short));
      }
    });

    // Fallback: check dbOccupiedBinsMap
    dbOccupiedBinsMap.forEach((qty, binKey) => {
      if (qty > 0 && !validBins.includes(binKey)) {
        const normKey = normalizeBinKey(binKey);
        let foundMatch = false;
        (dbSubWarehouses || []).forEach((sub: any) => {
          (sub.racks || []).forEach((rk: any) => {
            const cfg = rk.customBins?.[binKey] || rk.customBins?.[normKey];
            if (cfg && Number(cfg.occupancyPct || 0) > 0) {
              if (Array.isArray(cfg.products) && cfg.products.length > 0) {
                const hasMatchingSubProd = cfg.products.some((p: any) => {
                  const pSku = String(p.sku || '').trim().toLowerCase();
                  const pName = String(p.productName || '').trim().toLowerCase();
                  return (targetSku && pSku && targetSku === pSku) ||
                         (targetName && pName && (targetName.includes(pName) || pName.includes(targetName)));
                });
                if (hasMatchingSubProd) foundMatch = true;
              } else {
                const notes = String(cfg.notes || '').toLowerCase();
                const isGenNote = !notes || notes.includes('đã chứa') || notes.includes('tồn kho') || notes.includes('hàng trong kho');
                if ((targetName && notes.includes(targetName)) || (targetSku && notes.includes(targetSku)) || isGenNote) {
                  foundMatch = true;
                }
              }
            }
          });
        });
        if (foundMatch) {
          validBins.push(binKey);
          if (normKey) validBins.push(normKey);
          const clean = binKey.split('(')[0].trim();
          const short = (clean.split('-').pop() || clean).toUpperCase();
          if (short) validBins.push(short);
          if (short) validBins.push(normalizeBinKey(short));
        }
      }
    });

    // Also include assignedBins and locationBin from activeItem ONLY IF they have physical stock > 0
    if (Array.isArray(activeItem.assignedBins)) {
      activeItem.assignedBins.forEach((b) => {
        if (b) {
          const clean = b.split('(')[0].trim();
          const norm = normalizeBinKey(clean);
          const short = (clean.split('-').pop() || clean).toUpperCase();
          const stock = dbOccupiedBinsMap.get(clean) || (norm ? dbOccupiedBinsMap.get(norm) : 0) || (short ? dbOccupiedBinsMap.get(short) : 0) || 0;
          const prodInfo = binProductsMap.get(clean) || (norm ? binProductsMap.get(norm) : null) || (short ? binProductsMap.get(short) : null);
          if (stock > 0 && prodInfo && (prodInfo.qty || 0) > 0) {
            validBins.push(clean);
            if (norm) validBins.push(norm);
            if (short) validBins.push(short);
          }
        }
      });
    }
    if (activeItem.locationBin) {
      activeItem.locationBin.split(',').forEach((b) => {
        const clean = b.trim();
        if (clean) {
          const norm = normalizeBinKey(clean);
          const short = (clean.split('-').pop() || clean).toUpperCase();
          const stock = dbOccupiedBinsMap.get(clean) || (norm ? dbOccupiedBinsMap.get(norm) : 0) || (short ? dbOccupiedBinsMap.get(short) : 0) || 0;
          const prodInfo = binProductsMap.get(clean) || (norm ? binProductsMap.get(norm) : null) || (short ? binProductsMap.get(short) : null);
          if (stock > 0 && prodInfo && (prodInfo.qty || 0) > 0) {
            validBins.push(clean);
            if (norm) validBins.push(norm);
            if (short) validBins.push(short);
          }
        }
      });
    }

    return Array.from(new Set(validBins));
  }, [mode, items, activeRowId, binProductsMap, dbOccupiedBinsMap, dbSubWarehouses]);

  const racksTopology: RackStructure[] = useMemo(() => {
    const whPrefix = warehouseCode ? warehouseCode.trim().toUpperCase() : 'KHO';

    const createFloorCells = (
      zonePrefix: string,
      rackId: string,
      shelfNum: number,
      shelfPrefix: string,
      cellsCount = 10,
      defaultMaxW = 500
    ): BinCell[] => {
      return Array.from({ length: cellsCount }).map((_, idx) => {
        const cellNum = idx + 1;
        const binShortCode = `${shelfPrefix}${cellNum}`; // e.g. A1, A2, B1, B2...
        const fullBinCode = `${zonePrefix}-${rackId}-${binShortCode}`; // e.g. KH006-ZA-R01-A1
        const legacyBinCode = `${zonePrefix}-${rackId}-S${String(shelfNum).padStart(2, '0')}-C${String(cellNum).padStart(2, '0')}`;

        let isOccupied = false;
        let stockQty = 0;
        let productId = '';
        let productSku = '';
        let productName = '';

        const keysToTry = [
          fullBinCode,
          legacyBinCode,
          binShortCode,
          `${rackId}-${binShortCode}`,
          `${whPrefix}-${binShortCode}`,
          `${whPrefix}-${rackId}-${binShortCode}`,
          `${zonePrefix}-${binShortCode}`,
        ];

        for (const key of keysToTry) {
          const normKey = normalizeBinKey(key);
          if (dbOccupiedBinsMap.has(key) || (normKey && dbOccupiedBinsMap.has(normKey))) {
            stockQty = dbOccupiedBinsMap.get(key) || dbOccupiedBinsMap.get(normKey) || 0;
            if (stockQty > 0) {
              isOccupied = true;
              const info = binProductsMap.get(key) || binProductsMap.get(normKey);
              if (info) {
                productId = info.productId;
                productSku = info.sku;
                productName = info.productName;
              }
              break;
            }
          }
        }

        if (!isOccupied) {
          const normShort = normalizeBinKey(binShortCode);
          const normRack = normalizeBinKey(rackId);

          for (const [k, qty] of dbOccupiedBinsMap.entries()) {
            const normK = normalizeBinKey(k);
            if (!normK) continue;
            const isShortMatch = normK === normShort || normK.endsWith('-' + normShort) || normK.endsWith('_' + normShort);
            const isRackMatch = !normK.includes('R0') || normK.includes(normRack);

            if (isShortMatch && isRackMatch && qty > 0) {
              isOccupied = true;
              stockQty = qty;
              const info = binProductsMap.get(k);
              if (info) {
                productId = info.productId;
                productSku = info.sku;
                productName = info.productName;
              }
              break;
            }
          }
        }

        return {
          binCode: fullBinCode,
          cellCode: `Ô ${binShortCode}`,
          bayCode: `Khoang B${String(cellNum).padStart(2, '0')}`,
          maxWeight: defaultMaxW,
          freeVol: 450,
          isOccupied: isOccupied && stockQty > 0,
          stockQty: stockQty > 0 ? stockQty : 0,
          productId,
          productSku,
          productName,
        };
      });
    };

    // If warehouse subWarehouses & racks are defined in CSDL, build exact real topology
    if (dbSubWarehouses.length > 0) {
      const generatedRacks: RackStructure[] = [];

      dbSubWarehouses.forEach((zone: any) => {
        const zoneCode = zone.code || zone.id || 'ZA';
        const zonePrefix = `${whPrefix}-${zoneCode}`;
        const zoneName = zone.name || `Khu ${zoneCode}`;
        const racksList = zone.racks && zone.racks.length > 0 ? zone.racks : [];

        if (racksList.length > 0) {
          racksList.forEach((rk: any, rkIdx: number) => {
            const rackId = rk.rackCode || `R${String(rkIdx + 1).padStart(2, '0')}`;
            const shelvesCount = Number(rk.shelvesCount) || 4;
            const baysCount = Number(rk.baysCount) || 10;
            const maxW = Number(rk.defaultBinMaxWeight) || 500;

            const floors: ShelfFloor[] = [];
            for (let s = shelvesCount; s >= 1; s--) {
              const shelfIndex = s - 1;
              const shelfPrefix = getRackLetterPrefix(shelfIndex); // 'A', 'B', 'C', 'D'...
              const floorId = `S${String(s).padStart(2, '0')}`;
              floors.push({
                floorId,
                floorName: `Tầng ${shelfPrefix}`,
                floorDesc: `Mâm kệ ${shelfPrefix}1 - ${shelfPrefix}${baysCount}`,
                cells: createFloorCells(zonePrefix, rackId, s, shelfPrefix, baysCount, maxW),
              });
            }

            generatedRacks.push({
              rackId,
              rackName: rk.name || `Dãy Kệ ${rackId} (${whPrefix})`,
              dimensions: `${rk.length || 18}m Dài × ${rk.width || 1.2}m Rộng`,
              spec: `${shelvesCount} Tầng × ${baysCount} Ô`,
              zoneName,
              floors,
            });
          });
        }
      });

      if (generatedRacks.length > 0) {
        return generatedRacks;
      }
    }

    // Helper to build fallback floors with letter prefixes
    const buildFallbackFloors = (zonePrefix: string, rackId: string) => {
      const floors: ShelfFloor[] = [];
      for (let s = 4; s >= 1; s--) {
        const shelfIndex = s - 1;
        const shelfPrefix = getRackLetterPrefix(shelfIndex);
        const floorId = `S${String(s).padStart(2, '0')}`;
        floors.push({
          floorId,
          floorName: `Tầng ${shelfPrefix}`,
          floorDesc: `Mâm kệ ${shelfPrefix}1 - ${shelfPrefix}10`,
          cells: createFloorCells(zonePrefix, rackId, s, shelfPrefix, 10, 500),
        });
      }
      return floors;
    };

    // Default Fallback Racks Topology (R01, R02, R03) if no custom racks in CSDL
    return [
      {
        rackId: 'R01',
        rackName: `Dãy Kệ R01 (${whPrefix})`,
        dimensions: '18m Dài × 1.2m Rộng',
        spec: '4 Tầng × 10 Ô',
        zoneName: `Khu A - Kho ${whPrefix}`,
        floors: buildFallbackFloors(`${whPrefix}-ZA`, 'R01'),
      },
      {
        rackId: 'R02',
        rackName: `Dãy Kệ R02 (${whPrefix})`,
        dimensions: '18m Dài × 1.2m Rộng',
        spec: '4 Tầng × 10 Ô',
        zoneName: `Khu B - Kho ${whPrefix}`,
        floors: buildFallbackFloors(`${whPrefix}-ZB`, 'R02'),
      },
      {
        rackId: 'R03',
        rackName: `Dãy Kệ R03 (${whPrefix} - Kệ Lạnh)`,
        dimensions: '18m Dài × 1.2m Rộng',
        spec: '4 Tầng × 10 Ô',
        zoneName: `Khu C - Kho Lạnh -18°C`,
        floors: buildFallbackFloors(`${whPrefix}-ZC`, 'R03'),
      },
    ];
  }, [warehouseCode, dbOccupiedBinsMap, binProductsMap, dbSubWarehouses]);

  // Ensure activeRackId points to a valid rack in racksTopology
  useEffect(() => {
    if (racksTopology && racksTopology.length > 0) {
      if (!racksTopology.some((r) => r.rackId === activeRackId)) {
        setActiveRackId(racksTopology[0].rackId);
      }
    }
  }, [racksTopology, activeRackId]);

  // Active item & selection initialization when modal opens
  useEffect(() => {
    if (!isOpen || !items || items.length === 0) return;

    const candidateList = validItems.length > 0 ? validItems : items;
    const initialTargetId = targetRowId && candidateList.some((i) => i.rowId === targetRowId)
      ? targetRowId
      : candidateList[0].rowId;

    setActiveRowId(initialTargetId);

    const initialMap: Record<string, string[]> = {};
    const initialManualMap: Record<string, Record<string, { qty: number; pct: number; isManual?: boolean; isCustomQty?: boolean }>> = {};
    const initialAllocatedQtyMap: Record<string, Record<string, number>> = {};
    const initialUpdates: Array<{
      targetBinCode: string;
      targetShortCode: string;
      pct: number;
      notes?: string;
      productName?: string;
      sku?: string;
      qty?: number;
      unit?: string;
    }> = [];

    // Preserve existing assigned bins from order rows ONLY (no forced auto-allocation for all items)
    candidateList.forEach((item) => {
      let rawBinsList: string[] = [];
      if (Array.isArray(item.assignedBins) && item.assignedBins.length > 0) {
        rawBinsList = item.assignedBins;
      } else if (item.locationBin) {
        rawBinsList = item.locationBin.split(',').map((s) => s.trim()).filter(Boolean);
      } else if (item.note) {
        rawBinsList = parseAssignedBinsFromNote(item.note);
      }

      let validBins = rawBinsList.filter(
        (b) => b && b.trim().length > 1 && b.trim() !== warehouseCode
      );

      const targetPrefix = warehouseCode ? warehouseCode.toUpperCase() : '';
      if (targetPrefix && validBins.length > 0) {
        validBins = validBins.map((b) => {
          const parts = b.split('-');
          if (parts.length >= 4 && parts[0] !== targetPrefix) {
            parts[0] = targetPrefix;
            return parts.join('-');
          }
          return b;
        });
      }

      if (validBins.length > 0) {
        if (mode !== 'OUTBOUND_TRANSFER') {
          let itemQty = Number(item.qty || 0);
          if (itemQty <= 0) {
            let sumFromBins = 0;
            validBins.forEach((b) => {
              const mQty = b.match(/\[(\d+(?:\.\d+)?)\s*(?:cái|sp)?\]/);
              if (mQty) sumFromBins += Number(mQty[1]);
            });
            itemQty = sumFromBins > 0 ? sumFromBins : 1;
          }

          initialManualMap[item.rowId] = {};
          const existingAlloc = (item as any).binAllocations || {};
          const existingQtyMap = (item as any).allocatedQtyMap || {};

          validBins.forEach((b) => {
            const cleanB = b.split('(')[0].trim();
            const k = normalizeBinKey(cleanB);
            const shortB = (cleanB.split('-').pop() || cleanB).toUpperCase();

            // 1. Percentage
            const mPct = b.match(/\((\d+(?:\.\d+)?)%\)/);
            const pctVal = mPct ? Number(mPct[1]) : 100;

            // 2. Quantity (extract from [qty cái] or saved allocations)
            let qtyVal = 0;
            const mQty = b.match(/\[(\d+(?:\.\d+)?)\s*(?:cái|sp)?\]/);
            if (mQty) {
              qtyVal = Number(mQty[1]);
            } else if (existingAlloc[k]?.qty) {
              qtyVal = Number(existingAlloc[k].qty);
            } else if (existingAlloc[cleanB]?.qty) {
              qtyVal = Number(existingAlloc[cleanB].qty);
            } else if (existingAlloc[shortB]?.qty) {
              qtyVal = Number(existingAlloc[shortB].qty);
            } else if (existingQtyMap[k]) {
              qtyVal = Number(existingQtyMap[k]);
            } else if (existingQtyMap[cleanB]) {
              qtyVal = Number(existingQtyMap[cleanB]);
            } else if (existingQtyMap[shortB]) {
              qtyVal = Number(existingQtyMap[shortB]);
            }

            const strippedB = cleanB.toUpperCase().replace(/[^A-Z0-9]/g, '');
            const isCustom = Boolean(
              Boolean(mQty && Number(mQty[1]) > 0) ||
              existingAlloc[k]?.isCustomQty ||
              existingAlloc[cleanB]?.isCustomQty ||
              existingAlloc[shortB]?.isCustomQty ||
              existingAlloc[strippedB]?.isCustomQty
            );

            const entry = { qty: qtyVal, pct: pctVal, isManual: isCustom, isCustomQty: isCustom };
            initialManualMap[item.rowId][k] = entry;
            initialManualMap[item.rowId][cleanB] = entry;
            initialManualMap[item.rowId][shortB] = entry;
            initialManualMap[item.rowId][strippedB] = entry;
          });

          const pMetrics = getProductMetricsForItem(item);
          const { formattedBins, binQtyMap, binPctMap } = allocateBinsForInbound(
            validBins,
            itemQty,
            initialManualMap[item.rowId],
            pMetrics
          );
          initialMap[item.rowId] = formattedBins;
          initialAllocatedQtyMap[item.rowId] = binQtyMap;

          formattedBins.forEach((bCodeStr) => {
            const cleanB = bCodeStr.split('(')[0].trim();
            const shortB = (cleanB.split('-').pop() || cleanB).toUpperCase();
            const keyB = normalizeBinKey(cleanB);
            const binPct = binPctMap[keyB] !== undefined ? binPctMap[keyB] : 0;
            const binQty = binQtyMap[keyB] !== undefined ? binQtyMap[keyB] : 0;
            initialUpdates.push({
              targetBinCode: cleanB,
              targetShortCode: shortB,
              pct: binPct,
              notes: 'Đã chọn nhập: ' + binQty + ' ' + (item.unit || 'cái') + ' (' + binPct + '%)',
              productName: item.productName,
              sku: item.productSku || (item as any).sku,
              qty: binQty,
              unit: item.unit || 'cái',
            });
          });
        } else {
          initialMap[item.rowId] = [...validBins];
        }
      }
    });

    if (initialUpdates.length > 0) {
      batchUpdateSubWarehousesTopology(initialUpdates, []);
    }

    setSelectedBinsMap(initialMap);
    setManualBinAllocations(initialManualMap);
    setAllocatedQtyMap(initialAllocatedQtyMap);

    // Auto-switch rack view to the first selected rack if any
    const activeItemBins = initialMap[initialTargetId] || [];
    if (activeItemBins.length > 0) {
      const firstBin = activeItemBins[0];
      const matchRack = racksTopology.find((rk) => firstBin.includes(rk.rackId));
      if (matchRack) {
        setActiveRackId(matchRack.rackId);
      }
    }

    // Initialize AI Welcome Message ONCE if chat history is empty
    setMessages((prev) => {
      if (prev.length > 0) return prev; // Keep existing chat history!

      const activeItem = candidateList.find((i) => i.rowId === initialTargetId) || candidateList[0];
      let itemQty = activeItem?.qty || 0;
      if (itemQty <= 0) {
        const itemBins = initialMap[activeItem?.rowId || ''] || activeItem?.assignedBins || [];
        let binSum = 0;
        itemBins.forEach((b: string) => {
          const m = b.match(/\[(\d+(?:\.\d+)?)\s*(?:cái|sp)?\]/);
          if (m) binSum += Number(m[1]);
        });
        if (binSum > 0) itemQty = binSum;
      }
      const activeMetrics = getProductMetricsForItem(activeItem);
      const maxPerBinByVol = Math.floor(0.96 / Math.max(0.0001, activeMetrics.volume));
      const maxPerBinByWeight = Math.floor(500 / Math.max(0.1, activeMetrics.weight));
      const maxCap = Math.max(1, Math.min(maxPerBinByVol, maxPerBinByWeight));
      const totalBinsNeeded = Math.max(1, Math.ceil(itemQty / maxCap));
      const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const isOutbound = mode === 'OUTBOUND_TRANSFER';
      const assignedForThisItem = initialMap[activeItem?.rowId || ''] || activeItem?.assignedBins || [];
      const binListStr = assignedForThisItem.length > 0
        ? assignedForThisItem.map((b) => `  • ${b}`).join('\n')
        : '  • Chưa phân bổ vị trí ô kệ';

      return [
        {
          id: 'msg-1',
          sender: 'ai',
          text: readOnly
            ? `SƠ ĐỒ VỊ TRÍ Ô KỆ ĐÃ LƯU KHO (CHẾ ĐỘ XEM)\n\nMặt hàng: ${activeItem?.productName || 'Hàng hóa'} (Tổng số lượng: ${itemQty.toLocaleString('vi-VN')} ${activeItem?.unit || 'Cái'})\n\nTrạng thái: Phiếu nhập kho đã được lưu vào hệ thống.\nVị trí các ô kệ đang lưu trữ hàng hóa:\n${binListStr}\n\nℹ️ Bạn đang ở Chế độ xem chi tiết. Vị trí các ô kệ đã lưu hiển thị màu xanh trên sơ đồ.`
            : isDisposal
            ? `CHỈ DẪN XUẤT HỦY HÀNG HÓA (AI SMART WMS)\n\nMặt hàng: ${activeItem?.productName || 'Hàng hóa'} (Tổng xuất hủy: ${itemQty.toLocaleString('vi-VN')} ${activeItem?.unit || 'Cái'})\n\nQUY TẮC XUẤT HỦY HÀNG:\n- Chọn kệ chứa hàng: Nhấp vào ô kệ đang chứa mặt hàng "${activeItem?.productName || 'này'}" để chọn ô lấy hủy.\n- Nhập số lượng: Nhập hoặc điều chỉnh số lượng xuất hủy cụ thể cho từng kệ.\n- Hệ thống không tự động chọn kệ sẵn để bạn hoàn toàn chủ động theo thực tế.\n\n💡 Bạn có thể hỏi AI:\n• "Lấy hàng ở đâu?" / "Kệ nào có hàng?"\n• "Tự động chọn ô cho tất cả sản phẩm" (khi cần AI hỗ trợ chọn tự động)`
            : isOutbound
            ? `CHỈ DẪN XUẤT CHUYỂN KHO & LẤY HÀNG (AI SMART WMS)\n\nMặt hàng: ${activeItem?.productName || 'Hàng hóa'} (Tổng xuất: ${itemQty.toLocaleString('vi-VN')} ${activeItem?.unit || 'Cái'})\n\nQUY TẮC AN TOÀN LẤY HÀNG:\n- Chỉ được chọn các ô kệ đang lưu trữ đúng mặt hàng "${activeItem?.productName || 'này'}".\n- Các ô kệ trống hoặc chứa hàng khác tự động khóa để tránh xuất nhầm hàng.\n\n💡 Bạn có thể hỏi AI:\n• "Tự động chọn ô cho tất cả sản phẩm" (hoặc bấm nút ⚡ Tự động tất cả)\n• "Lấy hàng ở đâu?" / "Kệ nào có hàng?"\n• "Hàng nặng lấy ở tầng nào?" (Ưu tiên tầng sàn A/B)\n• "Kiểm tra có đủ hàng không?"`
            : `CHỈ DẪN NHẬP KHO & LẤY HÀNG (AI SMART WMS)\n\nMặt hàng: ${activeItem?.productName || 'Hàng hóa'} (Tổng nhập: ${itemQty.toLocaleString('vi-VN')} ${activeItem?.unit || 'Cái'})\n\n💡 AI HỖ TRỢ ĐẦY ĐỦ CẢ ĐƠN HÀNG:\n• Tự động tất cả: Bấm nút "⚡ Tự động tất cả (${items.length} SP)" hoặc gõ "Tự động phân bổ tất cả sản phẩm vào kho"\n• Nhập hàng: Hỏi "Nhập vào đâu?", "Kệ trống", "Hàng nặng xếp tầng nào?" (Ưu tiên Tầng A/B)\n• Lấy hàng: Hỏi "Lấy hàng ở đâu?", "Kệ nào có hàng?", "Còn bao nhiêu hàng?"\n• Tự do ra lệnh: "Chọn ô A1", "1 kệ thôi", "Tự động chọn đủ ô"...`,
          time: now,
        },
      ];
    });
  }, [isOpen, readOnly]);

  if (!isOpen) return null;

  if (!items || items.length === 0 || (validItems.length === 0 && items.every((i) => !i.productId && !i.productName))) {
    return createPortal(
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4">
        <div className="bg-white rounded-3xl p-6 shadow-xl text-center space-y-4 max-w-md border-2 border-cyan-500">
          <p className="text-sm font-bold text-slate-800">
            Vui lòng chọn hoặc thêm ít nhất 1 sản phẩm trước khi mở Sơ đồ Ô Kệ Kho.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold transition shadow-sm cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>,
      document.body
    );
  }

  const currentItem = (validItems && validItems.length > 0)
    ? (validItems.find((i) => i.rowId === activeRowId) || validItems[0])
    : ((items && items.length > 0) ? (items.find((i) => i.rowId === activeRowId) || items[0]) : null);
  const currentMetrics = getProductMetricsForItem(currentItem);
  const curMaxPerBinByVol = Math.floor(0.96 / Math.max(0.0001, currentMetrics.volume));
  const curMaxPerBinByWeight = Math.floor(500 / Math.max(0.1, currentMetrics.weight));
  const curMaxCap = Math.max(1, Math.min(curMaxPerBinByVol, curMaxPerBinByWeight));
  const requiredCount = currentItem ? Math.max(1, Math.ceil((Number(currentItem.qty) || 1) / curMaxCap)) : 1;
  const currentSelectedBins = selectedBinsMap[currentItem?.rowId || ''] || [];
  const defaultRackFallback: RackStructure = {
    rackId: 'R01',
    rackName: 'Dãy Kệ R01',
    dimensions: '18m Dài × 1.2m Rộng',
    spec: '4 Tầng × 10 Ô',
    zoneName: 'Phân Khu Kho',
    floors: [],
  };
  const currentRack = (racksTopology && racksTopology.length > 0)
    ? (racksTopology.find((r) => r.rackId === activeRackId) || racksTopology[0])
    : defaultRackFallback;

  const isBinMatchingItem = (cell: BinCell, targetItem?: SlottingItemRow | null): boolean => {
    if (!targetItem) return false;

    // Direct check from cell properties - MUST have positive stock!
    if (cell.isOccupied && (cell.stockQty || 0) > 0) {
      if (targetItem.productId && cell.productId && String(cell.productId) === String(targetItem.productId)) {
        return true;
      }
      const curSku = (targetItem.productSku || '').trim().toLowerCase();
      const cellSku = (cell.productSku || '').trim().toLowerCase();
      if (curSku && cellSku && curSku === cellSku) {
        return true;
      }
      const curName = (targetItem.productName || '').trim().toLowerCase();
      const cellName = (cell.productName || '').trim().toLowerCase();
      if (curName && cellName && (curName.includes(cellName) || cellName.includes(curName))) {
        return true;
      }
    }

    // Fallback: check dbOccupiedBinsMap & binProductsMap by cell.binCode, cell.cellCode, or short code (e.g. D1)
    const shortCode = (cell.binCode.split('-').pop() || cell.binCode).toUpperCase();
    const keysToCheck = [cell.binCode, shortCode, cell.cellCode.replace('Ô ', '')];
    for (const k of keysToCheck) {
      const stock = dbOccupiedBinsMap.get(k) || dbOccupiedBinsMap.get(normalizeBinKey(k)) || 0;
      const info = binProductsMap.get(k) || binProductsMap.get(normalizeBinKey(k));
      if (stock > 0 && info && (info.qty || 0) > 0) {
        const curName = (targetItem.productName || '').trim().toLowerCase();
        const infoName = (info.productName || '').trim().toLowerCase();
        const curSku = (targetItem.productSku || '').trim().toLowerCase();
        const infoSku = (info.sku || '').trim().toLowerCase();

        if (
          (curSku && infoSku && curSku === infoSku) ||
          (curName && infoName && (curName.includes(infoName) || infoName.includes(curName)))
        ) {
          return true;
        }
      }
    }

    return false;
  };

  const isBinMatchingActiveItem = (cell: BinCell): boolean => isBinMatchingItem(cell, currentItem);

  const batchUpdateSubWarehousesTopology = (
    updates: Array<{
      targetBinCode: string;
      targetShortCode: string;
      pct: number;
      notes?: string;
      productName?: string;
      sku?: string;
      qty?: number;
      unit?: string;
    }> = [],
    removals: Array<{ targetBinCode: string; targetShortCode?: string }> = []
  ) => {
    setDbSubWarehouses((prevSubs) => {
      const base = (prevSubs && prevSubs.length > 0 ? prevSubs : currentWarehouseObj?.subWarehouses || []);
      const updatedSubs = base.map((sub: any) => {
        const racks = (sub.racks || []).map((rk: any) => {
          const custom = { ...(rk.customBins || {}) };

          // 1. Process removals first
          removals.forEach(({ targetBinCode, targetShortCode }) => {
            const cleanTarget = targetBinCode.split('(')[0].trim();
            const shortC = (targetShortCode || cleanTarget.split('-').pop() || cleanTarget).toUpperCase();
            const normKey = normalizeBinKey(cleanTarget);
            const prevEntry = custom[cleanTarget] || custom[shortC] || (normKey ? custom[normKey] : null);

            if (prevEntry && Array.isArray(prevEntry.products) && prevEntry.products.length > 0) {
              const curSku = (currentItem?.productSku || '').trim().toUpperCase();
              const curName = (currentItem?.productName || '').trim().toLowerCase();
              const remainingProds = prevEntry.products.filter((p: any) => {
                const pSku = (p.sku || '').trim().toUpperCase();
                const pName = (p.productName || '').trim().toLowerCase();
                return !((curSku && pSku && curSku === pSku) || (curName && pName && (curName.includes(pName) || pName.includes(curName))));
              });

              if (remainingProds.length > 0) {
                const totalPct = remainingProds.reduce((sum: number, p: any) => sum + (Number(p.occupancyPct) || 0), 0);
                const totalQty = remainingProds.reduce((sum: number, p: any) => sum + (Number(p.qty) || 0), 0);
                const descNote = `Đã chứa: ${totalPct}% (${remainingProds.map((p: any) => `${p.productName}: ${p.qty} ${p.unit || 'cái'} [${p.occupancyPct}%]`).join(', ')})`;
                const updated = {
                  ...prevEntry,
                  occupancyPct: totalPct,
                  totalPhysical: totalQty,
                  products: remainingProds,
                  notes: descNote,
                  productName: remainingProds.map((p: any) => p.productName).join(', '),
                  sku: remainingProds.map((p: any) => p.sku).filter(Boolean).join(', '),
                };
                custom[cleanTarget] = updated;
                custom[shortC] = updated;
                if (normKey) custom[normKey] = updated;
                const rackShort = `${rk.rackCode}-${shortC}`;
                custom[rackShort] = updated;
                const normRS = normalizeBinKey(rackShort);
                if (normRS) custom[normRS] = updated;
                return;
              }
            }

            delete custom[cleanTarget];
            delete custom[targetBinCode];
            delete custom[shortC];
            if (normKey) delete custom[normKey];
            const rackShort = `${rk.rackCode}-${shortC}`;
            delete custom[rackShort];
            const normRackShort = normalizeBinKey(rackShort);
            if (normRackShort) delete custom[normRackShort];
          });

          // 2. Process updates
          updates.forEach(({ targetBinCode, targetShortCode, pct, notes, productName, sku, qty, unit }) => {
            const cleanTarget = targetBinCode.split('(')[0].trim();
            const shortC = (targetShortCode || cleanTarget.split('-').pop() || cleanTarget).toUpperCase();
            const isTargetRack = cleanTarget.includes(rk.id || rk.rackCode) || rk.id === activeRackId || rk.rackCode === activeRackId;
            if (isTargetRack) {
              const normKey = normalizeBinKey(cleanTarget);
              const prevEntry = custom[cleanTarget] || custom[shortC] || (normKey ? custom[normKey] : null);

              let existingProds: Array<{ sku?: string; productName: string; qty: number; occupancyPct: number; unit?: string }> = [];
              if (prevEntry && Array.isArray(prevEntry.products) && prevEntry.products.length > 0) {
                existingProds = prevEntry.products.map((p: any) => ({ ...p }));
              } else if (prevEntry && prevEntry.productName && Number(prevEntry.occupancyPct || 0) > 0) {
                existingProds = [{
                  sku: prevEntry.sku || '',
                  productName: prevEntry.productName,
                  qty: Number(prevEntry.totalPhysical || 0),
                  occupancyPct: Number(prevEntry.occupancyPct || 100),
                  unit: 'cái',
                }];
              }

              const curProdName = productName || currentItem?.productName || 'Hàng hóa';
              const curSku = sku || currentItem?.productSku || (currentItem as any)?.sku || '';
              const curUnit = unit || currentItem?.unit || 'cái';
              const curQty = qty !== undefined ? Number(qty) : Number(currentItem?.qty || 1);
              const curPct = pct;

              const matchIdx = existingProds.findIndex(
                (p) =>
                  (curSku && p.sku && curSku.toUpperCase() === p.sku.toUpperCase()) ||
                  (curProdName && p.productName && curProdName.toLowerCase() === p.productName.toLowerCase())
              );

              if (matchIdx >= 0) {
                existingProds[matchIdx] = {
                  ...existingProds[matchIdx],
                  qty: curQty,
                  occupancyPct: curPct,
                  unit: curUnit,
                };
              } else {
                existingProds.push({
                  sku: curSku,
                  productName: curProdName,
                  qty: curQty,
                  occupancyPct: curPct,
                  unit: curUnit,
                });
              }

              const totalShelfPct = Math.min(100, existingProds.reduce((sum, p) => sum + (Number(p.occupancyPct) || 0), 0));
              const totalShelfQty = existingProds.reduce((sum, p) => sum + (Number(p.qty) || 0), 0);
              const descNote = `Đã chứa: ${totalShelfPct}% (${existingProds.map((p) => `${p.productName}: ${p.qty} ${p.unit || 'cái'} [${p.occupancyPct}%]`).join(', ')})`;

              const entry = {
                ...(prevEntry || {}),
                occupancyPct: totalShelfPct,
                totalPhysical: totalShelfQty,
                products: existingProds,
                productName: existingProds.map((p) => p.productName).join(', '),
                sku: existingProds.map((p) => p.sku).filter(Boolean).join(', '),
                notes: notes || descNote,
                maxWeight: 500,
              };

              custom[cleanTarget] = entry;
              custom[shortC] = entry;
              if (normKey) custom[normKey] = entry;
              const rackShort = `${rk.rackCode}-${shortC}`;
              custom[rackShort] = entry;
              const normRS = normalizeBinKey(rackShort);
              if (normRS) custom[normRS] = entry;
            }
          });

          return { ...rk, customBins: custom };
        });
        return { ...sub, racks };
      });

      if (currentWarehouseObj) {
        setCurrentWarehouseObj((prevWh) => prevWh ? { ...prevWh, subWarehouses: updatedSubs } : null);
      }
      return updatedSubs;
    });
  };

  const removeBinCustomConfig = (binCode: string) => {
    const shortCode = (binCode.split('-').pop() || binCode).toUpperCase();
    batchUpdateSubWarehousesTopology([], [{ targetBinCode: binCode, targetShortCode: shortCode }]);
  };

  const updateSubWarehousesTopology = (targetBinCode: string, targetShortCode: string, pct: number, notes?: string) => {
    batchUpdateSubWarehousesTopology([{ targetBinCode, targetShortCode, pct, notes }]);
  };

  const toggleBinSelection = (cell: BinCell) => {
    if (readOnly) return;
    if (!activeRowId || !currentItem) return;

    const binCode = cell.binCode;
    const cleanBinCode = binCode.split('(')[0].trim();
    const shortCode = (cleanBinCode.split('-').pop() || cleanBinCode).toUpperCase();
    const normKey = normalizeBinKey(cleanBinCode);
    const strippedKey = cleanBinCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const activeItem = validItems.find((i) => i.rowId === activeRowId) || items.find((i) => i.rowId === activeRowId) || validItems[0] || items[0];
    if (!activeItem || (!activeItem.productId && !activeItem.productName)) {
      setWarningMessage('⚠️ Vui lòng chọn một dòng có sản phẩm trước khi phân bổ ô kệ!');
      return;
    }
    const targetQty = Number(activeItem?.qty || 1);

    const isMatch = (b: string) => {
      const cleanB = b.split('(')[0].trim();
      const normB = normalizeBinKey(cleanB);
      if (normB && normB === normKey) return true;
      if (cleanB === cleanBinCode) return true;
      const shortB = (cleanB.split('-').pop() || cleanB).toUpperCase();
      if (shortB === shortCode) return true;
      return false;
    };

    const currentList = selectedBinsMap[activeRowId] || [];
    const isCurrentlySelected = currentList.some((b) => isMatch(b));

    let updatedRowManual = { ...(manualBinAllocations[activeRowId] || {}) };
    if (isCurrentlySelected) {
      delete updatedRowManual[normKey];
      delete updatedRowManual[cleanBinCode];
      delete updatedRowManual[binCode];
      delete updatedRowManual[shortCode];
      delete updatedRowManual[strippedKey];
      setManualBinAllocations((prevManual) => ({
        ...prevManual,
        [activeRowId]: updatedRowManual,
      }));
    }

    setSelectedBinsMap((prev) => {
      const currentListInState = prev[activeRowId] || [];
      let updatedRawList: string[];

      if (isCurrentlySelected) {
        // UNCHECKING BIN: Remove from current item's selection
        updatedRawList = currentListInState.filter((b) => !isMatch(b));

        // Check if ANY OTHER item in selectedBinsMap is still using this bin
        const isUsedByOtherItems = Object.entries(prev).some(([rowId, bList]) => {
          if (rowId === activeRowId) return false;
          return bList.some((b) => isMatch(b));
        });

        const removals = !isUsedByOtherItems
          ? [{ targetBinCode: cleanBinCode, targetShortCode: shortCode }]
          : [];

        if (mode !== 'OUTBOUND_TRANSFER') {
          if (updatedRawList.length === 0) {
            batchUpdateSubWarehousesTopology([], removals);
            return { ...prev, [activeRowId]: [] };
          }

          const pMetrics = getProductMetricsForItem(activeItem);
          const { formattedBins, binQtyMap, binPctMap } = allocateBinsForInbound(
            updatedRawList,
            targetQty,
            updatedRowManual,
            pMetrics
          );
          setAllocatedQtyMap((prevQty) => ({ ...prevQty, [activeRowId]: binQtyMap }));

          const updates = formattedBins.map((bCodeStr) => {
            const cleanB = bCodeStr.split('(')[0].trim();
            const shortB = (cleanB.split('-').pop() || cleanB).toUpperCase();
            const keyB = normalizeBinKey(cleanB);
            const binPct = binPctMap[keyB] !== undefined ? binPctMap[keyB] : 0;
            const binQty = binQtyMap[keyB] !== undefined ? binQtyMap[keyB] : 0;
            return {
              targetBinCode: cleanB,
              targetShortCode: shortB,
              pct: binPct,
              notes: 'Đã chọn nhập: ' + binQty + ' ' + (activeItem?.unit || 'cái') + ' (' + binPct + '%)',
              productName: activeItem?.productName,
              sku: activeItem?.productSku || (activeItem as any)?.sku,
              qty: binQty,
              unit: activeItem?.unit || 'cái',
            };
          });

          batchUpdateSubWarehousesTopology(updates, removals);
          return { ...prev, [activeRowId]: formattedBins };
        }

        batchUpdateSubWarehousesTopology([], removals);
        return { ...prev, [activeRowId]: updatedRawList };
      } else {
        // CHECKING BIN: Add to current item's selection
        if (mode === 'OUTBOUND_TRANSFER') {
          const cellPct = (cell as any)?.occupancyPct !== undefined ? Number((cell as any).occupancyPct) : undefined;
          const cellStock = (cell as any)?.stockQty !== undefined ? Number((cell as any).stockQty) : undefined;

          const cachedInfo = findCachedBinInfo(cleanBinCode, warehouseCode);
          const cachedStock = cachedInfo?.totalPhysical !== undefined ? Number(cachedInfo.totalPhysical) : 0;
          const cachedPct = cachedInfo?.occupancyPct !== undefined ? Number(cachedInfo.occupancyPct) : 0;

          const binStock = dbOccupiedBinsMap.get(cleanBinCode)
            || (normKey ? dbOccupiedBinsMap.get(normKey) : 0)
            || (shortCode ? dbOccupiedBinsMap.get(shortCode) : 0)
            || cellStock
            || cachedStock
            || 0;

          const binProd = binProductsMap.get(cleanBinCode)
            || (normKey ? binProductsMap.get(normKey) : null)
            || (shortCode ? binProductsMap.get(shortCode) : null)
            || ((cell as any)?.productName ? { productName: (cell as any).productName, sku: (cell as any).productSku || '', qty: binStock } : null)
            || (cachedInfo ? { productName: cachedInfo.productName, sku: cachedInfo.sku, qty: cachedStock } : null);

          const hasAnyStock = binStock > 0
            || (binProd && (binProd.qty || 0) > 0)
            || (cellPct !== undefined && cellPct > 0)
            || (cachedPct > 0);

          if (!hasAnyStock) {
            setWarningMessage(`⚠️ Kệ ${cleanBinCode} hiện tại đã hết hàng (0%). Không thể chọn lấy hàng từ kệ rỗng!`);
            return prev;
          }

          const assignedToOtherItem = Object.entries(prev).find(([rId, bList]) => {
            if (rId === activeRowId) return false;
            return bList.some((b) => isMatch(b));
          });
          if (assignedToOtherItem) {
            const otherRowId = assignedToOtherItem[0];
            const otherItemIdx = items.findIndex((i) => i.rowId === otherRowId);
            const otherName = items[otherItemIdx]?.productName || 'mặt hàng khác';
            setWarningMessage(`⚠️ Ô ${cleanBinCode} đã được chọn cho mặt hàng #${otherItemIdx + 1} "${otherName}". Vui lòng chọn ô khác cho "${activeItem?.productName}"!`);
            return prev;
          }

          const prodName = (binProd?.productName || (cell as any)?.productName || cachedInfo?.productName || '').trim().toLowerCase();
          const activeProdName = (activeItem?.productName || '').trim().toLowerCase();
          const activeSku = (activeItem?.productSku || (activeItem as any)?.sku || '').trim().toLowerCase();
          const binSku = (binProd?.sku || (cell as any)?.productSku || (cell as any)?.sku || cachedInfo?.sku || '').trim().toLowerCase();
          const activePId = String(activeItem?.productId || (activeItem as any)?.id || '').trim().toLowerCase();
          const binPId = String((cell as any)?.productId || (binProd as any)?.productId || (cachedInfo as any)?.id || '').trim().toLowerCase();

          const isGeneric = !prodName ||
            prodName === 'sản phẩm tồn kho' ||
            prodName === 'hàng trong kho' ||
            prodName === 'hàng hóa' ||
            prodName === 'kho-luu' ||
            prodName.includes('tồn kho') ||
            prodName.includes('đã chứa');

          const isMatchProd = isGeneric ||
            (activeSku && binSku && activeSku === binSku) ||
            (activePId && binPId && activePId === binPId) ||
            (prodName && activeProdName && (prodName.includes(activeProdName) || activeProdName.includes(prodName)));

          const isConflicting = Boolean(prodName && !isGeneric && !isMatchProd);

          if (isConflicting) {
            setWarningMessage(`⚠️ Kệ ${cleanBinCode} đang lưu trữ mặt hàng "${binProd?.productName || prodName}". Vui lòng chỉ chọn các ô kệ có chứa mặt hàng "${activeItem?.productName || ''}"!`);
            return prev;
          }

          setWarningMessage(null);
        }

        // INBOUND MODE: NO BLOCKING QUOTA! But validate that the shelf is empty & not used
        if (mode !== 'OUTBOUND_TRANSFER') {
          const occCheck = isBinOccupiedOrUnavailableForInbound(cell, activeRowId);
          if (occCheck.isOccupied) {
            setWarningMessage(`⚠️ Kệ ${cleanBinCode} không khả dụng cho nhập kho (${occCheck.reason})! Vui lòng chọn ô kệ trống khác.`);
            return prev;
          }
        }

        const filtered = currentListInState.filter((b) => !isMatch(b));
        updatedRawList = [...filtered, cleanBinCode];
      }

      // CAPACITY ALLOCATION PER BIN IN INBOUND / STOCKIN / STOCKTAKE MODE
      if (mode !== 'OUTBOUND_TRANSFER') {
        if (updatedRawList.length === 0) {
          return { ...prev, [activeRowId]: [] };
        }

        const pMetrics = getProductMetricsForItem(activeItem);
        const { formattedBins, binQtyMap, binPctMap } = allocateBinsForInbound(
          updatedRawList,
          targetQty,
          updatedRowManual,
          pMetrics
        );
        setAllocatedQtyMap((prevQty) => ({ ...prevQty, [activeRowId]: binQtyMap }));

        const updates = formattedBins.map((bCodeStr) => {
          const cleanB = bCodeStr.split('(')[0].trim();
          const shortB = (cleanB.split('-').pop() || cleanB).toUpperCase();
          const keyB = normalizeBinKey(cleanB);
          const binPct = binPctMap[keyB] !== undefined ? binPctMap[keyB] : 0;
          const binQty = binQtyMap[keyB] !== undefined ? binQtyMap[keyB] : 0;
          return {
            targetBinCode: cleanB,
            targetShortCode: shortB,
            pct: binPct,
            notes: 'Đã chọn nhập: ' + binQty + ' ' + (activeItem?.unit || 'cái') + ' (' + binPct + '%)',
            productName: activeItem?.productName,
            sku: activeItem?.productSku || (activeItem as any)?.sku,
            qty: binQty,
            unit: activeItem?.unit || 'cái',
          };
        });

        batchUpdateSubWarehousesTopology(updates, []);
        return { ...prev, [activeRowId]: formattedBins };
      }

      return { ...prev, [activeRowId]: updatedRawList };
    });
  };

  const handleConfirmSelections = async () => {
    if (readOnly) {
      onClose();
      return;
    }
    const updatedSubs = dbSubWarehouses && dbSubWarehouses.length > 0 ? dbSubWarehouses : currentWarehouseObj?.subWarehouses || [];
    const updatedRows = items.map((r) => {
      const hasProd = Boolean((r.productId || r.productName) && String(r.productId || r.productName).trim() !== '');
      if (!hasProd) {
        return r; // Không gán vị trí ô kệ cho dòng trống chưa có sản phẩm
      }
      const chosenBins = selectedBinsMap[r.rowId] || [];
      if (chosenBins.length > 0) {
        const cleanNote = stripAssignedBinsFromNote(r.note);
        const formattedBins = chosenBins.map((bCode) => bCode);

        const rowQtyMap = allocatedQtyMap[r.rowId] || {};
        const rowManual = manualBinAllocations[r.rowId] || {};

        return {
          ...r,
          assignedBins: formattedBins,
          locationBin: formattedBins.join(', '),
          binAllocations: rowManual,
          allocatedQtyMap: rowQtyMap,
          note: cleanNote ? `${cleanNote} [Vị trí Ô: ${formattedBins.join(', ')}]` : `[Vị trí Ô: ${formattedBins.join(', ')}]`,
        };
      } else {
        return r;
      }
    });
    onConfirmAll(updatedRows, updatedSubs);
    onClose();
  };

  const handleUpdateBinCapacity = (binCode: string, pct: number, notes?: string, targetRowId?: string, newQty?: number) => {
    if (readOnly) return;
    const cleanBinCode = binCode.split('(')[0].trim();
    const shortCode = (cleanBinCode.split('-').pop() || cleanBinCode).toUpperCase();
    const normTarget = normalizeBinKey(cleanBinCode);

    const rId = targetRowId || activeRowId;
    const targetItem = items.find((i) => i.rowId === rId) || items[0];
    const totalItemQty = Number(targetItem?.qty || 1);

    if (mode !== 'OUTBOUND_TRANSFER') {
      // INBOUND: USER EXPLICITLY EDITED THIS SHELF'S QUANTITY / PERCENTAGE
      const strippedKey = cleanBinCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const calcPct = pct >= 0 ? pct : 100;
      const isCustomQty = newQty !== undefined && newQty > 0;
      const calcQty = isCustomQty ? newQty : 0;
      const entry = { qty: calcQty, pct: calcPct, isManual: true, isCustomQty };

      const isKnownOrderItem = items.some((i) => i.rowId === rId);
      if (!isKnownOrderItem) {
        const isRemoving = pct <= 0 && (!newQty || newQty <= 0);
        if (isRemoving) {
          batchUpdateSubWarehousesTopology([], [{ targetBinCode: cleanBinCode, targetShortCode: shortCode }]);
        } else {
          batchUpdateSubWarehousesTopology([{
            targetBinCode: cleanBinCode,
            targetShortCode: shortCode,
            pct: calcPct,
            qty: calcQty,
            notes: notes || `Đã lưu: ${calcQty} cái (${calcPct}%)`,
          }]);
        }
        return;
      }

      setManualBinAllocations((prevManual) => {
        const rowManual = { ...(prevManual[rId] || {}) };
        if (pct <= 0 && (!newQty || newQty <= 0)) {
          delete rowManual[normTarget];
          delete rowManual[cleanBinCode];
          delete rowManual[shortCode];
          delete rowManual[strippedKey];
        } else {
          rowManual[normTarget] = entry;
          rowManual[cleanBinCode] = entry;
          rowManual[shortCode] = entry;
          rowManual[strippedKey] = entry;
        }
        return { ...prevManual, [rId]: rowManual };
      });

      // Reallocate bins with this updated manualMap
      setSelectedBinsMap((prev) => {
        let currentList = prev[rId] || [];
        const isRemoving = pct <= 0 && (!newQty || newQty <= 0);
        const removals = isRemoving ? [{ targetBinCode: cleanBinCode, targetShortCode: shortCode }] : [];

        if (isRemoving) {
          currentList = currentList.filter((b) => {
            const cleanB = b.split('(')[0].trim();
            const normB = normalizeBinKey(cleanB);
            const shortB = (cleanB.split('-').pop() || cleanB).toUpperCase();
            return normB !== normTarget && cleanB !== cleanBinCode && shortB !== shortCode;
          });
        } else {
          const isAlready = currentList.some((b) => {
            const cleanB = b.split('(')[0].trim();
            const normB = normalizeBinKey(cleanB);
            const shortB = (cleanB.split('-').pop() || cleanB).toUpperCase();
            return normB === normTarget || cleanB === cleanBinCode || shortB === shortCode;
          });
          if (!isAlready) {
            currentList = [...currentList, cleanBinCode];
          }
        }

        const updatedRowManual = {
          ...(manualBinAllocations[rId] || {}),
          [normTarget]: entry,
          [cleanBinCode]: entry,
          [shortCode]: entry,
          [strippedKey]: entry,
        };
        if (isRemoving) {
          delete updatedRowManual[normTarget];
          delete updatedRowManual[cleanBinCode];
          delete updatedRowManual[shortCode];
          delete updatedRowManual[strippedKey];
        }

        if (currentList.length === 0) {
          batchUpdateSubWarehousesTopology([], removals);
          setAllocatedQtyMap((prevQty) => ({ ...prevQty, [rId]: {} }));
          return { ...prev, [rId]: [] };
        }

        const pMetrics = getProductMetricsForItem(targetItem);
        const { formattedBins, binQtyMap, binPctMap } = allocateBinsForInbound(
          currentList,
          totalItemQty,
          updatedRowManual,
          pMetrics
        );
        setAllocatedQtyMap((prevQty) => ({ ...prevQty, [rId]: binQtyMap }));

        const updates = formattedBins.map((bCodeStr) => {
          const cleanB = bCodeStr.split('(')[0].trim();
          const shortB = (cleanB.split('-').pop() || cleanB).toUpperCase();
          const keyB = normalizeBinKey(cleanB);
          const bPct = binPctMap[keyB] !== undefined ? binPctMap[keyB] : 0;
          const bQty = binQtyMap[keyB] !== undefined ? binQtyMap[keyB] : 0;
          return {
            targetBinCode: cleanB,
            targetShortCode: shortB,
            pct: bPct,
            notes: 'Đã chọn nhập: ' + bQty + ' ' + (targetItem?.unit || 'cái') + ' (' + bPct + '%)',
            productName: targetItem?.productName,
            sku: targetItem?.productSku || (targetItem as any)?.sku,
            qty: bQty,
            unit: targetItem?.unit || 'cái',
          };
        });

        batchUpdateSubWarehousesTopology(updates, removals);
        return { ...prev, [rId]: formattedBins };
      });

      return;
    }

    // OUTBOUND / STOCKTAKE MODE
    if (rId) {
      setSelectedBinsMap((prev) => {
        const currentList = prev[rId] || [];
        const filtered = currentList.filter((b) => normalizeBinKey(b) !== normTarget && !b.startsWith(cleanBinCode));

        let newMap: Record<string, string[]>;
        if (pct >= 100) {
          const entryToSave = cleanBinCode;
          newMap = { ...prev, [rId]: [entryToSave] };
        } else if (pct > 0) {
          const entryToSave = cleanBinCode + ' (' + pct + '%)';
          newMap = { ...prev, [rId]: [...filtered, entryToSave] };
        } else {
          newMap = { ...prev, [rId]: filtered };
        }

        let totalPctForBin = 0;
        Object.values(newMap).forEach((bList) => {
          bList.forEach((b) => {
            if (normalizeBinKey(b) === normTarget || b.startsWith(cleanBinCode)) {
              const m = b.match(/\((\d+(?:\.\d+)?)%\)/);
              if (m) totalPctForBin += Number(m[1]);
              else totalPctForBin += 100;
            }
          });
        });

        let targetTopologyPct = totalPctForBin;
        if (notes && notes.startsWith('REMAINING:')) {
          const rem = parseFloat(notes.replace('REMAINING:', ''));
          if (!isNaN(rem)) {
            targetTopologyPct = rem;
          }
        } else if (mode === 'OUTBOUND_TRANSFER' || mode === 'STOCKTAKE') {
          let initialBinOccupancy = 100;
          (dbSubWarehouses && dbSubWarehouses.length > 0 ? dbSubWarehouses : currentWarehouseObj?.subWarehouses || []).forEach((sub: any) => {
            (sub.racks || []).forEach((rk: any) => {
              const cb = rk.customBins?.[cleanBinCode] || rk.customBins?.[shortCode];
              if (cb && cb.occupancyPct !== undefined) {
                initialBinOccupancy = cb.occupancyPct;
              }
            });
          });
          targetTopologyPct = Math.max(0, Number((initialBinOccupancy - totalPctForBin).toFixed(1)));
        }

        const noteText = notes || ('Còn chứa: ' + targetTopologyPct + '% (Đã xuất trừ: ' + totalPctForBin + '%)');
        updateSubWarehousesTopology(cleanBinCode, shortCode, targetTopologyPct, noteText);
        return newMap;
      });
    } else {
      updateSubWarehousesTopology(cleanBinCode, shortCode, pct, notes);
    }
  };

  const autoSlotAllItems = (customAiPrompt?: string, isDirectButtonClick = false) => {
    const slotItems = validItems.length > 0 ? validItems : items.filter((it) => Boolean(it.productId || it.productName));
    if (readOnly || !slotItems || slotItems.length === 0) {
      if (isDirectButtonClick) {
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            sender: 'ai',
            text: '⚠️ Không có dòng sản phẩm hợp lệ nào trong đơn hàng để thực hiện phân bổ vị trí.',
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
      return;
    }

    const allCellsList: BinCell[] = [];
    racksTopology.forEach((rk) => {
      rk.floors.forEach((fl) => {
        fl.cells.forEach((cl) => {
          allCellsList.push(cl);
        });
      });
    });

    const isExplicitOutbound = customAiPrompt
      ? (customAiPrompt.toLowerCase().includes('xuất') || customAiPrompt.toLowerCase().includes('lấy') || customAiPrompt.toLowerCase().includes('nhặt') || customAiPrompt.toLowerCase().includes('soạn'))
      : false;
    const isExplicitInbound = customAiPrompt
      ? (customAiPrompt.toLowerCase().includes('nhập') || customAiPrompt.toLowerCase().includes('cất') || customAiPrompt.toLowerCase().includes('xếp') || customAiPrompt.toLowerCase().includes('trống'))
      : false;

    const isOutbound = isExplicitOutbound || (mode === 'OUTBOUND_TRANSFER' && !isExplicitInbound);

    const newSelectedBinsMap: Record<string, string[]> = { ...selectedBinsMap };
    const newAllocatedQtyMap: Record<string, Record<string, number>> = { ...allocatedQtyMap };
    const allocatedBinsInThisRun = new Set<string>();
    const allTopologyUpdates: Array<{
      targetBinCode: string;
      targetShortCode: string;
      pct: number;
      notes?: string;
      productName?: string;
      sku?: string;
      qty?: number;
      unit?: string;
    }> = [];

    const summaryLines: string[] = [];

    if (!isOutbound) {
      // INBOUND / STOCKIN: AUTO ALLOCATE ALL PRODUCTS TO OPTIMAL EMPTY BINS
      summaryLines.push(`[AI TỰ ĐỘNG PHÂN BỔ TẤT CẢ SẢN PHẨM VÀO KHO]:`);
      summaryLines.push(`Tổng cộng: ${slotItems.length} mặt hàng có sản phẩm cần nhập.`);
      summaryLines.push(``);

      let successCount = 0;

      slotItems.forEach((it, idx) => {
        const pMetrics = getProductMetricsForItem(it);
        const targetQty = Number(it.qty || 1);
        const maxPerBinByVol = Math.floor(0.96 / Math.max(0.0001, pMetrics.volume));
        const maxPerBinByWeight = Math.floor(500 / Math.max(0.1, pMetrics.weight));
        const maxPerBin = Math.max(1, Math.min(maxPerBinByVol, maxPerBinByWeight));
        const neededBinsCount = Math.max(1, Math.ceil(targetQty / maxPerBin));

        const isHeavy = pMetrics.weight >= 20 || (targetQty * pMetrics.weight) >= 50;
        const isLight = pMetrics.weight < 5 && (targetQty * pMetrics.weight) < 30;

        // Filter available empty cells not occupied and not already allocated in this run
        const availableCells = allCellsList.filter((cl) => {
          const cleanCode = cl.binCode.split('(')[0].trim();
          if (allocatedBinsInThisRun.has(cleanCode)) return false;
          return !isBinOccupiedOrUnavailableForInbound(cl, it.rowId).isOccupied;
        });

        // Sort by tier preference
        availableCells.sort((a, b) => {
          const shortA = (a.binCode.split('-').pop() || a.cellCode || '').toUpperCase();
          const shortB = (b.binCode.split('-').pop() || b.cellCode || '').toUpperCase();
          const tierA = shortA[0] || 'A';
          const tierB = shortB[0] || 'A';

          if (isHeavy) {
            // Heavy: A -> B -> C -> D
            return tierA.localeCompare(tierB);
          } else if (isLight) {
            // Light: D -> C -> B -> A
            return tierB.localeCompare(tierA);
          } else {
            // Medium: B -> C -> A -> D
            const order: Record<string, number> = { B: 1, C: 2, A: 3, D: 4 };
            return (order[tierA] || 5) - (order[tierB] || 5);
          }
        });

        const chosenCells = availableCells.slice(0, neededBinsCount);

        if (chosenCells.length > 0) {
          const chosenBinCodes = chosenCells.map((c) => c.binCode);
          chosenCells.forEach((c) => allocatedBinsInThisRun.add(c.binCode.split('(')[0].trim()));

          const { formattedBins, binQtyMap, binPctMap } = allocateBinsForInbound(
            chosenBinCodes,
            targetQty,
            manualBinAllocations[it.rowId] || {},
            pMetrics
          );

          newSelectedBinsMap[it.rowId] = formattedBins;
          newAllocatedQtyMap[it.rowId] = binQtyMap;

          formattedBins.forEach((bCodeStr) => {
            const cleanB = bCodeStr.split('(')[0].trim();
            const shortB = (cleanB.split('-').pop() || cleanB).toUpperCase();
            const keyB = normalizeBinKey(cleanB);
            const binPct = binPctMap[keyB] !== undefined ? binPctMap[keyB] : 0;
            const binQty = binQtyMap[keyB] !== undefined ? binQtyMap[keyB] : 0;
            allTopologyUpdates.push({
              targetBinCode: cleanB,
              targetShortCode: shortB,
              pct: binPct,
              notes: `Đã chọn nhập: ${binQty} ${it.unit || 'cái'} (${binPct}%)`,
              productName: it.productName,
              sku: it.productSku || (it as any)?.sku,
              qty: binQty,
              unit: it.unit || 'cái',
            });
          });

          const shortNames = formattedBins.map((b) => b.split('-').pop()).join(', ');
          const tierNote = isHeavy ? ' [Tầng A/B chịu tải nặng]' : isLight ? ' [Tầng cao C/D]' : '';
          summaryLines.push(`• #${idx + 1} ${it.productName || 'Hàng hóa'}: Đã xếp ${formattedBins.length} ô (${shortNames})${tierNote} - SL: ${targetQty.toLocaleString('vi-VN')} ${it.unit || 'cái'}`);
          successCount++;
        } else {
          summaryLines.push(`• #${idx + 1} ${it.productName || 'Hàng hóa'}: ⚠️ Không còn đủ ô trống khả dụng!`);
        }
      });

      summaryLines.push(``);
      summaryLines.push(`-> Hoàn tất phân bổ ${successCount}/${slotItems.length} mặt hàng có sản phẩm lên sơ đồ 2D kệ kho.`);
    } else {
      // OUTBOUND / TRANSFER MODE: AUTO-SELECT BINS WITH EXISTING STOCK FOR ALL PRODUCTS
      summaryLines.push(`[AI TỰ ĐỘNG CHỌN Ô LẤY HÀNG CHO TẤT CẢ SẢN PHẨM]:`);
      summaryLines.push(`Tổng cộng: ${slotItems.length} mặt hàng có sản phẩm cần xuất/lấy.`);
      summaryLines.push(``);

      let successCount = 0;

      slotItems.forEach((it, idx) => {
        const reqQty = Number(it.qty || 1);
        const matchingCells = allCellsList.filter((cl) => {
          const cleanCode = cl.binCode.split('(')[0].trim();
          if (allocatedBinsInThisRun.has(cleanCode)) return false;
          return isBinMatchingItem(cl, it) && (Number(cl.stockQty) > 0 || Number((cl as any).occupancyPct) > 0);
        });

        // Prioritize bottom tiers for heavy goods
        const pMetrics = getProductMetricsForItem(it);
        const isHeavy = pMetrics.weight >= 20 || (reqQty * pMetrics.weight) >= 50;

        matchingCells.sort((a, b) => {
          const shortA = (a.binCode.split('-').pop() || a.cellCode || '').toUpperCase();
          const shortB = (b.binCode.split('-').pop() || b.cellCode || '').toUpperCase();
          const tierA = shortA[0] || 'A';
          const tierB = shortB[0] || 'A';
          if (isHeavy) return tierA.localeCompare(tierB);
          return tierB.localeCompare(tierA);
        });

        const chosenCodes: string[] = [];
        let accumulatedStock = 0;

        for (const cl of matchingCells) {
          if (accumulatedStock >= reqQty) break;
          chosenCodes.push(cl.binCode);
          allocatedBinsInThisRun.add(cl.binCode.split('(')[0].trim());
          const stock = Number(cl.stockQty || (cl as any).totalPhysical || 1);
          accumulatedStock += stock;
        }

        if (chosenCodes.length > 0) {
          newSelectedBinsMap[it.rowId] = chosenCodes;
          const shortNames = chosenCodes.map((b) => b.split('-').pop()).join(', ');
          const isEnough = accumulatedStock >= reqQty;
          summaryLines.push(`• #${idx + 1} ${it.productName || 'Hàng hóa'}: Lấy từ ${chosenCodes.length} ô (${shortNames}) - Tồn: ${accumulatedStock}/${reqQty} ${it.unit || 'cái'} ${isEnough ? '✅' : '⚠️ (Thiếu hàng)'}`);
          successCount++;
        } else {
          summaryLines.push(`• #${idx + 1} ${it.productName || 'Hàng hóa'}: ⚠️ Không tìm thấy ô có hàng trong kho!`);
        }
      });

      summaryLines.push(``);
      summaryLines.push(`-> Hoàn tất quét và chọn ô lấy hàng cho ${successCount}/${slotItems.length} mặt hàng có sản phẩm.`);
    }

    // Apply state updates
    setSelectedBinsMap(newSelectedBinsMap);
    setAllocatedQtyMap(newAllocatedQtyMap);

    if (allTopologyUpdates.length > 0) {
      batchUpdateSubWarehousesTopology(allTopologyUpdates, []);
    }

    // Auto-switch view to first allocated rack
    const allAssigned = Object.values(newSelectedBinsMap).flat();
    if (allAssigned.length > 0) {
      const firstBin = allAssigned[0].split('(')[0].trim();
      const matchRack = racksTopology.find((rk) => firstBin.includes(rk.rackId));
      if (matchRack) setActiveRackId(matchRack.rackId);
    }

    const reportText = summaryLines.join('\n');
    const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    if (isDirectButtonClick) {
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          sender: 'user',
          text: isOutbound ? '⚡ Tự động chọn ô lấy hàng cho tất cả sản phẩm' : '⚡ Tự động phân bổ vị trí kho cho tất cả sản phẩm',
          time: now,
        },
        {
          id: `ai-${Date.now() + 1}`,
          sender: 'ai',
          text: reportText,
          time: now,
        },
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: reportText,
          time: now,
        },
      ]);
    }
  };

  const handleSendMessage = (e?: React.FormEvent, customMsg?: string) => {
    if (e) e.preventDefault();
    const userText = (customMsg || inputMsg).trim();
    if (!userText) return;

    const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, sender: 'user', text: userText, time: now }]);
    if (!customMsg) setInputMsg('');

    setTimeout(() => {
      let aiReply = '';
      const lower = userText.toLowerCase();

      // Check ALL PRODUCTS auto-slotting command
      const isAllItemsIntent =
        lower.includes('tất cả sản phẩm') ||
        lower.includes('tất cả các sản phẩm') ||
        lower.includes('toàn bộ sản phẩm') ||
        lower.includes('tất cả sp') ||
        lower.includes('tự động tất cả') ||
        lower.includes('gợi ý tất cả') ||
        lower.includes('xếp tất cả') ||
        lower.includes('phân bổ tất cả') ||
        lower.includes('tự động cho tất cả') ||
        lower.includes('cho tất cả sản phẩm') ||
        lower.includes('auto all');

      if (isAllItemsIntent) {
        autoSlotAllItems(userText, false);
        return;
      }

      // Collect all cells across topology
      const allCellsList: BinCell[] = [];
      racksTopology.forEach((rk) => {
        rk.floors.forEach((fl) => {
          fl.cells.forEach((cl) => {
            allCellsList.push(cl);
          });
        });
      });

      const activeItem = (validItems.find((i) => i.rowId === activeRowId) || validItems[0] || items.find((i) => i.rowId === activeRowId) || items[0]);

      const setCandidateBinsForActiveItem = (candidateBins: string[]) => {
        if (!activeRowId) return;
        if (mode !== 'OUTBOUND_TRANSFER') {
          const itemQty = Number(activeItem?.qty || 1);
          const prevBins = selectedBinsMap[activeRowId] || [];
          const removals = prevBins
            .filter((pb) => {
              const cleanPb = pb.split('(')[0].trim();
              const shortPb = (cleanPb.split('-').pop() || cleanPb).toUpperCase();
              return !candidateBins.some((cb) => {
                const cleanCb = cb.split('(')[0].trim();
                const shortCb = (cleanCb.split('-').pop() || cleanCb).toUpperCase();
                return cleanPb === cleanCb || shortPb === shortCb;
              });
            })
            .map((pb) => ({
              targetBinCode: pb.split('(')[0].trim(),
              targetShortCode: (pb.split('(')[0].trim().split('-').pop() || '').toUpperCase(),
            }));

          const pMetrics = getProductMetricsForItem(activeItem);
          const { formattedBins, binQtyMap, binPctMap } = allocateBinsForInbound(
            candidateBins,
            itemQty,
            manualBinAllocations[activeRowId] || {},
            pMetrics
          );
          setAllocatedQtyMap((prevQty) => ({ ...prevQty, [activeRowId]: binQtyMap }));
          setSelectedBinsMap((prev) => ({ ...prev, [activeRowId]: formattedBins }));

          const updates = formattedBins.map((bCodeStr) => {
            const cleanB = bCodeStr.split('(')[0].trim();
            const shortB = (cleanB.split('-').pop() || cleanB).toUpperCase();
            const keyB = normalizeBinKey(cleanB);
            const binPct = binPctMap[keyB] !== undefined ? binPctMap[keyB] : 0;
            const binQty = binQtyMap[keyB] !== undefined ? binQtyMap[keyB] : 0;
            return {
              targetBinCode: cleanB,
              targetShortCode: shortB,
              pct: binPct,
              notes: 'Đã chọn nhập: ' + binQty + ' ' + (activeItem?.unit || 'cái') + ' (' + binPct + '%)',
              productName: activeItem?.productName,
              sku: activeItem?.productSku || (activeItem as any)?.sku,
              qty: binQty,
              unit: activeItem?.unit || 'cái',
            };
          });

          batchUpdateSubWarehousesTopology(updates, removals);
        } else {
          setSelectedBinsMap((prev) => ({ ...prev, [activeRowId]: candidateBins }));
        }
      };

      // Extract active product details for physical metrics (weight, dimensions, volume)
      const activeProduct = (products || []).find((p: any) =>
        (activeItem?.productId && (p.id === activeItem.productId || p._id === activeItem.productId)) ||
        (activeItem?.productSku && (p.sku === activeItem.productSku || p.internalSku === activeItem.productSku)) ||
        (activeItem?.productName && p.name === activeItem.productName)
      ) || activeItem;
      const pWeight = Number(activeProduct?.weight ?? (activeProduct as any)?.weight ?? 1.0);
      const totalWeight = pWeight * Number(activeItem?.qty || 1);

      // Operation intent analysis (LẤY HÀNG vs NHẬP HÀNG)
      const isExplicitOutbound =
        lower.includes('lấy') ||
        lower.includes('xuất') ||
        lower.includes('nhặt') ||
        lower.includes('soạn') ||
        lower.includes('có hàng') ||
        lower.includes('còn hàng') ||
        lower.includes('ở đâu') ||
        lower.includes('tồn ở') ||
        lower.includes('vị trí hàng') ||
        lower.includes('lấy ở') ||
        lower.includes('xuất ở');

      const isExplicitInbound =
        lower.includes('nhập') ||
        lower.includes('cất') ||
        lower.includes('xếp') ||
        lower.includes('đặt vào') ||
        lower.includes('trống') ||
        lower.includes('ô trống') ||
        lower.includes('kệ trống') ||
        lower.includes('lưu kho');

      const isOutboundOp = isExplicitOutbound || (mode === 'OUTBOUND_TRANSFER' && !isExplicitInbound);

      // Collect occupied bins matching current active product across the entire warehouse
      const matchingOccupiedBins: {
        binCode: string;
        shortCode: string;
        rackId: string;
        rackName: string;
        pct: number;
        qty: number;
        pName: string;
        unit: string;
        isTierA: boolean;
        isTierB: boolean;
        isTopTier: boolean;
      }[] = [];

      racksTopology.forEach((rk) => {
        rk.floors.forEach((fl) => {
          fl.cells.forEach((cl) => {
            const clAny = cl as any;
            const isMatch = isBinMatchingActiveItem(cl);
            const cellStock = Number(cl.stockQty || clAny.totalPhysical || 0);
            if (isMatch && cellStock > 0) {
              const short = (cl.binCode.split('-').pop() || cl.cellCode || '').toUpperCase();
              matchingOccupiedBins.push({
                binCode: cl.binCode,
                shortCode: short,
                rackId: rk.rackId,
                rackName: rk.rackName || rk.rackId,
                pct: clAny.occupancyPct || 100,
                qty: cellStock,
                pName: cl.productName || activeItem?.productName || 'Sản phẩm',
                unit: clAny.unit || activeItem?.unit || 'Cái',
                isTierA: short.startsWith('A') || cl.binCode.includes('-A'),
                isTierB: short.startsWith('B') || cl.binCode.includes('-B'),
                isTopTier: short.startsWith('D') || short.startsWith('C') || cl.binCode.includes('-D') || cl.binCode.includes('-C'),
              });
            }
          });
        });
      });

      const totalStockAvailable = matchingOccupiedBins.reduce((sum, b) => sum + b.qty, 0);

      // =========================================================================
      // 1. OUTBOUND / PICKING INTENTS (LẤY HÀNG / XUẤT KHO)
      // =========================================================================
      if (isOutboundOp && (
        lower.includes('nặng') ||
        lower.includes('hàng nặng') ||
        lower.includes('chịu lực') ||
        lower.includes('tầng a') ||
        lower.includes('dưới cùng')
      )) {
        // OUTBOUND HEAVY GOODS: Prioritize bottom tier (A & B) where heavy goods are stored
        const heavyOccupied = matchingOccupiedBins.filter((b) => b.isTierA || b.isTierB);
        if (heavyOccupied.length > 0) {
          const candidateCodes = heavyOccupied.map((b) => b.binCode);
          if (activeRowId) {
            setSelectedBinsMap((prev) => ({ ...prev, [activeRowId]: candidateCodes }));
            const firstBin = candidateCodes[0];
            const matchRack = racksTopology.find((rk) => firstBin.includes(rk.rackId));
            if (matchRack) setActiveRackId(matchRack.rackId);
          }
          const shortNames = heavyOccupied.map((b) => `Ô ${b.shortCode} (${b.rackName}: ${b.qty} ${b.unit})`).join(', ');
          aiReply = `[AI CHỈ DẪN LẤY HÀNG NẶNG - TẦNG DƯỚI CÙNG (TẦNG A/B)]:\n- Mặt hàng "${activeItem?.productName || 'Hàng hóa'}" có khối lượng ${pWeight.toLocaleString('vi-VN')}kg/đơn vị (Tổng xuất: ${totalWeight.toLocaleString('vi-VN')}kg).\n- Theo quy chuẩn an toàn kho, AI đã tìm thấy hàng nặng đang lưu trữ ở tầng thấp: ${shortNames}.\n- AI đã tự động tích chọn các ô này trên sơ đồ 2D để thủ kho dễ dàng dùng xe nâng / xe kéo lấy hàng an toàn!`;
        } else if (matchingOccupiedBins.length > 0) {
          const candidateCodes = matchingOccupiedBins.map((b) => b.binCode);
          if (activeRowId) {
            setSelectedBinsMap((prev) => ({ ...prev, [activeRowId]: candidateCodes }));
            const firstBin = candidateCodes[0];
            const matchRack = racksTopology.find((rk) => firstBin.includes(rk.rackId));
            if (matchRack) setActiveRackId(matchRack.rackId);
          }
          const shortNames = matchingOccupiedBins.map((b) => `Ô ${b.shortCode} (${b.rackName}: ${b.qty} ${b.unit})`).join(', ');
          aiReply = `[LƯU Ý AN TOÀN LẤY HÀNG NẶNG]:\n- Không tìm thấy hàng ở tầng sàn (Tầng A). Hàng hiện đang lưu ở các tầng cao: ${shortNames}.\n- AI đã tích chọn các ô này. Vui lòng sử dụng thang nâng hoặc xe nâng chuyên dụng khi lấy hàng!`;
        } else {
          aiReply = `[THÔNG BÁO] Không tìm thấy tồn kho của mặt hàng nặng "${activeItem?.productName}". Vui lòng kiểm tra lại CSDL kho.`;
        }
      } else if (isOutboundOp && (
        lower.includes('nhẹ') ||
        lower.includes('hàng nhẹ') ||
        lower.includes('trên cùng') ||
        lower.includes('tầng d') ||
        lower.includes('tầng c')
      )) {
        // OUTBOUND LIGHT GOODS: Top tier picking
        const topOccupied = matchingOccupiedBins.filter((b) => b.isTopTier);
        const candidates = topOccupied.length > 0 ? topOccupied : matchingOccupiedBins;
        if (candidates.length > 0) {
          const candidateCodes = candidates.map((b) => b.binCode);
          if (activeRowId) {
            setSelectedBinsMap((prev) => ({ ...prev, [activeRowId]: candidateCodes }));
            const firstBin = candidateCodes[0];
            const matchRack = racksTopology.find((rk) => firstBin.includes(rk.rackId));
            if (matchRack) setActiveRackId(matchRack.rackId);
          }
          const shortNames = candidates.map((b) => `Ô ${b.shortCode} (${b.rackName}: ${b.qty} ${b.unit})`).join(', ');
          aiReply = `[AI CHỈ DẪN LẤY HÀNG NHẸ - TẦNG TRÊN (TẦNG D/C)]:\n- Mặt hàng "${activeItem?.productName || 'Hàng hóa'}" là HÀNG NHẸ.\n- AI đã tìm thấy và tích chọn các ô có hàng: ${shortNames}.`;
        } else {
          aiReply = `[THÔNG BÁO] Không tìm thấy tồn kho của mặt hàng "${activeItem?.productName}".`;
        }
      } else if (
        isExplicitOutbound ||
        lower.includes('còn hàng') ||
        lower.includes('có hàng') ||
        lower.includes('kệ có hàng') ||
        lower.includes('ô có hàng') ||
        lower.includes('kệ nào có') ||
        lower.includes('kệ nào còn') ||
        lower.includes('hàng để xuất') ||
        lower.includes('hàng nằm ở đâu') ||
        lower.includes('lấy hàng ở đâu') ||
        lower.includes('xuất ở đâu') ||
        lower.includes('vị trí hàng') ||
        lower.includes('chỉ dẫn xuất') ||
        lower.includes('chỉ dẫn lấy') ||
        (mode === 'OUTBOUND_TRANSFER' && (
          lower.includes('kệ nào') ||
          lower.includes('ô nào') ||
          lower.includes('ở đâu') ||
          lower.includes('xuất') ||
          lower.includes('lấy') ||
          lower.includes('hàng') ||
          lower.includes('có') ||
          lower.includes('gợi ý') ||
          lower.includes('tự động') ||
          lower.includes('chọn ô')
        ))
      ) {
        // GENERAL OUTBOUND / PICKING GUIDANCE
        const reqQty = Number(activeItem?.qty || 1);
        const lines: string[] = [];
        lines.push(`[CHỈ DẪN VỊ TRÍ KỆ CÓ HÀNG - LẤY HÀNG / XUẤT KHO]:`);
        lines.push(`Mặt hàng: ${activeItem?.productName || 'Hàng hóa'} (Yêu cầu xuất: ${reqQty.toLocaleString('vi-VN')} ${activeItem?.unit || 'Cái'})`);
        lines.push(``);

        if (matchingOccupiedBins.length > 0) {
          lines.push(`Tìm thấy ${matchingOccupiedBins.length} vị trí đang lưu trữ mặt hàng này (Tổng tồn kho khả dụng: ${totalStockAvailable.toLocaleString('vi-VN')} ${activeItem?.unit || 'Cái'}):`);

          // Select enough bins to fulfill requested quantity
          const candidateCodes: string[] = [];
          let accumulatedStock = 0;

          matchingOccupiedBins.forEach((bInfo, idx) => {
            lines.push(`  ${idx + 1}. Ô ${bInfo.shortCode} (Dãy ${bInfo.rackName}): Đang có ${bInfo.qty} ${bInfo.unit} (${bInfo.pct}% dung tích)`);
            if (accumulatedStock < reqQty) {
              candidateCodes.push(bInfo.binCode);
              accumulatedStock += bInfo.qty;
            }
          });

          if (activeRowId) {
            setSelectedBinsMap((prev) => ({ ...prev, [activeRowId]: candidateCodes }));
            const firstBin = candidateCodes[0];
            const matchRack = racksTopology.find((rk) => firstBin.includes(rk.rackId));
            if (matchRack) setActiveRackId(matchRack.rackId);
          }

          lines.push(``);
          lines.push(`-> AI đã tự động tích chọn ${candidateCodes.length} ô chứa (${candidateCodes.map(b => b.split('-').pop()).join(', ')}) với tổng ${accumulatedStock} ${activeItem?.unit || 'Cái'} trên sơ đồ 2D để bạn lấy hàng ngay!`);
          if (totalStockAvailable < reqQty) {
            lines.push(`⚠️ [CẢNH BÁO] Tổng tồn kho chỉ có ${totalStockAvailable} ${activeItem?.unit || 'Cái'}, thiếu ${reqQty - totalStockAvailable} ${activeItem?.unit || 'Cái'} so với yêu cầu xuất.`);
          }
        } else {
          lines.push(`[THÔNG BÁO] Không tìm thấy ô kệ nào trong kho đang lưu trữ mặt hàng "${activeItem?.productName}". Vui lòng kiểm tra lại tồn kho.`);
        }

        aiReply = lines.join('\n');
      }
      // =========================================================================
      // 2. INBOUND INTENTS (NHẬP HÀNG / XẾP KHO)
      // =========================================================================
      else if (!isOutboundOp && (
        totalWeight >= 50 ||
        pWeight >= 20 ||
        lower.includes('nặng') ||
        lower.includes('hàng nặng') ||
        lower.includes('dưới cùng') ||
        lower.includes('tầng dưới') ||
        lower.includes('tầng a') ||
        lower.includes('kệ dưới') ||
        lower.includes('chịu lực') ||
        lower.includes('đặt dưới')
      )) {
        // INBOUND HEAVY GOODS: Bottom tier A & B empty bins
        const tierABins = allCellsList.filter((cl) => {
          const short = (cl.binCode.split('-').pop() || cl.cellCode || '').toUpperCase();
          const isTierA = short.startsWith('A') || cl.binCode.includes('-A');
          if (!isTierA) return false;
          return !isBinOccupiedOrUnavailableForInbound(cl, activeRowId).isOccupied;
        });

        if (tierABins.length > 0) {
          const candidateBins = tierABins.slice(0, Math.max(1, requiredCount)).map((cl) => cl.binCode);
          if (activeRowId) {
            setCandidateBinsForActiveItem(candidateBins);
            const firstBin = candidateBins[0];
            const matchRack = racksTopology.find((rk) => firstBin.includes(rk.rackId));
            if (matchRack) setActiveRackId(matchRack.rackId);
          }
          const shortNames = candidateBins.map((b) => b.split('-').pop()).join(', ');
          aiReply = `[AI PHÂN TÍCH HÀNG NẶNG - ƯU TIÊN TẦNG DƯỚI CÙNG (TẦNG A)]:\n- Mặt hàng "${activeItem?.productName || 'Hàng hóa'}" có khối lượng ${pWeight.toLocaleString('vi-VN')}kg/đơn vị (Tổng trọng lượng lô hàng: ${totalWeight.toLocaleString('vi-VN')}kg).\n- Theo công thức AI Slotting và tiêu chuẩn tải trọng sàn kho, mặt hàng được xếp vào nhóm HÀNG NẶNG (≥50kg).\n- AI đã tự động phân tích & tích chọn ${candidateBins.length} ô trống chịu lực tốt nhất ở TẦNG A: Ô ${shortNames}.\n-> Tầng A là tầng sàn vững chắc nhất, giúp phân bổ tải trọng an toàn tuyệt đối và giảm thiểu rung lắc kết cấu kệ!`;
        } else {
          // If Tier A is full, look for Tier B (2nd floor from bottom)
          const tierBBins = allCellsList.filter((cl) => {
            const short = (cl.binCode.split('-').pop() || cl.cellCode || '').toUpperCase();
            const isTierB = short.startsWith('B') || cl.binCode.includes('-B');
            if (!isTierB) return false;
            return !isBinOccupiedOrUnavailableForInbound(cl, activeRowId).isOccupied;
          });

          if (tierBBins.length > 0) {
            const candidateBins = tierBBins.slice(0, Math.max(1, requiredCount)).map((cl) => cl.binCode);
            if (activeRowId) {
              setCandidateBinsForActiveItem(candidateBins);
              const firstBin = candidateBins[0];
              const matchRack = racksTopology.find((rk) => firstBin.includes(rk.rackId));
              if (matchRack) setActiveRackId(matchRack.rackId);
            }
            const shortNames = candidateBins.map((b) => b.split('-').pop()).join(', ');
            aiReply = `[THÔNG BÁO] Tầng A (Dưới cùng) hiện đã hết ô trống!\n-> AI chuyển sang tích chọn ${candidateBins.length} ô trống chịu lực ở TẦNG B kế tiếp: Ô ${shortNames} cho mặt hàng "${activeItem?.productName}".`;
          } else {
            aiReply = `[THÔNG BÁO] Tầng A & Tầng B (các tầng thấp chịu lực) hiện không còn ô trống. Vui lòng xuất bớt hàng ở các tầng dưới trước khi nhập tiếp.`;
          }
        }
      } else if (!isOutboundOp && (
        lower.includes('nhẹ') ||
        lower.includes('hàng nhẹ') ||
        lower.includes('trên cùng') ||
        lower.includes('tầng trên') ||
        lower.includes('tầng d') ||
        lower.includes('tầng c') ||
        lower.includes('kệ trên')
      )) {
        // INBOUND LIGHT GOODS: Top tier D & C empty bins
        const topBins = allCellsList.filter((cl) => {
          const short = (cl.binCode.split('-').pop() || cl.cellCode || '').toUpperCase();
          const isTopTier = short.startsWith('D') || short.startsWith('C') || cl.binCode.includes('-D') || cl.binCode.includes('-C');
          if (!isTopTier) return false;
          return !isBinOccupiedOrUnavailableForInbound(cl, activeRowId).isOccupied;
        });

        if (topBins.length > 0) {
          const candidateBins = topBins.slice(0, Math.max(1, requiredCount)).map((cl) => cl.binCode);
          if (activeRowId) {
            setCandidateBinsForActiveItem(candidateBins);
            const firstBin = candidateBins[0];
            const matchRack = racksTopology.find((rk) => firstBin.includes(rk.rackId));
            if (matchRack) setActiveRackId(matchRack.rackId);
          }
          const shortNames = candidateBins.map((b) => b.split('-').pop()).join(', ');
          aiReply = `[AI PHÂN TÍCH HÀNG NHẸ - ƯU TIÊN TẦNG TRÊN CÙNG]:\n- Mặt hàng "${activeItem?.productName || 'Hàng hóa'}" là HÀNG NHẸ.\n- AI đã chọn ${candidateBins.length} ô trống ở TẦNG TRÊN (Tầng D/C): Ô ${shortNames}.`;
        } else {
          aiReply = `[THÔNG BÁO] Tầng trên cùng hiện không còn ô trống. Bạn có thể chọn các ô trống ở tầng dưới.`;
        }
      }
      // ACTION 1: Clear/Reset selections
      else if (lower.includes('bỏ chọn') || lower.includes('xóa chọn') || lower.includes('hủy chọn') || lower.includes('chọn lại')) {
        if (activeRowId) {
          setSelectedBinsMap((prev) => ({ ...prev, [activeRowId]: [] }));
          aiReply = `Đã thực thi: Đã bỏ chọn tất cả các ô kệ của mặt hàng "${activeItem?.productName || 'hàng hóa'}".`;
        }
      }
      // ACTION 1.5: EMPTY RACK GUIDANCE (INBOUND ONLY)
      else if (
        lower.includes('kệ trống') ||
        lower.includes('ô trống') ||
        lower.includes('trống bao nhiêu') ||
        lower.includes('tìm ô trống') ||
        lower.includes('kệ nào trống') ||
        lower.includes('nhập vào đâu') ||
        lower.includes('chỉ dẫn nhập') ||
        lower.includes('xếp vào đâu') ||
        (!isOutboundOp && (
          lower.includes('kệ nào') ||
          lower.includes('ô nào') ||
          lower.includes('ở đâu') ||
          lower.includes('trống') ||
          lower.includes('nhập')
        ))
      ) {
        const rackEmptyMap = new Map<string, { rackName: string; totalBins: number; emptyBins: string[]; emptyCount: number }>();

        racksTopology.forEach((rk) => {
          const rackKey = rk.rackId;
          const rackName = rk.rackName || rk.rackId;
          const emptyBinsList: string[] = [];
          let totalCount = 0;

          rk.floors.forEach((fl) => {
            fl.cells.forEach((cl) => {
              totalCount++;
              if (!isBinOccupiedOrUnavailableForInbound(cl, activeRowId).isOccupied) {
                emptyBinsList.push(cl.binCode.split('-').pop() || cl.binCode);
              }
            });
          });

          rackEmptyMap.set(rackKey, {
            rackName,
            totalBins: totalCount,
            emptyBins: emptyBinsList,
            emptyCount: emptyBinsList.length,
          });
        });

        const lines: string[] = [];
        lines.push(`[CHỈ DẪN VỊ TRÍ KỆ TRỐNG - NHẬP KHO SLOTTING]:`);
        lines.push(`Mặt hàng đang xếp: ${activeItem?.productName || 'Hàng hóa'} (Tổng nhập: ${activeItem?.qty || 0} ${activeItem?.unit || 'Cái'})`);
        lines.push(``);

        const candidateBins: string[] = [];
        rackEmptyMap.forEach((data) => {
          const emptyPct = data.totalBins > 0 ? Math.round((data.emptyCount / data.totalBins) * 100) : 0;
          const sampleStr = data.emptyBins.slice(0, 4).join(', ');
          lines.push(`• Dãy ${data.rackName}: ${data.emptyCount}/${data.totalBins} ô trống (${emptyPct}%) ${sampleStr ? `[Gợi ý ô: ${sampleStr}${data.emptyBins.length > 4 ? '...' : ''}]` : ''}`);
        });

        for (const cell of allCellsList) {
          if (candidateBins.length >= requiredCount) break;
          if (!isBinOccupiedOrUnavailableForInbound(cell, activeRowId).isOccupied) {
            candidateBins.push(cell.binCode);
          }
        }

        if (candidateBins.length > 0 && activeRowId) {
          setCandidateBinsForActiveItem(candidateBins);
          const firstBin = candidateBins[0];
          const matchRack = racksTopology.find((rk) => firstBin.includes(rk.rackId));
          if (matchRack) setActiveRackId(matchRack.rackId);
          lines.push(``);
          lines.push(`-> AI đã tự động tích chọn ${candidateBins.length} ô trống (${candidateBins.map(b => b.split('-').pop()).join(', ')}) trên sơ đồ 2D để bạn nhập hàng ngay!`);
        } else {
          lines.push(``);
          lines.push(`[CẢNH BÁO] Tất cả các kệ trong kho đã đầy 100%. Vui lòng xuất bớt hàng hoặc mở rộng sơ đồ kệ.`);
        }

        aiReply = lines.join('\n');
      }
      // ACTION 2: Switch Rack view (R01, R02, R03, Kệ 1, Kệ 2...)
      else if (lower.includes('r01') || lower.includes('r02') || lower.includes('r03') || lower.includes('kệ 1') || lower.includes('kệ 2') || lower.includes('kệ 3') || lower.includes('dãy r')) {
        let matchRackCode = 'R01';
        if (lower.includes('r02') || lower.includes('kệ 2')) matchRackCode = 'R02';
        if (lower.includes('r03') || lower.includes('kệ 3')) matchRackCode = 'R03';

        const matchRack = racksTopology.find((rk) => rk.rackId.toUpperCase().includes(matchRackCode) || rk.rackName.toUpperCase().includes(matchRackCode));
        if (matchRack) {
          setActiveRackId(matchRack.rackId);
          aiReply = `Đã thực thi: Đã chuyển hiển thị sơ đồ 2D sang Dãy Kệ ${matchRack.rackName || matchRackCode}.`;
        } else {
          aiReply = `Không tìm thấy dãy kệ tương ứng với lệnh. Hiện tại hệ thống có các dãy: ${racksTopology.map((r) => r.rackName).join(', ')}.`;
        }
      }
      // ACTION 3: Select N bins or 1 bin (e.g. "1 kệ thôi", "chỉ chọn 1 ô", "chọn 2 ô", "tự động chọn")
      else if (
        lower.includes('1 kệ') || lower.includes('1 ô') || lower.includes('một kệ') || lower.includes('một ô') ||
        lower.includes('2 ô') || lower.includes('3 ô') || lower.includes('tự động') || lower.includes('gợi ý') ||
        lower.includes('chọn giúp') || lower.includes('chọn ô')
      ) {
        let targetCount = requiredCount;
        if (lower.includes('1 kệ') || lower.includes('1 ô') || lower.includes('một kệ') || lower.includes('một ô')) {
          targetCount = 1;
        } else if (lower.includes('2 ô') || lower.includes('2 kệ')) {
          targetCount = 2;
        } else if (lower.includes('3 ô') || lower.includes('3 kệ')) {
          targetCount = 3;
        }

        const isOutbound = isOutboundOp;
        const candidateBins: string[] = [];

        for (const cell of allCellsList) {
          if (candidateBins.length >= targetCount) break;

          if (isOutbound) {
            const isMatch = isBinMatchingActiveItem(cell);
            const cellStock = Number(cell.stockQty || (cell as any).totalPhysical || 0);
            if (isMatch && cellStock > 0) candidateBins.push(cell.binCode);
          } else {
            if (!isBinOccupiedOrUnavailableForInbound(cell, activeRowId).isOccupied) candidateBins.push(cell.binCode);
          }
        }

        if (candidateBins.length > 0 && activeRowId) {
          if (!isOutbound) {
            setCandidateBinsForActiveItem(candidateBins);
          } else {
            setSelectedBinsMap((prev) => ({ ...prev, [activeRowId]: candidateBins }));
          }

          const firstBin = candidateBins[0];
          const matchRack = racksTopology.find((rk) => firstBin.includes(rk.rackId));
          if (matchRack) setActiveRackId(matchRack.rackId);

          const shortNames = candidateBins.map((b) => b.split('-').pop()).join(', ');
          aiReply = isOutbound
            ? `Đã thực thi: AI đã chọn ${candidateBins.length} ô đang có hàng (${shortNames}) trên sơ đồ 2D để bạn lấy hàng "${activeItem?.productName}".`
            : `Đã thực thi: AI đã chọn ${candidateBins.length} ô trống hợp lệ (${shortNames}) trên sơ đồ 2D cho mặt hàng "${activeItem?.productName}".`;
        } else {
          aiReply = isOutbound
            ? `Không tìm thấy ô chứa hợp lệ nào đang lưu mặt hàng "${activeItem?.productName}".`
            : `Không tìm thấy ô kệ trống thích hợp trên sơ đồ.`;
        }
      }
      // ACTION 4: Capacity / Stock query (Supports both Outbound picking check and Inbound slotting capacity)
      else if (lower.includes('đủ') || lower.includes('mấy ô') || lower.includes('số lượng') || lower.includes('sức chứa') || lower.includes('còn bao nhiêu') || lower.includes('tồn kho')) {
        const pWeight = Number(activeProduct?.weight ?? (activeProduct as any)?.weight ?? 1.0);
        const pLength = Number(activeProduct?.length ?? 20);
        const pWidth = Number(activeProduct?.width ?? 15);
        const pHeight = Number(activeProduct?.height ?? 10);
        const pVol = Number(
          activeProduct?.volume ||
          (pLength > 0 && pWidth > 0 && pHeight > 0 ? (pLength * pWidth * pHeight) / 1000000 : 0.003)
        );
        const itemQty = Number(activeItem?.qty || 1);
        const totalItemWeight = itemQty * pWeight;
        const totalItemVol = itemQty * pVol;

        if (isOutboundOp) {
          const isEnough = totalStockAvailable >= itemQty;
          const neededBins: string[] = [];
          let acc = 0;
          matchingOccupiedBins.forEach((b) => {
            if (acc < itemQty) {
              neededBins.push(`Ô ${b.shortCode} (${b.rackName}: ${b.qty} ${b.unit})`);
              acc += b.qty;
            }
          });

          aiReply = `[KIỂM TRA TỒN KHO & ĐỦ HÀNG XUẤT - ${activeItem?.productName || 'Hàng hóa'}]:\n` +
            `- Yêu cầu xuất/lấy: ${itemQty.toLocaleString('vi-VN')} ${activeItem?.unit || 'Cái'} (~${totalItemWeight.toLocaleString('vi-VN')}kg, ${totalItemVol.toFixed(3)}m³).\n` +
            `- Tổng tồn kho thực tế: ${totalStockAvailable.toLocaleString('vi-VN')} ${activeItem?.unit || 'Cái'} (tại ${matchingOccupiedBins.length} vị trí ô kệ).\n` +
            `- Tình trạng: ${isEnough ? '✅ ĐỦ HÀNG ĐỂ XUẤT' : `⚠️ THIẾU HÀNG (Còn thiếu ${(itemQty - totalStockAvailable).toLocaleString('vi-VN')} ${activeItem?.unit || 'Cái'})`}.\n` +
            (neededBins.length > 0 ? `- Đề xuất lấy từ: ${neededBins.join(', ')}.` : `- Hiện kho không còn hàng của sản phẩm này.`);
        } else {
          // Standard bin: 0.96m³, 500kg
          const maxPerBinByVol = Math.floor(0.96 / Math.max(0.0001, pVol));
          const maxPerBinByWeight = Math.floor(500 / Math.max(0.1, pWeight));
          const maxPerBin = Math.min(maxPerBinByVol, maxPerBinByWeight);
          const calculatedBins = Math.max(1, Math.ceil(itemQty / Math.max(1, maxPerBin)));

          aiReply = `[TÍNH TOÁN SỨC CHỨA AI SLOTTING - ${activeItem?.productName || 'Hàng hóa'}]:\n- Thông số kiện: ${pWeight.toLocaleString('vi-VN')}kg | ${pLength}×${pWidth}×${pHeight}cm | ${pVol.toFixed(4)}m³ (CBM).\n- Quy cách ô tiêu chuẩn: Kích thước 120×80×100cm (Thể tích 0.96m³ - Tải trọng 500kg).\n- Khả năng chứa tối đa 1 ô: ${maxPerBin.toLocaleString('vi-VN')} ${activeItem?.unit || 'cái'} (${maxPerBinByWeight <= maxPerBinByVol ? 'Giới hạn tải trọng 500kg' : 'Giới hạn thể tích 0.96m³'}).\n- Tổng lô hàng cần xếp: ${itemQty.toLocaleString('vi-VN')} ${activeItem?.unit || 'cái'} (~${totalItemWeight.toLocaleString('vi-VN')}kg, ${totalItemVol.toFixed(3)}m³).\n-> Đề xuất số ô cần dùng: ${calculatedBins} ô (Đã chọn: ${currentSelectedBins.length}/${calculatedBins} ô).`;
        }
      }
      // Helper to match cell short code (e.g. D1, D2, A1) with cell object
      const isCellMatchingShortCode = (cell: BinCell, codeStr: string): boolean => {
        const target = codeStr.trim().toUpperCase();
        const binLast = (cell.binCode.split('-').pop() || '').trim().toUpperCase();
        const cellClean = (cell.cellCode || '').replace(/ô/i, '').trim().toUpperCase();
        return binLast === target || cellClean === target || binLast.endsWith(target);
      };

      // ACTION 5: Enhanced AI Slotting Intelligence (Percentage, Quantity, Fractions, Multi-bin & Stacking)
      const binCodeMatch = userText.match(/\b[A-Za-z]\d{1,2}\b/i);
      const pctMatch = userText.match(/\b(\d{1,3})\s*%/);
      const qtyNumMatch = userText.match(/\b(\d{1,6})\s*(cái|sp|sản phẩm|thùng|bao|kg|lô)?\b/i);
      const fractionMatch = userText.match(/1\/2|nửa|1\/3|2\/3|1\/4|3\/4|4\/5|đầy|trống/i);
      const isCapacityCmd =
        pctMatch ||
        fractionMatch ||
        (qtyNumMatch && (lower.includes('lưu') || lower.includes('chứa') || lower.includes('kệ') || lower.includes('ô') || lower.includes('hàng'))) ||
        (binCodeMatch &&
          (lower.includes('độ chứa') ||
            lower.includes('chứa') ||
            lower.includes('lưu') ||
            lower.includes('ghép') ||
            lower.includes('giảm') ||
            lower.includes('tăng') ||
            lower.includes('cài đặt') ||
            lower.includes('thừa') ||
            lower.includes('dư') ||
            lower.includes('kệ')));

      if (isCapacityCmd) {
        const activeItemBins = selectedBinsMap[activeRowId || ''] || [];
        const fallbackShortCode = activeItemBins[0]
          ? activeItemBins[0].split('-').pop()?.toUpperCase()
          : (allCellsList.find((c) => !c.isOccupied)?.cellCode || 'A1').replace(/ô/i, '').trim().toUpperCase();

        const shortCode = binCodeMatch ? binCodeMatch[0].toUpperCase() : (fallbackShortCode || 'A1');
        let targetPct = 50;
        let noteText = '';

        if (pctMatch) {
          targetPct = Math.min(100, Math.max(0, parseInt(pctMatch[1], 10)));
          noteText = `Cài đặt độ chứa: ${targetPct}%`;
        } else if (fractionMatch) {
          const frac = fractionMatch[0].toLowerCase();
          if (frac === '1/2' || frac === 'nửa') targetPct = 50;
          else if (frac === '1/3') targetPct = 33;
          else if (frac === '2/3') targetPct = 66;
          else if (frac === '1/4') targetPct = 25;
          else if (frac === '3/4') targetPct = 75;
          else if (frac === '4/5') targetPct = 80;
          else if (frac === 'đầy') targetPct = 100;
          else if (frac === 'trống') targetPct = 0;
          noteText = `AI Cài đặt sức chứa: ${frac.toUpperCase()} (${targetPct}%)`;
        } else if (qtyNumMatch && (lower.includes('lưu') || lower.includes('chứa') || lower.includes('ghép') || lower.includes('còn') || lower.includes('dư') || lower.includes('thừa'))) {
          const qtyVal = parseInt(qtyNumMatch[1], 10);

          // Calculate bin occupancy percentage based on actual volume and weight
          const pWeight = Number(activeProduct?.weight ?? (activeProduct as any)?.weight ?? 1.0);
          const pLength = Number(activeProduct?.length ?? 20);
          const pWidth = Number(activeProduct?.width ?? 15);
          const pHeight = Number(activeProduct?.height ?? 10);
          const pVol = Number(
            activeProduct?.volume ||
            (pLength > 0 && pWidth > 0 && pHeight > 0 ? (pLength * pWidth * pHeight) / 1000000 : 0.003)
          );

          const targetCellCandidate = allCellsList.find((c) => isCellMatchingShortCode(c, shortCode)) || allCellsList[0];
          const cAny = targetCellCandidate as any;
          const bLength = Number(cAny?.cellLength || 120);
          const bWidth = Number(cAny?.cellWidth || 80);
          const bHeight = Number(cAny?.cellHeight || 100);
          const bVol = Number(((bLength * bWidth * bHeight) / 1000000).toFixed(4)) || 0.96;
          const bMaxWeight = Number(cAny?.maxWeightCapacity || cAny?.maxWeight || 500);

          const totalPkgVol = qtyVal * pVol;
          const totalPkgWeight = qtyVal * pWeight;

          const volOccupancyPct = Math.round((totalPkgVol / bVol) * 100);
          const weightOccupancyPct = Math.round((totalPkgWeight / bMaxWeight) * 100);

          targetPct = Math.min(100, Math.max(1, Math.max(volOccupancyPct, weightOccupancyPct)));
          const limitingFactor = weightOccupancyPct >= volOccupancyPct ? 'tải trọng' : 'thể tích';
          noteText = `Lưu thêm: ${qtyVal} ${activeItem?.unit || 'sản phẩm'} (${targetPct}% ô theo ${limitingFactor} - ${totalPkgWeight.toFixed(1)}kg / ${totalPkgVol.toFixed(3)}m³) - Tải trọng ô: ${bMaxWeight}kg`;
        }

        if (lower.includes('xuất') || lower.includes('lấy đi') || lower.includes('giảm')) {
          const reduction = pctMatch ? parseInt(pctMatch[1], 10) : 50;
          targetPct = Math.max(0, 100 - reduction);
          noteText = `Giảm sức chứa sau khi lấy hàng: còn ${targetPct}%`;
        }

        const targetCell = allCellsList.find((c) => isCellMatchingShortCode(c, shortCode)) || allCellsList[0];
        const cellAny = targetCell as any;
        const isFullBin = targetCell && (targetCell.isOccupied || (cellAny.occupancyPct && cellAny.occupancyPct >= 100));

        // Protection: Block putting goods into 100% full bin unless explicitly resetting/reducing
        if (isFullBin && !lower.includes('xóa') && !lower.includes('giảm') && !lower.includes('reset') && !lower.includes('trống')) {
          aiReply = `[THÔNG BÁO] Ô ${shortCode} hiện đã ĐẦY 100%! Không thể chứa thêm hàng. AI khuyến nghị bạn chọn các ô trống ở Tầng A hoặc Tầng B.`;
        } else if (targetCell) {
          const targetBinCode = targetCell.binCode;

          // Find existing custom bin occupancy if any
          let existingPct = 0;
          const currentSubs = dbSubWarehouses && dbSubWarehouses.length > 0 ? dbSubWarehouses : currentWarehouseObj?.subWarehouses || [];
          currentSubs.forEach((sub: any) => {
            (sub.racks || []).forEach((rk: any) => {
              if (targetBinCode.includes(rk.id || rk.rackCode) || rk.id === activeRackId || rk.rackCode === activeRackId) {
                if (rk.customBins && rk.customBins[targetBinCode]) {
                  existingPct = Number(rk.customBins[targetBinCode].occupancyPct || 0);
                }
              }
            });
          });

          // If stacking / adding percentage to an existing bin vs direct override
          const isExplicitOverride = lower.includes('100%') || lower.includes('đặt') || lower.includes('sửa') || lower.includes('gán') || lower.includes('cài') || lower.includes('đầy') || lower.includes('trống') || (!lower.includes('thêm') && !lower.includes('ghép'));
          const finalTotalPct = existingPct > 0 && !isExplicitOverride ? Math.min(100, existingPct + targetPct) : targetPct;

          const detailedNote = existingPct > 0 && !isExplicitOverride
            ? `Ghép ${activeItem?.productName || 'hàng mới'} (+${targetPct}%): Ô hiện đã chứa tổng ${finalTotalPct}%`
            : noteText || `AI Cài đặt: Sức chứa ${finalTotalPct}%`;

          updateSubWarehousesTopology(targetBinCode, shortCode, finalTotalPct, detailedNote);

          let updatedBinsMap = selectedBinsMap;
          if (activeRowId) {
            updatedBinsMap = { ...selectedBinsMap, [activeRowId]: Array.from(new Set([...(selectedBinsMap[activeRowId] || []), targetBinCode])) };
            setSelectedBinsMap(updatedBinsMap);
          }

          // Build line-by-line summary for N items stacked in this bin
          const itemLines: string[] = [];
          items.forEach((it, idx) => {
            const bList = updatedBinsMap[it.rowId] || [];
            if (bList.includes(targetBinCode) || bList.some((b) => b.endsWith(shortCode))) {
              const itemPct = it.rowId === activeRowId ? targetPct : Math.round(existingPct > 0 ? existingPct / Math.max(1, idx) : targetPct);
              itemLines.push(`- Dòng ${idx + 1} (${it.productName || `Hàng ${idx + 1}`}): ${itemPct}% - ${it.qty || 1} ${it.unit || 'cái'}`);
            }
          });

          if (itemLines.length === 0) {
            itemLines.push(`- Dòng 1 (${activeItem?.productName || 'Hàng 1'}): ${finalTotalPct}% - ${activeItem?.qty || 1} ${activeItem?.unit || 'cái'}`);
          }

          const freeCap = 100 - finalTotalPct;
          aiReply = `Đã lưu ô ${shortCode}:\n${itemLines.join('\n')}\nTrạng thái Ô ${shortCode}: Đã chứa ${finalTotalPct}%${freeCap > 0 ? ` (Còn trống ${freeCap}%)` : ' (Đã đầy 100%)'}.`;
        } else {
          aiReply = `Không tìm thấy ô ${shortCode} trên sơ đồ kệ hiện tại. Vui lòng kiểm tra lại mã ô.`;
        }
      }
      // ACTION 6: Direct Cell Selection or Clearing Commands (e.g. D1, D2, A1, B3, bỏ chọn)
      else if (lower.includes('bỏ chọn') || lower.includes('xóa') || lower.includes('reset')) {
        setSelectedBinsMap({});

        // Clear all customBins occupancy in subWarehouses topology
        const cleanedSubs = (dbSubWarehouses && dbSubWarehouses.length > 0 ? dbSubWarehouses : currentWarehouseObj?.subWarehouses || []).map((sub: any) => {
          const racks = (sub.racks || []).map((rk: any) => {
            const customBins: any = {};
            Object.keys(rk.customBins || {}).forEach((k) => {
              customBins[k] = { ...rk.customBins[k], occupancyPct: 0, notes: '' };
            });
            return { ...rk, customBins };
          });
          return { ...sub, racks };
        });

        setDbSubWarehouses(cleanedSubs);
        if (currentWarehouseObj) {
          const updatedWh = { ...currentWarehouseObj, subWarehouses: cleanedSubs };
          setCurrentWarehouseObj(updatedWh);
          saveStoredWarehouses(getStoredWarehouses().map((w) => (w.id === updatedWh.id ? updatedWh : w)));
          upsertWarehouseToApi(updatedWh).catch((e) => console.error('Lỗi lưu CSDL reset:', e));
        }

        aiReply = `Đã xóa toàn bộ lựa chọn và làm sạch tất cả ô kệ về 0% (Ô Trống) trong CSDL.`;
      } else {
        const matches = userText.match(/\b[A-Za-z]\d{1,2}\b/g);
        if (matches && matches.length > 0 && activeRowId) {
          const matchedShortCodes = matches.map((m) => m.toUpperCase());
          const foundBins: string[] = [];

          for (const cell of allCellsList) {
            if (matchedShortCodes.some((s) => isCellMatchingShortCode(cell, s))) {
              if (isOutboundOp && !isBinMatchingActiveItem(cell)) continue;
              if (!isOutboundOp && isBinOccupiedOrUnavailableForInbound(cell, activeRowId).isOccupied) continue;
              foundBins.push(cell.binCode);
            }
          }

          if (foundBins.length > 0) {
            if (!isOutboundOp) {
              const currentList = selectedBinsMap[activeRowId] || [];
              const combined = Array.from(new Set([...currentList.map((b) => b.split('(')[0].trim()), ...foundBins]));
              setCandidateBinsForActiveItem(combined);
            } else {
              setSelectedBinsMap((prev) => {
                const currentList = prev[activeRowId] || [];
                const combined = Array.from(new Set([...currentList, ...foundBins]));
                return { ...prev, [activeRowId]: combined };
              });
            }
            aiReply = `Đã chọn các ô (${matchedShortCodes.join(', ')}) trên sơ đồ 2D cho mặt hàng "${activeItem?.productName}".`;
          } else {
            aiReply = isOutboundOp
              ? `Không thể chọn ô (${matchedShortCodes.join(', ')}) do ô không chứa mặt hàng "${activeItem?.productName}".`
              : `Không thể chọn ô (${matchedShortCodes.join(', ')}) do ô đã có hàng hoặc không khả dụng.`;
          }
        } else {
          // Dynamic analysis for current rack
          const activeRack = racksTopology.find((r) => r.rackId === activeRackId) || racksTopology[0];

          if (isOutboundOp) {
            // Outbound picking fallback
            const rackMatchingBins = matchingOccupiedBins.filter((b) => b.rackId === activeRack?.rackId);
            const displayBins = rackMatchingBins.length > 0 ? rackMatchingBins : matchingOccupiedBins;

            const lines: string[] = [];
            lines.push(`[AI CHỈ DẪN LẤY HÀNG / XUẤT KHO]:`);
            lines.push(`- Mặt hàng: ${activeItem?.productName || 'Hàng hóa'} (Yêu cầu xuất: ${activeItem?.qty || 1} ${activeItem?.unit || 'Cái'})`);
            lines.push(`- Tổng tồn kho thực tế: ${totalStockAvailable.toLocaleString('vi-VN')} ${activeItem?.unit || 'Cái'} (${matchingOccupiedBins.length} vị trí ô kệ)`);

            if (displayBins.length > 0) {
              const binSamples = displayBins.slice(0, 4).map((b) => `Ô ${b.shortCode} (Dãy ${b.rackName}: ${b.qty} ${b.unit})`).join(', ');
              lines.push(`- Vị trí gợi ý lấy hàng: ${binSamples}${displayBins.length > 4 ? '...' : ''}`);
            } else {
              lines.push(`- Không tìm thấy ô kệ nào đang lưu trữ mặt hàng này.`);
            }

            lines.push(`-> Bạn có thể gõ: "lấy hàng ở đâu", "hàng nặng lấy tầng nào", "tự động chọn ô lấy hàng", "chọn ô A1"...`);
            aiReply = lines.join('\n');
          } else {
            // Inbound putaway fallback
            const emptyA: string[] = [];
            const emptyOthers: string[] = [];

            if (activeRack) {
              activeRack.floors.forEach((fl) => {
                fl.cells.forEach((cl) => {
                  const short = cl.binCode.split('-').pop() || cl.binCode;
                  if (!isBinOccupiedOrUnavailableForInbound(cl, activeRowId).isOccupied) {
                    if (short.startsWith('A')) emptyA.push(short);
                    else emptyOthers.push(short);
                  }
                });
              });
            }

            const stockNote = matchingOccupiedBins.length > 0
              ? `\n💡 Tồn kho hiện có: Đang có ${totalStockAvailable} ${activeItem?.unit || 'Cái'} tại ô: ${matchingOccupiedBins.slice(0, 3).map((b) => b.shortCode).join(', ')} (nếu bạn cần lấy hàng).`
              : '';

            aiReply = `[AI CHỈ DẪN NHẬP KHO & LƯU TRỮ]:\n- Dãy Kệ ${activeRack?.rackName || 'R01'} hiện có ${emptyA.length + emptyOthers.length} ô trống khả dụng.\n- Tầng A (Hàng nặng/Dưới cùng): ${emptyA.slice(0, 4).join(', ') || 'Đã đầy'}\n- Tầng B/C/D (Tầng cao/Hàng nhẹ): ${emptyOthers.slice(0, 4).join(', ') || 'Đã đầy'}${stockNote}\n-> Bạn có thể gõ: "nhập vào đâu", "lấy hàng ở đâu", "hàng nặng cần đặt kệ dưới cùng", "tự chọn ô trống"...`;
          }
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: aiReply,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }, 250);
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-1.5 sm:p-3 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-cyan-500 dark:border-indigo-900/60 w-full max-w-[98vw] max-w-[1650px] h-[95vh] flex flex-col overflow-hidden">
        {/* Modal Header - Master Cyan/Indigo Theme */}
        <div className="bg-cyan-700 dark:bg-indigo-900 text-white px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between shadow-sm border-b dark:border-indigo-800 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl bg-cyan-800 dark:bg-indigo-950 border border-cyan-500/50 dark:border-indigo-700 flex items-center justify-center text-cyan-200 dark:text-indigo-300 shadow-inner shrink-0">
              <Sparkles className="h-4 w-4 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-base font-black uppercase tracking-wide flex items-center gap-1.5 sm:gap-2 truncate">
                <span className="truncate">Trợ lý AI Chỉ dẫn Vị trí & Sơ đồ Ô Kệ Kho</span>
                {readOnly && (
                  <span className="bg-amber-400 text-amber-950 text-[10px] px-2 py-0.2 rounded-full font-black uppercase border border-amber-300 tracking-normal shadow-2xs shrink-0">
                    Chế độ xem
                  </span>
                )}
              </h3>
              <p className="text-xs text-cyan-100 dark:text-indigo-200 font-medium">
                {readOnly
                  ? 'Xem chi tiết sơ đồ vị trí các ô kệ đã lưu trữ hàng hóa • Chế độ chỉ xem, không thể chỉnh sửa'
                  : mode === 'STOCKTAKE'
                  ? 'SƠ ĐỒ VỊ TRÍ KỆ KIỂM KÊ • Ô KỆ ĐANG LƯU HÀNG HÓA HIỆN MÀU XANH, KỆ KHÔNG LƯU HÀNG SẼ IN CHÌM'
                  : mode === 'OUTBOUND_TRANSFER'
                  ? 'Tự động khóa các ô không hợp lệ • CHỈ CHO PHÉP TICK chọn các Ô KỆ ĐANG LƯU ĐÚNG HÀNG HÓA để xuất chuyển'
                  : 'Tự động tính toán sức chứa ô/kệ • Click chọn các Ô TRỐNG trên sơ đồ 2D kệ kho để nhập cất hàng'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-2xl bg-cyan-800/60 dark:bg-indigo-950 hover:bg-cyan-600 dark:hover:bg-indigo-700 text-cyan-100 dark:text-indigo-200 flex items-center justify-center transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Warning Alert Banner if illegal bin clicked */}
        {warningMessage && (
          <div className="bg-rose-500 text-white px-6 py-2 flex items-center justify-between text-xs font-bold shadow-inner animate-in slide-in-from-top duration-150">
            <span className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              {warningMessage}
            </span>
            <button type="button" onClick={() => setWarningMessage(null)} className="text-rose-100 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex flex-col md:grid md:grid-cols-12 gap-0 flex-1 overflow-y-auto md:overflow-hidden bg-slate-50 dark:bg-slate-950">
          {/* Left Column: AI Interactive Chat */}
          <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-cyan-200 dark:border-indigo-900/60 bg-cyan-50/30 dark:bg-slate-900 flex flex-col h-[280px] md:h-full min-h-0 shrink-0 md:shrink">
            <div className="p-3 bg-white dark:bg-slate-950 border-b border-cyan-100 dark:border-indigo-900/40 flex items-center justify-between text-xs font-black text-cyan-900 dark:text-indigo-300 shadow-2xs shrink-0">
              <span className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-cyan-600 dark:text-indigo-400" /> Trợ lý AI Hỏi Đáp Slotting
              </span>
              <span className="bg-cyan-100 dark:bg-indigo-950 text-cyan-900 dark:text-indigo-300 text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase border border-cyan-300 dark:border-indigo-800">
                Online
              </span>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 p-3 overflow-y-auto min-h-0 space-y-3 text-xs scrollbar-thin scrollbar-thumb-cyan-400 scrollbar-track-cyan-100">
              {messages.map((m) => (
                <div key={m.id} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                    <span>{m.sender === 'user' ? 'Thủ kho' : 'AI Assistant'}</span>
                    <span>•</span>
                    <span>{m.time}</span>
                  </div>
                  <div
                    className={`max-w-[95%] p-3 rounded-2xl shadow-xs leading-relaxed whitespace-pre-wrap ${m.sender === 'user'
                        ? 'bg-cyan-600 dark:bg-indigo-600 text-white rounded-br-none font-medium'
                        : 'bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 border border-cyan-200 dark:border-indigo-900/60 rounded-bl-none font-normal shadow-2xs'
                      }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Prompts */}
            {readOnly ? (
              <div className="px-3 py-2 bg-white dark:bg-slate-950 border-t border-cyan-100 dark:border-indigo-900/40 flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                <span>Chế độ xem • Vị trí ô kệ đã lưu cố định theo phiếu</span>
              </div>
            ) : (
              <div className="px-3 py-2 bg-white dark:bg-slate-950 border-t border-cyan-100 dark:border-indigo-900/40 flex flex-wrap gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSendMessage(undefined, 'Lấy hàng ở đâu')}
                  className="text-[10px] bg-cyan-600 dark:bg-indigo-600 hover:bg-cyan-700 dark:hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg font-black transition cursor-pointer shadow-2xs flex items-center gap-1"
                >
                  📦 Lấy hàng ở đâu
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage(undefined, 'Kệ trống nhập hàng')}
                  className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg font-black transition cursor-pointer shadow-2xs flex items-center gap-1"
                >
                  ✨ Nhập vào đâu
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage(undefined, 'Hàng nặng đặt kệ dưới')}
                  className="text-[10px] bg-cyan-50 dark:bg-indigo-950/60 hover:bg-cyan-100 dark:hover:bg-indigo-900/60 border border-cyan-300 dark:border-indigo-800 text-cyan-900 dark:text-indigo-300 px-2 py-1 rounded-lg font-bold transition cursor-pointer"
                >
                  ⚖️ Hàng nặng
                </button>
                <button
                  type="button"
                  onClick={() => autoSlotAllItems(undefined, true)}
                  className="text-[10px] bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-2.5 py-1 rounded-lg font-black transition cursor-pointer shadow-2xs flex items-center gap-1 shrink-0"
                >
                  ⚡ Tự động tất cả ({validItems.length} SP)
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage(undefined, '1 kệ thôi')}
                  className="text-[10px] bg-cyan-50 dark:bg-indigo-950/60 hover:bg-cyan-100 dark:hover:bg-indigo-900/60 border border-cyan-300 dark:border-indigo-800 text-cyan-900 dark:text-indigo-300 px-2 py-1 rounded-lg font-bold transition cursor-pointer"
                >
                  1 Kệ/Ô
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage(undefined, 'Tự động chọn')}
                  className="text-[10px] bg-cyan-50 dark:bg-indigo-950/60 hover:bg-cyan-100 dark:hover:bg-indigo-900/60 border border-cyan-300 dark:border-indigo-800 text-cyan-900 dark:text-indigo-300 px-2 py-1 rounded-lg font-bold transition cursor-pointer"
                >
                  Tự chọn
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage(undefined, 'Bỏ chọn')}
                  className="text-[10px] bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 px-2 py-1 rounded-lg font-bold transition cursor-pointer"
                >
                  Bỏ chọn
                </button>
              </div>
            )}

            {/* Chat Input */}
            {readOnly ? (
              <div className="p-3 bg-white dark:bg-slate-950 border-t border-cyan-200 dark:border-indigo-900/40 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 shrink-0">
                🔒 Chế độ xem: Không thể thay đổi các ô kệ đã lưu kho
              </div>
            ) : (
              <form onSubmit={(e) => handleSendMessage(e)} className="p-3 bg-white dark:bg-slate-950 border-t border-cyan-200 dark:border-indigo-900/40 flex items-center gap-2 shrink-0">
                <input
                  type="text"
                  value={inputMsg}
                  onChange={(e) => setInputMsg(e.target.value)}
                  placeholder="Hỏi AI lấy hàng / nhập hàng (VD: Lấy hàng ở đâu, Nhập vào đâu, Hàng nặng, R01)..."
                  className="flex-1 h-9 px-3 text-xs border border-slate-300 dark:border-indigo-900/60 rounded-xl outline-none focus:border-cyan-600 focus:dark:border-indigo-500 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-slate-100"
                />
                <button
                  type="submit"
                  className="h-9 px-3.5 bg-cyan-600 dark:bg-indigo-600 hover:bg-cyan-700 dark:hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center transition cursor-pointer shadow-sm active:scale-95"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>

          {/* Right Column: Interactive Visual Rack Topology Grid */}
          <div className="md:col-span-8 p-2.5 sm:p-4 flex flex-col flex-1 min-h-[400px] md:h-full md:overflow-hidden bg-white dark:bg-slate-900">
            {/* 1. Item Switcher Bar */}
            <div className="mb-3 bg-cyan-50/80 dark:bg-indigo-950/50 p-2.5 rounded-2xl border border-cyan-200 dark:border-indigo-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-x-auto">
                <span className="text-xs font-black uppercase text-cyan-950 dark:text-indigo-200 flex items-center gap-1.5 shrink-0">
                  <Layers className="h-4 w-4 text-cyan-600 dark:text-indigo-400" /> Đơn hàng:
                </span>
                {(validItems.length > 0 ? validItems : items).map((it, idx) => {
                  const isActive = it.rowId === activeRowId;
                  const countReq = Math.max(1, Math.ceil((it.qty || 1) / 100));
                  const selectedCount = (selectedBinsMap[it.rowId] || []).length;
                  return (
                    <button
                      key={it.rowId}
                      type="button"
                      onClick={() => setActiveRowId(it.rowId)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${isActive
                          ? 'bg-cyan-600 dark:bg-indigo-600 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-950 hover:bg-cyan-100 dark:hover:bg-indigo-900/60 text-slate-700 dark:text-slate-300 border border-cyan-200 dark:border-indigo-900/60'
                        }`}
                    >
                      <span>
                        #{idx + 1} {it.productName || `Mặt hàng ${idx + 1}`}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md font-black ${isActive ? 'bg-cyan-800 dark:bg-slate-950 text-white dark:text-indigo-300' : 'bg-cyan-100 dark:bg-indigo-950 text-cyan-900 dark:text-indigo-300'
                          }`}
                      >
                        {selectedCount} Ô
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Status Indicator & Batch Action Button */}
              <div className="shrink-0 flex items-center gap-2">
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => autoSlotAllItems(undefined, true)}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-[11px] font-black px-3 py-1.5 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
                    title="AI Tự động xếp tất cả sản phẩm vào các ô kệ tối ưu"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-yellow-200" />
                    <span>Tự động tất cả ({validItems.length} SP)</span>
                  </button>
                )}
                {currentSelectedBins.length > 0 ? (
                  <span className="bg-cyan-100 dark:bg-indigo-950 text-cyan-900 dark:text-indigo-300 text-[11px] font-black px-2.5 py-1 rounded-xl border border-cyan-300 dark:border-indigo-800 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-cyan-700 dark:text-indigo-400" /> Đã chọn {currentSelectedBins.length} ô
                  </span>
                ) : (
                  <span className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-[11px] font-bold px-2.5 py-1 rounded-xl border border-slate-200 dark:border-indigo-900/60 flex items-center gap-1">
                    Chưa chọn ô
                  </span>
                )}
              </div>
            </div>

            {/* 2. Rack Selection Tabs */}
            <div className="flex items-center justify-between mb-3 border-b border-slate-200 dark:border-indigo-900/40 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Chọn Dãy Kệ:</span>
                {racksTopology.map((rk) => (
                  <button
                    key={rk.rackId}
                    type="button"
                    onClick={() => setActiveRackId(rk.rackId)}
                    className={`px-3 py-1 rounded-xl text-xs font-extrabold transition cursor-pointer ${activeRackId === rk.rackId ? 'bg-cyan-700 dark:bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                      }`}
                  >
                    {rk.rackName}
                  </button>
                ))}
              </div>

              <div className="text-[11px] font-bold text-cyan-900 dark:text-indigo-300 bg-cyan-100/70 dark:bg-indigo-950 px-2.5 py-0.5 rounded-lg border border-cyan-200 dark:border-indigo-800">
                {currentRack.zoneName}
              </div>
            </div>

            {/* 3. Main Visual Rack Topology Card */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <WarehouseSlottingGrid
                warehouse={currentWarehouseObj || {
                  id: warehouseCode || 'KHO',
                  code: warehouseCode || 'KHO',
                  name: `Kho ${warehouseCode || 'KHO'}`,
                  address: '',
                  status: 'active',
                  managerIds: [],
                  staffIds: [],
                  subWarehouses: dbSubWarehouses,
                }}
                activeRackId={activeRackId}
                selectedBinCodes={currentSelectedBins}
                suggestedBinCodes={outboundValidBins}
                otherItemsBinsMap={(() => {
                  const map: Record<string, { label: string; occupancyPct: number }> = {};
                  // 1. Items in current active order tab
                  items.forEach((it, idx) => {
                    if (it.rowId !== activeRowId) {
                      const bList = selectedBinsMap[it.rowId] || [];
                      const label = `#${idx + 1} ${it.productName ? (it.productName.length > 10 ? it.productName.substring(0, 8) + '..' : it.productName) : ''}`;
                      bList.forEach((bCode) => {
                        const matchPct = bCode.match(/\((\d+)%\)/);
                        let pct = matchPct ? Number(matchPct[1]) : 100;

                        const cleanBinCode = bCode.split('(')[0].trim();
                        const normKey = normalizeBinKey(cleanBinCode);

                        const itemObj = { label, occupancyPct: pct };
                        map[cleanBinCode] = itemObj;
                        if (normKey) map[normKey] = itemObj;

                        // Also add rack-short combination e.g. R02-H1 (only if rack is specified)
                        const parts = cleanBinCode.split('-');
                        if (parts.length >= 2) {
                          const rackShort = `${parts[parts.length - 2]}-${parts[parts.length - 1]}`.toUpperCase();
                          map[rackShort] = itemObj;
                          map[normalizeBinKey(rackShort)] = itemObj;
                        }
                      });
                    }
                  });

                  // 2. Draft slot locks from OTHER orders / concurrent sessions (OUTBOUND ONLY)
                  // For INBOUND, unsubmitted draft receipts must NEVER lock shelves or show FULL (100% - Phiếu...).
                  // Shelves remain in their original clean state until the order is officially saved!
                  if (mode === 'OUTBOUND_TRANSFER') {
                    const activeDraftLocks = getActiveDraftSlotLocks(tabId || orderNo, true);
                    Object.entries(activeDraftLocks).forEach(([binCode, info]) => {
                      const cleanBinCode = binCode.split('(')[0].trim();
                      const normKey = normalizeBinKey(cleanBinCode);

                      const itemObj = { label: info.label, occupancyPct: Number(info.occupancyPct ?? 100) };
                      if (!map[cleanBinCode]) map[cleanBinCode] = itemObj;
                      if (normKey && !map[normKey]) map[normKey] = itemObj;

                      const parts = cleanBinCode.split('-');
                      if (parts.length >= 2) {
                        const rackShort = `${parts[parts.length - 2]}-${parts[parts.length - 1]}`.toUpperCase();
                        if (!map[rackShort]) map[rackShort] = itemObj;
                        const normRS = normalizeBinKey(rackShort);
                        if (normRS && !map[normRS]) map[normRS] = itemObj;
                      }
                    });
                  }

                  return map;
                })()}
                mode="select"
                readOnly={readOnly}
                isOutbound={mode === 'OUTBOUND_TRANSFER' || mode === 'STOCKTAKE'}
                maxBinsAllowed={999}
                binQtyMap={allocatedQtyMap[activeRowId || items[0]?.rowId || ''] || {}}
                customQtyBinsMap={(() => {
                  const map: Record<string, boolean> = {};
                  const currentActiveId = activeRowId || items[0]?.rowId || '';
                  const rowManual = manualBinAllocations[currentActiveId] || {};
                  Object.entries(rowManual).forEach(([k, entry]) => {
                    if (entry && entry.isCustomQty) {
                      map[k] = true;
                    }
                  });
                  return map;
                })()}
                orderItems={validItems.length > 0 ? validItems : items}
                selectedBinsMap={selectedBinsMap}
                activeRowId={activeRowId || (validItems[0] || items[0])?.rowId || ''}
                onSelectBin={(fullBinCode, cellMeta) => {
                  if (readOnly) return;
                  toggleBinSelection({
                    binCode: fullBinCode,
                    cellCode: fullBinCode,
                    occupancyPct: cellMeta?.occupancyPct,
                    stockQty: cellMeta?.stockQty,
                    productName: cellMeta?.productName,
                    productSku: cellMeta?.sku,
                  } as any);
                }}
                onUpdateBinCapacity={readOnly ? undefined : handleUpdateBinCapacity}
              />
            </div>

            {/* Footer Summary & Action Buttons */}
            <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-slate-200 dark:border-indigo-900/40 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">
                  {readOnly ? 'Vị trí ô đã lưu trữ:' : mode === 'OUTBOUND_TRANSFER' ? 'Các Ô đang chọn xuất:' : 'Các Ô đang chọn nhập:'}
                </span>
                <span className="text-cyan-900 dark:text-indigo-300 font-black bg-cyan-100 dark:bg-indigo-950 px-2.5 py-1 rounded-lg border border-cyan-300 dark:border-indigo-800">
                  {currentSelectedBins.length > 0 ? currentSelectedBins.join(', ') : 'Chưa chọn ô nào'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl border border-slate-300 dark:border-indigo-900/60 bg-slate-100 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition cursor-pointer"
                >
                  Đóng
                </button>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={handleConfirmSelections}
                    className="px-6 py-2.5 rounded-xl bg-cyan-600 dark:bg-indigo-600 hover:bg-cyan-700 dark:hover:bg-indigo-700 text-xs font-black text-white tracking-wide shadow-md transition cursor-pointer active:scale-95 flex items-center gap-2"
                  >
                    Lưu
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
