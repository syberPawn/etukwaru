// Publishes the project media (media-src/work/*) to public/media/work/ with a
// content fingerprint in each name, e.g. makaam-sports-1.3f9a2c41d0.webp, and
// writes src/data/media.json, which the site reads to find them.
//
// A changed file gets a new name, so a browser can never keep showing an old
// copy, and every file can be cached for a long time.
//
//   npm run media        (after adding or replacing anything in media-src/work)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'media-src', 'work');
const OUT = path.join(ROOT, 'public', 'media', 'work');
const MANIFEST = path.join(ROOT, 'src', 'data', 'media.json');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const manifest = {};
  const keep = new Set();
  for (const name of fs.readdirSync(SRC).sort()) {
    const file = path.join(SRC, name);
    if (!fs.statSync(file).isFile()) continue;
    const data = fs.readFileSync(file);
    const hash = crypto.createHash('sha256').update(data).digest('hex').slice(0, 10);
    const ext = path.extname(name), base = path.basename(name, ext);
    const published = `${base}.${hash}${ext}`;
    keep.add(published);
    if (!fs.existsSync(path.join(OUT, published))) fs.writeFileSync(path.join(OUT, published), data);
    const entry = { src: `/media/work/${published}` };
    if (/\.(webp|png|jpe?g)$/i.test(ext)) {
      const m = await sharp(data).metadata();
      entry.w = m.width; entry.h = m.height;
    }
    manifest[name] = entry;
  }
  // Remove published files that no longer have a source.
  for (const name of fs.readdirSync(OUT)) if (!keep.has(name)) fs.unlinkSync(path.join(OUT, name));
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Published ${keep.size} files to public/media/work and wrote src/data/media.json`);
})().catch(e => { console.error(e); process.exit(1); });
