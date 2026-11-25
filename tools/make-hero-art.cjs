// Turns a 3D model or a picture into one of the character-art figures on the
// site. A model is rendered as a pale marble statue first; a picture (PNG with
// a transparent background) is used as it is. Either way the light is measured
// in a grid of character cells, and the result is a few KB of text, so
// visitors never download the model or the picture.
//
//   npm run hero-art -- <name> <model.glb | picture.png> [--preview]
//
// <name> picks the framing below (for models) and the output file,
// src/data/art/<name>.json. --preview also writes tools/art-<name>-*.png.
const http = require('http');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const puppeteer = require('puppeteer-core');

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [NAME, INPUT] = process.argv.slice(2);
const PREVIEW = process.argv.includes('--preview');
if (!NAME || !INPUT || !fs.existsSync(INPUT)) {
  console.error('Usage: npm run hero-art -- <name> <model.glb | picture.png> [--preview]');
  process.exit(1);
}
const THREE_DIR = path.join(__dirname, '..', 'node_modules', 'three');
const OUT_DIR = path.join(__dirname, '..', 'src', 'data', 'art');

// Framing for each figure made from a model. angle: radians around the model
// (~1.57 is a side view, face to the left); height01: where the camera looks,
// as a share of the model's height; distance: in model heights; look: where
// the camera aims across the model's width and depth, 0..1 (default centre);
// crop: keep only this share of the render's width, [from, to].
const SHOTS = {
  warrior: { width: 1000, height: 1250, angle: 1.18, height01: 0.765, distance: 0.62, fov: 26, cols: 150 },
  'warrior-profile': { width: 1000, height: 1000, angle: 1.52, height01: 0.79, distance: 0.5, fov: 26, cols: 110 },
  'warrior-full': { width: 800, height: 1400, angle: 0.62, height01: 0.5, distance: 2.05, fov: 26, cols: 90 },
  spear: { width: 600, height: 1400, angle: 0.25, height01: 0.74, distance: 1.05, fov: 26, cols: 150, look: [0.07, 0.5], crop: [0, 0.42] },
};
// Pictures: how many characters across; relief: light a flat drawing as if
// it were carved in marble (raised where it is bright, domed towards the
// middle), so it reads with depth like the 3D figures; outline: keep only
// the inside of this polygon (pixel coordinates), for a picture with other
// things around the subject; paper: the subject is on plain paper, which is
// removed by flooding in from the edges (so pale parts of the subject that
// are enclosed by it survive); dropOlive: also remove olive-green areas (a
// branch); detail: how much of the picture's own light and dark shows on the
// marble (0..1, default 0.45); rotate: a tilt in degrees for long, thin objects.
const PICTURES = {
  shield: { cols: 110, relief: true },
  basket: { cols: 80, relief: true },
  dao: { cols: 96, rotate: -32, relief: true },
  // François Levaillant, Histoire naturelle d'une partie d'oiseaux nouveaux
  // et rares de l'Amérique et des Indes (1801), tome 1, planche 7, "Le Calao
  // bicorne". Scan: Special Collections, University of Amsterdam. Public
  // domain (PD-old, PD-Art), via Wikimedia Commons. The outline keeps out the
  // plate's lettering; the paper and the branch are removed.
  hornbill: {
    relief: true,
    detail: 0.22,
    cols: 104,
    paper: true,
    dropOlive: true,
    outline: [[160, 620], [170, 400], [250, 200], [330, 130], [600, 80], [660, 120], [720, 420], [900, 680], [1120, 860], [1380, 1100], [1380, 1220], [1300, 1250], [1340, 1700], [1320, 1870], [1180, 1860], [1100, 1650], [980, 1250], [700, 1050], [460, 800], [440, 560], [300, 520], [230, 600]]
      .map(([x, y]) => [Math.round(x * 1.3052), Math.round(y * 1.3052)]),
  },
  default: { cols: 72 },
};

/**
 * Removes plain paper around a subject: paper-coloured pixels connected to
 * the outside are cleared; anything the subject encloses is kept. Also drops
 * olive-green areas when asked. Works in place on RGBA.
 */
