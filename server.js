const express = require('express');
const multer = require('multer');
const mime = require('mime-types');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const FILES_DIR = path.join(__dirname, 'files');

// Ensure files directory exists
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const subdir = req.query.path ? path.join(FILES_DIR, sanitizePath(req.query.path)) : FILES_DIR;
    fs.mkdirSync(subdir, { recursive: true });
    cb(null, subdir);
  },
  filename: (req, file, cb) => cb(null, file.originalname)
});
const MAX_FOLDER_SIZE = 20 * 1024 * 1024 * 1024; // 20GB total folder limit

function getFolderSize(dirPath) {
  let total = 0;
  if (!fs.existsSync(dirPath)) return 0;
  const walk = (p) => {
    for (const f of fs.readdirSync(p)) {
      const fp = path.join(p, f);
      const st = fs.statSync(fp);
      if (st.isDirectory()) walk(fp);
      else total += st.size;
    }
  };
  walk(dirPath);
  return total;
}

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const used = getFolderSize(FILES_DIR);
    if (used >= MAX_FOLDER_SIZE) {
      return cb(new Error('Storage limit reached: 20GB maximum exceeded'));
    }
    cb(null, true);
  }
}); // 20GB total storage limit

function sanitizePath(p) {
  return path.normalize(p).replace(/^(\.\.(\/|\\|$))+/, '');
}

function getStats() {
  const mem = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  return {
    processRam: (mem.rss / 1024 / 1024).toFixed(1) + ' MB',
    systemFreeRam: (freeMem / 1024 / 1024).toFixed(0) + ' MB',
    systemTotalRam: (totalMem / 1024 / 1024).toFixed(0) + ' MB',
    uptime: Math.floor(process.uptime()) + 's'
  };
}

function getDirContents(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath).map(name => {
    const fullPath = path.join(dirPath, name);
    const stat = fs.statSync(fullPath);
    return {
      name,
      isDir: stat.isDirectory(),
      size: stat.size,
      modified: stat.mtime.toISOString(),
      mimeType: stat.isDirectory() ? 'folder' : (mime.lookup(name) || 'application/octet-stream')
    };
  }).sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.name.localeCompare(b.name);
  });
}

// API: list files
app.get('/api/files', (req, res) => {
  const subPath = req.query.path ? sanitizePath(req.query.path) : '';
  const targetDir = path.join(FILES_DIR, subPath);
  if (!targetDir.startsWith(FILES_DIR)) return res.status(403).json({ error: 'Forbidden' });
  res.json({ path: subPath, files: getDirContents(targetDir) });
});

// API: upload files
app.post('/api/upload', (req, res) => {
  upload.array('files')(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    res.json({ success: true, count: req.files.length });
  });
});

// API: download file
app.get('/api/download', (req, res) => {
  const filePath = path.join(FILES_DIR, sanitizePath(req.query.path || ''));
  if (!filePath.startsWith(FILES_DIR) || !fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) return res.status(400).json({ error: 'Cannot download folder directly' });
  res.download(filePath);
});

// API: view file inline (no Content-Disposition: attachment)
app.get('/api/view', (req, res) => {
  const filePath = path.join(FILES_DIR, sanitizePath(req.query.path || ''));
  if (!filePath.startsWith(FILES_DIR) || !fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) return res.status(400).json({ error: 'Cannot view folder' });
  const mimeType = mime.lookup(filePath) || 'application/octet-stream';
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Accept-Ranges', 'bytes');
  // Handle range requests for video seeking
  const range = req.headers.range;
  if (range && mimeType.startsWith('video/')) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunkSize = end - start + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    res.setHeader('Content-Length', chunkSize);
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    fs.createReadStream(filePath).pipe(res);
  }
});

// API: delete file/folder
app.delete('/api/delete', express.json(), (req, res) => {
  const filePath = path.join(FILES_DIR, sanitizePath(req.body.path || ''));
  if (!filePath.startsWith(FILES_DIR) || !fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) fs.rmSync(filePath, { recursive: true });
  else fs.unlinkSync(filePath);
  res.json({ success: true });
});

