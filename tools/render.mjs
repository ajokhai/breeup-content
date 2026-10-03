#!/usr/bin/env node
// Render a canvas film (films/<ID>/index.html + film.js) to MP4. Works on macOS and Linux.
//
//   node tools/render.mjs films/T2-pay-service-charge [--format 9x16|16x9|all] [--fps 30] [--scale 1|2]
//                         [--workers N] [--draft] [--still 5,20] [--no-audio] [--remux]
//
// Output: renders/breeup-<ID-name>-<format>.mp4 (1080p; --scale 2 gives 4K masters named -4k).
// Full quality by default: 16-sample motion blur, x264 CRF 16. Frames are split across --workers browser
// pages (default: CPU cores - 1) and joined losslessly, so quality costs time, not tokens.
// --draft: no motion blur, quicker encode, for checking timing only.
// --still t,t: one PNG per time per format in renders/_stills/, plus a contact sheet _sheet-<fmt>.jpg.
// --remux: swap a new audio/mix.wav into existing renders without re-rendering the picture.
// Audio: the film's audio/mix.wav (tools/mix.mjs) is muxed in when it exists.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const flag = (k) => args.includes(`--${k}`);
const VALUED = new Set(['--format', '--fps', '--scale', '--workers', '--still', '--from', '--to']);
const filmArg = args.find((a, i) => !a.startsWith('--') && !VALUED.has(args[i - 1]));
const filmDir = path.resolve(filmArg || '');
if (!fs.existsSync(path.join(filmDir, 'index.html'))) { console.error('usage: node tools/render.mjs films/<ID-name> [--format 9x16]'); process.exit(1); }

const cfg = JSON.parse(fs.readFileSync(path.join(filmDir, 'film.json'), 'utf8'));
const fmtArg = opt('format', 'all');
const formats = fmtArg === 'all' ? (cfg.formats || ['16x9', '9x16']) : fmtArg.split(',');
const fps = Number(opt('fps', 30)), scale = Number(opt('scale', 1)), draft = flag('draft');
const workers = Math.max(1, Number(opt('workers', Math.max(1, os.cpus().length - 1))));
const still = opt('still');
const from = Number(opt('from', 0)), to = Number(opt('to', cfg.duration));
const SIZES = { '16x9': [1920, 1080], '9x16': [1080, 1920], '1x1': [1080, 1080] };
const name = `breeup-${path.basename(filmDir)}`;
const outDir = path.join(ROOT, 'renders');
const mix = path.join(filmDir, 'audio', 'mix.wav');
const outFile = (fmt) => path.join(outDir, `${name}-${fmt}${scale > 1 ? '-4k' : ''}.mp4`);
const ff = (a) => new Promise((r, j) => spawn('ffmpeg', ['-v', 'error', '-y', ...a], { stdio: 'inherit' }).on('close', (c) => (c ? j(new Error('ffmpeg failed')) : r())));
const muxArgs = ['-c:a', 'aac', '-b:a', '256k', '-shortest', '-map_metadata', '-1', '-movflags', '+faststart'];

