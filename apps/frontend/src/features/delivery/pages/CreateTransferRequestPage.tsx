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
  ArrowRight,
  Warehouse as WarehouseIcon,
  User,
  FileText,
  ScanLine,
  Maximize2,
  Minimize2,
  Repeat,
  RotateCcw,
  Clock,
  Phone,
  Car,
  Calendar,
  Bike,
} from 'lucide-react';
import BarcodeScanner, { type ScannedProduct } from '../../../shared/components/BarcodeScanner';
import { filterOutDeletedProducts } from '../../../shared/utils/productUtils';
import MainLayout from '../../../shared/components/MainLayout';
import { getStoredShippers, type Shipper } from '../services/shipperService';
import QuickAddShipperModal from '../components/QuickAddShipperModal';
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

export interface TransferRequestRowItem {
  rowId: string;
  productId: string;
  productSku: string;
  productName: string;
  unit: string;
  destinationWarehouseCode: string;
  qty: number;
  price: number;
  totalAmount: number;
  note: string;
}

function formatISOWithSeconds(d = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export interface TransferRequestTab {
  tabId: string;
  title: string;
  id?: string;
  requestNo: string;
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
  details: TransferRequestRowItem[];
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

  if (!targetCode) {
    return Number(p.totalStock ?? p.totalPhysical ?? p.stockQty ?? (p as any).quantity ?? (p as any).stock ?? 0);
  }

  return 0;
}

function generateRequestCode() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `PNCN-${dateStr}-${randomSuffix}`;
}

function makeEmptyRow(index: number, defaultDestWh = 'KHO-CN-HCM'): TransferRequestRowItem {
  return {
    rowId: `row-${Date.now()}-${index}-${Math.random()}`,
    productId: '',
    productSku: '',
    productName: '',
    unit: 'Cái',
    destinationWarehouseCode: defaultDestWh,
    qty: 0,
    price: 0,
    totalAmount: 0,
    note: '',
  };
}

function makeInitialRows(count = DEFAULT_ROWS_COUNT, defaultDestWh = 'KHO-CN-HCM'): TransferRequestRowItem[] {
  return Array.from({ length: count }, (_, i) => makeEmptyRow(i, defaultDestWh));
}

function createNewTransferRequestTab(
  tabIndex = 1,
  defaultStaffEmail = '',
  defaultSource = 'KHO-TONG',
  defaultDest = 'KHO-CN-HCM'
): TransferRequestTab {
  const now = new Date();
  const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  return {
    tabId: `tab-${Date.now()}-${tabIndex}`,
    title: `# ${tabIndex}`,
    requestNo: generateRequestCode(),
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
    status: 'PENDING',
    details: makeInitialRows(DEFAULT_ROWS_COUNT, defaultDest),
  };
}

export interface CreateTransferRequestPageProps {
  onBack?: () => void;
  standalone?: boolean;
  editRequestData?: any;
  onSuccess?: () => void;
}

