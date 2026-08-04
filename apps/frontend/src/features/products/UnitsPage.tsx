import React from 'react';
import { createPortal } from 'react-dom';
import {
  Scale,
  PlusCircle,
  Search,
  Pencil,
  Trash2,
  X,
  CheckCircle,
  XCircle,
  Filter,
  ChevronDown,
  Check,
} from 'lucide-react';

const STORAGE_KEY = 'smart-wms-units';
const API_BASE_URL = 'http://localhost:3000/api';

export type UnitConversion = {
  id: string;
  baseUnit?: string;       // Đơn vị gốc
  convertedUnit: string;  // Tên quy đổi (bắt buộc)
  quantity: number;        // Số lượng (bắt buộc)
  status: 'active' | 'inactive';
  description?: string;
  createdAt: string;
};

export function getFallbackUnits(): UnitConversion[] {
  return [];
}

export function readStoredUnits(): UnitConversion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filter out old mock items (unit-1 to unit-7)
        const realItems = parsed.filter((item: any) => !/^unit-[1-7]$/.test(item.id));
        if (realItems.length !== parsed.length) {
          saveStoredUnits(realItems);
        }
        return realItems;
      }
    }
    return [];
  } catch {
    return [];
  }
}

export function saveStoredUnits(units: UnitConversion[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(units));
  window.dispatchEvent(new Event('storage'));
}

