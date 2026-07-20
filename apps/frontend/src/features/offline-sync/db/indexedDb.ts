const DB_NAME = 'smart_wms_offline_db';
const DB_VERSION = 2;
const OLD_STORE_NAME = 'offline_receipts';
const QUEUE_STORE_NAME = 'offline_queue';

export type QueueItemStatus = 'PENDING' | 'SYNCING' | 'FAILED' | 'SUCCESS';
export type QueueItemType = 'inbound' | 'outbound' | 'stocktake' | 'barcode_mapping';

export interface QueueItem {
  id?: number;
  timestamp: number;
  type: QueueItemType;
  payload: any;
  status: QueueItemStatus;
  retryCount: number;
  errorMessage?: string;
}

export interface OfflineReceipt {
  id?: number;
  timestamp: number;
  items: Array<{
    productId: string;
    expectedQty?: number;
    receivedQty?: number;
    requiredQty?: number;
    unitPrice?: number;
  }>;
  supplierId?: string;
  supplierName?: string;
  type: 'inbound' | 'outbound' | 'stocktake';
  locationCode?: string;
  productIds?: string[];
}

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(OLD_STORE_NAME)) {
        db.createObjectStore(OLD_STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE_NAME)) {
        const store = db.createObjectStore(QUEUE_STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
    };
  });
}

// ─── Queue Store Methods ────────────────────────────────────────

export async function enqueueQueueItem(item: Omit<QueueItem, 'id'>): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE_NAME);
    const request = store.add(item);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllQueueItems(): Promise<QueueItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE_NAME, 'readonly');
    const store = tx.objectStore(QUEUE_STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function updateQueueItem(item: QueueItem): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE_NAME);
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteQueueItem(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearQueueByStatus(status: QueueItemStatus): Promise<void> {
  const items = await getAllQueueItems();
  for (const item of items) {
    if (item.status === status && item.id) {
      await deleteQueueItem(item.id);
    }
  }
}

// ─── Legacy OfflineReceipt Methods (Backwards Compatibility) ────

export async function saveOfflineReceipt(receipt: Omit<OfflineReceipt, 'id'>): Promise<number> {
  // Also enqueue into new offline_queue for unified sync engine
  await enqueueQueueItem({
    timestamp: receipt.timestamp || Date.now(),
    type: receipt.type,
    payload: receipt,
    status: 'PENDING',
    retryCount: 0,
  });

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OLD_STORE_NAME, 'readwrite');
    const store = tx.objectStore(OLD_STORE_NAME);
    const request = store.add(receipt);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineReceipts(): Promise<OfflineReceipt[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OLD_STORE_NAME, 'readonly');
    const store = tx.objectStore(OLD_STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteOfflineReceipt(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OLD_STORE_NAME, 'readwrite');
    const store = tx.objectStore(OLD_STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
