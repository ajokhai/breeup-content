#!/usr/bin/env node
// Nigerian-accented voice-over with YarnGPT (yarngpt.ai; the model is MIT-licensed). Free while YarnGPT keeps it free
// (80 requests a day per account), so it's the cheapest voice, and the one with the right accent for Nigerian audiences.
//
//   node tools/yarn.mjs tts --text "one line" --out films/<film>/audio/vo-1.wav [--voice <name>]
//   node tools/yarn.mjs voices          (the voices on offer today; the list changes, so never hard-code one)
//
// make.mjs uses it when film.json "voice" has "provider": "yarn". Key: YARNGPT_API_KEY in videos/.env.
// Exit codes match gemini.mjs: 2 out of quota (80 a day), 3 bad key, 1 other.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { speakable } from './gemini.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.yarngpt.ai/api/v1';
const argv = process.argv.slice(2), opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const key = process.env.YARNGPT_API_KEY || [path.join(ROOT, '..', '.env'), path.join(ROOT, '.env')].map((f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } })
  .join('\n').match(/^YARNGPT_API_KEY\s*=\s*"?([^"\n]+)"?/m)?.[1]?.trim();
const die = (m, code = 1) => { console.error(`yarn: ${m}`); process.exit(code); };
if (!key) die('no key. Put YARNGPT_API_KEY=... (free at yarngpt.ai) in videos/.env', 3);

async function call(method, url, body) {
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(url.startsWith('http') ? url : API + url, { method, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: body && JSON.stringify(body), signal: AbortSignal.timeout(120000) }).catch((e) => ({ ok: false, status: 0, text: async () => e.message }));
    if (r.ok) return r;
    const txt = await r.text();
    if (r.status === 401 || r.status === 403) die(`key rejected: ${txt.slice(0, 200)}`, 3);
    if (r.status === 429) { const wait = Number(r.headers?.get?.('retry-after')) || 0; if (wait && wait < 30 && attempt < 3) { await new Promise((ok) => setTimeout(ok, wait * 1000)); continue; } die(`daily limit reached (YarnGPT allows about 80 a day): ${txt.slice(0, 200)}`, 2); }
    if ((r.status >= 500 || r.status === 0) && attempt < 4) { await new Promise((ok) => setTimeout(ok, 3000 * attempt)); continue; }
    die(`${r.status} ${txt.slice(0, 300)}`);
  }
}
const voices = async () => { const d = await (await call('GET', '/voices')).json(); return (Array.isArray(d) ? d : d.voices || d.data || []).map((v) => (typeof v === 'string' ? { id: v } : v)); };

const cmd = argv[0];
if (cmd === 'voices') { for (const v of await voices()) console.log(JSON.stringify(v)); process.exit(0); }
if (cmd !== 'tts') { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 9).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(cmd ? 1 : 0); }

const text = speakable(opt('text') || (opt('file') && fs.readFileSync(opt('file'), 'utf8')) || die('tts needs --text'));
const out = opt('out') || die('tts needs --out');
// a voice by name, else the first one on offer (YarnGPT's list changes over time)
let voice = opt('voice');
if (voice) {
  const all = await voices().catch(() => []);
  const hit = all.find((v) => [v.id, v.name, v.voice_id].some((x) => String(x || '').toLowerCase() === voice.toLowerCase()));
  if (all.length && !hit) { console.error(`yarn: no voice "${voice}"; using the default. Voices: ${all.map((v) => v.name || v.id).join(', ')}`); voice = undefined; }
  else if (hit) voice = hit.id || hit.voice_id || hit.name;
}
// the streaming route hands back a one-time ticket; fetching it returns the audio itself
const prep = await (await call('POST', '/tts/prepare', { text, ...(voice ? { voice } : {}), output_format: 'wav' })).json();
const url = prep.stream_url || (prep.ticket && `${API}/tts/stream/${prep.ticket}`) || die(`unexpected reply: ${JSON.stringify(prep).slice(0, 200)}`);
const audio = Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(180000) })).arrayBuffer());
if (audio.length < 1000) die('empty audio back from YarnGPT');
fs.mkdirSync(path.dirname(out), { recursive: true });
const raw = out + '.yarn';
fs.writeFileSync(raw, audio);
// the same shape as gemini.mjs output: 24 kHz mono WAV, whatever came back
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', out]);
fs.rmSync(raw);
fs.writeFileSync(out + '.json', JSON.stringify({ provider: 'yarngpt', voice: voice || 'default', text, at: new Date().toISOString() }, null, 1));
fs.appendFileSync(path.join(ROOT, 'tools', 'usage.log'), `${new Date().toISOString()}\tyarngpt\ttts\n`);
console.log(out);
