// The woven morung band: the pattern drawn as square threads, straight like a
// strip of cloth, but worn: its long edges are eaten away unevenly with the
// odd tear and a few holes, loose fibres stick out along them and stir, and
// at both frayed ends threads keep coming loose and drifting off. When it
// scrolls into view, particles gather from everywhere (some from far beyond
// its ends) and settle into the cloth over about three seconds. A click blows
// threads off as dust that then settles back into place.
//
// Cheap by design, with two canvases stacked:
//   base  the cloth, drawn once. Single threads are cleared when they blow
//         away and redrawn when they settle.
//   fx    only what moves: the gathering, the fibres, the drifting threads,
//         dust. Redrawn about 20 times a second, only while on screen.
// Without JavaScript the band keeps its CSS background, the vector version of
// the same pattern.
import { WEAVE, weaveColor } from '../data/morung.js';

type Mote = { col: number; row: number; color: string; x: number; y: number; vx: number; vy: number; back: number };
/** A fibre sticking out of a worn edge: it stirs around where it is. */
type Fibre = { x: number; y: number; color: string; a: number; s: number; ph: number; sp: number; amp: number };
/** A thread drifting off a frayed end: born at the end, drifts out, fades, starts again. */
type Drifter = { x0: number; y0: number; dir: number; color: string; s: number; life: number; age: number; vy: number; ph: number };
/** A piece of the cloth on its way in: a small block of threads, from where it starts to where it belongs. */
type Piece = { sx: number; sy: number; size: number; x0: number; y0: number; tx: number; ty: number; delay: number; dur: number; wob: number };

const BLOCK = 2;                   // threads per side of a gathering piece

const PALETTE = Object.values(WEAVE.colors);

function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

