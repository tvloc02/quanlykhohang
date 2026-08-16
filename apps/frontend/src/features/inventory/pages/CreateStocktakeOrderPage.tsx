import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Plus,
  Trash2,
  Save,
  Printer,
  X,
  XCircle,
  CheckCircle2,
  Warehouse as WarehouseIcon,
  User,
  Package,
  ScanLine,
  RefreshCw,
  ClipboardList,
  FileText,
  Check,
} from 'lucide-react';
import MainLayout from '../../../shared/components/MainLayout';
import BarcodeScanner from '../../../shared/components/BarcodeScanner';

// ─── TYPES & INTERFACES ────────────────────────────────────────

const API_BASE = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

export interface ProductOption {
  id: string;
  internalSku: string;
  supplierBarcode?: string;
  name: string;
  unit?: string;
  price?: number;
  importPrice?: number;
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

export interface StocktakeRicItem {
  product: ProductOption & { systemQty: number };
  countedQty: number;
  note: string;
}

// ─── HELPER TO CALCULATE REAL-TIME WAREHOUSE STOCK ─────────────

export function getProductWarehouseStock(p: any, locationCode: string): number {
  if (!p) return 0;
  const balances = p.stockBalances || [];

  if (Array.isArray(balances) && balances.length > 0) {
    // 1. Precise match by locationCode (e.g., KH006, KH001, KH002, KH007)
    let match = balances.find((b: any) => b.locationCode === locationCode);

    // 2. Fallback to KHO-NVL for KH006 / Kho Thanh Trì
    if (!match && (locationCode === 'KH006' || locationCode === 'Kho Thanh Trì')) {
      match = balances.find((b: any) => b.locationCode === 'KHO-NVL');
    }

    if (match) {
      const val =
        match.totalPhysical !== undefined && match.totalPhysical !== null
          ? match.totalPhysical
          : match.available;
      return Number(val || 0);
    }
  }

  // 3. Fallback to totalStock or totalPhysical
  const fallback = p.totalStock ?? p.totalPhysical ?? p.stockQty ?? 0;
  return Number(fallback || 0);
}

interface CreateStocktakeOrderPageProps {
  onBack?: () => void;
  standalone?: boolean;
}

export default function CreateStocktakeOrderPage({
  onBack,
  standalone = false,
}: CreateStocktakeOrderPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const userIdentifier = currentUser.fullName || currentUser.email || '';
  const userRole = currentUser.role || '';
  const isStaff = userRole === 'staff';
  const isManager = userRole === 'manager' || userRole === 'admin';

  // Form State
  const [locationCode, setLocationCode] = useState('');
  const [plannedDate, setPlannedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [assignee, setAssignee] = useState(isStaff ? userIdentifier : '');
  const [note, setNote] = useState('');
  const [branch, setBranch] = useState('');
  const [purpose, setPurpose] = useState('');

  // Items State
  const [items, setItems] = useState<StocktakeRicItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Master Data
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // Toast Notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showSuccess = (msg: string) => setToast({ message: msg, type: 'success' });
  const showError = (msg: string) => setToast({ message: msg, type: 'error' });

  // Load Master Data
  const loadMasterData = useCallback(async () => {
    try {
      // 1. Warehouses
      const whRes = await fetch(`${API_BASE}/warehouses`, { headers: authHeaders() }).catch(() => null);
      if (whRes && whRes.ok) {
        const whData = await whRes.json();
        const list = Array.isArray(whData) ? whData : whData?.data || [];
        setWarehouses(list);
        if (list.length > 0 && !locationCode) {
          const defaultWh = list.find((w: any) => w.code === 'KH006') || list[0];
          setLocationCode(defaultWh.code);
        }
      }

      // 2. Users
      const uRes = await fetch(`${API_BASE}/users`, { headers: authHeaders() }).catch(() => null);
      if (uRes && uRes.ok) {
        const uData = await uRes.json();
        setUsers(Array.isArray(uData) ? uData : uData?.data || []);
      }

      // 3. Products with balances
      const pRes = await fetch(`${API_BASE}/products/with-balances`, { headers: authHeaders() }).catch(() => null);
      if (pRes && pRes.ok) {
        const pData = await pRes.json();
        setProducts(Array.isArray(pData) ? pData : pData?.data || []);
      } else {
        const fallbackRes = await fetch(`${API_BASE}/products`, { headers: authHeaders() }).catch(() => null);
        if (fallbackRes && fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          setProducts(Array.isArray(fallbackData) ? fallbackData : fallbackData?.data || []);
        }
      }
    } catch (err) {
      console.error('Error loading master data:', err);
    }
  }, [locationCode]);

  useEffect(() => {
    loadMasterData();
  }, []);

  // Update existing items systemQty whenever locationCode changes
  useEffect(() => {
    if (!locationCode || products.length === 0) return;
    setItems((prevItems) => {
      if (prevItems.length === 0) return prevItems;
      return prevItems.map((item) => {
        const p = products.find(
          (prod) => prod.id === item.product.id || prod.internalSku === item.product.internalSku
        );
        const newSystemQty = p ? getProductWarehouseStock(p, locationCode) : (item.product.systemQty ?? 0);
        const oldSystemQty = item.product.systemQty ?? 0;

        const isCountedDefault = item.countedQty === oldSystemQty;
        const newCountedQty = isCountedDefault ? newSystemQty : item.countedQty;

        return {
          ...item,
          product: {
            ...item.product,
            systemQty: newSystemQty,
          },
          countedQty: newCountedQty,
        };
      });
    });
  }, [locationCode, products]);

  // Click outside listener to close search dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('.product-search-box')) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Add Product from Dropdown
  const handleAddProduct = (p: any) => {
    if (items.some((item) => item.product.id === p.id)) {
      setProductSearch('');
      setShowDropdown(false);
      return;
    }
    const systemQty = getProductWarehouseStock(p, locationCode);
    setItems((prev) => [
      ...prev,
      {
        product: {
          id: p.id,
          internalSku: p.internalSku,
          supplierBarcode: p.supplierBarcode,
          name: p.name,
          unit: p.unit || 'Cái',
          price: p.price ?? p.importPrice ?? 0,
          systemQty,
        },
        countedQty: systemQty,
        note: '',
      },
    ]);
    setProductSearch('');
    setShowDropdown(false);
  };

  const handleUpdateCounted = (index: number, val: number) => {
    setItems((prev) => {
      const next = [...prev];
      next[index].countedQty = val;
      return next;
    });
  };

  const handleUpdateNote = (index: number, val: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[index].note = val;
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/inventory/stocktake');
    }
  };

  // Submit Stocktake Order
  const executeSubmit = async (finalStatus: string = 'DRAFT', isPrint: boolean = false) => {
    if (!locationCode) {
      showError('Vui lòng chọn Kho kiểm kê');
      return;
    }
    if (items.length === 0 && finalStatus !== 'DRAFT') {
      showError('Vui lòng chọn ít nhất 1 sản phẩm để kiểm kê');
      return;
    }
    setSubmitting(true);
    try {
      const itemsPayload = items.map((item) => ({
        productId: String(item.product.id || item.product.internalSku),
        countedQty: Number(item.countedQty) >= 0 ? Number(item.countedQty) : 0,
        note: item.note || undefined,
      }));
      const productIds = items.map((item) => String(item.product.id || item.product.internalSku));

      const isRequest = searchParams.get('mode') === 'request' || !isManager;

      const res = await fetch(`${API_BASE}/inventory/stocktakes`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          locationCode,
          plannedDate: plannedDate ? new Date(plannedDate).toISOString() : undefined,
          assignee: assignee || userIdentifier,
          note: note.trim() || undefined,
          isRequest: isRequest || undefined,
          createdBy: userIdentifier,
          branch,
          purpose,
          status: finalStatus,
          items: itemsPayload.length > 0 ? itemsPayload : undefined,
          productIds: productIds.length > 0 ? productIds : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Không thể tạo phiếu kiểm kê');
      }
      const created = await res.json();

      if (
        finalStatus === 'COUNTING_DONE' &&
        items.length > 0 &&
        created.status !== 'COUNTING_DONE' &&
        created.status !== 'REQUESTED'
      ) {
        await fetch(`${API_BASE}/inventory/stocktakes/${created.id}/finish-counting`, {
          method: 'POST',
          headers: authHeaders(),
        }).catch(() => null);
      }

      showSuccess(`Đã lưu thành công phiếu kiểm kê ${created.stocktakeNo || ''}!`);

      if (isPrint) {
        window.print();
      }

      setTimeout(() => {
        handleClose();
      }, 1000);
    } catch (err: any) {
      showError(err.message || 'Lỗi khi lưu phiếu kiểm kê');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter products for quick search dropdown
  const existingIds = useMemo(() => new Set(items.map((item) => item.product.id)), [items]);
  const filteredProducts = useMemo(() => {
    const kw = productSearch.trim().toLowerCase();
    if (!kw) return products;
    return products.filter((p) => {
      const matchCode =
        p.internalSku?.toLowerCase().includes(kw) || p.supplierBarcode?.toLowerCase().includes(kw);
      const matchName = p.name?.toLowerCase().includes(kw);
      return !existingIds.has(p.id) && (matchCode || matchName);
    });
  }, [products, productSearch, existingIds]);

  // Statistics
  const totalSystemQty = items.reduce((sum, i) => sum + (i.product.systemQty || 0), 0);
  const totalCountedQty = items.reduce((sum, i) => sum + Number(i.countedQty || 0), 0);
  const totalDifference = totalCountedQty - totalSystemQty;

  const contentMarkup = (
    <div className="space-y-4 pb-24 animate-[fadeIn_0.2s_ease-out]">
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
      {scannerOpen && (
        <BarcodeScanner
          isOpen={scannerOpen}
          onProductFound={(scanned, qty) => {
            const matchProduct =
              products.find(
                (p) =>
                  p.id === scanned.id ||
                  p.internalSku === scanned.internalSku ||
                  p.supplierBarcode === scanned.internalSku
              ) || scanned;
            const existIdx = items.findIndex((item) => item.product.id === matchProduct.id);
            if (existIdx >= 0) {
              handleUpdateCounted(existIdx, items[existIdx].countedQty + qty);
            } else {
              const systemQty = getProductWarehouseStock(matchProduct, locationCode);
              setItems((prev) => [
                ...prev,
                {
                  product: {
                    id: matchProduct.id,
                    internalSku: matchProduct.internalSku,
                    supplierBarcode: matchProduct.supplierBarcode,
                    name: matchProduct.name,
                    unit: matchProduct.unit || 'Cái',
                    systemQty,
                  },
                  countedQty: systemQty,
                  note: 'Quét từ Barcode Scanner',
                },
              ]);
            }
            setScannerOpen(false);
            showSuccess(`Đã quét mã: ${matchProduct.name}`);
          }}
          onClose={() => setScannerOpen(false)}
          title="Quét Mã Barcode Hàng Hóa Kiểm Kê"
        />
      )}

      {/* ═══ 1. TOP HEADER BAR: Page Title & Back Button ═══ */}
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2.5 rounded-xl bg-cyan-600 px-4 py-2 text-white shadow-sm">
          <ClipboardList className="h-5 w-5" />
          <h1 className="text-base font-black tracking-tight uppercase">TẠO PHIẾU KIỂM KÊ HÀNG HÓA</h1>
        </div>

        <button
          type="button"
          onClick={handleClose}
          className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-cyan-50 hover:border-cyan-600 hover:text-cyan-700 transition shadow-2xs cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Quay lại</span>
        </button>
      </div>

      {/* ═══ 2. FORM METADATA CONTROL BAR ═══ */}
      <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Ngày kiểm kê */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Ngày kiểm kê</label>
            <input
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              className="h-9 w-full rounded-lg border-2 border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-cyan-600 cursor-pointer shadow-2xs"
            />
          </div>

          {/* Mã phiếu kiểm */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Mã phiếu kiểm kê</label>
            <input
              type="text"
              readOnly
              placeholder="MÃ TỰ ĐỘNG (KK...)"
              className="h-9 w-full rounded-lg border-2 border-slate-200 bg-slate-50 px-3 text-xs font-bold text-cyan-800 uppercase outline-none focus:border-cyan-600"
            />
          </div>

          {/* Chọn Kho kiểm kê */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
              <WarehouseIcon className="h-3.5 w-3.5 text-cyan-600" />
              <span>Kho kiểm kê (*)</span>
            </label>
            <select
              value={locationCode}
              onChange={(e) => setLocationCode(e.target.value)}
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
                  <option value="KH006">KH006 - Kho Thanh Trì</option>
                  <option value="KH001">KH001 - Kho Hà Đông</option>
                  <option value="KH002">KH002 - Kho Chi Nhánh HCM</option>
                </>
              )}
            </select>
          </div>

          {/* Nhân viên kiểm kê */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-cyan-600" />
              <span>Nhân viên kiểm kê</span>
            </label>
            {isStaff ? (
              <input
                type="text"
                value={assignee}
                readOnly
                className="h-9 w-full rounded-lg border-2 border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 outline-none"
              />
            ) : (
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="h-9 w-full rounded-lg border-2 border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-cyan-600 cursor-pointer shadow-2xs"
              >
                <option value="">— Chọn nhân viên —</option>
                {users
                  .filter((u) => Array.isArray(u.roles) && u.roles.some((r: any) => ['staff', 'manager', 'admin'].includes(r.name?.toLowerCase())))
                  .map((u) => (
                    <option key={u.id} value={u.fullName || u.email}>
                      {u.fullName || u.email}
                    </option>
                  ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* ═══ 3. DUAL PANE MAIN SECTION ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ── LEFT COLUMN (9/12 width): PRODUCT SELECTION & ITEMS TABLE ── */}
        <div className="lg:col-span-9 flex flex-col rounded-xl border-2 border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Section Control Header Bar */}
          <div className="px-3 py-2 border-b-2 border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2 text-cyan-800 font-extrabold text-xs">
              <Package className="h-4 w-4 text-cyan-600" />
              <span>
                DANH SÁCH HÀNG HÓA KIỂM KÊ ({items.length} MẶT HÀNG)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg border-2 border-cyan-600 bg-white px-3 py-1 text-xs font-bold text-cyan-700 hover:bg-cyan-50 transition cursor-pointer"
              >
                <ScanLine className="h-3.5 w-3.5 text-cyan-600" />
                <span>Quét Barcode</span>
              </button>

              <button
                type="button"
                onClick={loadMasterData}
                className="inline-flex items-center gap-1 rounded-lg border-2 border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                title="Làm mới dữ liệu"
              >
                <RefreshCw className="h-3.5 w-3.5 text-cyan-600" />
                <span>Làm mới</span>
              </button>
            </div>
          </div>

          {/* Quick Search Input with Dropdown */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 product-search-box">
            <div className="relative">
              <input
                type="text"
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setShowDropdown(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredProducts.length > 0) {
                    e.preventDefault();
                    handleAddProduct(filteredProducts[0]);
                  }
                }}
                onFocus={() => setShowDropdown(true)}
                onClick={() => setShowDropdown(true)}
                placeholder="Gõ mã hoặc tên hàng hóa để tìm kiếm (Bấm Enter để chọn)..."
                className="h-10 w-full rounded-lg border-2 border-cyan-500/60 bg-white px-3.5 pl-10 text-xs font-bold text-slate-800 outline-none shadow-2xs focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-600" />

              {/* DROPDOWN SEARCH RESULTS TABLE */}
              {showDropdown && (
                <div
                  className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-72 overflow-hidden rounded-xl border-2 border-cyan-500/50 bg-white shadow-2xl flex flex-col animate-in fade-in duration-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex bg-slate-100 border-b border-slate-200 px-3.5 py-2 text-[11px] font-extrabold text-slate-700 uppercase">
                    <span className="w-1/2">MÃ / TÊN HÀNG HÓA</span>
                    <span className="w-1/4 text-center">GIÁ BÁN</span>
                    <span className="w-1/4 text-center text-cyan-700">TỒN KHO ({locationCode})</span>
                  </div>

                  <div className="overflow-y-auto flex-1 max-h-60 divide-y divide-slate-100 custom-scrollbar">
                    {filteredProducts.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400 font-medium">
                        {productSearch.trim()
                          ? 'Không tìm thấy hàng hóa phù hợp'
                          : 'Gõ từ khóa để tìm kiếm hàng hóa trong hệ thống'}
                      </div>
                    ) : (
                      filteredProducts.map((p) => {
                        const systemQty = getProductWarehouseStock(p, locationCode);
                        const price = p.price ?? p.importPrice ?? 0;
                        return (
                          <div
                            key={p.id}
                            onClick={() => handleAddProduct(p)}
                            className="flex items-center px-3.5 py-2.5 hover:bg-cyan-50/80 cursor-pointer text-xs text-slate-700 transition"
                          >
                            <div className="w-1/2 pr-2">
                              <p className="font-extrabold text-cyan-800">{p.internalSku}</p>
                              <p className="text-xs text-slate-800 font-bold truncate">{p.name}</p>
                            </div>
                            <span className="w-1/4 text-center text-slate-600 font-semibold font-mono">
                              {price > 0 ? price.toLocaleString('vi-VN') + ' đ' : '0.00'}
                            </span>
                            <span className="w-1/4 text-center text-cyan-700 font-black text-sm font-mono">
                              {systemQty.toLocaleString('vi-VN')}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200 px-3.5 py-2 bg-slate-50 text-xs text-slate-500 font-bold">
                    <span>Tìm thấy {filteredProducts.length} sản phẩm</span>
                    <button
                      type="button"
                      onClick={() => setShowDropdown(false)}
                      className="text-red-500 hover:text-red-700 font-extrabold cursor-pointer"
                    >
                      ✕ Đóng
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Product Items Table */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 text-slate-800 font-extrabold border-b-2 border-slate-200 uppercase text-xs">
                <tr>
                  <th className="p-2.5 w-12 text-center border-r border-slate-200 bg-slate-100">STT</th>
                  <th className="p-2.5 w-36 text-center border-r border-slate-200 bg-slate-100">MÃ HÀNG</th>
                  <th className="p-2.5 min-w-[200px] border-r border-slate-200 bg-slate-100">TÊN HÀNG HÓA</th>
                  <th className="p-2.5 w-28 text-center border-r border-slate-200 bg-cyan-50/80 text-cyan-900">SỐ TỒN KHO</th>
                  <th className="p-2.5 w-32 text-center border-r border-slate-200 bg-emerald-50/80 text-emerald-900">THỰC TỒN</th>
                  <th className="p-2.5 w-28 text-center border-r border-slate-200 bg-amber-50/80 text-amber-900">LỆCH</th>
                  <th className="p-2.5 min-w-[140px] border-r border-slate-200 bg-slate-100">GHI CHÚ</th>
                  <th className="p-2.5 w-16 text-center bg-slate-100">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-20 text-center text-xs text-slate-400 font-semibold italic">
                      Chưa có hàng hóa nào được chọn để kiểm kê.
                      <br />
                      Vui lòng nhập từ khóa vào ô tìm kiếm ở trên để chọn sản phẩm.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => {
                    const isEven = idx % 2 === 1;
                    const systemVal = item.product.systemQty || 0;
                    const diff = item.countedQty - systemVal;

                    return (
                      <tr
                        key={item.product.id + '-' + idx}
                        className={`${isEven ? 'bg-slate-50/70' : 'bg-white'} hover:bg-cyan-50/50 transition-colors`}
                      >
                        {/* STT */}
                        <td className="p-2 text-center font-bold text-slate-500 border-r border-slate-200">
                          {idx + 1}.
                        </td>

                        {/* MÃ HÀNG */}
                        <td className="p-2 text-center font-extrabold text-cyan-700 border-r border-slate-200">
                          {item.product.internalSku}
                        </td>

                        {/* TÊN HÀNG HÓA */}
                        <td className="p-2 font-bold text-slate-800 border-r border-slate-200">
                          {item.product.name}
                        </td>

                        {/* SỐ TỒN KHO */}
                        <td className="p-2 text-center font-black text-slate-900 border-r border-slate-200 bg-cyan-50/40 font-mono text-sm">
                          {systemVal.toLocaleString('vi-VN')}
                        </td>

                        {/* THỰC TỒN (Editable Input) */}
                        <td className="p-1.5 text-center border-r border-slate-200 bg-emerald-50/40">
                          <input
                            type="number"
                            min="0"
                            value={item.countedQty}
                            onChange={(e) => handleUpdateCounted(idx, Number(e.target.value))}
                            className="h-8 w-24 text-center rounded-lg border-2 border-emerald-500/80 bg-white font-black text-emerald-900 outline-none text-xs focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs"
                          />
                        </td>

                        {/* LỆCH */}
                        <td className="p-2 text-center border-r border-slate-200 bg-amber-50/40 font-mono text-sm font-black">
                          <span
                            className={
                              diff > 0
                                ? 'text-emerald-600'
                                : diff < 0
                                ? 'text-red-600'
                                : 'text-slate-500'
                            }
                          >
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        </td>

                        {/* GHI CHÚ */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="text"
                            value={item.note || ''}
                            onChange={(e) => handleUpdateNote(idx, e.target.value)}
                            placeholder="Ghi chú dòng..."
                            className="w-full h-8 px-2 bg-transparent font-medium text-slate-700 outline-none focus:bg-cyan-100/50 text-xs"
                          />
                        </td>

                        {/* THAO TÁC */}
                        <td className="p-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition cursor-pointer font-bold"
                            title="Xóa sản phẩm"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── RIGHT COLUMN (3/12 width): SUMMARY & ACTIONS ── */}
        <div className="lg:col-span-3 flex flex-col space-y-4">
          <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase text-cyan-900 tracking-wider border-b-2 border-slate-100 pb-2">
              TỔNG QUAN PHIẾU KIỂM KÊ
            </h3>

            {/* Ghi chú chung */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Ghi chú chung</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nhập ghi chú chung cho phiếu kiểm..."
                rows={4}
                className="w-full rounded-lg border-2 border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-800 outline-none focus:border-cyan-600 resize-none shadow-2xs"
              />
            </div>

            {/* ══ Light Theme Summary Card matching Outbound Page ══ */}
            <div className="rounded-xl border-2 border-cyan-200 bg-cyan-50/60 p-4 shadow-sm space-y-2.5 text-slate-800">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Tổng số mặt hàng:</span>
                <span className="font-extrabold text-slate-900 font-mono">{items.length}</span>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Tổng tồn hệ thống:</span>
                <span className="font-extrabold text-cyan-900 font-mono">
                  {totalSystemQty.toLocaleString('vi-VN')}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Tổng thực đếm:</span>
                <span className="font-extrabold text-emerald-700 font-mono">
                  {totalCountedQty.toLocaleString('vi-VN')}
                </span>
              </div>

              <div className="border-t border-slate-300/80 pt-2 flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wide text-cyan-900">
                  TỔNG CHÊNH LỆCH:
                </span>
                <span
                  className={`text-base font-black font-mono tracking-tight ${
                    totalDifference > 0
                      ? 'text-emerald-600'
                      : totalDifference < 0
                      ? 'text-red-600'
                      : 'text-cyan-800'
                  }`}
                >
                  {totalDifference > 0 ? `+${totalDifference}` : totalDifference}
                </span>
              </div>
            </div>

            {/* Action Buttons Matching Outbound Page */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => executeSubmit(isManager ? 'COUNTING' : 'COUNTING_DONE', true)}
                disabled={submitting || items.length === 0}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 transition active:scale-95 cursor-pointer"
              >
                <Printer size={16} />
                <span>Lưu & In phiếu kiểm</span>
              </button>

              <button
                type="button"
                onClick={() => executeSubmit(isManager ? 'COUNTING' : 'COUNTING_DONE', false)}
                disabled={submitting || items.length === 0}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-cyan-800 disabled:opacity-50 transition active:scale-95 cursor-pointer"
              >
                <Save size={16} />
                <span>Lưu phiếu kiểm kho</span>
              </button>

              <button
                type="button"
                onClick={() => executeSubmit('DRAFT', false)}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-amber-600 disabled:opacity-50 transition active:scale-95 cursor-pointer"
              >
                <FileText size={16} />
                <span>Lưu tạm (Draft)</span>
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-100 transition active:scale-95 cursor-pointer"
              >
                <ArrowLeft size={16} />
                <span>Hủy / Quay lại</span>
              </button>
            </div>
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
