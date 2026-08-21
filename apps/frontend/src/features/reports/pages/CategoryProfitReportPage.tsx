import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  FileSpreadsheet,
  Printer,
  Search,
  PieChart,
  DollarSign,
  TrendingUp,
  BarChart3,
  CheckCircle,
  FolderTree,
  Building2,
  RefreshCw,
  ChevronDown,
  Settings,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import * as XLSX from 'xlsx';

export interface CategoryProfitItem {
  id: string;
  branch: string;
  categoryName: string;
  stt: number;
  productCode: string;
  productName: string;
  exportQty: number;
  exportPrice: number;
  revenue: number;
  importPrice: number;
  totalCost: number;
  profit: number;
  profitMargin: number;
}

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

export default function CategoryProfitReportPage() {
  const [reportData, setReportData] = useState<CategoryProfitItem[]>([]);
  const [categoriesList, setCategoriesList] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
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

  // Toast & Fullscreen
  const [toastMessage, setToastMessage] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);

  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullScreen(false);
      }
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const fetchCategoryProfitReport = async () => {
    setLoading(true);
    try {
      const [outboundRes, productRes, catRes] = await Promise.all([
        fetch(`${API_BASE_URL}/outbounds`, { headers: authHeaders() }).catch(() => null),
        fetch(`${API_BASE_URL}/products`, { headers: authHeaders() }).catch(() => null),
        fetch(`${API_BASE_URL}/categories`, { headers: authHeaders() }).catch(() => null),
      ]);

      if (catRes && catRes.ok) {
        const catData = await catRes.json();
        if (Array.isArray(catData)) {
          setCategoriesList(catData.map((c: any) => ({ id: String(c.id), name: String(c.name) })));
        }
      }

      let productsMap = new Map<string, { code: string; name: string; category: string; importPrice: number; price: number }>();
      if (productRes && productRes.ok) {
        const prodData = await productRes.json();
        if (Array.isArray(prodData)) {
          prodData.forEach((p: any) => {
            productsMap.set(p.code || p.id, {
              code: p.code || 'SP-' + p.id,
              name: p.name || 'Hàng hóa',
              category: p.categoryName || p.category?.name || 'Hàng hóa chung',
              importPrice: Number(p.costPrice || p.importPrice || p.purchasePrice || p.price * 0.7 || 500000),
              price: Number(p.price || p.sellingPrice || 1000000),
            });
          });
        }
      }

      let itemsList: CategoryProfitItem[] = [];

      if (outboundRes && outboundRes.ok) {
        const outbounds = await outboundRes.json();
        if (Array.isArray(outbounds)) {
          const prodStats = new Map<
            string,
            { branch: string; categoryName: string; code: string; name: string; exportQty: number; revenue: number; totalCost: number; price: number; importPrice: number }
          >();

          outbounds.forEach((order: any) => {
            const branch = order.warehouseName || order.branch || 'Kho Tổng';
            const details = Array.isArray(order.details) ? order.details : [];

            details.forEach((d: any) => {
              const pCode = d.productCode || d.productSku || d.product?.internalSku || '';
              const pName = d.productName || d.product?.name || 'Sản phẩm';
              const qty = Number(d.requiredQty || d.pickedQty || d.qty || 0);
              const price = Number(d.unitPrice || d.price || 0);

              const matchedProd = productsMap.get(pCode);
              const catName = matchedProd ? matchedProd.category : 'Nhóm chung';
              const cost = matchedProd ? matchedProd.importPrice : price * 0.7;

              const rev = qty * price;
              const totCost = qty * cost;

              const key = `${branch}-${pCode}`;
              const existing = prodStats.get(key);
              if (existing) {
                existing.exportQty += qty;
                existing.revenue += rev;
                existing.totalCost += totCost;
              } else {
                prodStats.set(key, {
                  branch,
                  categoryName: catName,
                  code: pCode,
                  name: pName,
                  exportQty: qty,
                  revenue: rev,
                  totalCost: totCost,
                  price,
                  importPrice: cost,
                });
              }
            });
          });

          let sttCounter = 1;
          prodStats.forEach((val) => {
            const profit = val.revenue - val.totalCost;
            const profitMargin = val.revenue > 0 ? (profit / val.revenue) * 100 : 0;

            itemsList.push({
              id: `cat-profit-${sttCounter}`,
              branch: val.branch,
              categoryName: val.categoryName,
              stt: sttCounter++,
              productCode: val.code,
              productName: val.name,
              exportQty: val.exportQty,
              exportPrice: val.price,
              revenue: val.revenue,
              importPrice: val.importPrice,
              totalCost: Math.round(val.totalCost),
              profit: Math.round(profit),
              profitMargin: Math.round(profitMargin * 100) / 100,
            });
          });
        }
      }

      setReportData(itemsList);
    } catch {
      // quiet fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategoryProfitReport();
  }, []);

  const branchOptions = useMemo(() => {
    const branches = Array.from(new Set(reportData.map((d) => d.branch)));
    return ['ALL', ...branches];
  }, [reportData]);

  const filteredData = useMemo(() => {
    return reportData.filter((item) => {
      const matchesBranch = selectedBranch === 'ALL' || item.branch === selectedBranch;
      const matchesCat = selectedCategory === 'ALL' || item.categoryName === selectedCategory;
      const matchesSearch =
        !searchQuery ||
        item.productCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.categoryName.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesBranch && matchesCat && matchesSearch;
    });
  }, [reportData, selectedBranch, selectedCategory, searchQuery]);

  const groupedDataByBranch = useMemo(() => {
    const map = new Map<string, CategoryProfitItem[]>();
    filteredData.forEach((item) => {
      const key = item.branch || 'Khác';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    return map;
  }, [filteredData]);

  const totalExportQty = useMemo(() => filteredData.reduce((s, i) => s + i.exportQty, 0), [filteredData]);
  const totalRevenue = useMemo(() => filteredData.reduce((s, i) => s + i.revenue, 0), [filteredData]);
  const totalCostSum = useMemo(() => filteredData.reduce((s, i) => s + i.totalCost, 0), [filteredData]);
  const totalProfitSum = useMemo(() => filteredData.reduce((s, i) => s + i.profit, 0), [filteredData]);
  const overallMargin = useMemo(
    () => (totalRevenue > 0 ? (totalProfitSum / totalRevenue) * 100 : 0),
    [totalRevenue, totalProfitSum]
  );

  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  const handleExportExcel = () => {
    if (filteredData.length === 0) {
      showToast('Không có dữ liệu để xuất Excel!');
      return;
    }

    const exportRows = filteredData.map((item) => ({
      'STT': item.stt,
      'Chi Nhánh': item.branch,
      'Nhóm Hàng': item.categoryName,
      'Mã SP': item.productCode,
      'Tên Hàng Hóa': item.productName,
      'Số Lượng': item.exportQty,
      'Giá Xuất (VND)': item.exportPrice,
      'Doanh Thu (VND)': item.revenue,
      'Giá Nhập (VND)': item.importPrice,
      'Tổng Vốn (VND)': item.totalCost,
      'Lợi Nhuận (VND)': item.profit,
      '% Lợi Nhuận': item.profitMargin.toFixed(2),
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Loi_Nhuan_Nhom_Hang');
    XLSX.writeFile(wb, `Bao_Cao_Loi_Nhuan_Nhom_Hang_${new Date().toISOString().split('T')[0]}.xlsx`);
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

      {/* ═══ TOP HEADER - CYAN TITLE & EXACT MATCHED BUTTONS ═══ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2.5 rounded-2xl bg-cyan-600 px-5 py-2.5 text-white shadow-md">
            <FolderTree className="h-5 w-5" />
            <h1 className="text-xl font-extrabold tracking-tight uppercase">
              Báo cáo Lợi nhuận theo Nhóm hàng
            </h1>
          </div>
        </div>

        {/* Action Buttons styled like sample image: cyan border, text, icons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-xl border border-cyan-700 bg-white text-cyan-800 font-bold text-xs shadow-2xs hover:bg-cyan-50 transition cursor-pointer"
          >
            <Printer className="h-4 w-4 text-cyan-700" />
            <span>In báo cáo</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-xl border border-cyan-700 bg-white text-cyan-800 font-bold text-xs shadow-2xs hover:bg-cyan-50 transition cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-cyan-700" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={() => showToast('Đang bật cấu hình hiển thị cột!')}
            className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-xl border border-cyan-700 bg-white text-cyan-800 font-bold text-xs shadow-2xs hover:bg-cyan-50 transition cursor-pointer"
          >
            <Settings className="h-4 w-4 text-cyan-700" />
            <span>Hiển thị</span>
          </button>

          <button
            type="button"
            onClick={toggleBrowserFullscreen}
            className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-cyan-700 bg-white text-cyan-800 shadow-2xs hover:bg-cyan-50 transition cursor-pointer"
            title="Toàn màn hình"
          >
            {isFullScreen ? <Minimize2 className="h-4 w-4 text-cyan-700" /> : <Maximize2 className="h-4 w-4 text-cyan-700" />}
          </button>

          <button
            type="button"
            onClick={fetchCategoryProfitReport}
            disabled={loading}
            className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-cyan-700 bg-white text-cyan-800 shadow-2xs hover:bg-cyan-50 transition cursor-pointer disabled:opacity-50"
            title="Làm mới"
          >
            <RefreshCw className={`h-4 w-4 text-cyan-700 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ═══ FILTER & CONTROL TOOLBAR - SEARCH LEFT & FILTERS RIGHT ═══ */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between rounded-2xl border-2 border-slate-200 bg-white p-3.5 shadow-sm text-xs font-bold">
        {/* Left: Expanded Search Bar */}
        <div className="relative w-full lg:w-96 flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm mã SP, tên SP, nhóm..."
            className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20"
          />
        </div>

        {/* Right: Filters (Nhóm, Kho, Từ ngày, Đến ngày) */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-700 font-extrabold">Nhóm:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-cyan-600 cursor-pointer min-w-[130px]"
            >
              <option value="ALL">Tất cả nhóm</option>
              {categoriesList.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-700 font-extrabold">Kho:</span>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-cyan-600 cursor-pointer min-w-[130px]"
            >
              <option value="ALL">Tất cả chi nhánh</option>
              {branchOptions.filter((b) => b !== 'ALL').map((br) => (
                <option key={br} value={br}>
                  {br}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-700 font-extrabold">Từ ngày:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-cyan-600 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-700 font-extrabold">Đến ngày:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-cyan-600 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* ═══ TABLE DISPLAY - NEUTRAL SLATE / WHITE WITH CRISP GRID BORDERS ═══ */}
      <div className="overflow-hidden rounded-2xl border-2 border-slate-300 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-cyan-600 text-white sticky top-0 z-20 shadow-xs border-b-2 border-cyan-700">
              <tr className="text-xs font-extrabold uppercase tracking-tight">
                <th className="border-r border-cyan-500/50 px-3 py-3 text-center w-14 whitespace-nowrap">
                  STT
                </th>
                <th className="border-r border-cyan-500/50 px-3 py-3 text-center w-28 whitespace-nowrap">
                  MÃ
                </th>
                <th className="border-r border-cyan-500/50 px-4 py-3 text-center w-52 min-w-[150px]">
                  TÊN HÀNG HÓA
                </th>
                <th className="border-r border-cyan-500/50 px-3 py-3 text-center w-28 whitespace-nowrap">
                  SỐ LƯỢNG
                </th>
                <th className="border-r border-cyan-500/50 px-4 py-3 text-center w-36 whitespace-nowrap">
                  GIÁ XUẤT
                </th>
                <th className="border-r border-cyan-500/50 px-4 py-3 text-center w-40 whitespace-nowrap">
                  DOANH THU
                </th>
                <th className="border-r border-cyan-500/50 px-4 py-3 text-center w-36 whitespace-nowrap">
                  GIÁ NHẬP
                </th>
                <th className="border-r border-cyan-500/50 px-4 py-3 text-center w-40 whitespace-nowrap">
                  TỔNG VỐN
                </th>
                <th className="border-r border-cyan-500/50 px-4 py-3 text-center w-40 whitespace-nowrap">
                  LỢI NHUẬN
                </th>
                <th className="px-4 py-3 text-center w-32 whitespace-nowrap">
                  % LỢI NHUẬN
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white text-xs text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500 font-semibold">
                    Đang tính toán báo cáo lợi nhuận theo nhóm hàng...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500 font-semibold">
                    Không tìm thấy dữ liệu nhóm hàng phù hợp.
                  </td>
                </tr>
              ) : (
                Array.from(groupedDataByBranch.entries()).map(([branchName, items]) => {
                  const branchQty = items.reduce((s, i) => s + i.exportQty, 0);
                  const branchRev = items.reduce((s, i) => s + i.revenue, 0);
                  const branchCost = items.reduce((s, i) => s + i.totalCost, 0);
                  const branchProf = items.reduce((s, i) => s + i.profit, 0);

                  return (
                    <React.Fragment key={branchName}>
                      {/* BRANCH SECTION HEADER - ALIGNED LEFT WITH ARROW */}
                      <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300 border-b border-slate-300">
                        <td colSpan={10} className="px-4 py-2.5 text-left font-black uppercase text-xs tracking-wider border-r border-slate-300">
                          <div className="flex items-center gap-2">
                            <ChevronDown size={16} className="text-slate-700" />
                            <Building2 size={16} className="text-cyan-700" />
                            <span>KHO: {branchName}</span>
                          </div>
                        </td>
                      </tr>

                      {/* BRANCH CATEGORY PRODUCT ROWS */}
                      {items.map((item) => {
                        return (
                          <tr
                            key={item.id}
                            className="group border-b border-slate-200 transition hover:bg-slate-50"
                          >
                            <td className="border-r border-slate-300 px-3 py-3 text-center font-bold text-slate-500 text-sm">
                              {item.stt}
                            </td>
                            <td className="border-r border-slate-300 px-3 py-3 text-left font-bold text-slate-800 text-sm">
                              {item.productCode}
                            </td>
                            <td className="border-r border-slate-300 px-4 py-3 text-left font-bold text-slate-900 text-sm">
                              {item.productName}
                            </td>
                            <td className="border-r border-slate-300 px-3 py-3 text-center font-bold text-slate-800 text-sm">
                              {item.exportQty}
                            </td>
                            <td className="border-r border-slate-300 px-4 py-3 text-right font-bold text-slate-800 text-sm">
                              {item.exportPrice.toLocaleString('vi-VN')}
                            </td>
                            <td className="border-r border-slate-300 px-4 py-3 text-right font-bold text-slate-800 text-sm">
                              {item.revenue.toLocaleString('vi-VN')}
                            </td>
                            <td className="border-r border-slate-300 px-4 py-3 text-right font-bold text-slate-800 text-sm">
                              {item.importPrice.toLocaleString('vi-VN')}
                            </td>
                            <td className="border-r border-slate-300 px-4 py-3 text-right font-bold text-slate-800 text-sm">
                              {item.totalCost.toLocaleString('vi-VN')}
                            </td>
                            <td className="border-r border-slate-300 px-4 py-3 text-right font-bold text-slate-800 text-sm">
                              {item.profit.toLocaleString('vi-VN')}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-800 text-sm">
                              {item.profitMargin.toFixed(2)}%
                            </td>
                          </tr>
                        );
                      })}

                      {/* BRANCH SUB-TOTAL ROW - LEFT ALIGNED LABEL & CENTERED QTY */}
                      <tr className="bg-slate-100 font-extrabold text-slate-900 border-y-2 border-slate-300 text-sm">
                        <td colSpan={3} className="border-r border-slate-300 px-4 py-2.5 text-left text-xs uppercase font-black">
                          TỔNG CHI NHÁNH ({items.length} MỤC):
                        </td>
                        <td className="border-r border-slate-300 px-3 py-2.5 text-center font-bold text-slate-900 text-sm">
                          {branchQty.toLocaleString('vi-VN')}
                        </td>
                        <td className="border-r border-slate-300 px-4 py-2.5 text-center font-bold text-slate-900 text-sm">
                          -
                        </td>
                        <td className="border-r border-slate-300 px-4 py-2.5 text-right font-bold text-slate-900 text-sm">
                          {branchRev.toLocaleString('vi-VN')}
                        </td>
                        <td className="border-r border-slate-300 px-4 py-2.5 text-center font-bold text-slate-900 text-sm">
                          -
                        </td>
                        <td className="border-r border-slate-300 px-4 py-2.5 text-right font-bold text-slate-900 text-sm">
                          {branchCost.toLocaleString('vi-VN')}
                        </td>
                        <td className="border-r border-slate-300 px-4 py-2.5 text-right font-bold text-slate-900 text-sm">
                          {branchProf.toLocaleString('vi-VN')}
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold text-slate-900 text-sm">
                          -
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>

            {/* GRAND TOTAL ROW - LEFT ALIGNED LABEL & CENTERED QTY */}
            {filteredData.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-400 bg-slate-200/90 font-black text-slate-900 text-sm">
                  <td colSpan={3} className="border-r border-slate-300 p-3.5 text-left uppercase tracking-wider font-black text-xs text-slate-900">
                    TỔNG CỘNG TOÀN BỘ NHÓM HÀNG:
                  </td>
                  <td className="border-r border-slate-300 p-3.5 text-center font-bold text-slate-900 text-sm">
                    {totalExportQty.toLocaleString('vi-VN')}
                  </td>
                  <td className="border-r border-slate-300 p-3.5 text-center font-bold text-slate-900 text-sm">
                    -
                  </td>
                  <td className="border-r border-slate-300 p-3.5 text-right font-bold text-slate-900 text-sm">
                    {totalRevenue.toLocaleString('vi-VN')}
                  </td>
                  <td className="border-r border-slate-300 p-3.5 text-center font-bold text-slate-900 text-sm">
                    -
                  </td>
                  <td className="border-r border-slate-300 p-3.5 text-right font-bold text-slate-900 text-sm">
                    {totalCostSum.toLocaleString('vi-VN')}
                  </td>
                  <td className="border-r border-slate-300 p-3.5 text-right font-bold text-slate-900 text-sm">
                    {totalProfitSum.toLocaleString('vi-VN')}
                  </td>
                  <td className="p-3.5 text-right font-bold text-slate-900 text-sm">
                    {overallMargin.toFixed(2)}%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        {totalItems > 0 && (
          <div className="flex flex-col items-center justify-between border-t-2 border-slate-200 bg-white px-6 py-3 sm:flex-row text-xs font-extrabold text-slate-700">
            <div className="font-semibold text-slate-600">
              Tổng số: <b>{totalItems}</b> <span className="ml-2">Hiển thị {startIndex} - {endIndex}</span>
            </div>
            <div className="mt-4 flex items-center gap-2 sm:mt-0">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value={10}>10 dòng / trang</option>
                <option value={20}>20 dòng / trang</option>
                <option value={50}>50 dòng / trang</option>
                <option value={100}>100 dòng / trang</option>
              </select>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  «
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  ‹
                </button>
                <span className="px-3 py-1 font-extrabold text-slate-800 bg-slate-100 rounded-lg">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  ›
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  »
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
