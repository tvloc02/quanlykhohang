import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Users,
  Building2,
  RefreshCw,
  ChevronDown,
  Check,
} from 'lucide-react';
import * as XLSX from 'xlsx';

export interface CustomerProfitItem {
  id: string;
  branch: string;
  stt: number;
  region: string;
  customerCode: string;
  customerName: string;
  revenue: number;
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

export default function CustomerProfitReportPage() {
  const [reportData, setReportData] = useState<CustomerProfitItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [isWarehouseDropdownOpen, setIsWarehouseDropdownOpen] = useState(false);
  const warehouseDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (warehouseDropdownRef.current && !warehouseDropdownRef.current.contains(event.target as Node)) {
        setIsWarehouseDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
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

  // Toast
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const fetchCustomerProfitReport = async () => {
    setLoading(true);
    try {
      const [outboundRes, customerRes] = await Promise.all([
        fetch(`${API_BASE_URL}/outbounds`, { headers: authHeaders() }).catch(() => null),
        fetch(`${API_BASE_URL}/customers`, { headers: authHeaders() }).catch(() => null),
      ]);

      let customersList: CustomerProfitItem[] = [];

      if (outboundRes && outboundRes.ok) {
        const outbounds = await outboundRes.json();
        if (Array.isArray(outbounds)) {
          const customerStats = new Map<
            string,
            { branch: string; code: string; name: string; region: string; revenue: number; totalCost: number }
          >();

          outbounds.forEach((order: any) => {
            const custName = order.customer || 'Khách lẻ';
            const branch = order.warehouseName || order.branch || 'Kho Tổng';
            const custCode = order.customerCode || 'KH_' + custName.slice(0, 4).toUpperCase();

            let lineRev = 0;
            let lineCost = 0;
            if (Array.isArray(order.details) && order.details.length > 0) {
              order.details.forEach((d: any) => {
                const qty = Number(d.requiredQty || d.quantity || 1);
                const price = Number(d.unitPrice || d.price || 500000);
                const cost = Number(d.importPrice || d.costPrice || price * 0.7);
                lineRev += qty * price;
                lineCost += qty * cost;
              });
            } else {
              lineRev = (order.items || 1) * 1000000;
              lineCost = lineRev * 0.7;
            }

            const existing = customerStats.get(custName);
            if (existing) {
              existing.revenue += lineRev;
              existing.totalCost += lineCost;
            } else {
              customerStats.set(custName, {
                branch,
                code: custCode,
                name: custName,
                region: 'Mặc định',
                revenue: lineRev,
                totalCost: lineCost,
              });
            }
          });

          let sttCounter = 1;
          customerStats.forEach((val) => {
            const profit = val.revenue - val.totalCost;
            const profitMargin = val.revenue > 0 ? (profit / val.revenue) * 100 : 0;

            customersList.push({
              id: `cust-profit-${sttCounter}`,
              branch: val.branch,
              stt: sttCounter++,
              region: val.region,
              customerCode: val.code,
              customerName: val.name,
              revenue: val.revenue,
              totalCost: Math.round(val.totalCost),
              profit: Math.round(profit),
              profitMargin: Math.round(profitMargin * 100) / 100,
            });
          });
        }
      }

      setReportData(customersList);
    } catch {
      // quiet fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerProfitReport();
  }, []);

  const branchOptions = useMemo(() => {
    const branches = Array.from(new Set(reportData.map((d) => d.branch)));
    return ['ALL', ...branches];
  }, [reportData]);

  const filteredData = useMemo(() => {
    return reportData.filter((item) => {
      const matchesBranch = selectedBranch === 'ALL' || item.branch === selectedBranch;
      const matchesSearch =
        !searchQuery ||
        item.customerCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.branch.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesBranch && matchesSearch;
    });
  }, [reportData, selectedBranch, searchQuery]);

  const groupedDataByBranch = useMemo(() => {
    const map = new Map<string, CustomerProfitItem[]>();
    filteredData.forEach((item) => {
      const list = map.get(item.branch) || [];
      list.push(item);
      map.set(item.branch, list);
    });
    return map;
  }, [filteredData]);

  // Totals calculations
  const totalRevenue = filteredData.reduce((sum, i) => sum + i.revenue, 0);
  const totalCostSum = filteredData.reduce((sum, i) => sum + i.totalCost, 0);
  const totalProfitSum = filteredData.reduce((sum, i) => sum + i.profit, 0);
  const overallMargin = totalRevenue > 0 ? (totalProfitSum / totalRevenue) * 100 : 0;

  const totalItems = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  const handleExportExcel = () => {
    const exportRows = filteredData.map((item, idx) => ({
      STT: idx + 1,
      'Chi Nhánh': item.branch,
      'Khu Vực': item.region,
      'Mã Khách Hàng': item.customerCode,
      'Tên Khách Hàng': item.customerName,
      'Doanh Thu (VND)': item.revenue,
      'Tổng Vốn (VND)': item.totalCost,
      'Lợi Nhuận (VND)': item.profit,
      '% Lợi Nhuận': `${item.profitMargin}%`,
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Loi_Nhuan_Khach_Hang');
    XLSX.writeFile(wb, `Bao_Cao_Loi_Nhuan_Khach_Hang_${new Date().toISOString().split('T')[0]}.xlsx`);
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

      {/* ═══ TOP HEADER - CYAN ONLY FOR TITLE BADGE ═══ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2.5 rounded-2xl bg-cyan-600 px-5 py-2.5 text-white shadow-md">
            <Users className="h-5 w-5" />
            <h1 className="text-xl font-extrabold tracking-tight uppercase">
              Báo cáo Lợi nhuận theo Khách hàng
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={fetchCustomerProfitReport}
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
        </div>
      </div>

      {/* ═══ FILTER & CONTROL TOOLBAR - CLEAN WHITE ═══ */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm text-xs font-bold">
        {/* Left Filters */}
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
                  {selectedBranch === 'ALL' ? 'Tất cả chi nhánh' : selectedBranch}
                </span>
                <ChevronDown className={`h-4 w-4 text-cyan-600 transition-transform duration-200 ${isWarehouseDropdownOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Custom Styled Menu với Bo góc tròn Rounded-2xl */}
            {isWarehouseDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-full min-w-[280px] rounded-2xl border-2 border-cyan-500 bg-white p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBranch('ALL');
                    setIsWarehouseDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-between cursor-pointer mb-1 ${
                    selectedBranch === 'ALL'
                      ? 'bg-cyan-600 text-white font-extrabold shadow-sm'
                      : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-800'
                  }`}
                >
                  <span>Tất cả chi nhánh</span>
                  {selectedBranch === 'ALL' && <Check className="h-4 w-4 text-white shrink-0" />}
                </button>

                {branchOptions.filter((b) => b !== 'ALL').map((br) => (
                  <button
                    key={br}
                    type="button"
                    onClick={() => {
                      setSelectedBranch(br);
                      setIsWarehouseDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-between cursor-pointer mb-1 ${
                      selectedBranch === br
                        ? 'bg-cyan-600 text-white font-extrabold shadow-sm'
                        : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-800'
                    }`}
                  >
                    <span>{br}</span>
                    {selectedBranch === br && <Check className="h-4 w-4 text-white shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 font-extrabold">Từ ngày:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-cyan-600 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 font-extrabold">Đến ngày:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-cyan-600 cursor-pointer"
            />
          </div>
        </div>

        {/* Right Search Input */}
        <div className="relative w-full lg:w-64">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm mã KH, tên KH..."
            className="h-9 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-xs font-bold text-slate-700 outline-none transition focus:border-cyan-600"
          />
        </div>
      </div>

      {/* ═══ TABLE DISPLAY - NEUTRAL SLATE / WHITE WITH CRISP GRID BORDERS ═══ */}
      <div className="overflow-hidden rounded-2xl border-2 border-slate-300 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-cyan-600 text-white sticky top-0 z-20 shadow-xs border-b-2 border-cyan-700">
              <tr className="text-xs font-extrabold uppercase tracking-tight">
                <th className="border-r border-cyan-500/50 px-3 py-3 text-center w-12 whitespace-nowrap">
                  NO.
                </th>
                <th className="border-r border-cyan-500/50 px-3 py-3 text-left w-28 whitespace-nowrap">
                  KHU VỰC
                </th>
                <th className="border-r border-cyan-500/50 px-3 py-3 text-left w-32 whitespace-nowrap">
                  MÃ KH
                </th>
                <th className="border-r border-cyan-500/50 px-4 py-3 text-left min-w-[200px]">
                  TÊN KHÁCH HÀNG
                </th>
                <th className="border-r border-cyan-500/50 px-4 py-3 text-right w-36 whitespace-nowrap">
                  DOANH THU
                </th>
                <th className="border-r border-cyan-500/50 px-4 py-3 text-right w-36 whitespace-nowrap">
                  TỔNG VỐN
                </th>
                <th className="border-r border-cyan-500/50 px-4 py-3 text-right w-36 whitespace-nowrap">
                  LỢI NHUẬN
                </th>
                <th className="px-4 py-3 text-right w-28 whitespace-nowrap">
                  % LỢI NHUẬN
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white text-xs text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-semibold">
                    Đang tính toán báo cáo lợi nhuận theo khách hàng...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-semibold">
                    Không tìm thấy dữ liệu khách hàng phù hợp.
                  </td>
                </tr>
              ) : (
                Array.from(groupedDataByBranch.entries()).map(([branchName, items]) => {
                  const branchRev = items.reduce((s, i) => s + i.revenue, 0);
                  const branchCost = items.reduce((s, i) => s + i.totalCost, 0);
                  const branchProf = items.reduce((s, i) => s + i.profit, 0);

                  return (
                    <React.Fragment key={branchName}>
                      {/* BRANCH SECTION HEADER */}
                      <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300 border-b border-slate-300">
                        <td colSpan={8} className="px-4 py-2.5 text-left font-black uppercase text-xs tracking-wider border-r border-slate-300">
                          <div className="flex items-center gap-2">
                            <ChevronDown size={16} className="text-slate-700" />
                            <Building2 size={16} className="text-cyan-700" />
                            <span>KHO: {branchName}</span>
                          </div>
                        </td>
                      </tr>

                      {/* BRANCH CUSTOMER ROWS */}
                      {items.map((item) => {
                        return (
                          <tr
                            key={item.id}
                            className="group border-b border-slate-200 transition hover:bg-slate-50"
                          >
                            <td className="border-r border-slate-300 px-3 py-3 text-center font-bold text-slate-500 text-sm">
                              {item.stt}
                            </td>
                            <td className="border-r border-slate-300 px-3 py-3 text-left font-bold text-slate-600 text-sm">
                              {item.region}
                            </td>
                            <td className="border-r border-slate-300 px-3 py-3 text-left font-bold text-slate-800 text-sm">
                              {item.customerCode}
                            </td>
                            <td className="border-r border-slate-300 px-4 py-3 text-left font-bold text-slate-900 text-sm">
                              {item.customerName}
                            </td>
                            <td className="border-r border-slate-300 px-4 py-3 text-right font-bold text-slate-800 text-sm">
                              {item.revenue.toLocaleString('vi-VN')}
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

                      {/* BRANCH SUB-TOTAL ROW */}
                      <tr className="bg-slate-100 font-extrabold text-slate-900 border-y-2 border-slate-300 text-sm">
                        <td colSpan={4} className="border-r border-slate-300 px-4 py-2.5 text-right text-xs uppercase font-black">
                          TỔNG CHI NHÁNH ({items.length} KH):
                        </td>
                        <td className="border-r border-slate-300 px-4 py-2.5 text-right font-bold text-slate-900 text-sm">
                          {branchRev.toLocaleString('vi-VN')}
                        </td>
                        <td className="border-r border-slate-300 px-4 py-2.5 text-right font-bold text-slate-900 text-sm">
                          {branchCost.toLocaleString('vi-VN')}
                        </td>
                        <td className="border-r border-slate-300 px-4 py-2.5 text-right font-bold text-slate-900 text-sm">
                          {branchProf.toLocaleString('vi-VN')}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900 text-sm">
                          -
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>

            {/* GRAND TOTAL ROW */}
            {filteredData.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-400 bg-slate-200/90 font-black text-slate-900 text-sm">
                  <td colSpan={4} className="border-r border-slate-300 p-3.5 text-right uppercase tracking-wider font-black text-xs text-slate-900">
                    TỔNG CỘNG TOÀN BỘ KHÁCH HÀNG:
                  </td>
                  <td className="border-r border-slate-300 p-3.5 text-right font-bold text-slate-900 text-sm">
                    {totalRevenue.toLocaleString('vi-VN')}
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
