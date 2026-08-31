import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  ArrowLeft,
  Building,
  Store,
  Check,
  CheckCircle,
  ChevronRight,
  Cpu,
  Edit,
  Eye,
  Grid,
  Info,
  Layers,
  LayoutGrid,
  MapPin,
  Move3d,
  Package,
  Plus,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Save,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  Sliders,
  Snowflake,
  Sparkles,
  Thermometer,
  Trash2,
  Warehouse,
  Zap,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Filter,
  CheckSquare,
  Square,
  Boxes,
  Calendar,
  Building2,
  X,
  Copy,
  Printer,
  FileSpreadsheet,
} from 'lucide-react';
import { WarehouseSlottingGrid, fetchWarehouseOccupiedBins } from '../components/WarehouseSlottingGrid';
import Toast from '../../../shared/components/Toast';
import MainLayout from '../../../shared/components/MainLayout';
import {
  getStoredWarehouses,
  mergeStoredWarehouses,
  saveStoredWarehouses,
  upsertWarehouseToApi,
  normalizeWarehouseRecord,
  getRackLetterPrefix,
  calculateGlobalShelfIndex,
  clearAllDraftSlotLocks,
  type WarehouseRecord,
  type SubWarehouse,
  type RackConfig,
  type CustomBinConfig,
} from '../../../shared/utils/warehouseAssignments';
import { VIETNAM_PROVINCES } from '../components/VietnamMapModal';
import Warehouse3DViewer from '../components/Warehouse3DViewer';
import {
  calculateAiSlottingRecommendations,
  generateWarehouseBinCells,
  type AiSlottingRecommendation,
  type BinCellInfo,
  type ProductSlotInput,
} from '../utils/aiSlottingEngine';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api';

// Default generator for continuous longitudinal rack rows
function generateDefaultRacks(
  racksCount: number,
  zoneLength = 20,
  zoneHeight = 6,
  vachDoc = 2,
  vachNgang = 5,
  defaultBinsPerShelf = 2,
  rackLength?: number,
  rackWidth?: number,
  rackHeight?: number
): RackConfig[] {
  const racks: RackConfig[] = [];
  const rackL = rackLength !== undefined && rackLength > 0 ? rackLength : Math.max(zoneLength - 2, 4);
  const rackW = rackWidth !== undefined && rackWidth > 0 ? rackWidth : 1.2;
  const rackH = rackHeight !== undefined && rackHeight > 0 ? rackHeight : Math.max(zoneHeight - 1, 3);

  // Vách Dọc vachDoc (tính cả vách đầu và vách đuôi) -> Số khoang = vachDoc - 1
  const calcBays = Math.max(1, vachDoc - 1);
  // Vách Ngang vachNgang (tính cả dầm đáy dưới cùng và dầm mái trên cùng) -> Số tầng = vachNgang - 1
  const calcShelves = Math.max(1, vachNgang - 1);

  const totalLengthBins = calcBays * defaultBinsPerShelf;
  const autoBinL = Math.round((rackL * 100) / (totalLengthBins || 1));
  const autoBinW = Math.round(rackW * 100);
  const autoBinH = Math.round((rackH * 100) / (calcShelves || 1));

  for (let r = 1; r <= racksCount; r++) {
    const rCode = `R${String(r).padStart(2, '0')}`;
    racks.push({
      id: `rack-${r}`,
      rackCode: rCode,
      name: `Dãy Kệ Dọc ${rCode}`,
      length: rackL,
      width: rackW,
      height: rackH,
      maxRackLoad: 16000,
      baysCount: calcBays,
      horizontalPartitions: vachNgang,
      verticalPartitions: vachDoc,
      columnsCount: calcBays,
      shelvesCount: calcShelves,
      binsPerShelf: defaultBinsPerShelf,
      defaultBinLength: autoBinL,
      defaultBinWidth: autoBinW,
      defaultBinHeight: autoBinH,
      defaultBinMaxWeight: 500,
      customBins: {},
    });
  }
  return racks;
}

