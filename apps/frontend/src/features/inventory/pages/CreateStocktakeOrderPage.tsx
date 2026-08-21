import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Plus,
  Trash2,
  Save,
  Printer,
  X,
  XCircle,
  CheckCircle2,
  Warehouse as WarehouseIcon,
  User,
  Package,
  ScanLine,
  RefreshCw,
  ClipboardList,
  FileText,
  Eye,
  LayoutGrid,
  Layers,
} from 'lucide-react';
import MainLayout from '../../../shared/components/MainLayout';
import BarcodeScanner from '../../../shared/components/BarcodeScanner';
import { filterOutDeletedProducts } from '../../../shared/utils/productUtils';
import { SmartSlottingGridModal } from '../../warehouses/components/SmartSlottingGridModal';

// ─── TYPES & INTERFACES ────────────────────────────────────────

const API_BASE = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

export interface ProductOption {
  id: string;
  internalSku: string;
  supplierBarcode?: string;
  name: string;
  unit?: string;
  price?: number;
  importPrice?: number;
  totalStock?: number;
  totalPhysical?: number;
  stockQty?: number;
  stockBalances?: Array<{
    id?: string;
    locationCode: string;
    totalPhysical?: number;
    allocated?: number;
    available?: number;
  }>;
}

export interface ZoneItem {
  zoneCode: string;
  zoneName: string;
  locationBin?: string; // Automatically retrieved shelf/bin location from CSDL
  assignedBins?: string[]; // Array of bin codes
  systemQty: number;
  countedQty: number;
  assignedStaff: string; // Staff assigned to count this specific zone/product row
  note: string;
}

export interface StocktakeRicItem {
  product: ProductOption & { systemQty: number };
  zones: ZoneItem[];
}

export function findStockBinForProduct(
  pId: string,
  pSku: string,
  pName: string,
  whCode?: string
): { locationBin: string; assignedBins: string[] } {
  if (!pId && !pSku && !pName) {
    return { locationBin: '', assignedBins: [] };
  }

  const normId = String(pId || '').trim().toLowerCase();
  const normSku = String(pSku || '').trim().toLowerCase();
  const normName = String(pName || '').trim().toLowerCase();
  const targetWh = String(whCode || '').trim().toUpperCase();

  const foundBinsSet = new Set<string>();

  // 1. Check local stock-in orders
  try {
    const rawOrders = localStorage.getItem('stored_stock_in_orders');
    if (rawOrders) {
      const orders = JSON.parse(rawOrders);
      if (Array.isArray(orders)) {
        orders.forEach((ord: any) => {
          const oWh = String(ord.warehouseCode || ord.branchCode || '').trim().toUpperCase();
          if (targetWh && oWh && oWh !== targetWh && !oWh.includes(targetWh) && !targetWh.includes(oWh)) return;
          (ord.details || ord.items || []).forEach((item: any) => {
            const iName = String(item.productName || '').trim().toLowerCase();
            const iSku = String(item.sku || item.productSku || '').trim().toLowerCase();
            const iId = String(item.productId || '').trim().toLowerCase();

            const matches =
              (normId && iId && normId === iId) ||
              (normSku && iSku && normSku === iSku) ||
              (normName && iName && (normName.includes(iName) || iName.includes(normName)));

            if (matches) {
              let bins: string[] = item.assignedBins || (item.locationBin ? item.locationBin.split(',') : []);
              bins.forEach((b: string) => {
                const clean = b.split('(')[0].trim();
                const short = (clean.split('-').pop() || clean).toUpperCase();
                if (short) foundBinsSet.add(short);
              });
            }
          });
        });
      }
    }
  } catch {}

  // 2. Check stored warehouses customBins
  try {
    const rawWhs = localStorage.getItem('smart-wms-warehouses');
    if (rawWhs) {
      const whs = JSON.parse(rawWhs);
      if (Array.isArray(whs)) {
        whs.forEach((wh: any) => {
          const wCode = String(wh.code || wh.id || '').trim().toUpperCase();
          if (targetWh && wCode && wCode !== targetWh && !wCode.includes(targetWh) && !targetWh.includes(wCode)) return;
          (wh.subWarehouses || []).forEach((sub: any) => {
            (sub.racks || []).forEach((rk: any) => {
              if (rk.customBins) {
                Object.entries(rk.customBins).forEach(([bKey, cfg]: [string, any]) => {
                  const notes = String(cfg?.notes || '').toLowerCase();
                  const pct = Number(cfg?.occupancyPct || 0);
                  if (
                    pct > 0 &&
                    ((normName && notes.includes(normName)) || (normSku && notes.includes(normSku)))
                  ) {
                    const shortBin = (bKey.split('-').pop() || bKey).toUpperCase();
                    foundBinsSet.add(shortBin);
                  }
                });
              }
            });
          });
        });
      }
    }
  } catch {}

  const binsList = Array.from(foundBinsSet);
  if (binsList.length > 0) {
    return {
      locationBin: binsList.join(', '),
      assignedBins: binsList,
    };
  }

  return { locationBin: '', assignedBins: [] };
}

export function getProductWarehouseStock(p: ProductOption, whCode: string): number {
  if (!p) return 0;

  const targetCode = (whCode || '').trim().toLowerCase();

  // 1. Check stockBalances if array exists
  if (Array.isArray(p.stockBalances)) {
    const match = p.stockBalances.find((b) => {
      const bCode = (b.locationCode || '').trim().toLowerCase();
      if (bCode === targetCode) return true;
      if (
        (targetCode === 'kh006' || targetCode === 'kho thanh trì') &&
        (bCode === 'kh006' || bCode === 'kho thanh trì' || bCode === 'kho-nvl')
      ) {
        return true;
      }
      return false;
    });

    if (match) {
      if (match.totalPhysical !== undefined && match.totalPhysical !== null) {
        return Number(match.totalPhysical);
      }
      if (match.available !== undefined && match.available !== null) {
        return Number(match.available);
      }
    }

    return 0;
  }

  if (!whCode) {
    return Number(p.totalStock ?? p.totalPhysical ?? p.stockQty ?? 0);
  }

  return 0;
}

