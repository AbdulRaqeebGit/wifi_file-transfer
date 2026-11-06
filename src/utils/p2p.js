import { Peer } from 'peerjs';

// ── Transfer constants ──────────────────────────────────────────────────────
// SCTP hard-limit is 65 535 bytes; stay safely under with 60 KB chunks.
const CHUNK_SIZE = 60 * 1024;         // 61 440 bytes per WebRTC message
const BLOCK_SIZE = 8 * 1024 * 1024;  // 8 MB read-slice (keeps CPU busy, safe RAM)
const BUFFER_HIGH = 8 * 1024 * 1024; // pause sending above 8 MB bufferedAmount
const BUFFER_LOW  = 1 * 1024 * 1024; // resume when bufferedAmount drops below 1 MB

export class P2PManager {
  constructor(callbacks = {}) {
    this.peer = null;
    this.conn = null;
    this.myCode = '';
    this.peerId = '';
    this.activeTransfer = null;
    this.receivingFile = null;

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

    this.initPeer();
  }

  // ── Peer initialisation ────────────────────────────────────────────────────
  generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  initPeer() {
    this.myCode = this.generateCode();
    this.peerId = `arw-${this.myCode}`;

    this.peer = new Peer(this.peerId, {
      debug: 0,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' },
        ],
      },
    });

    this.peer.on('open', (id) => {
      this.callbacks.onReady({ fullPeerId: id, code: this.myCode });
    });

    this.peer.on('connection', (conn) => {
      this.setupConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.warn('Peer error:', err.type, err.message);
      if (err.type === 'unavailable-id') {
        this.peer?.destroy();
        this.myCode = this.generateCode();
        this.initPeer();
      } else {
        this.callbacks.onError(err.message || 'Connection error');
      }
    });

    this.peer.on('disconnected', () => {
      if (this.peer && !this.peer.destroyed) this.peer.reconnect();
    });
  }

  // ── Outgoing connection ────────────────────────────────────────────────────
  connectToPeer(targetCode) {
    if (!this.peer || !this.peer.open) {
      this.callbacks.onError('Peer not ready yet. Please wait a moment.');
      return;
    }
    const clean = targetCode.trim().replace(/^arw-/, '');
    if (clean === this.myCode) {
      this.callbacks.onError('Cannot connect to your own code!');
      return;
    }
    this.callbacks.onConnecting({ remoteCode: clean });
    const conn = this.peer.connect(`arw-${clean}`, { reliable: true });
    this.setupConnection(conn);
  }

  // ── Shared connection wiring ───────────────────────────────────────────────
  setupConnection(conn) {
    if (this.conn?.open) {
      try { this.conn.close(); } catch {}
    }
    this.conn = conn;

    // Set bufferedAmountLowThreshold on the underlying RTCDataChannel
    conn.on('open', () => {
      const remoteCode = conn.peer.replace(/^arw-/, '');
      this.callbacks.onConnected({ remotePeerId: conn.peer, remoteCode });

      // Tune the native DataChannel for maximum throughput
      if (conn.dataChannel) {
        conn.dataChannel.bufferedAmountLowThreshold = BUFFER_LOW;
      }
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
      console.error('DataChannel error:', err);
      this.callbacks.onError('Connection error with peer');
    });
  }

  // ── Incoming data handler ──────────────────────────────────────────────────
  async handleIncomingData(data) {
    if (!data) return;

    // ── text ──
    if (data.type === 'text') {
      this.callbacks.onTextReceived({
        id: `${Date.now()}-${Math.random()}`,
        text: data.text,
        timestamp: data.timestamp || new Date().toISOString(),
      });
      return;
    }

    // ── link ──
    if (data.type === 'link') {
      this.callbacks.onLinkReceived({
        id: `${Date.now()}-${Math.random()}`,
        url: data.url,
        title: data.title || data.url,
        timestamp: data.timestamp || new Date().toISOString(),
      });
      return;
    }

    // ── cancel ──
    if (data.type === 'file-cancel') {
      if (this.receivingFile?.id === data.id) this.receivingFile = null;
      this.activeTransfer = null;
      this.callbacks.onTransferCancelled({ fileId: data.id, byRemote: true });
      return;
    }

    // ── file-start ──
    if (data.type === 'file-start') {
      // NOTE: We intentionally do NOT use showSaveFilePicker here.
      // All files are buffered in memory as blobs so the user can
      // manually click "Download" whenever they want. No auto-save.
      this.receivingFile = {
        id: data.id,
        name: data.name,
        size: data.size,
        mimeType: data.mimeType,
        chunksTotal: data.chunksTotal,
        chunksReceived: 0,
        // Rolling 50 MB blob segments to keep RAM bounded for large files
        blobSegments: [],
        currentSegment: [],
        currentSegmentBytes: 0,
        receivedBytes: 0,
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

    // ── file-chunk ──
    if (data.type === 'file-chunk') {
      const rf = this.receivingFile;
      if (!rf || rf.id !== data.id) return;

      const buf = data.chunk;
      const byteLen = buf.byteLength ?? buf.length ?? 0;

      rf.receivedBytes += byteLen;
      rf.chunksReceived++;

      // Accumulate into current 50 MB segment
      rf.currentSegment.push(buf);
      rf.currentSegmentBytes += byteLen;

      if (rf.currentSegmentBytes >= 50 * 1024 * 1024) {
        rf.blobSegments.push(new Blob(rf.currentSegment, { type: rf.mimeType }));
        rf.currentSegment = [];
        rf.currentSegmentBytes = 0;
      }

      // Progress
      const percent = rf.size > 0 ? Math.min(100, Math.round((rf.receivedBytes / rf.size) * 100)) : 0;
      const elapsedSec = (Date.now() - rf.startTime) / 1000;
      const speed = elapsedSec > 0.1 ? rf.receivedBytes / elapsedSec : 0;

      this.callbacks.onTransferProgress({
        fileId: rf.id,
        fileName: rf.name,
        role: 'receiver',
        percent,
        receivedBytes: rf.receivedBytes,
        totalBytes: rf.size,
        speed,
      });

      // ── Transfer complete ──
      const done = rf.receivedBytes >= rf.size || rf.chunksReceived >= rf.chunksTotal;
      if (done) {
        // Flush remaining segment
        if (rf.currentSegment.length > 0) {
          rf.blobSegments.push(new Blob(rf.currentSegment, { type: rf.mimeType }));
        }

        const blob = new Blob(rf.blobSegments, {
          type: rf.mimeType || 'application/octet-stream',
        });

        // Create a stable object URL for preview and download
        const url = URL.createObjectURL(blob);

        const completedFile = {
          id: rf.id,
          name: rf.name,
          size: rf.size,
          mimeType: rf.mimeType,
          blob,       // kept for ZIP-all utility
          url,        // blob URL — user clicks Download to save
          uploadedAt: new Date().toISOString(),
          downloads: 0,
          savedDirectlyToDisk: false,
        };

        // ⚠️ No auto-download here — just fire the callback so the UI
        //    can display the file card with a manual "Download" button.
        this.callbacks.onTransferComplete(completedFile);
        this.receivingFile = null;
        this.activeTransfer = null;
      }
    }
  }

  // ── Cancel ────────────────────────────────────────────────────────────────
  cancelTransfer(fileId) {
    if (this.activeTransfer) this.activeTransfer.aborted = true;

    if (this.conn?.open) {
      try { this.conn.send({ type: 'file-cancel', id: fileId }); } catch {}
    }

    this.receivingFile = null;
    this.activeTransfer = null;
    this.callbacks.onTransferCancelled({
      fileId: fileId || null,
      byRemote: false,
    });
  }

  // ── Text / Link senders ───────────────────────────────────────────────────
  sendText(text) {
    if (!this.conn?.open) throw new Error('Not connected to any peer');
    this.conn.send({ type: 'text', text, timestamp: new Date().toISOString() });
  }

  sendLink(url, title = '') {
    if (!this.conn?.open) throw new Error('Not connected to any peer');
    this.conn.send({ type: 'link', url, title: title || url, timestamp: new Date().toISOString() });
  }

  // ── File sender (ultra-fast pipeline) ────────────────────────────────────
  async sendFile(file, onProgress) {
    if (!this.conn?.open) throw new Error('Not connected to any peer');

    const fileId = `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
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

    // Send metadata header
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

    // ── Pipelined sending: read 8 MB blocks, send 60 KB chunks ──────────────
    for (let blockOffset = 0; blockOffset < fileSize; blockOffset += BLOCK_SIZE) {
      if (transferState.aborted) throw new Error('Transfer cancelled');

      const blockEnd = Math.min(fileSize, blockOffset + BLOCK_SIZE);
      const blockBuffer = await file.slice(blockOffset, blockEnd).arrayBuffer();

      for (let chunkOffset = 0; chunkOffset < blockBuffer.byteLength; chunkOffset += CHUNK_SIZE) {
        if (transferState.aborted) throw new Error('Transfer cancelled');

        const chunk = blockBuffer.slice(chunkOffset, Math.min(blockBuffer.byteLength, chunkOffset + CHUNK_SIZE));

        // ── Backpressure: pause when buffer fills ────────────────────────────
        if (dc && dc.bufferedAmount > BUFFER_HIGH) {
          await new Promise((resolve) => {
            const onLow = () => {
              dc.removeEventListener('bufferedamountlow', onLow);
              resolve();
            };
            dc.addEventListener('bufferedamountlow', onLow);
            // Safety timeout so we never hang forever
            setTimeout(() => {
              dc.removeEventListener('bufferedamountlow', onLow);
              resolve();
            }, 500);
          });
        }

        this.conn.send({ type: 'file-chunk', id: fileId, chunk });
        bytesSent += chunk.byteLength;

        const percent = fileSize > 0 ? Math.min(100, Math.round((bytesSent / fileSize) * 100)) : 0;
        const elapsedSec = (Date.now() - startTime) / 1000;
        const speed = elapsedSec > 0.1 ? bytesSent / elapsedSec : 0;

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

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  disconnect() {
    if (this.conn) {
      try { this.conn.close(); } catch {}
      this.conn = null;
    }
    this.activeTransfer = null;
    this.receivingFile = null;
    try { this.callbacks.onDisconnected(); } catch {}
  }

  destroy() {
    this.disconnect();
    if (this.peer) {
      try { this.peer.destroy(); } catch {}
      this.peer = null;
    }
  }
}
