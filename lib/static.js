'use strict';

const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function serveStatic(rootDir) {
  return function (req, res, urlPath) {
    let rel = decodeURIComponent(urlPath.split('?')[0]);
    if (rel === '/') rel = '/index.html';
    const normalized = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');
    const filePath = path.join(rootDir, normalized);

    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403);
      res.end('Prohibido');
      return true;
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return false;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600' });
    fs.createReadStream(filePath).pipe(res);
    return true;
  };
}

module.exports = { serveStatic };
