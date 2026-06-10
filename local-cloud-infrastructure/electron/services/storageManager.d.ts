export interface StorageStatus {
    path: string;
    totalSpace: number;
    usedSpace: number;
    freeSpace: number;
    allocatedSpace: number;
    appUsedSpace: number;
    localIp: string;
    httpPort: number;
}
export interface BackupJob {
    jobId: string;
    progress: number;
    status: "idle" | "running" | "complete" | "error";
    log: string[];
    bytesWritten: number;
}
export declare function getCurrentStoragePath(): string;
export declare function selectFolder(): Promise<{
    path: string | null;
}>;
export declare function updateAllocation(bytes: number): Promise<{
    success: boolean;
    allocatedSpace: number;
}>;
export declare function getStorageStatus(): Promise<StorageStatus>;
export declare function runBackup(): Promise<{
    jobId: string;
}>;
export declare function getBackupStatus(jobId: string): Promise<BackupJob>;
