Ubiquity — Tailscale Funnel & Electron HTTP API
=================================================

Purpose
-------
This document explains how the Electron-based Ubiquity server was exposed to the public frontend (https://uclo.netlify.app) using Tailscale Services (Funnel), how the lightweight HTTP API was added to Electron, the environment variables required, and common troubleshooting steps.

Prerequisites
-------------
- Windows host running the Electron app (local-cloud-infrastructure)
- Tailscale installed and signed in on the host and your dev machine
- Netlify site for the frontend (https://uclo.netlify.app)
- Admin/PowerShell access on the Windows host

Quick summary of the solution
-----------------------------
- Electron runs a small HTTP server (no Express) on an internal port (default 8080/8081).
- Tailscale Services (Funnel) is configured to expose that port via a public HTTPS URL (example: https://ubiquity-api.tail15acf2.ts.net).
- Netlify is configured with Vite env variables to call that Funnel URL and send an API key.
- Electron enforces a simple API key and CORS to allow only the frontend origin.

Files changed / added
---------------------
- electron/main.ts — starts a lightweight HTTP endpoint (GET /health, GET /api/files)
- electron/services/vaultService.ts — (existing) used to list files
- local-cloud-infrastructure/README_TAILSCALE.md — this file
- ubiquity-web/src/App.tsx — updated to read VITE_API_BASE and VITE_API_KEY

Windows host setup (commands)
-----------------------------
Run in an elevated PowerShell (Admin):

# 1. Persist env vars (system-wide)
setx API_KEY "<paste-a-strong-key>" /M
setx FRONTEND_ORIGIN "https://uclo.netlify.app" /M
setx PORT 8081 /M   # if using 8081

# 2. (Optional) Quick test in current shell before restart
$env:API_KEY = "<key>"; $env:FRONTEND_ORIGIN = "https://uclo.netlify.app"; $env:PORT = "8081"

# 3. Allow the port through Windows Firewall
New-NetFirewallRule -DisplayName "Ubiquity API 8081" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8081 -Profile Any

# 4. Start the app (dev) so it picks up env vars
cd C:\Work\ubiquity\local-cloud-infrastructure
npm run dev

Generate a strong key (PowerShell):
$bytes = New-Object Byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [Convert]::ToBase64String($bytes)

Configure Tailscale Service (Funnel)
-----------------------------------
1. Open https://login.tailscale.com/admin/services
2. Create a Service named `ubiquity-api` and set Ports to `tcp:8081` (or the port you use)
3. Set the target for that service to the host and `http://localhost:8081`
4. Save. Note the Full domain (Funnel URL) shown — e.g. `https://ubiquity-api.tail15acf2.ts.net`

Netlify configuration
---------------------
In your Netlify site settings (Site > Settings > Build & deploy > Environment):
- VITE_API_BASE = https://ubiquity-api.tail15acf2.ts.net
- VITE_API_KEY  = <the same API key used on the host>

Redeploy the site after adding env vars.

Frontend behavior
-----------------
- The web app (Vite) reads import.meta.env.VITE_API_BASE and VITE_API_KEY.
- If VITE_API_BASE is set, the app calls `${VITE_API_BASE}/api/files` with header `x-api-key`.
- If not set (dev), the app falls back to the manual host/port stored in localStorage.

Testing commands
----------------
# On the host (should respond)
curl.exe -v http://localhost:8081/health
curl.exe -v -H "x-api-key: <key>" http://localhost:8081/api/files

# From a dev machine on the same Tailnet (replace <TAIL_IP> with tailscale ip -4)
curl.exe -v http://<TAIL_IP>:8081/health

# From anywhere to the Funnel URL:
curl.exe -v -H "x-api-key: <key>" https://ubiquity-api.tail15acf2.ts.net/api/files

Troubleshooting checklist
-------------------------
- 401 Unauthorized: Ensure API_KEY on the Windows host equals VITE_API_KEY in Netlify.
- Timeout to Funnel URL: Confirm Electron is listening (netstat -ano | findstr :8081), open firewall rule, confirm tailscale ip -4 and that the service lists the host as a candidate.
- CORS errors: Set FRONTEND_ORIGIN in host env to the exact Netlify origin or temporarily '*' for testing.
- Saved fallback: Clear localStorage keys `web_host_ip` and `web_host_port` in the browser console if the site keeps calling the wrong URL.

Useful commands
---------------
# On host
netstat -ano | findstr :8081
tasklist /FI "PID eq <PID>"
Get-Process -Id <PID>
Get-NetConnectionProfile
tailscale ip -4
tailscale status

# Firewall test (temporary — re-enable afterwards)
netsh advfirewall set allprofiles state off
# test from dev machine
netsh advfirewall set allprofiles state on

Security notes
--------------
- Do NOT publish API keys in client-side code. VITE_ envs become part of the bundle; use Netlify Functions or a server-side proxy if you need secrecy.
- Use a long random API key and rotate it when needed.
- Add further protections: short-lived tokens, basic auth, IP restrictions, or mutual TLS.

Reverting / cleanup
-------------------
- Remove the Tailscale Service from the admin console.
- Remove the firewall rule:
  Remove-NetFirewallRule -DisplayName "Ubiquity API 8081"
- Unset machine env vars (remove manually from System > Advanced > Environment Variables or use registry tools)

If you want
-----------
- I can add a Netlify Function proxy so the key is kept secret server-side and the public frontend calls Netlify only.
- I can add a download/stream endpoint that decrypts files on demand (requires vault password handling).

Contact
-------
If funnel/tailscale routing still times out, collect these outputs and share them:
- curl localhost:8081/health output
- netstat -ano | findstr :8081
- tailscale ip -4 and tailscale status
- firewall rules listing for 8081

End of README
