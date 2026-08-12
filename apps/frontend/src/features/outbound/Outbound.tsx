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
  UploadCloud,
  ArrowUpDown,
  User
} from 'lucide-react';
import BarcodeScanner, { type ScannedProduct } from '../../shared/components/BarcodeScanner';
import { outboundApi, OutboundOrder, OutboundDetail, OutboundCreatePayload } from './api/outboundApi';

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

// ─── STATUS BADGE ──────────────────────────────────────────────

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
    <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-bold border ${config.color} ${config.bg} ${config.border}`}>
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
  salePrice?: number;
}

interface CustomerOption {
  id: string;
  customerCode: string;
  name: string;
  phone?: string;
  address?: string;
  accumulatedPoints?: number;
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

interface InvoiceTab {
  tabId: string;
  title: string;
  id?: string;
  orderNo: string;
  branchCode: string;
  employeeName: string;
  receiver: string;
  customer: string;
  customerId?: string;
  customerPhone: string;
  customerAddress: string;
  orderDate: string;
  description: string;
  discount: number;
  vatRate: number;
  paymentMethod: string;
  paymentAccount: string;
  amountPaid: number;
  status: string;
  details: FormDetailRow[];
}

const DEFAULT_ROWS_COUNT = 18;

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

function createNewInvoiceTab(tabIndex = 1, currentUserName = 'HUUDQtest'): InvoiceTab {
  const d = new Date();
  const dateFormatted = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;

  return {
    tabId: `tab-${Date.now()}-${tabIndex}`,
    title: `# ${tabIndex}`,
    orderNo: '', // 1: MHĐ (mã hóa đơn) mặc định là không có gì hết, nếu như không có mới tự sinh ra
    branchCode: '4445',
    employeeName: currentUserName || 'HUUDQtest',
    receiver: '', // 5: phần người nhận hàng khác mặc định trống
    customer: '',
    customerPhone: '',
    customerAddress: '',
    orderDate: dateFormatted,
    description: '',
    discount: 0,
    vatRate: 0,
    paymentMethod: 'Tiền mặt',
    paymentAccount: '',
    amountPaid: 0,
    status: 'Đã giao hàng',
    details: makeInitialRows(DEFAULT_ROWS_COUNT),
  };
}