function weave(band: HTMLElement) {
  const base = band.querySelector<HTMLCanvasElement>('.wv-base')!;
  const fx = band.querySelector<HTMLCanvasElement>('.wv-fx')!;
  const bctx = base.getContext('2d')!;
  const ctx = fx.getContext('2d')!;
  const flat = document.createElement('canvas');
  const fctx = flat.getContext('2d')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const offset = Number(band.dataset.offset ?? 0);
  const now = () => performance.now();

  // A cell is a whole number of device pixels (csPx), so threads stay crisp;
  // cs is the same in CSS pixels. The cloth fills ~70% of the element's
  // height; the fibres and drifting threads use the rest.
  let W = 0, H = 0, dpr = 1, csPx = 0, cs = 0, cols = 0, top = 0, gap = 0, endCols = 0;
  // Margin of the moving layer above and below the strip, in CSS pixels, so
  // dust and gathering threads stay visible outside it.
  let by = 0;
  let present = new Uint8Array(0);   // threads still in the cloth
  let fibres: Fibre[] = [];
  let drifters: Drifter[] = [];
  let pieces: Piece[] = [];
  let introEnd = 0;                  // ms the gathering takes, from the first piece to the last
  const motes: Mote[] = [];
  const away = new Set<number>();
  let start = 0, raf = 0, visible = false, last = 0, prev = 0, seen = false, woven = false;
  const pointer = { x: -1e4, y: -1e4, at: -1e4 };

  function layout() {
    W = band.clientWidth; H = band.clientHeight;
    if (!W || !H) return false;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    csPx = Math.max(3, Math.floor((H * 0.7 * dpr) / WEAVE.rows));
    cs = csPx / dpr;
    gap = csPx >= 6 ? 1 : 0;
    cols = Math.ceil(W / cs) + 1;
    endCols = Math.round(cols * 0.09);
    top = Math.round(((H - WEAVE.rows * cs) / 2) * dpr) / dpr;
    by = H * 1.2;                            // the same proportion as its CSS, so nothing moves
    base.width = fx.width = flat.width = Math.round(W * dpr);
    base.height = flat.height = Math.round(H * dpr);
    fx.height = Math.round((H + 2 * by) * dpr);

    const rand = rng(77 + offset);
    // How far each long edge is worn away, column by column: a slow, uneven
    // wear (two waves with random phases) plus the odd short tear.
    const p1 = rand() * 6.28, p2 = rand() * 6.28, p3 = rand() * 6.28, p4 = rand() * 6.28;
    const wear = (c: number, a: number, b: number) =>
      Math.max(0, 1.7 + Math.sin(c * 0.06 + a) * 1.3 + Math.sin(c * 0.21 + b) * 0.9 + (rand() - 0.5) * 1.6);
    const topWear = new Float32Array(cols), botWear = new Float32Array(cols);
    for (let c = 0; c < cols; c++) { topWear[c] = wear(c, p1, p2); botWear[c] = wear(c, p3, p4); }
    for (let t = 0; t < cols / 32; t++) {
      const at = Math.floor(rand() * cols), len = 2 + Math.floor(rand() * 6), deep = 3 + rand() * 4;
      const edge = rand() < 0.5 ? topWear : botWear;
      for (let c = at; c < Math.min(cols, at + len); c++) edge[c] = Math.max(edge[c], deep * (1 - Math.abs(c - at - len / 2) / len));
    }

    present = new Uint8Array(cols * WEAVE.rows);
    fibres = [];
    fctx.clearRect(0, 0, flat.width, flat.height);
    for (let x = 0; x < cols; x++) {
      const endness = Math.max(0, 1 - Math.min(x, cols - 1 - x) / endCols);   // 0 in the body, 1 at the very end
      const tw = Math.floor(topWear[x]), bw = Math.floor(botWear[x]);
      for (let y = 0; y < WEAVE.rows; y++) {
        // Ends: threads drop out more and more towards the very end.
        if (endness > 0 && rand() < endness * endness * 0.95) continue;
        // Long edges: worn away down to this column's depth; the thread at the
        // worn line is sometimes a loose fibre sticking out instead.
        const fromTop = y, fromBottom = WEAVE.rows - 1 - y;
        if (fromTop < tw || fromBottom < bw) continue;
        const color = weaveColor(x + offset, y);
        if ((fromTop === tw || fromBottom === bw) && rand() < 0.45) {
          const out = fromTop === tw ? -1 : 1;
          fibres.push({ x: x * cs, y: top + (y + out * (0.4 + rand() * 0.9)) * cs, color, a: 0.55 + rand() * 0.4, s: cs * (0.45 + rand() * 0.4), ph: rand() * 6.28, sp: 0.6 + rand() * 1.2, amp: cs * (0.2 + rand() * 0.5) });
          continue;
        }
        // A few small holes, and a little fading where the cloth is worn.
        if (rand() < 0.006) continue;
        const nearEdge = Math.min(fromTop - tw, fromBottom - bw);
        fctx.globalAlpha = nearEdge === 0 ? 0.72 + rand() * 0.2 : nearEdge === 1 ? 0.9 : 1;
        fctx.fillStyle = color;
        fctx.fillRect(x * csPx, Math.round(top * dpr) + y * csPx, csPx - gap, csPx - gap);
        present[y * cols + x] = 1;
      }
    }
    fctx.globalAlpha = 1;
    fibres.sort((a, b) => a.color.localeCompare(b.color));   // set each colour once a frame

    // The gathering: the cloth cut into small blocks, each starting somewhere
    // scattered (a third of them far beyond the ends) and flying home, the
    // middle first and the ends last.
    const alpha = fctx.getImageData(0, 0, flat.width, flat.height).data;
    const filled = (px: number, py: number) => px >= 0 && py >= 0 && px < flat.width && py < flat.height && alpha[(py * flat.width + px) * 4 + 3] > 0;
    pieces = [];
    introEnd = 0;
    const size = BLOCK * csPx, topPx = Math.round(top * dpr);
    for (let by = -4; by < WEAVE.rows + 4; by += BLOCK) {
      for (let bx = 0; bx < cols; bx += BLOCK) {
        const sx = bx * csPx, sy = topPx + by * csPx;
        let any = false;
        for (let k = 0; k < BLOCK * BLOCK && !any; k++) any = filled(sx + (k % BLOCK) * csPx + (csPx >> 1), sy + Math.floor(k / BLOCK) * csPx + (csPx >> 1));
        if (!any) continue;
        const tx = sx / dpr, ty = sy / dpr;
        const far = rand() < 0.33;
        const x0 = far ? (rand() < 0.5 ? -rand() * W * 0.35 : W + rand() * W * 0.35) : tx + (rand() - 0.5) * W * 0.7;
        const y0 = ty + (rand() - 0.5) * H * (far ? 2 : 3.2);
        const delay = (Math.abs(tx - W / 2) / W) * 900 + rand() * 900;
        const dur = 1300 + rand() * 900;
        introEnd = Math.max(introEnd, delay + dur);
        pieces.push({ sx, sy, size, x0, y0, tx, ty, delay, dur, wob: (rand() - 0.5) * H * 0.7 });
      }
    }

    // Threads that keep coming loose from the frayed ends and drift off.
    drifters = [];
    const n = Math.round(Math.min(90, W / 18));
    for (let i = 0; i < n; i++) drifters.push(spawn(rand, rand() < 0.5 ? -1 : 1, rand()));
    motes.length = 0;
    away.clear();
    bctx.clearRect(0, 0, base.width, base.height);
    if (woven) bctx.drawImage(flat, 0, 0);
    return true;
  }

  /** A new drifting thread at one end (dir -1 left, 1 right). age: 0..1 of its life. */
  function spawn(rand: () => number, dir: number, age = 0): Drifter {
    const inEnd = rand() * endCols * cs * 1.1;
    return {
      x0: dir < 0 ? inEnd : W - inEnd, y0: top + rand() * WEAVE.rows * cs, dir,
      color: PALETTE[Math.floor(rand() * PALETTE.length)], s: cs * (0.5 + rand() * 0.5),
      life: 3 + rand() * 4, age: age * 7, vy: (rand() - 0.5) * cs * 0.8, ph: rand() * 6.28,
    };
  }

  /** The gathering, at a moment (ms since it began): each piece eases home
   *  along a gentle curve, fading in as it comes. */
  function gather(g: CanvasRenderingContext2D, elapsed: number) {
    for (const p of pieces) {
      const k = Math.min(1, Math.max(0, (elapsed - p.delay) / p.dur));
      if (k <= 0) continue;
      const e = 1 - Math.pow(1 - k, 3);
      const bend = Math.sin(e * Math.PI);
      const x = p.x0 + (p.tx - p.x0) * e + bend * p.wob * 0.3;
      const y = p.y0 + (p.ty - p.y0) * e + bend * p.wob;
      g.globalAlpha = Math.min(1, k * 2.5);
      g.drawImage(flat, p.sx, p.sy, p.size, p.size, Math.round(x * dpr), Math.round(y * dpr), p.size, p.size);
    }
    g.globalAlpha = 1;
  }

  const cellY = (r: number) => top + r * cs;
  const clearThread = (c: number, r: number) => bctx.clearRect(c * csPx, Math.round(cellY(r) * dpr), csPx, csPx);
  const drawThread = (c: number, r: number) => {
    clearThread(c, r);
    bctx.drawImage(flat, c * csPx, Math.round(cellY(r) * dpr), csPx, csPx, c * csPx, Math.round(cellY(r) * dpr), csPx, csPx);
  };

  /** Blows the threads around a point (CSS pixels) off as dust. */
  function burst(mx: number, my: number) {
    if (!woven) return;
    const n = now(), R = cs * 9;
    const c0 = Math.max(0, Math.floor((mx - R) / cs)), c1 = Math.min(cols - 1, Math.ceil((mx + R) / cs));
    for (let c = c0; c <= c1; c++) {
      for (let r = 0; r < WEAVE.rows; r++) {
        const i = r * cols + c;
        if (!present[i] || away.has(i)) continue;
        const x = c * cs, y = cellY(r);
        const d = Math.hypot(x + cs / 2 - mx, y + cs / 2 - my) / R;
        if (d > 0.7 + Math.random() * 0.4) continue;       // a ragged edge, not a perfect circle
        const angle = Math.atan2(y - my, x - mx) + (Math.random() - 0.5) * 1.2;
        const speed = (1.2 - Math.min(1, d)) * (160 + Math.random() * 360);
        motes.push({
          col: c, row: r, color: weaveColor(c + offset, r), x, y,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - Math.random() * 60,
          back: n + 650 + Math.random() * 700 + d * 300,
        });
        away.add(i);
        clearThread(c, r);
      }
    }
    pointer.x = mx; pointer.y = my; pointer.at = n;
    kick();
  }

  /** Moves the dust and the drifting threads. */
  function step(dt: number, n: number) {
    for (let k = motes.length - 1; k >= 0; k--) {
      const m = motes[k];
      if (n < m.back) {
        const drag = Math.exp(-2.8 * dt);
        m.vx = m.vx * drag + Math.sin(n * 0.0031 + m.col) * 40 * dt;
        m.vy = m.vy * drag + 26 * dt;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        // Held inside the moving layer: dust that reaches its edge slows and turns back.
        const y0 = -by + 2, y1 = H + by - cs - 2;
        if (m.y < y0) { m.y = y0; m.vy = Math.abs(m.vy) * 0.3; }
        if (m.y > y1) { m.y = y1; m.vy = -Math.abs(m.vy) * 0.3; }
        if (m.x < 0) { m.x = 0; m.vx = Math.abs(m.vx) * 0.3; }
        if (m.x > W - cs) { m.x = W - cs; m.vx = -Math.abs(m.vx) * 0.3; }
      } else {
        const hx = m.col * cs, hy = cellY(m.row);
        const ease = 1 - Math.exp(-5.5 * dt);
        m.x += (hx - m.x) * ease;
        m.y += (hy - m.y) * ease;
        if (Math.abs(hx - m.x) + Math.abs(hy - m.y) < 0.6) {
          motes.splice(k, 1);
          away.delete(m.row * cols + m.col);
          drawThread(m.col, m.row);                          // settled: back in the cloth
        }
      }
    }
    for (let i = 0; i < drifters.length; i++) {
      const d = drifters[i];
      d.age += dt;
      if (d.age > d.life) drifters[i] = spawn(Math.random, d.dir);
    }
  }

  /** The moving layer. */
  function frame(n: number) {
    const t = reduced ? 0 : n / 1000;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, fx.width, fx.height);
    // Draw in the strip's own coordinates; the margin is above and below them.
    ctx.setTransform(1, 0, 0, 1, 0, Math.round(by * dpr));
    let shown = 1;
    if (!woven) {
      const elapsed = seen ? n - start : 0;
      if (elapsed >= introEnd || reduced) {
        woven = true;
        bctx.drawImage(flat, 0, 0);
      } else {
        gather(ctx, elapsed);
        // Fibres and drifting threads arrive with the last of the cloth.
        shown = Math.min(1, Math.max(0, (elapsed - introEnd * 0.6) / (introEnd * 0.4)));
      }
    }

    // Dust in the air.
    if (motes.length) {
      const s = csPx - gap;
      for (const m of motes) {
        ctx.fillStyle = m.color;
        ctx.fillRect(Math.round(m.x * dpr), Math.round(m.y * dpr), s, s);
      }
    }

    // Fibres along the worn edges stir; the pointer pushes them aside.
    const pointerOn = n - pointer.at < 600;
    const push = (x: number, y: number, R: number, f: number) => {
      if (!pointerOn) return [x, y];
      const dx = x - pointer.x, dy = y - pointer.y, d = Math.hypot(dx, dy);
      if (d >= R) return [x, y];
      const p = (1 - d / R) * f;
      return [x + (dx / (d || 1)) * p, y + (dy / (d || 1)) * p];
    };
    let style = '';
    for (const q of fibres) {
      const [x, y] = push(q.x + Math.sin(t * q.sp + q.ph) * q.amp, q.y + Math.cos(t * q.sp * 1.3 + q.ph) * q.amp, cs * 10, cs * 3);
      ctx.globalAlpha = q.a * shown;
      if (q.color !== style) { ctx.fillStyle = q.color; style = q.color; }
      const s = Math.max(1, Math.round(q.s * dpr));
      ctx.fillRect(Math.round(x * dpr), Math.round(y * dpr), s, s);
    }

    // Threads drifting off the frayed ends: out and away, swaying, fading.
    for (const d of drifters) {
      const k = d.age / d.life;
      const dist = k * cs * 22;
      const x0 = d.x0 + d.dir * dist + Math.sin(t * 1.3 + d.ph) * cs * 0.8;
      const y0 = d.y0 + d.vy * d.age + Math.sin(t * 0.9 + d.ph) * cs * 1.2;
      const [x, y] = push(x0, y0, cs * 12, cs * 4);
      ctx.globalAlpha = Math.sin(k * Math.PI) * 0.85 * shown;
      if (d.color !== style) { ctx.fillStyle = d.color; style = d.color; }
      const s = Math.max(1, Math.round(d.s * dpr));
      ctx.fillRect(Math.round(x * dpr), Math.round(y * dpr), s, s);
    }
    ctx.globalAlpha = 1;
    return !reduced;
  }

  function loop(n: number) {
    raf = 0;
    if (!visible) { prev = 0; return; }
    const busy = motes.length > 0 || n - pointer.at < 600 || !woven;
    if (!busy && n - last < 48) { raf = requestAnimationFrame(loop); return; }   // ~20 fps when calm
    const dt = Math.min(0.06, (n - (prev || n)) / 1000);
    prev = last = n;
    step(dt, n);
    if (frame(n)) raf = requestAnimationFrame(loop);
  }
  const kick = () => { if (!raf && visible) raf = requestAnimationFrame(loop); };

  function render() {
    if (!layout()) return;
    band.classList.add('drawn');
    if (reduced) { woven = true; bctx.clearRect(0, 0, base.width, base.height); bctx.drawImage(flat, 0, 0); frame(now()); } else kick();
  }

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !seen) { seen = true; start = now(); }
    kick();
  }, { threshold: 0.2 }).observe(band);
  let laidOut = 0;
  new ResizeObserver(() => {
    if (Math.abs(band.clientWidth - laidOut) > 1) { laidOut = band.clientWidth; render(); }
  }).observe(band);

  if (!reduced) {
    band.addEventListener('click', e => {
      const r = base.getBoundingClientRect();
      burst(e.clientX - r.left, e.clientY - r.top);
    });
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      band.addEventListener('pointermove', e => {
        const r = base.getBoundingClientRect();
        pointer.x = e.clientX - r.left;
        pointer.y = e.clientY - r.top;
        pointer.at = now();
        kick();
      });
    }
  }
}

export function mountWeaves() {
  for (const band of document.querySelectorAll<HTMLElement>('.weave')) weave(band);
}
