import { Peer } from 'peerjs';

const CHUNK_SIZE = 64 * 1024; // 64 KB chunk for high throughput WebRTC transfer
const BUFFER_THRESHOLD = 8 * 1024 * 1024; // 8 MB buffer threshold for backpressure

export class P2PManager {
  constructor(callbacks = {}) {
    this.peer = null;
    this.conn = null;
    this.peerId = null;
    this.displayCode = '';
    this.callbacks = {
      onReady: () => {},
      onConnected: () => {},
      onDisconnected: () => {},
      onTextReceived: () => {},
      onLinkReceived: () => {},
      onFileProgress: () => {},
      onFileReceived: () => {},
      onError: () => {},
      ...callbacks,
    };

    this.receivingFiles = {}; // id -> { name, size, mimeType, chunksTotal, chunksReceived, chunks: [] }
    this.initPeer();
  }

  generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  initPeer() {
    this.displayCode = this.generateCode();
    const fullPeerId = `ar-wifi-${this.displayCode}`;

    this.peer = new Peer(fullPeerId, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
        ],
      },
    });

    this.peer.on('open', (id) => {
      this.peerId = id;
      this.callbacks.onReady({ fullPeerId: id, code: this.displayCode });
    });

    this.peer.on('connection', (conn) => {
      this.handleConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.warn('Peer error:', err);
      // If code was taken, try again with fresh code
      if (err.type === 'unavailable-id') {
        this.displayCode = this.generateCode();
        this.peer.destroy();
        this.initPeer();
      } else {
        this.callbacks.onError(err.message || 'Connection error');
      }
    });
  }

  connectToPeer(targetCode) {
    if (!this.peer) return;
    const cleanCode = targetCode.trim().replace(/^ar-wifi-/, '');
    const targetPeerId = `ar-wifi-${cleanCode}`;

    const conn = this.peer.connect(targetPeerId, {
      reliable: true,
      serialization: 'binary',
    });

    this.handleConnection(conn);
  }

  handleConnection(conn) {
    if (this.conn && this.conn.open) {
      // already connected, close old
      this.conn.close();
    }
    this.conn = conn;

    conn.on('open', () => {
      const remoteCode = conn.peer.replace(/^ar-wifi-/, '');
      this.callbacks.onConnected({ remotePeerId: conn.peer, remoteCode });
    });

    conn.on('data', (data) => {
      this.handleIncomingData(data);
    });

    conn.on('close', () => {
      this.callbacks.onDisconnected();
      this.conn = null;
    });

    conn.on('error', (err) => {
      console.error('Conn error:', err);
      this.callbacks.onError('Connection disrupted');
    });
  }

  handleIncomingData(data) {
    if (!data) return;

    if (data.type === 'text') {
      this.callbacks.onTextReceived({
        id: Date.now() + Math.random().toString(),
        text: data.text,
        timestamp: data.timestamp || new Date().toISOString(),
      });
      return;
    }

    if (data.type === 'link') {
      this.callbacks.onLinkReceived({
        id: Date.now() + Math.random().toString(),
        url: data.url,
        title: data.title || data.url,
        timestamp: data.timestamp || new Date().toISOString(),
      });
      return;
    }

    if (data.type === 'file-header') {
      this.receivingFiles[data.id] = {
        id: data.id,
        name: data.name,
        size: data.size,
        mimeType: data.mimeType,
        chunksTotal: data.chunksTotal,
        chunksReceived: 0,
        chunks: new Array(data.chunksTotal),
        receivedBytes: 0,
      };
      this.callbacks.onFileProgress({
        fileId: data.id,
        name: data.name,
        percent: 0,
        isReceiving: true,
      });
      return;
    }

    if (data.type === 'file-chunk') {
      const fileInfo = this.receivingFiles[data.id];
      if (!fileInfo) return;

      fileInfo.chunks[data.index] = data.chunk;
      fileInfo.chunksReceived++;
      fileInfo.receivedBytes += (data.chunk ? data.chunk.byteLength || data.chunk.length || 0 : 0);

      const percent = Math.min(100, Math.round((fileInfo.chunksReceived / fileInfo.chunksTotal) * 100));
      this.callbacks.onFileProgress({
        fileId: data.id,
        name: fileInfo.name,
        percent,
        isReceiving: true,
      });

      if (fileInfo.chunksReceived >= fileInfo.chunksTotal) {
        const blob = new Blob(fileInfo.chunks, { type: fileInfo.mimeType || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);

        this.callbacks.onFileReceived({
          id: fileInfo.id,
          name: fileInfo.name,
          size: fileInfo.size,
          mimeType: fileInfo.mimeType,
          blob,
          url,
          uploadedAt: new Date().toISOString(),
          downloads: 0,
        });

        delete this.receivingFiles[data.id];
      }
    }
  }

  sendText(text) {
    if (!this.conn || !this.conn.open) throw new Error('Not connected to any peer');
    const payload = {
      type: 'text',
      text,
      timestamp: new Date().toISOString(),
    };
    this.conn.send(payload);
  }

  sendLink(url, title = '') {
    if (!this.conn || !this.conn.open) throw new Error('Not connected to any peer');
    const payload = {
      type: 'link',
      url,
      title: title || url,
      timestamp: new Date().toISOString(),
    };
    this.conn.send(payload);
  }

  async sendFile(file, onProgress) {
    if (!this.conn || !this.conn.open) throw new Error('Not connected to any peer');

    const fileId = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const fileSize = file.size;
    const chunksTotal = Math.ceil(fileSize / CHUNK_SIZE);

    // Send header
    this.conn.send({
      type: 'file-header',
      id: fileId,
      name: file.name,
      size: fileSize,
      mimeType: file.type || 'application/octet-stream',
      chunksTotal,
    });

    const dataChannel = this.conn.dataChannel;

    for (let index = 0; index < chunksTotal; index++) {
      const start = index * CHUNK_SIZE;
      const end = Math.min(fileSize, start + CHUNK_SIZE);
      const slice = file.slice(start, end);
      const buffer = await slice.arrayBuffer();

      // Backpressure handling: wait if buffer is too full
      if (dataChannel && dataChannel.bufferedAmount > BUFFER_THRESHOLD) {
        await new Promise((resolve) => {
          const checkBuffer = () => {
            if (dataChannel.bufferedAmount <= BUFFER_THRESHOLD / 2) {
              resolve();
            } else {
              setTimeout(checkBuffer, 25);
            }
          };
          checkBuffer();
        });
      }

      this.conn.send({
        type: 'file-chunk',
        id: fileId,
        index,
        chunk: buffer,
      });

      if (onProgress) {
        const percent = Math.min(100, Math.round(((index + 1) / chunksTotal) * 100));
        onProgress(percent);
      }
    }
  }

  disconnect() {
    if (this.conn) {
      this.conn.close();
      this.conn = null;
    }
  }

  destroy() {
    this.disconnect();
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}
