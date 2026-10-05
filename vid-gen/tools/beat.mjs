#!/usr/bin/env node
// Original music made in code, on the film's own beat grid: free, instant, and always in time with the cuts.
// Drums, bass, keys and a pad from sine waves and noise (tools/synth.mjs); no samples, no downloads, no API.
//
//   node tools/beat.mjs films/W2-linear-lcxi            reads film.json "score" and "duration", writes audio/music.wav
//   node tools/beat.mjs --bpm 112 --mood pro --seconds 30 --out x.wav
//
// film.json "score": { bpm, mood: 'upbeat'|'pro'|'calm'|'afro', groove, drop, end } (seconds, written by the studio's
// launch films). The shape: a filtered intro, the groove from `groove` (the first screen), a riser and a half-beat gap
// into the drop on `drop` (the hero word), then from `end` (the end card) the drums stop and the home chord rings out.
// Without a score: two bars of intro, the groove, two bars of ending. Same inputs, same file (seeded).
import fs from 'node:fs';
import path from 'node:path';
import { SR, rnd, reseed, buf, lowpass, highpass, tone, noise, add, gain, writeWav } from './synth.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const dir = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const cfg = dir ? JSON.parse(fs.readFileSync(path.join(dir, 'film.json'), 'utf8')) : {};
const sc = cfg.score || {};
const bpm = Number(opt('--bpm', sc.bpm || 112)), mood = opt('--mood', sc.mood || 'upbeat'), dur = Number(opt('--seconds', cfg.duration || 30));
const out = opt('--out', dir ? path.join(dir, 'audio', 'music.wav') : null);
if (!out || !(dur > 0)) { console.log('usage: node tools/beat.mjs <film> | --bpm 112 --mood upbeat|pro|calm|afro --seconds 30 --out x.wav'); process.exit(1); }
const beat = 60 / bpm, bar = 4 * beat;
const end = Math.min(dur, sc.end ?? Math.max(bar, Math.floor((dur - 2 * bar) / bar) * bar));
const groove = Math.min(end, sc.groove ?? Math.min(2 * bar, Math.floor(dur * 0.15 / bar) * bar));
const drop = sc.drop != null && sc.drop > groove && sc.drop < end ? sc.drop : null;
reseed(bpm * 7 + dur * 13);

// ------------------------------------------------------------ the songs: chords per bar (MIDI), bass roots, patterns
// positions are in beats within the bar; the progression restarts on the groove, so the drop lands on a strong chord
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const SONGS = {
  upbeat: { pad: [[55, 60, 64, 67], [55, 59, 62, 67], [57, 60, 64, 69], [57, 60, 65, 69]], root: [36, 43, 45, 41], // C G Am F
    kick: [0, 1, 2, 3], clap: [1, 3], hats: 16, open: true, bass: { kind: 'saw', at: [0.5, 1.5, 2.5, 3.5], len: 0.4 }, keys: 'arp16', stabs: true, duck: 0.6, swing: 0 },
  pro: { pad: [[57, 60, 64, 69], [57, 60, 65, 69], [55, 60, 64, 67], [55, 59, 62, 67]], root: [45, 41, 48, 43], // Am F C G
    kick: [0, 1.75, 2.5], clap: [1, 3], hats: 8, open: false, bass: { kind: 'saw', at: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], len: 0.35 }, keys: 'arp8', stabs: false, duck: 0.4, swing: 0 },
  calm: { pad: [[53, 57, 60, 64], [55, 57, 60, 64], [57, 60, 62, 65], [55, 59, 64, 67]], root: [41, 45, 38, 36], // Fmaj7 Am7 Dm7 Cmaj7
    kick: [0, 2.5], rim: [1, 3], shaker: 8, bass: { kind: 'sine', at: [0, 2.5], len: [2.2, 1.4] }, keys: 'ep', stabs: false, duck: 0.25, swing: 0 },
  afro: { pad: [[55, 59, 60, 64], [57, 60, 64, 65], [53, 57, 59, 64], [55, 59, 62, 64]], root: [45, 38, 43, 36], // Am9 Dm9 G13 Cmaj9
    kick: [0, 1, 2, 3], rim: [0.75, 2.5, 3.75], shaker: 16, bass: { kind: 'log', at: [0, 1.5, 2.25, 3], up: [0, 0, 7, 0], len: 0.5 }, keys: 'amapiano', stabs: false, duck: 0.35, swing: 0.28 },
};
const S = SONGS[mood] || SONGS.upbeat;
const barOf = (t) => Math.floor((t - groove + 1e-6) / bar), chord = (t) => (t >= end ? 0 : ((barOf(t) % 4) + 4) % 4);
const section = (t) => t < groove ? 'intro' : t >= end ? 'outro' : drop != null && t >= drop ? 'drop' : 'groove';
const gap = (t) => drop != null && t >= drop - beat / 2 && t < drop;   // the breath before the drop

