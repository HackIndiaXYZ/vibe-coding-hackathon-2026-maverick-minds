"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startStream = startStream;
exports.saveChunkEncrypted = saveChunkEncrypted;
exports.stopStream = stopStream;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const cryptoEngine_1 = require("./cryptoEngine");
const queries_1 = require("../database/queries");
const storageManager_1 = require("./storageManager");
const activeSessions = new Map();
async function startStream(cameraId) {
    if (activeSessions.has(cameraId)) {
        return { success: true, sessionId: activeSessions.get(cameraId).sessionId };
    }
    try {
        const sessionId = crypto_1.default.randomUUID();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const baseStreamDir = path_1.default.join((0, storageManager_1.getCurrentStoragePath)(), 'streams');
        const outputDir = path_1.default.join(baseStreamDir, cameraId);
        await fs_1.default.promises.mkdir(outputDir, { recursive: true });
        const chunkPath = path_1.default.join(outputDir, `${timestamp}.enc`);
        const writeStream = fs_1.default.createWriteStream(chunkPath, { flags: 'a' });
        const session = {
            cameraId,
            sessionId,
            startedAt: Date.now(),
            outputDir,
            writeStream,
            bytesWritten: 0,
        };
        activeSessions.set(cameraId, session);
        await (0, queries_1.logStreamEvent)({ cameraId, sessionId, event: 'start', bytesWritten: 0 });
        console.log(`[streamHandler] Stream started: cameraId=${cameraId} session=${sessionId}`);
        return { success: true, sessionId };
    }
    catch (err) {
        console.error('[streamHandler] startStream error:', err);
        return { success: false, error: err.message };
    }
}
async function saveChunkEncrypted(raw) {
    const session = [...activeSessions.values()][0];
    if (!session || !session.writeStream) {
        throw new Error('[streamHandler] No active stream session');
    }
    const encrypted = (0, cryptoEngine_1.encrypt)(raw);
    const fileId = crypto_1.default.randomUUID();
    return new Promise((resolve, reject) => {
        session.writeStream.write(encrypted, (err) => {
            if (err) {
                reject(err);
                return;
            }
            session.bytesWritten += encrypted.length;
            resolve({ success: true, fileId });
        });
    });
}
async function stopStream(cameraId) {
    const session = activeSessions.get(cameraId);
    if (!session) {
        return { success: true }; // already stopped
    }
    try {
        await new Promise((resolve, reject) => {
            if (!session.writeStream) {
                resolve();
                return;
            }
            session.writeStream.end((err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
        const duration = Math.round((Date.now() - session.startedAt) / 1000);
        await (0, queries_1.logStreamEvent)({
            cameraId,
            sessionId: session.sessionId,
            event: 'stop',
            bytesWritten: session.bytesWritten,
            durationSeconds: duration,
        });
        activeSessions.delete(cameraId);
        console.log(`[streamHandler] Stream stopped: cameraId=${cameraId} bytes=${session.bytesWritten}`);
        return { success: true, sessionId: session.sessionId };
    }
    catch (err) {
        console.error('[streamHandler] stopStream error:', err);
        return { success: false, error: err.message };
    }
}
