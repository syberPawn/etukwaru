// Paints the dump: a still sky, garbage ridges that slide past slower the
// further away they are, the dirt, and the old mound beside the tipping spot.
// The ridges and dirt are cut into tiles that are painted the first time they
// come into view, so the truck can drive as far as it likes.

import { mulberry } from './junk.js';

const lerp = (a, b, t) => a + (b - a) * t;

const TILE_PX = 1024;   // tile width in canvas pixels
const CELL = 64;        // world units per scatter cell
const KEEP = 3;         // tiles kept past each screen edge before they are dropped
const PAD = 16;         // spare sky around the screen, for the shake

/** A repeatable random number in [0, 1) for a pair of integers. */
function hash(a, b) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

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

/** A canvas and its context. Opaque ones are cheaper to draw. */
function newCanvas(w, h, opaque = false) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = Math.max(1, Math.ceil(h));
  return { canvas: c, g: c.getContext('2d', { alpha: !opaque }) };
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

/**
 * Scatters pieces over [x0, x1] cell by cell. Each cell has its own seed, so
 * two tiles that both reach into a cell paint the same pieces there.
 */
function scatter(x0, x1, seed, perUnit, paint) {
  const want = perUnit * CELL;
  for (let c = Math.floor(x0 / CELL); c * CELL < x1; c++) {
    const rng = mulberry(Math.floor(hash(seed, c) * 4294967296));
    paint(rng, c * CELL, (c + 1) * CELL, Math.floor(want) + (rng() < want % 1 ? 1 : 0));
  }
}

