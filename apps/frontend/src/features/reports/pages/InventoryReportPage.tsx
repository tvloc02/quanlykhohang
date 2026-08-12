import React, { useState, useEffect } from 'react';
import { Package, Printer, FileSpreadsheet, RefreshCw, Search } from 'lucide-react';
import { reportsApi } from '../api/reportsApi';

const fmt = (v: number) => new Intl.NumberFormat('vi-VN').format(v || 0);

interface InventoryCategoryGroup {
  groupName: string;
  items: {
    id: string;
    sku: string;
    name: string;
    initialStock: number;
    importQty: number;
    exportQty: number;
    finalStock: number;
    unitPrice: number;
    totalValue: number;
    pendingExportQty: number;
    pendingOrderQty: number;
  }[];
}

export default function InventoryReportPage() {
  const [startDate, setStartDate] = useState('2026-07-01');
  const [endDate, setEndDate] = useState('2026-08-12');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showGroups, setShowGroups] = useState(true);
  const [data, setData] = useState<InventoryCategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reportsApi.getInventorySummaryReport(startDate, endDate, selectedCategory, 'category');
      setData(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setError(err?.message || 'Không thể kết nối dữ liệu báo cáo hàng tồn kho');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate, selectedCategory]);

  return (
    <div className="space-y-5 pb-12">
      {/* HEADER TITLE */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-blue-500 bg-blue-600 px-4 py-2 text-white shadow-sm">
            <Package className="h-5 w-5 text-white" />
            <h1 className="text-base font-black tracking-tight uppercase">Báo Cáo Hàng Tồn Kho</h1>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Theo dõi tồn đầu, nhập, xuất và tồn cuối thực tế theo từng nhóm hàng hóa
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-blue-600' : 'text-slate-500'} />
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
                className="h-9 rounded-xl border-2 border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
              />
              <span>Đến ngày:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 rounded-xl border-2 border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
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

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs font-bold text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showGroups}
                onChange={(e) => setShowGroups(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Hiện nhóm
            </label>
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
          <table className="w-full min-w-[1000px] border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-slate-200 bg-slate-100 text-slate-800 font-bold uppercase">
                <th className="py-2.5 px-3 text-center border-r border-slate-200 w-10">No.</th>
                <th className="py-2.5 px-3 text-left border-r border-slate-200">Mã</th>
                <th className="py-2.5 px-3 text-left border-r border-slate-200">Tên</th>
                <th className="py-2.5 px-3 text-right border-r border-slate-200">Tồn đầu</th>
                <th className="py-2.5 px-3 text-right border-r border-slate-200">Nhập</th>
                <th className="py-2.5 px-3 text-right border-r border-slate-200">Xuất</th>
                <th className="py-2.5 px-3 text-right border-r border-slate-200">Tồn cuối</th>
                <th className="py-2.5 px-3 text-right border-r border-slate-200">Giá</th>
                <th className="py-2.5 px-3 text-right border-r border-slate-200">Tiền tồn</th>
                <th className="py-2.5 px-3 text-right border-r border-slate-200">Xuất chưa giao</th>
                <th className="py-2.5 px-3 text-right">Đặt chưa giao</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400 font-bold">
                    <RefreshCw size={18} className="animate-spin inline-block mr-2 text-blue-600" />
                    Đang tính toán dữ liệu kho hàng từ cơ sở dữ liệu...
                  </td>
                </tr>
              ) : data.length > 0 ? (
                data.map((group) => {
                  const grpInit = group.items.reduce((s, i) => s + (i.initialStock || 0), 0);
                  const grpIn = group.items.reduce((s, i) => s + (i.importQty || 0), 0);
                  const grpOut = group.items.reduce((s, i) => s + (i.exportQty || 0), 0);
                  const grpFinal = group.items.reduce((s, i) => s + (i.finalStock || 0), 0);
                  const grpValue = group.items.reduce((s, i) => s + (i.totalValue || 0), 0);

                  return (
                    <React.Fragment key={group.groupName}>
                      {showGroups && (
                        <tr className="bg-slate-100 font-black text-slate-900 border-t border-slate-300">
                          <td colSpan={11} className="py-2 px-3 text-left">{group.groupName}</td>
                        </tr>
                      )}
                      {group.items.map((row, idx) => (
                        <tr key={row.id || idx} className="hover:bg-blue-50/40 transition-colors">
                          <td className="py-2 px-3 text-center border-r border-slate-200 font-semibold text-slate-600">{idx + 1}</td>
                          <td className="py-2 px-3 text-left border-r border-slate-200 font-mono font-bold text-slate-800">{row.sku}</td>
                          <td className="py-2 px-3 text-left border-r border-slate-200 font-bold text-slate-900">{row.name}</td>
                          <td className="py-2 px-3 text-right border-r border-slate-200 font-bold text-slate-700">{row.initialStock}</td>
                          <td className="py-2 px-3 text-right border-r border-slate-200 font-bold text-indigo-700">{row.importQty}</td>
                          <td className="py-2 px-3 text-right border-r border-slate-200 font-bold text-amber-700">{row.exportQty}</td>
                          <td className={`py-2 px-3 text-right border-r border-slate-200 font-black ${row.finalStock < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                            {row.finalStock}
                          </td>
                          <td className="py-2 px-3 text-right border-r border-slate-200 font-bold text-slate-800">{fmt(row.unitPrice)}</td>
                          <td className="py-2 px-3 text-right border-r border-slate-200 font-black text-slate-900">{fmt(row.totalValue)}</td>
                          <td className="py-2 px-3 text-right border-r border-slate-200 font-semibold text-slate-600">{row.pendingExportQty}</td>
                          <td className="py-2 px-3 text-right font-semibold text-slate-600">{row.pendingOrderQty}</td>
                        </tr>
                      ))}
                      {/* GROUP TOTAL */}
                      {showGroups && (
                        <tr className="bg-slate-200/70 font-black text-slate-900 border-b-2 border-slate-300">
                          <td colSpan={3} className="py-2 px-3 border-r border-slate-300"></td>
                          <td className="py-2 px-3 text-right border-r border-slate-300">{grpInit}</td>
                          <td className="py-2 px-3 text-right border-r border-slate-300">{grpIn}</td>
                          <td className="py-2 px-3 text-right border-r border-slate-300">{grpOut}</td>
                          <td className="py-2 px-3 text-right border-r border-slate-300">{grpFinal}</td>
                          <td className="py-2 px-3 border-r border-slate-300"></td>
                          <td className="py-2 px-3 text-right border-r border-slate-300">{fmt(grpValue)}</td>
                          <td className="py-2 px-3 text-right border-r border-slate-300">0</td>
                          <td className="py-2 px-3 text-right">0</td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400 font-bold">
                    Không tìm thấy dữ liệu tồn kho phù hợp
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
