import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  Save,
  Printer,
  X,
  XCircle,
  CheckCircle2,
  Building2,
  Package,
  User,
  CreditCard,
  ScanLine,
  UserPlus,
  Maximize2,
  Minimize2,
  FileText,
  DollarSign,
  Warehouse as WarehouseIcon,
  RotateCcw,
} from 'lucide-react';
import MainLayout from '../../../shared/components/MainLayout';
import BarcodeScanner, { type ScannedProduct } from '../../../shared/components/BarcodeScanner';

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

export interface CustomerOption {
  id: string;
  customerCode: string;
  name: string;
  phone?: string;
  address?: string;
}

export interface UserOption {
  id: string;
  fullName?: string;
  email: string;
  role?: string;
}

export interface WarehouseOption {
  id: string;
  code: string;
  name: string;
}

export interface FormDetailRow {
  rowId: string;
  productId: string;
  productSku: string;
  productName: string;
  unit: string;
  qty: number;
  price: number;
  discountPercent: number;
  discountAmount: number;
  vatPercent: number;
  vatAmount: number;
  totalAmount: number;
  note: string;
}

export interface OutboundTab {
  tabId: string;
  title: string;
  id?: string;
  orderNo: string;
  branchCode: string;
  employeeName: string;
  customer: string;
  customerId?: string;
  customerPhone: string;
  customerAddress: string;
  orderDate: string;
  expectedDate: string;
  description: string;
  discount: number;
  shippingFee: number;
  vatRate: number;
  paymentMethod: string;
  paymentAccount: string;
  amountPaid: number;
  status: string;
  details: FormDetailRow[];
}

const DEFAULT_ROWS_COUNT = 50;
const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function makeEmptyRow(index: number): FormDetailRow {
  return {
    rowId: `row-${Date.now()}-${index}-${Math.random()}`,
    productId: '',
    productSku: '',
    productName: '',
    unit: 'Cái',
    qty: 0,
    price: 0,
    discountPercent: 0,
    discountAmount: 0,
    vatPercent: 0,
    vatAmount: 0,
    totalAmount: 0,
    note: '',
  };
}

function makeInitialRows(count = DEFAULT_ROWS_COUNT): FormDetailRow[] {
  return Array.from({ length: count }, (_, i) => makeEmptyRow(i));
}

function createNewOutboundTab(tabIndex = 1, currentUserName = 'System Administrator'): OutboundTab {
  const d = new Date();
  const dateFormatted = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;

  return {
    tabId: `tab-${Date.now()}-${tabIndex}`,
    title: `# ${tabIndex}`,
    orderNo: '',
    branchCode: 'KHO-TONG',
    employeeName: currentUserName || 'System Administrator',
    customer: 'Khách hàng bán lẻ',
    customerPhone: '',
    customerAddress: '',
    orderDate: dateFormatted,
    expectedDate: dateFormatted,
    description: '',
    discount: 0,
    shippingFee: 0,
    vatRate: 0,
    paymentMethod: 'Tiền mặt',
    paymentAccount: '',
    amountPaid: 0,
    status: 'Đã giao hàng',
    details: makeInitialRows(DEFAULT_ROWS_COUNT),
  };
}

interface CreateOutboundOrderPageProps {
  onBack?: () => void;
  standalone?: boolean;
}

