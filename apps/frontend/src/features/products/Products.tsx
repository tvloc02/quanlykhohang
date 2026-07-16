import React from 'react';
import {
  Eye,
  Pencil,
  PlusCircle,
  Search,
  Trash2,
  Package,
  X,
  XCircle,
  CheckCircle,
  Filter,
} from 'lucide-react';
import {
  getActiveItemGroupCategories,
  getStoredCatalogCategories,
} from '../../shared/utils/catalogCategories';
import { getStoredWarehouses } from '../../shared/utils/warehouseAssignments';

// TĂ­ch há»£p Toast ná»™i bá»™ Ä‘á»ƒ khĂ´ng bá»‹ lá»—i import
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  React.useEffect(() => {
    if (message) {
      const timer = setTimeout(() => onClose(), 3000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className={`fixed top-4 right-4 z-[60] flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg transition-all ${type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
      {type === 'error' ? <XCircle size={20} /> : <CheckCircle size={20} />}
      <p className="text-sm font-semibold">{message}</p>
      <button onClick={onClose} className="ml-2 rounded-lg p-1 hover:bg-white/50 transition">
        <X size={16} />
      </button>
    </div>
  );
}

type SupplierField = string | {
  id?: string;
  supplierCode?: string;
  name?: string;
  taxCode?: string;
  status?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  leadTimeDays?: number;
  paymentTerms?: string;
  currency?: string;
  priorityLevel?: string;
};

type RawProduct = {
  id?: string;
  sku?: string;
  internalSku?: string;
  name?: string;
  category?: string | { name?: string };
  unit?: string;
  defaultWarehouse?: string;
  location?: string;
  managementType?: string;
  supplier?: SupplierField;
  price?: number;
  stock?: number;
};

type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  defaultWarehouse: string;
  location: string;
  managementType: string;
  supplier: string;
  price: number;
  stock: number;
};

type ProductForm = {
  sku: string;
  name: string;
  category: string;
  unit: string;
  defaultWarehouse: string;
  location: string;
  managementType: string;
  supplier: string;
  price: number | '';
  stock: number | '';
};

type ModalMode = 'create' | 'view' | 'edit' | 'delete' | null;

const API_BASE_URL = 'http://localhost:3000/api';
const PRODUCT_STORAGE_KEY = 'smart-wms-products';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function buildEmptyForm(): ProductForm {
  return {
    sku: '',
    name: '',
    category: '',
    unit: '',
    defaultWarehouse: '',
    location: '',
    managementType: '',
    supplier: '',
    price: '',
    stock: '',
  };
}

function getStoredProducts(): Product[] {
  try {
    const rawData = localStorage.getItem(PRODUCT_STORAGE_KEY);
    if (!rawData) return [];
    const parsedData = JSON.parse(rawData);
    return Array.isArray(parsedData) ? parsedData.map(normalizeProduct) : [];
  } catch {
    return [];
  }
}

function saveStoredProducts(products: Product[]) {
  localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(products));
}

function normalizeSupplierField(supplier: SupplierField): string {
  if (!supplier) return '';
  if (typeof supplier === 'string') return supplier;
  return supplier.name || supplier.supplierCode || supplier.id || '';
}

function normalizeCategory(category?: string | { name?: string }): string {
  if (!category) return '';
  return typeof category === 'string' ? category : category.name || '';
}

function normalizeProduct(product: RawProduct): Product {
  return {
    id: product.id || crypto.randomUUID(),
    sku: product.internalSku || product.sku || '',
    name: product.name || '',
    category: normalizeCategory(product.category),
    unit: product.unit || '',
    defaultWarehouse: product.defaultWarehouse || '',
    location: product.location || '',
    managementType: product.managementType || '',
    supplier: normalizeSupplierField(product.supplier || ''),
    price: Number(product.price || 0),
    stock: Number(product.stock || 0),
  };
}

export default function Products() {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [modalMode, setModalMode] = React.useState<ModalMode>(null);
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null);
  const [form, setForm] = React.useState<ProductForm>(buildEmptyForm());
  const [catalogCategories, setCatalogCategories] = React.useState(() => getStoredCatalogCategories());
  const [warehouses, setWarehouses] = React.useState(() => getStoredWarehouses());

  // Pagination states
  const [pageSize, setPageSize] = React.useState(20);
  const [currentPage, setCurrentPage] = React.useState(1);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/products`, { headers: authHeaders() });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'KhĂ´ng táº£i Ä‘Æ°á»£c danh sĂ¡ch sáº£n pháº©m');
      }

      const data = (await response.json()) as RawProduct[];
      const normalizedProducts = data.map(normalizeProduct);
      setProducts(normalizedProducts);
      saveStoredProducts(normalizedProducts);
    } catch (err) {
      setProducts(getStoredProducts());
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    const syncMasterData = () => {
      setCatalogCategories(getStoredCatalogCategories());
      setWarehouses(getStoredWarehouses());
    };
    window.addEventListener('storage', syncMasterData);
    return () => window.removeEventListener('storage', syncMasterData);
  }, []);

  // Reset trang khi filter
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const filteredProducts = products.filter((product) => {
    const keyword = search.trim().toLowerCase();
    return (
      !keyword ||
      product.name.toLowerCase().includes(keyword) ||
      product.sku.toLowerCase().includes(keyword) ||
      product.category.toLowerCase().includes(keyword)
    );
  });

  // Calculate Pagination
  const totalItems = filteredProducts.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);
  const categoryOptions = getActiveItemGroupCategories(catalogCategories);
  const unitOptions = catalogCategories.filter((category) => category.type === 'unit' && category.status === 'active');
  const managementTypeOptions = catalogCategories.filter(
    (category) => category.type === 'management-attribute' && category.status === 'active',
  );
  const locationOptions = catalogCategories.filter(
    (category) => category.type === 'storage-position' && category.status === 'active',
  );
  const productCategoryOptions = [
    ...categoryOptions.map((category) => ({
      value: category.name,
      label: `${category.code} - ${category.name}`,
    })),
    ...(form.category && !categoryOptions.some((category) => category.name === form.category)
      ? [{ value: form.category, label: form.category }]
      : []),
  ];
  const productUnitOptions = [
    ...unitOptions.map((unit) => ({ value: unit.name, label: `${unit.code} - ${unit.name}` })),
    ...(form.unit && !unitOptions.some((unit) => unit.name === form.unit) ? [{ value: form.unit, label: form.unit }] : []),
  ];
  const productManagementTypeOptions = [
    ...managementTypeOptions.map((type) => ({ value: type.name, label: `${type.code} - ${type.name}` })),
    ...(form.managementType && !managementTypeOptions.some((type) => type.name === form.managementType)
      ? [{ value: form.managementType, label: form.managementType }]
      : []),
  ];
  const productLocationOptions = [
    ...locationOptions.map((location) => ({ value: location.name, label: `${location.code} - ${location.name}` })),
    ...(form.location && !locationOptions.some((location) => location.name === form.location)
      ? [{ value: form.location, label: form.location }]
      : []),
  ];
  const warehouseOptions = [
    ...warehouses.map((warehouse) => ({ value: warehouse.name, label: `${warehouse.code} - ${warehouse.name}` })),
    ...(form.defaultWarehouse && !warehouses.some((warehouse) => warehouse.name === form.defaultWarehouse)
      ? [{ value: form.defaultWarehouse, label: form.defaultWarehouse }]
      : []),
  ];

  const closeModal = () => {
    setModalMode(null);
    setSelectedProduct(null);
    setSaving(false);
  };

  const openCreateModal = () => {
    setError('');
    setSuccess('');
    setSelectedProduct(null);
    setForm({
      ...buildEmptyForm(),
      category: categoryOptions[0]?.name || '',
      unit: unitOptions[0]?.name || '',
      managementType: managementTypeOptions[0]?.name || '',
      defaultWarehouse: warehouses[0]?.name || '',
      location: locationOptions[0]?.name || '',
    });
    setModalMode('create');
  };

  const openProductModal = (mode: Exclude<ModalMode, 'create' | null>, product: Product) => {
    setError('');
    setSuccess('');
    setSelectedProduct(product);
    setForm({
      sku: product.sku,
      name: product.name,
      category: product.category,
      unit: product.unit || '',
      defaultWarehouse: product.defaultWarehouse || '',
      location: product.location || '',
      managementType: product.managementType || '',
      supplier: product.supplier,
      price: product.price,
      stock: product.stock,
    });
    setModalMode(mode);
  };

  const saveProductLocally = (isEdit: boolean) => {
    const payload: Product = {
      id: isEdit && selectedProduct ? selectedProduct.id : crypto.randomUUID(),
      sku: form.sku.trim().toUpperCase(),
      name: form.name.trim(),
      category: form.category.trim(),
      unit: form.unit.trim(),
      defaultWarehouse: form.defaultWarehouse.trim(),
      location: form.location.trim(),
      managementType: form.managementType.trim(),
      supplier: form.supplier.trim(),
      price: Number(form.price),
      stock: Number(form.stock),
    };
    const nextProducts = isEdit
      ? products.map((product) => (product.id === payload.id ? payload : product))
      : [payload, ...products];

    setProducts(nextProducts);
    saveStoredProducts(nextProducts);
    setSuccess(isEdit ? 'ÄĂ£ cáº­p nháº­t sáº£n pháº©m.' : 'ÄĂ£ thĂªm sáº£n pháº©m má»›i.');
    closeModal();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !form.sku.trim() ||
      !form.name.trim() ||
      !form.category.trim() ||
      !form.unit.trim() ||
      !form.defaultWarehouse.trim() ||
      !form.location.trim() ||
      !form.managementType.trim() ||
      form.price === '' ||
      form.stock === ''
    ) {
      setError('Vui lĂ²ng nháº­p Ä‘áº§y Ä‘á»§ cĂ¡c trÆ°á»ng báº¯t buá»™c.');
      return;
    }

    if (categoryOptions.length === 0) {
      setError('Vui lĂ²ng táº¡o danh má»¥c loáº¡i "NhĂ³m hĂ ng váº­t tÆ° hĂ ng hĂ³a" trÆ°á»›c khi thĂªm sáº£n pháº©m.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const isEdit = modalMode === 'edit';
      const url = isEdit && selectedProduct ? `${API_BASE_URL}/products/${selectedProduct.id}` : `${API_BASE_URL}/products`;
      
      const response = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          sku: form.sku.trim().toUpperCase(),
          name: form.name.trim(),
          category: form.category.trim(),
          unit: form.unit.trim(),
          defaultWarehouse: form.defaultWarehouse.trim(),
          location: form.location.trim(),
          managementType: form.managementType.trim(),
          supplier: form.supplier.trim(),
          price: Number(form.price),
          stock: Number(form.stock),
        }),
      });

      if (!response.ok) {
        saveProductLocally(isEdit);
        return;
      }

      setSuccess(isEdit ? 'ÄĂ£ cáº­p nháº­t sáº£n pháº©m.' : 'ÄĂ£ thĂªm sáº£n pháº©m má»›i.');
      closeModal();
      await loadData();
    } catch (err) {
      saveProductLocally(modalMode === 'edit');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedProduct) return;
    setSaving(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/products/${selectedProduct.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });

      if (!response.ok) {
        const nextProducts = products.filter((product) => product.id !== selectedProduct.id);
        setProducts(nextProducts);
        saveStoredProducts(nextProducts);
        setSuccess('ÄĂ£ xĂ³a sáº£n pháº©m.');
        closeModal();
        return;
      }

      setSuccess('ÄĂ£ xĂ³a sáº£n pháº©m.');
      closeModal();
      await loadData();
    } catch (err) {
      const nextProducts = products.filter((product) => product.id !== selectedProduct.id);
      setProducts(nextProducts);
      saveStoredProducts(nextProducts);
      setSuccess('ÄĂ£ xĂ³a sáº£n pháº©m.');
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  const modalTitle =
    modalMode === 'create'
      ? 'ThĂªm sáº£n pháº©m'
      : modalMode === 'view'
        ? 'Chi tiáº¿t sáº£n pháº©m'
        : modalMode === 'edit'
          ? 'Sá»­a sáº£n pháº©m'
          : 'XĂ³a sáº£n pháº©m';

  return (
    <div>
      <Toast
        message={error || success}
        type={error ? 'error' : 'success'}
        onClose={() => {
          setError('');
          setSuccess('');
        }}
      />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Quáº£n lĂ½ sáº£n pháº©m</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Quáº£n lĂ½ danh sĂ¡ch sáº£n pháº©m, giĂ¡ bĂ¡n vĂ  tá»“n kho.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700"
        >
          <PlusCircle className="h-4 w-4" />
          ThĂªm sáº£n pháº©m
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white pl-11 pr-4 text-base outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
            placeholder="TĂ¬m kiáº¿m sáº£n pháº©m theo tĂªn, SKU, danh má»¥c..."
          />
        </div>
        <div className="flex justify-start xl:justify-end">
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
            <Filter size={18} className="text-slate-500" />
            Lá»c
          </button>
        </div>
      </div>

      {/* Wrapper chá»©a báº£ng + phĂ¢n trang dĂ­nh liá»n nhau */}
      <div className="mt-5 overflow-hidden rounded-xl border-2 border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1560px] border-collapse bg-white">
            <thead className="bg-slate-50">
              <tr className="border-b-2 border-slate-200">
                <th className="w-16 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">STT</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">MĂ£ hĂ ng (SKU)</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">TĂªn hĂ ng hĂ³a</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">ÄVT</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">NhĂ³m hĂ ng</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Kho ngáº§m Ä‘á»‹nh</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Vá»‹ trĂ­</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Thuá»™c tĂ­nh quáº£n lĂ½</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">NhĂ  cung cáº¥p</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">GiĂ¡</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Tá»“n kho</th>
                <th className="sticky right-0 w-36 border-l border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm font-black uppercase text-slate-700 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
                  Thao tĂ¡c
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Äang táº£i dá»¯ liá»‡u sáº£n pháº©m...
                  </td>
                </tr>
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    ChÆ°a cĂ³ sáº£n pháº©m phĂ¹ há»£p.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product, index) => (
                  <tr key={product.id} className="group border-b border-slate-200 transition hover:bg-cyan-50/50">
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                      {startIndex + index}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-bold text-slate-800">
                      {product.sku}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-medium text-slate-700">
                      {product.name}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                      {product.unit || '-'}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                      {product.category || '-'}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                      {product.defaultWarehouse || '-'}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                      {product.location || '-'}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                      {product.managementType || '-'}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                      {product.supplier || '-'}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-bold text-slate-800">
                      {product.price.toLocaleString('vi-VN')} â‚«
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                      <span className="inline-flex rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">
                        {product.stock}
                      </span>
                    </td>
                    <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-4 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100 hover:text-cyan-700"
                          aria-label="Xem chi tiáº¿t"
                          title="Xem chi tiáº¿t"
                          onClick={() => openProductModal('view', product)}
                        >
                          <Eye size={18} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100 hover:text-cyan-700"
                          aria-label="Sá»­a sáº£n pháº©m"
                          title="Sá»­a sáº£n pháº©m"
                          onClick={() => openProductModal('edit', product)}
                        >
                          <Pencil size={18} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100 hover:text-cyan-700"
                          aria-label="XĂ³a sáº£n pháº©m"
                          title="XĂ³a sáº£n pháº©m"
                          onClick={() => openProductModal('delete', product)}
                        >
                          <Trash2 size={18} strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PhĂ¢n trang */}
        {!loading && totalItems > 0 && (
          <div className="flex flex-col items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-3 sm:flex-row">
            <div className="text-sm text-slate-600">
              Tá»•ng sá»‘: <b>{totalItems}</b> <span className="ml-2">Hiá»ƒn thá»‹ {startIndex} - {endIndex}</span>
            </div>
            <div className="mt-4 flex items-center gap-2 sm:mt-0">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              >
                <option value={5}>5</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  Â«
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  â€¹
                </button>
                <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-sm font-bold text-white">
                  {currentPage}
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  â€º
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  Â»
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm transition-all">
          <div className="w-full max-w-6xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600">
                  <Package className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">{modalTitle}</h2>
                  <p className="text-sm font-medium text-slate-500">
                    {modalMode === 'view' ? 'ThĂ´ng tin sáº£n pháº©m chi tiáº¿t' : 'Khai bĂ¡o thĂ´ng tin sáº£n pháº©m vĂ  phĂ¢n bá»• kho'}
                  </p>
                </div>
              </div>
              <button type="button" onClick={closeModal} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalMode === 'delete' ? (
              <div className="px-6 py-5">
                <p className="text-base text-slate-700">
                  Báº¡n cĂ³ cháº¯c muá»‘n xĂ³a sáº£n pháº©m{' '}
                  <span className="font-black text-slate-950">{selectedProduct?.name}</span> (SKU: {selectedProduct?.sku}) khĂ´ng?
                </p>
                <p className="mt-2 text-sm text-red-500 font-medium">HĂ nh Ä‘á»™ng nĂ y khĂ´ng thá»ƒ hoĂ n tĂ¡c.</p>
                <div className="mt-8 flex justify-end gap-3">
                  <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition">
                    Há»§y
                  </button>
                  <button 
                    type="button" 
                    onClick={handleDelete} 
                    disabled={saving}
                    className="rounded-xl bg-red-600 px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
                  >
                    {saving ? 'Äang xĂ³a...' : 'XĂ³a sáº£n pháº©m'}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="flex divide-x divide-slate-100">
                  {/* === TRĂI: ThĂ´ng tin sáº£n pháº©m === */}
                  <div className="w-64 shrink-0 space-y-4 p-5">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400">ThĂ´ng tin sáº£n pháº©m</p>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">MĂ£ sáº£n pháº©m <span className="text-red-500">*</span></label>
                      <input value={form.sku} onChange={(e) => setForm((c) => ({ ...c, sku: e.target.value }))} readOnly={modalMode === 'view'} className="h-9 w-full rounded-lg border-2 border-slate-200 px-3 text-sm uppercase outline-none transition focus:border-cyan-500 read-only:bg-slate-50" placeholder="VD: SP001" required />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">TĂªn sáº£n pháº©m <span className="text-red-500">*</span></label>
                      <input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} readOnly={modalMode === 'view'} className="h-9 w-full rounded-lg border-2 border-slate-200 px-3 text-sm outline-none transition focus:border-cyan-500 read-only:bg-slate-50" placeholder="Nháº­p tĂªn sáº£n pháº©m..." required />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">Danh má»¥c</label>
                      <select value={form.category} onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))} disabled={modalMode === 'view' || productCategoryOptions.length === 0} className="h-9 w-full rounded-lg border-2 border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-cyan-500 disabled:bg-slate-50">
                        {productCategoryOptions.length === 0 ? <option value="">ChÆ°a cĂ³ danh má»¥c</option> : productCategoryOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">Giá»›i thiá»‡u</label>
                      <textarea value={form.supplier} onChange={(e) => setForm((c) => ({ ...c, supplier: e.target.value }))} readOnly={modalMode === 'view'} rows={4} className="w-full resize-none rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-cyan-500 read-only:bg-slate-50" placeholder="MĂ´ táº£ ngáº¯n..." />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">GiĂ¡ bĂ¡n (â‚«) <span className="text-red-500">*</span></label>
                      <input type="number" min="0" value={form.price} onChange={(e) => setForm((c) => ({ ...c, price: e.target.value ? Number(e.target.value) : '' }))} readOnly={modalMode === 'view'} className="h-9 w-full rounded-lg border-2 border-slate-200 px-3 text-sm outline-none transition focus:border-cyan-500 read-only:bg-slate-50" placeholder="0" required />
                    </div>
                  </div>

                  {/* === PHáº¢I: Ma tráº­n kho Ă— thuá»™c tĂ­nh === */}
                  <div className="min-w-0 flex-1 p-5">
                    <p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-400">PhĂ¢n bá»• theo kho</p>
                    <div className="overflow-auto rounded-xl border border-slate-200">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-black text-slate-600 border-r border-slate-200 min-w-[130px]">Kho</th>
                            <th className="px-3 py-2 text-center font-black text-slate-600 border-r border-slate-200 min-w-[80px]">ÄVT</th>
                            <th className="px-3 py-2 text-center font-black text-cyan-700 bg-cyan-50/70 border-r border-slate-200 min-w-[85px]">Tá»“n kho</th>
                            <th className="px-3 py-2 text-center font-black text-slate-500 border-r border-slate-200 min-w-[75px]">ÄĂ£ bĂ¡n</th>
                            <th className="px-3 py-2 text-center font-black text-emerald-700 bg-emerald-50/70 border-r border-slate-200 min-w-[70px]">Nháº­p (+)</th>
                            <th className="px-3 py-2 text-center font-black text-red-600 bg-red-50/70 border-r border-slate-200 min-w-[70px]">Xuáº¥t (âˆ’)</th>
                            <th className="px-3 py-2 text-center font-black text-slate-600 border-r border-slate-200 min-w-[90px]">Vá»‹ trĂ­</th>
                            <th className="px-3 py-2 text-center font-black text-slate-600 min-w-[90px]">Ngáº§m Ä‘á»‹nh</th>
                          </tr>
                        </thead>
                        <tbody>
                          {warehouses.length === 0 ? (
                            <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">ChÆ°a cĂ³ kho nĂ o.</td></tr>
                          ) : warehouses.map((wh) => {
                            const isDef = form.defaultWarehouse === wh.name;
                            return (
                              <tr key={wh.id || wh.name} className={`border-b border-slate-100 transition hover:bg-slate-50/80 ${isDef ? 'bg-cyan-50/50' : ''}`}>
                                <td className="sticky left-0 z-10 bg-inherit border-r border-slate-100 px-3 py-2">
                                  <div className="flex items-center gap-1.5">
                                    {isDef && <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 shrink-0" />}
                                    <span className="font-semibold text-slate-700">{wh.name}</span>
                                  </div>
                                  <span className="text-[10px] text-slate-400">{wh.code}</span>
                                </td>
                                <td className="border-r border-slate-100 px-2 py-1.5 text-center">
                                  <select value={isDef ? form.unit : ''} onChange={(e) => isDef && setForm((c) => ({ ...c, unit: e.target.value }))} disabled={!isDef || modalMode === 'view'} className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-xs outline-none focus:border-cyan-400 disabled:bg-transparent disabled:border-transparent disabled:text-slate-300 text-center">
                                    {productUnitOptions.length === 0 ? <option value="">-</option> : productUnitOptions.map((u) => <option key={u.value} value={u.value}>{u.value}</option>)}
                                  </select>
                                </td>
                                <td className="border-r border-slate-100 bg-cyan-50/30 px-2 py-1.5 text-center">
                                  {isDef ? (
                                    <input type="number" min="0" value={form.stock} onChange={(e) => setForm((c) => ({ ...c, stock: e.target.value ? Number(e.target.value) : '' }))} readOnly={modalMode === 'view'} className="w-full rounded border border-cyan-300 bg-white px-1 py-0.5 text-center text-xs font-bold text-cyan-800 outline-none focus:border-cyan-500 read-only:border-transparent read-only:bg-transparent" placeholder="0" required />
                                  ) : <span className="text-slate-300">â€”</span>}
                                </td>
                                <td className="border-r border-slate-100 px-2 py-1.5 text-center text-slate-300">â€”</td>
                                <td className="border-r border-slate-100 bg-emerald-50/30 px-2 py-1.5 text-center text-emerald-500 font-semibold">â€”</td>
                                <td className="border-r border-slate-100 bg-red-50/30 px-2 py-1.5 text-center text-red-400 font-semibold">â€”</td>
                                <td className="border-r border-slate-100 px-2 py-1.5 text-center">
                                  <select value={isDef ? form.location : ''} onChange={(e) => isDef && setForm((c) => ({ ...c, location: e.target.value }))} disabled={!isDef || modalMode === 'view'} className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-xs outline-none focus:border-cyan-400 disabled:bg-transparent disabled:border-transparent disabled:text-slate-300 text-center">
                                    {productLocationOptions.length === 0 ? <option value="">-</option> : productLocationOptions.map((l) => <option key={l.value} value={l.value}>{l.value}</option>)}
                                  </select>
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  {modalMode !== 'view' ? (
                                    <button type="button" onClick={() => setForm((c) => ({ ...c, defaultWarehouse: wh.name }))} className={`mx-auto flex h-5 w-5 items-center justify-center rounded-full border-2 transition ${isDef ? 'border-cyan-500 bg-cyan-500' : 'border-slate-300 hover:border-cyan-400'}`}>
                                      {isDef && <span className="h-2 w-2 rounded-full bg-white" />}
                                    </button>
                                  ) : isDef ? (
                                    <span className="mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500"><span className="h-2 w-2 rounded-full bg-white" /></span>
                                  ) : <span className="text-slate-300">â€”</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 border-t-2 border-slate-200">
                            <td className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600 border-r border-slate-200">Tá»•ng</td>
                            <td className="border-r border-slate-200 px-2 py-2" />
                            <td className="border-r border-slate-200 bg-cyan-50 px-2 py-2 text-center text-xs font-black text-cyan-700">{Number(form.stock) || 0}</td>
                            <td className="border-r border-slate-200 px-2 py-2 text-center text-xs font-bold text-slate-400">0</td>
                            <td className="border-r border-slate-200 px-2 py-2" />
                            <td className="border-r border-slate-200 px-2 py-2" />
                            <td className="border-r border-slate-200 px-2 py-2" />
                            <td className="px-2 py-2" />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="mt-4">
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">Thuá»™c tĂ­nh quáº£n lĂ½</label>
                      <select value={form.managementType} onChange={(e) => setForm((c) => ({ ...c, managementType: e.target.value }))} disabled={modalMode === 'view' || productManagementTypeOptions.length === 0} className="h-9 w-full max-w-xs rounded-lg border-2 border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-cyan-500 disabled:bg-slate-50">
                        {productManagementTypeOptions.length === 0 ? <option value="">ChÆ°a cĂ³ danh má»¥c</option> : productManagementTypeOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                  </div>

                </div>

                <div className="flex justify-end gap-3 border-t-2 border-slate-100 px-6 py-4">
                  <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-6 py-2.5 font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition">
                    {modalMode === 'view' ? 'ÄĂ³ng' : 'Há»§y bá»'}
                  </button>
                  {modalMode !== 'view' && (
                    <button 
                      type="submit" 
                      disabled={saving}
                      className="rounded-xl bg-cyan-600 px-8 py-2.5 font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
                    >
                      {saving ? 'Äang lÆ°u...' : modalMode === 'create' ? 'Táº¡o sáº£n pháº©m' : 'LÆ°u thay Ä‘á»•i'}
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
