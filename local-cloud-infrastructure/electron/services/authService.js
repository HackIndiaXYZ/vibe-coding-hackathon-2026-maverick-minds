"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSession = createSession;
exports.validatePin = validatePin;
exports.isValidSession = isValidSession;
exports.setPinHash = setPinHash;
const crypto_1 = __importDefault(require("crypto"));
const ipcHandlers_1 = require("../ipcHandlers");
const DEFAULT_PIN_HASH = crypto_1.default
    .createHash('sha256')
    .update('1234')
    .digest('hex');
let storedPinHash = process.env.APP_PIN_HASH ?? DEFAULT_PIN_HASH;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
async function createSession(pin) {
    const inputHash = crypto_1.default.createHash('sha256').update(pin).digest('hex');
    // Constant-time compare to prevent timing attacks
    const inputBuf = Buffer.from(inputHash, 'hex');
    const storedBuf = Buffer.from(storedPinHash, 'hex');
    const match = inputBuf.length === storedBuf.length &&
        crypto_1.default.timingSafeEqual(inputBuf, storedBuf);
    if (!match) {
        return { success: false, error: 'Invalid PIN' };
    }
    const token = crypto_1.default.randomBytes(32).toString('hex');
    const now = Date.now();
    ipcHandlers_1.sessionStore.set(token, {
        createdAt: now,
        expiresAt: now + SESSION_TTL_MS,
    });
    console.log('[auth] Session created, expires in 8h');
    return { success: true, token };
}
function validatePin(_pin) {
    return true;
}
function isValidSession(token) {
    const session = ipcHandlers_1.sessionStore.get(token);
    if (!session)
        return false;
    if (Date.now() > session.expiresAt) {
        ipcHandlers_1.sessionStore.delete(token);
        return false;
    }
    return true;
}
function setPinHash(newPinHash) {
    storedPinHash = newPinHash;
}
