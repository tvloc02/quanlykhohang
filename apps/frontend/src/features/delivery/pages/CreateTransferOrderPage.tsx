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

export function getProductWarehouseStock(p: ProductOption, whCode?: string): number {
  if (!p) return 0;
  const targetCode = (whCode || '').trim().toLowerCase();

  if (Array.isArray(p.stockBalances) && p.stockBalances.length > 0) {
    if (targetCode) {
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
        if (match.available !== undefined && match.available !== null) {
          return Number(match.available);
        }
        if (match.totalPhysical !== undefined && match.totalPhysical !== null) {
          return Number(match.totalPhysical);
        }
      }
      return 0;
    }
  }

  return Number(p.totalStock ?? p.totalPhysical ?? p.stockQty ?? 0);
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

function createNewTransferTab(
  tabIndex = 1,
  defaultStaffEmail = '',
  defaultSource = 'KH006',
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
    receiveDate: formatISOWithSeconds(nextDay),
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
  const targetEditData = editOrderData || (location.state as any)?.editOrderData;
  const currentUser = getStoredUser();
  const currentStaffEmail = currentUser?.email || '';

  // Master Data
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
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

  useEffect(() => {
    const handleShippersUpdate = () => setShippers(getStoredShippers());
    window.addEventListener('shippers-updated', handleShippersUpdate);
    return () => window.removeEventListener('shippers-updated', handleShippersUpdate);
  }, []);

  // Synchronous Multi-Tab state with Session Storage restoration
  const [tabs, setTabs] = useState<TransferTab[]>(() => {
    if (targetEditData) {
      const editDetails: TransferRowItem[] = (targetEditData.items || []).map((it: any, idx: number) => ({
        rowId: `edit-row-${it.id || idx}`,
        productId: it.id || '',
        productSku: it.productCode || '',
        productName: it.productName || '',
        unit: it.unit || 'Cái',
        sourceWarehouseCode: targetEditData.sourceWarehouse || 'KHO-TONG',
        qty: Number(it.quantity || 0),
        price: Number(it.price || 0),
        totalAmount: Number(it.quantity || 0) * Number(it.price || 0),
        note: '',
      }));

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
          orderDate: targetEditData.scheduledDate
            ? new Date(targetEditData.scheduledDate).toISOString().slice(0, 19)
            : formatISOWithSeconds(),
          dispatchDate: targetEditData.dispatchDate || formatISOWithSeconds(),
          receiveDate: targetEditData.receiveDate || formatISOWithSeconds(new Date(Date.now() + 86400000)),
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

  // Sync draft tabs to sessionStorage (when not in edit mode)
  useEffect(() => {
    if (!editOrderData && tabs && tabs.length > 0) {
      sessionStorage.setItem('transfer_tabs_draft', JSON.stringify(tabs));
      sessionStorage.setItem('transfer_active_tab_id', activeTabId);
    }
  }, [tabs, activeTabId, editOrderData]);

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
          setProducts(filterOutDeletedProducts(Array.isArray(prodData) ? prodData : prodData.data || []));
        }

        if (userRes && userRes.ok) {
          const userData = await userRes.json();
          setUsers(Array.isArray(userData) ? userData : userData.data || []);
        }

        if (whRes && whRes.ok) {
          const whData = await whRes.json();
          const list = Array.isArray(whData) ? whData : whData.data || [];
          setWarehouses(list);
          if (list.length > 0 && !targetEditData) {
            const firstWh = list[0]?.code || list[0]?.id || 'KH002';
            const secondWh = list[1]?.code || list[1]?.id || list[0]?.code || list[0]?.id || 'KH006';
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
    } else {
      navigate('/delivery');
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
  const handleSaveTransfer = async (statusSave: 'DRAFT' | 'APPROVED' | 'IN_TRANSIT') => {
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
      const sourceWh = (activeTab.sourceWarehouseCode || warehouses[0]?.code || warehouses[0]?.id || 'KH006').trim();
      const destWh = (activeTab.destinationWarehouseCode || warehouses[1]?.code || warehouses[1]?.id || 'KH002').trim();

      const payload = {
        transferNo: activeTab.transferNo,
        sourceWarehouse: sourceWh,
        sourceWarehouseCode: sourceWh,
        destinationWarehouse: destWh,
        destinationWarehouseCode: destWh,
        scheduledDate: activeTab.orderDate,
        dispatchDate: activeTab.dispatchDate || activeTab.orderDate,
        receiveDate: activeTab.receiveDate,
        driverName: activeTab.driverName,
        driverPhone: activeTab.driverPhone,
        vehiclePlate: activeTab.vehiclePlate,
        status: statusSave,
        note: activeTab.generalNote || undefined,
        createdBy: activeTab.assignedStaffEmail || currentUser?.fullName || currentUser?.email || 'NPT_Staff',
        items: activeValidItems.map((it) => ({
          id: it.productId || it.rowId,
          productCode: it.productSku || `SKU-${it.productId}`,
          productName: it.productName || 'Sản phẩm điều chuyển',
          unit: it.unit || 'Cái',
          quantity: Number(it.qty),
          price: Number(it.price || 0),
        })),
      };

      if (activeTab.id) {
        await deliveryApi.updateTransferOrder(activeTab.id, payload);
        setToast({ type: 'success', message: `Cập nhật thành công phiếu điều chuyển: ${activeTab.transferNo}` });
      } else {
        await deliveryApi.createTransferOrder(payload);
        setToast({ type: 'success', message: `Tạo mới thành công phiếu điều chuyển: ${activeTab.transferNo}` });
      }

      try {
        sessionStorage.removeItem('transfer_tabs_draft');
        sessionStorage.removeItem('transfer_active_tab_id');
      } catch { }

      setTimeout(() => {
        handleBackNavigation();
      }, 1000);
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Lỗi khi lưu phiếu xuất chuyển kho' });
    } finally {
      setSaving(false);
    }
  };

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

      {/* Top Header Strip with Action Buttons on the Right */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
        {/* Title Pill Badge */}
        <div className="inline-flex items-center gap-2.5 rounded-xl bg-cyan-600 px-4 py-2 text-white shadow-sm">
          <Truck className="h-5 w-5 text-cyan-100" />
          <h1 className="text-base font-black tracking-tight uppercase">TẠO PHIẾU XUẤT CHUYỂN CHI NHÁNH</h1>
        </div>

        {/* Action Buttons at Top Right */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Transfer Order Code Pill */}
          <div className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm">
            <FileText className="h-3.5 w-3.5 text-cyan-100" />
            <span>{activeTab?.transferNo || 'PHIẾU MỚI'}</span>
          </div>

          {/* Barcode Scanner Button */}
          <button
            type="button"
            onClick={() => setShowScannerModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-cyan-500 bg-white hover:bg-cyan-50 px-3.5 py-1.5 text-xs font-bold text-cyan-700 transition shadow-xs cursor-pointer"
          >
            <ScanLine className="h-4 w-4 text-cyan-600" />
            <span>Quét mã vạch</span>
          </button>

          {/* Reset / Clear Form Button */}
          <button
            type="button"
            onClick={handleClearCurrentTab}
            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-amber-500 bg-white hover:bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-700 transition shadow-xs cursor-pointer"
            title="Làm mới form và xóa các dòng đã chọn"
          >
            <RotateCcw className="h-4 w-4 text-amber-600" />
            <span>Làm mới phiếu</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-cyan-500 bg-white hover:bg-cyan-50 px-3.5 py-1.5 text-xs font-bold text-cyan-700 transition shadow-xs cursor-pointer"
            title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span>{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
          </button>

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

      {/* Top Information Control Card (2 Rows Layout - Cyan Theme) */}
      <div className="rounded-2xl border-2 border-cyan-500/30 bg-white p-4 shadow-md space-y-3.5">
        {/* Row 1: Thông tin Lệnh & Kho xuất nhập */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Mã HĐ / Lệnh */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">MÃ PHIẾU / LỆNH</label>
            <input
              type="text"
              value={activeTab?.transferNo || ''}
              onChange={(e) => updateActiveTab((t) => ({ ...t, transferNo: e.target.value }))}
              placeholder="Tạo tự động"
              className="h-10 w-full rounded-xl border-2 border-cyan-200 bg-cyan-50/50 px-3 text-xs font-black text-cyan-900 outline-none focus:border-cyan-500 uppercase"
            />
          </div>

          {/* Kho xuất (Kho nguồn) */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
              <WarehouseIcon className="h-3.5 w-3.5 text-cyan-600" />
              <span>KHO XUẤT HÀNG (KHO NGUỒN)</span>
            </label>
            <select
              value={activeTab?.sourceWarehouseCode || ''}
              onChange={(e) => handleSourceWarehouseChange(e.target.value)}
              className="h-10 w-full rounded-xl border-2 border-cyan-500 bg-cyan-50/50 px-3 text-xs font-bold text-cyan-900 outline-none transition focus:border-cyan-600 cursor-pointer"
            >
              {warehouses.length > 0 ? (
                warehouses.map((wh) => (
                  <option key={wh.id || wh.code} value={wh.code || wh.id}>
                    [{wh.code || wh.id}] {wh.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="KH006">KH006 - Kho Thanh Trì</option>
                  <option value="KH002">KH002 - Kho Chi Nhánh HCM</option>
                  <option value="KH001">KH001 - Kho Hà Đông</option>
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
              value={activeTab?.destinationWarehouseCode || ''}
              onChange={(e) => handleDestinationWarehouseChange(e.target.value)}
              className="h-10 w-full rounded-xl border-2 border-cyan-500 bg-cyan-50/50 px-3 text-xs font-bold text-cyan-900 outline-none transition focus:border-cyan-600 cursor-pointer"
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
                  <option value="KH006">KH006 - Kho Thanh Trì</option>
                  <option value="KH001">KH001 - Kho Hà Đông</option>
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
              value={activeTab?.assignedStaffEmail || ''}
              onChange={(e) => updateActiveTab((t) => ({ ...t, assignedStaffEmail: e.target.value }))}
              className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 cursor-pointer"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-2 border-t border-slate-100">
          {/* Ngày & Giờ Xuất Giao Hàng */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-cyan-600" />
              <span>NGÀY & GIỜ GIAO (XUẤT)</span>
            </label>
            <input
              type="datetime-local"
              step="1"
              value={activeTab?.dispatchDate || activeTab?.orderDate || ''}
              onChange={(e) => updateActiveTab((t) => ({ ...t, dispatchDate: e.target.value, orderDate: e.target.value }))}
              className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none transition focus:border-cyan-500"
            />
          </div>

          {/* Ngày & Giờ Dự Kiến Nhận */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-cyan-600" />
              <span>NGÀY & GIỜ NHẬN (DỰ KIẾN)</span>
            </label>
            <input
              type="datetime-local"
              step="1"
              value={activeTab?.receiveDate || ''}
              onChange={(e) => updateActiveTab((t) => ({ ...t, receiveDate: e.target.value }))}
              className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none transition focus:border-cyan-500"
            />
          </div>

          {/* Tên tài xế vận chuyển / Shipper */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                <Bike className="h-3.5 w-3.5 text-cyan-600" />
                <span>TÀI XẾ / SHIPPER VẬN CHUYỂN</span>
              </label>
              <button
                type="button"
                onClick={() => setShowQuickAddShipperModal(true)}
                className="inline-flex items-center gap-0.5 text-[11px] font-black text-cyan-600 hover:text-cyan-800 hover:underline cursor-pointer"
                title="Thêm nhanh tài xế / Shipper mới"
              >
                <Plus className="h-3 w-3" />
                <span>Thêm</span>
              </button>
            </div>
            <div className="flex gap-1.5">
              <select
                value={activeTab?.driverName || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const matched = shippers.find((s) => s.name === val);
                  if (matched) {
                    updateActiveTab((t) => ({
                      ...t,
                      driverName: matched.name,
                      driverPhone: matched.phone,
                      vehiclePlate: matched.vehiclePlate,
                    }));
                  } else {
                    updateActiveTab((t) => ({ ...t, driverName: val }));
                  }
                }}
                className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-900 outline-none transition focus:border-cyan-500 cursor-pointer"
              >
                <option value="">-- Chọn hoặc nhập tài xế --</option>
                {shippers.map((s) => (
                  <option key={s.id} value={s.name}>
                    [{s.company || 'Nội bộ'}] {s.name} - {s.phone} ({s.vehiclePlate || 'N/A'})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowQuickAddShipperModal(true)}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border-2 border-cyan-500 bg-cyan-600 text-white shadow-sm hover:bg-cyan-700 transition cursor-pointer"
                title="Thêm nhanh tài xế / Shipper mới vào danh sách"
              >
                <Plus className="h-4 w-4" />
              </button>
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
              value={activeTab?.driverPhone || ''}
              onChange={(e) => updateActiveTab((t) => ({ ...t, driverPhone: e.target.value }))}
              placeholder="Nhập số điện thoại tài xế"
              className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none transition focus:border-cyan-500"
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
              value={activeTab?.vehiclePlate || ''}
              onChange={(e) => updateActiveTab((t) => ({ ...t, vehiclePlate: e.target.value }))}
              placeholder="Ví dụ: 30L-636.86"
              className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-black text-slate-900 outline-none transition focus:border-cyan-500 uppercase"
            />
          </div>
        </div>
      </div>

      {/* 2-Column Main Section: Left Table (9 Cols) + Right Summary Panel (3 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT COLUMN: Product Table */}
        <div className="lg:col-span-9 flex flex-col rounded-2xl border-2 border-cyan-200 bg-white shadow-sm overflow-hidden">
          {/* Table Header Strip */}
          <div className="px-4 py-3 border-b border-cyan-200 bg-cyan-50/80 flex items-center justify-between">
            <div className="flex items-center gap-2 text-cyan-950 font-black text-xs uppercase tracking-wide">
              <Truck className="h-4.5 w-4.5 text-cyan-600" />
              <span>THÔNG TIN HÀNG HÓA XUẤT CHUYỂN ({(activeTab?.details || []).length} DÒNG - TỔNG SL: {totalQty})</span>
            </div>
            <button
              type="button"
              onClick={handleAddBlankRow}
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 px-3.5 py-1.5 text-xs font-black text-white shadow-sm transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm dòng mới</span>
            </button>
          </div>

          {/* Grid Product Table (Rộng rãi, xóa cột SKU & Kho xuất) */}
          <div className={`overflow-x-auto overflow-y-auto custom-scrollbar flex-1 min-h-0 ${isFullscreen ? '' : 'max-h-[calc(100vh-340px)]'}`}>
            <table className="w-full text-left border-collapse text-xs min-w-[800px]">
              <thead className="bg-slate-100 text-slate-800 font-black border-b border-cyan-200 uppercase text-[11px] sticky top-0 z-10">
                <tr>
                  <th className="p-3 w-12 text-center border-r border-slate-200 bg-slate-100">STT</th>
                  <th className="p-3 min-w-[280px] text-center border-r border-slate-200 bg-slate-100">TÊN HÀNG HÓA</th>
                  <th className="p-3 min-w-[150px] text-center border-r border-slate-200 bg-slate-100">KỆ LẤY HÀNG</th>
                  <th className="p-3 w-24 text-center border-r border-slate-200 bg-slate-100">ĐVT</th>
                  <th className="p-3 w-28 text-center border-r border-slate-200 bg-slate-100">SL XUẤT</th>
                  <th className="p-3 w-32 text-center border-r border-slate-200 bg-slate-100">ĐƠN GIÁ (đ)</th>
                  <th className="p-3 w-36 text-center border-r border-slate-200 bg-slate-100">THÀNH TIỀN</th>
                  <th className="p-3 min-w-[180px] text-center border-r border-slate-200 bg-slate-100">GHI CHÚ</th>
                  <th className="p-3 w-20 text-center bg-slate-100">TT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {activeTab?.details.map((row, idx) => {
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
                          value={row.productName ? `${row.productSku ? row.productSku + ' - ' : ''}${row.productName}` : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateRow(row.rowId, { productName: val });
                            setActiveProductDropdownRowId(row.rowId);
                          }}
                          onFocus={() => setActiveProductDropdownRowId(row.rowId)}
                          onClick={() => setActiveProductDropdownRowId(row.rowId)}
                          placeholder="Chọn hoặc nhập tên hàng hóa..."
                          className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-bold text-slate-900 outline-none focus:border-cyan-600 text-xs cursor-text"
                        />

                        {/* Interactive Table Dropdown */}
                        {activeProductDropdownRowId === row.rowId && (
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
                                      <span className="w-1/3 text-right text-cyan-900 font-black font-mono">
                                        {stockInSource.toLocaleString('vi-VN')} {p.unit || 'Cái'}
                                      </span>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* KỆ LẤY HÀNG */}
                      <td className="p-1.5 border-r border-slate-200 text-center">
                        {row.assignedBins && row.assignedBins.length > 0 ? (
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

                      {/* ĐVT */}
                      <td className="p-1.5 text-center border-r border-slate-200">
                        <input
                          type="text"
                          value={row.unit}
                          onChange={(e) => updateRow(row.rowId, { unit: e.target.value })}
                          className="w-full h-9 text-center rounded-lg border border-slate-300 bg-white font-medium text-slate-800 outline-none focus:border-cyan-600"
                        />
                      </td>

                      {/* SỐ LƯỢNG XUẤT */}
                      <td className="p-1.5 border-r border-slate-200">
                        <input
                          type="number"
                          min="0"
                          value={row.qty || ''}
                          onChange={(e) => updateRow(row.rowId, { qty: Number(e.target.value) })}
                          className="w-full h-9 px-2 text-right rounded-lg border border-slate-300 bg-white font-bold text-slate-900 outline-none focus:border-cyan-600"
                        />
                      </td>

                      {/* ĐƠN GIÁ (đ) */}
                      <td className="p-1.5 border-r border-slate-200">
                        <input
                          type="number"
                          min="0"
                          value={row.price || ''}
                          onChange={(e) => updateRow(row.rowId, { price: Number(e.target.value) })}
                          className="w-full h-9 px-2 text-right rounded-lg border border-slate-300 bg-white font-medium text-slate-800 outline-none focus:border-cyan-600"
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
                          value={row.note}
                          onChange={(e) => updateRow(row.rowId, { note: e.target.value })}
                          placeholder="Ghi chú dòng..."
                          className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white font-normal text-slate-700 outline-none focus:border-cyan-600"
                        />
                      </td>

                      {/* TT (Actions) */}
                      <td className="p-2 text-center">
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

        {/* RIGHT COLUMN (3/12 width): SUMMARY CARD & ACTIONS */}
        <div className="lg:col-span-3 rounded-2xl border-2 border-cyan-200 bg-white p-4 shadow-sm space-y-4 flex flex-col justify-between h-full">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-cyan-200 pb-2.5 text-cyan-950 font-black text-xs uppercase tracking-wide">
              <Package className="h-4.5 w-4.5 text-cyan-600" />
              <span>THÔNG TIN ĐIỀU CHUYỂN NỘI BỘ</span>
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
                value={activeTab?.generalNote || ''}
                onChange={(e) => updateActiveTab((t) => ({ ...t, generalNote: e.target.value }))}
                placeholder="Nhập lý do điều chuyển nội bộ (VD: Điều chuyển cân bằng tồn kho)..."
                className="w-full p-3 rounded-xl border-2 border-slate-200 bg-white font-medium text-slate-700 outline-none focus:border-cyan-600 resize-none text-xs"
              />
            </div>

            {/* Highlight Total Card - Cyan & White Theme */}
            <div className="bg-cyan-50 border-2 border-cyan-300 rounded-2xl p-4 shadow-sm space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-slate-700 font-bold">
                <span>Số mặt hàng xuất:</span>
                <span className="font-black text-cyan-950 text-sm">{activeValidItems.length}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700 font-bold">
                <span>Tổng số lượng xuất:</span>
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
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveTransfer('APPROVED')}
              className="w-full py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-black uppercase tracking-wide shadow-md transition flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <Save className="h-4.5 w-4.5 text-cyan-100" />
              <span>{activeTab?.id ? 'Lưu thay đổi phiếu' : 'Lưu Phiếu Chuyển'}</span>
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
        mode="OUTBOUND_TRANSFER"
        warehouseCode={activeTab?.sourceWarehouseCode || 'KHO-TONG'}
        items={activeTab?.details || []}
        targetRowId={activePickBinRowId}
        products={products}
        onConfirmAll={(updatedRows) => {
          updateActiveTab((t) => ({
            ...t,
            details: updatedRows,
          }));
          setToast({ message: 'Đã cập nhật vị trí ô kệ cho danh sách hàng xuất chuyển!', type: 'success' });
        }}
      />
    </div>
  );

  if (!standalone) {
    return contentMarkup;
  }

  return <MainLayout>{contentMarkup}</MainLayout>;
}
