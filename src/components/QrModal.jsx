import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Wifi } from 'lucide-react';
import QRCode from 'qrcode';
import { sound } from '../utils/sound';

export default function QrModal({ isOpen, onClose, myCode }) {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  const pairingUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}#connect=${myCode || ''}`
    : '';

  useEffect(() => {
    if (isOpen && myCode) {
      QRCode.toDataURL(pairingUrl, {
        margin: 2,
        scale: 7,
        color: {
          dark: '#BC0202',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR error:', err));
    }
  }, [isOpen, myCode, pairingUrl]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (pairingUrl) {
      navigator.clipboard.writeText(pairingUrl);
      setCopied(true);
      sound.playClick();
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 400,
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 16,
          padding: 24,
          position: 'relative',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            backgroundColor: '#f1f5f9',
            border: 'none',
            color: '#64748b',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>

        {/* Title */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          backgroundColor: '#fee2e2',
          border: '1px solid #fca5a5',
          padding: '4px 12px',
          borderRadius: 6,
          marginBottom: 12,
        }}>
          <Wifi size={14} color="#BC0202" />
          <span style={{ fontSize: '0.78rem', color: '#BC0202', fontWeight: 700 }}>
            INSTANT MOBILE SCAN
          </span>
        </div>

        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
          Scan to Connect Phone
        </h3>
        <p style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: 18 }}>
          Open your phone camera to scan. It connects directly via P2P without any setup!
        </p>

        {/* QR Code Graphic Frame */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 14,
          display: 'inline-block',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
          marginBottom: 16,
        }}>
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Scan QR to open file transfer"
              style={{
                width: 210,
                height: 210,
                display: 'block',
                borderRadius: 6,
              }}
            />
          ) : (
            <div style={{ width: 210, height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              Generating QR...
            </div>
          )}
        </div>

        {/* Device Code Pill */}
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          fontFamily: 'var(--font-mono)',
          fontSize: '0.84rem',
        }}>
          <span style={{ color: '#BC0202', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 700 }}>
            Device Code: {myCode}
          </span>
          <button
            onClick={handleCopy}
            className="btn-primary"
            style={{
              padding: '6px 12px',
              fontSize: '0.76rem',
              borderRadius: 6,
            }}
          >
            {copied ? <Check size={13} color="#ffffff" /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy Link'}</span>
          </button>
        </div>

        {/* Footer instruction */}
        <p style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: 12 }}>
          Works over Hotspot, Wi-Fi, or Mobile Data. Ready for GitHub Pages!
        </p>
      </div>
    </div>
  );
}
