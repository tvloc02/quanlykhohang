import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Cpu,
  RefreshCw,
  Search,
  Sparkles,
  Package,
  MapPin,
  GripVertical,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  ArrowRight,
  Layers,
  X,
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

export interface AbcProduct {
  productId: string;
  sku: string;
  name: string;
  unit?: string;
  totalTurnover: number;
  cumulativePercentage: number;
  category: 'A' | 'B' | 'C';
}

export interface SlottingSuggestion {
  locationCode: string;
  zone: string;
  rack: string;
  proximityScore: number;
  abcCategory: 'A' | 'B' | 'C';
  currentPhysical: number;
  maxCapacity: number;
  availableCapacity: number;
  occupancyRate: number;
  recommendationReason: string;
}

/* ── Warehouse Layout Types (Drag & Drop) ──────────────────────── */

interface LayoutCell {
  id: string;
  locationCode: string;
  zone: string;
  x: number; // grid column
  y: number; // grid row
  w: number; // cell width multiplier
  label: string;
  color: string;
}

const ZONE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  A: { bg: 'linear-gradient(135deg,#ede9fe,#c4b5fd)', border: '#8b5cf6', text: '#6d28d9' },
  B: { bg: 'linear-gradient(135deg,#cffafe,#a5f3fc)', border: '#06b6d4', text: '#0e7490' },
  C: { bg: 'linear-gradient(135deg,#dcfce7,#bbf7d0)', border: '#22c55e', text: '#16a34a' },
  D: { bg: 'linear-gradient(135deg,#fef3c7,#fde68a)', border: '#f59e0b', text: '#b45309' },
};

function generateDefaultLayout(): LayoutCell[] {
  const cells: LayoutCell[] = [];
  const zones = ['A', 'B', 'C', 'D'];
  zones.forEach((z, zi) => {
    for (let r = 1; r <= 4; r++) {
      for (let b = 1; b <= 3; b++) {
        cells.push({
          id: `${z}-0${r}-0${b}`,
          locationCode: `${z}-0${r}-0${b}`,
          zone: z,
          x: (r - 1) * 3 + (b - 1),
          y: zi,
          w: 1,
          label: `${z}-0${r}-0${b}`,
          color: z,
        });
      }
    }
  });
  return cells;
}

