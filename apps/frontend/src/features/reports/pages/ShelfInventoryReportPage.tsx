import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Boxes,
  Printer,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Settings,
  Maximize2,
  Minimize2,
  Building2,
  X,
  AlertTriangle,
  ChevronDown,
  Check,
  Calendar,
  Layers,
  Clock,
  Package,
  CircleDollarSign,
  Warehouse,
  Filter,
} from 'lucide-react';
import { reportsApi } from '../api/reportsApi';
import { ReportPrintHeader } from '../components/ReportPrintHeader';
import { ReportPrintFooter } from '../components/ReportPrintFooter';
import { getStoredWarehouses, mergeStoredWarehouses } from '../../../shared/utils/warehouseAssignments';

const fmt = (v: number) => {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(v || 0);
};

const formatDate = (dStr: string | null) => {
  if (!dStr) return 'Chưa có thông tin';
  const d = new Date(dStr);
  if (isNaN(d.getTime())) return 'Chưa có thông tin';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const STALE_PRESETS = [
  { label: '> 15 ngày', days: 15 },
  { label: '> 30 ngày', days: 30 },
  { label: '> 60 ngày', days: 60 },
  { label: '> 3 tháng', days: 90 },
  { label: '> 6 tháng', days: 180 },
  { label: '> 12 tháng', days: 365 },
  { label: '> 3 năm', days: 1095 },
  { label: '> 5 năm', days: 1825 },
  { label: '> 10 năm', days: 3650 },
];

interface ShelfInventoryItem {
  id: string;
  balanceId: number;
  warehouseCode: string;
  warehouseName: string;
  zoneCode: string;
  zoneName: string;
  rackCode: string;
  rackName: string;
  binCode: string;
  fullLocationCode: string;
  cleanLocationCode: string;
  productId: number;
  productSku: string;
  productName: string;
  unit: string;
  categoryName: string;
  rawQuantity?: number;
  outboundQty?: number;
  baseOccupancyPct?: number;
  quantity: number;
  available: number;
  importPrice: number;
  totalValue: number;
  inboundDate: string | null;
  poNumber: string | null;
  daysInStock: number;
  occupancyPct: number;
  notes: string;
}

interface ShelfReportSummary {
  totalWarehouses: number;
  totalZones: number;
  totalRacks: number;
  totalBins: number;
  totalProductsCount: number;
  totalQuantity: number;
  totalValue: number;
  staleStockCount: number;
}

interface WarehouseOption {
  code: string;
  name: string;
  zones: {
    code: string;
    name: string;
    racks: string[];
  }[];
}

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  const token = localStorage.getItem('token');
  return {
    Authorization: token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json',
  };
}

interface ShelfInventoryReportPageProps {
  title?: string;
  defaultStaleFilter?: boolean;
}

