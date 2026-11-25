// The live preview in Selected work: a window that plays a recording of the
// real system for the project being read. Switching projects turns the
// playing frame into dust, and the dust flies into the next project's frame
// before its recording starts. The very first time, the dust gathers into the
// project's artifact (a character-art figure: warrior, hornbill, shield,
// basket, dao) and holds a moment first.
//
// Cheap by design: one recording plays at a time, each loads only when it is
// first shown, and it pauses whenever the window is off screen. The dust is
// about 1,800 grains on one canvas, only during a switch. With reduced motion
// there is no dust and nothing plays by itself: the poster shows, with
// controls to play it.

type Art = { cols: number; rows: string[] };
/** One grain: a pixel of the next frame. a = its point in the artifact, b = its place in the frame,
 *  x/y = where it starts, px/py = where it was last drawn, c0 = its colour in the frame it left. */
type Grain = { ax: number; ay: number; bx: number; by: number; x: number; y: number; px: number; py: number; color: string; size: number; delay: number };
export type Clip = { id: string; src: string; poster: string; at: number; artifact: string };

const LOADERS = import.meta.glob<Art>('../data/art/*.json', { import: 'default' });
const GRAINS = 1800;
const MORUNG = ['#c8202a', '#f2c230', '#2f8f4a'];

/** Timelines, in ms: the first reveal (out of the artifact) and a switch. */
const FIRST = { gather: 900, hold: 600, flow: 1000, spread: 450 };
const SWITCH = { gather: 0, hold: 0, flow: 750, spread: 300 };

async function artifactPoints(name: string) {
  const art = await LOADERS[`../data/art/${name}.json`]?.();
  if (!art) return null;
  const pts: [number, number][] = [];
  art.rows.forEach((row, y) => [...row].forEach((c, x) => {
    const v = c.charCodeAt(0) - 48;
    for (let k = 0; k < (v > 5 ? 2 : v > 0 ? 1 : 0); k++) pts.push([(x + 0.5) / art.cols, (y + 0.5) / art.rows.length]);
  }));
  return { pts, cols: art.cols, rows: art.rows.length };
}

/** Colours of an image or video frame on a grid, one per grain. */
function sample(src: CanvasImageSource, n: number, aspect: number) {
  const cols = Math.round(Math.sqrt(n * aspect)), rows = Math.round(n / cols);
  const c = document.createElement('canvas');
  c.width = cols; c.height = rows;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  try { g.drawImage(src, 0, 0, cols, rows); } catch { /* not ready: grains stay dark */ }
  const d = g.getImageData(0, 0, cols, rows).data;
  const out: { x: number; y: number; color: string }[] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = (y * cols + x) * 4;
    out.push({ x: (x + 0.5) / cols, y: (y + 0.5) / rows, color: `rgb(${d[i]},${d[i + 1]},${d[i + 2]})` });
  }
  return out;
}

const loadImage = (src: string) => new Promise<HTMLImageElement>(ok => {
  const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = () => ok(i); i.src = src;
});

