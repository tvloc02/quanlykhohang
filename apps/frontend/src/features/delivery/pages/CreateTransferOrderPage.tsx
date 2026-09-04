import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  Save,
  X,
  CheckCircle2,
  XCircle,
  Package,
  Truck,
  Send,
  ArrowRight,
  Warehouse as WarehouseIcon,
  User,
  FileText,
  ScanLine,
  Maximize2,
  Minimize2,
  RotateCcw,
  Clock,
  Phone,
  Car,
  Calendar,
  CalendarCheck,
  Bike,
  Layers,
  MapPin,
  Sparkles,
  Bot,
  AlertCircle,
} from 'lucide-react';
import { deliveryApi, type TransferOrder } from '../api/deliveryApi';
import BarcodeScanner, { type ScannedProduct } from '../../../shared/components/BarcodeScanner';
import { filterOutDeletedProducts } from '../../../shared/utils/productUtils';
import MainLayout from '../../../shared/components/MainLayout';
import { getStoredShippers, type Shipper } from '../services/shipperService';
import QuickAddShipperModal from '../components/QuickAddShipperModal';
import { SmartSlottingGridModal } from '../../warehouses/components/SmartSlottingGridModal';
import { getStoredWarehouses, mergeStoredWarehouses } from '../../../shared/utils/warehouseAssignments';

// ─── TYPES & INTERFACES ────────────────────────────────────────

export interface ProductOption {
  id: string;
  internalSku: string;
  name: string;
  unit?: string;
  purchasePrice?: number;
  salePrice?: number;
  price?: number;
  importPrice?: number;
  retailPrice?: number;
  wholesalePrice?: number;
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

export interface WarehouseOption {
  id: string;
  code: string;
  name: string;
}

export interface UserOption {
  id: string;
  fullName?: string;
  email: string;
}

export interface TransferRowItem {
  rowId: string;
  productId: string;
  productSku: string;
  productName: string;
  unit: string;
  sourceWarehouseCode: string;
  qty: number;
  price: number;
  totalAmount: number;
  note: string;
  locationBin?: string;
  assignedBins?: string[];
}

export interface TransferTab {
  tabId: string;
  title: string;
  id?: string;
  transferNo: string;
  sourceWarehouseCode: string;
  destinationWarehouseCode: string;
  assignedStaffEmail: string;
  orderDate: string;
  dispatchDate: string;
  receiveDate: string;
  driverName: string;
  driverPhone: string;
  vehiclePlate: string;
  generalNote: string;
  status: string;
  details: TransferRowItem[];
}

const DEFAULT_ROWS_COUNT = 50;
const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
}

export function getProductPrice(p?: ProductOption | any): number {
  if (!p) return 0;
  return Number(
    p.importPrice ||
    p.purchasePrice ||
    p.price ||
    p.retailPrice ||
    p.wholesalePrice ||
    p.salePrice ||
    0
  );
}

export function isLocationInWarehouse(locCode?: string, whCode?: string): boolean {
  if (!locCode || !whCode) return false;
  const l = locCode.trim().toLowerCase();
  const w = whCode.trim().toLowerCase();
  if (l === w) return true;
  if (l.startsWith(w + '-') || l.startsWith(w + '_') || l.startsWith(w + '/')) return true;
  const normL = l.replace(/[^a-z0-9]/g, '');
  const normW = w.replace(/[^a-z0-9]/g, '');
  if (normL === normW) return true;
  return false;
}

export function getProductWarehouseStock(p: ProductOption, whCode?: string): number {
  if (!p) return 0;
  const targetCode = (whCode || '').trim().toLowerCase();

  if (Array.isArray(p.stockBalances) && p.stockBalances.length > 0) {
    if (targetCode) {
      let sum = 0;
      let matched = false;
      p.stockBalances.forEach((b) => {
        if (isLocationInWarehouse(b.locationCode, targetCode)) {
          matched = true;
          const qty = b.available !== undefined && b.available !== null ? Number(b.available) : Number(b.totalPhysical || 0);
          sum += qty;
        }
      });

      if (matched) {
        return sum;
      }
      return 0;
    }
  }

  if (!targetCode) {
    return Number(p.totalStock ?? p.totalPhysical ?? p.stockQty ?? (p as any).quantity ?? (p as any).stock ?? 0);
  }

  return 0;
}


function generateTransferCode() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `PXC${dateStr}-${randomSuffix}`;
}

function makeEmptyRow(index: number, defaultSourceWh = 'KHO-TONG'): TransferRowItem {
  return {
    rowId: `row-${Date.now()}-${index}-${Math.random()}`,
    productId: '',
    productSku: '',
    productName: '',
    unit: 'Cái',
    sourceWarehouseCode: defaultSourceWh,
    qty: 0,
    price: 0,
    totalAmount: 0,
    note: '',
  };
}

function makeInitialRows(count = DEFAULT_ROWS_COUNT, defaultSourceWh = 'KHO-TONG'): TransferRowItem[] {
  return Array.from({ length: count }, (_, i) => makeEmptyRow(i, defaultSourceWh));
}

