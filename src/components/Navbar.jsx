import React from 'react';
import { Wifi, QrCode, Download, Volume2, VolumeX, Smartphone } from 'lucide-react';
import { sound } from '../utils/sound';

export default function Navbar({
  myCode,
  isConnected,
  remoteCode,
  totalFiles,
  onOpenQr,
  onDownloadAll,
}) {
  const [soundEnabled, setSoundEnabled] = React.useState(true);

  const toggleSound = () => {
    sound.enabled = !soundEnabled;
    setSoundEnabled(!soundEnabled);
    if (!soundEnabled) sound.playClick();
  };

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      backgroundColor: '#ffffff',
      borderBottom: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
      padding: '14px 24px',
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            position: 'relative',
            width: 42,
            height: 42,
            borderRadius: 10,
            backgroundColor: '#BC0202',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Wifi size={22} color="#ffffff" />
            <div style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: isConnected ? '#22c55e' : '#FF0000',
              border: '2px solid #ffffff',
            }} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{
                fontSize: '1.35rem',
                fontWeight: 800,
                letterSpacing: '1px',
                fontFamily: 'var(--font-sans)',
                color: '#BC0202',
                margin: 0,
              }}>
                AR | WiFi | TR
              </h1>
              <span style={{
                backgroundColor: isConnected ? '#dcfce7' : '#fee2e2',
                color: isConnected ? '#166534' : '#BC0202',
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 6,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
              }}>
                {isConnected ? `Connected: ${remoteCode}` : 'WebRTC P2P'}
              </span>
            </div>
            <p style={{
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              margin: '2px 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: isConnected ? '#16a34a' : '#f59e0b',
                display: 'inline-block',
              }} />
              {isConnected ? 'Device Paired & Ready' : 'WiFi / Hotspot / Data Direct Transfer'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* QR Code button */}
          <button
            onClick={() => {
              sound.playClick();
              onOpenQr();
            }}
            className="btn-secondary"
            style={{
              padding: '8px 14px',
              fontSize: '0.84rem',
            }}
          >
            <QrCode size={16} color="#BC0202" />
            <span>Connect Phone</span>
          </button>

          {/* Download All (ZIP) button */}
          <button
            onClick={() => {
              sound.playClick();
              onDownloadAll();
            }}
            disabled={totalFiles === 0}
            className="btn-primary"
            style={{
              padding: '8px 18px',
              fontSize: '0.86rem',
            }}
            title={totalFiles === 0 ? 'No files to download' : 'Download all received files as a ZIP archive'}
          >
            <Download size={15} />
            <span>Download All ({totalFiles})</span>
          </button>

          {/* Audio toggle button */}
          <button
            onClick={toggleSound}
            className="btn-secondary"
            style={{ padding: '8px 10px', borderRadius: 8 }}
            title={soundEnabled ? 'Mute sound effects' : 'Unmute sound effects'}
          >
            {soundEnabled ? <Volume2 size={16} color="#BC0202" /> : <VolumeX size={16} color="var(--text-dim)" />}
          </button>
        </div>
      </div>
    </header>
  );
}