function removePaper(rgba, W, H, dropOlive) {
  // The paper's colour: the median of a strip down the left edge.
  const samples = [];
  for (let y = Math.floor(H * 0.3); y < H * 0.7; y += 4) for (let x = 30; x < 70; x += 4) samples.push((y * W + x) * 4);
  const med = c => { const v = samples.map(j => rgba[j + c]).sort((a, b) => a - b); return v[v.length >> 1]; };
  const bg = [med(0), med(1), med(2)];
  const near = j => Math.hypot(rgba[j] - bg[0], rgba[j + 1] - bg[1], rgba[j + 2] - bg[2]) < 34;
  const seen = new Uint8Array(W * H);
  const stack = [];
  // Start from paper just inside the edges: a scan often has a dark border
  // around the page, which would otherwise wall the paper in.
  const seed = i => { if (!seen[i] && near(i * 4)) { seen[i] = 1; stack.push(i); } };
  for (let m = 20; m < 60; m += 4) {
    for (let x = m; x < W - m; x++) { seed(m * W + x); seed((H - 1 - m) * W + x); }
    for (let y = m; y < H - m; y++) { seed(y * W + m); seed(y * W + W - 1 - m); }
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % W, y = (i - x) / W;
    for (const n of [x > 0 && i - 1, x < W - 1 && i + 1, y > 0 && i - W, y < H - 1 && i + W]) {
      if (n === false || seen[n]) continue;
      if (rgba[n * 4 + 3] >= 128 && !near(n * 4)) continue;   // the subject: stop here
      seen[n] = 1;
      stack.push(n);
    }
  }
  for (let i = 0; i < W * H; i++) {
    const j = i * 4;
    if (seen[i]) { rgba[j + 3] = 0; continue; }
    if (dropOlive) {
      const r = rgba[j], g = rgba[j + 1], b = rgba[j + 2], l = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
      if (l > 0.18 && l < 0.62 && g >= r - 12 && g - b > 24) rgba[j + 3] = 0;
    }
  }
  return rgba;
}

/** Box blur of a float image, `passes` times (close to a Gaussian). */
function blur(src, W, H, r, passes = 3) {
  let a = Float32Array.from(src), b = new Float32Array(W * H);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < H; y++) {
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += a[y * W + Math.min(W - 1, Math.max(0, x))];
      for (let x = 0; x < W; x++) {
        b[y * W + x] = acc / (2 * r + 1);
        acc += a[y * W + Math.min(W - 1, x + r + 1)] - a[y * W + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += b[Math.min(H - 1, Math.max(0, y)) * W + x];
      for (let y = 0; y < H; y++) {
        a[y * W + x] = acc / (2 * r + 1);
        acc += b[Math.min(H - 1, y + r + 1) * W + x] - b[Math.max(0, y - r) * W + x];
      }
    }
  }
  return a;
}

/**
 * Lights a flat picture as a marble relief: height comes from a rounded
 * version of its outline plus its own brightness, and a light from the top
 * left shades it. Returns RGBA, grey inside the outline, clear outside.
 */
function relief(rgba, W, H, isFigure, detail = 0.45) {
  const M = new Float32Array(W * H), L = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const j = i * 4;
    M[i] = isFigure(rgba[j], rgba[j + 1], rgba[j + 2], rgba[j + 3]) ? 1 : 0;
    L[i] = (rgba[j] * 0.3 + rgba[j + 1] * 0.59 + rgba[j + 2] * 0.11) / 255;
  }
  const r = Math.max(4, Math.round(Math.min(W, H) / 40));
  const dome = blur(M, W, H, r * 2);
  const raised = blur(L, W, H, Math.max(1, Math.round(r / 4)), 2);
  const h = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) h[i] = (dome[i] * 26 + raised[i] * 9) * M[i];
  const light = [-0.5, -0.62, 0.6], len = Math.hypot(...light);
  const [lx, ly, lz] = light.map(v => v / len);
  const out = Buffer.alloc(W * H * 4);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (!M[i]) continue;
      const dx = (h[i + 1] - h[i - 1]) / 2, dy = (h[i + W] - h[i - W]) / 2;
      const n = Math.hypot(dx, dy, 1);
      const nx = -dx / n, ny = -dy / n, nz = 1 / n;
      const diffuse = Math.max(0, nx * lx + ny * ly + nz * lz);
      // Specular: reflect the light about the normal, viewer straight on.
      const rz = 2 * (nx * lx + ny * ly + nz * lz) * nz - lz;
      const spec = Math.pow(Math.max(0, rz), 18);
      const albedo = 1 - detail + detail * L[i];       // keep some of the drawing's own pattern
      const v = Math.min(1, (0.16 + 0.78 * diffuse) * albedo + 0.22 * spec);
      const g = Math.round(v * 255), j = i * 4;
      out[j] = out[j + 1] = out[j + 2] = g;
      out[j + 3] = 255;
    }
  }
  return out;
}

