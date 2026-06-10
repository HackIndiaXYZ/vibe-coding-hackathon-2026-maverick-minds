import React, { useState, useRef, useEffect } from 'react';
import { useChatbot } from '../hooks/useChatbot';
import type { GpuProfile } from '../../types';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeIcon(fileType?: string): string {
  switch (fileType) {
    case 'dockerfile': return 'DOCKER';
    case 'compose': return 'COMPOSE';
    case 'dockerignore': return 'IGNORE';
    default: return 'FILE';
  }
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`chatbot-status-dot ${ok ? 'ok' : 'err'}`} />;
}

export default function ChatbotConsole() {
  const {
    status,
    messages,
    contextFiles,
    loading,
    sending,
    dockerBusy,
    useContext,
    error,
    setUseContext,
    sendMessage,
    addFile,
    addDockerFiles,
    removeFile,
    updateConfig,
    startDocker,
    stopDocker,
    pullModel,
    clearChat,
    copyLanUrl,
    refreshStatus,
  } = useChatbot();

  const [input, setInput] = useState('');
  const [panel, setPanel] = useState<'chat' | 'engine' | 'context'>('chat');
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [model, setModel] = useState('');
  const [gpuProfile, setGpuProfile] = useState<GpuProfile>('cpu');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (status) {
      setOllamaUrl(status.ollamaUrl);
      setModel(status.model);
      setGpuProfile(status.docker.activeProfile);
    }
  }, [status]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || sending) return;
    const text = input;
    setInput('');
    await sendMessage(text);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSaveConfig = async () => {
    await updateConfig({ ollamaUrl, model, gpuProfile });
  };

  const chatUrl = status ? `http://${status.localIp}:${status.chatPort}/chat` : '';
  const docker = status?.docker;

  return (
    <div className="chatbot-layout">
      <header className="chatbot-header">
        <div>
          <div className="detail-header-label">
            <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" width="14" height="14">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            Local Cloud AI
          </div>
          <h2 className="chatbot-headline">Chatbot with cloud file context</h2>
        </div>

        <div className="chatbot-header-actions">
          <button type="button" onClick={clearChat} className="chatbot-ghost-btn">New chat</button>
          <button type="button" onClick={refreshStatus} className="chatbot-ghost-btn" disabled={loading}>Refresh</button>
        </div>
      </header>

      <div className="chatbot-status-row">
        <div className="chatbot-stat-card">
          <StatusDot ok={!!status?.ollamaConnected} />
          <div>
            <div className="chatbot-stat-label">LLM</div>
            <div className="chatbot-stat-value">{status?.ollamaConnected ? 'Connected' : 'Offline'}</div>
          </div>
        </div>
        <div className="chatbot-stat-card">
          <StatusDot ok={!!docker?.ollamaRunning} />
          <div>
            <div className="chatbot-stat-label">Docker Ollama</div>
            <div className="chatbot-stat-value">{docker?.ollamaRunning ? 'Running' : 'Stopped'}</div>
          </div>
        </div>
        <div className="chatbot-stat-card">
          <StatusDot ok={!!docker?.dockerRunning} />
          <div>
            <div className="chatbot-stat-label">Docker</div>
            <div className="chatbot-stat-value">{docker?.dockerInstalled ? (docker.dockerRunning ? 'Ready' : 'Not running') : 'Not installed'}</div>
          </div>
        </div>
        <div className="chatbot-stat-card">
          <div className="chatbot-stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16" height="16">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          </div>
          <div>
            <div className="chatbot-stat-label">Context</div>
            <div className="chatbot-stat-value">{status?.contextFileCount ?? 0} files</div>
          </div>
        </div>
      </div>

      {status && (
        <div className="chatbot-lan-bar">
          <div className="chatbot-lan-label">
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16" height="16">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3" />
            </svg>
            LAN access
          </div>
          <a href={chatUrl} target="_blank" rel="noreferrer" className="chatbot-lan-url">{status.localIp}:{status.chatPort}/chat</a>
          <button type="button" onClick={copyLanUrl} className="chatbot-ghost-btn chatbot-copy-btn">Copy</button>
        </div>
      )}

      {error && <div className="chatbot-error-banner">{error}</div>}

      <div className="chatbot-tabs">
        <button type="button" className={`chatbot-tab ${panel === 'chat' ? 'active' : ''}`} onClick={() => setPanel('chat')}>Chat</button>
        <button type="button" className={`chatbot-tab ${panel === 'engine' ? 'active' : ''}`} onClick={() => setPanel('engine')}>Engine & GPU</button>
        <button type="button" className={`chatbot-tab ${panel === 'context' ? 'active' : ''}`} onClick={() => setPanel('context')}>Context files</button>
      </div>

      <div className="chatbot-body">
        {panel === 'chat' && (
          <div className="chatbot-chat-panel">
            <div className="chatbot-messages">
              {messages.length === 0 && (
                <div className="chatbot-welcome">
                  <div className="chatbot-welcome-icon">✦</div>
                  <h3>Ask about your cloud files</h3>
                  <p>Add documents, Dockerfiles, or compose files as context. Other devices on your network can chat at the LAN URL above.</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`chatbot-msg-row chatbot-msg-row-${msg.role}`}>
                  <div className={`chatbot-avatar chatbot-avatar-${msg.role}`}>
                    {msg.role === 'user' ? 'You' : 'AI'}
                  </div>
                  <div className={`chatbot-bubble chatbot-bubble-${msg.role}`}>
                    <div className="chatbot-bubble-content">{msg.content}</div>
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="chatbot-bubble-sources">
                        {msg.sources.map((s) => (
                          <span key={s} className="chatbot-source-chip">{s}</span>
                        ))}
                      </div>
                    )}
                    <div className="chatbot-bubble-time">{formatTime(msg.timestamp)}</div>
                  </div>
                </div>
              ))}
              {sending && (
                <div className="chatbot-msg-row chatbot-msg-row-assistant">
                  <div className="chatbot-avatar chatbot-avatar-assistant">AI</div>
                  <div className="chatbot-bubble chatbot-bubble-assistant">
                    <div className="chatbot-typing-dots"><span /><span /><span /></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="chatbot-composer">
              <label className="chatbot-context-toggle">
                <input type="checkbox" checked={useContext} onChange={(e) => setUseContext(e.target.checked)} />
                Use cloud context
              </label>
              <div className="chatbot-composer-row">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question… (Enter to send, Shift+Enter for newline)"
                  className="chatbot-textarea"
                  rows={2}
                  disabled={sending}
                />
                <button type="button" onClick={() => handleSubmit()} className="chatbot-send-btn" disabled={sending || !input.trim()}>
                  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="18" height="18">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {panel === 'engine' && (
          <div className="chatbot-engine-panel">
            <section className="chatbot-section">
              <h3 className="chatbot-section-title">GPU profile</h3>
              <p className="chatbot-section-desc">Start Ollama in Docker with CPU, NVIDIA, or AMD ROCm acceleration.</p>
              <div className="chatbot-gpu-grid">
                {(['cpu', 'nvidia', 'amd'] as GpuProfile[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`chatbot-gpu-card ${gpuProfile === p ? 'active' : ''}`}
                    onClick={() => setGpuProfile(p)}
                    disabled={dockerBusy}
                  >
                    <div className="chatbot-gpu-icon">
                      {p === 'cpu' && '⚙️'}
                      {p === 'nvidia' && '🟢'}
                      {p === 'amd' && '🔴'}
                    </div>
                    <div className="chatbot-gpu-name">{p === 'cpu' ? 'CPU' : p === 'nvidia' ? 'NVIDIA CUDA' : 'AMD ROCm'}</div>
                    <div className="chatbot-gpu-hint">
                      {p === 'cpu' && 'No GPU required'}
                      {p === 'nvidia' && 'NVIDIA Container Toolkit'}
                      {p === 'amd' && 'ROCm drivers + render group'}
                    </div>
                  </button>
                ))}
              </div>
              <div className="chatbot-engine-actions">
                <button type="button" className="btn-primary" onClick={() => startDocker(gpuProfile)} disabled={dockerBusy || !docker?.dockerInstalled}>
                  {dockerBusy ? 'Starting…' : 'Start Ollama'}
                </button>
                <button type="button" className="chatbot-ghost-btn" onClick={stopDocker} disabled={dockerBusy || !docker?.ollamaRunning}>
                  Stop
                </button>
                <button type="button" className="chatbot-ghost-btn" onClick={() => pullModel(model)} disabled={dockerBusy || !docker?.ollamaRunning}>
                  Pull model
                </button>
              </div>
            </section>

            <section className="chatbot-section">
              <h3 className="chatbot-section-title">Run without Docker (Native Ollama)</h3>
              <p className="chatbot-section-desc">If you have Ollama installed directly on your machine, bypass Docker entirely.</p>
              <div className="chatbot-engine-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => updateConfig({ ollamaUrl: 'http://127.0.0.1:11434' })}
                >
                  Use Local System Ollama
                </button>
              </div>
              <p style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                Ensure the native Ollama application is running on your system (port 11434) before connecting.
              </p>
            </section>

            <section className="chatbot-section">
              <h3 className="chatbot-section-title">Connection settings</h3>
              <div className="chatbot-config-grid">
                <div className="chatbot-config-field">
                  <label>Ollama URL</label>
                  <input type="text" value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} className="chatbot-config-input" />
                </div>
                <div className="chatbot-config-field">
                  <label>Model</label>
                  <input type="text" value={model} onChange={(e) => setModel(e.target.value)} className="chatbot-config-input" />
                </div>
              </div>
              <button type="button" className="btn-primary chatbot-save-btn" onClick={handleSaveConfig}>Save settings</button>
            </section>

            {docker && docker.logs.length > 0 && (
              <section className="chatbot-section">
                <h3 className="chatbot-section-title">Docker logs</h3>
                <div className="console-output" style={{ height: '140px' }}>
                  {docker.logs.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {panel === 'context' && (
          <div className="chatbot-context-panel">
            <div className="chatbot-context-toolbar">
              <p className="chatbot-section-desc">
                Index files from cloud storage. Supports Dockerfiles, compose files, and text documents.
              </p>
              <div className="chatbot-context-actions">
                <button type="button" className="btn-primary" onClick={addFile}>+ Add file</button>
                <button type="button" className="chatbot-ghost-btn" onClick={addDockerFiles}>Index Docker files</button>
              </div>
            </div>

            {contextFiles.length === 0 ? (
              <div className="chatbot-welcome chatbot-welcome-compact">
                <div className="chatbot-welcome-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="32" height="32" style={{ color: 'var(--text-muted)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                </div>
                <h3>No context files indexed</h3>
                <p>Add files manually or scan your cloud storage for Dockerfiles and compose configs.</p>
              </div>
            ) : (
              <div className="chatbot-context-list">
                {contextFiles.map((file) => (
                  <div key={file.id} className="chatbot-context-item">
                    <div className="chatbot-context-icon">{fileTypeIcon(file.fileType)}</div>
                    <div className="chatbot-context-info">
                      <div className="chatbot-context-name">{file.name}</div>
                      <div className="chatbot-context-meta">
                        {file.fileType && <span className="chatbot-type-chip">{file.fileType}</span>}
                        {formatSize(file.size)} · {file.chunkCount} chunks
                      </div>
                      <div className="chatbot-context-path">{file.relativePath}</div>
                    </div>
                    <button type="button" className="chatbot-context-remove" onClick={() => removeFile(file.id)} aria-label="Remove">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
