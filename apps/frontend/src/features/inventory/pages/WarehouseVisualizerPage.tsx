import React, { useEffect, useState, useCallback } from 'react';
import {
  Layers,
  Flame,
  Building,
  RefreshCw,
  Search,
  Lock,
  X,
  Package,
  Eye,
  Thermometer,
  LayoutGrid,
  MapPin,
  BarChart3,
  Unlock,
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

export interface DigitalTwinCell {
  locationCode: string;
  zone: string;
  rack: string;
  bin: string;
  totalPhysical: number;
  allocated: number;
  available: number;
  maxCapacity: number;
  occupancyRate: number;
  isFrozen: boolean;
  activityCount: number;
  heatmapIntensity: number;
  productsCount: number;
}

/* ── Color Systems ──────────────────────────────────────────────── */

function getOccupancyGradient(rate: number, frozen: boolean) {
  if (frozen) return {
    bg: 'linear-gradient(135deg, #fecdd3 0%, #fda4af 100%)',
    border: '#fb7185',
    text: '#e11d48',
    glow: '0 0 12px rgba(251,113,133,0.35)',
    label: '🔒 Đóng băng',
  };
  if (rate === 0) return {
    bg: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
    border: '#e2e8f0',
    text: '#94a3b8',
    glow: 'none',
    label: 'Trống',
  };
  if (rate < 40) return {
    bg: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
    border: '#6ee7b7',
    text: '#059669',
    glow: '0 0 10px rgba(16,185,129,0.2)',
    label: `${rate}% lấp đầy`,
  };
  if (rate < 70) return {
    bg: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
    border: '#93c5fd',
    text: '#2563eb',
    glow: '0 0 10px rgba(59,130,246,0.2)',
    label: `${rate}% lấp đầy`,
  };
  if (rate < 90) return {
    bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    border: '#fbbf24',
    text: '#d97706',
    glow: '0 0 10px rgba(245,158,11,0.25)',
    label: `${rate}% lấp đầy`,
  };
  return {
    bg: 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)',
    border: '#f87171',
    text: '#dc2626',
    glow: '0 0 14px rgba(239,68,68,0.3)',
    label: `Đầy ${rate}%`,
  };
}

function getHeatColor(intensity: number) {
  if (intensity >= 0.8) return {
    bg: 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)',
    color: '#fff',
    glow: '0 0 18px rgba(220,38,38,0.5)',
    label: 'Rất cao (Hotspot)',
  };
  if (intensity >= 0.6) return {
    bg: 'linear-gradient(135deg, #c2410c 0%, #ea580c 100%)',
    color: '#fff',
    glow: '0 0 14px rgba(234,88,12,0.4)',
    label: 'Cao',
  };
  if (intensity >= 0.4) return {
    bg: 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)',
    color: '#422006',
    glow: '0 0 10px rgba(245,158,11,0.35)',
    label: 'Trung bình',
  };
  if (intensity >= 0.2) return {
    bg: 'linear-gradient(135deg, #0e7490 0%, #06b6d4 100%)',
    color: '#fff',
    glow: '0 0 8px rgba(6,182,212,0.3)',
    label: 'Thấp',
  };
  return {
    bg: 'linear-gradient(135deg, #164e63 0%, #0e7490 100%)',
    color: '#a5f3fc',
    glow: '0 0 6px rgba(14,116,144,0.2)',
    label: 'Rất thấp',
  };
}

/* ── Stat Card ──────────────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string | number; accent: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 150, padding: '16px 18px', borderRadius: 16,
      background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(226,232,240,0.8)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: 16, height: 16, color: '#fff' }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{value}</div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────── */

