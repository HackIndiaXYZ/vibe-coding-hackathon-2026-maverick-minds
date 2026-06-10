import { contextBridge, ipcRenderer } from "electron";
import type {
  StorageStatus,
  BackupChunkResult,
  StreamResult,
  BackupStatus,
  AuthResult,
  ChatbotStatus,
  ChatResponse,
  ChatMessage,
  ChatSession,
  ChatbotConfig,
  ContextFileEntry,
  GpuProfile,
  DockerServiceStatus,
  FileItem,
  UploadResult,
  DeleteResult,
} from "../types";

contextBridge.exposeInMainWorld("api", {
  getStorageStatus: (): Promise<StorageStatus> =>
    ipcRenderer.invoke("req-storage-status"),

  saveBackupChunk: (buffer: ArrayBuffer): Promise<BackupChunkResult> =>
    ipcRenderer.invoke("req-save-chunk", buffer),

  updateAllocation: (
    bytes: number,
  ): Promise<{ success: boolean; allocatedSpace: number }> =>
    ipcRenderer.invoke("req-update-allocation", bytes),

  selectFolder: (): Promise<{ path: string | null }> =>
    ipcRenderer.invoke("req-select-folder"),

  startStream: (cameraId: string): Promise<StreamResult> =>
    ipcRenderer.invoke("req-start-stream", { cameraId }),

  stopStream: (cameraId: string): Promise<StreamResult> =>
    ipcRenderer.invoke("req-stop-stream", { cameraId }),

  runBackup: (): Promise<{ jobId: string }> =>
    ipcRenderer.invoke("req-run-backup"),

  getBackupStatus: (jobId: string): Promise<BackupStatus> =>
    ipcRenderer.invoke("req-backup-status", { jobId }),

  login: (pin: string): Promise<AuthResult> =>
    ipcRenderer.invoke("req-login", { pin }),

  logout: (token: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("req-logout", { token }),

  getChatbotStatus: (): Promise<ChatbotStatus> =>
    ipcRenderer.invoke("req-chatbot-status"),

  sendChatMessage: (
    message: string,
    sessionId?: string,
    useContext?: boolean,
  ): Promise<ChatResponse> =>
    ipcRenderer.invoke("req-chatbot-send", { message, sessionId, useContext }),

  getChatHistory: (sessionId: string): Promise<ChatMessage[]> =>
    ipcRenderer.invoke("req-chatbot-history", { sessionId }),

  createChatSession: (): Promise<ChatSession> =>
    ipcRenderer.invoke("req-chatbot-new-session"),

  updateChatbotConfig: (
    updates: Partial<ChatbotConfig>,
  ): Promise<ChatbotConfig> =>
    ipcRenderer.invoke("req-chatbot-config", updates),

  listContextFiles: (): Promise<ContextFileEntry[]> =>
    ipcRenderer.invoke("req-chatbot-context-list"),

  addContextFile: (relativePath?: string): Promise<ContextFileEntry | null> =>
    ipcRenderer.invoke("req-chatbot-context-add", { relativePath }),

  addContextDirectory: (relativeDir: string): Promise<ContextFileEntry[]> =>
    ipcRenderer.invoke("req-chatbot-context-add-dir", { relativeDir }),

  removeContextFile: (fileId: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("req-chatbot-context-remove", { fileId }),

  addContextDockerFiles: (): Promise<ContextFileEntry[]> =>
    ipcRenderer.invoke("req-chatbot-context-docker"),

  startDockerOllama: (profile?: GpuProfile): Promise<DockerServiceStatus> =>
    ipcRenderer.invoke("req-docker-start", { profile }),

  stopDockerOllama: (): Promise<DockerServiceStatus> =>
    ipcRenderer.invoke("req-docker-stop"),

  pullDockerModel: (model: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("req-docker-pull-model", { model }),

  // File Management
  listFiles: (): Promise<FileItem[]> => ipcRenderer.invoke("req-list-files"),

  uploadFile: (buffer: ArrayBuffer, fileName: string): Promise<UploadResult> =>
    ipcRenderer.invoke("req-upload-file", { buffer, fileName }),

  deleteFile: (fileId: string): Promise<DeleteResult> =>
    ipcRenderer.invoke("req-delete-file", { fileId }),

  downloadFile: (filePath: string): Promise<void> =>
    ipcRenderer.invoke("req-download-file", { filePath }),
});

contextBridge.exposeInMainWorld("vpn", {
  checkInstalled: (): Promise<{ installed: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke('vpn:check-installed'),

  initServer: (endpoint: string, port: number): Promise<{ success: boolean; config?: any; error?: string }> =>
    ipcRenderer.invoke('vpn:init-server', endpoint, port),

  addPeer: (name: string): Promise<{ success: boolean; peer?: any; clientConf?: string; qrBase64?: string; error?: string }> =>
    ipcRenderer.invoke('vpn:add-peer', name),

  listPeers: (): Promise<Omit<any, 'privateKey'>[]> =>
    ipcRenderer.invoke('vpn:list-peers'),

  removePeer: (publicKey: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('vpn:remove-peer', publicKey),

  serverMeta: (): Promise<any | null> =>
    ipcRenderer.invoke('vpn:server-meta'),

  start: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('vpn:start'),

  stop: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('vpn:stop'),

  status: (): Promise<{ running: boolean; peers: any[]; interface: string | null }> =>
    ipcRenderer.invoke('vpn:status'),

  peerQr: (publicKey: string): Promise<{ success: boolean; clientConf?: string; qrBase64?: string; error?: string }> =>
    ipcRenderer.invoke('vpn:peer-qr', publicKey),

  saveConfigFile: (clientConf: string, fileName: string): Promise<{ success: boolean; filePath?: string; error?: string }> =>
    ipcRenderer.invoke('vpn:save-config-file', { clientConf, fileName }),
});

