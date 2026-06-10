import React, { useState, useRef, useEffect, useCallback } from "react";

interface FileItem {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  uploadedAt: string;
  isUploading?: boolean;
  progress?: number;
}

const FILE_TYPES: Record<string, { icon: string; color: string }> = {
  pdf: { icon: "PDF", color: "#ef4444" },
  doc: { icon: "DOC", color: "#3b82f6" },
  docx: { icon: "DOC", color: "#3b82f6" },
  xls: { icon: "XLS", color: "#10b981" },
  xlsx: { icon: "XLS", color: "#10b981" },
  ppt: { icon: "PPT", color: "#f59e0b" },
  pptx: { icon: "PPT", color: "#f59e0b" },
  txt: { icon: "TXT", color: "#6b7280" },
  jpg: { icon: "IMG", color: "#8b5cf6" },
  jpeg: { icon: "IMG", color: "#8b5cf6" },
  png: { icon: "IMG", color: "#8b5cf6" },
  gif: { icon: "IMG", color: "#8b5cf6" },
  svg: { icon: "IMG", color: "#8b5cf6" },
  mp3: { icon: "AUD", color: "#ec4899" },
  mp4: { icon: "VID", color: "#06b6d4" },
  avi: { icon: "VID", color: "#06b6d4" },
  mov: { icon: "VID", color: "#06b6d4" },
  zip: { icon: "ZIP", color: "#f97316" },
  rar: { icon: "ZIP", color: "#f97316" },
  "7z": { icon: "ZIP", color: "#f97316" },
};

