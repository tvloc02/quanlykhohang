import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  FileSpreadsheet,
  ArrowRight,
  Printer,
  X,
  Save,
  CheckCircle,
  XCircle,
  Receipt,
  Check,
  Maximize2,
  Minimize2,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
} from 'lucide-react';
import { readStoredReceiptVouchers, saveStoredReceiptVouchers, ReceiptVoucher } from './ReceiptVouchersPage';
import * as XLSX from 'xlsx';

export interface ExportBillInvoice {
  id: string;
  branch: string;
  staffName: string;
  code: string;
  date: string;
  customerName: string;
  address: string;
  phone: string;
  totalAmount: number;
  paidAmount: number;
  status: 'Đã thu' | 'Chưa thu' | 'Thu một phần';
}

const API_BASE_URL = '/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

export default function ReceiptFromBillPage() {
  const [bills, setBills] = useState<ExportBillInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Column visibility state
  const [columnVis, setColumnVis] = useState({
    branch: true,
    staffName: true,
    code: true,
    date: true,
    customerName: true,
    totalAmount: true,
    paidAmount: true,
    status: true,
  });
  const [showColumnModal, setShowColumnModal] = useState(false);

  // Filter states
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination states
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal Collect Payment
  const [activeBill, setActiveBill] = useState<ExportBillInvoice | null>(null);
  const [form, setForm] = useState<ReceiptVoucher>({
    id: '',
    code: '',
    date: new Date().toISOString().split('T')[0],
    type: '101 Thu tiền bán hàng',
    targetName: '',
    addressTel: '-',
    paymentMethod: 'Tiền mặt',
    wallet: 'Ví tiền mặt chính',
    amount: 0,
    remainingDebt: 0,
    staffName: 'Admin',
    note: '',
  });

  // Toast
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Load Real Outbound Orders from backend API
  useEffect(() => {
    const loadRealOrders = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/outbounds`, { headers: authHeaders() }).catch(() => null);
        if (response && response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            const receiptVouchers = readStoredReceiptVouchers();

            const mapped: ExportBillInvoice[] = data.map((item: any) => {
              const orderNo = item.orderNo || `XBH_${item.id.slice(0, 6)}`;
              const lineTotal = (item.details || []).reduce(
                (sum: number, d: any) => sum + (Number(d.requiredQty || 0) * Number(d.unitPrice || 0)),
                0
              );
              const totalAmount = lineTotal > 0 ? lineTotal : (item.items || 1) * 500000;

              const matchedReceipts = receiptVouchers.filter((rv) => rv.note.includes(orderNo));
              const paidAmount = matchedReceipts.reduce((sum, rv) => sum + rv.amount, 0);

              const status: 'Đã thu' | 'Chưa thu' | 'Thu một phần' =
                paidAmount >= totalAmount ? 'Đã thu' : paidAmount > 0 ? 'Thu một phần' : 'Chưa thu';

              return {
                id: String(item.id),
                branch: 'Kho Tổng',
                staffName: item.createdBy?.fullName || 'N/A',
                code: orderNo,
                date: item.dueDate ? new Date(item.dueDate).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN'),
                customerName: item.customer || 'Khách hàng lẻ',
                address: '-',
                phone: '-',
                totalAmount,
                paidAmount,
                status,
              };
            });
            setBills(mapped);
          }
        }
      } catch {
        // quiet error
      } finally {
        setLoading(false);
      }
    };

    loadRealOrders();
  }, []);

  const handleOpenCollectModal = (bill: ExportBillInvoice) => {
    setActiveBill(bill);
    const existingVouchers = readStoredReceiptVouchers();
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const newCode = `PT-${dateStr}-${String(existingVouchers.length + 1).padStart(3, '0')}`;
    const uncollected = bill.totalAmount - bill.paidAmount;

    setForm({
      id: `pt-${Date.now()}`,
      code: newCode,
      date: new Date().toISOString().split('T')[0],
      type: '101 Thu tiền bán hàng',
      targetName: bill.customerName,
      addressTel: `${bill.address} ${bill.phone}`.trim() || '-',
      paymentMethod: 'Tiền mặt',
      wallet: 'Ví tiền mặt chính',
      amount: uncollected > 0 ? uncollected : bill.totalAmount,
      remainingDebt: 0,
      staffName: bill.staffName || 'Admin',
      note: `Thu tiền bán hàng theo phiếu xuất ${bill.code}`,
    });
  };

  const handleSaveCollectPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBill) return;

    if (!form.amount || form.amount <= 0) {
      showToast('Vui lòng nhập số tiền thu hợp lệ lớn hơn 0!', 'error');
      return;
    }

    const existing = readStoredReceiptVouchers();
    const updatedVouchers = [form, ...existing];
    saveStoredReceiptVouchers(updatedVouchers);

    const updatedBills = bills.map((b) => {
      if (b.id === activeBill.id) {
        const newPaid = b.paidAmount + form.amount;
        const newStatus: 'Đã thu' | 'Chưa thu' | 'Thu một phần' =
          newPaid >= b.totalAmount ? 'Đã thu' : newPaid > 0 ? 'Thu một phần' : 'Chưa thu';
        return { ...b, paidAmount: newPaid, status: newStatus };
      }
      return b;
    });

    setBills(updatedBills);
    setActiveBill(null);
    showToast(`Đã thu thành công ${form.amount.toLocaleString('vi-VN')} đ cho phiếu ${activeBill.code}!`);
  };

  const handleExportExcel = () => {
    const dataToExport = filteredBills.map((b, i) => ({
      STT: i + 1,
      'Chi nhánh': b.branch,
      'NV tạo': b.staffName,
      'Mã phiếu xuất': b.code,
      'Ngày lập': b.date,
      'Tên khách hàng': b.customerName,
      'Tổng tiền (VND)': b.totalAmount,
      'Thực thu (VND)': b.paidAmount,
      'Trạng thái': b.status,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Thu_Tien_Phieu_Xuat');
    XLSX.writeFile(wb, `Thu_Tien_Phieu_Xuat_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      const matchesSearch =
        !searchQuery ||
        b.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.phone.includes(searchQuery);

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'PAID' && b.status === 'Đã thu') ||
        (statusFilter === 'UNPAID' && b.status !== 'Đã thu');

      return matchesSearch && matchesStatus;
    });
  }, [bills, searchQuery, statusFilter]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // Pagination calculations
  const totalItems = filteredBills.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);
  const paginatedBills = filteredBills.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className={`space-y-6 text-slate-800 ${isFullScreen ? 'fixed inset-0 z-[9000] bg-white overflow-y-auto p-6' : ''}`}>
      {/* TOAST NOTIFICATION */}
      {toastMessage &&
        createPortal(
          <div
            className={`fixed top-6 right-6 z-[9999] flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl border backdrop-blur-md animate-in slide-in-from-top-4 ${
              toastType === 'error'
                ? 'bg-red-50/95 text-red-700 border-red-200'
                : 'bg-emerald-50/95 text-emerald-800 border-emerald-200'
            }`}
          >
            {toastType === 'error' ? <XCircle className="h-5 w-5 text-red-600" /> : <CheckCircle className="h-5 w-5 text-emerald-600" />}
            <p className="text-sm font-extrabold">{toastMessage}</p>
          </div>,
          document.body
        )}

      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Top Header Section matching Inbound/Outbound */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2.5 rounded-2xl bg-cyan-600 px-5 py-2.5 text-white shadow-md">
              <Receipt className="h-5 w-5" />
              <h1 className="text-xl font-extrabold tracking-tight uppercase">THU TIỀN TỪ PHIẾU XUẤT BÁN HÀNG</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Thu tiền từ Excel */}
            <button
              type="button"
              onClick={() => showToast('Tính năng nhập từ Excel sẵn sàng!')}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            >
              <FileSpreadsheet className="h-4.5 w-4.5 text-cyan-700" />
              Thu tiền từ Excel
            </button>

            {/* 2. In báo cáo */}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            >
              <Printer className="h-4.5 w-4.5 text-cyan-700" />
              In báo cáo
            </button>

            {/* 3. Export Excel */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            >
              <FileSpreadsheet className="h-4.5 w-4.5 text-cyan-700" />
              Export Excel
            </button>

            {/* 4. Hiển thị */}
            <button
              type="button"
              onClick={() => setShowColumnModal(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            >
              <Settings className="h-4.5 w-4.5 text-cyan-700" />
              Hiển thị
            </button>

            {/* 5. Toàn màn hình */}
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-4 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
              title={isFullScreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            >
              {isFullScreen ? <Minimize2 className="h-4.5 w-4.5 text-cyan-700" /> : <Maximize2 className="h-4.5 w-4.5 text-cyan-700" />}
            </button>
          </div>
        </div>

        {/* High-density Filter & Search Bar */}
        <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input h-12 */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm theo mã phiếu xuất, tên khách hàng, SĐT..."
                className="h-12 w-full rounded-xl border-2 border-cyan-600/30 bg-slate-50/50 pl-11 pr-4 text-sm font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
              />
            </div>

            {/* Filters Container (h-12) */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Date Box */}
              <div className="inline-flex h-12 items-center gap-2 rounded-xl border-2 border-cyan-600/30 bg-slate-50/80 px-3.5 shadow-2xs">
                <span className="text-xs font-extrabold uppercase text-cyan-950 tracking-wide">Từ ngày:</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-9 rounded-lg border-2 border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
                />
                <span className="text-xs font-extrabold uppercase text-cyan-950 tracking-wide ml-1">Đến:</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-9 rounded-lg border-2 border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
                />
              </div>

              {/* Status Filter */}
              <div className="inline-flex h-12 items-center gap-2 rounded-xl border-2 border-cyan-600/30 bg-slate-50/80 px-3.5 shadow-2xs">
                <Filter className="h-4 w-4 text-cyan-600 shrink-0" />
                <span className="text-xs font-extrabold uppercase text-cyan-950 tracking-wide">Trạng thái:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9 rounded-lg border-2 border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="UNPAID">Chưa thu đủ</option>
                  <option value="PAID">Đã thu xong</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* High-density Table */}
        <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse text-left min-w-[1350px]">
              <thead className="bg-cyan-50 sticky top-0 z-20 shadow-sm">
                <tr className="border-b-2 border-slate-200 text-slate-800 font-extrabold uppercase text-xs sm:text-sm tracking-wider">
                  <th className="w-14 min-w-[60px] border-r border-slate-200 px-3 py-4 text-center">STT</th>
                  {columnVis.branch && <th className="min-w-[150px] border-r border-slate-200 px-4 py-4 text-center">Chi nhánh</th>}
                  {columnVis.staffName && <th className="min-w-[150px] border-r border-slate-200 px-4 py-4 text-center">NV tạo</th>}
                  {columnVis.code && <th className="min-w-[210px] border-r border-slate-200 px-4 py-4 text-center whitespace-nowrap">Mã phiếu xuất</th>}
                  {columnVis.date && <th className="min-w-[140px] border-r border-slate-200 px-4 py-4 text-center">Ngày lập</th>}
                  {columnVis.customerName && <th className="min-w-[200px] border-r border-slate-200 px-4 py-4 text-center">Tên Khách hàng</th>}
                  {columnVis.totalAmount && <th className="min-w-[160px] border-r border-slate-200 px-4 py-4 text-center">Tổng tiền (VND)</th>}
                  {columnVis.paidAmount && <th className="min-w-[160px] border-r border-slate-200 px-4 py-4 text-center">Thực thu (VND)</th>}
                  {columnVis.status && <th className="min-w-[140px] border-r border-slate-200 px-3 py-4 text-center">Trạng thái</th>}
                  <th className="sticky right-0 top-0 z-30 w-40 min-w-[160px] bg-cyan-100 px-3 py-4 text-center shadow-[-4px_0_12px_rgba(0,0,0,0.05)] border-l border-slate-200 text-cyan-950 font-black">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500 font-semibold text-sm">
                      Đang tải danh sách phiếu xuất bán hàng...
                    </td>
                  </tr>
                ) : paginatedBills.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500 font-semibold text-sm">
                      Không tìm thấy phiếu xuất nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  paginatedBills.map((b, index) => {
                    const globalIndex = (currentPage - 1) * pageSize + index + 1;
                    const isFullyPaid = b.status === 'Đã thu' || b.paidAmount >= b.totalAmount;

                    return (
                      <tr
                        key={b.id}
                        className="group border-b border-slate-200 transition hover:bg-cyan-50/60"
                      >
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-medium text-slate-700">
                          {globalIndex}
                        </td>
                        {columnVis.branch && <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-semibold text-slate-700">{b.branch}</td>}
                        {columnVis.staffName && <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-bold text-slate-800">{b.staffName}</td>}
                        {columnVis.code && (
                          <td className="border-r border-slate-200 px-4 py-3.5 text-sm font-mono font-extrabold text-cyan-700 whitespace-nowrap text-center">
                            {b.code}
                          </td>
                        )}
                        {columnVis.date && <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-medium text-slate-600">{b.date}</td>}
                        {columnVis.customerName && <td className="border-r border-slate-200 px-4 py-3.5 text-sm font-bold text-slate-900">{b.customerName}</td>}
                        {columnVis.totalAmount && (
                          <td className="border-r border-slate-200 px-4 py-3.5 text-right text-sm font-mono font-bold text-slate-900">
                            {b.totalAmount.toLocaleString('vi-VN')} đ
                          </td>
                        )}
                        {columnVis.paidAmount && (
                          <td className="border-r border-slate-200 px-4 py-3.5 text-right text-sm font-mono font-black text-emerald-600">
                            {b.paidAmount.toLocaleString('vi-VN')} đ
                          </td>
                        )}
                        {columnVis.status && (
                          <td className="border-r border-slate-200 px-3 py-3.5 text-center">
                            <span className={`inline-flex items-center gap-1 rounded-xl px-3 py-1 text-xs font-black border ${
                              isFullyPaid
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-amber-100 text-amber-800 border-amber-300'
                            }`}>
                              {isFullyPaid ? <Check size={13} /> : null}
                              {b.status}
                            </span>
                          </td>
                        )}

                        {/* Sticky Action Column */}
                        <td className="sticky right-0 top-0 z-10 border-l border-slate-200 bg-white px-3 py-3.5 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.05)] group-hover:bg-cyan-50">
                          {isFullyPaid ? (
                            <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700 border border-emerald-200">
                              <Check size={14} />
                              Đã hoàn tất
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenCollectModal(b)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 px-3.5 py-1.5 text-xs font-black text-white shadow-sm transition active:scale-95 cursor-pointer"
                            >
                              <ArrowRight size={14} />
                              Thu tiền
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Standardized Pagination Bar */}
          {totalItems > 0 && (
            <div className="flex flex-col items-center justify-between border-t-2 border-slate-200 bg-slate-50/80 px-6 py-4 sm:flex-row gap-4">
              <div className="text-sm font-semibold text-slate-600">
                Hiển thị <span className="font-extrabold text-slate-900">{startIndex}</span> - <span className="font-extrabold text-slate-900">{endIndex}</span> trên tổng số <span className="font-extrabold text-slate-900">{totalItems}</span> phiếu xuất
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-700">Hiển thị:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="h-10 rounded-xl border-2 border-cyan-600/30 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-cyan-600 cursor-pointer"
                  >
                    <option value={20}>20 / trang</option>
                    <option value={50}>50 / trang</option>
                    <option value={100}>100 / trang</option>
                    <option value={500}>500 / trang</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-600 transition hover:bg-cyan-50 hover:text-cyan-700 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
                    title="Trang đầu"
                  >
                    <ChevronsLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-600 transition hover:bg-cyan-50 hover:text-cyan-700 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
                    title="Trang trước"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  <span className="flex h-10 items-center justify-center rounded-xl bg-cyan-600 px-4 text-sm font-black text-white shadow-xs">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-600 transition hover:bg-cyan-50 hover:text-cyan-700 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
                    title="Trang sau"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-600 transition hover:bg-cyan-50 hover:text-cyan-700 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
                    title="Trang cuối"
                  >
                    <ChevronsRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* COLUMN VISIBILITY MODAL */}
      {showColumnModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm animate-in fade-in-50">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border-2 border-cyan-500 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-slate-200 bg-cyan-50 px-6 py-4">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-cyan-700" />
                <h3 className="text-base font-extrabold text-slate-800 uppercase">Cấu hình hiển thị cột</h3>
              </div>
              <button onClick={() => setShowColumnModal(false)} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 transition cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {[
                { key: 'branch', label: 'Chi nhánh' },
                { key: 'staffName', label: 'NV tạo' },
                { key: 'code', label: 'Mã phiếu xuất' },
                { key: 'date', label: 'Ngày lập' },
                { key: 'customerName', label: 'Tên Khách hàng' },
                { key: 'totalAmount', label: 'Tổng tiền (VND)' },
                { key: 'paidAmount', label: 'Thực thu (VND)' },
                { key: 'status', label: 'Trạng thái' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 p-2 rounded-xl hover:bg-cyan-50/50 cursor-pointer font-bold text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={(columnVis as any)[key]}
                    onChange={(e) => setColumnVis({ ...columnVis, [key]: e.target.checked })}
                    className="h-4.5 w-4.5 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-end gap-3 border-t-2 border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowColumnModal(false)}
                className="rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-extrabold text-white hover:bg-cyan-700 shadow-md transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP COLLECT PAYMENT MODAL */}
      {activeBill && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm animate-in fade-in-50">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border-2 border-cyan-500 bg-white shadow-2xl space-y-0">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-200 bg-cyan-50 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-3.5 py-1.5 text-white font-black text-sm">
                  <Receipt className="h-4.5 w-4.5" />
                  THU TIỀN THEO PHIẾU XUẤT ({activeBill.code})
                </div>
              </div>
              <button
                onClick={() => setActiveBill(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSaveCollectPayment} className="p-6 space-y-4 text-xs font-bold text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-700 font-extrabold">Ngày lập phiếu thu <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 font-extrabold">Mã phiếu thu <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 font-mono text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-700 font-extrabold">Đối tượng (Khách hàng)</label>
                <input
                  type="text"
                  value={form.targetName}
                  onChange={(e) => setForm({ ...form, targetName: e.target.value })}
                  className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <label className="text-slate-700 font-extrabold">Hình thức thanh toán</label>
                <div className="flex flex-wrap items-center gap-6 pt-1">
                  {(['Tiền mặt', 'Chuyển khoản', 'COD', 'ATM'] as const).map((method) => (
                    <label key={method} className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-800">
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={form.paymentMethod === method}
                        onChange={() => setForm({ ...form, paymentMethod: method })}
                        className="h-4 w-4 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                      />
                      <span>{method}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Wallet Select */}
              <div className="space-y-1.5">
                <label className="text-slate-700 font-extrabold">Ví tiền mặt / Tài khoản nhận</label>
                <select
                  value={form.wallet}
                  onChange={(e) => setForm({ ...form, wallet: e.target.value })}
                  className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10 cursor-pointer"
                >
                  <option value="Ví tiền mặt chính">Ví tiền mặt chính</option>
                  <option value="BIDV - CN.Thăng Long">BIDV - CN.Thăng Long</option>
                  <option value="Vietcombank - Chi nhánh Hà Nội">Vietcombank - Chi nhánh Hà Nội</option>
                </select>
              </div>

              {/* Amount Highlight Field */}
              <div className="space-y-1.5 pt-1">
                <label className="text-red-600 font-black text-sm uppercase">Số tiền thu thực tế (VND):</label>
                <div className="flex items-center gap-2 max-w-md">
                  <input
                    type="number"
                    step="1000"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border-2 border-red-500 bg-slate-50 px-4 py-2.5 text-lg font-mono font-black text-red-600 outline-none focus:bg-white focus:ring-4 focus:ring-red-500/10"
                  />
                  <span className="rounded-xl border-2 border-red-500 bg-white px-3 py-2.5 font-black text-red-600 text-sm">
                    VND
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-700 font-extrabold">Nội dung / Ghi chú</label>
                <textarea
                  rows={2}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className="w-full rounded-xl border-2 border-cyan-500 bg-white p-3 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>

              {/* Modal Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-slate-200">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-cyan-700 transition cursor-pointer"
                >
                  <Save size={16} />
                  Lưu & Xác nhận thu
                </button>

                <button
                  type="button"
                  onClick={() => setActiveBill(null)}
                  className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X size={16} />
                  Đóng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
