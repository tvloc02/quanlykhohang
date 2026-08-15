import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus, Pencil, Trash2, Search, X, Save, CheckCircle, XCircle,
  Printer, Download, Upload, FileSpreadsheet, FileText, CheckSquare,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter, MapPin,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { usePermissions } from '../../../shared/hooks/usePermissions';

// ─── TYPES ─────────────────────────────────────────────────────

interface AreaItem {
  id: string;
  code: string;
  name: string;
  status: 'active' | 'inactive'; // 'Đang sử dụng' | 'Không sử dụng'
  note?: string;
  createdAt?: string;
}

type ModalMode = 'create' | 'edit' | 'delete' | null;

// ─── LOCAL STORAGE ──────────────────────────────────────────────

const STORAGE_KEY = 'smart-wms-areas-data';

function readAreas(): AreaItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function saveAreas(areas: AreaItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(areas));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── TOAST NOTIFICATION ────────────────────────────────────────

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
const EMPTY_FORM: Omit<AreaItem, 'id'> = { code: '', name: '', status: 'active', note: '' };

export default function AreasPage() {
  const { canPerformAction } = usePermissions();
  const canCreate = canPerformAction('areas', 'create');
  const canEdit = canPerformAction('areas', 'edit');
  const canDelete = canPerformAction('areas', 'delete');

  const [areas, setAreas] = useState<AreaItem[]>(readAreas);
  const [searchCode, setSearchCode] = useState('');
  const [searchName, setSearchName] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalMode>(null);
  const [selectedItem, setSelectedItem] = useState<AreaItem | null>(null);
  const [form, setForm] = useState<Omit<AreaItem, 'id'>>(EMPTY_FORM);
  const [toast, setToast] = useState({ message: '', type: 'success' as 'success' | 'error' });
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return areas.filter(a => {
      const matchCode = !searchCode || a.code.toLowerCase().includes(searchCode.toLowerCase());
      const matchName = !searchName || a.name.toLowerCase().includes(searchName.toLowerCase());
      const matchStatus = !filterStatus || (filterStatus === 'active' ? a.status === 'active' : a.status === 'inactive');
      return matchCode && matchName && matchStatus;
    });
  }, [areas, searchCode, searchName, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openCreate() { setForm(EMPTY_FORM); setSelectedItem(null); setModal('create'); }
  function openEdit(item: AreaItem) { setSelectedItem(item); setForm({ code: item.code, name: item.name, status: item.status, note: item.note }); setModal('edit'); }
  function openDelete(item: AreaItem) { setSelectedItem(item); setModal('delete'); }
  function closeModal() { setModal(null); setSelectedItem(null); }

  function handleSave() {
    if (!form.name.trim()) { setToast({ message: 'Vui lòng nhập tên khu vực!', type: 'error' }); return; }
    if (modal === 'create') {
      const newItem: AreaItem = { ...form, id: generateId(), createdAt: new Date().toISOString().slice(0, 10) };
      const updated = [newItem, ...areas];
      saveAreas(updated);
      setAreas(updated);
      setToast({ message: 'Thêm khu vực thành công!', type: 'success' });
    } else if (modal === 'edit' && selectedItem) {
      const updated = areas.map(a => a.id === selectedItem.id ? { ...a, ...form } : a);
      saveAreas(updated);
      setAreas(updated);
      setToast({ message: 'Cập nhật khu vực thành công!', type: 'success' });
    }
    closeModal();
  }

  function handleDelete() {
    if (!selectedItem) return;
    const updated = areas.filter(a => a.id !== selectedItem.id);
    saveAreas(updated);
    setAreas(updated);
    setCheckedIds(prev => { const n = new Set(prev); n.delete(selectedItem.id); return n; });
    setToast({ message: 'Đã xóa khu vực!', type: 'success' });
    closeModal();
  }

  function handleDeleteChecked() {
    if (checkedIds.size === 0) return;
    const updated = areas.filter(a => !checkedIds.has(a.id));
    saveAreas(updated);
    setAreas(updated);
    setCheckedIds(new Set());
    setToast({ message: `Đã xóa ${checkedIds.size} khu vực đã chọn!`, type: 'success' });
  }

  function toggleBulkStatus() {
    if (checkedIds.size === 0) {
      setToast({ message: 'Vui lòng chọn ít nhất 1 khu vực để đổi trạng thái!', type: 'error' });
      return;
    }
    const updated = areas.map(a => {
      if (checkedIds.has(a.id)) {
        return { ...a, status: a.status === 'active' ? 'inactive' as const : 'active' as const };
      }
      return a;
    });
    saveAreas(updated);
    setAreas(updated);
    setToast({ message: `Đã đổi trạng thái ${checkedIds.size} khu vực!`, type: 'success' });
  }

  function toggleCheck(id: string) { setCheckedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function toggleAll() { if (checkedIds.size === paged.length) setCheckedIds(new Set()); else setCheckedIds(new Set(paged.map(a => a.id))); }

  function exportExcel() {
    const exportData = filtered.map((a, idx) => ({
      'STT': idx + 1,
      'Mã': a.code,
      'Tên': a.name,
      'Trạng thái': a.status === 'active' ? 'Đang sử dụng' : 'Không sử dụng',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Khu Vuc');
    XLSX.writeFile(wb, 'Danh_Sach_Khu_Vuc.xlsx');
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: '' })} />

      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <MapPin size={22} className="text-emerald-600" />
          <h1 className="text-xl font-black text-slate-800 tracking-tight uppercase">KHU VỰC</h1>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <span>Home</span><span>›</span><span className="font-semibold text-slate-700">Area</span>
        </div>
      </div>

      {/* Toolbar Buttons matching RIC.VN exactly */}
      <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#10b981] hover:bg-[#059669] text-white rounded text-sm font-bold shadow-sm transition cursor-pointer"
            >
              <Plus size={16} /> Thêm
            </button>
          )}

          {canDelete && (
            <button
              onClick={handleDeleteChecked}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#ef4444] hover:bg-[#dc2626] text-white rounded text-sm font-bold shadow-sm transition cursor-pointer"
            >
              <X size={16} /> Xóa
            </button>
          )}

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#d946ef] hover:bg-[#c026d3] text-white rounded text-sm font-bold shadow-sm transition cursor-pointer"
          >
            <Printer size={16} /> Print
          </button>

          <button
            onClick={exportExcel}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#f97316] hover:bg-[#ea580c] text-white rounded text-sm font-bold shadow-sm transition cursor-pointer"
          >
            <Upload size={16} /> Import
          </button>

          <button
            onClick={exportExcel}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0284c7] hover:bg-[#0369a1] text-white rounded text-sm font-bold shadow-sm transition cursor-pointer"
          >
            <FileSpreadsheet size={16} /> Excel
          </button>

          <button
            onClick={exportExcel}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#06b6d4] hover:bg-[#0891b2] text-white rounded text-sm font-bold shadow-sm transition cursor-pointer"
          >
            <FileText size={16} /> PDF
          </button>

          {canEdit && (
            <button
              onClick={toggleBulkStatus}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded text-sm font-bold shadow-sm transition cursor-pointer"
            >
              <CheckSquare size={16} /> Sử dụng/Không sử dụng
            </button>
          )}
        </div>
      </div>

      {/* Drag Column Bar Notice */}
      <div className="px-6 py-2 bg-slate-200/70 border-b border-slate-300 text-xs text-slate-600 font-medium italic">
        Drag a column header and drop it here to group by that column
      </div>

      {/* Main Table Content */}
      <div className="p-4">
        <div className="bg-white rounded border border-slate-300 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-700">
                  <th className="w-12 px-3 py-2.5 text-center border-r border-slate-200">No.</th>
                  <th className="w-10 px-3 py-2.5 text-center border-r border-slate-200">
                    <input type="checkbox" checked={paged.length > 0 && checkedIds.size === paged.length} onChange={toggleAll} className="rounded cursor-pointer" />
                  </th>
                  <th className="w-12 px-3 py-2.5 text-center border-r border-slate-200">Sửa</th>
                  <th className="px-3 py-2.5 border-r border-slate-200">
                    <div className="flex items-center justify-between">
                      <span>Mã</span>
                      <Filter size={12} className="text-slate-400" />
                    </div>
                  </th>
                  <th className="px-3 py-2.5 border-r border-slate-200">
                    <div className="flex items-center justify-between">
                      <span>Tên</span>
                      <Filter size={12} className="text-slate-400" />
                    </div>
                  </th>
                  <th className="px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span>Trạng thái</span>
                      <Filter size={12} className="text-slate-400" />
                    </div>
                  </th>
                </tr>
                {/* Column Filter Inputs */}
                <tr className="bg-slate-50 border-b border-slate-300">
                  <td className="border-r border-slate-200"></td>
                  <td className="border-r border-slate-200"></td>
                  <td className="border-r border-slate-200"></td>
                  <td className="px-2 py-1 border-r border-slate-200">
                    <input
                      type="text"
                      placeholder="Lọc mã..."
                      value={searchCode}
                      onChange={e => { setSearchCode(e.target.value); setPage(1); }}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:border-emerald-500 bg-white"
                    />
                  </td>
                  <td className="px-2 py-1 border-r border-slate-200">
                    <input
                      type="text"
                      placeholder="Lọc tên..."
                      value={searchName}
                      onChange={e => { setSearchName(e.target.value); setPage(1); }}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:border-emerald-500 bg-white"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <select
                      value={filterStatus}
                      onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:border-emerald-500 bg-white cursor-pointer"
                    >
                      <option value="">Tất cả</option>
                      <option value="active">Đang sử dụng</option>
                      <option value="inactive">Không sử dụng</option>
                    </select>
                  </td>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 italic">
                      Không tìm thấy dữ liệu khu vực.
                    </td>
                  </tr>
                ) : (
                  paged.map((item, idx) => {
                    const rowNumber = (page - 1) * PAGE_SIZE + idx + 1;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition border-b border-slate-200">
                        <td className="px-3 py-2 text-center text-slate-600 border-r border-slate-200 font-medium">{rowNumber}</td>
                        <td className="px-3 py-2 text-center border-r border-slate-200">
                          <input
                            type="checkbox"
                            checked={checkedIds.has(item.id)}
                            onChange={() => toggleCheck(item.id)}
                            className="rounded cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2 text-center border-r border-slate-200">
                          {canEdit && (
                            <button
                              onClick={() => openEdit(item)}
                              className="p-1 rounded bg-[#10b981] hover:bg-[#059669] text-white transition cursor-pointer inline-flex items-center justify-center shadow-xs"
                              title="Sửa khu vực"
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2 border-r border-slate-200 font-mono text-slate-700 font-semibold">{item.code || ''}</td>
                        <td className="px-3 py-2 border-r border-slate-200 font-bold text-slate-800">{item.name}</td>
                        <td className="px-3 py-2">
                          {item.status === 'active' ? (
                            <span className="font-bold text-emerald-700">Đang sử dụng</span>
                          ) : (
                            <span className="font-bold text-red-600">Không sử dụng</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Pagination matching RIC.VN */}
          <div className="px-4 py-2.5 bg-slate-100 border-t border-slate-300 flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(1)} disabled={page === 1} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 cursor-pointer"><ChevronsLeft size={14} /></button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 cursor-pointer"><ChevronLeft size={14} /></button>
              <span className="w-6 h-6 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center text-xs">{page}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 cursor-pointer"><ChevronRight size={14} /></button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 cursor-pointer"><ChevronsRight size={14} /></button>
            </div>
            <div className="font-medium text-slate-500">
              {filtered.length === 0 ? '0 of 0 items' : `${(page - 1) * PAGE_SIZE + 1} - ${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} items`}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Thêm/Sửa Khu vực */}
      {(modal === 'create' || modal === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-emerald-600 text-white">
              <h2 className="text-sm font-bold uppercase">{modal === 'create' ? 'Thêm khu vực mới' : 'Chỉnh sửa khu vực'}</h2>
              <button onClick={closeModal} className="p-1 rounded hover:bg-emerald-700 cursor-pointer"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mã khu vực</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value })}
                  placeholder="VD: 024, KV_1, 08..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên khu vực <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="VD: HÀ NỘI1, KV MIỀN BẮC..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:outline-none focus:border-emerald-500 font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Trạng thái</label>
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value as AreaItem['status'] })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:outline-none focus:border-emerald-500 bg-white cursor-pointer"
                >
                  <option value="active">Đang sử dụng</option>
                  <option value="inactive">Không sử dụng</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
              <button onClick={closeModal} className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded cursor-pointer">Hủy</button>
              <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow-xs cursor-pointer">
                <Save size={14} /> Lưu lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xóa */}
      {modal === 'delete' && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3"><Trash2 size={22} className="text-red-500" /></div>
            <h3 className="text-base font-bold text-slate-800 mb-1">Xác nhận xóa khu vực</h3>
            <p className="text-xs text-slate-500 mb-5">Bạn có chắc muốn xóa khu vực <b className="text-slate-800">"{selectedItem.name}"</b>?</p>
            <div className="flex items-center justify-center gap-2">
              <button onClick={closeModal} className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded cursor-pointer">Hủy</button>
              <button onClick={handleDelete} className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded cursor-pointer">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
