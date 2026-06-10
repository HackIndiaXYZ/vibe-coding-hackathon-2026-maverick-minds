import { query } from './dbClient';
import type { StorageStatus } from '../services/storageManager';


export async function logStorageEvent(status: StorageStatus): Promise<void> {
  await query(
    `INSERT INTO storage_events (path, total_space, used_space, free_space)
     VALUES ($1, $2, $3, $4)`,
    [status.path, status.totalSpace, status.usedSpace, status.freeSpace]
  );
}


interface StreamEventParams {
  cameraId: string;
  sessionId: string;
  event: 'start' | 'stop';
  bytesWritten: number;
  durationSeconds?: number;
}

export async function logStreamEvent(params: StreamEventParams): Promise<void> {
  await query(
    `INSERT INTO stream_events (camera_id, session_id, event, bytes_written, duration_seconds)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      params.cameraId,
      params.sessionId,
      params.event,
      params.bytesWritten,
      params.durationSeconds ?? null,
    ]
  );
}



interface BackupEventParams {
  jobId: string;
  status: 'complete' | 'error';
  bytesWritten: number;
}

export async function logBackupEvent(params: BackupEventParams): Promise<void> {
  await query(
    `INSERT INTO backup_events (job_id, status, bytes_written)
     VALUES ($1, $2, $3)`,
    [params.jobId, params.status, params.bytesWritten]
  );
}



export async function createSessionRecord(token: string, expiresAt: Date): Promise<void> {
  await query(
    `INSERT INTO sessions (token_hash, expires_at)
     VALUES ($1, $2)`,
    [hashToken(token), expiresAt.toISOString()]
  );
}

export async function invalidateSessionRecord(token: string): Promise<void> {
  await query(
    `DELETE FROM sessions WHERE token_hash = $1`,
    [hashToken(token)]
  );
}

export async function isSessionValid(token: string): Promise<boolean> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM sessions
     WHERE token_hash = $1 AND expires_at > NOW()`,
    [hashToken(token)]
  );
  return parseInt(result.rows[0]?.count ?? '0', 10) > 0;
}



import crypto from 'crypto';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
