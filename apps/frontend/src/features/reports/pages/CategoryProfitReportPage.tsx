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
  Filter,
  CheckCircle,
  FolderTree,
  Building2,
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

  // Filters matching screenshot 3
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination states matching Personnel.tsx
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Toast
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Fetch categories, products, outbounds
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
          // Aggregate by product and branch
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

  // Group by Branch matching screenshot 3
  const groupedDataByBranch = useMemo(() => {
    const map = new Map<string, CategoryProfitItem[]>();
    filteredData.forEach((item) => {
      const list = map.get(item.branch) || [];
      list.push(item);
      map.set(item.branch, list);
    });
    return map;
  }, [filteredData]);

  // Totals calculations
  const totalExportQty = filteredData.reduce((sum, i) => sum + i.exportQty, 0);
  const totalRevenue = filteredData.reduce((sum, i) => sum + i.revenue, 0);
  const totalCostSum = filteredData.reduce((sum, i) => sum + i.totalCost, 0);
  const totalProfitSum = filteredData.reduce((sum, i) => sum + i.profit, 0);
  const overallMargin = totalRevenue > 0 ? (totalProfitSum / totalRevenue) * 100 : 0;

  // Pagination calculations matching Personnel.tsx
  const totalItems = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  const handleExportExcel = () => {
    const exportRows = filteredData.map((item, idx) => ({
      STT: idx + 1,
      'Chi Nhánh': item.branch,
      'Nhóm Hàng': item.categoryName,
      'Mã Sản Phẩm': item.productCode,
      'Tên Sản Phẩm': item.productName,
      'Số Xuất': item.exportQty,
      'Giá Xuất (VND)': item.exportPrice,
      'Doanh Thu (VND)': item.revenue,
      'Giá Nhập (VND)': item.importPrice,
      'Tổng Vốn (VND)': item.totalCost,
      'Lợi Nhuận (VND)': item.profit,
      '% Lợi Nhuận': `${item.profitMargin}%`,
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Loi_Nhuan_Nhom_Hang');
    XLSX.writeFile(wb, `Bao_Cao_Loi_Nhuan_Nhom_Hang_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Đã xuất báo cáo Excel thành công!');
  };

  return (
    <div className="space-y-6 pb-12 text-slate-800">
      {/* TOAST NOTIFICATION MATCHING PERSONNEL.TSX */}
      {toastMessage &&
        createPortal(
          <div className="fixed top-6 right-6 z-[9999] flex items-center gap-3 rounded-2xl bg-emerald-50/95 text-emerald-800 border border-emerald-200 px-5 py-3.5 shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <p className="text-sm font-extrabold">{toastMessage}</p>
          </div>,
          document.body
        )}

      {/* HEADER MATCHING PERSONNEL.TSX PILL BADGE DESIGN */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2.5 rounded-2xl bg-cyan-600 px-5 py-2.5 text-white shadow-md">
            <FolderTree className="h-5 w-5" />
            <h1 className="text-xl font-extrabold tracking-tight uppercase">
              Báo cáo Lợi nhuận theo Nhóm hàng
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-fuchsia-600 px-4 py-2 text-xs font-black text-white shadow-md transition hover:bg-fuchsia-700 active:scale-95 cursor-pointer uppercase"
          >
            <Printer size={15} />
            Print
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-md transition hover:bg-emerald-700 active:scale-95 cursor-pointer uppercase"
          >
            <FileSpreadsheet size={15} />
            Excel
          </button>
        </div>
      </div>

      {/* 3 STAT OVERVIEW CARDS MATCHING PERSONNEL.TSX */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex h-[72px] items-center justify-between rounded-xl border-2 border-cyan-500 bg-white px-5 shadow-sm transition hover:bg-cyan-50">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">TỔNG DOANH THU NHÓM HÀNG</p>
            <p className="text-lg font-black text-cyan-700">{totalRevenue.toLocaleString('vi-VN')} đ</p>
          </div>
          <div className="rounded-xl bg-cyan-100 p-2 text-cyan-700">
            <DollarSign size={22} />
          </div>
        </div>

        <div className="flex h-[72px] items-center justify-between rounded-xl border-2 border-cyan-500 bg-white px-5 shadow-sm transition hover:bg-cyan-50">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">TỔNG VỐN NHẬP NHÓM HÀNG</p>
            <p className="text-lg font-black text-slate-700">{totalCostSum.toLocaleString('vi-VN')} đ</p>
          </div>
          <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
            <BarChart3 size={22} />
          </div>
        </div>

        <div className="flex h-[72px] items-center justify-between rounded-xl border-2 border-cyan-500 bg-white px-5 shadow-sm transition hover:bg-cyan-50">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">TỔNG LỢI NHUẬN NHÓM HÀNG</p>
            <p className={`text-lg font-black ${totalProfitSum >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {totalProfitSum.toLocaleString('vi-VN')} đ ({overallMargin.toFixed(1)}%)
            </p>
          </div>
          <div className={`rounded-xl p-2 ${totalProfitSum >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            <TrendingUp size={22} />
          </div>
        </div>
      </div>

      {/* FILTER & CONTROL TOOLBAR MATCHING SCREENSHOT 3 & PERSONNEL.TSX */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm text-xs font-bold">
        {/* Left Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 font-extrabold">Nhóm:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-xl border-2 border-cyan-500 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10 cursor-pointer min-w-[150px]"
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
            <span className="text-slate-600 font-extrabold">Kho:</span>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="rounded-xl border-2 border-cyan-500 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10 cursor-pointer min-w-[140px]"
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
            <span className="text-slate-600 font-extrabold">Từ ngày:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-xl border-2 border-cyan-500 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 font-extrabold">Đến ngày:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-xl border-2 border-cyan-500 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none"
            />
          </div>

          <button
            onClick={fetchCategoryProfitReport}
            className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-white shadow-sm hover:bg-cyan-700 transition cursor-pointer font-black"
          >
            <Filter size={14} />
            Xem báo cáo
          </button>
        </div>

        {/* Right Search Input */}
        <div className="relative w-full lg:w-64">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm mã SP, tên SP, nhóm..."
            className="h-9 w-full rounded-xl border-2 border-cyan-500 bg-white pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none transition focus:ring-4 focus:ring-cyan-500/10"
          />
        </div>
      </div>

      {/* PERSONNEL HIGH-DENSITY TABLE MATCHING PERSONNEL.TSX & SCREENSHOT 3 */}
      <div className="overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-cyan-50 sticky top-0 z-20 shadow-sm">
              <tr className="border-b-2 border-slate-200">
                <th className="border-r border-slate-200 px-3 py-4 text-center text-xs font-extrabold uppercase text-slate-800 w-14 whitespace-nowrap">
                  No.
                </th>
                <th className="border-r border-slate-200 px-4 py-4 text-center text-xs font-extrabold uppercase text-slate-800 min-w-[120px] whitespace-nowrap">
                  Mã
                </th>
                <th className="border-r border-slate-200 px-4 py-4 text-center text-xs font-extrabold uppercase text-slate-800 min-w-[200px] whitespace-nowrap">
                  Tên
                </th>
                <th className="border-r border-slate-200 px-3 py-4 text-right text-xs font-extrabold uppercase text-slate-800 w-24 whitespace-nowrap">
                  Số xuất
                </th>
                <th className="border-r border-slate-200 px-4 py-4 text-right text-xs font-extrabold uppercase text-slate-800 min-w-[130px] whitespace-nowrap">
                  Giá xuất
                </th>
                <th className="border-r border-slate-200 px-4 py-4 text-right text-xs font-extrabold uppercase text-slate-800 min-w-[140px] whitespace-nowrap">
                  Doanh thu
                </th>
                <th className="border-r border-slate-200 px-4 py-4 text-right text-xs font-extrabold uppercase text-slate-800 min-w-[130px] whitespace-nowrap">
                  Giá nhập
                </th>
                <th className="border-r border-slate-200 px-4 py-4 text-right text-xs font-extrabold uppercase text-slate-800 min-w-[140px] whitespace-nowrap">
                  Tổng vốn
                </th>
                <th className="border-r border-slate-200 px-4 py-4 text-right text-xs font-extrabold uppercase text-slate-800 min-w-[140px] whitespace-nowrap">
                  Lợi nhuận
                </th>
                <th className="px-4 py-4 text-right text-xs font-extrabold uppercase text-slate-800 w-32 whitespace-nowrap">
                  % Lợi nhuận
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white text-xs font-semibold text-slate-800">
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
                      {/* BRANCH SECTION HEADER MATCHING SCREENSHOT 3 */}
                      <tr className="bg-slate-100/90 font-black text-cyan-900 border-t-2 border-slate-300">
                        <td colSpan={10} className="px-4 py-2.5 font-black uppercase text-xs tracking-wider flex items-center gap-2">
                          <Building2 size={15} className="text-cyan-600" />
                          ▲ Kho: {branchName}
                        </td>
                      </tr>

                      {/* BRANCH CATEGORY PRODUCT ROWS */}
                      {items.map((item, idx) => {
                        const isNegative = item.profit < 0;
                        return (
                          <tr
                            key={item.id}
                            className={`group border-b border-slate-200 transition hover:bg-cyan-50/50 ${
                              idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                            }`}
                          >
                            <td className="border-r border-slate-200 px-3 py-3 text-center font-bold text-slate-500">
                              {item.stt}
                            </td>
                            <td className="border-r border-slate-200 px-4 py-3 text-center font-mono font-bold text-cyan-700">
                              {item.productCode}
                            </td>
                            <td className="border-r border-slate-200 px-4 py-3 font-bold text-slate-900">
                              {item.productName}
                            </td>
                            <td className="border-r border-slate-200 px-3 py-3 text-right font-mono font-bold text-slate-800">
                              {item.exportQty}
                            </td>
                            <td className="border-r border-slate-200 px-4 py-3 text-right font-mono font-semibold text-slate-700">
                              {item.exportPrice.toLocaleString('vi-VN')}
                            </td>
                            <td className="border-r border-slate-200 px-4 py-3 text-right font-mono font-bold text-slate-900">
                              {item.revenue.toLocaleString('vi-VN')}
                            </td>
                            <td className="border-r border-slate-200 px-4 py-3 text-right font-mono font-semibold text-slate-600">
                              {item.importPrice.toLocaleString('vi-VN')}
                            </td>
                            <td className="border-r border-slate-200 px-4 py-3 text-right font-mono font-bold text-slate-700">
                              {item.totalCost.toLocaleString('vi-VN')}
                            </td>
                            <td
                              className={`border-r border-slate-200 px-4 py-3 text-right font-mono font-black ${
                                isNegative ? 'text-red-600' : 'text-emerald-600'
                              }`}
                            >
                              {item.profit.toLocaleString('vi-VN')}
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-mono font-black ${
                                isNegative ? 'text-red-600' : 'text-emerald-600'
                              }`}
                            >
                              {item.profitMargin.toFixed(2)}%
                            </td>
                          </tr>
                        );
                      })}

                      {/* BRANCH SUB-TOTAL ROW MATCHING SCREENSHOT 3 */}
                      <tr className="bg-slate-100 font-bold text-slate-900 border-b-2 border-slate-300">
                        <td colSpan={3} className="px-4 py-2 text-right text-xs uppercase font-extrabold">
                          Tổng chi nhánh ({items.length} mục):
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-black text-cyan-800">
                          {branchQty.toLocaleString('vi-VN')}
                        </td>
                        <td className="px-4 py-2"></td>
                        <td className="px-4 py-2 text-right font-mono font-black text-slate-900">
                          {branchRev.toLocaleString('vi-VN')}
                        </td>
                        <td className="px-4 py-2"></td>
                        <td className="px-4 py-2 text-right font-mono font-black text-slate-800">
                          {branchCost.toLocaleString('vi-VN')}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-mono font-black ${
                            branchProf >= 0 ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {branchProf.toLocaleString('vi-VN')}
                        </td>
                        <td className="px-4 py-2"></td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>

            {/* GRAND TOTAL ROW MATCHING SCREENSHOT 3 */}
            {filteredData.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-400 bg-cyan-100/60 font-black text-slate-900 text-xs">
                  <td colSpan={3} className="p-3.5 text-right uppercase tracking-wider text-cyan-950 font-black">
                    TỔNG CỘNG TOÀN BỘ NHÓM HÀNG:
                  </td>
                  <td className="p-3.5 text-right font-mono font-black text-cyan-900 text-sm">
                    {totalExportQty.toLocaleString('vi-VN')}
                  </td>
                  <td className="p-3.5"></td>
                  <td className="p-3.5 text-right font-mono font-black text-slate-900 text-sm">
                    {totalRevenue.toLocaleString('vi-VN')}
                  </td>
                  <td className="p-3.5"></td>
                  <td className="p-3.5 text-right font-mono font-black text-slate-800 text-sm">
                    {totalCostSum.toLocaleString('vi-VN')}
                  </td>
                  <td
                    className={`p-3.5 text-right font-mono font-black text-sm ${
                      totalProfitSum >= 0 ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {totalProfitSum.toLocaleString('vi-VN')}
                  </td>
                  <td
                    className={`p-3.5 text-right font-mono font-black text-sm ${
                      overallMargin >= 0 ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {overallMargin.toFixed(2)}%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* PAGINATION FOOTER ATTACHED MATCHING PERSONNEL.TSX */}
        {totalItems > 0 && (
          <div className="flex flex-col items-center justify-between border-t-2 border-slate-200 bg-slate-50/50 px-6 py-3 sm:flex-row">
            <div className="text-sm font-semibold text-slate-600">
              Tổng số: <b>{totalItems}</b> <span className="ml-2">Hiển thị {startIndex} - {endIndex}</span>
            </div>
            <div className="mt-4 flex items-center gap-2 sm:mt-0">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-9 rounded-xl border-2 border-cyan-500 bg-white px-2 text-sm font-bold text-slate-700 outline-none"
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
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                >
                  «
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                >
                  ‹
                </button>
                <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-sm font-bold text-white">
                  {currentPage}
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                >
                  ›
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
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
