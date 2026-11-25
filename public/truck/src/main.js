import RAPIER from '../vendor/rapier.mjs';
import { PROJECTS, NOTICES } from './projects.js';
import { mulberry, loadProjectImages, makeProjectSprite, makeFillerSprites } from './junk.js';
import { makeScenery, paintGrade } from './scene.js';
import {
  planRoad, planSkyClouds, paintCumulus, paintRoadBlock, paintBillboard, paintBoardFace,
  BLOCK_W, BLOCK_LAMPS, BOARD_W, BOARD_TOP_H, boardScale,
} from './road.js';
import {
  initSound, setMuted, soundState, pauseSound, engineStart, engineThrottle, engineStop,
  hydraulics, reverseBeeps, thud,
} from './sound.js';
import {
  NATIVE, SCALE, MAX_TILT, BED_SHAPES, loadTruckImages,
  applyTruckTransform, drawBedLayers, drawRamLayer, drawChassisLayer, drawWheels, WHEELS,
} from './truck.js';

/* ---------- Constants ---------- */

// Each has a billboard, in this order along the road, and rides in the truck.
const BOARD_ENTRIES = [...PROJECTS, ...NOTICES];

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
const EDGE_GAP = 8;           // the truck stops this far from the screen edge
const LOOK_AHEAD = .5;        // seconds of driving the camera looks ahead
const DRAG_THRESHOLD = 7;     // px of travel before a press becomes a drag
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d', { alpha: false });
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

const toWorld = (px, py) => ({ x: px / view.scale - view.offX + camX, y: py / view.scale + view.offY });

// The part of the world on screen, left to right.
const onScreen = () => ({ left: camX - view.offX, right: camX + view.W + view.offX });

/* ---------- State ---------- */

let view, world, parts, projectImages, scenery, grade;
let items = [], truckBody, bedBody, gateCollider, rightWall, blockWall;
let road, roadBlock;
let boards = [], hoverBoard = null;
let boardSize = 1;      // small screens get bigger boards, so they stay readable
let truckX, truckDX = 0, travel, moundX, hinge;
let camX = 0;   // how far the camera has followed the truck, never right of the dump
let cycleFrom = 0, cycleTravel = 0;
let driveDir = 0, driveV = 0, straining = false, wheelRoll = 0;
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
  const pts = [(moundX - 200) / M, GROUND / M];
  for (let x = moundX; x <= view.W + 300; x += 16) pts.push(x / M, terrainY(x) / M);
  pts.push((view.W + 300) / M, (terrainY(view.W + 300) - 1500) / M);
  world.createCollider(RAPIER.ColliderDesc.polyline(new Float32Array(pts)).setFriction(.6), ground);
  // Solid ground everywhere below the line, however far the truck drives.
  world.createCollider(
    RAPIER.ColliderDesc.halfspace({ x: 0, y: -1 }).setTranslation(0, GROUND / M).setFriction(.6),
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

  // An invisible wall at the right edge, past the dump. The left is open road.
  rightWall = world.createCollider(RAPIER.ColliderDesc.cuboid(.5, 40));
  placeSideWall();
  // The road block at the far end of the road.
  blockWall = world.createCollider(RAPIER.ColliderDesc.cuboid(2, 40));
  placeRoadBlock();
}

/** World x of the road block's nearest cone, where the truck has to stop. */
const blockRight = () => truckX - road.end - NOSE - EDGE_GAP;

function placeRoadBlock() {
  blockWall.setTranslation({ x: blockRight() / M - 2, y: 0 });
}

