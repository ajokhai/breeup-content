#!/usr/bin/env node
// Build a film's soundtrack: audio/music.wav + the voice-over lines placed at the times in film.json "vo",
// music ducked under the voice, the whole mix levelled to -14 LUFS (YouTube, Reels, TikTok). macOS and Linux.
//
//   node tools/mix.mjs films/T2-pay-service-charge [--music-db -16] [--sfx-db -9]
// Sound effects: audio/sfx.wav (node tools/sfx.mjs) is mixed in when present.
//
// film.json: { "duration": 60, "vo": [[0.3, "audio/vo-1.wav"], [10.0, "audio/vo-2.wav"], ...] }
// Output: <film>/audio/mix.wav, which tools/render.mjs muxes into the MP4s.
// Prints each line's start and end so overlaps are easy to spot (a line must end before the next starts).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const dir = path.resolve(args.find((a) => !a.startsWith('--')) || '');
const num = (k, d) => { const i = args.indexOf(k); return i >= 0 ? Number(args[i + 1]) : d; };
const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'film.json'), 'utf8'));
// with no voice-over the music is the star (launch films), so it sits much higher
const musicDb = num('--music-db', (cfg.vo || []).length ? -16 : -7), sfxDb = num('--sfx-db', -9);
const dur = Number(cfg.duration);
const vo = (cfg.vo || []).map(([t, f]) => [Number(t), path.join(dir, f)]);
const music = path.join(dir, 'audio', 'music.wav');
const sfx = path.join(dir, 'audio', 'sfx.wav');   // from tools/sfx.mjs, optional
const out = path.join(dir, 'audio', 'mix.wav');
// integrated loudness (LUFS) of a file or of a filter's output
const lufs = (f, af = '') => {
  const out = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', `${af}${af ? ',' : ''}ebur128=framelog=quiet`, '-f', 'null', '-']).stderr.toString();
  return Number((/I:\s+(-?[\d.]+) LUFS/.exec(out.split('Summary:').pop()) || [])[1]);
};
const VO_LUFS = -18;   // every line is brought to the same level, so no line sounds quieter than the rest
const len = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

let prevEnd = 0;
vo.forEach(([t, f], i) => {
  const d = len(f);
  const warn = t < prevEnd ? `  <-- overlaps the previous line by ${(prevEnd - t).toFixed(2)} s` : t + d > dur ? '  <-- runs past the end' : '';
  console.log(`vo ${i + 1}: ${t.toFixed(2)}-${(t + d).toFixed(2)} s  ${path.basename(f)}${warn}`);
  prevEnd = t + d;
});

const inputs = [], filters = [];
const hasMusic = fs.existsSync(music);
if (hasMusic) inputs.push('-i', music);
vo.forEach(([, f]) => inputs.push('-i', f));
const off = hasMusic ? 1 : 0;
vo.forEach(([t, f], i) => {
  const g = VO_LUFS - lufs(f);
  filters.push(`[${i + off}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${g.toFixed(2)}dB,adelay=${Math.round(t * 1000)}:all=1[v${i}]`);
});
const voMix = vo.length ? `${vo.map((_, i) => `[v${i}]`).join('')}amix=inputs=${vo.length}:normalize=0,apad=whole_dur=${dur}[vo]` : null;
if (voMix) filters.push(voMix);
if (hasMusic) {
  // a gentle fade at both ends; the voice ducks the music by sidechain compression
  filters.push(`[0:a]aresample=48000,aformat=channel_layouts=stereo,volume=${musicDb}dB,afade=t=in:d=0.6,afade=t=out:st=${Math.max(0, dur - 2.5)}:d=2.5,apad=whole_dur=${dur}[m]`);
  if (voMix) {
    filters.push('[vo]asplit=2[vo1][vo2]');
    filters.push('[m][vo2]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=500[md]');
    filters.push('[md][vo1]amix=inputs=2:normalize=0[pre]');
  } else filters.push('[m]anull[pre]');
} else if (voMix) filters.push('[vo]anull[pre]');
else filters.push(`anullsrc=r=48000:cl=stereo,atrim=0:${dur}[pre]`);   // no voice or music: sound effects only (or silence)
if (fs.existsSync(sfx)) {
  inputs.push('-i', sfx);
  filters.push(`[${off + vo.length}:a]aresample=48000,volume=${sfxDb}dB,apad=whole_dur=${dur}[fx]`);
  filters.push('[pre][fx]amix=inputs=2:normalize=0[pre2]');
} else filters.push('[pre]anull[pre2]');
// Two passes: render the mix, measure it, then one fixed gain to -14 LUFS and a limiter. (A one-pass
// loudnorm adapts its gain over time, which made the voice dip in the middle of T2.)
filters.push(`[pre2]atrim=0:${dur},aresample=48000[out]`);
const raw = out.replace(/\.wav$/, '.raw.wav');
execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-c:a', 'pcm_f32le', raw], { stdio: 'inherit' });
const gain = -14 - lufs(raw);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=0.84:attack=5:release=60:level=disabled`,
  '-c:a', 'pcm_s16le', '-map_metadata', '-1', '-fflags', '+bitexact', out], { stdio: 'inherit' });
fs.rmSync(raw);
console.log(`${path.relative(process.cwd(), out)} (${len(out).toFixed(1)} s, -14 LUFS)`);
