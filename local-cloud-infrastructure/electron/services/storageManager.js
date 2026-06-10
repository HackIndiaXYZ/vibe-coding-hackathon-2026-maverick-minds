"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentStoragePath = getCurrentStoragePath;
exports.selectFolder = selectFolder;
exports.updateAllocation = updateAllocation;
exports.getStorageStatus = getStorageStatus;
exports.runBackup = runBackup;
exports.getBackupStatus = getBackupStatus;
const electron_1 = require("electron");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const os_1 = __importDefault(require("os"));
const http_1 = __importDefault(require("http"));
const queries_1 = require("../database/queries");
const cryptoEngine_1 = require("./cryptoEngine");
const vaultService = __importStar(require("./vaultService"));
const backupJobs = new Map();
const DEFAULT_ALLOCATION = 10 * 1024 * 1024 * 1024;
let cachedPath = "";
let cachedAllocation = 0;
let httpPort = 8080;
let httpServer = null;
function getSettingsPath() {
    return path_1.default.join(electron_1.app.getPath("userData"), "settings.json");
}
function initCacheSync() {
    if (cachedPath)
        return;
    try {
        const settingsPath = getSettingsPath();
        if (fs_1.default.existsSync(settingsPath)) {
            const content = fs_1.default.readFileSync(settingsPath, "utf8");
            const data = JSON.parse(content);
            cachedPath = data.localCloudPath || "";
            cachedAllocation =
                typeof data.allocatedSpace === "number" ? data.allocatedSpace : 0;
        }
    }
    catch (err) { }
    if (!cachedPath) {
        cachedPath = process.env.LOCAL_CLOUD_DATA_PATH ?? "C:\\LocalCloudData";
    }
    if (!cachedAllocation) {
        cachedAllocation = 10 * 1024 * 1024 * 1024;
    }
}
function getCurrentStoragePath() {
    initCacheSync();
    return cachedPath;
}
function getLocalIpAddress() {
    const interfaces = os_1.default.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
            if (iface.family === "IPv4" && !iface.internal) {
                return iface.address;
            }
        }
    }
    return "127.0.0.1";
}
function startNetworkServer(dirPath) {
    if (httpServer) {
        httpServer.close();
    }
    httpServer = http_1.default.createServer(async (req, res) => {
        try {
            // Set CORS Headers
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-File-Name, X-File-Path, X-Camera-Id");
            res.setHeader("Access-Control-Allow-Private-Network", "true");
            if (req.method === "OPTIONS") {
                res.statusCode = 200;
                res.end();
                return;
            }
            const decodedUrl = decodeURIComponent(req.url || "/").split("?")[0];
            const safePath = path_1.default.normalize(path_1.default.join(dirPath, decodedUrl));
            if (!safePath.startsWith(dirPath)) {
                res.statusCode = 403;
                res.end("Access Denied");
                return;
            }
            // Handle file deletion
            if (req.method === "POST" && decodedUrl === "/delete") {
                const chunks = [];
                req.on("data", (c) => chunks.push(c));
                req.on("end", async () => {
                    try {
                        const body = JSON.parse(Buffer.concat(chunks).toString());
                        const fileName = body.name;
                        const subPath = body.path || "";
                        if (!fileName) {
                            res.statusCode = 400;
                            res.end("Missing file name");
                            return;
                        }
                        const filePath = path_1.default.join(dirPath, subPath, fileName);
                        if (fs_1.default.existsSync(filePath)) {
                            await fs_1.default.promises.unlink(filePath);
                        }
                        res.statusCode = 200;
                        res.setHeader("Content-Type", "application/json");
                        res.end(JSON.stringify({ success: true }));
                    }
                    catch (err) {
                        res.statusCode = 500;
                        res.setHeader("Content-Type", "application/json");
                        res.end(JSON.stringify({ success: false, error: err.message }));
                    }
                });
                return;
            }
            // Handle file rename
            if (req.method === "POST" && decodedUrl === "/rename") {
                const chunks = [];
                req.on("data", (c) => chunks.push(c));
                req.on("end", async () => {
                    try {
                        const body = JSON.parse(Buffer.concat(chunks).toString());
                        const oldName = body.oldName;
                        const newName = body.newName;
                        const subPath = body.path || "";
                        if (!oldName || !newName) {
                            res.statusCode = 400;
                            res.end(JSON.stringify({
                                success: false,
                                message: "Missing parameters",
                            }));
                            return;
                        }
                        const oldPath = path_1.default.join(dirPath, subPath, oldName);
                        const newPath = path_1.default.join(dirPath, subPath, newName);
                        await fs_1.default.promises.rename(oldPath, newPath);
                        res.statusCode = 200;
                        res.setHeader("Content-Type", "application/json");
                        res.end(JSON.stringify({ success: true }));
                    }
                    catch (err) {
                        res.statusCode = 500;
                        res.setHeader("Content-Type", "application/json");
                        res.end(JSON.stringify({ success: false, message: err.message }));
                    }
                });
                return;
            }
            // Handle delete all (danger zone)
            if (req.method === "POST" && decodedUrl === "/delete-all") {
                try {
                    const entries = await fs_1.default.promises.readdir(dirPath, {
                        withFileTypes: true,
                    });
                    for (const entry of entries) {
                        if (entry.name === "settings.json")
                            continue;
                        const fullPath = path_1.default.join(dirPath, entry.name);
                        if (entry.isDirectory()) {
                            await fs_1.default.promises.rm(fullPath, { recursive: true, force: true });
                        }
                        else {
                            await fs_1.default.promises.unlink(fullPath);
                        }
                    }
                    res.statusCode = 200;
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ success: true }));
                }
                catch (err) {
                    res.statusCode = 500;
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ success: false, error: err.message }));
                }
                return;
            }
            // ── Surveillance Vault Endpoints ──
            if (req.method === "GET" && decodedUrl === "/surveillance/list") {
                try {
                    const files = vaultService.listSurveillanceFiles();
                    res.statusCode = 200;
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ success: true, files }));
                }
                catch (err) {
                    res.statusCode = 500;
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ success: false, error: err.message }));
                }
                return;
            }
            if (req.method === "POST" && decodedUrl === "/surveillance/verify") {
                const chunks = [];
                req.on("data", (c) => chunks.push(c));
                req.on("end", async () => {
                    try {
                        const body = JSON.parse(Buffer.concat(chunks).toString());
                        const result = vaultService.checkVaultPassword(body.password);
                        res.statusCode = 200;
                        res.setHeader("Content-Type", "application/json");
                        res.end(JSON.stringify(result));
                    }
                    catch (err) {
                        res.statusCode = 500;
                        res.setHeader("Content-Type", "application/json");
                        res.end(JSON.stringify({ success: false, error: err.message }));
                    }
                });
                return;
            }
            if (req.method === "POST" && decodedUrl === "/surveillance/decrypt") {
                const chunks = [];
                req.on("data", (c) => chunks.push(c));
                req.on("end", async () => {
                    try {
                        const body = JSON.parse(Buffer.concat(chunks).toString());
                        const decrypted = vaultService.decryptSurveillanceFile(body.id, body.password);
                        // For playback, we write to a temporary file in the userData folder
                        // and return a URL that can be used to stream it
                        const tempDir = path_1.default.join(electron_1.app.getPath("userData"), "temp_surveillance");
                        if (!fs_1.default.existsSync(tempDir))
                            fs_1.default.mkdirSync(tempDir, { recursive: true });
                        const tempFileName = `temp_${Date.now()}_${body.id}.mp4`;
                        const tempPath = path_1.default.join(tempDir, tempFileName);
                        fs_1.default.writeFileSync(tempPath, decrypted);
                        // The temporary file will be served by this same server
                        const tempUrl = `/temp_surveillance/${tempFileName}`;
                        res.statusCode = 200;
                        res.setHeader("Content-Type", "application/json");
                        res.end(JSON.stringify({ success: true, tempUrl }));
                    }
                    catch (err) {
                        res.statusCode = 500;
                        res.setHeader("Content-Type", "application/json");
                        res.end(JSON.stringify({ success: false, error: err.message }));
                    }
                });
                return;
            }
            if (req.method === "POST" && decodedUrl === "/surveillance/delete") {
                const chunks = [];
                req.on("data", (c) => chunks.push(c));
                req.on("end", async () => {
                    try {
                        const body = JSON.parse(Buffer.concat(chunks).toString());
                        const result = vaultService.deleteSurveillanceFile(body.id);
                        res.statusCode = 200;
                        res.setHeader("Content-Type", "application/json");
                        res.end(JSON.stringify(result));
                    }
                    catch (err) {
                        res.statusCode = 500;
                        res.setHeader("Content-Type", "application/json");
                        res.end(JSON.stringify({ success: false, error: err.message }));
                    }
                });
                return;
            }
            // Serve temp surveillance files
            if (req.method === "GET" &&
                decodedUrl.startsWith("/temp_surveillance/")) {
                const fileName = path_1.default.basename(decodedUrl);
                const filePath = path_1.default.join(electron_1.app.getPath("userData"), "temp_surveillance", fileName);
                if (fs_1.default.existsSync(filePath)) {
                    const stat = fs_1.default.statSync(filePath);
                    res.statusCode = 200;
                    res.setHeader("Content-Type", "video/mp4");
                    res.setHeader("Content-Length", stat.size);
                    fs_1.default.createReadStream(filePath).pipe(res);
                    return;
                }
            }
            // Handle file copy / duplicate (server-side)
            if (req.method === "POST" && decodedUrl === "/copy") {
                const chunks = [];
                req.on("data", (c) => chunks.push(c));
                req.on("end", async () => {
                    try {
                        const body = JSON.parse(Buffer.concat(chunks).toString());
                        const srcName = body.srcName;
                        const destName = body.destName;
                        const subPath = body.path || "";
                        if (!srcName || !destName) {
                            res.statusCode = 400;
                            res.end(JSON.stringify({
                                success: false,
                                message: "Missing parameters",
                            }));
                            return;
                        }
                        const srcPath = path_1.default.join(dirPath, subPath, srcName);
                        const destPath = path_1.default.join(dirPath, subPath, destName);
                        await fs_1.default.promises.copyFile(srcPath, destPath);
                        res.statusCode = 200;
                        res.setHeader("Content-Type", "application/json");
                        res.end(JSON.stringify({ success: true }));
                    }
                    catch (err) {
                        res.statusCode = 500;
                        res.end(JSON.stringify({ success: false, message: err.message }));
                    }
                });
                return;
            }
            // Handle binary file upload
            if (req.method === "POST" && decodedUrl === "/upload") {
                const fileName = req.headers["x-file-name"];
                const subPath = req.headers["x-file-path"] || "";
                if (!fileName) {
                    res.statusCode = 400;
                    res.end("Missing X-File-Name header");
                    return;
                }
                const filePath = path_1.default.join(dirPath, subPath, fileName);
                const writeStream = fs_1.default.createWriteStream(filePath);
                req.pipe(writeStream);
                req.on("end", () => {
                    res.statusCode = 200;
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ success: true }));
                });
                req.on("error", (err) => {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ success: false, error: err.message }));
                });
                return;
            }
            // Handle API files request
            if (req.method === "GET" &&
                (decodedUrl === "/api/files" || decodedUrl === "/api/status")) {
                const entries = await fs_1.default.promises.readdir(dirPath, {
                    withFileTypes: true,
                });
                const fileList = [];
                for (const entry of entries) {
                    if (entry.name === "settings.json" || entry.name === "streams")
                        continue;
                    try {
                        const entryPath = path_1.default.join(dirPath, entry.name);
                        const entryStat = await fs_1.default.promises.stat(entryPath);
                        fileList.push({
                            name: entry.name,
                            size: entryStat.size,
                            isDirectory: entry.isDirectory(),
                            relativePath: entry.name,
                        });
                    }
                    catch (e) { }
                }
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: true, files: fileList }));
                return;
            }
            // Handle actual storage status query
            if (req.method === "GET" && decodedUrl === "/api/storage-status") {
                try {
                    const status = await getStorageStatus();
                    res.statusCode = 200;
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ success: true, ...status }));
                }
                catch (err) {
                    res.statusCode = 500;
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ success: false, error: err.message }));
                }
                return;
            }
            // Handle remote camera stream chunk uploads
            if (req.method === "POST" && decodedUrl === "/upload-chunk") {
                const cameraId = req.headers["x-camera-id"] || "remote-cam";
                const baseStreamDir = path_1.default.join(dirPath, "streams");
                const outputDir = path_1.default.join(baseStreamDir, cameraId);
                await fs_1.default.promises.mkdir(outputDir, { recursive: true });
                const chunkPath = path_1.default.join(outputDir, `remote-stream.enc`);
                const writeStream = fs_1.default.createWriteStream(chunkPath, { flags: "a" });
                const chunks = [];
                req.on("data", (c) => chunks.push(c));
                req.on("end", () => {
                    const raw = Buffer.concat(chunks);
                    try {
                        const encrypted = (0, cryptoEngine_1.encrypt)(raw);
                        writeStream.write(encrypted, (err) => {
                            writeStream.end();
                            if (err) {
                                res.statusCode = 500;
                                res.end(JSON.stringify({ success: false, error: err.message }));
                            }
                            else {
                                res.statusCode = 200;
                                res.setHeader("Content-Type", "application/json");
                                res.end(JSON.stringify({ success: true }));
                            }
                        });
                    }
                    catch (err) {
                        writeStream.end();
                        res.statusCode = 500;
                        res.end(JSON.stringify({ success: false, error: err.message }));
                    }
                });
                return;
            }
            const stat = await fs_1.default.promises.stat(safePath).catch(async () => {
                if (safePath === dirPath) {
                    await fs_1.default.promises.mkdir(dirPath, { recursive: true });
                    return await fs_1.default.promises.stat(dirPath);
                }
                throw new Error("File Not Found");
            });
            if (stat.isDirectory()) {
                const entries = await fs_1.default.promises.readdir(safePath, {
                    withFileTypes: true,
                });
                // Check if JSON response requested
                if (req.headers.accept &&
                    req.headers.accept.includes("application/json")) {
                    const fileList = [];
                    for (const entry of entries) {
                        if (entry.name === "settings.json")
                            continue;
                        const entryPath = path_1.default.join(safePath, entry.name);
                        const entryStat = await fs_1.default.promises.stat(entryPath);
                        fileList.push({
                            name: entry.name,
                            size: entryStat.size,
                            isDirectory: entry.isDirectory(),
                            relativePath: path_1.default
                                .join(decodedUrl, entry.name)
                                .replace(/\\/g, "/"),
                        });
                    }
                    res.statusCode = 200;
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ success: true, files: fileList }));
                    return;
                }
                res.setHeader("Content-Type", "text/html; charset=utf-8");
                res.write("<!DOCTYPE html><html><head><style>");
                res.write("body { font-family: sans-serif; background: #080b16; color: #f8fafc; padding: 24px; }");
                res.write("a { color: #3b82f6; text-decoration: none; display: block; margin: 12px 0; font-size: 1.1rem; }");
                res.write("a:hover { text-decoration: underline; color: #60a5fa; }");
                res.write("hr { border: 0; border-top: 1px solid #1e293b; margin: 24px 0; }");
                res.write("h1 { font-size: 1.8rem; font-weight: 700; color: #f8fafc; }");
                res.write("</style></head><body>");
                res.write(`<h1>Local Cloud Explorer</h1><p>Path: ${decodedUrl}</p><hr>`);
                if (decodedUrl !== "/") {
                    res.write('<a href="..">📁 Up to parent directory</a>');
                }
                for (const entry of entries) {
                    if (entry.name === "settings.json")
                        continue;
                    const icon = entry.isDirectory() ? "📁" : "📄";
                    const link = path_1.default.join(decodedUrl, entry.name).replace(/\\/g, "/");
                    res.write(`<a href="${link}">${icon} ${entry.name}</a>`);
                }
                res.write("</body></html>");
                res.end();
            }
            else {
                res.setHeader("Content-Length", stat.size);
                res.setHeader("Content-Disposition", `attachment; filename="${path_1.default.basename(safePath)}"`);
                const stream = fs_1.default.createReadStream(safePath);
                stream.pipe(res);
            }
        }
        catch (err) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
    httpServer
        .listen(httpPort, "0.0.0.0", () => {
        console.log(`Server listening on port ${httpPort}`);
    })
        .on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            httpPort += 1;
            startNetworkServer(dirPath);
        }
    });
}
async function getDirSize(dirPath) {
    let size = 0;
    try {
        const entries = await fs_1.default.promises.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path_1.default.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                size += await getDirSize(fullPath);
            }
            else if (entry.isFile()) {
                const stats = await fs_1.default.promises.stat(fullPath);
                size += stats.size;
            }
        }
    }
    catch (err) { }
    return size;
}
async function selectFolder() {
    initCacheSync();
    const result = await electron_1.dialog.showOpenDialog({
        properties: ["openDirectory", "createDirectory"],
        title: "Select Local Cloud Storage Directory",
    });
    if (result.canceled || result.filePaths.length === 0) {
        return { path: null };
    }
    const selectedPath = result.filePaths[0];
    cachedPath = selectedPath;
    try {
        const settingsPath = getSettingsPath();
        const settings = {
            localCloudPath: cachedPath,
            allocatedSpace: cachedAllocation,
        };
        const dir = path_1.default.dirname(settingsPath);
        await fs_1.default.promises.mkdir(dir, { recursive: true });
        await fs_1.default.promises.writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf8");
        await fs_1.default.promises.mkdir(cachedPath, { recursive: true });
        startNetworkServer(cachedPath);
    }
    catch (err) {
        console.error(err);
    }
    return { path: cachedPath };
}
async function updateAllocation(bytes) {
    try {
        initCacheSync();
        cachedAllocation = bytes;
        const settingsPath = getSettingsPath();
        const settings = {
            localCloudPath: cachedPath,
            allocatedSpace: cachedAllocation,
        };
        const dir = path_1.default.dirname(settingsPath);
        await fs_1.default.promises.mkdir(dir, { recursive: true });
        await fs_1.default.promises.writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf8");
        return { success: true, allocatedSpace: bytes };
    }
    catch (err) {
        console.error(err);
        return { success: false, allocatedSpace: cachedAllocation };
    }
}
async function getStorageStatus() {
    try {
        initCacheSync();
        await fs_1.default.promises.mkdir(cachedPath, { recursive: true });
        const stats = await fs_1.default.promises.statfs(cachedPath);
        const totalSpace = stats.blocks * stats.bsize;
        const freeSpace = stats.bfree * stats.bsize;
        const usedSpace = totalSpace - freeSpace;
        const appUsedSpace = await getDirSize(cachedPath);
        if (!httpServer) {
            startNetworkServer(cachedPath);
        }
        const result = {
            path: cachedPath,
            totalSpace,
            usedSpace,
            freeSpace,
            allocatedSpace: cachedAllocation,
            appUsedSpace,
            localIp: getLocalIpAddress(),
            httpPort,
        };
        (0, queries_1.logStorageEvent)(result).catch((err) => console.warn(err.message));
        return result;
    }
    catch (err) {
        console.error(err);
        return {
            path: cachedPath,
            totalSpace: 0,
            usedSpace: 0,
            freeSpace: 0,
            allocatedSpace: cachedAllocation || DEFAULT_ALLOCATION,
            appUsedSpace: 0,
            localIp: getLocalIpAddress(),
            httpPort,
        };
    }
}
async function runBackup() {
    const jobId = crypto_1.default.randomUUID();
    const job = {
        jobId,
        progress: 0,
        status: "running",
        log: [`[${new Date().toISOString()}] Backup job ${jobId} started`],
        bytesWritten: 0,
    };
    backupJobs.set(jobId, job);
    executeBackup(jobId).catch((err) => {
        const j = backupJobs.get(jobId);
        if (j) {
            j.status = "error";
            j.log.push(`[ERROR] ${err.message}`);
        }
    });
    return { jobId };
}
async function executeBackup(jobId) {
    const job = backupJobs.get(jobId);
    const fsPromises = fs_1.default.promises;
    const currentPath = getCurrentStoragePath();
    try {
        job.log.push(`Scanning ${currentPath}...`);
        job.progress = 10;
        await fsPromises.mkdir(currentPath, { recursive: true });
        const entries = await fsPromises.readdir(currentPath, {
            withFileTypes: true,
        });
        const totalFiles = entries.filter((e) => e.isFile()).length;
        let processed = 0;
        for (const entry of entries) {
            if (!entry.isFile())
                continue;
            if (entry.name === "settings.json")
                continue;
            const filePath = path_1.default.join(currentPath, entry.name);
            const stat = await fsPromises.stat(filePath);
            job.bytesWritten += stat.size;
            processed++;
            job.progress =
                10 + Math.floor((processed / Math.max(totalFiles, 1)) * 85);
            job.log.push(`Backed up: ${entry.name} (${(stat.size / 1024).toFixed(1)} KB)`);
        }
        job.status = "complete";
        job.progress = 100;
        job.log.push(`[${new Date().toISOString()}] Backup complete. ${processed} files, ${(job.bytesWritten / 1024 / 1024).toFixed(2)} MB`);
        await (0, queries_1.logBackupEvent)({
            jobId,
            status: "complete",
            bytesWritten: job.bytesWritten,
        });
    }
    catch (err) {
        job.status = "error";
        job.log.push(`[ERROR] ${err.message}`);
        await (0, queries_1.logBackupEvent)({
            jobId,
            status: "error",
            bytesWritten: job.bytesWritten,
        });
        throw err;
    }
}
async function getBackupStatus(jobId) {
    const job = backupJobs.get(jobId);
    if (!job) {
        return { jobId, progress: 0, status: "idle", log: [], bytesWritten: 0 };
    }
    return { ...job };
}