export default function FileManager() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploadStatus, setUploadStatus] = useState<{
    isUploading: boolean;
    progress: number;
    currentFile: string | null;
  }>({
    isUploading: false,
    progress: 0,
    currentFile: null,
  });
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "date" | "size">("date");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getFileTypeInfo = (fileName: string) => {
    const extension = fileName.split(".").pop()?.toLowerCase() || "";
    return FILE_TYPES[extension] || { icon: "FILE", color: "#888888" };
  };

  const loadFiles = useCallback(async () => {
    try {
      if (window.api.listFiles) {
        const fileList = await window.api.listFiles();
        setFiles(fileList);
      }
    } catch (err) {
      console.error("Failed to load files:", err);
      setError("Failed to load files");
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFiles(Array.from(e.target.files));
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
 
    const items = e.dataTransfer.items;
    const files = [];

    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === "file") {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      await uploadFiles(files);
    }
  };

  const uploadFiles = async (fileList: File[]) => {
    setError(null);
    setSuccess(null);

    for (const file of fileList) {
      const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const newFile: FileItem = {
        id: fileId,
        name: file.name,
        path: `/uploads/${file.name}`,
        size: file.size,
        type: file.type || getFileTypeInfo(file.name).icon,
        uploadedAt: new Date().toISOString(),
        isUploading: true,
        progress: 0,
      };

      setFiles((prev) => [newFile, ...prev]);
      setUploadStatus({
        isUploading: true,
        progress: 0,
        currentFile: file.name,
      });

      try {
        if (window.api.uploadFile) {
          const reader = new FileReader();
          reader.readAsArrayBuffer(file);

          reader.onprogress = (event) => {
            if (event.loaded && event.total) {
              const progress = Math.round((event.loaded / event.total) * 100);
              setFiles((prev) =>
                prev.map((f) => (f.id === fileId ? { ...f, progress } : f)),
              );
              setUploadStatus({
                isUploading: true,
                progress,
                currentFile: file.name,
              });
            }
          };

          reader.onload = async () => {
            const arrayBuffer = reader.result as ArrayBuffer;
            const result = await window.api.uploadFile!(arrayBuffer, file.name);

            if (result.success) {
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === fileId
                    ? { ...f, isUploading: false, progress: 100 }
                    : f,
                ),
              );
              setSuccess(`Uploaded: ${file.name}`);
              setTimeout(() => setSuccess(null), 3000);
              await loadFiles();
            } else {
              throw new Error(result.error || "Upload failed");
            }
          };

          reader.onerror = () => {
            throw new Error("File read error");
          };
        }
      } catch (err) {
        console.error("Upload error:", err);
        setError(`Failed to upload ${file.name}`);
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
      }
    }

    setUploadStatus({ isUploading: false, progress: 0, currentFile: null });
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleDeleteFile = async (fileId: string, fileName: string) => {
    try {
      if (window.api.deleteFile) {
        const result = await window.api.deleteFile(fileId);
        if (result.success) {
          setFiles((prev) => prev.filter((f) => f.id !== fileId));
          setSuccess(`Deleted: ${fileName}`);
          setTimeout(() => setSuccess(null), 3000);
        } else {
          throw new Error(result.error || "Delete failed");
        }
      }
    } catch (err) {
      console.error("Delete error:", err);
      setError(`Failed to delete ${fileName}`);
    }
  };

  const handleDownloadFile = (filePath: string) => {
    if (window.api.downloadFile) {
      window.api.downloadFile(filePath);
    }
  };

  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles((prev) =>
      prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : [...prev, fileId],
    );
  };

  const sortedFiles = [...files].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name);
      case "size":
        return b.size - a.size;
      case "date":
        return (
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        );
      default:
        return 0;
    }
  });

  const filteredFiles = sortedFiles.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div>
        <div className="dashboard-header">
          <svg
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
            width="18"
            height="18"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          File Manager
        </div>
        <h1 className="dashboard-title">Upload & Manage Cloud Files</h1>

        <div className="flex gap-2 flex-wrap">
          <span className="badge badge-neutral">Cloud Storage</span>
          <span className="badge badge-info">{files.length} files</span>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-error">
          <svg
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="20"
            height="20"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div className="alert-content">
            <div className="alert-message">{error}</div>
          </div>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <svg
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="20"
            height="20"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="alert-content">
            <div className="alert-message">{success}</div>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {uploadStatus.isUploading && (
        <div className="alert alert-info">
          <svg
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="20"
            height="20"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
          <div className="alert-content flex-1">
            <div className="alert-message">
              Uploading: {uploadStatus.currentFile} ({uploadStatus.progress}%)
            </div>
            <div className="progress mt-2 h-2">
              <div
                className="progress-fill progress-fill-primary"
                style={{ width: `${uploadStatus.progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Panel */}
      <div className="file-panel">
        {/* Controls */}
        <div className="file-controls">
          <div className="file-search">
            <input
              type="text"
              placeholder="🔍 Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input w-full"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "name" | "date" | "size")
              }
              className="select"
              style={{ width: "auto" }}
            >
              <option value="date">Sort: Newest</option>
              <option value="name">Sort: Name</option>
              <option value="size">Sort: Size</option>
            </select>
            <div className="flex gap-1" style={{ border: '1.5px solid var(--border-primary)', padding: '2px', background: 'var(--bg-tertiary)' }}>
              <button 
                onClick={() => setViewMode("list")} 
                className={`btn btn-sm ${viewMode === "list" ? "btn-primary" : "btn-ghost"}`} 
                style={{ padding: '0.25rem 0.5rem', boxShadow: 'none', border: 'none' }}
                title="List View"
              >
                ☰
              </button>
              <button 
                onClick={() => setViewMode("grid")} 
                className={`btn btn-sm ${viewMode === "grid" ? "btn-primary" : "btn-ghost"}`}
                style={{ padding: '0.25rem 0.5rem', boxShadow: 'none', border: 'none' }}
                title="Grid View"
              >
                ⊞
              </button>
            </div>
            <button onClick={loadFiles} className="btn btn-secondary btn-sm">
              <svg
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="14"
                height="14"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* File List / Grid */}
        <div
          className={`${viewMode === "list" ? "file-list" : "file-grid"} ${dragOver ? "drag-over" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {filteredFiles.length === 0 ? (
            <div className="file-empty">
              <svg
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="48"
                height="48"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
              <p className="text-lg font-semibold text-primary mt-4">
                No files yet
              </p>
              <p className="text-sm text-muted mt-2">
                Drag & drop files here or click Upload below
              </p>
            </div>
          ) : viewMode === "list" ? (
            filteredFiles.map((file) => {
              const fileType = getFileTypeInfo(file.name);
              const isSelected = selectedFiles.includes(file.id);

              return (
                <div
                  key={file.id}
                  className={`file-item ${isSelected ? "selected" : ""}`}
                  onClick={() => toggleFileSelection(file.id)}
                >
                  <div
                    className="file-item-icon"
                    style={{ backgroundColor: fileType.color + "20" }}
                  >
                    <span style={{ color: fileType.color }}>
                      {fileType.icon}
                    </span>
                  </div>
                  <div className="file-item-content min-w-0">
                    <div className="file-item-name">
                      {file.name}
                      {file.isUploading && (
                        <span className="text-xs text-muted ml-2">
                          ({file.progress}%)
                        </span>
                      )}
                    </div>
                    <div className="file-item-meta">
                      <span>{formatFileSize(file.size)}</span>
                      <span>•</span>
                      <span>{formatDate(file.uploadedAt)}</span>
                    </div>
                  </div>

                  <div className="file-item-actions">
                    {!file.isUploading && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadFile(file.path);
                          }}
                          className="attachment-action"
                          title="Download"
                        >
                          <svg
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5-1.837c0-.621.504-1.125 1.125-1.125s1.125.504 1.125 1.125M12 16.5V10.5m0 0a2.25 2.25 0 012.25-2.25M12 10.5a2.25 2.25 0 00-2.25-2.25M12 10.5V4.5"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFile(file.id, file.name);
                          }}
                          className="attachment-action text-error-500"
                          title="Delete"
                        >
                          <svg
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.895.05 1.79.21 2.685.464M14.74 9L12 10.5l-2.74-2.74-1.26-1.26c-.937-.937-2.43-1.35-3.74-1.35-1.54 0-3.05.854-3.95 2.15-1.35 1.89-1.35 4.68 0 6.57l3.95 3.95c1.35 1.35 3.05 1.35 4.4 0l3.95-3.95c1.35-1.35 1.35-3.54 0-4.89l-3.95-3.95-2.74 2.74L14.74 9z"
                            />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            filteredFiles.map((file) => {
              const fileType = getFileTypeInfo(file.name);
              const isSelected = selectedFiles.includes(file.id);

              return (
                <div
                  key={file.id}
                  className={`file-grid-item ${isSelected ? "selected" : ""}`}
                  onClick={() => toggleFileSelection(file.id)}
                >
                  <div
                    className="file-item-icon"
                    style={{ backgroundColor: fileType.color + "20", width: '50px', height: '50px', fontSize: '1.2rem', marginBottom: '8px' }}
                  >
                    <span style={{ color: fileType.color }}>
                      {fileType.icon}
                    </span>
                  </div>
                  <div className="min-w-0 w-full" style={{ flex: 1 }}>
                    <div className="file-item-name" style={{ justifyContent: 'center', wordBreak: 'break-all', fontSize: '0.9rem' }}>
                      {file.name}
                    </div>
                    <div className="file-item-meta" style={{ marginTop: '4px' }}>
                      <span>{formatFileSize(file.size)}</span>
                    </div>
                  </div>
                  <div className="file-item-actions" style={{ paddingLeft: 0, marginTop: '8px', gap: '8px' }}>
                    {!file.isUploading && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadFile(file.path);
                          }}
                          className="attachment-action"
                          title="Download"
                        >
                          <svg
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5-1.837c0-.621.504-1.125 1.125-1.125s1.125.504 1.125 1.125M12 16.5V10.5m0 0a2.25 2.25 0 012.25-2.25M12 10.5a2.25 2.25 0 00-2.25-2.25M12 10.5V4.5"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFile(file.id, file.name);
                          }}
                          className="attachment-action text-error-500"
                          title="Delete"
                        >
                          <svg
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.895.05 1.79.21 2.685.464M14.74 9L12 10.5l-2.74-2.74-1.26-1.26c-.937-.937-2.43-1.35-3.74-1.35-1.54 0-3.05.854-3.95 2.15-1.35 1.89-1.35 4.68 0 6.57l3.95 3.95c1.35 1.35 3.05 1.35 4.4 0l3.95-3.95c1.35-1.35 1.35-3.54 0-4.89l-3.95-3.95-2.74 2.74L14.74 9z"
                            />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Upload Button */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          className="sr-only"
        />

        <button
          onClick={handleUploadClick}
          className="btn btn-primary btn-block"
          disabled={uploadStatus.isUploading}
        >
          <svg
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="18"
            height="18"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
            />
          </svg>
          {uploadStatus.isUploading ? "Uploading..." : "Upload Files"}
        </button>

        {/* Footer */}
        <div className="file-footer">
          <span className="file-count">
            {filteredFiles.length} file(s) found
          </span>
          {selectedFiles.length > 0 && (
            <span className="file-count">{selectedFiles.length} selected</span>
          )}
        </div>
      </div>
    </div>
  );
}
