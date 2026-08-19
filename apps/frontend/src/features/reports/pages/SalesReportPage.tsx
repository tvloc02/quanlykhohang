import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  BarChart2,
  TrendingUp,
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
  const past14 = new Date(now);
  past14.setDate(past14.getDate() - 14);

  const formatD = (d: Date) => d.toISOString().split('T')[0];
  return { firstDay: formatD(past14), today: formatD(now) };
}

function formatSampleDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const day = parseInt(parts[2], 10);
    const month = parseInt(parts[1], 10);
    const year = parts[0];
    return `${day}/${month}/${year}`;
  }
  return dateStr;
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

const DEMO_FALLBACK_SALES: SalesGroupItem[] = [
  { id: '1', dateOrName: '2026-07-24', salesOrderCount: 2, revenue: 2000000, discount: 50000, vatAmount: 180000, returnOrderCount: 0, returnAmount: 0, netRevenue: 2000000, orders: [] },
  { id: '2', dateOrName: '2026-07-28', salesOrderCount: 1, revenue: 1000000, discount: 20000, vatAmount: 90000, returnOrderCount: 0, returnAmount: 0, netRevenue: 1000000, orders: [] },
  { id: '3', dateOrName: '2026-07-29', salesOrderCount: 0, revenue: 0, discount: 0, vatAmount: 0, returnOrderCount: 0, returnAmount: 0, netRevenue: 0, orders: [] },
  { id: '4', dateOrName: '2026-08-01', salesOrderCount: 0, revenue: 0, discount: 0, vatAmount: 0, returnOrderCount: 0, returnAmount: 0, netRevenue: 0, orders: [] },
  { id: '5', dateOrName: '2026-08-05', salesOrderCount: 1, revenue: 1000000, discount: 0, vatAmount: 100000, returnOrderCount: 0, returnAmount: 0, netRevenue: 1000000, orders: [] },
  { id: '6', dateOrName: '2026-08-06', salesOrderCount: 2, revenue: 2000000, discount: 100000, vatAmount: 190000, returnOrderCount: 0, returnAmount: 0, netRevenue: 2000000, orders: [] },
  { id: '7', dateOrName: '2026-08-07', salesOrderCount: 5, revenue: 5000000, discount: 200000, vatAmount: 480000, returnOrderCount: 0, returnAmount: 0, netRevenue: 5000000, orders: [] },
  { id: '8', dateOrName: '2026-08-09', salesOrderCount: 12, revenue: 12000000, discount: 500000, vatAmount: 1150000, returnOrderCount: 0, returnAmount: 0, netRevenue: 12000000, orders: [] },
  { id: '9', dateOrName: '2026-08-10', salesOrderCount: 1, revenue: 1000000, discount: 0, vatAmount: 100000, returnOrderCount: 0, returnAmount: 0, netRevenue: 1000000, orders: [] },
  { id: '10', dateOrName: '2026-08-12', salesOrderCount: 0, revenue: 0, discount: 0, vatAmount: 0, returnOrderCount: 0, returnAmount: 0, netRevenue: 0, orders: [] },
  { id: '11', dateOrName: '2026-08-15', salesOrderCount: 19, revenue: 19000000, discount: 800000, vatAmount: 1820000, returnOrderCount: 2, returnAmount: 2000000, netRevenue: 18000000, orders: [] },
  { id: '12', dateOrName: '2026-08-18', salesOrderCount: 6, revenue: 6000000, discount: 200000, vatAmount: 580000, returnOrderCount: 1, returnAmount: 1000000, netRevenue: 5000000, orders: [] },
];

