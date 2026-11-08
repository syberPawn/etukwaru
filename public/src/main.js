import RAPIER from '../vendor/rapier.mjs';
import { PROJECTS } from './projects.js';
import { mulberry, loadProjectImages, makeProjectSprite, makeFillerSprites } from './junk.js';
import { paintBackground, paintGroundLip, paintGrade } from './scene.js';
import {
  initSound, setMuted, soundState, pauseSound, engineStart, engineThrottle, engineStop,
  hydraulics, reverseBeeps, thud,
} from './sound.js';
import {
  NATIVE, SCALE, MAX_TILT, BED_SHAPES, loadTruckImages,
  applyTruckTransform, drawBedLayers, drawRamLayer, drawChassisLayer, drawWheels, WHEELS,
} from './truck.js';

/* ---------- Constants ---------- */

const M = 100;                // world units per physics metre
const GROUND = 800;           // world y of the ground line
const GRAVITY = 15;
const STEP = 1 / 120;
const TYRE_SINK = 5;          // how far the tyres press into the dirt
const REVERSE_TIME = 1.4;
const RAISE_TIME = 2.1;
const POUR_TIME = 3.2;        // tipped, and driving forward out from under the load
const LOWER_TIME = 1.9;
const TOP_SPEED = { forward: 310, backward: 180 };   // world units per second
const ACCELERATION = 260;
const ROLL_TO_STOP = 340;
const GAS_TIMEOUT = 5;        // a gas pedal left on with no arrow pressed lets go
const EDGE_GAP = 8;           // the truck stops this far from the screen edge
const DRAG_THRESHOLD = 7;     // px of travel before a press becomes a drag
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const unloadBtn = document.getElementById('unload');
const hintEl = document.getElementById('hint');
const controls = document.getElementById('controls');
const dialog = document.getElementById('tag');

const ease = t => t * t * (3 - 2 * t);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- Camera ---------- */

function computeView() {
  const vw = innerWidth, vh = innerHeight;
  const narrow = vw / vh < 1.15;
  const W = narrow ? 1320 : 1800;
  const minH = narrow ? 1000 : 960;
  const scale = Math.min(vw / W, vh / minH);
  const visW = vw / scale, visH = vh / scale;
  const groundFrac = narrow ? .66 : .79;
  return { vw, vh, narrow, W, scale, visW, visH, offX: (visW - W) / 2, offY: GROUND - groundFrac * visH };
}

const toWorld = (px, py) => ({ x: px / view.scale - view.offX, y: py / view.scale + view.offY });

/* ---------- State ---------- */

let view, world, parts, projectImages, bg, lip, grade;
let items = [], truckBody, bedBody, gateCollider, leftWall, rightWall;
let truckX, truckDX = 0, travel, moundX, hinge;
let cycleFrom = 0, cycleTravel = 0;
let driveDir = 0, gasDown = false, gasIdle = 0, driveV = 0, straining = false, wheelRoll = 0;
const dirHeld = { forward: false, backward: false };
let phase = 'idle', phaseT = 0, tilt = 0, lowerFrom = 0;
let held = null, press = null, hover = null;
let pointer = { x: 0, y: 0 };
let shake = 0;
const dust = [];
let puff, crows = [];

/* ---------- Terrain ---------- */

function terrainY(x) {
  const end = view.W + 300;
  if (x <= moundX) return GROUND;
  const t = clamp((x - moundX) / (end - moundX), 0, 1);
  const rise = (view.narrow ? 520 : 420) * t * t * (3 - 2 * t);
  const bumps = (Math.sin(x * .031) * 10 + Math.sin(x * .083 + 1) * 5) * Math.min(1, t * 5);
  return GROUND - rise - bumps;
}

/* ---------- Physics world ---------- */

const n = v => v * SCALE / M;   // photo pixels -> metres

function addColliderFromShape(shape, body, sprite) {
  let desc;
  if (shape.type === 'box') desc = RAPIER.ColliderDesc.cuboid(shape.w / 2 / M, shape.h / 2 / M);
  else if (shape.type === 'ball') desc = RAPIER.ColliderDesc.ball(shape.r / M);
  else desc = RAPIER.ColliderDesc.convexHull(new Float32Array(shape.points.flat().map(v => v / M)));
  desc.setDensity(sprite.density).setFriction(sprite.friction).setRestitution(sprite.bounce);
  return world.createCollider(desc, body);
}

