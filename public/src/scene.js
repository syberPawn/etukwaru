// Paints the dump itself: sky, garbage ridges, the old mound on the right and
// the dirt. It only changes on resize, so it is rendered once to a canvas.

import { mulberry } from './junk.js';

const lerp = (a, b, t) => a + (b - a) * t;

function ridge(seed, base, amp) {
  const rng = mulberry(seed);
  const waves = Array.from({ length: 6 }, (_, i) => ({
    k: (.0022 + rng() * .002) * (i + 1),
    p: rng() * 6.28,
    a: amp / (i + 1.3),
  }));
  return x => base - waves.reduce((s, w) => s + (Math.sin(x * w.k + w.p) + 1) * w.a, 0);
}

function noiseTile(size, seed, contrast) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const rng = mulberry(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = rng() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = contrast;
  }
  g.putImageData(img, 0, 0);
  return c;
}

const TRASH = ['#4b4438', '#5a4d39', '#3a3a38', '#6a5a42', '#2f3331', '#71664f', '#4c5240',
  '#544034', '#3f464c', '#7c735f', '#2a2926', '#4e3b30', '#8a8069', '#37424c', '#5f3a30', '#46423a'];

function trashField(g, rng, x0, x1, surface, bottom, count, minS, maxS, shade) {
  const floorAt = typeof bottom === 'function' ? bottom : () => bottom;
  for (let i = 0; i < count; i++) {
    const x = lerp(x0, x1, rng());
    const top = surface(x);
    const floor = floorAt(x);
    if (top >= floor) continue;
    const depth = Math.pow(rng(), 1.5);
    const y = lerp(top, floor, depth);
    const s = lerp(minS, maxS, rng());
    const a = rng() * 6.28;
    const c = Math.cos(a), si = Math.sin(a);
    const hw = s * lerp(.5, 1.2, rng()), hh = s * lerp(.2, .7, rng());
    g.fillStyle = TRASH[Math.floor(rng() * TRASH.length)];
    g.globalAlpha = lerp(.75, 1, rng());
    g.beginPath();
    g.moveTo(x + c * hw - si * hh, y + si * hw + c * hh);
    g.lineTo(x - c * hw - si * hh, y - si * hw + c * hh);
    g.lineTo(x - c * hw + si * hh * .6, y - si * hw - c * hh);
    g.lineTo(x + c * hw + si * hh, y + si * hw - c * hh * .7);
    g.closePath();
    g.fill();
  }
  g.globalAlpha = 1;
  // Deeper in the pile is darker.
  if (shade) {
    const low = floorAt(x1);
    const dark = g.createLinearGradient(0, low - (low - shade) * .9, 0, low);
    dark.addColorStop(0, 'rgba(10,8,5,0)');
    dark.addColorStop(1, 'rgba(10,8,5,.5)');
    g.fillStyle = dark;
    g.beginPath();
    g.moveTo(x0, floorAt(x0));
    for (let x = x0; x <= x1; x += 16) g.lineTo(x, surface(x) + 3);
    for (let x = x1; x >= x0; x -= 16) g.lineTo(x, floorAt(x));
    g.closePath();
    g.fill();
  }
}

function silhouette(g, x0, x1, surface, bottom, color) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x0, bottom);
  for (let x = x0; x <= x1 + 8; x += 8) g.lineTo(x, surface(x));
  g.lineTo(x1, bottom);
  g.closePath();
  g.fill();
}

/**
 * @param view     the camera (see computeView in main.js)
 * @param layout   { ground, moundX, terrain(x) -> surface y }
 */
