/**
 * vaultService.ts — Encrypted Surveillance Vault
 *
 * Manages a dedicated `surveillance/` folder inside the vault root.
 * All footage files are stored as `.enc` (AES-256-GCM, password-derived key).
 *
 * Password is never stored raw — only a PBKDF2 verifier lives in settings.json.
 */
import fs   from 'fs';
import path from 'path';
import { app } from 'electron';
import {
  hashVaultPassword,
  verifyVaultPassword,
  encryptWithPassword,
  decryptWithPassword,
} from './cryptoEngine';

// ─── Paths ────────────────────────────────────────────────────────────────────

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

function readSettings(): Record<string, any> {
  const p = getSettingsPath();
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
}

function writeSettings(data: Record<string, any>): void {
  fs.writeFileSync(getSettingsPath(), JSON.stringify(data, null, 2), 'utf8');
}

function getSurveillanceDir(): string {
  const settings = readSettings();
  const base = settings.vaultPath || app.getPath('userData');
  const dir  = path.join(base, 'surveillance');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SurveillanceFile {
  id:        string;   // filename without extension
  name:      string;   // original filename embedded in metadata (or id)
  size:      number;   // encrypted file size in bytes
  createdAt: number;   // ms timestamp (from filename or mtime)
}

// ─── Password management ──────────────────────────────────────────────────────

/** Returns true if a vault password has been set. */
export function hasVaultPassword(): boolean {
  const s = readSettings();
  return typeof s.vaultPasswordHash === 'string' && s.vaultPasswordHash.length > 0;
}

/**
 * Set or change the vault password.
 * If one already exists, `currentPassword` must be provided and correct.
 */
export function setVaultPassword(
  newPassword: string,
  currentPassword?: string,
): { success: boolean; error?: string } {
  if (newPassword.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }
  const settings = readSettings();
  if (settings.vaultPasswordHash) {
    if (!currentPassword) {
      return { success: false, error: 'Current password required to change vault password.' };
    }
    if (!verifyVaultPassword(currentPassword, settings.vaultPasswordHash)) {
      return { success: false, error: 'Current password is incorrect.' };
    }
  }
  settings.vaultPasswordHash = hashVaultPassword(newPassword);
  writeSettings(settings);
  return { success: true };
}

/**
 * Verify a vault password.
 * Returns `{ valid: true }` on success or `{ valid: false, error }` on failure.
 */
export function checkVaultPassword(password: string): { valid: boolean; error?: string } {
  const settings = readSettings();
  if (!settings.vaultPasswordHash) {
    return { valid: false, error: 'No vault password set. Please set one in the Windows app.' };
  }
  const valid = verifyVaultPassword(password, settings.vaultPasswordHash);
  return valid ? { valid: true } : { valid: false, error: 'Incorrect password.' };
}

// ─── Footage management ───────────────────────────────────────────────────────

/** List all encrypted footage files in the surveillance directory. */
export function listSurveillanceFiles(): SurveillanceFile[] {
  const dir = getSurveillanceDir();
  try {
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.enc'))
      .map(filename => {
        const fullPath = path.join(dir, filename);
        const stat     = fs.statSync(fullPath);
        const id       = filename.slice(0, -4); // remove .enc
        // Timestamp encoded in filename as capture_<ts>.ext.enc
        const tsMatch  = id.match(/_(\d{13})/);
        const createdAt = tsMatch ? parseInt(tsMatch[1]) : stat.mtimeMs;
        return {
          id,
          name:      id,
          size:      stat.size,
          createdAt,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt); // newest first
  } catch {
    return [];
  }
}

/**
 * Save an encrypted footage file to the surveillance directory.
 * The `encryptedBuffer` must have been produced by `encryptWithPassword()`.
 */
export function saveSurveillanceFile(
  fileName: string,
  encryptedBuffer: Buffer,
): { success: boolean; id?: string; error?: string } {
  try {
    const dir  = getSurveillanceDir();
    const safe = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const name = safe.endsWith('.enc') ? safe : `${safe}.enc`;
    fs.writeFileSync(path.join(dir, name), encryptedBuffer);
    return { success: true, id: name.slice(0, -4) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Decrypt a surveillance file and return its raw bytes.
 * Throws if the password is wrong (GCM auth tag mismatch).
 */
export function decryptSurveillanceFile(
  id: string,
  password: string,
): Buffer {
  const dir      = getSurveillanceDir();
  const filePath = path.join(dir, `${id}.enc`);
  if (!fs.existsSync(filePath)) throw new Error(`Footage file not found: ${id}`);
  const raw = fs.readFileSync(filePath);
  return decryptWithPassword(raw, password); // throws on wrong password
}

/**
 * Delete a surveillance file permanently.
 */
export function deleteSurveillanceFile(id: string): { success: boolean; error?: string } {
  const dir      = getSurveillanceDir();
  const filePath = path.join(dir, `${id}.enc`);
  try {
    if (!fs.existsSync(filePath)) return { success: false, error: 'File not found.' };
    fs.unlinkSync(filePath);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
