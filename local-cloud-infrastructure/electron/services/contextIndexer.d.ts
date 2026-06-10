export declare function isContextSupportedFile(fileName: string): boolean;
export declare function getFileTypeLabel(fileName: string): string;
export interface ContextFileEntry {
    id: string;
    name: string;
    relativePath: string;
    size: number;
    chunkCount: number;
    indexedAt: string;
    fileType?: string;
}
export declare function initContextIndexer(): void;
export declare function listContextFiles(): ContextFileEntry[];
export declare function addContextFile(relativePath: string): ContextFileEntry;
export declare function addContextDirectory(relativeDir: string): ContextFileEntry[];
export declare function removeContextFile(fileId: string): boolean;
export declare function searchContext(query: string, k?: number): string[];
export declare function getContextDirPath(): string;
export declare function addContextDockerFiles(): ContextFileEntry[];
export declare function copyFileToContext(sourcePath: string): ContextFileEntry;