export function paintBackground(view, layout) {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(view.vw * dpr);
  canvas.height = Math.round(view.vh * dpr);
  const g = canvas.getContext('2d');
  const s = view.scale * dpr;
  const toWorldSpace = () => g.setTransform(s, 0, 0, s, view.offX * s, -view.offY * s);
  toWorldSpace();

  const x0 = -view.offX - 20;
  const x1 = view.W + view.offX + 20;
  const yTop = view.offY - 20;
  const yBot = view.offY + view.visH + 20;
  const { ground, terrain, moundX } = layout;
  const horizon = ground - 96;
  const rng = mulberry(90210);

  // Overcast sky
  const sky = g.createLinearGradient(0, yTop, 0, horizon);
  sky.addColorStop(0, '#5f615e');
  sky.addColorStop(.55, '#8d8a7c');
  sky.addColorStop(1, '#b5a88a');
  g.fillStyle = sky;
  g.fillRect(x0, yTop, x1 - x0, horizon - yTop + 40);
  for (let i = 0; i < 90; i++) {
    const x = lerp(x0, x1, rng()), y = lerp(yTop, horizon - 120, rng());
    const rx = lerp(120, 460, rng()), ry = rx * lerp(.14, .3, rng());
    const puff = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    const light = rng() > .55;
    puff.addColorStop(0, light ? 'rgba(190,186,170,.2)' : 'rgba(55,56,56,.2)');
    puff.addColorStop(1, 'rgba(120,120,110,0)');
    g.save();
    g.translate(x, y);
    g.scale(rx, ry);
    g.fillStyle = puff;
    g.beginPath();
    g.arc(0, 0, 1, 0, 7);
    g.fill();
    g.restore();
  }

  // Distant garbage ridges, fading into the haze
  const layers = [
    { seed: 11, base: horizon - 6, amp: 64, count: 3600, size: [1.5, 4], hazeA: .62, col: '#6f6c5e' },
    { seed: 27, base: horizon + 6, amp: 92, count: 6200, size: [2, 6.5], hazeA: .42, col: '#57544a' },
    { seed: 53, base: horizon + 14, amp: 66, count: 8200, size: [3, 10], hazeA: .2, col: '#443f36' },
  ];
  for (const l of layers) {
    const surf = ridge(l.seed, l.base, l.amp);
    silhouette(g, x0, x1, surf, horizon + 60, l.col);
    trashField(g, rng, x0, x1, surf, horizon + 60, l.count, l.size[0], l.size[1], null);
    // Haze only over this ridge, so the sky above it stays clean.
    g.save();
    g.beginPath();
    g.moveTo(x0, horizon + 60);
    for (let x = x0; x <= x1 + 8; x += 8) g.lineTo(x, surf(x) - 4);
    g.lineTo(x1, horizon + 60);
    g.closePath();
    g.clip();
    g.globalAlpha = l.hazeA;
    g.fillStyle = '#a59b82';
    g.fillRect(x0, yTop, x1 - x0, horizon + 60 - yTop);
    g.restore();
  }

  // Dirt
  const dirt = g.createLinearGradient(0, horizon, 0, yBot);
  dirt.addColorStop(0, '#6d5f49');
  dirt.addColorStop(.18, '#5b4d39');
  dirt.addColorStop(.6, '#40352a');
  dirt.addColorStop(1, '#2a241c');
  g.fillStyle = dirt;
  g.fillRect(x0, horizon, x1 - x0, yBot - horizon);

  g.setTransform(1, 0, 0, 1, 0, 0);
  const groundPx = Math.round((horizon - view.offY) * s);
  g.globalCompositeOperation = 'overlay';
  g.save();
  g.scale(3.2, 3.2);
  g.fillStyle = g.createPattern(noiseTile(256, 7, 60), 'repeat');
  g.fillRect(0, groundPx / 3.2, canvas.width / 3.2, canvas.height / 3.2);
  g.restore();
  g.fillStyle = g.createPattern(noiseTile(128, 8, 34), 'repeat');
  g.fillRect(0, groundPx, canvas.width, canvas.height);
  g.globalCompositeOperation = 'source-over';
  toWorldSpace();

  // The track the truck drives along
  g.lineCap = 'round';
  for (const [width, alpha] of [[22, .1], [13, .16], [7, .18]]) {
    g.strokeStyle = `rgba(16,12,7,${alpha})`;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(x0, ground + 4);
    for (let x = x0; x < x1; x += 34) g.lineTo(x, ground + 4 + Math.sin(x * .017) * 2.5 + rng() * 2.5);
    g.stroke();
  }
  g.strokeStyle = 'rgba(146,128,98,.22)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x0, ground + 14);
  for (let x = x0; x < x1; x += 40) g.lineTo(x, ground + 14 + rng() * 3);
  g.stroke();

  // Tyre ruts, pebbles and litter on the dirt
  for (let r = 0; r < 6; r++) {
    const y = ground + 18 + r * 26 + rng() * 10;
    g.strokeStyle = `rgba(20,15,9,${.2 - r * .02})`;
    g.lineWidth = lerp(7, 15, r / 5);
    g.beginPath();
    g.moveTo(x0, y);
    for (let x = x0; x < x1; x += 90) g.lineTo(x, y + Math.sin(x * .008 + r) * 8 + rng() * 3);
    g.stroke();
  }
  for (let i = 0; i < 4200; i++) {
    const t = Math.pow(rng(), .8);
    const y = lerp(horizon, yBot, t), x = lerp(x0, x1, rng());
    const r = lerp(.5, 2.4, t) * lerp(.4, 1.3, rng());
    g.fillStyle = ['#6d604c', '#2d261c', '#75684f', '#4a3f30', '#5a4e3c'][Math.floor(rng() * 5)];
    g.beginPath();
    g.ellipse(x, y, r * 1.5, r, 0, 0, 7);
    g.fill();
  }
  const litter = x => horizon + 8 + Math.abs(Math.sin(x * .11)) * 14;
  trashField(g, rng, x0, x1, litter, ground - 2, 900, 1.2, 4.5, null);
  trashField(g, rng, x0, x1, () => ground + 70, yBot, 260, 2, 7, null);

  // The old mound the new load slides against. It feathers out at its foot.
  const foot = x => ground + Math.min(46, (x - moundX) * .22);
  const moundEnd = Math.max(x1, moundX + 40);
  g.fillStyle = '#2f2a22';
  g.beginPath();
  g.moveTo(moundX, ground);
  for (let x = moundX; x <= moundEnd; x += 8) g.lineTo(x, terrain(x));
  for (let x = moundEnd; x >= moundX; x -= 8) g.lineTo(x, foot(x));
  g.closePath();
  g.fill();
  trashField(g, rng, moundX, moundEnd, x => terrain(x) - 2, foot, 8000, 2, 9, terrain(view.W + 200));
  trashField(g, rng, moundX, moundEnd, x => terrain(x) - 3, foot, 500, 7, 18, null);

  return canvas;
}

