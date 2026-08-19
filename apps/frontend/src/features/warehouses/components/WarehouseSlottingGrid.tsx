import React, { useState, useEffect, useMemo } from 'react';
import {
  Boxes,
  Package,
  CheckCircle2,
  Check,
  AlertCircle,
  Sparkles,
  Info,
  Calendar,
  Building2,
  Settings,
  X,
  Sliders,
} from 'lucide-react';
import {
  SubWarehouse,
  WarehouseRecord,
  getRackLetterPrefix,
  calculateGlobalShelfIndex,
} from '../../../shared/utils/warehouseAssignments';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api';

export type BinOccupiedInfo = {
  totalPhysical: number;
  allocated: number;
  productsCount: number;
  productName?: string;
  sku?: string;
  supplierName?: string;
  inboundDate?: string;
  orderCode?: string;
  unit?: string;
};

export type BinGoodsDetail = {
  binCode: string;
  productName: string;
  sku: string;
  quantity: number;
  allocated: number;
  supplierName: string;
  inboundDate: string;
  orderCode: string;
  unit: string;
};

export interface WarehouseSlottingGridProps {
  warehouse: WarehouseRecord | null;
  activeZoneId?: string;
  activeRackId?: string;
  selectedBinCodes?: string[];
  suggestedBinCodes?: string[];
  otherItemsBinsMap?: Record<string, string | { label: string; occupancyPct?: number }>;
  orderItems?: any[];
  selectedBinsMap?: Record<string, string[]>;
  onSelectBin?: (binCode: string, binInfo: any) => void;
  onBinClick?: (binCode: string, customConfig: any, occupiedInfo: BinOccupiedInfo | null) => void;
  onUpdateBinCapacity?: (binCode: string, occupancyPct: number, notes?: string) => void;
  mode?: 'view' | 'select'; // 'view' for Edit Warehouse, 'select' for Order picking
  readOnly?: boolean;
}

