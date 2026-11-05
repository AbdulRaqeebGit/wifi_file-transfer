import React, { useState } from 'react';
import { Wifi, Copy, Check, QrCode, Users, HelpCircle, RefreshCw, Sparkles, CloudCheck, HardDrive } from 'lucide-react';
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
                {isServerOnline ? '🟢 Open WiFi Cloud (No Code / Offline Ready)' : '🔴 Cloud Disconnected'}
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
            title="Sync files"
          >
            <RefreshCw size={13} />
            <span>Sync Files</span>
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
            title="How Open WiFi Cloud works?"
          >
            <HelpCircle size={14} color="#BC0202" />
            <span>Kaise Kaam Karta Hai?</span>
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
            <strong>Open WiFi Cloud — Kisi Code Ya User Ke Online Huye Bager:</strong>
          </div>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            <li><strong>User ka online hona zaroori nahi:</strong> Aap abhi file upload kar dein. File permanent disk par save ho jati hai. Doosra banda chahe 2 ghante baad aaye, usay file foran mil jayegi.</li>
            <li><strong>Koi code ya link bejne ki zaroorat nahi:</strong> Jo bhi is WiFi se connect hoga aur browser mein <code>{networkUrl}</code> kholega, usay saari files seedhi nazar aayengi.</li>
            <li><strong>Pehle Upload, Phir Download:</strong> File pehle poori upload hogi (0% to 100%). Upload complete hote hi sabhi devices par <strong>"Download"</strong> ka button unlock ho jayega!</li>
            <li><strong>IDM & Multi-Thread Speed:</strong> HTTP Range resume support ke sath downloading full speed se hoti hai!</li>
          </ul>
        </div>
      )}
    </div>
  );
}
