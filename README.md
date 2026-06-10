# vibe-coding-hackathon-2026-maverick-minds
Hackathon team repository for Maverick Minds - [hackindia-team:vibe-coding-hackathon-2026:maverick-minds]
Ubiquity — Your Self‑Hosted Freedom Cloud
=========================================

Tagline
-------
Cut the leash to Big Tech. Run your own cloud on hardware you control — encrypted, local, and resilient. Ubiquity turns your PC into a private cloud node: storage, AI, and camera capture under your terms.

What makes Ubiquity different
-----------------------------
- You own uptime: run the service only when you choose. No vendor lock‑in, no surprise outages, no data-mining.
- Local-first storage: footage and files live on your machine, encrypted at rest, unlocked only with a password you control.
- Self-hosted AI: optional local AI services provide on-device intelligence (search, summarization, context) without sending your data to external models.
- Secure remote access: Tailscale or a small proxy gives secure, deliberate external routes — you decide when to expose the node.

User story (short)
------------------
A remote camera records encrypted clips into the Ubiquity vault. The owner opens the Electron app, types their vault password to unlock a clip, and watches the decrypted stream — streamed directly from their machine. No cloud storage; no third-party indexing. If they want remote viewing, they enable a Tailnet route and share a short-lived token.

Core capabilities
-----------------
- Encrypted vault: AES‑GCM protected files; keys and password stay local.
- File service: lightweight HTTP API serves metadata and controlled access to decrypted content.
- Self-hosted AI services: optional indexing and local LLM-based assistant that runs on your machine or local network.
- Mobile + web clients: thin UIs that request data from your node; the node decides what to reveal.

How it protects privacy
-----------------------
- Data never leaves your control unless you explicitly permit it. When you enable remote access, the path is secured by Tailscale (peer-to-peer encrypted mesh) or a reverse-proxy you control.
- The API requires a secret API_KEY; browsers are further gated by CORS. You can rotate keys and revoke access instantly.
- The vault is password-protected; even if someone gains the storage files, they remain encrypted without the password.

Routing & remote access (in plain language)
-------------------------------------------
1. By default, Ubiquity runs locally — the web UI talks to the Electron server on your machine.
2. For remote access, install Tailscale on the host. You can:
   - Call the host directly from devices on the same Tailnet (private, encrypted).
   - Optionally create a Tailscale Service (Funnel) for a public HTTPS endpoint that forwards to your host.
3. If you don’t use Tailscale, run a tiny reverse-proxy (Cloudflare Tunnel or a small VPS) and forward to the host. Always lock the endpoint with the API key and short-lived tokens.

Operational choices you control
--------------------------------
- Uptime: run 24/7 on a server, or only when you need it on a laptop.
- Exposure: private only, Tailnet-only, or publicly reachable via a proxy.
- Intelligence: run AI models locally for privacy, or disable the chatbot service if you prefer.

Getting going (essentials)
--------------------------
- Run the desktop app (Electron). It will create a vault and a surveillance folder.
- Set a strong vault password — this protects all footage.
- Generate a long API key and set it on the host (Admin PowerShell):
  setx API_KEY "<strong-random-key>" /M
- Start the app and check the embedded API is listening (netstat).
- For remote access: install Tailscale and configure a Service or use a proxy.

Quick commands (copy/paste)
---------------------------
# Generate a strong key (PowerShell)
$bytes = New-Object Byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [Convert]::ToBase64String($bytes)

# Persist key (Admin PowerShell)
setx API_KEY "<paste-key-here>" /M

# Allow inbound if you will accept remote connections
New-NetFirewallRule -DisplayName "Ubiquity API" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8081 -Profile Any

Safety & tips
-------------
- Treat the API key like a capability token: rotate it if leaked.
- Use FRONTEND_ORIGIN to limit which web origins can access your API.
- Keep your vault password secret and never check it into code.

Why this matters
-----------------
Running your own cloud is an act of digital self-determination. Ubiquity takes systems you already have (storage, camera, CPU) and stitches them into a private, secure platform. You decide the availability, the privacy posture, and how intelligence runs against your data.