function buildStatics() {
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const pts = [-30, GROUND / M];
  for (let x = moundX; x <= view.W + 300; x += 16) pts.push(x / M, terrainY(x) / M);
  pts.push((view.W + 300) / M, (terrainY(view.W + 300) - 1500) / M);
  world.createCollider(RAPIER.ColliderDesc.polyline(new Float32Array(pts)).setFriction(.6), ground);
  // A thick slab under the flat ground, so nothing can tunnel through it.
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(80, 1).setTranslation(30, GROUND / M + 1).setFriction(.6),
    ground,
  );

  // The truck's solid parts: everything from the frame down, and the cab.
  truckBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(truckX / M, GROUND / M),
  );
  const rect = (x0, y0, x1, y1) => {
    const cx = (x0 + x1) / 2 - NATIVE.centerX, cy = (y0 + y1) / 2 - NATIVE.groundY;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(n(x1 - x0) / 2, n(y1 - y0) / 2)
        .setTranslation(n(cx), n(cy)).setFriction(.5),
      truckBody,
    );
  };
  rect(135, 632, 1148, 862);
  rect(150, 372, 462, 632);

  // Invisible walls at the screen edges keep everything in view.
  leftWall = world.createCollider(RAPIER.ColliderDesc.cuboid(.5, 40));
  rightWall = world.createCollider(RAPIER.ColliderDesc.cuboid(.5, 40));
  placeSideWalls();
}

function placeSideWalls() {
  leftWall.setTranslation({ x: -view.offX / M - .5, y: 0 });
  rightWall.setTranslation({ x: (view.W + view.offX) / M + .5, y: 0 });
}

function buildBed() {
  bedBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(hinge.x / M, hinge.y / M),
  );
  const S = BED_SHAPES;
  const slide = RAPIER.CoefficientCombineRule.Min;
  const add = desc => world.createCollider(desc.setFriction(.03).setFrictionCombineRule(slide), bedBody);
  const rect = (x0, y0, x1, y1) => RAPIER.ColliderDesc
    .cuboid(n(x1 - x0) / 2, n(y1 - y0) / 2)
    .setTranslation(n((x0 + x1) / 2), n((y0 + y1) / 2));

  add(rect(S.floorFront, S.floorTop, S.floorRear, S.floorTop + 130));      // floor
  add(rect(S.floorRear, S.floorTop, S.lipRear, S.floorTop + 18));          // lip past the hinge
  add(rect(S.floorFront - 60, S.wallTop, S.floorFront, S.floorTop + 130)); // front wall
  gateCollider = add(RAPIER.ColliderDesc.convexHull(new Float32Array(S.gate.flat().map(v => n(v)))));
}

function spawnLoad() {
  items = [];
  const rng = mulberry(1701);
  const filler = makeFillerSprites(rng);
  const projects = PROJECTS.map(project => ({ sprite: makeProjectSprite(project, rng, projectImages.get(project)), project }));

  for (let i = filler.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [filler[i], filler[j]] = [filler[j], filler[i]];
  }

  // A temporary shaft lets the load settle from above without spilling.
  const S = BED_SHAPES;
  const shaft = [
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(.3, 30).setTranslation(hinge.x / M + n(S.floorFront) - .3, hinge.y / M),
    ),
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(.3, 30).setTranslation(hinge.x / M + n(S.gate[0][0]) + .3, hinge.y / M),
    ),
  ];

  const addItem = (sprite, project, px, py) => {
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(px / M, py / M)
        .setRotation(rng() * .5 - .25)
        .setCcdEnabled(true)
        .setLinearDamping(.05)
        .setAngularDamping(.5),
    );
    addColliderFromShape(sprite.shape, body, sprite);
    items.push({ sprite, project, body, lastV: { x: 0, y: 0 } });
  };

  // Filler goes in rear-first and pours out first. The projects ride at the
  // cab end, so they leave last and land on top of the heap.
  const x0 = hinge.x + S.floorFront * SCALE + 50;
  const x1 = hinge.x - 44;
  let y = hinge.y + S.floorTop * SCALE - 34;
  let x = x1;
  for (const sprite of filler) {
    if (x - sprite.w < x0) { x = x1; y -= 58; }
    addItem(sprite, null, x - sprite.w / 2, y);
    x -= sprite.w + 8;
  }
  const frontX = hinge.x + S.floorFront * SCALE + 90;
  projects.forEach(({ sprite, project }, i) => {
    addItem(sprite, project, frontX + (i % 2) * 110 + i * 34, y - 100 - i * 84);
  });

  world.timestep = 1 / 60;
  for (let i = 0; i < 480; i++) world.step();
  world.timestep = STEP;
  shaft.forEach(c => world.removeCollider(c, true));
  for (let i = 0; i < 120; i++) world.step();
  for (const it of items) {
    const v = it.body.linvel();
    it.lastV = { x: v.x, y: v.y };
  }
}

function buildWorld() {
  world = new RAPIER.World({ x: 0, y: GRAVITY });
  world.timestep = STEP;
  world.integrationParameters.numSolverIterations = 8;
  truckX = view.narrow ? 470 : 790;
  moundX = view.narrow ? 1270 : 1640;
  travel = view.narrow ? 130 : 200;
  truckDX = 0;
  wheelRoll = 0;
  driveV = 0;
  straining = false;
  hinge = {
    x: truckX + (NATIVE.hinge.x - NATIVE.centerX) * SCALE,
    y: GROUND + (NATIVE.hinge.y - NATIVE.groundY) * SCALE,
  };
  phase = 'idle'; phaseT = 0; tilt = 0; held = null; press = null; hover = null;
  dust.length = 0;
  buildStatics();
  buildBed();
  spawnLoad();
}

