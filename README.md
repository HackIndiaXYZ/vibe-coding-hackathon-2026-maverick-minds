


# Ubiquity

> **Cut the leash to Big Tech.**
>
> Run your own cloud on hardware you control — encrypted, local, and resilient.

Ubiquity transforms a personal computer into a private cloud node for storage, surveillance, and AI. Instead of uploading data to third-party cloud providers, users retain ownership of their infrastructure, data, and intelligence while still enjoying cloud-like accessibility.

---


<img width="1390" alt="Screenshot 2026-06-10 164231" src="https://github.com/user-attachments/assets/357ffc5c-5430-4380-9750-bff443d3a63e" />

# The Problem

Modern cloud services provide convenience but require trust.

Files, camera footage, and AI interactions are often stored and processed on infrastructure owned by third parties. Users have limited control over privacy, outages, pricing changes, and data handling practices.

As AI becomes increasingly integrated into everyday life, users need an alternative that preserves ownership without sacrificing functionality.

---

# Our Solution

Ubiquity creates a self-hosted cloud environment using hardware users already own.

The platform combines:

* Encrypted local storage
* Surveillance recording
* Self-hosted AI services
* Secure remote access
* Web and mobile clients

Everything remains under user control while providing the accessibility and convenience expected from modern cloud platforms.

---

# What Makes Ubiquity Different?

## You Own Uptime

Run the service only when you choose.

No vendor lock-in.

No dependency on third-party cloud providers.

No surprise outages beyond your own infrastructure.

---
<img width="1378" height="851" alt="Screenshot 2026-06-10 160549" src="https://github.com/user-attachments/assets/9bf3b5e1-91db-4ab1-b5f5-a100863998d1" />

## Local-First Storage

Files and recordings remain on your machine.

Content is encrypted at rest and protected by credentials you control.

Storage stays under your ownership instead of being transferred to third-party cloud infrastructure.

---

## Self-Hosted AI

Optional AI services run directly on your hardware.

Use local models for:

* Search
* Summarization
* Context retrieval
* Knowledge assistance

Your data never needs to leave your environment for AI processing.

---
<img width="401" height="863" alt="Screenshot 2026-06-10 160434" src="https://github.com/user-attachments/assets/4f5fda51-d6e3-4f3d-8f0e-671867fd4739" />

## Secure Remote Access

Access your node from anywhere while maintaining ownership and control.

Remote connectivity can be configured through:

* Tailscale Tailnet
* Tailscale Funnel
* Cloudflare Tunnel
* Self-managed reverse proxies

You decide when the node becomes reachable.

---

# Workflow

1. A camera records footage or a user uploads files.
2. Ubiquity encrypts the content and stores it inside the local vault.
3. Optional AI services index, search, and summarize content locally.
4. The owner opens Ubiquity and unlocks the vault using their password.
5. Files and videos stream directly from the owner's machine.
6. Remote access can be enabled whenever needed through secure networking.
7. Access can be revoked instantly by disabling routes or rotating credentials.

   <img width="1902" height="958" alt="Screenshot 2026-06-10 163812" src="https://github.com/user-attachments/assets/828eb6fa-3095-4b58-8cb8-f44e5f955ed8" />


Throughout the entire workflow, storage, intelligence, and access remain under the user's control.

---

# Core Capabilities

## Encrypted Vault

AES-GCM protected storage with locally managed credentials.

Passwords and encryption keys remain under user control.

---

## File Service

A lightweight HTTP API serves metadata and controlled access to authorized content.

---

## Self-Hosted AI Services

Optional local AI assistants can run on the host machine or local network.

Capabilities include:

* Semantic search
* Summarization
* Context retrieval
* Knowledge assistance

---

## Surveillance Storage

Camera footage is stored directly on hardware owned by the user rather than third-party cloud providers.

---

## Mobile & Web Access

Cross-platform clients connect to the node and request information while respecting authentication and access controls.

---

# System Architecture

Ubiquity consists of three primary components.

## Desktop Node (Electron)

The Electron application serves as the core of the platform.

Responsibilities include:

* Vault management
* Encryption and decryption
* Surveillance storage
* Local AI services
* Embedded HTTP API

---

