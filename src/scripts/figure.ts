// Character-art figures (src/data/art/*.json): drawn as characters on a
// canvas, with part of the figure breaking into loose squares in the morung
// colours. Click (or tap) a figure and the characters around that point blow
// away like dust, then drift back and settle into place.
//
// Cheap by design, with two canvases stacked:
//   base  the characters and the squares that don't move, drawn once (a few
//         rows per frame: that is the scan-down intro, and no step is long
//         enough to block the page). A single cell is cleared or redrawn when
//         its character leaves as dust or flickers under the pointer.
//   fx    only what moves: drifting squares, dust in the air, the scan line,
//         flickering characters. Cleared and redrawn each frame it's needed.
// Nothing runs while a figure is still or off screen; its data is only
// fetched when it comes near the screen.
//
// Markup: <figure class="art" data-art="name" ...><div class="art-stage">
//           <canvas class="art-base"></canvas><canvas class="art-fx"></canvas></div></figure>
//   data-eager        draw straight away (the first screen)
//   data-drift        cells on the right for the scatter (default 8)
//   data-dissolve     where the scatter starts across the figure, 0..1 (default 0.74)
//   data-field        faint squares around the figure (default 40)
//   data-fray         edges that fray instead of cutting straight: "left top bottom"
//   data-alive        some loose squares drift gently while the figure is on screen

type Art = { cols: number; rows: string[] };
type Square = {
  x: number; y: number; s: number; color: string | null; a: number; row: number;
  ox: number; oy: number; ph: number; sp: number; amp: number; rise: number;
};
/** A character blown off the figure: where it lives, where it is, how it moves. */
type Mote = { i: number; level: number; hx: number; hy: number; x: number; y: number; vx: number; vy: number; back: number };

const LOADERS = import.meta.glob<Art>('../data/art/*.json', { import: 'default' });
const GLYPHS = ' .:-=+*#%@';           // index = level, 1 (dark) .. 9 (bright)
const SCRAMBLE = '01<>/\\{}[]*+=#%';
const CELL_ASPECT = 0.6;                // monospace character width / height
const ROWS_PER_FRAME = 4;
const MAX_MOVERS = 380;
const MORUNG = { red: '#c8202a', yellow: '#f2c230', green: '#2f8f4a' };