function formatISOWithSeconds(d = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function toLocalDateTimeInputString(dateInput?: string | Date | null): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function createNewTransferTab(
  tabIndex = 1,
  defaultStaffEmail = '',
  defaultSource = 'KH001',
  defaultDest = 'KH002'
): TransferTab {
  const now = new Date();
  const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  return {
    tabId: `tab-${Date.now()}-${tabIndex}`,
    title: `# ${tabIndex}`,
    transferNo: generateTransferCode(),
    sourceWarehouseCode: defaultSource,
    destinationWarehouseCode: defaultDest,
    assignedStaffEmail: defaultStaffEmail,
    orderDate: formatISOWithSeconds(now),
    dispatchDate: formatISOWithSeconds(now),
    receiveDate: '',
    driverName: '',
    driverPhone: '',
    vehiclePlate: '',
    generalNote: '',
    status: 'DRAFT',
    details: makeInitialRows(DEFAULT_ROWS_COUNT, defaultSource),
  };
}

export interface CreateTransferOrderPageProps {
  onBack?: () => void;
  standalone?: boolean;
  editOrderData?: TransferOrder | null;
}

// ─── MAIN CREATE TRANSFER ORDER PAGE COMPONENT ─────────────────

export default function CreateTransferOrderPage({
  onBack,
  standalone = true,
  editOrderData,
}: CreateTransferOrderPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const targetEditData = editOrderData || (location.state as any)?.editOrderData || (location.state as any)?.copyFromOrder;
  const isReceiveMode = location.pathname.includes('receive-transfer-order') || (location.state as any)?.mode === 'receive' || (location.state as any)?.mode === 'inbound' || (location.state as any)?.fromRequests || false;
  const isCopyMode = !!(location.state as any)?.copyFromOrder;
  const targetStatus = (targetEditData?.status || '').toUpperCase();
  const isOrderCompleted = (targetStatus === 'DELIVERED' || targetStatus === 'COMPLETED' || targetStatus === 'RECEIVED') && !isCopyMode;
  const isReadOnly = !!(location.state as any)?.isReadOnly || isOrderCompleted;
  const currentUser = getStoredUser();
  const currentStaffEmail = currentUser?.email || '';

  // Master Data
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>(() => getStoredWarehouses());
  const [users, setUsers] = useState<UserOption[]>([]);


  // Toast alert
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // UI & Modal states
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [activeProductDropdownRowId, setActiveProductDropdownRowId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [shippers, setShippers] = useState<Shipper[]>(() => getStoredShippers());
  const [showQuickAddShipperModal, setShowQuickAddShipperModal] = useState(false);

  // Pick Bin Modal states
  const [pickBinModalOpen, setPickBinModalOpen] = useState(false);
  const [activePickBinRowId, setActivePickBinRowId] = useState<string | null>(null);

  const openPickBinModal = (rowId: string) => {
    setActivePickBinRowId(rowId);
    setPickBinModalOpen(true);
  };

  const handleConfirmPickBins = (rowId: string, bins: string[]) => {
    updateRow(rowId, {
      assignedBins: bins,
      locationBin: bins.join(', '),
    });
  };

  // Hardware Barcode Scanner Auto-Detection State
  const [isScannerConnected, setIsScannerConnected] = useState<boolean>(true);

  // Auto-detect WebHID USB scanner connection
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'hid' in navigator) {
      const checkHid = async () => {
        try {
          const devices = await (navigator as any).hid.getDevices();
          setIsScannerConnected(Boolean(devices && devices.length > 0));
        } catch (e) {}
      };
      checkHid();

      const onConnect = () => setIsScannerConnected(true);
      const onDisconnect = () => setIsScannerConnected(false);

      (navigator as any).hid.addEventListener('connect', onConnect);
      (navigator as any).hid.addEventListener('disconnect', onDisconnect);

      return () => {
        (navigator as any).hid.removeEventListener('connect', onConnect);
        (navigator as any).hid.removeEventListener('disconnect', onDisconnect);
      };
    }
  }, []);

  // Không cho phép tạo mới phiếu nhập kho nội bộ độc lập (chỉ nhận từ phiếu điều chuyển đã xuất gửi đến)
  useEffect(() => {
    if (isReceiveMode && !targetEditData) {
      navigate('/delivery/transfer-requests', { replace: true });
    }
  }, [isReceiveMode, targetEditData, navigate]);

  useEffect(() => {
    const handleShippersUpdate = () => setShippers(getStoredShippers());
    window.addEventListener('shippers-updated', handleShippersUpdate);
    return () => window.removeEventListener('shippers-updated', handleShippersUpdate);
  }, []);

  // Synchronous Multi-Tab state with Session Storage restoration
  const [tabs, setTabs] = useState<TransferTab[]>(() => {
    if (targetEditData) {
      const editDetails: TransferRowItem[] = (targetEditData.items || []).map((it: any, idx: number) => {
        const q = Number(it.quantity || it.qty || 0);
        const p = Number(
          it.price ||
          it.unitPrice ||
          it.importPrice ||
          it.wholesalePrice ||
          it.retailPrice ||
          it.salePrice ||
          it.product?.importPrice ||
          it.product?.price ||
          it.product?.purchasePrice ||
          0
        );
        return {
          rowId: `edit-row-${it.id || idx}`,
          productId: it.id || it.productId || '',
          productSku: it.productCode || it.productSku || '',
          productName: it.productName || '',
          unit: it.unit || 'Cái',
          sourceWarehouseCode: targetEditData.sourceWarehouse || 'KH001',
          qty: q,
          price: p,
          totalAmount: q * p,
          locationBin: it.locationBin || (Array.isArray(it.assignedBins) ? it.assignedBins.join(', ') : ''),
          assignedBins: Array.isArray(it.assignedBins) ? it.assignedBins : (it.locationBin ? String(it.locationBin).split(',').map((b: string) => b.trim()).filter(Boolean) : []),
          note: it.note || '',
        };
      });

      // Fill up to DEFAULT_ROWS_COUNT rows
      const padCount = Math.max(0, DEFAULT_ROWS_COUNT - editDetails.length);
      const paddedRows = [...editDetails, ...makeInitialRows(padCount, targetEditData.sourceWarehouse || 'KHO-TONG')];

      return [
        {
          tabId: `edit-tab-${targetEditData.id}`,
          title: targetEditData.transferNo || 'Sửa phiếu',
          id: targetEditData.id,
          transferNo: targetEditData.transferNo || generateTransferCode(),
          sourceWarehouseCode: targetEditData.sourceWarehouse || 'KHO-TONG',
          destinationWarehouseCode: targetEditData.destinationWarehouse || 'KHO-CN-HCM',
          assignedStaffEmail: targetEditData.createdBy || currentStaffEmail,
          orderDate: (targetEditData.scheduledDate || (targetEditData as any).orderDate || targetEditData.createdAt || targetEditData.dispatchDate)
            ? toLocalDateTimeInputString(targetEditData.scheduledDate || (targetEditData as any).orderDate || targetEditData.createdAt || targetEditData.dispatchDate)
            : formatISOWithSeconds(),
          dispatchDate: (targetEditData.dispatchDate || targetEditData.scheduledDate || targetEditData.createdAt)
            ? toLocalDateTimeInputString(targetEditData.dispatchDate || targetEditData.scheduledDate || targetEditData.createdAt)
            : formatISOWithSeconds(),
          receiveDate: targetEditData.receiveDate
            ? toLocalDateTimeInputString(targetEditData.receiveDate)
            : (isReceiveMode ? formatISOWithSeconds() : ''),
          driverName: targetEditData.driverName || '',
          driverPhone: targetEditData.driverPhone || '',
          vehiclePlate: targetEditData.vehiclePlate || '',
          generalNote: targetEditData.note || '',
          status: targetEditData.status || 'DRAFT',
          details: paddedRows,
        },
      ];
    }

    try {
      sessionStorage.removeItem('transfer_tabs_draft');
      sessionStorage.removeItem('transfer_active_tab_id');
    } catch { }
    return [createNewTransferTab(1, currentStaffEmail)];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    try {
      const savedActiveId = sessionStorage.getItem('transfer_active_tab_id');
      if (savedActiveId && tabs.some((t) => t.tabId === savedActiveId)) {
        return savedActiveId;
      }
    } catch { }
    return tabs && tabs[0] ? tabs[0].tabId : '';
  });

  const activeTab = useMemo(() => {
    return tabs.find((t) => t.tabId === activeTabId) || tabs[0];
  }, [tabs, activeTabId]);

  const handleAddNewTab = useCallback(() => {
    const newTabIndex = tabs.length + 1;
    const newTab = createNewTransferTab(newTabIndex, currentStaffEmail);
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.tabId);
    setToast({ message: `Đã mở tab tạo phiếu chuyển kho mới (#${newTabIndex})`, type: 'success' });
  }, [tabs.length, currentStaffEmail]);

  const handleCloseTab = useCallback(
    (tabIdToClose: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      if (tabs.length <= 1) {
        setToast({ message: 'Không thể đóng tab duy nhất', type: 'error' });
        return;
      }
      const nextTabs = tabs.filter((t) => t.tabId !== tabIdToClose);
      setTabs(nextTabs);
      if (activeTabId === tabIdToClose) {
        setActiveTabId(nextTabs[nextTabs.length - 1].tabId);
      }
    },
    [tabs, activeTabId]
  );

  // Hydrate edit order data when editing an existing order
  useEffect(() => {
    if (!targetEditData) return;

    const editDetails: TransferRowItem[] = (targetEditData.items || []).map((it: any, idx: number) => {
      const q = Number(it.quantity || it.qty || 0);
      const p = Number(
        it.price ||
        it.unitPrice ||
        it.importPrice ||
        it.wholesalePrice ||
        it.retailPrice ||
        it.salePrice ||
        it.product?.importPrice ||
        it.product?.price ||
        it.product?.purchasePrice ||
        0
      );
      return {
        rowId: `edit-row-${it.id || idx}`,
        productId: it.id || it.productId || '',
        productSku: it.productCode || it.productSku || '',
        productName: it.productName || '',
        unit: it.unit || 'Cái',
        sourceWarehouseCode: targetEditData.sourceWarehouse || 'KH001',
        qty: q,
        price: p,
        totalAmount: q * p,
        locationBin: it.locationBin || (Array.isArray(it.assignedBins) ? it.assignedBins.join(', ') : ''),
        assignedBins: Array.isArray(it.assignedBins) ? it.assignedBins : (it.locationBin ? String(it.locationBin).split(',').map((b: string) => b.trim()).filter(Boolean) : []),
        note: it.note || '',
      };
    });

    const padCount = Math.max(0, DEFAULT_ROWS_COUNT - editDetails.length);
    const paddedRows = [...editDetails, ...makeInitialRows(padCount, targetEditData.sourceWarehouse || 'KH001')];

    const editTab: TransferTab = {
      tabId: `edit-tab-${targetEditData.id}`,
      title: targetEditData.transferNo || 'Sửa phiếu',
      id: targetEditData.id,
      transferNo: targetEditData.transferNo || generateTransferCode(),
      sourceWarehouseCode: targetEditData.sourceWarehouse || 'KH001',
      destinationWarehouseCode: targetEditData.destinationWarehouse || 'KH002',
      assignedStaffEmail: targetEditData.createdBy || currentStaffEmail,
      orderDate: (targetEditData.scheduledDate || (targetEditData as any).orderDate || targetEditData.createdAt || targetEditData.dispatchDate)
        ? toLocalDateTimeInputString(targetEditData.scheduledDate || (targetEditData as any).orderDate || targetEditData.createdAt || targetEditData.dispatchDate)
        : formatISOWithSeconds(),
      dispatchDate: (targetEditData.dispatchDate || targetEditData.scheduledDate || targetEditData.createdAt)
        ? toLocalDateTimeInputString(targetEditData.dispatchDate || targetEditData.scheduledDate || targetEditData.createdAt)
        : formatISOWithSeconds(),
      receiveDate: targetEditData.receiveDate
        ? toLocalDateTimeInputString(targetEditData.receiveDate)
        : formatISOWithSeconds(new Date(Date.now() + 86400000)),
      driverName: targetEditData.driverName || '',
      driverPhone: targetEditData.driverPhone || '',
      vehiclePlate: targetEditData.vehiclePlate || '',
      generalNote: targetEditData.note || '',
      status: targetEditData.status || 'DRAFT',
      details: paddedRows,
    };

    setTabs([editTab]);
    setActiveTabId(editTab.tabId);
  }, [targetEditData?.id]);

  // Load fresh order information directly from server database when editing
  useEffect(() => {
    if (!targetEditData?.id) return;
    let isCancelled = false;

    deliveryApi.getTransferOrder(targetEditData.id)
      .then((serverOrder) => {
        if (isCancelled || !serverOrder) return;
        const sOrderDate = serverOrder.scheduledDate || (serverOrder as any).orderDate || serverOrder.createdAt || serverOrder.dispatchDate;
        const sDispatchDate = serverOrder.dispatchDate || serverOrder.scheduledDate || serverOrder.createdAt;
        const sReceiveDate = serverOrder.receiveDate;

        setTabs((prevTabs) =>
          prevTabs.map((tab) => {
            if (tab.id !== targetEditData.id) return tab;
            return {
              ...tab,
              orderDate: sOrderDate ? toLocalDateTimeInputString(sOrderDate) : tab.orderDate,
              dispatchDate: sDispatchDate ? toLocalDateTimeInputString(sDispatchDate) : tab.dispatchDate,
              receiveDate: sReceiveDate ? toLocalDateTimeInputString(sReceiveDate) : tab.receiveDate,
              sourceWarehouseCode: serverOrder.sourceWarehouse || tab.sourceWarehouseCode,
              destinationWarehouseCode: serverOrder.destinationWarehouse || tab.destinationWarehouseCode,
              assignedStaffEmail: serverOrder.createdBy || tab.assignedStaffEmail,
              driverName: serverOrder.driverName || tab.driverName,
              driverPhone: serverOrder.driverPhone || tab.driverPhone,
              vehiclePlate: serverOrder.vehiclePlate || tab.vehiclePlate,
              generalNote: serverOrder.note || tab.generalNote,
              status: serverOrder.status || tab.status,
            };
          })
        );
      })
      .catch((err) => {
        console.warn('Không thể đồng bộ chi tiết phiếu chuyển từ server:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, [targetEditData?.id]);

  // Sync draft tabs to sessionStorage (when not in edit mode)
  useEffect(() => {
    if (!targetEditData && tabs && tabs.length > 0) {
      sessionStorage.setItem('transfer_tabs_draft', JSON.stringify(tabs));
      sessionStorage.setItem('transfer_active_tab_id', activeTabId);
    }
  }, [tabs, activeTabId, targetEditData]);

  // Toast auto-hide
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Click outside listener for product table dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('.product-table-dropdown')) {
        setActiveProductDropdownRowId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch Master Data
  useEffect(() => {
    async function loadMasterData() {
      try {
        const [prodRes, userRes, whRes] = await Promise.all([
          fetch(`${API_BASE_URL}/products`, { headers: authHeaders() }).catch(() => null),
          fetch(`${API_BASE_URL}/users`, { headers: authHeaders() }).catch(() => null),
          fetch(`${API_BASE_URL}/warehouses`, { headers: authHeaders() }).catch(() => null),
        ]);

        if (prodRes && prodRes.ok) {
          const prodData = await prodRes.json();
          const loadedProducts = filterOutDeletedProducts(Array.isArray(prodData) ? prodData : prodData.data || []) as ProductOption[];
          setProducts(loadedProducts);

          // Auto-enrich unit price and totalAmount if price is 0 or missing
          setTabs((prevTabs) =>
            prevTabs.map((tab) => ({
              ...tab,
              details: tab.details.map((row) => {
                let pPrice = row.price;
                const matched = loadedProducts.find(
                  (p) =>
                    (row.productId && String(p.id) === String(row.productId)) ||
                    (row.productSku && p.internalSku && p.internalSku.toLowerCase() === row.productSku.toLowerCase()) ||
                    (row.productName && p.name && p.name.toLowerCase() === row.productName.toLowerCase())
                );
                if ((!pPrice || pPrice === 0) && matched) {
                  pPrice = getProductPrice(matched);
                }
                const q = row.qty || 0;
                return {
                  ...row,
                  price: pPrice,
                  totalAmount: q * pPrice,
                };
              }),
            }))
          );
        }

        if (userRes && userRes.ok) {
          const userData = await userRes.json();
          setUsers(Array.isArray(userData) ? userData : userData.data || []);
        }

        if (whRes && whRes.ok) {
          const whData = await whRes.json();
          const rawList = Array.isArray(whData) ? whData : whData.data || [];
          const list = mergeStoredWarehouses(rawList, getStoredWarehouses());
          setWarehouses(list);
          if (list.length > 0 && !targetEditData) {
            const firstWh = list[0]?.code || list[0]?.id || 'KH002';
            const secondWh = list[1]?.code || list[1]?.id || list[0]?.code || list[0]?.id || 'KH001';
            setTabs((prev) =>
              prev.map((tab) => {
                const isSourceValid = list.some((w: any) => w.code === tab.sourceWarehouseCode || w.id === tab.sourceWarehouseCode);
                const isDestValid = list.some((w: any) => w.code === tab.destinationWarehouseCode || w.id === tab.destinationWarehouseCode);
                return {
                  ...tab,
                  sourceWarehouseCode: isSourceValid ? tab.sourceWarehouseCode : secondWh,
                  destinationWarehouseCode: isDestValid ? tab.destinationWarehouseCode : firstWh,
                };
              })
            );
          }
        }

      } catch (err) {
        console.error('Lỗi khi tải master data phiếu điều chuyển:', err);
      }
    }
    loadMasterData();
  }, [targetEditData]);

  // Active Tab Helpers
  const updateActiveTab = useCallback(
    (updater: (prev: TransferTab) => TransferTab) => {
      setTabs((prev) => prev.map((t) => (t.tabId === activeTabId ? updater(t) : t)));
    },
    [activeTabId]
  );

  const handleSourceWarehouseChange = (newSourceCode: string) => {
    updateActiveTab((t) => ({
      ...t,
      sourceWarehouseCode: newSourceCode,
      details: t.details.map((d) => ({ ...d, sourceWarehouseCode: newSourceCode })),
    }));
  };

  const handleDestinationWarehouseChange = (newDestCode: string) => {
    updateActiveTab((t) => ({
      ...t,
      destinationWarehouseCode: newDestCode,
    }));
  };

  // Row update helpers
  const updateRow = (rowId: string, patch: Partial<TransferRowItem>) => {
    updateActiveTab((t) => ({
      ...t,
      details: t.details.map((item) => {
        if (item.rowId !== rowId) return item;
        const updated = { ...item, ...patch };

        if (patch.productId && patch.productId !== item.productId) {
          const matched = products.find((p) => p.id === patch.productId);
          if (matched) {
            updated.productName = matched.name;
            updated.productSku = matched.internalSku;
            updated.unit = matched.unit || 'Cái';
            if (patch.price === undefined || patch.price === 0) {
              updated.price = getProductPrice(matched);
            }
            if (updated.qty === 0) updated.qty = 1;
          }
        } else if (patch.productId && patch.price === 0) {
          const matched = products.find((p) => p.id === patch.productId);
          if (matched) {
            updated.price = getProductPrice(matched);
          }
        }

        updated.totalAmount = Math.max(0, updated.qty * updated.price);
        return updated;
      }),
    }));
  };

  const handleAddBlankRow = () => {
    updateActiveTab((t) => ({
      ...t,
      details: [...t.details, makeEmptyRow(t.details.length, t.sourceWarehouseCode)],
    }));
  };

  const handleRemoveRow = (rowId: string) => {
    updateActiveTab((t) => ({
      ...t,
      details: t.details.filter((d) => d.rowId !== rowId),
    }));
  };

  const handleDuplicateRow = (index: number) => {
    updateActiveTab((t) => {
      const source = t.details[index];
      if (!source) return t;
      const duplicated: TransferRowItem = {
        ...source,
        rowId: `row-${Date.now()}-${Math.random()}`,
      };
      const next = [...t.details];
      next.splice(index + 1, 0, duplicated);
      return { ...t, details: next };
    });
    setToast({ type: 'success', message: `Đã nhân đôi dòng số ${index + 1}` });
  };

  // Handle Barcode Scanner result
  const handleBarcodeScanned = (scanned: ScannedProduct) => {
    if (!activeTab || !scanned) return;
    const barcodeVal = scanned.supplierBarcode || scanned.internalSku || (scanned as any).barcode || '';

    const matchedProduct = products.find(
      (p) => (barcodeVal && p.internalSku?.toLowerCase() === barcodeVal.toLowerCase()) || p.name?.toLowerCase() === scanned.name?.toLowerCase()
    );

    const productIdToUse = matchedProduct ? matchedProduct.id : scanned.id;
    const skuToUse = matchedProduct ? matchedProduct.internalSku : (barcodeVal || scanned.internalSku);
    const nameToUse = scanned.name;
    const priceToUse = getProductPrice(scanned as any) || getProductPrice(matchedProduct);
    const unitToUse = scanned.unit || matchedProduct?.unit || 'Cái';

    const existingIndex = activeTab.details.findIndex((d) => d.productId === productIdToUse || (skuToUse && d.productSku === skuToUse));

    if (existingIndex >= 0) {
      const row = activeTab.details[existingIndex];
      updateRow(row.rowId, { qty: row.qty + 1 });
      setToast({ message: `Đã cộng thêm 1 SL cho mặt hàng "${nameToUse}"`, type: 'success' });
    } else {
      const emptyRow = activeTab.details.find((d) => !d.productName && !d.productId);
      if (emptyRow) {
        updateRow(emptyRow.rowId, {
          productId: productIdToUse,
          productSku: skuToUse,
          productName: nameToUse,
          unit: unitToUse,
          price: priceToUse,
          qty: 1,
        });
      } else {
        const newRow: TransferRowItem = {
          rowId: `row-${Date.now()}-${Math.random()}`,
          productId: productIdToUse,
          productSku: skuToUse,
          productName: nameToUse,
          unit: unitToUse,
          sourceWarehouseCode: activeTab.sourceWarehouseCode,
          qty: 1,
          price: priceToUse,
          totalAmount: priceToUse,
          note: '',
        };
        updateActiveTab((t) => ({ ...t, details: [...t.details, newRow] }));
      }
      setToast({ message: `Đã thêm sản phẩm "${nameToUse}" vào phiếu!`, type: 'success' });
    }
  };

  // Filtered Products for row autocomplete
  const getFilteredProductsForRow = (rowText: string) => {
    const kw = (rowText || '').trim().toLowerCase();
    if (!kw) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(kw) || (p.internalSku || '').toLowerCase().includes(kw)
    );
  };

  // Calculations
  const activeValidItems = useMemo(() => {
    if (!activeTab) return [];
    return activeTab.details.filter((d) => (d.productName || d.productSku || d.productId) && d.qty > 0);
  }, [activeTab]);

  const activePickBinRow = useMemo(() => {
    if (!activePickBinRowId || !activeTab) return null;
    return activeTab.details.find((r) => r.rowId === activePickBinRowId) || null;
  }, [activePickBinRowId, activeTab]);

  const totalQty = useMemo(() => {
    return activeValidItems.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  }, [activeValidItems]);

  const grandTotal = useMemo(() => {
    return activeValidItems.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
  }, [activeValidItems]);

  // Back action navigation
  const handleBackNavigation = () => {
    try {
      sessionStorage.removeItem('transfer_tabs_draft');
      sessionStorage.removeItem('transfer_active_tab_id');
    } catch { }
    if (onBack) {
      onBack();
    } else if (isReceiveMode || (location.state as any)?.fromRequests) {
      navigate('/delivery/transfer-requests');
    } else {
      navigate('/delivery/transfer-orders');
    }
  };

  // Clear / Reset Current Tab Rows
  const handleClearCurrentTab = () => {
    if (!activeTab) return;
    updateActiveTab((t) => ({
      ...t,
      details: makeInitialRows(DEFAULT_ROWS_COUNT, t.sourceWarehouseCode),
    }));
    try {
      sessionStorage.removeItem('transfer_tabs_draft');
      sessionStorage.removeItem('transfer_active_tab_id');
    } catch { }
    setToast({ message: 'Đã xóa toàn bộ sản phẩm và làm mới phiếu!', type: 'success' });
  };

  // Save Transfer Handler
  const handleSaveTransfer = async (statusSave: 'DRAFT' | 'APPROVED' | 'IN_TRANSIT' | 'DELIVERED' | 'COMPLETED') => {
    if (!activeTab) return;

    if (activeValidItems.length === 0) {
      setToast({ type: 'error', message: 'Vui lòng chọn ít nhất 1 sản phẩm với số lượng > 0' });
      return;
    }

    if (!activeTab.sourceWarehouseCode || !activeTab.destinationWarehouseCode) {
      setToast({ type: 'error', message: 'Vui lòng chọn đầy đủ Kho xuất và Kho nhập (Chi nhánh)' });
      return;
    }

    if (activeTab.sourceWarehouseCode === activeTab.destinationWarehouseCode) {
      setToast({ type: 'error', message: 'Kho xuất và Kho nhập chi nhánh không được trùng nhau' });
      return;
    }

    setSaving(true);
    try {
      const sourceWh = (activeTab.sourceWarehouseCode || warehouses[0]?.code || warehouses[0]?.id || 'KH001').trim();
      const destWh = (activeTab.destinationWarehouseCode || warehouses[1]?.code || warehouses[1]?.id || 'KH002').trim();

      const finalStatus = isReceiveMode ? 'DELIVERED' : (statusSave === 'APPROVED' ? 'IN_TRANSIT' : statusSave);

      const payload = {
        transferNo: activeTab.transferNo,
        sourceWarehouse: sourceWh,
        sourceWarehouseCode: sourceWh,
        destinationWarehouse: destWh,
        destinationWarehouseCode: destWh,
        scheduledDate: activeTab.orderDate ? new Date(activeTab.orderDate).toISOString() : new Date().toISOString(),
        orderDate: activeTab.orderDate ? new Date(activeTab.orderDate).toISOString() : new Date().toISOString(),
        createdAt: activeTab.orderDate ? new Date(activeTab.orderDate).toISOString() : undefined,
        dispatchDate: activeTab.dispatchDate ? new Date(activeTab.dispatchDate).toISOString() : (activeTab.orderDate ? new Date(activeTab.orderDate).toISOString() : new Date().toISOString()),
        receiveDate: isReceiveMode
          ? (activeTab.receiveDate ? new Date(activeTab.receiveDate).toISOString() : new Date().toISOString())
          : (activeTab.receiveDate ? new Date(activeTab.receiveDate).toISOString() : undefined),
        driverName: activeTab.driverName ? activeTab.driverName.trim() : undefined,
        driverPhone: activeTab.driverPhone ? activeTab.driverPhone.trim() : undefined,
        vehiclePlate: activeTab.vehiclePlate ? activeTab.vehiclePlate.trim() : undefined,
        status: finalStatus as any,
        note: activeTab.generalNote ? activeTab.generalNote.trim() : undefined,
        createdBy: currentUser?.fullName || currentUser?.name || currentUser?.username || currentUser?.email || 'System Administrator',
        items: activeValidItems.map((it) => ({
          id: it.productId || it.rowId,
          productCode: it.productSku ? it.productSku.trim() : (it.productId ? `SKU-${it.productId}` : `SKU-${Math.floor(100000 + Math.random() * 900000)}`),
          productName: it.productName ? it.productName.trim() : 'Sản phẩm điều chuyển',
          unit: it.unit ? it.unit.trim() : 'Cái',
          quantity: Math.max(1, Number(it.qty) || 1),
          price: Number(it.price || 0),
          locationBin: it.locationBin ? it.locationBin.trim() : (Array.isArray(it.assignedBins) && it.assignedBins.length > 0 ? it.assignedBins.join(', ') : undefined),
          assignedBins: Array.isArray(it.assignedBins) && it.assignedBins.length > 0 ? it.assignedBins : undefined,
          note: it.note ? it.note.trim() : undefined,
        })),
      };

      if (activeTab.id) {
        await deliveryApi.updateTransferOrder(activeTab.id, payload);
        setToast({ type: 'success', message: `Cập nhật thành công phiếu điều chuyển: ${activeTab.transferNo}` });
      } else {
        await deliveryApi.createTransferOrder(payload);
        setToast({ type: 'success', message: `Tạo mới thành công phiếu điều chuyển: ${activeTab.transferNo}` });
      }

      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('warehouse-goods-cleared'));

      try {
        sessionStorage.removeItem('transfer_tabs_draft');
        sessionStorage.removeItem('transfer_active_tab_id');
      } catch { }

      setTimeout(() => {
        if (isReceiveMode || (location.state as any)?.fromRequests) {
          navigate('/delivery/transfer-requests');
        } else {
          navigate('/delivery/transfer-orders');
        }
      }, 500);
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Lỗi khi lưu phiếu điều chuyển kho' });
    } finally {
      setSaving(false);
    }
  };

  const displayDetails = useMemo(() => {
    const details = activeTab?.details || [];
    if (isReadOnly) {
      return details.filter((r) => r.productId || (r.productName && r.productName.trim().length > 0));
    }
    return details;
  }, [activeTab?.details, isReadOnly]);

  const contentMarkup = (
    <div
      className={`animate-[fadeIn_0.2s_ease-out] ${
        isFullscreen
          ? 'fixed inset-0 z-[9999] bg-slate-100 p-2.5 sm:p-4 flex flex-col h-screen overflow-hidden'
          : 'space-y-4 pb-20'
      }`}
    >
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[9999] flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl transition-all border-2 ${
            toast.type === 'error'
              ? 'bg-red-50 text-red-700 border-red-300'
              : 'bg-emerald-50 text-emerald-800 border-emerald-300'
          }`}
        >
          {toast.type === 'error' ? <XCircle className="h-5 w-5 text-red-600" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          <p className="text-xs font-black">{toast.message}</p>
          <button onClick={() => setToast(null)} className="ml-2 rounded-lg p-1 hover:bg-black/5 transition cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Top Header Strip with Action Buttons on the Right (Hidden in Fullscreen) */}
      {!isFullscreen && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap flex-shrink-0">
          {/* Title Pill Badge */}
          <div className="inline-flex items-center gap-2.5 rounded-xl bg-cyan-600 px-4 py-2 text-white shadow-sm">
            <Truck className="h-5 w-5 text-cyan-100" />
            <h1 className="text-base font-black tracking-tight uppercase">
              {isReceiveMode ? 'TẠO PHIẾU NHẬP CHUYỂN CHI NHÁNH' : 'TẠO PHIẾU XUẤT CHUYỂN CHI NHÁNH'}
            </h1>
          </div>

          {/* Action Buttons at Top Right */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Transfer Order Code Pill */}
            <div className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm">
              <FileText className="h-3.5 w-3.5 text-cyan-100" />
              <span>{activeTab?.transferNo || 'PHIẾU MỚI'}</span>
            </div>

            {!isReadOnly && (
              <button
                type="button"
                onClick={handleClearCurrentTab}
                className="inline-flex items-center gap-1.5 rounded-xl border-2 border-amber-500 bg-white hover:bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-700 transition shadow-xs cursor-pointer"
                title="Làm mới form và xóa các dòng đã chọn"
              >
                <RotateCcw className="h-4 w-4 text-amber-600" />
                <span>Làm mới phiếu</span>
              </button>
            )}

            {/* Back button */}
            <button
              type="button"
              onClick={handleBackNavigation}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-cyan-500 bg-white hover:bg-cyan-50 px-4 py-1.5 text-xs font-bold text-cyan-700 transition shadow-xs cursor-pointer"
            >
              <ArrowLeft size={16} />
              <span>Quay lại</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Information Control Card (2 Rows Layout - Cyan Theme) */}
      <div className="rounded-2xl border-2 border-cyan-500/30 bg-white p-4 shadow-md space-y-3.5 flex-shrink-0">
        {/* Row 1: Thông tin Lệnh & Kho xuất nhập */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Mã HĐ / Lệnh */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">MÃ PHIẾU / LỆNH</label>
            <input
              type="text"
              disabled={isReadOnly}
              value={activeTab?.transferNo || ''}
              onChange={(e) => updateActiveTab((t) => ({ ...t, transferNo: e.target.value }))}
              placeholder="Tạo tự động"
              className="h-10 w-full rounded-xl border-2 border-cyan-200 bg-cyan-50/50 px-3 text-xs font-black text-cyan-900 outline-none focus:border-cyan-500 uppercase disabled:bg-slate-100 disabled:text-slate-600 disabled:border-slate-200"
            />
          </div>

          {/* Ngày Lập Phiếu (Lấy chuẩn từ server CSDL) */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-cyan-600" />
              <span>NGÀY LẬP PHIẾU</span>
            </label>
            <input
              type="datetime-local"
              step="1"
              disabled={isReadOnly}
              value={activeTab?.orderDate ? (activeTab.orderDate.length > 16 ? activeTab.orderDate.slice(0, 16) : activeTab.orderDate) : ''}
              onChange={(e) => updateActiveTab((t) => ({ ...t, orderDate: e.target.value }))}
              className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none transition focus:border-cyan-500 disabled:bg-slate-100 disabled:text-slate-600 disabled:border-slate-200"
            />
          </div>

          {/* Kho xuất (Kho nguồn) */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
              <WarehouseIcon className="h-3.5 w-3.5 text-cyan-600" />
              <span>KHO XUẤT HÀNG (KHO NGUỒN)</span>
            </label>
            <select
              disabled={isReadOnly}
              value={activeTab?.sourceWarehouseCode || ''}
              onChange={(e) => handleSourceWarehouseChange(e.target.value)}
              className="h-10 w-full rounded-xl border-2 border-cyan-500 bg-cyan-50/50 px-3 text-xs font-bold text-cyan-900 outline-none transition focus:border-cyan-600 cursor-pointer disabled:bg-slate-100 disabled:text-slate-600 disabled:border-slate-200 disabled:cursor-not-allowed"
            >
              {warehouses.length > 0 ? (
                warehouses.map((wh) => (
                  <option key={wh.id || wh.code} value={wh.code || wh.id}>
                    [{wh.code || wh.id}] {wh.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="KH001">KH001 - Kho Tổng (Hà Nội)</option>
                  <option value="KH002">KH002 - Kho Chi Nhánh HCM</option>
                </>
              )}
            </select>
          </div>

          {/* Kho nhập (Chi nhánh nhận) - Đồng nhất màu Cyan */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
              <ArrowRight className="h-3.5 w-3.5 text-cyan-600" />
              <span>KHO NHẬP (CHI NHÁNH NHẬN)</span>
            </label>
            <select
              disabled={isReadOnly}
              value={activeTab?.destinationWarehouseCode || ''}
              onChange={(e) => handleDestinationWarehouseChange(e.target.value)}
              className="h-10 w-full rounded-xl border-2 border-cyan-500 bg-cyan-50/50 px-3 text-xs font-bold text-cyan-900 outline-none transition focus:border-cyan-600 cursor-pointer disabled:bg-slate-100 disabled:text-slate-600 disabled:border-slate-200 disabled:cursor-not-allowed"
            >
              {warehouses.length > 0 ? (
                warehouses.map((wh) => (
                  <option key={wh.id || wh.code} value={wh.code || wh.id}>
                    [{wh.code || wh.id}] {wh.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="KH002">KH002 - Kho Chi Nhánh HCM</option>
                  <option value="KH001">KH001 - Kho Tổng (Hà Nội)</option>
                </>
              )}
            </select>
          </div>

          {/* Nhân viên phụ trách */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-cyan-600" />
              <span>NHÂN VIÊN PHỤ TRÁCH</span>
            </label>
            <select
              disabled={isReadOnly}
              value={activeTab?.assignedStaffEmail || ''}
              onChange={(e) => updateActiveTab((t) => ({ ...t, assignedStaffEmail: e.target.value }))}
              className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 cursor-pointer disabled:bg-slate-100 disabled:text-slate-600 disabled:border-slate-200 disabled:cursor-not-allowed"
            >
              <option value={currentUser?.email || ''}>{currentUser?.fullName || currentUser?.email || 'Nhân viên phụ trách'}</option>
              {users.map((u) => (
                <option key={u.id} value={u.email}>
                  {u.fullName || u.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Thời gian xuất/nhận (Giờ phút giây) + Thông tin tài xế & phương tiện */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${isReceiveMode ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3.5 pt-2 border-t border-slate-100`}>
          {/* Ngày & Giờ Xuất Giao Hàng */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-cyan-600" />
              <span>NGÀY & GIỜ GIAO (XUẤT)</span>
            </label>
            <input
              type="datetime-local"
              step="1"
              disabled={isReadOnly || isReceiveMode}
              value={activeTab?.dispatchDate ? (activeTab.dispatchDate.length > 16 ? activeTab.dispatchDate.slice(0, 16) : activeTab.dispatchDate) : ''}
              onChange={(e) => updateActiveTab((t) => ({ ...t, dispatchDate: e.target.value }))}
              className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none transition focus:border-cyan-500 disabled:bg-slate-100 disabled:text-slate-600 disabled:border-slate-200"
            />
          </div>

          {/* Ngày & Giờ Thực Nhận Kho (Chỉ hiển thị và yêu cầu điền khi Duyệt Nhập Kho Nội Bộ) */}
          {isReceiveMode && (
            <div>
              <label className="mb-1 block text-xs font-bold text-emerald-800 flex items-center gap-1">
                <CalendarCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>NGÀY & GIỜ THỰC NHẬN KHO</span>
              </label>
              <input
                type="datetime-local"
                step="1"
                disabled={isReadOnly}
                value={activeTab?.receiveDate ? (activeTab.receiveDate.length > 16 ? activeTab.receiveDate.slice(0, 16) : activeTab.receiveDate) : ''}
                onChange={(e) => updateActiveTab((t) => ({ ...t, receiveDate: e.target.value }))}
                className="h-10 w-full rounded-xl border-2 border-emerald-400 bg-emerald-50/50 px-3 text-xs font-bold text-emerald-950 outline-none transition focus:border-emerald-600 focus:bg-white disabled:bg-slate-100 disabled:text-slate-600 disabled:border-slate-200"
              />
            </div>
          )}

          {/* Tên tài xế vận chuyển / Shipper */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                <Bike className="h-3.5 w-3.5 text-cyan-600" />
                <span>TÀI XẾ / SHIPPER VẬN CHUYỂN</span>
              </label>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => setShowQuickAddShipperModal(true)}
                  className="inline-flex items-center gap-0.5 text-[11px] font-black text-cyan-600 hover:text-cyan-800 hover:underline cursor-pointer"
                  title="Thêm nhanh tài xế / Shipper mới"
                >
                  <Plus className="h-3 w-3" />
                  <span>Thêm tài xế mới</span>
                </button>
              )}
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                list="shippers-datalist"
                disabled={isReadOnly}
                value={activeTab?.driverName || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const matched = shippers.find((s) => s.name === val || `[${s.company || 'Nội bộ'}] ${s.name}` === val);
                  if (matched) {
                    updateActiveTab((t) => ({
                      ...t,
                      driverName: matched.name,
                      driverPhone: matched.phone || t.driverPhone,
                      vehiclePlate: matched.vehiclePlate || t.vehiclePlate,
                    }));
                  } else {
                    updateActiveTab((t) => ({ ...t, driverName: val }));
                  }
                }}
                placeholder="Chọn hoặc nhập tên tài xế..."
                className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none transition focus:border-cyan-500 disabled:bg-slate-100 disabled:text-slate-600 disabled:border-slate-200"
              />
              <datalist id="shippers-datalist">
                {shippers.map((s) => (
                  <option key={s.id} value={s.name}>
                    [{s.company || 'Nội bộ'}] {s.phone} ({s.vehiclePlate || 'N/A'})
                  </option>
                ))}
              </datalist>
            </div>
          </div>

          {/* SĐT tài xế liên hệ */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
              <Phone className="h-3.5 w-3.5 text-cyan-600" />
              <span>SĐT TÀI XẾ LIÊN HỆ</span>
            </label>
            <input
              type="tel"
              disabled={isReadOnly}
              value={activeTab?.driverPhone || ''}
              onChange={(e) => updateActiveTab((t) => ({ ...t, driverPhone: e.target.value }))}
              placeholder="Nhập số điện thoại tài xế"
              className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none transition focus:border-cyan-500 disabled:bg-slate-100 disabled:text-slate-600 disabled:border-slate-200"
            />
          </div>

          {/* Biển số xe / Phương tiện */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
              <Car className="h-3.5 w-3.5 text-cyan-600" />
              <span>BIỂN SỐ XE / PHƯƠNG TIỆN</span>
            </label>
            <input
              type="text"
              disabled={isReadOnly}
              value={activeTab?.vehiclePlate || ''}
              onChange={(e) => updateActiveTab((t) => ({ ...t, vehiclePlate: e.target.value }))}
              placeholder="Ví dụ: 30L-636.86"
              className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-black text-slate-900 outline-none transition focus:border-cyan-500 uppercase disabled:bg-slate-100 disabled:text-slate-600 disabled:border-slate-200"
            />
          </div>
        </div>
      </div>

      {/* 2-Column Main Section: Left Table + Right Summary Panel */}
      <div className={`flex flex-col lg:flex-row gap-3 items-stretch ${isFullscreen ? 'flex-1 min-h-0' : 'items-start'}`}>
        {/* LEFT COLUMN: Product Table */}
        <div className={`flex-1 min-w-0 flex flex-col ${isFullscreen ? 'h-full' : ''}`}>
          <div className={`flex flex-col rounded-2xl border-2 border-cyan-200 bg-white shadow-sm overflow-hidden min-h-0 ${isFullscreen ? 'flex-1 h-full' : ''}`}>
          {/* Table Header Controls */}
          <div className="px-3 py-2.5 border-b-2 border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2 text-cyan-900 font-black text-xs sm:text-sm">
              <Package className="h-4 w-4 text-cyan-600" />
              <span>
                {isReceiveMode ? 'THÔNG TIN HÀNG HÓA NHẬP CHUYỂN' : 'THÔNG TIN HÀNG HÓA XUẤT CHUYỂN'} ({activeValidItems.length} MẶT HÀNG - TỔNG SL: {totalQty})
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!isReadOnly && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowScannerModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border-2 border-cyan-600 bg-white px-3 py-1.5 text-xs font-bold text-cyan-700 hover:bg-cyan-50 transition cursor-pointer shadow-xs"
                    title="Mở camera để quét mã vạch"
                  >
                    <ScanLine className="h-4 w-4 text-cyan-600" />
                    <span>Quét Camera</span>
                  </button>

                  {/* Ô Tự động Phát hiện Trạng thái Máy Quét */}
                  <div
                    className={`inline-flex items-center px-3.5 py-1.5 rounded-lg border-2 text-xs font-extrabold shadow-2xs select-none ${
                      isScannerConnected
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-amber-400 bg-amber-50 text-amber-900'
                    }`}
                    title={
                      isScannerConnected
                        ? 'Máy quét mã vạch đã kết nối & sẵn sàng quét'
                        : 'Máy quét chưa kết nối'
                    }
                  >
                    <span>Máy quét: {isScannerConnected ? 'Đã kết nối' : 'Chưa kết nối'}</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddBlankRow}
                    className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-3.5 py-1.5 text-xs font-extrabold text-white shadow-sm hover:bg-cyan-700 transition cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Thêm dòng mới</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="inline-flex items-center gap-1 rounded-lg border-2 border-cyan-500 bg-cyan-50 px-2.5 py-1.5 text-xs font-bold text-cyan-800 hover:bg-cyan-100 transition cursor-pointer shadow-xs"
                title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Phóng to toàn màn hình'}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4 text-cyan-700" /> : <Maximize2 className="h-4 w-4 text-cyan-700" />}
                <span>{isFullscreen ? 'Thu nhỏ' : 'Phóng to'}</span>
              </button>
            </div>
          </div>

          {/* Grid Product Table (Rộng rãi, xóa cột SKU & Kho xuất) */}
          <div className={`overflow-x-auto overflow-y-auto custom-scrollbar flex-1 min-h-0 ${isFullscreen ? '' : 'max-h-[calc(100vh-340px)]'}`}>
            <table className="w-full text-left border-collapse text-xs min-w-[800px]">
              <thead className="bg-slate-100 text-slate-800 font-black border-b border-cyan-200 uppercase text-[11px] sticky top-0 z-10">
                <tr>
                  <th className="p-3 w-12 text-center border-r border-slate-200 bg-slate-100">STT</th>
                  <th className="p-3 min-w-[280px] text-center border-r border-slate-200 bg-slate-100">TÊN HÀNG HÓA</th>
                  {!isReceiveMode && (
                    <th className="p-3 min-w-[150px] text-center border-r border-slate-200 bg-slate-100">
                      KỆ LẤY HÀNG
                    </th>
                  )}
                  <th className="p-3 w-24 text-center border-r border-slate-200 bg-slate-100">ĐVT</th>
                  <th className="p-3 w-28 text-center border-r border-slate-200 bg-slate-100">
                    {isReceiveMode ? 'SL NHẬP' : 'SL XUẤT'}
                  </th>
                  <th className="p-3 w-32 text-center border-r border-slate-200 bg-slate-100">ĐƠN GIÁ (đ)</th>
                  <th className="p-3 w-36 text-center border-r border-slate-200 bg-slate-100">THÀNH TIỀN</th>
                  <th className="p-3 min-w-[180px] text-center border-r border-slate-200 bg-slate-100">GHI CHÚ</th>
                  {isReceiveMode && (
                    <th className="p-3 min-w-[160px] text-center border-r border-slate-200 bg-slate-100">
                      KỆ NHẬP HÀNG
                    </th>
                  )}
                  <th className="p-3 w-20 text-center bg-slate-100">TT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {displayDetails.map((row, idx) => {
                  const isEven = idx % 2 === 1;
                  return (
                    <tr
                      key={row.rowId}
                      className={`${isEven ? 'bg-cyan-50/20' : 'bg-white'} hover:bg-cyan-100/40 transition-colors`}
                    >
                      {/* STT */}
                      <td className="p-2 text-center font-bold text-slate-500 border-r border-slate-200">
                        {idx + 1}.
                      </td>

                      {/* TÊN HÀNG HÓA - Searchable Interactive Inline Dropdown */}
                      <td className="p-1.5 border-r border-slate-200 relative product-table-dropdown">
                        <input
                          type="text"
                          disabled={isReadOnly}
                          value={row.productName || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateRow(row.rowId, { productName: val, qty: row.qty > 0 ? row.qty : 1 });
                            setActiveProductDropdownRowId(row.rowId);
                          }}
                          onFocus={() => !isReadOnly && setActiveProductDropdownRowId(row.rowId)}
                          onClick={() => !isReadOnly && setActiveProductDropdownRowId(row.rowId)}
                          placeholder="Chọn hoặc nhập tên hàng hóa..."
                          className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-bold text-slate-900 outline-none focus:border-cyan-600 text-xs disabled:bg-slate-50 disabled:text-slate-700 disabled:border-slate-200"
                        />

                        {/* Interactive Table Dropdown */}
                        {activeProductDropdownRowId === row.rowId && !isReadOnly && (
                          <div className="absolute left-0 top-full z-[100] mt-1 w-[460px] max-h-60 overflow-y-auto rounded-xl border border-cyan-300 bg-white shadow-2xl flex flex-col">
                            <div className="flex bg-cyan-50 border-b border-cyan-200 px-3 py-2 text-[11px] font-black text-cyan-950 sticky top-0 z-10">
                              <span className="w-1/3 uppercase">Mã SKU</span>
                              <span className="w-1/3 uppercase">Tên Hàng Hóa</span>
                              <span className="w-1/3 text-right uppercase">SL Tồn Kho Xuất</span>
                            </div>
                            <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                              {getFilteredProductsForRow(row.productName).length === 0 ? (
                                <div className="p-3 text-center text-xs text-slate-400">Không tìm thấy sản phẩm phù hợp</div>
                              ) : (
                                getFilteredProductsForRow(row.productName).map((p) => {
                                  const stockInSource = getProductWarehouseStock(p, activeTab?.sourceWarehouseCode);
                                  const totalSys = Array.isArray(p.stockBalances) && p.stockBalances.length > 0
                                    ? p.stockBalances.reduce((s, b) => s + (Number(b.available) || Number(b.totalPhysical) || 0), 0)
                                    : Number(p.totalStock ?? p.totalPhysical ?? p.stockQty ?? 0);
                                  return (
                                    <div
                                      key={p.id}
                                      onClick={() => {
                                        updateRow(row.rowId, {
                                          productId: p.id,
                                          productSku: p.internalSku,
                                          productName: p.name,
                                          unit: p.unit || 'Cái',
                                          price: getProductPrice(p),
                                          qty: row.qty > 0 ? row.qty : 1,
                                        });
                                        setActiveProductDropdownRowId(null);
                                      }}
                                      className="flex items-center px-3 py-2 hover:bg-cyan-50 cursor-pointer text-xs transition"
                                    >
                                      <span className="w-1/3 font-bold text-cyan-800">{p.internalSku || 'SKU---'}</span>
                                      <span className="w-1/3 font-semibold text-slate-800 truncate pr-1">{p.name}</span>
                                      <div className="w-1/3 text-right">
                                        <span className={`font-black font-mono ${stockInSource > 0 ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                                          {stockInSource.toLocaleString('vi-VN')} {p.unit || 'Cái'}
                                        </span>
                                        {stockInSource === 0 && totalSys > 0 && (
                                          <span className="block text-[10px] text-amber-600 font-semibold">
                                            (Kho khác: {totalSys.toLocaleString('vi-VN')})
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* KỆ LẤY HÀNG (BÊN XUẤT) */}
                      {!isReceiveMode && (
                        <td className="p-1.5 border-r border-slate-200 text-center">
                          {isReadOnly ? (
                            <span className="inline-flex items-center gap-1 bg-cyan-100 text-cyan-950 border border-cyan-300 font-extrabold px-2 py-1 rounded-lg text-xs shadow-2xs">
                              <Layers className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
                              <span className="truncate max-w-[110px]">{row.assignedBins?.join(', ') || row.locationBin || '-'}</span>
                            </span>
                          ) : row.assignedBins && row.assignedBins.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => openPickBinModal(row.rowId)}
                              className="inline-flex items-center gap-1 bg-cyan-100 hover:bg-cyan-200 text-cyan-950 border border-cyan-300 font-extrabold px-2 py-1 rounded-lg text-xs shadow-2xs transition cursor-pointer"
                              title="Bấm để mở sơ đồ chọn vị trí kệ lấy hàng"
                            >
                              <Layers className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
                              <span className="truncate max-w-[110px]">{row.assignedBins.join(', ')}</span>
                            </button>
                          ) : row.locationBin ? (
                            <button
                              type="button"
                              onClick={() => openPickBinModal(row.rowId)}
                              className="inline-flex items-center gap-1 bg-cyan-100 hover:bg-cyan-200 text-cyan-950 border border-cyan-300 font-extrabold px-2 py-1 rounded-lg text-xs shadow-2xs transition cursor-pointer"
                              title="Bấm để mở sơ đồ chọn vị trí kệ lấy hàng"
                            >
                              <Layers className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
                              <span className="truncate max-w-[110px]">{row.locationBin}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openPickBinModal(row.rowId)}
                              className="inline-flex items-center gap-1 bg-white hover:bg-cyan-50 text-cyan-700 border border-cyan-400 font-bold px-2 py-1 rounded-lg text-xs transition cursor-pointer"
                              title="Bấm mở sơ đồ chọn vị trí kệ lấy hàng xuất chuyển"
                            >
                              <MapPin className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
                              <span>+ Chọn kệ lấy</span>
                            </button>
                          )}
                        </td>
                      )}

                      {/* ĐVT */}
                      <td className="p-1.5 text-center border-r border-slate-200">
                        <input
                          type="text"
                          disabled={isReadOnly}
                          value={row.unit}
                          onChange={(e) => updateRow(row.rowId, { unit: e.target.value })}
                          className="w-full h-9 text-center rounded-lg border border-slate-300 bg-white font-medium text-slate-800 outline-none focus:border-cyan-600 disabled:bg-slate-50 disabled:text-slate-700 disabled:border-slate-200"
                        />
                      </td>

                      {/* SỐ LƯỢNG */}
                      <td className="p-1.5 border-r border-slate-200">
                        <input
                          type="number"
                          min="0"
                          disabled={isReadOnly}
                          value={row.qty || ''}
                          onChange={(e) => updateRow(row.rowId, { qty: Number(e.target.value) })}
                          className="w-full h-9 px-2 text-right rounded-lg border border-slate-300 bg-white font-bold text-slate-900 outline-none focus:border-cyan-600 disabled:bg-slate-50 disabled:text-slate-700 disabled:border-slate-200"
                        />
                      </td>

                      {/* ĐƠN GIÁ (đ) */}
                      <td className="p-1.5 border-r border-slate-200">
                        <input
                          type="number"
                          min="0"
                          disabled={isReadOnly}
                          value={row.price || ''}
                          onChange={(e) => updateRow(row.rowId, { price: Number(e.target.value) })}
                          className="w-full h-9 px-2 text-right rounded-lg border border-slate-300 bg-white font-medium text-slate-800 outline-none focus:border-cyan-600 disabled:bg-slate-50 disabled:text-slate-700 disabled:border-slate-200"
                        />
                      </td>

                      {/* THÀNH TIỀN */}
                      <td className="p-2 text-right font-black text-cyan-900 border-r border-slate-200">
                        {formatMoney(row.totalAmount)}
                      </td>

                      {/* GHI CHÚ */}
                      <td className="p-1.5 border-r border-slate-200">
                        <input
                          type="text"
                          disabled={isReadOnly}
                          value={row.note}
                          onChange={(e) => updateRow(row.rowId, { note: e.target.value })}
                          placeholder="Ghi chú dòng..."
                          className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white font-normal text-slate-700 outline-none focus:border-cyan-600 disabled:bg-slate-50 disabled:text-slate-700 disabled:border-slate-200"
                        />
                      </td>

                      {/* KỆ NHẬP HÀNG (BÊN NHẬN - NẰM BÊN CẠNH CỘT GHI CHÚ) */}
                      {isReceiveMode && (
                        <td className="p-1.5 border-r border-slate-200 text-center">
                          {isReadOnly ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-950 border border-emerald-300 font-extrabold px-2.5 py-1 rounded-lg text-xs shadow-2xs">
                              <Layers className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span className="truncate max-w-[110px]">{row.assignedBins?.join(', ') || row.locationBin || '-'}</span>
                            </span>
                          ) : row.assignedBins && row.assignedBins.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => openPickBinModal(row.rowId)}
                              className="inline-flex items-center gap-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border border-emerald-300 font-extrabold px-2.5 py-1 rounded-lg text-xs shadow-2xs transition cursor-pointer"
                              title="Bấm để mở sơ đồ chọn vị trí kệ cất/nhập hàng"
                            >
                              <Layers className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span className="truncate max-w-[110px]">{row.assignedBins.join(', ')}</span>
                            </button>
                          ) : row.locationBin ? (
                            <button
                              type="button"
                              onClick={() => openPickBinModal(row.rowId)}
                              className="inline-flex items-center gap-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border border-emerald-300 font-extrabold px-2.5 py-1 rounded-lg text-xs shadow-2xs transition cursor-pointer"
                              title="Bấm để mở sơ đồ chọn vị trí kệ cất/nhập hàng"
                            >
                              <Layers className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span className="truncate max-w-[110px]">{row.locationBin}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openPickBinModal(row.rowId)}
                              className="inline-flex items-center gap-1 bg-white hover:bg-cyan-50 text-cyan-700 border border-cyan-400 font-bold px-2.5 py-1 rounded-lg text-xs transition cursor-pointer"
                              title="Bấm mở sơ đồ chọn vị trí kệ cất/nhập hàng"
                            >
                              <MapPin className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
                              <span>+ Chọn kệ nhập</span>
                            </button>
                          )}
                        </td>
                      )}

                      {/* TT (Actions) */}
                      <td className="p-2 text-center">
                        {isReadOnly ? (
                          <span className="text-slate-400 font-bold">-</span>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDuplicateRow(idx)}
                              className="p-1.5 text-cyan-600 hover:text-cyan-800 hover:bg-cyan-50 rounded-lg transition cursor-pointer"
                              title="Nhân đôi dòng"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(row.rowId)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              title="Xóa dòng"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer Summary Row */}
          <div className="bg-cyan-50/90 border-t-2 border-cyan-200 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs font-black text-cyan-950 uppercase">
              <span>TỔNG CỘNG HÀNG HÓA</span>
              <span className="text-slate-300">|</span>
              <span>SỐ DÒNG: <strong className="text-cyan-900">{activeValidItems.length}</strong></span>
              <span className="text-slate-300">|</span>
              <span>TỔNG SL XUẤT: <strong className="text-cyan-900">{totalQty}</strong></span>
            </div>

            <div className="text-xs font-black text-slate-900 flex items-center gap-2">
              <span>TỔNG GIÁ TRỊ:</span>
              <span className="text-sm font-black text-cyan-700 bg-white px-3 py-1 rounded-xl border border-cyan-300 shadow-2xs">
                {formatMoney(grandTotal)}
              </span>
            </div>
          </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SUMMARY CARD & ACTIONS */}
        <div className={`w-full lg:w-80 xl:w-96 flex-shrink-0 flex flex-col ${isFullscreen ? 'h-full' : ''}`}>
          <div className={`rounded-2xl border-2 border-cyan-200 bg-white p-4 shadow-sm flex flex-col justify-between ${isFullscreen ? 'h-full overflow-y-auto custom-scrollbar' : 'space-y-4'}`}>
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-cyan-200 pb-2.5 text-cyan-950 font-black text-xs uppercase tracking-wide">
                <Package className="h-4.5 w-4.5 text-cyan-600" />
                <span>{isReceiveMode ? 'THÔNG TIN NHẬP CHUYỂN NỘI BỘ' : 'THÔNG TIN ĐIỀU CHUYỂN NỘI BỘ'}</span>
              </div>

              {/* Quick Route Overview - Stacked Button Pill Style */}
              <div className="rounded-2xl border-2 border-cyan-200 bg-cyan-50/40 p-3.5 space-y-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">KHO XUẤT HÀNG (KHO NGUỒN)</label>
                  <div className="w-full py-2 px-3 rounded-xl border-2 border-cyan-400 bg-white text-cyan-950 font-black text-xs text-center shadow-xs">
                    [{activeTab?.sourceWarehouseCode}] {warehouses.find(w => w.code === activeTab?.sourceWarehouseCode)?.name || 'Kho Tổng'}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">KHO NHẬP (CHI NHÁNH NHẬN)</label>
                  <div className="w-full py-2 px-3 rounded-xl border-2 border-cyan-400 bg-white text-cyan-950 font-black text-xs text-center shadow-xs">
                    [{activeTab?.destinationWarehouseCode}] {warehouses.find(w => w.code === activeTab?.destinationWarehouseCode)?.name || 'Chi Nhánh Nhận'}
                  </div>
                </div>
              </div>

              {/* Ghi chú điều chuyển */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">Lý do / Ghi chú điều chuyển</label>
                <textarea
                  rows={3}
                  disabled={isReadOnly}
                  value={activeTab?.generalNote || ''}
                  onChange={(e) => updateActiveTab((t) => ({ ...t, generalNote: e.target.value }))}
                  placeholder="Nhập lý do điều chuyển nội bộ (VD: Điều chuyển cân bằng tồn kho)..."
                  className="w-full p-3 rounded-xl border-2 border-slate-200 bg-white font-medium text-slate-700 outline-none focus:border-cyan-600 resize-none text-xs disabled:bg-slate-100 disabled:text-slate-600 disabled:border-slate-200"
                />
              </div>

              {/* Highlight Total Card - Cyan & White Theme */}
              <div className="bg-cyan-50 border-2 border-cyan-300 rounded-2xl p-4 shadow-sm space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-slate-700 font-bold">
                  <span>{isReceiveMode ? 'Số mặt hàng nhập:' : 'Số mặt hàng xuất:'}</span>
                  <span className="font-black text-cyan-950 text-sm">{activeValidItems.length}</span>
                </div>
                <div className="flex items-center justify-between text-slate-700 font-bold">
                  <span>{isReceiveMode ? 'Tổng số lượng nhập:' : 'Tổng số lượng xuất:'}</span>
                  <span className="font-black text-cyan-950 text-sm">{totalQty}</span>
                </div>
                <div className="flex items-center justify-between pt-2.5 border-t border-cyan-200">
                  <span className="font-black text-cyan-950 text-xs uppercase tracking-wide">TỔNG GIÁ TRỊ:</span>
                  <span className="font-black text-cyan-700 text-lg">{formatMoney(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-slate-200 space-y-2.5">
              {isReadOnly ? (
                <button
                  type="button"
                  onClick={handleBackNavigation}
                  className="w-full py-3 px-4 rounded-xl border-2 border-cyan-600 bg-cyan-600 hover:bg-cyan-700 text-white font-black uppercase tracking-wide shadow-md transition flex items-center justify-center gap-2 text-xs cursor-pointer active:scale-95"
                >
                  <ArrowLeft className="h-4.5 w-4.5" />
                  <span>QUAY LẠI DANH SÁCH (CHỈ XEM)</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveTransfer(isReceiveMode ? 'DELIVERED' : 'APPROVED')}
                    className="w-full py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-black uppercase tracking-wide shadow-md transition flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    <Save className="h-4.5 w-4.5 text-cyan-100" />
                    <span>
                      {activeTab?.id
                        ? (isReceiveMode ? 'Xác nhận nhập kho & Lưu ô kệ' : 'Lưu thay đổi phiếu')
                        : (isReceiveMode ? 'LƯU PHIẾU NHẬP CHUYỂN KHO' : 'LƯU PHIẾU CHUYỂN')}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveTransfer('DRAFT')}
                    className="w-full py-2.5 px-4 rounded-xl border-2 border-cyan-500 bg-white hover:bg-cyan-50 text-cyan-900 font-extrabold shadow-2xs transition flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50"
                  >
                    <Save className="h-4 w-4 text-cyan-600" />
                    <span>Lưu Nháp Phiếu</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleBackNavigation}
                    className="w-full py-2.5 px-4 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition text-xs cursor-pointer"
                  >
                    Quay lại danh sách
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onProductFound={(prod: ScannedProduct) => {
          handleBarcodeScanned(prod);
          setShowScannerModal(false);
        }}
      />

      <QuickAddShipperModal
        isOpen={showQuickAddShipperModal}
        onClose={() => setShowQuickAddShipperModal(false)}
        onSuccess={(newShipper) => {
          updateActiveTab((t) => ({
            ...t,
            driverName: newShipper.name,
            driverPhone: newShipper.phone,
            vehiclePlate: newShipper.vehiclePlate,
          }));
          setToast({ message: `Đã chọn Shipper "${newShipper.name}"`, type: 'success' });
        }}
      />

      <SmartSlottingGridModal
        isOpen={pickBinModalOpen}
        onClose={() => setPickBinModalOpen(false)}
        mode={isReceiveMode ? 'INBOUND' : 'OUTBOUND_TRANSFER'}
        warehouseCode={isReceiveMode ? (activeTab?.destinationWarehouseCode || 'KH002') : (activeTab?.sourceWarehouseCode || 'KH001')}
        items={activeTab?.details || []}
        targetRowId={activePickBinRowId}
        products={products}
        onConfirmAll={(updatedRows) => {
          updateActiveTab((t) => ({
            ...t,
            details: updatedRows,
          }));
          setToast({ message: 'Đã cập nhật vị trí ô kệ cho danh sách hàng!', type: 'success' });
        }}
      />
    </div>
  );

  if (!standalone) {
    return contentMarkup;
  }

  return <MainLayout>{contentMarkup}</MainLayout>;
}
