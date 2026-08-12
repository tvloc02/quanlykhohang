import React, { useState, useEffect } from 'react';
import { DollarSign, Printer, FileSpreadsheet, RefreshCw, Search } from 'lucide-react';
import { reportsApi } from '../api/reportsApi';

const fmt = (v: number) => new Intl.NumberFormat('vi-VN').format(v || 0);

interface CashflowGroup {
  groupName: string;
  items: {
    id: string;
    title: string;
    income: number;
    expense: number;
    balance: number;
  }[];
}

export default function CashflowReportPage() {
  const [startDate, setStartDate] = useState('2026-07-01');
  const [endDate, setEndDate] = useState('2026-08-12');
  const [data, setData] = useState<CashflowGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reportsApi.getCashflowReport(startDate, endDate);
      setData(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setError(err?.message || 'Không thể kết nối dữ liệu báo cáo thu chi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  return (
    <div className="space-y-5 pb-12">
      {/* HEADER TITLE */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-amber-500 bg-amber-600 px-4 py-2 text-white shadow-sm">
            <DollarSign className="h-5 w-5 text-white" />
            <h1 className="text-base font-black tracking-tight uppercase">Báo Cáo Thu Chi</h1>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Tổng hợp dòng tiền Thu - Chi và số dư tồn quỹ theo thực tế giao dịch
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-amber-600' : 'text-slate-500'} />
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
                className="h-9 rounded-xl border-2 border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
              />
              <span>Đến ngày:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 rounded-xl border-2 border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
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
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">
          {error}
        </div>
      )}

      {/* DATA TABLE */}
      <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-slate-200 bg-slate-100 text-slate-800 font-bold uppercase">
                <th className="py-2.5 px-3 text-center border-r border-slate-200 w-12">TT</th>
                <th className="py-2.5 px-3 text-left border-r border-slate-200">Nội dung thu chi</th>
                <th className="py-2.5 px-3 text-right border-r border-slate-200">Thu</th>
                <th className="py-2.5 px-3 text-right border-r border-slate-200">Chi</th>
                <th className="py-2.5 px-3 text-right">Tổng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-bold">
                    <RefreshCw size={18} className="animate-spin inline-block mr-2 text-amber-600" />
                    Đang tính toán dòng tiền từ cơ sở dữ liệu...
                  </td>
                </tr>
              ) : data.length > 0 ? (
                data.map((group) => (
                  <React.Fragment key={group.groupName}>
                    <tr className="bg-slate-100/90 font-black text-slate-900 border-t border-slate-300">
                      <td colSpan={5} className="py-2 px-3 text-left">{group.groupName}</td>
                    </tr>
                    {group.items.map((row, idx) => (
                      <tr key={row.id || idx} className="hover:bg-amber-50/40 transition-colors">
                        <td className="py-2 px-3 text-center border-r border-slate-200 font-semibold text-slate-600">{idx + 1}</td>
                        <td className="py-2 px-3 text-left border-r border-slate-200 font-bold text-slate-800">{row.title}</td>
                        <td className="py-2 px-3 text-right border-r border-slate-200 font-bold text-emerald-700">{row.income ? fmt(row.income) : 0}</td>
                        <td className="py-2 px-3 text-right border-r border-slate-200 font-bold text-rose-700">{row.expense ? fmt(row.expense) : 0}</td>
                        <td className="py-2 px-3 text-right font-black text-slate-900">{fmt(row.balance)}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-bold">
                    Chưa có giao dịch thu chi phát sinh
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
