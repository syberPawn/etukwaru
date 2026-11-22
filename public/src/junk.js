// The junk: simple code-drawn sprites plus the collision shape for each.
// Sizes are world units. 100 units is one metre in the physics world.

const RES = 2;
const PAD = 22;

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (rng, a, b) => a + rng() * (b - a);
const choose = (rng, list) => list[Math.floor(rng() * list.length)];

function blankCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.ceil((w + PAD * 2) * RES);
  c.height = Math.ceil((h + PAD * 2) * RES);
  return c;
}

function grime(g, w, h, rng, amount) {
  g.save();
  g.globalCompositeOperation = 'source-atop';
  const top = g.createLinearGradient(0, -PAD, 0, h + PAD);
  top.addColorStop(0, 'rgba(255,245,220,.14)');
  top.addColorStop(.5, 'rgba(0,0,0,0)');
  top.addColorStop(1, 'rgba(0,0,0,.42)');
  g.fillStyle = top;
  g.fillRect(-PAD, -PAD, w + PAD * 2, h + PAD * 2);
  const blots = Math.round((w * h) / 120 * amount);
  for (let i = 0; i < blots; i++) {
    g.fillStyle = choose(rng, ['rgba(20,14,8,.22)', 'rgba(70,45,20,.22)', 'rgba(0,0,0,.16)', 'rgba(150,130,100,.12)']);
    g.beginPath();
    g.ellipse(rng() * w, rng() * h, between(rng, 1, 7), between(rng, 1, 4), rng() * 3, 0, 7);
    g.fill();
  }
  g.restore();
}

const box = (w, h) => ({ type: 'box', w, h });
const hull = points => ({ type: 'hull', points });

/* ---------- Project junk ---------- */

