import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Scale,
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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

const STORAGE_KEY = 'smart-wms-units';
const API_BASE_URL = '/api';

export type UnitConversion = {
  id: string;
  baseUnit?: string;       // Đơn vị gốc
  convertedUnit: string;  // Tên quy đổi (bắt buộc)
  quantity: number;        // Số lượng (bắt buộc)
  status: 'active' | 'inactive';
  description?: string;
  createdAt: string;
};

export const DEFAULT_UNITS: UnitConversion[] = [];

export function readStoredUnits(): UnitConversion[] {
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

export function saveStoredUnits(units: UnitConversion[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(units));
  window.dispatchEvent(new Event('storage'));
}

export default function UnitsPage() {
  const [units, setUnits] = useState<UnitConversion[]>(readStoredUnits);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Pagination states
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingUnit, setEditingUnit] = useState<UnitConversion | null>(null);
  const [form, setForm] = useState<{
    baseUnit: string;
    convertedUnit: string;
    quantity: number;
    status: 'active' | 'inactive';
    description: string;
  }>({
    baseUnit: '',
    convertedUnit: '',
    quantity: 1,
    status: 'active',
    description: '',
  });

  // Toast
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Fetch API units (with LocalStorage sync)
  const fetchUnits = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/units`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
      }).catch(() => null);

      if (res && res.ok) {
        const remoteData = await res.json();
        if (Array.isArray(remoteData) && remoteData.length > 0) {
          const localUnits = readStoredUnits();
          const map = new Map<string, UnitConversion>();
          localUnits.forEach((u) => map.set(u.id, u));
          remoteData.forEach((u: any) => {
            const existing = map.get(u.id);
            map.set(u.id, {
              id: u.id,
              baseUnit: u.baseUnit ?? existing?.baseUnit ?? '',
              convertedUnit: u.convertedUnit || u.name || existing?.convertedUnit || '',
              quantity: Number(u.quantity || u.ratio || existing?.quantity || 1),
              status: u.status || existing?.status || 'active',
              description: u.description || existing?.description || '',
              createdAt: u.createdAt || existing?.createdAt || new Date().toISOString(),
            });
          });
          const merged = Array.from(map.values());
          setUnits(merged);
          saveStoredUnits(merged);
        }
      }
    } catch {
      // Local fallback active
    }
  }, []);

  useEffect(() => {
    void fetchUnits();
  }, [fetchUnits]);

  // Filtered List
  const filteredUnits = useMemo(() => {
    const q = search.trim().toLowerCase();
    return units.filter((u) => {
      const matchesSearch =
        !q ||
        (u.baseUnit || '').toLowerCase().includes(q) ||
        u.convertedUnit.toLowerCase().includes(q) ||
        (u.description || '').toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [units, search, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
  }, [search, statusFilter]);

  // Pagination Calculations
  const totalItems = filteredUnits.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);
  const paginatedUnits = filteredUnits.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Open Modal Create/Edit
  const openModal = (unitToEdit?: UnitConversion) => {
    if (unitToEdit) {
      setEditingUnit(unitToEdit);
      setModalMode('edit');
      setForm({
        baseUnit: unitToEdit.baseUnit || '',
        convertedUnit: unitToEdit.convertedUnit,
        quantity: unitToEdit.quantity,
        status: unitToEdit.status,
        description: unitToEdit.description || '',
      });
    } else {
      setEditingUnit(null);
      setModalMode('create');
      setForm({
        baseUnit: '',
        convertedUnit: '',
        quantity: 1,
        status: 'active',
        description: '',
      });
    }
    setIsModalOpen(true);
  };

  // Save Unit
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.convertedUnit.trim()) {
      showToast('Vui lòng nhập Tên quy đổi.', 'error');
      return;
    }
    if (form.quantity <= 0) {
      showToast('Số lượng quy đổi phải lớn hơn 0.', 'error');
      return;
    }

    const payload = {
      baseUnit: form.baseUnit.trim(),
      convertedUnit: form.convertedUnit.trim(),
      quantity: Number(form.quantity),
      status: form.status,
      description: form.description.trim(),
    };

    if (editingUnit) {
      const updated: UnitConversion = {
        ...editingUnit,
        ...payload,
      };

      setUnits((prev) => {
        const next = prev.map((u) => (u.id === editingUnit.id ? updated : u));
        saveStoredUnits(next);
        return next;
      });

      showToast(`Đã cập nhật đơn vị quy đổi "${payload.convertedUnit}".`);
    } else {
      const newUnit: UnitConversion = {
        id: `unit-${Date.now()}`,
        ...payload,
        createdAt: new Date().toISOString(),
      };

      setUnits((prev) => {
        const next = [newUnit, ...prev];
        saveStoredUnits(next);
        return next;
      });

      showToast(`Đã thêm mới đơn vị quy đổi "${payload.convertedUnit}".`);
    }
    setIsModalOpen(false);
  };

  // Single Delete
  const handleDelete = (id: string, name: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa đơn vị quy đổi "${name}"?`)) {
      setUnits((prev) => {
        const next = prev.filter((u) => u.id !== id);
        saveStoredUnits(next);
        return next;
      });
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      showToast(`Đã xóa đơn vị quy đổi "${name}".`);
    }
  };

  // Bulk Delete
  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} đơn vị quy đổi đã chọn?`)) {
      setUnits((prev) => {
        const next = prev.filter((u) => !selectedIds.includes(u.id));
        saveStoredUnits(next);
        return next;
      });
      showToast(`Đã xóa ${selectedIds.length} đơn vị quy đổi.`);
      setSelectedIds([]);
    }
  };

  const toggleSelectAll = () => {
    if (paginatedUnits.length > 0 && paginatedUnits.every((u) => selectedIds.includes(u.id))) {
      const currentIds = new Set(paginatedUnits.map((u) => u.id));
      setSelectedIds((prev) => prev.filter((id) => !currentIds.has(id)));
    } else {
      const currentIds = paginatedUnits.map((u) => u.id);
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
              <Scale className="h-5 w-5" />
              <h1 className="text-xl font-extrabold tracking-tight uppercase">ĐƠN VỊ QUY ĐỔI HÀNG HÓA</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Thêm mới */}
            <button
              type="button"
              onClick={() => openModal()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 border-2 border-cyan-700 px-5 py-2.5 text-sm font-extrabold text-white shadow-md transition hover:bg-cyan-700 active:scale-95 cursor-pointer"
            >
              <Plus className="h-4.5 w-4.5" />
              Thêm mới đơn vị quy đổi
            </button>

            {/* Xóa chọn */}
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={handleBulkDelete}
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
                placeholder="Tìm kiếm theo Tên quy đổi, Đơn vị gốc, Mô tả..."
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
            <table className="w-full border-collapse text-left min-w-[900px]">
              <thead className="bg-cyan-50 sticky top-0 z-20 shadow-sm">
                <tr className="border-b-2 border-slate-200 text-slate-800 font-extrabold uppercase text-xs sm:text-sm tracking-wider">
                  <th className="w-12 min-w-[50px] border-r border-slate-200 px-2 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={paginatedUnits.length > 0 && paginatedUnits.every((u) => selectedIds.includes(u.id))}
                      onChange={toggleSelectAll}
                      className="h-4.5 w-4.5 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                    />
                  </th>
                  <th className="w-14 min-w-[60px] border-r border-slate-200 px-3 py-4 text-center">STT</th>
                  <th className="min-w-[140px] border-r border-slate-200 px-4 py-4 text-center whitespace-nowrap">Đơn vị gốc</th>
                  <th className="min-w-[220px] border-r border-slate-200 px-4 py-4 text-center">Tên Quy đổi</th>
                  <th className="min-w-[140px] border-r border-slate-200 px-4 py-4 text-center">Số lượng quy đổi</th>
                  <th className="min-w-[150px] border-r border-slate-200 px-3 py-4 text-center">Trạng thái</th>
                  <th className="min-w-[200px] border-r border-slate-200 px-4 py-4 text-center">Mô tả / Ghi chú</th>
                  <th className="sticky right-0 top-0 z-30 w-32 min-w-[130px] bg-cyan-100 px-3 py-4 text-center shadow-[-4px_0_12px_rgba(0,0,0,0.05)] border-l border-slate-200 text-cyan-950 font-black">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {paginatedUnits.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 font-semibold text-sm">
                      Chưa có đơn vị quy đổi nào. Hãy nhấn nút <b>Thêm mới đơn vị quy đổi</b>.
                    </td>
                  </tr>
                ) : (
                  paginatedUnits.map((u, index) => {
                    const globalIndex = (currentPage - 1) * pageSize + index + 1;
                    const isSelected = selectedIds.includes(u.id);

                    return (
                      <tr
                        key={u.id}
                        className={`group border-b border-slate-200 transition cursor-pointer ${
                          isSelected ? 'bg-cyan-100/60' : 'hover:bg-cyan-50/60'
                        }`}
                      >
                        <td className="border-r border-slate-200 px-2 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedIds([...selectedIds, u.id]);
                              else setSelectedIds(selectedIds.filter((id) => id !== u.id));
                            }}
                            className="h-4 w-4 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                          />
                        </td>
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-medium text-slate-700">
                          {globalIndex}
                        </td>
                        <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-bold text-slate-800 whitespace-nowrap">
                          {u.baseUnit ? (
                            <span className="inline-block rounded-xl bg-slate-100 px-3 py-1 text-xs font-black text-slate-700 border border-slate-300">
                              {u.baseUnit}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-xs">-</span>
                          )}
                        </td>
                        <td className="border-r border-slate-200 px-4 py-3.5 text-sm font-extrabold text-cyan-900">{u.convertedUnit}</td>
                        <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-mono font-black text-slate-900">
                          {u.quantity.toLocaleString('vi-VN')}
                        </td>
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center">
                          <span
                            className={`inline-flex rounded-xl px-3 py-1 text-xs font-black border ${
                              u.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-slate-100 text-slate-600 border-slate-300'
                            }`}
                          >
                            {u.status === 'active' ? 'Đang hoạt động' : 'Ngưng hoạt động'}
                          </span>
                        </td>
                        <td className="border-r border-slate-200 px-4 py-3.5 text-sm font-medium text-slate-600 max-w-[200px] truncate" title={u.description}>
                          {u.description || '-'}
                        </td>

                        {/* Sticky Action Column */}
                        <td className="sticky right-0 top-0 z-10 border-l border-slate-200 bg-white px-3 py-3.5 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.05)] group-hover:bg-cyan-50">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openModal(u)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-600 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 cursor-pointer"
                              title="Sửa đơn vị"
                            >
                              <Pencil size={18} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(u.id, u.convertedUnit)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-red-500 bg-white text-red-600 shadow-sm transition hover:bg-red-50 cursor-pointer"
                              title="Xóa đơn vị"
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

          {/* Standardized Pagination Bar */}
          {totalItems > 0 && (
            <div className="flex flex-col items-center justify-between border-t-2 border-slate-200 bg-slate-50/80 px-6 py-4 sm:flex-row gap-4">
              <div className="text-sm font-semibold text-slate-600">
                Hiển thị <span className="font-extrabold text-slate-900">{startIndex}</span> - <span className="font-extrabold text-slate-900">{endIndex}</span> trên tổng số <span className="font-extrabold text-slate-900">{totalItems}</span> đơn vị
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
                  <Scale className="h-4.5 w-4.5" />
                  {modalMode === 'create' ? 'THÊM MỚI ĐƠN VỊ QUY ĐỔI' : 'CẬP NHẬT ĐƠN VỊ QUY ĐỔI'}
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

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs font-bold text-slate-700">
              <div className="space-y-1.5">
                <label className="text-slate-700 font-extrabold">Tên quy đổi <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.convertedUnit}
                  onChange={(e) => setForm({ ...form, convertedUnit: e.target.value })}
                  placeholder="VD: Hộp 10 cái, Thùng 24 hộp, Lốc 6 chai..."
                  className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-700 font-extrabold">Đơn vị gốc</label>
                  <input
                    type="text"
                    value={form.baseUnit}
                    onChange={(e) => setForm({ ...form, baseUnit: e.target.value })}
                    placeholder="VD: Cái, Hộp, Chai..."
                    className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 font-extrabold">Số lượng quy đổi <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: Math.max(1, Number(e.target.value)) })}
                    className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 font-mono text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                    required
                  />
                </div>
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
                <label className="text-slate-700 font-extrabold">Mô tả / Ghi chú</label>
                <textarea
                  rows={2}
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Ghi chú thêm thông tin về quy đổi..."
                  className="w-full rounded-xl border-2 border-cyan-500 bg-white p-3 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-slate-200">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-cyan-700 transition cursor-pointer"
                >
                  <Save size={16} />
                  Lưu đơn vị
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