/** Renders a model as a marble statue on black; resolves to a PNG buffer. */
function renderModel(model, shot) {
  const page = `<!doctype html><html><body style="margin:0">
<script>addEventListener('error', e => { window.__failed = e.message || 'script error'; });</script>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const S = ${JSON.stringify(shot)};
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
r.setSize(S.width, S.height);
r.outputColorSpace = THREE.SRGBColorSpace;
r.toneMapping = THREE.ACESFilmicToneMapping;
r.toneMappingExposure = 0.9;
document.body.appendChild(r.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#000');
scene.add(new THREE.HemisphereLight(0xffffff, 0x111111, 0.25));
const key = new THREE.DirectionalLight(0xffffff, 3.0); scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.35); scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 1.8); scene.add(rim);
const cam = new THREE.PerspectiveCamera(S.fov, S.width / S.height, 0.01, 100);
new GLTFLoader().load('/model.glb', g => {
  const m = g.scene;
  m.traverse(o => { if (o.isMesh) o.material = new THREE.MeshStandardMaterial({ color: '#eeeae2', roughness: 0.5 }); });
  scene.add(m);
  const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const fy = box.min.y + size.y * S.height01, d = size.y * S.distance;
  const [lx, lz] = S.look ?? [0.5, 0.5];
  const tx = box.min.x + size.x * lx, tz = box.min.z + size.z * lz;
  const eye = new THREE.Vector3(tx + Math.sin(S.angle) * d, fy + size.y * 0.02, tz + Math.cos(S.angle) * d);
  cam.position.copy(eye); cam.lookAt(tx, fy, tz);
  // Key light from ahead of the face and above, so the near side falls into
  // shade and the features carve out; weak fill from the camera; rim behind.
  key.position.set(c.x - 0.6, fy + 1.4, c.z + 2.2);
  fill.position.copy(eye).add(new THREE.Vector3(0, -0.5, 0));
  rim.position.set(c.x - 2.5, fy + 0.8, c.z - 1.5);
  r.render(scene, cam);
  window.png = r.domElement.toDataURL('image/png');
});
</script></body></html>`;

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = req.url.split('?')[0];
      if (url === '/') { res.setHeader('content-type', 'text/html'); res.end(page); return; }
      const file = url === '/model.glb' ? path.resolve(model)
        : url.startsWith('/three/') ? path.join(THREE_DIR, url.slice(7)) : null;
      if (!file || (url !== '/model.glb' && !file.startsWith(THREE_DIR)) || !fs.existsSync(file)) { res.statusCode = 404; res.end(); return; }
      res.setHeader('content-type', file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
      fs.createReadStream(file).pipe(res);
    }).listen(0, '127.0.0.1', async () => {
      const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
      try {
        const p = await browser.newPage();
        await p.goto(`http://127.0.0.1:${server.address().port}/`);
        await p.waitForFunction(() => window.png || window.__failed, { timeout: 300000, polling: 500 });
        const { png, failed } = await p.evaluate(() => ({ png: window.png, failed: window.__failed }));
        if (failed) throw new Error(failed);
        resolve(Buffer.from(png.split(',')[1], 'base64'));
      } catch (e) {
        reject(e);
      } finally {
        await browser.close();
        server.close();
      }
    });
  });
}

/**
 * Measures light in a grid of character cells and returns rows of digits:
 * 0 = empty, 1..9 = darker to brighter.
 * @param {Buffer} rgba raw RGBA pixels
 * @param {(r:number,g:number,b:number,a:number)=>boolean} isFigure which pixels belong to the figure
 */
function toCells(rgba, W, H, COLS, isFigure) {
  const cw = W / COLS, ch = cw / 0.6, ROWS = Math.floor(H / ch);
  const raw = [];
  for (let gy = 0; gy < ROWS; gy++) {
    for (let gx = 0; gx < COLS; gx++) {
      let sum = 0, mask = 0, n = 0;
      for (let y = Math.floor(gy * ch); y < Math.floor((gy + 1) * ch); y += 2) {
        for (let x = Math.floor(gx * cw); x < Math.floor((gx + 1) * cw); x += 2) {
          const j = (y * W + x) * 4;
          n++;
          if (isFigure(rgba[j], rgba[j + 1], rgba[j + 2], rgba[j + 3])) {
            mask++;
            sum += (rgba[j] * 0.3 + rgba[j + 1] * 0.59 + rgba[j + 2] * 0.11) / 255;
          }
        }
      }
      raw.push(mask / n < 0.35 ? -1 : sum / mask);
    }
  }
  // Local contrast, so carved detail reads as characters: compare each cell
  // with the figure cells around it (background ignored, or every outline
  // would turn bright).
  const K = 3;
  const cells = raw.map((v, i) => {
    if (v < 0) return -1;
    const gx = i % COLS, gy = (i - gx) / COLS;
    let s = 0, m = 0;
    for (let y = Math.max(0, gy - K); y <= Math.min(ROWS - 1, gy + K); y++) {
      for (let x = Math.max(0, gx - K * 2); x <= Math.min(COLS - 1, gx + K * 2); x++) {
        const u = raw[y * COLS + x];
        if (u >= 0) { s += u; m++; }
      }
    }
    return Math.max(0, v + (v - s / m) * 0.6);
  });
  // Stretch the figure's own range of light to the nine levels, darkening the
  // midtones so the shadows read.
  const sorted = cells.filter(v => v >= 0).sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.02)], hi = sorted[Math.floor(sorted.length * 0.99)];
  const level = v => 1 + Math.min(8, Math.max(0, Math.floor(Math.pow(Math.min(1, Math.max(0, (v - lo) / (hi - lo || 1))), 1.5) * 9)));
  let rows = [];
  for (let gy = 0; gy < ROWS; gy++) {
    let row = '';
    for (let gx = 0; gx < COLS; gx++) { const v = cells[gy * COLS + gx]; row += v < 0 ? '0' : String(level(v)); }
    rows.push(row);
  }
  // Trim empty rows and columns around the figure.
  while (rows.length && /^0+$/.test(rows[0])) rows.shift();
  while (rows.length && /^0+$/.test(rows[rows.length - 1])) rows.pop();
  const first = Math.min(...rows.map(r => r.search(/[1-9]/)).filter(i => i >= 0));
  const last = Math.max(...rows.map(r => r.length - 1 - [...r].reverse().join('').search(/[1-9]/)));
  return rows.map(r => r.slice(first, last + 1));
}

