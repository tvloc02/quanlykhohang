import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Printer,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Calendar,
  Maximize2,
  Minimize2,
  Building2,
  Layers,
  Filter,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { getStoredWarehouses, mergeStoredWarehouses } from '../../../shared/utils/warehouseAssignments';

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  const token = localStorage.getItem('token');
  return {
    Authorization: token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json',
  };
}

export interface InventorySummaryItem {
  stt: number;
  productId: string;
  code: string;
  name: string;
  unit: string;
  warehouseStocks: Record<string, number>; // whCode -> stock quantity
  totalStock: number;
}

export function normalizeWhCanonicalKey(rawLoc: string): string {
  const s = String(rawLoc || '').trim().toUpperCase();
  if (!s) return 'UNKNOWN';

  if (s === 'KH001' || s.includes('TỔNG (HÀ NỘI)') || s.includes('TONG (HA NOI)') || s === 'WH_DEFAULT_1') return 'KH001';
  if (s === 'KH002' || s.includes('CHI NHÁNH HCM') || s.includes('CHI NHANH HCM') || s === 'WH_DEFAULT_2') return 'KH002';
  if (s === 'KHO-TONG' || s.includes('SPX EXPRESS') || s === 'WH_DEFAULT_3') return 'KHO-TONG';
  if (s === 'KHO-HN' || s.includes('TRUNG TÂM HÀ NỘI') || s.includes('TRUNG TAM HA NOI') || s === 'WH_DEFAULT_4') return 'KHO-HN';
  if (s === 'KHO-BD' || s.includes('NGUYÊN VẬT LIỆU') || s.includes('NGUYEN VAT LIEU') || s === 'WH_DEFAULT_5') return 'KHO-BD';
  if (s === 'KHO-CUCHI' || s.includes('LẠNH CỦ CHI') || s.includes('LANH CU CHI') || s === 'WH_DEFAULT_6') return 'KHO-CUCHI';

  const match = s.match(/(KH\d+|KHO-[A-Z0-9]+)/);
  if (match) return match[1];

  return s;
}

export function calculateWarehouseProductStock(productBalances: any[], whCode: string): number {
  if (!productBalances || !Array.isArray(productBalances) || productBalances.length === 0) return 0;
  const targetWh = normalizeWhCanonicalKey(whCode);

  const matched = productBalances.filter((b) => normalizeWhCanonicalKey(b.locationCode) === targetWh);
  if (matched.length === 0) return 0;

  const mainBalances = matched.filter((b) => {
    const loc = String(b.locationCode || '').trim().toUpperCase();
    return (
      loc === targetWh ||
      !loc.includes('-') ||
      loc === 'KH001' ||
      loc === 'KH002' ||
      loc === 'KHO-TONG' ||
      loc === 'KHO-HN' ||
      loc === 'KHO-BD' ||
      loc === 'KHO-CUCHI'
    );
  });

  const binBalances = matched.filter((b) => {
    const loc = String(b.locationCode || '').trim().toUpperCase();
    return (
      loc !== targetWh &&
      (loc.includes('-ZONE-') || loc.includes('-R0') || loc.includes('-S0') || loc.includes('-C') || loc.startsWith('ZONE-'))
    );
  });

  let mainSum = 0;
  mainBalances.forEach((b) => {
    const q = b.totalPhysical !== undefined ? Number(b.totalPhysical) : Number(b.available || 0);
    mainSum = Math.max(mainSum, q);
  });

  const binSum = binBalances.reduce((sum, b) => {
    return sum + (b.totalPhysical !== undefined ? Number(b.totalPhysical) : Number(b.available || 0));
  }, 0);

  return mainSum > 0 && binSum > 0 ? Math.max(mainSum, binSum) : mainSum + binSum;
}

