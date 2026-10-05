#!/usr/bin/env node
// Clipwalk: a small local web app over the film pipeline (it started as BreeUp's video tooling). No dependencies; it only reads and writes the
// same files the command-line tools use (film.json, docs/vo/lines.txt, media/generated/<ID>/shots.json) and runs
// tools/make.mjs, jev.mjs and gemini.mjs for you, streaming their output to the page.
//
//   npm run studio            # then open http://localhost:4747
//   PORT=5000 npm run studio
//
// Jobs run one at a time (renders are heavy and Gemini quota is shared), in a queue.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');            // vid-gen/
const FINAL = path.resolve(ROOT, '..', 'Final videos');
const FILMS = path.join(ROOT, 'films');
const RENDERS = path.join(ROOT, 'renders');
const SCREENS = path.join(ROOT, 'media', 'screens');
const PORT = Number(process.env.PORT) || 4747;

const KINDS = { T: 'Tutorials', E: 'Explainers', A: 'Ads', S: 'Social reels', H: 'Homepage', L: 'Launch' };
const idOf = (folder) => folder.split('-')[0];
const readJSON = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const ls = (d) => { try { return fs.readdirSync(d); } catch { return []; } };
const mtime = (f) => { try { return fs.statSync(f).mtimeMs; } catch { return 0; } };
const filmDir = (folder) => {
  if (!/^[A-Z]\d+[A-Za-z0-9-]*$/.test(folder)) return null;
  const d = path.join(FILMS, folder);
  return fs.existsSync(path.join(d, 'film.json')) ? d : null;
};
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);
const duration = (f) => { try { return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString()); } catch { return null; } };

// ------------------------------------------------------------------ what a film has
function summary(folder) {
  const dir = path.join(FILMS, folder), id = idOf(folder), cfg = readJSON(path.join(dir, 'film.json'), {});
  const renders = ls(RENDERS).filter((f) => f.startsWith(`breeup-${id}-`) && f.endsWith('.mp4'));
  const finals = ls(FINAL).filter((f) => f.startsWith(`${id} `) && f.endsWith('.mp4'));
  const sheets = ls(path.join(RENDERS, '_stills')).filter((f) => f.startsWith(`_sheet-breeup-${id}-`))
    .sort((a, b) => mtime(path.join(RENDERS, '_stills', b)) - mtime(path.join(RENDERS, '_stills', a)));
  const linesFile = path.join(dir, 'docs', 'vo', 'lines.txt');
  const lines = fs.existsSync(linesFile) ? fs.readFileSync(linesFile, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean) : null;
  // a thumbnail: the latest contact sheet, else a picture, else a product screen
  const pic = (d, url) => { const f = ls(d).find((x) => /\.(jpe?g|png)$/i.test(x) && !x.startsWith('_')); return f && `${url}/${encodeURIComponent(f)}`; };
  const poster = sheets[0] ? `/files/renders/_stills/${encodeURIComponent(sheets[0])}` : pic(path.join(ROOT, 'media', 'generated', id), `/files/media/generated/${id}`)
    || pic(path.join(dir, 'assets', 'photos'), `/files/films/${folder}/assets/photos`) || pic(path.join(dir, 'assets', 'screens'), `/files/films/${folder}/assets/screens`) || null;
  const status = finals.length ? 'Final' : renders.length ? 'Rendered' : sheets.length ? 'Stills checked' : (cfg.vo || []).length ? 'Voiced' : 'Draft';
  return {
    folder, id, kind: KINDS[id[0]] || 'Other', title: cfg.title || folder, duration: cfg.duration, formats: cfg.formats || ['16x9', '9x16'],
    status, renders, finals, sheets, poster, hasLines: !!lines, lineCount: lines?.length || 0,
    hasShots: fs.existsSync(path.join(ROOT, 'media', 'generated', id, 'shots.json')),
    tutorial: /tutorial\(\{/.test(fs.readFileSync(path.join(dir, 'film.js'), 'utf8').slice(0, 4000) || ''),
    updated: Math.max(mtime(path.join(dir, 'film.json')), mtime(linesFile)),
  };
}
const safeSummary = (f) => { try { return summary(f); } catch { return null; } };

function detail(folder) {
  const dir = filmDir(folder), id = idOf(folder), cfg = readJSON(path.join(dir, 'film.json'), {});
  const linesFile = path.join(dir, 'docs', 'vo', 'lines.txt');
  const lines = fs.existsSync(linesFile) ? fs.readFileSync(linesFile, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean) : [];
  // each line's current voice file, and whether it still matches the text (else make will re-voice it)
  const vo = lines.map((text, i) => {
    const f = `audio/vo-${i + 1}.wav`, placed = (cfg.vo || [])[i];
    return { text, file: fs.existsSync(path.join(dir, f)) ? `/files/films/${folder}/${f}?v=${mtime(path.join(dir, f))}` : null,
      start: placed?.[0] ?? null, secs: placed?.[3] ?? null, fresh: placed?.[2] === text };
  });
  const gen = path.join(ROOT, 'media', 'generated', id);
  const shots = readJSON(path.join(gen, 'shots.json'));
  const pictures = ls(gen).filter((f) => /\.(jpe?g|png)$/.test(f) && !f.startsWith('_'))
    .map((f) => ({ name: f, url: `/files/media/generated/${id}/${f}?v=${mtime(path.join(gen, f))}` }));
  const docs = ls(path.join(dir, 'docs')).filter((f) => f.endsWith('.md'));
  const music = path.join(dir, 'audio', 'music.wav'), mix = path.join(dir, 'audio', 'mix.wav');
  return {
    ...summary(folder), cfg: { title: cfg.title, duration: cfg.duration, formats: cfg.formats, music: cfg.music || '', voice: cfg.voice || {}, vo_at: cfg.vo_at || [] },
    vo, shots, pictures, docs, lint: lintState(folder), lineSecs: fs.existsSync(linesFile) ? lineSecs(folder) : [],
    music: fs.existsSync(music) ? `/files/films/${folder}/audio/music.wav?v=${mtime(music)}` : null,
    mix: fs.existsSync(mix) ? `/files/films/${folder}/audio/mix.wav?v=${mtime(mix)}` : null,
  };
}

function save(folder, body) {
  const dir = filmDir(folder), id = idOf(folder), cfgPath = path.join(dir, 'film.json');
  const cfg = readJSON(cfgPath, {});
  if (typeof body.title === 'string' && body.title.trim()) cfg.title = body.title.trim();
  if (body.duration != null && Number(body.duration) > 0) {
    // a hand-set duration replaces the authored one; make re-applies any voice stretch on the next vo run
    if (cfg.duration_authored != null) cfg.duration_authored = Number(body.duration); else cfg.duration = Number(body.duration);
  }
  if (typeof body.music === 'string') { if (body.music.trim()) cfg.music = body.music.trim(); else delete cfg.music; }
  if (Array.isArray(body.formats) && body.formats.length) cfg.formats = body.formats;
  if (body.voice && typeof body.voice === 'object') {
    const v = { ...(cfg.voice || {}) };
    for (const k of ['style', 'voice', 'model']) { if (body.voice[k]) v[k] = body.voice[k]; else delete v[k]; }
    if (body.voice.gap !== '' && body.voice.gap != null) v.gap = Number(body.voice.gap);
    cfg.voice = v;
  }
  if (Array.isArray(body.vo_at)) cfg.vo_at = body.vo_at.map((x) => (x === '' || x == null ? null : Number(x)));
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 1) + '\n');
  if (Array.isArray(body.lines)) {
    const f = path.join(dir, 'docs', 'vo', 'lines.txt');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, body.lines.map((l) => String(l).replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n') + '\n');
  }
  if (body.shots && typeof body.shots === 'object') {
    const f = path.join(ROOT, 'media', 'generated', id, 'shots.json');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(body.shots, null, 1) + '\n');
  }
}

