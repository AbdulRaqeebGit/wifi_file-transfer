import React, { useState } from 'react';
import { Wifi, Copy, Check, QrCode, Users, HelpCircle, RefreshCw, Sparkles, HardDrive, Zap } from 'lucide-react';
import { sound } from '../utils/sound';

export default function WifiBar({
  serverInfo,
  isServerOnline = true,
  activeClients = 0,
  onOpenQr,
  onRefresh,
}) {
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Derive a clean, reliable WiFi address
  const networkUrl =
    serverInfo?.networkUrl ||
    (typeof window !== 'undefined'
      ? window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? `http://localhost:${serverInfo?.port || 5000}`
        : window.location.origin
      : 'http://localhost:5000');

  const handleCopyUrl = () => {
    if (networkUrl) {
      navigator.clipboard.writeText(networkUrl);
      setCopied(true);
      sound.playClick();
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="clean-card" style={{ padding: '16px', backgroundColor: '#ffffff', marginBottom: 20 }}>
      <div
        className="responsive-connection-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        {/* Left: WiFi Hub Status & Network Address */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            backgroundColor: isServerOnline ? '#dcfce7' : '#fee2e2',
            border: `1px solid ${isServerOnline ? '#86efac' : '#fca5a5'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <HardDrive size={22} color={isServerOnline ? '#166534' : '#BC0202'} />
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '0.72rem',
                color: isServerOnline ? '#166534' : '#991b1b',
                fontWeight: 700,
                textTransform: 'uppercase',
                backgroundColor: isServerOnline ? '#dcfce7' : '#fee2e2',
                padding: '2px 8px',
                borderRadius: 4,
              }}>
                {isServerOnline ? '🟢 Same WiFi Hub (No Code / Direct Access)' : '🔴 Server Offline'}
              </span>

              {activeClients > 0 && (
                <span style={{
                  fontSize: '0.72rem',
                  color: '#475569',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}>
                  <Users size={12} color="#BC0202" />
                  <strong>{activeClients}</strong> {activeClients === 1 ? 'device online' : 'devices online'}
                </span>
              )}

              <span style={{
                fontSize: '0.72rem',
                color: '#166534',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                padding: '2px 6px',
                borderRadius: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontWeight: 600,
              }}>
                <Zap size={11} color="#16a34a" /> 1MB Chunk High-Speed
              </span>
            </div>

            {/* Network URL */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.96rem',
                fontWeight: 700,
                color: '#BC0202',
                backgroundColor: '#f8fafc',
                padding: '3px 8px',
                borderRadius: 6,
                border: '1px solid #e2e8f0',
              }}>
                {networkUrl}
              </span>

              <button
                onClick={handleCopyUrl}
                style={{
                  background: 'none',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  padding: '3px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: '0.74rem',
                  color: '#475569',
                }}
                title="Copy WiFi Website URL"
              >
                {copied ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy Web Link'}</span>
              </button>

              <button
                onClick={() => {
                  sound.playClick();
                  onOpenQr();
                }}
                className="btn-secondary"
                style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                title="Scan QR Code from Mobile"
              >
                <QrCode size={13} color="#BC0202" />
                <span>Phone Connect</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Quick actions & help */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              sound.playClick();
              onRefresh();
            }}
            className="btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.76rem' }}
            title="Sync Data"
          >
            <RefreshCw size={13} />
            <span>Sync</span>
          </button>

          <button
            onClick={() => setShowHelp(!showHelp)}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '0.76rem',
              padding: '6px 8px',
            }}
            title="How it works?"
          >
            <HelpCircle size={14} color="#BC0202" />
            <span>Help Guide</span>
          </button>
        </div>
      </div>

      {/* Guide Dropdown */}
      {showHelp && (
        <div style={{
          marginTop: 12,
          padding: '12px 14px',
          backgroundColor: '#fff5f5',
          border: '1px solid #fca5a5',
          borderRadius: 8,
          fontSize: '0.82rem',
          color: '#830000',
          lineHeight: 1.5,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Sparkles size={14} color="#BC0202" />
            <strong>Same WiFi File Sharing — Direct & High Speed:</strong>
          </div>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            <li><strong>👥 Group Data (Direct WiFi):</strong> Koi bhi same WiFi se web kholega to direct group section samne aayega. Bina kisi link ya code ke direct upload karein, sabko real-time nazar aayega!</li>
            <li><strong>🔒 Private Data:</strong> Sirf aapke is device ke liye private room jahan aap files, texts aur links save kar sakte hain jo group mein kisi ko nahi dikhenge.</li>
            <li><strong>🚀 High Speed:</strong> Direct streaming with 1MB highWaterMark chunk buffer and HTTP Range support. Downloads maximum WiFi speed par direct stream hongi!</li>
          </ul>
        </div>
      )}
    </div>
  );
}
