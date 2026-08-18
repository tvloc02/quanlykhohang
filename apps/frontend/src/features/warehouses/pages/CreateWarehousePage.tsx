import React, { useState, useEffect, useCallback } from 'react';
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
  mergeStoredWarehouses,
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

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api';

// Default generator for continuous longitudinal rack rows
function generateDefaultRacks(
  racksCount: number,
  zoneLength = 20,
  zoneHeight = 6,
  vachDoc = 2,
  vachNgang = 5,
  defaultBinsPerShelf = 2,
  rackLength?: number,
  rackWidth?: number,
  rackHeight?: number
): RackConfig[] {
  const racks: RackConfig[] = [];
  const rackL = rackLength !== undefined && rackLength > 0 ? rackLength : Math.max(zoneLength - 2, 4);
  const rackW = rackWidth !== undefined && rackWidth > 0 ? rackWidth : 1.2;
  const rackH = rackHeight !== undefined && rackHeight > 0 ? rackHeight : Math.max(zoneHeight - 1, 3);

  // Vách Dọc vachDoc (tính cả vách đầu và vách đuôi) -> Số khoang = vachDoc - 1
  const calcBays = Math.max(1, vachDoc - 1);
  // Vách Ngang vachNgang (tính cả dầm đáy dưới cùng và dầm mái trên cùng) -> Số tầng = vachNgang - 1
  const calcShelves = Math.max(1, vachNgang - 1);

  const totalLengthBins = calcBays * defaultBinsPerShelf;
  const autoBinL = Math.round((rackL * 100) / (totalLengthBins || 1));
  const autoBinW = Math.round(rackW * 100);
  const autoBinH = Math.round((rackH * 100) / (calcShelves || 1));

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
      baysCount: calcBays,
      horizontalPartitions: vachNgang,
      verticalPartitions: vachDoc,
      columnsCount: calcBays,
      shelvesCount: calcShelves,
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

  // Subwarehouses / Zones list
  const [subWarehouses, setSubWarehouses] = useState<SubWarehouse[]>([]);
  const [activeZoneId, setActiveZoneId] = useState<string>('');
  const [activeRackId, setActiveRackId] = useState<string>('');

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

  // Occupied Bins Inventory state (Bins that contain allocated goods)
  const [occupiedBinsMap, setOccupiedBinsMap] = useState<Map<string, { totalPhysical: number; allocated: number; productsCount: number }>>(new Map());

  // Fetch real inventory stock balance / allocated bins topology
  useEffect(() => {
    let isMounted = true;
    async function fetchOccupiedBins() {
      const isCleared =
        sessionStorage.getItem(`cleared_warehouse_goods_${id || 'new'}`) === 'true' ||
        localStorage.getItem(`cleared_warehouse_goods_${id || 'new'}`) === 'true' ||
        (code && (sessionStorage.getItem(`cleared_warehouse_goods_${code}`) === 'true' || localStorage.getItem(`cleared_warehouse_goods_${code}`) === 'true')) ||
        sessionStorage.getItem('cleared_warehouse_goods_global') === 'true' ||
        localStorage.getItem('cleared_warehouse_goods_global') === 'true';

      if (isCleared) {
        if (isMounted) setOccupiedBinsMap(new Map());
        return;
      }
      try {
        const map = new Map<string, { totalPhysical: number; allocated: number; productsCount: number }>();
        const headers = { Authorization: `Bearer ${localStorage.getItem('token') || ''}` };

        // 1. Digital twin stock balances
        const res = await fetch(`${API_BASE_URL}/inventory/visualizer/digital-twin?days=30`, { headers });
        if (res.ok) {
          const cells: any[] = await res.json();
          cells.forEach((cell) => {
            if (cell.totalPhysical > 0 || cell.allocated > 0) {
              map.set(cell.locationCode, {
                totalPhysical: cell.totalPhysical || 1,
                allocated: cell.allocated || 0,
                productsCount: cell.productsCount || 1,
              });
            }
          });
        }

        // 2. Also check purchase orders / stock-in orders for assigned bin codes in notes
        const poRes = await fetch(`${API_BASE_URL}/inbound/purchase-orders`, { headers }).catch(() => null);
        if (poRes && poRes.ok) {
          const pos: any[] = await poRes.json();
          pos.forEach((po) => {
            (po.details || []).forEach((d: any) => {
              const noteText = d.note || '';
              if (noteText.includes('[Vị trí Ô:')) {
                const match = noteText.match(/\[Vị trí Ô:\s*([^\]]+)\]/);
                if (match && match[1]) {
                  match[1].split(',').forEach((code: string) => {
                    const bin = code.trim();
                    if (bin && !map.has(bin)) {
                      map.set(bin, {
                        totalPhysical: Number(d.receivedQty || d.expectedQty || 1),
                        allocated: 0,
                        productsCount: 1,
                      });
                    }
                  });
                }
              }
            });
          });
        }

        // 3. Also check stock-in-orders endpoint
        const stockInRes = await fetch(`${API_BASE_URL}/inbound/stock-in-orders`, { headers }).catch(() => null);
        if (stockInRes && stockInRes.ok) {
          const sOrders: any[] = await stockInRes.json();
          sOrders.forEach((so) => {
            (so.details || []).forEach((d: any) => {
              const assigned = Array.isArray(d.assignedBins) ? d.assignedBins : (d.locationBin ? [d.locationBin] : []);
              assigned.forEach((bin: string) => {
                if (bin && bin.length > 2 && !map.has(bin)) {
                  map.set(bin, {
                    totalPhysical: Number(d.receivedQty || d.expectedQty || 1),
                    allocated: 0,
                    productsCount: 1,
                  });
                }
              });
              const noteText = d.note || '';
              if (noteText.includes('[Vị trí Ô:')) {
                const match = noteText.match(/\[Vị trí Ô:\s*([^\]]+)\]/);
                if (match && match[1]) {
                  match[1].split(',').forEach((code: string) => {
                    const bin = code.trim();
                    if (bin && !map.has(bin)) {
                      map.set(bin, {
                        totalPhysical: Number(d.receivedQty || d.expectedQty || 1),
                        allocated: 0,
                        productsCount: 1,
                      });
                    }
                  });
                }
              }
            });
          });
        }

        if (isMounted) setOccupiedBinsMap(map);
      } catch (err) {
        console.error('Could not fetch digital twin bins', err);
      }
    }
    fetchOccupiedBins();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleClearAllGoods = () => {
    if (window.confirm('Bạn có chắc chắn muốn giải phóng toàn bộ ô kệ và xóa hết hàng hóa trong kho này về trạng thái KỆ TRỐNG?')) {
      setOccupiedBinsMap(new Map());
      sessionStorage.setItem(`cleared_warehouse_goods_${id || 'new'}`, 'true');
      localStorage.setItem(`cleared_warehouse_goods_${id || 'new'}`, 'true');
      if (code) {
        sessionStorage.setItem(`cleared_warehouse_goods_${code}`, 'true');
        localStorage.setItem(`cleared_warehouse_goods_${code}`, 'true');
      }
      sessionStorage.setItem('cleared_warehouse_goods_global', 'true');
      localStorage.setItem('cleared_warehouse_goods_global', 'true');
      window.dispatchEvent(new Event('warehouse-goods-cleared'));
      setSuccess('Đã xóa toàn bộ hàng hóa trong kho. Tất cả ô kệ đã trở về trạng thái KỆ TRỐNG!');
    }
  };

  const getOccupiedInfo = (
    fullBinCode: string,
    zoneCode?: string,
    rackCode?: string,
    bayCode?: string,
    shelfCode?: string,
    cellCode?: string,
  ) => {
    if (!occupiedBinsMap || occupiedBinsMap.size === 0) return null;
    if (occupiedBinsMap.has(fullBinCode)) return occupiedBinsMap.get(fullBinCode);

    const shortCode = `${rackCode}-${shelfCode}-${cellCode}`;
    if (occupiedBinsMap.has(shortCode)) return occupiedBinsMap.get(shortCode);

    if (zoneCode) {
      const zoneShort = `${zoneCode}-${rackCode}-${shelfCode}-${cellCode}`;
      if (occupiedBinsMap.has(zoneShort)) return occupiedBinsMap.get(zoneShort);
    }

    for (const [key, val] of occupiedBinsMap.entries()) {
      if (
        key.includes(fullBinCode) ||
        (rackCode && shelfCode && cellCode && key.includes(rackCode) && key.includes(shelfCode) && key.includes(cellCode))
      ) {
        return val;
      }
    }

    return null;
  };

  const populateWarehouse = useCallback((target: WarehouseRecord) => {
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
      const vachDoc = z.binsPerShelf || (z as any).verticalPartitions || 2;
      const vachNgang = z.shelvesPerRack || (z as any).horizontalPartitions || 5;
      const calcBays = Math.max(1, vachDoc - 1);
      const calcShelves = Math.max(1, vachNgang - 1);

      const rL = z.rackLength !== undefined ? z.rackLength : (z.racks?.[0]?.length || Math.max((z.length || 20) - 2, 4));
      const rW = z.rackWidth !== undefined ? z.rackWidth : (z.racks?.[0]?.width || 1.2);
      const rH = z.rackHeight !== undefined ? z.rackHeight : (z.racks?.[0]?.height || Math.max((z.height || 6) - 1, 3));

      const rks = z.racks && z.racks.length > 0
        ? z.racks.map((r) => ({
            ...r,
            length: r.length || rL,
            width: r.width || rW,
            height: r.height || rH,
            baysCount: calcBays,
            columnsCount: calcBays,
            shelvesCount: calcShelves,
            horizontalPartitions: vachNgang,
            verticalPartitions: vachDoc,
            binsPerShelf: r.binsPerShelf || 2,
          }))
        : generateDefaultRacks(z.racksCount || 4, z.length || 20, z.height || 6, vachDoc, vachNgang, 2, rL, rW, rH);
      return {
        ...z,
        rackLength: rL,
        rackWidth: rW,
        rackHeight: rH,
        racks: rks
      };
    });

    setSubWarehouses(loadedZones);
    if (loadedZones.length > 0) {
      setActiveZoneId(loadedZones[0].id);
      if (loadedZones[0].racks && loadedZones[0].racks.length > 0) {
        setActiveRackId(loadedZones[0].racks[0].id);
      }
    }
  }, []);

  // Load warehouse data if Edit Mode (supports F5 refresh and API sync)
  useEffect(() => {
    let isMounted = true;
    if (isEditMode && id) {
      const targetId = id;
      const localWarehouses = getStoredWarehouses();
      const localTarget = localWarehouses.find(
        (w) => w.id === targetId || w.code === targetId || w.id.toLowerCase() === targetId.toLowerCase()
      );
      if (localTarget) {
        populateWarehouse(localTarget);
      }

      async function loadWarehouseFromApi() {
        try {
          const headers = { Authorization: `Bearer ${localStorage.getItem('token') || ''}` };
          const res = await fetch(`${API_BASE_URL}/warehouses`, { headers }).catch(() => null);
          if (res && res.ok) {
            const remoteData: WarehouseRecord[] = await res.json();
            if (Array.isArray(remoteData) && remoteData.length > 0) {
              const merged = mergeStoredWarehouses(remoteData, localWarehouses);
              saveStoredWarehouses(merged);
              const matched = merged.find(
                (w) => w.id === targetId || w.code === targetId || w.id.toLowerCase() === targetId.toLowerCase()
              );
              if (matched && isMounted) {
                populateWarehouse(matched);
              }
            }
          }
        } catch (err) {
          console.error('Lỗi khi tải dữ liệu kho từ API:', err);
        }
      }
      loadWarehouseFromApi();
    } else {
      setCode(`KH${Math.floor(100 + Math.random() * 900)}`);
      setName('');
      setSubWarehouses([]);
    }
    return () => {
      isMounted = false;
    };
  }, [id, isEditMode, populateWarehouse]);

  // Active Zone reference
  const activeZone = subWarehouses.find((z) => z.id === activeZoneId) || subWarehouses[0];

  // Helper to parse numeric inputs safely allowing 0 and backspacing
  const parseNumInput = (valStr: string): number => {
    if (valStr === '') return 0;
    const num = Number(valStr);
    return isNaN(num) ? 0 : Math.max(0, num);
  };

  // Ensure racks exist in activeZone
  const activeRacks = activeZone?.racks || [];

  const activeRack = activeRacks.find((r) => r.id === activeRackId) || activeRacks[0];

  // Helper: Update active zone fields
  const updateActiveZone = (fields: Partial<SubWarehouse>) => {
    if (!activeZone) return;
    setSubWarehouses((prev) =>
      prev.map((z) => {
        if (z.id !== activeZone.id) return z;

        const nextLength = fields.length !== undefined ? fields.length : z.length;
        const nextWidth = fields.width !== undefined ? fields.width : z.width;
        const nextHeight = fields.height !== undefined ? fields.height : z.height;

        const defaultRL = Math.max(nextLength - 2, 4);
        const defaultRW = 1.2;
        const defaultRH = Math.max(nextHeight - 1, 3);

        const nextRackLength = fields.rackLength !== undefined ? fields.rackLength : (z.rackLength ?? z.racks?.[0]?.length ?? defaultRL);
        const nextRackWidth = fields.rackWidth !== undefined ? fields.rackWidth : (z.rackWidth ?? z.racks?.[0]?.width ?? defaultRW);
        const nextRackHeight = fields.rackHeight !== undefined ? fields.rackHeight : (z.rackHeight ?? z.racks?.[0]?.height ?? defaultRH);

        const nextRacksCount = fields.racksCount !== undefined ? fields.racksCount : (z.racksCount ?? 4);
        const nextShelves = fields.shelvesPerRack !== undefined ? fields.shelvesPerRack : (z.shelvesPerRack ?? 5);
        const nextBinsPerShelf = fields.binsPerShelf !== undefined ? fields.binsPerShelf : (z.binsPerShelf ?? 2);
        const nextMaxWeight = fields.maxWeightPerBin !== undefined ? fields.maxWeightPerBin : (z.maxWeightPerBin ?? 500);

        const updatedRacks = generateDefaultRacks(
          nextRacksCount,
          nextLength,
          nextHeight,
          nextBinsPerShelf,
          nextShelves,
          2,
          nextRackLength,
          nextRackWidth,
          nextRackHeight
        ).map((r, idx) => {
          const existing = z.racks?.[idx];
          return {
            ...r,
            defaultBinMaxWeight: existing?.defaultBinMaxWeight ?? nextMaxWeight,
            maxRackLoad: existing?.maxRackLoad ?? r.maxRackLoad,
          };
        });

        return {
          ...z,
          ...fields,
          length: nextLength,
          width: nextWidth,
          height: nextHeight,
          rackLength: nextRackLength,
          rackWidth: nextRackWidth,
          rackHeight: nextRackHeight,
          racksCount: nextRacksCount,
          shelvesPerRack: nextShelves,
          binsPerShelf: nextBinsPerShelf,
          maxWeightPerBin: nextMaxWeight,
          racks: updatedRacks
        };
      })
    );
  };

  // Helper: Update rack properties by ID
  const updateRackById = (rackId: string, fields: Partial<RackConfig>) => {
    if (!activeZone) return;
    setSubWarehouses((prev) =>
      prev.map((z) => {
        if (z.id !== activeZone.id) return z;
        const updatedRacks = (z.racks || []).map((r) => {
          if (r.id !== rackId) return r;
          const merged = { ...r, ...fields };
          if (isAutoCalcBin && (fields.length !== undefined || fields.width !== undefined || fields.height !== undefined)) {
            const bays = merged.baysCount || 1;
            const shelves = merged.shelvesCount || 1;
            const binsPerShelf = merged.binsPerShelf || 2;
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

  // Helper: Update rack weight by ID
  const updateRackWeightById = (rackId: string, binWeight: number, maxRackLoad?: number) => {
    updateRackById(rackId, {
      defaultBinMaxWeight: binWeight,
      ...(maxRackLoad !== undefined ? { maxRackLoad } : {}),
    });
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
    const defaultRL = 18;
    const defaultRW = 1.2;
    const defaultRH = 5;
    const newZone: SubWarehouse = {
      id: `sub-${Date.now()}`,
      code: `ZONE-${String.fromCharCode(64 + nextIdx)}`,
      name: `Phân Khu ${typeLabel} ${nextIdx}`,
      zoneType: type,
      status: 'active',
      length: 20,
      width: 12,
      height: 6,
      rackLength: defaultRL,
      rackWidth: defaultRW,
      rackHeight: defaultRH,
      racksCount: 3,
      shelvesPerRack: 5,
      binsPerShelf: 2,
      racks: generateDefaultRacks(3, 20, 6, 6, 5, 2, defaultRL, defaultRW, defaultRH),
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

      const savedWarehouse = await upsertWarehouseToApi(payload);
      const existingWarehouses = getStoredWarehouses();
      const updatedList = existingWarehouses.some((w) => w.id === savedWarehouse.id)
        ? existingWarehouses.map((w) => (w.id === savedWarehouse.id ? savedWarehouse : w))
        : [...existingWarehouses, savedWarehouse];
      saveStoredWarehouses(updatedList);
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

        {/* PAGE HEADER & TOP NAVIGATION BAR (Exact Products/Main UI Style) */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-md">
              <Building className="h-5 w-5 text-cyan-100" />
              <h1 className="text-lg font-bold tracking-tight text-white">
                {isEditMode ? 'Cấu Hình Dãy Kệ Dọc & Phân Khu Kho' : 'Tạo Kho Hàng Mới'}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsAiPanelOpen(!isAiPanelOpen)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-500 bg-cyan-50 px-4 py-2.5 text-xs font-bold text-cyan-800 shadow-sm transition hover:bg-cyan-100 cursor-pointer"
            >
              <Sparkles className="h-4 w-4 text-cyan-600" />
              {isAiPanelOpen ? 'Đóng AI Simulator' : 'Giả Lập AI Slotting'}
            </button>

            <button
              type="button"
              onClick={handleSaveWarehouse}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Đang Lưu...' : 'Lưu Cấu Hình Kho'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/warehouses')}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-500 bg-white px-4 py-2.5 text-xs font-bold text-cyan-700 hover:bg-cyan-50 shadow-sm transition cursor-pointer"
              title="Quay lại danh sách kho"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại
            </button>
          </div>
        </div>

        {/* 4 BUTTON TỔNG HỢP / SUMMARY METRIC CARDS (Matches products/main) */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
            <div>
              <p className="text-sm sm:text-base font-black text-cyan-700 uppercase">
                MÃ KHO: {code || 'CHƯA ĐẶT'}
              </p>
              <p className="text-[11px] font-bold text-slate-500">
                Diện tích: {length * width} m² ({length}m × {width}m)
              </p>
            </div>
          </div>

          <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
            <div>
              <p className="text-sm sm:text-base font-black text-cyan-700 uppercase">
                {subWarehouses.length} PHÂN KHU (ZONES)
              </p>
              <p className="text-[11px] font-bold text-slate-500 truncate max-w-[200px]">
                Đang chọn: {activeZone?.name || 'Chưa chọn'}
              </p>
            </div>
          </div>

          <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
            <div>
              <p className="text-sm sm:text-base font-black text-cyan-700 uppercase">
                {activeRacks.length} DÃY KỆ DỌC SUỐT KHO
              </p>
              <p className="text-[11px] font-bold text-slate-500">
                Đã tick chọn: {selectedRackCodes.length === 0 ? 'Tất cả' : `${selectedRackCodes.length}/${activeRacks.length} dãy`}
              </p>
            </div>
          </div>

          <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
            <div>
              <p className="text-sm sm:text-base font-black text-cyan-700 uppercase">
                {(length * width * height).toLocaleString('vi-VN')} m³ THỂ TÍCH
              </p>
              <p className="text-[11px] font-bold text-slate-500">
                Cao kho tổng: {height} mét
              </p>
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

                  {/* KÍCH THƯỚC PHÂN KHU & KÍCH THƯỚC KỆ & VÁCH NGĂN */}
                  <div className="space-y-3 pt-1">
                    {/* SECTION A: KÍCH THƯỚC PHÂN KHU (ZONE DIMENSIONS) */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                        1. KÍCH THƯỚC PHÂN KHU (ZONES)
                      </span>
                      <div className="grid grid-cols-3 gap-2">
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
                      </div>
                    </div>

                    {/* SECTION B: KÍCH THƯỚC DÃY KỆ (RACK SPECIFICATIONS) */}
                    <div className="bg-cyan-50/70 dark:bg-cyan-950/40 p-2.5 rounded-xl border border-cyan-200 dark:border-cyan-800">
                      <span className="text-[11px] font-black text-cyan-800 dark:text-cyan-300 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                        2. KÍCH THƯỚC DÃY KỆ (RACKS)
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block font-bold text-cyan-900 dark:text-cyan-200 mb-1">Dài Kệ (m)</label>
                          <input
                            type="number"
                            min={0}
                            value={activeZone.rackLength ?? activeZone.racks?.[0]?.length ?? Math.max(activeZone.length - 2, 4)}
                            onChange={(e) => updateActiveZone({ rackLength: parseNumInput(e.target.value) })}
                            className="w-full px-2 py-1 rounded-lg border border-cyan-300 dark:border-cyan-700 font-black bg-white dark:bg-slate-900 text-center text-cyan-700 dark:text-cyan-300"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-cyan-900 dark:text-cyan-200 mb-1">Rộng Kệ (m)</label>
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={activeZone.rackWidth ?? activeZone.racks?.[0]?.width ?? 1.2}
                            onChange={(e) => updateActiveZone({ rackWidth: parseNumInput(e.target.value) })}
                            className="w-full px-2 py-1 rounded-lg border border-cyan-300 dark:border-cyan-700 font-black bg-white dark:bg-slate-900 text-center text-cyan-700 dark:text-cyan-300"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-cyan-900 dark:text-cyan-200 mb-1">Cao Kệ (m)</label>
                          <input
                            type="number"
                            min={0}
                            value={activeZone.rackHeight ?? activeZone.racks?.[0]?.height ?? Math.max(activeZone.height - 1, 3)}
                            onChange={(e) => updateActiveZone({ rackHeight: parseNumInput(e.target.value) })}
                            className="w-full px-2 py-1 rounded-lg border border-cyan-300 dark:border-cyan-700 font-black bg-white dark:bg-slate-900 text-center text-cyan-700 dark:text-cyan-300"
                          />
                        </div>
                      </div>
                    </div>

                    {/* SECTION C: CẤU TRÚC VÁCH & TẢI TRỌNG */}
                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                        3. CẤU TRÚC VÁCH & TẢI TRỌNG Ô
                      </span>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Trọng Tải Ô (kg)</label>
                          <input
                            type="number"
                            min={0}
                            value={activeZone.maxWeightPerBin ?? 500}
                            onChange={(e) => updateActiveZone({ maxWeightPerBin: parseNumInput(e.target.value) })}
                            className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-black bg-white dark:bg-slate-900 text-center text-emerald-600"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* CARD 3: INTERACTIVE RACK CHECKBOXES & ROW WEIGHT CONFIGURATION */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border-2 border-cyan-400 dark:border-cyan-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-cyan-600" />
                  TICK CHỌN & CẤU HÌNH TRỌNG TẢI DÃY KỆ
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
                Tick chọn từng kệ và nhập Trọng Tải (kg) riêng cho từng hàng dãy kệ:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {activeRacks.map((r) => {
                  const isChecked = selectedRackCodes.length === 0 || selectedRackCodes.includes(r.rackCode);
                  const currentBinWeight = r.defaultBinMaxWeight ?? activeZone?.maxWeightPerBin ?? 500;
                  const currentRackLoad = r.maxRackLoad ?? 16000;

                  return (
                    <div
                      key={r.id}
                      className={`p-3 rounded-xl border transition space-y-2 ${
                        isChecked
                          ? 'border-cyan-400 bg-cyan-50/60 dark:bg-cyan-950/40 text-slate-900 dark:text-slate-100 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-400 opacity-65'
                      }`}
                    >
                      {/* TOP CHECKBOX HEADER */}
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveRackId(r.id);
                            toggleRackCheckbox(r.rackCode);
                          }}
                          className="flex items-center gap-1.5 text-xs font-black cursor-pointer hover:text-cyan-600"
                        >
                          {isChecked ? (
                            <CheckCircle className="h-4 w-4 text-cyan-600 fill-cyan-100 shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-400 shrink-0" />
                          )}
                          <span>{r.rackCode} - {r.name}</span>
                        </button>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200">
                          {activeZone?.binsPerShelf ?? 2} Vách Dọc
                        </span>
                      </div>

                      {/* EDITABLE DIMENSIONS & WEIGHT INPUT FIELDS FOR THIS RACK ROW */}
                      <div className="space-y-2 pt-1">
                        <div className="grid grid-cols-3 gap-1.5">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Dài Kệ (m)</label>
                            <input
                              type="number"
                              min={0}
                              value={r.length}
                              onChange={(e) => updateRackById(r.id, { length: parseNumInput(e.target.value) })}
                              className="w-full px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-xs text-center text-cyan-800 dark:text-cyan-200"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Rộng Kệ (m)</label>
                            <input
                              type="number"
                              min={0}
                              step={0.1}
                              value={r.width}
                              onChange={(e) => updateRackById(r.id, { width: parseNumInput(e.target.value) })}
                              className="w-full px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-xs text-center text-cyan-800 dark:text-cyan-200"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Cao Kệ (m)</label>
                            <input
                              type="number"
                              min={0}
                              value={r.height}
                              onChange={(e) => updateRackById(r.id, { height: parseNumInput(e.target.value) })}
                              className="w-full px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-xs text-center text-cyan-800 dark:text-cyan-200"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                              Tải trọng ô (kg/ô)
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={currentBinWeight}
                              onChange={(e) => updateRackWeightById(r.id, parseNumInput(e.target.value), currentRackLoad)}
                              className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-xs text-cyan-700 text-center"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                              Trọng tải dãy (kg)
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={currentRackLoad}
                              onChange={(e) => updateRackWeightById(r.id, currentBinWeight, parseNumInput(e.target.value))}
                              className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-xs text-emerald-700 text-center"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
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

              {/* BIN STATUS LEGEND BAR */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-slate-500 uppercase tracking-wider text-[11px]">Trạng Thái Ô Kệ:</span>
                  <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                    <span className="h-3.5 w-3.5 rounded border border-slate-300 bg-white inline-block shadow-2xs" />
                    Ô Trống
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-amber-900 dark:text-amber-300 font-black">
                    <span className="h-3.5 w-3.5 rounded border-2 border-amber-500 bg-amber-400 inline-block shadow-2xs animate-pulse" />
                    Đã Có Hàng (Đã phân bổ)
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-cyan-800 dark:text-cyan-300 font-bold">
                    <span className="h-3.5 w-3.5 rounded border border-cyan-400 bg-cyan-100 inline-block shadow-2xs" />
                    Tùy chỉnh tải trọng
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleClearAllGoods}
                  className="px-3 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950 dark:hover:bg-rose-900 dark:text-rose-300 font-black text-xs transition border border-rose-200 dark:border-rose-800 flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                  title="Giải phóng toàn bộ ô kệ và đưa toàn bộ kho về trạng thái kệ trống"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                  <span>Xóa hết hàng (Về kệ trống)</span>
                </button>
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
                      const vachDoc = activeZone?.binsPerShelf ?? 2;
                      const vachNgang = activeZone?.shelvesPerRack ?? 5;
                      const baysCount = Math.max(1, vachDoc - 1);
                      const shelvesCount = Math.max(1, vachNgang - 1);
                      const totalBinsPerShelf = baysCount;

                      return (
                        <div
                          key={rack.id}
                          className="rounded-2xl border-2 border-cyan-300 dark:border-cyan-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4"
                        >
                          {/* RACK ROW HEADER */}
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                            <div className="flex items-center gap-2.5">
                              <span className="px-3 py-1 rounded-xl bg-cyan-600 text-white font-black text-xs shadow-sm">
                                {rack.rackCode}
                              </span>
                              <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                                {rack.name} ({rack.length}m Dài × {rack.width}m Rộng)
                              </span>
                            </div>
                            <span className="text-xs font-bold text-slate-500 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                              {shelvesCount} Tầng ({vachNgang} Vách Ngang) × {totalBinsPerShelf} Ô ({vachDoc} Vách Dọc)
                            </span>
                          </div>

                          {/* 2D MATRIX ROWS: RENDERED TẦNG BY TẦNG (S04 -> S01) */}
                          <div className="space-y-3">
                            {Array.from({ length: shelvesCount })
                              .map((_, sIdx) => shelvesCount - sIdx) // Render top level down (e.g. S04 -> S01)
                              .map((shelfNum) => {
                                const shelfCode = `S${String(shelfNum).padStart(2, '0')}`;

                                return (
                                  <div
                                    key={shelfCode}
                                    className="rounded-xl border border-cyan-200/80 dark:border-cyan-900/60 bg-slate-50/70 dark:bg-slate-950 p-3 space-y-2"
                                  >
                                    {/* TẦNG ROW LABEL */}
                                    <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-1.5">
                                      <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-0.5 rounded-lg bg-cyan-700 text-white font-black text-xs">
                                          Tầng {shelfCode}
                                        </span>
                                        <span className="text-xs font-bold text-slate-500">
                                          (Mâm kệ tầng {shelfNum})
                                        </span>
                                      </div>
                                      <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400">
                                        {totalBinsPerShelf} Ô / Hộc chứa hàng
                                      </span>
                                    </div>

                                    {/* HORIZONTAL GRID OF Ô (BINS) FOR THIS TẦNG */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                                      {Array.from({ length: baysCount }).map((_, bIdx) => {
                                        const cellNum = bIdx + 1;
                                        const bayCode = `B${String(cellNum).padStart(2, '0')}`;
                                        const binLabel = `Ô C${String(cellNum).padStart(2, '0')}`;
                                        const cellCode = `C${String(cellNum).padStart(2, '0')}`;
                                        const fullBinCode = `${activeZone?.code || 'ZONE'}-${rack.rackCode}-${bayCode}-${shelfCode}-${cellCode}`;
                                        const isCustom = rack.customBins && rack.customBins[fullBinCode];

                                        const occupiedInfo = getOccupiedInfo(fullBinCode, activeZone?.code, rack.rackCode, bayCode, shelfCode, cellCode);
                                        const hasGoods = Boolean(occupiedInfo && (occupiedInfo.totalPhysical > 0 || occupiedInfo.allocated > 0));

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
                                            className={`p-2 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-between gap-1 shadow-sm ${
                                              hasGoods
                                                ? 'border-2 border-amber-500 bg-amber-100 dark:bg-amber-950/80 text-amber-950 dark:text-amber-100 shadow-md ring-2 ring-amber-300/60 font-black'
                                                : isCustom
                                                  ? 'border-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-900 dark:text-cyan-200'
                                                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-950/50 text-slate-700 dark:text-slate-200'
                                            }`}
                                          >
                                            <div className="w-full flex items-center justify-between gap-1">
                                              <span className={`text-xs font-black ${hasGoods ? 'text-amber-900 dark:text-amber-200' : 'text-cyan-700 dark:text-cyan-300'}`}>
                                                {binLabel}
                                              </span>
                                              {hasGoods && (
                                                <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" title="Có hàng lưu trữ" />
                                              )}
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400">
                                              Khoang {bayCode}
                                            </span>
                                            {hasGoods ? (
                                              <span className="text-[10px] font-black text-amber-950 bg-amber-300 dark:bg-amber-700 dark:text-amber-50 px-1.5 py-0.5 rounded-md w-full truncate border border-amber-400 shadow-2xs flex items-center justify-center gap-0.5">
                                                {occupiedInfo?.totalPhysical || occupiedInfo?.allocated || 1} sp
                                              </span>
                                            ) : (
                                              <span className="text-[9px] font-extrabold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded w-full truncate">
                                                {isCustom ? `${isCustom.maxWeight}kg` : `${rack.defaultBinMaxWeight || 500}kg`}
                                              </span>
                                            )}
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
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
