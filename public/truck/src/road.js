// The road out of the dump: billboards along the way, clouds in the sky
// behind, and the road block at the end. Also paints all of them.
//
// Distances are how far the camera has followed the truck (world units),
// measured in screen widths, so the road feels the same on any screen.

import { mulberry } from './junk.js';

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Where the billboards stand. They are spaced irregularly, some set further
 * back from the road than others, so the way out never looks like a row.
 * @returns { boards: [{ D, back, size, lift, mono, lean, seed }], end }. Each board is in the
 *          middle of the screen when the camera has driven D; end is where
 *          the road block stops the truck.
 */
export function planRoad(view, count) {
  const S = view.visW;
  const scale = boardScale(view);
  const rng = mulberry(4040);
  const boards = [];
  let D = .75 * S;                            // the first is just off screen at the start
  for (let i = 0; i < count; i++) {
    // Some stand further back from the road: smaller, hazier, higher up the dirt.
    // All of them move with the ground, so their feet stay put on it.
    const back = rng() < .4;
    const size = (back ? .8 : 1) * lerp(.86, 1.06, rng());
    if (i > 0) {
      // Never overlapping. Beyond that, mostly close together, now and then
      // a long empty stretch.
      const clear = BOARD_SPRITE_W * scale * (boards[i - 1].size + size) / 2;
      D += clear * lerp(1.08, 1.35, rng()) + Math.pow(rng(), 2.2) * S;
    }
    boards.push({
      D, back, size,
      lift: rng(),                              // how tall its legs are, within what the screen allows
      mono: rng() < .4,                         // one central pole instead of two legs
      lean: (rng() - .5) * .022,                // old boards settle a little
      seed: Math.floor(rng() * 1e6),
    });
  }
  // The road block stands just before the last board, so that board is still
  // in view, above the truck, when the road ends.
  return { boards, end: (boards.at(-1)?.D ?? S) - .25 * S };
}

/** How much bigger billboards are drawn on small screens, so they stay readable. */
export const boardScale = view => Math.max(1, .55 / view.scale);

/**
 * Background clouds, spread over every part of the sky the drive will show.
 * They sit far off, so they drift by slowly.
 * @returns [{ x, y, depth, w, seed }] with x, y the top-left in layer units
 */
export function planSkyClouds(view, end, skyTop, skyBottom) {
  const rng = mulberry(3131);
  const list = [];
  const count = Math.round((view.visW + end * .14) / 420);
  for (let i = 0; i < count; i++) {
    const depth = lerp(.06, .2, rng());
    const from = -view.offX - end * depth - 300, to = view.W + view.offX + 100;
    const w = lerp(240, 560, Math.pow(rng(), 1.4));
    list.push({ x: lerp(from, to, rng()), y: lerp(skyTop, skyBottom - w * .3, rng()), depth, w, seed: Math.floor(rng() * 1e6) });
  }
  return list;
}

/* ---------- Painting helpers ---------- */

/** A canvas holding `w` x `h` world units at `s` pixels per unit. */
function sprite(w, h, s, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w * s));
  canvas.height = Math.max(1, Math.ceil(h * s));
  const g = canvas.getContext('2d');
  g.scale(s, s);
  paint(g);
  return { canvas, w, h };
}

function signText(g, text, x, y, size, color, maxW) {
  g.font = `400 ${size}px Impact, "Arial Black", "Arial Narrow Bold", sans-serif`;
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, x, y, maxW);
}

/* ---------- Clouds ---------- */

function hash01(x, y, seed) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth random hills: fractal value noise, 0 to 1. */
function fractalNoise(seed) {
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const u = x - xi, v = y - yi;
    const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    const a = hash01(xi, yi, seed), b = hash01(xi + 1, yi, seed);
    const c = hash01(xi, yi + 1, seed), d = hash01(xi + 1, yi + 1, seed);
    return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
  };
  return (x, y) => {
    let sum = 0, amp = .5, f = 1;
    for (let o = 0; o < 5; o++) {
      sum += amp * noise(x * f + o * 17.3, y * f - o * 9.1);
      amp *= .5;
      f *= 2.03;
    }
    return sum / .96875;
  };
}

// Muted to the overcast sky, so the clouds sit in it rather than on it.
const TONE = { light: [198, 194, 183], shade: [118, 119, 116], alpha: .66 };

/**
 * A cumulus cloud, painted pixel by pixel: a few rounded lobes roughed up
 * with fractal noise, lit from above so the tops are bright and the flat
 * base is grey.
 * @returns a sprite of w x h world units
 */
