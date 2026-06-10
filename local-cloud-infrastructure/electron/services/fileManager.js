"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listFiles = listFiles;
exports.uploadFile = uploadFile;
exports.deleteFile = deleteFile;
exports.getFilePath = getFilePath;
exports.getUploadsDir = getUploadsDir;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const fs_2 = require("fs");
const crypto_1 = __importDefault(require("crypto"));
const UPLOADS_DIR = path_1.default.join(process.cwd(), 'local-cloud-uploads');
// Ensure uploads directory exists
async function ensureUploadsDir() {
    try {
        await fs_2.promises.access(UPLOADS_DIR);
    }
    catch {
        await fs_2.promises.mkdir(UPLOADS_DIR, { recursive: true });
    }
}
// Get file extension
function getFileExtension(fileName) {
    return path_1.default.extname(fileName).toLowerCase().replace('.', '');
}
// Generate unique file ID
function generateFileId() {
    return `file_${Date.now()}_${crypto_1.default.randomBytes(4).toString('hex')}`;
}
// Get file type based on extension
function getFileType(extension) {
    const typeMap = {
        pdf: 'application/pdf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ppt: 'application/vnd.ms-powerpoint',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        txt: 'text/plain',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        svg: 'image/svg+xml',
        mp3: 'audio/mpeg',
        mp4: 'video/mp4',
        avi: 'video/x-msvideo',
        mov: 'video/quicktime',
        zip: 'application/zip',
        rar: 'application/x-rar-compressed',
        '7z': 'application/x-7z-compressed',
    };
    return typeMap[extension] || 'application/octet-stream';
}
// List all files in uploads directory
async function listFiles() {
    await ensureUploadsDir();
    try {
        const files = await fs_2.promises.readdir(UPLOADS_DIR);
        return Promise.all(files.map(async (fileName) => {
            const filePath = path_1.default.join(UPLOADS_DIR, fileName);
            const stats = await fs_2.promises.stat(filePath);
            const extension = getFileExtension(fileName);
            return {
                id: fileName.replace('.enc', ''), // Remove encryption extension if present
                name: fileName.includes('.enc') ? fileName.replace('.enc', '') : fileName,
                path: `/uploads/${fileName}`,
                size: stats.size,
                type: getFileType(extension),
                uploadedAt: stats.mtime.toISOString(),
            };
        }));
    }
    catch (error) {
        console.error('[fileManager] listFiles error:', error);
        return [];
    }
}
// Upload file to uploads directory
async function uploadFile(buffer, fileName) {
    await ensureUploadsDir();
    try {
        const fileId = generateFileId();
        const safeFileName = path_1.default.basename(fileName); // Sanitize file name
        const filePath = path_1.default.join(UPLOADS_DIR, safeFileName);
        // Check if file already exists
        let finalFileName = safeFileName;
        let counter = 1;
        while (fs_1.default.existsSync(path_1.default.join(UPLOADS_DIR, finalFileName))) {
            const nameWithoutExt = path_1.default.basename(safeFileName, path_1.default.extname(safeFileName));
            const ext = path_1.default.extname(safeFileName);
            finalFileName = `${nameWithoutExt}_${counter}${ext}`;
            counter++;
        }
        const finalPath = path_1.default.join(UPLOADS_DIR, finalFileName);
        await fs_2.promises.writeFile(finalPath, buffer);
        return {
            success: true,
            fileId,
            path: `/uploads/${finalFileName}`,
        };
    }
    catch (error) {
        console.error('[fileManager] uploadFile error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Upload failed',
        };
    }
}
// Delete file from uploads directory
async function deleteFile(fileId) {
    await ensureUploadsDir();
    try {
        // Find the file with matching ID (with or without .enc extension)
        const files = await fs_2.promises.readdir(UPLOADS_DIR);
        const fileToDelete = files.find(f => f === fileId || f.replace('.enc', '') === fileId);
        if (!fileToDelete) {
            return {
                success: false,
                error: 'File not found',
            };
        }
        const filePath = path_1.default.join(UPLOADS_DIR, fileToDelete);
        await fs_2.promises.unlink(filePath);
        return { success: true };
    }
    catch (error) {
        console.error('[fileManager] deleteFile error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Delete failed',
        };
    }
}
// Get file path for download
async function getFilePath(fileId) {
    await ensureUploadsDir();
    try {
        const files = await fs_2.promises.readdir(UPLOADS_DIR);
        const fileToDownload = files.find(f => f === fileId || f.replace('.enc', '') === fileId);
        if (!fileToDownload) {
            return null;
        }
        return path_1.default.join(UPLOADS_DIR, fileToDownload);
    }
    catch (error) {
        console.error('[fileManager] getFilePath error:', error);
        return null;
    }
}
// Get uploads directory path
function getUploadsDir() {
    return UPLOADS_DIR;
}
