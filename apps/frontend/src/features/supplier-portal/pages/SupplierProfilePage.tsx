import React from 'react';
import {
  Building2,
  CheckCircle,
  Cable,
  LayoutGrid,
  LogOut,
  Minimize2,
  Package,
  ShoppingCart,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import { getActiveItemGroupCategories, getStoredCatalogCategories, saveStoredCatalogCategories, type CatalogCategory } from '../../../shared/utils/catalogCategories';
import DistributorIntegrationWindow from '../components/DistributorIntegrationWindow';
import PortalWindow from '../components/PortalWindow';
import SupplierInfoWindow from '../components/SupplierInfoWindow';
import SupplierProductsWindow from '../components/SupplierProductsWindow';
import InboundOrderTrackingPage from './InboundOrderTrackingPage';
import type {
  ProductForm,
  InboundReceipt,
  ProfileForm,
  SupplierPortalWindowId,
  SupplierProductLink,
  SupplierProfile,
} from '../types';

type Toast = {
  type: 'success' | 'error';
  message: string;
};

type ApiCategory = {
  id: string;
  name: string;
  code?: string;
  description?: string;
  type?: string;
  status?: string;
  createdAt?: string;
};

type StoredUser = {
  email?: string;
  role?: string;
  supplierId?: string;
};

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function buildProfileForm(profile?: SupplierProfile | null): ProfileForm {
  return {
    taxCode: profile?.taxCode || '',
    contactPerson: profile?.contactPerson || '',
    phone: profile?.phone || '',
    email: profile?.email || '',
    address: profile?.address || '',
    leadTimeDays: String(profile?.leadTimeDays ?? 0),
    paymentTerms: profile?.paymentTerms || 'Công nợ 30 ngày',
    currency: profile?.currency || 'VND',
    priorityLevel: profile?.priorityLevel || 'secondary',
  };
}

function buildEmptyProductForm(): ProductForm {
  return {
    productImage: '',
    productId: '',
    internalSku: '',
    productName: '',
    itemGroup: '',
    unit: '',
    managementType: '',
    storagePosition: '',
    minimumStock: '0',
    supplierSku: '',
    purchasePrice: '0',
    isPrimary: false,
    description: '',
    quantity: '0',
    quantityAdded: '0',
    quantitySold: '0',
  };
}

function normalizeBackendCategory(category: ApiCategory): CatalogCategory {
  const name = category.name.trim();
  return {
    id: category.id || crypto.randomUUID(),
    type: (category.type as CatalogCategory['type']) || 'item-group',
    code: (category.code?.trim() || name.toUpperCase().replace(/\s+/g, '-')).toUpperCase(),
    name,
    description: category.description?.trim() || '',
    status: category.status === 'inactive' ? 'inactive' : 'active',
    createdAt: category.createdAt || new Date(0).toISOString(),
  };
}

function getStoredUser(): StoredUser {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}') as StoredUser;
  } catch {
    return {};
  }
}

const productExcelHeaders = [
  'Mã sản phẩm hệ thống',
  'Mã sản phẩm',
  'Tên sản phẩm',
  'Nhóm hàng',
  'Đơn vị tính',
  'Thuộc tính quản lý',
  'Vị trí lưu trữ',
  'Tồn tối thiểu',
  'Supplier SKU',
  'Giá nhập',
  'NCC chính',
];

const SUPPLIER_PORTAL_ACTIVE_WINDOW_KEY = 'supplierPortalActiveWindow';

function getStoredActiveWindow(): SupplierPortalWindowId | null {
  try {
    const raw = localStorage.getItem(SUPPLIER_PORTAL_ACTIVE_WINDOW_KEY);
    if (raw === 'supplier-info' || raw === 'products' || raw === 'purchase-orders' || raw === 'integration') {
      return raw;
    }
  } catch {
    // ignore
  }
  return null;
}

