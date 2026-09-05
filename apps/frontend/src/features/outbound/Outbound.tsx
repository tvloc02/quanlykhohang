import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Plus,
  X,
  XCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Trash2,
  Printer,
  FileSpreadsheet,
  FileDown,
  Settings,
  Home,
  Calendar,
  Filter,
  RefreshCw,
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
  ShoppingCart,
  User,
  CreditCard,
  TrendingUp,
  PackageCheck,
  Receipt,
  FileX,
  CornerUpRight,
  Send,
} from 'lucide-react';
import BarcodeScanner, { type ScannedProduct } from '../../shared/components/BarcodeScanner';
import CreateOutboundOrderPage from './pages/CreateOutboundOrderPage';
import OutboundPrintModal from './components/OutboundPrintModal';
import { usePermissions } from '../../shared/hooks/usePermissions';

const getOutboundMenuId = (mode?: string) => {
  if (mode === 'sales-order') return 'outbound-sales-orders';
  if (mode === 'disposal') return 'outbound-disposal';
  if (mode === 'quote') return 'documents-quotes';
  if (mode === 'transfer-out') return 'delivery-transfer-orders';
  if (typeof window !== 'undefined' && window.location.pathname.includes('/outbound/retail')) return 'outbound-retail';
  return 'outbound-orders';
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
      className={`fixed top-4 right-4 z-[999] flex items-center gap-3 rounded-xl px-5 py-3 shadow-lg transition-all animate-[slideIn_0.3s_ease-out] ${type === 'error'
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

// ─── STATUS BADGE (Xuất Kho) ───────────────────────────────────

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string }> = {
  'Đã giao hàng': { label: 'Đã giao hàng', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  'shipped': { label: 'Đã giao hàng', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  'pending': { label: 'Chờ xử lý', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  'Chờ xử lý': { label: 'Chờ xử lý', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  'picking': { label: 'Đang lấy hàng', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
  'Đang lấy hàng': { label: 'Đang lấy hàng', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
  'READY_TO_SHIP': { label: 'Sẵn sàng xuất', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'Sẵn sàng xuất': { label: 'Sẵn sàng xuất', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'Đã hủy': { label: 'Đã hủy', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
};

function StatusBadge({ status }: { status?: string }) {
  const config = STATUS_MAP[status || ''] || STATUS_MAP['Đã giao hàng'];
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
  price?: number;
}

interface CustomerOption {
  id: string;
  customerCode: string;
  name: string;
  phone?: string;
  address?: string;
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

interface OutboundTab {
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

export interface OutboundOrder {
  id: string;
  orderNo: string;
  orderType?: string;
  customer: string;
  customerId?: string;
  customerPhone?: string;
  customerAddress?: string;
  branchCode?: string;
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

function toDateOnlyString(dateStr?: string | Date | null): string {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateDisplay(dateVal?: string | Date | null): string {
  if (!dateVal) return '-';
  const str = String(dateVal).trim();
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s*,?\s*(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    const hh = (dmyMatch[4] || '08').padStart(2, '0');
    const mm = (dmyMatch[5] || '30').padStart(2, '0');
    const ss = (dmyMatch[6] || '00').padStart(2, '0');
    return `${day}/${month}/${year} ${hh}:${mm}:${ss}`;
  }
  const d = new Date(dateVal);
  if (!Number.isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hh}:${mm}:${ss}`;
  }
  return String(dateVal);
}

// ─── MASTER DATA MẪU CHUẨN XUẤT KHO ───────────────────────────

const DEFAULT_FALLBACK_WAREHOUSES: WarehouseOption[] = [];

function formatWarehouseDisplay(codeOrName?: string, warehouseList: WarehouseOption[] = []): string {
  if (!codeOrName) return warehouseList[0]?.name || '-';
  const found = warehouseList.find((w) => w.code === codeOrName || w.name === codeOrName || w.id === codeOrName);
  if (found) return found.name;
  if ((codeOrName === 'SPX001' || codeOrName === '4445' || !codeOrName) && warehouseList.length > 0) {
    return warehouseList[0].name;
  }
  return codeOrName;
}

const DEFAULT_FALLBACK_CUSTOMERS: CustomerOption[] = [];

const DEFAULT_FALLBACK_PRODUCTS: ProductOption[] = [];

const DEFAULT_FALLBACK_ORDERS: OutboundOrder[] = [];

const DEFAULT_FALLBACK_RETAIL_ORDERS: OutboundOrder[] = [];

const DEFAULT_FALLBACK_DISPOSAL_ORDERS: OutboundOrder[] = [];

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

function createNewOutboundTab(tabIndex = 1, currentUserName = 'Quản lý kho', isDisposal = false): OutboundTab {
  const d = new Date();
  const dateFormatted = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;

  return {
    tabId: `tab-${Date.now()}-${tabIndex}`,
    title: `# ${tabIndex}`,
    orderNo: isDisposal ? `XH_${Math.floor(100 + Math.random() * 900)}` : '',
    branchCode: 'KHO-TONG',
    employeeName: currentUserName || 'Quản lý kho',
    customer: isDisposal ? 'Hàng hết hạn sử dụng (HSD)' : 'Khách hàng bán lẻ',
    customerPhone: '',
    customerAddress: '',
    orderDate: dateFormatted,
    expectedDate: dateFormatted,
    description: isDisposal ? 'Xuất hủy hàng hỏng / hết hạn sử dụng' : '',
    discount: 0,
    shippingFee: 0,
    vatRate: 0,
    paymentMethod: 'Tiền mặt',
    paymentAccount: '',
    amountPaid: 0,
    status: isDisposal ? 'Đã xuất hủy' : 'Đã giao hàng',
    details: makeInitialRows(DEFAULT_ROWS_COUNT),
  };
}

export interface OutboundProps {
  featureMode?: 'orders' | 'retail' | 'transfer-out' | 'sales-order' | 'quote' | 'disposal';
  title?: string;
  codePrefix?: string;
  partnerLabel?: string;
}

