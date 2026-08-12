import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, Printer, FileSpreadsheet, RefreshCw, Search } from 'lucide-react';
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

  return (
    <div className="space-y-5 pb-12">
      {/* HEADER TITLE */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-sm">
            <BarChart3 className="h-5 w-5 text-white" />
            <h1 className="text-base font-black tracking-tight uppercase">Báo Cáo Bán Hàng</h1>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Dữ liệu tổng hợp bán hàng thực tế từ hệ thống quản lý kho
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-cyan-600' : 'text-slate-500'} />
          Làm mới dữ liệu
        </button>
      </div>

      {/* FILTER CONTROL PANEL */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-pink-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-pink-700 transition cursor-pointer"
            >
              <Printer size={15} />
              Print
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition cursor-pointer">
              <FileSpreadsheet size={15} />
              Excel
            </button>

            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <span>Từ ngày:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 rounded-xl border-2 border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500"
              />
              <span>Đến ngày:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 rounded-xl border-2 border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500"
              />
            </div>

            <button
              onClick={loadData}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-700 transition cursor-pointer"
            >
              <Search size={14} />
              Xem báo cáo
            </button>
          </div>
        </div>

        {/* GROUP BY RADIO SELECTION */}
        <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3 text-xs font-bold text-slate-700">
          <span className="text-slate-500">Nhóm theo:</span>
          {[
            { id: 'day', label: 'Ngày' },
            { id: 'month', label: 'Tháng' },
            { id: 'year', label: 'Năm' },
            { id: 'staff', label: 'Nhân viên' },
            { id: 'branch', label: 'Chi nhánh' },
            { id: 'chart', label: 'Biểu đồ' },
          ].map((opt) => (
            <label key={opt.id} className="flex items-center gap-1.5 cursor-pointer hover:text-cyan-700">
              <input
                type="radio"
                name="salesGroupByPage"
                value={opt.id}
                checked={groupBy === opt.id}
                onChange={() => setGroupBy(opt.id as any)}
                className="h-4 w-4 text-cyan-600 focus:ring-cyan-500"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">
          {error}
        </div>
      )}

      {/* DATA TABLE MATCHING EXACT RIC REFERENCE UI */}
      <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-slate-200 bg-slate-100 text-slate-800 font-bold uppercase">
                <th className="py-2.5 px-3 text-center border-r border-slate-200 w-12">TT</th>
                <th className="py-2.5 px-3 text-left border-r border-slate-200">Ngày / Nhóm</th>
                <th className="py-2.5 px-3 text-right border-r border-slate-200">Số đơn bán</th>
                <th className="py-2.5 px-3 text-right border-r border-slate-200">Doanh thu</th>
                <th className="py-2.5 px-3 text-right border-r border-slate-200">Chiết khấu</th>
                <th className="py-2.5 px-3 text-right border-r border-slate-200">Số đơn trả</th>
                <th className="py-2.5 px-3 text-right border-r border-slate-200">Tiền hàng trả</th>
                <th className="py-2.5 px-3 text-right">Doanh thu thuần</th>
              </tr>
              {/* TOP SUMMARY ROW */}
              <tr className="border-b-2 border-slate-300 bg-slate-200/80 font-black text-slate-900">
                <td colSpan={2} className="py-2.5 px-3 border-r border-slate-300 uppercase">Tổng:</td>
                <td className="py-2.5 px-3 text-right border-r border-slate-300 text-cyan-900">{totals.orders}</td>
                <td className="py-2.5 px-3 text-right border-r border-slate-300 text-slate-900">{fmt(totals.revenue)}</td>
                <td className="py-2.5 px-3 text-right border-r border-slate-300 text-slate-900">{fmt(totals.discount)}</td>
                <td className="py-2.5 px-3 text-right border-r border-slate-300">{totals.returnOrders}</td>
                <td className="py-2.5 px-3 text-right border-r border-slate-300">{fmt(totals.returnAmount)}</td>
                <td className="py-2.5 px-3 text-right text-emerald-800 text-sm">{fmt(totals.netRevenue)}</td>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-bold">
                    <RefreshCw size={18} className="animate-spin inline-block mr-2 text-cyan-600" />
                    Đang truy vấn dữ liệu từ cơ sở dữ liệu...
                  </td>
                </tr>
              ) : data.length > 0 ? (
                data.map((row, idx) => (
                  <tr key={row.id || idx} className="hover:bg-cyan-50/50 transition-colors">
                    <td className="py-2 px-3 text-center border-r border-slate-200 font-semibold text-slate-600">{idx + 1}</td>
                    <td className="py-2 px-3 text-left border-r border-slate-200 font-bold text-slate-900">{row.dateOrName}</td>
                    <td className="py-2 px-3 text-right border-r border-slate-200 font-bold text-slate-800">{row.salesOrderCount}</td>
                    <td className="py-2 px-3 text-right border-r border-slate-200 font-bold text-slate-900">{row.revenue ? fmt(row.revenue) : 0}</td>
                    <td className="py-2 px-3 text-right border-r border-slate-200 font-bold text-slate-700">{row.discount ? fmt(row.discount) : 0}</td>
                    <td className="py-2 px-3 text-right border-r border-slate-200 font-semibold text-slate-600">{row.returnOrderCount || 0}</td>
                    <td className="py-2 px-3 text-right border-r border-slate-200 font-semibold text-slate-600">{row.returnAmount ? fmt(row.returnAmount) : 0}</td>
                    <td className="py-2 px-3 text-right font-black text-slate-900">{fmt(row.netRevenue)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-bold">
                    Không có dữ liệu đơn hàng trong kỳ này
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-200/80 font-black text-slate-900">
                <td colSpan={2} className="py-2.5 px-3 border-r border-slate-300 uppercase">Tổng:</td>
                <td className="py-2.5 px-3 text-right border-r border-slate-300">{totals.orders}</td>
                <td className="py-2.5 px-3 text-right border-r border-slate-300">{fmt(totals.revenue)}</td>
                <td className="py-2.5 px-3 text-right border-r border-slate-300">{fmt(totals.discount)}</td>
                <td className="py-2.5 px-3 text-right border-r border-slate-300">{totals.returnOrders}</td>
                <td className="py-2.5 px-3 text-right border-r border-slate-300">{fmt(totals.returnAmount)}</td>
                <td className="py-2.5 px-3 text-right text-emerald-800 text-sm">{fmt(totals.netRevenue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
