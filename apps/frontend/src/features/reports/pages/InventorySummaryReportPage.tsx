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

const FALLBACK_ITEMS: InventorySummaryItem[] = [
  {
    stt: 1,
    productId: '1',
    code: '110M',
    name: 'Attomat BH - D6 6kA 1 cực 10A Mitsubishi',
    unit: 'Cái',
    warehouseStocks: { '4445': -1, 'cau_giay': -2, 'cn2026': 0, 'thanh_xuan': 0, 'cn2': 0, 'ric_hn': 0 },
    totalStock: -3,
  },
  {
    stt: 2,
    productId: '2',
    code: '111',
    name: '2 123',
    unit: '123',
    warehouseStocks: { '4445': -31, 'cau_giay': -92, 'cn2026': 0, 'thanh_xuan': 0, 'cn2': -9, 'ric_hn': 0 },
    totalStock: -132,
  },
  {
    stt: 3,
    productId: '3',
    code: '112',
    name: '2 Bao',
    unit: 'Bao',
    warehouseStocks: { '4445': -117, 'cau_giay': -15, 'cn2026': 0, 'thanh_xuan': 0, 'cn2': 0, 'ric_hn': 0 },
    totalStock: -132,
  },
  {
    stt: 4,
    productId: '4',
    code: '16L',
    name: 'Attomat 1 cực 6A LS HQ',
    unit: 'Cái',
    warehouseStocks: { '4445': -5, 'cau_giay': -3, 'cn2026': 0, 'thanh_xuan': 0, 'cn2': 0, 'ric_hn': 0 },
    totalStock: -8,
  },
  {
    stt: 5,
    productId: '5',
    code: '232S',
    name: 'At A9K27232/ 2 cực 32A Schneider',
    unit: 'Cái',
    warehouseStocks: { '4445': -1, 'cau_giay': -3, 'cn2026': 0, 'thanh_xuan': 0, 'cn2': 0, 'ric_hn': 0 },
    totalStock: -4,
  },
  {
    stt: 6,
    productId: '6',
    code: '252122F320',
    name: 'Dây tổng (6pk2411)',
    unit: 'Sợi',
    warehouseStocks: { '4445': 0, 'cau_giay': -3, 'cn2026': 0, 'thanh_xuan': 0, 'cn2': 0, 'ric_hn': 0 },
    totalStock: -3,
  },
  {
    stt: 7,
    productId: '7',
    code: '8934760210336',
    name: 'Bánh tipo',
    unit: '123',
    warehouseStocks: { '4445': 4, 'cau_giay': 4, 'cn2026': 0, 'thanh_xuan': 0, 'cn2': 0, 'ric_hn': 0 },
    totalStock: 8,
  },
  {
    stt: 8,
    productId: '8',
    code: 'A1',
    name: 'Thang nhôm 1.5m',
    unit: 'Chiếc',
    warehouseStocks: { '4445': -2, 'cau_giay': 0, 'cn2026': 0, 'thanh_xuan': 10, 'cn2': 0, 'ric_hn': 0 },
    totalStock: 8,
  },
  {
    stt: 9,
    productId: '9',
    code: 'A11019',
    name: 'Attomat 1 cực 10A Sino',
    unit: 'Cái',
    warehouseStocks: { '4445': 0, 'cau_giay': -1, 'cn2026': 0, 'thanh_xuan': 0, 'cn2': 0, 'ric_hn': 0 },
    totalStock: -1,
  },
  {
    stt: 10,
    productId: '10',
    code: 'A110S',
    name: 'Attomat 1 cực 10A Schneider',
    unit: 'Cái',
    warehouseStocks: { '4445': -1, 'cau_giay': -102, 'cn2026': 0, 'thanh_xuan': 0, 'cn2': 0, 'ric_hn': 0 },
    totalStock: -103,
  },
  {
    stt: 11,
    productId: '11',
    code: 'A11618',
    name: 'Attomat 1 cực 16A Vanlock',
    unit: 'Cái',
    warehouseStocks: { '4445': 0, 'cau_giay': -1, 'cn2026': 0, 'thanh_xuan': 0, 'cn2': 0, 'ric_hn': 0 },
    totalStock: -1,
  },
  {
    stt: 12,
    productId: '12',
    code: 'A11619',
    name: 'Attomat 1 cực 16A Sino',
    unit: 'Cái',
    warehouseStocks: { '4445': 0, 'cau_giay': -1, 'cn2026': 0, 'thanh_xuan': 0, 'cn2': 0, 'ric_hn': 0 },
    totalStock: -1,
  },
  {
    stt: 13,
    productId: '13',
    code: 'A116P',
    name: 'Attomat 1 cực 16A Panasonic',
    unit: 'Cái',
    warehouseStocks: { '4445': -1, 'cau_giay': -1, 'cn2026': 0, 'thanh_xuan': 0, 'cn2': 0, 'ric_hn': 0 },
    totalStock: -2,
  },
  {
    stt: 14,
    productId: '14',
    code: 'A132S',
    name: 'At A9K27132/1 cực 32A Schneider',
    unit: 'Cái',
    warehouseStocks: { '4445': -2, 'cau_giay': -1, 'cn2026': 0, 'thanh_xuan': 0, 'cn2': 0, 'ric_hn': 0 },
    totalStock: -3,
  },
  {
    stt: 15,
    productId: '15',
    code: 'A140H',
    name: 'Attomat 1 cực 40A Hager',
    unit: 'Cái',
    warehouseStocks: { '4445': 0, 'cau_giay': -6, 'cn2026': 0, 'thanh_xuan': 0, 'cn2': 0, 'ric_hn': 0 },
    totalStock: -6,
  },
];