## Web Client (React + Vite)

Provides browser-based access to the node.

Supports local and remote connectivity.

---

## Mobile Client (Expo / React Native)

Provides mobile monitoring and lightweight interactions using the same backend services.

---

# Remote Access & Routing

By default, Ubiquity operates entirely on the local machine.

For remote access, users can connect through:

* Tailscale Tailnet
* Tailscale Funnel
* Cloudflare Tunnel
* Self-managed reverse proxies

  
<img width="1383" height="880" alt="Screenshot 2026-06-10 164211" src="https://github.com/user-attachments/assets/f065822a-f1a6-4384-ad16-b86a3be0abf5" />

The Electron node exposes a lightweight HTTP API that can be securely routed through these networking solutions.

Requests are authenticated using API keys and protected through configurable origin restrictions.

---

## Development Routing

Developers can run:

* Web Client locally
* Electron Node locally
* Mobile Client locally

When an API base URL is not provided, clients can fall back to configured host IP and port settings.

For remote development, both devices can communicate securely through a shared Tailnet.

---

# Privacy & Security

Privacy is a foundational design principle.

## Local Ownership

Data remains under user control unless explicitly shared.

---

## Encryption

Files are protected using AES-GCM encryption.

Stored content remains unreadable without authorization.

---

## Authentication

API requests require valid API keys.

Keys can be rotated or revoked whenever necessary.

---

## Origin Protection

Configurable CORS restrictions help prevent unauthorized browser access.

---

## Revocable Access

Remote access can be disabled instantly.

Credentials can be regenerated whenever exposure is suspected.

---

## Vault Protection

Even if encrypted files are copied, they remain inaccessible without the correct vault password.

---

# Technology Stack

## Frontend

* React
* Vite
* Electron
* React Native

## Backend

* Node.js
* Lightweight HTTP Server

## Security

* AES-GCM Encryption
* API Key Authentication
* CORS Protection

## Networking

* Tailscale
* Tailscale Funnel
* Cloudflare Tunnel
* Reverse Proxy Support

## AI

* Local LLM Integration
* Self-Hosted AI Services

---

# Environment Variables

## Electron Host

```env
API_KEY=your_secure_api_key
FRONTEND_ORIGIN=https://your-frontend-url.com
PORT=8081
```

## Web Client

```env
VITE_API_BASE=https://your-api-url
VITE_API_KEY=your_client_api_key
```

> Note: VITE variables are exposed to the client bundle and should not be treated as secrets.


---

# Useful Commands

## Generate a Strong API Key (PowerShell)

```powershell
$bytes = New-Object Byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

## Persist API Key (Admin PowerShell)

```powershell
setx API_KEY "<YOUR_API_KEY>" /M
```

## Allow Incoming Connections

```powershell
New-NetFirewallRule -DisplayName "Ubiquity API 8081" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8081 -Profile Any
```

---

# Troubleshooting

## API Returns 401 Unauthorized

Verify that the API key configured on the host matches the key used by the client or proxy.

---

## Remote Access Timeout

Check:

* Tailscale status
* Service/Funnel configuration
* Firewall rules
* Listening port

---

## Frontend Uses Incorrect Host

Clear stored host settings and reload the application.

---

## Verify API Availability

```bash
curl http://<HOST_IP>:8081/health
```

---

# Security Recommendations

* Use strong randomly generated API keys.
* Rotate credentials periodically.
* Restrict allowed frontend origins.
* Protect vault passwords.
* Avoid exposing sensitive endpoints publicly.
* Prefer server-side proxies when handling secrets.

---

# Future Roadmap

* Authenticated media streaming with short-lived tokens
* Server-side proxy authentication
* Advanced AI retrieval pipelines
* Hardened networking policies
* Distributed private cloud nodes
* Multi-device synchronization
* Enhanced surveillance analytics

---

# Why This Matters

Running your own cloud is an act of digital self-determination.

Ubiquity demonstrates that storage, surveillance, and AI can remain private, secure, and user-controlled while still delivering the convenience users expect from modern cloud platforms.

Instead of renting privacy from a provider, users own the infrastructure, intelligence, and data that power their digital lives.

## Your Hardware. Your Data. Your Cloud.