// API: create folder
app.post('/api/mkdir', express.json(), (req, res) => {
  const dirPath = path.join(FILES_DIR, sanitizePath(req.body.path || ''));
  if (!dirPath.startsWith(FILES_DIR)) return res.status(403).json({ error: 'Forbidden' });
  fs.mkdirSync(dirPath, { recursive: true });
  res.json({ success: true });
});

// API: bulk delete
app.delete('/api/bulk-delete', express.json(), (req, res) => {
  const paths = req.body.paths || [];
  const errors = [];
  for (const p of paths) {
    const filePath = path.join(FILES_DIR, sanitizePath(p));
    if (!filePath.startsWith(FILES_DIR) || !fs.existsSync(filePath)) { errors.push(p); continue; }
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) fs.rmSync(filePath, { recursive: true });
    else fs.unlinkSync(filePath);
  }
  res.json({ success: true, deleted: paths.length - errors.length, errors });
});

// API: rename
app.post('/api/rename', express.json(), (req, res) => {
  const oldPath = path.join(FILES_DIR, sanitizePath(req.body.oldPath || ''));
  const newPath = path.join(FILES_DIR, sanitizePath(req.body.newPath || ''));
  if (!oldPath.startsWith(FILES_DIR) || !newPath.startsWith(FILES_DIR)) return res.status(403).json({ error: 'Forbidden' });
  fs.renameSync(oldPath, newPath);
  res.json({ success: true });
});

// API: system stats
app.get('/api/stats', (req, res) => {
  const used = getFolderSize(FILES_DIR);
  res.json({
    ...getStats(),
    storageUsed: used,
    storageMax: MAX_FOLDER_SIZE,
    storageUsedHuman: (used / 1024 / 1024 / 1024).toFixed(2) + ' GB',
    storageMaxHuman: '20 GB',
    storagePct: Math.round(used / MAX_FOLDER_SIZE * 100)
  });
});

// Thumbnail cache dir
const THUMB_DIR = path.join(__dirname, '.thumbcache');
if (!fs.existsSync(THUMB_DIR)) fs.mkdirSync(THUMB_DIR, { recursive: true });

// API: thumbnail
app.get('/api/thumb', (req, res) => {
  const filePath = path.join(FILES_DIR, sanitizePath(req.query.path || ''));
  if (!filePath.startsWith(FILES_DIR) || !fs.existsSync(filePath)) return res.status(404).end();
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) return res.status(400).end();

  const mimeType = mime.lookup(filePath) || '';
  const hash = crypto.createHash('md5').update(filePath + stat.mtimeMs).digest('hex');
  const thumbPath = path.join(THUMB_DIR, hash + '.jpg');

  const sendThumb = () => {
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(thumbPath).pipe(res);
  };

  if (fs.existsSync(thumbPath)) return sendThumb();

  if (mimeType.startsWith('image/')) {
    // Use ffmpeg to resize image to thumbnail (-update 1 required for single image output)
    execFile('ffmpeg', ['-y', '-i', filePath, '-vf', 'scale=300:-1', '-frames:v', '1', '-update', '1', '-q:v', '5', thumbPath], (err) => {
      if (err) { console.error('thumb err:', err.message); return res.status(500).end(); }
      sendThumb();
    });
  } else if (mimeType.startsWith('video/')) {
    execFile('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath], (err, stdout) => {
      const duration = parseFloat(stdout) || 10;
      const seekTime = Math.max(0, duration * 0.1).toFixed(2);
      execFile('ffmpeg', ['-y', '-ss', seekTime, '-i', filePath, '-vf', 'scale=300:-1', '-frames:v', '1', '-update', '1', '-q:v', '5', thumbPath], (err2) => {
        if (err2) { console.error('video thumb err:', err2.message); return res.status(500).end(); }
        sendThumb();
      });
    });
  } else {
    res.status(415).end();
  }
});

// Serve frontend
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  const ip = Object.values(os.networkInterfaces()).flat().find(i => i.family === 'IPv4' && !i.internal)?.address || 'localhost';
  console.log(`🚀 LocalFileServer running at http://${ip}:${PORT}`);
  console.log(`📁 Serving files from: ${FILES_DIR}`);
});
