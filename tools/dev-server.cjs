// Serves the built site (dist/) the way Cloudflare Pages does: the headers
// from _headers, matched per path, and text compressed with brotli.
//   npm run build && npm run serve
const http = require('http');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'dist');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.mp4': 'video/mp4',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.webm': 'video/webm', '.wasm': 'application/wasm',
};

/**
 * _headers as a list of { pattern, set: [[name, value]], detach: [name] }.
 * A pattern is a path where * matches anything.
 */
function readRules() {
  const rules = [];
  for (const raw of fs.readFileSync(path.join(ROOT, '_headers'), 'utf8').split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) { rules.push({ pattern: line.trim(), set: [], detach: [] }); continue; }
    const rule = rules[rules.length - 1];
    const text = line.trim();
    if (text.startsWith('!')) { rule.detach.push(text.slice(1).trim().toLowerCase()); continue; }
    const i = text.indexOf(':');
    const name = text.slice(0, i).trim();
    if (name.toLowerCase() !== 'strict-transport-security') rule.set.push([name, text.slice(i + 1).trim()]);
  }
  return rules.map(r => ({ ...r, test: new RegExp('^' + r.pattern.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$') }));
}

/** Cloudflare's rules: every matching rule applies, repeated headers are joined
 *  with a comma, and `! Name` removes a header set by the other rules. */
function headersFor(rules, url) {
  const matching = rules.filter(r => r.test.test(url));
  const detached = new Set(matching.flatMap(r => r.detach));
  const out = {};
  for (const r of matching) for (const [name, value] of r.set) {
    const key = name.toLowerCase();
    if (detached.has(key)) continue;
    out[key] = out[key] ? `${out[key]}, ${value}` : value;
  }
  return out;
}

/** The file a URL maps to, as Pages resolves it: /x/ → /x/index.html, /x → /x.html or /x/index.html. */
function resolve(url) {
  const candidates = url.endsWith('/') ? [url + 'index.html'] : [url, url + '.html', url + '/index.html'];
  for (const c of candidates) {
    const file = path.join(ROOT, c);
    if (!file.startsWith(ROOT + path.sep)) return null;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return { file, redirect: c === url + '/index.html' ? url + '/' : null };
  }
  return null;
}

// Compressed copies, by file and modification time: compressing a large file
// on every request (the truck's physics engine is megabytes) would make the
// local site look far slower than the host, which compresses once.
const compressed = new Map();
function brotli(file, data) {
  const key = `${file}:${fs.statSync(file).mtimeMs}`;
  if (!compressed.has(key)) compressed.set(key, zlib.brotliCompressSync(data, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } }));
  return compressed.get(key);
}

/** Resolves once listening. Port 0 picks any free port. */
function startServer(port = 0) {
  const rules = readRules();
  return new Promise((resolveStart, reject) => {
    const server = http.createServer((req, res) => {
      let url;
      try {
        url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      } catch {
        res.writeHead(400);
        res.end();
        return;
      }
      const found = resolve(url);
      if (found?.redirect) {
        res.writeHead(308, { location: found.redirect });
        res.end();
        return;
      }
      const file = found?.file ?? path.join(ROOT, '404.html');
      const status = found ? 200 : 404;
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        const type = TYPES[path.extname(file)] || 'application/octet-stream';
        // Part of a file (how browsers fetch video), as the host serves it.
        const range = status === 200 && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
        if (range) {
          const start = range[1] ? Number(range[1]) : Math.max(0, data.length - Number(range[2]));
          const end = range[1] && range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1;
          res.writeHead(206, { 'content-type': type, 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${data.length}`, 'content-length': end - start + 1, ...headersFor(rules, url) });
          res.end(data.subarray(start, end + 1));
          return;
        }
        const accepts = (req.headers['accept-encoding'] ?? '').split(',').map(e => e.trim().split(';')[0]);
        const compress = accepts.includes('br') && /^text\/|javascript|json|xml|svg|wasm/.test(type);
        res.writeHead(status, {
          'content-type': type,
          ...headersFor(rules, url),
          ...(compress && { 'content-encoding': 'br', vary: 'Accept-Encoding' }),
        });
        res.end(compress ? brotli(file, data) : data);
      });
    });
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolveStart(server));
  });
}

module.exports = { startServer, headersFor, readRules };

if (require.main === module) {
  if (!fs.existsSync(ROOT)) {
    console.error('No dist/ yet. Run: npm run build');
    process.exit(1);
  }
  startServer(Number(process.env.PORT) || 4321).then(server => {
    console.log(`Built site at http://localhost:${server.address().port}`);
  }).catch(err => {
    console.error(err.code === 'EADDRINUSE' ? 'That port is busy. Set PORT to another number and run again.' : err);
    process.exit(1);
  });
}
