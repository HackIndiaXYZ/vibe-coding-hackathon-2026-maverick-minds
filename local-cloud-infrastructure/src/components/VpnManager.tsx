import React, { useState, useEffect, useCallback } from 'react';

declare const vpn: {
  checkInstalled: () => Promise<{ installed: boolean; path?: string; error?: string }>;
  initServer: (endpoint: string, port: number) => Promise<{ success: boolean; config?: any; error?: string }>;
  addPeer: (name: string) => Promise<{ success: boolean; peer?: any; clientConf?: string; qrBase64?: string; error?: string }>;
  listPeers: () => Promise<any[]>;
  removePeer: (publicKey: string) => Promise<{ success: boolean; error?: string }>;
  serverMeta: () => Promise<any | null>;
  start: () => Promise<{ success: boolean; error?: string }>;
  stop: () => Promise<{ success: boolean; error?: string }>;
  status: () => Promise<{ running: boolean; peers: any[]; interface: string | null }>;
  peerQr: (publicKey: string) => Promise<{ success: boolean; clientConf?: string; qrBase64?: string; error?: string }>;
  saveConfigFile: (clientConf: string, fileName: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
};

interface Peer { name: string; publicKey: string; allowedIp: string; addedAt: number; }
interface TunnelPeer { publicKey: string; lastHandshake: string; endpoint: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncateKey(k: string) { return k.slice(0, 8) + '…' + k.slice(-6); }
function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="vpn-status-badge" data-ok={ok}>
      <span className="vpn-status-dot" />
      {label}
    </span>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="vpn-section">
      <h3 className="vpn-section-title">{title}</h3>
      <div className="vpn-section-body">{children}</div>
    </div>
  );
}

// ─── QR Modal ─────────────────────────────────────────────────────────────────

