import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Printer,
  FileSpreadsheet,
  RefreshCw,
  Search,
  FileText,
  Calendar,
  Settings,
  Maximize2,
  Minimize2,
  Building2,
  ChevronDown,
  Check,
} from 'lucide-react';
import { reportsApi } from '../api/reportsApi';
import { ReportPrintHeader } from '../components/ReportPrintHeader';
import { ReportPrintFooter } from '../components/ReportPrintFooter';

interface Props {
  title: string;
  description: string;
  reportType?: string;
  badgeColor?: string;
}

const fmt = (v: number) => new Intl.NumberFormat('vi-VN').format(v || 0);

export default function GenericReportPage({
  title,
  description,
  reportType = 'sales-detail',
  badgeColor = 'bg-cyan-600',
}: Props) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');
  const [data, setData] = useState<any>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Warehouse filter & popover dropdown state
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [isWarehouseDropdownOpen, setIsWarehouseDropdownOpen] = useState(false);
  const warehouseDropdownRef = useRef<HTMLDivElement>(null);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch('http://localhost:3000/api/warehouses', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
    })
      .then((res) => res.json())
      .then((wData) => {
        if (Array.isArray(wData)) {
          setWarehouses(wData.map((w: any) => ({ id: String(w.id || w.code), name: String(w.name || w.warehouseName) })));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (warehouseDropdownRef.current && !warehouseDropdownRef.current.contains(event.target as Node)) {
        setIsWarehouseDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reportsApi.getGenericReport(reportType, startDate, endDate);
      setData(res);
    } catch (err: any) {
      console.error('Lỗi tải báo cáo:', err);
      setError(err?.message || 'Không thể kết nối dữ liệu báo cáo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [reportType, startDate, endDate]);

  // Filtered & Flattened Rows
  const rows = useMemo(() => {
    if (!Array.isArray(data)) return [];

    let flatList: any[] = [];
    if (data.length > 0 && Array.isArray(data[0]?.items)) {
      data.forEach((group: any) => {
        const groupName = group.groupName || group.categoryName || 'Khác';
        (group.items || []).forEach((item: any) => {
          flatList.push({
            groupName,
            ...item,
          });
        });
      });
    } else {
      flatList = data;
    }

    if (reportType === 'customer-debt') {
      flatList = flatList.filter((item: any) => {
        const name = String(item.name || '').toLowerCase();
        return !name.includes('hết hạn') && !name.includes('tiêu hủy') && !name.includes('hư hỏng') && !name.includes('xuất hủy');
      });
    }

    if (selectedBranch !== 'ALL') {
      flatList = flatList.filter((item: any) => {
        const b = String(item.branch || item.warehouseName || item.branchName || '').toLowerCase();
        return b.includes(selectedBranch.toLowerCase());
      });
    }

    if (!search.trim()) return flatList;
    const q = search.trim().toLowerCase();
    return flatList.filter((item: any) =>
      Object.values(item).some((val) => {
        if (typeof val === 'object' && val !== null) {
          return JSON.stringify(val).toLowerCase().includes(q);
        }
        return String(val || '').toLowerCase().includes(q);
      })
    );
  }, [data, search, selectedBranch]);

  const handleExportExcel = () => {
    if (!Array.isArray(rows) || rows.length === 0) return;
    const sample = rows[0];
    const keys = Object.keys(sample).filter((k) => k !== 'id' && typeof sample[k] !== 'object');
    const header = ['STT', ...keys].join(',');
    const csvRows = rows.map((r, idx) =>
      [idx + 1, ...keys.map((k) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`)].join(',')
    );
    const csvContent = '\uFEFF' + [header, ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/\s+/g, '_')}_${startDate}_den_${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderCellValue = (key: string, val: any) => {
    if (val === null || val === undefined) return '-';
    if (key.toLowerCase().includes('date') || key === 'date') {
      if (typeof val === 'string' || typeof val === 'number' || val instanceof Date) {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          const pad = (n: number) => String(n).padStart(2, '0');
          const day = pad(d.getDate());
          const month = pad(d.getMonth() + 1);
          const year = d.getFullYear();
          const hours = pad(d.getHours());
          const mins = pad(d.getMinutes());
          const secs = pad(d.getSeconds());
          return `${day}/${month}/${year} ${hours}:${mins}:${secs}`;
        }
      }
    }
    if (typeof val === 'number') {
      if (
        key.toLowerCase().includes('qty') ||
        key.toLowerCase().includes('stock') ||
        key.toLowerCase().includes('orders') ||
        key.toLowerCase().includes('receipts') ||
        key.toLowerCase().includes('count')
      ) {
        return fmt(val);
      }
      return `${fmt(val)} đ`;
    }
    if (typeof val === 'boolean') {
      return val ? 'Có' : 'Không';
    }
    if (typeof val === 'object') {
      if (Array.isArray(val)) {
        return `${val.length} mục`;
      }
      return val.name || val.title || val.code || val.groupName || JSON.stringify(val);
    }
    return String(val);
  };

  const validKeys = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    return Object.keys(rows[0]).filter((k) => k !== 'id' && typeof rows[0][k] !== 'object');
  }, [rows]);

  const columnTotals = useMemo(() => {
    const sums: Record<string, number> = {};
    validKeys.forEach((key) => {
      let sum = 0;
      let hasNum = false;
      rows.forEach((r) => {
        if (typeof r[key] === 'number') {
          sum += r[key];
          hasNum = true;
        }
      });
      if (hasNum) {
        sums[key] = sum;
      }
    });
    return sums;
  }, [validKeys, rows]);

  return (
    <>
      {/* ─── HEADER BÁO CÁO KHI IN ─── */}
      <ReportPrintHeader
        title={title.toUpperCase()}
        subtitle={
          startDate && endDate
            ? `Kỳ báo cáo: Từ ngày ${startDate} đến ngày ${endDate}`
            : `Ngày lập: ${new Date().toLocaleDateString('vi-VN')}`
        }
        subInfo={`Kho: ${selectedBranch === 'ALL' ? 'Tất cả chi nhánh' : selectedBranch} | Tổng số dòng: ${rows.length} dòng`}
      />

      <div className={`space-y-4 pb-12 animate-in fade-in duration-200 ${isFullScreen ? 'fixed inset-0 z-[9000] bg-white overflow-y-auto p-6' : ''}`}>
        {/* ═══ HEADER TITLE - GOLD CYAN BADGE & MATCHED ACTION BUTTONS ═══ */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2.5 rounded-2xl bg-cyan-600 px-5 py-2.5 text-white shadow-md">
            <FileText className="h-5 w-5 text-white" />
            <h1 className="text-xl font-extrabold tracking-tight uppercase">{title}</h1>
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
            onClick={toggleBrowserFullscreen}
            className="inline-flex items-center justify-center h-10 w-10 rounded-xl border-2 border-cyan-700 bg-white text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            title="Toàn màn hình"
          >
            {isFullScreen ? <Minimize2 className="h-4.5 w-4.5 text-cyan-700" /> : <Maximize2 className="h-4.5 w-4.5 text-cyan-700" />}
          </button>
        </div>
      </div>

      {/* ═══ FILTER CONTROL PANEL WITH CUSTOM STYLED WAREHOUSE DROPDOWN ═══ */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm space-y-3 print:hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm báo cáo..."
              className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-4 text-xs sm:text-sm font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-2xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Custom Styled Warehouse Selection Component */}
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
                    {selectedBranch === 'ALL' ? 'Tất cả chi nhánh' : warehouses.find((w) => w.id === selectedBranch || w.name === selectedBranch)?.name || selectedBranch}
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

                  {warehouses.length > 0 ? (
                    warehouses.map((wh) => (
                      <button
                        key={wh.id}
                        type="button"
                        onClick={() => {
                          setSelectedBranch(wh.name);
                          setIsWarehouseDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-between cursor-pointer mb-1 ${
                          selectedBranch === wh.name
                            ? 'bg-cyan-600 text-white font-extrabold shadow-sm'
                            : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-800'
                        }`}
                      >
                        <span>{wh.name}</span>
                        {selectedBranch === wh.name && <Check className="h-4 w-4 text-white shrink-0" />}
                      </button>
                    ))
                  ) : (
                    ['Kho Chi Nhánh HCM', 'Kho Thanh Trì', 'Kho Hà Đông'].map((bName) => (
                      <button
                        key={bName}
                        type="button"
                        onClick={() => {
                          setSelectedBranch(bName);
                          setIsWarehouseDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-between cursor-pointer mb-1 ${
                          selectedBranch === bName
                            ? 'bg-cyan-600 text-white font-extrabold shadow-sm'
                            : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-800'
                        }`}
                      >
                        <span>{bName}</span>
                        {selectedBranch === bName && <Check className="h-4 w-4 text-white shrink-0" />}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="inline-flex h-12 items-center gap-3 rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 shadow-2xs">
              <div className="flex items-center gap-2">
                <Calendar className="h-4.5 w-4.5 text-slate-600 shrink-0" />
                <span className="text-xs sm:text-sm font-extrabold uppercase text-slate-800 tracking-wide">Thời gian:</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-600">Từ</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none focus:border-cyan-600 transition cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-600">Đến</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none focus:border-cyan-600 transition cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ REPORT CONTENT TABLE / DATA DISPLAY ═══ */}
      <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-sm font-bold text-slate-500">
            <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-slate-600" />
            Đang truy vấn dữ liệu từ CSDL...
          </div>
        ) : error ? (
          <div className="py-12 text-center text-sm font-bold text-rose-600">{error}</div>
        ) : reportType === 'fund-balance' && data && typeof data === 'object' && !Array.isArray(data) ? (
          /* Fund Balance Special Summary View */
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-500">Tồn quỹ đầu kỳ</p>
                <p className="text-xl font-black text-slate-800">{fmt(data.openingBalance)} đ</p>
              </div>
              <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-bold text-emerald-700">Tổng thu (Bán hàng)</p>
                <p className="text-xl font-black text-emerald-700">+{fmt(data.totalIncome)} đ</p>
              </div>
              <div className="rounded-xl border-2 border-rose-200 bg-rose-50 p-4">
                <p className="text-xs font-bold text-rose-700">Tổng chi (Nhập hàng)</p>
                <p className="text-xl font-black text-rose-700">-{fmt(data.totalExpense)} đ</p>
              </div>
              <div className="rounded-xl border-2 border-slate-300 bg-slate-100 p-4">
                <p className="text-xs font-bold text-slate-800">Tồn quỹ cuối kỳ</p>
                <p className="text-xl font-black text-slate-900">{fmt(data.closingBalance)} đ</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="text-xs font-black uppercase text-slate-700 mb-3">Phân bổ tồn quỹ</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                  <span className="text-sm font-bold text-slate-600">Tiền mặt tại quỹ:</span>
                  <span className="text-base font-black text-slate-900">{fmt(data.cashBalance)} đ</span>
                </div>
                <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                  <span className="text-sm font-bold text-slate-600">Tiền gửi ngân hàng:</span>
                  <span className="text-base font-black text-slate-900">{fmt(data.bankBalance)} đ</span>
                </div>
              </div>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm font-bold text-slate-500">
            Không tìm thấy bản ghi dữ liệu báo cáo nào trong CSDL cho kỳ này
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-cyan-600 text-white font-extrabold uppercase border-b-2 border-cyan-700 sticky top-0 z-10">
                <tr>
                  <th className="w-14 px-4 py-4 text-center border-r border-cyan-500/50 text-sm tracking-wider">STT</th>
                  {validKeys.map((key) => (
                    <th key={key} className="px-4 py-4 text-center border-r border-cyan-500/50 capitalize whitespace-nowrap text-sm tracking-wider">
                      {key === 'groupName' ? 'Nhóm sản phẩm' :
                       key === 'orderNo' ? 'Mã phiếu' :
                       key === 'customerName' ? 'Bên mua' :
                       key === 'code' ? 'Mã đối tượng' :
                       key === 'name' ? 'Tên đối tượng' :
                       key === 'phone' ? 'Điện thoại' :
                       key === 'address' ? 'Địa chỉ' :
                       key === 'totalOrders' ? 'Số đơn xuất' :
                       key === 'totalReceipts' ? 'Số đơn nhập' :
                       key === 'totalRevenue' ? 'Doanh thu' :
                       key === 'paidAmount' ? 'Đã thanh toán' :
                       key === 'debtAmount' ? 'Còn nợ' :
                       key === 'totalAmount' ? 'Tổng tiền' :
                       key === 'date' ? 'Ngày giao dịch' :
                       key === 'type' ? 'Loại GD' :
                       key === 'partner' ? 'Đối tác' :
                       key === 'description' ? 'Ghi chú' :
                       key === 'amount' ? 'Số tiền' :
                       key === 'productSku' || key === 'sku' ? 'Mã sản phẩm' :
                       key === 'productName' ? 'Tên sản phẩm' :
                       key === 'unit' ? 'ĐVT' :
                       key === 'initialStock' ? 'Tồn đầu kỳ' :
                       key === 'importQty' ? 'Nhập kỳ' :
                       key === 'exportQty' ? 'Xuất kỳ' :
                       key === 'finalStock' ? 'Tồn cuối kỳ' :
                       key === 'qty' ? 'Số lượng' :
                       key === 'price' ? 'Đơn giá' :
                       key === 'salesOrderCount' ? 'Số đơn' :
                       key === 'revenue' ? 'Doanh thu' :
                       key === 'discount' ? 'Chiết khấu' :
                       key === 'netRevenue' ? 'Doanh thu thuần' :
                       key === 'staffName' ? 'Nhân viên' : key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white font-medium text-slate-700 text-sm">
                {rows.map((row: any, idx: number) => (
                  <tr key={row.id || idx} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3.5 text-center border-r border-slate-200 font-bold text-slate-500">
                      {idx + 1}
                    </td>
                    {validKeys.map((key, colIdx) => {
                      const val = row[key];
                      const isNum = typeof val === 'number';
                      const isLast3 = colIdx >= validKeys.length - 3;
                      const isCenterCol = (reportType === 'sales-detail' && !isLast3) || key === 'type' || key === 'date' || key === 'code';
                      return (
                        <td
                          key={key}
                          className={`px-4 py-3.5 border-r border-slate-200 whitespace-nowrap ${
                            isCenterCol
                              ? 'text-center'
                              : isNum
                              ? 'text-right font-bold text-slate-900'
                              : 'text-left'
                          }`}
                        >
                          {key === 'type' ? (
                            val === 'THU' ? (
                              <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xs shadow-2xs">
                                THU
                              </span>
                            ) : val === 'CHI' ? (
                              <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-rose-100 text-rose-800 font-extrabold text-xs shadow-2xs">
                                CHI
                              </span>
                            ) : (
                              String(val)
                            )
                          ) : (
                            renderCellValue(key, val)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-extrabold text-slate-900 border-t-2 border-slate-300 sticky bottom-0 z-10 text-sm">
                <tr>
                  <td className="px-4 py-4 text-center font-black uppercase tracking-wider border-r border-slate-300 bg-slate-200/80">
                    -
                  </td>
                  {validKeys.map((key, colIdx) => {
                    const hasSum = typeof columnTotals[key] === 'number';
                    const isLast3 = colIdx >= validKeys.length - 3;
                    const isCenterCol = (reportType === 'sales-detail' && !isLast3) || key === 'type' || key === 'date' || key === 'code';
                    return (
                      <td
                        key={key}
                        className={`px-4 py-4 border-r border-slate-300 whitespace-nowrap ${
                          hasSum
                            ? 'text-right font-black text-cyan-950 bg-cyan-100/60'
                            : isCenterCol
                            ? 'text-center font-black text-slate-800'
                            : 'text-left font-black text-slate-800'
                        }`}
                      >
                        {hasSum ? renderCellValue(key, columnTotals[key]) : colIdx === 0 ? 'TỔNG CỘNG' : ''}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      </div>

      {/* ─── CHỮ KÝ BÁO CÁO KHI IN ─── */}
      <ReportPrintFooter />
    </>
  );
}
