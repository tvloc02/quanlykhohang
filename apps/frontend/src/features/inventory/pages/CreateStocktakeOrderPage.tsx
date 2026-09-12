import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Plus,
  Trash2,
  Save,
  Printer,
  X,
  XCircle,
  CheckCircle2,
  Warehouse as WarehouseIcon,
  User,
  Package,
  ScanLine,
  RefreshCw,
  ClipboardList,
  FileText,
  Eye,
  Layers,
  Lock,
  Unlock,
  AlertTriangle,
  ChevronDown,
  Check,
} from 'lucide-react';
import MainLayout from '../../../shared/components/MainLayout';
import BarcodeScanner from '../../../shared/components/BarcodeScanner';
import { filterOutDeletedProducts } from '../../../shared/utils/productUtils';
import { SmartSlottingGridModal } from '../../warehouses/components/SmartSlottingGridModal';
import {
  getStoredWarehouses,
  saveStoredWarehouses,
  toggleWarehouseFreezeApi,
  upsertWarehouseToApi,
} from '../../../shared/utils/warehouseAssignments';
import { clearWarehouseBinsCache } from '../../warehouses/components/WarehouseSlottingGrid';

// ─── TYPES & INTERFACES ────────────────────────────────────────

const API_BASE = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

export interface ProductOption {
  id: string;
  internalSku: string;
  supplierBarcode?: string;
  name: string;
  unit?: string;
  price?: number;
  importPrice?: number;
  totalStock?: number;
  totalPhysical?: number;
  stockQty?: number;
  stockBalances?: Array<{
    id?: string;
    locationCode: string;
    totalPhysical?: number;
    allocated?: number;
    available?: number;
  }>;
  warehouseStocks?: Record<string, number>;
  defaultWarehouse?: string;
}

export interface ZoneItem {
  id?: string;
  zoneCode: string;
  zoneName: string;
  rackCode?: string;
  binCode?: string; // Mã ô kệ cụ thể, ví dụ "D1", "D2", "R01-D1"
  fullBinCode?: string; // Mã đầy đủ trong CSDL kho
  locationBin: string; // Tên hiển thị kệ: "Ô D1" hoặc "Kệ R01 - Ô D1"
  assignedBins?: string[]; // [binCode]
  systemQty: number; // Số lượng tồn trên ô kệ này
  countedQty: number; // Số lượng thực đếm trên ô kệ này
  assignedStaff: string; // Nhân viên kiểm đếm
  note: string;
  initialBinQty?: number; // Số lượng tồn ban đầu của ô kệ
}

export interface StocktakeRicItem {
  product: ProductOption & { systemQty: number };
  zones: ZoneItem[];
}

export function findStockBinForProduct(
  pId: string,
  pSku: string,
  pName: string,
  whCode?: string,
  stockBalances?: any[]
): { locationBin: string; assignedBins: string[] } {
  if (!pId && !pSku && !pName) {
    return { locationBin: '', assignedBins: [] };
  }

  const normId = String(pId || '').trim().toLowerCase();
  const normSku = String(pSku || '').trim().toLowerCase();
  const normName = String(pName || '').trim().toLowerCase();
  const targetWh = String(whCode || '').trim().toUpperCase();

  const foundBinsSet = new Set<string>();

  // Helper to filter out fake bin strings like warehouse codes
  const isValidBin = (bin: string) => {
    if (!bin) return false;
    const bUpper = bin.toUpperCase().trim();
    if (
      bUpper === targetWh ||
      bUpper === 'KH009' ||
      bUpper.startsWith('KHO-') ||
      /^KH\d{3,}$/i.test(bUpper) ||
      bUpper.includes('PHÂN KHU') ||
      bUpper.includes('KHO')
    ) {
      return false;
    }
    return true;
  };

  // 1. Check stored warehouses customBins for THIS WAREHOUSE ONLY
  try {
    const rawWhs = localStorage.getItem('smart-wms-warehouses');
    if (rawWhs) {
      const whs = JSON.parse(rawWhs);
      if (Array.isArray(whs)) {
        whs.forEach((wh: any) => {
          const wCode = String(wh.code || wh.id || '').trim().toUpperCase();
          if (targetWh && wCode !== targetWh && !wCode.includes(targetWh) && !targetWh.includes(wCode)) return;

          (wh.subWarehouses || []).forEach((sub: any) => {
            (sub.racks || []).forEach((rk: any) => {
              if (rk.customBins) {
                Object.entries(rk.customBins).forEach(([bKey, cfg]: [string, any]) => {
                  if (!cfg) return;
                  const notes = String(cfg?.notes || '').toLowerCase();
                  const pct = Number(cfg?.occupancyPct || 0);
                  const totalPhys = Number(cfg?.totalPhysical || 0);

                  const prods: any[] = Array.isArray(cfg.products) ? cfg.products : [];
                  const matchInProds = prods.some((pr: any) => {
                    const prSku = String(pr.sku || pr.productSku || '').trim().toLowerCase();
                    const prName = String(pr.name || pr.productName || '').trim().toLowerCase();
                    return (normSku && prSku === normSku) || (normName && prName === normName);
                  });

                  if (
                    (pct > 0 || totalPhys > 0) &&
                    (matchInProds ||
                      (normName && notes.includes(normName)) ||
                      (normSku && notes.includes(normSku)) ||
                      (normSku && String(cfg.sku || '').toLowerCase() === normSku))
                  ) {
                    const shortBin = (bKey.split('-').pop() || bKey).toUpperCase();
                    if (isValidBin(shortBin)) foundBinsSet.add(shortBin);
                  }
                });
              }
            });
          });
        });
      }
    }
  } catch { }

  // 2. Check stockBalances if passed or attached
  if (Array.isArray(stockBalances) && stockBalances.length > 0) {
    stockBalances.forEach((b: any) => {
      const bLoc = String(b.locationCode || '').trim().toUpperCase();
      if (!bLoc) return;
      if (targetWh && !bLoc.startsWith(targetWh) && !bLoc.includes(targetWh)) return;

      const clean = bLoc.split('(')[0].trim();
      const parts = clean.split('-');
      if (parts.length >= 3) {
        const binPart = parts.slice(2).join('-');
        if (isValidBin(binPart)) foundBinsSet.add(binPart);
      } else if (parts.length === 2 && !parts[1].startsWith('ZONE')) {
        if (isValidBin(parts[1])) foundBinsSet.add(parts[1]);
      }
    });
  }

  // 3. Check local stock-in orders for THIS WAREHOUSE ONLY
  try {
    const rawOrders = localStorage.getItem('stored_stock_in_orders');
    if (rawOrders) {
      const orders = JSON.parse(rawOrders);
      if (Array.isArray(orders)) {
        orders.forEach((ord: any) => {
          const oWh = String(ord.warehouseCode || ord.branchCode || '').trim().toUpperCase();
          if (!oWh || (targetWh && oWh !== targetWh && !oWh.includes(targetWh) && !targetWh.includes(oWh))) return;

          (ord.details || ord.items || []).forEach((item: any) => {
            const iName = String(item.productName || item.product?.name || '').trim().toLowerCase();
            const iSku = String(item.sku || item.productSku || item.product?.internalSku || '').trim().toLowerCase();
            const iId = String(item.productId || item.product?.id || '').trim().toLowerCase();

            const matches =
              (normId && iId && normId === iId) ||
              (normSku && iSku && normSku === iSku) ||
              (normName && iName && normName === iName);

            if (matches) {
              let bins: string[] = item.assignedBins || (item.locationBin ? item.locationBin.split(',') : []);
              bins.forEach((b: string) => {
                const clean = b.split('(')[0].trim();
                const short = (clean.split('-').pop() || clean).toUpperCase();
                if (isValidBin(short)) foundBinsSet.add(short);
              });
            }
          });
        });
      }
    }
  } catch { }

  const binsList = Array.from(foundBinsSet);
  if (binsList.length > 0) {
    return {
      locationBin: binsList.join(', '),
      assignedBins: binsList,
    };
  }

  return { locationBin: '', assignedBins: [] };
}

// Helper tính toán số lượng đã xuất kho (đơn xuất kho, xuất bán lẻ, xuất hủy) của từng ô kệ cụ thể
function getBinOutboundDeduction(
  targetWh: string,
  cleanLoc: string,
  rackCode: string,
  shortBin: string,
  normSku: string,
  normId: string
): number {
  let totalOut = 0;
  try {
    const rawOutbound = localStorage.getItem('stored_outbound_orders');
    if (!rawOutbound) return 0;
    const outList = JSON.parse(rawOutbound);
    if (!Array.isArray(outList)) return 0;

    const nWh = (targetWh || '').trim().toUpperCase();
    const nSku = (normSku || '').trim().toUpperCase();
    const nId = (normId || '').trim();
    const nShort = shortBin.toUpperCase().trim();
    const rCell = rackCode ? `${rackCode.toUpperCase()}-${nShort}` : '';
    const normClean = cleanLoc.replace(/[^A-Z0-9]/g, '').toUpperCase();
    const normShort = nShort.replace(/[^A-Z0-9]/g, '');

    outList.forEach((ord: any) => {
      if (ord.status === 'CANCELLED') return;
      const oWh = String(ord.warehouseCode || ord.branchCode || ord.warehouse?.code || '').trim().toUpperCase();
      if (nWh && oWh && oWh !== nWh && !oWh.includes(nWh) && !nWh.includes(oWh)) return;

      const details = Array.isArray(ord.details) ? ord.details : Array.isArray(ord.items) ? ord.items : [];
      details.forEach((item: any) => {
        const itemSku = String(item.productSku || item.sku || item.product?.internalSku || item.product?.sku || '').trim().toUpperCase();
        const itemId = String(item.productId || item.product?.id || '').trim();
        const matchesProduct = (nSku && itemSku === nSku) || (nId && itemId === nId);
        if (!matchesProduct) return;

        let rawBins: string[] = Array.isArray(item.assignedBins) ? item.assignedBins : [];
        if (rawBins.length === 0 && item.locationBin) rawBins = String(item.locationBin).split(',').map((s: string) => s.trim());
        if (rawBins.length === 0 && item.note) {
          const noteMatches = [...item.note.matchAll(/\[(?:Vị trí Ô|Vị trí|Ô):\s*([^\]]+)\]/gi)];
          noteMatches.forEach((m: any) => {
            if (m[1]) rawBins.push(m[1].trim());
          });
        }

        const isMatch = rawBins.some((b: string) => {
          const clean = b.split('(')[0].trim().toUpperCase();
          const bShort = (clean.split('-').pop() || clean).toUpperCase().trim();
          const cleanNorm = clean.replace(/[^A-Z0-9]/g, '');
          return (
            clean === cleanLoc.toUpperCase() ||
            (rCell && clean === rCell) ||
            cleanNorm === normClean ||
            clean.endsWith(`-${nShort}`) ||
            clean === nShort ||
            bShort === nShort ||
            cleanNorm.endsWith(normShort)
          );
        });

        if (isMatch) {
          totalOut += Math.abs(Number(item.qty || item.quantity || item.requiredQty || 0));
        }
      });
    });
  } catch { }
  return totalOut;
}

