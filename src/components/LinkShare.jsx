import React, { useState } from 'react';
import { Link2, ExternalLink, Copy, Check, Send, Trash2 } from 'lucide-react';
import { sound } from '../utils/sound';
import { formatTimeAgo } from '../utils/formatters';

export default function LinkShare({ isConnected, onSendLink, linkHistory = [], onClearHistory }) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const handleSend = (e) => {
    e?.preventDefault();
    if (!url.trim()) return;
    if (!isConnected) {
      alert('Please connect to a device first to send links!');
      return;
    }

    let formattedUrl = url.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }

    sound.playClick();
    onSendLink(formattedUrl, title.trim());
    setUrl('');
    setTitle('');
  };

  const handleCopy = (id, linkUrl) => {
    navigator.clipboard.writeText(linkUrl);
    setCopiedId(id);
    sound.playClick();
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="clean-card" style={{ padding: '20px', backgroundColor: '#ffffff', marginTop: 20 }}>
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
              Link & URL Transfer
            </h3>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: 0 }}>
              Attach and send web links, YouTube videos, or articles directly
            </p>
          </div>
        </div>

        {linkHistory.length > 0 && (
          <button
            onClick={onClearHistory}
            className="btn-danger"
            style={{ padding: '4px 10px', fontSize: '0.74rem' }}
          >
            <Trash2 size={12} />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Input box */}
      <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste Link / URL (e.g. https://github.com/my-repo)"
            disabled={!isConnected}
            style={{
              flex: '1 1 260px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: '9px 12px',
              fontSize: '0.88rem',
              outline: 'none',
            }}
          />

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Optional Title or Description"
            disabled={!isConnected}
            style={{
              flex: '1 1 180px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: '9px 12px',
              fontSize: '0.88rem',
              outline: 'none',
            }}
          />

          <button
            type="submit"
            disabled={!isConnected || !url.trim()}
            className="btn-primary"
            style={{ padding: '9px 18px', flexShrink: 0 }}
          >
            <Send size={15} />
            <span>Attach & Send Link</span>
          </button>
        </div>
      </form>

      {/* History */}
      {linkHistory.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
          {linkHistory.map((item) => (
            <div
              key={item.id}
              style={{
                backgroundColor: item.isMine ? '#fff5f5' : '#f8fafc',
                border: `1px solid ${item.isMine ? '#fca5a5' : '#e2e8f0'}`,
                borderRadius: 8,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: item.isMine ? '#BC0202' : '#475569',
                    backgroundColor: item.isMine ? '#fee2e2' : '#e2e8f0',
                    padding: '1px 6px',
                    borderRadius: 4,
                  }}>
                    {item.isMine ? 'Sent' : 'Received'}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {formatTimeAgo(item.timestamp)}
                  </span>
                </div>

                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 2 }}>
                  {item.title || item.url}
                </div>

                <div style={{
                  fontSize: '0.76rem',
                  color: '#BC0202',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {item.url}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                  style={{
                    padding: '5px 10px',
                    fontSize: '0.74rem',
                    textDecoration: 'none',
                    borderRadius: 6,
                  }}
                  onClick={() => sound.playClick()}
                >
                  <ExternalLink size={13} />
                  <span>Open</span>
                </a>

                <button
                  onClick={() => handleCopy(item.id, item.url)}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: copiedId === item.id ? '#16a34a' : '#475569',
                    borderRadius: 6,
                    padding: '5px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: '0.74rem',
                    fontWeight: 600,
                  }}
                  title="Copy link"
                >
                  {copiedId === item.id ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                  <span>{copiedId === item.id ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
