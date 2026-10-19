import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, Filter, Package, Layers, Building2, CheckCircle2 } from 'lucide-react';
import {
  calculateGlobalShelfIndex,
  getRackLetterPrefix,
  type SubWarehouse,
  type RackConfig,
} from '../../../shared/utils/warehouseAssignments';
import { fetchWarehouseOccupiedBins } from './WarehouseSlottingGrid';

export interface WarehouseGoodsPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouseCode: string;
  warehouseName: string;
  warehouseAddress?: string;
  subWarehouses: SubWarehouse[];
  activeZoneId?: string;
  activeRackId?: string;
}

interface PrintableGoodsItem {
  sku: string;
  name: string;
  quantity: string | number;
  unit: string;
  occupancyPct: string | number;
}

interface PrintableBinRow {
  stt: number;
  zoneName: string;
  rackCode: string;
  shelfPrefix: string;
  shelfNumber: number;
  binCodeShort: string;
  binLabel: string;
  totalOccupancyPct: number;
  goodsList: PrintableGoodsItem[];
  statusText: string;
}

export const WarehouseGoodsPrintModal: React.FC<WarehouseGoodsPrintModalProps> = ({
  isOpen,
  onClose,
  warehouseCode,
  warehouseName,
  warehouseAddress = '',
  subWarehouses,
  activeZoneId,
  activeRackId,
}) => {
  const [selectedRackFilter, setSelectedRackFilter] = useState<string>('ALL');
  const [filterMode, setFilterMode] = useState<'ALL_BINS' | 'OCCUPIED_ONLY'>('ALL_BINS');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PrintableBinRow[]>([]);

  // Get current logged-in user
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);

  const creatorName =
    currentUser.fullName || currentUser.name || currentUser.username || 'Quản trị viên';

  // Load goods data matching handleExportWarehouseExcel exactly
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);

    async function loadData() {
      try {
        const targetCode = warehouseCode ? warehouseCode.trim().toUpperCase() : '';

        // 1. Single source of truth from visual slotting grid
        const { occupiedMap, goodsListMap } = await fetchWarehouseOccupiedBins(targetCode);

        // 2. Local fallbacks (orders, inventory balances, customBins)
        const stockInOrders = JSON.parse(
          localStorage.getItem('stock_in_orders') ||
            localStorage.getItem('stored_stock_in_orders') ||
            sessionStorage.getItem('stock_in_orders') ||
            '[]'
        );
        const inventoryBalances = JSON.parse(
          localStorage.getItem('inventory_balances') ||
            localStorage.getItem('wms_inventory_balances') ||
            '[]'
        );

        const binDataMap: Record<string, PrintableGoodsItem[]> = {};

        const addGoodsToBin = (
          binCode: string,
          sku: string,
          name: string,
          quantity: string | number,
          unit: string,
          pct: string | number
        ) => {
          if (!binCode || !name) return;
          const normalized = binCode.trim().toUpperCase().replace(/\s+/g, '');
          if (!binDataMap[normalized]) binDataMap[normalized] = [];
          const existing = binDataMap[normalized].find((g) => g.name === name);
          if (!existing) {
            binDataMap[normalized].push({
              sku: sku || 'SKU-001',
              name,
              quantity,
              unit: unit || 'cái',
              occupancyPct: pct,
            });
          }
        };

        if (Array.isArray(stockInOrders)) {
          stockInOrders.forEach((order: any) => {
            const isMatchWh =
              !targetCode ||
              String(order.warehouseCode || '').trim().toUpperCase() === targetCode;
            if (!isMatchWh) return;

            if (order.details && Array.isArray(order.details)) {
              order.details.forEach((dt: any) => {
                const bin = dt.locationBin || dt.binCode || order.locationBin || '';
                if (bin) {
                  addGoodsToBin(
                    bin,
                    dt.productSku || dt.sku || 'SKU-001',
                    dt.productName || dt.name || 'Hàng hóa kho',
                    dt.quantity || dt.qty || 1,
                    dt.unit || 'cái',
                    dt.occupancyPct || 30
                  );
                }
              });
            }
          });
        }

        if (Array.isArray(inventoryBalances)) {
          inventoryBalances.forEach((b: any) => {
            const isMatchWh =
              !targetCode ||
              String(b.warehouseCode || b.warehouse?.code || '').trim().toUpperCase() === targetCode;
            if (!isMatchWh) return;

            const bin = b.binCode || b.locationCode || b.bin || '';
            if (bin) {
              addGoodsToBin(
                bin,
                b.product?.sku || b.sku || 'SKU-001',
                b.productName || b.product?.name || 'Hàng hóa kho',
                b.quantity || b.qty || b.onHand || 1,
                b.unit || b.product?.unit || 'cái',
                b.occupancyPct || 50
              );
            }
          });
        }

        // Custom bins configured inside zones
        subWarehouses.forEach((z) => {
          (z.racks || []).forEach((rk) => {
            if (rk.customBins) {
              Object.entries(rk.customBins).forEach(([binCode, cfg]: [string, any]) => {
                if (cfg && (cfg.productName || cfg.goods)) {
                  if (Array.isArray(cfg.goods)) {
                    cfg.goods.forEach((g: any) => {
                      addGoodsToBin(
                        binCode,
                        g.sku || 'SKU-001',
                        g.name || g.productName,
                        g.quantity || 1,
                        g.unit || 'cái',
                        g.pct || 30
                      );
                    });
                  } else if (cfg.productName) {
                    addGoodsToBin(
                      binCode,
                      cfg.sku || 'SKU-001',
                      cfg.productName,
                      cfg.quantity || 1,
                      cfg.unit || 'cái',
                      cfg.occupancyPct || 50
                    );
                  }
                }
              });
            }
          });
        });

        // 3. Build comprehensive list of all racks, shelves and bins
        const allRows: PrintableBinRow[] = [];
        let counter = 1;

        subWarehouses.forEach((zone) => {
          const racks = zone.racks && zone.racks.length > 0 ? zone.racks : [];

          racks.forEach((rack: RackConfig, rIdx: number) => {
            const rackCode = rack.rackCode || `R${String(rIdx + 1).padStart(2, '0')}`;
            const shelvesCount =
              rack.shelvesCount || rack.horizontalPartitions || zone.shelvesPerRack || 4;
            const baysCount = Math.max(
              1,
              (rack.binsPerShelf || rack.verticalPartitions || zone.binsPerShelf || 8) > 2
                ? rack.binsPerShelf || (rack.verticalPartitions ? rack.verticalPartitions - 1 : 7)
                : 7
            );

            // Traverse from top shelf to bottom shelf matching Excel structure
            for (let s = shelvesCount; s >= 1; s--) {
              const globalShelfIdx = calculateGlobalShelfIndex(
                subWarehouses,
                zone.id || '',
                rack.id || rack.rackCode || String(rIdx),
                s
              );
              const shelfPrefix = getRackLetterPrefix(globalShelfIdx);

              for (let c = 1; c <= baysCount; c++) {
                const binCodeShort = `${shelfPrefix}${c}`;
                const binLabel = `Ô ${binCodeShort}`;
                const binKeyFull = `${targetCode}-${zone.code || 'ZONE'}-${rackCode}-${binCodeShort}`;
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

                let goods: PrintableGoodsItem[] = [];

                if (liveGoodsList.length > 0) {
                  goods = liveGoodsList.map((g) => ({
                    sku: g.sku || 'SKU-001',
                    name: g.productName || 'Hàng hóa kho',
                    quantity: Math.abs(g.quantity || 1),
                    unit: g.unit || 'cái',
                    occupancyPct: g.occupancyPct !== undefined ? g.occupancyPct : 100,
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

                let totalPct = 0;
                if (goods.length > 0) {
                  const sumPct = goods.reduce(
                    (acc, g) => acc + (parseInt(String(g.occupancyPct), 10) || 0),
                    0
                  );
                  totalPct = Math.min(100, sumPct || 90);
                } else if (occInfo && (occInfo.totalPhysical || 0) > 0) {
                  totalPct = occInfo.occupancyPct !== undefined ? occInfo.occupancyPct : 100;
                  if (occInfo.productName) {
                    goods = [
                      {
                        sku: occInfo.sku || 'SKU-001',
                        name: occInfo.productName,
                        quantity: occInfo.totalPhysical || 1,
                        unit: occInfo.unit || 'cái',
                        occupancyPct: totalPct,
                      },
                    ];
                  }
                }

                allRows.push({
                  stt: counter++,
                  zoneName: zone.name || 'Phân khu',
                  rackCode,
                  shelfPrefix,
                  shelfNumber: s,
                  binCodeShort,
                  binLabel,
                  totalOccupancyPct: totalPct,
                  goodsList: goods,
                  statusText: totalPct > 0 ? `Đang chứa (${totalPct}%)` : 'Kệ trống (0%)',
                });
              }
            }
          });
        });

        if (isMounted) {
          setRows(allRows);
        }
      } catch (err) {
        console.error('Lỗi khi tải dữ liệu in báo cáo kệ hàng:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, warehouseCode, subWarehouses]);

  // List of available racks for filter dropdown
  const availableRacks = useMemo(() => {
    const set = new Set<string>();
    subWarehouses.forEach((z) => {
      (z.racks || []).forEach((r) => {
        if (r.rackCode) set.add(r.rackCode);
      });
    });
    return Array.from(set).sort();
  }, [subWarehouses]);

  // Filtered rows based on user options
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (selectedRackFilter !== 'ALL' && row.rackCode !== selectedRackFilter) {
        return false;
      }
      if (filterMode === 'OCCUPIED_ONLY' && row.totalOccupancyPct <= 0) {
        return false;
      }
      return true;
    });
  }, [rows, selectedRackFilter, filterMode]);

  // Summary Metrics
  const stats = useMemo(() => {
    const totalBins = filteredRows.length;
    const occupiedBins = filteredRows.filter((r) => r.totalOccupancyPct > 0).length;
    const totalQty = filteredRows.reduce((sum, r) => {
      const rowSum = r.goodsList.reduce((gSum, g) => gSum + (Number(g.quantity) || 0), 0);
      return sum + rowSum;
    }, 0);
    const uniqueSkus = new Set<string>();
    filteredRows.forEach((r) => {
      r.goodsList.forEach((g) => {
        if (g.sku) uniqueSkus.add(g.sku);
      });
    });

    return {
      totalBins,
      occupiedBins,
      emptyBins: totalBins - occupiedBins,
      totalQty,
      uniqueSkusCount: uniqueSkus.size,
    };
  }, [filteredRows]);

  if (!isOpen) return null;

  return createPortal(
    <div
      onClick={onClose}
      className="warehouse-goods-print-modal fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto print:static print:block print:inset-auto print:p-0 print:m-0 print:bg-white print:overflow-visible font-sans cursor-pointer"
    >
      {/* Container Dialog */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-6xl max-h-[96vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-300 print:block print:max-h-none print:h-auto print:shadow-none print:w-full print:rounded-none print:border-none print:m-0 print:p-0 cursor-default"
      >
        {/* Top Control Bar (Hidden on Print) */}
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-slate-800 print:hidden">
          {/* Row 1: Title on left, Action buttons (In Báo Cáo & X) on the FAR RIGHT */}
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-700 text-white font-bold text-sm shadow-xs">
                <Printer className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-tight text-slate-900 truncate">
                  Xem Trước & In Báo Cáo Hàng Hóa Kệ Kho
                </h2>
                <p className="text-xs text-slate-500 font-medium truncate">
                  Kho: <strong className="text-cyan-800">{warehouseName || 'Kho hàng'}</strong> ({warehouseCode || 'CHƯA ĐẶT'}) • Tự động căn chỉnh khổ giấy A4
                </p>
              </div>
            </div>

            {/* Right-aligned Action Buttons: In Báo Cáo & X */}
            <div className="flex items-center gap-2.5 shrink-0 ml-auto">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 px-4 py-2 text-xs font-extrabold text-white shadow-sm transition active:scale-95 cursor-pointer"
                title="Mở hộp thoại in trình duyệt (Ctrl+P)"
              >
                <Printer className="h-4 w-4" />
                <span>In Báo Cáo (Ctrl+P)</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
                title="Đóng cửa sổ (hoặc bấm ra ngoài)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Row 2: Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-200/80">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Filter by Rack */}
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Filter className="h-3.5 w-3.5 text-slate-500" />
                <span>Dãy kệ:</span>
                <select
                  value={selectedRackFilter}
                  onChange={(e) => setSelectedRackFilter(e.target.value)}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-800 shadow-xs focus:border-cyan-600 focus:outline-hidden"
                >
                  <option value="ALL">Tất cả dãy kệ ({availableRacks.length})</option>
                  {availableRacks.map((rk) => (
                    <option key={rk} value={rk}>
                      Dãy kệ {rk}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Mode: All vs Occupied Only */}
              <div className="flex items-center rounded-lg border border-slate-300 bg-white p-0.5 text-xs font-bold shadow-xs">
                <button
                  type="button"
                  onClick={() => setFilterMode('ALL_BINS')}
                  className={`rounded-md px-2.5 py-1 transition ${
                    filterMode === 'ALL_BINS'
                      ? 'bg-cyan-700 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Toàn bộ sơ đồ kệ
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('OCCUPIED_ONLY')}
                  className={`rounded-md px-2.5 py-1 transition ${
                    filterMode === 'OCCUPIED_ONLY'
                      ? 'bg-cyan-700 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Chỉ ô đang có hàng ({rows.filter((r) => r.totalOccupancyPct > 0).length})
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Hiển thị: <strong className="text-slate-800">{filteredRows.length}</strong> ô kệ ({stats.occupiedBins} ô có hàng, {stats.emptyBins} ô trống)
            </div>
          </div>
        </div>

        {/* Scrollable Printable Paper Container */}
        <div className="overflow-y-auto bg-slate-100 p-4 sm:p-6 print:p-0 print:m-0 print:bg-white custom-scrollbar">
          <style>{`
            @media print {
              @page {
                size: A4 landscape;
                margin: 8mm 8mm 8mm 8mm;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                height: auto !important;
                min-height: 0 !important;
                background: #fff !important;
              }
              #root,
              body > *:not(.warehouse-goods-print-modal) {
                display: none !important;
                visibility: hidden !important;
                height: 0 !important;
                max-height: 0 !important;
                overflow: hidden !important;
                opacity: 0 !important;
              }
              .warehouse-goods-print-modal {
                position: static !important;
                display: block !important;
                width: 100% !important;
                height: auto !important;
                min-height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #fff !important;
                overflow: visible !important;
                inset: auto !important;
                visibility: visible !important;
                opacity: 1 !important;
              }
              .warehouse-goods-print-modal > div {
                display: block !important;
                max-height: none !important;
                height: auto !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                box-shadow: none !important;
                border-radius: 0 !important;
              }
              .warehouse-goods-print-modal .overflow-y-auto {
                overflow: visible !important;
                padding: 0 !important;
                margin: 0 !important;
                background: transparent !important;
              }
              .printable-sheet {
                box-shadow: none !important;
                border: none !important;
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
                max-width: none !important;
              }
              table {
                page-break-inside: auto;
              }
              tr {
                page-break-inside: avoid;
                page-break-after: auto;
              }
              thead {
                display: table-header-group;
              }
              tfoot {
                display: table-footer-group;
              }
              .print-signatures {
                page-break-inside: avoid;
              }
            }
          `}</style>

          {/* Printable White Sheet */}
          <div className="printable-sheet mx-auto max-w-5xl bg-white p-6 sm:p-8 shadow-md border border-slate-200 text-slate-900 print:border-none print:shadow-none print:p-0">
            {/* Header Document */}
            <div className="border-b-2 border-black pb-3 text-xs">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-black uppercase text-black text-sm tracking-wide">
                    CÔNG TY TNHH HỆ THỐNG QUẢN LÝ KHO SMART WMS
                  </p>
                  <p className="text-[11px] text-slate-700">
                    Hệ thống Quản lý kho hàng & Sơ đồ vị trí kệ chuyên nghiệp
                  </p>
                  {warehouseAddress && (
                    <p className="text-[11px] text-slate-700">Địa chỉ kho: {warehouseAddress}</p>
                  )}
                </div>
                <div className="text-right text-[11px] text-slate-700">
                  <p className="font-bold text-black">Mẫu số: BC-KK01/WMS</p>
                  <p>
                    Ngày in: {new Date().toLocaleDateString('vi-VN')}{' '}
                    {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p>
                    Mã kho:{' '}
                    <strong className="text-black font-black">
                      {warehouseCode ? warehouseCode.toUpperCase() : 'CHƯA ĐẶT'}
                    </strong>
                  </p>
                </div>
              </div>

              <div className="text-center my-3">
                <h1 className="text-lg sm:text-xl font-black uppercase tracking-wider text-black">
                  BÁO CÁO TRA CỨU SƠ ĐỒ VỊ TRÍ HÀNG HÓA KHO
                </h1>
                <p className="text-xs text-slate-700 italic mt-0.5">
                  Kho hàng: <strong className="text-black">{warehouseName || 'Kho hàng'}</strong>{' '}
                  ({warehouseCode || 'CHƯA ĐẶT'})
                  {selectedRackFilter !== 'ALL' && ` — Dãy kệ: ${selectedRackFilter}`}
                </p>
              </div>

              <div className="flex justify-between text-xs font-semibold pt-1 border-t border-black">
                <span>
                  Người lập báo cáo: <strong className="text-black font-black">{creatorName}</strong>
                </span>
                <span>
                  Tổng số vị trí kiểm kê:{' '}
                  <strong className="text-black font-black">{stats.totalBins} ô kệ</strong> (
                  {stats.occupiedBins} ô có hàng, {stats.emptyBins} ô trống)
                </span>
              </div>
            </div>

            {/* Loading Indicator */}
            {loading ? (
              <div className="py-16 text-center text-slate-500 font-bold text-sm">
                Đang nạp dữ liệu chi tiết hàng hóa các kệ kho...
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="py-16 text-center text-slate-400 font-bold text-sm">
                Không tìm thấy vị trí ô kệ nào khớp với điều kiện lọc hiện tại.
              </div>
            ) : (
              <div className="mt-4">
                {/* Printable Table */}
                <table className="w-full border-collapse border border-black text-xs text-left">
                  <thead>
                    <tr className="bg-slate-100 font-black text-black border-b border-black text-center">
                      <th className="border border-black px-2 py-2 w-10">STT</th>
                      <th className="border border-black px-2 py-2 w-16">Dãy kệ</th>
                      <th className="border border-black px-2 py-2 w-14">Tầng</th>
                      <th className="border border-black px-2 py-2 w-20">Vị trí ô</th>
                      <th className="border border-black px-2 py-2 w-16">% Chứa ô</th>
                      <th className="border border-black px-2 py-2 w-24">Mã SKU</th>
                      <th className="border border-black px-3 py-2 text-left">Tên hàng hóa / sản phẩm</th>
                      <th className="border border-black px-2 py-2 w-16">Đơn vị</th>
                      <th className="border border-black px-2 py-2 w-20 text-right">Số lượng</th>
                      <th className="border border-black px-2 py-2 w-16">% Chứa</th>
                      <th className="border border-black px-2 py-2 w-24">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, idx) => {
                      const goodsCount = row.goodsList.length;

                      if (goodsCount === 0) {
                        return (
                          <tr
                            key={`row-${row.rackCode}-${row.binCodeShort}-${idx}`}
                            className="border-b border-black hover:bg-slate-50 transition"
                          >
                            <td className="border border-black px-2 py-1.5 text-center font-normal">
                              {idx + 1}
                            </td>
                            <td className="border border-black px-2 py-1.5 text-center font-bold">
                              {row.rackCode}
                            </td>
                            <td className="border border-black px-2 py-1.5 text-center font-medium">
                              Tầng {row.shelfPrefix}
                            </td>
                            <td className="border border-black px-2 py-1.5 text-center font-black font-mono">
                              {row.binLabel}
                            </td>
                            <td className="border border-black px-2 py-1.5 text-center font-bold text-slate-500">
                              0%
                            </td>
                            <td className="border border-black px-2 py-1.5 text-center font-mono text-slate-400">
                              —
                            </td>
                            <td className="border border-black px-3 py-1.5 text-slate-400 italic">
                              (Kệ trống - Chưa xếp hàng)
                            </td>
                            <td className="border border-black px-2 py-1.5 text-center text-slate-400">
                              —
                            </td>
                            <td className="border border-black px-2 py-1.5 text-right text-slate-400 font-mono">
                              0
                            </td>
                            <td className="border border-black px-2 py-1.5 text-center text-slate-400">
                              0%
                            </td>
                            <td className="border border-black px-2 py-1.5 text-center text-slate-500">
                              Kệ trống
                            </td>
                          </tr>
                        );
                      }

                      return row.goodsList.map((goods, gIdx) => (
                        <tr
                          key={`row-${row.rackCode}-${row.binCodeShort}-${idx}-${gIdx}`}
                          className="border-b border-black hover:bg-slate-50 transition"
                        >
                          {gIdx === 0 && (
                            <>
                              <td
                                rowSpan={goodsCount}
                                className="border border-black px-2 py-1.5 text-center font-normal align-middle"
                              >
                                {idx + 1}
                              </td>
                              <td
                                rowSpan={goodsCount}
                                className="border border-black px-2 py-1.5 text-center font-bold align-middle"
                              >
                                {row.rackCode}
                              </td>
                              <td
                                rowSpan={goodsCount}
                                className="border border-black px-2 py-1.5 text-center font-medium align-middle"
                              >
                                Tầng {row.shelfPrefix}
                              </td>
                              <td
                                rowSpan={goodsCount}
                                className="border border-black px-2 py-1.5 text-center font-black font-mono align-middle"
                              >
                                {row.binLabel}
                              </td>
                              <td
                                rowSpan={goodsCount}
                                className="border border-black px-2 py-1.5 text-center font-bold align-middle"
                              >
                                {row.totalOccupancyPct}%
                              </td>
                            </>
                          )}
                          <td className="border border-black px-2 py-1.5 font-mono font-bold text-center">
                            {goods.sku}
                          </td>
                          <td className="border border-black px-3 py-1.5 font-semibold text-black">
                            {goods.name}
                          </td>
                          <td className="border border-black px-2 py-1.5 text-center">
                            {goods.unit || 'cái'}
                          </td>
                          <td className="border border-black px-2 py-1.5 text-right font-black font-mono text-black">
                            {goods.quantity}
                          </td>
                          <td className="border border-black px-2 py-1.5 text-center font-bold">
                            {goods.occupancyPct !== undefined ? `${goods.occupancyPct}%` : '—'}
                          </td>
                          {gIdx === 0 && (
                            <td
                              rowSpan={goodsCount}
                              className="border border-black px-2 py-1.5 text-center font-medium align-middle"
                            >
                              Đang lưu kho
                            </td>
                          )}
                        </tr>
                      ));
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold border-t-2 border-black text-xs text-black">
                      <td colSpan={5} className="border border-black px-3 py-2 text-right uppercase">
                        TỔNG CỘNG ({filteredRows.length} VỊ TRÍ Ô KỆ):
                      </td>
                      <td colSpan={2} className="border border-black px-3 py-2 text-left font-bold">
                        {stats.occupiedBins} ô có hàng ({stats.uniqueSkusCount} mặt hàng SKU)
                      </td>
                      <td className="border border-black px-2 py-2 text-center">Tổng SL:</td>
                      <td className="border border-black px-2 py-2 text-right font-black font-mono text-sm">
                        {stats.totalQty.toLocaleString('vi-VN')}
                      </td>
                      <td colSpan={2} className="border border-black px-2 py-2 text-center text-[11px] font-normal text-slate-600">
                        {stats.emptyBins} ô còn trống
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Signatures section (4 standard signatures) */}
                <div className="print-signatures grid grid-cols-4 gap-4 mt-8 pt-4 text-center text-xs text-black border-t border-black">
                  <div>
                    <p className="font-extrabold uppercase text-black">Người Lập Báo Cáo</p>
                    <p className="text-[11px] text-slate-600 italic mt-0.5">(Ký, họ tên)</p>
                    <div className="h-16" />
                    <p className="font-bold text-black">{creatorName}</p>
                  </div>
                  <div>
                    <p className="font-extrabold uppercase text-black">Nhân Viên Quản Lý Kho</p>
                    <p className="text-[11px] text-slate-600 italic mt-0.5">(Ký, họ tên)</p>
                    <div className="h-16" />
                    <p className="text-slate-400 italic">................................</p>
                  </div>
                  <div>
                    <p className="font-extrabold uppercase text-black">Kế Toán Kho</p>
                    <p className="text-[11px] text-slate-600 italic mt-0.5">(Ký, họ tên)</p>
                    <div className="h-16" />
                    <p className="text-slate-400 italic">................................</p>
                  </div>
                  <div>
                    <p className="font-extrabold uppercase text-black">Thủ Trưởng Đơn Vị</p>
                    <p className="text-[11px] text-slate-600 italic mt-0.5">(Ký, đóng dấu, họ tên)</p>
                    <div className="h-16" />
                    <p className="text-slate-400 italic">................................</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default WarehouseGoodsPrintModal;
