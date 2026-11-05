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

// Multer storage engine
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

// Unlimited file size (5GB+ supported), max 10 files per upload batch
const upload = multer({
  storage,
  limits: {
    files: 10,
    fileSize: Infinity, // No file size limit (Gigabytes supported)
  },
});

app.use(cors());
app.use(express.json());

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

// Helper to get local network IPv4 addresses
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
      maxBatchFiles: 10,
      activeClients: sseClients.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Files list
app.get('/api/files', (req, res) => {
  res.json(filesDb);
});

// High-speed disk streaming upload (up to 10 files, any size)
app.post('/api/upload', (req, res) => {
  upload.array('files', 10)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: 'Maximum 10 files allowed per upload.' });
      }
      return res.status(500).json({ error: err.message });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files were uploaded.' });
    }

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
      };
    });

    filesDb = [...newEntries, ...filesDb];
    saveJson(DB_FILE, filesDb);

    notifyClients('files-updated', { action: 'upload', files: filesDb });

    res.status(201).json({
      message: `Successfully uploaded ${newEntries.length} file(s)`,
      files: newEntries,
    });
  });
});

// Single file download (with HTTP Range for IDM multi-connection & resume)
app.get('/api/download/:id', (req, res) => {
  const file = filesDb.find((f) => f.id === req.params.id);
  if (!file) {
    return res.status(404).send('File not found');
  }

  const filePath = path.join(UPLOAD_DIR, file.storedName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Physical file missing');
  }

  file.downloads = (file.downloads || 0) + 1;
  saveJson(DB_FILE, filesDb);
  notifyClients('stats-updated', { id: file.id, downloads: file.downloads });

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      res.status(416).send(`Requested range not satisfiable\n${start} >= ${fileSize}`);
      return;
    }

    const chunksize = end - start + 1;
    const stream = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    };
    res.writeHead(206, head);
    stream.pipe(res);
  } else {
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    fs.createReadStream(filePath).pipe(res);
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
  fs.createReadStream(filePath).pipe(res);
});

// Download all files as a ZIP stream
app.get('/api/download-all', async (req, res) => {
  if (filesDb.length === 0) {
    return res.status(400).send('No files to download');
  }

  const zipName = `AR_WiFi_TR_${Date.now()}.zip`;
  res.attachment(zipName);
  res.setHeader('Content-Type', 'application/zip');

  const { ZipArchive } = archiver;
  const archive = ZipArchive ? new ZipArchive({ zlib: { level: 4 } }) : archiver('zip', { zlib: { level: 4 } });

  archive.on('error', (err) => {
    console.error('Archive error:', err);
    if (!res.headersSent) {
      res.status(500).send({ error: err.message });
    }
  });

  archive.pipe(res);

  for (const file of filesDb) {
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
  notifyClients('files-updated', { action: 'delete', files: filesDb });
  res.json({ success: true });
});

// Clear all files
app.delete('/api/files', (req, res) => {
  filesDb.forEach((file) => {
    const filePath = path.join(UPLOAD_DIR, file.storedName);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {}
    }
  });

  filesDb = [];
  saveJson(DB_FILE, filesDb);
  notifyClients('files-updated', { action: 'clear', files: [] });
  res.json({ success: true });
});

// Text endpoints
app.get('/api/text', (req, res) => {
  res.json(textDb);
});

app.post('/api/text', (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Empty text' });

  const item = {
    id: Date.now().toString(),
    text: text.trim(),
    timestamp: new Date().toISOString(),
  };

  textDb = [item, ...textDb];
  saveJson(TEXT_DB_FILE, textDb);
  notifyClients('text-updated', item);
  res.json(item);
});

app.delete('/api/text', (req, res) => {
  textDb = [];
  saveJson(TEXT_DB_FILE, textDb);
  notifyClients('text-cleared', {});
  res.json({ success: true });
});

// Link endpoints
app.get('/api/link', (req, res) => {
  res.json(linkDb);
});

app.post('/api/link', (req, res) => {
  const { url, title } = req.body;
  if (!url || !url.trim()) return res.status(400).json({ error: 'Empty URL' });

  const item = {
    id: Date.now().toString(),
    url: url.trim(),
    title: (title || '').trim(),
    timestamp: new Date().toISOString(),
  };

  linkDb = [item, ...linkDb];
  saveJson(LINK_DB_FILE, linkDb);
  notifyClients('link-updated', item);
  res.json(item);
});

app.delete('/api/link', (req, res) => {
  linkDb = [];
  saveJson(LINK_DB_FILE, linkDb);
  notifyClients('link-cleared', {});
  res.json({ success: true });
});

// Serve static frontend build if it exists
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  const ips = getNetworkIps();
  console.log(`\n======================================================`);
  console.log(`  🚀 AR | WiFi | TR Server is RUNNING!`);
  console.log(`  Local:            http://localhost:${PORT}`);
  ips.forEach((net) => {
    console.log(`  WiFi / Network:   http://${net.address}:${PORT} (${net.name})`);
  });
  console.log(`  Max Batch:        10 files`);
  console.log(`  File Size Limit:  Unlimited (5GB+ supported)`);
  console.log(`======================================================\n`);
});
