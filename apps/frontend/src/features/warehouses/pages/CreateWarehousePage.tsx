import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building,
  Check,
  CheckCircle,
  ChevronRight,
  Cpu,
  Edit,
  Eye,
  Grid,
  Info,
  Layers,
  LayoutGrid,
  Lock,
  MapPin,
  Move3d,
  Package,
  Plus,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Save,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  Sliders,
  Snowflake,
  Sparkles,
  Store,
  Thermometer,
  Trash2,
  Warehouse,
  Zap,
} from 'lucide-react';
import Toast from '../../../shared/components/Toast';
import MainLayout from '../../../shared/components/MainLayout';
import {
  getStoredWarehouses,
  saveStoredWarehouses,
  upsertWarehouseToApi,
  normalizeWarehouseRecord,
  type WarehouseRecord,
  type SubWarehouse,
  type RackConfig,
  type CustomBinConfig,
} from '../../../shared/utils/warehouseAssignments';
import { VIETNAM_PROVINCES } from '../components/VietnamMapModal';
import Warehouse3DViewer from '../components/Warehouse3DViewer';
import {
  calculateAiSlottingRecommendations,
  generateWarehouseBinCells,
  type AiSlottingRecommendation,
  type BinCellInfo,
  type ProductSlotInput,
} from '../utils/aiSlottingEngine';

// Default generator for continuous longitudinal rack rows (Dãy Kệ Dọc Chạy Suốt Phân Khu)
function generateDefaultRacks(
  racksCount: number,
  zoneLength = 20,
  zoneHeight = 6,
  defaultBays = 6,
  defaultShelves = 5,
  defaultBinsPerShelf = 2
): RackConfig[] {
  const racks: RackConfig[] = [];
  const rackL = Math.max(zoneLength - 2, 4); // Chạy dọc gần suốt chiều dài phân khu (chừa 2m lối đi 2 đầu)
  const rackW = 1.2; // Rộng 1.2 mét
  const rackH = Math.max(zoneHeight - 1, 3); // Cao cách trần 1m

  // Kích thước ô tự động từ tổng vách khoang & vách ngang
  const totalLengthBins = defaultBays * defaultBinsPerShelf;
  const autoBinL = Math.round((rackL * 100) / totalLengthBins);
  const autoBinW = Math.round(rackW * 100);
  const autoBinH = Math.round((rackH * 100) / defaultShelves);

  for (let r = 1; r <= racksCount; r++) {
    const rCode = `R${String(r).padStart(2, '0')}`;
    racks.push({
      id: `rack-${r}`,
      rackCode: rCode,
      name: `Dãy Kệ Dọc Suốt Kho ${rCode}`,
      length: rackL,
      width: rackW,
      height: rackH,
      maxRackLoad: 16000, // kg (Dãy dọc chịu lực lớn)
      baysCount: defaultBays,
      horizontalPartitions: defaultShelves,
      verticalPartitions: defaultBinsPerShelf,
      columnsCount: defaultBays,
      shelvesCount: defaultShelves,
      binsPerShelf: defaultBinsPerShelf,
      defaultBinLength: autoBinL,
      defaultBinWidth: autoBinW,
      defaultBinHeight: autoBinH,
      defaultBinMaxWeight: 500,
      customBins: {},
    });
  }
  return racks;
}

