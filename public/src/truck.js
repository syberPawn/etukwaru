// Truck geometry, in pixels of the source photo (assets/unloading.png), and
// the layers cut from it. The photo shows the bed already tipped, so every
// bed and gate angle below is measured from that pose.

export const NATIVE = {
  groundY: 862,
  centerX: 727,
  hinge: { x: 1165, y: 672 },        // the bed pivots here
  gatePivot: { x: 1330, y: 345 },    // the tailgate hangs from here
  ramBase: { x: 630, y: 636 },
  ramTop: { x: 722, y: 434 },        // on the bed's underside, photo pose
  photoTilt: 24.6,                   // degrees the bed is tipped in the photo
  wheelRadius: 101,
};

export const WHEELS = [
  { part: 'wheel1', x: 362.5, y: 762 },
  { part: 'wheel2', x: 798, y: 762 },
  { part: 'wheel3', x: 1028, y: 762 },
];

// How far the bed tips. Past the photo's angle, or the load wouldn't slide.
export const MAX_TILT = 40;

export const SCALE = 0.72;           // photo pixels to world units

const DEG = Math.PI / 180;

// Rest-frame collision shapes, relative to the hinge with the bed level.
export const BED_SHAPES = {
  floorTop: -72,
  floorFront: -705,
  floorRear: 0,
  lipRear: 133,
  rim: -372,
  wallTop: -470,
  gate: [[21, -470], [21, -375], [81, -305], [153, -8], [-9, -13]],
};

export async function loadTruckImages() {
  const manifest = await (await fetch('assets/parts/manifest.json')).json();
  const entries = await Promise.all(Object.keys(manifest).map(async name => {
    const img = new Image();
    img.src = `assets/parts/${name}.webp`;
    await img.decode();
    return [name, { img, ...manifest[name] }];
  }));
  return Object.fromEntries(entries);
}

// Screen rotation of the bed, in radians, for a tilt in degrees above level.
export const bedRotation = tilt => (tilt - NATIVE.photoTilt) * DEG;

// The gate swings out as the bed rises. Closed it sits at +20 degrees from
// the photo, and it matches the photo at the photo's own tilt.
export const gateRotation = tilt => {
  const open = 20 - (20 / NATIVE.photoTilt) * tilt;
  return open * DEG;
};

function rotate(p, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

/** Draws a cut layer: `from` is its pivot in the photo, `to` is where that pivot is now. */
function drawPart(ctx, part, from, to, a) {
  ctx.save();
  ctx.translate(to.x, to.y);
  ctx.rotate(a);
  ctx.drawImage(part.img, part.x - from.x, part.y - from.y, part.w, part.h);
  ctx.restore();
}

/** Where the gate's hinge has moved to, in photo pixels. */
function gatePivotAt(tilt) {
  const { hinge, gatePivot } = NATIVE;
  const r = rotate({ x: gatePivot.x - hinge.x, y: gatePivot.y - hinge.y }, bedRotation(tilt));
  return { x: hinge.x + r.x, y: hinge.y + r.y };
}

function drawRam(ctx, tilt) {
  if (tilt < 1.5) return;
  const { hinge, ramBase, ramTop } = NATIVE;
  const r = rotate({ x: ramTop.x - hinge.x, y: ramTop.y - hinge.y }, bedRotation(tilt));
  const top = { x: hinge.x + r.x, y: hinge.y + r.y };
  const dx = top.x - ramBase.x, dy = top.y - ramBase.y;
  const len = Math.hypot(dx, dy);
  const barrel = Math.min(112, len);

  ctx.save();
  ctx.translate(ramBase.x, ramBase.y);
  ctx.rotate(Math.atan2(dy, dx));

  const rod = ctx.createLinearGradient(0, -13, 0, 13);
  rod.addColorStop(0, '#5d6266');
  rod.addColorStop(.35, '#d5d9da');
  rod.addColorStop(.6, '#8f9496');
  rod.addColorStop(1, '#3b3e41');
  ctx.fillStyle = rod;
  ctx.fillRect(0, -12, len, 24);

  const bar = ctx.createLinearGradient(0, -28, 0, 28);
  bar.addColorStop(0, '#7d5a10');
  bar.addColorStop(.32, '#d29c1c');
  bar.addColorStop(.62, '#a87b14');
  bar.addColorStop(1, '#4e380a');
  ctx.fillStyle = bar;
  ctx.fillRect(-8, -28, barrel + 8, 56);
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.fillRect(barrel - 7, -28, 7, 56);
  ctx.restore();
}

/** Puts photo pixels onto the world: truck centred at x, wheels on groundY. */
export function applyTruckTransform(ctx, x, groundY) {
  ctx.translate(x, groundY);
  ctx.scale(SCALE, SCALE);
  ctx.translate(-NATIVE.centerX, -NATIVE.groundY);
}

export function drawBedLayers(ctx, parts, tilt) {
  drawPart(ctx, parts.bed, NATIVE.hinge, NATIVE.hinge, bedRotation(tilt));
  drawPart(ctx, parts.gate, NATIVE.gatePivot, gatePivotAt(tilt), gateRotation(tilt));
}

export function drawRamLayer(ctx, tilt) {
  drawRam(ctx, tilt);
}

/** Wheels go on separately so they can roll without moving the body. */
export function drawWheels(ctx, parts, roll) {
  for (const w of WHEELS) {
    const part = parts[w.part];
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(roll);
    ctx.drawImage(part.img, part.x - w.x, part.y - w.y, part.w, part.h);
    ctx.restore();
  }
}

export function drawChassisLayer(ctx, parts) {
  const c = parts.chassis;
  ctx.drawImage(c.img, c.x, c.y, c.w, c.h);
}