function placeSideWall() {
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
  const projects = BOARD_ENTRIES.map(project => ({ sprite: makeProjectSprite(project, rng, projectImages.get(project)), project }));

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
  camX = 0;
  wheelRoll = 0;
  driveV = 0;
  straining = false;
  hinge = {
    x: truckX + (NATIVE.hinge.x - NATIVE.centerX) * SCALE,
    y: GROUND + (NATIVE.hinge.y - NATIVE.groundY) * SCALE,
  };
  phase = 'idle'; phaseT = 0; tilt = 0; held = null; press = null; hover = null; hoverBoard = null;
  road = planRoad(view, BOARD_ENTRIES.length);
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
  for (const id of ['go-forward', 'go-backward']) document.getElementById(id).disabled = phase !== 'idle';
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
  releaseControls();
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
    min: -road.end,
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
  const going = dir !== 0;

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

/** Follows the truck once it leaves the dump, looking ahead the way it's going. */
function updateCamera(dt) {
  let target = Math.min(0, truckDX + driveV * LOOK_AHEAD);
  // Near the end, look far enough ahead to show the whole road block.
  const showBlock = blockRight() - BLOCK_W - 50 + view.offX;
  const short = target - showBlock;
  if (short > 0) target -= short * clamp(1 - (short - 500) / 600, 0, 1);
  camX += (target - camX) * (1 - Math.exp(-dt * 4));
  if (Math.abs(target - camX) < .05) camX = target;
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
  setArrow('forward', false);
  setArrow('backward', false);
}

function wireDriveControls() {
  // Holding an arrow drives. Each button tracks its own finger, so two thumbs work.
  for (const [id, name] of [['go-forward', 'forward'], ['go-backward', 'backward']]) {
    const button = document.getElementById(id);
    const release = () => setArrow(name, false);
    button.addEventListener('pointerdown', e => {
      if (e.button !== 0 || button.disabled) return;
      initSound();
      button.setPointerCapture(e.pointerId);
      setArrow(name, true);
    });
    button.addEventListener('pointerup', () => { initSound(); release(); });
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    button.addEventListener('contextmenu', e => e.preventDefault());
  }

  const keyAction = {
    ArrowLeft: down => setArrow('forward', down),
    ArrowRight: down => setArrow('backward', down),
  };
  addEventListener('keydown', e => {
    const action = keyAction[e.key];
    if (!action || dialog.open) return;
    e.preventDefault();
    if (e.repeat || phase !== 'idle') return;
    initSound();
    action(true);
  });
  addEventListener('keyup', e => keyAction[e.key]?.(false));
  addEventListener('blur', releaseControls);
}

let lastDriven = 0, nextEngineUpdate = 0, nextBeep = 0;

function updateDriveSound(now) {
  if (phase !== 'idle') return;
  const active = driveDir !== 0 || Math.abs(driveV) > 2;
  if (!active) {
    if (now - lastDriven > 900) engineStop();
    return;
  }
  lastDriven = now;
  engineStart();
  if (now > nextEngineUpdate) {
    const pace = Math.min(1, Math.abs(driveV) / TOP_SPEED.forward);
    engineThrottle(straining ? 1 : driveDir !== 0 ? .4 + pace * .55 : .15 + pace * .3);
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
  const maxX = view.W + view.offX - 30;
  for (const it of items) {
    if (it === held?.item) continue;
    const p = worldPos(it);
    if (p.x <= view.W + view.offX + 60 && p.y <= GROUND + 60) continue;
    it.body.setTranslation({ x: Math.min(p.x, maxX - 60) / M, y: (GROUND - 520) / M }, true);
    it.body.setLinvel({ x: 0, y: 0 }, true);
    it.body.setAngvel(0, true);
    it.lastV = { x: 0, y: 0 };
  }
}


function stepSim() {
  updateTruck(STEP);
  updateDrive(STEP);
  updateCamera(STEP);

  if (held) {
    const body = held.item.body;
    const t = body.translation();
    const target = toWorld(pointer.x, pointer.y);
    const { left, right } = onScreen();
    const tx = clamp(target.x + held.dx, Math.max(left, blockRight()) + 20, right - 20) / M;
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

/* ---------- Billboards and the road block ---------- */

/** Where each billboard is this frame, in world units. */
function poseBoards() {
  const { left, right } = onScreen();
  for (const b of boards) {
    const k = b.size * boardSize;                    // world units per unit of its picture
    const w = b.art.w * k, h = b.art.h * k;
    const x = b.worldX - w / 2;
    b.pose = {
      x, y: b.groundY - h, w, h, k,
      onScreen: x + w > left && x < right,
      near: x + w > left - view.visW * .5 && x < right + view.visW * .5,
    };
  }
}

/**
 * Pictures and videos load only as their board comes near, so the page
 * itself stays light. Videos play only while their board is on screen.
 */
function updateBoardMedia() {
  for (const b of boards) {
    const { near, onScreen: visible } = b.pose;
    const src = b.entry.board;
    if (near && src.image && !b.media.image) {
      const img = new Image();
      img.decoding = 'async';
      img.src = src.image;
      b.media.image = img;
    }
    if (!src.video || reduceMotion) continue;
    if (near && !b.media.video) {
      const v = document.createElement('video');
      v.muted = true;
      v.defaultMuted = true;
      v.loop = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.src = src.video;
      b.media.video = v;
    }
    const v = b.media.video;
    if (!v) continue;
    if (visible && !document.hidden && v.paused) v.play().catch(() => {});
    else if ((!visible || document.hidden) && !v.paused) v.pause();
  }
}

/** What shows on a board right now: its video, its picture, or its painted face. */
function boardFace(b) {
  const { video, image, painted } = b.media;
  if (video && !video.paused && video.readyState >= 2) return video;
  if (image?.complete && image.naturalWidth) return image;
  return painted ?? null;
}

function drawBoards(t) {
  for (const b of boards) {
    if (!b.pose.onScreen) continue;
    const { x, y, w, h, k } = b.pose;
    ctx.save();
    // Old boards lean a touch, pivoting on their feet.
    ctx.translate(x + w / 2, y + h);
    ctx.rotate(b.lean);
    ctx.translate(-(x + w / 2), -(y + h));

    const sc = b.art.screen;
    const sx = x + sc.x * k, sy = y + sc.y * k, sw = sc.w * k, sh = sc.h * k;
    ctx.drawImage(b.art.canvas, x, y, w, h);
    const face = boardFace(b);
    const live = face?.tagName === 'VIDEO';
    if (live) {
      // A lit screen: it glows out over its frame and lights the dirt below.
      const px = k * view.scale * (canvas.width / view.vw);   // device pixels per unit
      const spill = ctx.createRadialGradient(sx + sw / 2, b.groundY, 0, sx + sw / 2, b.groundY, sw * .7);
      spill.addColorStop(0, 'rgba(215,240,225,.16)');
      spill.addColorStop(1, 'rgba(215,240,225,0)');
      ctx.fillStyle = spill;
      ctx.fillRect(sx - sw * .2, b.groundY - sw * .7, sw * 1.4, sw * .9);
      ctx.save();
      ctx.shadowColor = 'rgba(225,245,235,.7)';
      ctx.shadowBlur = 34 * px;
      ctx.fillStyle = '#0d0f0e';
      ctx.fillRect(sx, sy, sw, sh);
      ctx.restore();
      ctx.drawImage(face, sx, sy, sw, sh);
    } else {
      if (face) ctx.drawImage(face.canvas ?? face, sx, sy, sw, sh);
      else {
        ctx.fillStyle = '#1d1b17';
        ctx.fillRect(sx, sy, sw, sh);
      }
      // Printed and out in the weather, so a touch duller than a screen.
      ctx.fillStyle = 'rgba(70,58,40,.14)';
      ctx.fillRect(sx, sy, sw, sh);
    }

    // Lamp light washing down the face. Pointed at, every lamp comes on full.
    const hovered = b === hoverBoard;
    b.art.lamps.forEach((l, i) => {
      const state = b.lampStates[i];
      // A lit screen needs no floodlights.
      let on = hovered ? 1 : live || state === 'off' ? 0 : .55;
      if (state === 'flicker' && !hovered && !reduceMotion) {
        on *= Math.sin(t * 23 + i) > -.35 && Math.sin(t * 3.1 + i * 2) > -.8 ? 1 : .15;
      }
      const lx = x + l.x * k, ly = y + l.y * k;
      if (on > 0) {
        const pool = ctx.createRadialGradient(lx, ly, 0, lx, ly + sh * .25, sh * .75);
        pool.addColorStop(0, `rgba(255,226,160,${.42 * on})`);
        pool.addColorStop(1, 'rgba(255,226,160,0)');
        ctx.fillStyle = pool;
        ctx.fillRect(lx - sh * .75, ly, sh * 1.5, sh * 1.05);
      }
      // the lens itself
      ctx.fillStyle = on > .3 ? `rgba(255,236,190,${.5 + on * .5})` : '#5a564d';
      ctx.fillRect(lx - 10 * k, ly - 1.5 * k, 20 * k, 3 * k);
    });

    // Boards set back from the road sit further into the haze.
    if (b.back) {
      ctx.fillStyle = 'rgba(150,141,118,.26)';
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  }
}

/** The billboard under a screen point, nearest first. */
function boardAt(px, py, pad) {
  const p = toWorld(px, py);
  for (let i = boards.length - 1; i >= 0; i--) {
    const b = boards[i];
    if (!b.pose?.onScreen) continue;
    const { x, y, k } = b.pose;
    const x0 = x + 10 * k - pad, x1 = x + (10 + BOARD_W) * k + pad;
    const y0 = y + 30 * k - pad, y1 = y + (BOARD_TOP_H - 10) * k + pad;
    if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) return b;
  }
  return null;
}

function drawRoadBlock(t) {
  const x0 = blockRight() - BLOCK_W;
  const { left, right } = onScreen();
  if (x0 > right || x0 + BLOCK_W < left) return;
  const y0 = GROUND + 2 - roadBlock.h;
  ctx.drawImage(roadBlock.canvas, x0, y0, roadBlock.w, roadBlock.h);
  // Warning lamps, blinking in turn
  BLOCK_LAMPS.forEach(([lx, ly], i) => {
    const on = reduceMotion || Math.floor(t * 1.6 + i) % 2 === 0;
    const x = x0 + lx, y = GROUND - ly;
    ctx.fillStyle = '#2a2622';
    ctx.fillRect(x - 6, y + 4, 12, 10);
    ctx.fillStyle = on ? '#ffb72e' : '#6b4a1a';
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    if (on) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 46);
      glow.addColorStop(0, 'rgba(255,190,60,.55)');
      glow.addColorStop(1, 'rgba(255,190,60,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 46, y - 46, 92, 92);
    }
  });
}

function drawLabel(it) {
  const p = worldPos(it);
  const text = it.project.name;
  ctx.font = '700 17px "Courier New", monospace';
  const w = ctx.measureText(text).width + 18;
  const { left, right } = onScreen();
  const x = clamp(p.x, left + w / 2 + 6, right - w / 2 - 6);
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

  const ox = Math.round(sx * dpr), oy = Math.round(sy * dpr);
  scenery.drawBack(ctx, camX, ox, oy);

  const s = view.scale * dpr;
  const worldSpace = () => ctx.setTransform(s, 0, 0, s, (view.offX - camX) * s + ox, -view.offY * s + oy);
  worldSpace();

  drawCrows(t);
  poseBoards();
  updateBoardMedia();
  drawBoards(t);
  drawRoadBlock(t);

  const truckAt = truckX + truckDX;
  const driving = phase === 'reverse' || phase === 'pour' || driveV !== 0;
  const running = (phase !== 'idle' || driveDir !== 0 || driveV !== 0) && !reduceMotion;
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

  scenery.drawLip(ctx, camX, ox, oy);
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
  const pad = e.pointerType === 'touch' ? 14 : 3;
  const it = itemAt(e.clientX, e.clientY, pad);
  const board = it ? null : boardAt(e.clientX, e.clientY, pad);
  if (!it && !board) return;
  press = { item: it, board, x: e.clientX, y: e.clientY, id: e.pointerId };
  canvas.setPointerCapture(e.pointerId);
}

function onPointerMove(e) {
  pointer = { x: e.clientX, y: e.clientY };
  if (press && e.pointerId === press.id && !held) {
    if (press.board) return;
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > DRAG_THRESHOLD) beginHold(press.item);
    return;
  }
  if (!held && e.pointerType !== 'touch') {
    hover = pickable() ? itemAt(e.clientX, e.clientY, 3) : null;
    hoverBoard = pickable() && !hover ? boardAt(e.clientX, e.clientY, 3) : null;
    canvas.style.cursor = hover ? 'grab' : hoverBoard ? 'pointer' : '';
  }
}

function onPointerUp(e) {
  if (!press || e.pointerId !== press.id) return;
  if (held) {
    dropHeld();
  } else if (press.board) {
    if (e.type === 'pointerup' && boardAt(e.clientX, e.clientY, 20) === press.board) openTag(press.board.entry);
  } else if (e.type === 'pointerup' && press.item.project) {
    openTag(press.item.project);
  } else if (e.type === 'pointerup') {
    // Filler has no tag, so a click just makes it jump.
    const body = press.item.body;
    body.applyImpulse({ x: (Math.random() - .5) * body.mass() * 2, y: -body.mass() * 2.5 }, true);
  }
  press = null;
}

// Only web and email addresses become links.
const webLink = url => (typeof url === 'string' && /^(https?:\/\/|mailto:)/i.test(url) ? url : null);

function makeLink(url, text, className) {
  const a = document.createElement('a');
  a.href = url;
  a.textContent = text;
  if (className) a.className = className;
  if (!url.startsWith('mailto:')) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }
  return a;
}

/** A brief is one paragraph or a list of them. */
const paragraphs = brief => (Array.isArray(brief) ? brief : [brief]);

/** Fills a node with text and links: a string, { text, url }, or a list of both. */
function fillRich(node, content) {
  for (const part of [content].flat()) {
    if (typeof part === 'string') node.append(part);
    else if (part && webLink(part.url)) node.append(makeLink(part.url, part.text));
    else if (part?.text) node.append(part.text);
  }
  return node;
}

/**
 * A button that copies text, for when a mail link has no mail app to open.
 * It says so when it's done, and shows the text itself if copying isn't allowed.
 */
function copyButton(label, text, className) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = label;
  const status = document.getElementById('tag-status');
  b.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      b.textContent = 'Copied';
      status.textContent = `${text} copied`;
    } catch {
      b.textContent = text;
      status.textContent = text;
    }
    setTimeout(() => { b.textContent = label; }, 2200);
  });
  return b;
}

