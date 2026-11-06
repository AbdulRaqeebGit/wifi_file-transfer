import React, { useState } from 'react';
import { Smartphone, Link, Check, Copy, QrCode, PowerOff, HelpCircle, Camera, ShieldCheck } from 'lucide-react';
import { sound } from '../utils/sound';

export default function ConnectionBar({
  myCode,
  remoteCode,
  isConnected,
  isConnecting,
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
    if (!targetInput.trim() || isConnecting) return;
    sound.playClick();
    onConnect(targetInput.trim());
    setTargetInput('');
  };

  return (
    <div className="clean-card" style={{ padding: '16px', backgroundColor: '#ffffff', marginBottom: 18 }}>
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
        {/* Left: My Device OTP Code */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            backgroundColor: isConnected ? '#dcfce7' : '#fee2e2',
            border: `1px solid ${isConnected ? '#86efac' : '#fca5a5'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Smartphone size={22} color={isConnected ? '#166534' : '#BC0202'} />
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Is Device Ka OTP Code
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '1.25rem',
                fontWeight: 900,
                color: '#BC0202',
                letterSpacing: '1px',
              }}>
                {myCode || 'Generating...'}
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
                title="Copy OTP code"
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
                title="Show QR Code"
              >
                <QrCode size={13} color="#BC0202" />
                <span>Show QR</span>
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
              padding: '8px 14px',
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={16} color="#166534" />
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#166534' }}>
                  Private Paired with: <span style={{ fontFamily: 'var(--font-mono)' }}>{remoteCode}</span>
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
                placeholder="Enter Other's 6-Digit OTP"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                maxLength={10}
                disabled={isConnecting}
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  padding: '7px 10px',
                  fontSize: '0.86rem',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                  flex: '1 1 180px',
                  minWidth: 160,
                  textAlign: 'center',
                }}
              />
              <button
                type="submit"
                disabled={!targetInput.trim() || isConnecting}
                className="btn-primary"
                style={{ padding: '7px 14px', fontSize: '0.82rem' }}
              >
                <Link size={13} />
                <span>{isConnecting ? 'Pairing...' : 'Pair & Connect'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onOpenQr();
                }}
                className="btn-secondary"
                style={{ padding: '7px 10px', fontSize: '0.82rem' }}
                title="Scan QR Code with Camera"
              >
                <Camera size={14} color="#BC0202" />
                <span>Scan QR</span>
              </button>
            </form>
          )}

          {/* Pairing Help */}
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
            title="How to pair?"
          >
            <HelpCircle size={14} color="#BC0202" />
            <span>Help</span>
          </button>
        </div>
      </div>

      {/* Pairing Guidance */}
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
          <strong>💡 Private OTP Code Se Kaise Connect Karein?</strong>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            <li><strong>Step 1:</strong> Har device ka apna alag 6-digit OTP code hota hai (jaise upar likha hai <code>{myCode || '123456'}</code>).</li>
            <li><strong>Step 2:</strong> Device A ka code Device B ke input box mein likh kar <strong>"Pair & Connect"</strong> dabayein, ya <strong>"Scan QR"</strong> se phone camera se scan karein.</li>
            <li><strong>Step 3:</strong> Dono devices connect ho jayenge aur private channel ban jayega — ab jo bhi file aap bhejenge wo <strong>sirf us paired device ko jayegi</strong>, kisi teesre ko nazar nahi aayegi!</li>
          </ul>
        </div>
      )}
    </div>
  );
}
