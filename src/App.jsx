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
import { Users, Shield, HardDrive, FileText, Link2 } from 'lucide-react';

export default function App() {
  // ── Main Mode: 'group' (Default for all WiFi users) or 'p2p' (Private Device OTP Pair) ──
  const [activeSection, setActiveSection] = useState('group');
  const [activeSubTab, setActiveSubTab] = useState('files'); // 'files', 'text', 'links'

  // ── Server & Network Status (for Group WiFi Cloud) ─────────────────────────
  const [isServerOnline, setIsServerOnline] = useState(true);
  const [serverInfo, setServerInfo] = useState(null);
  const [activeClients, setActiveClients] = useState(0);

  // ── Group Data State (Shared on same WiFi — No code needed) ────────────────
  const [groupFiles, setGroupFiles] = useState([]);
  const [groupTexts, setGroupTexts] = useState([]);
  const [groupLinks, setGroupLinks] = useState([]);

  // ── Direct Private P2P State (6-Digit OTP Code & QR Scan) ─────────────────
  const [myCode, setMyCode] = useState('');
  const [remoteCode, setRemoteCode] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [p2pFiles, setP2pFiles] = useState([]);
  const [p2pTexts, setP2pTexts] = useState([]);
  const [p2pLinks, setP2pLinks] = useState([]);

  // ── Modals & High-Speed Transfer Monitor ──────────────────────────────────
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTransfer, setActiveTransfer] = useState(null);

  const p2pRef = useRef(null);
  const xhrUploadRef = useRef(null);

  // ── 1. Fetching Group Data ────────────────────────────────────────────────
  const fetchGroupFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/files');
      if (res.ok) setGroupFiles(await res.json());
    } catch {}
  }, []);

  const fetchGroupTexts = useCallback(async () => {
    try {
      const res = await fetch('/api/text');
      if (res.ok) setGroupTexts(await res.json());
    } catch {}
  }, []);

  const fetchGroupLinks = useCallback(async () => {
    try {
      const res = await fetch('/api/link');
      if (res.ok) setGroupLinks(await res.json());
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

  // ── 2. Real-Time SSE Sync across all WiFi Devices (Group) ─────────────────
  useEffect(() => {
    fetchServerInfo();
    fetchGroupFiles();
    fetchGroupTexts();
    fetchGroupLinks();

    let sse = null;
    try {
      sse = new EventSource('/api/events');

      sse.addEventListener('connected', () => setIsServerOnline(true));

      sse.addEventListener('clients-count', (e) => {
        try {
          const { count } = JSON.parse(e.data);
          setActiveClients(count);
        } catch {}
      });

      // Files real-time updates (upload, delete, clear)
      sse.addEventListener('files-updated', (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.files) setGroupFiles(payload.files);
          else fetchGroupFiles();
        } catch {
          fetchGroupFiles();
        }
      });

      // Text real-time updates (new text)
      sse.addEventListener('text-updated', (e) => {
        try {
          const item = JSON.parse(e.data);
          setGroupTexts((prev) => [item, ...prev]);
        } catch {
          fetchGroupTexts();
        }
      });

      // Text updated list (single text deleted)
      sse.addEventListener('text-updated-list', (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.texts) setGroupTexts(payload.texts);
          else fetchGroupTexts();
        } catch {
          fetchGroupTexts();
        }
      });

      // Text cleared for everyone
      sse.addEventListener('text-cleared', () => setGroupTexts([]));

      // Link real-time updates (new link)
      sse.addEventListener('link-updated', (e) => {
        try {
          const item = JSON.parse(e.data);
          setGroupLinks((prev) => [item, ...prev]);
        } catch {
          fetchGroupLinks();
        }
      });

      // Link updated list (single link deleted)
      sse.addEventListener('link-updated-list', (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.links) setGroupLinks(payload.links);
          else fetchGroupLinks();
        } catch {
          fetchGroupLinks();
        }
      });

      // Link cleared for everyone
      sse.addEventListener('link-cleared', () => setGroupLinks([]));

      sse.onerror = () => setIsServerOnline(false);
    } catch {}

    const interval = setInterval(fetchServerInfo, 10000);

    return () => {
      clearInterval(interval);
      if (sse) sse.close();
    };
  }, [fetchServerInfo, fetchGroupFiles, fetchGroupTexts, fetchGroupLinks]);

  // ── Helper to wipe all Private P2P files, texts, and links ────────────────
  const purgePrivateP2pData = useCallback(() => {
    setP2pFiles((prev) => {
      prev.forEach((f) => {
        if (f.url) {
          try { URL.revokeObjectURL(f.url); } catch {}
        }
      });
      return [];
    });
    setP2pTexts([]);
    setP2pLinks([]);
    setIsConnected(false);
    setIsConnecting(false);
    setRemoteCode('');
    setActiveTransfer(null);
    setIsUploading(false);
  }, []);

  // ── 3. Initialize Direct Private P2P WebRTC Manager ───────────────────────
  useEffect(() => {
    const p2p = new P2PManager({
      onReady: ({ code }) => {
        setMyCode(code);

        // Auto-connect if URL has #connect=123456
        if (typeof window !== 'undefined') {
          const hash = window.location.hash;
          const match = hash.match(/#connect=([a-zA-Z0-9]+)/);
          if (match && match[1] && match[1] !== code) {
            setActiveSection('p2p');
            setTimeout(() => p2p.connectToPeer(match[1]), 600);
          }
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
        // As requested: Disconnect hote hi saari private files aur data delete ho jayein!
        purgePrivateP2pData();
      },
      onTextReceived: (textItem) => {
        sound.playSuccess();
        setP2pTexts((prev) => [textItem, ...prev]);
        setActiveSection('p2p');
        setActiveSubTab('text');
      },
      onLinkReceived: (linkItem) => {
        sound.playSuccess();
        setP2pLinks((prev) => [linkItem, ...prev]);
        setActiveSection('p2p');
        setActiveSubTab('links');
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
        sound.playSuccess();
        setP2pFiles((prev) => [newFile, ...prev]);
        setActiveTransfer(null);
        setIsUploading(false);
        setActiveSection('p2p');
        setActiveSubTab('files');
      },
      onTransferCancelled: ({ byRemote }) => {
        sound.playClick();
        setActiveTransfer(null);
        setIsUploading(false);
        alert(byRemote ? 'Transfer cancelled by the other device.' : 'Transfer cancelled.');
      },
      onError: (msg) => {
        setIsConnecting(false);
        alert('Pairing Error: ' + msg);
      },
    });

    p2pRef.current = p2p;

    return () => {
      p2p.destroy();
    };
  }, [purgePrivateP2pData]);

  // ── Manual Disconnect P2P (Immediate file & data purge) ────────────────────
  const handleDisconnectP2P = () => {
    sound.playClick();
    if (p2pRef.current) {
      p2pRef.current.disconnect();
    }
    purgePrivateP2pData();
  };

  // ── 4. Upload Files (Group WiFi vs Private Paired Device) ─────────────────
  const handleSendFiles = async (filesToSend) => {
    if (!filesToSend || filesToSend.length === 0) return;

    if (activeSection === 'group') {
      // ── Group WiFi Upload ──
      setIsUploading(true);
      const formData = new FormData();
      for (const file of filesToSend) {
        formData.append('files', file);
      }
      formData.append('scope', 'group');

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
            const speed = elapsedSec > 0.05 ? e.loaded / elapsedSec : 0;

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
            fetchGroupFiles();
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
          reject(new Error('Network error during transfer'));
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
    } else {
      // ── Private Paired Device Direct Send ──
      if (!p2pRef.current || !isConnected) {
        alert('Pehle 6-digit OTP code ya QR scan se connect / pair karein!');
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
    }
  };

  const handleCancelTransfer = () => {
    if (activeSection === 'group') {
      if (xhrUploadRef.current) {
        xhrUploadRef.current.abort();
        xhrUploadRef.current = null;
      }
      setActiveTransfer(null);
      setIsUploading(false);
      sound.playClick();
    } else {
      if (p2pRef.current) {
        p2pRef.current.cancelTransfer(activeTransfer?.fileId);
        setActiveTransfer(null);
        setIsUploading(false);
      }
    }
  };

  // ── 5. Text and Link Handlers ─────────────────────────────────────────────
  const handleSendText = async (text) => {
    if (activeSection === 'group') {
      try {
        const res = await fetch('/api/text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (res.ok) fetchGroupTexts();
      } catch {}
    } else {
      if (!p2pRef.current || !isConnected) {
        alert('Pehle device ko 6-digit OTP code se pair karein!');
        return;
      }
      p2pRef.current.sendText(text);
      setP2pTexts((prev) => [
        { id: Date.now().toString(), text, isMine: true, timestamp: new Date().toISOString() },
        ...prev,
      ]);
    }
  };

  const handleSendLink = async (url, title) => {
    if (activeSection === 'group') {
      try {
        const res = await fetch('/api/link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, title }),
        });
        if (res.ok) fetchGroupLinks();
      } catch {}
    } else {
      if (!p2pRef.current || !isConnected) {
        alert('Pehle device ko 6-digit OTP code se pair karein!');
        return;
      }
      p2pRef.current.sendLink(url, title);
      setP2pLinks((prev) => [
        { id: Date.now().toString(), url, title, isMine: true, timestamp: new Date().toISOString() },
        ...prev,
      ]);
    }
  };

  // ── 6. Delete and Clear Handlers (Deletes for everyone on the WiFi) ───────
  const handleDeleteFile = async (id) => {
    if (!window.confirm('Delete this file? It will be deleted for everyone on this WiFi.')) return;
    if (activeSection === 'group') {
      try {
        const res = await fetch(`/api/files/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setGroupFiles((prev) => prev.filter((f) => f.id !== id));
        }
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
    if (!window.confirm('Clear all files? They will be deleted for everyone on this WiFi.')) return;
    if (activeSection === 'group') {
      try {
        const res = await fetch('/api/files', { method: 'DELETE' });
        if (res.ok) setGroupFiles([]);
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

  const handleDeleteText = async (id) => {
    if (activeSection === 'group') {
      try {
        const res = await fetch(`/api/text/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setGroupTexts((prev) => prev.filter((t) => t.id !== id));
        }
      } catch {}
    } else {
      setP2pTexts((prev) => prev.filter((t) => t.id !== id));
    }
  };

  const handleClearTexts = async () => {
    if (activeSection === 'group') {
      try {
        const res = await fetch('/api/text', { method: 'DELETE' });
        if (res.ok) setGroupTexts([]);
      } catch {}
    } else {
      setP2pTexts([]);
    }
  };

  const handleDeleteLink = async (id) => {
    if (activeSection === 'group') {
      try {
        const res = await fetch(`/api/link/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setGroupLinks((prev) => prev.filter((l) => l.id !== id));
        }
      } catch {}
    } else {
      setP2pLinks((prev) => prev.filter((l) => l.id !== id));
    }
  };

  const handleClearLinks = async () => {
    if (activeSection === 'group') {
      try {
        const res = await fetch('/api/link', { method: 'DELETE' });
        if (res.ok) setGroupLinks([]);
      } catch {}
    } else {
      setP2pLinks([]);
    }
  };

  const handleDownloadAll = () => {
    if (activeSection === 'group') {
      window.location.href = '/api/download-all';
    } else {
      downloadAllAsZip(p2pFiles);
    }
  };

  const currentFiles = activeSection === 'group' ? groupFiles : p2pFiles;
  const currentTexts = activeSection === 'group' ? groupTexts : p2pTexts;
  const currentLinks = activeSection === 'group' ? groupLinks : p2pLinks;

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
        {/* WiFi Hub Connection Bar */}
        <WifiBar
          serverInfo={serverInfo}
          isServerOnline={isServerOnline}
          activeClients={activeClients}
          onOpenQr={() => setIsQrOpen(true)}
          onRefresh={() => {
            fetchServerInfo();
            fetchGroupFiles();
            fetchGroupTexts();
            fetchGroupLinks();
          }}
        />

        {/* ── 2 Main Section Switcher: Group Data vs Direct Private Pair ─────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}>
          {/* Option 1: Group Data (Default - Same WiFi open to everyone) */}
          <button
            onClick={() => {
              sound.playClick();
              setActiveSection('group');
            }}
            style={{
              padding: '14px 16px',
              borderRadius: 12,
              border: activeSection === 'group' ? '2px solid #BC0202' : '1px solid #cbd5e1',
              backgroundColor: activeSection === 'group' ? '#ffffff' : '#f8fafc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              textAlign: 'left',
              boxShadow: activeSection === 'group' ? '0 4px 16px rgba(188, 2, 2, 0.12)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{
              width: 46,
              height: 46,
              borderRadius: 10,
              backgroundColor: activeSection === 'group' ? '#fee2e2' : '#e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Users size={24} color={activeSection === 'group' ? '#BC0202' : '#64748b'} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: activeSection === 'group' ? '#BC0202' : '#0f172a' }}>
                  👥 Group Data
                </span>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  backgroundColor: '#fee2e2',
                  color: '#BC0202',
                  padding: '2px 7px',
                  borderRadius: 4,
                }}>
                  Default • Sab Ke Liye
                </span>
              </div>
              <div style={{ fontSize: '0.76rem', color: '#64748b', lineHeight: 1.3 }}>
                Same WiFi se koi bhi web khole to direct ye section aayega. Koi bhi upload ya delete kare to sabke paas foran update ho jata hai!
              </div>
            </div>
          </button>

          {/* Option 2: Direct Private Pair (Device OTP & QR Scan) */}
          <button
            onClick={() => {
              sound.playClick();
              setActiveSection('p2p');
            }}
            style={{
              padding: '14px 16px',
              borderRadius: 12,
              border: activeSection === 'p2p' ? '2px solid #BC0202' : '1px solid #cbd5e1',
              backgroundColor: activeSection === 'p2p' ? '#ffffff' : '#f8fafc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              textAlign: 'left',
              boxShadow: activeSection === 'p2p' ? '0 4px 16px rgba(188, 2, 2, 0.12)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{
              width: 46,
              height: 46,
              borderRadius: 10,
              backgroundColor: activeSection === 'p2p' ? '#fee2e2' : '#e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Shield size={24} color={activeSection === 'p2p' ? '#BC0202' : '#64748b'} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: activeSection === 'p2p' ? '#BC0202' : '#0f172a' }}>
                  🔒 Private Pair (Device OTP)
                </span>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  backgroundColor: isConnected ? '#dcfce7' : '#f1f5f9',
                  color: isConnected ? '#166534' : '#475569',
                  padding: '2px 7px',
                  borderRadius: 4,
                }}>
                  {isConnected ? `Connected: ${remoteCode}` : '6-Digit OTP / Scan'}
                </span>
              </div>
              <div style={{ fontSize: '0.76rem', color: '#64748b', lineHeight: 1.3 }}>
                Har device ka alag OTP code. Pair karke sirf us device ko direct file bhej sakte hain (Disconnect hone par files khud delete ho jati hain).
              </div>
            </div>
          </button>
        </div>

        {/* ── If in Private Pair Section: Show Device OTP Bar ────────────────── */}
        {activeSection === 'p2p' && (
          <ConnectionBar
            myCode={myCode}
            remoteCode={remoteCode}
            isConnected={isConnected}
            isConnecting={isConnecting}
            onConnect={(targetCode) => p2pRef.current?.connectToPeer(targetCode)}
            onDisconnect={handleDisconnectP2P}
            onOpenQr={() => setIsQrOpen(true)}
          />
        )}

        {/* ── Sub-Tabs Navigation (Files, Text, Links) ──────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: 8,
          flexWrap: 'wrap',
        }}>
          <button
            onClick={() => {
              sound.playClick();
              setActiveSubTab('files');
            }}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: activeSubTab === 'files' ? '#BC0202' : '#e2e8f0',
              color: activeSubTab === 'files' ? '#ffffff' : '#475569',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <HardDrive size={15} />
            <span>Files ({currentFiles.length})</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveSubTab('text');
            }}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: activeSubTab === 'text' ? '#BC0202' : '#e2e8f0',
              color: activeSubTab === 'text' ? '#ffffff' : '#475569',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <FileText size={15} />
            <span>Text & Notes ({currentTexts.length})</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveSubTab('links');
            }}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: activeSubTab === 'links' ? '#BC0202' : '#e2e8f0',
              color: activeSubTab === 'links' ? '#ffffff' : '#475569',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <Link2 size={15} />
            <span>Links & URLs ({currentLinks.length})</span>
          </button>
        </div>

        {/* ── Active Sub-Tab View ───────────────────────────────────────────── */}
        {activeSubTab === 'files' && (
          <>
            <Dropzone
              mode={activeSection === 'group' ? 'wifi' : 'p2p'}
              scope={activeSection}
              isConnected={activeSection === 'group' ? isServerOnline : isConnected}
              onSendFiles={handleSendFiles}
              isUploading={isUploading}
              onCancelActiveTransfer={handleCancelTransfer}
            />

            <FileList
              files={currentFiles}
              title={activeSection === 'group' ? '👥 Group Shared Files' : '🔒 Private Paired Files'}
              subTitle={
                activeSection === 'group'
                  ? 'Same WiFi par sabhi devices ke sath live shared files (Koi bhi delete karega to sabke paas se delete ho jayegi)'
                  : isConnected
                  ? `Sirf paired device (${remoteCode}) se aayi hui files — Disconnect hone par khud delete ho jayengi`
                  : 'Pehle 6-digit OTP code se device pair karein'
              }
              onDeleteFile={handleDeleteFile}
              onClearAll={handleClearAllFiles}
              onPreviewFile={(file) => setPreviewFile(file)}
              onDownloadAll={handleDownloadAll}
            />
          </>
        )}

        {activeSubTab === 'text' && (
          <TextShare
            isConnected={activeSection === 'group' ? isServerOnline : isConnected}
            onSendText={handleSendText}
            textHistory={currentTexts}
            onDeleteText={handleDeleteText}
            onClearHistory={handleClearTexts}
            title={activeSection === 'group' ? '👥 Group Text & Notes' : '🔒 Private Paired Text'}
            subTitle={
              activeSection === 'group'
                ? 'Same WiFi par sabhi ke sath instant text share karein (Koi bhi delete kare to sabke paas se delete ho jayega)'
                : isConnected
                ? `Direct private messages sirf paired device (${remoteCode}) ko jayenge`
                : 'Pehle 6-digit OTP code se device pair karein'
            }
          />
        )}

        {activeSubTab === 'links' && (
          <LinkShare
            isConnected={activeSection === 'group' ? isServerOnline : isConnected}
            onSendLink={handleSendLink}
            linkHistory={currentLinks}
            onDeleteLink={handleDeleteLink}
            onClearHistory={handleClearLinks}
            title={activeSection === 'group' ? '👥 Group Links & URLs' : '🔒 Private Paired Links'}
            subTitle={
              activeSection === 'group'
                ? 'Same WiFi par websites ya links share karein (Koi bhi delete kare to sabke paas se delete ho jayega)'
                : isConnected
                ? `Direct private links sirf paired device (${remoteCode}) ko jayenge`
                : 'Pehle 6-digit OTP code se device pair karein'
            }
          />
        )}
      </main>

      {/* Floating Transfer Progress Card (Speed Monitor with MB/s & Cancel) */}
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
            <span>• Same WiFi Group Sharing & Private OTP Pairing</span>
          </div>
          <div>
            <span>Real-time Group Sync & Auto-Purge on Disconnect</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <QrModal
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        myCode={myCode}
        targetUrl={
          serverInfo?.networkUrl
            ? `${serverInfo.networkUrl}/#connect=${myCode || ''}`
            : null
        }
        onConnectCode={(targetCode) => {
          setActiveSection('p2p');
          p2pRef.current?.connectToPeer(targetCode);
        }}
        title="Pair Devices (OTP & QR Scan)"
        subtext="Har device ka alag OTP code hai. Code likhein ya camera se QR scan karke connect karein!"
      />

      <PreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  );
}