const PROJECT_ART = {
  telephone: {
    w: 104, h: 68, density: 1.5, bounce: .18, friction: .6,
    shape(w, h) {
      return hull([[-w / 2 + 10, h / 2], [w / 2 - 10, h / 2], [w / 2, -h / 2 + 15], [w / 2 - 8, -h / 2], [-w / 2 + 8, -h / 2], [-w / 2, -h / 2 + 15]]);
    },
    draw(g, w, h) {
      g.fillStyle = '#8c2a22';
      g.beginPath();
      g.moveTo(18, 18); g.lineTo(w - 18, 18); g.lineTo(w - 6, h); g.lineTo(6, h);
      g.closePath(); g.fill();
      g.fillStyle = '#d8d0ba';
      g.beginPath(); g.arc(w / 2, 45, 17, 0, 7); g.fill();
      g.fillStyle = '#2a211b';
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * 6.28;
        g.beginPath(); g.arc(w / 2 + Math.cos(a) * 12, 45 + Math.sin(a) * 12, 2.6, 0, 7); g.fill();
      }
      g.fillStyle = '#6d1f19';
      g.beginPath(); g.roundRect(2, 8, w - 4, 11, 6); g.fill();
      g.beginPath(); g.roundRect(0, 0, 26, 20, 7); g.fill();
      g.beginPath(); g.roundRect(w - 26, 0, 26, 20, 7); g.fill();
    },
  },
  suitcase: {
    w: 116, h: 84, density: 1.1, bounce: .12, friction: .7,
    shape: box,
    draw(g, w, h) {
      g.strokeStyle = '#3c2614'; g.lineWidth = 6;
      g.beginPath(); g.roundRect(w / 2 - 20, -13, 40, 20, 6); g.stroke();
      g.fillStyle = '#8a5c2c';
      g.beginPath(); g.roundRect(0, 0, w, h, 8); g.fill();
      g.fillStyle = '#5f3d1a';
      g.fillRect(0, h / 2 - 2, w, 4);
      g.fillRect(24, 0, 10, h); g.fillRect(w - 34, 0, 10, h);
      g.fillStyle = '#c4b15e';
      g.fillRect(25, h / 2 - 7, 8, 12); g.fillRect(w - 33, h / 2 - 7, 8, 12);
      g.fillStyle = '#b8a678';
      for (const [x, y] of [[0, 0], [w - 11, 0], [0, h - 11], [w - 11, h - 11]]) g.fillRect(x, y, 11, 11);
      g.save(); g.translate(62, 22); g.rotate(-.2);
      g.fillStyle = '#c9c0a4'; g.fillRect(0, 0, 20, 14);
      g.restore();
    },
  },
  tv: {
    w: 108, h: 90, density: 1.8, bounce: .08, friction: .7,
    shape: box,
    draw(g, w, h, rng) {
      g.strokeStyle = '#8b8b84'; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(w / 2, 2); g.lineTo(w / 2 - 28, -20); g.moveTo(w / 2, 2); g.lineTo(w / 2 + 24, -21); g.stroke();
      g.fillStyle = '#5c4026';
      g.beginPath(); g.roundRect(0, 0, w, h, 7); g.fill();
      g.fillStyle = '#16140f';
      g.beginPath(); g.roundRect(8, 8, 72, h - 16, 12); g.fill();
      g.save();
      g.beginPath(); g.roundRect(12, 12, 64, h - 24, 10); g.clip();
      for (let i = 0; i < 700; i++) {
        const v = Math.floor(70 + rng() * 150);
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(12 + rng() * 64, 12 + rng() * (h - 24), 2.4, 1.6);
      }
      g.restore();
      g.fillStyle = '#b0a68a';
      g.beginPath(); g.arc(94, 26, 7, 0, 7); g.arc(94, 50, 7, 0, 7); g.fill();
      g.fillStyle = '#2e2418';
      for (let y = 64; y < 82; y += 4) g.fillRect(86, y, 16, 1.6);
    },
  },
  boombox: {
    w: 124, h: 68, density: 1.2, bounce: .14, friction: .6,
    shape: box,
    draw(g, w, h) {
      g.strokeStyle = '#26262a'; g.lineWidth = 5;
      g.beginPath(); g.roundRect(26, -11, w - 52, 18, 6); g.stroke();
      g.fillStyle = '#50535a';
      g.beginPath(); g.roundRect(0, 0, w, h, 7); g.fill();
      for (const x of [27, w - 27]) {
        g.fillStyle = '#1b1c20'; g.beginPath(); g.arc(x, 39, 21, 0, 7); g.fill();
        g.fillStyle = '#3e4047'; g.beginPath(); g.arc(x, 39, 13, 0, 7); g.fill();
        g.fillStyle = '#17181b'; g.beginPath(); g.arc(x, 39, 5, 0, 7); g.fill();
      }
      g.fillStyle = '#26272c'; g.fillRect(w / 2 - 13, 26, 26, 26);
      g.fillStyle = '#c94f2c'; g.fillRect(w / 2 - 13, 11, 10, 8);
      g.fillStyle = '#b8b09a'; g.fillRect(w / 2 + 1, 11, 12, 8);
    },
  },
  toaster: {
    w: 90, h: 66, density: 1.6, bounce: .16, friction: .5,
    shape: box,
    draw(g, w, h) {
      const steel = g.createLinearGradient(0, 0, w, 0);
      steel.addColorStop(0, '#7d8285'); steel.addColorStop(.3, '#c9ccc9');
      steel.addColorStop(.62, '#8c9092'); steel.addColorStop(1, '#55595b');
      g.fillStyle = steel;
      g.beginPath(); g.roundRect(0, 2, w, h - 8, 14); g.fill();
      g.fillStyle = '#20201e';
      g.fillRect(4, h - 10, w - 8, 10);
      g.fillRect(16, 0, w - 32, 5);
      g.fillStyle = '#26221c'; g.fillRect(w - 5, 22, 8, 18);
      g.fillStyle = '#7a4a1e'; g.fillRect(24, -6, w - 48, 8);
    },
  },
  // A rider's helmet, for TrafficVision.
  helmet: {
    w: 100, h: 82, density: 1.1, bounce: .25, friction: .55,
    shape(w, h) {
      return hull([[-w / 2, h / 2], [w / 2, h / 2], [w / 2, -h / 2 + 34], [w / 2 - 22, -h / 2 + 4], [0, -h / 2], [-w / 2 + 24, -h / 2 + 6], [-w / 2, -h / 2 + 34]]);
    },
    draw(g, w, h) {
      const shell = g.createLinearGradient(0, 0, 0, h);
      shell.addColorStop(0, '#d8d2c4'); shell.addColorStop(1, '#8e887c');
      g.fillStyle = shell;
      g.beginPath();
      g.moveTo(0, h); g.lineTo(0, 40);
      g.bezierCurveTo(0, 6, 24, 0, w / 2, 0);
      g.bezierCurveTo(w - 18, 0, w, 14, w, 40);
      g.lineTo(w, h); g.closePath(); g.fill();
      g.fillStyle = '#1d2228';                                   // visor
      g.beginPath();
      g.moveTo(w * .42, 30); g.lineTo(w - 4, 30); g.lineTo(w - 4, 58); g.lineTo(w * .48, 58);
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(160,190,210,.35)';
      g.fillRect(w * .55, 34, w * .3, 5);
      g.fillStyle = '#b5302a';                                   // a racing stripe
      g.fillRect(8, 16, w * .36, 6);
      g.fillStyle = '#2a2723';
      g.fillRect(0, h - 8, w, 8);
    },
  },
  // A worn football, for Makaam Sports.
  football: {
    w: 76, h: 76, density: .45, bounce: .6, friction: .6,
    shape: w => ({ type: 'ball', r: w / 2 }),
    draw(g, w) {
      const r = w / 2;
      const ball = g.createRadialGradient(r * .75, r * .7, r * .1, r, r, r);
      ball.addColorStop(0, '#f1ede2'); ball.addColorStop(1, '#a9a395');
      g.fillStyle = ball;
      g.beginPath(); g.arc(r, r, r, 0, 7); g.fill();
      g.fillStyle = '#23201b';
      const patch = (cx, cy, s) => {
        g.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
          g.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s);
        }
        g.closePath(); g.fill();
      };
      patch(r, r, 13);
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
        patch(r + Math.cos(a) * 31, r + Math.sin(a) * 31, 8);
      }
      g.save();
      g.beginPath(); g.arc(r, r, r, 0, 7); g.clip();
      g.strokeStyle = 'rgba(35,32,27,.5)'; g.lineWidth = 1.4;
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
        g.beginPath(); g.moveTo(r + Math.cos(a) * 13, r + Math.sin(a) * 13); g.lineTo(r + Math.cos(a) * 31, r + Math.sin(a) * 31); g.stroke();
      }
      g.restore();
    },
  },
  // A sealed invitation, for the event management software.
  envelope: {
    w: 112, h: 74, density: .6, bounce: .1, friction: .8,
    shape: box,
    draw(g, w, h) {
      g.fillStyle = '#e6dcc3';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(90,70,40,.45)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, h); g.lineTo(w * .42, h * .5); g.moveTo(w, h); g.lineTo(w * .58, h * .5); g.stroke();
      g.fillStyle = '#d6cbb0';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w / 2, h * .58); g.closePath(); g.fill();
      g.stroke();
      g.fillStyle = '#1f7a4c';                                   // the seal
      g.beginPath(); g.arc(w / 2, h * .56, 12, 0, 7); g.fill();
      g.fillStyle = '#e6dcc3';
      g.font = '700 13px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('✓', w / 2, h * .57);
    },
  },
  // An attendance register, for Dgtal Register.
  register: {
    w: 98, h: 80, density: 1.2, bounce: .1, friction: .75,
    shape: box,
    draw(g, w, h) {
      g.fillStyle = '#efe8d6';                                   // page edges
      g.fillRect(6, 4, w - 6, h - 4);
      g.strokeStyle = 'rgba(120,110,90,.5)'; g.lineWidth = 1;
      for (let y = 8; y < h - 2; y += 3) { g.beginPath(); g.moveTo(w - 6, y); g.lineTo(w, y); g.stroke(); }
      g.fillStyle = '#2a59a8';                                   // cover
      g.beginPath(); g.roundRect(0, 0, w - 8, h - 6, 4); g.fill();
      g.fillStyle = '#1d3f7a';
      g.fillRect(0, 0, 12, h - 6);
      g.fillStyle = '#e8e2cf';
      g.fillRect(24, 18, w - 44, 22);
      g.fillStyle = '#2a2418';
      g.font = '700 10px "Courier New", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('REGISTER', 24 + (w - 44) / 2, 29);
      g.fillStyle = '#f2c94c';
      g.fillRect(24, 50, 22, 4);
    },
  },
  // A tin sign for Instagram.
  instagram: {
    w: 80, h: 80, density: 1.4, bounce: .2, friction: .6,
    shape: box,
    draw(g, w, h) {
      const bg = g.createLinearGradient(0, h, w, 0);
      bg.addColorStop(0, '#f2a64a'); bg.addColorStop(.4, '#e0533d'); bg.addColorStop(.75, '#c03477'); bg.addColorStop(1, '#6a3ab0');
      g.fillStyle = bg;
      g.beginPath(); g.roundRect(0, 0, w, h, 18); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 6;
      g.beginPath(); g.roundRect(17, 17, w - 34, h - 34, 12); g.stroke();
      g.beginPath(); g.arc(w / 2, h / 2, 11, 0, 7); g.stroke();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(w - 27, 27, 3.5, 0, 7); g.fill();
    },
  },
  // A name badge, for About me.
  badge: {
    w: 104, h: 70, density: .5, bounce: .1, friction: .8,
    shape: box,
    draw(g, w, h) {
      g.fillStyle = '#c3302a';
      g.beginPath(); g.roundRect(0, 0, w, h, 8); g.fill();
      g.fillStyle = '#f3efe4';
      g.fillRect(5, 26, w - 10, h - 34);
      g.fillStyle = '#fff';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '900 15px Impact, "Arial Black", sans-serif';
      g.fillText('HELLO', w / 2, 10);
      g.font = '700 7px Arial, sans-serif';
      g.fillText('my name is', w / 2, 21);
      g.fillStyle = '#1d2a5c';
      g.font = '400 17px "Segoe Script", "Brush Script MT", cursive';
      g.fillText('S.Gangmei', w / 2, 44, w - 16);
    },
  },
  // A tin sign for LinkedIn.
  linkedin: {
    w: 80, h: 80, density: 1.4, bounce: .2, friction: .6,
    shape: box,
    draw(g, w, h) {
      g.fillStyle = '#0a66c2';
      g.beginPath(); g.roundRect(0, 0, w, h, 12); g.fill();
      g.fillStyle = '#fff';
      g.fillRect(16, 34, 11, 30);
      g.beginPath(); g.arc(21.5, 22, 7, 0, 7); g.fill();
      g.fillRect(34, 34, 11, 30);
      g.beginPath();
      g.moveTo(45, 44); g.quadraticCurveTo(48, 33, 57, 33); g.quadraticCurveTo(66, 33, 66, 46);
      g.lineTo(66, 64); g.lineTo(55, 64); g.lineTo(55, 48); g.quadraticCurveTo(55, 43, 50, 43); g.quadraticCurveTo(45, 43, 45, 49);
      g.closePath(); g.fill();
    },
  },
};

