// All the truck's sounds are synthesised, so there are no audio files to load.
// Browsers only allow audio after a click, so nothing plays until initSound()
// is called from the Unload button.

let ctx = null;
let master = null;
let noiseBuffer = null;
let engineRig = null;
let hydraulicRig = null;
let muted = false;
let lastThud = 0;

const VOLUME = .85;

export function initSound() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = new AudioCtx();
    const limiter = ctx.createDynamicsCompressor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : VOLUME;
    master.connect(limiter);
    limiter.connect(ctx.destination);

    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export const soundState = () => ctx?.state ?? 'none';

/** Silences everything while the tab is hidden, since the animation stops too. */
export function pauseSound(paused) {
  if (!ctx) return;
  if (paused) ctx.suspend();
  else ctx.resume();
}

export function setMuted(value) {
  muted = value;
  if (ctx) master.gain.setTargetAtTime(muted ? 0 : VOLUME, ctx.currentTime, .03);
}

function noiseSource() {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;
  return source;
}

function filter(type, frequency, Q = 1) {
  const node = ctx.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.Q.value = Q;
  return node;
}

function gainNode(value) {
  const node = ctx.createGain();
  node.gain.value = value;
  return node;
}

/* ---------- Diesel engine ---------- */

export function engineStart() {
  if (!ctx || engineRig) return;
  const output = gainNode(0);
  const tone = filter('lowpass', 300, .8);
  const pulse = gainNode(.65);
  const low = ctx.createOscillator();
  const sub = ctx.createOscillator();
  low.type = 'sawtooth';
  sub.type = 'square';
  low.frequency.value = 44;
  sub.frequency.value = 22;

  // The cylinders firing, heard as a fast throb on the volume.
  const firing = ctx.createOscillator();
  firing.type = 'sine';
  firing.frequency.value = 13;
  const firingDepth = gainNode(.35);
  firing.connect(firingDepth);
  firingDepth.connect(pulse.gain);

  const rumble = noiseSource();
  const rumbleBand = filter('bandpass', 130, .7);
  const rumbleGain = gainNode(.5);

  low.connect(pulse);
  sub.connect(pulse);
  rumble.connect(rumbleBand);
  rumbleBand.connect(rumbleGain);
  rumbleGain.connect(pulse);
  pulse.connect(tone);
  tone.connect(output);
  output.connect(master);

  const sources = [low, sub, firing, rumble];
  sources.forEach(s => s.start());
  engineRig = { output, tone, low, sub, firing, sources };
}

/** throttle runs from 0 (idling) to 1 (working hard). */
export function engineThrottle(throttle) {
  if (!engineRig) return;
  const now = ctx.currentTime, r = engineRig;
  const pitch = 40 + throttle * 34;
  r.low.frequency.setTargetAtTime(pitch, now, .25);
  r.sub.frequency.setTargetAtTime(pitch / 2, now, .25);
  r.firing.frequency.setTargetAtTime(11 + throttle * 13, now, .25);
  r.tone.frequency.setTargetAtTime(240 + throttle * 620, now, .25);
  r.output.gain.setTargetAtTime(.3 + throttle * .28, now, .2);
}

export function engineStop() {
  if (!engineRig) return;
  const { output, sources } = engineRig;
  engineRig = null;
  output.gain.setTargetAtTime(0, ctx.currentTime, .22);
  sources.forEach(s => s.stop(ctx.currentTime + 1.2));
}

/* ---------- Hydraulic ram ---------- */

export function hydraulics(on, rising = true, seconds = 2) {
  if (!ctx) return;
  const now = ctx.currentTime;
  if (!on) {
    if (hydraulicRig) {
      const { output, sources } = hydraulicRig;
      hydraulicRig = null;
      output.gain.setTargetAtTime(0, now, .08);
      sources.forEach(s => s.stop(now + .5));
    }
    return;
  }
  hydraulics(false);
  const output = gainNode(0);
  const band = filter('bandpass', rising ? 620 : 480, 1.6);
  const whine = ctx.createOscillator();
  whine.type = 'sawtooth';
  whine.frequency.value = rising ? 92 : 150;
  whine.frequency.linearRampToValueAtTime(rising ? 150 : 84, now + seconds);
  const hiss = noiseSource();
  const hissBand = filter('highpass', 1800, .7);
  const hissGain = gainNode(.1);
  whine.connect(band);
  hiss.connect(hissBand);
  hissBand.connect(hissGain);
  hissGain.connect(band);
  band.connect(output);
  output.connect(master);
  const sources = [whine, hiss];
  sources.forEach(s => s.start());
  output.gain.setTargetAtTime(.3, now, .08);
  hydraulicRig = { output, sources };
}

/* ---------- Reversing beeper ---------- */

export function reverseBeeps(seconds) {
  if (!ctx) return;
  const now = ctx.currentTime;
  const output = gainNode(0);
  const tone = ctx.createOscillator();
  tone.type = 'square';
  tone.frequency.value = 1120;
  tone.connect(output);
  output.connect(master);
  for (let t = 0; t < seconds; t += .52) {
    output.gain.setValueAtTime(.075, now + t);
    output.gain.setValueAtTime(0, now + t + .26);
  }
  tone.start(now);
  tone.stop(now + seconds + .1);
}

/* ---------- Things landing ---------- */

export function thud(force) {
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  if (now - lastThud < .055) return;
  lastThud = now;

  const level = Math.min(.55, .08 + force * .05);
  const output = gainNode(level);
  output.gain.exponentialRampToValueAtTime(.001, now + .2);
  output.connect(master);

  const crunch = noiseSource();
  const crunchTone = filter('lowpass', 300 + Math.random() * 900, .9);
  crunch.connect(crunchTone);
  crunchTone.connect(output);
  crunch.start(now);
  crunch.stop(now + .22);

  const body = ctx.createOscillator();
  body.frequency.value = 95;
  body.frequency.exponentialRampToValueAtTime(42, now + .14);
  body.connect(output);
  body.start(now);
  body.stop(now + .22);
}