function openTag(project) {
  // Projects get a salvage record with a number; everything else a notice.
  document.getElementById('tag-form').textContent = project.form ?? 'Salvage record · Form WD-27';
  document.getElementById('tag-number').hidden = !project.number;
  document.getElementById('tag-file').textContent = project.number ?? '';
  document.getElementById('tag-name').textContent = project.name;
  document.getElementById('tag-brief').replaceChildren(...paragraphs(project.brief).map(para => fillRich(document.createElement('p'), para)));
  const rows = { ...(project.filed && { Filed: project.filed }), ...project.fields };
  document.getElementById('tag-fields').replaceChildren(...Object.entries(rows).flatMap(([k, v]) => {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = fillRich(document.createElement('dd'), v);
    return [dt, dd];
  }));
  if (project.team?.length) {
    const dt = document.createElement('dt'); dt.textContent = 'Team';
    const dd = document.createElement('dd');
    project.team.forEach((m, i) => {
      if (i) dd.append(', ');
      const url = webLink(m.linkedin);
      dd.append(url ? makeLink(url, m.name) : m.name);
    });
    document.getElementById('tag-fields').append(dt, dd);
  }

  const links = (project.links ?? []).filter(l => l.copy || webLink(l.url));
  document.getElementById('tag-links').replaceChildren(...links.map((l, i) => {
    const className = i ? 'paper-btn' : 'paper-btn is-main';
    if (l.copy) return copyButton(l.label, l.copy, className);
    const a = makeLink(l.url, l.label, className);
    if (!l.url.startsWith('mailto:')) {
      const arrow = document.createElement('span');
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = ' ↗';
      a.append(arrow);
    }
    return a;
  }));

  const released = links.some(l => l.url && /^visit/i.test(l.label));
  const stamp = document.getElementById('tag-stamp');
  stamp.textContent = project.stamp ?? (released ? 'Released' : 'Awaiting release');
  stamp.classList.toggle('is-pending', !released && !project.stamp);
  dialog.showModal();
}