/**
 * A strip of the same dirt, with a ragged top edge, drawn over the truck and
 * junk. It covers the bottom of the tyres, so they sit in the ground.
 */
export function paintGroundLip(view, background, ground) {
  const canvas = document.createElement('canvas');
  canvas.width = background.width;
  canvas.height = background.height;
  const g = canvas.getContext('2d');
  const s = canvas.width / view.vw * view.scale;
  const rng = mulberry(5150);
  const toPx = (x, y) => [(x + view.offX) * s, (y - view.offY) * s];

  g.beginPath();
  g.moveTo(...toPx(-view.offX - 20, ground + 30));
  for (let x = -view.offX - 20; x <= view.W + view.offX + 20; x += 5 + rng() * 8) {
    g.lineTo(...toPx(x, ground - 2 - rng() * 6));
  }
  g.lineTo(...toPx(view.W + view.offX + 20, ground + 30));
  g.closePath();
  g.clip();
  g.drawImage(background, 0, 0);
  return canvas;
}

/** A single colour grade laid over everything, so the photo truck and the drawn dump match. */
export function paintGrade(view) {
  const canvas = document.createElement('canvas');
  canvas.width = view.vw;
  canvas.height = view.vh;
  const g = canvas.getContext('2d');
  const { vw: w, vh: h } = view;

  g.fillStyle = 'rgba(120,104,72,.1)';
  g.fillRect(0, 0, w, h);

  const vignette = g.createRadialGradient(w / 2, h * .46, Math.min(w, h) * .38, w / 2, h * .5, Math.max(w, h) * .72);
  vignette.addColorStop(0, 'rgba(12,9,5,0)');
  vignette.addColorStop(1, 'rgba(12,9,5,.56)');
  g.fillStyle = vignette;
  g.fillRect(0, 0, w, h);

  g.fillStyle = g.createPattern(noiseTile(200, 31, 15), 'repeat');
  g.fillRect(0, 0, w, h);
  return canvas;
}
