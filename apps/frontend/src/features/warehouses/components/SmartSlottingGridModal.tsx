import React, { useState, useEffect, useMemo, useRef } from 'react';
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
} from '../../../shared/utils/warehouseAssignments';
import { WarehouseSlottingGrid } from './WarehouseSlottingGrid';
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
  warehouseCode: string;
  items: T[];
  targetRowId?: string | null;
  products?: any[];
  subWarehouses?: any[];
  orderNo?: string;
  tabId?: string;
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

export function SmartSlottingGridModal<T extends SlottingItemRow = SlottingItemRow>({
  isOpen,
  onClose,
  mode,
  warehouseCode,
  items,
  targetRowId,
  products = [],
  subWarehouses,
  orderNo = 'PNK',
  tabId = 'default-draft',
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
  const [dbOccupiedBinsMap, setDbOccupiedBinsMap] = useState<Map<string, number>>(new Map());
  const [binProductsMap, setBinProductsMap] = useState<
    Map<string, { productId: string; sku: string; productName: string; qty: number }>
  >(new Map());
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to latest message
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Real-time slot reservation locks across order drafts / tabs
  useEffect(() => {
    if (!isOpen) return;
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
    const isOutboundMode = mode === 'OUTBOUND_TRANSFER';
    saveActiveDraftSlotLocks(tabId || orderNo, orderNo, currentLocks, isOutboundMode);
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

        // 1. Fetch real physical inventory balances from CSDL (Single Source of Truth)
        const balRes = await fetch(`${API_BASE_URL}/inventory/balances`, { headers }).catch(() => null);
        if (balRes && balRes.ok) {
          const balances: any[] = await balRes.json();
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
        }

        // 2. Fetch stock-in orders history (ALL statuses - draft, pending, completed, confirmed)
        const inRes = await fetch(`${API_BASE_URL}/inbound/stock-in-orders`, { headers }).catch(() => null);
        if (inRes && inRes.ok) {
          const orders: any[] = await inRes.json();
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
                const match = item.note.match(/\[Vị trí Ô:\s*([^\]]+)\]/);
                if (match) bins = match[1].split(',').map((s: string) => s.trim());
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
        }

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

        // 4. Fallback: Parse customBins from stored warehouses & dbSubWarehouses topology
        try {
          const sources = [dbSubWarehouses, currentWarehouseObj?.subWarehouses, getStoredWarehouses().flatMap((w) => w.subWarehouses || [])];
          sources.forEach((subList) => {
            if (!Array.isArray(subList)) return;
            subList.forEach((sub: any) => {
              (sub.racks || []).forEach((rk: any) => {
                if (rk.customBins) {
                  Object.entries(rk.customBins).forEach(([bKey, cfg]: [string, any]) => {
                    const pct = Number(cfg?.occupancyPct || 0);
                    const noteStr = String(cfg?.notes || '').trim();
                    if (pct > 0 || (noteStr && noteStr !== 'Ô Trống')) {
                      const cleanBin = bKey.split('(')[0].trim();
                      const norm = normalizeBinKey(cleanBin);
                      const short = (cleanBin.split('-').pop() || cleanBin).toUpperCase();

                      // Extract productName from noteStr if available
                      let pName = noteStr.replace(/Đã chứa:\s*\d+%/gi, '').replace(/\(\d+%\)/gi, '').replace(/\[[^\]]+\]/gi, '').trim();
                      if (!pName || pName === 'Ô Trống') pName = 'Sản phẩm tồn kho';

                      if (!occMap.has(cleanBin)) occMap.set(cleanBin, pct || 100);
                      if (norm && !occMap.has(norm)) occMap.set(norm, pct || 100);
                      if (short && !occMap.has(short)) occMap.set(short, pct || 100);

                      const prodObj = { productId: '', sku: '', productName: pName, qty: pct || 100 };
                      if (!prodMap.has(cleanBin)) prodMap.set(cleanBin, prodObj);
                      if (norm && !prodMap.has(norm)) prodMap.set(norm, prodObj);
                      if (short && !prodMap.has(short)) prodMap.set(short, prodObj);
                    }
                  });
                }
              });
            });
          });
        } catch {}

        // 5. Fallback: Parse assigned bins directly from items currently selected in draft form
        (items || []).forEach((item) => {
          let bins: string[] = item.assignedBins || [];
          if (bins.length === 0 && item.locationBin) {
            bins = item.locationBin.split(',').map((s: string) => s.trim());
          }
          if (bins.length === 0 && item.note) {
            const match = item.note.match(/\[Vị trí Ô:\s*([^\]]+)\]/);
            if (match) bins = match[1].split(',').map((s: string) => s.trim());
          }

          bins.forEach((bCode) => {
            if (bCode) {
              const cleanBin = bCode.split('(')[0].trim();
              const norm = normalizeBinKey(cleanBin);
              const short = (cleanBin.split('-').pop() || cleanBin).toUpperCase();
              const pId = String(item.productId || '');
              const pName = item.productName || 'Hàng hóa';
              const pSku = item.productSku || '';
              const pQty = Number(item.qty || 1);

              if (!occMap.has(cleanBin)) {
                occMap.set(cleanBin, pQty);
                if (norm) occMap.set(norm, pQty);
                if (short) occMap.set(short, pQty);
                prodMap.set(cleanBin, { productId: pId, sku: pSku, productName: pName, qty: pQty });
                if (norm) prodMap.set(norm, { productId: pId, sku: pSku, productName: pName, qty: pQty });
                if (short) prodMap.set(short, { productId: pId, sku: pSku, productName: pName, qty: pQty });
              }
            }
          });
        });

        if (isMounted) {
          setDbOccupiedBinsMap(occMap);
          setBinProductsMap(prodMap);
        }
      } catch (err) {
        console.error('Lỗi tải dữ liệu ô kệ CSDL:', err);
      }
    }

    loadOccupied();
    return () => {
      isMounted = false;
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

      const matches =
        (targetPId && infoPId && targetPId === infoPId) ||
        (targetSku && infoSku && targetSku === infoSku) ||
        (targetName && infoName && (infoName.includes(targetName) || targetName.includes(infoName)));

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
            if (cfg) {
              const notes = String(cfg.notes || '').toLowerCase();
              if ((targetName && notes.includes(targetName)) || (targetSku && notes.includes(targetSku))) {
                foundMatch = true;
              }
            }
          });
        });
        if (foundMatch) {
          validBins.push(binKey);
          if (normKey) validBins.push(normKey);
        }
      }
    });

    // Also include assignedBins and locationBin from activeItem
    if (Array.isArray(activeItem.assignedBins)) {
      activeItem.assignedBins.forEach((b) => {
        if (b) {
          const clean = b.split('(')[0].trim();
          validBins.push(clean);
          const norm = normalizeBinKey(clean);
          if (norm) validBins.push(norm);
          const short = (clean.split('-').pop() || clean).toUpperCase();
          if (short) validBins.push(short);
        }
      });
    }
    if (activeItem.locationBin) {
      activeItem.locationBin.split(',').forEach((b) => {
        const clean = b.trim();
        if (clean) {
          validBins.push(clean);
          const norm = normalizeBinKey(clean);
          if (norm) validBins.push(norm);
          const short = (clean.split('-').pop() || clean).toUpperCase();
          if (short) validBins.push(short);
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
            isOccupied = true;
            stockQty = dbOccupiedBinsMap.get(key) || dbOccupiedBinsMap.get(normKey) || 0;
            const info = binProductsMap.get(key) || binProductsMap.get(normKey);
            if (info) {
              productId = info.productId;
              productSku = info.sku;
              productName = info.productName;
            }
            break;
          }
        }

        if (!isOccupied) {
          const normShort = normalizeBinKey(binShortCode);
          const normRack = normalizeBinKey(rackId);

          for (const [k, qty] of dbOccupiedBinsMap.entries()) {
            const normK = normalizeBinKey(k);
            if (!normK) continue;
            const isShortMatch = normK === normShort || normK.endsWith(normShort) || k.toUpperCase().includes(binShortCode.toUpperCase());
            const isRackMatch = !normK.includes('R0') || normK.includes(normRack);

            if (isShortMatch && isRackMatch) {
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
          isOccupied,
          stockQty,
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

    const initialTargetId = targetRowId && items.some((i) => i.rowId === targetRowId)
      ? targetRowId
      : items[0].rowId;

    setActiveRowId(initialTargetId);

    const initialMap: Record<string, string[]> = {};

    // Preserve existing assigned bins from order rows ONLY (no forced auto-allocation for all items)
    items.forEach((item) => {
      let validBins = (item.assignedBins || []).filter(
        (b) => b && (b.includes('-S0') || b.includes('-R0') || b.includes('-C'))
      );
      if (validBins.length === 0 && item.locationBin) {
        validBins = item.locationBin
          .split(',')
          .map((s) => s.trim())
          .filter((b) => b && (b.includes('-S0') || b.includes('-R0') || b.includes('-C')));
      }

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
          const itemQty = Number(item.qty || 1);
          const totalBins = validBins.length;
          const maxPerBin = Math.ceil(itemQty / totalBins);
          const maxBinCap = 500;

          initialMap[item.rowId] = validBins.map((b, bIdx) => {
            if (b.includes('%')) return b;
            const cleanB = b.split('(')[0].trim();
            const qtyForThisBin = bIdx < totalBins - 1
              ? Math.min(itemQty, maxPerBin)
              : Math.max(1, itemQty - maxPerBin * (totalBins - 1));
            const pctPerBin = Math.max(1, Math.min(100, Math.round((qtyForThisBin / maxBinCap) * 100)));
            return pctPerBin < 100 ? `${cleanB} (${pctPerBin}%)` : cleanB;
          });
        } else {
          initialMap[item.rowId] = [...validBins];
        }
      }
    });

    setSelectedBinsMap(initialMap);

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

      const activeItem = items.find((i) => i.rowId === initialTargetId) || items[0];
      const itemQty = activeItem?.qty || 0;
      const totalBinsNeeded = Math.max(1, Math.ceil(itemQty / 100));
      const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const isOutbound = mode === 'OUTBOUND_TRANSFER';

      return [
        {
          id: 'msg-1',
          sender: 'ai',
          text: isOutbound
            ? `CHỈ DẪN XUẤT CHUYỂN KHO AI SMART WMS\n\nMặt hàng: ${activeItem?.productName || 'Hàng hóa'} (Tổng xuất: ${itemQty.toLocaleString('vi-VN')} ${activeItem?.unit || 'Cái'})\n\nQUY TẮC AN TOÀN XUẤT KHO:\n- Bạn chỉ được phép chọn các ô kệ đang lưu trữ đúng mặt hàng "${activeItem?.productName || 'này'}".\n- Các ô kệ trống hoặc chứa hàng khác sẽ tự động khóa để tránh xuất nhầm hàng.\n\nChỉ dẫn vị trí ô lấy hàng: Cần chọn ~${totalBinsNeeded} ô chứa.`
            : `CHỈ DẪN NHẬP KHO AI SMART WMS\n\nMặt hàng: ${activeItem?.productName || 'Hàng hóa'} (Tổng nhập: ${itemQty.toLocaleString('vi-VN')} ${activeItem?.unit || 'Cái'})\n\nChỉ dẫn: Bạn có thể tự do chọn ô kệ cho 1, 2, 3 mặt hàng tùy ý. Không bắt buộc chọn tất cả.`,
          time: now,
        },
      ];
    });
  }, [isOpen]);

  if (!isOpen) return null;

  if (!items || items.length === 0) {
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

  const currentItem = (items && items.length > 0) ? (items.find((i) => i.rowId === activeRowId) || items[0]) : null;
  const requiredCount = currentItem ? Math.max(1, Math.ceil((currentItem.qty || 1) / 100)) : 1;
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

  const isBinMatchingActiveItem = (cell: BinCell): boolean => {
    if (!currentItem) return false;

    // Direct check from cell properties
    if (cell.isOccupied) {
      if (currentItem.productId && cell.productId && String(cell.productId) === String(currentItem.productId)) {
        return true;
      }
      const curSku = (currentItem.productSku || '').trim().toLowerCase();
      const cellSku = (cell.productSku || '').trim().toLowerCase();
      if (curSku && cellSku && curSku === cellSku) {
        return true;
      }
      const curName = (currentItem.productName || '').trim().toLowerCase();
      const cellName = (cell.productName || '').trim().toLowerCase();
      if (curName && cellName && (curName.includes(cellName) || cellName.includes(curName))) {
        return true;
      }
    }

    // Fallback: check dbOccupiedBinsMap & binProductsMap by cell.binCode, cell.cellCode, or short code (e.g. D1)
    const shortCode = (cell.binCode.split('-').pop() || cell.binCode).toUpperCase();
    const keysToCheck = [cell.binCode, shortCode, cell.cellCode.replace('Ô ', '')];
    for (const k of keysToCheck) {
      const info = binProductsMap.get(k) || binProductsMap.get(normalizeBinKey(k));
      if (info) {
        const curName = (currentItem.productName || '').trim().toLowerCase();
        const infoName = (info.productName || '').trim().toLowerCase();
        const curSku = (currentItem.productSku || '').trim().toLowerCase();
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

  const removeBinCustomConfig = (binCode: string) => {
    const shortCode = (binCode.split('-').pop() || binCode).toUpperCase();
    const normKey = normalizeBinKey(binCode);
    const updatedSubs = (dbSubWarehouses && dbSubWarehouses.length > 0 ? dbSubWarehouses : currentWarehouseObj?.subWarehouses || []).map((sub: any) => {
      const racks = (sub.racks || []).map((rk: any) => {
        const custom = { ...(rk.customBins || {}) };
        if (custom[binCode]) delete custom[binCode];
        if (custom[shortCode]) delete custom[shortCode];
        if (normKey && custom[normKey]) delete custom[normKey];
        return { ...rk, customBins: custom };
      });
      return { ...sub, racks };
    });

    setDbSubWarehouses(updatedSubs);
    if (currentWarehouseObj) {
      setCurrentWarehouseObj({ ...currentWarehouseObj, subWarehouses: updatedSubs });
    }
  };

  const toggleBinSelection = (cell: BinCell) => {
    if (!activeRowId || !currentItem) return;

    const binCode = cell.binCode;
    const shortCode = (binCode.split('-').pop() || binCode).toUpperCase();
    const normKey = normalizeBinKey(binCode);

    setSelectedBinsMap((prev) => {
      const currentList = prev[activeRowId] || [];
      const isCurrentlySelected = currentList.some((b) => {
        const normB = normalizeBinKey(b);
        return normB === normKey || b.startsWith(binCode) || b === binCode || b.includes(shortCode);
      });

      let updatedRawList: string[];

      if (isCurrentlySelected) {
        // UNCHECKING BIN: Remove from current item's selection
        updatedRawList = currentList.filter((b) => {
          const normB = normalizeBinKey(b);
          return normB !== normKey && !b.startsWith(binCode) && b !== binCode && !b.includes(shortCode);
        });

        // Check if ANY OTHER item in selectedBinsMap is still using this bin
        const isUsedByOtherItems = Object.entries(prev).some(([rowId, bList]) => {
          if (rowId === activeRowId) return false;
          return bList.some((b) => {
            const normB = normalizeBinKey(b);
            return normB === normKey || b.startsWith(binCode) || b.includes(shortCode);
          });
        });

        // If no other item in order is using this bin, revert bin config back to original 0%/empty state!
        if (!isUsedByOtherItems) {
          removeBinCustomConfig(binCode);
          updateSubWarehousesTopology(binCode, shortCode, 0, 'Ô Trống (500kg)');
        }
      } else {
        // CHECKING BIN: Add to current item's selection
        const activeItem = items.find((i) => i.rowId === activeRowId) || items[0];
        const targetQty = Number(activeItem?.qty || 1);

        if (mode === 'OUTBOUND_TRANSFER') {
          // 1. Check if bin is assigned to another item in current order
          const assignedToOtherItem = Object.entries(prev).find(([rId, bList]) => {
            if (rId === activeRowId) return false;
            return bList.some((b) => normalizeBinKey(b) === normKey || b.startsWith(binCode) || b.includes(shortCode));
          });
          if (assignedToOtherItem) {
            const otherRowId = assignedToOtherItem[0];
            const otherItemIdx = items.findIndex((i) => i.rowId === otherRowId);
            const otherName = items[otherItemIdx]?.productName || 'mặt hàng khác';
            setWarningMessage(`⚠️ Ô ${binCode} đã được chọn cho mặt hàng #${otherItemIdx + 1} "${otherName}". Vui lòng chọn ô khác cho "${activeItem?.productName}"!`);
            return prev;
          }

          // 2. Verify that the bin actually stores the active product being exported if valid bins are identified
          if (outboundValidBins.length > 0) {
            const isValidForActiveProduct = outboundValidBins.some(
              (b) => normalizeBinKey(b) === normKey || b === binCode || b.includes(shortCode) || normalizeBinKey(b) === normalizeBinKey(shortCode)
            );
            if (!isValidForActiveProduct) {
              setWarningMessage(`⚠️ Kệ ${binCode} không lưu trữ mặt hàng "${activeItem?.productName || ''}". Vui lòng chỉ chọn các ô kệ có chứa mặt hàng này!`);
              return prev;
            }
          }

          // 3. Check if total stock from selected bins already satisfies target export quantity
          let currentSelectedStock = 0;
          currentList.forEach((bCode) => {
            const cleanCode = bCode.split('(')[0].trim();
            const normK = normalizeBinKey(cleanCode);
            const stock = dbOccupiedBinsMap.get(cleanCode) || dbOccupiedBinsMap.get(normK) || 0;
            currentSelectedStock += stock > 0 ? stock : 100;
          });

          if (currentSelectedStock >= targetQty) {
            setWarningMessage(`✅ Đã chọn đủ ${currentSelectedStock}/${targetQty} ${activeItem?.unit || 'Cái'} cần xuất cho "${activeItem?.productName || 'mặt hàng'}"! Hệ thống đã khóa không cho chọn thêm.`);
            return prev;
          }
        } else {
          // INBOUND MODE / STOCKIN / STOCKTAKE: Sequential capacity filling validation
          const maxBinCap = 500;
          let currentStackedQty = 0;

          currentList.forEach((bCodeStr) => {
            const cleanB = bCodeStr.split('(')[0].trim();
            let occupiedByOthers = 0;
            Object.entries(prev).forEach(([rId, bList]) => {
              if (rId === activeRowId) return;
              const matchStr = bList.find((b) => normalizeBinKey(b) === normalizeBinKey(cleanB) || b.startsWith(cleanB));
              if (matchStr) {
                const m = matchStr.match(/\((\d+)%\)/);
                occupiedByOthers += m ? Number(m[1]) : 100;
              }
            });

            const availCapPct = Math.max(0, 100 - occupiedByOthers);
            const availCapQty = Math.round((availCapPct / 100) * maxBinCap);
            const remainingToStack = Math.max(0, targetQty - currentStackedQty);
            const alloc = Math.min(remainingToStack, availCapQty);
            currentStackedQty += alloc;
          });

          if (currentStackedQty >= targetQty) {
            setWarningMessage(`✅ Đã xếp đầy đủ ${targetQty}/${targetQty} ${activeItem?.unit || 'Cái'} cần nhập vào các ô kệ đã chọn! Nếu muốn chuyển sang ô kệ khác, vui lòng bỏ chọn ô vừa rồi trước.`);
            return prev;
          }
        }

        const filtered = currentList.filter((b) => normalizeBinKey(b) !== normKey);
        updatedRawList = [...filtered, binCode];
      }

      // SEQUENTIAL CAPACITY FILLING PER BIN IN INBOUND / STOCKIN / STOCKTAKE MODE
      const activeItem = items.find((i) => i.rowId === activeRowId) || items[0];
      const targetQty = Number(activeItem?.qty || 1);
      const totalBins = updatedRawList.length;

      if (mode !== 'OUTBOUND_TRANSFER' && totalBins > 0) {
        const maxBinCap = 500;
        let remainingToAllocate = targetQty;

        const formattedList = updatedRawList.map((bCodeStr) => {
          const cleanB = bCodeStr.split('(')[0].trim();
          const shortB = (cleanB.split('-').pop() || cleanB).toUpperCase();

          let occupiedByOthers = 0;
          Object.entries(prev).forEach(([rId, bList]) => {
            if (rId === activeRowId) return;
            const matchStr = bList.find((b) => normalizeBinKey(b) === normalizeBinKey(cleanB) || b.startsWith(cleanB));
            if (matchStr) {
              const m = matchStr.match(/\((\d+)%\)/);
              occupiedByOthers += m ? Number(m[1]) : 100;
            }
          });

          const availCapPct = Math.max(0, 100 - occupiedByOthers);
          const availCapQty = Math.round((availCapPct / 100) * maxBinCap);

          const qtyForThisBin = Math.min(remainingToAllocate, availCapQty);
          remainingToAllocate = Math.max(0, remainingToAllocate - qtyForThisBin);

          const pctForThisBin = Math.max(1, Math.min(100, Math.round((qtyForThisBin / maxBinCap) * 100)));
          const netPct = Math.min(100, occupiedByOthers + pctForThisBin);

          updateSubWarehousesTopology(cleanB, shortB, netPct, `Đã chứa: ${netPct}% (${qtyForThisBin} ${activeItem?.unit || 'cái'})`);

          return pctForThisBin < 100 ? `${cleanB} (${pctForThisBin}%)` : cleanB;
        });

        return { ...prev, [activeRowId]: formattedList };
      }

      return { ...prev, [activeRowId]: updatedRawList };
    });
  };

  const handleConfirmSelections = async () => {
    const updatedSubs = dbSubWarehouses && dbSubWarehouses.length > 0 ? dbSubWarehouses : currentWarehouseObj?.subWarehouses || [];
    const updatedRows = items.map((r) => {
      const chosenBins = selectedBinsMap[r.rowId] || [];
      if (chosenBins.length > 0) {
        const cleanNote = (r.note || '').replace(/\[Vị trí Ô:\s*[^\]]+\]/g, '').trim();
        const formattedBins = chosenBins.map((bCode) => bCode);

        return {
          ...r,
          assignedBins: formattedBins,
          locationBin: formattedBins.join(', '),
          note: cleanNote ? `${cleanNote} [Vị trí Ô: ${formattedBins.join(', ')}]` : `[Vị trí Ô: ${formattedBins.join(', ')}]`,
        };
      } else {
        return r;
      }
    });
    onConfirmAll(updatedRows, updatedSubs);
    onClose();
  };

  const updateSubWarehousesTopology = (targetBinCode: string, targetShortCode: string, pct: number, notes?: string) => {
    const updatedSubs = (dbSubWarehouses && dbSubWarehouses.length > 0 ? dbSubWarehouses : currentWarehouseObj?.subWarehouses || []).map((sub: any) => {
      const racks = (sub.racks || []).map((rk: any) => {
        if (targetBinCode.includes(rk.id || rk.rackCode) || rk.id === activeRackId || rk.rackCode === activeRackId) {
          const custom = { ...(rk.customBins || {}) };
          custom[targetBinCode] = {
            occupancyPct: pct,
            maxWeight: 500,
            notes: notes || `Sức chứa ${pct}% (Còn trống ${100 - pct}%)`,
          };
          custom[targetShortCode] = custom[targetBinCode];
          return { ...rk, customBins: custom };
        }
        return rk;
      });
      return { ...sub, racks };
    });

    setDbSubWarehouses(updatedSubs);
    if (currentWarehouseObj) {
      const updatedWh = { ...currentWarehouseObj, subWarehouses: updatedSubs };
      setCurrentWarehouseObj(updatedWh);
      // NOTE: Staged in memory ONLY during AI interaction. Saved to CSDL ONLY when user clicks "Lưu"!
    }
  };

  const handleUpdateBinCapacity = (binCode: string, pct: number, notes?: string, targetRowId?: string, newQty?: number) => {
    const cleanBinCode = binCode.split('(')[0].trim();
    const shortCode = (cleanBinCode.split('-').pop() || cleanBinCode).toUpperCase();
    const normTarget = normalizeBinKey(cleanBinCode);

    const rId = targetRowId || activeRowId;

    if (newQty !== undefined && newQty > 0 && rId && items) {
      const targetItem = items.find((i) => i.rowId === rId);
      if (targetItem) {
        targetItem.qty = newQty;
        if ((targetItem as any).expectedQty !== undefined) (targetItem as any).expectedQty = newQty;
        if ((targetItem as any).receivedQty !== undefined) (targetItem as any).receivedQty = newQty;
        if ((targetItem as any).requiredQty !== undefined) (targetItem as any).requiredQty = newQty;
      }
    }

    if (rId) {
      setSelectedBinsMap((prev) => {
        const currentList = prev[rId] || [];
        const filtered = currentList.filter((b) => normalizeBinKey(b) !== normTarget && !b.startsWith(cleanBinCode));

        let newMap: Record<string, string[]>;
        if (pct >= 100) {
          const entryToSave = cleanBinCode;
          newMap = { ...prev, [rId]: [entryToSave] };
        } else if (pct > 0) {
          const entryToSave = `${cleanBinCode} (${pct}%)`;
          newMap = { ...prev, [rId]: [...filtered, entryToSave] };
        } else {
          newMap = { ...prev, [rId]: filtered };
        }

        let totalPctForBin = 0;
        Object.values(newMap).forEach((bList) => {
          bList.forEach((b) => {
            if (normalizeBinKey(b) === normTarget || b.startsWith(cleanBinCode)) {
              const m = b.match(/\((\d+)%\)/);
              if (m) totalPctForBin += Number(m[1]);
              else totalPctForBin += 100;
            }
          });
        });

        updateSubWarehousesTopology(cleanBinCode, shortCode, totalPctForBin, notes || `Đã chứa: ${totalPctForBin}%`);
        return newMap;
      });
    } else {
      updateSubWarehousesTopology(cleanBinCode, shortCode, pct, notes);
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

      // Collect all cells across topology
      const allCellsList: BinCell[] = [];
      racksTopology.forEach((rk) => {
        rk.floors.forEach((fl) => {
          fl.cells.forEach((cl) => {
            allCellsList.push(cl);
          });
        });
      });

      const activeItem = items.find((i) => i.rowId === activeRowId) || items[0];

      // ACTION 1: Clear/Reset selections
      if (lower.includes('bỏ chọn') || lower.includes('xóa chọn') || lower.includes('hủy chọn') || lower.includes('chọn lại')) {
        if (activeRowId) {
          setSelectedBinsMap((prev) => ({ ...prev, [activeRowId]: [] }));
          aiReply = `Đã thực thi: Đã bỏ chọn tất cả các ô kệ của mặt hàng "${activeItem?.productName || 'hàng hóa'}".`;
        }
      }
      // ACTION 1.5: INTENT - CHỈ DẪN KỆ TRỐNG CHO NHẬP KHO (EMPTY RACK GUIDANCE)
      else if (
        lower.includes('kệ trống') ||
        lower.includes('ô trống') ||
        lower.includes('trống bao nhiêu') ||
        lower.includes('tìm ô trống') ||
        lower.includes('kệ nào trống') ||
        lower.includes('nhập vào đâu') ||
        lower.includes('chỉ dẫn nhập') ||
        lower.includes('xếp vào đâu') ||
        (mode !== 'OUTBOUND_TRANSFER' && (
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
              const cellAny = cl as any;
              if (!cl.isOccupied && (!cellAny.occupancyPct || cellAny.occupancyPct === 0)) {
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
        lines.push(`✨ CHỈ DẪN VỊ TRÍ KỆ TRỐNG (NHẬP KHO SLOTTING):`);
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
          const cellAny = cell as any;
          if (!cell.isOccupied && (!cellAny.occupancyPct || cellAny.occupancyPct === 0)) {
            candidateBins.push(cell.binCode);
          }
        }

        if (candidateBins.length > 0 && activeRowId) {
          setSelectedBinsMap((prev) => ({ ...prev, [activeRowId]: candidateBins }));
          const firstBin = candidateBins[0];
          const matchRack = racksTopology.find((rk) => firstBin.includes(rk.rackId));
          if (matchRack) setActiveRackId(matchRack.rackId);
          lines.push(``);
          lines.push(`👉 AI đã tự động tích chọn ${candidateBins.length} ô trống (${candidateBins.map(b => b.split('-').pop()).join(', ')}) trên sơ đồ 2D để bạn nhập hàng ngay!`);
        } else {
          lines.push(``);
          lines.push(`⚠️ Cảnh báo: Tất cả các kệ trong kho đã đầy 100%. Vui lòng xuất bớt hàng hoặc mở rộng sơ đồ kệ.`);
        }

        aiReply = lines.join('\n');
      }
      // ACTION 1.8: INTENT - CHỈ DẪN KỆ CÓ HÀNG CHO XUẤT KHO (OCCUPIED STOCK GUIDANCE)
      else if (
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
        (mode === 'OUTBOUND_TRANSFER' && (
          lower.includes('kệ nào') ||
          lower.includes('ô nào') ||
          lower.includes('ở đâu') ||
          lower.includes('xuất') ||
          lower.includes('hàng') ||
          lower.includes('có')
        ))
      ) {
        const matchingOccupiedBins: { binCode: string; rackId: string; rackName: string; pct: number; qty: number; pName: string; unit: string }[] = [];

        racksTopology.forEach((rk) => {
          rk.floors.forEach((fl) => {
            fl.cells.forEach((cl) => {
              const clAny = cl as any;
              const isMatch = isBinMatchingActiveItem(cl);
              if (isMatch) {
                matchingOccupiedBins.push({
                  binCode: cl.binCode,
                  rackId: rk.rackId,
                  rackName: rk.rackName || rk.rackId,
                  pct: clAny.occupancyPct || 100,
                  qty: clAny.totalPhysical || (activeItem?.qty || 1),
                  pName: cl.productName || activeItem?.productName || 'Sản phẩm',
                  unit: clAny.unit || activeItem?.unit || 'Cái',
                });
              }
            });
          });
        });

        const lines: string[] = [];
        lines.push(`📦 CHỈ DẪN VỊ TRÍ KỆ CÓ HÀNG (XUẤT KHO SLOTTING):`);
        lines.push(`Mặt hàng cần xuất: ${activeItem?.productName || 'Hàng hóa'} (Tổng xuất: ${activeItem?.qty || 0} ${activeItem?.unit || 'Cái'})`);
        lines.push(``);

        if (matchingOccupiedBins.length > 0) {
          lines.push(`Tìm thấy ${matchingOccupiedBins.length} ô kệ đang lưu trữ đúng mặt hàng này:`);
          const candidateCodes: string[] = [];

          matchingOccupiedBins.forEach((bInfo, idx) => {
            const shortCode = bInfo.binCode.split('-').pop() || bInfo.binCode;
            lines.push(` ${idx + 1}. Ô ${shortCode} (Dãy ${bInfo.rackName}): Đã chứa ${bInfo.pct}% (${bInfo.qty} ${bInfo.unit})`);
            candidateCodes.push(bInfo.binCode);
          });

          if (activeRowId) {
            setSelectedBinsMap((prev) => ({ ...prev, [activeRowId]: candidateCodes }));
            const firstBin = candidateCodes[0];
            const matchRack = racksTopology.find((rk) => firstBin.includes(rk.rackId));
            if (matchRack) setActiveRackId(matchRack.rackId);
          }

          lines.push(``);
          lines.push(`👉 AI đã tự động chọn và mở Dãy Kệ ${matchingOccupiedBins[0].rackName} để bạn xuất hàng chính xác!`);
        } else {
          lines.push(`⚠️ Không tìm thấy ô kệ nào trong kho đang chứa mặt hàng "${activeItem?.productName}". Vui lòng kiểm tra lại tồn kho.`);
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

        const isOutbound = mode === 'OUTBOUND_TRANSFER';
        const candidateBins: string[] = [];

        for (const cell of allCellsList) {
          if (candidateBins.length >= targetCount) break;

          if (isOutbound) {
            const isMatch = isBinMatchingActiveItem(cell);
            if (isMatch) candidateBins.push(cell.binCode);
          } else {
            if (!cell.isOccupied) candidateBins.push(cell.binCode);
          }
        }

        if (candidateBins.length > 0 && activeRowId) {
          setSelectedBinsMap((prev) => ({ ...prev, [activeRowId]: candidateBins }));

          const firstBin = candidateBins[0];
          const matchRack = racksTopology.find((rk) => firstBin.includes(rk.rackId));
          if (matchRack) setActiveRackId(matchRack.rackId);

          const shortNames = candidateBins.map((b) => b.split('-').pop()).join(', ');
          aiReply = `Đã thực thi: AI đã chọn ${candidateBins.length} ô hợp lệ (${shortNames}) trên sơ đồ 2D cho mặt hàng "${activeItem?.productName}".`;
        } else {
          aiReply = isOutbound
            ? `Không tìm thấy ô chứa hợp lệ nào đang lưu mặt hàng "${activeItem?.productName}".`
            : `Không tìm thấy ô kệ trống thích hợp trên sơ đồ.`;
        }
      }
      // ACTION 4: Capacity query
      else if (lower.includes('đủ') || lower.includes('mấy ô') || lower.includes('số lượng') || lower.includes('sức chứa')) {
        aiReply = `Mặt hàng ${activeItem?.productName} (${activeItem?.qty?.toLocaleString('vi-VN')} ${activeItem?.unit}):\n- Cần dùng: ${requiredCount} ô chứa (Đã chọn ${currentSelectedBins.length}/${requiredCount} ô).`;
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
          : (allCellsList[0]?.cellCode || 'D1').replace(/ô/i, '').trim().toUpperCase();

        const shortCode = binCodeMatch ? binCodeMatch[0].toUpperCase() : (fallbackShortCode || 'D1');
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
          targetPct = Math.min(100, Math.max(1, Math.round((qtyVal / 500) * 100)));
          noteText = `Lưu thêm: ${qtyVal} ${activeItem?.unit || 'sản phẩm'} (${targetPct}% thể tích)`;
        }

        if (lower.includes('xuất') || lower.includes('lấy đi') || lower.includes('giảm')) {
          const reduction = pctMatch ? parseInt(pctMatch[1], 10) : 50;
          targetPct = Math.max(0, 100 - reduction);
          noteText = `Giảm sức chứa sau khi lấy hàng: còn ${targetPct}%`;
        }

        const targetCell = allCellsList.find((c) => isCellMatchingShortCode(c, shortCode)) || allCellsList[0];
        if (targetCell) {
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
              if (mode === 'OUTBOUND_TRANSFER' && !isBinMatchingActiveItem(cell)) continue;
              if (mode !== 'OUTBOUND_TRANSFER' && cell.isOccupied) continue;
              foundBins.push(cell.binCode);
            }
          }

          if (foundBins.length > 0) {
            setSelectedBinsMap((prev) => {
              const currentList = prev[activeRowId] || [];
              const combined = Array.from(new Set([...currentList, ...foundBins]));
              return { ...prev, [activeRowId]: combined };
            });
            aiReply = `Đã chọn các ô (${matchedShortCodes.join(', ')}) trên sơ đồ 2D cho mặt hàng "${activeItem?.productName}".`;
          } else {
            aiReply = `Không thể chọn ô (${matchedShortCodes.join(', ')}) do ô đã đầy hoặc không khớp mặt hàng.`;
          }
        } else {
          aiReply = `AI đã nhận lệnh. Bạn có thể nhập:\n- "Ô D1 còn 200 cái" / "Gán D1 50%"\n- "Chọn ô D1 và D2"\n- "Tự chọn đủ ô" / "Bỏ chọn hết"`;
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
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-1.5 sm:p-3 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-cyan-500 w-full max-w-[98vw] max-w-[1650px] h-[95vh] flex flex-col overflow-hidden">
        {/* Modal Header - Master Cyan Theme */}
        <div className="bg-cyan-700 text-white px-6 py-3.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-cyan-800 border border-cyan-500/50 flex items-center justify-center text-cyan-200 shadow-inner">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-wide flex items-center gap-2">
                Trợ lý AI Chỉ dẫn Vị trí & Sơ đồ Ô Kệ Kho (Smart WMS Slotting Grid)
              </h3>
              <p className="text-xs text-cyan-100 font-medium">
                {mode === 'STOCKTAKE'
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
            className="h-8 w-8 rounded-2xl bg-cyan-800/60 hover:bg-cyan-600 text-cyan-100 flex items-center justify-center transition cursor-pointer"
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
        <div className="grid grid-cols-1 md:grid-cols-12 gap-0 flex-1 overflow-hidden bg-slate-50">
          {/* Left Column: AI Interactive Chat */}
          <div className="md:col-span-4 border-r border-cyan-200 bg-cyan-50/30 flex flex-col h-full min-h-0 overflow-hidden">
            <div className="p-3 bg-white border-b border-cyan-100 flex items-center justify-between text-xs font-black text-cyan-900 shadow-2xs shrink-0">
              <span className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-cyan-600" /> Trợ lý AI Hỏi Đáp Slotting
              </span>
              <span className="bg-cyan-100 text-cyan-900 text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase border border-cyan-300">
                Online
              </span>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 p-3 overflow-y-auto min-h-0 space-y-3 text-xs scrollbar-thin scrollbar-thumb-cyan-400 scrollbar-track-cyan-100">
              {messages.map((m) => (
                <div key={m.id} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400 font-bold">
                    <span>{m.sender === 'user' ? 'Thủ kho' : 'AI Assistant'}</span>
                    <span>•</span>
                    <span>{m.time}</span>
                  </div>
                  <div
                    className={`max-w-[95%] p-3 rounded-2xl shadow-xs leading-relaxed whitespace-pre-wrap ${m.sender === 'user'
                        ? 'bg-cyan-600 text-white rounded-br-none font-medium'
                        : 'bg-white text-slate-800 border border-cyan-200 rounded-bl-none font-normal shadow-2xs'
                      }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Prompts */}
            <div className="px-3 py-2 bg-white border-t border-cyan-100 flex flex-wrap gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleSendMessage(undefined, mode === 'OUTBOUND_TRANSFER' ? 'Kệ có hàng' : 'Kệ trống')}
                className="text-[10px] bg-cyan-600 hover:bg-cyan-700 text-white px-2.5 py-1 rounded-lg font-black transition cursor-pointer shadow-2xs flex items-center gap-1"
              >
                {mode === 'OUTBOUND_TRANSFER' ? '📦 Chỉ dẫn Kệ Có Hàng' : '✨ Chỉ dẫn Kệ Trống'}
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage(undefined, '1 kệ thôi')}
                className="text-[10px] bg-cyan-50 hover:bg-cyan-100 border border-cyan-300 text-cyan-900 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer"
              >
                1 Kệ/Ô thôi
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage(undefined, 'Tự động chọn')}
                className="text-[10px] bg-cyan-50 hover:bg-cyan-100 border border-cyan-300 text-cyan-900 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer"
              >
                Tự chọn đủ ô
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage(undefined, 'Chuyển kệ R01')}
                className="text-[10px] bg-cyan-50 hover:bg-cyan-100 border border-cyan-300 text-cyan-900 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer"
              >
                Xem Kệ R01
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage(undefined, 'Bỏ chọn')}
                className="text-[10px] bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer"
              >
                Bỏ chọn hết
              </button>
            </div>

            {/* Chat Input */}
            <form onSubmit={(e) => handleSendMessage(e)} className="p-3 bg-white border-t border-cyan-200 flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                placeholder="Ra lệnh AI (VD: 1 kệ thôi, chọn ô D1, R02)..."
                className="flex-1 h-9 px-3 text-xs border border-slate-300 rounded-xl outline-none focus:border-cyan-600 bg-white font-medium text-slate-800"
              />
              <button
                type="submit"
                className="h-9 px-3.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl flex items-center justify-center transition cursor-pointer shadow-sm active:scale-95"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>

          {/* Right Column: Interactive Visual Rack Topology Grid */}
          <div className="md:col-span-8 p-4 flex flex-col h-full overflow-hidden bg-white">
            {/* 1. Item Switcher Bar */}
            <div className="mb-3 bg-cyan-50/80 p-2.5 rounded-2xl border border-cyan-200 flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-x-auto">
                <span className="text-xs font-black uppercase text-cyan-950 flex items-center gap-1.5 shrink-0">
                  <Layers className="h-4 w-4 text-cyan-600" /> Đơn hàng:
                </span>
                {items.map((it, idx) => {
                  const isActive = it.rowId === activeRowId;
                  const countReq = Math.max(1, Math.ceil((it.qty || 1) / 100));
                  const selectedCount = (selectedBinsMap[it.rowId] || []).length;
                  return (
                    <button
                      key={it.rowId}
                      type="button"
                      onClick={() => setActiveRowId(it.rowId)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${isActive
                          ? 'bg-cyan-600 text-white shadow-sm'
                          : 'bg-white hover:bg-cyan-100 text-slate-700 border border-cyan-200'
                        }`}
                    >
                      <span>
                        #{idx + 1} {it.productName || `Mặt hàng ${idx + 1}`}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md font-black ${isActive ? 'bg-cyan-800 text-white' : 'bg-cyan-100 text-cyan-900'
                          }`}
                      >
                        {selectedCount} Ô
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Status Indicator */}
              <div className="shrink-0">
                {currentSelectedBins.length > 0 ? (
                  <span className="bg-cyan-100 text-cyan-900 text-[11px] font-black px-2.5 py-1 rounded-xl border border-cyan-300 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-cyan-700" /> Đã chọn {currentSelectedBins.length} ô
                  </span>
                ) : (
                  <span className="bg-slate-100 text-slate-600 text-[11px] font-bold px-2.5 py-1 rounded-xl border border-slate-200 flex items-center gap-1">
                    Chưa chọn ô
                  </span>
                )}
              </div>
            </div>

            {/* 2. Rack Selection Tabs */}
            <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Chọn Dãy Kệ:</span>
                {racksTopology.map((rk) => (
                  <button
                    key={rk.rackId}
                    type="button"
                    onClick={() => setActiveRackId(rk.rackId)}
                    className={`px-3 py-1 rounded-xl text-xs font-extrabold transition cursor-pointer ${activeRackId === rk.rackId ? 'bg-cyan-700 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    {rk.rackName}
                  </button>
                ))}
              </div>

              <div className="text-[11px] font-bold text-cyan-900 bg-cyan-100/70 px-2.5 py-0.5 rounded-lg border border-cyan-200">
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

                  // 2. Draft slot locks from OTHER orders / concurrent sessions
                  const activeDraftLocks = getActiveDraftSlotLocks(tabId || orderNo);
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

                  return map;
                })()}
                mode="select"
                isOutbound={mode === 'OUTBOUND_TRANSFER' || mode === 'STOCKTAKE'}
                maxBinsAllowed={Math.max(1, Math.ceil(((items.find((i) => i.rowId === activeRowId) || items[0])?.qty || 1) / 100))}
                orderItems={items}
                selectedBinsMap={selectedBinsMap}
                activeRowId={activeRowId}
                onSelectBin={(fullBinCode) => {
                  toggleBinSelection({ binCode: fullBinCode, cellCode: fullBinCode } as any);
                }}
                onUpdateBinCapacity={handleUpdateBinCapacity}
              />
            </div>

            {/* Footer Summary & Action Buttons */}
            <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
                <span className="text-slate-500">{mode === 'OUTBOUND_TRANSFER' ? 'Các Ô đang chọn xuất:' : 'Các Ô đang chọn nhập:'}</span>
                <span className="text-cyan-900 font-black bg-cyan-100 px-2.5 py-1 rounded-lg border border-cyan-300">
                  {currentSelectedBins.length > 0 ? currentSelectedBins.join(', ') : 'Chưa chọn ô nào'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSelections}
                  className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-xs font-black text-white tracking-wide shadow-md transition cursor-pointer active:scale-95 flex items-center gap-2"
                >
                  Lưu
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