function escapeXml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildProductWorkbook(rows: string[][]) {
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1" ss:Color="#0F172A"/>
      <Interior ss:Color="#CCFBF1" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="San pham NCC">
    <Table>
      ${rows
      .map(
        (row, rowIndex) => `
            <Row ss:Height="${rowIndex === 0 ? 26 : 22}">
              ${row
            .map(
              (cell) => `
                    <Cell${rowIndex === 0 ? ' ss:StyleID="Header"' : ''}>
                      <Data ss:Type="String">${escapeXml(cell)}</Data>
                    </Cell>
                  `,
            )
            .join('')}
            </Row>
          `,
      )
      .join('')}
    </Table>
  </Worksheet>
</Workbook>`;
}

function downloadExcelFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export default function SupplierProfilePage() {
  const [activeWindow, setActiveWindow] = React.useState<SupplierPortalWindowId | null>(() => getStoredActiveWindow());
  const [profile, setProfile] = React.useState<SupplierProfile | null>(null);
  const [inboundReceipts, setInboundReceipts] = React.useState<InboundReceipt[]>([]);
  const [catalogCategories, setCatalogCategories] = React.useState<CatalogCategory[]>(() => getStoredCatalogCategories());
  const [profileForm, setProfileForm] = React.useState<ProfileForm>(() => buildProfileForm());
  const [productForm, setProductForm] = React.useState<ProductForm>(() => buildEmptyProductForm());
  const [editingLink, setEditingLink] = React.useState<SupplierProductLink | null>(null);
  const [productModalOpen, setProductModalOpen] = React.useState(false);
  const [quickAddModalOpen, setQuickAddModalOpen] = React.useState(false);
  const [activeLinkForQuickAdd, setActiveLinkForQuickAdd] = React.useState<SupplierProductLink | null>(null);
  const [quantityToAdd, setQuantityToAdd] = React.useState('0');
  const [historyModalOpen, setHistoryModalOpen] = React.useState(false);
  const [activeLinkForHistory, setActiveLinkForHistory] = React.useState<SupplierProductLink | null>(null);

  // Bulk Add Quantity Modal State
  const [bulkAddModalOpen, setBulkAddModalOpen] = React.useState(false);
  const [selectedBulkIds, setSelectedBulkIds] = React.useState<string[]>([]);
  const [bulkQuantityToAdd, setBulkQuantityToAdd] = React.useState('0');

  // Quick Price Edit Modal State
  const [editPriceModalOpen, setEditPriceModalOpen] = React.useState(false);
  const [activeLinkForPriceEdit, setActiveLinkForPriceEdit] = React.useState<SupplierProductLink | null>(null);
  const [newPurchasePrice, setNewPurchasePrice] = React.useState('');

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<Toast | null>(null);
  const productImportRef = React.useRef<HTMLInputElement>(null);
  const syncCatalogCategories = React.useCallback(() => {
    setCatalogCategories(getStoredCatalogCategories());
  }, []);

  React.useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const matchingReceipts = React.useMemo(() => {
    if (!activeLinkForHistory) return [];
    return inboundReceipts.filter((receipt) =>
      receipt.details?.some((d) => d.product?.id === activeLinkForHistory.product?.id)
    );
  }, [activeLinkForHistory, inboundReceipts]);

  const loadData = React.useCallback(async () => {
    const token = localStorage.getItem('token') || '';
    if (!token) {
      setProfile(null);
      setInboundReceipts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [profileResponse, inboundResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/suppliers/me`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/inbound/purchase-orders`, { headers: authHeaders() }),
      ]);

      if (!profileResponse.ok) {
        const data = await profileResponse.json().catch(() => null);
        throw new Error(data?.message || 'Không tải được hồ sơ nhà cung cấp');
      }

      const nextProfile = (await profileResponse.json()) as SupplierProfile;
      setProfile(nextProfile);
      setProfileForm(buildProfileForm(nextProfile));

      if (inboundResponse.ok) {
        const receipts = (await inboundResponse.json()) as InboundReceipt[];
        setInboundReceipts(
          receipts.filter((receipt) => {
            if (!nextProfile) return true;
            const mId = receipt.supplier?.id && nextProfile.id && receipt.supplier.id === nextProfile.id;
            const mCode = receipt.supplier?.supplierCode && nextProfile.supplierCode && receipt.supplier.supplierCode === nextProfile.supplierCode;
            const mName1 = receipt.supplierName && nextProfile.name && receipt.supplierName.toLowerCase().trim() === nextProfile.name.toLowerCase().trim();
            const mName2 = receipt.supplier?.name && nextProfile.name && receipt.supplier.name.toLowerCase().trim() === nextProfile.name.toLowerCase().trim();
            return mId || mCode || mName1 || mName2 || !receipt.supplier;
          }),
        );
      }
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Lỗi khi tải dữ liệu' });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    if (loading || profile) return;

    const token = localStorage.getItem('token') || '';
    if (!token) return;

    const currentUser = getStoredUser();
    const normalizedEmail = currentUser.email?.trim().toLowerCase();
    if (!currentUser.supplierId && !normalizedEmail) return;

    let cancelled = false;

    const hydrateFromSupplierList = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/suppliers`, { headers: authHeaders() });
        if (!response.ok) return;

        const suppliers = (await response.json()) as Array<SupplierProfile & { accountEmail?: string }>;
        const nextProfile =
          suppliers.find((supplier) => supplier.id === currentUser.supplierId) ||
          suppliers.find((supplier) => supplier.accountEmail?.trim().toLowerCase() === normalizedEmail) ||
          suppliers.find((supplier) => supplier.email?.trim().toLowerCase() === normalizedEmail) ||
          null;

        if (cancelled || !nextProfile) return;

        setProfile(nextProfile);
        setProfileForm(buildProfileForm(nextProfile));

        const inboundResponse = await fetch(`${API_BASE_URL}/inbound/purchase-orders`, { headers: authHeaders() });
        if (inboundResponse.ok) {
          const receipts = (await inboundResponse.json()) as InboundReceipt[];
          setInboundReceipts(
            receipts.filter((receipt) => {
              if (!nextProfile) return true;
              const mId = receipt.supplier?.id && nextProfile.id && receipt.supplier.id === nextProfile.id;
              const mCode = receipt.supplier?.supplierCode && nextProfile.supplierCode && receipt.supplier.supplierCode === nextProfile.supplierCode;
              const mName1 = receipt.supplierName && nextProfile.name && receipt.supplierName.toLowerCase().trim() === nextProfile.name.toLowerCase().trim();
              const mName2 = receipt.supplier?.name && nextProfile.name && receipt.supplier.name.toLowerCase().trim() === nextProfile.name.toLowerCase().trim();
              return mId || mCode || mName1 || mName2 || !receipt.supplier;
            }),
          );
        }
      } catch {
        // Keep the portal usable even if the fallback lookup fails.
      }
    };

    void hydrateFromSupplierList();
    return () => {
      cancelled = true;
    };
  }, [loading, profile]);

  React.useEffect(() => {
    try {
      if (activeWindow) {
        localStorage.setItem(SUPPLIER_PORTAL_ACTIVE_WINDOW_KEY, activeWindow);
      } else {
        localStorage.removeItem(SUPPLIER_PORTAL_ACTIVE_WINDOW_KEY);
      }
    } catch {
      // ignore storage failures
    }
  }, [activeWindow]);

  React.useEffect(() => {
    let cancelled = false;

    const loadCatalogCategories = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/categories`, { headers: authHeaders() });
        if (response.ok) {
          const data = (await response.json()) as ApiCategory[];
          const backendCategories = Array.isArray(data) ? data.filter((category) => category?.name?.trim()).map(normalizeBackendCategory) : [];
          if (!cancelled && backendCategories.length > 0) {
            setCatalogCategories(backendCategories);
            saveStoredCatalogCategories(backendCategories);
            return;
          }
        }
      } catch {
        // Fall back to local storage below.
      }

      if (!cancelled) {
        setCatalogCategories(getStoredCatalogCategories());
      }
    };

    void loadCatalogCategories();

    const syncMasterData = () => setCatalogCategories(getStoredCatalogCategories());
    window.addEventListener('storage', syncMasterData);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', syncMasterData);
    };
  }, []);

  const itemGroupOptions = React.useMemo(() => getActiveItemGroupCategories(catalogCategories), [catalogCategories]);
  const unitOptions = catalogCategories.filter((category) => category.type === 'unit' && category.status === 'active');
  const managementTypeOptions = catalogCategories.filter(
    (category) => category.type === 'management-attribute' && category.status === 'active',
  );
  const storagePositionOptions = catalogCategories.filter(
    (category) => category.type === 'storage-position' && category.status === 'active',
  );
  const products: Array<{ id: string; internalSku: string; name: string }> = [];

  const handleSaveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(profile?.id ? `${API_BASE_URL}/suppliers/${profile.id}` : `${API_BASE_URL}/suppliers/me`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          taxCode: profileForm.taxCode.trim(),
          contactPerson: profileForm.contactPerson.trim(),
          phone: profileForm.phone.trim(),
          email: profileForm.email.trim(),
          address: profileForm.address.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không lưu được hồ sơ');
      }

      setToast({ type: 'success', message: 'Đã cập nhật hồ sơ nhà cung cấp.' });
      await loadData();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Lỗi khi lưu hồ sơ' });
    } finally {
      setSaving(false);
    }
  };

  const handleProductImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setProductForm((current) => ({ ...current, productImage: '' }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProductForm((current) => ({
        ...current,
        productImage: typeof reader.result === 'string' ? reader.result : '',
      }));
    };
    reader.readAsDataURL(file);
  };

  const openProductModal = (link?: SupplierProductLink) => {
    const latestCatalogCategories = catalogCategories;
    const latestItemGroups = getActiveItemGroupCategories(latestCatalogCategories);

    setEditingLink(link || null);
    setProductForm(
      link
        ? {
          productImage: link.product?.image || '',
          productId: link.product?.id || '',
          internalSku: link.product?.internalSku || '',
          productName: link.product?.name || '',
          itemGroup: link.itemGroup || '',
          unit: link.product?.unit || '',
          managementType: link.managementType || '',
          storagePosition: link.storagePosition || '',
          minimumStock: String(link.product?.minimumStock ?? 0),
          supplierSku: link.supplierSku || '',
          purchasePrice: String(link.purchasePrice || 0),
          isPrimary: link.isPrimary,
          description: link.description || '',
          quantity: String(link.quantity ?? 0),
          quantityAdded: String(link.quantityAdded ?? 0),
          quantitySold: String(link.quantitySold ?? 0),
        }
        : {
          ...buildEmptyProductForm(),
          itemGroup: latestItemGroups[0]?.name || '',
          unit: latestCatalogCategories.filter((category) => category.type === 'unit' && category.status === 'active')[0]?.name || '',
          managementType: latestCatalogCategories.filter((category) => category.type === 'management-attribute' && category.status === 'active')[0]?.name || '',
          storagePosition: latestCatalogCategories.filter((category) => category.type === 'storage-position' && category.status === 'active')[0]?.name || '',
        },
    );
    setProductModalOpen(true);
  };

  const closeProductModal = () => {
    setEditingLink(null);
    setProductModalOpen(false);
    setProductForm(buildEmptyProductForm());
  };

  const handleSaveProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !productForm.internalSku.trim() ||
      !productForm.productName.trim() ||
      !productForm.itemGroup.trim() ||
      !productForm.unit.trim()
    ) {
      setToast({ type: 'error', message: 'Vui lòng nhập đầy đủ mã hàng hóa, tên hàng hóa, loại hàng hóa và ĐV Tính.' });
      return;
    }

    setSaving(true);
    try {
      const url = editingLink
        ? `${API_BASE_URL}/suppliers/me/products/${editingLink.id}`
        : `${API_BASE_URL}/suppliers/me/products`;
      const response = await fetch(url, {
        method: editingLink ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          productId: editingLink ? productForm.productId : undefined,
          productImage: productForm.productImage || undefined,
          internalSku: productForm.internalSku.trim().toUpperCase(),
          productName: productForm.productName.trim(),
          itemGroup: productForm.itemGroup.trim(),
          unit: productForm.unit.trim(),
          managementType: productForm.managementType.trim(),
          storagePosition: productForm.storagePosition.trim(),
          minimumStock: Number(productForm.minimumStock || 0),
          supplierSku: productForm.supplierSku.trim(),
          purchasePrice: Number(productForm.purchasePrice || 0),
          isPrimary: productForm.isPrimary,
          description: productForm.description.trim(),
          quantity: Number(productForm.quantity || 0),
          quantityAdded: Number(productForm.quantityAdded || 0),
          quantitySold: Number(productForm.quantitySold || 0),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không lưu được mặt hàng cung cấp');
      }

      setToast({ type: 'success', message: editingLink ? 'Đã cập nhật mặt hàng.' : 'Đã thêm mặt hàng cung cấp.' });
      closeProductModal();
      await loadData();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Lỗi khi lưu mặt hàng' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (link: SupplierProductLink) => {
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/suppliers/me/products/${link.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không xóa được mặt hàng');
      }

      setToast({ type: 'success', message: 'Đã xóa mặt hàng cung cấp.' });
      await loadData();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Lỗi khi xóa mặt hàng' });
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAddQuantitySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeLinkForQuickAdd) return;
    const addAmt = Number(quantityToAdd || 0);
    if (isNaN(addAmt) || addAmt <= 0) {
      setToast({ type: 'error', message: 'Vui lòng nhập số lượng hợp lệ lớn hơn 0.' });
      return;
    }
    setSaving(true);
    try {
      const currentQty = activeLinkForQuickAdd.quantity || 0;
      const currentQtyAdded = activeLinkForQuickAdd.quantityAdded || 0;
      const nextQty = currentQty + addAmt;
      const nextQtyAdded = currentQtyAdded + addAmt;

      const response = await fetch(`${API_BASE_URL}/suppliers/me/products/${activeLinkForQuickAdd.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          productId: activeLinkForQuickAdd.product?.id,
          productImage: activeLinkForQuickAdd.product?.image || undefined,
          internalSku: activeLinkForQuickAdd.product?.internalSku || '',
          productName: activeLinkForQuickAdd.product?.name || '',
          itemGroup: activeLinkForQuickAdd.itemGroup || '',
          unit: activeLinkForQuickAdd.product?.unit || '',
          managementType: activeLinkForQuickAdd.managementType || '',
          storagePosition: activeLinkForQuickAdd.storagePosition || '',
          minimumStock: activeLinkForQuickAdd.product?.minimumStock || 0,
          supplierSku: activeLinkForQuickAdd.supplierSku || '',
          purchasePrice: Number(activeLinkForQuickAdd.purchasePrice || 0),
          isPrimary: activeLinkForQuickAdd.isPrimary,
          description: activeLinkForQuickAdd.description || '',
          quantity: nextQty,
          quantityAdded: nextQtyAdded,
          quantitySold: activeLinkForQuickAdd.quantitySold || 0,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không cập nhật được số lượng');
      }

      setToast({ type: 'success', message: `Đã thêm ${addAmt} vào số lượng hàng hóa.` });
      setQuickAddModalOpen(false);
      setActiveLinkForQuickAdd(null);
      setQuantityToAdd('0');
      await loadData();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Lỗi khi thêm số lượng' });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkAddQuantitySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const addAmt = Number(bulkQuantityToAdd || 0);
    if (isNaN(addAmt) || addAmt <= 0) {
      setToast({ type: 'error', message: 'Vui lòng nhập số lượng hợp lệ lớn hơn 0.' });
      return;
    }
    setSaving(true);
    try {
      await Promise.all(
        selectedBulkIds.map(async (id) => {
          const link = profile?.products?.find((p) => p.id === id);
          if (!link) return;
          const currentQty = link.quantity || 0;
          const currentQtyAdded = link.quantityAdded || 0;
          const nextQty = currentQty + addAmt;
          const nextQtyAdded = currentQtyAdded + addAmt;

          const response = await fetch(`${API_BASE_URL}/suppliers/me/products/${link.id}`, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({
              productId: link.product?.id,
              productImage: link.product?.image || undefined,
              internalSku: link.product?.internalSku || '',
              productName: link.product?.name || '',
              itemGroup: link.itemGroup || '',
              unit: link.product?.unit || '',
              managementType: link.managementType || '',
              storagePosition: link.storagePosition || '',
              minimumStock: link.product?.minimumStock || 0,
              supplierSku: link.supplierSku || '',
              purchasePrice: Number(link.purchasePrice || 0),
              isPrimary: link.isPrimary,
              description: link.description || '',
              quantity: nextQty,
              quantityAdded: nextQtyAdded,
              quantitySold: link.quantitySold || 0,
            }),
          });
          if (!response.ok) {
            throw new Error(`Lỗi cập nhật cho sản phẩm ${link.product?.name}`);
          }
        })
      );
      setToast({ type: 'success', message: `Đã thêm số lượng ${addAmt} hàng loạt thành công.` });
      setBulkAddModalOpen(false);
      setSelectedBulkIds([]);
      setBulkQuantityToAdd('0');
      await loadData();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Lỗi khi thêm số lượng hàng loạt' });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDeleteSubmit = async (ids: string[]) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ${ids.length} mặt hàng đã chọn không?`)) {
      return;
    }
    setSaving(true);
    try {
      await Promise.all(
        ids.map(async (id) => {
          const response = await fetch(`${API_BASE_URL}/suppliers/me/products/${id}`, {
            method: 'DELETE',
            headers: authHeaders(),
          });
          if (!response.ok) {
            throw new Error('Có sản phẩm không xóa được');
          }
        })
      );
      setToast({ type: 'success', message: 'Đã xóa hàng loạt các sản phẩm đã chọn.' });
      await loadData();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Lỗi khi xóa hàng loạt' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePriceSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeLinkForPriceEdit) return;
    const newPrice = Number(newPurchasePrice || 0);
    if (isNaN(newPrice) || newPrice < 0) {
      setToast({ type: 'error', message: 'Vui lòng nhập giá bán hợp lệ.' });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/suppliers/me/products/${activeLinkForPriceEdit.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          productId: activeLinkForPriceEdit.product?.id,
          productImage: activeLinkForPriceEdit.product?.image || undefined,
          internalSku: activeLinkForPriceEdit.product?.internalSku || '',
          productName: activeLinkForPriceEdit.product?.name || '',
          itemGroup: activeLinkForPriceEdit.itemGroup || '',
          unit: activeLinkForPriceEdit.product?.unit || '',
          managementType: activeLinkForPriceEdit.managementType || '',
          storagePosition: activeLinkForPriceEdit.storagePosition || '',
          minimumStock: activeLinkForPriceEdit.product?.minimumStock || 0,
          supplierSku: activeLinkForPriceEdit.supplierSku || '',
          purchasePrice: newPrice,
          isPrimary: activeLinkForPriceEdit.isPrimary,
          description: activeLinkForPriceEdit.description || '',
          quantity: activeLinkForPriceEdit.quantity || 0,
          quantityAdded: activeLinkForPriceEdit.quantityAdded || 0,
          quantitySold: activeLinkForPriceEdit.quantitySold || 0,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không cập nhật được giá bán');
      }
      setToast({ type: 'success', message: 'Đã cập nhật giá bán mới.' });
      setEditPriceModalOpen(false);
      setActiveLinkForPriceEdit(null);
      setNewPurchasePrice('');
      await loadData();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Lỗi khi cập nhật giá bán' });
    } finally {
      setSaving(false);
    }
  };

  const downloadProductTemplate = () => {
    const rows = [
      productExcelHeaders,
      [
        'PROD-001',
        'SP001',
        'Tên sản phẩm mẫu',
        itemGroupOptions[0]?.name || '',
        unitOptions[0]?.name || '',
        managementTypeOptions[0]?.name || '',
        storagePositionOptions[0]?.name || '',
        '0',
        'SKU-NCC-001',
        '0',
        'Có',
      ],
    ];
    downloadExcelFile('mau-import-san-pham-ncc.xls', buildProductWorkbook(rows));
  };

  const exportSupplierProducts = () => {
    const rows = [
      productExcelHeaders,
      ...(profile?.products || []).map((link) => [
        link.product?.id || '',
        link.product?.internalSku || '',
        link.product?.name || '',
        link.itemGroup || '',
        link.product?.unit || '',
        link.managementType || '',
        link.storagePosition || '',
        String(link.product?.minimumStock ?? 0),
        link.supplierSku || '',
        String(link.purchasePrice || 0),
        link.isPrimary ? 'Có' : 'Không',
      ]),
    ];

    downloadExcelFile('san-pham-nha-cung-cap.xls', buildProductWorkbook(rows));
    setToast({ type: 'success', message: 'Đã xuất danh sách sản phẩm nhà cung cấp.' });
  };

  const importSupplierProducts = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setSaving(true);
    try {
      const content = await file.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(content, 'text/xml');
      const rows = Array.from(xmlDoc.getElementsByTagNameNS('*', 'Row')).slice(1);
      let successCount = 0;
      let failedCount = 0;

      for (const [index, row] of rows.entries()) {
        const cells = Array.from(row.getElementsByTagNameNS('*', 'Data')).map((cell) => cell.textContent?.trim() || '');
        const [
          productId,
          internalSku,
          productName,
          itemGroup,
          unit,
          managementType,
          storagePosition,
          minimumStock,
          supplierSku,
          purchasePrice,
          isPrimary,
        ] = cells;

        if (!cells.some(Boolean)) continue;
        if (!internalSku || !productName || !itemGroup || !unit || !managementType || !storagePosition) {
          failedCount += 1;
          continue;
        }

        const response = await fetch(`${API_BASE_URL}/suppliers/me/products`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            internalSku: internalSku.trim().toUpperCase(),
            productName: productName.trim(),
            itemGroup: itemGroup.trim(),
            unit: unit.trim(),
            managementType: managementType.trim(),
            storagePosition: storagePosition.trim(),
            minimumStock: Number(minimumStock || 0),
            supplierSku: supplierSku.trim(),
            purchasePrice: Number(purchasePrice || 0),
            isPrimary: isPrimary.trim().toLowerCase().includes('có') || isPrimary.trim().toLowerCase().includes('true'),
          }),
        });

        if (response.ok) {
          successCount += 1;
        } else {
          failedCount += 1;
          console.warn(`Import supplier product row ${index + 2} failed`);
        }
      }

      await loadData();
      setToast({
        type: failedCount > 0 ? 'error' : 'success',
        message: `Import xong: ${successCount} dòng thành công, ${failedCount} dòng lỗi.`,
      });
    } catch {
      setToast({ type: 'error', message: 'Không đọc được file import. Vui lòng dùng file mẫu .xls tải từ hệ thống.' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const renderWindowContent = (id: SupplierPortalWindowId, compact = false) => {
    if (id === 'supplier-info') {
      return (
        <SupplierInfoWindow
          profile={profile}
          form={profileForm}
          setForm={setProfileForm}
          compact={compact}
          saving={saving}
          onSubmit={handleSaveProfile}
        />
      );
    }

    if (id === 'products') {
      return (
        <SupplierProductsWindow
          profile={profile}
          compact={compact}
          onAdd={() => openProductModal()}
          onEdit={openProductModal}
          onDelete={handleDeleteProduct}
          onImport={() => productImportRef.current?.click()}
          onExport={exportSupplierProducts}
          onDownloadTemplate={downloadProductTemplate}
          onAddQuantity={(link) => {
            setActiveLinkForQuickAdd(link);
            setQuantityToAdd('0');
            setQuickAddModalOpen(true);
          }}
          onViewOrderHistory={(link) => {
            setActiveLinkForHistory(link);
            setHistoryModalOpen(true);
          }}
          onBulkAddQuantity={(ids) => {
            setSelectedBulkIds(ids);
            setBulkQuantityToAdd('0');
            setBulkAddModalOpen(true);
          }}
          onBulkDelete={handleBulkDeleteSubmit}
          onEditPrice={(link) => {
            setActiveLinkForPriceEdit(link);
            setNewPurchasePrice(String(link.purchasePrice || '0'));
            setEditPriceModalOpen(true);
          }}
        />
      );
    }

    if (id === 'purchase-orders') {
      return <InboundOrderTrackingPage compact={compact} receipts={inboundReceipts} />;
    }

    return <DistributorIntegrationWindow compact={compact} />;
  };

  const windows: Array<{
    id: SupplierPortalWindowId;
    title: string;
    eyebrow: string;
    icon: React.ReactNode;
  }> = [
      {
        id: 'supplier-info',
        title: 'Thông tin nhà cung cấp',
        eyebrow: 'Identity & Contact',
        icon: <Building2 className="h-5 w-5" />,
      },
      {
        id: 'products',
        title: 'Danh sách sản phẩm',
        eyebrow: 'Supplier Products',
        icon: <Package className="h-5 w-5" />,
      },
      {
        id: 'purchase-orders',
        title: 'Đặt hàng mua',
        eyebrow: 'Purchase Orders',
        icon: <ShoppingCart className="h-5 w-5" />,
      },
      {
        id: 'integration',
        title: 'Kết nối hệ thống',
        eyebrow: 'Distributor System',
        icon: <Cable className="h-5 w-5" />,
      },
    ];

  const activeConfig = windows.find((item) => item.id === activeWindow);
  const inactiveWindows = windows.filter((item) => item.id !== activeWindow);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100">
      <input
        ref={productImportRef}
        type="file"
        accept=".xls,.xml"
        className="hidden"
        onChange={importSupplierProducts}
      />
      {toast && (
        <div className={`fixed right-4 top-4 z-[60] flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-xl ${toast.type === 'error' ? 'border-red-200 text-red-600' : 'border-emerald-200 text-emerald-600'}`}>
          {toast.type === 'error' ? <XCircle size={20} /> : <CheckCircle size={20} />}
          <p className="text-sm font-bold">{toast.message}</p>
          <button type="button" onClick={() => setToast(null)} className="rounded-lg p-1 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>
      )}

      <header className="shrink-0 border-b-2 border-slate-200 bg-white px-5 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
              <Truck className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-cyan-600">Supplier Portal Workspace</p>
              <h1 className="truncate text-xl font-black text-slate-900">{profile?.name || 'Hệ đa nhiệm nhà phân phối'}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeWindow && (
              <button type="button" onClick={() => setActiveWindow(null)} className="inline-flex items-center gap-2 rounded-xl border-2 border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-bold text-cyan-700 transition hover:bg-cyan-100">
                <LayoutGrid className="h-4 w-4" />
                Toàn cảnh
              </button>
            )}
            <button type="button" onClick={handleLogout} className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 p-4">
        {loading ? (
          <div className="flex h-full items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-sm font-bold text-slate-500">
            Đang tải workspace nhà phân phối...
          </div>
        ) : activeConfig ? (
          <div className="grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="order-2 flex gap-3 overflow-x-auto xl:order-1 xl:flex-col xl:overflow-y-auto xl:overflow-x-hidden">
              {windows.map((item, index) => {
                const isActive = item.id === activeWindow;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveWindow(item.id)}
                    className={`flex min-w-[200px] shrink-0 flex-col rounded-xl border-2 p-3 text-left transition-colors xl:min-w-0 ${isActive
                      ? 'border-cyan-600 bg-cyan-50 shadow-md'
                      : 'border-slate-200 bg-white hover:border-cyan-300 hover:bg-slate-50'
                      }`}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ${isActive ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-500'
                          }`}
                      >
                        {index + 1}
                      </span>
                      <span
                        className={`truncate text-[10px] font-black uppercase tracking-wider ${isActive ? 'text-cyan-700' : 'text-slate-500'
                          }`}
                      >
                        {item.eyebrow}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`rounded-lg p-1.5 ${isActive ? 'bg-white text-cyan-600 shadow-sm' : 'bg-slate-50 text-slate-400'
                          }`}
                      >
                        {item.icon}
                      </div>
                      <span className={`text-sm ${isActive ? 'font-black text-cyan-950' : 'font-semibold text-slate-600'}`}>
                        {item.title}
                      </span>
                    </div>
                  </button>
                );
              })}
            </aside>

            <div className="order-1 min-h-0 xl:order-2">
              <PortalWindow
                title={activeConfig.title}
                eyebrow={activeConfig.eyebrow}
                icon={activeConfig.icon}
                active
              >

                {renderWindowContent(activeConfig.id)}
              </PortalWindow>
            </div>
          </div>
        ) : (
          <div className="grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-2">
            {windows.map((item) => (
              <PortalWindow
                key={item.id}
                title={item.title}
                eyebrow={item.eyebrow}
                icon={item.icon}
                compact
                onOpen={() => setActiveWindow(item.id)}
              >
                {renderWindowContent(item.id, true)}
              </PortalWindow>
            ))}
          </div>
        )}
      </main>

      {productModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <form onSubmit={handleSaveProduct} className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">{editingLink ? 'Sửa mặt hàng' : 'Thêm mặt hàng cung cấp'}</h3>
                </div>
              </div>
              <button type="button" onClick={closeProductModal} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(92vh-150px)] space-y-6 overflow-y-auto px-6 py-5">
              <section>
                <div className="mb-4 flex items-center gap-2">
                  <Package className="h-5 w-5 text-cyan-600" />
                  <h4 className="font-black text-slate-900">Thông tin sản phẩm</h4>
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-bold text-slate-700">Hình ảnh sản phẩm</label>
                    <div className="flex flex-col gap-4 rounded-xl border-2 border-dashed border-cyan-200 bg-cyan-50/40 p-4 sm:flex-row sm:items-center">
                      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl bg-white text-xs font-semibold text-slate-400 shadow-sm">
                        {productForm.productImage ? (
                          <img src={productForm.productImage} alt="Hình ảnh sản phẩm" className="h-full w-full object-cover" />
                        ) : (
                          'Chưa chọn ảnh'
                        )}
                      </div>
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleProductImageChange}
                          className="block w-full cursor-pointer rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 outline-none transition file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-600 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:border-cyan-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                        />
                        <p className="mt-2 text-xs font-medium text-slate-500">
                          Chọn ảnh đại diện cho hàng hóa của doanh nghiệp khi tạo sản phẩm mới.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Mã hàng hóa <span className="text-red-500">*</span></label>
                    <input value={productForm.internalSku} onChange={(event) => setProductForm((current) => ({ ...current, internalSku: event.target.value }))} className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 uppercase outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" placeholder="VD: SP001, HH001" required />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Tên hàng hóa <span className="text-red-500">*</span></label>
                    <input value={productForm.productName} onChange={(event) => setProductForm((current) => ({ ...current, productName: event.target.value }))} className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" placeholder="Tên hàng hóa nhà cung cấp" required />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Loại hàng hóa <span className="text-red-500">*</span></label>
                    <input
                      list="item-group-options"
                      value={productForm.itemGroup}
                      onChange={(event) => setProductForm((current) => ({ ...current, itemGroup: event.target.value }))}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                      placeholder="Nhập hoặc chọn loại hàng hóa"
                      required
                    />
                    <datalist id="item-group-options">
                      {itemGroupOptions.map((category) => (
                        <option key={category.id} value={category.name}>{category.code ? `${category.code} - ${category.name}` : category.name}</option>
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">ĐV Tính <span className="text-red-500">*</span></label>
                    <input
                      list="unit-options"
                      value={productForm.unit}
                      onChange={(event) => setProductForm((current) => ({ ...current, unit: event.target.value }))}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                      placeholder="Nhập hoặc chọn ĐV Tính"
                      required
                    />
                    <datalist id="unit-options">
                      {unitOptions.map((category) => (
                        <option key={category.id} value={category.name}>{category.code ? `${category.code} - ${category.name}` : category.name}</option>
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Tồn tối thiểu</label>
                    <input type="number" min={0} value={productForm.minimumStock} onChange={(event) => setProductForm((current) => ({ ...current, minimumStock: event.target.value }))} className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" placeholder="0" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Giá SP</label>
                    <input type="number" min={0} value={productForm.purchasePrice} onChange={(event) => setProductForm((current) => ({ ...current, purchasePrice: event.target.value }))} className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" placeholder="0" />
                  </div>
                  {editingLink && (
                    <>
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700">Số lượng</label>
                        <input type="number" min={0} value={productForm.quantity} onChange={(event) => setProductForm((current) => ({ ...current, quantity: event.target.value }))} className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" placeholder="0" />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700">Số lượng thêm mới</label>
                        <input type="number" min={0} value={productForm.quantityAdded} onChange={(event) => setProductForm((current) => ({ ...current, quantityAdded: event.target.value }))} className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" placeholder="0" />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700">Số lượng đã xuất bán</label>
                        <input type="number" min={0} value={productForm.quantitySold} onChange={(event) => setProductForm((current) => ({ ...current, quantitySold: event.target.value }))} className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" placeholder="0" />
                      </div>
                    </>
                  )}
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-bold text-slate-700">Mô tả</label>
                    <textarea value={productForm.description} onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))} className="w-full rounded-xl border-2 border-slate-200 p-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" placeholder="Nhập mô tả sản phẩm..." rows={3} />
                  </div>
                </div>
              </section>
            </div>

            <div className="flex justify-end gap-3 border-t-2 border-slate-100 px-6 py-4">
              <button type="button" onClick={closeProductModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50">
                Hủy
              </button>
              <button type="submit" disabled={saving} className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-60">
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quick Add Quantity Modal */}
      {quickAddModalOpen && activeLinkForQuickAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="w-[420px] rounded-2xl bg-white shadow-2xl transition-all border border-slate-100">
            <div className="border-b-2 border-slate-100 px-6 py-4">
              <h3 className="text-lg font-black text-slate-900">Thêm số lượng hàng hóa</h3>
            </div>
            <form onSubmit={handleQuickAddQuantitySubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Hàng hóa</p>
                  <p className="text-sm font-bold text-slate-900 mt-1">
                    [{activeLinkForQuickAdd.product?.internalSku}] - {activeLinkForQuickAdd.product?.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Số lượng hiện tại</p>
                  <p className="text-lg font-black text-cyan-600 mt-0.5">
                    {activeLinkForQuickAdd.quantity ?? 0} {activeLinkForQuickAdd.product?.unit}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Số lượng thêm mới</label>
                  <input
                    type="number"
                    min={1}
                    value={quantityToAdd}
                    onChange={(e) => setQuantityToAdd(e.target.value)}
                    className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    placeholder="VD: 10, 50, 100"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t-2 border-slate-100 px-6 py-4">
                <button
                  type="button"
                  onClick={() => {
                    setQuickAddModalOpen(false);
                    setActiveLinkForQuickAdd(null);
                  }}
                  className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-60"
                >
                  {saving ? 'Đang cập nhật...' : 'Xác nhận'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order History Modal */}
      {historyModalOpen && activeLinkForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="w-[800px] max-w-[90%] rounded-2xl bg-white shadow-2xl border border-slate-100 flex flex-col max-h-[85vh]">
            <div className="border-b-2 border-slate-100 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Lịch sử đơn đặt hàng</h3>
              <button
                type="button"
                onClick={() => {
                  setHistoryModalOpen(false);
                  setActiveLinkForHistory(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Hàng hóa</p>
                <p className="text-base font-black text-slate-900 mt-1">
                  [{activeLinkForHistory.product?.internalSku}] - {activeLinkForHistory.product?.name}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full border-collapse bg-white">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-3 text-center text-xs font-black uppercase text-slate-600">STT</th>
                      <th className="px-4 py-3 text-center text-xs font-black uppercase text-slate-600">Mã đơn hàng</th>
                      <th className="px-4 py-3 text-center text-xs font-black uppercase text-slate-600">Ngày dự kiến</th>
                      <th className="px-4 py-3 text-center text-xs font-black uppercase text-slate-600">SL yêu cầu</th>
                      <th className="px-4 py-3 text-center text-xs font-black uppercase text-slate-600">SL thực nhập</th>
                      <th className="px-4 py-3 text-center text-xs font-black uppercase text-slate-600">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchingReceipts.length ? (
                      matchingReceipts.map((receipt, index) => {
                        const detail = receipt.details?.find((d) => d.product?.id === activeLinkForHistory.product?.id);
                        return (
                          <tr key={receipt.id} className="border-t border-slate-200 text-sm hover:bg-slate-50/50">
                            <td className="px-4 py-3 text-center text-slate-500 font-semibold">{index + 1}</td>
                            <td className="px-4 py-3 text-center font-bold text-slate-800">{receipt.id}</td>
                            <td className="px-4 py-3 text-center text-slate-600 font-medium">
                              {receipt.expectedDate ? new Date(receipt.expectedDate).toLocaleDateString('vi-VN') : '-'}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-slate-700">{detail?.expectedQty ?? 0}</td>
                            <td className="px-4 py-3 text-center font-bold text-cyan-700">{detail?.receivedQty ?? 0}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex rounded-lg px-2.5 py-1 text-xs font-bold bg-cyan-50 text-cyan-700 border border-cyan-100">
                                {receipt.status || 'Chờ xử lý'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-semibold">
                          Chưa có lịch sử đơn đặt hàng cho sản phẩm này.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50">
              <button
                type="button"
                onClick={() => {
                  setHistoryModalOpen(false);
                  setActiveLinkForHistory(null);
                }}
                className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-bold text-slate-700 hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Add Quantity Modal */}
      {bulkAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="w-[420px] rounded-2xl bg-white shadow-2xl transition-all border border-slate-100">
            <div className="border-b-2 border-slate-100 px-6 py-4">
              <h3 className="text-lg font-black text-slate-900">Thêm số lượng hàng loạt</h3>
            </div>
            <form onSubmit={handleBulkAddQuantitySubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Số lượng mặt hàng đã chọn</p>
                  <p className="text-lg font-black text-cyan-600 mt-0.5">
                    {selectedBulkIds.length} mặt sản phẩm
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Số lượng thêm mới cho mỗi loại</label>
                  <input
                    type="number"
                    min={1}
                    value={bulkQuantityToAdd}
                    onChange={(e) => setBulkQuantityToAdd(e.target.value)}
                    className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    placeholder="VD: 10, 50, 100"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t-2 border-slate-100 px-6 py-4">
                <button
                  type="button"
                  onClick={() => {
                    setBulkAddModalOpen(false);
                    setSelectedBulkIds([]);
                  }}
                  className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-60"
                >
                  {saving ? 'Đang cập nhật...' : 'Xác nhận'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Price Edit Modal */}
      {editPriceModalOpen && activeLinkForPriceEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="w-[420px] rounded-2xl bg-white shadow-2xl transition-all border border-slate-100">
            <div className="border-b-2 border-slate-100 px-6 py-4">
              <h3 className="text-lg font-black text-slate-900">Thay đổi giá sản phẩm</h3>
            </div>
            <form onSubmit={handleUpdatePriceSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Sản phẩm</p>
                  <p className="text-sm font-bold text-slate-900 mt-1">
                    [{activeLinkForPriceEdit.product?.internalSku}] - {activeLinkForPriceEdit.product?.name}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Giá sản phẩm mới ({profile?.currency || 'VND'})</label>
                  <input
                    type="number"
                    min={0}
                    value={newPurchasePrice}
                    onChange={(e) => setNewPurchasePrice(e.target.value)}
                    className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    placeholder="Nhập giá mới..."
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t-2 border-slate-100 px-6 py-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditPriceModalOpen(false);
                    setActiveLinkForPriceEdit(null);
                  }}
                  className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-60"
                >
                  {saving ? 'Đang cập nhật...' : 'Xác nhận'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


