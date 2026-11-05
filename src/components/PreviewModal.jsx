import React from 'react';
import { X, Download, FileText } from 'lucide-react';
import { formatBytes, getFileCategory } from '../utils/formatters';
import { sound } from '../utils/sound';

export default function PreviewModal({ file, onClose }) {
  if (!file) return null;

  const category = getFileCategory(file.mimeType, file.name);
  const previewUrl = file.url || `/api/preview/${file.id}`;
  const downloadUrl = file.url || `/api/download/${file.id}`;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
          maxWidth: 780,
          maxHeight: '90vh',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 16,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.15)',
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
        }}>
          <div style={{ minWidth: 0, flex: 1, marginRight: 16 }}>
            <h3 style={{
              fontSize: '0.96rem',
              fontWeight: 700,
              color: '#0f172a',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {file.name}
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {formatBytes(file.size)} • {file.mimeType}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a
              href={downloadUrl}
              download={file.name}
              className="btn-primary"
              style={{ padding: '6px 14px', fontSize: '0.8rem', textDecoration: 'none' }}
              onClick={() => sound.playClick()}
            >
              <Download size={14} />
              <span>Download</span>
            </a>

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

        {/* Content Preview */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          backgroundColor: '#ffffff',
          minHeight: 260,
        }}>
          {category === 'image' && (
            <img
              src={previewUrl}
              alt={file.name}
              style={{
                maxWidth: '100%',
                maxHeight: '65vh',
                objectFit: 'contain',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
              }}
            />
          )}

          {category === 'video' && (
            <video
              src={previewUrl}
              controls
              autoPlay
              style={{
                maxWidth: '100%',
                maxHeight: '65vh',
                borderRadius: 8,
                outline: 'none',
              }}
            />
          )}

          {category === 'audio' && (
            <div style={{ width: '100%', maxWidth: 440, textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: 72,
                height: 72,
                margin: '0 auto 16px',
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <FileText size={32} color="#BC0202" />
              </div>
              <audio src={previewUrl} controls style={{ width: '100%' }} />
            </div>
          )}

          {category === 'pdf' && (
            <iframe
              src={previewUrl}
              title={file.name}
              style={{ width: '100%', height: '65vh', border: '1px solid #e2e8f0', borderRadius: 8 }}
            />
          )}

          {!['image', 'video', 'audio', 'pdf'].includes(category) && (
            <div style={{ textAlign: 'center', color: '#64748b' }}>
              <FileText size={44} color="#94a3b8" style={{ marginBottom: 10 }} />
              <p>Direct preview is not supported for this file type.</p>
              <a
                href={downloadUrl}
                download={file.name}
                className="btn-primary"
                style={{ marginTop: 12, display: 'inline-flex', textDecoration: 'none' }}
              >
                Download to view ({formatBytes(file.size)})
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
