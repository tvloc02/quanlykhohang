import { useEffect, useState } from 'react';
import { SyncManagerService } from '../services/syncManager.service';

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncedAt?: number;
}

export function useSyncStatus(): SyncStatus & { triggerSync: () => Promise<any> } {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    pendingCount: 0,
    failedCount: 0,
  });

  useEffect(() => {
    const unsubscribe = SyncManagerService.subscribe((state) => {
      setStatus(state);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const triggerSync = async () => {
    return SyncManagerService.syncNow();
  };

  return {
    ...status,
    triggerSync,
  };
}
