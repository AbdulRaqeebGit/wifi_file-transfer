import React, { useState, useEffect, useRef, useCallback } from 'react';
import Navbar from './components/Navbar';
import WifiBar from './components/WifiBar';
import ConnectionBar from './components/ConnectionBar';
import Dropzone from './components/Dropzone';
import TextShare from './components/TextShare';
import LinkShare from './components/LinkShare';
import FileList from './components/FileList';
import QrModal from './components/QrModal';
import PreviewModal from './components/PreviewModal';
import TransferProgressCard from './components/TransferProgressCard';
import { P2PManager } from './utils/p2p';
import { downloadAllAsZip } from './utils/zip';
import { sound } from './utils/sound';
import { Wifi, Radio, Zap, Sparkles } from 'lucide-react';

export default function App() {
  // ── Transfer Mode: 'wifi' (No Code / Same WiFi Hub) or 'p2p' (6-Digit Code) ─
  const [transferMode, setTransferMode] = useState('wifi');

  // ── Mode Switcher Tab: 'files', 'text', 'links' ───────────────────────────
  const [activeTab, setActiveTab] = useState('files');

  // ── Same WiFi Hub State ───────────────────────────────────────────────────
  const [isServerOnline, setIsServerOnline] = useState(false);
  const [serverInfo, setServerInfo] = useState(null);
  const [activeClients, setActiveClients] = useState(0);
  const [wifiFiles, setWifiFiles] = useState([]);
  const [wifiTextHistory, setWifiTextHistory] = useState([]);
  const [wifiLinkHistory, setWifiLinkHistory] = useState([]);

  // ── Direct P2P WebRTC State ───────────────────────────────────────────────
  const [myCode, setMyCode] = useState('');
  const [remoteCode, setRemoteCode] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [p2pFiles, setP2pFiles] = useState([]);
  const [p2pTextHistory, setP2pTextHistory] = useState([]);
  const [p2pLinkHistory, setP2pLinkHistory] = useState([]);

  // ── Common Modals & Transfer State ────────────────────────────────────────
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTransfer, setActiveTransfer] = useState(null);

  const p2pRef = useRef(null);
  const xhrUploadRef = useRef(null);

  // ── 1. Same WiFi Hub Initialization & Real-Time Sync (SSE) ────────────────
  const fetchWifiFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/files');
      if (res.ok) {
        const data = await res.json();
        setWifiFiles(data);
      }
    } catch {}
  }, []);

  const fetchWifiTexts = useCallback(async () => {
    try {
      const res = await fetch('/api/text');
      if (res.ok) {
        const data = await res.json();
        setWifiTextHistory(data);
      }
    } catch {}
  }, []);

  const fetchWifiLinks = useCallback(async () => {
    try {
      const res = await fetch('/api/link');
      if (res.ok) {
        const data = await res.json();
        setWifiLinkHistory(data);
      }
    } catch {}
  }, []);

  const fetchServerInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/info');
      if (res.ok) {
        const info = await res.json();
        setServerInfo(info);
        setIsServerOnline(true);
        if (info.activeClients) setActiveClients(info.activeClients);
      } else {
        setIsServerOnline(false);
      }
    } catch {
      setIsServerOnline(false);
    }
  }, []);

  // Poll server info & setup SSE for instant live updates across devices
  useEffect(() => {
    fetchServerInfo();
    fetchWifiFiles();
    fetchWifiTexts();
    fetchWifiLinks();

    let sse = null;
    try {
      sse = new EventSource('/api/events');

      sse.addEventListener('connected', () => {
        setIsServerOnline(true);
      });

      sse.addEventListener('clients-count', (e) => {
        try {
          const { count } = JSON.parse(e.data);
          setActiveClients(count);
        } catch {}
      });

      sse.addEventListener('files-updated', (e) => {
        try {
          const { files } = JSON.parse(e.data);
          setWifiFiles(files);
        } catch {
          fetchWifiFiles();
        }
      });

      sse.addEventListener('text-updated', (e) => {
        try {
          const item = JSON.parse(e.data);
          setWifiTextHistory((prev) => [item, ...prev]);
        } catch {
          fetchWifiTexts();
        }
      });

      sse.addEventListener('link-updated', (e) => {
        try {
          const item = JSON.parse(e.data);
          setWifiLinkHistory((prev) => [item, ...prev]);
        } catch {
          fetchWifiLinks();
        }
      });

      sse.addEventListener('text-cleared', () => {
        setWifiTextHistory([]);
      });

      sse.addEventListener('link-cleared', () => {
        setWifiLinkHistory([]);
      });

      sse.onerror = () => {
        // Fallback polling if SSE drops
        setIsServerOnline(false);
      };
    } catch {}

    const interval = setInterval(fetchServerInfo, 10000);

    return () => {
      clearInterval(interval);
      if (sse) sse.close();
    };
  }, [fetchServerInfo, fetchWifiFiles, fetchWifiTexts, fetchWifiLinks]);

  // ── 2. Direct P2P WebRTC Initialization ───────────────────────────────────
  useEffect(() => {
    const p2p = new P2PManager({
      onReady: ({ code }) => {
        setMyCode(code);

        // Auto-connect if URL has #connect=123456
        const hash = window.location.hash;
        const match = hash.match(/#connect=([a-zA-Z0-9]+)/);
        if (match && match[1] && match[1] !== code) {
          setTransferMode('p2p');
          setTimeout(() => p2p.connectToPeer(match[1]), 600);
        }
      },
      onConnecting: ({ remoteCode }) => {
        setIsConnecting(true);
        setRemoteCode(remoteCode);
      },
      onConnected: ({ remoteCode }) => {
        setIsConnected(true);
        setIsConnecting(false);
        setRemoteCode(remoteCode);
        sound.playSuccess();
      },
      onDisconnected: () => {
        setIsConnected(false);
        setIsConnecting(false);
        setRemoteCode('');
        setActiveTransfer(null);
        setIsUploading(false);
      },
      onTextReceived: (textItem) => {
        sound.playSuccess();
        setP2pTextHistory((prev) => [textItem, ...prev]);
        setActiveTab('text');
      },
      onLinkReceived: (linkItem) => {
        sound.playSuccess();
        setP2pLinkHistory((prev) => [linkItem, ...prev]);
        setActiveTab('links');
      },
      onTransferStart: (info) => {
        setActiveTransfer({
          fileId: info.fileId,
          fileName: info.fileName,
          totalBytes: info.totalBytes,
          receivedBytes: 0,
          percent: 0,
          speed: 0,
          role: info.role,
        });
      },
      onTransferProgress: (progress) => {
        setActiveTransfer((prev) => ({
          ...prev,
          fileId: progress.fileId,
          fileName: progress.fileName,
          percent: progress.percent,
          receivedBytes: progress.receivedBytes,
          totalBytes: progress.totalBytes,
          speed: progress.speed,
          role: progress.role,
        }));
      },
      onTransferComplete: (newFile) => {
        // File ready in memory blob. Shows in list with manual Download button. NO auto-download.
        sound.playSuccess();
        setP2pFiles((prev) => [newFile, ...prev]);
        setActiveTransfer(null);
        setIsUploading(false);
        setActiveTab('files');
      },
      onTransferCancelled: ({ byRemote }) => {
        sound.playClick();
        setActiveTransfer(null);
        setIsUploading(false);
        alert(byRemote ? 'Transfer was cancelled by the other device.' : 'Transfer cancelled.');
      },
      onError: (msg) => {
        setIsConnecting(false);
        alert('P2P Error: ' + msg);
      },
    });

    p2pRef.current = p2p;

    return () => {
      p2p.destroy();
    };
  }, []);

  // ── 3. WiFi Upload Handling (pehle upload ho jaye, phir download option aaye)
  const handleUploadWifiFiles = async (filesToSend) => {
    if (!filesToSend || filesToSend.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    for (const file of filesToSend) {
      formData.append('files', file);
    }

    const totalBytes = filesToSend.reduce((acc, f) => acc + f.size, 0);
    const fileName = filesToSend.length === 1 ? filesToSend[0].name : `${filesToSend.length} Files`;
    const startTime = Date.now();

    setActiveTransfer({
      fileId: 'wifi-upload',
      fileName,
      totalBytes,
      receivedBytes: 0,
      percent: 0,
      speed: 0,
      role: 'sender',
    });

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrUploadRef.current = xhr;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.min(100, Math.round((e.loaded / e.total) * 100));
          const elapsedSec = (Date.now() - startTime) / 1000;
          const speed = elapsedSec > 0.1 ? e.loaded / elapsedSec : 0;

          setActiveTransfer({
            fileId: 'wifi-upload',
            fileName,
            totalBytes: e.total,
            receivedBytes: e.loaded,
            percent,
            speed,
            role: 'sender',
          });
        }
      };

      xhr.onload = () => {
        xhrUploadRef.current = null;
        if (xhr.status >= 200 && xhr.status < 300) {
          sound.playSuccess();
          setActiveTransfer(null);
          setIsUploading(false);
          fetchWifiFiles();
          resolve();
        } else {
          setActiveTransfer(null);
          setIsUploading(false);
          reject(new Error(xhr.responseText || 'Upload failed'));
        }
      };

      xhr.onerror = () => {
        xhrUploadRef.current = null;
        setActiveTransfer(null);
        setIsUploading(false);
        reject(new Error('Network error during upload'));
      };

      xhr.onabort = () => {
        xhrUploadRef.current = null;
        setActiveTransfer(null);
        setIsUploading(false);
        reject(new Error('Transfer cancelled'));
      };

      xhr.open('POST', '/api/upload');
      xhr.send(formData);
    });
  };

  // ── 4. P2P Direct File Sending ────────────────────────────────────────────
  const handleSendP2PFiles = async (filesToSend) => {
    if (!p2pRef.current || !isConnected) {
      alert('Please connect to a device with 6-digit code first!');
      return;
    }

    setIsUploading(true);

    try {
      for (const file of filesToSend) {
        await p2pRef.current.sendFile(file, ({ percent, bytesSent, totalBytes, speed, fileId }) => {
          setActiveTransfer({
            fileId,
            fileName: file.name,
            percent,
            receivedBytes: bytesSent,
            totalBytes,
            speed,
            role: 'sender',
          });
        });
      }
    } finally {
      setIsUploading(false);
      setActiveTransfer(null);
    }
  };

  // ── 5. Cancel Current Transfer ────────────────────────────────────────────
  const handleCancelTransfer = (fileId) => {
    if (transferMode === 'wifi') {
      if (xhrUploadRef.current) {
        xhrUploadRef.current.abort();
        xhrUploadRef.current = null;
      }
      setActiveTransfer(null);
      setIsUploading(false);
      sound.playClick();
    } else {
      if (p2pRef.current) {
        p2pRef.current.cancelTransfer(fileId);
        setActiveTransfer(null);
        setIsUploading(false);
      }
    }
  };

  // ── 6. Text & Link Sharing Handlers ───────────────────────────────────────
  const handleSendText = async (text) => {
    if (transferMode === 'wifi') {
      try {
        const res = await fetch('/api/text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (res.ok) {
          const item = await res.json();
          setWifiTextHistory((prev) => [item, ...prev]);
        }
      } catch (err) {
        alert('Failed to send text to WiFi network: ' + err.message);
      }
    } else {
      if (p2pRef.current && isConnected) {
        p2pRef.current.sendText(text);
        setP2pTextHistory((prev) => [
          { id: Date.now().toString(), text, isMine: true, timestamp: new Date().toISOString() },
          ...prev,
        ]);
      }
    }
  };

  const handleSendLink = async (url, title) => {
    if (transferMode === 'wifi') {
      try {
        const res = await fetch('/api/link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, title }),
        });
        if (res.ok) {
          const item = await res.json();
          setWifiLinkHistory((prev) => [item, ...prev]);
        }
      } catch (err) {
        alert('Failed to send link to WiFi network: ' + err.message);
      }
    } else {
      if (p2pRef.current && isConnected) {
        p2pRef.current.sendLink(url, title);
        setP2pLinkHistory((prev) => [
          { id: Date.now().toString(), url, title, isMine: true, timestamp: new Date().toISOString() },
          ...prev,
        ]);
      }
    }
  };

  // ── 7. File Deletion & Clear All ──────────────────────────────────────────
  const handleDeleteFile = async (id) => {
    if (!window.confirm('Delete this file?')) return;

    if (transferMode === 'wifi') {
      try {
        await fetch(`/api/files/${id}`, { method: 'DELETE' });
        setWifiFiles((prev) => prev.filter((f) => f.id !== id));
      } catch {}
    } else {
      setP2pFiles((prev) => {
        const file = prev.find((f) => f.id === id);
        if (file?.url) {
          try { URL.revokeObjectURL(file.url); } catch {}
        }
        return prev.filter((f) => f.id !== id);
      });
    }
  };

  const handleClearAllFiles = async () => {
    if (!window.confirm('Clear all files?')) return;

    if (transferMode === 'wifi') {
      try {
        await fetch('/api/files', { method: 'DELETE' });
        setWifiFiles([]);
      } catch {}
    } else {
      setP2pFiles((prev) => {
        prev.forEach((f) => {
          if (f.url) {
            try { URL.revokeObjectURL(f.url); } catch {}
          }
        });
        return [];
      });
    }
  };

  // ── 8. Download All as ZIP ────────────────────────────────────────────────
  const handleDownloadAll = () => {
    if (transferMode === 'wifi') {
      window.location.href = '/api/download-all';
    } else {
      downloadAllAsZip(p2pFiles);
    }
  };

  // Active files, texts, links based on current mode
  const currentFiles = transferMode === 'wifi' ? wifiFiles : p2pFiles;
  const currentTextHistory = transferMode === 'wifi' ? wifiTextHistory : p2pTextHistory;
  const currentLinkHistory = transferMode === 'wifi' ? wifiLinkHistory : p2pLinkHistory;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', width: '100%', overflowX: 'hidden' }}>
      {/* Top Navbar */}
      <Navbar
        transferMode={transferMode}
        isServerOnline={isServerOnline}
        isConnected={isConnected}
        remoteCode={remoteCode}
        totalFiles={currentFiles.length}
        onOpenQr={() => setIsQrOpen(true)}
        onDownloadAll={handleDownloadAll}
      />

      {/* Main Container */}
      <main style={{ maxWidth: 1100, width: '100%', margin: '0 auto', padding: '16px 14px', flex: 1, boxSizing: 'border-box' }}>
        {/* Header Title */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <h2 style={{
            fontSize: 'clamp(1.4rem, 3.2vw, 2.1rem)',
            fontWeight: 800,
            letterSpacing: '-0.5px',
            margin: '0 0 6px',
            color: '#0f172a',
          }}>
            Transfer <span style={{ color: '#BC0202' }}>Files, Text & Links</span> Anywhere
          </h2>

          <p style={{
            fontSize: '0.88rem',
            color: '#64748b',
            maxWidth: 600,
            margin: '0 auto',
            lineHeight: 1.4,
          }}>
            {transferMode === 'wifi'
              ? 'Bina kisi code ke: Same WiFi par pehle file upload karein, phir koi bhi device foran download kar sakta hai!'
              : 'Direct WebRTC device-to-device pairing. 6-digit code enter karein ya phone se scan karein!'}
          </p>
        </div>

        {/* ── Prominent Mode Switcher (WiFi vs P2P) ───────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 10,
          marginBottom: 16,
        }}>
          {/* Option 1: Same WiFi (No Code) */}
          <button
            onClick={() => {
              sound.playClick();
              setTransferMode('wifi');
            }}
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              border: transferMode === 'wifi' ? '2px solid #BC0202' : '1px solid #cbd5e1',
              backgroundColor: transferMode === 'wifi' ? '#ffffff' : '#f8fafc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              textAlign: 'left',
              boxShadow: transferMode === 'wifi' ? '0 4px 12px rgba(188, 2, 2, 0.12)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              backgroundColor: transferMode === 'wifi' ? '#fee2e2' : '#e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Wifi size={22} color={transferMode === 'wifi' ? '#BC0202' : '#64748b'} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: '0.92rem', fontWeight: 800, color: transferMode === 'wifi' ? '#BC0202' : '#0f172a' }}>
                  🌐 Same WiFi (No Code)
                </span>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  backgroundColor: '#fee2e2',
                  color: '#BC0202',
                  padding: '1px 6px',
                  borderRadius: 4,
                }}>
                  Easy
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                Bager code ke: Pehle upload ho jaye, phir download ka option aaye
              </div>
            </div>
          </button>

          {/* Option 2: Direct P2P (6-Digit Code) */}
          <button
            onClick={() => {
              sound.playClick();
              setTransferMode('p2p');
            }}
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              border: transferMode === 'p2p' ? '2px solid #BC0202' : '1px solid #cbd5e1',
              backgroundColor: transferMode === 'p2p' ? '#ffffff' : '#f8fafc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              textAlign: 'left',
              boxShadow: transferMode === 'p2p' ? '0 4px 12px rgba(188, 2, 2, 0.12)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              backgroundColor: transferMode === 'p2p' ? '#fee2e2' : '#e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Zap size={22} color={transferMode === 'p2p' ? '#BC0202' : '#64748b'} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: '0.92rem', fontWeight: 800, color: transferMode === 'p2p' ? '#BC0202' : '#0f172a' }}>
                  ⚡ Direct P2P (Code Pairing)
                </span>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  backgroundColor: '#dcfce7',
                  color: '#166534',
                  padding: '1px 6px',
                  borderRadius: 4,
                }}>
                  GitHub Pages
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                Direct WebRTC: 6-digit code se pair karein aur share karein
              </div>
            </div>
          </button>
        </div>

        {/* ── Mode-Specific Bar: WifiBar vs ConnectionBar ─────────────────── */}
        {transferMode === 'wifi' ? (
          <WifiBar
            serverInfo={serverInfo}
            isServerOnline={isServerOnline}
            activeClients={activeClients}
            onOpenQr={() => setIsQrOpen(true)}
            onRefresh={() => {
              fetchServerInfo();
              fetchWifiFiles();
              fetchWifiTexts();
              fetchWifiLinks();
            }}
          />
        ) : (
          <ConnectionBar
            myCode={myCode}
            remoteCode={remoteCode}
            isConnected={isConnected}
            isConnecting={isConnecting}
            onConnect={(targetCode) => p2pRef.current?.connectToPeer(targetCode)}
            onDisconnect={() => p2pRef.current?.disconnect()}
            onOpenQr={() => setIsQrOpen(true)}
          />
        )}

        {/* ── Subtabs: Files, Text, Links ─────────────────────────────────── */}
        <div
          className="responsive-tabs"
          style={{
            display: 'flex',
            gap: 6,
            marginBottom: 14,
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: 8,
          }}
        >
          <button
            onClick={() => setActiveTab('files')}
            style={{
              backgroundColor: activeTab === 'files' ? '#BC0202' : '#ffffff',
              color: activeTab === 'files' ? '#ffffff' : '#475569',
              border: activeTab === 'files' ? '1px solid #BC0202' : '1px solid #cbd5e1',
              borderRadius: 6,
              padding: '7px 14px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span>📁 Files</span>
            {currentFiles.length > 0 && (
              <span style={{
                backgroundColor: activeTab === 'files' ? '#ffffff' : '#fee2e2',
                color: '#BC0202',
                padding: '1px 5px',
                borderRadius: 4,
                fontSize: '0.7rem',
              }}>
                {currentFiles.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('text')}
            style={{
              backgroundColor: activeTab === 'text' ? '#BC0202' : '#ffffff',
              color: activeTab === 'text' ? '#ffffff' : '#475569',
              border: activeTab === 'text' ? '1px solid #BC0202' : '1px solid #cbd5e1',
              borderRadius: 6,
              padding: '7px 14px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span>💬 Text / Notes</span>
            {currentTextHistory.length > 0 && (
              <span style={{
                backgroundColor: activeTab === 'text' ? '#ffffff' : '#fee2e2',
                color: '#BC0202',
                padding: '1px 5px',
                borderRadius: 4,
                fontSize: '0.7rem',
              }}>
                {currentTextHistory.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('links')}
            style={{
              backgroundColor: activeTab === 'links' ? '#BC0202' : '#ffffff',
              color: activeTab === 'links' ? '#ffffff' : '#475569',
              border: activeTab === 'links' ? '1px solid #BC0202' : '1px solid #cbd5e1',
              borderRadius: 6,
              padding: '7px 14px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span>🔗 Links / URLs</span>
            {currentLinkHistory.length > 0 && (
              <span style={{
                backgroundColor: activeTab === 'links' ? '#ffffff' : '#fee2e2',
                color: '#BC0202',
                padding: '1px 5px',
                borderRadius: 4,
                fontSize: '0.7rem',
              }}>
                {currentLinkHistory.length}
              </span>
            )}
          </button>
        </div>

        {/* ── Tab Contents ────────────────────────────────────────────────── */}
        {activeTab === 'files' && (
          <>
            <Dropzone
              mode={transferMode}
              isConnected={transferMode === 'wifi' ? isServerOnline : isConnected}
              onSendFiles={transferMode === 'wifi' ? handleUploadWifiFiles : handleSendP2PFiles}
              isUploading={isUploading}
              onCancelActiveTransfer={() => handleCancelTransfer(activeTransfer?.fileId)}
            />

            <FileList
              files={currentFiles}
              onDeleteFile={handleDeleteFile}
              onClearAll={handleClearAllFiles}
              onPreviewFile={(file) => setPreviewFile(file)}
              onDownloadAll={handleDownloadAll}
            />
          </>
        )}

        {activeTab === 'text' && (
          <TextShare
            isConnected={transferMode === 'wifi' ? isServerOnline : isConnected}
            onSendText={handleSendText}
            textHistory={currentTextHistory}
            onClearHistory={() => {
              if (transferMode === 'wifi') {
                fetch('/api/text', { method: 'DELETE' });
                setWifiTextHistory([]);
              } else {
                setP2pTextHistory([]);
              }
            }}
          />
        )}

        {activeTab === 'links' && (
          <LinkShare
            isConnected={transferMode === 'wifi' ? isServerOnline : isConnected}
            onSendLink={handleSendLink}
            linkHistory={currentLinkHistory}
            onClearHistory={() => {
              if (transferMode === 'wifi') {
                fetch('/api/link', { method: 'DELETE' });
                setWifiLinkHistory([]);
              } else {
                setP2pLinkHistory([]);
              }
            }}
          />
        )}
      </main>

      {/* Floating Transfer Progress Card with prominent Cancel (X) button */}
      <TransferProgressCard
        activeTransfer={activeTransfer}
        onCancel={handleCancelTransfer}
      />

      {/* Clean Footer */}
      <footer style={{
        marginTop: 'auto',
        borderTop: '1px solid #e2e8f0',
        padding: '16px',
        textAlign: 'center',
        backgroundColor: '#ffffff',
        fontSize: '0.78rem',
        color: '#64748b',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 800, color: '#BC0202' }}>AR | WiFi | TR</span>
            <span>• Same WiFi Hub & Direct P2P WebRTC Transfer</span>
          </div>
          <div>
            <span>5GB+ Unlimited Size Supported • IDM High Speed</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <QrModal
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        myCode={myCode}
        targetUrl={transferMode === 'wifi' ? serverInfo?.networkUrl : null}
        title={transferMode === 'wifi' ? 'Scan to Open on Same WiFi' : 'Scan to Connect Phone'}
        subtext={
          transferMode === 'wifi'
            ? 'Phone camera se scan karein. Bina kisi code ke same WiFi par files share karein!'
            : 'Phone camera se scan karein. Direct P2P 6-digit code se pair hoga.'
        }
      />

      <PreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  );
}
