#!/usr/bin/env node
// Free motion QA for a finished video (no AI, just ffmpeg): finds what the eye catches first.
//   node tools/qa.mjs renders/<file>.mp4 [--hold 2.5]
// Flags:
//   frozen   a stretch over 1 s where nothing moves (the final hold, the last --hold seconds, is allowed)
//   flash    a single frame that differs from both neighbours while they match each other (a pop or glitch)
// Writes renders/_qa/<name>-contact.jpg (2 fps overview) and -phone.jpg (1 fps at 360 px, to judge readability).
// Exit 5 if anything is flagged, like jev.mjs lint, so make.mjs can report it without stopping.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';

const args = process.argv.slice(2), file = args.find((a) => !a.startsWith('--'));
if (!file || !fs.existsSync(file)) { console.log('usage: node tools/qa.mjs <video.mp4> [--hold 2.5]'); process.exit(1); }
const hi = args.indexOf('--hold'), hold = hi >= 0 ? Number(args[hi + 1]) : 2.5;
const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate:format=duration', '-of', 'json', file]).toString());
const [a, b] = probe.streams[0].r_frame_rate.split('/').map(Number), fps = a / (b || 1), dur = Number(probe.format.duration);
// mean absolute change between consecutive frames (luma), small size: fast and enough to see motion
const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-an', '-vf', 'scale=240:-2,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 256 << 20 });
const d = (r.stderr.match(/YAVG=[\d.]+/g) || []).map((x) => Number(x.slice(5)));
const flags = [];
// frozen: nothing but grain changing for more than a second
let run = 0;
for (let i = 0; i <= d.length; i++) {
  if (i < d.length && d[i] < 0.25) { run++; continue; }   // 0.25: film grain alone measures ~0.2
  const t0 = (i - run) / fps, t1 = i / fps;
  if (run / fps > 1 && t1 < dur - hold) flags.push(`frozen ${t0.toFixed(2)}-${t1.toFixed(2)} s: nothing moves for ${(run / fps).toFixed(1)} s (add a drift or a beat)`);
  run = 0;
}
// flash: the change into frame n and out of it are both big, while frame n-1 to n+1 would be small
for (let i = 1; i < d.length - 1; i++) if (d[i] > 6 && d[i + 1] > 6 && d[i - 1] < 1.5 && (d[i + 2] ?? 0) < 1.5) flags.push(`flash at ${(i / fps).toFixed(2)} s: one frame differs from both neighbours`);
const out = path.join(path.dirname(file), '_qa'), base = path.basename(file, '.mp4');
fs.mkdirSync(out, { recursive: true });
spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', file, '-vf', 'fps=2,scale=270:-1,tile=8x5', '-frames:v', '1', path.join(out, `${base}-contact.jpg`)]);
spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', file, '-vf', 'fps=1,scale=360:-1,tile=6x3', '-frames:v', '1', path.join(out, `${base}-phone.jpg`)]);
console.log(`qa ${path.basename(file)}: ${dur.toFixed(1)} s, ${d.length} frames${flags.length ? '' : ', nothing flagged'}`);
for (const f of flags.slice(0, 12)) console.log(`  ${f}`);
console.log(`  sheets: ${path.relative(process.cwd(), path.join(out, `${base}-contact.jpg`))}, -phone.jpg`);
process.exit(flags.length ? 5 : 0);
