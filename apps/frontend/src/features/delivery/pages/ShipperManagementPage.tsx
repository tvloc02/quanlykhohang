import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  XCircle,
  Eye,
  Pencil,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from 'lucide-react';
import QuickAddShipperModal from '../components/QuickAddShipperModal';
import ViewShipperModal from '../components/ViewShipperModal';
import { getStoredShippers, deleteShipper, type Shipper } from '../services/shipperService';

export default function ShipperManagementPage() {
  const [shippers, setShippers] = useState<Shipper[]>([]);
  const [search, setSearch] = useState('');
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editShipper, setEditShipper] = useState<Shipper | null>(null);
  const [viewShipper, setViewShipper] = useState<Shipper | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Shipper | null>(null);
  const [deleting, setDeleting] = useState(false);

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
        (s.company || '').toLowerCase().includes(q) ||
        (s.id || '').toLowerCase().includes(q) ||
        (s.note || '').toLowerCase().includes(q)
      );
    });
  }, [shippers, search]);

  // Pagination calculation
  const totalItems = filteredShippers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  const paginatedShippers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredShippers.slice(start, start + pageSize);
  }, [filteredShippers, currentPage, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      deleteShipper(deleteTarget.id);
      setSelectedIds((prev) => prev.filter((i) => i !== deleteTarget.id));
      setToast({ message: `Đã xóa tài xế ${deleteTarget.name}`, type: 'success' });
      setDeleteTarget(null);
      loadShippers();
    } catch (err: any) {
      setToast({ message: 'Lỗi khi xóa tài xế', type: 'error' });
    } finally {
      setDeleting(false);
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
        <div className={`fixed right-6 top-24 z-[9999] flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-xl ${toast.type === 'error' ? 'border-red-200 text-red-600' : 'border-emerald-200 text-emerald-600'}`}>
          {toast.type === 'error' ? <XCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          <p className="text-sm font-bold">{toast.message}</p>
          <button type="button" onClick={() => setToast(null)} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header matching Delivery / Outbound UI layout */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-md">
          <Bike className="h-5 w-5 text-cyan-100" />
          <h1 className="text-lg font-bold tracking-tight text-white">Danh sách Shipper / Tài xế</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setEditShipper(null);
              setShowAddModal(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 cursor-pointer"
          >
            <UserPlus className="h-4.5 w-4.5" />
            <span>Thêm Shipper / Tài xế mới</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 min-w-[320px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-cyan-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm theo họ tên, SĐT, biển số xe, đơn vị vận chuyển, mã shipper..."
              className="h-12 w-full rounded-xl border-2 border-cyan-600/40 bg-white pl-11 pr-4 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-2xs"
            />
          </div>

          <div className="text-xs font-extrabold text-slate-600 px-2 whitespace-nowrap">
            Tổng cộng: <span className="text-cyan-700 font-black text-sm">{filteredShippers.length}</span> tài xế
          </div>
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-cyan-500 bg-cyan-50 p-3.5 shadow-md">
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

      {/* High-Density Table */}
      <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[1200px] border-collapse text-left">
            <thead className="bg-cyan-50 sticky top-0 z-20 shadow-sm">
              <tr className="border-b-2 border-slate-200 text-slate-800 font-extrabold uppercase text-xs sm:text-sm tracking-wider whitespace-nowrap">
                <th className="w-12 min-w-[50px] border-r border-slate-200 px-2 py-4 text-center whitespace-nowrap">
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
                    className="h-4.5 w-4.5 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                  />
                </th>
                <th className="w-14 min-w-[60px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">STT</th>
                <th className="min-w-[140px] border-r border-slate-200 px-4 py-4 text-center whitespace-nowrap">Mã Shipper</th>
                <th className="min-w-[180px] border-r border-slate-200 px-4 py-4 text-center whitespace-nowrap">Họ và tên tài xế</th>
                <th className="min-w-[150px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Số điện thoại</th>
                <th className="min-w-[150px] border-r border-slate-200 px-4 py-4 text-center whitespace-nowrap">Biển số xe</th>
                <th className="min-w-[170px] border-r border-slate-200 px-4 py-4 text-center whitespace-nowrap">Đơn vị / Đội xe</th>
                <th className="min-w-[180px] border-r border-slate-200 px-4 py-4 text-center whitespace-nowrap">Ghi chú</th>
                <th className="sticky right-0 top-0 z-30 w-36 min-w-[140px] bg-cyan-100 px-3 py-4 text-center shadow-[-4px_0_12px_rgba(0,0,0,0.05)] border-l border-slate-200 text-cyan-950 font-black whitespace-nowrap">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white font-medium">
              {paginatedShippers.length > 0 ? (
                paginatedShippers.map((s, index) => {
                  const globalIndex = (currentPage - 1) * pageSize + index + 1;
                  const isSelected = selectedIds.includes(s.id);

                  return (
                    <tr
                      key={s.id}
                      className={`group border-b border-slate-200 transition hover:bg-cyan-50/60 ${
                        isSelected ? 'bg-cyan-50/70' : ''
                      }`}
                    >
                      <td className="border-r border-slate-200 px-2 py-3.5 text-center">
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
                          className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                        />
                      </td>
                      <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-medium text-slate-700 whitespace-nowrap">
                        {globalIndex}
                      </td>
                      <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-extrabold text-cyan-900 whitespace-nowrap">
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
                      <td className="sticky right-0 z-10 w-36 min-w-[140px] bg-white group-hover:bg-cyan-50/90 px-3 py-3.5 text-center shadow-[-4px_0_12px_rgba(0,0,0,0.05)] border-l border-slate-200">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Xem button */}
                          <button
                            type="button"
                            onClick={() => setViewShipper(s)}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-700 bg-white text-cyan-700 shadow-2xs transition hover:bg-cyan-50 cursor-pointer"
                            title="Xem chi tiết tài xế"
                          >
                            <Eye className="h-4 w-4 text-cyan-700" strokeWidth={2.2} />
                          </button>
                          {/* Sửa button */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditShipper(s);
                              setShowAddModal(true);
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-700 bg-white text-cyan-700 shadow-2xs transition hover:bg-cyan-50 cursor-pointer"
                            title="Sửa thông tin tài xế"
                          >
                            <Pencil className="h-4 w-4 text-cyan-700" strokeWidth={2.2} />
                          </button>
                          {/* Xóa button */}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(s)}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-red-600 bg-white text-red-600 shadow-2xs transition hover:bg-red-50 cursor-pointer"
                            title="Xóa tài xế"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" strokeWidth={2.2} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 font-semibold text-sm">
                    Chưa có thông tin tài xế shipper nào. Bấm nút "+ Thêm Shipper / Tài xế mới" để tạo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t-2 border-slate-200 bg-slate-50/90 px-4 py-3.5 text-sm font-bold text-slate-700">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-slate-700">Hiển thị:</span>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setCurrentPage(1);
                }}
                className="h-9 rounded-xl border-2 border-slate-300 bg-white px-3 text-sm font-black text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer shadow-xs"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm font-bold text-slate-600">dòng/trang</span>
            </div>
            <div className="border-l-2 border-slate-300 pl-3 text-sm font-semibold text-slate-600">
              Hiển thị <span className="font-extrabold text-slate-900">{totalItems > 0 ? startIndex : 0}</span> -{' '}
              <span className="font-extrabold text-slate-900">{endIndex}</span> trên tổng <span className="font-black text-cyan-800">{totalItems}</span> tài xế
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm font-bold">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-slate-700 hover:bg-cyan-50 hover:border-cyan-600 hover:text-cyan-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-slate-300 disabled:hover:text-slate-700 transition cursor-pointer shadow-2xs"
              title="Trang đầu"
            >
              <ChevronsLeft size={18} strokeWidth={2.5} />
            </button>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-slate-700 hover:bg-cyan-50 hover:border-cyan-600 hover:text-cyan-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-slate-300 disabled:hover:text-slate-700 transition cursor-pointer shadow-2xs"
              title="Trang trước"
            >
              <ChevronLeft size={18} strokeWidth={2.5} />
            </button>
            <span className="px-2 text-sm font-extrabold text-slate-800">
              Trang <span className="text-cyan-700 font-black">{currentPage}</span> / {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-slate-700 hover:bg-cyan-50 hover:border-cyan-600 hover:text-cyan-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-slate-300 disabled:hover:text-slate-700 transition cursor-pointer shadow-2xs"
              title="Trang tiếp"
            >
              <ChevronRight size={18} strokeWidth={2.5} />
            </button>
            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(totalPages)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-slate-700 hover:bg-cyan-50 hover:border-cyan-600 hover:text-cyan-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-slate-300 disabled:hover:text-slate-700 transition cursor-pointer shadow-2xs"
              title="Trang cuối"
            >
              <ChevronsRight size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="rounded-xl bg-red-100 p-2 text-red-600">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Xóa tài xế / shipper</h3>
            </div>
            <p className="text-sm font-semibold text-slate-600">
              Bạn có chắc chắn muốn xóa tài xế <span className="font-extrabold text-slate-900">{deleteTarget.name}</span> ({deleteTarget.id}) không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="rounded-xl bg-red-600 px-5 py-2 text-sm font-bold text-white shadow-md transition hover:bg-red-700 cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Quick Add / Edit Modal */}
      <QuickAddShipperModal
        isOpen={showAddModal}
        editShipper={editShipper}
        onClose={() => {
          setShowAddModal(false);
          setEditShipper(null);
        }}
        onSuccess={(savedShipper) => {
          setToast({
            message: editShipper
              ? `Đã cập nhật thông tin tài xế "${savedShipper.name}" thành công!`
              : `Đã thêm tài xế "${savedShipper.name}" thành công!`,
            type: 'success',
          });
          loadShippers();
        }}
      />

      {/* View Detail Modal */}
      <ViewShipperModal
        isOpen={Boolean(viewShipper)}
        shipper={viewShipper}
        onClose={() => setViewShipper(null)}
      />
    </div>
  );
}