/* ---------- Which side of the carrier wall is something on? ---------- */

function isInBed(x, y) {
  const a = -tilt * Math.PI / 180;
  const dx = x - (hinge.x + truckDX), dy = y - hinge.y;
  const px = (dx * Math.cos(a) - dy * Math.sin(a)) / SCALE;
  const py = (dx * Math.sin(a) + dy * Math.cos(a)) / SCALE;
  const S = BED_SHAPES;
  return px > S.floorFront - 10 && px < 30 && py < S.floorTop + 10 && py > S.wallTop - 60;
}

const worldPos = it => {
  const t = it.body.translation();
  return { x: t.x * M, y: t.y * M };
};

const itemInBed = it => {
  const p = worldPos(it);
  return isInBed(p.x, p.y);
};

const bedCount = () => items.reduce((c, it) => c + (it !== held?.item && itemInBed(it) ? 1 : 0), 0);

/* ---------- Truck cycle ---------- */

function setHint(text) {
  if (hintEl.textContent !== text) hintEl.textContent = text;
}


function refreshButton() {
  document.getElementById('gas').disabled = phase !== 'idle';
  unloadBtn.textContent = 'Unload';
  if (phase !== 'idle') {
    unloadBtn.disabled = true;
    return;
  }
  unloadBtn.disabled = bedCount() === 0;
}

function startUnload() {
  if (phase !== 'idle') return;
  dropHeld();
  hover = null;
  canvas.style.cursor = '';
  setGas(false);
  driveV = 0;
  straining = false;
  initSound();
  engineStart();
  cycleFrom = truckDX;
  cycleTravel = Math.min(travel, driveLimits().max - truckDX);
  enterPhase(cycleTravel > 8 ? 'reverse' : 'raise');
  refreshButton();
}

// The cycle runs on a fixed clock, so the bed can never get stuck up:
// reverse to the tipping spot, raise, drive forward as the load falls out,
// lower. The drive forward ends exactly where the truck started.
function enterPhase(next) {
  phase = next;
  phaseT = 0;
  if (next === 'reverse') {
    engineThrottle(.55);
    reverseBeeps(REVERSE_TIME);
  } else if (next === 'raise') {
    gateCollider.setEnabled(false);
    engineThrottle(.3);
    hydraulics(true, true, RAISE_TIME);
  } else if (next === 'pour') {
    hydraulics(false);
    engineThrottle(.8);
  } else if (next === 'lower') {
    lowerFrom = tilt;
    engineThrottle(.2);
    hydraulics(true, false, LOWER_TIME);
  } else if (next === 'idle') {
    hydraulics(false);
    engineStop();
    gateCollider.setEnabled(true);
    refreshButton();
  }
}

function placeTruck(dx) {
  wheelRoll += (dx - truckDX) / (NATIVE.wheelRadius * SCALE);
  truckDX = dx;
  truckBody.setNextKinematicTranslation({ x: (truckX + dx) / M, y: GROUND / M });
  bedBody.setNextKinematicTranslation({ x: (hinge.x + dx) / M, y: hinge.y / M });
}

function updateTruck(dt) {
  if (phase === 'idle') return;
  phaseT += dt;
  const moving = phase === 'reverse' || phase === 'pour';

  if (phase === 'reverse') {
    placeTruck(cycleFrom + cycleTravel * ease(Math.min(1, phaseT / REVERSE_TIME)));
    if (phaseT >= REVERSE_TIME) enterPhase('raise');
  } else if (phase === 'raise') {
    tilt = MAX_TILT * ease(Math.min(1, phaseT / RAISE_TIME));
    if (phaseT >= RAISE_TIME) enterPhase('pour');
  } else if (phase === 'pour') {
    tilt = MAX_TILT + Math.sin(phaseT * 11) * 1.4;   // hydraulics judder at full lift
    placeTruck(cycleFrom + cycleTravel * (1 - ease(Math.min(1, phaseT / POUR_TIME))));
    if (phaseT >= POUR_TIME) { placeTruck(cycleFrom); enterPhase('lower'); }
  } else if (phase === 'lower') {
    tilt = lowerFrom * (1 - ease(Math.min(1, phaseT / LOWER_TIME)));
    if (phaseT >= LOWER_TIME) {
      tilt = 0;
      bedBody.setNextKinematicRotation(0);
      enterPhase('idle');
      return;
    }
  }

  bedBody.setNextKinematicRotation(tilt * Math.PI / 180);

  // Anything the truck might touch has to be awake to react.
  for (const it of items) if (phase === 'reverse' || itemInBed(it)) it.body.wakeUp();

  if (moving && Math.random() < .16) {
    const w = WHEELS[1 + Math.floor(Math.random() * 2)];
    spawnDust(truckX + truckDX + (w.x - NATIVE.centerX) * SCALE, GROUND + 2, 1);
  }
}

