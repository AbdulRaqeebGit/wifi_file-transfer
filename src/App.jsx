import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
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
import { Radio } from 'lucide-react';

export default function App() {
  const [myCode, setMyCode] = useState('');
  const [remoteCode, setRemoteCode] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const [activeTab, setActiveTab] = useState('files');
  const [files, setFiles] = useState([]);
  const [textHistory, setTextHistory] = useState([]);
  const [linkHistory, setLinkHistory] = useState([]);

  const [isQrOpen, setIsQrOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTransfer, setActiveTransfer] = useState(null);

  const p2pRef = useRef(null);

  // Initialize P2P WebRTC Manager
  useEffect(() => {
    const p2p = new P2PManager({
      onReady: ({ code }) => {
        setMyCode(code);

        // If opened from phone QR code link: #connect=123456
        const hash = window.location.hash;
        const match = hash.match(/#connect=([a-zA-Z0-9]+)/);
        if (match && match[1] && match[1] !== code) {
          setTimeout(() => {
            p2p.connectToPeer(match[1]);
          }, 600);
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
        setTextHistory((prev) => [textItem, ...prev]);
        setActiveTab('text');
      },
      onLinkReceived: (linkItem) => {
        sound.playSuccess();
        setLinkHistory((prev) => [linkItem, ...prev]);
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
        sound.playSuccess();
        setFiles((prev) => [newFile, ...prev]);
        setActiveTransfer(null);
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
        alert('Connection error: ' + msg);
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

  const handleSendBatchFiles = async (filesToSend) => {
    if (!p2pRef.current || !isConnected) {
      alert('Please connect to a device with code first!');
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

  const handleCancelTransfer = (fileId) => {
    if (p2pRef.current) {
      p2pRef.current.cancelTransfer(fileId);
      setActiveTransfer(null);
      setIsUploading(false);
    }
  };

  const handleSendText = (text) => {
    if (p2pRef.current && isConnected) {
      p2pRef.current.sendText(text);
      setTextHistory((prev) => [
        { id: Date.now().toString(), text, isMine: true, timestamp: new Date().toISOString() },
        ...prev,
      ]);
    }
  };

  const handleSendLink = (url, title) => {
    if (p2pRef.current && isConnected) {
      p2pRef.current.sendLink(url, title);
      setLinkHistory((prev) => [
        { id: Date.now().toString(), url, title, isMine: true, timestamp: new Date().toISOString() },
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', width: '100%', overflowX: 'hidden' }}>
      {/* Top Navbar */}
      <Navbar
        isConnected={isConnected}
        remoteCode={remoteCode}
        totalFiles={files.length}
        onOpenQr={() => setIsQrOpen(true)}
        onDownloadAll={handleDownloadAll}
      />

      {/* Main Container */}
      <main style={{ maxWidth: 1100, width: '100%', margin: '0 auto', padding: '16px 14px', flex: 1, boxSizing: 'border-box' }}>
        {/* Simple Header */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 6,
            backgroundColor: isConnected ? '#dcfce7' : isConnecting ? '#fef3c7' : '#fee2e2',
            border: `1px solid ${isConnected ? '#86efac' : isConnecting ? '#fde68a' : '#fca5a5'}`,
            color: isConnected ? '#166534' : isConnecting ? '#92400e' : '#BC0202',
            fontSize: '0.76rem',
            fontWeight: 700,
            marginBottom: 8,
          }}>
            <Radio size={13} color={isConnected ? '#166534' : isConnecting ? '#92400e' : '#BC0202'} />
            <span>
              {isConnected
                ? `🟢 CONNECTED WITH DEVICE: ${remoteCode}`
                : isConnecting
                ? `🟡 CONNECTING TO ${remoteCode}...`
                : '🔴 NOT CONNECTED • ENTER CODE BELOW TO PAIR'}
            </span>
          </div>

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
            maxWidth: 580,
            margin: '0 auto',
            lineHeight: 1.4,
          }}>
            Direct device-to-device transfer. Enter the 6-digit code or scan QR code to pair!
          </p>
        </div>

        {/* Pairing Bar */}
        <ConnectionBar
          myCode={myCode}
          remoteCode={remoteCode}
          isConnected={isConnected}
          isConnecting={isConnecting}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onOpenQr={() => setIsQrOpen(true)}
        />

        {/* Mode Switcher Tabs */}
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
            {files.length > 0 && (
              <span style={{
                backgroundColor: activeTab === 'files' ? '#ffffff' : '#fee2e2',
                color: '#BC0202',
                padding: '1px 5px',
                borderRadius: 4,
                fontSize: '0.7rem',
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
            {textHistory.length > 0 && (
              <span style={{
                backgroundColor: activeTab === 'text' ? '#ffffff' : '#fee2e2',
                color: '#BC0202',
                padding: '1px 5px',
                borderRadius: 4,
                fontSize: '0.7rem',
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
            {linkHistory.length > 0 && (
              <span style={{
                backgroundColor: activeTab === 'links' ? '#ffffff' : '#fee2e2',
                color: '#BC0202',
                padding: '1px 5px',
                borderRadius: 4,
                fontSize: '0.7rem',
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
              onSendFiles={handleSendBatchFiles}
              isUploading={isUploading}
              onCancelActiveTransfer={() => handleCancelTransfer(activeTransfer?.fileId)}
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
            <span>• GitHub Pages Ready & P2P Direct WebRTC Transfer</span>
          </div>
          <div>
            <span>Direct Encrypted P2P DataChannel • 5GB+ Supported</span>
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
