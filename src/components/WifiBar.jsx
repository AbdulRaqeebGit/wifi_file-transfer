import React, { useState } from 'react';
import { Wifi, Copy, Check, QrCode, Users, HelpCircle, RefreshCw, Globe, Sparkles } from 'lucide-react';
import { sound } from '../utils/sound';

export default function WifiBar({
  serverInfo,
  isServerOnline,
  activeClients,
  onOpenQr,
  onRefresh,
}) {
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const networkUrl = serverInfo?.networkUrl || `http://${window.location.hostname}:5000`;

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
            width: 42,
            height: 42,
            borderRadius: 8,
            backgroundColor: isServerOnline ? '#dcfce7' : '#fee2e2',
            border: `1px solid ${isServerOnline ? '#86efac' : '#fca5a5'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Wifi size={22} color={isServerOnline ? '#166534' : '#BC0202'} />
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontSize: '0.72rem',
                color: isServerOnline ? '#166534' : '#991b1b',
                fontWeight: 700,
                textTransform: 'uppercase',
                backgroundColor: isServerOnline ? '#dcfce7' : '#fee2e2',
                padding: '1px 6px',
                borderRadius: 4,
              }}>
                {isServerOnline ? '🟢 WiFi Hub Active (No Code Needed)' : '🔴 Hub Disconnected'}
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
                  <strong>{activeClients}</strong> {activeClients === 1 ? 'device' : 'devices'}
                </span>
              )}
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
                title="Copy WiFi URL"
              >
                {copied ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy Link'}</span>
              </button>

              <button
                onClick={() => {
                  sound.playClick();
                  onOpenQr();
                }}
                className="btn-secondary"
                style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                title="Scan QR Code from Phone"
              >
                <QrCode size={13} color="#BC0202" />
                <span>Scan QR</span>
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
            title="Refresh WiFi files"
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
            title="How Same WiFi works?"
          >
            <HelpCircle size={14} color="#BC0202" />
            <span>Same WiFi Guide</span>
          </button>
        </div>
      </div>

      {/* Same WiFi Guide */}
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
            <strong>Bina Code Ke Same WiFi Transfer Kaise Kaam Karta Hai?</strong>
          </div>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            <li><strong>Kisi code ki zaroorat nahi hai:</strong> Jab dono devices (laptop aur mobile) same WiFi / Hotspot se connected hon.</li>
            <li><strong>Mobile par open karein:</strong> Phone camera se <strong>"Scan QR"</strong> button dabakar QR scan karein ya browser mein <code>{networkUrl}</code> kholein.</li>
            <li><strong>Pehle Upload, Phir Download:</strong> File pehle poori upload hogi (0% to 100%), upload mukammal hone ke baad hi doosre device par "Download" ka button aayega.</li>
            <li><strong>Ultra-Fast IDM Speed:</strong> HTTP Range support ke sath downloading super fast download manager speed se hoti hai!</li>
          </ul>
        </div>
      )}
    </div>
  );
}
