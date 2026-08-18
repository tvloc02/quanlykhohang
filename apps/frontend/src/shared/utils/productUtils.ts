const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const DELETED_PRODUCT_STACK_KEY = 'wms_deleted_product_stack_v1';

export interface DeletedProductBatch {
  deletedAt: number;
  items: Array<{ id?: string; sku?: string; internalSku?: string }>;
}

export function getStoredDeletedBatches(): DeletedProductBatch[] {
  try {
    const raw = localStorage.getItem(DELETED_PRODUCT_STACK_KEY);
    if (!raw) return [];
    const parsed: DeletedProductBatch[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const now = Date.now();
    const validBatches = parsed.filter(
      (b) => b && typeof b.deletedAt === 'number' && Array.isArray(b.items) && (now - b.deletedAt) < SEVEN_DAYS_MS
    );

    if (validBatches.length !== parsed.length) {
      localStorage.setItem(DELETED_PRODUCT_STACK_KEY, JSON.stringify(validBatches));
    }
    return validBatches;
  } catch {
    return [];
  }
}

export function getActiveDeletedProductKeys(): Set<string> {
  const batches = getStoredDeletedBatches();
  const keysSet = new Set<string>();
  batches.forEach((batch) => {
    (batch.items || []).forEach((p) => {
      if (p.id) keysSet.add(String(p.id));
      if (p.sku) keysSet.add(String(p.sku));
      if (p.internalSku) keysSet.add(String(p.internalSku));
    });
  });
  return keysSet;
}

export function filterOutDeletedProducts<T extends { id?: string | number; internalSku?: string; sku?: string }>(
  productsList: T[]
): T[] {
  const deletedKeys = getActiveDeletedProductKeys();
  if (deletedKeys.size === 0) return productsList;
  return productsList.filter(
    (p) =>
      !deletedKeys.has(String(p.id)) &&
      !deletedKeys.has(String(p.internalSku || p.sku || ''))
  );
}
