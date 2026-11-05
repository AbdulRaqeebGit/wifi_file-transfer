import React, { useState, useRef, useCallback } from 'react';
import { UploadCloud, File, X, CheckCircle, AlertTriangle, ArrowUp, Zap, Sparkles, Wifi } from 'lucide-react';
import { formatBytes } from '../utils/formatters';
import { sound } from '../utils/sound';

export default function Dropzone({
  mode = 'wifi', // 'wifi' or 'p2p'
  isConnected = true,
  onSendFiles,
  isUploading,
  onCancelActiveTransfer,
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [statusMessage, setStatusMessage] = useState(null);
  const fileInputRef = useRef(null);

  const MAX_FILES = 10;

  const handleFilesAdded = useCallback((newFilesList) => {
    setStatusMessage(null);
    const incoming = Array.from(newFilesList);

    if (incoming.length === 0) return;

    setSelectedFiles((prev) => {
      const combined = [...prev, ...incoming];
      if (combined.length > MAX_FILES) {
        setStatusMessage({
          type: 'error',
          text: `Maximum ${MAX_FILES} files allowed per batch! First ${MAX_FILES} selected.`,
        });
        sound.playClick();
        return combined.slice(0, MAX_FILES);
      }
      sound.playClick();
      return combined;
    });
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const handleRemoveFile = (index) => {
    sound.playClick();
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    if (statusMessage?.type === 'error') setStatusMessage(null);
  };

  const handleClearAllSelected = () => {
    sound.playClick();
    setSelectedFiles([]);
    setStatusMessage(null);
  };

  const startUpload = async () => {
    if (selectedFiles.length === 0 || isUploading) return;

    if (!isConnected) {
      setStatusMessage({
        type: 'error',
        text:
          mode === 'wifi'
            ? 'WiFi Hub is unreachable. Please verify server is running on this WiFi.'
            : 'Please pair / connect to a device with code first before sending files!',
      });
      return;
    }

    setStatusMessage(null);

    try {
      await onSendFiles(selectedFiles);
      setSelectedFiles([]);
      setStatusMessage({
        type: 'success',
        text:
          mode === 'wifi'
            ? '✅ File(s) uploaded successfully! Ab neeche list mein Download ka option aa chuka hai.'
            : '✅ All files sent successfully with direct P2P speed!',
      });
    } catch (err) {
      if (err.message !== 'Transfer cancelled') {
        setStatusMessage({
          type: 'error',
          text: err.message || 'File transfer failed. Please check connection.',
        });
      }
    }
  };

  const totalSelectedSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="clean-card" style={{ padding: '20px', backgroundColor: '#ffffff' }}>
      {/* Drop Zone Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        style={{
          border: isDragOver ? '2px dashed #BC0202' : '2px dashed #cbd5e1',
          borderRadius: 12,
          backgroundColor: isDragOver ? '#fff5f5' : '#f8fafc',
          padding: '28px 16px',
          textAlign: 'center',
          cursor: isUploading ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          disabled={isUploading}
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files) handleFilesAdded(e.target.files);
            e.target.value = '';
          }}
        />

        <div style={{
          width: 56,
          height: 56,
          margin: '0 auto 12px',
          borderRadius: '50%',
          backgroundColor: '#fee2e2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {mode === 'wifi' ? (
            <Wifi size={28} color="#BC0202" />
          ) : (
            <UploadCloud size={28} color="#BC0202" />
          )}
        </div>

        <h3 style={{
          fontSize: '1.15rem',
          fontWeight: 700,
          color: 'var(--text-main)',
          marginBottom: 6,
          fontFamily: 'var(--font-sans)',
        }}>
          {isDragOver ? 'Release to Drop Files Here' : 'Drag & Drop files here, or Click to Browse'}
        </h3>

        <p style={{
          color: 'var(--text-muted)',
          fontSize: '0.84rem',
          maxWidth: 540,
          margin: '0 auto 14px',
          lineHeight: 1.4,
        }}>
          {mode === 'wifi' ? (
            <>
              <strong>Same WiFi Transfer (Bina Code Ke):</strong> File pehle upload hogi (0-100%), phir sabhi devices par{' '}
              <strong style={{ color: '#BC0202' }}>Download</strong> ka button aayega. Unlimited size (5GB+ supported), up to 10 files.
            </>
          ) : (
            <>
              Direct device-to-device streaming. 6-digit code se pair karein.{' '}
              <strong style={{ color: '#BC0202' }}>Unlimited file size</strong>, up to{' '}
              <strong>10 files per batch</strong>.
            </>
          )}
        </p>

        {/* Specs pills */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}>
          <span className="clean-pill" style={{ color: '#475569' }}>
            <Zap size={13} color="#BC0202" /> Ultra-Fast LAN / WiFi Speed
          </span>
          <span className="clean-pill" style={{ color: '#475569' }}>
            <Sparkles size={13} color="#BC0202" /> Max 10 Files / Batch
          </span>
          <span className="clean-pill" style={{ color: '#475569' }}>
            <ArrowUp size={13} color="#BC0202" /> 5GB+ Supported
          </span>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div style={{
          marginTop: 14,
          padding: '10px 14px',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: '0.84rem',
          backgroundColor: statusMessage.type === 'error' ? '#fee2e2' : '#dcfce7',
          border: `1px solid ${statusMessage.type === 'error' ? '#fca5a5' : '#86efac'}`,
          color: statusMessage.type === 'error' ? '#991b1b' : '#166534',
        }}>
          {statusMessage.type === 'error' ? <AlertTriangle size={16} color="#991b1b" /> : <CheckCircle size={16} color="#166534" />}
          <span style={{ fontWeight: 600 }}>{statusMessage.text}</span>
        </div>
      )}

      {/* Selected files queue */}
      {selectedFiles.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
            flexWrap: 'wrap',
            gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Transfer Queue ({selectedFiles.length} / {MAX_FILES})
              </h4>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Total: {formatBytes(totalSelectedSize)}
              </span>
            </div>

            {!isUploading && (
              <button
                onClick={handleClearAllSelected}
                className="btn-secondary"
                style={{ fontSize: '0.74rem', padding: '3px 8px' }}
              >
                Clear Queue
              </button>
            )}
          </div>

          {/* Files queue items */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            maxHeight: 240,
            overflowY: 'auto',
          }}>
            {selectedFiles.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  padding: '8px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    backgroundColor: '#fee2e2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <File size={14} color="#BC0202" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: 'var(--text-main)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 320,
                    }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {formatBytes(file.size)}
                    </div>
                  </div>
                </div>

                {!isUploading && (
                  <button
                    onClick={() => handleRemoveFile(idx)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#BC0202')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                    title="Remove file"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Action buttons with Cancel (X) */}
          <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {isUploading && (
              <button
                onClick={onCancelActiveTransfer}
                className="btn-danger"
                style={{ padding: '8px 16px', fontSize: '0.84rem' }}
              >
                <X size={15} />
                <span>Cancel Transfer (X)</span>
              </button>
            )}

            <button
              onClick={startUpload}
              disabled={isUploading || !isConnected}
              className="btn-primary"
              style={{
                padding: '8px 20px',
                fontSize: '0.86rem',
              }}
            >
              <ArrowUp size={15} />
              <span>
                {isUploading
                  ? 'Transferring...'
                  : mode === 'wifi'
                  ? `Upload ${selectedFiles.length} File(s) to WiFi Hub`
                  : isConnected
                  ? `Send ${selectedFiles.length} File(s) Direct`
                  : 'Pair Device to Send'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