function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function drawFigure(el: HTMLElement, art: Art) {
  const base = el.querySelector<HTMLCanvasElement>('.art-base')!;
  const fx = el.querySelector<HTMLCanvasElement>('.art-fx')!;
  const bctx = base.getContext('2d')!;
  const ctx = fx.getContext('2d')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const alive = el.dataset.alive !== undefined && !reduced;
  const drift = Number(el.dataset.drift ?? 8);
  const dissolveAt = Number(el.dataset.dissolve ?? 0.74);
  const fieldCount = Number(el.dataset.field ?? 40);
  const fray = new Set((el.dataset.fray ?? '').split(/\s+/));
  const rand = rng(20261124 + art.rows.length);
  const { cols, rows: data } = art;
  const rowsN = data.length;

  // Decide once which cells are characters and which break off into squares.
  const grid = data.map(() => new Uint8Array(cols));
  const squares: Square[] = [];
  const square = (x: number, y: number, s: number, color: string | null, a: number, row: number, amp: number): Square =>
    ({ x, y, s, color, a, row, ox: 0, oy: 0, ph: rand() * Math.PI * 2, sp: 0.4 + rand() * 0.8, amp, rise: rand() < 0.12 ? 0.2 + rand() * 0.5 : 0 });
  const pick = () => {
    const r = rand();
    return r < 0.09 ? MORUNG.red : r < 0.12 ? MORUNG.yellow : r < 0.14 ? MORUNG.green : null;
  };
  for (let y = 0; y < rowsN; y++) {
    for (let x = 0; x < cols; x++) {
      const level = data[y].charCodeAt(x) - 48;
      if (level <= 0) continue;
      const nx = x / cols, ny = y / rowsN;
      const edge = Math.min(
        fray.has('left') ? clamp01(nx / 0.16) : 1,
        fray.has('top') ? clamp01(ny / 0.06) : 1,
        fray.has('bottom') ? clamp01((1 - ny) / 0.08) : 1,
      );
      if (rand() > Math.pow(edge, 0.8)) continue;
      const d = clamp01((nx - dissolveAt) / (1 - dissolveAt)) * 0.95 + (fray.has('bottom') ? 0 : clamp01((ny - 0.9) / 0.1) * 0.8);
      if (rand() < d * 0.62) squares.push(square(x + rand() * d * drift, y + (rand() - 0.5) * d * 5, 0.7 + rand() * 0.5, pick(), 0.25 + rand() * 0.5, y, 0.25 + d * 0.6));
      else grid[y][x] = level;
    }
  }
  for (let i = 0; i < fieldCount; i++) {
    const x = Math.round((cols * 0.2 + rand() * (cols * 0.8 + drift)) / 2) * 2;
    const y = Math.round((rand() * rowsN) / 2) * 2;
    squares.push(square(x, y, 0.9 + rand() * 0.6, rand() < 0.06 ? MORUNG.red : rand() < 0.03 ? MORUNG.yellow : null, 0.05 + rand() * 0.14, Math.min(rowsN - 1, y), 0.8));
  }
  // Only some squares move (drifting, or pushed by the pointer); the rest are
  // drawn on the base once. The moving ones are grouped by colour, so a frame
  // sets each colour once.
  const movers: Square[] = [];
  const stillByRow = new Map<number, Square[]>();
  const share = Math.min(1, MAX_MOVERS / Math.max(1, squares.length));
  for (const q of squares) {
    if ((alive && q.rise) || rand() < share) movers.push(q);
    else { const list = stillByRow.get(q.row) ?? []; list.push(q); stillByRow.set(q.row, list); }
  }
  movers.sort((a, b) => (a.color ?? '').localeCompare(b.color ?? ''));

  let cw = 0, ch = 0, dpr = 1, ink = '236 230 220', inkStyle = '', laidOut = 0;
  // Margin of the moving layer around the figure, in CSS pixels, so dust
  // blown off the figure stays visible: it never travels past this.
  let bx = 0, by = 0, fw = 0, fh = 0;
  let atlas: HTMLCanvasElement[] = [];
  let scramble: HTMLCanvasElement[] = [];
  let built = 0;
  const hot = new Map<number, number>();      // cell -> flicker until (ms)
  const pointer = { x: -1e4, y: -1e4, at: -1e4 };
  const motes: Mote[] = [];
  const away = new Set<number>();             // cells whose character is out as dust

  /** One cell's picture: a character, or, when cells are too small for a
   *  character to read, a halftone square sized by its brightness. */
  function glyphCanvas(text: string, alpha: number, level = 9) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(cw * dpr); c.height = Math.ceil(ch * dpr);
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    g.fillStyle = `rgb(${ink} / ${alpha})`;
    if (cw * dpr < 2.6) {
      const s = cw * (0.45 + (level / 9) * 0.55);
      g.fillRect((cw - s) / 2, (ch - s) / 2, s, s);
      return c;
    }
    g.font = `${ch * 0.92}px 'JetBrains Mono', ui-monospace, Consolas, monospace`;
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.fillText(text, cw / 2, ch / 2);
    return c;
  }

  function layout() {
    const w = base.clientWidth;
    if (!w) return false;
    laidOut = w;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = w / (cols + drift);
    ch = cw / CELL_ASPECT;
    fw = w; fh = rowsN * ch;
    bx = fw * 0.4; by = fh * 0.3;            // the same proportions as its CSS, so nothing moves
    base.width = Math.round(fw * dpr);
    base.height = Math.round(fh * dpr);
    fx.width = Math.round((fw + 2 * bx) * dpr);
    fx.height = Math.round((fh + 2 * by) * dpr);
    const css = getComputedStyle(document.documentElement);
    ink = css.getPropertyValue('--art').trim() || ink;
    inkStyle = `rgb(${ink})`;
    // On a light background, dark ink has to mark the shadows, like an
    // engraving; otherwise the figure looks like a photo negative.
    const invert = css.getPropertyValue('--art-invert').trim() === '1';
    atlas = [...GLYPHS].map((_, i) => {
      const j = invert && i > 0 ? 10 - i : i;
      return glyphCanvas(GLYPHS[j], 0.3 + (j / 9) * 0.7, j);
    });
    scramble = [...SCRAMBLE].map(g => glyphCanvas(g, 0.9));
    bctx.clearRect(0, 0, base.width, base.height);
    ctx.clearRect(0, 0, fx.width, fx.height);
    built = 0;
    motes.length = 0;
    away.clear();
    hot.clear();
    return true;
  }

  const px = (x: number) => Math.round(x * cw * dpr);
  const py = (y: number) => Math.round(y * ch * dpr);
  const cellW = () => Math.ceil(cw * dpr), cellH = () => Math.ceil(ch * dpr);
  const clearCell = (i: number) => { const x = i % cols, y = (i - x) / cols; bctx.clearRect(px(x), py(y), cellW(), cellH()); };
  const drawCell = (i: number) => {
    const x = i % cols, y = (i - x) / cols;
    bctx.clearRect(px(x), py(y), cellW(), cellH());
    if (grid[y][x]) bctx.drawImage(atlas[grid[y][x]], px(x), py(y));
  };

  function buildRows(count: number) {
    const end = Math.min(rowsN, built + count);
    for (let y = built; y < end; y++) {
      const row = grid[y];
      for (let x = 0; x < cols; x++) if (row[x]) bctx.drawImage(atlas[row[x]], px(x), py(y));
      for (const q of stillByRow.get(y) ?? []) {
        bctx.globalAlpha = q.color ? 0.9 : q.a;
        bctx.fillStyle = q.color ?? inkStyle;
        const s = q.s * cw * dpr;
        bctx.fillRect(Math.round(q.x * cw * dpr), Math.round(q.y * ch * dpr), s, s);
      }
      bctx.globalAlpha = 1;
    }
    built = end;
  }

  /** Blows the characters around a point (canvas CSS pixels) off as dust. */
  function burst(mx: number, my: number) {
    const now = performance.now();
    const R = Math.max(6, cols * 0.1) * cw;
    const y0 = Math.max(0, Math.floor((my - R) / ch)), y1 = Math.min(built - 1, Math.ceil((my + R) / ch));
    const x0 = Math.max(0, Math.floor((mx - R) / cw)), x1 = Math.min(cols - 1, Math.ceil((mx + R) / cw));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * cols + x;
        if (!grid[y][x] || away.has(i)) continue;
        const dx = (x + 0.5) * cw - mx, dy = (y + 0.5) * ch - my;
        const d = Math.hypot(dx, dy) / R;
        if (d > 0.75 + Math.random() * 0.35) continue;      // a ragged edge, not a perfect circle
        const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.1;
        const speed = (1.2 - Math.min(1, d)) * (200 + Math.random() * 420);
        motes.push({
          i, level: grid[y][x], hx: x * cw, hy: y * ch, x: x * cw, y: y * ch,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - Math.random() * 70,
          back: now + 600 + Math.random() * 700 + d * 300,
        });
        away.add(i);
        hot.delete(i);
        clearCell(i);
      }
    }
    pointer.x = mx; pointer.y = my; pointer.at = now;
    kick();
  }

  /** Moves the dust: out on the blast, slowing like dust in air; then home. */
  function stepDust(dt: number, now: number) {
    for (let k = motes.length - 1; k >= 0; k--) {
      const m = motes[k];
      if (now < m.back) {
        const drag = Math.exp(-2.8 * dt);
        m.vx = m.vx * drag + Math.sin(now * 0.0031 + m.i) * 40 * dt;
        m.vy = m.vy * drag + 26 * dt;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        // Held inside the moving layer: dust that reaches its edge slows and turns back.
        const x0 = -bx + 2, x1 = fw + bx - cw - 2, y0 = -by + 2, y1 = fh + by - ch - 2;
        if (m.x < x0) { m.x = x0; m.vx = Math.abs(m.vx) * 0.3; }
        if (m.x > x1) { m.x = x1; m.vx = -Math.abs(m.vx) * 0.3; }
        if (m.y < y0) { m.y = y0; m.vy = Math.abs(m.vy) * 0.3; }
        if (m.y > y1) { m.y = y1; m.vy = -Math.abs(m.vy) * 0.3; }
      } else {
        const ease = 1 - Math.exp(-5.5 * dt);
        m.x += (m.hx - m.x) * ease;
        m.y += (m.hy - m.y) * ease;
        if (Math.abs(m.hx - m.x) + Math.abs(m.hy - m.y) < 0.6) {
          motes.splice(k, 1);
          away.delete(m.i);
          drawCell(m.i);                                    // settled: back on the base
        }
      }
    }
  }

  /** The moving layer. Returns whether anything is still moving. */
  function frame(now: number) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, fx.width, fx.height);
    // Draw in the figure's own coordinates; the margin is outside them.
    ctx.setTransform(1, 0, 0, 1, Math.round(bx * dpr), Math.round(by * dpr));
    let busy = built < rowsN;
    const glyph = () => scramble[(Math.random() * scramble.length) | 0];

    if (busy) {
      for (let y = built; y < Math.min(rowsN, built + 2); y++) {
        for (let x = 0; x < cols; x++) if (grid[y][x] && Math.random() < 0.6) ctx.drawImage(glyph(), px(x), py(y));
      }
    }
    for (const [i, until] of hot) {
      if (until < now) { hot.delete(i); if (!away.has(i)) drawCell(i); continue; }
      const x = i % cols, y = (i - x) / cols;
      ctx.drawImage(glyph(), px(x), py(y));
      busy = true;
    }
    if (motes.length) {
      busy = true;
      ctx.fillStyle = inkStyle;
      for (const m of motes) {
        const far = Math.hypot(m.x - m.hx, m.y - m.hy);
        if (far < cw * 1.5) {
          ctx.globalAlpha = 1;
          ctx.drawImage(atlas[m.level], Math.round(m.x * dpr), Math.round(m.y * dpr));
        } else {
          // In the air it's a speck, sized and shaded by the character it came from.
          const s = Math.max(1.5, cw * (0.4 + m.level * 0.05) * dpr);
          ctx.globalAlpha = Math.min(1, 0.45 + m.level * 0.06);
          ctx.fillRect(Math.round((m.x + cw / 2) * dpr), Math.round((m.y + ch / 2) * dpr), s, s);
        }
      }
      ctx.globalAlpha = 1;
    }

    const pointerOn = now - pointer.at < 600;
    const t = now / 1000;
    let style = '';
    for (const q of movers) {
      if (q.row >= built) continue;
      let dxf = 0, dyf = 0, fade = 1;
      if (alive) {
        dxf = Math.sin(t * q.sp + q.ph) * q.amp;
        dyf = Math.cos(t * q.sp * 0.8 + q.ph) * q.amp * 0.6;
        if (q.rise) {
          const k = (t * q.rise * 0.25 + q.ph / 6.283) % 1;
          dyf -= k * 10;
          fade = Math.sin(k * Math.PI);
        }
      }
      const cx = (q.x + dxf + 0.5) * cw, cy = (q.y + dyf + 0.5) * ch;
      const dx = cx - pointer.x, dy = cy - pointer.y, dist = Math.hypot(dx, dy), R = cw * 10;
      const push = pointerOn && dist < R ? (1 - dist / R) * cw * 3 : 0;
      const tx = push ? (dx / (dist || 1)) * push : 0, ty = push ? (dy / (dist || 1)) * push : 0;
      q.ox += (tx - q.ox) * 0.18; q.oy += (ty - q.oy) * 0.18;
      if (Math.abs(q.ox - tx) + Math.abs(q.oy - ty) > 0.05) busy = true;
      ctx.globalAlpha = (q.color ? 0.9 : q.a) * fade;
      const want = q.color ?? inkStyle;
      if (want !== style) { ctx.fillStyle = want; style = want; }
      const s = q.s * cw * dpr;
      ctx.fillRect(Math.round((cx - cw / 2 + q.ox) * dpr), Math.round((cy - ch / 2 + q.oy) * dpr), s, s);
    }
    ctx.globalAlpha = 1;
    return busy || pointerOn || alive;
  }

  // Once started, the drawing finishes even if the figure scrolls away (about
  // half a second); the drift, dust and pointer effects only run while it's
  // seen. The idle drift runs at about 24 frames a second, plenty for it.
  let raf = 0, visible = true, last = 0, prev = 0;
  function loop(now: number) {
    raf = 0;
    const building = built < rowsN;
    if (building) buildRows(ROWS_PER_FRAME);
    const idle = !building && !motes.length && !hot.size && now - pointer.at > 600;
    if (idle && alive && visible && now - last < 40) { raf = requestAnimationFrame(loop); return; }
    const dt = Math.min(0.05, (now - (prev || now)) / 1000);
    prev = last = now;
    if (motes.length) stepDust(dt, now);
    if (frame(now) && (visible || building)) raf = requestAnimationFrame(loop);
    else prev = 0;
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
  function render() {
    if (!layout()) return;
    if (reduced) { buildRows(rowsN); frame(performance.now()); } else kick();
  }

  // Positions: the pointer is measured against the base canvas.
  const local = (e: MouseEvent) => { const r = base.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };

  render();
  // Redraw on a real resize only: setting the canvas's pixel size can nudge its
  // displayed width by a pixel, which must not restart the drawing.
  new ResizeObserver(() => { if (Math.abs(base.clientWidth - laidOut) > 1) render(); }).observe(base);
  document.addEventListener('themechange', render);
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', render);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }).observe(base);
  if (!document.fonts.check(`12px 'JetBrains Mono'`)) document.fonts.load(`12px 'JetBrains Mono'`).then(render);

  if (!reduced) {
    el.querySelector('.art-stage')!.addEventListener('click', e => burst(...local(e as MouseEvent)));
  }
  if (!reduced && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const zone = el.closest<HTMLElement>('[data-art-zone]') ?? el;
    zone.addEventListener('pointermove', e => {
      [pointer.x, pointer.y] = local(e);
      pointer.at = performance.now();
      const cx = Math.floor(pointer.x / cw), cy = Math.floor(pointer.y / ch);
      for (let y = Math.max(0, cy - 3); y <= Math.min(Math.min(rowsN, built) - 1, cy + 3); y++) {
        for (let x = Math.max(0, cx - 5); x <= Math.min(cols - 1, cx + 5); x++) {
          const i = y * cols + x;
          if (grid[y][x] && !away.has(i) && !hot.has(i) && Math.random() < 0.3) {
            hot.set(i, pointer.at + 120 + Math.random() * 260);
            clearCell(i);
          }
        }
      }
      kick();
    });
  }
}

/** Fetches a figure's data and draws it. */
async function mount(el: HTMLElement) {
  const load = LOADERS[`../data/art/${el.dataset.art}.json`];
  if (load) drawFigure(el, await load());
}

/** Draws every figure on the page: eager ones now, the rest as they come near. */
export function mountFigures() {
  const near = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { near.unobserve(e.target); mount(e.target as HTMLElement); }
  }, { rootMargin: '300px 0px' });
  for (const el of document.querySelectorAll<HTMLElement>('figure.art[data-art]')) {
    if (el.dataset.eager !== undefined) mount(el);
    else near.observe(el);
  }
}
