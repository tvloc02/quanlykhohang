export type PriorityLevel = 'strategic' | 'secondary';
export type SupplierPortalWindowId = 'supplier-info' | 'products' | 'purchase-orders' | 'integration';

export type ProductSummary = {
  id: string;
  internalSku: string;
  name: string;
  unit?: string;
  minimumStock?: number;
};

export type SupplierProductLink = {
  id: string;
  supplierSku?: string;
  itemGroup?: string;
  managementType?: string;
  storagePosition?: string;
  purchasePrice: string;
  isPrimary: boolean;
  product: ProductSummary | null;
};

export type SupplierProfile = {
  id: string;
  supplierCode: string;
  name: string;
  taxCode?: string;
  status: 'active' | 'inactive';
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  leadTimeDays: number;
  paymentTerms?: string;
  currency: string;
  priorityLevel: PriorityLevel;
  products?: SupplierProductLink[];
};

export type ProfileForm = {
  taxCode: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  leadTimeDays: string;
  paymentTerms: string;
  currency: string;
  priorityLevel: PriorityLevel;
};

export type ProductForm = {
  productImage: string;
  productId: string;
  internalSku: string;
  productName: string;
  itemGroup: string;
  unit: string;
  managementType: string;
  storagePosition: string;
  minimumStock: string;
  supplierSku: string;
  purchasePrice: string;
  isPrimary: boolean;
};

export type InboundReceipt = {
  id: string;
  expectedDate?: string;
  status?: string;
  description?: string;
  approverId?: string;
  supplier?: {
    id: string;
    supplierCode?: string;
    name: string;
  } | null;
  details?: Array<{
    id: string;
    expectedQty: number;
    receivedQty: number;
    product?: ProductSummary | null;
  }>;
};
