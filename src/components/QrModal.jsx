import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Check, Wifi, Camera, QrCode as QrIcon, ArrowRight, Loader2 } from 'lucide-react';
import QRCode from 'qrcode';
import { sound } from '../utils/sound';

export default function QrModal({
  isOpen,
  onClose,
  myCode,
  targetUrl,
  onConnectCode,
  title = 'Pair Devices with Code & QR',
  subtext = 'Har device ka alag OTP code hai. Code likh kar ya QR scan karke connect karein!',
}) {
  const [activeTab, setActiveTab] = useState('show'); // 'show' or 'scan'
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);

  const activeUrl =
    targetUrl ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}#connect=${myCode || ''}`
      : '');

  // Generate QR code for this device's OTP code & URL
  useEffect(() => {
    if (isOpen && activeUrl) {
      QRCode.toDataURL(activeUrl, {
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
  }, [isOpen, activeUrl]);

  // Handle camera scanning when 'scan' tab is active
  useEffect(() => {
    if (!isOpen || activeTab !== 'scan') {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  const startCamera = async () => {
    setCameraError(null);
    setIsScanning(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();

        // Check for native BarcodeDetector
        if ('BarcodeDetector' in window) {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          scanIntervalRef.current = setInterval(async () => {
            if (videoRef.current && videoRef.current.readyState >= 2) {
              try {
                const barcodes = await detector.detect(videoRef.current);
                if (barcodes.length > 0) {
                  const raw = barcodes[0].rawValue;
                  handleDetectedCode(raw);
                }
              } catch {}
            }
          }, 300);
        }
      }
    } catch (err) {
      setCameraError(err.message || 'Could not access camera. You can enter the OTP code manually below.');
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const handleDetectedCode = (scannedString) => {
    if (!scannedString) return;
    // Extract code from #connect=123456 or arw-123456 or raw 6-digit code
    let code = scannedString;
    const match = scannedString.match(/connect=([a-zA-Z0-9]+)/);
    if (match && match[1]) {
      code = match[1];
    } else {
      code = code.replace(/^arw-/, '').trim();
    }

    if (code && code !== myCode) {
      sound.playSuccess();
      stopCamera();
      if (onConnectCode) onConnectCode(code);
      onClose();
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    sound.playClick();
    if (onConnectCode) onConnectCode(manualCode.trim());
    onClose();
  };

  if (!isOpen) return null;

  const handleCopy = () => {
    if (activeUrl) {
      navigator.clipboard.writeText(activeUrl);
      setCopied(true);
      sound.playClick();
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      onClick={() => {
        stopCamera();
        onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
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
          maxWidth: 420,
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 16,
          padding: 22,
          position: 'relative',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
          textAlign: 'center',
        }}
      >
        {/* Close Button */}
        <button
          onClick={() => {
            stopCamera();
            onClose();
          }}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
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

        {/* Modal Header */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          backgroundColor: '#fee2e2',
          border: '1px solid #fca5a5',
          padding: '4px 12px',
          borderRadius: 6,
          marginBottom: 10,
        }}>
          <Wifi size={14} color="#BC0202" />
          <span style={{ fontSize: '0.78rem', color: '#BC0202', fontWeight: 700 }}>
            PRIVATE DEVICE PAIRING
          </span>
        </div>

        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
          {title}
        </h3>
        <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: 14 }}>
          {subtext}
        </p>

        {/* Tab Switcher: Show QR vs Scan Camera */}
        <div style={{
          display: 'flex',
          borderRadius: 8,
          backgroundColor: '#f1f5f9',
          padding: 3,
          marginBottom: 14,
        }}>
          <button
            onClick={() => setActiveTab('show')}
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: activeTab === 'show' ? '#ffffff' : 'transparent',
              color: activeTab === 'show' ? '#BC0202' : '#64748b',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: activeTab === 'show' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <QrIcon size={14} />
            <span>Show My QR</span>
          </button>

          <button
            onClick={() => setActiveTab('scan')}
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: activeTab === 'scan' ? '#ffffff' : 'transparent',
              color: activeTab === 'scan' ? '#BC0202' : '#64748b',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: activeTab === 'scan' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <Camera size={14} />
            <span>Scan with Camera</span>
          </button>
        </div>

        {/* ── Tab 1: Show My QR & Code ───────────────────────────────────────── */}
        {activeTab === 'show' && (
          <div>
            {/* My Device 6-Digit OTP */}
            {myCode && (
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '8px 12px',
                marginBottom: 12,
              }}>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  Is Device Ka OTP Code
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1.4rem',
                  fontWeight: 900,
                  color: '#BC0202',
                  letterSpacing: '3px',
                  marginTop: 2,
                }}>
                  {myCode}
                </div>
              </div>
            )}

            {/* QR Code Graphic Frame */}
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: 12,
              display: 'inline-block',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
              marginBottom: 12,
            }}>
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Scan QR to pair"
                  style={{
                    width: 190,
                    height: 190,
                    display: 'block',
                    borderRadius: 6,
                  }}
                />
              ) : (
                <div style={{ width: 190, height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  Generating QR...
                </div>
              )}
            </div>

            <p style={{ fontSize: '0.76rem', color: '#64748b', margin: '0 0 10px', lineHeight: 1.3 }}>
              Doosre mobile ke camera se is QR ko scan karein ya 6-digit OTP code likhein!
            </p>

            {/* URL / Code Pill */}
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
            }}>
              <span style={{
                color: '#BC0202',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontWeight: 700,
                maxWidth: 240,
                textAlign: 'left',
              }}>
                {activeUrl}
              </span>
              <button
                onClick={handleCopy}
                className="btn-primary"
                style={{
                  padding: '5px 10px',
                  fontSize: '0.74rem',
                  borderRadius: 6,
                  flexShrink: 0,
                }}
              >
                {copied ? <Check size={12} color="#ffffff" /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy Link'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Tab 2: Scan Camera QR / Enter Code ─────────────────────────────── */}
        {activeTab === 'scan' && (
          <div>
            {cameraError ? (
              <div style={{
                backgroundColor: '#fee2e2',
                border: '1px solid #fca5a5',
                color: '#991b1b',
                padding: '12px',
                borderRadius: 8,
                fontSize: '0.8rem',
                marginBottom: 12,
                lineHeight: 1.4,
              }}>
                {cameraError}
              </div>
            ) : (
              <div style={{
                position: 'relative',
                width: '100%',
                height: 220,
                backgroundColor: '#0f172a',
                borderRadius: 12,
                overflow: 'hidden',
                marginBottom: 12,
              }}>
                <video
                  ref={videoRef}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
                {/* Scan Overlay Aim Box */}
                <div style={{
                  position: 'absolute',
                  inset: 30,
                  border: '2px solid #BC0202',
                  borderRadius: 8,
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <div style={{
                    color: '#ffffff',
                    fontSize: '0.76rem',
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    padding: '2px 8px',
                    borderRadius: 4,
                  }}>
                    Align QR inside frame
                  </div>
                </div>
              </div>
            )}

            {/* Manual Code Input Form */}
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input
                type="text"
                placeholder="Enter 6-digit OTP code..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                maxLength={8}
                className="clean-input"
                style={{
                  flex: 1,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.88rem',
                  padding: '7px 10px',
                  textAlign: 'center',
                  letterSpacing: '1px',
                }}
              />
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="btn-primary"
                style={{ padding: '7px 14px', fontSize: '0.82rem' }}
              >
                <span>Pair & Connect</span>
                <ArrowRight size={13} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
