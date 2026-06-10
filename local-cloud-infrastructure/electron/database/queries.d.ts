import type { StorageStatus } from '../services/storageManager';
export declare function logStorageEvent(status: StorageStatus): Promise<void>;
interface StreamEventParams {
    cameraId: string;
    sessionId: string;
    event: 'start' | 'stop';
    bytesWritten: number;
    durationSeconds?: number;
}
export declare function logStreamEvent(params: StreamEventParams): Promise<void>;
interface BackupEventParams {
    jobId: string;
    status: 'complete' | 'error';
    bytesWritten: number;
}
export declare function logBackupEvent(params: BackupEventParams): Promise<void>;
export declare function createSessionRecord(token: string, expiresAt: Date): Promise<void>;
export declare function invalidateSessionRecord(token: string): Promise<void>;
export declare function isSessionValid(token: string): Promise<boolean>;
export {};