function StatCard({ icon: Icon, value, label, accent }: { icon: any; value: string | number; label: string; accent: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 130, padding: '14px 16px', borderRadius: 16,
      background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(226,232,240,0.8)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: 14, height: 14, color: '#fff' }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{value}</div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────── */

export default function SmartSlottingPage() {
  const [abcList, setAbcList] = useState<AbcProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [requiredQty, setRequiredQty] = useState(20);
  const [suggestions, setSuggestions] = useState<SlottingSuggestion[]>([]);
  const [calculating, setCalculating] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'suggest' | 'layout'>('suggest');

  // Drag & Drop Layout state
  const [layout, setLayout] = useState<LayoutCell[]>(() => {
    try {
      const saved = localStorage.getItem('wms_warehouse_layout');
      return saved ? JSON.parse(saved) : generateDefaultLayout();
    } catch { return generateDefaultLayout(); }
  });
  const [draggedCell, setDraggedCell] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<LayoutCell | null>(null);
  const [showAddZone, setShowAddZone] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');

  const fetchAbcData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/inventory/smart-slotting/abc-analysis`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAbcList(data || []);
        if (data.length > 0 && !selectedProductId) setSelectedProductId(data[0].productId);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [selectedProductId]);

  useEffect(() => { fetchAbcData(); }, [fetchAbcData]);

  const handleSuggest = async (pid?: string) => {
    const id = pid || selectedProductId;
    if (!id) return;
    setCalculating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/inventory/smart-slotting/suggest?productId=${id}&qty=${requiredQty}`, { headers: authHeaders() });
      if (res.ok) setSuggestions(await res.json());
    } catch (e) { console.error(e); }
    finally { setCalculating(false); }
  };

  useEffect(() => { if (selectedProductId) handleSuggest(selectedProductId); }, [selectedProductId]);

  const filtered = abcList.filter(p =>
    p.sku.toLowerCase().includes(search.toLowerCase()) || p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const countA = abcList.filter(p => p.category === 'A').length;
  const countB = abcList.filter(p => p.category === 'B').length;
  const countC = abcList.filter(p => p.category === 'C').length;
  const selectedProduct = abcList.find(p => p.productId === selectedProductId);

  /* ── Drag & Drop Handlers ────────────────────────────────────── */
  const handleDragStart = (id: string) => setDraggedCell(id);
  const handleDragEnd = () => setDraggedCell(null);

  const handleDrop = (targetId: string) => {
    if (!draggedCell || draggedCell === targetId) return;
    setLayout(prev => {
      const cells = [...prev];
      const dragIdx = cells.findIndex(c => c.id === draggedCell);
      const dropIdx = cells.findIndex(c => c.id === targetId);
      if (dragIdx === -1 || dropIdx === -1) return prev;
      // Swap positions
      const tmpX = cells[dragIdx].x;
      const tmpY = cells[dragIdx].y;
      cells[dragIdx].x = cells[dropIdx].x;
      cells[dragIdx].y = cells[dropIdx].y;
      cells[dropIdx].x = tmpX;
      cells[dropIdx].y = tmpY;
      return cells;
    });
    setDraggedCell(null);
  };

  const saveLayout = () => {
    localStorage.setItem('wms_warehouse_layout', JSON.stringify(layout));
    alert('Đã lưu sơ đồ kho thành công!');
  };

  const resetLayout = () => {
    const def = generateDefaultLayout();
    setLayout(def);
    localStorage.removeItem('wms_warehouse_layout');
  };

  const removeCell = (id: string) => {
    setLayout(prev => prev.filter(c => c.id !== id));
    setEditingCell(null);
  };

  const addCell = (zone: string) => {
    const existing = layout.filter(c => c.zone === zone);
    const newIdx = existing.length + 1;
    const rack = Math.ceil(newIdx / 3);
    const bin = ((newIdx - 1) % 3) + 1;
    const code = `${zone}-0${rack}-0${bin}`;
    const zoneIdx = ['A', 'B', 'C', 'D', 'E', 'F'].indexOf(zone);

    setLayout(prev => [
      ...prev,
      {
        id: code,
        locationCode: code,
        zone,
        x: existing.length % 12,
        y: zoneIdx >= 0 ? zoneIdx : Math.floor(existing.length / 12),
        w: 1,
        label: code,
        color: zone,
      },
    ]);
  };

  const addNewZone = () => {
    const name = newZoneName.trim().toUpperCase();
    if (!name) return;
    addCell(name);
    setNewZoneName('');
    setShowAddZone(false);
  };

  const layoutZones = Array.from(new Set(layout.map(c => c.zone)));

  return (
    <div style={{ padding: '20px 24px', background: 'linear-gradient(180deg, #f0f4f8 0%, #e8edf5 100%)', minHeight: '100vh' }}>

      {/* ─── Header ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>
            💡 Gợi ý cất hàng thông minh (Smart Slotting)
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b', fontWeight: 500 }}>
            Phân loại luồng hàng ABC Pareto & Gợi ý vị trí cất hàng tối ưu nhất gần cửa kho
          </p>
        </div>
        <button onClick={fetchAbcData} style={{
          padding: '10px 18px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, fontWeight: 700, color: '#475569', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <RefreshCw style={{ width: 14, height: 14 }} /> Làm mới
        </button>
      </div>

      {/* ─── ABC Stat Cards ────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatCard icon={Sparkles} label="Nhóm A (Bán chạy)" value={countA} accent="#ef4444" />
        <StatCard icon={Package} label="Nhóm B (Trung bình)" value={countB} accent="#f59e0b" />
        <StatCard icon={Layers} label="Nhóm C (Bán chậm)" value={countC} accent="#3b82f6" />
        <StatCard icon={MapPin} label="Tổng sản phẩm" value={abcList.length} accent="#6366f1" />
      </div>

      {/* ─── Tab Switcher ──────────────────────────────────────── */}
      <div style={{
        background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(16px)',
        padding: '12px 18px', borderRadius: 16, border: '1px solid rgba(226,232,240,0.8)',
        marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', background: '#f1f5f9', padding: 4, borderRadius: 14, gap: 4 }}>
          {[
            { key: 'suggest' as const, icon: Sparkles, label: 'Gợi ý vị trí cất hàng', gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)' },
            { key: 'layout' as const, icon: GripVertical, label: 'Thiết kế sơ đồ kho (Kéo thả)', gradient: 'linear-gradient(135deg, #059669, #047857)' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              padding: '9px 18px', borderRadius: 11, border: 'none', cursor: 'pointer',
              background: activeTab === tab.key ? tab.gradient : 'transparent',
              color: activeTab === tab.key ? '#fff' : '#475569',
              fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 7,
              transition: 'all 0.25s ease',
              boxShadow: activeTab === tab.key ? '0 2px 8px rgba(99,102,241,0.25)' : 'none',
            }}>
              <tab.icon style={{ width: 15, height: 15 }} /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── TAB: Smart Slotting Suggestions ───────────────────── */}
      {activeTab === 'suggest' && (
        <div style={{ display: 'flex', gap: 22, alignItems: 'flex-start' }}>
          {/* Left: Slotting Assistant */}
          <div style={{
            flex: 1, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)',
            borderRadius: 18, border: '1px solid rgba(226,232,240,0.7)', padding: 24,
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Cpu style={{ width: 20, height: 20, color: '#fff' }} />
              </div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0f172a' }}>Trợ lý gợi ý vị trí</h2>
            </div>

            {/* Product Selector */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Sản phẩm nhập kho</label>
                <select value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} style={{
                  width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid #e2e8f0',
                  fontSize: 13, outline: 'none', background: '#fff', fontWeight: 600,
                }}>
                  {abcList.map(p => (
                    <option key={p.productId} value={p.productId}>[{p.category}] {p.sku} — {p.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ width: 130 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Số lượng</label>
                <input type="number" value={requiredQty} min={1} onChange={e => setRequiredQty(Math.max(1, Number(e.target.value)))} style={{
                  width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none',
                }} />
              </div>
            </div>

            {/* Selected Product Badge */}
            {selectedProduct && (
              <div style={{
                padding: '10px 16px', background: '#f8fafc', borderRadius: 14, border: '1px solid #e2e8f0',
                marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Phân loại: </span>
                  <span style={{
                    padding: '3px 10px', borderRadius: 8, fontSize: 12, fontWeight: 800,
                    background: selectedProduct.category === 'A' ? 'linear-gradient(135deg,#fef2f2,#fecaca)' : selectedProduct.category === 'B' ? 'linear-gradient(135deg,#fffbeb,#fef3c7)' : 'linear-gradient(135deg,#eff6ff,#dbeafe)',
                    color: selectedProduct.category === 'A' ? '#dc2626' : selectedProduct.category === 'B' ? '#d97706' : '#2563eb',
                  }}>Nhóm {selectedProduct.category}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                  Lượt luân chuyển: {selectedProduct.totalTurnover}
                </span>
              </div>
            )}

            {/* Suggestion Results */}
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin style={{ width: 16, height: 16, color: '#6366f1' }} /> Vị trí khuyến nghị
            </h3>
            {calculating ? (
              <div style={{ padding: 36, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', margin: '0 auto 10px', animation: 'spin 0.8s linear infinite' }} />
                Đang phân tích...
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : suggestions.length === 0 ? (
              <div style={{ padding: 36, textAlign: 'center', color: '#94a3b8', fontSize: 13, background: '#f8fafc', borderRadius: 14 }}>Không tìm thấy vị trí phù hợp.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {suggestions.map((s, i) => (
                  <div key={s.locationCode} style={{
                    padding: '14px 16px', borderRadius: 16,
                    border: i === 0 ? '2px solid #6366f1' : '1px solid #e2e8f0',
                    background: i === 0 ? 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(99,102,241,0.02))' : '#fff',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    transition: 'all 0.2s',
                    boxShadow: i === 0 ? '0 2px 12px rgba(99,102,241,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                  }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 900, fontSize: 14,
                        background: i === 0 ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : '#f1f5f9',
                        color: i === 0 ? '#fff' : '#64748b',
                      }}>#{i + 1}</div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace', color: '#0f172a' }}>{s.locationCode}</span>
                          <span style={{ padding: '2px 8px', borderRadius: 7, fontSize: 11, fontWeight: 800, background: '#ecfdf5', color: '#059669' }}>
                            Tối ưu {s.proximityScore}%
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: 500 }}>{s.recommendationReason}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Sức chứa trống</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#059669' }}>{s.availableCapacity}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: ABC Product Table */}
          <div style={{
            width: 400, flexShrink: 0, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)',
            borderRadius: 18, border: '1px solid rgba(226,232,240,0.7)', padding: 20,
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Bảng phân loại ABC</h3>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>{filtered.length} SP</span>
            </div>

            <div style={{ marginBottom: 12, position: 'relative' }}>
              <Search style={{ position: 'absolute', left: 10, top: 9, width: 14, height: 14, color: '#94a3b8' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm SKU, tên..."
                style={{ width: '100%', height: 34, paddingLeft: 30, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12, outline: 'none' }}
              />
            </div>

            <div style={{ maxHeight: 500, overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>SKU</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Tên</th>
                    <th style={{ padding: '9px 12px', textAlign: 'center', fontSize: 11, fontWeight: 800, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Nhóm</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.productId} onClick={() => setSelectedProductId(p.productId)} style={{
                      borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                      background: p.productId === selectedProductId ? 'rgba(99,102,241,0.06)' : '#fff',
                      transition: 'background 0.15s',
                    }}>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: '#6366f1' }}>{p.sku}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: '#0f172a', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800,
                          background: p.category === 'A' ? '#fef2f2' : p.category === 'B' ? '#fffbeb' : '#eff6ff',
                          color: p.category === 'A' ? '#dc2626' : p.category === 'B' ? '#d97706' : '#2563eb',
                        }}>{p.category}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: Drag & Drop Layout Editor ────────────────────── */}
      {activeTab === 'layout' && (
        <div style={{
          background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)',
          borderRadius: 18, border: '1px solid rgba(226,232,240,0.7)', padding: 24,
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg,#059669,#047857)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <GripVertical style={{ width: 20, height: 20, color: '#fff' }} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0f172a' }}>Thiết kế sơ đồ kho (Kéo thả)</h2>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b', fontWeight: 500 }}>Kéo thả các ô để tùy chỉnh bố cục kho hàng • Nhấp vào ô để chỉnh sửa • Tổng {layout.length} ô</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={resetLayout} style={{
                padding: '9px 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff',
                cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <RotateCcw style={{ width: 14, height: 14 }} /> Đặt lại
              </button>
              <button onClick={saveLayout} style={{
                padding: '9px 16px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg,#059669,#047857)', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 2px 8px rgba(5,150,105,0.3)',
              }}>
                <Save style={{ width: 14, height: 14 }} /> Lưu bố cục
              </button>
            </div>
          </div>

          {/* Zone Blocks with Drag & Drop */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {layoutZones.map(zone => {
              const zoneCells = layout.filter(c => c.zone === zone);
              const zcol = ZONE_COLORS[zone] || { bg: 'linear-gradient(135deg,#f1f5f9,#e2e8f0)', border: '#94a3b8', text: '#475569' };

              return (
                <div key={zone} style={{
                  padding: 16, borderRadius: 16,
                  border: `2px dashed ${zcol.border}`,
                  background: 'rgba(248,250,252,0.6)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: zcol.bg, border: `1px solid ${zcol.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 900, color: zcol.text }}>{zone}</span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Khu {zone}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>({zoneCells.length} ô)</span>
                    </div>
                    <button onClick={() => addCell(zone)} style={{
                      padding: '6px 12px', borderRadius: 8, border: `1px solid ${zcol.border}`,
                      background: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: zcol.text,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <Plus style={{ width: 12, height: 12 }} /> Thêm ô
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                    {zoneCells.map(cell => (
                      <div
                        key={cell.id}
                        draggable
                        onDragStart={() => handleDragStart(cell.id)}
                        onDragEnd={handleDragEnd}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => handleDrop(cell.id)}
                        onClick={() => setEditingCell(cell)}
                        style={{
                          padding: '12px 10px', borderRadius: 12, cursor: 'grab',
                          background: zcol.bg, border: `2px solid ${draggedCell === cell.id ? '#0f172a' : zcol.border}`,
                          opacity: draggedCell === cell.id ? 0.5 : 1,
                          transition: 'all 0.2s ease',
                          display: 'flex', flexDirection: 'column', gap: 4,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'monospace', color: zcol.text }}>
                            {cell.locationCode}
                          </span>
                          <GripVertical style={{ width: 14, height: 14, color: zcol.text, opacity: 0.5 }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 600, color: zcol.text, opacity: 0.7 }}>{cell.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Add New Zone */}
            <div style={{ padding: 16, borderRadius: 16, border: '2px dashed #cbd5e1', background: 'rgba(248,250,252,0.4)', textAlign: 'center' }}>
              {showAddZone ? (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
                  <input value={newZoneName} onChange={e => setNewZoneName(e.target.value)} placeholder="Tên khu (VD: E)"
                    style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', width: 140 }}
                    onKeyDown={e => e.key === 'Enter' && addNewZone()}
                  />
                  <button onClick={addNewZone} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    Thêm
                  </button>
                  <button onClick={() => setShowAddZone(false)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}>
                    <X style={{ width: 14, height: 14, color: '#64748b' }} />
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowAddZone(true)} style={{
                  padding: '10px 20px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff',
                  cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  <Plus style={{ width: 14, height: 14 }} /> Thêm khu vực mới
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Edit Cell Modal ───────────────────────────────────── */}
      {editingCell && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
        }} onClick={() => setEditingCell(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 380, background: '#fff', borderRadius: 20, padding: 24,
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', animation: 'modalIn 0.25s ease-out',
          }}>
            <style>{`@keyframes modalIn { from { opacity:0; transform: scale(0.95) translateY(10px); } to { opacity:1; transform: none; } }`}</style>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 900, color: '#0f172a' }}>Chỉnh sửa ô: {editingCell.locationCode}</h3>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Tên hiển thị</label>
              <input value={editingCell.label}
                onChange={e => setEditingCell({ ...editingCell, label: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Mã vị trí</label>
              <input value={editingCell.locationCode}
                onChange={e => setEditingCell({ ...editingCell, locationCode: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={() => {
                setLayout(prev => prev.map(c => c.id === editingCell.id ? editingCell : c));
                setEditingCell(null);
              }} style={{
                flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>Lưu thay đổi</button>
              <button onClick={() => removeCell(editingCell.id)} style={{
                padding: '10px 14px', borderRadius: 10, border: '1px solid #fca5a5', background: '#fef2f2',
                color: '#dc2626', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <Trash2 style={{ width: 14, height: 14 }} /> Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
