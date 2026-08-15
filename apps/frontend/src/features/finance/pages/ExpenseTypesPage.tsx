import React, { useState, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, Search, X, Save, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, ArrowDownCircle, ArrowUpCircle, DollarSign,
} from 'lucide-react';

// ─── TYPES ─────────────────────────────────────────────────────

interface ExpenseType {
  id: string;
  code: string;
  name: string;
  category: 'income' | 'expense';
  taxable: boolean;
  note: string;
  createdAt: string;
}

type ModalMode = 'create' | 'edit' | 'delete' | null;

// ─── LOCAL STORAGE ──────────────────────────────────────────────

const STORAGE_KEY = 'smart-wms-expense-types-data';

function readExpenseTypes(): ExpenseType[] {
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

function saveExpenseTypes(types: ExpenseType[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(types));
}

function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// ─── COMPONENT ─────────────────────────────────────────────────

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
const EMPTY_FORM: Omit<ExpenseType, 'id' | 'createdAt'> = { code: '', name: '', category: 'income', taxable: false, note: '' };

export default function ExpenseTypesPage() {
  const [types, setTypes] = useState<ExpenseType[]>(readExpenseTypes);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<ExpenseType | null>(null);
  const [form, setForm] = useState<Omit<ExpenseType, 'id' | 'createdAt'>>(EMPTY_FORM);
  const [toast, setToast] = useState({ message: '', type: 'success' as 'success' | 'error' });
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return types.filter(t => {
      const q = search.toLowerCase();
      const matchQ = !q || t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q);
      const matchCat = !filterCat || t.category === filterCat;
      return matchQ && matchCat;
    });
  }, [types, search, filterCat]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openCreate() { setForm(EMPTY_FORM); setSelected(null); setModal('create'); }
  function openEdit(t: ExpenseType) { setSelected(t); setForm({ code: t.code, name: t.name, category: t.category, taxable: t.taxable, note: t.note }); setModal('edit'); }
  function openDelete(t: ExpenseType) { setSelected(t); setModal('delete'); }
  function closeModal() { setModal(null); setSelected(null); }

  function handleSave() {
    if (!form.name.trim()) { setToast({ message: 'Vui lòng nhập tên nội dung thu chi!', type: 'error' }); return; }
    if (modal === 'create') {
      const newType: ExpenseType = { ...form, id: generateId(), code: form.code || `${form.category === 'income' ? 'THU' : 'CHI'}-${Date.now().toString().slice(-4)}`, createdAt: new Date().toISOString().slice(0, 10) };
      const updated = [newType, ...types];
      saveExpenseTypes(updated);
      setTypes(updated);
      setToast({ message: 'Thêm nội dung thu chi thành công!', type: 'success' });
    } else if (modal === 'edit' && selected) {
      const updated = types.map(t => t.id === selected.id ? { ...t, ...form } : t);
      saveExpenseTypes(updated);
      setTypes(updated);
      setToast({ message: 'Cập nhật thành công!', type: 'success' });
    }
    closeModal();
  }

  function handleDelete() {
    if (!selected) return;
    const updated = types.filter(t => t.id !== selected.id);
    saveExpenseTypes(updated);
    setTypes(updated);
    setToast({ message: 'Đã xóa!', type: 'success' });
    closeModal();
  }

  function toggleCheck(id: string) { setCheckedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function toggleAll() { if (checkedIds.size === paged.length) setCheckedIds(new Set()); else setCheckedIds(new Set(paged.map(t => t.id))); }

  const incomeCount = types.filter(t => t.category === 'income').length;
  const expenseCount = types.filter(t => t.category === 'expense').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: '' })} />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <span>Danh mục</span><span>›</span><span className="text-gray-800 font-semibold">Nội dung Thu chi</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-sm">
              <DollarSign size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Nội dung Thu chi</h1>
              <p className="text-sm text-gray-500">Quản lý danh mục lý do thu chi trong kho</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {checkedIds.size > 0 && (
              <button onClick={() => { const u = types.filter(t => !checkedIds.has(t.id)); saveExpenseTypes(u); setTypes(u); setCheckedIds(new Set()); setToast({ message: `Đã xóa ${checkedIds.size} mục!`, type: 'success' }); }}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-semibold hover:bg-red-100 transition cursor-pointer">
                <Trash2 size={15} /> Xóa {checkedIds.size} mục
              </button>
            )}
            <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-semibold hover:bg-cyan-700 transition shadow-sm cursor-pointer">
              <Plus size={16} /> Thêm nội dung
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 py-3 bg-white border-b border-gray-100 flex items-center gap-6">
        <div className="flex items-center gap-2 text-sm">
          <span className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center"><ArrowDownCircle size={14} className="text-emerald-600" /></span>
          <span className="text-gray-600">Khoản thu: <b className="text-emerald-700">{incomeCount}</b></span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center"><ArrowUpCircle size={14} className="text-red-600" /></span>
          <span className="text-gray-600">Khoản chi: <b className="text-red-700">{expenseCount}</b></span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Tìm nội dung thu chi..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10" />
        </div>
        <select value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500 bg-white cursor-pointer">
          <option value="">Tất cả loại</option>
          <option value="income">Khoản thu</option>
          <option value="expense">Khoản chi</option>
        </select>
        <span className="text-sm text-gray-500 ml-auto">Tổng: <b>{filtered.length}</b> mục</span>
      </div>

      {/* Table */}
      <div className="p-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-10 px-4 py-3 text-left"><input type="checkbox" checked={paged.length > 0 && checkedIds.size === paged.length} onChange={toggleAll} className="rounded cursor-pointer" /></th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Mã</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Tên nội dung</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Loại</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Chịu thuế</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Ghi chú</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Ngày tạo</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-gray-400">
                      Chưa có nội dung thu chi nào. Nhấn "Thêm nội dung" để tạo mới.
                    </td>
                  </tr>
                ) : paged.map(t => (
                  <tr key={t.id} className={`hover:bg-gray-50 transition ${checkedIds.has(t.id) ? 'bg-cyan-50' : ''}`}>
                    <td className="px-4 py-3"><input type="checkbox" checked={checkedIds.has(t.id)} onChange={() => toggleCheck(t.id)} className="rounded cursor-pointer" /></td>
                    <td className="px-4 py-3"><span className="font-mono text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded-md">{t.code}</span></td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{t.name}</td>
                    <td className="px-4 py-3">
                      {t.category === 'income'
                        ? <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md text-emerald-700 bg-emerald-50"><ArrowDownCircle size={12} />Khoản thu</span>
                        : <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md text-red-700 bg-red-50"><ArrowUpCircle size={12} />Khoản chi</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-center">
                      {t.taxable
                        ? <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-md">Có</span>
                        : <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-md">Không</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[250px] truncate">{t.note || '-'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{t.createdAt}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-cyan-50 text-cyan-600 transition cursor-pointer" title="Sửa"><Pencil size={15} /></button>
                        <button onClick={() => openDelete(t)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition cursor-pointer" title="Xóa"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
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
              <h2 className="text-lg font-bold text-gray-800">{modal === 'create' ? 'Thêm nội dung thu chi' : 'Chỉnh sửa nội dung'}</h2>
              <button onClick={closeModal} className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Mã nội dung</label>
                  <input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="Tự động nếu để trống"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500 uppercase" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Loại <span className="text-red-500">*</span></label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as ExpenseType['category'] })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500 bg-white cursor-pointer">
                    <option value="income">Khoản thu</option>
                    <option value="expense">Khoản chi</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tên nội dung <span className="text-red-500">*</span></label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nhập tên nội dung..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500" />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="taxable" checked={form.taxable} onChange={e => setForm({ ...form, taxable: e.target.checked })} className="rounded cursor-pointer w-4 h-4 accent-cyan-600" />
                <label htmlFor="taxable" className="text-sm font-semibold text-gray-700 cursor-pointer">Chịu thuế VAT</label>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Ghi chú</label>
                <textarea rows={2} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Mô tả..."
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
            <p className="text-sm text-gray-500 mb-6">Bạn có chắc muốn xóa nội dung <b>"{selected.name}"</b>?</p>
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
