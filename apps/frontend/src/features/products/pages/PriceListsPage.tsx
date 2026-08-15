import React, { useState, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, Search, X, Save, Tag, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, Calendar, ToggleLeft, ToggleRight,
} from 'lucide-react';

// ─── TYPES ─────────────────────────────────────────────────────

interface PriceList {
  id: string;
  code: string;
  name: string;
  type: 'sale' | 'purchase' | 'wholesale';
  applyFrom: string;
  applyTo: string;
  status: 'active' | 'inactive';
  note: string;
  createdAt: string;
  itemCount: number;
}

type ModalMode = 'create' | 'edit' | 'delete' | null;

// ─── LOCAL STORAGE ──────────────────────────────────────────────

const STORAGE_KEY = 'smart-wms-price-lists-data';

function readPriceLists(): PriceList[] {
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

function savePriceLists(lists: PriceList[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── COMPONENT ─────────────────────────────────────────────────

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  sale: { label: 'Giá bán lẻ', color: 'text-blue-700', bg: 'bg-blue-50' },
  wholesale: { label: 'Giá bán sỉ', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  purchase: { label: 'Giá nhập', color: 'text-orange-700', bg: 'bg-orange-50' },
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
const EMPTY_FORM: Omit<PriceList, 'id' | 'createdAt' | 'itemCount'> = {
  code: '', name: '', type: 'sale', applyFrom: new Date().toISOString().slice(0, 10),
  applyTo: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10), status: 'active', note: '',
};

export default function PriceListsPage() {
  const [lists, setLists] = useState<PriceList[]>(readPriceLists);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<PriceList | null>(null);
  const [form, setForm] = useState<Omit<PriceList, 'id' | 'createdAt' | 'itemCount'>>(EMPTY_FORM);
  const [toast, setToast] = useState({ message: '', type: 'success' as 'success' | 'error' });
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return lists.filter(l => {
      const q = search.toLowerCase();
      const matchQ = !q || l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q);
      const matchType = !filterType || l.type === filterType;
      const matchStatus = !filterStatus || l.status === filterStatus;
      return matchQ && matchType && matchStatus;
    });
  }, [lists, search, filterType, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openCreate() { setForm(EMPTY_FORM); setSelected(null); setModal('create'); }
  function openEdit(l: PriceList) {
    setSelected(l);
    setForm({ code: l.code, name: l.name, type: l.type, applyFrom: l.applyFrom, applyTo: l.applyTo, status: l.status, note: l.note });
    setModal('edit');
  }
  function openDelete(l: PriceList) { setSelected(l); setModal('delete'); }
  function closeModal() { setModal(null); setSelected(null); }

  function handleSave() {
    if (!form.name.trim()) { setToast({ message: 'Vui lòng nhập tên bảng giá!', type: 'error' }); return; }
    if (modal === 'create') {
      const newList: PriceList = { ...form, id: generateId(), code: form.code || `BG-${Date.now().toString().slice(-4)}`, createdAt: new Date().toISOString().slice(0, 10), itemCount: 0 };
      const updated = [newList, ...lists];
      savePriceLists(updated);
      setLists(updated);
      setToast({ message: 'Thêm bảng giá thành công!', type: 'success' });
    } else if (modal === 'edit' && selected) {
      const updated = lists.map(l => l.id === selected.id ? { ...l, ...form } : l);
      savePriceLists(updated);
      setLists(updated);
      setToast({ message: 'Cập nhật bảng giá thành công!', type: 'success' });
    }
    closeModal();
  }

  function handleDelete() {
    if (!selected) return;
    const updated = lists.filter(l => l.id !== selected.id);
    savePriceLists(updated);
    setLists(updated);
    setToast({ message: 'Đã xóa bảng giá!', type: 'success' });
    closeModal();
  }

  function toggleStatus(l: PriceList) {
    const updated = lists.map(item => item.id === l.id ? { ...item, status: item.status === 'active' ? 'inactive' as const : 'active' as const } : item);
    savePriceLists(updated);
    setLists(updated);
    setToast({ message: `Bảng giá "${l.name}" đã ${l.status === 'active' ? 'tắt' : 'bật'}!`, type: 'success' });
  }

  function toggleCheck(id: string) { setCheckedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function toggleAll() { if (checkedIds.size === paged.length) setCheckedIds(new Set()); else setCheckedIds(new Set(paged.map(l => l.id))); }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: '' })} />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <span>Danh mục</span><span>›</span><span className="text-gray-800 font-semibold">Bảng giá</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-sm">
              <Tag size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Bảng giá</h1>
              <p className="text-sm text-gray-500">Quản lý các bảng giá áp dụng cho hàng hóa</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {checkedIds.size > 0 && (
              <button onClick={() => { const u = lists.filter(l => !checkedIds.has(l.id)); savePriceLists(u); setLists(u); setCheckedIds(new Set()); setToast({ message: `Đã xóa ${checkedIds.size} bảng giá!`, type: 'success' }); }}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-semibold hover:bg-red-100 transition cursor-pointer">
                <Trash2 size={15} /> Xóa {checkedIds.size} mục
              </button>
            )}
            <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-semibold hover:bg-cyan-700 transition shadow-sm cursor-pointer">
              <Plus size={16} /> Thêm bảng giá
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Tìm bảng giá..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10" />
        </div>
        <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500 bg-white cursor-pointer">
          <option value="">Tất cả loại</option>
          <option value="sale">Giá bán lẻ</option>
          <option value="wholesale">Giá bán sỉ</option>
          <option value="purchase">Giá nhập</option>
        </select>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500 bg-white cursor-pointer">
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang áp dụng</option>
          <option value="inactive">Không áp dụng</option>
        </select>
        <span className="text-sm text-gray-500 ml-auto">Tổng: <b>{filtered.length}</b> bảng giá</span>
      </div>

      {/* Table */}
      <div className="p-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-10 px-4 py-3 text-left"><input type="checkbox" checked={paged.length > 0 && checkedIds.size === paged.length} onChange={toggleAll} className="rounded cursor-pointer" /></th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Mã bảng giá</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Tên bảng giá</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Loại</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Số SP</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600"><Calendar size={13} className="inline mr-1" />Áp dụng từ</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600"><Calendar size={13} className="inline mr-1" />Đến ngày</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Trạng thái</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-gray-400">
                      Chưa có bảng giá nào. Nhấn "Thêm bảng giá" để tạo mới.
                    </td>
                  </tr>
                ) : paged.map(l => {
                  const typeInfo = TYPE_LABELS[l.type] || TYPE_LABELS.sale;
                  return (
                    <tr key={l.id} className={`hover:bg-gray-50 transition ${checkedIds.has(l.id) ? 'bg-cyan-50' : ''}`}>
                      <td className="px-4 py-3"><input type="checkbox" checked={checkedIds.has(l.id)} onChange={() => toggleCheck(l.id)} className="rounded cursor-pointer" /></td>
                      <td className="px-4 py-3"><span className="font-mono text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded-md">{l.code}</span></td>
                      <td className="px-4 py-3 font-semibold text-gray-800">{l.name}</td>
                      <td className="px-4 py-3"><span className={`text-xs font-bold px-2 py-1 rounded-md ${typeInfo.color} ${typeInfo.bg}`}>{typeInfo.label}</span></td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-700">{l.itemCount || 0}</td>
                      <td className="px-4 py-3 text-gray-600">{l.applyFrom}</td>
                      <td className="px-4 py-3 text-gray-600">{l.applyTo}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => toggleStatus(l)} className="cursor-pointer" title={l.status === 'active' ? 'Đang áp dụng - Click để tắt' : 'Không áp dụng - Click để bật'}>
                          {l.status === 'active'
                            ? <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md text-emerald-700 bg-emerald-50"><ToggleRight size={14} /> Áp dụng</span>
                            : <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md text-gray-500 bg-gray-100"><ToggleLeft size={14} /> Tắt</span>
                          }
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => openEdit(l)} className="p-1.5 rounded-lg hover:bg-cyan-50 text-cyan-600 transition cursor-pointer" title="Sửa"><Pencil size={15} /></button>
                          <button onClick={() => openDelete(l)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition cursor-pointer" title="Xóa"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-500">Trang {page}/{totalPages}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 cursor-pointer"><ChevronLeft size={16} /></button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 cursor-pointer"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {(modal === 'create' || modal === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">{modal === 'create' ? 'Thêm bảng giá' : 'Chỉnh sửa bảng giá'}</h2>
              <button onClick={closeModal} className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Mã bảng giá</label>
                  <input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="Tự động tạo nếu để trống"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500 uppercase" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Loại bảng giá</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as PriceList['type'] })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500 bg-white cursor-pointer">
                    <option value="sale">Giá bán lẻ</option>
                    <option value="wholesale">Giá bán sỉ</option>
                    <option value="purchase">Giá nhập hàng</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tên bảng giá <span className="text-red-500">*</span></label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nhập tên bảng giá..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Áp dụng từ</label>
                  <input type="date" value={form.applyFrom} onChange={e => setForm({ ...form, applyFrom: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Đến ngày</label>
                  <input type="date" value={form.applyTo} onChange={e => setForm({ ...form, applyTo: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Trạng thái</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as PriceList['status'] })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500 bg-white cursor-pointer">
                  <option value="active">Đang áp dụng</option>
                  <option value="inactive">Không áp dụng</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Ghi chú</label>
                <textarea rows={2} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Mô tả bảng giá..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500 resize-none" />
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
            <p className="text-sm text-gray-500 mb-6">Bạn có chắc muốn xóa bảng giá <b className="text-gray-800">"{selected.name}"</b>?</p>
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
