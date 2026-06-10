import { useState, useEffect } from 'react';
import type { StorageStatus } from '../../types';

export function useStorage() {
  const [metrics, setMetrics] = useState<StorageStatus>({
    path: '',
    totalSpace: 0,
    usedSpace: 0,
    freeSpace: 0,
    allocatedSpace: 0,
    appUsedSpace: 0,
    localIp: '',
    httpPort: 0
  });
  const [loading, setLoading] = useState<boolean>(true);

  const refreshMetrics = async () => {
    setLoading(true);
    try {
      const data = await window.api.getStorageStatus();
      setMetrics(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshMetrics();
  }, []);

  return { metrics, loading, refreshMetrics };
}
