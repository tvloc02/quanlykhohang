import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, Search, X, Save, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, Store, Phone, MapPin, ToggleLeft, ToggleRight, Loader2,
} from 'lucide-react';

// ─── TYPES ─────────────────────────────────────────────────────

interface Branch {
  id: string;
  code: string;
  name: string;
  address: string;
  phone?: string;
  status?: string;
  isFrozen?: boolean;
  type?: 'store' | 'warehouse' | 'office';
  createdAt?: string;
}

type ModalMode = 'create' | 'edit' | 'delete' | null;

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    if (message) { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }
  }, [message, onClose]);
  if (!message) return null;
  return (
    <div className={`fixed top-4 right-4 z-[999] flex items-center gap-3 rounded-xl px-5 py-3 shadow-lg border ${type === 'error' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
      {type === 'error' ? <XCircle size={18} /> : <CheckCircle size={18} />}
      <span className="text-sm font-semibold">{message}</span>
      <button onClick={onClose} className="ml-2 cursor-pointer"><X size={14} /></button>
    </div>
  );
}

const PAGE_SIZE = 10;
const EMPTY_FORM: { code: string; name: string; address: string; phone: string; status: string } = {
  code: '', name: '', address: '', phone: '', status: 'active',
};

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<Branch | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [toast, setToast] = useState({ message: '', type: 'success' as 'success' | 'error' });

  // Fetch real data from database via API
  const fetchBranches = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/warehouses`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBranches(Array.isArray(data) ? data : []);
      } else {
        setBranches([]);
      }
    } catch (err) {
      setBranches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const filtered = useMemo(() => {
    return branches.filter(b => {
      const q = search.toLowerCase();
      const matchQ = !q || (b.name && b.name.toLowerCase().includes(q)) || (b.code && b.code.toLowerCase().includes(q)) || (b.address && b.address.toLowerCase().includes(q));
      const matchStatus = !filterStatus || (b.status === filterStatus);
      return matchQ && matchStatus;
    });
  }, [branches, search, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openCreate() { setForm(EMPTY_FORM); setSelected(null); setModal('create'); }
  function openEdit(b: Branch) {
    setSelected(b);
    setForm({ code: b.code || '', name: b.name || '', address: b.address || '', phone: b.phone || '', status: b.status || 'active' });
    setModal('edit');
  }
  function openDelete(b: Branch) { setSelected(b); setModal('delete'); }
  function closeModal() { setModal(null); setSelected(null); }

  async function handleSave() {
    if (!form.name.trim()) { setToast({ message: 'Vui lòng nhập tên chi nhánh/kho!', type: 'error' }); return; }
    if (!form.code.trim()) { setToast({ message: 'Vui lòng nhập mã chi nhánh/kho!', type: 'error' }); return; }

    try {
      if (modal === 'create') {
        const res = await fetch(`${API_BASE_URL}/warehouses`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            code: form.code,
            name: form.name,
            address: form.address,
            phone: form.phone,
            status: form.status,
          }),
        });
        if (res.ok) {
          setToast({ message: 'Thêm chi nhánh thành công!', type: 'success' });
          fetchBranches();
          closeModal();
        } else {
          const err = await res.json();
          setToast({ message: err.message || 'Lỗi khi tạo chi nhánh!', type: 'error' });
        }
      } else if (modal === 'edit' && selected) {
        const res = await fetch(`${API_BASE_URL}/warehouses/${selected.id}`, {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify({
            code: form.code,
            name: form.name,
            address: form.address,
            phone: form.phone,
            status: form.status,
          }),
        });
        if (res.ok) {
          setToast({ message: 'Cập nhật chi nhánh thành công!', type: 'success' });
          fetchBranches();
          closeModal();
        } else {
          const err = await res.json();
          setToast({ message: err.message || 'Lỗi khi cập nhật!', type: 'error' });
        }
      }
    } catch {
      setToast({ message: 'Không thể kết nối đến máy chủ!', type: 'error' });
    }
  }

  async function handleDelete() {
    if (!selected) return;
    try {
      const res = await fetch(`${API_BASE_URL}/warehouses/${selected.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (res.ok) {
        setToast({ message: 'Đã xóa chi nhánh thành công!', type: 'success' });
        fetchBranches();
        closeModal();
      } else {
        const err = await res.json();
        setToast({ message: err.message || 'Không thể xóa chi nhánh!', type: 'error' });
      }
    } catch {
      setToast({ message: 'Không thể kết nối đến máy chủ!', type: 'error' });
    }
  }

  async function toggleStatus(b: Branch) {
    const newStatus = b.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(`${API_BASE_URL}/warehouses/${b.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setToast({ message: `Kho hàng "${b.name}" đã ${newStatus === 'active' ? 'kích hoạt' : 'tắt'}!`, type: 'success' });
        fetchBranches();
      }
    } catch {
      setToast({ message: 'Lỗi khi đổi trạng thái!', type: 'error' });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: '' })} />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <span>Hệ thống</span><span>›</span><span className="text-gray-800 font-semibold">Danh mục Kho</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-sm">
              <Store size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Quản lý Kho hàng</h1>
              <p className="text-sm text-gray-500">Dữ liệu thời gian thực từ cơ sở dữ liệu hệ thống</p>
            </div>
          </div>
          <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-semibold hover:bg-cyan-700 transition shadow-sm cursor-pointer">
            <Plus size={16} /> Thêm kho hàng
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Tìm tên, mã, địa chỉ kho hàng..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500" />
        </div>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500 bg-white cursor-pointer">
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Tạm ngưng</option>
        </select>
        <span className="text-sm text-gray-500 ml-auto">Tổng: <b>{filtered.length}</b> kho hàng</span>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-gray-400 gap-3">
            <Loader2 size={32} className="animate-spin text-cyan-600" />
            <p className="text-sm font-medium">Đang tải dữ liệu từ database...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paged.map(b => (
                <div key={b.id} className={`bg-white rounded-xl border-2 shadow-sm p-5 transition ${b.status === 'active' ? 'border-gray-200 hover:border-cyan-400' : 'border-gray-100 opacity-70'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded-md">{b.code}</span>
                      <button onClick={() => toggleStatus(b)} className="cursor-pointer" title="Bấm để đổi trạng thái">
                        {b.status === 'active'
                          ? <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md text-emerald-700 bg-emerald-50"><ToggleRight size={14} /> Hoạt động</span>
                          : <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md text-gray-500 bg-gray-100"><ToggleLeft size={14} /> Tạm ngưng</span>
                        }
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg hover:bg-cyan-50 text-cyan-600 transition cursor-pointer" title="Sửa"><Pencil size={15} /></button>
                      <button onClick={() => openDelete(b)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition cursor-pointer" title="Xóa"><Trash2 size={15} /></button>
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-800 text-base">{b.name}</h3>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                      <span>{b.address || 'Chưa cập nhật địa chỉ'}</span>
                    </div>
                    {b.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone size={14} className="text-gray-400 flex-shrink-0" />
                        <span>{b.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {paged.length === 0 && (
                <div className="col-span-2 py-16 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
                  Không tìm thấy chi nhánh nào trong cơ sở dữ liệu.
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 cursor-pointer"><ChevronLeft size={16} /></button>
                <span className="text-sm text-gray-500">Trang {page}/{totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 cursor-pointer"><ChevronRight size={16} /></button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {(modal === 'create' || modal === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">{modal === 'create' ? 'Thêm chi nhánh mới' : 'Chỉnh sửa chi nhánh'}</h2>
              <button onClick={closeModal} className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Mã chi nhánh <span className="text-red-500">*</span></label>
                  <input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="VD: KHO-HCM"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500 uppercase font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Trạng thái</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500 bg-white cursor-pointer">
                    <option value="active">Hoạt động</option>
                    <option value="inactive">Tạm ngưng</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tên chi nhánh / Kho <span className="text-red-500">*</span></label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="VD: Kho Tổng Tân Bình"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Địa chỉ</label>
                <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Địa chỉ chi nhánh..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Số điện thoại</label>
                <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="SĐT liên hệ..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={closeModal} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">Hủy</button>
              <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2 bg-cyan-600 text-white text-sm font-semibold rounded-lg hover:bg-cyan-700 shadow-sm cursor-pointer">
                <Save size={15} /> Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'delete' && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4"><Trash2 size={24} className="text-red-500" /></div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Xác nhận xóa</h3>
            <p className="text-sm text-gray-500 mb-6">Bạn có chắc muốn xóa chi nhánh <b className="text-gray-800">"{selected.name}"</b> khỏi cơ sở dữ liệu?</p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={closeModal} className="px-5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">Hủy</button>
              <button onClick={handleDelete} className="px-5 py-2 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-600 cursor-pointer">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