/* ---------- Driving ---------- */

const NOSE = (NATIVE.centerX - 135) * SCALE;                // bumper, ahead of centre
const TAIL = (NATIVE.hinge.x + 153 - NATIVE.centerX) * SCALE;   // closed tailgate, behind centre

function driveLimits() {
  return {
    min: -view.offX + EDGE_GAP + NOSE - truckX,
    max: view.W + view.offX - EDGE_GAP - TAIL - truckX,
  };
}

/** How many loose items are bunched up against the end of the truck that's leading. */
function pushLoad(dir) {
  const at = truckX + truckDX;
  const [from, to] = dir < 0 ? [at - NOSE - 70, at - NOSE + 10] : [at + TAIL - 10, at + TAIL + 70];
  return items.reduce((n, it) => {
    if (it === held?.item || itemInBed(it)) return n;
    const x = worldPos(it).x;
    return n + (x > from && x < to ? 1 : 0);
  }, 0);
}

function updateDrive(dt) {
  if (phase !== 'idle') return;
  const dir = driveDir;
  const going = gasDown && dir !== 0;

  // Gas engaged with nothing to steer is neutral, and gives up after a while.
  gasIdle = gasDown && dir === 0 ? gasIdle + dt : 0;
  if (gasIdle > GAS_TIMEOUT) setGas(false);

  const { min, max } = driveLimits();
  const atEdge = dir < 0 ? truckDX <= min + .5 : dir > 0 && truckDX >= max - .5;
  straining = going && atEdge;

  let target = 0;
  if (going) {
    // Shoving a pile takes effort, so the truck slows as it bunches up.
    const top = TOP_SPEED[dir < 0 ? 'forward' : 'backward'] / (1 + pushLoad(dir) * .22);
    target = dir * Math.max(35, top);
  }
  const changing = driveV !== 0 && target !== 0 && Math.sign(driveV) !== Math.sign(target);
  const rate = changing ? ACCELERATION * 2.2 : going ? ACCELERATION : ROLL_TO_STOP;
  driveV += clamp(target - driveV, -rate * dt, rate * dt);

  if (driveV !== 0) {
    const next = clamp(truckDX + driveV * dt, min, max);
    if (next === min || next === max) driveV = 0;
    if (next !== truckDX) placeTruck(next);
    for (const it of items) it.body.wakeUp();
  }

  if (straining) {
    wheelRoll += dir * 16 * dt;         // wheels spinning in the dirt
    shake = Math.max(shake, 1.1);
  }
  if ((straining && Math.random() < .5) || (Math.abs(driveV) > 40 && Math.random() < .14)) {
    const w = WHEELS[1 + Math.floor(Math.random() * 2)];
    spawnDust(truckX + truckDX + (w.x - NATIVE.centerX) * SCALE, GROUND + 2, 1);
  }
}

function setGas(down) {
  gasDown = down;
  const gas = document.getElementById('gas');
  gas.classList.toggle('is-down', down);
  gas.setAttribute('aria-pressed', String(down));
}

/** The arrow pressed most recently wins while both are held. */
function setArrow(name, down) {
  dirHeld[name] = down;
  const id = name === 'forward' ? 'go-forward' : 'go-backward';
  document.getElementById(id).setAttribute('aria-pressed', String(down));
  const sign = name === 'forward' ? -1 : 1;
  if (down) driveDir = sign;
  else if (driveDir === sign) driveDir = dirHeld.forward ? -1 : dirHeld.backward ? 1 : 0;
}

function releaseControls() {
  setGas(false);
  setArrow('forward', false);
  setArrow('backward', false);
}

