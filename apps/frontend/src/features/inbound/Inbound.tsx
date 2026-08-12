import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
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
} from 'lucide-react';
import BarcodeScanner, { type ScannedProduct } from '../../shared/components/BarcodeScanner';

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

const DEFAULT_FALLBACK_WAREHOUSES: WarehouseOption[] = [
  { id: '1', code: 'SPX001', name: 'SPX Express' },
  { id: '2', code: 'KHO-MAIN', name: 'Kho Tổng' },
  { id: '3', code: 'KHO-NVL', name: 'Kho Nguyên Vật Liệu' },
  { id: '4', code: 'KHO-123', name: 'Kho 123' },
];

function formatWarehouseDisplay(codeOrName?: string, warehouseList: WarehouseOption[] = []): string {
  if (!codeOrName) return 'SPX Express';
  const found = warehouseList.find((w) => w.code === codeOrName || w.name === codeOrName || w.id === codeOrName);
  if (found) return found.name;
  if (codeOrName === '4445') return 'SPX Express';
  return codeOrName;
}

const DEFAULT_FALLBACK_SUPPLIERS: SupplierOption[] = [
  { id: 'sup-0', supplierCode: '999', name: '999 - Nhà cung cấp mặc định', phone: '0281234567', address: 'TP.HCM' },
  { id: 'sup-1', supplierCode: 'NCC001', name: 'Hoàng Gia Electronics', phone: '0281234567', address: '123 Nguyễn Huệ, Q1, TP.HCM', taxCode: '0301234567' },
  { id: 'sup-2', supplierCode: 'NCC002', name: 'Phú Thành Foods', phone: '0281234568', address: '456 Lê Lợi, Q3, TP.HCM', taxCode: '0301234568' },
  { id: 'sup-3', supplierCode: 'NCC003', name: 'Minh Tâm Textiles', phone: '0281234569', address: '789 Trần Hưng Đạo, Q5, TP.HCM', taxCode: '0301234569' },
  { id: 'sup-4', supplierCode: 'NCC004', name: 'Apple Vietnam Authorized Distributor', phone: '0283999888', address: 'Tòa nhà Phú Mỹ Hưng, Q7, TP.HCM', taxCode: '0308889991' },
  { id: 'sup-5', supplierCode: 'NCC005', name: 'Samsung Electronics Vietnam', phone: '0222388899', address: 'KCN Yên Phong, Bắc Ninh', taxCode: '2300123456' },
];

const DEFAULT_FALLBACK_PRODUCTS: ProductOption[] = [
  { id: 'prod-1', internalSku: 'SP-DT-001', name: 'Tai nghe Bluetooth Sony WH-1000XM5', unit: 'Cái', purchasePrice: 6200000, salePrice: 7500000 },
  { id: 'prod-2', internalSku: 'SP-DT-002', name: 'Ổ cứng SSD Samsung 1TB 870 EVO', unit: 'Cái', purchasePrice: 2200000, salePrice: 2800000 },
  { id: 'prod-3', internalSku: 'SP-DT-003', name: 'Chuột không dây Logitech MX Master 3S', unit: 'Cái', purchasePrice: 1750000, salePrice: 2200000 },
  { id: 'prod-4', internalSku: 'SP-DT-006', name: 'MacBook Pro 14 inch M3 Max 36GB/1TB', unit: 'Cái', purchasePrice: 58000000, salePrice: 64500000 },
  { id: 'prod-5', internalSku: 'SP-DT-007', name: 'iPhone 15 Pro Max 256GB Natural Titanium', unit: 'Cái', purchasePrice: 31000000, salePrice: 34990000 },
  { id: 'prod-6', internalSku: 'SP-TP-001', name: 'Gạo ST25 Sóc Trăng 5kg', unit: 'Bao', purchasePrice: 130000, salePrice: 160000 },
  { id: 'prod-7', internalSku: 'SP-TP-006', name: 'Sữa tươi tiệt trùng Vinamilk 100% 1L (Thùng 12)', unit: 'Thùng', purchasePrice: 360000, salePrice: 420000 },
  { id: 'prod-8', internalSku: 'SP-VL-001', name: 'Vải Lụa Tơ Tằm Cao Cấp', unit: 'Cuộn', purchasePrice: 850000, salePrice: 1200000 },
];

