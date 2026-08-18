import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import CreateStockInOrderPage from './pages/CreateStockInOrderPage';
import {
  Search,
  Plus,
  X,
  XCircle,
  CheckCircle,
  Eye,
  Trash2,
  Printer,
  FileSpreadsheet,
  FileDown,
  Settings,
  Home,
  Calendar,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Pencil,
  Copy,
  ScanLine,
  UserPlus,
  Maximize2,
  Minimize2,
  FileText,
  Save,
  RotateCcw,
  Building2,
  Package,
  MapPin,
  Boxes,
  Warehouse,
} from 'lucide-react';
import BarcodeScanner, { type ScannedProduct } from '../../shared/components/BarcodeScanner';
import { usePermissions } from '../../shared/hooks/usePermissions';

const getInboundMenuId = (mode?: string) => {
  if (mode === 'purchase-order') return 'inbound-purchase-orders';
  if (mode === 'return-supplier') return 'inbound-return-requests';
  if (mode === 'return-customer') return 'inbound-return-customers';
  if (mode === 'transfer-in') return 'delivery-transfer-requests';
  if (mode === 'initial-stock') return 'inventory-initial-stock';
  if (mode === 'assembly') return 'inbound-assembly';
  return 'inbound-stock-in-orders';
};

// ─── TOAST ─────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => onClose(), 3500);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-[999] flex items-center gap-3 rounded-xl px-5 py-3 shadow-lg transition-all animate-[slideIn_0.3s_ease-out] ${
        type === 'error'
          ? 'bg-red-50 text-red-600 border border-red-200'
          : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
      }`}
    >
      {type === 'error' ? <XCircle size={20} /> : <CheckCircle size={20} />}
      <p className="text-sm font-semibold">{message}</p>
      <button onClick={onClose} className="ml-2 rounded-lg p-1 hover:bg-white/50 transition cursor-pointer">
        <X size={16} />
      </button>
    </div>
  );
}

// ─── STATUS BADGE (Nhập Kho) ───────────────────────────────────

const INBOUND_STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string }> = {
  'completed': { label: 'Đã nhập kho', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'Đã nhập kho': { label: 'Đã nhập kho', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'RECEIVED': { label: 'Đã nhập kho', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'pending': { label: 'Chờ xử lý', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  'Chờ xử lý': { label: 'Chờ xử lý', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  'CREATED': { label: 'Chờ xử lý', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  'DRAFT': { label: 'Đơn nháp', color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-300' },
  'approved': { label: 'Đã duyệt', color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200' },
  'APPROVED': { label: 'Đã duyệt', color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200' },
  'receiving': { label: 'Đang nhập kho', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
  'IN_TRANSIT': { label: 'Đang vận chuyển', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  'cancelled': { label: 'Đã hủy', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  'CANCELLED': { label: 'Đã hủy', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
};

function StatusBadge({ status }: { status?: string }) {
  const config = INBOUND_STATUS_MAP[status || ''] || INBOUND_STATUS_MAP['completed'];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold border ${config.color} ${config.bg} ${config.border}`}>
      {config.label}
    </span>
  );
}

// ─── TYPES & INTERFACES ────────────────────────────────────────

interface ProductOption {
  id: string;
  internalSku: string;
  name: string;
  unit?: string;
  purchasePrice?: number;
  salePrice?: number;
}

interface SupplierOption {
  id: string;
  supplierCode: string;
  name: string;
  phone?: string;
  address?: string;
  taxCode?: string;
}

interface UserOption {
  id: string;
  fullName?: string;
  email: string;
  role?: string;
}

interface WarehouseOption {
  id: string;
  code: string;
  name: string;
}

interface FormDetailRow {
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

interface InboundTab {
  tabId: string;
  title: string;
  id?: string;
  receiptNo: string;
  branchCode: string;
  employeeName: string;
  supplier: string;
  supplierId?: string;
  supplierPhone: string;
  supplierAddress: string;
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

export interface InboundReceiptOrder {
  id: string;
  receiptNo: string;
  poNumber?: string;
  supplier: string;
  supplierId?: string;
  supplierPhone?: string;
  supplierAddress?: string;
  warehouseCode?: string;
  employeeName?: string;
  orderDate: string;
  expectedDate?: string;
  status: string;
  description?: string;
  subtotal?: number;
  discount?: number;
  vatRate?: number;
  vatAmount?: number;
  totalAmount: number;
  amountPaid?: number;
  itemsCount: number;
  totalQty: number;
  details?: Array<{
    id?: string;
    productId: string;
    productSku?: string;
    productName?: string;
    unit?: string;
    qty: number;
    price: number;
    totalLineAmount?: number;
    warehouseCode?: string;
    locationBin?: string;
    assignedBins?: string[];
    weight?: number;
    dimensions?: string;
    volume?: number;
    note?: string;
  }>;
}

const DEFAULT_ROWS_COUNT = 50;
const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

// ─── MASTER DATA MẪU CHUẨN KHO ────────────────────────────────

const DEFAULT_FALLBACK_WAREHOUSES: WarehouseOption[] = [];

function formatWarehouseDisplay(codeOrName?: string, warehouseList: WarehouseOption[] = []): string {
  if (!codeOrName) return warehouseList[0]?.name || '-';
  const found = warehouseList.find((w) => w.code === codeOrName || w.name === codeOrName || w.id === codeOrName);
  if (found) return found.name;
  if ((codeOrName === 'SPX001' || !codeOrName) && warehouseList.length > 0) {
    return warehouseList[0].name;
  }
  return codeOrName;
}

const DEFAULT_FALLBACK_SUPPLIERS: SupplierOption[] = [];

const DEFAULT_FALLBACK_PRODUCTS: ProductOption[] = [];

const DEFAULT_FALLBACK_ORDERS: InboundReceiptOrder[] = [];

function makeEmptyRow(index: number): FormDetailRow {
  return {
    rowId: `row-${Date.now()}-${index}-${Math.random()}`,
    productId: '',
    productSku: '',
    productName: '',
    unit: '',
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

function createNewInboundTab(tabIndex = 1, currentUserName = 'Quản lý kho', defaultBranch = 'KHO-NVL'): InboundTab {
  const d = new Date();
  const dateFormatted = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;

  return {
    tabId: `tab-${Date.now()}-${tabIndex}`,
    title: `# ${tabIndex}`,
    receiptNo: '',
    branchCode: defaultBranch,
    employeeName: currentUserName || 'Quản lý kho',
    supplier: '',
    supplierPhone: '',
    supplierAddress: '',
    orderDate: dateFormatted,
    expectedDate: dateFormatted,
    description: '',
    discount: 0,
    shippingFee: 0,
    vatRate: 0,
    paymentMethod: 'Tiền mặt',
    paymentAccount: '',
    amountPaid: 0,
    status: 'completed',
    details: makeInitialRows(DEFAULT_ROWS_COUNT),
  };
}

export interface InboundProps {
  featureMode?: 'stock-in' | 'return-supplier' | 'return-customer' | 'transfer-in' | 'initial-stock' | 'purchase-order' | 'assembly';
  title?: string;
  codePrefix?: string;
  partnerLabel?: string;
}

export default function Inbound({
  featureMode = 'stock-in',
  title = 'DANH SÁCH PHIẾU NHẬP HÀNG KHO',
  codePrefix = 'PNK',
  partnerLabel = 'Nhà cung cấp',
}: InboundProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [orders, setOrders] = useState<InboundReceiptOrder[]>(DEFAULT_FALLBACK_ORDERS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [toast, setToast] = useState({ message: '', type: 'success' as 'success' | 'error' });

  // Bulk Selection & Expandable Details matching Outbound
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDetail, setShowDetail] = useState(false);

  // Date filters
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });

  // Pagination
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const [searchParams, setSearchParams] = useSearchParams();

  // Form Section Visibility (Driven strictly by URL search params e.g. ?action=create)
  const action = searchParams.get('action');
  const mode = searchParams.get('mode');
  const showFormModal = action === 'create' || action === 'edit' || action === 'view' || mode === 'create' || mode === 'edit' || mode === 'view';

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);

  const handleOpenFormModal = useCallback((modeAction: 'create' | 'edit' = 'create', id?: string) => {
    if (modeAction === 'create') {
      sessionStorage.removeItem('inbound_tabs_draft');
      sessionStorage.removeItem('inbound_active_tab_id');
    }
    if (modeAction === 'edit' && id) {
      setSearchParams({ action: 'edit', id });
    } else {
      setSearchParams({ action: 'create' });
    }
  }, [setSearchParams]);

  const handleCloseFormModal = useCallback(() => {
    sessionStorage.removeItem('inbound_tabs_draft');
    sessionStorage.removeItem('inbound_active_tab_id');
    setSearchParams({});
  }, [setSearchParams]);