export default function Outbound() {
  const [orders, setOrders] = useState<OutboundOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'success' as 'success' | 'error' });

  // Date filters
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });

  // Checkbox: Hiện chi tiết
  const [showDetail, setShowDetail] = useState(false);

  // Selected order IDs for bulk action
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Modals & Fullscreen Panel
  const [showFormModal, setShowFormModal] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);

  // Autocomplete / Dropdown States
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [activeProductDropdownRowId, setActiveProductDropdownRowId] = useState<string | null>(null);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');

  // Detail Modal data
  const [selectedOrder, setSelectedOrder] = useState<OutboundOrder | null>(null);

  // Master Data
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([
    { id: '1', code: '4445', name: 'Chi nhánh chính (4445)' },
    { id: '2', code: 'KHO_TONG', name: 'Kho Tổng Hà Nội' }
  ]);
  const [currentBranch, setCurrentBranch] = useState('4445');
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', phone: '', address: '', customerCode: '' });

  // Multi-tab invoice editing
  const [tabs, setTabs] = useState<InvoiceTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const currentUserName = currentUser.fullName || currentUser.email?.split('@')[0] || 'HUUDQtest';
  const currentUserEmail = currentUser.email || 'huu@ric.vn';
  const currentUserPhone = currentUser.phone || '097.247.8383';

  // ── Column Visibility ──────────────────────────────────────────
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
    // Details
    productSku: true,
    productName: true,
    unit: true,
    qty: true,
    price: true,
    lineDiscount: true,
    lineVat: true,
    lineTotal: true,
  };

  const COLUMN_LIST = [
    { key: 'branch', label: 'Chi nhánh', isDetail: false },
    { key: 'nv', label: 'NV', isDetail: false },
    { key: 'code', label: 'Mã', isDetail: false },
    { key: 'date', label: 'Ngày', isDetail: false },
    { key: 'customerName', label: 'Tên KH', isDetail: false },
    { key: 'customerAddress', label: 'Địa chỉ', isDetail: false },
    { key: 'customerPhone', label: 'Tel', isDetail: false },
    { key: 'subtotal', label: 'Thành tiền', isDetail: false },
    { key: 'discount', label: 'CK', isDetail: false },
    { key: 'vat', label: 'VAT', isDetail: false },
    { key: 'totalAmount', label: 'Tổng tiền', isDetail: false },
    { key: 'amountPaid', label: 'Thanh toán', isDetail: false },
    { key: 'note', label: 'Ghi chú', isDetail: false },
    { key: 'status', label: 'Giao hàng', isDetail: false },
    { key: 'productSku', label: 'Mã hàng', isDetail: true },
    { key: 'productName', label: 'Tên hàng', isDetail: true },
    { key: 'unit', label: 'ĐVT', isDetail: true },
    { key: 'qty', label: 'Số lượng', isDetail: true },
    { key: 'price', label: 'Đơn giá', isDetail: true },
    { key: 'lineDiscount', label: 'CK dòng', isDetail: true },
    { key: 'lineVat', label: 'VAT dòng', isDetail: true },
    { key: 'lineTotal', label: 'Thành tiền dòng', isDetail: true },
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

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  // ── Load Data ────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token') || '';
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const [ordersData, prodsRes, custsRes, usersRes] = await Promise.all([
        outboundApi.listOrders(),
        fetch('http://localhost:3000/api/products', { headers }).catch(() => null),
        fetch('http://localhost:3000/api/customers', { headers }).catch(() => null),
        fetch('http://localhost:3000/api/users', { headers }).catch(() => null),
      ]);

      setOrders(ordersData);

      if (prodsRes && prodsRes.ok) {
        const pData = await prodsRes.json();
        if (Array.isArray(pData)) {
          setProducts(
            pData.map((item: any) => ({
              id: String(item.id),
              internalSku: String(item.internalSku || item.sku || item.id),
              name: String(item.name || item.internalSku || item.id),
              unit: String(item.unit || 'Cái'),
              salePrice: Number(item.salePrice || item.retailPrice || item.price || 0),
            }))
          );
        }
      }

      if (custsRes && custsRes.ok) {
        const cData = await custsRes.json();
        if (Array.isArray(cData)) {
          setCustomers(
            cData.map((item: any) => ({
              id: String(item.id),
              customerCode: String(item.customerCode || item.code || ''),
              name: String(item.name || item.customerCode || ''),
              phone: String(item.phone || ''),
              address: String(item.address || ''),
              accumulatedPoints: 12217,
            }))
          );
        }
      }

      if (usersRes && usersRes.ok) {
        const uData = await usersRes.json();
        if (Array.isArray(uData)) {
          setUsers(
            uData.map((u: any) => ({
              id: String(u.id),
              fullName: u.fullName || u.email?.split('@')[0] || 'Nhân viên',
              email: u.email,
              role: u.role || (u.roles?.[0]?.name) || '',
            }))
          );
        }
      } else {
        // Mock fallback employees matching user screenshot
        setUsers([
          { id: '1', fullName: 'Demo 1680', email: 'demo1680@ric.vn' },
          { id: '2', fullName: 'Demo 2388', email: 'demo2388@ric.vn' },
          { id: '3', fullName: 'HUUDQtest', email: 'huu@ric.vn' },
          { id: '4', fullName: 'huu1', email: 'huu1@ric.vn' },
          { id: '5', fullName: 'huu2', email: 'huu2@ric.vn' },
          { id: '6', fullName: 'Quản Lý', email: 'quanly@example.com' },
        ]);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi khi tải dữ liệu đơn xuất bán', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Filter & Search ──────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const kw = search.trim().toLowerCase();
      const matchSearch =
        !kw ||
        (order.orderNo || '').toLowerCase().includes(kw) ||
        (order.customer || '').toLowerCase().includes(kw) ||
        (order.customerPhone || '').toLowerCase().includes(kw) ||
        (order.employeeName || '').toLowerCase().includes(kw) ||
        (order.description || '').toLowerCase().includes(kw);

      if (dateFrom || dateTo) {
        const itemDateStr = order.orderDate || order.expectedDate || order.dueDate || order.createdAt;
        if (itemDateStr) {
          const itemDate = new Date(itemDateStr).toISOString().slice(0, 10);
          if (dateFrom && itemDate < dateFrom) return false;
          if (dateTo && itemDate > dateTo) return false;
        }
      }

      return matchSearch;
    });
  }, [orders, search, dateFrom, dateTo]);

  const totalItems = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedOrders = useMemo(() => {
    return filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const startIndex = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  // ── Footer Totals ────────────────────────────────────────────
  const footerTotals = useMemo(() => {
    return paginatedOrders.reduce(
      (acc, o) => {
        acc.subtotal += Number(o.subtotal || o.totalAmount || 0);
        acc.discount += Number(o.discount || 0);
        acc.vat += Number(o.vatAmount || 0);
        acc.totalAmount += Number(o.totalAmount || 0);
        acc.amountPaid += Number(o.amountPaid || o.totalAmount || 0);
        return acc;
      },
      { subtotal: 0, discount: 0, vat: 0, totalAmount: 0, amountPaid: 0 }
    );
  }, [paginatedOrders]);

  // ── Selection Handlers ───────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedOrders.length && paginatedOrders.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedOrders.map((o) => o.id)));
    }
  };

  // ── Bulk & Single Actions ────────────────────────────────────
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      showToast('Vui lòng chọn ít nhất một phiếu xuất để xóa', 'error');
      return;
    }
    if (!confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.size} phiếu xuất bán hàng đã chọn?`)) return;

    let successCount = 0;
    for (const id of selectedIds) {
      try {
        await outboundApi.deleteOrder(id);
        successCount++;
      } catch {
        // continue
      }
    }
    showToast(`Đã xóa thành công ${successCount}/${selectedIds.size} phiếu xuất`);
    setSelectedIds(new Set());
    loadData();
  };

  const handleCopySelected = () => {
    if (selectedIds.size === 0) {
      showToast('Vui lòng chọn một phiếu xuất để sao chép', 'error');
      return;
    }
    const firstSelectedId = Array.from(selectedIds)[0];
    const sourceOrder = orders.find((o) => o.id === firstSelectedId);
    if (!sourceOrder) return;

    openCreateModalWithOrder(sourceOrder, true);
  };

  // ── Tab Management in Form Modal ─────────────────────────────
  const activeTab = useMemo(() => {
    return tabs.find((t) => t.tabId === activeTabId) || tabs[0] || null;
  }, [tabs, activeTabId]);

  const updateActiveTab = (updater: (prev: InvoiceTab) => InvoiceTab) => {
    setTabs((prev) => prev.map((t) => (t.tabId === activeTabId ? updater(t) : t)));
  };

  const handleAddNewTab = () => {
    const newTab = createNewInvoiceTab(tabs.length + 1, currentUserName);
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.tabId);
  };

  const handleCloseTab = (tabIdToClose: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) {
      setShowFormModal(false);
      return;
    }
    const filtered = tabs.filter((t) => t.tabId !== tabIdToClose);
    setTabs(filtered);
    if (activeTabId === tabIdToClose) {
      setActiveTabId(filtered[0]?.tabId || '');
    }
  };

  // ── Open Modals ──────────────────────────────────────────────
  const openCreateModal = () => {
    const initialTab = createNewInvoiceTab(1, currentUserName);
    setTabs([initialTab]);
    setActiveTabId(initialTab.tabId);
    setShowFormModal(true);
  };

  const openCreateModalWithOrder = (order: OutboundOrder, isCopy = false) => {
    const newTab: InvoiceTab = {
      tabId: `tab-${Date.now()}-1`,
      title: isCopy ? `# 1 (Bản sao)` : `# ${order.orderNo}`,
      id: isCopy ? undefined : order.id,
      orderNo: isCopy ? '' : order.orderNo,
      branchCode: order.branchCode || '4445',
      employeeName: order.employeeName || currentUserName || 'HUUDQtest',
      receiver: order.receiver || '',
      customer: order.customer || '',
      customerPhone: order.customerPhone || '',
      customerAddress: order.customerAddress || '',
      orderDate: order.orderDate ? new Date(order.orderDate).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN'),
      description: order.description || '',
      discount: order.discount || 0,
      vatRate: order.vatRate || 0,
      paymentMethod: order.paymentMethod || 'Tiền mặt',
      paymentAccount: order.paymentAccount || '',
      amountPaid: order.amountPaid || order.totalAmount || 0,
      status: order.status || 'Đã giao hàng',
      details:
        order.details && order.details.length > 0
          ? [
              ...order.details.map((d, idx) => ({
                rowId: `row-${Date.now()}-${idx}`,
                productId: d.product?.id || '',
                productSku: d.product?.internalSku || '',
                productName: d.product?.name || '',
                unit: d.product?.unit || 'Cái',
                qty: d.requiredQty || 0,
                price: d.unitPrice || 0,
                discountPercent: d.discountPercent || 0,
                discountAmount: d.discountAmount || 0,
                vatPercent: d.vatPercent || 0,
                vatAmount: d.vatAmount || 0,
                totalAmount: d.totalLineAmount || d.requiredQty * d.unitPrice || 0,
                note: d.note || '',
              })),
              ...Array.from({ length: Math.max(0, DEFAULT_ROWS_COUNT - order.details.length) }, (_, i) =>
                makeEmptyRow(order.details!.length + i)
              ),
            ]
          : makeInitialRows(DEFAULT_ROWS_COUNT),
    };

    setTabs([newTab]);
    setActiveTabId(newTab.tabId);
    setShowFormModal(true);
  };

  const handleOpenDetailModal = (order: OutboundOrder) => {
    setSelectedOrder(order);
    setShowDetailModal(true);
  };

  // ── Form Row Updates ─────────────────────────────────────────
  const handleUpdateRow = (rowId: string, changes: Partial<FormDetailRow>) => {
    if (!activeTab) return;
    updateActiveTab((tab) => {
      const updatedDetails = tab.details.map((row) => {
        if (row.rowId !== rowId) return row;
        const next = { ...row, ...changes };

        // Recalculate line total
        const sub = next.qty * next.price;
        const discountAmt = next.discountPercent > 0 ? (sub * next.discountPercent) / 100 : next.discountAmount || 0;
        const subAfterDiscount = sub - discountAmt;
        const vatAmt = next.vatPercent > 0 ? (subAfterDiscount * next.vatPercent) / 100 : next.vatAmount || 0;
        next.discountAmount = discountAmt;
        next.vatAmount = vatAmt;
        next.totalAmount = subAfterDiscount + vatAmt;

        return next;
      });

      // Recalculate total amount for tab
      const sumItems = updatedDetails.reduce((s, r) => s + (r.totalAmount || 0), 0);
      const overallTotal = sumItems - (tab.discount || 0);

      return {
        ...tab,
        details: updatedDetails,
        amountPaid: tab.amountPaid === 0 || tab.amountPaid === overallTotal ? overallTotal : tab.amountPaid,
      };
    });
  };

  const handleSelectProductForRow = (rowId: string, p: ProductOption) => {
    handleUpdateRow(rowId, {
      productId: p.id,
      productSku: p.internalSku,
      productName: p.name,
      unit: p.unit || 'Cái',
      price: p.salePrice || 5,
      qty: 1,
    });
    setActiveProductDropdownRowId(null);
  };

  const handleDuplicateRow = (idx: number) => {
    if (!activeTab) return;
    const source = activeTab.details[idx];
    if (!source) return;
    updateActiveTab((tab) => {
      const details = [...tab.details];
      const newRow: FormDetailRow = {
        ...source,
        rowId: `row-${Date.now()}-${Math.random()}`,
      };
      details.splice(idx + 1, 0, newRow);
      return { ...tab, details };
    });
    showToast('Đã nhân bản dòng');
  };

  const handleAddMoreRow = () => {
    if (!activeTab) return;
    updateActiveTab((tab) => ({
      ...tab,
      details: [...tab.details, makeEmptyRow(tab.details.length)],
    }));
  };

  const handleClearRow = (rowId: string) => {
    if (!activeTab) return;
    updateActiveTab((tab) => ({
      ...tab,
      details: tab.details.map((r) => (r.rowId === rowId ? makeEmptyRow(0) : r)),
    }));
  };

  // ── Customer Suggestions (Sorted by recent / A-Z 0-9) ────────
  const sortedCustomers = useMemo(() => {
    let recentIds: string[] = [];
    try {
      const raw = localStorage.getItem('recent_customer_ids');
      if (raw) recentIds = JSON.parse(raw);
    } catch {}

    const recentMap = new Map(recentIds.map((id, idx) => [id, idx]));

    return [...customers].sort((a, b) => {
      const aRecent = recentMap.has(a.id) ? recentMap.get(a.id)! : 999999;
      const bRecent = recentMap.has(b.id) ? recentMap.get(b.id)! : 999999;
      if (aRecent !== bRecent) return aRecent - bRecent;
      return (a.name || '').localeCompare(b.name || '', 'vi', { numeric: true });
    });
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const kw = (activeTab?.customer || '').trim().toLowerCase();
    if (!kw) return sortedCustomers;
    return sortedCustomers.filter((c) =>
      (c.name || '').toLowerCase().includes(kw) ||
      (c.customerCode || '').toLowerCase().includes(kw) ||
      (c.phone || '').toLowerCase().includes(kw)
    );
  }, [sortedCustomers, activeTab?.customer]);

  const handleSelectCustomer = (c: CustomerOption) => {
    updateActiveTab((tab) => ({
      ...tab,
      customer: c.name,
      customerId: c.id,
      customerPhone: c.phone || '',
      customerAddress: c.address || '',
    }));
    setShowCustomerDropdown(false);

    try {
      const raw = localStorage.getItem('recent_customer_ids');
      const prev: string[] = raw ? JSON.parse(raw) : [];
      const updated = [c.id, ...prev.filter((id) => id !== c.id)].slice(0, 30);
      localStorage.setItem('recent_customer_ids', JSON.stringify(updated));
    } catch {}
  };

  // ── Employee Suggestions ─────────────────────────────────────
  const filteredEmployees = useMemo(() => {
    const kw = employeeSearch.trim().toLowerCase();
    if (!kw) return users;
    return users.filter(
      (u) =>
        (u.fullName || '').toLowerCase().includes(kw) ||
        (u.email || '').toLowerCase().includes(kw)
    );
  }, [users, employeeSearch]);

  // ── Barcode Scanned ──────────────────────────────────────────
  const handleProductScanned = useCallback((scanned: ScannedProduct, qty: number, price?: number) => {
    if (!activeTabId) return;
    const unitPrice = price || scanned.purchasePrice || 5;
    updateActiveTab((tab) => {
      const details = [...tab.details];
      const emptyIndex = details.findIndex((r) => !r.productName && !r.productId);

      const newRow: FormDetailRow = {
        rowId: `row-${Date.now()}-${Math.random()}`,
        productId: scanned.id,
        productSku: scanned.internalSku || '',
        productName: scanned.name,
        unit: scanned.unit || 'Cái',
        qty: qty || 1,
        price: unitPrice,
        discountPercent: 0,
        discountAmount: 0,
        vatPercent: 0,
        vatAmount: 0,
        totalAmount: (qty || 1) * unitPrice,
        note: '',
      };

      if (emptyIndex >= 0) {
        details[emptyIndex] = newRow;
      } else {
        details.push(newRow);
      }

      return { ...tab, details };
    });
    showToast(`Đã thêm sản phẩm: ${scanned.name} (SL: ${qty})`);
  }, [activeTabId]);

  // ── Quick Add Customer ───────────────────────────────────────
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.name.trim()) {
      showToast('Vui lòng nhập tên khách hàng', 'error');
      return;
    }
    try {
      const res = await fetch('http://localhost:3000/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({
          customerCode: newCustomerForm.customerCode.trim() || `KH${Date.now().toString().slice(-5)}`,
          name: newCustomerForm.name.trim(),
          phone: newCustomerForm.phone.trim() || undefined,
          address: newCustomerForm.address.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error('Không thể thêm khách hàng');
      const saved = await res.json();
      setCustomers((prev) => [...prev, saved]);
      if (activeTab) {
        updateActiveTab((tab) => ({
          ...tab,
          customer: saved.name,
          customerId: saved.id,
          customerPhone: saved.phone || '',
          customerAddress: saved.address || '',
        }));
      }
      showToast(`Đã thêm khách hàng: ${saved.name}`);
      setShowAddCustomerModal(false);
      setNewCustomerForm({ name: '', phone: '', address: '', customerCode: '' });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi khi thêm khách hàng', 'error');
    }
  };

  // ── Save Form Handler ────────────────────────────────────────
  const handleSaveInvoice = async (shouldPrint = false) => {
    if (!activeTab) return;

    const validDetails = activeTab.details.filter(
      (r) => (r.productId || r.productName.trim() || r.productSku.trim()) && r.qty > 0
    );

    if (validDetails.length === 0) {
      showToast('Vui lòng nhập ít nhất một dòng hàng hóa hợp lệ (có sản phẩm và số lượng > 0)', 'error');
      return;
    }

    const subtotal = validDetails.reduce((s, r) => s + (r.totalAmount || 0), 0);
    const vatAmount = validDetails.reduce((s, r) => s + (r.vatAmount || 0), 0);
    const totalAmount = subtotal - (activeTab.discount || 0);
    const debt = totalAmount - (activeTab.amountPaid || 0);

    // 1: Nếu chưa có MHĐ, tự sinh mã XBH_...
    const finalOrderNo = activeTab.orderNo.trim()
      ? activeTab.orderNo.trim().toUpperCase()
      : `XBH_${Math.floor(600 + Math.random() * 400)}`;

    const payload: OutboundCreatePayload = {
      orderNo: finalOrderNo,
      branchCode: activeTab.branchCode || currentBranch || '4445',
      employeeName: activeTab.employeeName || currentUserName,
      receiver: activeTab.receiver.trim() || undefined,
      customerId: activeTab.customerId,
      customer: activeTab.customer.trim() || 'Khách lẻ',
      customerPhone: activeTab.customerPhone.trim() || undefined,
      customerAddress: activeTab.customerAddress.trim() || undefined,
      orderDate: activeTab.orderDate,
      description: activeTab.description.trim() || undefined,
      subtotal,
      discount: activeTab.discount || 0,
      vatRate: activeTab.vatRate || 0,
      vatAmount,
      totalAmount,
      amountPaid: activeTab.amountPaid || 0,
      debt,
      paymentMethod: activeTab.paymentMethod || 'Tiền mặt',
      paymentAccount: activeTab.paymentAccount || undefined,
      status: activeTab.status || 'Đã giao hàng',
      items: validDetails.length,
      details: validDetails.map((r) => ({
        productId: r.productId || undefined,
        productSku: r.productSku || undefined,
        productName: r.productName || undefined,
        unit: r.unit || undefined,
        requiredQty: Number(r.qty),
        unitPrice: Number(r.price),
        discountPercent: Number(r.discountPercent || 0),
        discountAmount: Number(r.discountAmount || 0),
        vatPercent: Number(r.vatPercent || 0),
        vatAmount: Number(r.vatAmount || 0),
        totalLineAmount: Number(r.totalAmount),
        note: r.note || undefined,
      })),
    };

    try {
      if (activeTab.id) {
        await outboundApi.updateOrder(activeTab.id, payload);
        showToast(`Đã cập nhật hóa đơn ${payload.orderNo} thành công`);
      } else {
        await outboundApi.createOrder(payload);
        showToast(`Đã lưu hóa đơn ${payload.orderNo} thành công`);
      }

      await loadData();
      setShowFormModal(false);

      if (shouldPrint) {
        setTimeout(() => window.print(), 300);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi khi lưu phiếu xuất', 'error');
    }
  };

  // ── Calculated totals for active tab ─────────────────────────
  const activeTabCalculations = useMemo(() => {
    if (!activeTab) return { totalQty: 0, subtotal: 0, vatTotal: 0, totalAmount: 0, debt: 0 };
    const validRows = activeTab.details.filter((r) => r.qty > 0 || r.productName || r.productSku);
    const totalQty = validRows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
    const subtotal = validRows.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0);
    const vatTotal = validRows.reduce((s, r) => s + (Number(r.vatAmount) || 0), 0);
    const totalAmount = Math.max(0, subtotal - (Number(activeTab.discount) || 0));
    const debt = totalAmount - (Number(activeTab.amountPaid) || 0);

    return { totalQty, subtotal, vatTotal, totalAmount, debt };
  }, [activeTab]);

  return (
    <div
      className="space-y-0 text-slate-800"
      onClick={() => {
        setShowCustomerDropdown(false);
        setActiveProductDropdownRowId(null);
        setShowEmployeeDropdown(false);
      }}
    >
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />

      {/* ═══ Top Breadcrumb ═══ */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Home className="h-3.5 w-3.5 text-cyan-600" />
          <Link to="/dashboard" className="text-cyan-600 hover:underline font-medium">
            Home
          </Link>
          <span className="text-slate-400">›</span>
          <span className="text-slate-700 font-semibold">Xuất bán</span>
        </div>
      </div>

      {/* ═══ Page Title ═══ */}
      <div className="mb-3">
        <h1 className="text-xl font-black text-slate-800 uppercase tracking-wide">DANH SÁCH PHIẾU XUẤT BÁN HÀNG</h1>
      </div>

      {/* ═══ Toolbar - RIC Colored Style ═══ */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2 bg-slate-50 border border-slate-200 rounded-lg p-2">
        {/* + Thêm (Green) */}
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 cursor-pointer"
          style={{ background: '#4CAF50' }}
        >
          <Plus className="h-3.5 w-3.5" />
          Thêm
        </button>

        {/* Copy (Blue) */}
        <button
          onClick={handleCopySelected}
          className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 cursor-pointer"
          style={{ background: '#2196F3' }}
        >
          <Copy className="h-3.5 w-3.5" />
          Copy
        </button>

        {/* Xóa (Red) */}
        <button
          onClick={handleDeleteSelected}
          className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 cursor-pointer"
          style={{ background: '#F44336' }}
        >
          <X className="h-3.5 w-3.5" />
          Xóa
        </button>

        {/* Print (Magenta) */}
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 cursor-pointer"
          style={{ background: '#E91E63' }}
        >
          <Printer className="h-3.5 w-3.5" />
          Print
        </button>

        {/* Print Chi tiết (Magenta) */}
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

        {/* Excel (Teal/Dark Green) */}
        <button
          onClick={() => {
            const header = [
              'STT',
              'Chi nhánh',
              'NV',
              'Mã',
              'Ngày',
              'Tên KH',
              'Địa chỉ',
              'Tel',
              'Thành tiền',
              'CK',
              'VAT',
              'Tổng tiền',
              'Thanh toán',
              'Ghi chú',
              'Trạng thái',
            ];
            const rows = filteredOrders.map((o, idx) => [
              idx + 1,
              o.branchCode || '4445',
              o.employeeName || 'HUUDQtest',
              o.orderNo,
              o.orderDate || o.createdAt ? new Date(o.orderDate || o.createdAt!).toLocaleDateString('vi-VN') : '',
              o.customer,
              o.customerAddress || '',
              o.customerPhone || '',
              o.subtotal || o.totalAmount || 0,
              o.discount || 0,
              o.vatAmount || 0,
              o.totalAmount || 0,
              o.amountPaid || o.totalAmount || 0,
              o.description || '',
              o.status || 'Đã giao hàng',
            ]);
            const csv = [header, ...rows].map((r) => r.map((cell) => `"${cell}"`).join(',')).join('\n');
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `xuat_ban_hang_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 cursor-pointer"
          style={{ background: '#00897B' }}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Excel
        </button>

        {/* PDF (Cyan) */}
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 cursor-pointer"
          style={{ background: '#00BCD4' }}
        >
          <FileDown className="h-3.5 w-3.5" />
          PDF
        </button>

        <div className="w-px h-6 bg-slate-300 mx-1 hidden sm:block" />

        {/* Date Filter: Từ ngày */}
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold text-slate-600">Từ ngày:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        {/* Date Filter: Đến ngày */}
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold text-slate-600">Đến ngày:</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        <div className="w-px h-6 bg-slate-300 mx-1 hidden sm:block" />

        {/* Checkbox: Hiện chi tiết */}
        <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showDetail}
            onChange={(e) => setShowDetail(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
          />
          <span className="text-xs font-semibold text-slate-600">Hiện chi tiết</span>
        </label>

        {/* Tìm kiếm (Green Button) */}
        <button
          onClick={() => loadData()}
          className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 cursor-pointer"
          style={{ background: '#4CAF50' }}
        >
          <Search className="h-3.5 w-3.5" />
          Tìm kiếm
        </button>

        {/* Settings gear (Hiện/Ẩn cột) */}
        <button
          onClick={() => setShowColumnSettings(true)}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md shadow-sm text-white transition hover:opacity-90 cursor-pointer"
          style={{ background: '#00BCD4' }}
          title="Hiện/Ẩn cột"
        >
          <Settings className="h-4 w-4" />
        </button>

        {/* Toàn màn hình */}
        <button
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen().catch(() => {});
            } else {
              document.exitFullscreen().catch(() => {});
            }
          }}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md shadow-sm bg-slate-200 text-slate-700 hover:bg-slate-300 transition cursor-pointer"
          title="Toàn màn hình"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* ═══ Drag & Drop hint text ═══ */}
      <div className="text-xs text-slate-400 italic mb-1 px-1">
        Drag a column header and drop it here to group by that column
      </div>

      {/* ═══ Search input row ═══ */}
      <div className="flex items-center gap-2 mb-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8 w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 text-xs font-medium outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            placeholder="Tìm theo mã phiếu, khách hàng, số điện thoại, nhân viên..."
          />
        </div>
      </div>

      {/* ═══ Main Data Table ═══ */}
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
                      Chi nhánh <Filter className="h-2.5 w-2.5 text-slate-500" />
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
                {columnVis.customerName && (
                  <th className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-700">
                    <div className="flex items-center justify-center gap-1">
                      Tên KH <Filter className="h-2.5 w-2.5 text-slate-500" />
                    </div>
                  </th>
                )}
                {columnVis.customerAddress && (
                  <th className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-700">
                    <div className="flex items-center justify-center gap-1">
                      Địa chỉ <Filter className="h-2.5 w-2.5 text-slate-500" />
                    </div>
                  </th>
                )}
                {columnVis.customerPhone && (
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
                      Giao hàng <Filter className="h-2.5 w-2.5 text-slate-500" />
                    </div>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={16} className="px-4 py-8 text-center text-xs text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-cyan-600" />
                      Đang tải danh sách phiếu xuất...
                    </div>
                  </td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-4 py-8 text-center text-xs text-slate-400">
                    No items to display
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order, idx) => {
                  const dateFormatted = order.orderDate || order.createdAt
                    ? new Date(order.orderDate || order.createdAt!).toLocaleDateString('vi-VN')
                    : '12/08/2026';

                  const hasDetails = order.details && order.details.length > 0;
                  const extraDetails = showDetail && hasDetails ? order.details : [];

                  return (
                    <React.Fragment key={order.id}>
                      <tr
                        className={`border-b border-slate-200 hover:bg-cyan-50/40 transition ${
                          selectedIds.has(order.id) ? 'bg-cyan-50/70' : ''
                        }`}
                      >
                        {/* No. */}
                        <td className="border border-slate-200 px-2 py-2 text-center text-slate-600">
                          {startIndex + idx}
                        </td>

                        {/* Select checkbox */}
                        <td className="border border-slate-200 px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(order.id)}
                            onChange={() => toggleSelect(order.id)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                          />
                        </td>

                        {/* Actions: Eye (Orange), Edit (Green) */}
                        <td className="border border-slate-200 px-1 py-1 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenDetailModal(order)}
                              className="h-6 w-6 rounded flex items-center justify-center text-white shadow-sm hover:opacity-90 cursor-pointer"
                              style={{ background: '#FF9800' }}
                              title="Xem chi tiết"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => openCreateModalWithOrder(order, false)}
                              className="h-6 w-6 rounded flex items-center justify-center text-white shadow-sm hover:opacity-90 cursor-pointer"
                              style={{ background: '#4CAF50' }}
                              title="Sửa phiếu xuất"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>

                        {/* Branch */}
                        {columnVis.branch && (
                          <td className="border border-slate-200 px-2 py-2 text-center text-slate-600">
                            {order.branchCode || '4445'}
                          </td>
                        )}

                        {/* Employee */}
                        {columnVis.nv && (
                          <td className="border border-slate-200 px-2 py-2 text-center text-slate-600">
                            {order.employeeName || 'HUUDQtest'}
                          </td>
                        )}

                        {/* Order No */}
                        {columnVis.code && (
                          <td className="border border-slate-200 px-2 py-2 text-center font-bold text-cyan-700">
                            <button
                              onClick={() => handleOpenDetailModal(order)}
                              className="hover:underline hover:text-cyan-800 cursor-pointer"
                            >
                              {order.orderNo}
                            </button>
                          </td>
                        )}

                        {/* Date */}
                        {columnVis.date && (
                          <td className="border border-slate-200 px-2 py-2 text-center text-slate-600 whitespace-nowrap">
                            {dateFormatted}
                          </td>
                        )}

                        {/* Customer */}
                        {columnVis.customerName && (
                          <td className="border border-slate-200 px-2 py-2 text-slate-700 font-medium">
                            {order.customer || '888'}
                          </td>
                        )}

                        {/* Address */}
                        {columnVis.customerAddress && (
                          <td className="border border-slate-200 px-2 py-2 text-slate-500">
                            {order.customerAddress || ''}
                          </td>
                        )}

                        {/* Phone */}
                        {columnVis.customerPhone && (
                          <td className="border border-slate-200 px-2 py-2 text-center text-slate-600">
                            {order.customerPhone || '09123456789'}
                          </td>
                        )}

                        {/* Subtotal */}
                        {columnVis.subtotal && (
                          <td className="border border-slate-200 px-2 py-2 text-right font-medium text-slate-700">
                            {(order.subtotal || order.totalAmount || 0).toLocaleString('vi-VN')}
                          </td>
                        )}

                        {/* Discount */}
                        {columnVis.discount && (
                          <td className="border border-slate-200 px-2 py-2 text-right text-slate-500">
                            {(order.discount || 0).toLocaleString('vi-VN')}
                          </td>
                        )}

                        {/* VAT */}
                        {columnVis.vat && (
                          <td className="border border-slate-200 px-2 py-2 text-right text-slate-500">
                            {(order.vatAmount || 0).toLocaleString('vi-VN')}
                          </td>
                        )}

                        {/* Total Amount */}
                        {columnVis.totalAmount && (
                          <td className="border border-slate-200 px-2 py-2 text-right font-bold text-slate-800">
                            {(order.totalAmount || 0).toLocaleString('vi-VN')}
                          </td>
                        )}

                        {/* Amount Paid */}
                        {columnVis.amountPaid && (
                          <td className="border border-slate-200 px-2 py-2 text-right font-semibold text-emerald-700">
                            {(order.amountPaid || order.totalAmount || 0).toLocaleString('vi-VN')}
                          </td>
                        )}

                        {/* Note */}
                        {columnVis.note && (
                          <td className="border border-slate-200 px-2 py-2 text-center text-slate-400">
                            {order.description || ''}
                          </td>
                        )}

                        {/* Status */}
                        {columnVis.status && (
                          <td className="border border-slate-200 px-2 py-2 text-center">
                            <StatusBadge status={order.status} />
                          </td>
                        )}
                      </tr>

                      {/* Expanded detail rows if showDetail is active */}
                      {showDetail &&
                        extraDetails &&
                        extraDetails.map((det, dIdx) => (
                          <tr key={det.id || dIdx} className="bg-slate-50/70 border-b border-slate-200 text-[11px]">
                            <td className="border border-slate-200 px-2 py-1.5 text-center text-slate-400">
                              {startIndex + idx}.{dIdx + 1}
                            </td>
                            <td className="border border-slate-200 px-2 py-1.5" />
                            <td className="border border-slate-200 px-2 py-1.5 text-center text-cyan-600 font-bold">↳</td>
                            <td colSpan={4} className="border border-slate-200 px-2 py-1.5 text-slate-700">
                              <span className="font-bold text-cyan-800 mr-2">
                                [{det.product?.internalSku || 'MÃ-SP'}]
                              </span>
                              <span>{det.product?.name || 'Sản phẩm xuất bán'}</span>
                            </td>
                            <td className="border border-slate-200 px-2 py-1.5 text-center text-slate-500">
                              ĐVT: {det.product?.unit || 'Cái'}
                            </td>
                            <td className="border border-slate-200 px-2 py-1.5 text-center font-bold text-amber-700">
                              SL: {det.requiredQty}
                            </td>
                            <td className="border border-slate-200 px-2 py-1.5 text-right text-slate-600">
                              Giá: {Number(det.unitPrice || 0).toLocaleString('vi-VN')}
                            </td>
                            <td className="border border-slate-200 px-2 py-1.5 text-right text-slate-500">
                              CK: {Number(det.discountAmount || 0).toLocaleString('vi-VN')}
                            </td>
                            <td className="border border-slate-200 px-2 py-1.5 text-right text-slate-500">
                              VAT: {Number(det.vatAmount || 0).toLocaleString('vi-VN')}
                            </td>
                            <td className="border border-slate-200 px-2 py-1.5 text-right font-bold text-slate-800">
                              {Number(det.totalLineAmount || det.requiredQty * det.unitPrice || 0).toLocaleString(
                                'vi-VN'
                              )}
                            </td>
                            <td colSpan={3} className="border border-slate-200 px-2 py-1.5 text-slate-400">
                              {det.note || ''}
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>

            {/* ═══ Footer Totals Row ═══ */}
            <tfoot>
              <tr className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-300">
                <td colSpan={3} className="border border-slate-300 px-4 py-2.5 text-center font-bold text-xs uppercase">
                  Tổng
                </td>
                {columnVis.branch && <td className="border border-slate-300" />}
                {columnVis.nv && <td className="border border-slate-300" />}
                {columnVis.code && <td className="border border-slate-300" />}
                {columnVis.date && <td className="border border-slate-300" />}
                {columnVis.customerName && <td className="border border-slate-300" />}
                {columnVis.customerAddress && <td className="border border-slate-300" />}
                {columnVis.customerPhone && <td className="border border-slate-300" />}
                {columnVis.subtotal && (
                  <td className="border border-slate-300 px-2 py-2.5 text-right font-bold text-xs">
                    {footerTotals.subtotal.toLocaleString('vi-VN')}
                  </td>
                )}
                {columnVis.discount && (
                  <td className="border border-slate-300 px-2 py-2.5 text-right font-bold text-xs text-slate-600">
                    {footerTotals.discount.toLocaleString('vi-VN')}
                  </td>
                )}
                {columnVis.vat && (
                  <td className="border border-slate-300 px-2 py-2.5 text-right font-bold text-xs text-slate-600">
                    {footerTotals.vat.toLocaleString('vi-VN')}
                  </td>
                )}
                {columnVis.totalAmount && (
                  <td className="border border-slate-300 px-2 py-2.5 text-right font-black text-xs text-slate-900">
                    {footerTotals.totalAmount.toLocaleString('vi-VN')}
                  </td>
                )}
                {columnVis.amountPaid && (
                  <td className="border border-slate-300 px-2 py-2.5 text-right font-black text-xs text-emerald-800">
                    {footerTotals.amountPaid.toLocaleString('vi-VN')}
                  </td>
                )}
                {columnVis.note && <td className="border border-slate-300" />}
                {columnVis.status && <td className="border border-slate-300" />}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ═══ Pagination Bar - RIC Round Orange Circle ═══ */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <div className="flex items-center gap-1">
          {/* First Page */}
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 disabled:opacity-40 cursor-pointer"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>
          {/* Prev Page */}
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          {/* Active Page (Orange circle) */}
          <button
            className="flex h-7 w-7 items-center justify-center rounded-full text-white font-bold shadow-sm cursor-pointer"
            style={{ background: '#FF9800' }}
          >
            {currentPage}
          </button>
          {/* Next Page */}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 disabled:opacity-40 cursor-pointer"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          {/* Last Page */}
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages || totalPages === 0}
            className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 disabled:opacity-40 cursor-pointer"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div>
          {totalItems > 0 ? `${startIndex} - ${endIndex} of ${totalItems} items` : 'No items to display'}
        </div>
      </div>

      {/* ═══ RIC Copyright Footer ═══ */}
      <div className="flex items-center justify-between py-3 text-xs text-slate-400">
        <div>
          RIC-HÀ NỘI - Copyright © 2008-2026 by <b className="text-cyan-700">RIC Software.</b>
        </div>
        <div>Version 2026</div>
      </div>

      {/* ═════════════════════════════════════════════════════════════
          FULL-SCREEN PANEL: PHIẾU XUẤT BÁN HÀNG (Ảnh 2 & 3)
          Occupies the full viewport area next to the sidebar
         ═════════════════════════════════════════════════════════════ */}
      {showFormModal && activeTab && (
        <div
          className={`fixed inset-y-0 right-0 ${
            isFullScreen ? 'left-0' : 'left-0 md:left-20 lg:left-80'
          } z-50 flex flex-col bg-white shadow-2xl border-l border-slate-300 animate-in fade-in duration-150 select-none`}
          onClick={(e) => {
            e.stopPropagation();
            setShowCustomerDropdown(false);
            setActiveProductDropdownRowId(null);
            setShowEmployeeDropdown(false);
          }}
        >
          {/* 1. RIC Header Green Bar */}
          <div className="flex h-11 items-center justify-between px-4 text-white flex-shrink-0" style={{ background: '#009688' }}>
            <div className="flex items-center gap-3 font-bold text-sm">
              <span className="tracking-wide uppercase">XUẤT BÁN</span>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1">☎ {currentUserPhone}</span>
              <select
                value={currentBranch}
                onChange={(e) => setCurrentBranch(e.target.value)}
                className="h-6 rounded bg-teal-800 border-none text-white px-2 py-0.5 text-xs outline-none cursor-pointer"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.code} className="bg-teal-900 text-white">
                    {w.name}
                  </option>
                ))}
              </select>
              <span>{currentUserEmail}</span>
            </div>
          </div>

          {/* 2. Sub Header: Title & Breadcrumbs */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 flex-shrink-0">
            <h2 className="text-base font-black text-slate-800 uppercase tracking-wide">
              PHIẾU XUẤT BÁN HÀNG
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <button className="text-slate-400 hover:text-cyan-600 transition cursor-pointer" title="Lưu đám mây">
                <UploadCloud className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-1">
                <Home className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-slate-600 font-medium">Home</span>
                <span className="text-slate-300">›</span>
                <span className="text-slate-700 font-bold">Xuất bán</span>
              </div>
            </div>
          </div>

          {/* 3. Tab Bar + Action Icons */}
          <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-2 py-1 flex-shrink-0">
            {/* Tabs List */}
            <div className="flex items-center gap-1 overflow-x-auto">
              <button
                onClick={handleAddNewTab}
                className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-200 shadow-sm font-bold text-sm cursor-pointer"
                title="Thêm tab mới"
              >
                +
              </button>

              {tabs.map((t) => {
                const isActive = t.tabId === activeTabId;
                return (
                  <div
                    key={t.tabId}
                    onClick={() => setActiveTabId(t.tabId)}
                    className={`flex items-center gap-2 px-3 py-1 text-xs font-bold rounded-t-md cursor-pointer border-t-2 border-l border-r transition select-none ${
                      isActive
                        ? 'border-teal-600 bg-white text-teal-800 shadow-sm'
                        : 'border-transparent bg-slate-200 text-slate-500 hover:bg-slate-300'
                    }`}
                  >
                    <span>{t.title}</span>
                    <button
                      onClick={(e) => handleCloseTab(t.tabId, e)}
                      className="hover:text-red-500 rounded p-0.5 font-black text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Right Icons: Sort, Barcode scanner, Add Customer, Fullscreen, Close */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  updateActiveTab((tab) => ({
                    ...tab,
                    details: [...tab.details].sort((a, b) => (a.productName || '').localeCompare(b.productName || '')),
                  }));
                  showToast('Đã sắp xếp danh sách sản phẩm');
                }}
                className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 shadow-sm cursor-pointer"
                title="Sắp xếp hàng hóa"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setShowScannerModal(true)}
                className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-cyan-700 hover:bg-cyan-50 shadow-sm cursor-pointer"
                title="Quét mã vạch"
              >
                <ScanLine className="h-4 w-4" />
              </button>
              <button
                onClick={() => setShowAddCustomerModal(true)}
                className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-blue-700 hover:bg-blue-50 shadow-sm cursor-pointer"
                title="Thêm khách hàng"
              >
                <UserPlus className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsFullScreen((prev) => !prev)}
                className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 shadow-sm cursor-pointer"
                title={isFullScreen ? 'Thu nhỏ' : 'Toàn màn hình'}
              >
                {isFullScreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => setShowFormModal(false)}
                className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-400 hover:text-red-600 hover:bg-red-50 shadow-sm font-black cursor-pointer"
                title="Đóng phiếu"
              >
                ✕
              </button>
            </div>
          </div>

          {/* 4. Form Header Row: Ngày, Mã HĐ, Khách hàng */}
          <div className="flex flex-wrap items-center gap-3 bg-white px-4 py-2.5 border-b border-slate-200 text-xs flex-shrink-0">
            {/* Ngày */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-700">Ngày:</span>
              <input
                type="text"
                value={activeTab.orderDate}
                onChange={(e) => updateActiveTab((tab) => ({ ...tab, orderDate: e.target.value }))}
                className="h-7 w-28 rounded border border-slate-300 px-2 text-xs font-medium outline-none focus:border-teal-500"
              />
            </div>

            {/* Mã HĐ (1: mặc định là không có gì hết) */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-700">Mã HĐ:</span>
              <input
                type="text"
                value={activeTab.orderNo}
                onChange={(e) => updateActiveTab((tab) => ({ ...tab, orderNo: e.target.value }))}
                placeholder="Mã hóa đơn"
                className="h-7 w-32 rounded border border-slate-300 px-2 text-xs font-bold text-cyan-800 outline-none focus:border-teal-500 placeholder:text-slate-400 placeholder:font-normal"
              />
            </div>

            {/* 2: Khách hàng with Interactive Suggestion Dropdown (Sorted by Recent / A-Z) */}
            <div className="relative flex items-center gap-1.5 flex-1 min-w-[320px]">
              <span className="font-bold text-slate-700 whitespace-nowrap">Khách hàng:</span>
              <div className="relative flex-1" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={activeTab.customer}
                  onChange={(e) => {
                    updateActiveTab((tab) => ({ ...tab, customer: e.target.value }));
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  placeholder="Chọn khách hàng..."
                  className="h-7 w-full rounded border border-slate-300 px-2 text-xs font-semibold outline-none focus:border-teal-500"
                />

                {/* Customer Suggestion Dropdown */}
                {showCustomerDropdown && (
                  <div className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-64 overflow-y-auto rounded-md border border-slate-300 bg-white shadow-2xl flex flex-col">
                    <div className="flex bg-slate-100 border-b border-slate-300 px-3 py-1.5 text-[11px] font-bold text-slate-600">
                      <span className="w-1/3">MÃ KH</span>
                      <span className="w-1/3">TÊN KHÁCH HÀNG</span>
                      <span className="w-1/3 text-right">ĐIỆN THOẠI</span>
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {filteredCustomers.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-400">Không tìm thấy khách hàng phù hợp</div>
                      ) : (
                        filteredCustomers.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => handleSelectCustomer(c)}
                            className="flex items-center px-3 py-1.5 hover:bg-teal-50 cursor-pointer border-b border-slate-100 text-xs text-slate-700 transition"
                          >
                            <span className="w-1/3 font-bold text-cyan-800">{c.customerCode || 'KH---'}</span>
                            <span className="w-1/3 font-semibold text-slate-800 truncate">{c.name}</span>
                            <span className="w-1/3 text-right text-slate-500">{c.phone || '-'}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick actions next to customer */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowAddCustomerModal(true)}
                  className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-200 cursor-pointer"
                  title="Thêm khách hàng mới"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    const matched = customers.find((c) => c.name.toLowerCase() === activeTab.customer.toLowerCase());
                    if (matched) {
                      updateActiveTab((tab) => ({
                        ...tab,
                        customerPhone: matched.phone || '',
                        customerAddress: matched.address || '',
                      }));
                      showToast(`Đã tải thông tin khách hàng: ${matched.name}`);
                    }
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-200 cursor-pointer"
                  title="Đồng bộ thông tin"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* 5. Main Area: Left Items Table (75%) + Right Sidebar (25%) */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* ═══ Left: Product Grid ═══ */}
            <div className="flex-1 flex flex-col border-r border-slate-200 overflow-hidden bg-slate-50">
              <div className="flex-1 overflow-x-auto overflow-y-auto">
                <table className="w-full min-w-[820px] border-collapse text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-200 text-slate-700 border-b border-slate-300">
                      <th className="w-8 border border-slate-300 px-1 py-2 text-center font-bold">No</th>
                      <th className="border border-slate-300 px-2 py-2 text-left font-bold min-w-[220px]">
                        Hàng hóa
                      </th>
                      <th className="w-16 border border-slate-300 px-1 py-2 text-center font-bold">Đv</th>
                      <th className="w-24 border border-slate-300 px-1 py-2 text-center font-bold">
                        <div className="flex items-center justify-center gap-1">
                          <span>Số lượng</span>
                          <span className="rounded bg-yellow-400 px-1 py-0.2 text-[10px] font-black text-slate-900">
                            Σ:{activeTabCalculations.totalQty}
                          </span>
                        </div>
                      </th>
                      <th className="w-24 border border-slate-300 px-1 py-2 text-right font-bold">Giá</th>
                      <th className="w-24 border border-slate-300 px-1 py-2 text-center font-bold">Chiết khấu %</th>
                      <th className="w-16 border border-slate-300 px-1 py-2 text-center font-bold">% VAT</th>
                      <th className="w-20 border border-slate-300 px-1 py-2 text-right font-bold">Tiền VAT</th>
                      <th className="w-28 border border-slate-300 px-1 py-2 text-right font-bold">Thành tiền</th>
                      <th className="border border-slate-300 px-1 py-2 text-left font-bold min-w-[100px]">
                        Ghi chú
                      </th>
                      <th className="w-12 border border-slate-300 px-1 py-2 text-center" />
                    </tr>
                  </thead>
                  <tbody>
                    {activeTab.details.map((row, idx) => {
                      const isEven = idx % 2 === 0;
                      const isRowFilled = Boolean(row.productName || row.productSku || row.productId);
                      const rowBgClass = isEven ? 'bg-[#eafaf1]' : 'bg-white';
                      const isDropdownOpen = activeProductDropdownRowId === row.rowId;

                      const rowFilteredProducts = (row.productName || row.productSku)
                        ? products.filter((p) =>
                            p.name.toLowerCase().includes((row.productName || '').toLowerCase()) ||
                            p.internalSku.toLowerCase().includes((row.productSku || '').toLowerCase())
                          ).slice(0, 30)
                        : products.slice(0, 30);

                      return (
                        <tr
                          key={row.rowId}
                          className={`border-b border-slate-200 hover:bg-cyan-50/50 transition ${rowBgClass}`}
                        >
                          {/* No. */}
                          <td className="border border-slate-300 px-1 py-1 text-center font-bold text-slate-600">
                            {idx + 1}.
                          </td>

                          {/* 3: Hàng hóa with real-time Interactive Suggestion Dropdown */}
                          <td className="border border-slate-300 p-0.5 relative" onClick={(e) => e.stopPropagation()}>
                            <div className="relative">
                              <input
                                type="text"
                                value={row.productName || row.productSku}
                                onChange={(e) => {
                                  handleUpdateRow(row.rowId, {
                                    productName: e.target.value,
                                    productSku: e.target.value,
                                  });
                                  setActiveProductDropdownRowId(row.rowId);
                                }}
                                onFocus={() => setActiveProductDropdownRowId(row.rowId)}
                                placeholder="Chọn hoặc nhập hàng..."
                                className="h-6 w-full rounded bg-transparent px-1.5 text-xs font-semibold outline-none focus:bg-white focus:ring-1 focus:ring-teal-500"
                              />

                              {/* Interactive Table Dropdown for this row */}
                              {isDropdownOpen && (
                                <div className="absolute left-0 top-full z-[100] mt-1 w-[380px] max-h-56 overflow-y-auto rounded-md border border-slate-300 bg-white shadow-2xl flex flex-col">
                                  <div className="flex bg-slate-100 border-b border-slate-300 px-2 py-1.5 text-[11px] font-bold text-slate-600 flex-shrink-0">
                                    <span className="w-1/3">MÃ HÀNG</span>
                                    <span className="w-1/2">TÊN HÀNG HÓA</span>
                                    <span className="w-1/4 text-right">GIÁ</span>
                                  </div>
                                  <div className="overflow-y-auto flex-1">
                                    {rowFilteredProducts.length === 0 ? (
                                      <div className="p-2.5 text-center text-xs text-slate-400">Không tìm thấy hàng hóa</div>
                                    ) : (
                                      rowFilteredProducts.map((p) => (
                                        <div
                                          key={p.id}
                                          onClick={() => handleSelectProductForRow(row.rowId, p)}
                                          className="flex items-center px-2 py-1.5 hover:bg-teal-50 cursor-pointer border-b border-slate-100 text-xs text-slate-700 transition"
                                        >
                                          <span className="w-1/3 font-bold text-cyan-800">{p.internalSku}</span>
                                          <span className="w-1/2 font-medium text-slate-800 truncate pr-1">{p.name}</span>
                                          <span className="w-1/4 text-right font-semibold text-slate-700">
                                            {Number(p.salePrice || 0).toLocaleString('vi-VN')}
                                          </span>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Đv */}
                          <td className="border border-slate-300 p-0.5 text-center">
                            <input
                              type="text"
                              value={row.unit}
                              onChange={(e) => handleUpdateRow(row.rowId, { unit: e.target.value })}
                              className="h-6 w-full rounded bg-transparent text-center text-xs outline-none focus:bg-white focus:ring-1 focus:ring-teal-500"
                            />
                          </td>

                          {/* Số lượng */}
                          <td className="border border-slate-300 p-0.5 text-center">
                            <input
                              type="number"
                              min={0}
                              value={row.qty === 0 && !isRowFilled ? '0' : row.qty}
                              onChange={(e) =>
                                handleUpdateRow(row.rowId, { qty: Math.max(0, Number(e.target.value)) })
                              }
                              className="h-6 w-full rounded bg-transparent text-center text-xs font-bold outline-none focus:bg-white focus:ring-1 focus:ring-teal-500"
                            />
                          </td>

                          {/* Giá */}
                          <td className="border border-slate-300 p-0.5 text-right">
                            <input
                              type="number"
                              min={0}
                              value={row.price === 0 && !isRowFilled ? '0' : row.price}
                              onChange={(e) =>
                                handleUpdateRow(row.rowId, { price: Math.max(0, Number(e.target.value)) })
                              }
                              className="h-6 w-full rounded bg-transparent text-right text-xs outline-none focus:bg-white focus:ring-1 focus:ring-teal-500 pr-1 font-medium"
                            />
                          </td>

                          {/* Chiết khấu % */}
                          <td className="border border-slate-300 p-0.5 text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={row.discountPercent === 0 && !isRowFilled ? '0' : row.discountPercent}
                                onChange={(e) =>
                                  handleUpdateRow(row.rowId, {
                                    discountPercent: Math.max(0, Number(e.target.value)),
                                    discountAmount: 0,
                                  })
                                }
                                className="h-6 w-10 rounded bg-transparent text-center text-xs outline-none focus:bg-white focus:ring-1 focus:ring-teal-500"
                              />
                              <span className="text-[10px] text-slate-400">%</span>
                            </div>
                          </td>

                          {/* % VAT */}
                          <td className="border border-slate-300 p-0.5 text-center">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={row.vatPercent === 0 && !isRowFilled ? '0' : row.vatPercent}
                              onChange={(e) =>
                                handleUpdateRow(row.rowId, { vatPercent: Math.max(0, Number(e.target.value)) })
                              }
                              className="h-6 w-full rounded bg-transparent text-center text-xs outline-none focus:bg-white focus:ring-1 focus:ring-teal-500"
                            />
                          </td>

                          {/* Tiền VAT */}
                          <td className="border border-slate-300 px-1 py-1 text-right text-slate-600 font-medium">
                            {row.vatAmount > 0 ? row.vatAmount.toLocaleString('vi-VN') : '0'}
                          </td>

                          {/* Thành tiền */}
                          <td className="border border-slate-300 px-1 py-1 text-right font-bold text-slate-800">
                            {row.totalAmount > 0 ? row.totalAmount.toLocaleString('vi-VN') : '0'}
                          </td>

                          {/* Ghi chú */}
                          <td className="border border-slate-300 p-0.5">
                            <input
                              type="text"
                              value={row.note}
                              onChange={(e) => handleUpdateRow(row.rowId, { note: e.target.value })}
                              className="h-6 w-full rounded bg-transparent px-1 text-xs outline-none focus:bg-white focus:ring-1 focus:ring-teal-500"
                            />
                          </td>

                          {/* Action icons: Duplicate & Clear */}
                          <td className="border border-slate-300 p-0.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {isRowFilled && (
                                <button
                                  onClick={() => handleDuplicateRow(idx)}
                                  className="text-blue-500 hover:text-blue-700 p-0.5 cursor-pointer"
                                  title="Nhân bản dòng"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              )}
                              {isRowFilled && (
                                <button
                                  onClick={() => handleClearRow(row.rowId)}
                                  className="text-red-500 hover:text-red-700 p-0.5 cursor-pointer font-black"
                                  title="Xóa dòng"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* + Add row button below items */}
              <div className="p-1.5 bg-slate-100 border-t border-slate-200 flex items-center">
                <button
                  onClick={handleAddMoreRow}
                  className="flex h-6 w-6 items-center justify-center rounded font-bold text-white shadow-sm hover:opacity-90 cursor-pointer"
                  style={{ background: '#FF9800' }}
                  title="Thêm dòng mới"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* ═══ Right: Sidebar Payment & Customer Summary ═══ */}
            <div className="w-full lg:w-[340px] bg-slate-50 p-3.5 flex flex-col justify-between space-y-3 overflow-y-auto text-xs border-t lg:border-t-0 flex-shrink-0">
              <div className="space-y-2.5">
                {/* 5: Người nhận hàng khác (B') - Mặc định trống */}
                <div>
                  <input
                    type="text"
                    value={activeTab.receiver}
                    onChange={(e) => updateActiveTab((tab) => ({ ...tab, receiver: e.target.value }))}
                    placeholder="Người nhận hàng khác (B')"
                    className="h-8 w-full rounded border border-slate-300 bg-white px-2.5 text-xs font-medium outline-none focus:border-teal-500"
                  />
                </div>

                {/* 6: Nhân viên (Chọn nhân viên có tìm kiếm & popup giống Ảnh 1) */}
                <div className="relative border-b border-slate-200 pb-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-600">Nhân viên:</span>
                    <button
                      type="button"
                      onClick={() => setShowEmployeeDropdown((prev) => !prev)}
                      className="flex items-center justify-between h-7 min-w-[160px] rounded border border-slate-300 bg-white px-2 text-xs font-bold text-slate-800 hover:border-teal-500 transition cursor-pointer shadow-sm"
                    >
                      <span className="truncate">{activeTab.employeeName || 'Chọn nhân viên'}</span>
                      <ChevronDown className="h-3 w-3 text-slate-400 ml-1 flex-shrink-0" />
                    </button>
                  </div>

                  {/* Employee Select Popup Modal (Ảnh 1 của user) */}
                  {showEmployeeDropdown && (
                    <div className="absolute right-0 top-full z-[110] mt-1 w-52 rounded-md border border-slate-300 bg-white shadow-2xl overflow-hidden flex flex-col">
                      <div className="flex items-center justify-between bg-white border-b border-orange-400 p-1">
                        <input
                          type="text"
                          value={employeeSearch}
                          onChange={(e) => setEmployeeSearch(e.target.value)}
                          placeholder="Tìm nhân viên..."
                          className="h-6 w-full px-1.5 text-xs outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setEmployeeSearch('');
                            setShowEmployeeDropdown(false);
                          }}
                          className="text-slate-400 hover:text-red-500 font-bold px-1"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-500 border-b border-slate-200">
                        TÊN
                      </div>
                      <div className="max-h-44 overflow-y-auto">
                        {filteredEmployees.map((u) => {
                          const isSelected = (activeTab.employeeName === u.fullName);
                          return (
                            <div
                              key={u.id}
                              onClick={() => {
                                updateActiveTab((tab) => ({ ...tab, employeeName: u.fullName || u.email }));
                                setShowEmployeeDropdown(false);
                              }}
                              className={`px-3 py-1.5 text-xs cursor-pointer border-b border-slate-100 transition ${
                                isSelected ? 'bg-slate-200 font-bold text-slate-900' : 'hover:bg-slate-100 text-slate-700'
                              }`}
                            >
                              {u.fullName || u.email}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Ghi chú */}
                <div>
                  <input
                    type="text"
                    value={activeTab.description}
                    onChange={(e) => updateActiveTab((tab) => ({ ...tab, description: e.target.value }))}
                    placeholder="Ghi chú đơn hàng..."
                    className="h-8 w-full rounded border border-slate-300 bg-white px-2.5 text-xs outline-none focus:border-teal-500"
                  />
                </div>

                {/* Chiết khấu */}
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">Chiết khấu:</span>
                  <input
                    type="number"
                    min={0}
                    value={activeTab.discount}
                    onChange={(e) =>
                      updateActiveTab((tab) => ({
                        ...tab,
                        discount: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className="h-7 w-28 rounded border border-slate-300 bg-white px-2 text-right text-xs font-semibold outline-none focus:border-teal-500"
                  />
                </div>

                {/* 4: Đã bỏ phần sử dụng tích điểm */}

                {/* Tổng tiền VAT */}
                <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                  <span className="font-semibold text-slate-600">Tổng tiền VAT:</span>
                  <span className="font-bold text-slate-800">
                    {activeTabCalculations.vatTotal.toLocaleString('vi-VN')}
                  </span>
                </div>

                {/* Tổng tiền */}
                <div className="flex items-center justify-between bg-slate-200/80 p-2.5 rounded-md">
                  <span className="font-black text-slate-800">Tổng tiền:</span>
                  <span className="text-base font-black text-slate-900">
                    {activeTabCalculations.totalAmount.toLocaleString('vi-VN')}
                  </span>
                </div>

                {/* Hình thức thanh toán: Radio */}
                <div className="space-y-1.5 pt-1">
                  <span className="font-semibold text-slate-700">Hình thức thanh toán:</span>
                  <div className="flex items-center gap-3">
                    {['Tiền mặt', 'Chuyển khoản', 'ATM'].map((m) => (
                      <label key={m} className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="paymentMethod"
                          checked={activeTab.paymentMethod === m}
                          onChange={() => updateActiveTab((tab) => ({ ...tab, paymentMethod: m }))}
                          className="text-teal-600 focus:ring-teal-500 cursor-pointer"
                        />
                        <span className="text-xs font-medium text-slate-700">{m}</span>
                      </label>
                    ))}
                  </div>
                  {/* Dropdown Chọn tài khoản */}
                  <select
                    value={activeTab.paymentAccount}
                    onChange={(e) => updateActiveTab((tab) => ({ ...tab, paymentAccount: e.target.value }))}
                    className="h-7 w-full rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-teal-500 cursor-pointer"
                  >
                    <option value="">Chọn-</option>
                    <option value="Quỹ tiền mặt">Quỹ tiền mặt</option>
                    <option value="Vietcombank - 0123456789">Vietcombank - 0123456789</option>
                    <option value="Techcombank - 9876543210">Techcombank - 9876543210</option>
                    <option value="ACB - 555666777">ACB - 555666777</option>
                  </select>
                </div>

                {/* Thanh toán */}
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Thanh toán:</span>
                  <input
                    type="number"
                    min={0}
                    value={activeTab.amountPaid}
                    onChange={(e) =>
                      updateActiveTab((tab) => ({
                        ...tab,
                        amountPaid: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className="h-7 w-32 rounded border border-slate-300 bg-white px-2 text-right text-xs font-bold text-emerald-700 outline-none focus:border-teal-500"
                  />
                </div>

                {/* Còn nợ */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-semibold text-slate-600">Còn nợ:</span>
                  <span
                    className={`font-bold ${
                      activeTabCalculations.debt > 0 ? 'text-red-600' : 'text-slate-800'
                    }`}
                  >
                    {activeTabCalculations.debt.toLocaleString('vi-VN')}
                  </span>
                </div>

                {/* Trạng thái */}
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">Trạng thái:</span>
                  <select
                    value={activeTab.status}
                    onChange={(e) => updateActiveTab((tab) => ({ ...tab, status: e.target.value }))}
                    className="h-7 rounded border border-slate-300 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:border-teal-500 cursor-pointer"
                  >
                    <option value="Đã giao hàng">Đã giao hàng</option>
                    <option value="Chờ xử lý">Chờ xử lý</option>
                    <option value="Đang lấy hàng">Đang lấy hàng</option>
                    <option value="Sẵn sàng xuất">Sẵn sàng xuất</option>
                    <option value="Đã hủy">Đã hủy</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* 6. RIC Footer Action Bar */}
          <div className="flex h-12 items-center justify-end gap-1.5 border-t border-slate-300 bg-slate-200 px-4 flex-shrink-0">
            {/* Lưu (Green) */}
            <button
              onClick={() => handleSaveInvoice(false)}
              className="inline-flex items-center gap-1.5 rounded px-4 py-2 text-xs font-bold text-white shadow hover:opacity-90 cursor-pointer"
              style={{ background: '#4CAF50' }}
            >
              💾 Lưu
            </button>

            {/* In (Magenta) */}
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded px-4 py-2 text-xs font-bold text-white shadow hover:opacity-90 cursor-pointer"
              style={{ background: '#E91E63' }}
            >
              🖨 In
            </button>

            {/* Lưu -> In (Blue) */}
            <button
              onClick={() => handleSaveInvoice(true)}
              className="inline-flex items-center gap-1.5 rounded px-4 py-2 text-xs font-bold text-white shadow hover:opacity-90 cursor-pointer"
              style={{ background: '#2196F3' }}
            >
              💾 Lưu -&gt; In
            </button>

            {/* Xuất VAT (Cyan) */}
            <button
              onClick={() => {
                showToast('Đã tạo hóa đơn điện tử VAT thành công');
              }}
              className="inline-flex items-center gap-1.5 rounded px-4 py-2 text-xs font-bold text-white shadow hover:opacity-90 cursor-pointer"
              style={{ background: '#00BCD4' }}
            >
              📄 Xuất VAT
            </button>

            {/* Lưu tạm (Orange) */}
            <button
              onClick={() => {
                updateActiveTab((tab) => ({ ...tab, status: 'Chờ xử lý' }));
                handleSaveInvoice(false);
              }}
              className="inline-flex items-center gap-1.5 rounded px-4 py-2 text-xs font-bold text-white shadow hover:opacity-90 cursor-pointer"
              style={{ background: '#FF9800' }}
            >
              ⏱ Lưu tạm
            </button>

            {/* Xóa / Đóng (Red) */}
            <button
              onClick={() => {
                if (confirm('Bạn có chắc muốn hủy phiên chỉnh sửa phiếu xuất này?')) {
                  setShowFormModal(false);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded px-4 py-2 text-xs font-bold text-white shadow hover:opacity-90 cursor-pointer"
              style={{ background: '#F44336' }}
            >
              ✕ Đóng
            </button>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════
          MODAL: THÔNG TIN HÓA ĐƠN (Chi tiết - Ảnh 5)
         ═════════════════════════════════════════════════════════════ */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-lg border border-slate-300 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Title Bar */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2.5">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">THÔNG TIN HÓA ĐƠN</h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Info Grid */}
            <div className="p-4 space-y-3 text-xs text-slate-700">
              <div className="grid grid-cols-2 gap-2 border-b border-slate-200 pb-2.5">
                <div>
                  <span className="font-semibold text-slate-500 mr-1">Ngày:</span>
                  <span className="font-bold text-slate-800">
                    {selectedOrder.orderDate || selectedOrder.createdAt
                      ? new Date(selectedOrder.orderDate || selectedOrder.createdAt!).toLocaleDateString('vi-VN')
                      : '12/08/2026'}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 mr-1">Mã phiếu:</span>
                  <span className="font-bold text-cyan-800">{selectedOrder.orderNo}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 mr-1">Khách hàng:</span>
                  <span className="font-bold text-slate-800">{selectedOrder.customer || '888'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 mr-1">Địa chỉ/Tel:</span>
                  <span className="font-medium text-slate-700">
                    {selectedOrder.customerAddress || ''} / {selectedOrder.customerPhone || '09123456789'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="font-semibold text-slate-500 mr-1">Người nhận:</span>
                  <span className="font-bold text-slate-800">{selectedOrder.receiver || "-"}</span>
                </div>
              </div>

              {/* Detail Items Table */}
              <div className="overflow-x-auto border border-slate-300 rounded">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                      <th className="border border-slate-300 px-2 py-1.5 text-center w-10">TT</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">Mã hàng</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">Tên</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-center w-14">ĐV</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-center w-16">Số lượng</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right w-16">Giá</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right w-16">Chiết khấu</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right w-20">Tổng tiền</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.details && selectedOrder.details.length > 0 ? (
                      selectedOrder.details.map((d, i) => (
                        <tr key={d.id || i} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="border border-slate-200 px-2 py-1.5 text-center">{i + 1}</td>
                          <td className="border border-slate-200 px-2 py-1.5 font-bold text-cyan-800">
                            {d.product?.internalSku || '111'}
                          </td>
                          <td className="border border-slate-200 px-2 py-1.5">{d.product?.name || '2 123'}</td>
                          <td className="border border-slate-200 px-2 py-1.5 text-center">{d.product?.unit || '123'}</td>
                          <td className="border border-slate-200 px-2 py-1.5 text-center font-bold">{d.requiredQty}</td>
                          <td className="border border-slate-200 px-2 py-1.5 text-right">
                            {Number(d.unitPrice || 0).toLocaleString('vi-VN')}
                          </td>
                          <td className="border border-slate-200 px-2 py-1.5 text-right">
                            {Number(d.discountAmount || 0).toLocaleString('vi-VN')}
                          </td>
                          <td className="border border-slate-200 px-2 py-1.5 text-right font-bold">
                            {Number(d.totalLineAmount || d.requiredQty * d.unitPrice || 0).toLocaleString('vi-VN')}
                          </td>
                          <td className="border border-slate-200 px-2 py-1.5 text-slate-400">{d.note || ''}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="border border-slate-200 px-2 py-1.5 text-center">1</td>
                        <td className="border border-slate-200 px-2 py-1.5 font-bold text-cyan-800">111</td>
                        <td className="border border-slate-200 px-2 py-1.5">2 123</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-center">123</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-center font-bold">1</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-right">5</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-right">0</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-right font-bold">5</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-slate-400" />
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold">
                      <td colSpan={4} className="border border-slate-300 px-2 py-1.5 text-center">
                        Tổng:
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-center font-bold">
                        {selectedOrder.details?.reduce((s, r) => s + r.requiredQty, 0) || 1}
                      </td>
                      <td className="border border-slate-300" />
                      <td className="border border-slate-300 px-2 py-1.5 text-right">
                        {selectedOrder.discount || 0}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-right font-bold">
                        {selectedOrder.totalAmount || 5}
                      </td>
                      <td className="border border-slate-300" />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Bottom Summary Bar */}
              <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-200 font-medium">
                <div>
                  <span className="font-semibold text-slate-500 mr-1">VAT:</span>
                  <span className="font-bold text-slate-800">{selectedOrder.vatAmount || 0}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 mr-1">Tổng tiền:</span>
                  <span className="font-bold text-slate-800">{selectedOrder.totalAmount || 5}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 mr-1">Thanh toán:</span>
                  <span className="font-bold text-emerald-700">
                    {selectedOrder.amountPaid || selectedOrder.totalAmount || 5}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 mr-1">Còn nợ:</span>
                  <span className="font-bold text-slate-800">
                    {(Number(selectedOrder.totalAmount || 5) - Number(selectedOrder.amountPaid || selectedOrder.totalAmount || 5)).toLocaleString('vi-VN')}
                  </span>
                </div>
                <div className="font-bold text-blue-700">{selectedOrder.status || 'Đã giao hàng'}</div>
              </div>
            </div>

            {/* Modal Action Buttons: [ Mở => Sửa ] (Green), [ Print ] (Magenta), [ Đóng ] (Red) */}
            <div className="flex items-center justify-start gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2.5">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  openCreateModalWithOrder(selectedOrder, false);
                }}
                className="inline-flex items-center gap-1.5 rounded px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:opacity-90 cursor-pointer"
                style={{ background: '#4CAF50' }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Mở =&gt; Sửa
              </button>

              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:opacity-90 cursor-pointer"
                style={{ background: '#E91E63' }}
              >
                <Printer className="h-3.5 w-3.5" />
                Print
              </button>

              <button
                onClick={() => setShowDetailModal(false)}
                className="inline-flex items-center gap-1.5 rounded px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:opacity-90 cursor-pointer"
                style={{ background: '#F44336' }}
              >
                <X className="h-3.5 w-3.5" />
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════
          MODAL: HIỆN / ẨN CỘT (Settings Gear Modal)
         ═════════════════════════════════════════════════════════════ */}
      {showColumnSettings && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[380px] rounded-lg border border-slate-300 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2.5">
              <h3 className="text-sm font-bold text-slate-800">Hiện/Ẩn cột</h3>
              <button
                onClick={() => setShowColumnSettings(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[380px] overflow-y-auto p-2">
              <table className="w-full text-xs border-collapse border border-slate-300">
                <thead>
                  <tr style={{ background: '#e0f2fe' }}>
                    <th className="w-10 border border-slate-300 px-2 py-1.5 text-center font-bold text-slate-700">TT</th>
                    <th className="border border-slate-300 px-3 py-1.5 text-left font-bold text-slate-700">Tên cột</th>
                    <th className="w-24 border border-slate-300 px-2 py-1.5 text-center font-bold text-slate-700">
                      <div className="flex items-center justify-center gap-1">
                        <span>Ẩn/Hiện</span>
                        <input
                          type="checkbox"
                          checked={COLUMN_LIST.every((col) => columnVis[col.key])}
                          onChange={(e) => {
                            const val = e.target.checked;
                            const next = { ...columnVis };
                            COLUMN_LIST.forEach((col) => {
                              next[col.key] = val;
                            });
                            setColumnVis(next);
                          }}
                          className="h-3.5 w-3.5 rounded border-slate-400 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                        />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COLUMN_LIST.map((col, idx) => (
                    <tr key={col.key} className="border-b border-slate-200 hover:bg-slate-50 transition">
                      <td className="border border-slate-200 px-2 py-1.5 text-center text-slate-600">{idx + 1}</td>
                      <td className="border border-slate-200 px-3 py-1.5 text-slate-700 font-medium">{col.label}</td>
                      <td className="border border-slate-200 px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={columnVis[col.key] ?? true}
                          onChange={(e) => {
                            setColumnVis((prev) => ({ ...prev, [col.key]: e.target.checked }));
                          }}
                          className="h-3.5 w-3.5 rounded border-slate-400 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-4 py-2">
              <button
                onClick={() => setShowColumnSettings(false)}
                className="rounded-md bg-cyan-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-cyan-700 transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════
          MODAL: THÊM NHANH KHÁCH HÀNG
         ═════════════════════════════════════════════════════════════ */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-300 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2.5">
              <h3 className="text-sm font-bold text-slate-800">Thêm khách hàng mới</h3>
              <button
                onClick={() => setShowAddCustomerModal(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mã khách hàng:</label>
                <input
                  type="text"
                  value={newCustomerForm.customerCode}
                  onChange={(e) => setNewCustomerForm((prev) => ({ ...prev, customerCode: e.target.value }))}
                  placeholder="Tự động sinh nếu để trống..."
                  className="h-8 w-full rounded border border-slate-300 px-2 outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tên khách hàng: <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Nhập tên khách hàng..."
                  className="h-8 w-full rounded border border-slate-300 px-2 outline-none focus:border-cyan-500 font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Số điện thoại:</label>
                <input
                  type="text"
                  value={newCustomerForm.phone}
                  onChange={(e) => setNewCustomerForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="0912345678..."
                  className="h-8 w-full rounded border border-slate-300 px-2 outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Địa chỉ:</label>
                <input
                  type="text"
                  value={newCustomerForm.address}
                  onChange={(e) => setNewCustomerForm((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Nhập địa chỉ..."
                  className="h-8 w-full rounded border border-slate-300 px-2 outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-cyan-600 px-4 py-1.5 font-bold text-white shadow-sm hover:bg-cyan-700 cursor-pointer"
                >
                  Lưu khách hàng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Barcode Scanner Modal ═══ */}
      {showScannerModal && (
        <BarcodeScanner
          isOpen={showScannerModal}
          onProductFound={(product, qty, price) => handleProductScanned(product, qty, price)}
          onClose={() => setShowScannerModal(false)}
          defaultQty={1}
        />
      )}
    </div>
  );
}