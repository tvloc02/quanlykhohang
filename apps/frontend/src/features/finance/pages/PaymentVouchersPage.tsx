import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Trash2,
  Printer,
  FileSpreadsheet,
  Search,
  X,
  Save,
  CheckCircle,
  XCircle,
  CreditCard,
  Eye,
  Pencil,
  DollarSign,
  Calendar,
} from 'lucide-react';
import * as XLSX from 'xlsx';

export interface PaymentVoucher {
  id: string;
  code: string;
  date: string;
  type: string;
  targetName: string;
  addressTel: string;
  paymentMethod: 'Tiền mặt' | 'Chuyển khoản' | 'COD' | 'ATM';
  wallet: string;
  amount: number;
  staffName: string;
  note: string;
}

const STORAGE_KEY = 'smart-wms-payment-vouchers-data';
const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

export function readStoredPaymentVouchers(): PaymentVoucher[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // fallback
  }
  return [];
}

export function saveStoredPaymentVouchers(items: PaymentVoucher[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('storage'));
}

export default function PaymentVouchersPage() {
  const [vouchers, setVouchers] = useState<PaymentVoucher[]>(readStoredPaymentVouchers);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Real Options from System
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; phone?: string; address?: string }[]>([]);
  const [staffList, setStaffList] = useState<{ id: string; fullName: string; email: string }[]>([]);

  // Filter states
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('ALL');

  // Pagination states matching Personnel.tsx
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'view' | 'edit' | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Current logged in user
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  })();
  const defaultStaffName = currentUser.fullName || currentUser.email || 'Admin';

  // Form State
  const [form, setForm] = useState<PaymentVoucher>({
    id: '',
    code: '',
    date: new Date().toISOString().split('T')[0],
    type: '201 Chi trả nhà cung cấp',
    targetName: '',
    addressTel: '-',
    paymentMethod: 'Tiền mặt',
    wallet: 'Ví tiền mặt chính',
    amount: 0,
    staffName: defaultStaffName,
    note: '',
  });

  // Load Real Suppliers & Staff from System API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [supRes, userRes] = await Promise.all([
          fetch(`${API_BASE_URL}/suppliers`, { headers: authHeaders() }).catch(() => null),
          fetch(`${API_BASE_URL}/users`, { headers: authHeaders() }).catch(() => null),
        ]);

        if (supRes && supRes.ok) {
          const data = await supRes.json();
          if (Array.isArray(data)) {
            setSuppliers(
              data.map((s: any) => ({
                id: String(s.id),
                name: String(s.name || s.fullName || s.code),
                phone: s.phone,
                address: s.address,
              }))
            );
          }
        }

        if (userRes && userRes.ok) {
          const data = await userRes.json();
          if (Array.isArray(data)) {
            setStaffList(
              data.map((u: any) => ({
                id: String(u.id),
                fullName: String(u.fullName || u.email?.split('@')[0]),
                email: String(u.email),
              }))
            );
          }
        }
      } catch {
        // quiet fallback
      }
    };
    fetchData();
  }, []);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleOpenCreateModal = () => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const newCode = `PC-${dateStr}-${String(vouchers.length + 1).padStart(3, '0')}`;
    setForm({
      id: `pc-${Date.now()}`,
      code: newCode,
      date: new Date().toISOString().split('T')[0],
      type: '201 Chi trả nhà cung cấp',
      targetName: '',
      addressTel: '-',
      paymentMethod: 'Tiền mặt',
      wallet: 'Ví tiền mặt chính',
      amount: 0,
      staffName: defaultStaffName,
      note: '',
    });
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: PaymentVoucher, mode: 'view' | 'edit' = 'edit') => {
    setForm({ ...item });
    setModalMode(mode);
    setIsModalOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || form.amount <= 0) {
      showToast('Vui lòng nhập số tiền chi hợp lệ lớn hơn 0!', 'error');
      return;
    }

    let updated: PaymentVoucher[];
    if (modalMode === 'edit') {
      updated = vouchers.map((v) => (v.id === form.id ? form : v));
      showToast(`Đã cập nhật phiếu chi ${form.code} thành công!`);
    } else {
      updated = [form, ...vouchers];
      showToast(`Đã tạo mới phiếu chi ${form.code} thành công!`);
    }

    setVouchers(updated);
    saveStoredPaymentVouchers(updated);
    setIsModalOpen(false);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} phiếu chi đã chọn?`)) {
      const updated = vouchers.filter((v) => !selectedIds.includes(v.id));
      setVouchers(updated);
      saveStoredPaymentVouchers(updated);
      setSelectedIds([]);
      showToast(`Đã xóa ${selectedIds.length} phiếu chi!`);
    }
  };

  const handleDeleteSingle = (id: string, code: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa phiếu chi ${code}?`)) {
      const updated = vouchers.filter((v) => v.id !== id);
      setVouchers(updated);
      saveStoredPaymentVouchers(updated);
      if (selectedIds.includes(id)) {
        setSelectedIds(selectedIds.filter((item) => item !== id));
      }
      showToast(`Đã xóa phiếu chi ${code}!`);
    }
  };

  const handleExportExcel = () => {
    const dataToExport = filteredVouchers.map((v, i) => ({
      STT: i + 1,
      'Mã phiếu': v.code,
      'Ngày lập': v.date,
      'Nội dung chi': v.type,
      'Đối tượng': v.targetName,
      'Số tiền (VND)': v.amount,
      'Hình thức': v.paymentMethod,
      'Nhân viên': v.staffName,
      'Ghi chú': v.note,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Danh_Sach_Phieu_Chi');
    XLSX.writeFile(wb, `Danh_Sach_Phieu_Chi_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      const matchesSearch =
        !searchQuery ||
        v.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.targetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.type.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesFrom = !fromDate || v.date >= fromDate;
      const matchesTo = !toDate || v.date <= toDate;
      const matchesMethod = paymentMethodFilter === 'ALL' || v.paymentMethod === paymentMethodFilter;

      return matchesSearch && matchesFrom && matchesTo && matchesMethod;
    });
  }, [vouchers, searchQuery, fromDate, toDate, paymentMethodFilter]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, fromDate, toDate, paymentMethodFilter]);

  // Pagination calculations matching Personnel.tsx
  const totalItems = filteredVouchers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);
  const paginatedVouchers = filteredVouchers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalAmount = filteredVouchers.reduce((sum, v) => sum + v.amount, 0);
  const todayDateStr = new Date().toISOString().split('T')[0];
  const todayAmount = filteredVouchers
    .filter((v) => v.date === todayDateStr)
    .reduce((sum, v) => sum + v.amount, 0);

  return (
    <div className="space-y-6 pb-12 text-slate-800">
      {/* TOAST NOTIFICATION MATCHING PERSONNEL.TSX */}
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

      {/* HEADER MATCHING PERSONNEL.TSX PILL BADGE DESIGN */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2.5 rounded-2xl bg-cyan-600 px-5 py-2.5 text-white shadow-md">
            <CreditCard className="h-5 w-5" />
            <h1 className="text-xl font-extrabold tracking-tight uppercase">Viết phiếu chi tiền</h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700 active:scale-95 cursor-pointer"
          >
            <Plus className="h-4.5 w-4.5" />
            Tạo phiếu chi mới
          </button>
        </div>
      </div>

      {/* 3 STAT OVERVIEW CARDS MATCHING PERSONNEL.TSX */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex h-[72px] items-center justify-between rounded-xl border-2 border-cyan-500 bg-white px-5 shadow-sm transition hover:bg-cyan-50">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">TỔNG SỐ PHIẾU CHI</p>
            <p className="text-lg font-black text-cyan-700">{filteredVouchers.length} Phiếu</p>
          </div>
          <div className="rounded-xl bg-cyan-100 p-2 text-cyan-700">
            <CreditCard size={22} />
          </div>
        </div>

        <div className="flex h-[72px] items-center justify-between rounded-xl border-2 border-cyan-500 bg-white px-5 shadow-sm transition hover:bg-cyan-50">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">TỔNG CHI (TOÀN BỘ)</p>
            <p className="text-lg font-black text-red-600">{totalAmount.toLocaleString('vi-VN')} đ</p>
          </div>
          <div className="rounded-xl bg-red-100 p-2 text-red-700">
            <DollarSign size={22} />
          </div>
        </div>

        <div className="flex h-[72px] items-center justify-between rounded-xl border-2 border-cyan-500 bg-white px-5 shadow-sm transition hover:bg-cyan-50">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">CHI TIỀN HÔM NAY</p>
            <p className="text-lg font-black text-cyan-700">{todayAmount.toLocaleString('vi-VN')} đ</p>
          </div>
          <div className="rounded-xl bg-cyan-100 p-2 text-cyan-700">
            <Calendar size={22} />
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR MATCHING PERSONNEL.TSX */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm theo mã phiếu chi, đối tượng nhận, nội dung chi..."
            className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white pl-12 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:ring-4 focus:ring-cyan-500/10"
          />
        </div>

        {/* Date & Payment Method Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
            <span>Từ:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-transparent text-xs font-semibold outline-none text-slate-800"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
            <span>Đến:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-transparent text-xs font-semibold outline-none text-slate-800"
            />
          </div>

          {/* Action Export Buttons */}
          <button
            onClick={handleExportExcel}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-bold text-cyan-700 hover:bg-cyan-50 transition cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-bold text-cyan-700 hover:bg-cyan-50 transition cursor-pointer"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>
      </div>

      {/* BULK ACTION TOOLBAR WHEN ITEMS SELECTED */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-cyan-500 bg-cyan-50 p-3.5 shadow-md animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-600 text-xs font-black text-white">
              {selectedIds.length}
            </span>
            <span className="text-sm font-extrabold text-cyan-950">
              Phiếu chi đã được chọn
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-red-500 bg-white px-3.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 transition cursor-pointer"
            >
              <Trash2 className="h-4 w-4" /> Xóa đã chọn ({selectedIds.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-200 transition cursor-pointer ml-2"
              title="Bỏ chọn tất cả"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* PERSONNEL HIGH-DENSITY TABLE MATCHING PERSONNEL.TSX */}
      <div className="overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-cyan-50 sticky top-0 z-20 shadow-sm">
              <tr className="border-b-2 border-slate-200">
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 w-12 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={paginatedVouchers.length > 0 && paginatedVouchers.every((v) => selectedIds.includes(v.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const currentIds = paginatedVouchers.map((v) => v.id);
                        setSelectedIds((prev) => Array.from(new Set([...prev, ...currentIds])));
                      } else {
                        const currentIds = new Set(paginatedVouchers.map((v) => v.id));
                        setSelectedIds((prev) => prev.filter((id) => !currentIds.has(id)));
                      }
                    }}
                    className="h-4 w-4 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                  />
                </th>
                <th className="border-r border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 w-14 whitespace-nowrap">
                  STT
                </th>
                <th className="border-r border-slate-200 px-4 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[150px] whitespace-nowrap">
                  Mã phiếu
                </th>
                <th className="border-r border-slate-200 px-4 py-4 text-center text-sm font-extrabold uppercase text-slate-800 w-32 whitespace-nowrap">
                  Ngày lập
                </th>
                <th className="border-r border-slate-200 px-4 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[180px] whitespace-nowrap">
                  Nội dung chi
                </th>
                <th className="border-r border-slate-200 px-4 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[180px] whitespace-nowrap">
                  Đối tượng nhận
                </th>
                <th className="border-r border-slate-200 px-4 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[160px] whitespace-nowrap">
                  Số tiền (VND)
                </th>
                <th className="border-r border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 w-32 whitespace-nowrap">
                  Hình thức
                </th>
                <th className="border-r border-slate-200 px-4 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[150px] whitespace-nowrap">
                  Nhân viên
                </th>
                <th className="sticky right-0 border-l border-slate-200 bg-cyan-50 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 shadow-[-4px_0_12px_rgba(0,0,0,0.03)] w-36 whitespace-nowrap">
                  THAO TÁC
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {paginatedVouchers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500 font-semibold">
                    Chưa có phiếu chi tiền nào. Hãy bấm <b>Tạo phiếu chi mới</b> để thêm bản ghi.
                  </td>
                </tr>
              ) : (
                paginatedVouchers.map((v, index) => {
                  const globalIndex = (currentPage - 1) * pageSize + index + 1;
                  const isSelected = selectedIds.includes(v.id);

                  return (
                    <tr
                      key={v.id}
                      className={`group border-b border-slate-200 transition hover:bg-cyan-50/50 ${
                        isSelected ? 'bg-cyan-50/70' : ''
                      }`}
                    >
                      <td className="border-r border-slate-200 px-3 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds([...selectedIds, v.id]);
                            else setSelectedIds(selectedIds.filter((id) => id !== v.id));
                          }}
                          className="h-4 w-4 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                        />
                      </td>
                      <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-bold text-slate-600">
                        {globalIndex}
                      </td>
                      <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-mono font-bold text-cyan-700">
                        {v.code}
                      </td>
                      <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-medium text-slate-700">
                        {v.date}
                      </td>
                      <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-bold text-slate-900">
                        {v.type}
                      </td>
                      <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-bold text-slate-800">
                        {v.targetName}
                      </td>
                      <td className="border-r border-slate-200 px-4 py-3.5 text-right text-sm font-mono font-black text-red-600">
                        {v.amount.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="border-r border-slate-200 px-3 py-3.5 text-center">
                        <span className="inline-flex rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-extrabold text-slate-700">
                          {v.paymentMethod}
                        </span>
                      </td>
                      <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-bold text-slate-700">
                        {v.staffName}
                      </td>
                      {/* ACTION BUTTONS COLUMN MATCHING PERSONNEL.TSX */}
                      <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-3.5 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(v, 'view')}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 cursor-pointer"
                            title="Xem chi tiết"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(v, 'edit')}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 cursor-pointer"
                            title="Sửa phiếu chi"
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSingle(v.id, v.code)}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-red-500 bg-white text-red-600 shadow-sm transition hover:bg-red-50 cursor-pointer"
                            title="Xóa phiếu chi"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER ATTACHED MATCHING PERSONNEL.TSX */}
        {totalItems > 0 && (
          <div className="flex flex-col items-center justify-between border-t-2 border-slate-200 bg-slate-50/50 px-6 py-3 sm:flex-row">
            <div className="text-sm font-semibold text-slate-600">
              Tổng số: <b>{totalItems}</b> <span className="ml-2">Hiển thị {startIndex} - {endIndex}</span>
            </div>
            <div className="mt-4 flex items-center gap-2 sm:mt-0">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-9 rounded-xl border-2 border-cyan-500 bg-white px-2 text-sm font-bold text-slate-700 outline-none"
              >
                <option value={10}>10 dòng / trang</option>
                <option value={20}>20 dòng / trang</option>
                <option value={50}>50 dòng / trang</option>
                <option value={100}>100 dòng / trang</option>
              </select>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                >
                  «
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                >
                  ‹
                </button>
                <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-sm font-bold text-white">
                  {currentPage}
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                >
                  ›
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                >
                  »
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* POPUP MODAL MATCHING PERSONNEL.TSX DESIGN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm animate-in fade-in-50">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border-2 border-cyan-500 bg-white shadow-2xl space-y-0">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-200 bg-cyan-50 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-3.5 py-1.5 text-white font-black text-sm">
                  <CreditCard className="h-4.5 w-4.5" />
                  {modalMode === 'create' ? 'TẠO PHIẾU CHI MỚI' : modalMode === 'view' ? 'CHI TIẾT PHIẾU CHI' : 'CẬP NHẬT PHIẾU CHI'}
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSaveForm} className="p-6 space-y-4 text-xs font-bold text-slate-700">
              <fieldset disabled={modalMode === 'view'} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-slate-700 font-extrabold">Ngày lập phiếu <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-700 font-extrabold">Mã phiếu chi <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 font-mono text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 font-extrabold">Nội dung chi tiền</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10 cursor-pointer"
                  >
                    <option value="201 Chi trả nhà cung cấp">201 Chi trả nhà cung cấp</option>
                    <option value="202 Chi phí vận chuyển">202 Chi phí vận chuyển</option>
                    <option value="203 Chi lương nhân viên">203 Chi lương nhân viên</option>
                    <option value="204 Chi phí điện nước/quản lý">204 Chi phí điện nước/quản lý</option>
                    <option value="205 Chi phí khác">205 Chi phí khác</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 font-extrabold">Đối tượng nhận (Nhà cung cấp / Đối tác)</label>
                  {suppliers.length > 0 ? (
                    <select
                      value={form.targetName}
                      onChange={(e) => {
                        const selected = suppliers.find((s) => s.name === e.target.value);
                        setForm({
                          ...form,
                          targetName: e.target.value,
                          addressTel: selected ? `${selected.address || ''} ${selected.phone || ''}`.trim() || '-' : form.addressTel,
                        });
                      }}
                      className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10 cursor-pointer"
                    >
                      <option value="">-- Chọn Nhà cung cấp / Đối tượng nhận tiền --</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name} {s.phone ? `(${s.phone})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Nhập tên đối tượng nhận tiền..."
                      value={form.targetName}
                      onChange={(e) => setForm({ ...form, targetName: e.target.value })}
                      className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 font-extrabold">Địa chỉ / Điện thoại</label>
                  <input
                    type="text"
                    value={form.addressTel}
                    onChange={(e) => setForm({ ...form, addressTel: e.target.value })}
                    className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
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
                  <label className="text-slate-700 font-extrabold">Ví tiền mặt / Tài khoản chi</label>
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
                  <label className="text-red-600 font-black text-sm uppercase">Số tiền chi thực tế (VND):</label>
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
                  <label className="text-slate-700 font-extrabold">Nhân viên lập phiếu</label>
                  {staffList.length > 0 ? (
                    <select
                      value={form.staffName}
                      onChange={(e) => setForm({ ...form, staffName: e.target.value })}
                      className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10 cursor-pointer"
                    >
                      {staffList.map((s) => (
                        <option key={s.id} value={s.fullName}>
                          {s.fullName} ({s.email})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={form.staffName}
                      onChange={(e) => setForm({ ...form, staffName: e.target.value })}
                      className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none"
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 font-extrabold">Nội dung / Ghi chú</label>
                  <textarea
                    rows={2}
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    className="w-full rounded-xl border-2 border-cyan-500 bg-white p-3 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                    placeholder="Nhập ghi chú phiếu chi..."
                  />
                </div>
              </fieldset>

              {/* Modal Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-slate-200">
                {modalMode !== 'view' && (
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-cyan-700 transition cursor-pointer"
                  >
                    <Save size={16} />
                    Lưu phiếu chi
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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
