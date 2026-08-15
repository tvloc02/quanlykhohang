import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  DollarSign,
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
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
} from 'lucide-react';

export interface CurrencyItem {
  id: string;
  code: string;
  name: string;
  symbol: string;
  exchangeRate: number; // Rate against VND
  isDefault: boolean;
  status: 'active' | 'inactive';
  note?: string;
  updatedAt: string;
}

const STORAGE_KEY = 'smart-wms-currencies';

export const DEFAULT_CURRENCIES: CurrencyItem[] = [];

export function readStoredCurrencies(): CurrencyItem[] {
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

export function saveStoredCurrencies(items: CurrencyItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('storage'));
}

export default function CurrenciesPage() {
  const [currencies, setCurrencies] = useState<CurrencyItem[]>(readStoredCurrencies);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Pagination
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [form, setForm] = useState<CurrencyItem>({
    id: '',
    code: '',
    name: '',
    symbol: '$',
    exchangeRate: 1,
    isDefault: false,
    status: 'active',
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

  const filteredCurrencies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return currencies.filter((c) => {
      const matchesSearch =
        !q ||
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.note || '').toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [currencies, search, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
  }, [search, statusFilter]);

  const totalItems = filteredCurrencies.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);
  const paginatedCurrencies = filteredCurrencies.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleOpenCreateModal = () => {
    setForm({
      id: `curr-${Date.now()}`,
      code: '',
      name: '',
      symbol: '$',
      exchangeRate: 1,
      isDefault: false,
      status: 'active',
      note: '',
      updatedAt: new Date().toISOString().split('T')[0],
    });
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: CurrencyItem) => {
    setForm({ ...item });
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      showToast('Vui lòng nhập Mã ngoại tệ và Tên ngoại tệ!', 'error');
      return;
    }
    if (form.exchangeRate <= 0) {
      showToast('Tỷ giá quy đổi phải lớn hơn 0!', 'error');
      return;
    }

    let updated: CurrencyItem[];
    if (modalMode === 'edit') {
      updated = currencies.map((c) => (c.id === form.id ? { ...form, updatedAt: new Date().toISOString().split('T')[0] } : c));
      showToast(`Đã cập nhật ngoại tệ ${form.code} thành công!`);
    } else {
      updated = [{ ...form, updatedAt: new Date().toISOString().split('T')[0] }, ...currencies];
      showToast(`Đã thêm mới ngoại tệ ${form.code} thành công!`);
    }

    setCurrencies(updated);
    saveStoredCurrencies(updated);
    setIsModalOpen(false);
  };

  const handleDeleteSingle = (id: string, code: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa ngoại tệ ${code}?`)) {
      const updated = currencies.filter((c) => c.id !== id);
      setCurrencies(updated);
      saveStoredCurrencies(updated);
      showToast(`Đã xóa ngoại tệ ${code}!`);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} ngoại tệ đã chọn?`)) {
      const updated = currencies.filter((c) => !selectedIds.includes(c.id));
      setCurrencies(updated);
      saveStoredCurrencies(updated);
      setSelectedIds([]);
      showToast(`Đã xóa ${selectedIds.length} ngoại tệ!`);
    }
  };

  const toggleSelectAll = () => {
    if (paginatedCurrencies.length > 0 && paginatedCurrencies.every((c) => selectedIds.includes(c.id))) {
      const currentIds = new Set(paginatedCurrencies.map((c) => c.id));
      setSelectedIds((prev) => prev.filter((id) => !currentIds.has(id)));
    } else {
      const currentIds = paginatedCurrencies.map((c) => c.id);
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
              <DollarSign className="h-5 w-5" />
              <h1 className="text-xl font-extrabold tracking-tight uppercase">DANH MỤC NGOẠI TỆ & TỶ GIÁ</h1>
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
              Thêm mới ngoại tệ
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
                placeholder="Tìm kiếm theo mã ngoại tệ (USD, EUR...), tên ngoại tệ, ghi chú..."
                className="h-12 w-full rounded-xl border-2 border-cyan-600/30 bg-slate-50/50 pl-11 pr-4 text-sm font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-3">
              <div className="inline-flex h-12 items-center gap-2 rounded-xl border-2 border-cyan-600/30 bg-slate-50/80 px-3.5 shadow-2xs">
                <Filter className="h-4 w-4 text-cyan-600 shrink-0" />
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
            <table className="w-full border-collapse text-left min-w-[1000px]">
              <thead className="bg-cyan-50 sticky top-0 z-20 shadow-sm">
                <tr className="border-b-2 border-slate-200 text-slate-800 font-extrabold uppercase text-xs sm:text-sm tracking-wider">
                  <th className="w-12 min-w-[50px] border-r border-slate-200 px-2 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={paginatedCurrencies.length > 0 && paginatedCurrencies.every((c) => selectedIds.includes(c.id))}
                      onChange={toggleSelectAll}
                      className="h-4.5 w-4.5 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                    />
                  </th>
                  <th className="w-14 min-w-[60px] border-r border-slate-200 px-3 py-4 text-center">STT</th>
                  <th className="min-w-[120px] border-r border-slate-200 px-4 py-4 text-center whitespace-nowrap">Mã Ngoại tệ</th>
                  <th className="min-w-[200px] border-r border-slate-200 px-4 py-4 text-center">Tên Ngoại tệ</th>
                  <th className="min-w-[100px] border-r border-slate-200 px-3 py-4 text-center">Ký hiệu</th>
                  <th className="min-w-[180px] border-r border-slate-200 px-4 py-4 text-center">Tỷ giá (VND)</th>
                  <th className="min-w-[150px] border-r border-slate-200 px-3 py-4 text-center">Trạng thái</th>
                  <th className="min-w-[200px] border-r border-slate-200 px-4 py-4 text-center">Ghi chú</th>
                  <th className="sticky right-0 top-0 z-30 w-32 min-w-[130px] bg-cyan-100 px-3 py-4 text-center shadow-[-4px_0_12px_rgba(0,0,0,0.05)] border-l border-slate-200 text-cyan-950 font-black">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {paginatedCurrencies.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500 font-semibold text-sm">
                      Chưa có ngoại tệ nào. Hãy nhấn nút <b>Thêm mới ngoại tệ</b>.
                    </td>
                  </tr>
                ) : (
                  paginatedCurrencies.map((c, index) => {
                    const globalIndex = (currentPage - 1) * pageSize + index + 1;
                    const isSelected = selectedIds.includes(c.id);

                    return (
                      <tr
                        key={c.id}
                        className={`group border-b border-slate-200 transition cursor-pointer ${
                          isSelected ? 'bg-cyan-100/60' : 'hover:bg-cyan-50/60'
                        }`}
                      >
                        <td className="border-r border-slate-200 px-2 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedIds([...selectedIds, c.id]);
                              else setSelectedIds(selectedIds.filter((id) => id !== c.id));
                            }}
                            className="h-4 w-4 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                          />
                        </td>
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-medium text-slate-700">
                          {globalIndex}
                        </td>
                        <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-mono font-extrabold text-cyan-700 whitespace-nowrap">
                          {c.code}
                          {c.isDefault && (
                            <span className="ml-1.5 inline-block rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-800 border border-amber-300">
                              Mặc định
                            </span>
                          )}
                        </td>
                        <td className="border-r border-slate-200 px-4 py-3.5 text-sm font-extrabold text-slate-900">{c.name}</td>
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-bold text-slate-700">{c.symbol}</td>
                        <td className="border-r border-slate-200 px-4 py-3.5 text-right text-sm font-mono font-black text-emerald-600">
                          1 {c.code} = {c.exchangeRate.toLocaleString('vi-VN')} đ
                        </td>
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center">
                          <span
                            className={`inline-flex rounded-xl px-3 py-1 text-xs font-black border ${
                              c.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-slate-100 text-slate-600 border-slate-300'
                            }`}
                          >
                            {c.status === 'active' ? 'Đang hoạt động' : 'Ngưng hoạt động'}
                          </span>
                        </td>
                        <td className="border-r border-slate-200 px-4 py-3.5 text-sm font-medium text-slate-600 max-w-[200px] truncate" title={c.note}>
                          {c.note || '-'}
                        </td>

                        {/* Sticky Action Column */}
                        <td className="sticky right-0 top-0 z-10 border-l border-slate-200 bg-white px-3 py-3.5 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.05)] group-hover:bg-cyan-50">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(c)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-600 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 cursor-pointer"
                              title="Sửa ngoại tệ"
                            >
                              <Pencil size={18} />
                            </button>
                            {!c.isDefault && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSingle(c.id, c.code)}
                                className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-red-500 bg-white text-red-600 shadow-sm transition hover:bg-red-50 cursor-pointer"
                                title="Xóa ngoại tệ"
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
                Hiển thị <span className="font-extrabold text-slate-900">{startIndex}</span> - <span className="font-extrabold text-slate-900">{endIndex}</span> trên tổng số <span className="font-extrabold text-slate-900">{totalItems}</span> ngoại tệ
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
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border-2 border-cyan-500 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-slate-200 bg-cyan-50 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-3.5 py-1.5 text-white font-black text-sm">
                  <DollarSign className="h-4.5 w-4.5" />
                  {modalMode === 'create' ? 'THÊM MỚI NGOẠI TỆ' : 'CẬP NHẬT NGOẠI TỆ'}
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
                  <label className="text-slate-700 font-extrabold">Mã Ngoại tệ <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="VD: USD, EUR..."
                    className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 font-mono text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 font-extrabold">Ký hiệu tiền tệ</label>
                  <input
                    type="text"
                    value={form.symbol}
                    onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                    placeholder="VD: $, €, ¥..."
                    className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-700 font-extrabold">Tên Ngoại tệ <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="VD: Đô la Mỹ, Euro..."
                  className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-700 font-extrabold">Tỷ giá quy đổi (so với 1 VND)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.exchangeRate}
                  onChange={(e) => setForm({ ...form, exchangeRate: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 font-mono text-sm font-black text-emerald-700 outline-none focus:ring-4 focus:ring-cyan-500/10"
                  required
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

              <div className="space-y-1.5">
                <label className="text-slate-700 font-extrabold">Ghi chú</label>
                <textarea
                  rows={2}
                  value={form.note || ''}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Ghi chú về tỷ giá / mục đích sử dụng..."
                  className="w-full rounded-xl border-2 border-cyan-500 bg-white p-3 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-slate-200">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-cyan-700 transition cursor-pointer"
                >
                  <Save size={16} />
                  Lưu ngoại tệ
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