export function getProductWarehouseStock(p: ProductOption, whCode: string): number {
  if (!p) return 0;

  const targetCode = (whCode || '').trim().toLowerCase();
  if (!targetCode) {
    return Number(p.totalStock ?? p.totalPhysical ?? p.stockQty ?? 0);
  }

  const normSku = String(p.internalSku || '').trim().toLowerCase();
  const normName = String(p.name || '').trim().toLowerCase();
  const normId = String(p.id || '').trim().toLowerCase();

  // 1. Kiểm tra cấu hình kệ customBins trong smart-wms-warehouses ĐẦU TIÊN (Nguồn dữ liệu chuẩn xác nhất theo sơ đồ kho)
  try {
    const rawWhs = localStorage.getItem('smart-wms-warehouses');
    if (rawWhs) {
      const whs = JSON.parse(rawWhs);
      if (Array.isArray(whs)) {
        const matchedWh = whs.find((wh: any) => {
          const wCode = String(wh.code || wh.id || '').trim().toLowerCase();
          return wCode === targetCode || wCode.includes(targetCode) || targetCode.includes(wCode);
        });

        if (matchedWh) {
          let customBinSum = 0;
          let foundInCustom = false;

          (matchedWh.subWarehouses || []).forEach((sub: any) => {
            const zCode = String(sub.code || sub.id || 'PK-A').toUpperCase();
            (sub.racks || []).forEach((rk: any) => {
              const rkCode = String(rk.code || rk.id || '').toUpperCase();
              if (rk.customBins) {
                Object.entries(rk.customBins).forEach(([bKey, cfg]: [string, any]) => {
                  if (!cfg) return;
                  const prods: any[] = Array.isArray(cfg.products) && cfg.products.length > 0
                    ? cfg.products
                    : (cfg.sku || cfg.productName ? [cfg] : []);

                  prods.forEach((prodItem: any) => {
                    const iSku = String(prodItem.sku || prodItem.productSku || '').trim().toLowerCase();
                    const iName = String(prodItem.productName || prodItem.name || '').trim().toLowerCase();
                    const notes = String(cfg.notes || '').toLowerCase();

                    const matchProd =
                      (normSku && iSku && normSku === iSku) ||
                      (normName && iName && normName === iName) ||
                      (normSku && notes.includes(normSku)) ||
                      (normName && notes.includes(normName));

                    if (matchProd) {
                      const cleanBin = bKey.split('(')[0].trim();
                      const shortBin = (cleanBin.split('-').pop() || cleanBin).toUpperCase().trim();
                      const cleanLoc = cleanBin.includes('-ZONE-') ? cleanBin : `${targetCode.toUpperCase()}-${zCode}-${rkCode}-${shortBin}`;
                      const initQty = Number(prodItem.qty || prodItem.quantity || prodItem.totalPhysical || cfg.totalPhysical || 1);
                      const outDeduct = getBinOutboundDeduction(targetCode, cleanLoc, rkCode, shortBin, normSku, normId);
                      const binNet = Math.max(0, initQty - outDeduct);
                      customBinSum += binNet;
                      foundInCustom = true;
                    }
                  });
                });
              }
            });
          });

          if (foundInCustom) {
            return customBinSum;
          }
        }
      }
    }
  } catch { }

  // 2. Check stockBalances if present (Official inventory from CSDL for this warehouse)
  if (Array.isArray(p.stockBalances) && p.stockBalances.length > 0) {
    let sum = 0;
    let found = false;

    p.stockBalances.forEach((b: any) => {
      const bCode = (b.locationCode || '').trim().toLowerCase();
      if (!bCode) return;

      const normTarget = targetCode.replace(/[^a-z0-9]/g, '');
      const normB = bCode.replace(/[^a-z0-9]/g, '');

      const matches =
        bCode === targetCode ||
        bCode.startsWith(targetCode + '-') ||
        bCode.startsWith(targetCode + '_') ||
        bCode.startsWith(targetCode + '/') ||
        (normTarget && normB && (normB === normTarget || normB.startsWith(normTarget + '-'))) ||
        ((targetCode === 'kh006' || targetCode === 'kho thanh trì') &&
          (bCode === 'kh006' || bCode === 'kho thanh trì' || bCode === 'kho-nvl' || bCode.startsWith('kho-nvl-')));

      if (matches) {
        found = true;
        const qty = b.totalPhysical !== undefined && b.totalPhysical !== null ? Number(b.totalPhysical) : Number(b.available || 0);
        sum += qty;
      }
    });

    if (found) {
      // Deduct any local outbound orders recorded for this warehouse
      let localOutDeduct = 0;
      try {
        const rawOutbound = localStorage.getItem('stored_outbound_orders');
        if (rawOutbound) {
          const outboundList = JSON.parse(rawOutbound);
          if (Array.isArray(outboundList)) {
            outboundList.forEach((ord: any) => {
              if (ord.status === 'CANCELLED') return;
              const oWh = (ord.warehouseCode || ord.branchCode || '').trim().toLowerCase();
              if (oWh && oWh !== targetCode && !oWh.includes(targetCode) && !targetCode.includes(oWh)) return;
              const details = ord.details || ord.items || [];
              details.forEach((item: any) => {
                const itemProdId = String(item.productId || item.product?.id || '');
                const itemSku = String(item.productSku || item.sku || item.product?.internalSku || '').toLowerCase();
                if (
                  (itemProdId && itemProdId === String(p.id)) ||
                  (itemSku && p.internalSku && itemSku === p.internalSku.toLowerCase())
                ) {
                  localOutDeduct += Number(item.qty ?? item.quantity ?? 0);
                }
              });
            });
          }
        }
      } catch { }
      return Math.max(0, sum - localOutDeduct);
    }
  }

  // 3. Check warehouseStocks object if present on product entity
  if (p.warehouseStocks && typeof p.warehouseStocks === 'object') {
    for (const [k, v] of Object.entries(p.warehouseStocks)) {
      const kLower = k.trim().toLowerCase();
      if (
        kLower === targetCode ||
        kLower.startsWith(targetCode + '-') ||
        kLower.startsWith(targetCode + '_') ||
        ((targetCode === 'kh006' || targetCode === 'kho thanh trì') &&
          (kLower === 'kh006' || kLower === 'kho thanh trì' || kLower === 'kho-nvl'))
      ) {
        const val = Number(v);
        if (!isNaN(val)) return Math.max(0, val);
      }
    }
  }

  // 4. Check stored_stock_in_orders for this warehouse ONLY
  try {
    const rawOrders = localStorage.getItem('stored_stock_in_orders');
    if (rawOrders) {
      const orders = JSON.parse(rawOrders);
      if (Array.isArray(orders)) {
        let whInbound = 0;
        let foundInOrders = false;

        orders.forEach((ord: any) => {
          const oWh = String(ord.warehouseCode || ord.branchCode || '').trim().toLowerCase();
          if (!oWh || (oWh !== targetCode && !oWh.includes(targetCode) && !targetCode.includes(oWh))) return;

          (ord.details || ord.items || []).forEach((item: any) => {
            const iSku = String(item.sku || item.productSku || item.product?.internalSku || '').trim().toLowerCase();
            const iName = String(item.productName || item.product?.name || '').trim().toLowerCase();
            const iId = String(item.productId || item.product?.id || '').trim().toLowerCase();

            if (
              (normId && iId && normId === iId) ||
              (normSku && iSku && normSku === iSku) ||
              (normName && iName && normName === iName)
            ) {
              whInbound += Number(item.receivedQty ?? item.expectedQty ?? item.qty ?? item.quantity ?? 0);
              foundInOrders = true;
            }
          });
        });

        if (foundInOrders) {
          let whOutbound = 0;
          try {
            const rawOutbound = localStorage.getItem('stored_outbound_orders');
            if (rawOutbound) {
              const outList = JSON.parse(rawOutbound);
              if (Array.isArray(outList)) {
                outList.forEach((ord: any) => {
                  if (ord.status === 'CANCELLED') return;
                  const oWh = String(ord.warehouseCode || ord.branchCode || '').trim().toLowerCase();
                  if (!oWh || (oWh !== targetCode && !oWh.includes(targetCode) && !targetCode.includes(oWh))) return;

                  (ord.details || ord.items || []).forEach((item: any) => {
                    const iSku = String(item.productSku || item.sku || item.product?.internalSku || '').toLowerCase();
                    const iId = String(item.productId || item.product?.id || '').toLowerCase();
                    if (
                      (normId && iId && normId === iId) ||
                      (normSku && iSku && normSku === iSku)
                    ) {
                      whOutbound += Number(item.qty ?? item.quantity ?? 0);
                    }
                  });
                });
              }
            }
          } catch { }
          return Math.max(0, whInbound - whOutbound);
        }
      }
    }
  } catch { }

  // 5. Khi đã chọn kho kiểm kê cụ thể, nếu kho đó không có hàng thì trả về 0
  return 0;
}

