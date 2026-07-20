import React, { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  RefreshCw,
  Package,
  Check,
  XCircle,
  Building,
  CalendarDays,
  Filter,
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

export default function AdjustmentApprovalPage() {
  const [stocktakes, setStocktakes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'diff' | 'match'>('all');

  const fetchStocktakes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/inventory/stocktakes`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        // Sessions in COUNTING_DONE status waiting for approval
        const pending = data.filter((s: any) => s.status === 'COUNTING_DONE');
        setStocktakes(pending);
        if (pending.length > 0 && !selectedId) {
          setSelectedId(pending[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    fetchStocktakes();
  }, [fetchStocktakes]);

  const handleApprove = async (id: string) => {
    if (!window.confirm('Xác nhận phê duyệt điều chỉnh tồn kho? Tồn kho vật lý sẽ được ghi đè theo số đếm thực tế và kho sẽ tự động mở khóa.')) return;
    setApproving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/inventory/stocktakes/${id}/approve`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || 'Lỗi phê duyệt');
      }
      alert('Phê duyệt điều chỉnh tồn kho thành công! Tồn kho đã cập nhật và kho được mở khóa.');
      setSelectedId(null);
      await fetchStocktakes();
    } catch (err: any) {
      alert(err.message || 'Lỗi');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm('Từ chối phiên kiểm kê này?')) return;
    setApproving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/inventory/stocktakes/${id}/reject`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Lỗi từ chối');
      alert('Đã từ chối phiên kiểm kê.');
      setSelectedId(null);
      await fetchStocktakes();
    } catch (err: any) {
      alert(err.message || 'Lỗi');
    } finally {
      setApproving(false);
    }
  };

  const selected = stocktakes.find((s) => s.id === selectedId) || null;
  const filteredStocktakes = stocktakes.filter((s) => {
    const term = search.toLowerCase();
    return (s.stocktakeNo || '').toLowerCase().includes(term) || (s.locationCode || '').toLowerCase().includes(term);
  });

  const details = selected?.details || [];
  const filteredDetails = details.filter((d: any) => {
    const diff = (d.countedQty ?? d.systemQty) - d.systemQty;
    if (filterType === 'diff') return diff !== 0;
    if (filterType === 'match') return diff === 0;
    return true;
  });

  return (
    <div style={{ display: 'flex', height: '100%', gap: 24, padding: 24, background: '#f8fafc', overflow: 'hidden' }}>
      {/* Left Panel — Pending Sessions */}
      <div style={{ width: 380, flexShrink: 0, background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: 16, borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Kiểm kê chờ duyệt</h2>
            <button onClick={fetchStocktakes} style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', borderRadius: 8 }}>
              <RefreshCw style={{ width: 16, height: 16 }} />
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: 12, top: 10, width: 16, height: 16, color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Tìm mã phiên, vị trí kho..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', height: 36, paddingLeft: 36, paddingRight: 12, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Đang tải...</div>
          ) : filteredStocktakes.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Không có phiên kiểm kê nào chờ duyệt.</div>
          ) : (
            filteredStocktakes.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: 12,
                  borderRadius: 12,
                  border: s.id === selectedId ? '2px solid #06b6d4' : '1px solid transparent',
                  background: s.id === selectedId ? 'rgba(6,182,212,0.04)' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>{s.stocktakeNo}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                    Chờ duyệt
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                  <span>Kho: <strong>{s.locationCode}</strong></span>
                  <span>{s.totalItems || s.details?.length || 0} sản phẩm</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Panel — Reconciliation & Approval */}
      <div style={{ flex: 1, background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selected ? (
          <>
            {/* Header */}
            <div style={{ padding: 24, borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ padding: 12, background: '#ecfeff', borderRadius: 14, color: '#06b6d4' }}>
                  <FileText style={{ width: 24, height: 24 }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{selected.stocktakeNo}</h3>
                  <div style={{ marginTop: 4, display: 'flex', gap: 16, fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Building style={{ width: 14, height: 14 }} /> Kho: {selected.locationCode}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CalendarDays style={{ width: 14, height: 14 }} /> Ngày tạo: {formatDate(selected.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => handleReject(selected.id)}
                  disabled={approving}
                  style={{ padding: '10px 16px', border: '2px solid #fca5a5', background: 'white', color: '#dc2626', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <XCircle style={{ width: 16, height: 16 }} /> Từ chối
                </button>
                <button
                  onClick={() => handleApprove(selected.id)}
                  disabled={approving}
                  style={{ padding: '10px 20px', background: '#059669', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 12px rgba(5,150,105,0.3)' }}
                >
                  <Check style={{ width: 16, height: 16 }} /> Phê duyệt & Điều chỉnh tồn
                </button>
              </div>
            </div>

            {/* Sub-header Filter */}
            <div style={{ padding: '12px 24px', borderBottom: '1px solid #e2e8f0', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Filter style={{ width: 16, height: 16, color: '#64748b' }} />
                <button
                  onClick={() => setFilterType('all')}
                  style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: filterType === 'all' ? '#06b6d4' : '#f1f5f9', color: filterType === 'all' ? 'white' : '#475569', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                >
                  Tất cả ({details.length})
                </button>
                <button
                  onClick={() => setFilterType('diff')}
                  style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: filterType === 'diff' ? '#dc2626' : '#f1f5f9', color: filterType === 'diff' ? 'white' : '#475569', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                >
                  Có chênh lệch ({details.filter((d: any) => ((d.countedQty ?? d.systemQty) - d.systemQty) !== 0).length})
                </button>
                <button
                  onClick={() => setFilterType('match')}
                  style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: filterType === 'match' ? '#059669' : '#f1f5f9', color: filterType === 'match' ? 'white' : '#475569', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                >
                  Khớp (0)
                </button>
              </div>
            </div>

            {/* Discrepancy Table */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                  <thead style={{ background: '#f8fafc' }}>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: 50 }}>STT</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>SKU</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Sản phẩm</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Tồn hệ thống</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Đếm thực tế</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Chênh lệch (±)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDetails.map((d: any, i: number) => {
                      const counted = d.countedQty ?? d.systemQty;
                      const diff = counted - d.systemQty;
                      return (
                        <tr key={d.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: 13, color: '#94a3b8', fontWeight: 700 }}>{i + 1}</td>
                          <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#475569' }}>{d.product?.internalSku}</td>
                          <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{d.product?.name}</td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#475569' }}>{d.systemQty}</td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{counted}</td>
                          <td style={{
                            padding: '14px 16px',
                            textAlign: 'right',
                            fontSize: 14,
                            fontWeight: 800,
                            color: diff === 0 ? '#059669' : diff < 0 ? '#dc2626' : '#0284c7',
                          }}>
                            {diff === 0 ? 'Khớp (0)' : diff > 0 ? `+${diff}` : diff}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            <CheckCircle2 style={{ width: 64, height: 64, color: '#e2e8f0', marginBottom: 16 }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#475569', margin: 0 }}>Không có phiên kiểm kê nào cần duyệt</h3>
            <p style={{ fontSize: 13, marginTop: 4 }}>Tất cả phiên kiểm kê đã hoàn tất được xử lý.</p>
          </div>
        )}
      </div>
    </div>
  );
}
