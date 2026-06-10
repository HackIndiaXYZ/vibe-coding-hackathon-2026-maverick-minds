import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Mock window.api for browser-only dev testing
if (typeof window !== 'undefined' && !(window as any).api) {
  (window as any).api = {
    login: async (pin: string) => {
      if (pin === '1234' || pin === '0000') {
        return { success: true, token: 'mock-token-abc' };
      }
      return { success: false, error: 'Invalid PIN' };
    },
    logout: async () => {},
    getStorageStatus: async () => ({
      path: 'C:/Work/ubiquity/vault-root',
      totalSpace: 1000 * 1024 * 1024 * 1024,
      usedSpace: 450 * 1024 * 1024 * 1024,
      freeSpace: 550 * 1024 * 1024 * 1024,
      allocatedSpace: 120 * 1024 * 1024 * 1024,
      appUsedSpace: 24 * 1024 * 1024 * 1024,
      localIp: '192.168.29.186',
      httpPort: 9090
    }),
    listFiles: async () => [
      { id: '1', name: 'docker-compose.yml', size: 1450, fileType: 'compose', relativePath: 'docker-compose.yml' },
      { id: '2', name: 'Dockerfile', size: 820, fileType: 'dockerfile', relativePath: 'Dockerfile' },
      { id: '3', name: 'vault-settings.json', size: 512, fileType: 'json', relativePath: 'vault-settings.json' },
      { id: '4', name: 'docker-compose.yml', size: 1450, fileType: 'compose', relativePath: 'copy-of-docker-compose.yml' }
    ],
    updateAllocation: async () => {},
    selectFolder: async () => ({ path: 'C:/Work/ubiquity/vault-root' }),
    startStream: async () => ({ success: true, sessionId: 'session_cam_982' }),
    stopStream: async () => {},
    saveBackupChunk: async () => {},
    runBackup: async () => ({ jobId: 'backup_job_551' }),
    getBackupStatus: async (jobId: string) => ({
      jobId,
      progress: 100,
      status: 'complete',
      log: ['Scanning disk layout...', 'Compressing vault-settings...', 'Applying AES-256 blocks...', 'Backup verification complete.'],
      bytesWritten: 2400000
    }),
    getChatbotStatus: async () => ({
      ollamaUrl: 'http://localhost:11434',
      model: 'llama3:latest',
      ollamaConnected: true,
      chatPort: 9090,
      localIp: '192.168.29.186',
      contextFileCount: 2,
      docker: {
        dockerInstalled: true,
        dockerRunning: true,
        ollamaRunning: true,
        activeProfile: 'nvidia',
        logs: ['Docker container starting...', 'Ollama service active.']
      }
    }),
    getChatbotMessages: async () => [],
    sendChatMessage: async () => ({ role: 'assistant', content: 'Mock response from local model.', timestamp: new Date().toISOString() }),
    createChatSession: async () => ({ id: 'mock-session-id-123' }),
    getChatHistory: async (sessionId: string) => [],
    addContextFile: async () => {},
    indexDockerFiles: async () => {},
    removeContextFile: async () => {},
    updateChatbotConfig: async () => {},
    startOllamaDocker: async () => {},
    stopOllamaDocker: async () => {},
    pullOllamaModel: async () => {},
    clearChatHistory: async () => {}
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
