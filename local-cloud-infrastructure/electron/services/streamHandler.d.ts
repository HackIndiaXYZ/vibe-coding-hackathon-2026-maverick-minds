export interface StreamResult {
    success: boolean;
    sessionId?: string;
    error?: string;
}
export declare function startStream(cameraId: string): Promise<StreamResult>;
export declare function saveChunkEncrypted(raw: Buffer): Promise<{
    success: boolean;
    fileId: string;
}>;
export declare function stopStream(cameraId: string): Promise<StreamResult>;
