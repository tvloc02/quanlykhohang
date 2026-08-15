import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Landmark,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Save,
  CheckCircle,
  XCircle,
  Filter,
  Maximize2,
  Minimize2,
  Wallet,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  DollarSign,
} from 'lucide-react';

export interface BankAccountItem {
  id: string;
  code: string;
  name: string;
  type: 'bank' | 'wallet'; // Ngân hàng hoặc Ví tiền mặt
  bankName: string; // Tên ngân hàng / tên ví
  accountNumber: string;
  accountHolder: string;
  branch: string;
  balance: number;
  status: 'active' | 'inactive';
  isDefault: boolean;
  note?: string;
  updatedAt: string;
}

const STORAGE_KEY = 'smart-wms-bank-accounts';

export const DEFAULT_BANK_ACCOUNTS: BankAccountItem[] = [];

export function readStoredBankAccounts(): BankAccountItem[] {
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

export function saveStoredBankAccounts(items: BankAccountItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('storage'));
}

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccountItem[]>(readStoredBankAccounts);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'bank' | 'wallet'>('all');

  // Pagination
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [form, setForm] = useState<BankAccountItem>({
    id: '',
    code: '',
    name: '',
    type: 'bank',
    bankName: 'Vietcombank',
    accountNumber: '',
    accountHolder: '',
    branch: '',
    balance: 0,
    status: 'active',
    isDefault: false,
    note: '',
    updatedAt: new Date().toISOString().split('T')[0],
  });

  // Toast
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((acc) => {
      const matchesSearch =
        !q ||
        acc.code.toLowerCase().includes(q) ||
        acc.name.toLowerCase().includes(q) ||
        acc.accountNumber.toLowerCase().includes(q) ||
        acc.bankName.toLowerCase().includes(q) ||
        acc.accountHolder.toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'all' || acc.status === statusFilter;
      const matchesType = typeFilter === 'all' || acc.type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [accounts, search, statusFilter, typeFilter]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
  }, [search, statusFilter, typeFilter]);

  const totalItems = filteredAccounts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);
  const paginatedAccounts = filteredAccounts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleOpenCreateModal = () => {
    setForm({
      id: `ba-${Date.now()}`,
      code: `TK-${Date.now().toString().slice(-4)}`,
      name: '',
      type: 'bank',
      bankName: 'Vietcombank',
      accountNumber: '',
      accountHolder: 'CÔNG TY TNHH SMART WMS',
      branch: 'Hà Nội',
      balance: 0,
      status: 'active',
      isDefault: false,
      note: '',
      updatedAt: new Date().toISOString().split('T')[0],
    });
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: BankAccountItem) => {
    setForm({ ...item });
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.accountNumber.trim()) {
      showToast('Vui lòng nhập Tên tài khoản và Số tài khoản!', 'error');
      return;
    }

    let updated: BankAccountItem[];
    if (modalMode === 'edit') {
      updated = accounts.map((acc) => (acc.id === form.id ? { ...form, updatedAt: new Date().toISOString().split('T')[0] } : acc));
      showToast(`Đã cập nhật tài khoản ${form.name} thành công!`);
    } else {
      updated = [{ ...form, updatedAt: new Date().toISOString().split('T')[0] }, ...accounts];
      showToast(`Đã thêm mới tài khoản ${form.name} thành công!`);
    }

    setAccounts(updated);
    saveStoredBankAccounts(updated);
    setIsModalOpen(false);
  };

  const handleDeleteSingle = (id: string, name: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa tài khoản ${name}?`)) {
      const updated = accounts.filter((acc) => acc.id !== id);
      setAccounts(updated);
      saveStoredBankAccounts(updated);
      showToast(`Đã xóa tài khoản ${name}!`);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} tài khoản đã chọn?`)) {
      const updated = accounts.filter((acc) => !selectedIds.includes(acc.id));
      setAccounts(updated);
      saveStoredBankAccounts(updated);
      setSelectedIds([]);
      showToast(`Đã xóa ${selectedIds.length} tài khoản!`);
    }
  };

  const toggleSelectAll = () => {
    if (paginatedAccounts.length > 0 && paginatedAccounts.every((acc) => selectedIds.includes(acc.id))) {
      const currentIds = new Set(paginatedAccounts.map((acc) => acc.id));
      setSelectedIds((prev) => prev.filter((id) => !currentIds.has(id)));
    } else {
      const currentIds = paginatedAccounts.map((acc) => acc.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...currentIds])));
    }
  };

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
        {/* Top Header Banner matching Gold Standard */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2.5 rounded-2xl bg-cyan-600 px-5 py-2.5 text-white shadow-md">
              <Landmark className="h-5 w-5" />
              <h1 className="text-xl font-extrabold tracking-tight uppercase">TÀI KHOẢN NGÂN HÀNG | VÍ TIỀN MẶT</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Thêm mới */}
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 border-2 border-cyan-700 px-5 py-2.5 text-sm font-extrabold text-white shadow-md transition hover:bg-cyan-700 active:scale-95 cursor-pointer"
            >
              <Plus className="h-4.5 w-4.5" />
              Thêm mới tài khoản
            </button>

            {/* Xóa chọn */}
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-red-600 bg-white px-5 py-2.5 text-sm font-extrabold text-red-600 shadow-xs transition hover:bg-red-50 active:scale-95 cursor-pointer"
              >
                <Trash2 className="h-4.5 w-4.5 text-red-600" />
                Xóa ({selectedIds.length})
              </button>
            )}

            {/* Toàn màn hình */}
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

        {/* High-density Filter Bar */}
        <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input h-12 */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm theo tên tài khoản, ngân hàng, số TK, chủ tài khoản..."
                className="h-12 w-full rounded-xl border-2 border-cyan-600/30 bg-slate-50/50 pl-11 pr-4 text-sm font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
              />
            </div>

            {/* Type & Status Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex h-12 items-center gap-2 rounded-xl border-2 border-cyan-600/30 bg-slate-50/80 px-3.5 shadow-2xs">
                <Filter className="h-4 w-4 text-cyan-600 shrink-0" />
                <span className="text-xs font-extrabold uppercase text-cyan-950 tracking-wide">Loại:</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="h-9 rounded-lg border-2 border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
                >
                  <option value="all">Tất cả loại</option>
                  <option value="bank">Tài khoản Ngân hàng</option>
                  <option value="wallet">Ví tiền mặt / Ví ĐT</option>
                </select>
              </div>

              <div className="inline-flex h-12 items-center gap-2 rounded-xl border-2 border-cyan-600/30 bg-slate-50/80 px-3.5 shadow-2xs">
                <span className="text-xs font-extrabold uppercase text-cyan-950 tracking-wide">Trạng thái:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="h-9 rounded-lg border-2 border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="active">Đang hoạt động</option>
                  <option value="inactive">Ngưng hoạt động</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* High-density Table */}
        <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse text-left min-w-[1100px]">
              <thead className="bg-cyan-50 sticky top-0 z-20 shadow-sm">
                <tr className="border-b-2 border-slate-200 text-slate-800 font-extrabold uppercase text-xs sm:text-sm tracking-wider">
                  <th className="w-12 min-w-[50px] border-r border-slate-200 px-2 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={paginatedAccounts.length > 0 && paginatedAccounts.every((acc) => selectedIds.includes(acc.id))}
                      onChange={toggleSelectAll}
                      className="h-4.5 w-4.5 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                    />
                  </th>
                  <th className="w-14 min-w-[60px] border-r border-slate-200 px-3 py-4 text-center">STT</th>
                  <th className="min-w-[120px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Mã TK</th>
                  <th className="min-w-[220px] border-r border-slate-200 px-4 py-4 text-center">Tên Tài khoản / Ví</th>
                  <th className="min-w-[180px] border-r border-slate-200 px-4 py-4 text-center">Ngân hàng / Loại</th>
                  <th className="min-w-[160px] border-r border-slate-200 px-4 py-4 text-center">Số Tài khoản</th>
                  <th className="min-w-[180px] border-r border-slate-200 px-4 py-4 text-center">Chủ Tài khoản</th>
                  <th className="min-w-[180px] border-r border-slate-200 px-4 py-4 text-center">Số dư hiện tại</th>
                  <th className="min-w-[140px] border-r border-slate-200 px-3 py-4 text-center">Trạng thái</th>
                  <th className="sticky right-0 top-0 z-30 w-32 min-w-[130px] bg-cyan-100 px-3 py-4 text-center shadow-[-4px_0_12px_rgba(0,0,0,0.05)] border-l border-slate-200 text-cyan-950 font-black">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {paginatedAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500 font-semibold text-sm">
                      Chưa có tài khoản ngân hàng hoặc ví nào. Hãy nhấn nút <b>Thêm mới tài khoản</b>.
                    </td>
                  </tr>
                ) : (
                  paginatedAccounts.map((acc, index) => {
                    const globalIndex = (currentPage - 1) * pageSize + index + 1;
                    const isSelected = selectedIds.includes(acc.id);

                    return (
                      <tr
                        key={acc.id}
                        className={`group border-b border-slate-200 transition cursor-pointer ${
                          isSelected ? 'bg-cyan-100/60' : 'hover:bg-cyan-50/60'
                        }`}
                      >
                        <td className="border-r border-slate-200 px-2 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedIds([...selectedIds, acc.id]);
                              else setSelectedIds(selectedIds.filter((id) => id !== acc.id));
                            }}
                            className="h-4 w-4 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                          />
                        </td>
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-medium text-slate-700">
                          {globalIndex}
                        </td>
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-mono font-extrabold text-cyan-700 whitespace-nowrap">
                          {acc.code}
                        </td>
                        <td className="border-r border-slate-200 px-4 py-3.5 text-sm font-extrabold text-slate-900">
                          <div className="flex items-center gap-2">
                            {acc.type === 'bank' ? <Landmark className="h-4 w-4 text-cyan-600 shrink-0" /> : <Wallet className="h-4 w-4 text-amber-600 shrink-0" />}
                            <span>{acc.name}</span>
                            {acc.isDefault && (
                              <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-800 border border-amber-300">
                                Mặc định
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="border-r border-slate-200 px-4 py-3.5 text-sm font-bold text-slate-700">{acc.bankName}</td>
                        <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-mono font-bold text-slate-900">{acc.accountNumber}</td>
                        <td className="border-r border-slate-200 px-4 py-3.5 text-sm font-bold text-slate-800">{acc.accountHolder}</td>
                        <td className="border-r border-slate-200 px-4 py-3.5 text-right text-sm font-mono font-black text-emerald-600">
                          {acc.balance.toLocaleString('vi-VN')} đ
                        </td>
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center">
                          <span
                            className={`inline-flex rounded-xl px-3 py-1 text-xs font-black border ${
                              acc.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-slate-100 text-slate-600 border-slate-300'
                            }`}
                          >
                            {acc.status === 'active' ? 'Đang hoạt động' : 'Ngưng hoạt động'}
                          </span>
                        </td>

                        {/* Sticky Action Column */}
                        <td className="sticky right-0 top-0 z-10 border-l border-slate-200 bg-white px-3 py-3.5 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.05)] group-hover:bg-cyan-50">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(acc)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-600 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 cursor-pointer"
                              title="Sửa tài khoản"
                            >
                              <Pencil size={18} />
                            </button>
                            {!acc.isDefault && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSingle(acc.id, acc.name)}
                                className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-red-500 bg-white text-red-600 shadow-sm transition hover:bg-red-50 cursor-pointer"
                                title="Xóa tài khoản"
                              >
                                <Trash2 size={18} />
                              </button>
                            )}
                          </div>
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
                Hiển thị <span className="font-extrabold text-slate-900">{startIndex}</span> - <span className="font-extrabold text-slate-900">{endIndex}</span> trên tổng số <span className="font-extrabold text-slate-900">{totalItems}</span> tài khoản
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

      {/* POPUP MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm animate-in fade-in-50">
          <div className="w-full max-w-[640px] overflow-hidden rounded-3xl border-2 border-cyan-500 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-slate-200 bg-cyan-50 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-3.5 py-1.5 text-white font-black text-sm">
                  <Landmark className="h-4.5 w-4.5" />
                  {modalMode === 'create' ? 'THÊM MỚI TÀI KHOẢN / VÍ' : 'CẬP NHẬT TÀI KHOẢN / VÍ'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-6 space-y-4 text-xs font-bold text-slate-700">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-700 font-extrabold">Loại tài khoản <span className="text-red-500">*</span></label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                    className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10 cursor-pointer"
                  >
                    <option value="bank">Ngân hàng thương mại</option>
                    <option value="wallet">Ví tiền mặt / Ví điện tử</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 font-extrabold">Mã nhận diện tài khoản</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="VD: TK-VCB-01..."
                    className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 font-mono text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-700 font-extrabold">Tên Tài khoản / Ví <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="VD: Vietcombank - Chi nhánh Hà Nội..."
                  className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-700 font-extrabold">Tên Ngân hàng / Tổ chức <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.bankName}
                    onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                    placeholder="VD: Vietcombank, BIDV, MoMo..."
                    className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 font-extrabold">Số Tài khoản / Mã Ví <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.accountNumber}
                    onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                    placeholder="VD: 10123456789..."
                    className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 font-mono text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-700 font-extrabold">Chủ Tài khoản</label>
                  <input
                    type="text"
                    value={form.accountHolder}
                    onChange={(e) => setForm({ ...form, accountHolder: e.target.value })}
                    placeholder="VD: CÔNG TY TNHH SMART WMS..."
                    className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 font-extrabold">Chi nhánh / Khu vực</label>
                  <input
                    type="text"
                    value={form.branch}
                    onChange={(e) => setForm({ ...form, branch: e.target.value })}
                    placeholder="VD: Chi nhánh Hà Nội..."
                    className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-700 font-extrabold">Số dư ban đầu (đ)</label>
                  <input
                    type="number"
                    value={form.balance}
                    onChange={(e) => setForm({ ...form, balance: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 font-mono text-sm font-black text-emerald-700 outline-none focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 font-extrabold">Trạng thái</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                    className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10 cursor-pointer"
                  >
                    <option value="active">Đang hoạt động</option>
                    <option value="inactive">Ngưng hoạt động</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-700 font-extrabold">Ghi chú</label>
                <textarea
                  rows={2}
                  value={form.note || ''}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Ghi chú thêm thông tin về tài khoản..."
                  className="w-full rounded-xl border-2 border-cyan-500 bg-white p-3 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-slate-200">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-cyan-700 transition cursor-pointer"
                >
                  <Save size={16} />
                  Lưu tài khoản
                </button>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
