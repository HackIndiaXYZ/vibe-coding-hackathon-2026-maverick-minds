"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logStorageEvent = logStorageEvent;
exports.logStreamEvent = logStreamEvent;
exports.logBackupEvent = logBackupEvent;
exports.createSessionRecord = createSessionRecord;
exports.invalidateSessionRecord = invalidateSessionRecord;
exports.isSessionValid = isSessionValid;
const dbClient_1 = require("./dbClient");
async function logStorageEvent(status) {
    await (0, dbClient_1.query)(`INSERT INTO storage_events (path, total_space, used_space, free_space)
     VALUES ($1, $2, $3, $4)`, [status.path, status.totalSpace, status.usedSpace, status.freeSpace]);
}
async function logStreamEvent(params) {
    await (0, dbClient_1.query)(`INSERT INTO stream_events (camera_id, session_id, event, bytes_written, duration_seconds)
     VALUES ($1, $2, $3, $4, $5)`, [
        params.cameraId,
        params.sessionId,
        params.event,
        params.bytesWritten,
        params.durationSeconds ?? null,
    ]);
}
async function logBackupEvent(params) {
    await (0, dbClient_1.query)(`INSERT INTO backup_events (job_id, status, bytes_written)
     VALUES ($1, $2, $3)`, [params.jobId, params.status, params.bytesWritten]);
}
async function createSessionRecord(token, expiresAt) {
    await (0, dbClient_1.query)(`INSERT INTO sessions (token_hash, expires_at)
     VALUES ($1, $2)`, [hashToken(token), expiresAt.toISOString()]);
}
async function invalidateSessionRecord(token) {
    await (0, dbClient_1.query)(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(token)]);
}
async function isSessionValid(token) {
    const result = await (0, dbClient_1.query)(`SELECT COUNT(*) as count FROM sessions
     WHERE token_hash = $1 AND expires_at > NOW()`, [hashToken(token)]);
    return parseInt(result.rows[0]?.count ?? '0', 10) > 0;
}
const crypto_1 = __importDefault(require("crypto"));
function hashToken(token) {
    return crypto_1.default.createHash('sha256').update(token).digest('hex');
}
