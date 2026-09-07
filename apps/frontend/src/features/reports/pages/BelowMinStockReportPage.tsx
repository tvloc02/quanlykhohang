import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  TrendingDown,
  Printer,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Settings,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  Building2,
  Eye,
  X,
  AlertTriangle,
  ChevronDown,
  Check,
} from 'lucide-react';

const fmt = (v: number) => {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(v || 0);
};

const getCategoryName = (cat: any): string => {
  if (!cat) return 'Mặc định';
  if (typeof cat === 'string') return cat;
  if (typeof cat === 'object') {
    return cat.name || cat.categoryName || cat.title || cat.code || 'Mặc định';
  }
  return String(cat);
};

interface BelowMinStockItem {
  stt: number;
  productId: string;
  category: string;
  code: string;
  name: string;
  importPrice: number;
  minStock: number;
  actualStock: number;
  diff: number; // actualStock - minStock
}

interface BranchStockGroup {
  branchId: string;
  branchName: string;
  items: BelowMinStockItem[];
  totalActualStock: number;
  totalDiff: number;
}

interface TransactionDetail {
  stt: number;
  code: string;
  date: string;
  targetName: string;
  inQty: number;
  outQty: number;
  price: number;
  totalAmount: number;
  balance: number;
  note: string;
}

const API_BASE_URL = '/api';

function authHeaders() {
  const token = localStorage.getItem('token');
  return {
    Authorization: token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json',
  };
}

