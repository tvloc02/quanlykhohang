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
} from 'lucide-react';
import { deliveryApi, type TransferOrder } from '../api/deliveryApi';
import BarcodeScanner, { type ScannedProduct } from '../../../shared/components/BarcodeScanner';
import MainLayout from '../../../shared/components/MainLayout';

// ─── TYPES & INTERFACES ────────────────────────────────────────

export interface ProductOption {
  id: string;
  internalSku: string;
  name: string;
  unit?: string;
  purchasePrice?: number;
  salePrice?: number;
  price?: number;
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

function generateTransferCode() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `PXCN-${dateStr}-${randomSuffix}`;
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

function createNewTransferTab(
  tabIndex = 1,
  defaultStaffEmail = '',
  defaultSource = 'KHO-TONG',
  defaultDest = 'KHO-CN-HCM'
): TransferTab {
  const d = new Date();
  const dateFormatted = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d
    .getDate()
    .toString()
    .padStart(2, '0')}T${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

  return {
    tabId: `tab-${Date.now()}-${tabIndex}`,
    title: `# ${tabIndex}`,
    transferNo: generateTransferCode(),
    sourceWarehouseCode: defaultSource,
    destinationWarehouseCode: defaultDest,
    assignedStaffEmail: defaultStaffEmail,
    orderDate: dateFormatted,
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
            ? new Date(targetEditData.scheduledDate).toISOString().slice(0, 16)
            : new Date().toISOString().slice(0, 16),
          generalNote: targetEditData.note || '',
          status: targetEditData.status || 'DRAFT',
          details: paddedRows,
        },
      ];
    }

    try {
      const savedDraft = sessionStorage.getItem('transfer_tabs_draft');
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
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
          setProducts(Array.isArray(prodData) ? prodData : prodData.data || []);
        }

        if (userRes && userRes.ok) {
          const userData = await userRes.json();
          setUsers(Array.isArray(userData) ? userData : userData.data || []);
        }

        if (whRes && whRes.ok) {
          const whData = await whRes.json();
          const list = Array.isArray(whData) ? whData : whData.data || [];
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
            updated.price = matched.purchasePrice || matched.salePrice || 0;
            if (updated.qty === 0) updated.qty = 1;
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
    const matched = products.filter(
      (p) => p.name.toLowerCase().includes(kw) || (p.internalSku || '').toLowerCase().includes(kw)
    );
    const nonMatched = products.filter((p) => !matched.includes(p));
    return [...matched, ...nonMatched];
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
    if (onBack) {
      onBack();
    } else {
      navigate('/delivery');
    }
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
      const payload = {
        transferNo: activeTab.transferNo,
        sourceWarehouse: activeTab.sourceWarehouseCode,
        destinationWarehouse: activeTab.destinationWarehouseCode,
        scheduledDate: activeTab.orderDate,
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
      className={`animate-[fadeIn_0.2s_ease-out] ${isFullscreen
          ? 'fixed inset-0 z-[9999] bg-slate-100 p-2.5 sm:p-3 flex flex-col h-screen overflow-hidden'
          : 'space-y-3 pb-20'
        }`}
    >
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[9999] flex items-center gap-3 rounded-xl px-5 py-3 shadow-xl transition-all border ${toast.type === 'error'
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

      {/* Top Header Strip with Quay lại button */}
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-3.5 py-1.5 text-white shadow-md">
          <Send className="h-4 w-4 text-cyan-100" />
          <h1 className="text-base font-bold tracking-tight text-white uppercase">
            TẠO PHIẾU XUẤT CHUYỂN CHI NHÁNH (LẬP LỆNH ĐIỀU CHUYỂN KHO)
          </h1>
        </div>

        <button
          type="button"
          onClick={handleBackNavigation}
          className="inline-flex items-center gap-1.5 rounded-xl border-2 border-cyan-500 bg-white px-4 py-2 text-xs font-bold text-cyan-700 hover:bg-cyan-50 transition shadow-xs cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Quay lại</span>
        </button>
      </div>

      {/* Top Information Control Card (5 Columns: Ngày xuất, Mã lệnh, Kho xuất, Kho nhập chi nhánh, Nhân viên) */}
      <div className="rounded-xl border-2 border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Ngày xuất / điều chuyển */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Ngày xuất / điều chuyển</label>
            <input
              type="datetime-local"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="h-9 w-full rounded-lg border-2 border-slate-200 bg-white px-3 text-xs font-semibold outline-none transition focus:border-cyan-500"
            />
          </div>

          {/* Mã HĐ / Lệnh */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Mã phiếu / Lệnh điều chuyển</label>
            <input
              type="text"
              value={transferCode}
              onChange={(e) => setTransferCode(e.target.value)}
              placeholder="Tạo tự động"
              className="h-9 w-full rounded-lg border-2 border-slate-200 bg-slate-50 px-3 text-xs font-bold text-cyan-700 outline-none focus:border-cyan-500"
            />
          </div>

          {/* Kho xuất (Kho nguồn) */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
              <WarehouseIcon className="h-3.5 w-3.5 text-cyan-600" />
              <span>Kho xuất hàng (Kho nguồn)</span>
            </label>
            <select
              value={sourceWarehouseCode}
              onChange={(e) => handleSourceWarehouseChange(e.target.value)}
              className="h-9 w-full rounded-lg border-2 border-cyan-500 bg-cyan-50/50 px-3 text-xs font-bold text-cyan-900 outline-none transition focus:border-cyan-600 cursor-pointer"
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

          {/* Kho nhập (Chi nhánh nhận) */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
              <ArrowRight className="h-3.5 w-3.5 text-emerald-600" />
              <span>Kho nhập (Kho nhận)</span>
            </label>
            <select
              value={destinationWarehouseCode}
              onChange={(e) => setDestinationWarehouseCode(e.target.value)}
              className="h-9 w-full rounded-lg border-2 border-emerald-500 bg-emerald-50/50 px-3 text-xs font-bold text-emerald-900 outline-none transition focus:border-emerald-600 cursor-pointer"
            >
              {warehouses.length > 0 ? (
                warehouses.map((wh) => (
                  <option key={wh.id || wh.code} value={wh.code}>
                    [{wh.code}] {wh.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="KHO-CN-HCM">KHO-CN-HCM - Chi nhánh TP.HCM</option>
                  <option value="KHO-CN-DN">KHO-CN-DN - Chi nhánh Đà Nẵng</option>
                  <option value="KH006">KH006 - Kho NVL Tổng hợp</option>
                </>
              )}
            </select>
          </div>

          {/* Nhân viên phụ trách */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-cyan-600" />
              <span>Nhân viên điều chuyển</span>
            </label>
            <select
              value={assignedStaffEmail}
              onChange={(e) => setAssignedStaffEmail(e.target.value)}
              className="h-9 w-full rounded-lg border-2 border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 cursor-pointer"
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
      </div>

      {/* ═══ PRODUCT SELECTION TABLE CARD ═══ */}
      <div className={`flex flex-col rounded-xl border-2 border-slate-200 bg-white shadow-sm overflow-hidden min-h-0 ${isFullscreen ? 'flex-1 h-full' : ''}`}>
        {/* Table Header Controls */}
        <div className="px-3 py-2 border-b-2 border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-cyan-800 font-extrabold text-xs">
            <Truck className="h-4 w-4 text-cyan-600" />
            <span>THÔNG TIN HÀNG HÓA XUẤT CHUYỂN ({items.length} DÒNG - TỔNG SL: {totalQty})</span>
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
                <th className="p-2 w-28 text-center border-r border-slate-200 bg-slate-100">KHO XUẤT</th>
                <th className="p-2 w-20 text-center border-r border-slate-200 bg-slate-100">SL XUẤT</th>
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
                            <span className="w-1/3 text-right uppercase">Giá tham chiếu</span>
                          </div>
                          <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                            {getFilteredProductsForRow(row.productName).length === 0 ? (
                              <div className="p-3 text-center text-xs text-slate-400">Không tìm thấy sản phẩm phù hợp</div>
                            ) : (
                              getFilteredProductsForRow(row.productName).map((p) => (
                                <div
                                  key={p.id}
                                  onClick={() => {
                                    updateRow(row.rowId, {
                                      productId: p.id,
                                      productSku: p.internalSku,
                                      productName: p.name,
                                      unit: p.unit || 'Cái',
                                      price: p.purchasePrice || p.salePrice || 0,
                                      qty: row.qty > 0 ? row.qty : 1,
                                    });
                                    setActiveProductDropdownRowId(null);
                                  }}
                                  className="flex items-center px-3 py-2 hover:bg-cyan-50 cursor-pointer text-xs transition"
                                >
                                  <span className="w-1/3 font-bold text-cyan-800">{p.internalSku || 'SKU---'}</span>
                                  <span className="w-1/3 font-semibold text-slate-800 truncate pr-1">{p.name}</span>
                                  <span className="w-1/3 text-right text-slate-600 font-medium">
                                    {formatMoney(p.purchasePrice || p.salePrice || 0)}
                                  </span>
                                </div>
                              ))
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

                    {/* KHO XUẤT */}
                    <td className="p-1 border-r border-slate-200">
                      <select
                        value={row.sourceWarehouseCode || activeTab.sourceWarehouseCode}
                        onChange={(e) => updateRow(row.rowId, { sourceWarehouseCode: e.target.value })}
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
                            <option value="KHO-TONG">KHO-TONG</option>
                            <option value="KH001">KH001</option>
                            <option value="KHO-NVL">KHO-NVL</option>
                          </>
                        )}
                      </select>
                    </td>

                    {/* SỐ LƯỢNG XUẤT */}
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

        {/* ── RIGHT COLUMN (3/12 width): SUMMARY CARD & ACTIONS ── */ }
  <div className="lg:col-span-3 rounded-xl border-2 border-slate-200 bg-white p-3 shadow-sm space-y-3 flex flex-col justify-between h-full">
    <div className="space-y-3">
      <div className="flex items-center gap-2 border-b-2 border-slate-100 pb-2 text-cyan-800 font-extrabold text-xs">
        <Package className="h-4 w-4 text-cyan-600" />
        <span>THÔNG TIN ĐIỀU CHUYỂN NỘI BỘ</span>
      </div>

      {/* Notice Badge */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5 text-[11px] text-blue-800 font-semibold leading-relaxed">
        ℹ Nghiệp vụ Chuyển Kho Nội Bộ giữa các kho trong cùng doanh nghiệp — Không phát sinh doanh thu hay thuế VAT.
      </div>

      {/* Quick Warehouse Overview */}
      <div className="rounded-xl border-2 border-cyan-100 bg-cyan-50/60 p-2.5 space-y-2 text-xs">
        <div className="flex items-center justify-between font-bold text-slate-700">
          <span>Kho xuất (Kho nguồn):</span>
          <span className="text-cyan-800 font-black">{activeTab?.sourceWarehouseCode}</span>
        </div>
        <div className="flex items-center justify-between font-bold text-slate-700">
          <span>Kho nhập (Kho đích):</span>
          <span className="text-emerald-800 font-black">{activeTab?.destinationWarehouseCode}</span>
        </div>
      </div>

      {/* Ghi chú điều chuyển */}
      <div>
        <label className="mb-1 block text-xs font-bold text-slate-700">Lý do / Ghi chú điều chuyển nội bộ</label>
        <textarea
          rows={3}
          value={activeTab?.generalNote || ''}
          onChange={(e) => updateActiveTab((t) => ({ ...t, generalNote: e.target.value }))}
          placeholder="Nhập lý do điều chuyển nội bộ (VD: Điều chuyển cân bằng tồn kho)..."
          className="w-full p-2.5 rounded-lg border-2 border-slate-200 bg-white font-medium text-slate-700 outline-none focus:border-cyan-600 resize-none text-xs"
        />
      </div>

      {/* Highlight Total Card */}
      <div className="bg-gradient-to-br from-cyan-50 to-emerald-50 border-2 border-cyan-200 rounded-xl p-3 space-y-2 text-xs">
        <div className="flex items-center justify-between text-slate-600 font-semibold">
          <span>Số mặt hàng xuất:</span>
          <span className="font-bold text-slate-900">{activeValidItems.length}</span>
        </div>
        <div className="flex items-center justify-between text-slate-600 font-semibold">
          <span>Tổng số lượng xuất:</span>
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
        onClick={() => handleSaveTransfer('APPROVED')}
        className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold shadow-md transition flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        <span>{activeTab?.id ? 'Lưu & Duyệt thay đổi' : 'Lưu & Duyệt'}</span>
      </button>

      <button
        type="button"
        disabled={saving}
        onClick={() => handleSaveTransfer('DRAFT')}
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
      </div >
    </div >
  );

  if (!standalone) {
    return contentMarkup;
  }

  return <MainLayout>{contentMarkup}</MainLayout>;
}
