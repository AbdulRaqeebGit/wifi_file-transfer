import React from 'react';
import { X, ArrowUpRight, ArrowDownLeft, Zap } from 'lucide-react';
import { formatBytes } from '../utils/formatters';

export default function TransferProgressCard({ activeTransfer, onCancel }) {
  if (!activeTransfer) return null;

  const {
    fileName = 'File',
    role = 'sender',
    percent = 0,
    receivedBytes = 0,
    totalBytes = 0,
    speed = 0,
    fileId,
  } = activeTransfer;

  const isReceiving = role === 'receiver';

  // Calculate ETA (Estimated time remaining)
  let etaText = '';
  if (speed > 10000 && totalBytes > receivedBytes) {
    const remainingSec = Math.round((totalBytes - receivedBytes) / speed);
    if (remainingSec < 60) {
      etaText = `ETA: ${remainingSec}s`;
    } else {
      const mins = Math.floor(remainingSec / 60);
      const secs = remainingSec % 60;
      etaText = `ETA: ${mins}m ${secs}s`;
    }
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      left: 20,
      maxWidth: 480,
      margin: '0 auto',
      zIndex: 900,
      backgroundColor: '#ffffff',
      border: '2px solid #BC0202',
      borderRadius: 14,
      padding: '14px 18px',
      boxShadow: '0 12px 35px rgba(0, 0, 0, 0.15)',
      animation: 'slideUp 0.25s ease',
    }}>
      {/* Top row: Status, Filename & Cancel (X) button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: isReceiving ? '#dcfce7' : '#fee2e2',
            border: `1px solid ${isReceiving ? '#86efac' : '#fca5a5'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            {isReceiving ? (
              <ArrowDownLeft size={18} color="#166534" />
            ) : (
              <ArrowUpRight size={18} color="#BC0202" />
            )}
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: '0.86rem',
              fontWeight: 700,
              color: '#0f172a',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={fileName}
            >
              {fileName}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span>{isReceiving ? 'Downloading...' : 'Uploading...'}</span>
              {etaText && <span>• {etaText}</span>}
            </div>
          </div>
        </div>

        {/* Big Clear Cancel (X) Button */}
        <button
          onClick={() => onCancel(fileId)}
          className="btn-danger"
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: '0.78rem',
            fontWeight: 700,
            flexShrink: 0,
          }}
          title="Cancel this transfer"
        >
          <X size={15} />
          <span>Cancel</span>
        </button>
      </div>

      {/* Speed & Bytes Stats row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.78rem',
        marginBottom: 6,
        color: '#475569',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)' }}>
          {formatBytes(receivedBytes)} / {formatBytes(totalBytes)} ({percent}%)
        </span>

        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          backgroundColor: '#fee2e2',
          color: '#BC0202',
          padding: '2px 8px',
          borderRadius: 4,
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
        }}>
          <Zap size={12} />
          {formatBytes(speed)}/s
        </span>
      </div>

      {/* Solid High-Contrast Progress Bar */}
      <div style={{
        height: 8,
        width: '100%',
        backgroundColor: '#e2e8f0',
        borderRadius: 4,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${percent}%`,
          backgroundColor: '#BC0202',
          borderRadius: 4,
          transition: 'width 0.15s linear',
        }} />
      </div>
    </div>
  );
}