function wireDriveControls() {
  const gas = document.getElementById('gas');
  // Arrows are held. Each button tracks its own finger, so two thumbs work.
  for (const [id, name] of [['go-forward', 'forward'], ['go-backward', 'backward']]) {
    const button = document.getElementById(id);
    const release = () => setArrow(name, false);
    button.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      initSound();
      button.setPointerCapture(e.pointerId);
      setArrow(name, true);
    });
    button.addEventListener('pointerup', () => { initSound(); release(); });
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    button.addEventListener('contextmenu', e => e.preventDefault());
  }

  // A mouse has one pointer, so its click latches the pedal on and off.
  // Fingers hold it down like the arrows.
  gas.addEventListener('pointerdown', e => {
    if (e.button !== 0 || gas.disabled) return;
    initSound();
    if (e.pointerType === 'mouse') {
      setGas(!gasDown);
      return;
    }
    gas.setPointerCapture(e.pointerId);
    setGas(true);
  });
  const releaseFinger = e => { if (e.pointerType !== 'mouse') setGas(false); };
  gas.addEventListener('pointerup', e => { initSound(); releaseFinger(e); });
  gas.addEventListener('pointercancel', releaseFinger);
  gas.addEventListener('lostpointercapture', releaseFinger);
  gas.addEventListener('contextmenu', e => e.preventDefault());

  const keyAction = {
    ArrowLeft: down => setArrow('forward', down),
    ArrowRight: down => setArrow('backward', down),
    ArrowUp: down => { if (!gas.disabled || !down) setGas(down); },
  };
  addEventListener('keydown', e => {
    const action = keyAction[e.key];
    if (!action || dialog.open) return;
    e.preventDefault();
    if (e.repeat) return;
    initSound();
    action(true);
  });
  addEventListener('keyup', e => keyAction[e.key]?.(false));
  addEventListener('blur', releaseControls);
}

let lastDriven = 0, nextEngineUpdate = 0, nextBeep = 0;

function updateDriveSound(now) {
  if (phase !== 'idle') return;
  const active = gasDown || Math.abs(driveV) > 2;
  if (!active) {
    if (now - lastDriven > 900) engineStop();
    return;
  }
  lastDriven = now;
  engineStart();
  if (now > nextEngineUpdate) {
    const pace = Math.min(1, Math.abs(driveV) / TOP_SPEED.forward);
    const going = gasDown && driveDir !== 0;
    engineThrottle(straining ? 1 : going ? .4 + pace * .55 : gasDown ? .28 : .15 + pace * .3);
    nextEngineUpdate = now + 100;
  }
  if (driveV > 5 && now > nextBeep) {
    reverseBeeps(.4);
    nextBeep = now + 520;
  }
}

/* ---------- Simulation step ---------- */

// Last resort for anything that has actually gone through a wall or the ground.
// Items merely resting near the screen edge must be left alone.
function rescueStrays() {
  const minX = -view.offX + 30, maxX = view.W + view.offX - 30;
  for (const it of items) {
    if (it === held?.item) continue;
    const p = worldPos(it);
    if (p.x >= -view.offX - 60 && p.x <= view.W + view.offX + 60 && p.y <= GROUND + 60) continue;
    it.body.setTranslation({ x: clamp(p.x, minX + 60, maxX - 60) / M, y: (GROUND - 520) / M }, true);
    it.body.setLinvel({ x: 0, y: 0 }, true);
    it.body.setAngvel(0, true);
    it.lastV = { x: 0, y: 0 };
  }
}


function stepSim() {
  updateTruck(STEP);
  updateDrive(STEP);

  if (held) {
    const body = held.item.body;
    const t = body.translation();
    const target = toWorld(pointer.x, pointer.y);
    const tx = clamp(target.x + held.dx, -view.offX + 20, view.W + view.offX - 20) / M;
    const ty = clamp(target.y + held.dy, view.offY + 10, GROUND - 10) / M;
    let vx = (tx - t.x) * 26, vy = (ty - t.y) * 26;
    const speed = Math.hypot(vx, vy);
    if (speed > 24) { vx *= 24 / speed; vy *= 24 / speed; }
    body.setLinvel({ x: vx, y: vy }, true);
    body.setAngvel(body.angvel() * .9, true);
  }

  world.step();

  // Hard hits kick up dust and rattle the screen.
  for (const it of items) {
    if (it.body.isSleeping()) continue;
    const v = it.body.linvel();
    const hit = Math.hypot(v.x - it.lastV.x, v.y - it.lastV.y);
    it.lastV = { x: v.x, y: v.y };
    if (it !== held?.item && hit > 2.2) {
      const p = worldPos(it);
      if (p.y > hinge.y - 40) {
        spawnDust(p.x, p.y + it.sprite.h * .4, Math.min(4, Math.round(hit * .7)));
        shake = Math.min(9, shake + Math.min(1.4, hit * it.body.mass() * .05));
        thud(hit * Math.sqrt(it.body.mass()));
      }
    }
  }
}

/* ---------- Dust and crows ---------- */

function makePuff() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  r.addColorStop(0, 'rgba(146,126,96,.55)');
  r.addColorStop(1, 'rgba(146,126,96,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return c;
}

function spawnDust(x, y, count) {
  for (let i = 0; i < count && dust.length < 160; i++) {
    dust.push({
      x: x + Math.random() * 24 - 12, y,
      vx: (Math.random() - .5) * 70, vy: -18 - Math.random() * 50,
      life: 0, max: .7 + Math.random() * .9, r: 16 + Math.random() * 26,
    });
  }
}

