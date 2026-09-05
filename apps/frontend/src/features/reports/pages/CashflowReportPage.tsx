import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  Printer,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Calendar,
  Settings,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  SlidersHorizontal,
} from 'lucide-react';
import { reportsApi } from '../api/reportsApi';
import { ReportPrintHeader } from '../components/ReportPrintHeader';
import { ReportPrintFooter } from '../components/ReportPrintFooter';

const fmt = (v: number) => new Intl.NumberFormat('vi-VN').format(Math.round(v || 0));

function getInitialDates() {
  const now = new Date();
  const past30 = new Date(now);
  past30.setDate(past30.getDate() - 30);
  const formatD = (d: Date) => d.toISOString().split('T')[0];
  return { firstDay: formatD(past30), today: formatD(now) };
}

interface CashflowItem {
  id: string;
  title: string;
  income: number;
  expense: number;
  balance: number;
}

interface CashflowGroup {
  groupName: string;
  items: CashflowItem[];
}

export default function CashflowReportPage() {
  const { firstDay, today } = useMemo(() => getInitialDates(), []);
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(today);
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState<CashflowGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination states
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Fullscreen state
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Column settings modal
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [columnVis, setColumnVis] = useState({
    title: true,
    income: true,
    expense: true,
    balance: true,
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
    const handleFSChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

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

  // Filter dataset by search term
  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data
      .map((g) => {
        const matchedItems = g.items.filter(
          (i) => i.title.toLowerCase().includes(term) || g.groupName.toLowerCase().includes(term)
        );
        return matchedItems.length > 0 ? { ...g, items: matchedItems } : null;
      })
      .filter(Boolean) as CashflowGroup[];
  }, [data, searchTerm]);

  const allItems = useMemo(() => {
    return filteredGroups.flatMap((g) => g.items);
  }, [filteredGroups]);

  const totalPages = Math.ceil(allItems.length / pageSize) || 1;

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    let balance = 0;

    filteredGroups.forEach((group) => {
      group.items.forEach((item) => {
        income += item.income || 0;
        expense += item.expense || 0;
        balance += item.balance || 0;
      });
    });

    return { income, expense, balance };
  }, [filteredGroups]);

  const handleExportExcel = () => {
    if (allItems.length === 0) return;
    const headers = ['STT', 'Nội dung thu chi', 'Thu', 'Chi', 'Số dư tồn quỹ'];
    const rows: any[] = [];
    let idx = 1;
    filteredGroups.forEach((g) => {
      g.items.forEach((i) => {
        rows.push([idx++, `"${g.groupName} - ${i.title.replace(/"/g, '""')}"`, i.income, i.expense, i.balance]);
      });
    });
    const summaryRow = ['Tổng cộng', '', totals.income, totals.expense, totals.balance];
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(',')), summaryRow.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Bao_Cao_Thu_Chi_${startDate}_den_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* ─── HEADER BÁO CÁO KHI IN ─── */}
      <ReportPrintHeader
        title="BÁO CÁO THU CHI QUỸ TỒN"
        subtitle={
          startDate && endDate
            ? `Kỳ báo cáo: Từ ngày ${startDate} đến ngày ${endDate}`
            : `Ngày lập: ${new Date().toLocaleDateString('vi-VN')}`
        }
        subInfo={`Tổng số mục: ${allItems.length} mục giao dịch`}
      />

      <div className="space-y-4 pb-12 animate-in fade-in duration-200">
        {/* ═══ TOP HEADER SECTION matching Sales Report Standard ═══ */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2.5 rounded-2xl bg-cyan-600 px-5 py-2.5 text-white shadow-md">
            <DollarSign className="h-5 w-5" />
            <h1 className="text-xl font-extrabold tracking-tight uppercase">BÁO CÁO THU CHI QUỸ TỒN</h1>
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
            onClick={() => setShowColumnSettings(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            title="Cấu hình hiển thị cột"
          >
            <Settings className="h-4.5 w-4.5 text-cyan-700" />
            <span>Hiển thị</span>
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

      {/* ═══ FILTER & SEARCH PANEL ═══ */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm space-y-3 print:hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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
              placeholder="Tìm theo nội dung giao dịch thu chi..."
            />
          </div>

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
                className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4 text-xs font-extrabold text-rose-700">
          {error}
        </div>
      )}

      {/* ═══ DATA TABLE ═══ */}
      <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[850px] border-collapse text-left">
            <thead className="bg-cyan-600 text-white sticky top-0 z-20 shadow-sm">
              <tr className="border-b-2 border-cyan-700 text-white font-extrabold uppercase text-xs sm:text-sm tracking-wider">
                <th className="w-14 min-w-[60px] border-r border-cyan-500/50 px-3 py-3.5 text-center">STT</th>
                {columnVis.title && <th className="min-w-[260px] border-r border-cyan-500/50 px-4 py-3.5 text-center">Nội dung thu chi</th>}
                {columnVis.income && <th className="min-w-[180px] border-r border-cyan-500/50 px-3 py-3.5 text-center text-white font-black">Thu tiền (đ)</th>}
                {columnVis.expense && <th className="min-w-[180px] border-r border-cyan-500/50 px-3 py-3.5 text-center font-black text-white">Chi tiền (đ)</th>}
                {columnVis.balance && <th className="min-w-[200px] px-4 py-3.5 text-center text-white font-black">Số dư tồn quỹ (đ)</th>}
              </tr>
              {/* Summary Row inside Header */}
              <tr className="bg-slate-100 border-b-2 border-slate-300 font-black text-slate-900 text-xs sm:text-sm">
                <td colSpan={2} className="py-3 px-4 border-r border-slate-200 uppercase tracking-wide">
                  TỔNG CỘNG ({allItems.length} giao dịch):
                </td>
                {columnVis.income && <td className="py-3 px-3 text-right border-r border-slate-200 text-slate-900 font-black">{fmt(totals.income)} đ</td>}
                {columnVis.expense && <td className="py-3 px-3 text-right border-r border-slate-200 text-slate-900 font-black">{fmt(totals.expense)} đ</td>}
                {columnVis.balance && <td className="py-3 px-4 text-right text-slate-900 font-black">{fmt(totals.balance)} đ</td>}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-bold">
                    <RefreshCw size={20} className="animate-spin inline-block mr-2 text-slate-600" />
                    Đang tính toán dòng tiền thu chi...
                  </td>
                </tr>
              ) : filteredGroups.length > 0 ? (
                filteredGroups.map((group) => {
                  const grpInc = group.items.reduce((s, i) => s + (i.income || 0), 0);
                  const grpExp = group.items.reduce((s, i) => s + (i.expense || 0), 0);
                  const grpBal = group.items.reduce((s, i) => s + (i.balance || 0), 0);

                  return (
                    <React.Fragment key={group.groupName}>
                      <tr className="bg-slate-100 font-extrabold text-slate-800 border-t-2 border-slate-200">
                        <td colSpan={5} className="py-2.5 px-4 text-left uppercase tracking-wider">{group.groupName}</td>
                      </tr>
                      {group.items.map((row, idx) => (
                        <tr key={row.id || idx} className="hover:bg-slate-50 transition group">
                          <td className="py-3.5 px-3 text-center border-r border-slate-200 font-normal text-slate-900">{idx + 1}</td>
                          {columnVis.title && <td className="py-3.5 px-4 text-left border-r border-slate-200 font-normal text-slate-900">{row.title}</td>}
                          {columnVis.income && <td className="py-3.5 px-3 text-right border-r border-slate-200 font-normal text-slate-900">{row.income ? `${fmt(row.income)} đ` : '0 đ'}</td>}
                          {columnVis.expense && <td className="py-3.5 px-3 text-right border-r border-slate-200 font-normal text-slate-900">{row.expense ? `${fmt(row.expense)} đ` : '0 đ'}</td>}
                          {columnVis.balance && <td className="py-3.5 px-4 text-right font-normal text-slate-900">{fmt(row.balance)} đ</td>}
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-bold text-slate-900 border-b-2 border-slate-200">
                        <td colSpan={2} className="py-2.5 px-4 text-left border-r border-slate-200 uppercase font-bold">Cộng nhóm:</td>
                        {columnVis.income && <td className="py-2.5 px-3 text-right border-r border-slate-200 text-slate-900 font-bold">{fmt(grpInc)} đ</td>}
                        {columnVis.expense && <td className="py-2.5 px-3 text-right border-r border-slate-200 text-slate-800 font-bold">{fmt(grpExp)} đ</td>}
                        {columnVis.balance && <td className="py-2.5 px-4 text-right text-slate-900 font-bold">{fmt(grpBal)} đ</td>}
                      </tr>
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-bold">
                    Không tìm thấy dữ liệu thu chi phù hợp
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer matching Sales Report */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border-t-2 border-slate-200 text-xs font-extrabold text-slate-700 print:hidden">
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
            </select>
            <span>dòng/trang</span>
            <span className="mx-2 text-slate-300">|</span>
            <span>Tổng cộng {allItems.length} mục giao dịch</span>
          </div>

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

      {/* ─── CHỮ KÝ BÁO CÁO KHI IN ─── */}
      <ReportPrintFooter />

      {/* ═══ COLUMN VISIBILITY MODAL ═══ */}
      {showColumnSettings && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in print:hidden">
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
                title: 'Nội dung thu chi',
                income: 'Thu tiền',
                expense: 'Chi tiền',
                balance: 'Số dư tồn quỹ',
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
      </div>

      {/* ─── CHỮ KÝ BÁO CÁO KHI IN ─── */}
      <ReportPrintFooter />
    </>
  );
}