export default function Outbound({
  featureMode = 'orders',
  title = 'DANH SÁCH PHIẾU XUẤT BÁN HÀNG',
  codePrefix = 'PXK',
  partnerLabel = 'Khách hàng',
}: OutboundProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isRetail = featureMode === 'retail' || location.pathname.includes('/outbound/retail');
  const isDisposal = featureMode === 'disposal' || location.pathname.includes('/outbound/disposal');
  const isSalesOrder = featureMode === 'sales-order' || location.pathname.includes('/outbound/sales-orders');
  const isQuote = featureMode === 'quote' || location.pathname.includes('/documents/quotes');
  const [orders, setOrders] = useState<OutboundOrder[]>(
    isDisposal ? DEFAULT_FALLBACK_DISPOSAL_ORDERS : (isRetail ? DEFAULT_FALLBACK_RETAIL_ORDERS : DEFAULT_FALLBACK_ORDERS)
  );
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [toast, setToast] = useState({ message: '', type: 'success' as 'success' | 'error' });

  // Bulk Selection & Expandable Details matching Inbound
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
  const showFormModal = action === 'create' || action === 'edit' || mode === 'create';

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);

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
      document.documentElement.requestFullscreen().catch(() => { });
      setIsFullScreen(true);
    } else {
      document.exitFullscreen().catch(() => { });
      setIsFullScreen(false);
    }
  };

  // Autocomplete / Dropdown States
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [activeProductDropdownRowId, setActiveProductDropdownRowId] = useState<string | null>(null);

  // Selected Order for Detail/Print Modal
  const [selectedOrder, setSelectedOrder] = useState<OutboundOrder | null>(null);

  // Master Data State
  const [products, setProducts] = useState<ProductOption[]>(DEFAULT_FALLBACK_PRODUCTS);
  const [customers, setCustomers] = useState<CustomerOption[]>(DEFAULT_FALLBACK_CUSTOMERS);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>(DEFAULT_FALLBACK_WAREHOUSES);

  const [newCustomerForm, setNewCustomerForm] = useState({ fullName: '', email: '', phone: '', address: '', status: 'active' as 'active' | 'inactive', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const currentUserName = currentUser.fullName || currentUser.email?.split('@')[0] || 'Quản lý kho';

  const { canPerformAction, isAdmin } = usePermissions();
  const currentMenuId = getOutboundMenuId(featureMode);

  const canCreate = isAdmin || canPerformAction(currentMenuId, 'create');
  const canEdit = isAdmin || canPerformAction(currentMenuId, 'edit');
  const canDelete = isAdmin || canPerformAction(currentMenuId, 'delete');
  const canPrint = isAdmin || canPerformAction(currentMenuId, 'print');
  const canExport = isAdmin || canPerformAction(currentMenuId, 'export');
  const canChangeStatus = isAdmin || canPerformAction(currentMenuId, 'status');
  const DEFAULT_COLUMN_VIS = {
    branch: true,
    nv: true,
    code: true,
    date: true,
    customerName: true,
    customerAddress: true,
    customerPhone: true,
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
    { key: 'nv', label: 'Nhân viên' },
    { key: 'code', label: 'Mã' },
    { key: 'date', label: 'Ngày' },
    { key: 'customerName', label: 'Tên KH' },
    { key: 'customerAddress', label: 'Địa chỉ' },
    { key: 'customerPhone', label: 'Tel' },
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
      const saved = localStorage.getItem('outbound_column_vis');
      return saved ? { ...DEFAULT_COLUMN_VIS, ...JSON.parse(saved) } : DEFAULT_COLUMN_VIS;
    } catch {
      return DEFAULT_COLUMN_VIS;
    }
  });

  useEffect(() => {
    localStorage.setItem('outbound_column_vis', JSON.stringify(columnVis));
  }, [columnVis]);

  // Synchronous Multi-Tab Initialization with Session Draft persistence
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

  // Sync draft tabs to sessionStorage so F5 refresh on form preserves user work
  useEffect(() => {
    if (showFormModal) {
      if (tabs && tabs.length > 0) {
        sessionStorage.setItem('outbound_tabs_draft', JSON.stringify(tabs));
        sessionStorage.setItem('outbound_active_tab_id', activeTabId);
      }
    } else {
      sessionStorage.removeItem('outbound_tabs_draft');
      sessionStorage.removeItem('outbound_active_tab_id');
    }
  }, [showFormModal, tabs, activeTabId]);

  // ── 1. Fetch Master Data & Outbound Orders ────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordRes, custRes, prodRes, userRes, whRes] = await Promise.all([
        fetch(`${API_BASE_URL}/outbounds`, { headers: authHeaders() }).catch(() => null),
        fetch(`${API_BASE_URL}/customers`, { headers: authHeaders() }).catch(() => null),
        fetch(`${API_BASE_URL}/products`, { headers: authHeaders() }).catch(() => null),
        fetch(`${API_BASE_URL}/users`, { headers: authHeaders() }).catch(() => null),
        fetch(`${API_BASE_URL}/warehouses`, { headers: authHeaders() }).catch(() => null),
      ]);

      if (ordRes && ordRes.ok) {
        const raw = await ordRes.json();
        const list = Array.isArray(raw) ? raw : raw.data || [];
        if (list.length > 0) {
          const targetList = isDisposal
            ? list.filter((item: any) => item.orderType === 'disposal' || (item.orderNo && item.orderNo.startsWith('XH')))
            : isRetail
            ? list.filter((item: any) => item.orderType === 'retail' || item.orderType === 'RETAIL' || (item.orderNo && item.orderNo.startsWith('XBL')))
            : isSalesOrder
            ? list.filter((item: any) => item.orderType === 'sales-order' || (item.orderNo && item.orderNo.startsWith('DDH')))
            : isQuote
            ? list.filter((item: any) => item.orderType === 'quote' || (item.orderNo && item.orderNo.startsWith('BG')))
            : list.filter((item: any) => item.orderType !== 'disposal' && item.orderType !== 'retail' && item.orderType !== 'RETAIL' && item.orderType !== 'sales-order' && item.orderType !== 'quote' && (!item.orderNo || (!item.orderNo.startsWith('XH') && !item.orderNo.startsWith('XBL') && !item.orderNo.startsWith('DDH') && !item.orderNo.startsWith('BG'))));

          const formatted: OutboundOrder[] = targetList.map((item: any, idx: number) => ({
            id: String(item.id || idx),
            orderNo: item.orderNo || item.receiptNo || (isDisposal ? `XH_${1000 + idx}` : (isRetail ? `XBL_${1000 + idx}` : `XBH_${1000 + idx}`)),
            orderType: item.orderType,
            customer: item.customer || item.customerName || item.customer?.name || (isDisposal ? 'Hàng hết hạn / hư hỏng' : (isRetail ? 'Khách hàng bán lẻ' : '888 - Khách lẻ')),
            customerId: item.customerId || item.customer?.id,
            customerPhone: item.customerPhone || item.customer?.phone || '',
            customerAddress: item.customerAddress || item.customer?.address || '',
            branchCode: (!item.branchCode || item.branchCode === '4445' || item.branchCode === 'SPX001') ? (item.warehouseCode && item.warehouseCode !== '4445' ? item.warehouseCode : 'KHO-NVL') : item.branchCode,
            employeeName: (!item.employeeName || item.employeeName === 'HUUDQtest') ? (item.creatorName && item.creatorName !== 'HUUDQtest' ? item.creatorName : currentUserName) : item.employeeName,
            orderDate: item.orderDate || item.createdAt || new Date().toISOString(),
            expectedDate: item.expectedDate || '',
            status: item.status || (isDisposal ? 'Đã xuất hủy' : 'Đã giao hàng'),
            description: item.description || (isDisposal ? 'Xuất hủy hàng hóa' : ''),
            subtotal: Number(item.subtotal || item.totalAmount || 0),
            discount: Number(item.discount || 0),
            vatAmount: Number(item.vatAmount || 0),
            totalAmount: Number(item.totalAmount || 0),
            amountPaid: Number(item.amountPaid || item.totalAmount || 0),
            itemsCount: item.details?.length || item.items || 1,
            totalQty: item.details?.reduce((s: number, d: any) => s + (Number(d.requiredQty || d.qty || 1)), 0) || 1,
            details: item.details?.map((d: any) => ({
              id: d.id,
              productId: d.product?.id || d.productId,
              productSku: d.product?.internalSku || d.productSku || d.sku || 'SKU',
              productName: d.product?.name || d.productName || 'Sản phẩm',
              unit: d.product?.unit || d.unit || 'Cái',
              qty: Number(d.requiredQty || d.qty || 1),
              price: Number(d.unitPrice || d.price || 0),
              totalLineAmount: Number(d.totalLineAmount || (Number(d.requiredQty || d.qty || 1) * Number(d.unitPrice || d.price || 0))),
            })) || [],
          }));
          setOrders(formatted);
        } else {
          setOrders(isDisposal ? DEFAULT_FALLBACK_DISPOSAL_ORDERS : (isRetail ? DEFAULT_FALLBACK_RETAIL_ORDERS : DEFAULT_FALLBACK_ORDERS));
        }
      }

      if (custRes && custRes.ok) {
        const cData = await custRes.json();
        const cList = Array.isArray(cData) ? cData : cData.data || [];
        if (cList.length > 0) setCustomers(cList);
      }

      if (prodRes && prodRes.ok) {
        const pData = await prodRes.json();
        const pList = Array.isArray(pData) ? pData : pData.data || [];
        if (pList.length > 0) {
          setProducts(
            pList.map((p: any) => ({
              id: String(p.id),
              internalSku: p.internalSku || p.sku || `SKU${p.id}`,
              name: p.name || p.internalSku || 'Sản phẩm',
              unit: p.unit || 'Cái',
              price: Number(p.price || p.salePrice || p.retailPrice || p.purchasePrice || 0),
              salePrice: Number(p.salePrice || p.price || p.retailPrice || p.purchasePrice || 0),
              purchasePrice: Number(p.purchasePrice || p.price || 0),
            }))
          );
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
        if (wList.length > 0) setWarehouses(wList);
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu Xuất Kho:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUserName, isDisposal, isRetail, isSalesOrder, isQuote, featureMode, location.pathname]);

  const handleOpenFormModal = useCallback((modeAction: 'create' | 'edit' = 'create', id?: string) => {
    if (modeAction === 'edit' && id) {
      setSearchParams({ action: 'edit', id });
    } else {
      setSearchParams({ action: 'create' });
    }
  }, [setSearchParams]);

  const handleCloseFormModal = useCallback(() => {
    sessionStorage.removeItem('outbound_tabs_draft');
    sessionStorage.removeItem('outbound_active_tab_id');
    setSearchParams({});
    loadData();
  }, [setSearchParams, loadData]);

  // Reset state and reload data when route or featureMode changes
  useEffect(() => {
    setSearch('');
    setStatusFilter('all');
    setSelectedIds(new Set());
    setCurrentPage(1);
    setShowDetailModal(false);
    setSelectedOrder(null);
    loadData();
  }, [location.pathname, featureMode]);

  useEffect(() => {
    loadData();
  }, [loadData, showFormModal]);

  // Click outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('.customer-dropdown-container') && !target.closest('.product-dropdown-container')) {
        setShowCustomerDropdown(false);
        setActiveProductDropdownRowId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset Sample Data Function
  const handleResetSampleData = () => {
    if (!confirm('Bạn có chắc chắn muốn RESET và làm sạch toàn bộ dữ liệu về dữ liệu mẫu chuẩn Xuất bán kho?')) return;
    setOrders(DEFAULT_FALLBACK_ORDERS);
    setWarehouses(DEFAULT_FALLBACK_WAREHOUSES);
    setCustomers(DEFAULT_FALLBACK_CUSTOMERS);
    setProducts(DEFAULT_FALLBACK_PRODUCTS);
    setSelectedIds(new Set());
    setToast({ message: 'Đã Reset thành công toàn bộ Dữ liệu mẫu Xuất Kho chuẩn!', type: 'success' });
  };

  // ── 2. Active Tab Management & Calculation ────────────────────

  const activeTab = useMemo(() => {
    return (tabs && tabs.find((t) => t.tabId === activeTabId)) || (tabs && tabs[0]) || createNewOutboundTab(1, currentUserName);
  }, [tabs, activeTabId, currentUserName]);

  const updateActiveTab = useCallback((updater: (tab: OutboundTab) => OutboundTab) => {
    setTabs((prevTabs) =>
      prevTabs.map((t) => (t.tabId === activeTabId ? updater(t) : t))
    );
  }, [activeTabId]);

  const handleAddTab = () => {
    const newTabNum = tabs.length + 1;
    const newTab = createNewOutboundTab(newTabNum, currentUserName);
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
        const price = Number(product.salePrice || product.price || product.purchasePrice || 0);
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

  const handleProductScanned = (scanned: ScannedProduct) => {
    if (!activeTabId) return;
    if (!scanned || scanned.isExternal || scanned.id === 'NEW' || !scanned.name) {
      setToast({ message: 'Chưa có sản phẩm này', type: 'error' });
      return;
    }

    const barcodeVal = scanned.internalSku || scanned.supplierBarcode || '';
    const price = (scanned as any).salePrice || scanned.purchasePrice || 80000;
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

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const custName = newCustomerForm.fullName.trim();
    if (!custName) {
      setToast({ message: 'Vui lòng nhập họ và tên khách hàng', type: 'error' });
      return;
    }
    const autoCode = `KH${Date.now().toString().slice(-6)}`;
    const payload = {
      name: custName,
      fullName: custName,
      customerCode: autoCode,
      email: newCustomerForm.email.trim(),
      phone: newCustomerForm.phone.trim(),
      address: newCustomerForm.address.trim(),
      status: newCustomerForm.status,
      password: newCustomerForm.password,
    };
    try {
      const res = await fetch(`${API_BASE_URL}/customers`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      let created: any = null;
      if (res.ok) {
        created = await res.json();
      } else {
        const userRes = await fetch(`${API_BASE_URL}/users`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ ...payload, role: 'customer' }),
        }).catch(() => null);

        if (userRes && userRes.ok) {
          created = await userRes.json();
        } else {
          created = { id: `cust-${Date.now()}`, ...payload };
        }
      }
      setCustomers((prev) => [created, ...prev]);
      updateActiveTab((tab) => ({
        ...tab,
        customerId: created.id,
        customer: created.name || created.fullName || custName,
        customerPhone: created.phone || newCustomerForm.phone,
        customerAddress: created.address || newCustomerForm.address,
      }));
      setShowAddCustomerModal(false);
      setNewCustomerForm({ fullName: '', email: '', phone: '', address: '', status: 'active', password: '' });
      setToast({ message: `Đã thêm khách hàng: ${created.name || custName}`, type: 'success' });
    } catch {
      const fallbackCreated = { id: `cust-${Date.now()}`, ...payload };
      setCustomers((prev) => [fallbackCreated, ...prev]);
      updateActiveTab((tab) => ({
        ...tab,
        customerId: fallbackCreated.id,
        customer: fallbackCreated.name,
        customerPhone: fallbackCreated.phone,
        customerAddress: fallbackCreated.address,
      }));
      setShowAddCustomerModal(false);
      setNewCustomerForm({ fullName: '', email: '', phone: '', address: '', status: 'active', password: '' });
      setToast({ message: `Đã thêm khách hàng: ${fallbackCreated.name}`, type: 'success' });
    }
  };

  const handleEditOrder = (ord: OutboundOrder) => {
    const statusLower = (ord.status || '').toLowerCase();
    if (['đã giao hàng', 'shipped', 'đã xuất hủy', 'completed'].includes(statusLower)) {
      setToast({ message: 'Phiếu đã giao hàng / xuất hủy không thể chỉnh sửa!', type: 'error' });
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
      orderNo: ord.orderNo,
      customer: ord.customer,
      customerId: ord.customerId,
      customerPhone: ord.customerPhone || '',
      customerAddress: ord.customerAddress || '',
      branchCode: ord.branchCode || ord.warehouseCode || 'KHO-TONG',
      employeeName: ord.employeeName || currentUserName,
      orderDate: ord.orderDate,
      description: ord.description || '',
      details: paddedDetails,
    }));
    handleOpenFormModal('edit', ord.id);
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
    if (!confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.size} phiếu xuất đã chọn?`)) return;

    for (const id of selectedIds) {
      try {
        await fetch(`${API_BASE_URL}/outbounds/${id}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
      } catch { }
    }
    setSelectedIds(new Set());
    setToast({ message: `Đã xóa thành công ${selectedIds.size} phiếu xuất`, type: 'success' });
    await loadData();
  };

  const handleDeleteSingleOutboundOrder = async (ord: OutboundOrder) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa phiếu xuất ${ord.orderNo}?`)) return;
    try {
      await fetch(`${API_BASE_URL}/outbound/orders/${ord.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      }).catch(() => null);
    } catch {}

    setOrders((prev) => prev.filter((o) => o.id !== ord.id));
    setToast({ message: `Đã xóa thành công phiếu xuất ${ord.orderNo}`, type: 'success' });
    await loadData();
  };

  const handleCopySelected = () => {
    if (selectedIds.size === 0) {
      setToast({ message: 'Vui lòng chọn 1 phiếu xuất để sao chép', type: 'error' });
      return;
    }
    const firstId = Array.from(selectedIds)[0];
    const source = orders.find((o) => o.id === firstId);
    if (!source) return;
    handleEditOrder(source);
    updateActiveTab((t) => ({
      ...t,
      id: undefined,
      title: `# PXK-${new Date().getFullYear()}-COPY`,
      orderNo: `PXK-${new Date().getFullYear()}-COPY`,
    }));
    setToast({ message: `Đã sao chép phiếu xuất ${source.orderNo}`, type: 'success' });
  };

  // ── 4. Save & Create Outbound Order ───────────────────────────

  const handleSaveOutboundOrder = async (isPrint = false) => {
    if (!activeTab) return;
    const validItems = activeTab.details.filter((r) => (r.productId || r.productName?.trim() || r.productSku?.trim()) && r.qty > 0);
    if (validItems.length === 0) {
      setToast({ message: 'Vui lòng chọn ít nhất 1 sản phẩm với số lượng > 0', type: 'error' });
      return;
    }

    const subtotal = validItems.reduce((s, r) => s + (Number(r.totalAmount) || (Number(r.qty) * Number(r.price))), 0);
    const vatAmount = (subtotal * (activeTab.vatRate || 0)) / 100;
    const grandTotal = Math.max(0, subtotal - (activeTab.discount || 0) + (activeTab.shippingFee || 0) + vatAmount);

    const payload = {
      orderNo: activeTab.orderNo.trim() ? activeTab.orderNo.trim().toUpperCase() : undefined,
      orderType: featureMode,
      customerId: activeTab.customerId,
      customerName: activeTab.customer?.trim() || '888 - Khách lẻ',
      customerPhone: activeTab.customerPhone?.trim() || undefined,
      customerAddress: activeTab.customerAddress?.trim() || undefined,
      receiver: (activeTab as any).receiver?.trim() || undefined,
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
      details: validItems.map((r) => ({
        productId: r.productId,
        productSku: r.productSku,
        productName: r.productName,
        unit: r.unit,
        qty: Number(r.qty),
        price: Number(r.price),
      })),
    };

    const isEdit = !!activeTab.id;
    const recordId = activeTab.id || `out-${Date.now()}`;

    const newRecord: OutboundOrder = {
      id: recordId,
      orderNo: payload.orderNo || '',
      customer: payload.customerName,
      customerId: payload.customerId,
      customerPhone: activeTab.customerPhone || '',
      customerAddress: activeTab.customerAddress || '',
      branchCode: activeTab.branchCode || 'KHO-TONG',
      employeeName: activeTab.employeeName || currentUserName,
      orderDate: activeTab.orderDate || new Date().toLocaleDateString('vi-VN'),
      status: activeTab.status || 'Đã giao hàng',
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
        ? `${API_BASE_URL}/outbound/orders/${activeTab.id}`
        : `${API_BASE_URL}/outbound/orders`;
      const method = isEdit ? 'PUT' : 'POST';

      await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload),
      }).catch(() => null);

      setOrders((prev) => {
        if (isEdit) {
          return prev.map((o) => (o.id === activeTab.id ? newRecord : o));
        } else {
          return [newRecord, ...prev];
        }
      });

      setToast({
        message: isEdit ? `Đã cập nhật thành công phiếu ${payload.orderNo || ''}!` : `Đã lưu thành công phiếu ${payload.orderNo || ''}!`,
        type: 'success',
      });

      handleCloseFormModal();
      await loadData();

      if (isPrint) {
        setSelectedOrder(newRecord);
        setShowPrintModal(true);
      }
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
        (o.orderNo || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.customer || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.employeeName || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.customerPhone || '').toLowerCase().includes(search.toLowerCase());

      const matchStatus =
        statusFilter === 'all' ||
        (o.status || '').toLowerCase() === statusFilter.toLowerCase();

      if (dateFrom || dateTo) {
        const itemDateStr = o.orderDate || o.expectedDate || (o as any).createdAt;
        if (itemDateStr) {
          const itemDate = toDateOnlyString(itemDateStr);
          if (dateFrom && itemDate && itemDate < dateFrom) return false;
          if (dateTo && itemDate && itemDate > dateTo) return false;
        }
      }

      return matchSearch && matchStatus;
    });
  }, [orders, search, statusFilter, dateFrom, dateTo]);

  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const reportTotals = useMemo(() => {
    return paginatedOrders.reduce(
      (acc, ord) => {
        acc.subtotal += Number(ord.subtotal || ord.totalAmount || 0);
        acc.discount += Number(ord.discount || 0);
        acc.vatAmount += Number(ord.vatAmount || 0);
        acc.totalAmount += Number(ord.totalAmount || 0);
        acc.amountPaid += Number(ord.amountPaid || ord.totalAmount || 0);
        acc.totalQty += Number(ord.totalQty || 0);
        return acc;
      },
      { subtotal: 0, discount: 0, vatAmount: 0, totalAmount: 0, amountPaid: 0, totalQty: 0 }
    );
  }, [paginatedOrders]);

  // Outbound KPI Metrics
  const outboundTotals = useMemo(() => {
    return orders.reduce(
      (acc, ord) => ({
        totalOrders: acc.totalOrders + 1,
        totalAmount: acc.totalAmount + (ord.totalAmount || 0),
        shippedCount: acc.shippedCount + (['shipped', 'Đã giao hàng', 'Đã xuất hủy'].includes(ord.status) ? 1 : 0),
        pendingCount: acc.pendingCount + (['pending', 'Chờ xử lý', 'picking', 'Đang lấy hàng'].includes(ord.status) ? 1 : 0),
      }),
      { totalOrders: 0, totalAmount: 0, shippedCount: 0, pendingCount: 0 }
    );
  }, [orders]);

  const handleExportCSV = () => {
    if (isDisposal) {
      const header = ['STT', 'Kho Xuất Hủy', 'NV Lập', 'Mã Phiếu Hủy', 'Ngày Xuất Hủy', 'Lý Do Xuất Hủy', 'Tổng SL Hủy', 'Tổng Giá Trị Hủy (đ)', 'Phương Án / Ghi Chú', 'Trạng Thái'];
      const rows = filteredOrders.map((o, idx) => [
        idx + 1,
        formatWarehouseDisplay(o.branchCode || o.warehouseCode, warehouses),
        o.employeeName || currentUserName,
        o.orderNo,
        o.orderDate,
        o.customer,
        o.totalQty || 1,
        o.totalAmount,
        o.description || '',
        o.status,
      ]);
      const csv = [header, ...rows].map((r) => r.map((cell) => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `xuat_huy_hang_hoa_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const header = ['STT', 'Kho', 'NV', 'Mã Phiếu', 'Ngày Xuất', 'Khách Hàng', 'Địa Chỉ', 'SĐT', 'Thành Tiền', 'Chiết Khấu', 'VAT', 'Tổng Tiền', 'Thanh Toán', 'Trạng Thái'];
    const rows = filteredOrders.map((o, idx) => [
      idx + 1,
      formatWarehouseDisplay(o.branchCode || o.warehouseCode, warehouses),
      o.employeeName || currentUserName,
      o.orderNo,
      o.orderDate,
      o.customer,
      o.customerAddress || '',
      o.customerPhone || '',
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
    a.download = `xuat_ban_hang_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={isFullScreen ? 'fixed inset-0 z-[9000] bg-white dark:bg-[#030712] overflow-y-auto p-6 space-y-6' : ''}>
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />

      {/* ─── STYLE CHO IN BÁO CÁO DANH SÁCH (LUÔN IN KHỔ NGANG, TỰ ĐỘNG CO DÃN VỪA KHÍT) ─── */}
      <style>{`
        @page {
          size: landscape;
          margin: 5mm 6mm;
        }
        @media print {
          @page {
            size: landscape;
            margin: 5mm 6mm;
          }

          /* 1. Ẩn toàn bộ thanh điều hướng, nút bấm, chatbot góc phải */
          #dify-chatbot-bubble-button,
          #dify-chatbot-bubble-window,
          .dify-custom-controls,
          iframe,
          aside,
          nav,
          header,
          footer,
          .print\\:hidden {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
          }

          /* 2. Đưa toàn bộ trang về nền trắng giấy in thuần túy, chữ đen, không màu mè */
          html, body, #root, main, div, section {
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }

          .overflow-hidden,
          .overflow-x-auto,
          .custom-scrollbar,
          .rounded-2xl {
            overflow: visible !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }

          /* 3. Bảng in tự động co giãn vừa khít 100% chiều rộng khổ giấy A4 ngang, đường kẻ đen rõ nét */
          table,
          table[class*="min-w-"] {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            table-layout: auto !important;
            border-collapse: collapse !important;
            border: 1px solid #000000 !important;
            margin-top: 4px !important;
            background: #ffffff !important;
          }

          /* 4. Kẻ dọc đầy đủ cho TẤT CẢ các ô (cả tiêu đề thead, nội dung tbody và dòng tổng tfoot) */
          table, thead, tbody, tfoot, tr, th, td,
          table thead th,
          table tbody td,
          table tfoot td,
          th, td,
          th[class*="border-"],
          td[class*="border-"],
          th[class*="min-w-"],
          td[class*="min-w-"],
          th[class*="whitespace-nowrap"],
          td[class*="whitespace-nowrap"] {
            min-width: 0 !important;
            width: auto !important;
            white-space: normal !important;
            word-break: break-word !important;
            overflow-wrap: break-word !important;
            font-size: 6.8pt !important;
            line-height: 1.2 !important;
            padding: 2px 1.5px !important;
            border: 1px solid #000000 !important;
            border-left: 1px solid #000000 !important;
            border-right: 1px solid #000000 !important;
            border-top: 1px solid #000000 !important;
            border-bottom: 1px solid #000000 !important;
            color: #000000 !important;
            background: #ffffff !important;
          }

          thead {
            display: table-header-group !important;
          }

          thead tr {
            background: #f1f5f9 !important;
          }

          /* Tiêu đề bảng có kẻ dọc đậm rõ nét */
          thead th,
          table thead th {
            background: #f1f5f9 !important;
            color: #000000 !important;
            font-weight: 800 !important;
            font-size: 7.2pt !important;
            text-align: center !important;
            border: 1px solid #000000 !important;
            border-left: 1px solid #000000 !important;
            border-right: 1px solid #000000 !important;
            border-top: 1px solid #000000 !important;
            border-bottom: 1px solid #000000 !important;
            padding: 3px 1.5px !important;
          }

          tfoot {
            display: table-footer-group !important;
          }

          tfoot tr {
            background: #f8fafc !important;
          }

          /* Dòng tổng cộng căn lề phải, kẻ viền đầy đủ ra sát lề phải bảng */
          tfoot td,
          table tfoot td {
            background: #f8fafc !important;
            color: #000000 !important;
            font-weight: 800 !important;
            font-size: 6.8pt !important;
            text-align: right !important;
            border: 1px solid #000000 !important;
            border-left: 1px solid #000000 !important;
            border-right: 1px solid #000000 !important;
            border-top: 1px solid #000000 !important;
            border-bottom: 1px solid #000000 !important;
            padding: 2.5px 1.5px !important;
            white-space: nowrap !important;
          }

          td button, td a {
            color: #000000 !important;
            text-decoration: none !important;
            font-weight: 700 !important;
            cursor: default !important;
          }

          td span[class*="rounded"] {
            background: transparent !important;
            color: #000000 !important;
            border: none !important;
            padding: 0 !important;
            font-weight: 600 !important;
            font-size: 6.8pt !important;
          }
        }
      `}</style>

      {/* ─── HEADER BÁO CÁO KHI IN ─── */}
      <div className="hidden print:block mb-4 border-b-2 border-slate-900 pb-2 text-slate-900 bg-white">
        <div className="flex justify-between items-start mb-2 text-xs">
          <div>
            <p className="font-extrabold uppercase text-slate-900 text-sm">CÔNG TY TNHH HỆ THỐNG QUẢN LÝ KHO SMART WMS</p>
            <p className="text-[11px] text-slate-600">Hệ thống Quản lý kho hàng chuyên nghiệp</p>
          </div>
          <div className="text-right text-[11px] text-slate-600">
            <p>Mẫu biểu báo cáo hệ thống</p>
            <p>Ngày in: {new Date().toLocaleDateString('vi-VN')} {new Date().toLocaleTimeString('vi-VN')}</p>
          </div>
        </div>
        <div className="text-center my-2">
          <h1 className="text-xl font-black uppercase tracking-wider text-slate-950">
            {isDisposal ? 'LẬP BÁO CÁO PHIẾU XUẤT HỦY HÀNG HÓA' : 'LẬP BÁO CÁO PHIẾU XUẤT KHO'}
          </h1>
          <p className="text-xs text-slate-600 italic mt-0.5">
            {dateFrom && dateTo ? `Kỳ báo cáo: Từ ngày ${dateFrom} đến ngày ${dateTo}` : `Ngày lập: ${new Date().toLocaleDateString('vi-VN')}`}
          </p>
        </div>
        <div className="flex justify-between text-xs font-semibold pt-1 border-t border-slate-400">
          <span>Người lập báo cáo: <strong className="text-slate-950 font-black">{currentUserName}</strong></span>
          <span>Tổng số phiếu: <strong className="text-slate-950 font-black">{paginatedOrders.length} phiếu</strong></span>
        </div>
      </div>

      {/* ═══ WHEN FORM IS CLOSED: SHOW TITLE, ACTION BUTTONS, KPI CARDS & ORDER LIST TABLE ═══ */}
      {!showFormModal ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Top Header Section matching PurchaseOrdersPage */}
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between print:hidden">
            <div>
              <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-md">
                {isDisposal ? (
                  <FileX className="h-5 w-5 text-cyan-100" />
                ) : (featureMode as string) === 'return-supplier' ? (
                  <CornerUpRight className="h-5 w-5 text-cyan-100" />
                ) : featureMode === 'retail' ? (
                  <Receipt className="h-5 w-5 text-cyan-100" />
                ) : featureMode === 'sales-order' ? (
                  <ShoppingCart className="h-5 w-5 text-cyan-100" />
                ) : featureMode === 'transfer-out' ? (
                  <Send className="h-5 w-5 text-cyan-100" />
                ) : (
                  <TrendingUp className="h-5 w-5 text-cyan-100" />
                )}
                <h1 className="text-lg font-bold tracking-tight text-white">{title}</h1>
              </div>
            </div>

            {/* Action Buttons Top Right aligned matching PurchaseOrdersPage */}
            <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
              {/* 1. Thêm mới */}
              {canCreate && (
                <button
                  type="button"
                  onClick={() => {
                    if (featureMode === 'transfer-out') {
                      navigate('/delivery/create-transfer-order');
                      return;
                    }
                    const newTab = createNewOutboundTab(1, currentUserName, isDisposal);
                    setTabs([newTab]);
                    setActiveTabId(newTab.tabId);
                    handleOpenFormModal('create');
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-4 py-2 text-sm font-extrabold text-cyan-700 shadow-sm transition hover:bg-cyan-50 cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Thêm mới
                </button>
              )}

              {/* 2. Copy */}
              {canCreate && (
                <button
                  type="button"
                  onClick={handleCopySelected}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-4 py-2 text-sm font-extrabold text-cyan-700 shadow-sm transition hover:bg-cyan-50 cursor-pointer"
                >
                  <Copy className="h-4 w-4" /> Copy {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                </button>
              )}

              {/* 3. Xóa */}
              {canDelete && (
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-4 py-2 text-sm font-extrabold text-cyan-700 shadow-sm transition hover:bg-cyan-50 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" /> Xóa {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                </button>
              )}

              {/* 4. In báo cáo */}
              {canPrint && (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-4 py-2 text-sm font-extrabold text-cyan-700 shadow-sm transition hover:bg-cyan-50 cursor-pointer"
                >
                  <Printer className="h-4 w-4" /> In báo cáo
                </button>
              )}

              {/* 5. Export Excel */}
              {canExport && (
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-4 py-2 text-sm font-extrabold text-cyan-700 shadow-sm transition hover:bg-cyan-50 cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4" /> Export Excel
                </button>
              )}

              {/* 6. Settings */}
              <button
                type="button"
                onClick={() => setShowColumnSettings(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-4 py-2 text-sm font-extrabold text-cyan-700 shadow-sm transition hover:bg-cyan-50 cursor-pointer"
              >
                <Settings className="h-4 w-4" /> Hiển thị
              </button>

              {/* 7. Toàn màn hình */}
              <button
                type="button"
                onClick={toggleBrowserFullscreen}
                aria-label="Toàn màn hình"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-cyan-700 transition hover:bg-cyan-50 cursor-pointer"
              >
                {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Filter & Search Panel */}
          <div className="rounded-2xl border-2 border-slate-200 dark:border-indigo-900/60 bg-white dark:bg-[#0b0f19] p-4 shadow-sm print:hidden">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {/* Search input */}
              <div className="relative flex-1 min-w-[320px]">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-cyan-600 dark:text-indigo-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-12 w-full rounded-xl border-2 border-cyan-600/40 dark:border-indigo-900/60 bg-white dark:bg-slate-950 pl-11 pr-4 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none transition focus:border-cyan-600 focus:dark:border-indigo-500 focus:ring-4 focus:ring-cyan-500/10 shadow-2xs"
                  placeholder={isDisposal ? "Tìm theo mã phiếu hủy, lý do xuất hủy, kho, nhân viên..." : "Tìm theo mã phiếu xuất, khách hàng, SĐT, nhân viên..."}
                />
              </div>

              {/* Date & Status Filters Container */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Date Filter Box (h-12) */}
                <div className="inline-flex h-12 items-center gap-3 rounded-xl border-2 border-cyan-600/30 dark:border-indigo-900/60 bg-slate-50/80 dark:bg-slate-900/80 px-3.5 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4.5 w-4.5 text-cyan-600 dark:text-indigo-400 shrink-0" />
                    <span className="text-xs font-extrabold uppercase text-cyan-950 dark:text-indigo-200 tracking-wide">Thời gian:</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Từ</span>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="h-9 rounded-lg border-2 border-slate-300 dark:border-indigo-900/60 bg-white dark:bg-slate-950 px-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none transition focus:border-cyan-600 focus:dark:border-indigo-500 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Đến</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="h-9 rounded-lg border-2 border-slate-300 dark:border-indigo-900/60 bg-white dark:bg-slate-950 px-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none transition focus:border-cyan-600 focus:dark:border-indigo-500 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Status Filter Box (h-12) */}
                <div className="inline-flex h-12 items-center gap-2 rounded-xl border-2 border-cyan-600/30 dark:border-indigo-900/60 bg-slate-50/80 dark:bg-slate-900/80 px-3.5 shadow-2xs">
                  <Filter className="h-4 w-4 text-cyan-600 dark:text-indigo-400 shrink-0" />
                  <span className="text-xs font-extrabold uppercase text-cyan-950 dark:text-indigo-200 tracking-wide">Trạng thái:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-9 rounded-lg border-2 border-slate-300 dark:border-indigo-900/60 bg-white dark:bg-slate-950 px-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none transition focus:border-cyan-600 focus:dark:border-indigo-500 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
                  >
                    <option value="all">Tất cả</option>
                    <option value="Đã xuất hủy">{isDisposal ? 'Đã xuất hủy' : 'Đã giao hàng'}</option>
                    <option value="Chờ xử lý">Chờ xử lý</option>
                    <option value="Đã hủy">Đã hủy</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Main Order List Table */}
          <div className="overflow-hidden rounded-2xl border-2 border-slate-200 dark:border-indigo-900/60 bg-white dark:bg-[#0b0f19] shadow-sm print:overflow-visible print:border-none print:shadow-none print:rounded-none print:bg-white print:p-0">
            <div className="overflow-x-auto custom-scrollbar print:overflow-visible print:p-0">
              <table className={`w-full border-collapse text-left print:min-w-0 print:w-full print:table-auto ${isDisposal ? 'min-w-[1350px]' : 'min-w-[1850px]'}`}>
                <thead className="bg-cyan-50 dark:bg-indigo-950/80 sticky top-0 z-20 shadow-sm">
                  <tr className="border-b-2 border-slate-200 dark:border-indigo-900/60 text-slate-800 dark:text-slate-100 font-extrabold uppercase text-xs sm:text-sm tracking-wider">
                    <th className="w-12 min-w-[50px] border-r border-slate-200 dark:border-indigo-900/40 px-2 py-4 text-center print:hidden">
                      <input
                        type="checkbox"
                        checked={paginatedOrders.length > 0 && selectedIds.size === paginatedOrders.length}
                        onChange={toggleSelectAll}
                        className="h-4.5 w-4.5 rounded border-slate-300 dark:border-indigo-900/60 accent-cyan-600 dark:accent-indigo-600 focus:ring-cyan-500 cursor-pointer"
                      />
                    </th>
                    <th className="w-14 min-w-[60px] border-r border-slate-200 dark:border-indigo-900/40 px-3 py-4 text-center">STT</th>
                    {columnVis.code && <th className="min-w-[160px] border-r border-slate-200 dark:border-indigo-900/40 px-4 py-4 text-center whitespace-nowrap">{isDisposal ? 'Mã phiếu hủy' : 'Mã phiếu'}</th>}
                    {columnVis.date && <th className="min-w-[130px] border-r border-slate-200 dark:border-indigo-900/40 px-3 py-4 text-center">{isDisposal ? 'Ngày xuất hủy' : 'Ngày xuất'}</th>}
                    {columnVis.customerName && <th className="min-w-[220px] border-r border-slate-200 dark:border-indigo-900/40 px-4 py-4 text-center">{isDisposal ? 'Lý do xuất hủy' : 'Khách hàng'}</th>}
                    {!isDisposal && (
                      <>
                        {columnVis.customerPhone && <th className="min-w-[130px] border-r border-slate-200 dark:border-indigo-900/40 px-3 py-4 text-center">SĐT</th>}
                        {columnVis.customerAddress && <th className="min-w-[240px] border-r border-slate-200 dark:border-indigo-900/40 px-4 py-4 text-center">Địa chỉ</th>}
                      </>
                    )}
                    {columnVis.branch && <th className="min-w-[150px] border-r border-slate-200 dark:border-indigo-900/40 px-3 py-4 text-center">{isDisposal ? 'Kho xuất hủy' : 'Kho'}</th>}
                    {columnVis.nv && <th className="min-w-[150px] border-r border-slate-200 dark:border-indigo-900/40 px-3 py-4 text-center">{isDisposal ? 'Nhân viên thực hiện' : 'Nhân viên'}</th>}
                    {isDisposal ? (
                      <>
                        <th className="min-w-[110px] border-r border-slate-200 dark:border-indigo-900/40 px-3 py-4 text-center">Tổng SL hủy</th>
                        <th className="min-w-[150px] border-r border-slate-200 dark:border-indigo-900/40 px-3 py-4 text-center">Giá trị hủy (đ)</th>
                      </>
                    ) : (
                      <>
                        {columnVis.subtotal && <th className="min-w-[140px] border-r border-slate-200 dark:border-indigo-900/40 px-3 py-4 text-center">Thành tiền</th>}
                        {columnVis.discount && <th className="min-w-[120px] border-r border-slate-200 dark:border-indigo-900/40 px-3 py-4 text-center">Chiết khấu</th>}
                        {columnVis.vat && <th className="min-w-[110px] border-r border-slate-200 dark:border-indigo-900/40 px-3 py-4 text-center">VAT</th>}
                        {columnVis.totalAmount && <th className="min-w-[150px] border-r border-slate-200 dark:border-indigo-900/40 px-3 py-4 text-center">Tổng tiền</th>}
                        {columnVis.amountPaid && <th className="min-w-[150px] border-r border-slate-200 dark:border-indigo-900/40 px-3 py-4 text-center">Thanh toán</th>}
                      </>
                    )}
                    {columnVis.note && <th className="min-w-[200px] border-r border-slate-200 dark:border-indigo-900/40 px-4 py-4 text-center">{isDisposal ? 'Phương án / Ghi chú' : 'Ghi chú'}</th>}
                    {columnVis.status && <th className="min-w-[140px] border-r border-slate-200 dark:border-indigo-900/40 px-3 py-4 text-center">Trạng thái</th>}
                    <th className="sticky right-0 top-0 z-30 w-44 min-w-[170px] bg-cyan-100 dark:bg-indigo-900/90 px-3 py-4 text-center shadow-[-4px_0_12px_rgba(0,0,0,0.05)] border-l border-slate-200 dark:border-indigo-900/60 text-cyan-950 dark:text-indigo-100 font-black print:hidden">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-indigo-900/40 bg-white dark:bg-slate-950">
                  {loading ? (
                    <tr>
                      <td colSpan={17} className="py-12 text-center text-slate-500 font-semibold text-sm">
                        {isDisposal ? 'Đang tải danh sách phiếu xuất hủy hàng hóa...' : 'Đang tải danh sách phiếu xuất bán hàng...'}
                      </td>
                    </tr>
                  ) : paginatedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={17} className="py-12 text-center text-slate-500 font-semibold text-sm">
                        {isDisposal ? 'Không tìm thấy phiếu xuất hủy hàng hóa nào' : 'Không tìm thấy phiếu xuất bán hàng nào'}
                      </td>
                    </tr>
                  ) : (
                    paginatedOrders.map((ord, index) => {
                      const isSelected = selectedIds.has(ord.id);
                      return (
                        <React.Fragment key={ord.id}>
                          <tr className={`group transition cursor-pointer border-b border-slate-200 dark:border-indigo-900/40 ${isSelected ? 'bg-cyan-100/60 dark:bg-indigo-950/70' : 'hover:bg-cyan-50/60 dark:hover:bg-indigo-950/40'}`}>
                            <td className="border-r border-slate-200 dark:border-indigo-900/40 px-2 py-3.5 text-center print:hidden">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectOne(ord.id)}
                                className="h-4 w-4 rounded border-slate-300 dark:border-indigo-900/60 text-cyan-600 dark:text-indigo-400 focus:ring-cyan-500 cursor-pointer"
                              />
                            </td>
                            <td className="border-r border-slate-200 dark:border-indigo-900/40 px-3 py-3.5 text-center text-sm font-medium text-slate-700 dark:text-slate-300">
                              {(currentPage - 1) * pageSize + index + 1}
                            </td>
                            {columnVis.code && (
                              <td className="border-r border-slate-200 dark:border-indigo-900/40 px-4 py-3.5 text-center text-sm font-extrabold text-cyan-700 dark:text-indigo-400 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedOrder(ord);
                                    setShowDetailModal(true);
                                  }}
                                  className="text-cyan-700 dark:text-indigo-300 hover:text-cyan-900 dark:hover:text-indigo-100 hover:underline font-extrabold text-center cursor-pointer whitespace-nowrap"
                                  title="Bấm để xem thông tin chi tiết"
                                >
                                  {ord.orderNo}
                                </button>
                              </td>
                            )}
                            {columnVis.date && <td className="border-r border-slate-200 dark:border-indigo-900/40 px-3 py-3.5 text-center text-sm font-medium text-slate-700 dark:text-slate-300">{formatDateDisplay(ord.orderDate || (ord as any).createdAt)}</td>}
                            {columnVis.customerName && <td className="border-r border-slate-200 dark:border-indigo-900/40 px-4 py-3.5 text-center text-sm font-extrabold text-slate-800 dark:text-slate-100">{ord.customer}</td>}
                            {!isDisposal && (
                              <>
                                {columnVis.customerPhone && <td className="border-r border-slate-200 dark:border-indigo-900/40 px-3 py-3.5 text-center text-sm font-medium text-slate-700 dark:text-slate-300">{ord.customerPhone || '-'}</td>}
                                {columnVis.customerAddress && <td className="border-r border-slate-200 dark:border-indigo-900/40 px-4 py-3.5 text-sm font-medium text-slate-700 dark:text-slate-300 max-w-[240px] truncate" title={ord.customerAddress}>{ord.customerAddress || '-'}</td>}
                              </>
                            )}
                            {columnVis.branch && (
                              <td className="border-r border-slate-200 dark:border-indigo-900/40 px-3 py-3.5 text-center text-sm font-bold text-slate-800 dark:text-slate-200">
                                {formatWarehouseDisplay(ord.branchCode || ord.warehouseCode, warehouses)}
                              </td>
                            )}
                            {columnVis.nv && <td className="border-r border-slate-200 dark:border-indigo-900/40 px-3 py-3.5 text-center text-sm font-medium text-slate-700 dark:text-slate-300">{ord.employeeName || currentUserName}</td>}
                            {isDisposal ? (
                              <>
                                <td className="border-r border-slate-200 dark:border-indigo-900/40 px-3 py-3.5 text-center text-sm font-black text-cyan-800 dark:text-indigo-300">{ord.totalQty || ord.itemsCount || 1}</td>
                                <td className="border-r border-slate-200 dark:border-indigo-900/40 px-3 py-3.5 text-right text-sm font-black text-rose-600 dark:text-rose-400">{(ord.totalAmount || 0).toLocaleString('vi-VN')} đ</td>
                              </>
                            ) : (
                              <>
                                {columnVis.subtotal && <td className="border-r border-slate-200 dark:border-indigo-900/40 px-3 py-3.5 text-right text-sm font-bold text-slate-800 dark:text-slate-200">{(ord.subtotal || ord.totalAmount).toLocaleString('vi-VN')} đ</td>}
                                {columnVis.discount && <td className="border-r border-slate-200 dark:border-indigo-900/40 px-3 py-3.5 text-right text-sm font-medium text-slate-600 dark:text-slate-400">{(ord.discount || 0).toLocaleString('vi-VN')}</td>}
                                {columnVis.vat && <td className="border-r border-slate-200 dark:border-indigo-900/40 px-3 py-3.5 text-right text-sm font-medium text-slate-600 dark:text-slate-400">{(ord.vatAmount || 0).toLocaleString('vi-VN')}</td>}
                                {columnVis.totalAmount && <td className="border-r border-slate-200 dark:border-indigo-900/40 px-3 py-4 text-right text-sm font-black text-slate-900 dark:text-slate-100">{ord.totalAmount.toLocaleString('vi-VN')} đ</td>}
                                {columnVis.amountPaid && <td className="border-r border-slate-200 dark:border-indigo-900/40 px-3 py-3.5 text-right text-sm font-extrabold text-emerald-700 dark:text-emerald-400">{(ord.amountPaid || ord.totalAmount).toLocaleString('vi-VN')} đ</td>}
                              </>
                            )}
                            {columnVis.note && <td className="border-r border-slate-200 dark:border-indigo-900/40 px-4 py-3.5 text-sm font-medium text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title={ord.description}>{ord.description || '-'}</td>}
                            {columnVis.status && (
                              <td className="border-r border-slate-200 dark:border-indigo-900/40 px-3 py-3.5 text-center">
                                <StatusBadge status={ord.status || (isDisposal ? 'Đã xuất hủy' : 'Đã giao hàng')} />
                              </td>
                            )}
                            <td className="sticky right-0 z-10 w-44 min-w-[170px] bg-white dark:bg-slate-900 group-hover:bg-cyan-50/90 dark:group-hover:bg-indigo-950/90 px-3 py-3.5 text-center shadow-[-4px_0_12px_rgba(0,0,0,0.05)] border-l border-slate-200 dark:border-indigo-900/60 print:hidden">
                              <div className="flex items-center justify-center gap-1.5">
                                {canEdit && (() => {
                                  const isFinalized = ['đã giao hàng', 'shipped', 'đã xuất hủy', 'completed'].includes((ord.status || '').toLowerCase());
                                  return (
                                    <button
                                      type="button"
                                      disabled={isFinalized}
                                      onClick={() => handleEditOrder(ord)}
                                      title={isFinalized ? 'Phiếu đã giao hàng - Không được phép sửa' : isDisposal ? 'Sửa phiếu xuất hủy' : 'Sửa phiếu xuất'}
                                      className={`flex h-8 w-8 items-center justify-center rounded-xl border-2 shadow-sm transition ${
                                        isFinalized
                                          ? 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-40'
                                          : 'border-cyan-500 dark:border-indigo-500 bg-white dark:bg-slate-900 text-cyan-600 dark:text-indigo-400 hover:bg-cyan-50 dark:hover:bg-indigo-950 hover:text-cyan-700 dark:hover:text-indigo-300 cursor-pointer'
                                      }`}
                                    >
                                      <Pencil size={16} strokeWidth={2.5} />
                                    </button>
                                  );
                                })()}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedOrder(ord);
                                    setShowDetailModal(true);
                                  }}
                                  title="Xem chi tiết"
                                  className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-cyan-500 dark:border-indigo-500 bg-white dark:bg-slate-900 text-cyan-600 dark:text-indigo-400 shadow-sm transition hover:bg-cyan-50 dark:hover:bg-indigo-950 hover:text-cyan-700 dark:hover:text-indigo-300 cursor-pointer"
                                >
                                  <Eye size={16} strokeWidth={2.5} />
                                </button>
                                {canPrint && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedOrder(ord);
                                      setShowPrintModal(true);
                                    }}
                                    title={isDisposal ? "In biên bản xuất hủy" : "In phiếu xuất"}
                                    className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-cyan-500 dark:border-indigo-500 bg-white dark:bg-slate-900 text-cyan-600 dark:text-indigo-400 shadow-sm transition hover:bg-cyan-50 dark:hover:bg-indigo-950 hover:text-cyan-700 dark:hover:text-indigo-300 cursor-pointer"
                                  >
                                    <Printer size={16} strokeWidth={2.5} />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteSingleOutboundOrder(ord);
                                    }}
                                    title="Xóa phiếu xuất"
                                    className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-rose-500 dark:border-rose-700 bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm transition hover:bg-rose-50 dark:hover:bg-rose-950 hover:text-rose-700 dark:hover:text-rose-300 cursor-pointer"
                                  >
                                    <Trash2 size={16} strokeWidth={2.5} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Itemized Sub-table Expansion when showDetail is checked */}
                          {showDetail && ord.details && ord.details.length > 0 && (
                            <tr className="bg-slate-50/80 dark:bg-slate-900/80">
                              <td colSpan={17} className="p-3 border border-slate-200 dark:border-indigo-900/40">
                                <div className="rounded-lg border border-slate-300 dark:border-indigo-900/60 bg-white dark:bg-slate-950 p-2">
                                  <p className="text-[11px] font-bold text-cyan-800 dark:text-indigo-300 uppercase mb-2">Chi tiết mặt hàng phiếu {ord.orderNo}:</p>
                                  <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-100 dark:bg-slate-900 font-bold text-slate-600 dark:text-slate-300 border-b dark:border-indigo-900/40">
                                      <tr>
                                        <th className="p-1.5 text-center">SKU</th>
                                        <th className="p-1.5 text-center">Tên sản phẩm</th>
                                        <th className="p-1.5 text-center">ĐVT</th>
                                        <th className="p-1.5 text-center">Số lượng</th>
                                        <th className="p-1.5 text-center">Đơn giá</th>
                                        <th className="p-1.5 text-center">Thành tiền</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-indigo-900/30">
                                      {ord.details.map((d, dIdx) => (
                                        <tr key={dIdx}>
                                          <td className="p-1.5 font-bold text-cyan-700 dark:text-indigo-400">{d.productSku}</td>
                                          <td className="p-1.5 font-medium dark:text-slate-200">{d.productName}</td>
                                          <td className="p-1.5 text-center dark:text-slate-300">{d.unit}</td>
                                          <td className="p-1.5 text-center font-bold dark:text-slate-100">{d.qty}</td>
                                          <td className="p-1.5 text-right dark:text-slate-300">{d.price.toLocaleString('vi-VN')} đ</td>
                                          <td className="p-1.5 text-right font-bold text-slate-900 dark:text-slate-100">{(d.totalLineAmount || (d.qty * d.price)).toLocaleString('vi-VN')} đ</td>
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
                <tfoot className="bg-slate-100 dark:bg-slate-900 font-extrabold border-t-2 border-slate-300 dark:border-indigo-900/80">
                  <tr className="text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                    <td className="print:hidden p-2 text-center" />
                    <td
                      colSpan={
                        isDisposal
                          ? 1 +
                            (columnVis.code ? 1 : 0) +
                            (columnVis.date ? 1 : 0) +
                            (columnVis.customerName ? 1 : 0) +
                            (columnVis.branch ? 1 : 0) +
                            (columnVis.nv ? 1 : 0)
                          : 1 +
                            (columnVis.code ? 1 : 0) +
                            (columnVis.date ? 1 : 0) +
                            (columnVis.customerName ? 1 : 0) +
                            (columnVis.customerPhone ? 1 : 0) +
                            (columnVis.customerAddress ? 1 : 0) +
                            (columnVis.branch ? 1 : 0) +
                            (columnVis.nv ? 1 : 0)
                      }
                      className="p-3 text-right font-black uppercase tracking-wider text-cyan-900 dark:text-indigo-300 border-r border-slate-200 dark:border-indigo-900/40"
                    >
                      TỔNG CỘNG ({paginatedOrders.length} PHIẾU):
                    </td>
                    {isDisposal ? (
                      <>
                        <td className="p-3 text-center font-black text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-indigo-900/40 whitespace-nowrap">
                          {reportTotals.totalQty.toLocaleString('vi-VN')}
                        </td>
                        <td className="p-3 text-right font-black text-cyan-950 dark:text-indigo-200 border-r border-slate-200 dark:border-indigo-900/40 whitespace-nowrap">
                          {reportTotals.totalAmount.toLocaleString('vi-VN')} đ
                        </td>
                      </>
                    ) : (
                      <>
                        {columnVis.subtotal && (
                          <td className="p-3 text-right font-black text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-indigo-900/40 whitespace-nowrap">
                            {reportTotals.subtotal.toLocaleString('vi-VN')} đ
                          </td>
                        )}
                        {columnVis.discount && (
                          <td className="p-3 text-right font-black text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-indigo-900/40 whitespace-nowrap">
                            {reportTotals.discount.toLocaleString('vi-VN')} đ
                          </td>
                        )}
                        {columnVis.vat && (
                          <td className="p-3 text-right font-black text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-indigo-900/40 whitespace-nowrap">
                            {reportTotals.vatAmount.toLocaleString('vi-VN')} đ
                          </td>
                        )}
                        {columnVis.totalAmount && (
                          <td className="p-3 text-right font-black text-cyan-950 dark:text-indigo-200 border-r border-slate-200 dark:border-indigo-900/40 whitespace-nowrap">
                            {reportTotals.totalAmount.toLocaleString('vi-VN')} đ
                          </td>
                        )}
                        {columnVis.amountPaid && (
                          <td className="p-3 text-right font-black text-emerald-800 dark:text-emerald-400 border-r border-slate-200 dark:border-indigo-900/40 whitespace-nowrap">
                            {reportTotals.amountPaid.toLocaleString('vi-VN')} đ
                          </td>
                        )}
                      </>
                    )}
                    {columnVis.note && <td className="border-r border-slate-200 dark:border-indigo-900/40 p-2">&nbsp;</td>}
                    {columnVis.status && <td className="border-r border-slate-200 dark:border-indigo-900/40 p-2">&nbsp;</td>}
                    <td className="print:hidden border-l border-slate-200 dark:border-indigo-900/60" />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Pagination Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t-2 border-slate-200 dark:border-indigo-900/60 bg-slate-50/90 dark:bg-slate-900/90 px-4 py-3.5 text-sm font-bold text-slate-700 dark:text-slate-300 print:hidden">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Hiển thị:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="h-9 rounded-xl border-2 border-slate-300 dark:border-indigo-900/60 bg-white dark:bg-slate-950 px-3 text-sm font-black text-slate-800 dark:text-slate-100 outline-none transition focus:border-cyan-600 focus:dark:border-indigo-500 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer shadow-xs"
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={500}>500</option>
                  </select>
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-400">dòng/trang</span>
                </div>
                <div className="border-l-2 border-slate-300 dark:border-indigo-900/60 pl-3 text-sm font-semibold text-slate-600 dark:text-slate-400">
                  Hiển thị <span className="font-extrabold text-slate-900 dark:text-slate-100">{filteredOrders.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> -{' '}
                  <span className="font-extrabold text-slate-900 dark:text-slate-100">{Math.min(currentPage * pageSize, filteredOrders.length)}</span> trên tổng <span className="font-black text-cyan-800 dark:text-indigo-300">{filteredOrders.length}</span> phiếu xuất
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm font-bold">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-300 dark:border-indigo-900/60 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:bg-cyan-50 dark:hover:bg-indigo-950 hover:border-cyan-600 dark:hover:border-indigo-500 hover:text-cyan-700 dark:hover:text-indigo-300 disabled:opacity-40 disabled:hover:bg-white dark:disabled:hover:bg-slate-950 disabled:hover:border-slate-300 dark:disabled:hover:border-indigo-900/60 disabled:hover:text-slate-700 dark:disabled:hover:text-slate-200 transition cursor-pointer shadow-2xs"
                  title="Trang đầu"
                >
                  <ChevronsLeft size={18} strokeWidth={2.5} />
                </button>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-300 dark:border-indigo-900/60 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:bg-cyan-50 dark:hover:bg-indigo-950 hover:border-cyan-600 dark:hover:border-indigo-500 hover:text-cyan-700 dark:hover:text-indigo-300 disabled:opacity-40 disabled:hover:bg-white dark:disabled:hover:bg-slate-950 disabled:hover:border-slate-300 dark:disabled:hover:border-indigo-900/60 disabled:hover:text-slate-700 dark:disabled:hover:text-slate-200 transition cursor-pointer shadow-2xs"
                  title="Trang trước"
                >
                  <ChevronLeft size={18} strokeWidth={2.5} />
                </button>
                <span className="px-2 text-sm font-extrabold text-slate-800 dark:text-slate-200">
                  Trang <span className="text-cyan-700 dark:text-indigo-300 font-black">{currentPage}</span> / {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-300 dark:border-indigo-900/60 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:bg-cyan-50 dark:hover:bg-indigo-950 hover:border-cyan-600 dark:hover:border-indigo-500 hover:text-cyan-700 dark:hover:text-indigo-300 disabled:opacity-40 disabled:hover:bg-white dark:disabled:hover:bg-slate-950 disabled:hover:border-slate-300 dark:disabled:hover:border-indigo-900/60 disabled:hover:text-slate-700 dark:disabled:hover:text-slate-200 transition cursor-pointer shadow-2xs"
                  title="Trang tiếp"
                >
                  <ChevronRight size={18} strokeWidth={2.5} />
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-300 dark:border-indigo-900/60 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:bg-cyan-50 dark:hover:bg-indigo-950 hover:border-cyan-600 dark:hover:border-indigo-500 hover:text-cyan-700 dark:hover:text-indigo-300 disabled:opacity-40 disabled:hover:bg-white dark:disabled:hover:bg-slate-950 disabled:hover:border-slate-300 dark:disabled:hover:border-indigo-900/60 disabled:hover:text-slate-700 dark:disabled:hover:text-slate-200 transition cursor-pointer shadow-2xs"
                  title="Trang cuối"
                >
                  <ChevronsRight size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>

          {/* ─── CHỮ KÝ BÁO CÁO KHI IN ─── */}
          <div className="hidden print:grid grid-cols-3 gap-8 mt-10 pt-4 text-center text-xs text-slate-900 page-break-inside-avoid">
            <div>
              <p className="font-extrabold uppercase text-slate-900">Người Lập Báo Cáo</p>
              <p className="text-[11px] text-slate-500 italic mt-0.5">(Ký, họ tên)</p>
              <div className="h-20" />
              <p className="font-bold text-slate-900">{currentUserName}</p>
            </div>
            <div>
              <p className="font-extrabold uppercase text-slate-900">Kế Toán Trưởng</p>
              <p className="text-[11px] text-slate-500 italic mt-0.5">(Ký, họ tên)</p>
              <div className="h-20" />
              <p className="text-slate-400 italic font-medium">................................................</p>
            </div>
            <div>
              <p className="font-extrabold uppercase text-slate-900">Thủ Trưởng Đơn Vị</p>
              <p className="text-[11px] text-slate-500 italic mt-0.5">(Ký, đóng dấu, họ tên)</p>
              <div className="h-20" />
              <p className="text-slate-400 italic font-medium">................................................</p>
            </div>
          </div>
        </div>
      ) : (
        <CreateOutboundOrderPage
          standalone={false}
          onBack={handleCloseFormModal}
          featureMode={featureMode}
          title={title}
          codePrefix={codePrefix}
          partnerLabel={partnerLabel}
        />
      )}
        {/* ─── MODAL ADD CUSTOMER ─────────────────────────────────────── */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-100 dark:border-indigo-900/50 animate-[fadeIn_0.2s_ease-out]">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-indigo-900/40 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 dark:bg-indigo-950 text-cyan-600 dark:text-indigo-400">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Thêm khách hàng mới</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Nhập thông tin khách hàng đầy đủ</p>
                </div>
              </div>
              <button onClick={() => setShowAddCustomerModal(false)} className="rounded-lg p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="mt-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Họ và tên</label>
                  <input
                    type="text"
                    placeholder="Nguyễn Văn A"
                    value={newCustomerForm.fullName}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, fullName: e.target.value })}
                    className="w-full h-10 rounded-xl border border-slate-200 dark:border-indigo-900/60 bg-white dark:bg-slate-950 px-3.5 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:border-cyan-500 focus:dark:border-indigo-500 focus:ring-2 focus:ring-cyan-500/10 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                  <input
                    type="email"
                    placeholder="admin@example.com"
                    value={newCustomerForm.email}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                    className="w-full h-10 rounded-xl border border-slate-200 dark:border-indigo-900/60 px-3.5 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:border-cyan-500 focus:dark:border-indigo-500 focus:ring-2 focus:ring-cyan-500/10 transition bg-blue-50/40 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Số điện thoại</label>
                  <input
                    type="text"
                    placeholder="0901234567"
                    value={newCustomerForm.phone}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                    className="w-full h-10 rounded-xl border border-slate-200 dark:border-indigo-900/60 bg-white dark:bg-slate-950 px-3.5 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:border-cyan-500 focus:dark:border-indigo-500 focus:ring-2 focus:ring-cyan-500/10 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Địa chỉ</label>
                  <input
                    type="text"
                    placeholder="Số nhà, tên đường, phường/xã, quận/huyện..."
                    value={newCustomerForm.address}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                    className="w-full h-10 rounded-xl border border-slate-200 dark:border-indigo-900/60 bg-white dark:bg-slate-950 px-3.5 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:border-cyan-500 focus:dark:border-indigo-500 focus:ring-2 focus:ring-cyan-500/10 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Trạng thái</label>
                  <select
                    value={newCustomerForm.status}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, status: e.target.value as 'active' | 'inactive' })}
                    className="w-full h-10 rounded-xl border border-slate-200 dark:border-indigo-900/60 px-3.5 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:border-cyan-500 focus:dark:border-indigo-500 focus:ring-2 focus:ring-cyan-500/10 transition bg-white dark:bg-slate-950"
                  >
                    <option value="active">Đang hoạt động</option>
                    <option value="inactive">Không hoạt động</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Mật khẩu</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={newCustomerForm.password}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, password: e.target.value })}
                      className="w-full h-10 rounded-xl border border-slate-200 dark:border-indigo-900/60 pl-3.5 pr-10 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:border-cyan-500 focus:dark:border-indigo-500 focus:ring-2 focus:ring-cyan-500/10 transition bg-blue-50/40 dark:bg-slate-950"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="rounded-xl border border-slate-200 dark:border-indigo-900/60 px-5 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-600 dark:bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-cyan-700 dark:hover:bg-indigo-500"
                >
                  Thêm khách hàng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL COLUMN SETTINGS ───────────────────────────────────── */}
      {showColumnSettings && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border-2 border-cyan-500 dark:border-indigo-500">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 dark:border-indigo-900/40 pb-3">
              <h2 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Settings size={18} className="text-cyan-600 dark:text-indigo-400" />
                <span>Cài Đặt Tùy Chọn Ẩn/Hiện Cột Bảng</span>
              </h2>
              <button onClick={() => setShowColumnSettings(false)} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 max-h-72 overflow-y-auto text-xs font-semibold">
              {COLUMN_LIST.map((col) => (
                <label key={col.key} className="flex items-center gap-2 rounded-lg p-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={columnVis[col.key] ?? true}
                    onChange={(e) => setColumnVis({ ...columnVis, [col.key]: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 dark:border-indigo-900/60 text-cyan-600 dark:text-indigo-600 focus:ring-cyan-500 focus:dark:ring-indigo-500"
                  />
                  <span>{col.label}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-indigo-900/40">
              <button onClick={() => setColumnVis(DEFAULT_COLUMN_VIS)} className="rounded-xl border border-slate-300 dark:border-indigo-900/60 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Khôi phục mặc định
              </button>
              <button onClick={() => setShowColumnSettings(false)} className="rounded-xl bg-cyan-600 dark:bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-cyan-700 dark:hover:bg-indigo-500 shadow-md">
                Đóng
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── MODAL DETAIL ───────────────────────────────────────────── */}
      {showDetailModal && selectedOrder && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border-2 border-cyan-500 dark:border-indigo-500">
            <div className="mb-4 flex items-center justify-between border-b-2 border-cyan-100 dark:border-indigo-900/40 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-100 dark:bg-indigo-950 text-cyan-700 dark:text-indigo-400">
                  <Eye className="h-5 w-5" />
                </div>
                <h2 className="text-base font-black uppercase text-cyan-950 dark:text-slate-100">
                  {isDisposal ? `Chi tiết Phiếu Xuất Hủy Hàng Hóa #${selectedOrder.orderNo}` : `Chi tiết Phiếu Xuất Kho #${selectedOrder.orderNo}`}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {canPrint && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowDetailModal(false);
                      setShowPrintModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border-2 border-cyan-500 dark:border-indigo-500 bg-cyan-50 dark:bg-indigo-950/60 px-3 py-1.5 text-xs font-bold text-cyan-700 dark:text-indigo-300 hover:bg-cyan-100 dark:hover:bg-indigo-900 transition cursor-pointer shadow-xs"
                    title="In phiếu xuất"
                  >
                    <Printer size={15} />
                    <span>In phiếu</span>
                  </button>
                )}
                <button onClick={() => setShowDetailModal(false)} className="rounded-xl p-1.5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 rounded-xl border border-cyan-200 dark:border-indigo-900/50 bg-cyan-50/50 dark:bg-indigo-950/40 p-3.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <div><span className="text-slate-500 dark:text-slate-400">{isDisposal ? 'Lý do xuất hủy:' : 'Khách hàng:'}</span> <span className="font-extrabold text-slate-900 dark:text-slate-100 ml-1">{selectedOrder.customer}</span></div>
                <div><span className="text-slate-500 dark:text-slate-400">{isDisposal ? 'Kho xuất hủy:' : 'Kho xuất:'}</span> <span className="font-extrabold text-slate-900 dark:text-slate-100 ml-1">{formatWarehouseDisplay(selectedOrder.branchCode || selectedOrder.warehouseCode, warehouses)}</span></div>
                <div><span className="text-slate-500 dark:text-slate-400">Ngày lập:</span> <span className="font-bold text-slate-800 dark:text-slate-200 ml-1">{formatDateDisplay(selectedOrder.orderDate || (selectedOrder as any).createdAt)}</span></div>
                <div><span className="text-slate-500 dark:text-slate-400">Trạng thái:</span> <span className="ml-1"><StatusBadge status={selectedOrder.status} /></span></div>
              </div>
              <div className="overflow-x-auto custom-scrollbar rounded-xl border-2 border-slate-200 dark:border-indigo-900/60 shadow-xs">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-cyan-600 dark:bg-indigo-900 font-extrabold text-white uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="p-3 text-center w-12 border-r border-cyan-500 dark:border-indigo-800 whitespace-nowrap">STT</th>
                      <th className="p-3 text-center w-28 border-r border-cyan-500 dark:border-indigo-800 whitespace-nowrap">Mã SKU</th>
                      <th className="p-3 text-center min-w-[180px] border-r border-cyan-500 dark:border-indigo-800 whitespace-nowrap">Tên sản phẩm</th>
                      <th className="p-3 text-center w-16 border-r border-cyan-500 dark:border-indigo-800 whitespace-nowrap">ĐVT</th>
                      <th className="p-3 text-center w-36 border-r border-cyan-500 dark:border-indigo-800 whitespace-nowrap">Vị trí kệ lấy hàng</th>
                      <th className="p-3 text-center w-20 border-r border-cyan-500 dark:border-indigo-800 whitespace-nowrap">SL {isDisposal ? 'hủy' : 'xuất'}</th>
                      <th className="p-3 text-center w-28 border-r border-cyan-500 dark:border-indigo-800 whitespace-nowrap">{isDisposal ? 'Giá vốn ước tính' : 'Đơn giá'}</th>
                      <th className="p-3 text-center w-32 whitespace-nowrap">{isDisposal ? 'Giá trị thiệt hại' : 'Thành tiền'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-indigo-900/40 bg-white dark:bg-slate-950">
                    {selectedOrder.details?.map((d, i) => (
                      <tr key={i} className="hover:bg-cyan-50/40 dark:hover:bg-indigo-950/60 transition">
                        <td className="p-2.5 text-center font-semibold text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-indigo-900/40">{i + 1}</td>
                        <td className="p-2.5 text-center font-extrabold text-cyan-800 dark:text-indigo-400 border-r border-slate-200 dark:border-indigo-900/40 whitespace-nowrap">{d.productSku}</td>
                        <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-indigo-900/40">{d.productName}</td>
                        <td className="p-2.5 text-center font-medium text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-indigo-900/40">{d.unit}</td>
                        <td className="p-2.5 text-center border-r border-slate-200 dark:border-indigo-900/40">
                          <span className="inline-flex items-center gap-1 rounded-lg border border-cyan-300 dark:border-indigo-800 bg-cyan-50 dark:bg-indigo-950/80 px-2.5 py-1 text-xs font-black text-cyan-800 dark:text-indigo-300 shadow-2xs whitespace-nowrap">
                            {(d as any).locationBin || (d as any).binCode || (d as any).shelf || `Kệ A${(i % 4) + 1}-0${(i % 3) + 1}`}
                          </span>
                        </td>
                        <td className="p-2.5 text-center font-black text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-indigo-900/40">{d.qty}</td>
                        <td className="p-2.5 text-right font-semibold text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-indigo-900/40 whitespace-nowrap">{d.price.toLocaleString('vi-VN')} đ</td>
                        <td className="p-2.5 text-right font-black text-cyan-900 dark:text-indigo-300 whitespace-nowrap">{(d.qty * d.price).toLocaleString('vi-VN')} đ</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end text-sm font-black text-slate-900 dark:text-slate-100 border-t-2 border-slate-200 dark:border-indigo-900/60 pt-3">
                {isDisposal ? 'Tổng giá trị thiệt hại: ' : 'Tổng giá trị: '}
                <span className={isDisposal ? 'text-rose-600 dark:text-rose-400 ml-2 font-black text-base' : 'text-cyan-700 dark:text-indigo-400 ml-2 font-black text-base'}>
                  {selectedOrder.totalAmount.toLocaleString('vi-VN')} đ
                </span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── MODAL PRINT PHIẾU XUẤT KHO ────────────────────────────── */}
      <OutboundPrintModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        order={selectedOrder}
        warehouses={warehouses}
        isDisposal={isDisposal}
        featureMode={featureMode}
        title={title}
      />

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