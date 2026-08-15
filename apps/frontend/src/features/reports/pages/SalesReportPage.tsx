import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Printer,
  FileSpreadsheet,
  RefreshCw,
  Search,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  RotateCcw,
  Calendar,
  Filter,
} from 'lucide-react';
import { reportsApi } from '../api/reportsApi';

const fmt = (v: number) => new Intl.NumberFormat('vi-VN').format(v || 0);

interface SalesReportItem {
  id: string;
  dateOrName: string;
  salesOrderCount: number;
  revenue: number;
  discount: number;
  returnOrderCount: number;
  returnAmount: number;
  netRevenue: number;
}

export default function SalesReportPage() {
  const [startDate, setStartDate] = useState('2026-07-01');
  const [endDate, setEndDate] = useState('2026-08-12');
  const [groupBy, setGroupBy] = useState<'day' | 'month' | 'year' | 'staff' | 'branch' | 'chart'>('day');
  const [data, setData] = useState<SalesReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reportsApi.getSalesReport(startDate, endDate, groupBy);
      setData(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setError(err?.message || 'Không thể kết nối dữ liệu báo cáo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate, groupBy]);

  const totals = useMemo(() => {
    return data.reduce(
      (acc, item) => ({
        orders: acc.orders + (item.salesOrderCount || 0),
        revenue: acc.revenue + (item.revenue || 0),
        discount: acc.discount + (item.discount || 0),
        returnOrders: acc.returnOrders + (item.returnOrderCount || 0),
        returnAmount: acc.returnAmount + (item.returnAmount || 0),
        netRevenue: acc.netRevenue + (item.netRevenue || 0),
      }),
      { orders: 0, revenue: 0, discount: 0, returnOrders: 0, returnAmount: 0, netRevenue: 0 }
    );
  }, [data]);

  const handleExportExcel = () => {
    if (data.length === 0) return;
    const headers = ['STT', 'Ngày / Nhóm', 'Số đơn bán', 'Doanh thu', 'Chiết khấu', 'Số đơn trả', 'Tiền hàng trả', 'Doanh thu thuần'];
    const rows = data.map((row, idx) => [
      idx + 1,
      `"${(row.dateOrName || '').replace(/"/g, '""')}"`,
      row.salesOrderCount || 0,
      row.revenue || 0,
      row.discount || 0,
      row.returnOrderCount || 0,
      row.returnAmount || 0,
      row.netRevenue || 0,
    ]);
    const summaryRow = ['Tổng cộng', '', totals.orders, totals.revenue, totals.discount, totals.returnOrders, totals.returnAmount, totals.netRevenue];
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
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Header Section matching Permission Groups layout */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2.5 rounded-2xl bg-cyan-600 px-5 py-2.5 text-white shadow-md">
            <BarChart3 className="h-5 w-5" />
            <h1 className="text-xl font-extrabold tracking-tight">Báo cáo bán hàng</h1>
          </div>
        </div>

        {/* Right-aligned action buttons with consistent cyan border, text cyan, white background */}
        <div className="flex flex-wrap items-center gap-3">
          {/* 1. Xem báo cáo */}
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Search className="h-4.5 w-4.5 text-cyan-700" />
            Xem báo cáo
          </button>

          {/* 2. Làm mới */}
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-4.5 w-4.5 text-cyan-700 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>

          {/* 3. In báo cáo */}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
          >
            <Printer className="h-4.5 w-4.5 text-cyan-700" />
            In báo cáo
          </button>

          {/* 4. Export Excel */}
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

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border-2 border-cyan-200 bg-gradient-to-br from-cyan-50/60 to-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Doanh Thu Thuần</span>
            <div className="rounded-xl bg-cyan-600/10 p-2 text-cyan-700">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-cyan-900">
            {fmt(totals.netRevenue)} <span className="text-sm font-bold text-cyan-700">đ</span>
          </p>
          <p className="mt-1 text-xs font-semibold text-cyan-700">Doanh số thực tế sau chiết khấu</p>
        </div>

        <div className="rounded-2xl border-2 border-cyan-200 bg-gradient-to-br from-cyan-50/60 to-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Tổng Đơn Bán</span>
            <div className="rounded-xl bg-cyan-600/10 p-2 text-cyan-700">
              <ShoppingBag className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {totals.orders} <span className="text-sm font-bold text-slate-500">đơn</span>
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Số đơn hàng đã phát sinh</p>
        </div>

        <div className="rounded-2xl border-2 border-cyan-200 bg-gradient-to-br from-cyan-50/60 to-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Tổng Chiết Khấu</span>
            <div className="rounded-xl bg-cyan-600/10 p-2 text-cyan-700">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {fmt(totals.discount)} <span className="text-sm font-bold text-slate-500">đ</span>
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Tổng giảm giá áp dụng</p>
        </div>

        <div className="rounded-2xl border-2 border-cyan-200 bg-gradient-to-br from-cyan-50/60 to-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Trả Hàng / Tiền Trả</span>
            <div className="rounded-xl bg-cyan-600/10 p-2 text-cyan-700">
              <RotateCcw className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-xl font-black text-slate-900">
            {totals.returnOrders} <span className="text-xs text-slate-500">đơn</span> - {fmt(totals.returnAmount)} <span className="text-xs text-slate-500">đ</span>
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Giá trị hàng hoàn trả</p>
        </div>
      </div>

      {/* Filter & Group By Bar */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Date range picker */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4.5 w-4.5 text-cyan-600" />
              <span className="text-xs font-extrabold text-slate-700 uppercase">Kỳ báo cáo:</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Từ</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 rounded-xl border-2 border-cyan-600/40 bg-white px-3 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
              />
              <span className="text-xs font-bold text-slate-500">Đến</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 rounded-xl border-2 border-cyan-600/40 bg-white px-3 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
              />
            </div>
          </div>

          {/* Group By Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 lg:border-t-0 lg:pt-0">
            <div className="flex items-center gap-2 mr-1">
              <Filter className="h-4 w-4 text-cyan-600" />
              <span className="text-xs font-extrabold text-slate-700 uppercase">Nhóm theo:</span>
            </div>
            {[
              { id: 'day', label: 'Theo Ngày' },
              { id: 'month', label: 'Theo Tháng' },
              { id: 'year', label: 'Theo Năm' },
              { id: 'staff', label: 'Theo Nhân viên' },
              { id: 'branch', label: 'Theo Kho' },
              { id: 'chart', label: 'Biểu đồ' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setGroupBy(opt.id as any)}
                className={`rounded-xl px-4 py-2 text-xs font-extrabold transition cursor-pointer ${
                  groupBy === opt.id
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'bg-white text-cyan-800 hover:bg-cyan-50 border-2 border-cyan-700/30'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4 text-xs font-extrabold text-rose-700">
          {error}
        </div>
      )}

      {/* High-density Data Table styled matching Permission Groups */}
      <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto max-h-[640px]">
          <table className="w-full min-w-[900px] border-collapse text-left text-xs">
            <thead className="bg-cyan-50 sticky top-0 z-10 border-b-2 border-cyan-200">
              <tr className="text-cyan-950 font-black uppercase text-[11px] tracking-wider">
                <th className="py-3 px-4 text-center border-r border-cyan-200 w-14">STT</th>
                <th className="py-3 px-4 text-left border-r border-cyan-200">Ngày / Tiêu chí nhóm</th>
                <th className="py-3 px-4 text-right border-r border-cyan-200">Số đơn bán</th>
                <th className="py-3 px-4 text-right border-r border-cyan-200">Doanh thu (VND)</th>
                <th className="py-3 px-4 text-right border-r border-cyan-200">Chiết khấu (VND)</th>
                <th className="py-3 px-4 text-right border-r border-cyan-200">Số đơn trả</th>
                <th className="py-3 px-4 text-right border-r border-cyan-200">Tiền hàng trả</th>
                <th className="py-3 px-4 text-right">Doanh thu thuần</th>
              </tr>
              {/* Summary Row inside Header */}
              <tr className="bg-cyan-100/70 border-b-2 border-cyan-300 font-black text-cyan-950">
                <td colSpan={2} className="py-2.5 px-4 border-r border-cyan-200 uppercase tracking-wide">Tổng Cộng:</td>
                <td className="py-2.5 px-4 text-right border-r border-cyan-200 text-cyan-900">{totals.orders}</td>
                <td className="py-2.5 px-4 text-right border-r border-cyan-200 text-cyan-900">{fmt(totals.revenue)}</td>
                <td className="py-2.5 px-4 text-right border-r border-cyan-200 text-cyan-900">{fmt(totals.discount)}</td>
                <td className="py-2.5 px-4 text-right border-r border-cyan-200 text-cyan-900">{totals.returnOrders}</td>
                <td className="py-2.5 px-4 text-right border-r border-cyan-200 text-cyan-900">{fmt(totals.returnAmount)}</td>
                <td className="py-2.5 px-4 text-right text-cyan-900 text-sm">{fmt(totals.netRevenue)}</td>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                    <RefreshCw size={20} className="animate-spin inline-block mr-2 text-cyan-600" />
                    Đang truy vấn dữ liệu báo cáo bán hàng...
                  </td>
                </tr>
              ) : data.length > 0 ? (
                data.map((row, idx) => (
                  <tr key={row.id || idx} className="hover:bg-cyan-50/50 transition">
                    <td className="py-3 px-4 text-center border-r border-slate-200 font-semibold text-slate-600">{idx + 1}</td>
                    <td className="py-3 px-4 text-left border-r border-slate-200 font-extrabold text-slate-900">{row.dateOrName}</td>
                    <td className="py-3 px-4 text-right border-r border-slate-200 font-bold text-slate-800">{row.salesOrderCount}</td>
                    <td className="py-3 px-4 text-right border-r border-slate-200 font-bold text-slate-900">{row.revenue ? fmt(row.revenue) : 0}</td>
                    <td className="py-3 px-4 text-right border-r border-slate-200 font-bold text-slate-700">{row.discount ? fmt(row.discount) : 0}</td>
                    <td className="py-3 px-4 text-right border-r border-slate-200 font-semibold text-slate-600">{row.returnOrderCount || 0}</td>
                    <td className="py-3 px-4 text-right border-r border-slate-200 font-semibold text-slate-600">{row.returnAmount ? fmt(row.returnAmount) : 0}</td>
                    <td className="py-3 px-4 text-right font-black text-cyan-900 text-sm">{fmt(row.netRevenue)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                    Không có dữ liệu báo cáo bán hàng trong khoảng thời gian đã chọn
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-cyan-300 bg-cyan-100/70 font-black text-cyan-950">
                <td colSpan={2} className="py-3 px-4 border-r border-cyan-200 uppercase tracking-wide">Tổng Cộng:</td>
                <td className="py-3 px-4 text-right border-r border-cyan-200 text-cyan-900">{totals.orders}</td>
                <td className="py-3 px-4 text-right border-r border-cyan-200 text-cyan-900">{fmt(totals.revenue)}</td>
                <td className="py-3 px-4 text-right border-r border-cyan-200 text-cyan-900">{fmt(totals.discount)}</td>
                <td className="py-3 px-4 text-right border-r border-cyan-200 text-cyan-900">{totals.returnOrders}</td>
                <td className="py-3 px-4 text-right border-r border-cyan-200 text-cyan-900">{fmt(totals.returnAmount)}</td>
                <td className="py-3 px-4 text-right text-cyan-900 text-sm">{fmt(totals.netRevenue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
