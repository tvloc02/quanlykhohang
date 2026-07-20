import React, { useEffect, useState, useCallback } from 'react';
import {
  Lock,
  Unlock,
  Building,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  ClipboardList,
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

export interface WarehouseItem {
  id: string;
  code: string;
  name: string;
  address?: string;
  status: 'active' | 'inactive';
  isFrozen: boolean;
}

export default function StocktakeFreezePage() {
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [stocktakes, setStocktakes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [whRes, stRes] = await Promise.all([
        fetch(`${API_BASE_URL}/warehouses`, { headers: authHeaders() }).then((r) => r.ok ? r.json() : []),
        fetch(`${API_BASE_URL}/inventory/stocktakes`, { headers: authHeaders() }).then((r) => r.ok ? r.json() : []),
      ]);
      setWarehouses(whRes || []);
      setStocktakes(stRes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleFreeze = async (wh: WarehouseItem) => {
    const action = wh.isFrozen ? 'unfreeze' : 'freeze';
    const actionText = wh.isFrozen ? 'Mở khóa kho' : 'Đóng băng kho';
    const confirmMsg = wh.isFrozen
      ? `Mở khóa kho "${wh.name}" (${wh.code})? Các giao dịch nhập/xuất sẽ được phép trở lại.`
      : `Đóng băng kho "${wh.name}" (${wh.code})? Mọi giao dịch nhập kho & xuất kho tại kho này sẽ bị tạm ngưng để kiểm kê.`;

    if (!window.confirm(confirmMsg)) return;

    setUpdatingId(wh.id);
    try {
      const res = await fetch(`${API_BASE_URL}/warehouses/${wh.id}/${action}`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`Không thể ${actionText}`);

      alert(`Đã ${actionText} thành công!`);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Lỗi');
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = warehouses.filter((w) => {
    const term = search.toLowerCase();
    return (
      w.code.toLowerCase().includes(term) ||
      w.name.toLowerCase().includes(term) ||
      (w.address || '').toLowerCase().includes(term)
    );
  });

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Đóng Băng Kho Kiểm Kê</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
            Khóa khu vực kho để tạm dừng xuất/nhập, đảm bảo tuyệt đối không sai lệch tồn kho khi đếm
          </p>
        </div>
        <button
          onClick={fetchData}
          style={{ padding: '8px 16px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#475569' }}
        >
          <RefreshCw style={{ width: 14, height: 14 }} /> Làm mới
        </button>
      </div>

      {/* Info Warning Banner */}
      <div style={{ marginBottom: 20, padding: 16, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, display: 'flex', gap: 12, fontSize: 14, fontWeight: 600, color: '#92400e' }}>
        <AlertTriangle style={{ width: 20, height: 20, flexShrink: 0, color: '#f59e0b' }} />
        <div>
          <strong>Cơ chế đóng băng kho:</strong> Khi một khu vực kho bị đóng băng 🔒, hệ thống sẽ tự động ngăn chặn tất cả các yêu cầu tạo phiếu nhập kho hoặc xuất kho tại kho đó. Kho sẽ tự động được mở khóa khi Quản lý duyệt hoàn tất kiểm kê.
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: 16, position: 'relative', maxWidth: 400 }}>
        <Search style={{ position: 'absolute', left: 12, top: 10, width: 16, height: 16, color: '#94a3b8' }} />
        <input
          type="text"
          placeholder="Tìm mã kho, tên kho, địa chỉ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', height: 36, paddingLeft: 36, paddingRight: 12, borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', background: 'white' }}
        />
      </div>

      {/* Warehouses Grid */}
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Đang tải danh sách kho...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', background: 'white', borderRadius: 16, border: '1px solid #e2e8f0' }}>
          Không tìm thấy kho hàng phù hợp.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filtered.map((wh) => {
            const activeStocktakes = stocktakes.filter(
              (st) => (st.locationCode === wh.code || st.locationCode === wh.id) && st.status !== 'APPROVED' && st.status !== 'REJECTED'
            );
            const isFrozen = wh.isFrozen;

            return (
              <div
                key={wh.id}
                style={{
                  background: 'white',
                  borderRadius: 16,
                  border: isFrozen ? '2px solid #ef4444' : '1px solid #e2e8f0',
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxShadow: isFrozen ? '0 4px 12px rgba(239,68,68,0.1)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ padding: 10, background: isFrozen ? '#fef2f2' : '#f0fdf4', borderRadius: 12, color: isFrozen ? '#ef4444' : '#10b981' }}>
                      <Building style={{ width: 22, height: 22 }} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{wh.name}</h3>
                      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: '#64748b' }}>{wh.code}</span>
                    </div>
                  </div>

                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      background: isFrozen ? '#fef2f2' : '#ecfdf5',
                      color: isFrozen ? '#dc2626' : '#059669',
                      border: `1px solid ${isFrozen ? '#fca5a5' : '#a7f3d0'}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {isFrozen ? (
                      <><Lock style={{ width: 12, height: 12 }} /> Đóng băng</>
                    ) : (
                      <><CheckCircle2 style={{ width: 12, height: 12 }} /> Bình thường</>
                    )}
                  </span>
                </div>

                {wh.address && (
                  <div style={{ display: 'flex', gap: 6, fontSize: 13, color: '#64748b', alignItems: 'center' }}>
                    <MapPin style={{ width: 14, height: 14, flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{wh.address}</span>
                  </div>
                )}

                {/* Active stocktake info */}
                {activeStocktakes.length > 0 && (
                  <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, color: '#475569' }}>
                    <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                      <ClipboardList style={{ width: 14, height: 14, color: '#06b6d4' }} />
                      Đang kiểm kê ({activeStocktakes.length} phiên):
                    </div>
                    {activeStocktakes.map((st) => (
                      <div key={st.id} style={{ marginLeft: 18, color: '#0f172a', fontWeight: 600 }}>
                        • {st.stocktakeNo} ({st.status})
                      </div>
                    ))}
                  </div>
                )}

                {/* Freeze / Unfreeze Action Button */}
                <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                  <button
                    onClick={() => handleToggleFreeze(wh)}
                    disabled={updatingId === wh.id}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: 10,
                      border: 'none',
                      background: isFrozen ? '#10b981' : '#ef4444',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    {isFrozen ? (
                      <><Unlock style={{ width: 16, height: 16 }} /> Mở khóa kho</>
                    ) : (
                      <><Lock style={{ width: 16, height: 16 }} /> Đóng băng kho kiểm kê</>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
