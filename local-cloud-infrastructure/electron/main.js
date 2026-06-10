"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const ipcHandlers_1 = require("./ipcHandlers");
const chatbotService_1 = require("./services/chatbotService");
const storageManager_1 = require("./services/storageManager");
const http_1 = __importDefault(require("http"));
const url_1 = __importDefault(require("url"));
const vaultService_1 = require("./services/vaultService");
const API_PORT = Number(process.env.PORT || 8080);
const API_KEY = process.env.API_KEY || 'dev-mode';
const ALLOWED_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://uclo.netlify.app';
function startHttpApi() {
    try {
        const server = http_1.default.createServer(async (req, res) => {
            const parsed = url_1.default.parse(req.url || '', true);
            const pathname = parsed.pathname || '/';
            // CORS
            res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
            res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-api-key');
            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                return res.end();
            }
            if (pathname === '/health') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ ok: true }));
            }
            // Require API key for all other endpoints
            const key = req.headers['x-api-key'] || parsed.query.api_key;
            if (!key || key !== API_KEY) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'unauthorized' }));
            }
            if (pathname === '/api/files' && req.method === 'GET') {
                try {
                    const files = (0, vaultService_1.listSurveillanceFiles)();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ files }));
                }
                catch (e) {
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
    }
    catch (err) {
        console.error('[main] Failed to start HTTP API', err);
    }
}
const isDev = process.env.NODE_ENV === "development";
const VITE_DEV_URL = "http://localhost:5173";
const PRELOAD_PATH = path_1.default.join(__dirname, "preload.js");
let mainWindow = null;
let tray = null;
let isQuitting = false; // tracks real quit vs window-close
// ─── Window ────────────────────────────────────────────────────────────────
function createWindow() {
    const win = new electron_1.BrowserWindow({
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
    }
    else {
        win.loadFile(path_1.default.join(__dirname, "../dist/index.html"));
    }
    // Intercept window close — hide to tray instead of destroying
    win.on("close", (event) => {
        if (!isQuitting) {
            event.preventDefault();
            win.hide();
            tray?.displayBalloon({
                title: "Ubiquity running in background",
                content: "The server is still running. Right-click the tray icon to quit.",
                iconType: "info",
            });
        }
    });
    return win;
}
// ─── System Tray ───────────────────────────────────────────────────────────
function buildTrayIcon() {
    const iconPath = isDev
        ? path_1.default.join(__dirname, "..", "assets", "icon.png")
        : path_1.default.join(process.resourcesPath, "assets", "icon.png");
    return electron_1.nativeImage.createFromPath(iconPath);
}
function createTray() {
    const icon = buildTrayIcon();
    tray = new electron_1.Tray(icon);
    tray.setToolTip("Ubiquity — Local Cloud Server");
    const contextMenu = electron_1.Menu.buildFromTemplate([
        {
            label: "Open Ubiquity",
            click: () => {
                if (!mainWindow) {
                    mainWindow = createWindow();
                }
                else {
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
                electron_1.app.quit();
            },
        },
    ]);
    tray.setContextMenu(contextMenu);
    // Single-click on tray icon also opens the window
    tray.on("click", () => {
        if (!mainWindow) {
            mainWindow = createWindow();
        }
        else if (mainWindow.isVisible()) {
            mainWindow.focus();
        }
        else {
            mainWindow.show();
            mainWindow.focus();
        }
    });
}
// ─── App lifecycle ─────────────────────────────────────────────────────────
electron_1.app.whenReady().then(() => {
    (0, ipcHandlers_1.registerIpcHandlers)();
    (0, chatbotService_1.initChatbot)();
    (0, storageManager_1.getStorageStatus)(); // Initialize storage
    startHttpApi(); // Start HTTP API (serves files to frontend via Tailscale Funnel)
    createTray();
    mainWindow = createWindow();
    electron_1.app.on("activate", () => {
        // macOS: re-open window when dock icon is clicked
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            mainWindow = createWindow();
        }
        else {
            mainWindow?.show();
        }
    });
});
// Prevent default quit on all-windows-closed — tray keeps the process alive
electron_1.app.on("window-all-closed", () => {
    // Do NOT quit — tray is keeping us alive.
    // On macOS the window-all-closed event is usually suppressed anyway.
});
// Honor real quit (from tray menu or OS shutdown)
electron_1.app.on("before-quit", () => {
    isQuitting = true;
});
process.on("uncaughtException", (err) => {
    console.error("[main] Uncaught exception:", err);
});
