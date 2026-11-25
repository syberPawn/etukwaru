// Splits the physics engine's WebAssembly out of public/truck/vendor/rapier.mjs.
//
// The "compat" build of Rapier carries its WebAssembly inside the script as a
// 3.2 MB base64 string: it barely compresses, has to be decoded on the main
// thread, and only then compiled. Written out as rapier_bg.wasm, it downloads
// smaller, can be preloaded alongside the script, and compiles while it
// streams in (WebAssembly.instantiateStreaming), which the engine's own
// loader already does when it is given a URL.
//
//   node tools/split-rapier.cjs      (once, after updating vendor/rapier.mjs)
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'public', 'truck', 'vendor');
const JS = path.join(DIR, 'rapier.mjs');
const WASM = path.join(DIR, 'rapier_bg.wasm');

let src = fs.readFileSync(JS, 'utf8');
const call = /\{module_or_path:([A-Za-z_$][\w$]*)\.toByteArray\("([A-Za-z0-9+/]+={0,2})"\)\.buffer\}/;
const m = src.match(call);
if (!m) {
  if (src.includes('rapier_bg.wasm')) { console.log('Already split.'); process.exit(0); }
  throw new Error('Could not find the embedded WebAssembly in rapier.mjs');
}
const bytes = Buffer.from(m[2], 'base64');
if (bytes.readUInt32BE(0) !== 0x0061736d) throw new Error('The embedded data is not WebAssembly');
fs.writeFileSync(WASM, bytes);
src = src.replace(call, '{module_or_path:new URL("./rapier_bg.wasm",import.meta.url)}');
fs.writeFileSync(JS, src);
console.log(`Wrote rapier_bg.wasm (${(bytes.length / 1048576).toFixed(2)} MB); rapier.mjs is now ${(src.length / 1048576).toFixed(2)} MB`);
