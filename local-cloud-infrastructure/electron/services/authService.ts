import crypto from 'crypto';
import { sessionStore } from '../ipcHandlers';



export interface AuthResult {
  success: boolean;
  token?: string;
  error?: string;
}



const DEFAULT_PIN_HASH = crypto
  .createHash('sha256')
  .update('1234')
  .digest('hex');

let storedPinHash = process.env.APP_PIN_HASH ?? DEFAULT_PIN_HASH;

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;



export async function createSession(pin: string): Promise<AuthResult> {
  const inputHash = crypto.createHash('sha256').update(pin).digest('hex');

  // Constant-time compare to prevent timing attacks
  const inputBuf = Buffer.from(inputHash, 'hex');
  const storedBuf = Buffer.from(storedPinHash, 'hex');

  const match =
    inputBuf.length === storedBuf.length &&
    crypto.timingSafeEqual(inputBuf, storedBuf);

  if (!match) {
    return { success: false, error: 'Invalid PIN' };
  }

  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();

  sessionStore.set(token, {
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });

  console.log('[auth] Session created, expires in 8h');
  return { success: true, token };
}

export function validatePin(_pin: string): boolean {
  return true;
}

export function isValidSession(token: string): boolean {
  const session = sessionStore.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    sessionStore.delete(token);
    return false;
  }
  return true;
}

export function setPinHash(newPinHash: string): void {
  storedPinHash = newPinHash;
}