export function normalizeBinKey(code: string): string {
  if (!code) return '';
  const cleanCode = code.toString().split('(')[0].trim();
  return cleanCode
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Single Source of Truth to load occupied bins for a specific warehouse
 */
export async function fetchWarehouseOccupiedBins(
  warehouseCode?: string,
  warehouseId?: string
): Promise<{
  occupiedMap: Map<string, BinOccupiedInfo>;
  detailsMap: Map<string, BinGoodsDetail>;
}> {
  const map = new Map<string, BinOccupiedInfo>();
  const dMap = new Map<string, BinGoodsDetail>();

  try {
    const headers = { Authorization: `Bearer ${localStorage.getItem('token') || ''}` };
    const currentWhCode = warehouseCode ? warehouseCode.trim().toUpperCase() : '';
    const currentWhId = warehouseId ? warehouseId.toLowerCase() : '';

    if (currentWhCode && localStorage.getItem(`cleared_warehouse_goods_${currentWhCode}`) === 'true') {
      return { occupiedMap: map, detailsMap: dMap };
    }

    // 1. Fetch real physical inventory balances from CSDL
    const res = await fetch(`${API_BASE_URL}/inventory/balances`, { headers }).catch(() => null);
    if (res && res.ok) {
      const balances: any[] = await res.json();
      balances.forEach((b) => {
        const bWhId = String(b.warehouseId || b.warehouse?.id || '').toLowerCase();
        const bWhCode = String(b.warehouseCode || b.warehouse?.code || '').trim().toUpperCase();

        // STRICT FILTER: Must belong to target warehouse
        if (currentWhId && bWhId && bWhId !== currentWhId) return;
        if (currentWhCode && bWhCode && bWhCode !== currentWhCode) return;

        const lc = String(b.locationCode || '').trim();
        const physical = Number(b.totalPhysical || b.available || 0);
        const allocated = Number(b.allocated || 0);

        if (lc && (physical > 0 || allocated > 0)) {
          // Reject un-scoped bare short codes (e.g. "D1") without hyphen/zone context
          const isFullKey = lc.includes('-') || lc.length > 5;
          if (!isFullKey) return;

          const info: BinOccupiedInfo = {
            totalPhysical: physical || 1,
            allocated,
            productsCount: 1,
            productName: b.product?.name || b.productName || 'Sản phẩm tồn kho',
            sku: b.product?.internalSku || b.product?.sku || b.sku || 'SKU-001',
            supplierName: b.product?.supplier || b.supplierName || 'Nhà cung cấp',
            inboundDate: b.updatedAt
              ? new Date(b.updatedAt).toLocaleDateString('vi-VN') +
                ' ' +
                new Date(b.updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
              : 'Hôm nay',
            orderCode: b.orderCode || b.stockInOrderCode || 'TỒN-KHO',
            unit: b.product?.unit || 'Cái',
          };

          map.set(lc, info);
          const norm = normalizeBinKey(lc);
          if (norm) map.set(norm, info);

          const detail: BinGoodsDetail = {
            binCode: lc,
            productName: info.productName!,
            sku: info.sku!,
            quantity: physical || allocated || 1,
            allocated: info.allocated,
            supplierName: info.supplierName!,
            inboundDate: info.inboundDate!,
            orderCode: info.orderCode!,
            unit: info.unit!,
          };
          dMap.set(lc, detail);
          if (norm) dMap.set(norm, detail);
        }
      });
    }

    // 2. Fetch stock-in orders history (ONLY unconfirmed DRAFT/PENDING orders - completed stock is tracked via inventory balances)
    const inRes = await fetch(`${API_BASE_URL}/inbound/stock-in-orders`, { headers }).catch(() => null);
    if (inRes && inRes.ok) {
      const orders: any[] = await inRes.json();
      orders.forEach((ord) => {
        const isPendingDraft = ord.status === 'DRAFT' || ord.status === 'PENDING' || ord.status === 'IN_PROGRESS';
        if (!isPendingDraft) return;

        const oWhId = String(ord.warehouseId || ord.warehouse?.id || '').toLowerCase();
        const oWhCode = String(ord.warehouseCode || ord.warehouse?.code || '').trim().toUpperCase();

        // STRICT FILTER: Must belong to target warehouse
        if (currentWhId && oWhId && oWhId !== currentWhId) return;
        if (currentWhCode && oWhCode && oWhCode !== currentWhCode) return;

        const orderCode = ord.code || ord.orderNumber || 'NK-ORDER';
        const supplierName = ord.supplierName || ord.supplier?.name || 'Nhà cung cấp';
        const inboundDate = ord.createdAt
          ? new Date(ord.createdAt).toLocaleDateString('vi-VN') +
            ' ' +
            new Date(ord.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
          : 'Hôm nay';

        (ord.details || ord.items || []).forEach((item: any) => {
          const pName = item.productName || item.product?.name || 'Sản phẩm nhập kho';
          const pSku = item.sku || item.product?.sku || 'SKU-001';
          const pQty = Number(item.qty || item.quantity || 1);
          const pUnit = item.unit || 'Cái';

          let bins: string[] = item.assignedBins || [];
          if (bins.length === 0 && item.locationBin)
            bins = item.locationBin.split(',').map((s: string) => s.trim());
          if (bins.length === 0 && item.note) {
            const match = item.note.match(/\[Vị trí Ô:\s*([^\]]+)\]/);
            if (match) bins = match[1].split(',').map((s: string) => s.trim());
          }

          bins.forEach((bCode) => {
            if (!bCode) return;
            const cleanBCode = bCode.trim();

            const isFullKey = cleanBCode.includes('-') || cleanBCode.length > 5;
            if (!isFullKey) return;

            const info: BinOccupiedInfo = {
              totalPhysical: pQty,
              allocated: 0,
              productsCount: 1,
              productName: pName,
              sku: pSku,
              supplierName,
              inboundDate,
              orderCode,
              unit: pUnit,
            };
            map.set(cleanBCode, info);
            const norm = normalizeBinKey(cleanBCode);
            if (norm) map.set(norm, info);

            const detail: BinGoodsDetail = {
              binCode: cleanBCode,
              productName: pName,
              sku: pSku,
              quantity: pQty,
              allocated: 0,
              supplierName,
              inboundDate,
              orderCode,
              unit: pUnit,
            };
            dMap.set(cleanBCode, detail);
            if (norm) dMap.set(norm, detail);
          });
        });
      });
    }
  } catch (err) {
    console.error('Error in fetchWarehouseOccupiedBins:', err);
  }

  return { occupiedMap: map, detailsMap: dMap };
}

export const WarehouseSlottingGrid: React.FC<WarehouseSlottingGridProps> = ({
  warehouse,
  activeZoneId: propZoneId,
  activeRackId: propRackId,
  selectedBinCodes = [],
  suggestedBinCodes = [],
  otherItemsBinsMap = {},
  orderItems = [],
  selectedBinsMap = {},
  onSelectBin,
  onBinClick,
  onUpdateBinCapacity,
  mode = 'view',
  readOnly = false,
}) => {
  const [occupiedMap, setOccupiedMap] = useState<Map<string, BinOccupiedInfo>>(new Map());
  const [detailsMap, setDetailsMap] = useState<Map<string, BinGoodsDetail>>(new Map());
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [selectedRackId, setSelectedRackId] = useState<string>('');
  const [editingBinConfig, setEditingBinConfig] = useState<{
    binCode: string;
    shortCode: string;
    currentPct: number;
  } | null>(null);
  const [inputPctVal, setInputPctVal] = useState<number>(0);
  const [isAddMode, setIsAddMode] = useState<boolean>(true);
  const [editableBinItems, setEditableBinItems] = useState<Array<{ rowId?: string; productName: string; qty: number; occupancyPct: number }>>([]);

  useEffect(() => {
    if (!editingBinConfig) return;
    const binShortCode = editingBinConfig.shortCode;
    const fullBinCode = editingBinConfig.binCode;
    const normTarget = normalizeBinKey(fullBinCode);

    const assigned: Array<{ rowId: string; productName: string; qty: number; occupancyPct: number }> = [];

    if (orderItems && orderItems.length > 0) {
      let allocatedSoFar = 0;

      orderItems.forEach((it: any, idx: number) => {
        const rowId = it.rowId || String(idx);
        const bList = selectedBinsMap ? selectedBinsMap[rowId] || [] : [];

        const matchedBinStr = bList.find((b: string) => {
          const normB = normalizeBinKey(b);
          return normB === normTarget || b.startsWith(fullBinCode) || b.endsWith(binShortCode);
        });

        if (matchedBinStr) {
          let itemPct = 0;
          const match = matchedBinStr.match(/\((\d+)%\)/);
          if (match) {
            itemPct = Number(match[1]);
          } else {
            itemPct = Math.max(0, 100 - allocatedSoFar);
          }

          itemPct = Math.min(100, Math.max(0, itemPct));
          allocatedSoFar += itemPct;

          assigned.push({
            rowId,
            productName: it.productName || `Hàng hóa #${idx + 1}`,
            qty: it.qty && Number(it.qty) > 0 ? Number(it.qty) : 0,
            occupancyPct: itemPct,
          });
        }
      });
    }

    if (assigned.length === 0) {
      const firstItem = orderItems && orderItems.length > 0 ? orderItems[0] : null;
      assigned.push({
        rowId: firstItem?.rowId || 'row-0',
        productName: firstItem?.productName || 'Quần tây nam',
        qty: firstItem?.qty && Number(firstItem.qty) > 0 ? Number(firstItem.qty) : 0,
        occupancyPct: editingBinConfig.currentPct > 0 ? editingBinConfig.currentPct : 100,
      });
    }

    setEditableBinItems(assigned);
  }, [editingBinConfig, orderItems, selectedBinsMap]);

  const handleSaveBinPct = (binCode: string, pct: number) => {
    const currentPct = editingBinConfig?.currentPct || 0;
    const addedOrDirect = Math.min(100, Math.max(0, Number(pct) || 0));
    const finalPct = isAddMode && currentPct > 0 ? Math.min(100, currentPct + addedOrDirect) : addedOrDirect;
    if (onUpdateBinCapacity) {
      onUpdateBinCapacity(binCode, finalPct);
    }
    setEditingBinConfig(null);
  };

  const subWarehouses = warehouse?.subWarehouses || [];
  const whCode = warehouse?.code ? warehouse.code.trim().toUpperCase() : 'KH';

  // Synchronize active zone & rack
  useEffect(() => {
    if (propZoneId) {
      setSelectedZoneId(propZoneId);
    } else if (subWarehouses.length > 0 && !selectedZoneId) {
      setSelectedZoneId(subWarehouses[0].id);
    }
  }, [propZoneId, subWarehouses]);

  const activeZone = useMemo(
    () => subWarehouses.find((z) => z.id === selectedZoneId) || subWarehouses[0],
    [subWarehouses, selectedZoneId]
  );

  const racks = useMemo(() => {
    if (!activeZone) return [];
    if (activeZone.racks && activeZone.racks.length > 0) return activeZone.racks;
    const count = activeZone.racksCount || 4;
    return Array.from({ length: count }, (_, i) => ({
      id: `rack-${i + 1}`,
      rackCode: `R${String(i + 1).padStart(2, '0')}`,
      shelvesCount: activeZone.shelvesPerRack || 4,
      verticalPartitions: activeZone.binsPerShelf || 4,
      customBins: {},
    }));
  }, [activeZone]);

  useEffect(() => {
    if (propRackId) {
      setSelectedRackId(propRackId);
    } else if (racks.length > 0 && !selectedRackId) {
      setSelectedRackId(racks[0].id);
    }
  }, [propRackId, racks]);

  // Load occupancy data from CSDL for this warehouse
  useEffect(() => {
    let isMounted = true;
    fetchWarehouseOccupiedBins(warehouse?.code, warehouse?.id).then(({ occupiedMap: oMap, detailsMap: dMap }) => {
      if (isMounted) {
        setOccupiedMap(oMap);
        setDetailsMap(dMap);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [warehouse?.code, warehouse?.id]);

  const activeRack = useMemo(
    () => racks.find((r) => r.id === selectedRackId || r.rackCode === selectedRackId) || racks[0],
    [racks, selectedRackId]
  );

  const getOccupiedInfo = (fullBinCode: string, binCodeShort: string, rackCode: string) => {
    if (!occupiedMap || occupiedMap.size === 0) return null;

    if (occupiedMap.has(fullBinCode)) return occupiedMap.get(fullBinCode);

    const normKey = normalizeBinKey(fullBinCode);
    if (normKey && occupiedMap.has(normKey)) return occupiedMap.get(normKey);

    const currentWhNorm = normalizeBinKey(whCode);
    const currentZoneNorm = activeZone?.code ? normalizeBinKey(activeZone.code) : '';
    const normRack = normalizeBinKey(rackCode);
    const normCell = normalizeBinKey(binCodeShort);

    for (const [key, val] of occupiedMap.entries()) {
      const normK = normalizeBinKey(key);
      if (!normK) continue;
      if (
        currentWhNorm &&
        currentZoneNorm &&
        normRack &&
        normCell &&
        normK.includes(currentWhNorm) &&
        normK.includes(currentZoneNorm) &&
        normK.includes(normRack) &&
        normK.endsWith(normCell)
      ) {
        return val;
      }
    }
    return null;
  };

  if (!warehouse || subWarehouses.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
        <Boxes className="h-10 w-10 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
          Chưa cấu hình phân khu & kệ cho kho hàng này.
        </p>
      </div>
    );
  }

  const selectedSet = new Set(selectedBinCodes.map(normalizeBinKey));
  const suggestedSet = new Set(suggestedBinCodes.map(normalizeBinKey));

  return (
    <div className="space-y-4">
      {/* ZONE & RACK SELECTOR HEADERS */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100/80 dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
        {/* Zones Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5 px-1">
            <Building2 className="h-4 w-4 text-cyan-600" /> Phân khu:
          </span>
          {subWarehouses.map((z) => {
            const isActive = z.id === selectedZoneId;
            return (
              <button
                key={z.id}
                type="button"
                onClick={() => setSelectedZoneId(z.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-cyan-600 text-white shadow-md'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-cyan-50 dark:hover:bg-slate-700'
                }`}
              >
                {z.name || z.code}
              </button>
            );
          })}
        </div>

        {/* Racks Tabs */}
        {racks.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-xs font-bold text-slate-400 px-1">Dãy kệ:</span>
            {racks.map((rk) => {
              const isActive = rk.id === selectedRackId || rk.rackCode === selectedRackId;
              return (
                <button
                  key={rk.id}
                  type="button"
                  onClick={() => setSelectedRackId(rk.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                    isActive
                      ? 'bg-slate-800 text-cyan-300 dark:bg-cyan-950 dark:text-cyan-200 border border-cyan-500/50'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {rk.rackCode}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* RACK GRID DISPLAY */}
      {activeRack && (() => {
        const shelvesCount = activeRack.shelvesCount || activeZone?.shelvesPerRack || 4;
        const baysCount = Math.max(1, (activeRack.verticalPartitions || activeZone?.binsPerShelf || 4) - 1);
        const rackCode = activeRack.rackCode || 'R01';

        return (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-cyan-900/50 pb-3">
              <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 uppercase tracking-wide">
                <Boxes className="h-4.5 w-4.5 text-[#197e96]" />
                Dãy Kệ {rackCode} ({activeZone?.name || activeZone?.code})
              </h4>
              <span className="text-xs font-black text-[#1b6b80] dark:text-cyan-400 bg-cyan-50/80 dark:bg-cyan-950 px-3 py-1 rounded-full border border-cyan-200/80 dark:border-cyan-800 shadow-2xs">
                {shelvesCount} Tầng x {baysCount} Ô = {shelvesCount * baysCount} Vị Trí
              </span>
            </div>

            <div className="space-y-3">
              {Array.from({ length: shelvesCount })
                .map((_, idx) => shelvesCount - idx) // Top shelf first
                .map((shelfNum) => {
                  const globalShelfIdx = calculateGlobalShelfIndex(
                    subWarehouses,
                    activeZone?.id || '',
                    activeRack.id,
                    shelfNum
                  );
                  const shelfPrefix = getRackLetterPrefix(globalShelfIdx);

                  return (
                    <div
                      key={`shelf-${shelfNum}-${shelfPrefix}`}
                      className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-2 mb-2">
                        <span className="px-3 py-1 rounded-full bg-[#1b6b80] dark:bg-cyan-900 text-white font-black text-xs shadow-2xs tracking-wide">
                          Tầng {shelfPrefix}
                        </span>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                          {baysCount} Ô chứa ({shelfPrefix}1 đến {shelfPrefix}{baysCount})
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                        {Array.from({ length: baysCount }).map((_, bIdx) => {
                          const cellNum = bIdx + 1;
                          const binCodeShort = `${shelfPrefix}${cellNum}`;
                          const zoneCodeStr = activeZone?.code || 'ZONE';
                          const fullBinCode = `${whCode}-${zoneCodeStr}-${rackCode}-${binCodeShort}`;
                          const normFull = normalizeBinKey(fullBinCode);

                          const occupiedInfo = getOccupiedInfo(fullBinCode, binCodeShort, rackCode);
                          const hasGoods = Boolean(
                            occupiedInfo && (occupiedInfo.totalPhysical > 0 || occupiedInfo.allocated > 0)
                          );
                          const isSelected = selectedSet.has(normFull);
                          const isSuggested = suggestedSet.has(normFull);
                          const rawOtherEntry = otherItemsBinsMap
                            ? otherItemsBinsMap[fullBinCode] || otherItemsBinsMap[binCodeShort] || otherItemsBinsMap[normFull]
                            : null;

                          let otherItemName: string | null = null;
                          let otherItemPctFromLock: number | undefined = undefined;

                          if (typeof rawOtherEntry === 'string') {
                            otherItemName = rawOtherEntry;
                          } else if (rawOtherEntry && typeof rawOtherEntry === 'object') {
                            otherItemName = rawOtherEntry.label;
                            otherItemPctFromLock = rawOtherEntry.occupancyPct;
                          }

                          const rawCustomConfig =
                            (activeRack.customBins as any)?.[fullBinCode] ||
                            (activeRack.customBins as any)?.[binCodeShort] ||
                            (normFull ? (activeRack.customBins as any)?.[normFull] : null);
                          const customConfig = rawCustomConfig && Number(rawCustomConfig.occupancyPct || 0) > 0 ? rawCustomConfig : null;

                          const matchingSelectedCode = selectedBinCodes.find((s) => normalizeBinKey(s) === normFull);
                          let embeddedPct: number | undefined;
                          if (matchingSelectedCode) {
                            const match = matchingSelectedCode.match(/\((\d+)%\)/);
                            if (match) embeddedPct = Number(match[1]);
                          }

                          const customPct = customConfig?.occupancyPct !== undefined && customConfig?.occupancyPct !== null ? Number(customConfig.occupancyPct) : undefined;

                          let occupancyPct = 0;
                          let isOtherItemFull = false;
                          let otherOccupancyPct = 0;

                          if (hasGoods) {
                            const qty = occupiedInfo?.totalPhysical || occupiedInfo?.allocated || 1;
                            const maxCap = customConfig?.maxWeight || (activeRack as any).defaultBinMaxWeight || 500;
                            const calculatedFromQty = Math.min(100, Math.max(10, Math.round((qty / maxCap) * 100)));
                            occupancyPct = customPct !== undefined
                              ? customPct
                              : (embeddedPct !== undefined ? embeddedPct : calculatedFromQty);
                          } else if (isSelected) {
                            occupancyPct = embeddedPct !== undefined
                              ? embeddedPct
                              : (customPct !== undefined ? customPct : 100);
                          } else if (otherItemName) {
                            otherOccupancyPct = otherItemPctFromLock !== undefined ? Number(otherItemPctFromLock) : (customPct !== undefined ? customPct : 100);
                            occupancyPct = otherOccupancyPct;
                            if (otherOccupancyPct >= 100) {
                              isOtherItemFull = true;
                            }
                          } else if (customPct !== undefined && customPct > 0) {
                            occupancyPct = customPct;
                          } else {
                            occupancyPct = 0;
                          }

                          const isFull = (hasGoods && occupancyPct >= 100) || isOtherItemFull || (isSelected && occupancyPct >= 100);
                          const isPartiallyOccupied = occupancyPct > 0 && occupancyPct < 100;

                          return (
                            <div
                              key={fullBinCode}
                              onClick={() => {
                                if (isOtherItemFull) return;
                                if (mode === 'select') {
                                  if (onSelectBin) {
                                    onSelectBin(fullBinCode, {
                                      binCode: fullBinCode,
                                      shortCode: binCodeShort,
                                      zoneCode: zoneCodeStr,
                                      rackCode,
                                      occupancyPct: occupancyPct,
                                      maxWeight: customConfig?.maxWeight || (activeRack as any).defaultBinMaxWeight || 500,
                                      notes: customConfig?.notes || '',
                                    });
                                  }
                                } else if (onBinClick) {
                                  onBinClick(fullBinCode, customConfig, occupiedInfo || null);
                                }
                              }}
                              className={`p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-between gap-1 shadow-2xs relative overflow-hidden aspect-square min-h-[84px] sm:min-h-[92px] ${
                                isOtherItemFull
                                  ? 'border-2 border-slate-300 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-900/90 text-slate-400 dark:text-slate-500 opacity-60 cursor-not-allowed select-none'
                                  : isSelected
                                    ? 'border-2 border-[#197e96] bg-cyan-50/90 dark:bg-cyan-950/80 shadow-md ring-2 ring-cyan-400/40 font-black scale-[1.01] cursor-pointer'
                                    : isSuggested
                                      ? 'border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-950 dark:text-emerald-100 shadow-sm ring-2 ring-emerald-300/60 font-black cursor-pointer'
                                      : isFull || hasGoods
                                        ? 'border-2 border-[#197e96] bg-cyan-50/90 dark:bg-cyan-950/90 text-cyan-950 dark:text-cyan-100 shadow-2xs cursor-pointer font-black'
                                        : isPartiallyOccupied
                                          ? 'border-2 border-cyan-500 bg-cyan-50/90 text-cyan-950 font-black cursor-pointer hover:border-cyan-600'
                                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-cyan-500 cursor-pointer'
                              }`}
                            >
                              {/* Visual Occupancy Fill Overlay (Height = occupancyPct %) */}
                              {occupancyPct > 0 && (
                                <div
                                  className={`absolute bottom-0 left-0 right-0 transition-all duration-300 pointer-events-none z-0 ${
                                    isOtherItemFull
                                      ? 'bg-slate-300/60 dark:bg-slate-800/60'
                                      : (isSelected || isFull || hasGoods || isPartiallyOccupied)
                                        ? 'bg-[#197e96]/30 dark:bg-[#197e96]/50'
                                        : 'bg-cyan-100/90 dark:bg-cyan-900/60'
                                  }`}
                                  style={{ height: `${occupancyPct}%` }}
                                />
                              )}

                              {/* Header: Cell Code & Top-Right Icon Buttons */}
                              <div className="w-full flex items-center justify-between gap-1 z-10">
                                <span
                                  className={`text-xs font-black tracking-tight ${
                                    isOtherItemFull
                                      ? 'text-slate-400 dark:text-slate-500'
                                      : occupancyPct >= 80 && (isSelected || isFull)
                                        ? 'text-cyan-950 dark:text-cyan-100 drop-shadow-xs'
                                        : 'text-cyan-950 dark:text-cyan-300'
                                  }`}
                                >
                                  Ô {binCodeShort}
                                </span>

                                {/* Unified Top-Right Icon Buttons */}
                                <div className="flex items-center gap-1">
                                  {onUpdateBinCapacity && !readOnly && !isOtherItemFull && (
                                    <button
                                      type="button"
                                      title="Cài đặt % độ chứa hoặc Số lượng ô"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const curr = occupancyPct || 0;
                                        setEditingBinConfig({
                                          binCode: fullBinCode,
                                          shortCode: binCodeShort,
                                          currentPct: curr,
                                        });
                                        setInputPctVal(curr);
                                        setIsAddMode(false);
                                      }}
                                      className={`p-1 rounded-md transition cursor-pointer flex items-center justify-center border shadow-xs ${
                                        isSelected
                                          ? 'bg-white hover:bg-cyan-50 text-[#197e96] border-cyan-200'
                                          : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border-cyan-200/80 dark:bg-slate-800 dark:text-cyan-300 dark:border-slate-700'
                                      }`}
                                    >
                                      <Settings className="h-3.5 w-3.5" />
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    disabled={readOnly || isOtherItemFull || (mode === 'select' && isFull)}
                                    title={isOtherItemFull ? `Đã đầy 100% (${otherItemName})` : isSelected ? 'Đã chọn ô' : 'Bấm để chọn ô'}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isOtherItemFull) return;
                                      if (mode === 'select') {
                                        if (!isFull && onSelectBin) {
                                          onSelectBin(fullBinCode, {
                                            binCode: fullBinCode,
                                            shortCode: binCodeShort,
                                            zoneCode: zoneCodeStr,
                                            rackCode,
                                            occupancyPct: occupancyPct,
                                            maxWeight: customConfig?.maxWeight || (activeRack as any).defaultBinMaxWeight || 500,
                                            notes: customConfig?.notes || '',
                                          });
                                        }
                                      } else if (onBinClick) {
                                        onBinClick(fullBinCode, customConfig, occupiedInfo || null);
                                      }
                                    }}
                                    className={`p-1 rounded-md transition flex items-center justify-center border shadow-xs ${
                                      isOtherItemFull
                                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700 opacity-50 cursor-not-allowed'
                                        : isSelected
                                          ? 'bg-[#197e96] text-white border-[#197e96] cursor-pointer'
                                          : isFull
                                            ? 'bg-cyan-700 text-white border-cyan-700 opacity-90 cursor-pointer'
                                            : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border-cyan-200/80 dark:bg-slate-800 dark:text-cyan-300 dark:border-slate-700 cursor-pointer'
                                    }`}
                                  >
                                    {isSelected ? (
                                      <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                    ) : (
                                      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* Shelf Subtitle */}
                              <span
                                className={`text-[9px] font-bold block truncate z-10 ${
                                  isOtherItemFull
                                    ? 'text-slate-400 dark:text-slate-500'
                                    : 'text-cyan-900/80 dark:text-cyan-300'
                                }`}
                              >
                                {rackCode} - Tầng {shelfPrefix}
                              </span>

                              {/* Bottom Status Pill */}
                              <div className="w-full z-10">
                                {isSelected ? (
                                  <span className="text-[9px] font-black bg-[#197e96] text-white px-1.5 py-0.5 rounded-md w-full block truncate shadow-2xs tracking-wide">
                                    CHỌN ({occupancyPct > 0 ? occupancyPct : 100}%)
                                  </span>
                                ) : isOtherItemFull ? (
                                  <span className="text-[8.5px] font-black bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 px-1 py-0.5 rounded-md w-full block truncate shadow-2xs">
                                    FULL (100% - {otherItemName})
                                  </span>
                                ) : otherItemName ? (
                                  <span className="text-[8.5px] font-black bg-cyan-100 text-cyan-950 border border-cyan-300 px-1 py-0.5 rounded-md w-full block truncate shadow-2xs">
                                    {otherItemName} (Dư {100 - otherOccupancyPct}%)
                                  </span>
                                ) : isSuggested ? (
                                  <span className="text-[9px] font-black bg-emerald-600 text-white px-1.5 py-0.5 rounded-md w-full block truncate shadow-2xs">
                                    GỢI Ý AI
                                  </span>
                                ) : (hasGoods || isFull) && occupancyPct >= 100 ? (
                                  <span className="text-[9px] font-black bg-[#197e96] text-white px-1 py-0.5 rounded-md w-full block truncate shadow-2xs">
                                    ĐÃ XẾP (100% - FULL)
                                  </span>
                                ) : isPartiallyOccupied || (hasGoods && occupancyPct < 100) ? (
                                  <span className="text-[8.5px] font-black bg-cyan-100 text-cyan-950 border border-cyan-300 px-1 py-0.5 rounded-md w-full block truncate shadow-2xs">
                                    ĐÃ XẾP ({occupancyPct}%)
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-extrabold text-slate-500 bg-slate-100/90 dark:bg-slate-800/80 px-1.5 py-0.5 rounded-md w-full block truncate border border-slate-200/60">
                                    Ô Trống ({customConfig ? `${customConfig.maxWeight}kg` : `${(activeRack as any).defaultBinMaxWeight || 500}kg`})
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        );
      })()}

      {/* Mini Capacity Percentage / Quantity Configuration Dialog */}
      {editingBinConfig && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-3 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border-2 border-cyan-500 rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <h5 className="text-xs font-black text-cyan-900 dark:text-cyan-100 flex items-center gap-2 uppercase tracking-wide">
                <Settings className="h-4.5 w-4.5 text-cyan-600" />
                Cài Đặt Độ Chứa / Số Lượng Ô {editingBinConfig.shortCode}
              </h5>
              <button
                type="button"
                onClick={() => setEditingBinConfig(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Current Occupancy Status Banner */}
            <div className="bg-cyan-50 dark:bg-cyan-950/70 p-2.5 rounded-xl border border-cyan-200/80 text-xs">
              <div className="flex items-center justify-between font-bold text-cyan-950 dark:text-cyan-100">
                <span>Trạng thái ô hiện tại:</span>
                <span className="font-black text-cyan-700 dark:text-cyan-300">
                  {editingBinConfig.currentPct}% dung tích
                </span>
              </div>
              <p className="text-[10px] text-cyan-800/80 dark:text-cyan-300/80 font-medium mt-0.5">
                {editingBinConfig.currentPct > 0
                  ? `Đã chứa: ${editingBinConfig.currentPct}% (Còn trống: ${100 - editingBinConfig.currentPct}%)`
                  : 'Ô đang trống 100%'}
              </p>
            </div>

            {/* Item-by-Item Occupancy Table with Scrollbar */}
            <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs my-2 custom-scrollbar">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-cyan-50 dark:bg-cyan-950 text-cyan-950 dark:text-cyan-200 font-bold border-b border-cyan-200 dark:border-slate-700 shadow-2xs">
                  <tr>
                    <th className="p-2.5">Tên hàng hóa</th>
                    <th className="p-2.5 text-right w-24">Số lượng</th>
                    <th className="p-2.5 text-right w-24">Lưu trữ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900 font-medium">
                  {editableBinItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-cyan-50/50 dark:hover:bg-slate-800/50 transition">
                      <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">
                        {item.productName}
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          min={0}
                          value={item.qty > 0 ? item.qty : ''}
                          placeholder="—"
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setEditableBinItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, qty: val } : it))
                            );
                          }}
                          className="w-20 px-2 py-1 text-right text-xs font-bold border border-slate-300 rounded-lg outline-none focus:border-cyan-600 dark:bg-slate-800 dark:text-white"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <div className="relative inline-block w-20">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={item.occupancyPct !== undefined && item.occupancyPct !== null ? item.occupancyPct : ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === '') {
                                setEditableBinItems((prev) =>
                                  prev.map((it, i) => (i === idx ? { ...it, occupancyPct: '' as any } : it))
                                );
                                return;
                              }
                              const parsed = parseInt(raw, 10);
                              const val = Number.isNaN(parsed) ? 0 : Math.min(100, Math.max(0, parsed));
                              setEditableBinItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, occupancyPct: val } : it))
                              );
                            }}
                            onBlur={() => {
                              if (item.occupancyPct === ('' as any) || item.occupancyPct === undefined || item.occupancyPct === null) {
                                setEditableBinItems((prev) =>
                                  prev.map((it, i) => (i === idx ? { ...it, occupancyPct: 0 } : it))
                                );
                              }
                            }}
                            className="w-full px-2 py-1 pr-5 text-right text-xs font-bold border border-slate-300 rounded-lg outline-none focus:border-cyan-600 dark:bg-slate-800 dark:text-white"
                          />
                          <span className="absolute right-1.5 top-1 text-xs font-black text-slate-400">%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Progressive Item Addition Button when Capacity Remains */}
            {(() => {
              const sumPct = editableBinItems.reduce((acc, curr) => acc + (Number(curr.occupancyPct) || 0), 0);
              const remainingPct = Math.max(0, 100 - sumPct);

              const assignedRowIds = new Set(editableBinItems.map((it) => it.rowId));
              const availableUnassigned = (orderItems || []).filter((it: any, idx: number) => !assignedRowIds.has(it.rowId || String(idx)));

              if (remainingPct > 0 && availableUnassigned.length > 0) {
                return (
                  <div className="mb-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const nextItem = availableUnassigned[0];
                        const nextRowId = nextItem.rowId || String(orderItems.indexOf(nextItem));
                        setEditableBinItems((prev) => [
                          ...prev,
                          {
                            rowId: nextRowId,
                            productName: nextItem.productName || `Mặt hàng #${prev.length + 1}`,
                            qty: nextItem.qty && Number(nextItem.qty) > 0 ? Number(nextItem.qty) : 0,
                            occupancyPct: remainingPct,
                          },
                        ]);
                      }}
                      className="text-[11px] font-bold text-cyan-700 hover:text-cyan-900 dark:text-cyan-300 bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/60 border border-cyan-300 dark:border-cyan-800 px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      + Thêm hàng hóa tiếp theo vào ô này ({remainingPct}% còn trống)
                    </button>
                  </div>
                );
              }
              return null;
            })()}

            {/* Dynamic Calculation Summary Banner */}
            {(() => {
              const sumPct = editableBinItems.reduce((acc, curr) => acc + (Number(curr.occupancyPct) || 0), 0);
              const remainingPct = Math.max(0, 100 - sumPct);
              const isOverCap = sumPct > 100;
              return (
                <div
                  className={`p-2 rounded-xl border text-[11px] font-bold ${
                    isOverCap
                      ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 text-rose-900 dark:text-rose-200'
                      : 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 text-amber-900 dark:text-amber-200'
                  }`}
                >
                  Tổng độ chứa ô ={' '}
                  <strong
                    className={`underline font-black ${
                      isOverCap ? 'text-rose-700 dark:text-rose-300' : 'text-cyan-700 dark:text-cyan-300'
                    }`}
                  >
                    {sumPct}%
                  </strong>{' '}
                  {isOverCap ? `(CẢNH BÁO: VƯỢT QUÁ SỨC CHỨA O ${sumPct - 100}%!)` : `(Còn trống ${remainingPct}%)`}
                </div>
              );
            })()}

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setEditableBinItems((prev) => prev.map((it) => ({ ...it, occupancyPct: 0 })));
                  if (onUpdateBinCapacity) {
                    onUpdateBinCapacity(editingBinConfig.binCode, 0);
                  }
                  setEditingBinConfig(null);
                }}
                className="h-9 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 text-xs font-bold rounded-xl transition cursor-pointer border border-rose-200"
              >
                Reset về 0%
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingBinConfig(null)}
                  className="h-9 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const sumPct = editableBinItems.reduce((acc, curr) => acc + (Number(curr.occupancyPct) || 0), 0);
                    if (sumPct > 100) {
                      alert(`Tổng % độ chứa (${sumPct}%) vượt quá 100%! Vui lòng điều chỉnh lại cho tổng các sản phẩm <= 100%.`);
                      return;
                    }
                    editableBinItems.forEach((item) => {
                      if (item.rowId && onUpdateBinCapacity) {
                        (onUpdateBinCapacity as any)(editingBinConfig.binCode, Number(item.occupancyPct) || 0, undefined, item.rowId);
                      }
                    });
                    setEditingBinConfig(null);
                  }}
                  className="h-9 px-5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5"
                >
                  Lưu cài đặt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