// ------------------------------------------------------------ instruments (mono buffers)
const kick = () => add(tone(0.42, 165, 48, 0.17, { attack: 0.001 }), highpass(noise(0.012, 0.003), 2500), 0.35);
const clap = () => { const x = buf(0.3); for (const d of [0, 0.011, 0.023]) add(x.subarray(Math.round(d * SR)), noise(0.02, 0.006), 0.7); add(x.subarray(Math.round(0.03 * SR)), noise(0.25, 0.07), 0.6); return lowpass(highpass(x, 900), 5200); };
const hat = (open) => gain(highpass(highpass(noise(open ? 0.32 : 0.06, open ? 0.09 : 0.013), 7000), 7000), open ? 0.32 : 0.28);
const shaker = () => gain(highpass(noise(0.08, 0.035, 0.012), 5200), 0.3);
const rim = () => add(gain(tone(0.07, 1750, null, 0.011), 0.45), highpass(noise(0.03, 0.005), 3000), 0.35);
const crash = () => add(gain(highpass(noise(1.8, 0.55), 5000), 0.45), gain(tone(1.8, 3300, null, 0.4, { harm: [[1.41, 0.6], [2.13, 0.4]] }), 0.04));
function saw(sec, f, cutoff, decay, attack = 0.004) {   // a plucky saw through two one-pole lowpasses, plus a sine sub
  const x = buf(sec); let ph = 0, s = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR; ph = (ph + f / SR) % 1; s += 2 * Math.PI * f / SR;
    x[i] = ((2 * ph - 1) * 0.6 + Math.sin(s) * 0.7) * Math.min(1, t / attack) * Math.exp(-t / decay) * Math.min(1, (sec - t) / 0.02);
  }
  return lowpass(lowpass(x, cutoff), cutoff * 1.5);
}
const sub = (sec, f) => tone(sec + 0.2, f, null, sec * 0.7, { attack: 0.01, harm: [[2, 0.25]] });
const logDrum = (f) => { const x = tone(0.6, f * 2.1, f, 0.22, { attack: 0.002, harm: [[2, 0.35], [3, 0.12]] }); for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * 2.2) * 0.6; return x; };
const pluck = (f, decay = 0.22) => gain(lowpass(tone(decay * 4, f, null, decay, { attack: 0.002, harm: [[2, 0.5], [3, 0.28], [4, 0.14], [5, 0.07]] }), 4200), 0.26);
const ep = (f, len) => { const x = tone(len + 0.6, f, null, 0.9, { attack: 0.004, harm: [[2, 0.28], [3, 0.06], [7, 0.02]] }); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] *= (1 + 0.18 * Math.sin(2 * Math.PI * 4.5 * t)) * (t > len ? Math.exp(-(t - len) / 0.15) : 1); } return gain(x, 0.2); };
function riser(len) {   // noise swept up a filter, swelling, cut clean at the end
  const x = buf(len); let lp = 0, lp2 = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR, p = t / len, hzc = 300 * (9000 / 300) ** p, a = Math.exp(-2 * Math.PI * hzc / SR), b = Math.exp(-2 * Math.PI * hzc * 0.3 / SR);
    lp = (1 - a) * rnd() + a * lp; lp2 = (1 - b) * lp + b * lp2;
    x[i] = (lp - lp2) * p ** 2.2 * 1.6;
  }
  return x;
}

