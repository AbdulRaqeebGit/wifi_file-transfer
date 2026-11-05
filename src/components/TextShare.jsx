import React, { useState } from 'react';
import { Send, Copy, Check, MessageSquare, Trash2 } from 'lucide-react';
import { sound } from '../utils/sound';
import { formatTimeAgo } from '../utils/formatters';

export default function TextShare({ isConnected, onSendText, textHistory = [], onClearHistory }) {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const handleSend = (e) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    if (!isConnected) {
      alert('Please connect to a device first to send text messages!');
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
            <MessageSquare size={16} color="#BC0202" />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Text & Notes Transfer
            </h3>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: 0 }}>
              Instantly share clipboard text, passwords, OTPs, or messages
            </p>
          </div>
        </div>

        {textHistory.length > 0 && (
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
      <form onSubmit={handleSend} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <textarea
          rows={2}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={isConnected ? 'Type or paste any text or note here...' : 'Connect to a device to send text...'}
          disabled={!isConnected}
          style={{
            flex: 1,
            backgroundColor: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: '0.88rem',
            fontFamily: 'var(--font-sans)',
            resize: 'vertical',
            outline: 'none',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />

        <button
          type="submit"
          disabled={!isConnected || !inputText.trim()}
          className="btn-primary"
          style={{ padding: '10px 18px', height: 42 }}
        >
          <Send size={15} />
          <span>Send</span>
        </button>
      </form>

      {/* History */}
      {textHistory.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
          {textHistory.map((item) => (
            <div
              key={item.id}
              style={{
                backgroundColor: item.isMine ? '#fff5f5' : '#f8fafc',
                border: `1px solid ${item.isMine ? '#fca5a5' : '#e2e8f0'}`,
                borderRadius: 8,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
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
                <div style={{
                  fontSize: '0.86rem',
                  color: 'var(--text-main)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'var(--font-sans)',
                }}>
                  {item.text}
                </div>
              </div>

              <button
                onClick={() => handleCopy(item.id, item.text)}
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
                  flexShrink: 0,
                }}
                title="Copy to clipboard"
              >
                {copiedId === item.id ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                <span>{copiedId === item.id ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