export default function CreateTransferRequestPage({
  onBack,
  standalone = true,
  editRequestData,
  onSuccess,
}: CreateTransferRequestPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const targetEditData = editRequestData || (location.state as any)?.editRequestData;
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

  useEffect(() => {
    const handleShippersUpdate = () => setShippers(getStoredShippers());
    window.addEventListener('shippers-updated', handleShippersUpdate);
    return () => window.removeEventListener('shippers-updated', handleShippersUpdate);
  }, []);

  // Synchronous Multi-Tab state with Session Storage restoration
  const [tabs, setTabs] = useState<TransferRequestTab[]>(() => {
    if (targetEditData) {
      const editDetails: TransferRequestRowItem[] = (targetEditData.items || []).map((it: any, idx: number) => ({
        rowId: `edit-row-${it.id || idx}`,
        productId: it.id || '',
        productSku: it.productCode || '',
        productName: it.productName || '',
        unit: it.unit || 'Cái',
        destinationWarehouseCode: targetEditData.destinationWarehouse || 'KHO-CN-HCM',
        qty: Number(it.quantity || 0),
        price: Number(it.price || 0),
        totalAmount: Number(it.quantity || 0) * Number(it.price || 0),
        note: '',
      }));

      // Fill up to DEFAULT_ROWS_COUNT rows
      const padCount = Math.max(0, DEFAULT_ROWS_COUNT - editDetails.length);
      const paddedRows = [...editDetails, ...makeInitialRows(padCount, targetEditData.destinationWarehouse || 'KHO-CN-HCM')];

      return [
        {
          tabId: `edit-tab-${targetEditData.id}`,
          title: targetEditData.requestNumber || targetEditData.requestNo || 'Sửa phiếu',
          id: targetEditData.id,
          requestNo: targetEditData.requestNumber || targetEditData.requestNo || generateRequestCode(),
          sourceWarehouseCode: targetEditData.sourceWarehouse || 'KHO-TONG',
          destinationWarehouseCode: targetEditData.destinationWarehouse || 'KHO-CN-HCM',
          assignedStaffEmail: targetEditData.createdBy || currentStaffEmail,
          orderDate: targetEditData.createdDate || targetEditData.scheduledDate
            ? new Date(targetEditData.createdDate || targetEditData.scheduledDate).toISOString().slice(0, 19)
            : formatISOWithSeconds(),
          dispatchDate: targetEditData.dispatchDate || formatISOWithSeconds(),
          receiveDate: targetEditData.receiveDate || formatISOWithSeconds(new Date(Date.now() + 86400000)),
          driverName: targetEditData.driverName || '',
          driverPhone: targetEditData.driverPhone || '',
          vehiclePlate: targetEditData.vehiclePlate || '',
          generalNote: targetEditData.description || targetEditData.note || '',
          status: targetEditData.status || 'PENDING',
          details: paddedRows,
        },
      ];
    }

    try {
      sessionStorage.removeItem('transfer_request_tabs_draft');
      sessionStorage.removeItem('transfer_request_active_tab_id');
    } catch {}
    return [createNewTransferRequestTab(1, currentStaffEmail)];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    try {
      const savedActiveId = sessionStorage.getItem('transfer_request_active_tab_id');
      if (savedActiveId && tabs.some((t) => t.tabId === savedActiveId)) {
        return savedActiveId;
      }
    } catch {}
    return tabs && tabs[0] ? tabs[0].tabId : '';
  });

  const activeTab = useMemo(() => {
    return tabs.find((t) => t.tabId === activeTabId) || tabs[0];
  }, [tabs, activeTabId]);

  const handleAddNewTab = useCallback(() => {
    const newTabIndex = tabs.length + 1;
    const newTab = createNewTransferRequestTab(newTabIndex, currentStaffEmail);
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.tabId);
    setToast({ message: `Đã mở tab tạo phiếu nhập chuyển kho mới (#${newTabIndex})`, type: 'success' });
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

  // Sync draft tabs to sessionStorage (when not editing)
  useEffect(() => {
    if (!targetEditData && tabs && tabs.length > 0) {
      sessionStorage.setItem('transfer_request_tabs_draft', JSON.stringify(tabs));
      sessionStorage.setItem('transfer_request_active_tab_id', activeTabId);
    }
  }, [tabs, activeTabId, targetEditData]);

  // Toast auto-hide
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Click outside listener for product dropdown
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
          const rawList = Array.isArray(whData) ? whData : whData.data || [];
          const list = mergeStoredWarehouses(rawList, getStoredWarehouses());
          setWarehouses(list);
          if (list.length >= 2 && !targetEditData) {
            setTabs((prev) =>
              prev.map((tab) => ({
                ...tab,
                sourceWarehouseCode: tab.sourceWarehouseCode || list[0].code || 'KHO-TONG',
                destinationWarehouseCode: tab.destinationWarehouseCode || list[1].code || 'KHO-CN-HCM',
              }))
            );
          }
        }
      } catch (err) {
        console.error('Lỗi khi tải master data phiếu nhập chuyển kho:', err);
      }
    }
    loadMasterData();
  }, [targetEditData]);

  // Active Tab Helpers
  const updateActiveTab = useCallback(
    (updater: (prev: TransferRequestTab) => TransferRequestTab) => {
      setTabs((prev) => prev.map((t) => (t.tabId === activeTabId ? updater(t) : t)));
    },
    [activeTabId]
  );

  const handleDestinationWarehouseChange = (newDestCode: string) => {
    updateActiveTab((t) => ({
      ...t,
      destinationWarehouseCode: newDestCode,
      details: t.details.map((d) => ({ ...d, destinationWarehouseCode: newDestCode })),
    }));
  };

  const handleSourceWarehouseChange = (newSourceCode: string) => {
    updateActiveTab((t) => ({
      ...t,
      sourceWarehouseCode: newSourceCode,
    }));
  };

  // Row update helpers
  const updateRow = (rowId: string, patch: Partial<TransferRequestRowItem>) => {
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
      details: [...t.details, makeEmptyRow(t.details.length, t.destinationWarehouseCode)],
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
      const duplicated: TransferRequestRowItem = {
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
    const priceVal = (scanned as any).purchasePrice || (scanned as any).salePrice || (scanned as any).price || 0;

    const matchedProduct = products.find(
      (p) => (barcodeVal && p.internalSku?.toLowerCase() === barcodeVal.toLowerCase()) || p.name?.toLowerCase() === scanned.name?.toLowerCase()
    );

    const productIdToUse = matchedProduct ? matchedProduct.id : scanned.id;
    const skuToUse = matchedProduct ? matchedProduct.internalSku : (barcodeVal || scanned.internalSku);
    const nameToUse = scanned.name;
    const priceToUse = priceVal || matchedProduct?.purchasePrice || matchedProduct?.salePrice || 0;
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
        const newRow: TransferRequestRowItem = {
          rowId: `row-${Date.now()}-${Math.random()}`,
          productId: productIdToUse,
          productSku: skuToUse,
          productName: nameToUse,
          unit: unitToUse,
          destinationWarehouseCode: activeTab.destinationWarehouseCode,
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

  const totalQty = useMemo(() => {
    return activeValidItems.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  }, [activeValidItems]);

  const grandTotal = useMemo(() => {
    return activeValidItems.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
  }, [activeValidItems]);

  // Back action navigation
  const handleBackNavigation = () => {
    try {
      sessionStorage.removeItem('transfer_request_tabs_draft');
      sessionStorage.removeItem('transfer_request_active_tab_id');
    } catch {}
    if (onBack) {
      onBack();
    } else {
      navigate('/delivery/transfer-requests');
    }
  };

  // Clear / Reset Current Tab Rows
  const handleClearCurrentTab = () => {
    if (!activeTab) return;
    updateActiveTab((t) => ({
      ...t,
      details: makeInitialRows(DEFAULT_ROWS_COUNT, t.destinationWarehouseCode),
    }));
    try {
      sessionStorage.removeItem('transfer_request_tabs_draft');
      sessionStorage.removeItem('transfer_request_active_tab_id');
    } catch {}
    setToast({ message: 'Đã xóa toàn bộ sản phẩm và làm mới phiếu!', type: 'success' });
  };

  // Save Transfer Request Handler
  const handleSaveTransferRequest = async (statusSave: 'DRAFT' | 'PENDING' | 'APPROVED') => {
    if (!activeTab) return;

    if (activeValidItems.length === 0) {
      setToast({ type: 'error', message: 'Vui lòng chọn ít nhất 1 sản phẩm với số lượng > 0' });
      return;
    }

    if (!activeTab.sourceWarehouseCode || !activeTab.destinationWarehouseCode) {
      setToast({ type: 'error', message: 'Vui lòng chọn đầy đủ Kho nguồn và Kho đích' });
      return;
    }

    if (activeTab.sourceWarehouseCode === activeTab.destinationWarehouseCode) {
      setToast({ type: 'error', message: 'Kho nguồn và Kho đích không được trùng nhau' });
      return;
    }

    setSaving(true);
    try {
      const storedUser = getStoredUser();
      const newRequest = {
        id: activeTab.id || `trq-${Date.now()}`,
        requestNumber: activeTab.requestNo,
        createdDate: activeTab.orderDate || new Date().toISOString(),
        status: statusSave,
        description: activeTab.generalNote || `Yêu cầu nhập chuyển kho từ ${activeTab.sourceWarehouseCode} sang ${activeTab.destinationWarehouseCode}`,
        createdBy: activeTab.assignedStaffEmail || storedUser.fullName || storedUser.email || 'Nhân viên kho',
        sourceWarehouse: activeTab.sourceWarehouseCode,
        destinationWarehouse: activeTab.destinationWarehouseCode,
        items: activeValidItems.map((it) => ({
          id: it.productId || it.rowId,
          productCode: it.productSku || `SKU-${it.productId}`,
          productName: it.productName || 'Sản phẩm điều chuyển',
          unit: it.unit || 'Cái',
          quantity: Number(it.qty),
          price: Number(it.price || 0),
          sourceWarehouse: activeTab.sourceWarehouseCode,
          destinationWarehouse: activeTab.destinationWarehouseCode,
        })),
      };

      const existingRaw = localStorage.getItem('wms_transfer_requests');
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      let updated: any[];

      if (activeTab.id) {
        updated = existing.map((r: any) => (r.id === activeTab.id ? newRequest : r));
      } else {
        updated = [newRequest, ...existing];
      }

      localStorage.setItem('wms_transfer_requests', JSON.stringify(updated));

      try {
        sessionStorage.removeItem('transfer_request_tabs_draft');
        sessionStorage.removeItem('transfer_request_active_tab_id');
      } catch {}

      setToast({
        type: 'success',
        message: statusSave === 'DRAFT' ? `Đã lưu nháp phiếu nhập chuyển kho: ${activeTab.requestNo}` : `Đã tạo thành công phiếu nhập chuyển kho: ${activeTab.requestNo}`,
      });

      if (onSuccess) onSuccess();

      setTimeout(() => {
        handleBackNavigation();
      }, 1000);
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Lỗi khi lưu phiếu nhập chuyển kho' });
    } finally {
      setSaving(false);
    }
  };

  const contentMarkup = (
    <div
      className={`animate-[fadeIn_0.2s_ease-out] ${
        isFullscreen
          ? 'fixed inset-0 z-[9999] bg-slate-100 p-2.5 sm:p-3 flex flex-col h-screen overflow-hidden'
          : 'space-y-3 pb-20'
      }`}
    >
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
      {showScannerModal && (
        <BarcodeScanner
          isOpen={showScannerModal}
          onProductFound={handleBarcodeScanned}
          onClose={() => setShowScannerModal(false)}
          title="Quét Mã Barcode Hàng Hóa Nhập Chuyển Kho"
        />
      )}

      {/* ═══ 1. TOP HEADER BAR: Page Title & Back Button (Hidden in Fullscreen) ═══ */}
      {!isFullscreen && (
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2.5 rounded-xl bg-cyan-600 px-4 py-2 text-white shadow-sm">
            <Repeat className="h-5 w-5 text-cyan-100" />
            <h1 className="text-base font-black tracking-tight uppercase">
              {activeTab?.id ? 'CHỈNH SỬA PHIẾU NHẬP CHUYỂN KHO NỘI BỘ' : 'TẠO PHIẾU NHẬP CHUYỂN KHO NỘI BỘ (LẬP YÊU CẦU / PHIẾU NHẬP)'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearCurrentTab}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-amber-500 bg-white px-3.5 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50 transition shadow-xs cursor-pointer"
              title="Làm mới form và xóa các dòng đã chọn"
            >
              <RotateCcw className="h-4 w-4 text-amber-600" />
              <span>Làm mới phiếu</span>
            </button>
            <button
              type="button"
              onClick={handleBackNavigation}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-cyan-500 bg-white px-4 py-2 text-xs font-bold text-cyan-700 hover:bg-cyan-50 transition shadow-xs cursor-pointer"
            >
              <ArrowLeft size={16} />
              <span>Quay lại</span>
            </button>
          </div>
        </div>
      )}

      {/* ═══ MULTI-TAB SWITCHER BAR ═══ */}
      <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 flex-shrink-0">
        {tabs.map((tab, idx) => {
          const isActive = tab.tabId === activeTabId;
          const validItemsCount = tab.details.filter((d) => (d.productName || d.productSku) && d.qty > 0).length;
          return (
            <div
              key={tab.tabId}
              onClick={() => setActiveTabId(tab.tabId)}
              className={`group inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer border shadow-xs select-none ${
                isActive
                  ? 'bg-cyan-600 text-white border-cyan-600 shadow-md ring-2 ring-cyan-200'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-cyan-50 hover:border-cyan-300 hover:text-cyan-800'
              }`}
            >
              <FileText className={`h-3.5 w-3.5 ${isActive ? 'text-cyan-100' : 'text-cyan-600'}`} />
              <span className="max-w-[150px] truncate">
                {tab.requestNo ? tab.requestNo : `Phiếu #${idx + 1}`}
              </span>
              {validItemsCount > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                    isActive ? 'bg-white text-cyan-800' : 'bg-cyan-100 text-cyan-800'
                  }`}
                >
                  {validItemsCount} SP
                </span>
              )}
              {tabs.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => handleCloseTab(tab.tabId, e)}
                  className={`rounded p-0.5 transition ${
                    isActive
                      ? 'hover:bg-cyan-700 text-cyan-200 hover:text-white'
                      : 'hover:bg-slate-200 text-slate-400 hover:text-red-500'
                  }`}
                  title="Đóng phiếu này"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          );
        })}

        {/* Add New Tab Button */}
        {!targetEditData && (
          <button
            type="button"
            onClick={handleAddNewTab}
            className="inline-flex items-center gap-1 rounded-xl border-2 border-dashed border-cyan-400 bg-cyan-50/60 px-3 py-1.5 text-xs font-bold text-cyan-700 hover:bg-cyan-100 hover:border-cyan-600 transition cursor-pointer"
            title="Tạo thêm phiếu nhập chuyển kho mới (Tab tiếp theo)"
          >
            <Plus size={14} className="text-cyan-700" />
            <span>+ Thêm phiếu mới</span>
          </button>
        )}
      </div>

      {/* ═══ 2. MAIN 2-COLUMN LAYOUT (Left 9 Cols, Right 3 Cols) ═══ */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch ${isFullscreen ? 'flex-1 min-h-0' : 'items-start'}`}>
        {/* ── LEFT COLUMN (9/12 width): METADATA + PRODUCT TABLE STACKED VERTICALLY ── */}
        <div className={`lg:col-span-9 flex flex-col space-y-2.5 min-h-0 ${isFullscreen ? 'h-full' : ''}`}>
          {/* ═══ FORM METADATA CONTROL BAR (2 Rows Layout) ═══ */}
          <div className="rounded-xl border-2 border-slate-200 bg-white p-3.5 shadow-sm flex-shrink-0 space-y-3">
            {/* Row 1: Thông tin Mã phiếu & Kho xuất nhập */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Mã phiếu / Số yêu cầu */}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Mã phiếu / Số yêu cầu</label>
                <input
                  type="text"
                  value={activeTab?.requestNo || ''}
                  onChange={(e) => updateActiveTab((t) => ({ ...t, requestNo: e.target.value }))}
                  placeholder="TẠO TỰ ĐỘNG (YCNC...)"
                  className="h-9 w-full rounded-lg border-2 border-slate-200 bg-slate-50 px-3 text-xs font-bold text-cyan-800 uppercase outline-none focus:border-cyan-600"
                />
              </div>

              {/* Kho xuất hàng (Kho nguồn nội bộ) */}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
                  <WarehouseIcon className="h-3.5 w-3.5 text-cyan-600" />
                  <span>Kho xuất (Kho nguồn)</span>
                </label>
                <select
                  value={activeTab?.sourceWarehouseCode || 'KHO-TONG'}
                  onChange={(e) => handleSourceWarehouseChange(e.target.value)}
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
                      <option value="KHO-TONG">KHO-TONG - Kho Tổng Hà Nội</option>
                      <option value="KH001">KH001 - Kho Hàng Hóa HCM</option>
                      <option value="KHO-NVL">KHO-NVL - Kho nguyên vật liệu</option>
                    </>
                  )}
                </select>
              </div>

              {/* Kho nhập hàng (Kho đích) */}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
                  <ArrowRight className="h-3.5 w-3.5 text-cyan-600" />
                  <span>Kho nhập (Kho đích)</span>
                </label>
                <select
                  value={activeTab?.destinationWarehouseCode || 'KHO-CN-HCM'}
                  onChange={(e) => handleDestinationWarehouseChange(e.target.value)}
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
                      <option value="KHO-CN-HCM">KHO-CN-HCM - Kho Hàng TP.HCM</option>
                      <option value="KHO-CN-DN">KHO-CN-DN - Kho Hàng Đà Nẵng</option>
                      <option value="KH006">KH006 - Kho NVL Tổng hợp</option>
                    </>
                  )}
                </select>
              </div>

              {/* Nhân viên / Người yêu cầu */}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-cyan-600" />
                  <span>Nhân viên phụ trách</span>
                </label>
                <select
                  value={activeTab?.assignedStaffEmail || currentStaffEmail}
                  onChange={(e) => updateActiveTab((t) => ({ ...t, assignedStaffEmail: e.target.value }))}
                  className="h-9 w-full rounded-lg border-2 border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-cyan-600 cursor-pointer"
                >
                  <option value={currentStaffEmail}>{currentUser?.fullName || currentUser?.email || 'Quản Trị Viên Hệ Thống'}</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.email}>
                      {u.fullName || u.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Thời gian xuất/nhận (Giờ phút giây) + Thông tin tài xế & phương tiện */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 pt-2 border-t border-slate-100">
              {/* Ngày & Giờ Xuất Giao Hàng */}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-cyan-600" />
                  <span>Ngày & giờ giao (Xuất)</span>
                </label>
                <input
                  type="datetime-local"
                  step="1"
                  value={activeTab?.dispatchDate || activeTab?.orderDate || ''}
                  onChange={(e) => updateActiveTab((t) => ({ ...t, dispatchDate: e.target.value, orderDate: e.target.value }))}
                  className="h-9 w-full rounded-lg border-2 border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-cyan-600"
                />
              </div>

              {/* Ngày & Giờ Dự Kiến Nhận */}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-cyan-600" />
                  <span>Ngày & giờ nhận (Dự kiến)</span>
                </label>
                <input
                  type="datetime-local"
                  step="1"
                  value={activeTab?.receiveDate || ''}
                  onChange={(e) => updateActiveTab((t) => ({ ...t, receiveDate: e.target.value }))}
                  className="h-9 w-full rounded-lg border-2 border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-cyan-600"
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
                    className="h-9 w-full rounded-lg border-2 border-slate-200 bg-white px-2 text-xs font-bold text-slate-900 outline-none focus:border-cyan-600 cursor-pointer"
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
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border-2 border-cyan-500 bg-cyan-600 text-white shadow-sm hover:bg-cyan-700 transition cursor-pointer"
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
                  <span>SĐT tài xế liên hệ</span>
                </label>
                <input
                  type="tel"
                  value={activeTab?.driverPhone || ''}
                  onChange={(e) => updateActiveTab((t) => ({ ...t, driverPhone: e.target.value }))}
                  placeholder="Nhập SĐT tài xế"
                  className="h-9 w-full rounded-lg border-2 border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-cyan-600"
                />
              </div>

              {/* Biển số xe / Phương tiện */}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Car className="h-3.5 w-3.5 text-cyan-600" />
                  <span>Biển số xe / Phương tiện</span>
                </label>
                <input
                  type="text"
                  value={activeTab?.vehiclePlate || ''}
                  onChange={(e) => updateActiveTab((t) => ({ ...t, vehiclePlate: e.target.value }))}
                  placeholder="VD: 30L-636.86"
                  className="h-9 w-full rounded-lg border-2 border-slate-200 bg-white px-3 text-xs font-black text-slate-900 outline-none focus:border-cyan-600 uppercase"
                />
              </div>
            </div>
          </div>

          {/* ═══ PRODUCT SELECTION TABLE CARD ═══ */}
          <div className={`flex flex-col rounded-xl border-2 border-slate-200 bg-white shadow-sm overflow-hidden min-h-0 ${isFullscreen ? 'flex-1 h-full' : ''}`}>
            {/* Table Header Controls */}
            <div className="px-3 py-2 border-b-2 border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2 text-cyan-800 font-extrabold text-xs">
                <Package className="h-4 w-4 text-cyan-600" />
                <span>
                  THÔNG TIN HÀNG HÓA NHẬP CHUYỂN ({activeValidItems.length} MẶT HÀNG - TỔNG SL: {totalQty})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowScannerModal(true)}
                  className="inline-flex items-center gap-1 rounded-lg border-2 border-cyan-600 bg-white px-3 py-1 text-xs font-bold text-cyan-700 hover:bg-cyan-50 transition cursor-pointer"
                >
                  <ScanLine className="h-3.5 w-3.5 text-cyan-600" />
                  <span>Quét Barcode</span>
                </button>

                <button
                  type="button"
                  onClick={handleAddBlankRow}
                  className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-3.5 py-1 text-xs font-extrabold text-white shadow-sm hover:bg-cyan-700 transition cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Thêm dòng mới</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="inline-flex items-center gap-1 rounded-lg border-2 border-cyan-500 bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-800 hover:bg-cyan-100 transition cursor-pointer shadow-xs"
                  title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Phóng to toàn màn hình'}
                >
                  {isFullscreen ? <Minimize2 className="h-3.5 w-3.5 text-cyan-700" /> : <Maximize2 className="h-3.5 w-3.5 text-cyan-700" />}
                  <span>{isFullscreen ? 'Thu nhỏ' : 'Phóng to'}</span>
                </button>
              </div>
            </div>

            {/* Grid Product Table */}
            <div className={`overflow-x-auto overflow-y-auto custom-scrollbar flex-1 min-h-0 ${isFullscreen ? '' : 'max-h-[calc(100vh-340px)]'}`}>
              <table className="w-full text-left border-collapse text-xs min-w-[950px]">
                <thead className="bg-slate-100 text-slate-800 font-extrabold border-b-2 border-slate-200 uppercase text-xs sticky top-0 z-10">
                  <tr>
                    <th className="p-2 w-10 text-center border-r border-slate-200 bg-slate-100">STT</th>
                    <th className="p-2 w-28 text-center border-r border-slate-200 bg-slate-100">MÃ SKU</th>
                    <th className="p-2 min-w-[200px] text-center border-r border-slate-200 bg-slate-100">TÊN HÀNG HÓA</th>
                    <th className="p-2 w-16 text-center border-r border-slate-200 bg-slate-100">ĐVT</th>
                    <th className="p-2 w-28 text-center border-r border-slate-200 bg-slate-100">KHO NHẬP</th>
                    <th className="p-2 w-20 text-center border-r border-slate-200 bg-slate-100">SL NHẬP</th>
                    <th className="p-2 w-28 text-center border-r border-slate-200 bg-slate-100">ĐƠN GIÁ (đ)</th>
                    <th className="p-2 w-32 text-center border-r border-slate-200 bg-slate-100">THÀNH TIỀN</th>
                    <th className="p-2 min-w-[120px] text-center border-r border-slate-200 bg-slate-100">GHI CHÚ</th>
                    <th className="p-2 w-20 text-center bg-slate-100">TT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeTab?.details.map((row, idx) => {
                    const isEven = idx % 2 === 1;
                    return (
                      <tr
                        key={row.rowId}
                        className={`${isEven ? 'bg-[#eafaf1]' : 'bg-white'} hover:bg-cyan-50/50 transition-colors`}
                      >
                        {/* STT */}
                        <td className="p-1.5 text-center font-bold text-slate-500 border-r border-slate-200">
                          {idx + 1}.
                        </td>

                        {/* MÃ SKU */}
                        <td className="p-1 text-center font-bold text-cyan-800 border-r border-slate-200 bg-slate-50/50">
                          <input
                            type="text"
                            readOnly
                            value={row.productSku || ''}
                            placeholder="Mã SKU"
                            className="w-full h-8 px-1 text-center bg-transparent font-bold text-cyan-800 outline-none text-xs"
                          />
                        </td>

                        {/* TÊN HÀNG HÓA - Searchable Interactive Inline Dropdown */}
                        <td className="p-1 border-r border-slate-200 relative product-table-dropdown">
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
                            placeholder="Chọn hoặc nhập hàng..."
                            className="w-full h-8 px-2 rounded border border-slate-300 bg-white font-medium text-slate-800 outline-none focus:border-cyan-500 text-xs cursor-text"
                          />

                          {/* Interactive Table Dropdown for this row */}
                          {activeProductDropdownRowId === row.rowId && (
                            <div className="absolute left-0 top-full z-[100] mt-1 w-[420px] max-h-60 overflow-y-auto rounded-xl border border-slate-300 bg-white shadow-2xl flex flex-col">
                              <div className="flex bg-slate-100 border-b border-slate-300 px-3 py-2 text-[11px] font-bold text-slate-600 sticky top-0 z-10">
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

                        {/* ĐVT */}
                        <td className="p-1 text-center border-r border-slate-200">
                          <input
                            type="text"
                            value={row.unit}
                            onChange={(e) => updateRow(row.rowId, { unit: e.target.value })}
                            className="w-full h-8 text-center rounded border border-slate-300 bg-white font-medium text-slate-800 outline-none focus:border-cyan-500"
                          />
                        </td>

                        {/* KHO NHẬP */}
                        <td className="p-1 border-r border-slate-200">
                          <select
                            value={row.destinationWarehouseCode || activeTab.destinationWarehouseCode}
                            onChange={(e) => updateRow(row.rowId, { destinationWarehouseCode: e.target.value })}
                            className="w-full h-8 px-1 rounded border border-slate-300 bg-white font-semibold text-slate-800 text-xs outline-none focus:border-cyan-500"
                          >
                            {warehouses.length > 0 ? (
                              warehouses.map((wh) => (
                                <option key={wh.id || wh.code} value={wh.code}>
                                  {wh.code}
                                </option>
                              ))
                            ) : (
                              <>
                                <option value="KHO-CN-HCM">KHO-CN-HCM</option>
                                <option value="KHO-CN-DN">KHO-CN-DN</option>
                                <option value="KH006">KH006</option>
                              </>
                            )}
                          </select>
                        </td>

                        {/* SỐ LƯỢNG NHẬP */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="number"
                            min="0"
                            value={row.qty || ''}
                            onChange={(e) => updateRow(row.rowId, { qty: Number(e.target.value) })}
                            className="w-full h-8 px-2 text-right rounded border border-slate-300 bg-white font-bold text-slate-900 outline-none focus:border-cyan-500"
                          />
                        </td>

                        {/* ĐƠN GIÁ (đ) */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="number"
                            min="0"
                            value={row.price || ''}
                            onChange={(e) => updateRow(row.rowId, { price: Number(e.target.value) })}
                            className="w-full h-8 px-2 text-right rounded border border-slate-300 bg-white font-medium text-slate-800 outline-none focus:border-cyan-500"
                          />
                        </td>

                        {/* THÀNH TIỀN */}
                        <td className="p-1.5 text-right font-black text-cyan-700 border-r border-slate-200">
                          {formatMoney(row.totalAmount)}
                        </td>

                        {/* GHI CHÚ */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="text"
                            value={row.note}
                            onChange={(e) => updateRow(row.rowId, { note: e.target.value })}
                            placeholder="Ghi chú dòng..."
                            className="w-full h-8 px-2 rounded border border-slate-300 bg-white font-normal text-slate-700 outline-none focus:border-cyan-500"
                          />
                        </td>

                        {/* TT (Actions) */}
                        <td className="p-1 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDuplicateRow(idx)}
                              className="p-1 text-cyan-600 hover:text-cyan-800 hover:bg-cyan-50 rounded transition cursor-pointer"
                              title="Nhân đôi dòng"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(row.rowId)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                              title="Xóa dòng"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN (3/12 width): SUMMARY CARD & ACTIONS ── */}
        <div className="lg:col-span-3 rounded-xl border-2 border-slate-200 bg-white p-3 shadow-sm space-y-3 flex flex-col justify-between h-full">
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b-2 border-slate-100 pb-2 text-cyan-800 font-extrabold text-xs">
              <Package className="h-4 w-4 text-cyan-600" />
              <span>THÔNG TIN NHẬP CHUYỂN NỘI BỘ</span>
            </div>

            {/* Notice Badge */}
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5 text-[11px] text-blue-800 font-semibold leading-relaxed">
              ℹ Nghiệp vụ Nhập Chuyển Kho Nội Bộ giữa các kho trong cùng doanh nghiệp — Không phát sinh doanh thu hay thuế VAT.
            </div>

            {/* Quick Warehouse Overview */}
            <div className="rounded-xl border-2 border-cyan-100 bg-cyan-50/60 p-2.5 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold text-slate-700">
                <span>Kho nhập (Kho đích):</span>
                <span className="text-cyan-800 font-black">{activeTab?.destinationWarehouseCode}</span>
              </div>
              <div className="flex items-center justify-between font-bold text-slate-700">
                <span>Kho xuất (Kho nguồn):</span>
                <span className="text-emerald-800 font-black">{activeTab?.sourceWarehouseCode}</span>
              </div>
            </div>

            {/* Ghi chú điều chuyển */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Lý do / Ghi chú nhập chuyển kho</label>
              <textarea
                rows={3}
                value={activeTab?.generalNote || ''}
                onChange={(e) => updateActiveTab((t) => ({ ...t, generalNote: e.target.value }))}
                placeholder="Nhập lý do nhập chuyển kho nội bộ..."
                className="w-full p-2.5 rounded-lg border-2 border-slate-200 bg-white font-medium text-slate-700 outline-none focus:border-cyan-600 resize-none text-xs"
              />
            </div>

            {/* Highlight Total Card */}
            <div className="bg-gradient-to-br from-cyan-50 to-emerald-50 border-2 border-cyan-200 rounded-xl p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600 font-semibold">
                <span>Số mặt hàng nhập:</span>
                <span className="font-bold text-slate-900">{activeValidItems.length}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 font-semibold">
                <span>Tổng số lượng nhập:</span>
                <span className="font-bold text-slate-900">{totalQty}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-cyan-200">
                <span className="font-black text-slate-900 text-xs uppercase">TỔNG GIÁ TRỊ HÀNG:</span>
                <span className="font-black text-cyan-700 text-base">{formatMoney(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons Cleanly Integrated at bottom of right column */}
          <div className="pt-3 border-t-2 border-slate-100 space-y-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveTransferRequest('PENDING')}
              className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold shadow-md transition flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{activeTab?.id ? 'Lưu & Cập nhật' : 'Lưu & Gửi yêu cầu'}</span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveTransferRequest('DRAFT')}
              className="w-full py-2.5 px-4 rounded-xl border-2 border-cyan-500 bg-white hover:bg-cyan-50 text-cyan-700 font-extrabold shadow-sm transition flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>Lưu Nháp</span>
            </button>

            <button
              type="button"
              onClick={handleBackNavigation}
              className="w-full py-2 px-4 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition text-xs cursor-pointer"
            >
              Quay lại danh sách
            </button>
          </div>
        </div>
      </div>

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
    </div>
  );

  if (!standalone) {
    return contentMarkup;
  }

  return <MainLayout>{contentMarkup}</MainLayout>;
}
