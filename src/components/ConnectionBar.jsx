import React, { useState } from 'react';
import { Smartphone, Wifi, Link, Check, Copy, QrCode, PowerOff, ShieldCheck, HelpCircle } from 'lucide-react';
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
    <div className="clean-card" style={{ padding: '18px 24px', backgroundColor: '#ffffff', marginBottom: 24 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        {/* Left: My Device Code */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            backgroundColor: isConnected ? '#dcfce7' : '#fee2e2',
            border: `1px solid ${isConnected ? '#86efac' : '#fca5a5'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Smartphone size={22} color={isConnected ? '#166534' : '#BC0202'} />
          </div>

          <div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              My Device Code
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '1.2rem',
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
                  gap: 4,
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
                <QrCode size={13} color="#BC0202" />
                <span>QR Code</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Connection Status & Form */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {isConnected ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              backgroundColor: '#dcfce7',
              border: '1px solid #86efac',
              borderRadius: 10,
              padding: '8px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#16a34a',
                }} />
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#166534' }}>
                  Connected with: <span style={{ fontFamily: 'var(--font-mono)' }}>{remoteCode}</span>
                </span>
              </div>

              <button
                onClick={() => {
                  sound.playClick();
                  onDisconnect();
                }}
                className="btn-danger"
                style={{ padding: '4px 10px', fontSize: '0.76rem' }}
              >
                <PowerOff size={13} />
                <span>Disconnect</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleConnectSubmit} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="text"
                placeholder="Enter 6-digit Device Code"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                maxLength={10}
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: '0.86rem',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                  width: 190,
                }}
              />
              <button
                type="submit"
                disabled={!targetInput.trim()}
                className="btn-primary"
                style={{ padding: '8px 16px', fontSize: '0.84rem' }}
              >
                <Link size={14} />
                <span>Pair / Connect</span>
              </button>
            </form>
          )}

          {/* Wi-Fi disconnect tip toggle */}
          <button
            onClick={() => setShowWifiHelp(!showWifiHelp)}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '0.78rem',
            }}
            title="What if Laptop Wi-Fi is OFF?"
          >
            <HelpCircle size={15} color="#BC0202" />
            <span>Wi-Fi Guide</span>
          </button>
        </div>
      </div>

      {/* Wi-Fi Guide Dropdown Alert */}
      {showWifiHelp && (
        <div style={{
          marginTop: 14,
          padding: '12px 16px',
          backgroundColor: '#fff5f5',
          border: '1px solid #fca5a5',
          borderRadius: 8,
          fontSize: '0.82rem',
          color: '#830000',
          lineHeight: 1.6,
        }}>
          <strong>💡 Agar Laptop ka Wi-Fi band ho to kya karein?</strong>
          <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
            <li><strong>Option 1 (Mobile Hotspot):</strong> Phone ka Personal Hotspot on karein aur Laptop ko connect karein — transfer foran shuru ho jayega!</li>
            <li><strong>Option 2 (Laptop Mobile Hotspot):</strong> Windows Settings mein jaa kar "Mobile Hotspot" on karein aur phone connect karein.</li>
            <li><strong>Option 3 (Internet / Mobile Data):</strong> Yeh app WebRTC P2P use karti hai, is liye dono devices alag alag network (jaise phone 4G/5G par aur laptop dusre connection par) par hon tab bhi direct transfer ho sakti hai!</li>
            <li><strong>Option 4 (GitHub Hosting):</strong> Yeh app 100% static hai, isay bina kisi server ke GitHub Pages par host kar sakte hain!</li>
          </ul>
        </div>
      )}
    </div>
  );
}