/**
 * The text version of the page, from the same entries as the billboards:
 * headings, text, details and links, plus a button to open each record.
 */
function buildTextVersion() {
  const el = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  // About first: it introduces the rest.
  const about = BOARD_ENTRIES.find(e => e.id === 'about');
  const order = [about, ...BOARD_ENTRIES.filter(e => e !== about)].filter(Boolean);
  document.getElementById('text-entries').replaceChildren(...order.map(entry => {
    const section = el('section');
    section.setAttribute('aria-labelledby', `text-${entry.id}`);
    const h2 = el('h2', entry === about ? 'About' : entry.name);
    h2.id = `text-${entry.id}`;
    section.append(h2, ...paragraphs(entry.brief).map(para => fillRich(el('p'), para)));
    const rows = { ...(entry.filed && { Filed: entry.filed }), ...entry.fields };
    if (entry.team?.length) {
      rows.Team = entry.team.flatMap((m, i) => [...(i ? [', '] : []), m.linkedin ? { text: m.name, url: m.linkedin } : m.name]);
    }
    if (Object.keys(rows).length) {
      const dl = el('dl');
      for (const [k, v] of Object.entries(rows)) dl.append(el('dt', k), fillRich(el('dd'), v));
      section.append(dl);
    }
    const ul = el('ul', null, 'text-links');
    for (const l of entry.links ?? []) {
      if (!webLink(l.url)) continue;
      const li = el('li');
      li.append(makeLink(l.url, l.label));
      ul.append(li);
    }
    const li = el('li');
    const open = el('button', 'Open the record');
    open.type = 'button';
    open.addEventListener('click', () => openTag(entry));
    li.append(open);
    ul.append(li);
    section.append(ul);
    return section;
  }));
}

