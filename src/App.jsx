import React, { useState, useEffect, useRef, useCallback } from 'react';
import Navbar from './components/Navbar';
import ConnectionBar from './components/ConnectionBar';
import Dropzone from './components/Dropzone';
import TextShare from './components/TextShare';
import LinkShare from './components/LinkShare';
import FileList from './components/FileList';
import QrModal from './components/QrModal';
import PreviewModal from './components/PreviewModal';
import { P2PManager } from './utils/p2p';
import { downloadAllAsZip } from './utils/zip';
import { formatBytes } from './utils/formatters';
import { sound } from './utils/sound';
import { HardDrive, Smartphone, Zap, Radio, Globe } from 'lucide-react';

export default function App() {
  const [myCode, setMyCode] = useState('');
  const [remoteCode, setRemoteCode] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('files'); // 'files' | 'text' | 'links'

  const [files, setFiles] = useState([]);
  const [textHistory, setTextHistory] = useState([]);
  const [linkHistory, setLinkHistory] = useState([]);

  const [isQrOpen, setIsQrOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  const p2pRef = useRef(null);

  // Initialize WebRTC P2P Manager
  useEffect(() => {
    const p2p = new P2PManager({
      onReady: ({ code }) => {
        setMyCode(code);

        // Check if opened via QR code with #connect=XXXXXX
        const hash = window.location.hash;
        const match = hash.match(/#connect=([a-zA-Z0-9]+)/);
        if (match && match[1] && match[1] !== code) {
          setTimeout(() => {
            p2p.connectToPeer(match[1]);
          }, 800);
        }
      },
      onConnected: ({ remoteCode }) => {
        setIsConnected(true);
        setRemoteCode(remoteCode);
        sound.playSuccess();
      },
      onDisconnected: () => {
        setIsConnected(false);
        setRemoteCode('');
      },
      onTextReceived: (textItem) => {
        sound.playSuccess();
        setTextHistory((prev) => [textItem, ...prev]);
        setActiveTab('text');
      },
      onLinkReceived: (linkItem) => {
        sound.playSuccess();
        setLinkHistory((prev) => [linkItem, ...prev]);
        setActiveTab('links');
      },
      onFileReceived: (newFile) => {
        sound.playSuccess();
        setFiles((prev) => [newFile, ...prev]);
        setActiveTab('files');
      },
      onError: (msg) => {
        console.warn('P2P Alert:', msg);
      },
    });

    p2pRef.current = p2p;

    return () => {
      p2p.destroy();
    };
  }, []);

  const handleConnect = (targetCode) => {
    if (p2pRef.current) {
      p2pRef.current.connectToPeer(targetCode);
    }
  };

  const handleDisconnect = () => {
    if (p2pRef.current) {
      p2pRef.current.disconnect();
    }
  };

  const handleSendFiles = async (file, onProgress) => {
    if (p2pRef.current) {
      await p2pRef.current.sendFile(file, onProgress);
    }
  };

  const handleSendText = (text) => {
    if (p2pRef.current) {
      p2pRef.current.sendText(text);
      setTextHistory((prev) => [
        {
          id: Date.now().toString(),
          text,
          isMine: true,
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
  };

  const handleSendLink = (url, title) => {
    if (p2pRef.current) {
      p2pRef.current.sendLink(url, title);
      setLinkHistory((prev) => [
        {
          id: Date.now().toString(),
          url,
          title,
          isMine: true,
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
  };

  const handleDeleteFile = (id) => {
    if (!window.confirm('Delete this received file from memory?')) return;
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleClearAll = () => {
    if (!window.confirm('Clear all received files?')) return;
    setFiles([]);
  };

  const handleDownloadAll = () => {
    downloadAllAsZip(files);
  };

  const totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
      {/* Top Navbar */}
      <Navbar
        myCode={myCode}
        isConnected={isConnected}
        remoteCode={remoteCode}
        totalFiles={files.length}
        onOpenQr={() => setIsQrOpen(true)}
        onDownloadAll={handleDownloadAll}
      />

      {/* Main Container */}
      <main style={{ maxWidth: 1200, width: '100%', margin: '0 auto', padding: '24px 20px', flex: 1 }}>
        {/* Simple Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 14px',
            borderRadius: 6,
            backgroundColor: '#fee2e2',
            border: '1px solid #fca5a5',
            color: '#BC0202',
            fontSize: '0.8rem',
            fontWeight: 700,
            marginBottom: 10,
          }}>
            <Radio size={14} color="#BC0202" />
            <span>P2P WEBRTC DIRECT LOCAL & NETWORK TRANSFER</span>
          </div>

          <h2 style={{
            fontSize: 'clamp(1.7rem, 3.6vw, 2.4rem)',
            fontWeight: 800,
            letterSpacing: '-0.5px',
            margin: '0 0 8px',
            color: '#0f172a',
          }}>
            Transfer <span style={{ color: '#BC0202' }}>Files, Text & Links</span> Anywhere
          </h2>

          <p style={{
            fontSize: '0.94rem',
            color: '#64748b',
            maxWidth: 620,
            margin: '0 auto',
            lineHeight: 1.5,
          }}>
            Works over Same Wi-Fi, Mobile Hotspot, or Mobile Data. Ready to host on GitHub Pages without any backend server!
          </p>
        </div>

        {/* Pairing Bar */}
        <ConnectionBar
          myCode={myCode}
          remoteCode={remoteCode}
          isConnected={isConnected}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onOpenQr={() => setIsQrOpen(true)}
        />

        {/* Mode Switcher Tabs (Files, Text, Links) */}
        <div style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: 8,
        }}>
          <button
            onClick={() => setActiveTab('files')}
            style={{
              backgroundColor: activeTab === 'files' ? '#BC0202' : '#ffffff',
              color: activeTab === 'files' ? '#ffffff' : '#475569',
              border: activeTab === 'files' ? '1px solid #BC0202' : '1px solid #cbd5e1',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: '0.86rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>📁 Files Transfer</span>
            {files.length > 0 && (
              <span style={{
                backgroundColor: activeTab === 'files' ? '#ffffff' : '#fee2e2',
                color: activeTab === 'files' ? '#BC0202' : '#BC0202',
                padding: '1px 6px',
                borderRadius: 4,
                fontSize: '0.72rem',
              }}>
                {files.length}
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
              padding: '8px 16px',
              fontSize: '0.86rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>💬 Send Text / Notes</span>
            {textHistory.length > 0 && (
              <span style={{
                backgroundColor: activeTab === 'text' ? '#ffffff' : '#fee2e2',
                color: activeTab === 'text' ? '#BC0202' : '#BC0202',
                padding: '1px 6px',
                borderRadius: 4,
                fontSize: '0.72rem',
              }}>
                {textHistory.length}
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
              padding: '8px 16px',
              fontSize: '0.86rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>🔗 Send Links / URLs</span>
            {linkHistory.length > 0 && (
              <span style={{
                backgroundColor: activeTab === 'links' ? '#ffffff' : '#fee2e2',
                color: activeTab === 'links' ? '#BC0202' : '#BC0202',
                padding: '1px 6px',
                borderRadius: 4,
                fontSize: '0.72rem',
              }}>
                {linkHistory.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Contents */}
        {activeTab === 'files' && (
          <>
            <Dropzone
              isConnected={isConnected}
              onSendFiles={handleSendFiles}
            />

            <FileList
              files={files}
              onDeleteFile={handleDeleteFile}
              onClearAll={handleClearAll}
              onPreviewFile={(file) => setPreviewFile(file)}
              onDownloadAll={handleDownloadAll}
            />
          </>
        )}

        {activeTab === 'text' && (
          <TextShare
            isConnected={isConnected}
            onSendText={handleSendText}
            textHistory={textHistory}
            onClearHistory={() => setTextHistory([])}
          />
        )}

        {activeTab === 'links' && (
          <LinkShare
            isConnected={isConnected}
            onSendLink={handleSendLink}
            linkHistory={linkHistory}
            onClearHistory={() => setLinkHistory([])}
          />
        )}
      </main>

      {/* Clean Footer */}
      <footer style={{
        marginTop: 'auto',
        borderTop: '1px solid #e2e8f0',
        padding: '20px',
        textAlign: 'center',
        backgroundColor: '#ffffff',
        fontSize: '0.82rem',
        color: '#64748b',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 800, color: '#BC0202' }}>AR | WiFi | TR</span>
            <span>• GitHub Pages Ready & P2P Direct WebRTC Transfer</span>
          </div>
          <div>
            <span>No Server Required • Direct Device-to-Device Encrypted DataChannel</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <QrModal
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        myCode={myCode}
      />

      <PreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  );
}
