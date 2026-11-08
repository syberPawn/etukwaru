// A small local server for public/, using the same headers as production.
//   npm run dev
const http = require('http');
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
};

function productionHeaders() {
  return Object.fromEntries(fs.readFileSync(path.join(PUBLIC, '_headers'), 'utf8').split('\n')
    .filter(line => /^\s+\S+:/.test(line) && !line.includes('Strict-Transport-Security'))
    .map(line => { const i = line.indexOf(':'); return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/\r$/, '')]; }));
}

/** Resolves once listening. Port 0 picks any free port. */
function startServer(port = 0) {
  const headers = productionHeaders();
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let url;
      try {
        url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      } catch {
        res.writeHead(400);
        res.end();
        return;
      }
      const file = path.join(PUBLIC, url === '/' ? 'index.html' : url);
      if (!file.startsWith(PUBLIC + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', ...headers });
        res.end(data);
      });
    });
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

module.exports = { startServer };

if (require.main === module) {
  startServer(Number(process.env.PORT) || 3000).then(server => {
    console.log(`Dump is open at http://localhost:${server.address().port}`);
  }).catch(err => {
    console.error(err.code === 'EADDRINUSE' ? 'Port 3000 is busy. Try: set PORT=3001 and run again.' : err);
    process.exit(1);
  });
}