export default function InventorySummaryReportPage() {
  const [warehouses, setWarehouses] = useState<{ code: string; name: string }[]>([]);
  const [items, setItems] = useState<InventorySummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Fullscreen state
  const [isFullScreen, setIsFullScreen] = useState(false);

  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullScreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullScreen(false);
    }
  };

  useEffect(() => {
    const handleFSChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch Warehouses
      let mergedWhs: { code: string; name: string }[] = [];
      try {
        const whRes = await fetch(`${API_BASE_URL}/warehouses`, { headers: authHeaders() });
        const dbWhData = whRes.ok ? await whRes.json() : [];
        const fullList = mergeStoredWarehouses(Array.isArray(dbWhData) ? dbWhData : [], getStoredWarehouses());
        mergedWhs = fullList
          .filter((w) => w.status !== 'inactive')
          .map((w) => ({
            code: String(w.code || w.id).trim(),
            name: String(w.name || w.code).trim(),
          }));
      } catch {
        mergedWhs = getStoredWarehouses().map((w) => ({ code: w.code, name: w.name }));
      }
      setWarehouses(mergedWhs);

      // 2. Fetch Products with detailed stock balances
      const pRes = await fetch(`${API_BASE_URL}/products`, { headers: authHeaders() });
      if (!pRes.ok) throw new Error('Không thể tải danh sách sản phẩm từ máy chủ');
      const productsList: any[] = await pRes.json();

      if (Array.isArray(productsList) && productsList.length > 0) {
        const loadedItems: InventorySummaryItem[] = productsList.map((p, idx) => {
          const pCode = String(p.internalSku || p.sku || p.code || p.id);
          const pName = String(p.name || '');
          const unit = String(p.unit || p.unitName || 'Cái');

          const whStocks: Record<string, number> = {};
          let sum = 0;

          mergedWhs.forEach((wh) => {
            const qty = calculateWarehouseProductStock(p.stockBalances, wh.code);
            whStocks[wh.code] = qty;
            sum += qty;
          });

          const totalStock = sum > 0 ? sum : Number(p.totalStock ?? 0);

          return {
            stt: idx + 1,
            productId: String(p.id || pCode),
            code: pCode,
            name: pName,
            unit,
            warehouseStocks: whStocks,
            totalStock,
          };
        });

        setItems(loadedItems);
      } else {
        setItems([]);
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi tải dữ liệu báo cáo hàng tồn tổng hợp');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [endDate]);

  const filteredItems = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (it) => it.code.toLowerCase().includes(term) || it.name.toLowerCase().includes(term) || it.unit.toLowerCase().includes(term)
    );
  }, [items, searchQuery]);

  // Compute Grand Totals across columns
  const warehouseTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    warehouses.forEach((wh) => {
      totals[wh.code] = filteredItems.reduce((acc, curr) => acc + (curr.warehouseStocks[wh.code] || 0), 0);
    });
    return totals;
  }, [warehouses, filteredItems]);

  const grandTotalAll = useMemo(() => {
    return filteredItems.reduce((acc, curr) => acc + (curr.totalStock || 0), 0);
  }, [filteredItems]);

  const handleExportExcel = () => {
    if (filteredItems.length === 0) return;

    const headers = ['TT', 'Mã hàng', 'Tên hàng hóa', 'Đơn vị', ...warehouses.map((w) => w.name), 'Tổng tồn'];

    const rows = filteredItems.map((item, idx) => [
      idx + 1,
      `"${item.code.replace(/"/g, '""')}"`,
      `"${item.name.replace(/"/g, '""')}"`,
      item.unit,
      ...warehouses.map((w) => item.warehouseStocks[w.code] || 0),
      item.totalStock,
    ]);

    const totalRow = ['TỔNG CỘNG', '', '', '', ...warehouses.map((w) => warehouseTotals[w.code] || 0), grandTotalAll];

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(',')), totalRow.join(',')].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Hang_Ton_Tong_Hop_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`space-y-4 pb-12 animate-in fade-in duration-200 ${isFullScreen ? 'fixed inset-0 z-[9000] bg-white overflow-y-auto p-6' : ''}`}>
      {/* ═══ TOP HEADER SECTION ═══ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left Title Badge */}
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2.5 rounded-2xl bg-cyan-600 px-5 py-2.5 text-white shadow-md">
            <Package className="h-5 w-5" />
            <h1 className="text-xl font-extrabold tracking-tight uppercase">HÀNG TỒN TỔNG HỢP</h1>
          </div>
        </div>

        {/* Right Action Buttons matching Gold Cyan Standard */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-4.5 w-4.5 text-cyan-700 ${loading ? 'animate-spin' : ''}`} />
            <span>Xem báo cáo</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
          >
            <Printer className="h-4.5 w-4.5 text-cyan-700" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
          >
            <FileSpreadsheet className="h-4.5 w-4.5 text-cyan-700" />
            <span>Excel</span>
          </button>

          <button
            type="button"
            onClick={toggleBrowserFullscreen}
            className="inline-flex items-center justify-center h-10 w-10 rounded-xl border-2 border-cyan-700 bg-white text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            title="Toàn màn hình"
          >
            {isFullScreen ? <Minimize2 className="h-4.5 w-4.5 text-cyan-700" /> : <Maximize2 className="h-4.5 w-4.5 text-cyan-700" />}
          </button>
        </div>
      </div>

      {/* ═══ FILTER & CONTROL TOOLBAR ═══ */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Live Search input */}
          <div className="relative flex-1 min-w-[300px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-4 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-2xs"
              placeholder="Gõ mã/tên hàng để tìm..."
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Date Filter Box */}
            <div className="inline-flex h-12 items-center gap-3 rounded-xl border border-slate-300 bg-slate-50 px-3.5 shadow-2xs">
              <div className="flex items-center gap-2">
                <Calendar className="h-4.5 w-4.5 text-slate-600 shrink-0" />
                <span className="text-xs font-extrabold uppercase text-slate-800 tracking-wide">Đến ngày:</span>
              </div>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
              />
            </div>

            {/* Record Count Badge */}
            <div className="inline-flex h-12 items-center rounded-xl border-2 border-cyan-600/30 bg-cyan-50 px-4 text-xs font-extrabold text-cyan-900 shadow-2xs">
              <span>Tìm thấy: <strong className="text-cyan-700 text-sm">{filteredItems.length}</strong> bản ghi.</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4 text-xs font-extrabold text-rose-700">
          {error}
        </div>
      )}

      {/* ═══ DYNAMIC MATRIX PIVOT DATA TABLE ═══ */}
      <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[1000px] border-collapse text-left">
            <thead className="bg-cyan-600 text-white sticky top-0 z-20 shadow-sm">
              <tr className="border-b-2 border-cyan-700 text-white font-extrabold uppercase text-xs sm:text-sm tracking-wider">
                <th className="w-14 min-w-[60px] border-r border-cyan-500/50 px-3 py-3.5 text-center">TT</th>
                <th className="min-w-[130px] border-r border-cyan-500/50 px-4 py-3.5 text-center">Mã hàng hóa</th>
                <th className="min-w-[280px] border-r border-cyan-500/50 px-4 py-3.5 text-left">Tên hàng hóa</th>
                <th className="min-w-[110px] border-r border-cyan-500/50 px-3 py-3.5 text-center">Đơn vị tính</th>

                {/* Dynamic Warehouse Columns */}
                {warehouses.map((wh) => (
                  <th key={wh.code} className="min-w-[110px] border-r border-cyan-500/50 px-3 py-3.5 text-center">
                    {wh.name}
                  </th>
                ))}

                <th className="min-w-[110px] px-3 py-3.5 text-center font-black text-white bg-cyan-700">
                  Tổng
                </th>
              </tr>

              {/* Header Summary Row */}
              <tr className="bg-slate-100 border-b-2 border-slate-300 font-black text-slate-900 text-xs sm:text-sm">
                <td colSpan={4} className="py-3 px-4 border-r border-slate-200 uppercase tracking-wide text-left">
                  TỔNG TỒN TOÀN HỆ THỐNG ({filteredItems.length} MỤC):
                </td>
                {warehouses.map((wh) => {
                  const val = warehouseTotals[wh.code] || 0;
                  return (
                    <td key={wh.code} className={`py-3 px-3 text-center border-r border-slate-200 ${val < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                      {val}
                    </td>
                  );
                })}
                <td className={`py-3 px-3 text-center font-black bg-slate-200 ${grandTotalAll < 0 ? 'text-rose-600' : 'text-slate-950'}`}>
                  {grandTotalAll}
                </td>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5 + warehouses.length} className="py-12 text-center text-slate-400 font-bold">
                    <RefreshCw size={20} className="animate-spin inline-block mr-2 text-slate-600" />
                    Đang tải dữ liệu hàng tồn tổng hợp...
                  </td>
                </tr>
              ) : filteredItems.length > 0 ? (
                filteredItems.map((row, idx) => (
                  <tr key={row.productId || idx} className="hover:bg-cyan-50/50 transition group">
                    {/* STT */}
                    <td className="py-3 px-3 text-center border-r border-slate-200 font-normal text-slate-600">
                      {idx + 1}
                    </td>

                    {/* Mã Hàng */}
                    <td className="py-3 px-4 text-center border-r border-slate-200 font-mono font-normal text-slate-800">
                      {row.code}
                    </td>

                    {/* Tên Hàng */}
                    <td className="py-3 px-4 text-left border-r border-slate-200 font-normal text-slate-800">
                      {row.name}
                    </td>

                    {/* ĐVT */}
                    <td className="py-3 px-3 text-center border-r border-slate-200 font-normal text-slate-700">
                      {row.unit}
                    </td>

                    {/* Warehouse Stock Columns */}
                    {warehouses.map((wh) => {
                      const stockVal = row.warehouseStocks[wh.code] ?? 0;
                      return (
                        <td
                          key={wh.code}
                          className={`py-3 px-3 text-center border-r border-slate-200 font-normal ${
                            stockVal < 0 ? 'text-rose-600 font-semibold' : stockVal > 0 ? 'text-slate-800' : 'text-slate-400'
                          }`}
                        >
                          {stockVal}
                        </td>
                      );
                    })}

                    {/* Tổng Stock Column */}
                    <td
                      className={`py-3 px-3 text-center font-normal bg-slate-50/80 ${
                        row.totalStock < 0 ? 'text-rose-600 font-semibold' : 'text-slate-800'
                      }`}
                    >
                      {row.totalStock}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5 + warehouses.length} className="py-12 text-center text-slate-400 font-bold">
                    Không tìm thấy dữ liệu hàng tồn phù hợp
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