export function findProductStockAndBinsByZone(
  p: ProductOption,
  whCode: string,
  subWarehouses: any[]
): Array<{
  zoneCode: string;
  zoneName: string;
  rackCode?: string;
  binCode?: string;
  fullBinCode?: string;
  systemQty: number;
  locationBin: string;
  assignedBins: string[];
  initialBinQty?: number;
}> {
  const normWh = (whCode || '').trim().toUpperCase();
  const totalSys = getProductWarehouseStock(p, whCode);

  const normSku = String(p.internalSku || '').trim().toLowerCase();
  const normName = String(p.name || '').trim().toLowerCase();
  const normId = String(p.id || '').trim().toLowerCase();

  // Helper to validate bin string
  const isValidBin = (bin: string) => {
    if (!bin) return false;
    const bUpper = bin.toUpperCase().trim();
    if (
      bUpper === normWh ||
      bUpper === 'KH009' ||
      bUpper.startsWith('KHO-') ||
      /^KH\d{3,}$/i.test(bUpper) ||
      bUpper.includes('PHÂN KHU') ||
      bUpper.includes('KHO')
    ) {
      return false;
    }
    return true;
  };

  const discoveredBinsMap = new Map<
    string,
    {
      zoneCode: string;
      zoneName: string;
      rackCode: string;
      binCode: string;
      fullBinCode: string;
      locationBin: string;
      systemQty: number;
      initialBinQty: number;
    }
  >();

  // 1. Kiểm tra cấu hình kệ customBins trong smart-wms-warehouses của ĐÚNG kho được chọn
  try {
    const rawWhs = localStorage.getItem('smart-wms-warehouses');
    if (rawWhs) {
      const whs = JSON.parse(rawWhs);
      if (Array.isArray(whs)) {
        const matchedWh = whs.find((w: any) => {
          const wCode = String(w.code || w.id || '').trim().toUpperCase();
          return wCode === normWh || wCode.includes(normWh) || normWh.includes(wCode);
        });

        if (matchedWh) {
          (matchedWh.subWarehouses || []).forEach((sub: any) => {
            const zCode = String(sub.code || sub.id || 'PK-A').toUpperCase();
            const zName = sub.name || `Phân khu ${zCode}`;
            (sub.racks || []).forEach((rk: any) => {
              const rkCode = String(rk.code || rk.id || '').toUpperCase();
              if (rk.customBins) {
                Object.entries(rk.customBins).forEach(([bKey, cfg]: [string, any]) => {
                  if (!cfg) return;
                  const prods: any[] = Array.isArray(cfg.products) ? cfg.products : [];
                  const matchInProds = prods.find((pr: any) => {
                    const prSku = String(pr.sku || pr.productSku || '').trim().toLowerCase();
                    const prName = String(pr.name || pr.productName || '').trim().toLowerCase();
                    return (normSku && prSku === normSku) || (normName && prName === normName);
                  });

                  const notes = String(cfg?.notes || '').toLowerCase();
                  const pct = Number(cfg?.occupancyPct || 0);
                  const totalPhys = Number(cfg?.totalPhysical || 0);

                  if (
                    (pct > 0 || totalPhys > 0) &&
                    (Boolean(matchInProds) ||
                      (normName && notes.includes(normName)) ||
                      (normSku && notes.includes(normSku)) ||
                      (normSku && String(cfg.sku || '').toLowerCase() === normSku))
                  ) {
                    const cleanBin = bKey.split('(')[0].trim();
                    const shortBin = (cleanBin.split('-').pop() || cleanBin).toUpperCase().trim();
                    if (isValidBin(shortBin)) {
                      const cleanLoc = cleanBin.includes('-ZONE-') ? cleanBin : `${normWh}-${zCode}-${rkCode}-${shortBin}`;
                      // Dùng key chuẩn hóa zCode + shortBin để tuyệt đối không bị trùng lặp kệ
                      const uniqueKey = `${zCode}___${shortBin}`;
                      const initQty = Number(matchInProds?.qty || matchInProds?.quantity || totalPhys || 1);
                      const outDeduct = getBinOutboundDeduction(normWh, cleanLoc, rkCode, shortBin, normSku, normId);
                      const netStock = Math.max(0, initQty - outDeduct);
                      const locLabel = rkCode ? `Kệ ${rkCode} - Ô ${shortBin}` : `Ô ${shortBin}`;

                      if (discoveredBinsMap.has(uniqueKey)) {
                        const existing = discoveredBinsMap.get(uniqueKey)!;
                        existing.systemQty += netStock;
                        existing.initialBinQty += initQty;
                      } else {
                        discoveredBinsMap.set(uniqueKey, {
                          zoneCode: zCode,
                          zoneName: zName,
                          rackCode: rkCode,
                          binCode: shortBin,
                          fullBinCode: cleanLoc,
                          locationBin: locLabel,
                          systemQty: netStock,
                          initialBinQty: initQty,
                        });
                      }
                    }
                  }
                });
              }
            });
          });
        }
      }
    }
  } catch { }

  // NẾU ĐÃ TÌM THẤY KỆ TỪ smart-wms-warehouses -> DỪNG NGAY LẬP TỨC!
  // Tuyệt đối không quét tiếp stockBalances hay stored_stock_in_orders để tránh bị nhân đôi kệ
  if (discoveredBinsMap.size > 0) {
    return Array.from(discoveredBinsMap.values()).map((b) => ({
      zoneCode: b.zoneCode,
      zoneName: b.zoneName,
      rackCode: b.rackCode,
      binCode: b.binCode,
      fullBinCode: b.fullBinCode,
      systemQty: b.systemQty,
      locationBin: b.locationBin,
      assignedBins: [b.binCode],
      initialBinQty: b.initialBinQty,
    }));
  }

  // 2. Check stockBalances của ĐÚNG kho kiểm kê (Chỉ dùng khi chưa cấu hình customBins trong kho)
  if (Array.isArray(p.stockBalances) && p.stockBalances.length > 0) {
    p.stockBalances.forEach((b: any) => {
      const bLoc = String(b.locationCode || '').trim().toUpperCase();
      const bQty = Number(b.totalPhysical || b.available || 0);
      let bBins: string[] = Array.isArray(b.assignedBins)
        ? b.assignedBins
        : b.locationBin
          ? String(b.locationBin).split(',').map((s) => s.trim())
          : [];

      const isWhMatch =
        bLoc === normWh ||
        bLoc.startsWith(normWh + '-') ||
        bLoc.startsWith(normWh + '_') ||
        ((normWh === 'KH006' || normWh === 'KHO-NVL' || normWh === 'KHO-TONG') &&
          (bLoc === 'KH006' || bLoc === 'KHO-NVL' || bLoc === 'KHO-TONG'));

      if (isWhMatch) {
        let targetSub =
          subWarehouses.find((s: any) => bLoc.includes((s.code || s.id || '').toUpperCase())) ||
          subWarehouses[0] || { code: 'PK-A', name: 'Phân Khu A' };

        const zCode = String(targetSub.code || targetSub.id || 'PK-A').toUpperCase();
        const zName = targetSub.name || `Phân khu ${zCode}`;

        if (bBins.length === 0) {
          const parts = bLoc.split('-');
          if (parts.length >= 3) {
            bBins = [parts.slice(2).join('-')];
          }
        }

        bBins.forEach((bin) => {
          const cleanBin = bin.split('(')[0].trim();
          const shortBin = (cleanBin.split('-').pop() || cleanBin).toUpperCase().trim();
          if (isValidBin(shortBin)) {
            const rackPrefix = cleanBin.includes('-') ? cleanBin.split('-')[0].toUpperCase() : '';
            const uniqueKey = `${zCode}___${shortBin}`;
            const locLabel = rackPrefix ? `Kệ ${rackPrefix} - Ô ${shortBin}` : `Ô ${shortBin}`;
            if (!discoveredBinsMap.has(uniqueKey)) {
              discoveredBinsMap.set(uniqueKey, {
                zoneCode: zCode,
                zoneName: zName,
                rackCode: rackPrefix,
                binCode: shortBin,
                fullBinCode: cleanBin,
                locationBin: locLabel,
                systemQty: bQty > 0 ? bQty : 1,
                initialBinQty: bQty > 0 ? bQty : 1,
              });
            }
          }
        });
      }
    });
  }

  // 3. Check local stock-in history của ĐÚNG kho kiểm kê (nếu vẫn chưa có kệ nào)
  if (discoveredBinsMap.size === 0) {
    try {
      const rawOrders = localStorage.getItem('stored_stock_in_orders');
      if (rawOrders) {
        const orders = JSON.parse(rawOrders);
        if (Array.isArray(orders)) {
          orders.forEach((ord: any) => {
            const oWh = String(ord.warehouseCode || ord.branchCode || '').trim().toUpperCase();
            if (!oWh || (normWh && oWh !== normWh && !oWh.includes(normWh) && !normWh.includes(oWh))) return;

            (ord.details || ord.items || []).forEach((item: any) => {
              const iSku = String(item.sku || item.productSku || '').trim().toUpperCase();
              const iId = String(item.productId || '').trim();
              if (iId === String(p.id) || (iSku && iSku === (p.internalSku || '').toUpperCase())) {
                let bins: string[] =
                  item.assignedBins || (item.locationBin ? item.locationBin.split(',') : []);
                const itemQty = Number(item.quantity || item.qty || 1);
                bins.forEach((b: string) => {
                  const clean = b.split('(')[0].trim().toUpperCase();
                  const short = (clean.split('-').pop() || clean).toUpperCase().trim();
                  if (isValidBin(short)) {
                    const rackPrefix = clean.includes('-') ? clean.split('-')[0] : '';
                    const sub =
                      subWarehouses.find(
                        (s) =>
                          (s.code || s.id || '').toUpperCase() === rackPrefix ||
                          (s.code || s.id || '').toUpperCase().includes(rackPrefix)
                      ) || subWarehouses[0] || { code: 'PK-A', name: 'Phân Khu A' };

                    const zCode = String(sub.code || sub.id || 'PK-A').toUpperCase();
                    const zName = sub.name || `Phân khu ${zCode}`;
                    const uniqueKey = `${zCode}___${short}`;
                    const locLabel = rackPrefix ? `Kệ ${rackPrefix} - Ô ${short}` : `Ô ${short}`;
                    if (!discoveredBinsMap.has(uniqueKey)) {
                      discoveredBinsMap.set(uniqueKey, {
                        zoneCode: zCode,
                        zoneName: zName,
                        rackCode: rackPrefix,
                        binCode: short,
                        fullBinCode: clean,
                        locationBin: locLabel,
                        systemQty: itemQty,
                        initialBinQty: itemQty,
                      });
                    }
                  }
                });
              }
            });
          });
        }
      }
    } catch { }
  }

  // 3. Fallback autoBins lookup from CSDL / localStorage
  const autoBins = findStockBinForProduct(p.id, p.internalSku, p.name, whCode);

  // If no zone entries formed yet, fallback to active sub-warehouses where total system stock or autoBins are allocated
  if (resultsMap.size === 0) {
    const firstSub = subWarehouses[0] || { code: 'PK-A', name: 'Phân Khu A' };
    const totalSys = getProductWarehouseStock(p, whCode);
    const binsSet = new Set<string>(autoBins.assignedBins || []);

    return [
      {
        zoneCode: firstSub.code || firstSub.id,
        zoneName: firstSub.name,
        systemQty: totalSys,
        locationBin: Array.from(binsSet).join(', '),
        assignedBins: Array.from(binsSet),
      },
    ];
  }

  // Ensure autoBins are also attached if missing
  if (autoBins.assignedBins.length > 0) {
    const firstRes = Array.from(resultsMap.values())[0];
    if (firstRes) {
      autoBins.assignedBins.forEach((b) => firstRes.binsSet.add(b));
    }
  }

  return Array.from(resultsMap.values()).map((res) => {
    const binsArray = Array.from(res.binsSet);
    const effectiveSysQty = res.systemQty > 0 ? res.systemQty : getProductWarehouseStock(p, whCode);
    return {
      zoneCode: res.zoneCode,
      zoneName: res.zoneName,
      systemQty: effectiveSysQty,
      locationBin: binsArray.join(', '),
      assignedBins: binsArray,
    };
  });
}

// ─── MAIN COMPONENT ────────────────────────────────────────────

