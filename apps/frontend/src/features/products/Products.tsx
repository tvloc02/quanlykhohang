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

// Tích hợp Toast nội bộ để không bị lỗi import
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
  totalStock?: number;
  isVisible?: boolean;
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
  images: string[];
  isVisible: boolean;
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
  images: string[];
  isVisible: boolean;
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
    images: [],
    isVisible: false,
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
    stock: Number(product.totalStock !== undefined ? product.totalStock : (product.stock || 0)),
    images: (product as any).images || [],
    isVisible: !!product.isVisible,
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
        throw new Error(data?.message || 'Không tải được danh sách sản phẩm');
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
      images: product.images || [],
      isVisible: product.isVisible || false,
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
      images: form.images,
      isVisible: form.isVisible,
    };
    const nextProducts = isEdit
      ? products.map((product) => (product.id === payload.id ? payload : product))
      : [payload, ...products];

    setProducts(nextProducts);
    saveStoredProducts(nextProducts);
    setSuccess(isEdit ? 'Đã cập nhật sản phẩm.' : 'Đã thêm sản phẩm mới.');
    closeModal();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !form.sku.trim() ||
      !form.name.trim() ||
      form.price === ''
    ) {
      setError('Vui lòng nhập Mã sản phẩm, Tên sản phẩm và Giá bán.');
      return;
    }

    if (categoryOptions.length === 0) {
      setError('Vui lòng tạo danh mục loại "Nhóm hàng vật tư hàng hóa" trước khi thêm sản phẩm.');
      return;
    }

    if (!form.category) {
      setError('Vui lòng chọn Danh mục cho sản phẩm.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const isEdit = modalMode === 'edit';
      const url = isEdit && selectedProduct ? `${API_BASE_URL}/products/${selectedProduct.id}` : `${API_BASE_URL}/products`;
      
      const foundCategory = categoryOptions.find(c => c.name === form.category);
      const payload = {
        internalSku: form.sku.trim().toUpperCase(),
        sku: form.sku.trim().toUpperCase(),
        name: form.name.trim(),
        categoryId: foundCategory ? foundCategory.id : undefined,
        category: form.category.trim(),
        unit: form.unit.trim(),
        defaultWarehouse: form.defaultWarehouse.trim(),
        location: form.location.trim(),
        managementType: form.managementType.trim(),
        supplier: form.supplier.trim(),
        price: Number(form.price),
        stock: Number(form.stock),
        images: form.images.filter(Boolean),
      };

      const response = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không thể lưu sản phẩm. Vui lòng kiểm tra lại thông tin (có thể trùng mã sản phẩm).');
      }

      setSuccess(isEdit ? 'Đã cập nhật sản phẩm.' : 'Đã thêm sản phẩm mới.');
      closeModal();
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra khi kết nối đến máy chủ.');
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
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không thể xóa sản phẩm. Có thể do sản phẩm đang có dữ liệu liên quan.');
      }

      setSuccess('Đã xóa sản phẩm thành công.');
      closeModal();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi hệ thống khi xóa sản phẩm');
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  const modalTitle =
    modalMode === 'create'
      ? 'Thêm sản phẩm'
      : modalMode === 'view'
        ? 'Chi tiết sản phẩm'
        : modalMode === 'edit'
          ? 'Sửa sản phẩm'
          : 'Xóa sản phẩm';

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
          <h1 className="text-2xl font-black text-slate-900">Quản lý sản phẩm</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Quản lý danh sách sản phẩm, giá bán và tồn kho.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700"
        >
          <PlusCircle className="h-4 w-4" />
          Thêm sản phẩm
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
            placeholder="Tìm kiếm sản phẩm theo tên, SKU, danh mục..."
          />
        </div>
        <div className="flex justify-start xl:justify-end">
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
            <Filter size={18} className="text-slate-500" />
            Lọc
          </button>
        </div>
      </div>

      {/* Wrapper chứa bảng + phân trang dính liền nhau */}
      <div className="mt-5 overflow-hidden rounded-xl border-2 border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse bg-white">
            <thead className="bg-slate-50">
              <tr className="border-b-2 border-slate-200">
                <th className="w-10 border-x border-slate-200 px-3 py-4 text-center">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-cyan-600" />
                </th>
                <th className="w-12 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">STT</th>
                <th className="w-20 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Ảnh</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Mã sản phẩm</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Tên hàng hóa</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Danh mục</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Giá</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Tồn kho</th>
                <th className="w-28 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700 leading-tight">Hiện trên Shop</th>
                <th className="sticky right-0 w-48 border-l border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm font-black uppercase text-slate-700 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Đang tải dữ liệu sản phẩm...
                  </td>
                </tr>
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Chưa có sản phẩm phù hợp.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product, index) => (
                  <tr key={product.id} className="group border-b border-slate-200 transition hover:bg-cyan-50/50">
                    {/* Checkbox */}
                    <td className="border-x border-slate-200 px-3 py-3 text-center">
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-cyan-600" />
                    </td>
                    {/* STT */}
                    <td className="border-x border-slate-200 px-3 py-3 text-center text-sm text-slate-500">
                      {startIndex + index}
                    </td>
                    {/* Ảnh chính */}
                    <td className="border-x border-slate-200 px-2 py-2 text-center">
                      {product.images?.[0] ? (
                        <img src={product.images[0]} alt={product.name} className="mx-auto h-12 w-12 rounded-lg object-cover border border-slate-200" />
                      ) : (
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-300">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                      )}
                    </td>
                    {/* Mã sản phẩm */}
                    <td className="border-x border-slate-200 px-3 py-3 text-center text-sm font-bold text-slate-800">
                      {product.sku}
                    </td>
                    {/* Tên */}
                    <td className="border-x border-slate-200 px-3 py-3 text-sm font-medium text-slate-700">
                      {product.name}
                    </td>
                    {/* Danh mục */}
                    <td className="border-x border-slate-200 px-3 py-3 text-center text-sm text-slate-600">
                      {product.category || '-'}
                    </td>
                    {/* Giá */}
                    <td className="border-x border-slate-200 px-3 py-3 text-center text-sm font-bold text-slate-800">
                      {product.price.toLocaleString('vi-VN')} ₫
                    </td>
                    {/* Tồn kho */}
                    <td className="border-x border-slate-200 px-3 py-3 text-center align-middle">
                      <span className="inline-flex rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">
                        {product.stock}
                      </span>
                    </td>
                    {/* Hiện trên Shop */}
                    <td className="border-x border-slate-200 px-3 py-3 text-center align-middle">
                      <button
                        onClick={async () => {
                          try {
                            const response = await fetch(`${API_BASE_URL}/products/${product.id}`, {
                              method: 'PUT',
                              headers: authHeaders(),
                              body: JSON.stringify({ isVisible: !product.isVisible }),
                            });
                            if (!response.ok) throw new Error('Cập nhật thất bại');
                            const updatedList = products.map(p => p.id === product.id ? { ...p, isVisible: !p.isVisible } : p);
                            setProducts(updatedList);
                            saveStoredProducts(updatedList);
                          } catch (err) {
                            setError('Không thể cập nhật trạng thái hiển thị');
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${product.isVisible ? 'bg-cyan-500' : 'bg-slate-300'}`}
                        title={product.isVisible ? "Đang hiển thị trên Shop" : "Đã ẩn khỏi Shop"}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${product.isVisible ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </td>
                    {/* Thao tác */}
                    <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-3 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                      <div className="flex items-center justify-center gap-2">
                        <button type="button" className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100" title="Xem chi tiết" onClick={() => openProductModal('view', product)}>
                          <Eye size={16} strokeWidth={2} />
                        </button>
                        <button type="button" className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100" title="Sửa" onClick={() => openProductModal('edit', product)}>
                          <Pencil size={16} strokeWidth={2} />
                        </button>
                        <button type="button" className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-500 transition-colors hover:bg-red-100" title="Xóa" onClick={() => openProductModal('delete', product)}>
                          <Trash2 size={16} strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        {!loading && totalItems > 0 && (
          <div className="flex flex-col items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-3 sm:flex-row">
            <div className="text-sm text-slate-600">
              Tổng số: <b>{totalItems}</b> <span className="ml-2">Hiển thị {startIndex} - {endIndex}</span>
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
                  «
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  ‹
                </button>
                <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-sm font-bold text-white">
                  {currentPage}
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  ›
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  »
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 backdrop-blur-sm">
          <div className="flex w-full max-w-[95vw] flex-col" style={{ height: '92vh', borderRadius: '1rem', background: '#fff', boxShadow: '0 25px 60px rgba(0,0,0,0.18)' }}>
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b-2 border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600">
                  <Package className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">{modalTitle}</h2>
                  <p className="text-sm font-medium text-slate-500">
                    {modalMode === 'view' ? 'Thông tin sản phẩm chi tiết' : 'Khai báo thông tin sản phẩm và phân bổ theo kho'}
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
                  Bạn có chắc muốn xóa sản phẩm{' '}
                  <span className="font-black text-slate-950">{selectedProduct?.name}</span> (Mã: {selectedProduct?.sku}) không?
                </p>
                <p className="mt-2 text-sm text-red-500 font-medium">Hành động này không thể hoàn tác.</p>
                <div className="mt-8 flex justify-end gap-3">
                  <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50 transition">Hủy</button>
                  <button type="button" onClick={handleDelete} disabled={saving} className="rounded-xl bg-red-600 px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60">
                    {saving ? 'Đang xóa...' : 'Xóa sản phẩm'}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                {/* Body */}
                <div className="flex min-h-0 flex-1 divide-x divide-slate-100 overflow-hidden">

                  {/* CỘT 1: Ảnh sản phẩm */}
                  <div className="w-44 shrink-0 flex flex-col gap-2 overflow-y-auto p-4 bg-slate-50/60">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-1">Ảnh sản phẩm</p>
                    {/* Ảnh chính */}
                    <div className="relative">
                      {form.images[0] ? (
                        <div className="group relative">
                          <img src={form.images[0]} alt="Ảnh chính" className="w-full aspect-square object-cover rounded-xl border-2 border-cyan-400" />
                          <span className="absolute top-1 left-1 rounded-md bg-cyan-500 px-1.5 py-0.5 text-[10px] font-bold text-white">Chính</span>
                          {modalMode !== 'view' && (
                            <button type="button" onClick={() => setForm((c) => ({ ...c, images: c.images.filter((_, i) => i !== 0) }))} className="absolute top-1 right-1 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs">×</button>
                          )}
                        </div>
                      ) : modalMode !== 'view' && (
                        <label className="flex flex-col items-center justify-center w-full aspect-square rounded-xl border-2 border-dashed border-slate-300 bg-white cursor-pointer hover:border-cyan-400 transition">
                          <span className="text-2xl text-slate-300">+</span>
                          <span className="text-[10px] text-slate-400 mt-1">Ảnh chính</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const reader = new FileReader(); reader.onload = (ev) => { const url = ev.target?.result as string; setForm((c) => { const imgs = [...c.images]; imgs[0] = url; return { ...c, images: imgs }; }); }; reader.readAsDataURL(f); }} />
                        </label>
                      )}
                    </div>
                    {/* Ảnh phụ */}
                    {[1, 2, 3].map((idx) => (
                      <div key={idx} className="relative">
                        {form.images[idx] ? (
                          <div className="group relative">
                            <img src={form.images[idx]} alt={`Ảnh ${idx + 1}`} className="w-full aspect-square object-cover rounded-xl border border-slate-200" />
                            {modalMode !== 'view' && (
                              <button type="button" onClick={() => setForm((c) => ({ ...c, images: c.images.filter((_, i) => i !== idx) }))} className="absolute top-1 right-1 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs">×</button>
                            )}
                          </div>
                        ) : modalMode !== 'view' && (
                          <label className="flex flex-col items-center justify-center w-full aspect-square rounded-xl border border-dashed border-slate-200 bg-white cursor-pointer hover:border-cyan-400 transition">
                            <span className="text-xl text-slate-300">+</span>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const reader = new FileReader(); reader.onload = (ev) => { const url = ev.target?.result as string; setForm((c) => { const imgs = [...c.images]; while (imgs.length <= idx) imgs.push(''); imgs[idx] = url; return { ...c, images: imgs }; }); }; reader.readAsDataURL(f); }} />
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
                      <input value={form.sku} onChange={(e) => setForm((c) => ({ ...c, sku: e.target.value }))} readOnly={modalMode === 'view'} className="h-9 w-full rounded-lg border-2 border-slate-200 px-3 text-sm uppercase outline-none transition focus:border-cyan-500 read-only:bg-slate-50" placeholder="VD: SP001" required />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">Tên sản phẩm <span className="text-red-500">*</span></label>
                      <input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} readOnly={modalMode === 'view'} className="h-9 w-full rounded-lg border-2 border-slate-200 px-3 text-sm outline-none transition focus:border-cyan-500 read-only:bg-slate-50" placeholder="Nhập tên sản phẩm..." required />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">Danh mục</label>
                      <select value={form.category} onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))} disabled={modalMode === 'view' || productCategoryOptions.length === 0} className="h-9 w-full rounded-lg border-2 border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-cyan-500 disabled:bg-slate-50">
                        {productCategoryOptions.length === 0 ? <option value="">Chưa có danh mục</option> : <><option value="" disabled>-- Chọn danh mục --</option>{productCategoryOptions.map((cat) => <option key={cat.value} value={cat.value}>{cat.label}</option>)}</>}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">Giới thiệu</label>
                      <textarea value={form.supplier} onChange={(e) => setForm((c) => ({ ...c, supplier: e.target.value }))} readOnly={modalMode === 'view'} rows={5} className="w-full resize-none rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-cyan-500 read-only:bg-slate-50" placeholder="Mô tả ngắn về sản phẩm..." />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">Giá bán (₫) <span className="text-red-500">*</span></label>
                      <input type="number" min="0" value={form.price} onChange={(e) => setForm((c) => ({ ...c, price: e.target.value ? Number(e.target.value) : '' }))} readOnly={modalMode === 'view'} className="h-9 w-full rounded-lg border-2 border-slate-200 px-3 text-sm outline-none transition focus:border-cyan-500 read-only:bg-slate-50" placeholder="0" required />
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <input type="checkbox" id="isVisible" checked={form.isVisible} onChange={(e) => setForm(c => ({...c, isVisible: e.target.checked}))} disabled={modalMode === 'view'} className="h-4 w-4 rounded border-slate-300 accent-cyan-600 cursor-pointer" />
                      <label htmlFor="isVisible" className="text-xs font-bold text-slate-700 cursor-pointer leading-tight">Hiển thị sản phẩm ở trang bán hàng (Shop)</label>
                    </div>
                  </div>

                  {/* PHẢI: Ma trận kho × chỉ số */}
                  <div className="min-w-0 flex-1 overflow-y-auto p-6">
                    <p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-400">Phân bổ theo kho</p>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left font-bold text-slate-700 border-r border-slate-200 min-w-[160px]">Kho</th>
                            <th className="px-4 py-3 text-center font-bold text-slate-700 border-r border-slate-200 min-w-[110px]">Tồn kho</th>
                            <th className="px-4 py-3 text-center font-bold text-slate-700 border-r border-slate-200 min-w-[100px]">Đã bán</th>
                            <th className="px-4 py-3 text-center font-bold text-slate-700 border-r border-slate-200 min-w-[100px]">Nhập gần nhất (+)</th>
                            <th className="px-4 py-3 text-center font-bold text-slate-700 min-w-[100px]">Xuất gần nhất (−)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {warehouses.length === 0 ? (
                            <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">Chưa có kho nào được cấu hình.</td></tr>
                          ) : warehouses.map((wh) => {
                            const isDef = form.defaultWarehouse === wh.name;
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
                                    <input type="number" min="0" value={form.stock} onChange={(e) => setForm((c) => ({ ...c, stock: e.target.value ? Number(e.target.value) : '' }))} readOnly={modalMode === 'view'} className="w-full rounded-lg border-2 border-slate-200 px-2 py-1.5 text-center text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 read-only:border-transparent read-only:bg-transparent" placeholder="0" required />
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
                            <td className="border-r border-slate-200 px-4 py-2.5 text-center text-sm font-bold text-slate-700">{Number(form.stock) || 0}</td>
                            <td className="border-r border-slate-200 px-4 py-2.5 text-center text-sm font-bold text-slate-400">0</td>
                            <td className="border-r border-slate-200 px-4 py-2.5" />
                            <td className="px-4 py-2.5" />
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                  </div>
                </div>

                {/* Footer */}
                <div className="flex shrink-0 justify-end gap-3 border-t-2 border-slate-100 px-6 py-4">
                  <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition">
                    {modalMode === 'view' ? 'Đóng' : 'Hủy bỏ'}
                  </button>
                  {modalMode !== 'view' && (
                    <button type="submit" disabled={saving} className="rounded-xl bg-cyan-600 px-8 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60">
                      {saving ? 'Đang lưu...' : modalMode === 'create' ? 'Tạo sản phẩm' : 'Lưu thay đổi'}
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