export default function WarehouseVisualizerPage() {
  const [cells, setCells] = useState<DigitalTwinCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'twin' | 'heat'>('twin');
  const [selectedCell, setSelectedCell] = useState<DigitalTwinCell | null>(null);
  const [cellDetails, setCellDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [search, setSearch] = useState('');
  const [hoverCode, setHoverCode] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/inventory/visualizer/digital-twin?days=30`, { headers: authHeaders() });
      if (res.ok) setCells(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openDetail = async (cell: DigitalTwinCell) => {
    setSelectedCell(cell);
    setLoadingDetails(true);
    try {
      const res = await fetch(`${API_BASE_URL}/inventory/visualizer/location-detail/${encodeURIComponent(cell.locationCode)}`, { headers: authHeaders() });
      if (res.ok) setCellDetails(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoadingDetails(false); }
  };

  const filtered = cells.filter(c => {
    const t = search.toLowerCase();
    return c.locationCode.toLowerCase().includes(t) || c.zone.toLowerCase().includes(t);
  });

  const zones = ['Khu A', 'Khu B', 'Khu C', 'Khu D'];
  const totalPhysical = cells.reduce((s, c) => s + c.totalPhysical, 0);
  const totalCapacity = cells.reduce((s, c) => s + c.maxCapacity, 0);
  const avgOccupancy = totalCapacity > 0 ? Math.round((totalPhysical / totalCapacity) * 100) : 0;
  const frozenCount = cells.filter(c => c.isFrozen).length;
  const hotspotCount = cells.filter(c => c.heatmapIntensity >= 0.6).length;

  return (
    <div style={{ padding: '20px 24px', background: 'linear-gradient(180deg, #f0f4f8 0%, #e8edf5 100%)', minHeight: '100vh' }}>

      {/* ─── Header ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>
            {viewMode === 'twin' ? '🏗️ Sơ đồ kho số hóa 2D (Digital Twin)' : '🔥 Bản đồ nhiệt kho hàng (Heatmap)'}
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b', fontWeight: 500 }}>
            {viewMode === 'twin'
              ? 'Nhấp vào ô bất kỳ để xem sức chứa, tỷ lệ lấp đầy và danh sách hàng hóa lưu trữ'
              : 'Phân tích tần suất tương tác xuất/nhập để xác định Hotspot & Coldspot trong kho'}
          </p>
        </div>
        <button onClick={fetchData} style={{
          padding: '10px 18px', background: '#fff', border: '1px solid #e2e8f0',
          borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, fontWeight: 700, color: '#475569', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          transition: 'all 0.2s',
        }}>
          <RefreshCw style={{ width: 14, height: 14 }} /> Làm mới
        </button>
      </div>

      {/* ─── Stat Cards ────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatCard icon={LayoutGrid} label="Tổng ô kho" value={cells.length} accent="#6366f1" />
        <StatCard icon={Package} label="Tổng tồn vật lý" value={totalPhysical.toLocaleString()} accent="#0891b2" />
        <StatCard icon={BarChart3} label="Tỷ lệ lấp đầy TB" value={`${avgOccupancy}%`} accent="#059669" />
        <StatCard icon={Lock} label="Ô đóng băng" value={frozenCount} accent="#e11d48" />
        <StatCard icon={Thermometer} label="Hotspot" value={hotspotCount} accent="#ea580c" />
      </div>

      {/* ─── Toolbar ───────────────────────────────────────────── */}
      <div style={{
        background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(16px)',
        padding: '12px 18px', borderRadius: 16, border: '1px solid rgba(226,232,240,0.8)',
        marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        {/* Mode Tabs */}
        <div style={{ display: 'flex', background: '#f1f5f9', padding: 4, borderRadius: 14, gap: 4 }}>
          {[
            { key: 'twin' as const, icon: Layers, label: 'Sơ đồ 2D', gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)' },
            { key: 'heat' as const, icon: Flame, label: 'Bản đồ nhiệt', gradient: 'linear-gradient(135deg, #ef4444, #dc2626)' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setViewMode(tab.key)} style={{
              padding: '9px 18px', borderRadius: 11, border: 'none', cursor: 'pointer',
              background: viewMode === tab.key ? tab.gradient : 'transparent',
              color: viewMode === tab.key ? '#fff' : '#475569',
              fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 7,
              transition: 'all 0.25s ease',
              boxShadow: viewMode === tab.key ? '0 2px 8px rgba(99,102,241,0.25)' : 'none',
            }}>
              <tab.icon style={{ width: 15, height: 15 }} /> {tab.label}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 12, fontWeight: 700, color: '#475569' }}>
          {viewMode === 'twin' ? (
            <>
              {[
                { bg: 'linear-gradient(135deg,#d1fae5,#a7f3d0)', label: '< 40%' },
                { bg: 'linear-gradient(135deg,#dbeafe,#bfdbfe)', label: '40-70%' },
                { bg: 'linear-gradient(135deg,#fef3c7,#fde68a)', label: '70-90%' },
                { bg: 'linear-gradient(135deg,#fecaca,#fca5a5)', label: '> 90%' },
              ].map(l => (
                <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 4, background: l.bg, border: '1px solid rgba(0,0,0,0.08)' }}></span> {l.label}
                </span>
              ))}
            </>
          ) : (
            <>
              {[
                { bg: 'linear-gradient(135deg,#991b1b,#dc2626)', label: 'Hot' },
                { bg: 'linear-gradient(135deg,#c2410c,#ea580c)', label: 'Cao' },
                { bg: 'linear-gradient(135deg,#b45309,#f59e0b)', label: 'Vừa' },
                { bg: 'linear-gradient(135deg,#0e7490,#06b6d4)', label: 'Thấp' },
              ].map(l => (
                <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 4, background: l.bg }}></span> {l.label}
                </span>
              ))}
            </>
          )}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: 200 }}>
          <Search style={{ position: 'absolute', left: 10, top: 9, width: 14, height: 14, color: '#94a3b8' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm ô kho..."
            style={{ width: '100%', height: 34, paddingLeft: 30, paddingRight: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12, outline: 'none', background: '#fff' }}
          />
        </div>
      </div>

      {/* ─── Grid Canvas ───────────────────────────────────────── */}
      {loading ? (
        <div style={{ padding: 64, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
          <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
          Đang tải sơ đồ kho 2D...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {zones.map(zoneName => {
            const zoneCells = filtered.filter(c => c.zone === zoneName);
            if (zoneCells.length === 0) return null;

            const zLetter = zoneName.replace('Khu ', '');
            const zoneColors: Record<string, string> = { A: '#6366f1', B: '#0891b2', C: '#059669', D: '#d97706' };
            const accent = zoneColors[zLetter] || '#6366f1';

            return (
              <div key={zoneName} style={{
                background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)',
                borderRadius: 18, border: '1px solid rgba(226,232,240,0.7)', padding: '18px 20px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}>
                {/* Zone Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Building style={{ width: 18, height: 18, color: '#fff' }} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{zoneName}</h3>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>
                        {zoneCells.length} vị trí • Tổng tồn: {zoneCells.reduce((s, c) => s + c.totalPhysical, 0).toLocaleString()} đơn vị
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MapPin style={{ width: 14, height: 14, color: accent }} />
                    {zoneCells.filter(c => c.isFrozen).length > 0 && <span style={{ color: '#e11d48' }}>🔒 {zoneCells.filter(c => c.isFrozen).length} đóng băng</span>}
                  </div>
                </div>

                {/* Cells Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                  {zoneCells.map(cell => {
                    const occ = getOccupancyGradient(cell.occupancyRate, cell.isFrozen);
                    const heat = getHeatColor(cell.heatmapIntensity);
                    const isHovered = hoverCode === cell.locationCode;

                    return (
                      <button key={cell.locationCode}
                        onClick={() => openDetail(cell)}
                        onMouseEnter={() => setHoverCode(cell.locationCode)}
                        onMouseLeave={() => setHoverCode('')}
                        style={{
                          padding: '14px 12px', borderRadius: 14, cursor: 'pointer',
                          border: `2px solid ${viewMode === 'twin' ? occ.border : 'transparent'}`,
                          background: viewMode === 'twin' ? occ.bg : heat.bg,
                          color: viewMode === 'twin' ? '#0f172a' : heat.color,
                          display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left',
                          transition: 'all 0.2s ease',
                          transform: isHovered ? 'translateY(-3px) scale(1.03)' : 'none',
                          boxShadow: isHovered
                            ? (viewMode === 'twin' ? occ.glow : heat.glow)
                            : '0 1px 3px rgba(0,0,0,0.05)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 800, fontSize: 13, fontFamily: 'ui-monospace, SFMono-Regular, monospace', letterSpacing: '0.3px' }}>
                            {cell.locationCode}
                          </span>
                          {cell.isFrozen && <Lock style={{ width: 13, height: 13, color: '#e11d48' }} />}
                        </div>

                        {viewMode === 'twin' ? (
                          <>
                            <div style={{ fontSize: 11, fontWeight: 600, color: occ.text }}>
                              {cell.totalPhysical}/{cell.maxCapacity} • {cell.productsCount} SKU
                            </div>
                            <div style={{ width: '100%', height: 5, background: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{
                                width: `${cell.occupancyRate}%`, height: '100%', borderRadius: 3,
                                background: occ.text, transition: 'width 0.5s ease',
                              }} />
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, color: occ.text }}>{occ.label}</span>
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: 11, opacity: 0.9, fontWeight: 700 }}>
                              {cell.activityCount} lượt giao dịch
                            </div>
                            <div style={{ fontSize: 10, fontWeight: 800, opacity: 0.95, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              {heat.label}
                            </div>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Detail Modal ──────────────────────────────────────── */}
      {selectedCell && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
        }} onClick={() => { setSelectedCell(null); setCellDetails(null); }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: 560, background: '#fff', borderRadius: 22, padding: 28,
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', animation: 'modalIn 0.25s ease-out',
          }}>
            <style>{`@keyframes modalIn { from { opacity:0; transform: scale(0.95) translateY(10px); } to { opacity:1; transform: none; } }`}</style>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Eye style={{ width: 20, height: 20, color: '#fff' }} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#0f172a' }}>{selectedCell.locationCode}</h3>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                  {selectedCell.zone} • {selectedCell.rack} • {selectedCell.bin}
                  {selectedCell.isFrozen && <span style={{ marginLeft: 8, color: '#e11d48', fontWeight: 700 }}>🔒 Đóng băng</span>}
                </p>
              </div>
              <button onClick={() => { setSelectedCell(null); setCellDetails(null); }} style={{
                border: 'none', background: '#f1f5f9', borderRadius: 10, width: 36, height: 36,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <X style={{ width: 16, height: 16, color: '#64748b' }} />
              </button>
            </div>

            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 22 }}>
              {[
                { label: 'Tồn vật lý', value: selectedCell.totalPhysical, color: '#0f172a' },
                { label: 'Khả dụng', value: selectedCell.available, color: '#059669' },
                { label: 'Lấp đầy', value: `${selectedCell.occupancyRate}%`, color: '#6366f1' },
              ].map(s => (
                <div key={s.label} style={{
                  padding: 14, background: '#f8fafc', borderRadius: 14, border: '1px solid #e2e8f0', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Items Table */}
            <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Package style={{ width: 16, height: 16, color: '#6366f1' }} /> Hàng hóa lưu trữ
            </h4>
            {loadingDetails ? (
              <div style={{ padding: 28, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Đang tải...</div>
            ) : !cellDetails?.items || cellDetails.items.length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: '#94a3b8', fontSize: 13, background: '#f8fafc', borderRadius: 14 }}>
                Ô kho này đang trống — chưa có hàng hóa lưu trữ.
              </div>
            ) : (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>SKU</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Sản phẩm</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 800, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Tồn kho</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cellDetails.items.map((item: any) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: '#6366f1' }}>{item.sku}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{item.name}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: '#059669' }}>{item.totalPhysical}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
