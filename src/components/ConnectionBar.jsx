import React, { useState } from 'react';
import { Smartphone, Link, Check, Copy, QrCode, PowerOff, HelpCircle } from 'lucide-react';
import { sound } from '../utils/sound';

export default function ConnectionBar({
  myCode,
  remoteCode,
  isConnected,
  onConnect,
  onDisconnect,
  onOpenQr,
}) {
  const [targetInput, setTargetInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [showWifiHelp, setShowWifiHelp] = useState(false);

  const handleCopyCode = () => {
    if (myCode) {
      navigator.clipboard.writeText(myCode);
      setCopied(true);
      sound.playClick();
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConnectSubmit = (e) => {
    e.preventDefault();
    if (!targetInput.trim()) return;
    sound.playClick();
    onConnect(targetInput.trim());
    setTargetInput('');
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
        {/* Left: My Device Code */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            backgroundColor: isConnected ? '#dcfce7' : '#fee2e2',
            border: `1px solid ${isConnected ? '#86efac' : '#fca5a5'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Smartphone size={20} color={isConnected ? '#166534' : '#BC0202'} />
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              My Device Code
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '1.15rem',
                fontWeight: 800,
                color: '#BC0202',
                letterSpacing: '1px',
              }}>
                {myCode || 'Connecting...'}
              </span>

              <button
                onClick={handleCopyCode}
                style={{
                  background: 'none',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  padding: '3px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: '0.72rem',
                  color: '#475569',
                }}
                title="Copy code"
              >
                {copied ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                onClick={() => {
                  sound.playClick();
                  onOpenQr();
                }}
                className="btn-secondary"
                style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                title="Scan QR Code from Phone"
              >
                <QrCode size={12} color="#BC0202" />
                <span>QR Code</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Connection Status & Form */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', width: '100%', maxWidth: 'fit-content' }}>
          {isConnected ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              backgroundColor: '#dcfce7',
              border: '1px solid #86efac',
              borderRadius: 8,
              padding: '6px 12px',
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: '#16a34a',
                }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#166534' }}>
                  Connected: <span style={{ fontFamily: 'var(--font-mono)' }}>{remoteCode}</span>
                </span>
              </div>

              <button
                onClick={() => {
                  sound.playClick();
                  onDisconnect();
                }}
                className="btn-danger"
                style={{ padding: '4px 8px', fontSize: '0.74rem' }}
              >
                <PowerOff size={12} />
                <span>Disconnect</span>
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleConnectSubmit}
              className="responsive-connect-form"
              style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
            >
              <input
                type="text"
                placeholder="Enter 6-digit Code"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                maxLength={10}
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  padding: '7px 10px',
                  fontSize: '0.86rem',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                  flex: '1 1 150px',
                  minWidth: 140,
                }}
              />
              <button
                type="submit"
                disabled={!targetInput.trim()}
                className="btn-primary"
                style={{ padding: '7px 14px', fontSize: '0.82rem' }}
              >
                <Link size={13} />
                <span>Pair</span>
              </button>
            </form>
          )}

          {/* Wi-Fi Guide Toggle */}
          <button
            onClick={() => setShowWifiHelp(!showWifiHelp)}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontSize: '0.76rem',
              padding: '4px',
            }}
            title="What if Laptop Wi-Fi is OFF?"
          >
            <HelpCircle size={14} color="#BC0202" />
            <span>Wi-Fi Guide</span>
          </button>
        </div>
      </div>

      {/* Wi-Fi Help Alert */}
      {showWifiHelp && (
        <div style={{
          marginTop: 12,
          padding: '10px 14px',
          backgroundColor: '#fff5f5',
          border: '1px solid #fca5a5',
          borderRadius: 8,
          fontSize: '0.8rem',
          color: '#830000',
          lineHeight: 1.5,
        }}>
          <strong>💡 Agar Laptop ka Wi-Fi band ho to kya karein?</strong>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            <li><strong>Option 1 (Mobile Hotspot):</strong> Phone ka Personal Hotspot on karein aur Laptop ko connect karein — transfer bina router ke foran hoga!</li>
            <li><strong>Option 2 (Mobile Data / Cross Network):</strong> Agar phone mobile data (4G/5G) par ho aur laptop kisi dusre internet par ho, tab bhi direct transfer hoga!</li>
            <li><strong>Option 3 (Laptop Hotspot):</strong> Windows Settings mein jaa kar "Mobile Hotspot" on karein aur phone connect karein.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