export default function CreateStocktakeOrderPage({
  standalone = true,
  onBack,
}: {
  standalone?: boolean;
  onBack?: (created?: any) => void;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const userIdentifier = currentUser.fullName || currentUser.email || '';
  const userRole = currentUser.role || '';
  const isStaff = userRole === 'staff';
  const isManager = userRole === 'manager' || userRole === 'admin';

  // Form State
  const [locationCode, setLocationCode] = useState('');
  const [plannedDate, setPlannedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [createdByStaff, setCreatedByStaff] = useState(userIdentifier);
  const [note, setNote] = useState('');
  const [branch, setBranch] = useState('');
  const [purpose, setPurpose] = useState('');

  // Items State (Merged Rowspan Product Items with Zone Rows and Individual Staff Assignment)
  const [items, setItems] = useState<StocktakeRicItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Storage Info Modal State
  const [storageInfoProduct, setStorageInfoProduct] = useState<{
    productId: string;
    productSku: string;
    productName: string;
    unit: string;
  } | null>(null);
  const [storageInfoBalances, setStorageInfoBalances] = useState<any[]>([]);
  const [loadingStorageInfo, setLoadingStorageInfo] = useState(false);

  // Rack & Bin Locator Modal State (SmartSlottingGridModal)
  const [slottingTarget, setSlottingTarget] = useState<{
    product: ProductOption;
    pIdx: number;
    zIdx: number;
  } | null>(null);

  // Master Data
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // Toast Notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showSuccess = (msg: string) => setToast({ message: msg, type: 'success' });
  const showError = (msg: string) => setToast({ message: msg, type: 'error' });

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Load Master Data
  const loadMasterData = useCallback(async () => {
    try {
      const [whRes, uRes, pRes] = await Promise.all([
        fetch(`${API_BASE}/warehouses`, { headers: authHeaders() }).catch(() => null),
        fetch(`${API_BASE}/users`, { headers: authHeaders() }).catch(() => null),
        fetch(`${API_BASE}/products`, { headers: authHeaders() }).catch(() => null),
      ]);

      if (whRes && whRes.ok) {
        const whData = await whRes.json();
        setWarehouses(whData);
        if (whData.length > 0 && !locationCode) {
          // Ưu tiên chọn kho đang đóng băng đầu tiên
          const firstFrozen = whData.find((w: any) => w.isFrozen);
          setLocationCode(firstFrozen?.code || whData[0].code || whData[0].id || 'KH006');
        }
      }
      if (uRes && uRes.ok) {
        const uData = await uRes.json();
        setUsers(uData);
      }
      if (pRes && pRes.ok) {
        const pData = await pRes.json();
        setProducts(filterOutDeletedProducts(Array.isArray(pData) ? pData : pData.data || []));
      }
    } catch (err) {
      showError('Không thể tải dữ liệu danh mục');
    }
  }, [locationCode]);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  // Freeze state and quick-toggle for current warehouse
  const [freezeLoading, setFreezeLoading] = useState(false);
  const [whDropdownOpen, setWhDropdownOpen] = useState(false);
  const [freezeModalOpen, setFreezeModalOpen] = useState(false);

  const frozenWarehouses = useMemo(() => {
    return warehouses.filter((w) => Boolean(w.isFrozen));
  }, [warehouses]);

  const selectedWh = useMemo(() => {
    return warehouses.find((w) => w.code === locationCode || w.id === locationCode) || null;
  }, [warehouses, locationCode]);
  const isWhFrozen = Boolean(selectedWh?.isFrozen);

  const handleToggleFreezeCurrentWh = async () => {
    if (!selectedWh) {
      showError('Vui lòng chọn Kho kiểm kê trước!');
      return;
    }
    const nextState = !isWhFrozen;
    const actionText = nextState ? 'đóng băng' : 'mở khóa';
    setFreezeLoading(true);
    try {
      await toggleWarehouseFreezeApi(selectedWh.id || selectedWh.code, nextState, warehouses);
      // Cập nhật state nội bộ
      setWarehouses((prev) =>
        prev.map((w) => (w.id === selectedWh.id || w.code === selectedWh.code ? { ...w, isFrozen: nextState } : w))
      );
      if (nextState) {
        showSuccess(`Đã đóng băng kho "${selectedWh.name}" thành công! Kho đã sẵn sàng kiểm kê.`);
      } else {
        showSuccess(`Đã mở khóa kho "${selectedWh.name}". Các giao dịch nhập/xuất đã được mở lại.`);
        const remainingFrozen = warehouses.filter((w) => w.isFrozen && w.code !== selectedWh.code);
        setLocationCode(remainingFrozen[0]?.code || '');
      }
    } catch (err: any) {
      showError(err.message || `Lỗi khi ${actionText} kho`);
    } finally {
      setFreezeLoading(false);
    }
  };

  const handleToggleFreezeSpecificWh = async (wh: any) => {
    if (!wh) return;
    const nextState = !wh.isFrozen;
    const actionText = nextState ? 'đóng băng' : 'mở khóa';
    setFreezeLoading(true);
    try {
      await toggleWarehouseFreezeApi(wh.id || wh.code, nextState, warehouses);
      setWarehouses((prev) =>
        prev.map((w) => (w.id === wh.id || w.code === wh.code ? { ...w, isFrozen: nextState } : w))
      );
      if (nextState) {
        setLocationCode(wh.code);
        showSuccess(`Đã đóng băng kho "${wh.name}" thành công! Kho đã sẵn sàng kiểm kê.`);
      } else {
        showSuccess(`Đã mở khóa kho "${wh.name}". Các giao dịch nhập/xuất đã được mở lại.`);
        if (locationCode === wh.code) {
          const remainingFrozen = warehouses.filter((w) => w.isFrozen && (w.code !== wh.code && w.id !== wh.id));
          setLocationCode(remainingFrozen[0]?.code || '');
        }
      }
    } catch (err: any) {
      showError(err.message || `Lỗi khi ${actionText} kho`);
    } finally {
      setFreezeLoading(false);
    }
  };

  // Active Sub-Warehouses / Zones for the selected Warehouse
  const activeSubWarehouses = useMemo(() => {
    if (!locationCode) return [];
    const wh = warehouses.find((w) => w.code === locationCode || w.id === locationCode);
    if (wh && Array.isArray(wh.subWarehouses) && wh.subWarehouses.length > 0) {
      return wh.subWarehouses;
    }
    // Fallback standard sub-warehouses
    return [
      { id: 'sub_a', code: 'PK-A', name: 'Phân Khu A - Hàng Thường', zoneType: 'AMBIENT' },
      { id: 'sub_b', code: 'PK-B', name: 'Phân Khu B - Hàng Lạnh', zoneType: 'COLD' },
      { id: 'sub_c', code: 'PK-C', name: 'Phân Khu C - Hàng Giá Trị Cao', zoneType: 'THERMAL' },
    ];
  }, [locationCode, warehouses]);

  // Recalculate zone rows & systemQty when warehouse changes
  useEffect(() => {
    if (!locationCode) return;
    setItems((prev) => {
      return prev.map((item) => {
        const fullProduct = products.find((p) => p.id === item.product.id) || item.product;
        const binLocations = findProductStockAndBinsByZone(fullProduct, locationCode, activeSubWarehouses);

        const updatedZones: ZoneItem[] = binLocations.map((bLoc) => {
          const existingMatch = item.zones.find(
            (z) =>
              (z.fullBinCode && bLoc.fullBinCode && z.fullBinCode.toUpperCase() === bLoc.fullBinCode.toUpperCase()) ||
              (z.binCode && bLoc.binCode && z.binCode.toUpperCase() === bLoc.binCode.toUpperCase()) ||
              (z.zoneCode.toLowerCase() === bLoc.zoneCode.toLowerCase() && !z.binCode && !bLoc.binCode)
          );
          return {
            zoneCode: bLoc.zoneCode,
            zoneName: bLoc.zoneName,
            rackCode: bLoc.rackCode,
            binCode: bLoc.binCode,
            fullBinCode: bLoc.fullBinCode,
            locationBin: bLoc.locationBin,
            assignedBins: bLoc.assignedBins,
            systemQty: bLoc.systemQty,
            countedQty:
              existingMatch && existingMatch.countedQty !== existingMatch.systemQty
                ? existingMatch.countedQty
                : bLoc.systemQty,
            assignedStaff: existingMatch?.assignedStaff || userIdentifier || 'System Administrator',
            note:
              bLoc.locationBin && bLoc.locationBin !== 'Chưa xếp ô'
                ? `[Kệ: ${bLoc.locationBin}]`
                : existingMatch?.note && !existingMatch.note.includes('[Kệ:')
                  ? existingMatch.note
                  : '',
            initialBinQty: bLoc.initialBinQty,
          };
        });

        const totalSys = updatedZones.reduce((sum, z) => sum + (z.systemQty || 0), 0);

        return {
          ...item,
          product: {
            ...item.product,
            systemQty: totalSys,
          },
          zones: updatedZones,
        };
      });
    });
  }, [locationCode, products, activeSubWarehouses, userIdentifier]);

  // Click outside listener to close search dropdown & warehouse dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('.product-search-box')) {
        setShowDropdown(false);
      }
      if (!target.closest('.warehouse-dropdown-container')) {
        setWhDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Open Storage Info Modal
  const handleOpenStorageInfo = async (product: ProductOption) => {
    if (!product?.id) {
      showError('Vui lòng chọn hàng hóa trước khi xem thông tin lưu trữ');
      return;
    }
    setStorageInfoProduct({
      productId: product.id,
      productSku: product.internalSku || 'SKU',
      productName: product.name || 'Hàng hóa',
      unit: product.unit || 'Cái',
    });
    setLoadingStorageInfo(true);
    try {
      const res = await fetch(`${API_BASE}/products/${product.id}`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setStorageInfoBalances(data.stockBalances || []);
      } else {
        setStorageInfoBalances(product.stockBalances || []);
      }
    } catch {
      setStorageInfoBalances(product.stockBalances || []);
    } finally {
      setLoadingStorageInfo(false);
    }
  };

  // Staff options lookup with fallback
  const staffList = useMemo(() => {
    const list = Array.isArray(users) ? users : [];
    if (list.length > 0) return list;
    return [
      { id: 'u1', fullName: 'System Administrator', role: 'admin' },
      { id: 'u2', fullName: 'Nguyễn Văn Kiểm (NV Kho)', role: 'staff' },
      { id: 'u3', fullName: 'Trần Thị Kiểm (NV Kho)', role: 'staff' },
      { id: 'u4', fullName: 'Hoàng Minh Tuấn (Quản lý)', role: 'manager' },
    ];
  }, [users]);

  // Add Product (Automatically populates sub-warehouses & shelf/bins from CSDL)
  const handleAddProduct = (p: any) => {
    if (items.some((item) => item.product.id === p.id)) {
      showError(`Sản phẩm [${p.internalSku}] đã có trong danh sách kiểm kê.`);
      setProductSearch('');
      setShowDropdown(false);
      return;
    }

    const zoneLocations = findProductStockAndBinsByZone(p, locationCode, activeSubWarehouses);

    const initialZones: ZoneItem[] = zoneLocations.map((zLoc) => ({
      zoneCode: zLoc.zoneCode,
      zoneName: zLoc.zoneName,
      rackCode: zLoc.rackCode,
      binCode: zLoc.binCode,
      fullBinCode: zLoc.fullBinCode,
      locationBin: zLoc.locationBin,
      assignedBins: zLoc.assignedBins,
      systemQty: zLoc.systemQty,
      countedQty: zLoc.systemQty,
      assignedStaff: userIdentifier || 'System Administrator',
      note: zLoc.locationBin && zLoc.locationBin !== 'Chưa xếp ô' ? `[Kệ: ${zLoc.locationBin}]` : '',
      initialBinQty: zLoc.initialBinQty,
    }));

    const totalSys = initialZones.reduce((sum, z) => sum + (z.systemQty || 0), 0);

    setItems((prev) => [
      ...prev,
      {
        product: {
          id: p.id,
          internalSku: p.internalSku,
          supplierBarcode: p.supplierBarcode,
          name: p.name,
          unit: p.unit || 'Cái',
          price: p.price ?? p.importPrice ?? 0,
          stockBalances: p.stockBalances || [],
          systemQty: totalSys,
        },
        zones: initialZones,
      },
    ]);
    setProductSearch('');
    setShowDropdown(false);
  };

  // Update Counted Qty for a specific Zone
  const handleUpdateZoneCounted = (productIndex: number, zoneIndex: number, val: number) => {
    setItems((prev) => {
      const next = [...prev];
      const prod = { ...next[productIndex] };
      const zones = [...prod.zones];
      zones[zoneIndex] = { ...zones[zoneIndex], countedQty: val >= 0 ? val : 0 };
      prod.zones = zones;
      next[productIndex] = prod;
      return next;
    });
  };

  // Update Zone Code / Name
  const handleUpdateZoneCode = (productIndex: number, zoneIndex: number, newZCode: string) => {
    const selectedZone = activeSubWarehouses.find((s: any) => s.code === newZCode || s.id === newZCode);
    const newZName = selectedZone?.name || `Phân khu ${newZCode}`;

    setItems((prev) => {
      const next = [...prev];
      const prod = { ...next[productIndex] };
      const zones = [...prod.zones];
      zones[zoneIndex] = {
        ...zones[zoneIndex],
        zoneCode: newZCode,
        zoneName: newZName,
      };
      prod.zones = zones;
      next[productIndex] = prod;
      return next;
    });
  };

  // Update Assigned Staff per Zone/Product Row
  const handleUpdateZoneStaff = (productIndex: number, zoneIndex: number, staffName: string) => {
    setItems((prev) => {
      const next = [...prev];
      const prod = { ...next[productIndex] };
      const zones = [...prod.zones];
      zones[zoneIndex] = { ...zones[zoneIndex], assignedStaff: staffName };
      prod.zones = zones;
      next[productIndex] = prod;
      return next;
    });
  };

  // Update Note for a specific Zone
  const handleUpdateZoneNote = (productIndex: number, zoneIndex: number, val: string) => {
    setItems((prev) => {
      const next = [...prev];
      const prod = { ...next[productIndex] };
      const zones = [...prod.zones];
      zones[zoneIndex] = { ...zones[zoneIndex], note: val };
      prod.zones = zones;
      next[productIndex] = prod;
      return next;
    });
  };

  // Delete a specific Zone sub-row
  const handleRemoveZoneRow = (productIndex: number, zoneIndex: number) => {
    setItems((prev) => {
      const next = [...prev];
      const prod = { ...next[productIndex] };
      const zones = prod.zones.filter((_, idx) => idx !== zoneIndex);
      if (zones.length === 0) {
        // If all zones removed, remove whole product
        return prev.filter((_, idx) => idx !== productIndex);
      }
      prod.zones = zones;
      next[productIndex] = prod;
      return next;
    });
  };

  // Add a new Zone sub-row to a Product
  const handleAddZoneToProduct = (productIndex: number) => {
    setItems((prev) => {
      const next = [...prev];
      const prod = { ...next[productIndex] };
      const existingZoneCodes = prod.zones.map((z) => z.zoneCode);
      const remainingZone =
        activeSubWarehouses.find((s: any) => !existingZoneCodes.includes(s.code || s.id)) ||
        activeSubWarehouses[0];

      const zCode = remainingZone?.code || remainingZone?.id || `PK-NEW`;
      const zName = remainingZone?.name || `Phân khu ${zCode}`;

      prod.zones = [
        ...prod.zones,
        {
          zoneCode: zCode,
          zoneName: zName,
          rackCode: '',
          binCode: '',
          fullBinCode: '',
          locationBin: 'Chưa xếp ô',
          assignedBins: [],
          systemQty: 0,
          countedQty: 0,
          assignedStaff: userIdentifier || 'System Administrator',
          note: '',
          initialBinQty: 0,
        },
      ];
      next[productIndex] = prod;
      return next;
    });
  };

  const handleClose = (createdData?: any) => {
    if (onBack) {
      onBack(createdData);
    } else {
      navigate('/inventory/stocktake', {
        state: {
          newCreatedStocktake: createdData || true,
          refreshTime: Date.now(),
        },
        replace: true,
      });
    }
  };

  // Submit Stocktake Order
  const executeSubmit = async (finalStatus: string = 'DRAFT', isPrint: boolean = false) => {
    if (!locationCode) {
      showError('Vui lòng chọn Kho kiểm kê');
      return;
    }
    if (!isWhFrozen) {
      showError(
        `Kho "${selectedWh?.name || locationCode}" chưa được đóng băng! Vui lòng bấm nút "Đóng băng kho này" ở góc trên bên phải trước khi lưu phiếu.`
      );
      return;
    }
    if (items.length === 0 && finalStatus !== 'DRAFT') {
      showError('Vui lòng chọn ít nhất 1 sản phẩm để kiểm kê');
      return;
    }
    setSubmitting(true);
    try {
      // Flatten all zones per product into backend items payload
      const itemsPayload: any[] = [];
      const productIds: string[] = [];

      items.forEach((item) => {
        const pId = String(item.product.id || item.product.internalSku);
        if (!productIds.includes(pId)) productIds.push(pId);

        item.zones.forEach((z) => {
          itemsPayload.push({
            productId: pId,
            countedQty: Number(z.countedQty) >= 0 ? Number(z.countedQty) : 0,
            assignee: z.assignedStaff || createdByStaff || userIdentifier,
            note: z.locationBin && z.locationBin !== 'Chưa xếp ô'
              ? `[${z.zoneName || z.zoneCode} - ${z.locationBin}] ${z.note || ''}`
              : z.note
                ? `[${z.zoneName || z.zoneCode}] ${z.note}`
                : `[${z.zoneName || z.zoneCode}]`,
          });
        });
      });

      const isRequest = searchParams.get('mode') === 'request' || !isManager;

      const res = await fetch(`${API_BASE}/inventory/stocktakes`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          locationCode,
          plannedDate: plannedDate ? new Date(plannedDate).toISOString() : undefined,
          assignee: createdByStaff || userIdentifier,
          note: note.trim() || undefined,
          isRequest: isRequest || undefined,
          createdBy: userIdentifier,
          branch,
          purpose,
          status: finalStatus,
          items: itemsPayload.length > 0 ? itemsPayload : undefined,
          productIds: productIds.length > 0 ? productIds : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Không thể tạo phiếu kiểm kê');
      }
      const created = await res.json();

      if (
        finalStatus === 'COUNTING_DONE' &&
        items.length > 0 &&
        created.status !== 'COUNTING_DONE' &&
        created.status !== 'REQUESTED'
      ) {
        await fetch(`${API_BASE}/inventory/stocktakes/${created.id}/finish-counting`, {
          method: 'POST',
          headers: authHeaders(),
        }).catch(() => null);
      }

      // Cập nhật lại số lượng tồn thực tế của từng ô kệ vào CSDL kho (smart-wms-warehouses & Backend API)
      try {
        const normWh = (locationCode || '').trim().toUpperCase();
        const rawWhs = localStorage.getItem('smart-wms-warehouses');
        if (rawWhs) {
          const whs = JSON.parse(rawWhs);
          if (Array.isArray(whs)) {
            const targetWh = whs.find((w: any) => {
              const wCode = String(w.code || w.id || '').trim().toUpperCase();
              return wCode === normWh || wCode.includes(normWh) || normWh.includes(wCode);
            });

            if (targetWh && Array.isArray(targetWh.subWarehouses)) {
              let whChanged = false;

              items.forEach((item) => {
                const normSku = String(item.product.internalSku || '').trim().toLowerCase();
                const normName = String(item.product.name || '').trim().toLowerCase();

                item.zones.forEach((zone) => {
                  const counted = Number(zone.countedQty) >= 0 ? Number(zone.countedQty) : 0;
                  const targetBinCode = (zone.binCode || '').trim().toUpperCase();
                  const targetFullBin = (zone.fullBinCode || '').trim().toUpperCase();

                  if (!targetBinCode && !targetFullBin) return;

                  targetWh.subWarehouses.forEach((sub: any) => {
                    (sub.racks || []).forEach((rk: any) => {
                      if (!rk.customBins) rk.customBins = {};

                      const binKeys = Object.keys(rk.customBins);
                      let matchedKey = binKeys.find((k) => {
                        const cleanK = k.split('(')[0].trim().toUpperCase();
                        const shortK = (cleanK.split('-').pop() || cleanK).toUpperCase();
                        return (
                          (targetFullBin && cleanK === targetFullBin) ||
                          (targetBinCode && (shortK === targetBinCode || cleanK === targetBinCode))
                        );
                      });

                      if (!matchedKey && targetBinCode) {
                        const rkCode = String(rk.code || rk.id || '').toUpperCase();
                        if (zone.rackCode && rkCode === zone.rackCode.toUpperCase()) {
                          matchedKey = targetBinCode;
                        }
                      }

                      if (matchedKey) {
                        const cfg = rk.customBins[matchedKey] || {};
                        let prods: any[] = Array.isArray(cfg.products) ? [...cfg.products] : [];

                        const pIdx = prods.findIndex((p: any) => {
                          const pSku = String(p.sku || p.productSku || '').trim().toLowerCase();
                          const pName = String(p.name || p.productName || '').trim().toLowerCase();
                          return (normSku && pSku === normSku) || (normName && pName === normName);
                        });

                        if (pIdx >= 0) {
                          prods[pIdx] = {
                            ...prods[pIdx],
                            qty: counted,
                            quantity: counted,
                          };
                        } else if (counted > 0) {
                          prods.push({
                            sku: item.product.internalSku,
                            productSku: item.product.internalSku,
                            productName: item.product.name,
                            name: item.product.name,
                            qty: counted,
                            quantity: counted,
                            unit: item.product.unit || 'Cái',
                            occupancyPct: Math.min(
                              100,
                              Math.max(10, Math.round((counted / (cfg.maxCapacity || 500)) * 100))
                            ),
                          });
                        }

                        const totalPhysical =
                          prods.length > 0
                            ? prods.reduce((sum: number, p: any) => sum + Number(p.qty || p.quantity || 0), 0)
                            : counted;

                        const maxCap = Number(cfg.maxCapacity || 500);
                        const occupancyPct =
                          totalPhysical > 0 ? Math.min(100, Math.round((totalPhysical / maxCap) * 100)) : 0;

                        const descNotes =
                          prods.length > 0
                            ? prods
                              .map((p: any) => `${p.productName || p.name}: ${p.qty || p.quantity} ${p.unit || 'Cái'}`)
                              .join(', ')
                            : totalPhysical > 0
                              ? `${item.product.name}: ${totalPhysical} ${item.product.unit || 'Cái'}`
                              : 'Ô Trống';

                        rk.customBins[matchedKey] = {
                          ...cfg,
                          totalPhysical,
                          occupancyPct,
                          products: prods,
                          notes: descNotes,
                          productName:
                            prods.map((p: any) => p.productName || p.name).join(', ') ||
                            (totalPhysical > 0 ? item.product.name : 'Ô Trống'),
                          sku:
                            prods.map((p: any) => p.sku || p.productSku).filter(Boolean).join(', ') ||
                            (totalPhysical > 0 ? item.product.internalSku : ''),
                        };

                        whChanged = true;
                      }
                    });
                  });
                });
              });

              if (whChanged) {
                saveStoredWarehouses(whs);
                clearWarehouseBinsCache();
                window.dispatchEvent(new Event('storage'));
                upsertWarehouseToApi(targetWh).catch((e: any) =>
                  console.warn('Lỗi lưu CSDL kho sau kiểm kê:', e)
                );
              }
            }
          }
        }
      } catch (errSync) {
        console.warn('Lỗi cập nhật ô kệ sau kiểm kê:', errSync);
      }

      showSuccess(`Đã lưu thành công phiếu kiểm kê ${created.stocktakeNo || ''}!`);

      if (isPrint) {
        window.print();
      }

      localStorage.setItem(
        'recent_stocktake_created',
        JSON.stringify({
          id: created.id,
          stocktakeNo: created.stocktakeNo,
          createdAt: created.createdAt || new Date().toISOString(),
          plannedDate: created.plannedDate,
          timestamp: Date.now(),
        }),
      );

      setTimeout(() => {
        handleClose(created);
      }, 600);
    } catch (err: any) {
      showError(err.message || 'Lỗi khi lưu phiếu kiểm kê');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter products for quick search dropdown (prioritize products with stock in selected warehouse)
  const filteredProducts = useMemo(() => {
    const kw = productSearch.trim().toLowerCase();
    const baseList = !kw
      ? products
      : products.filter((p) => {
        const matchCode =
          p.internalSku?.toLowerCase().includes(kw) || p.supplierBarcode?.toLowerCase().includes(kw);
        const matchName = p.name?.toLowerCase().includes(kw);
        return matchCode || matchName;
      });

    if (!locationCode) return baseList;

    return [...baseList].sort((a, b) => {
      const stockA = getProductWarehouseStock(a, locationCode);
      const stockB = getProductWarehouseStock(b, locationCode);
      if (stockA > 0 && stockB <= 0) return -1;
      if (stockA <= 0 && stockB > 0) return 1;
      return 0;
    });
  }, [products, productSearch, locationCode]);

  // Overall Statistics Aggregated Across Products & Zones
  const totalSystemQty = items.reduce(
    (sum, item) => sum + item.zones.reduce((zSum, z) => zSum + (z.systemQty || 0), 0),
    0
  );
  const totalCountedQty = items.reduce(
    (sum, item) => sum + item.zones.reduce((zSum, z) => zSum + Number(z.countedQty || 0), 0),
    0
  );
  const totalDifference = totalCountedQty - totalSystemQty;

  const contentMarkup = (
    <div className="space-y-4 pb-24 animate-[fadeIn_0.2s_ease-out]">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-20 right-6 z-[99999] pointer-events-none transition-all duration-300">
          <div
            className={`pointer-events-auto flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-lg border transition-all animate-in slide-in-from-top-4 duration-200 ${toast.type === 'error'
                ? 'bg-red-50 text-red-600 border-red-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
          >
            {toast.type === 'error' ? (
              <XCircle size={20} className="shrink-0 text-red-600" />
            ) : (
              <CheckCircle2 size={20} className="shrink-0 text-emerald-600" />
            )}
            <p className="text-xs sm:text-sm font-bold tracking-normal">{toast.message}</p>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-2 rounded-lg p-1 hover:bg-black/5 transition cursor-pointer"
              title="Đóng thông báo"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {scannerOpen && (
        <BarcodeScanner
          isOpen={scannerOpen}
          onProductFound={(scanned) => {
            const matchProduct =
              products.find(
                (p) =>
                  p.id === scanned.id ||
                  p.internalSku === scanned.internalSku ||
                  p.supplierBarcode === scanned.internalSku
              ) || scanned;
            handleAddProduct(matchProduct);
            showSuccess(`Đã quét mã sản phẩm: ${scanned.name || scanned.internalSku}`);
          }}
          onClose={() => setScannerOpen(false)}
          title="Quét Barcode Hàng Hóa Kiểm Kê"
        />
      )}

      {/* Storage Info Modal (Xem thông tin lưu trữ tất cả các kho) */}
      {storageInfoProduct && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 animate-[fadeIn_0.2s_ease-out]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <WarehouseIcon className="h-5 w-5 text-cyan-600" />
                <h3 className="text-sm font-black uppercase text-slate-800 tracking-wide">
                  THÔNG TIN LƯU TRỮ KHO - {storageInfoProduct.productSku}
                </h3>
              </div>
              <button
                onClick={() => setStorageInfoProduct(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 rounded-xl border border-cyan-200 bg-cyan-50/60 p-3 flex items-center justify-between text-xs">
              <div>
                <span className="font-extrabold text-slate-700">Tên hàng hóa: </span>
                <span className="font-bold text-cyan-950">{storageInfoProduct.productName}</span>
              </div>
              <div>
                <span className="font-extrabold text-slate-700">Tổng tồn hệ thống: </span>
                <span className="font-black text-cyan-700 font-mono text-sm">
                  {(
                    storageInfoBalances.reduce(
                      (s, b) => s + (Number(b.available) || Number(b.totalPhysical) || 0),
                      0
                    )
                  ).toLocaleString('vi-VN')}{' '}
                  {storageInfoProduct.unit}
                </span>
              </div>
            </div>

            {loadingStorageInfo ? (
              <div className="py-10 text-center text-xs font-bold text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-cyan-600" />
                Đang tải vị trí kho lưu trữ...
              </div>
            ) : storageInfoBalances.length === 0 ? (
              <div className="py-8 text-center text-xs font-semibold text-slate-400 italic bg-slate-50 rounded-xl border border-slate-200">
                Chưa có ghi nhận tồn kho chi tiết tại các vị trí.
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto custom-scrollbar border rounded-xl border-slate-200">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 font-extrabold text-slate-700 uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 text-center w-12">STT</th>
                      <th className="p-2.5">Mã kho / Vị trí</th>
                      <th className="p-2.5 text-center">Tồn vật lý</th>
                      <th className="p-2.5 text-center">Đã giữ (Allocated)</th>
                      <th className="p-2.5 text-center text-cyan-800 font-black">Khả dụng (Available)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {storageInfoBalances.map((b, idx) => {
                      const avail = Number(b.available || 0);
                      const phys = Number(b.totalPhysical || avail);
                      const alloc = Number(b.allocated || 0);
                      const whMatch = warehouses.find(
                        (w) => w.code === b.locationCode || w.id === b.locationCode
                      );
                      const whName = whMatch ? `${whMatch.name} (${b.locationCode})` : b.locationCode;

                      return (
                        <tr key={b.id || idx} className="hover:bg-cyan-50/50 font-medium">
                          <td className="p-2 text-center text-slate-500 font-bold">{idx + 1}</td>
                          <td className="p-2 font-bold text-slate-800">{whName}</td>
                          <td className="p-2 text-center font-mono font-bold text-slate-700">
                            {phys.toLocaleString('vi-VN')}
                          </td>
                          <td className="p-2 text-center font-mono font-semibold text-amber-700">
                            {alloc.toLocaleString('vi-VN')}
                          </td>
                          <td className="p-2 text-center font-mono font-black text-emerald-600 bg-emerald-50/50">
                            {avail.toLocaleString('vi-VN')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setStorageInfoProduct(null)}
                className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}



      {/* ═══ 1. TOP HEADER BAR ═══ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-3 rounded-xl bg-cyan-600 px-5 py-2.5 text-white shadow-sm">
          <ClipboardList className="h-6 w-6" />
          <h1 className="text-base font-black tracking-wide uppercase">TẠO PHIẾU KIỂM KÊ HÀNG HÓA</h1>
        </div>

        <div className="flex items-center">
          {/* Nút Quay lại duy nhất ở góc phải theo yêu cầu */}
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-xs font-bold whitespace-nowrap text-slate-700 shadow-xs hover:bg-slate-100 hover:border-slate-400 hover:text-slate-900 transition active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span>Quay lại</span>
          </button>
        </div>
      </div>

      {/* ═══ 2. FORM METADATA CONTROL BAR ═══ */}
      <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Ngày kiểm kê */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Ngày kiểm kê</label>
            <input
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-800 outline-none focus:border-cyan-600 cursor-pointer shadow-2xs"
            />
          </div>

          {/* Mã phiếu kiểm */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Mã phiếu kiểm kê</label>
            <input
              type="text"
              readOnly
              placeholder="MÃ TỰ ĐỘNG (KK...)"
              className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 text-xs font-bold text-cyan-800 uppercase outline-none focus:border-cyan-600"
            />
          </div>

          {/* Chọn Kho kiểm kê (Custom Dropdown Bo Góc Cao Ráo h-11, Không emoji, Chỉ hiện kho đã đóng băng) */}
          <div className="relative warehouse-dropdown-container">
            <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
              <WarehouseIcon className="h-3.5 w-3.5 text-cyan-600" />
              <span>Kho kiểm kê (*)</span>
            </label>

            {/* Custom Select Box Taller h-11 */}
            <button
              type="button"
              onClick={() => setWhDropdownOpen((prev) => !prev)}
              className="h-11 w-full flex items-center justify-between rounded-xl border-2 border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-800 outline-none hover:border-cyan-600 focus:border-cyan-600 transition cursor-pointer shadow-2xs"
            >
              <span className="truncate">
                {selectedWh && isWhFrozen
                  ? `[${selectedWh.code}] ${selectedWh.name}`
                  : frozenWarehouses.length > 0
                    ? '— Chọn kho kiểm kê —'
                    : '— Chưa có kho nào đóng băng —'}
              </span>
              <ChevronDown className={`h-4.5 w-4.5 text-slate-500 transition-transform duration-200 shrink-0 ${whDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Menu Sổ Xuống với styles bo góc cao cấp, không dùng mặc định của trình duyệt */}
            {whDropdownOpen && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150">
                <div className="max-h-52 overflow-y-auto space-y-1">
                  {frozenWarehouses.length > 0 ? (
                    frozenWarehouses.map((wh) => (
                      <div
                        key={wh.id || wh.code}
                        onClick={() => {
                          setLocationCode(wh.code);
                          setWhDropdownOpen(false);
                        }}
                        className={`flex items-center justify-between rounded-lg px-3.5 py-2.5 text-xs font-bold cursor-pointer transition ${locationCode === wh.code
                            ? 'bg-cyan-50 text-cyan-900 font-extrabold'
                            : 'text-slate-700 hover:bg-slate-100 hover:text-cyan-800'
                          }`}
                      >
                        <span>[{wh.code}] {wh.name}</span>
                        {locationCode === wh.code && <Check className="h-3.5 w-3.5 text-cyan-600 shrink-0" />}
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-xs font-medium text-slate-500 italic">
                      Không có kho nào đang đóng băng
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-1 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setWhDropdownOpen(false);
                      setFreezeModalOpen(true);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold text-cyan-700 hover:bg-cyan-50 transition cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Đóng băng kho để kiểm kê</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Người lập / Quản lý phiếu */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-cyan-600" />
              <span>Người tạo / Quản lý</span>
            </label>
            <input
              type="text"
              value={createdByStaff}
              readOnly
              className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 text-xs font-bold text-slate-700 outline-none"
            />
          </div>
        </div>
      </div>

      {/* ═══ 3. DUAL PANE MAIN SECTION ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ── LEFT COLUMN (9/12 width): PRODUCT TABLE WITH ROWSPAN ── */}
        <div className="lg:col-span-9 flex flex-col rounded-2xl border-2 border-slate-200 bg-white shadow-xs overflow-hidden">
          {/* Section Header */}
          <div className="px-3 py-2 border-b-2 border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2 text-cyan-800 font-extrabold text-xs">
              <Package className="h-4 w-4 text-cyan-600" />
              <span>DANH SÁCH HÀNG HÓA KIỂM KÊ ({items.length} SẢN PHẨM)</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg border-2 border-cyan-600 bg-white px-3 py-1 text-xs font-bold text-cyan-700 hover:bg-cyan-50 transition cursor-pointer"
              >
                <ScanLine className="h-3.5 w-3.5 text-cyan-600" />
                <span>Quét Barcode</span>
              </button>

              <button
                type="button"
                onClick={loadMasterData}
                className="inline-flex items-center gap-1 rounded-lg border-2 border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                title="Làm mới dữ liệu"
              >
                <RefreshCw className="h-3.5 w-3.5 text-cyan-600" />
                <span>Làm mới</span>
              </button>
            </div>
          </div>

          {/* Quick Search Input */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 product-search-box">
            <div className="relative">
              <input
                type="text"
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setShowDropdown(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredProducts.length > 0) {
                    e.preventDefault();
                    handleAddProduct(filteredProducts[0]);
                  }
                }}
                onFocus={() => setShowDropdown(true)}
                onClick={() => setShowDropdown(true)}
                placeholder="Gõ mã hoặc tên hàng hóa để tìm kiếm (Bấm Enter để chọn)..."
                className="h-10 w-full rounded-lg border-2 border-cyan-500/60 bg-white px-3.5 pl-10 text-xs font-bold text-slate-800 outline-none shadow-2xs focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-600" />

              {/* DROPDOWN SEARCH RESULTS TABLE */}
              {showDropdown && (
                <div
                  className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-72 overflow-hidden rounded-xl border-2 border-cyan-500/50 bg-white shadow-2xl flex flex-col animate-in fade-in duration-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex bg-slate-100 border-b border-slate-200 px-3.5 py-2 text-[11px] font-extrabold text-slate-700 uppercase">
                    <span className="w-1/2">MÃ / TÊN HÀNG HÓA</span>
                    <span className="w-1/4 text-center">GIÁ BÁN</span>
                    <span className="w-1/4 text-center text-cyan-700">TỒN KHO ({locationCode})</span>
                  </div>

                  <div className="overflow-y-auto flex-1 max-h-60 divide-y divide-slate-100 custom-scrollbar">
                    {filteredProducts.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400 font-medium">
                        {productSearch.trim()
                          ? 'Không tìm thấy hàng hóa phù hợp'
                          : 'Gõ từ khóa để tìm kiếm hàng hóa trong hệ thống'}
                      </div>
                    ) : (
                      filteredProducts.map((p) => {
                        const systemQty = getProductWarehouseStock(p, locationCode);
                        const price = p.price ?? p.importPrice ?? 0;
                        return (
                          <div
                            key={p.id}
                            onClick={() => handleAddProduct(p)}
                            className="flex items-center px-3.5 py-2.5 hover:bg-cyan-50/80 cursor-pointer text-xs text-slate-700 transition"
                          >
                            <div className="w-1/2 pr-2">
                              <p className="font-extrabold text-cyan-800">{p.internalSku}</p>
                              <p className="text-xs text-slate-800 font-bold truncate">{p.name}</p>
                            </div>
                            <span className="w-1/4 text-center text-slate-600 font-semibold font-mono">
                              {price > 0 ? price.toLocaleString('vi-VN') + ' đ' : '0.00'}
                            </span>
                            <span className="w-1/4 text-center text-cyan-700 font-black text-sm font-mono">
                              {systemQty.toLocaleString('vi-VN')}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200 px-3.5 py-2 bg-slate-50 text-xs text-slate-500 font-bold">
                    <span>Tìm thấy {filteredProducts.length} sản phẩm</span>
                    <button
                      type="button"
                      onClick={() => setShowDropdown(false)}
                      className="text-red-500 hover:text-red-700 font-extrabold cursor-pointer"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* TABLE WITH ROUNDED BORDERS & COLOR PALETTE MATCHING INBOUND CREATE */}
          <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1 min-h-0">
            <table className="w-full text-left border-collapse text-xs min-w-[1050px]">
              <thead className="bg-slate-100 text-slate-700 font-black border-b-2 border-slate-200 uppercase text-xs sticky top-0 z-10">
                <tr>
                  <th className="p-2.5 w-12 text-center bg-slate-100 border-r border-slate-200">STT</th>
                  <th className="p-2.5 w-28 text-center bg-slate-100 border-r border-slate-200">MÃ HÀNG</th>
                  <th className="p-2.5 min-w-[200px] text-center bg-slate-100 border-r border-slate-200">TÊN HÀNG HÓA</th>
                  <th className="p-2.5 w-20 text-center bg-slate-100 border-r border-slate-200">ĐVT</th>
                  <th className="p-2.5 w-60 text-center bg-slate-100 border-r border-slate-200">
                    PHÂN KHU & Ô KỆ KIỂM KÊ
                  </th>
                  <th className="p-2.5 w-28 text-center bg-slate-100 border-r border-slate-200">
                    SỐ TỒN KHO
                  </th>
                  <th className="p-2.5 min-w-[140px] text-center bg-slate-100 border-r border-slate-200">GHI CHÚ</th>
                  <th className="p-2.5 w-20 text-center bg-slate-100">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-20 text-center text-xs text-slate-400 font-semibold italic">
                      Chưa có hàng hóa nào được chọn để kiểm kê.
                      <br />
                      Vui lòng gõ mã hoặc tên hàng hóa vào ô tìm kiếm ở trên để chọn sản phẩm.
                    </td>
                  </tr>
                ) : (
                  items.map((item, pIdx) => {
                    const zoneCount = item.zones.length;
                    const prodTotalSys = item.zones.reduce((sum, z) => sum + (z.systemQty || 0), 0);
                    const prodTotalCounted = item.zones.reduce((sum, z) => sum + Number(z.countedQty || 0), 0);
                    const prodTotalDiff = prodTotalCounted - prodTotalSys;
                    const productRowSpan = zoneCount > 1 ? zoneCount + 1 : zoneCount;

                    return (
                      <React.Fragment key={item.product.id || `prod-${pIdx}`}>
                        {item.zones.map((zone, zIdx) => {
                          const isFirstZone = zIdx === 0;
                          const isLastZoneInProd = zIdx === zoneCount - 1;
                          const zDiff = (zone.countedQty ?? 0) - (zone.systemQty ?? 0);
                          const isEven = (pIdx + zIdx) % 2 === 1;

                          return (
                            <tr
                              key={`${item.product.id}-${zone.zoneCode}-${zone.binCode || zIdx}`}
                              className={`${isEven ? 'bg-cyan-50/20' : 'bg-white'} hover:bg-cyan-50/80 transition-colors ${isLastZoneInProd && zoneCount === 1 ? 'border-b-2 border-slate-300' : 'border-b border-slate-200'
                                }`}
                            >
                              {/* ══ ROWSPAN MERGED CELL 1: STT ══ */}
                              {isFirstZone && (
                                <td
                                  rowSpan={productRowSpan}
                                  className="p-2 text-center font-extrabold text-slate-600 border-r border-slate-200 align-middle bg-inherit"
                                >
                                  {pIdx + 1}.
                                </td>
                              )}

                              {/* ══ ROWSPAN MERGED CELL 2: MÃ HÀNG ══ */}
                              {isFirstZone && (
                                <td
                                  rowSpan={productRowSpan}
                                  className="p-1.5 border-r border-slate-200 align-middle bg-inherit"
                                >
                                  <div className="h-9 px-2.5 flex items-center justify-center rounded-xl border border-slate-300 bg-white font-black text-cyan-800 text-xs font-mono shadow-2xs">
                                    {item.product.internalSku}
                                  </div>
                                </td>
                              )}

                              {/* ══ ROWSPAN MERGED CELL 3: TÊN HÀNG HÓA ══ */}
                              {isFirstZone && (
                                <td
                                  rowSpan={productRowSpan}
                                  className="p-1.5 border-r border-slate-200 align-middle bg-inherit"
                                >
                                  <div className="h-9 px-3 flex items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 text-xs shadow-2xs">
                                    <span className="truncate" title={item.product.name}>
                                      {item.product.name}
                                    </span>
                                    <span className="shrink-0 text-[10px] font-black text-cyan-700 bg-cyan-100/80 px-2 py-0.5 rounded-full">
                                      {zoneCount} kệ/ô
                                    </span>
                                  </div>
                                </td>
                              )}

                              {/* ══ ROWSPAN MERGED CELL 4: ĐVT ══ */}
                              {isFirstZone && (
                                <td
                                  rowSpan={productRowSpan}
                                  className="p-1.5 border-r border-slate-200 align-middle bg-inherit"
                                >
                                  <div className="h-9 w-full flex items-center justify-center rounded-xl border border-slate-300 bg-white font-bold text-slate-700 text-xs shadow-2xs">
                                    {item.product.unit || 'Cái'}
                                  </div>
                                </td>
                              )}

                              {/* ══ CELL 5: PHÂN KHU & Ô KỆ KIỂM KÊ ══ */}
                              <td className="p-1.5 border-r border-slate-200">
                                <div className="flex items-center gap-1.5">
                                  <select
                                    value={zone.zoneCode}
                                    onChange={(e) => handleUpdateZoneCode(pIdx, zIdx, e.target.value)}
                                    className="h-9 flex-1 min-w-[110px] rounded-xl border border-slate-300 bg-white px-2 text-xs font-bold text-slate-800 outline-none focus:border-cyan-600 cursor-pointer shadow-2xs"
                                  >
                                    {activeSubWarehouses.map((sub: any) => (
                                      <option key={sub.id || sub.code} value={sub.code || sub.id}>
                                        [{sub.code || sub.id}] {sub.name}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => setSlottingTarget({ product: item.product, pIdx, zIdx })}
                                    className={`h-9 px-3 flex items-center gap-1.5 rounded-xl border transition-all cursor-pointer shadow-2xs shrink-0 whitespace-nowrap ${zone.binCode || (zone.assignedBins && zone.assignedBins.length > 0)
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold'
                                        : 'border-cyan-300 bg-white text-cyan-800 hover:bg-cyan-50 font-bold'
                                      }`}
                                    title="Xem sơ đồ & chọn ô kệ"
                                  >
                                    <span className="text-xs font-black">
                                      {zone.locationBin && zone.locationBin !== 'Chưa xếp ô'
                                        ? zone.locationBin
                                        : zone.binCode
                                          ? `Ô ${zone.binCode}`
                                          : zone.assignedBins && zone.assignedBins.length > 0
                                            ? zone.assignedBins.join(', ')
                                            : 'Chọn ô'}
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAddZoneToProduct(pIdx)}
                                    className="h-9 w-8 flex items-center justify-center rounded-xl border border-cyan-300 bg-cyan-50 text-cyan-800 hover:bg-cyan-100 transition cursor-pointer shrink-0 shadow-2xs"
                                    title="Thêm vị trí kệ lưu trữ khác cho sản phẩm này"
                                  >
                                    <Plus size={14} strokeWidth={2.5} />
                                  </button>
                                </div>
                              </td>

                              {/* ══ CELL 6: SỐ TỒN KHO TRÊN KỆ ══ */}
                              <td className="p-1.5 border-r border-slate-200">
                                <div className="h-9 w-full flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50/80 font-black text-slate-800 font-mono text-xs shadow-2xs">
                                  {(zone.systemQty || 0).toLocaleString('vi-VN')}
                                </div>
                              </td>


                              {/* ══ CELL 9: GHI CHÚ KỆ ══ */}
                              <td className="p-1.5 border-r border-slate-200">
                                <input
                                  type="text"
                                  value={zone.note || ''}
                                  onChange={(e) => handleUpdateZoneNote(pIdx, zIdx, e.target.value)}
                                  placeholder="Ghi chú..."
                                  className="h-9 w-full px-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-700 outline-none focus:border-cyan-600 text-xs shadow-2xs"
                                />
                              </td>

                              {/* ══ CELL 10: THAO TÁC (Chỉ nút Xóa) ══ */}
                              <td className="p-1.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveZoneRow(pIdx, zIdx)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-rose-300 bg-white text-rose-500 shadow-2xs hover:bg-rose-500 hover:text-white hover:border-rose-500 transition cursor-pointer"
                                  title="Xóa hàng kiểm kê này"
                                >
                                  <Trash2 size={16} strokeWidth={2} />
                                </button>
                              </td>
                            </tr>
                          );
                        });
                  })
                )}
                      </tbody>

              {/* TABLE FOOTER SUMMARY ROW */ }
                    {
                      items.length > 0 && (
                        <tfoot className="bg-slate-100 font-extrabold text-slate-800 border-t-2 border-slate-200 uppercase text-xs sticky bottom-0 z-10">
                          <tr>
                            <td colSpan={5} className="p-2.5 text-right font-black text-slate-800 border-r border-slate-200">
                              TỔNG CỘNG ({items.length} SẢN PHẨM - {items.reduce((s, i) => s + i.zones.length, 0)} PHÂN KHU):
                            </td>
                            <td className="p-1.5 text-center border-r border-slate-200">
                              <div className="h-9 w-full flex items-center justify-center rounded-xl border border-cyan-300 bg-cyan-100/60 font-black text-cyan-900 font-mono text-xs shadow-2xs">
                                {totalSystemQty.toLocaleString('vi-VN')}
                              </div>
                            </td>
                            <td className="p-2 border-r border-slate-200 text-slate-400 font-medium italic text-center">—</td>
                            <td className="p-2 text-center text-slate-400 font-medium italic">—</td>
                          </tr>
                        </tfoot>
                      )
                    }
            </table>
          </div>
        </div>

        {/* ── RIGHT COLUMN (3/12 width): SUMMARY & ACTIONS ── */}
        <div className="lg:col-span-3 flex flex-col space-y-4">
          <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase text-cyan-900 tracking-wider border-b-2 border-slate-100 pb-2">
              TỔNG QUAN PHIẾU KIỂM KÊ
            </h3>

            {/* Ghi chú chung */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Ghi chú chung</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nhập ghi chú chung cho phiếu kiểm..."
                rows={4}
                className="w-full rounded-lg border-2 border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-800 outline-none focus:border-cyan-600 resize-none shadow-2xs"
              />
            </div>

            {/* Light Theme Summary Card */}
            <div className="rounded-xl border-2 border-cyan-200 bg-cyan-50/60 p-4 shadow-sm space-y-2.5 text-slate-800">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Số mặt hàng kiểm kê:</span>
                <span className="font-extrabold text-slate-900 font-mono">{items.length}</span>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Tổng số dòng phân khu:</span>
                <span className="font-extrabold text-cyan-950 font-mono">
                  {items.reduce((s, i) => s + i.zones.length, 0)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Tổng tồn hệ thống:</span>
                <span className="font-extrabold text-cyan-900 font-mono">
                  {totalSystemQty.toLocaleString('vi-VN')}
                </span>
              </div>

              <div className="border-t border-slate-300/80 pt-2 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 italic">
                  Nhập số lượng thực tế sẽ thực hiện khi duyệt kiểm kê
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => executeSubmit(isManager ? 'COUNTING' : 'COUNTING_DONE', true)}
                disabled={submitting || items.length === 0}
                className="w-full h-12 flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 text-sm font-black text-white shadow-md hover:shadow-lg hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 transition active:scale-[0.98] cursor-pointer"
              >
                <Printer className="h-5 w-5" />
                <span>Lưu & In phiếu kiểm</span>
              </button>

              <button
                type="button"
                onClick={() => executeSubmit(isManager ? 'COUNTING' : 'COUNTING_DONE', false)}
                disabled={submitting || items.length === 0}
                className="w-full h-12 flex items-center justify-center gap-2.5 rounded-xl bg-cyan-700 px-5 text-sm font-black text-white shadow-md hover:shadow-lg hover:bg-cyan-800 disabled:opacity-50 transition active:scale-[0.98] cursor-pointer"
              >
                <Save className="h-5 w-5" />
                <span>Lưu phiếu kiểm kho</span>
              </button>

              <button
                type="button"
                onClick={() => executeSubmit('DRAFT', false)}
                disabled={submitting}
                className="w-full h-11 flex items-center justify-center gap-2.5 rounded-xl bg-amber-500 px-5 text-sm font-black text-white shadow-md hover:shadow-lg hover:bg-amber-600 disabled:opacity-50 transition active:scale-[0.98] cursor-pointer"
              >
                <FileText className="h-5 w-5" />
                <span>Lưu tạm (Draft)</span>
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="w-full h-11 flex items-center justify-center gap-2.5 rounded-xl border-2 border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-100 hover:border-slate-400 active:scale-[0.98] transition cursor-pointer"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Hủy / Quay lại</span>
              </button>
            </div>
          </div>
        </div>

        {/* ══ SMART SLOTTING RACK GRID MODAL (Mẫu Inbound) ══ */}
        {slottingTarget && (
          <SmartSlottingGridModal
            isOpen={Boolean(slottingTarget)}
            onClose={() => setSlottingTarget(null)}
            mode="INBOUND"
            warehouseCode={locationCode || 'KH006'}
            targetRowId={slottingTarget.product.id}
            products={products}
            subWarehouses={activeSubWarehouses}
            items={items.map((it) => {
              const allBins = it.zones.flatMap((z) =>
                z.assignedBins && z.assignedBins.length > 0
                  ? z.assignedBins
                  : z.locationBin
                    ? z.locationBin.split(',').map((s) => s.trim())
                    : []
              );
              const uniqueBins = Array.from(new Set(allBins.filter(Boolean)));
              return {
                rowId: it.product.id,
                productId: it.product.id,
                productSku: it.product.internalSku,
                productName: it.product.name,
                unit: it.product.unit || 'Cái',
                qty: it.zones.reduce((sum, z) => sum + (z.countedQty ?? z.systemQty ?? 0), 0),
                assignedBins: uniqueBins,
                locationBin: uniqueBins.join(', '),
              };
            })}
            onConfirmAll={(updatedRows) => {
              setItems((prev) =>
                prev.map((it, pIdx) => {
                  const match = updatedRows.find(
                    (r) => r.rowId === it.product.id || r.productId === it.product.id
                  );
                  if (match && match.assignedBins) {
                    const updatedZones = it.zones.map((z, zIdx) => {
                      if (slottingTarget && slottingTarget.pIdx === pIdx && slottingTarget.zIdx === zIdx) {
                        const firstBin = match.assignedBins[0] || '';
                        const cleanBin = firstBin.split('(')[0].trim();
                        const shortBin = (cleanBin.split('-').pop() || cleanBin).toUpperCase().trim();
                        const rkPrefix = cleanBin.includes('-') ? cleanBin.split('-')[0].toUpperCase() : z.rackCode || '';
                        const locLabel = rkPrefix ? `Kệ ${rkPrefix} - Ô ${shortBin}` : (shortBin ? `Ô ${shortBin}` : match.locationBin || '');

                        return {
                          ...z,
                          rackCode: rkPrefix,
                          binCode: shortBin,
                          fullBinCode: cleanBin,
                          locationBin: locLabel || match.locationBin || match.assignedBins.join(', '),
                          assignedBins: match.assignedBins,
                          note: z.note || `[Kệ: ${locLabel}]`,
                        };
                      }
                      if (slottingTarget && slottingTarget.pIdx === pIdx && zIdx === 0 && (!z.assignedBins || z.assignedBins.length === 0)) {
                        const firstBin = match.assignedBins[0] || '';
                        const cleanBin = firstBin.split('(')[0].trim();
                        const shortBin = (cleanBin.split('-').pop() || cleanBin).toUpperCase().trim();
                        const rkPrefix = cleanBin.includes('-') ? cleanBin.split('-')[0].toUpperCase() : z.rackCode || '';
                        const locLabel = rkPrefix ? `Kệ ${rkPrefix} - Ô ${shortBin}` : (shortBin ? `Ô ${shortBin}` : match.locationBin || '');

                        return {
                          ...z,
                          rackCode: rkPrefix,
                          binCode: shortBin,
                          fullBinCode: cleanBin,
                          locationBin: locLabel || match.locationBin || match.assignedBins.join(', '),
                          assignedBins: match.assignedBins,
                          note: z.note || `[Kệ: ${locLabel}]`,
                        };
                      }
                      return z;
                    });
                    return { ...it, zones: updatedZones };
                  }
                  return it;
                })
              );
              setSlottingTarget(null);
              showSuccess('Đã cập nhật vị trí ô kệ kiểm kê thành công!');
            }}
          />
        )}

        {/* ══ MODAL QUẢN LÝ / ĐÓNG BĂNG KHO KIỂM KÊ ══ */}
        {freezeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl border border-slate-100 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-cyan-900">
                  <Lock className="h-4.5 w-4.5 text-cyan-700" />
                  <h3 className="text-sm font-black uppercase tracking-wide">
                    Đóng Băng Kho Kiểm Kê
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setFreezeModalOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Chỉ những kho <strong>được đóng băng</strong> mới hiển thị để thực hiện kiểm kê. Khi đóng băng, mọi giao dịch nhập/xuất tại kho này sẽ tạm ngưng để đảm bảo số liệu chính xác.
              </p>

              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {warehouses.map((wh) => (
                  <div
                    key={wh.id || wh.code}
                    className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:border-slate-300 transition"
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-900">
                        [{wh.code}] {wh.name}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {wh.isFrozen ? (
                          <span className="font-semibold text-cyan-700">Đang đóng băng (Đủ ĐK kiểm kê)</span>
                        ) : (
                          <span>Bình thường (Đang mở nhập/xuất)</span>
                        )}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={freezeLoading}
                      onClick={async () => {
                        await handleToggleFreezeSpecificWh(wh);
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition active:scale-95 cursor-pointer disabled:opacity-50 ${wh.isFrozen
                          ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                          : 'bg-cyan-600 text-white hover:bg-cyan-700'
                        }`}
                    >
                      {wh.isFrozen ? 'Mở khóa' : 'Đóng băng ngay'}
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFreezeModalOpen(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (standalone) {
    return <MainLayout>{contentMarkup}</MainLayout>;
  }

  return contentMarkup;
}