export function mountPreview(screen: HTMLElement, clips: Clip[]) {
  const canvas = screen.querySelector('canvas')!;
  const ctx = canvas.getContext('2d')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const videos = new Map<string, HTMLVideoElement>();
  let W = 0, H = 0, dpr = 1, raf = 0, visible = false, first = true, prev = 0;
  let current: string | null = null;
  let grains: Grain[] = [];
  let leaving: { x: number; y: number; vx: number; vy: number; color: string; size: number }[] = [];
  let arrival: { t0: number; T: typeof FIRST; clip: Clip } | null = null;
  let leaveT0 = 0;
  const pointer = { x: -1e4, y: -1e4, at: -1e4 };
  const ink = () => `rgb(${getComputedStyle(document.documentElement).getPropertyValue('--art').trim() || '236 230 220'})`;
  let inkColor = ink();

  function size() {
    W = screen.clientWidth; H = screen.clientHeight;
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }

  /** The recording's <video>, made the first time it's needed. */
  function videoFor(clip: Clip) {
    let v = videos.get(clip.id);
    if (v) return v;
    v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
    v.poster = clip.poster; v.src = clip.src;
    v.setAttribute('aria-hidden', 'true');
    v.tabIndex = -1;
    if (reduced) { v.controls = true; v.removeAttribute('aria-hidden'); v.tabIndex = 0; v.setAttribute('aria-label', 'Recording of the project'); }
    screen.insertBefore(v, canvas);
    v.addEventListener('loadedmetadata', () => { if (v!.currentTime < clip.at) v!.currentTime = clip.at; }, { once: true });
    videos.set(clip.id, v);
    return v;
  }

  function play(id: string) {
    for (const [vid, v] of videos) {
      const on = vid === id;
      v.classList.toggle('on', on);
      if (on && visible && !reduced) v.play().catch(() => {});
      else v.pause();
    }
  }

  async function show(id: string) {
    const clip = clips.find(c => c.id === id);
    if (!clip || id === current) return;
    const from = current ? videos.get(current) : null;
    current = id;
    const v = videoFor(clip);
    if (reduced) { play(id); return; }
    size();
    inkColor = ink();

    // The playing frame breaks into dust.
    if (from && from.readyState >= 2) {
      leaving = sample(from, 900, W / H).map(o => {
        const a = Math.atan2(o.y * H - H / 2, o.x * W - W / 2) + (Math.random() - 0.5) * 1.6;
        const s = 220 + Math.random() * 520;
        return { x: o.x * W, y: o.y * H, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, color: o.color, size: 2 + Math.random() * 1.6 };
      });
      leaveT0 = performance.now();
    }
    for (const x of videos.values()) x.classList.remove('on');
    screen.classList.remove('landed');

    // The next frame, from its poster (the recording starts on that frame).
    const img = await loadImage(clip.poster);
    if (current !== id) return;
    const T = first ? FIRST : SWITCH;
    const art = first ? await artifactPoints(clip.artifact) : null;
    if (current !== id) return;
    first = false;
    let box = { x: W * 0.3, y: H * 0.1, w: W * 0.4, h: H * 0.8 };
    if (art) {
      const h = H * 0.84, w = Math.min(W * 0.7, h * (art.cols * 0.6) / art.rows);
      box = { x: (W - w) / 2, y: (H - w * art.rows / (art.cols * 0.6)) / 2, w, h: w * art.rows / (art.cols * 0.6) };
    }
    grains = sample(img, GRAINS, W / H).map((o, i) => {
      const [fx, fy] = art?.pts.length ? art.pts[(i * 7919) % art.pts.length] : [Math.random(), Math.random()];
      const ang = Math.random() * Math.PI * 2, r = (0.3 + Math.random() * 0.7) * Math.max(W, H) * (art ? 1 : 0.6);
      return {
        ax: box.x + fx * box.w, ay: box.y + fy * box.h, bx: o.x * W, by: o.y * H,
        x: W / 2 + Math.cos(ang) * r, y: H / 2 + Math.sin(ang) * r, px: 0, py: 0,
        color: o.color, size: 1.7 + Math.random() * 1.4,
        delay: (o.y * 0.6 + o.x * 0.25 + Math.random() * 0.15) * T.spread,
      };
    });
    // A switch starts its grains where the old frame's dust is.
    if (!art) grains.forEach((g, i) => { const l = leaving[i % Math.max(1, leaving.length)]; if (l) { g.x = l.x; g.y = l.y; } });
    arrival = { t0: performance.now(), T, clip };
    kick();
  }

  const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
  function frame(now: number) {
    raf = 0;
    const dt = Math.min(0.05, (now - (prev || now)) / 1000); prev = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    let busy = false;

    // The old frame's dust blowing away.
    if (leaving.length) {
      const fade = Math.max(0, 1 - (now - leaveT0) / 600);
      ctx.globalAlpha = fade;
      for (const g of leaving) {
        g.vx *= Math.exp(-2.4 * dt); g.vy = g.vy * Math.exp(-2.4 * dt) + 40 * dt;
        g.x += g.vx * dt; g.y += g.vy * dt;
        ctx.fillStyle = g.color; ctx.fillRect(g.x, g.y, g.size, g.size);
      }
      ctx.globalAlpha = 1;
      if (fade <= 0) leaving = []; else busy = true;
    }

    if (arrival) {
      const { T, clip } = arrival, t = now - arrival.t0;
      const pointerOn = now - pointer.at < 500;
      for (const g of grains) {
        let x: number, y: number, col = g.color, a = 1;
        if (t < T.gather + T.hold) {
          const k = ease(t / T.gather);
          x = g.x + (g.ax - g.x) * k; y = g.y + (g.ay - g.y) * k;
          if (t > T.gather) { x += Math.sin(now / 300 + g.bx) * 0.6; y += Math.cos(now / 340 + g.by) * 0.6; }
          col = inkColor; a = 0.25 + 0.75 * k;
        } else {
          const k = ease((t - T.gather - T.hold - g.delay) / T.flow);
          const sx = T.gather ? g.ax : g.x, sy = T.gather ? g.ay : g.y;
          const bend = Math.sin(k * Math.PI) * (T.gather ? 30 : 18);
          x = sx + (g.bx - sx) * k + bend * (g.by > H / 2 ? 1 : -1) * 0.3;
          y = sy + (g.by - sy) * k - bend;
          if (T.gather && k < 0.5) col = inkColor;
          a = T.gather ? 1 : Math.min(1, 0.35 + k);
        }
        if (pointerOn) {
          const dx = x - pointer.x, dy = y - pointer.y, d = Math.hypot(dx, dy);
          if (d < 60) { x += dx / (d || 1) * (60 - d) * 0.4; y += dy / (d || 1) * (60 - d) * 0.4; }
        }
        g.px = x; g.py = y;
        ctx.globalAlpha = a;
        ctx.fillStyle = col; ctx.fillRect(x, y, g.size, g.size);
      }
      // Morung-coloured motes rising off the artifact while it holds.
      if (T.gather && t > T.gather * 0.6 && t < T.gather + T.hold + T.flow * 0.5) {
        for (let i = 0; i < 30; i++) {
          const g = grains[(i * 131) % grains.length];
          ctx.globalAlpha = 0.8;
          ctx.fillStyle = MORUNG[i % 3];
          ctx.fillRect(g.ax + Math.sin(now / 500 + i) * 14, g.ay - ((now / 30 + i * 17) % 40), 3, 3);
        }
      }
      ctx.globalAlpha = 1;
      const land = T.gather + T.hold + T.flow + T.spread;
      if (t > land - 200 && !screen.classList.contains('landed')) { screen.classList.add('landed'); play(clip.id); }
      if (t > land + 250) { arrival = null; ctx.clearRect(0, 0, W, H); }
      else busy = true;
    }
    if (busy && visible) raf = requestAnimationFrame(frame);
    else prev = 0;
  }
  const kick = () => { if (!raf) { prev = 0; raf = requestAnimationFrame(frame); } };

  // Plays only while the window is on screen.
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (current && screen.classList.contains('landed')) play(current);
    if (visible) kick();
  }).observe(screen);
  screen.addEventListener('pointermove', e => {
    const r = screen.getBoundingClientRect();
    pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.at = performance.now();
  });

  return { show };
}

/** Inline recordings (phones, case-study pages): load and play only while
 *  mostly on screen; with reduced motion they keep their controls instead. */
export function mountLoops(root: ParentNode = document) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      const v = e.target as HTMLVideoElement;
      if (e.isIntersecting && e.intersectionRatio >= 0.4) {
        if (!v.src && v.dataset.src) { v.src = v.dataset.src; v.currentTime = Number(v.dataset.at ?? 0); }
        v.play().catch(() => {});
      } else v.pause();
    }
  }, { threshold: [0, 0.4] });
  // Posters load only as a recording comes near the screen.
  const near = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { const v = e.target as HTMLVideoElement; near.unobserve(v); if (v.dataset.poster && !v.poster) v.poster = v.dataset.poster; }
  }, { rootMargin: '600px 0px' });
  for (const v of root.querySelectorAll<HTMLVideoElement>('video[data-loop]')) {
    if (!v.offsetParent) continue;                 // hidden at this screen size
    near.observe(v);
    if (reduced) { v.controls = true; if (!v.src && v.dataset.src) v.src = v.dataset.src; v.preload = 'none'; continue; }
    v.controls = false;
    io.observe(v);
  }
}
