import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  RefreshCw,
  Search,
  ShoppingCart,
  X,
  PlusCircle
} from 'lucide-react';

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

type Product = {
  id: string;
  internalSku: string;
  name: string;
  price?: number;
  category?: { id: string; name: string } | null;
  supplier?: { id: string; name: string } | null;
};

type OrderDetailRow = {
  orderId: string;
  orderCode: string;
  poNumber: string;
  detailId: string;
  productId: string;
  productSku: string;
  productName: string;
  warehouseCode: string;
  actualQty: number;
  remainingQty: number;
};

type Toast = {
  type: 'success' | 'error';
  message: string;
};

export default function AssemblyPage({ mode: initialMode = 'production' }: { mode?: 'production' | 'distribution' }) {
  const [rows, setRows] = React.useState<OrderDetailRow[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [categories, setCategories] = React.useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<Toast | null>(null);
  
  const [search, setSearch] = React.useState('');
  const [selectedDetailIds, setSelectedDetailIds] = React.useState<Set<string>>(new Set());

  const [pageSize, setPageSize] = React.useState(10);
  const [currentPage, setCurrentPage] = React.useState(1);

  const [productionModalOpen, setProductionModalOpen] = React.useState(false);
  const [distributionModalOpen, setDistributionModalOpen] = React.useState(false);

  const [prodForm, setProdForm] = React.useState({
    assembledProductId: '',
    assembledQty: '1',
    warehouseCode: 'DEFAULT',
    note: '',
    components: {} as Record<string, { usedQty: string }>,
  });

  const [distForm, setDistForm] = React.useState({
    orderId: '',
    detailId: '',
    productId: '',
    categoryId: '',
    price: '',
    qtyToSell: '1',
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
      const [ordersRes, productsRes, categoriesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/inbound/stock-in-orders`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/products/with-balances`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/categories`, { headers: authHeaders() }),
      ]);

      if (productsRes.ok) setProducts(await productsRes.json());
      if (categoriesRes.ok) setCategories(await categoriesRes.json());

      if (ordersRes.ok) {
        const orders = await ordersRes.json();
        const newRows: OrderDetailRow[] = [];
        
        for (const order of orders) {
          if (order.status === 'COMPLETED') {
            for (const detail of order.details) {
              const remainingQty = detail.actualQty - (detail.distributedQty || 0) - (detail.producedQty || 0);
              if (remainingQty > 0) {
                newRows.push({
                  orderId: order.id,
                  orderCode: order.orderCode,
                  poNumber: order.sourcePurchaseOrderNo || '-',
                  detailId: detail.id,
                  productId: detail.product?.id || '',
                  productSku: detail.product?.internalSku || '',
                  productName: detail.product?.name || '',
                  warehouseCode: detail.warehouseCode || 'DEFAULT',
                  actualQty: detail.actualQty,
                  remainingQty,
                });
              }
            }
          }
        }
        setRows(newRows);
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

  const filteredRows = React.useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;
    
    return rows.filter(r => 
      r.orderCode.toLowerCase().includes(keyword) ||
      r.poNumber.toLowerCase().includes(keyword) ||
      r.productSku.toLowerCase().includes(keyword) || 
      r.productName.toLowerCase().includes(keyword)
    );
  }, [rows, search]);

  const totalItems = filteredRows.length;
  const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  const toggleSelection = (detailId: string) => {
    setSelectedDetailIds(prev => {
      const next = new Set(prev);
      if (next.has(detailId)) next.delete(detailId);
      else next.add(detailId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedDetailIds.size === paginatedRows.length && paginatedRows.length > 0) {
      setSelectedDetailIds(new Set());
    } else {
      setSelectedDetailIds(new Set(paginatedRows.map(r => r.detailId)));
    }
  };

  const openProductionModal = () => {
    if (selectedDetailIds.size === 0) {
      setToast({ type: 'error', message: 'Vui lòng chọn ít nhất 1 sản phẩm làm nguyên liệu' });
      return;
    }
    const components: Record<string, { usedQty: string }> = {};
    selectedDetailIds.forEach(id => {
      components[id] = { usedQty: '1' };
    });
    setProdForm({
      assembledProductId: '',
      assembledQty: '1',
      warehouseCode: 'DEFAULT',
      note: '',
      components,
    });
    setProductionModalOpen(true);
  };

  const openDistributionModal = (row: OrderDetailRow) => {
    const p = products.find(x => x.id === row.productId);
    setDistForm({
      orderId: row.orderId,
      detailId: row.detailId,
      productId: row.productId,
      categoryId: p?.category?.id || categories[0]?.id || '',
      price: p?.price ? String(p.price) : '0',
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

    const componentsList = Object.entries(prodForm.components).map(([detailId, data]) => {
      const row = rows.find(r => r.detailId === detailId);
      return {
        productId: row?.productId || '',
        warehouseCode: row?.warehouseCode || 'DEFAULT',
        usedQty: parseNumber(data.usedQty),
        sourceOrderDetailId: detailId,
      };
    }).filter(c => c.usedQty > 0);

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
      setSelectedDetailIds(new Set());
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

    setSaving(true);
    try {
      // 1. Cập nhật danh mục & giá
      const resProd = await fetch(`${API_BASE_URL}/products/${distForm.productId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          categoryId: distForm.categoryId || undefined,
          price: parseNumber(distForm.price),
        }),
      });
      if (!resProd.ok) throw new Error('Lỗi cập nhật sản phẩm');

      // 2. Xuất bán (trừ vào lệnh nhập kho)
      const resAdjust = await fetch(`${API_BASE_URL}/inbound/stock-in-orders/${distForm.orderId}/details/${distForm.detailId}/distribute`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          qty,
        }),
      });
      if (!resAdjust.ok) throw new Error((await resAdjust.json()).message || 'Lỗi phân phối hàng');

      setToast({ type: 'success', message: 'Đã phân phối bán hàng thành công!' });
      setDistributionModalOpen(false);
      await loadData();
    } catch (e: any) {
      setToast({ type: 'error', message: e.message });
    } finally {
      setSaving(false);
    }
  };

  // Only show non-supplier products in the target dropdown
  const targetProducts = products.filter(p => !p.supplier);

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
            {mode === 'production' 
              ? 'Chọn các mặt hàng từ Lệnh nhập kho đã hoàn thành để sản xuất.' 
              : 'Xuất bán trực tiếp các sản phẩm từ Lệnh nhập kho đã hoàn thành.'}
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
            placeholder="Tìm theo mã lệnh, mã PO, SKU, tên sản phẩm..."
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse bg-white">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="w-12 border-x border-slate-200 px-3 py-4 text-center align-middle">
                  <input 
                    type="checkbox" 
                    checked={selectedDetailIds.size === paginatedRows.length && paginatedRows.length > 0}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600" 
                  />
                </th>
                <th className="w-16 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">STT</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Mã Đơn / Lệnh</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Tên sản phẩm</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Kho hàng</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">SL Đã nhập</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Còn lại (Chưa dùng)</th>
                <th className="sticky right-0 w-32 border-l border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm font-black uppercase text-slate-700 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm font-medium text-slate-500">Đang tải danh sách hàng hóa...</td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm font-medium text-slate-500">Không tìm thấy sản phẩm hợp lệ từ các Lệnh nhập kho đã hoàn thành.</td>
                </tr>
              ) : (
                paginatedRows.map((row, index) => {
                  const isChecked = selectedDetailIds.has(row.detailId);
                  return (
                    <tr key={row.detailId} className="group border-b border-slate-200 transition hover:bg-cyan-50/50">
                      <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => toggleSelection(row.detailId)}
                          className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600" 
                        />
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{startIndex + index}</td>
                      <td className="border-x border-slate-200 px-3 py-4">
                        <div className="font-bold text-slate-900">{row.poNumber}</div>
                        <div className="text-xs text-slate-500">{row.orderCode}</div>
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4">
                        <div className="font-bold text-slate-900">{row.productSku}</div>
                        <div className="text-sm text-slate-600">{row.productName}</div>
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{row.warehouseCode}</td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black text-slate-400">{formatNumber(row.actualQty)}</td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black text-cyan-700">{formatNumber(row.remainingQty)}</td>
                      <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-4 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                        {mode === 'distribution' && (
                          <button
                            type="button"
                            onClick={() => openDistributionModal(row)}
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
                <p className="text-sm text-slate-500">Sử dụng hàng hóa từ Lệnh nhập kho để tạo thành phẩm</p>
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
                    {targetProducts.map(p => <option key={p.id} value={p.id}>{p.internalSku} - {p.name}</option>)}
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
                  <label className="mb-2 block text-sm font-bold text-slate-700">Ghi chú</label>
                  <input
                    value={prodForm.note}
                    onChange={e => setProdForm(c => ({...c, note: e.target.value}))}
                    placeholder="VD: Chế biến mẻ số 1..."
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500"
                  />
                </div>
              </div>

              <h4 className="font-bold text-slate-900 mb-3">Nguyên liệu tiêu hao (từ Đơn mua hàng)</h4>
              <div className="overflow-hidden rounded-xl border-2 border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border-b p-3 font-semibold">Đơn hàng</th>
                      <th className="border-b p-3 font-semibold">Sản phẩm</th>
                      <th className="border-b p-3 font-semibold text-center">Còn lại</th>
                      <th className="border-b p-3 font-semibold w-32">SL Sử dụng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(selectedDetailIds).map(id => {
                      const row = rows.find(x => x.detailId === id);
                      if (!row) return null;
                      const data = prodForm.components[id];
                      return (
                        <tr key={id} className="border-b last:border-0">
                          <td className="p-3 font-medium text-slate-800">{row.poNumber}</td>
                          <td className="p-3 text-slate-700">{row.productName}</td>
                          <td className="p-3 font-black text-center text-cyan-700">{formatNumber(row.remainingQty)}</td>
                          <td className="p-3">
                            <input
                              type="number"
                              min="0"
                              max={row.remainingQty}
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
                <p className="text-sm text-slate-500">Xuất bán trực tiếp sản phẩm từ Đơn hàng</p>
              </div>
              <button onClick={() => setDistributionModalOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Sản phẩm xuất bán</label>
                <div className="flex justify-between items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <span className="font-bold text-slate-700">{rows.find(r => r.detailId === distForm.detailId)?.productName}</span>
                  <span className="rounded bg-slate-200 px-2 py-1 text-xs font-bold text-slate-600">{rows.find(r => r.detailId === distForm.detailId)?.poNumber}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Danh mục mới</label>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Còn lại khả dụng</label>
                  <div className="h-11 flex items-center justify-center rounded-xl border-2 border-transparent bg-slate-100 text-lg font-black text-slate-600">
                    {formatNumber(rows.find(r => r.detailId === distForm.detailId)?.remainingQty || 0)}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Số lượng bán <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="1"
                    max={rows.find(r => r.detailId === distForm.detailId)?.remainingQty || 0}
                    value={distForm.qtyToSell}
                    onChange={e => setDistForm(c => ({...c, qtyToSell: e.target.value}))}
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-center text-lg font-black text-cyan-700 outline-none transition focus:border-cyan-500"
                  />
                </div>
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
