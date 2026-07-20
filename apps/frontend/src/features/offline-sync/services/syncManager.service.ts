import { OfflineQueueService } from './offlineQueue.service';
import { type QueueItem } from '../db/indexedDb';

const API_BASE_URL = 'http://localhost:3000/api';
const CHUNK_SIZE = 5; // Sync in chunks of 5 items at a time
const MAX_RETRIES = 3;

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

export type SyncEventListener = (summary: {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncedAt?: number;
}) => void;

export class SyncManagerService {
  private static isSyncing = false;
  private static listeners: Set<SyncEventListener> = new Set();
  private static lastSyncedAt?: number;
  private static isInitialized = false;

  static init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.notifyListeners();
        this.syncNow();
      });
      window.addEventListener('offline', () => {
        this.notifyListeners();
      });

      // Auto-trigger sync on load if online
      if (navigator.onLine) {
        setTimeout(() => this.syncNow(), 2000);
      }
    }
  }

  static subscribe(listener: SyncEventListener): () => void {
    this.init();
    this.listeners.add(listener);
    // Notify immediately on subscribe
    this.notifyListeners();

    return () => {
      this.listeners.delete(listener);
    };
  }

  private static async notifyListeners() {
    try {
      const summary = await OfflineQueueService.getSummary();
      const state = {
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        isSyncing: this.isSyncing,
        pendingCount: summary.pending,
        failedCount: summary.failed,
        lastSyncedAt: this.lastSyncedAt,
      };
      this.listeners.forEach((fn) => fn(state));
    } catch {
      // Ignore DB errors in listener notification
    }
  }

  static async syncNow(): Promise<{ synced: number; failed: number }> {
    if (this.isSyncing) return { synced: 0, failed: 0 };
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.notifyListeners();
      return { synced: 0, failed: 0 };
    }

    this.isSyncing = true;
    this.notifyListeners();

    let syncedCount = 0;
    let failedCount = 0;

    try {
      const pendingItems = await OfflineQueueService.getPending();
      if (pendingItems.length === 0) {
        this.isSyncing = false;
        this.notifyListeners();
        return { synced: 0, failed: 0 };
      }

      // Chunk processing: divide pending items into chunks of CHUNK_SIZE
      for (let i = 0; i < pendingItems.length; i += CHUNK_SIZE) {
        const chunk = pendingItems.slice(i, i + CHUNK_SIZE);

        for (const item of chunk) {
          if (!item.id) continue;

          if (item.retryCount >= MAX_RETRIES) {
            await OfflineQueueService.updateStatus(
              item.id,
              'FAILED',
              `Đã vượt quá số lần thử tối đa (${MAX_RETRIES} lần)`,
            );
            failedCount++;
            continue;
          }

          await OfflineQueueService.updateStatus(item.id, 'SYNCING');

          try {
            const success = await this.dispatchItem(item);
            if (success) {
              await OfflineQueueService.updateStatus(item.id, 'SUCCESS');
              await OfflineQueueService.remove(item.id);
              syncedCount++;
            } else {
              await OfflineQueueService.updateStatus(
                item.id,
                'FAILED',
                'Phản hồi từ hệ thống không hợp lệ',
              );
              failedCount++;
            }
          } catch (err: any) {
            const errorMsg = err?.message || 'Lỗi kết nối hoặc xung đột dữ liệu';
            await OfflineQueueService.updateStatus(item.id, 'FAILED', errorMsg);
            failedCount++;
          }
        }

        // Brief delay between chunks to avoid network congestion
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      if (syncedCount > 0) {
        this.lastSyncedAt = Date.now();
      }
    } catch (err) {
      console.warn('Auto Sync Engine error:', err);
    } finally {
      this.isSyncing = false;
      await OfflineQueueService.clearCompleted();
      this.notifyListeners();
    }

    return { synced: syncedCount, failed: failedCount };
  }

  private static async dispatchItem(item: QueueItem): Promise<boolean> {
    const { type, payload } = item;

    if (type === 'inbound') {
      const res = await fetch(`${API_BASE_URL}/inbound/purchase-orders`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          items: payload.items,
          supplierName: payload.supplierName,
          supplierId: payload.supplierId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || 'Lỗi tạo phiếu nhập kho');
      }
      return true;
    }

    if (type === 'outbound') {
      const res = await fetch(`${API_BASE_URL}/outbounds`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          details: payload.items || payload.details,
          customer: payload.customer,
          description: payload.description,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || 'Lỗi tạo phiếu xuất kho (có thể do tồn kho không đủ)');
      }
      return true;
    }

    if (type === 'stocktake') {
      const res = await fetch(`${API_BASE_URL}/inventory/stocktakes`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          locationCode: payload.locationCode || 'DEFAULT',
          productIds: payload.productIds,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || 'Lỗi tạo phiên kiểm kê');
      }
      return true;
    }

    if (type === 'barcode_mapping') {
      const res = await fetch(`${API_BASE_URL}/inbound/barcode-mappings`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || 'Lỗi tạo liên kết mã vạch');
      }
      return true;
    }

    return false;
  }
}
