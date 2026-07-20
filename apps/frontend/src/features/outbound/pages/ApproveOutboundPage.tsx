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
} from 'lucide-react';
import { outboundApi, type OutboundOrder } from '../api/outboundApi';

function statusLabel(status?: string) {
  switch (status) {
    case 'pending': return 'Chờ xử lý';
    case 'picking': return 'Đang lấy hàng';
    case 'READY_TO_SHIP': return 'Sẵn sàng xuất';
    case 'shipped': return 'Đã xuất kho';
    default: return status || 'Chờ xử lý';
  }
}

function statusColor(status?: string) {
  switch (status) {
    case 'pending': return { bg: '#fffbeb', color: '#92400e', border: '#fde68a' };
    case 'picking': return { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' };
    case 'READY_TO_SHIP': return { bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' };
    case 'shipped': return { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' };
    default: return { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' };
  }
}

const formatMoney = (amount: number | string) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(amount));
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

export default function ApproveOutboundPage() {
  const [orders, setOrders] = useState<OutboundOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await outboundApi.listOrders();
      // Lọc đơn chưa xuất (chờ duyệt)
      const pending = data.filter((o) => o.status !== 'shipped');
      setOrders(pending);
      if (pending.length > 0 && !selectedId) {
        setSelectedId(pending[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleApprove = async (orderId: string) => {
    if (!window.confirm('Bạn có chắc chắn phê duyệt đơn xuất kho này? Tồn kho vật lý sẽ bị trừ chính thức.')) return;
    setApproving(true);
    try {
      await outboundApi.confirmOrder(orderId);
      alert('Phê duyệt đơn xuất kho và trừ tồn kho thành công!');
      setSelectedId(null);
      await fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Lỗi phê duyệt');
    } finally {
      setApproving(false);
    }
  };

  const handleCancel = async (orderId: string) => {
    if (!window.confirm('Bạn có chắc chắn hủy đơn xuất kho này? Tồn kho đã giữ chỗ sẽ được giải phóng.')) return;
    setApproving(true);
    try {
      await outboundApi.deleteOrder(orderId);
      alert('Đã hủy đơn xuất kho và giải phóng tồn kho thành công!');
      setSelectedId(null);
      await fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Lỗi hủy đơn');
    } finally {
      setApproving(false);
    }
  };

  const selected = orders.find((o) => o.id === selectedId) || null;
  const filtered = orders.filter((o) => {
    const term = search.toLowerCase();
    return (o.orderNo || '').toLowerCase().includes(term) || (o.customer || '').toLowerCase().includes(term);
  });

  return (
    <div style={{ display: 'flex', height: '100%', gap: 24, padding: 24, background: '#f8fafc', overflow: 'hidden' }}>
      {/* Left Panel */}
      <div style={{ width: 380, flexShrink: 0, background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: 16, borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Đơn chờ duyệt xuất</h2>
            <button onClick={fetchOrders} style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', borderRadius: 8 }}>
              <RefreshCw style={{ width: 16, height: 16 }} />
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: 12, top: 10, width: 16, height: 16, color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Tìm mã đơn, khách hàng..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', height: 36, paddingLeft: 36, paddingRight: 12, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Đang tải...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Không có đơn nào.</div>
          ) : (
            filtered.map((o) => {
              const sc = statusColor(o.status);
              return (
                <button
                  key={o.id}
                  onClick={() => setSelectedId(o.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: 12,
                    borderRadius: 12,
                    border: o.id === selectedId ? '2px solid #06b6d4' : '1px solid transparent',
                    background: o.id === selectedId ? 'rgba(6,182,212,0.04)' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{o.orderNo}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                      {statusLabel(o.status)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                    <span style={{ fontWeight: 600, color: '#334155' }}>{o.customer || 'Khách lẻ'}</span>
                    <span>{o.items} sản phẩm</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div style={{ flex: 1, background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selected ? (
          <>
            {/* Header */}
            <div style={{ padding: 24, borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ padding: 12, background: '#ecfeff', borderRadius: 14, color: '#06b6d4' }}>
                  <FileText style={{ width: 24, height: 24 }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{selected.orderNo}</h3>
                  <div style={{ marginTop: 4, display: 'flex', gap: 16, fontSize: 13, color: '#64748b', fontWeight: 600, flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Building style={{ width: 14, height: 14 }} />
                      {selected.customer || 'Khách lẻ'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CalendarDays style={{ width: 14, height: 14 }} />
                      Ngày giao: {formatDate(selected.dueDate)}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => handleCancel(selected.id)}
                  disabled={approving}
                  style={{ padding: '10px 16px', border: '2px solid #fca5a5', background: 'white', color: '#dc2626', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <XCircle style={{ width: 16, height: 16 }} /> Hủy đơn
                </button>
                <button
                  onClick={() => handleApprove(selected.id)}
                  disabled={approving}
                  style={{ padding: '10px 20px', background: '#059669', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 12px rgba(5,150,105,0.3)' }}
                >
                  <Check style={{ width: 16, height: 16 }} /> Phê duyệt & Xuất kho
                </button>
              </div>
            </div>

            {/* Reconciliation Table */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              <div style={{ marginBottom: 16, padding: 16, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, display: 'flex', gap: 12, fontSize: 14, fontWeight: 600, color: '#92400e' }}>
                <AlertTriangle style={{ width: 20, height: 20, flexShrink: 0, color: '#f59e0b' }} />
                <p style={{ margin: 0 }}>
                  Đối chiếu số lượng đã lấy so với yêu cầu. Sau khi phê duyệt, tồn kho vật lý sẽ chính thức bị trừ.
                </p>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                  <thead style={{ background: '#f8fafc' }}>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: 50 }}>STT</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>SKU</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Sản phẩm</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Vị trí</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>SL yêu cầu</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>SL đã lấy</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Chênh lệch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selected.details || []).map((d, i) => {
                      const diff = d.pickedQty - d.requiredQty;
                      return (
                        <tr key={d.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: 13, color: '#94a3b8', fontWeight: 700 }}>{i + 1}</td>
                          <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#475569' }}>{d.product?.internalSku}</td>
                          <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{d.product?.name}</td>
                          <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#475569' }}>{d.warehouseCode || 'DEFAULT'}</td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#475569' }}>{d.requiredQty}</td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{d.pickedQty}</td>
                          <td style={{
                            padding: '14px 16px',
                            textAlign: 'right',
                            fontSize: 14,
                            fontWeight: 800,
                            color: diff === 0 ? '#059669' : diff < 0 ? '#dc2626' : '#06b6d4',
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

            {/* Footer Summary */}
            <div style={{ padding: '12px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, color: '#475569' }}>
              <span>Tổng mặt hàng: <strong style={{ color: '#0f172a' }}>{(selected.details || []).length}</strong></span>
              <span>Tổng giá trị: <strong style={{ color: '#0f172a' }}>{formatMoney((selected.details || []).reduce((sum, d) => sum + d.totalLineAmount, 0))}</strong></span>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            <CheckCircle2 style={{ width: 64, height: 64, color: '#e2e8f0', marginBottom: 16 }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#475569', margin: 0 }}>Tất cả đơn đã được xử lý</h3>
            <p style={{ fontSize: 13, marginTop: 4 }}>Không có đơn xuất kho nào đang chờ phê duyệt.</p>
          </div>
        )}
      </div>
    </div>
  );
}