function QrModal({ peerName, qrBase64, clientConf, onClose }: {
  peerName: string; qrBase64: string; clientConf: string; onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const copy = async () => {
    await navigator.clipboard.writeText(clientConf);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportConfig = async () => {
    const filename = `${peerName.toLowerCase().replace(/\s+/g, '_')}.conf`;
    try {
      if (typeof vpn.saveConfigFile !== 'function') {
        throw new Error('VPN saveConfigFile function not found. Please restart the Electron app.');
      }
      const res = await vpn.saveConfigFile(clientConf, filename);
      if (res.success) {
        setSaveStatus('Saved!');
        setTimeout(() => setSaveStatus(null), 3000);
      } else if (res.error) {
        setSaveStatus('Error');
        showToast(`Error: ${res.error}`);
        setTimeout(() => setSaveStatus(null), 3000);
      } else {
        // User canceled
        setSaveStatus(null);
      }
    } catch (e: any) {
      console.error(e);
      setSaveStatus('Failed');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  return (
    <div className="vpn-modal-backdrop" onClick={onClose}>
      <div className="vpn-modal" onClick={e => e.stopPropagation()}>
        <div className="vpn-modal-header">
          <span className="vpn-modal-title">Connect — {peerName}</span>
          <button className="vpn-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="vpn-modal-body">
          <p className="vpn-modal-hint">Scan this QR in the WireGuard app on your phone or tablet, or download the configuration file for your computer.</p>
          <div className="vpn-qr-wrap">
            <img src={qrBase64} alt="WireGuard QR code" className="vpn-qr-img" />
          </div>

          <div className="vpn-conf-block">
            <pre className="vpn-conf-pre">{clientConf}</pre>
          </div>

          <div className="vpn-modal-actions">
            <button className="vpn-btn vpn-btn-secondary" onClick={copy}>
              {copied ? 'Copied!' : 'Copy Config'}
            </button>
            <button className="vpn-btn vpn-btn-secondary" onClick={exportConfig}>
              {saveStatus ? saveStatus : 'Download .conf File'}
            </button>
            <button className="vpn-btn vpn-btn-primary" onClick={onClose}>Done</button>
          </div>

          <div className="vpn-hint-box">
            <strong>After connecting:</strong> In Ubiquity mobile Settings, set Server IP to <code>10.0.0.1</code> and tap Test Connection.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function VpnManager() {
  const [vpnType, setVpnType] = useState<'wireguard' | 'tailscale'>('tailscale');

  // Install check
  const [wgInstalled, setWgInstalled]   = useState<boolean | null>(null);
  const [wgPath, setWgPath]             = useState('');

  // Server setup
  const [endpoint, setEndpoint]   = useState('');
  const [port, setPort]           = useState('51820');
  const [serverMeta, setServerMeta] = useState<any | null>(null);
  const [initBusy, setInitBusy]   = useState(false);

  // Tunnel status
  const [tunnelRunning, setTunnelRunning] = useState(false);
  const [tunnelPeers, setTunnelPeers]     = useState<TunnelPeer[]>([]);
  const [tunnelBusy, setTunnelBusy]       = useState(false);

  // Peers
  const [peers, setPeers]       = useState<Peer[]>([]);
  const [newPeerName, setNewPeerName] = useState('');
  const [addingPeer, setAddingPeer] = useState(false);

  // QR modal
  const [qrData, setQrData] = useState<{ peerName: string; qrBase64: string; clientConf: string } | null>(null);

  // Misc
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  // ── Load on mount ──
  useEffect(() => {
    checkInstall();
  }, []);

  const checkInstall = async () => {
    const res = await vpn.checkInstalled();
    setWgInstalled(res.installed);
    if (res.path) setWgPath(res.path);
    if (res.installed) {
      loadMeta();
      loadPeers();
      pollStatus();
    }
  };

  const loadMeta = async () => {
    const meta = await vpn.serverMeta();
    setServerMeta(meta);
    if (meta?.publicEndpoint) setEndpoint(meta.publicEndpoint);
    if (meta?.listenPort) setPort(String(meta.listenPort));
  };

  const loadPeers = async () => {
    const list = await vpn.listPeers();
    setPeers(list);
  };

  const pollStatus = useCallback(async () => {
    const s = await vpn.status();
    setTunnelRunning(s.running);
    setTunnelPeers(s.peers);
  }, []);

  // Poll tunnel status every 8 seconds when component is mounted
  useEffect(() => {
    if (!wgInstalled) return;
    pollStatus();
    const id = setInterval(pollStatus, 8000);
    return () => clearInterval(id);
  }, [wgInstalled, pollStatus]);

  // ── Server init ──
  const handleInitServer = async () => {
    if (!endpoint.trim()) { setError('Enter a public endpoint (IP or domain).'); return; }
    setInitBusy(true); setError('');
    const res = await vpn.initServer(endpoint.trim(), parseInt(port) || 51820);
    setInitBusy(false);
    if (res.success) {
      setServerMeta(res.config);
      showToast('VPN server initialized.');
    } else {
      setError(res.error || 'Failed to initialize server.');
    }
  };

  // ── Tunnel control ──
  const handleStart = async () => {
    setTunnelBusy(true); setError('');
    const res = await vpn.start();
    setTunnelBusy(false);
    if (res.success) { showToast('Tunnel started.'); pollStatus(); }
    else setError(res.error || 'Failed to start tunnel. Run the app as Administrator.');
  };

  const handleStop = async () => {
    setTunnelBusy(true); setError('');
    const res = await vpn.stop();
    setTunnelBusy(false);
    if (res.success) { showToast('Tunnel stopped.'); pollStatus(); }
    else setError(res.error || 'Failed to stop tunnel.');
  };

  // ── Add peer ──
  const handleAddPeer = async () => {
    if (!newPeerName.trim()) return;
    setAddingPeer(true); setError('');
    const res = await vpn.addPeer(newPeerName.trim());
    setAddingPeer(false);
    if (res.success && res.peer && res.qrBase64 && res.clientConf) {
      setNewPeerName('');
      await loadPeers();
      setQrData({ peerName: res.peer.name, qrBase64: res.qrBase64, clientConf: res.clientConf });
    } else {
      setError(res.error || 'Failed to add peer.');
    }
  };

  // ── Remove peer ──
  const handleRemovePeer = async (publicKey: string, name: string) => {
    if (!confirm(`Remove device "${name}"? Their VPN access will be revoked.`)) return;
    const res = await vpn.removePeer(publicKey);
    if (res.success) { showToast(`"${name}" removed.`); loadPeers(); }
    else setError(res.error || 'Failed to remove peer.');
  };

  // ── Show QR for existing peer ──
  const handleShowQr = async (publicKey: string, name: string) => {
    const res = await vpn.peerQr(publicKey);
    if (res.success && res.qrBase64 && res.clientConf) {
      setQrData({ peerName: name, qrBase64: res.qrBase64, clientConf: res.clientConf });
    } else {
      setError(res.error || 'Failed to generate QR.');
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="vpn-manager">
      <div className="vpn-header">
        <h2 className="vpn-title">Remote Access (VPN)</h2>
        <p className="vpn-subtitle">Securely access your cloud vault and camera feeds from anywhere.</p>
      </div>

      {/* Segment Switcher */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button
          className={`vpn-btn ${vpnType === 'tailscale' ? 'vpn-btn-primary' : 'vpn-btn-secondary'}`}
          onClick={() => setVpnType('tailscale')}
          style={{ flex: 1, height: '42px', fontWeight: '600' }}
        >
          Tailscale VPN (Recommended)
        </button>
        <button
          className={`vpn-btn ${vpnType === 'wireguard' ? 'vpn-btn-primary' : 'vpn-btn-secondary'}`}
          onClick={() => setVpnType('wireguard')}
          style={{ flex: 1, height: '42px', fontWeight: '600' }}
        >
          WireGuard (Self-Hosted)
        </button>
      </div>

      {/* Toast */}
      {toast && <div className="vpn-toast">{toast}</div>}
      {error && (
        <div className="vpn-error-bar">
          <span>{error}</span>
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {vpnType === 'tailscale' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <SectionCard title="Tailscale VPN — Zero-Config Remote Access">
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid var(--border-secondary)', paddingBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)' }}>Zero-Configuration Mesh Network</h4>
                <span className="vpn-status-badge" data-ok={true} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'rgb(34, 197, 94)', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700' }}>
                  <span className="vpn-status-dot" style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'rgb(34, 197, 94)' }} />
                  Active / Ready
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.9rem', lineHeight: '1.5' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ color: '#f59e0b', fontWeight: '800', fontSize: '1.05rem', minWidth: '20px' }}>1.</span>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>Install Tailscale on this Host PC:</strong> Download and install Tailscale, then sign in with your account.
                    <div style={{ marginTop: '10px' }}>
                      <a href="https://tailscale.com/download" target="_blank" rel="noopener noreferrer" className="vpn-btn vpn-btn-secondary" style={{ display: 'inline-flex', padding: '6px 12px', fontSize: '0.8rem', textDecoration: 'none', height: 'auto', alignSelf: 'flex-start' }}>
                        Download Tailscale for Windows
                      </a>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ color: '#f59e0b', fontWeight: '800', fontSize: '1.05rem', minWidth: '20px' }}>2.</span>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>Install on Remote Devices:</strong> Install the Tailscale app on your iPhone, Android phone, or remote client computer, and sign in with the <strong>same</strong> account.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ color: '#f59e0b', fontWeight: '800', fontSize: '1.05rem', minWidth: '20px' }}>3.</span>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>Retrieve Host IP:</strong> Look at your Tailscale app on this PC. Copy the <strong>100.x.y.z</strong> IP address (or the MagicDNS hostname) assigned to this machine.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ color: '#f59e0b', fontWeight: '800', fontSize: '1.05rem', minWidth: '20px' }}>4.</span>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>Configure Connection:</strong> Enter your host PC's Tailscale IP address in the settings of your client apps:
                    <div className="vpn-hint-box" style={{ marginTop: '12px', background: 'var(--bg-primary)', padding: '12px', borderRadius: '10px', border: '1.5px solid var(--border-secondary)' }}>
                      <div style={{ marginBottom: '6px' }}>• <strong>Mobile Settings:</strong> Go to settings, update the Host IP field to your <strong>100.x.y.z IP</strong> (Port stays <code>8080</code>).</div>
                      <div>• <strong>Web Portal Settings:</strong> Go to Configuration, enter your <strong>100.x.y.z IP</strong> in the Host IP field and establish link.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      ) : (
        <>
          {/* ── Step 1: Install Check ── */}
          <SectionCard title="1 — WireGuard Installation">
            <div className="vpn-row">
              {wgInstalled === null && <span className="vpn-checking">Checking…</span>}
              {wgInstalled === true  && <StatusBadge ok={true}  label={`Installed  ${wgPath}`} />}
              {wgInstalled === false && <StatusBadge ok={false} label="WireGuard not found" />}
            </div>

            {wgInstalled === false && (
              <div className="vpn-install-guide">
                <p>Install WireGuard on this PC, then reopen the app:</p>
                <div className="vpn-code-row">
                  <code className="vpn-code">winget install WireGuard.WireGuard</code>
                  <button
                    className="vpn-btn vpn-btn-secondary"
                    onClick={() => { navigator.clipboard.writeText('winget install WireGuard.WireGuard'); showToast('Copied!'); }}
                  >
                    Copy
                  </button>
                </div>
                <button className="vpn-btn vpn-btn-ghost" onClick={checkInstall} style={{ marginTop: 8 }}>
                  Re-check
                </button>
              </div>
            )}
          </SectionCard>

          {wgInstalled && (
            <>
              {/* ── Step 2: Server Setup ── */}
              <SectionCard title="2 — Server Configuration">
                <div className="vpn-form-grid">
                  <label className="vpn-label">
                    Public Endpoint
                    <span className="vpn-label-hint">(your home IP or domain name — no port)</span>
                  </label>
                  <input
                    className="vpn-input"
                    placeholder="e.g. 203.0.113.42  or  myhome.duckdns.org"
                    value={endpoint}
                    onChange={e => setEndpoint(e.target.value)}
                  />

                  <label className="vpn-label">UDP Listen Port</label>
                  <input
                    className="vpn-input vpn-input-short"
                    placeholder="51820"
                    value={port}
                    onChange={e => setPort(e.target.value)}
                  />
                </div>

                <div className="vpn-hint-box">
                  Forward <strong>UDP {port || '51820'}</strong> on your router to this machine's local IP. Then enter your public IP above.
                </div>

                {serverMeta && (
                  <div className="vpn-meta-row">
                    <span className="vpn-meta-label">Server Public Key</span>
                    <code className="vpn-meta-value">{truncateKey(serverMeta.publicKey)}</code>
                    <span className="vpn-meta-label">VPN Subnet</span>
                    <code className="vpn-meta-value">{serverMeta.serverIp}</code>
                  </div>
                )}

                <button
                  className="vpn-btn vpn-btn-primary"
                  onClick={handleInitServer}
                  disabled={initBusy}
                >
                  {initBusy ? 'Initializing…' : serverMeta ? 'Update Endpoint' : 'Initialize VPN Server'}
                </button>
              </SectionCard>

              {/* ── Step 3: Tunnel Control ── */}
              {serverMeta && (
                <SectionCard title="3 — Tunnel Control">
                  <div className="vpn-tunnel-row">
                    <StatusBadge ok={tunnelRunning} label={tunnelRunning ? 'Tunnel Running' : 'Tunnel Stopped'} />
                    {tunnelRunning ? (
                      <button className="vpn-btn vpn-btn-danger" onClick={handleStop} disabled={tunnelBusy}>
                        {tunnelBusy ? 'Stopping…' : 'Stop Tunnel'}
                      </button>
                    ) : (
                      <button className="vpn-btn vpn-btn-primary" onClick={handleStart} disabled={tunnelBusy}>
                        {tunnelBusy ? 'Starting…' : 'Start Tunnel'}
                      </button>
                    )}
                  </div>

                  <div className="vpn-hint-box" style={{ marginTop: 8 }}>
                    Starting the tunnel installs a Windows service. You may see a UAC prompt — approve it.
                  </div>

                  {/* Live peer handshakes */}
                  {tunnelPeers.length > 0 && (
                    <div className="vpn-handshake-table">
                      <div className="vpn-ht-header">
                        <span>Device</span>
                        <span>Last Handshake</span>
                        <span>Endpoint</span>
                      </div>
                      {tunnelPeers.map(tp => {
                        const peer = peers.find(p => p.publicKey === tp.publicKey);
                        return (
                          <div className="vpn-ht-row" key={tp.publicKey}>
                            <span>{peer?.name ?? truncateKey(tp.publicKey)}</span>
                            <span>{tp.lastHandshake}</span>
                            <span>{tp.endpoint || '—'}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionCard>
              )}

              {/* ── Step 4: Peer Devices ── */}
              {serverMeta && (
                <SectionCard title="4 — Client Devices">
                  <div className="vpn-add-peer-row">
                    <input
                      className="vpn-input"
                      placeholder="Device name (e.g. iPhone, Laptop)"
                      value={newPeerName}
                      onChange={e => setNewPeerName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddPeer()}
                    />
                    <button
                      className="vpn-btn vpn-btn-primary"
                      onClick={handleAddPeer}
                      disabled={addingPeer || !newPeerName.trim()}
                    >
                      {addingPeer ? 'Adding…' : 'Add Device'}
                    </button>
                  </div>

                  {peers.length === 0 ? (
                    <div className="vpn-empty">No devices added yet. Add one above to generate a QR code.</div>
                  ) : (
                    <div className="vpn-peer-list">
                      {peers.map(peer => {
                        const liveHandshake = tunnelPeers.find(t => t.publicKey === peer.publicKey);
                        return (
                          <div className="vpn-peer-card" key={peer.publicKey}>
                            <div className="vpn-peer-info">
                              <span className="vpn-peer-name">{peer.name}</span>
                              <span className="vpn-peer-ip">{peer.allowedIp}</span>
                              <span className="vpn-peer-date">Added {fmtDate(peer.addedAt)}</span>
                              {liveHandshake && (
                                <span className="vpn-peer-handshake">
                                  Last seen: {liveHandshake.lastHandshake}
                                </span>
                              )}
                            </div>
                            <div className="vpn-peer-actions">
                              <button
                                className="vpn-btn vpn-btn-secondary"
                                onClick={() => handleShowQr(peer.publicKey, peer.name)}
                              >
                                Show QR
                              </button>
                              <button
                                className="vpn-btn vpn-btn-danger-outline"
                                onClick={() => handleRemovePeer(peer.publicKey, peer.name)}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="vpn-hint-box" style={{ marginTop: 12 }}>
                    After scanning the QR, set the server IP in Ubiquity mobile to <code>10.0.0.1</code> and the port stays <code>8080</code>.
                  </div>
                </SectionCard>
              )}
            </>
          )}
        </>
      )}

      {/* QR Modal */}
      {qrData && (
        <QrModal
          peerName={qrData.peerName}
          qrBase64={qrData.qrBase64}
          clientConf={qrData.clientConf}
          onClose={() => setQrData(null)}
        />
      )}
    </div>
  );
}