/* ---------- Filler garbage ---------- */

function lumpyPoints(rng, w, h, n, lump) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    const k = 1 - rng() * lump;
    pts.push([Math.cos(a) * w / 2 * k, Math.sin(a) * h / 2 * k]);
  }
  return pts;
}

function smoothPath(g, pts, ox, oy) {
  g.beginPath();
  const n = pts.length;
  const mid = i => [(pts[i][0] + pts[(i + 1) % n][0]) / 2 + ox, (pts[i][1] + pts[(i + 1) % n][1]) / 2 + oy];
  g.moveTo(...mid(n - 1));
  for (let i = 0; i < n; i++) g.quadraticCurveTo(pts[i][0] + ox, pts[i][1] + oy, ...mid(i));
  g.closePath();
}

const FILLER = {
  bag(rng) {
    const w = between(rng, 58, 84), h = between(rng, 44, 62);
    const pts = lumpyPoints(rng, w, h, 9, .22);
    const base = choose(rng, ['#1d1e21', '#26272b', '#1a2a3a', '#2c3122', '#343036']);
    return {
      w, h, density: .28, bounce: .05, friction: .55, shape: hull(pts),
      draw(g) {
        smoothPath(g, pts, w / 2, h / 2);
        const fill = g.createRadialGradient(w * .4, h * .3, 2, w / 2, h / 2, w * .6);
        fill.addColorStop(0, '#5b5d60'); fill.addColorStop(.25, base); fill.addColorStop(1, '#0e0e10');
        g.fillStyle = fill; g.fill();
        g.strokeStyle = 'rgba(190,190,190,.2)'; g.lineWidth = 1.2;
        for (let i = 0; i < 5; i++) {
          g.beginPath();
          const x = rng() * w, y = rng() * h;
          g.moveTo(x, y); g.quadraticCurveTo(x + between(rng, -12, 12), y + 8, x + between(rng, -12, 12), y + between(rng, 8, 18));
          g.stroke();
        }
        g.fillStyle = '#0d0d0f';
        g.beginPath(); g.ellipse(w / 2, 5, 8, 5, 0, 0, 7); g.fill();
      },
    };
  },
  box(rng) {
    const w = between(rng, 42, 64), h = between(rng, 32, 48);
    return {
      w, h, density: .25, bounce: .05, friction: .5, shape: box(w, h),
      draw(g) {
        g.fillStyle = choose(rng, ['#8e6e43', '#7c5e38', '#94784e']);
        g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(214,190,140,.4)'; g.fillRect(w / 2 - 4, 0, 8, h);
        g.strokeStyle = 'rgba(40,25,10,.5)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(0, h * .3); g.lineTo(w, h * between(rng, .2, .4)); g.stroke();
        g.beginPath(); g.moveTo(rng() * w, 0); g.lineTo(rng() * w, h); g.stroke();
      },
    };
  },
  crate(rng) {
    const w = 56, h = 40;
    const c = choose(rng, ['#7c3a2a', '#2f5a60', '#6a6a2a']);
    return {
      w, h, density: .4, bounce: .2, friction: .55, shape: box(w, h),
      draw(g) {
        g.fillStyle = c; g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(0,0,0,.5)';
        for (let y = 7; y < h - 4; y += 11) for (let x = 6; x < w - 6; x += 12) g.fillRect(x, y, 8, 6);
      },
    };
  },
  tyre(rng) {
    const r = between(rng, 28, 36);
    return {
      w: r * 2, h: r * 2, density: .5, bounce: .55, friction: .6, shape: { type: 'ball', r },
      draw(g) {
        g.fillStyle = '#191919'; g.beginPath(); g.arc(r, r, r, 0, 7); g.fill();
        g.strokeStyle = '#2d2d2d'; g.lineWidth = 2; g.setLineDash([3, 4]);
        g.beginPath(); g.arc(r, r, r - 3, 0, 7); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#3f3a34'; g.beginPath(); g.arc(r, r, r * .55, 0, 7); g.fill();
        g.fillStyle = '#100f0e'; g.beginPath(); g.arc(r, r, r * .34, 0, 7); g.fill();
      },
    };
  },
  plank(rng) {
    const w = between(rng, 84, 118), h = 13;
    return {
      w, h, density: .55, bounce: .22, friction: .6, shape: box(w, h),
      draw(g) {
        g.fillStyle = choose(rng, ['#6b4f2d', '#7a5e3a', '#54402a']);
        g.fillRect(0, 0, w, h);
        g.strokeStyle = 'rgba(25,14,5,.5)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(0, 5); g.lineTo(w, 7); g.stroke();
      },
    };
  },
  can(rng) {
    const w = 18, h = 30;
    const c = choose(rng, ['#a33a2a', '#2e6a50', '#b08a2c', '#3a5a90']);
    return {
      w, h, density: .3, bounce: .3, friction: .4, shape: box(w, h),
      draw(g) {
        g.fillStyle = c; g.fillRect(0, 2, w, h - 4);
        g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(3, 2, 3, h - 4);
        g.fillStyle = '#a7a7a0'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3);
      },
    };
  },
  bottle(rng) {
    const w = 16, h = 42;
    const c = choose(rng, ['rgba(120,170,120,.85)', 'rgba(110,70,30,.9)', 'rgba(170,190,200,.75)']);
    return {
      w, h, density: .4, bounce: .3, friction: .35, shape: box(w, h),
      draw(g) {
        g.fillStyle = c;
        g.beginPath(); g.roundRect(0, 13, w, h - 13, 4); g.fill();
        g.fillRect(w / 2 - 3.5, 0, 7, 16);
        g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(3, 17, 2.4, h - 24);
      },
    };
  },
  paper(rng) {
    const w = between(rng, 34, 48), h = between(rng, 20, 30);
    const pts = lumpyPoints(rng, w, h, 7, .35);
    return {
      w, h, density: .08, bounce: .1, friction: .8, shape: hull(pts),
      draw(g) {
        smoothPath(g, pts, w / 2, h / 2);
        g.fillStyle = choose(rng, ['#b5ae9a', '#a59c84', '#c2bba5']);
        g.fill();
        g.strokeStyle = 'rgba(40,30,20,.45)'; g.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          g.beginPath(); g.moveTo(rng() * w, rng() * h); g.lineTo(rng() * w, rng() * h); g.stroke();
        }
      },
    };
  },
  bucket(rng) {
    const w = 38, h = 40;
    const c = choose(rng, ['#2b5a7a', '#8a7a2a', '#7c2f2f']);
    return {
      w, h, density: .3, bounce: .25, friction: .5,
      shape: hull([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2 - 6, h / 2], [-w / 2 + 6, h / 2]]),
      draw(g) {
        g.fillStyle = c;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w - 6, h); g.lineTo(6, h); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 0, w, 4);
      },
    };
  },
};

