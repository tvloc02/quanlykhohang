import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  PieChart,
  BarChart3,
  TrendingUp,
  DollarSign,
  Printer,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Calendar,
  CheckCircle,
  Settings,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';

export interface BillProfitItem {
  id: string;
  stt: number;
  billCode: string;
  branchName: string;
  productCode: string;
  productName: string;
  exportQty: number;
  exportPrice: number;
  revenue: number;
  importPrice: number;
  totalCost: number;
  profit: number;
  profitMargin: number;
  date: string;
  customerName: string;
}

const API_BASE_URL = 'http://localhost:3000/api';

const fmt = (v: number) => new Intl.NumberFormat('vi-VN').format(Math.round(v || 0));

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

export default function BillProfitReportPage() {
  const [reportData, setReportData] = useState<BillProfitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination states
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Fullscreen state
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Column settings modal
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [columnVis, setColumnVis] = useState({
    billCode: true,
    branchName: true,
    productCode: true,
    productName: true,
    exportQty: true,
    exportPrice: true,
    revenue: true,
    importPrice: true,
    totalCost: true,
    profit: true,
    profitMargin: true,
  });

  // Toast
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

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
    const handleFSChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  const fetchProfitReport = async () => {
    setLoading(true);
    setError('');
    try {
      const [outboundRes, productRes] = await Promise.all([
        fetch(`${API_BASE_URL}/outbounds`, { headers: authHeaders() }).catch(() => null),
        fetch(`${API_BASE_URL}/products`, { headers: authHeaders() }).catch(() => null),
      ]);

      let productsMap = new Map<string, { code: string; name: string; importPrice: number; price: number }>();
      if (productRes && productRes.ok) {
        const prodData = await productRes.json();
        if (Array.isArray(prodData)) {
          prodData.forEach((p: any) => {
            productsMap.set(p.code || p.id, {
              code: p.code || 'SP-' + p.id,
              name: p.name || 'Hàng hóa',
              importPrice: Number(p.costPrice || p.importPrice || p.purchasePrice || p.price * 0.7 || 500000),
              price: Number(p.price || p.sellingPrice || 1000000),
            });
          });
        }
      }

      let itemsList: BillProfitItem[] = [];
      if (outboundRes && outboundRes.ok) {
        const outboundData = await outboundRes.json();
        if (Array.isArray(outboundData)) {
          let count = 1;
          outboundData.forEach((order: any) => {
            const billCode = order.orderNo || order.code || `XBH_${String(order.id).slice(0, 6)}`;
            const branchName = order.warehouseName || order.branchName || order.warehouse?.name || order.branch || 'Kho Tổng Hồ Chí Minh';
            const orderDate = order.createdAt ? new Date(order.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            const custName = order.customer || order.customerName || 'Khách hàng lẻ';

            const details = Array.isArray(order.details) ? order.details : Array.isArray(order.items) ? order.items : [];

            details.forEach((d: any) => {
              const pCode = d.productCode || d.productSku || d.product?.internalSku || d.sku || '';
              const pName = d.productName || d.product?.name || 'Sản phẩm kinh doanh';
              const exportQty = Number(d.requiredQty || d.pickedQty || d.qty || d.quantity || 0);
              const exportPrice = Number(d.unitPrice || d.price || 1000000);
              const revenue = exportQty * exportPrice;

              const matchedProd = productsMap.get(pCode);
              const importPrice = matchedProd ? matchedProd.importPrice : Math.round(exportPrice * 0.7);
              const totalCost = exportQty * importPrice;
              const profit = revenue - totalCost;
              const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

              itemsList.push({
                id: `${order.id}-${count}`,
                stt: count++,
                billCode,
                branchName,
                productCode: pCode,
                productName: pName,
                exportQty,
                exportPrice,
                revenue,
                importPrice,
                totalCost,
                profit,
                profitMargin: Math.round(profitMargin * 100) / 100,
                date: orderDate,
                customerName: custName,
              });
            });
          });
        }
      }
      setReportData(itemsList);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải dữ liệu báo cáo lợi nhuận');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfitReport();
  }, []);

  const filteredData = useMemo(() => {
    return reportData.filter((item) => {
      const matchesSearch =
        !searchQuery.trim() ||
        item.billCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.branchName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.productCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.customerName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFrom = !fromDate || item.date >= fromDate;
      const matchesTo = !toDate || item.date <= toDate;

      return matchesSearch && matchesFrom && matchesTo;
    });
  }, [reportData, searchQuery, fromDate, toDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, fromDate, toDate]);

  // Totals calculations
  const totalExportQty = filteredData.reduce((sum, i) => sum + i.exportQty, 0);
  const totalRevenue = filteredData.reduce((sum, i) => sum + i.revenue, 0);
  const totalCostSum = filteredData.reduce((sum, i) => sum + i.totalCost, 0);
  const totalProfitSum = filteredData.reduce((sum, i) => sum + i.profit, 0);
  const overallMargin = totalRevenue > 0 ? (totalProfitSum / totalRevenue) * 100 : 0;

  const labelColSpan =
    1 +
    (columnVis.billCode ? 1 : 0) +
    (columnVis.branchName ? 1 : 0) +
    (columnVis.productCode ? 1 : 0) +
    (columnVis.productName ? 1 : 0);

  const totalItems = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const handleExportExcel = () => {
    if (filteredData.length === 0) return;
    const exportRows = filteredData.map((item, idx) => ({
      STT: idx + 1,
      'Mã Hóa Đơn': item.billCode,
      'Chi Nhánh': item.branchName,
      'Mã Sản Phẩm': item.productCode,
      'Tên Hàng Hóa': item.productName,
      'Số Xuất': item.exportQty,
      'Giá Xuất (VNĐ)': item.exportPrice,
      'Doanh Thu (VNĐ)': item.revenue,
      'Giá Nhập (VNĐ)': item.importPrice,
      'Tổng Vốn (VNĐ)': item.totalCost,
      'Lợi Nhuận (VNĐ)': item.profit,
      '% Lợi Nhuận': `${item.profitMargin}%`,
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Loi_Nhuan_Theo_Hoa_Don');
    XLSX.writeFile(wb, `Bao_Cao_Loi_Nhuan_Hoa_Don_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Đã xuất báo cáo Excel thành công!');
  };

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200 text-slate-800">
      {toastMessage &&
        createPortal(
          <div className="fixed top-6 right-6 z-[9999] flex items-center gap-3 rounded-2xl bg-slate-900 text-white px-5 py-3.5 shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4">
            <CheckCircle className="h-5 w-5 text-emerald-400" />
            <p className="text-sm font-extrabold">{toastMessage}</p>
          </div>,
          document.body
        )}

      {/* ═══ TOP HEADER SECTION ═══ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left Badge Title */}
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-3 rounded-2xl bg-cyan-600 px-5 py-2.5 text-white shadow-md">
            <PieChart className="h-5.5 w-5.5 text-white" />
            <h1 className="text-xl font-extrabold tracking-tight uppercase text-white">
              BÁO CÁO LỢI NHUẬN THEO HÓA ĐƠN
            </h1>
          </div>
        </div>

        {/* Right Action Buttons matching image 2 standard outline style */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* In báo cáo */}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-700 bg-white px-4 py-2 text-sm font-bold text-cyan-800 shadow-2xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
          >
            <Printer className="h-4 w-4 text-cyan-700" />
            In báo cáo
          </button>

          {/* Export Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-700 bg-white px-4 py-2 text-sm font-bold text-cyan-800 shadow-2xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-cyan-700" />
            Export Excel
          </button>

          {/* Hiển thị */}
          <button
            type="button"
            onClick={() => setShowColumnSettings(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-700 bg-white px-4 py-2 text-sm font-bold text-cyan-800 shadow-2xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            title="Cấu hình hiển thị cột"
          >
            <Settings className="h-4 w-4 text-cyan-700" />
            <span>Hiển thị</span>
          </button>

          {/* Toàn màn hình */}
          <button
            type="button"
            onClick={toggleBrowserFullscreen}
            className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-cyan-700 bg-white text-cyan-800 shadow-2xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            title="Toàn màn hình"
          >
            {isFullScreen ? <Minimize2 className="h-4 w-4 text-cyan-700" /> : <Maximize2 className="h-4 w-4 text-cyan-700" />}
          </button>

          {/* Làm mới */}
          <button
            type="button"
            onClick={fetchProfitReport}
            disabled={loading}
            className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-cyan-700 bg-white text-cyan-800 shadow-2xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer disabled:opacity-50 ml-1"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`h-4 w-4 text-cyan-700 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ═══ 3 BUTTON TỔNG HỢP (LẤY MẪU TỪ TRANG HÀNG HÓA) ═══ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
          <p className="text-base font-black text-cyan-700 uppercase">
            TỔNG DOANH THU: <span className="text-slate-900">{fmt(totalRevenue)} đ</span>
          </p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
          <p className="text-base font-black text-cyan-700 uppercase">
            TỔNG VỐN NHẬP: <span className="text-slate-900">{fmt(totalCostSum)} đ</span>
          </p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
          <p className="text-base font-black text-cyan-700 uppercase">
            TỔNG LỢI NHUẬN RÒNG: <span className={totalProfitSum >= 0 ? 'text-emerald-700' : 'text-rose-600'}>{fmt(totalProfitSum)} đ ({overallMargin.toFixed(1)}%)</span>
          </p>
        </div>
      </div>

      {/* ═══ FILTER & SEARCH PANEL (CLEAN LIVE SEARCH & DATE FILTER ONLY) ═══ */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Live Search input */}
          <div className="relative flex-1 min-w-[300px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-4 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-2xs"
              placeholder="Tìm theo mã HĐ, chi nhánh, mã SP, tên sản phẩm..."
            />
          </div>

          {/* Date Filter Box */}
          <div className="inline-flex h-11 items-center gap-3 rounded-xl border border-slate-300 bg-slate-50 px-3.5 shadow-2xs">
            <div className="flex items-center gap-2">
              <Calendar className="h-4.5 w-4.5 text-slate-600 shrink-0" />
              <span className="text-xs font-bold uppercase text-slate-800 tracking-wide">Thời gian:</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-600">Từ</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-600">Đến</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4 text-xs font-extrabold text-rose-700">
          {error}
        </div>
      )}

      {/* ═══ TABLE DISPLAY WITH COMPACT IDENTIFIERS & EXPANDED FINANCIAL COLUMNS ═══ */}
      <div className="overflow-hidden rounded-2xl border-2 border-slate-300 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-cyan-600 text-white sticky top-0 z-20 shadow-xs border-b-2 border-cyan-700">
              <tr className="text-xs font-extrabold uppercase tracking-tight whitespace-nowrap">
                <th className="border-r border-cyan-500/50 px-2 py-3 text-center w-12 whitespace-nowrap">
                  STT
                </th>
                {columnVis.billCode && (
                  <th className="border-r border-cyan-500/50 px-2.5 py-3 text-center w-28 whitespace-nowrap">
                    MÃ HĐ
                  </th>
                )}
                {columnVis.branchName && (
                  <th className="border-r border-cyan-500/50 px-3 py-3 text-center w-44 whitespace-nowrap">
                    CHI NHÁNH
                  </th>
                )}
                {columnVis.productCode && (
                  <th className="border-r border-cyan-500/50 px-2.5 py-3 text-center w-28 whitespace-nowrap">
                    MÃ SP
                  </th>
                )}
                {columnVis.productName && (
                  <th className="border-r border-cyan-500/50 px-3 py-3 text-center w-48 min-w-[140px]">
                    TÊN HÀNG HÓA
                  </th>
                )}
                {columnVis.exportQty && (
                  <th className="border-r border-cyan-500/50 px-2.5 py-3 text-center w-24 whitespace-nowrap">
                    SỐ LƯỢNG
                  </th>
                )}
                {columnVis.exportPrice && (
                  <th className="border-r border-cyan-500/50 px-4 py-3 text-center min-w-[135px] whitespace-nowrap">
                    GIÁ XUẤT (VNĐ)
                  </th>
                )}
                {columnVis.revenue && (
                  <th className="border-r border-cyan-500/50 px-4 py-3 text-center min-w-[145px] whitespace-nowrap">
                    DOANH THU (VNĐ)
                  </th>
                )}
                {columnVis.importPrice && (
                  <th className="border-r border-cyan-500/50 px-4 py-3 text-center min-w-[135px] whitespace-nowrap">
                    GIÁ NHẬP (VNĐ)
                  </th>
                )}
                {columnVis.totalCost && (
                  <th className="border-r border-cyan-500/50 px-4 py-3 text-center min-w-[145px] whitespace-nowrap">
                    TỔNG VỐN (VNĐ)
                  </th>
                )}
                {columnVis.profit && (
                  <th className="border-r border-cyan-500/50 px-4 py-3 text-center min-w-[145px] whitespace-nowrap">
                    LỢI NHUẬN (VNĐ)
                  </th>
                )}
                {columnVis.profitMargin && (
                  <th className="px-4 py-3 text-center min-w-[110px] whitespace-nowrap">
                    % LỢI NHUẬN
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white text-xs text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500 font-semibold">
                    Đang tính toán dữ liệu báo cáo lợi nhuận theo hóa đơn...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500 font-semibold">
                    Không tìm thấy bản ghi hóa đơn phù hợp.
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, index) => {
                  const globalIndex = (currentPage - 1) * pageSize + index + 1;
                  const isNegative = item.profit < 0;

                  return (
                    <tr
                      key={item.id}
                      className="group border-b border-slate-200 transition hover:bg-slate-50"
                    >
                      <td className="border-r border-slate-300 px-2 py-3 text-center font-bold text-slate-500 text-sm">
                        {globalIndex}
                      </td>
                      {columnVis.billCode && (
                        <td className="border-r border-slate-300 px-2.5 py-3 text-center font-bold text-slate-800 text-sm">
                          {item.billCode}
                        </td>
                      )}
                      {columnVis.branchName && (
                        <td className="border-r border-slate-300 px-3 py-3 text-left font-bold text-slate-800 text-sm">
                          {item.branchName}
                        </td>
                      )}
                      {columnVis.productCode && (
                        <td className="border-r border-slate-300 px-2.5 py-3 text-center font-bold text-slate-800 text-sm">
                          {item.productCode}
                        </td>
                      )}
                      {columnVis.productName && (
                        <td className="border-r border-slate-300 px-3 py-3 text-left font-bold text-slate-900 text-sm">
                          {item.productName}
                        </td>
                      )}
                      {columnVis.exportQty && (
                        <td className="border-r border-slate-300 px-2.5 py-3 text-center font-bold text-slate-800 text-sm">
                          {fmt(item.exportQty)}
                        </td>
                      )}
                      {columnVis.exportPrice && (
                        <td className="border-r border-slate-300 px-4 py-3 text-right font-bold text-slate-800 text-sm">
                          {fmt(item.exportPrice)}
                        </td>
                      )}
                      {columnVis.revenue && (
                        <td className="border-r border-slate-300 px-4 py-3 text-right font-bold text-slate-800 text-sm">
                          {fmt(item.revenue)}
                        </td>
                      )}
                      {columnVis.importPrice && (
                        <td className="border-r border-slate-300 px-4 py-3 text-right font-bold text-slate-800 text-sm">
                          {fmt(item.importPrice)}
                        </td>
                      )}
                      {columnVis.totalCost && (
                        <td className="border-r border-slate-300 px-4 py-3 text-right font-bold text-slate-800 text-sm">
                          {fmt(item.totalCost)}
                        </td>
                      )}
                      {columnVis.profit && (
                        <td
                          className={`border-r border-slate-300 px-4 py-3 text-right font-bold text-sm ${
                            isNegative ? 'text-rose-600' : 'text-slate-800'
                          }`}
                        >
                          {fmt(item.profit)}
                        </td>
                      )}
                      {columnVis.profitMargin && (
                        <td
                          className={`px-4 py-3 text-right font-bold text-sm ${
                            isNegative ? 'text-rose-600' : 'text-slate-800'
                          }`}
                        >
                          {item.profitMargin.toFixed(2)}%
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* TOTALS SUMMARY ROW WITH UNIFORM TEXT COLOR & BOLD WEIGHT */}
            {filteredData.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-400 bg-slate-200/90 font-black text-slate-900 text-sm">
                  <td colSpan={labelColSpan} className="border-r border-slate-300 p-3.5 text-left uppercase tracking-wider font-black text-xs text-slate-900">
                    TỔNG CỘNG HÓA ĐƠN:
                  </td>
                  {columnVis.exportQty && (
                    <td className="border-r border-slate-300 p-3.5 text-center font-bold text-slate-900 text-sm">
                      {fmt(totalExportQty)}
                    </td>
                  )}
                  {columnVis.exportPrice && <td className="border-r border-slate-300 p-3.5 text-center font-bold text-slate-900 text-sm">-</td>}
                  {columnVis.revenue && (
                    <td className="border-r border-slate-300 p-3.5 text-right font-bold text-slate-900 text-sm">
                      {fmt(totalRevenue)}
                    </td>
                  )}
                  {columnVis.importPrice && <td className="border-r border-slate-300 p-3.5 text-center font-bold text-slate-900 text-sm">-</td>}
                  {columnVis.totalCost && (
                    <td className="border-r border-slate-300 p-3.5 text-right font-bold text-slate-900 text-sm">
                      {fmt(totalCostSum)}
                    </td>
                  )}
                  {columnVis.profit && (
                    <td
                      className={`border-r border-slate-300 p-3.5 text-right font-bold text-sm ${
                        totalProfitSum >= 0 ? 'text-slate-900' : 'text-rose-600'
                      }`}
                    >
                      {fmt(totalProfitSum)}
                    </td>
                  )}
                  {columnVis.profitMargin && (
                    <td
                      className={`p-3.5 text-right font-bold text-sm ${
                        overallMargin >= 0 ? 'text-slate-900' : 'text-rose-600'
                      }`}
                    >
                      {overallMargin.toFixed(2)}%
                    </td>
                  )}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* PAGINATION FOOTER ATTACHED */}
        {totalItems > 0 && (
          <div className="flex flex-col items-center justify-between border-t-2 border-slate-200 bg-white px-5 py-3 sm:flex-row text-xs font-bold text-slate-700">
            <div className="font-semibold text-slate-600">
              Hiển thị <span className="font-bold text-slate-900">{startIndex} - {endIndex}</span> trong tổng số <span className="font-bold text-slate-900">{totalItems}</span> bản ghi
            </div>
            <div className="mt-3 flex items-center gap-3 sm:mt-0">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-bold">Hiển thị:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                >
                  <option value={10}>10 dòng/trang</option>
                  <option value={20}>20 dòng/trang</option>
                  <option value={50}>50 dòng/trang</option>
                  <option value={100}>100 dòng/trang</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  title="Trang đầu"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  title="Trang trước"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-3 py-1 font-bold text-slate-800 bg-slate-100 rounded-lg text-xs">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  title="Trang sau"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  title="Trang cuối"
                >
                  <ChevronsRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ COLUMN VISIBILITY SETTINGS MODAL ═══ */}
      {showColumnSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2 uppercase tracking-wide">
                <SlidersHorizontal className="h-5 w-5 text-cyan-600" /> Cấu hình hiển thị cột
              </h3>
              <button
                type="button"
                onClick={() => setShowColumnSettings(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {[
                { key: 'billCode', label: 'Mã Hóa Đơn' },
                { key: 'branchName', label: 'Chi Nhánh' },
                { key: 'productCode', label: 'Mã Sản Phẩm' },
                { key: 'productName', label: 'Tên Hàng Hóa' },
                { key: 'exportQty', label: 'Số Xuất' },
                { key: 'exportPrice', label: 'Giá Xuất' },
                { key: 'revenue', label: 'Doanh Thu' },
                { key: 'importPrice', label: 'Giá Nhập' },
                { key: 'totalCost', label: 'Tổng Vốn' },
                { key: 'profit', label: 'Lợi Nhuận' },
                { key: 'profitMargin', label: '% Lợi Nhuận' },
              ].map((col) => (
                <label key={col.key} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 hover:bg-cyan-50/50 cursor-pointer transition">
                  <span className="text-xs font-bold text-slate-800">{col.label}</span>
                  <input
                    type="checkbox"
                    checked={(columnVis as any)[col.key]}
                    onChange={(e) =>
                      setColumnVis((prev) => ({ ...prev, [col.key]: e.target.checked }))
                    }
                    className="h-4 w-4 rounded-md border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                  />
                </label>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowColumnSettings(false)}
                className="rounded-xl bg-cyan-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-cyan-700 transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
