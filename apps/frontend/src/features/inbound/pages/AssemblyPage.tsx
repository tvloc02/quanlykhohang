import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  RefreshCw,
  Search,
  ShieldAlert,
  XCircle,
  Package,
  PlusCircle,
  ShoppingCart,
  X
} from 'lucide-react';
import { getStoredWarehouses, type WarehouseRecord } from '../../../shared/utils/warehouseAssignments';

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value || 0);
}

function parseNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
}

type StockBalance = {
  id: string;
  locationCode: string;
  totalPhysical: number;
  allocated: number;
  available: number;
};

type Category = {
  id: string;
  name: string;
};

type ProductWithBalances = {
  id: string;
  internalSku: string;
  name: string;
  unit?: string;
  price: number;
  category?: Category | null;
  supplier?: { id: string; name: string } | null;
  stockBalances: StockBalance[];
  totalStock: number;
};

type Toast = {
  type: 'success' | 'error';
  message: string;
};

export default function AssemblyPage({ mode: initialMode = 'production' }: { mode?: 'production' | 'distribution' }) {
  const [products, setProducts] = React.useState<ProductWithBalances[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [warehouses, setWarehouses] = React.useState<WarehouseRecord[]>(() => getStoredWarehouses());
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<Toast | null>(null);
  
  const [search, setSearch] = React.useState('');
  const [selectedProductIds, setSelectedProductIds] = React.useState<Set<string>>(new Set());

  // Pagination
  const [pageSize, setPageSize] = React.useState(10);
  const [currentPage, setCurrentPage] = React.useState(1);

  // Modals
  const [productionModalOpen, setProductionModalOpen] = React.useState(false);
  const [distributionModalOpen, setDistributionModalOpen] = React.useState(false);

  // Forms
  const [prodForm, setProdForm] = React.useState({
    assembledProductId: '',
    assembledQty: '',
    warehouseCode: '',
    note: '',
    components: {} as Record<string, { usedQty: string; balanceId: string; locationCode: string }>,
  });

  const [distForm, setDistForm] = React.useState({
    productId: '',
    categoryId: '',
    price: '',
    balanceId: '',
    qtyToSell: '',
  });

  const mode = initialMode;

  React.useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/products/with-balances`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/categories`, { headers: authHeaders() }),
      ]);

      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(data);
      }
      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        setCategories(data);
      }
    } catch (error) {
      setToast({ type: 'error', message: 'Lỗi tải dữ liệu' });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredProducts = React.useMemo(() => {
    const keyword = search.trim().toLowerCase();
    let result = products;
    
    // Chỉ lấy những sản phẩm có tồn kho và CÓ nhà cung cấp (hàng nhập từ NCC)
    result = result.filter(p => p.totalStock > 0 && p.supplier != null);

    if (keyword) {
      result = result.filter(p => 
        p.internalSku.toLowerCase().includes(keyword) || 
        p.name.toLowerCase().includes(keyword)
      );
    }
    return result;
  }, [products, search]);

  const totalItems = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  const toggleSelection = (productId: string) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedProductIds.size === paginatedProducts.length && paginatedProducts.length > 0) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(paginatedProducts.map(p => p.id)));
    }
  };

  const openProductionModal = () => {
    if (selectedProductIds.size === 0) {
      setToast({ type: 'error', message: 'Vui lòng chọn ít nhất 1 sản phẩm làm nguyên liệu' });
      return;
    }
    const components: Record<string, { usedQty: string; balanceId: string; locationCode: string }> = {};
    selectedProductIds.forEach(id => {
      const p = products.find(x => x.id === id);
      if (p && p.stockBalances.length > 0) {
        components[id] = { usedQty: '1', balanceId: p.stockBalances[0].id, locationCode: p.stockBalances[0].locationCode };
      }
    });
    setProdForm({
      assembledProductId: '',
      assembledQty: '1',
      warehouseCode: warehouses[0]?.code || '',
      note: '',
      components,
    });
    setProductionModalOpen(true);
  };

  const openDistributionModal = (product: ProductWithBalances) => {
    setDistForm({
      productId: product.id,
      categoryId: product.category?.id || categories[0]?.id || '',
      price: product.price ? String(product.price) : '0',
      balanceId: product.stockBalances[0]?.id || '',
      qtyToSell: '1',
    });
    setDistributionModalOpen(true);
  };

  const submitProduction = async () => {
    if (!prodForm.assembledProductId) {
      setToast({ type: 'error', message: 'Vui lòng chọn sản phẩm thành phẩm' });
      return;
    }
    const qty = parseNumber(prodForm.assembledQty);
    if (qty <= 0) {
      setToast({ type: 'error', message: 'Số lượng thành phẩm phải lớn hơn 0' });
      return;
    }
    const componentsList = Object.entries(prodForm.components).map(([productId, data]) => ({
      productId,
      warehouseCode: data.locationCode,
      usedQty: parseNumber(data.usedQty),
    })).filter(c => c.usedQty > 0);

    if (componentsList.length === 0) {
      setToast({ type: 'error', message: 'Cần ít nhất 1 nguyên liệu có số lượng > 0' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/inbound/stock-in-orders/assemblies/standalone`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          assembledProductId: prodForm.assembledProductId,
          assembledQty: qty,
          warehouseCode: prodForm.warehouseCode,
          note: prodForm.note,
          components: componentsList,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Lỗi tạo lệnh sản xuất');
      setToast({ type: 'success', message: 'Đã tạo lệnh sản xuất thành công!' });
      setProductionModalOpen(false);
      setSelectedProductIds(new Set());
      await loadData();
    } catch (e: any) {
      setToast({ type: 'error', message: e.message });
    } finally {
      setSaving(false);
    }
  };

  const submitDistribution = async () => {
    const qty = parseNumber(distForm.qtyToSell);
    if (qty <= 0) {
      setToast({ type: 'error', message: 'Số lượng bán phải lớn hơn 0' });
      return;
    }
    if (!distForm.balanceId) {
      setToast({ type: 'error', message: 'Vui lòng chọn kho xuất' });
      return;
    }

    setSaving(true);
    try {
      // 1. Update product price and category
      const resProd = await fetch(`${API_BASE_URL}/products/${distForm.productId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          categoryId: distForm.categoryId || undefined,
          price: parseNumber(distForm.price),
        }),
      });
      if (!resProd.ok) throw new Error('Lỗi cập nhật giá sản phẩm');

      // 2. Adjust stock (deduct)
      const resAdjust = await fetch(`${API_BASE_URL}/inventory/balances/${distForm.balanceId}/adjust`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          quantity: -qty,
          reason: 'Bán trực tiếp (Phân phối)',
        }),
      });
      if (!resAdjust.ok) throw new Error((await resAdjust.json()).message || 'Lỗi trừ tồn kho');

      setToast({ type: 'success', message: 'Đã phân phối bán hàng thành công!' });
      setDistributionModalOpen(false);
      await loadData();
    } catch (e: any) {
      setToast({ type: 'error', message: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed right-4 top-4 z-[70] flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-xl ${toast.type === 'error' ? 'border-red-200 text-red-600' : 'border-emerald-200 text-emerald-600'}`}>
          <p className="text-sm font-bold">{toast.message}</p>
          <button type="button" onClick={() => setToast(null)} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            {mode === 'production' ? 'Sản xuất thành phẩm' : 'Phân phối bán hàng'}
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {mode === 'production' ? 'Chọn các nguyên liệu từ kho để lắp ráp thành sản phẩm mới.' : 'Xuất bán trực tiếp các sản phẩm có sẵn trong kho.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 shadow-sm"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          {mode === 'production' && (
            <button
              type="button"
              onClick={openProductionModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700"
            >
              <PlusCircle className="h-4 w-4" />
              Tạo lệnh sản xuất
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white pl-11 pr-4 text-sm font-medium outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
            placeholder="Tìm theo mã SKU, tên sản phẩm..."
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1024px] border-collapse bg-white">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="w-12 border-x border-slate-200 px-3 py-4 text-center align-middle">
                  <input 
                    type="checkbox" 
                    checked={selectedProductIds.size === paginatedProducts.length && paginatedProducts.length > 0}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600" 
                  />
                </th>
                <th className="w-16 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">STT</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Tên sản phẩm</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Kho hàng</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Số lượng tổng</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Đơn giá</th>
                <th className="sticky right-0 w-32 border-l border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm font-black uppercase text-slate-700 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm font-medium text-slate-500">Đang tải danh sách tồn kho...</td>
                </tr>
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm font-medium text-slate-500">Chưa có sản phẩm nào trong kho.</td>
                </tr>
              ) : (
                paginatedProducts.map((product, index) => {
                  const isChecked = selectedProductIds.has(product.id);
                  const locations = [...new Set(product.stockBalances.map(b => b.locationCode))].join(', ');
                  return (
                    <tr key={product.id} className="group border-b border-slate-200 transition hover:bg-cyan-50/50">
                      <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => toggleSelection(product.id)}
                          className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600" 
                        />
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{startIndex + index}</td>
                      <td className="border-x border-slate-200 px-3 py-4">
                        <div className="font-bold text-slate-900">{product.internalSku}</div>
                        <div className="text-sm text-slate-600">{product.name}</div>
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{locations || '-'}</td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black text-cyan-700">{formatNumber(product.totalStock)}</td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{formatMoney(product.price)}</td>
                      <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-4 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                        {mode === 'distribution' && (
                          <button
                            type="button"
                            onClick={() => openDistributionModal(product)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-600 hover:bg-amber-100 hover:text-amber-700"
                          >
                            <ShoppingCart className="h-4 w-4" />
                            Bán
                          </button>
                        )}
                        {mode === 'production' && (
                          <span className="text-xs text-slate-400">Chọn checkbox</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 bg-slate-50/50 px-6 py-3 sm:flex-row">
          <div className="text-sm text-slate-600">
            Tổng số: <b>{totalItems}</b>
            {totalItems > 0 && <span className="ml-2">Hiển thị {startIndex} - {endIndex}</span>}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-600">Số dòng/trang</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-cyan-500"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </div>
        </div>
      </div>

      {/* PRODUCTION MODAL */}
      {productionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div>
                <h3 className="text-xl font-black text-slate-900">Tạo lệnh sản xuất</h3>
                <p className="text-sm text-slate-500">Thiết lập sản phẩm thành phẩm và nguyên vật liệu tiêu hao</p>
              </div>
              <button onClick={() => setProductionModalOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Sản phẩm thành phẩm <span className="text-red-500">*</span></label>
                  <select
                    value={prodForm.assembledProductId}
                    onChange={e => setProdForm(c => ({...c, assembledProductId: e.target.value}))}
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500"
                  >
                    <option value="">-- Chọn sản phẩm tạo thành --</option>
                    {products.filter(p => p.supplier == null).map(p => <option key={p.id} value={p.id}>{p.internalSku} - {p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Số lượng tạo <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="1"
                    value={prodForm.assembledQty}
                    onChange={e => setProdForm(c => ({...c, assembledQty: e.target.value}))}
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Kho nhập thành phẩm <span className="text-red-500">*</span></label>
                  <select
                    value={prodForm.warehouseCode}
                    onChange={e => setProdForm(c => ({...c, warehouseCode: e.target.value}))}
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500"
                  >
                    <option value="">-- Chọn kho --</option>
                    {warehouses.map(w => <option key={w.code} value={w.code}>{w.code} - {w.name}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="mb-2 block text-sm font-bold text-slate-700">Ghi chú</label>
                  <input
                    value={prodForm.note}
                    onChange={e => setProdForm(c => ({...c, note: e.target.value}))}
                    placeholder="VD: Chế biến mẻ số 1..."
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500"
                  />
                </div>
              </div>

              <h4 className="font-bold text-slate-900 mb-3">Nguyên liệu tiêu hao (đã chọn)</h4>
              <div className="overflow-hidden rounded-xl border-2 border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border-b p-3 font-semibold">Sản phẩm</th>
                      <th className="border-b p-3 font-semibold">Kho xuất</th>
                      <th className="border-b p-3 font-semibold">Tồn kho</th>
                      <th className="border-b p-3 font-semibold w-32">SL Sử dụng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(selectedProductIds).map(id => {
                      const p = products.find(x => x.id === id);
                      if (!p) return null;
                      const data = prodForm.components[id];
                      return (
                        <tr key={id} className="border-b last:border-0">
                          <td className="p-3 font-medium text-slate-800">{p.internalSku} - {p.name}</td>
                          <td className="p-3">
                            <select 
                              value={data?.balanceId || ''}
                              onChange={e => {
                                const bal = p.stockBalances.find(b => b.id === e.target.value);
                                setProdForm(c => ({
                                  ...c, 
                                  components: { ...c.components, [id]: { ...c.components[id], balanceId: bal?.id || '', locationCode: bal?.locationCode || '' } }
                                }));
                              }}
                              className="h-9 w-full rounded-lg border border-slate-200 px-2 outline-none"
                            >
                              {p.stockBalances.map(b => <option key={b.id} value={b.id}>{b.locationCode}</option>)}
                            </select>
                          </td>
                          <td className="p-3 font-black text-cyan-700">
                            {formatNumber(p.stockBalances.find(b => b.id === data?.balanceId)?.available || 0)}
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              min="0"
                              value={data?.usedQty || ''}
                              onChange={e => setProdForm(c => ({
                                ...c, 
                                components: { ...c.components, [id]: { ...c.components[id], usedQty: e.target.value } }
                              }))}
                              className="h-9 w-full rounded-lg border-2 border-slate-200 px-2 font-bold outline-none text-center"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 p-6">
              <button onClick={() => setProductionModalOpen(false)} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200">
                Hủy
              </button>
              <button disabled={saving} onClick={submitProduction} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-60">
                <CheckCircle2 className="h-4 w-4" /> {saving ? 'Đang xử lý...' : 'Xác nhận tạo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DISTRIBUTION MODAL */}
      {distributionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div>
                <h3 className="text-xl font-black text-slate-900">Phân phối bán hàng</h3>
                <p className="text-sm text-slate-500">Xuất bán trực tiếp sản phẩm</p>
              </div>
              <button onClick={() => setDistributionModalOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Sản phẩm</label>
                <div className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-600">
                  {products.find(p => p.id === distForm.productId)?.name}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Danh mục</label>
                  <select
                    value={distForm.categoryId}
                    onChange={e => setDistForm(c => ({...c, categoryId: e.target.value}))}
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500"
                  >
                    <option value="">-- Trống --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Giá bán <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={distForm.price}
                    onChange={e => setDistForm(c => ({...c, price: e.target.value}))}
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Kho xuất <span className="text-red-500">*</span></label>
                <select
                  value={distForm.balanceId}
                  onChange={e => setDistForm(c => ({...c, balanceId: e.target.value}))}
                  className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500"
                >
                  {products.find(p => p.id === distForm.productId)?.stockBalances.map(b => (
                    <option key={b.id} value={b.id}>{b.locationCode} (Tồn: {b.available})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Số lượng bán <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="1"
                  value={distForm.qtyToSell}
                  onChange={e => setDistForm(c => ({...c, qtyToSell: e.target.value}))}
                  className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-black text-cyan-700 outline-none transition focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 p-6">
              <button onClick={() => setDistributionModalOpen(false)} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200">
                Hủy
              </button>
              <button disabled={saving} onClick={submitDistribution} className="flex items-center gap-2 rounded-xl bg-amber-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-amber-700 disabled:opacity-60">
                <ShoppingCart className="h-4 w-4" /> {saving ? 'Đang xử lý...' : 'Xác nhận bán'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
