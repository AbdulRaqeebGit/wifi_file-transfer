import React, { useState, useRef, useCallback } from 'react';
import { UploadCloud, File, X, CheckCircle, AlertTriangle, ArrowUp, Zap, Sparkles } from 'lucide-react';
import { formatBytes } from '../utils/formatters';
import { sound } from '../utils/sound';

export default function Dropzone({ isConnected, onSendFiles }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState('');
  const [currentFileName, setCurrentFileName] = useState('');
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
        text: 'Please pair / connect to a device first before sending files!',
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadSpeed('Starting transfer...');
    setStatusMessage(null);

    const startTime = Date.now();
    let totalBytesSent = 0;
    const totalBatchBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setCurrentFileName(`(${i + 1}/${selectedFiles.length}) ${file.name}`);

        let prevFileLoaded = 0;
        await onSendFiles(file, (filePercent) => {
          const fileBytes = (filePercent / 100) * file.size;
          const currentTotalBytes = totalBytesSent + fileBytes;
          const overallPercent = totalBatchBytes > 0
            ? Math.min(100, Math.round((currentTotalBytes / totalBatchBytes) * 100))
            : filePercent;

          setUploadProgress(overallPercent);

          const elapsedSec = (Date.now() - startTime) / 1000;
          if (elapsedSec > 0.3) {
            const speed = currentTotalBytes / elapsedSec;
            setUploadSpeed(`${formatBytes(speed)}/s`);
          }
          prevFileLoaded = fileBytes;
        });

        totalBytesSent += file.size;
      }

      sound.playSuccess();
      setStatusMessage({
        type: 'success',
        text: `Successfully transferred ${selectedFiles.length} file(s) directly to connected device!`,
      });
      setSelectedFiles([]);
    } catch (err) {
      console.error('Transfer failed:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'File transfer failed. Please check connection.',
      });
    } finally {
      setIsUploading(false);
      setUploadSpeed('');
      setCurrentFileName('');
    }
  };

  const totalSelectedSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="clean-card" style={{ padding: '24px', backgroundColor: '#ffffff' }}>
      {/* Drop Zone Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        style={{
          border: isDragOver ? '2px dashed #BC0202' : '2px dashed #cbd5e1',
          borderRadius: 14,
          backgroundColor: isDragOver ? '#fff5f5' : '#f8fafc',
          padding: '36px 20px',
          textAlign: 'center',
          cursor: isUploading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
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

        {/* Upload Icon circle */}
        <div style={{
          width: 64,
          height: 64,
          margin: '0 auto 14px',
          borderRadius: '50%',
          backgroundColor: '#fee2e2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <UploadCloud
            size={32}
            color="#BC0202"
          />
        </div>

        <h3 style={{
          fontSize: '1.2rem',
          fontWeight: 700,
          color: 'var(--text-main)',
          marginBottom: 6,
          fontFamily: 'var(--font-sans)',
        }}>
          {isDragOver ? 'Release to Drop Files Here' : 'Drag & Drop files here, or Click to Browse'}
        </h3>

        <p style={{
          color: 'var(--text-muted)',
          fontSize: '0.88rem',
          maxWidth: 520,
          margin: '0 auto 16px',
          lineHeight: 1.5,
        }}>
          Transfer files across any mobile, PC or laptop.{' '}
          <strong style={{ color: '#BC0202' }}>Unlimited file size</strong>, up to{' '}
          <strong>10 files per batch</strong>.
        </p>

        {/* Specs pills */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}>
          <span className="clean-pill" style={{ fontSize: '0.78rem', color: '#475569' }}>
            <Zap size={14} color="#BC0202" /> P2P WebRTC Direct Transfer
          </span>
          <span className="clean-pill" style={{ fontSize: '0.78rem', color: '#475569' }}>
            <Sparkles size={14} color="#BC0202" /> Max 10 Files / Batch
          </span>
          <span className="clean-pill" style={{ fontSize: '0.78rem', color: '#475569' }}>
            <ArrowUp size={14} color="#BC0202" /> GitHub Pages Hostable
          </span>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div style={{
          marginTop: 16,
          padding: '12px 16px',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: '0.88rem',
          backgroundColor: statusMessage.type === 'error' ? '#fee2e2' : '#dcfce7',
          border: `1px solid ${statusMessage.type === 'error' ? '#fca5a5' : '#86efac'}`,
          color: statusMessage.type === 'error' ? '#991b1b' : '#166534',
        }}>
          {statusMessage.type === 'error' ? <AlertTriangle size={18} color="#991b1b" /> : <CheckCircle size={18} color="#166534" />}
          <span style={{ fontWeight: 600 }}>{statusMessage.text}</span>
        </div>
      )}

      {/* Selected files queue */}
      {selectedFiles.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Transfer Queue ({selectedFiles.length} / {MAX_FILES})
              </h4>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Total: {formatBytes(totalSelectedSize)}
              </span>
            </div>

            {!isUploading && (
              <button
                onClick={handleClearAllSelected}
                className="btn-secondary"
                style={{ fontSize: '0.76rem', padding: '4px 10px' }}
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
            maxHeight: 260,
            overflowY: 'auto',
          }}>
            {selectedFiles.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '9px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{
                    width: 30,
                    height: 30,
                    borderRadius: 6,
                    backgroundColor: '#fee2e2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <File size={16} color="#BC0202" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      color: 'var(--text-main)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 360,
                    }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
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
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Simple Clean Progress Bar */}
          {isUploading && (
            <div style={{
              marginTop: 16,
              padding: '14px',
              borderRadius: 10,
              backgroundColor: '#fff5f5',
              border: '1px solid #fca5a5',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.84rem' }}>
                <span style={{ color: '#BC0202', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                  {currentFileName || 'Transferring to connected device...'}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#0f172a', fontWeight: 700 }}>
                  {uploadProgress}% {uploadSpeed && `(${uploadSpeed})`}
                </span>
              </div>

              {/* Solid Progress track */}
              <div style={{
                height: 8,
                width: '100%',
                backgroundColor: '#e2e8f0',
                borderRadius: 4,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${uploadProgress}%`,
                  backgroundColor: '#BC0202',
                  transition: 'width 0.2s ease',
                  borderRadius: 4,
                }} />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={startUpload}
              disabled={isUploading || !isConnected}
              className="btn-primary"
              style={{
                padding: '10px 24px',
                fontSize: '0.92rem',
              }}
            >
              <ArrowUp size={16} />
              <span>
                {isConnected
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
