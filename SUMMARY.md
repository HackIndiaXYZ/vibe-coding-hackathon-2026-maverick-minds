Ubiquity — System Summary
=========================

Purpose
-------
This document summarizes the full Ubiquity work: architecture, how components interact, routing (including Tailscale Funnel), environment variables, security controls, and troubleshooting guidance.

Components
----------
- local-cloud-infrastructure (Electron desktop app)
  - Manages the encrypted vault, surveillance files, and local services and also AI services.
  - Starts a lightweight HTTP API (no Express) that serves endpoints such as:
    - GET /health
    - GET /api/files (returns JSON list of surveillance files)
  - Uses services/vaultService for file listing, encryption/decryption logic.

- ubiquity-web (React + Vite)
  - Frontend UI for browser-based access and local development.
  - Reads VITE_API_BASE and VITE_API_KEY when configured; otherwise uses stored hostIp/hostPort for local development.

- Ubiquity-mobile (Expo / React Native)
  - Mobile client for monitoring and light actions; communicates with the same backend API or via the Electron IPC when local.

How routing works (Tailscale / local access)
---------------------------------------------------------
1. The frontend (running in a browser) calls the configured API base URL (VITE_API_BASE) or the tailnet IP/port when set.
2. A Tailscale Service (or direct tailnet routing) forwards traffic to the chosen Electron host and local target (http://localhost:<port>).
3. The Electron host runs the lightweight HTTP API bound to 0.0.0.0 on the chosen port (default 8080/8081). Tailscale forwards traffic to this port when the service is configured.
4. The Electron API authenticates incoming requests using a shared API key (x-api-key header) and applies CORS allowing the configured frontend origin.
5. Electron reads files from the local vault (surveillance directory) and returns metadata or file contents as requested.

How routing works (development / local)
--------------------------------------
- Developers can run the web app locally (vite dev) and the Electron app on the same machine or on a host in the same Tailnet.
- The app falls back to local host IP/port stored in localStorage (web_host_ip/web_host_port) when VITE_API_BASE is not provided.
- For remote developer testing, both dev machine and host must be in the same Tailnet. The developer browser can call http://<TAIL_IP>:<port> directly when CORS and firewall allow it.

Environment variables (summary)
-------------------------------
Electron (host):
- API_KEY — shared secret for API authentication (required)
- FRONTEND_ORIGIN — allowed origin for CORS (e.g., https://uclo.netlify.app)
- PORT — port for embedded HTTP API (default 8080 or 8081)

Web (Netlify / Vite):
- VITE_API_BASE — optional API base URL to call (a Tailscale Funnel URL or tailnet IP/port).
- VITE_API_KEY  — API key to send in x-api-key header (note: VITE_ variables are exposed client-side)

Security considerations
-----------------------
- VITE_API_KEY is embedded in the client bundle — not secret. Prefer a server-side proxy (Netlify Function) to hide the real API key.
- Use a strong, random API_KEY stored on the host (setx API_KEY "<secret>" /M). Rotate periodically.
- Enforce FRONTEND_ORIGIN in the Electron server to reduce cross-origin risk.
- Protect the vault with strong passwords; decrypt only on demand and avoid exposing raw decrypted bytes over public endpoints unless needed and authenticated.

Tailscale Funnel specifics
--------------------------
- Configure a Service in the Tailnet admin: name `ubiquity-api`, Ports: tcp:<port>, Target: http://localhost:<port>, Candidate: your Electron host.
- The service will forward incoming tailnet or Funnel traffic to the host; if a public Funnel URL is provided by your plan it can be used as VITE_API_BASE. If not available, alternatives: Cloudflare Tunnel or a small public reverse-proxy.


Firewall & connectivity checklist
--------------------------------
- Ensure Electron is listening (netstat -ano | findstr :<port>).
- Add firewall rule: New-NetFirewallRule -DisplayName "Ubiquity API <port>" -Direction Inbound -Action Allow -Protocol TCP -LocalPort <port> -Profile Any
- Verify tailscale ip -4 and tailscale status on the host.
- From a dev machine on the same Tailnet, test: curl http://<TAIL_IP>:<port>/health
- From anywhere, test the Funnel URL: curl -H "x-api-key: <key>" https://<funnel-domain>/api/files

Troubleshooting common failures
-------------------------------
- 401 Unauthorized: API_KEY mismatch. Ensure the host's API_KEY equals the key used by clients or proxies.
- Timeout to Funnel URL: Check Tailscale service configuration, candidate host advertising the required port, and Windows firewall.
- Frontend still calling local fallback: Clear localStorage keys web_host_ip and web_host_port in the browser console and reload.

Developer commands
------------------
# Start web (in repo/ubiquity-web)
npm install
npm run dev

# Start electron (in repo/local-cloud-infrastructure)
npm install
npm run dev

# Generate API key in PowerShell
$bytes = New-Object Byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [Convert]::ToBase64String($bytes)

# Windows firewall rule (Admin PowerShell)
New-NetFirewallRule -DisplayName "Ubiquity API 8081" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8081 -Profile Any

Where to look next / improvements
--------------------------------
- Replace client-side key with a Netlify Function proxy to keep secrets server-side.
- Add authenticated streaming endpoints with short-lived tokens for media streaming.
- Harden Tailscale ACLs and machine tags to limit exposure.

Revision history
----------------
- 2026-06-10: Implemented lightweight HTTP API in Electron; added Tailscale Service; patched web to use VITE_API_BASE; created README and troubleshooting notes.

Contact
-------
For help reproducing routing or firewall issues, gather:
- Electron console logs (server startup)
- netstat -ano output
- tailscale ip -4 and tailscale status
- Firewall rules listing