export function paintCumulus(seed, w, h, s, tone = TONE) {
  const { light: LIGHT, shade: SHADE, alpha } = tone;
  const rng = mulberry(seed);
  const fbm = fractalNoise(seed);
  const base = h * .8, tall = h * .7;

  const n = Math.max(3, Math.round((w / h) * 3));
  const lobes = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const hump = Math.sin(Math.PI * lerp(.12, .88, t));
    const rx = w * lerp(.12, .19, rng());
    const ry = tall * lerp(.42, .58, rng()) * (.5 + .5 * hump);
    lobes.push({ cx: lerp(.2, .8, t) * w + (rng() - .5) * w * .05, cy: base - ry * .5, rx, ry });
  }
  for (let i = 0; i < 2; i++) {                 // billowing towers on top
    const rx = w * lerp(.09, .14, rng());
    lobes.push({ cx: lerp(.33, .67, rng()) * w, cy: base - tall * lerp(.5, .62, rng()), rx, ry: rx * lerp(.85, 1.1, rng()) });
  }
  for (const l of lobes) l.ry = Math.min(l.ry, l.cy - h * .05);   // keep tops on the canvas

  const k = 3.4 / h;                            // noise features per world unit
  const density = (x, y) => {
    let shape = -1;
    for (const l of lobes) {
      const dx = (x - l.cx) / l.rx, dy = (y - l.cy) / l.ry;
      shape = Math.max(shape, 1 - dx * dx - dy * dy);
    }
    if (shape < -.7) return -1;
    const flat = Math.min(1, Math.max(0, (base - y) / (h * .12) + .15));   // a flat underside
    const edge = Math.min(1, Math.min(x, w - x, y) / (h * .14));           // never cut off at the sides
    const d = shape + (fbm(x * k, y * k) - .5) * 1.4;
    return d > 0 ? d * flat * edge : d;
  };

  // Computed at half resolution: clouds are soft, and this is the slow part.
  const rs = s * .5;
  const low = document.createElement('canvas');
  low.width = Math.max(1, Math.ceil(w * rs));
  low.height = Math.max(1, Math.ceil(h * rs));
  const lg = low.getContext('2d');
  const img = lg.createImageData(low.width, low.height);
  const px = img.data;
  // Steps towards the sun, which is up and a little to the left.
  const steps = [1, 2, 3, 4, 5].map(i => [-w * .006 * i, -h * .05 * i]);
  for (let j = 0; j < low.height; j++) {
    const y = (j + .5) / rs;
    const lift = Math.min(1, Math.max(0, (base - y) / tall));
    for (let i = 0; i < low.width; i++) {
      const x = (i + .5) / rs;
      const d = density(x, y);
      if (d <= 0) continue;
      // The more cloud between here and the sun, the deeper the shadow.
      let thick = 0;
      for (const [sx, sy] of steps) thick += Math.max(0, density(x + sx, y + sy));
      const lit = Math.min(1, Math.max(0, .3 + .7 * Math.exp(-thick * .6) + (lift - .45) * .25));
      const a = Math.min(1, d / .42);
      const o = (j * low.width + i) * 4;
      px[o] = SHADE[0] + (LIGHT[0] - SHADE[0]) * lit;
      px[o + 1] = SHADE[1] + (LIGHT[1] - SHADE[1]) * lit;
      px[o + 2] = SHADE[2] + (LIGHT[2] - SHADE[2]) * lit;
      px[o + 3] = 255 * a * a * (3 - 2 * a) * alpha;
    }
  }
  lg.putImageData(img, 0, 0);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w * s));
  canvas.height = Math.max(1, Math.ceil(h * s));
  const g = canvas.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(low, 0, 0, canvas.width, canvas.height);

  return { canvas, w, h };
}

/* ---------- Billboards ---------- */

export const BOARD_W = 400;                          // frame width, world units, before a board's size
const PAD = 12;                                      // frame border around the picture
export const SCREEN_W = BOARD_W - PAD * 2;
export const SCREEN_H = SCREEN_W * 9 / 16;           // pictures are 16:9
const CAPTION_H = 46;
const FRAME_H = PAD + SCREEN_H + CAPTION_H + 6;
const TOP = 34;                                      // room above the frame for the lamps
const SIDE = 10;
export const BOARD_SPRITE_W = BOARD_W + SIDE * 2;
/** Height of the sprite without its legs. */
export const BOARD_TOP_H = TOP + FRAME_H + 14;

