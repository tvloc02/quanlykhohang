import React, { useState, useEffect, useMemo } from 'react';
import {
  Bike,
  Search,
  Trash2,
  Phone,
  Car,
  Building,
  User,
  CheckCircle2,
  UserPlus,
  X,
} from 'lucide-react';
import QuickAddShipperModal from '../components/QuickAddShipperModal';
import { getStoredShippers, deleteShipper, type Shipper } from '../services/shipperService';

export default function ShipperManagementPage() {
  const [shippers, setShippers] = useState<Shipper[]>([]);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Pagination State
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const loadShippers = () => {
    setShippers(getStoredShippers());
  };

  useEffect(() => {
    loadShippers();
    const handleUpdate = () => loadShippers();
    window.addEventListener('shippers-updated', handleUpdate);
    return () => window.removeEventListener('shippers-updated', handleUpdate);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Reset pagination & selection when search changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
  }, [search]);

  const filteredShippers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shippers.filter((s) => {
      return (
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.vehiclePlate.toLowerCase().includes(q) ||
        (s.company || '').toLowerCase().includes(q)
      );
    });
  }, [shippers, search]);

  // Pagination calculation
  const totalItems = filteredShippers.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  const paginatedShippers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredShippers.slice(start, start + pageSize);
  }, [filteredShippers, currentPage, pageSize]);

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa tài xế "${name}" khỏi hệ thống?`)) {
      deleteShipper(id);
      setSelectedIds((prev) => prev.filter((i) => i !== id));
      setToast({ message: `Đã xóa tài xế ${name}`, type: 'success' });
      loadShippers();
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} tài xế đã chọn khỏi hệ thống?`)) {
      selectedIds.forEach((id) => deleteShipper(id));
      setSelectedIds([]);
      setToast({ message: `Đã xóa ${selectedIds.length} tài xế thành công!`, type: 'success' });
      loadShippers();
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-white shadow-2xl animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-5 w-5 text-cyan-400" />
          <span className="text-sm font-bold">{toast.message}</span>
        </div>
      )}

      {/* Header matching Personnel page layout without 3 summary buttons */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2.5 rounded-2xl bg-cyan-600 px-5 py-2.5 text-white shadow-md">
            <Bike className="h-5 w-5 text-white" />
            <h1 className="text-xl font-extrabold tracking-tight">Danh sách Shipper / Tài xế</h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700 active:scale-95 cursor-pointer"
          >
            <UserPlus className="h-4.5 w-4.5" />
            <span>Thêm Shipper / Tài xế mới</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar matching Personnel page */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm theo họ tên, SĐT, biển số xe, đơn vị vận chuyển..."
            className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white pl-12 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:ring-4 focus:ring-cyan-500/10"
          />
        </div>

        <div className="text-sm font-extrabold text-slate-600 px-2">
          Tổng cộng: <span className="text-cyan-700 font-black text-base">{filteredShippers.length}</span> tài xế
        </div>
      </div>

      {/* Bulk Action Toolbar matching Personnel page */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-cyan-500 bg-cyan-50 p-3.5 shadow-md animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-600 text-xs font-black text-white">
              {selectedIds.length}
            </span>
            <span className="text-sm font-extrabold text-cyan-950">
              Tài xế đã được chọn
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBulkDelete}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-red-500 bg-white px-3.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 transition cursor-pointer"
            >
              <Trash2 className="h-4 w-4" /> Xóa ({selectedIds.length})
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

      {/* High-Density Table matching Personnel page layout */}
      <div className="overflow-x-auto rounded-xl border-2 border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-left">
          <thead className="bg-cyan-50 sticky top-0 z-20 shadow-sm">
            <tr className="border-b-2 border-slate-200">
              <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 w-12 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={paginatedShippers.length > 0 && paginatedShippers.every((s) => selectedIds.includes(s.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const currentIds = paginatedShippers.map((s) => s.id);
                      setSelectedIds((prev) => Array.from(new Set([...prev, ...currentIds])));
                    } else {
                      const currentIds = new Set(paginatedShippers.map((s) => s.id));
                      setSelectedIds((prev) => prev.filter((id) => !currentIds.has(id)));
                    }
                  }}
                  className="h-4 w-4 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                />
              </th>
              <th className="border-r border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 w-14 whitespace-nowrap">
                STT
              </th>
              <th className="border-r border-slate-200 px-4 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[130px] whitespace-nowrap">
                MÃ SHIPPER
              </th>
              <th className="border-r border-slate-200 px-4 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[180px] whitespace-nowrap">
                HỌ VÀ TÊN TÀI XẾ
              </th>
              <th className="border-r border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 w-36 whitespace-nowrap">
                SỐ ĐIỆN THOẠI
              </th>
              <th className="border-r border-slate-200 px-4 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[150px] whitespace-nowrap">
                BIỂN SỐ XE
              </th>
              <th className="border-r border-slate-200 px-4 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[170px] whitespace-nowrap">
                ĐƠN VỊ / ĐỘI XE
              </th>
              <th className="border-r border-slate-200 px-4 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[180px] whitespace-nowrap">
                GHI CHÚ
              </th>
              <th className="sticky right-0 border-l border-slate-200 bg-cyan-50 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 shadow-[-4px_0_12px_rgba(0,0,0,0.03)] w-28 min-w-[120px] whitespace-nowrap">
                THAO TÁC
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {paginatedShippers.length > 0 ? (
              paginatedShippers.map((s, index) => {
                const globalIndex = (currentPage - 1) * pageSize + index + 1;
                const isSelected = selectedIds.includes(s.id);

                return (
                  <tr
                    key={s.id}
                    className={`group border-b border-slate-200 transition hover:bg-cyan-50/50 ${
                      isSelected ? 'bg-cyan-50/70' : ''
                    }`}
                  >
                    <td className="border-r border-slate-200 px-3 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          setSelectedIds((prev) =>
                            prev.includes(s.id)
                              ? prev.filter((id) => id !== s.id)
                              : [...prev, s.id]
                          );
                        }}
                        className="h-4 w-4 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                      />
                    </td>
                    <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-medium text-slate-700 whitespace-nowrap">
                      {globalIndex}
                    </td>
                    <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-bold text-cyan-900 whitespace-nowrap">
                      {s.id}
                    </td>
                    <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-extrabold text-slate-800 whitespace-nowrap">
                      <div className="inline-flex items-center justify-center gap-2">
                        <User className="h-4 w-4 text-cyan-600 shrink-0" />
                        <span>{s.name}</span>
                      </div>
                    </td>
                    <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-semibold text-slate-700 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
                        {s.phone}
                      </span>
                    </td>
                    <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-black text-cyan-800 uppercase whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 bg-cyan-50 px-2.5 py-0.5 rounded-lg border border-cyan-200">
                        <Car className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
                        {s.vehiclePlate || 'N/A'}
                      </span>
                    </td>
                    <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-semibold text-slate-700 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <Building className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        {s.company || 'Nội bộ'}
                      </span>
                    </td>
                    <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm text-slate-500 italic max-w-xs truncate">
                      {s.note || '-'}
                    </td>
                    <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-3.5 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDelete(s.id, s.name)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-red-500 bg-white text-red-600 shadow-sm transition hover:bg-red-50 hover:text-red-700 cursor-pointer"
                          title="Xóa tài xế"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : null}

            {/* Empty Lined Rows up to 10 rows minimum */}
            {Array.from({ length: Math.max(0, 10 - paginatedShippers.length) }).map((_, idx) => (
              <tr key={`empty-shipper-${idx}`} className={`h-11 ${paginatedShippers.length === 0 && idx === 3 ? 'bg-slate-50/50' : ''}`}>
                <td className="border-r border-b border-slate-200 px-3 py-3 text-center"></td>
                <td className="border-r border-b border-slate-200 px-3 py-3 text-center text-slate-300 font-mono text-[11px]">
                  {paginatedShippers.length + idx + 1}
                </td>
                <td className="border-r border-b border-slate-200 px-4 py-3 text-center text-slate-400 text-xs italic" colSpan={6}>
                  {paginatedShippers.length === 0 && idx === 3 ? 'Chưa có thông tin tài xế shipper nào. Bấm nút "+ Thêm Shipper mới" để tạo.' : ''}
                </td>
                <td className="sticky right-0 border-l border-b border-slate-200 bg-white px-3 py-3"></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination Footer matching Personnel page */}
        {totalItems > 0 && (
          <div className="flex flex-col items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-3 sm:flex-row">
            <div className="text-sm font-medium text-slate-600">
              Tổng số: <b className="font-extrabold text-slate-900">{totalItems}</b> tài xế{' '}
              <span className="ml-2 text-slate-500">
                Hiển thị {startIndex} - {endIndex}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2 sm:mt-0">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm font-bold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                >
                  «
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .slice(Math.max(0, currentPage - 2), Math.min(totalPages, currentPage + 1))
                  .map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold shadow-xs cursor-pointer ${
                        page === currentPage
                          ? 'bg-cyan-600 text-white font-extrabold'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                >
                  ›
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                >
                  »
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Add Modal */}
      <QuickAddShipperModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={(newShipper) => {
          setToast({ message: `Đã thêm tài xế "${newShipper.name}" thành công!`, type: 'success' });
          loadShippers();
        }}
      />
    </div>
  );
}
