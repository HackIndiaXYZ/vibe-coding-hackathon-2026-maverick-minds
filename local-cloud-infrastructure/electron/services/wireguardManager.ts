/**
 * wireguardManager.ts
 *
 * WireGuard VPN management for the Ubiquity desktop app.
 *
 * Architecture:
 *  - This PC acts as a WireGuard server (wg0: 10.0.0.1/24)
 *  - Each client device gets a peer config + QR code
 *  - Tunnelled clients reach the HTTP server at http://10.0.0.1:8080
 *
 * Requirements:
 *  - WireGuard must be installed on the host: `winget install WireGuard.WireGuard`
 *  - `wg.exe` and `wg-quick.exe` (or `wireguard.exe /installtunnelservice`) must be in PATH
 *
 * Config location: %APPDATA%/Ubiquity/wireguard/
 */

import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile, exec } from 'child_process';
import { promisify } from 'util';
import QRCode from 'qrcode';

const execFileAsync = promisify(execFile);
const execAsync    = promisify(exec);

// ─── Paths ────────────────────────────────────────────────────────────────────

function getWgDir(): string {
  return path.join(app.getPath('userData'), 'wireguard');
}

function getServerConfPath(): string {
  return path.join(getWgDir(), 'wg0.conf');
}

function getPeersDataPath(): string {
  return path.join(getWgDir(), 'peers.json');
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WgPeer {
  name:       string;
  publicKey:  string;
  privateKey: string;  // stored locally to regenerate client conf
  allowedIp:  string;  // e.g. 10.0.0.2/32
  addedAt:    number;
}

export interface WgServerConfig {
  privateKey:    string;
  publicKey:     string;
  listenPort:    number;
  serverIp:      string;   // e.g. 10.0.0.1/24
  publicEndpoint: string;  // public IP or hostname
}

export interface WgStatus {
  running:   boolean;
  peers:     { publicKey: string; lastHandshake: string; endpoint: string }[];
  interface: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureWgDir(): void {
  const dir = getWgDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Find wg.exe — works whether WireGuard is in PATH or installed to Program Files */
async function findWgExe(): Promise<string> {
  // Try PATH first
  try {
    const { stdout } = await execAsync('where wg');
    const found = stdout.trim().split('\n')[0].trim();
    if (found) return found;
  } catch {}
  // Fallback to default install location
  const defaults = [
    'C:\\Program Files\\WireGuard\\wg.exe',
    'C:\\Program Files (x86)\\WireGuard\\wg.exe',
  ];
  for (const p of defaults) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('wg.exe not found. Install WireGuard: winget install WireGuard.WireGuard');
}

async function findWireGuardExe(): Promise<string> {
  const defaults = [
    'C:\\Program Files\\WireGuard\\wireguard.exe',
    'C:\\Program Files (x86)\\WireGuard\\wireguard.exe',
  ];
  for (const p of defaults) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('wireguard.exe not found. Install WireGuard: winget install WireGuard.WireGuard');
}

/** Generate a WireGuard keypair using wg.exe */
async function generateKeypair(wgExe: string): Promise<{ privateKey: string; publicKey: string }> {
  // wg genkey outputs a private key; pipe it to wg pubkey for the public key
  // On Windows we use PowerShell to pipe
  const { stdout: privateKey } = await execAsync(`"${wgExe}" genkey`);
  const pk = privateKey.trim();
  const { stdout: publicKey } = await execAsync(`echo ${pk} | "${wgExe}" pubkey`);
  return { privateKey: pk, publicKey: publicKey.trim() };
}

// ─── Load / Save server config ────────────────────────────────────────────────

function loadServerConfig(): WgServerConfig | null {
  const confPath = path.join(getWgDir(), 'server-meta.json');
  if (!fs.existsSync(confPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(confPath, 'utf8'));
  } catch { return null; }
}

function saveServerConfig(cfg: WgServerConfig): void {
  ensureWgDir();
  fs.writeFileSync(
    path.join(getWgDir(), 'server-meta.json'),
    JSON.stringify(cfg, null, 2),
    'utf8',
  );
}

function loadPeers(): WgPeer[] {
  if (!fs.existsSync(getPeersDataPath())) return [];
  try {
    return JSON.parse(fs.readFileSync(getPeersDataPath(), 'utf8'));
  } catch { return []; }
}

function savePeers(peers: WgPeer[]): void {
  ensureWgDir();
  fs.writeFileSync(getPeersDataPath(), JSON.stringify(peers, null, 2), 'utf8');
}

// ─── Build wg0.conf ───────────────────────────────────────────────────────────

function buildServerConf(cfg: WgServerConfig, peers: WgPeer[]): string {
  const lines = [
    '[Interface]',
    `PrivateKey = ${cfg.privateKey}`,
    `Address = ${cfg.serverIp}`,
    `ListenPort = ${cfg.listenPort}`,
    '',
  ];

  for (const peer of peers) {
    lines.push('[Peer]');
    lines.push(`# ${peer.name}`);
    lines.push(`PublicKey = ${peer.publicKey}`);
    lines.push(`AllowedIPs = ${peer.allowedIp}`);
    lines.push('');
  }

  return lines.join('\n');
}

function buildPeerClientConf(
  peerPrivateKey: string,
  peerAllowedIp: string,
  serverPublicKey: string,
  serverEndpoint: string,
  serverListenPort: number,
): string {
  const peerAddress = peerAllowedIp.replace('/32', '/24');
  return [
    '[Interface]',
    `PrivateKey = ${peerPrivateKey}`,
    `Address = ${peerAddress}`,
    `DNS = 1.1.1.1`,
    '',
    '[Peer]',
    `PublicKey = ${serverPublicKey}`,
    `Endpoint = ${serverEndpoint}:${serverListenPort}`,
    `AllowedIPs = 10.0.0.0/24`,
    `PersistentKeepalive = 25`,
    '',
  ].join('\n');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Check if wg.exe is available */
export async function checkWireGuardInstalled(): Promise<{ installed: boolean; path?: string; error?: string }> {
  try {
    const wgPath = await findWgExe();
    return { installed: true, path: wgPath };
  } catch (e: any) {
    return { installed: false, error: e.message };
  }
}

/** Initialize the WireGuard server — generates server keypair, writes wg0.conf */
export async function initServer(publicEndpoint: string, listenPort = 51820): Promise<WgServerConfig> {
  ensureWgDir();
  const wgExe = await findWgExe();

  // Reuse existing config if present
  const existing = loadServerConfig();
  if (existing) {
    // Update endpoint/port only
    existing.publicEndpoint = publicEndpoint;
    existing.listenPort     = listenPort;
    saveServerConfig(existing);
    rewriteConfFile(existing);
    return existing;
  }

  const { privateKey, publicKey } = await generateKeypair(wgExe);
  const cfg: WgServerConfig = {
    privateKey,
    publicKey,
    listenPort,
    serverIp:       '10.0.0.1/24',
    publicEndpoint,
  };

  saveServerConfig(cfg);
  rewriteConfFile(cfg);
  return cfg;
}

function rewriteConfFile(cfg: WgServerConfig): void {
  const peers = loadPeers();
  const conf  = buildServerConf(cfg, peers);
  fs.writeFileSync(getServerConfPath(), conf, 'utf8');
}

/** Add a new peer device; returns the client config string + QR code as base64 PNG */
export async function addPeer(name: string): Promise<{
  peer: WgPeer;
  clientConf: string;
  qrBase64: string;
}> {
  const cfg = loadServerConfig();
  if (!cfg) throw new Error('Server not initialized. Call initServer first.');

  const wgExe = await findWgExe();
  const { privateKey, publicKey } = await generateKeypair(wgExe);

  const peers = loadPeers();

  // Assign next IP in subnet (10.0.0.2, 10.0.0.3 …)
  const usedOctets = peers.map(p => parseInt(p.allowedIp.split('.')[3]));
  let nextOctet = 2;
  while (usedOctets.includes(nextOctet)) nextOctet++;
  if (nextOctet > 254) throw new Error('VPN subnet full (max 253 peers).');

  const peer: WgPeer = {
    name,
    publicKey,
    privateKey,
    allowedIp: `10.0.0.${nextOctet}/32`,
    addedAt:   Date.now(),
  };

  peers.push(peer);
  savePeers(peers);
  rewriteConfFile(cfg);

  const clientConf = buildPeerClientConf(
    privateKey,
    peer.allowedIp,
    cfg.publicKey,
    cfg.publicEndpoint,
    cfg.listenPort,
  );

  // Generate QR PNG as base64 data URL
  const qrBase64 = await QRCode.toDataURL(clientConf, { errorCorrectionLevel: 'M', width: 300 });

  return { peer, clientConf, qrBase64 };
}

/** List all configured peers */
export function listPeers(): WgPeer[] {
  return loadPeers();
}

/** Remove a peer by public key */
export function removePeer(publicKey: string): void {
  const cfg = loadServerConfig();
  let peers = loadPeers();
  peers = peers.filter(p => p.publicKey !== publicKey);
  savePeers(peers);
  if (cfg) rewriteConfFile(cfg);
}

/** Get server config metadata (without private key for renderer) */
export function getServerMeta(): Omit<WgServerConfig, 'privateKey'> | null {
  const cfg = loadServerConfig();
  if (!cfg) return null;
  const { privateKey: _omit, ...safe } = cfg;
  return safe;
}

/** Start the WireGuard tunnel (installs as Windows service) */
export async function startTunnel(): Promise<{ success: boolean; error?: string }> {
  try {
    const confPath  = getServerConfPath();
    if (!fs.existsSync(confPath)) throw new Error('No wg0.conf found. Initialize server first.');
    const wireGuard = await findWireGuardExe();
    // On Windows, installing the tunnel service requires administrator privileges.
    // Running it via powershell Start-Process with -Verb RunAs triggers the UAC prompt.
    const escapedWireGuard = wireGuard.replace(/"/g, '\\"');
    const escapedConfPath = confPath.replace(/"/g, '\\"');
    const psCommand = `Start-Process -FilePath '${escapedWireGuard}' -ArgumentList '/installtunnelservice', '${escapedConfPath}' -Verb RunAs -WindowStyle Hidden -Wait`;
    await execAsync(`powershell -Command "${psCommand}"`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/** Stop the WireGuard tunnel */
export async function stopTunnel(): Promise<{ success: boolean; error?: string }> {
  try {
    const wireGuard = await findWireGuardExe();
    // Uninstalling the tunnel service also requires administrator privileges.
    const escapedWireGuard = wireGuard.replace(/"/g, '\\"');
    const psCommand = `Start-Process -FilePath '${escapedWireGuard}' -ArgumentList '/uninstalltunnelservice', 'wg0' -Verb RunAs -WindowStyle Hidden -Wait`;
    await execAsync(`powershell -Command "${psCommand}"`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/** Get current tunnel status via `wg show` */
export async function getTunnelStatus(): Promise<WgStatus> {
  try {
    const wgExe = await findWgExe();
    const { stdout } = await execAsync(`"${wgExe}" show wg0`);

    const running = stdout.includes('interface: wg0') || stdout.includes('listening port');
    const peerBlocks = stdout.split('\n\n').slice(1);
    const peers = peerBlocks
      .filter(b => b.includes('peer:'))
      .map(block => {
        const publicKey   = (block.match(/peer:\s*(\S+)/))?.[1] ?? '';
        const lastHandshake = (block.match(/latest handshake:\s*(.+)/))?.[1]?.trim() ?? 'Never';
        const endpoint    = (block.match(/endpoint:\s*(\S+)/))?.[1] ?? '';
        return { publicKey, lastHandshake, endpoint };
      });

    return { running, peers, interface: 'wg0' };
  } catch {
    // wg show fails if tunnel is down — that's normal
    return { running: false, peers: [], interface: null };
  }
}

/** Regenerate + return client config for an existing peer (e.g. for re-display) */
export async function getPeerClientConf(publicKey: string): Promise<{
  clientConf: string;
  qrBase64: string;
} | null> {
  const cfg   = loadServerConfig();
  const peers = loadPeers();
  const peer  = peers.find(p => p.publicKey === publicKey);
  if (!cfg || !peer) return null;

  const clientConf = buildPeerClientConf(
    peer.privateKey,
    peer.allowedIp,
    cfg.publicKey,
    cfg.publicEndpoint,
    cfg.listenPort,
  );

  const qrBase64 = await QRCode.toDataURL(clientConf, { errorCorrectionLevel: 'M', width: 300 });
  return { clientConf, qrBase64 };
}