function makeCrows() {
  crows = Array.from({ length: 6 }, (_, i) => ({
    cx: view.W * (.45 + Math.random() * .5),
    cy: GROUND - 560 - Math.random() * 120,
    rx: 90 + Math.random() * 170,
    ry: 24 + Math.random() * 40,
    a: Math.random() * 6.28,
    v: (.35 + Math.random() * .3) * (i % 2 ? 1 : -1),
    flap: Math.random() * 6.28,
    s: 6 + Math.random() * 4,
  }));
}

function drawCrows(t) {
  ctx.strokeStyle = '#17140f';
  ctx.lineWidth = 2.1;
  ctx.lineCap = 'round';
  for (const c of crows) {
    const a = c.a + t * c.v;
    const x = c.cx + Math.cos(a) * c.rx, y = c.cy + Math.sin(a) * c.ry;
    const wing = Math.sin(t * 8 + c.flap) * c.s * .55;
    ctx.beginPath();
    ctx.moveTo(x - c.s, y - wing);
    ctx.quadraticCurveTo(x - c.s * .4, y - wing * .2 - 1, x, y);
    ctx.quadraticCurveTo(x + c.s * .4, y - wing * .2 - 1, x + c.s, y - wing);
    ctx.stroke();
  }
}

/* ---------- Drawing ---------- */

function drawSprite(sprite, img, x, y, angle, grow = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(grow, grow);
  ctx.drawImage(img, -sprite.drawW / 2, -sprite.drawH / 2, sprite.drawW, sprite.drawH);
  ctx.restore();
}

function drawItem(it) {
  const p = worldPos(it);
  const a = it.body.rotation();
  ctx.globalAlpha = .34;
  drawSprite(it.sprite, it.sprite.shadow, p.x + 3, p.y + 5, a);
  ctx.globalAlpha = 1;
  if (it === hover && it.sprite.glow) {
    ctx.globalAlpha = .9;
    drawSprite(it.sprite, it.sprite.glow, p.x, p.y, a, 1.09);
    ctx.globalAlpha = 1;
  }
  drawSprite(it.sprite, it.sprite.canvas, p.x, p.y, a);
}

function drawLabel(it) {
  const p = worldPos(it);
  const text = it.project.name;
  ctx.font = '700 17px "Courier New", monospace';
  const w = ctx.measureText(text).width + 18;
  const x = clamp(p.x, -view.offX + w / 2 + 6, view.W + view.offX - w / 2 - 6);
  const y = Math.max(view.offY + 30, p.y - it.sprite.h * .5 - 34);
  ctx.fillStyle = '#d9c9a3';
  ctx.fillRect(x - w / 2, y - 14, w, 26);
  ctx.fillStyle = '#241c12';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y + 5);
  ctx.textAlign = 'left';
}

function softEllipse(x, y, rx, ry, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, `rgba(6,4,2,${alpha})`);
  g.addColorStop(.62, `rgba(6,4,2,${alpha * .72})`);
  g.addColorStop(1, 'rgba(6,4,2,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, 7);
  ctx.fill();
  ctx.restore();
}

function drawTruckShadow(at) {
  const wheelX = w => at + (w.x - NATIVE.centerX) * SCALE;
  const mid = (wheelX(WHEELS[0]) + wheelX(WHEELS[2])) / 2;
  softEllipse(mid + 22, GROUND + 12, 1190 * SCALE * .55, 42, .62);   // the truck's own shade
  softEllipse(mid + 12, GROUND + 7, 1010 * SCALE * .5, 15, .7);      // dark under the chassis
  for (const w of WHEELS) softEllipse(wheelX(w), GROUND + 7, 86, 11, .9);   // tyres on the dirt
}

