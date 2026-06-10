import crypto from 'crypto';
import { app } from 'electron';
import fs from 'fs';
import path from 'path';

const ALGORITHM        = 'aes-256-gcm' as const;
const KEY_LENGTH       = 32;   // 256-bit
const IV_LENGTH        = 12;   // 96-bit GCM nonce
const AUTH_TAG_LENGTH  = 16;
const PBKDF2_ITERS     = 200_000;
const PBKDF2_DIGEST    = 'sha256';
const SALT_LENGTH      = 32;

let transientKey: string | null = null;

// ─── System key (used for general vault encryption) ───────────────────────────

function resolveKey(): Buffer {
  let hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== KEY_LENGTH * 2) {
    try {
      const settingsPath = path.join(app.getPath('userData'), 'settings.json');
      if (fs.existsSync(settingsPath)) {
        const content = fs.readFileSync(settingsPath, 'utf8');
        const data    = JSON.parse(content);
        if (data.encryptionKey && data.encryptionKey.length === KEY_LENGTH * 2) {
          hex = data.encryptionKey;
          process.env.ENCRYPTION_KEY = hex;
        }
      }
      if (!hex) {
        hex = crypto.randomBytes(KEY_LENGTH).toString('hex');
        process.env.ENCRYPTION_KEY = hex;
        const data = fs.existsSync(settingsPath)
          ? JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
          : {};
        data.encryptionKey = hex;
        fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2), 'utf8');
      }
    } catch {
      if (!transientKey) transientKey = crypto.randomBytes(KEY_LENGTH).toString('hex');
      hex = transientKey;
    }
  }
  return Buffer.from(hex!, 'hex');
}

// ─── System encrypt/decrypt (stream chunks) ───────────────────────────────────
// Output layout: [ IV (12B) | ciphertext | authTag (16B) ]

export function encrypt(plaintext: Buffer): Buffer {
  const key    = resolveKey();
  const iv     = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const enc    = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, enc, cipher.getAuthTag()]);
}

export function decrypt(ciphertext: Buffer): Buffer {
  const key = resolveKey();
  if (ciphertext.length < IV_LENGTH + AUTH_TAG_LENGTH)
    throw new RangeError('[cryptoEngine] Ciphertext too short — likely corrupted');
  const iv      = ciphertext.subarray(0, IV_LENGTH);
  const authTag = ciphertext.subarray(ciphertext.length - AUTH_TAG_LENGTH);
  const enc     = ciphertext.subarray(IV_LENGTH, ciphertext.length - AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

// ─── Password-derived key (for Surveillance Vault) ───────────────────────────
// Output layout: [ salt (32B) | IV (12B) | ciphertext | authTag (16B) ]

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERS, KEY_LENGTH, PBKDF2_DIGEST);
}

export function encryptWithPassword(plaintext: Buffer, password: string): Buffer {
  const salt   = crypto.randomBytes(SALT_LENGTH);
  const key    = deriveKey(password, salt);
  const iv     = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const enc    = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([salt, iv, enc, cipher.getAuthTag()]);
}

export function decryptWithPassword(ciphertext: Buffer, password: string): Buffer {
  const minLen = SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;
  if (ciphertext.length < minLen)
    throw new RangeError('[cryptoEngine] Encrypted blob too short');
  const salt    = ciphertext.subarray(0, SALT_LENGTH);
  const iv      = ciphertext.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = ciphertext.subarray(ciphertext.length - AUTH_TAG_LENGTH);
  const enc     = ciphertext.subarray(SALT_LENGTH + IV_LENGTH, ciphertext.length - AUTH_TAG_LENGTH);
  const key     = deriveKey(password, salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  // Will throw if password is wrong (GCM auth tag mismatch)
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

// ─── Vault password verifier (stored in settings.json) ───────────────────────
// Format: "<salt_hex>:<hash_hex>"  where hash = PBKDF2(password, salt)

export function hashVaultPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const hash = deriveKey(password, salt);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyVaultPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt     = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual   = deriveKey(password, salt);
  return crypto.timingSafeEqual(actual, expected);
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export function generateKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

export function safeEquals(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
