import { listContextFiles, addContextFile, addContextDirectory, removeContextFile, getContextDirPath, addContextDockerFiles, type ContextFileEntry } from './contextIndexer';
import { type GpuProfile, type DockerServiceStatus } from './dockerService';
export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
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
interface ChatbotConfig {
    ollamaUrl: string;
    model: string;
    gpuProfile: GpuProfile;
}
export declare function sendChatMessage(message: string, sessionId?: string, useContext?: boolean): Promise<ChatResponse>;
export declare function getChatHistory(sessionId: string): ChatMessage[];
export declare function createNewSession(): ChatSession;
export declare function getChatbotStatus(): Promise<ChatbotStatus>;
export declare function updateChatbotConfig(updates: Partial<ChatbotConfig>): ChatbotConfig;
export declare function startDockerOllama(profile?: GpuProfile): Promise<DockerServiceStatus>;
export declare function stopDockerOllama(): Promise<DockerServiceStatus>;
export declare function pullDockerModel(model: string): Promise<void>;
export { addContextDockerFiles };
export declare function pickAndAddContextFile(): Promise<ContextFileEntry | null>;
export { listContextFiles, addContextFile, addContextDirectory, removeContextFile, getContextDirPath, };
export declare function initChatbot(): void;