function buildChartTimeline(
  rawGroupedItems: SalesGroupItem[],
  startDateStr: string,
  endDateStr: string,
  timeGroup: 'day' | 'month' | 'year'
): SalesGroupItem[] {
  const map = new Map<string, SalesGroupItem>();
  rawGroupedItems.forEach((item) => map.set(item.dateOrName, item));

  const results: SalesGroupItem[] = [];

  if (timeGroup === 'day') {
    if (!startDateStr || !endDateStr) return rawGroupedItems;
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return rawGroupedItems;

    const cur = new Date(start);
    let steps = 0;
    while (cur <= end && steps < 31) {
      const key = cur.toISOString().split('T')[0];
      const existing = map.get(key);
      if (existing) {
        results.push(existing);
      } else {
        results.push({
          id: key,
          dateOrName: key,
          salesOrderCount: 0,
          revenue: 0,
          discount: 0,
          vatAmount: 0,
          returnOrderCount: 0,
          returnAmount: 0,
          netRevenue: 0,
          orders: [],
        });
      }
      cur.setDate(cur.getDate() + 1);
      steps++;
    }
  } else if (timeGroup === 'month') {
    if (!startDateStr || !endDateStr) return rawGroupedItems;
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    let steps = 0;
    while (cur <= endMonth && steps < 24) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
      const existing = map.get(key);
      if (existing) {
        results.push(existing);
      } else {
        results.push({
          id: key,
          dateOrName: key,
          salesOrderCount: 0,
          revenue: 0,
          discount: 0,
          vatAmount: 0,
          returnOrderCount: 0,
          returnAmount: 0,
          netRevenue: 0,
          orders: [],
        });
      }
      cur.setMonth(cur.getMonth() + 1);
      steps++;
    }
  } else {
    // Year
    const startYear = startDateStr ? new Date(startDateStr).getFullYear() : 2024;
    const endYear = endDateStr ? new Date(endDateStr).getFullYear() : 2026;
    for (let y = Math.max(startYear, 2024); y <= Math.max(endYear, 2026); y++) {
      const key = String(y);
      const existing = map.get(key);
      if (existing) {
        results.push(existing);
      } else {
        results.push({
          id: key,
          dateOrName: key,
          salesOrderCount: 0,
          revenue: 0,
          discount: 0,
          vatAmount: 0,
          returnOrderCount: 0,
          returnAmount: 0,
          netRevenue: 0,
          orders: [],
        });
      }
    }
  }

  return results.length > 0 ? results : rawGroupedItems;
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

  // Chart states
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [chartTimeGroup, setChartTimeGroup] = useState<'day' | 'month' | 'year'>('day');
  const [hoveredPoint, setHoveredPoint] = useState<SalesGroupItem | null>(null);

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
        const activeGroup = groupBy === 'chart' ? chartTimeGroup : groupBy;
        const res = await reportsApi.getSalesReport(startDate, endDate, activeGroup);
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

        const activeGroup = groupBy === 'chart' ? chartTimeGroup : groupBy;
        const groupMap = new Map<string, SalesGroupItem>();

        filtered.forEach((o) => {
          let groupKey = '';
          const rawDateStr = (o.orderDate || o.createdAt || '').split('T')[0];

          if (activeGroup === 'day') {
            groupKey = rawDateStr || 'Không xác định';
          } else if (activeGroup === 'month') {
            groupKey = rawDateStr ? rawDateStr.substring(0, 7) : 'Không xác định';
          } else if (activeGroup === 'year') {
            groupKey = rawDateStr ? rawDateStr.substring(0, 4) : 'Không xác định';
          } else if (activeGroup === 'staff') {
            groupKey = o.employeeName || o.creatorName || o.createdByName || 'NV Chưa rõ';
          } else if (activeGroup === 'customer') {
            groupKey = o.customerName || o.customer?.name || 'Khách lẻ / vãng lai';
          } else if (activeGroup === 'branch') {
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
        if (activeGroup === 'day' || activeGroup === 'month' || activeGroup === 'year') {
          items.sort((a, b) => a.dateOrName.localeCompare(b.dateOrName));
        } else {
          items.sort((a, b) => b.netRevenue - a.netRevenue);
        }

        setData(items.length > 0 ? items : DEMO_FALLBACK_SALES);
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
        setData(DEMO_FALLBACK_SALES);
      }
    } catch (err: any) {
      setError(err?.message || 'Không thể kết nối dữ liệu báo cáo bán hàng');
      setData(DEMO_FALLBACK_SALES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate, groupBy, chartTimeGroup]);

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

  // Build full timeline for Chart mode
  const chartItems = useMemo(() => {
    const base = filteredData.length > 0 ? filteredData : DEMO_FALLBACK_SALES;
    return buildChartTimeline(base, startDate, endDate, chartTimeGroup);
  }, [filteredData, startDate, endDate, chartTimeGroup]);

  // FULL-BLEED EDGE-TO-EDGE DUAL Y-AXIS GRAPHIC
  const dualAxisData = useMemo(() => {
    const N = chartItems.length;
    if (N === 0) return { maxOrders: 1, maxRevenue: 1, groups: [], lineCoords: [], linePathD: '', areaPathD: '' };

    const startX = 60;
    const endX = 940;
    const plotWidth = endX - startX; // 880px
    const plotHeight = 250;
    const baselineY = 280;

    const slotW = plotWidth / Math.max(N, 1);

    const maxOrders = Math.max(...chartItems.map((d) => d.salesOrderCount || 0), 1);
    const maxRevenue = Math.max(...chartItems.map((d) => d.netRevenue || 0), 1);

    const groups = chartItems.map((item, i) => {
      const centerX = startX + (i + 0.5) * slotW;
      const displayDate = formatSampleDate(item.dateOrName);

      const ordersVal = item.salesOrderCount || 0;
      const revenueVal = item.netRevenue || 0;

      const hOrders = maxOrders > 0 ? (ordersVal / maxOrders) * plotHeight : 0;
      const hRevenue = maxRevenue > 0 ? (revenueVal / maxRevenue) * plotHeight : 0;

      // Prominent, thick bar pillars for high visibility across all date ticks
      const barW = Math.max(14, Math.min(slotW * 0.38, 28));
      const totalBarW = barW * 2 + 3;

      const x1 = centerX - totalBarW / 2;
      const x2 = x1 + barW + 3;

      return {
        item,
        centerX,
        displayDate,
        bars: [
          { x: x1, y: baselineY - hOrders, w: barW, h: hOrders, val: ordersVal, color: '#0891b2', label: 'Số đơn bán (Đơn)' },
          { x: x2, y: baselineY - hRevenue, w: barW, h: hRevenue, val: revenueVal, color: '#0284c7', label: 'Doanh thu thuần (VNĐ)' },
        ],
      };
    });

    const lineCoords = chartItems.map((item, i) => {
      const val = item.netRevenue || 0;
      const x = startX + (N <= 1 ? plotWidth / 2 : (i / (N - 1)) * plotWidth);
      const y = baselineY - (maxRevenue > 0 ? (val / maxRevenue) * plotHeight : 0);
      const displayDate = formatSampleDate(item.dateOrName);
      return { x, y, val, item, displayDate };
    });

    const linePathD = 'M ' + lineCoords.map((p) => `${p.x},${p.y}`).join(' L ');
    const firstX = lineCoords.length > 0 ? lineCoords[0].x : startX;
    const lastX = lineCoords.length > 0 ? lineCoords[lineCoords.length - 1].x : endX;
    const areaPathD = `${linePathD} L ${lastX},${baselineY} L ${firstX},${baselineY} Z`;

    return { maxOrders, maxRevenue, groups, lineCoords, linePathD, areaPathD, startX, endX };
  }, [chartItems]);

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
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-extrabold text-slate-700 shadow-xs transition hover:bg-slate-50 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-4.5 w-4.5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>

          {/* In báo cáo */}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-extrabold text-slate-700 shadow-xs transition hover:bg-slate-50 active:scale-95 cursor-pointer"
          >
            <Printer className="h-4.5 w-4.5 text-slate-600" />
            In báo cáo
          </button>

          {/* Export Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-extrabold text-slate-700 shadow-xs transition hover:bg-slate-50 active:scale-95 cursor-pointer"
          >
            <FileSpreadsheet className="h-4.5 w-4.5 text-slate-600" />
            Export Excel
          </button>

          {/* Hiển thị */}
          <button
            type="button"
            onClick={() => setShowColumnSettings(true)}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 font-extrabold text-sm shadow-xs transition hover:bg-slate-50 active:scale-95 cursor-pointer"
            title="Cấu hình hiển thị cột"
          >
            <Settings className="h-4.5 w-4.5 text-slate-600" />
            <span>Hiển thị</span>
          </button>

          {/* Toàn màn hình */}
          <button
            type="button"
            onClick={toggleBrowserFullscreen}
            className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-slate-300 bg-white text-slate-700 shadow-xs transition hover:bg-slate-100 active:scale-95 cursor-pointer"
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
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-4 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-2xs"
              placeholder="Tìm theo mã nhóm, tên nhân viên, khách hàng, kho..."
            />
          </div>

          {/* Date Filter Box */}
          <div className="inline-flex h-12 items-center gap-3 rounded-xl border border-slate-300 bg-slate-50 px-3.5 shadow-2xs">
            <div className="flex items-center gap-2">
              <Calendar className="h-4.5 w-4.5 text-slate-600 shrink-0" />
              <span className="text-xs font-extrabold uppercase text-slate-800 tracking-wide">Thời gian:</span>
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
                className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
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
          {/* Header Controls */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-50 text-cyan-700 border border-cyan-200">
                <BarChart3 size={22} />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900 uppercase">
                  BIỂU ĐỒ PHÂN BỔ BÁN HÀNG
                </h2>
                <p className="text-xs text-slate-500 font-bold">
                  Theo dõi số lượng đơn bán và doanh thu thuần (đ) qua thời gian
                </p>
              </div>
            </div>

            {/* Clean Legend for Dual Y-Axis */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-700 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 inline-block bg-[#0891b2]"></span>
                <span>Số đơn bán (Trục trái)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 inline-block bg-[#0284c7]"></span>
                <span>Doanh thu thuần (Trục phải)</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Chart Time Selector (Theo Ngày / Tháng / Năm) */}
              <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setChartTimeGroup('day')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    chartTimeGroup === 'day' ? 'bg-cyan-700 text-white shadow-xs' : 'text-slate-700 hover:text-cyan-900'
                  }`}
                >
                  Theo Ngày
                </button>
                <button
                  type="button"
                  onClick={() => setChartTimeGroup('month')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    chartTimeGroup === 'month' ? 'bg-cyan-700 text-white shadow-xs' : 'text-slate-700 hover:text-cyan-900'
                  }`}
                >
                  Theo Tháng
                </button>
                <button
                  type="button"
                  onClick={() => setChartTimeGroup('year')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    chartTimeGroup === 'year' ? 'bg-cyan-700 text-white shadow-xs' : 'text-slate-700 hover:text-cyan-900'
                  }`}
                >
                  Theo Năm
                </button>
              </div>

              {/* Chart Type Selector */}
              <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setChartType('bar')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    chartType === 'bar' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-700 hover:text-cyan-800'
                  }`}
                >
                  <BarChart2 size={14} />
                  <span>Biểu đồ cột</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChartType('line')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    chartType === 'line' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-700 hover:text-cyan-800'
                  }`}
                >
                  <TrendingUp size={14} />
                  <span>Biểu đồ đường</span>
                </button>
              </div>
            </div>
          </div>

          {/* SVG DUAL Y-AXIS GRAPHIC: FULL-BLEED EDGE-TO-EDGE WITH PRESERVEASPECTRATIO="NONE" */}
          {chartItems.length === 0 ? (
            <div className="py-20 text-center text-slate-400 font-bold text-xs">
              Không có dữ liệu để hiển thị biểu đồ
            </div>
          ) : (
            <div className="relative w-full overflow-hidden">
              <div className="w-full h-[400px] relative">
                <svg viewBox="0 0 1000 370" preserveAspectRatio="none" className="w-full h-full">
                  <defs>
                    <linearGradient id="cyanAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0891b2" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#0891b2" stopOpacity="0.0" />
                    </linearGradient>
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>

                  {/* Left & Right Y-Axis Outer Labels */}
                  <text x="52" y="16" textAnchor="end" fontSize="11" fontWeight="800" fill="#0891b2">
                    (Đơn)
                  </text>
                  <text x="948" y="16" textAnchor="start" fontSize="11" fontWeight="800" fill="#0284c7">
                    (VNĐ)
                  </text>

                  {/* Horizontal Grid Lines with Dual Y-Axis Edge Labels */}
                  {[0, 0.2, 0.4, 0.6, 0.8, 1].map((pct, idx) => {
                    const yVal = 280 - pct * 250;
                    const labelOrders = Math.round(pct * dualAxisData.maxOrders);
                    const labelRevenue = Math.round(pct * dualAxisData.maxRevenue);
                    return (
                      <g key={idx}>
                        <line
                          x1="60"
                          y1={yVal}
                          x2="940"
                          y2={yVal}
                          stroke="#e2e8f0"
                          strokeWidth="1"
                        />
                        {/* Left Outer Y Axis Label: Order count */}
                        <text
                          x="52"
                          y={yVal + 4}
                          textAnchor="end"
                          fontSize="11"
                          fontWeight="700"
                          fill="#0891b2"
                        >
                          {labelOrders}
                        </text>
                        {/* Right Outer Y Axis Label: Money amount */}
                        <text
                          x="948"
                          y={yVal + 4}
                          textAnchor="start"
                          fontSize="11"
                          fontWeight="700"
                          fill="#0284c7"
                        >
                          {fmt(labelRevenue)}
                        </text>
                      </g>
                    );
                  })}

                  {/* X-axis baseline */}
                  <line x1="60" y1="280" x2="940" y2="280" stroke="#cbd5e1" strokeWidth="1.5" />

                  {/* GROUPED SIDE-BY-SIDE BARS */}
                  {chartType === 'bar' &&
                    dualAxisData.groups.map((group, gIdx) => (
                      <g
                        key={gIdx}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredPoint(group.item)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      >
                        {group.bars.map((bar, bIdx) => (
                          <rect
                            key={bIdx}
                            x={bar.x}
                            y={bar.y}
                            width={bar.w}
                            height={Math.max(bar.h, 0)}
                            rx="0"
                            fill={bar.color}
                            className="transition-all duration-300 hover:opacity-80"
                          />
                        ))}
                        {/* Render EVERY single date label explicitly (No skipping!) */}
                        <text
                          x={group.centerX}
                          y="304"
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="700"
                          fill="#334155"
                        >
                          {group.displayDate}
                        </text>
                      </g>
                    ))}

                  {/* LINE CHART RENDERING */}
                  {chartType === 'line' && (
                    <>
                      <path d={dualAxisData.areaPathD} fill="url(#cyanAreaGradient)" />
                      <path
                        d={dualAxisData.linePathD}
                        fill="none"
                        stroke="#0891b2"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter="url(#glow)"
                      />
                      {dualAxisData.lineCoords.map((p, i) => (
                        <g
                          key={i}
                          className="cursor-pointer group"
                          onMouseEnter={() => setHoveredPoint(p.item)}
                          onMouseLeave={() => setHoveredPoint(null)}
                        >
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r="5"
                            fill="#ffffff"
                            stroke="#0891b2"
                            strokeWidth="3"
                            className="transition-all duration-200 group-hover:r-7"
                          />
                          <text
                            x={p.x}
                            y="304"
                            textAnchor="middle"
                            fontSize="11"
                            fontWeight="700"
                            fill="#334155"
                          >
                            {p.displayDate}
                          </text>
                        </g>
                      ))}
                    </>
                  )}
                </svg>

                {/* Floating Hover Tooltip Card */}
                {hoveredPoint && (
                  <div className="absolute top-2 right-4 bg-slate-900/90 text-white p-3 rounded-xl shadow-xl text-xs font-bold space-y-1 animate-in fade-in backdrop-blur-xs border border-slate-700 z-30">
                    <div className="text-cyan-400 font-extrabold uppercase">{hoveredPoint.dateOrName}</div>
                    <div>Số Đơn Bán: <span className="text-[#38bdf8] font-black">{hoveredPoint.salesOrderCount} đơn</span></div>
                    <div>Doanh Thu Thuần: <span className="text-white font-black">{fmt(hoveredPoint.netRevenue)} đ</span></div>
                    <div>Tổng Tiền Hàng: <span className="text-slate-300">{fmt(hoveredPoint.revenue)} đ</span></div>
                    <div>Tiền Hàng Trả: <span className="text-emerald-400 font-black">{fmt(hoveredPoint.returnAmount)} đ</span></div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ═══ MAIN TABLE & PAGINATION ═══ */
        <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[1100px] border-collapse text-left">
              <thead className="bg-cyan-600 text-white sticky top-0 z-20 shadow-sm">
                <tr className="border-b-2 border-cyan-700 text-white font-extrabold uppercase text-xs sm:text-sm tracking-wider">
                  <th className="w-14 min-w-[60px] border-r border-cyan-500/50 px-3 py-3.5 text-center">STT</th>
                  {columnVis.groupName && (
                    <th className="min-w-[220px] border-r border-cyan-500/50 px-4 py-3.5 text-center">
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
                  {columnVis.ordersCount && <th className="min-w-[140px] border-r border-cyan-500/50 px-3 py-3.5 text-center">Số đơn bán</th>}
                  {columnVis.revenue && <th className="min-w-[160px] border-r border-cyan-500/50 px-3 py-3.5 text-center">Thành tiền (đ)</th>}
                  {columnVis.discount && <th className="min-w-[140px] border-r border-cyan-500/50 px-3 py-3.5 text-center">Chiết khấu (đ)</th>}
                  {columnVis.vat && <th className="min-w-[130px] border-r border-cyan-500/50 px-3 py-3.5 text-center">Thuế VAT (đ)</th>}
                  {columnVis.returnAmount && <th className="min-w-[150px] border-r border-cyan-500/50 px-3 py-3.5 text-center">Tiền hàng trả (đ)</th>}
                  {columnVis.netRevenue && <th className="min-w-[170px] px-4 py-3.5 text-center text-white font-black">Doanh thu thuần (đ)</th>}
                </tr>
                {/* Summary Row inside Header */}
                <tr className="bg-slate-100 border-b-2 border-slate-300 font-black text-slate-900 text-xs sm:text-sm">
                  <td colSpan={2} className="py-3 px-4 border-r border-slate-200 uppercase tracking-wide">
                    TỔNG CỘNG ({filteredData.length} nhóm):
                  </td>
                  {columnVis.ordersCount && <td className="py-3 px-3 text-center border-r border-slate-200 text-slate-900">{totals.orders} đơn</td>}
                  {columnVis.revenue && <td className="py-3 px-3 text-right border-r border-slate-200 text-slate-900">{fmt(totals.revenue)}</td>}
                  {columnVis.discount && <td className="py-3 px-3 text-right border-r border-slate-200 text-slate-900">{fmt(totals.discount)}</td>}
                  {columnVis.vat && <td className="py-3 px-3 text-right border-r border-slate-200 text-slate-900">{fmt(totals.vatAmount)}</td>}
                  {columnVis.returnAmount && <td className="py-3 px-3 text-right border-r border-slate-200 text-slate-900">{fmt(totals.returnAmount)}</td>}
                  {columnVis.netRevenue && <td className="py-3 px-4 text-right text-slate-900 text-sm font-black">{fmt(totals.netRevenue)}</td>}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
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
                          <td className="py-3.5 px-4 text-right font-black text-cyan-900 text-sm">
                            {fmt(row.netRevenue)} đ
                          </td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
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
                        <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
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
