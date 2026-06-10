"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasVaultPassword = hasVaultPassword;
exports.setVaultPassword = setVaultPassword;
exports.checkVaultPassword = checkVaultPassword;
exports.listSurveillanceFiles = listSurveillanceFiles;
exports.saveSurveillanceFile = saveSurveillanceFile;
exports.decryptSurveillanceFile = decryptSurveillanceFile;
exports.deleteSurveillanceFile = deleteSurveillanceFile;
/**
 * vaultService.ts — Encrypted Surveillance Vault
 *
 * Manages a dedicated `surveillance/` folder inside the vault root.
 * All footage files are stored as `.enc` (AES-256-GCM, password-derived key).
 *
 * Password is never stored raw — only a PBKDF2 verifier lives in settings.json.
 */
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
const cryptoEngine_1 = require("./cryptoEngine");
// ─── Paths ────────────────────────────────────────────────────────────────────
function getSettingsPath() {
    return path_1.default.join(electron_1.app.getPath('userData'), 'settings.json');
}
function readSettings() {
    const p = getSettingsPath();
    if (!fs_1.default.existsSync(p))
        return {};
    try {
        return JSON.parse(fs_1.default.readFileSync(p, 'utf8'));
    }
    catch {
        return {};
    }
}
function writeSettings(data) {
    fs_1.default.writeFileSync(getSettingsPath(), JSON.stringify(data, null, 2), 'utf8');
}
function getSurveillanceDir() {
    const settings = readSettings();
    const base = settings.vaultPath || electron_1.app.getPath('userData');
    const dir = path_1.default.join(base, 'surveillance');
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
    return dir;
}
// ─── Password management ──────────────────────────────────────────────────────
/** Returns true if a vault password has been set. */
function hasVaultPassword() {
    const s = readSettings();
    return typeof s.vaultPasswordHash === 'string' && s.vaultPasswordHash.length > 0;
}
/**
 * Set or change the vault password.
 * If one already exists, `currentPassword` must be provided and correct.
 */
function setVaultPassword(newPassword, currentPassword) {
    if (newPassword.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters.' };
    }
    const settings = readSettings();
    if (settings.vaultPasswordHash) {
        if (!currentPassword) {
            return { success: false, error: 'Current password required to change vault password.' };
        }
        if (!(0, cryptoEngine_1.verifyVaultPassword)(currentPassword, settings.vaultPasswordHash)) {
            return { success: false, error: 'Current password is incorrect.' };
        }
    }
    settings.vaultPasswordHash = (0, cryptoEngine_1.hashVaultPassword)(newPassword);
    writeSettings(settings);
    return { success: true };
}
/**
 * Verify a vault password.
 * Returns `{ valid: true }` on success or `{ valid: false, error }` on failure.
 */
function checkVaultPassword(password) {
    const settings = readSettings();
    if (!settings.vaultPasswordHash) {
        return { valid: false, error: 'No vault password set. Please set one in the Windows app.' };
    }
    const valid = (0, cryptoEngine_1.verifyVaultPassword)(password, settings.vaultPasswordHash);
    return valid ? { valid: true } : { valid: false, error: 'Incorrect password.' };
}
// ─── Footage management ───────────────────────────────────────────────────────
/** List all encrypted footage files in the surveillance directory. */
function listSurveillanceFiles() {
    const dir = getSurveillanceDir();
    try {
        return fs_1.default.readdirSync(dir)
            .filter(f => f.endsWith('.enc'))
            .map(filename => {
            const fullPath = path_1.default.join(dir, filename);
            const stat = fs_1.default.statSync(fullPath);
            const id = filename.slice(0, -4); // remove .enc
            // Timestamp encoded in filename as capture_<ts>.ext.enc
            const tsMatch = id.match(/_(\d{13})/);
            const createdAt = tsMatch ? parseInt(tsMatch[1]) : stat.mtimeMs;
            return {
                id,
                name: id,
                size: stat.size,
                createdAt,
            };
        })
            .sort((a, b) => b.createdAt - a.createdAt); // newest first
    }
    catch {
        return [];
    }
}
/**
 * Save an encrypted footage file to the surveillance directory.
 * The `encryptedBuffer` must have been produced by `encryptWithPassword()`.
 */
function saveSurveillanceFile(fileName, encryptedBuffer) {
    try {
        const dir = getSurveillanceDir();
        const safe = path_1.default.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
        const name = safe.endsWith('.enc') ? safe : `${safe}.enc`;
        fs_1.default.writeFileSync(path_1.default.join(dir, name), encryptedBuffer);
        return { success: true, id: name.slice(0, -4) };
    }
    catch (e) {
        return { success: false, error: e.message };
    }
}
/**
 * Decrypt a surveillance file and return its raw bytes.
 * Throws if the password is wrong (GCM auth tag mismatch).
 */
function decryptSurveillanceFile(id, password) {
    const dir = getSurveillanceDir();
    const filePath = path_1.default.join(dir, `${id}.enc`);
    if (!fs_1.default.existsSync(filePath))
        throw new Error(`Footage file not found: ${id}`);
    const raw = fs_1.default.readFileSync(filePath);
    return (0, cryptoEngine_1.decryptWithPassword)(raw, password); // throws on wrong password
}
/**
 * Delete a surveillance file permanently.
 */
function deleteSurveillanceFile(id) {
    const dir = getSurveillanceDir();
    const filePath = path_1.default.join(dir, `${id}.enc`);
    try {
        if (!fs_1.default.existsSync(filePath))
            return { success: false, error: 'File not found.' };
        fs_1.default.unlinkSync(filePath);
        return { success: true };
    }
    catch (e) {
        return { success: false, error: e.message };
    }
}
