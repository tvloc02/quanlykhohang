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
  Search,
  Layers,
  MapPin,
  PlusCircle,
} from 'lucide-react';
import MainLayout from '../../../shared/components/MainLayout';
import BarcodeScanner, { type ScannedProduct } from '../../../shared/components/BarcodeScanner';
import { filterOutDeletedProducts } from '../../../shared/utils/productUtils';
import { getStoredWarehouses, mergeStoredWarehouses, saveStoredWarehouses } from '../../../shared/utils/warehouseAssignments';
import { SmartSlottingGridModal } from '../../warehouses/components/SmartSlottingGridModal';



// ─── TYPES & INTERFACES ────────────────────────────────────────

export interface ProductOption {
  id: string;
  internalSku: string;
  name: string;
  unit?: string;
  purchasePrice?: number;
  salePrice?: number;
  wholesalePrice?: number;
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

export function getProductWarehouseStock(p?: ProductOption | null, whCode?: string): number {
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
    }
  }

  return Number(p.totalStock ?? p.totalPhysical ?? p.stockQty ?? (p as any).quantity ?? (p as any).stock ?? 0);
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
  warehouseCode?: string;
  locationBin?: string;
  assignedBins?: string[];
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

export function findStockBinForProduct(
  pId: string,
  pSku: string,
  pName: string,
  whCode?: string
): { locationBin: string; assignedBins: string[] } {
  if (!pId && !pSku && !pName) {
    return { locationBin: '', assignedBins: [] };
  }

  const normId = String(pId || '').trim().toLowerCase();
  const normSku = String(pSku || '').trim().toLowerCase();
  const normName = String(pName || '').trim().toLowerCase();
  const targetWh = String(whCode || '').trim().toUpperCase();

  const foundBinsSet = new Set<string>();

  // 1. Check local stock-in orders
  try {
    const rawOrders = localStorage.getItem('stored_stock_in_orders');
    if (rawOrders) {
      const orders = JSON.parse(rawOrders);
      if (Array.isArray(orders)) {
        orders.forEach((ord: any) => {
          const oWh = String(ord.warehouseCode || ord.branchCode || '').trim().toUpperCase();
          if (targetWh && oWh && oWh !== targetWh) return;
          (ord.details || ord.items || []).forEach((item: any) => {
            const iName = String(item.productName || '').trim().toLowerCase();
            const iSku = String(item.sku || item.productSku || '').trim().toLowerCase();
            const iId = String(item.productId || '').trim().toLowerCase();

            const matches =
              (normId && iId && normId === iId) ||
              (normSku && iSku && normSku === iSku) ||
              (normName && iName && (normName.includes(iName) || iName.includes(normName)));

            if (matches) {
              let bins: string[] = item.assignedBins || (item.locationBin ? item.locationBin.split(',') : []);
              bins.forEach((b: string) => {
                const clean = b.split('(')[0].trim();
                const short = (clean.split('-').pop() || clean).toUpperCase();
                if (short) foundBinsSet.add(short);
              });
            }
          });
        });
      }
    }
  } catch {}

  // 2. Check stored warehouses customBins
  try {
    const rawWhs = localStorage.getItem('smart-wms-warehouses');
    if (rawWhs) {
      const whs = JSON.parse(rawWhs);
      if (Array.isArray(whs)) {
        whs.forEach((wh: any) => {
          const wCode = String(wh.code || wh.id || '').trim().toUpperCase();
          if (targetWh && wCode && wCode !== targetWh) return;
          (wh.subWarehouses || []).forEach((sub: any) => {
            (sub.racks || []).forEach((rk: any) => {
              if (rk.customBins) {
                Object.entries(rk.customBins).forEach(([bKey, cfg]: [string, any]) => {
                  const notes = String(cfg?.notes || '').toLowerCase();
                  const pct = Number(cfg?.occupancyPct || 0);
                  if (
                    pct > 0 &&
                    ((normName && notes.includes(normName)) || (normSku && notes.includes(normSku)))
                  ) {
                    const shortBin = (bKey.split('-').pop() || bKey).toUpperCase();
                    foundBinsSet.add(shortBin);
                  }
                });
              }
            });
          });
        });
      }
    }
  } catch {}

  const binsList = Array.from(foundBinsSet);
  if (binsList.length > 0) {
    return {
      locationBin: binsList.join(', '),
      assignedBins: binsList,
    };
  }

  return { locationBin: '', assignedBins: [] };
}

