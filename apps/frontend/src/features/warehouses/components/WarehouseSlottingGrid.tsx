import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  Eye,
} from 'lucide-react';
import {
  SubWarehouse,
  WarehouseRecord,
  getRackLetterPrefix,
  calculateGlobalShelfIndex,
  getActiveDraftSlotLocks,
  parseAssignedBinsFromNote,
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
  occupancyPct?: number;
  isOutbound?: boolean;
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
  occupancyPct?: number;
  isOutbound?: boolean;
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
  activeRowId?: string;
  binQtyMap?: Record<string, number>;
  customQtyBinsMap?: Record<string, boolean>;
  onSelectBin?: (binCode: string, binInfo: any) => void;
  onBinClick?: (
    binCode: string,
    customConfig: any,
    occupiedInfo: BinOccupiedInfo | null,
    goodsList?: BinGoodsDetail[]
  ) => void;
  onUpdateBinCapacity?: (binCode: string, occupancyPct: number, notes?: string, targetRowId?: string, newQty?: number) => void;
  mode?: 'view' | 'select'; // 'view' for Edit Warehouse, 'select' for Order picking
  isOutbound?: boolean;
  maxBinsAllowed?: number;
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
  goodsListMap: Map<string, BinGoodsDetail[]>;
}> {
  const map = new Map<string, BinOccupiedInfo>();
  const dMap = new Map<string, BinGoodsDetail>();
  const gMap = new Map<string, BinGoodsDetail[]>();
  let allStockInOrders: any[] = [];
  let allOutboundOrders: any[] = [];

  try {
    const headers = { Authorization: `Bearer ${localStorage.getItem('token') || ''}` };
    const currentWhCode = warehouseCode ? warehouseCode.trim().toUpperCase() : '';
    const currentWhId = warehouseId ? warehouseId.trim().toLowerCase() : '';

    // If creating a new warehouse, it has 0 inventory balances
    if (!currentWhCode && !currentWhId || currentWhId === 'temp-id' || currentWhId === 'new' || currentWhId.startsWith('wh_new')) {
      return { occupiedMap: map, detailsMap: dMap, goodsListMap: gMap };
    }

    const isWhMatch = (wCode?: string, wId?: string, binCodeStr?: string) => {
      const cCode = String(wCode || '').trim().toUpperCase();
      const cId = String(wId || '').trim().toLowerCase();

      if (!currentWhCode && !currentWhId) return false;
      if (!cCode && !cId) return false;
      if (binCodeStr && currentWhCode && binCodeStr.toUpperCase().includes(currentWhCode)) return true;
      if (currentWhCode && cCode && (cCode === currentWhCode || cCode === `KHO-${currentWhCode}`)) return true;
      if (currentWhId && cId && cId === currentWhId) return true;
      if (currentWhCode && cId && cId === currentWhCode.toLowerCase()) return true;
      if (currentWhId && cCode && cCode === currentWhId.toUpperCase()) return true;
      // Match default system warehouse codes specifically for default warehouses
      if ((currentWhCode === 'KH001' || currentWhCode === 'KHO-TONG' || currentWhId === 'wh-1' || currentWhId === 'wh_default_1') && (cCode === 'KHO-TONG' || cCode === 'KHO' || cCode === 'SPX001' || cCode === 'DEFAULT')) return true;
      if ((currentWhCode === 'KH002' || currentWhCode === 'KHO-HN' || currentWhId === 'wh-2' || currentWhId === 'wh_default_2') && (cCode === 'KH002' || cCode === 'KHO-HN' || cCode.includes('HN'))) return true;
      if ((currentWhCode === 'KH003' || currentWhCode === 'KHO-BD' || currentWhId === 'wh-3') && (cCode === 'KHO-NVL' || cCode === 'KHO-BD')) return true;
      return false;
    };

    if (currentWhCode && localStorage.getItem(`cleared_warehouse_goods_${currentWhCode}`) === 'true') {
      const [testBalRes, testPoRes] = await Promise.all([
        fetch(`${API_BASE_URL}/inventory/balances`, { headers }).catch(() => null),
        fetch(`${API_BASE_URL}/inbound/purchase-orders`, { headers }).catch(() => null),
      ]);
      let hasRealGoodsInBackend = false;
      if (testBalRes && testBalRes.ok) {
        const balData: any[] = await testBalRes.json().catch(() => []);
        if (Array.isArray(balData) && balData.some((b) => isWhMatch(b.warehouseCode || b.warehouse?.code, b.warehouseId || b.warehouse?.id, b.locationCode))) {
          hasRealGoodsInBackend = true;
        }
      }
      if (!hasRealGoodsInBackend && testPoRes && testPoRes.ok) {
        const poData = await testPoRes.json().catch(() => []);
        const poList: any[] = Array.isArray(poData) ? poData : poData.data || [];
        if (poList.some((po) => isWhMatch(po.warehouseCode || po.warehouse?.code, po.warehouseId || po.warehouse?.id))) {
          hasRealGoodsInBackend = true;
        }
      }

      if (hasRealGoodsInBackend) {
        localStorage.removeItem(`cleared_warehouse_goods_${currentWhCode}`);
      } else {
        return { occupiedMap: map, detailsMap: dMap, goodsListMap: gMap };
      }
    }

    const addBinOccupied = (bCode: string, info: BinOccupiedInfo) => {
      if (!bCode) return;
      const rawCode = bCode.trim();
      if (!rawCode) return;

      const pctMatch = rawCode.match(/^([^(]+)\s*\((?:Dư\s*)?(\d+)%\)/i);
      let cleanCode = rawCode.split('(')[0].trim();
      let extractedPct = info.occupancyPct;
      if (pctMatch) {
        cleanCode = pctMatch[1].trim();
        extractedPct = Number(pctMatch[2]);
      } else if (extractedPct === undefined && rawCode.includes('%')) {
        const noteMatch = rawCode.match(/(\d+)%/);
        if (noteMatch) extractedPct = Number(noteMatch[1]);
      }

      if (!cleanCode) return;

      const norm = normalizeBinKey(cleanCode);
      const existing = map.get(cleanCode) || (norm ? map.get(norm) : null);

      let calcPhysical = info.totalPhysical !== undefined ? info.totalPhysical : 1;
      let calcPct = extractedPct !== undefined ? extractedPct : (info.occupancyPct !== undefined ? info.occupancyPct : 100);

      if (info.isOutbound) {
        const exportQty = Math.abs(info.totalPhysical || 0);
        const currentPhysical = existing && existing.totalPhysical !== undefined && existing.totalPhysical > 0 ? existing.totalPhysical : 500;
        const newPhysical = Math.max(0, currentPhysical - exportQty);

        const currentPct = existing && existing.occupancyPct !== undefined && existing.occupancyPct > 0 ? existing.occupancyPct : 100;
        const deductPct = currentPhysical > 0 ? Math.round((exportQty / currentPhysical) * currentPct) : Math.round((exportQty / 500) * 100);
        const newPct = Math.max(0, currentPct - deductPct);

        calcPhysical = newPhysical;
        calcPct = newPct;
      } else if (existing) {
        calcPhysical = Math.max(1, (existing.totalPhysical !== undefined && existing.totalPhysical > 0 ? existing.totalPhysical : 0) + Math.abs(calcPhysical));
        calcPct = Math.min(100, (existing.occupancyPct !== undefined ? existing.occupancyPct : 0) + calcPct);
      }

      const updatedInfo: BinOccupiedInfo = {
        ...info,
        totalPhysical: calcPhysical,
        occupancyPct: calcPct,
        isOutbound: info.isOutbound,
      };

      const short = (cleanCode.split('-').pop() || cleanCode).trim().toUpperCase();
      const normShort = normalizeBinKey(short);

      map.set(cleanCode, updatedInfo);
      if (norm) map.set(norm, updatedInfo);

      const parts = cleanCode.split('-');
      if (parts.length >= 2) {
        const rackPart = parts[parts.length - 2].trim().toUpperCase();
        if (rackPart.startsWith('R') || rackPart.length <= 4) {
          const rackCell = `${rackPart}-${short}`;
          map.set(rackCell, updatedInfo);
          map.set(normalizeBinKey(rackCell), updatedInfo);
        }
      }

      if (cleanCode === short || !cleanCode.includes('-')) {
        if (short) map.set(short, updatedInfo);
        if (normShort) map.set(normShort, updatedInfo);
      }

      const detail: BinGoodsDetail = {
        binCode: cleanCode,
        productName: updatedInfo.productName!,
        sku: updatedInfo.sku!,
        quantity: info.isOutbound ? -Math.abs(info.totalPhysical || 1) : Math.abs(info.totalPhysical || 1),
        allocated: updatedInfo.allocated,
        supplierName: updatedInfo.supplierName!,
        inboundDate: updatedInfo.inboundDate!,
        orderCode: updatedInfo.orderCode!,
        unit: updatedInfo.unit!,
        occupancyPct: extractedPct !== undefined ? extractedPct : (info.occupancyPct !== undefined ? info.occupancyPct : 100),
        isOutbound: updatedInfo.isOutbound,
      };

      dMap.set(cleanCode, detail);
      if (norm) dMap.set(norm, detail);

      const appendGoods = (key: string) => {
        if (!gMap.has(key)) gMap.set(key, []);
        const list = gMap.get(key)!;
        const existingIdx = list.findIndex(
          (x) =>
            x.sku === detail.sku &&
            x.productName === detail.productName &&
            (x.orderCode === detail.orderCode || (!x.orderCode && !detail.orderCode))
        );
        if (existingIdx >= 0) {
          list[existingIdx] = {
            ...list[existingIdx],
            ...detail,
            quantity: detail.quantity,
          };
        } else {
          list.push(detail);
        }
      };
      appendGoods(cleanCode);
      if (norm) appendGoods(norm);

      if (parts.length >= 2) {
        const rackPart = parts[parts.length - 2].trim().toUpperCase();
        if (rackPart.startsWith('R') || rackPart.length <= 4) {
          const rackCell = `${rackPart}-${short}`;
          dMap.set(rackCell, detail);
          dMap.set(normalizeBinKey(rackCell), detail);
          appendGoods(rackCell);
          appendGoods(normalizeBinKey(rackCell));
        }
      }

      const cellMatch = cleanCode.match(/([A-Z][0-9]{1,2})/i);
      if (cellMatch) {
        const cellKey = cellMatch[1].toUpperCase();
        if (cellKey) {
          dMap.set(cellKey, detail);
          appendGoods(cellKey);
        }
      }

      if (cleanCode === short || !cleanCode.includes('-')) {
        if (short) {
          dMap.set(short, detail);
          appendGoods(short);
        }
        if (normShort) {
          dMap.set(normShort, detail);
          appendGoods(normShort);
        }
      }
    };

    // 1. Fetch real physical inventory balances from CSDL
    const res = await fetch(`${API_BASE_URL}/inventory/balances`, { headers }).catch(() => null);
    if (res && res.ok) {
      const balances: any[] = await res.json();
      balances.forEach((b) => {
        const bWhId = String(b.warehouseId || b.warehouse?.id || '').toLowerCase();
        const bWhCode = String(b.warehouseCode || b.warehouse?.code || '').trim().toUpperCase();

        if (!isWhMatch(bWhCode, bWhId, b.locationCode)) return;

        const lc = String(b.locationCode || '').trim();
        const physical = Number(b.totalPhysical || b.available || 0);
        const allocated = Number(b.allocated || 0);

        if (lc && (physical > 0 || allocated > 0)) {
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
            occupancyPct: b.occupancyPct !== undefined ? Number(b.occupancyPct) : (b.occupancy !== undefined ? Number(b.occupancy) : 100),
          };
          addBinOccupied(lc, info);
        }
      });
    }

    // 2. Fetch stock-in and purchase orders history (from API and localStorage)
    try {
      const storedStockInStr = localStorage.getItem('stored_stock_in_orders');
      const localStockInOrders: any[] = storedStockInStr ? JSON.parse(storedStockInStr) : [];
      
      const [apiOrdersRes, poOrdersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/inbound/stock-in-orders`, { headers }).catch(() => null),
        fetch(`${API_BASE_URL}/inbound/purchase-orders`, { headers }).catch(() => null),
      ]);

      allStockInOrders = [];
      if (apiOrdersRes && apiOrdersRes.ok) {
        const apiData = await apiOrdersRes.json();
        const list = Array.isArray(apiData) ? apiData : apiData.data || [];
        allStockInOrders = [...allStockInOrders, ...list];
      }
      if (poOrdersRes && poOrdersRes.ok) {
        const poData = await poOrdersRes.json();
        const poList = Array.isArray(poData) ? poData : poData.data || [];
        poList.forEach((po: any) => {
          if (!allStockInOrders.some((ao: any) => String(ao.id) === String(po.id) || (ao.poNumber && po.poNumber && ao.poNumber === po.poNumber) || (ao.receiptNo && po.receiptNo && ao.receiptNo === po.receiptNo))) {
            allStockInOrders.push(po);
          }
        });
      }
      if (Array.isArray(localStockInOrders) && (!apiOrdersRes?.ok && !poOrdersRes?.ok)) {
        localStockInOrders.forEach((lo: any) => {
          if (!allStockInOrders.some((ao: any) => ao.id === lo.id || (ao.code && lo.code && ao.code === lo.code) || (ao.orderNumber && lo.orderNumber && ao.orderNumber === lo.orderNumber) || (ao.poNumber && lo.poNumber && ao.poNumber === lo.poNumber))) {
            allStockInOrders.push(lo);
          }
        });
      }

      allStockInOrders.forEach((ord) => {
        const oWhId = String(ord.warehouseId || ord.warehouse?.id || '').toLowerCase();
        const oWhCode = String(ord.warehouseCode || ord.warehouse?.code || '').trim().toUpperCase();

        const orderCode = ord.poNumber || ord.receiptNo || ord.code || ord.orderNumber || (ord.id ? `PNK-${String(ord.id).padStart(4, '0')}` : 'NK-ORDER');
        const supplierName = ord.supplierName || ord.supplier?.name || ord.supplier || 'Nhà cung cấp';
        const inboundDate = ord.createdAt || ord.orderDate
          ? new Date(ord.createdAt || ord.orderDate).toLocaleDateString('vi-VN') +
          ' ' +
          new Date(ord.createdAt || ord.orderDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
          : 'Hôm nay';

        (ord.details || ord.items || []).forEach((item: any) => {
          const pName = item.productName || item.product?.name || item.name || 'Sản phẩm nhập kho';
          const pSku = item.productSku || item.sku || item.product?.sku || item.product?.internalSku || 'SKU-001';
          const pQty = Number(item.receivedQty || item.expectedQty || item.qty || item.quantity || item.requiredQty || item.pickedQty || 1);
          const pUnit = item.unit || item.product?.unit || 'Cái';

          let rawBins: string[] = Array.isArray(item.assignedBins) ? item.assignedBins : [];
          if (rawBins.length === 0 && item.locationBin)
            rawBins = String(item.locationBin).split(',').map((s: string) => s.trim());
          if (rawBins.length === 0 && item.note) {
            rawBins = parseAssignedBinsFromNote(item.note);
          }

          // Deduplicate bin list so duplicate formatting does not divide target qty
          const uniqueBinsMap = new Map<string, string>();
          rawBins.forEach((b) => {
            if (!b) return;
            const cleanCode = b.split('(')[0].trim();
            const normKey = normalizeBinKey(cleanCode);
            if (cleanCode && (!normKey || !uniqueBinsMap.has(normKey))) {
              uniqueBinsMap.set(normKey || cleanCode, b);
            }
          });
          const bins = Array.from(uniqueBinsMap.values());
          const pQtyPerBin = Math.max(1, pQty);

          bins.forEach((bCode) => {
            if (!bCode) return;
            if (!isWhMatch(oWhCode, oWhId, bCode)) return;
            const pctMatch = bCode.match(/\((\d+(?:\.\d+)?)%\)/);
            let itemPct: number = pctMatch ? Number(pctMatch[1]) : (item.occupancyPct !== undefined ? Number(item.occupancyPct) : 100);

            let calcQty = 0;
            const qtyMatch = bCode.match(/\[(\d+(?:\.\d+)?)\s*(?:cái|sp)?\]/);
            if (qtyMatch) {
              calcQty = Number(qtyMatch[1]);
            } else if (bins.length > 0) {
              calcQty = Math.max(1, Math.round(pQty / bins.length));
            } else {
              calcQty = pQtyPerBin;
            }

            const info: BinOccupiedInfo = {
              totalPhysical: calcQty,
              allocated: 0,
              productsCount: 1,
              productName: pName,
              sku: pSku,
              supplierName,
              inboundDate,
              orderCode,
              unit: pUnit,
              occupancyPct: itemPct,
            };
            addBinOccupied(bCode, info);
          });
        });
      });
    } catch (e) {
      console.error('Error loading stock-in orders for bins:', e);
    }

    // 3. Fetch transfer orders (from API & localStorage)
    const transferRes = await fetch(`${API_BASE_URL}/delivery/transfer-orders`, { headers }).catch(() => null);
    let transferOrders: any[] = [];
    if (transferRes && transferRes.ok) {
      const data = await transferRes.json();
      transferOrders = Array.isArray(data) ? data : data.data || [];
    }
    try {
      const localTransfers = JSON.parse(localStorage.getItem('smart-wms-transfer-orders') || '[]');
      if (Array.isArray(localTransfers)) {
        transferOrders = [...transferOrders, ...localTransfers];
      }
    } catch { }

    transferOrders.forEach((ord) => {
      const destWhCode = String(ord.destinationWarehouse || ord.destinationWarehouseCode || '').trim().toUpperCase();
      const destWhId = String(ord.destinationWarehouseId || '').toLowerCase();

      if (!isWhMatch(destWhCode, destWhId)) return;

      const orderCode = ord.transferNo || ord.code || 'PX-NỘI-BỘ';
      const inboundDate = ord.createdAt
        ? new Date(ord.createdAt).toLocaleDateString('vi-VN') + ' ' + new Date(ord.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        : 'Hôm nay';

      (ord.items || ord.details || []).forEach((item: any) => {
        const pName = item.productName || item.product?.name || 'Sản phẩm chuyển kho';
        const pSku = item.productCode || item.productSku || item.sku || 'SKU-001';
        const pQty = Number(item.quantity || item.qty || 1);
        const pUnit = item.unit || 'Cái';

        let rawBins: string[] = Array.isArray(item.assignedBins) ? item.assignedBins : [];
        if (rawBins.length === 0 && item.locationBin) {
          rawBins = String(item.locationBin).split(',').map((s: string) => s.trim());
        }

        const uniqueBinsMap = new Map<string, string>();
        rawBins.forEach((b) => {
          if (!b) return;
          const cleanCode = b.split('(')[0].trim();
          const normKey = normalizeBinKey(cleanCode);
          if (cleanCode && (!normKey || !uniqueBinsMap.has(normKey))) {
            uniqueBinsMap.set(normKey || cleanCode, b);
          }
        });
        const bins = Array.from(uniqueBinsMap.values());
        const pQtyPerBin = Math.max(1, pQty);

        bins.forEach((bCode) => {
          if (!bCode) return;
          const info: BinOccupiedInfo = {
            totalPhysical: pQtyPerBin,
            allocated: 0,
            productsCount: 1,
            productName: pName,
            sku: pSku,
            supplierName: ord.createdBy || 'Chuyển kho nội bộ',
            inboundDate,
            orderCode,
            unit: pUnit,
          };
          addBinOccupied(bCode, info);
        });
      });
    });

    // 4. Parse products from localStorage ('smart-wms-products')
    try {
      const localProducts = JSON.parse(localStorage.getItem('smart-wms-products') || '[]');
      if (Array.isArray(localProducts)) {
        localProducts.forEach((p: any) => {
          if (Array.isArray(p.stockBalances)) {
            p.stockBalances.forEach((sb: any) => {
              const sbWhCode = String(sb.locationCode || sb.warehouseCode || '').trim().toUpperCase();
              if (isWhMatch(sbWhCode)) {
                let bins: string[] = Array.isArray(sb.assignedBins) ? sb.assignedBins : [];
                if (bins.length === 0 && sb.locationBin) {
                  bins = String(sb.locationBin).split(',').map((s) => s.trim());
                }
                bins.forEach((bCode) => {
                  if (!bCode) return;
                  const cleanCode = bCode.split('(')[0].trim();
                  const normKey = normalizeBinKey(cleanCode);
                  if (map.has(cleanCode) || (normKey && map.has(normKey))) return;

                  const info: BinOccupiedInfo = {
                    totalPhysical: Number(sb.totalPhysical || sb.available || p.stockQty || 1),
                    allocated: 0,
                    productsCount: 1,
                    productName: p.name || 'Sản phẩm tồn kho',
                    sku: p.internalSku || p.sku || 'SKU-001',
                    supplierName: p.supplier || 'Nhà cung cấp',
                    inboundDate: 'Hôm nay',
                    orderCode: 'TỒN-KHO',
                    unit: p.unit || 'Cái',
                  };
                  addBinOccupied(bCode, info);
                });
              }
            });
          }
        });
      }
    } catch { }

    // 2.8. Fetch outbound orders history (from API & localStorage)
    try {
      const storedOutboundStr = localStorage.getItem('stored_outbound_orders');
      const localOutboundOrders: any[] = storedOutboundStr ? JSON.parse(storedOutboundStr) : [];
      const [apiOutboundRes, apiOutboundsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/outbound/orders`, { headers }).catch(() => null),
        fetch(`${API_BASE_URL}/outbounds`, { headers }).catch(() => null),
      ]);

      allOutboundOrders = [];
      if (apiOutboundRes && apiOutboundRes.ok) {
        const apiData = await apiOutboundRes.json();
        const list = Array.isArray(apiData) ? apiData : apiData.data || [];
        allOutboundOrders = [...allOutboundOrders, ...list];
      }
      if (apiOutboundsRes && apiOutboundsRes.ok) {
        const obsData = await apiOutboundsRes.json();
        const obsList = Array.isArray(obsData) ? obsData : obsData.data || [];
        obsList.forEach((ob: any) => {
          if (!allOutboundOrders.some((ao: any) => String(ao.id) === String(ob.id) || (ao.orderNo && ob.orderNo && ao.orderNo === ob.orderNo))) {
            allOutboundOrders.push(ob);
          }
        });
      }
      if (Array.isArray(localOutboundOrders)) {
        localOutboundOrders.forEach((lo: any) => {
          if (!allOutboundOrders.some((ao: any) => String(ao.id) === String(lo.id) || (ao.orderNo && lo.orderNo && ao.orderNo === lo.orderNo))) {
            allOutboundOrders.push(lo);
          }
        });
      }

      allOutboundOrders.forEach((ord) => {
        const oWhId = String(ord.warehouseId || ord.warehouse?.id || '').toLowerCase();
        const oWhCode = String(ord.warehouseCode || ord.branchCode || ord.warehouse?.code || '').trim().toUpperCase();

        const orderCode = ord.orderNo || ord.orderCode || ord.code || (ord.id ? `PXK-${String(ord.id).padStart(4, '0')}` : 'XK-ORDER');
        const supplierName = ord.customer || ord.customerName || ord.partnerLabel || 'Khách hàng / Đối tác';
        const outboundDate = ord.createdAt || ord.orderDate
          ? new Date(ord.createdAt || ord.orderDate).toLocaleDateString('vi-VN') +
          ' ' +
          new Date(ord.createdAt || ord.orderDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
          : 'Hôm nay';

        (ord.details || ord.items || []).forEach((item: any) => {
          const pName = item.productName || item.product?.name || item.name || 'Sản phẩm xuất kho';
          const pSku = item.productSku || item.sku || item.product?.sku || item.product?.internalSku || 'SKU-001';
          const pQty = Number(item.qty || item.quantity || item.requiredQty || item.pickedQty || 1);
          const pUnit = item.unit || item.product?.unit || 'Cái';

          let rawBins: string[] = Array.isArray(item.assignedBins) ? item.assignedBins : [];
          if (rawBins.length === 0 && item.locationBin)
            rawBins = String(item.locationBin).split(',').map((s: string) => s.trim());
          if (rawBins.length === 0 && item.note) {
            rawBins = parseAssignedBinsFromNote(item.note);
          }

          const uniqueBinsMap = new Map<string, string>();
          rawBins.forEach((b) => {
            if (!b) return;
            const cleanCode = b.split('(')[0].trim();
            const normKey = normalizeBinKey(cleanCode);
            if (cleanCode && (!normKey || !uniqueBinsMap.has(normKey))) {
              uniqueBinsMap.set(normKey || cleanCode, b);
            }
          });
          const bins = Array.from(uniqueBinsMap.values());
          const exportQty = Math.max(1, pQty);

          bins.forEach((bCode) => {
            if (!bCode) return;
            if (!isWhMatch(oWhCode, oWhId, bCode)) return;
            const pctMatch = bCode.match(/^([^(]+)\s*\((?:Dư\s*)?(\d+)%\)/i);
            let itemPct: number | undefined = item.occupancyPct !== undefined ? Number(item.occupancyPct) : (item.occupancy !== undefined ? Number(item.occupancy) : undefined);
            if (pctMatch) {
              itemPct = Number(pctMatch[2]);
            }
            const info: BinOccupiedInfo = {
              totalPhysical: exportQty,
              allocated: 0,
              productsCount: 1,
              productName: pName,
              sku: pSku,
              supplierName,
              inboundDate: outboundDate,
              orderCode,
              unit: pUnit,
              occupancyPct: itemPct,
              isOutbound: true,
            };
            addBinOccupied(bCode, info);
          });
        });
      });
    } catch (eOut) {
      console.error('Error loading outbound orders for bins:', eOut);
    }
    // Post-processing: Retain full order quantities without splitting across bin keys

    // Clean up redundant placeholder 'TỒN-KHO' entries when explicit order records exist
    gMap.forEach((goodsList, binKey) => {
      const explicitSkus = new Set(
        goodsList
          .filter((x) => x.orderCode && x.orderCode !== 'TỒN-KHO')
          .map((x) => x.sku)
      );
      if (explicitSkus.size > 0) {
        const filtered = goodsList.filter(
          (x) => x.orderCode !== 'TỒN-KHO' || !explicitSkus.has(x.sku)
        );
        gMap.set(binKey, filtered);
        if (filtered.length > 0) {
          dMap.set(binKey, filtered[0]);
        }
      }
    });

    // 3. Reconcile customBins from stored warehouses so manually saved / updated bin configurations are always honored
    try {
      const storedWhs = JSON.parse(localStorage.getItem('smart-wms-warehouses') || '[]');
      if (Array.isArray(storedWhs)) {
        storedWhs.forEach((wh: any) => {
          const wCode = String(wh.code || wh.id || '').trim().toUpperCase();
          if (isWhMatch(wCode)) {
            (wh.subWarehouses || []).forEach((sub: any) => {
              (sub.racks || []).forEach((rk: any) => {
                if (rk.customBins) {
                  Object.entries(rk.customBins).forEach(([bKey, cfg]: [string, any]) => {
                    if (cfg && (cfg.occupancyPct !== undefined || cfg.totalPhysical !== undefined)) {
                      const cleanCode = bKey.split('(')[0].trim();
                      const normKey = normalizeBinKey(cleanCode);
                      const existing = map.get(cleanCode) || (normKey ? map.get(normKey) : null);
                      if (existing) {
                        const updatedInfo = {
                          ...existing,
                          occupancyPct: Number(cfg.occupancyPct ?? existing.occupancyPct),
                          totalPhysical: Number(cfg.totalPhysical ?? existing.totalPhysical),
                        };
                        map.set(cleanCode, updatedInfo);
                        if (normKey) map.set(normKey, updatedInfo);
                      } else if ((cfg.totalPhysical && Number(cfg.totalPhysical) > 0) || (cfg.occupancyPct && Number(cfg.occupancyPct) > 0)) {
                        const newInfo: BinOccupiedInfo = {
                          totalPhysical: Number(cfg.totalPhysical || 1),
                          allocated: 0,
                          productsCount: 1,
                          productName: cfg.productName || 'Hàng trong kho',
                          sku: cfg.sku || 'SKU-001',
                          supplierName: 'Nhà cung cấp',
                          inboundDate: 'Đã lưu',
                          orderCode: 'KHO-LUU',
                          unit: cfg.unit || 'cái',
                          occupancyPct: Number(cfg.occupancyPct || 100),
                        };
                        map.set(cleanCode, newInfo);
                        if (normKey) map.set(normKey, newInfo);
                      }
                    }
                  });
                }
              });
            });
          }
        });
      }
    } catch (eCustom) {
      console.error('Error loading customBins in fetchWarehouseOccupiedBins:', eCustom);
    }
  } catch (err) {
    console.error('Error in fetchWarehouseOccupiedBins:', err);
  }

  return { occupiedMap: map, detailsMap: dMap, goodsListMap: gMap };
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
  activeRowId,
  binQtyMap = {},
  customQtyBinsMap = {},
  onSelectBin,
  onBinClick,
  onUpdateBinCapacity,
  mode = 'view',
  isOutbound = false,
  maxBinsAllowed,
  readOnly = false,
}) => {
  const [occupiedMap, setOccupiedMap] = useState<Map<string, BinOccupiedInfo>>(new Map());
  const [detailsMap, setDetailsMap] = useState<Map<string, BinGoodsDetail>>(new Map());
  const [occupiedGoodsListMap, setOccupiedGoodsListMap] = useState<Map<string, BinGoodsDetail[]>>(new Map());
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [selectedRackId, setSelectedRackId] = useState<string>('');
  const [editingBinConfig, setEditingBinConfig] = useState<{
    binCode: string;
    shortCode: string;
    rackCode?: string;
    currentPct: number;
  } | null>(null);
  const [inputPctVal, setInputPctVal] = useState<number>(0);
  const [isAddMode, setIsAddMode] = useState<boolean>(true);
  const [editableBinItems, setEditableBinItems] = useState<Array<{
    rowId?: string;
    productName: string;
    sku?: string;
    unit?: string;
    qty: number;
    occupancyPct: number;
    isExistingStock?: boolean;
    stockQty?: number;
    stockPct?: number;
    matchedSku?: string;
    isCustomQty?: boolean;
  }>>([]);

  useEffect(() => {
    if (!editingBinConfig) return;
    const binShortCode = editingBinConfig.shortCode;
    const fullBinCode = editingBinConfig.binCode;
    const normTarget = normalizeBinKey(fullBinCode);
    const rackCode = editingBinConfig.rackCode || '';

    const rawStoredGoods = getGoodsList(fullBinCode, binShortCode, rackCode);
    const storedGoods = rawStoredGoods.filter(
      (g) => g.orderCode !== 'PNK-DRAFT' && g.orderCode !== 'PXK-DRAFT' && g.inboundDate !== 'Đang xếp' && g.inboundDate !== 'Đang chọn'
    );
    const rawStoredInfo = getOccupiedInfo(fullBinCode, binShortCode, rackCode);
    const isDraftInfo = rawStoredInfo?.orderCode === 'PNK-DRAFT' || rawStoredInfo?.orderCode === 'PXK-DRAFT' || rawStoredInfo?.inboundDate === 'Đang xếp' || rawStoredInfo?.inboundDate === 'Đang chọn';
    const storedInfo = isDraftInfo ? null : rawStoredInfo;

    const hasPhysicalStoredStock = (storedGoods && storedGoods.length > 0) || Boolean(storedInfo && ((storedInfo.totalPhysical || 0) > 0 || (storedInfo.allocated || 0) > 0));
    const realStockQty = Number(
      storedInfo?.totalPhysical ||
      (storedGoods && storedGoods.length > 0 ? storedGoods.reduce((a, b) => a + (Number(b.quantity) || 0), 0) : 0) ||
      0
    );
    const realStockPct = hasPhysicalStoredStock && storedInfo?.occupancyPct !== undefined
      ? Number(storedInfo.occupancyPct)
      : (hasPhysicalStoredStock && storedGoods && storedGoods.length > 0
          ? storedGoods.reduce((a, b) => a + (Number(b.occupancyPct) || 0), 0)
          : 0);

    const assigned: Array<{
      rowId?: string;
      productName: string;
      sku?: string;
      unit?: string;
      qty: number;
      occupancyPct: number;
      isExistingStock?: boolean;
      stockQty?: number;
      stockPct?: number;
      matchedSku?: string;
      isCustomQty?: boolean;
    }> = [];

    if (isOutbound) {
      let allStored: BinGoodsDetail[] = storedGoods && storedGoods.length > 0 ? [...storedGoods] : [];
      if (allStored.length === 0 && storedInfo && (storedInfo.totalPhysical || storedInfo.occupancyPct)) {
        allStored = [{
          binCode: fullBinCode,
          productName: storedInfo.productName || 'Hàng tồn kho',
          sku: storedInfo.sku || 'SKU-001',
          quantity: storedInfo.totalPhysical || 0,
          allocated: storedInfo.allocated || 0,
          supplierName: storedInfo.supplierName || '',
          inboundDate: storedInfo.inboundDate || '',
          orderCode: storedInfo.orderCode || '',
          unit: storedInfo.unit || 'Cái',
          occupancyPct: storedInfo.occupancyPct !== undefined ? storedInfo.occupancyPct : (editingBinConfig.currentPct || 100),
        }];
      }

      const activeItem = (orderItems && activeRowId) ? orderItems.find((i: any) => i.rowId === activeRowId) : (orderItems && orderItems.length > 0 ? orderItems[0] : null);

      const matchedStored = allStored.find((g) =>
        (activeItem?.productSku && g.sku && activeItem.productSku.trim().toUpperCase() === g.sku.trim().toUpperCase()) ||
        (activeItem?.productName && g.productName && activeItem.productName.trim().toLowerCase() === g.productName.trim().toLowerCase())
      ) || allStored[0];

      const itemStockQty = matchedStored ? Number(matchedStored.quantity) : realStockQty;
      const itemStockPct = matchedStored && matchedStored.occupancyPct !== undefined ? Number(matchedStored.occupancyPct) : (realStockPct || editingBinConfig.currentPct || 100);

      const requestedQty = activeItem?.qty && Number(activeItem.qty) > 0 ? Number(activeItem.qty) : 10;
      const exportQty = Math.min(itemStockQty > 0 ? itemStockQty : requestedQty, requestedQty);
      let exportPct = 0;
      if (itemStockQty > 0 && itemStockPct > 0) {
        exportPct = Number(((exportQty / itemStockQty) * itemStockPct).toFixed(1));
        if (exportPct === 0 && exportQty > 0) exportPct = 0.1;
      }

      assigned.push({
        rowId: activeItem?.rowId || 'row-out-0',
        productName: activeItem?.productName || matchedStored?.productName || 'Hàng xuất kho',
        sku: activeItem?.productSku || matchedStored?.sku || '',
        unit: activeItem?.unit || matchedStored?.unit || 'Cái',
        qty: exportQty,
        occupancyPct: exportPct,
        isExistingStock: false,
        stockQty: itemStockQty,
        stockPct: itemStockPct,
        matchedSku: matchedStored?.sku,
      });
    } else {
      // INBOUND MODE
      // Step 1: Include currently stored stock in bin ONLY IF IT ACTUALLY EXISTS IN PHYSICAL STORAGE
      if (hasPhysicalStoredStock && (realStockPct > 0 || realStockQty > 0)) {
        if (storedGoods && storedGoods.length > 0) {
          storedGoods.forEach((sg, sgIdx) => {
            const cleanName = (sg.productName || 'Hàng tồn kho').replace(/\s*\(Tồn tại kệ\)/i, '');
            assigned.push({
              rowId: `existing-stock-line-${sgIdx}`,
              productName: `${cleanName} (Tồn tại kệ)`,
              qty: Number(sg.quantity) || 0,
              occupancyPct: sg.occupancyPct !== undefined ? Number(sg.occupancyPct) : 0,
              isExistingStock: true,
            });
          });
        } else if (storedInfo) {
          const storedProdName = storedInfo.productName || 'Hàng tồn kho';
          const cleanName = storedProdName.replace(/\s*\(Tồn tại kệ\)/i, '');
          assigned.push({
            rowId: 'existing-stock-line',
            productName: `${cleanName} (Tồn tại kệ)`,
            qty: realStockQty,
            occupancyPct: realStockPct,
            isExistingStock: true,
          });
        }
      }

      // Step 2: Add ONLY the active item being selected in this order tab (NOT all items in the order!)
      const existingStoredPct = assigned.reduce((acc, curr) => acc + (Number(curr.occupancyPct) || 0), 0);
      const remainingEmptyPct = Math.max(0, 100 - existingStoredPct);

      let targetItems: any[] = [];
      if (orderItems && orderItems.length > 0) {
        if (activeRowId) {
          const found = orderItems.find((it: any) => it.rowId === activeRowId);
          if (found) targetItems.push(found);
        }
        if (targetItems.length === 0 && selectedBinsMap) {
          targetItems = orderItems.filter((it: any) => {
            const bList = selectedBinsMap[it.rowId] || [];
            return bList.some((b: string) => normalizeBinKey(b) === normTarget || b.includes(fullBinCode));
          });
        }
        if (targetItems.length === 0) {
          targetItems.push(orderItems[0]); // Only fallback to the first active product
        }
      }

      if (targetItems.length > 0) {
        targetItems.forEach((it: any, idx: number) => {
          const rowId = it.rowId || String(idx);
          const rawName = it.productName || `Mặt hàng nhập mới`;
          const cleanName = rawName.replace(/\s*\(Lô nhập mới\)/i, '');
          const totalItemQty = it.qty && Number(it.qty) > 0 ? Number(it.qty) : 100;

          const bList = selectedBinsMap?.[rowId] || [];
          const strippedTarget = fullBinCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
          const matchBinEntry = bList.find((b: string) => {
            const clean = b.split('(')[0].trim();
            const normClean = normalizeBinKey(clean);
            return (
              normClean === normTarget ||
              clean === fullBinCode ||
              b.includes(fullBinCode) ||
              clean.endsWith(`-${binShortCode}`) ||
              clean === binShortCode ||
              clean.toUpperCase().replace(/[^A-Z0-9]/g, '') === strippedTarget
            );
          });
          let calcPctForItem = 100;
          if (matchBinEntry) {
            const m = matchBinEntry.match(/\((\d+(?:\.\d+)?)%\)/);
            if (m) calcPctForItem = Number(m[1]);
            else calcPctForItem = 100;
          } else {
            calcPctForItem = 100;
          }

          let qtyPerBinForItem: number | undefined = undefined;
          if (binQtyMap) {
            qtyPerBinForItem =
              binQtyMap[fullBinCode] ??
              binQtyMap[binShortCode] ??
              binQtyMap[normTarget] ??
              binQtyMap[strippedTarget] ??
              binQtyMap[fullBinCode.toUpperCase().replace(/_/g, '-')] ??
              binQtyMap[binShortCode.toUpperCase()];
          }
          if (matchBinEntry) {
            const mQty = matchBinEntry.match(/\[(\d+(?:\.\d+)?)\s*(?:cái|sp)?\]/);
            if (mQty && Number(mQty[1]) > 0) {
              qtyPerBinForItem = Number(mQty[1]);
            }
          }
          if (qtyPerBinForItem === undefined || qtyPerBinForItem <= 0) {
            qtyPerBinForItem = Math.max(1, Math.round(totalItemQty / (bList.length || 1)));
          }

          const isAlreadyCustom = Boolean(
            customQtyBinsMap?.[fullBinCode] ||
            customQtyBinsMap?.[binShortCode] ||
            customQtyBinsMap?.[normTarget] ||
            customQtyBinsMap?.[strippedTarget]
          );

          assigned.push({
            rowId,
            productName: `${cleanName} (Lô nhập mới)`,
            sku: it.productSku || it.sku || it.product?.sku || it.product?.internalSku || '',
            unit: it.unit || it.product?.unit || 'Cái',
            qty: qtyPerBinForItem,
            occupancyPct: calcPctForItem,
            isExistingStock: false,
            isCustomQty: isAlreadyCustom,
          });
        });
      } else {
        assigned.push({
          rowId: 'row-new-0',
          productName: 'Mặt hàng nhập mới (Lô nhập mới)',
          qty: 100,
          occupancyPct: remainingEmptyPct > 0 ? remainingEmptyPct : (assigned.length > 0 ? 25 : 100),
          isExistingStock: false,
          isCustomQty: false,
        });
      }
    }

    setEditableBinItems(assigned);
  }, [editingBinConfig, orderItems, selectedBinsMap, activeRowId, binQtyMap, customQtyBinsMap]);

  const handleSaveBinPct = (binCode: string, pct: number) => {
    const currentPct = editingBinConfig?.currentPct || 0;
    const addedOrDirect = Math.min(100, Math.max(0, Number(pct) || 0));
    const finalPct = isAddMode && currentPct > 0 ? Math.min(100, currentPct + addedOrDirect) : addedOrDirect;
    if (onUpdateBinCapacity) {
      onUpdateBinCapacity(binCode, finalPct);
    }
    setEditingBinConfig(null);
  };

  const subWarehouses = useMemo<SubWarehouse[]>(() => {
    if (warehouse?.subWarehouses && warehouse.subWarehouses.length > 0) {
      return warehouse.subWarehouses;
    }
    const code = warehouse?.code ? warehouse.code.trim().toUpperCase() : 'KHO';
    return [
      {
        id: `${code}-ZA`,
        code: 'ZA',
        name: `Phân Khu A - Kho ${code}`,
        length: 20,
        width: 15,
        height: 6,
        racksCount: 1,
        shelvesPerRack: 4,
        binsPerShelf: 10,
        racks: [
          { id: 'R01', rackCode: 'R01', name: `Dãy Kệ R01 (${code})`, shelvesCount: 4, baysCount: 10, defaultBinMaxWeight: 500, customBins: {} } as any,
        ],
      },
      {
        id: `${code}-ZB`,
        code: 'ZB',
        name: `Phân Khu B - Kho ${code}`,
        length: 20,
        width: 15,
        height: 6,
        racksCount: 1,
        shelvesPerRack: 4,
        binsPerShelf: 10,
        racks: [
          { id: 'R02', rackCode: 'R02', name: `Dãy Kệ R02 (${code})`, shelvesCount: 4, baysCount: 10, defaultBinMaxWeight: 500, customBins: {} } as any,
        ],
      },
      {
        id: `${code}-ZC`,
        code: 'ZC',
        name: `Phân Khu C - Kho Lạnh (-18°C)`,
        length: 20,
        width: 15,
        height: 6,
        racksCount: 1,
        shelvesPerRack: 4,
        binsPerShelf: 10,
        racks: [
          { id: 'R03', rackCode: 'R03', name: `Dãy Kệ R03 (${code})`, shelvesCount: 4, baysCount: 10, defaultBinMaxWeight: 500, customBins: {} } as any,
        ],
      },
    ];
  }, [warehouse?.subWarehouses, warehouse?.code]);

  const whCode = warehouse?.code ? warehouse.code.trim().toUpperCase() : 'KHO';

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
    const reload = () => {
      fetchWarehouseOccupiedBins(warehouse?.code, warehouse?.id).then(({ occupiedMap: oMap, detailsMap: dMap, goodsListMap: gMap }) => {
        if (isMounted) {
          setOccupiedMap(oMap);
          setDetailsMap(dMap);
          setOccupiedGoodsListMap(gMap);
        }
      });
    };

    reload();

    const handleStorage = () => reload();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('warehouse-goods-cleared', handleStorage);

    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('warehouse-goods-cleared', handleStorage);
    };
  }, [warehouse?.code, warehouse?.id]);

  const getGoodsList = (fullBinCode: string, binCodeShort: string, rackCode: string): BinGoodsDetail[] => {
    if (occupiedGoodsListMap && occupiedGoodsListMap.size > 0) {
      if (occupiedGoodsListMap.has(fullBinCode)) return occupiedGoodsListMap.get(fullBinCode)!;
      const normKey = normalizeBinKey(fullBinCode);
      if (normKey && occupiedGoodsListMap.has(normKey)) return occupiedGoodsListMap.get(normKey)!;

      const rackCell = `${rackCode}-${binCodeShort}`;
      if (occupiedGoodsListMap.has(rackCell)) return occupiedGoodsListMap.get(rackCell)!;
      const normRackCell = normalizeBinKey(rackCell);
      if (normRackCell && occupiedGoodsListMap.has(normRackCell)) return occupiedGoodsListMap.get(normRackCell)!;

      const normRack = normalizeBinKey(rackCode);
      const normCell = normalizeBinKey(binCodeShort);

      for (const [key, val] of occupiedGoodsListMap.entries()) {
        const normK = normalizeBinKey(key);
        if (!normK) continue;
        if (normRack && normCell && normK.includes(normRack) && normK.endsWith(normCell)) {
          return val;
        }
        if (normCell && (normK === normCell || normK.endsWith(`-${normCell}`) || normK.endsWith(`_${normCell}`))) {
          return val;
        }
      }

      if (normCell && occupiedGoodsListMap.has(normCell)) {
        return occupiedGoodsListMap.get(normCell)!;
      }

      if (occupiedGoodsListMap.has(binCodeShort)) {
        return occupiedGoodsListMap.get(binCodeShort)!;
      }
    }

    const info = getOccupiedInfo(fullBinCode, binCodeShort, rackCode);
    if (info) {
      return [{
        binCode: fullBinCode,
        productName: info.productName || 'Sản phẩm nhập kho',
        sku: info.sku || 'SKU-001',
        quantity: info.totalPhysical || info.allocated || 1,
        allocated: info.allocated || 0,
        supplierName: info.supplierName || 'Nhà cung cấp',
        inboundDate: info.inboundDate || 'Hôm nay',
        orderCode: info.orderCode || 'NK-ORDER',
        unit: info.unit || 'Cái',
        occupancyPct: info.occupancyPct,
      }];
    }

    return [];
  };

  const activeRack = useMemo(
    () => racks.find((r) => r.id === selectedRackId || r.rackCode === selectedRackId) || racks[0],
    [racks, selectedRackId]
  );

  const getOccupiedInfo = (fullBinCode: string, binCodeShort: string, rackCode: string) => {
    if (!occupiedMap || occupiedMap.size === 0) return null;

    if (occupiedMap.has(fullBinCode)) return occupiedMap.get(fullBinCode);

    const normKey = normalizeBinKey(fullBinCode);
    if (normKey && occupiedMap.has(normKey)) return occupiedMap.get(normKey);

    const rackCell = `${rackCode}-${binCodeShort}`;
    if (occupiedMap.has(rackCell)) return occupiedMap.get(rackCell);
    const normRackCell = normalizeBinKey(rackCell);
    if (normRackCell && occupiedMap.has(normRackCell)) return occupiedMap.get(normRackCell);

    const normRack = normalizeBinKey(rackCode);
    const normCell = normalizeBinKey(binCodeShort);

    for (const [key, val] of occupiedMap.entries()) {
      const normK = normalizeBinKey(key);
      if (!normK) continue;
      if (normRack && normCell) {
        if (normK.includes(normRack) && normK.endsWith(normCell)) {
          return val;
        }
      }
    }

    if (!normRack && normCell && occupiedMap.has(binCodeShort)) {
      return occupiedMap.get(binCodeShort);
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
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${isActive
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
                  className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${isActive
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

                          const rawCustomConfig =
                            (activeRack.customBins as any)?.[fullBinCode] ||
                            (activeRack.customBins as any)?.[binCodeShort] ||
                            (normFull ? (activeRack.customBins as any)?.[normFull] : null);
                          const customConfig = rawCustomConfig && rawCustomConfig.occupancyPct !== undefined && rawCustomConfig.occupancyPct !== null ? rawCustomConfig : null;

                          const occupiedInfo = getOccupiedInfo(fullBinCode, binCodeShort, rackCode);
                          const hasGoods = Boolean(
                            (occupiedInfo && ((occupiedInfo.totalPhysical || 0) > 0 || (occupiedInfo.allocated || 0) > 0 || (occupiedInfo.occupancyPct || 0) > 0)) ||
                            (customConfig && ((customConfig.totalPhysical || 0) > 0 || (customConfig.occupancyPct || 0) > 0))
                          );

                          const normShort = normalizeBinKey(binCodeShort);
                          const normRackShort = normalizeBinKey(`${rackCode}-${binCodeShort}`);
                          const isSelected = selectedSet.has(normFull) || (Boolean(normShort) && selectedSet.has(normShort)) || (Boolean(normRackShort) && selectedSet.has(normRackShort));
                          const isSuggested = suggestedSet.has(normFull) || (Boolean(normShort) && suggestedSet.has(normShort)) || (Boolean(normRackShort) && suggestedSet.has(normRackShort));
                          const rawOtherEntry = otherItemsBinsMap
                            ? (otherItemsBinsMap[fullBinCode] ||
                              otherItemsBinsMap[binCodeShort] ||
                              (normFull ? otherItemsBinsMap[normFull] : null) ||
                              otherItemsBinsMap[`${rackCode}-${binCodeShort}`] ||
                              otherItemsBinsMap[normalizeBinKey(`${rackCode}-${binCodeShort}`)])
                            : null;

                          let otherItemName: string | null = null;
                          let otherItemPctFromLock: number | undefined = undefined;

                          if (typeof rawOtherEntry === 'string') {
                            otherItemName = rawOtherEntry;
                          } else if (rawOtherEntry && typeof rawOtherEntry === 'object') {
                            otherItemName = rawOtherEntry.label;
                            otherItemPctFromLock = rawOtherEntry.occupancyPct;
                          }

                          const matchingSelectedCode = selectedBinCodes.find((s) => normalizeBinKey(s) === normFull);
                          let embeddedPct: number | undefined;
                          if (matchingSelectedCode) {
                            const match = matchingSelectedCode.match(/\((\d+(?:\.\d+)?)%\)/);
                            if (match) embeddedPct = Number(match[1]);
                          }

                          const customPct = customConfig?.occupancyPct !== undefined && customConfig?.occupancyPct !== null ? Number(customConfig.occupancyPct) : undefined;

                          let occupancyPct = 0;
                          let isOtherItemFull = false;

                          const knownPct = occupiedInfo?.occupancyPct !== undefined && Number(occupiedInfo.occupancyPct) >= 0 ? Number(occupiedInfo.occupancyPct) : undefined;

                          if (isSelected) {
                            occupancyPct = embeddedPct !== undefined
                              ? embeddedPct
                              : (customPct !== undefined ? customPct : (knownPct !== undefined ? knownPct : 100));
                          } else if (otherItemName) {
                            const otherPct = otherItemPctFromLock !== undefined ? Number(otherItemPctFromLock) : (customPct !== undefined ? customPct : 100);
                            occupancyPct = otherPct;
                            if (mode === 'select' && !isOutbound && otherPct >= 100) {
                              isOtherItemFull = true;
                            }
                          } else if (hasGoods && occupiedInfo) {
                            const curName = (orderItems && activeRowId) ? (orderItems.find((i: any) => i.rowId === activeRowId)?.productName || '').trim().toLowerCase() : '';
                            const occName = (occupiedInfo.productName || '').trim().toLowerCase();
                            const isDifferentProduct = curName && occName && !occName.includes(curName) && !curName.includes(occName);

                            const qty = occupiedInfo.totalPhysical || occupiedInfo.allocated || 1;
                            const maxCap = customConfig?.maxWeight || (activeRack as any).defaultBinMaxWeight || 500;
                            const calculatedFromQty = Math.min(100, Math.max(10, Math.round((qty / maxCap) * 100)));
                            occupancyPct = knownPct !== undefined ? knownPct : (customPct !== undefined ? customPct : calculatedFromQty);

                            if (mode === 'select' && !isOutbound && isDifferentProduct && occupancyPct >= 100) {
                              isOtherItemFull = true;
                            }
                          } else if (customPct !== undefined && customPct > 0) {
                            occupancyPct = customPct;
                          } else if (knownPct !== undefined && knownPct > 0) {
                            occupancyPct = knownPct;
                          } else {
                            occupancyPct = 0;
                          }

                          const isFull = (hasGoods && occupancyPct >= 100) || isOtherItemFull || (isSelected && occupancyPct >= 100);
                          const isPartiallyOccupied = occupancyPct > 0 && occupancyPct < 100;

                          const countReq = maxBinsAllowed || 1;
                          const isQuotaReached = selectedBinCodes.length >= countReq;

                          let isBinDisabled = isOutbound ? false : isOtherItemFull;

                          if (mode === 'select') {
                            if (isOutbound) {
                              // LOGIC XUẤT KHO:
                              // 1. Ô KỆ KHÔNG CÓ HÀNG HÓA HOẶC KHÔNG CHỨA ĐÚNG MẶT HÀNG ĐANG CHỌN (isSuggested === false) -> In chìm & Khóa chọn
                              if (!isSuggested && !isSelected) {
                                isBinDisabled = true;
                              }

                              // 2. Khi đã chọn đủ số lượng/số kệ cần xuất (isQuotaReached) thì các kệ chưa chọn khác sẽ in chìm.
                              if (isQuotaReached && !isSelected) {
                                isBinDisabled = true;
                              }
                            } else {
                              // LOGIC NHẬP KHO:
                              if (isFull && !isSelected) {
                                isBinDisabled = true;
                              }
                            }
                          }

                          return (
                            <div
                              key={fullBinCode}
                              onClick={() => {
                                if (mode === 'view') {
                                  if (onBinClick) {
                                    onBinClick(fullBinCode, customConfig, occupiedInfo || null, getGoodsList(fullBinCode, binCodeShort, rackCode));
                                  }
                                  return;
                                }
                                if (readOnly) {
                                  const curr = occupancyPct || customConfig?.occupancyPct || 100;
                                  setEditingBinConfig({
                                    binCode: fullBinCode,
                                    shortCode: binCodeShort,
                                    rackCode: rackCode || (activeRack as any)?.rackCode || '',
                                    currentPct: curr,
                                  });
                                  setInputPctVal(curr);
                                  setIsAddMode(false);
                                  return;
                                }
                                if (isBinDisabled) return;
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
                                  onBinClick(fullBinCode, customConfig, occupiedInfo || null, getGoodsList(fullBinCode, binCodeShort, rackCode));
                                }
                              }}
                              className={`p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-between gap-1 shadow-2xs relative overflow-hidden aspect-square min-h-[84px] sm:min-h-[92px] cursor-pointer ${mode === 'view'
                                  ? isSelected
                                    ? 'border-2 border-emerald-600 bg-emerald-500 text-white shadow-lg ring-4 ring-emerald-400/60 font-black scale-[1.03] z-20 hover:ring-emerald-300'
                                    : isFull || hasGoods
                                      ? 'border-2 border-[#197e96] bg-cyan-50/90 dark:bg-cyan-950/90 text-cyan-950 dark:text-cyan-100 shadow-2xs font-black hover:border-cyan-600'
                                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-cyan-400'
                                  : readOnly
                                    ? isSelected
                                      ? 'border-2 border-[#197e96] bg-cyan-50/90 dark:bg-cyan-950/90 text-cyan-950 dark:text-cyan-100 shadow-sm font-black hover:border-cyan-600'
                                      : isFull || hasGoods
                                        ? 'border-2 border-[#197e96] bg-cyan-50/90 dark:bg-cyan-950/90 text-cyan-950 dark:text-cyan-100 shadow-2xs font-black hover:border-cyan-600'
                                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-cyan-400'
                                    : isBinDisabled
                                      ? 'border-2 border-slate-300 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-900/90 text-slate-400 dark:text-slate-500 opacity-60 cursor-not-allowed select-none'
                                      : isSelected
                                        ? 'border-2 border-emerald-600 bg-emerald-500 text-white shadow-lg ring-4 ring-emerald-400/60 font-black scale-[1.03] cursor-pointer z-20'
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
                                  className={`absolute bottom-0 left-0 right-0 transition-all duration-300 pointer-events-none z-0 ${isOtherItemFull
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
                                  className={`text-xs font-black tracking-tight ${isOtherItemFull
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
                                  {mode === 'view' ? (
                                    <button
                                      type="button"
                                      title={isSelected ? 'Đã chọn ô' : 'Bấm để chọn / xem chi tiết'}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (onBinClick) {
                                          onBinClick(fullBinCode, customConfig, occupiedInfo || null, getGoodsList(fullBinCode, binCodeShort, rackCode));
                                        }
                                      }}
                                      className={`p-1 rounded-md transition flex items-center justify-center border shadow-xs cursor-pointer ${isSelected
                                          ? 'bg-emerald-600 text-white border-emerald-600'
                                          : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border-cyan-200/80 dark:bg-slate-800 dark:text-cyan-300 dark:border-slate-700'
                                        }`}
                                    >
                                      {isSelected ? (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                      ) : (
                                        <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                                      )}
                                    </button>
                                  ) : readOnly ? (
                                    <button
                                      type="button"
                                      title="Bấm để xem chi tiết hàng hóa ở ô"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const curr = occupancyPct || customConfig?.occupancyPct || 100;
                                        setEditingBinConfig({
                                          binCode: fullBinCode,
                                          shortCode: binCodeShort,
                                          rackCode: rackCode || (activeRack as any)?.rackCode || '',
                                          currentPct: curr,
                                        });
                                        setInputPctVal(curr);
                                        setIsAddMode(false);
                                      }}
                                      className="p-1 rounded-md transition cursor-pointer flex items-center justify-center border shadow-xs bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border-cyan-200/80 dark:bg-slate-800 dark:text-cyan-300 dark:border-slate-700"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </button>
                                  ) : (
                                    <>
                                      {onUpdateBinCapacity && !isBinDisabled && (
                                        <button
                                          type="button"
                                          title="Cài đặt % độ chứa hoặc Số lượng ô"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const curr = occupancyPct || 0;
                                            setEditingBinConfig({
                                              binCode: fullBinCode,
                                              shortCode: binCodeShort,
                                              rackCode: rackCode || (activeRack as any)?.rackCode || '',
                                              currentPct: curr,
                                            });
                                            setInputPctVal(curr);
                                            setIsAddMode(false);
                                          }}
                                          className={`p-1 rounded-md transition cursor-pointer flex items-center justify-center border shadow-xs ${isSelected
                                              ? 'bg-white hover:bg-cyan-50 text-[#197e96] border-cyan-200'
                                              : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border-cyan-200/80 dark:bg-slate-800 dark:text-cyan-300 dark:border-slate-700'
                                            }`}
                                        >
                                          <Settings className="h-3.5 w-3.5" />
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        disabled={isBinDisabled}
                                        title={isBinDisabled ? (isOtherItemFull ? `Đã đầy 100% (${otherItemName || 'Hàng khác'})` : 'Kệ đã đầy 100%') : isSelected ? 'Đã chọn ô' : 'Bấm để chọn ô'}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (isBinDisabled) return;
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
                                            onBinClick(fullBinCode, customConfig, occupiedInfo || null, getGoodsList(fullBinCode, binCodeShort, rackCode));
                                          }
                                        }}
                                        className={`p-1 rounded-md transition flex items-center justify-center border shadow-xs cursor-pointer ${isOtherItemFull
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
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Shelf Subtitle */}
                              <span
                                className={`text-[9px] font-bold block truncate z-10 ${isOtherItemFull
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
                                    {readOnly ? 'ĐÃ LƯU' : 'CHỌN'} ({occupancyPct > 0 ? occupancyPct : 100}%)
                                  </span>
                                ) : isOtherItemFull ? (
                                  <span className="text-[8.5px] font-black bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 px-1 py-0.5 rounded-md w-full block truncate shadow-2xs">
                                    FULL (100% - {otherItemName})
                                  </span>
                                ) : otherItemName ? (
                                  <span className="text-[8.5px] font-black bg-cyan-100 text-cyan-950 border border-cyan-300 px-1 py-0.5 rounded-md w-full block truncate shadow-2xs">
                                    {otherItemName} (Dư {100 - occupancyPct}%)
                                  </span>
                                ) : isSuggested ? (
                                  <span className="text-[9px] font-black bg-emerald-600 text-white px-1.5 py-0.5 rounded-md w-full block truncate shadow-2xs">
                                    GỢI Ý AI
                                  </span>
                                ) : (hasGoods || isFull) && occupancyPct >= 100 ? (
                                  <span title={occupiedInfo?.productName ? `${occupiedInfo.productName} (Đã đầy 100%)` : 'Đã xếp đầy'} className="text-[8.5px] font-black bg-[#197e96] text-white px-1 py-0.5 rounded-md w-full block truncate shadow-2xs">
                                    {occupiedInfo?.productName ? `📦 ${occupiedInfo.productName}` : `${occupiedInfo?.totalPhysical ? `${occupiedInfo.totalPhysical} ${occupiedInfo.unit || 'cái'}` : 'ĐÃ XẾP'} (FULL)`}
                                  </span>
                                ) : isPartiallyOccupied || (hasGoods && occupancyPct < 100) ? (
                                  <span title={occupiedInfo?.productName ? `${occupiedInfo.productName} (Đã xếp ${occupancyPct}%, còn trống ${100 - occupancyPct}%)` : `Đã xếp ${occupancyPct}%`} className="text-[8.5px] font-black bg-cyan-100 text-cyan-950 border border-cyan-300 px-1 py-0.5 rounded-md w-full block truncate shadow-2xs">
                                    {occupiedInfo?.productName ? `📦 ${occupiedInfo.productName} (Trống ${100 - occupancyPct}%)` : `ĐÃ XẾP (${occupancyPct}%, Trống ${100 - occupancyPct}%)`}
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
      {editingBinConfig &&
        createPortal(
          <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border-2 border-cyan-500 rounded-2xl p-5 sm:p-6 w-full max-w-4xl lg:max-w-5xl shadow-2xl space-y-4 my-auto">
            {/* 1. Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${readOnly ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : isOutbound ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300'}`}>
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
                    {readOnly || !isOutbound
                      ? `Chi Tiết Vị Trí & Hàng Hóa Ô Kệ ${editingBinConfig.shortCode}`
                      : `Cài Đặt Độ Chứa & Khấu Trừ Xuất Kệ Ô ${editingBinConfig.shortCode}`}
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase ${readOnly ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200' : isOutbound ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200' : 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-200'}`}>
                      {readOnly ? 'Chế độ xem' : isOutbound ? 'Xuất kho / Xuất hủy' : 'Chi tiết ô'}
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Mã vị trí ô: <span className="font-bold text-slate-700 dark:text-slate-300">{editingBinConfig.binCode}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingBinConfig(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Resolve actual stored goods from bin */}
            {(() => {
              const binShort = editingBinConfig.shortCode;
              const binFull = editingBinConfig.binCode;
              const rackCode = editingBinConfig.rackCode || '';
              const rawStoredGoods = getGoodsList(binFull, binShort, rackCode);
              const storedGoods = rawStoredGoods.filter(
                (g) => g.orderCode !== 'PNK-DRAFT' && g.orderCode !== 'PXK-DRAFT' && g.inboundDate !== 'Đang xếp' && g.inboundDate !== 'Đang chọn'
              );
              const rawStoredInfo = getOccupiedInfo(binFull, binShort, rackCode);
              const isDraftInfo = rawStoredInfo?.orderCode === 'PNK-DRAFT' || rawStoredInfo?.orderCode === 'PXK-DRAFT' || rawStoredInfo?.inboundDate === 'Đang xếp' || rawStoredInfo?.inboundDate === 'Đang chọn';
              const storedInfo = isDraftInfo ? null : rawStoredInfo;

              let allStoredGoods: BinGoodsDetail[] = storedGoods && storedGoods.length > 0 ? [...storedGoods] : [];
              if (allStoredGoods.length === 0 && storedInfo && ((storedInfo.totalPhysical || 0) > 0 || (storedInfo.allocated || 0) > 0)) {
                allStoredGoods = [{
                  binCode: binFull,
                  productName: storedInfo.productName || 'Hàng tồn kho',
                  sku: storedInfo.sku || '',
                  quantity: storedInfo.totalPhysical || 0,
                  allocated: storedInfo.allocated || 0,
                  supplierName: storedInfo.supplierName || '',
                  inboundDate: storedInfo.inboundDate || '',
                  orderCode: storedInfo.orderCode || '',
                  unit: storedInfo.unit || 'Cái',
                  occupancyPct: storedInfo.occupancyPct !== undefined ? Number(storedInfo.occupancyPct) : 0,
                }];
              }

              const totalStoredQty = allStoredGoods.reduce((a, b) => a + (Number(b.quantity) || 0), 0);
              const totalStoredPct = allStoredGoods.reduce((a, b) => a + (Number(b.occupancyPct) || 0), 0);
              const binOccupancyPct = isOutbound
                ? (totalStoredPct > 0 ? totalStoredPct : (editingBinConfig.currentPct || 0))
                : totalStoredPct;

              return (
                <>
                  {/* 2. Current Occupancy Status Banner */}
                  <div className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
                    isOutbound
                      ? 'bg-rose-50/70 border-rose-200/80 dark:bg-rose-950/40 dark:border-rose-900/60'
                      : 'bg-cyan-50 border-cyan-200/80 dark:bg-cyan-950/70 dark:border-cyan-900/60'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">Trạng thái ô ({binShort}):</span>
                        <span className="text-sm font-black text-slate-900 dark:text-white">
                          {totalStoredQty > 0 ? `Đang lưu trữ ${totalStoredQty.toLocaleString('vi-VN')} cái` : 'Ô đang trống (0 cái)'}
                        </span>
                      </div>
                      <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-700 hidden sm:block" />
                      <div className="flex flex-col">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">Số loại mặt hàng:</span>
                        <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                          {allStoredGoods.length} sản phẩm
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Độ chứa hiện tại:</span>
                      <span className="px-3 py-1 rounded-lg font-black text-xs bg-white dark:bg-slate-800 shadow-xs border border-slate-200 dark:border-slate-700 text-cyan-700 dark:text-cyan-300">
                        {binOccupancyPct}% dung tích ô
                      </span>
                    </div>
                  </div>

                  {/* 3. TOP SECTION: ALWAYS DISPLAY ALL CURRENT STORED GOODS IN THIS BIN */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Boxes className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                        Danh sách hàng hóa đang lưu trữ trên kệ ({allStoredGoods.length} dòng hàng)
                      </span>
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Tổng dung tích đang chiếm: <strong className="text-cyan-700 dark:text-cyan-300 font-black">{binOccupancyPct}%</strong>
                      </span>
                    </div>

                    <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs custom-scrollbar">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="p-2.5 w-10 text-center">STT</th>
                            <th className="p-2.5">Mặt hàng & SKU</th>
                            <th className="p-2.5 text-center w-20">ĐVT</th>
                            <th className="p-2.5 text-right w-36">Số lượng tồn</th>
                            <th className="p-2.5 text-right w-36">Độ chứa (% ô)</th>
                            <th className="p-2.5 text-center w-28">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900 font-medium">
                          {allStoredGoods.length > 0 ? (
                            allStoredGoods.map((good, gIdx) => {
                              const gQty = Number(good.quantity) || 0;
                              const gPct = good.occupancyPct !== undefined
                                ? Number(good.occupancyPct)
                                : (totalStoredQty > 0 ? Math.round((gQty / totalStoredQty) * binOccupancyPct) : 100);

                              return (
                                <tr key={`stored-${gIdx}`} className="hover:bg-cyan-50/50 dark:hover:bg-slate-800/60 transition">
                                  <td className="p-2.5 text-center text-slate-400 font-bold">{gIdx + 1}</td>
                                  <td className="p-2.5">
                                    <div className="font-bold text-slate-800 dark:text-slate-100">{good.productName}</div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                                      {good.sku && (
                                        <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[10px] text-slate-600 dark:text-slate-300">
                                          SKU: {good.sku}
                                        </span>
                                      )}
                                      {good.orderCode && <span>Lô: {good.orderCode}</span>}
                                    </div>
                                  </td>
                                  <td className="p-2.5 text-center text-slate-600 dark:text-slate-300 font-bold">
                                    {good.unit || 'Cái'}
                                  </td>
                                  <td className="p-2.5 text-right">
                                    <span className="font-black text-slate-900 dark:text-white text-xs">
                                      {gQty.toLocaleString('vi-VN')} {good.unit || 'cái'}
                                    </span>
                                  </td>
                                  <td className="p-2.5 text-right">
                                    <div className="flex flex-col items-end gap-1">
                                      <span className="font-black text-cyan-700 dark:text-cyan-300">{gPct}%</span>
                                      <div className="w-20 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                        <div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, gPct)}%` }} />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <span className="text-[10px] font-black bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 px-2 py-0.5 rounded-md tracking-tight uppercase">
                                      TỒN TẠI KỆ
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={6} className="p-4 text-center text-slate-500 italic">
                                Ô kệ hiện đang trống (0% dung tích), không có hàng hóa lưu trữ.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 4. BOTTOM SECTION: ONLY SHOWN FOR OUTBOUND DEDUCTION */}
                  {!readOnly && isOutbound && (
                    <div className="rounded-2xl border-2 border-rose-300 dark:border-rose-900/70 bg-rose-50/60 dark:bg-rose-950/20 p-4 space-y-3 shadow-xs">
                      <div className="flex items-center justify-between border-b border-rose-200 dark:border-rose-900/60 pb-2">
                        <div className="flex items-center gap-2 text-xs font-black uppercase text-rose-800 dark:text-rose-300">
                          <Package className="h-4 w-4 text-rose-600" />
                          Khấu trừ xuất hàng / xuất hủy từ ô {editingBinConfig.shortCode} (Dòng trừ số lượng màu đỏ)
                        </div>
                        <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/50 px-2 py-0.5 rounded-md">
                          Tự động tính % khấu trừ & cập nhật độ chứa
                        </span>
                      </div>

                      {/* Deduction Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="text-rose-900 dark:text-rose-200 font-bold border-b border-rose-200 dark:border-rose-900/60">
                              <th className="pb-2">Mặt hàng xuất / trừ</th>
                              <th className="pb-2 text-center w-28">Tồn gốc ở ô</th>
                              <th className="pb-2 text-right w-44">Số lượng lấy đi (Trừ)</th>
                              <th className="pb-2 text-right w-40">Khấu trừ (% ô)</th>
                              <th className="pb-2 text-right w-36">Còn lại trên kệ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-rose-200/60 dark:divide-rose-900/40 font-medium">
                            {editableBinItems.map((item, idx) => {
                              const currentGood = allStoredGoods.find((g) =>
                                (item.matchedSku && g.sku === item.matchedSku) ||
                                (item.sku && g.sku === item.sku) ||
                                (g.productName === item.productName)
                              ) || allStoredGoods[0];

                              const stockQty = Number(item.stockQty !== undefined ? item.stockQty : (currentGood?.quantity || totalStoredQty || 0));
                              const stockPct = Number(item.stockPct !== undefined ? item.stockPct : (currentGood?.occupancyPct !== undefined ? currentGood.occupancyPct : binOccupancyPct));

                              const currentDeductQty = Number(item.qty) || 0;
                              const currentDeductPct = Number(item.occupancyPct) || 0;

                              const remainingQty = Math.max(0, stockQty - currentDeductQty);
                              const remainingPct = Math.max(0, Number((stockPct - currentDeductPct).toFixed(1)));

                              return (
                                <tr key={`deduct-${idx}`} className="align-middle">
                                  <td className="py-2.5 pr-2">
                                    {allStoredGoods.length > 1 ? (
                                      <div className="space-y-1">
                                        <select
                                          value={item.matchedSku || currentGood?.sku || ''}
                                          onChange={(e) => {
                                            const chosenSku = e.target.value;
                                            const chosenGood = allStoredGoods.find((g) => g.sku === chosenSku) || allStoredGoods[0];
                                            if (chosenGood) {
                                              const newStockQty = Number(chosenGood.quantity) || 0;
                                              const newStockPct = Number(chosenGood.occupancyPct !== undefined ? chosenGood.occupancyPct : 100);
                                              const newQty = Math.min(item.qty || 1, newStockQty);
                                              let newPct = 0;
                                              if (newStockQty > 0 && newStockPct > 0) {
                                                newPct = Number(((newQty / newStockQty) * newStockPct).toFixed(1));
                                                if (newPct === 0 && newQty > 0) newPct = 0.1;
                                              }
                                              setEditableBinItems((prev) =>
                                                prev.map((it, i) =>
                                                  i === idx
                                                    ? {
                                                        ...it,
                                                        productName: chosenGood.productName,
                                                        sku: chosenGood.sku,
                                                        matchedSku: chosenGood.sku,
                                                        unit: chosenGood.unit || 'Cái',
                                                        stockQty: newStockQty,
                                                        stockPct: newStockPct,
                                                        qty: newQty,
                                                        occupancyPct: newPct,
                                                      }
                                                    : it
                                                )
                                              );
                                            }
                                          }}
                                          className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-rose-500"
                                        >
                                          {allStoredGoods.map((g, gi) => (
                                            <option key={gi} value={g.sku}>
                                              {g.productName} ({g.quantity} {g.unit || 'cái'} - {g.occupancyPct}%)
                                            </option>
                                          ))}
                                        </select>
                                        <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 block">
                                          Chọn mặt hàng cần trừ từ kệ này
                                        </span>
                                      </div>
                                    ) : (
                                      <div>
                                        <span className="font-black text-slate-800 dark:text-slate-100">{item.productName}</span>
                                        {item.sku && <div className="text-[10px] font-mono text-slate-500">SKU: {item.sku}</div>}
                                      </div>
                                    )}
                                  </td>

                                  <td className="py-2.5 px-2 text-center">
                                    <span className="font-bold text-slate-700 dark:text-slate-300">
                                      {stockQty.toLocaleString('vi-VN')} {item.unit || 'cái'}
                                    </span>
                                    <div className="text-[10px] text-slate-500">({stockPct}% dung tích)</div>
                                  </td>

                                  <td className="py-2.5 px-2 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <span className="text-base font-black text-rose-600 dark:text-rose-400">-</span>
                                      <input
                                        type="number"
                                        min={0}
                                        max={stockQty > 0 ? stockQty : undefined}
                                        value={item.qty > 0 ? item.qty : ''}
                                        placeholder="0"
                                        onChange={(e) => {
                                          const val = Number(e.target.value) || 0;
                                          setEditableBinItems((prev) =>
                                            prev.map((it, i) => {
                                              if (i !== idx) return it;
                                              let calculatedPct = 0;
                                              if (stockQty > 0 && stockPct > 0) {
                                                calculatedPct = Number(((val / stockQty) * stockPct).toFixed(1));
                                                if (calculatedPct === 0 && val > 0) calculatedPct = 0.1;
                                              }
                                              return {
                                                ...it,
                                                qty: val,
                                                occupancyPct: calculatedPct > 0 ? calculatedPct : 0,
                                              };
                                            })
                                          );
                                        }}
                                        className="w-24 px-2.5 py-1.5 text-right text-xs font-black text-rose-700 dark:text-rose-300 bg-white dark:bg-slate-900 border-2 border-rose-300 dark:border-rose-800 rounded-xl focus:border-rose-600 focus:ring-2 focus:ring-rose-400/30 outline-none shadow-xs"
                                      />
                                      <span className="text-xs font-black text-rose-600 dark:text-rose-400">{item.unit || 'cái'}</span>
                                    </div>
                                  </td>

                                  <td className="py-2.5 px-2 text-right">
                                    <div className="relative inline-flex items-center justify-end w-28">
                                      <span className="text-base font-black text-rose-600 dark:text-rose-400 mr-1">-</span>
                                      <input
                                        type="number"
                                        min={0}
                                        max={stockPct > 0 ? stockPct : 100}
                                        step="0.1"
                                        value={item.occupancyPct !== undefined && item.occupancyPct !== null ? item.occupancyPct : ''}
                                        placeholder="0"
                                        onChange={(e) => {
                                          const raw = e.target.value;
                                          if (raw === '') {
                                            setEditableBinItems((prev) =>
                                              prev.map((it, i) => (i === idx ? { ...it, occupancyPct: '' as any } : it))
                                            );
                                            return;
                                          }
                                          const parsed = parseFloat(raw);
                                          const val = isNaN(parsed) ? 0 : Math.min(stockPct || 100, Math.max(0, parsed));
                                          setEditableBinItems((prev) =>
                                            prev.map((it, i) => {
                                              if (i !== idx) return it;
                                              let calcQty = it.qty;
                                              if (stockPct > 0 && stockQty > 0) {
                                                calcQty = Math.round((stockQty * val) / stockPct);
                                              }
                                              return {
                                                ...it,
                                                occupancyPct: val,
                                                qty: calcQty,
                                              };
                                            })
                                          );
                                        }}
                                        onBlur={() => {
                                          if (item.occupancyPct === ('' as any) || item.occupancyPct === undefined) {
                                            setEditableBinItems((prev) =>
                                              prev.map((it, i) => (i === idx ? { ...it, occupancyPct: 0 } : it))
                                            );
                                          }
                                        }}
                                        className="w-full px-2.5 py-1.5 pr-6 text-right text-xs font-black text-rose-700 dark:text-rose-300 bg-white dark:bg-slate-900 border-2 border-rose-300 dark:border-rose-800 rounded-xl focus:border-rose-600 focus:ring-2 focus:ring-rose-400/30 outline-none shadow-xs"
                                      />
                                      <span className="absolute right-2 top-2 text-xs font-black text-rose-500">%</span>
                                    </div>
                                  </td>

                                  <td className="py-2.5 pl-2 text-right">
                                    <div className="font-black text-emerald-700 dark:text-emerald-400 text-xs">
                                      {remainingQty.toLocaleString('vi-VN')} {item.unit || 'cái'}
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-500">
                                      Còn lại: {remainingPct}% ô
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Summary calculation of bin capacity after export */}
                      {(() => {
                        const totalExportQty = editableBinItems.reduce((acc, curr) => acc + (Number(curr.qty) || 0), 0);
                        const totalExportPct = Number(editableBinItems.reduce((acc, curr) => acc + (Number(curr.occupancyPct) || 0), 0).toFixed(1));
                        const initialBinPct = totalStoredPct > 0 ? totalStoredPct : (editingBinConfig.currentPct || 100);
                        const remainingAfterExport = Math.max(0, Number((initialBinPct - totalExportPct).toFixed(1)));
                        const remainingEmptyPct = Math.max(0, Number((100 - remainingAfterExport).toFixed(1)));

                        return (
                          <div className="mt-2 p-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 shadow-xs space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                              <div className="p-2 bg-rose-50 dark:bg-rose-950/50 rounded-lg border border-rose-200 dark:border-rose-900/60 flex flex-col">
                                <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300">Khấu trừ xuất kho:</span>
                                <span className="text-sm font-black text-rose-600 dark:text-rose-400 mt-0.5">
                                  -{totalExportQty.toLocaleString('vi-VN')} cái (-{totalExportPct}%)
                                </span>
                              </div>
                              <div className="p-2 bg-cyan-50 dark:bg-cyan-950/50 rounded-lg border border-cyan-200 dark:border-cyan-900/60 flex flex-col">
                                <span className="text-[11px] font-bold text-cyan-800 dark:text-cyan-300">Sức chứa ô còn lại (Đã chứa):</span>
                                <span className="text-sm font-black text-cyan-700 dark:text-cyan-300 mt-0.5">
                                  {remainingAfterExport}% dung tích
                                </span>
                              </div>
                              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg border border-emerald-200 dark:border-emerald-900/60 flex flex-col">
                                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">Dung tích ô còn trống:</span>
                                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                                  {remainingEmptyPct}% ô kệ
                                </span>
                              </div>
                            </div>

                            {/* Dual-color Progress bar visual */}
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden flex">
                              <div
                                className="bg-cyan-600 h-2.5 transition-all duration-300"
                                style={{ width: `${Math.min(100, remainingAfterExport)}%` }}
                                title={`Còn lưu trữ: ${remainingAfterExport}%`}
                              />
                              <div
                                className="bg-rose-500 h-2.5 transition-all duration-300"
                                style={{ width: `${Math.min(100 - remainingAfterExport, totalExportPct)}%` }}
                                title={`Khấu trừ xuất: ${totalExportPct}%`}
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </>
              );
            })()}

            {/* 5. Footer Buttons */}
            {readOnly || !isOutbound ? (
              <div className="flex items-center justify-end w-full pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingBinConfig(null)}
                  className="h-9 px-6 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm active:scale-95"
                >
                  Đóng
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setEditableBinItems((prev) => prev.map((it) => ({ ...it, qty: 0, occupancyPct: 0 })));
                  }}
                  className="h-9 px-3.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 text-xs font-bold rounded-xl transition cursor-pointer border border-rose-200 dark:border-rose-900/60"
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
                      const totalExportQty = editableBinItems.reduce((acc, curr) => acc + (Number(curr.qty) || 0), 0);
                      const totalExportPct = Number(editableBinItems.reduce((acc, curr) => acc + (Number(curr.occupancyPct) || 0), 0).toFixed(1));
                      const initialBinPct = editingBinConfig.currentPct || 100;
                      const remainingAfterExport = Math.max(0, Number((initialBinPct - totalExportPct).toFixed(1)));

                      editableBinItems.forEach((item) => {
                        if (onUpdateBinCapacity) {
                          onUpdateBinCapacity(
                            editingBinConfig.binCode,
                            Number(item.occupancyPct) || 0,
                            `REMAINING:${remainingAfterExport}`,
                            item.rowId,
                            item.qty !== undefined ? Number(item.qty) : undefined
                          );
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
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
