import React, { useState, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, Search, X, Save, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, Landmark, CreditCard,
} from 'lucide-react';

// ─── TYPES ─────────────────────────────────────────────────────

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  branch: string;
  type: 'bank' | 'wallet' | 'cash';
  balance: number;
  isDefault: boolean;
  note: string;
  createdAt: string;
}

type ModalMode = 'create' | 'edit' | 'delete' | null;

// ─── LOCAL STORAGE ──────────────────────────────────────────────

const STORAGE_KEY = 'smart-wms-bank-accounts-data';

function readBankAccounts(): BankAccount[] {
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

function saveBankAccounts(accounts: BankAccount[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// ─── COMPONENT ─────────────────────────────────────────────────

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  bank: { label: 'Ngân hàng', color: 'text-blue-700', bg: 'bg-blue-50', icon: <Landmark size={12} /> },
  wallet: { label: 'Ví điện tử', color: 'text-violet-700', bg: 'bg-violet-50', icon: <CreditCard size={12} /> },
  cash: { label: 'Tiền mặt', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: <span className="text-xs">💵</span> },
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
const EMPTY_FORM: Omit<BankAccount, 'id' | 'createdAt'> = { bankName: '', accountNumber: '', accountHolder: '', branch: '', type: 'bank', balance: 0, isDefault: false, note: '' };

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>(readBankAccounts);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<BankAccount | null>(null);
  const [form, setForm] = useState<Omit<BankAccount, 'id' | 'createdAt'>>(EMPTY_FORM);
  const [toast, setToast] = useState({ message: '', type: 'success' as 'success' | 'error' });

  const filtered = useMemo(() => {
    return accounts.filter(a => {
      const q = search.toLowerCase();
      const matchQ = !q || a.bankName.toLowerCase().includes(q) || a.accountNumber.includes(q) || a.accountHolder.toLowerCase().includes(q);
      const matchType = !filterType || a.type === filterType;
      return matchQ && matchType;
    });
  }, [accounts, search, filterType]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalBalance = accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);

  function openCreate() { setForm(EMPTY_FORM); setSelected(null); setModal('create'); }
  function openEdit(a: BankAccount) { setSelected(a); setForm({ bankName: a.bankName, accountNumber: a.accountNumber, accountHolder: a.accountHolder, branch: a.branch, type: a.type, balance: a.balance, isDefault: a.isDefault, note: a.note }); setModal('edit'); }
  function openDelete(a: BankAccount) { setSelected(a); setModal('delete'); }
  function closeModal() { setModal(null); setSelected(null); }

  function setDefault(id: string) {
    const updated = accounts.map(a => ({ ...a, isDefault: a.id === id }));
    saveBankAccounts(updated);
    setAccounts(updated);
    setToast({ message: 'Đã đặt làm tài khoản mặc định!', type: 'success' });
  }

  function handleSave() {
    if (!form.bankName.trim()) { setToast({ message: 'Vui lòng nhập tên ngân hàng/ví!', type: 'error' }); return; }
    if (form.type !== 'cash' && !form.accountNumber.trim()) { setToast({ message: 'Vui lòng nhập số tài khoản!', type: 'error' }); return; }
    if (modal === 'create') {
      const newAcc: BankAccount = { ...form, id: generateId(), createdAt: new Date().toISOString().slice(0, 10) };
      let updated = [newAcc, ...accounts];
      if (form.isDefault) updated = updated.map(a => ({ ...a, isDefault: a.id === newAcc.id }));
      saveBankAccounts(updated);
      setAccounts(updated);
      setToast({ message: 'Thêm tài khoản thành công!', type: 'success' });
    } else if (modal === 'edit' && selected) {
      let updated = accounts.map(a => a.id === selected.id ? { ...a, ...form } : a);
      if (form.isDefault) updated = updated.map(a => ({ ...a, isDefault: a.id === selected.id }));
      saveBankAccounts(updated);
      setAccounts(updated);
      setToast({ message: 'Cập nhật thành công!', type: 'success' });
    }
    closeModal();
  }

  function handleDelete() {
    if (!selected) return;
    const updated = accounts.filter(a => a.id !== selected.id);
    saveBankAccounts(updated);
    setAccounts(updated);
    setToast({ message: 'Đã xóa tài khoản!', type: 'success' });
    closeModal();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: '' })} />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <span>Danh mục</span><span>›</span><span className="text-gray-800 font-semibold">Tài khoản Ngân hàng | Ví TM</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm">
              <Landmark size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Tài khoản Ngân hàng | Ví điện tử</h1>
              <p className="text-sm text-gray-500">Quản lý tài khoản thanh toán và ví tiền mặt</p>
            </div>
          </div>
          <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-semibold hover:bg-cyan-700 transition shadow-sm cursor-pointer">
            <Plus size={16} /> Thêm tài khoản
          </button>
        </div>
      </div>

      {/* Total balance */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
        <div className="flex items-center gap-8">
          <div className="text-white">
            <p className="text-xs font-medium opacity-80">Tổng số dư</p>
            <p className="text-2xl font-black">{totalBalance.toLocaleString('vi-VN')} đ</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Tìm tài khoản..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500" />
        </div>
        <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500 bg-white cursor-pointer">
          <option value="">Tất cả loại</option>
          <option value="bank">Ngân hàng</option>
          <option value="wallet">Ví điện tử</option>
          <option value="cash">Tiền mặt</option>
        </select>
      </div>

      {/* Cards */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {paged.map(a => {
            const typeInfo = TYPE_LABELS[a.type] || TYPE_LABELS.bank;
            return (
              <div key={a.id} className={`bg-white rounded-xl border-2 shadow-sm hover:shadow-md transition p-5 ${a.isDefault ? 'border-cyan-400' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1 ${typeInfo.color} ${typeInfo.bg}`}>
                      {typeInfo.icon} {typeInfo.label}
                    </span>
                    {a.isDefault && <span className="text-xs font-bold text-cyan-600 bg-cyan-50 px-2 py-1 rounded-md border border-cyan-200">Mặc định</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg hover:bg-cyan-50 text-cyan-600 transition cursor-pointer"><Pencil size={14} /></button>
                    <button onClick={() => openDelete(a)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition cursor-pointer"><Trash2 size={14} /></button>
                  </div>
                </div>
                <h3 className="font-bold text-gray-800 text-base">{a.bankName}</h3>
                {a.accountNumber && <p className="text-sm font-mono text-gray-600 mt-0.5">{a.accountNumber}</p>}
                <p className="text-sm text-gray-500">{a.accountHolder}</p>
                {a.branch && <p className="text-xs text-gray-400 mt-0.5">{a.branch}</p>}
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400">Số dư</p>
                    <p className="text-lg font-black text-gray-800">{Number(a.balance || 0).toLocaleString('vi-VN')} đ</p>
                  </div>
                  {!a.isDefault && (
                    <button onClick={() => setDefault(a.id)} className="text-xs font-semibold text-cyan-600 hover:text-cyan-700 cursor-pointer underline">Đặt mặc định</button>
                  )}
                </div>
              </div>
            );
          })}
          {paged.length === 0 && (
            <div className="col-span-3 py-16 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
              Chưa có tài khoản ngân hàng hoặc ví nào. Nhấn "Thêm tài khoản" để tạo mới.
            </div>
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 cursor-pointer"><ChevronLeft size={16} /></button>
            <span className="text-sm text-gray-500">Trang {page}/{totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 cursor-pointer"><ChevronRight size={16} /></button>
          </div>
        )}
      </div>

      {/* Modal */}
      {(modal === 'create' || modal === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">{modal === 'create' ? 'Thêm tài khoản' : 'Chỉnh sửa tài khoản'}</h2>
              <button onClick={closeModal} className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Loại <span className="text-red-500">*</span></label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as BankAccount['type'] })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500 bg-white cursor-pointer">
                    <option value="bank">Ngân hàng</option>
                    <option value="wallet">Ví điện tử</option>
                    <option value="cash">Tiền mặt</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{form.type === 'bank' ? 'Tên ngân hàng' : form.type === 'wallet' ? 'Tên ví' : 'Tên quỹ'} <span className="text-red-500">*</span></label>
                  <input type="text" value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} placeholder={form.type === 'bank' ? 'Vietcombank...' : form.type === 'wallet' ? 'MoMo, ZaloPay...' : 'Quỹ tiền mặt...'}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500" />
                </div>
              </div>
              {form.type !== 'cash' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Số tài khoản / Số điện thoại <span className="text-red-500">*</span></label>
                  <input type="text" value={form.accountNumber} onChange={e => setForm({ ...form, accountNumber: e.target.value })} placeholder="Số TK hoặc SĐT đăng ký..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500" />
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tên chủ tài khoản</label>
                <input type="text" value={form.accountHolder} onChange={e => setForm({ ...form, accountHolder: e.target.value })} placeholder="Họ tên hoặc tên công ty..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500" />
              </div>
              {form.type === 'bank' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Chi nhánh</label>
                  <input type="text" value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} placeholder="Chi nhánh ngân hàng..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500" />
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Số dư hiện tại (đ)</label>
                <input type="number" min={0} value={form.balance} onChange={e => setForm({ ...form, balance: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500" />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="isDefault" checked={form.isDefault} onChange={e => setForm({ ...form, isDefault: e.target.checked })} className="rounded cursor-pointer w-4 h-4 accent-cyan-600" />
                <label htmlFor="isDefault" className="text-sm font-semibold text-gray-700 cursor-pointer">Đặt làm tài khoản mặc định</label>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Ghi chú</label>
                <textarea rows={2} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Ghi chú..."
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
            <p className="text-sm text-gray-500 mb-6">Bạn có chắc muốn xóa tài khoản <b>"{selected.bankName} - {selected.accountNumber}"</b>?</p>
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