function captionFit(g, text, size, maxW) {
  g.font = `400 ${size}px Impact, "Arial Black", "Arial Narrow Bold", sans-serif`;
  const w = g.measureText(text).width;
  if (w > maxW) g.font = `400 ${size * maxW / w}px Impact, "Arial Black", "Arial Narrow Bold", sans-serif`;
}

/**
 * A weathered roadside billboard: steel legs (two braced I-beams, or one
 * pipe pole), a catwalk, lamps on stems over the top, and a frame with a
 * caption strip. The picture is drawn into `screen` every frame, so a video
 * can play there.
 * @param legs  world units of leg between the ground and the catwalk
 * @returns { canvas, w, h, screen: { x, y, w, h }, lamps: [{ x, y }] }, world
 *          units, top-left origin, with the ground along the bottom edge.
 *          Each lamp point is the lens, where the light comes from.
 */
export function paintBillboard(caption, legs, seed, s, mono = false) {
  const rng = mulberry(seed);
  const w = BOARD_SPRITE_W, h = BOARD_TOP_H + legs;
  const fx = SIDE, fy = TOP, fw = BOARD_W;
  const deck = fy + FRAME_H;
  const screen = { x: fx + PAD, y: fy + PAD, w: SCREEN_W, h: SCREEN_H };
  const lampXs = mono ? [.3, .7] : [.17, .5, .83];
  const lamps = lampXs.map(t => ({ x: fx + fw * t, y: fy - 4 }));

  const beam = (x, half) => {
    const b = g => {
      const grad = g.createLinearGradient(x - half, 0, x + half, 0);
      grad.addColorStop(0, '#34322e');
      grad.addColorStop(.42, '#69655d');
      grad.addColorStop(1, '#2b2926');
      return grad;
    };
    return b;
  };

  return {
    screen, lamps,
    ...sprite(w, h, s, g => {
      if (mono) {
        // One round pole, with struts out to the catwalk
        const x = fx + fw / 2;
        g.fillStyle = beam(x, 13)(g);
        g.fillRect(x - 13, deck, 26, h - deck);
        g.strokeStyle = '#3e3b36';
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(x, deck + 70); g.lineTo(fx + fw * .2, deck + 6);
        g.moveTo(x, deck + 70); g.lineTo(fx + fw * .8, deck + 6);
        g.stroke();
        g.fillStyle = 'rgba(110,62,30,.3)';
        g.fillRect(x - 4, deck + 10, 4, (h - deck) * lerp(.2, .45, rng()));
        g.fillStyle = '#8d877a';                                // concrete footing
        g.fillRect(x - 26, h - 9, 52, 9);
      } else {
        // Two I-beams with cross braces
        const legX = [fx + fw * .26, fx + fw * .74];
        g.strokeStyle = '#47443e';
        g.lineWidth = 4;
        const step = lerp(62, 80, rng());
        for (let y = deck + 12; y < h - 30; y += step) {
          g.beginPath();
          g.moveTo(legX[0], y);
          g.lineTo(legX[1], Math.min(h - 10, y + step));
          g.moveTo(legX[1], y);
          g.lineTo(legX[0], Math.min(h - 10, y + step));
          g.stroke();
        }
        for (const x of legX) {
          g.fillStyle = beam(x, 9)(g);
          g.fillRect(x - 9, deck, 18, h - deck);
          g.fillStyle = 'rgba(110,62,30,.32)';
          g.fillRect(x - 3, deck + 8, 3, (h - deck) * lerp(.15, .5, rng()));
          g.fillStyle = '#8d877a';
          g.fillRect(x - 17, h - 8, 34, 8);
        }
      }

      // catwalk and railing
      g.fillStyle = '#3d3a35';
      g.fillRect(fx - 6, deck + 2, fw + 12, 7);
      g.strokeStyle = '#54514a';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(fx - 4, deck - 14);
      g.lineTo(fx + fw + 4, deck - 14);
      for (let x = fx; x <= fx + fw; x += 40) {
        g.moveTo(x, deck + 2);
        g.lineTo(x, deck - 14);
      }
      g.stroke();

      // frame
      g.fillStyle = '#26241f';
      g.fillRect(fx, fy, fw, FRAME_H);
      g.strokeStyle = '#4b4842';
      g.lineWidth = 3;
      g.strokeRect(fx + 1.5, fy + 1.5, fw - 3, FRAME_H - 3);
      // caption strip
      const cy = screen.y + screen.h + 4;
      g.fillStyle = '#e4d8bb';
      g.fillRect(screen.x, cy, screen.w, CAPTION_H - 6);
      g.fillStyle = '#231d14';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      captionFit(g, caption.toUpperCase(), 27, screen.w - 24);
      g.fillText(caption.toUpperCase(), screen.x + screen.w / 2, cy + (CAPTION_H - 6) / 2 + 1);
      // weathering: grime from the top, a few rust runs
      const grime = g.createLinearGradient(0, fy, 0, fy + FRAME_H);
      grime.addColorStop(0, 'rgba(40,32,20,0)');
      grime.addColorStop(1, 'rgba(40,32,20,.18)');
      g.fillStyle = grime;
      g.fillRect(fx, fy, fw, FRAME_H);
      for (let i = 0; i < 6; i++) {
        g.fillStyle = `rgba(110,62,30,${lerp(.1, .3, rng())})`;
        g.fillRect(fx + lerp(10, fw - 10, rng()), lerp(fy, cy, rng() * rng()), lerp(1.5, 3, rng()), lerp(8, 34, rng()));
      }

      // lamps: a stem from the top of the frame, bending out over the face,
      // ending in a hood with the lens underneath
      for (const l of lamps) {
        g.strokeStyle = '#2f2d29';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(l.x, fy + 2);
        g.lineTo(l.x, fy - 16);
        g.quadraticCurveTo(l.x, fy - 24, l.x + 8, fy - 22);
        g.stroke();
        g.fillStyle = '#3b3934';
        g.beginPath();
        g.moveTo(l.x + 2, fy - 26);
        g.lineTo(l.x + 18, fy - 26);
        g.lineTo(l.x + 22, fy - 14);
        g.lineTo(l.x - 2, fy - 14);
        g.closePath();
        g.fill();
        l.x += 10;
        l.y = fy - 14;
      }
    }),
  };
}

