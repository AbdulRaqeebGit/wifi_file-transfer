import React, { useState } from 'react';
import { Link2, ExternalLink, Copy, Check, Send, Trash2 } from 'lucide-react';
import { sound } from '../utils/sound';
import { formatTimeAgo } from '../utils/formatters';

export default function LinkShare({
  isConnected,
  onSendLink,
  linkHistory = [],
  onClearHistory,
  onDeleteLink,
  title = 'Link & URL Transfer',
  subTitle = 'Attach and send web links, YouTube videos, or articles directly',
}) {
  const [url, setUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const handleSend = (e) => {
    e?.preventDefault();
    if (!url.trim()) return;
    if (!isConnected) {
      alert('WiFi Hub is offline. Please check connection.');
      return;
    }

    let formattedUrl = url.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }

    sound.playClick();
    onSendLink(formattedUrl, linkTitle.trim());
    setUrl('');
    setLinkTitle('');
  };

  const handleCopy = (id, linkUrl) => {
    navigator.clipboard.writeText(linkUrl);
    setCopiedId(id);
    sound.playClick();
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this link?')) return;
    sound.playClick();
    if (onDeleteLink) onDeleteLink(id);
  };

  return (
    <div className="clean-card" style={{ padding: '20px', backgroundColor: '#ffffff', marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            backgroundColor: '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Link2 size={16} color="#BC0202" />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              {title}
            </h3>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: 0 }}>
              {subTitle}
            </p>
          </div>
        </div>

        {linkHistory.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm('Clear all links?')) {
                sound.playClick();
                onClearHistory();
              }
            }}
            className="btn-danger"
            style={{ padding: '4px 10px', fontSize: '0.74rem' }}
          >
            <Trash2 size={12} />
            <span>Clear All</span>
          </button>
        )}
      </div>

      {/* Input box */}
      <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste link URL (e.g. https://google.com)..."
            className="clean-input"
            style={{ flex: 2, minWidth: 200, padding: '8px 12px' }}
          />
          <input
            type="text"
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            placeholder="Title or note (optional)..."
            className="clean-input"
            style={{ flex: 1, minWidth: 150, padding: '8px 12px' }}
          />
          <button
            type="submit"
            disabled={!url.trim() || !isConnected}
            className="btn-primary"
            style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Send size={15} />
            <span>Share Link</span>
          </button>
        </div>
      </form>

      {/* History List */}
      <div style={{ marginTop: 16 }}>
        {linkHistory.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '24px 12px',
            color: 'var(--text-muted)',
            fontSize: '0.84rem',
            backgroundColor: '#f8fafc',
            borderRadius: 8,
            border: '1px dashed #cbd5e1',
          }}>
            No links shared yet. Paste and share website links above!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
            {linkHistory.map((item) => (
              <div
                key={item.id}
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '10px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  {item.title && (
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 2 }}>
                      {item.title}
                    </div>
                  )}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: '0.82rem',
                      color: '#BC0202',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      wordBreak: 'break-all',
                    }}
                  >
                    <span>{item.url}</span>
                    <ExternalLink size={12} />
                  </a>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    {formatTimeAgo(item.timestamp)}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => handleCopy(item.id, item.url)}
                    style={{
                      background: 'none',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '0.72rem',
                      color: '#475569',
                    }}
                    title="Copy URL"
                  >
                    {copiedId === item.id ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                    <span>{copiedId === item.id ? 'Copied' : 'Copy'}</span>
                  </button>

                  <button
                    onClick={() => handleDelete(item.id)}
                    style={{
                      background: 'none',
                      border: '1px solid #fee2e2',
                      borderRadius: 6,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '0.72rem',
                      color: '#dc2626',
                    }}
                    title="Delete link"
                  >
                    <Trash2 size={12} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
