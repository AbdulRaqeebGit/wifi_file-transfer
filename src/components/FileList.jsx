import React, { useState, useMemo } from 'react';
import {
  Download,
  Trash2,
  Eye,
  Search,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCode,
  File,
  Layers,
  ArrowUpDown,
} from 'lucide-react';
import { formatBytes, formatTimeAgo, getFileCategory } from '../utils/formatters';
import { sound } from '../utils/sound';

export default function FileList({
  files = [],
  onDeleteFile,
  onClearAll,
  onPreviewFile,
  onDownloadAll,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const getIcon = (category) => {
    switch (category) {
      case 'image':
        return <FileImage size={20} color="#BC0202" />;
      case 'video':
        return <FileVideo size={20} color="#BC0202" />;
      case 'audio':
        return <FileAudio size={20} color="#BC0202" />;
      case 'pdf':
      case 'document':
        return <FileText size={20} color="#BC0202" />;
      case 'archive':
        return <FileArchive size={20} color="#BC0202" />;
      case 'code':
        return <FileCode size={20} color="#BC0202" />;
      default:
        return <File size={20} color="#BC0202" />;
    }
  };

  const filteredAndSortedFiles = useMemo(() => {
    return files
      .filter((file) => {
        const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
        const category = getFileCategory(file.mimeType, file.name);
        const matchesCategory =
          categoryFilter === 'all' ||
          (categoryFilter === 'media' && ['image', 'video', 'audio'].includes(category)) ||
          categoryFilter === category;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.uploadedAt) - new Date(a.uploadedAt);
        if (sortBy === 'oldest') return new Date(a.uploadedAt) - new Date(b.uploadedAt);
        if (sortBy === 'largest') return (b.size || 0) - (a.size || 0);
        if (sortBy === 'smallest') return (a.size || 0) - (b.size || 0);
        return 0;
      });
  }, [files, searchQuery, categoryFilter, sortBy]);

  const handleDownload = (file) => {
    sound.playClick();

    // Priority:
    // 1. Explicit file.url (blob URL or full server URL)
    // 2. Blob if in-memory
    // 3. Server download route /api/download/:id
    const downloadUrl =
      file.url ||
      (file.blob ? URL.createObjectURL(file.blob) : null) ||
      (file.id ? `/api/download/${file.id}` : null);

    if (!downloadUrl) {
      alert('File download is not available. Please re-transfer the file.');
      return;
    }

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="clean-card" style={{ padding: '24px', marginTop: 24, backgroundColor: '#ffffff' }}>
      {/* Top Header & Search Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 18,
      }}>
        <div>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            color: 'var(--text-main)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <span>Received Files</span>
            <span style={{
              backgroundColor: '#fee2e2',
              color: '#BC0202',
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '2px 10px',
              borderRadius: 6,
            }}>
              {files.length} {files.length === 1 ? 'file' : 'files'}
            </span>
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Instant direct streaming & downloads for received files
          </p>
        </div>

        {files.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                sound.playClick();
                onDownloadAll();
              }}
              className="btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.82rem' }}
            >
              <Download size={14} />
              <span>Download All (ZIP)</span>
            </button>

            <button
              onClick={() => {
                sound.playClick();
                onClearAll();
              }}
              className="btn-danger"
              style={{ fontSize: '0.82rem' }}
              title="Clear all received files"
            >
              <Trash2 size={14} />
              <span>Clear All</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      {files.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '12px',
          backgroundColor: '#f8fafc',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          marginBottom: 18,
        }}>
          {/* Search Input */}
          <div style={{
            position: 'relative',
            flex: '1 1 240px',
            maxWidth: 360,
          }}>
            <Search
              size={16}
              color="#94a3b8"
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              placeholder="Search file name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                padding: '8px 12px 8px 36px',
                color: 'var(--text-main)',
                fontSize: '0.86rem',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
              }}
            />
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'media', label: 'Media' },
              { id: 'document', label: 'Documents' },
              { id: 'archive', label: 'Archives' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  sound.playClick();
                  setCategoryFilter(tab.id);
                }}
                style={{
                  backgroundColor: categoryFilter === tab.id ? '#BC0202' : '#ffffff',
                  border: categoryFilter === tab.id ? '1px solid #BC0202' : '1px solid #cbd5e1',
                  color: categoryFilter === tab.id ? '#ffffff' : '#475569',
                  borderRadius: 6,
                  padding: '5px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowUpDown size={14} color="#64748b" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                color: 'var(--text-main)',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="largest">Largest Size</option>
              <option value="smallest">Smallest Size</option>
            </select>
          </div>
        </div>
      )}

      {/* Files Grid */}
      {filteredAndSortedFiles.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12,
        }}>
          {filteredAndSortedFiles.map((file) => {
            const category = getFileCategory(file.mimeType, file.name);
            const canPreview = ['image', 'video', 'audio', 'pdf', 'code'].includes(category);

            return (
              <div
                key={file.id}
                style={{
                  backgroundColor: '#ffffff',
                  padding: '14px',
                  borderRadius: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                  transition: 'border-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#BC0202';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
              >
                {/* File Header Info */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    backgroundColor: '#fee2e2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {getIcon(category)}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3
                      title={file.name}
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: 'var(--text-main)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginBottom: 3,
                      }}
                    >
                      {file.name}
                    </h3>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      <span style={{
                        backgroundColor: '#f1f5f9',
                        padding: '1px 6px',
                        borderRadius: 4,
                        fontFamily: 'var(--font-mono)',
                        color: '#BC0202',
                        fontWeight: 600,
                      }}>
                        {formatBytes(file.size)}
                      </span>
                      <span>•</span>
                      <span>{formatTimeAgo(file.uploadedAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 10,
                  borderTop: '1px solid #f1f5f9',
                  marginTop: 'auto',
                }}>
                  {/* Left utility buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {canPreview && (
                      <button
                        onClick={() => {
                          sound.playClick();
                          onPreviewFile(file);
                        }}
                        style={{
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          color: '#475569',
                          padding: '5px 8px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: '0.75rem',
                          fontWeight: 500,
                        }}
                        title="Preview file"
                      >
                        <Eye size={13} color="#BC0202" />
                        <span>Preview</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        sound.playClick();
                        onDeleteFile(file.id);
                      }}
                      style={{
                        backgroundColor: '#fee2e2',
                        border: '1px solid #fca5a5',
                        color: '#991b1b',
                        padding: '5px 8px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '0.75rem',
                      }}
                      title="Delete file"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Single File Download Button */}
                  <button
                    onClick={() => handleDownload(file)}
                    className="btn-primary"
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.78rem',
                      borderRadius: 6,
                    }}
                    title="Download this file"
                  >
                    <Download size={13} />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div style={{
          textAlign: 'center',
          padding: '48px 20px',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            backgroundColor: '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
          }}>
            <Layers size={30} color="#BC0202" />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>
            No Received Files Yet
          </h3>
          <p style={{ maxWidth: 420, fontSize: '0.86rem', lineHeight: 1.5 }}>
            Pair with another phone or laptop to send and receive files instantly without internet or cables!
          </p>
        </div>
      )}
    </div>
  );
}