  // Sync fullscreen change event listener
  useEffect(() => {
    const handleFSChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullScreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullScreen(false);
    }
  };

  // Autocomplete / Dropdown States
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [activeProductDropdownRowId, setActiveProductDropdownRowId] = useState<string | null>(null);

  // Selected Order for Detail/Print Modal
  const [selectedOrder, setSelectedOrder] = useState<InboundReceiptOrder | null>(null);

  // Master Data State
  const [products, setProducts] = useState<ProductOption[]>(DEFAULT_FALLBACK_PRODUCTS);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>(DEFAULT_FALLBACK_SUPPLIERS);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>(DEFAULT_FALLBACK_WAREHOUSES);

  const [newSupplierForm, setNewSupplierForm] = useState({ name: '', phone: '', address: '', supplierCode: '', taxCode: '' });

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const currentUserName = currentUser.fullName || currentUser.email?.split('@')[0] || 'Quản lý kho';

  const { canPerformAction, isAdmin } = usePermissions();
  const currentMenuId = getInboundMenuId(featureMode);

  const canCreate = isAdmin || canPerformAction(currentMenuId, 'create');
  const canEdit = isAdmin || canPerformAction(currentMenuId, 'edit');
  const canDelete = isAdmin || canPerformAction(currentMenuId, 'delete');
  const canPrint = isAdmin || canPerformAction(currentMenuId, 'print');
  const canExport = isAdmin || canPerformAction(currentMenuId, 'export');
  const canChangeStatus = isAdmin || canPerformAction(currentMenuId, 'status');

  // ── Column Visibility Configuration ───────────────────────────
  const DEFAULT_COLUMN_VIS = {
    branch: true,
    nv: true,
    code: true,
    date: true,
    supplierName: true,
    supplierAddress: true,
    supplierPhone: true,
    subtotal: true,
    discount: true,
    vat: true,
    totalAmount: true,
    amountPaid: true,
    note: true,
    status: true,
  };

  const COLUMN_LIST = [
    { key: 'branch', label: 'Kho' },
    { key: 'nv', label: 'NV' },
    { key: 'code', label: 'Mã' },
    { key: 'date', label: 'Ngày' },
    { key: 'supplierName', label: 'Tên NCC' },
    { key: 'supplierAddress', label: 'Địa chỉ' },
    { key: 'supplierPhone', label: 'Tel' },
    { key: 'subtotal', label: 'Thành tiền' },
    { key: 'discount', label: 'CK' },
    { key: 'vat', label: 'VAT' },
    { key: 'totalAmount', label: 'Tổng tiền' },
    { key: 'amountPaid', label: 'Thanh toán' },
    { key: 'note', label: 'Ghi chú' },
    { key: 'status', label: 'Trạng thái' },
  ];

