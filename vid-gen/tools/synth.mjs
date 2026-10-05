// Sound building blocks shared by tools/sfx.mjs (effects) and tools/beat.mjs (music): sine tones, filtered noise,
// one-pole filters and a WAV writer. No samples, no dependencies.
import fs from 'node:fs';
import path from 'node:path';

export const SR = 48000;
let seed = 7;
export const reseed = (s) => { seed = s >>> 0; };
export const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
export const note = (n) => {
  if (typeof n === 'number') return n;
  const m = /^([A-G])(#|b)?(\d)$/.exec(n || 'A5');
  const semi = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * 2 ** ((semi + (Number(m[3]) - 4) * 12) / 12);
};
export const buf = (sec) => new Float32Array(Math.ceil(sec * SR));
// one-pole filters, run in place
export function lowpass(x, hz) { const a = Math.exp(-2 * Math.PI * hz / SR); let y = 0; for (let i = 0; i < x.length; i++) x[i] = y = (1 - a) * x[i] + a * y; return x; }
export function highpass(x, hz) { const lp = Float32Array.from(x); lowpass(lp, hz); for (let i = 0; i < x.length; i++) x[i] -= lp[i]; return x; }
export function tone(sec, f0, f1, decay, { attack = 0.002, harm = [] } = {}) {
  const x = buf(sec); let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR, f = f1 == null ? f0 : f1 + (f0 - f1) * Math.exp(-t / 0.03);
    ph += 2 * Math.PI * f / SR;
    let v = Math.sin(ph); harm.forEach(([k, g]) => { v += g * Math.sin(ph * k); });
    x[i] = v * Math.min(1, t / attack) * Math.exp(-t / decay);
  }
  return x;
}
export function noise(sec, decay, attack = 0.001) { const x = buf(sec); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = rnd() * Math.min(1, t / attack) * Math.exp(-t / decay); } return x; }
export const add = (a, b, g = 1) => { for (let i = 0; i < Math.min(a.length, b.length); i++) a[i] += b[i] * g; return a; };
export const gain = (a, g) => { for (let i = 0; i < a.length; i++) a[i] *= g; return a; };


// 16-bit stereo WAV, soft-clipped
export function writeWav(out, L, R, drive = 0.8) {
  const n = L.length, data = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    data.writeInt16LE(Math.round(Math.tanh(L[i] * drive) * 32000), i * 4);
    data.writeInt16LE(Math.round(Math.tanh(R[i] * drive) * 32000), i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28);
  h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.concat([h, data]));
}