function render(now) {
  const t = now / 1000;
  const sx = shake ? (Math.random() - .5) * shake : 0;
  const sy = shake ? (Math.random() - .5) * shake : 0;
  const dpr = canvas.width / view.vw;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const over = 1.012;
  ctx.drawImage(bg, sx * dpr - canvas.width * (over - 1) / 2, sy * dpr - canvas.height * (over - 1) / 2,
    canvas.width * over, canvas.height * over);

  const s = view.scale * dpr;
  const worldSpace = () => ctx.setTransform(s, 0, 0, s, (view.offX * view.scale + sx) * dpr, (-view.offY * view.scale + sy) * dpr);
  worldSpace();

  drawCrows(t);

  const truckAt = truckX + truckDX;
  const driving = phase === 'reverse' || phase === 'pour' || driveV !== 0;
  const running = (phase !== 'idle' || gasDown || driveV !== 0) && !reduceMotion;
  const bob = running ? Math.sin(t * 41) * (straining ? 2.4 : .7) + (driving ? Math.sin(t * 13) * 1.4 : 0) : 0;
  const onTruck = paint => {
    ctx.save();
    applyTruckTransform(ctx, truckAt, GROUND + TYRE_SINK);
    paint();
    ctx.restore();
  };

  onTruck(() => {
    ctx.translate(0, bob);
    drawRamLayer(ctx, tilt);
  });

  const heldItem = held?.item;
  // Projects are drawn after the filler so the heap never hides them.
  for (const it of items) if (!it.project && it !== heldItem) drawItem(it);
  for (const it of items) if (it.project && it !== heldItem) drawItem(it);
  const heldBehind = heldItem && itemInBed(heldItem);
  if (heldBehind) drawItem(heldItem);

  onTruck(() => {
    ctx.save();
    ctx.translate(0, bob);
    drawBedLayers(ctx, parts, tilt);
    drawChassisLayer(ctx, parts);
    ctx.restore();
    drawWheels(ctx, parts, wheelRoll);
  });

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(lip, sx * dpr - canvas.width * (over - 1) / 2, sy * dpr - canvas.height * (over - 1) / 2,
    canvas.width * over, canvas.height * over);
  worldSpace();
  drawTruckShadow(truckAt);

  if (heldItem && !heldBehind) drawItem(heldItem);

  for (const d of dust) {
    const k = d.life / d.max;
    const r = d.r * (1 + k * 1.8);
    ctx.globalAlpha = (1 - k) * .75;
    ctx.drawImage(puff, d.x - r, d.y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;

  if (hover?.project && !held && !dialog.open) drawLabel(hover);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(grade, 0, 0, canvas.width, canvas.height);
}

/* ---------- Input ---------- */

function itemAt(px, py, pad) {
  const w = toWorld(px, py);
  let best = null, bestD = Infinity;
  for (const it of items) {
    if (itemInBed(it)) continue;             // loaded items are behind the carrier wall
    const p = worldPos(it);
    const a = -it.body.rotation();
    const dx = w.x - p.x, dy = w.y - p.y;
    const lx = dx * Math.cos(a) - dy * Math.sin(a);
    const ly = dx * Math.sin(a) + dy * Math.cos(a);
    if (Math.abs(lx) > it.sprite.w / 2 + pad || Math.abs(ly) > it.sprite.h / 2 + pad) continue;
    const d = Math.hypot(dx, dy) * (it.project ? .35 : 1);   // projects win close calls
    if (d < bestD) { bestD = d; best = it; }
  }
  return best;
}

const pickable = () => phase === 'idle' && !dialog.open;

function beginHold(it) {
  const p = worldPos(it);
  const w = toWorld(pointer.x, pointer.y);
  held = { item: it, dx: p.x - w.x, dy: p.y - w.y };
  it.body.setGravityScale(0, true);
  it.body.wakeUp();
  canvas.style.cursor = 'grabbing';
  hover = null;
}

function dropHeld() {
  if (!held) return;
  const body = held.item.body;
  body.setGravityScale(1, true);
  const v = body.linvel(), speed = Math.hypot(v.x, v.y);
  if (speed > 10) body.setLinvel({ x: v.x * 10 / speed, y: v.y * 10 / speed }, true);
  held = null;
  canvas.style.cursor = '';
}

function onPointerDown(e) {
  if (e.button !== 0 || held || press || !pickable()) return;
  pointer = { x: e.clientX, y: e.clientY };
  const it = itemAt(e.clientX, e.clientY, e.pointerType === 'touch' ? 14 : 3);
  if (!it) return;
  press = { item: it, x: e.clientX, y: e.clientY, id: e.pointerId };
  canvas.setPointerCapture(e.pointerId);
}

function onPointerMove(e) {
  pointer = { x: e.clientX, y: e.clientY };
  if (press && e.pointerId === press.id && !held) {
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > DRAG_THRESHOLD) beginHold(press.item);
    return;
  }
  if (!held && e.pointerType !== 'touch') {
    hover = pickable() ? itemAt(e.clientX, e.clientY, 3) : null;
    canvas.style.cursor = hover ? 'grab' : '';
  }
}

function onPointerUp(e) {
  if (!press || e.pointerId !== press.id) return;
  if (held) {
    dropHeld();
  } else if (e.type === 'pointerup' && press.item.project) {
    openTag(press.item.project);
  } else if (e.type === 'pointerup') {
    // Filler has no tag, so a click just makes it jump.
    const body = press.item.body;
    body.applyImpulse({ x: (Math.random() - .5) * body.mass() * 2, y: -body.mass() * 2.5 }, true);
  }
  press = null;
}

function openTag(project) {
  document.getElementById('tag-name').textContent = project.name;
  document.getElementById('tag-brief').textContent = project.brief;
  document.getElementById('tag-fields').replaceChildren(...Object.entries(project.fields ?? {}).flatMap(([k, v]) => {
    const dt = document.createElement('dt'); dt.textContent = `${k}:`;
    const dd = document.createElement('dd'); dd.textContent = v;
    return [dt, dd];
  }));
  const visit = document.getElementById('tag-visit');
  visit.hidden = !project.link;
  document.getElementById('tag-novisit').hidden = !!project.link;
  if (project.link) visit.href = project.link;
  dialog.showModal();
}

function buildSortedPile() {
  document.getElementById('sorted-list').replaceChildren(...PROJECTS.map(p => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = p.name;
    b.addEventListener('click', () => openTag(p));
    li.append(b);
    return li;
  }));
}

