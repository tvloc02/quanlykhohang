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
  CheckCircle2,
  SlidersHorizontal,
  Columns,
  History,
  Plus,
  Warehouse as WarehouseIcon,
  Save,
  Building2,
  DollarSign,
  Workflow,
  Boxes,
  Globe,
  RefreshCw,
  ArrowRightLeft,
  ChevronDown,
  Check,
} from 'lucide-react';
import {
  getActiveItemGroupCategories,
  getStoredCatalogCategories,
} from '../../shared/utils/catalogCategories';
import { getStoredWarehouses } from '../../shared/utils/warehouseAssignments';
import { readStoredUnits, saveStoredUnits, UnitConversion } from './UnitsPage';

// Internal Toast component
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

// Reusable Searchable Select Component with rounded corners & search input
type SearchableOption = {
  value: string;
  label: string;
};

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Chọn...',
  disabled = false,
  className = '',
}: {
  value: string;
  onChange: (val: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter((o) =>
    o.label.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  return (
    <div ref={dropdownRef} className={`relative w-full ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border-2 border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:bg-slate-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown className={`h-4 w-4 text-slate-500 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-64 overflow-hidden rounded-xl border-2 border-slate-300 bg-white p-2 shadow-xl animate-in fade-in-50 zoom-in-95 flex flex-col">
          {/* Search Input on Top */}
          <div className="relative mb-1.5">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm..."
              autoFocus
              className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:bg-white transition"
            />
          </div>

          {/* Options list */}
          <div className="overflow-y-auto max-h-48 space-y-0.5 pr-0.5">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400 italic">Không tìm thấy kết quả</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-900'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
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
  warehouseStocks?: Record<string, number>;
  images: string[];
  isVisible: boolean;
};

type ConversionUnitItem = {
  id: string;
  unitName: string;
  conversionRate: number | '';
  price: number | '';
  barcode: string;
  importPrice?: number | '';
  wholesalePrice?: number | '';
  retailPrice?: number | '';
};

type ComboProductItem = {
  id: string;
  sku: string;
  name: string;
  quantity: number | '';
};

type ProductForm = {
  barcode: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  description: string;
  importPrice: number | '';
  wholesalePrice: number | '';
  retailPrice: number | '';
  trackSerial: boolean;
  bonusAmount: number | '';
  taxType: string;
  vatRate: number | '';
  
  hasConversionUnits: boolean;
  conversionUnits: ConversionUnitItem[];
  warehouseUnitStocks: Record<string, number | ''>;
  stock: number | '';
  warehouseStocks: Record<string, number | ''>;
  
  images: string[];
  isVisible: boolean;
  webTitle: string;
  webDescription: string;
  
  comboItems: ComboProductItem[];

  defaultWarehouse: string;
  location: string;
  managementType: string;
  supplier: string;
  price: number | '';
};

type ModalMode = 'create' | 'view' | 'edit' | 'delete' | null;

type ColumnKey =
  | 'stt'
  | 'image'
  | 'sku'
  | 'name'
  | 'category'
  | 'unit'
  | 'price'
  | 'stock'
  | 'isVisible'
  | 'actions';

interface ColumnConfig {
  key: ColumnKey;
  label: string;
  visible: boolean;
}

const API_BASE_URL = 'http://localhost:3000/api';
const PRODUCT_STORAGE_KEY = 'smart-wms-products';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function buildEmptyForm(warehousesList: any[] = []): ProductForm {
  const initialWarehouseStocks: Record<string, number | ''> = {};
  warehousesList.forEach((wh) => {
    const key = wh.name || wh.code || wh.id;
    if (key) initialWarehouseStocks[key] = 0;
  });

  const defaultWhName = warehousesList.find((w) => w.isDefault)?.name || warehousesList[0]?.name || 'Kho Thanh Trì';

  return {
    barcode: '',
    sku: '',
    name: '',
    category: '',
    unit: 'Cái',
    description: '',
    importPrice: '',
    wholesalePrice: '',
    retailPrice: '',
    trackSerial: false,
    bonusAmount: '',
    taxType: 'RA',
    vatRate: 10,

    hasConversionUnits: false,
    conversionUnits: [],
    warehouseUnitStocks: {},
    stock: 0,
    warehouseStocks: initialWarehouseStocks,

    images: [],
    isVisible: true,
    webTitle: '',
    webDescription: '',

    comboItems: [],

    defaultWarehouse: defaultWhName,
    location: '',
    managementType: '',
    supplier: '',
    price: '',
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

function safeUUID(): string {
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
    try {
      return window.crypto.randomUUID();
    } catch {
      // fallback
    }
  }
  return 'id_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
}

function normalizeProduct(product: RawProduct): Product {
  const stockVal = Number(product.totalStock !== undefined ? product.totalStock : (product.stock || 0));
  return {
    id: product.id || safeUUID(),
    sku: product.internalSku || product.sku || '',
    name: product.name || '',
    category: normalizeCategory(product.category),
    unit: product.unit || '',
    defaultWarehouse: product.defaultWarehouse || '',
    location: product.location || '',
    managementType: product.managementType || '',
    supplier: normalizeSupplierField(product.supplier || ''),
    price: Number(product.price || 0),
    stock: stockVal,
    warehouseStocks: (product as any).warehouseStocks || {},
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
  const [activeTab, setActiveTab] = React.useState<'general' | 'combo' | 'web' | 'conversion'>('general');
  const [catalogCategories, setCatalogCategories] = React.useState(() => getStoredCatalogCategories());
  const [warehouses, setWarehouses] = React.useState(() => getStoredWarehouses());

  // Column Configuration state
  const [columnsConfig, setColumnsConfig] = React.useState<ColumnConfig[]>([
    { key: 'stt', label: 'STT', visible: true },
    { key: 'image', label: 'Ảnh', visible: true },
    { key: 'sku', label: 'Mã hàng hóa', visible: true },
    { key: 'name', label: 'Tên hàng hóa', visible: true },
    { key: 'category', label: 'Danh mục', visible: true },
    { key: 'unit', label: 'ĐV Tính', visible: true },
    { key: 'price', label: 'Giá', visible: true },
    { key: 'stock', label: 'Tồn kho', visible: true },
    { key: 'isVisible', label: 'Hiện trên Shop', visible: true },
    { key: 'actions', label: 'Thao tác', visible: true },
  ]);
  const [showColumnConfigModal, setShowColumnConfigModal] = React.useState(false);

  // Advanced search state
  const [showAdvancedSearch, setShowAdvancedSearch] = React.useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = React.useState<string>('ALL');
  const [selectedStockFilter, setSelectedStockFilter] = React.useState<string>('ALL');
  const [filterMinPrice, setFilterMinPrice] = React.useState<string>('');
  const [filterMaxPrice, setFilterMaxPrice] = React.useState<string>('');

  // History modal state
  const [historyModalOpen, setHistoryModalOpen] = React.useState(false);
  const [historyProduct, setHistoryProduct] = React.useState<Product | null>(null);

  // Quick Add Unit Modal state
  const [showQuickAddUnitModal, setShowQuickAddUnitModal] = React.useState(false);
  const [quickUnitName, setQuickUnitName] = React.useState('');
  const [quickUnitDesc, setQuickUnitDesc] = React.useState('');

  const handleSaveQuickUnit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickUnitName.trim();
    if (!trimmed) {
      setError('Vui lòng nhập tên đơn vị tính.');
      return;
    }
    const existing = readStoredUnits();
    const newUnit: UnitConversion = {
      id: `unit_${Date.now()}`,
      convertedUnit: trimmed,
      quantity: 1,
      status: 'active',
      description: quickUnitDesc.trim(),
      createdAt: new Date().toISOString(),
    };
    saveStoredUnits([newUnit, ...existing]);
    setForm((c) => ({ ...c, unit: trimmed }));
    setSuccess(`Đã thêm mới và chọn đơn vị tính "${trimmed}".`);
    setShowQuickAddUnitModal(false);
    setQuickUnitName('');
    setQuickUnitDesc('');
  };

  // Pagination states
  const [pageSize, setPageSize] = React.useState(20);
  const [currentPage, setCurrentPage] = React.useState(1);

  const openHistoryModal = (product: Product) => {
    setHistoryProduct(product);
    setHistoryModalOpen(true);
  };

  const isColVisible = (key: ColumnKey) => {
    const col = columnsConfig.find((c) => c.key === key);
    return col ? col.visible : true;
  };

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/products`, { headers: authHeaders() });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không tải được danh sách hàng hóa');
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

  // Reset trang khi filter thay doi
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, showAdvancedSearch, selectedCategoryFilter, selectedStockFilter, filterMinPrice, filterMaxPrice]);

  const filteredProducts = products.filter((product) => {
    const keyword = search.trim().toLowerCase();
    const matchesKeyword =
      !keyword ||
      product.name.toLowerCase().includes(keyword) ||
      product.sku.toLowerCase().includes(keyword) ||
      product.category.toLowerCase().includes(keyword);

    if (!matchesKeyword) return false;

    if (showAdvancedSearch) {
      if (selectedCategoryFilter !== 'ALL' && product.category !== selectedCategoryFilter) {
        return false;
      }
      if (selectedStockFilter === 'IN_STOCK' && product.stock <= 0) return false;
      if (selectedStockFilter === 'OUT_OF_STOCK' && product.stock > 0) return false;
      if (selectedStockFilter === 'LOW_STOCK' && (product.stock <= 0 || product.stock > 10)) return false;

      if (filterMinPrice.trim()) {
        const minP = Number(filterMinPrice);
        if (!isNaN(minP) && product.price < minP) return false;
      }
      if (filterMaxPrice.trim()) {
        const maxP = Number(filterMaxPrice);
        if (!isNaN(maxP) && product.price > maxP) return false;
      }
    }

    return true;
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
  const storedUnits = readStoredUnits();
  const rawUnitOptionsList = [
    ...unitOptions.map((unit) => ({ value: unit.name, label: unit.code ? `${unit.code} - ${unit.name}` : unit.name })),
    ...storedUnits.map((u) => ({ value: u.convertedUnit, label: u.convertedUnit })),
    { value: 'Cái', label: 'Cái' },
    { value: 'Hộp', label: 'Hộp' },
    { value: 'Bộ', label: 'Bộ' },
    { value: 'Kg', label: 'Kg' },
    { value: 'Bao', label: 'Bao' },
    { value: 'Thùng', label: 'Thùng' },
    { value: 'Lốc', label: 'Lốc' },
    { value: '123', label: '123' },
  ];
  const unitMap = new Map<string, { value: string; label: string }>();
  rawUnitOptionsList.forEach((u) => {
    if (u.value && !unitMap.has(u.value)) {
      unitMap.set(u.value, u);
    }
  });
  if (form.unit && !unitMap.has(form.unit)) {
    unitMap.set(form.unit, { value: form.unit, label: form.unit });
  }
  const productUnitOptions = Array.from(unitMap.values());
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
    setActiveTab('general');
    setForm({
      ...buildEmptyForm(warehouses),
      category: categoryOptions[0]?.name || '',
      unit: unitOptions[0]?.name || 'Cái',
      managementType: managementTypeOptions[0]?.name || '',
      defaultWarehouse: warehouses.find((w: any) => w.isDefault)?.name || warehouses[0]?.name || 'Kho Thanh Trì',
      location: locationOptions[0]?.name || '',
    });
    setModalMode('create');
  };

  const openProductModal = (mode: Exclude<ModalMode, 'create' | null>, product: Product) => {
    setError('');
    setSuccess('');
    setSelectedProduct(product);
    setActiveTab('general');

    const existingStocks: Record<string, number | ''> = {};
    warehouses.forEach((wh) => {
      const key = wh.name || wh.code || wh.id;
      if (key) {
        if (product.warehouseStocks && product.warehouseStocks[key] !== undefined) {
          existingStocks[key] = product.warehouseStocks[key];
        } else {
          existingStocks[key] = product.stock || 0;
        }
      }
    });

    const existingConversionUnits = (product as any).conversionUnits || [];

    setForm({
      barcode: (product as any).barcode || (product as any).supplierBarcode || '',
      sku: product.sku,
      name: product.name,
      category: product.category,
      unit: product.unit || 'Cái',
      description: (product as any).description || product.supplier || '',
      importPrice: (product as any).importPrice ?? '',
      wholesalePrice: (product as any).wholesalePrice ?? '',
      retailPrice: (product as any).retailPrice || product.price || '',
      trackSerial: !!(product as any).trackSerial,
      bonusAmount: (product as any).bonusAmount ?? '',
      taxType: (product as any).taxType || 'RA',
      vatRate: (product as any).vatRate ?? 10,
      hasConversionUnits: existingConversionUnits.length > 0,
      conversionUnits: existingConversionUnits,
      warehouseUnitStocks: (product as any).warehouseUnitStocks || {},
      stock: product.stock,
      warehouseStocks: existingStocks,
      images: product.images || [],
      isVisible: product.isVisible || false,
      webTitle: (product as any).webTitle || '',
      webDescription: (product as any).webDescription || '',
      comboItems: (product as any).comboItems || [],
      defaultWarehouse: product.defaultWarehouse || warehouses[0]?.name || 'Kho Thanh Trì',
      location: product.location || '',
      managementType: product.managementType || '',
      supplier: product.supplier || '',
      price: product.price || 0,
    });
    setModalMode(mode);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    // Auto generate SKU if empty!
    let finalSku = form.sku.trim().toUpperCase();
    if (!finalSku) {
      finalSku = 'HH' + Math.floor(100000 + Math.random() * 900000);
    }

    const priceToUse = form.retailPrice !== '' ? Number(form.retailPrice) : (form.price !== '' ? Number(form.price) : 0);

    if (!form.name.trim()) {
      setError('Vui lòng nhập Tên hàng hóa.');
      return;
    }

    if (categoryOptions.length === 0) {
      setError('Vui lòng tạo danh mục loại "Nhóm hàng vật tư hàng hóa" trước khi thêm hàng hóa.');
      return;
    }

    if (!form.category) {
      setError('Vui lòng chọn Danh mục cho hàng hóa.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const isEdit = modalMode === 'edit';
      const url = isEdit && selectedProduct ? `${API_BASE_URL}/products/${selectedProduct.id}` : `${API_BASE_URL}/products`;
      
      const foundCategory = categoryOptions.find(c => c.name === form.category);
      let calculatedTotalStock = 0;
      warehouses.forEach((wh) => {
        const whKey = wh.name || wh.code || wh.id;
        const baseQ = Number(form.warehouseStocks[whKey]) || 0;
        let unitQ = 0;
        if (form.hasConversionUnits && form.conversionUnits.length > 0) {
          form.conversionUnits.forEach((u) => {
            const q = Number(form.warehouseUnitStocks[`${whKey}_${u.id}`]) || 0;
            const rate = Number(u.conversionRate) || 1;
            unitQ += q * rate;
          });
        }
        calculatedTotalStock += baseQ + unitQ;
      });

      const payload = {
        internalSku: finalSku,
        sku: finalSku,
        supplierBarcode: form.barcode.trim(),
        barcode: form.barcode.trim(),
        name: form.name.trim(),
        categoryId: foundCategory ? foundCategory.id : undefined,
        category: form.category.trim(),
        unit: form.unit.trim(),
        description: form.description.trim(),
        importPrice: form.importPrice !== '' ? Number(form.importPrice) : undefined,
        wholesalePrice: form.wholesalePrice !== '' ? Number(form.wholesalePrice) : undefined,
        retailPrice: priceToUse,
        price: priceToUse,
        trackSerial: form.trackSerial,
        bonusAmount: form.bonusAmount !== '' ? Number(form.bonusAmount) : undefined,
        taxType: form.taxType,
        vatRate: form.vatRate !== '' ? Number(form.vatRate) : undefined,
        defaultWarehouse: form.defaultWarehouse.trim(),
        location: form.location.trim(),
        managementType: form.managementType.trim(),
        supplier: form.supplier.trim() || form.description.trim(),
        stock: calculatedTotalStock,
        warehouseStocks: form.warehouseStocks,
        warehouseUnitStocks: form.warehouseUnitStocks,
        hasConversionUnits: form.hasConversionUnits,
        conversionUnits: form.hasConversionUnits ? form.conversionUnits : [],
        images: form.images.filter(Boolean),
        isVisible: form.isVisible,
        webTitle: form.webTitle,
        comboItems: form.comboItems,
      };

      const response = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không thể lưu hàng hóa. Vui lòng kiểm tra lại thông tin (có thể trùng mã hàng hóa).');
      }

      setSuccess(isEdit ? 'Đã cập nhật hàng hóa.' : 'Đã thêm hàng hóa mới.');
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
        throw new Error(data?.message || 'Không thể xóa hàng hóa. Có thể do hàng hóa đang có dữ liệu liên quan.');
      }

      setSuccess('Đã xóa hàng hóa thành công.');
      closeModal();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi hệ thống khi xóa hàng hóa');
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  const modalTitle =
    modalMode === 'create'
      ? 'Thêm hàng hóa'
      : modalMode === 'view'
        ? 'Chi tiết hàng hóa'
        : modalMode === 'edit'
          ? 'Sửa hàng hóa'
          : 'Xóa hàng hóa';

  const visibleColCount = columnsConfig.filter(c => c.visible).length + 1;

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

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-md">
            <Package className="h-5 w-5 text-cyan-100" />
            <h1 className="text-lg font-bold tracking-tight text-white">Quản lý hàng hóa</h1>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700"
        >
          <PlusCircle className="h-4 w-4" />
          Thêm hàng hóa
        </button>
      </div>

      {/* 4 Button tổng hợp */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
          <p className="text-base font-black text-cyan-700 uppercase">
            {products.length} TỔNG HÀNG HÓA
          </p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
          <p className="text-base font-black text-cyan-700 uppercase">
            {products.reduce((sum, p) => sum + (p.stock || 0), 0).toLocaleString('vi-VN')} TỔNG SỐ LƯỢNG HÀNG HÓA
          </p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
          <p className="text-base font-black text-cyan-700 uppercase">
            {products.filter((p) => (p.stock || 0) > 0).reduce((sum, p) => sum + (p.stock || 0), 0).toLocaleString('vi-VN')} SL MỚI NHẬP KHO
          </p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
          <p className="text-base font-black text-cyan-700 uppercase">
            {products.filter((p) => (p.stock || 0) === 0).length} SL VỪA XUẤT BÁN
          </p>
        </div>
      </div>

      {/* Search & Toolbar */}
      <div className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white pl-11 pr-4 text-base outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
              placeholder="Tìm kiếm hàng hóa theo tên, SKU, danh mục..."
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAdvancedSearch((prev) => !prev)}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 px-4 text-sm font-bold transition ${
                showAdvancedSearch
                  ? 'border-cyan-600 bg-cyan-50 text-cyan-700'
                  : 'border-cyan-600 bg-white text-cyan-600 hover:bg-cyan-50'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Tìm kiếm nâng cao
            </button>

            <button
              type="button"
              onClick={() => setShowColumnConfigModal(true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-cyan-600 bg-white px-4 text-sm font-bold text-cyan-600 transition hover:bg-cyan-50"
            >
              <Columns className="h-4 w-4" />
              Cấu hình hiển thị
            </button>
          </div>
        </div>

        {/* Panel Tìm kiếm nâng cao */}
        {showAdvancedSearch && (
          <div className="rounded-2xl border-2 border-cyan-100 bg-cyan-50/40 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-cyan-800">Bộ lọc nâng cao</h3>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryFilter('ALL');
                  setSelectedStockFilter('ALL');
                  setFilterMinPrice('');
                  setFilterMaxPrice('');
                }}
                className="text-xs font-bold text-slate-500 hover:text-cyan-700 hover:underline"
              >
                Xóa bộ lọc
              </button>
            </div>

            {/* Danh mục - mỗi mục là một button */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">Danh mục hàng hóa</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter('ALL')}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition border ${
                    selectedCategoryFilter === 'ALL'
                      ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-cyan-300 hover:bg-cyan-50/50'
                  }`}
                >
                  Tất cả danh mục
                </button>
                {categoryOptions.map((cat) => (
                  <button
                    key={cat.id || cat.name}
                    type="button"
                    onClick={() => setSelectedCategoryFilter(cat.name)}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition border ${
                      selectedCategoryFilter === cat.name
                        ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-cyan-300 hover:bg-cyan-50/50'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Trạng thái tồn kho - mỗi mục là một button */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">Trạng thái tồn kho</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'ALL', label: 'Tất cả trạng thái' },
                  { key: 'IN_STOCK', label: 'Còn hàng (>0)' },
                  { key: 'LOW_STOCK', label: 'Tồn kho thấp (1 - 10)' },
                  { key: 'OUT_OF_STOCK', label: 'Hết hàng (0)' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSelectedStockFilter(item.key)}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition border ${
                      selectedStockFilter === item.key
                        ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-cyan-300 hover:bg-cyan-50/50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Khoảng giá */}
            <div className="w-full sm:w-72">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">Khoảng giá bán (₫)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={filterMinPrice}
                  onChange={(e) => setFilterMinPrice(e.target.value)}
                  className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-cyan-500"
                  placeholder="Từ giá..."
                />
                <span className="text-slate-400 font-bold">-</span>
                <input
                  type="number"
                  min={0}
                  value={filterMaxPrice}
                  onChange={(e) => setFilterMaxPrice(e.target.value)}
                  className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-cyan-500"
                  placeholder="Đến giá..."
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table Section */}
      <div className="mt-5 overflow-hidden rounded-xl border-2 border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse bg-white">
            <thead className="bg-cyan-50">
              <tr className="border-b-2 border-slate-200">
                <th className="w-10 border-x border-slate-200 px-3 py-4 text-center">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-cyan-600" />
                </th>
                {isColVisible('stt') && (
                  <th className="w-12 border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">STT</th>
                )}
                {isColVisible('image') && (
                  <th className="w-20 border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Ảnh</th>
                )}
                {isColVisible('sku') && (
                  <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Mã hàng hóa</th>
                )}
                {isColVisible('name') && (
                  <th className="min-w-[200px] border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Tên hàng hóa</th>
                )}
                {isColVisible('category') && (
                  <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Danh mục</th>
                )}
                {isColVisible('unit') && (
                  <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">ĐV Tính</th>
                )}
                {isColVisible('price') && (
                  <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Giá</th>
                )}
                {isColVisible('stock') && (
                  <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Tồn kho</th>
                )}
                {isColVisible('isVisible') && (
                  <th className="w-28 border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 leading-tight">Hiện trên Shop</th>
                )}
                {isColVisible('actions') && (
                  <th className="sticky right-0 border-l border-slate-200 bg-cyan-50 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 shadow-[-4px_0_12px_rgba(0,0,0,0.03)] min-w-[200px]">
                    THAO TÁC
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={visibleColCount} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Đang tải dữ liệu hàng hóa...
                  </td>
                </tr>
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={visibleColCount} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Chưa có hàng hóa phù hợp.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product, index) => (
                  <tr key={product.id} className="group border-b border-slate-200 transition hover:bg-cyan-50/50">
                    <td className="border-x border-slate-200 px-3 py-3 text-center">
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-cyan-600" />
                    </td>

                    {isColVisible('stt') && (
                      <td className="border-x border-slate-200 px-3 py-3 text-center text-sm text-slate-700 font-semibold">
                        {startIndex + index}
                      </td>
                    )}

                    {isColVisible('image') && (
                      <td className="border-x border-slate-200 px-2 py-2 text-center">
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt={product.name} className="mx-auto h-12 w-12 rounded-lg object-cover border border-slate-200" />
                        ) : (
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-300">
                            <Package className="h-6 w-6 text-slate-300" />
                          </div>
                        )}
                      </td>
                    )}

                    {isColVisible('sku') && (
                      <td className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold text-slate-700">
                        {product.sku}
                      </td>
                    )}

                    {isColVisible('name') && (
                      <td className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold text-slate-700">
                        {product.name}
                      </td>
                    )}

                    {isColVisible('category') && (
                      <td className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold text-slate-700">
                        {product.category || '-'}
                      </td>
                    )}

                    {isColVisible('unit') && (
                      <td className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold text-slate-700">
                        {product.unit || '-'}
                      </td>
                    )}

                    {isColVisible('price') && (
                      <td className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold text-slate-700">
                        {product.price.toLocaleString('vi-VN')} ₫
                      </td>
                    )}

                    {isColVisible('stock') && (
                      <td className="border-x border-slate-200 px-3 py-3 text-center align-middle">
                        <span className="inline-flex rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">
                          {product.stock}
                        </span>
                      </td>
                    )}

                    {isColVisible('isVisible') && (
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
                    )}

                    {isColVisible('actions') && (
                      <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-3 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50"
                            title="Thêm mới / Chi tiết"
                            onClick={() => openProductModal('view', product)}
                          >
                            <Plus size={18} strokeWidth={2.5} />
                          </button>
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50"
                            title="Lịch sử đơn hàng"
                            onClick={() => openHistoryModal(product)}
                          >
                            <History size={18} strokeWidth={2.5} />
                          </button>
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50"
                            title="Sửa hàng hóa"
                            onClick={() => openProductModal('edit', product)}
                          >
                            <Pencil size={18} strokeWidth={2.5} />
                          </button>
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50"
                            title="Xóa hàng hóa"
                            onClick={() => openProductModal('delete', product)}
                          >
                            <Trash2 size={18} strokeWidth={2.5} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
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

      {/* Cấu hình hiển thị cột Popup Modal */}
      {showColumnConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-[540px] max-w-[95vw] rounded-2xl border border-slate-100 bg-white shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b-2 border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600">
                  <Columns className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">Cấu hình hiển thị cột</h3>
                  <p className="text-xs font-medium text-slate-500">Tích chọn các mục/cột muốn hiển thị trên bảng hàng hóa</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowColumnConfigModal(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Hiển thị: ({columnsConfig.filter(c => c.visible).length}/{columnsConfig.length} cột)
                </span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setColumnsConfig(cols => cols.map(c => ({ ...c, visible: true })))}
                    className="text-xs font-bold text-cyan-600 hover:underline"
                  >
                    Chọn tất cả
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setColumnsConfig(cols => cols.map(c => ({ ...c, visible: c.key === 'name' || c.key === 'actions' })))}
                    className="text-xs font-bold text-slate-500 hover:underline"
                  >
                    Mặc định
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {columnsConfig.map((col) => (
                  <label
                    key={col.key}
                    className={`flex items-center gap-3 rounded-xl border-2 p-3 cursor-pointer transition ${
                      col.visible ? 'border-cyan-500 bg-cyan-50/30 text-slate-900 font-bold' : 'border-slate-200 bg-white text-slate-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={col.visible}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setColumnsConfig(cols => cols.map(c => c.key === col.key ? { ...c, visible: checked } : c));
                      }}
                      className="h-4 w-4 rounded border-slate-300 accent-cyan-600"
                    />
                    <span className="text-sm">{col.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t-2 border-slate-100 px-6 py-4 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowColumnConfigModal(false)}
                className="rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-cyan-700 transition"
              >
                Hoàn tất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lịch sử đơn hàng Modal */}
      {historyModalOpen && historyProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-[680px] max-w-[95vw] rounded-2xl border border-slate-100 bg-white shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b-2 border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600">
                  <History className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">Lịch sử đơn hàng</h3>
                  <p className="text-xs font-medium text-slate-500">
                    Hàng hóa: <span className="font-bold text-slate-900">{historyProduct.name}</span> (Mã: {historyProduct.sku})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setHistoryModalOpen(false);
                  setHistoryProduct(null);
                }}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-black uppercase text-slate-700">
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-3">Mã đơn hàng</th>
                      <th className="px-4 py-3">Nhà cung cấp</th>
                      <th className="px-4 py-3 text-center">Số lượng</th>
                      <th className="px-4 py-3 text-center">Đơn giá</th>
                      <th className="px-4 py-3 text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-cyan-600">PO-2026-001</td>
                      <td className="px-4 py-3 text-slate-700">{historyProduct.supplier || 'Nhà cung cấp chính'}</td>
                      <td className="px-4 py-3 text-center font-bold text-slate-800">{historyProduct.stock || 100}</td>
                      <td className="px-4 py-3 text-center text-slate-700">{historyProduct.price.toLocaleString('vi-VN')} ₫</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600 border border-emerald-200">
                          Đã hoàn thành
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end border-t-2 border-slate-100 px-6 py-4 bg-slate-50">
              <button
                type="button"
                onClick={() => {
                  setHistoryModalOpen(false);
                  setHistoryProduct(null);
                }}
                className="rounded-xl border-2 border-slate-200 px-6 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main CRUD Modals */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 backdrop-blur-sm">
          <div className="flex w-full max-w-[96vw] flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border-2 border-slate-200" style={{ height: '92vh' }}>
            {/* Modal Header Strip - Matching CreateStockInOrderPage style */}
            <div className="flex shrink-0 items-center justify-between border-b-2 border-slate-200 bg-slate-50 px-6 py-3.5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-3.5 py-1.5 text-white shadow-md">
                  <Package className="h-4 w-4 text-cyan-100" />
                  <h2 className="text-sm font-bold tracking-tight text-white uppercase">{modalTitle}</h2>
                </div>
                <p className="text-xs font-semibold text-slate-500 hidden sm:block">
                  {modalMode === 'view'
                    ? 'Thông tin chi tiết hàng hóa và tồn kho thực tế từng vị trí'
                    : 'Khai báo thông tin chi tiết hàng hóa và nhập số lượng tồn kho ban đầu cho từng kho'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border-2 border-slate-200 bg-white p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {modalMode === 'delete' ? (
              <div className="p-8 space-y-6">
                <div className="rounded-xl border-2 border-red-200 bg-red-50/50 p-5 space-y-2">
                  <p className="text-base text-slate-800">
                    Bạn có chắc chắn muốn xóa hàng hóa{' '}
                    <span className="font-black text-red-700">{selectedProduct?.name}</span> (Mã SKU: <span className="font-bold">{selectedProduct?.sku}</span>) khỏi hệ thống?
                  </p>
                  <p className="text-xs text-red-600 font-semibold">Cảnh báo: Hành động này không thể hoàn tác và sẽ ảnh hưởng tới dữ liệu tồn kho liên quan.</p>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-xl border-2 border-slate-200 bg-white px-6 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className="rounded-xl border-2 border-red-600 bg-red-600 px-7 py-2.5 text-xs font-bold text-white shadow-md hover:bg-red-700 transition disabled:opacity-60 cursor-pointer"
                  >
                    {saving ? 'Đang xóa...' : 'Xóa hàng hóa'}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {/* MODAL NAVIGATION TABS BAR */}
                <div className="flex items-center gap-1 border-b-2 border-slate-200 bg-slate-100/70 px-6 pt-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab('general')}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${
                      activeTab === 'general'
                        ? 'border-cyan-600 text-cyan-700 bg-white shadow-sm rounded-t-xl'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-t-xl'
                    }`}
                  >
                    <Package className="h-4 w-4 text-cyan-600" />
                    <span>Thông tin chung</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('combo')}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${
                      activeTab === 'combo'
                        ? 'border-cyan-600 text-cyan-700 bg-white shadow-sm rounded-t-xl'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-t-xl'
                    }`}
                  >
                    <Boxes className="h-4 w-4 text-cyan-600" />
                    <span>Bộ sản phẩm / Combo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('web')}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${
                      activeTab === 'web'
                        ? 'border-cyan-600 text-cyan-700 bg-white shadow-sm rounded-t-xl'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-t-xl'
                    }`}
                  >
                    <Globe className="h-4 w-4 text-cyan-600" />
                    <span>Thông tin đăng web</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('conversion')}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${
                      activeTab === 'conversion'
                        ? 'border-cyan-600 text-cyan-700 bg-white shadow-sm rounded-t-xl'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-t-xl'
                    }`}
                  >
                    <RefreshCw className="h-4 w-4 text-cyan-600" />
                    <span>Đơn vị quy đổi</span>
                  </button>
                </div>

                {/* TAB CONTENT AREA */}
                <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 bg-slate-50/60">

                  {/* TAB 1: THÔNG TIN CHUNG */}
                  {activeTab === 'general' && (
                    <>
                      {/* Top Card: Basic Information & Photo Gallery */}
                      <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3 text-slate-800 font-bold text-xs uppercase tracking-wider">
                          <div className="flex items-center gap-2 text-cyan-700">
                            <Package className="h-4 w-4 text-cyan-600" />
                            <span>THÔNG TIN CHI TIẾT HÀNG HÓA</span>
                          </div>
                          <span className="text-[11px] font-semibold text-slate-400">Các trường đánh dấu (*) là bắt buộc</span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                          {/* Left Column: Product Images (3 cols) */}
                          <div className="lg:col-span-3 space-y-3 border-r-2 border-slate-100 pr-4">
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Hình ảnh hàng hóa</label>
                            <div className="grid grid-cols-2 gap-2">
                              {/* Main Image */}
                              <div className="col-span-2 relative aspect-square rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 overflow-hidden flex items-center justify-center group shadow-inner">
                                {form.images[0] ? (
                                  <>
                                    <img src={form.images[0]} alt="Ảnh chính" className="w-full h-full object-cover" />
                                    <span className="absolute top-2 left-2 rounded-md bg-cyan-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">Ảnh chính</span>
                                    {modalMode !== 'view' && (
                                      <button
                                        type="button"
                                        onClick={() => setForm((c) => ({ ...c, images: c.images.filter((_, i) => i !== 0) }))}
                                        className="absolute top-2 right-2 h-6 w-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </>
                                ) : modalMode !== 'view' ? (
                                  <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-cyan-50/50 transition">
                                    <Plus className="h-7 w-7 text-slate-400" />
                                    <span className="text-xs font-bold text-slate-600 mt-1">Tải ảnh chính</span>
                                    <span className="text-[10px] text-slate-400">JPG, PNG, WEBP</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (!f) return;
                                        const reader = new FileReader();
                                        reader.onload = (ev) => {
                                          const url = ev.target?.result as string;
                                          setForm((c) => {
                                            const imgs = [...c.images];
                                            imgs[0] = url;
                                            return { ...c, images: imgs };
                                          });
                                        };
                                        reader.readAsDataURL(f);
                                      }}
                                    />
                                  </label>
                                ) : (
                                  <span className="text-xs text-slate-400">Chưa có ảnh</span>
                                )}
                              </div>

                              {/* Sub Images */}
                              {[1, 2].map((idx) => (
                                <div key={idx} className="relative aspect-square rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center group">
                                  {form.images[idx] ? (
                                    <>
                                      <img src={form.images[idx]} alt={`Sub ${idx}`} className="w-full h-full object-cover" />
                                      {modalMode !== 'view' && (
                                        <button
                                          type="button"
                                          onClick={() => setForm((c) => ({ ...c, images: c.images.filter((_, i) => i !== idx) }))}
                                          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow"
                                        >
                                          ×
                                        </button>
                                      )}
                                    </>
                                  ) : modalMode !== 'view' ? (
                                    <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-cyan-50/50 transition">
                                      <Plus className="h-5 w-5 text-slate-400" />
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          const f = e.target.files?.[0];
                                          if (!f) return;
                                          const reader = new FileReader();
                                          reader.onload = (ev) => {
                                            const url = ev.target?.result as string;
                                            setForm((c) => {
                                              const imgs = [...c.images];
                                              while (imgs.length <= idx) imgs.push('');
                                              imgs[idx] = url;
                                              return { ...c, images: imgs };
                                            });
                                          };
                                          reader.readAsDataURL(f);
                                        }}
                                      />
                                    </label>
                                  ) : (
                                    <span className="text-[10px] text-slate-300">Trống</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Right Column: Form Inputs Grid (9 cols) */}
                          <div className="lg:col-span-9 space-y-4">
                            {/* Row 1: Nhóm, Mã vạch, Mã */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              {/* Nhóm hàng hóa (Category) */}
                              <div>
                                <label className="mb-1.5 block text-xs font-bold text-slate-700 uppercase">
                                  Nhóm hàng hóa <span className="text-red-500">*</span>
                                </label>
                                <SearchableSelect
                                  options={productCategoryOptions}
                                  value={form.category}
                                  onChange={(val) => setForm((c) => ({ ...c, category: val }))}
                                  placeholder="Chọn nhóm hàng hóa..."
                                  disabled={modalMode === 'view'}
                                />
                              </div>

                              {/* Mã vạch */}
                              <div>
                                <label className="mb-1.5 block text-xs font-bold text-slate-700 uppercase">Mã vạch</label>
                                <input
                                  type="text"
                                  value={form.barcode}
                                  onChange={(e) => setForm((c) => ({ ...c, barcode: e.target.value }))}
                                  readOnly={modalMode === 'view'}
                                  placeholder="Nhập hoặc quét mã vạch..."
                                  className="h-10 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 read-only:bg-slate-50"
                                />
                              </div>

                              {/* Mã hàng hóa */}
                              <div>
                                <label className="mb-1.5 block text-xs font-bold text-slate-700 uppercase">
                                  Mã hàng hóa
                                </label>
                                <input
                                  type="text"
                                  value={form.sku}
                                  onChange={(e) => setForm((c) => ({ ...c, sku: e.target.value }))}
                                  readOnly={modalMode === 'view'}
                                  placeholder="Mã tự động tạo nếu để trống"
                                  className="h-10 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-xs font-bold uppercase text-cyan-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 read-only:bg-slate-50"
                                />
                              </div>
                            </div>

                            {/* Row 2: Tên hàng hóa, Đơn vị tính */}
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                              {/* Tên hàng hóa (8 cols) */}
                              <div className="sm:col-span-8">
                                <label className="mb-1.5 block text-xs font-bold text-slate-700 uppercase">
                                  Tên hàng hóa <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={form.name}
                                  onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                                  readOnly={modalMode === 'view'}
                                  placeholder="Nhập tên hàng hóa chi tiết..."
                                  className="h-10 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 read-only:bg-slate-50"
                                  required
                                />
                              </div>

                              {/* Đơn vị tính (4 cols) */}
                              <div className="sm:col-span-4">
                                <label className="mb-1.5 block text-xs font-bold text-slate-700 uppercase">Đơn vị tính</label>
                                <div className="flex items-center gap-1.5">
                                  <SearchableSelect
                                    options={productUnitOptions}
                                    value={form.unit}
                                    onChange={(val) => setForm((c) => ({ ...c, unit: val }))}
                                    placeholder="Chọn đơn vị..."
                                    disabled={modalMode === 'view'}
                                    className="flex-1"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setQuickUnitName('');
                                      setQuickUnitDesc('');
                                      setShowQuickAddUnitModal(true);
                                    }}
                                    className="h-10 w-10 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition shadow-sm flex items-center justify-center cursor-pointer text-lg shrink-0"
                                    title="Thêm nhanh đơn vị tính"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Row 3: Prices (Giá nhập, Giá bán buôn, Giá bán lẻ) */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              {/* Giá nhập */}
                              <div>
                                <label className="mb-1.5 block text-xs font-bold text-slate-700 uppercase">Giá nhập (₫)</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={form.importPrice}
                                  onChange={(e) => setForm((c) => ({ ...c, importPrice: e.target.value ? Number(e.target.value) : '' }))}
                                  readOnly={modalMode === 'view'}
                                  placeholder="0"
                                  className="h-10 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 read-only:bg-slate-50"
                                />
                              </div>

                              {/* Giá bán buôn */}
                              <div>
                                <label className="mb-1.5 block text-xs font-bold text-slate-700 uppercase">Giá bán buôn (₫)</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={form.wholesalePrice}
                                  onChange={(e) => setForm((c) => ({ ...c, wholesalePrice: e.target.value ? Number(e.target.value) : '' }))}
                                  readOnly={modalMode === 'view'}
                                  placeholder="0"
                                  className="h-10 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 read-only:bg-slate-50"
                                />
                              </div>

                              {/* Giá bán lẻ (Giá bán) */}
                              <div>
                                <label className="mb-1.5 block text-xs font-bold text-slate-700 uppercase">
                                  Giá bán lẻ (₫) <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={form.retailPrice !== '' ? form.retailPrice : form.price}
                                  onChange={(e) => {
                                    const val = e.target.value ? Number(e.target.value) : '';
                                    setForm((c) => ({ ...c, retailPrice: val, price: val }));
                                  }}
                                  readOnly={modalMode === 'view'}
                                  placeholder="0"
                                  className="h-10 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-xs font-bold text-cyan-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 read-only:bg-slate-50"
                                  required
                                />
                              </div>
                            </div>

                            {/* Row 4: Financial Bonus & Tax Settings */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              {/* Tiền thưởng nhân viên */}
                              <div>
                                <label className="mb-1.5 block text-xs font-bold text-slate-700 uppercase">Tiền thưởng nhân viên (₫)</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={form.bonusAmount}
                                  onChange={(e) => setForm((c) => ({ ...c, bonusAmount: e.target.value ? Number(e.target.value) : '' }))}
                                  readOnly={modalMode === 'view'}
                                  placeholder="0"
                                  className="h-10 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 read-only:bg-slate-50"
                                />
                              </div>

                              {/* Loại thuế */}
                              <div>
                                <label className="mb-1.5 block text-xs font-bold text-slate-700 uppercase">Loại thuế</label>
                                <select
                                  value={form.taxType}
                                  onChange={(e) => setForm((c) => ({ ...c, taxType: e.target.value }))}
                                  disabled={modalMode === 'view'}
                                  className="h-10 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:bg-slate-50"
                                >
                                  <option value="RA">Thuế GTGT Đầu ra (10%)</option>
                                  <option value="VAO">Thuế GTGT Đầu vào</option>
                                  <option value="BOTH">Thuế Cả hai</option>
                                  <option value="NONE">Không chịu thuế</option>
                                </select>
                              </div>

                              {/* VAT */}
                              <div>
                                <label className="mb-1.5 block text-xs font-bold text-slate-700 uppercase">Thuế VAT (%)</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={form.vatRate}
                                  onChange={(e) => setForm((c) => ({ ...c, vatRate: e.target.value ? Number(e.target.value) : '' }))}
                                  readOnly={modalMode === 'view'}
                                  placeholder="10"
                                  className="h-10 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 read-only:bg-slate-50"
                                />
                              </div>
                            </div>

                            {/* Row 5: Mô tả */}
                            <div>
                              <label className="mb-1.5 block text-xs font-bold text-slate-700 uppercase">Mô tả / Ghi chú chi tiết</label>
                              <textarea
                                value={form.description}
                                onChange={(e) => setForm((c) => ({ ...c, description: e.target.value, supplier: e.target.value }))}
                                readOnly={modalMode === 'view'}
                                rows={2}
                                placeholder="Nhập mô tả chi tiết sản phẩm..."
                                className="w-full rounded-xl border-2 border-slate-300 bg-white p-3 text-xs font-medium text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 resize-none read-only:bg-slate-50"
                              />
                            </div>

                            {/* Section Đơn vị quy đổi Checkbox + Badge Pills (Nằm ngay dưới cột Mô tả, không dùng style xanh nữa) */}
                            <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-3.5 flex flex-wrap items-center justify-between gap-3">
                              <label className="inline-flex items-center gap-2.5 text-xs font-bold text-slate-800 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={form.hasConversionUnits}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setForm((c) => {
                                      let nextUnits = c.conversionUnits;
                                      if (checked && nextUnits.length === 0) {
                                        nextUnits = [
                                          { id: safeUUID(), unitName: 'Hộp', conversionRate: 10, price: '', barcode: '', importPrice: '', wholesalePrice: '', retailPrice: '' }
                                        ];
                                      }
                                      return { ...c, hasConversionUnits: checked, conversionUnits: nextUnits };
                                    });
                                  }}
                                  disabled={modalMode === 'view'}
                                  className="h-4 w-4 rounded border-slate-300 accent-cyan-600 cursor-pointer"
                                />
                                <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wide">Đơn vị quy đổi:</span>
                              </label>

                              {/* Dynamic Badge Pills for multiple conversion units */}
                              {form.hasConversionUnits && form.conversionUnits.length > 0 ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  {form.conversionUnits.map((u) => (
                                    <span key={u.id} className="inline-flex items-center gap-1 bg-cyan-700 text-white font-bold text-xs px-3 py-1 rounded-lg shadow-xs">
                                      <span>×</span>
                                      <span>{u.conversionRate || '10'}</span>
                                      <span className="font-medium opacity-90 text-[11px]">({u.unitName || 'Quy đổi'})</span>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">Tích chọn để thêm nhiều đơn vị quy đổi ở bảng bên dưới</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Card: Warehouse Stock Matrix */}
                      <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3">
                          <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                            <WarehouseIcon className="h-4 w-4 text-cyan-600" />
                            <span>SỐ LƯỢNG TỒN KHO THEO CÁC KHO ({warehouses.length} KHO)</span>
                          </div>
                          <div className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 bg-slate-100 px-4 py-1.5 rounded-xl border border-slate-200">
                            <span>TỔNG TỒN KHO TẤT CẢ CÁC KHO:</span>
                            <span className="text-sm font-black text-cyan-800">
                              {(Number(form.stock) || 0).toLocaleString('vi-VN')} {form.unit}
                            </span>
                          </div>
                        </div>

                        {/* Stock Allocation Table - Per-warehouse Multi-Unit Pricing & Stock Matrix */}
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-xs">
                              <tr>
                                <th className="p-3 w-10 text-center border-r border-slate-200">STT</th>
                                <th className="p-3 w-40 border-r border-slate-200">TÊN KHO HÀNG</th>
                                <th className="p-3 w-20 text-center border-r border-slate-200">MÃ KHO</th>
                                <th className="p-3 w-28 border-r border-slate-200">ĐƠN VỊ TÍNH</th>
                                <th className="p-3 w-28 text-center border-r border-slate-200 bg-slate-200/60 text-slate-800">
                                  TỒN KHO BAN ĐẦU
                                </th>
                                <th className="p-3 min-w-[130px] text-center border-r border-slate-200">GIÁ NHẬP (₫)</th>
                                <th className="p-3 min-w-[130px] text-center border-r border-slate-200">GIÁ BÁN BUÔN (₫)</th>
                                <th className="p-3 min-w-[130px] text-center border-r border-slate-200">GIÁ BÁN LẺ (₫)</th>
                                <th className="p-3 w-28 text-center bg-cyan-100/50 text-cyan-900">TỔNG QUY ĐỔI</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {warehouses.length === 0 ? (
                                <tr>
                                  <td colSpan={9} className="p-8 text-center text-slate-400 font-medium">
                                    Chưa có kho nào được cấu hình trong hệ thống.
                                  </td>
                                </tr>
                              ) : (
                                warehouses.map((wh, idx) => {
                                  const whKey = wh.name || wh.code || wh.id;
                                  const baseStockVal = form.warehouseStocks[whKey] ?? '';

                                  // Units list for this warehouse
                                  const warehouseUnits = [
                                    {
                                      id: 'base',
                                      unitName: form.unit || 'Cái',
                                      rate: 1,
                                      isBase: true,
                                      stockKey: whKey,
                                      importKey: `${whKey}_base_importPrice`,
                                      wholesaleKey: `${whKey}_base_wholesalePrice`,
                                      retailKey: `${whKey}_base_retailPrice`,
                                      stockVal: baseStockVal,
                                      importVal: form.warehouseUnitStocks[`${whKey}_base_importPrice`] ?? '',
                                      wholesaleVal: form.warehouseUnitStocks[`${whKey}_base_wholesalePrice`] ?? '',
                                      retailVal: form.warehouseUnitStocks[`${whKey}_base_retailPrice`] ?? '',
                                      defaultImport: form.importPrice,
                                      defaultWholesale: form.wholesalePrice,
                                      defaultRetail: form.retailPrice || form.price,
                                    },
                                    ...(form.hasConversionUnits
                                      ? form.conversionUnits.map((u) => {
                                          const uStockKey = `${whKey}_${u.id}_stock`;
                                          const altStockKey = `${whKey}_${u.id}`;
                                          return {
                                            id: u.id,
                                            unitName: u.unitName || 'Quy đổi',
                                            rate: Number(u.conversionRate) || 1,
                                            isBase: false,
                                            stockKey: uStockKey,
                                            importKey: `${whKey}_${u.id}_importPrice`,
                                            wholesaleKey: `${whKey}_${u.id}_wholesalePrice`,
                                            retailKey: `${whKey}_${u.id}_retailPrice`,
                                            stockVal: form.warehouseUnitStocks[uStockKey] ?? form.warehouseUnitStocks[altStockKey] ?? '',
                                            importVal: form.warehouseUnitStocks[`${whKey}_${u.id}_importPrice`] ?? '',
                                            wholesaleVal: form.warehouseUnitStocks[`${whKey}_${u.id}_wholesalePrice`] ?? '',
                                            retailVal: form.warehouseUnitStocks[`${whKey}_${u.id}_retailPrice`] ?? '',
                                            defaultImport: u.importPrice,
                                            defaultWholesale: u.wholesalePrice,
                                            defaultRetail: u.retailPrice || u.price,
                                          };
                                        })
                                      : []),
                                  ];

                                  // Calculate warehouse converted stock total
                                  let whTotalQty = Number(baseStockVal) || 0;
                                  if (form.hasConversionUnits && form.conversionUnits.length > 0) {
                                    form.conversionUnits.forEach((u) => {
                                      const sKey = `${whKey}_${u.id}_stock`;
                                      const altKey = `${whKey}_${u.id}`;
                                      const qVal = form.warehouseUnitStocks[sKey] !== undefined ? form.warehouseUnitStocks[sKey] : form.warehouseUnitStocks[altKey];
                                      const q = Number(qVal) || 0;
                                      const r = Number(u.conversionRate) || 1;
                                      whTotalQty += q * r;
                                    });
                                  }

                                  const updateUnitField = (key: string, val: number | '') => {
                                    setForm((c) => {
                                      let nextBaseStocks = { ...c.warehouseStocks };
                                      let nextUnitStocks = { ...c.warehouseUnitStocks, [key]: val };

                                      if (key === whKey) {
                                        nextBaseStocks[whKey] = val;
                                      }

                                      // Sum all warehouses
                                      let grandTotal = 0;
                                      warehouses.forEach((wItem) => {
                                        const k = wItem.name || wItem.code || wItem.id;
                                        const bQ = Number(nextBaseStocks[k]) || 0;
                                        let uQ = 0;
                                        if (c.hasConversionUnits && c.conversionUnits.length > 0) {
                                          c.conversionUnits.forEach((u) => {
                                            const sK = `${k}_${u.id}_stock`;
                                            const altK = `${k}_${u.id}`;
                                            const qV = nextUnitStocks[sK] !== undefined ? nextUnitStocks[sK] : nextUnitStocks[altK];
                                            const q = Number(qV) || 0;
                                            const r = Number(u.conversionRate) || 1;
                                            uQ += q * r;
                                          });
                                        }
                                        grandTotal += bQ + uQ;
                                      });

                                      return {
                                        ...c,
                                        warehouseStocks: nextBaseStocks,
                                        warehouseUnitStocks: nextUnitStocks,
                                        stock: grandTotal,
                                      };
                                    });
                                  };

                                  return warehouseUnits.map((uItem, uIdx) => (
                                    <tr key={`${whKey}_${uItem.id}`} className="hover:bg-slate-50 transition-colors">
                                      {/* STT */}
                                      {uIdx === 0 && (
                                        <td rowSpan={warehouseUnits.length} className="p-3 text-center font-bold text-slate-500 border-r border-slate-200 bg-slate-50/50 align-middle">
                                          {idx + 1}
                                        </td>
                                      )}

                                      {/* TÊN KHO HÀNG */}
                                      {uIdx === 0 && (
                                        <td rowSpan={warehouseUnits.length} className="p-3 border-r border-slate-200 bg-slate-50/50 align-middle">
                                          <p className="font-extrabold text-slate-800 text-xs truncate max-w-[150px]" title={wh.name}>{wh.name}</p>
                                          {wh.address && (
                                            <p className="text-[10px] text-slate-400 truncate max-w-[150px]" title={wh.address}>
                                              {wh.address}
                                            </p>
                                          )}
                                        </td>
                                      )}

                                      {/* MÃ KHO */}
                                      {uIdx === 0 && (
                                        <td rowSpan={warehouseUnits.length} className="p-3 text-center font-bold text-slate-600 border-r border-slate-200 bg-slate-50/50 align-middle">
                                          {wh.code}
                                        </td>
                                      )}

                                      {/* ĐƠN VỊ TÍNH */}
                                      <td className="p-2.5 border-r border-slate-200">
                                        {uItem.isBase ? (
                                          <span className="inline-flex items-center gap-1 font-bold text-slate-800 text-xs">
                                            <span>{uItem.unitName}</span>
                                            <span className="text-[10px] font-semibold text-cyan-600 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200">(Gốc)</span>
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 font-bold text-emerald-800 text-xs">
                                            <span>{uItem.unitName}</span>
                                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">(x{uItem.rate})</span>
                                          </span>
                                        )}
                                      </td>

                                      {/* TỒN KHO BAN ĐẦU */}
                                      <td className="p-2 border-r border-slate-200">
                                        <input
                                          type="number"
                                          min="0"
                                          value={uItem.stockVal}
                                          onChange={(e) => {
                                            const rawVal = e.target.value;
                                            const val = rawVal === '' ? '' : Math.max(0, Number(rawVal));
                                            updateUnitField(uItem.stockKey, val);
                                          }}
                                          readOnly={modalMode === 'view'}
                                          placeholder="0"
                                          className={`w-full h-8 px-2 text-center rounded border font-bold text-xs outline-none transition read-only:bg-slate-50 ${
                                            uItem.isBase
                                              ? 'border-slate-300 text-slate-800 focus:border-cyan-500'
                                              : 'border-emerald-300 bg-emerald-50/40 text-emerald-900 focus:border-emerald-500'
                                          }`}
                                        />
                                      </td>

                                      {/* GIÁ NHẬP (₫) */}
                                      <td className="p-2 border-r border-slate-200">
                                        <input
                                          type="number"
                                          min="0"
                                          value={uItem.importVal}
                                          onChange={(e) => {
                                            const rawVal = e.target.value;
                                            const val = rawVal === '' ? '' : Math.max(0, Number(rawVal));
                                            updateUnitField(uItem.importKey, val);
                                          }}
                                          readOnly={modalMode === 'view'}
                                          placeholder={uItem.defaultImport ? String(uItem.defaultImport) : '0'}
                                          className="w-full h-8 px-2 text-right rounded border border-slate-300 font-semibold text-slate-800 text-xs outline-none focus:border-cyan-500 transition read-only:bg-slate-50"
                                        />
                                      </td>

                                      {/* GIÁ BÁN BUÔN (₫) */}
                                      <td className="p-2 border-r border-slate-200">
                                        <input
                                          type="number"
                                          min="0"
                                          value={uItem.wholesaleVal}
                                          onChange={(e) => {
                                            const rawVal = e.target.value;
                                            const val = rawVal === '' ? '' : Math.max(0, Number(rawVal));
                                            updateUnitField(uItem.wholesaleKey, val);
                                          }}
                                          readOnly={modalMode === 'view'}
                                          placeholder={uItem.defaultWholesale ? String(uItem.defaultWholesale) : '0'}
                                          className="w-full h-8 px-2 text-right rounded border border-slate-300 font-semibold text-slate-800 text-xs outline-none focus:border-cyan-500 transition read-only:bg-slate-50"
                                        />
                                      </td>

                                      {/* GIÁ BÁN LẺ (₫) */}
                                      <td className="p-2 border-r border-slate-200">
                                        <input
                                          type="number"
                                          min="0"
                                          value={uItem.retailVal}
                                          onChange={(e) => {
                                            const rawVal = e.target.value;
                                            const val = rawVal === '' ? '' : Math.max(0, Number(rawVal));
                                            updateUnitField(uItem.retailKey, val);
                                          }}
                                          readOnly={modalMode === 'view'}
                                          placeholder={uItem.defaultRetail ? String(uItem.defaultRetail) : '0'}
                                          className="w-full h-8 px-2 text-right rounded border border-slate-300 font-bold text-cyan-800 text-xs outline-none focus:border-cyan-500 transition read-only:bg-slate-50"
                                        />
                                      </td>

                                      {/* TỔNG TỒN QUY ĐỔI KHO NÀY */}
                                      {uIdx === 0 && (
                                        <td rowSpan={warehouseUnits.length} className="p-3 text-center border-slate-200 bg-cyan-50/30 align-middle">
                                          <span className="text-xs font-black text-cyan-900">
                                            {whTotalQty.toLocaleString('vi-VN')} {form.unit}
                                          </span>
                                        </td>
                                      )}
                                    </tr>
                                  ));
                                })
                              )}
                            </tbody>
                            <tfoot>
                              <tr className="bg-slate-100 border-t-2 border-slate-200 font-bold">
                                <td colSpan={4} className="p-3 text-right text-slate-700 text-xs uppercase">
                                  TỔNG CỘNG TỒN KHO TẤT CẢ CÁC KHO:
                                </td>
                                <td className="p-3 text-center font-black text-cyan-900 text-sm border-r border-slate-200">
                                  {(Number(form.stock) || 0).toLocaleString('vi-VN')} {form.unit}
                                </td>
                                <td colSpan={4} className="p-3 text-slate-500 font-semibold text-xs">
                                  (Tổng số lượng được tính tự động từ các kho)
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>

                      {/* Card 3: CHUYỂN ĐỔI ĐƠN VỊ (NẰM DƯỚI CÙNG BẢNG TỒN KHO) */}
                      {form.hasConversionUnits && (
                        <div className="rounded-2xl border-2 border-emerald-200 bg-white p-6 shadow-sm space-y-4">
                          <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3">
                            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                              <ArrowRightLeft className="h-5 w-5 text-emerald-600" />
                              <span>DANH SÁCH & BẢNG CẤU HÌNH CHUYỂN ĐỔI ĐƠN VỊ TÍNH (NẰM DƯỚI CÙNG)</span>
                            </div>
                            {modalMode !== 'view' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setForm((c) => ({
                                    ...c,
                                    conversionUnits: [
                                      ...c.conversionUnits,
                                      { id: safeUUID(), unitName: 'Thùng', conversionRate: 20, price: '', barcode: '', importPrice: '', wholesalePrice: '', retailPrice: '' },
                                    ],
                                  }));
                                }}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition cursor-pointer shadow-sm"
                              >
                                <Plus className="h-4 w-4" />
                                <span>Thêm đơn vị quy đổi</span>
                              </button>
                            )}
                          </div>

                          {/* Table of Conversion Units */}
                          <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-sm">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 uppercase">
                                <tr>
                                  <th className="p-3 w-40 border-r border-slate-300">Mã (Barcode)</th>
                                  <th className="p-3 w-36 border-r border-slate-300">Đơn vị quy đổi</th>
                                  <th className="p-3 w-28 border-r border-slate-300 text-center">Tỷ lệ quy đổi</th>
                                  <th className="p-3 min-w-[130px] border-r border-slate-300 text-center">Giá nhập mặc định (₫)</th>
                                  <th className="p-3 min-w-[130px] border-r border-slate-300 text-center">Giá bán buôn mặc định (₫)</th>
                                  <th className="p-3 min-w-[130px] border-r border-slate-300 text-center">Giá bán lẻ mặc định (₫)</th>
                                  {modalMode !== 'view' && <th className="p-3 w-24 text-center">Thao tác</th>}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 bg-white">
                                {form.conversionUnits.map((unitItem, idx) => (
                                  <tr key={unitItem.id} className="hover:bg-slate-50 transition-colors">
                                    {/* Mã Barcode */}
                                    <td className="p-2 border-r border-slate-200">
                                      <input
                                        type="text"
                                        value={unitItem.barcode || ''}
                                        onChange={(e) => {
                                          const next = [...form.conversionUnits];
                                          next[idx].barcode = e.target.value;
                                          setForm((c) => ({ ...c, conversionUnits: next }));
                                        }}
                                        readOnly={modalMode === 'view'}
                                        placeholder="Để trống sẽ tự sinh"
                                        className="w-full h-8 px-2.5 rounded-lg border border-slate-300 font-medium text-xs text-slate-800 outline-none focus:border-emerald-500 read-only:bg-slate-50"
                                      />
                                    </td>

                                    {/* Đơn vị quy đổi */}
                                    <td className="p-2 border-r border-slate-200">
                                      <input
                                        type="text"
                                        value={unitItem.unitName}
                                        onChange={(e) => {
                                          const next = [...form.conversionUnits];
                                          next[idx].unitName = e.target.value;
                                          setForm((c) => ({ ...c, conversionUnits: next }));
                                        }}
                                        readOnly={modalMode === 'view'}
                                        placeholder="VD: Hộp, Thùng..."
                                        className="w-full h-8 px-2.5 rounded-lg border border-slate-300 font-bold text-xs text-emerald-900 outline-none focus:border-emerald-500 read-only:bg-slate-50"
                                      />
                                    </td>

                                    {/* Tỷ lệ quy đổi */}
                                    <td className="p-2 border-r border-slate-200 text-center">
                                      <input
                                        type="number"
                                        min="1"
                                        value={unitItem.conversionRate}
                                        onChange={(e) => {
                                          const next = [...form.conversionUnits];
                                          next[idx].conversionRate = e.target.value ? Number(e.target.value) : '';
                                          setForm((c) => ({ ...c, conversionUnits: next }));
                                        }}
                                        readOnly={modalMode === 'view'}
                                        className="w-full h-8 px-2 text-center rounded-lg border border-slate-300 font-bold text-xs text-slate-800 outline-none focus:border-emerald-500 read-only:bg-slate-50"
                                      />
                                    </td>

                                    {/* Giá nhập */}
                                    <td className="p-2 border-r border-slate-200 text-center">
                                      <input
                                        type="number"
                                        min="0"
                                        value={unitItem.importPrice ?? ''}
                                        onChange={(e) => {
                                          const next = [...form.conversionUnits];
                                          next[idx].importPrice = e.target.value ? Number(e.target.value) : '';
                                          setForm((c) => ({ ...c, conversionUnits: next }));
                                        }}
                                        readOnly={modalMode === 'view'}
                                        placeholder="0"
                                        className="w-full h-8 px-2.5 text-right rounded-lg border border-slate-300 font-semibold text-slate-800 text-xs outline-none focus:border-emerald-500 read-only:bg-slate-50"
                                      />
                                    </td>

                                    {/* Giá bán buôn */}
                                    <td className="p-2 border-r border-slate-200 text-center">
                                      <input
                                        type="number"
                                        min="0"
                                        value={unitItem.wholesalePrice ?? ''}
                                        onChange={(e) => {
                                          const next = [...form.conversionUnits];
                                          next[idx].wholesalePrice = e.target.value ? Number(e.target.value) : '';
                                          setForm((c) => ({ ...c, conversionUnits: next }));
                                        }}
                                        readOnly={modalMode === 'view'}
                                        placeholder="0"
                                        className="w-full h-8 px-2.5 text-right rounded-lg border border-slate-300 font-semibold text-slate-800 text-xs outline-none focus:border-emerald-500 read-only:bg-slate-50"
                                      />
                                    </td>

                                    {/* Giá bán lẻ */}
                                    <td className="p-2 border-r border-slate-200 text-center">
                                      <input
                                        type="number"
                                        min="0"
                                        value={unitItem.retailPrice ?? (unitItem.price || '')}
                                        onChange={(e) => {
                                          const next = [...form.conversionUnits];
                                          const val = e.target.value ? Number(e.target.value) : '';
                                          next[idx].retailPrice = val;
                                          next[idx].price = val;
                                          setForm((c) => ({ ...c, conversionUnits: next }));
                                        }}
                                        readOnly={modalMode === 'view'}
                                        placeholder="0"
                                        className="w-full h-8 px-2.5 text-right rounded-lg border border-slate-300 font-bold text-cyan-800 text-xs outline-none focus:border-emerald-500 read-only:bg-slate-50"
                                      />
                                    </td>

                                    {/* Thao tác xóa */}
                                    {modalMode !== 'view' && (
                                      <td className="p-2 text-center">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setForm((c) => ({
                                              ...c,
                                              conversionUnits: c.conversionUnits.filter((_, i) => i !== idx),
                                            }));
                                          }}
                                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-100 hover:border-red-300 transition shadow-sm cursor-pointer"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                          <span>Xóa</span>
                                        </button>
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* TAB 2: BỘ SẢN PHẨM / COMBO */}
                  {activeTab === 'combo' && (
                    <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3">
                        <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                          <Boxes className="h-5 w-5 text-cyan-600" />
                          <span>DANH SÁCH HÀNG HÓA THÀNH PHẦN TRONG COMBO</span>
                        </div>
                        {modalMode !== 'view' && (
                          <button
                            type="button"
                            onClick={() => {
                              setForm((c) => ({
                                ...c,
                                comboItems: [
                                  ...c.comboItems,
                                  { id: safeUUID(), sku: '', name: '', quantity: 1 },
                                ],
                              }));
                            }}
                            className="inline-flex items-center gap-2 rounded-xl border border-cyan-500 bg-cyan-50 px-4 py-2 text-xs font-bold text-cyan-700 hover:bg-cyan-100 transition cursor-pointer"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Thêm hàng hóa vào Combo</span>
                          </button>
                        )}
                      </div>

                      {form.comboItems.length === 0 ? (
                        <div className="rounded-xl border-2 border-dashed border-slate-200 p-12 text-center text-slate-400 space-y-2">
                          <Boxes className="h-10 w-10 mx-auto text-slate-300" />
                          <p className="font-semibold text-sm">Chưa có thành phần nào trong bộ sản phẩm / Combo này.</p>
                          <p className="text-xs">Bấm "Thêm hàng hóa vào Combo" để ghép nhiều hàng hóa thành một bộ.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                              <tr>
                                <th className="p-3 w-12 text-center">STT</th>
                                <th className="p-3 w-40">MÃ HÀNG HÓA</th>
                                <th className="p-3">TÊN HÀNG HÓA THÀNH PHẦN</th>
                                <th className="p-3 w-36 text-center">SỐ LƯỢNG THÀNH PHẦN</th>
                                {modalMode !== 'view' && <th className="p-3 w-20 text-center">THAO TÁC</th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {form.comboItems.map((item, idx) => (
                                <tr key={item.id} className="hover:bg-slate-50">
                                  <td className="p-3 text-center font-bold text-slate-500">{idx + 1}</td>
                                  <td className="p-2">
                                    <input
                                      type="text"
                                      value={item.sku}
                                      onChange={(e) => {
                                        const next = [...form.comboItems];
                                        next[idx].sku = e.target.value;
                                        setForm((c) => ({ ...c, comboItems: next }));
                                      }}
                                      placeholder="Mã SKU..."
                                      className="w-full h-8 px-2 rounded-lg border border-slate-300 font-bold uppercase text-xs outline-none focus:border-cyan-500"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="text"
                                      value={item.name}
                                      onChange={(e) => {
                                        const next = [...form.comboItems];
                                        next[idx].name = e.target.value;
                                        setForm((c) => ({ ...c, comboItems: next }));
                                      }}
                                      placeholder="Nhập tên thành phần..."
                                      className="w-full h-8 px-2 rounded-lg border border-slate-300 font-semibold text-xs outline-none focus:border-cyan-500"
                                    />
                                  </td>
                                  <td className="p-2 text-center">
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.quantity}
                                      onChange={(e) => {
                                        const next = [...form.comboItems];
                                        next[idx].quantity = e.target.value ? Number(e.target.value) : '';
                                        setForm((c) => ({ ...c, comboItems: next }));
                                      }}
                                      className="w-24 h-8 px-2 text-center rounded-lg border border-slate-300 font-bold text-xs outline-none focus:border-cyan-500"
                                    />
                                  </td>
                                  {modalMode !== 'view' && (
                                    <td className="p-2 text-center">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setForm((c) => ({
                                            ...c,
                                            comboItems: c.comboItems.filter((_, i) => i !== idx),
                                          }));
                                        }}
                                        className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: THÔNG TIN ĐĂNG WEB */}
                  {activeTab === 'web' && (
                    <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3">
                        <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                          <Globe className="h-5 w-5 text-cyan-600" />
                          <span>CẤU HÌNH ĐĂNG SẢN PHẨM LÊN WEBSITE BÁN HÀNG</span>
                        </div>
                      </div>

                      <div className="space-y-4 max-w-3xl">
                        <div>
                          <label className="mb-1.5 block text-xs font-bold text-slate-700 uppercase">Tiêu đề hiển thị Web</label>
                          <input
                            type="text"
                            value={form.webTitle}
                            onChange={(e) => setForm((c) => ({ ...c, webTitle: e.target.value }))}
                            readOnly={modalMode === 'view'}
                            placeholder="Nhập tiêu đề hiển thị chuẩn SEO..."
                            className="h-10 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 read-only:bg-slate-50"
                          />
                        </div>

                        <div>
                          <label className="inline-flex items-center gap-3 rounded-xl border-2 border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-800 cursor-pointer transition hover:bg-slate-100 w-full">
                            <input
                              type="checkbox"
                              checked={form.isVisible}
                              onChange={(e) => setForm((c) => ({ ...c, isVisible: e.target.checked }))}
                              disabled={modalMode === 'view'}
                              className="h-5 w-5 rounded border-slate-300 accent-cyan-600 cursor-pointer"
                            />
                            <span>Cho phép hiển thị sản phẩm này trên Trang bán hàng (Shop / E-commerce)</span>
                          </label>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-bold text-slate-700 uppercase">Mô tả chi tiết đăng Web</label>
                          <textarea
                            value={form.webDescription}
                            onChange={(e) => setForm((c) => ({ ...c, webDescription: e.target.value }))}
                            readOnly={modalMode === 'view'}
                            rows={6}
                            placeholder="Mô tả nội dung bài viết bán hàng chi tiết..."
                            className="w-full rounded-xl border-2 border-slate-300 bg-white p-3 text-xs font-medium text-slate-800 outline-none focus:border-cyan-500 resize-none read-only:bg-slate-50"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: ĐƠN VỊ QUY ĐỔI */}
                  {activeTab === 'conversion' && (
                    <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3">
                        <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                          <RefreshCw className="h-5 w-5 text-cyan-600" />
                          <span>DANH SÁCH ĐƠN VỊ QUY ĐỔI (VD: 1 HỘP = 10 CÁI, 1 THÙNG = 20 HỘP)</span>
                        </div>
                        {modalMode !== 'view' && (
                          <button
                            type="button"
                            onClick={() => {
                              setForm((c) => ({
                                ...c,
                                conversionUnits: [
                                  ...c.conversionUnits,
                                  { id: safeUUID(), unitName: 'Hộp', conversionRate: 10, price: '', barcode: '' },
                                ],
                              }));
                            }}
                            className="inline-flex items-center gap-2 rounded-xl border border-cyan-500 bg-cyan-50 px-4 py-2 text-xs font-bold text-cyan-700 hover:bg-cyan-100 transition cursor-pointer"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Thêm đơn vị quy đổi</span>
                          </button>
                        )}
                      </div>

                      {form.conversionUnits.length === 0 ? (
                        <div className="rounded-xl border-2 border-dashed border-slate-200 p-12 text-center text-slate-400 space-y-2">
                          <RefreshCw className="h-10 w-10 mx-auto text-slate-300" />
                          <p className="font-semibold text-sm">Chưa khai báo đơn vị quy đổi nào.</p>
                          <p className="text-xs">Bấm "Thêm đơn vị quy đổi" để thiết lập đơn vị bán buôn/bán sỉ (Hộp, Thùng, Lốc...).</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                              <tr>
                                <th className="p-3 w-12 text-center">STT</th>
                                <th className="p-3 w-36">TÊN ĐƠN VỊ QUY ĐỔI</th>
                                <th className="p-3 w-36 text-center">TỶ LỆ QUY ĐỔI</th>
                                <th className="p-3 w-40 text-center">GIÁ BÁN QUY ĐỔI (₫)</th>
                                <th className="p-3">MÃ VẠCH QUY ĐỔI</th>
                                {modalMode !== 'view' && <th className="p-3 w-20 text-center">THAO TÁC</th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {form.conversionUnits.map((unitItem, idx) => (
                                <tr key={unitItem.id} className="hover:bg-slate-50">
                                  <td className="p-3 text-center font-bold text-slate-500">{idx + 1}</td>
                                  <td className="p-2">
                                    <input
                                      type="text"
                                      value={unitItem.unitName}
                                      onChange={(e) => {
                                        const next = [...form.conversionUnits];
                                        next[idx].unitName = e.target.value;
                                        setForm((c) => ({ ...c, conversionUnits: next }));
                                      }}
                                      placeholder="VD: Hộp..."
                                      className="w-full h-8 px-2 rounded-lg border border-slate-300 font-bold text-xs outline-none focus:border-cyan-500"
                                    />
                                  </td>
                                  <td className="p-2 text-center">
                                    <input
                                      type="number"
                                      min="1"
                                      value={unitItem.conversionRate}
                                      onChange={(e) => {
                                        const next = [...form.conversionUnits];
                                        next[idx].conversionRate = e.target.value ? Number(e.target.value) : '';
                                        setForm((c) => ({ ...c, conversionUnits: next }));
                                      }}
                                      className="w-24 h-8 px-2 text-center rounded-lg border border-slate-300 font-bold text-xs outline-none focus:border-cyan-500"
                                    />
                                  </td>
                                  <td className="p-2 text-center">
                                    <input
                                      type="number"
                                      min="0"
                                      value={unitItem.price}
                                      onChange={(e) => {
                                        const next = [...form.conversionUnits];
                                        next[idx].price = e.target.value ? Number(e.target.value) : '';
                                        setForm((c) => ({ ...c, conversionUnits: next }));
                                      }}
                                      placeholder="0"
                                      className="w-full h-8 px-2 text-center rounded-lg border border-slate-300 font-bold text-xs text-cyan-800 outline-none focus:border-cyan-500"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="text"
                                      value={unitItem.barcode}
                                      onChange={(e) => {
                                        const next = [...form.conversionUnits];
                                        next[idx].barcode = e.target.value;
                                        setForm((c) => ({ ...c, conversionUnits: next }));
                                      }}
                                      placeholder="Mã vạch riêng..."
                                      className="w-full h-8 px-2 rounded-lg border border-slate-300 font-semibold text-xs outline-none focus:border-cyan-500"
                                    />
                                  </td>
                                  {modalMode !== 'view' && (
                                    <td className="p-2 text-center">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setForm((c) => ({
                                            ...c,
                                            conversionUnits: c.conversionUnits.filter((_, i) => i !== idx),
                                          }));
                                        }}
                                        className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                </div>

                {/* MODAL FOOTER BAR */}
                <div className="flex shrink-0 items-center justify-between border-t-2 border-slate-200 bg-white px-6 py-3.5 shadow-md">
                  <div className="text-xs font-semibold text-slate-500">
                    {modalMode === 'create'
                      ? 'Tạo mới hàng hóa vào hệ thống'
                      : modalMode === 'edit'
                      ? `Cập nhật thông tin: ${selectedProduct?.name}`
                      : 'Đang xem thông tin hàng hóa'}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-xl border-2 border-slate-200 bg-white px-6 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                    >
                      {modalMode === 'view' ? 'Đóng' : 'Hủy bỏ'}
                    </button>
                    {modalMode !== 'view' && (
                      <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-8 py-2.5 text-xs font-bold text-white shadow-md hover:bg-cyan-700 transition cursor-pointer disabled:opacity-60"
                      >
                        <Save className="h-4 w-4" />
                        <span>{saving ? 'Đang lưu...' : modalMode === 'create' ? 'Tạo hàng hóa' : 'Lưu thay đổi'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* QUICK ADD UNIT MODAL */}
      {showQuickAddUnitModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in-50">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Thêm nhanh Đơn vị tính</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAddUnitModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickUnit} className="p-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 uppercase">
                  Tên đơn vị tính <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={quickUnitName}
                  onChange={(e) => setQuickUnitName(e.target.value)}
                  placeholder="VD: Thùng, Lốc, Khay, Chai, Chiếc..."
                  autoFocus
                  required
                  className="h-10 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 uppercase">Mô tả / Ghi chú</label>
                <textarea
                  value={quickUnitDesc}
                  onChange={(e) => setQuickUnitDesc(e.target.value)}
                  rows={2}
                  placeholder="Ghi chú thêm về đơn vị..."
                  className="w-full rounded-xl border-2 border-slate-300 bg-white p-3 text-xs font-medium text-slate-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowQuickAddUnitModal(false)}
                  className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-amber-600 transition cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>Tạo & Chọn</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
