import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { createRequire } from 'module';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const archiver = require('archiver');
const QRCode = require('qrcode');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DB_FILE = path.join(__dirname, 'uploads_meta.json');
const TEXT_DB_FILE = path.join(__dirname, 'texts_meta.json');
const LINK_DB_FILE = path.join(__dirname, 'links_meta.json');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Helpers for metadata storage
function loadJson(file, fallback = []) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
  }
  return fallback;
}

function saveJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
  }
}

let filesDb = loadJson(DB_FILE, []);
let textDb = loadJson(TEXT_DB_FILE, []);
let linkDb = loadJson(LINK_DB_FILE, []);

// Validate that physical files still exist in uploads directory
filesDb = filesDb.filter((f) => {
  const filePath = path.join(UPLOAD_DIR, f.storedName);
  return fs.existsSync(filePath);
});
saveJson(DB_FILE, filesDb);

// Multer disk storage engine (direct disk streaming, no RAM buffering)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// High-speed transfer configuration: up to 50 files per batch, unlimited size (50GB+ supported)
const upload = multer({
  storage,
  limits: {
    files: 50,
    fileSize: Infinity, // No file size limit
  },
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Optimize TCP sockets for maximum LAN transfer speed (disable Nagle's algorithm)
app.use((req, res, next) => {
  if (req.socket) {
    req.socket.setNoDelay(true);
    req.socket.setKeepAlive(true, 60000);
  }
  next();
});

// SSE clients for real-time synchronization
let sseClients = [];

function notifyClients(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((res) => {
    try {
      res.write(payload);
    } catch {
      // client disconnected
    }
  });
}

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  sseClients.push(res);
  res.write(`event: connected\ndata: {"status":"connected","clients":${sseClients.length}}\n\n`);
  notifyClients('clients-count', { count: sseClients.length });

  req.on('close', () => {
    sseClients = sseClients.filter((client) => client !== res);
    notifyClients('clients-count', { count: sseClients.length });
  });
});

// Helper to get local network IPv4 addresses (prioritize WiFi / LAN)
function getNetworkIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push({ name, address: net.address });
      }
    }
  }

  // Sort Wi-Fi or wireless first
  ips.sort((a, b) => {
    const aIsWifi = /wi-?fi|wlan|wireless/i.test(a.name);
    const bIsWifi = /wi-?fi|wlan|wireless/i.test(b.name);
    if (aIsWifi && !bIsWifi) return -1;
    if (!aIsWifi && bIsWifi) return 1;
    return 0;
  });

  return ips;
}

// Server info & QR code
app.get('/api/info', async (req, res) => {
  try {
    const ips = getNetworkIps();
    const primaryIp = ips.length > 0 ? ips[0].address : 'localhost';
    const networkUrl = `http://${primaryIp}:${PORT}`;
    const qrDataUrl = await QRCode.toDataURL(networkUrl, {
      margin: 2,
      scale: 8,
      color: {
        dark: '#BC0202',
        light: '#ffffff',
      },
    });

    const totalSize = filesDb.reduce((acc, f) => acc + (f.size || 0), 0);

    res.json({
      brand: 'AR|wifi|TR',
      hostname: os.hostname(),
      platform: os.platform(),
      primaryIp,
      ips,
      port: PORT,
      networkUrl,
      qrDataUrl,
      fileCount: filesDb.length,
      totalSize,
      maxBatchFiles: 50,
      activeClients: sseClients.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper to filter DB by scope & deviceId
function filterByScope(list, req) {
  const scope = req.query.scope || req.headers['x-scope'] || 'group';
  const deviceId = req.query.deviceId || req.headers['x-device-id'] || '';

  if (scope === 'private') {
    if (!deviceId) return [];
    return list.filter((item) => item.scope === 'private' && item.deviceId === deviceId);
  }
  // Group scope: return all non-private items
  return list.filter((item) => item.scope !== 'private');
}

// ── Files Endpoints ──────────────────────────────────────────────────────────

// Files list (Group or Private)
app.get('/api/files', (req, res) => {
  const scopedFiles = filterByScope(filesDb, req);
  res.json(scopedFiles);
});

// High-speed disk streaming upload (up to 50 files, any size, Group or Private)
app.post('/api/upload', (req, res) => {
  upload.array('files', 50)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: 'Maximum 50 files allowed per upload batch.' });
      }
      return res.status(500).json({ error: err.message });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files were uploaded.' });
    }

    const scope = req.body.scope === 'private' ? 'private' : 'group';
    const deviceId = req.body.deviceId || req.headers['x-device-id'] || 'anonymous';

    const newEntries = req.files.map((file) => {
      let originalname = file.originalname;
      try {
        originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
      } catch {
        originalname = file.originalname;
      }

      return {
        id: path.parse(file.filename).name,
        name: originalname,
        storedName: file.filename,
        size: file.size,
        mimeType: file.mimetype || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
        downloads: 0,
        scope,
        deviceId,
      };
    });

    filesDb = [...newEntries, ...filesDb];
    saveJson(DB_FILE, filesDb);

    // Notify clients in real-time
    notifyClients('files-updated', {
      action: 'upload',
      scope,
      deviceId,
      files: scope === 'group' ? filesDb.filter((f) => f.scope !== 'private') : undefined,
    });

    res.status(201).json({
      message: `Successfully uploaded ${newEntries.length} file(s)`,
      files: newEntries,
    });
  });
});

