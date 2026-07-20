import {
  enqueueQueueItem,
  getAllQueueItems,
  updateQueueItem,
  deleteQueueItem,
  clearQueueByStatus,
  type QueueItem,
  type QueueItemStatus,
  type QueueItemType,
} from '../db/indexedDb';

export class OfflineQueueService {
  static async enqueue(type: QueueItemType, payload: any): Promise<number> {
    return enqueueQueueItem({
      timestamp: Date.now(),
      type,
      payload,
      status: 'PENDING',
      retryCount: 0,
    });
  }

  static async getPending(): Promise<QueueItem[]> {
    const items = await getAllQueueItems();
    return items.filter((i) => i.status === 'PENDING');
  }

  static async getFailed(): Promise<QueueItem[]> {
    const items = await getAllQueueItems();
    return items.filter((i) => i.status === 'FAILED');
  }

  static async getAll(): Promise<QueueItem[]> {
    return getAllQueueItems();
  }

  static async updateStatus(id: number, status: QueueItemStatus, errorMessage?: string): Promise<void> {
    const items = await getAllQueueItems();
    const item = items.find((i) => i.id === id);
    if (item) {
      item.status = status;
      if (status === 'SYNCING') {
        item.retryCount += 1;
      }
      if (errorMessage !== undefined) {
        item.errorMessage = errorMessage;
      }
      await updateQueueItem(item);
    }
  }

  static async remove(id: number): Promise<void> {
    await deleteQueueItem(id);
  }

  static async clearCompleted(): Promise<void> {
    await clearQueueByStatus('SUCCESS');
  }

  static async clearAll(): Promise<void> {
    const items = await getAllQueueItems();
    for (const item of items) {
      if (item.id) await deleteQueueItem(item.id);
    }
  }

  static async getSummary(): Promise<{
    pending: number;
    syncing: number;
    failed: number;
    success: number;
    total: number;
  }> {
    const items = await getAllQueueItems();
    return {
      pending: items.filter((i) => i.status === 'PENDING').length,
      syncing: items.filter((i) => i.status === 'SYNCING').length,
      failed: items.filter((i) => i.status === 'FAILED').length,
      success: items.filter((i) => i.status === 'SUCCESS').length,
      total: items.length,
    };
  }
}