// a new film starts as a copy of an existing one (its scenes, screens and fonts), with fresh voice and pictures
function create({ id, name, title, from }) {
  if (!/^[A-Z]\d+$/.test(id || '')) throw new Error('ID must be a letter and a number, like T8 or E2.');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name || '')) throw new Error('Short name: lowercase words joined by dashes, like pay-by-card.');
  if (ls(FILMS).some((f) => idOf(f) === id)) throw new Error(`${id} already exists.`);
  const src = filmDir(from || '');
  if (!src) throw new Error('Pick a film to start from.');
  const folder = `${id}-${name}`, dest = path.join(FILMS, folder);
  const skip = (rel) => rel === 'audio' || rel === path.join('assets', 'photos') || (rel.startsWith('docs') && /review|critique/.test(rel)) || rel === 'build.sh';
  const copy = (a, b, rel = '') => {
    fs.mkdirSync(b, { recursive: true });
    for (const f of fs.readdirSync(a)) {
      const r = path.join(rel, f);
      if (skip(r)) continue;
      const s = path.join(a, f);
      if (fs.statSync(s).isDirectory()) copy(s, path.join(b, f), r); else fs.copyFileSync(s, path.join(b, f));
    }
  };
  copy(src, dest);
  fs.mkdirSync(path.join(dest, 'audio'), { recursive: true });
  const cfg = readJSON(path.join(src, 'film.json'), {});
  for (const k of ['vo', 'retime', 'duration_authored']) delete cfg[k];
  if (readJSON(path.join(src, 'film.json'), {}).duration_authored) cfg.duration = readJSON(path.join(src, 'film.json')).duration_authored;
  cfg.title = title?.trim() || name.replace(/-/g, ' ');
  fs.writeFileSync(path.join(dest, 'film.json'), JSON.stringify(cfg, null, 1) + '\n');
  const shots = path.join(ROOT, 'media', 'generated', idOf(from), 'shots.json');
  if (fs.existsSync(shots)) {
    fs.mkdirSync(path.join(ROOT, 'media', 'generated', id), { recursive: true });
    const m = readJSON(shots);
    for (const s of m.shots || []) if (s.ref) delete s.ref;   // refs point at the old film's faces
    fs.writeFileSync(path.join(ROOT, 'media', 'generated', id, 'shots.json'), JSON.stringify(m, null, 1) + '\n');
  }
  fs.mkdirSync(path.join(dest, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(dest, 'docs', 'shotlist.md'), `# ${id} ${cfg.title}\n\nStarted in Studio from ${from}. Scenes, screens and timings are still ${from}'s: edit film.js.\n`);
  return folder;
}

// ------------------------------------------------------------------ workspace, keys, pricing
// Clipwalk isn't only for BreeUp: the workspace (name, colours, logo, end-card line) brands every film made here.
const WS = path.join(HERE, 'workspace.json'), BRAND = path.join(HERE, 'brand');
const WS_DEFAULT = { name: 'BreeUp', tagline: 'Dues, gate access, approvals and notices in one place.', stockHint: 'Black African, Nigerian',
  brand: { green: '#1a472a', deep: '#123220', cream: '#f6f4ee', gold: '#c9a84c' }, logo: 'films/T3-resident-account/assets/logo.svg' };
const workspace = () => { const k = keyStatus(); return { ...WS_DEFAULT, ...readJSON(WS, {}), stock: !!(k.pexels || k.pixabay) }; };
function saveWorkspace(b) {
  const w = workspace();
  if (typeof b.name === 'string' && b.name.trim()) w.name = b.name.trim().slice(0, 40);
  if (typeof b.tagline === 'string') w.tagline = b.tagline.trim().slice(0, 120);
  if (typeof b.stockHint === 'string') w.stockHint = b.stockHint.trim().slice(0, 60);
  if (b.brand) for (const k of ['green', 'deep', 'cream', 'gold']) if (/^#[0-9a-f]{6}$/i.test(b.brand[k] || '')) w.brand[k] = b.brand[k];
  if (typeof b.logo === 'string' && b.logo.startsWith('data:image/')) {   // an uploaded logo, as a data URL
    const m = /^data:image\/(svg\+xml|png|jpeg);base64,(.+)$/.exec(b.logo);
    if (!m) throw new Error('Logo must be SVG, PNG or JPEG.');
    fs.mkdirSync(BRAND, { recursive: true });
    for (const f of ls(BRAND)) fs.rmSync(path.join(BRAND, f));
    const f = path.join(BRAND, `logo.${{ 'svg+xml': 'svg', png: 'png', jpeg: 'jpg' }[m[1]]}`);
    fs.writeFileSync(f, Buffer.from(m[2], 'base64'));
    w.logo = path.relative(ROOT, f);
  }
  if (b.logo === null) w.logo = '';
  const { stock, ...keep } = w;
  fs.writeFileSync(WS, JSON.stringify(keep, null, 1) + '\n');
  return w;
}
// API keys live in videos/.env (git-ignored). Studio only says whether each is set; it never sends a key back.
const ENV = path.resolve(ROOT, '..', '.env');
const ENV_LOCAL = path.join(ROOT, '.env');
const KEYS = { gemini: 'GEMINI_API_KEY', typesafe: 'TYPESAFE_API_KEY', pexels: 'PEXELS_API_KEY', pixabay: 'PIXABAY_API_KEY' };
function keyStatus() {
  const txt = [ENV, ENV_LOCAL].map((f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } }).join('\n');
  return Object.fromEntries(Object.entries(KEYS).map(([k, v]) => [k, !!process.env[v] || new RegExp(`^${v}\\s*=\\s*\\S`, 'm').test(txt)]));
}
function setKeys(b) {
  const f = fs.existsSync(ENV_LOCAL) && !fs.existsSync(ENV) ? ENV_LOCAL : ENV;
  let txt = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  for (const [k, v] of Object.entries(KEYS)) {
    const val = String(b[k] || '').trim();
    if (!val) continue;
    if (!/^[\w.-]{10,200}$/.test(val)) throw new Error(`That doesn't look like a ${k} key.`);
    txt = new RegExp(`^${v}\\s*=.*$`, 'm').test(txt) ? txt.replace(new RegExp(`^${v}\\s*=.*$`, 'm'), `${v}=${val}`) : `${txt.replace(/\n?$/, '\n')}${v}=${val}\n`;
  }
  fs.writeFileSync(f, txt.replace(/^\n/, ''), { mode: 0o600 });
  return keyStatus();
}
const PRICING = path.join(HERE, 'pricing.json');
// what's been spent so far, from tools/usage.log (one line per API call on this machine)
function spend() {
  const r = readJSON(PRICING, {}).rates || {};
  const per = { 'gemini-3-pro-image': r.image_2k, 'veo-3.1-generate-preview': (r.veo_second_1080p || 0) * 8, 'veo-3.1-fast-generate-preview': (r.veo_fast_second_1080p || 0) * 8,
    'lyria-3-pro-preview': r.music_song, 'gemini-flash-latest': r.image_check, 'gemini-pro-latest': 0.06 };
  const rows = {};
  let lines = [];
  try { lines = fs.readFileSync(path.join(ROOT, 'tools', 'usage.log'), 'utf8').trim().split('\n'); } catch {}
  for (const l of lines) {
    const [at, model, , tok] = l.split('\t');
    if (!model) continue;
    const cost = /^jev/.test(model) ? (Number(tok) || 0) / 1e6 * (r.jev_in_per_m || 0) : /tts/.test(model) ? 0.004 : per[model] ?? 0.01;
    const row = (rows[model] ||= { model, calls: 0, cost: 0, last: at });
    row.calls++; row.cost += cost; row.last = at;
  }
  const list = Object.values(rows).sort((a, b) => b.cost - a.cost);
  return { total: list.reduce((a, b) => a + b.cost, 0), rows: list, since: lines[0]?.split('\t')[0] || null };
}