  const [columnVis, setColumnVis] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('inbound_column_vis');
      return saved ? { ...DEFAULT_COLUMN_VIS, ...JSON.parse(saved) } : DEFAULT_COLUMN_VIS;
    } catch {
      return DEFAULT_COLUMN_VIS;
    }
  });

  useEffect(() => {
    localStorage.setItem('inbound_column_vis', JSON.stringify(columnVis));
  }, [columnVis]);

  // Synchronous Multi-Tab Initialization
  const [tabs, setTabs] = useState<InboundTab[]>(() => {
    return [createNewInboundTab(1, currentUserName)];
  });
  const [activeTabId, setActiveTabId] = useState<string>(() => (tabs && tabs[0] ? tabs[0].tabId : ''));

  // ── 1. Fetch Master Data & Inbound Orders ─────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordRes, supRes, prodRes, userRes, whRes] = await Promise.all([
        fetch(`${API_BASE_URL}/inbound/purchase-orders`, { headers: authHeaders() }).catch(() => null),
        fetch(`${API_BASE_URL}/suppliers`, { headers: authHeaders() }).catch(() => null),
        fetch(`${API_BASE_URL}/products`, { headers: authHeaders() }).catch(() => null),
        fetch(`${API_BASE_URL}/users`, { headers: authHeaders() }).catch(() => null),
        fetch(`${API_BASE_URL}/warehouses`, { headers: authHeaders() }).catch(() => null),
      ]);

      if (ordRes && ordRes.ok) {
        const raw = await ordRes.json();
        const list = Array.isArray(raw) ? raw : raw.data || [];
        if (list.length > 0) {
          const formatted: InboundReceiptOrder[] = list.map((item: any, idx: number) => ({
            id: String(item.id || idx),
            receiptNo: item.poNumber || item.receiptNo || `PNK-${1000 + idx}`,
            supplier: item.supplierName || item.supplier?.name || 'Nhà cung cấp',
            supplierId: item.supplierId || item.supplier?.id,
            supplierPhone: item.supplier?.phone || '',
            supplierAddress: item.supplier?.address || '',
            warehouseCode: item.warehouseCode || item.details?.[0]?.warehouseCode || item.warehouse?.code || item.warehouseId || 'KHO-NVL',
            employeeName: item.creatorName || currentUserName,
            orderDate: item.orderDate || item.createdAt ? new Date(item.orderDate || item.createdAt).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN'),
            expectedDate: item.expectedDate ? new Date(item.expectedDate).toLocaleString('vi-VN') : '',
            status: item.status || 'completed',
            description: item.description || '',
            subtotal: Number(item.totalAmount || 0),
            discount: Number(item.discount || 0),
            vatAmount: Number(item.vatAmount || 0),
            totalAmount: Number(item.totalAmount || 0),
            amountPaid: Number(item.amountPaid || item.totalAmount || 0),
            itemsCount: item.details?.length || item.items || 1,
            totalQty: item.details?.reduce((s: number, d: any) => s + (Number(d.expectedQty || d.receivedQty || d.qty || 1)), 0) || 1,
            details: item.details?.map((d: any) => ({
              id: d.id,
              productId: d.productId || d.product?.id,
              productSku: d.product?.internalSku || d.sku || d.productSku || 'SKU',
              productName: d.product?.name || d.productName || 'Sản phẩm',
              unit: d.product?.unit || d.unit || 'Cái',
              qty: Number(d.receivedQty || d.expectedQty || d.qty || 1),
              price: Number(d.unitPrice || d.price || 0),
              discountPercent: Number(d.discountPercent || 0),
              vatPercent: Number(d.vatPercent || 0),
              totalLineAmount: Number(d.totalLineAmount || (Number(d.expectedQty || d.receivedQty || d.qty || 1) * Number(d.unitPrice || d.price || 0)) || 0),
            })) || [],
          }));
          setOrders(formatted);
        } else {
          setOrders(DEFAULT_FALLBACK_ORDERS);
        }
      }

      if (supRes && supRes.ok) {
        const sData = await supRes.json();
        const sList = Array.isArray(sData) ? sData : sData.data || [];
        if (sList.length > 0) {
          const normalizedSup = sList.map((s: any) => ({
            id: String(s.id),
            supplierCode: s.supplierCode || '',
            name: s.name || '',
            phone: s.phone || '',
            address: s.address || '',
            taxCode: s.taxCode || '',
          }));
          setSuppliers(normalizedSup);
        }
      }

      if (prodRes && prodRes.ok) {
        const pData = await prodRes.json();
        const pList = Array.isArray(pData) ? pData : pData.data || [];
        if (pList.length > 0) {
          const normalized = pList.map((p: any) => ({
            id: String(p.id),
            internalSku: p.internalSku || p.sku || '',
            name: p.name || '',
            unit: p.unit || 'Cái',
            purchasePrice: Number(p.importPrice || p.purchasePrice || p.price || 0),
            salePrice: Number(p.retailPrice || p.salePrice || p.price || 0),
          }));
          setProducts(normalized);
        }
      }

      if (userRes && userRes.ok) {
        const uData = await userRes.json();
        const uList = Array.isArray(uData) ? uData : uData.data || [];
        if (uList.length > 0) setUsers(uList);
      }

      if (whRes && whRes.ok) {
        const wData = await whRes.json();
        const wList = Array.isArray(wData) ? wData : wData.data || [];
        if (wList.length > 0) {
          setWarehouses(wList);
          setTabs((prev) =>
            prev.map((t) => (t.branchCode === 'SPX001' ? { ...t, branchCode: wList[0].code || 'KHO-NVL' } : t))
          );
        }
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu Nhập Kho:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUserName]);

  useEffect(() => {
    loadData();
  }, [loadData, showFormModal, location.pathname, location.search]);

  // Click outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('.supplier-dropdown-container') && !target.closest('.product-dropdown-container')) {
        setShowSupplierDropdown(false);
        setActiveProductDropdownRowId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset Sample Data Function
  const handleResetSampleData = () => {
    if (!confirm('Bạn có chắc chắn muốn RESET và làm sạch toàn bộ dữ liệu về dữ liệu mẫu chuẩn Nhập kho?')) return;
    setOrders(DEFAULT_FALLBACK_ORDERS);
    setWarehouses(DEFAULT_FALLBACK_WAREHOUSES);
    setSuppliers(DEFAULT_FALLBACK_SUPPLIERS);
    setProducts(DEFAULT_FALLBACK_PRODUCTS);
    setSelectedIds(new Set());
    setToast({ message: 'Đã Reset thành công toàn bộ Dữ liệu mẫu Nhập Kho chuẩn!', type: 'success' });
  };

  // ── 2. Active Tab Management & Calculation ────────────────────

  const activeTab = useMemo(() => {
    return (tabs && tabs.find((t) => t.tabId === activeTabId)) || (tabs && tabs[0]) || createNewInboundTab(1, currentUserName);
  }, [tabs, activeTabId, currentUserName]);

  const updateActiveTab = useCallback((updater: (tab: InboundTab) => InboundTab) => {
    setTabs((prevTabs) =>
      prevTabs.map((t) => (t.tabId === activeTabId ? updater(t) : t))
    );
  }, [activeTabId]);

  const handleAddTab = () => {
    const newTabNum = tabs.length + 1;
    const newTab = createNewInboundTab(newTabNum, currentUserName);
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.tabId);
  };

  const handleCloseTab = (tabIdToClose: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) {
      handleCloseFormModal();
      return;
    }
    const newTabs = tabs.filter((t) => t.tabId !== tabIdToClose);
    setTabs(newTabs);
    if (activeTabId === tabIdToClose) {
      setActiveTabId(newTabs[newTabs.length - 1].tabId);
    }
  };

  // Tab Details Summary Calculations
  const tabCalculations = useMemo(() => {
    if (!activeTab || !activeTab.details) return { totalQty: 0, subtotal: 0, discountVal: 0, vatVal: 0, grandTotal: 0, debt: 0 };
    const validRows = activeTab.details.filter((r) => r && (r.productId || r.productName || r.productSku));
    const totalQty = validRows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
    const subtotal = validRows.reduce((sum, r) => sum + (Number(r.totalAmount) || (Number(r.qty) * Number(r.price))), 0);
    const discountVal = activeTab.discount || 0;
    const afterDiscount = subtotal - discountVal;
    const vatVal = (afterDiscount * (activeTab.vatRate || 0)) / 100;
    const grandTotal = Math.max(0, afterDiscount + (activeTab.shippingFee || 0) + vatVal);
    const debt = Math.max(0, grandTotal - (activeTab.amountPaid || 0));

    return { totalQty, subtotal, discountVal, vatVal, grandTotal, debt };
  }, [activeTab]);

  // ── 3. Table Row Operations ──────────────────────────────────

  const handleRowProductChange = (rowId: string, product: ProductOption) => {
    updateActiveTab((tab) => {
      const updatedDetails = tab.details.map((row) => {
        if (row.rowId !== rowId) return row;
        const qty = row.qty === 0 ? 1 : row.qty;
        const price = product.purchasePrice || product.salePrice || 0;
        const totalAmount = qty * price;
        return {
          ...row,
          productId: product.id,
          productSku: product.internalSku,
          productName: product.name,
          unit: product.unit || 'Cái',
          price,
          qty,
          totalAmount,
        };
      });
      return { ...tab, details: updatedDetails };
    });
    setActiveProductDropdownRowId(null);
  };

  const handleRowFieldChange = (rowId: string, patch: Partial<FormDetailRow>) => {
    updateActiveTab((tab) => {
      const updatedDetails = tab.details.map((row) => {
        if (row.rowId !== rowId) return row;
        const updated = { ...row, ...patch };
        const qty = Number(updated.qty) || 0;
        const price = Number(updated.price) || 0;
        const discPct = Number(updated.discountPercent) || 0;
        const lineTotal = qty * price * (1 - discPct / 100);
        updated.totalAmount = Math.max(0, lineTotal);
        return updated;
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

  const handleRemoveRow = (rowId: string) => {
    updateActiveTab((tab) => ({
      ...tab,
      details: tab.details.filter((r) => r.rowId !== rowId),
    }));
  };

  const getFilteredProductsForRow = (rowText: string) => {
    const kw = (rowText || '').trim().toLowerCase();
    if (!kw) return products;
    const matched = products.filter(
      (p) => p.name.toLowerCase().includes(kw) || p.internalSku.toLowerCase().includes(kw)
    );
    const nonMatched = products.filter((p) => !matched.includes(p));
    return [...matched, ...nonMatched];
  };

  const filteredSuppliers = useMemo(() => {
    const kw = supplierSearch.trim().toLowerCase();
    if (!kw) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(kw) ||
        (s.supplierCode || '').toLowerCase().includes(kw) ||
        (s.phone || '').toLowerCase().includes(kw)
    );
  }, [suppliers, supplierSearch]);

  const handleProductScanned = (scanned: ScannedProduct) => {
    if (!activeTabId) return;
    if (!scanned || scanned.isExternal || scanned.id === 'NEW' || !scanned.name) {
      setToast({ message: 'Chưa có sản phẩm này', type: 'error' });
      return;
    }

    const barcodeVal = scanned.internalSku || scanned.supplierBarcode || '';
    const price = scanned.purchasePrice || 50000;
    let finalQty = 1;

    updateActiveTab((tab) => {
      const details = [...tab.details];
      const existingIdx = details.findIndex(
        (r) =>
          (r.productId && r.productId === scanned.id) ||
          (r.productSku && barcodeVal && r.productSku.toLowerCase() === barcodeVal.toLowerCase()) ||
          (r.productName && scanned.name && r.productName.toLowerCase() === scanned.name.toLowerCase())
      );

      if (existingIdx !== -1) {
        const row = details[existingIdx];
        const newQty = (Number(row.qty) || 0) + 1;
        finalQty = newQty;
        const linePrice = Number(row.price) || price;
        const discPct = Number(row.discountPercent) || 0;
        const lineTotal = newQty * linePrice * (1 - discPct / 100);
        details[existingIdx] = {
          ...row,
          qty: newQty,
          totalAmount: Math.max(0, lineTotal),
        };
      } else {
        const emptyIdx = details.findIndex((r) => !r.productId && !r.productName);
        const newRow: FormDetailRow = {
          rowId: `row-${Date.now()}-${Math.random()}`,
          productId: scanned.id,
          productSku: barcodeVal,
          productName: scanned.name || '',
          unit: scanned.unit || 'Cái',
          qty: 1,
          price,
          discountPercent: 0,
          discountAmount: 0,
          vatPercent: 0,
          vatAmount: 0,
          totalAmount: price,
          note: 'Quét Barcode',
        };

        if (emptyIdx !== -1) {
          details[emptyIdx] = newRow;
        } else {
          details.push(newRow);
        }
      }
      return { ...tab, details };
    });
    setShowScannerModal(false);
    setToast({ message: `Đã quét: ${scanned.name} (Số lượng: ${finalQty})`, type: 'success' });
  };

  const handleCreateSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierForm.name.trim()) {
      setToast({ message: 'Vui lòng nhập tên nhà cung cấp', type: 'error' });
      return;
    }
    const newSup: SupplierOption = {
      id: `sup-${Date.now()}`,
      supplierCode: newSupplierForm.supplierCode || `NCC${Date.now().toString().slice(-4)}`,
      name: newSupplierForm.name,
      phone: newSupplierForm.phone,
      address: newSupplierForm.address,
      taxCode: newSupplierForm.taxCode,
    };
    setSuppliers((prev) => [newSup, ...prev]);
    updateActiveTab((tab) => ({
      ...tab,
      supplierId: newSup.id,
      supplier: newSup.name,
      supplierPhone: newSup.phone || '',
      supplierAddress: newSup.address || '',
    }));
    setShowAddSupplierModal(false);
    setNewSupplierForm({ name: '', phone: '', address: '', supplierCode: '', taxCode: '' });
    setToast({ message: `Đã thêm nhà cung cấp: ${newSup.name}`, type: 'success' });
  };

  const handleEditOrder = (ord: InboundReceiptOrder) => {
    const isDraft = ['DRAFT', 'draft', 'Đơn nháp'].includes(ord.status || '');
    if (!isDraft) {
      setToast({
        message: 'Chỉ có thể chỉnh sửa phiếu nhập kho ở trạng thái Đơn nháp (DRAFT). Phiếu đã lưu chính thức không thể chỉnh sửa!',
        type: 'error',
      });
      return;
    }

    const existingDetails: FormDetailRow[] = ord.details && ord.details.length > 0
      ? ord.details.map((d, idx) => ({
          rowId: `row-edit-${idx}-${Date.now()}`,
          productId: d.productId,
          productSku: d.productSku || '',
          productName: d.productName || '',
          unit: d.unit || 'Cái',
          qty: d.qty,
          price: d.price,
          discountPercent: 0,
          discountAmount: 0,
          vatPercent: 0,
          vatAmount: 0,
          totalAmount: d.totalLineAmount || (d.qty * d.price),
          note: '',
        }))
      : [];

    const paddedDetails = [
      ...existingDetails,
      ...Array.from({ length: Math.max(0, DEFAULT_ROWS_COUNT - existingDetails.length) }, (_, i) =>
        makeEmptyRow(existingDetails.length + i)
      ),
    ];

    updateActiveTab((t) => ({
      ...t,
      id: ord.id,
      receiptNo: ord.receiptNo,
      supplier: ord.supplier,
      supplierId: ord.supplierId,
      supplierPhone: ord.supplierPhone || '',
      supplierAddress: ord.supplierAddress || '',
      branchCode: ord.warehouseCode || 'KHO-TONG',
      employeeName: ord.employeeName || currentUserName,
      orderDate: ord.orderDate,
      description: ord.description || '',
      details: paddedDetails,
    }));
    handleOpenFormModal('edit', ord.id);
  };

  const handleViewDetail = async (ord: InboundReceiptOrder, openLocationOnly = false) => {
    try {
      const res = await fetch(`${API_BASE_URL}/inbound/purchase-orders/${ord.id}`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const fullPO = await res.json();
        const rawDetails = fullPO.details || fullPO.items || [];
        const formattedDetails = rawDetails.map((d: any) => {
          const productSku = d.product?.internalSku || d.productSku || d.sku || 'SKU';
          const productName = d.product?.name || d.productName || 'Sản phẩm';
          const unit = d.product?.unit || d.unit || 'Cái';
          const qty = Number(d.receivedQty || d.expectedQty || d.qty || 1);
          const price = Number(d.unitPrice || d.price || 0);

          let parsedLocationBin = d.locationBin || '';
          if (!parsedLocationBin && d.note && d.note.includes('[Vị trí Ô:')) {
            const match = d.note.match(/\[Vị trí Ô:\s*([^\]]+)\]/);
            if (match && match[1]) {
              parsedLocationBin = match[1];
            }
          }
          if (!parsedLocationBin && Array.isArray(d.assignedBins) && d.assignedBins.length > 0) {
            parsedLocationBin = d.assignedBins.join(', ');
          }
          if (!parsedLocationBin) {
            parsedLocationBin = d.warehouseCode || fullPO.warehouseCode || ord.warehouseCode || 'KHO-NVL';
          }

          return {
            id: d.id,
            productId: d.productId || d.product?.id,
            productSku,
            productName,
            unit,
            qty,
            price,
            discountPercent: Number(d.discountPercent || 0),
            vatPercent: Number(d.vatPercent || 0),
            totalLineAmount: Number(d.totalLineAmount || (qty * price) || 0),
            warehouseCode: d.warehouseCode || fullPO.warehouseCode || ord.warehouseCode || 'KHO-NVL',
            locationBin: parsedLocationBin,
            assignedBins: Array.isArray(d.assignedBins) ? d.assignedBins : (parsedLocationBin ? parsedLocationBin.split(',').map((s: string) => s.trim()) : []),
            weight: d.weight,
            dimensions: d.length && d.width && d.height ? `${d.length}x${d.width}x${d.height} cm` : '',
            volume: d.volume,
            note: d.note || '',
          };
        });

        const updatedOrd: InboundReceiptOrder = {
          ...ord,
          supplier: fullPO.supplierName || fullPO.supplier?.name || ord.supplier,
          warehouseCode: fullPO.warehouseCode || ord.warehouseCode,
          totalAmount: Number(fullPO.totalAmount || ord.totalAmount),
          details: formattedDetails,
        };

        setSelectedOrder(updatedOrd);
        if (openLocationOnly) {
          setShowLocationModal(true);
        } else {
          setSearchParams({ action: 'view', id: ord.id });
        }
        return;
      }
    } catch (err) {
      console.error('Lỗi tải chi tiết đơn nhập:', err);
    }

    setSelectedOrder(ord);
    if (openLocationOnly) {
      setShowLocationModal(true);
    } else {
      setSearchParams({ action: 'view', id: ord.id });
    }
  };

  // Bulk Actions
  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedOrders.length && paginatedOrders.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedOrders.map((o) => o.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      setToast({ message: 'Vui lòng chọn ít nhất 1 phiếu để xóa', type: 'error' });
      return;
    }
    if (!confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.size} phiếu nhập đã chọn?`)) return;

    try {
      for (const id of selectedIds) {
        if (/^\d+$/.test(id)) {
          await fetch(`${API_BASE_URL}/inbound/purchase-orders/${id}`, {
            method: 'DELETE',
            headers: authHeaders(),
          }).catch(() => null);
        }
      }
    } catch {}

    setOrders((prev) => prev.filter((o) => !selectedIds.has(o.id)));
    setSelectedIds(new Set());
    setToast({ message: `Đã xóa thành công ${selectedIds.size} phiếu nhập`, type: 'success' });
    loadData();
  };

  const handleDeleteSingleOrder = async (ord: InboundReceiptOrder) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa phiếu nhập ${ord.receiptNo}?`)) return;
    try {
      if (/^\d+$/.test(ord.id)) {
        await fetch(`${API_BASE_URL}/inbound/purchase-orders/${ord.id}`, {
          method: 'DELETE',
          headers: authHeaders(),
        }).catch(() => null);
      }
    } catch {}

    setOrders((prev) => prev.filter((o) => o.id !== ord.id));
    setToast({ message: `Đã xóa thành công phiếu nhập ${ord.receiptNo}`, type: 'success' });
    loadData();
  };

  const handleCopySelected = () => {
    if (selectedIds.size === 0) {
      setToast({ message: 'Vui lòng chọn 1 phiếu nhập để sao chép', type: 'error' });
      return;
    }
    const firstId = Array.from(selectedIds)[0];
    const source = orders.find((o) => o.id === firstId);
    if (!source) return;
    handleEditOrder(source);
    updateActiveTab((t) => ({
      ...t,
      id: undefined,
      title: `# COPY`,
      receiptNo: '',
    }));
    setToast({ message: `Đã sao chép phiếu nhập ${source.receiptNo}`, type: 'success' });
  };

  // ── 4. Save & Create Inbound Order ────────────────────────────

  const handleSaveInboundOrder = async (isPrint = false) => {
    if (!activeTab) return;
    const validItems = activeTab.details.filter((r) => (r.productId || r.productName.trim() || r.productSku.trim()) && r.qty > 0);
    if (validItems.length === 0) {
      setToast({ message: 'Vui lòng chọn ít nhất 1 sản phẩm với số lượng > 0', type: 'error' });
      return;
    }

    const subtotal = validItems.reduce((s, r) => s + (Number(r.totalAmount) || (Number(r.qty) * Number(r.price))), 0);
    const vatAmount = (subtotal * (activeTab.vatRate || 0)) / 100;
    const grandTotal = Math.max(0, subtotal - (activeTab.discount || 0) + (activeTab.shippingFee || 0) + vatAmount);

    const payload = {
      poNumber: activeTab.receiptNo.trim() || undefined,
      receiptNo: activeTab.receiptNo.trim() || undefined,
      receiptType: featureMode,
      supplierId: activeTab.supplierId || suppliers[0]?.id,
      supplierName: activeTab.supplier || suppliers[0]?.name || 'Nhà cung cấp',
      warehouseCode: activeTab.branchCode || 'KHO-TONG',
      branchCode: activeTab.branchCode || 'KHO-TONG',
      orderDate: activeTab.orderDate,
      expectedDate: activeTab.expectedDate,
      status: activeTab.status || 'RECEIVED',
      description: activeTab.description || 'Tạo phiếu nhập hàng trực tiếp',
      totalAmount: grandTotal,
      subtotal,
      discount: activeTab.discount || 0,
      vatAmount,
      amountPaid: activeTab.amountPaid || grandTotal,
      details: validItems.map((r) => ({
        productId: r.productId,
        productSku: r.productSku,
        productName: r.productName,
        unit: r.unit,
        warehouseCode: (activeTab.branchCode && activeTab.branchCode !== 'SPX001') ? activeTab.branchCode : (warehouses[0]?.code || 'KHO-NVL'),
        expectedQty: Number(r.qty),
        receivedQty: Number(r.qty),
        qty: Number(r.qty),
        unitPrice: Number(r.price),
        price: Number(r.price),
      })),
      items: validItems.map((r) => ({
        productId: r.productId,
        productSku: r.productSku,
        productName: r.productName,
        unit: r.unit,
        warehouseCode: (activeTab.branchCode && activeTab.branchCode !== 'SPX001') ? activeTab.branchCode : (warehouses[0]?.code || 'KHO-NVL'),
        expectedQty: Number(r.qty),
        receivedQty: Number(r.qty),
        qty: Number(r.qty),
        unitPrice: Number(r.price),
        price: Number(r.price),
      })),
    };

    const isEdit = !!activeTab.id;
    const recordId = activeTab.id || `ord-${Date.now()}`;

    const newRecord: InboundReceiptOrder = {
      id: recordId,
      receiptNo: payload.poNumber || 'PNK_TỰ_ĐỘNG',
      supplier: payload.supplierName,
      supplierId: payload.supplierId,
      supplierPhone: activeTab.supplierPhone || '',
      supplierAddress: activeTab.supplierAddress || '',
      warehouseCode: (activeTab.branchCode && activeTab.branchCode !== 'SPX001') ? activeTab.branchCode : (warehouses[0]?.code || 'KHO-NVL'),
      employeeName: activeTab.employeeName || currentUserName,
      orderDate: activeTab.orderDate || new Date().toLocaleString('vi-VN'),
      status: activeTab.status || 'completed',
      description: activeTab.description,
      subtotal,
      discount: activeTab.discount || 0,
      vatAmount,
      totalAmount: grandTotal,
      amountPaid: activeTab.amountPaid || grandTotal,
      itemsCount: validItems.length,
      totalQty: validItems.reduce((sum, r) => sum + Number(r.qty), 0),
      details: validItems.map((r) => ({
        productId: r.productId,
        productSku: r.productSku || 'SKU',
        productName: r.productName || 'Sản phẩm',
        unit: r.unit || 'Cái',
        qty: Number(r.qty),
        price: Number(r.price),
        totalLineAmount: Number(r.totalAmount) || (Number(r.qty) * Number(r.price)),
      })),
    };

    try {
      const url = isEdit
        ? `${API_BASE_URL}/inbound/purchase-orders/${activeTab.id}`
        : `${API_BASE_URL}/inbound/purchase-orders`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload),
      }).catch(() => null);

      if (res && res.ok) {
        const savedData = await res.json();
        if (savedData && (savedData.poNumber || savedData.receiptNo)) {
          newRecord.receiptNo = savedData.poNumber || savedData.receiptNo;
          newRecord.id = String(savedData.id || newRecord.id);
        }
      }

      setOrders((prev) => {
        if (isEdit) {
          return prev.map((o) => (o.id === activeTab.id ? newRecord : o));
        } else {
          return [newRecord, ...prev];
        }
      });

      setToast({
        message: isEdit ? `Đã cập nhật thành công phiếu ${newRecord.receiptNo}!` : `Đã lưu thành công phiếu ${newRecord.receiptNo}!`,
        type: 'success',
      });

      loadData();

      if (isPrint) {
        setSelectedOrder(newRecord);
        setShowPrintModal(true);
      }

      handleCloseFormModal();
    } catch (err: any) {
      setToast({ message: err.message || 'Lỗi khi kết nối máy chủ', type: 'error' });
    }
  };

  // ── 5. List Filtering & Pagination ─────────────────────────────

  const filteredOrders = useMemo(() => {
    return (orders || []).filter((o) => {
      if (!o) return false;
      const matchSearch =
        !search.trim() ||
        (o.receiptNo || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.supplier || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.employeeName || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.supplierPhone || '').toLowerCase().includes(search.toLowerCase());

      const matchStatus =
        statusFilter === 'all' ||
        (o.status || '').toLowerCase() === statusFilter.toLowerCase();

      return matchSearch && matchStatus;
    });
  }, [orders, search, statusFilter]);

  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  if (showFormModal) {
    return <CreateStockInOrderPage standalone={false} onBack={handleCloseFormModal} />;
  }

  return (
    <div className={`space-y-6 ${isFullScreen ? 'fixed inset-0 z-[9000] bg-white overflow-y-auto p-6' : ''}`}>
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />

      <div className="space-y-6 animate-in fade-in duration-200">
          {/* Top Header Section matching Outbound */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2.5 rounded-2xl bg-cyan-600 px-5 py-2.5 text-white shadow-md">
                <Package className="h-5 w-5" />
                <h1 className="text-xl font-extrabold tracking-tight">{title}</h1>
              </div>
            </div>

            {/* Action Buttons Top Right aligned in Cyan style */}
            <div className="flex flex-wrap items-center gap-3">
              {/* 1. Thêm mới */}
              {canCreate && (
                <button
                  type="button"
                  onClick={() => {
                    if (featureMode === 'transfer-in') {
                      navigate('/delivery/create-transfer-order');
                      return;
                    }
                    handleOpenFormModal('create');
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
                >
                  <Plus className="h-4.5 w-4.5 text-cyan-700" />
                  Thêm mới
                </button>
              )}

              {/* 2. Copy */}
              {canCreate && (
                <button
                  type="button"
                  onClick={handleCopySelected}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
                >
                  <Copy className="h-4.5 w-4.5 text-cyan-700" />
                  Copy {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                </button>
              )}

              {/* 3. Xóa */}
              {canDelete && (
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
                >
                  <Trash2 className="h-4.5 w-4.5 text-cyan-700" />
                  Xóa {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                </button>
              )}

              {/* 4. In báo cáo */}
              {canPrint && (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
                >
                  <Printer className="h-4.5 w-4.5 text-cyan-700" />
                  In báo cáo
                </button>
              )}

              {/* 5. Export Excel */}
              {canExport && (
                <button
                  type="button"
                  onClick={() => {
                    const header = ['STT', 'Kho', 'NV', 'Mã Phiếu', 'Ngày Nhập', 'Nhà Cung Cấp', 'Địa Chỉ', 'SĐT', 'Thành Tiền', 'Chiết Khấu', 'VAT', 'Tổng Tiền', 'Thanh Toán', 'Trạng Thái'];
                    const rows = filteredOrders.map((o, idx) => [
                      idx + 1,
                      formatWarehouseDisplay(o.warehouseCode, warehouses),
                      o.employeeName || currentUserName,
                      o.receiptNo,
                      o.orderDate,
                      o.supplier,
                      o.supplierAddress || '',
                      o.supplierPhone || '',
                      o.subtotal || o.totalAmount,
                      o.discount || 0,
                      o.vatAmount || 0,
                      o.totalAmount,
                      o.amountPaid || o.totalAmount,
                      o.status,
                    ]);
                    const csv = [header, ...rows].map((r) => r.map((cell) => `"${cell}"`).join(',')).join('\n');
                    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `nhap_kho_${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
                >
                  <FileSpreadsheet className="h-4.5 w-4.5 text-cyan-700" />
                  Export Excel
                </button>
              )}

              {/* 6. Settings */}
              <button
                type="button"
                onClick={() => setShowColumnSettings(true)}
                className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border-2 border-cyan-700 bg-white text-cyan-700 font-extrabold text-sm shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
                title="Cấu hình hiển thị cột"
              >
                <Settings className="h-4.5 w-4.5 text-cyan-700" />
                <span>Hiển thị</span>
              </button>

              {/* 7. Toàn màn hình */}
              <button
                type="button"
                onClick={toggleBrowserFullscreen}
                className="inline-flex items-center justify-center h-10 w-10 rounded-xl border-2 border-slate-300 bg-white text-slate-700 shadow-xs transition hover:bg-slate-100 active:scale-95 cursor-pointer"
                title="Toàn màn hình"
              >
                {isFullScreen ? <Minimize2 className="h-4.5 w-4.5" /> : <Maximize2 className="h-4.5 w-4.5" />}
              </button>
            </div>
          </div>

          {/* Filter & Search Panel */}
          <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {/* Search input - Matching height (h-12) with Date & Status filters */}
              <div className="relative flex-1 min-w-[320px]">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-cyan-600" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-12 w-full rounded-xl border-2 border-cyan-600/40 bg-white pl-11 pr-4 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-2xs"
                  placeholder="Tìm theo mã phiếu nhập, nhà cung cấp, SĐT, nhân viên..."
                />
              </div>

              {/* Date & Status Filters Container */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Date Filter Box (h-12) */}
                <div className="inline-flex h-12 items-center gap-3 rounded-xl border-2 border-cyan-600/30 bg-slate-50/80 px-3.5 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4.5 w-4.5 text-cyan-600 shrink-0" />
                    <span className="text-xs font-extrabold uppercase text-cyan-950 tracking-wide">Thời gian:</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-600">Từ</span>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="h-9 rounded-lg border-2 border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-600">Đến</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="h-9 rounded-lg border-2 border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Status Filter Box (h-12) */}
                <div className="inline-flex h-12 items-center gap-2 rounded-xl border-2 border-cyan-600/30 bg-slate-50/80 px-3.5 shadow-2xs">
                  <Filter className="h-4 w-4 text-cyan-600 shrink-0" />
                  <span className="text-xs font-extrabold uppercase text-cyan-950 tracking-wide">Trạng thái:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-9 rounded-lg border-2 border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
                  >
                    <option value="all">Tất cả</option>
                    <option value="completed">Đã nhập kho</option>
                    <option value="pending">Chờ xử lý</option>
                    <option value="approved">Đã duyệt</option>
                    <option value="cancelled">Đã hủy</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Main Order List Table */}
          <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[1850px] border-collapse text-left">
                <thead className="bg-cyan-50 sticky top-0 z-20 shadow-sm">
                  <tr className="border-b-2 border-slate-200 text-slate-800 font-extrabold uppercase text-xs sm:text-sm tracking-wider">
                    <th className="w-12 min-w-[50px] border-r border-slate-200 px-2 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={paginatedOrders.length > 0 && selectedIds.size === paginatedOrders.length}
                        onChange={toggleSelectAll}
                        className="h-4.5 w-4.5 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                      />
                    </th>
                    <th className="w-14 min-w-[60px] border-r border-slate-200 px-3 py-4 text-center">STT</th>
                    {columnVis.code && <th className="min-w-[210px] border-r border-slate-200 px-4 py-4 text-center whitespace-nowrap">Mã phiếu</th>}
                    {columnVis.date && <th className="min-w-[130px] border-r border-slate-200 px-3 py-4 text-center">Ngày nhập</th>}
                    {columnVis.supplierName && <th className="min-w-[220px] border-r border-slate-200 px-4 py-4 text-center">Nhà cung cấp</th>}
                    {columnVis.supplierPhone && <th className="min-w-[130px] border-r border-slate-200 px-3 py-4 text-center">SĐT</th>}
                    {columnVis.supplierAddress && <th className="min-w-[240px] border-r border-slate-200 px-4 py-4 text-center">Địa chỉ</th>}
                    {columnVis.branch && <th className="min-w-[150px] border-r border-slate-200 px-3 py-4 text-center">Kho</th>}
                    {columnVis.nv && <th className="min-w-[150px] border-r border-slate-200 px-3 py-4 text-center">Nhân viên</th>}
                    {columnVis.subtotal && <th className="min-w-[140px] border-r border-slate-200 px-3 py-4 text-center">Thành tiền</th>}
                    {columnVis.discount && <th className="min-w-[120px] border-r border-slate-200 px-3 py-4 text-center">Chiết khấu</th>}
                    {columnVis.vat && <th className="min-w-[110px] border-r border-slate-200 px-3 py-4 text-center">VAT</th>}
                    {columnVis.totalAmount && <th className="min-w-[150px] border-r border-slate-200 px-3 py-4 text-center">Tổng tiền</th>}
                    {columnVis.amountPaid && <th className="min-w-[150px] border-r border-slate-200 px-3 py-4 text-center">Thanh toán</th>}
                    {columnVis.note && <th className="min-w-[180px] border-r border-slate-200 px-4 py-4 text-center">Ghi chú</th>}
                    {columnVis.status && <th className="min-w-[140px] border-r border-slate-200 px-3 py-4 text-center">Trạng thái</th>}
                    <th className="sticky right-0 top-0 z-30 w-56 min-w-[210px] bg-cyan-100 px-3 py-4 text-center shadow-[-4px_0_12px_rgba(0,0,0,0.05)] border-l border-slate-200 text-cyan-950 font-black">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={17} className="py-12 text-center text-slate-500 font-semibold text-sm">
                        Đang tải danh sách phiếu nhập kho...
                      </td>
                    </tr>
                  ) : paginatedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={17} className="py-12 text-center text-slate-500 font-semibold text-sm">
                        Không tìm thấy phiếu nhập kho nào
                      </td>
                    </tr>
                  ) : (
                    paginatedOrders.map((ord, index) => {
                      const isSelected = selectedIds.has(ord.id);
                      return (
                        <React.Fragment key={ord.id}>
                          <tr className={`group transition cursor-pointer border-b border-slate-200 ${isSelected ? 'bg-cyan-100/60' : 'hover:bg-cyan-50/60'}`}>
                            <td className="border-r border-slate-200 px-2 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectOne(ord.id)}
                                className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                              />
                            </td>
                            <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-medium text-slate-700">
                              {(currentPage - 1) * pageSize + index + 1}
                            </td>
                            {columnVis.code && (
                              <td className="border-r border-slate-200 px-4 py-3.5 text-sm font-extrabold text-cyan-700 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSearchParams({ action: 'view', id: ord.id });
                                  }}
                                  className="text-cyan-700 hover:text-cyan-900 hover:underline font-extrabold text-left cursor-pointer whitespace-nowrap"
                                  title="Bấm để xem thông tin chi tiết đơn nhập"
                                >
                                  {ord.receiptNo}
                                </button>
                              </td>
                            )}
                            {columnVis.date && <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-medium text-slate-700">{ord.orderDate}</td>}
                            {columnVis.supplierName && <td className="border-r border-slate-200 px-4 py-3.5 text-sm font-extrabold text-slate-800">{ord.supplier}</td>}
                            {columnVis.supplierPhone && <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-medium text-slate-700">{ord.supplierPhone || '-'}</td>}
                            {columnVis.supplierAddress && <td className="border-r border-slate-200 px-4 py-3.5 text-sm font-medium text-slate-700 max-w-[240px] truncate" title={ord.supplierAddress}>{ord.supplierAddress || '-'}</td>}
                            {columnVis.branch && (
                              <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-bold text-slate-800">
                                {formatWarehouseDisplay(ord.warehouseCode, warehouses)}
                              </td>
                            )}
                            {columnVis.nv && <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-medium text-slate-700">{ord.employeeName || currentUserName}</td>}
                            {columnVis.subtotal && <td className="border-r border-slate-200 px-3 py-3.5 text-right text-sm font-bold text-slate-800">{(ord.subtotal || ord.totalAmount).toLocaleString('vi-VN')} đ</td>}
                            {columnVis.discount && <td className="border-r border-slate-200 px-3 py-3.5 text-right text-sm font-medium text-slate-600">{(ord.discount || 0).toLocaleString('vi-VN')}</td>}
                            {columnVis.vat && <td className="border-r border-slate-200 px-3 py-3.5 text-right text-sm font-medium text-slate-600">{(ord.vatAmount || 0).toLocaleString('vi-VN')}</td>}
                            {columnVis.totalAmount && <td className="border-r border-slate-200 px-3 py-3.5 text-right text-sm font-black text-slate-900">{ord.totalAmount.toLocaleString('vi-VN')} đ</td>}
                            {columnVis.amountPaid && <td className="border-r border-slate-200 px-3 py-3.5 text-right text-sm font-extrabold text-emerald-700">{(ord.amountPaid || ord.totalAmount).toLocaleString('vi-VN')} đ</td>}
                            {columnVis.note && <td className="border-r border-slate-200 px-4 py-3.5 text-sm font-medium text-slate-600 max-w-[180px] truncate" title={ord.description}>{ord.description || '-'}</td>}
                            {columnVis.status && (
                              <td className="border-r border-slate-200 px-3 py-3.5 text-center">
                                <StatusBadge status={ord.status} />
                              </td>
                            )}
                            <td className="sticky right-0 z-10 w-56 min-w-[210px] bg-white group-hover:bg-cyan-50/90 px-3 py-3.5 text-center shadow-[-4px_0_12px_rgba(0,0,0,0.05)] border-l border-slate-200">
                              <div className="flex items-center justify-center gap-1.5">
                                {canEdit && (
                                  <button
                                    type="button"
                                    disabled={!['DRAFT', 'draft', 'Đơn nháp'].includes(ord.status || '')}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditOrder(ord);
                                    }}
                                    title={
                                      ['DRAFT', 'draft', 'Đơn nháp'].includes(ord.status || '')
                                        ? 'Sửa phiếu nhập (Nháp)'
                                        : 'Phiếu đã lưu chính thức / đã nhập kho, không thể chỉnh sửa'
                                    }
                                    className={`flex h-8 w-8 items-center justify-center rounded-xl border-2 transition shadow-sm ${
                                      ['DRAFT', 'draft', 'Đơn nháp'].includes(ord.status || '')
                                        ? 'border-cyan-500 bg-white text-cyan-600 hover:bg-cyan-50 hover:text-cyan-700 cursor-pointer'
                                        : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed opacity-50'
                                    }`}
                                  >
                                    <Pencil size={16} strokeWidth={2.5} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSearchParams({ action: 'view', id: ord.id });
                                  }}
                                  title="Xem chi tiết đơn hàng"
                                  className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 hover:text-cyan-700 cursor-pointer"
                                >
                                  <Eye size={16} strokeWidth={2.5} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewDetail(ord, true);
                                  }}
                                  title="Xem vị trí xếp kho & ô kệ"
                                  className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-emerald-500 bg-white text-emerald-600 shadow-sm transition hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
                                >
                                  <MapPin size={16} strokeWidth={2.5} />
                                </button>
                                {canPrint && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewDetail(ord, false).then(() => setShowPrintModal(true));
                                    }}
                                    title="In phiếu nhập"
                                    className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 hover:text-cyan-700 cursor-pointer"
                                  >
                                    <Printer size={16} strokeWidth={2.5} />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteSingleOrder(ord);
                                    }}
                                    title="Xóa phiếu nhập"
                                    className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-rose-500 bg-white text-rose-600 shadow-sm transition hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                                  >
                                    <Trash2 size={16} strokeWidth={2.5} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Itemized Sub-table Expansion when showDetail is checked */}
                          {showDetail && ord.details && ord.details.length > 0 && (
                            <tr className="bg-slate-50/80">
                              <td colSpan={17} className="p-3 border border-slate-200">
                                <div className="rounded-lg border border-slate-300 bg-white p-2">
                                  <p className="text-[11px] font-bold text-cyan-800 uppercase mb-2">Chi tiết mặt hàng phiếu {ord.receiptNo}:</p>
                                  <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-100 font-bold text-slate-600 border-b">
                                      <tr>
                                        <th className="p-1.5 text-center">SKU</th>
                                        <th className="p-1.5 text-center">Tên sản phẩm</th>
                                        <th className="p-1.5 text-center">ĐVT</th>
                                        <th className="p-1.5 text-center">Số lượng</th>
                                        <th className="p-1.5 text-center">Đơn giá</th>
                                        <th className="p-1.5 text-center">Thành tiền</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {ord.details.map((d, dIdx) => (
                                        <tr key={dIdx}>
                                          <td className="p-1.5 font-bold text-cyan-700 text-center">{d.productSku}</td>
                                          <td className="p-1.5 font-medium">{d.productName}</td>
                                          <td className="p-1.5 text-center">{d.unit}</td>
                                          <td className="p-1.5 text-center font-bold">{d.qty}</td>
                                          <td className="p-1.5 text-right">{d.price.toLocaleString('vi-VN')} đ</td>
                                          <td className="p-1.5 text-right font-bold text-slate-900">{(d.totalLineAmount || (d.qty * d.price)).toLocaleString('vi-VN')} đ</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t-2 border-slate-200 bg-slate-50/90 px-4 py-3.5 text-sm font-bold text-slate-700">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-slate-700">Hiển thị:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="h-9 rounded-xl border-2 border-slate-300 bg-white px-3 text-sm font-black text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer shadow-xs"
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={500}>500</option>
                  </select>
                  <span className="text-sm font-bold text-slate-600">dòng/trang</span>
                </div>
                <div className="border-l-2 border-slate-300 pl-3 text-sm font-semibold text-slate-600">
                  Hiển thị <span className="font-extrabold text-slate-900">{filteredOrders.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> -{' '}
                  <span className="font-extrabold text-slate-900">{Math.min(currentPage * pageSize, filteredOrders.length)}</span> trên tổng <span className="font-black text-cyan-800">{filteredOrders.length}</span> phiếu nhập
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm font-bold">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-slate-700 hover:bg-cyan-50 hover:border-cyan-600 hover:text-cyan-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-slate-300 disabled:hover:text-slate-700 transition cursor-pointer shadow-2xs"
                  title="Trang đầu"
                >
                  <ChevronsLeft size={18} strokeWidth={2.5} />
                </button>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-slate-700 hover:bg-cyan-50 hover:border-cyan-600 hover:text-cyan-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-slate-300 disabled:hover:text-slate-700 transition cursor-pointer shadow-2xs"
                  title="Trang trước"
                >
                  <ChevronLeft size={18} strokeWidth={2.5} />
                </button>
                <span className="px-2 text-sm font-extrabold text-slate-800">
                  Trang <span className="text-cyan-700 font-black">{currentPage}</span> / {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-slate-700 hover:bg-cyan-50 hover:border-cyan-600 hover:text-cyan-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-slate-300 disabled:hover:text-slate-700 transition cursor-pointer shadow-2xs"
                  title="Trang tiếp"
                >
                  <ChevronRight size={18} strokeWidth={2.5} />
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-slate-700 hover:bg-cyan-50 hover:border-cyan-600 hover:text-cyan-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-slate-300 disabled:hover:text-slate-700 transition cursor-pointer shadow-2xs"
                  title="Trang cuối"
                >
                  <ChevronsRight size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        </div>

      {/* ─── MODAL ADD SUPPLIER ─────────────────────────────────────── */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <UserPlus size={18} className="text-cyan-600" />
                <span>Thêm Nhà Cung Cấp Mới</span>
              </h2>
              <button onClick={() => setShowAddSupplierModal(false)} className="rounded-lg p-1 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateSupplier} className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-bold text-slate-700">Mã Nhà cung cấp</label>
                <input
                  type="text"
                  placeholder="NCC00..."
                  value={newSupplierForm.supplierCode}
                  onChange={(e) => setNewSupplierForm({ ...newSupplierForm, supplierCode: e.target.value })}
                  className="h-9 w-full rounded-xl border border-slate-300 px-3 font-semibold outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-slate-700">Tên Nhà cung cấp (*)</label>
                <input
                  type="text"
                  required
                  placeholder="Công ty TNHH..."
                  value={newSupplierForm.name}
                  onChange={(e) => setNewSupplierForm({ ...newSupplierForm, name: e.target.value })}
                  className="h-9 w-full rounded-xl border border-slate-300 px-3 font-semibold outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-slate-700">Số điện thoại</label>
                <input
                  type="text"
                  placeholder="090..."
                  value={newSupplierForm.phone}
                  onChange={(e) => setNewSupplierForm({ ...newSupplierForm, phone: e.target.value })}
                  className="h-9 w-full rounded-xl border border-slate-300 px-3 font-semibold outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-slate-700">Địa chỉ</label>
                <input
                  type="text"
                  placeholder="Số nhà, Đường, Quận/Huyện..."
                  value={newSupplierForm.address}
                  onChange={(e) => setNewSupplierForm({ ...newSupplierForm, address: e.target.value })}
                  className="h-9 w-full rounded-xl border border-slate-300 px-3 font-semibold outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-slate-700">Mã số thuế</label>
                <input
                  type="text"
                  placeholder="030..."
                  value={newSupplierForm.taxCode}
                  onChange={(e) => setNewSupplierForm({ ...newSupplierForm, taxCode: e.target.value })}
                  className="h-9 w-full rounded-xl border border-slate-300 px-3 font-semibold outline-none focus:border-cyan-500"
                />
              </div>
              <div className="mt-4 flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button type="button" onClick={() => setShowAddSupplierModal(false)} className="rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-600 hover:bg-slate-100">
                  Hủy
                </button>
                <button type="submit" className="rounded-xl bg-cyan-600 px-4 py-2 font-black text-white hover:bg-cyan-700 shadow-md">
                  Lưu Nhà Cung Cấp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL COLUMN SETTINGS ───────────────────────────────────── */}
      {showColumnSettings && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Settings size={18} className="text-cyan-600" />
                <span>Cài Đặt Tùy Chọn Ẩn/Hiện Cột Bảng</span>
              </h2>
              <button onClick={() => setShowColumnSettings(false)} className="rounded-lg p-1 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 max-h-72 overflow-y-auto text-xs font-semibold">
              {COLUMN_LIST.map((col) => (
                <label key={col.key} className="flex items-center gap-2 rounded-lg p-2 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={columnVis[col.key] ?? true}
                    onChange={(e) => setColumnVis({ ...columnVis, [col.key]: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span>{col.label}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button onClick={() => setColumnVis(DEFAULT_COLUMN_VIS)} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">
                Khôi phục mặc định
              </button>
              <button onClick={() => setShowColumnSettings(false)} className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-black text-white hover:bg-cyan-700 shadow-md">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL DETAIL ───────────────────────────────────────────── */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-base font-black uppercase text-slate-900">Chi tiết Phiếu Nhập Kho #{selectedOrder.receiptNo}</h2>
              <button onClick={() => setShowDetailModal(false)} className="rounded-lg p-1 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-semibold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div><span className="text-slate-400 block text-[10px] uppercase">Nhà cung cấp</span> <span className="font-bold text-slate-900">{selectedOrder.supplier}</span></div>
                <div><span className="text-slate-400 block text-[10px] uppercase">Kho nhập chính</span> <span className="font-bold text-cyan-800">{formatWarehouseDisplay(selectedOrder.warehouseCode, warehouses)}</span></div>
                <div><span className="text-slate-400 block text-[10px] uppercase">Ngày lập</span> <span className="font-semibold text-slate-800">{selectedOrder.orderDate}</span></div>
                <div><span className="text-slate-400 block text-[10px] uppercase">Trạng thái</span> <StatusBadge status={selectedOrder.status} /></div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[400px] overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="sticky top-0 bg-slate-100 font-extrabold text-slate-700 uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Mã SKU</th>
                      <th className="p-2.5">Tên sản phẩm</th>
                      <th className="p-2.5 text-center">Vị trí Kho & Ô Kệ</th>
                      <th className="p-2.5 text-center">ĐVT</th>
                      <th className="p-2.5 text-center">SL</th>
                      <th className="p-2.5 text-right">Đơn giá</th>
                      <th className="p-2.5 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {selectedOrder.details && selectedOrder.details.length > 0 ? (
                      selectedOrder.details.map((d, i) => (
                        <tr key={i} className="hover:bg-cyan-50/30">
                          <td className="p-2.5 font-extrabold text-cyan-800 whitespace-nowrap">{d.productSku || 'SKU'}</td>
                          <td className="p-2.5 font-bold text-slate-800">{d.productName || 'Sản phẩm'}</td>
                          <td className="p-2.5 text-center">
                            <span className="inline-flex items-center gap-1 rounded-md bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-900 border border-cyan-200">
                              <MapPin size={13} className="text-cyan-600" />
                              {d.locationBin || d.warehouseCode || selectedOrder.warehouseCode || 'KHO-NVL'}
                            </span>
                          </td>
                          <td className="p-2.5 text-center font-medium">{d.unit || 'Cái'}</td>
                          <td className="p-2.5 text-center font-black text-slate-900">{d.qty}</td>
                          <td className="p-2.5 text-right font-semibold text-slate-700">{d.price.toLocaleString('vi-VN')} đ</td>
                          <td className="p-2.5 text-right font-black text-cyan-900">{(d.totalLineAmount || (d.qty * d.price)).toLocaleString('vi-VN')} đ</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-400 font-medium">
                          Chưa có sản phẩm trong đơn nhập
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between text-sm font-black text-slate-900 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDetailModal(false);
                    setShowLocationModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
                >
                  <MapPin size={15} />
                  <span>Xem sơ đồ vị trí ô kệ</span>
                </button>
                <span>Tổng giá trị: {selectedOrder.totalAmount.toLocaleString('vi-VN')} đ</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL VỊ TRÍ XẾP KHO & Ô KỆ ───────────────────────────── */}
      {showLocationModal && selectedOrder && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-md">
                  <Warehouse size={22} strokeWidth={2.2} />
                </div>
                <div>
                  <h2 className="text-base font-black uppercase text-slate-900">
                    Vị Trí Sắp Xếp Kho & Ô Kệ — #{selectedOrder.receiptNo}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Nhà cung cấp: <span className="font-bold text-slate-700">{selectedOrder.supplier}</span> | Ngày lập: {selectedOrder.orderDate}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLocationModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl bg-cyan-50/70 p-3 border border-cyan-200">
                  <span className="text-slate-500 font-semibold block">Kho tiếp nhận chính:</span>
                  <span className="font-black text-cyan-900 text-sm">{formatWarehouseDisplay(selectedOrder.warehouseCode, warehouses)}</span>
                </div>
                <div className="rounded-xl bg-emerald-50/70 p-3 border border-emerald-200">
                  <span className="text-slate-500 font-semibold block">Trạng thái phiếu:</span>
                  <StatusBadge status={selectedOrder.status} />
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
                  <span className="text-slate-500 font-semibold block">Tổng sản phẩm:</span>
                  <span className="font-black text-slate-900 text-sm">{selectedOrder.details?.length || 0} mặt hàng</span>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[420px] overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="sticky top-0 bg-slate-100 font-black text-slate-700 uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-3">Mã SKU</th>
                      <th className="p-3">Tên sản phẩm</th>
                      <th className="p-3 text-center">Kho lưu trữ</th>
                      <th className="p-3 text-center">Vị trí Ô Kệ (Bin Allocation)</th>
                      <th className="p-3 text-center">Số lượng</th>
                      <th className="p-3">Ghi chú vị trí</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {selectedOrder.details && selectedOrder.details.length > 0 ? (
                      selectedOrder.details.map((d, i) => {
                        const bins = d.assignedBins && d.assignedBins.length > 0
                          ? d.assignedBins
                          : (d.locationBin ? d.locationBin.split(',').map((s: string) => s.trim()) : []);

                        return (
                          <tr key={i} className="hover:bg-cyan-50/40 transition">
                            <td className="p-3 font-extrabold text-cyan-800 whitespace-nowrap">{d.productSku || 'SKU'}</td>
                            <td className="p-3 font-bold text-slate-800">{d.productName || 'Sản phẩm'}</td>
                            <td className="p-3 text-center font-semibold text-slate-700 whitespace-nowrap">
                              {formatWarehouseDisplay(d.warehouseCode || selectedOrder.warehouseCode, warehouses)}
                            </td>
                            <td className="p-3 text-center">
                              {bins.length > 0 ? (
                                <div className="flex flex-wrap items-center justify-center gap-1.5">
                                  {bins.map((bin: string, bIdx: number) => (
                                    <span key={bIdx} className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-800 border border-emerald-300 shadow-2xs">
                                      <MapPin size={12} className="text-emerald-600" />
                                      {bin.startsWith('Ô') ? bin : `Ô ${bin}`}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 border border-slate-200">
                                  <MapPin size={12} className="text-slate-400" />
                                  {d.locationBin || d.warehouseCode || 'KHO-NVL'}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center font-extrabold text-slate-900 whitespace-nowrap">
                              {d.qty} {d.unit || 'Cái'}
                            </td>
                            <td className="p-3 text-slate-600 font-medium">
                              {d.note || (d.dimensions ? `KT: ${d.dimensions}` : 'Đã phân bổ khu vực')}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">
                          Chưa có thông tin vị trí ô kệ sản phẩm
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowLocationModal(false)}
                  className="rounded-xl bg-cyan-700 px-5 py-2 text-xs font-extrabold uppercase text-white hover:bg-cyan-800 transition shadow-md cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL PRINT ────────────────────────────────────────────── */}
      {showPrintModal && selectedOrder && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-base font-black text-slate-900">Xem trước Phiếu Nhập Kho</h2>
              <button onClick={() => setShowPrintModal(false)} className="rounded-lg p-1 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 border border-slate-300 rounded-xl space-y-3 text-xs">
              <div className="text-center">
                <h2 className="text-base font-black uppercase text-slate-900">PHIẾU NHẬP KHO HÀNG HÓA</h2>
                <p className="text-slate-500">Mã phiếu: {selectedOrder.receiptNo} - Ngày: {selectedOrder.orderDate}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 font-semibold">
                <p>Nhà cung cấp: {selectedOrder.supplier}</p>
                <p>Kho nhập: {formatWarehouseDisplay(selectedOrder.warehouseCode, warehouses)}</p>
                <p>SĐT: {selectedOrder.supplierPhone || '-'}</p>
                <p>Người lập: {selectedOrder.employeeName}</p>
              </div>
              <table className="w-full border-collapse border border-slate-300 text-xs">
                <thead className="bg-slate-100 font-bold text-center">
                  <tr>
                    <th className="border p-1">STT</th>
                    <th className="border p-1">Tên hàng</th>
                    <th className="border p-1">ĐVT</th>
                    <th className="border p-1">SL</th>
                    <th className="border p-1">Đơn giá</th>
                    <th className="border p-1">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.details?.map((d, i) => (
                    <tr key={i} className="text-center">
                      <td className="border p-1">{i + 1}</td>
                      <td className="border p-1 text-left font-semibold">{d.productName}</td>
                      <td className="border p-1">{d.unit}</td>
                      <td className="border p-1 font-bold">{d.qty}</td>
                      <td className="border p-1 text-right">{d.price.toLocaleString('vi-VN')}</td>
                      <td className="border p-1 text-right font-bold">{(d.qty * d.price).toLocaleString('vi-VN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-right font-black text-sm">Tổng tiền: {selectedOrder.totalAmount.toLocaleString('vi-VN')} VNĐ</div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-700 cursor-pointer">
                <Printer size={16} /> In Phiếu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL BARCODE SCANNER ───────────────────────────────────── */}
      {showScannerModal && (
        <BarcodeScanner
          isOpen={showScannerModal}
          onProductFound={handleProductScanned}
          onClose={() => setShowScannerModal(false)}
        />
      )}
    </div>
  );
}