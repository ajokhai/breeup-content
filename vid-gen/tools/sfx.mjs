#!/usr/bin/env node
// Synthesize a film's sound effects from its HITS list, so picture and sound can't drift apart.
// No samples, no downloads, no dependencies: every sound is made from sine waves and filtered noise.
//
//   node tools/sfx.mjs films/T2-pay-service-charge [--list]
//
// Reads `const HITS = [[beat, 'label', 'sound', { pitch, len, from, to, n, gain }], ...]` from film.js and the
// grid from beats.json, writes <film>/audio/sfx.wav (48 kHz stereo). tools/mix.mjs mixes it under the voice.
// Sounds: tick pop blip click tok type whoosh thud sub bell impact. pitch is a note name like 'A5'.
import fs from 'node:fs';
import path from 'node:path';

const SR = 48000;
const args = process.argv.slice(2);
const SOUNDS = {};

// ------------------------------------------------------------ building blocks
let seed = 7;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
const note = (n) => {
  if (typeof n === 'number') return n;
  const m = /^([A-G])(#|b)?(\d)$/.exec(n || 'A5');
  const semi = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * 2 ** ((semi + (Number(m[3]) - 4) * 12) / 12);
};
const buf = (sec) => new Float32Array(Math.ceil(sec * SR));
// one-pole filters, run in place
function lowpass(x, hz) { const a = Math.exp(-2 * Math.PI * hz / SR); let y = 0; for (let i = 0; i < x.length; i++) x[i] = y = (1 - a) * x[i] + a * y; return x; }
function highpass(x, hz) { const lp = Float32Array.from(x); lowpass(lp, hz); for (let i = 0; i < x.length; i++) x[i] -= lp[i]; return x; }
function tone(sec, f0, f1, decay, { attack = 0.002, harm = [] } = {}) {
  const x = buf(sec); let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR, f = f1 == null ? f0 : f1 + (f0 - f1) * Math.exp(-t / 0.03);
    ph += 2 * Math.PI * f / SR;
    let v = Math.sin(ph); harm.forEach(([k, g]) => { v += g * Math.sin(ph * k); });
    x[i] = v * Math.min(1, t / attack) * Math.exp(-t / decay);
  }
  return x;
}
function noise(sec, decay, attack = 0.001) { const x = buf(sec); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = rnd() * Math.min(1, t / attack) * Math.exp(-t / decay); } return x; }
const add = (a, b, g = 1) => { for (let i = 0; i < Math.min(a.length, b.length); i++) a[i] += b[i] * g; return a; };
const gain = (a, g) => { for (let i = 0; i < a.length; i++) a[i] *= g; return a; };

// ------------------------------------------------------------ the sounds
SOUNDS.tick = () => add(gain(tone(0.05, 2600, null, 0.008), 0.5), highpass(noise(0.03, 0.004), 3000), 0.3);
SOUNDS.pop = (o) => gain(tone(0.25, note(o.pitch) * 1.6, note(o.pitch), 0.07, { harm: [[2, 0.15]] }), 0.7);
SOUNDS.blip = (o) => gain(tone(0.22, note(o.pitch), null, 0.06, { attack: 0.004, harm: [[2, 0.2], [3, 0.05]] }), 0.45);
SOUNDS.click = () => add(gain(highpass(noise(0.04, 0.005), 2000), 0.6), tone(0.04, 3200, null, 0.004), 0.4);
SOUNDS.tok = (o) => gain(tone(0.12, note(o.pitch), null, 0.025, { harm: [[2.7, 0.3]] }), 0.6);
SOUNDS.type = (o) => {
  const n = o.n || 5, len = o.len || 0.5, x = buf(len + 0.1);
  for (let k = 0; k < n; k++) add(x.subarray(Math.round((k * len / n + rnd() * 0.02 + 0.02) * SR)), SOUNDS.click(), 0.6);
  return x;
};
SOUNDS.whoosh = (o) => {
  const len = o.len || 0.5, from = o.from || 800, to = o.to || 2400, x = buf(len + 0.15);
  // noise through a swept band: lowpass at the sweep, highpass a little below it
  let lp = 0, lp2 = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR, p = Math.min(1, t / len), hz = from * (to / from) ** p;
    const a = Math.exp(-2 * Math.PI * hz / SR), b = Math.exp(-2 * Math.PI * hz * 0.35 / SR);
    const v = rnd(); lp = (1 - a) * v + a * lp; lp2 = (1 - b) * lp + b * lp2;
    const env = Math.sin(Math.PI * Math.min(1, t / (len + 0.1))) ** 1.5;
    x[i] = (lp - lp2) * env * 2.2;
  }
  return x;
};
SOUNDS.thud = () => add(tone(0.4, 140, 55, 0.14), lowpass(noise(0.15, 0.02), 400), 0.6);
SOUNDS.sub = (o) => gain(tone((o.len || 0.8) + 0.3, 90, 42, (o.len || 0.8) * 0.5, { attack: 0.01 }), 0.9);
SOUNDS.bell = (o) => {
  const f = note(o.pitch || 'C6');
  return gain(tone(1.6, f, null, 0.5, { attack: 0.002, harm: [[2.76, 0.35], [5.4, 0.15], [8.93, 0.06]] }), 0.35);
};
SOUNDS.impact = () => add(add(SOUNDS.thud(), SOUNDS.sub({ len: 0.6 }), 0.8), highpass(noise(0.3, 0.06), 1500), 0.25);

if (args.includes('--list')) { console.log(Object.keys(SOUNDS).join(' ')); process.exit(0); }

// ------------------------------------------------------------ place them
const dir = path.resolve(args.find((a) => !a.startsWith('--')) || '');
const src = fs.readFileSync(path.join(dir, 'film.js'), 'utf8');
const m = /const HITS = (\[[\s\S]*?\n\]);/.exec(src);
if (!m) { console.error('No `const HITS = [...];` block in film.js'); process.exit(1); }
const HITS = new Function(`return ${m[1]}`)();
const grid = JSON.parse(fs.readFileSync(path.join(dir, 'beats.json'), 'utf8'));
const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'film.json'), 'utf8'));
const L = buf(cfg.duration), R = buf(cfg.duration);
const unknown = new Set();
for (const [u, , name, o = {}] of HITS) {
  if (!SOUNDS[name]) { unknown.add(name); continue; }
  const s = SOUNDS[name](o), g = o.gain ?? 1, pan = o.pan ?? 0;
  const at = Math.round((grid.offset + u * grid.period) * SR);
  for (let i = 0; i < s.length && at + i < L.length; i++) { L[at + i] += s[i] * g * (1 - Math.max(0, pan)); R[at + i] += s[i] * g * (1 + Math.min(0, pan)); }
}
if (unknown.size) console.warn(`unknown sounds skipped: ${[...unknown].join(', ')} (have: ${Object.keys(SOUNDS).join(' ')})`);

// 16-bit stereo WAV, soft-clipped
const n = L.length, data = Buffer.alloc(n * 4);
for (let i = 0; i < n; i++) {
  data.writeInt16LE(Math.round(Math.tanh(L[i] * 0.8) * 32000), i * 4);
  data.writeInt16LE(Math.round(Math.tanh(R[i] * 0.8) * 32000), i * 4 + 2);
}
const h = Buffer.alloc(44);
h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28);
h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
const out = path.join(dir, 'audio', 'sfx.wav');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.concat([h, data]));
console.log(`${path.relative(process.cwd(), out)}: ${HITS.length - [...unknown].length} sounds`);
