"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkWireGuardInstalled = checkWireGuardInstalled;
exports.initServer = initServer;
exports.addPeer = addPeer;
exports.listPeers = listPeers;
exports.removePeer = removePeer;
exports.getServerMeta = getServerMeta;
exports.startTunnel = startTunnel;
exports.stopTunnel = stopTunnel;
exports.getTunnelStatus = getTunnelStatus;
exports.getPeerClientConf = getPeerClientConf;
const electron_1 = require("electron");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const qrcode_1 = __importDefault(require("qrcode"));
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
const execAsync = (0, util_1.promisify)(child_process_1.exec);
// ─── Paths ────────────────────────────────────────────────────────────────────
function getWgDir() {
    return path_1.default.join(electron_1.app.getPath('userData'), 'wireguard');
}
function getServerConfPath() {
    return path_1.default.join(getWgDir(), 'wg0.conf');
}
function getPeersDataPath() {
    return path_1.default.join(getWgDir(), 'peers.json');
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
function ensureWgDir() {
    const dir = getWgDir();
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
}
/** Find wg.exe — works whether WireGuard is in PATH or installed to Program Files */
async function findWgExe() {
    // Try PATH first
    try {
        const { stdout } = await execAsync('where wg');
        const found = stdout.trim().split('\n')[0].trim();
        if (found)
            return found;
    }
    catch { }
    // Fallback to default install location
    const defaults = [
        'C:\\Program Files\\WireGuard\\wg.exe',
        'C:\\Program Files (x86)\\WireGuard\\wg.exe',
    ];
    for (const p of defaults) {
        if (fs_1.default.existsSync(p))
            return p;
    }
    throw new Error('wg.exe not found. Install WireGuard: winget install WireGuard.WireGuard');
}
async function findWireGuardExe() {
    const defaults = [
        'C:\\Program Files\\WireGuard\\wireguard.exe',
        'C:\\Program Files (x86)\\WireGuard\\wireguard.exe',
    ];
    for (const p of defaults) {
        if (fs_1.default.existsSync(p))
            return p;
    }
    throw new Error('wireguard.exe not found. Install WireGuard: winget install WireGuard.WireGuard');
}
/** Generate a WireGuard keypair using wg.exe */
async function generateKeypair(wgExe) {
    // wg genkey outputs a private key; pipe it to wg pubkey for the public key
    // On Windows we use PowerShell to pipe
    const { stdout: privateKey } = await execAsync(`"${wgExe}" genkey`);
    const pk = privateKey.trim();
    const { stdout: publicKey } = await execAsync(`echo ${pk} | "${wgExe}" pubkey`);
    return { privateKey: pk, publicKey: publicKey.trim() };
}
// ─── Load / Save server config ────────────────────────────────────────────────
function loadServerConfig() {
    const confPath = path_1.default.join(getWgDir(), 'server-meta.json');
    if (!fs_1.default.existsSync(confPath))
        return null;
    try {
        return JSON.parse(fs_1.default.readFileSync(confPath, 'utf8'));
    }
    catch {
        return null;
    }
}
function saveServerConfig(cfg) {
    ensureWgDir();
    fs_1.default.writeFileSync(path_1.default.join(getWgDir(), 'server-meta.json'), JSON.stringify(cfg, null, 2), 'utf8');
}
function loadPeers() {
    if (!fs_1.default.existsSync(getPeersDataPath()))
        return [];
    try {
        return JSON.parse(fs_1.default.readFileSync(getPeersDataPath(), 'utf8'));
    }
    catch {
        return [];
    }
}
function savePeers(peers) {
    ensureWgDir();
    fs_1.default.writeFileSync(getPeersDataPath(), JSON.stringify(peers, null, 2), 'utf8');
}
// ─── Build wg0.conf ───────────────────────────────────────────────────────────
function buildServerConf(cfg, peers) {
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
function buildPeerClientConf(peerPrivateKey, peerAllowedIp, serverPublicKey, serverEndpoint, serverListenPort) {
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
async function checkWireGuardInstalled() {
    try {
        const wgPath = await findWgExe();
        return { installed: true, path: wgPath };
    }
    catch (e) {
        return { installed: false, error: e.message };
    }
}
/** Initialize the WireGuard server — generates server keypair, writes wg0.conf */
async function initServer(publicEndpoint, listenPort = 51820) {
    ensureWgDir();
    const wgExe = await findWgExe();
    // Reuse existing config if present
    const existing = loadServerConfig();
    if (existing) {
        // Update endpoint/port only
        existing.publicEndpoint = publicEndpoint;
        existing.listenPort = listenPort;
        saveServerConfig(existing);
        rewriteConfFile(existing);
        return existing;
    }
    const { privateKey, publicKey } = await generateKeypair(wgExe);
    const cfg = {
        privateKey,
        publicKey,
        listenPort,
        serverIp: '10.0.0.1/24',
        publicEndpoint,
    };
    saveServerConfig(cfg);
    rewriteConfFile(cfg);
    return cfg;
}
function rewriteConfFile(cfg) {
    const peers = loadPeers();
    const conf = buildServerConf(cfg, peers);
    fs_1.default.writeFileSync(getServerConfPath(), conf, 'utf8');
}
/** Add a new peer device; returns the client config string + QR code as base64 PNG */
async function addPeer(name) {
    const cfg = loadServerConfig();
    if (!cfg)
        throw new Error('Server not initialized. Call initServer first.');
    const wgExe = await findWgExe();
    const { privateKey, publicKey } = await generateKeypair(wgExe);
    const peers = loadPeers();
    // Assign next IP in subnet (10.0.0.2, 10.0.0.3 …)
    const usedOctets = peers.map(p => parseInt(p.allowedIp.split('.')[3]));
    let nextOctet = 2;
    while (usedOctets.includes(nextOctet))
        nextOctet++;
    if (nextOctet > 254)
        throw new Error('VPN subnet full (max 253 peers).');
    const peer = {
        name,
        publicKey,
        privateKey,
        allowedIp: `10.0.0.${nextOctet}/32`,
        addedAt: Date.now(),
    };
    peers.push(peer);
    savePeers(peers);
    rewriteConfFile(cfg);
    const clientConf = buildPeerClientConf(privateKey, peer.allowedIp, cfg.publicKey, cfg.publicEndpoint, cfg.listenPort);
    // Generate QR PNG as base64 data URL
    const qrBase64 = await qrcode_1.default.toDataURL(clientConf, { errorCorrectionLevel: 'M', width: 300 });
    return { peer, clientConf, qrBase64 };
}
/** List all configured peers */
function listPeers() {
    return loadPeers();
}
/** Remove a peer by public key */
function removePeer(publicKey) {
    const cfg = loadServerConfig();
    let peers = loadPeers();
    peers = peers.filter(p => p.publicKey !== publicKey);
    savePeers(peers);
    if (cfg)
        rewriteConfFile(cfg);
}
/** Get server config metadata (without private key for renderer) */
function getServerMeta() {
    const cfg = loadServerConfig();
    if (!cfg)
        return null;
    const { privateKey: _omit, ...safe } = cfg;
    return safe;
}
/** Start the WireGuard tunnel (installs as Windows service) */
async function startTunnel() {
    try {
        const confPath = getServerConfPath();
        if (!fs_1.default.existsSync(confPath))
            throw new Error('No wg0.conf found. Initialize server first.');
        const wireGuard = await findWireGuardExe();
        // On Windows, installing the tunnel service requires administrator privileges.
        // Running it via powershell Start-Process with -Verb RunAs triggers the UAC prompt.
        const escapedWireGuard = wireGuard.replace(/"/g, '\\"');
        const escapedConfPath = confPath.replace(/"/g, '\\"');
        const psCommand = `Start-Process -FilePath '${escapedWireGuard}' -ArgumentList '/installtunnelservice', '${escapedConfPath}' -Verb RunAs -WindowStyle Hidden -Wait`;
        await execAsync(`powershell -Command "${psCommand}"`);
        return { success: true };
    }
    catch (e) {
        return { success: false, error: e.message };
    }
}
/** Stop the WireGuard tunnel */
async function stopTunnel() {
    try {
        const wireGuard = await findWireGuardExe();
        // Uninstalling the tunnel service also requires administrator privileges.
        const escapedWireGuard = wireGuard.replace(/"/g, '\\"');
        const psCommand = `Start-Process -FilePath '${escapedWireGuard}' -ArgumentList '/uninstalltunnelservice', 'wg0' -Verb RunAs -WindowStyle Hidden -Wait`;
        await execAsync(`powershell -Command "${psCommand}"`);
        return { success: true };
    }
    catch (e) {
        return { success: false, error: e.message };
    }
}
/** Get current tunnel status via `wg show` */
async function getTunnelStatus() {
    try {
        const wgExe = await findWgExe();
        const { stdout } = await execAsync(`"${wgExe}" show wg0`);
        const running = stdout.includes('interface: wg0') || stdout.includes('listening port');
        const peerBlocks = stdout.split('\n\n').slice(1);
        const peers = peerBlocks
            .filter(b => b.includes('peer:'))
            .map(block => {
            const publicKey = (block.match(/peer:\s*(\S+)/))?.[1] ?? '';
            const lastHandshake = (block.match(/latest handshake:\s*(.+)/))?.[1]?.trim() ?? 'Never';
            const endpoint = (block.match(/endpoint:\s*(\S+)/))?.[1] ?? '';
            return { publicKey, lastHandshake, endpoint };
        });
        return { running, peers, interface: 'wg0' };
    }
    catch {
        // wg show fails if tunnel is down — that's normal
        return { running: false, peers: [], interface: null };
    }
}
/** Regenerate + return client config for an existing peer (e.g. for re-display) */
async function getPeerClientConf(publicKey) {
    const cfg = loadServerConfig();
    const peers = loadPeers();
    const peer = peers.find(p => p.publicKey === publicKey);
    if (!cfg || !peer)
        return null;
    const clientConf = buildPeerClientConf(peer.privateKey, peer.allowedIp, cfg.publicKey, cfg.publicEndpoint, cfg.listenPort);
    const qrBase64 = await qrcode_1.default.toDataURL(clientConf, { errorCorrectionLevel: 'M', width: 300 });
    return { clientConf, qrBase64 };
}