export default function CreateWarehousePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id);

  // General Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [province, setProvince] = useState(VIETNAM_PROVINCES[0].name);
  const [ward, setWard] = useState(VIETNAM_PROVINCES[0].wards[0]);
  const [detailAddress, setDetailAddress] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  // Specs Kho Tổng
  const [length, setLength] = useState(50);
  const [width, setWidth] = useState(30);
  const [height, setHeight] = useState(12);

  // Subwarehouses / Zones list
  const [subWarehouses, setSubWarehouses] = useState<SubWarehouse[]>([]);
  const [activeZoneId, setActiveZoneId] = useState<string>('');
  const [activeRackId, setActiveRackId] = useState<string>('');

  // Auto calculation toggle mode
  const [isAutoCalcBin, setIsAutoCalcBin] = useState<boolean>(true);

  // UI Modes
  const [viewMode, setViewMode] = useState<'2D_MATRIX' | '3D_VIEW'>('2D_MATRIX');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Bin Edit Inspector Modal / Panel State
  const [editingBinCode, setEditingBinCode] = useState<string | null>(null);
  const [binCustomForm, setBinCustomForm] = useState<CustomBinConfig>({
    binCode: '',
    length: 120,
    width: 80,
    height: 100,
    maxWeight: 500,
  });

  // AI Slotting Simulator State
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [simProduct, setSimProduct] = useState<ProductSlotInput>({
    productName: 'Lô sản phẩm xuất khẩu',
    tempRequirement: 'AMBIENT',
    packageLength: 60,
    packageWidth: 40,
    packageHeight: 40,
    totalWeight: 100,
    turnoverClass: 'A',
  });
  const [aiRecommendations, setAiRecommendations] = useState<AiSlottingRecommendation[]>([]);

  // Load warehouse data if Edit Mode
  useEffect(() => {
    if (isEditMode && id) {
      const warehouses = getStoredWarehouses();
      const target = warehouses.find((w) => w.id === id);
      if (target) {
        const norm = normalizeWarehouseRecord(target);
        setCode(norm.code);
        setName(norm.name);
        setProvince(norm.province || VIETNAM_PROVINCES[0].name);
        setWard(norm.ward || VIETNAM_PROVINCES[0].wards[0]);
        setDetailAddress(norm.detailAddress || norm.address);
        setStatus(norm.status);
        setLength(norm.length || 50);
        setWidth(norm.width || 30);
        setHeight(norm.height || 12);

        const loadedZones = (norm.subWarehouses || []).map((z) => {
          const rks = z.racks && z.racks.length > 0
            ? z.racks
            : generateDefaultRacks(z.racksCount || 4, z.length || 20, z.height || 6, (z as any).columnsCount || 6, z.shelvesPerRack || 5, z.binsPerShelf || 2);
          return { ...z, racks: rks };
        });

        setSubWarehouses(loadedZones);
        if (loadedZones.length > 0) {
          setActiveZoneId(loadedZones[0].id);
          if (loadedZones[0].racks && loadedZones[0].racks.length > 0) {
            setActiveRackId(loadedZones[0].racks[0].id);
          }
        }
      }
    } else {
      // Default initial zones if new warehouse
      const defaultZones: SubWarehouse[] = [
        {
          id: `sub-${Date.now()}-1`,
          code: 'ZONE-A',
          name: 'Phân Khu Dãy Kệ Dọc A',
          zoneType: 'AMBIENT',
          status: 'active',
          length: 25,
          width: 15,
          height: 7,
          racksCount: 4,
          shelvesPerRack: 5,
          binsPerShelf: 2,
          maxWeightPerBin: 500,
          racks: generateDefaultRacks(4, 25, 7, 6, 5, 2),
        },
        {
          id: `sub-${Date.now()}-2`,
          code: 'ZONE-COLD',
          name: 'Phân Khu Kho Lạnh âm 18°C',
          zoneType: 'COLD',
          tempMin: -18,
          tempMax: 5,
          status: 'active',
          length: 20,
          width: 12,
          height: 6,
          racksCount: 3,
          shelvesPerRack: 4,
          binsPerShelf: 2,
          maxWeightPerBin: 600,
          racks: generateDefaultRacks(3, 20, 6, 5, 4, 2),
        },
      ];
      setSubWarehouses(defaultZones);
      setActiveZoneId(defaultZones[0].id);
      setActiveRackId(defaultZones[0].racks![0].id);
      setCode(`KH${Math.floor(100 + Math.random() * 900)}`);
      setName('Kho Hàng Dãy Kệ Dọc Suốt Kho');
    }
  }, [id, isEditMode]);

  // Active Zone reference
  const activeZone = subWarehouses.find((z) => z.id === activeZoneId) || subWarehouses[0];

  // Helper to parse inputs safely allowing 0 and empty backspace
  const parseNumInput = (valStr: string): number => {
    if (valStr === '') return 0;
    const num = Number(valStr);
    return isNaN(num) ? 0 : Math.max(0, num);
  };

  // Ensure racks exist in activeZone
  const activeRacks = activeZone?.racks && activeZone.racks.length > 0
    ? activeZone.racks
    : generateDefaultRacks(activeZone?.racksCount ?? 4, activeZone?.length || 20, activeZone?.height || 6, 6, activeZone?.shelvesPerRack ?? 5, activeZone?.binsPerShelf ?? 2);

  const activeRack = activeRacks.find((r) => r.id === activeRackId) || activeRacks[0];

  // Helper: Update active zone fields with auto-rack continuous length sync
  const updateActiveZone = (fields: Partial<SubWarehouse>) => {
    if (!activeZone) return;
    setSubWarehouses((prev) =>
      prev.map((z) => {
        if (z.id !== activeZone.id) return z;

        const nextLength = fields.length !== undefined ? fields.length : z.length;
        const nextHeight = fields.height !== undefined ? fields.height : z.height;
        const nextRacksCount = fields.racksCount !== undefined ? fields.racksCount : (z.racksCount ?? 4);
        const nextShelves = fields.shelvesPerRack !== undefined ? fields.shelvesPerRack : (z.shelvesPerRack ?? 5);
        const nextBinsPerShelf = fields.binsPerShelf !== undefined ? fields.binsPerShelf : (z.binsPerShelf ?? 2);

        // Auto update racks continuous row lengths to match zone length
        const updatedRacks = generateDefaultRacks(nextRacksCount, nextLength, nextHeight, 6, nextShelves, nextBinsPerShelf);

        return {
          ...z,
          ...fields,
          racksCount: nextRacksCount,
          shelvesPerRack: nextShelves,
          binsPerShelf: nextBinsPerShelf,
          racks: updatedRacks
        };
      })
    );
  };

  // Helper: Update specific rack fields with Auto-Volume computation
  const updateActiveRack = (fields: Partial<RackConfig>) => {
    if (!activeZone || !activeRack) return;

    setSubWarehouses((prev) =>
      prev.map((z) => {
        if (z.id !== activeZone.id) return z;

        const updatedRacks = (z.racks || activeRacks).map((r) => {
          if (r.id !== activeRack.id) return r;

          const merged: RackConfig = { ...r, ...fields };

          const bays = merged.baysCount || merged.columnsCount || 6;
          const shelves = merged.horizontalPartitions || merged.shelvesCount || 5;
          const binsPerShelf = merged.verticalPartitions || merged.binsPerShelf || 2;

          merged.baysCount = bays;
          merged.columnsCount = bays;
          merged.horizontalPartitions = shelves;
          merged.shelvesCount = shelves;
          merged.verticalPartitions = binsPerShelf;
          merged.binsPerShelf = binsPerShelf;

          // Auto recalculate individual bin dimensions for continuous row
          if (isAutoCalcBin) {
            const totalLenBins = bays * binsPerShelf;
            merged.defaultBinLength = Math.round((merged.length * 100) / totalLenBins);
            merged.defaultBinWidth = Math.round(merged.width * 100);
            merged.defaultBinHeight = Math.round((merged.height * 100) / shelves);
          }

          return merged;
        });

        return { ...z, racks: updatedRacks };
      })
    );
  };

  // Helper: Custom Bin edit update
  const handleSaveCustomBin = (applyTo: 'SINGLE' | 'SHELF' | 'RACK') => {
    if (!activeZone || !activeRack || !binCustomForm.binCode) return;

    setSubWarehouses((prev) =>
      prev.map((z) => {
        if (z.id !== activeZone.id) return z;

        const updatedRacks = (z.racks || activeRacks).map((r) => {
          if (r.id !== activeRack.id) return r;

          const currentCustom = { ...(r.customBins || {}) };

          if (applyTo === 'SINGLE') {
            currentCustom[binCustomForm.binCode] = { ...binCustomForm };
          } else if (applyTo === 'SHELF') {
            const bays = r.baysCount || 1;
            for (let b = 1; b <= bays; b++) {
              const bayCode = bays > 1 ? `B${String(b).padStart(2, '0')}-` : '';
              const parts = binCustomForm.binCode.split('-');
              const shelfCode = parts[parts.length - 2] || 'S01';
              for (let c = 1; c <= r.binsPerShelf; c++) {
                const code = `${z.code}-${r.rackCode}-${bayCode}${shelfCode}-C${String(c).padStart(2, '0')}`;
                currentCustom[code] = {
                  ...binCustomForm,
                  binCode: code,
                };
              }
            }
          } else if (applyTo === 'RACK') {
            const bays = r.baysCount || 1;
            for (let b = 1; b <= bays; b++) {
              const bayCode = bays > 1 ? `B${String(b).padStart(2, '0')}-` : '';
              for (let s = 1; s <= r.shelvesCount; s++) {
                for (let c = 1; c <= r.binsPerShelf; c++) {
                  const code = `${z.code}-${r.rackCode}-${bayCode}S${String(s).padStart(2, '0')}-C${String(c).padStart(2, '0')}`;
                  currentCustom[code] = {
                    ...binCustomForm,
                    binCode: code,
                  };
                }
              }
            }
          }

          return { ...r, customBins: currentCustom };
        });

        return { ...z, racks: updatedRacks };
      })
    );

    setSuccess(`Đã cập nhật kích thước & trọng tải cho ô ${binCustomForm.binCode}!`);
    setEditingBinCode(null);
  };

  // Add new Zone
  const handleAddZone = (zoneType: 'AMBIENT' | 'COLD' | 'THERMAL' = 'AMBIENT') => {
    const nextIndex = subWarehouses.length + 1;
    const newId = `zone-${Date.now()}`;
    const codePrefix = zoneType === 'COLD' ? 'COLD' : zoneType === 'THERMAL' ? 'THERM' : 'ZONE';
    const newZone: SubWarehouse = {
      id: newId,
      code: `${codePrefix}-${String.fromCharCode(64 + nextIndex)}`,
      name: `Phân Khu ${zoneType === 'COLD' ? 'Kho Lạnh' : zoneType === 'THERMAL' ? 'Kho Nhiệt' : 'Kho Thường'} ${nextIndex}`,
      zoneType,
      tempMin: zoneType === 'COLD' ? -18 : zoneType === 'THERMAL' ? 15 : 20,
      tempMax: zoneType === 'COLD' ? 5 : zoneType === 'THERMAL' ? 22 : 35,
      status: 'active',
      length: 20,
      width: 12,
      height: 6,
      racksCount: 4,
      shelvesPerRack: 5,
      binsPerShelf: 2,
      maxWeightPerBin: zoneType === 'COLD' ? 600 : 500,
      racks: generateDefaultRacks(4, 20, 6, 6, 5, 2),
    };
    setSubWarehouses((prev) => [...prev, newZone]);
    setActiveZoneId(newId);
    setActiveRackId(newZone.racks![0].id);
    setSuccess(`Đã tạo phân khu mới: ${newZone.name}`);
  };

  // Delete Zone
  const handleDeleteZone = (zoneId: string) => {
    if (subWarehouses.length <= 1) {
      setError('Kho hàng phải chứa ít nhất 1 Phân Khu.');
      return;
    }
    const filtered = subWarehouses.filter((z) => z.id !== zoneId);
    setSubWarehouses(filtered);
    if (activeZoneId === zoneId) {
      setActiveZoneId(filtered[0].id);
    }
  };

  // Run AI Slotting Engine simulation
  const handleRunAiSlotting = () => {
    const fullTempRecord: WarehouseRecord = normalizeWarehouseRecord({
      id: id || 'temp',
      code: code || 'TEMP',
      name: name || 'Kho Hàng',
      address: [detailAddress, ward, province].filter(Boolean).join(', '),
      status,
      length,
      width,
      height,
      subWarehouses,
      managerIds: [],
      staffIds: [],
    });

    const allBins = generateWarehouseBinCells(fullTempRecord);
    const recs = calculateAiSlottingRecommendations(simProduct, allBins);
    setAiRecommendations(recs);
    setSuccess(`AI Slotting đã phân tích xong! Tìm thấy ${recs.length} vị trí ô/ngăn phù hợp.`);
  };

  // Save Warehouse Form
  const handleSaveWarehouse = async () => {
    if (!code.trim() || !name.trim()) {
      setError('Vui lòng nhập mã kho và tên kho.');
      return;
    }

    setSaving(true);
    setError('');

    const fullAddress = [detailAddress, ward, province].filter(Boolean).join(', ');

    const payload: WarehouseRecord = normalizeWarehouseRecord({
      id: id || crypto.randomUUID(),
      code: code.trim().toUpperCase(),
      name: name.trim(),
      address: fullAddress,
      province,
      ward,
      detailAddress,
      status,
      length,
      width,
      height,
      totalArea: length * width,
      totalVolume: length * width * height,
      subWarehouses,
      managerIds: [],
      staffIds: [],
    });

    try {
      await upsertWarehouseToApi(payload, isEditMode ? undefined : 'POST');
      const existing = getStoredWarehouses();
      const updated = existing.some((w) => w.id === payload.id)
        ? existing.map((w) => (w.id === payload.id ? payload : w))
        : [...existing, payload];
      saveStoredWarehouses(updated);

      setSuccess('Đã lưu cấu hình Kho Hàng, Phân Khu & Dãy Kệ Dọc Suốt Kho thành công!');
      setTimeout(() => {
        navigate('/warehouses');
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu thông tin kho hàng');
    } finally {
      setSaving(false);
    }
  };

  // Auto Volume Computations
  const rackGrossVolume = activeRack ? activeRack.length * activeRack.width * activeRack.height : 0;
  const singleBinVolCm3 = activeRack ? activeRack.defaultBinLength * activeRack.defaultBinWidth * activeRack.defaultBinHeight : 0;
  const singleBinVolM3 = singleBinVolCm3 / 1000000;
  const totalBays = activeRack ? activeRack.baysCount || 1 : 1;
  const totalBinsCount = activeRack ? totalBays * activeRack.shelvesCount * activeRack.binsPerShelf : 0;
  const rackNetUsableVolumeM3 = (singleBinVolM3 * totalBinsCount).toFixed(2);

  // Generate bins for active zone matrix rendering
  const activeZoneBins = activeZone
    ? generateWarehouseBinCells(
        normalizeWarehouseRecord({
          id: 'temp',
          code: code || 'TEMP',
          name: name || 'Kho',
          address: '',
          status: 'active',
          managerIds: [],
          staffIds: [],
          subWarehouses: [activeZone],
        })
      )
    : [];

  const recBinCodeMap = new Map(aiRecommendations.map((r) => [r.bin.binCode, r]));

  return (
    <MainLayout>
      <div className="space-y-6 font-sans text-slate-800 antialiased pb-12">
        <Toast
          message={error || success}
          type={error ? 'error' : 'success'}
          onClose={() => {
            setError('');
            setSuccess('');
          }}
        />

        {/* HEADER BAR */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/warehouses')}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 transition text-slate-600 dark:text-slate-200 cursor-pointer"
              title="Quay lại danh sách kho"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-xs text-cyan-600 font-bold uppercase tracking-wider mb-1">
                <span>QUẢN LÝ KHO</span>
                <ChevronRight className="h-3 w-3" />
                <span>CẤU HÌNH DÃY KỆ DỌC SUỐT KHO & TÍNH THỂ TÍCH TỰ ĐỘNG</span>
              </div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Warehouse className="h-6 w-6 text-cyan-600" />
                {isEditMode ? `CHỈNH SỬA KHO: ${name || code}` : 'TẠO MỚI KHO HÀNG & DÃY KỆ DỌC SUỐT KHO'}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Switcher */}
            <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('2D_MATRIX')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
                  viewMode === '2D_MATRIX'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Grid className="h-4 w-4" />
                Ma Trận 2D Excel Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('3D_VIEW')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
                  viewMode === '3D_VIEW'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Move3d className="h-4 w-4" />
                Mô Phỏng 3D
              </button>
            </div>

            {/* AI Slotting Toggle */}
            <button
              type="button"
              onClick={() => setIsAiPanelOpen(!isAiPanelOpen)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-black transition cursor-pointer ${
                isAiPanelOpen
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                  : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
              }`}
            >
              <Sparkles className="h-4 w-4 text-amber-600" />
              {isAiPanelOpen ? 'Ẩn AI Slotting' : 'Thử Nghiệm AI Slotting'}
            </button>

            {/* Save Button */}
            <button
              type="button"
              onClick={handleSaveWarehouse}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black shadow-lg shadow-cyan-600/30 transition cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Đang Lưu...' : 'LƯU CẤU HÌNH KHO & PHÂN KHU'}
            </button>
          </div>
        </div>

        {/* AI SLOTTING SIMULATOR WIDGET (IF OPEN) */}
        {isAiPanelOpen && (
          <div className="bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 text-white p-6 rounded-2xl border-2 border-amber-400 shadow-2xl space-y-4 animate-in slide-in-from-top-4">
            <div className="flex items-center justify-between border-b border-cyan-800/60 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-400 text-slate-950 font-black">
                  <Cpu className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-amber-400 flex items-center gap-2">
                    BÀI TOÁN AI GỢI Ý VỊ TRÍ XẾP HÀNG (3D SLOTTING ENGINE)
                  </h3>
                  <p className="text-xs text-slate-300">
                    Thuật toán Constraint Satisfaction (CSP) + Multi-Criteria Utility Scoring tự động tìm ô/ngăn tối ưu cho Đơn Nhập Kho
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunAiSlotting}
                className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl font-black text-xs shadow-md transition flex items-center gap-2 cursor-pointer"
              >
                <Zap className="h-4 w-4 fill-slate-950" />
                CHẠY AI PHÂN TÍCH VỊ TRÍ
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Mặt hàng thử nghiệm</label>
                <input
                  type="text"
                  value={simProduct.productName}
                  onChange={(e) => setSimProduct({ ...simProduct, productName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Loại Môi Trường</label>
                <select
                  value={simProduct.tempRequirement}
                  onChange={(e) => setSimProduct({ ...simProduct, tempRequirement: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-amber-300 font-bold"
                >
                  <option value="COLD">❄️ Kho Lạnh (-18°C ~ 5°C)</option>
                  <option value="THERMAL">🌡️ Kho Nhiệt (15°C ~ 22°C)</option>
                  <option value="AMBIENT">📦 Kho Thường (20°C ~ 35°C)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Tổng Trọng Lượng (kg)</label>
                <input
                  type="number"
                  value={simProduct.totalWeight}
                  onChange={(e) => setSimProduct({ ...simProduct, totalWeight: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Kích Thước Thùng (D x R x C cm)</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={simProduct.packageLength}
                    onChange={(e) => setSimProduct({ ...simProduct, packageLength: Number(e.target.value) || 0 })}
                    className="w-1/3 px-2 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-center font-semibold"
                    placeholder="D"
                  />
                  <input
                    type="number"
                    value={simProduct.packageWidth}
                    onChange={(e) => setSimProduct({ ...simProduct, packageWidth: Number(e.target.value) || 0 })}
                    className="w-1/3 px-2 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-center font-semibold"
                    placeholder="R"
                  />
                  <input
                    type="number"
                    value={simProduct.packageHeight}
                    onChange={(e) => setSimProduct({ ...simProduct, packageHeight: Number(e.target.value) || 0 })}
                    className="w-1/3 px-2 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-center font-semibold"
                    placeholder="C"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Tần Suất Bán (ABC)</label>
                <select
                  value={simProduct.turnoverClass}
                  onChange={(e) => setSimProduct({ ...simProduct, turnoverClass: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-emerald-400 font-bold"
                >
                  <option value="A">Loại A (Bán rất nhanh - Gần cửa)</option>
                  <option value="B">Loại B (Trung bình)</option>
                  <option value="C">Loại C (Bán chậm - Tầng trên)</option>
                </select>
              </div>

              <div className="flex items-end">
                <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700 text-[11px] text-slate-300 w-full text-center font-bold">
                  {aiRecommendations.length > 0
                    ? `Top 1: ${aiRecommendations[0]?.bin.binCode} (${aiRecommendations[0]?.score}%)`
                    : 'Chưa có kết quả gợi ý'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MAIN SPLIT LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT 5 COLS: MASTER SPECS, ZONE BUILDER & LONGITUDINAL RACK SPECS */}
          <div className="lg:col-span-5 space-y-6">
            {/* THÔNG TIN TỔNG QUAN KHO */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Building className="h-4 w-4 text-cyan-600" />
                  1. THÔNG SỐ KHO TỔNG
                </h2>
                <span className="text-xs px-2.5 py-1 rounded-full font-extrabold bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                  {subWarehouses.length} Phân Khu
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Mã Kho Hàng *</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="VD: KH001"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Trạng Thái Kho</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="active">🟢 Đang hoạt động</option>
                    <option value="inactive">🔴 Tạm dừng</option>
                  </select>
                </div>
              </div>

              <div className="text-xs">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tên Kho Hàng *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Kho Kệ Dọc Suốt Kho"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tỉnh / Thành Phố</label>
                  <select
                    value={province}
                    onChange={(e) => {
                      setProvince(e.target.value);
                      const targetProv = VIETNAM_PROVINCES.find((p) => p.name === e.target.value);
                      if (targetProv && targetProv.wards.length > 0) {
                        setWard(targetProv.wards[0]);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {VIETNAM_PROVINCES.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Phường / Xã</label>
                  <select
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {(VIETNAM_PROVINCES.find((p) => p.name === province)?.wards || []).map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="text-xs">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Địa chỉ chi tiết</label>
                <input
                  type="text"
                  value={detailAddress}
                  onChange={(e) => setDetailAddress(e.target.value)}
                  placeholder="VD: Số 100 Đại Lộ Bình Dương"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              {/* TỔNG KÍCH THƯỚC KHO */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <span className="font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider block">
                  KÍCH THƯỚC PHỦ BÌ KHO TỔNG (MÉT)
                </span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Dài (m)</span>
                    <input
                      type="number"
                      value={length}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setLength(val);
                        if (activeZone) updateActiveZone({ length: val });
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-center"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Rộng (m)</span>
                    <input
                      type="number"
                      value={width}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setWidth(val);
                        if (activeZone) updateActiveZone({ width: val });
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-center"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Cao (m)</span>
                    <input
                      type="number"
                      value={height}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setHeight(val);
                        if (activeZone) updateActiveZone({ height: val });
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-center"
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center pt-1 text-[11px] font-extrabold text-cyan-700 dark:text-cyan-400">
                  <span>Diện tích: {length * width} m²</span>
                  <span>Thể tích kho: {(length * width * height).toLocaleString()} m³</span>
                </div>
              </div>
            </div>

            {/* DANH SÁCH PHÂN KHU & CẤU HÌNH PHÂN KHU */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Layers className="h-4 w-4 text-cyan-600" />
                  2. CẤU HÌNH PHÂN KHU (ZONES)
                </h2>

                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAddZone('AMBIENT')}
                    className="px-2.5 py-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-700 text-[11px] font-bold border border-cyan-200 transition cursor-pointer"
                  >
                    + Kho Thường
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddZone('COLD')}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold border border-blue-200 transition cursor-pointer flex items-center gap-1"
                  >
                    <Snowflake className="h-3 w-3" />
                    + Kho Lạnh
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddZone('THERMAL')}
                    className="px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold border border-purple-200 transition cursor-pointer flex items-center gap-1"
                  >
                    <Thermometer className="h-3 w-3" />
                    + Kho Nhiệt
                  </button>
                </div>
              </div>

              {/* TABS SELECTOR FOR ZONES */}
              <div className="flex flex-wrap gap-2">
                {subWarehouses.map((z) => {
                  const isActive = z.id === activeZoneId;
                  const isCold = z.zoneType === 'COLD';
                  const isThermal = z.zoneType === 'THERMAL';
                  return (
                    <button
                      key={z.id}
                      type="button"
                      onClick={() => {
                        setActiveZoneId(z.id);
                        if (z.racks && z.racks.length > 0) {
                          setActiveRackId(z.racks[0].id);
                        }
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                        isActive
                          ? isCold
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                            : isThermal
                              ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                              : 'bg-cyan-600 text-white border-cyan-600 shadow-md'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {isCold ? (
                        <Snowflake className="h-3.5 w-3.5" />
                      ) : isThermal ? (
                        <Thermometer className="h-3.5 w-3.5" />
                      ) : (
                        <Store className="h-3.5 w-3.5" />
                      )}
                      <span>{z.code}</span>
                      {subWarehouses.length > 1 && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteZone(z.id);
                          }}
                          className="ml-1 text-xs hover:text-red-300 transition p-0.5"
                          title="Xóa phân khu"
                        >
                          ✕
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* ACTIVE ZONE DETAIL EDITOR */}
              {activeZone && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4 text-xs">
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                    <span className="font-extrabold text-slate-900 dark:text-white uppercase">
                      KÍCH THƯỚC PHÂN KHU: {activeZone.code}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        activeZone.zoneType === 'COLD'
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : activeZone.zoneType === 'THERMAL'
                            ? 'bg-purple-100 text-purple-800 border border-purple-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}
                    >
                      {activeZone.zoneType === 'COLD'
                        ? 'Kho Lạnh (-18°C ~ 5°C)'
                        : activeZone.zoneType === 'THERMAL'
                          ? 'Kho Nhiệt (15°C ~ 22°C)'
                          : 'Kho Thường Tiêu Chuẩn'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Mã Phân Khu</label>
                      <input
                        type="text"
                        value={activeZone.code}
                        onChange={(e) => updateActiveZone({ code: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tên Phân Khu</label>
                      <input
                        type="text"
                        value={activeZone.name}
                        onChange={(e) => updateActiveZone({ name: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>

                  {/* KÍCH THƯỚC PHÂN KHU, SỐ DÃY DỌC & SỐ VÁCH NGĂN */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Chiều Dài (m)</label>
                      <input
                        type="number"
                        min={0}
                        value={activeZone.length}
                        onChange={(e) => updateActiveZone({ length: parseNumInput(e.target.value) })}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-center"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Chiều Rộng (m)</label>
                      <input
                        type="number"
                        min={0}
                        value={activeZone.width}
                        onChange={(e) => updateActiveZone({ width: parseNumInput(e.target.value) })}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-center"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Chiều Cao (m)</label>
                      <input
                        type="number"
                        min={0}
                        value={activeZone.height}
                        onChange={(e) => updateActiveZone({ height: parseNumInput(e.target.value) })}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-center"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Số Dãy Dọc</label>
                      <input
                        type="number"
                        min={0}
                        value={activeZone.racksCount ?? 4}
                        onChange={(e) => updateActiveZone({ racksCount: parseNumInput(e.target.value) })}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-black bg-white dark:bg-slate-900 text-center text-cyan-600"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Số Vách Ngang</label>
                      <input
                        type="number"
                        min={0}
                        value={activeZone.shelvesPerRack ?? 5}
                        onChange={(e) => updateActiveZone({ shelvesPerRack: parseNumInput(e.target.value) })}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-black bg-white dark:bg-slate-900 text-center text-indigo-600"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Số Vách Dọc</label>
                      <input
                        type="number"
                        min={0}
                        value={activeZone.binsPerShelf ?? 2}
                        onChange={(e) => updateActiveZone({ binsPerShelf: parseNumInput(e.target.value) })}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-black bg-white dark:bg-slate-900 text-center text-amber-600"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. THÔNG SỐ CHI TIẾT DÃY KỆ DỌC SUỐT KHO & TÍNH THỂ TÍCH TỰ ĐỘNG */}
            {activeZone && activeRack && (
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border-2 border-cyan-500 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-cyan-600" />
                    3. CẤU HÌNH DÃY KỆ DỌC SUỐT KHO & THỂ TÍCH
                  </h2>

                  {/* RACK SELECTOR TABS */}
                  <div className="flex items-center gap-1.5">
                    {activeRacks.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setActiveRackId(r.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer border ${
                          r.id === activeRack.id
                            ? 'bg-cyan-600 text-white border-cyan-600 shadow'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {r.rackCode}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-4 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-cyan-700 dark:text-cyan-400 uppercase text-xs flex items-center gap-1.5">
                      <LayoutGrid className="h-4 w-4" />
                      DÃY KỆ DỌC CONTINUOUS ROW: {activeRack.rackCode} ({activeRack.name})
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">
                      Tải trọng max cả dãy dọc: {activeRack.maxRackLoad.toLocaleString()} kg
                    </span>
                  </div>

                  {/* KÍCH THƯỚC PHỦ BÌ DÃY KỆ DỌC RUNNING LENGTH */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Chiều Dài Dãy Dọc (mét)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={activeRack.length}
                        onChange={(e) => updateActiveRack({ length: Number(e.target.value) || 1 })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold text-center bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Chiều Rộng Dãy (mét)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={activeRack.width}
                        onChange={(e) => updateActiveRack({ width: Number(e.target.value) || 0.5 })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold text-center bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Chiều Cao Dãy (mét)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={activeRack.height}
                        onChange={(e) => updateActiveRack({ height: Number(e.target.value) || 1 })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold text-center bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Sức Chịu Lực Max (kg)
                      </label>
                      <input
                        type="number"
                        value={activeRack.maxRackLoad}
                        onChange={(e) => updateActiveRack({ maxRackLoad: Number(e.target.value) || 1000 })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-black text-center text-amber-600 bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>

                  {/* SỐ KHOANG KỆ NỐI TIẾP DỌC DÃY, SỐ VÁCH NGANG & SỐ VÁCH DỌC */}
                  <div className="p-3.5 rounded-xl bg-cyan-50/70 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/60 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-extrabold text-cyan-900 dark:text-cyan-200 uppercase text-[11px] flex items-center gap-1.5">
                        <Sliders className="h-3.5 w-3.5 text-cyan-600" />
                        CẤU TRÚC KHOANG KỆ & VÁCH NGĂN TRÊN DÃY KỆ DỌC
                      </span>

                      <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-cyan-800 dark:text-cyan-300">
                        <input
                          type="checkbox"
                          checked={isAutoCalcBin}
                          onChange={(e) => setIsAutoCalcBin(e.target.checked)}
                          className="h-4 w-4 rounded text-cyan-600"
                        />
                        Tự động tính kích thước ô từ Vách Ngăn
                      </label>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                          1. Số Khoang Dọc (Bays)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={30}
                          value={activeRack.baysCount ?? 6}
                          onChange={(e) => updateActiveRack({ baysCount: parseNumInput(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl border border-cyan-300 dark:border-cyan-700 font-black text-center text-cyan-700 bg-white dark:bg-slate-900 text-sm"
                        />
                        <span className="text-[10px] text-slate-500 block text-center mt-1">Các khoang nối đuôi nhau</span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                          2. Số Vách Ngang (Shelves)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={activeRack.horizontalPartitions ?? 5}
                          onChange={(e) => {
                            const val = parseNumInput(e.target.value);
                            updateActiveRack({ horizontalPartitions: val, shelvesCount: val });
                            updateActiveZone({ shelvesPerRack: val });
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-cyan-300 dark:border-cyan-700 font-black text-center text-cyan-700 bg-white dark:bg-slate-900 text-sm"
                        />
                        <span className="text-[10px] text-slate-500 block text-center mt-1">Số tầng đỡ nằm ngang</span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                          3. Số Vách Dọc / Tầng (Bins)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={activeRack.verticalPartitions ?? 2}
                          onChange={(e) => {
                            const val = parseNumInput(e.target.value);
                            updateActiveRack({ verticalPartitions: val, binsPerShelf: val });
                            updateActiveZone({ binsPerShelf: val });
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-cyan-300 dark:border-cyan-700 font-black text-center text-cyan-700 bg-white dark:bg-slate-900 text-sm"
                        />
                        <span className="text-[10px] text-slate-500 block text-center mt-1">Số hộc chứa trong 1 tầng</span>
                      </div>
                    </div>
                  </div>

                  {/* KẾT QUẢ TÍNH THỂ TÍCH TỰ ĐỘNG */}
                  <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2 text-[11px]">
                    <span className="font-extrabold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider block">
                      ⚡ THỂ TÍCH CHỨA HÀNG TỰ ĐỘNG CỦA DÃY KỆ DỌC
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <span className="text-slate-500 block font-medium">Thẻ Tích Phủ Bì Dãy Dọc</span>
                        <span className="font-black text-slate-900 dark:text-white text-xs">{rackGrossVolume.toFixed(2)} m³</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block font-medium">Kích Thước 1 Hộc (Tự động)</span>
                        <span className="font-black text-cyan-700 dark:text-cyan-400 text-xs">
                          {activeRack.defaultBinLength} x {activeRack.defaultBinWidth} x {activeRack.defaultBinHeight} cm
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block font-medium">Thể Tích 1 Hộc Chứa</span>
                        <span className="font-black text-emerald-700 dark:text-emerald-400 text-xs">
                          {singleBinVolM3.toFixed(3)} m³ ({singleBinVolCm3.toLocaleString()} cm³)
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block font-medium">Tổng Thể Tích Chứa Hàng</span>
                        <span className="font-black text-amber-600 text-xs">{rackNetUsableVolumeM3} m³ ({totalBinsCount} Hộc)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT 7 COLS: VISUALIZATION (2D EXCEL MATRIX GRID / 3D MODEL) FOR CONTINUOUS LONGITUDINAL RACKS */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 min-h-[600px]">
              <div className="flex flex-wrap items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    {viewMode === '2D_MATRIX' ? (
                      <>
                        <Grid className="h-4 w-4 text-cyan-600" />
                        SƠ ĐỒ SỰ NỐI TIẾP DÃY KỆ DỌC SUỐT KHO (2D LONGITUDINAL RACK ROWS)
                      </>
                    ) : (
                      <>
                        <Move3d className="h-4 w-4 text-cyan-600" />
                        MÔ PHỎNG KHỐI KỆ 3D ISOMETRIC
                      </>
                    )}
                  </h2>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 font-bold text-emerald-600">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span> Trống
                  </span>
                  <span className="flex items-center gap-1 font-bold text-amber-600">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span> Một phần
                  </span>
                  <span className="flex items-center gap-1 font-bold text-red-600">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span> Đầy
                  </span>
                  {aiRecommendations.length > 0 && (
                    <span className="flex items-center gap-1 font-black text-cyan-600 animate-pulse">
                      <Sparkles className="h-3.5 w-3.5 text-cyan-500" /> Gợi ý AI
                    </span>
                  )}
                </div>
              </div>

              {/* 2D MATRIX LONGITUDINAL CONTINUOUS RACK VIEW MODE */}
              {viewMode === '2D_MATRIX' && activeZone && activeRack && (
                <div className="space-y-5">
                  {/* RACK BANNER SPECS SUMMARY */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950 via-slate-900 to-blue-950 text-white shadow-lg border border-blue-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-black text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                        <Warehouse className="h-4 w-4 text-cyan-400" />
                        KẾT CẤU DÃY KỆ DỌC SUỐT PHÂN KHU: {activeRack.rackCode} ({activeRack.name})
                      </span>
                      <span className="px-3 py-1 rounded-full bg-amber-400 text-slate-950 font-black text-xs">
                        {totalBinsCount} Ô Hộc Chứa
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-xs text-slate-300 pt-1">
                      <div>Chiều dài dãy dọc: <b className="text-white">{activeRack.length}m</b> (kéo từ đầu đến cuối kho)</div>
                      <div>Chuỗi Khoang Kệ: <b className="text-amber-300">{totalBays} Khoang Bay Nối Tiếp</b></div>
                      <div>Thể tích chứa thực tế: <b className="text-emerald-400">{rackNetUsableVolumeM3} m³</b></div>
                    </div>
                  </div>

                  {/* VISUAL INDUSTRIAL BLUE/ORANGE RACK FRAME SIMULATION FOR LONGITUDINAL BAYS */}
                  <div className="p-4 rounded-2xl border-4 border-blue-700 bg-slate-950 shadow-2xl space-y-4 overflow-x-auto">
                    <div className="text-center text-xs font-black text-blue-400 uppercase tracking-widest border-b border-blue-800/80 pb-2">
                      SƠ ĐỒ CHUYỂN TIẾP CÁC KHOANG KỆ DỌC (BAYS B01 ➔ B{String(totalBays).padStart(2, '0')}) NỐI LIỀN SUỐT CHIỀU DÀI DÃY {activeRack.rackCode}
                    </div>

                    {/* BAYS RENDERED SIDE BY SIDE ALONG THE LONGITUDINAL ROW */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Array.from({ length: totalBays }).map((_, bIdx) => {
                        const bayNum = bIdx + 1;
                        const bayCode = `B${String(bayNum).padStart(2, '0')}`;

                        return (
                          <div key={bayCode} className="p-3 rounded-xl bg-slate-900 border-2 border-blue-900 space-y-2">
                            <div className="flex justify-between items-center px-2 py-1 bg-blue-950 rounded-lg border border-blue-800 text-[11px] font-black text-cyan-400">
                              <span>KHOANG KỆ DỌC #{bayNum}: {bayCode}</span>
                              <span className="text-slate-400 font-semibold">{activeRack.shelvesCount} Tầng Hàng</span>
                            </div>

                            {/* SHELVES IN THIS BAY */}
                            <div className="space-y-2">
                              {Array.from({ length: activeRack.shelvesCount })
                                .map((_, sIdx) => activeRack.shelvesCount - sIdx)
                                .map((shelfLevel) => {
                                  const shelfCode = `S${String(shelfLevel).padStart(2, '0')}`;

                                  return (
                                    <div key={shelfCode} className="space-y-1">
                                      {/* ORANGE BEAM LAYER */}
                                      <div className="bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600 px-2 py-0.5 text-slate-950 font-black text-[10px] rounded flex justify-between">
                                        <span>TẦNG {shelfLevel} ({shelfCode})</span>
                                        <span>{activeRack.binsPerShelf} Ô/Tầng</span>
                                      </div>

                                      {/* BINS GRID IN THIS SHELF OF THIS BAY */}
                                      <div className="grid grid-cols-2 gap-1.5">
                                        {Array.from({ length: activeRack.binsPerShelf }).map((_, cIdx) => {
                                          const cellNum = cIdx + 1;
                                          const cellCode = `C${String(cellNum).padStart(2, '0')}`;
                                          const fullCode = `${activeZone.code}-${activeRack.rackCode}-${totalBays > 1 ? `${bayCode}-` : ''}${shelfCode}-${cellCode}`;

                                          const custom = activeRack.customBins?.[fullCode];

                                          const binData = activeZoneBins.find((b) => b.binCode === fullCode) || {
                                            binCode: fullCode,
                                            zoneId: activeZone.id,
                                            zoneCode: activeZone.code,
                                            zoneName: activeZone.name,
                                            zoneType: activeZone.zoneType || 'AMBIENT',
                                            rackNumber: parseInt(activeRack.rackCode.replace('R', ''), 10) || 1,
                                            shelfLevel,
                                            cellIndex: cellNum,
                                            cellLength: custom?.length || activeRack.defaultBinLength,
                                            cellWidth: custom?.width || activeRack.defaultBinWidth,
                                            cellHeight: custom?.height || activeRack.defaultBinHeight,
                                            maxWeightCapacity: custom?.maxWeight || activeRack.defaultBinMaxWeight,
                                            currentWeight: 0,
                                            status: 'EMPTY',
                                          };

                                          const aiRec = recBinCodeMap.get(fullCode);
                                          const binVolM3 = ((binData.cellLength * binData.cellWidth * binData.cellHeight) / 1000000).toFixed(3);

                                          return (
                                            <div
                                              key={fullCode}
                                              onClick={() => {
                                                setEditingBinCode(fullCode);
                                                setBinCustomForm({
                                                  binCode: fullCode,
                                                  length: binData.cellLength,
                                                  width: binData.cellWidth,
                                                  height: binData.cellHeight,
                                                  maxWeight: binData.maxWeightCapacity,
                                                });
                                              }}
                                              className={`p-2 rounded-lg border-2 transition cursor-pointer relative flex flex-col justify-between h-24 ${
                                                aiRec
                                                  ? 'border-cyan-400 bg-cyan-950 shadow-lg ring-2 ring-cyan-400'
                                                  : custom
                                                    ? 'border-purple-400 bg-purple-950/60'
                                                    : binData.status === 'FULL'
                                                      ? 'border-red-500 bg-red-950/60'
                                                      : binData.status === 'PARTIAL'
                                                        ? 'border-amber-400 bg-amber-950/60'
                                                        : 'border-amber-700/60 bg-amber-900/20 hover:border-amber-400'
                                              }`}
                                            >
                                              {/* AI BADGE */}
                                              {aiRec && (
                                                <span className="absolute -top-2 -right-1 px-1 rounded bg-cyan-400 text-slate-950 text-[8px] font-black">
                                                  {aiRec.score}% AI
                                                </span>
                                              )}

                                              <div className="flex justify-between items-center">
                                                <span className="text-[9px] font-black text-amber-300 font-mono truncate">
                                                  {fullCode}
                                                </span>
                                                <span
                                                  className={`h-2 w-2 rounded-full ${
                                                    binData.status === 'FULL'
                                                      ? 'bg-red-500'
                                                      : binData.status === 'PARTIAL'
                                                        ? 'bg-amber-500'
                                                        : 'bg-emerald-400'
                                                  }`}
                                                />
                                              </div>

                                              <div className="text-[9px] text-slate-300 font-semibold space-y-0.5">
                                                <div>{binData.cellLength}x{binData.cellWidth}x{binData.cellHeight} cm</div>
                                                <div className="text-emerald-400 font-bold">{binVolM3} m³</div>
                                                <div className="text-amber-400 font-bold">Max: {binData.maxWeightCapacity}kg</div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* 3D VIEW MODE */}
              {viewMode === '3D_VIEW' && activeZone && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-extrabold text-slate-800 dark:text-white uppercase">
                      MÔ PHỎNG 3D KHÔNG GIAN KHO & DÃY KỆ DỌC (REALTIME 3D)
                    </span>
                    <span className="text-slate-500">Xoay 360° & Phóng to thu nhỏ để xem kết cấu</span>
                  </div>

                  <div className="h-[480px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950">
                    <Warehouse3DViewer subWarehouse={activeZone} />
                  </div>
                </div>
              )}

              {/* CUSTOM BIN EDIT MODAL / FORM (WHEN CLICKING A BIN) */}
              {editingBinCode && (
                <div className="p-5 rounded-2xl bg-slate-900 text-white border-2 border-cyan-400 shadow-2xl space-y-4 animate-in fade-in">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-cyan-600 text-white font-black">
                        <Edit className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-cyan-400 font-mono">
                          TÙY CHỈNH KÍCH THƯỚC & TẢI TRỌNG RIÊNG CHO Ô: {editingBinCode}
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Nhập kích thước riêng (Dài x Rộng x Cao cm) và Trọng tải cho ô/ngăn này
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setEditingBinCode(null)}
                      className="text-slate-400 hover:text-white text-xs p-1"
                    >
                      ✕ Đóng
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Chiều Dài Ô (cm)</label>
                      <input
                        type="number"
                        value={binCustomForm.length}
                        onChange={(e) => setBinCustomForm({ ...binCustomForm, length: Number(e.target.value) || 10 })}
                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white font-bold text-center"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Chiều Rộng Ô (cm)</label>
                      <input
                        type="number"
                        value={binCustomForm.width}
                        onChange={(e) => setBinCustomForm({ ...binCustomForm, width: Number(e.target.value) || 10 })}
                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white font-bold text-center"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Chiều Cao Ô (cm)</label>
                      <input
                        type="number"
                        value={binCustomForm.height}
                        onChange={(e) => setBinCustomForm({ ...binCustomForm, height: Number(e.target.value) || 10 })}
                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white font-bold text-center"
                      />
                    </div>

                    <div>
                      <label className="block text-amber-400 font-bold mb-1">Tải Trọng Max (kg)</label>
                      <input
                        type="number"
                        value={binCustomForm.maxWeight}
                        onChange={(e) => setBinCustomForm({ ...binCustomForm, maxWeight: Number(e.target.value) || 10 })}
                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-amber-400 font-black text-center"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 pt-3">
                    <button
                      type="button"
                      onClick={() => handleSaveCustomBin('SINGLE')}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold text-xs shadow transition cursor-pointer"
                    >
                      Lưu cho Ô này ({editingBinCode})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveCustomBin('SHELF')}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs shadow transition cursor-pointer"
                    >
                      Áp dụng cho CẢ TẦNG
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveCustomBin('RACK')}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-xs shadow transition cursor-pointer"
                    >
                      Áp dụng cho TOÀN DÃY KỆ
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
