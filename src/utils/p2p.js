import { Peer } from 'peerjs';

// Safe chunk size for WebRTC SCTP (strictly under 64 KiB)
const CHUNK_SIZE = 60 * 1024; // 61,440 bytes (safely under 65,535 bytes)
const BLOCK_SIZE = 4 * 1024 * 1024; // 4 MB read block (memory safe for 5GB+ files)
const BUFFER_HIGH = 4 * 1024 * 1024; // 4 MB backpressure threshold

export class P2PManager {
  constructor(callbacks = {}) {
    this.peer = null;
    this.conn = null;
    this.myCode = '';
    this.peerId = '';
    this.activeTransfer = null;

    this.callbacks = {
      onReady: () => {},
      onConnecting: () => {},
      onConnected: () => {},
      onDisconnected: () => {},
      onTextReceived: () => {},
      onLinkReceived: () => {},
      onTransferStart: () => {},
      onTransferProgress: () => {},
      onTransferComplete: () => {},
      onTransferCancelled: () => {},
      onError: () => {},
      ...callbacks,
    };

    this.receivingFile = null;
    this.initPeer();
  }

  generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  initPeer() {
    this.myCode = this.generateCode();
    this.peerId = `arw-${this.myCode}`;

    this.peer = new Peer(this.peerId, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' },
          { urls: 'stun:global.stun.twilio.com:3478' },
        ],
      },
    });

    this.peer.on('open', (id) => {
      this.callbacks.onReady({ fullPeerId: id, code: this.myCode });
    });

    // When someone connects to ME
    this.peer.on('connection', (conn) => {
      this.setupConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.warn('Peer error:', err);
      if (err.type === 'unavailable-id') {
        this.myCode = this.generateCode();
        this.peer?.destroy();
        this.initPeer();
      } else {
        this.callbacks.onError(err.message || 'Connection error');
      }
    });

    this.peer.on('disconnected', () => {
      // Reconnect to signaling server if disconnected
      if (this.peer && !this.peer.destroyed) {
        this.peer.reconnect();
      }
    });
  }

  connectToPeer(targetCode) {
    if (!this.peer || !this.peer.open) {
      this.callbacks.onError('Peer not ready yet. Please wait a second.');
      return;
    }

    const clean = targetCode.trim().replace(/^arw-/, '');
    if (clean === this.myCode) {
      this.callbacks.onError('Cannot connect to your own code!');
      return;
    }

    const targetPeerId = `arw-${clean}`;
    this.callbacks.onConnecting({ remoteCode: clean });

    const conn = this.peer.connect(targetPeerId, {
      reliable: true,
    });

    this.setupConnection(conn);
  }

  setupConnection(conn) {
    if (this.conn && this.conn.open) {
      try {
        this.conn.close();
      } catch {}
    }

    this.conn = conn;

    conn.on('open', () => {
      const remoteCode = conn.peer.replace(/^arw-/, '');
      this.callbacks.onConnected({ remotePeerId: conn.peer, remoteCode });
    });

    conn.on('data', async (data) => {
      await this.handleIncomingData(data);
    });

    conn.on('close', () => {
      this.callbacks.onDisconnected();
      this.conn = null;
      this.activeTransfer = null;
      this.receivingFile = null;
    });

    conn.on('error', (err) => {
      console.error('Data connection error:', err);
      this.callbacks.onError('Connection error with peer');
    });
  }

  async handleIncomingData(data) {
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

    if (data.type === 'file-cancel') {
      if (this.receivingFile && this.receivingFile.id === data.id) {
        this.receivingFile = null;
      }
      this.activeTransfer = null;
      this.callbacks.onTransferCancelled({ fileId: data.id, byRemote: true });
      return;
    }

    if (data.type === 'file-start') {
      let writableStream = null;

      // Direct disk streaming for 1.5GB+ files if showSaveFilePicker supported
      if (data.size > 1.5 * 1024 * 1024 * 1024 && typeof window.showSaveFilePicker === 'function') {
        try {
          const handle = await window.showSaveFilePicker({ suggestedName: data.name });
          writableStream = await handle.createWritable();
        } catch {
          // user cancelled picker or fallback
        }
      }

      this.receivingFile = {
        id: data.id,
        name: data.name,
        size: data.size,
        mimeType: data.mimeType,
        chunksTotal: data.chunksTotal,
        chunksReceived: 0,
        blobSegments: [],
        currentSegment: [],
        currentSegmentBytes: 0,
        receivedBytes: 0,
        writableStream,
        startTime: Date.now(),
      };

      this.activeTransfer = {
        fileId: data.id,
        fileName: data.name,
        role: 'receiver',
        totalBytes: data.size,
        receivedBytes: 0,
        percent: 0,
        speed: 0,
      };

      this.callbacks.onTransferStart({
        fileId: data.id,
        fileName: data.name,
        totalBytes: data.size,
        role: 'receiver',
      });
      return;
    }

    if (data.type === 'file-chunk') {
      const rf = this.receivingFile;
      if (!rf || rf.id !== data.id) return;

      const chunkBuffer = data.chunk;
      const byteLen = chunkBuffer.byteLength || chunkBuffer.length || 0;
      rf.receivedBytes += byteLen;
      rf.chunksReceived++;

      if (rf.writableStream) {
        try {
          await rf.writableStream.write(chunkBuffer);
        } catch {}
      } else {
        rf.currentSegment.push(chunkBuffer);
        rf.currentSegmentBytes += byteLen;

        // Consolidate into 50MB blobs to keep memory strictly optimized
        if (rf.currentSegmentBytes >= 50 * 1024 * 1024) {
          rf.blobSegments.push(new Blob(rf.currentSegment, { type: rf.mimeType }));
          rf.currentSegment = [];
          rf.currentSegmentBytes = 0;
        }
      }

      const percent = rf.size > 0 ? Math.min(100, Math.round((rf.receivedBytes / rf.size) * 100)) : 0;
      const elapsedSec = (Date.now() - rf.startTime) / 1000;
      const speed = elapsedSec > 0.2 ? rf.receivedBytes / elapsedSec : 0;

      this.callbacks.onTransferProgress({
        fileId: rf.id,
        fileName: rf.name,
        role: 'receiver',
        percent,
        receivedBytes: rf.receivedBytes,
        totalBytes: rf.size,
        speed,
      });

      if (rf.receivedBytes >= rf.size || rf.chunksReceived >= rf.chunksTotal) {
        if (rf.writableStream) {
          try {
            await rf.writableStream.close();
          } catch {}
        }

        let blob = null;
        let url = null;

        if (rf.blobSegments.length > 0 || rf.currentSegment.length > 0) {
          if (rf.currentSegment.length > 0) {
            rf.blobSegments.push(new Blob(rf.currentSegment, { type: rf.mimeType }));
          }
          blob = new Blob(rf.blobSegments, { type: rf.mimeType || 'application/octet-stream' });
          url = URL.createObjectURL(blob);
        }

        const completedFile = {
          id: rf.id,
          name: rf.name,
          size: rf.size,
          mimeType: rf.mimeType,
          blob,
          url,
          uploadedAt: new Date().toISOString(),
          downloads: 0,
          savedDirectlyToDisk: !!rf.writableStream,
        };

        this.callbacks.onTransferComplete(completedFile);
        this.receivingFile = null;
        this.activeTransfer = null;
      }
    }
  }

  cancelTransfer(fileId) {
    if (this.activeTransfer) {
      this.activeTransfer.aborted = true;
    }

    if (this.conn && this.conn.open) {
      try {
        this.conn.send({ type: 'file-cancel', id: fileId });
      } catch {}
    }

    if (this.receivingFile) {
      if (this.receivingFile.writableStream) {
        try {
          this.receivingFile.writableStream.abort();
        } catch {}
      }
      this.receivingFile = null;
    }

    const cancelledId = fileId || (this.activeTransfer && this.activeTransfer.fileId);
    this.activeTransfer = null;
    this.callbacks.onTransferCancelled({ fileId: cancelledId, byRemote: false });
  }

  sendText(text) {
    if (!this.conn || !this.conn.open) throw new Error('Not connected to any peer');
    this.conn.send({
      type: 'text',
      text,
      timestamp: new Date().toISOString(),
    });
  }

  sendLink(url, title = '') {
    if (!this.conn || !this.conn.open) throw new Error('Not connected to any peer');
    this.conn.send({
      type: 'link',
      url,
      title: title || url,
      timestamp: new Date().toISOString(),
    });
  }

  async sendFile(file, onProgress) {
    if (!this.conn || !this.conn.open) throw new Error('Not connected to any peer');

    const fileId = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const fileSize = file.size;
    const chunksTotal = Math.ceil(fileSize / CHUNK_SIZE);

    const transferState = {
      fileId,
      fileName: file.name,
      role: 'sender',
      totalBytes: fileSize,
      aborted: false,
    };
    this.activeTransfer = transferState;

    this.callbacks.onTransferStart({
      fileId,
      fileName: file.name,
      totalBytes: fileSize,
      role: 'sender',
    });

    // Send header
    this.conn.send({
      type: 'file-start',
      id: fileId,
      name: file.name,
      size: fileSize,
      mimeType: file.type || 'application/octet-stream',
      chunksTotal,
    });

    const dc = this.conn.dataChannel;
    let bytesSent = 0;
    const startTime = Date.now();

    // Read in 4MB memory blocks
    for (let blockOffset = 0; blockOffset < fileSize; blockOffset += BLOCK_SIZE) {
      if (transferState.aborted) throw new Error('Transfer cancelled');

      const blockEnd = Math.min(fileSize, blockOffset + BLOCK_SIZE);
      const blockSlice = file.slice(blockOffset, blockEnd);
      const blockBuffer = await blockSlice.arrayBuffer();

      // Chunk the 4MB block into 60KB safe chunks
      for (let chunkOffset = 0; chunkOffset < blockBuffer.byteLength; chunkOffset += CHUNK_SIZE) {
        if (transferState.aborted) throw new Error('Transfer cancelled');

        const chunkEnd = Math.min(blockBuffer.byteLength, chunkOffset + CHUNK_SIZE);
        const chunk = blockBuffer.slice(chunkOffset, chunkEnd);

        // Native WebRTC backpressure check
        if (dc && dc.bufferedAmount > BUFFER_HIGH) {
          await new Promise((resolve) => {
            const onLow = () => {
              dc.removeEventListener('bufferedamountlow', onLow);
              resolve();
            };
            dc.addEventListener('bufferedamountlow', onLow);
            setTimeout(() => {
              dc.removeEventListener('bufferedamountlow', onLow);
              resolve();
            }, 200);
          });
        }

        this.conn.send({
          type: 'file-chunk',
          id: fileId,
          chunk,
        });

        bytesSent += chunk.byteLength;

        const percent = fileSize > 0 ? Math.min(100, Math.round((bytesSent / fileSize) * 100)) : 0;
        const elapsedSec = (Date.now() - startTime) / 1000;
        const speed = elapsedSec > 0.2 ? bytesSent / elapsedSec : 0;

        if (onProgress) {
          onProgress({ percent, bytesSent, totalBytes: fileSize, speed, fileId });
        }

        this.callbacks.onTransferProgress({
          fileId,
          fileName: file.name,
          role: 'sender',
          percent,
          receivedBytes: bytesSent,
          totalBytes: fileSize,
          speed,
        });
      }
    }

    this.activeTransfer = null;
  }

  disconnect() {
    if (this.conn) {
      try {
        this.conn.close();
      } catch {}
      this.conn = null;
    }
    this.activeTransfer = null;
    this.receivingFile = null;
  }

  destroy() {
    this.disconnect();
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {}
      this.peer = null;
    }
  }
}
