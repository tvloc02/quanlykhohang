import React, { useEffect, useState, useCallback } from 'react';
import {
  Link2,
  PlusCircle,
  Search,
  Trash2,
  RefreshCw,
  Package,
  ScanLine,
  X,
  CheckCircle2,
  XCircle,
  QrCode,
  ShieldCheck,
  Tag,
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

export interface BarcodeMappingItem {
  id: string;
  barcode: string;
  product?: {
    id: string;
    internalSku: string;
    name: string;
    unit?: string;
  };
}

export default function BarcodeMappingsPage() {
  const [mappings, setMappings] = useState<BarcodeMappingItem[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [newBarcode, setNewBarcode] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [mappingsRes, productsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/inbound/barcode-mappings`, { headers: authHeaders() }).then((r) => (r.ok ? r.json() : [])),
        fetch(`${API_BASE_URL}/products`, { headers: authHeaders() }).then((r) => (r.ok ? r.json() : [])),
      ]);
      setMappings(mappingsRes || []);
      setProducts(productsRes || []);
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: 'Lỗi tải dữ liệu ánh xạ mã vạch' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBarcode.trim() || !selectedProductId) {
      setToast({ type: 'error', message: 'Vui lòng nhập đầy đủ mã vạch và chọn sản phẩm' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/inbound/barcode-mappings`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          barcode: newBarcode.trim(),
          productId: selectedProductId,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || 'Không thể tạo ánh xạ mã vạch');
      }

      setToast({ type: 'success', message: 'Tạo liên kết mã vạch thành công!' });
      setModalOpen(false);
      setNewBarcode('');
      setSelectedProductId('');
      await fetchData();
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Có lỗi xảy ra khi tạo liên kết' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, barcode: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa liên kết cho mã vạch "${barcode}"?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/inbound/barcode-mappings/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Không thể xóa liên kết');
      setToast({ type: 'success', message: 'Đã xóa liên kết mã vạch thành công!' });
      await fetchData();
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi xóa liên kết' });
    }
  };

  const filtered = mappings.filter((m) => {
    const term = search.toLowerCase();
    return (
      (m.barcode || '').toLowerCase().includes(term) ||
      (m.product?.internalSku || '').toLowerCase().includes(term) ||
      (m.product?.name || '').toLowerCase().includes(term)
    );
  });

  const uniqueProductIds = new Set(mappings.map((m) => m.product?.id).filter(Boolean));

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed right-4 top-4 z-[70] flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-xl ${
            toast.type === 'error' ? 'border-red-200 text-red-600' : 'border-emerald-200 text-emerald-600'
          }`}
        >
          {toast.type === 'error' ? <XCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          <p className="text-sm font-bold">{toast.message}</p>
          <button type="button" onClick={() => setToast(null)} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Top Header Banner */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-md">
            <ScanLine className="h-5 w-5 text-cyan-100" />
            <h1 className="text-lg font-bold tracking-tight text-white">Ánh Xạ Mã Vạch Ngoại Lệ</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchData}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-cyan-50"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className="h-4 w-4 text-cyan-600" />
            Làm mới
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700"
          >
            <PlusCircle className="h-4 w-4" />
            Thêm liên kết mã vạch
          </button>
        </div>
      </div>

      {/* Metric Cards Header */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">{mappings.length} TỔNG MÃ VẠCH</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">{uniqueProductIds.size} SẢN PHẨM KHÁC NHAU</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">SẴN SÀNG QUÉT</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">WMS SYNCED</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
            placeholder="Tìm theo mã vạch phụ, mã SKU nội bộ, tên sản phẩm..."
          />
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse bg-white">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="w-16 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">
                  STT
                </th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">
                  Mã vạch ngoại lệ / Nhà cung cấp
                </th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">
                  Mã SKU Nội Bộ
                </th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">
                  Tên Sản Phẩm Liên Kết System
                </th>
                <th className="sticky right-0 w-28 border-l border-slate-200 bg-white px-3 py-4 text-center text-sm font-black uppercase text-slate-700 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Đang tải danh sách ánh xạ mã vạch...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Không tìm thấy liên kết mã vạch nào.
                  </td>
                </tr>
              ) : (
                filtered.map((m, index) => (
                  <tr key={m.id} className="border-b border-slate-200 transition hover:bg-cyan-50/50">
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">
                      {index + 1}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-bold text-cyan-600 font-mono">
                      <div className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-50 px-3 py-1 border border-cyan-200">
                        <ScanLine className="h-4 w-4 text-cyan-600" />
                        <span>{m.barcode}</span>
                      </div>
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-bold text-slate-800 font-mono">
                      {m.product?.internalSku || '-'}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-left text-sm font-bold text-slate-900">
                      {m.product?.name || <span className="text-slate-400 font-normal italic">Sản phẩm đã bị xóa</span>}
                    </td>
                    <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-4 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                      <div className="flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => handleDelete(m.id, m.barcode)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600 transition hover:bg-red-100 hover:text-red-700"
                          title="Xóa liên kết"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add New Mapping */}
      {modalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700">
                  <Link2 className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Thêm liên kết mã vạch ngoại lệ</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Mã vạch phụ / mã vạch NCC <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <ScanLine className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Nhập hoặc quét mã vạch lạ..."
                    value={newBarcode}
                    onChange={(e) => setNewBarcode(e.target.value)}
                    required
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Chọn sản phẩm hệ thống liên kết <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  required
                  className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                >
                  <option value="">-- Chọn sản phẩm từ danh mục --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.internalSku} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-50"
                >
                  {saving ? 'Đang lưu...' : 'Lưu liên kết'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
