import React from 'react';
import { X, Download, FileText, Music } from 'lucide-react';
import { formatBytes, getFileCategory } from '../utils/formatters';
import { sound } from '../utils/sound';

export default function PreviewModal({ file, onClose }) {
  if (!file) return null;

  const category = getFileCategory(file.mimeType, file.name);

  // For P2P files: use blob URL. For server files: fall back to API route.
  const previewUrl = file.url || (file.id ? `/api/preview/${file.id}` : null);
  const downloadUrl = file.url || (file.id ? `/api/download/${file.id}` : null);

  const handleDownload = () => {
    sound.playClick();
    const url = downloadUrl;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
          maxWidth: 820,
          maxHeight: '92vh',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 16,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
          gap: 12,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 style={{
              fontSize: '0.96rem',
              fontWeight: 700,
              color: '#0f172a',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginBottom: 2,
            }}>
              {file.name}
            </h3>
            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
              {formatBytes(file.size)} • {file.mimeType || 'Unknown type'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {previewUrl && (
              <button
                onClick={handleDownload}
                className="btn-primary"
                style={{ padding: '7px 14px', fontSize: '0.8rem' }}
              >
                <Download size={14} />
                <span>Download</span>
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
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
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          backgroundColor: '#ffffff',
          minHeight: 260,
        }}>
          {/* Image */}
          {category === 'image' && previewUrl && (
            <img
              src={previewUrl}
              alt={file.name}
              style={{
                maxWidth: '100%',
                maxHeight: '68vh',
                objectFit: 'contain',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
              }}
            />
          )}

          {/* Video */}
          {category === 'video' && previewUrl && (
            <video
              src={previewUrl}
              controls
              style={{
                maxWidth: '100%',
                maxHeight: '68vh',
                borderRadius: 8,
                outline: 'none',
                backgroundColor: '#000',
              }}
            />
          )}

          {/* Audio */}
          {category === 'audio' && previewUrl && (
            <div style={{ width: '100%', maxWidth: 440, textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: 80,
                height: 80,
                margin: '0 auto 20px',
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Music size={36} color="#BC0202" />
              </div>
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', marginBottom: 14 }}>
                {file.name}
              </p>
              <audio src={previewUrl} controls style={{ width: '100%' }} />
            </div>
          )}

          {/* PDF */}
          {category === 'pdf' && previewUrl && (
            <iframe
              src={previewUrl}
              title={file.name}
              style={{ width: '100%', height: '68vh', border: '1px solid #e2e8f0', borderRadius: 8 }}
            />
          )}

          {/* No preview available */}
          {(!previewUrl || !['image', 'video', 'audio', 'pdf'].includes(category)) && (
            <div style={{ textAlign: 'center', color: '#64748b' }}>
              <div style={{
                width: 72,
                height: 72,
                margin: '0 auto 16px',
                borderRadius: '50%',
                backgroundColor: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <FileText size={34} color="#94a3b8" />
              </div>
              <p style={{ marginBottom: 4, fontWeight: 600, color: '#0f172a' }}>No preview available</p>
              <p style={{ fontSize: '0.84rem', marginBottom: 16 }}>
                This file type cannot be previewed in the browser.
              </p>
              {previewUrl && (
                <button
                  onClick={handleDownload}
                  className="btn-primary"
                  style={{ display: 'inline-flex' }}
                >
                  <Download size={15} />
                  <span>Download to open ({formatBytes(file.size)})</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