// Single file download (Optimized 1MB chunk streaming + HTTP Range for IDM multi-connection & resume)
app.get('/api/download/:id', (req, res) => {
  const file = filesDb.find((f) => f.id === req.params.id);
  if (!file) {
    return res.status(404).send('File not found');
  }

  const filePath = path.join(UPLOAD_DIR, file.storedName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Physical file missing from server disk');
  }

  file.downloads = (file.downloads || 0) + 1;
  saveJson(DB_FILE, filesDb);
  notifyClients('stats-updated', { id: file.id, downloads: file.downloads });

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  // 1MB buffer stream for maximum WiFi throughput
  const HIGH_WATER_MARK = 1024 * 1024;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      res.status(416).send(`Requested range not satisfiable\n${start} >= ${fileSize}`);
      return;
    }

    const chunksize = end - start + 1;
    const stream = fs.createReadStream(filePath, { start, end, highWaterMark: HIGH_WATER_MARK });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'Cache-Control': 'no-transform, public, max-age=86400',
    };
    res.writeHead(206, head);
    stream.pipe(res);
  } else {
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-transform, public, max-age=86400');
    fs.createReadStream(filePath, { highWaterMark: HIGH_WATER_MARK }).pipe(res);
  }
});

// Preview inline
app.get('/api/preview/:id', (req, res) => {
  const file = filesDb.find((f) => f.id === req.params.id);
  if (!file) return res.status(404).send('File not found');

  const filePath = path.join(UPLOAD_DIR, file.storedName);
  if (!fs.existsSync(filePath)) return res.status(404).send('File missing');

  res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`);
  fs.createReadStream(filePath, { highWaterMark: 1024 * 512 }).pipe(res);
});

// Download files as a ZIP stream (Scoped to Group or Private)
app.get('/api/download-all', async (req, res) => {
  const scopedFiles = filterByScope(filesDb, req);
  if (scopedFiles.length === 0) {
    return res.status(400).send('No files to download');
  }

  const zipName = `WiFi_Transfer_${Date.now()}.zip`;
  res.attachment(zipName);
  res.setHeader('Content-Type', 'application/zip');

  const { ZipArchive } = archiver;
  const archive = ZipArchive ? new ZipArchive({ zlib: { level: 2 } }) : archiver('zip', { zlib: { level: 2 } });

  archive.on('error', (err) => {
    console.error('Archive error:', err);
    if (!res.headersSent) {
      res.status(500).send({ error: err.message });
    }
  });

  archive.pipe(res);

  for (const file of scopedFiles) {
    const filePath = path.join(UPLOAD_DIR, file.storedName);
    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: file.name });
    }
  }

  await archive.finalize();
});

// Delete single file
app.delete('/api/files/:id', (req, res) => {
  const index = filesDb.findIndex((f) => f.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'File not found' });

  const file = filesDb[index];
  const filePath = path.join(UPLOAD_DIR, file.storedName);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {}
  }

  filesDb.splice(index, 1);
  saveJson(DB_FILE, filesDb);
  const remainingGroupFiles = filesDb.filter((f) => f.scope !== 'private');
  notifyClients('files-updated', { action: 'delete', id: req.params.id, files: remainingGroupFiles });
  res.json({ success: true });
});

// Clear all files (Scoped to Group or Private)
app.delete('/api/files', (req, res) => {
  const scope = req.query.scope || req.headers['x-scope'] || 'group';
  const deviceId = req.query.deviceId || req.headers['x-device-id'] || '';

  const toDelete = filesDb.filter((f) => {
    if (scope === 'private') {
      return f.scope === 'private' && f.deviceId === deviceId;
    }
    return f.scope !== 'private';
  });

  toDelete.forEach((file) => {
    const filePath = path.join(UPLOAD_DIR, file.storedName);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {}
    }
  });

  filesDb = filesDb.filter((f) => !toDelete.includes(f));
  saveJson(DB_FILE, filesDb);
  const remainingGroupFiles = filesDb.filter((f) => f.scope !== 'private');
  notifyClients('files-updated', { action: 'clear', files: remainingGroupFiles });
  res.json({ success: true });
});

// ── Text Endpoints ───────────────────────────────────────────────────────────

app.get('/api/text', (req, res) => {
  const scopedTexts = filterByScope(textDb, req);
  res.json(scopedTexts);
});

app.post('/api/text', (req, res) => {
  const { text, scope = 'group', deviceId = 'anonymous' } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Empty text' });

  const item = {
    id: Date.now().toString(),
    text: text.trim(),
    timestamp: new Date().toISOString(),
    scope: scope === 'private' ? 'private' : 'group',
    deviceId,
  };

  textDb = [item, ...textDb];
  saveJson(TEXT_DB_FILE, textDb);
  notifyClients('text-updated', item);
  res.json(item);
});

// Delete single text item (deletes for everyone on the WiFi in real-time)
app.delete('/api/text/:id', (req, res) => {
  const index = textDb.findIndex((t) => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Text not found' });

  textDb.splice(index, 1);
  saveJson(TEXT_DB_FILE, textDb);
  const remainingGroupTexts = textDb.filter((t) => t.scope !== 'private');
  notifyClients('text-updated-list', { action: 'delete', id: req.params.id, texts: remainingGroupTexts });
  res.json({ success: true });
});

// Clear all text items (clears for everyone on the WiFi in real-time)
app.delete('/api/text', (req, res) => {
  textDb = [];
  saveJson(TEXT_DB_FILE, textDb);
  notifyClients('text-cleared', {});
  res.json({ success: true });
});

// ── Link Endpoints ───────────────────────────────────────────────────────────

app.get('/api/link', (req, res) => {
  const scopedLinks = filterByScope(linkDb, req);
  res.json(scopedLinks);
});

app.post('/api/link', (req, res) => {
  const { url, title, scope = 'group', deviceId = 'anonymous' } = req.body;
  if (!url || !url.trim()) return res.status(400).json({ error: 'Empty URL' });

  const item = {
    id: Date.now().toString(),
    url: url.trim(),
    title: (title || '').trim(),
    timestamp: new Date().toISOString(),
    scope: scope === 'private' ? 'private' : 'group',
    deviceId,
  };

  linkDb = [item, ...linkDb];
  saveJson(LINK_DB_FILE, linkDb);
  notifyClients('link-updated', item);
  res.json(item);
});

// Delete single link item (deletes for everyone on the WiFi in real-time)
app.delete('/api/link/:id', (req, res) => {
  const index = linkDb.findIndex((l) => l.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Link not found' });

  linkDb.splice(index, 1);
  saveJson(LINK_DB_FILE, linkDb);
  const remainingGroupLinks = linkDb.filter((l) => l.scope !== 'private');
  notifyClients('link-updated-list', { action: 'delete', id: req.params.id, links: remainingGroupLinks });
  res.json({ success: true });
});

// Clear all link items (clears for everyone on the WiFi in real-time)
app.delete('/api/link', (req, res) => {
  linkDb = [];
  saveJson(LINK_DB_FILE, linkDb);
  notifyClients('link-cleared', {});
  res.json({ success: true });
});

// ── Serve Frontend Production Build (No "Cannot GET /" ever) ────────────────
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, { maxAge: '1h' }));
  app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // Graceful fallback UI in case dist was not yet built
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>AR | WiFi | TR — Building...</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #fff; text-align: center; }
          .card { background: #1e293b; padding: 32px; border-radius: 12px; border: 1px solid #334155; max-width: 460px; }
          h2 { color: #BC0202; margin-top: 0; }
          code { background: #0f172a; padding: 4px 8px; border-radius: 4px; color: #38bdf8; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>AR | WiFi | TR</h2>
          <p>Frontend production build is required. Run:</p>
          <p><code>npm run build</code></p>
          <p>and refresh this page.</p>
        </div>
      </body>
      </html>
    `);
  });
}

const server = app.listen(PORT, '0.0.0.0', () => {
  const ips = getNetworkIps();
  console.log(`\n======================================================`);
  console.log(`  🚀 AR | WiFi | TR High-Speed Server is RUNNING!`);
  console.log(`  Local:            http://localhost:${PORT}`);
  ips.forEach((net) => {
    console.log(`  WiFi / Network:   http://${net.address}:${PORT} (${net.name})`);
  });
  console.log(`  Max Batch:        50 files`);
  console.log(`  File Size Limit:  Unlimited (Gigabytes supported)`);
  console.log(`  Transfer Engine:  Direct Disk 1MB Stream (Ultra-Fast)`);
  console.log(`======================================================\n`);
});

// Configure server keep-alive for high throughput
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