const FILLER_COUNTS = { bag: 4, box: 3, crate: 1, tyre: 2, plank: 2, can: 6, bottle: 5, paper: 4, bucket: 1 };

function finishSprite(spec, paint, rng, amount) {
  const { w, h } = spec;
  const canvas = blankCanvas(w, h);
  const g = canvas.getContext('2d');
  g.scale(RES, RES);
  g.translate(PAD, PAD);
  paint(g);
  grime(g, w, h, rng, amount);

  const silhouette = color => {
    const c = document.createElement('canvas');
    c.width = canvas.width; c.height = canvas.height;
    const x = c.getContext('2d');
    x.drawImage(canvas, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    return c;
  };

  return {
    ...spec,
    canvas,
    drawW: w + PAD * 2,
    drawH: h + PAD * 2,
    shadow: silhouette('#000'),
    glow: spec.isProject ? silhouette('#ffd34d') : null,
  };
}

/* ---------- Project pictures ---------- */

const TRACE_SIZE = 256;       // the outline is measured on a copy this big
const MAX_IMAGE_SIZE = 170;   // beyond this an object would barely fit the carrier
const MAX_HULL_POINTS = 14;

export async function loadProjectImages(projects) {
  const entries = await Promise.all(projects.filter(p => p.image).map(async project => {
    const img = new Image();
    img.src = project.image;
    try {
      await img.decode();
      return [project, img];
    } catch {
      console.warn(`Couldn't load "${project.image}" for "${project.name}". Using a drawn object instead.`);
      return [project, null];
    }
  }));
  return new Map(entries);
}

function convexHull(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = list => {
    const out = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

/** Drops the corners that matter least until the outline is cheap to simulate. */
function simplifyHull(hull) {
  const points = [...hull];
  const area = (a, b, c) => Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  while (points.length > MAX_HULL_POINTS) {
    let least = Infinity, index = 0;
    points.forEach((p, i) => {
      const a = area(points[(i + points.length - 1) % points.length], p, points[(i + 1) % points.length]);
      if (a < least) { least = a; index = i; }
    });
    points.splice(index, 1);
  }
  return points;
}

/** Finds the visible part of a picture and the outline around it. */
function traceImage(img, label) {
  const k = Math.min(1, TRACE_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * k));
  c.height = Math.max(1, Math.round(img.naturalHeight * k));
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, c.width, c.height);
  const { data, width, height } = g.getImageData(0, 0, c.width, c.height);
  const alpha = (x, y) => data[(x + y * width) * 4 + 3];

  if ([[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]].every(([x, y]) => alpha(x, y) > 200)) {
    console.warn(`"${label}" has no transparent background, so it will tumble as a solid rectangle.`);
  }

  const edge = [];
  for (let y = 0; y < height; y++) {
    let left = -1, right = -1;
    for (let x = 0; x < width; x++) {
      if (alpha(x, y) > 40) {
        if (left < 0) left = x;
        right = x + 1;
      }
    }
    if (left >= 0) edge.push([left, y], [right, y], [left, y + 1], [right, y + 1]);
  }
  if (edge.length === 0) return null;

  const xs = edge.map(p => p[0]), ys = edge.map(p => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return {
    k, x, y,
    w: Math.max(...xs) - x,
    h: Math.max(...ys) - y,
    outline: simplifyHull(convexHull(edge)),
  };
}

function makeImageSprite(project, img, rng) {
  let trace;
  try {
    trace = traceImage(img, project.image);
  } catch {
    console.warn(`"${project.image}" can't be read. Keep images in this site's folder, not on another website.`);
    return null;
  }
  if (!trace) {
    console.warn(`"${project.image}" is completely transparent. Using a drawn object instead.`);
    return null;
  }

  const wanted = Math.min(MAX_IMAGE_SIZE, Math.max(30, project.width ?? 110));
  let s = wanted / trace.w;
  if (trace.h * s > MAX_IMAGE_SIZE) s = MAX_IMAGE_SIZE / trace.h;
  const w = trace.w * s, h = trace.h * s;
  const points = trace.outline.map(([x, y]) => [(x - trace.x - trace.w / 2) * s, (y - trace.y - trace.h / 2) * s]);

  const spec = {
    w, h, density: 1.2, bounce: .15, friction: .6, isProject: true,
    shape: points.length >= 3 ? hull(points) : box(w, h),
  };
  const { k } = trace;
  // Amount 0 keeps the picture clean and only applies the scene's lighting.
  return finishSprite(spec, g => g.drawImage(img, trace.x / k, trace.y / k, trace.w / k, trace.h / k, 0, 0, w, h), rng, 0);
}

export function makeProjectSprite(project, rng, img) {
  if (img) {
    const sprite = makeImageSprite(project, img, rng);
    if (sprite) return sprite;
  }
  if (project.junk && !PROJECT_ART[project.junk]) {
    console.warn(`Unknown junk type "${project.junk}" on "${project.name}". Using a suitcase.`);
  }
  const art = PROJECT_ART[project.junk] ?? PROJECT_ART.suitcase;
  const spec = { ...art, shape: art.shape(art.w, art.h), isProject: true };
  return finishSprite(spec, g => art.draw(g, art.w, art.h, rng), rng, .45);
}

export function makeFillerSprites(rng) {
  const sprites = [];
  for (const [kind, count] of Object.entries(FILLER_COUNTS)) {
    for (let i = 0; i < count; i++) {
      const spec = FILLER[kind](rng);
      sprites.push(finishSprite(spec, g => spec.draw(g), rng, 1));
    }
  }
  return sprites;
}