/**
 * Pictures for the boards that aren't projects, drawn rather than loaded.
 * @param kind  'instagram' | 'linkedin' | 'rent'
 */
export function paintBoardFace(kind, info, s) {
  const w = SCREEN_W, h = SCREEN_H;
  return sprite(w, h, s, g => {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (kind === 'about') {
      // A plain introduction, like a painted shop sign
      g.fillStyle = '#1f2a25';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#d8b24a';
      g.lineWidth = 3;
      g.strokeRect(12, 12, w - 24, h - 24);
      g.fillStyle = '#d8b24a';
      g.font = '700 15px "Courier New", monospace';
      g.fillText('MEET THE BUILDER', w / 2, 42);
      g.fillStyle = '#f1e9d2';
      g.font = '700 36px Georgia, "Times New Roman", serif';
      g.fillText(info.title, w / 2, 88, w - 50);
      g.font = 'italic 400 19px Georgia, "Times New Roman", serif';
      g.fillText(info.line, w / 2, 124, w - 50);
      g.fillStyle = '#d8b24a';
      g.font = '700 15px "Courier New", monospace';
      g.fillText(info.cta, w / 2, 164, w - 50);
    } else if (kind === 'instagram') {
      const bg = g.createLinearGradient(0, h, w, 0);
      bg.addColorStop(0, '#f9b552');
      bg.addColorStop(.35, '#e8513f');
      bg.addColorStop(.7, '#c2307e');
      bg.addColorStop(1, '#6a3ab8');
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      // a camera-shaped badge, drawn plainly
      g.strokeStyle = '#fff';
      g.lineWidth = 7;
      g.strokeRect(w / 2 - 36, 26, 72, 72);
      g.beginPath();
      g.arc(w / 2, 62, 18, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(w / 2 + 22, 40, 5, 0, Math.PI * 2);
      g.fill();
      g.font = '700 30px Georgia, "Times New Roman", serif';
      g.fillText(info.handle, w / 2, 140, w - 40);
      g.font = '700 15px "Courier New", monospace';
      g.fillText('FOLLOW ALONG', w / 2, 176);
    } else if (kind === 'linkedin') {
      g.fillStyle = '#0a5fb4';
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,.08)';
      for (let x = -h; x < w; x += 26) {
        g.beginPath();
        g.moveTo(x, h);
        g.lineTo(x + h, 0);
        g.lineTo(x + h + 10, 0);
        g.lineTo(x + 10, h);
        g.fill();
      }
      g.fillStyle = '#fff';
      g.font = '700 46px Georgia, "Times New Roman", serif';
      g.fillText(info.title, w / 2, 70, w - 40);
      g.font = '400 20px Georgia, "Times New Roman", serif';
      g.fillText(info.line, w / 2, 124, w - 40);
      g.font = '700 15px "Courier New", monospace';
      g.fillText(info.cta, w / 2, 168, w - 40);
    } else {
      // An empty board, patchy where old posters were scraped off
      const rng = mulberry(77);
      g.fillStyle = '#e9e3d3';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) {
        g.fillStyle = `rgba(${lerp(150, 200, rng())},${lerp(140, 190, rng())},${lerp(120, 170, rng())},${lerp(.15, .35, rng())})`;
        g.fillRect(lerp(-20, w, rng()), lerp(-10, h, rng()), lerp(20, 90, rng()), lerp(8, 40, rng()));
      }
      g.fillStyle = '#231d14';
      g.font = '400 44px Impact, "Arial Black", sans-serif';
      g.fillText(info.title, w / 2, 70, w - 40);
      g.font = '400 30px Impact, "Arial Black", sans-serif';
      g.fillText(info.line, w / 2, 116, w - 40);
      g.fillStyle = '#a3261b';
      g.font = '700 17px "Courier New", monospace';
      g.fillText(info.cta, w / 2, 166, w - 40);
    }
  });
}