/** A line whose wobble comes from fixed grid points, so it carries on across tiles. */
function wobblyLine(g, x0, x1, step, seed, yAt) {
  const k0 = Math.floor(x0 / step) - 1, k1 = Math.ceil(x1 / step) + 1;
  g.beginPath();
  for (let k = k0; k <= k1; k++) {
    const x = k * step, y = yAt(x, hash(seed, k));
    if (k === k0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
}

/** The ridge's outline from x0 to x1, closed along `bottom`. */
function ridgePath(g, x0, x1, surface, bottom) {
  g.beginPath();
  g.moveTo(x0 - 8, bottom);
  for (let x = Math.floor(x0 / 8) * 8 - 8; x <= x1 + 16; x += 8) g.lineTo(x, surface(x));
  g.lineTo(x1 + 16, bottom);
  g.closePath();
}

// Only down to where the dirt starts covering it.
function paintSky(view, dpr, horizon) {
  const s = view.scale * dpr;
  const { canvas, g } = newCanvas(Math.round(view.vw * dpr) + PAD * 2, (horizon + 4 - view.offY) * s + PAD * 2, true);
  g.setTransform(s, 0, 0, s, view.offX * s + PAD, -view.offY * s + PAD);
  const x0 = -view.offX - 40, x1 = view.W + view.offX + 40;
  const yTop = view.offY - 40, yBot = view.offY + view.visH + 40;
  const rng = mulberry(90210);

  // Overcast sky
  const sky = g.createLinearGradient(0, yTop, 0, horizon);
  sky.addColorStop(0, '#5f615e');
  sky.addColorStop(.55, '#8d8a7c');
  sky.addColorStop(1, '#b5a88a');
  g.fillStyle = sky;
  g.fillRect(x0, yTop, x1 - x0, yBot - yTop);
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
  return canvas;
}

// Distant garbage ridges, fading into the haze. `depth` is how fast each
// one slides past compared to the ground.
const RIDGES = [
  { seed: 11, rise: -6, amp: 64, count: 3600, size: [1.5, 4], hazeA: .62, col: '#6f6c5e', depth: .16 },
  { seed: 27, rise: 6, amp: 92, count: 6200, size: [2, 6.5], hazeA: .42, col: '#57544a', depth: .28 },
  { seed: 53, rise: 14, amp: 66, count: 8200, size: [3, 10], hazeA: .2, col: '#443f36', depth: .42 },
];

/**
 * @param view     the camera (see computeView in main.js)
 * @param layout   { ground, moundX, terrain(x) -> surface y }
 * @returns drawBack / drawLip, each taking the canvas context, the camera's
 *          world x and a whole-pixel shake offset.
 */
export function makeScenery(view, { ground, terrain, moundX }) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const s = view.scale * dpr;
  const tileW = TILE_PX / s;
  const screenW = Math.round(view.vw * dpr);
  const horizon = ground - 96;
  const yBot = view.offY + view.visH + 20;
  // Densities match what the old one-screen painting had.
  const perUnit = count => count / (view.W + 2 * view.offX + 40);
  const sky = paintSky(view, dpr, horizon);
  const grain = [noiseTile(256, 7, 60), noiseTile(128, 8, 34)];

  const layers = RIDGES.map(l => {
    const surf = ridge(l.seed, horizon + l.rise, l.amp);
    const floor = horizon + 60;
    const top = horizon + l.rise - l.amp * 4.2 - 12;
    return {
      depth: l.depth, top, bottom: floor, tiles: new Map(),
      paint(g, x0, x1) {
        g.fillStyle = l.col;
        ridgePath(g, x0, x1, surf, floor);
        g.fill();
        scatter(x0 - 12, x1 + 12, l.seed, perUnit(l.count),
          (rng, a, b, n) => trashField(g, rng, a, b, surf, floor, n, l.size[0], l.size[1], null));
        // Haze only over this ridge, so the sky above it stays clean.
        g.save();
        ridgePath(g, x0, x1, x => surf(x) - 4, floor);
        g.clip();
        g.globalAlpha = l.hazeA;
        g.fillStyle = '#a59b82';
        g.fillRect(x0 - 8, top, x1 - x0 + 16, floor - top);
        g.restore();
      },
    };
  });

  const pebbles = ['#6d604c', '#2d261c', '#75684f', '#4a3f30', '#5a4e3c'];
  const litter = x => horizon + 8 + Math.abs(Math.sin(x * .11)) * 14;
  const dirtLayer = {
    depth: 1, top: horizon, bottom: yBot + 30, tiles: new Map(), lips: new Map(),
    paint(g, x0, x1) {
      const dirt = g.createLinearGradient(0, horizon, 0, yBot);
      dirt.addColorStop(0, '#6d5f49');
      dirt.addColorStop(.18, '#5b4d39');
      dirt.addColorStop(.6, '#40352a');
      dirt.addColorStop(1, '#2a241c');
      g.fillStyle = dirt;
      g.fillRect(x0 - 4, horizon, x1 - x0 + 8, this.bottom - horizon);

      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'overlay';
      const { width: w, height: h } = g.canvas;
      g.scale(3.2, 3.2);
      g.fillStyle = g.createPattern(grain[0], 'repeat');
      g.fillRect(0, 0, w / 3.2, h / 3.2);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = g.createPattern(grain[1], 'repeat');
      g.fillRect(0, 0, w, h);
      g.restore();

      // The track the truck drives along
      g.lineCap = 'round';
      for (const [width, alpha] of [[22, .1], [13, .16], [7, .18]]) {
        g.strokeStyle = `rgba(16,12,7,${alpha})`;
        g.lineWidth = width;
        wobblyLine(g, x0, x1, 34, 100 + width, (x, j) => ground + 4 + Math.sin(x * .017) * 2.5 + j * 2.5);
      }
      g.strokeStyle = 'rgba(146,128,98,.22)';
      g.lineWidth = 3;
      wobblyLine(g, x0, x1, 40, 131, (x, j) => ground + 14 + j * 3);

      // Tyre ruts, pebbles and litter on the dirt
      for (let r = 0; r < 6; r++) {
        const y = ground + 18 + r * 26 + hash(140, r) * 10;
        g.strokeStyle = `rgba(20,15,9,${.2 - r * .02})`;
        g.lineWidth = lerp(7, 15, r / 5);
        wobblyLine(g, x0, x1, 90, 150 + r, (x, j) => y + Math.sin(x * .008 + r) * 8 + j * 3);
      }
      scatter(x0 - 8, x1 + 8, 170, perUnit(4200), (rng, a, b, n) => {
        for (let i = 0; i < n; i++) {
          const t = Math.pow(rng(), .8);
          const y = lerp(horizon, yBot, t), x = lerp(a, b, rng());
          const r = lerp(.5, 2.4, t) * lerp(.4, 1.3, rng());
          g.fillStyle = pebbles[Math.floor(rng() * pebbles.length)];
          g.beginPath();
          g.ellipse(x, y, r * 1.5, r, 0, 0, 7);
          g.fill();
        }
      });
      scatter(x0 - 8, x1 + 8, 180, perUnit(900),
        (rng, a, b, n) => trashField(g, rng, a, b, litter, ground - 2, n, 1.2, 4.5, null));
      scatter(x0 - 12, x1 + 12, 190, perUnit(260),
        (rng, a, b, n) => trashField(g, rng, a, b, () => ground + 70, yBot, n, 2, 7, null));
    },
  };

  // The old mound the new load slides against. It feathers out at its foot.
  // It only exists at the dump, so it is one picture rather than tiles.
  const oldEnd = Math.max(view.W + view.offX + 20, moundX + 40);
  const moundEnd = oldEnd + 80;
  let peak = ground;
  for (let x = moundX; x <= moundEnd; x += 4) peak = Math.min(peak, terrain(x));
  const mound = { x: moundX - 4, y: peak - 24 };
  mound.w = moundEnd - mound.x + 4;
  mound.h = ground + 56 - mound.y;
  {
    const { canvas, g } = newCanvas(Math.ceil(mound.w * s), mound.h * s);
    mound.canvas = canvas;
    g.setTransform(s, 0, 0, s, -mound.x * s, -mound.y * s);
    const rng = mulberry(4242);
    const more = (moundEnd - moundX) / (oldEnd - moundX);
    const foot = x => ground + Math.min(46, (x - moundX) * .22);
    g.fillStyle = '#2f2a22';
    g.beginPath();
    g.moveTo(moundX, ground);
    for (let x = moundX; x <= moundEnd; x += 8) g.lineTo(x, terrain(x));
    for (let x = moundEnd; x >= moundX; x -= 8) g.lineTo(x, foot(x));
    g.closePath();
    g.fill();
    trashField(g, rng, moundX, moundEnd, x => terrain(x) - 2, foot, Math.round(8000 * more), 2, 9, terrain(view.W + 200));
    trashField(g, rng, moundX, moundEnd, x => terrain(x) - 3, foot, Math.round(500 * more), 7, 18, null);
  }

  // A strip of the same ground, with a ragged top edge, drawn over the truck
  // and junk. It covers the bottom of the tyres, so they sit in the ground.
  const lipTop = ground - 14, lipBottom = ground + 30;
  function paintLip(k, tile) {
    const { canvas: c, g } = newCanvas(TILE_PX, (lipBottom - lipTop) * s);
    g.setTransform(s, 0, 0, s, -k * TILE_PX, -lipTop * s);
    const x0 = k * tileW, x1 = x0 + tileW;
    g.beginPath();
    g.moveTo(x0 - 16, lipBottom);
    for (let j = Math.floor(x0 / 8) - 1; j * 8 <= x1 + 16; j++) {
      g.lineTo(j * 8 + hash(200, j) * 5, ground - 2 - hash(201, j) * 6);
    }
    g.lineTo(x1 + 16, lipBottom);
    g.closePath();
    g.clip();
    g.drawImage(tile, x0, dirtLayer.top, tileW, tile.height / s);
    if (x1 > mound.x && x0 < mound.x + mound.w) {
      g.drawImage(mound.canvas, mound.x, mound.y, mound.canvas.width / s, mound.canvas.height / s);
    }
    return c;
  }

  // Tiles on screen are painted straight away. One more, just off screen,
  // may be painted each frame, so driving rarely has to wait for one.
  let painted = 0;
  function tile(layer, k, needed) {
    let t = layer.tiles.get(k);
    if (t || (!needed && painted > 0)) return t;
    const { canvas, g } = newCanvas(TILE_PX, (layer.bottom - layer.top) * s, layer === dirtLayer);
    t = canvas;
    g.setTransform(s, 0, 0, s, -k * TILE_PX, -layer.top * s);
    layer.paint(g, k * tileW, (k + 1) * tileW);
    layer.tiles.set(k, t);
    layer.lips?.set(k, paintLip(k, t));
    painted++;
    return t;
  }

  function onScreen(layer, camX, ox) {
    const shift = Math.round((view.offX - camX * layer.depth) * s) + ox;
    return { shift, k0: Math.floor(-shift / TILE_PX), k1: Math.floor((screenW - 1 - shift) / TILE_PX) };
  }

  function drawLayer(ctx, layer, camX, ox, oy) {
    const { shift, k0, k1 } = onScreen(layer, camX, ox);
    const y = Math.round((layer.top - view.offY) * s) + oy;
    for (let k = k0; k <= k1; k++) ctx.drawImage(tile(layer, k, true), k * TILE_PX + shift, y);
    tile(layer, k0 - 1, false);
    tile(layer, k1 + 1, false);
    for (const k of layer.tiles.keys()) {
      if (k < k0 - KEEP || k > k1 + KEEP) {
        layer.tiles.delete(k);
        layer.lips?.delete(k);
      }
    }
  }

  return {
    drawBack(ctx, camX, ox, oy) {
      painted = 0;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(sky, ox - PAD, oy - PAD);
      for (const layer of layers) drawLayer(ctx, layer, camX, ox, oy);
      drawLayer(ctx, dirtLayer, camX, ox, oy);
      const mx = Math.round((mound.x + view.offX - camX) * s) + ox;
      if (mx < screenW && mx + mound.canvas.width > 0) {
        ctx.drawImage(mound.canvas, mx, Math.round((mound.y - view.offY) * s) + oy);
      }
    },
    drawLip(ctx, camX, ox, oy) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const { shift, k0, k1 } = onScreen(dirtLayer, camX, ox);
      const y = Math.round((lipTop - view.offY) * s) + oy;
      for (let k = k0; k <= k1; k++) {
        tile(dirtLayer, k, true);
        ctx.drawImage(dirtLayer.lips.get(k), k * TILE_PX + shift, y);
      }
    },
  };
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
