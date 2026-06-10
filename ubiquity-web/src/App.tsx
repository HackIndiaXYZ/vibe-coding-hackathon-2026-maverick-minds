import React, { useState, useEffect, useRef } from 'react';
import './App.css';

interface FileItem {
  name: string;
  size: number;
  isDirectory: boolean;
  relativePath: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  sources?: string[];
}

interface ContextFileEntry {
  id: string;
  name: string;
  relativePath: string;
  size: number;
  indexedAt: string;
}

interface DockerServiceStatus {
  status: 'running' | 'stopped' | 'error' | 'not_installed';
  containerId?: string;
  error?: string;
}

interface ChatbotStatus {
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

export default function App() {
  const [hostIp, setHostIp] = useState<string>(() => localStorage.getItem('web_host_ip') || window.location.hostname || '100.104.163.4');
  const [hostPort, setHostPort] = useState<string>(() => localStorage.getItem('web_host_port') || '8080');
  const [connected, setConnected] = useState<boolean>(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'explorer' | 'camera' | 'settings' | 'chatbot'>('explorer');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('web_theme') as 'light' | 'dark') || 'light';
  });

  // Chatbot states
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatUseContext, setChatUseContext] = useState<boolean>(true);
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [chatbotStatus, setChatbotStatus] = useState<ChatbotStatus | null>(null);
  const [contextFiles, setContextFiles] = useState<ContextFileEntry[]>([]);

  // Resizable explorer sidebar chatbot states
  const [explorerSidebarWidth, setExplorerSidebarWidth] = useState<number>(360);
  const [showExplorerChat, setShowExplorerChat] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(true);
  const isResizingRef = useRef<boolean>(false);

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizingRef.current) return;
    const newWidth = window.innerWidth - e.clientX - 24;
    if (newWidth > 280 && newWidth < 600) {
      setExplorerSidebarWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    isResizingRef.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleIndexSelectedFiles = async () => {
    for (const name of Array.from(selectedFiles)) {
      const file = files.find(f => f.name === name);
      if (file && !file.isDirectory) {
        await handleAddFileToContext(file.relativePath);
      }
    }
    setSelectedFiles(new Set());
  };

  // Explorer states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [renameFile, setRenameFile] = useState<FileItem | null>(null);
  const [renameNewName, setRenameNewName] = useState<string>('');
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('web_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Camera state
  const [streaming, setStreaming] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>('System Idle');
  const [duration, setDuration] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Prefer Vite-provided public API base (set VITE_API_BASE in Netlify). Fall back to manual host/port.
  const VITE_API_BASE = (import.meta.env.VITE_API_BASE as string) || '';
  const VITE_API_KEY = (import.meta.env.VITE_API_KEY as string) || '';
  const getBaseUrl = () => VITE_API_BASE || `http://${hostIp}:${hostPort}`;

  const isImageFile = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
  };

  const isVideoFile = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    return ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(ext);
  };


  interface StorageStatus {
    path: string;
    totalSpace: number;
    usedSpace: number;
    freeSpace: number;
    allocatedSpace: number;
    appUsedSpace: number;
    localIp: string;
    httpPort: number;
  }
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);

  const fetchStorageStatus = async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/api/storage-status`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStorageStatus(data);
        }
      }
    } catch (err) {
      console.error('Error fetching storage status:', err);
    }
  };

  const checkConnection = async () => {
    setLoading(true);
    setError(null);
    try {
      // If a Vite API base is provided (deployed via Netlify set VITE_API_BASE), call the API directly.
      if (VITE_API_BASE) {
        const res = await fetch(`${getBaseUrl()}/api/files`, {
          headers: VITE_API_KEY ? { 'x-api-key': VITE_API_KEY, Accept: 'application/json' } : { Accept: 'application/json' }
        });
        if (!res.ok) throw new Error(`Failed response: ${res.status}`);
        const data = await res.json();
        setFiles(data.files || []);
        setConnected(true);
        localStorage.setItem('web_host_ip', hostIp);
        localStorage.setItem('web_host_port', hostPort);
        fetchStorageStatus();
      } else {
        // Legacy local host/port behavior (used during development)
        const pathStr = currentPath.join('/');
        const url = pathStr
          ? `${getBaseUrl()}/${pathStr.split('/').map(encodeURIComponent).join('/')}`
          : `${getBaseUrl()}/`;

        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error('Failed response from server');
        const data = await res.json();
        if (data.success) {
          setFiles(data.files || []);
          setConnected(true);
          localStorage.setItem('web_host_ip', hostIp);
          localStorage.setItem('web_host_port', hostPort);
          fetchStorageStatus();
        } else {
          throw new Error('Server returned unsuccessful');
        }
      }
    } catch (err: any) {
      setConnected(false);
      setError(`Connection failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkConnection();
    fetchStorageStatus();
    setSelectedFiles(new Set());
  }, [currentPath]);

  const getChatbotUrl = () => `http://${hostIp}:9090`;

  const fetchChatbotStatus = async () => {
    try {
      const res = await fetch(`${getChatbotUrl()}/api/status`);
      if (res.ok) {
        const data = await res.json();
        setChatbotStatus(data);
      } else {
        setChatbotStatus(null);
      }
    } catch (err) {
      console.error('Error fetching chatbot status:', err);
      setChatbotStatus(null);
    }
  };

  const fetchContextFiles = async () => {
    try {
      const res = await fetch(`${getChatbotUrl()}/api/context`);
      if (res.ok) {
        const data = await res.json();
        setContextFiles(data.files || []);
      }
    } catch (err) {
      console.error('Error fetching context files:', err);
    }
  };

  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const message = chatInput.trim();
    if (!message || chatLoading) return;

    setChatInput('');
    setChatLoading(true);

    const userMsg: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    setChatMessages(prev => [...prev, userMsg]);

    try {
      const res = await fetch(`${getChatbotUrl()}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          sessionId: chatSessionId,
          useContext: chatUseContext
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      if (data.sessionId) {
        setChatSessionId(data.sessionId);
      }
      if (data.message) {
        setChatMessages(prev => [...prev, data.message]);
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: `Error: ${err.message || 'Failed to reach AI service. Make sure the local Ollama chatbot server is active.'}`,
        timestamp: new Date().toISOString()
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleAddFileToContext = async (relativePath: string) => {
    try {
      const res = await fetch(`${getChatbotUrl()}/api/context/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relativePath })
      });
      if (res.ok) {
        fetchContextFiles();
        fetchChatbotStatus();
      } else {
        alert('Failed to index file.');
      }
    } catch (err) {
      console.error('Error indexing file:', err);
      alert('Network error indexing file.');
    }
  };

  const handleRemoveFileFromContext = async (fileId: string) => {
    try {
      const res = await fetch(`${getChatbotUrl()}/api/context/${fileId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchContextFiles();
        fetchChatbotStatus();
      } else {
        alert('Failed to remove file from context.');
      }
    } catch (err) {
      console.error('Error removing file from context:', err);
      alert('Network error removing file.');
    }
  };

  useEffect(() => {
    if (activeTab === 'chatbot' || (activeTab === 'explorer' && showExplorerChat)) {
      fetchChatbotStatus();
      fetchContextFiles();
    }
  }, [activeTab, showExplorerChat, hostIp]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const pathStr = currentPath.join('/');
      const res = await fetch(`${getBaseUrl()}/upload`, {
        method: 'POST',
        headers: {
          'X-File-Name': file.name,
          'X-File-Path': pathStr,
          'Content-Type': 'application/octet-stream'
        },
        body: buffer
      });
      const data = await res.json();
      if (data.success) {
        checkConnection();
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (err: any) {
      setError(`Upload error: ${err.message}`);
    }
  };


  const handleDeleteSelected = async () => {
    if (selectedFiles.size === 0) return;
    if (!confirm(`Permanently delete the ${selectedFiles.size} selected file(s)?`)) return;
    setError(null);
    setLoading(true);
    try {
      const pathStr = currentPath.join('/');
      for (const name of selectedFiles) {
        const res = await fetch(`${getBaseUrl()}/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, path: pathStr })
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || `Delete failed for ${name}`);
        }
      }
      setSelectedFiles(new Set());
      checkConnection();
    } catch (err: any) {
      setError(`Delete error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRenameConfirm = async () => {
    if (!renameFile) return;
    const oldName = renameFile.name;
    const newName = renameNewName.trim();
    if (!newName || oldName === newName) {
      setRenameFile(null);
      return;
    }
    setError(null);
    try {
      const pathStr = currentPath.join('/');
      const res = await fetch(`${getBaseUrl()}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName, newName, path: pathStr })
      });
      const data = await res.json();
      if (data.success) {
        setRenameFile(null);
        setSelectedFiles(new Set());
        checkConnection();
      } else {
        throw new Error(data.message || 'Rename failed');
      }
    } catch (err: any) {
      setError(`Rename error: ${err.message}`);
    }
  };

  const toggleSelectFile = (name: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };


  const handleItemClick = (file: FileItem) => {
    if (file.isDirectory) {
      setCurrentPath(prev => [...prev, file.name]);
    } else if (isImageFile(file.name) || isVideoFile(file.name)) {
      setPreviewFile(file);
    }
  };

  const getSingleSelectedFile = () => {
    if (selectedFiles.size !== 1) return null;
    const selectedName = Array.from(selectedFiles)[0];
    return files.find(f => f.name === selectedName) || null;
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: false
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      let recorder: MediaRecorder;
      const options = [
        { mimeType: 'video/webm; codecs=vp9' },
        { mimeType: 'video/webm; codecs=vp8' },
        { mimeType: 'video/webm' },
        { mimeType: 'video/mp4' }
      ];

      let selectedOptions = {};
      for (const opt of options) {
        if (MediaRecorder.isTypeSupported(opt.mimeType)) {
          selectedOptions = opt;
          break;
        }
      }

      try {
        recorder = new MediaRecorder(mediaStream, selectedOptions);
      } catch (e) {
        recorder = new MediaRecorder(mediaStream);
      }

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          const buffer = await e.data.arrayBuffer();
          try {
            await fetch(`${getBaseUrl()}/upload-chunk`, {
              method: 'POST',
              headers: {
                'X-Camera-Id': 'remote-cam-web',
                'Content-Type': 'application/octet-stream'
              },
              body: buffer
            });
          } catch (err) {
            console.error('Failed to send stream chunk:', err);
          }
        }
      };

      recorder.start(1000);
      setStreaming(true);
      setStatusText('Surveillance Streaming Active');
      setDuration(0);
    } catch (err: any) {
      console.error(err);
      setStatusText(`Capture Error: ${err.message}`);
    }
  };

  const stopCamera = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStreaming(false);
    setStatusText('System Idle');
  };

  useEffect(() => {
    let timer: any;
    if (streaming) {
      timer = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [streaming]);

  const formatDuration = (sec: number) => {
    const hrs = Math.floor(sec / 3600).toString().padStart(2, '0');
    const mins = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const secs = (sec % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Actual categories calculated from files array
  let docSize = 0;
  let docCount = 0;
  let imgSize = 0;
  let imgCount = 0;
  let vidSize = 0;
  let vidCount = 0;

  files.forEach(f => {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (['pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'csv'].includes(ext)) {
      docSize += f.size;
      docCount++;
    } else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
      imgSize += f.size;
      imgCount++;
    } else if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(ext)) {
      vidSize += f.size;
      vidCount++;
    }
  });

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const selectedFile = getSingleSelectedFile();

  return (
    <div className="web-app-container">
      {/* Paper Side navigation */}
      <aside className={`portal-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-meta">
            <h1>ubiquity</h1>
            <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" width="22" height="22">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
            </svg>
          </div>
          {sidebarCollapsed && (
            <svg className="collapsed-logo" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" width="22" height="22">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
            </svg>
          )}
          <button 
            className="sidebar-toggle-btn" 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {sidebarCollapsed ? (
              <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" width="16" height="16">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" />
              </svg>
            ) : (
              <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" width="16" height="16">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
              </svg>
            )}
          </button>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === 'explorer' ? 'active' : ''}`}
            onClick={() => setActiveTab('explorer')}
            title="Cloud Explorer"
          >
            <span className="icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" width="15" height="15">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
            </span>
            {!sidebarCollapsed && <span className="label">Cloud Explorer</span>}
          </button>
          <button
            className={`nav-item ${activeTab === 'camera' ? 'active' : ''}`}
            onClick={() => setActiveTab('camera')}
            title="Remote Stream"
          >
            <span className="icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" width="15" height="15">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </span>
            {!sidebarCollapsed && <span className="label">Remote Stream</span>}
          </button>
          <button
            className={`nav-item ${activeTab === 'chatbot' ? 'active' : ''}`}
            onClick={() => setActiveTab('chatbot')}
            title="Local AI Chat"
          >
            <span className="icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" width="15" height="15">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            </span>
            {!sidebarCollapsed && <span className="label">Local AI Chat</span>}
          </button>
          <button
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
            title="Configuration"
          >
            <span className="icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" width="15" height="15">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
              </svg>
            </span>
            {!sidebarCollapsed && <span className="label">Configuration</span>}
          </button>
          <button
            className="nav-item toggle-theme-btn"
            onClick={toggleTheme}
            title={theme === 'light' ? 'Carbon Mode' : 'Ivory Mode'}
          >
            <span className="icon">
              {theme === 'light' ? (
                <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" width="15" height="15">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              ) : (
                <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" width="15" height="15">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21m9.75-9h-2.25m-13.5 0H3m16.257-7.257l-1.591 1.591M5.222 18.778l1.591-1.591m12.066 0l1.591 1.591M6.813 6.813l-1.591-1.591M12 18.75a6.75 6.75 0 110-13.5 6.75 6.75 0 010 13.5z" />
                </svg>
              )}
            </span>
            {!sidebarCollapsed && <span className="label">{theme === 'light' ? 'Carbon Mode' : 'Ivory Mode'}</span>}
          </button>
        </nav>

        <label className="action-btn upload-action" style={{ background: 'var(--yellow-accent)', color: 'var(--primary)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: sidebarCollapsed ? '0.8rem' : '0.8rem 1.2rem', width: sidebarCollapsed ? '44px' : '100%', height: sidebarCollapsed ? '44px' : 'auto', borderRadius: sidebarCollapsed ? '50%' : 'var(--radius-md)', fontWeight: 800, cursor: 'pointer', marginBottom: '1.5rem', fontFamily: 'var(--font-sans)', fontSize: '0.85rem' }}>
          <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" width="16" height="16">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {!sidebarCollapsed && <span>Upload File</span>}
          <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} />
        </label>

        <div className="sidebar-footer" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: sidebarCollapsed ? 'center' : 'flex-start' }}>
          <div className="status-indicator">
            <span className={`status-dot ${connected ? 'online' : 'offline'}`}></span>
            {!sidebarCollapsed && <span className="status-text">{connected ? 'LINK ON' : 'LINK OFF'}</span>}
          </div>
          {!sidebarCollapsed && <span className="host-display">{hostIp}:{hostPort}</span>}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="portal-content">
        {error && (
          <div className="alert-banner error-alert">
            <span className="alert-text">{error}</span>
          </div>
        )}

        {activeTab === 'explorer' && (
          <div className="explorer-dashboard-layout" style={{ gridTemplateColumns: showExplorerChat ? '1fr' : undefined }}>
            <div className="dashboard-main-col">
              {/* Search Box / Toolbar */}
              <div className="explorer-toolbar" style={{ border: 'none', padding: 0 }}>
                <div className="search-box">
                  <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" width="16" height="16" className="search-icon" style={{ color: 'var(--text-secondary)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input 
                    type="text" 
                    placeholder="search" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                  />
                </div>

                <div className="toolbar-actions">
                  <button 
                    className={`toggle-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                    onClick={() => setViewMode('list')}
                    title="List View"
                    style={{ borderRadius: 'var(--radius-sm)' }}
                  >
                    <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" width="16" height="16">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                    </svg>
                  </button>
                  <button 
                    className={`toggle-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                    onClick={() => setViewMode('grid')}
                    title="Grid View"
                    style={{ borderRadius: 'var(--radius-sm)' }}
                  >
                    <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" width="16" height="16">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                    </svg>
                  </button>
                  <button 
                    className={`toggle-view-btn ${showExplorerChat ? 'active' : ''}`}
                    onClick={() => setShowExplorerChat(prev => !prev)}
                    title="Toggle AI Chat"
                    style={{ borderRadius: 'var(--radius-sm)' }}
                  >
                    <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" width="16" height="16">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* View Header with Breadcrumbs */}
              <div className="view-header" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', border: 'none', padding: 0 }}>
                {currentPath.length > 0 && (
                  <button 
                    onClick={() => setCurrentPath(prev => prev.slice(0, -1))} 
                    className="action-btn"
                    style={{ 
                      padding: '8px 12px', 
                      borderRadius: '8px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '4px',
                      fontSize: '0.8rem',
                      fontWeight: 800
                    }}
                  >
                    ← BACK
                  </button>
                )}
                <div style={{ flexGrow: 1 }}>
                  <div className="path-breadcrumbs" style={{ margin: 0 }}>
                    <span style={{ cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }} onClick={() => setCurrentPath([])}>root</span>
                    {currentPath.map((folder, idx) => (
                      <React.Fragment key={idx}>
                        <span className="divider">/</span>
                        <span 
                          style={{ cursor: 'pointer', textDecoration: idx === currentPath.length - 1 ? 'none' : 'underline', fontWeight: idx === currentPath.length - 1 ? 700 : 600 }} 
                          onClick={() => setCurrentPath(currentPath.slice(0, idx + 1))}
                        >
                          {folder}
                        </span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>

              {/* --- Section 1: Recent Files (Folders Grid) --- */}
              <div>
                <h3 className="dashboard-section-title">
                  <span>Recent Files</span>
                  <a href="#view-all" className="section-view-all">View All</a>
                </h3>

                <div className="folder-mock-grid">
                  {/* Real Folders from API mapped to mock folder layout */}
                  {filteredFiles.filter(f => f.isDirectory).map((folder, idx) => (
                    <div key={idx} className="folder-mock-card" onClick={() => handleItemClick(folder)}>
                      <div className="folder-card-top">
                        <span className="folder-card-icon">📁</span>
                        <button className="folder-card-dots" onClick={(e) => { e.stopPropagation(); toggleSelectFile(folder.name); }}>•••</button>
                      </div>
                      <div className="folder-card-info">
                        <span className="folder-card-name" title={folder.name}>{folder.name}</span>
                        <span className="folder-card-date">Created: {new Date().toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}

                  {/* Fallback if no folders found */}
                  {filteredFiles.filter(f => f.isDirectory).length === 0 && (
                    <div className="folder-mock-card" style={{ cursor: 'default', opacity: 0.7 }}>
                      <div className="folder-card-top">
                        <span className="folder-card-icon" style={{ filter: 'grayscale(1)' }}>📁</span>
                      </div>
                      <div className="folder-card-info">
                        <span className="folder-card-name">All documents</span>
                        <span className="folder-card-date">Empty vault folder</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* --- Section 2: My Projects (Files Table/List Layout) --- */}
              <div>
                <h3 className="dashboard-section-title">
                  <span>My Files</span>
                  <a href="#view-all" className="section-view-all">View All</a>
                </h3>

                {viewMode === 'list' ? (
                  <div className="files-panel" style={{ padding: 0, border: 'none', background: 'transparent', boxShadow: 'none' }}>
                    <div className="mock-table-header">
                      <div className="col-name" style={{ paddingLeft: '40px' }}>Names</div>
                      <div>Size</div>
                      <div style={{ textAlign: 'right', paddingRight: '1rem' }}>Last Modified</div>
                    </div>
                    <div className="files-table">
                      {filteredFiles.filter(f => !f.isDirectory).map((file, idx) => {
                        const fileExt = file.name.split('.').pop()?.toLowerCase() ?? '';
                        let typeBadge = 'badge-default';
                        if (['xd', 'pdf'].includes(fileExt)) typeBadge = 'badge-xd';
                        if (['fig', 'figma'].includes(fileExt)) typeBadge = 'badge-figma';
                        if (['ai', 'eps'].includes(fileExt)) typeBadge = 'badge-ai';
                        if (['sketch'].includes(fileExt)) typeBadge = 'badge-sketch';

                        return (
                          <div key={idx} className={`mock-table-row ${selectedFiles.has(file.name) ? 'selected' : ''}`} onClick={() => handleItemClick(file)}>
                            <div className="row-name-col">
                              <input 
                                type="checkbox" 
                                className="list-checkbox"
                                checked={selectedFiles.has(file.name)}
                                onChange={(e) => { e.stopPropagation(); toggleSelectFile(file.name); }}
                              />
                              <div className={`file-type-badge ${typeBadge}`}>
                                {fileExt.toUpperCase().slice(0, 3)}
                              </div>
                              <span className="row-name-text" title={file.name}>{file.name}</span>
                            </div>
                            <span className="row-members-text">{(file.size / 1024).toFixed(1)} KB</span>
                            <span className="row-date-text" style={{ textAlign: 'right', paddingRight: '1rem' }}>{new Date().toLocaleDateString()}</span>
                          </div>
                        );
                      })}
                      {filteredFiles.filter(f => !f.isDirectory).length === 0 && (
                        <div className="empty-panel-state">
                          <span>No files matched the search criteria.</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  // Grid View for Files
                  <div className="explorer-grid-container">
                    {filteredFiles.filter(f => !f.isDirectory).map((file, idx) => (
                      <div key={idx} className={`paper-grid-card ${selectedFiles.has(file.name) ? 'selected' : ''}`} onClick={() => handleItemClick(file)}>
                        <div className="grid-checkbox-overlay">
                          <input 
                            type="checkbox" 
                            className="grid-checkbox"
                            checked={selectedFiles.has(file.name)}
                            onChange={(e) => { e.stopPropagation(); toggleSelectFile(file.name); }}
                          />
                        </div>
                        <div className="grid-card-icon">
                          {isImageFile(file.name) ? (
                            <img src={`${getBaseUrl()}/${file.relativePath}`} className="grid-thumbnail" alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                          ) : (
                            <span style={{ fontSize: '2rem' }}>📄</span>
                          )}
                        </div>
                        <div className="grid-card-details">
                          <span className="grid-file-name" title={file.name}>{file.name}</span>
                          <span className="grid-file-size">{(file.size / 1024).toFixed(1)} KB</span>
                        </div>
                      </div>
                    ))}
                    {filteredFiles.filter(f => !f.isDirectory).length === 0 && (
                      <div className="empty-grid-state">
                        <span>No files matched.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* --- Right Sidebar Column (Storage circular widget and upgrade) --- */}
            {!showExplorerChat && (
              <div className="dashboard-right-col">


                {/* STORAGE Widget */}
                {(() => {
                  const totalSpace = storageStatus ? storageStatus.totalSpace : 10 * 1024 * 1024 * 1024; // Default 10 GB fallback
                  const usedSpace = storageStatus ? storageStatus.usedSpace : files.reduce((acc, f) => acc + f.size, 0);
                  const usedPercent = Math.round((usedSpace / totalSpace) * 100) || 0;
                  const strokeDashoffset = 377 - (377 * Math.min(1, usedSpace / totalSpace));

                  return (
                    <div>
                      <h3 className="storage-section-title">Storage</h3>
                      <div className="storage-gauge-widget">
                        <div className="circle-progress-container">
                          <svg className="circle-progress-svg">
                            <circle className="circle-bg" cx="70" cy="70" r="60" />
                            <circle className="circle-fill" cx="70" cy="70" r="60" style={{ strokeDashoffset }} />
                          </svg>
                          <div className="gauge-text-overlay">
                            <span className="gauge-percentage">{usedPercent}%</span>
                            <span className="gauge-label">Used</span>
                          </div>
                        </div>
                        <span className="storage-stats-text">
                          {formatSize(usedSpace)} / {formatSize(totalSpace)}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Categories */}
                <div className="storage-categories-list">
                  <div className="category-stat-row">
                    <div className="category-info">
                      <span className="category-icon" style={{ background: '#FFF3D6', color: '#F5A623' }}>📁</span>
                      <div>
                        <span className="category-title">Documents</span>
                        <span className="category-count">{docCount} file{docCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <span className="category-size">{formatSize(docSize)}</span>
                  </div>

                  <div className="category-stat-row">
                    <div className="category-info">
                      <span className="category-icon" style={{ background: '#E6F4FE', color: '#2F80ED' }}>🖼️</span>
                      <div>
                        <span className="category-title">Images</span>
                        <span className="category-count">{imgCount} file{imgCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <span className="category-size">{formatSize(imgSize)}</span>
                  </div>

                  <div className="category-stat-row">
                    <div className="category-info">
                      <span className="category-icon" style={{ background: '#E3FCF2', color: '#27AE60' }}>🎥</span>
                      <div>
                        <span className="category-title">Videos</span>
                        <span className="category-count">{vidCount} file{vidCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <span className="category-size">{formatSize(vidSize)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'camera' && (
          <div className="content-view fade-in">
            <div className="view-header">
              <h2>Surveillance Feed</h2>
              <p>Direct remote camera link.</p>
            </div>

            <div className={`video-console paper-panel`}>
              <div className="console-display">
                {streaming ? (
                  <video ref={videoRef} autoPlay playsInline muted className="surveillance-video" />
                ) : (
                  <div className="console-fallback">
                    <span className="fallback-text">FEED STATUS: OFFLINE</span>
                  </div>
                )}
                {streaming && <div className="rec-indicator">● LIVE</div>}
              </div>

              <div className="console-controls">
                <div className="controls-meta">
                  <span className="meta-label">STATUS</span>
                  <span className="meta-value">{statusText}</span>
                </div>
                {streaming && (
                  <div className="controls-meta">
                    <span className="meta-label">DURATION</span>
                    <span className="meta-value">{formatDuration(duration)}</span>
                  </div>
                )}
                <div className="controls-buttons">
                  {!streaming ? (
                    <button onClick={startCamera} className="action-btn primary-action" disabled={!connected}>
                      START CAMERA
                    </button>
                  ) : (
                    <button onClick={stopCamera} className="action-btn danger-action">
                      STOP CAMERA
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="content-view fade-in">
            <div className="view-header">
              <h2>Gateway Configuration</h2>
              <p>Establish secure parameters for cloud storage.</p>
            </div>

            <div className="settings-container">
              <div className="settings-panel paper-panel">
                <div className="form-group">
                  <label>HOST IP ADDRESS</label>
                  <input
                    type="text"
                    placeholder="e.g. 192.168.1.10"
                    value={hostIp}
                    onChange={(e) => setHostIp(e.target.value)}
                    className="config-input"
                  />
                </div>

                <div className="form-group">
                  <label>NETWORK PORT</label>
                  <input
                    type="text"
                    placeholder="e.g. 8080"
                    value={hostPort}
                    onChange={(e) => setHostPort(e.target.value)}
                    className="config-input"
                  />
                </div>

                <div className="form-buttons">
                  <button onClick={checkConnection} className="action-btn primary-action" disabled={loading}>
                    {loading ? 'TESTING LINK...' : 'ESTABLISH LINK'}
                  </button>
                </div>
              </div>

              <div className="vpn-info-panel paper-panel">
                <div className="vpn-header">
                  <h3 className="vpn-title">Remote Access (VPN)</h3>
                  <span className="vpn-badge" style={{ background: 'rgba(34, 197, 94, 0.1)', color: 'rgb(34, 197, 94)' }}>ACTIVE TUNNEL</span>
                </div>
                <div className="vpn-steps">
                  <div className="vpn-step-item">
                    <span className="step-num">01</span>
                    <div className="step-content">
                      Install the <strong>Tailscale client</strong> on your host PC and on this remote device.
                    </div>
                  </div>
                  <div className="vpn-step-item">
                    <span className="step-num">02</span>
                    <div className="step-content">
                      Log in to your <strong>Tailscale account</strong> on both machines to connect them to your secure mesh network.
                    </div>
                  </div>
                  <div className="vpn-step-item">
                    <span className="step-num">03</span>
                    <div className="step-content">
                      Copy the host PC's Tailscale IP address (starts with <strong>100.x.y.z</strong>) from the Tailscale app.
                    </div>
                  </div>
                  <div className="vpn-step-item">
                    <span className="step-num">04</span>
                    <div className="step-content">
                      Input your host PC's Tailscale IP address in the configuration panel on the left and tap **Establish Link**:
                      <div className="vpn-code-box">
                        <div className="vpn-code-line">
                          <span>Host IP:</span>
                          <span>100.x.y.z (Your PC's Tailscale IP)</span>
                        </div>
                        <div className="vpn-code-line">
                          <span>Port:</span>
                          <span>8080</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="vpn-step-item" style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '5px' }}>
                    <span className="step-num">ALT</span>
                    <div className="step-content" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <strong>WireGuard Option:</strong> Activate the WireGuard tunnel using your client profile, and use Host IP <code>10.0.0.1</code>.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chatbot' && (
          <div className="content-view chatbot-view-container fade-in">
            {/* Left Column: Chat Area */}
            <div className="chat-main-section">
              <div className="view-header chat-header">
                <h2>Local AI Chatbot</h2>
                {chatbotStatus ? (
                  <p className="model-status">
                    Model: <strong className="model-badge">{chatbotStatus.model}</strong> · Status: 
                    <span className={`status-pill ${chatbotStatus.ollamaConnected ? 'status-online' : 'status-offline'}`}>
                      {chatbotStatus.ollamaConnected ? ' OLLAMA CONNECTED' : ' OLLAMA OFFLINE'}
                    </span>
                  </p>
                ) : (
                  <p className="model-status">AI Service is Offline</p>
                )}
              </div>

              <div className="chat-messages-area">
                {chatMessages.length === 0 ? (
                  <div className="chat-empty-state">
                    <div className="ai-icon-large">
                      <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" width="48" height="48">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                      </svg>
                    </div>
                    <h3>Ask the Vault AI</h3>
                    <p>Index documents in the sidebar, then ask questions about your cloud storage files.</p>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} className={`chat-row ${msg.role}`}>
                      <div className={`chat-bubble ${msg.role}`}>
                        <div className="chat-bubble-content">{msg.content}</div>
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="chat-sources">
                            <span className="sources-label">Sources:</span>
                            <div className="sources-list">
                              {msg.sources.map((src, sIdx) => (
                                <span key={sIdx} className="source-chip" title={src}>
                                  {src.split('/').pop() || src}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <span className="chat-time">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
                {chatLoading && (
                  <div className="chat-row assistant">
                    <div className="chat-bubble assistant loading-bubble">
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleSendChatMessage} className="chat-composer">
                <div className="composer-row">
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask about your indexed files..."
                    rows={2}
                    className="chat-input-textarea"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendChatMessage();
                      }
                    }}
                  />
                  <button 
                    type="submit" 
                    disabled={chatLoading || !chatInput.trim()} 
                    className="chat-send-btn"
                  >
                    ↑
                  </button>
                </div>
                <div className="composer-options">
                  <label className="context-toggle-label">
                    <input
                      type="checkbox"
                      checked={chatUseContext}
                      onChange={(e) => setChatUseContext(e.target.checked)}
                      className="context-checkbox"
                    />
                    <span>Use Indexed Context ({contextFiles.length} file{contextFiles.length !== 1 ? 's' : ''})</span>
                  </label>
                </div>
              </form>
            </div>

            {/* Right Column: Context Manager Panel */}
            <div className="chat-context-panel paper-panel">
              <h3>Indexed Context</h3>
              <p className="context-explanation">
                Add local documents here to index their content into the AI's reference context database.
              </p>

              <div className="context-quick-add">
                <h4>Index File from Vault</h4>
                <div className="quick-add-controls">
                  <select 
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddFileToContext(e.target.value);
                        e.target.value = "";
                      }
                    }}
                    className="context-select"
                  >
                    <option value="" disabled>Select file to index...</option>
                    {files
                      .filter(f => !f.isDirectory && !contextFiles.some(cf => cf.relativePath === f.relativePath))
                      .map((f, idx) => (
                        <option key={idx} value={f.relativePath}>
                          {currentPath.length > 0 ? `${currentPath.join('/')}/${f.name}` : f.name}
                        </option>
                      ))
                    }
                  </select>
                </div>
              </div>

              <div className="context-files-list-header">
                <span>Indexed Files ({contextFiles.length})</span>
              </div>
              <div className="context-files-list">
                {contextFiles.length === 0 ? (
                  <div className="empty-context-state">
                    No files currently indexed. Select a file above to add to context.
                  </div>
                ) : (
                  contextFiles.map((cf, idx) => (
                    <div key={idx} className="context-file-item">
                      <div className="cf-info">
                        <span className="cf-name" title={cf.relativePath}>{cf.name}</span>
                        <span className="cf-path" title={cf.relativePath}>{cf.relativePath}</span>
                      </div>
                      <button 
                        onClick={() => handleRemoveFileFromContext(cf.id)}
                        className="cf-remove-btn"
                        title="Remove from index"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Resizable Explorer Sidebar Chatbot */}
      {activeTab === 'explorer' && showExplorerChat && (
        <>
          <div 
            className="sidebar-resizer" 
            onMouseDown={handleMouseDown}
          />
          <aside className="explorer-chatbot-sidebar" style={{ width: explorerSidebarWidth }}>
            <div className="sidebar-chat-header">
              <h3>AI Assistant</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`status-pill ${chatbotStatus?.ollamaConnected ? 'status-online' : 'status-offline'}`} style={{ fontSize: '0.65rem', margin: 0, padding: '1px 6px' }}>
                  {chatbotStatus?.ollamaConnected ? 'ONLINE' : 'OFFLINE'}
                </span>
                <button className="sidebar-chat-close" onClick={() => setShowExplorerChat(false)}>✕</button>
              </div>
            </div>

            <div className="sidebar-chat-messages">
              {chatMessages.length === 0 ? (
                <div className="sidebar-chat-empty">
                  <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" width="32" height="32" style={{ opacity: 0.6, marginBottom: '8px' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                  <p>Ask about files in this folder.</p>
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div key={idx} className={`chat-row ${msg.role}`}>
                    <div className={`chat-bubble ${msg.role}`} style={{ fontSize: '0.85rem', padding: '8px 12px' }}>
                      <div className="chat-bubble-content">{msg.content}</div>
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="chat-sources">
                          <div className="sources-list">
                            {msg.sources.map((src, sIdx) => (
                              <span key={sIdx} className="source-chip" style={{ fontSize: '0.6rem', padding: '1px 4px' }} title={src}>
                                {src.split('/').pop() || src}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              {chatLoading && (
                <div className="chat-row assistant">
                  <div className="chat-bubble assistant loading-bubble" style={{ padding: '8px 16px' }}>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                  </div>
                </div>
              )}
            </div>

            {selectedFiles.size > 0 && (
              <div className="sidebar-quick-index">
                <span>{selectedFiles.size} file{selectedFiles.size > 1 ? 's' : ''} selected</span>
                <button onClick={handleIndexSelectedFiles} className="sidebar-index-btn">
                  INDEX SELECTED
                </button>
              </div>
            )}

            <form onSubmit={handleSendChatMessage} className="sidebar-chat-composer">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about vault..."
                rows={1}
                className="sidebar-chat-textarea"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChatMessage();
                  }
                }}
              />
              <div className="sidebar-composer-bottom">
                <label className="context-toggle-label" style={{ fontSize: '0.75rem' }}>
                  <input
                    type="checkbox"
                    checked={chatUseContext}
                    onChange={(e) => setChatUseContext(e.target.checked)}
                    className="context-checkbox"
                  />
                  <span>Use Context</span>
                </label>
                <button 
                  type="submit" 
                  disabled={chatLoading || !chatInput.trim()} 
                  className="sidebar-send-btn"
                >
                  ↑
                </button>
              </div>
            </form>
          </aside>
        </>
      )}

      {/* Web Operations Toolbar */}
      {selectedFiles.size > 0 && activeTab === 'explorer' && (
        <div className="web-ops-toolbar">
          <div className="ops-info">
            {selectedFiles.size} file{selectedFiles.size > 1 ? 's' : ''} selected
          </div>
          <div className="ops-actions">
            {/* Download and Rename are only visible if exactly ONE file is selected */}
            {selectedFiles.size === 1 && selectedFile && !selectedFile.isDirectory && (
              <>
                <a 
                  href={`${getBaseUrl()}/${selectedFile.relativePath}`} 
                  download 
                  className="action-btn"
                  style={{ textDecoration: 'none', background: 'var(--primary)', color: 'var(--bg-secondary)' }}
                >
                  DOWNLOAD
                </a>
                <button 
                  onClick={() => { setRenameFile(selectedFile); setRenameNewName(selectedFile.name); }} 
                  className="action-btn"
                >
                  RENAME
                </button>
              </>
            )}
            <button onClick={handleDeleteSelected} className="action-btn danger-action" style={{ background: 'var(--error)', color: '#fff' }}>
              DELETE SELECTED
            </button>
            <button onClick={() => setSelectedFiles(new Set())} className="action-btn">
              CLEAR
            </button>
          </div>
        </div>
      )}

      {/* Local Media Viewer Modal */}
      {previewFile && (
        <div className="media-viewer-backdrop" onClick={() => setPreviewFile(null)}>
          <div className="media-viewer-content" onClick={(e) => e.stopPropagation()}>
            <button className="media-viewer-close" onClick={() => setPreviewFile(null)}>✕ CLOSE</button>
            <div className="media-viewer-body">
              {isImageFile(previewFile.name) ? (
                <img src={`${getBaseUrl()}/${previewFile.relativePath}`} alt={previewFile.name} className="viewer-image" />
              ) : isVideoFile(previewFile.name) ? (
                <video src={`${getBaseUrl()}/${previewFile.relativePath}`} controls autoPlay className="viewer-video" />
              ) : (
                <div className="viewer-fallback">Unsupported file format</div>
              )}
            </div>
            <div className="media-viewer-footer">
              <span className="viewer-filename">{previewFile.name}</span>
              <span className="viewer-filesize">{(previewFile.size / 1024).toFixed(1)} KB</span>
            </div>
          </div>
        </div>
      )}

      {/* Rename File Modal */}
      {renameFile && (
        <div className="rename-backdrop" onClick={() => setRenameFile(null)}>
          <div className="rename-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Rename File</h3>
            <input 
              type="text" 
              value={renameNewName} 
              onChange={(e) => setRenameNewName(e.target.value)} 
              className="rename-input"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameConfirm();
                if (e.key === 'Escape') setRenameFile(null);
              }}
            />
            <div className="rename-modal-buttons">
              <button onClick={() => setRenameFile(null)} className="action-btn">
                CANCEL
              </button>
              <button onClick={handleRenameConfirm} className="action-btn primary-action" style={{ background: 'var(--primary)', color: 'var(--bg-secondary)' }}>
                RENAME
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
