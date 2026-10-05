#!/usr/bin/env node
// Free stock photos and video clips for a film, in both shapes, from Pexels (Pixabay as a fallback). Jev picks the
// best match from each result's description, so nobody looks through thumbnails. Both sites' licences allow free
// commercial use without attribution; we still log every file with its source in media/STOCK.md.
//
//   node tools/stock.mjs photo "smiling woman using a phone at home" --out films/W3-x/assets/photos/hook
//        -> hook-9x16.jpg and hook-16x9.jpg
//   node tools/stock.mjs video "busy office, people at laptops" --out films/W3-x/assets/clips/hook [--seconds 8]
//        -> hook-9x16.webm and hook-16x9.webm (VP9, silent, cropped to 1080x1920 / 1920x1080)
//
// Keys: PEXELS_API_KEY and/or PIXABAY_API_KEY in the environment or videos/.env (both free).
// Exit codes: 1 nothing found or no key, 2 out of quota, as gemini.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ask } from './jev.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [kind, query] = process.argv.slice(2);
const opt = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const out = opt('out'), secs = Number(opt('seconds', 8));
if (!/^(photo|video)$/.test(kind || '') || !query || !out) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 13).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(1);
}
const env = (k) => process.env[k] || [path.join(ROOT, '..', '.env'), path.join(ROOT, '.env')].map((f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } })
  .join('\n').match(new RegExp(`^${k}\\s*=\\s*"?([^"\\n]+)"?`, 'm'))?.[1]?.trim();
const PEXELS = env('PEXELS_API_KEY'), PIXABAY = env('PIXABAY_API_KEY');
if (!PEXELS && !PIXABAY) { console.error('stock: no key. Put PEXELS_API_KEY=... (pexels.com/api, free) in videos/.env'); process.exit(1); }

async function get(url, headers = {}) {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
  if (r.status === 429) { console.error('stock: rate limit or quota reached; try again later'); process.exit(2); }
  if (!r.ok) throw new Error(`${r.status} ${url.split('?')[0]}`);
  return r.json();
}
// candidates: { id, desc, url (best file), page (credit link), by, w, h }
async function search(orientation) {
  const found = [];
  if (PEXELS) try {
    if (kind === 'photo') {
      const d = await get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=${orientation}&size=large&per_page=15`, { Authorization: PEXELS });
      for (const p of d.photos || []) found.push({ id: `pexels-${p.id}`, desc: p.alt || '', url: p.src.original, page: p.url, by: p.photographer, w: p.width, h: p.height });
    } else {
      const d = await get(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=${orientation}&size=medium&per_page=15`, { Authorization: PEXELS });
      for (const v of d.videos || []) {
        const f = (v.video_files || []).filter((x) => x.file_type === 'video/mp4' && x.width && x.height).sort((a, b) => b.width * b.height - a.width * a.height)
          .find((x) => Math.min(x.width, x.height) <= 2200) || v.video_files?.[0];
        if (f && v.duration >= Math.min(secs, 5)) found.push({ id: `pexels-v${v.id}`, desc: v.url.split('/').filter(Boolean).pop().replace(/-\d+$/, '').replace(/-/g, ' '), url: f.link, page: v.url, by: v.user?.name, w: f.width, h: f.height });
      }
    }
  } catch (e) { console.error(`stock: Pexels: ${e.message}`); }
  if (!found.length && PIXABAY) try {
    const o = orientation === 'portrait' ? 'vertical' : 'horizontal';
    if (kind === 'photo') {
      const d = await get(`https://pixabay.com/api/?key=${PIXABAY}&q=${encodeURIComponent(query)}&orientation=${o}&image_type=photo&safesearch=true&per_page=15`);
      for (const p of d.hits || []) found.push({ id: `pixabay-${p.id}`, desc: p.tags, url: p.largeImageURL, page: p.pageURL, by: p.user, w: p.imageWidth, h: p.imageHeight });
    } else {
      const d = await get(`https://pixabay.com/api/videos/?key=${PIXABAY}&q=${encodeURIComponent(query)}&safesearch=true&per_page=15`);
      for (const v of d.hits || []) { const f = v.videos.large?.url ? v.videos.large : v.videos.medium; if (f?.url && (orientation === 'portrait') === (f.height > f.width)) found.push({ id: `pixabay-v${v.id}`, desc: v.tags, url: f.url, page: v.pageURL, by: v.user, w: f.width, h: f.height }); }
    }
  } catch (e) { console.error(`stock: Pixabay: ${e.message}`); }
  return found;
}
// Jev reads the descriptions and picks the closest match (falls back to the search's own order)
async function pick(cands) {
  if (cands.length < 2) return cands[0];
  try {
    const opts = Object.fromEntries(cands.slice(0, 15).map((c, i) => [`c${i}`, c.desc || '(no description)']));
    const a = await ask({ wanted: query, use: 'opening shot of a product video, behind a title' },
      { best: { type: 'choice', instructions: 'Which stock result best matches `wanted`, looks professional, and works behind a title?', criteria: opts } });
    const k = Object.entries(a.best.probabilities).sort((x, y) => y[1] - x[1])[0][0];
    return cands[Number(k.slice(1))];
  } catch { return cands[0]; }
}
const dl = async (url, f) => { const r = await fetch(url, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error(`download ${r.status}`); fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); };

fs.mkdirSync(path.dirname(out), { recursive: true });
const log = path.join(ROOT, 'media', 'STOCK.md');
let made = 0;
for (const [shape, orientation, W, H] of [['9x16', 'portrait', 1080, 1920], ['16x9', 'landscape', 1920, 1080]]) {
  const c = await pick(await search(orientation));
  if (!c) { console.error(`stock: nothing found for "${query}" (${shape})`); continue; }
  const raw = `${out}-${shape}.download`;
  await dl(c.url, raw);
  const crop = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`;
  const file = kind === 'photo' ? `${out}-${shape}.jpg` : `${out}-${shape}.webm`;
  if (kind === 'photo') execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-vf', crop, '-q:v', '2', file]);
  else execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-t', String(secs), '-an', '-vf', `${crop},fps=30`, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '30', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', file]);
  fs.rmSync(raw);
  fs.appendFileSync(log, `- \`${path.relative(ROOT, file)}\`: ${c.desc || query} · ${c.by || 'unknown'} · ${c.page}\n`);
  console.log(`  ${kind} ${path.relative(ROOT, file)}: ${c.desc || query} (${c.page})`);
  made++;
}
process.exit(made ? 0 : 1);
