"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionStore = void 0;
exports.registerIpcHandlers = registerIpcHandlers;
const electron_1 = require("electron");
const fs_1 = __importDefault(require("fs"));
const storageManager_1 = require("./services/storageManager");
const streamHandler_1 = require("./services/streamHandler");
const streamHandler_2 = require("./services/streamHandler");
const storageManager_2 = require("./services/storageManager");
const authService_1 = require("./services/authService");
const chatbotService_1 = require("./services/chatbotService");
const fileManager_1 = require("./services/fileManager");
const vaultService_1 = require("./services/vaultService");
const wireguardManager_1 = require("./services/wireguardManager");
// Session store — declared here so all handlers can reference it
exports.sessionStore = new Map();
function registerIpcHandlers() {
    electron_1.ipcMain.handle("req-storage-status", async (_event) => {
        try {
            return await (0, storageManager_1.getStorageStatus)();
        }
        catch (err) {
            console.error("[ipc] req-storage-status error:", err);
            throw err;
        }
    });
    electron_1.ipcMain.handle("req-save-chunk", async (_event, buffer) => {
        try {
            if (!(buffer instanceof ArrayBuffer)) {
                throw new TypeError("req-save-chunk: payload must be ArrayBuffer");
            }
            return await (0, streamHandler_1.saveChunkEncrypted)(Buffer.from(buffer));
        }
        catch (err) {
            console.error("[ipc] req-save-chunk error:", err);
            throw err;
        }
    });
    electron_1.ipcMain.handle("req-update-allocation", async (_event, bytes) => {
        try {
            if (typeof bytes !== "number" || bytes < 0) {
                throw new TypeError("req-update-allocation: bytes must be positive number");
            }
            return await (0, storageManager_1.updateAllocation)(bytes);
        }
        catch (err) {
            console.error("[ipc] req-update-allocation error:", err);
            throw err;
        }
    });
    electron_1.ipcMain.handle("req-select-folder", async (_event) => {
        try {
            return await (0, storageManager_1.selectFolder)();
        }
        catch (err) {
            console.error("[ipc] req-select-folder error:", err);
            throw err;
        }
    });
    electron_1.ipcMain.handle("req-start-stream", async (_event, { cameraId }) => {
        try {
            if (typeof cameraId !== "string" || !cameraId.trim()) {
                throw new TypeError("req-start-stream: cameraId must be non-empty string");
            }
            return await (0, streamHandler_2.startStream)(cameraId);
        }
        catch (err) {
            console.error("[ipc] req-start-stream error:", err);
            throw err;
        }
    });
    electron_1.ipcMain.handle("req-stop-stream", async (_event, { cameraId }) => {
        try {
            return await (0, streamHandler_2.stopStream)(cameraId);
        }
        catch (err) {
            console.error("[ipc] req-stop-stream error:", err);
            throw err;
        }
    });
    electron_1.ipcMain.handle("req-run-backup", async (_event) => {
        try {
            return await (0, storageManager_2.runBackup)();
        }
        catch (err) {
            console.error("[ipc] req-run-backup error:", err);
            throw err;
        }
    });
    electron_1.ipcMain.handle("req-backup-status", async (_event, { jobId }) => {
        try {
            if (typeof jobId !== "string")
                throw new TypeError("req-backup-status: jobId required");
            return await (0, storageManager_2.getBackupStatus)(jobId);
        }
        catch (err) {
            console.error("[ipc] req-backup-status error:", err);
            throw err;
        }
    });
    electron_1.ipcMain.handle("req-login", async (_event, { pin }) => {
        try {
            if (typeof pin !== "string" || pin.length < 4) {
                return { success: false, error: "PIN must be at least 4 characters" };
            }
            return await (0, authService_1.createSession)(pin);
        }
        catch (err) {
            console.error("[ipc] req-login error:", err);
            return { success: false, error: "Authentication failed" };
        }
    });
    electron_1.ipcMain.handle("req-chatbot-status", async () => {
        try {
            return await (0, chatbotService_1.getChatbotStatus)();
        }
        catch (err) {
            console.error("[ipc] req-chatbot-status error:", err);
            throw err;
        }
    });
    electron_1.ipcMain.handle("req-chatbot-send", async (_event, { message, sessionId, useContext, }) => {
        try {
            if (typeof message !== "string" || !message.trim()) {
                throw new TypeError("req-chatbot-send: message required");
            }
            return await (0, chatbotService_1.sendChatMessage)(message, sessionId, useContext !== false);
        }
        catch (err) {
            console.error("[ipc] req-chatbot-send error:", err);
            throw err;
        }
    });
    electron_1.ipcMain.handle("req-chatbot-history", async (_event, { sessionId }) => {
        try {
            if (typeof sessionId !== "string")
                throw new TypeError("sessionId required");
            return (0, chatbotService_1.getChatHistory)(sessionId);
        }
        catch (err) {
            console.error("[ipc] req-chatbot-history error:", err);
            throw err;
        }
    });
    electron_1.ipcMain.handle("req-chatbot-new-session", async () => {
        try {
            return (0, chatbotService_1.createNewSession)();
        }
        catch (err) {
            console.error("[ipc] req-chatbot-new-session error:", err);
            throw err;
        }
    });
    electron_1.ipcMain.handle("req-chatbot-config", async (_event, updates) => {
        try {
            return (0, chatbotService_1.updateChatbotConfig)(updates || {});
        }
        catch (err) {
            console.error("[ipc] req-chatbot-config error:", err);
            throw err;
        }
    });
    electron_1.ipcMain.handle("req-chatbot-context-list", async () => {
        try {
            return (0, chatbotService_1.listContextFiles)();
        }
        catch (err) {
            console.error("[ipc] req-chatbot-context-list error:", err);
            throw err;
        }
    });
    electron_1.ipcMain.handle("req-chatbot-context-add", async (_event, { relativePath }) => {
        try {
            if (relativePath) {
                return (0, chatbotService_1.addContextFile)(relativePath);
            }
            return await (0, chatbotService_1.pickAndAddContextFile)();
        }
        catch (err) {
            console.error("[ipc] req-chatbot-context-add error:", err);
            throw err;
        }
    });
    electron_1.ipcMain.handle("req-chatbot-context-add-dir", async (_event, { relativeDir }) => {
        try {
            if (typeof relativeDir !== "string")
                throw new TypeError("relativeDir required");
            return (0, chatbotService_1.addContextDirectory)(relativeDir);
        }
        catch (err) {
            console.error("[ipc] req-chatbot-context-add-dir error:", err);
            throw err;
        }
    });
    electron_1.ipcMain.handle("req-chatbot-context-remove", async (_event, { fileId }) => {
        try {
            if (typeof fileId !== "string")
                throw new TypeError("fileId required");
            return { success: (0, chatbotService_1.removeContextFile)(fileId) };
        }
        catch (err) {
            console.error("[ipc] req-chatbot-context-remove error:", err);
            throw err;
        }
    });
    electron_1.ipcMain.handle("req-chatbot-context-docker", async () => {
        try {
            return (0, chatbotService_1.addContextDockerFiles)();
        }
        catch (err) {
            console.error("[ipc] req-chatbot-context-docker error:", err);
            throw err;
        }
    });
    electron_1.ipcMain.handle("req-docker-start", async (_event, { profile }) => {
        try {
            const valid = ["cpu", "nvidia", "amd"];
            const p = valid.includes(profile || "")
                ? profile
                : "cpu";
            return await (0, chatbotService_1.startDockerOllama)(p);
        }
        catch (err) {
            console.error("[ipc] req-docker-start error:", err);
            throw err;
        }
    });
    electron_1.ipcMain.handle("req-docker-stop", async () => {
        try {
            return await (0, chatbotService_1.stopDockerOllama)();
        }
        catch (err) {
            console.error("[ipc] req-docker-stop error:", err);
            throw err;
        }
    });
    electron_1.ipcMain.handle("req-docker-pull-model", async (_event, { model }) => {
        try {
            if (typeof model !== "string" || !model.trim())
                throw new TypeError("model required");
            await (0, chatbotService_1.pullDockerModel)(model);
            return { success: true };
        }
        catch (err) {
            console.error("[ipc] req-docker-pull-model error:", err);
            throw err;
        }
    });
    electron_1.ipcMain.handle("req-list-files", async () => {
        try {
            return await (0, fileManager_1.listFiles)();
        }
        catch (err) {
            console.error("[ipc] req-list-files error:", err);
            throw err;
        }
    });
    electron_1.ipcMain.handle("req-upload-file", async (_event, { buffer, fileName }) => {
        try {
            if (!(buffer instanceof ArrayBuffer)) {
                throw new TypeError("req-upload-file: buffer must be ArrayBuffer");
            }
            if (typeof fileName !== "string" || !fileName.trim()) {
                throw new TypeError("req-upload-file: fileName required");
            }
            return await (0, fileManager_1.uploadFile)(Buffer.from(buffer), fileName);
        }
        catch (err) {
            console.error("[ipc] req-upload-file error:", err);
            throw err;
        }
    });
    electron_1.ipcMain.handle("req-delete-file", async (_event, { fileId }) => {
        try {
            if (typeof fileId !== "string")
                throw new TypeError("fileId required");
            return await (0, fileManager_1.deleteFile)(fileId);
        }
        catch (err) {
            console.error("[ipc] req-delete-file error:", err);
            throw err;
        }
    });
    electron_1.ipcMain.handle("req-download-file", async (_event, { filePath }) => {
        try {
            if (typeof filePath !== "string")
                throw new TypeError("filePath required");
            const localPath = await (0, fileManager_1.getFilePath)(filePath);
            if (!localPath) {
                throw new Error("File not found");
            }
            return { path: localPath };
        }
        catch (err) {
            console.error("[ipc] req-download-file error:", err);
            throw err;
        }
    });
    electron_1.ipcMain.handle("req-logout", async (_event, { token }) => {
        try {
            if (typeof token !== "string")
                return { success: false, error: "token required" };
            exports.sessionStore.delete(token);
            return { success: true };
        }
        catch (err) {
            console.error("[ipc] req-logout error:", err);
            return { success: false };
        }
    });
    // ── Surveillance Vault ────────────────────────────────────────────────────
    electron_1.ipcMain.handle("req-vault-status", async () => {
        try {
            return { hasPassword: (0, vaultService_1.hasVaultPassword)() };
        }
        catch (err) {
            console.error("[ipc] req-vault-status error:", err);
            throw err;
        }
    });
    electron_1.ipcMain.handle("req-vault-set-password", async (_event, { newPassword, currentPassword }) => {
        try {
            if (typeof newPassword !== "string" || newPassword.length < 6)
                return { success: false, error: "Password must be at least 6 characters." };
            return (0, vaultService_1.setVaultPassword)(newPassword, currentPassword);
        }
        catch (err) {
            console.error("[ipc] req-vault-set-password error:", err);
            return { success: false, error: "Failed to set password." };
        }
    });
    electron_1.ipcMain.handle("req-vault-verify", async (_event, { password }) => {
        try {
            if (typeof password !== "string")
                return { valid: false, error: "Password required." };
            return (0, vaultService_1.checkVaultPassword)(password);
        }
        catch (err) {
            console.error("[ipc] req-vault-verify error:", err);
            return { valid: false, error: "Verification failed." };
        }
    });
    electron_1.ipcMain.handle("req-vault-list", async () => {
        try {
            return (0, vaultService_1.listSurveillanceFiles)();
        }
        catch (err) {
            console.error("[ipc] req-vault-list error:", err);
            throw err;
        }
    });
    electron_1.ipcMain.handle("req-vault-upload", async (_event, { buffer, fileName }) => {
        try {
            if (!(buffer instanceof ArrayBuffer))
                return { success: false, error: "Buffer required." };
            if (typeof fileName !== "string" || !fileName.trim())
                return { success: false, error: "fileName required." };
            return (0, vaultService_1.saveSurveillanceFile)(fileName, Buffer.from(buffer));
        }
        catch (err) {
            console.error("[ipc] req-vault-upload error:", err);
            return { success: false, error: String(err) };
        }
    });
    electron_1.ipcMain.handle("req-vault-decrypt", async (_event, { id, password }) => {
        try {
            if (typeof id !== "string" || typeof password !== "string")
                throw new TypeError("id and password required");
            const decrypted = (0, vaultService_1.decryptSurveillanceFile)(id, password);
            return { success: true, buffer: decrypted.buffer.slice(decrypted.byteOffset, decrypted.byteOffset + decrypted.byteLength) };
        }
        catch (err) {
            console.error("[ipc] req-vault-decrypt error:", err);
            return { success: false, error: err.message || "Decryption failed — wrong password?" };
        }
    });
    electron_1.ipcMain.handle("req-vault-delete", async (_event, { id }) => {
        try {
            if (typeof id !== "string")
                throw new TypeError("id required");
            return (0, vaultService_1.deleteSurveillanceFile)(id);
        }
        catch (err) {
            console.error("[ipc] req-vault-delete error:", err);
            return { success: false, error: String(err) };
        }
    });
    // ─── WireGuard VPN ─────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('vpn:check-installed', async () => {
        return await (0, wireguardManager_1.checkWireGuardInstalled)();
    });
    electron_1.ipcMain.handle('vpn:init-server', async (_e, endpoint, port) => {
        try {
            const cfg = await (0, wireguardManager_1.initServer)(endpoint, port);
            const { privateKey: _pk, ...safe } = cfg;
            return { success: true, config: safe };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('vpn:add-peer', async (_e, name) => {
        try {
            const result = await (0, wireguardManager_1.addPeer)(name);
            return { success: true, ...result, peer: { ...result.peer, privateKey: undefined } };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('vpn:list-peers', async () => {
        return (0, wireguardManager_1.listPeers)().map(({ privateKey: _pk, ...safe }) => safe);
    });
    electron_1.ipcMain.handle('vpn:remove-peer', async (_e, publicKey) => {
        try {
            (0, wireguardManager_1.removePeer)(publicKey);
            return { success: true };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('vpn:server-meta', async () => {
        return (0, wireguardManager_1.getServerMeta)();
    });
    electron_1.ipcMain.handle('vpn:start', async () => {
        return await (0, wireguardManager_1.startTunnel)();
    });
    electron_1.ipcMain.handle('vpn:stop', async () => {
        return await (0, wireguardManager_1.stopTunnel)();
    });
    electron_1.ipcMain.handle('vpn:status', async () => {
        return await (0, wireguardManager_1.getTunnelStatus)();
    });
    electron_1.ipcMain.handle('vpn:peer-qr', async (_e, publicKey) => {
        try {
            const result = await (0, wireguardManager_1.getPeerClientConf)(publicKey);
            if (!result)
                return { success: false, error: 'Peer not found' };
            return { success: true, ...result };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('vpn:save-config-file', async (_e, { clientConf, fileName }) => {
        try {
            const { filePath, canceled } = await electron_1.dialog.showSaveDialog({
                title: 'Save WireGuard Peer Configuration',
                defaultPath: fileName,
                filters: [{ name: 'WireGuard Config', extensions: ['conf'] }]
            });
            if (canceled || !filePath)
                return { success: false };
            fs_1.default.writeFileSync(filePath, clientConf, 'utf8');
            return { success: true, filePath };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    console.log("[ipc] All handlers registered");
}