export default function BelowMinStockReportPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  const [filterBelowOnly, setFilterBelowOnly] = useState<boolean>(false);

  // Custom Warehouse Dropdown State
  const [isWarehouseDropdownOpen, setIsWarehouseDropdownOpen] = useState(false);
  const warehouseDropdownRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [warehouses, setWarehouses] = useState<{ id: string; name: string; code: string }[]>([]);
  const [branchGroups, setBranchGroups] = useState<BranchStockGroup[]>([]);

  // Close custom warehouse dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (warehouseDropdownRef.current && !warehouseDropdownRef.current.contains(event.target as Node)) {
        setIsWarehouseDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fullscreen state
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Column settings modal
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [columnVis, setColumnVis] = useState({
    stt: true,
    category: true,
    code: true,
    name: true,
    importPrice: true,
    minStock: true,
    actualStock: true,
    diff: true,
    actions: true,
  });

  // Product detail popup modal state
  const [selectedItemForModal, setSelectedItemForModal] = useState<{
    item: BelowMinStockItem;
    branchName: string;
    details: TransactionDetail[];
    loadingDetails: boolean;
  } | null>(null);

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
      // 1. Fetch Warehouses from Real API
      let whList: { id: string; name: string; code: string }[] = [];
      try {
        const whRes = await fetch(`${API_BASE_URL}/warehouses`, { headers: authHeaders() });
        if (whRes.ok) {
          const data = await whRes.json();
          if (Array.isArray(data) && data.length > 0) {
            whList = data.map((w: any) => ({
              id: String(w.id || w.code),
              name: String(w.name || w.warehouseName || w.code),
              code: String(w.code || w.id),
            }));
          }
        }
      } catch {}

      if (whList.length === 0) {
        whList = [
          { id: 'KH001', name: 'Kho tổng (KH001)', code: 'KH001' },
          { id: 'KH002', name: 'Kho Cầu Giấy (KH002)', code: 'KH002' },
        ];
      }
      setWarehouses(whList);

      // 2. Fetch Products from Real API
      let productsList: any[] = [];
      try {
        const pRes = await fetch(`${API_BASE_URL}/products`, { headers: authHeaders() });
        if (pRes.ok) {
          const pData = await pRes.json();
          if (Array.isArray(pData)) productsList = pData;
        }
      } catch {}

      // 3. Fetch Stock Balances from Real API
      let stockMap: Record<string, number> = {};
      try {
        const stockRes = await fetch(`${API_BASE_URL}/reports/stock`, { headers: authHeaders() });
        if (stockRes.ok) {
          const stockData = await stockRes.json();
          if (Array.isArray(stockData)) {
            stockData.forEach((s: any) => {
              const whKey = s.locationCode || s.warehouseId || s.branchCode;
              const pKey = s.sku || s.productCode || s.productId;
              if (whKey && pKey) {
                stockMap[`${whKey}_${pKey}`] = Number(s.available !== undefined ? s.available : (s.totalPhysical || 0));
              }
            });
          }
        }
      } catch {}

      // Build Branch Stock Groups
      const groups: BranchStockGroup[] = whList.map((wh) => {
        let globalStt = 1;
        let totalAct = 0;
        let totalD = 0;

        const items: BelowMinStockItem[] = productsList.map((p) => {
          const pCode = String(p.internalSku || p.sku || p.code || p.id);
          const pName = String(p.name || '');
          const catName = getCategoryName(p.category || p.categoryName);
          const importPrice = Number(p.importPrice || p.costPrice || p.price || 0);
          const minStock = Number(p.minStockThreshold || p.minStock || p.minQuantity || 0);

          const key = `${wh.code}_${pCode}`;
          const keyId = `${wh.code}_${p.id}`;
          let actualStock = 0;

          if (stockMap[key] !== undefined) {
            actualStock = stockMap[key];
          } else if (stockMap[keyId] !== undefined) {
            actualStock = stockMap[keyId];
          } else if (p.stockBalances && Array.isArray(p.stockBalances)) {
            const match = p.stockBalances.find((sb: any) => sb.locationCode === wh.code || sb.warehouseId === wh.id);
            if (match) actualStock = Number(match.totalPhysical !== undefined ? match.totalPhysical : (match.available || 0));
          } else {
            actualStock = Number(p.stock || 0);
          }

          const diff = actualStock - minStock;

          totalAct += actualStock;
          totalD += diff;

          return {
            stt: globalStt++,
            productId: String(p.id || pCode),
            category: catName,
            code: pCode,
            name: pName,
            importPrice,
            minStock,
            actualStock,
            diff,
          };
        });

        return {
          branchId: wh.id,
          branchName: wh.name,
          items,
          totalActualStock: totalAct,
          totalDiff: totalD,
        };
      });

      setBranchGroups(groups);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải báo cáo từ hệ thống API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered branch groups
  const filteredGroups = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return branchGroups
      .filter((g) => selectedWarehouse === 'ALL' || g.branchId === selectedWarehouse || g.branchName.includes(selectedWarehouse))
      .map((g) => {
        const filteredItems = g.items.filter((item) => {
          const matchTerm =
            !term ||
            item.name.toLowerCase().includes(term) ||
            item.code.toLowerCase().includes(term) ||
            item.category.toLowerCase().includes(term);

          const matchBelow = !filterBelowOnly || item.diff < 0;

          return matchTerm && matchBelow;
        });

        const totalAct = filteredItems.reduce((sum, i) => sum + i.actualStock, 0);
        const totalD = filteredItems.reduce((sum, i) => sum + i.diff, 0);

        return {
          ...g,
          items: filteredItems,
          totalActualStock: totalAct,
          totalDiff: totalD,
        };
      });
  }, [branchGroups, selectedWarehouse, searchTerm, filterBelowOnly]);

  // Open detail modal and fetch real movement history from API
  const handleOpenDetailModal = async (item: BelowMinStockItem, branchName: string) => {
    setSelectedItemForModal({
      item,
      branchName,
      details: [],
      loadingDetails: true,
    });

    try {
      const historyRes = await fetch(`${API_BASE_URL}/products/${item.productId}/stock-in-history`, {
        headers: authHeaders(),
      }).catch(() => null);

      let historyData: any[] = [];
      if (historyRes && historyRes.ok) {
        historyData = await historyRes.json();
      }

      let runningBal = 0;
      let logs: TransactionDetail[] = [
        {
          stt: 1,
          code: 'Tồn đầu',
          date: '',
          targetName: 'Khách lẻ',
          inQty: 0,
          outQty: 0,
          price: 0,
          totalAmount: 0,
          balance: 0,
          note: 'Khởi tạo tồn kho ban đầu',
        },
      ];

      if (Array.isArray(historyData) && historyData.length > 0) {
        historyData.forEach((h, idx) => {
          const inQty = Number(h.quantity || h.qty || 0);
          const price = Number(h.importPrice || h.unitPrice || item.importPrice || 0);
          runningBal += inQty;

          logs.push({
            stt: idx + 2,
            code: String(h.orderCode || h.code || `PN_${idx + 1}`),
            date: h.createdAt ? new Date(h.createdAt).toLocaleString('vi-VN') : '',
            targetName: String(h.supplierName || h.source || 'Nhập kho'),
            inQty,
            outQty: 0,
            price,
            totalAmount: Math.round(inQty * price),
            balance: runningBal,
            note: String(h.note || 'Nhập kho hàng hóa'),
          });
        });
      }

      logs.push({
        stt: logs.length + 1,
        code: 'Tồn cuối',
        date: new Date().toLocaleString('vi-VN'),
        targetName: 'Hệ thống',
        inQty: 0,
        outQty: 0,
        price: 0,
        totalAmount: 0,
        balance: item.actualStock,
        note: 'Tồn thực tế hiện tại',
      });

      setSelectedItemForModal({
        item,
        branchName,
        details: logs,
        loadingDetails: false,
      });
    } catch {
      setSelectedItemForModal((prev) => (prev ? { ...prev, loadingDetails: false } : null));
    }
  };

  const handleExportExcel = () => {
    const rows: any[] = [];

    filteredGroups.forEach((g) => {
      rows.push([`=== Chi nhánh: ${g.branchName} ===`, '', '', '', '', '', '', '']);
      g.items.forEach((it) => {
        rows.push([
          it.stt,
          `"${it.category.replace(/"/g, '""')}"`,
          `"${it.code.replace(/"/g, '""')}"`,
          `"${it.name.replace(/"/g, '""')}"`,
          fmt(it.importPrice),
          it.minStock,
          it.actualStock,
          it.diff,
        ]);
      });
      rows.push(['Tổng:', '', '', '', '', '', g.totalActualStock, g.totalDiff]);
    });

    const headers = ['STT', 'Nhóm hàng hóa', 'Mã', 'Tên hàng hóa', 'Giá nhập', 'Định mức tồn', 'Thực tồn', 'Lệch'];
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Bao_Cao_Hang_Ton_Duoi_Dinh_Muc.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`space-y-4 pb-12 animate-in fade-in duration-200 ${isFullScreen ? 'fixed inset-0 z-[9000] bg-white overflow-y-auto p-6' : ''}`}>
      {/* ═══ TOP HEADER SECTION matching Gold Revenue Standard ═══ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2.5 rounded-2xl bg-cyan-600 px-5 py-2.5 text-white shadow-md">
            <TrendingDown className="h-5 w-5" />
            <h1 className="text-xl font-extrabold tracking-tight uppercase">BÁO CÁO HÀNG TỒN DƯỚI ĐỊNH MỨC</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-4.5 w-4.5 text-cyan-700 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
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
            onClick={handleExportExcel}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
          >
            <FileSpreadsheet className="h-4.5 w-4.5 text-cyan-700" />
            Export Excel
          </button>

          <button
            type="button"
            onClick={() => setShowColumnSettings(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            title="Cấu hình hiển thị cột"
          >
            <Settings className="h-4.5 w-4.5 text-cyan-700" />
            <span>Hiển thị</span>
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

      {/* ═══ FILTER & SEARCH PANEL ═══ */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-4 text-xs sm:text-sm font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-2xs placeholder:text-slate-400"
              placeholder="Tìm kiếm theo mã, tên sản phẩm, nhóm..."
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Kho hàng (Custom Styled Popover Dropdown) */}
            <div ref={warehouseDropdownRef} className="relative inline-block">
              <button
                type="button"
                onClick={() => setIsWarehouseDropdownOpen(!isWarehouseDropdownOpen)}
                className="inline-flex h-12 items-center gap-2.5 rounded-xl border-2 border-cyan-600/40 bg-slate-50 px-4 py-2 shadow-2xs transition hover:bg-slate-100 hover:border-cyan-600 active:scale-95 cursor-pointer"
              >
                <Building2 className="h-5 w-5 text-cyan-600 shrink-0" />
                <span className="text-xs sm:text-sm font-extrabold uppercase text-cyan-950 tracking-wide">KHO HÀNG:</span>
                <div className="flex items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-3.5 py-1.5 text-xs sm:text-sm font-bold text-slate-800 shadow-2xs hover:border-cyan-600 min-w-[220px] justify-between">
                  <span className="truncate max-w-[190px]">
                    {selectedWarehouse === 'ALL' ? 'Tất cả chi nhánh' : warehouses.find((w) => w.id === selectedWarehouse)?.name || 'Tất cả chi nhánh'}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-cyan-600 transition-transform duration-200 ${isWarehouseDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Custom Styled Menu với Bo góc tròn Rounded-2xl và Đổ bóng mượt */}
              {isWarehouseDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-full min-w-[280px] rounded-2xl border-2 border-cyan-500 bg-white p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWarehouse('ALL');
                      setIsWarehouseDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-between cursor-pointer mb-1 ${
                      selectedWarehouse === 'ALL'
                        ? 'bg-cyan-600 text-white font-extrabold shadow-sm'
                        : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-800'
                    }`}
                  >
                    <span>Tất cả chi nhánh</span>
                    {selectedWarehouse === 'ALL' && <Check className="h-4 w-4 text-white shrink-0" />}
                  </button>
                  {warehouses.map((w) => {
                    const isSelected = selectedWarehouse === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => {
                          setSelectedWarehouse(w.id);
                          setIsWarehouseDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-between cursor-pointer mb-1 last:mb-0 ${
                          isSelected
                            ? 'bg-cyan-600 text-white font-extrabold shadow-sm'
                            : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-800'
                        }`}
                      >
                        <span className="truncate">{w.name}</span>
                        {isSelected && <Check className="h-4 w-4 text-white shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Filter Toggle Below Min Only */}
            <button
              type="button"
              onClick={() => setFilterBelowOnly(!filterBelowOnly)}
              className={`inline-flex h-12 items-center gap-2 rounded-xl border-2 px-4 text-xs sm:text-sm font-extrabold transition cursor-pointer shadow-2xs ${
                filterBelowOnly
                  ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-sm'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <AlertTriangle className={`h-4.5 w-4.5 ${filterBelowOnly ? 'text-rose-600' : 'text-slate-500'}`} />
              <span>Chỉ xem hàng dưới định mức (Lệch &lt; 0)</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4 text-xs font-extrabold text-rose-700">
          {error}
        </div>
      )}

      {/* ═══ DATA TABLE - FIXED NON-WRAPPING HEADERS & BALANCED SIZING ═══ */}
      <div className="overflow-hidden rounded-2xl border-2 border-slate-300 bg-white shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[1050px] border-collapse text-left text-xs sm:text-sm">
            <thead className="bg-cyan-600 text-white font-extrabold uppercase border-b-2 border-cyan-700 sticky top-0 z-20 shadow-xs">
              <tr className="font-extrabold uppercase text-xs sm:text-sm tracking-wider text-white whitespace-nowrap">
                {columnVis.stt && <th className="w-14 border-r border-cyan-500/50 px-3 py-3 text-center whitespace-nowrap">TT</th>}
                {columnVis.category && <th className="w-44 border-r border-cyan-500/50 px-4 py-3 text-center whitespace-nowrap">NHÓM HÀNG HÓA</th>}
                {columnVis.code && <th className="w-36 border-r border-cyan-500/50 px-4 py-3 text-center whitespace-nowrap">MÃ</th>}
                {columnVis.name && <th className="min-w-[260px] border-r border-cyan-500/50 px-4 py-3 text-center whitespace-nowrap">TÊN HÀNG HÓA</th>}
                {columnVis.importPrice && <th className="w-36 border-r border-cyan-500/50 px-4 py-3 text-center whitespace-nowrap">GIÁ NHẬP</th>}
                {columnVis.minStock && <th className="w-36 border-r border-cyan-500/50 px-4 py-3 text-center whitespace-nowrap">ĐỊNH MỨC TỒN</th>}
                {columnVis.actualStock && <th className="w-32 border-r border-cyan-500/50 px-4 py-3 text-center whitespace-nowrap">THỰC TỒN</th>}
                {columnVis.diff && <th className="w-32 border-r border-cyan-500/50 px-4 py-3 text-center whitespace-nowrap">LỆCH</th>}
                {columnVis.actions && <th className="w-24 px-4 py-3 text-center whitespace-nowrap">THAO TÁC</th>}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-bold text-sm">
                    <RefreshCw size={20} className="animate-spin inline-block mr-2 text-cyan-600" />
                    Đang tải báo cáo hàng tồn từ CSDL...
                  </td>
                </tr>
              ) : filteredGroups.length > 0 ? (
                filteredGroups.map((g) => (
                  <React.Fragment key={g.branchId}>
                    {/* LEVEL 1: KHO HÀNG / CHI NHÁNH HEADER */}
                    <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                      <td colSpan={9} className="py-2.5 px-4 text-left font-black text-sm uppercase tracking-wide text-slate-900 bg-slate-100">
                        {g.branchName}
                      </td>
                    </tr>

                    {/* PRODUCT ROWS */}
                    {g.items.map((item) => (
                      <tr key={g.branchId + '_' + item.stt} className="hover:bg-slate-50 transition">
                        {columnVis.stt && <td className="py-2.5 px-3 text-center border-r border-slate-200 font-bold text-slate-600">{item.stt}</td>}
                        {columnVis.category && <td className="py-2.5 px-4 text-center border-r border-slate-200 font-semibold text-slate-700">{item.category}</td>}
                        {columnVis.code && <td className="py-2.5 px-4 text-center border-r border-slate-200 font-bold text-cyan-800">{item.code}</td>}
                        {columnVis.name && <td className="py-2.5 px-4 border-r border-slate-200 font-semibold text-slate-900">{item.name}</td>}
                        {columnVis.importPrice && <td className="py-2.5 px-4 text-right border-r border-slate-200 font-bold text-slate-800">{fmt(item.importPrice)}</td>}
                        {columnVis.minStock && <td className="py-2.5 px-4 text-right border-r border-slate-200 font-bold text-slate-800">{item.minStock}</td>}
                        {columnVis.actualStock && (
                          <td className={`py-2.5 px-4 text-right border-r border-slate-200 font-extrabold ${item.actualStock < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                            {item.actualStock}
                          </td>
                        )}
                        {columnVis.diff && (
                          <td className={`py-2.5 px-4 text-right border-r border-slate-200 font-extrabold ${item.diff < 0 ? 'text-rose-600 font-black' : 'text-slate-800'}`}>
                            {item.diff}
                          </td>
                        )}
                        {columnVis.actions && (
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenDetailModal(item, g.branchName)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 hover:text-cyan-700 active:scale-95 cursor-pointer"
                              title="Xem báo cáo chi tiết"
                            >
                              <Eye size={16} strokeWidth={2.5} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}

                    {/* BRANCH SUMMARY ROW */}
                    <tr className="bg-slate-200/90 font-black text-slate-900 border-t-2 border-b-2 border-slate-400">
                      <td colSpan={6} className="py-3 px-4 text-right font-black text-xs sm:text-sm uppercase tracking-wide text-slate-900">
                        Tổng:
                      </td>
                      {columnVis.actualStock && <td className="py-3 px-4 text-right font-black text-slate-950 text-xs sm:text-sm">{g.totalActualStock}</td>}
                      {columnVis.diff && <td className="py-3 px-4 text-right font-black text-rose-700 text-xs sm:text-sm">{g.totalDiff}</td>}
                      {columnVis.actions && <td className="py-3 px-4"></td>}
                    </tr>
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-bold text-sm">
                    Không tìm thấy sản phẩm tồn kho trong CSDL
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ DETAIL POPUP MODAL (PORTALIZED OVERLAY 100% COVERAGE & FULL WIDTH) ═══ */}
      {selectedItemForModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-[98vw] 2xl:max-w-[1700px] rounded-2xl border-2 border-cyan-600 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[96vh]">
            {/* Modal Header: Cyan Tươi Sáng */}
            <div className="flex items-center justify-between border-b-2 border-cyan-700 bg-cyan-600 px-6 py-4 text-white">
              <h3 className="font-extrabold text-white text-base sm:text-lg uppercase tracking-wide flex flex-wrap items-center gap-2">
                <span>BÁO CÁO TỒN CHI TIẾT SẢN PHẨM:</span>
                <span className="text-amber-200 underline underline-offset-4 decoration-cyan-300 font-black">{selectedItemForModal.item.name}</span>
                <span className="text-cyan-100 font-semibold">- CHI NHÁNH:</span>
                <span className="text-white font-bold">{selectedItemForModal.branchName}</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedItemForModal(null)}
                className="rounded-lg p-1.5 text-white/80 hover:bg-cyan-700 hover:text-white transition cursor-pointer"
              >
                <X className="h-5.5 w-5.5" />
              </button>
            </div>

            {/* Modal Body Table */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50">
              <div className="overflow-hidden rounded-xl border-2 border-cyan-600 shadow-xs bg-white">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-cyan-600 text-white font-extrabold uppercase border-b-2 border-cyan-700">
                    <tr className="whitespace-nowrap">
                      <th className="w-14 border-r border-cyan-500/50 px-3 py-3 text-center">TT</th>
                      <th className="w-36 border-r border-cyan-500/50 px-3.5 py-3 text-center">Mã phiếu</th>
                      <th className="w-40 border-r border-cyan-500/50 px-3.5 py-3 text-center">Ngày</th>
                      <th className="min-w-[160px] border-r border-cyan-500/50 px-3.5 py-3">Khách hàng</th>
                      <th className="w-24 border-r border-cyan-500/50 px-3.5 py-3 text-right">SL Nhập</th>
                      <th className="w-24 border-r border-cyan-500/50 px-3.5 py-3 text-right">SL Xuất</th>
                      <th className="w-28 border-r border-cyan-500/50 px-3.5 py-3 text-right">Giá</th>
                      <th className="w-32 border-r border-cyan-500/50 px-3.5 py-3 text-right">T.tiền</th>
                      <th className="w-24 border-r border-cyan-500/50 px-3.5 py-3 text-right font-black">Tồn</th>
                      <th className="min-w-[180px] px-3.5 py-3">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white font-medium text-slate-800">
                    {selectedItemForModal.loadingDetails ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-400 font-bold">
                          <RefreshCw size={20} className="animate-spin inline-block mr-2 text-cyan-600" />
                          Đang tải lịch sử giao dịch từ CSDL API...
                        </td>
                      </tr>
                    ) : selectedItemForModal.details.length > 0 ? (
                      selectedItemForModal.details.map((d) => (
                        <tr key={d.stt} className="hover:bg-cyan-50/40 transition">
                          <td className="py-2.5 px-3 text-center border-r border-slate-200 font-bold text-slate-600">{d.stt}</td>
                          <td className="py-2.5 px-3.5 text-center border-r border-slate-200 font-bold text-cyan-800">{d.code}</td>
                          <td className="py-2.5 px-3.5 text-center border-r border-slate-200 text-slate-600">{d.date}</td>
                          <td className="py-2.5 px-3.5 border-r border-slate-200 font-semibold">{d.targetName}</td>
                          <td className="py-2.5 px-3.5 text-right border-r border-slate-200 font-bold text-emerald-700">{d.inQty !== 0 ? d.inQty : ''}</td>
                          <td className="py-2.5 px-3.5 text-right border-r border-slate-200 font-bold text-rose-700">{d.outQty !== 0 ? d.outQty : ''}</td>
                          <td className="py-2.5 px-3.5 text-right border-r border-slate-200 font-semibold">{d.price !== 0 ? fmt(d.price) : ''}</td>
                          <td className="py-2.5 px-3.5 text-right border-r border-slate-200 font-bold">{d.totalAmount !== 0 ? fmt(d.totalAmount) : ''}</td>
                          <td className="py-2.5 px-3.5 text-right border-r border-slate-200 font-extrabold text-slate-900">{d.balance}</td>
                          <td className="py-2.5 px-3.5 text-slate-600 font-medium">{d.note}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-400 font-bold">
                          Chưa có lịch sử giao dịch ghi nhận cho sản phẩm này
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center gap-3 border-t-2 border-slate-200 bg-slate-100 px-6 py-3.5">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-xs hover:bg-emerald-700 transition active:scale-95 cursor-pointer"
              >
                <Printer className="h-4 w-4" /> Print
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-xs hover:bg-cyan-700 transition active:scale-95 cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </button>
              <button
                type="button"
                onClick={() => setSelectedItemForModal(null)}
                className="ml-auto inline-flex items-center justify-center gap-2 rounded-xl bg-slate-700 px-6 py-2.5 text-xs font-extrabold text-white shadow-xs hover:bg-slate-800 transition active:scale-95 cursor-pointer"
              >
                <X className="h-4 w-4" /> Đóng
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ═══ COLUMN VISIBILITY MODAL ═══ */}
      {showColumnSettings && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border-2 border-cyan-500 bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-extrabold text-cyan-900 text-sm flex items-center gap-2 uppercase">
                <SlidersHorizontal size={16} /> Cấu hình hiển thị cột
              </h3>
              <button
                type="button"
                onClick={() => setShowColumnSettings(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 text-xs font-bold text-slate-700">
              {Object.entries({
                stt: 'STT',
                category: 'NHÓM HÀNG HÓA',
                code: 'MÃ',
                name: 'TÊN HÀNG HÓA',
                importPrice: 'GIÁ NHẬP',
                minStock: 'ĐỊNH MỨC TỒN',
                actualStock: 'THỰC TỒN',
                diff: 'LỆCH',
                actions: 'THAO TÁC',
              }).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={(columnVis as any)[key]}
                    onChange={(e) => setColumnVis((prev) => ({ ...prev, [key]: e.target.checked }))}
                    className="h-4 w-4 rounded accent-cyan-600 cursor-pointer"
                  />
                </label>
              ))}
            </div>
            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setShowColumnSettings(false)}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold text-xs transition cursor-pointer"
              >
                Hoàn tất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
