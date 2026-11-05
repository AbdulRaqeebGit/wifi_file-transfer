import { Peer } from 'peerjs';

// Safe SCTP packet size for all Chromium, Firefox, Safari browsers (strictly <= 65535 bytes)
const CHUNK_SIZE = 64 * 1024 - 128; // 65,408 bytes (fits perfectly in 64 KiB SCTP packet)
const BLOCK_SIZE = 4 * 1024 * 1024; // 4 MB read block (memory safe even for 5GB+ files)
const BUFFER_HIGH = 8 * 1024 * 1024; // 8 MB high watermark
const BUFFER_LOW = 2 * 1024 * 1024; // 2 MB resume watermark

export class FastP2PManager {
  constructor(callbacks = {}) {
    this.peer = null;
    this.conn = null;
    this.rawChannel = null;
    this.peerId = null;
    this.displayCode = '';
    this.activeTransfer = null;

    this.callbacks = {
      onReady: () => {},
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
      if (err.type === 'unavailable-id') {
        this.displayCode = this.generateCode();
        this.peer?.destroy();
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
      serialization: 'none',
    });

    this.handleConnection(conn);
  }

  handleConnection(conn) {
    if (this.conn && this.conn.open) {
      this.conn.close();
    }
    this.conn = conn;

    conn.on('open', () => {
      const dc = conn.dataChannel;
      this.rawChannel = dc;
      if (dc) {
        dc.binaryType = 'arraybuffer';
        dc.bufferedAmountLowThreshold = BUFFER_LOW;

        dc.onmessage = (event) => {
          this.handleRawData(event.data);
        };
      }

      const remoteCode = conn.peer.replace(/^ar-wifi-/, '');
      this.callbacks.onConnected({ remotePeerId: conn.peer, remoteCode });
    });

    conn.on('close', () => {
      this.callbacks.onDisconnected();
      this.conn = null;
      this.rawChannel = null;
      this.activeTransfer = null;
      this.receivingFile = null;
    });

    conn.on('error', (err) => {
      console.error('Conn error:', err);
      this.callbacks.onError('Connection disrupted');
    });
  }