const DEFAULT_FALLBACK_ORDERS: InboundReceiptOrder[] = [
  {
    id: 'ord-1001',
    receiptNo: 'PNK-2026-0001',
    supplier: 'Apple Vietnam Authorized Distributor',
    supplierId: 'sup-4',
    supplierPhone: '0283999888',
    supplierAddress: 'Tòa nhà Phú Mỹ Hưng, Q7, TP.HCM',
    warehouseCode: 'KHO-TONG',
    employeeName: 'Trần Văn Nam (Quản lý kho)',
    orderDate: '12/08/2026',
    status: 'completed',
    description: 'Nhập lô hàng iPhone & MacBook chính hãng đợt 1 tháng 8',
    subtotal: 639900000,
    discount: 0,
    vatAmount: 0,
    totalAmount: 639900000,
    amountPaid: 639900000,
    itemsCount: 2,
    totalQty: 15,
    details: [
      {
        id: 'det-1',
        productId: 'prod-4',
        productSku: 'SP-DT-006',
        productName: 'MacBook Pro 14 inch M3 Max 36GB/1TB',
        unit: 'Cái',
        qty: 5,
        price: 58000000,
        totalLineAmount: 290000000,
      },
      {
        id: 'det-2',
        productId: 'prod-5',
        productSku: 'SP-DT-007',
        productName: 'iPhone 15 Pro Max 256GB Natural Titanium',
        unit: 'Cái',
        qty: 10,
        price: 34990000,
        totalLineAmount: 349900000,
      },
    ],
  },
  {
    id: 'ord-1002',
    receiptNo: 'PNK-2026-0002',
    supplier: 'Samsung Electronics Vietnam',
    supplierId: 'sup-5',
    supplierPhone: '0222388899',
    supplierAddress: 'KCN Yên Phong, Bắc Ninh',
    warehouseCode: 'KHO-HN',
    employeeName: 'Nguyễn Thị Hoa (Kho Hà Nội)',
    orderDate: '11/08/2026',
    status: 'completed',
    description: 'Nhập phụ kiện và tai nghe Sony, SSD Samsung',
    subtotal: 137000000,
    discount: 2000000,
    vatAmount: 0,
    totalAmount: 135000000,
    amountPaid: 135000000,
    itemsCount: 2,
    totalQty: 35,
    details: [
      {
        id: 'det-3',
        productId: 'prod-2',
        productSku: 'SP-DT-002',
        productName: 'Ổ cứng SSD Samsung 1TB 870 EVO',
        unit: 'Cái',
        qty: 20,
        price: 2200000,
        totalLineAmount: 44000000,
      },
      {
        id: 'det-4',
        productId: 'prod-1',
        productSku: 'SP-DT-001',
        productName: 'Tai nghe Bluetooth Sony WH-1000XM5',
        unit: 'Cái',
        qty: 15,
        price: 6200000,
        totalLineAmount: 93000000,
      },
    ],
  },
  {
    id: 'ord-1003',
    receiptNo: 'PNK-2026-0003',
    supplier: 'Hoàng Gia Electronics',
    supplierId: 'sup-1',
    supplierPhone: '0281234567',
    supplierAddress: '123 Nguyễn Huệ, Q1, TP.HCM',
    warehouseCode: 'KHO-BD',
    employeeName: 'Lê Hoàng Anh',
    orderDate: '10/08/2026',
    status: 'completed',
    description: 'Nhập lô chuột không dây Logitech MX Master 3S',
    subtotal: 52500000,
    discount: 500000,
    vatAmount: 0,
    totalAmount: 52000000,
    amountPaid: 50000000,
    itemsCount: 1,
    totalQty: 30,
    details: [
      {
        id: 'det-5',
        productId: 'prod-3',
        productSku: 'SP-DT-003',
        productName: 'Chuột không dây Logitech MX Master 3S',
        unit: 'Cái',
        qty: 30,
        price: 1750000,
        totalLineAmount: 52500000,
      },
    ],
  },
  {
    id: 'ord-1004',
    receiptNo: 'PNK-2026-0004',
    supplier: 'Phú Thành Foods',
    supplierId: 'sup-2',
    supplierPhone: '0281234568',
    supplierAddress: '456 Lê Lợi, Q3, TP.HCM',
    warehouseCode: 'KHO-CUCHI',
    employeeName: 'Phạm Minh Tuấn',
    orderDate: '09/08/2026',
    status: 'completed',
    description: 'Nhập lương thực thực phẩm kho lạnh Củ Chi',
    subtotal: 42500000,
    discount: 0,
    vatAmount: 0,
    totalAmount: 42500000,
    amountPaid: 42500000,
    itemsCount: 2,
    totalQty: 150,
    details: [
      {
        id: 'det-6',
        productId: 'prod-6',
        productSku: 'SP-TP-001',
        productName: 'Gạo ST25 Sóc Trăng 5kg',
        unit: 'Bao',
        qty: 50,
        price: 130000,
        totalLineAmount: 6500000,
      },
      {
        id: 'det-7',
        productId: 'prod-7',
        productSku: 'SP-TP-006',
        productName: 'Sữa tươi tiệt trùng Vinamilk 100% 1L (Thùng 12)',
        unit: 'Thùng',
        qty: 100,
        price: 360000,
        totalLineAmount: 36000000,
      },
    ],
  },
  {
    id: 'ord-1005',
    receiptNo: 'PNK-2026-0005',
    supplier: 'Minh Tâm Textiles',
    supplierId: 'sup-3',
    supplierPhone: '0281234569',
    supplierAddress: '789 Trần Hưng Đạo, Q5, TP.HCM',
    warehouseCode: 'KHO-DN',
    employeeName: 'Vũ Thị Thanh',
    orderDate: '08/08/2026',
    status: 'pending',
    description: 'Đơn hàng nhập vải nguyên liệu kho Đà Nẵng (Đang kiểm kê)',
    subtotal: 85000000,
    discount: 1000000,
    vatAmount: 0,
    totalAmount: 84000000,
    amountPaid: 0,
    itemsCount: 1,
    totalQty: 100,
    details: [
      {
        id: 'det-8',
        productId: 'prod-8',
        productSku: 'SP-VL-001',
        productName: 'Vải Lụa Tơ Tằm Cao Cấp',
        unit: 'Cuộn',
        qty: 100,
        price: 850000,
        totalLineAmount: 85000000,
      },
    ],
  },
];

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