/* ---------- Layout ---------- */

function placeControls() {
  const screenX = (truckX + view.offX) * view.scale;
  const groundPx = (GROUND - view.offY) * view.scale;
  controls.style.left = `${clamp(screenX, 110, view.vw - 110)}px`;
  // Phones sit it higher, leaving the bottom of the screen for the pedals.
  controls.style.top = `${groundPx + (view.vh - groundPx) * (view.narrow ? .3 : .5)}px`;
}

function repaint() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(view.vw * dpr);
  canvas.height = Math.round(view.vh * dpr);
  bg = paintBackground(view, { ground: GROUND, terrain: terrainY, moundX });
  lip = paintGroundLip(view, bg, GROUND);
  grade = paintGrade(view);
  placeControls();
}

let resizeTimer;
function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const next = computeView();
    if (next.vw === view.vw && next.vh === view.vh) return;
    const rebuild = next.narrow !== view.narrow;
    view = next;
    if (rebuild) {
      hydraulics(false);
      engineStop();
      world.free();
      buildWorld();
      makeCrows();
    } else {
      placeSideWalls();
      if (phase === 'idle') {
        const { min, max } = driveLimits();
        placeTruck(clamp(truckDX, min, max));
      }
      const minX = (-view.offX + 30) / M, maxX = (view.W + view.offX - 30) / M;
      for (const it of items) {
        const t = it.body.translation();
        if (t.x < minX || t.x > maxX) it.body.setTranslation({ x: clamp(t.x, minX, maxX), y: t.y }, true);
      }
    }
    repaint();
    refreshButton();
  }, 140);
}

/* ---------- Main loop ---------- */

let last = 0, bank = 0, nextRefresh = 0;
function frame(now) {
  updateDriveSound(now);
  if (now > nextRefresh) {
    rescueStrays();
    if (phase === 'idle') refreshButton();
    nextRefresh = now + 400;
  }

  const dt = Math.min(.05, (now - last) / 1000 || 0);
  last = now;
  bank += dt;
  let guard = 0;
  while (bank >= STEP && guard++ < 7) { stepSim(); bank -= STEP; }
  if (guard >= 7) bank = 0;

  if (reduceMotion) shake = 0; else shake *= Math.pow(.0015, dt);
  if (shake < .05) shake = 0;

  for (let i = dust.length - 1; i >= 0; i--) {
    const d = dust[i];
    d.life += dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.vy *= 1 - 1.4 * dt;
    if (d.life >= d.max) dust.splice(i, 1);
  }

  render(now);
  requestAnimationFrame(frame);
}

/* ---------- Boot ---------- */

async function boot() {
  await RAPIER.init();
  parts = await loadTruckImages();
  projectImages = await loadProjectImages(PROJECTS);
  puff = makePuff();
  view = computeView();
  buildWorld();
  makeCrows();
  repaint();
  buildSortedPile();

  const muteBtn = document.getElementById('mute');
  const applyMute = value => {
    setMuted(value);
    muteBtn.textContent = value ? 'Sound off' : 'Sound on';
    muteBtn.setAttribute('aria-pressed', String(value));
  };
  try { applyMute(localStorage.getItem('muted') === '1'); } catch { /* storage blocked */ }
  muteBtn.addEventListener('click', () => {
    const value = muteBtn.getAttribute('aria-pressed') !== 'true';
    applyMute(value);
    try { localStorage.setItem('muted', value ? '1' : '0'); } catch { /* storage blocked */ }
  });

  unloadBtn.addEventListener('click', startUnload);
  wireDriveControls();
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseControls();
    pauseSound(document.hidden);
  });
  document.getElementById('tag-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

  refreshButton();

  if (new URLSearchParams(location.search).has('debug')) {
    window.__dump = {
      get phase() { return phase; },
      get tilt() { return tilt; },
      get bed() { return bedCount(); },
      items: () => items.map(it => ({ ...worldPos(it), project: it.project?.name ?? null, w: it.sprite.w, h: it.sprite.h, inBed: itemInBed(it), sleeping: it.body.isSleeping() })),
      toScreen: (x, y) => ({ x: (x + view.offX) * view.scale, y: (y - view.offY) * view.scale }),
      hinge: () => hinge,
      get dx() { return truckDX; },
      get v() { return driveV; },
      get strain() { return straining; },
      limits: () => driveLimits(),
      get audio() { return soundState(); },
    };
  }

  requestAnimationFrame(frame);
}

boot().catch(err => {
  console.error(err);
  unloadBtn.textContent = 'Truck broke down';
  setHint('Something failed to load. Try a refresh.');
});
