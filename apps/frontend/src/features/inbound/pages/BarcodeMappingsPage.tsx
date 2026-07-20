import React, { useEffect, useState, useCallback } from 'react';
import {
  Link2,
  Plus,
  Search,
  Trash2,
  RefreshCw,
  Package,
  ScanLine,
  X,
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [mappingsRes, productsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/inbound/barcode-mappings`, { headers: authHeaders() }).then((r) => r.ok ? r.json() : []),
        fetch(`${API_BASE_URL}/products`, { headers: authHeaders() }).then((r) => r.ok ? r.json() : []),
      ]);
      setMappings(mappingsRes || []);
      setProducts(productsRes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    if (!newBarcode.trim() || !selectedProductId) {
      alert('Vui lòng nhập đầy đủ mã vạch và chọn sản phẩm');
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
      if (!res.ok) throw new Error('Không thể tạo ánh xạ mã vạch');

      alert('Tạo liên kết mã vạch thành công!');
      setModalOpen(false);
      setNewBarcode('');
      setSelectedProductId('');
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Lỗi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, barcode: string) => {
    if (!window.confirm(`Xóa liên kết cho mã vạch "${barcode}"?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/inbound/barcode-mappings/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Lỗi xóa');
      alert('Đã xóa liên kết thành công!');
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Lỗi');
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

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Ánh xạ Mã Vạch Ngoại Lệ</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
            Quản lý các mã vạch phụ/mã lạ từ nhà cung cấp ánh xạ với SKU hệ thống
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={fetchData}
            style={{ padding: '8px 16px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#475569' }}
          >
            <RefreshCw style={{ width: 14, height: 14 }} /> Làm mới
          </button>
          <button
            onClick={() => setModalOpen(true)}
            style={{ padding: '8px 18px', background: '#06b6d4', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus style={{ width: 16, height: 16 }} /> Thêm liên kết
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: 16, position: 'relative', maxWidth: 400 }}>
        <Search style={{ position: 'absolute', left: 12, top: 10, width: 16, height: 16, color: '#94a3b8' }} />
        <input
          type="text"
          placeholder="Tìm mã vạch, SKU, tên sản phẩm..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', height: 36, paddingLeft: 36, paddingRight: 12, borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', background: 'white' }}
        />
      </div>

      {/* Table */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', background: 'white' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: 60 }}>STT</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Mã vạch ngoại lệ</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>SKU Nội bộ</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Tên Sản Phẩm Liên Kết</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: 100 }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Đang tải...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Không tìm thấy liên kết nào.</td>
              </tr>
            ) : (
              filtered.map((m, index) => (
                <tr key={m.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: 13, color: '#94a3b8', fontWeight: 700 }}>{index + 1}</td>
                  <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 800, color: '#06b6d4', fontFamily: 'monospace' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ScanLine style={{ width: 16, height: 16 }} />
                      {m.barcode}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#475569' }}>
                    {m.product?.internalSku || '-'}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                    {m.product?.name || 'Sản phẩm đã bị xóa'}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleDelete(m.id, m.barcode)}
                      style={{ padding: 6, border: 'none', background: '#fef2f2', color: '#dc2626', borderRadius: 8, cursor: 'pointer' }}
                      title="Xóa liên kết"
                    >
                      <Trash2 style={{ width: 16, height: 16 }} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Add New Mapping */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ width: '100%', maxWidth: 460, background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Thêm liên kết mã vạch</h3>
              <button onClick={() => setModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
                  Mã vạch nhà cung cấp / mã lạ <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Nhập mã vạch lạ..."
                  value={newBarcode}
                  onChange={(e) => setNewBarcode(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
                  Chọn sản phẩm hệ thống <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none', background: 'white' }}
                >
                  <option value="">-- Chọn sản phẩm --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.internalSku} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
                <button
                  onClick={() => setModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: 8, background: 'white', border: '1px solid #cbd5e1', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  style={{ padding: '8px 20px', borderRadius: 8, background: '#06b6d4', border: 'none', color: 'white', fontWeight: 700, cursor: 'pointer' }}
                >
                  {saving ? 'Đang lưu...' : 'Lưu liên kết'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