  async handleRawData(data) {
    // 1. Control & Metadata packets
    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data);
        await this.handleControlMessage(msg);
      } catch (err) {
        console.error('JSON parse error:', err);
      }
      return;
    }

    // 2. Binary Chunk packet
    if (data instanceof ArrayBuffer) {
      if (!this.receivingFile) return;

      const rf = this.receivingFile;
      rf.receivedBytes += data.byteLength;
      rf.chunksReceived++;

      // If direct disk streaming handle is available (for 5GB+ files)
      if (rf.writableStream) {
        try {
          await rf.writableStream.write(data);
        } catch (err) {
          console.warn('Direct disk write error:', err);
        }
      } else {
        // In-memory segmented chunks (segmented into 100MB blobs to prevent memory fragmentation)
        rf.currentSegment.push(data);
        rf.currentSegmentBytes += data.byteLength;

        // If current segment reaches 50MB, consolidate into a Blob to free ArrayBuffer memory
        if (rf.currentSegmentBytes >= 50 * 1024 * 1024) {
          const segBlob = new Blob(rf.currentSegment, { type: rf.mimeType });
          rf.blobSegments.push(segBlob);
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

      if (rf.receivedBytes >= rf.size) {
        // Complete transfer
        if (rf.writableStream) {
          try {
            await rf.writableStream.close();
          } catch (err) {
            console.error('Error closing disk stream:', err);
          }
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

  async handleControlMessage(msg) {
    if (msg.type === 'text') {
      this.callbacks.onTextReceived({
        id: Date.now() + Math.random().toString(),
        text: msg.text,
        timestamp: msg.timestamp || new Date().toISOString(),
      });
      return;
    }

    if (msg.type === 'link') {
      this.callbacks.onLinkReceived({
        id: Date.now() + Math.random().toString(),
        url: msg.url,
        title: msg.title || msg.url,
        timestamp: msg.timestamp || new Date().toISOString(),
      });
      return;
    }

    if (msg.type === 'file-start') {
      let writableStream = null;

      // For huge files (> 1.5 GB), prompt for direct disk save if supported to prevent browser tab crash
      if (msg.size > 1.5 * 1024 * 1024 * 1024 && typeof window.showSaveFilePicker === 'function') {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: msg.name,
          });
          writableStream = await handle.createWritable();
        } catch (e) {
          console.warn('User cancelled save picker or not supported, using segmented buffer:', e);
        }
      }

      this.receivingFile = {
        id: msg.id,
        name: msg.name,
        size: msg.size,
        mimeType: msg.mimeType,
        chunksTotal: msg.chunksTotal,
        chunksReceived: 0,
        blobSegments: [],
        currentSegment: [],
        currentSegmentBytes: 0,
        receivedBytes: 0,
        writableStream,
        startTime: Date.now(),
      };

      this.activeTransfer = {
        fileId: msg.id,
        fileName: msg.name,
        role: 'receiver',
        totalBytes: msg.size,
      };

      this.callbacks.onTransferStart({
        fileId: msg.id,
        fileName: msg.name,
        totalBytes: msg.size,
        role: 'receiver',
      });
      return;
    }

    if (msg.type === 'file-cancel') {
      const cancelledId = msg.id;
      if (this.receivingFile) {
        if (this.receivingFile.writableStream) {
          try {
            await this.receivingFile.writableStream.abort();
          } catch {}
        }
        this.receivingFile = null;
      }
      if (this.activeTransfer && this.activeTransfer.fileId === cancelledId) {
        this.activeTransfer = null;
      }
      this.callbacks.onTransferCancelled({ fileId: cancelledId, byRemote: true });
    }
  }

  cancelTransfer(fileId) {
    if (this.activeTransfer) {
      this.activeTransfer.aborted = true;
    }

    if (this.rawChannel && this.rawChannel.readyState === 'open') {
      try {
        this.rawChannel.send(JSON.stringify({ type: 'file-cancel', id: fileId }));
      } catch (err) {
        console.warn('Error sending cancel message:', err);
      }
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
    if (!this.rawChannel || this.rawChannel.readyState !== 'open') throw new Error('Not connected');
    this.rawChannel.send(JSON.stringify({
      type: 'text',
      text,
      timestamp: new Date().toISOString(),
    }));
  }

  sendLink(url, title = '') {
    if (!this.rawChannel || this.rawChannel.readyState !== 'open') throw new Error('Not connected');
    this.rawChannel.send(JSON.stringify({
      type: 'link',
      url,
      title: title || url,
      timestamp: new Date().toISOString(),
    }));
  }

  // Ultra-fast streaming file transmission (5GB+ supported)
  async sendFile(file, onProgress) {
    const dc = this.rawChannel;
    if (!dc || dc.readyState !== 'open') throw new Error('Not connected to any peer');

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

    // Send metadata header as JSON string
    dc.send(JSON.stringify({
      type: 'file-start',
      id: fileId,
      name: file.name,
      size: fileSize,
      mimeType: file.type || 'application/octet-stream',
      chunksTotal,
    }));

    const startTime = Date.now();
    let bytesSent = 0;

    // Read file in 4MB memory blocks
    for (let blockOffset = 0; blockOffset < fileSize; blockOffset += BLOCK_SIZE) {
      if (transferState.aborted) {
        throw new Error('Transfer cancelled');
      }

      const blockEnd = Math.min(fileSize, blockOffset + BLOCK_SIZE);
      const blockSlice = file.slice(blockOffset, blockEnd);
      const blockBuffer = await blockSlice.arrayBuffer();

      // Dispatch safe 64KB SCTP chunks (strictly under 65,535 bytes to prevent max-message-size error!)
      for (let chunkOffset = 0; chunkOffset < blockBuffer.byteLength; chunkOffset += CHUNK_SIZE) {
        if (transferState.aborted) {
          throw new Error('Transfer cancelled');
        }

        const chunkEnd = Math.min(blockBuffer.byteLength, chunkOffset + CHUNK_SIZE);
        const chunk = blockBuffer.slice(chunkOffset, chunkEnd);

        // Native WebRTC backpressure check
        if (dc.bufferedAmount > BUFFER_HIGH) {
          await new Promise((resolve) => {
            const onLow = () => {
              dc.removeEventListener('bufferedamountlow', onLow);
              resolve();
            };
            dc.addEventListener('bufferedamountlow', onLow);
            setTimeout(() => {
              dc.removeEventListener('bufferedamountlow', onLow);
              resolve();
            }, 250);
          });
        }

        // Direct binary send (strictly 65,408 bytes max)
        dc.send(chunk);
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
      this.conn.close();
      this.conn = null;
      this.rawChannel = null;
    }
    this.activeTransfer = null;
    this.receivingFile = null;
  }

  destroy() {
    this.disconnect();
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}