// A walkthrough becomes a tutorial film: each captured screen is a step, its caption the voice-over line,
// and the control the AI pressed gets the kit's gold ring and a tap. Branded with the workspace.
// Several walks make one film with "parts": e.g. the admin on a laptop, then a resident on a phone. Each view is
// { name, role }; the kit switches device between them.
function filmFromWalk(walks, { id, name, title, voice = true, brand: vb, voiceName, owner, opener }) {
  const views = (Array.isArray(walks) ? walks : [{ name: walks }]).map((v) => ({ ...v, w: readJSON(path.join(SCREENS, v.name, 'walk.json')) }))
    .filter((v) => v.w?.shots?.length);
  if (!views.length) throw new Error('That walkthrough has no screens.');
  const walkName = views.map((v) => v.name).join(' + '), multi = views.length > 1;
  const folder = create({ id, name, title, from: 'T3-resident-account' });
  const dir = path.join(FILMS, folder);
  // a friend's video starts neutral, never in the workspace owner's brand
  const ws0 = owner && owner !== 'owner' ? { name: vb?.host || 'Product', tagline: '', logo: '',
    brand: { green: '#1f3a5f', deep: '#0f1b2d', cream: '#f7f7f4', gold: '#f5a524' } } : workspace();
  // this video's own brand (from the follow-up questions) over the workspace's
  const ws = { ...ws0, ...(vb?.name ? { name: String(vb.name).slice(0, 40) } : {}), ...(vb?.tagline ? { tagline: String(vb.tagline).slice(0, 120) } : {}),
    brand: { ...ws0.brand, ...brandFromColor(vb?.color) },
    logo: vb?.logo ? saveUpload(vb.logo, path.join('media', 'brands', `${id}-logo`)) || ws0.logo : ws0.logo };
  // drop the template's screens, photos and script: everything comes from the walk
  fs.rmSync(path.join(dir, 'assets', 'screens'), { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'assets', 'screens'), { recursive: true });
  fs.rmSync(path.join(ROOT, 'media', 'generated', id), { recursive: true, force: true });
  if (ws.logo && fs.existsSync(path.join(ROOT, ws.logo))) {
    const ext = path.extname(ws.logo);
    for (const f of ls(path.join(dir, 'assets'))) if (/^logo\./.test(f)) fs.rmSync(path.join(dir, 'assets', f));
    fs.copyFileSync(path.join(ROOT, ws.logo), path.join(dir, 'assets', 'logo.svg' + (ext === '.svg' ? '' : '')));
    if (ext !== '.svg') fs.renameSync(path.join(dir, 'assets', 'logo.svg'), path.join(dir, 'assets', `logo${ext}`));
  } else for (const f of ls(path.join(dir, 'assets'))) if (/^logo\./.test(f)) fs.rmSync(path.join(dir, 'assets', f));
  const human = (s) => { const t = String(s).replace(/-\d+$/, '').replace(/-/g, ' ').trim(); return t.charAt(0).toUpperCase() + t.slice(1); };
  const words = (s) => String(s || '').split(/\s+/).filter(Boolean).length;
  const hookTo = 4.5;
  let t = hookTo + 0.4;
  const screens = {}, seq = [], steps = [], rings = [], cam = [], regions = {}, hits = [[0, 'hook', 'sub', { len: 0.8 }]], lines = [title], at = [0.3], parts = [];
  const total = views.reduce((a, v) => a + v.w.shots.length, 0);
  let i = -1;
  for (const [vi, { name: wn, role, w }] of views.entries()) {
  const laptop = w.device === 'laptop', [SW, SH] = w.size || (laptop ? [2160, 1350] : [780, 1688]);
  parts.push({ from: vi ? +t.toFixed(2) : 0, device: laptop ? 'laptop' : 'phone' });
  if (vi) hits.push([+(t - 0.35).toFixed(2), 'switch device', 'whoosh', { len: 0.6, from: 600, to: 2600 }]);
  w.shots.forEach((s, si) => {
    i++;
    const firstOfView = si === 0, who = multi && role ? role.trim() : '';
    const key = `s${i + 1}`, dur = Math.min(9, Math.max(4.2, Math.max(words(s.caption), words((s.does || []).join(' '))) / 2.5 + 1.8));
    const file = multi ? `v${vi + 1}-${s.file}` : s.file;
    fs.copyFileSync(path.join(SCREENS, wn, s.file), path.join(dir, 'assets', 'screens', file));
    screens[key] = `assets/screens/${file}`;
    seq.push([key, i ? +t.toFixed(2) : 0]);
    // step text: what was done on the screen (from the walk), else the screen's own caption
    const does = s.does || [], sentence = does.map((x, k) => (k ? x[0].toLowerCase() + x.slice(1) : x)).join(', then ');
    const last = i === total - 1;
    // one action: the title says it all, so the line under it says where you are; several: list them in order
    const where = s.caption && s.caption !== human(s.name) ? `On “${s.caption.replace(/[.!]$/, '')}”.` : '';
    const body = w.brain === 'gemini' || !does.length ? s.caption || '' : does.length > 1 ? `${sentence}.` : where;
    // no click on this screen (it only scrolled or arrived): title it from the page's own heading, whole words only
    const heading = String(s.caption || human(s.name)).replace(/[.!]$/, '').split(/\s+/).slice(0, 5).join(' ');
    const title = does.at(-1) || (firstOfView ? 'Start here' : heading);
    const whoLine = who && firstOfView ? `${who}${/computer|laptop|desktop|phone|mobile|tablet/i.test(who) ? '' : laptop ? ', on a computer' : ', on a phone'}. ` : '';
    steps.push({ t: +t.toFixed(2), title: title.replace(/[“”]/g, ''), body: `${whoLine}${body}`.trim() });
    const line = w.brain === 'gemini' && s.caption ? s.caption : does.length ? `${sentence.replace(/[“”]/g, '')}.` : last ? `And you're there: ${s.caption || human(s.name)}` : s.caption || human(s.name);
    lines.push(who && firstOfView ? `${vi ? 'Now, as the' : 'As the'} ${who.toLowerCase()}: ${line.charAt(0).toLowerCase()}${line.slice(1)}` : line);
    at.push(+(t + 0.3).toFixed(2));
    hits.push([+t.toFixed(2), `step ${i + 1}`, 'pop', { pitch: 'A5' }]);
    if (si) hits.push([+t.toFixed(2), 'screen', 'whoosh', { len: 0.35, from: 2400, to: 700 }]);
    // the last control pressed on this screen gets the ring; the camera leans in on it
    const marks = Object.entries(s.regions || {});
    if (marks.length) {
      const [mk, box] = marks.at(-1), r = `${key}-${mk}`.slice(0, 40);
      regions[r] = box;
      const a = +(t + 1.2).toFixed(2), b = +(t + dur - 0.35).toFixed(2), tap = +(b - 0.45).toFixed(2);
      rings.push({ r, a, b, tap });
      hits.push([a, `ring ${mk}`, 'blip', { pitch: 'C6' }], [tap, 'tap', 'click']);
      const fx = Math.min(0.85, Math.max(0.15, (box[0] + box[2] / 2) / SW)), fy = Math.min(0.85, Math.max(0.15, (box[1] + box[3] / 2) / SH));
      cam.push([+(t + 0.9).toFixed(2), [laptop ? 1.6 : 1.25, +fx.toFixed(3), +fy.toFixed(3)]], [+(t + dur - 0.1).toFixed(2), [1, 0.5, 0.5]]);
    }
    t += dur;
  });
  }
  const phoneTo = +t.toFixed(2), duration = +(phoneTo + 4).toFixed(1);
  hits.push([phoneTo, 'end card', 'impact'], [+(phoneTo + 0.2).toFixed(2), 'logo', 'bell', { pitch: 'F6' }]);
  const tl = title.split(' '), half = Math.ceil(tl.length / 2), third = Math.ceil(tl.length / 3);
  const cfgJs = {
    kicker: `${ws.name.toUpperCase()} · WALKTHROUGH`,
    hook: { to: hookTo, lines: { '16x9': [tl.slice(0, half).join(' '), tl.slice(half).join(' ')].filter(Boolean),
      '9x16': [tl.slice(0, third).join(' '), tl.slice(third, 2 * third).join(' '), tl.slice(2 * third).join(' ')].filter(Boolean) } },
    ...(opener === 'photo' ? { photos: { hook: 'hook' } } : opener === 'video' ? { clips: { hook: 'hook' } } : {}),
    steps,
    phone: { ...(parts[0].device === 'laptop' ? { device: 'laptop' } : {}), ...(multi ? { parts } : {}), to: phoneTo, screens, seq, regions, cam, rings },
    end: { tagline: [ws.tagline || ws.name, vb?.site ? String(vb.site).replace(/^https?:\/\//, '').replace(/\/$/, '') : ''].filter(Boolean).join(' · ') },
  };
  fs.writeFileSync(path.join(dir, 'film.js'), `// ${id} ${title}. Made in Studio from the walkthrough "${walkName}" (media/screens/${walkName}/).
` +
    `// Pure data on the shared tutorial kit (tools/kit/tutorial.js); times are seconds. Edit freely.
import { tutorial } from '/kit/tutorial.js';

` +
    `const HITS = [\n${hits.map((h) => `  ${JSON.stringify(h)},`).join('\n')}\n];

tutorial({ ...${JSON.stringify(cfgJs, null, 1)}, hits: HITS });
`);
  const cfg = readJSON(path.join(dir, 'film.json'), {});
  for (const k of ['vo', 'vo_at', 'retime', 'duration_authored', 'variants', 'stills']) delete cfg[k];
  Object.assign(cfg, { title, duration, formats: ['9x16', '16x9'], vo_at: at, brand: ws.brand, publish: false, ...(owner && owner !== 'owner' ? { owner } : {}),
    ...(voiceName ? { voice: { ...(cfg.voice || {}), voice: String(voiceName).replace(/[^A-Za-z]/g, '').slice(0, 20) } } : {}),
    music: 'About one minute of original, calm, modern instrumental background music for a friendly product walkthrough. Soft percussion, light plucked guitar, warm keys, relaxed tempo around 96 BPM, even dynamics under a voice, no vocals, a soft resolved ending.' });
  fs.writeFileSync(path.join(dir, 'film.json'), JSON.stringify(cfg, null, 1) + '\n');
  fs.mkdirSync(path.join(dir, 'docs', 'vo'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'vo', 'lines.txt'), lines.join('\n') + '\n');
  if (!voice) {   // captions and sound effects only: no Gemini voice or music
    fs.rmSync(path.join(dir, 'docs', 'vo', 'lines.txt'));
    const c = readJSON(path.join(dir, 'film.json'));
    delete c.music; delete c.vo_at;
    fs.writeFileSync(path.join(dir, 'film.json'), JSON.stringify(c, null, 1) + '\n');
  }
  fs.writeFileSync(path.join(dir, 'docs', 'shotlist.md'), `# ${id} ${title}\n\nMade in Clipwalk from ${views.map((v) => `\`${v.name}\`${v.role ? ` (${v.role})` : ''}, ${v.w.device}, ${v.w.shots.length} screens: ${v.w.goal}`).join('; then ')}\n`);
  return folder;
}

// One brand colour from the site or the person: a dark one becomes the main colour (panels, end card) with a deeper
// shade for backgrounds; a light, bright one becomes the highlight (rings, step numbers).
function brandFromColor(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return {};
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255];
  const lum = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
  if (lum < 0.45) return { green: hex, deep: '#' + c.map((v) => Math.round(v * 0.55).toString(16).padStart(2, '0')).join('') };
  return { gold: hex };
}
// a data: URL from the page -> a file under vid-gen (logos); returns the path relative to vid-gen
function saveUpload(dataUrl, relBase) {
  const m = /^data:image\/(svg\+xml|png|jpeg|webp);base64,(.+)$/.exec(String(dataUrl || ''));
  if (!m || m[2].length > 4e6) return null;
  const f = path.join(ROOT, `${relBase}.${{ 'svg+xml': 'svg', png: 'png', jpeg: 'jpg', webp: 'webp' }[m[1]]}`);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, Buffer.from(m[2], 'base64'));
  return path.relative(ROOT, f);
}
// Pre-fill the follow-up questions from the product's own site: name, colour, logo. Public sites only.
async function sniff(url) {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol) || /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[)/.test(u.hostname) || !u.hostname.includes('.')) throw new Error('Only public websites');
  const r = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'Mozilla/5.0 Clipwalk' } });
  const html = (await r.text()).slice(0, 600000);
  const meta = (re) => (re.exec(html) || [])[1]?.trim();
  const abs = (h) => { try { return h && new URL(h, r.url).href; } catch { return null; } };
  const name = meta(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/i) || meta(/<meta[^>]+name=["']application-name["'][^>]+content=["']([^"']+)/i)
    || (meta(/<title[^>]*>([^<]+)/i) || '').split(/[|\-–·:]/)[0].trim();
  const color = meta(/<meta[^>]+name=["']theme-color["'][^>]+content=["'](#[0-9a-f]{6})/i);
  const icon = abs(meta(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)/i) || meta(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*apple-touch-icon/i)
    || meta(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+\.(?:svg|png))/i));
  let logo = null;
  if (icon) try {   // inline it, so the page can show it and the film can keep it
    const ir = await fetch(icon, { signal: AbortSignal.timeout(5000) }), buf = Buffer.from(await ir.arrayBuffer()), ct = (ir.headers.get('content-type') || '').split(';')[0];
    if (/^image\/(png|svg\+xml|jpeg|webp)$/.test(ct) && buf.length < 1.5e6) logo = `data:${ct};base64,${buf.toString('base64')}`;
  } catch {}
  return { name: name?.slice(0, 40) || null, color: color || null, logo, site: `${u.protocol}//${u.hostname}` };
}

// Credits: friends prepay, each finished video deducts its price; the owner (this computer) is never charged.
const ACCOUNTS = path.join(HERE, 'accounts.json');   // git-ignored: names, codes and balances stay on this machine
const accounts = () => readJSON(ACCOUNTS, { accounts: [], log: [] });
const saveAccounts = (a) => fs.writeFileSync(ACCOUNTS, JSON.stringify(a, null, 1) + '\n', { mode: 0o600 });
const OWNER = { id: 'owner', role: 'owner', name: 'Owner' };
function menuPrice(views = 1) { const m = readJSON(PRICING, {}).menu || {}; return (m.video ?? 5) + Math.max(0, views - 1) * (m.extra_view ?? 1); }
function charge(id, credits, why) {
  const a = accounts(), acc = a.accounts.find((x) => x.id === id);
  if (!acc) return 0;
  acc.credits -= credits; a.log.push({ at: new Date().toISOString(), id, delta: -credits, why });
  saveAccounts(a); return credits;
}
// who is asking: this computer is the owner; anyone else (another device, or through a tunnel) needs their code
function whoIs(req) {
  const ip = req.socket.remoteAddress || '';
  const proxied = req.headers['x-forwarded-for'] || req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.headers.forwarded;
  if (!proxied && /^(127\.|::1$|::ffff:127\.)/.test(ip)) return OWNER;
  const cookie = /(?:^|;\s*)cw=([A-Z0-9]+)/.exec(req.headers.cookie || '')?.[1];
  const code = String(req.headers['x-clipwalk-code'] || cookie || '').trim().toUpperCase();
  const acc = code && accounts().accounts.find((x) => x.code === code);
  return acc ? { id: acc.id, role: 'friend', name: acc.name, credits: acc.credits } : null;
}
const ownsFilm = (who, folder) => who.role === 'owner' || readJSON(path.join(FILMS, folder, 'film.json'), {}).owner === who.id;

// ------------------------------------------------------------------ jobs
// Jev (tools/jev.mjs, text only, very cheap) runs before anything that spends Gemini: a script that changed since
// its last clean lint is linted first, and a lint with problems stops the job before any voice or render is paid for.
const GATED = new Set(['vo', 'check', 'draft', 'full']);
const CACHE = path.join(ROOT, 'tools', 'cache', 'studio-lint.json');   // git-ignored
const lintCache = () => readJSON(CACHE, {});
const linesPath = (folder) => path.join(FILMS, folder, 'docs', 'vo', 'lines.txt');
// time each line has on screen, from the fixed starts in film.json "vo_at" (Jev's free words-per-second check)
function lineSecs(folder) {
  const cfg = readJSON(path.join(FILMS, folder, 'film.json'), {}), at = cfg.vo_at || [];
  const n = fs.existsSync(linesPath(folder)) ? fs.readFileSync(linesPath(folder), 'utf8').split('\n').filter((l) => l.trim()).length : 0;
  const end = cfg.duration_authored ?? cfg.duration;
  return [...Array(n)].map((_, i) => (at[i] != null && (at[i + 1] ?? (i === n - 1 ? end : null)) != null ? +(((at[i + 1] ?? end) - at[i]) - 0.3).toFixed(1) : 0));
}
const lintKey = (folder) => hash(fs.readFileSync(linesPath(folder), 'utf8') + JSON.stringify(lineSecs(folder)));
const lintArgs = (folder) => {
  const secs = lineSecs(folder);
  return ['tools/jev.mjs', 'lint', '--file', path.join('films', folder, 'docs', 'vo', 'lines.txt'), ...(secs.some(Boolean) ? ['--secs', secs.join(',')] : [])];
};
function lintState(folder) {
  if (!fs.existsSync(linesPath(folder))) return 'none';
  const c = lintCache()[folder];
  return !c ? 'never' : c.key !== lintKey(folder) ? 'stale' : c.ok ? 'ok' : 'problems';
}

const ACTIONS = {
  check: { label: 'Check (stills)', args: (d) => ['tools/make.mjs', d, '--check'] },
  draft: { label: 'Draft render', args: (d) => ['tools/make.mjs', d, '--draft'] },
  full: { label: 'Full render + publish', args: (d) => ['tools/make.mjs', d] },
  images: { label: 'Pictures', args: (d) => ['tools/make.mjs', d, '--only', 'images'] },
  vo: { label: 'Voice-over', args: (d) => ['tools/make.mjs', d, '--only', 'vo'] },
  music: { label: 'Music', args: (d) => ['tools/make.mjs', d, '--only', 'music'] },
  mix: { label: 'Sound effects + mix', args: (d) => ['tools/make.mjs', d, '--only', 'sfx,mix'] },
  stills: { label: 'Stills only', args: (d) => ['tools/make.mjs', d, '--only', 'stills'] },
  lint: { label: 'Jev: lint script', args: (d, o, f) => lintArgs(f) },
  pick: { label: 'Jev: pick a motion block', args: (d, o) => ['tools/jev.mjs', 'pick', String(o.need || '').slice(0, 300), '--top', '5'] },
  dupe: { label: 'Jev: is this lesson new?', args: (d, o) => ['tools/jev.mjs', 'dupe', String(o.lesson || '').slice(0, 600)] },
  review: { label: 'Gemini review', args: (d, o) => ['tools/gemini.mjs', 'review', path.join('renders', path.basename(o.render || '')), '--film', d] },
  usage: { label: 'Gemini usage', args: () => ['tools/gemini.mjs', 'usage'] },
  walk: { label: 'Walkthrough capture', args: (d, o) => ['tools/walk.mjs', '--url', o.url, '--goal', o.goal, '--name', o.name, '--device', o.device === 'laptop' ? 'laptop' : 'phone',
    '--brain', o.brain === 'gemini' ? 'gemini' : 'jev', '--steps', String(Math.min(60, Number(o.steps) || 30)), ...(o.show ? ['--show'] : []), ...(o.see ? ['--see'] : []), ...(o.risky ? ['--risky'] : [])] },
};
const GLOBAL = new Set(['usage', 'pick', 'dupe', 'walk', 'make']);
const EXIT = { 2: 'The API key is out of credit or over its daily quota. Top it up (Settings shows which key), then try again.', 3: 'An API key is missing or wrong. Add it in Settings.', 4: 'Blocked by Gemini safety filter: rephrase the prompt.',
  6: 'The walk needs a person: a CAPTCHA, a one-time code, or a login that wasn\'t given.',
  5: 'Jev found problems in the script (above). Fix the lines, or use "Run anyway".' };
const jobs = []; let seq = 0;
const ansi = /\x1b\[[0-9;?]*[A-Za-z]/g;

function enqueue(action, folder, opts = {}, who = OWNER) {
  if (action === 'make') return enqueueMake(opts, who);
  const a = ACTIONS[action];
  if (!a) throw new Error('Unknown action');
  if (action === 'review' && !ls(RENDERS).includes(path.basename(opts.render || ''))) throw new Error('Pick a render to review.');
  if (action === 'pick' && !String(opts.need || '').trim()) throw new Error('Describe what the shot needs.');
  if (action === 'dupe' && !String(opts.lesson || '').trim()) throw new Error('Write the lesson first.');
  if (action === 'lint' && !fs.existsSync(linesPath(folder))) throw new Error('This film has no voice-over script.');
  if (action === 'walk') {
    if (!/^https?:\/\//.test(opts.url || '')) throw new Error('The link must start with http:// or https://');
    if (!String(opts.goal || '').trim()) throw new Error('Say what the walkthrough should show.');
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(opts.name || '')) throw new Error('Name: lowercase words joined by dashes, like pay-by-card.');
  }
  const d = folder ? path.join('films', folder) : '';
  const steps = [];
  // the Jev gate: only when the script changed since its last clean lint, and not when Josh says run anyway
  if (GATED.has(action) && !opts.force && ['never', 'stale', 'problems'].includes(lintState(folder))) steps.push({ args: lintArgs(folder), gate: true });
  steps.push({ args: a.args(d, opts, folder) });
  // logins live only in this job's environment, for as long as it runs: never on disk, in the log or the API
  const env = action === 'walk' ? { WALK_USER: String(opts.user || ''), WALK_PASS: String(opts.pass || '') } : {};
  const meta = action === 'walk' ? { name: opts.name, device: opts.device === 'laptop' ? 'laptop' : 'phone' } : undefined;
  const job = { meta, id: ++seq, action, label: action === 'walk' ? `${a.label}: ${opts.name}` : a.label, folder, steps, env, state: 'queued', lines: [], progress: '', code: null, created: Date.now(), clients: new Set() };
  jobs.push(job);
  pump();
  return job;
}
// The one-button flow: link + what to show -> captured screens -> a branded walkthrough video -> rendered.
// Each step is logged as "== stage <name>" so the page can show friendly progress.
function enqueueMake(o, who = OWNER) {
  // one or more views: e.g. the admin on a computer, then a resident on a phone
  const views = (Array.isArray(o.views) && o.views.length ? o.views : [o]).slice(0, 3).map((v, k) => ({
    url: String(v.url || '').trim(), goal: String(v.goal || '').trim(), device: v.device === 'laptop' ? 'laptop' : 'phone',
    role: String(v.role || '').trim().slice(0, 30), user: String(v.user || ''), pass: String(v.pass || ''), k }));
  for (const v of views) {
    if (!/^https?:\/\//.test(v.url)) throw new Error(`${views.length > 1 ? `View ${v.k + 1}: p` : 'P'}aste the full link, starting with http:// or https://`);
    if (!v.goal) throw new Error(`${views.length > 1 ? `View ${v.k + 1}: s` : 'S'}ay what the video should show.`);
  }
  const price = menuPrice(views.length);
  if (who.role === 'friend' && who.credits < price) throw new Error(`Not enough credits: this video needs ${price} and you have ${who.credits}. Ask ${workspace().owner || 'the owner'} to top you up.`);
  let host = 'video'; try { host = new URL(views[0].url).hostname.replace(/^(www|app)\./, '').split('.')[0].replace(/[^a-z0-9]/g, '') || 'video'; } catch {}
  const base = `${host}-${Date.now().toString(36).slice(-4)}`;
  const nums = ls(FILMS).filter((f) => /^W\d+-/.test(f)).map((f) => Number(f.slice(1).split('-')[0]));
  const id = `W${(nums.length ? Math.max(...nums) : 0) + 1}`;
  const title = String(o.title || '').trim().slice(0, 80) || (() => { const g = views[0].goal.replace(/[."]/g, '').split(/\s+/).slice(0, 8).join(' '); return g.charAt(0).toUpperCase() + g.slice(1); })();
  const voice = o.voice !== false, names = views.map((v, k) => (views.length > 1 ? `${base}-v${k + 1}` : base));
  const brain = o.brain === 'gemini' ? 'gemini' : 'jev';
  // the opening shot: a free stock photo or clip behind the title (needs a Pexels or Pixabay key)
  const opener = ['photo', 'video'].includes(o.opener) && workspace().stock ? o.opener : null;
  const hint = who.role === 'owner' ? workspace().stockHint : '';
  const openerQuery = `${String(o.openerQuery || '').trim().slice(0, 100) || (views[0].device === 'laptop' ? 'person working on a laptop in a bright modern office' : 'person smiling while using a smartphone')}${hint ? `, ${hint}` : ''}`;
  const steps = [
    ...views.map((v, k) => ({ stage: 'capture', walk: names[k], env: { WALK_USER: v.user, WALK_PASS: v.pass },
      args: () => ACTIONS.walk.args('', { url: v.url, goal: v.goal, name: names[k], device: v.device, brain, steps: o.steps || 25, risky: !!o.risky }) })),
    { stage: 'build', fn: (job) => {
      const folder = filmFromWalk(views.map((v, k) => ({ name: names[k], role: v.role })), { id, name: base, title, voice, opener, brand: { ...(o.brand || {}), host: host.charAt(0).toUpperCase() + host.slice(1) }, voiceName: o.voiceName, owner: who.id });
      job.folder = folder; job.meta.folder = folder;
      log(job, `made films/${folder}`);
    } },
    ...(opener ? [{ stage: 'build', soft: true, args: (job) => ['tools/stock.mjs', opener, openerQuery, '--out',
      path.join('films', job.folder, 'assets', opener === 'photo' ? 'photos' : 'clips', 'hook')] }] : []),
    ...(voice ? [{ stage: 'check', args: (job) => lintArgs(job.folder), soft: true }] : []),
    { stage: 'render', args: (job) => ['tools/make.mjs', path.join('films', job.folder), ...(o.quality === 'quick' ? ['--draft'] : [])] },
  ];
  const job = { meta: { kind: 'make', name: names[0], names, device: views[0].device, title, voice, price, opener }, owner: who.id, id: ++seq, action: 'make', label: `Make: ${title}`,
    folder: null, steps, env: {}, state: 'queued', lines: [], progress: '', code: null, created: Date.now(), clients: new Set() };
  jobs.push(job);
  pump();
  return job;
}
const pub = (j) => ({ meta: j.meta, owner: j.owner, charged: j.charged, id: j.id, action: j.action, label: j.label, folder: j.folder, state: j.state, code: j.code, error: j.error, gated: j.gated,
  created: j.created, started: j.started, ended: j.ended });
function emit(job, type, data) { for (const res of job.clients) res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`); }
function log(job, l) { job.lines.push(l); emit(job, 'line', l); if (job.lines.length > 4000) job.lines.splice(0, job.lines.length - 4000); }
function finish(job, state, code) {
  job.state = state; job.code = code; job.ended = Date.now(); job.env = {};
  for (const st of job.steps || []) delete st.env;   // logins are gone the moment the job ends
  if (state === 'done' && job.action === 'make' && job.owner && job.owner !== 'owner') job.charged = charge(job.owner, job.meta.price, `Video ${job.folder}: ${job.meta.title}`);
  if (code && EXIT[code]) job.error = EXIT[code];
  emit(job, 'state', pub(job));
  for (const res of job.clients) res.end();
  job.clients.clear(); delete job.proc;
  pump();
}
function runStep(job, i) {
  const st = job.steps[i];
  if (!st) return finish(job, 'done', 0);
  if (st.stage) log(job, `== stage ${st.stage}`);
  if (st.fn) {
    try { st.fn(job); } catch (e) { log(job, `error: ${e.message}`); job.error = e.message; return finish(job, 'failed', 1); }
    return runStep(job, i + 1);
  }
  if (typeof st.args === 'function') st.args = st.args(job);
  log(job, `$ node ${st.args.map((x) => (/\s/.test(x) ? JSON.stringify(x) : x)).join(' ')}`);
  if (st.gate) log(job, 'jev: the script changed since its last clean lint, so Jev checks it before Gemini is used');
  const isLint = st.args[1] === 'lint', key = isLint && job.folder ? lintKey(job.folder) : null;
  const p = spawn(process.execPath, st.args, { cwd: ROOT, env: { ...process.env, FORCE_COLOR: '0', ...job.env, ...(st.env || {}) } });
  job.proc = p;
  let partial = '';
  const onData = (buf) => {
    partial += buf.toString().replace(ansi, '');
    const parts = partial.split('\n'); partial = parts.pop();
    for (const raw of parts) log(job, raw.split('\r').filter(Boolean).pop() ?? '');
    const prog = partial.split('\r').filter(Boolean).pop() || '';
    if (prog !== job.progress) { job.progress = prog; emit(job, 'progress', prog); }
  };
  p.stdout.on('data', onData); p.stderr.on('data', onData);
  p.on('close', (code, signal) => {
    if (partial) log(job, partial);
    partial = ''; job.progress = '';
    if (signal || job.stopping) return finish(job, 'stopped', code);
    if (isLint && key && (code === 0 || code === 5)) {
      const c = lintCache(); c[job.folder] = { key, ok: code === 0, at: Date.now() };
      fs.mkdirSync(path.dirname(CACHE), { recursive: true }); fs.writeFileSync(CACHE, JSON.stringify(c, null, 1));
    }
    if (st.gate && code === 5) { job.gated = true; return finish(job, 'failed', 5); }
    if (st.gate && code !== 0) { log(job, `jev: couldn't lint (exit ${code}); carrying on without it`); return runStep(job, i + 1); }
    if (st.soft && code !== 0) { log(job, code === 5 ? 'jev flagged some lines (above); carrying on' : `check skipped (exit ${code})`); return runStep(job, i + 1); }
    if (st.stage === 'capture') delete st.env;
    if (st.stage === 'capture' && code === 0 && !(readJSON(path.join(SCREENS, st.walk || job.meta.name, 'walk.json'), {}).shots || []).length) {
      job.error = "The AI couldn't capture any screens. Check the link, or describe the goal more simply."; return finish(job, 'failed', 1);
    }
    if (code !== 0 && st.stage === 'capture' && !EXIT[code]) job.error = "The AI couldn't finish clicking through. Try a shorter goal that names the buttons, like \"Open Pricing\", or tick that it needs a login.";
    if (code !== 0 && st.stage === 'render' && !EXIT[code]) job.error = 'Rendering failed. Nothing was charged; the log has the details.';
    if (code !== 0) return finish(job, 'failed', code);
    runStep(job, i + 1);
  });
}
function pump() {
  if (jobs.some((j) => j.state === 'running')) return;
  const job = jobs.find((j) => j.state === 'queued');
  if (!job) return;
  job.state = 'running'; job.started = Date.now();
  emit(job, 'state', pub(job));
  runStep(job, 0);
}

// ------------------------------------------------------------------ http
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp4': 'video/mp4',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.otf': 'font/otf', '.ttf': 'font/ttf' };

function sendFile(req, res, file, download) {
  let st; try { st = fs.statSync(file); } catch { return send(res, 404, 'Not found'); }
  if (!st.isFile()) return send(res, 404, 'Not found');
  const head = { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
  if (download) head['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(file))}`;
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (m) {
    const start = m[1] ? Number(m[1]) : st.size - Number(m[2]), end = m[1] && m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
    if (start >= st.size || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
    res.writeHead(206, { ...head, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...head, 'Content-Length': st.size });
  fs.createReadStream(file).pipe(res);
}
function send(res, code, body) {
  const json = typeof body !== 'string';
  res.writeHead(code, { 'Content-Type': json ? 'application/json' : 'text/plain; charset=utf-8' });
  res.end(json ? JSON.stringify(body) : body);
}
const readBody = (req) => new Promise((ok, bad) => {
  let s = ''; req.on('data', (c) => { s += c; if (s.length > 2e6) req.destroy(); });
  req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { bad(e); } });
});
// only files under vid-gen/ (minus secrets) or Final videos/ are served
function within(base, rel) {
  const f = path.resolve(base, rel);
  return f.startsWith(base + path.sep) && !/(^|\/)\.env|node_modules|\.git(\/|$)/.test(path.relative(base, f)) ? f : null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), p = decodeURIComponent(url.pathname);
  try {
    if (p === '/' || p === '/index.html') return sendFile(req, res, path.join(HERE, 'index.html'));
    const who = whoIs(req);
    if (p === '/api/login' && req.method === 'POST') {   // a friend enters their code once; it lives in a cookie
      const code = String((await readBody(req)).code || '').trim().toUpperCase();
      const acc = accounts().accounts.find((x) => x.code === code);
      if (!acc) return send(res, 401, { error: "That code doesn't match. Check it with whoever runs Clipwalk." });
      res.setHeader('Set-Cookie', `cw=${code}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000`);
      return send(res, 200, { role: 'friend', name: acc.name, credits: acc.credits });
    }
    if (p === '/api/logout') { res.setHeader('Set-Cookie', 'cw=; Path=/; Max-Age=0'); return send(res, 200, { ok: true }); }
    if (p === '/api/me') return who ? send(res, 200, who) : send(res, 401, { error: 'code' });
    if (p === '/api/sniff' && req.method === 'POST' && who) return send(res, 200, await sniff((await readBody(req)).url).catch(() => ({})));
    if (!who) return send(res, 401, { error: 'Enter your access code first.' });
    if (who.role === 'friend') return await friendRoute(req, res, p, url, who);
    // the owner manages friends and their credits
    if (p === '/api/accounts' && req.method === 'GET') { const a = accounts(); return send(res, 200, { ...a, log: a.log.slice(-200).reverse() }); }
    if (p === '/api/accounts' && req.method === 'POST') {
      const { name } = await readBody(req), a = accounts();
      if (!String(name || '').trim()) return send(res, 400, { error: 'Give them a name' });
      const code = Array.from(crypto.randomBytes(6), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
      const acc = { id: crypto.randomBytes(4).toString('hex'), name: String(name).trim().slice(0, 40), code, credits: 0, created: new Date().toISOString() };
      a.accounts.push(acc); saveAccounts(a); return send(res, 200, acc);
    }
    let am = /^\/api\/accounts\/([0-9a-f]+)\/topup$/.exec(p);
    if (am && req.method === 'POST') {
      const { credits, note } = await readBody(req), a = accounts(), acc = a.accounts.find((x) => x.id === am[1]), n = Math.round(Number(credits));
      if (!acc || !n) return send(res, 400, { error: 'Pick a person and an amount' });
      acc.credits += n; a.log.push({ at: new Date().toISOString(), id: acc.id, delta: n, why: String(note || (n > 0 ? 'Top-up' : 'Adjustment')).slice(0, 100) });
      saveAccounts(a); return send(res, 200, acc);
    }
    if (p.startsWith('/files/')) { const f = within(ROOT, p.slice(7)); return f ? sendFile(req, res, f, url.searchParams.has('dl')) : send(res, 403, 'No'); }
    if (p.startsWith('/final/')) { const f = within(FINAL, p.slice(7)); return f ? sendFile(req, res, f, url.searchParams.has('dl')) : send(res, 403, 'No'); }

    if (p === '/api/films' && req.method === 'GET') return send(res, 200, ls(FILMS).filter((f) => filmDir(f)).map(safeSummary).filter(Boolean));
    if (p === '/api/films' && req.method === 'POST') return send(res, 200, { folder: create(await readBody(req)) });
    if (p === '/api/final') return send(res, 200, ls(FINAL).filter((f) => f.endsWith('.mp4')).sort()
      .map((f) => ({ name: f, id: f.split(' ')[0], size: fs.statSync(path.join(FINAL, f)).size, updated: mtime(path.join(FINAL, f)) })));
    let m = /^\/api\/films\/([^/]+)$/.exec(p);
    if (m) {
      if (!filmDir(m[1])) return send(res, 404, { error: 'No such film' });
      if (req.method === 'GET') return send(res, 200, detail(m[1]));
      if (req.method === 'PUT') { save(m[1], await readBody(req)); return send(res, 200, detail(m[1])); }
    }
    m = /^\/api\/films\/([^/]+)\/doc\/([^/]+\.md)$/.exec(p);
    if (m && filmDir(m[1])) return sendFile(req, res, path.join(filmDir(m[1]), 'docs', path.basename(m[2])));
    m = /^\/api\/films\/([^/]+)\/linesecs$/.exec(p);
    if (m && filmDir(m[1])) return send(res, 200, ls(path.join(filmDir(m[1]), 'audio')).filter((f) => /^vo-\d+\.wav$/.test(f)).map((f) => [f, duration(path.join(filmDir(m[1]), 'audio', f))]));

    if (p === '/api/jobs' && req.method === 'GET') return send(res, 200, jobs.slice(-30).reverse().map(pub));
    if (p === '/api/jobs' && req.method === 'POST') {
      const b = await readBody(req);
      if (!GLOBAL.has(b.action) && !filmDir(b.folder || '')) return send(res, 400, { error: 'Pick a film' });
      return send(res, 200, pub(enqueue(b.action, GLOBAL.has(b.action) ? null : b.folder, b)));
    }
    if (p === '/api/walks') return send(res, 200, ls(SCREENS).filter((n) => fs.existsSync(path.join(SCREENS, n, 'walk.json')))
      .map((n) => { const w = readJSON(path.join(SCREENS, n, 'walk.json'), {}); return { name: n, ...w, steps: undefined, stepCount: (w.steps || []).length,
        shots: (w.shots || []).map((s) => ({ ...s, src: `/files/media/screens/${n}/${s.file}?v=${mtime(path.join(SCREENS, n, s.file))}` })) }; })
      .sort((a, b) => String(b.at).localeCompare(String(a.at))));
    m = /^\/api\/walks\/([a-z0-9-]+)\/copy$/.exec(p);
    if (m && req.method === 'POST') {   // put a captured screen into a film's assets/screens
      const { file, folder } = await readBody(req), dir = filmDir(folder || '');
      const src = path.join(SCREENS, m[1], path.basename(file || ''));
      if (!dir || !fs.existsSync(src)) return send(res, 400, { error: 'Pick a film and a screen' });
      const dest = path.join(dir, 'assets', 'screens', `${m[1]}-${path.basename(file).replace(/^\d+-/, '')}`);
      fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(src, dest);
      return send(res, 200, { path: path.relative(dir, dest) });
    }
    if (p === '/api/workspace') return send(res, 200, req.method === 'PUT' ? saveWorkspace(await readBody(req)) : workspace());
    if (p === '/api/keys') return send(res, 200, req.method === 'PUT' ? setKeys(await readBody(req)) : keyStatus());
    if (p === '/api/pricing') {
      if (req.method === 'PUT') { const b = await readBody(req); if (!b.rates) throw new Error('Bad pricing'); fs.writeFileSync(PRICING, JSON.stringify(b, null, 1) + '\n'); }
      return send(res, 200, { ...readJSON(PRICING, {}), spent: spend() });
    }
    m = /^\/api\/walks\/([a-z0-9-]+)\/film$/.exec(p);
    if (m && req.method === 'POST') return send(res, 200, { folder: filmFromWalk(m[1], await readBody(req)) });
    if (p === '/api/style' && req.method === 'POST') {   // append a lesson Jev said is new
      const { lesson } = await readBody(req), f = path.join(ROOT, 'moodboard', 'STYLE.md');
      if (!String(lesson || '').trim()) return send(res, 400, { error: 'Empty lesson' });
      fs.appendFileSync(f, `- ${String(lesson).replace(/\s+/g, ' ').trim()} (${new Date().toISOString().slice(0, 10)}, Studio)\n`);
      return send(res, 200, { ok: true });
    }
    m = /^\/api\/jobs\/(\d+)(\/stream|\/stop)?$/.exec(p);
    if (m) {
      const job = jobs.find((j) => j.id === Number(m[1]));
      if (!job) return send(res, 404, { error: 'No such job' });
      if (m[2] === '/stop') {
        if (job.state === 'queued') { job.state = 'stopped'; emit(job, 'state', pub(job)); }
        else if (job.proc) { job.stopping = true; job.proc.kill('SIGTERM'); }
        return send(res, 200, pub(job));
      }
      if (m[2] === '/stream') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        res.write(`event: init\ndata: ${JSON.stringify({ ...pub(job), lines: job.lines, progress: job.progress })}\n\n`);
        if (job.state === 'running' || job.state === 'queued') { job.clients.add(res); req.on('close', () => job.clients.delete(res)); } else res.end();
        return;
      }
      return send(res, 200, { ...pub(job), lines: job.lines });
    }
    send(res, 404, { error: 'Not found' });
  } catch (e) {
    send(res, 400, { error: e.message });
  }
});
// What a friend may do: make videos with their credits, watch progress, and see and download their own videos.
async function friendRoute(req, res, p, url, who) {
  const mine = new Set(ls(FILMS).filter((f) => readJSON(path.join(FILMS, f, 'film.json'), {}).owner === who.id));
  const myIds = new Set([...mine].map(idOf)), myWalks = new Set(jobs.filter((j) => j.owner === who.id).flatMap((j) => j.meta?.names || []));
  if (p === '/api/workspace') { const w = workspace(); return send(res, 200, { name: w.name, tagline: w.tagline, brand: w.brand, logo: w.logo, owner: w.owner, stock: w.stock }); }
  if (p === '/api/pricing') { const pr = readJSON(PRICING, {}); return send(res, 200, { menu: pr.menu, credit_usd: pr.credit_usd, currency: pr.currency }); }
  if (p === '/api/films') return send(res, 200, [...mine].map(safeSummary).filter(Boolean));
  let m = /^\/api\/films\/([^/]+)$/.exec(p);
  if (m && req.method === 'GET' && mine.has(m[1])) return send(res, 200, detail(m[1]));
  if (p === '/api/jobs' && req.method === 'GET') return send(res, 200, jobs.filter((j) => j.owner === who.id).slice(-30).reverse().map(pub));
  if (p === '/api/jobs' && req.method === 'POST') {
    const b = await readBody(req);
    if (b.action !== 'make') return send(res, 403, { error: 'Only making videos is available on a shared link.' });
    return send(res, 200, pub(enqueueMake(b, who)));
  }
  m = /^\/api\/jobs\/(\d+)(\/stream|\/stop)?$/.exec(p);
  if (m) {
    const job = jobs.find((j) => j.id === Number(m[1]) && j.owner === who.id);
    if (!job) return send(res, 404, { error: 'No such job' });
    if (m[2] === '/stop') { if (job.state === 'queued') { job.state = 'stopped'; emit(job, 'state', pub(job)); } else if (job.proc) { job.stopping = true; job.proc.kill('SIGTERM'); } return send(res, 200, pub(job)); }
    if (m[2] === '/stream') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(`event: init\ndata: ${JSON.stringify({ ...pub(job), lines: job.lines, progress: job.progress })}\n\n`);
      if (job.state === 'running' || job.state === 'queued') { job.clients.add(res); req.on('close', () => job.clients.delete(res)); } else res.end();
      return;
    }
    return send(res, 200, pub(job));
  }
  if (p.startsWith('/files/')) {   // only their own renders, screens and films, and the brand logo
    const rel = p.slice(7), w = workspace();
    const ok = rel === w.logo || [...myIds].some((id) => rel.startsWith(`renders/breeup-${id}-`) || rel.startsWith(`renders/_stills/_sheet-breeup-${id}-`))
      || [...mine].some((f) => rel.startsWith(`films/${f}/`)) || [...myWalks].some((n) => rel.startsWith(`media/screens/${n}/`));
    const f = ok && within(ROOT, rel);
    return f ? sendFile(req, res, f, url.searchParams.has('dl')) : send(res, 403, 'No');
  }
  return send(res, 403, { error: 'Not available on a shared link.' });
}

// one bad request or job must never take the server (and everyone's queue) down
process.on('uncaughtException', (e) => console.error('error:', e.message));
process.on('unhandledRejection', (e) => console.error('error:', e?.message || e));
const HOST = process.env.HOST || '127.0.0.1';   // HOST=0.0.0.0 to let friends on your network in (they need a code)
server.listen(PORT, HOST, () => console.log(`Clipwalk: http://localhost:${PORT}${HOST !== '127.0.0.1' ? ' (also on your network; friends need an access code)' : ''}`));
