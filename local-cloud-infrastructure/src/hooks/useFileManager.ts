import { useState, useCallback, useEffect } from 'react';
import type { FileItem, UploadResult, DeleteResult } from '../../types';

export interface FileManagerState {
  files: FileItem[];
  loading: boolean;
  error: string | null;
  success: string | null;
}

export interface UseFileManagerReturn extends FileManagerState {
  uploadFile: (buffer: ArrayBuffer, fileName: string) => Promise<UploadResult | null>;
  deleteFile: (fileId: string) => Promise<DeleteResult | null>;
  downloadFile: (filePath: string) => Promise<void>;
  refreshFiles: () => Promise<void>;
}

export function useFileManager(): UseFileManagerReturn {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const refreshFiles = useCallback(async () => {
    clearMessages();
    setLoading(true);
    try {
      if (window.api.listFiles) {
        const fileList = await window.api.listFiles();
        setFiles(fileList);
      }
    } catch (err) {
      console.error('[useFileManager] refreshFiles error:', err);
      setError('Failed to load files');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  const uploadFile = useCallback(async (buffer: ArrayBuffer, fileName: string): Promise<UploadResult | null> => {
    clearMessages();
    try {
      if (window.api.uploadFile) {
        const result = await window.api.uploadFile(buffer, fileName);
        if (result.success) {
          setSuccess(`Uploaded: ${fileName}`);
          await refreshFiles();
        } else {
          setError(result.error || 'Upload failed');
        }
        return result;
      }
      setError('Upload API not available');
      return null;
    } catch (err) {
      console.error('[useFileManager] uploadFile error:', err);
      setError(`Failed to upload ${fileName}`);
      return null;
    }
  }, [refreshFiles]);

  const deleteFile = useCallback(async (fileId: string): Promise<DeleteResult | null> => {
    clearMessages();
    try {
      if (window.api.deleteFile) {
        const result = await window.api.deleteFile(fileId);
        if (result.success) {
          setSuccess('File deleted successfully');
          await refreshFiles();
        } else {
          setError(result.error || 'Delete failed');
        }
        return result;
      }
      setError('Delete API not available');
      return null;
    } catch (err) {
      console.error('[useFileManager] deleteFile error:', err);
      setError('Failed to delete file');
      return null;
    }
  }, [refreshFiles]);

  const downloadFile = useCallback(async (filePath: string): Promise<void> => {
    try {
      if (window.api.downloadFile) {
        await window.api.downloadFile(filePath);
      }
    } catch (err) {
      console.error('[useFileManager] downloadFile error:', err);
      setError('Failed to download file');
    }
  }, []);

  return {
    files,
    loading,
    error,
    success,
    uploadFile,
    deleteFile,
    downloadFile,
    refreshFiles,
  };
}
