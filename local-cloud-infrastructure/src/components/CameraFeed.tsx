import React, { useState, useRef, useEffect } from 'react';

export default function CameraFeed() {
  const [streaming, setStreaming] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [statusText, setStatusText] = useState<string>('Inactive');
  const [duration, setDuration] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startStreaming = async () => {
    try {
      const res = await window.api.startStream('local-cam');
      if (!res.success) {
        setStatusText(`Error: ${res.error}`);
        return;
      }
      setSessionId(res.sessionId || '');

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 360 },
        audio: false
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      const recorder = new MediaRecorder(mediaStream, { mimeType: 'video/webm; codecs=vp9' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          const buffer = await e.data.arrayBuffer();
          await window.api.saveBackupChunk(buffer);
        }
      };

      recorder.start(1000);
      setStreaming(true);
      setStatusText('Recording & Encrypting...');
      setDuration(0);
    } catch (err: any) {
      console.error(err);
      setStatusText(`Error: ${err.message}`);
    }
  };

  const stopStreaming = async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    await window.api.stopStream('local-cam');
    setStreaming(false);
    setSessionId('');
    setStatusText('Inactive');
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (streaming) {
      timer = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [streaming]);

  const formatDuration = (sec: number) => {
    const hrs = Math.floor(sec / 3600).toString().padStart(2, '0');
    const mins = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const secs = (sec % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <div className="detail-header-label">
          <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" width="14" height="14">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
          </svg>
          Surveillance Engine
        </div>
        <div className="detail-title">Live Video Capture & Symmetric Chunk Encryption</div>

        <div className="detail-badges">
          <span className="priority-badge high">High Priority</span>
          <span className="priority-badge low" style={{ background: '#f5f3f0', color: '#1c1b19' }}>
            {streaming ? 'Symmetric Pipeline Active' : 'Pipeline Standby'}
          </span>
        </div>
      </div>

      <div className="time-banner">
        <div className="time-banner-left">
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="18" height="18">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Stream Active Duration:</span>
        </div>
        <span className="time-banner-value">
          {formatDuration(duration)}
        </span>
      </div>

      <div>
        <div className="detail-section-title">Description</div>
        <p className="detail-desc">
          Capture user camera feed and route video segments directly to the local storage manager.
          Video chunks are partitioned in WebM/VP9 containers and encrypted in real-time.
        </p>
      </div>

      <div className="camera-viewport">
        {streaming ? (
          <div className="camera-indicator recording">
            <div className="pulse-dot"></div>
            <span>LIVE (ENCRYPTED)</span>
          </div>
        ) : (
          <div className="camera-indicator">
            <div className="pulse-dot" style={{ backgroundColor: 'var(--text-muted)' }}></div>
            <span>STANDBY</span>
          </div>
        )}
        <div className="camera-overlay-text">{statusText}</div>
        {streaming ? (
          <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
        ) : (
          <div className="camera-placeholder">
            <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" width="48" height="48">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 47.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
            <span>Camera Feed Ready</span>
          </div>
        )}
      </div>

      <div className="camera-controls">
        {!streaming ? (
          <button onClick={startStreaming} className="btn-primary">
            Start Live Capture
          </button>
        ) : (
          <button onClick={stopStreaming} className="btn-primary" style={{ backgroundColor: '#ff4a6b', color: '#ffffff' }}>
            Stop & Save
          </button>
        )}
      </div>

      <div>
        <div className="detail-section-title">Stream Configuration</div>
        <div className="attachments-list">
          <div className="attachment-row">
            <div className="attachment-info">
              <div className="attachment-icon-container" style={{ backgroundColor: '#ffe2e5', color: '#ff4a6b' }}>
                🎦
              </div>
              <div>
                <div className="attachment-name">VP9 WebM Live Stream Container</div>
                <div className="attachment-meta">640x360 resolution, audio disabled</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="comments-tabs">
          <button className="comments-tab-btn active">Session Logs</button>
        </div>

        <div className="comment-item">
          <div className="comment-avatar">SYS</div>
          <div className="comment-body">
            <div className="comment-meta">
              <span className="comment-user">Camera Daemon</span>
              <span className="comment-time">System Event</span>
            </div>
            <div className="comment-text">
              {sessionId ? `New hardware stream initialized with Session ID ${sessionId}` : 'Surveillance system stands by in secure administrative vault.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
