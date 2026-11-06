import React, { useState } from 'react';
import { Send, Copy, Check, MessageSquare, Trash2 } from 'lucide-react';
import { sound } from '../utils/sound';
import { formatTimeAgo } from '../utils/formatters';

export default function TextShare({
  isConnected,
  onSendText,
  textHistory = [],
  onClearHistory,
  onDeleteText,
  title = 'Text & Notes Transfer',
  subTitle = 'Instantly share clipboard text, passwords, OTPs, or messages',
}) {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const handleSend = (e) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    if (!isConnected) {
      alert('WiFi Hub is offline. Please check connection.');
      return;
    }
    sound.playClick();
    onSendText(inputText.trim());
    setInputText('');
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    sound.playClick();
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this text message?')) return;
    sound.playClick();
    if (onDeleteText) onDeleteText(id);
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
            <MessageSquare size={16} color="#BC0202" />
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

        {textHistory.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm('Clear all text messages?')) {
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
      <form onSubmit={handleSend} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <textarea
          rows={2}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              handleSend(e);
            }
          }}
          placeholder="Type or paste text here (Ctrl+Enter to send)..."
          className="clean-input"
          style={{ flex: 1, resize: 'vertical', minHeight: 44, padding: '8px 12px' }}
        />
        <button
          type="submit"
          disabled={!inputText.trim() || !isConnected}
          className="btn-primary"
          style={{ padding: '10px 16px', height: 44, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Send size={15} />
          <span>Send</span>
        </button>
      </form>

      {/* History List */}
      <div style={{ marginTop: 16 }}>
        {textHistory.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '24px 12px',
            color: 'var(--text-muted)',
            fontSize: '0.84rem',
            backgroundColor: '#f8fafc',
            borderRadius: 8,
            border: '1px dashed #cbd5e1',
          }}>
            No text shared yet. Paste text or messages above to share!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
            {textHistory.map((item) => (
              <div
                key={item.id}
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '10px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <pre style={{
                    margin: 0,
                    fontFamily: 'inherit',
                    fontSize: '0.86rem',
                    color: 'var(--text-main)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {item.text}
                  </pre>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    {formatTimeAgo(item.timestamp)}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => handleCopy(item.id, item.text)}
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
                    title="Copy text"
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
                    title="Delete message"
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