// ------------------------------------------------------------ arrange
const n = Math.ceil(dur * SR) + SR;   // a second of tail; trimmed at the end
const dL = new Float32Array(n), dR = new Float32Array(n), mL = new Float32Array(n), mR = new Float32Array(n), duck = new Float32Array(n).fill(1);
const put = (L, R, x, t, g = 1, pan = 0) => {
  const at = Math.round(t * SR); if (at < 0) return;
  for (let i = 0; i < x.length && at + i < n; i++) { L[at + i] += x[i] * g * (1 - Math.max(0, pan)); R[at + i] += x[i] * g * (1 + Math.min(0, pan)); }
};
const drum = (x, t, g, pan) => put(dL, dR, x, t, g, pan), mus = (x, t, g, pan) => put(mL, mR, x, t, g, pan);
const sixteenth = beat / 4, steps = Math.ceil(dur / sixteenth);
const has = (list, pos) => (list || []).some((p) => Math.abs(p - pos) < 1e-6);
let arp = 0;
for (let k = 0; k < steps; k++) {
  const pos = (k % 16) / 4, sw = k % 2 ? S.swing * sixteenth : 0, t = k * sixteenth + sw;
  const sec = section(t); if (gap(t) || t >= dur) continue;
  const full = sec === 'groove' || sec === 'drop', hot = sec === 'drop', c = chord(t), notes = S.pad[c];
  if (sec === 'outro') continue;   // the ending is the ringing chord below
  // drums
  if (full && has(S.kick, pos)) {
    drum(kick(), t, mood === 'calm' ? 0.6 : 0.9);
    const at = Math.round(t * SR); for (let i = 0; i < 0.25 * SR && at + i < n; i++) duck[at + i] = Math.min(duck[at + i], 1 - S.duck * Math.exp(-i / SR / 0.09));
  }
  if (full && has(S.clap, pos)) drum(clap(), t, hot ? 0.7 : 0.55, 0.05);
  if (full && has(S.rim, pos)) drum(rim(), t, 0.5, -0.2);
  if (S.hats && (full || pos % 1 === 0.5) && k % (16 / S.hats) === 0) drum(hat(false), t, (pos % 1 === 0.5 ? 1 : 0.55) * (full ? 1 : 0.6), 0.25);
  if (S.open && hot && pos % 1 === 0.5) drum(hat(true), t, 0.7, -0.25);
  if (S.shaker && k % (16 / S.shaker) === 0) drum(shaker(), t, (k % 4 === 2 ? 1 : 0.6) * (full ? 1 : 0.7), 0.3);
  // bass
  const B = S.bass, bi = (B.at || []).findIndex((p) => Math.abs(p - pos) < 1e-6);
  if (full && bi >= 0) {
    const f = hz(S.root[c] + (B.up?.[bi] || 0)), len = (Array.isArray(B.len) ? B.len[bi] : B.len) * beat;
    if (B.kind === 'saw') mus(saw(len, f, hot ? 900 : 650, len * 0.8), t, 0.5);
    else if (B.kind === 'log') mus(logDrum(f), t, 0.75);
    else mus(sub(len, f), t, 0.55);
  }
  // keys
  if (S.keys === 'arp16' || (S.keys === 'arp8' && k % 2 === 0)) {
    const seq = [0, 1, 2, 3, 2, 1], f = hz(notes[seq[arp++ % seq.length]] + 12);
    mus(pluck(f, sec === 'intro' ? 0.12 : 0.16), t, sec === 'intro' ? 0.55 : 0.8, (arp % 2 ? 0.3 : -0.3));
  } else if (S.keys === 'ep' && (pos === 0 || pos === 2.5)) notes.forEach((m, j) => mus(ep(hz(m), (pos === 0 ? 2.2 : 1.3) * beat), t + j * 0.012, 0.7, (j - 1.5) * 0.15));
  else if (S.keys === 'amapiano' && [0, 1.5, 2.5, 3.5].includes(pos) && sec !== 'intro') notes.forEach((m, j) => mus(ep(hz(m + 12), 0.45 * beat), t, 0.55, (j - 1.5) * 0.2));
  else if (S.keys === 'amapiano' && sec === 'intro' && pos === 0) notes.forEach((m, j) => mus(ep(hz(m + 12), 3.5 * beat), t + j * 0.02, 0.5, (j - 1.5) * 0.2));
  if (S.stabs && hot && (pos === 1.5 || pos === 3.5)) notes.forEach((m, j) => mus(saw(0.16, hz(m + 12), 2600, 0.08), t, 0.16, (j - 1.5) * 0.3));
}
// moments: a riser into the groove and into the drop, a crash on each, the last kick and crash on the end card
if (groove >= bar) { const len = Math.min(bar, groove); drum(riser(len - 0.02), groove - len, 0.4); }
if (groove > 0) drum(crash(), groove, 0.5);
if (drop != null) { drum(riser(bar - beat / 2 - 0.01), drop - bar, 0.55); drum(crash(), drop, 0.8); drum(kick(), drop, 1); drum(sub(0.9, hz(S.root[chord(drop)])), drop, 0.6); }
if (end < dur) {
  drum(kick(), end, 0.9); drum(crash(), end, 0.6);
  mus(sub(Math.min(2.5, dur - end), hz(S.root[0])), end, 0.55);
  S.pad[0].forEach((m, j) => mus(mood === 'upbeat' || mood === 'pro' ? pluck(hz(m + 12), 0.5) : ep(hz(m + 12), Math.min(2, dur - end)), end + j * 0.015, 0.8, (j - 1.5) * 0.25));
}

