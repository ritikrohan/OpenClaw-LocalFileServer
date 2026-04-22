# LocalFileServer — Self-Hosted Local File Manager & LAN File Sharing Server

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)](https://expressjs.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/ritikrohan/OpenClaw-LocalFileServer/pulls)
[![No Database](https://img.shields.io/badge/Database-None-lightgrey)](https://github.com/ritikrohan/OpenClaw-LocalFileServer)

**LocalFileServer** is a lightweight, open-source, self-hosted file manager that runs directly on your local machine or home server. Access, upload, download, and organize your files from any browser on your network — no cloud, no subscriptions, no data leaving your machine.

> Perfect for home labs, Raspberry Pi setups, NAS boxes, LAN file sharing, offline environments, and anyone who wants full control over their own storage.

---

## Screenshot

<img width="1467" height="737" alt="image" src="https://github.com/user-attachments/assets/290bb444-f064-40d1-a0a8-c087af9c7606" />


*Dark-themed UI with drag & drop upload, grid/list view toggle, real-time storage bar, and bulk file operations.*

---

## Table of Contents

- [Why LocalFileServer?](#why-localfileserver)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [API Reference](#api-reference)
- [Deployment Notes](#deployment-notes)
- [Contributing](#contributing)
- [License](#license)

---

## Why LocalFileServer?

Most file managers either require a cloud account, complex setup, or a heavyweight database. **LocalFileServer** does none of that:

- **Zero cloud dependency** — your files stay on your hardware
- **Zero database** — filesystem is the only storage layer
- **Zero build step** — one `npm install`, one `node server.js`
- **Zero frontend framework** — vanilla JS with a polished dark UI
- **Accessible from any device** — phone, tablet, or desktop on the same network

---

## Features

### File Management
- **Drag & drop upload** or click-to-browse file picker
- **Upload multiple files** at once with real-time progress bar
- **Download** individual files or bulk-download selected files
- **Delete** single or multiple files with confirmation dialogs
- **Rename** files and folders via inline modal
- **Create folders** and navigate nested directories
- **Breadcrumb navigation** for deep folder paths

### File Preview & Viewer
- **Images** — inline preview with thumbnail generation
- **Videos** — playable modal with seeking support (HTTP range requests / 206 Partial Content)
- **Audio** — in-browser audio player
- **PDFs** — full multi-page PDF viewer powered by PDF.js
- **Code & Text files** — syntax-aware viewer for `.js`, `.ts`, `.py`, `.json`, `.yaml`, `.md`, `.csv`, `.html`, `.css`, `.sh`, `.log`, `.env`, `.ini`, `.toml`, `.xml` and more

### Bulk Operations
- Multi-select with individual checkboxes
- **Select All** with `Ctrl+A` / `Cmd+A` or the header checkbox
- Bulk delete and bulk download in one click

### Views & Layout
- **Grid view** — responsive thumbnail grid (default)
- **List view** — compact table with filename, size, and modification date
- Toggle between views with a single click
- Folders always sorted first, then files alphabetically

### Storage & System Monitoring
- Live **storage usage bar** in the header (color shifts orange at 60%, red at 85%)
- Displays used / total storage in human-readable units
- Real-time **Node.js process RAM**, **system free RAM**, and **server uptime**
- Stats refresh automatically every 10 seconds

### Thumbnails & Caching
- Automatic thumbnail generation for images and videos via **FFmpeg**
- PDF page thumbnails (Canvas fallback if FFmpeg unavailable)
- **MD5-based cache keys** tied to file path + modification time — thumbnails auto-invalidate on file change
- `Cache-Control: max-age=86400` HTTP headers for fast repeat loads

### Security
- **Path traversal prevention** — all paths sanitized to remove `..` sequences
- Paths validated to stay strictly within the configured `FILES_DIR`
- `403 Forbidden` on any escape attempt

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| HTTP Server | Express 5.x |
| File Uploads | Multer 2.x |
| MIME Detection | mime-types 3.x |
| Thumbnails | FFmpeg / FFprobe (external) |
| PDF Viewing | PDF.js 3.11 (CDN, client-side) |
| Frontend | Vanilla JS, HTML5, CSS3 |
| Icons | Google Material Icons |
| Font | Inter (Google Fonts) |
| Database | None |

---

## Quick Start

### Prerequisites

- **Node.js** v18 or later — [nodejs.org](https://nodejs.org)
- **npm** (bundled with Node.js)
- **FFmpeg** (optional, for thumbnail generation)
  ```bash
  # macOS
  brew install ffmpeg

  # Ubuntu / Debian
  sudo apt install ffmpeg

  # Windows — download from https://ffmpeg.org/download.html
  ```

### Install & Run

```bash
# 1. Clone the repository
git clone https://github.com/ritikrohan/OpenClaw-LocalFileServer.git
cd OpenClaw-LocalFileServer

# 2. Install dependencies
npm install

# 3. Start the server
node server.js
```

The server starts on **http://localhost:3000** and binds to all network interfaces (`0.0.0.0`), so any device on your LAN can reach it via your machine's IP address (e.g., `http://192.168.1.10:3000`).

The terminal will print the exact access URL on startup.

### First Run

On first start, two directories are created automatically:

| Directory | Purpose |
|---|---|
| `files/` | All uploaded files and folders live here |
| `.thumbcache/` | Auto-generated thumbnail cache |

---

## Configuration

All settings are hardcoded at the top of [server.js](server.js). Edit the file to change them:

```js
const PORT = 3000;                                      // HTTP port
const FILES_DIR = path.join(__dirname, 'files');        // Storage root
const MAX_FOLDER_SIZE = 20 * 1024 * 1024 * 1024;       // 20 GB storage cap
```

| Setting | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the HTTP server listens on |
| `FILES_DIR` | `./files` | Root directory for all stored files |
| `MAX_FOLDER_SIZE` | `20 GB` | Maximum total storage before uploads are rejected |

> There are no environment variables or `.env` files required.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + A` / `Cmd + A` | Select all files in current directory |
| `Delete` | Delete all selected items |
| `Escape` | Clear selection / close modal / close viewer |

---

## API Reference

All API endpoints are served from the same Express process.

### File Operations

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/files?path=<dir>` | List contents of a directory |
| `POST` | `/api/upload?path=<dir>` | Upload one or more files to a directory |
| `GET` | `/api/download?path=<file>` | Download a file |
| `GET` | `/api/view?path=<file>` | View a file inline (supports HTTP range requests for video) |
| `DELETE` | `/api/delete` | Delete a single file or folder |
| `DELETE` | `/api/bulk-delete` | Delete multiple files/folders |
| `POST` | `/api/mkdir` | Create a new folder |
| `POST` | `/api/rename` | Rename a file or folder |

### Utilities

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/stats` | Server stats: RAM, uptime, storage usage |
| `GET` | `/api/thumb?path=<file>` | Get a cached thumbnail for an image, video, or PDF |

### Frontend

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Serves `index.html` (the full single-page app) |

---

## Deployment Notes

### Local Network Access
Because the server binds to `0.0.0.0`, it is immediately accessible to all devices on the same Wi-Fi or LAN. No additional configuration needed — just share your machine's local IP and port.

### Running on a Raspberry Pi or Home Server
```bash
# Run in background with nohup
nohup node server.js &

# Or use PM2 for process management
npm install -g pm2
pm2 start server.js --name localfileserver
pm2 save
pm2 startup
```

### Changing the Port
If port 3000 is in use, edit `server.js`:
```js
const PORT = 8080;  // or any free port
```

### Important Security Notes
- **No authentication** — anyone on the network can read and write files. Do not expose to the public internet without adding auth (e.g., a reverse proxy with basic auth).
- **HTTP only** — use Nginx or Caddy as a reverse proxy with TLS if you need HTTPS.
- **Single user** — all connected clients share the same storage.

---

## Project Structure

```
localfileserver-src/
├── server.js        # Node.js/Express backend — all API routes & file operations
├── index.html       # Full frontend SPA — HTML, CSS, and JavaScript in one file
├── package.json     # Dependencies: express, multer, mime-types
├── files/           # (runtime) Uploaded files stored here
└── .thumbcache/     # (runtime) Auto-generated thumbnail cache
```

---

## Contributing

Contributions are welcome! To get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

Please open an issue first for major changes to discuss the approach.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with Node.js · No cloud · No database · No nonsense
</p>