export default function CreateOutboundOrderPage({
  onBack,
  standalone = true,
}: CreateOutboundOrderPageProps) {
  const navigate = useNavigate();

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const currentUserName = currentUser.fullName || currentUser.email?.split('@')[0] || 'System Administrator';

  // Master Data
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);

  // Toast alert
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fullscreen state
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', phone: '', address: '', customerCode: '' });

  // Dropdown states
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [activeProductDropdownRowId, setActiveProductDropdownRowId] = useState<string | null>(null);
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);

  // Synchronous Multi-Tab state with Session Storage restoration
  const [tabs, setTabs] = useState<OutboundTab[]>(() => {
    try {
      const savedDraft = sessionStorage.getItem('outbound_tabs_draft');
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch { }
    return [createNewOutboundTab(1, currentUserName)];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    try {
      const savedActiveId = sessionStorage.getItem('outbound_active_tab_id');
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
    const newTab = createNewOutboundTab(newTabIndex, currentUserName);
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.tabId);
    setToast({ message: `Đã mở tab tạo phiếu xuất mới (#${newTabIndex})`, type: 'success' });
  }, [tabs.length, currentUserName]);

  const handleCloseTab = useCallback((tabIdToClose: string, e?: React.MouseEvent) => {
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
  }, [tabs, activeTabId]);

  // Sync draft tabs to sessionStorage
  useEffect(() => {
    if (tabs && tabs.length > 0) {
      sessionStorage.setItem('outbound_tabs_draft', JSON.stringify(tabs));
      sessionStorage.setItem('outbound_active_tab_id', activeTabId);
    }
  }, [tabs, activeTabId]);

  // Click outside listener for dropdowns
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('.customer-dropdown-box') && !target.closest('.product-table-dropdown')) {
        setShowCustomerDropdown(false);
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
        const [custRes, prodRes, userRes, whRes] = await Promise.all([
          fetch(`${API_BASE_URL}/customers`, { headers: authHeaders() }).catch(() => null),
          fetch(`${API_BASE_URL}/products`, { headers: authHeaders() }).catch(() => null),
          fetch(`${API_BASE_URL}/users`, { headers: authHeaders() }).catch(() => null),
          fetch(`${API_BASE_URL}/warehouses`, { headers: authHeaders() }).catch(() => null),
        ]);

        if (custRes && custRes.ok) {
          const custData = await custRes.json();
          const list = Array.isArray(custData) ? custData : custData.data || [];
          setCustomers(list);
        }

        if (prodRes && prodRes.ok) {
          const prodData = await prodRes.json();
          const list = Array.isArray(prodData) ? prodData : prodData.data || [];
          const normalized: ProductOption[] = list.map((p: any) => ({
            id: String(p.id),
            internalSku: p.internalSku || p.sku || p.code || '',
            name: p.name || '',
            unit: p.unit || 'Cái',
            purchasePrice: Number(p.importPrice || p.purchasePrice || 0),
            salePrice: Number(p.retailPrice || p.salePrice || p.price || 0),
            price: Number(p.retailPrice || p.salePrice || p.price || 0),
          }));
          setProducts(normalized);
        }

        if (userRes && userRes.ok) {
          const userData = await userRes.json();
          const list = Array.isArray(userData) ? userData : userData.data || [];
          setUsers(list);
        }

        if (whRes && whRes.ok) {
          const whData = await whRes.json();
          const list = Array.isArray(whData) ? whData : whData.data || [];
          setWarehouses(list);
        }
      } catch (err) {
        console.error('Error loading master data:', err);
      }
    }
    loadMasterData();
  }, []);

  const handleBackNavigation = () => {
    sessionStorage.removeItem('outbound_form_open');
    sessionStorage.removeItem('outbound_tabs_draft');
    sessionStorage.removeItem('outbound_active_tab_id');
    if (onBack) {
      onBack();
    } else {
      navigate('/outbound/orders');
    }
  };

  const updateActiveTab = useCallback(
    (updater: (prevTab: OutboundTab) => OutboundTab) => {
      setTabs((prevTabs) =>
        prevTabs.map((t) => (t.tabId === activeTabId ? updater(t) : t))
      );
    },
    [activeTabId]
  );

  const updateRow = (rowId: string, patch: Partial<FormDetailRow>) => {
    updateActiveTab((tab) => {
      const updatedDetails = tab.details.map((row) => {
        if (row.rowId !== rowId) return row;
        const newRow = { ...row, ...patch };

        if (patch.productId && patch.productId !== row.productId) {
          const p = products.find((prod) => prod.id === patch.productId);
          if (p) {
            newRow.productSku = p.internalSku;
            newRow.productName = p.name;
            newRow.unit = p.unit || 'Cái';
            newRow.price = p.salePrice || p.price || 0;
            if (newRow.qty === 0) newRow.qty = 1;
          }
        }

        const qty = Number(newRow.qty) || 0;
        const price = Number(newRow.price) || 0;
        const discPercent = Number(newRow.discountPercent) || 0;
        const lineTotalBeforeDisc = qty * price;
        const discAmount = (lineTotalBeforeDisc * discPercent) / 100;
        const lineTotalAfterDisc = Math.max(0, lineTotalBeforeDisc - discAmount);
        const vatPercent = Number(newRow.vatPercent) || 0;
        const vatAmount = (lineTotalAfterDisc * vatPercent) / 100;

        newRow.discountAmount = discAmount;
        newRow.vatAmount = vatAmount;
        newRow.totalAmount = lineTotalAfterDisc + vatAmount;

        return newRow;
      });

      return { ...tab, details: updatedDetails };
    });
  };

  const handleAddBlankRow = () => {
    updateActiveTab((tab) => ({
      ...tab,
      details: [...tab.details, makeEmptyRow(tab.details.length)],
    }));
  };

  const handleDuplicateRow = (index: number) => {
    updateActiveTab((tab) => {
      const source = tab.details[index];
      if (!source) return tab;
      const dup: FormDetailRow = {
        ...source,
        rowId: `row-${Date.now()}-${Math.random()}`,
      };
      const next = [...tab.details];
      next.splice(index + 1, 0, dup);
      return { ...tab, details: next };
    });
    setToast({ message: `Đã nhân đôi dòng số ${index + 1}`, type: 'success' });
  };

  const handleRemoveRow = (rowId: string) => {
    updateActiveTab((tab) => ({
      ...tab,
      details: tab.details.filter((r) => r.rowId !== rowId),
    }));
  };

  const handleBarcodeScanned = (scanned: ScannedProduct) => {
    if (!scanned || !activeTab) return;

    const barcodeVal = scanned.supplierBarcode || scanned.internalSku || '';
    const priceVal = scanned.purchasePrice || scanned.salePrice || 0;

    // 1. Ưu tiên kiểm tra sản phẩm đã có trong bảng chưa, nếu có thì cộng dồn số lượng
    const existingIndex = activeTab.details.findIndex(
      (r) =>
        (r.productId && r.productId === scanned.id) ||
        (r.productSku && barcodeVal && r.productSku.toLowerCase() === barcodeVal.toLowerCase()) ||
        (r.productName && scanned.name && r.productName.toLowerCase() === scanned.name.toLowerCase())
    );

    if (existingIndex >= 0) {
      const existingRow = activeTab.details[existingIndex];
      const newQty = (Number(existingRow.qty) || 0) + 1;
      const unitP = Number(existingRow.price) || priceVal;
      const discPct = Number(existingRow.discountPercent) || 0;
      const totalAmount = newQty * unitP * (1 - discPct / 100);

      updateRow(existingRow.rowId, {
        qty: newQty,
        price: unitP,
        totalAmount: Math.max(0, totalAmount),
      });
      setToast({ message: `Đã tăng số lượng "${scanned.name}": ${newQty} ${existingRow.unit || 'Cái'}`, type: 'success' });
      return;
    }

    // 2. Nếu chưa có, kiểm tra dòng trống có sẵn để điền vào
    const emptyRow = activeTab.details.find((r) => !r.productId && !r.productName);
    if (emptyRow) {
      updateRow(emptyRow.rowId, {
        productId: scanned.id,
        productSku: barcodeVal,
        productName: scanned.name,
        unit: scanned.unit || 'Cái',
        price: priceVal,
        qty: 1,
        totalAmount: priceVal,
      });
    } else {
      // 3. Thêm dòng mới vào bảng
      const newRow = makeEmptyRow(activeTab.details.length);
      newRow.productId = scanned.id;
      newRow.productSku = barcodeVal;
      newRow.productName = scanned.name;
      newRow.unit = scanned.unit || 'Cái';
      newRow.price = priceVal;
      newRow.qty = 1;
      newRow.totalAmount = priceVal;

      updateActiveTab((tab) => ({ ...tab, details: [...tab.details, newRow] }));
    }
    setToast({ message: `Đã thêm sản phẩm: ${scanned.name}`, type: 'success' });
  };

  const handleAddQuickCustomer = async () => {
    if (!newCustomerForm.name.trim()) {
      setToast({ message: 'Vui lòng nhập tên khách hàng', type: 'error' });
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/customers`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(newCustomerForm),
      });
      if (res.ok) {
        const created = await res.json();
        setCustomers((prev) => [created, ...prev]);
        updateActiveTab((tab) => ({
          ...tab,
          customer: created.name,
          customerId: created.id,
          customerPhone: created.phone || '',
          customerAddress: created.address || '',
        }));
        setShowAddCustomerModal(false);
        setNewCustomerForm({ name: '', phone: '', address: '', customerCode: '' });
        setToast({ message: `Đã thêm khách hàng ${created.name}`, type: 'success' });
      }
    } catch {
      setToast({ message: 'Không thể thêm khách hàng', type: 'error' });
    }
  };

  // Calculations for Active Tab
  const activeValidItems = useMemo(() => {
    if (!activeTab) return [];
    return activeTab.details.filter(
      (r) => (r.productId || r.productName?.trim() || r.productSku?.trim()) && r.qty > 0
    );
  }, [activeTab]);

  const totalQty = useMemo(() => {
    return activeValidItems.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  }, [activeValidItems]);

  const subtotal = useMemo(() => {
    return activeValidItems.reduce(
      (s, r) => s + (Number(r.totalAmount) || Number(r.qty) * Number(r.price)),
      0
    );
  }, [activeValidItems]);

  const vatAmount = useMemo(() => {
    return (subtotal * (activeTab?.vatRate || 0)) / 100;
  }, [subtotal, activeTab?.vatRate]);

  const grandTotal = useMemo(() => {
    if (!activeTab) return 0;
    return Math.max(
      0,
      subtotal - (activeTab.discount || 0) + (activeTab.shippingFee || 0) + vatAmount
    );
  }, [subtotal, activeTab, vatAmount]);

  const remainingDebt = useMemo(() => {
    if (!activeTab) return 0;
    return Math.max(0, grandTotal - (activeTab.amountPaid || grandTotal));
  }, [grandTotal, activeTab]);

  const handleSaveOutboundOrder = async (isPrint = false) => {
    if (!activeTab) return;
    if (activeValidItems.length === 0) {
      setToast({ message: 'Vui lòng chọn ít nhất 1 sản phẩm với số lượng > 0', type: 'error' });
      return;
    }

    const payload = {
      orderNo: activeTab.orderNo.trim() ? activeTab.orderNo.trim().toUpperCase() : undefined,
      orderType: 'orders',
      branchCode: activeTab.branchCode || 'KHO-NVL',
      employeeName: activeTab.employeeName || currentUser?.fullName || currentUser?.email?.split('@')[0] || 'Quản trị viên hệ thống',
      customerId: activeTab.customerId,
      customerName: activeTab.customer?.trim() || '888 - Khách lẻ',
      customerPhone: activeTab.customerPhone?.trim() || undefined,
      customerAddress: activeTab.customerAddress?.trim() || undefined,
      orderDate: activeTab.orderDate,
      expectedDate: activeTab.orderDate,
      status: activeTab.status || 'Đã giao hàng',
      description: activeTab.description?.trim() || undefined,
      subtotal,
      discount: activeTab.discount || 0,
      vatRate: activeTab.vatRate || 0,
      vatAmount,
      totalAmount: grandTotal,
      amountPaid: activeTab.amountPaid || grandTotal,
      details: activeValidItems.map((r) => ({
        productId: r.productId,
        productSku: r.productSku,
        productName: r.productName,
        unit: r.unit,
        qty: Number(r.qty),
        price: Number(r.price),
      })),
    };

    try {
      const res = await fetch(`${API_BASE_URL}/outbounds`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || 'Không thể tạo phiếu xuất hàng');
      }

      setToast({
        message: `Đã lưu thành công phiếu xuất kho ${payload.orderNo || ''}!`,
        type: 'success',
      });

      setTimeout(() => {
        handleBackNavigation();
      }, 1000);
    } catch (err: any) {
      setToast({ message: err.message || 'Lỗi khi lưu phiếu xuất hàng', type: 'error' });
    }
  };

  const getFilteredProductsForRow = (rowText: string) => {
    const kw = (rowText || '').trim().toLowerCase();
    if (!kw) return products;
    const matched = products.filter(
      (p) =>
        p.name.toLowerCase().includes(kw) ||
        (p.internalSku || '').toLowerCase().includes(kw) ||
        `${p.internalSku} ${p.name}`.toLowerCase().includes(kw)
    );
    if (matched.length > 0) return matched;
    return products;
  };

  const filteredCustomers = useMemo(() => {
    const kw = customerSearch.trim().toLowerCase();
    if (!kw) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(kw) ||
        (c.customerCode || '').toLowerCase().includes(kw) ||
        (c.phone || '').toLowerCase().includes(kw)
    );
  }, [customers, customerSearch]);

  const contentMarkup = (
    <div
      className={`animate-[fadeIn_0.2s_ease-out] ${isFullScreen
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

      {/* Barcode Scanner Modal */}
      {showScannerModal && (
        <BarcodeScanner
          isOpen={showScannerModal}
          onProductFound={handleBarcodeScanned}
          onClose={() => setShowScannerModal(false)}
          title="Quét Mã Barcode Hàng Hóa Xuất Kho"
        />
      )}

      {/* Quick Customer Add Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 animate-[fadeIn_0.2s_ease-out]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <h3 className="text-base font-extrabold text-slate-800">Thêm Nhanh Khách Hàng</h3>
              <button onClick={() => setShowAddCustomerModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mã KH</label>
                <input
                  type="text"
                  placeholder="Tự động nếu để trống"
                  value={newCustomerForm.customerCode}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, customerCode: e.target.value })}
                  className="w-full h-9 rounded-lg border-2 border-slate-200 px-3 text-xs font-semibold outline-none focus:border-cyan-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên khách hàng (*)</label>
                <input
                  type="text"
                  placeholder="Nhập tên khách hàng"
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                  className="w-full h-9 rounded-lg border-2 border-slate-200 px-3 text-xs font-semibold outline-none focus:border-cyan-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Số điện thoại</label>
                <input
                  type="text"
                  placeholder="SĐT liên hệ"
                  value={newCustomerForm.phone}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                  className="w-full h-9 rounded-lg border-2 border-slate-200 px-3 text-xs font-semibold outline-none focus:border-cyan-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Địa chỉ</label>
                <input
                  type="text"
                  placeholder="Địa chỉ giao hàng"
                  value={newCustomerForm.address}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                  className="w-full h-9 rounded-lg border-2 border-slate-200 px-3 text-xs font-semibold outline-none focus:border-cyan-600"
                />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(false)}
                className="rounded-xl border-2 border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleAddQuickCustomer}
                className="rounded-xl bg-cyan-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-cyan-700"
              >
                Lưu Khách Hàng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 1. TOP HEADER BAR: Page Title & Back Button (Hidden in Fullscreen) ═══ */}
      {!isFullScreen && (
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2.5 rounded-xl bg-cyan-600 px-4 py-2 text-white shadow-sm">
            <Package className="h-5 w-5" />
            <h1 className="text-base font-black tracking-tight uppercase">TẠO PHIẾU XUẤT HÀNG HÓA</h1>
          </div>

          <button
            type="button"
            onClick={handleBackNavigation}
            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-cyan-50 hover:border-cyan-600 hover:text-cyan-700 transition shadow-2xs cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Quay lại</span>
          </button>
        </div>
      )}

      {/* ═══ MULTI-TAB SWITCHER BAR ═══ */}
      <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 flex-shrink-0">
        {tabs.map((tab, idx) => {
          const isActive = tab.tabId === activeTabId;
          const validItemsCount = tab.details.filter((d) => d.productName && d.qty > 0).length;
          return (
            <div
              key={tab.tabId}
              onClick={() => setActiveTabId(tab.tabId)}
              className={`group inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer border shadow-xs select-none ${isActive
                ? 'bg-cyan-600 text-white border-cyan-600 shadow-md ring-2 ring-cyan-200'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-cyan-50 hover:border-cyan-300 hover:text-cyan-800'
                }`}
            >
              <FileText className={`h-3.5 w-3.5 ${isActive ? 'text-cyan-100' : 'text-cyan-600'}`} />
              <span className="max-w-[150px] truncate">
                {tab.orderNo ? tab.orderNo : `Phiếu #${idx + 1}`}
              </span>
              {validItemsCount > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${isActive ? 'bg-white text-cyan-800' : 'bg-cyan-100 text-cyan-800'
                    }`}
                >
                  {validItemsCount} SP
                </span>
              )}
              {tabs.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => handleCloseTab(tab.tabId, e)}
                  className={`rounded p-0.5 transition ${isActive
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
        <button
          type="button"
          onClick={handleAddNewTab}
          className="inline-flex items-center gap-1 rounded-xl border-2 border-dashed border-cyan-400 bg-cyan-50/60 px-3 py-1.5 text-xs font-bold text-cyan-700 hover:bg-cyan-100 hover:border-cyan-600 transition cursor-pointer"
          title="Tạo thêm phiếu xuất mới (Tab tiếp theo)"
        >
          <Plus size={14} className="text-cyan-700" />
          <span>+ Thêm phiếu mới</span>
        </button>
      </div>

      {/* ═══ 2. MAIN 2-COLUMN LAYOUT (Left Product Table, Right Sleek Payment Panel) ═══ */}
      <div className={`flex flex-col lg:flex-row gap-3 items-stretch ${isFullScreen ? 'flex-1 min-h-0' : 'items-start'}`}>
        {/* ── LEFT COLUMN: METADATA + PRODUCT TABLE STACKED VERTICALLY (Expands to fill all remaining width) ── */}
        <div className={`flex-1 min-w-0 flex flex-col space-y-2.5 ${isFullScreen ? 'h-full' : ''}`}>
          {/* ═══ FORM METADATA CONTROL BAR ═══ */}
          <div className="rounded-xl border-2 border-slate-200 bg-white p-3 shadow-sm flex-shrink-0">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Ngày xuất hàng */}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Ngày xuất hàng</label>
                <input
                  type="text"
                  value={activeTab?.orderDate || ''}
                  onChange={(e) => updateActiveTab((t) => ({ ...t, orderDate: e.target.value }))}
                  placeholder="DD/MM/YYYY"
                  className="h-8.5 w-full rounded-lg border-2 border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-cyan-600"
                />
              </div>

              {/* Mã phiếu xuất */}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Mã phiếu xuất</label>
                <input
                  type="text"
                  value={activeTab?.orderNo || ''}
                  onChange={(e) => updateActiveTab((t) => ({ ...t, orderNo: e.target.value }))}
                  placeholder="MÃ TỰ ĐỘNG (PXK...)"
                  className="h-8.5 w-full rounded-lg border-2 border-slate-200 bg-slate-50 px-3 text-xs font-bold text-cyan-800 uppercase outline-none focus:border-cyan-600"
                />
              </div>

              {/* Chọn Khách hàng (Searchable Interactive Dropdown) */}
              <div className="relative customer-dropdown-box">
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-cyan-600" />
                    <span>Khách hàng</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddCustomerModal(true)}
                    className="text-[11px] font-bold text-cyan-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <UserPlus size={12} />
                    <span>+ Thêm KH</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={
                    showCustomerDropdown
                      ? customerSearch
                      : activeTab?.customer || ''
                  }
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => {
                    setCustomerSearch('');
                    setShowCustomerDropdown(true);
                  }}
                  onClick={() => setShowCustomerDropdown(true)}
                  placeholder="Tìm theo tên, mã KH, SĐT..."
                  className="h-8.5 w-full rounded-lg border-2 border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-cyan-600 cursor-text"
                />

                {showCustomerDropdown && (
                  <div className="absolute left-0 top-full z-[100] mt-1 w-[380px] max-h-60 overflow-y-auto rounded-xl border border-slate-300 bg-white shadow-2xl flex flex-col">
                    <div className="flex bg-slate-100 border-b border-slate-300 px-3 py-2 text-[11px] font-bold text-slate-600 sticky top-0 z-10">
                      <span className="w-1/3 uppercase">Mã KH</span>
                      <span className="w-1/3 uppercase">Tên khách hàng</span>
                      <span className="w-1/3 text-right uppercase">SĐT</span>
                    </div>
                    <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                      {filteredCustomers.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-400">Không tìm thấy khách hàng</div>
                      ) : (
                        filteredCustomers.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => {
                              updateActiveTab((tab) => ({
                                ...tab,
                                customer: c.name,
                                customerId: c.id,
                                customerPhone: c.phone || '',
                                customerAddress: c.address || '',
                              }));
                              setShowCustomerDropdown(false);
                            }}
                            className="flex items-center px-3 py-2 hover:bg-cyan-50 cursor-pointer text-xs transition"
                          >
                            <span className="w-1/3 font-bold text-cyan-800">{c.customerCode || 'KH---'}</span>
                            <span className="w-1/3 font-semibold text-slate-800 truncate pr-1">{c.name}</span>
                            <span className="w-1/3 text-right text-slate-500">{c.phone || '-'}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Chọn Kho xuất */}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
                  <WarehouseIcon className="h-3.5 w-3.5 text-cyan-600" />
                  <span>Kho xuất hàng</span>
                </label>
                <select
                  value={activeTab?.branchCode || 'KHO-TONG'}
                  onChange={(e) => updateActiveTab((t) => ({ ...t, branchCode: e.target.value }))}
                  className="h-8.5 w-full rounded-lg border-2 border-cyan-500 bg-cyan-50/50 px-3 text-xs font-bold text-cyan-900 outline-none focus:border-cyan-600 cursor-pointer"
                >
                  {warehouses.length > 0 ? (
                    warehouses.map((wh) => (
                      <option key={wh.id || wh.code} value={wh.code}>
                        [{wh.code}] {wh.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="KHO-TONG">KHO-TONG - Kho tổng chính</option>
                      <option value="KH001">KH001 - Kho Hàng Hóa HCM</option>
                      <option value="KH002">KH002 - Kho Chi Nhánh Hà Nội</option>
                    </>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* ═══ PRODUCT SELECTION TABLE CARD ═══ */}
          <div className={`flex flex-col rounded-xl border-2 border-slate-200 bg-white shadow-sm overflow-hidden min-h-0 ${isFullScreen ? 'flex-1 h-full' : ''}`}>
            {/* Product Section Top Control Bar */}
            <div className="px-3 py-2 border-b-2 border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2 text-cyan-800 font-extrabold text-xs">
                <Package className="h-4 w-4 text-cyan-600" />
                <span>
                  THÔNG TIN HÀNG HÓA XUẤT KHO ({activeValidItems.length} MẶT HÀNG - TỔNG SL: {totalQty})
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
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="inline-flex items-center gap-1 rounded-lg border-2 border-cyan-500 bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-800 hover:bg-cyan-100 transition cursor-pointer shadow-xs"
                  title={isFullScreen ? 'Thu nhỏ cửa sổ' : 'Phóng to toàn màn hình'}
                >
                  {isFullScreen ? <Minimize2 className="h-3.5 w-3.5 text-cyan-700" /> : <Maximize2 className="h-3.5 w-3.5 text-cyan-700" />}
                  <span>{isFullScreen ? 'Thu nhỏ' : 'Phóng to'}</span>
                </button>
              </div>
            </div>

            {/* Clean Grid Product Table */}
            <div className={`overflow-x-auto overflow-y-auto custom-scrollbar flex-1 min-h-0 ${isFullScreen ? '' : 'max-h-[calc(100vh-215px)]'}`}>
              <table className="w-full text-left border-collapse text-xs min-w-[950px]">
                <thead className="bg-slate-100 text-slate-800 font-extrabold border-b-2 border-slate-200 uppercase text-xs sticky top-0 z-10">
                  <tr>
                    <th className="p-2 w-10 text-center border-r border-slate-200 bg-slate-100">STT</th>
                    <th className="p-2 min-w-[220px] text-center border-r border-slate-200 bg-slate-100">TÊN HÀNG HÓA</th>
                    <th className="p-2 w-16 text-center border-r border-slate-200 bg-slate-100">ĐVT</th>
                    <th className="p-2 w-20 text-center border-r border-slate-200 bg-slate-100">SỐ LƯỢNG</th>
                    <th className="p-2 w-28 text-center border-r border-slate-200 bg-slate-100">ĐƠN GIÁ (đ)</th>
                    <th className="p-2 min-w-[130px] whitespace-nowrap text-center border-r border-slate-200 bg-slate-100">CHIẾT KHẤU (%)</th>
                    <th className="p-2 w-16 text-center border-r border-slate-200 bg-slate-100">VAT (%)</th>
                    <th className="p-2 w-32 text-center border-r border-slate-200 bg-slate-100">THÀNH TIỀN</th>
                    <th className="p-2 w-24 min-w-[80px] text-center border-r border-slate-200 bg-slate-100">GHI CHÚ</th>
                    <th className="p-2.5 w-32 text-center bg-slate-100 min-w-[110px]">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeTab?.details.map((row, idx) => {
                    const isEven = idx % 2 === 1;
                    return (
                      <tr
                        key={row.rowId}
                        className={`${isEven ? 'bg-slate-50/70' : 'bg-white'} hover:bg-cyan-50/50 transition-colors`}
                      >
                        {/* STT */}
                        <td className="p-1.5 text-center font-bold text-slate-500 border-r border-slate-200">
                          {idx + 1}.
                        </td>

                        {/* TÊN HÀNG HÓA */}
                        <td className="p-0 border-r border-slate-200 relative product-table-dropdown">
                          <input
                            type="text"
                            value={row.productName || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateRow(row.rowId, { productName: val });
                              setActiveProductDropdownRowId(row.rowId);
                            }}
                            onFocus={() => setActiveProductDropdownRowId(row.rowId)}
                            onClick={() => setActiveProductDropdownRowId(row.rowId)}
                            placeholder="Chọn hoặc nhập tên hàng..."
                            className="w-full h-8 px-2 bg-transparent font-semibold text-slate-800 outline-none focus:bg-cyan-100/50 text-xs cursor-text"
                          />
                        </td>

                        {/* ĐVT */}
                        <td className="p-1 text-center border-r border-slate-200">
                          <input
                            type="text"
                            value={row.unit}
                            onChange={(e) => updateRow(row.rowId, { unit: e.target.value })}
                            className="w-full h-8 text-center rounded border border-slate-300 bg-white font-medium outline-none focus:border-cyan-500"
                          />
                        </td>

                        {/* SỐ LƯỢNG */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="number"
                            min="0"
                            value={row.qty === 0 ? '' : row.qty}
                            onChange={(e) => updateRow(row.rowId, { qty: Number(e.target.value) })}
                            placeholder="0"
                            className="w-full h-8 px-2 text-center rounded border border-slate-300 bg-white font-bold text-slate-800 outline-none focus:border-cyan-500"
                          />
                        </td>

                        {/* ĐƠN GIÁ (đ) */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="number"
                            min="0"
                            value={row.price === 0 ? '' : row.price}
                            onChange={(e) => updateRow(row.rowId, { price: Number(e.target.value) })}
                            placeholder="0"
                            className="w-full h-8 px-2 text-right rounded border border-slate-300 bg-white font-bold text-slate-800 outline-none focus:border-cyan-500"
                          />
                        </td>

                        {/* CHIẾT KHẤU (%) */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={row.discountPercent === 0 ? '' : row.discountPercent}
                            onChange={(e) => updateRow(row.rowId, { discountPercent: Number(e.target.value) })}
                            placeholder="0"
                            className="w-full h-8 text-center rounded border border-slate-300 bg-white font-medium outline-none focus:border-cyan-500"
                          />
                        </td>

                        {/* VAT (%) */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={row.vatPercent === 0 ? '' : row.vatPercent}
                            onChange={(e) => updateRow(row.rowId, { vatPercent: Number(e.target.value) })}
                            placeholder="0"
                            className="w-full h-8 text-center rounded border border-slate-300 bg-white font-medium outline-none focus:border-cyan-500"
                          />
                        </td>

                        {/* THÀNH TIỀN */}
                        <td className="p-1.5 text-right font-extrabold text-cyan-900 border-r border-slate-200 bg-cyan-50/40">
                          {row.totalAmount.toLocaleString('vi-VN')}
                        </td>

                        {/* GHI CHÚ */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="text"
                            value={row.note}
                            onChange={(e) => updateRow(row.rowId, { note: e.target.value })}
                            placeholder="Ghi chú..."
                            className="w-full h-8 px-2 rounded border border-slate-300 bg-white font-normal text-slate-700 outline-none focus:border-cyan-500"
                          />
                        </td>

                        {/* TT (Actions) */}
                        <td className="p-1.5 text-center pr-2">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDuplicateRow(idx)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400 bg-cyan-50 text-cyan-700 shadow-2xs transition hover:bg-cyan-600 hover:text-white hover:border-cyan-600 cursor-pointer"
                              title="Nhân đôi dòng"
                            >
                              <Copy size={16} strokeWidth={2.2} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(row.rowId)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 bg-rose-50 text-rose-600 shadow-2xs transition hover:bg-rose-600 hover:text-white hover:border-rose-600 cursor-pointer"
                              title="Xóa dòng"
                            >
                              <Trash2 size={16} strokeWidth={2.2} />
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

        {/* ── RIGHT COLUMN (Compact Sleek Width 310px): PAYMENT & FINANCIAL METADATA FORM ── */}
        <div className={`w-full lg:w-[310px] xl:w-[320px] flex-shrink-0 rounded-xl border-2 border-slate-200 bg-white p-3 shadow-sm flex flex-col justify-between text-xs font-semibold text-slate-800 overflow-y-auto custom-scrollbar space-y-2.5 ${isFullScreen ? 'h-full' : 'h-fit sticky top-4'}`}>
          <div className="space-y-2">
            <div className="flex items-center gap-2 border-b-2 border-slate-100 pb-1.5 text-cyan-800 font-extrabold text-xs">
              <DollarSign className="h-4 w-4 text-cyan-600" />
              <span>TỔNG CỘNG & THANH TOÁN</span>
            </div>

            {/* Nhân viên xuất kho */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Nhân viên xuất kho</label>
              <select
                value={activeTab?.employeeName || currentUserName}
                onChange={(e) => updateActiveTab((t) => ({ ...t, employeeName: e.target.value }))}
                className="h-8 w-full px-2 rounded-lg border-2 border-slate-200 bg-white font-semibold text-slate-800 text-xs outline-none focus:border-cyan-600 cursor-pointer"
              >
                <option value={currentUserName}>{currentUserName}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.fullName || u.email}>
                    {u.fullName || u.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Sử dụng điểm tích */}
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800 pt-0.5">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useLoyaltyPoints}
                  onChange={(e) => setUseLoyaltyPoints(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                />
                <span>Sử dụng điểm tích</span>
              </label>
              <div className="flex items-center gap-0.5">
                <span className="flex h-5 min-w-[20px] items-center justify-center bg-yellow-400 px-1 text-xs font-black text-black border border-slate-300">0</span>
                <span className="flex h-5 min-w-[20px] items-center justify-center bg-blue-700 px-1 text-xs font-black text-white border border-slate-300">0</span>
              </div>
            </div>

            {/* Hình thức thanh toán Radios */}
            <div className="space-y-1 text-xs font-semibold text-slate-800 border-t border-slate-200 pt-1.5">
              <label className="block font-bold">Hình thức thanh toán:</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethodRadio"
                    value="Tiền mặt"
                    checked={(activeTab?.paymentMethod || 'Tiền mặt') === 'Tiền mặt'}
                    onChange={(e) => updateActiveTab((t) => ({ ...t, paymentMethod: e.target.value }))}
                    className="h-3.5 w-3.5 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                  />
                  <span>Tiền mặt</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethodRadio"
                    value="Chuyển khoản"
                    checked={activeTab?.paymentMethod === 'Chuyển khoản'}
                    onChange={(e) => updateActiveTab((t) => ({ ...t, paymentMethod: e.target.value }))}
                    className="h-3.5 w-3.5 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                  />
                  <span>Chuyển khoản</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethodRadio"
                    value="ATM"
                    checked={activeTab?.paymentMethod === 'ATM'}
                    onChange={(e) => updateActiveTab((t) => ({ ...t, paymentMethod: e.target.value }))}
                    className="h-3.5 w-3.5 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                  />
                  <span>ATM</span>
                </label>
              </div>
              <select
                value={activeTab?.paymentAccount || ''}
                onChange={(e) => updateActiveTab((t) => ({ ...t, paymentAccount: e.target.value }))}
                className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-cyan-600 cursor-pointer"
              >
                <option value="">Chọn tài khoản-</option>
                <option value="TK-01">Vietcombank - 1012345678 (Hà Nội)</option>
                <option value="TK-02">Techcombank - 1903456789 (HCM)</option>
                <option value="TK-03">MBBank - 999988887777 (Công ty)</option>
              </select>
            </div>

            {/* ══ Light Theme Payment Summary Box ══ */}
            <div className="rounded-xl border-2 border-cyan-200 bg-cyan-50/60 p-2.5 shadow-sm space-y-1.5 text-slate-800">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Thành tiền hàng:</span>
                <span className="font-extrabold text-slate-900">{subtotal.toLocaleString('vi-VN')} đ</span>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Chiết khấu:</span>
                <input
                  type="number"
                  min="0"
                  value={activeTab?.discount || ''}
                  onChange={(e) => updateActiveTab((t) => ({ ...t, discount: Number(e.target.value) }))}
                  placeholder="0"
                  className="h-7 w-24 rounded bg-white px-2 text-right font-extrabold text-cyan-900 text-xs outline-none border border-slate-300 focus:border-cyan-600 shadow-xs"
                />
              </div>

              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Thuế VAT (%):</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={activeTab?.vatRate || ''}
                  onChange={(e) => updateActiveTab((t) => ({ ...t, vatRate: Number(e.target.value) }))}
                  placeholder="0"
                  className="h-7 w-16 rounded bg-white px-2 text-right font-extrabold text-cyan-900 text-xs outline-none border border-slate-300 focus:border-cyan-600 shadow-xs"
                />
              </div>

              <div className="border-t border-slate-300/80 pt-1.5 flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wide text-cyan-900">
                  TỔNG THÀNH TOÁN:
                </span>
                <span className="text-sm font-black text-cyan-700 tracking-tight">
                  {grandTotal.toLocaleString('vi-VN')} đ
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 pt-0.5">
                <span>Khách thanh toán:</span>
                <input
                  type="number"
                  min="0"
                  value={activeTab?.amountPaid || ''}
                  onChange={(e) => updateActiveTab((t) => ({ ...t, amountPaid: Number(e.target.value) }))}
                  placeholder={grandTotal.toString()}
                  className="h-7 w-24 rounded bg-white px-2 text-right font-extrabold text-emerald-700 text-xs outline-none border border-slate-300 focus:border-cyan-600 shadow-xs"
                />
              </div>

              {remainingDebt > 0 && (
                <div className="flex items-center justify-between text-xs font-bold text-red-600 pt-1 border-t border-slate-200">
                  <span>Ghi nợ lại:</span>
                  <span className="font-extrabold">{remainingDebt.toLocaleString('vi-VN')} đ</span>
                </div>
              )}
            </div>
          </div>

          {/* Unified Action Buttons */}
          <div className="space-y-2 pt-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => handleSaveOutboundOrder(true)}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wide text-white shadow-md hover:bg-emerald-700 transition active:scale-95 cursor-pointer"
            >
              <Printer size={18} strokeWidth={2.2} />
              <span>Lưu & In phiếu xuất</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveOutboundOrder(false)}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wide text-white shadow-md hover:bg-cyan-800 transition active:scale-95 cursor-pointer"
            >
              <Save size={18} strokeWidth={2.2} />
              <span>Lưu phiếu xuất hàng</span>
            </button>

            <button
              type="button"
              onClick={handleBackNavigation}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wide text-slate-700 hover:bg-slate-100 transition active:scale-95 cursor-pointer"
            >
              <ArrowLeft size={18} strokeWidth={2.2} />
              <span>Hủy / Quay lại</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (standalone) {
    return <MainLayout>{contentMarkup}</MainLayout>;
  }

  return contentMarkup;
}