if (flag('remux')) {
  for (const fmt of formats) {
    const out = outFile(fmt);
    if (!fs.existsSync(out)) { console.error(`no render yet: ${out}`); continue; }
    const tmp = out.replace(/\.mp4$/, '.remux.mp4');
    await ff(['-i', out, '-i', mix, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', ...muxArgs, tmp]);
    fs.renameSync(tmp, out);
    console.log(`remuxed ${path.relative(ROOT, out)}`);
  }
  process.exit(0);
}

const { chromium } = await import('playwright');
// tiny static server: the film fetches beats.json / film.json, which file:// blocks
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.otf': 'font/otf', '.ttf': 'font/ttf', '.wav': 'audio/wav', '.webm': 'video/webm', '.mp4': 'video/mp4' };
const server = http.createServer((req, res) => {
  // /kit/* is the shared film kit (tools/kit), everything else is the film's own folder
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname), KIT = path.join(ROOT, 'tools', 'kit');
  const base = url.startsWith('/kit/') ? KIT : filmDir;
  const p = path.join(base, url.startsWith('/kit/') ? url.slice(5) : url);
  if (!p.startsWith(base) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  const size = fs.statSync(p).size, range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  const type = MIME[path.extname(p).toLowerCase()] || 'application/octet-stream';
  if (range) {   // video seeking needs range requests
    const a = range[1] ? Number(range[1]) : 0, b = range[2] ? Number(range[2]) : size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1 });
    return fs.createReadStream(p, { start: a, end: b }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const launch = { args: ['--disable-gpu-vsync', '--force-color-profile=srgb', '--autoplay-policy=no-user-gesture-required'] };
if (fs.existsSync('/opt/pw-browsers/chromium')) launch.executablePath = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(launch).catch((e) => {
  console.error(`Couldn't start Chromium (${e.message.split('\n')[0]}). On a Mac run: npx playwright install chromium`);
  process.exit(1);
});

async function openPage(fmt) {
  const [w, h] = SIZES[fmt];
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) console.error(`  [page] ${m.text()}`); });
  page.on('pageerror', (e) => console.error(`  [page] ${e.message}`));
  await page.goto(`http://127.0.0.1:${port}/index.html?render=1&format=${fmt}&fps=${fps}${draft ? '&blur=0' : ''}`);
  await page.waitForFunction(() => window.filmReady === true, null, { timeout: 120000 });
  return { page, canvas: await page.$('#film') };
}

// one worker renders frames [a, b) to its own lossless-quality segment
async function renderRange(fmt, a, b, seg, tick) {
  const { page, canvas } = await openPage(fmt);
  const enc = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', draft ? 'veryfast' : 'slow', '-crf', draft ? '22' : '16', '-pix_fmt', 'yuv420p', seg],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = a; i < b; i++) {
    await page.evaluate((t) => window.seek(t), from + i / fps);
    const buf = await canvas.screenshot({ type: 'jpeg', quality: draft ? 85 : 97 });
    if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once('drain', r));
    tick();
  }
  enc.stdin.end();
  await new Promise((r) => enc.on('close', r));
  await page.close();
}

for (const fmt of formats) {
  if (still != null) {
    const { page, canvas } = await openPage(fmt);
    const dir = path.join(outDir, '_stills');
    fs.mkdirSync(dir, { recursive: true });
    const files = [];
    for (const t of still.split(',').map(Number)) {
      await page.evaluate((t) => window.seek(t), t);
      const f = path.join(dir, `${name}-${fmt}-${t}s.png`);
      await canvas.screenshot({ path: f });
      files.push(f);
    }
    await page.close();
    // one small labelled sheet per format: the only image an agent needs to look at
    const sheet = path.join(dir, `_sheet-${name}-${fmt}.jpg`);
    execFileSync('node', [path.join(ROOT, 'tools', 'gemini.mjs'), 'sheet', ...files, '--out', sheet, '--cell', fmt === '9x16' ? '480' : '270', '--width', '2000'], { stdio: 'ignore' });
    console.log(`${path.relative(ROOT, sheet)}  (${still})`);
    continue;
  }

  const n = Math.round((to - from) * fps), t0 = Date.now();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'render-'));
  const k = Math.min(workers, Math.ceil(n / fps));
  let done = 0, last = 0;
  const tick = () => { done++; if (Date.now() - last > 15000) { last = Date.now(); process.stdout.write(`\r  ${fmt}: ${Math.round(100 * done / n)}%`); } };
  const segs = [...Array(k)].map((_, i) => path.join(tmp, `seg${i}.mp4`));
  await Promise.all(segs.map((seg, i) => renderRange(fmt, Math.floor(i * n / k), Math.floor((i + 1) * n / k), seg, tick)));
  fs.writeFileSync(path.join(tmp, 'list.txt'), segs.map((s) => `file '${s}'`).join('\n'));
  fs.mkdirSync(outDir, { recursive: true });
  const withAudio = !flag('no-audio') && fs.existsSync(mix);
  await ff(['-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'),
    ...(withAudio ? ['-ss', String(from), '-t', String(to - from), '-i', mix, '-map', '0:v', '-map', '1:a'] : []),
    '-c:v', 'copy', ...(withAudio ? muxArgs : ['-map_metadata', '-1', '-movflags', '+faststart']), outFile(fmt)]);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\r  ${fmt}: done in ${((Date.now() - t0) / 1000).toFixed(0)}s with ${k} workers → ${path.relative(ROOT, outFile(fmt))}${withAudio ? '' : ' (no audio)'}`);
}
await browser.close();
server.close();
