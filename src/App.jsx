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
import { HardDrive, Zap, MessageSquare, CloudCheck } from 'lucide-react';

export default function App() {
  // ── Main Section: 'wifi' (Open WiFi Cloud), 'p2p' (Direct P2P), 'board' (Text & Links) ─
  const [activeSection, setActiveSection] = useState('wifi');

  // ── Open WiFi Cloud State ─────────────────────────────────────────────────
  const [isServerOnline, setIsServerOnline] = useState(true);
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

  // ── 1. Open WiFi Cloud Initialization & Real-Time Sync (SSE) ──────────────
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
          setActiveSection('p2p');
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
        setActiveSection('board');
      },
      onLinkReceived: (linkItem) => {
        sound.playSuccess();
        setP2pLinkHistory((prev) => [linkItem, ...prev]);
        setActiveSection('board');
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
        setActiveSection('p2p');
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

  // ── 3. WiFi Upload (Bina Kisi User Ke Online Huye Direct Upload) ───────────
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
    if (activeSection === 'wifi') {
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
      // Fallback to P2P if server offline
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

    if (activeSection === 'wifi') {
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

    if (activeSection === 'wifi') {
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
    if (activeSection === 'wifi') {
      window.location.href = '/api/download-all';
    } else {
      downloadAllAsZip(p2pFiles);
    }
  };

  const currentFiles = activeSection === 'wifi' ? wifiFiles : p2pFiles;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', width: '100%', overflowX: 'hidden' }}>
      {/* Top Navbar */}
      <Navbar
        transferMode={activeSection}
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
            AR | WiFi | TR — <span style={{ color: '#BC0202' }}>Local WiFi File Transfer</span>
          </h2>

          <p style={{
            fontSize: '0.88rem',
            color: '#64748b',
            maxWidth: 640,
            margin: '0 auto',
            lineHeight: 1.4,
          }}>
            Bina kisi code ke: Direct file upload karein. File disk par save rehti hai aur same WiFi par koi bhi kabhi bhi access kar sakta hai!
          </p>
        </div>

        {/* ── 3 Main Top Sections (Cloud, P2P, Board) ─────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 10,
          marginBottom: 16,
        }}>
          {/* Section 1: Open WiFi Cloud (No Code / Offline User Supported) */}
          <button
            onClick={() => {
              sound.playClick();
              setActiveSection('wifi');
            }}
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              border: activeSection === 'wifi' ? '2px solid #BC0202' : '1px solid #cbd5e1',
              backgroundColor: activeSection === 'wifi' ? '#ffffff' : '#f8fafc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              textAlign: 'left',
              boxShadow: activeSection === 'wifi' ? '0 4px 12px rgba(188, 2, 2, 0.12)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 8,
              backgroundColor: activeSection === 'wifi' ? '#fee2e2' : '#e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <HardDrive size={22} color={activeSection === 'wifi' ? '#BC0202' : '#64748b'} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: '0.92rem', fontWeight: 800, color: activeSection === 'wifi' ? '#BC0202' : '#0f172a' }}>
                  🌐 Open WiFi Cloud
                </span>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  backgroundColor: '#fee2e2',
                  color: '#BC0202',
                  padding: '1px 6px',
                  borderRadius: 4,
                }}>
                  No Code
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                Direct upload • User offline ho tab bhi chalega • Har koi access kare
              </div>
            </div>
          </button>

          {/* Section 2: Direct P2P Transfer (6-Digit Code) */}
          <button
            onClick={() => {
              sound.playClick();
              setActiveSection('p2p');
            }}
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              border: activeSection === 'p2p' ? '2px solid #BC0202' : '1px solid #cbd5e1',
              backgroundColor: activeSection === 'p2p' ? '#ffffff' : '#f8fafc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              textAlign: 'left',
              boxShadow: activeSection === 'p2p' ? '0 4px 12px rgba(188, 2, 2, 0.12)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 8,
              backgroundColor: activeSection === 'p2p' ? '#fee2e2' : '#e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Zap size={22} color={activeSection === 'p2p' ? '#BC0202' : '#64748b'} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: '0.92rem', fontWeight: 800, color: activeSection === 'p2p' ? '#BC0202' : '#0f172a' }}>
                  ⚡ Direct P2P
                </span>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  backgroundColor: '#dcfce7',
                  color: '#166534',
                  padding: '1px 6px',
                  borderRadius: 4,
                }}>
                  6-Digit Code
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                Live device-to-device stream • GitHub Pages ready
              </div>
            </div>
          </button>

          {/* Section 3: WiFi Notice Board (Text & Links) */}
          <button
            onClick={() => {
              sound.playClick();
              setActiveSection('board');
            }}
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              border: activeSection === 'board' ? '2px solid #BC0202' : '1px solid #cbd5e1',
              backgroundColor: activeSection === 'board' ? '#ffffff' : '#f8fafc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              textAlign: 'left',
              boxShadow: activeSection === 'board' ? '0 4px 12px rgba(188, 2, 2, 0.12)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 8,
              backgroundColor: activeSection === 'board' ? '#fee2e2' : '#e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <MessageSquare size={22} color={activeSection === 'board' ? '#BC0202' : '#64748b'} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: '0.92rem', fontWeight: 800, color: activeSection === 'board' ? '#BC0202' : '#0f172a' }}>
                  💬 WiFi Text & Links
                </span>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  padding: '1px 6px',
                  borderRadius: 4,
                }}>
                  Broadcast
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                Clipboard text, notes, OTPs & URLs instant share
              </div>
            </div>
          </button>
        </div>

        {/* ── Section 1: Open WiFi Cloud (No Code / Direct Upload) ─────────── */}
        {activeSection === 'wifi' && (
          <>
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

            <Dropzone
              mode="wifi"
              isConnected={isServerOnline}
              onSendFiles={handleUploadWifiFiles}
              isUploading={isUploading}
              onCancelActiveTransfer={() => handleCancelTransfer(activeTransfer?.fileId)}
            />

            <FileList
              files={wifiFiles}
              title="Shared WiFi Cloud Files"
              subTitle="Disk par saved files — is WiFi se connected sabhi devices kabhi bhi download kar sakte hain (chahe user online na ho)"
              onDeleteFile={handleDeleteFile}
              onClearAll={handleClearAllFiles}
              onPreviewFile={(file) => setPreviewFile(file)}
              onDownloadAll={handleDownloadAll}
            />
          </>
        )}

        {/* ── Section 2: Direct P2P WebRTC (6-Digit Code) ─────────────────── */}
        {activeSection === 'p2p' && (
          <>
            <ConnectionBar
              myCode={myCode}
              remoteCode={remoteCode}
              isConnected={isConnected}
              isConnecting={isConnecting}
              onConnect={(targetCode) => p2pRef.current?.connectToPeer(targetCode)}
              onDisconnect={() => p2pRef.current?.disconnect()}
              onOpenQr={() => setIsQrOpen(true)}
            />

            <Dropzone
              mode="p2p"
              isConnected={isConnected}
              onSendFiles={handleSendP2PFiles}
              isUploading={isUploading}
              onCancelActiveTransfer={() => handleCancelTransfer(activeTransfer?.fileId)}
            />

            <FileList
              files={p2pFiles}
              title="P2P Received Files"
              subTitle="Live paired device se aayi hui files — Download dabakar save karein"
              onDeleteFile={handleDeleteFile}
              onClearAll={handleClearAllFiles}
              onPreviewFile={(file) => setPreviewFile(file)}
              onDownloadAll={handleDownloadAll}
            />
          </>
        )}

        {/* ── Section 3: WiFi Notice Board (Text & Links) ──────────────────── */}
        {activeSection === 'board' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <TextShare
              isConnected={isServerOnline || isConnected}
              onSendText={handleSendText}
              textHistory={isServerOnline ? wifiTextHistory : p2pTextHistory}
              onClearHistory={() => {
                if (isServerOnline) {
                  fetch('/api/text', { method: 'DELETE' });
                  setWifiTextHistory([]);
                } else {
                  setP2pTextHistory([]);
                }
              }}
            />

            <LinkShare
              isConnected={isServerOnline || isConnected}
              onSendLink={handleSendLink}
              linkHistory={isServerOnline ? wifiLinkHistory : p2pLinkHistory}
              onClearHistory={() => {
                if (isServerOnline) {
                  fetch('/api/link', { method: 'DELETE' });
                  setWifiLinkHistory([]);
                } else {
                  setP2pLinkHistory([]);
                }
              }}
            />
          </div>
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
            <span>• Open WiFi Cloud Storage & Direct P2P Transfer</span>
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
        targetUrl={activeSection === 'wifi' ? serverInfo?.networkUrl : null}
        title={activeSection === 'wifi' ? 'Scan to Open WiFi Cloud on Mobile' : 'Scan to Connect Phone'}
        subtext={
          activeSection === 'wifi'
            ? 'Phone camera se scan karein. Kisi code ya link bejne ki zaroorat nahi, har koi direct access karega!'
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