export function findProductStockAndBinsByZone(
  p: ProductOption,
  whCode: string,
  subWarehouses: any[]
): Array<{
  zoneCode: string;
  zoneName: string;
  systemQty: number;
  locationBin: string;
  assignedBins: string[];
}> {
  const normWh = (whCode || '').trim().toUpperCase();
  const resultsMap = new Map<
    string,
    {
      zoneCode: string;
      zoneName: string;
      systemQty: number;
      binsSet: Set<string>;
    }
  >();

  const getOrCreateZoneResult = (zCode: string, defaultName?: string) => {
    const cleanZCode = zCode.toUpperCase();
    if (!resultsMap.has(cleanZCode)) {
      const matchedSub = subWarehouses.find(
        (s: any) => (s.code || s.id || '').toUpperCase() === cleanZCode
      );
      const zName = matchedSub?.name || defaultName || `Phân khu ${cleanZCode}`;
      resultsMap.set(cleanZCode, {
        zoneCode: cleanZCode,
        zoneName: zName,
        systemQty: 0,
        binsSet: new Set<string>(),
      });
    }
    return resultsMap.get(cleanZCode)!;
  };

  // 1. Check stockBalances
  if (Array.isArray(p.stockBalances) && p.stockBalances.length > 0) {
    p.stockBalances.forEach((b: any) => {
      const bLoc = String(b.locationCode || '').trim().toUpperCase();
      const bQty = Number(b.totalPhysical || b.available || 0);
      let bBins: string[] = Array.isArray(b.assignedBins)
        ? b.assignedBins
        : b.locationBin
        ? String(b.locationBin).split(',').map((s) => s.trim())
        : [];

      if (bLoc) {
        const matchingSub = subWarehouses.find(
          (s: any) => (s.code || s.id || '').toUpperCase() === bLoc
        );
        if (matchingSub) {
          const res = getOrCreateZoneResult(matchingSub.code || matchingSub.id, matchingSub.name);
          res.systemQty += bQty;
          bBins.forEach((bin) => bin && res.binsSet.add(bin));
        } else if (
          bLoc === normWh ||
          bLoc === 'KH006' ||
          bLoc === 'KHO-NVL' ||
          bLoc === 'KHO-TONG'
        ) {
          if (bBins.length > 0) {
            bBins.forEach((bin) => {
              const prefix = bin.split('-')[0] || '';
              const sub =
                subWarehouses.find((s) =>
                  (s.code || s.id || '').toUpperCase().includes(prefix.toUpperCase())
                ) || subWarehouses[0];
              if (sub) {
                const res = getOrCreateZoneResult(sub.code || sub.id, sub.name);
                res.binsSet.add(bin);
                if (res.systemQty === 0 && bQty > 0) res.systemQty = bQty;
              }
            });
          } else {
            const firstSub = subWarehouses[0];
            if (firstSub) {
              const res = getOrCreateZoneResult(firstSub.code || firstSub.id, firstSub.name);
              res.systemQty += bQty;
            }
          }
        }
      }
    });
  }

  // 2. Check local stock-in history for bin assignments
  try {
    const rawOrders = localStorage.getItem('stored_stock_in_orders');
    if (rawOrders) {
      const orders = JSON.parse(rawOrders);
      if (Array.isArray(orders)) {
        orders.forEach((ord: any) => {
          const oWh = String(ord.warehouseCode || ord.branchCode || '').trim().toUpperCase();
          if (normWh && oWh && oWh !== normWh && !oWh.includes(normWh) && !normWh.includes(oWh))
            return;
          (ord.details || ord.items || []).forEach((item: any) => {
            const iSku = String(item.sku || item.productSku || '').trim().toUpperCase();
            const iId = String(item.productId || '').trim();
            if (iId === String(p.id) || (iSku && iSku === (p.internalSku || '').toUpperCase())) {
              let bins: string[] =
                item.assignedBins || (item.locationBin ? item.locationBin.split(',') : []);
              bins.forEach((b: string) => {
                const clean = b.split('(')[0].trim().toUpperCase();
                if (clean) {
                  const rackPrefix = clean.split('-')[0] || '';
                  const sub =
                    subWarehouses.find(
                      (s) =>
                        (s.code || s.id || '').toUpperCase() === rackPrefix ||
                        (s.code || s.id || '').toUpperCase().includes(rackPrefix)
                    ) || subWarehouses[0];

                  if (sub) {
                    const res = getOrCreateZoneResult(sub.code || sub.id, sub.name);
                    res.binsSet.add(clean);
                  }
                }
              });
            }
          });
        });
      }
    }
  } catch {}

  // 3. Fallback autoBins lookup from CSDL / localStorage
  const autoBins = findStockBinForProduct(p.id, p.internalSku, p.name, whCode);

  // If no zone entries formed yet, fallback to active sub-warehouses where total system stock or autoBins are allocated
  if (resultsMap.size === 0) {
    const firstSub = subWarehouses[0] || { code: 'PK-A', name: 'Phân Khu A' };
    const totalSys = getProductWarehouseStock(p, whCode);
    const binsSet = new Set<string>(autoBins.assignedBins || []);

    return [
      {
        zoneCode: firstSub.code || firstSub.id,
        zoneName: firstSub.name,
        systemQty: totalSys,
        locationBin: Array.from(binsSet).join(', '),
        assignedBins: Array.from(binsSet),
      },
    ];
  }

  // Ensure autoBins are also attached if missing
  if (autoBins.assignedBins.length > 0) {
    const firstRes = Array.from(resultsMap.values())[0];
    if (firstRes) {
      autoBins.assignedBins.forEach((b) => firstRes.binsSet.add(b));
    }
  }

  return Array.from(resultsMap.values()).map((res) => {
    const binsArray = Array.from(res.binsSet);
    return {
      zoneCode: res.zoneCode,
      zoneName: res.zoneName,
      systemQty: res.systemQty,
      locationBin: binsArray.join(', '),
      assignedBins: binsArray,
    };
  });
}

// ─── MAIN COMPONENT ────────────────────────────────────────────