export default function CreateWarehousePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id);

  // General Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [province, setProvince] = useState(VIETNAM_PROVINCES[0].name);
  const [ward, setWard] = useState(VIETNAM_PROVINCES[0].wards[0]);
  const [detailAddress, setDetailAddress] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  // Master Specs
  const [length, setLength] = useState(50);
  const [width, setWidth] = useState(30);
  const [height, setHeight] = useState(12);

  // Subwarehouses / Zones list
  const [subWarehouses, setSubWarehouses] = useState<SubWarehouse[]>([]);
  const [activeZoneId, setActiveZoneId] = useState<string>('');
  const [activeRackId, setActiveRackId] = useState<string>('');

  // Interactive Rack Checkboxes Selection State
  const [selectedRackCodes, setSelectedRackCodes] = useState<string[]>([]);

  // 2D Matrix Grid Scale / Zoom State (100%, 150%, 200%, 300%)
  const [gridZoomScale, setGridZoomScale] = useState<number>(100);

  // Auto calculation toggle mode
  const [isAutoCalcBin, setIsAutoCalcBin] = useState<boolean>(true);

  // UI Modes
  const [viewMode, setViewMode] = useState<'2D_MATRIX' | '3D_VIEW'>('2D_MATRIX');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Bin Edit Inspector Modal State
  const [editingBinCode, setEditingBinCode] = useState<string | null>(null);
  const [binCustomForm, setBinCustomForm] = useState<CustomBinConfig>({
    binCode: '',
    length: 120,
    width: 80,
    height: 100,
    maxWeight: 500,
  });



  function normalizeBinKey(binCode: string): string {
    if (!binCode) return '';
    const trimmed = binCode.trim().toUpperCase();
    const match = trimmed.match(/(R\d+[-_]S\d+[-_]C\d+)/);
    if (match) return match[1].replace(/_/g, '-');
    return trimmed;
  }

  // Active Bin Details state populated directly by WarehouseSlottingGrid (Single Source of Truth)
  const [activeBinGoodsDetails, setActiveBinGoodsDetails] = useState<{
    fullBinCode: string;
    customConfig: any;
    occupiedInfo: any;
    goodsList: any[];
  } | null>(null);

  // Fullscreen state
  const [isFullScreen, setIsFullScreen] = useState(false);

  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
      setIsFullScreen(true);
    } else {
      document.exitFullscreen().catch(() => { });
      setIsFullScreen(false);
    }
  };

  useEffect(() => {
    const handleFSChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  const handleCopyWarehouseConfig = () => {
    try {
      const configData = {
        code,
        name,
        province,
        ward,
        detailAddress,
        length,
        width,
        height,
        subWarehouses,
      };
      navigator.clipboard.writeText(JSON.stringify(configData, null, 2));
      setSuccess('Đã sao chép toàn bộ cấu hình kho vào bộ nhớ tạm (Clipboard)!');
    } catch (e) {
      setError('Không thể sao chép cấu hình kho');
    }
  };

  const handleExportWarehouseExcel = async () => {
    try {
      const targetCode = code ? code.trim().toUpperCase() : '';
      const targetId = id ? id.trim().toLowerCase() : '';

      // 1. Single Source of Truth: Fetch live occupied bins and goods mapping matching the visual grid UI
      const { occupiedMap, goodsListMap } = await fetchWarehouseOccupiedBins(targetCode, targetId);

      // 2. Local fallbacks (stock_in_orders, inventory_balances, subWarehouses customBins)
      const stockInOrders = JSON.parse(
        localStorage.getItem('stock_in_orders') || sessionStorage.getItem('stock_in_orders') || '[]'
      );
      const inventoryBalances = JSON.parse(
        localStorage.getItem('inventory_balances') || localStorage.getItem('wms_inventory_balances') || '[]'
      );

      const binDataMap: Record<string, Array<{ sku: string; name: string; quantity: string; pct: string }>> = {};

      const addGoodsToBin = (binCode: string, sku: string, name: string, quantity: string, pct: string) => {
        if (!binCode || !name) return;
        const normalized = binCode.trim().toUpperCase().replace(/\s+/g, '');
        if (!binDataMap[normalized]) binDataMap[normalized] = [];
        const existing = binDataMap[normalized].find((g) => g.name === name);
        if (!existing) {
          binDataMap[normalized].push({ sku: sku || 'SKU-001', name, quantity, pct });
        }
      };

      if (Array.isArray(stockInOrders)) {
        stockInOrders.forEach((order: any) => {
          if (order.details && Array.isArray(order.details)) {
            order.details.forEach((dt: any) => {
              const bin = dt.locationBin || dt.binCode || order.locationBin || '';
              if (bin) {
                addGoodsToBin(
                  bin,
                  dt.productSku || dt.sku || 'SKU-001',
                  dt.productName || dt.name || 'Hàng hóa kho',
                  `${dt.quantity || dt.qty || 1} ${dt.unit || 'cái'}`,
                  `${dt.occupancyPct || 30}%`
                );
              }
            });
          }
        });
      }

      if (Array.isArray(inventoryBalances)) {
        inventoryBalances.forEach((b: any) => {
          const bin = b.binCode || b.locationCode || b.bin || '';
          if (bin) {
            addGoodsToBin(
              bin,
              b.product?.sku || b.sku || 'SKU-001',
              b.productName || b.product?.name || 'Hàng hóa kho',
              `${b.quantity || b.qty || b.onHand || 1} ${b.unit || b.product?.unit || 'cái'}`,
              `${b.occupancyPct || 50}%`
            );
          }
        });
      }

      subWarehouses.forEach((z) => {
        (z.racks || []).forEach((rk) => {
          if (rk.customBins) {
            Object.entries(rk.customBins).forEach(([binCode, cfg]: [string, any]) => {
              if (cfg && (cfg.productName || cfg.goods)) {
                if (Array.isArray(cfg.goods)) {
                  cfg.goods.forEach((g: any) => {
                    addGoodsToBin(binCode, g.sku || 'SKU-001', g.name || g.productName, `${g.quantity || 1} ${g.unit || 'cái'}`, `${g.pct || 30}%`);
                  });
                } else if (cfg.productName) {
                  addGoodsToBin(binCode, cfg.sku || 'SKU-001', cfg.productName, `${cfg.quantity || 1} ${cfg.unit || 'cái'}`, `${cfg.occupancyPct || 50}%`);
                }
              }
            });
          }
        });
      });

      const currentZone = subWarehouses.find((z) => z.id === activeZoneId) || subWarehouses[0];
      const racksList = currentZone?.racks && currentZone.racks.length > 0
        ? currentZone.racks
        : generateDefaultRacks(4);

      let maxProductsInBin = 1;
      goodsListMap.forEach((list) => {
        if (list && list.length > maxProductsInBin) maxProductsInBin = list.length;
      });
      Object.values(binDataMap).forEach((list) => {
        if (list && list.length > maxProductsInBin) maxProductsInBin = list.length;
      });

      const titleRow = [`BÁO CÁO TRA CỨU SƠ ĐỒ VỊ TRÍ HÀNG HÓA KHO: ${name ? name.toUpperCase() : 'KHO CHÍNH'} (${targetCode || 'KH001'})`];
      const blankRow: string[] = [];

      const headers = ['Kệ', '% Tổng đang chứa'];
      for (let i = 1; i <= maxProductsInBin; i++) {
        headers.push(`Mã HH ${i}`, `Tên hàng hóa ${i}`, `Số lượng ${i}`, `% Chứa ${i}`);
      }

      const excelRows: (string | number)[][] = [];

      racksList.forEach((rack: any, rIdx: number) => {
        const rackCode = rack.rackCode || `R${String(rIdx + 1).padStart(2, '0')}`;
        excelRows.push([`Dãy kệ ${rackCode}`]);

        const shelvesCount = rack.shelvesCount || rack.horizontalPartitions || currentZone?.shelvesPerRack || 4;
        const baysCount = Math.max(
          1,
          (rack.binsPerShelf || rack.verticalPartitions || currentZone?.binsPerShelf || 8) > 2
            ? (rack.binsPerShelf || (rack.verticalPartitions ? rack.verticalPartitions - 1 : 7))
            : 7
        );

        for (let s = shelvesCount; s >= 1; s--) {
          const globalShelfIdx = calculateGlobalShelfIndex(
            subWarehouses,
            currentZone?.id || '',
            rack.id || rack.rackCode || String(rIdx),
            s
          );
          const shelfPrefix = getRackLetterPrefix(globalShelfIdx);
          excelRows.push([`Tầng ${shelfPrefix}`]);

          for (let c = 1; c <= baysCount; c++) {
            const binCodeShort = `${shelfPrefix}${c}`;
            const binLabel = `Ô ${binCodeShort}`;
            const binKeyFull = `${targetCode}-${currentZone?.code || 'ZONE'}-${rackCode}-${binCodeShort}`;
            const binKeyRackCell = `${rackCode}-${binCodeShort}`;
            const binKeyFullNoZone = `${targetCode}-${rackCode}-${binCodeShort}`;

            const normalizedShort = binCodeShort.toUpperCase().replace(/\s+/g, '');
            const normalizedRackCell = binKeyRackCell.toUpperCase().replace(/\s+/g, '');
            const normalizedFull = binKeyFull.toUpperCase().replace(/\s+/g, '');
            const normalizedLabel = binLabel.toUpperCase().replace(/\s+/g, '');

            const liveGoodsList =
              goodsListMap.get(binKeyRackCell) ||
              goodsListMap.get(binKeyFull) ||
              goodsListMap.get(binKeyFullNoZone) ||
              goodsListMap.get(binCodeShort) ||
              goodsListMap.get(normalizedRackCell) ||
              goodsListMap.get(normalizedShort) ||
              goodsListMap.get(normalizedFull) ||
              goodsListMap.get(normalizedLabel) ||
              goodsListMap.get(binLabel) ||
              [];

            const fallbackGoods =
              binDataMap[normalizedRackCell] ||
              binDataMap[normalizedFull] ||
              binDataMap[normalizedShort] ||
              binDataMap[normalizedLabel] ||
              binDataMap[binLabel] ||
              binDataMap[binCodeShort] ||
              [];

            let goods: Array<{ sku: string; name: string; quantity: string; pct: string }> = [];

            if (liveGoodsList.length > 0) {
              goods = liveGoodsList.map((g) => ({
                sku: g.sku || 'SKU-001',
                name: g.productName || 'Hàng hóa kho',
                quantity: `${Math.abs(g.quantity || 1)} ${g.unit || 'cái'}`,
                pct: `${g.occupancyPct !== undefined ? g.occupancyPct : 100}%`,
              }));
            } else if (fallbackGoods.length > 0) {
              goods = fallbackGoods;
            }

            const occInfo =
              occupiedMap.get(binKeyRackCell) ||
              occupiedMap.get(binKeyFull) ||
              occupiedMap.get(binKeyFullNoZone) ||
              occupiedMap.get(binCodeShort) ||
              occupiedMap.get(normalizedRackCell) ||
              occupiedMap.get(normalizedShort) ||
              occupiedMap.get(normalizedFull) ||
              occupiedMap.get(binLabel);

            let totalPct = '0%';
            if (goods.length > 0) {
              const sumPct = goods.reduce((acc, g) => acc + (parseInt(g.pct) || 0), 0);
              totalPct = `${Math.min(100, sumPct || 90)}%`;
            } else if (occInfo && (occInfo.totalPhysical || 0) > 0) {
              totalPct = `${occInfo.occupancyPct !== undefined ? occInfo.occupancyPct : 100}%`;
              if (occInfo.productName) {
                goods = [{
                  sku: occInfo.sku || 'SKU-001',
                  name: occInfo.productName,
                  quantity: `${occInfo.totalPhysical || 1} ${occInfo.unit || 'cái'}`,
                  pct: totalPct,
                }];
              }
            }

            const row: (string | number)[] = [binLabel, totalPct];

            for (let i = 0; i < maxProductsInBin; i++) {
              const g = goods[i];
              if (g) {
                row.push(g.sku, g.name, g.quantity, g.pct);
              } else {
                row.push('', '', '', '');
              }
            }

            excelRows.push(row);
          }
        }
      });

      const rawSheetData: any[][] = [titleRow, blankRow, headers, ...excelRows];
      const ws = XLSX.utils.aoa_to_sheet(rawSheetData);

      // Auto-fit column widths based on maximum string visual length (Độ rộng ô bằng chữ)
      const colWidths = headers.map((header, colIdx) => {
        let maxLen = String(header || '').length;
        rawSheetData.forEach((row) => {
          const cellVal = row[colIdx];
          if (cellVal !== undefined && cellVal !== null) {
            const strVal = String(cellVal);
            const visualLen = strVal.split('').reduce((acc, char) => acc + (char.charCodeAt(0) > 255 ? 1.2 : 1), 0);
            if (visualLen > maxLen) maxLen = visualLen;
          }
        });
        return { wch: Math.max(Math.ceil(maxLen) + 4, 12) };
      });
      ws['!cols'] = colWidths;

      // Enable gridlines & cell border/alignment styles
      ws['!views'] = [{ showGridLines: true }];

      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
      const thinBorder = {
        top: { style: 'thin', color: { auto: 1 } },
        bottom: { style: 'thin', color: { auto: 1 } },
        left: { style: 'thin', color: { auto: 1 } },
        right: { style: 'thin', color: { auto: 1 } },
      };

      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[cellAddr]) continue;

          // Row 0: Main Title
          if (R === 0) {
            ws[cellAddr].s = {
              font: { bold: true, sz: 13, color: { rgb: '0E7490' } },
              alignment: { horizontal: 'left', vertical: 'center' },
            };
            continue;
          }
          if (R === 1) continue;

          // Row 2: Table Column Headers
          if (R === 2) {
            const mod = (C - 2) % 4;
            let headerAlign = 'center';
            if (C >= 2 && mod === 1) headerAlign = 'left';
            if (C >= 2 && mod === 2) headerAlign = 'right';

            ws[cellAddr].s = {
              font: { bold: true, color: { rgb: '0E7490' } },
              fill: { fgColor: { rgb: 'CFFAFE' } },
              alignment: { horizontal: headerAlign, vertical: 'center' },
              border: thinBorder,
            };
            continue;
          }

          // Data Rows (R >= 3)
          const cellVal = String(ws[cellAddr].v || '');
          if (cellVal.startsWith('Dãy kệ')) {
            ws[cellAddr].s = {
              font: { bold: true, sz: 11, color: { rgb: '0369A1' } },
              fill: { fgColor: { rgb: 'E0F2FE' } },
              alignment: { horizontal: 'left', vertical: 'center' },
              border: thinBorder,
            };
            continue;
          }
          if (cellVal.startsWith('Tầng ')) {
            ws[cellAddr].s = {
              font: { bold: true, sz: 10, color: { rgb: '334155' } },
              fill: { fgColor: { rgb: 'F1F5F9' } },
              alignment: { horizontal: 'left', vertical: 'center' },
              border: thinBorder,
            };
            continue;
          }

          // Strict Alignments per column type:
          // C === 0 (Kệ): Center
          // C === 1 (% Tổng đang chứa): Center
          // C >= 2:
          //   (C - 2) % 4 === 0 (Mã HH): Center
          //   (C - 2) % 4 === 1 (Tên HH): Left (Căn lề trái)
          //   (C - 2) % 4 === 2 (Số lượng): Right (Căn lề phải)
          //   (C - 2) % 4 === 3 (% Chứa): Center
          let hAlign = 'center';
          if (C === 0 || C === 1) {
            hAlign = 'center';
          } else {
            const mod = (C - 2) % 4;
            if (mod === 0) hAlign = 'center';
            else if (mod === 1) hAlign = 'left';
            else if (mod === 2) hAlign = 'right';
            else if (mod === 3) hAlign = 'center';
          }

          ws[cellAddr].s = {
            alignment: { horizontal: hAlign, vertical: 'center' },
            border: thinBorder,
          };
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'So_Do_Ke_Kho');
      XLSX.writeFile(wb, `So_Do_Ke_Kho_${targetCode || 'WMS'}.xlsx`);

      setSuccess('Đã xuất file Excel (.xlsx) sơ đồ vị trí kệ thành công!');
    } catch (err) {
      console.error('Export excel error:', err);
      setError('Lỗi khi xuất file Excel sơ đồ vị trí kệ');
    }
  };

  const handleSaveBinCustomConfig = () => {
    if (!editingBinCode) return;
    setSubWarehouses((prev) =>
      prev.map((zone) => {
        if (zone.id !== activeZoneId) return zone;
        return {
          ...zone,
          racks: (zone.racks || []).map((rk) => {
            if (!editingBinCode.includes(rk.rackCode)) return rk;
            return {
              ...rk,
              customBins: {
                ...(rk.customBins || {}),
                [editingBinCode]: { ...binCustomForm },
              },
            };
          }),
        };
      })
    );
    setSuccess(`Đã lưu cấu hình ô ${editingBinCode} thành công!`);
    setEditingBinCode(null);
  };

  const handleClearAllGoods = async () => {
    if (!code) {
      setError('Không thể xác định mã kho hàng để xóa');
      return;
    }
    const targetCode = code.trim().toUpperCase();
    if (window.confirm(`Bạn có chắc chắn muốn giải phóng toàn bộ ô kệ và xóa hết hàng hóa trong KHO [${targetCode}] về trạng thái KỆ TRỐNG?\n(Lưu ý: Thao tác này CHỈ áp dụng cho kho [${targetCode}], không ảnh hưởng các kho khác)`)) {
      try {
        const headers = { Authorization: `Bearer ${localStorage.getItem('token') || ''}` };
        await fetch(`${API_BASE_URL}/inventory/clear-all?warehouseCode=${encodeURIComponent(targetCode)}`, {
          method: 'POST',
          headers,
        }).catch(() => null);
      } catch (e) {
        console.error('Error clearing inventory balances:', e);
      }

      // Clear all customBins occupancy across all subWarehouses & racks
      const cleanedZones = subWarehouses.map((z) => ({
        ...z,
        racks: (z.racks || []).map((rk) => ({
          ...rk,
          customBins: {},
        })),
      }));

      setSubWarehouses(cleanedZones);

      // Persist cleared warehouse state in localStorage for persistent F5 refresh
      localStorage.setItem(`cleared_warehouse_goods_${targetCode}`, 'true');

      // Save cleared subWarehouses to backend API & localStorage
      if (id || code) {
        const fullAddress = `${detailAddress ? detailAddress + ', ' : ''}${ward}, ${province}`;
        const payload: WarehouseRecord = {
          id: id || `wh_${Date.now()}`,
          code: targetCode,
          name: name.trim(),
          province,
          ward,
          detailAddress,
          address: fullAddress,
          status,
          length,
          width,
          height,
          managerIds: [],
          staffIds: [],
          subWarehouses: cleanedZones,
        };
        try {
          const savedWarehouse = await upsertWarehouseToApi(payload);
          const existingWarehouses = getStoredWarehouses();
          const updatedList = existingWarehouses.some((w) => w.id === savedWarehouse.id || w.code === savedWarehouse.code)
            ? existingWarehouses.map((w) => (w.id === savedWarehouse.id || w.code === savedWarehouse.code ? savedWarehouse : w))
            : [...existingWarehouses, savedWarehouse];
          saveStoredWarehouses(updatedList);
        } catch (err) {
          console.error('Error updating warehouse reset topology:', err);
        }
      }

      clearAllDraftSlotLocks(targetCode);
      window.dispatchEvent(new Event('warehouse-goods-cleared'));
      setSuccess(`Đã xóa toàn bộ hàng hóa của kho [${targetCode}]. Tất cả ô kệ thuộc kho này đã trở về trạng thái KỆ TRỐNG!`);
    }
  };

  const hasWarehouseGoods = code ? localStorage.getItem(`cleared_warehouse_goods_${code.trim().toUpperCase()}`) !== 'true' : false;

  const populateWarehouse = useCallback((target: WarehouseRecord) => {
    const norm = normalizeWarehouseRecord(target);
    setCode(norm.code);
    setName(norm.name);
    setProvince(norm.province || VIETNAM_PROVINCES[0].name);
    setWard(norm.ward || VIETNAM_PROVINCES[0].wards[0]);
    setDetailAddress(norm.detailAddress || norm.address);
    setStatus(norm.status);
    setLength(norm.length || 50);
    setWidth(norm.width || 30);
    setHeight(norm.height || 12);

    const loadedZones = (norm.subWarehouses || []).map((z) => {
      const vachDoc = z.binsPerShelf || (z as any).verticalPartitions || 2;
      const vachNgang = z.shelvesPerRack || (z as any).horizontalPartitions || 5;
      const calcBays = Math.max(1, vachDoc - 1);
      const calcShelves = Math.max(1, vachNgang - 1);

      const rL = z.rackLength !== undefined ? z.rackLength : (z.racks?.[0]?.length || Math.max((z.length || 20) - 2, 4));
      const rW = z.rackWidth !== undefined ? z.rackWidth : (z.racks?.[0]?.width || 1.2);
      const rH = z.rackHeight !== undefined ? z.rackHeight : (z.racks?.[0]?.height || Math.max((z.height || 6) - 1, 3));

      const rks = z.racks && z.racks.length > 0
        ? z.racks.map((r) => ({
          ...r,
          length: r.length || rL,
          width: r.width || rW,
          height: r.height || rH,
          baysCount: calcBays,
          columnsCount: calcBays,
          shelvesCount: calcShelves,
          horizontalPartitions: vachNgang,
          verticalPartitions: vachDoc,
          binsPerShelf: r.binsPerShelf || 2,
        }))
        : generateDefaultRacks(z.racksCount || 4, z.length || 20, z.height || 6, vachDoc, vachNgang, 2, rL, rW, rH);
      return {
        ...z,
        rackLength: rL,
        rackWidth: rW,
        rackHeight: rH,
        racks: rks
      };
    });

    setSubWarehouses(loadedZones);
    if (loadedZones.length > 0) {
      setActiveZoneId(loadedZones[0].id);
      if (loadedZones[0].racks && loadedZones[0].racks.length > 0) {
        setActiveRackId(loadedZones[0].racks[0].id);
      }
    }
  }, []);

  // Load warehouse data if Edit Mode (supports F5 refresh and API sync)
  useEffect(() => {
    let isMounted = true;
    if (isEditMode && id) {
      const targetId = id;
      const localWarehouses = getStoredWarehouses();
      const localTarget = localWarehouses.find(
        (w) => w.id === targetId || w.code === targetId || w.id.toLowerCase() === targetId.toLowerCase()
      );
      if (localTarget) {
        populateWarehouse(localTarget);
      }

      async function loadWarehouseFromApi() {
        try {
          const headers = { Authorization: `Bearer ${localStorage.getItem('token') || ''}` };
          const res = await fetch(`${API_BASE_URL}/warehouses`, { headers }).catch(() => null);
          if (res && res.ok) {
            const remoteData: WarehouseRecord[] = await res.json();
            if (Array.isArray(remoteData) && remoteData.length > 0) {
              const merged = mergeStoredWarehouses(remoteData, localWarehouses);
              saveStoredWarehouses(merged);
              const matched = merged.find(
                (w) => w.id === targetId || w.code === targetId || w.id.toLowerCase() === targetId.toLowerCase()
              );
              if (matched && isMounted) {
                populateWarehouse(matched);
              }
            }
          }
        } catch (err) {
          console.error('Lỗi khi tải dữ liệu kho từ API:', err);
        }
      }
      loadWarehouseFromApi();
    } else {
      setCode(`KH${Math.floor(100 + Math.random() * 900)}`);
      setName('');
      setSubWarehouses([]);
    }
    return () => {
      isMounted = false;
    };
  }, [id, isEditMode, populateWarehouse]);

  // Active Zone reference
  const activeZone = subWarehouses.find((z) => z.id === activeZoneId) || subWarehouses[0];

  // Helper to parse numeric inputs safely allowing 0 and backspacing
  const parseNumInput = (valStr: string): number => {
    if (valStr === '') return 0;
    const num = Number(valStr);
    return isNaN(num) ? 0 : Math.max(0, num);
  };

  // Ensure racks exist in activeZone
  const activeRacks = activeZone?.racks || [];

  const activeRack = activeRacks.find((r) => r.id === activeRackId) || activeRacks[0];

  // Helper: Update active zone fields
  const updateActiveZone = (fields: Partial<SubWarehouse>) => {
    if (!activeZone) return;
    setSubWarehouses((prev) =>
      prev.map((z) => {
        if (z.id !== activeZone.id) return z;

        const nextLength = fields.length !== undefined ? fields.length : z.length;
        const nextWidth = fields.width !== undefined ? fields.width : z.width;
        const nextHeight = fields.height !== undefined ? fields.height : z.height;

        const defaultRL = Math.max(nextLength - 2, 4);
        const defaultRW = 1.2;
        const defaultRH = Math.max(nextHeight - 1, 3);

        const nextRackLength = fields.rackLength !== undefined ? fields.rackLength : (z.rackLength ?? z.racks?.[0]?.length ?? defaultRL);
        const nextRackWidth = fields.rackWidth !== undefined ? fields.rackWidth : (z.rackWidth ?? z.racks?.[0]?.width ?? defaultRW);
        const nextRackHeight = fields.rackHeight !== undefined ? fields.rackHeight : (z.rackHeight ?? z.racks?.[0]?.height ?? defaultRH);

        const nextRacksCount = fields.racksCount !== undefined ? fields.racksCount : (z.racksCount ?? 4);
        const nextShelves = fields.shelvesPerRack !== undefined ? fields.shelvesPerRack : (z.shelvesPerRack ?? 5);
        const nextBinsPerShelf = fields.binsPerShelf !== undefined ? fields.binsPerShelf : (z.binsPerShelf ?? 2);
        const nextMaxWeight = fields.maxWeightPerBin !== undefined ? fields.maxWeightPerBin : (z.maxWeightPerBin ?? 500);

        const updatedRacks = generateDefaultRacks(
          nextRacksCount,
          nextLength,
          nextHeight,
          nextBinsPerShelf,
          nextShelves,
          2,
          nextRackLength,
          nextRackWidth,
          nextRackHeight
        ).map((r, idx) => {
          const existing = z.racks?.[idx];
          return {
            ...r,
            defaultBinMaxWeight: existing?.defaultBinMaxWeight ?? nextMaxWeight,
            maxRackLoad: existing?.maxRackLoad ?? r.maxRackLoad,
          };
        });

        return {
          ...z,
          ...fields,
          length: nextLength,
          width: nextWidth,
          height: nextHeight,
          rackLength: nextRackLength,
          rackWidth: nextRackWidth,
          rackHeight: nextRackHeight,
          racksCount: nextRacksCount,
          shelvesPerRack: nextShelves,
          binsPerShelf: nextBinsPerShelf,
          maxWeightPerBin: nextMaxWeight,
          racks: updatedRacks
        };
      })
    );
  };

  // Helper: Update rack properties by ID
  const updateRackById = (rackId: string, fields: Partial<RackConfig>) => {
    if (!activeZone) return;
    setSubWarehouses((prev) =>
      prev.map((z) => {
        if (z.id !== activeZone.id) return z;
        const updatedRacks = (z.racks || []).map((r) => {
          if (r.id !== rackId) return r;
          const merged = { ...r, ...fields };
          if (isAutoCalcBin && (fields.length !== undefined || fields.width !== undefined || fields.height !== undefined)) {
            const bays = merged.baysCount || 1;
            const shelves = merged.shelvesCount || 1;
            const binsPerShelf = merged.binsPerShelf || 2;
            const totalLenBins = bays * binsPerShelf;
            merged.defaultBinLength = Math.round((merged.length * 100) / (totalLenBins || 1));
            merged.defaultBinWidth = Math.round(merged.width * 100);
            merged.defaultBinHeight = Math.round((merged.height * 100) / (shelves || 1));
          }
          return merged;
        });
        return { ...z, racks: updatedRacks };
      })
    );
  };

  // Helper: Update rack weight by ID
  const updateRackWeightById = (rackId: string, binWeight: number, maxRackLoad?: number) => {
    updateRackById(rackId, {
      defaultBinMaxWeight: binWeight,
      ...(maxRackLoad !== undefined ? { maxRackLoad } : {}),
    });
  };

  // Helper: Update specific rack fields
  const updateActiveRack = (fields: Partial<RackConfig>) => {
    if (!activeZone || !activeRack) return;

    setSubWarehouses((prev) =>
      prev.map((z) => {
        if (z.id !== activeZone.id) return z;

        const updatedRacks = (z.racks || activeRacks).map((r) => {
          if (r.id !== activeRack.id) return r;

          const merged: RackConfig = { ...r, ...fields };

          const bays = merged.baysCount !== undefined ? merged.baysCount : (merged.columnsCount || 6);
          const shelves = merged.horizontalPartitions !== undefined ? merged.horizontalPartitions : (merged.shelvesCount || 5);
          const binsPerShelf = merged.verticalPartitions !== undefined ? merged.verticalPartitions : (merged.binsPerShelf || 2);

          merged.baysCount = bays;
          merged.columnsCount = bays;
          merged.horizontalPartitions = shelves;
          merged.shelvesCount = shelves;
          merged.verticalPartitions = binsPerShelf;
          merged.binsPerShelf = binsPerShelf;

          if (isAutoCalcBin) {
            const totalLenBins = bays * binsPerShelf;
            merged.defaultBinLength = Math.round((merged.length * 100) / (totalLenBins || 1));
            merged.defaultBinWidth = Math.round(merged.width * 100);
            merged.defaultBinHeight = Math.round((merged.height * 100) / (shelves || 1));
          }

          return merged;
        });

        return { ...z, racks: updatedRacks };
      })
    );
  };

  // Rack Checkbox Toggles
  const toggleRackCheckbox = (rackCode: string) => {
    setSelectedRackCodes((prev) => {
      if (prev.includes(rackCode)) {
        return prev.filter((c) => c !== rackCode);
      } else {
        return [...prev, rackCode];
      }
    });
  };

  const selectAllRackCheckboxes = () => {
    if (selectedRackCodes.length === activeRacks.length) {
      setSelectedRackCodes([]);
    } else {
      setSelectedRackCodes(activeRacks.map((r) => r.rackCode));
    }
  };

  // Filtered Racks for 2D Matrix display
  const displayedRacks = activeRacks.filter(
    (r) => selectedRackCodes.length === 0 || selectedRackCodes.includes(r.rackCode)
  );

  // Add Zone Handler
  const handleAddZone = (type: 'AMBIENT' | 'COLD' | 'THERMAL') => {
    const nextIdx = subWarehouses.length + 1;
    const typeLabel = type === 'COLD' ? 'Kho Lạnh' : type === 'THERMAL' ? 'Kho Nhiệt' : 'Kho Thường';
    const defaultRL = 18;
    const defaultRW = 1.2;
    const defaultRH = 5;
    const newZone: SubWarehouse = {
      id: `sub-${Date.now()}`,
      code: `ZONE-${String.fromCharCode(64 + nextIdx)}`,
      name: `Phân Khu ${typeLabel} ${nextIdx}`,
      zoneType: type,
      status: 'active',
      length: 20,
      width: 12,
      height: 6,
      rackLength: defaultRL,
      rackWidth: defaultRW,
      rackHeight: defaultRH,
      racksCount: 3,
      shelvesPerRack: 5,
      binsPerShelf: 2,
      racks: generateDefaultRacks(3, 20, 6, 6, 5, 2, defaultRL, defaultRW, defaultRH),
    };
    setSubWarehouses([...subWarehouses, newZone]);
    setActiveZoneId(newZone.id);
    if (newZone.racks && newZone.racks.length > 0) {
      setActiveRackId(newZone.racks[0].id);
    }
    setSuccess(`Đã tạo phân khu mới: ${newZone.name}`);
  };

  // Save warehouse form handler
  const handleSaveWarehouse = async () => {
    if (!code || !name) {
      setError('Vui lòng nhập Mã Kho Hàng và Tên Kho Hàng');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const fullAddress = `${detailAddress ? detailAddress + ', ' : ''}${ward}, ${province}`;
      const payload: WarehouseRecord = {
        id: id || `wh_${Date.now()}`,
        code: code.trim(),
        name: name.trim(),
        province,
        ward,
        detailAddress,
        address: fullAddress,
        status,
        length,
        width,
        height,
        managerIds: [],
        staffIds: [],
        subWarehouses,
      };

      const savedWarehouse = await upsertWarehouseToApi(payload);
      const existingWarehouses = getStoredWarehouses();
      const updatedList = existingWarehouses.some((w) => w.id === savedWarehouse.id)
        ? existingWarehouses.map((w) => (w.id === savedWarehouse.id ? savedWarehouse : w))
        : [...existingWarehouses, savedWarehouse];
      saveStoredWarehouses(updatedList);
      setSuccess('Lưu cấu hình kho hàng và phân khu kệ dọc thành công!');
      setTimeout(() => {
        navigate('/warehouses');
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu cấu hình kho');
    } finally {
      setSaving(false);
    }
  };



  return (
    <MainLayout>
      <div className="space-y-6 font-sans pb-16">
        {Toast && (error || success) && createPortal(
          <Toast
            message={error || success}
            type={error ? 'error' : 'success'}
            onClose={() => {
              setError('');
              setSuccess('');
            }}
          />,
          document.body
        )}

        {/* PAGE HEADER & TOP NAVIGATION BAR (Exact Products/Main UI Style) */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-md">
              <Store className="h-5 w-5 text-cyan-100" />
              <h1 className="text-lg font-bold tracking-tight text-white">
                {isEditMode ? 'Cấu Hình Dãy Kệ Dọc & Phân Khu Kho' : 'Tạo Kho Hàng Mới'}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSaveWarehouse}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Plus className="h-4.5 w-4.5 text-cyan-700" />
              Thêm mới
            </button>

            <button
              type="button"
              onClick={handleCopyWarehouseConfig}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
              title="Sao chép cấu hình kho"
            >
              <Copy className="h-4.5 w-4.5 text-cyan-700" />
              Copy
            </button>

            <button
              type="button"
              onClick={handleClearAllGoods}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
              title="Xóa hết hàng hóa trong kho"
            >
              <Trash2 className="h-4.5 w-4.5 text-cyan-700" />
              Xóa
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            >
              <Printer className="h-4.5 w-4.5 text-cyan-700" />
              In báo cáo
            </button>

            <button
              type="button"
              onClick={handleExportWarehouseExcel}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            >
              <FileSpreadsheet className="h-4.5 w-4.5 text-cyan-700" />
              Export Excel
            </button>

            <button
              type="button"
              onClick={() => setGridZoomScale((prev) => (prev >= 200 ? 100 : prev + 50))}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
              title="Thay đổi tỷ lệ hiển thị ma trận"
            >
              <Settings className="h-4.5 w-4.5 text-cyan-700" />
              <span>Hiển thị</span>
            </button>

            <button
              type="button"
              onClick={toggleBrowserFullscreen}
              className="inline-flex items-center justify-center h-10 w-10 rounded-xl border-2 border-slate-300 bg-white text-slate-700 shadow-xs transition hover:bg-slate-100 active:scale-95 cursor-pointer"
              title="Toàn màn hình"
            >
              {isFullScreen ? <Minimize2 className="h-4.5 w-4.5" /> : <Maximize2 className="h-4.5 w-4.5" />}
            </button>
          </div>
        </div>

        {/* 4 BUTTON TỔNG HỢP / SUMMARY METRIC CARDS (Matches products/main) */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
            <div>
              <p className="text-sm sm:text-base font-black text-cyan-700 uppercase">
                MÃ KHO: {code || 'CHƯA ĐẶT'}
              </p>
              <p className="text-[11px] font-bold text-slate-500">
                Diện tích: {length * width} m² ({length}m × {width}m)
              </p>
            </div>
          </div>

          <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
            <div>
              <p className="text-sm sm:text-base font-black text-cyan-700 uppercase">
                {subWarehouses.length} PHÂN KHU (ZONES)
              </p>
              <p className="text-[11px] font-bold text-slate-500 truncate max-w-[200px]">
                Đang chọn: {activeZone?.name || 'Chưa chọn'}
              </p>
            </div>
          </div>

          <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
            <div>
              <p className="text-sm sm:text-base font-black text-cyan-700 uppercase">
                {activeRacks.length} DÃY KỆ DỌC SUỐT KHO
              </p>
              <p className="text-[11px] font-bold text-slate-500">
                Đã tick chọn: {selectedRackCodes.length === 0 ? 'Tất cả' : `${selectedRackCodes.length}/${activeRacks.length} dãy`}
              </p>
            </div>
          </div>

          <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
            <div>
              <p className="text-sm sm:text-base font-black text-cyan-700 uppercase">
                {(length * width * height).toLocaleString('vi-VN')} m³ THỂ TÍCH
              </p>
              <p className="text-[11px] font-bold text-slate-500">
                Cao kho tổng: {height} mét
              </p>
            </div>
          </div>
        </div>



        {/* MAIN SPLIT LAYOUT (5 COLS CONFIG / 7 COLS VISUAL WORKSPACE) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT 5 COLUMNS: CONFIG & RACK CHECKBOXES */}
          <div className="lg:col-span-5 space-y-5">
            {/* CARD 1: KHO TỔNG SPECS & ADD ZONE */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-cyan-200/80 dark:border-cyan-900/60 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Building className="h-4 w-4 text-cyan-600" />
                  1. THÔNG SỐ KHO TỔNG & PHÂN KHU
                </h2>
                <span className="text-xs font-extrabold text-cyan-600 bg-cyan-50 px-2.5 py-0.5 rounded-full border border-cyan-200">
                  {subWarehouses.length} Phân Khu
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Mã Kho Hàng *</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tên Kho Hàng *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-[11px] text-slate-500 block font-semibold">Dài (m)</span>
                  <input
                    type="number"
                    value={length}
                    onChange={(e) => {
                      const val = parseNumInput(e.target.value);
                      setLength(val);
                      if (activeZone) updateActiveZone({ length: val });
                    }}
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-center"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block font-semibold">Rộng (m)</span>
                  <input
                    type="number"
                    value={width}
                    onChange={(e) => {
                      const val = parseNumInput(e.target.value);
                      setWidth(val);
                      if (activeZone) updateActiveZone({ width: val });
                    }}
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-center"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block font-semibold">Cao (m)</span>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => {
                      const val = parseNumInput(e.target.value);
                      setHeight(val);
                      if (activeZone) updateActiveZone({ height: val });
                    }}
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-center"
                  />
                </div>
              </div>

              {/* TẠO MỚI PHÂN KHU BUTTONS */}
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
                  THÊM MỚI PHÂN KHU VÀO KHO
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddZone('AMBIENT')}
                    className="px-2.5 py-1.5 rounded-xl border border-cyan-300 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 text-[11px] font-black transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> + Kho Thường
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddZone('COLD')}
                    className="px-2.5 py-1.5 rounded-xl border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 text-[11px] font-black transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Snowflake className="h-3.5 w-3.5" /> + Kho Lạnh
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddZone('THERMAL')}
                    className="px-2.5 py-1.5 rounded-xl border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-800 text-[11px] font-black transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Thermometer className="h-3.5 w-3.5" /> + Kho Nhiệt
                  </button>
                </div>
              </div>
            </div>

            {/* CARD 2: CẤU HÌNH PHÂN KHU DÃY KỆ DỌC */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-cyan-200/80 dark:border-cyan-900/60 shadow-sm space-y-4">
              {/* ZONE SELECTOR TABS */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Layers className="h-4 w-4 text-cyan-600" />
                  2. CẤU HÌNH PHÂN KHU (ZONES)
                </h2>

                <div className="flex items-center gap-1 overflow-x-auto max-w-[240px]">
                  {subWarehouses.map((z) => (
                    <button
                      key={z.id}
                      type="button"
                      onClick={() => {
                        setActiveZoneId(z.id);
                        if (z.racks && z.racks.length > 0) setActiveRackId(z.racks[0].id);
                        setSelectedRackCodes([]);
                      }}
                      className={`px-3 py-1 rounded-xl text-xs font-extrabold transition cursor-pointer border ${z.id === activeZone?.id
                        ? 'bg-cyan-600 text-white border-cyan-600 shadow'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-cyan-50'
                        }`}
                    >
                      {z.code}
                    </button>
                  ))}
                </div>
              </div>

              {hasWarehouseGoods && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/60 px-3.5 py-2 text-xs font-bold text-amber-900 dark:text-amber-200 shadow-2xs flex items-center gap-2">
                  <ShieldCheck className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <p className="font-black text-amber-950 dark:text-amber-100 uppercase tracking-wide">
                    ĐÃ KHÓA THÔNG SỐ KỆ (ĐANG CHỨA HÀNG)
                  </p>
                </div>
              )}

              {activeZone && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Mã Phân Khu</label>
                      <input
                        type="text"
                        value={activeZone.code}
                        onChange={(e) => updateActiveZone({ code: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tên Phân Khu</label>
                      <input
                        type="text"
                        value={activeZone.name}
                        onChange={(e) => updateActiveZone({ name: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>

                  {/* KÍCH THƯỚC PHÂN KHU & KÍCH THƯỚC KỆ & VÁCH NGĂN */}
                  <div className="space-y-3 pt-1">
                    {/* SECTION A: KÍCH THƯỚC PHÂN KHU (ZONE DIMENSIONS) */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                        1. KÍCH THƯỚC PHÂN KHU (ZONES)
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Dài (m)</label>
                          <input
                            type="number"
                            min={0}
                            disabled={hasWarehouseGoods}
                            value={activeZone.length}
                            onChange={(e) => updateActiveZone({ length: parseNumInput(e.target.value) })}
                            className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-center disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Rộng (m)</label>
                          <input
                            type="number"
                            min={0}
                            disabled={hasWarehouseGoods}
                            value={activeZone.width}
                            onChange={(e) => updateActiveZone({ width: parseNumInput(e.target.value) })}
                            className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-center disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Cao (m)</label>
                          <input
                            type="number"
                            min={0}
                            disabled={hasWarehouseGoods}
                            value={activeZone.height}
                            onChange={(e) => updateActiveZone({ height: parseNumInput(e.target.value) })}
                            className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-center disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>
                    </div>

                    {/* SECTION B: KÍCH THƯỚC DÃY KỆ (RACK SPECIFICATIONS) */}
                    <div className="bg-cyan-50/70 dark:bg-cyan-950/40 p-2.5 rounded-xl border border-cyan-200 dark:border-cyan-800">
                      <span className="text-[11px] font-black text-cyan-800 dark:text-cyan-300 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                        2. KÍCH THƯỚC DÃY KỆ (RACKS)
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block font-bold text-cyan-900 dark:text-cyan-200 mb-1">Dài Kệ (m)</label>
                          <input
                            type="number"
                            min={0}
                            disabled={hasWarehouseGoods}
                            value={activeZone.rackLength ?? activeZone.racks?.[0]?.length ?? Math.max(activeZone.length - 2, 4)}
                            onChange={(e) => updateActiveZone({ rackLength: parseNumInput(e.target.value) })}
                            className="w-full px-2 py-1 rounded-lg border border-cyan-300 dark:border-cyan-700 font-black bg-white dark:bg-slate-900 text-center text-cyan-700 dark:text-cyan-300 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-cyan-900 dark:text-cyan-200 mb-1">Rộng Kệ (m)</label>
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            disabled={hasWarehouseGoods}
                            value={activeZone.rackWidth ?? activeZone.racks?.[0]?.width ?? 1.2}
                            onChange={(e) => updateActiveZone({ rackWidth: parseNumInput(e.target.value) })}
                            className="w-full px-2 py-1 rounded-lg border border-cyan-300 dark:border-cyan-700 font-black bg-white dark:bg-slate-900 text-center text-cyan-700 dark:text-cyan-300 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-cyan-900 dark:text-cyan-200 mb-1">Cao Kệ (m)</label>
                          <input
                            type="number"
                            min={0}
                            disabled={hasWarehouseGoods}
                            value={activeZone.rackHeight ?? activeZone.racks?.[0]?.height ?? Math.max(activeZone.height - 1, 3)}
                            onChange={(e) => updateActiveZone({ rackHeight: parseNumInput(e.target.value) })}
                            className="w-full px-2 py-1 rounded-lg border border-cyan-300 dark:border-cyan-700 font-black bg-white dark:bg-slate-900 text-center text-cyan-700 dark:text-cyan-300 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>
                    </div>

                    {/* SECTION C: CẤU TRÚC VÁCH & TẢI TRỌNG */}
                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                        3. CẤU TRÚC VÁCH & TẢI TRỌNG Ô
                      </span>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Số Dãy Dọc</label>
                          <input
                            type="number"
                            min={0}
                            disabled={hasWarehouseGoods}
                            value={activeZone.racksCount ?? 4}
                            onChange={(e) => updateActiveZone({ racksCount: parseNumInput(e.target.value) })}
                            className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-black bg-white dark:bg-slate-900 text-center text-cyan-600 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Vách Ngang</label>
                          <input
                            type="number"
                            min={0}
                            disabled={hasWarehouseGoods}
                            value={activeZone.shelvesPerRack ?? 5}
                            onChange={(e) => updateActiveZone({ shelvesPerRack: parseNumInput(e.target.value) })}
                            className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-black bg-white dark:bg-slate-900 text-center text-indigo-600 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Vách Dọc</label>
                          <input
                            type="number"
                            min={0}
                            disabled={hasWarehouseGoods}
                            value={activeZone.binsPerShelf ?? 2}
                            onChange={(e) => updateActiveZone({ binsPerShelf: parseNumInput(e.target.value) })}
                            className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-black bg-white dark:bg-slate-900 text-center text-amber-600 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Trọng Tải Ô (kg)</label>
                          <input
                            type="number"
                            min={0}
                            disabled={hasWarehouseGoods}
                            value={activeZone.maxWeightPerBin ?? 500}
                            onChange={(e) => updateActiveZone({ maxWeightPerBin: parseNumInput(e.target.value) })}
                            className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-black bg-white dark:bg-slate-900 text-center text-emerald-600 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* CARD 3: INTERACTIVE RACK CHECKBOXES & ROW WEIGHT CONFIGURATION */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border-2 border-cyan-400 dark:border-cyan-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-cyan-600" />
                  TICK CHỌN & CẤU HÌNH TRỌNG TẢI DÃY KỆ
                </h3>

                <button
                  type="button"
                  onClick={selectAllRackCheckboxes}
                  className="px-2.5 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-950 hover:bg-cyan-100 text-cyan-700 dark:text-cyan-300 text-[11px] font-black transition cursor-pointer border border-cyan-200 dark:border-cyan-800"
                >
                  {selectedRackCodes.length === activeRacks.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả dãy'}
                </button>
              </div>

              <p className="text-[11px] text-slate-500 font-semibold">
                Tick chọn từng kệ và nhập Trọng Tải (kg) riêng cho từng hàng dãy kệ:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {activeRacks.map((r) => {
                  const isChecked = selectedRackCodes.length === 0 || selectedRackCodes.includes(r.rackCode);
                  const currentBinWeight = r.defaultBinMaxWeight ?? activeZone?.maxWeightPerBin ?? 500;
                  const currentRackLoad = r.maxRackLoad ?? 16000;

                  return (
                    <div
                      key={r.id}
                      className={`p-3 rounded-xl border transition space-y-2 ${isChecked
                        ? 'border-cyan-400 bg-cyan-50/60 dark:bg-cyan-950/40 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-400 opacity-65'
                        }`}
                    >
                      {/* TOP CHECKBOX HEADER */}
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveRackId(r.id);
                            toggleRackCheckbox(r.rackCode);
                          }}
                          className="flex items-center gap-1.5 text-xs font-black cursor-pointer hover:text-cyan-600"
                        >
                          {isChecked ? (
                            <CheckCircle className="h-4 w-4 text-cyan-600 fill-cyan-100 shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-400 shrink-0" />
                          )}
                          <span>{r.rackCode} - {r.name}</span>
                        </button>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200">
                          {activeZone?.binsPerShelf ?? 2} Vách Dọc
                        </span>
                      </div>

                      {/* EDITABLE DIMENSIONS & WEIGHT INPUT FIELDS FOR THIS RACK ROW */}
                      <div className="space-y-2 pt-1">
                        <div className="grid grid-cols-3 gap-1.5">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Dài Kệ (m)</label>
                            <input
                              type="number"
                              min={0}
                              disabled={hasWarehouseGoods}
                              value={r.length}
                              onChange={(e) => updateRackById(r.id, { length: parseNumInput(e.target.value) })}
                              className="w-full px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-xs text-center text-cyan-800 dark:text-cyan-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Rộng Kệ (m)</label>
                            <input
                              type="number"
                              min={0}
                              step={0.1}
                              disabled={hasWarehouseGoods}
                              value={r.width}
                              onChange={(e) => updateRackById(r.id, { width: parseNumInput(e.target.value) })}
                              className="w-full px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-xs text-center text-cyan-800 dark:text-cyan-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Cao Kệ (m)</label>
                            <input
                              type="number"
                              min={0}
                              disabled={hasWarehouseGoods}
                              value={r.height}
                              onChange={(e) => updateRackById(r.id, { height: parseNumInput(e.target.value) })}
                              className="w-full px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-xs text-center text-cyan-800 dark:text-cyan-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                              Tải trọng ô (kg/ô)
                            </label>
                            <input
                              type="number"
                              min={0}
                              disabled={hasWarehouseGoods}
                              value={currentBinWeight}
                              onChange={(e) => updateRackWeightById(r.id, parseNumInput(e.target.value), currentRackLoad)}
                              className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-xs text-cyan-700 text-center disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                              Trọng tải dãy (kg)
                            </label>
                            <input
                              type="number"
                              min={0}
                              disabled={hasWarehouseGoods}
                              value={currentRackLoad}
                              onChange={(e) => updateRackWeightById(r.id, currentBinWeight, parseNumInput(e.target.value))}
                              className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-xs text-emerald-700 text-center disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT 7 COLUMNS: VISUAL 2D MATRIX & 3D REALTIME WORKSPACE */}
          <div className="lg:col-span-7 space-y-5">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-cyan-200/80 dark:border-cyan-900/60 shadow-sm space-y-4">
              {/* WORKSPACE HEADER & VIEW TOGGLES */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    SƠ ĐỒ TRỰC QUAN KỆ DỌC
                  </span>
                  <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                    {displayedRacks.length}/{activeRacks.length} Dãy được chọn
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Mode Toggles */}
                  <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setViewMode('2D_MATRIX')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${viewMode === '2D_MATRIX'
                        ? 'bg-cyan-600 text-white shadow'
                        : 'text-slate-600 dark:text-slate-300 hover:text-cyan-600'
                        }`}
                    >
                      <Grid className="h-3.5 w-3.5" />
                      Ma Trận 2D
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('3D_VIEW')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${viewMode === '3D_VIEW'
                        ? 'bg-cyan-600 text-white shadow'
                        : 'text-slate-600 dark:text-slate-300 hover:text-cyan-600'
                        }`}
                    >
                      <Move3d className="h-3.5 w-3.5" />
                      Khối 3D
                    </button>
                  </div>

                  {/* 2D Zoom Controls */}
                  {viewMode === '2D_MATRIX' && (
                    <div className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setGridZoomScale((z) => Math.max(100, z - 50))}
                        className="px-2 py-1 hover:text-cyan-600 cursor-pointer"
                        title="Thu nhỏ"
                      >
                        -
                      </button>
                      <span className="px-1 text-cyan-700 dark:text-cyan-400">{gridZoomScale}%</span>
                      <button
                        type="button"
                        onClick={() => setGridZoomScale((z) => Math.min(300, z + 50))}
                        className="px-2 py-1 hover:text-cyan-600 cursor-pointer"
                        title="Phóng to đến 300%"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* BIN STATUS LEGEND BAR */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-slate-500 uppercase tracking-wider text-[11px]">Trạng Thái Ô Kệ:</span>
                  <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                    <span className="h-3.5 w-3.5 rounded border border-slate-300 bg-white inline-block shadow-2xs" />
                    Ô Trống
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-amber-900 dark:text-amber-300 font-black">
                    <span className="h-3.5 w-3.5 rounded border-2 border-amber-500 bg-amber-400 inline-block shadow-2xs animate-pulse" />
                    Đã Có Hàng (Đã phân bổ)
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-cyan-800 dark:text-cyan-300 font-bold">
                    <span className="h-3.5 w-3.5 rounded border border-cyan-400 bg-cyan-100 inline-block shadow-2xs" />
                    Tùy chỉnh tải trọng
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleClearAllGoods}
                  className="px-3 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950 dark:hover:bg-rose-900 dark:text-rose-300 font-black text-xs transition border border-rose-200 dark:border-rose-800 flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                  title="Giải phóng toàn bộ ô kệ và đưa toàn bộ kho về trạng thái kệ trống"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                  <span>Xóa hết hàng (Về kệ trống)</span>
                </button>
              </div>

              {/* VIEW CANVAS RENDER */}
              {viewMode === '3D_VIEW' ? (
                <Warehouse3DViewer subWarehouse={activeZone} selectedRackIds={selectedRackCodes} />
              ) : (
                /* 2D MATRIX EXCEL GRID VIEW MODE */
                <div className="space-y-4 overflow-x-auto">
                  <div
                    style={{ zoom: `${gridZoomScale}%` }}
                    className="space-y-6 transition-all duration-200"
                  >
                    <WarehouseSlottingGrid
                      warehouse={{
                        id: id || 'temp-id',
                        code,
                        name,
                        province,
                        ward,
                        address: detailAddress,
                        detailAddress,
                        status,
                        length,
                        width,
                        height,
                        managerIds: [],
                        staffIds: [],
                        subWarehouses,
                      }}
                      activeZoneId={activeZoneId}
                      activeRackId={activeRackId}
                      mode="view"
                      onBinClick={(fullBinCode, customConfig, occupiedInfo, goodsList) => {
                        setEditingBinCode(fullBinCode);
                        const rawList = goodsList && goodsList.length > 0 ? goodsList : (occupiedInfo ? [occupiedInfo] : []);
                        const normalizedList = rawList.map((item: any) => ({
                          ...item,
                          quantity: Number(item.quantity || item.totalPhysical || item.qty || 1),
                        }));

                        setActiveBinGoodsDetails({
                          fullBinCode,
                          customConfig,
                          occupiedInfo,
                          goodsList: normalizedList,
                        });
                        const binShort = fullBinCode.split('-').pop() || fullBinCode;
                        setBinCustomForm(
                          customConfig || {
                            binCode: binShort,
                            length: 120,
                            width: 80,
                            height: 100,
                            maxWeight: 500,
                          }
                        );
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* POPUP MODAL: THÔNG TIN CHI TIẾT Ô KỆ & LỊCH SỬ NHẬP HÀNG / CẤU HÌNH TẢI TRỌNG */}
      {editingBinCode && (() => {
        const binShort = editingBinCode.split('-').pop() || editingBinCode;
        const occupiedInfo = activeBinGoodsDetails?.occupiedInfo;
        const goodsList = activeBinGoodsDetails?.goodsList || [];
        const validGoodsList = goodsList.filter((item: any) => item.sku !== 'SKU-DRAFT');
        const hasGoods = Boolean(
          (occupiedInfo && (occupiedInfo.totalPhysical > 0 || occupiedInfo.allocated > 0 || (occupiedInfo.occupancyPct && occupiedInfo.occupancyPct > 0))) ||
          (validGoodsList && validGoodsList.length > 0)
        );
        const customConfig = activeBinGoodsDetails?.customConfig || (activeZone?.racks || [])
          .flatMap((rk: any) => Object.values(rk.customBins || {}))
          .find((cb: any) => cb.binCode === binShort || cb.binCode === editingBinCode);

        return (
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-5 animate-fadeIn">
            <div className="w-full max-w-[95vw] lg:max-w-[92vw] xl:max-w-[90vw] rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border-2 border-cyan-500/30 overflow-hidden flex flex-col max-h-[94vh]">

              {/* Modal Header (Pure Cyan theme) */}
              <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 text-white px-6 py-4 flex items-center justify-between border-b border-cyan-500/40 shadow-sm">
                <div className="flex items-center gap-3.5">
                  <div className="h-10 w-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-white shadow-2xs">
                    <Boxes className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white flex items-center gap-2.5 tracking-tight">
                      THÔNG TIN CHI TIẾT Ô {binShort}
                      {hasGoods ? (
                        <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-amber-950 border border-amber-300 shadow-2xs">
                          Đã Có Hàng
                        </span>
                      ) : (
                        <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-cyan-900/60 text-cyan-100 border border-white/30">
                          Kệ Trống
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-cyan-100 font-medium mt-0.5">
                      Mã vị trí ô chứa: <span className="font-mono text-white font-semibold">{editingBinCode}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingBinCode(null)}
                  className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
                >
                  <X className="h-5.5 w-5.5" />
                </button>
              </div>

              {/* Modal Body (Spacious & Open layout) */}
              <div className="p-6 overflow-y-auto space-y-5 text-sm text-slate-800 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-900/50">

                {/* SECTION 1: INBOUND & OUTBOUND GOODS TRANSACTION HISTORY TABLE */}
                {goodsList && goodsList.length > 0 ? (() => {
                  const filteredGoodsList = goodsList.filter((item: any) => item.sku !== 'SKU-DRAFT');

                  if (filteredGoodsList.length === 0) {
                    return (
                      <div className="rounded-2xl border border-cyan-200 dark:border-cyan-900/70 bg-white dark:bg-slate-900 p-5 space-y-2 shadow-sm text-center">
                        <span className="font-bold text-xs sm:text-sm uppercase tracking-wider text-cyan-900 dark:text-cyan-200 flex items-center justify-center gap-2">
                          <Boxes className="h-4.5 w-4.5 text-cyan-600 dark:text-cyan-400" />
                          Trạng Thái Vị Trí Ô KỆ
                        </span>
                        <p className="text-xs font-medium text-slate-500 py-1">
                          KỆ TRỐNG - Ô chứa này hiện tại chưa có hàng hóa lưu trữ trong CSDL.
                        </p>
                      </div>
                    );
                  }

                  const groupedGoodsMap = new Map<string, {
                    sku: string;
                    productName: string;
                    unit: string;
                    baseOccupancyPct: number;
                    transactions: any[];
                  }>();

                  filteredGoodsList.forEach((item: any) => {
                    const pSku = item.sku || item.productSku || 'SKU-001';
                    const pName = item.productName || 'Sản phẩm';
                    const pKey = `${pSku}___${pName}`;

                    let itemPct = item.occupancyPct;
                    if (itemPct === undefined || itemPct === null) {
                      itemPct = Math.round(100 / Math.max(1, goodsList.length));
                    }

                    if (!groupedGoodsMap.has(pKey)) {
                      groupedGoodsMap.set(pKey, {
                        sku: pSku,
                        productName: pName,
                        unit: item.unit || 'Cái',
                        baseOccupancyPct: itemPct,
                        transactions: [],
                      });
                    }

                    groupedGoodsMap.get(pKey)!.transactions.push(item);
                  });

                  const groupedGoodsList = Array.from(groupedGoodsMap.values()).map((grp) => {
                    const inboundTransactions = grp.transactions.filter((t) => !t.isOutbound && (Number(t.quantity || t.totalPhysical || 0) > 0 || !t.orderCode?.startsWith('PX')));
                    const outboundTransactions = grp.transactions.filter((t) => t.isOutbound || Number(t.quantity || 0) < 0);

                    const totalInbound = inboundTransactions.reduce((s, t) => s + Math.abs(Number(t.quantity || t.totalPhysical || 0)), 0) || 500;
                    const totalOutbound = outboundTransactions.reduce((s, t) => s + Math.abs(Number(t.quantity || 0)), 0);

                    const netQty = Math.max(0, totalInbound - totalOutbound);
                    const netOccupancyPct = totalInbound > 0
                      ? Math.round((netQty / totalInbound) * grp.baseOccupancyPct)
                      : Math.max(0, grp.baseOccupancyPct - Math.round((totalOutbound / 500) * grp.baseOccupancyPct));

                    return {
                      ...grp,
                      totalInbound,
                      totalOutbound,
                      netQty,
                      netOccupancyPct,
                    };
                  });

                  const grandTotalInbound = groupedGoodsList.reduce((s, g) => s + g.totalInbound, 0);
                  const grandTotalOutbound = groupedGoodsList.reduce((s, g) => s + g.totalOutbound, 0);
                  const grandNetPhysical = Math.max(0, grandTotalInbound - grandTotalOutbound);
                  const grandOccupancyPct = Math.min(100, groupedGoodsList.reduce((s, g) => s + g.netOccupancyPct, 0));

                  return (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4 shadow-sm">

                      {/* BIN OVERALL SUMMARY BANNER */}
                      <div className="rounded-xl border border-cyan-200 dark:border-cyan-800 bg-gradient-to-r from-cyan-50/90 via-slate-50 to-cyan-50/90 dark:from-slate-950 dark:via-cyan-950/40 dark:to-slate-950 p-4 space-y-3 shadow-2xs">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-200/70 dark:border-cyan-800/60 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-cyan-950 dark:text-cyan-200 uppercase tracking-wide">
                              Vị Trí Lưu Trữ: <span className="text-cyan-800 dark:text-cyan-300 font-black font-mono">{editingBinCode}</span>
                            </span>
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                              ({activeZone?.name || 'Phân khu kho'})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Tổng dung tích chiếm dụng:</span>
                            <span className="px-3 py-1 rounded-full text-xs font-black bg-cyan-700 text-white shadow-2xs">
                              {grandOccupancyPct}% {grandOccupancyPct >= 100 ? '(ĐẦY 100%)' : ''}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-xs">
                          <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200">
                            <span className="block text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">TỔNG HÀNG ĐÃ NHẬP</span>
                            <span className="font-black text-sm text-emerald-800 dark:text-emerald-300">+{grandTotalInbound.toLocaleString('vi-VN')}</span>
                          </div>
                          <div className="p-2.5 rounded-lg border border-rose-200 bg-rose-50/80 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200">
                            <span className="block text-[11px] font-semibold text-rose-700 dark:text-rose-400">TỔNG HÀNG ĐÃ XUẤT</span>
                            <span className="font-black text-sm text-rose-800 dark:text-rose-300">-{grandTotalOutbound.toLocaleString('vi-VN')}</span>
                          </div>
                          <div className="p-2.5 rounded-lg border border-cyan-300 bg-cyan-100/80 dark:bg-cyan-900/60 text-cyan-950 dark:text-cyan-100">
                            <span className="block text-[11px] font-semibold text-cyan-800 dark:text-cyan-300">TỒN KHO THỰC TẾ HIỆN TẠI</span>
                            <span className="font-black text-sm text-cyan-900 dark:text-cyan-100">{grandNetPhysical.toLocaleString('vi-VN')}</span>
                          </div>
                        </div>

                        {/* PRODUCT OCCUPANCY PERCENTAGE BREAKDOWN */}
                        <div className="pt-1">
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 uppercase tracking-wider">
                            Chi tiết phân bổ % sản phẩm trong ô:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {groupedGoodsList.map((g, idx) => (
                              <div
                                key={idx}
                                className="inline-flex items-center gap-2 px-3 py-1 rounded-lg border border-cyan-300 dark:border-cyan-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 shadow-2xs"
                              >
                                <span className="font-mono text-cyan-800 dark:text-cyan-300 font-extrabold">[{g.sku}]</span>
                                <span>{g.productName}:</span>
                                <span className="px-2 py-0.5 rounded bg-cyan-700 text-white font-black text-[11px]">
                                  {g.netOccupancyPct}% dung tích
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                        <span className="font-semibold text-xs sm:text-sm uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                          <Package className="h-4.5 w-4.5 text-cyan-600 dark:text-cyan-400" />
                          Nhật ký lịch sử xuất nhập & giao dịch thực tế
                        </span>
                        <span className="text-[11px] font-medium text-cyan-700 bg-cyan-50 dark:bg-cyan-950 dark:text-cyan-300 px-2.5 py-0.5 rounded-full border border-cyan-200 dark:border-cyan-800">
                          {goodsList.length} lượt xuất nhập
                        </span>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700">
                        <table className="w-full text-center text-xs border-collapse border border-slate-300 dark:border-slate-700">
                          <thead className="bg-cyan-100/90 dark:bg-slate-800 text-cyan-950 dark:text-cyan-200 font-extrabold text-xs uppercase tracking-wider">
                            <tr>
                              <th className="py-3 px-3 font-extrabold text-center w-12 border border-slate-300 dark:border-slate-700 whitespace-nowrap text-cyan-950 dark:text-cyan-200">STT</th>
                              <th className="py-3 px-3 font-extrabold text-center border border-slate-300 dark:border-slate-700 whitespace-nowrap text-cyan-950 dark:text-cyan-200">Loại giao dịch</th>
                              <th className="py-3 px-3 font-extrabold text-center border border-slate-300 dark:border-slate-700 whitespace-nowrap text-cyan-950 dark:text-cyan-200">Mã hàng hóa</th>
                              <th className="py-3 px-3 font-extrabold text-center border border-slate-300 dark:border-slate-700 whitespace-nowrap text-cyan-950 dark:text-cyan-200">Mã phiếu</th>
                              <th className="py-3 px-3 font-extrabold text-center border border-slate-300 dark:border-slate-700 whitespace-nowrap text-cyan-950 dark:text-cyan-200">Tên hàng hóa</th>
                              <th className="py-3 px-3 font-extrabold text-center border border-slate-300 dark:border-slate-700 whitespace-nowrap text-cyan-950 dark:text-cyan-200">ĐVT</th>
                              <th className="py-3 px-3 font-extrabold text-center border border-slate-300 dark:border-slate-700 whitespace-nowrap text-cyan-950 dark:text-cyan-200">Số lượng</th>
                              <th className="py-3 px-3 font-extrabold text-center border border-slate-300 dark:border-slate-700 whitespace-nowrap text-cyan-950 dark:text-cyan-200">Thời gian</th>
                              <th className="py-3 px-3 font-extrabold text-center border border-slate-300 dark:border-slate-700 whitespace-nowrap text-cyan-950 dark:text-cyan-200">Đối tác / Khách / NCC</th>
                              <th className="py-3 px-3 font-extrabold text-center border border-slate-300 dark:border-slate-700 whitespace-nowrap text-cyan-950 dark:text-cyan-200">% chứa</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-300 dark:divide-slate-700 font-normal text-slate-700 dark:text-slate-200">
                            {(() => {
                              let sttCounter = 1;
                              return groupedGoodsList.flatMap((group, gIdx) => {
                                return group.transactions.map((tx: any, txIdx: number) => {
                                  const currentStt = sttCounter++;
                                  const isOutbound = Boolean(
                                    tx.isOutbound ||
                                    Number(tx.quantity || 0) < 0 ||
                                    (tx.orderCode && (
                                      tx.orderCode.startsWith('PX') ||
                                      tx.orderCode.startsWith('XK') ||
                                      tx.orderCode.startsWith('XH') ||
                                      tx.orderCode.startsWith('XBL') ||
                                      tx.orderCode.startsWith('XBH') ||
                                      tx.orderCode.includes('XUẤT') ||
                                      tx.orderCode.includes('XUAT') ||
                                      tx.orderCode === 'ĐANG-XUẤT'
                                    )) ||
                                    (tx.supplierName && (
                                      tx.supplierName.includes('Đơn xuất') ||
                                      tx.supplierName.includes('Xuất kho')
                                    ))
                                  );
                                  const qtyNum = Math.abs(Number(tx.quantity || tx.totalPhysical || tx.qty || 0));
                                  const realOrderCode = tx.orderCode && tx.orderCode !== 'ĐANG-XẾP'
                                    ? tx.orderCode
                                    : (tx.id ? `${isOutbound ? 'PXK' : 'PNK'}-${String(tx.id).padStart(4, '0')}` : (isOutbound ? 'PXK-DRAFT' : 'PNK-TỒN-KHO'));

                                  return (
                                    <tr
                                      key={`${gIdx}-${txIdx}`}
                                      className={`hover:bg-cyan-50/40 dark:hover:bg-slate-800/50 transition-colors ${isOutbound ? 'bg-rose-50/20 dark:bg-rose-950/20' : ''
                                        }`}
                                    >
                                      <td className="py-2.5 px-3 text-center font-bold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 whitespace-nowrap bg-white dark:bg-slate-900 align-middle">
                                        {currentStt}
                                      </td>

                                      <td className="py-2.5 px-3 text-center border border-slate-300 dark:border-slate-700 whitespace-nowrap align-middle">
                                        {isOutbound ? (
                                          <span className="px-2 py-0.5 rounded font-black text-[10px] bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs">
                                            XUẤT KHO
                                          </span>
                                        ) : (
                                          <span className="px-2 py-0.5 rounded font-black text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                                            NHẬP KHO
                                          </span>
                                        )}
                                      </td>

                                      <td className="py-2.5 px-3 text-center font-mono font-bold text-cyan-700 dark:text-cyan-400 border border-slate-300 dark:border-slate-700 whitespace-nowrap bg-white dark:bg-slate-900 align-middle">
                                        {group.sku}
                                      </td>

                                      <td className="py-2.5 px-3 text-center font-mono font-medium border border-slate-300 dark:border-slate-700 whitespace-nowrap align-middle">
                                        <span
                                          className={`px-2.5 py-1 rounded border font-bold text-xs ${isOutbound
                                            ? 'bg-rose-50 text-rose-900 border-rose-300'
                                            : 'bg-cyan-50 text-cyan-950 border-cyan-300'
                                            }`}
                                        >
                                          {realOrderCode}
                                        </span>
                                      </td>

                                      <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 align-middle">
                                        {group.productName}
                                      </td>

                                      <td className="py-2.5 px-3 text-center font-medium text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 whitespace-nowrap bg-white dark:bg-slate-900 align-middle">
                                        {group.unit}
                                      </td>

                                      <td
                                        className={`py-2.5 px-3 text-center font-black border border-slate-300 dark:border-slate-700 whitespace-nowrap align-middle ${isOutbound ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                                          }`}
                                      >
                                        {isOutbound ? `-${qtyNum.toLocaleString('vi-VN')}` : `+${qtyNum.toLocaleString('vi-VN')}`}
                                      </td>

                                      <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 whitespace-nowrap align-middle">
                                        {tx.inboundDate}
                                      </td>

                                      <td className="py-2.5 px-3 text-center font-medium text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 align-middle">
                                        {tx.supplierName}
                                      </td>

                                      <td className="py-2.5 px-3 text-center border border-slate-300 dark:border-slate-700 whitespace-nowrap bg-white dark:bg-slate-900 align-middle">
                                        <span className={`px-2.5 py-1 rounded-full font-black text-xs border ${isOutbound ? 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200' : 'bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-200'}`}>
                                          {isOutbound ? `Còn lại ${group.netOccupancyPct}%` : `${tx.occupancyPct || group.baseOccupancyPct || 100}%`}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                });
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })() : (
                  <div className="rounded-2xl border border-cyan-200 dark:border-cyan-900/70 bg-white dark:bg-slate-900 p-5 space-y-2 shadow-sm text-center">
                    <span className="font-bold text-xs sm:text-sm uppercase tracking-wider text-cyan-900 dark:text-cyan-200 flex items-center justify-center gap-2">
                      <Boxes className="h-4.5 w-4.5 text-cyan-600 dark:text-cyan-400" />
                      Trạng Thái Vị Trí Ô Kệ
                    </span>
                    <p className="text-xs font-medium text-slate-500 py-1">
                      KỆ TRỐNG - Ô chứa này hiện tại chưa có hàng hóa lưu trữ trong CSDL.
                    </p>
                  </div>
                )}

                {/* SECTION 2: BIN SPECS & WEIGHT CAPACITY FORM */}
                <div className="rounded-2xl border border-cyan-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm">
                  <span className="font-extrabold text-xs sm:text-sm uppercase tracking-wider text-cyan-950 dark:text-cyan-200 block border-b border-slate-200 dark:border-slate-800 pb-3">
                    Cấu hình kích thước & Tải trọng ô
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-extrabold text-cyan-950 dark:text-cyan-200 block">Dài (cm)</label>
                      <input
                        type="number"
                        value={binCustomForm.length !== undefined && binCustomForm.length !== null && binCustomForm.length > 0 ? binCustomForm.length : ((customConfig as any)?.length || 120)}
                        onChange={(e) => setBinCustomForm((c) => ({ ...c, length: Number(e.target.value) || 0 }))}
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-center bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-cyan-500 outline-none shadow-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-extrabold text-cyan-950 dark:text-cyan-200 block">Rộng (cm)</label>
                      <input
                        type="number"
                        value={binCustomForm.width !== undefined && binCustomForm.width !== null && binCustomForm.width > 0 ? binCustomForm.width : ((customConfig as any)?.width || 80)}
                        onChange={(e) => setBinCustomForm((c) => ({ ...c, width: Number(e.target.value) || 0 }))}
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-center bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-cyan-500 outline-none shadow-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-extrabold text-cyan-950 dark:text-cyan-200 block">Cao (cm)</label>
                      <input
                        type="number"
                        value={binCustomForm.height !== undefined && binCustomForm.height !== null && binCustomForm.height > 0 ? binCustomForm.height : ((customConfig as any)?.height || 100)}
                        onChange={(e) => setBinCustomForm((c) => ({ ...c, height: Number(e.target.value) || 0 }))}
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-center bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-cyan-500 outline-none shadow-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-extrabold text-cyan-950 dark:text-cyan-200 block">Tải trọng (kg)</label>
                      <input
                        type="number"
                        value={binCustomForm.maxWeight !== undefined && binCustomForm.maxWeight !== null && binCustomForm.maxWeight > 0 ? binCustomForm.maxWeight : ((customConfig as any)?.maxWeight || 500)}
                        onChange={(e) => setBinCustomForm((c) => ({ ...c, maxWeight: Number(e.target.value) || 0 }))}
                        className="w-full h-10 px-3 rounded-xl border-2 border-cyan-400 font-black text-center text-cyan-950 dark:text-cyan-200 bg-cyan-50 dark:bg-cyan-950 focus:border-cyan-600 outline-none shadow-xs"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="bg-white dark:bg-slate-950 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingBinCode(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleSaveBinCustomConfig}
                  className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold text-xs shadow-md transition cursor-pointer flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Lưu cấu hình ô chứa
                </button>
              </div>

            </div>
          </div>
        );
      })()}
    </MainLayout>
  );
}
