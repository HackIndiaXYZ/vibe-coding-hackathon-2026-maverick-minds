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
export interface WgPeer {
    name: string;
    publicKey: string;
    privateKey: string;
    allowedIp: string;
    addedAt: number;
}
export interface WgServerConfig {
    privateKey: string;
    publicKey: string;
    listenPort: number;
    serverIp: string;
    publicEndpoint: string;
}
export interface WgStatus {
    running: boolean;
    peers: {
        publicKey: string;
        lastHandshake: string;
        endpoint: string;
    }[];
    interface: string | null;
}
/** Check if wg.exe is available */
export declare function checkWireGuardInstalled(): Promise<{
    installed: boolean;
    path?: string;
    error?: string;
}>;
/** Initialize the WireGuard server — generates server keypair, writes wg0.conf */
export declare function initServer(publicEndpoint: string, listenPort?: number): Promise<WgServerConfig>;
/** Add a new peer device; returns the client config string + QR code as base64 PNG */
export declare function addPeer(name: string): Promise<{
    peer: WgPeer;
    clientConf: string;
    qrBase64: string;
}>;
/** List all configured peers */
export declare function listPeers(): WgPeer[];
/** Remove a peer by public key */
export declare function removePeer(publicKey: string): void;
/** Get server config metadata (without private key for renderer) */
export declare function getServerMeta(): Omit<WgServerConfig, 'privateKey'> | null;
/** Start the WireGuard tunnel (installs as Windows service) */
export declare function startTunnel(): Promise<{
    success: boolean;
    error?: string;
}>;
/** Stop the WireGuard tunnel */
export declare function stopTunnel(): Promise<{
    success: boolean;
    error?: string;
}>;
/** Get current tunnel status via `wg show` */
export declare function getTunnelStatus(): Promise<WgStatus>;
/** Regenerate + return client config for an existing peer (e.g. for re-display) */
export declare function getPeerClientConf(publicKey: string): Promise<{
    clientConf: string;
    qrBase64: string;
} | null>;
