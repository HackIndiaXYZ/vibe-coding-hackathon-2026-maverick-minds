interface FileItem {
    id: string;
    name: string;
    path: string;
    size: number;
    type: string;
    uploadedAt: string;
}
export declare function listFiles(): Promise<FileItem[]>;
export declare function uploadFile(buffer: Buffer, fileName: string): Promise<{
    success: boolean;
    fileId?: string;
    error?: string;
    path?: string;
}>;
export declare function deleteFile(fileId: string): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function getFilePath(fileId: string): Promise<string | null>;
export declare function getUploadsDir(): string;
export {};
