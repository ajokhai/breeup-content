#!/usr/bin/env node
// Shared Gemini media tool for the BreeUp videos. One file, no dependencies (Node 18+).
// Read videos/CLAUDE.md first: it says what the pictures should look like.
//
//   node tools/gemini.mjs image --prompt "..." --out media/generated/x.png [--aspect 16:9] [--size 2K|4K] [--n 2]
//                               [--ref a.jpg --ref b.jpg] [--model gemini-3-pro-image] [--raw]
//   node tools/gemini.mjs video --prompt "..." --out media/generated/x.mp4 [--aspect 9:16] [--image first.png]
//                               [--seconds 8] [--resolution 1080p] [--model veo-3.1-generate-preview]
//   node tools/gemini.mjs music --prompt "..." --out films/<film>/audio/music.wav [--model lyria-3-pro-preview]
//                              (instrumental bed; say length, BPM, instruments, "no vocals"; output is a clean WAV)
//   node tools/gemini.mjs tts   --text "..." | --file script.txt --out audio/vo.wav [--voice Kore]
//                               [--style "Read warmly, Nigerian English accent, unhurried"]
//   node tools/gemini.mjs batch media/generated/<film>/shots.json [--force] [--no-check]   (whole film, cached)
//   node tools/gemini.mjs check a.jpg b.jpg ...      (cheap AI QA: one KEEP/REJECT line per picture)
//   node tools/gemini.mjs sheet a.jpg b.jpg ... --out sheet.jpg [--cell 300]   (one small contact sheet)
//   node tools/gemini.mjs learn [file|youtube-url] [--note "..."]   (study references, update moodboard/STYLE.md)
//   node tools/gemini.mjs review renders/x.mp4 [--film <folder>]     (Gemini watches our render and critiques it)
//   node tools/gemini.mjs clean files...       (strip EXIF/XMP/C2PA metadata losslessly; automatic on generation)
//   node tools/gemini.mjs usage                (calls per model today / all time)
// Exit codes: 2 out of credits or quota (stop and tell Josh) · 3 bad key · 4 safety block · 1 other.
//
// Every output gets a sidecar <out>.json with the model, the full prompt and the time, so a good
// picture can be regenerated or varied later. The key comes from GEMINI_API_KEY or videos/.env.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Image conversion: sips on macOS, ffmpeg everywhere else (Linux, cloud agents, CI).
const HAS_SIPS = process.platform === 'darwin';
function convert(src, out, { maxSide, height, quality } = {}) {
  if (HAS_SIPS) {
    const args = [];
    if (maxSide) args.push('-Z', String(maxSide));
    if (height) args.push('--resampleHeight', String(height));
    args.push('-s', 'format', out.endsWith('.bmp') ? 'bmp' : 'jpeg');
    if (quality) args.push('-s', 'formatOptions', String(quality));
    execFileSync('sips', [...args, src, '--out', out], { stdio: 'ignore' });
    return;
  }
  const vf = maxSide ? `scale='if(gt(iw,ih),min(${maxSide},iw),-2)':'if(gt(iw,ih),-2,min(${maxSide},ih))'`
    : height ? `scale=-2:${height}` : null;
  const args = ['-v', 'error', '-y', '-i', src, ...(vf ? ['-vf', vf] : [])];
  if (out.endsWith('.bmp')) args.push('-pix_fmt', 'bgr24');
  else args.push('-q:v', String(quality ? Math.round(2 + (100 - quality) / 10) : 3));
  execFileSync('ffmpeg', [...args, out], { stdio: 'ignore' });
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const API = 'https://generativelanguage.googleapis.com/v1beta';

// ------------------------------------------------------------ house style
// Appended to every image/video prompt unless --raw. Tuned in tools/PROMPTS.md: change it there first,
// try it, then copy the winner here.
const HOUSE_PHOTO = [
  'Photorealistic documentary-style photograph, shot on a full-frame camera with a 35mm or 50mm prime lens,',
  'natural light, true-to-life skin tones with visible texture, no plastic or airbrushed skin.',
  'Setting is a real, lived-in residential estate in Lagos or Abuja, Nigeria: tidy compounds, painted walls,',
  'interlocking paving, tropical plants, generators and water tanks where natural.',
  'People are good-looking Black Nigerian adults: attractive, well-groomed and photogenic, like a cast for a',
  'premium lifestyle campaign (clear skin, neat hair, healthy, confident), with varied ages and genders,',
  'dressed stylishly the way middle-class Nigerians dress (smart modern clothes and well-cut Ankara prints).',
  'Candid, unposed moment, nobody looking into the camera. Clean composition with room for text overlay.',
  'No text, no captions, no logos, no watermarks, no brand names on anything, no visible phone screen content.',
  'Car badges and number plates out of frame, turned away or too soft to read.',
].join(' ');
const HOUSE_VIDEO = [
  'Cinematic, realistic footage, steady handheld or slow gimbal move, natural light, real Nigerian residential',
  'estate in Lagos. Good-looking, well-groomed Black Nigerian people, natural and candid. No text, no logos, no subtitles, no music.',
].join(' ');

// ------------------------------------------------------------ args, key
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const k = a.slice(2);
    const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    if (out[k] === undefined) out[k] = v;
    else out[k] = [].concat(out[k], v);
  }
  return out;
}
const list = v => (v === undefined ? [] : [].concat(v));

function apiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  for (const f of [path.join(ROOT, '.env'), path.join(ROOT, '..', '.env')]) {
    if (!fs.existsSync(f)) continue;
    const m = fs.readFileSync(f, 'utf8').match(/^GEMINI_API_KEY\s*=\s*"?([^"\n]+)"?/m);
    if (m) return m[1].trim();
  }
  die('No key. Put GEMINI_API_KEY=... in videos/.env');
}
function die(msg) { console.error('gemini: ' + msg); process.exit(1); }

async function call(method, url, body) {
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(url.startsWith('http') ? url : `${API}/${url}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey() },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      // dropped connections and timeouts are transient too
      if (attempt >= 4) die(`network: ${e.cause?.code || e.message}`);
      console.error(`gemini: network ${e.cause?.code || e.message}, retrying`);
      await new Promise(r => setTimeout(r, 3000 * attempt));
      continue;
    }
    if (res.ok) { logUsage(method, url); return res.json(); }
    const txt = await res.text();
    const err = classify(res.status, txt);
    // short rate limits and server hiccups are transient: wait (as long as the API asks) and retry
    if (err.kind === 'rate' || err.kind === 'server') {
      if (attempt < 5) {
        const wait = err.retryS ? err.retryS * 1000 + 500 : 5000 * attempt;
        console.error(`gemini: ${err.kind === 'rate' ? 'rate limited' : `server error ${res.status}`}, retrying in ${Math.round(wait / 1000)}s`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
    }
    fail(err, url);
  }
}

// ------------------------------------------------------------ errors and usage
// Exit codes, so scripts and agents can tell what happened:
//   2 = out of credits / quota or billing problem (stop, tell Josh)   3 = bad key or no access
//   4 = blocked by a safety filter (rephrase the prompt)               1 = anything else
function classify(status, txt) {
  let e = {};
  try { e = JSON.parse(txt).error || {}; } catch {}
  const msg = e.message || txt.slice(0, 400);
  const details = e.details || [];
  const retry = details.find(d => /RetryInfo/.test(d['@type'] || ''));
  const retryS = retry ? parseFloat(retry.retryDelay) : 0;
  const quotas = details.filter(d => /QuotaFailure/.test(d['@type'] || '')).flatMap(d => d.violations || []);
  const quotaIds = quotas.map(q => `${q.quotaId || q.quotaMetric || ''}${q.quotaValue ? ` (limit ${q.quotaValue})` : ''}`).filter(Boolean);
  const daily = quotaIds.some(q => /PerDay|per_day|daily/i.test(q));
  const billing = /billing|credit|prepay|insufficient|payment|free tier.*(not|no longer)|exceeded your current quota/i.test(msg);
  if (status === 429 && (daily || billing || retryS > 120)) return { kind: 'credits', msg, quotaIds, retryS };
  if (status === 429) return { kind: 'rate', msg, quotaIds, retryS };
  if ((status === 400 || status === 403) && /billing|credit|FAILED_PRECONDITION|prepay/i.test(msg + (e.status || ''))) return { kind: 'credits', msg, quotaIds };
  if (status === 401 || /API_KEY_INVALID|API key not valid|API key expired/i.test(txt) || (status === 403 && /API key|permission|not authorized|PERMISSION_DENIED/i.test(msg + (e.status || '')))) return { kind: 'auth', msg };
  if (status >= 500) return { kind: 'server', msg };
  if (/safety|blocked|prohibited|SAFETY/i.test(msg)) return { kind: 'safety', msg };
  return { kind: 'other', msg: `${status} ${msg}` };
}
function fail(err, url = '') {
  const model = (url.match(/models\/([^:/]+)/) || [])[1] || '';
  const bar = '='.repeat(72);
  if (err.kind === 'credits') {
    console.error(`${bar}\nGEMINI: OUT OF CREDITS OR QUOTA${model ? ` (${model})` : ''}\n${err.msg}`);
    if (err.quotaIds?.length) console.error(`Quota hit: ${err.quotaIds.join(', ')}`);
    if (err.retryS) console.error(`The API says it resets in about ${Math.ceil(err.retryS / 60)} min.`);
    console.error(`Check usage and billing: https://aistudio.google.com/usage  and  https://aistudio.google.com/apikey\n` +
      `Agents: stop generating and tell Josh. Don't switch to a cheaper model without asking.\n${bar}`);
    process.exit(2);
  }
  if (err.kind === 'auth') { console.error(`${bar}\nGEMINI: KEY REJECTED OR NO ACCESS${model ? ` to ${model}` : ''}\n${err.msg}\nCheck GEMINI_API_KEY in videos/.env.\n${bar}`); process.exit(3); }
  if (err.kind === 'safety') { console.error(`gemini: blocked by a safety filter${model ? ` (${model})` : ''}: ${err.msg}\nRephrase the prompt.`); process.exit(4); }
  die(`${err.kind === 'server' ? 'server error, gave up after retries: ' : ''}${err.msg}`);
}
// one line per successful call in tools/usage.log, so spend can be tallied (`node tools/gemini.mjs usage`)
function logUsage(method, url) {
  const m = url.match(/models\/([^:]+):(\w+)/);
  if (!m || method !== 'POST') return;
  try { fs.appendFileSync(path.join(HERE, 'usage.log'), `${new Date().toISOString()}\t${m[1]}\t${m[2]}\n`); } catch {}
}
function usage() {
  const f = path.join(HERE, 'usage.log');
  if (!fs.existsSync(f)) return console.log('no calls logged yet');
  const rows = fs.readFileSync(f, 'utf8').trim().split('\n').map(l => l.split('\t'));
  const today = new Date().toISOString().slice(0, 10), t = {};
  for (const [ts, model] of rows) {
    t[model] ||= { today: 0, all: 0 };
    t[model].all++; if (ts.startsWith(today)) t[model].today++;
  }
  console.log('model'.padEnd(34) + 'today'.padStart(7) + 'all'.padStart(7));
  for (const [m, v] of Object.entries(t)) console.log(m.padEnd(34) + String(v.today).padStart(7) + String(v.all).padStart(7));
}

