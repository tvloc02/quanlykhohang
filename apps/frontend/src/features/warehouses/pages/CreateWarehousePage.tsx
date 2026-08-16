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
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  CheckSquare,
  Square,
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

// Default generator for continuous longitudinal rack rows
function generateDefaultRacks(
  racksCount: number,
  zoneLength = 20,
  zoneHeight = 6,
  defaultBays = 6,
  defaultShelves = 5,
  defaultBinsPerShelf = 2
): RackConfig[] {
  const racks: RackConfig[] = [];
  const rackL = Math.max(zoneLength - 2, 4);
  const rackW = 1.2;
  const rackH = Math.max(zoneHeight - 1, 3);

  const totalLengthBins = defaultBays * defaultBinsPerShelf;
  const autoBinL = Math.round((rackL * 100) / (totalLengthBins || 1));
  const autoBinW = Math.round(rackW * 100);
  const autoBinH = Math.round((rackH * 100) / (defaultShelves || 1));

  for (let r = 1; r <= racksCount; r++) {
    const rCode = `R${String(r).padStart(2, '0')}`;
    racks.push({
      id: `rack-${r}`,
      rackCode: rCode,
      name: `Dãy Kệ Dọc ${rCode}`,
      length: rackL,
      width: rackW,
      height: rackH,
      maxRackLoad: 16000,
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

  // Master Specs
  const [length, setLength] = useState(50);
  const [width, setWidth] = useState(30);
  const [height, setHeight] = useState(12);

  // Default initial zone for instant rendering without white screen
  const initialDefaultZones: SubWarehouse[] = [
    {
      id: 'sub-init-1',
      code: 'ZONE-A',
      name: 'Phân Khu Kho Thường 1',
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
  ];

  // Subwarehouses / Zones list
  const [subWarehouses, setSubWarehouses] = useState<SubWarehouse[]>(initialDefaultZones);
  const [activeZoneId, setActiveZoneId] = useState<string>('sub-init-1');
  const [activeRackId, setActiveRackId] = useState<string>('rack-1');

  // Interactive Rack Checkboxes Selection State
  const [selectedRackCodes, setSelectedRackCodes] = useState<string[]>([]);

  // 2D Matrix Grid Scale / Zoom State (100%, 150%, 200%, 300%)
  const [gridZoomScale, setGridZoomScale] = useState<number>(100);

  // Auto calculation toggle mode
  const [isAutoCalcBin, setIsAutoCalcBin] = useState<boolean>(true);

  // UI Modes
  const [viewMode, setViewMode] = useState<'2D_MATRIX' | '3D_VIEW'>('2D_MATRIX');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Bin Edit Inspector Modal State
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
    productName: 'Lô hàng xuất nhập khẩu',
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
      const defaultZones: SubWarehouse[] = [
        {
          id: `sub-${Date.now()}-1`,
          code: 'ZONE-A',
          name: 'Phân Khu Kho Thường 1',
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
          name: 'Phân Khu Kho Lạnh',
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
      setName('Kho Hàng Chi Nhánh Tân Bình');
    }
  }, [id, isEditMode]);

  // Active Zone reference
  const activeZone = subWarehouses.find((z) => z.id === activeZoneId) || subWarehouses[0];

  // Helper to parse numeric inputs safely allowing 0 and backspacing
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

  // Helper: Update active zone fields
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

  // Helper: Update specific rack fields
  const updateActiveRack = (fields: Partial<RackConfig>) => {
    if (!activeZone || !activeRack) return;

    setSubWarehouses((prev) =>
      prev.map((z) => {
        if (z.id !== activeZone.id) return z;

        const updatedRacks = (z.racks || activeRacks).map((r) => {
          if (r.id !== activeRack.id) return r;

          const merged: RackConfig = { ...r, ...fields };

          const bays = merged.baysCount !== undefined ? merged.baysCount : (merged.columnsCount || 6);
          const shelves = merged.horizontalPartitions !== undefined ? merged.horizontalPartitions : (merged.shelvesCount || 5);
          const binsPerShelf = merged.verticalPartitions !== undefined ? merged.verticalPartitions : (merged.binsPerShelf || 2);

          merged.baysCount = bays;
          merged.columnsCount = bays;
          merged.horizontalPartitions = shelves;
          merged.shelvesCount = shelves;
          merged.verticalPartitions = binsPerShelf;
          merged.binsPerShelf = binsPerShelf;

          if (isAutoCalcBin) {
            const totalLenBins = bays * binsPerShelf;
            merged.defaultBinLength = Math.round((merged.length * 100) / (totalLenBins || 1));
            merged.defaultBinWidth = Math.round(merged.width * 100);
            merged.defaultBinHeight = Math.round((merged.height * 100) / (shelves || 1));
          }

          return merged;
        });

        return { ...z, racks: updatedRacks };
      })
    );
  };

  // Rack Checkbox Toggles
  const toggleRackCheckbox = (rackCode: string) => {
    setSelectedRackCodes((prev) => {
      if (prev.includes(rackCode)) {
        return prev.filter((c) => c !== rackCode);
      } else {
        return [...prev, rackCode];
      }
    });
  };

  const selectAllRackCheckboxes = () => {
    if (selectedRackCodes.length === activeRacks.length) {
      setSelectedRackCodes([]);
    } else {
      setSelectedRackCodes(activeRacks.map((r) => r.rackCode));
    }
  };

  // Filtered Racks for 2D Matrix display
  const displayedRacks = activeRacks.filter(
    (r) => selectedRackCodes.length === 0 || selectedRackCodes.includes(r.rackCode)
  );

  // Add Zone Handler
  const handleAddZone = (type: 'AMBIENT' | 'COLD' | 'THERMAL') => {
    const nextIdx = subWarehouses.length + 1;
    const typeLabel = type === 'COLD' ? 'Kho Lạnh' : type === 'THERMAL' ? 'Kho Nhiệt' : 'Kho Thường';
    const newZone: SubWarehouse = {
      id: `sub-${Date.now()}`,
      code: `ZONE-${String.fromCharCode(64 + nextIdx)}`,
      name: `Phân Khu ${typeLabel} ${nextIdx}`,
      zoneType: type,
      status: 'active',
      length: 20,
      width: 12,
      height: 6,
      racksCount: 3,
      shelvesPerRack: 5,
      binsPerShelf: 2,
      racks: generateDefaultRacks(3, 20, 6, 6, 5, 2),
    };
    setSubWarehouses([...subWarehouses, newZone]);
    setActiveZoneId(newZone.id);
    if (newZone.racks && newZone.racks.length > 0) {
      setActiveRackId(newZone.racks[0].id);
    }
    setSuccess(`Đã tạo phân khu mới: ${newZone.name}`);
  };

  // Save warehouse form handler
  const handleSaveWarehouse = async () => {
    if (!code || !name) {
      setError('Vui lòng nhập Mã Kho Hàng và Tên Kho Hàng');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const fullAddress = `${detailAddress ? detailAddress + ', ' : ''}${ward}, ${province}`;
      const payload: WarehouseRecord = {
        id: id || `wh_${Date.now()}`,
        code: code.trim(),
        name: name.trim(),
        province,
        ward,
        detailAddress,
        address: fullAddress,
        status,
        length,
        width,
        height,
        managerIds: [],
        staffIds: [],
        subWarehouses,
      };

      await upsertWarehouseToApi(payload);
      saveStoredWarehouses([payload]);
      setSuccess('Lưu cấu hình kho hàng và phân khu kệ dọc thành công!');
      setTimeout(() => {
        navigate('/warehouses');
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu cấu hình kho');
    } finally {
      setSaving(false);
    }
  };

  // Run AI Slotting Handler
  const handleRunAiSlotting = () => {
    if (!activeZone) return;
    const currentWarehouse: WarehouseRecord = {
      id: id || `wh_temp`,
      code: code || 'KH001',
      name: name || 'Kho Hàng',
      address: `${detailAddress}, ${ward}, ${province}`,
      province,
      ward,
      detailAddress,
      status,
      length,
      width,
      height,
      managerIds: [],
      staffIds: [],
      subWarehouses,
    };
    const allBins = generateWarehouseBinCells(currentWarehouse);
    const recs = calculateAiSlottingRecommendations(simProduct, allBins);
    setAiRecommendations(recs);
  };

  return (
    <MainLayout>
      <div className="space-y-6 font-sans pb-16">
        {Toast && (error || success) && (
          <Toast
            message={error || success}
            type={error ? 'error' : 'success'}
            onClose={() => {
              setError('');
              setSuccess('');
            }}
          />
        )}

        {/* PAGE HEADER & TOP NAVIGATION BAR (Cyan Gold Standard UI) */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-cyan-200/80 dark:border-cyan-900/60 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/warehouses')}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-cyan-50 hover:text-cyan-600 transition cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-xs font-extrabold text-cyan-600 dark:text-cyan-400">
                <span>KHO HÀNG THÔNG MINH</span>
                <ChevronRight className="h-3.5 w-3.5" />
                <span>{isEditMode ? 'CHỈNH SỬA KHO' : 'TẠO MỚI KHO HÀNG'}</span>
              </div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                Cấu Hình Dãy Kệ Dọc & Phân Khu Kho
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsAiPanelOpen(!isAiPanelOpen)}
              className="px-4 py-2.5 rounded-xl border border-cyan-300 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 text-xs font-black hover:bg-cyan-100 transition flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Sparkles className="h-4 w-4 text-cyan-600" />
              {isAiPanelOpen ? 'Đóng AI Simulator' : 'Giả Lập AI Slotting'}
            </button>

            <button
              type="button"
              onClick={handleSaveWarehouse}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black shadow-lg shadow-cyan-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Đang Lưu...' : 'Lưu Cấu Hình Kho'}
            </button>
          </div>
        </div>

        {/* TOP METRIC KPI SUMMARY CARDS (Uniform single-color Cyan theme like products/main) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-cyan-600 dark:text-cyan-400">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">MÃ KHO HÀNG</span>
              <Building className="h-5 w-5" />
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-white truncate">{code || 'CHƯA ĐẶT MÃ'}</div>
            <div className="text-xs font-bold text-cyan-600 dark:text-cyan-400">
              Diện tích: {length * width} m² ({length}m × {width}m)
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-cyan-600 dark:text-cyan-400">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">SỐ PHÂN KHU (ZONES)</span>
              <Layers className="h-5 w-5" />
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-white">{subWarehouses.length} Phân Khu</div>
            <div className="text-xs font-bold text-cyan-600 dark:text-cyan-400 truncate">
              Đang chọn: <span className="underline">{activeZone?.name || 'Chưa chọn'}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-cyan-600 dark:text-cyan-400">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">DÃY KỆ DỌC SUỐT KHO</span>
              <LayoutGrid className="h-5 w-5" />
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-white">{activeRacks.length} Dãy Kệ Dọc</div>
            <div className="text-xs font-bold text-cyan-600 dark:text-cyan-400">
              Đã tick chọn: {selectedRackCodes.length === 0 ? 'Tất cả' : `${selectedRackCodes.length}/${activeRacks.length} dãy`}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-cyan-600 dark:text-cyan-400">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">TỔNG THỂ TÍCH CHỨA HÀNG</span>
              <Package className="h-5 w-5" />
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-white">
              {(length * width * height).toLocaleString()} m³
            </div>
            <div className="text-xs font-bold text-cyan-600 dark:text-cyan-400">
              Cao kho tổng: {height} mét
            </div>
          </div>
        </div>

        {/* AI SLOTTING SIMULATOR PANEL (IF OPEN) */}
        {isAiPanelOpen && (
          <div className="bg-slate-900 text-white p-5 rounded-2xl border-2 border-cyan-400 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Cpu className="h-5 w-5 text-cyan-400" />
                <h3 className="text-sm font-black text-cyan-400 uppercase tracking-wider">
                  BÀI TOÁN AI GỢI Ý VỊ TRÍ XẾP HÀNG (3D SLOTTING ENGINE)
                </h3>
              </div>

              <button
                type="button"
                onClick={handleRunAiSlotting}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl font-black text-xs transition flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Zap className="h-4 w-4 fill-slate-950" />
                CHẠY AI GỢI Ý
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Tên Lô Hàng</label>
                <input
                  type="text"
                  value={simProduct.productName}
                  onChange={(e) => setSimProduct({ ...simProduct, productName: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Môi Trường Chứa</label>
                <select
                  value={simProduct.tempRequirement}
                  onChange={(e) => setSimProduct({ ...simProduct, tempRequirement: e.target.value as any })}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-cyan-300 font-bold"
                >
                  <option value="COLD">❄️ Kho Lạnh (-18°C ~ 5°C)</option>
                  <option value="THERMAL">🌡️ Kho Nhiệt (15°C ~ 22°C)</option>
                  <option value="AMBIENT">📦 Kho Thường (20°C ~ 35°C)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Trọng Lượng (kg)</label>
                <input
                  type="number"
                  value={simProduct.totalWeight}
                  onChange={(e) => setSimProduct({ ...simProduct, totalWeight: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Tần Suất Bán (ABC)</label>
                <select
                  value={simProduct.turnoverClass}
                  onChange={(e) => setSimProduct({ ...simProduct, turnoverClass: e.target.value as any })}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-emerald-400 font-bold"
                >
                  <option value="A">Loại A (Bán nhanh - Gần cửa)</option>
                  <option value="B">Loại B (Trung bình)</option>
                  <option value="C">Loại C (Bán chậm - Tầng cao)</option>
                </select>
              </div>

              <div className="flex items-end">
                <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700 text-xs text-cyan-300 font-bold w-full text-center truncate">
                  {aiRecommendations.length > 0
                    ? `Top 1: ${aiRecommendations[0]?.bin.binCode} (${aiRecommendations[0]?.score}%)`
                    : 'Bấm nút để chạy AI'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MAIN SPLIT LAYOUT (5 COLS CONFIG / 7 COLS VISUAL WORKSPACE) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT 5 COLUMNS: CONFIG & RACK CHECKBOXES */}
          <div className="lg:col-span-5 space-y-5">
            {/* CARD 1: KHO TỔNG SPECS & ADD ZONE */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-cyan-200/80 dark:border-cyan-900/60 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Building className="h-4 w-4 text-cyan-600" />
                  1. THÔNG SỐ KHO TỔNG & PHÂN KHU
                </h2>
                <span className="text-xs font-extrabold text-cyan-600 bg-cyan-50 px-2.5 py-0.5 rounded-full border border-cyan-200">
                  {subWarehouses.length} Phân Khu
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Mã Kho Hàng *</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tên Kho Hàng *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-[11px] text-slate-500 block font-semibold">Dài (m)</span>
                  <input
                    type="number"
                    value={length}
                    onChange={(e) => {
                      const val = parseNumInput(e.target.value);
                      setLength(val);
                      if (activeZone) updateActiveZone({ length: val });
                    }}
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-center"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block font-semibold">Rộng (m)</span>
                  <input
                    type="number"
                    value={width}
                    onChange={(e) => {
                      const val = parseNumInput(e.target.value);
                      setWidth(val);
                      if (activeZone) updateActiveZone({ width: val });
                    }}
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-center"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block font-semibold">Cao (m)</span>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => {
                      const val = parseNumInput(e.target.value);
                      setHeight(val);
                      if (activeZone) updateActiveZone({ height: val });
                    }}
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-center"
                  />
                </div>
              </div>

              {/* TẠO MỚI PHÂN KHU BUTTONS */}
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
                  THÊM MỚI PHÂN KHU VÀO KHO
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddZone('AMBIENT')}
                    className="px-2.5 py-1.5 rounded-xl border border-cyan-300 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 text-[11px] font-black transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> + Kho Thường
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddZone('COLD')}
                    className="px-2.5 py-1.5 rounded-xl border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 text-[11px] font-black transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Snowflake className="h-3.5 w-3.5" /> + Kho Lạnh
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddZone('THERMAL')}
                    className="px-2.5 py-1.5 rounded-xl border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-800 text-[11px] font-black transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Thermometer className="h-3.5 w-3.5" /> + Kho Nhiệt
                  </button>
                </div>
              </div>
            </div>

            {/* CARD 2: CẤU HÌNH PHÂN KHU DÃY KỆ DỌC */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-cyan-200/80 dark:border-cyan-900/60 shadow-sm space-y-4">
              {/* ZONE SELECTOR TABS */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Layers className="h-4 w-4 text-cyan-600" />
                  2. CẤU HÌNH PHÂN KHU (ZONES)
                </h2>

                <div className="flex items-center gap-1 overflow-x-auto max-w-[240px]">
                  {subWarehouses.map((z) => (
                    <button
                      key={z.id}
                      type="button"
                      onClick={() => {
                        setActiveZoneId(z.id);
                        if (z.racks && z.racks.length > 0) setActiveRackId(z.racks[0].id);
                        setSelectedRackCodes([]);
                      }}
                      className={`px-3 py-1 rounded-xl text-xs font-extrabold transition cursor-pointer border ${
                        z.id === activeZone?.id
                          ? 'bg-cyan-600 text-white border-cyan-600 shadow'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-cyan-50'
                      }`}
                    >
                      {z.code}
                    </button>
                  ))}
                </div>
              </div>

              {activeZone && (
                <div className="space-y-4 text-xs">
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

                  {/* KÍCH THƯỚC PHÂN KHU & VÁCH NGĂN */}
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Dài (m)</label>
                      <input
                        type="number"
                        min={0}
                        value={activeZone.length}
                        onChange={(e) => updateActiveZone({ length: parseNumInput(e.target.value) })}
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-center"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Rộng (m)</label>
                      <input
                        type="number"
                        min={0}
                        value={activeZone.width}
                        onChange={(e) => updateActiveZone({ width: parseNumInput(e.target.value) })}
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-center"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Cao (m)</label>
                      <input
                        type="number"
                        min={0}
                        value={activeZone.height}
                        onChange={(e) => updateActiveZone({ height: parseNumInput(e.target.value) })}
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-center"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Số Dãy Dọc</label>
                      <input
                        type="number"
                        min={0}
                        value={activeZone.racksCount ?? 4}
                        onChange={(e) => updateActiveZone({ racksCount: parseNumInput(e.target.value) })}
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-black bg-white dark:bg-slate-900 text-center text-cyan-600"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Vách Ngang</label>
                      <input
                        type="number"
                        min={0}
                        value={activeZone.shelvesPerRack ?? 5}
                        onChange={(e) => updateActiveZone({ shelvesPerRack: parseNumInput(e.target.value) })}
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-black bg-white dark:bg-slate-900 text-center text-indigo-600"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Vách Dọc</label>
                      <input
                        type="number"
                        min={0}
                        value={activeZone.binsPerShelf ?? 2}
                        onChange={(e) => updateActiveZone({ binsPerShelf: parseNumInput(e.target.value) })}
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-black bg-white dark:bg-slate-900 text-center text-amber-600"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* CARD 3: INTERACTIVE RACK CHECKBOXES SELECTION LIST */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border-2 border-cyan-400 dark:border-cyan-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-cyan-600" />
                  TICK CHỌN & PHÂN CHIA DÃY KỆ DỌC
                </h3>

                <button
                  type="button"
                  onClick={selectAllRackCheckboxes}
                  className="px-2.5 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-950 hover:bg-cyan-100 text-cyan-700 dark:text-cyan-300 text-[11px] font-black transition cursor-pointer border border-cyan-200 dark:border-cyan-800"
                >
                  {selectedRackCodes.length === activeRacks.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả dãy'}
                </button>
              </div>

              <p className="text-[11px] text-slate-500 font-semibold">
                Tick chọn từng kệ bên dưới để hiển thị & phân chia trực quan trên Sơ đồ 2D/3D:
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {activeRacks.map((r) => {
                  const isChecked = selectedRackCodes.length === 0 || selectedRackCodes.includes(r.rackCode);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setActiveRackId(r.id);
                        toggleRackCheckbox(r.rackCode);
                      }}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-bold transition cursor-pointer ${
                        isChecked
                          ? 'border-cyan-500 bg-cyan-50/80 dark:bg-cyan-950/60 text-cyan-900 dark:text-cyan-200 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-400'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        {isChecked ? (
                          <CheckCircle className="h-4 w-4 text-cyan-600 fill-cyan-100" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-400" />
                        )}
                        <span>{r.rackCode}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">{r.baysCount || 6} B</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT 7 COLUMNS: VISUAL 2D MATRIX & 3D REALTIME WORKSPACE */}
          <div className="lg:col-span-7 space-y-5">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-cyan-200/80 dark:border-cyan-900/60 shadow-sm space-y-4">
              {/* WORKSPACE HEADER & VIEW TOGGLES */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    SƠ ĐỒ TRỰC QUAN KỆ DỌC
                  </span>
                  <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                    {displayedRacks.length}/{activeRacks.length} Dãy được chọn
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Mode Toggles */}
                  <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setViewMode('2D_MATRIX')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                        viewMode === '2D_MATRIX'
                          ? 'bg-cyan-600 text-white shadow'
                          : 'text-slate-600 dark:text-slate-300 hover:text-cyan-600'
                      }`}
                    >
                      <Grid className="h-3.5 w-3.5" />
                      Ma Trận 2D
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('3D_VIEW')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                        viewMode === '3D_VIEW'
                          ? 'bg-cyan-600 text-white shadow'
                          : 'text-slate-600 dark:text-slate-300 hover:text-cyan-600'
                      }`}
                    >
                      <Move3d className="h-3.5 w-3.5" />
                      Khối 3D
                    </button>
                  </div>

                  {/* 2D Zoom Controls */}
                  {viewMode === '2D_MATRIX' && (
                    <div className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setGridZoomScale((z) => Math.max(100, z - 50))}
                        className="px-2 py-1 hover:text-cyan-600 cursor-pointer"
                        title="Thu nhỏ"
                      >
                        -
                      </button>
                      <span className="px-1 text-cyan-700 dark:text-cyan-400">{gridZoomScale}%</span>
                      <button
                        type="button"
                        onClick={() => setGridZoomScale((z) => Math.min(300, z + 50))}
                        className="px-2 py-1 hover:text-cyan-600 cursor-pointer"
                        title="Phóng to đến 300%"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* VIEW CANVAS RENDER */}
              {viewMode === '3D_VIEW' ? (
                <Warehouse3DViewer subWarehouse={activeZone} selectedRackIds={selectedRackCodes} />
              ) : (
                /* 2D MATRIX EXCEL GRID VIEW MODE */
                <div className="space-y-4 overflow-x-auto">
                  <div
                    style={{ zoom: `${gridZoomScale}%` }}
                    className="space-y-6 transition-all duration-200"
                  >
                    {displayedRacks.map((rack) => {
                      const baysCount = rack.baysCount || rack.columnsCount || 6;
                      const shelvesCount = rack.horizontalPartitions || rack.shelvesCount || 5;
                      const binsPerShelf = rack.verticalPartitions || rack.binsPerShelf || 2;

                      return (
                        <div
                          key={rack.id}
                          className="rounded-2xl border-2 border-cyan-300 dark:border-cyan-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3"
                        >
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-lg bg-cyan-600 text-white font-black text-xs">
                                {rack.rackCode}
                              </span>
                              <span className="font-extrabold text-xs text-slate-800 dark:text-slate-100">
                                {rack.name} ({rack.length}m Dài × {rack.width}m Rộng)
                              </span>
                            </div>
                            <span className="text-[11px] font-bold text-slate-500">
                              {baysCount} Khoang (Bays) × {shelvesCount} Tầng × {binsPerShelf} Hộc
                            </span>
                          </div>

                          {/* 2D BAYS GRID COLUMNS */}
                          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                            {Array.from({ length: baysCount }).map((_, bIdx) => {
                              const bayNum = bIdx + 1;
                              const bayCode = `B${String(bayNum).padStart(2, '0')}`;

                              return (
                                <div
                                  key={bayCode}
                                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 p-2 space-y-2"
                                >
                                  <div className="text-[11px] font-black text-center text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950 py-0.5 rounded border border-cyan-200 dark:border-cyan-900">
                                    Khoang {bayCode}
                                  </div>

                                  {/* SHELVES & BINS CELL MATRIX */}
                                  <div className="space-y-1.5">
                                    {Array.from({ length: shelvesCount })
                                      .map((_, sIdx) => shelvesCount - sIdx) // Render top level down
                                      .map((shelfNum) => {
                                        const shelfCode = `S${String(shelfNum).padStart(2, '0')}`;

                                        return (
                                          <div key={shelfCode} className="space-y-1">
                                            <div className="text-[9px] font-bold text-slate-400 px-1">
                                              Tầng {shelfCode}
                                            </div>

                                            <div
                                              className="grid gap-1.5"
                                              style={{ gridTemplateColumns: `repeat(${Math.max(1, binsPerShelf)}, minmax(0, 1fr))` }}
                                            >
                                              {Array.from({ length: binsPerShelf }).map((_, cIdx) => {
                                                const cellNum = cIdx + 1;
                                                const cellCode = `C${String(cellNum).padStart(2, '0')}`;
                                                const fullBinCode = `${activeZone?.code || 'ZONE'}-${rack.rackCode}-${bayCode}-${shelfCode}-${cellCode}`;
                                                const isCustom = rack.customBins && rack.customBins[fullBinCode];

                                                return (
                                                  <button
                                                    key={fullBinCode}
                                                    type="button"
                                                    onClick={() => {
                                                      setEditingBinCode(fullBinCode);
                                                      setBinCustomForm(
                                                        isCustom || {
                                                          binCode: fullBinCode,
                                                          length: rack.defaultBinLength || 120,
                                                          width: rack.defaultBinWidth || 80,
                                                          height: rack.defaultBinHeight || 100,
                                                          maxWeight: rack.defaultBinMaxWeight || 500,
                                                        }
                                                      );
                                                    }}
                                                    className={`p-1.5 rounded-lg border text-center font-mono text-[10px] font-bold transition cursor-pointer ${
                                                      isCustom
                                                        ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 shadow-sm'
                                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-cyan-500 hover:bg-cyan-50'
                                                    }`}
                                                  >
                                                    <span className="block truncate text-[9px]">{cellCode}</span>
                                                  </button>
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
                      );
                    })}
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