/** A picture of the measured cells, for checking the result by eye. */
async function cellsPicture(rows, file) {
  const cols = rows[0].length, W = cols * 6, H = rows.length * 10;
  const px = Buffer.alloc(W * H * 3);
  rows.forEach((row, y) => [...row].forEach((c, x) => {
    const g = Math.round(+c / 9 * 255);
    for (let yy = 0; yy < 10; yy++) {
      const start = ((y * 10 + yy) * W + x * 6) * 3;
      px.fill(g, start, start + 18);
    }
  }));
  await sharp(px, { raw: { width: W, height: H, channels: 3 } }).png().toFile(file);
}

(async () => {
  const isModel = /\.glb$/i.test(INPUT);
  let rgba, W, H, cols, isFigure;
  if (isModel) {
    const shot = SHOTS[NAME];
    if (!shot) throw new Error(`No framing for "${NAME}". Add it to SHOTS.`);
    let png = await renderModel(INPUT, shot);
    if (shot.crop) {
      const left = Math.round(shot.width * shot.crop[0]);
      png = await sharp(png).extract({ left, top: 0, width: Math.round(shot.width * shot.crop[1]) - left, height: shot.height }).png().toBuffer();
    }
    if (PREVIEW) fs.writeFileSync(path.join(__dirname, `art-${NAME}-render.png`), png);
    ({ data: rgba, info: { width: W, height: H } } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true }));
    cols = Math.round(shot.cols * (shot.crop ? shot.crop[1] - shot.crop[0] : 1));
    isFigure = (r, g, b) => (r * 0.3 + g * 0.59 + b * 0.11) / 255 > 0.02;
  } else {
    const pic = PICTURES[NAME] ?? PICTURES.default;
    const img = pic.rotate ? sharp(await sharp(INPUT).rotate(pic.rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()) : sharp(INPUT);
    ({ data: rgba, info: { width: W, height: H } } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true }));
    cols = pic.cols;
    isFigure = (r, g, b, a) => a > 128;
    // Paper first (it needs the plain paper at the picture's edges to know its
    // colour), then the outline: everything outside it turns clear.
    if (pic.paper) rgba = removePaper(rgba, W, H, pic.dropOlive);
    if (pic.outline) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><polygon points="${pic.outline.map(p => p.join(',')).join(' ')}" fill="#fff"/></svg>`;
      const mask = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
      for (let i = 0; i < W * H; i++) if (mask[i * 4 + 3] < 128) rgba[i * 4 + 3] = 0;
    }
    if (PREVIEW && (pic.paper || pic.outline)) await sharp(Buffer.from(rgba), { raw: { width: W, height: H, channels: 4 } }).png().toFile(path.join(__dirname, `art-${NAME}-cutout.png`));
    if (pic.relief) {
      rgba = relief(rgba, W, H, isFigure, pic.detail);
      if (PREVIEW) await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toFile(path.join(__dirname, `art-${NAME}-render.png`));
    }
  }
  const rows = toCells(rgba, W, H, cols, isFigure);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, `${NAME}.json`);
  fs.writeFileSync(out, JSON.stringify({ cols: rows[0].length, rows }) + '\n');
  console.log(`Wrote ${path.relative(process.cwd(), out)}: ${rows[0].length} x ${rows.length} cells, ${fs.statSync(out).size} bytes`);
  if (PREVIEW) {
    await cellsPicture(rows, path.join(__dirname, `art-${NAME}-cells.png`));
    console.log(`Wrote tools/art-${NAME}-cells.png`);
  }
})().catch(e => { console.error(e.message ?? e); process.exit(1); });