export default function ShelfInventoryReportPage({
  title = 'BÁO CÁO HÀNG HÓA TỒN ĐỌNG',
  defaultStaleFilter = false,
}: ShelfInventoryReportPageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [selectedRack, setSelectedRack] = useState<string>('ALL');

  // Filter Hàng nhập trước thời điểm
  const initialBeforeDate = useMemo(() => {
    if (!defaultStaleFilter) return '';
    const d = new Date();
    d.setDate(d.getDate() - 15);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, [defaultStaleFilter]);

  const [filterBeforeDateEnabled, setFilterBeforeDateEnabled] = useState<boolean>(defaultStaleFilter);
  const [beforeDate, setBeforeDate] = useState<string>(initialBeforeDate);
  const [activePresetDays, setActivePresetDays] = useState<number | null>(defaultStaleFilter ? 15 : null);
  const [onlyWithStock, setOnlyWithStock] = useState<boolean>(true);

  // Custom Warehouse Dropdown State
  const [isWarehouseDropdownOpen, setIsWarehouseDropdownOpen] = useState(false);
  const warehouseDropdownRef = useRef<HTMLDivElement>(null);

  // Raw data from API
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [summary, setSummary] = useState<ShelfReportSummary>({
    totalWarehouses: 0,
    totalZones: 0,
    totalRacks: 0,
    totalBins: 0,
    totalProductsCount: 0,
    totalQuantity: 0,
    totalValue: 0,
    staleStockCount: 0,
  });
  const [items, setItems] = useState<ShelfInventoryItem[]>([]);

  // Fullscreen state
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Column visibility settings
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [columnVis, setColumnVis] = useState({
    stt: true,
    location: true,
    occupancy: true,
    zone: true,
    rack: true,
    sku: true,
    name: true,
    category: true,
    unit: true,
    quantity: true,
    importPrice: true,
    totalValue: true,
    poNumber: true,
    inboundDate: true,
    daysInStock: true,
  });

  // Shelf detail modal state
  const [selectedItemForModal, setSelectedItemForModal] = useState<ShelfInventoryItem | null>(null);

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedItemForModal) setSelectedItemForModal(null);
        if (showColumnSettings) setShowColumnSettings(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemForModal, showColumnSettings]);

  // Close custom warehouse dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (warehouseDropdownRef.current && !warehouseDropdownRef.current.contains(event.target as Node)) {
        setIsWarehouseDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
      setIsFullScreen(true);
    } else {
      document.exitFullscreen().catch(() => { });
      setIsFullScreen(false);
    }
  };

  useEffect(() => {
    const handleFSChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  // Fetch warehouse list & structure (merging remote API and locally stored warehouses)
  const loadWarehouses = async () => {
    try {
      const localWhs = getStoredWarehouses();
      let remoteWhs: any[] = [];
      try {
        const res = await fetch(`${API_BASE_URL}/warehouses`, { headers: authHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) remoteWhs = data;
        }
      } catch { }

      const merged = mergeStoredWarehouses(remoteWhs, localWhs);
      const list: WarehouseOption[] = merged.map((w: any) => {
        let zonesList: { code: string; name: string; racks: string[] }[] = [];
        if (w.subWarehouses) {
          const sw = typeof w.subWarehouses === 'string' ? JSON.parse(w.subWarehouses) : w.subWarehouses;
          if (Array.isArray(sw)) {
            zonesList = sw.map((z: any) => ({
              code: String(z.code || z.zoneCode || z.name || 'ZONE-A'),
              name: String(z.name || z.code || 'Phân khu A'),
              racks: Array.isArray(z.racks)
                ? z.racks.map((r: any) => String(r.code || r.rackCode || r.name || ''))
                : [],
            }));
          }
        }
        return {
          code: String(w.code || w.id),
          name: String(w.name || w.warehouseName || w.code),
          zones: zonesList,
        };
      });
      setWarehouses(list);
    } catch (e) {
      console.error('Error loading warehouses in ShelfInventoryReportPage:', e);
    }
  };

  // Fetch report data
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [res, whRes, outRes, obsRes] = await Promise.all([
        reportsApi.getShelfInventoryReport({
          warehouseCode: selectedWarehouse !== 'ALL' ? selectedWarehouse : undefined,
          zoneCode: selectedZone !== 'ALL' ? selectedZone : undefined,
          rackCode: selectedRack !== 'ALL' ? selectedRack : undefined,
          beforeDate: filterBeforeDateEnabled && beforeDate ? beforeDate : undefined,
          onlyWithStock,
          search: searchTerm.trim() || undefined,
        }),
        fetch(`${API_BASE_URL}/warehouses`, { headers: authHeaders() }).catch(() => null),
        fetch(`${API_BASE_URL}/outbound/orders`, { headers: authHeaders() }).catch(() => null),
        fetch(`${API_BASE_URL}/outbounds`, { headers: authHeaders() }).catch(() => null),
      ]);

      // Đồng bộ danh sách kho từ database và localStorage
      let remoteWhs: any[] = [];
      if (whRes && whRes.ok) {
        const d = await whRes.json().catch(() => []);
        if (Array.isArray(d)) remoteWhs = d;
      }
      const localWhs = mergeStoredWarehouses(remoteWhs, getStoredWarehouses());

      // Cập nhật warehouses dropdown list nếu có kho mới tạo
      const updatedWhList: WarehouseOption[] = localWhs.map((w: any) => {
        let zonesList: { code: string; name: string; racks: string[] }[] = [];
        if (w.subWarehouses) {
          const sw = typeof w.subWarehouses === 'string' ? JSON.parse(w.subWarehouses) : w.subWarehouses;
          if (Array.isArray(sw)) {
            zonesList = sw.map((z: any) => ({
              code: String(z.code || z.zoneCode || z.name || 'ZONE-A'),
              name: String(z.name || z.code || 'Phân khu A'),
              racks: Array.isArray(z.racks)
                ? z.racks.map((r: any) => String(r.code || r.rackCode || r.name || ''))
                : [],
            }));
          }
        }
        return {
          code: String(w.code || w.id),
          name: String(w.name || w.warehouseName || w.code),
          zones: zonesList,
        };
      });
      setWarehouses(updatedWhList);

      // Lấy toàn bộ phiếu xuất kho & xuất hủy để đối trừ chính xác số lượng tồn thực tế trên từng ô kệ (khử trùng lặp)
      const rawOutbounds: any[] = [];
      if (outRes && outRes.ok) {
        const d = await outRes.json().catch(() => []);
        rawOutbounds.push(...(Array.isArray(d) ? d : d?.data || []));
      } else if (obsRes && obsRes.ok) {
        const d = await obsRes.json().catch(() => []);
        rawOutbounds.push(...(Array.isArray(d) ? d : d?.data || []));
      }
      const localOut = JSON.parse(localStorage.getItem('stored_outbound_orders') || '[]');
      if (Array.isArray(localOut)) rawOutbounds.push(...localOut);

      const seenOrderIds = new Set<string>();
      const allOutbounds: any[] = [];
      rawOutbounds.forEach((ord: any) => {
        const k = String(ord.id || ord.orderNo || '');
        if (k && seenOrderIds.has(k)) return;
        if (k) seenOrderIds.add(k);
        allOutbounds.push(ord);
      });

      const getBinOutboundQty = (whCode: string, cleanLoc: string, shortBin: string, pSku: string) => {
        const normLoc = cleanLoc.replace(/[^A-Z0-9]/g, '').toUpperCase();
        const normShort = shortBin.replace(/[^A-Z0-9]/g, '').toUpperCase();
        let totalOut = 0;

        allOutbounds.forEach((ord: any) => {
          if (ord.status === 'CANCELLED') return;
          const ordWh = String(ord.branchCode || ord.warehouseCode || ord.warehouse?.code || '').trim().toUpperCase();
          if (ordWh && ordWh !== whCode.toUpperCase()) return;

          const details = Array.isArray(ord.details) ? ord.details : (Array.isArray(ord.items) ? ord.items : []);
          details.forEach((d: any) => {
            const dSku = String(d.productSku || d.sku || d.product?.internalSku || '').trim().toUpperCase();
            if (dSku && pSku && dSku !== pSku.toUpperCase()) return;

            let rawBins: string[] = Array.isArray(d.assignedBins) ? d.assignedBins : [];
            if (rawBins.length === 0 && d.locationBin) rawBins = String(d.locationBin).split(',').map((s: string) => s.trim());
            if (rawBins.length === 0 && d.note) {
              const noteMatches = [...d.note.matchAll(/\[(?:Vị trí Ô|Vị trí|Ô):\s*([^\]]+)\]/gi)];
              noteMatches.forEach((m: any) => {
                if (m[1]) rawBins.push(m[1].trim());
              });
            }

            const isMatch = rawBins.some((b: string) => {
              const clean = b.split('(')[0].trim().toUpperCase();
              const normClean = clean.replace(/[^A-Z0-9]/g, '');
              return clean === cleanLoc.toUpperCase() ||
                normClean === normLoc ||
                clean.endsWith(`-${shortBin.toUpperCase()}`) ||
                clean === shortBin.toUpperCase() ||
                normClean.endsWith(normShort);
            });

            if (isMatch) {
              totalOut += Math.abs(Number(d.qty || d.quantity || d.requiredQty || 0));
            }
          });
        });

        return totalOut;
      };

      if (res) {
        let reportItems: ShelfInventoryItem[] = res.items || [];

        // Trích xuất cấu hình kệ từ các kho (bao gồm kho mới tạo)
        const localBinMap = new Map<string, any>();
        const synthesizedItems: ShelfInventoryItem[] = [];

        localWhs.forEach((wh: any) => {
          const wCode = String(wh.code || wh.id || '').toUpperCase().trim();
          const wName = String(wh.name || wh.warehouseName || wh.code || `Kho ${wCode}`);

          if (selectedWarehouse !== 'ALL' && selectedWarehouse.toUpperCase() !== wCode) {
            return;
          }

          (wh.subWarehouses || []).forEach((sub: any) => {
            const zCode = String(sub.code || sub.zoneCode || sub.name || 'ZONE-A').toUpperCase().trim();
            const zName = String(sub.name || `Phân khu ${zCode.replace('ZONE-', '')}`);

            if (selectedZone !== 'ALL' && selectedZone.toUpperCase() !== zCode) {
              return;
            }

            (sub.racks || []).forEach((rk: any) => {
              const rCode = String(rk.rackCode || rk.code || rk.id || '').toUpperCase().trim();
              const rName = String(rk.name || `Kệ ${rCode}`);

              if (selectedRack !== 'ALL' && selectedRack.toUpperCase() !== rCode) {
                return;
              }

              const cBins = rk.customBins || {};
              Object.entries(cBins).forEach(([bKey, cfg]: [string, any]) => {
                if (!cfg) return;
                const cleanK = bKey.toUpperCase().trim();
                const shortB = String(cfg.binCode || cleanK.split('-').pop() || cleanK).toUpperCase().trim();
                const cleanLoc = cleanK.includes('-ZONE-') ? cleanK : `${wCode}-${zCode}-${rCode}-${shortB}`;

                localBinMap.set(`${wCode}_${cleanK}`, cfg);
                localBinMap.set(`${wCode}_${cleanK.replace(/[^A-Z0-9]/g, '')}`, cfg);
                localBinMap.set(`${wCode}_${rCode}_${shortB}`, cfg);
                localBinMap.set(`${wCode}_${shortB}`, cfg);
                localBinMap.set(`${rCode}_${shortB}`, cfg);

                // Trích xuất các mặt hàng lưu trên ô này
                const prods: any[] = Array.isArray(cfg.products) && cfg.products.length > 0
                  ? cfg.products
                  : (cfg.productName || cfg.totalPhysical || cfg.occupancyPct ? [{
                    sku: cfg.sku || 'SKU-001',
                    productName: cfg.productName || 'Hàng lưu trên kệ',
                    qty: cfg.totalPhysical || 1,
                    occupancyPct: cfg.occupancyPct || 100,
                    unit: cfg.unit || 'Cái',
                  }] : []);

                prods.forEach((p: any, pIdx: number) => {
                  const pSku = String(p.sku || p.productSku || 'SKU-001').toUpperCase().trim();
                  const pName = String(p.productName || p.name || 'Sản phẩm').trim();
                  const initialQty = Number(p.qty || p.quantity || cfg.totalPhysical || 1);
                  const outQty = getBinOutboundQty(wCode, cleanLoc, shortB, pSku);
                  const netQty = Math.max(0, initialQty - outQty);

                  // TRỪ KHI SỐ LƯỢNG TRỪ HẾT VỀ CON SỐ 0 THÌ NHỮNG CÁI NÀY SẼ MẤT HẾT
                  if (onlyWithStock && netQty <= 0) return;

                  const basePct = Number(p.occupancyPct !== undefined ? p.occupancyPct : (cfg.occupancyPct || 100));
                  const netPct = initialQty > 0 ? Math.round((netQty / initialQty) * basePct) : 0;
                  const pUnit = String(p.unit || cfg.unit || 'Cái');
                  const pPrice = Number(p.importPrice || p.price || 0);

                  // Ngày nhập mặc định 30 ngày trước nếu chưa có để hiển thị trong báo cáo hàng tồn đọng
                  const inDateStr = p.inboundDate || cfg.inboundDate || new Date(Date.now() - 30 * 86400000).toISOString();
                  const inDateObj = new Date(inDateStr);
                  const daysInStock = Math.max(15, Math.floor((Date.now() - inDateObj.getTime()) / (1000 * 60 * 60 * 24)));

                  if (filterBeforeDateEnabled && beforeDate) {
                    const bDate = new Date(beforeDate);
                    if (!isNaN(bDate.getTime())) {
                      bDate.setHours(23, 59, 59, 999);
                      if (inDateObj.getTime() > bDate.getTime()) return;
                    }
                  }

                  synthesizedItems.push({
                    id: `local_${wCode}_${cleanLoc}_${pSku}_${pIdx}`,
                    balanceId: 0,
                    warehouseCode: wCode,
                    warehouseName: wName,
                    zoneCode: zCode,
                    zoneName: zName,
                    rackCode: rCode,
                    rackName: rName,
                    binCode: shortB,
                    fullLocationCode: cleanLoc,
                    cleanLocationCode: cleanLoc,
                    productId: Number(p.productId || 0),
                    productSku: pSku,
                    productName: pName,
                    unit: pUnit,
                    categoryName: 'Hàng hóa',
                    rawQuantity: initialQty,
                    outboundQty: outQty,
                    baseOccupancyPct: basePct,
                    quantity: netQty,
                    available: netQty,
                    importPrice: pPrice,
                    totalValue: Math.round(netQty * pPrice),
                    inboundDate: inDateStr,
                    poNumber: p.poNumber || cfg.orderCode || 'KHO-LUU',
                    daysInStock,
                    occupancyPct: Math.min(100, Math.max(0, netPct)),
                    notes: netQty > 0 ? `Chứa: ${netQty} ${pUnit} (${netPct}%)` : 'Kệ trống (Đã xuất hết)',
                  });
                });
              });
            });
          });
        });

        // 1. Áp dụng đối trừ xuất kho & cập nhật % chiếm dụng lên reportItems từ API
        reportItems = reportItems.map((it) => {
          const wCode = it.warehouseCode.toUpperCase().trim();
          const cleanLoc = (it.cleanLocationCode || it.fullLocationCode).toUpperCase().trim();
          const shortB = it.binCode.toUpperCase().trim();
          const pSku = it.productSku.toUpperCase().trim();

          const initialQty = (it as any).rawQuantity !== undefined ? Number((it as any).rawQuantity) : it.quantity;
          const outQty = Math.max(getBinOutboundQty(wCode, cleanLoc, shortB, pSku), Number((it as any).outboundQty || 0));
          const netQty = Math.max(0, initialQty - outQty);

          const cfg =
            localBinMap.get(`${wCode}_${cleanLoc}`) ||
            localBinMap.get(`${wCode}_${cleanLoc.replace(/[^A-Z0-9]/g, '')}`) ||
            localBinMap.get(`${wCode}_${it.rackCode.toUpperCase()}_${shortB}`) ||
            localBinMap.get(`${wCode}_${shortB}`) ||
            localBinMap.get(`${it.rackCode.toUpperCase()}_${shortB}`);

          let basePct = Number((it as any).baseOccupancyPct || it.occupancyPct || 100);
          if (cfg && cfg.occupancyPct !== undefined && Number(cfg.occupancyPct) > 0) {
            basePct = Number(cfg.occupancyPct);
          }
          const netPct = initialQty > 0 ? Math.round((netQty / initialQty) * basePct) : 0;

          return {
            ...it,
            rawQuantity: initialQty,
            outboundQty: outQty,
            quantity: netQty,
            available: netQty,
            totalValue: Math.round(netQty * it.importPrice),
            occupancyPct: Math.min(100, Math.max(0, netPct)),
            notes: netQty > 0 ? `Chứa: ${netQty} ${it.unit} (${netPct}%)` : 'Kệ trống (Đã xuất hết)',
          };
        });

        // TRỪ KHI SỐ LƯỢNG TRỪ HẾT VỀ CON SỐ 0 THÌ NHỮNG CÁI NÀY SẼ MẤT HẾT:
        if (onlyWithStock) {
          reportItems = reportItems.filter((it) => it.quantity > 0);
        }

        // 2. Thêm các dòng hàng tồn từ kho tạo mới/kệ mới nếu chưa có trong kết quả API
        synthesizedItems.forEach((syn) => {
          const alreadyExists = reportItems.some((it) => {
            return (
              it.warehouseCode.toUpperCase() === syn.warehouseCode.toUpperCase() &&
              (it.cleanLocationCode.toUpperCase() === syn.cleanLocationCode.toUpperCase() ||
                (it.rackCode.toUpperCase() === syn.rackCode.toUpperCase() && it.binCode.toUpperCase() === syn.binCode.toUpperCase())) &&
              (it.productSku.toUpperCase() === syn.productSku.toUpperCase() ||
                it.productName.toLowerCase() === syn.productName.toLowerCase())
            );
          });
          if (!alreadyExists) {
            reportItems.push(syn);
          }
        });

        const distinctWhs = new Set(reportItems.map((i) => i.warehouseCode));
        const distinctZones = new Set(reportItems.map((i) => `${i.warehouseCode}_${i.zoneCode}`));
        const distinctRacks = new Set(reportItems.map((i) => `${i.warehouseCode}_${i.zoneCode}_${i.rackCode}`));
        const distinctBins = new Set(reportItems.filter((i) => i.quantity > 0).map((i) => i.cleanLocationCode));
        const totalQty = reportItems.reduce((s, i) => s + i.quantity, 0);
        const totalVal = reportItems.reduce((s, i) => s + i.totalValue, 0);
        const staleCount = reportItems.filter((i) => i.daysInStock >= 15 && i.quantity > 0).length;

        setSummary({
          totalWarehouses: distinctWhs.size,
          totalZones: distinctZones.size,
          totalRacks: distinctRacks.size,
          totalBins: distinctBins.size,
          totalProductsCount: reportItems.length,
          totalQuantity: totalQty,
          totalValue: totalVal,
          staleStockCount: staleCount,
        });
        setItems(reportItems);
      }
    } catch (err: any) {
      setError(err?.message || 'Không thể tải báo cáo hàng tồn trên kệ từ hệ thống API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWarehouses();

    let syncTimer: any = null;
    const handleSync = (e?: Event) => {
      if (e instanceof StorageEvent && e.key && e.key !== 'smart-wms-warehouses' && e.key !== 'stored_outbound_orders') {
        return;
      }
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        loadWarehouses();
        loadData();
      }, 300);
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('warehouses-updated', handleSync);

    return () => {
      if (syncTimer) clearTimeout(syncTimer);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('warehouses-updated', handleSync);
    };
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedWarehouse, selectedZone, selectedRack, filterBeforeDateEnabled, beforeDate, onlyWithStock]);

  // Derived available zones for selected warehouse
  const availableZones = useMemo(() => {
    if (selectedWarehouse === 'ALL') {
      const zoneSet = new Set<string>();
      warehouses.forEach((w) => w.zones.forEach((z) => zoneSet.add(z.code)));
      return Array.from(zoneSet);
    }
    const foundWh = warehouses.find((w) => w.code === selectedWarehouse);
    return foundWh ? foundWh.zones.map((z) => z.code) : [];
  }, [warehouses, selectedWarehouse]);

  // Derived available racks for selected zone
  const availableRacks = useMemo(() => {
    const rackSet = new Set<string>();
    warehouses.forEach((w) => {
      if (selectedWarehouse !== 'ALL' && w.code !== selectedWarehouse) return;
      w.zones.forEach((z) => {
        if (selectedZone !== 'ALL' && z.code !== selectedZone) return;
        z.racks.forEach((r) => rackSet.add(r));
      });
    });
    return Array.from(rackSet);
  }, [warehouses, selectedWarehouse, selectedZone]);

  // Client-side search & filtering
  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      if (!term) return true;
      return (
        item.productName.toLowerCase().includes(term) ||
        item.productSku.toLowerCase().includes(term) ||
        item.fullLocationCode.toLowerCase().includes(term) ||
        item.warehouseName.toLowerCase().includes(term) ||
        item.zoneName.toLowerCase().includes(term) ||
        (item.poNumber && item.poNumber.toLowerCase().includes(term))
      );
    });
  }, [items, searchTerm]);

  // Group items by Warehouse for neat hierarchical display
  const groupedByWarehouse = useMemo(() => {
    const map = new Map<string, { warehouseName: string; warehouseCode: string; items: ShelfInventoryItem[] }>();

    filteredItems.forEach((it) => {
      const key = it.warehouseCode;
      if (!map.has(key)) {
        map.set(key, {
          warehouseCode: it.warehouseCode,
          warehouseName: it.warehouseName,
          items: [],
        });
      }
      map.get(key)!.items.push(it);
    });

    if (selectedWarehouse !== 'ALL') {
      const targetWh = warehouses.find((w) => w.code.toUpperCase() === selectedWarehouse.toUpperCase());
      if (targetWh && !map.has(targetWh.code)) {
        map.set(targetWh.code, {
          warehouseCode: targetWh.code,
          warehouseName: targetWh.name,
          items: [],
        });
      }
    }

    return Array.from(map.values());
  }, [filteredItems, selectedWarehouse, warehouses]);

  // Quick preset filter for stale inventory
  const setDaysPreset = (days: number | null) => {
    setActivePresetDays(days);
    if (days === null) {
      setFilterBeforeDateEnabled(false);
      setBeforeDate('');
    } else {
      const d = new Date();
      d.setDate(d.getDate() - days);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      setBeforeDate(`${yyyy}-${mm}-${dd}`);
      setFilterBeforeDateEnabled(true);
    }
  };

  // Export Excel CSV with UTF-8 BOM
  const handleExportExcel = () => {
    const rows: any[] = [];

    groupedByWarehouse.forEach((g) => {
      rows.push([`=== Kho hàng: ${g.warehouseName} (${g.warehouseCode}) ===`, '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
      g.items.forEach((it, idx) => {
        rows.push([
          idx + 1,
          `"${(it.cleanLocationCode || it.fullLocationCode).replace(/"/g, '""')}"`,
          it.occupancyPct ? `${it.occupancyPct}%` : '0%',
          `"${it.zoneName.replace(/"/g, '""')}"`,
          `"${it.rackName.replace(/"/g, '""')}"`,
          `"${it.productSku.replace(/"/g, '""')}"`,
          `"${it.productName.replace(/"/g, '""')}"`,
          `"${(it.categoryName || 'Mặc định').replace(/"/g, '""')}"`,
          it.unit,
          it.quantity,
          it.importPrice,
          it.totalValue,
          it.poNumber || '—',
          it.inboundDate ? formatDate(it.inboundDate) : '—',
          `${it.daysInStock} ngày`,
        ]);
      });
      const subQty = g.items.reduce((s, i) => s + i.quantity, 0);
      const subVal = g.items.reduce((s, i) => s + i.totalValue, 0);
      rows.push([`Tổng ${g.warehouseName}:`, '', '', '', '', '', '', '', '', subQty, '', subVal, '', '', '']);
    });

    const totalFilteredQty = filteredItems.reduce((s, i) => s + i.quantity, 0);
    const totalFilteredVal = filteredItems.reduce((s, i) => s + i.totalValue, 0);
    rows.push(['TỔNG CỘNG TOÀN BỘ:', '', '', '', '', '', '', '', '', totalFilteredQty, '', totalFilteredVal, '', '', '']);

    const headers = [
      'STT',
      'Vị trí Ô Kệ',
      '% Chiếm dụng',
      'Phân khu',
      'Dãy kệ',
      'Mã hàng hóa (SKU)',
      'Tên hàng hóa',
      'Nhóm hàng',
      'ĐVT',
      'Thực tồn trên kệ',
      'Giá nhập (VNĐ)',
      'Thành tiền (VNĐ)',
      'Mã phiếu nhập',
      'Ngày nhập kệ',
      'Số ngày lưu kho',
    ];

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`space-y-4 pb-12 animate-in fade-in duration-200 ${isFullScreen ? 'fixed inset-0 z-[9000] bg-white overflow-y-auto p-6' : ''}`}>
      {/* ═══ PRINT HEADER (VISIBLE ONLY DURING PRINTING) ═══ */}
      <ReportPrintHeader
        title={title}
        subtitle={`Thời điểm in: ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')} | Phạm vi: ${selectedWarehouse === 'ALL' ? 'Tất cả các kho' : selectedWarehouse}`}
        subInfo={filterBeforeDateEnabled && beforeDate ? `Lọc hàng nhập trước ngày: ${beforeDate}` : 'Tất cả hàng tồn trên kệ'}
      />

      {/* ═══ TOP HEADER SECTION matching Gold Revenue Standard ═══ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2.5 rounded-2xl bg-cyan-600 px-5 py-2.5 text-white shadow-md">
            <Boxes className="h-5 w-5" />
            <h1 className="text-xl font-extrabold tracking-tight uppercase">{title}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-4.5 w-4.5 text-cyan-700 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
          >
            <Printer className="h-4.5 w-4.5 text-cyan-700" />
            In báo cáo
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
          >
            <FileSpreadsheet className="h-4.5 w-4.5 text-cyan-700" />
            Export Excel
          </button>

          <button
            type="button"
            onClick={() => setShowColumnSettings(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            title="Cấu hình hiển thị cột"
          >
            <Settings className="h-4.5 w-4.5 text-cyan-700" />
            <span>Hiển thị</span>
          </button>

          <button
            type="button"
            onClick={toggleBrowserFullscreen}
            className="inline-flex items-center justify-center h-10 w-10 rounded-xl border-2 border-cyan-700 bg-white text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            title="Toàn màn hình"
          >
            {isFullScreen ? <Minimize2 className="h-4.5 w-4.5 text-cyan-700" /> : <Maximize2 className="h-4.5 w-4.5 text-cyan-700" />}
          </button>
        </div>
      </div>

      {/* 4 Button tổng hợp lấy mẫu từ /products/main */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
          <p className="text-sm sm:text-base font-black text-cyan-700 uppercase">
            {fmt(summary.totalBins)} VỊ TRÍ Ô KỆ LƯU TRỮ
          </p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
          <p className="text-sm sm:text-base font-black text-cyan-700 uppercase">
            {fmt(summary.totalQuantity)} TỔNG SỐ LƯỢNG HÀNG TỒN
          </p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
          <p className="text-sm sm:text-base font-black text-cyan-700 uppercase">
            {fmt(summary.totalValue)} Đ TỔNG GIÁ TRỊ TỒN KỆ
          </p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
          <p className="text-sm sm:text-base font-black text-cyan-700 uppercase">
            {fmt(summary.staleStockCount)} MẶT HÀNG TỒN ĐỌNG LÂU NGÀY
          </p>
        </div>
      </div>

      {/* ═══ FILTER & SEARCH PANEL ═══ */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm space-y-4 print:hidden">
        {/* ROW 1: SEARCH & WAREHOUSE / ZONE / RACK FILTERS */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-4 text-xs sm:text-sm font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-2xs placeholder:text-slate-400"
              placeholder="Tìm theo mã SKU, tên hàng hóa, vị trí ô kệ, số phiếu PO..."
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Kho hàng (Custom Styled Popover Dropdown) */}
            <div ref={warehouseDropdownRef} className="relative inline-block">
              <button
                type="button"
                onClick={() => setIsWarehouseDropdownOpen(!isWarehouseDropdownOpen)}
                className="inline-flex h-11 items-center gap-2 rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 py-1.5 shadow-2xs transition hover:bg-slate-100 hover:border-cyan-600 active:scale-95 cursor-pointer"
              >
                <Building2 className="h-4.5 w-4.5 text-cyan-600 shrink-0" />
                <span className="text-xs font-extrabold uppercase text-slate-700 tracking-wide">Kho:</span>
                <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-1 text-xs sm:text-sm font-bold text-slate-800 shadow-2xs min-w-[180px] justify-between">
                  <span className="truncate max-w-[150px]">
                    {selectedWarehouse === 'ALL' ? 'Tất cả kho' : warehouses.find((w) => w.code === selectedWarehouse)?.name || selectedWarehouse}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-cyan-600 transition-transform duration-200 ${isWarehouseDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {isWarehouseDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-full min-w-[260px] rounded-2xl border-2 border-cyan-500 bg-white p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWarehouse('ALL');
                      setSelectedZone('ALL');
                      setSelectedRack('ALL');
                      setIsWarehouseDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-between cursor-pointer mb-1 ${selectedWarehouse === 'ALL'
                        ? 'bg-cyan-600 text-white font-extrabold shadow-sm'
                        : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-800'
                      }`}
                  >
                    <span>Tất cả kho</span>
                    {selectedWarehouse === 'ALL' && <Check className="h-4 w-4 text-white shrink-0" />}
                  </button>
                  {warehouses.map((w) => {
                    const isSelected = selectedWarehouse === w.code;
                    return (
                      <button
                        key={w.code}
                        type="button"
                        onClick={() => {
                          setSelectedWarehouse(w.code);
                          setSelectedZone('ALL');
                          setSelectedRack('ALL');
                          setIsWarehouseDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-between cursor-pointer mb-1 last:mb-0 ${isSelected
                            ? 'bg-cyan-600 text-white font-extrabold shadow-sm'
                            : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-800'
                          }`}
                      >
                        <span className="truncate">{w.name}</span>
                        {isSelected && <Check className="h-4 w-4 text-white shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Filter Phân khu (Zone) */}
            <div className="flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-1.5">
              <Layers className="h-4 w-4 text-cyan-600 shrink-0" />
              <span className="text-xs font-extrabold uppercase text-slate-700">Phân khu:</span>
              <select
                value={selectedZone}
                onChange={(e) => {
                  setSelectedZone(e.target.value);
                  setSelectedRack('ALL');
                }}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600"
              >
                <option value="ALL">Tất cả phân khu</option>
                {availableZones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Dãy kệ (Rack) */}
            <div className="flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-1.5">
              <Boxes className="h-4 w-4 text-cyan-600 shrink-0" />
              <span className="text-xs font-extrabold uppercase text-slate-700">Dãy kệ:</span>
              <select
                value={selectedRack}
                onChange={(e) => setSelectedRack(e.target.value)}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600"
              >
                <option value="ALL">Tất cả kệ</option>
                {availableRacks.map((r) => (
                  <option key={r} value={r}>
                    Kệ {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ROW 2: BỘ LỌC HÀNG NHẬP TRƯỚC THỜI ĐIỂM & TRẠNG THÁI Ô KỆ */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-200">
          {/* Filter Thời gian lưu kho */}
          <div className="flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-1.5">
            <Clock className="h-4 w-4 text-cyan-600 shrink-0" />
            <span className="text-xs font-extrabold uppercase text-slate-700">Lưu kho:</span>
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => setDaysPreset(null)}
                className={`h-8 rounded-lg px-2.5 text-xs font-bold transition cursor-pointer ${!filterBeforeDateEnabled
                    ? 'bg-cyan-600 text-white shadow-xs font-black'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-cyan-700'
                  }`}
              >
                Tất cả
              </button>
              {STALE_PRESETS.map((p) => {
                const isActive = filterBeforeDateEnabled && activePresetDays === p.days;
                return (
                  <button
                    key={p.days}
                    type="button"
                    onClick={() => setDaysPreset(p.days)}
                    className={`h-8 rounded-lg px-2.5 text-xs font-bold transition cursor-pointer ${isActive
                        ? 'bg-cyan-600 text-white shadow-xs font-black'
                        : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-cyan-700'
                      }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filter Chọn ngày nhập trước */}
          <div className="flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-1.5">
            <Calendar className="h-4 w-4 text-cyan-600 shrink-0" />
            <span className="text-xs font-extrabold uppercase text-slate-700">Nhập trước:</span>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={beforeDate}
                onChange={(e) => {
                  setBeforeDate(e.target.value);
                  setFilterBeforeDateEnabled(!!e.target.value);
                  setActivePresetDays(null);
                }}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 cursor-pointer"
              />
              {filterBeforeDateEnabled && (
                <button
                  type="button"
                  onClick={() => setDaysPreset(null)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-rose-600 transition cursor-pointer"
                  title="Bỏ lọc ngày"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Trạng thái ô kệ */}
          <div className="flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-1.5">
            <Filter className="h-4 w-4 text-cyan-600 shrink-0" />
            <span className="text-xs font-extrabold uppercase text-slate-700">Trạng thái:</span>
            <select
              value={onlyWithStock ? 'WITH_STOCK' : 'ALL'}
              onChange={(e) => setOnlyWithStock(e.target.value === 'WITH_STOCK')}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 cursor-pointer"
            >
              <option value="WITH_STOCK">Chỉ kệ có hàng (Thực tồn &gt; 0)</option>
              <option value="ALL">Tất cả ô kệ (Bao gồm ô trống)</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4 text-xs font-extrabold text-rose-700 print:hidden">
          {error}
        </div>
      )}

      {/* ═══ DATA TABLE (KHÔNG PHÂN TRANG) ═══ */}
      <div className="overflow-hidden rounded-2xl border-2 border-slate-300 bg-white shadow-sm print:border-none print:shadow-none print:rounded-none">
        <div className="overflow-x-auto custom-scrollbar print:overflow-visible">
          <table className="w-full min-w-[1850px] print:min-w-full border-collapse text-left text-xs sm:text-sm">
            <thead className="bg-cyan-600 text-white font-extrabold uppercase border-b-2 border-cyan-700 sticky top-0 z-20 shadow-xs">
              <tr className="font-extrabold uppercase text-xs sm:text-sm tracking-wider text-white whitespace-nowrap">
                {columnVis.stt && <th className="w-14 min-w-[56px] border-r border-cyan-500/50 px-3 py-3 text-center whitespace-nowrap">TT</th>}
                {columnVis.location && <th className="min-w-[190px] border-r border-cyan-500/50 px-4 py-3 text-center whitespace-nowrap">VỊ TRÍ Ô KỆ</th>}
                {columnVis.occupancy && <th className="w-28 min-w-[110px] border-r border-cyan-500/50 px-3 py-3 text-center whitespace-nowrap">% CHIẾM DỤNG</th>}
                {columnVis.zone && <th className="w-32 min-w-[130px] border-r border-cyan-500/50 px-3 py-3 text-center whitespace-nowrap">PHÂN KHU</th>}
                {columnVis.rack && <th className="w-28 min-w-[100px] border-r border-cyan-500/50 px-3 py-3 text-center whitespace-nowrap">DÃY KỆ</th>}
                {columnVis.sku && <th className="w-36 min-w-[150px] border-r border-cyan-500/50 px-4 py-3 text-center whitespace-nowrap">MÃ HÀNG HÓA</th>}
                {columnVis.name && <th className="min-w-[280px] border-r border-cyan-500/50 px-4 py-3 text-center whitespace-nowrap">TÊN HÀNG HÓA</th>}
                {columnVis.category && <th className="w-36 min-w-[150px] border-r border-cyan-500/50 px-4 py-3 text-center whitespace-nowrap">NHÓM HÀNG</th>}
                {columnVis.unit && <th className="w-20 min-w-[80px] border-r border-cyan-500/50 px-3 py-3 text-center whitespace-nowrap">ĐVT</th>}
                {columnVis.quantity && <th className="w-32 min-w-[130px] border-r border-cyan-500/50 px-4 py-3 text-center whitespace-nowrap">THỰC TỒN</th>}
                {columnVis.importPrice && <th className="w-36 min-w-[140px] border-r border-cyan-500/50 px-4 py-3 text-center whitespace-nowrap">GIÁ NHẬP</th>}
                {columnVis.totalValue && <th className="w-40 min-w-[150px] border-r border-cyan-500/50 px-4 py-3 text-center whitespace-nowrap">THÀNH TIỀN</th>}
                {columnVis.poNumber && <th className="w-40 min-w-[160px] border-r border-cyan-500/50 px-4 py-3 text-center whitespace-nowrap">PHIẾU NHẬP</th>}
                {columnVis.inboundDate && <th className="w-44 min-w-[170px] border-r border-cyan-500/50 px-4 py-3 text-center whitespace-nowrap">NGÀY NHẬP KỆ</th>}
                {columnVis.daysInStock && <th className="w-32 min-w-[120px] px-3 py-3 text-center whitespace-nowrap">LƯU KHO</th>}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white text-xs sm:text-sm font-normal text-slate-800">
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-14 text-center text-slate-400 font-bold text-sm">
                    <RefreshCw size={22} className="animate-spin inline-block mr-2 text-cyan-600" />
                    Đang tổng hợp dữ liệu hàng tồn trên các kệ từ CSDL...
                  </td>
                </tr>
              ) : groupedByWarehouse.length > 0 ? (
                groupedByWarehouse.map((g) => {
                  const warehouseTotalQty = g.items.reduce((sum, it) => sum + it.quantity, 0);
                  const warehouseTotalVal = g.items.reduce((sum, it) => sum + it.totalValue, 0);

                  return (
                    <React.Fragment key={g.warehouseCode}>
                      {/* LEVEL 1: WAREHOUSE GROUP HEADER */}
                      <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                        <td colSpan={15} className="px-4 py-2.5 text-xs sm:text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-2 text-slate-800 font-bold">
                              <Building2 className="h-4.5 w-4.5 text-cyan-600 shrink-0 print:hidden" />
                              <span className="uppercase tracking-wider">Kho Hàng: {g.warehouseName}</span>
                              <span className="rounded bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                {g.warehouseCode}
                              </span>
                              <span className="text-xs font-normal text-slate-500">
                                ({g.items.length} vị trí ô đang lưu trữ)
                              </span>
                            </span>
                            <div className="flex items-center gap-6 text-xs text-slate-700">
                              <span>
                                Tổng tồn kho này:{' '}
                                <strong className="font-bold text-slate-900">{fmt(warehouseTotalQty)}</strong>
                              </span>
                              <span>
                                Tổng giá trị:{' '}
                                <strong className="font-bold text-slate-900">{fmt(warehouseTotalVal)} đ</strong>
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* LEVEL 2: SHELF ITEMS OR EMPTY WAREHOUSE NOTICE */}
                      {g.items.length === 0 ? (
                        <tr>
                          <td colSpan={15} className="py-6 text-center text-slate-500 font-semibold bg-slate-50/50 dark:bg-slate-900/50">
                            Kho hàng [{g.warehouseCode} - {g.warehouseName}] hiện chưa có sản phẩm tồn đọng phù hợp với điều kiện lọc (toàn bộ ô kệ đang trống hoặc đã xuất hết về 0).
                          </td>
                        </tr>
                      ) : (
                        <>
                          {(() => {
                            const shelfMap = new Map<string, ShelfInventoryItem[]>();
                            g.items.forEach((it) => {
                              const loc = it.cleanLocationCode || it.fullLocationCode;
                              if (!shelfMap.has(loc)) shelfMap.set(loc, []);
                              shelfMap.get(loc)!.push(it);
                            });
                            const shelfGroups = Array.from(shelfMap.entries());
                            let itemCounter = 0;

                            return shelfGroups.map(([shelfLoc, shelfItems]) => {
                              return (
                                <React.Fragment key={shelfLoc}>
                                  {shelfItems.map((it) => {
                                    itemCounter++;
                                    const currentIdx = itemCounter;
                                    return (
                                      <tr
                                        key={it.id}
                                        onClick={() => setSelectedItemForModal(it)}
                                        className="hover:bg-slate-50 transition-colors border-b border-slate-200 cursor-pointer"
                                      >
                                        {columnVis.stt && (
                                          <td className="px-3 py-2.5 text-center font-normal text-slate-500 border-r border-slate-200 whitespace-nowrap">
                                            {currentIdx}
                                          </td>
                                        )}

                                        {columnVis.location && (
                                          <td className="px-4 py-2.5 font-mono font-normal text-slate-800 border-r border-slate-200 whitespace-nowrap">
                                            {it.cleanLocationCode || it.fullLocationCode}
                                          </td>
                                        )}

                                        {columnVis.occupancy && (
                                          <td className="px-3 py-2.5 text-center font-semibold text-cyan-700 dark:text-cyan-400 border-r border-slate-200 whitespace-nowrap">
                                            {it.occupancyPct ? `${it.occupancyPct}%` : '0%'}
                                          </td>
                                        )}

                                        {columnVis.zone && (
                                          <td className="px-3 py-2.5 text-center font-normal text-slate-700 border-r border-slate-200 whitespace-nowrap">
                                            {it.zoneName}
                                          </td>
                                        )}

                                        {columnVis.rack && (
                                          <td className="px-3 py-2.5 text-center font-normal text-slate-700 border-r border-slate-200 whitespace-nowrap">
                                            {it.rackName}
                                          </td>
                                        )}

                                        {columnVis.sku && (
                                          <td className="px-4 py-2.5 font-mono font-normal text-slate-800 border-r border-slate-200 whitespace-nowrap">
                                            {it.productSku}
                                          </td>
                                        )}

                                        {columnVis.name && (
                                          <td className="px-4 py-2.5 font-normal text-slate-800 border-r border-slate-200 whitespace-nowrap">
                                            {it.productName}
                                          </td>
                                        )}

                                        {columnVis.category && (
                                          <td className="px-4 py-2.5 font-normal text-slate-700 border-r border-slate-200 whitespace-nowrap">
                                            {it.categoryName || 'Mặc định'}
                                          </td>
                                        )}

                                        {columnVis.unit && (
                                          <td className="px-3 py-2.5 text-center font-normal text-slate-700 border-r border-slate-200 whitespace-nowrap">
                                            {it.unit}
                                          </td>
                                        )}

                                        {columnVis.quantity && (
                                          <td className="px-4 py-2.5 text-right font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                                            {fmt(it.quantity)}
                                          </td>
                                        )}

                                        {columnVis.importPrice && (
                                          <td className="px-4 py-2.5 text-right font-normal text-slate-800 border-r border-slate-200 whitespace-nowrap">
                                            {fmt(it.importPrice)} đ
                                          </td>
                                        )}

                                        {columnVis.totalValue && (
                                          <td className="px-4 py-2.5 text-right font-normal text-slate-800 border-r border-slate-200 whitespace-nowrap">
                                            {fmt(it.totalValue)} đ
                                          </td>
                                        )}

                                        {columnVis.poNumber && (
                                          <td className="px-4 py-2.5 font-mono font-normal text-slate-700 border-r border-slate-200 whitespace-nowrap">
                                            {it.poNumber || '—'}
                                          </td>
                                        )}

                                        {columnVis.inboundDate && (
                                          <td className="px-4 py-2.5 text-center font-normal text-slate-700 border-r border-slate-200 whitespace-nowrap">
                                            {formatDate(it.inboundDate)}
                                          </td>
                                        )}

                                        {columnVis.daysInStock && (
                                          <td className="px-3 py-2.5 text-center font-normal text-slate-700 whitespace-nowrap">
                                            <span className={it.daysInStock >= 15 ? 'text-amber-700 font-medium' : ''}>
                                              {it.daysInStock} ngày
                                            </span>
                                          </td>
                                        )}
                                      </tr>
                                    );
                                  })}
                                </React.Fragment>
                              );
                            });
                          })()}

                          {/* DÒNG TỔNG HỢP CUỐI CÙNG CHO TỪNG KHO HÀNG */}
                          <tr className="bg-cyan-50/90 dark:bg-cyan-950/50 font-black text-xs text-cyan-950 dark:text-cyan-100 border-b-2 border-cyan-500">
                            <td colSpan={9} className="px-4 py-2.5 text-right uppercase tracking-wider border-r border-slate-200">
                              Tổng cộng kho [{g.warehouseCode} - {g.warehouseName}] ({g.items.length} vị trí / mặt hàng):
                            </td>
                            {columnVis.quantity && (
                              <td className="px-4 py-2.5 text-right font-black text-sm text-cyan-900 dark:text-cyan-200 border-r border-slate-200 whitespace-nowrap bg-cyan-100/70 dark:bg-cyan-900/60">
                                {fmt(warehouseTotalQty)}
                              </td>
                            )}
                            {columnVis.importPrice && <td className="px-4 py-2.5 border-r border-slate-200"></td>}
                            {columnVis.totalValue && (
                              <td className="px-4 py-2.5 text-right font-black text-sm text-cyan-900 dark:text-cyan-200 border-r border-slate-200 whitespace-nowrap bg-cyan-100/70 dark:bg-cyan-900/60">
                                {fmt(warehouseTotalVal)} đ
                              </td>
                            )}
                            <td colSpan={3} className="px-4 py-2.5"></td>
                          </tr>
                        </>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={15} className="py-14 text-center text-slate-400 font-bold text-sm">
                    Không tìm thấy dữ liệu kệ hàng nào khớp với điều kiện lọc hiện tại.
                  </td>
                </tr>
              )}
            </tbody>

            {/* ═══ FOOTER ROW: TỔNG TOÀN BỘ BÁO CÁO ═══ */}
            {filteredItems.length > 0 && (
              <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-xs sm:text-sm text-slate-800 sticky bottom-0 z-10 shadow-sm">
                <tr>
                  <td colSpan={9} className="px-4 py-3 text-right uppercase tracking-wider text-slate-700 whitespace-nowrap">
                    TỔNG CỘNG ({filteredItems.length} vị trí ô kệ):
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900 text-sm whitespace-nowrap">
                    {fmt(filteredItems.reduce((s, i) => s + i.quantity, 0))}
                  </td>
                  <td></td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900 text-sm whitespace-nowrap">
                    {fmt(filteredItems.reduce((s, i) => s + i.totalValue, 0))} đ
                  </td>
                  <td colSpan={3} className="px-4 py-3 text-left text-xs font-normal text-slate-500 whitespace-nowrap">
                    (Báo cáo tổng hợp toàn bộ không phân trang)
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ═══ PRINT FOOTER (VISIBLE ONLY DURING PRINTING) ═══ */}
      <ReportPrintFooter />

      {/* ═══ MODAL CHI TIẾT Ô KỆ (SHELF DETAIL POPUP) ═══ */}
      {selectedItemForModal &&
        createPortal(
          <div
            onClick={() => setSelectedItemForModal(null)}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl rounded-2xl border-2 border-cyan-500 bg-white p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto cursor-default"
            >
              <div className="flex items-start justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-xs">
                    <Boxes className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 uppercase">
                      CHI TIẾT HÀNG TỒN TRÊN Ô KỆ
                    </h3>
                    <p className="text-xs font-bold text-cyan-800">
                      Vị trí ô: {selectedItemForModal.cleanLocationCode || selectedItemForModal.fullLocationCode}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedItemForModal(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Thông tin sản phẩm */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">Thông tin hàng hóa</h4>
                <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm">
                  <div>
                    <span className="text-slate-500">Mã SKU:</span>{' '}
                    <strong className="font-mono text-slate-900">{selectedItemForModal.productSku}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Tên hàng:</span>{' '}
                    <strong className="text-slate-900">{selectedItemForModal.productName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Nhóm hàng:</span>{' '}
                    <strong className="text-slate-800">{selectedItemForModal.categoryName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Đơn vị tính:</span>{' '}
                    <strong className="text-slate-800">{selectedItemForModal.unit}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Đơn giá nhập:</span>{' '}
                    <strong className="text-slate-900">{fmt(selectedItemForModal.importPrice)} đ</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Tổng giá trị lưu kệ:</span>{' '}
                    <strong className="text-emerald-700 font-black">{fmt(selectedItemForModal.totalValue)} đ</strong>
                  </div>
                </div>
              </div>

              {/* Thông tin định vị ô kệ */}
              <div className="rounded-xl border border-cyan-200 bg-cyan-50/50 p-4 space-y-3">
                <h4 className="text-xs font-black uppercase text-cyan-900 tracking-wider">Vị trí &amp; Chiếm dụng kệ</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
                  <div>
                    <span className="text-slate-500 text-xs">Kho hàng:</span>
                    <p className="font-bold text-slate-900">{selectedItemForModal.warehouseName}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Phân khu:</span>
                    <p className="font-bold text-slate-900">{selectedItemForModal.zoneName}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Dãy kệ:</span>
                    <p className="font-bold text-slate-900">{selectedItemForModal.rackName}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Số lượng thực tồn:</span>
                    <p className="font-black text-blue-700 text-base">{fmt(selectedItemForModal.quantity)} {selectedItemForModal.unit}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Khả dụng xuất:</span>
                    <p className="font-black text-slate-800 text-base">{fmt(selectedItemForModal.available)} {selectedItemForModal.unit}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Tỷ lệ lấp đầy ô:</span>
                    <p className="font-extrabold text-cyan-800">{selectedItemForModal.occupancyPct}%</p>
                  </div>
                </div>
              </div>

              {/* Thông tin nhập kho & lưu kho */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-2">
                <h4 className="text-xs font-black uppercase text-amber-950 tracking-wider flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-amber-700" />
                  Thời gian lưu kho &amp; Tình trạng xuất hàng
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm pt-1">
                  <div>
                    <span className="text-slate-500">Mã phiếu nhập (PO):</span>
                    <p className="font-mono font-bold text-slate-900">
                      {selectedItemForModal.poNumber || 'Chưa liên kết mã phiếu'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Thời điểm nhập lên kệ:</span>
                    <p className="font-bold text-slate-900">{formatDate(selectedItemForModal.inboundDate)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Số ngày đã nằm trên kệ:</span>
                    <p className="font-black text-amber-900 text-base">
                      {selectedItemForModal.daysInStock} ngày
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Trạng thái xuất hàng:</span>
                    <p className="font-extrabold text-rose-700">
                      Chưa được xuất đi - Còn lưu trên kệ
                    </p>
                  </div>
                </div>

                {selectedItemForModal.daysInStock >= 15 && (
                  <div className="mt-3 rounded-lg border border-amber-300 bg-amber-100 p-2.5 text-xs text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <strong>Cảnh báo hàng tồn lâu:</strong> Mặt hàng này đã lưu trữ trên kệ hơn{' '}
                      <strong>{selectedItemForModal.daysInStock} ngày</strong>. Khuyến nghị nhân viên kho ưu tiên tạo
                      phiếu xuất theo thứ tự FIFO (First In First Out) để giải phóng ô kệ và tránh giảm giá trị hàng hóa.
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedItemForModal(null)}
                  className="rounded-xl border-2 border-slate-300 bg-white px-5 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ═══ MODAL CẤU HÌNH HIỂN THỊ CỘT ═══ */}
      {showColumnSettings &&
        createPortal(
          <div
            onClick={() => setShowColumnSettings(false)}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150 cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md rounded-2xl border-2 border-cyan-500 bg-white p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 cursor-default"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2 text-cyan-800">
                  <Settings className="h-5 w-5" />
                  <h3 className="text-base font-black uppercase">Cấu hình cột hiển thị</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowColumnSettings(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {[
                  { key: 'stt', label: 'Số thứ tự (TT)' },
                  { key: 'location', label: 'Vị trí Ô Kệ' },
                  { key: 'occupancy', label: 'Tỷ lệ chiếm dụng (%)' },
                  { key: 'zone', label: 'Phân khu' },
                  { key: 'rack', label: 'Dãy kệ' },
                  { key: 'sku', label: 'Mã hàng hóa (SKU)' },
                  { key: 'name', label: 'Tên hàng hóa' },
                  { key: 'category', label: 'Nhóm hàng' },
                  { key: 'unit', label: 'Đơn vị tính (ĐVT)' },
                  { key: 'quantity', label: 'Thực tồn trên kệ' },
                  { key: 'importPrice', label: 'Giá nhập (VNĐ)' },
                  { key: 'totalValue', label: 'Thành tiền (VNĐ)' },
                  { key: 'poNumber', label: 'Mã phiếu nhập (PO)' },
                  { key: 'inboundDate', label: 'Ngày nhập kệ' },
                  { key: 'daysInStock', label: 'Số ngày lưu kho' },
                ].map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 hover:bg-cyan-50/50 transition cursor-pointer"
                  >
                    <span className="text-xs sm:text-sm font-bold text-slate-700">{col.label}</span>
                    <input
                      type="checkbox"
                      checked={(columnVis as any)[col.key]}
                      onChange={(e) =>
                        setColumnVis((prev) => ({
                          ...prev,
                          [col.key]: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded text-cyan-600 focus:ring-cyan-500 cursor-pointer accent-cyan-600"
                    />
                  </label>
                ))}
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowColumnSettings(false)}
                  className="rounded-xl bg-cyan-600 px-5 py-2 text-xs sm:text-sm font-extrabold text-white hover:bg-cyan-700 shadow-sm cursor-pointer"
                >
                  Xong
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
