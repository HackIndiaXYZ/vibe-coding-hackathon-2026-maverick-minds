import React, { useState, useEffect, useRef } from 'react';
import type { BackupStatus } from '../../types';

export default function BackupConsole() {
  const [jobId, setJobId] = useState<string>('');
  const [status, setStatus] = useState<BackupStatus>({
    jobId: '',
    progress: 0,
    status: 'idle',
    log: [],
    bytesWritten: 0
  });
  const outputEndRef = useRef<HTMLDivElement>(null);

  const startBackup = async () => {
    try {
      const res = await window.api.runBackup();
      setJobId(res.jobId);
      setStatus(prev => ({
        ...prev,
        jobId: res.jobId,
        status: 'running',
        progress: 0,
        log: ['Initializing backup...']
      }));
    } catch (err: any) {
      console.error(err);
      setStatus(prev => ({
        ...prev,
        status: 'error',
        log: [...prev.log, `[ERROR] ${err.message}`]
      }));
    }
  };

  useEffect(() => {
    if (!jobId) return;

    let timer: NodeJS.Timeout;

    const pollStatus = async () => {
      try {
        const data = await window.api.getBackupStatus(jobId);
        setStatus(data);

        if (data.status === 'complete' || data.status === 'error') {
          setJobId('');
        } else {
          timer = setTimeout(pollStatus, 1000);
        }
      } catch (err: any) {
        console.error(err);
        setJobId('');
      }
    };

    pollStatus();

    return () => {
      clearTimeout(timer);
    };
  }, [jobId]);

  useEffect(() => {
    if (outputEndRef.current) {
      outputEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [status.log]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <div className="detail-header-label">
          <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" width="14" height="14">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.375M9 18h3.375m-6.75 2.25h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 20.25zm7.5-12.75l.75-.75L13.5 6.75M12 7.5V3" />
          </svg>
          Encrypted Backups
        </div>
        <div className="detail-title">Cloud Backup Archive & Verification Console</div>

        <div className="detail-badges">
          <span className="priority-badge low">Low Priority</span>
          <span className="priority-badge low" style={{ background: '#f5f3f0', color: '#1c1b19' }}>
            Job: {status.jobId ? status.status.toUpperCase() : 'STANDBY'}
          </span>
        </div>
      </div>

      <div className="time-banner">
        <div className="time-banner-left">
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="18" height="18">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
          <span>Backup Payload Written:</span>
        </div>
        <span className="time-banner-value">
          {(status.bytesWritten / (1024 * 1024)).toFixed(2)} MB
        </span>
      </div>

      <div>
        <div className="detail-section-title">Description</div>
        <p className="detail-desc">
          Scan the entire root storage layout, copy verified files, apply symmetric AES-256 blocks, 
          and generate log outputs in a live transaction log interface below.
        </p>
      </div>

      <div>
        <button
          onClick={startBackup}
          className="btn-primary"
          disabled={status.status === 'running'}
          style={{ marginBottom: '16px' }}
        >
          {status.status === 'running' ? 'Running Backup...' : 'Run Full Backup'}
        </button>

        {status.status !== 'idle' && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              <span>Job Progress</span>
              <span>{status.progress}%</span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${status.progress}%`, background: '#1c1b19' }}></div>
            </div>
          </div>
        )}

        <div className="console-output">
          {status.log.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>Console ready. Click Run Full Backup to start.</div>
          ) : (
            status.log.map((line, idx) => (
              <div
                key={idx}
                className={line.includes('[ERROR]') ? 'console-line-error' : ''}
              >
                {line}
              </div>
            ))
          )}
          <div ref={outputEndRef} />
        </div>
      </div>

      <div>
        <div className="detail-section-title">Archive Specs</div>
        <div className="attachments-list">
          <div className="attachment-row">
            <div className="attachment-info">
              <div className="attachment-icon-container" style={{ backgroundColor: '#ffe2e5', color: '#ff4a6b' }}>
                SIGN
              </div>
              <div>
                <div className="attachment-name">AES-256 Symmetric Backup Stream</div>
                <div className="attachment-meta">Encrypted metadata index signatures</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