function mimeOf(f) {
  const e = path.extname(f).toLowerCase();
  return { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[e] || 'image/png';
}
function inline(f) {
  return { inlineData: { mimeType: mimeOf(f), data: fs.readFileSync(f).toString('base64') } };
}
function sidecar(out, meta) {
  fs.writeFileSync(out + '.json', JSON.stringify({ ...meta, created: new Date().toISOString() }, null, 1));
}
function numbered(out, i, n) {
  if (n <= 1) return out;
  const ext = path.extname(out);
  return out.slice(0, -ext.length) + `-${i + 1}` + ext;
}

// a 200 response with nothing in it is almost always a safety block
function noOutput(res, model) {
  const c = res.candidates?.[0], block = res.promptFeedback?.blockReason;
  const reason = block || c?.finishReason || 'unknown';
  if (/SAFETY|PROHIBITED|BLOCK|RECITATION|IMAGE_OTHER/i.test(reason)) fail({ kind: 'safety', msg: `${reason} ${c?.finishMessage || ''}`.trim() }, `models/${model}:`);
  die(`no output (${reason}): ${JSON.stringify(res).slice(0, 400)}`);
}

// ------------------------------------------------------------ clean (strip generator metadata, losslessly)
// Removes EXIF, XMP, IPTC and C2PA manifests. Pixels are untouched (no re-encode); the ICC colour profile stays.
// Videos are remuxed without re-encoding. Runs automatically on everything this tool writes;
// run `clean` yourself on renders and on anything that came from elsewhere.
function cleanJpeg(b) {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  const keep = [b.subarray(0, 2)];
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1];
    if (m === 0xda) { keep.push(b.subarray(i)); break; }          // start of scan: rest is image data
    const len = b.readUInt16BE(i + 2), seg = b.subarray(i, i + 2 + len);
    const isIcc = m === 0xe2 && seg.subarray(4, 15).toString('latin1') === 'ICC_PROFILE';
    const drop = (m >= 0xe1 && m <= 0xef && !isIcc) || m === 0xfe; // APP1-15 (EXIF/XMP/C2PA) and comments
    if (!drop) keep.push(seg);
    i += 2 + len;
  }
  return Buffer.concat(keep);
}
function cleanPng(b) {
  if (b.readUInt32BE(0) !== 0x89504e47) return null;
  const ok = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'pHYs', 'sBIT', 'bKGD']);
  const keep = [b.subarray(0, 8)];
  for (let i = 8; i < b.length;) {
    const len = b.readUInt32BE(i), type = b.subarray(i + 4, i + 8).toString('latin1');
    if (ok.has(type)) keep.push(b.subarray(i, i + 12 + len));
    i += 12 + len;
  }
  return Buffer.concat(keep);
}
function cleanFile(f) {
  const ext = path.extname(f).toLowerCase();
  if (['.mp4', '.mov', '.m4v', '.webm'].includes(ext)) {
    const tmp = f + '.clean' + ext;
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-map', '0', '-c', 'copy', '-map_metadata', '-1',
      '-map_chapters', '-1', '-metadata', 'encoder=', '-metadata:s', 'handler_name=', '-fflags', '+bitexact',
      ...(ext === '.webm' ? [] : ['-movflags', '+faststart']), tmp]);
    fs.renameSync(tmp, f);
    return true;
  }
  if (['.mp3', '.wav', '.m4a'].includes(ext)) {
    const tmp = f + '.clean' + ext;
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-map', '0:a', '-c', 'copy', '-map_metadata', '-1',
      '-fflags', '+bitexact', ...(ext === '.mp3' ? ['-id3v2_version', '0', '-write_xing', '0'] : []), tmp]);
    fs.renameSync(tmp, f);
    return true;
  }
  const b = fs.readFileSync(f);
  const out = /\.jpe?g$/.test(ext) ? cleanJpeg(b) : ext === '.png' ? cleanPng(b) : null;
  if (!out) return false;
  fs.writeFileSync(f, out);
  return true;
}
function clean(a) {
  const files = a._.slice(1);
  if (!files.length) die('clean needs files');
  for (const f of files) console.log(`${cleanFile(f) ? 'clean ' : 'skip  '} ${f}`);
}