/* ---------- Layout ---------- */

function placeControls() {
  if (view.narrow) {
    // Phones put it in the thumb row, between the two arrows.
    const pad = document.getElementById('go-forward').getBoundingClientRect();
    controls.style.left = `${view.vw / 2}px`;
    controls.style.top = `${pad.top + pad.height / 2}px`;
    return;
  }
  const screenX = (truckX + view.offX) * view.scale;
  const groundPx = (GROUND - view.offY) * view.scale;
  controls.style.left = `${clamp(screenX, 110, view.vw - 110)}px`;
  controls.style.top = `${groundPx + (view.vh - groundPx) * .5}px`;
}

/** Runs a small job when the browser has a spare moment. */
const whenIdle = job => (window.requestIdleCallback ? requestIdleCallback(job, { timeout: 1500 }) : setTimeout(job, 60));
let repaintToken = 0;

function repaint() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(view.vw * dpr);
  canvas.height = Math.round(view.vh * dpr);
  // Pictures are painted at the size they are shown.
  const s = view.scale * Math.min(devicePixelRatio || 1, 2);
  roadBlock = paintRoadBlock(s);
  hoverBoard = null;
  for (const b of boards) b.media.video?.pause();
  boardSize = boardScale(view);
  // Legs short enough that the whole board fits under the top of the screen.
  const room = GROUND - view.offY - 24;
  const S = view.visW;
  boards = road.boards.map((p, i) => {
    const entry = BOARD_ENTRIES[i];
    const k = p.size * boardSize;
    const legs = clamp(300 + p.lift * 120, 110, room / k - BOARD_TOP_H);
    const old = boards.find(b => b.entry === entry);
    const face = entry.board.face;
    return {
      entry, back: p.back, size: p.size, lean: p.lean,
      // Most lamps work. One in a while flickers, and the odd one is dead.
      lampStates: [0, 1, 2].map(j => {
        const r = mulberry(p.seed + j)();
        return r < .12 ? 'off' : r < .3 ? 'flicker' : 'on';
      }),
      worldX: .55 * S - view.offX - p.D,
      groundY: p.back ? GROUND - 30 : GROUND - 4,
      art: paintBillboard(entry.board.caption ?? entry.name, legs, p.seed, s * k, p.mono),
      media: {
        image: old?.media.image, video: old?.media.video,
        painted: face ? paintBoardFace(face, entry.board, s * k) : null,
      },
    };
  }).sort((a, b) => b.back - a.back);   // set-back boards drawn first, behind

  // Background clouds are painted pixel by pixel, which is slow, so they are
  // painted one at a time in idle moments after the scene is already up.
  const clouds = [];
  const token = ++repaintToken;
  const pending = planSkyClouds(view, road.end, view.offY + 20, GROUND - 230);
  const paintNext = () => {
    if (token !== repaintToken || !pending.length) return;
    const c = pending.shift();
    clouds.push({ ...c, sprite: paintCumulus(c.seed, c.w, c.w * .5, s) });
    whenIdle(paintNext);
  };
  whenIdle(paintNext);
  scenery = makeScenery(view, { ground: GROUND, terrain: terrainY, moundX, clouds });
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
      placeSideWall();
      road = planRoad(view, BOARD_ENTRIES.length);
      placeRoadBlock();
      if (phase === 'idle') {
        const { min, max } = driveLimits();
        placeTruck(clamp(truckDX, min, max));
      }
      const maxX = (view.W + view.offX - 30) / M;
      for (const it of items) {
        const t = it.body.translation();
        if (t.x > maxX) it.body.setTranslation({ x: maxX, y: t.y }, true);
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
  // The engine and the pictures load at the same time.
  [, parts, projectImages] = await Promise.all([RAPIER.init(), loadTruckImages(), loadProjectImages(BOARD_ENTRIES)]);
  puff = makePuff();
  view = computeView();
  buildWorld();
  makeCrows();
  repaint();
  buildTextVersion();

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
    if (document.hidden) {
      releaseControls();
      for (const b of boards) b.media.video?.pause();
    }
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
      toScreen: (x, y) => ({ x: (x + view.offX - camX) * view.scale, y: (y - view.offY) * view.scale }),
      get camX() { return camX; },
      road: () => ({ ...road, block: blockRight() }),
      boards: () => boards.map(b => ({
        id: b.entry.id, ...b.pose,
        face: boardFace(b)?.tagName ?? (b.media.painted ? 'painted' : null),
      })),
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