// the pad: detuned saws, wide, a filter that opens through the intro; it carries the home chord through the ending
{
  const det = [[-9, 0, 7], [9, 0, -7]].map((cs) => cs.map((c) => 2 ** (c / 1200))), ph = [new Float64Array(12), new Float64Array(12)];
  const lp = [[0, 0], [0, 0]], tail = Math.max(0.6, (dur - end) / 2.2);
  for (let i = 0; i < n; i++) {
    const t = i / SR, sec = section(t), notes = S.pad[chord(t)];
    const cut = sec === 'intro' ? 350 * (2600 / 350) ** Math.min(1, t / Math.max(groove, 0.01)) : sec === 'drop' ? 4200 : sec === 'outro' ? 2600 : 2600;
    const lvl = (sec === 'intro' ? 0.55 : sec === 'outro' ? 0.6 * Math.exp(-(t - end) / tail) : 0.32) * (mood === 'calm' ? 1.15 : 1) * Math.min(1, t / 0.4);
    const a = Math.exp(-2 * Math.PI * cut / SR);
    for (let ch = 0; ch < 2; ch++) {
      let v = 0;
      for (let j = 0; j < 4; j++) for (let d = 0; d < 3; d++) { const q = j * 3 + d; ph[ch][q] = (ph[ch][q] + hz(notes[j]) * det[ch][d] / SR) % 1; v += 2 * ph[ch][q] - 1; }
      const st = lp[ch]; st[0] = (1 - a) * v + a * st[0]; st[1] = (1 - a) * st[0] + a * st[1];
      (ch ? mR : mL)[i] += st[1] * 0.06 * lvl;
    }
  }
}

// ------------------------------------------------------------ master: duck the music on the kick, trim, level, fade
const len = Math.ceil(dur * SR), L = buf(dur), R = buf(dur);
for (let i = 0; i < len; i++) { L[i] = dL[i] + mL[i] * duck[i]; R[i] = dR[i] + mR[i] * duck[i]; }
highpass(L, 30); highpass(R, 30);
let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const g = 1.15 / (peak || 1), fade = Math.round(0.25 * SR);
for (let i = 0; i < len; i++) { const f = Math.min(1, (len - i) / fade); L[i] *= g * f; R[i] *= g * f; }
writeWav(out, L, R);
if (dir) fs.writeFileSync(out + '.json', JSON.stringify({ prompt: `beat:${JSON.stringify(sc)}`, made: 'tools/beat.mjs', bpm, mood, groove, drop, end, duration: dur }, null, 1) + '\n');
console.log(`${path.relative(process.cwd(), out)}: ${mood}, ${bpm} BPM, ${dur.toFixed(1)} s (groove ${groove.toFixed(2)} s${drop != null ? `, drop ${drop.toFixed(2)} s` : ''}, ending ${end.toFixed(2)} s)`);
