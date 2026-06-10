import { useState, useEffect, useCallback } from 'react';
import type { ChatbotStatus, ChatMessage, ContextFileEntry, ChatbotConfig, GpuProfile } from '../../types';

export function useChatbot() {
  const [status, setStatus] = useState<ChatbotStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [contextFiles, setContextFiles] = useState<ContextFileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [dockerBusy, setDockerBusy] = useState(false);
  const [useContext, setUseContext] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    try {
      const s = await window.api.getChatbotStatus();
      setStatus(s);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshContextFiles = useCallback(async () => {
    try {
      const files = await window.api.listContextFiles();
      setContextFiles(files);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const initSession = useCallback(async () => {
    const savedSessionId = localStorage.getItem('chatbot_session_id');
    if (savedSessionId) {
      try {
        const history = await window.api.getChatHistory(savedSessionId);
        if (Array.isArray(history)) {
          setSessionId(savedSessionId);
          setMessages(history);
          return;
        }
      } catch (err) {
        console.warn("Failed to load chat history for session:", savedSessionId, err);
      }
    }

    try {
      const session = await window.api.createChatSession();
      setSessionId(session.id);
      localStorage.setItem('chatbot_session_id', session.id);
      setMessages([]);
    } catch (err) {
      console.error("Failed to initialize new chatbot session:", err);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    refreshContextFiles();
    initSession();
  }, [refreshStatus, refreshContextFiles, initSession]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || sending) return;
    setError(null);

    const userMsg: ChatMessage = {
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const res = await window.api.sendChatMessage(text, sessionId || undefined, useContext);
      if (res.sessionId) setSessionId(res.sessionId);
      setMessages((prev) => [...prev, res.message]);
      if (res.error) setError(res.error);
    } catch (err) {
      const errMsg: ChatMessage = {
        role: 'assistant',
        content: `Failed to send message: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  };

  const addFile = async () => {
    setError(null);
    const entry = await window.api.addContextFile();
    if (entry) {
      await refreshContextFiles();
      await refreshStatus();
    }
  };

  const addDockerFiles = async () => {
    setError(null);
    try {
      await window.api.addContextDockerFiles();
      await refreshContextFiles();
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to index Docker files');
    }
  };

  const removeFile = async (fileId: string) => {
    await window.api.removeContextFile(fileId);
    await refreshContextFiles();
    await refreshStatus();
  };

  const updateConfig = async (updates: Partial<ChatbotConfig>) => {
    setError(null);
    await window.api.updateChatbotConfig(updates);
    await refreshStatus();
  };

  const startDocker = async (profile: GpuProfile) => {
    setDockerBusy(true);
    setError(null);
    try {
      await window.api.startDockerOllama(profile);
      await updateConfig({ gpuProfile: profile, ollamaUrl: 'http://127.0.0.1:11434' });
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Docker start failed');
    } finally {
      setDockerBusy(false);
    }
  };

  const stopDocker = async () => {
    setDockerBusy(true);
    setError(null);
    try {
      await window.api.stopDockerOllama();
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Docker stop failed');
    } finally {
      setDockerBusy(false);
    }
  };

  const pullModel = async (model: string) => {
    setDockerBusy(true);
    setError(null);
    try {
      await window.api.pullDockerModel(model);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Model pull failed');
    } finally {
      setDockerBusy(false);
    }
  };

  const clearChat = async () => {
    localStorage.removeItem('chatbot_session_id');
    await initSession();
    setError(null);
  };

  const copyLanUrl = async () => {
    if (!status) return;
    const url = `http://${status.localIp}:${status.chatPort}/chat`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard may be unavailable in some Electron contexts
    }
  };

  return {
    status,
    messages,
    contextFiles,
    loading,
    sending,
    dockerBusy,
    useContext,
    error,
    setUseContext,
    sendMessage,
    addFile,
    addDockerFiles,
    removeFile,
    updateConfig,
    startDocker,
    stopDocker,
    pullModel,
    clearChat,
    copyLanUrl,
    refreshStatus,
    refreshContextFiles,
  };
}
