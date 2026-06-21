import React from 'react';
import {
  Eye,
  Pencil,
  PlusCircle,
  Search,
  Trash2,
  ClipboardList,
  X,
  XCircle,
  CheckCircle,
  Filter,
} from 'lucide-react';

// Tích hợp Toast nội bộ để không bị lỗi import
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  React.useEffect(() => {
    if (message) {
      const timer = setTimeout(() => onClose(), 3000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className={`fixed top-4 right-4 z-[60] flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg transition-all ${type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
      {type === 'error' ? <XCircle size={20} /> : <CheckCircle size={20} />}
      <p className="text-sm font-semibold">{message}</p>
      <button onClick={onClose} className="ml-2 rounded-lg p-1 hover:bg-white/50 transition">
        <X size={16} />
      </button>
    </div>
  );
}

interface InboundReceipt {
  id: string;
  receiptNo: string;
  supplier: string;
  expectedDate: string;
  status: 'pending' | 'received' | 'completed';
  items: number;
}

type InboundForm = {
  receiptNo: string;
  supplier: string;
  expectedDate: string;
  status: 'pending' | 'received' | 'completed';
  items: number | '';
};

type ModalMode = 'create' | 'view' | 'edit' | 'delete' | null;

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function buildEmptyForm(): InboundForm {
  return {
    receiptNo: '',
    supplier: '',
    expectedDate: '',
    status: 'pending',
    items: '',
  };
}

export default function Inbound() {
  const [receipts, setReceipts] = React.useState<InboundReceipt[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [modalMode, setModalMode] = React.useState<ModalMode>(null);
  const [selectedReceipt, setSelectedReceipt] = React.useState<InboundReceipt | null>(null);
  const [form, setForm] = React.useState<InboundForm>(buildEmptyForm());

  // Pagination states
  const [pageSize, setPageSize] = React.useState(20);
  const [currentPage, setCurrentPage] = React.useState(1);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/inbounds`, { headers: authHeaders() });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không tải được danh sách phiếu nhập');
      }

      const data = (await response.json()) as InboundReceipt[];
      setReceipts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi hệ thống khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset trang khi filter
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const filteredReceipts = receipts.filter((receipt) => {
    const keyword = search.trim().toLowerCase();
    return (
      !keyword ||
      receipt.receiptNo.toLowerCase().includes(keyword) ||
      receipt.supplier.toLowerCase().includes(keyword)
    );
  });

  // Calculate Pagination
  const totalItems = filteredReceipts.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedReceipts = filteredReceipts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  const statusColor = {
    pending: 'border-yellow-200 bg-yellow-50 text-yellow-700',
    received: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };

  const statusLabel = {
    pending: 'Chờ xử lý',
    received: 'Đã nhận',
    completed: 'Hoàn thành',
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedReceipt(null);
    setSaving(false);
  };

  const openModal = (mode: ModalMode, receipt?: InboundReceipt) => {
    setError('');
    setSuccess('');
    setSelectedReceipt(receipt || null);
    
    if (mode === 'create') {
      setForm(buildEmptyForm());
    } else if (receipt) {
      setForm({
        receiptNo: receipt.receiptNo,
        supplier: receipt.supplier,
        expectedDate: receipt.expectedDate,
        status: receipt.status,
        items: receipt.items,
      });
    }
    
    setModalMode(mode);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.receiptNo.trim() || !form.supplier.trim() || !form.expectedDate || form.items === '') {
      setError('Vui lòng nhập đầy đủ các thông tin bắt buộc.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const isEdit = modalMode === 'edit';
      const url = isEdit && selectedReceipt ? `${API_BASE_URL}/inbounds/${selectedReceipt.id}` : `${API_BASE_URL}/inbounds`;
      
      const response = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          receiptNo: form.receiptNo.trim().toUpperCase(),
          supplier: form.supplier.trim(),
          expectedDate: form.expectedDate,
          status: form.status,
          items: Number(form.items),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || (isEdit ? 'Không cập nhật được phiếu nhập' : 'Không tạo được phiếu nhập'));
      }

      setSuccess(isEdit ? 'Đã cập nhật phiếu nhập.' : 'Đã tạo phiếu nhập mới.');
      closeModal();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi lưu phiếu nhập');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedReceipt) return;
    setSaving(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/inbounds/${selectedReceipt.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không xóa được phiếu nhập');
      }

      setSuccess('Đã xóa phiếu nhập.');
      closeModal();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi xóa phiếu nhập');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Toast
        message={error || success}
        type={error ? 'error' : 'success'}
        onClose={() => {
          setError('');
          setSuccess('');
        }}
      />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Quản lý nhập hàng</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Theo dõi và quản lý các phiếu nhập kho từ nhà cung cấp.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openModal('create')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700"
        >
          <PlusCircle className="h-4 w-4" />
          Tạo phiếu nhập
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white pl-11 pr-4 text-base outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
            placeholder="Tìm kiếm phiếu nhập theo mã PO, nhà cung cấp..."
          />
        </div>
        <div className="flex justify-start xl:justify-end">
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
            <Filter size={18} className="text-slate-500" />
            Lọc phiếu nhập
          </button>
        </div>
      </div>

      {/* Wrapper chứa bảng + phân trang dính liền nhau */}
      <div className="mt-5 overflow-hidden rounded-xl border-2 border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse bg-white">
            <thead className="bg-slate-50">
              <tr className="border-b-2 border-slate-200">
                <th className="w-16 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">STT</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Mã PO</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Nhà cung cấp</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Ngày dự kiến</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Số hàng hóa</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Trạng thái</th>
                <th className="sticky right-0 w-36 border-l border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm font-black uppercase text-slate-700 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Đang tải dữ liệu phiếu nhập...
                  </td>
                </tr>
              ) : paginatedReceipts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Chưa có phiếu nhập phù hợp.
                  </td>
                </tr>
              ) : (
                paginatedReceipts.map((receipt, index) => (
                  <tr key={receipt.id} className="group border-b border-slate-200 transition hover:bg-cyan-50/50">
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                      {startIndex + index}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-bold text-slate-800">
                      {receipt.receiptNo}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-medium text-slate-700">
                      {receipt.supplier}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                      {new Date(receipt.expectedDate).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700 font-bold">
                      {receipt.items} <span className="font-medium text-slate-500 text-xs">mặt hàng</span>
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                      <span className={`inline-flex rounded-lg border px-3 py-1 text-xs font-bold ${statusColor[receipt.status]}`}>
                        {statusLabel[receipt.status]}
                      </span>
                    </td>
                    <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-4 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100 hover:text-cyan-700"
                          aria-label="Xem chi tiết"
                          title="Xem chi tiết"
                          onClick={() => openModal('view', receipt)}
                        >
                          <Eye size={18} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100 hover:text-cyan-700"
                          aria-label="Sửa phiếu nhập"
                          title="Sửa phiếu nhập"
                          onClick={() => openModal('edit', receipt)}
                        >
                          <Pencil size={18} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100 hover:text-cyan-700"
                          aria-label="Xóa phiếu nhập"
                          title="Xóa phiếu nhập"
                          onClick={() => openModal('delete', receipt)}
                        >
                          <Trash2 size={18} strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        {!loading && totalItems > 0 && (
          <div className="flex flex-col items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-3 sm:flex-row">
            <div className="text-sm text-slate-600">
              Tổng số: <b>{totalItems}</b> <span className="ml-2">Hiển thị {startIndex} - {endIndex}</span>
            </div>
            <div className="mt-4 flex items-center gap-2 sm:mt-0">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              >
                <option value={5}>5</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  «
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  ‹
                </button>
                <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-sm font-bold text-white">
                  {currentPage}
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  ›
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  »
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm transition-all">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600">
                  <ClipboardList className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">
                    {modalMode === 'create' ? 'Tạo phiếu nhập mới' : modalMode === 'view' ? 'Chi tiết phiếu nhập' : modalMode === 'edit' ? 'Sửa phiếu nhập' : 'Xóa phiếu nhập'}
                  </h2>
                  <p className="text-sm font-medium text-slate-500">
                    {modalMode === 'view' ? 'Thông tin chỉ xem' : modalMode === 'delete' ? 'Thao tác xóa phiếu nhập' : 'Cập nhật thông tin phiếu nhập hàng'}
                  </p>
                </div>
              </div>
              <button type="button" onClick={closeModal} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalMode === 'delete' ? (
              <div className="px-6 py-5">
                <p className="text-base text-slate-700">
                  Bạn có chắc muốn xóa phiếu nhập{' '}
                  <span className="font-black text-slate-950">{selectedReceipt?.receiptNo}</span> không?
                </p>
                <p className="mt-2 text-sm text-red-500 font-medium">Hành động này không thể hoàn tác.</p>
                <div className="mt-8 flex justify-end gap-3">
                  <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition">
                    Hủy
                  </button>
                  <button 
                    type="button" 
                    onClick={handleDelete} 
                    disabled={saving}
                    className="rounded-xl bg-red-600 px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
                  >
                    {saving ? 'Đang xóa...' : 'Xóa phiếu nhập'}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-6 py-5">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Mã PO <span className="text-red-500">*</span></label>
                    <input
                      value={form.receiptNo}
                      onChange={(event) => setForm((current) => ({ ...current, receiptNo: event.target.value }))}
                      readOnly={modalMode === 'view'}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 uppercase outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:focus:border-slate-200 read-only:focus:ring-0"
                      placeholder="PO-2026-..."
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Nhà cung cấp <span className="text-red-500">*</span></label>
                    <input
                      value={form.supplier}
                      onChange={(event) => setForm((current) => ({ ...current, supplier: event.target.value }))}
                      readOnly={modalMode === 'view'}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:focus:border-slate-200 read-only:focus:ring-0"
                      placeholder="Tên nhà cung cấp..."
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Ngày dự kiến <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      value={form.expectedDate}
                      onChange={(event) => setForm((current) => ({ ...current, expectedDate: event.target.value }))}
                      readOnly={modalMode === 'view'}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:focus:border-slate-200 read-only:focus:ring-0"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Trạng thái</label>
                    <select
                      value={form.status}
                      onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as InboundForm['status'] }))}
                      disabled={modalMode === 'view'}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 disabled:bg-slate-50"
                    >
                      <option value="pending">Chờ xử lý</option>
                      <option value="received">Đã nhận</option>
                      <option value="completed">Hoàn thành</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-bold text-slate-700">Số hàng hóa dự kiến <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      min="1"
                      value={form.items}
                      onChange={(event) => setForm((current) => ({ ...current, items: event.target.value ? Number(event.target.value) : '' }))}
                      readOnly={modalMode === 'view'}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:focus:border-slate-200 read-only:focus:ring-0"
                      placeholder="0"
                      required
                    />
                  </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                  <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition">
                    {modalMode === 'view' ? 'Đóng' : 'Hủy'}
                  </button>
                  {modalMode !== 'view' && (
                    <button 
                      type="submit" 
                      disabled={saving}
                      className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
                    >
                      {saving ? 'Đang lưu...' : modalMode === 'create' ? 'Tạo phiếu nhập' : 'Lưu thay đổi'}
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}