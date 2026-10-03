#!/usr/bin/env node
// Render a canvas film (films/<ID>/index.html + film.js) to MP4. Works on macOS and Linux.
//
//   node tools/render.mjs films/T2-pay-service-charge [--format 9x16|16x9|all] [--fps 30] [--scale 1|2]
//                         [--from 0 --to 50] [--still 12.5] [--no-audio]
//
// Output: renders/breeup-<ID-name>-<format>.mp4 (1080p, or 4K masters with --scale 2).
// --still t writes one PNG frame per format to renders/_stills/ instead (cheap layout checks).
// Audio: the film's audio/mix.wav is muxed in if it exists (build it with tools/mix.mjs).
// Needs ffmpeg and Playwright's Chromium (cloud: preinstalled; Mac: npx playwright install chromium).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const flag = (k) => args.includes(`--${k}`);
const filmDir = path.resolve(args.find((a) => !a.startsWith('--') && !/^[\d.]+$/.test(a) && !['9x16', '16x9', '1x1', 'all'].includes(a)) || '');
if (!fs.existsSync(path.join(filmDir, 'index.html'))) { console.error('usage: node tools/render.mjs films/<ID-name> [--format 9x16]'); process.exit(1); }

const cfg = JSON.parse(fs.readFileSync(path.join(filmDir, 'film.json'), 'utf8'));
const fmtArg = opt('format', 'all');
const formats = fmtArg === 'all' ? (cfg.formats || ['16x9', '9x16']) : fmtArg.split(',');
const fps = Number(opt('fps', 30));
const scale = Number(opt('scale', 1));
const still = opt('still');
const from = Number(opt('from', 0)), to = Number(opt('to', cfg.duration));
const SIZES = { '16x9': [1920, 1080], '9x16': [1080, 1920], '1x1': [1080, 1080] };
const name = `breeup-${path.basename(filmDir)}`;
const outDir = path.join(ROOT, 'renders');

// tiny static server: the film fetches beats.json / film.json, which file:// blocks
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.otf': 'font/otf', '.ttf': 'font/ttf', '.wav': 'audio/wav' };
const server = http.createServer((req, res) => {
  const p = path.join(filmDir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(filmDir) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const launch = { args: ['--disable-gpu-vsync', '--force-color-profile=srgb'] };
if (fs.existsSync('/opt/pw-browsers/chromium')) launch.executablePath = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(launch).catch((e) => {
  console.error(`Couldn't start Chromium (${e.message.split('\n')[0]}). On a Mac run: npx playwright install chromium`);
  process.exit(1);
});

for (const fmt of formats) {
  const [w, h] = SIZES[fmt];
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  page.on('console', (m) => { if (m.type() === 'error') console.error(`  [page] ${m.text()}`); });
  page.on('pageerror', (e) => console.error(`  [page] ${e.message}`));
  await page.goto(`http://127.0.0.1:${port}/index.html?render=1&format=${fmt}&fps=${fps}${scale > 1 ? '&blur=1' : ''}`);
  await page.waitForFunction(() => window.filmReady === true, null, { timeout: 60000 });
  // the canvas is sized in CSS px; scale > 1 renders it at device pixels for 4K masters
  if (scale > 1) await page.evaluate((s) => { const c = document.getElementById('film'); c.style.width = c.width + 'px'; c.style.height = c.height + 'px'; }, scale);
  const canvas = await page.$('#film');

  if (still != null) {
    fs.mkdirSync(path.join(outDir, '_stills'), { recursive: true });
    for (const t of still.split(',').map(Number)) {
      await page.evaluate((t) => window.seek(t), t);
      const f = path.join(outDir, '_stills', `${name}-${fmt}-${t}s.png`);
      await canvas.screenshot({ path: f });
      console.log(f);
    }
    await page.close();
    continue;
  }

  const n = Math.round((to - from) * fps);
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `${name}-${fmt}${scale > 1 ? '-4k' : ''}.mp4`);
  const mix = path.join(filmDir, 'audio', 'mix.wav');
  const withAudio = !flag('no-audio') && fs.existsSync(mix);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    ...(withAudio ? ['-ss', String(from), '-t', String(to - from), '-i', mix] : []),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    ...(withAudio ? ['-c:a', 'aac', '-b:a', '256k', '-shortest'] : []),
    '-map_metadata', '-1', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    await page.evaluate((t) => window.seek(t), from + i / fps);
    const buf = await canvas.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % (fps * 5) === 0) process.stdout.write(`\r  ${fmt}: ${(i / fps).toFixed(0)}s / ${(n / fps).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log(`\r  ${fmt}: done in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${path.relative(ROOT, out)}${withAudio ? '' : ' (no audio)'}`);
  await page.close();
}
await browser.close();
server.close();