// ------------------------------------------------------------ image
// genImage is shared by `image` and `batch`; returns the written paths.
async function genImage({ prompt: subject, out, model = 'gemini-3-pro-image', aspect = '16:9', size = '4K', n = 1, refs = [], raw = false }) {
  const prompt = raw ? subject : `${subject}\n\n${HOUSE_PHOTO}`;
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const imageConfig = { aspectRatio: aspect };
  if (!/2\.5/.test(model)) imageConfig.imageSize = size;   // 2.5-flash-image has no size option
  const body = {
    contents: [{ role: 'user', parts: [...refs.map(inline), { text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig },
  };
  // variants run in parallel; each is a separate request so they differ
  return Promise.all(Array.from({ length: n }, async (_, i) => {
    const res = await call('POST', `models/${model}:generateContent`, body);
    const img = (res.candidates?.[0]?.content?.parts || []).find(p => p.inlineData);
    if (!img) noOutput(res, model);
    let file = numbered(out, i, n);
    // the model decides the encoding; keep the extension honest
    const ext = img.inlineData.mimeType === 'image/jpeg' ? '.jpg' : '.png';
    if (path.extname(file).toLowerCase() !== ext) file = file.replace(/\.[^.]+$/, '') + ext;
    fs.writeFileSync(file, Buffer.from(img.inlineData.data, 'base64'));
    cleanFile(file);
    sidecar(file, { kind: 'image', model, aspect, size, refs, prompt: subject, house: !raw });
    return file;
  }));
}

async function image(a) {
  if (!a.prompt || !a.out) die('image needs --prompt and --out');
  const files = await genImage({ prompt: a.prompt, out: a.out, model: a.model, aspect: a.aspect, size: a.size, n: Number(a.n || 1), refs: list(a.ref), raw: !!a.raw });
  files.forEach(f => console.log(f));
  if (a.check) await check({ _: ['check', ...files] });
}

// ------------------------------------------------------------ check (cheap vision QA)
// Scores pictures against the rules in videos/CLAUDE.md with a fast model, so an agent can skip looking at
// every full-size image. One line per file; the verdict is also saved into the sidecar.
const RUBRIC = `You are the photo editor for BreeUp, an estate-management app for Nigerian residential estates.
Judge this image for use in a marketing video. Be strict. Check:
- african: every person is Black African and the place reads as a Nigerian estate (not Europe/US/Asia).
- attractive: the people are good-looking, well-groomed and stylish, like a premium lifestyle ad cast.
- artifacts: AI flaws such as warped hands, extra fingers, melted faces, broken objects, odd eyes.
- text: any readable text, gibberish lettering, number plates, logos or brand badges.
- quality: sharp, well lit, natural skin tones, good composition with room for captions.
Calibrate: 7 = usable in a film, 8 = strong, 9 = as good as a top stock agency, 5 or less = regenerate.
Only report text that a viewer could actually read or a recognisable logo; blurry background lettering is fine,
answer "none" for it. Only report artifacts a viewer would notice at normal size; otherwise answer "none".
Reply as JSON only.`;
async function checkOne(file) {
  const tmp = path.join(os.tmpdir(), `gchk-${process.pid}-${path.basename(file)}.jpg`);
  // send a 1024 px copy: enough to judge, a fraction of the upload
  convert(file, tmp, { maxSide: 1024 });
  const res = await call('POST', `models/gemini-flash-latest:generateContent`, {
    contents: [{ parts: [inline(tmp), { text: RUBRIC }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          score: { type: 'INTEGER' }, african: { type: 'BOOLEAN' }, attractive: { type: 'BOOLEAN' },
          artifacts: { type: 'STRING' }, text: { type: 'STRING' }, note: { type: 'STRING' },
        },
        required: ['score', 'african', 'attractive', 'artifacts', 'text', 'note'],
      },
    },
  });
  fs.rmSync(tmp, { force: true });
  const v = JSON.parse(res.candidates[0].content.parts[0].text);
  const side = file + '.json';
  if (fs.existsSync(side)) fs.writeFileSync(side, JSON.stringify({ ...JSON.parse(fs.readFileSync(side)), check: v }, null, 1));
  return v;
}
async function check(a) {
  const files = a._.slice(1);
  if (!files.length) die('check needs image files');
  const out = await Promise.all(files.map(async f => [f, await checkOne(f)]));
  for (const [f, v] of out) {
    const flags = [!v.african && 'NOT-AFRICAN', !v.attractive && 'NOT-ATTRACTIVE',
      !/^(none|no|)$/i.test(v.artifacts.trim()) && `artifacts: ${v.artifacts}`,
      !/^(none|no|)$/i.test(v.text.trim()) && `text: ${v.text}`].filter(Boolean);
    console.log(`${v.score >= 7 && v.african && v.attractive ? 'KEEP  ' : 'REJECT'} ${v.score}/10 ${path.basename(f)}${flags.length ? ' | ' + flags.join(' | ') : ''} | ${v.note}`);
  }
  return out;
}

// ------------------------------------------------------------ sheet (one small contact sheet)
// Tiles images into one numbered-order JPEG ~1600 px wide, so reviewing 8 pictures costs one small image read.
// No dependencies: sips (macOS) or ffmpeg makes BMP thumbnails, Node tiles the pixels.
function readBmp(file) {
  const b = fs.readFileSync(file);
  const off = b.readUInt32LE(10), w = b.readInt32LE(18), hRaw = b.readInt32LE(22), bpp = b.readUInt16LE(28);
  const h = Math.abs(hRaw), Bpp = bpp / 8, stride = Math.ceil((w * Bpp) / 4) * 4;
  const px = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    const sy = hRaw > 0 ? h - 1 - y : y;
    for (let x = 0; x < w; x++) {
      const s = off + sy * stride + x * Bpp, d = (y * w + x) * 3;
      px[d] = b[s]; px[d + 1] = b[s + 1]; px[d + 2] = b[s + 2];   // BGR kept as BGR
    }
  }
  return { w, h, px };
}
function writeBmp(file, w, h, px) {
  const stride = Math.ceil((w * 3) / 4) * 4, size = 54 + stride * h, b = Buffer.alloc(size);
  b.write('BM', 0); b.writeUInt32LE(size, 2); b.writeUInt32LE(54, 10); b.writeUInt32LE(40, 14);
  b.writeInt32LE(w, 18); b.writeInt32LE(h, 22); b.writeUInt16LE(1, 26); b.writeUInt16LE(24, 28);
  b.writeUInt32LE(stride * h, 34);
  for (let y = 0; y < h; y++) px.copy(b, 54 + (h - 1 - y) * stride, y * w * 3, (y + 1) * w * 3);
  fs.writeFileSync(file, b);
}
function sheet(a) {
  const files = a._.slice(1).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
  if (!files.length || !a.out) die('sheet needs --out and image files');
  // every thumb gets the same height and rows fill to maxW, so portrait and landscape pack tightly
  const rowH = Number(a.cell || 300), maxW = Number(a.width || 1600), gap = 8;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsheet-'));
  const thumbs = files.map((f, i) => {
    const t = path.join(tmp, `${i}.bmp`);
    convert(f, t, { height: rowH });
    return readBmp(t);
  });
  const rows = [[]];
  let x = gap;
  thumbs.forEach((t, i) => {
    if (x + t.w + gap > maxW && rows.at(-1).length) { rows.push([]); x = gap; }
    rows.at(-1).push({ t, i, x }); x += t.w + gap;
  });
  const W = Math.max(...rows.map(r => r.at(-1).x + r.at(-1).t.w + gap));
  const H = rows.length * (rowH + gap) + gap;
  const px = Buffer.alloc(W * H * 3, 24);
  rows.forEach((r, ri) => r.forEach(({ t, x: x0 }) => {
    const y0 = gap + ri * (rowH + gap);
    for (let y = 0; y < t.h; y++) t.px.copy(px, ((y0 + y) * W + x0) * 3, y * t.w * 3, (y + 1) * t.w * 3);
  }));
  const bmp = path.join(tmp, 'sheet.bmp');
  writeBmp(bmp, W, H, px);
  fs.mkdirSync(path.dirname(path.resolve(a.out)), { recursive: true });
  convert(bmp, a.out, { quality: 70 });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`${a.out}  (${W}x${H}, left to right, top to bottom)`);
  files.forEach((f, i) => console.log(`  ${i + 1}. ${path.basename(f)}`));
}

// ------------------------------------------------------------ batch (a whole film from one manifest)
// node tools/gemini.mjs batch media/generated/<film>/shots.json
// { "dir": "media/generated/t2", "size": "2K", "n": 2,
//   "shots": [ { "name": "hook", "prompt": "...", "aspects": ["16:9","9:16"], "ref": "optional.jpg" } ] }
// Skips shots that already have files (delete one to regenerate it), checks every new picture,
// and writes <dir>/_sheet.jpg. Prints one line per picture, nothing else.
async function batch(a) {
  const mf = a._[1];
  if (!mf) die('batch needs a manifest path');
  const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
  const dir = m.dir || path.dirname(mf);
  const jobs = [];
  for (const s of m.shots) {
    for (const asp of s.aspects || ['16:9', '9:16']) {
      const base = path.join(dir, `${s.name}-${asp.replace(':', 'x')}`);
      const exists = fs.readdirSync(dir).some(f => f.startsWith(path.basename(base)) && /\.(jpe?g|png)$/i.test(f));
      if (exists && !a.force) continue;
      jobs.push(() => genImage({ prompt: s.prompt, out: base + '.png', aspect: asp, size: s.size || m.size || '4K',
        n: s.n || m.n || 2, refs: list(s.ref), model: s.model || m.model, raw: !!s.raw }));
    }
  }
  console.log(`batch: ${jobs.length} prompts to generate`);
  // a few at a time keeps under the rate limit
  const made = [];
  for (let i = 0; i < jobs.length; i += 4) made.push(...(await Promise.all(jobs.slice(i, i + 4).map(j => j()))).flat());
  if (made.length && !a['no-check']) await check({ _: ['check', ...made] });
  const all = fs.readdirSync(dir).filter(f => /\.(jpe?g|png)$/i.test(f) && !f.startsWith('_')).sort().map(f => path.join(dir, f));
  if (all.length) sheet({ _: ['sheet', ...all], out: path.join(dir, '_sheet.jpg') });
}

// ------------------------------------------------------------ video (Veo)
async function video(a) {
  if (!a.prompt || !a.out) die('video needs --prompt and --out');
  const model = a.model || 'veo-3.1-generate-preview';
  const prompt = a.raw ? a.prompt : `${a.prompt}\n\n${HOUSE_VIDEO}`;
  const instance = { prompt };
  if (a.image) instance.image = { bytesBase64Encoded: fs.readFileSync(a.image).toString('base64'), mimeType: mimeOf(a.image) };
  const parameters = {
    aspectRatio: a.aspect || '16:9',
    resolution: a.resolution || '4k',
    durationSeconds: Number(a.seconds || 8),
    negativePrompt: a.negative || 'text, captions, subtitles, watermark, logo, cartoon, distorted hands, extra fingers',
  };
  fs.mkdirSync(path.dirname(path.resolve(a.out)), { recursive: true });
  let op = await call('POST', `models/${model}:predictLongRunning`, { instances: [instance], parameters });
  process.stderr.write('gemini: rendering video');
  while (!op.done) {
    await new Promise(r => setTimeout(r, 10000));
    process.stderr.write('.');
    op = await call('GET', op.name);
  }
  process.stderr.write('\n');
  if (op.error) fail(classify(op.error.code === 8 ? 429 : 400, JSON.stringify({ error: op.error })), `models/${model}:`);
  const samples = op.response?.generateVideoResponse?.generatedSamples || [];
  if (!samples.length) {
    const why = op.response?.generateVideoResponse?.raiMediaFilteredReasons;
    if (why) fail({ kind: 'safety', msg: [].concat(why).join('; ') }, `models/${model}:`);
    die(`no video returned: ${JSON.stringify(op.response).slice(0, 600)}`);
  }
  const res = await fetch(samples[0].video.uri, { headers: { 'x-goog-api-key': apiKey() }, redirect: 'follow' });
  if (!res.ok) die(`download failed ${res.status}`);
  fs.writeFileSync(a.out, Buffer.from(await res.arrayBuffer()));
  cleanFile(a.out);
  sidecar(a.out, { kind: 'video', model, ...parameters, firstFrame: a.image || null, prompt: a.prompt, house: !a.raw });
  console.log(a.out);
}

// ------------------------------------------------------------ tts
async function tts(a) {
  const textIn = a.text || (a.file && fs.readFileSync(a.file, 'utf8'));
  if (!textIn || !a.out) die('tts needs --text or --file, and --out');
  const model = a.model || 'gemini-2.5-pro-preview-tts';   // 3.8-flash-tts reads the style aloud (2026-10-03)
  const style = a.style || 'warmly and clearly, in a Nigerian English accent, unhurried';
  const body = {
    // "Say <style>: <text>" is the documented way to steer delivery; newer TTS models may read the style aloud,
    // so check the clip length (about 2.5 words a second) after generating.
    contents: [{ parts: [{ text: `Say ${style}: ${textIn.trim()}` }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: a.voice || 'Kore' } } },
    },
  };
  const res = await call('POST', `models/${model}:generateContent`, body);
  const part = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (!part) noOutput(res, model);
  const pcm = Buffer.from(part.inlineData.data, 'base64');
  const rate = Number((part.inlineData.mimeType.match(/rate=(\d+)/) || [])[1] || 24000);
  fs.mkdirSync(path.dirname(path.resolve(a.out)), { recursive: true });
  fs.writeFileSync(a.out, Buffer.concat([wavHeader(pcm.length, rate), pcm]));
  sidecar(a.out, { kind: 'tts', model, voice: a.voice || 'Kore', style, text: textIn });
  console.log(a.out);
}
function wavHeader(len, rate, ch = 1, bits = 16) {
  const b = Buffer.alloc(44);
  b.write('RIFF', 0); b.writeUInt32LE(36 + len, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * ch * bits / 8, 28); b.writeUInt16LE(ch * bits / 8, 32);
  b.writeUInt16LE(bits, 34); b.write('data', 36); b.writeUInt32LE(len, 40);
  return b;
}

