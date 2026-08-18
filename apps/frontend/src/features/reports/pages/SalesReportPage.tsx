import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Printer,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Calendar,
  Filter,
  Eye,
  Settings,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  SlidersHorizontal,
  UserCheck,
  Users,
  Building2,
} from 'lucide-react';
import { reportsApi } from '../api/reportsApi';

const API_BASE_URL = 'http://localhost:3000/api';

const fmt = (v: number) => new Intl.NumberFormat('vi-VN').format(Math.round(v || 0));

function authHeaders() {
  const token = localStorage.getItem('token');
  return {
    Authorization: token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json',
  };
}

function getInitialDates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const firstDay = `${year}-${month}-01`;
  const today = `${year}-${month}-${day}`;
  return { firstDay, today };
}

interface SalesGroupItem {
  id: string;
  dateOrName: string;
  salesOrderCount: number;
  revenue: number;
  discount: number;
  vatAmount: number;
  returnOrderCount: number;
  returnAmount: number;
  netRevenue: number;
  orders: any[];
}

export default function SalesReportPage() {
  const { firstDay, today } = useMemo(() => getInitialDates(), []);
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(today);
  const [groupBy, setGroupBy] = useState<'day' | 'month' | 'year' | 'staff' | 'customer' | 'branch' | 'chart'>('day');
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState<SalesGroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination states matching Outbound
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Fullscreen state
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Column settings modal & detail modal
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [selectedGroupDetail, setSelectedGroupDetail] = useState<SalesGroupItem | null>(null);

  // Column visibility state
  const [columnVis, setColumnVis] = useState({
    groupName: true,
    ordersCount: true,
    revenue: true,
    discount: true,
    vat: true,
    returnAmount: true,
    netRevenue: true,
  });

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

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch live Outbound Orders for full accuracy
      let liveOutbounds: any[] = [];
      try {
        const obRes = await fetch(`${API_BASE_URL}/outbounds`, { headers: authHeaders() });
        if (obRes.ok) {
          const raw = await obRes.json();
          liveOutbounds = Array.isArray(raw) ? raw : raw.data || [];
        }
      } catch (err) {
        console.warn('Could not fetch live outbounds directly:', err);
      }

      // 2. Fetch report API summary
      let apiSummary: any[] = [];
      try {
        const res = await reportsApi.getSalesReport(startDate, endDate, groupBy);
        apiSummary = Array.isArray(res) ? res : [];
      } catch (err) {
        console.warn('Reports API fallback triggered');
      }

      // 3. Process live Outbounds if available
      if (liveOutbounds.length > 0) {
        const startTimestamp = startDate ? new Date(`${startDate}T00:00:00`).getTime() : 0;
        const endTimestamp = endDate ? new Date(`${endDate}T23:59:59`).getTime() : Date.now();

        const filtered = liveOutbounds.filter((o) => {
          if (o.status === 'Đã hủy' || o.orderType === 'disposal') return false;
          const orderDateStr = o.orderDate || o.createdAt;
          if (!orderDateStr) return true;
          const t = new Date(orderDateStr).getTime();
          return t >= startTimestamp && t <= endTimestamp;
        });

        const groupMap = new Map<string, SalesGroupItem>();

        filtered.forEach((o) => {
          let groupKey = '';
          const rawDateStr = (o.orderDate || o.createdAt || '').split('T')[0];

          if (groupBy === 'day' || groupBy === 'chart') {
            groupKey = rawDateStr || 'Không xác định';
          } else if (groupBy === 'month') {
            groupKey = rawDateStr ? rawDateStr.substring(0, 7) : 'Không xác định';
          } else if (groupBy === 'year') {
            groupKey = rawDateStr ? rawDateStr.substring(0, 4) : 'Không xác định';
          } else if (groupBy === 'staff') {
            groupKey = o.employeeName || o.creatorName || o.createdByName || 'NV Chưa rõ';
          } else if (groupBy === 'customer') {
            groupKey = o.customerName || o.customer?.name || 'Khách lẻ / vãng lai';
          } else if (groupBy === 'branch') {
            groupKey = o.branchCode || o.warehouseCode || 'Kho Tổng';
          }

          const existing = groupMap.get(groupKey) || {
            id: groupKey,
            dateOrName: groupKey,
            salesOrderCount: 0,
            revenue: 0,
            discount: 0,
            vatAmount: 0,
            returnOrderCount: 0,
            returnAmount: 0,
            netRevenue: 0,
            orders: [],
          };

          const isReturn = o.orderType === 'return_customer' || o.orderType === 'return';
          const subtotal = Number(o.subtotal || o.totalAmount || 0);
          const disc = Number(o.discount || 0);
          const vat = Number(o.vatAmount || 0);
          const total = Number(o.totalAmount || subtotal - disc + vat);

          if (isReturn) {
            existing.returnOrderCount += 1;
            existing.returnAmount += total;
          } else {
            existing.salesOrderCount += 1;
            existing.revenue += subtotal;
            existing.discount += disc;
            existing.vatAmount += vat;
            existing.netRevenue += total;
          }

          existing.orders.push(o);
          groupMap.set(groupKey, existing);
        });

        const items = Array.from(groupMap.values());
        if (groupBy === 'day' || groupBy === 'month' || groupBy === 'year') {
          items.sort((a, b) => b.dateOrName.localeCompare(a.dateOrName));
        } else {
          items.sort((a, b) => b.netRevenue - a.netRevenue);
        }

        setData(items);
      } else if (apiSummary.length > 0) {
        setData(
          apiSummary.map((item: any, idx: number) => ({
            id: String(idx + 1),
            dateOrName: item.dateOrName || item.groupName || item.date || `Nhóm ${idx + 1}`,
            salesOrderCount: Number(item.salesOrderCount || item.ordersCount || 0),
            revenue: Number(item.revenue || 0),
            discount: Number(item.discount || 0),
            vatAmount: Number(item.vatAmount || 0),
            returnOrderCount: Number(item.returnOrderCount || 0),
            returnAmount: Number(item.returnAmount || 0),
            netRevenue: Number(item.netRevenue || (item.revenue || 0) - (item.discount || 0)),
            orders: [],
          }))
        );
      } else {
        setData([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Không thể kết nối dữ liệu báo cáo bán hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate, groupBy]);

  // Filtered dataset for search
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter((item) => item.dateOrName.toLowerCase().includes(term));
  }, [data, searchTerm]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // Totals calculations
  const totals = useMemo(() => {
    return filteredData.reduce(
      (acc, item) => ({
        orders: acc.orders + (item.salesOrderCount || 0),
        revenue: acc.revenue + (item.revenue || 0),
        discount: acc.discount + (item.discount || 0),
        vatAmount: acc.vatAmount + (item.vatAmount || 0),
        returnOrders: acc.returnOrders + (item.returnOrderCount || 0),
        returnAmount: acc.returnAmount + (item.returnAmount || 0),
        netRevenue: acc.netRevenue + (item.netRevenue || 0),
      }),
      { orders: 0, revenue: 0, discount: 0, vatAmount: 0, returnOrders: 0, returnAmount: 0, netRevenue: 0 }
    );
  }, [filteredData]);

  const maxNetRevenue = useMemo(() => Math.max(...data.map((d) => d.netRevenue), 1), [data]);

  const handleExportExcel = () => {
    if (filteredData.length === 0) return;
    const headers = ['STT', 'Tiêu chí / Nhóm', 'Số đơn bán', 'Tổng tiền hàng', 'Chiết khấu', 'Thuế VAT', 'Tiền hàng trả', 'Doanh thu thuần'];
    const rows = filteredData.map((row, idx) => [
      idx + 1,
      `"${(row.dateOrName || '').replace(/"/g, '""')}"`,
      row.salesOrderCount || 0,
      row.revenue || 0,
      row.discount || 0,
      row.vatAmount || 0,
      row.returnAmount || 0,
      row.netRevenue || 0,
    ]);
    const summaryRow = ['Tổng cộng', '', totals.orders, totals.revenue, totals.discount, totals.vatAmount, totals.returnAmount, totals.netRevenue];
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(',')), summaryRow.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Bao_Cao_Ban_Hang_${startDate}_den_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* ═══ TOP HEADER SECTION matching Outbound Orders Header ═══ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left Badge Title */}
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2.5 rounded-2xl bg-cyan-600 px-5 py-2.5 text-white shadow-md">
            <BarChart3 className="h-5 w-5" />
            <h1 className="text-xl font-extrabold tracking-tight uppercase">BÁO CÁO BÁN HÀNG TỔNG HỢP</h1>
          </div>
        </div>

        {/* Right Action Buttons matching Outbound Orders Header buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Làm mới */}
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-4.5 w-4.5 text-cyan-700 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>

          {/* In báo cáo */}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
          >
            <Printer className="h-4.5 w-4.5 text-cyan-700" />
            In báo cáo
          </button>

          {/* Export Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
          >
            <FileSpreadsheet className="h-4.5 w-4.5 text-cyan-700" />
            Export Excel
          </button>

          {/* Hiển thị */}
          <button
            type="button"
            onClick={() => setShowColumnSettings(true)}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border-2 border-cyan-700 bg-white text-cyan-700 font-extrabold text-sm shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            title="Cấu hình hiển thị cột"
          >
            <Settings className="h-4.5 w-4.5 text-cyan-700" />
            <span>Hiển thị</span>
          </button>

          {/* Toàn màn hình */}
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

      {/* ═══ FILTER & SEARCH PANEL ═══ */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Live Search input */}
          <div className="relative flex-1 min-w-[300px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-cyan-600" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="h-12 w-full rounded-xl border-2 border-cyan-600/40 bg-white pl-11 pr-4 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-2xs"
              placeholder="Tìm theo mã nhóm, tên nhân viên, khách hàng, kho..."
            />
          </div>

          {/* Date Filter Box */}
          <div className="inline-flex h-12 items-center gap-3 rounded-xl border-2 border-cyan-600/30 bg-slate-50/80 px-3.5 shadow-2xs">
            <div className="flex items-center gap-2">
              <Calendar className="h-4.5 w-4.5 text-cyan-600 shrink-0" />
              <span className="text-xs font-extrabold uppercase text-cyan-950 tracking-wide">Thời gian:</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-600">Từ</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 rounded-lg border-2 border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-600">Đến</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 rounded-lg border-2 border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* ═══ INTERACTIVE PROMINENT GROUP-BY TABS ═══ */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-cyan-600" />
            <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wide">Xem báo cáo theo:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'day', label: 'Theo Ngày', icon: Calendar },
              { id: 'month', label: 'Theo Tháng', icon: Calendar },
              { id: 'year', label: 'Theo Năm', icon: Calendar },
              { id: 'staff', label: 'Theo Nhân viên', icon: UserCheck },
              { id: 'customer', label: 'Theo Khách hàng', icon: Users },
              { id: 'branch', label: 'Theo Kho', icon: Building2 },
              { id: 'chart', label: 'Biểu đồ', icon: BarChart3 },
            ].map((opt) => {
              const IconComp = opt.icon;
              const isActive = groupBy === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setGroupBy(opt.id as any);
                    setCurrentPage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                    isActive
                      ? 'bg-cyan-600 text-white shadow-md border-2 border-cyan-600'
                      : 'bg-slate-50 text-cyan-950 hover:bg-cyan-50 hover:text-cyan-900 border-2 border-slate-200'
                  }`}
                >
                  <IconComp size={14} />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4 text-xs font-extrabold text-rose-700">
          {error}
        </div>
      )}

      {/* ═══ VISUAL CHART MODE OR TABLE ═══ */}
      {groupBy === 'chart' ? (
        <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <h2 className="text-base font-extrabold text-cyan-900 flex items-center gap-2">
            <BarChart3 className="text-cyan-600" size={20} />
            <span>Biểu đồ Phân bổ Doanh Thu Thuần theo Ngày</span>
          </h2>
          <div className="space-y-4">
            {filteredData.length === 0 ? (
              <div className="text-center py-10 text-slate-400 font-bold text-xs">Không có dữ liệu hiển thị biểu đồ</div>
            ) : (
              filteredData.map((item) => {
                const pct = Math.round((item.netRevenue / maxNetRevenue) * 100);
                return (
                  <div key={item.id} className="space-y-1">
                    <div className="flex justify-between text-xs font-extrabold text-slate-800">
                      <span>{item.dateOrName} ({item.salesOrderCount} đơn)</span>
                      <span className="text-cyan-900 font-black">{fmt(item.netRevenue)} đ</span>
                    </div>
                    <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-cyan-700 transition-all duration-500 rounded-full"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* ═══ MAIN TABLE & PAGINATION matching Outbound Orders Table ═══ */
        <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[1250px] border-collapse text-left">
              <thead className="bg-cyan-50 sticky top-0 z-20 shadow-sm">
                <tr className="border-b-2 border-slate-200 text-slate-800 font-extrabold uppercase text-xs sm:text-sm tracking-wider">
                  <th className="w-14 min-w-[60px] border-r border-slate-200 px-3 py-4 text-center">STT</th>
                  {columnVis.groupName && (
                    <th className="min-w-[220px] border-r border-slate-200 px-4 py-4 text-center">
                      {groupBy === 'staff'
                        ? 'Nhân viên thực hiện'
                        : groupBy === 'customer'
                        ? 'Khách hàng'
                        : groupBy === 'branch'
                        ? 'Kho xuất hàng'
                        : groupBy === 'month'
                        ? 'Tháng ghi nhận'
                        : groupBy === 'year'
                        ? 'Năm ghi nhận'
                        : 'Ngày ghi nhận'}
                    </th>
                  )}
                  {columnVis.ordersCount && <th className="min-w-[140px] border-r border-slate-200 px-3 py-4 text-center">Số đơn bán</th>}
                  {columnVis.revenue && <th className="min-w-[160px] border-r border-slate-200 px-3 py-4 text-center">Thành tiền (đ)</th>}
                  {columnVis.discount && <th className="min-w-[140px] border-r border-slate-200 px-3 py-4 text-center">Chiết khấu (đ)</th>}
                  {columnVis.vat && <th className="min-w-[130px] border-r border-slate-200 px-3 py-4 text-center">Thuế VAT (đ)</th>}
                  {columnVis.returnAmount && <th className="min-w-[150px] border-r border-slate-200 px-3 py-4 text-center">Tiền hàng trả (đ)</th>}
                  {columnVis.netRevenue && <th className="min-w-[170px] border-r border-slate-200 px-4 py-4 text-center text-cyan-900 font-black">Doanh thu thuần (đ)</th>}
                  <th className="sticky right-0 top-0 z-30 w-36 min-w-[140px] bg-cyan-100 px-3 py-4 text-center shadow-[-4px_0_12px_rgba(0,0,0,0.05)] border-l border-slate-200 text-cyan-950 font-black">Thao tác</th>
                </tr>
                {/* Summary Row inside Header */}
                <tr className="bg-cyan-100/70 border-b-2 border-cyan-300 font-black text-cyan-950 text-xs sm:text-sm">
                  <td colSpan={2} className="py-3 px-4 border-r border-cyan-200 uppercase tracking-wide">
                    TỔNG CỘNG ({filteredData.length} nhóm):
                  </td>
                  {columnVis.ordersCount && <td className="py-3 px-3 text-center border-r border-cyan-200 text-cyan-900">{totals.orders} đơn</td>}
                  {columnVis.revenue && <td className="py-3 px-3 text-right border-r border-cyan-200 text-cyan-900">{fmt(totals.revenue)}</td>}
                  {columnVis.discount && <td className="py-3 px-3 text-right border-r border-cyan-200 text-cyan-900">{fmt(totals.discount)}</td>}
                  {columnVis.vat && <td className="py-3 px-3 text-right border-r border-cyan-200 text-cyan-900">{fmt(totals.vatAmount)}</td>}
                  {columnVis.returnAmount && <td className="py-3 px-3 text-right border-r border-cyan-200 text-cyan-900">{fmt(totals.returnAmount)}</td>}
                  {columnVis.netRevenue && <td className="py-3 px-4 text-right text-cyan-900 text-sm font-black border-r border-cyan-200">{fmt(totals.netRevenue)}</td>}
                  <td className="py-3 px-3 text-center bg-cyan-100/90">-</td>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                      <RefreshCw size={20} className="animate-spin inline-block mr-2 text-cyan-600" />
                      Đang tổng hợp dữ liệu báo cáo bán hàng...
                    </td>
                  </tr>
                ) : paginatedData.length > 0 ? (
                  paginatedData.map((row, idx) => {
                    const realIndex = (currentPage - 1) * pageSize + idx + 1;
                    return (
                      <tr key={row.id || idx} className="hover:bg-cyan-50/60 transition group">
                        <td className="py-3.5 px-3 text-center border-r border-slate-200 font-semibold text-slate-600">
                          {realIndex}
                        </td>
                        {columnVis.groupName && (
                          <td className="py-3.5 px-4 text-left border-r border-slate-200 font-extrabold text-slate-900">
                            {row.dateOrName}
                          </td>
                        )}
                        {columnVis.ordersCount && (
                          <td className="py-3.5 px-3 text-center border-r border-slate-200 font-bold text-slate-800">
                            {row.salesOrderCount} đơn
                          </td>
                        )}
                        {columnVis.revenue && (
                          <td className="py-3.5 px-3 text-right border-r border-slate-200 font-bold text-slate-800">
                            {fmt(row.revenue)}
                          </td>
                        )}
                        {columnVis.discount && (
                          <td className="py-3.5 px-3 text-right border-r border-slate-200 font-bold text-slate-600">
                            {fmt(row.discount)}
                          </td>
                        )}
                        {columnVis.vat && (
                          <td className="py-3.5 px-3 text-right border-r border-slate-200 font-bold text-slate-600">
                            {fmt(row.vatAmount)}
                          </td>
                        )}
                        {columnVis.returnAmount && (
                          <td className="py-3.5 px-3 text-right border-r border-slate-200 font-bold text-slate-600">
                            {fmt(row.returnAmount)}
                          </td>
                        )}
                        {columnVis.netRevenue && (
                          <td className="py-3.5 px-4 text-right border-r border-slate-200 font-black text-cyan-900 text-sm">
                            {fmt(row.netRevenue)} đ
                          </td>
                        )}
                        <td className="sticky right-0 top-0 z-10 py-3.5 px-3 text-center bg-white group-hover:bg-cyan-50/60 border-l border-slate-200">
                          {row.orders && row.orders.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setSelectedGroupDetail(row)}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-cyan-100 hover:bg-cyan-200 text-cyan-900 font-extrabold text-xs transition cursor-pointer shadow-2xs"
                            >
                              <Eye size={13} />
                              <span>Chi tiết ({row.orders.length})</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                      Không tìm thấy dữ liệu báo cáo bán hàng
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer matching Outbound Orders */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border-t-2 border-slate-200 text-xs font-extrabold text-slate-700">
            <div className="flex items-center gap-2">
              <span>Hiển thị:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 px-2 rounded-lg border-2 border-slate-300 bg-white font-bold text-slate-800 outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>dòng/trang</span>
              <span className="mx-2 text-slate-300">|</span>
              <span>
                Hiển thị {filteredData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} -{' '}
                {Math.min(currentPage * pageSize, filteredData.length)} trên tổng {filteredData.length} nhóm
              </span>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-cyan-50 disabled:opacity-40 cursor-pointer"
                title="Trang đầu"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-cyan-50 disabled:opacity-40 cursor-pointer"
                title="Trang trước"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 py-1 font-extrabold text-slate-800 bg-slate-100 rounded-lg">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-cyan-50 disabled:opacity-40 cursor-pointer"
                title="Trang tiếp"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-cyan-50 disabled:opacity-40 cursor-pointer"
                title="Trang cuối"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
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
                groupName: 'Tiêu chí nhóm',
                ordersCount: 'Số đơn bán',
                revenue: 'Thành tiền',
                discount: 'Chiết khấu',
                vat: 'Thuế VAT',
                returnAmount: 'Tiền hàng trả',
                netRevenue: 'Doanh thu thuần',
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

      {/* ═══ DETAIL MODAL FOR SELECTED GROUP ═══ */}
      {selectedGroupDetail && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-4xl max-h-[85vh] rounded-2xl border-2 border-cyan-500 bg-white shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between bg-cyan-600 px-5 py-3 text-white">
              <div className="flex items-center gap-2 font-extrabold text-sm">
                <BarChart3 size={18} />
                <span>Chi tiết các đơn bán - {selectedGroupDetail.dateOrName} ({selectedGroupDetail.orders.length} đơn)</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedGroupDetail(null)}
                className="text-white hover:text-cyan-100 font-black text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 custom-scrollbar space-y-3">
              <table className="w-full border-collapse text-xs text-left">
                <thead className="bg-slate-100 text-slate-800 font-extrabold border-b border-slate-300 uppercase">
                  <tr>
                    <th className="p-2 text-center w-10">STT</th>
                    <th className="p-2">Mã phiếu</th>
                    <th className="p-2">Ngày đặt</th>
                    <th className="p-2">Khách hàng</th>
                    <th className="p-2">Nhân viên</th>
                    <th className="p-2 text-right">Tổng tiền</th>
                    <th className="p-2 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedGroupDetail.orders.map((o: any, idx: number) => (
                    <tr key={o.id || idx} className="hover:bg-cyan-50/50">
                      <td className="p-2 text-center font-bold text-slate-500">{idx + 1}</td>
                      <td className="p-2 font-extrabold text-cyan-800">{o.orderNo || `HD${o.id}`}</td>
                      <td className="p-2 text-slate-700 font-semibold">{(o.orderDate || o.createdAt || '').split('T')[0]}</td>
                      <td className="p-2 font-bold text-slate-800">{o.customerName || 'Khách lẻ'}</td>
                      <td className="p-2 text-slate-700">{o.employeeName || 'Quản trị'}</td>
                      <td className="p-2 text-right font-extrabold text-slate-900">{fmt(o.totalAmount || o.subtotal || 0)} đ</td>
                      <td className="p-2 text-center">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {o.status || 'Hoàn thành'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
              <button
                type="button"
                onClick={() => setSelectedGroupDetail(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-extrabold text-xs transition cursor-pointer"
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
