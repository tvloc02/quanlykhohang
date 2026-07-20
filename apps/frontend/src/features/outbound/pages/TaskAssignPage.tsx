import React, { useEffect, useState, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  UserPlus,
  ClipboardList,
  Package,
  CheckCircle2,
  Clock3,
  User,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { outboundApi, type OutboundOrder, type PickingTask } from '../api/outboundApi';

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

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
    case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'picking': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'READY_TO_SHIP': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'shipped': return 'bg-slate-50 text-slate-500 border-slate-200';
    default: return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}

function taskStatusLabel(status?: string) {
  switch (status) {
    case 'ASSIGNED': return 'Đã giao';
    case 'COMPLETED': return 'Hoàn thành';
    case 'OPEN': return 'Mở';
    default: return status || 'Mở';
  }
}

function taskStatusColor(status?: string) {
  switch (status) {
    case 'ASSIGNED': return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    case 'COMPLETED': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default: return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}

export default function TaskAssignPage() {
  const [orders, setOrders] = useState<OutboundOrder[]>([]);
  const [tasks, setTasks] = useState<PickingTask[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersData, tasksData, staffRes] = await Promise.all([
        outboundApi.listOrders(),
        outboundApi.listTasks(),
        fetch(`${API_BASE_URL}/users`, { headers: authHeaders() }).then((r) => r.ok ? r.json() : []),
      ]);

      // Lọc đơn chưa shipped
      setOrders(ordersData.filter((o) => o.status !== 'shipped'));
      setTasks(tasksData);
      setStaffList(
        (staffRes || []).filter((u: any) => {
          const roles = u.roles?.map((r: any) => r.name || r) || [];
          return roles.includes('staff') || roles.includes('manager');
        }),
      );
    } catch (err) {
      console.error('Lỗi tải dữ liệu:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAssign = async () => {
    if (!selectedOrderId || !selectedStaffId) return;
    setAssigning(true);
    try {
      const staffUser = staffList.find((s) => s.id === selectedStaffId);
      await outboundApi.assignTask(selectedOrderId, staffUser?.fullName || staffUser?.email || selectedStaffId);
      alert('Đã giao việc thành công!');
      setSelectedStaffId('');
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Lỗi giao việc');
    } finally {
      setAssigning(false);
    }
  };

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) || null;
  const orderTasks = tasks.filter((t) => t.order?.id === selectedOrderId);

  const filteredOrders = orders.filter((o) => {
    const term = search.toLowerCase();
    return (
      (o.orderNo || '').toLowerCase().includes(term) ||
      (o.customer || '').toLowerCase().includes(term)
    );
  });

  return (
    <div style={{ display: 'flex', height: '100%', gap: '24px', padding: '24px', background: '#f8fafc', overflow: 'hidden' }}>
      {/* Left Panel — Orders List */}
      <div style={{ width: '380px', flexShrink: 0, background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>Đơn xuất kho</h2>
            <button onClick={fetchData} style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', borderRadius: '8px' }}>
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

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Đang tải...</div>
          ) : filteredOrders.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Không có đơn xuất kho nào.</div>
          ) : (
            filteredOrders.map((o) => {
              const assignedTasks = tasks.filter((t) => t.order?.id === o.id);
              return (
                <button
                  key={o.id}
                  onClick={() => setSelectedOrderId(o.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px',
                    borderRadius: '12px',
                    border: o.id === selectedOrderId ? '2px solid #06b6d4' : '1px solid transparent',
                    background: o.id === selectedOrderId ? 'rgba(6,182,212,0.04)' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    marginBottom: '4px',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{o.orderNo}</span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      border: '1px solid',
                    }} className={statusColor(o.status)}>
                      {statusLabel(o.status)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                    <span style={{ fontWeight: 600, color: '#334155' }}>{o.customer || 'Khách lẻ'}</span>
                    <span>{o.items} sản phẩm</span>
                  </div>
                  {assignedTasks.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {assignedTasks.map((t) => (
                        <span key={t.id} style={{
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 600,
                          border: '1px solid',
                        }} className={taskStatusColor(t.status)}>
                          {t.assignedTo} — {taskStatusLabel(t.status)}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Panel — Detail + Assign */}
      <div style={{ flex: 1, background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedOrder ? (
          <>
            {/* Header */}
            <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ padding: 12, background: '#ecfeff', borderRadius: 14, color: '#06b6d4' }}>
                  <ClipboardList style={{ width: 24, height: 24 }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{selectedOrder.orderNo}</h3>
                  <div style={{ marginTop: 4, display: 'flex', gap: 16, fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Package style={{ width: 14, height: 14 }} />
                      {selectedOrder.customer || 'Khách lẻ'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <FileText style={{ width: 14, height: 14 }} />
                      {selectedOrder.items} sản phẩm
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Product Details Table */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Chi tiết hàng hóa</h4>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                  <thead style={{ background: '#f8fafc' }}>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>STT</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>SKU</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Sản phẩm</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>SL yêu cầu</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>SL đã lấy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedOrder.details || []).map((d, i) => (
                      <tr key={d.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, color: '#94a3b8', fontWeight: 700 }}>{i + 1}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#475569' }}>{d.product?.internalSku}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{d.product?.name}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#475569' }}>{d.requiredQty}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: d.pickedQty >= d.requiredQty ? '#059669' : '#0f172a' }}>{d.pickedQty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tasks */}
              <h4 style={{ margin: '0 0 12px 0', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Nhiệm vụ đã giao</h4>
              {orderTasks.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  Chưa có nhiệm vụ nào được giao cho đơn này.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {orderTasks.map((t) => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <User style={{ width: 16, height: 16, color: '#06b6d4' }} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{t.assignedTo || 'Chưa xác định'}</span>
                      </div>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        border: '1px solid',
                      }} className={taskStatusColor(t.status)}>
                        {taskStatusLabel(t.status)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assign Form */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', gap: 12, alignItems: 'center' }}>
              <UserPlus style={{ width: 20, height: 20, color: '#06b6d4', flexShrink: 0 }} />
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 14, color: '#0f172a', background: 'white', outline: 'none' }}
              >
                <option value="">-- Chọn nhân viên kho --</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName || s.email} {s.roles?.map((r: any) => `(${r.name || r})`).join(' ')}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAssign}
                disabled={assigning || !selectedStaffId}
                style={{
                  padding: '10px 20px',
                  borderRadius: 10,
                  border: 'none',
                  background: selectedStaffId ? '#06b6d4' : '#cbd5e1',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: selectedStaffId ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                }}
              >
                <UserPlus style={{ width: 16, height: 16 }} />
                {assigning ? 'Đang giao...' : 'Giao việc'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            <ClipboardList style={{ width: 64, height: 64, color: '#e2e8f0', marginBottom: 16 }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#475569', margin: 0 }}>Chọn đơn xuất kho</h3>
            <p style={{ fontSize: 13, marginTop: 4 }}>Chọn một đơn xuất kho bên trái để xem chi tiết và phân công.</p>
          </div>
        )}
      </div>
    </div>
  );
}
