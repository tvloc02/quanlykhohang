import React, { useState, useEffect, useMemo } from 'react';
import { Printer, FileSpreadsheet, RefreshCw, Search, FileText, Calendar, Filter } from 'lucide-react';
import { reportsApi } from '../api/reportsApi';

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
  badgeColor = 'bg-cyan-600 border-cyan-500',
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

  // Filtered Rows
  const rows = useMemo(() => {
    if (!Array.isArray(data)) return [];
    if (!search.trim()) return data;
    const q = search.trim().toLowerCase();
    return data.filter((item: any) =>
      Object.values(item).some((val) => String(val || '').toLowerCase().includes(q))
    );
  }, [data, search]);

  const handleExportExcel = () => {
    if (!Array.isArray(rows) || rows.length === 0) return;
    const sample = rows[0];
    const keys = Object.keys(sample).filter((k) => k !== 'id');
    const header = ['STT', ...keys].join(',');
    const csvRows = rows.map((r, idx) =>
      [idx + 1, ...keys.map((k) => `"${String(r[k] || '').replace(/"/g, '""')}"`)].join(',')
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

  return (
    <div className="space-y-6 pb-12">
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
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-cyan-600 bg-white px-4 py-2 text-xs font-bold text-cyan-700 shadow-sm hover:bg-cyan-50 transition cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-cyan-600' : 'text-cyan-700'} />
          Làm mới dữ liệu
        </button>
      </div>

      {/* FILTER CONTROL PANEL */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-pink-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-pink-700 transition cursor-pointer"
            >
              <Printer size={15} />
              In báo cáo
            </button>
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              Export Excel
            </button>

            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
              <Calendar size={14} className="text-cyan-600" />
              <span>Từ:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500"
              />
              <span>Đến:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="relative min-w-[240px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm báo cáo..."
              className="h-9 w-full rounded-xl border-2 border-slate-200 bg-white pl-9 pr-3 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* REPORT CONTENT TABLE / DATA DISPLAY */}
      <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-xs font-bold text-slate-500">
            <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-cyan-600" />
            Đang truy vấn dữ liệu từ CSDL...
          </div>
        ) : error ? (
          <div className="py-12 text-center text-xs font-bold text-red-600">{error}</div>
        ) : reportType === 'fund-balance' ? (
          /* Fund Balance Special Summary View */
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-500">Tồn quỹ đầu kỳ</p>
                <p className="text-lg font-black text-slate-800">{fmt(data.openingBalance)} đ</p>
              </div>
              <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-bold text-emerald-700">Tổng thu (Bán hàng)</p>
                <p className="text-lg font-black text-emerald-700">+{fmt(data.totalIncome)} đ</p>
              </div>
              <div className="rounded-xl border-2 border-rose-200 bg-rose-50 p-4">
                <p className="text-xs font-bold text-rose-700">Tổng chi (Nhập hàng)</p>
                <p className="text-lg font-black text-rose-700">-{fmt(data.totalExpense)} đ</p>
              </div>
              <div className="rounded-xl border-2 border-cyan-200 bg-cyan-50 p-4">
                <p className="text-xs font-bold text-cyan-800">Tồn quỹ cuối kỳ</p>
                <p className="text-lg font-black text-cyan-800">{fmt(data.closingBalance)} đ</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="text-xs font-black uppercase text-slate-700 mb-3">Phân bổ tồn quỹ</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50">
                  <span className="text-xs font-bold text-slate-600">Tiền mặt tại quỹ:</span>
                  <span className="text-sm font-black text-slate-900">{fmt(data.cashBalance)} đ</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50">
                  <span className="text-xs font-bold text-slate-600">Tiền gửi ngân hàng:</span>
                  <span className="text-sm font-black text-slate-900">{fmt(data.bankBalance)} đ</span>
                </div>
              </div>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-xs font-bold text-slate-500">
            Không tìm thấy bản ghi dữ liệu báo cáo nào trong CSDL cho kỳ này
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-cyan-50 text-slate-800 font-extrabold uppercase border-b-2 border-slate-200">
                <tr>
                  <th className="w-12 px-3 py-3.5 text-center border-r border-slate-200">STT</th>
                  {Object.keys(rows[0])
                    .filter((k) => k !== 'id')
                    .map((key) => (
                      <th key={key} className="px-4 py-3.5 border-r border-slate-200 capitalize whitespace-nowrap">
                        {key === 'code' ? 'Mã đối tượng' :
                         key === 'name' ? 'Tên đối tượng' :
                         key === 'phone' ? 'Điện thoại' :
                         key === 'address' ? 'Địa chỉ' :
                         key === 'totalOrders' ? 'Số đơn xuất' :
                         key === 'totalReceipts' ? 'Số đơn nhập' :
                         key === 'totalRevenue' ? 'Doanh thu' :
                         key === 'paidAmount' ? 'Đã thanh toán' :
                         key === 'debtAmount' ? 'Còn nợ' :
                         key === 'totalAmount' ? 'Tổng tiền' :
                         key === 'date' ? 'Ngày GD' :
                         key === 'type' ? 'Loại GD' :
                         key === 'partner' ? 'Đối tác' :
                         key === 'description' ? 'Ghi chú' :
                         key === 'amount' ? 'Số tiền' :
                         key === 'productSku' ? 'Mã sản phẩm' :
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
              <tbody className="divide-y divide-slate-200 bg-white font-medium text-slate-700">
                {rows.map((row: any, idx: number) => (
                  <tr key={row.id || idx} className="hover:bg-cyan-50/50 transition">
                    <td className="px-3 py-3 text-center border-r border-slate-200 font-bold text-slate-500">
                      {idx + 1}
                    </td>
                    {Object.keys(row)
                      .filter((k) => k !== 'id')
                      .map((key) => {
                        const val = row[key];
                        const isNum = typeof val === 'number';
                        return (
                          <td
                            key={key}
                            className={`px-4 py-3 border-r border-slate-200 whitespace-nowrap ${
                              isNum ? 'text-right font-bold text-slate-900' : ''
                            } ${key === 'type' && val === 'THU' ? 'text-emerald-700 font-black' : key === 'type' && val === 'CHI' ? 'text-rose-700 font-black' : ''}`}
                          >
                            {isNum ? (key.toLowerCase().includes('qty') || key.toLowerCase().includes('stock') || key.toLowerCase().includes('orders') || key.toLowerCase().includes('receipts') ? val : `${fmt(val)} đ`) : (val || '-')}
                          </td>
                        );
                      })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
