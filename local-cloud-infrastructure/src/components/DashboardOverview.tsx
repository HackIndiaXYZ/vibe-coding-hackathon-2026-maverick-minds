import React from 'react';
import { useStorage } from '../hooks/useStorage';
import { useFileManager } from '../hooks/useFileManager';

interface DashboardOverviewProps {
  onNavigate: (tab: 'overview' | 'storage' | 'camera' | 'backup' | 'chatbot' | 'files') => void;
}

export default function DashboardOverview({ onNavigate }: DashboardOverviewProps) {
  const { metrics } = useStorage();
  const { files, deleteFile } = useFileManager();

  const toGB = (bytes: number) => (bytes / (1024 * 1024 * 1024)).toFixed(1);

  const duplicateRemoveList = React.useMemo(() => {
    const groups: { [key: string]: typeof files } = {};
    files.forEach(f => {
      const key = `${f.name}_${f.size}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(f);
    });
    
    const toRemove: typeof files = [];
    Object.values(groups).forEach(group => {
      if (group.length > 1) {
        toRemove.push(...group.slice(1));
      }
    });
    return toRemove;
  }, [files]);

  const allocationPct = metrics.allocatedSpace > 0
    ? Math.round((metrics.appUsedSpace / metrics.allocatedSpace) * 100)
    : 0;

  const networkLink = `http://${metrics.localIp || 'localhost'}:${metrics.httpPort || 80}`;

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <div className="dashboard-header">
          <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" width="14" height="14">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-1.8 2.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
          </svg>
          Console Hub
        </div>
        <h1 className="dashboard-title">System Status Overview</h1>
        <div className="flex gap-2 flex-wrap">
          <span className="badge badge-success">Host Online</span>
          <span className="badge badge-neutral">IP: {metrics.localIp || '127.0.0.1'}</span>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="bento-grid">
        {/* Storage card */}
        <div className="bento-card bg-accent-blue" onClick={() => onNavigate('storage')}>
          <div className="bento-card-header">
            <span className="bento-card-title">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75" />
              </svg>
              Vault Allocation
            </span>
            <span className="badge badge-info">{allocationPct}% Used</span>
          </div>
          <div className="bento-card-value">
            {toGB(metrics.appUsedSpace)} / {toGB(metrics.allocatedSpace)} GB
          </div>
          <div className="progress h-2" style={{ marginTop: '0.5rem' }}>
            <div className="progress-fill progress-fill-primary" style={{ width: `${Math.min(allocationPct, 100)}%` }} />
          </div>
          <div className="bento-card-footer">
            <span>Quota limit settings</span>
            <span>Configure →</span>
          </div>
        </div>

        {/* Camera Feed Card */}
        <div className="bento-card bg-accent-yellow" onClick={() => onNavigate('camera')}>
          <div className="bento-card-header">
            <span className="bento-card-title">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Live Surveillance
            </span>
            <span className="badge badge-warning">Capture Ready</span>
          </div>
          <div className="camera-placeholder">
            Video stream initialized
          </div>
          <div className="bento-card-footer">
            <span>Hardware engine: ON</span>
            <span>Live Feed →</span>
          </div>
        </div>

        {/* Recent Files Card */}
        <div className="bento-card bg-accent-pink" onClick={() => onNavigate('files')}>
          <div className="bento-card-header">
            <span className="bento-card-title">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Recent Vault Uploads
            </span>
            <span className="badge badge-neutral">{files.length} Files</span>
          </div>
          <div className="flex flex-col gap-1 text-xs">
            {files.slice(0, 2).map((file) => (
              <div key={file.id} className="flex justify-between p-1 bg-tertiary rounded-sm border border-secondary truncate">
                <span>{file.name}</span>
                <span className="text-muted">{(file.size / 1024).toFixed(0)} KB</span>
              </div>
            ))}
            {files.length === 0 && (
              <div className="text-muted text-center py-2">No files uploaded yet</div>
            )}
          </div>
          <div className="bento-card-footer">
            <span>LAN Upload endpoint: {networkLink}</span>
            <span>Explore →</span>
          </div>
        </div>

        {/* Backup Status Card */}
        <div className="bento-card bg-accent-green" onClick={() => onNavigate('backup')}>
          <div className="bento-card-header">
            <span className="bento-card-title">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.375M9 18h3.375m-6.75 2.25h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 20.25zm7.5-12.75l.75-.75L13.5 6.75M12 7.5V3" />
              </svg>
              Database Backup
            </span>
            <span className="badge badge-neutral">Standby</span>
          </div>
          <div className="bento-card-value text-sm text-secondary">
            Encryption type: AES-256-GCM
            <br />
            Scheduled: Every 24 hrs
          </div>
          <div className="bento-card-footer">
            <span>Host partition backup ready</span>
            <span>Run Backup →</span>
          </div>
        </div>

        {/* Duplicates Cleaner Card */}
        <div className="bento-card bg-accent-orange" onClick={(e) => {
          e.stopPropagation();
          onNavigate('files');
        }}>
          <div className="bento-card-header">
            <span className="bento-card-title">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.231 0-4.334-.487-6.23-1.364z" />
              </svg>
              Duplicate Cleaner
            </span>
            <span className={`badge ${duplicateRemoveList.length > 0 ? 'badge-warning' : 'badge-success'}`}>
              {duplicateRemoveList.length > 0 ? `${duplicateRemoveList.length} Found` : 'Clean'}
            </span>
          </div>
          <div className="bento-card-value">
            {duplicateRemoveList.length} duplicates
          </div>
          {duplicateRemoveList.length > 0 && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (confirm(`Remove ${duplicateRemoveList.length} duplicate files permanently?`)) {
                  for (const file of duplicateRemoveList) {
                    await deleteFile(file.id);
                  }
                }
              }}
              className="btn"
              style={{
                background: 'var(--primary)',
                color: 'var(--bg-primary)',
                fontWeight: '700',
                padding: '0.4rem 0.8rem',
                fontSize: '0.8rem',
                borderRadius: 'var(--radius-sm)',
                marginTop: '0.25rem',
                alignSelf: 'flex-start'
              }}
            >
              Purge Duplicates
            </button>
          )}
          <div className="bento-card-footer">
            <span>Redundant copy scanner</span>
            <span>Purge →</span>
          </div>
        </div>

        {/* Chatbot Status Card - Spans 2 columns */}
        <div className="bento-card bento-span-2 bg-accent-purple" onClick={() => onNavigate('chatbot')}>
          <div className="bento-card-header">
            <span className="bento-card-title">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
              Local AI Engine
            </span>
            <span className="badge badge-info">Service Online</span>
          </div>
          <div className="text-sm text-secondary">
            Query your uploaded local files via chat interface. The AI model runs completely offline inside this app domain, preserving full compliance and local privacy.
          </div>
          <div className="bento-card-footer">
            <span>Model: Llama-3-Local (ready)</span>
            <span>Open Chat Console →</span>
          </div>
        </div>
      </div>
    </div>
  );
}