function createNewInboundTab(tabIndex = 1, currentUserName = 'Quản lý kho', defaultBranch = 'SPX001'): InboundTab {
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

export default function Inbound() {
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

  // Form Section Visibility (Default false so Order List is shown first!)
  const [showFormModal, setShowFormModal] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
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
            warehouseCode: item.warehouseCode || 'SPX001',
            employeeName: item.creatorName || currentUserName,
            orderDate: item.orderDate ? new Date(item.orderDate).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN'),
            expectedDate: item.expectedDate ? new Date(item.expectedDate).toLocaleDateString('vi-VN') : '',
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
              totalLineAmount: Number(d.totalLineAmount || (Number(d.expectedQty || d.receivedQty || d.qty || 1) * Number(d.unitPrice || d.price || 0)) || 0),
            })) || [],
          }));
          setOrders(formatted);
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
        if (wList.length > 0) setWarehouses(wList);
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu Nhập Kho:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUserName]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      setShowFormModal(false);
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
    updateActiveTab((tab) => {
      const details = [...tab.details];
      const emptyIdx = details.findIndex((r) => !r.productId && !r.productName);
      const price = scanned.purchasePrice || 50000;
      const newRow: FormDetailRow = {
        rowId: `row-${Date.now()}-${Math.random()}`,
        productId: scanned.id,
        productSku: scanned.internalSku || '',
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
      return { ...tab, details };
    });
    setShowScannerModal(false);
    setToast({ message: `Đã thêm sản phẩm quét: ${scanned.name}`, type: 'success' });
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
    setShowFormModal(true);
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
      supplierId: activeTab.supplierId || suppliers[0]?.id,
      supplierName: activeTab.supplier || suppliers[0]?.name || 'Nhà cung cấp',
      warehouseCode: activeTab.branchCode || 'SPX001',
      branchCode: activeTab.branchCode || 'SPX001',
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
        warehouseCode: activeTab.branchCode || 'SPX001',
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
        warehouseCode: activeTab.branchCode || 'SPX001',
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
      warehouseCode: activeTab.branchCode || 'SPX001',
      employeeName: activeTab.employeeName || currentUserName,
      orderDate: activeTab.orderDate || new Date().toLocaleDateString('vi-VN'),
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

      setShowFormModal(false);
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

  return (
    <div className={`min-h-screen bg-slate-100/80 p-3 sm:p-4 text-slate-800 ${isFullScreen ? 'fixed inset-0 z-[9000] bg-white overflow-y-auto p-4' : ''}`}>
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />

      {/* ═══ WHEN FORM IS CLOSED: SHOW BREADCRUMB, TITLE, RIC TOOLBAR & ORDER LIST TABLE ═══ */}
      {!showFormModal ? (
        <>
          {/* Top Breadcrumb */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Home className="h-3.5 w-3.5 text-cyan-600" />
              <Link to="/dashboard" className="text-cyan-600 hover:underline font-medium">
                Home
              </Link>
              <span className="text-slate-400">·</span>
              <span className="text-slate-700 font-semibold">Nhập hàng</span>
            </div>
          </div>

          <div className="mb-3">
            <h1 className="text-xl font-black text-slate-800 uppercase tracking-wide">DANH SÁCH PHIẾU NHẬP KHO HÀNG HÓA</h1>
          </div>

          {/* RIC Colored Toolbar */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2 bg-slate-50 border border-slate-200 rounded-lg p-2">
            <button
              onClick={() => {
                const newTab = createNewInboundTab(tabs.length + 1, currentUserName);
                setTabs([newTab]);
                setActiveTabId(newTab.tabId);
                setShowFormModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 cursor-pointer"
              style={{ background: '#4CAF50' }}
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm
            </button>

            <button
              onClick={handleCopySelected}
              className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 cursor-pointer"
              style={{ background: '#2196F3' }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </button>

            <button
              onClick={handleDeleteSelected}
              className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 cursor-pointer"
              style={{ background: '#F44336' }}
            >
              <X className="h-3.5 w-3.5" />
              Xóa
            </button>

            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 cursor-pointer"
              style={{ background: '#E91E63' }}
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>

            <button
              onClick={() => {
                if (selectedIds.size > 0) {
                  const o = orders.find((ord) => selectedIds.has(ord.id));
                  if (o) {
                    setSelectedOrder(o);
                    setShowDetailModal(true);
                    setTimeout(() => window.print(), 300);
                    return;
                  }
                }
                window.print();
              }}
              className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 cursor-pointer"
              style={{ background: '#E91E63' }}
            >
              <Printer className="h-3.5 w-3.5" />
              Print Chi tiết
            </button>

            <button
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
              className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 cursor-pointer"
              style={{ background: '#00897B' }}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Excel
            </button>

            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 cursor-pointer"
              style={{ background: '#00BCD4' }}
            >
              <FileDown className="h-3.5 w-3.5" />
              PDF
            </button>

            <div className="w-px h-6 bg-slate-300 mx-1 hidden sm:block" />

            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-slate-600">Từ ngày:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-slate-600">Đến ngày:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium outline-none focus:border-cyan-500"
              />
            </div>

            <div className="w-px h-6 bg-slate-300 mx-1 hidden sm:block" />

            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showDetail}
                onChange={(e) => setShowDetail(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-600">Hiện chi tiết</span>
            </label>

            <button
              onClick={() => loadData()}
              className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 cursor-pointer"
              style={{ background: '#4CAF50' }}
            >
              <Search className="h-3.5 w-3.5" />
              Tìm kiếm
            </button>

            <button
              onClick={handleResetSampleData}
              className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 cursor-pointer"
              style={{ background: '#FF9800' }}
              title="Reset dữ liệu mẫu chuẩn Nhập Kho"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Dữ liệu
            </button>

            <button
              onClick={() => setShowColumnSettings(true)}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md shadow-sm text-white transition hover:opacity-90 cursor-pointer"
              style={{ background: '#00BCD4' }}
              title="Hiện/Ẩn cột"
            >
              <Settings className="h-4 w-4" />
            </button>

            <button
              onClick={toggleBrowserFullscreen}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md shadow-sm bg-slate-200 text-slate-700 hover:bg-slate-300 transition cursor-pointer"
              title="Toàn màn hình"
            >
              {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>

          {/* Drag & Drop hint & Search Bar */}
          <div className="text-xs text-slate-400 italic mb-1 px-1">
            Drag a column header and drop it here to group by that column
          </div>

          <div className="flex items-center gap-2 mb-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 text-xs font-medium outline-none transition focus:border-cyan-500"
                placeholder="Tìm theo mã phiếu, nhà cung cấp, số điện thoại, nhân viên..."
              />
            </div>
          </div>

          {/* Main Order List Table */}
          <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] border-collapse text-xs">
                <thead>
                  <tr style={{ background: 'linear-gradient(180deg, #e0f2fe 0%, #bae6fd 100%)' }}>
                    <th className="w-10 border border-slate-300 px-2 py-2 text-center font-bold text-slate-700">No.</th>
                    <th className="w-10 border border-slate-300 px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={paginatedOrders.length > 0 && selectedIds.size === paginatedOrders.length}
                        onChange={toggleSelectAll}
                        className="h-3.5 w-3.5 rounded border-slate-400 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                      />
                    </th>
                    <th className="w-16 border border-slate-300 px-1 py-2 text-center font-bold text-slate-700">Thao tác</th>
                    {columnVis.branch && (
                      <th className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-700">
                        <div className="flex items-center justify-center gap-1">
                          Kho <Filter className="h-2.5 w-2.5 text-slate-500" />
                        </div>
                      </th>
                    )}
                    {columnVis.nv && (
                      <th className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-700">
                        <div className="flex items-center justify-center gap-1">
                          NV <Filter className="h-2.5 w-2.5 text-slate-500" />
                        </div>
                      </th>
                    )}
                    {columnVis.code && (
                      <th className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-700">
                        <div className="flex items-center justify-center gap-1">
                          Mã <Filter className="h-2.5 w-2.5 text-slate-500" />
                        </div>
                      </th>
                    )}
                    {columnVis.date && (
                      <th className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-700">
                        <div className="flex items-center justify-center gap-1">
                          Ngày <Filter className="h-2.5 w-2.5 text-slate-500" />
                        </div>
                      </th>
                    )}
                    {columnVis.supplierName && (
                      <th className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-700">
                        <div className="flex items-center justify-center gap-1">
                          Tên NCC <Filter className="h-2.5 w-2.5 text-slate-500" />
                        </div>
                      </th>
                    )}
                    {columnVis.supplierAddress && (
                      <th className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-700">
                        <div className="flex items-center justify-center gap-1">
                          Địa chỉ <Filter className="h-2.5 w-2.5 text-slate-500" />
                        </div>
                      </th>
                    )}
                    {columnVis.supplierPhone && (
                      <th className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-700">
                        <div className="flex items-center justify-center gap-1">
                          Tel <Filter className="h-2.5 w-2.5 text-slate-500" />
                        </div>
                      </th>
                    )}
                    {columnVis.subtotal && (
                      <th className="border border-slate-300 px-2 py-2 text-right font-bold text-slate-700">
                        <div className="flex items-center justify-end gap-1">
                          Thành tiền <Filter className="h-2.5 w-2.5 text-slate-500" />
                        </div>
                      </th>
                    )}
                    {columnVis.discount && (
                      <th className="border border-slate-300 px-2 py-2 text-right font-bold text-slate-700">
                        <div className="flex items-center justify-end gap-1">
                          CK <Filter className="h-2.5 w-2.5 text-slate-500" />
                        </div>
                      </th>
                    )}
                    {columnVis.vat && (
                      <th className="border border-slate-300 px-2 py-2 text-right font-bold text-slate-700">
                        <div className="flex items-center justify-end gap-1">
                          VAT <Filter className="h-2.5 w-2.5 text-slate-500" />
                        </div>
                      </th>
                    )}
                    {columnVis.totalAmount && (
                      <th className="border border-slate-300 px-2 py-2 text-right font-bold text-slate-800">
                        <div className="flex items-center justify-end gap-1">
                          Tổng tiền <Filter className="h-2.5 w-2.5 text-slate-500" />
                        </div>
                      </th>
                    )}
                    {columnVis.amountPaid && (
                      <th className="border border-slate-300 px-2 py-2 text-right font-semibold text-emerald-700">
                        <div className="flex items-center justify-end gap-1">
                          Thanh toán <Filter className="h-2.5 w-2.5 text-slate-500" />
                        </div>
                      </th>
                    )}
                    {columnVis.note && (
                      <th className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-700">
                        <div className="flex items-center justify-center gap-1">
                          Ghi chú <Filter className="h-2.5 w-2.5 text-slate-500" />
                        </div>
                      </th>
                    )}
                    {columnVis.status && (
                      <th className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-700">
                        <div className="flex items-center justify-center gap-1">
                          Trạng thái <Filter className="h-2.5 w-2.5 text-slate-500" />
                        </div>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={17} className="p-8 text-center text-slate-400 font-semibold">
                        Đang tải danh sách phiếu nhập kho...
                      </td>
                    </tr>
                  ) : paginatedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={17} className="p-8 text-center text-slate-400 font-semibold">
                        Không tìm thấy phiếu nhập kho nào
                      </td>
                    </tr>
                  ) : (
                    paginatedOrders.map((ord, index) => {
                      const isSelected = selectedIds.has(ord.id);
                      return (
                        <React.Fragment key={ord.id}>
                          <tr className={`hover:bg-cyan-50/50 transition cursor-pointer ${isSelected ? 'bg-cyan-100/50' : ''}`}>
                            <td className="border border-slate-200 px-2 py-2 text-center font-bold text-slate-500">
                              {(currentPage - 1) * pageSize + index + 1}
                            </td>
                            <td className="border border-slate-200 px-2 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectOne(ord.id)}
                                className="h-3.5 w-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                              />
                            </td>
                            <td className="border border-slate-200 px-1 py-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleEditOrder(ord)}
                                  title="Sửa phiếu nhập"
                                  className="rounded p-1 text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition cursor-pointer"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedOrder(ord);
                                    setShowDetailModal(true);
                                  }}
                                  title="Xem chi tiết"
                                  className="rounded p-1 text-slate-500 hover:bg-cyan-50 hover:text-cyan-600 transition cursor-pointer"
                                >
                                  <Eye size={14} />
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedOrder(ord);
                                    setShowPrintModal(true);
                                  }}
                                  title="In phiếu nhập"
                                  className="rounded p-1 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 transition cursor-pointer"
                                >
                                  <Printer size={14} />
                                </button>
                              </div>
                            </td>
                            {columnVis.branch && (
                              <td className="border border-slate-200 px-2 py-2 text-center font-bold text-slate-700">
                                {formatWarehouseDisplay(ord.warehouseCode, warehouses)}
                              </td>
                            )}
                            {columnVis.nv && <td className="border border-slate-200 px-2 py-2 text-center font-medium text-slate-600">{ord.employeeName || currentUserName}</td>}
                            {columnVis.code && (
                              <td className="border border-slate-200 px-2 py-2 font-bold text-cyan-700">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedOrder(ord);
                                    setShowDetailModal(true);
                                  }}
                                  className="text-cyan-700 hover:text-cyan-900 hover:underline font-bold text-left cursor-pointer"
                                  title="Bấm để xem thông tin chi tiết đơn nhập"
                                >
                                  {ord.receiptNo}
                                </button>
                              </td>
                            )}
                            {columnVis.date && <td className="border border-slate-200 px-2 py-2 text-center font-medium text-slate-600">{ord.orderDate}</td>}
                            {columnVis.supplierName && <td className="border border-slate-200 px-2 py-2 font-semibold text-slate-800">{ord.supplier}</td>}
                            {columnVis.supplierAddress && <td className="border border-slate-200 px-2 py-2 text-slate-600 max-w-[150px] truncate">{ord.supplierAddress || '-'}</td>}
                            {columnVis.supplierPhone && <td className="border border-slate-200 px-2 py-2 text-slate-600">{ord.supplierPhone || '-'}</td>}
                            {columnVis.subtotal && <td className="border border-slate-200 px-2 py-2 text-right font-medium text-slate-700">{(ord.subtotal || ord.totalAmount).toLocaleString('vi-VN')} đ</td>}
                            {columnVis.discount && <td className="border border-slate-200 px-2 py-2 text-right font-medium text-slate-500">{(ord.discount || 0).toLocaleString('vi-VN')}</td>}
                            {columnVis.vat && <td className="border border-slate-200 px-2 py-2 text-right font-medium text-slate-500">{(ord.vatAmount || 0).toLocaleString('vi-VN')}</td>}
                            {columnVis.totalAmount && <td className="border border-slate-200 px-2 py-2 text-right font-black text-slate-900">{ord.totalAmount.toLocaleString('vi-VN')} đ</td>}
                            {columnVis.amountPaid && <td className="border border-slate-200 px-2 py-2 text-right font-bold text-emerald-700">{(ord.amountPaid || ord.totalAmount).toLocaleString('vi-VN')} đ</td>}
                            {columnVis.note && <td className="border border-slate-200 px-2 py-2 text-slate-500 max-w-[120px] truncate">{ord.description || '-'}</td>}
                            {columnVis.status && (
                              <td className="border border-slate-200 px-2 py-2 text-center">
                                <StatusBadge status={ord.status} />
                              </td>
                            )}
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
                                        <th className="p-1.5">SKU</th>
                                        <th className="p-1.5">Tên sản phẩm</th>
                                        <th className="p-1.5 text-center">ĐVT</th>
                                        <th className="p-1.5 text-center">Số lượng</th>
                                        <th className="p-1.5 text-right">Đơn giá</th>
                                        <th className="p-1.5 text-right">Thành tiền</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {ord.details.map((d, dIdx) => (
                                        <tr key={dIdx}>
                                          <td className="p-1.5 font-bold text-cyan-700">{d.productSku}</td>
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600">
              <div>
                Hiển thị {filteredOrders.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} -{' '}
                {Math.min(currentPage * pageSize, filteredOrders.length)} trên tổng {filteredOrders.length} phiếu nhập
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  className="rounded-lg border border-slate-300 p-1.5 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronsLeft size={16} />
                </button>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-300 p-1.5 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>
                <span>Trang {currentPage} / {totalPages}</span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg border border-slate-300 p-1.5 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className="rounded-lg border border-slate-300 p-1.5 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* ═══ WHEN FORM IS OPEN: HIDE TOP TITLE & RIC TOOLBAR, FORM TAKES OVER THE ENTIRE AREA ═══ */
        <div className="rounded-2xl bg-white border-2 border-cyan-500/40 shadow-md overflow-hidden animate-[fadeIn_0.2s_ease-out] flex flex-col min-h-[calc(100vh-32px)]">
          {/* Form Header Bar */}
          <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-3 py-2 text-white">
            <div className="flex items-center gap-1 overflow-x-auto">
              {tabs.map((tab) => {
                const isActive = tab.tabId === activeTabId;
                return (
                  <div
                    key={tab.tabId}
                    onClick={() => setActiveTabId(tab.tabId)}
                    className={`group relative flex items-center gap-2 rounded-t-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                      isActive
                        ? 'bg-white text-cyan-900 border-t-2 border-cyan-500 shadow-sm'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    <Package size={14} className={isActive ? 'text-cyan-600' : 'text-slate-400'} />
                    <span>{tab.title}</span>
                    <button
                      onClick={(e) => handleCloseTab(tab.tabId, e)}
                      className="ml-1 rounded-full p-0.5 hover:bg-slate-200 hover:text-slate-800 transition"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
              <button
                onClick={handleAddTab}
                className="inline-flex items-center gap-1 rounded-t-xl bg-slate-700/60 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-600 transition"
              >
                <Plus size={14} />
                <span>Thêm phiếu</span>
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-300">
              <span className="hidden sm:inline font-semibold">Nhân viên lập:</span>
              <span className="hidden sm:inline font-bold text-cyan-400">{activeTab?.employeeName}</span>

              {/* Fullscreen Button inside Form Header */}
              <button
                onClick={toggleBrowserFullscreen}
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition cursor-pointer"
                title="Toàn màn hình"
              >
                {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>

              {/* Close Form Button */}
              <button
                onClick={() => setShowFormModal(false)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-black text-white hover:bg-red-700 shadow-md transition cursor-pointer"
              >
                <X size={16} />
                <span>Đóng form nhập</span>
              </button>
            </div>
          </div>

          {/* Sub-Header Control Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 border-b border-slate-200 p-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-600">Ngày nhập hàng</label>
              <input
                type="text"
                value={activeTab.orderDate}
                onChange={(e) => updateActiveTab((t) => ({ ...t, orderDate: e.target.value }))}
                className="h-9 w-full rounded-xl border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-600">Mã phiếu / PO</label>
              <input
                type="text"
                value={activeTab.receiptNo}
                onChange={(e) => updateActiveTab((t) => ({ ...t, receiptNo: e.target.value }))}
                placeholder="Tự sinh nếu để trống..."
                className="h-9 w-full rounded-xl border border-slate-300 bg-slate-50 px-2.5 text-xs font-bold text-cyan-700 outline-none focus:border-cyan-500"
              />
            </div>

            <div className="relative supplier-dropdown-container">
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Building2 size={13} className="text-cyan-600" />
                  <span>Nhà cung cấp</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(true)}
                  className="text-cyan-600 hover:underline text-[11px] font-bold"
                >
                  + Thêm mới
                </button>
              </label>
              <input
                type="text"
                value={
                  showSupplierDropdown
                    ? supplierSearch
                    : activeTab.supplier || '999 - Nhà cung cấp mặc định'
                }
                onChange={(e) => {
                  setSupplierSearch(e.target.value);
                  setShowSupplierDropdown(true);
                }}
                onFocus={() => {
                  setSupplierSearch('');
                  setShowSupplierDropdown(true);
                }}
                onClick={() => setShowSupplierDropdown(true)}
                placeholder="Tìm nhà cung cấp..."
                className="h-9 w-full rounded-xl border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 cursor-text"
              />

              {showSupplierDropdown && (
                <div className="absolute left-0 top-full z-[100] mt-1 w-[380px] max-h-60 overflow-y-auto rounded-xl border border-slate-300 bg-white shadow-2xl flex flex-col">
                  <div className="flex bg-slate-100 border-b border-slate-300 px-3 py-2 text-[11px] font-bold text-slate-600 sticky top-0 z-10">
                    <span className="w-1/3 uppercase">Mã NCC</span>
                    <span className="w-1/3 uppercase">Tên NCC</span>
                    <span className="w-1/3 text-right uppercase">SĐT</span>
                  </div>
                  <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                    {filteredSuppliers.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400">Không tìm thấy nhà cung cấp</div>
                    ) : (
                      filteredSuppliers.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => {
                            updateActiveTab((t) => ({
                              ...t,
                              supplierId: s.id,
                              supplier: s.name,
                              supplierPhone: s.phone || '',
                              supplierAddress: s.address || '',
                            }));
                            setShowSupplierDropdown(false);
                          }}
                          className={`flex items-center px-3 py-2 cursor-pointer text-xs transition ${
                            activeTab.supplierId === s.id
                              ? 'bg-cyan-100 font-bold text-cyan-900'
                              : 'hover:bg-cyan-50 text-slate-700'
                          }`}
                        >
                          <span className="w-1/3 font-bold text-cyan-800">{s.supplierCode || 'NCC---'}</span>
                          <span className="w-1/3 font-semibold text-slate-800 truncate pr-1">{s.name}</span>
                          <span className="w-1/3 text-right text-slate-500">{s.phone || '-'}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-600">Kho nhập hàng</label>
              <select
                value={activeTab.branchCode}
                onChange={(e) => updateActiveTab((t) => ({ ...t, branchCode: e.target.value }))}
                className="h-9 w-full rounded-xl border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 cursor-pointer"
              >
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.code}>
                    {wh.name} ({wh.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Form Body Layout (Left POS Grid + Right Summary) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 sm:p-4 flex-1">

            {/* LEFT 8.5 COLUMNS: Product Table Grid */}
            <div className="lg:col-span-8 flex flex-col gap-3">
              <div className="flex-1 rounded-xl border border-slate-300 bg-white shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-cyan-800">
                    <Package size={16} className="text-cyan-600" />
                    <span>DANH SÁCH HÀNG HÓA NHẬP KHO ({tabCalculations.totalQty} SẢN PHẨM)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowScannerModal(true)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    >
                      <ScanLine size={13} className="text-cyan-600" />
                      <span>Quét mã</span>
                    </button>
                    <button
                      onClick={handleAddBlankRow}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-white hover:bg-amber-600 transition cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Thêm dòng mới</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto overflow-y-auto max-h-[560px] flex-1">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-20 border-b border-slate-300 uppercase">
                      <tr>
                        <th className="p-2 w-10 text-center border-r border-slate-200">No</th>
                        <th className="p-2 min-w-[220px] text-center border-r border-slate-200">Hàng hóa</th>
                        <th className="p-2 w-14 text-center border-r border-slate-200">Đv</th>
                        <th className="p-2 w-20 text-center border-r border-slate-200">Số lượng</th>
                        <th className="p-2 w-24 text-center border-r border-slate-200">Giá mua (đ)</th>
                        <th className="p-2 w-20 text-center border-r border-slate-200">Chiết khấu %</th>
                        <th className="p-2 w-16 text-center border-r border-slate-200">% VAT</th>
                        <th className="p-2 w-24 text-center border-r border-slate-200">Tiền VAT</th>
                        <th className="p-2 w-28 text-center border-r border-slate-200">Thành tiền</th>
                        <th className="p-2 w-24 text-center border-r border-slate-200">Ghi chú</th>
                        <th className="p-2 w-10 text-center">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {activeTab.details.map((row, idx) => {
                        const isEven = idx % 2 === 1;
                        const isDropdownOpen = activeProductDropdownRowId === row.rowId;
                        const rowFiltered = getFilteredProductsForRow(row.productName || row.productSku);

                        return (
                          <tr
                            key={row.rowId}
                            className={`${isEven ? 'bg-[#eafaf1]' : 'bg-white'} hover:bg-cyan-50/60 transition-colors`}
                          >
                            <td className="p-1.5 text-center font-bold text-slate-500 border-r border-slate-200">{idx + 1}</td>

                            <td className="p-1 border-r border-slate-200 relative product-dropdown-container">
                              <input
                                type="text"
                                value={row.productName ? `${row.productSku ? row.productSku + ' - ' : ''}${row.productName}` : ''}
                                onChange={(e) => {
                                  handleRowFieldChange(row.rowId, { productName: e.target.value });
                                  setActiveProductDropdownRowId(row.rowId);
                                }}
                                onFocus={() => setActiveProductDropdownRowId(row.rowId)}
                                onClick={() => setActiveProductDropdownRowId(row.rowId)}
                                placeholder="Chọn hoặc nhập hàng..."
                                className="h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-cyan-500 cursor-text"
                              />

                              {isDropdownOpen && (
                                <div className="absolute left-0 top-full z-[100] mt-1 w-[420px] max-h-60 overflow-y-auto rounded-xl border border-slate-300 bg-white shadow-2xl flex flex-col">
                                  <div className="flex bg-slate-100 border-b border-slate-300 px-3 py-2 text-[11px] font-bold text-slate-600 sticky top-0 z-10">
                                    <span className="w-1/3 uppercase">Mã hàng</span>
                                    <span className="w-1/2 uppercase">Tên hàng hóa</span>
                                    <span className="w-1/4 text-right uppercase">Giá mua</span>
                                  </div>
                                  <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                                    {rowFiltered.length === 0 ? (
                                      <div className="p-3 text-center text-xs text-slate-400">Không tìm thấy hàng hóa</div>
                                    ) : (
                                      rowFiltered.map((p) => (
                                        <div
                                          key={p.id}
                                          onClick={() => handleRowProductChange(row.rowId, p)}
                                          className="flex items-center px-3 py-2 hover:bg-cyan-50 cursor-pointer text-xs text-slate-700 transition"
                                        >
                                          <span className="w-1/3 font-bold text-cyan-800">{p.internalSku}</span>
                                          <span className="w-1/2 font-medium text-slate-800 truncate pr-1">{p.name}</span>
                                          <span className="w-1/4 text-right font-semibold text-slate-700">
                                            {Number(p.purchasePrice || p.salePrice || 0).toLocaleString('vi-VN')}
                                          </span>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )}
                            </td>

                            <td className="p-1 text-center border-r border-slate-200">
                              <input
                                type="text"
                                value={row.unit}
                                onChange={(e) => handleRowFieldChange(row.rowId, { unit: e.target.value })}
                                className="h-8 w-full text-center rounded border border-slate-200 bg-white text-xs font-semibold outline-none"
                              />
                            </td>

                            <td className="p-1 border-r border-slate-200">
                              <input
                                type="number"
                                min="0"
                                value={row.qty || ''}
                                onChange={(e) => handleRowFieldChange(row.rowId, { qty: Number(e.target.value) })}
                                className="h-8 w-full text-right px-2 rounded border border-slate-200 bg-white text-xs font-bold text-slate-900 outline-none focus:border-cyan-500"
                              />
                            </td>

                            <td className="p-1 border-r border-slate-200">
                              <input
                                type="number"
                                min="0"
                                value={row.price || ''}
                                onChange={(e) => handleRowFieldChange(row.rowId, { price: Number(e.target.value) })}
                                className="h-8 w-full text-right px-2 rounded border border-slate-200 bg-white text-xs font-medium text-slate-800 outline-none focus:border-cyan-500"
                              />
                            </td>

                            <td className="p-1 border-r border-slate-200">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={row.discountPercent || ''}
                                onChange={(e) => handleRowFieldChange(row.rowId, { discountPercent: Number(e.target.value) })}
                                className="h-8 w-full text-center rounded border border-slate-200 bg-white text-xs font-semibold outline-none"
                              />
                            </td>

                            <td className="p-1 border-r border-slate-200">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={row.vatPercent || ''}
                                onChange={(e) => handleRowFieldChange(row.rowId, { vatPercent: Number(e.target.value) })}
                                className="h-8 w-full text-center rounded border border-slate-200 bg-white text-xs font-semibold outline-none"
                              />
                            </td>

                            <td className="p-1 text-right font-semibold text-slate-600 border-r border-slate-200 pr-2">
                              {Number((row.totalAmount * (row.vatPercent || 0)) / 100).toLocaleString('vi-VN')}
                            </td>

                            <td className="p-1 text-right font-bold text-slate-900 border-r border-slate-200 pr-2">
                              {Number(row.totalAmount || 0).toLocaleString('vi-VN')}
                            </td>

                            <td className="p-1 border-r border-slate-200">
                              <input
                                type="text"
                                value={row.note || ''}
                                onChange={(e) => handleRowFieldChange(row.rowId, { note: e.target.value })}
                                placeholder="Ghi chú..."
                                className="h-8 w-full rounded border border-slate-200 bg-white px-1 text-xs outline-none"
                              />
                            </td>

                            <td className="p-1 text-center">
                              <button
                                onClick={() => handleRemoveRow(row.rowId)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 transition cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* RIGHT 3.5 COLUMNS: Calculations & Total Summary Panel */}
            <div className="lg:col-span-4 flex flex-col justify-between rounded-xl border border-slate-300 bg-slate-50 p-4 shadow-sm space-y-3">
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider border-b border-slate-200 pb-2">
                  THÔNG TIN THANH TOÁN NHẬP HÀNG
                </h3>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">Nhân viên lập phiếu:</label>
                  <select
                    value={activeTab.employeeName}
                    onChange={(e) => updateActiveTab((t) => ({ ...t, employeeName: e.target.value }))}
                    className="h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-bold text-slate-800 outline-none"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.fullName || u.email}>
                        {u.fullName || u.email}
                      </option>
                    ))}
                    {!users.some((u) => (u.fullName || u.email) === activeTab.employeeName) && (
                      <option value={activeTab.employeeName}>{activeTab.employeeName}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">Ghi chú phiếu nhập:</label>
                  <textarea
                    rows={2}
                    value={activeTab.description}
                    onChange={(e) => updateActiveTab((t) => ({ ...t, description: e.target.value }))}
                    placeholder="Ghi chú đơn hàng nhập kho..."
                    className="w-full rounded border border-slate-300 bg-white p-2 text-xs font-medium outline-none resize-none"
                  />
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-600">Chiết khấu đơn (đ):</span>
                  <input
                    type="number"
                    min="0"
                    value={activeTab.discount || ''}
                    onChange={(e) => updateActiveTab((t) => ({ ...t, discount: Number(e.target.value) }))}
                    className="h-7 w-28 text-right rounded border border-slate-300 px-2 font-bold outline-none"
                  />
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-600">Phí vận chuyển (đ):</span>
                  <input
                    type="number"
                    min="0"
                    value={activeTab.shippingFee || ''}
                    onChange={(e) => updateActiveTab((t) => ({ ...t, shippingFee: Number(e.target.value) }))}
                    className="h-7 w-28 text-right rounded border border-slate-300 px-2 font-bold outline-none"
                  />
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-600">Thuế VAT (%):</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={activeTab.vatRate}
                    onChange={(e) => updateActiveTab((t) => ({ ...t, vatRate: Number(e.target.value) }))}
                    className="h-7 w-20 text-right rounded border border-slate-300 px-2 font-bold outline-none"
                  />
                </div>

                <div className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 p-3 text-white shadow-md">
                  <p className="text-[11px] font-bold uppercase opacity-90">Tổng cộng thanh toán</p>
                  <p className="text-2xl font-black mt-0.5 tracking-tight">{tabCalculations.grandTotal.toLocaleString('vi-VN')} đ</p>
                </div>

                <div className="text-xs space-y-1">
                  <label className="block font-bold text-slate-700">Hình thức thanh toán:</label>
                  <div className="flex items-center gap-3">
                    {['Tiền mặt', 'Chuyển khoản', 'ATM'].map((method) => (
                      <label key={method} className="flex items-center gap-1 font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="paymentMethod"
                          checked={activeTab.paymentMethod === method}
                          onChange={() => updateActiveTab((t) => ({ ...t, paymentMethod: method }))}
                          className="h-3.5 w-3.5 text-cyan-600"
                        />
                        <span>{method}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">Tiền trả Nhà cung cấp:</span>
                  <input
                    type="number"
                    min="0"
                    value={activeTab.amountPaid || ''}
                    onChange={(e) => updateActiveTab((t) => ({ ...t, amountPaid: Number(e.target.value) }))}
                    className="h-8 w-28 text-right font-bold text-emerald-700 rounded border border-slate-300 px-2 outline-none"
                  />
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-600">Còn nợ NCC:</span>
                  <span className="font-bold text-red-600 text-sm">{tabCalculations.debt.toLocaleString('vi-VN')} đ</span>
                </div>
              </div>

              {/* Action Buttons Matching Screenshot Footer */}
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  onClick={() => handleSaveInboundOrder(false)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 cursor-pointer"
                  style={{ background: '#4CAF50' }}
                >
                  <Save className="h-3.5 w-3.5" />
                  Lưu
                </button>
                <button
                  onClick={() => handleSaveInboundOrder(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 cursor-pointer"
                  style={{ background: '#E91E63' }}
                >
                  <Printer className="h-3.5 w-3.5" />
                  In
                </button>
                <button
                  onClick={() => handleSaveInboundOrder(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 cursor-pointer"
                  style={{ background: '#2196F3' }}
                >
                  <Printer className="h-3.5 w-3.5" />
                  Lưu -&gt; In
                </button>
                <button
                  onClick={() => handleSaveInboundOrder(false)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 cursor-pointer"
                  style={{ background: '#FF9800' }}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Lưu tạm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-base font-black uppercase text-slate-900">Chi tiết Phiếu Nhập Kho #{selectedOrder.receiptNo}</h2>
              <button onClick={() => setShowDetailModal(false)} className="rounded-lg p-1 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
                <div><span className="text-slate-400">Nhà cung cấp:</span> <span className="font-bold">{selectedOrder.supplier}</span></div>
                <div><span className="text-slate-400">Kho nhập:</span> <span className="font-bold">{formatWarehouseDisplay(selectedOrder.warehouseCode, warehouses)}</span></div>
                <div><span className="text-slate-400">Ngày lập:</span> <span>{selectedOrder.orderDate}</span></div>
                <div><span className="text-slate-400">Trạng thái:</span> <StatusBadge status={selectedOrder.status} /></div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 font-bold text-slate-700 uppercase">
                    <tr>
                      <th className="p-2">Mã SKU</th>
                      <th className="p-2">Tên sản phẩm</th>
                      <th className="p-2 text-center">ĐVT</th>
                      <th className="p-2 text-center">SL</th>
                      <th className="p-2 text-right">Đơn giá</th>
                      <th className="p-2 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedOrder.details?.map((d, i) => (
                      <tr key={i}>
                        <td className="p-2 font-bold text-cyan-800">{d.productSku}</td>
                        <td className="p-2 font-semibold text-slate-800">{d.productName}</td>
                        <td className="p-2 text-center">{d.unit}</td>
                        <td className="p-2 text-center font-bold">{d.qty}</td>
                        <td className="p-2 text-right">{d.price.toLocaleString('vi-VN')} đ</td>
                        <td className="p-2 text-right font-bold">{(d.qty * d.price).toLocaleString('vi-VN')} đ</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end text-sm font-black text-slate-900 border-t border-slate-200 pt-3">
                Tổng giá trị: {selectedOrder.totalAmount.toLocaleString('vi-VN')} đ
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