// ------------------------------------------------------------ files (upload video/images for the model to watch)
const MEDIA_MIME = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.m4v': 'video/mp4',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
async function upload(file) {
  const mime = MEDIA_MIME[path.extname(file).toLowerCase()] || die(`unsupported file ${file}`);
  const bytes = fs.readFileSync(file);
  const start = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey(), 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes.length), 'X-Goog-Upload-Header-Content-Type': mime,
      'Content-Type': 'application/json' },
    body: JSON.stringify({ file: { display_name: path.basename(file) } }),
  });
  if (!start.ok) fail(classify(start.status, await start.text()), 'files:upload');
  const url = start.headers.get('x-goog-upload-url') || die(`upload start failed ${start.status}`);
  const done = await fetch(url, { method: 'POST', headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' }, body: bytes });
  let f = (await done.json()).file;
  while (f.state === 'PROCESSING') { await new Promise(r => setTimeout(r, 4000)); f = await call('GET', f.name); }
  if (f.state !== 'ACTIVE') die(`upload failed: ${JSON.stringify(f).slice(0, 300)}`);
  return { fileData: { mimeType: mime, fileUri: f.uri } };
}
// a local file, or a YouTube link (the API watches YouTube directly)
async function mediaPart(src) {
  if (/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(src)) return { fileData: { fileUri: src } };
  if (/^https?:/.test(src)) die(`only YouTube links can be read directly; save other videos into moodboard/inbox/ first (${src})`);
  return upload(src);
}
async function ask(model, parts) {
  const res = await call('POST', `models/${model}:generateContent`, { contents: [{ parts }] });
  return (res.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
}
const slug = s => s.replace(/^https?:\/\/[^/]+\//, '').replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60);
const read = f => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');

// ------------------------------------------------------------ learn (self-improving style guide)
// node tools/gemini.mjs learn [file|youtube-url ...] [--note "what I like about it"]
// No arguments: learns everything in moodboard/inbox/ and moves it to moodboard/refs/.
// Each reference gets a breakdown in moodboard/refs/<slug>.md, then moodboard/STYLE.md is rewritten to fold
// in what's new. STYLE.md is what agents read; it stays short because it is rewritten, not appended to.
const MB = path.join(ROOT, 'moodboard');
const BREAKDOWN = `You are a senior motion designer studying a reference for BreeUp, a mobile-first estate-management app
for Nigerian residential estates (audience: residents and older estate committee members who prefer real
photos and footage over flat graphics). Break this reference down so another designer can recreate its feel
in an HTML + GSAP motion-graphics pipeline that composites real photos/footage with type and UI screenshots.
Write markdown with these sections, concrete and measurable (seconds, px at 1080 wide, hex colours, easing names):
## Summary (2 lines)  ## Format and pacing (aspect, length, average shot length, cuts per 10 s, beat sync)
## Shot by shot (timestamp, what's on screen, camera/motion, transition out)
## Motion techniques (each: what it is, timing, easing, how to build it with GSAP/CSS)
## Typography (faces or closest free Google Fonts, sizes, weights, how text enters and leaves)
## Colour and grade (palette hex, grade, contrast)  ## Sound (music feel, bpm, SFX, VO style)
## Steal this (the 3-6 most transferable ideas for BreeUp)  ## Don't copy (what won't suit our audience)`;
async function learn(a) {
  fs.mkdirSync(path.join(MB, 'inbox'), { recursive: true });
  fs.mkdirSync(path.join(MB, 'refs', 'media'), { recursive: true });
  let srcs = a._.slice(1);
  const fromInbox = !srcs.length;
  if (fromInbox) srcs = fs.readdirSync(path.join(MB, 'inbox')).filter(f => !f.startsWith('.')).map(f => path.join(MB, 'inbox', f));
  if (!srcs.length) die('nothing to learn: pass a file or YouTube link, or drop files in moodboard/inbox/');
  const model = a.model || 'gemini-pro-latest';
  const made = [];
  for (const src of srcs) {
    console.error(`learn: studying ${path.basename(src)}`);
    const note = a.note ? `\n\nJosh's note about this reference: ${a.note}` : '';
    const md = await ask(model, [await mediaPart(src), { text: BREAKDOWN + note }]);
    const name = slug(path.basename(src));
    const out = path.join(MB, 'refs', `${name}.md`);
    fs.writeFileSync(out, `# Reference: ${path.basename(src)}\n\nSource: ${src}\nLearned: ${new Date().toISOString().slice(0, 10)}${a.note ? `\nJosh's note: ${a.note}` : ''}\n\n${md}\n`);
    if (fromInbox) fs.renameSync(src, path.join(MB, 'refs', 'media', path.basename(src)));
    made.push(out);
    console.log(out);
  }
  await restyle(made, model);
}
async function restyle(newRefs, model) {
  const styleFile = path.join(MB, 'STYLE.md');
  const prompt = `You maintain STYLE.md, the living motion and visual style guide for BreeUp's marketing and tutorial videos.
Hard rules that always win (from videos/CLAUDE.md):
${read(path.join(ROOT, 'CLAUDE.md')).slice(0, 6000)}

Current STYLE.md:
${read(styleFile) || '(empty, write the first version)'}

New reference breakdowns:
${newRefs.map(f => read(f)).join('\n\n---\n\n')}

Rewrite STYLE.md to fold in what the new references teach. Keep what still holds, sharpen vague rules into
measurable ones, resolve conflicts (newer references and Josh's notes win), and cite references by file name
in brackets. Max 140 lines. Sections: Pacing, Motion vocabulary (named techniques with timings and easing),
Typography, Colour and grade, Photography and footage, Transitions, Sound, Formats (9:16 first), Recipes
(short GSAP snippets for the 3-5 signature moves). Output only the markdown file.`;
  const md = await ask(model, [{ text: prompt }]);
  fs.writeFileSync(styleFile, md.replace(/^```(markdown)?\n?|```$/g, '') + '\n');
  console.log(`${styleFile} updated`);
}

// ------------------------------------------------------------ review (Gemini watches our render)
// node tools/gemini.mjs review renders/x.mp4 [--film films/T2-pay-service-charge]
// Scores a render against the rules and STYLE.md, with timestamps. Writes <film>/docs/review-<date>.md when
// --film is given and prints the summary, so an agent doesn't have to look at frames itself.
async function review(a) {
  const file = a._[1] || die('review needs a video file');
  const film = a.film ? path.join(ROOT, a.film) : null;
  const prompt = `You are the creative director reviewing a BreeUp video before release. Be specific and strict.
Rules: ${read(path.join(ROOT, 'CLAUDE.md')).slice(0, 6000)}
Style guide: ${read(path.join(MB, 'STYLE.md')).slice(0, 8000) || '(none yet)'}
${film ? `Shot list: ${read(path.join(film, 'docs', 'shotlist.md')).slice(0, 6000)}` : ''}
Watch the whole video. Reply in markdown:
## Scores (1-10): hook, readability on a phone, motion quality, pacing, image quality, African authenticity,
attractiveness of people, brand consistency, sound.
## Top 5 fixes (each with timestamp, what's wrong, exact fix)
## Keep (what works)
## Lessons (1-3 general lessons worth adding to the style guide, or "none")`;
  const md = await ask(a.model || 'gemini-pro-latest', [await mediaPart(file), { text: prompt }]);
  if (film) {
    const out = path.join(film, 'docs', `review-${new Date().toISOString().slice(0, 10)}-${path.basename(file, path.extname(file))}.md`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, md + '\n');
    console.error(`saved ${out}`);
  }
  console.log(md);
}

// ------------------------------------------------------------ main
const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];

// ------------------------------------------------------------ music (Lyria)
async function music(a) {
  if (!a.prompt || !a.out) die('music needs --prompt and --out');
  const model = a.model || 'lyria-3-pro-preview';
  const res = await call('POST', `models/${model}:generateContent`, {
    contents: [{ parts: [{ text: a.prompt }] }], generationConfig: { responseModalities: ['AUDIO'] },
  });
  const part = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (!part) noOutput(res, model);
  fs.mkdirSync(path.dirname(path.resolve(a.out)), { recursive: true });
  // Lyria returns MP3 with a C2PA manifest; decoding to WAV drops every tag
  const tmp = a.out + '.src.mp3';
  fs.writeFileSync(tmp, Buffer.from(part.inlineData.data, 'base64'));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-map_metadata', '-1', '-fflags', '+bitexact', '-ar', '48000', a.out]);
  fs.rmSync(tmp);
  sidecar(a.out, { kind: 'music', model, prompt: a.prompt });
  console.log(a.out);
}

const cmds = { image, video, tts, music, check, sheet, batch, learn, review, clean, usage };
if (!cmds[cmd]) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 22).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(cmd ? 1 : 0);
}
await cmds[cmd](args);
