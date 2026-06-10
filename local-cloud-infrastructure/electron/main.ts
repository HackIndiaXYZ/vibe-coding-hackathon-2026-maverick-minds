import { app, BrowserWindow, Tray, Menu, nativeImage } from "electron";
import path from "path";
import { registerIpcHandlers } from "./ipcHandlers";
import { initChatbot } from "./services/chatbotService";
import { getStorageStatus } from "./services/storageManager";
import http from 'http';
import url from 'url';
import { listSurveillanceFiles } from './services/vaultService';

const API_PORT = Number(process.env.PORT || 8080);
const API_KEY = process.env.API_KEY || 'dev-mode';
const ALLOWED_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://uclo.netlify.app';

function startHttpApi() {
  try {
    const server = http.createServer(async (req, res) => {
      const parsed = url.parse(req.url || '', true);
      const pathname = parsed.pathname || '/';
      // CORS
      res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-api-key');
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

      if (pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: true }));
      }

      // Require API key for all other endpoints
      const key = (req.headers['x-api-key'] as any) || parsed.query.api_key;
      if (!key || key !== API_KEY) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'unauthorized' }));
      }

      if (pathname === '/api/files' && req.method === 'GET') {
        try {
          const files = listSurveillanceFiles();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ files }));
        } catch (e:any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: e.message || 'internal' }));
        }
      }

      res.writeHead(404);
      res.end();
    });

    server.listen(API_PORT, '0.0.0.0', () => {
      console.log(`[main] HTTP API listening on ${API_PORT}`);
    });
  } catch (err:any) {
    console.error('[main] Failed to start HTTP API', err);
  }
}


const isDev = process.env.NODE_ENV === "development";
const VITE_DEV_URL = "http://localhost:5173";
const PRELOAD_PATH = path.join(__dirname, "preload.js");

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false; // tracks real quit vs window-close

// ─── Window ────────────────────────────────────────────────────────────────

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#0a0f1e",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0a0f1e",
      symbolColor: "#e2e8f0",
      height: 36,
    },
    webPreferences: {
      preload: PRELOAD_PATH,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: isDev,
    },
  });

  if (isDev) {
    win.loadURL(VITE_DEV_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // Intercept window close — hide to tray instead of destroying
  win.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
      tray?.displayBalloon({
        title: "Ubiquity running in background",
        content:
          "The server is still running. Right-click the tray icon to quit.",
        iconType: "info",
      });
    }
  });

  return win;
}

// ─── System Tray ───────────────────────────────────────────────────────────

function buildTrayIcon(): any {
  const iconPath = isDev
    ? path.join(__dirname, "..", "assets", "icon.png")
    : path.join(process.resourcesPath, "assets", "icon.png");
  return nativeImage.createFromPath(iconPath);
}

function createTray(): void {
  const icon = buildTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip("Ubiquity — Local Cloud Server");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Ubiquity",
      click: () => {
        if (!mainWindow) {
          mainWindow = createWindow();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // Single-click on tray icon also opens the window
  tray.on("click", () => {
    if (!mainWindow) {
      mainWindow = createWindow();
    } else if (mainWindow.isVisible()) {
      mainWindow.focus();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ─── App lifecycle ─────────────────────────────────────────────────────────

app.whenReady().then(() => {
  registerIpcHandlers();
  initChatbot();
  getStorageStatus(); // Initialize storage
  startHttpApi(); // Start HTTP API (serves files to frontend via Tailscale Funnel)
  createTray();
  mainWindow = createWindow();

  app.on("activate", () => {
    // macOS: re-open window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

// Prevent default quit on all-windows-closed — tray keeps the process alive
app.on("window-all-closed", () => {
  // Do NOT quit — tray is keeping us alive.
  // On macOS the window-all-closed event is usually suppressed anyway.
});

// Honor real quit (from tray menu or OS shutdown)
app.on("before-quit", () => {
  isQuitting = true;
});

process.on("uncaughtException", (err) => {
  console.error("[main] Uncaught exception:", err);
});
