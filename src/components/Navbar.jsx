import React from 'react';
import { Wifi, QrCode, Download, Volume2, VolumeX, ShieldCheck } from 'lucide-react';
import { sound } from '../utils/sound';

export default function Navbar({
  transferMode = 'wifi',
  isServerOnline = true,
  isConnected = false,
  remoteCode = '',
  totalFiles = 0,
  onOpenQr,
  onDownloadAll,
}) {
  const [soundEnabled, setSoundEnabled] = React.useState(true);

  const toggleSound = () => {
    sound.enabled = !soundEnabled;
    setSoundEnabled(!soundEnabled);
    if (!soundEnabled) sound.playClick();
  };

  const isOnline = transferMode === 'wifi' ? isServerOnline : isConnected;

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      backgroundColor: '#ffffff',
      borderBottom: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
      padding: '12px 16px',
    }}>
      <div
        className="responsive-header"
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            position: 'relative',
            width: 38,
            height: 38,
            borderRadius: 8,
            backgroundColor: '#BC0202',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Wifi size={20} color="#ffffff" />
            <div style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: isOnline ? '#22c55e' : '#FF0000',
              border: '2px solid #ffffff',
            }} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <h1 style={{
                fontSize: '1.2rem',
                fontWeight: 800,
                letterSpacing: '0.5px',
                fontFamily: 'var(--font-sans)',
                color: '#BC0202',
                margin: 0,
                lineHeight: 1.1,
              }}>
                AR | WiFi | TR
              </h1>
              <span style={{
                backgroundColor: isOnline ? '#dcfce7' : '#fee2e2',
                color: isOnline ? '#166534' : '#BC0202',
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 4,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
              }}>
                {transferMode === 'wifi'
                  ? isServerOnline
                    ? 'Same WiFi Hub'
                    : 'WiFi Offline'
                  : isConnected
                  ? `Paired: ${remoteCode}`
                  : 'WebRTC P2P'}
              </span>
            </div>
            <p style={{
              fontSize: '0.74rem',
              color: 'var(--text-muted)',
              margin: '2px 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: isOnline ? '#16a34a' : '#f59e0b',
                display: 'inline-block',
              }} />
              {transferMode === 'wifi'
                ? 'Local WiFi Network • No Code Required'
                : isConnected
                ? `Paired with ${remoteCode}`
                : 'Direct P2P • Enter 6-Digit Code'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div
          className="responsive-header-actions"
          style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
        >
          {/* QR Code button */}
          <button
            onClick={() => {
              sound.playClick();
              onOpenQr();
            }}
            className="btn-secondary"
            style={{
              padding: '7px 12px',
              fontSize: '0.8rem',
            }}
          >
            <QrCode size={15} color="#BC0202" />
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
              padding: '7px 14px',
              fontSize: '0.8rem',
            }}
            title={totalFiles === 0 ? 'No files to download' : 'Download all files'}
          >
            <Download size={14} />
            <span>ZIP All ({totalFiles})</span>
          </button>

          {/* Audio toggle button */}
          <button
            onClick={toggleSound}
            className="btn-secondary"
            style={{ padding: '7px 9px', borderRadius: 6 }}
            title={soundEnabled ? 'Mute sound' : 'Unmute sound'}
          >
            {soundEnabled ? <Volume2 size={15} color="#BC0202" /> : <VolumeX size={15} color="var(--text-dim)" />}
          </button>
        </div>
      </div>
    </header>
  );
}
