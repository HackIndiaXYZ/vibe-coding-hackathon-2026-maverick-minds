import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import crypto from 'crypto';

const UPLOADS_DIR = path.join(process.cwd(), 'local-cloud-uploads');

// Ensure uploads directory exists
async function ensureUploadsDir(): Promise<void> {
  try {
    await fsPromises.access(UPLOADS_DIR);
  } catch {
    await fsPromises.mkdir(UPLOADS_DIR, { recursive: true });
  }
}

// Get file extension
function getFileExtension(fileName: string): string {
  return path.extname(fileName).toLowerCase().replace('.', '');
}

// Generate unique file ID
function generateFileId(): string {
  return `file_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

// Get file type based on extension
function getFileType(extension: string): string {
  const typeMap: Record<string, string> = {
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

interface FileItem {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  uploadedAt: string;
}

// List all files in uploads directory
export async function listFiles(): Promise<FileItem[]> {
  await ensureUploadsDir();

  try {
    const files = await fsPromises.readdir(UPLOADS_DIR);

    return Promise.all(files.map(async (fileName) => {
      const filePath = path.join(UPLOADS_DIR, fileName);
      const stats = await fsPromises.stat(filePath);
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
  } catch (error) {
    console.error('[fileManager] listFiles error:', error);
    return [];
  }
}

// Upload file to uploads directory
export async function uploadFile(buffer: Buffer, fileName: string): Promise<{ success: boolean; fileId?: string; error?: string; path?: string }> {
  await ensureUploadsDir();

  try {
    const fileId = generateFileId();
    const safeFileName = path.basename(fileName); // Sanitize file name
    const filePath = path.join(UPLOADS_DIR, safeFileName);

    // Check if file already exists
    let finalFileName = safeFileName;
    let counter = 1;
    while (fs.existsSync(path.join(UPLOADS_DIR, finalFileName))) {
      const nameWithoutExt = path.basename(safeFileName, path.extname(safeFileName));
      const ext = path.extname(safeFileName);
      finalFileName = `${nameWithoutExt}_${counter}${ext}`;
      counter++;
    }

    const finalPath = path.join(UPLOADS_DIR, finalFileName);
    await fsPromises.writeFile(finalPath, buffer);

    return {
      success: true,
      fileId,
      path: `/uploads/${finalFileName}`,
    };
  } catch (error) {
    console.error('[fileManager] uploadFile error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

// Delete file from uploads directory
export async function deleteFile(fileId: string): Promise<{ success: boolean; error?: string }> {
  await ensureUploadsDir();

  try {
    // Find the file with matching ID (with or without .enc extension)
    const files = await fsPromises.readdir(UPLOADS_DIR);
    const fileToDelete = files.find(f =>
      f === fileId || f.replace('.enc', '') === fileId
    );

    if (!fileToDelete) {
      return {
        success: false,
        error: 'File not found',
      };
    }

    const filePath = path.join(UPLOADS_DIR, fileToDelete);
    await fsPromises.unlink(filePath);

    return { success: true };
  } catch (error) {
    console.error('[fileManager] deleteFile error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed',
    };
  }
}

// Get file path for download
export async function getFilePath(fileId: string): Promise<string | null> {
  await ensureUploadsDir();

  try {
    const files = await fsPromises.readdir(UPLOADS_DIR);
    const fileToDownload = files.find(f =>
      f === fileId || f.replace('.enc', '') === fileId
    );

    if (!fileToDownload) {
      return null;
    }

    return path.join(UPLOADS_DIR, fileToDownload);
  } catch (error) {
    console.error('[fileManager] getFilePath error:', error);
    return null;
  }
}

// Get uploads directory path
export function getUploadsDir(): string {
  return UPLOADS_DIR;
}