export default function CreateStocktakeOrderPage({
  standalone = true,
  onBack,
}: {
  standalone?: boolean;
  onBack?: () => void;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const userIdentifier = currentUser.fullName || currentUser.email || '';
  const userRole = currentUser.role || '';
  const isStaff = userRole === 'staff';
  const isManager = userRole === 'manager' || userRole === 'admin';

  // Form State
  const [locationCode, setLocationCode] = useState('');
  const [plannedDate, setPlannedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [createdByStaff, setCreatedByStaff] = useState(userIdentifier);
  const [note, setNote] = useState('');
  const [branch, setBranch] = useState('');
  const [purpose, setPurpose] = useState('');

  // Items State (Merged Rowspan Product Items with Zone Rows and Individual Staff Assignment)
  const [items, setItems] = useState<StocktakeRicItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Storage Info Modal State
  const [storageInfoProduct, setStorageInfoProduct] = useState<{
    productId: string;
    productSku: string;
    productName: string;
    unit: string;
  } | null>(null);
  const [storageInfoBalances, setStorageInfoBalances] = useState<any[]>([]);
  const [loadingStorageInfo, setLoadingStorageInfo] = useState(false);

  // Rack & Bin Locator Modal State
  const [rackModalData, setRackModalData] = useState<{
    product: ProductOption;
    zone: ZoneItem;
  } | null>(null);

  // Master Data
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // Toast Notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showSuccess = (msg: string) => setToast({ message: msg, type: 'success' });
  const showError = (msg: string) => setToast({ message: msg, type: 'error' });

  // Load Master Data
  const loadMasterData = useCallback(async () => {
    try {
      const [whRes, uRes, pRes] = await Promise.all([
        fetch(`${API_BASE}/warehouses`, { headers: authHeaders() }).catch(() => null),
        fetch(`${API_BASE}/users`, { headers: authHeaders() }).catch(() => null),
        fetch(`${API_BASE}/products`, { headers: authHeaders() }).catch(() => null),
      ]);

      if (whRes && whRes.ok) {
        const whData = await whRes.json();
        setWarehouses(whData);
        if (whData.length > 0 && !locationCode) {
          setLocationCode(whData[0].code || whData[0].id || 'KH006');
        }
      }
      if (uRes && uRes.ok) {
        const uData = await uRes.json();
        setUsers(uData);
      }
      if (pRes && pRes.ok) {
        const pData = await pRes.json();
        setProducts(filterOutDeletedProducts(Array.isArray(pData) ? pData : pData.data || []));
      }
    } catch (err) {
      showError('Không thể tải dữ liệu danh mục');
    }
  }, [locationCode]);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  // Active Sub-Warehouses / Zones for the selected Warehouse
  const activeSubWarehouses = useMemo(() => {
    if (!locationCode) return [];
    const wh = warehouses.find((w) => w.code === locationCode || w.id === locationCode);
    if (wh && Array.isArray(wh.subWarehouses) && wh.subWarehouses.length > 0) {
      return wh.subWarehouses;
    }
    // Fallback standard sub-warehouses
    return [
      { id: 'sub_a', code: 'PK-A', name: 'Phân Khu A - Hàng Thường', zoneType: 'AMBIENT' },
      { id: 'sub_b', code: 'PK-B', name: 'Phân Khu B - Hàng Lạnh', zoneType: 'COLD' },
      { id: 'sub_c', code: 'PK-C', name: 'Phân Khu C - Hàng Giá Trị Cao', zoneType: 'THERMAL' },
    ];
  }, [locationCode, warehouses]);

  // Recalculate zone rows & systemQty when warehouse changes
  useEffect(() => {
    if (!locationCode) return;
    setItems((prev) => {
      return prev.map((item) => {
        const fullProduct = products.find((p) => p.id === item.product.id) || item.product;
        const zoneLocations = findProductStockAndBinsByZone(fullProduct, locationCode, activeSubWarehouses);

        const updatedZones: ZoneItem[] = zoneLocations.map((zLoc) => {
          const existingMatch = item.zones.find((z) => z.zoneCode.toLowerCase() === zLoc.zoneCode.toLowerCase());
          return {
            zoneCode: zLoc.zoneCode,
            zoneName: zLoc.zoneName,
            locationBin: zLoc.locationBin,
            assignedBins: zLoc.assignedBins,
            systemQty: zLoc.systemQty,
            countedQty: existingMatch ? existingMatch.countedQty : zLoc.systemQty,
            assignedStaff: existingMatch?.assignedStaff || userIdentifier || 'System Administrator',
            note: existingMatch?.note || (zLoc.locationBin ? `[Kệ: ${zLoc.locationBin}]` : ''),
          };
        });

        const totalSys = updatedZones.reduce((sum, z) => sum + (z.systemQty || 0), 0);

        return {
          ...item,
          product: {
            ...item.product,
            systemQty: totalSys,
          },
          zones: updatedZones,
        };
      });
    });
  }, [locationCode, products, activeSubWarehouses, userIdentifier]);

  // Click outside listener to close search dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('.product-search-box')) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Open Storage Info Modal
  const handleOpenStorageInfo = async (product: ProductOption) => {
    if (!product?.id) {
      showError('Vui lòng chọn hàng hóa trước khi xem thông tin lưu trữ');
      return;
    }
    setStorageInfoProduct({
      productId: product.id,
      productSku: product.internalSku || 'SKU',
      productName: product.name || 'Hàng hóa',
      unit: product.unit || 'Cái',
    });
    setLoadingStorageInfo(true);
    try {
      const res = await fetch(`${API_BASE}/products/${product.id}`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setStorageInfoBalances(data.stockBalances || []);
      } else {
        setStorageInfoBalances(product.stockBalances || []);
      }
    } catch {
      setStorageInfoBalances(product.stockBalances || []);
    } finally {
      setLoadingStorageInfo(false);
    }
  };

  // Staff options lookup with fallback
  const staffList = useMemo(() => {
    const list = Array.isArray(users) ? users : [];
    if (list.length > 0) return list;
    return [
      { id: 'u1', fullName: 'System Administrator', role: 'admin' },
      { id: 'u2', fullName: 'Nguyễn Văn Kiểm (NV Kho)', role: 'staff' },
      { id: 'u3', fullName: 'Trần Thị Kiểm (NV Kho)', role: 'staff' },
      { id: 'u4', fullName: 'Hoàng Minh Tuấn (Quản lý)', role: 'manager' },
    ];
  }, [users]);

  // Add Product (Automatically populates sub-warehouses & shelf/bins from CSDL)
  const handleAddProduct = (p: any) => {
    if (items.some((item) => item.product.id === p.id)) {
      showError(`Sản phẩm [${p.internalSku}] đã có trong danh sách kiểm kê.`);
      setProductSearch('');
      setShowDropdown(false);
      return;
    }

    const zoneLocations = findProductStockAndBinsByZone(p, locationCode, activeSubWarehouses);

    const initialZones: ZoneItem[] = zoneLocations.map((zLoc) => ({
      zoneCode: zLoc.zoneCode,
      zoneName: zLoc.zoneName,
      locationBin: zLoc.locationBin,
      assignedBins: zLoc.assignedBins,
      systemQty: zLoc.systemQty,
      countedQty: zLoc.systemQty,
      assignedStaff: userIdentifier || 'System Administrator',
      note: zLoc.locationBin ? `[Kệ: ${zLoc.locationBin}]` : '',
    }));

    const totalSys = initialZones.reduce((sum, z) => sum + (z.systemQty || 0), 0);

    setItems((prev) => [
      ...prev,
      {
        product: {
          id: p.id,
          internalSku: p.internalSku,
          supplierBarcode: p.supplierBarcode,
          name: p.name,
          unit: p.unit || 'Cái',
          price: p.price ?? p.importPrice ?? 0,
          stockBalances: p.stockBalances || [],
          systemQty: totalSys,
        },
        zones: initialZones,
      },
    ]);
    setProductSearch('');
    setShowDropdown(false);
  };

  // Update Counted Qty for a specific Zone
  const handleUpdateZoneCounted = (productIndex: number, zoneIndex: number, val: number) => {
    setItems((prev) => {
      const next = [...prev];
      const prod = { ...next[productIndex] };
      const zones = [...prod.zones];
      zones[zoneIndex] = { ...zones[zoneIndex], countedQty: val >= 0 ? val : 0 };
      prod.zones = zones;
      next[productIndex] = prod;
      return next;
    });
  };

  // Update Zone Code / Name
  const handleUpdateZoneCode = (productIndex: number, zoneIndex: number, newZCode: string) => {
    const selectedZone = activeSubWarehouses.find((s: any) => s.code === newZCode || s.id === newZCode);
    const newZName = selectedZone?.name || `Phân khu ${newZCode}`;

    setItems((prev) => {
      const next = [...prev];
      const prod = { ...next[productIndex] };
      const zones = [...prod.zones];
      zones[zoneIndex] = {
        ...zones[zoneIndex],
        zoneCode: newZCode,
        zoneName: newZName,
      };
      prod.zones = zones;
      next[productIndex] = prod;
      return next;
    });
  };

  // Update Assigned Staff per Zone/Product Row
  const handleUpdateZoneStaff = (productIndex: number, zoneIndex: number, staffName: string) => {
    setItems((prev) => {
      const next = [...prev];
      const prod = { ...next[productIndex] };
      const zones = [...prod.zones];
      zones[zoneIndex] = { ...zones[zoneIndex], assignedStaff: staffName };
      prod.zones = zones;
      next[productIndex] = prod;
      return next;
    });
  };

  // Update Note for a specific Zone
  const handleUpdateZoneNote = (productIndex: number, zoneIndex: number, val: string) => {
    setItems((prev) => {
      const next = [...prev];
      const prod = { ...next[productIndex] };
      const zones = [...prod.zones];
      zones[zoneIndex] = { ...zones[zoneIndex], note: val };
      prod.zones = zones;
      next[productIndex] = prod;
      return next;
    });
  };

  // Delete a specific Zone sub-row
  const handleRemoveZoneRow = (productIndex: number, zoneIndex: number) => {
    setItems((prev) => {
      const next = [...prev];
      const prod = { ...next[productIndex] };
      const zones = prod.zones.filter((_, idx) => idx !== zoneIndex);
      if (zones.length === 0) {
        // If all zones removed, remove whole product
        return prev.filter((_, idx) => idx !== productIndex);
      }
      prod.zones = zones;
      next[productIndex] = prod;
      return next;
    });
  };

  // Add a new Zone sub-row to a Product
  const handleAddZoneToProduct = (productIndex: number) => {
    setItems((prev) => {
      const next = [...prev];
      const prod = { ...next[productIndex] };
      const existingZoneCodes = prod.zones.map((z) => z.zoneCode);
      const remainingZone =
        activeSubWarehouses.find((s: any) => !existingZoneCodes.includes(s.code || s.id)) ||
        activeSubWarehouses[0];

      const zCode = remainingZone?.code || remainingZone?.id || `PK-NEW`;
      const zName = remainingZone?.name || `Phân khu ${zCode}`;

      prod.zones = [
        ...prod.zones,
        {
          zoneCode: zCode,
          zoneName: zName,
          systemQty: 0,
          countedQty: 0,
          assignedStaff: userIdentifier,
          note: '',
        },
      ];
      next[productIndex] = prod;
      return next;
    });
  };

  const handleClose = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/inventory/stocktake');
    }
  };

  // Submit Stocktake Order
  const executeSubmit = async (finalStatus: string = 'DRAFT', isPrint: boolean = false) => {
    if (!locationCode) {
      showError('Vui lòng chọn Kho kiểm kê');
      return;
    }
    if (items.length === 0 && finalStatus !== 'DRAFT') {
      showError('Vui lòng chọn ít nhất 1 sản phẩm để kiểm kê');
      return;
    }
    setSubmitting(true);
    try {
      // Flatten all zones per product into backend items payload
      const itemsPayload: any[] = [];
      const productIds: string[] = [];

      items.forEach((item) => {
        const pId = String(item.product.id || item.product.internalSku);
        if (!productIds.includes(pId)) productIds.push(pId);

        item.zones.forEach((z) => {
          itemsPayload.push({
            productId: pId,
            countedQty: Number(z.countedQty) >= 0 ? Number(z.countedQty) : 0,
            assignee: z.assignedStaff || createdByStaff || userIdentifier,
            note: z.note
              ? `[${z.zoneName || z.zoneCode}] ${z.note}`
              : `[${z.zoneName || z.zoneCode}]`,
          });
        });
      });

      const isRequest = searchParams.get('mode') === 'request' || !isManager;

      const res = await fetch(`${API_BASE}/inventory/stocktakes`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          locationCode,
          plannedDate: plannedDate ? new Date(plannedDate).toISOString() : undefined,
          assignee: createdByStaff || userIdentifier,
          note: note.trim() || undefined,
          isRequest: isRequest || undefined,
          createdBy: userIdentifier,
          branch,
          purpose,
          status: finalStatus,
          items: itemsPayload.length > 0 ? itemsPayload : undefined,
          productIds: productIds.length > 0 ? productIds : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Không thể tạo phiếu kiểm kê');
      }
      const created = await res.json();

      if (
        finalStatus === 'COUNTING_DONE' &&
        items.length > 0 &&
        created.status !== 'COUNTING_DONE' &&
        created.status !== 'REQUESTED'
      ) {
        await fetch(`${API_BASE}/inventory/stocktakes/${created.id}/finish-counting`, {
          method: 'POST',
          headers: authHeaders(),
        }).catch(() => null);
      }

      showSuccess(`Đã lưu thành công phiếu kiểm kê ${created.stocktakeNo || ''}!`);

      if (isPrint) {
        window.print();
      }

      setTimeout(() => {
        handleClose();
      }, 1000);
    } catch (err: any) {
      showError(err.message || 'Lỗi khi lưu phiếu kiểm kê');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter products for quick search dropdown
  const filteredProducts = useMemo(() => {
    const kw = productSearch.trim().toLowerCase();
    if (!kw) return products;
    return products.filter((p) => {
      const matchCode =
        p.internalSku?.toLowerCase().includes(kw) || p.supplierBarcode?.toLowerCase().includes(kw);
      const matchName = p.name?.toLowerCase().includes(kw);
      return matchCode || matchName;
    });
  }, [products, productSearch]);

  // Overall Statistics Aggregated Across Products & Zones
  const totalSystemQty = items.reduce(
    (sum, item) => sum + item.zones.reduce((zSum, z) => zSum + (z.systemQty || 0), 0),
    0
  );
  const totalCountedQty = items.reduce(
    (sum, item) => sum + item.zones.reduce((zSum, z) => zSum + Number(z.countedQty || 0), 0),
    0
  );
  const totalDifference = totalCountedQty - totalSystemQty;

  const contentMarkup = (
    <div className="space-y-4 pb-24 animate-[fadeIn_0.2s_ease-out]">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[9999] flex items-center gap-3 rounded-xl px-5 py-3 shadow-xl transition-all border ${
            toast.type === 'error'
              ? 'bg-red-50 text-red-600 border-red-200'
              : 'bg-emerald-50 text-emerald-600 border-emerald-200'
          }`}
        >
          {toast.type === 'error' ? <XCircle size={20} /> : <CheckCircle2 size={20} />}
          <p className="text-sm font-bold">{toast.message}</p>
          <button onClick={() => setToast(null)} className="ml-2 rounded-lg p-1 hover:bg-white/50 transition cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {scannerOpen && (
        <BarcodeScanner
          isOpen={scannerOpen}
          onProductFound={(scanned) => {
            const matchProduct =
              products.find(
                (p) =>
                  p.id === scanned.id ||
                  p.internalSku === scanned.internalSku ||
                  p.supplierBarcode === scanned.internalSku
              ) || scanned;
            handleAddProduct(matchProduct);
            showSuccess(`Đã quét mã sản phẩm: ${scanned.name || scanned.internalSku}`);
          }}
          onClose={() => setScannerOpen(false)}
          title="Quét Barcode Hàng Hóa Kiểm Kê"
        />
      )}

      {/* Storage Info Modal (Xem thông tin lưu trữ tất cả các kho) */}
      {storageInfoProduct && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 animate-[fadeIn_0.2s_ease-out]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <WarehouseIcon className="h-5 w-5 text-cyan-600" />
                <h3 className="text-sm font-black uppercase text-slate-800 tracking-wide">
                  THÔNG TIN LƯU TRỮ KHO - {storageInfoProduct.productSku}
                </h3>
              </div>
              <button
                onClick={() => setStorageInfoProduct(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 rounded-xl border border-cyan-200 bg-cyan-50/60 p-3 flex items-center justify-between text-xs">
              <div>
                <span className="font-extrabold text-slate-700">Tên hàng hóa: </span>
                <span className="font-bold text-cyan-950">{storageInfoProduct.productName}</span>
              </div>
              <div>
                <span className="font-extrabold text-slate-700">Tổng tồn hệ thống: </span>
                <span className="font-black text-cyan-700 font-mono text-sm">
                  {(
                    storageInfoBalances.reduce(
                      (s, b) => s + (Number(b.available) || Number(b.totalPhysical) || 0),
                      0
                    )
                  ).toLocaleString('vi-VN')}{' '}
                  {storageInfoProduct.unit}
                </span>
              </div>
            </div>

            {loadingStorageInfo ? (
              <div className="py-10 text-center text-xs font-bold text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-cyan-600" />
                Đang tải vị trí kho lưu trữ...
              </div>
            ) : storageInfoBalances.length === 0 ? (
              <div className="py-8 text-center text-xs font-semibold text-slate-400 italic bg-slate-50 rounded-xl border border-slate-200">
                Chưa có ghi nhận tồn kho chi tiết tại các vị trí.
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto custom-scrollbar border rounded-xl border-slate-200">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 font-extrabold text-slate-700 uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 text-center w-12">STT</th>
                      <th className="p-2.5">Mã kho / Vị trí</th>
                      <th className="p-2.5 text-center">Tồn vật lý</th>
                      <th className="p-2.5 text-center">Đã giữ (Allocated)</th>
                      <th className="p-2.5 text-center text-cyan-800 font-black">Khả dụng (Available)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {storageInfoBalances.map((b, idx) => {
                      const avail = Number(b.available || 0);
                      const phys = Number(b.totalPhysical || avail);
                      const alloc = Number(b.allocated || 0);
                      const whMatch = warehouses.find(
                        (w) => w.code === b.locationCode || w.id === b.locationCode
                      );
                      const whName = whMatch ? `${whMatch.name} (${b.locationCode})` : b.locationCode;

                      return (
                        <tr key={b.id || idx} className="hover:bg-cyan-50/50 font-medium">
                          <td className="p-2 text-center text-slate-500 font-bold">{idx + 1}</td>
                          <td className="p-2 font-bold text-slate-800">{whName}</td>
                          <td className="p-2 text-center font-mono font-bold text-slate-700">
                            {phys.toLocaleString('vi-VN')}
                          </td>
                          <td className="p-2 text-center font-mono font-semibold text-amber-700">
                            {alloc.toLocaleString('vi-VN')}
                          </td>
                          <td className="p-2 text-center font-mono font-black text-emerald-600 bg-emerald-50/50">
                            {avail.toLocaleString('vi-VN')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setStorageInfoProduct(null)}
                className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rack & Bin Locator Modal (SmartSlottingGridModal) */}
      <SmartSlottingGridModal
        isOpen={!!rackModalData}
        onClose={() => setRackModalData(null)}
        mode="OUTBOUND_TRANSFER"
        warehouseCode={locationCode || 'KH006'}
        items={items.map((it) => ({
          rowId: String(it.product.id),
          productId: String(it.product.id),
          productSku: it.product.internalSku,
          productName: it.product.name,
          unit: it.product.unit || 'Cái',
          qty: it.zones.reduce((s, z) => s + (z.countedQty || 0), 0),
          warehouseCode: locationCode || 'KH006',
        }))}
        targetRowId={rackModalData ? String(rackModalData.product.id) : null}
        products={products}
        onConfirmAll={() => {
          setRackModalData(null);
        }}
      />

      {/* ═══ 1. TOP HEADER BAR ═══ */}
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2.5 rounded-xl bg-cyan-600 px-4 py-2 text-white shadow-sm">
          <ClipboardList className="h-5 w-5" />
          <h1 className="text-base font-black tracking-tight uppercase">TẠO PHIẾU KIỂM KÊ HÀNG HÓA</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-cyan-700 bg-white px-3.5 py-1.5 text-xs font-extrabold text-cyan-700 shadow-xs hover:bg-cyan-50 transition cursor-pointer"
          >
            <ScanLine className="h-4 w-4" />
            <span>Quét Barcode</span>
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-cyan-50 hover:border-cyan-600 hover:text-cyan-700 transition shadow-2xs cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Quay lại</span>
          </button>
        </div>
      </div>

      {/* ═══ 2. FORM METADATA CONTROL BAR ═══ */}
      <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Ngày kiểm kê */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Ngày kiểm kê</label>
            <input
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              className="h-9 w-full rounded-lg border-2 border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-cyan-600 cursor-pointer shadow-2xs"
            />
          </div>

          {/* Mã phiếu kiểm */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Mã phiếu kiểm kê</label>
            <input
              type="text"
              readOnly
              placeholder="MÃ TỰ ĐỘNG (KK...)"
              className="h-9 w-full rounded-lg border-2 border-slate-200 bg-slate-50 px-3 text-xs font-bold text-cyan-800 uppercase outline-none focus:border-cyan-600"
            />
          </div>

          {/* Chọn Kho kiểm kê */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
              <WarehouseIcon className="h-3.5 w-3.5 text-cyan-600" />
              <span>Kho kiểm kê (*)</span>
            </label>
            <select
              value={locationCode}
              onChange={(e) => setLocationCode(e.target.value)}
              className="h-9 w-full rounded-lg border-2 border-cyan-500 bg-cyan-50/50 px-3 text-xs font-bold text-cyan-900 outline-none focus:border-cyan-600 cursor-pointer"
            >
              {warehouses.length > 0 ? (
                warehouses.map((wh) => (
                  <option key={wh.id || wh.code} value={wh.code}>
                    [{wh.code}] {wh.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="KH006">KH006 - Kho Thanh Trì</option>
                  <option value="KH001">KH001 - Kho Hà Đông</option>
                  <option value="KH002">KH002 - Kho Chi Nhánh HCM</option>
                </>
              )}
            </select>
          </div>

          {/* Người lập / Quản lý phiếu */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-cyan-600" />
              <span>Người tạo / Quản lý</span>
            </label>
            <input
              type="text"
              value={createdByStaff}
              readOnly
              className="h-9 w-full rounded-lg border-2 border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 outline-none"
            />
          </div>
        </div>
      </div>

      {/* ═══ 3. DUAL PANE MAIN SECTION ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ── LEFT COLUMN (9/12 width): PRODUCT TABLE WITH ROWSPAN ── */}
        <div className="lg:col-span-9 flex flex-col rounded-xl border-2 border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Section Header */}
          <div className="px-3 py-2 border-b-2 border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2 text-cyan-800 font-extrabold text-xs">
              <Package className="h-4 w-4 text-cyan-600" />
              <span>DANH SÁCH HÀNG HÓA KIỂM KÊ ({items.length} SẢN PHẨM)</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg border-2 border-cyan-600 bg-white px-3 py-1 text-xs font-bold text-cyan-700 hover:bg-cyan-50 transition cursor-pointer"
              >
                <ScanLine className="h-3.5 w-3.5 text-cyan-600" />
                <span>Quét Barcode</span>
              </button>

              <button
                type="button"
                onClick={loadMasterData}
                className="inline-flex items-center gap-1 rounded-lg border-2 border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                title="Làm mới dữ liệu"
              >
                <RefreshCw className="h-3.5 w-3.5 text-cyan-600" />
                <span>Làm mới</span>
              </button>
            </div>
          </div>

          {/* Quick Search Input */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 product-search-box">
            <div className="relative">
              <input
                type="text"
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setShowDropdown(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredProducts.length > 0) {
                    e.preventDefault();
                    handleAddProduct(filteredProducts[0]);
                  }
                }}
                onFocus={() => setShowDropdown(true)}
                onClick={() => setShowDropdown(true)}
                placeholder="Gõ mã hoặc tên hàng hóa để tìm kiếm (Bấm Enter để chọn)..."
                className="h-10 w-full rounded-lg border-2 border-cyan-500/60 bg-white px-3.5 pl-10 text-xs font-bold text-slate-800 outline-none shadow-2xs focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-600" />

              {/* DROPDOWN SEARCH RESULTS TABLE */}
              {showDropdown && (
                <div
                  className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-72 overflow-hidden rounded-xl border-2 border-cyan-500/50 bg-white shadow-2xl flex flex-col animate-in fade-in duration-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex bg-slate-100 border-b border-slate-200 px-3.5 py-2 text-[11px] font-extrabold text-slate-700 uppercase">
                    <span className="w-1/2">MÃ / TÊN HÀNG HÓA</span>
                    <span className="w-1/4 text-center">GIÁ BÁN</span>
                    <span className="w-1/4 text-center text-cyan-700">TỒN KHO ({locationCode})</span>
                  </div>

                  <div className="overflow-y-auto flex-1 max-h-60 divide-y divide-slate-100 custom-scrollbar">
                    {filteredProducts.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400 font-medium">
                        {productSearch.trim()
                          ? 'Không tìm thấy hàng hóa phù hợp'
                          : 'Gõ từ khóa để tìm kiếm hàng hóa trong hệ thống'}
                      </div>
                    ) : (
                      filteredProducts.map((p) => {
                        const systemQty = getProductWarehouseStock(p, locationCode);
                        const price = p.price ?? p.importPrice ?? 0;
                        return (
                          <div
                            key={p.id}
                            onClick={() => handleAddProduct(p)}
                            className="flex items-center px-3.5 py-2.5 hover:bg-cyan-50/80 cursor-pointer text-xs text-slate-700 transition"
                          >
                            <div className="w-1/2 pr-2">
                              <p className="font-extrabold text-cyan-800">{p.internalSku}</p>
                              <p className="text-xs text-slate-800 font-bold truncate">{p.name}</p>
                            </div>
                            <span className="w-1/4 text-center text-slate-600 font-semibold font-mono">
                              {price > 0 ? price.toLocaleString('vi-VN') + ' đ' : '0.00'}
                            </span>
                            <span className="w-1/4 text-center text-cyan-700 font-black text-sm font-mono">
                              {systemQty.toLocaleString('vi-VN')}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200 px-3.5 py-2 bg-slate-50 text-xs text-slate-500 font-bold">
                    <span>Tìm thấy {filteredProducts.length} sản phẩm</span>
                    <button
                      type="button"
                      onClick={() => setShowDropdown(false)}
                      className="text-red-500 hover:text-red-700 font-extrabold cursor-pointer"
                    >
                      ✕ Đóng
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* TABLE WITH ROWSPAN PRODUCT MERGING & PER-ROW STAFF ASSIGNMENT */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 text-slate-800 font-extrabold border-b-2 border-slate-200 uppercase text-xs">
                <tr>
                  <th className="p-2.5 w-12 text-center border-r border-slate-200 bg-slate-100">STT</th>
                  <th className="p-2.5 w-28 text-center border-r border-slate-200 bg-slate-100">MÃ HÀNG</th>
                  <th className="p-2.5 min-w-[160px] border-r border-slate-200 bg-slate-100">TÊN HÀNG HÓA</th>
                  <th className="p-2.5 w-16 text-center border-r border-slate-200 bg-slate-100">ĐVT</th>
                  <th className="p-2.5 w-40 text-center border-r border-slate-200 bg-cyan-50/70 text-cyan-900">
                    PHÂN KHU / DÃY KỆ
                  </th>
                  <th className="p-2.5 w-24 text-center border-r border-slate-200 bg-cyan-50/80 text-cyan-900">
                    SỐ TỒN KHO
                  </th>
                  <th className="p-2.5 w-24 text-center border-r border-slate-200 bg-emerald-50/80 text-emerald-900">
                    THỰC TỒN
                  </th>
                  <th className="p-2.5 w-20 text-center border-r border-slate-200 bg-amber-50/80 text-amber-900">
                    LỆCH
                  </th>
                  <th className="p-2.5 w-40 text-center border-r border-slate-200 bg-indigo-50/80 text-indigo-900">
                    NHÂN VIÊN KIỂM KÊ
                  </th>
                  <th className="p-2.5 min-w-[120px] border-r border-slate-200 bg-slate-100">GHI CHÚ</th>
                  <th className="p-2.5 w-28 text-center bg-slate-100">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-20 text-center text-xs text-slate-400 font-semibold italic">
                      Chưa có hàng hóa nào được chọn để kiểm kê.
                      <br />
                      Vui lòng nhập từ khóa vào ô tìm kiếm ở trên để chọn sản phẩm.
                    </td>
                  </tr>
                ) : (
                  items.map((item, pIdx) => {
                    const zoneCount = item.zones.length;

                    return item.zones.map((zone, zIdx) => {
                      const isFirstZone = zIdx === 0;
                      const isLastZoneInProd = zIdx === zoneCount - 1;
                      const zDiff = zone.countedQty - (zone.systemQty || 0);

                      return (
                        <tr
                          key={`${item.product.id}-${zone.zoneCode}-${zIdx}`}
                          className={`hover:bg-cyan-50/50 transition-colors ${
                            zIdx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'
                          } ${isLastZoneInProd ? 'border-b-2 border-slate-300' : 'border-b border-slate-200'}`}
                        >
                          {/* ══ ROWSPAN MERGED CELL 1: STT ══ */}
                          {isFirstZone && (
                            <td
                              rowSpan={zoneCount}
                              className="p-2.5 text-center font-bold text-slate-600 border-r border-slate-200 bg-slate-50/70 align-middle"
                            >
                              {pIdx + 1}.
                            </td>
                          )}

                          {/* ══ ROWSPAN MERGED CELL 2: MÃ HÀNG ══ */}
                          {isFirstZone && (
                            <td
                              rowSpan={zoneCount}
                              className="p-2.5 text-center font-black text-cyan-800 border-r border-slate-200 bg-slate-50/70 align-middle"
                            >
                              {item.product.internalSku}
                            </td>
                          )}

                          {/* ══ ROWSPAN MERGED CELL 3: TÊN HÀNG HÓA ══ */}
                          {isFirstZone && (
                            <td
                              rowSpan={zoneCount}
                              className="p-2.5 font-extrabold text-slate-900 border-r border-slate-200 bg-slate-50/70 align-middle"
                            >
                              <div>
                                <p className="font-extrabold text-slate-900">{item.product.name}</p>
                                <span className="inline-block mt-1 text-[10px] font-extrabold text-cyan-700 bg-cyan-100/80 px-2 py-0.5 rounded-full">
                                  {zoneCount} phân khu
                                </span>
                              </div>
                            </td>
                          )}

                          {/* ══ ROWSPAN MERGED CELL 4: ĐVT ══ */}
                          {isFirstZone && (
                            <td
                              rowSpan={zoneCount}
                              className="p-2.5 text-center font-semibold text-slate-600 border-r border-slate-200 bg-slate-50/70 align-middle"
                            >
                              {item.product.unit || 'Cái'}
                            </td>
                          )}

                          {/* ══ CELL 5: PHÂN KHU / DÃY KỆ ══ */}
                          <td className="p-1.5 border-r border-slate-200 bg-cyan-50/20">
                            <select
                              value={zone.zoneCode}
                              onChange={(e) => handleUpdateZoneCode(pIdx, zIdx, e.target.value)}
                              className="h-8 w-full rounded-lg border-2 border-slate-200 bg-white px-2 text-[11px] font-extrabold text-cyan-900 outline-none focus:border-cyan-600 cursor-pointer shadow-2xs"
                            >
                              {activeSubWarehouses.map((sub: any) => (
                                <option key={sub.id || sub.code} value={sub.code || sub.id}>
                                  [{sub.code || sub.id}] {sub.name}
                                </option>
                              ))}
                            </select>
                            {/* Interactive shelf/bin button directly opening rack popup modal */}
                            <button
                              type="button"
                              onClick={() => setRackModalData({ product: item.product, zone })}
                              className="mt-1 w-full flex items-center justify-between gap-1 text-[10px] font-extrabold text-cyan-900 bg-cyan-100/90 hover:bg-cyan-200/90 px-2 py-1 rounded-lg border border-cyan-300 shadow-2xs transition cursor-pointer active:scale-95 group"
                              title="Bấm vào để mở sơ đồ kệ - Kệ lưu hàng hiện xanh, không lưu in chìm"
                            >
                              <span className="shrink-0 text-cyan-700 font-bold group-hover:text-cyan-900 flex items-center gap-1">
                                📍 Kệ:
                              </span>
                              <span className="truncate font-extrabold text-cyan-950 group-hover:underline">
                                {zone.locationBin || (zone.assignedBins && zone.assignedBins.length > 0 ? zone.assignedBins.join(', ') : 'Chưa xếp ô')}
                              </span>
                            </button>
                          </td>

                          {/* ══ CELL 6: SỐ TỒN KHO ══ */}
                          <td className="p-2 text-center font-black text-cyan-900 border-r border-slate-200 bg-cyan-50/40 font-mono text-sm">
                            {(zone.systemQty || 0).toLocaleString('vi-VN')}
                          </td>

                          {/* ══ CELL 7: THỰC TỒN ══ */}
                          <td className="p-1 text-center border-r border-slate-200 bg-emerald-50/40">
                            <input
                              type="number"
                              min="0"
                              value={zone.countedQty}
                              onChange={(e) =>
                                handleUpdateZoneCounted(pIdx, zIdx, Number(e.target.value))
                              }
                              className="h-7 w-20 text-center rounded-md border-2 border-emerald-500/80 bg-white font-black text-emerald-900 outline-none text-xs focus:border-emerald-600 shadow-2xs"
                            />
                          </td>

                          {/* ══ CELL 8: LỆCH ══ */}
                          <td className="p-2 text-center border-r border-slate-200 bg-amber-50/40 font-mono text-sm font-black">
                            <span
                              className={
                                zDiff > 0
                                  ? 'text-emerald-600'
                                  : zDiff < 0
                                  ? 'text-red-600'
                                  : 'text-slate-500'
                              }
                            >
                              {zDiff > 0 ? `+${zDiff}` : zDiff}
                            </span>
                          </td>

                          {/* ══ CELL 9: NHÂN VIÊN KIỂM KÊ (Dành riêng từng phân khu) ══ */}
                          <td className="p-1.5 border-r border-slate-200 bg-indigo-50/20">
                            <select
                              value={zone.assignedStaff || ''}
                              onChange={(e) => handleUpdateZoneStaff(pIdx, zIdx, e.target.value)}
                              className="h-8 w-full rounded-lg border-2 border-indigo-200 bg-white px-2 text-[11px] font-bold text-slate-800 outline-none focus:border-indigo-600 cursor-pointer shadow-2xs"
                            >
                              <option value="">— Chọn NV kiểm —</option>
                              {staffList.map((u: any) => {
                                const displayName = u.fullName || u.name || u.username || u.email || `User #${u.id}`;
                                const roleTag = u.role ? ` (${u.role})` : '';
                                return (
                                  <option key={u.id || displayName} value={displayName}>
                                    {displayName}{roleTag}
                                  </option>
                                );
                              })}
                            </select>
                          </td>

                          {/* ══ CELL 10: GHI CHÚ ══ */}
                          <td className="p-1 border-r border-slate-200">
                            <input
                              type="text"
                              value={zone.note || ''}
                              onChange={(e) => handleUpdateZoneNote(pIdx, zIdx, e.target.value)}
                              placeholder="Ghi chú dòng..."
                              className="w-full h-7 px-2 bg-transparent font-medium text-slate-700 outline-none focus:bg-cyan-50 text-xs"
                            />
                          </td>

                          {/* ══ CELL 11: THAO TÁC ══ */}
                          <td className="p-1.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* Rack & Bin Locator Modal Button */}
                              <button
                                type="button"
                                onClick={() => setRackModalData({ product: item.product, zone })}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-300 bg-cyan-100 text-cyan-800 hover:bg-cyan-200 transition cursor-pointer font-bold"
                                title="Xem vị trí dãy kệ & ô kệ trong phân khu này"
                              >
                                <LayoutGrid size={14} />
                              </button>

                              {/* Storage Info Modal Button */}
                              {isFirstZone && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenStorageInfo(item.product)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 transition cursor-pointer font-bold"
                                  title="Xem thông tin lưu trữ tất cả các kho"
                                >
                                  <Eye size={14} />
                                </button>
                              )}

                              {/* Add Zone Button */}
                              <button
                                type="button"
                                onClick={() => handleAddZoneToProduct(pIdx)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition cursor-pointer font-bold"
                                title="Thêm phân khu đếm mới"
                              >
                                <Plus size={14} />
                              </button>

                              {/* Delete Zone Button */}
                              <button
                                type="button"
                                onClick={() => handleRemoveZoneRow(pIdx, zIdx)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition cursor-pointer font-bold"
                                title="Xóa phân khu này khỏi danh sách"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })
                )}
              </tbody>

              {/* TABLE FOOTER SUMMARY ROW */}
              {items.length > 0 && (
                <tfoot className="bg-slate-100 font-extrabold text-slate-800 border-t-2 border-slate-200 uppercase text-xs">
                  <tr>
                    <td colSpan={5} className="p-3 text-right font-extrabold text-slate-800 border-r border-slate-200">
                      TỔNG CỘNG ({items.length} sản phẩm - {items.reduce((s, i) => s + i.zones.length, 0)} phân khu kiểm):
                    </td>
                    <td className="p-3 text-center font-black text-cyan-900 border-r border-slate-200 bg-cyan-100/60 font-mono text-sm">
                      {totalSystemQty.toLocaleString('vi-VN')}
                    </td>
                    <td className="p-3 text-center font-black text-emerald-900 border-r border-slate-200 bg-emerald-100/60 font-mono text-sm">
                      {totalCountedQty.toLocaleString('vi-VN')}
                    </td>
                    <td className="p-3 text-center font-black border-r border-slate-200 bg-amber-100/60 font-mono text-sm">
                      <span
                        className={
                          totalDifference > 0
                            ? 'text-emerald-600'
                            : totalDifference < 0
                            ? 'text-red-600'
                            : 'text-slate-600'
                        }
                      >
                        {totalDifference > 0 ? `+${totalDifference}` : totalDifference}
                      </span>
                    </td>
                    <td className="p-3 border-r border-slate-200 text-slate-400 font-medium italic text-center">—</td>
                    <td className="p-3 border-r border-slate-200 text-slate-400 font-medium italic text-center">—</td>
                    <td className="p-3 text-center text-slate-400 font-medium italic">—</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* ── RIGHT COLUMN (3/12 width): SUMMARY & ACTIONS ── */}
        <div className="lg:col-span-3 flex flex-col space-y-4">
          <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase text-cyan-900 tracking-wider border-b-2 border-slate-100 pb-2">
              TỔNG QUAN PHIẾU KIỂM KÊ
            </h3>

            {/* Ghi chú chung */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Ghi chú chung</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nhập ghi chú chung cho phiếu kiểm..."
                rows={4}
                className="w-full rounded-lg border-2 border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-800 outline-none focus:border-cyan-600 resize-none shadow-2xs"
              />
            </div>

            {/* Light Theme Summary Card */}
            <div className="rounded-xl border-2 border-cyan-200 bg-cyan-50/60 p-4 shadow-sm space-y-2.5 text-slate-800">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Số mặt hàng kiểm kê:</span>
                <span className="font-extrabold text-slate-900 font-mono">{items.length}</span>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Tổng số dòng phân khu:</span>
                <span className="font-extrabold text-cyan-950 font-mono">
                  {items.reduce((s, i) => s + i.zones.length, 0)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Tổng tồn hệ thống:</span>
                <span className="font-extrabold text-cyan-900 font-mono">
                  {totalSystemQty.toLocaleString('vi-VN')}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Tổng thực đếm:</span>
                <span className="font-extrabold text-emerald-700 font-mono">
                  {totalCountedQty.toLocaleString('vi-VN')}
                </span>
              </div>

              <div className="border-t border-slate-300/80 pt-2 flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wide text-cyan-900">
                  TỔNG CHÊNH LỆCH:
                </span>
                <span
                  className={`text-base font-black font-mono tracking-tight ${
                    totalDifference > 0
                      ? 'text-emerald-600'
                      : totalDifference < 0
                      ? 'text-red-600'
                      : 'text-cyan-800'
                  }`}
                >
                  {totalDifference > 0 ? `+${totalDifference}` : totalDifference}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => executeSubmit(isManager ? 'COUNTING' : 'COUNTING_DONE', true)}
                disabled={submitting || items.length === 0}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 transition active:scale-95 cursor-pointer"
              >
                <Printer size={16} />
                <span>Lưu & In phiếu kiểm</span>
              </button>

              <button
                type="button"
                onClick={() => executeSubmit(isManager ? 'COUNTING' : 'COUNTING_DONE', false)}
                disabled={submitting || items.length === 0}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-cyan-800 disabled:opacity-50 transition active:scale-95 cursor-pointer"
              >
                <Save size={16} />
                <span>Lưu phiếu kiểm kho</span>
              </button>

              <button
                type="button"
                onClick={() => executeSubmit('DRAFT', false)}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-amber-600 disabled:opacity-50 transition active:scale-95 cursor-pointer"
              >
                <FileText size={16} />
                <span>Lưu tạm (Draft)</span>
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-100 transition active:scale-95 cursor-pointer"
              >
                <ArrowLeft size={16} />
                <span>Hủy / Quay lại</span>
              </button>
            </div>
          </div>
        </div>

        {/* ══ SMART SLOTTING RACK GRID MODAL ══ */}
        {rackModalData && (
          <SmartSlottingGridModal
            isOpen={Boolean(rackModalData)}
            onClose={() => setRackModalData(null)}
            mode="STOCKTAKE"
            warehouseCode={locationCode}
            targetRowId={rackModalData.product.id}
            products={products}
            subWarehouses={activeSubWarehouses}
            items={items.map((it) => {
              const allBins = it.zones.flatMap((z) =>
                z.assignedBins && z.assignedBins.length > 0
                  ? z.assignedBins
                  : z.locationBin
                  ? z.locationBin.split(',').map((s) => s.trim())
                  : []
              );
              return {
                rowId: it.product.id,
                productId: it.product.id,
                productSku: it.product.internalSku,
                productName: it.product.name,
                unit: it.product.unit,
                qty: it.zones.reduce((sum, z) => sum + (z.countedQty ?? z.systemQty ?? 0), 0),
                assignedBins: Array.from(new Set(allBins.filter(Boolean))),
                locationBin: Array.from(new Set(allBins.filter(Boolean))).join(', '),
              };
            })}
            onConfirmAll={(updatedRows) => {
              setItems((prev) =>
                prev.map((it) => {
                  const match = updatedRows.find((r) => r.rowId === it.product.id);
                  if (match && match.assignedBins) {
                    const updatedZones = it.zones.map((z, zIdx) => {
                      if (zIdx === 0) {
                        return {
                          ...z,
                          locationBin: match.locationBin,
                          assignedBins: match.assignedBins,
                        };
                      }
                      return z;
                    });
                    return { ...it, zones: updatedZones };
                  }
                  return it;
                })
              );
              setRackModalData(null);
            }}
          />
        )}
      </div>
    </div>
  );

  if (standalone) {
    return <MainLayout>{contentMarkup}</MainLayout>;
  }

  return contentMarkup;
}
