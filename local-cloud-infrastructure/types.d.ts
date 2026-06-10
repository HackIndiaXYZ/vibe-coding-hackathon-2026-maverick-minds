// ─── IPC Channel Names ───────────────────────────────────────────────────────
// Keep in sync with electron/preload.ts and electron/ipcHandlers.ts

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

export interface BackupChunkResult {
  success: boolean;
  fileId: string;
}

export interface StreamResult {
  success: boolean;
  sessionId?: string;
  error?: string;
}

export interface BackupStatus {
  jobId: string;
  progress: number;
  status: "idle" | "running" | "complete" | "error";
  log: string[];
  bytesWritten: number;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  error?: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  sources?: string[];
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatbotStatus {
  running: boolean;
  localIp: string;
  chatPort: number;
  ollamaUrl: string;
  model: string;
  ollamaConnected: boolean;
  contextFileCount: number;
  contextDir: string;
  activeSessions: number;
  docker: DockerServiceStatus;
}

export interface ChatResponse {
  sessionId: string;
  message: ChatMessage;
  error?: string;
}

export interface ContextFileEntry {
  id: string;
  name: string;
  relativePath: string;
  size: number;
  chunkCount: number;
  indexedAt: string;
  fileType?: string;
}

export interface FileItem {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  uploadedAt: string;
}

export interface UploadResult {
  success: boolean;
  fileId?: string;
  error?: string;
  path?: string;
}

export interface DeleteResult {
  success: boolean;
  error?: string;
}

export type GpuProfile = "cpu" | "nvidia" | "amd";

export interface DockerServiceStatus {
  dockerInstalled: boolean;
  dockerRunning: boolean;
  ollamaRunning: boolean;
  ollamaContainer: string | null;
  activeProfile: GpuProfile;
  composePath: string;
  logs: string[];
}

export interface ChatbotConfig {
  ollamaUrl: string;
  model: string;
  gpuProfile?: GpuProfile;
}

export interface IElectronAPI {
  getStorageStatus: () => Promise<StorageStatus>;
  saveBackupChunk: (buffer: ArrayBuffer) => Promise<BackupChunkResult>;
  updateAllocation: (
    bytes: number,
  ) => Promise<{ success: boolean; allocatedSpace: number }>;
  selectFolder: () => Promise<{ path: string | null }>;

  // Streaming
  startStream: (cameraId: string) => Promise<StreamResult>;
  stopStream: (cameraId: string) => Promise<StreamResult>;

  // Backup
  runBackup: () => Promise<{ jobId: string }>;
  getBackupStatus: (jobId: string) => Promise<BackupStatus>;

  // Auth
  login: (pin: string) => Promise<AuthResult>;
  logout: (token: string) => Promise<{ success: boolean }>;

  // Chatbot
  getChatbotStatus: () => Promise<ChatbotStatus>;
  sendChatMessage: (
    message: string,
    sessionId?: string,
    useContext?: boolean,
  ) => Promise<ChatResponse>;
  getChatHistory: (sessionId: string) => Promise<ChatMessage[]>;
  createChatSession: () => Promise<ChatSession>;
  updateChatbotConfig: (
    updates: Partial<ChatbotConfig>,
  ) => Promise<ChatbotConfig>;
  listContextFiles: () => Promise<ContextFileEntry[]>;
  addContextFile: (relativePath?: string) => Promise<ContextFileEntry | null>;
  addContextDirectory: (relativeDir: string) => Promise<ContextFileEntry[]>;
  removeContextFile: (fileId: string) => Promise<{ success: boolean }>;

  // File Management
  listFiles: () => Promise<FileItem[]>;
  uploadFile: (buffer: ArrayBuffer, fileName: string) => Promise<UploadResult>;
  deleteFile: (fileId: string) => Promise<DeleteResult>;
  downloadFile: (filePath: string) => Promise<void>;
  addContextDockerFiles: () => Promise<ContextFileEntry[]>;
  startDockerOllama: (profile?: GpuProfile) => Promise<DockerServiceStatus>;
  stopDockerOllama: () => Promise<DockerServiceStatus>;
  pullDockerModel: (model: string) => Promise<{ success: boolean }>;
}

declare global {
  interface Window {
    api: IElectronAPI;
  }
}
