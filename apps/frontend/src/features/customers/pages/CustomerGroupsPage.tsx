import React, { useState, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Save,
  Users,
  CheckCircle,
  XCircle,
  Tag,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { usePermissions } from '../../../shared/hooks/usePermissions';

// ─── TYPES ─────────────────────────────────────────────────────

interface CustomerGroup {
  id: string;
  code: string;
  name: string;
  type: 'customer' | 'supplier' | 'both';
  discount: number;
  debtLimit: number;
  note: string;
  createdAt: string;
}

type ModalMode = 'create' | 'edit' | 'delete' | null;

// ─── LOCAL STORAGE ──────────────────────────────────────────────

const STORAGE_KEY = 'smart-wms-customer-groups-data';

function readGroups(): CustomerGroup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // empty
  }
  return [];
}

function saveGroups(groups: CustomerGroup[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function generateCode(name: string) {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, '-').replace(/-+/g, '-').slice(0, 10) + '-' + Math.floor(Math.random() * 100);
}

// ─── COMPONENT ─────────────────────────────────────────────────

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  customer: { label: 'Khách hàng', color: 'text-blue-700', bg: 'bg-blue-50' },
  supplier: { label: 'Nhà cung cấp', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  both: { label: 'KH & NCC', color: 'text-violet-700', bg: 'bg-violet-50' },
};

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  React.useEffect(() => {
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

const PAGE_SIZE = 15;
const EMPTY_FORM: Omit<CustomerGroup, 'id' | 'createdAt'> = { code: '', name: '', type: 'customer', discount: 0, debtLimit: 0, note: '' };

export default function CustomerGroupsPage() {
  const { canPerformAction } = usePermissions();
  const canCreate = canPerformAction('customer-groups', 'create');
  const canEdit = canPerformAction('customer-groups', 'edit');
  const canDelete = canPerformAction('customer-groups', 'delete');

  const [groups, setGroups] = useState<CustomerGroup[]>(readGroups);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<CustomerGroup | null>(null);
  const [form, setForm] = useState<Omit<CustomerGroup, 'id' | 'createdAt'>>(EMPTY_FORM);
  const [toast, setToast] = useState({ message: '', type: 'success' as 'success' | 'error' });
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return groups.filter(g => {
      const q = search.toLowerCase();
      const matchQ = !q || g.name.toLowerCase().includes(q) || g.code.toLowerCase().includes(q);
      const matchType = !filterType || g.type === filterType;
      return matchQ && matchType;
    });
  }, [groups, search, filterType]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openCreate() {
    setForm(EMPTY_FORM);
    setSelected(null);
    setModal('create');
  }

  function openEdit(g: CustomerGroup) {
    setSelected(g);
    setForm({ code: g.code, name: g.name, type: g.type, discount: g.discount, debtLimit: g.debtLimit, note: g.note });
    setModal('edit');
  }

  function openDelete(g: CustomerGroup) {
    setSelected(g);
    setModal('delete');
  }

  function closeModal() { setModal(null); setSelected(null); }

  function handleSave() {
    if (!form.name.trim()) { setToast({ message: 'Vui lòng nhập tên nhóm!', type: 'error' }); return; }
    if (modal === 'create') {
      const newGroup: CustomerGroup = {
        ...form,
        id: generateId(),
        code: form.code || generateCode(form.name),
        createdAt: new Date().toISOString().slice(0, 10),
      };
      const updated = [newGroup, ...groups];
      saveGroups(updated);
      setGroups(updated);
      setToast({ message: 'Thêm nhóm thành công!', type: 'success' });
    } else if (modal === 'edit' && selected) {
      const updated = groups.map(g => g.id === selected.id ? { ...g, ...form } : g);
      saveGroups(updated);
      setGroups(updated);
      setToast({ message: 'Cập nhật nhóm thành công!', type: 'success' });
    }
    closeModal();
  }

  function handleDelete() {
    if (!selected) return;
    const updated = groups.filter(g => g.id !== selected.id);
    saveGroups(updated);
    setGroups(updated);
    setCheckedIds(prev => { const n = new Set(prev); n.delete(selected.id); return n; });
    setToast({ message: 'Đã xóa nhóm!', type: 'success' });
    closeModal();
  }

  function handleDeleteChecked() {
    const updated = groups.filter(g => !checkedIds.has(g.id));
    saveGroups(updated);
    setGroups(updated);
    setCheckedIds(new Set());
    setToast({ message: `Đã xóa ${checkedIds.size} nhóm!`, type: 'success' });
  }

  function toggleCheck(id: string) {
    setCheckedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleAll() {
    if (checkedIds.size === paged.length) setCheckedIds(new Set());
    else setCheckedIds(new Set(paged.map(g => g.id)));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: '' })} />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <span>Danh mục</span>
          <span>›</span>
          <span className="text-gray-800 font-semibold">Nhóm KH/NCC</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-sm">
              <Users size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Nhóm Khách hàng / Nhà cung cấp</h1>
              <p className="text-sm text-gray-500">Phân loại và quản lý nhóm đối tác</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canDelete && checkedIds.size > 0 && (
              <button onClick={handleDeleteChecked} className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-semibold hover:bg-red-100 transition cursor-pointer">
                <Trash2 size={15} /> Xóa {checkedIds.size} mục
              </button>
            )}
            {canCreate && (
              <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-semibold hover:bg-cyan-700 transition shadow-sm cursor-pointer">
                <Plus size={16} /> Thêm nhóm
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm tên nhóm, mã nhóm..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
          />
        </div>
        <select
          value={filterType}
          onChange={e => { setFilterType(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500 bg-white cursor-pointer"
        >
          <option value="">Tất cả loại</option>
          <option value="customer">Khách hàng</option>
          <option value="supplier">Nhà cung cấp</option>
          <option value="both">KH & NCC</option>
        </select>
        <span className="text-sm text-gray-500 ml-auto">Tổng: <b>{filtered.length}</b> nhóm</span>
      </div>

      {/* Table */}
      <div className="p-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-10 px-4 py-3 text-left">
                    <input type="checkbox" checked={paged.length > 0 && checkedIds.size === paged.length} onChange={toggleAll} className="rounded cursor-pointer" />
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Mã nhóm</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Tên nhóm</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Loại</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Chiết khấu (%)</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Hạn mức nợ</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Ghi chú</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Ngày tạo</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-gray-400">
                      Chưa có dữ liệu nhóm KH/NCC. Nhấn "Thêm nhóm" để tạo mới.
                    </td>
                  </tr>
                ) : paged.map(g => {
                  const typeInfo = TYPE_LABELS[g.type] || TYPE_LABELS.customer;
                  return (
                    <tr key={g.id} className={`hover:bg-gray-50 transition ${checkedIds.has(g.id) ? 'bg-cyan-50' : ''}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={checkedIds.has(g.id)} onChange={() => toggleCheck(g.id)} className="rounded cursor-pointer" />
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 font-mono text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded-md w-fit">
                          <Tag size={11} /> {g.code}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800">{g.name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded-md ${typeInfo.color} ${typeInfo.bg}`}>{typeInfo.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600">{g.discount}%</td>
                      <td className="px-4 py-3 text-right text-gray-700">{Number(g.debtLimit || 0).toLocaleString('vi-VN')} đ</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{g.note || '-'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{g.createdAt}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          {canEdit && (
                            <button onClick={() => openEdit(g)} className="p-1.5 rounded-lg hover:bg-cyan-50 text-cyan-600 hover:text-cyan-700 transition cursor-pointer" title="Sửa">
                              <Pencil size={15} />
                            </button>
                          )}
                          {canDelete && (
                            <button onClick={() => openDelete(g)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 hover:text-red-600 transition cursor-pointer" title="Xóa">
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-500">Trang {page}/{totalPages}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 cursor-pointer transition"><ChevronLeft size={16} /></button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 2).map(n => (
                  <button key={n} onClick={() => setPage(n)} className={`w-8 h-8 rounded-lg text-sm font-semibold transition cursor-pointer ${n === page ? 'bg-cyan-600 text-white' : 'hover:bg-gray-100 text-gray-600'}`}>{n}</button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 cursor-pointer transition"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Thêm/Sửa */}
      {(modal === 'create' || modal === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">{modal === 'create' ? 'Thêm nhóm KH/NCC' : 'Chỉnh sửa nhóm'}</h2>
              <button onClick={closeModal} className="p-2 rounded-lg hover:bg-gray-100 transition cursor-pointer"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Mã nhóm</label>
                  <input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="Tự động tạo nếu để trống"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 uppercase" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Loại nhóm <span className="text-red-500">*</span></label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as CustomerGroup['type'] })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500 bg-white cursor-pointer">
                    <option value="customer">Khách hàng</option>
                    <option value="supplier">Nhà cung cấp</option>
                    <option value="both">KH & NCC</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tên nhóm <span className="text-red-500">*</span></label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nhập tên nhóm..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Chiết khấu (%)</label>
                  <input type="number" min={0} max={100} value={form.discount} onChange={e => setForm({ ...form, discount: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Hạn mức nợ (đ)</label>
                  <input type="number" min={0} value={form.debtLimit} onChange={e => setForm({ ...form, debtLimit: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Ghi chú</label>
                <textarea rows={2} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Mô tả về nhóm..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500 resize-none" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={closeModal} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition cursor-pointer">Hủy</button>
              <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2 bg-cyan-600 text-white text-sm font-semibold rounded-lg hover:bg-cyan-700 transition shadow-sm cursor-pointer">
                <Save size={15} /> Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xóa */}
      {modal === 'delete' && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Xác nhận xóa</h3>
            <p className="text-sm text-gray-500 mb-6">Bạn có chắc muốn xóa nhóm <b className="text-gray-800">"{selected.name}"</b>?</p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={closeModal} className="px-5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition cursor-pointer">Hủy</button>
              <button onClick={handleDelete} className="px-5 py-2 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-600 transition cursor-pointer">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