export function getAvailableBinsForProduct(row?: FormDetailRow | null, branchCode?: string): string[] {
  const binsSet = new Set<string>();

  if (row?.locationBin) binsSet.add(row.locationBin);
  if (Array.isArray(row?.assignedBins)) {
    row.assignedBins.forEach((b) => b && binsSet.add(b));
  }

  if (row?.productId || row?.productName || row?.productSku) {
    const autoBins = findStockBinForProduct(
      row.productId || '',
      row.productSku || '',
      row.productName || '',
      branchCode
    );
    autoBins.assignedBins.forEach((b) => binsSet.add(b));
  }

  return Array.from(binsSet);
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

const DEFAULT_FALLBACK_PRODUCTS: ProductOption[] = [
  { id: 'p1', internalSku: 'SP001', name: 'Đèn Led Module 3 bóng Samsung', unit: 'Cái', purchasePrice: 45000, salePrice: 65000, wholesalePrice: 55000, price: 65000 },
  { id: 'p2', internalSku: 'SP002', name: 'Cảm biến nhiệt độ công nghiệp Omron', unit: 'Bộ', purchasePrice: 320000, salePrice: 450000, wholesalePrice: 390000, price: 450000 },
  { id: 'p3', internalSku: 'SP003', name: 'Dây cáp mạng Cat6 UTP 305m', unit: 'Cuộn', purchasePrice: 1200000, salePrice: 1500000, wholesalePrice: 1350000, price: 1500000 },
  { id: 'p4', internalSku: 'SP004', name: 'Bộ nguồn Tổ Ong 12V 30A High Quality', unit: 'Cái', purchasePrice: 180000, salePrice: 240000, wholesalePrice: 210000, price: 240000 },
  { id: 'p5', internalSku: 'SP005', name: 'Công tắc hành trình Panasonic HZ-12', unit: 'Cái', purchasePrice: 85000, salePrice: 120000, wholesalePrice: 100000, price: 120000 },
  { id: 'p6', internalSku: 'SP006', name: 'Thanh nhôm định hình 20x20 2m', unit: 'Thanh', purchasePrice: 110000, salePrice: 160000, wholesalePrice: 135000, price: 160000 },
];

function formatNumberWithCommas(val: number | string): string {
  if (val === undefined || val === null || val === '') return '';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  if (isNaN(num)) return '';
  return num.toLocaleString('en-US');
}

function parseFormattedNumber(val: string): number {
  if (!val) return 0;
  const clean = val.replace(/,/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function makeEmptyRow(index: number, defaultWhCode = 'KHO-TONG'): FormDetailRow {
  return {
    rowId: `row-${Date.now()}-${index}-${Math.random()}`,
    productId: '',
    productSku: '',
    productName: '',
    warehouseCode: defaultWhCode,
    locationBin: '',
    assignedBins: [],
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

export interface CreateOutboundOrderPageProps {
  onBack?: () => void;
  standalone?: boolean;
  featureMode?: 'orders' | 'retail' | 'transfer-out' | 'sales-order' | 'quote' | 'disposal' | 'return-supplier';
  orderType?: string;
  title?: string;
  codePrefix?: string;
  partnerLabel?: string;
}

export default function CreateOutboundOrderPage({
  onBack,
  standalone = true,
  featureMode = 'orders',
  orderType,
  title,
  codePrefix = 'PXK',
  partnerLabel = 'Khách hàng',
}: CreateOutboundOrderPageProps) {
  const navigate = useNavigate();
  const isRetail = featureMode === 'retail' || (typeof window !== 'undefined' && window.location.pathname.includes('/outbound/retail'));
  const isDisposal = featureMode === 'disposal' || (typeof window !== 'undefined' && window.location.pathname.includes('/outbound/disposal'));
  const isReturnSupplier = featureMode === 'return-supplier' || orderType === 'return-supplier' || partnerLabel === 'Nhà cung cấp';

  const getProductPriceForMode = useCallback((p: ProductOption) => {
    if (isReturnSupplier) {
      return p.purchasePrice || (p as any).importPrice || 0;
    }
    if (isRetail) {
      return p.salePrice || p.price || 0;
    }
    return (p.wholesalePrice && p.wholesalePrice > 0) ? p.wholesalePrice : (p.salePrice || p.price || 0);
  }, [isReturnSupplier, isRetail]);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const currentUserName = currentUser.fullName || currentUser.email?.split('@')[0] || 'System Administrator';

  // Master Data
  const [products, setProducts] = useState<ProductOption[]>(DEFAULT_FALLBACK_PRODUCTS);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>(() => getStoredWarehouses());


  // Toast alert
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fullscreen & Modal state
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [pickBinModalOpen, setPickBinModalOpen] = useState(false);
  const [activePickBinRowId, setActivePickBinRowId] = useState<string | null>(null);

  const openPickBinModal = (rowId?: string) => {
    if (rowId) setActivePickBinRowId(rowId);
    setPickBinModalOpen(true);
  };
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', phone: '', address: '', customerCode: '' });

  // Dropdown & Quick Search states
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [activeProductDropdownRowId, setActiveProductDropdownRowId] = useState<string | null>(null);
  const [quickProductSearch, setQuickProductSearch] = useState('');
  const [showQuickSearchDropdown, setShowQuickSearchDropdown] = useState(false);
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);
  const [disposalReasonSelect, setDisposalReasonSelect] = useState('Hàng hết hạn sử dụng (HSD)');
  const [disposalReasons, setDisposalReasons] = useState<string[]>([
    'Hàng hết hạn sử dụng (HSD)',
    'Hàng hư hỏng / Bể vỡ trong quá trình lưu kho',
    'Hàng ẩm mốc / Biến chất / Lỗi bảo quản',
    'Hàng lỗi nhà sản xuất (không đổi trả được)',
    'Hao hụt kiểm kê / Thanh lý tiêu hủy',
    'Khác (Ghi chú chi tiết)',
  ]);
  const [showAddReasonModal, setShowAddReasonModal] = useState(false);
  const [newReasonInput, setNewReasonInput] = useState('');
  const [disposalMethod, setDisposalMethod] = useState('Tiêu hủy hoàn toàn (đốt / rác thải / chôn lấp)');

  // Synchronous Multi-Tab state with Session Storage restoration
  const [tabs, setTabs] = useState<OutboundTab[]>(() => {
    try {
      const savedDraft = sessionStorage.getItem('outbound_tabs_draft');
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((t: OutboundTab) => ({
            ...t,
            details: (t.details || []).map((d) => ({
              ...d,
              locationBin: d.locationBin === 'Kệ A1-01' ? '' : (d.locationBin || ''),
              assignedBins: (d.assignedBins || []).filter((b) => b !== 'Kệ A1-01'),
            })),
          }));
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
      if (!target.closest('.customer-dropdown-box') && !target.closest('.product-table-dropdown') && !target.closest('.quick-search-box')) {
        setShowCustomerDropdown(false);
        setActiveProductDropdownRowId(null);
        setShowQuickSearchDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch Master Data
  useEffect(() => {
    async function loadMasterData() {
      try {
        const partnerEndpoint = isReturnSupplier ? `${API_BASE_URL}/suppliers` : `${API_BASE_URL}/customers`;
        const [custRes, prodRes, userRes, whRes] = await Promise.all([
          fetch(partnerEndpoint, { headers: authHeaders() }).catch(() => null),
          fetch(`${API_BASE_URL}/products`, { headers: authHeaders() }).catch(() => null),
          fetch(`${API_BASE_URL}/users`, { headers: authHeaders() }).catch(() => null),
          fetch(`${API_BASE_URL}/warehouses`, { headers: authHeaders() }).catch(() => null),
        ]);

        if (custRes && custRes.ok) {
          const custData = await custRes.json();
          const list = Array.isArray(custData) ? custData : custData.data || [];
          const normalized: CustomerOption[] = list.map((c: any) => ({
            id: String(c.id),
            customerCode: c.customerCode || c.supplierCode || c.code || (isReturnSupplier ? `NCC${c.id}` : `KH${c.id}`),
            name: c.name || '',
            phone: c.phone || '',
            address: c.address || '',
          }));
          setCustomers(normalized);
        }

        if (prodRes && prodRes.ok) {
          const prodData = await prodRes.json();
          const list = Array.isArray(prodData) ? prodData : prodData.data || [];
          if (list.length > 0) {
            const normalized: ProductOption[] = list.map((p: any) => ({
              id: String(p.id),
              internalSku: p.internalSku || p.sku || p.code || `SP${p.id}`,
              name: p.name || '',
              unit: p.unit || 'Cái',
              purchasePrice: Number(p.importPrice || p.purchasePrice || 0),
              salePrice: Number(p.retailPrice || p.salePrice || p.price || 0),
              wholesalePrice: Number(p.wholesalePrice || 0),
              price: Number(p.retailPrice || p.salePrice || p.price || 0),
              totalStock: Number(p.totalStock ?? p.totalPhysical ?? p.stockQty ?? 0),
              totalPhysical: Number(p.totalPhysical ?? p.totalStock ?? 0),
              stockQty: Number(p.stockQty ?? p.totalStock ?? 0),
              stockBalances: Array.isArray(p.stockBalances) ? p.stockBalances : [],
            }));
            setProducts(filterOutDeletedProducts(normalized));
          } else {
            setProducts(filterOutDeletedProducts(DEFAULT_FALLBACK_PRODUCTS));
          }
        } else {
          setProducts(filterOutDeletedProducts(DEFAULT_FALLBACK_PRODUCTS));
        }

        if (userRes && userRes.ok) {
          const userData = await userRes.json();
          const list = Array.isArray(userData) ? userData : userData.data || [];
          setUsers(list);
        }

        if (whRes && whRes.ok) {
          const whData = await whRes.json();
          const list = Array.isArray(whData) ? whData : whData.data || [];
          setWarehouses(mergeStoredWarehouses(list, getStoredWarehouses()));
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
      navigate(isDisposal ? '/outbound/disposal' : (isRetail ? '/outbound/retail' : '/outbound/orders'));
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
            newRow.price = getProductPriceForMode(p);
            if (newRow.qty === 0) newRow.qty = 1;
          }
        }

        if ((patch.productId || patch.productName || patch.productSku) && !patch.locationBin && (!patch.assignedBins || patch.assignedBins.length === 0)) {
          const autoBin = findStockBinForProduct(
            newRow.productId || '',
            newRow.productSku || '',
            newRow.productName || '',
            newRow.warehouseCode || tab.branchCode
          );
          if (autoBin.locationBin) {
            newRow.locationBin = autoBin.locationBin;
            newRow.assignedBins = autoBin.assignedBins;
          }
        }

        const qty = Number(newRow.qty) || 0;
        const price = Number(newRow.price) || 0;
        const lineTotalBeforeDisc = qty * price;

        const discPercent = Number(newRow.discountPercent) || 0;
        const discAmount = (lineTotalBeforeDisc * discPercent) / 100;

        const vatPercent = Number(newRow.vatPercent) || 0;
        // Chiết khấu và VAT đều tính theo tổng số tiền gốc (lineTotalBeforeDisc)
        const vatAmount = (lineTotalBeforeDisc * vatPercent) / 100;

        newRow.discountAmount = discAmount;
        newRow.vatAmount = vatAmount;
        newRow.totalAmount = Math.max(0, lineTotalBeforeDisc - discAmount + vatAmount);

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
    const rawRetail = scanned.salePrice || scanned.purchasePrice || 0;
    const rawWholesale = (scanned as any).wholesalePrice || rawRetail;
    const priceVal = isRetail ? rawRetail : (rawWholesale > 0 ? rawWholesale : rawRetail);

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

  // Tổng tiền gốc chưa chiết khấu/VAT
  const baseSubtotal = useMemo(() => {
    return activeValidItems.reduce(
      (s, r) => s + (Number(r.qty) || 0) * (Number(r.price) || 0),
      0
    );
  }, [activeValidItems]);

  // Tổng chiết khấu của tất cả các dòng
  const totalRowDiscount = useMemo(() => {
    return activeValidItems.reduce((s, r) => s + (Number(r.discountAmount) || 0), 0);
  }, [activeValidItems]);

  // Tổng VAT của tất cả các dòng
  const totalRowVat = useMemo(() => {
    return activeValidItems.reduce((s, r) => s + (Number(r.vatAmount) || 0), 0);
  }, [activeValidItems]);

  // Chiết khấu đơn hàng ở khung bên phải
  const overallDiscount = useMemo(() => {
    return Number(activeTab?.discount) || 0;
  }, [activeTab?.discount]);

  // VAT đơn hàng ở khung bên phải tính theo tổng tiền gốc
  const overallVatAmount = useMemo(() => {
    const rate = Number(activeTab?.vatRate) || 0;
    return (baseSubtotal * rate) / 100;
  }, [baseSubtotal, activeTab?.vatRate]);

  // Tổng Chiết Khấu và Tổng VAT
  const totalDiscount = useMemo(() => {
    return totalRowDiscount + overallDiscount;
  }, [totalRowDiscount, overallDiscount]);

  const totalVat = useMemo(() => {
    return totalRowVat + overallVatAmount;
  }, [totalRowVat, overallVatAmount]);

  const subtotal = useMemo(() => {
    return baseSubtotal;
  }, [baseSubtotal]);

  const vatAmount = useMemo(() => {
    return totalVat;
  }, [totalVat]);

  const grandTotal = useMemo(() => {
    if (!activeTab) return 0;
    return Math.max(
      0,
      baseSubtotal - totalDiscount + totalVat + (Number(activeTab.shippingFee) || 0)
    );
  }, [baseSubtotal, totalDiscount, totalVat, activeTab?.shippingFee]);

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

    const defaultCode = isDisposal
      ? `XH_${Date.now().toString().slice(-6)}`
      : (isRetail ? `XBL_${Date.now().toString().slice(-6)}` : `XBH_${Date.now().toString().slice(-6)}`);

    const finalOrderNo = activeTab.orderNo.trim() ? activeTab.orderNo.trim().toUpperCase() : defaultCode;

    const payload = isDisposal
      ? {
          orderNo: finalOrderNo,
          orderType: 'disposal',
          branchCode: activeTab.branchCode || 'KHO-TONG',
          employeeName: activeTab.employeeName || currentUser?.fullName || currentUser?.email?.split('@')[0] || 'Quản trị viên hệ thống',
          customerName: disposalReasonSelect || 'Hàng hết hạn / Hư hỏng',
          orderDate: activeTab.orderDate,
          expectedDate: activeTab.orderDate,
          status: activeTab.status || 'Đã xuất hủy',
          description: [disposalReasonSelect, activeTab.description?.trim(), disposalMethod ? `Phương án: ${disposalMethod}` : ''].filter(Boolean).join(' - '),
          subtotal,
          discount: 0,
          vatRate: 0,
          vatAmount: 0,
          totalAmount: subtotal,
          amountPaid: 0,
          details: activeValidItems.map((r) => ({
            productId: r.productId,
            productSku: r.productSku,
            productName: r.productName,
            warehouseCode: r.warehouseCode || activeTab.branchCode || 'KHO-TONG',
            locationBin: r.locationBin || (r.assignedBins && r.assignedBins.join(', ')) || '',
            assignedBins: Array.isArray(r.assignedBins) && r.assignedBins.length > 0 ? r.assignedBins : (r.locationBin ? [r.locationBin] : []),
            unit: r.unit,
            qty: Number(r.qty),
            price: Number(r.price),
            note: r.note,
          })),
        }
      : {
          orderNo: finalOrderNo,
          orderType: isRetail ? 'retail' : 'orders',
          branchCode: activeTab.branchCode || 'KHO-NVL',
          employeeName: activeTab.employeeName || currentUser?.fullName || currentUser?.email?.split('@')[0] || 'Quản trị viên hệ thống',
          customerId: activeTab.customerId,
          customerName: activeTab.customer?.trim() || (isRetail ? 'Khách hàng bán lẻ' : '888 - Khách lẻ'),
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
            warehouseCode: r.warehouseCode || activeTab.branchCode || 'KHO-NVL',
            locationBin: r.locationBin || (r.assignedBins && r.assignedBins.join(', ')) || '',
            assignedBins: Array.isArray(r.assignedBins) && r.assignedBins.length > 0 ? r.assignedBins : (r.locationBin ? [r.locationBin] : []),
            unit: r.unit,
            qty: Number(r.qty),
            price: Number(r.price),
            note: r.note,
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
        throw new Error(errData?.message || `Không thể tạo ${isDisposal ? 'phiếu xuất hủy' : 'phiếu xuất hàng'}`);
      }

      // Automatically update local inventory balances & bin topologies upon save
      try {
        const localWhs = getStoredWarehouses();
        let changed = false;

        activeValidItems.forEach((r) => {
          const binsToDeduct: string[] = Array.isArray(r.assignedBins) && r.assignedBins.length > 0
            ? r.assignedBins
            : (r.locationBin ? r.locationBin.split(',').map((s: string) => s.trim()) : []);

          binsToDeduct.forEach((bCode) => {
            const cleanCode = bCode.split('(')[0].trim();
            const normKey = cleanCode.toUpperCase().replace(/[^A-Z0-9]/g, '');

            localWhs.forEach((wh) => {
              (wh.subWarehouses || []).forEach((sub) => {
                (sub.racks || []).forEach((rk) => {
                  const customBins = rk.customBins as Record<string, any> | undefined;
                  if (customBins) {
                    Object.keys(customBins).forEach((k) => {
                      const normK = k.toUpperCase().replace(/[^A-Z0-9]/g, '');
                      if (normK === normKey || k === cleanCode || k.includes(cleanCode)) {
                        const curr = customBins[k];
                        const oldPct = Number(curr?.occupancyPct ?? 100);
                        const newPct = Math.max(0, oldPct - 100);
                        customBins[k] = {
                          ...curr,
                          occupancyPct: newPct,
                          notes: newPct === 0 ? 'Ô Trống' : `Đã lưu xuất: ${r.productName}`,
                        };
                        changed = true;
                      }
                    });
                  }
                });
              });
            });
          });
        });

        if (changed) {
          saveStoredWarehouses(localWhs);
        }

        // Store outbound order in local storage for instant sync across all views
        try {
          const storedOutboundStr = localStorage.getItem('stored_outbound_orders');
          let storedOutbound: any[] = [];
          if (storedOutboundStr) {
            try { storedOutbound = JSON.parse(storedOutboundStr); } catch {}
          }
          storedOutbound.push({
            ...payload,
            id: payload.orderNo || `out_${Date.now()}`,
            orderCode: payload.orderNo,
            createdAt: new Date().toISOString(),
          });
          localStorage.setItem('stored_outbound_orders', JSON.stringify(storedOutbound));

          // Also update smart-wms-products in localStorage
          const storedProdsStr = localStorage.getItem('smart-wms-products');
          if (storedProdsStr) {
            let prods = JSON.parse(storedProdsStr);
            if (Array.isArray(prods)) {
              activeValidItems.forEach((r) => {
                prods = prods.map((p: any) => {
                  if (
                    p.id === r.productId ||
                    p.sku === r.productSku ||
                    (r.productSku && p.sku && p.sku.toUpperCase() === r.productSku.toUpperCase())
                  ) {
                    const currentStk = Number(p.stock || 0);
                    return {
                      ...p,
                      stock: Math.max(0, currentStk - Number(r.qty || 0)),
                    };
                  }
                  return p;
                });
              });
              localStorage.setItem('smart-wms-products', JSON.stringify(prods));
            }
          }
        } catch (errLocal) {
          console.warn('Lỗi lưu stored_outbound_orders vào localStorage:', errLocal);
        }

        window.dispatchEvent(new Event('warehouse-goods-cleared'));
        window.dispatchEvent(new Event('storage'));
      } catch (e) {
        console.error('Lỗi tự động cập nhật sơ đồ kho sau khi xuất hàng:', e);
      }

      setToast({
        message: `Đã lưu thành công ${isDisposal ? 'phiếu xuất hủy' : 'phiếu xuất kho'} ${payload.orderNo || ''}!`,
        type: 'success',
      });

      setTimeout(() => {
        handleBackNavigation();
      }, 1000);
    } catch (err: any) {
      setToast({ message: err.message || `Lỗi khi lưu ${isDisposal ? 'phiếu xuất hủy' : 'phiếu xuất hàng'}`, type: 'error' });
    }
  };

  const getFilteredProductsForRow = (rowText: string) => {
    const kw = (rowText || '').trim().toLowerCase();
    if (!kw) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(kw) ||
        (p.internalSku || '').toLowerCase().includes(kw) ||
        `${p.internalSku} ${p.name}`.toLowerCase().includes(kw)
    );
  };

  const filteredQuickProducts = useMemo(() => {
    const kw = quickProductSearch.trim().toLowerCase();
    if (!kw) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(kw) ||
        (p.internalSku || '').toLowerCase().includes(kw)
    );
  }, [products, quickProductSearch]);

  const handleSelectQuickProduct = (p: ProductOption) => {
    if (!activeTab) return;
    const targetPrice = getProductPriceForMode(p);
    const emptyRow = activeTab.details.find((r) => !r.productId && !r.productName);
    if (emptyRow) {
      updateRow(emptyRow.rowId, {
        productId: p.id,
        productSku: p.internalSku,
        productName: p.name,
        unit: p.unit || 'Cái',
        price: targetPrice,
        qty: 1,
      });
    } else {
      const newRow = makeEmptyRow(activeTab.details.length);
      newRow.productId = p.id;
      newRow.productSku = p.internalSku;
      newRow.productName = p.name;
      newRow.unit = p.unit || 'Cái';
      newRow.price = targetPrice;
      newRow.qty = 1;
      newRow.totalAmount = targetPrice;
      updateActiveTab((tab) => ({ ...tab, details: [...tab.details, newRow] }));
    }
    setQuickProductSearch('');
    setShowQuickSearchDropdown(false);
    setToast({ message: `Đã chọn: ${p.name}`, type: 'success' });
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
          title={isDisposal ? "Quét Mã Barcode Hàng Hóa Xuất Hủy" : "Quét Mã Barcode Hàng Hóa Xuất Kho"}
        />
      )}

      {/* Quick Customer Add Modal (Only for regular sales) */}
      {!isDisposal && showAddCustomerModal && (
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

      {/* ═══ 1. TOP HEADER BAR: Page Title Left, Multi-Tab & Back Button Right ═══ */}
      {!isFullScreen && (
        <div className="flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
          <div className="inline-flex items-center gap-2.5 rounded-xl bg-cyan-600 px-4 py-2 text-white shadow-sm">
            <Package className="h-5 w-5 text-cyan-100" />
            <h1 className="text-base font-black tracking-tight uppercase">
              {isDisposal ? (title || 'TẠO PHIẾU XUẤT HỦY HÀNG HÓA') : 'TẠO PHIẾU XUẤT HÀNG HÓA'}
            </h1>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
            {/* MULTI-TAB SWITCHER */}
            {tabs.map((tab, idx) => {
              const isActive = tab.tabId === activeTabId;
              const validItemsCount = tab.details.filter((d) => d.productName && d.qty > 0).length;
              return (
                <div
                  key={tab.tabId}
                  onClick={() => setActiveTabId(tab.tabId)}
                  className={`group inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer border shadow-xs select-none ${isActive
                    ? 'bg-cyan-600 text-white border-cyan-600 shadow-md ring-2 ring-cyan-200'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-cyan-50 hover:border-cyan-300 hover:text-cyan-800'
                    }`}
                >
                  <FileText className={`h-3.5 w-3.5 ${isActive ? 'text-cyan-100' : 'text-cyan-600'}`} />
                  <span className="max-w-[140px] truncate">
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
              title="Tạo thêm phiếu mới (Tab tiếp theo)"
            >
              <Plus size={14} className="text-cyan-700" />
              <span>+ Thêm phiếu mới</span>
            </button>

            <button
              type="button"
              onClick={handleBackNavigation}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-cyan-500 bg-white px-4 py-1.5 text-xs font-bold text-cyan-700 hover:bg-cyan-50 transition shadow-xs cursor-pointer ml-1"
            >
              <ArrowLeft size={16} />
              <span>Quay lại</span>
            </button>
          </div>
        </div>
      )}

      {/* ═══ 2. FULL-WIDTH TOP CONTROL BAR (Horizontal bar spanning full width across page) ═══ */}
      <div className="w-full rounded-2xl border-2 border-cyan-500/30 bg-white p-4 shadow-md flex-shrink-0">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 items-center">
          {/* Ngày xuất hàng / Ngày xuất hủy */}
          <div>
            <label className="mb-1.5 block text-xs font-black uppercase text-slate-700">
              {isDisposal ? 'Ngày xuất hủy' : 'Ngày xuất hàng'}
            </label>
            <input
              type="text"
              value={activeTab?.orderDate || ''}
              onChange={(e) => updateActiveTab((t) => ({ ...t, orderDate: e.target.value }))}
              placeholder="DD/MM/YYYY"
              className="h-10 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20"
            />
          </div>

          {/* Mã phiếu / Lệnh */}
          <div>
            <label className="mb-1.5 block text-xs font-black uppercase text-slate-700">
              {isDisposal ? 'Mã phiếu xuất hủy' : 'Mã phiếu / Lệnh'}
            </label>
            <input
              type="text"
              value={activeTab?.orderNo || ''}
              onChange={(e) => updateActiveTab((t) => ({ ...t, orderNo: e.target.value }))}
              placeholder={isDisposal ? 'TẠO TỰ ĐỘNG (XH...)' : 'TẠO TỰ ĐỘNG (PXK...)'}
              className="h-10 w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-3 text-sm font-extrabold text-cyan-900 uppercase outline-none focus:border-cyan-600"
            />
          </div>

          {/* If Disposal: Chọn Lý do xuất hủy | If Sales: Chọn Khách hàng */}
          {isDisposal ? (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1">
                  <FileText className="h-4 w-4 text-cyan-600" />
                  <span>Lý do xuất hủy</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddReasonModal(true)}
                  className="text-[11px] font-extrabold text-cyan-700 hover:underline flex items-center gap-0.5 cursor-pointer bg-cyan-50 px-2 py-0.5 rounded-lg border border-cyan-300 hover:bg-cyan-100 transition"
                  title="Thêm lý do xuất hủy mới"
                >
                  <Plus size={13} />
                  <span>+ Thêm</span>
                </button>
              </div>
              <select
                value={disposalReasonSelect}
                onChange={(e) => {
                  const val = e.target.value;
                  setDisposalReasonSelect(val);
                  updateActiveTab((t) => ({ ...t, customer: val, description: val }));
                }}
                className="h-10 w-full rounded-xl border-2 border-cyan-500 bg-cyan-50/70 px-3 text-xs font-bold text-cyan-950 outline-none transition focus:border-cyan-600 cursor-pointer shadow-xs rounded-xl"
              >
                {disposalReasons.map((reason) => (
                  <option key={reason} value={reason} className="py-1.5 px-2 bg-white text-slate-800 font-semibold rounded-lg">
                    {reason}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="relative customer-dropdown-box">
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1">
                  <User className="h-4 w-4 text-cyan-600" />
                  <span>{partnerLabel || (isReturnSupplier ? 'Nhà cung cấp' : 'Khách hàng')}</span>
                </label>
                {!isReturnSupplier && (
                  <button
                    type="button"
                    onClick={() => setShowAddCustomerModal(true)}
                    className="text-[11px] font-extrabold text-cyan-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <UserPlus size={13} />
                    <span>+ Thêm KH</span>
                  </button>
                )}
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
                placeholder={isReturnSupplier ? "Tìm theo tên NCC, mã NCC, SĐT..." : "Tìm theo tên, mã KH, SĐT..."}
                className="h-10 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-cyan-600 cursor-text"
              />

              {showCustomerDropdown && (
                <div className="absolute left-0 top-full z-[100] mt-1 w-[400px] max-h-60 overflow-y-auto rounded-xl border border-slate-300 bg-white shadow-2xl flex flex-col">
                  <div className="flex bg-slate-100 border-b border-slate-300 px-3 py-2 text-xs font-black text-slate-700 sticky top-0 z-10">
                    <span className="w-1/3 uppercase">{isReturnSupplier ? 'Mã NCC' : 'Mã KH'}</span>
                    <span className="w-1/3 uppercase">{isReturnSupplier ? 'Tên NCC' : 'Tên khách hàng'}</span>
                    <span className="w-1/3 text-right uppercase">SĐT</span>
                  </div>
                  <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                    {filteredCustomers.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400">
                        {isReturnSupplier ? 'Không tìm thấy nhà cung cấp' : 'Không tìm thấy khách hàng'}
                      </div>
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
                          className="flex items-center px-3 py-2.5 hover:bg-cyan-50 cursor-pointer text-xs transition"
                        >
                          <span className="w-1/3 font-bold text-cyan-800">{c.customerCode || (isReturnSupplier ? 'NCC---' : 'KH---')}</span>
                          <span className="w-1/3 font-bold text-slate-800 truncate pr-1">{c.name}</span>
                          <span className="w-1/3 text-right text-slate-500 font-semibold">{c.phone || '-'}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Chọn Kho xuất hàng / Kho xuất hủy */}
          <div>
            <label className="mb-1.5 block text-xs font-black uppercase text-slate-700 flex items-center gap-1">
              <WarehouseIcon className="h-4 w-4 text-cyan-600" />
              <span>{isDisposal ? 'Kho xuất hủy' : 'Kho xuất hàng'}</span>
            </label>
            <select
              value={activeTab?.branchCode || (warehouses[0]?.code || 'KHO-TONG')}
              onChange={(e) => {
                const newWhCode = e.target.value;
                updateActiveTab((t) => ({
                  ...t,
                  branchCode: newWhCode,
                  details: t.details.map((d) => ({
                    ...d,
                    warehouseCode: d.warehouseCode || newWhCode,
                  })),
                }));
              }}
              className="h-10 w-full rounded-xl border-2 border-cyan-500 bg-cyan-50/70 px-3 text-sm font-bold text-cyan-900 outline-none transition focus:border-cyan-600 cursor-pointer shadow-xs rounded-xl"
            >
              {warehouses.length > 0 ? (
                warehouses.map((wh) => (
                  <option key={wh.id || wh.code} value={wh.code} className="py-1.5 px-2 bg-white text-slate-800 font-semibold rounded-lg">
                    [{wh.code}] {wh.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="KHO-TONG" className="py-1.5 px-2 bg-white text-slate-800 font-semibold">KHO-TONG - Kho tổng chính</option>
                  <option value="KH001" className="py-1.5 px-2 bg-white text-slate-800 font-semibold">KH001 - Kho Hàng Hóa HCM</option>
                  <option value="KH002" className="py-1.5 px-2 bg-white text-slate-800 font-semibold">KH002 - Kho Chi Nhánh Hà Nội</option>
                </>
              )}
            </select>
          </div>

          {/* Card 5: Người tạo phiếu */}
          <div>
            <label className="mb-1.5 block text-xs font-black uppercase text-slate-700 flex items-center gap-1">
              <User className="h-4 w-4 text-cyan-600" />
              <span>Người tạo phiếu</span>
            </label>
            <input
              type="text"
              value={activeTab?.employeeName || currentUserName || 'Dương Ngọc Anh'}
              onChange={(e) => updateActiveTab((t) => ({ ...t, employeeName: e.target.value }))}
              placeholder="Nhập tên người tạo phiếu..."
              className="h-10 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 cursor-text shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* ═══ 3. MAIN 2-COLUMN BOTTOM LAYOUT (Left Product Table, Right Sleek Panel) ═══ */}
      <div className={`flex flex-col lg:flex-row gap-3 items-stretch ${isFullScreen ? 'flex-1 min-h-0' : 'items-start'}`}>
        {/* ── LEFT COLUMN: PRODUCT TABLE ── */}
        <div className={`flex-1 min-w-0 flex flex-col ${isFullScreen ? 'h-full' : ''}`}>

          {/* ═══ PRODUCT SELECTION TABLE CARD ═══ */}
          <div className={`flex flex-col rounded-xl border-2 border-slate-200 bg-white shadow-sm overflow-hidden min-h-0 ${isFullScreen ? 'flex-1 h-full' : ''}`}>
            {/* Product Section Top Control Bar */}
            <div className="px-3 py-2 border-b-2 border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 flex-shrink-0">
              <div className="flex items-center gap-2 text-cyan-800 font-extrabold text-xs">
                <Package className="h-4 w-4 text-cyan-600" />
                <span>
                  {isDisposal
                    ? `THÔNG TIN HÀNG HÓA TIÊU HỦY (${activeValidItems.length} MẶT HÀNG - TỔNG SL HỦY: ${totalQty})`
                    : `THÔNG TIN HÀNG HÓA XUẤT KHO (${activeValidItems.length} MẶT HÀNG - TỔNG SL: ${totalQty})`}
                </span>
              </div>

              {/* Quick Product Search Bar */}
              <div className="relative flex-1 max-w-md mx-2 quick-search-box">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cyan-600" />
                  <input
                    type="text"
                    placeholder={isDisposal ? "Gõ mã hoặc tên hàng hóa cần hủy (Ví dụ: SP001)..." : "Gõ mã hoặc tên hàng hóa để tìm nhanh (Ví dụ: SP001, Omron)..."}
                    value={quickProductSearch}
                    onChange={(e) => {
                      setQuickProductSearch(e.target.value);
                      setShowQuickSearchDropdown(true);
                    }}
                    onFocus={() => setShowQuickSearchDropdown(true)}
                    className="w-full h-8 pl-8 pr-3 rounded-lg border border-cyan-400 bg-white text-xs font-bold text-slate-800 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200 shadow-2xs"
                  />
                </div>

                {showQuickSearchDropdown && quickProductSearch.trim() && (
                  <div className="absolute left-0 top-full z-[120] mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-slate-300 bg-white shadow-2xl divide-y divide-slate-100">
                    {filteredQuickProducts.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400">Không tìm thấy hàng hóa phù hợp</div>
                    ) : (
                      filteredQuickProducts.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => handleSelectQuickProduct(p)}
                          className="flex items-center justify-between px-3 py-2 hover:bg-cyan-50 cursor-pointer text-xs transition"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-cyan-800 bg-cyan-100 px-1.5 py-0.5 rounded text-[11px]">{p.internalSku}</span>
                            <span className="font-bold text-slate-800">{p.name}</span>
                            <span className="text-[11px] font-semibold text-slate-500">({p.unit || 'Cái'})</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${getProductWarehouseStock(p, activeTab?.branchCode) > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                              Tồn: {getProductWarehouseStock(p, activeTab?.branchCode)}
                            </span>
                            <span className="font-extrabold text-cyan-900">{getProductPriceForMode(p).toLocaleString('vi-VN')} đ</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
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
                    <th className="p-2 w-[24%] min-w-[180px] text-center border-r border-slate-200 bg-slate-100">TÊN HÀNG HÓA</th>
                    <th className="p-2 w-32 text-center border-r border-slate-200 bg-slate-100">
                      {isDisposal ? 'KỆ XUẤT HỦY' : 'KỆ LẤY HÀNG'}
                    </th>
                    <th className="p-2 w-14 text-center border-r border-slate-200 bg-slate-100">ĐVT</th>
                    <th className="p-2 w-28 text-center border-r border-slate-200 bg-slate-100">
                      {isDisposal ? 'SL HỦY' : 'SỐ LƯỢNG'}
                    </th>
                    <th className="p-2 w-32 text-center border-r border-slate-200 bg-slate-100">
                      {isDisposal ? 'GIÁ VỐN (đ)' : (isReturnSupplier ? 'GIÁ NHẬP (đ)' : 'ĐƠN GIÁ (đ)')}
                    </th>
                    {!isDisposal && (
                      <>
                        <th className="p-2 min-w-[130px] whitespace-nowrap text-center border-r border-slate-200 bg-slate-100">CHIẾT KHẤU (%)</th>
                        <th className="p-2 w-16 text-center border-r border-slate-200 bg-slate-100">VAT (%)</th>
                      </>
                    )}
                    <th className="p-2 w-32 text-center border-r border-slate-200 bg-slate-100">
                      {isDisposal ? 'GIÁ TRỊ HỦY' : 'THÀNH TIỀN'}
                    </th>
                    <th className="p-2 w-56 min-w-[200px] text-center border-r border-slate-200 bg-slate-100">
                      {isDisposal ? 'TÌNH TRẠNG / LÝ DO HỦY' : 'GHI CHÚ'}
                    </th>
                    {isDisposal && (
                      <th className="p-2 w-36 min-w-[120px] text-center border-r border-slate-200 bg-slate-100">BIÊN BẢN / GHI CHÚ</th>
                    )}
                    <th className="p-2.5 w-24 text-center bg-slate-100 min-w-[90px]">THAO TÁC</th>
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
                            value={row.productName ? `${row.productSku ? row.productSku + ' - ' : ''}${row.productName}` : ''}
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

                          {/* Interactive Table Dropdown for this row */}
                          {activeProductDropdownRowId === row.rowId && (
                            <div className="absolute left-0 top-full z-[100] mt-1 w-[480px] max-h-64 overflow-y-auto rounded-xl border border-slate-300 bg-white shadow-2xl flex flex-col">
                              <div className="flex bg-slate-100 border-b border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 sticky top-0 z-10">
                                <span className="w-1/4 uppercase">Mã hàng</span>
                                <span className="w-1/3 uppercase">Tên hàng hóa</span>
                                <span className="w-1/5 text-center uppercase">Tồn kho</span>
                                <span className="w-1/4 text-right uppercase">{isReturnSupplier ? 'Giá nhập / Giá' : 'Giá vốn / Giá'}</span>
                              </div>
                              <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                                {getFilteredProductsForRow(row.productName || row.productSku).length === 0 ? (
                                  <div className="p-3 text-center text-xs text-slate-400">Không tìm thấy hàng hóa</div>
                                ) : (
                                  getFilteredProductsForRow(row.productName || row.productSku).map((p) => {
                                    const rowWhCode = row.warehouseCode || activeTab?.branchCode || warehouses[0]?.code || 'KHO-TONG';
                                    const whStock = getProductWarehouseStock(p, rowWhCode);
                                    return (
                                      <div
                                        key={p.id}
                                        onClick={() => {
                                          updateRow(row.rowId, {
                                            productId: p.id,
                                            productSku: p.internalSku,
                                            productName: p.name,
                                            unit: p.unit || 'Cái',
                                            price: getProductPriceForMode(p),
                                            qty: row.qty === 0 ? 1 : row.qty,
                                            warehouseCode: rowWhCode,
                                          });
                                          setActiveProductDropdownRowId(null);
                                        }}
                                        className="flex items-center px-3 py-2 text-xs hover:bg-cyan-50 cursor-pointer text-slate-700 transition"
                                      >
                                        <span className="w-1/4 font-extrabold text-cyan-800">{p.internalSku}</span>
                                        <span className="w-1/3 font-bold text-slate-800 truncate pr-1">{p.name}</span>
                                        <span className={`w-1/5 text-center font-bold px-1.5 py-0.5 rounded text-[11px] ${whStock > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                                          Tồn: {whStock}
                                        </span>
                                        <span className="w-1/4 text-right font-extrabold text-slate-900">
                                          {getProductPriceForMode(p).toLocaleString('vi-VN')} đ
                                        </span>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* KỆ XUẤT HÀNG / KỆ XUẤT HỦY */}
                        <td className="p-1.5 border-r border-slate-200 text-center w-32">
                          {row.assignedBins && row.assignedBins.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => openPickBinModal(row.rowId)}
                              className="inline-flex items-center justify-center gap-1 bg-cyan-100 hover:bg-cyan-200 text-cyan-950 border border-cyan-300 font-extrabold px-2 py-1 rounded-lg text-xs shadow-2xs transition cursor-pointer w-full"
                              title="Bấm để mở sơ đồ chọn vị trí kệ lấy hàng"
                            >
                              <Layers className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
                              <span className="truncate max-w-[90px]">{row.assignedBins.join(', ')}</span>
                            </button>
                          ) : row.locationBin ? (
                            <button
                              type="button"
                              onClick={() => openPickBinModal(row.rowId)}
                              className="inline-flex items-center justify-center gap-1 bg-cyan-100 hover:bg-cyan-200 text-cyan-950 border border-cyan-300 font-extrabold px-2 py-1 rounded-lg text-xs shadow-2xs transition cursor-pointer w-full"
                              title="Bấm để mở sơ đồ chọn vị trí kệ lấy hàng"
                            >
                              <Layers className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
                              <span className="truncate max-w-[90px]">{row.locationBin}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openPickBinModal(row.rowId)}
                              className="inline-flex items-center justify-center gap-1 bg-white hover:bg-cyan-50 text-cyan-700 border border-cyan-400 font-bold px-2 py-1 rounded-lg text-xs transition cursor-pointer w-full"
                              title="Bấm mở sơ đồ chọn vị trí kệ lấy hàng"
                            >
                              <MapPin className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
                              <span>+ Kệ</span>
                            </button>
                          )}
                        </td>

                        {/* ĐVT */}
                        <td className="p-1 text-center border-r border-slate-200 w-14">
                          <input
                            type="text"
                            value={row.unit}
                            onChange={(e) => updateRow(row.rowId, { unit: e.target.value })}
                            className="w-full h-8 text-center rounded border border-slate-300 bg-white font-medium outline-none focus:border-cyan-500"
                          />
                        </td>

                        {/* SỐ LƯỢNG */}
                        <td className="p-1 border-r border-slate-200 w-28">
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
                            type="text"
                            value={row.price === 0 ? '' : formatNumberWithCommas(row.price)}
                            onChange={(e) => {
                              const parsed = parseFormattedNumber(e.target.value);
                              updateRow(row.rowId, { price: parsed });
                            }}
                            placeholder="0"
                            className="w-full h-8 px-2 text-right rounded border border-slate-300 bg-white font-bold text-slate-800 outline-none focus:border-cyan-500"
                          />
                        </td>

                        {!isDisposal && (
                          <>
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
                          </>
                        )}

                        {/* THÀNH TIỀN / GIÁ TRỊ HỦY */}
                        <td className="p-1.5 text-right font-extrabold text-cyan-900 border-r border-slate-200 bg-cyan-50/40">
                          {(isDisposal ? (row.qty * row.price) : row.totalAmount).toLocaleString('vi-VN')}
                        </td>

                        {/* GHI CHÚ / TÌNH TRẠNG LÝ DO HỦY */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="text"
                            value={row.note}
                            onChange={(e) => updateRow(row.rowId, { note: e.target.value })}
                            placeholder={isDisposal ? "Lý do: Hết hạn, vỡ móp, mốc ẩm..." : "Ghi chú..."}
                            className="w-full h-8 px-2 rounded border border-slate-300 bg-white font-normal text-slate-700 outline-none focus:border-cyan-500"
                          />
                        </td>

                        {isDisposal && (
                          <td className="p-1 border-r border-slate-200">
                            <input
                              type="text"
                              value={activeTab.description || ''}
                              onChange={(e) => updateActiveTab((t) => ({ ...t, description: e.target.value }))}
                              placeholder="Biên bản số..."
                              className="w-full h-8 px-2 rounded border border-slate-300 bg-white font-normal text-slate-700 outline-none focus:border-cyan-500 text-[11px]"
                            />
                          </td>
                        )}

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

        {/* ── RIGHT COLUMN: SUMMARY & FINANCIAL / DISPOSAL FORM ── */}
        {isDisposal ? (
          <div className={`w-full lg:w-[310px] xl:w-[320px] flex-shrink-0 rounded-xl border-2 border-slate-200 bg-white p-3 shadow-sm flex flex-col justify-between text-xs font-semibold text-slate-800 overflow-y-auto custom-scrollbar space-y-2.5 ${isFullScreen ? 'h-full' : 'h-fit sticky top-4'}`}>
            <div className="space-y-2">
              <div className="flex items-center gap-2 border-b-2 border-slate-100 pb-1.5 text-cyan-800 font-extrabold text-xs">
                <FileText className="h-4 w-4 text-cyan-600" />
                <span>TỔNG KẾT & BIÊN BẢN HỦY</span>
              </div>

              {/* Người lập phiếu / Giám sát */}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Người lập phiếu / Giám sát</label>
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

              {/* Phương án xử lý tiêu hủy */}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Phương án xử lý tiêu hủy</label>
                <select
                  value={disposalMethod}
                  onChange={(e) => setDisposalMethod(e.target.value)}
                  className="h-8 w-full px-2 rounded-lg border-2 border-slate-200 bg-white font-semibold text-slate-800 text-xs outline-none focus:border-cyan-600 cursor-pointer"
                >
                  <option value="Tiêu hủy hoàn toàn (đốt / rác thải / chôn lấp)">Tiêu hủy hoàn toàn (đốt / rác thải / chôn lấp)</option>
                  <option value="Bán phế liệu / Ve chai">Bán phế liệu / Ve chai</option>
                  <option value="Thanh lý phế phẩm giảm giá">Thanh lý phế phẩm giảm giá</option>
                  <option value="Chuyển kho cách ly xử lý sau">Chuyển kho cách ly xử lý sau</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>

              {/* Ghi chú biên bản / Căn cứ quyết định */}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Ghi chú biên bản / Căn cứ</label>
                <textarea
                  rows={2}
                  value={activeTab?.description || ''}
                  onChange={(e) => updateActiveTab((t) => ({ ...t, description: e.target.value }))}
                  placeholder="Biên bản kiểm kê số..., Quyết định tiêu hủy..."
                  className="w-full rounded-lg border-2 border-slate-200 p-2 text-xs font-medium text-slate-800 outline-none focus:border-cyan-600"
                />
              </div>

              {/* Summary Card */}
              <div className="rounded-xl border-2 border-cyan-200 bg-cyan-50/70 p-3 shadow-xs space-y-2 text-slate-800">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Số mặt hàng hủy:</span>
                  <span className="font-extrabold text-slate-900">{activeValidItems.length} mặt hàng</span>
                </div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Tổng số lượng hủy:</span>
                  <span className="font-extrabold text-cyan-800">{totalQty} SP</span>
                </div>
                <div className="border-t border-cyan-200/80 pt-2 flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-cyan-950">
                    TỔNG GIÁ TRỊ THIỆT HẠI:
                  </span>
                  <span className="text-sm font-black text-rose-600 tracking-tight">
                    {subtotal.toLocaleString('vi-VN')} đ
                  </span>
                </div>
              </div>
            </div>

            {/* Unified Action Buttons */}
            <div className="space-y-2.5 pt-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => handleSaveOutboundOrder(true)}
                className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wide text-white shadow-md hover:bg-emerald-700 transition active:scale-95 cursor-pointer"
              >
                <Printer size={18} strokeWidth={2.2} />
                <span>LƯU & IN BIÊN BẢN HỦY</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveOutboundOrder(false)}
                className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-[#008099] px-4 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wide text-white shadow-md hover:bg-cyan-800 transition active:scale-95 cursor-pointer"
              >
                <Save size={18} strokeWidth={2.2} />
                <span>LƯU PHIẾU XUẤT HỦY</span>
              </button>

              <button
                type="button"
                onClick={handleBackNavigation}
                className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wide text-slate-700 hover:bg-slate-100 transition active:scale-95 cursor-pointer"
              >
                <ArrowLeft size={18} strokeWidth={2.2} />
                <span>HỦY / QUAY LẠI</span>
              </button>
            </div>
          </div>
        ) : (
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
                  <span className="font-extrabold text-slate-900">{baseSubtotal.toLocaleString('vi-VN')} đ</span>
                </div>

                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Chiết khấu:</span>
                  <span className="font-extrabold text-rose-600 text-xs">
                    - {totalDiscount.toLocaleString('vi-VN')} đ
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Thuế VAT:</span>
                  <span className="font-extrabold text-emerald-600 text-xs">
                    + {totalVat.toLocaleString('vi-VN')} đ
                  </span>
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
            <div className="space-y-2.5 pt-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => handleSaveOutboundOrder(true)}
                className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wide text-white shadow-md hover:bg-emerald-700 transition active:scale-95 cursor-pointer"
              >
                <Printer size={18} strokeWidth={2.2} />
                <span>{isReturnSupplier ? 'LƯU & IN PHIẾU XUẤT TRẢ' : 'LƯU & IN PHIẾU XUẤT'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveOutboundOrder(false)}
                className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-[#008099] px-4 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wide text-white shadow-md hover:bg-cyan-800 transition active:scale-95 cursor-pointer"
              >
                <Save size={18} strokeWidth={2.2} />
                <span>{isReturnSupplier ? 'LƯU PHIẾU XUẤT TRẢ NCC' : 'LƯU PHIẾU XUẤT HÀNG'}</span>
              </button>

              <button
                type="button"
                onClick={handleBackNavigation}
                className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wide text-slate-700 hover:bg-slate-100 transition active:scale-95 cursor-pointer"
              >
                <ArrowLeft size={18} strokeWidth={2.2} />
                <span>HỦY / QUAY LẠI</span>
              </button>
            </div>
          </div>
        )}
      </div>
      {/* ═══ SMART SLOTTING VISUAL MAP MODAL ═══ */}
      <SmartSlottingGridModal
        isOpen={pickBinModalOpen}
        onClose={() => setPickBinModalOpen(false)}
        mode="OUTBOUND_TRANSFER"
        warehouseCode={activeTab?.branchCode || 'KHO-TONG'}
        items={activeTab?.details || []}
        targetRowId={activePickBinRowId}
        products={products}
        onConfirmAll={(updatedRows) => {
          updateActiveTab((t) => ({
            ...t,
            details: updatedRows,
          }));
          setToast({ message: 'Đã cập nhật vị trí kệ xuất hàng!', type: 'success' });
        }}
      />

      {/* ═══ MODAL THÊM LÝ DO XUẤT HỦY MỚI ═══ */}
      {showAddReasonModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border-2 border-cyan-500 bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-black text-cyan-900 uppercase flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-cyan-600" />
                Thêm lý do xuất hủy mới
              </h3>
              <button
                type="button"
                onClick={() => setShowAddReasonModal(false)}
                className="rounded-lg p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nội dung lý do xuất hủy:
              </label>
              <input
                type="text"
                value={newReasonInput}
                onChange={(e) => setNewReasonInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newReasonInput.trim()) {
                    const added = newReasonInput.trim();
                    if (!disposalReasons.includes(added)) {
                      setDisposalReasons((prev) => [...prev, added]);
                    }
                    setDisposalReasonSelect(added);
                    updateActiveTab((t) => ({ ...t, customer: added, description: added }));
                    setNewReasonInput('');
                    setShowAddReasonModal(false);
                    setToast({ message: `Đã thêm lý do: "${added}"`, type: 'success' });
                  }
                }}
                placeholder="Ví dụ: Hàng cấn móp nhẹ, thanh lý nội bộ..."
                className="w-full h-10 rounded-xl border-2 border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-cyan-600"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddReasonModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  if (newReasonInput.trim()) {
                    const added = newReasonInput.trim();
                    if (!disposalReasons.includes(added)) {
                      setDisposalReasons((prev) => [...prev, added]);
                    }
                    setDisposalReasonSelect(added);
                    updateActiveTab((t) => ({ ...t, customer: added, description: added }));
                    setNewReasonInput('');
                    setShowAddReasonModal(false);
                    setToast({ message: `Đã thêm lý do: "${added}"`, type: 'success' });
                  }
                }}
                className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-cyan-700 cursor-pointer shadow-sm"
              >
                Lưu lý do
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (standalone) {
    return <MainLayout>{contentMarkup}</MainLayout>;
  }

  return contentMarkup;
}
