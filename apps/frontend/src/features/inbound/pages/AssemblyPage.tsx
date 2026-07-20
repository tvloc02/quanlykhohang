import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  RefreshCw,
  Search,
  ShoppingCart,
  X,
  PlusCircle,
  Settings2,
  Clock3,
  Download,
  Eye,
  Package
} from 'lucide-react';
import {
  getActiveItemGroupCategories,
  getStoredCatalogCategories,
} from '../../../shared/utils/catalogCategories';
import { getStoredWarehouses } from '../../../shared/utils/warehouseAssignments';


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

type OrderDetailRaw = {
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
  lastImportDate: string;
};

type OrderDetailRow = {
  productId: string;
  productSku: string;
  productName: string;
  poNumber: string;
  orderCode: string;
  lastImportDate: string;
  warehouseCode: string;
  actualQty: number;
  remainingQty: number;
  details: OrderDetailRaw[];
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

  const [catalogCategories, setCatalogCategories] = React.useState(() => getStoredCatalogCategories());
  const [warehouses, setWarehouses] = React.useState(() => getStoredWarehouses());

  React.useEffect(() => {
    const syncMasterData = () => {
      setCatalogCategories(getStoredCatalogCategories());
      setWarehouses(getStoredWarehouses());
    };
    window.addEventListener('storage', syncMasterData);
    return () => window.removeEventListener('storage', syncMasterData);
  }, []);

  const categoryOptions = getActiveItemGroupCategories(catalogCategories);
  const unitOptions = catalogCategories.filter((category: any) => category.type === 'unit' && category.status === 'active');
  const managementTypeOptions = catalogCategories.filter(
    (category: any) => category.type === 'management-attribute' && category.status === 'active',
  );
  const locationOptions = catalogCategories.filter(
    (category: any) => category.type === 'storage-position' && category.status === 'active',
  );

  const [distForm, setDistForm] = React.useState({
    orderId: '',
    detailId: '',
    productId: '',
    categoryId: '',
    price: '',
    qtyToSell: '1',
    mode: 'existing' as 'existing' | 'new',
    targetProductId: '',
    // Full product fields
    newProductSku: '',
    newProductName: '',
    newProductCategory: '',
    newProductUnit: '',
    newProductDefaultWarehouse: '',
    newProductLocation: '',
    newProductManagementType: '',
    newProductSupplier: '',
    newProductImages: [] as string[],
  });

  const [historyModalOpen, setHistoryModalOpen] = React.useState(false);
  const [selectedRowHistory, setSelectedRowHistory] = React.useState<OrderDetailRow | null>(null);

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
        const grouped = new Map<string, OrderDetailRow>();
        
        for (const order of orders) {
          if (order.status === 'COMPLETED') {
            for (const detail of order.details) {
              const remainingQty = detail.actualQty - (detail.distributedQty || 0) - (detail.producedQty || 0);
              if (remainingQty > 0) {
                const dateStr = order.completedAt || order.updatedAt || order.createdAt || '';
                const raw: OrderDetailRaw = {
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
                  lastImportDate: dateStr,
                };
                
                const existing = grouped.get(raw.productId);
                if (!existing) {
                  grouped.set(raw.productId, {
                    productId: raw.productId,
                    productSku: raw.productSku,
                    productName: raw.productName,
                    poNumber: raw.poNumber,
                    orderCode: raw.orderCode,
                    lastImportDate: raw.lastImportDate,
                    warehouseCode: raw.warehouseCode,
                    actualQty: raw.actualQty,
                    remainingQty: raw.remainingQty,
                    details: [raw]
                  });
                } else {
                  existing.actualQty += raw.actualQty;
                  existing.remainingQty += raw.remainingQty;
                  existing.details.push(raw);
                  // Update latest info if the new row is newer
                  if (!existing.lastImportDate || (raw.lastImportDate && new Date(raw.lastImportDate) > new Date(existing.lastImportDate))) {
                    existing.lastImportDate = raw.lastImportDate;
                    existing.poNumber = raw.poNumber;
                    existing.orderCode = raw.orderCode;
                    existing.warehouseCode = raw.warehouseCode;
                  }
                }
              }
            }
          }
        }
        
        // Sort details in each group by date (oldest first for FIFO)
        for (const group of grouped.values()) {
          group.details.sort((a, b) => new Date(a.lastImportDate || 0).getTime() - new Date(b.lastImportDate || 0).getTime());
        }

        setRows(Array.from(grouped.values()));
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
      setSelectedDetailIds(new Set(paginatedRows.map(r => r.productId)));
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
      orderId: '',
      detailId: '',
      productId: row.productId,
      categoryId: '',
      price: '0',
      qtyToSell: String(row.remainingQty),
      mode: 'existing',
      targetProductId: '',
      newProductSku: '',
      newProductName: '',
      newProductCategory: categoryOptions[0]?.name || '',
      newProductUnit: unitOptions[0]?.name || '',
      newProductDefaultWarehouse: warehouses[0]?.name || '',
      newProductLocation: locationOptions[0]?.name || '',
      newProductManagementType: managementTypeOptions[0]?.name || '',
      newProductSupplier: '',
      newProductImages: [],
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
      const row = rows.find(r => r.productId === detailId);
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
      let finalTargetId = distForm.targetProductId;

      if (distForm.mode === 'new') {
        if (!distForm.newProductSku || !distForm.newProductName) {
          throw new Error('Vui lòng nhập mã và tên sản phẩm mới');
        }
        // Create new product
        const createRes = await fetch(`${API_BASE_URL}/products`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            sku: distForm.newProductSku.trim().toUpperCase(),
            internalSku: distForm.newProductSku.trim().toUpperCase(),
            name: distForm.newProductName.trim(),
            category: distForm.newProductCategory.trim(),
            unit: distForm.newProductUnit.trim(),
            defaultWarehouse: distForm.newProductDefaultWarehouse.trim(),
            location: distForm.newProductLocation.trim(),
            managementType: distForm.newProductManagementType.trim(),
            supplier: distForm.newProductSupplier.trim(),
            price: parseNumber(distForm.price),
            stock: 0,
            images: distForm.newProductImages,
          }),
        });
        if (!createRes.ok) throw new Error((await createRes.json()).message || 'Lỗi tạo sản phẩm mới');
        const newProduct = await createRes.json();
        finalTargetId = newProduct.id;
      }

      if (!finalTargetId) throw new Error('Vui lòng chọn hoặc tạo sản phẩm');

      // Use assembly standalone to map stock
      const row = rows.find(r => r.productId === distForm.productId);
      if (!row) throw new Error('Không tìm thấy sản phẩm nguồn');

      const componentsList = [];
      let qtyLeft = qty;
      for (const detail of row.details) {
        if (qtyLeft <= 0) break;
        if (detail.remainingQty <= 0) continue;
        
        const used = Math.min(qtyLeft, detail.remainingQty);
        componentsList.push({
          productId: detail.productId,
          warehouseCode: detail.warehouseCode,
          usedQty: used,
          sourceOrderDetailId: detail.detailId,
        });
        qtyLeft -= used;
      }

      const res = await fetch(`${API_BASE_URL}/inbound/stock-in-orders/assemblies/standalone`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          assembledProductId: finalTargetId,
          assembledQty: qty,
          warehouseCode: row.warehouseCode || 'DEFAULT',
          note: 'Phân phối bán hàng từ Lệnh nhập kho',
          components: componentsList,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Lỗi phân phối hàng');

      setToast({ type: 'success', message: 'Đã xuất bán thành công!' });
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
          {mode === 'production' && (
            <p className="mt-1 text-sm font-medium text-slate-500">
              Chọn các mặt hàng từ Lệnh nhập kho đã hoàn thành để sản xuất.
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 shadow-sm"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          {mode === 'distribution' && (
            <button
              type="button"
              onClick={() => alert('Chức năng Export đang phát triển')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-900"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          )}
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
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Mã Đơn / Lệnh</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Tên sản phẩm</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Ngày nhập hàng gần nhất</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Kho hàng</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">SL Đã nhập</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Còn lại</th>
                <th className="sticky right-0 w-36 border-l border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm font-black uppercase text-slate-700 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
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
                  const isChecked = selectedDetailIds.has(row.productId);
                  return (
                    <tr key={row.productId} className="group border-b border-slate-200 transition hover:bg-cyan-50/50">
                      <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => toggleSelection(row.productId)}
                          className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600" 
                        />
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{startIndex + index}</td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                        <div className="text-sm font-semibold text-slate-700">{row.poNumber}</div>
                        <div className="text-sm font-semibold text-slate-700">{row.orderCode}</div>
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                        <div className="text-sm font-semibold text-slate-700">{row.productSku}</div>
                        <div className="text-sm font-semibold text-slate-700">{row.productName}</div>
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center align-middle text-sm font-semibold text-slate-700">
                        {row.lastImportDate ? new Date(row.lastImportDate).toLocaleDateString('vi-VN') : '-'}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{row.warehouseCode}</td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black text-slate-400">{formatNumber(row.actualQty)}</td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black text-cyan-700">{formatNumber(row.remainingQty)}</td>
                      <td className="sticky right-0 border-l border-slate-200 bg-white px-2 py-3 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                        {mode === 'distribution' && (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => { setSelectedRowHistory(row); setHistoryModalOpen(true); }}
                              className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-cyan-200 bg-cyan-50 text-cyan-600 transition hover:bg-cyan-100 hover:text-cyan-700 hover:border-cyan-300"
                              title="Xem chi tiết"
                            >
                              <Eye className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openDistributionModal(row)}
                              className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-cyan-200 bg-cyan-50 text-cyan-600 transition hover:bg-cyan-100 hover:text-cyan-700 hover:border-cyan-300"
                              title="Xuất bán"
                            >
                              <ShoppingCart className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => { setSelectedRowHistory(row); setHistoryModalOpen(true); }}
                              className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-cyan-200 bg-cyan-50 text-cyan-600 transition hover:bg-cyan-100 hover:text-cyan-700 hover:border-cyan-300"
                              title="Cấu hình"
                            >
                              <Settings2 className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => { setSelectedRowHistory(row); setHistoryModalOpen(true); }}
                              className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-cyan-200 bg-cyan-50 text-cyan-600 transition hover:bg-cyan-100 hover:text-cyan-700 hover:border-cyan-300"
                              title="Lịch sử"
                            >
                              <Clock3 className="h-5 w-5" />
                            </button>
                          </div>
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
                      const row = rows.find(x => x.productId === id);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 backdrop-blur-sm">
          <div className="flex w-full max-w-[95vw] flex-col" style={{ height: '92vh', borderRadius: '1rem', background: '#fff', boxShadow: '0 25px 60px rgba(0,0,0,0.18)' }}>
            <div className="flex shrink-0 items-center justify-between border-b-2 border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600">
                  <Package className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">{distForm.mode === 'new' ? 'Thêm sản phẩm' : 'Phân phối bán hàng'}</h2>
                  <p className="text-sm font-medium text-slate-500">{distForm.mode === 'new' ? 'Khai báo thông tin sản phẩm và phân bổ theo kho' : 'Chuyển nguồn hàng vào danh mục Sản phẩm Bán'}</p>
                </div>
              </div>
              <button type="button" onClick={() => setDistributionModalOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4 shrink-0 border-b border-slate-100 bg-slate-50/50 flex justify-center">
              <div className="flex gap-2 p-1 bg-slate-200/70 rounded-xl w-full max-w-md">
                <button
                  type="button"
                  onClick={() => setDistForm(d => ({ ...d, mode: 'existing' }))}
                  className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${distForm.mode === 'existing' ? 'bg-white shadow text-cyan-700' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Chọn sản phẩm có sẵn
                </button>
                <button
                  type="button"
                  onClick={() => setDistForm(d => ({ ...d, mode: 'new' }))}
                  className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${distForm.mode === 'new' ? 'bg-white shadow text-cyan-700' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Tạo sản phẩm mới
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 divide-x divide-slate-100 overflow-hidden">
              {distForm.mode === 'new' && (
                <>
                  {/* CỘT 1: Ảnh sản phẩm */}
                  <div className="w-44 shrink-0 flex flex-col gap-2 overflow-y-auto p-4 bg-slate-50/60">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-1">Ảnh sản phẩm</p>
                    <div className="relative">
                      {distForm.newProductImages[0] ? (
                        <div className="group relative">
                          <img src={distForm.newProductImages[0]} alt="Ảnh chính" className="w-full aspect-square object-cover rounded-xl border-2 border-cyan-400" />
                          <span className="absolute top-1 left-1 rounded-md bg-cyan-500 px-1.5 py-0.5 text-[10px] font-bold text-white">Chính</span>
                          <button type="button" onClick={() => setDistForm((c) => ({ ...c, newProductImages: c.newProductImages.filter((_, i) => i !== 0) }))} className="absolute top-1 right-1 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs">×</button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full aspect-square rounded-xl border-2 border-dashed border-slate-300 bg-white cursor-pointer hover:border-cyan-400 transition">
                          <span className="text-2xl text-slate-300">+</span>
                          <span className="text-[10px] text-slate-400 mt-1">Ảnh chính</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const url = URL.createObjectURL(f); setDistForm((c) => { const imgs = [...c.newProductImages]; imgs[0] = url; return { ...c, newProductImages: imgs }; }); }} />
                        </label>
                      )}
                    </div>
                    {[1, 2, 3].map((idx) => (
                      <div key={idx} className="relative">
                        {distForm.newProductImages[idx] ? (
                          <div className="group relative">
                            <img src={distForm.newProductImages[idx]} alt={`Ảnh ${idx + 1}`} className="w-full aspect-square object-cover rounded-xl border border-slate-200" />
                            <button type="button" onClick={() => setDistForm((c) => ({ ...c, newProductImages: c.newProductImages.filter((_, i) => i !== idx) }))} className="absolute top-1 right-1 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs">×</button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center w-full aspect-square rounded-xl border border-dashed border-slate-200 bg-white cursor-pointer hover:border-cyan-400 transition">
                            <span className="text-xl text-slate-300">+</span>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const url = URL.createObjectURL(f); setDistForm((c) => { const imgs = [...c.newProductImages]; while (imgs.length <= idx) imgs.push(''); imgs[idx] = url; return { ...c, newProductImages: imgs }; }); }} />
                          </label>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* CỘT 2: Thông tin sản phẩm */}
                  <div className="w-64 shrink-0 space-y-4 overflow-y-auto p-6">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400">Thông tin sản phẩm</p>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">Mã sản phẩm <span className="text-red-500">*</span></label>
                      <input value={distForm.newProductSku} onChange={(e) => setDistForm((c) => ({ ...c, newProductSku: e.target.value }))} className="h-9 w-full rounded-lg border-2 border-slate-200 px-3 text-sm uppercase outline-none transition focus:border-cyan-500" placeholder="VD: SP001" required />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">Tên sản phẩm <span className="text-red-500">*</span></label>
                      <input value={distForm.newProductName} onChange={(e) => setDistForm((c) => ({ ...c, newProductName: e.target.value }))} className="h-9 w-full rounded-lg border-2 border-slate-200 px-3 text-sm outline-none transition focus:border-cyan-500" placeholder="Nhập tên sản phẩm..." required />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">Danh mục</label>
                      <select value={distForm.newProductCategory} onChange={(e) => setDistForm((c) => ({ ...c, newProductCategory: e.target.value }))} className="h-9 w-full rounded-lg border-2 border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-cyan-500">
                        {categoryOptions.map((cat: any) => <option key={cat.name} value={cat.name}>{cat.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">Giới thiệu</label>
                      <textarea value={distForm.newProductSupplier} onChange={(e) => setDistForm((c) => ({ ...c, newProductSupplier: e.target.value }))} rows={5} className="w-full resize-none rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-cyan-500" placeholder="Mô tả ngắn về sản phẩm..." />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">Giá bán (₫) <span className="text-red-500">*</span></label>
                      <input type="number" min="0" value={distForm.price} onChange={(e) => setDistForm((c) => ({ ...c, price: e.target.value }))} className="h-9 w-full rounded-lg border-2 border-slate-200 px-3 text-sm outline-none transition focus:border-cyan-500" placeholder="0" required />
                    </div>
                  </div>
                </>
              )}

              {distForm.mode === 'existing' && (
                <div className="w-80 shrink-0 space-y-4 overflow-y-auto p-6 bg-white border-r border-slate-100">
                   <p className="text-xs font-black uppercase tracking-wider text-slate-400">Chọn sản phẩm đích</p>
                   <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-600">Sản phẩm thương mại <span className="text-red-500">*</span></label>
                    <select
                      value={distForm.targetProductId}
                      onChange={e => setDistForm(c => ({...c, targetProductId: e.target.value}))}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500"
                    >
                      <option value="">-- Chọn sản phẩm --</option>
                      {products.filter(p => !p.supplier).map(p => <option key={p.id} value={p.id}>{p.internalSku} - {p.name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* CHUNG CHO CẢ 2 MODE: Phân bổ theo kho */}
              <div className="min-w-0 flex-1 overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400">Phân bổ theo kho</p>
                    <div className="text-sm font-bold text-cyan-700 bg-cyan-50 px-3 py-1 rounded-lg">
                        Khả dụng từ Lệnh Nhập: {rows.find(r => r.productId === distForm.productId)?.remainingQty?.toLocaleString('vi-VN') || 0}
                    </div>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left font-bold text-slate-700 border-r border-slate-200 min-w-[160px]">Kho</th>
                        <th className="px-4 py-3 text-center font-bold text-slate-700 border-r border-slate-200 min-w-[110px]">Tồn kho / Phân bổ</th>
                        <th className="px-4 py-3 text-center font-bold text-slate-700 border-r border-slate-200 min-w-[100px]">Đã bán</th>
                        <th className="px-4 py-3 text-center font-bold text-slate-700 border-r border-slate-200 min-w-[100px]">Nhập gần nhất (+)</th>
                        <th className="px-4 py-3 text-center font-bold text-slate-700 min-w-[100px]">Xuất gần nhất (−)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {warehouses.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">Chưa có kho nào được cấu hình.</td></tr>
                      ) : warehouses.map((wh: any) => {
                        const isDef = distForm.newProductDefaultWarehouse === wh.name || (warehouses.length > 0 && warehouses[0].name === wh.name && !distForm.newProductDefaultWarehouse);
                        return (
                          <tr key={wh.id || wh.name} className={`border-b border-slate-100 transition hover:bg-slate-50 ${isDef ? 'bg-slate-50/80' : ''}`}>
                            <td className="sticky left-0 z-10 bg-inherit border-r border-slate-100 px-4 py-3">
                              <div className="flex items-center gap-2">
                                {isDef && <span className="h-2 w-2 rounded-full bg-cyan-500 shrink-0" />}
                                <div>
                                  <p className="font-semibold text-slate-800">{wh.name}</p>
                                  <p className="text-xs text-slate-400">{wh.code}</p>
                                </div>
                              </div>
                            </td>
                            <td className="border-r border-slate-100 px-3 py-3 text-center">
                              {isDef ? (
                                <input 
                                  type="number" 
                                  min="1" 
                                  max={rows.find(r => r.productId === distForm.productId)?.remainingQty || 0}
                                  value={distForm.qtyToSell} 
                                  onChange={(e) => setDistForm((c) => ({ ...c, qtyToSell: e.target.value, newProductDefaultWarehouse: wh.name }))} 
                                  className="w-full rounded-lg border-2 border-slate-200 px-2 py-1.5 text-center text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500" 
                                  placeholder="0" 
                                  required 
                                />
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="border-r border-slate-100 px-4 py-3 text-center text-slate-400">—</td>
                            <td className="border-r border-slate-100 px-4 py-3 text-center text-slate-400">—</td>
                            <td className="px-4 py-3 text-center text-slate-400">—</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-slate-200">
                        <td className="sticky left-0 z-10 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-600 border-r border-slate-200">Tổng cộng</td>
                        <td className="border-r border-slate-200 px-4 py-2.5 text-center text-sm font-bold text-slate-700">{Number(distForm.qtyToSell) || 0}</td>
                        <td className="border-r border-slate-200 px-4 py-2.5 text-center text-sm font-bold text-slate-400">0</td>
                        <td className="border-r border-slate-200 px-4 py-2.5" />
                        <td className="px-4 py-2.5" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

            </div>

            <div className="flex justify-end gap-3 border-t-2 border-slate-100 bg-white px-6 py-4 shrink-0" style={{ borderBottomLeftRadius: '1rem', borderBottomRightRadius: '1rem' }}>
              <button type="button" onClick={() => setDistributionModalOpen(false)} className="rounded-xl border-2 border-slate-200 px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition">
                Hủy bỏ
              </button>
              <button type="button" disabled={saving} onClick={submitDistribution} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-8 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-60 transition">
                {saving ? 'Đang xử lý...' : (distForm.mode === 'new' ? 'Tạo sản phẩm' : 'Xác nhận xuất bán')}
              </button>
            </div>
          </div>
        </div>
      )}
{historyModalOpen && selectedRowHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4 shrink-0">
              <div>
                <h3 className="text-xl font-black text-slate-900">Chi tiết & Lịch sử nguồn hàng</h3>
                <p className="text-sm font-bold text-cyan-700 mt-1">{selectedRowHistory.productSku} - {selectedRowHistory.productName}</p>
              </div>
              <button onClick={() => { setHistoryModalOpen(false); setSelectedRowHistory(null); }} className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="p-4 font-black uppercase text-slate-700">Ngày nhập</th>
                      <th className="border-l border-slate-200 p-4 font-black uppercase text-slate-700">Lệnh Nhập Kho</th>
                      <th className="border-l border-slate-200 p-4 font-black uppercase text-slate-700">Mã Đơn Hàng</th>
                      <th className="border-l border-slate-200 p-4 font-black uppercase text-slate-700">Kho lưu trữ</th>
                      <th className="border-l border-slate-200 p-4 font-black text-center uppercase text-slate-700">Đã nhập</th>
                      <th className="border-l border-slate-200 p-4 font-black text-center uppercase text-slate-700">Khả dụng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRowHistory.details.map((d, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition">
                        <td className="p-4 font-semibold text-slate-600">{d.lastImportDate ? new Date(d.lastImportDate).toLocaleString('vi-VN') : '-'}</td>
                        <td className="border-l border-slate-100 p-4 font-bold text-slate-800">{d.orderCode}</td>
                        <td className="border-l border-slate-100 p-4 font-medium text-slate-600">{d.poNumber}</td>
                        <td className="border-l border-slate-100 p-4 font-medium text-slate-600">{d.warehouseCode}</td>
                        <td className="border-l border-slate-100 p-4 text-center font-black text-slate-400">{formatNumber(d.actualQty)}</td>
                        <td className="border-l border-slate-100 p-4 text-center font-black text-cyan-600">{formatNumber(d.remainingQty)}</td>
                      </tr>
                    ))}
                    {selectedRowHistory.details.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">Không có dữ liệu chi tiết</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200">
                    <tr>
                      <td colSpan={4} className="p-4 text-right font-black uppercase text-slate-700">TỔNG CỘNG:</td>
                      <td className="p-4 text-center font-black text-slate-700">{formatNumber(selectedRowHistory.actualQty)}</td>
                      <td className="p-4 text-center font-black text-cyan-700">{formatNumber(selectedRowHistory.remainingQty)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