/* ---------- The road block ---------- */

export const BLOCK_W = 400;   // world units from the far post to the nearest cone

/** Barricade, banner and cones. The right edge is the nearest cone. */
export function paintRoadBlock(s) {
  const W = BLOCK_W, H = 300;
  return sprite(W, H, s, g => {
    const ground = H;
    // banner posts
    g.fillStyle = '#4a4744';
    g.fillRect(24, 36, 9, ground - 36);
    g.fillRect(W - 107, 36, 9, ground - 36);
    // the banner
    g.fillStyle = '#e2a91c';
    g.fillRect(6, 30, W - 92, 96);
    g.strokeStyle = '#1b1812';
    g.lineWidth = 5;
    g.strokeRect(13, 37, W - 106, 82);
    signText(g, 'ROAD BLOCKED', (W - 80) / 2, 66, 38, '#1b1812', W - 130);
    signText(g, 'UNDER CONSTRUCTION!', (W - 80) / 2, 102, 22, '#1b1812', W - 130);
    // striped barricade boards on A-frames
    for (const x of [40, W - 132]) {
      g.strokeStyle = '#d8d4c8';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(x - 14, ground);
      g.lineTo(x, ground - 120);
      g.lineTo(x + 14, ground);
      g.stroke();
    }
    for (const y of [ground - 112, ground - 70]) {
      g.save();
      g.beginPath();
      g.rect(18, y, W - 134, 26);
      g.clip();
      g.fillStyle = '#f0ebe0';
      g.fillRect(18, y, W - 134, 26);
      g.fillStyle = '#b8291e';
      for (let x = 0; x < W; x += 36) {
        g.beginPath();
        g.moveTo(x, y + 26);
        g.lineTo(x + 18, y + 26);
        g.lineTo(x + 44, y);
        g.lineTo(x + 26, y);
        g.closePath();
        g.fill();
      }
      g.restore();
      g.strokeStyle = 'rgba(0,0,0,.35)';
      g.lineWidth = 2;
      g.strokeRect(18, y, W - 134, 26);
    }
    // cones
    for (const [x, sc] of [[W - 86, 1], [W - 50, .9], [W - 16, 1]]) {
      const h = 58 * sc, b = 22 * sc;
      g.fillStyle = '#1e1d1b';
      g.fillRect(x - b - 4, ground - 6, (b + 4) * 2, 6);
      g.fillStyle = '#e06a1e';
      g.beginPath();
      g.moveTo(x - b, ground - 6);
      g.lineTo(x - 4, ground - h);
      g.lineTo(x + 4, ground - h);
      g.lineTo(x + b, ground - 6);
      g.closePath();
      g.fill();
      g.fillStyle = '#efece2';
      g.fillRect(x - b * .62, ground - h * .55, b * 1.24, h * .14);
      g.fillRect(x - b * .36, ground - h * .82, b * .72, h * .1);
    }
  });
}

/** Where the two warning lamps sit on the road block, from its left edge and the ground. */
export const BLOCK_LAMPS = [[28, 270], [BLOCK_W - 103, 270]];