// Toast notification component rendered via Portal
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  React.useEffect(() => {
    if (message) {
      const timer = setTimeout(() => onClose(), 3500);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  return createPortal(
    <div className={`fixed top-6 right-6 z-[9999] pointer-events-auto flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl transition-all border backdrop-blur-md animate-in slide-in-from-top-4 ${
      type === 'error' ? 'bg-red-50/95 text-red-700 border-red-200' : 'bg-emerald-50/95 text-emerald-800 border-emerald-200'
    }`}>
      {type === 'error' ? <XCircle className="h-5 w-5 flex-shrink-0 text-red-600" /> : <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-600" />}
      <p className="text-sm font-extrabold">{message}</p>
      <button type="button" onClick={onClose} className="ml-2 rounded-lg p-1 hover:bg-black/5 transition cursor-pointer">
        <X className="h-4 w-4" />
      </button>
    </div>,
    document.body
  );
}

// Reusable Custom Dropdown Component with rounded options list
type SelectOption<T extends string | number> = {
  value: T;
  label: string;
};

function CustomSelect<T extends string | number>({
  value,
  onChange,
  options,
  placeholder,
  className = '',
}: {
  value: T;
  onChange: (val: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-bold text-slate-700 shadow-xs transition hover:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 cursor-pointer"
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder || 'Chọn...'}</span>
        <ChevronDown className={`h-4 w-4 text-cyan-600 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1.5 min-w-full w-max max-h-60 overflow-y-auto rounded-2xl border-2 border-cyan-500 bg-white p-1.5 shadow-xl animate-in fade-in-50 zoom-in-95">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-4 rounded-xl px-3.5 py-2.5 text-sm font-bold transition cursor-pointer ${
                  isSelected ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-900'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="h-4 w-4 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function UnitsPage() {
  const [units, setUnits] = React.useState<UnitConversion[]>(readStoredUnits);

  // Search & Filter
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'inactive'>('all');

  // Checkbox selection for bulk delete
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  // Pagination states
  const [pageSize, setPageSize] = React.useState(20);
  const [currentPage, setCurrentPage] = React.useState(1);

  // Modal states
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingUnit, setEditingUnit] = React.useState<UnitConversion | null>(null);
  const [form, setForm] = React.useState<{
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

  // Feedback notifications
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  // Single delete confirm modal state
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  // Bulk delete confirm modal state
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = React.useState(false);

  // Fetch API units (with LocalStorage sync)
  const fetchUnits = React.useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/units`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
      });

      if (res.ok) {
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

  React.useEffect(() => {
    void fetchUnits();
  }, [fetchUnits]);

  // Filtered List
  const filteredUnits = React.useMemo(() => {
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

  React.useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
  }, [search, statusFilter]);

  // Pagination Calculations
  const totalItems = filteredUnits.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  const paginatedUnits = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUnits.slice(start, start + pageSize);
  }, [filteredUnits, currentPage, pageSize]);

  // Open Modal Create/Edit
  const openModal = (unitToEdit?: UnitConversion) => {
    setError('');
    if (unitToEdit) {
      setEditingUnit(unitToEdit);
      setForm({
        baseUnit: unitToEdit.baseUnit || '',
        convertedUnit: unitToEdit.convertedUnit,
        quantity: unitToEdit.quantity,
        status: unitToEdit.status,
        description: unitToEdit.description || '',
      });
    } else {
      setEditingUnit(null);
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

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUnit(null);
    setError('');
  };

  // Save Unit
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.convertedUnit.trim()) {
      setError('Vui lòng nhập Tên quy đổi.');
      return;
    }
    if (form.quantity <= 0) {
      setError('Số lượng quy đổi phải lớn hơn 0.');
      return;
    }

    setSaving(true);
    setError('');

    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token || ''}`,
    };

    const payload = {
      baseUnit: form.baseUnit.trim(),
      convertedUnit: form.convertedUnit.trim(),
      quantity: Number(form.quantity),
      status: form.status,
      description: form.description.trim(),
    };

    try {
      if (editingUnit) {
        await fetch(`${API_BASE_URL}/units/${editingUnit.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
        }).catch(() => null);

        const updated: UnitConversion = {
          ...editingUnit,
          ...payload,
        };

        setUnits((prev) => {
          const next = prev.map((u) => (u.id === editingUnit.id ? updated : u));
          saveStoredUnits(next);
          return next;
        });

        setSuccess(`Đã cập nhật đơn vị quy đổi "${payload.convertedUnit}".`);
      } else {
        const createRes = await fetch(`${API_BASE_URL}/units`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        }).catch(() => null);

        let newId = `unit-${Date.now()}`;
        if (createRes && createRes.ok) {
          const resData = await createRes.json();
          if (resData.id) newId = resData.id;
        }

        const newUnit: UnitConversion = {
          id: newId,
          ...payload,
          createdAt: new Date().toISOString(),
        };

        setUnits((prev) => {
          const next = [newUnit, ...prev];
          saveStoredUnits(next);
          return next;
        });

        setSuccess(`Đã thêm mới đơn vị quy đổi "${payload.convertedUnit}".`);
      }
      closeModal();
    } catch {
      setError('Có lỗi xảy ra khi lưu đơn vị quy đổi.');
    } finally {
      setSaving(false);
    }
  };

  // Toggle Unit Status
  const handleToggleStatus = async (unit: UnitConversion) => {
    const nextStatus: 'active' | 'inactive' = unit.status === 'active' ? 'inactive' : 'active';
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/units/${unit.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      }).catch(() => null);

      setUnits((prev) => {
        const next: UnitConversion[] = prev.map((u) => (u.id === unit.id ? { ...u, status: nextStatus } : u));
        saveStoredUnits(next);
        return next;
      });

      setSuccess(`Đã ${nextStatus === 'active' ? 'kích hoạt' : 'ngưng'} đơn vị "${unit.convertedUnit}".`);
    } catch {
      setError('Có lỗi xảy ra khi cập nhật trạng thái.');
    }
  };

  // Single Delete
  const handleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/units/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token || ''}` },
      }).catch(() => null);

      setUnits((prev) => {
        const next = prev.filter((u) => u.id !== id);
        saveStoredUnits(next);
        return next;
      });

      setSelectedIds((prev) => prev.filter((item) => item !== id));
      setSuccess('Đã xóa đơn vị quy đổi.');
      setDeletingId(null);
    } catch {
      setError('Có lỗi xảy ra khi xóa đơn vị quy đổi.');
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setSaving(true);

    try {
      const token = localStorage.getItem('token');
      await Promise.all(
        selectedIds.map((id) =>
          fetch(`${API_BASE_URL}/units/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token || ''}` },
          }).catch(() => null)
        )
      );

      setUnits((prev) => {
        const next = prev.filter((u) => !selectedIds.includes(u.id));
        saveStoredUnits(next);
        return next;
      });

      setSuccess(`Đã xóa ${selectedIds.length} đơn vị quy đổi được chọn.`);
      setSelectedIds([]);
      setIsBulkDeleteModalOpen(false);
    } catch {
      setError('Có lỗi xảy ra khi xóa các đơn vị quy đổi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Toast message={error || success} type={error ? 'error' : 'success'} onClose={() => { setError(''); setSuccess(''); }} />

      {/* Title Header styled as pill badge matching "Người dùng / Nhân viên" */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2.5 rounded-2xl bg-cyan-600 px-5 py-2.5 text-white shadow-md">
            <Scale className="h-5 w-5" />
            <h1 className="text-xl font-extrabold tracking-tight">Đơn vị quy đổi</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => openModal()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700 active:scale-95 cursor-pointer"
          >
            <PlusCircle className="h-4.5 w-4.5" />
            Thêm mới đơn vị quy đổi
          </button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-cyan-50 border-2 border-cyan-500 px-4 py-3 shadow-sm animate-in fade-in">
          <span className="text-sm font-bold text-cyan-900">
            Đã chọn <b className="text-cyan-700 font-extrabold text-base">{selectedIds.length}</b> đơn vị quy đổi
          </span>
          <button
            type="button"
            onClick={() => setIsBulkDeleteModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-red-700 transition cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            Xóa các đơn vị đã chọn ({selectedIds.length})
          </button>
        </div>
      )}

      {/* Search & Custom Status Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm theo Tên quy đổi, Đơn vị gốc, Mô tả..."
            className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white pl-12 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:ring-4 focus:ring-cyan-500/10"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-cyan-600" />
          <CustomSelect
            value={statusFilter}
            onChange={(val) => setStatusFilter(val as any)}
            options={[
              { value: 'all', label: 'Tất cả trạng thái' },
              { value: 'active', label: 'Đang hoạt động' },
              { value: 'inactive', label: 'Ngưng hoạt động' },
            ]}
            className="w-48"
          />
        </div>
      </div>

      {/* Balanced Units Table */}
      {filteredUnits.length > 0 ? (
        <div className="overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-sm">
          <div className="max-h-[640px] overflow-auto">
            <table className="w-full border-collapse text-left">
              <thead className="bg-cyan-50 sticky top-0 z-20 shadow-sm">
                <tr className="border-b-2 border-slate-200">
                  <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 w-[50px]">
                    <input
                      type="checkbox"
                      checked={
                        paginatedUnits.length > 0 &&
                        paginatedUnits.every((u) => selectedIds.includes(u.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(
                            Array.from(new Set([...selectedIds, ...paginatedUnits.map((u) => u.id)]))
                          );
                        } else {
                          setSelectedIds(
                            selectedIds.filter((id) => !paginatedUnits.some((u) => u.id === id))
                          );
                        }
                      }}
                      className="h-4 w-4 rounded border-cyan-500 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                    />
                  </th>
                  <th className="border-r border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 w-[60px]">
                    STT
                  </th>
                  <th className="border-r border-slate-200 px-4 py-4 text-center text-sm font-extrabold uppercase text-slate-800 w-[15%]">
                    ĐƠN VỊ GỐC
                  </th>
                  <th className="border-r border-slate-200 px-4 py-4 text-left text-sm font-extrabold uppercase text-slate-800 w-[38%]">
                    TÊN QUY ĐỔI
                  </th>
                  <th className="border-r border-slate-200 px-4 py-4 text-center text-sm font-extrabold uppercase text-slate-800 w-[15%]">
                    SỐ LƯỢNG
                  </th>
                  <th className="border-r border-slate-200 px-4 py-4 text-center text-sm font-extrabold uppercase text-slate-800 w-[18%]">
                    TRẠNG THÁI
                  </th>
                  <th className="sticky right-0 border-l border-slate-200 bg-cyan-50 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 shadow-[-4px_0_12px_rgba(0,0,0,0.03)] w-[14%]">
                    THAO TÁC
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {paginatedUnits.map((unit, index) => {
                  const globalIndex = (currentPage - 1) * pageSize + index + 1;
                  const isSelected = selectedIds.includes(unit.id);

                  return (
                    <tr
                      key={unit.id}
                      className={`group border-b border-slate-200 transition ${
                        isSelected ? 'bg-cyan-50/70' : 'hover:bg-cyan-50/50'
                      }`}
                    >
                      <td className="border-r border-slate-200 px-3 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedIds((prev) =>
                              prev.includes(unit.id)
                                ? prev.filter((id) => id !== unit.id)
                                : [...prev, unit.id]
                            );
                          }}
                          className="h-4 w-4 rounded border-cyan-500 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                        />
                      </td>
                      <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-medium text-slate-700">
                        {globalIndex}
                      </td>
                      <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-semibold text-slate-800">
                        {unit.baseUnit ? (
                          <span className="inline-block rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 border border-slate-200">
                            {unit.baseUnit}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-xs">-</span>
                        )}
                      </td>
                      <td className="border-r border-slate-200 px-4 py-3.5 text-left text-sm font-bold text-cyan-900">
                        {unit.convertedUnit}
                      </td>
                      <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-extrabold text-slate-800">
                        {unit.quantity.toLocaleString('vi-VN')}
                      </td>
                      <td className="border-r border-slate-200 px-4 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(unit)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold transition cursor-pointer ${
                            unit.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {unit.status === 'active' ? (
                            <>
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                              <span>Đang hoạt động</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5 text-slate-400" />
                              <span>Ngưng hoạt động</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-3.5 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 hover:text-cyan-700 cursor-pointer"
                            title="Sửa đơn vị"
                            onClick={() => openModal(unit)}
                          >
                            <Pencil size={18} strokeWidth={2.5} />
                          </button>

                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 hover:text-cyan-700 cursor-pointer"
                            title="Xóa đơn vị"
                            onClick={() => setDeletingId(unit.id)}
                          >
                            <Trash2 size={18} strokeWidth={2.5} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer with Custom Rounded Select */}
          {totalItems > 0 && (
            <div className="flex flex-col items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-3 sm:flex-row">
              <div className="text-sm font-medium text-slate-600">
                Tổng số: <b className="font-extrabold text-slate-900">{totalItems}</b> đơn vị quy đổi{' '}
                <span className="ml-2 text-slate-500">
                  Hiển thị {startIndex} - {endIndex}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-2 sm:mt-0">
                <CustomSelect
                  value={pageSize}
                  onChange={(val) => {
                    setPageSize(Number(val));
                    setCurrentPage(1);
                  }}
                  options={[
                    { value: 10, label: '10 dòng / trang' },
                    { value: 20, label: '20 dòng / trang' },
                    { value: 50, label: '50 dòng / trang' },
                  ]}
                  className="w-40"
                />

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                  >
                    «
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-sm font-bold text-white shadow-xs"
                  >
                    {currentPage}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                  >
                    ›
                  </button>
                  <button
                    type="button"
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
      ) : (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 mb-4">
            <Scale size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Không tìm thấy đơn vị quy đổi nào</h3>
          <p className="mt-1 text-sm text-slate-500">Thử thay đổi từ khóa tìm kiếm hoặc tạo đơn vị quy đổi mới.</p>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-2xl transition-all">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="text-lg font-extrabold text-slate-800">
                  {editingUnit ? 'Chỉnh sửa Đơn vị quy đổi' : 'Thêm mới Đơn vị quy đổi'}
                </h3>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600">
                    Tên quy đổi <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.convertedUnit}
                    onChange={(e) => setForm((prev) => ({ ...prev, convertedUnit: e.target.value }))}
                    placeholder="VD: Chai 500ml, Vỉ 10 viên, Lon..."
                    className="mt-1 h-11 w-full rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600">
                    Đơn vị gốc
                  </label>
                  <input
                    type="text"
                    value={form.baseUnit}
                    onChange={(e) => setForm((prev) => ({ ...prev, baseUnit: e.target.value }))}
                    placeholder="VD: Thùng, Hộp, Bao, Kiện..."
                    className="mt-1 h-11 w-full rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600">
                    Số lượng quy đổi <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={(e) => setForm((prev) => ({ ...prev, quantity: Math.max(1, Number(e.target.value)) }))}
                    className="mt-1 h-11 w-full rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Trạng thái</label>
                  <CustomSelect
                    value={form.status}
                    onChange={(val) => setForm((prev) => ({ ...prev, status: val as any }))}
                    options={[
                      { value: 'active', label: 'Đang hoạt động' },
                      { value: 'inactive', label: 'Ngưng hoạt động' },
                    ]}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600">Mô tả / Ghi chú</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Ghi chú thêm thông tin về quy đổi..."
                    rows={2}
                    className="mt-1 w-full rounded-xl border-2 border-cyan-500 bg-white p-3 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-xl border-2 border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700 disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? 'Đang lưu...' : 'Lưu Đơn vị quy đổi'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* SINGLE DELETE CONFIRM MODAL */}
      {deletingId &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-2xl">
              <h3 className="text-lg font-extrabold text-slate-800">Xác nhận xóa Đơn vị quy đổi</h3>
              <p className="mt-2 text-sm text-slate-600">
                Bạn có chắc chắn muốn xóa đơn vị quy đổi này không?
              </p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeletingId(null)}
                  className="rounded-xl border-2 border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(deletingId)}
                  className="rounded-xl bg-red-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:bg-red-700 cursor-pointer"
                >
                  Xóa ngay
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* BULK DELETE CONFIRM MODAL */}
      {isBulkDeleteModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-2xl">
              <h3 className="text-lg font-extrabold text-slate-800">Xác nhận xóa hàng loạt</h3>
              <p className="mt-2 text-sm text-slate-600">
                Bạn có chắc chắn muốn xóa <b className="text-red-600">{selectedIds.length}</b> đơn vị quy đổi đã chọn?
              </p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsBulkDeleteModalOpen(false)}
                  className="rounded-xl border-2 border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={saving}
                  className="rounded-xl bg-red-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Đang xóa...' : 'Xóa ngay'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