const DEFAULT_WAREHOUSES = [
  { code: '4445', name: '4445' },
  { code: 'cau_giay', name: 'Cầu Giấy' },
  { code: 'cn2026', name: 'cn2026' },
  { code: 'thanh_xuan', name: 'Thanh Xuân' },
  { code: 'cn2', name: 'Chi nhánh 2' },
  { code: 'ric_hn', name: 'RIC-HÀ NỘI' },
];

export default function InventorySummaryReportPage() {
  const [warehouses, setWarehouses] = useState<{ code: string; name: string }[]>(DEFAULT_WAREHOUSES);
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
      let whList = DEFAULT_WAREHOUSES;
      try {
        const whRes = await fetch(`${API_BASE_URL}/warehouses`, { headers: authHeaders() });
        if (whRes.ok) {
          const whData = await whRes.json();
          if (Array.isArray(whData) && whData.length > 0) {
            whList = whData.map((w: any) => ({
              code: String(w.code || w.id),
              name: String(w.name || w.warehouseName || w.code),
            }));
          }
        }
      } catch {}
      setWarehouses(whList);

      // 2. Fetch Products and Stock Balances
      let productsList: any[] = [];
      try {
        const pRes = await fetch(`${API_BASE_URL}/products`, { headers: authHeaders() });
        if (pRes.ok) {
          const pData = await pRes.json();
          if (Array.isArray(pData)) productsList = pData;
        }
      } catch {}

      let stockMap: Record<string, number> = {};
      try {
        const sRes = await fetch(`${API_BASE_URL}/reports/stock`, { headers: authHeaders() });
        if (sRes.ok) {
          const sData = await sRes.json();
          if (Array.isArray(sData)) {
            sData.forEach((s: any) => {
              const whKey = s.locationCode || s.warehouseId || s.branchCode;
              const pKey = s.sku || s.productCode || s.productId;
              if (whKey && pKey) {
                stockMap[`${whKey}_${pKey}`] = Number(s.available !== undefined ? s.available : (s.totalPhysical || 0));
              }
            });
          }
        }
      } catch {}

      if (productsList.length > 0) {
        const loadedItems: InventorySummaryItem[] = productsList.map((p, idx) => {
          const pCode = String(p.internalSku || p.sku || p.code || p.id);
          const pName = String(p.name || '');
          const unit = String(p.unit || p.unitName || 'Cái');

          const whStocks: Record<string, number> = {};
          let sum = 0;

          whList.forEach((wh) => {
            const key1 = `${wh.code}_${pCode}`;
            const key2 = `${wh.code}_${p.id}`;
            let val = 0;

            if (stockMap[key1] !== undefined) {
              val = stockMap[key1];
            } else if (stockMap[key2] !== undefined) {
              val = stockMap[key2];
            } else if (p.stockBalances && Array.isArray(p.stockBalances)) {
              const match = p.stockBalances.find((sb: any) => sb.locationCode === wh.code || sb.warehouseId === wh.code);
              if (match) val = Number(match.totalPhysical !== undefined ? match.totalPhysical : (match.available || 0));
            } else {
              val = Number(p.stock || 0);
            }

            whStocks[wh.code] = val;
            sum += val;
          });

          return {
            stt: idx + 1,
            productId: String(p.id || pCode),
            code: pCode,
            name: pName,
            unit,
            warehouseStocks: whStocks,
            totalStock: sum,
          };
        });

        setItems(loadedItems);
      } else {
        setItems(FALLBACK_ITEMS);
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi tải dữ liệu báo cáo hàng tồn tổng hợp');
      setItems(FALLBACK_ITEMS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
                <td colSpan={4} className="py-3 px-4 border-r border-slate-200 uppercase tracking-wide text-right">
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
                    <td className="py-3 px-3 text-center border-r border-slate-200 font-semibold text-slate-600">
                      {idx + 1}
                    </td>

                    {/* Mã Hàng */}
                    <td className="py-3 px-4 text-center border-r border-slate-200 font-extrabold text-slate-900">
                      {row.code}
                    </td>

                    {/* Tên Hàng */}
                    <td className="py-3 px-4 text-left border-r border-slate-200 font-extrabold text-slate-900">
                      {row.name}
                    </td>

                    {/* ĐVT */}
                    <td className="py-3 px-3 text-center border-r border-slate-200 font-bold text-slate-700">
                      {row.unit}
                    </td>

                    {/* Warehouse Stock Columns */}
                    {warehouses.map((wh) => {
                      const stockVal = row.warehouseStocks[wh.code] ?? 0;
                      return (
                        <td
                          key={wh.code}
                          className={`py-3 px-3 text-center border-r border-slate-200 font-bold ${
                            stockVal < 0 ? 'text-rose-600 font-black' : stockVal > 0 ? 'text-slate-900' : 'text-slate-400'
                          }`}
                        >
                          {stockVal}
                        </td>
                      );
                    })}

                    {/* Tổng Stock Column */}
                    <td
                      className={`py-3 px-3 text-center font-black bg-slate-50/80 ${
                        row.totalStock < 0 ? 'text-rose-600 font-black' : 'text-slate-950'
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
