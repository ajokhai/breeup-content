#!/usr/bin/env node
// "Make one like this": measure a reference video's style for free, on this machine, so a new video can match it.
// Takes what is fair to copy (pace, shape, energy), never another brand's colours or words.
//
//   node tools/style.mjs <video link or file> --out media/styles/<name>.json
//
// Writes { shape: '9x16'|'16x9'|'1x1', seconds, cuts, shot: average seconds per shot, motion, pace: 'fast'|'medium'|'slow',
//          energy: 'high'|'medium'|'low', mood: 'upbeat'|'pro'|'calm', source }.
// Links (X, TikTok, Instagram, YouTube...) are downloaded with yt-dlp into a temp file and deleted afterwards.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const [src] = process.argv.slice(2), oi = process.argv.indexOf('--out'), out = oi > 0 ? process.argv[oi + 1] : null;
if (!src || !out) { console.log('usage: node tools/style.mjs <video link or file> --out media/styles/<name>.json'); process.exit(1); }
let file = src, tmp = null;
if (/^https?:\/\//.test(src)) {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-style-'));
  try {
    execFileSync('yt-dlp', ['-q', '--no-playlist', '-f', 'mp4[height<=1080]/best[height<=1080]/best', '--max-filesize', '400M', '-o', path.join(tmp, 'ref.%(ext)s'), src], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 180000 });
  } catch (e) { console.error(`style: couldn't download that video (${String(e.stderr || e.message).split('\n').find(Boolean)?.slice(0, 160)})`); process.exit(1); }
  file = path.join(tmp, fs.readdirSync(tmp)[0]);
}
const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', file]).toString());
const { width: w, height: h } = probe.streams[0], seconds = Number(probe.format.duration) || 0;
// cuts: frames where the picture changes a lot
const sc = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-an', '-vf', "scale=320:-2,select='gt(scene,0.32)',showinfo", '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64 << 20 });
const cuts = (sc.stderr.match(/pts_time:/g) || []).length;
// loudness range and level: a rough read of how energetic the soundtrack is
const lu = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], { encoding: 'utf8' }).stderr.split('Summary:').pop();
const I = Number((/I:\s+(-?[\d.]+) LUFS/.exec(lu) || [])[1]), LRA = Number((/LRA:\s+([\d.]+) LU/.exec(lu) || [])[1]);
// motion: how much the picture changes between frames 0.2 s apart. Animated wipes and moving cameras don't show up as
// cuts, so this is the better read of pace (our tutorials score ~5, ads ~9, reels ~14)
const mo = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-an', '-vf', 'scale=160:-2,fps=5,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64 << 20 });
const diffs = (mo.stderr.match(/YAVG=[\d.]+/g) || []).map((x) => Number(x.slice(5)));
const motion = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0;
const shot = seconds / (cuts + 1);
const pace = motion > 11 || shot < 1.6 ? 'fast' : motion > 6.5 || shot < 3.5 ? 'medium' : 'slow';
const energy = !Number.isFinite(I) ? 'low' : I > -13 || (pace === 'fast' && I > -18) ? 'high' : I > -20 ? 'medium' : 'low';
const style = {
  shape: w > h * 1.2 ? '16x9' : h > w * 1.2 ? '9x16' : '1x1', seconds: +seconds.toFixed(1), cuts, shot: +shot.toFixed(2), motion: +motion.toFixed(1), pace, energy,
  mood: energy === 'high' || pace === 'fast' ? 'upbeat' : pace === 'slow' && energy === 'low' ? 'calm' : 'pro', loudness: Number.isFinite(I) ? I : null, range: Number.isFinite(LRA) ? LRA : null,
  source: src, at: new Date().toISOString(),
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(style, null, 1) + '\n');
if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
console.log(`  style: ${style.shape}, ${style.seconds} s, motion ${style.motion}, ${cuts} cuts: ${pace} pace, ${energy} energy -> ${style.mood} music`);
