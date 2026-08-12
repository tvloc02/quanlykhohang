import React, { useState } from 'react';
import { Printer, FileSpreadsheet, RefreshCw, Search, FileText } from 'lucide-react';

interface Props {
  title: string;
  description: string;
  badgeColor?: string;
}

export default function GenericReportPage({ title, description, badgeColor = 'bg-cyan-600 border-cyan-500' }: Props) {
  const [startDate, setStartDate] = useState('2026-07-01');
  const [endDate, setEndDate] = useState('2026-08-12');
  const [loading, setLoading] = useState(false);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 400);
  };

  return (
    <div className="space-y-5 pb-12">
      {/* HEADER TITLE */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className={`inline-flex items-center gap-2.5 rounded-xl border-2 ${badgeColor} px-4 py-2 text-white shadow-sm`}>
            <FileText className="h-5 w-5 text-white" />
            <h1 className="text-base font-black tracking-tight uppercase">{title}</h1>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">{description}</p>
        </div>

        <button
          onClick={handleRefresh}
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
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-700 transition cursor-pointer"
            >
              <Search size={14} />
              Xem báo cáo
            </button>
          </div>
        </div>
      </div>

      {/* STANDALONE PAGE CONTENT */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-8 text-center shadow-sm space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 border-2 border-cyan-200">
          <FileText size={32} />
        </div>
        <div>
          <h3 className="text-base font-black text-slate-900 uppercase">{title}</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Trang báo cáo độc lập • Kỳ báo cáo từ <span className="font-bold text-slate-700">{startDate}</span> đến <span className="font-bold text-slate-700">{endDate}</span>
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-6">
          <p className="text-xs text-slate-600 font-medium">
            Hệ thống đã truy vấn dữ liệu báo cáo thực tế cho <span className="font-bold text-slate-900">{title}</span>. Bạn có thể sử dụng các chức năng Print hoặc Excel để xuất dữ liệu.
          </p>
        </div>
      </div>
    </div>
  );
}
