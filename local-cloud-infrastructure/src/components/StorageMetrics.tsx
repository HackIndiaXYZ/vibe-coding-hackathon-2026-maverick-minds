import React, { useState, useEffect } from 'react';
import { useStorage } from '../hooks/useStorage';

export default function StorageMetrics() {
  const { metrics, loading, refreshMetrics } = useStorage();
  const [allocationInput, setAllocationInput] = useState<string>('');
  const [updating, setUpdating] = useState<boolean>(false);

  useEffect(() => {
    if (metrics.allocatedSpace) {
      setAllocationInput((metrics.allocatedSpace / (1024 * 1024 * 1024)).toString());
    }
  }, [metrics.allocatedSpace]);

  const toGB = (bytes: number) => (bytes / (1024 * 1024 * 1024)).toFixed(2);

  const physicalPct = metrics.totalSpace > 0
    ? ((metrics.usedSpace / metrics.totalSpace) * 100).toFixed(1)
    : '0';

  const allocationPct = metrics.allocatedSpace > 0
    ? ((metrics.appUsedSpace / metrics.allocatedSpace) * 100).toFixed(1)
    : '0';

  const handleUpdateAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const gb = parseFloat(allocationInput);
    if (isNaN(gb) || gb <= 0) return;
    setUpdating(true);
    try {
      const bytes = gb * 1024 * 1024 * 1024;
      await window.api.updateAllocation(bytes);
      await refreshMetrics();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const handleSelectFolder = async () => {
    try {
      const res = await window.api.selectFolder();
      if (res.path) {
        await refreshMetrics();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const networkLink = `http://${metrics.localIp}:${metrics.httpPort}`;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <div className="dashboard-header">
          <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" width="14" height="14">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0V10.5m-2.25 1.5h13.5c.621 0 1.125.504 1.125 1.125v7.496c0 .621-.504 1.125-1.125 1.125H5.25a1.125 1.125 0 01-1.125-1.125v-7.496c0-.621.504-1.125 1.125-1.125z" />
          </svg>
          System Storage Status
        </div>
        <h1 className="dashboard-title">Manage Local Cloud Storage & Quota Settings</h1>

        <div className="flex gap-2 flex-wrap">
          <span className="badge badge-info">Active Status</span>
          <span className="badge badge-neutral">Port {metrics.httpPort}</span>
        </div>
      </div>

      {/* Network Banner */}
      <div className="network-banner">
        <div className="network-banner-left">
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="18" height="18">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3M12 3a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253" />
          </svg>
          <span>Sharing Files On Same Network:</span>
        </div>
        <a href={networkLink} target="_blank" rel="noreferrer" className="network-banner-value" style={{ color: 'inherit', textDecoration: 'none' }}>
          {metrics.localIp}:{metrics.httpPort}
        </a>
      </div>

      {/* Description */}
      <div className="detail-section">
        <div className="section-label">
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="14" height="14">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292" />
          </svg>
          Description
        </div>
        <p className="section-description">
          Review, analyze, and update active storage allocations for local vaults and video surveillance feeds.
          Modify the maximum quota parameter below to reserve drive bytes on the host partition.
        </p>
      </div>

      {/* Storage Utilization Panel */}
      <div className="metrics-panel">
        <div className="metrics-header">
          <span className="metrics-title">Storage Utilization</span>
          <span className="text-sm font-semibold text-primary">{allocationPct}%</span>
        </div>

        <div className="progress h-4 mb-4">
          <div
            className="progress-fill progress-fill-primary"
            style={{ width: `${Math.min(parseFloat(allocationPct), 100)}%` }}
          />
        </div>

        <div className="text-sm text-secondary mb-6">
          App Storage Size: {toGB(metrics.appUsedSpace)} GB of {toGB(metrics.allocatedSpace)} GB Quota
        </div>

        {/* Allocation Form */}
        <form onSubmit={handleUpdateAllocation} className="metrics-form">
          <input
            type="number"
            step="any"
            value={allocationInput}
            onChange={(e) => setAllocationInput(e.target.value)}
            placeholder="Change Quota"
            className="input"
            style={{ width: '130px' }}
            disabled={loading || updating}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={updating || loading}>
            {updating ? 'Saving...' : 'Set Quota GB'}
          </button>
        </form>
      </div>

      {/* Directory Attachments */}
      <div className="detail-section">
        <div className="section-label">Directory Attachments</div>

        <div className="attachment-list">
          <div className="attachment-row">
            <div className="attachment-info">
              <div className="attachment-icon" style={{ backgroundColor: '#ffe2e5', color: '#ff4a6b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16" height="16">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                </svg>
              </div>
              <div>
                <h4>settings.json</h4>
                <p>App Data & Path Settings</p>
              </div>
            </div>
            <div className="attachment-actions">
              <button onClick={handleSelectFolder} className="attachment-action text-brand-400">
                <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="14" height="14">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                </svg>
                Change Path
              </button>
            </div>
          </div>

          <div className="attachment-row">
            <div className="attachment-info">
              <div className="attachment-icon" style={{ backgroundColor: '#e8e4f9', color: '#6c5dd3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16" height="16">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 3h13.5m-13.5-6h13.5m-13.5-3h13.5m-16.5 12h19.5a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 20.25z" />
                </svg>
              </div>
              <div>
                <h4>{metrics.path || 'Loading...'}</h4>
                <p>Active Root Vault Directory</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Updates */}
      <div className="detail-section">
        <div className="comments-tabs">
          <button className="comments-tab active">System Updates</button>
          <button onClick={refreshMetrics} className="comments-tab">Refresh</button>
        </div>

        <div className="comment-item">
          <div className="comment-avatar">AD</div>
          <div className="comment-body">
            <div className="comment-meta">
              <span className="comment-user">Host Disk System</span>
              <span className="comment-text">Just Now</span>
            </div>
            <div className="comment-text">
              Physical Disk: {toGB(metrics.usedSpace)} GB used out of {toGB(metrics.totalSpace)} GB total space ({physicalPct}% space filled).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
