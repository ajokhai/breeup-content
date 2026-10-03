#!/usr/bin/env node
// Cheap typed decisions with TypeSafe's Jev, so agents don't spend their own context on them. No dependencies;
// macOS and Linux. Text only (Jev can't see images or video; use gemini.mjs check/review for those).
//
//   node tools/jev.mjs pick "phone screen with a ring around a button" [--top 3] [--tag transition]
//        Picks HyperFrames registry blocks for a need without reading the 384-item catalog.
//   node tools/jev.mjs lint --file films/<film>/docs/vo/lines.txt [--secs 4.5,6,...]   or   lint "line" "line"
//        Checks script and caption lines: plain English, no pidgin or slang, clear to an older reader,
//        and (with --secs) fits its time on screen at 2.5 words a second. One line out per problem.
//   node tools/jev.mjs dupe "lesson text" [--in moodboard/STYLE.md]
//        Says whether a lesson is already covered, before anyone appends it to the style guide.
//
// Key: TYPESAFE_API_KEY in the environment or videos/.env. Exit codes match gemini.mjs:
// 2 = out of credits or quota (stop and tell Josh) · 3 = bad key · 1 = other.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const MODEL = 'jev-latest';

function die(msg, code = 1) { console.error('jev: ' + msg); process.exit(code); }
function key() {
  if (process.env.TYPESAFE_API_KEY) return process.env.TYPESAFE_API_KEY;
  const f = path.join(ROOT, '.env');
  const m = fs.existsSync(f) && fs.readFileSync(f, 'utf8').match(/^TYPESAFE_API_KEY\s*=\s*"?([^"\n]+)"?/m);
  return m ? m[1].trim() : die('No key. Put TYPESAFE_API_KEY=... in videos/.env', 3);
}

// one request: a state and a map of typed questions; answers come back under the same ids
async function ask(state, questions) {
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch('https://api.typesafe.ai/v1/systemone', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, state, questions }),
      });
    } catch (e) {
      if (attempt >= 4) die(`network: ${e.cause?.code || e.message}`);
      await new Promise(r => setTimeout(r, 2000 * attempt));
      continue;
    }
    if (res.ok) {
      const out = await res.json();
      try { fs.appendFileSync(path.join(HERE, 'usage.log'), `${new Date().toISOString()}\t${out.model}\tsystemone\t${out.usage?.input_tokens || 0}\n`); } catch {}
      return out.answers;
    }
    const txt = await res.text();
    if (res.status === 401 || res.status === 403 && /key|auth/i.test(txt)) die(`KEY REJECTED: ${txt.slice(0, 300)}\nCheck TYPESAFE_API_KEY in videos/.env.`, 3);
    if (res.status === 402 || /credit|billing|balance|quota|insufficient/i.test(txt)) {
      console.error(`${'='.repeat(72)}\nJEV: OUT OF CREDITS OR QUOTA\n${txt.slice(0, 400)}\nTop up at https://console.typesafe.ai  ·  Agents: stop and tell Josh.\n${'='.repeat(72)}`);
      process.exit(2);
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      const wait = (Number(res.headers.get('retry-after')) || 2 * attempt) * 1000;
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    die(`${res.status} ${txt.slice(0, 400)}`);
  }
}

function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) o[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    else o._.push(argv[i]);
  }
  return o;
}

// ------------------------------------------------------------ pick
// The catalog is fetched once from the pinned HyperFrames CLI and cached (tools/cache/, gitignored).
function catalog() {
  const cache = path.join(HERE, 'cache', 'catalog.json');
  if (fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, 'utf8'));
  const hf = path.join(ROOT, 'node_modules', '.bin', 'hyperframes');
  const raw = execFileSync(process.platform === 'win32' ? hf + '.cmd' : hf, ['catalog', '--json'],
    { encoding: 'utf8', maxBuffer: 64 << 20, env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: '1' } });
  const d = JSON.parse(raw), items = Array.isArray(d) ? d : d.items;
  const slim = items.map(i => ({ name: i.name, type: i.type, tags: i.tags || [], description: i.description || '' }));
  fs.mkdirSync(path.dirname(cache), { recursive: true });
  fs.writeFileSync(cache, JSON.stringify(slim));
  return slim;
}
async function pick(a) {
  const need = a._.slice(1).join(' ') || die('pick needs a description of what you need');
  const top = Number(a.top || 3);
  let items = catalog();
  if (a.tag) items = items.filter(i => i.tags.includes(a.tag));
  if (!items.length) die('no catalog items match');
  // Jev allows 255 options per Choice: split into chunks, ask them all in one call, then merge probabilities
  const chunks = [];
  for (let i = 0; i < items.length; i += 200) chunks.push(items.slice(i, i + 200));
  const questions = Object.fromEntries(chunks.map((c, i) => [`c${i}`, {
    type: 'choice',
    instructions: 'Which HyperFrames registry item best delivers what the video needs?',
    criteria: Object.fromEntries(c.map(it => [it.name, `${it.type}: ${it.description} [${it.tags.join(', ')}]`])),
  }]));
  const ans = await ask({ need, context: 'BreeUp: mobile-first tutorial and promo videos for Nigerian residential estates' }, questions);
  // weight each chunk's probabilities by how sure that chunk was, so a confident winner beats a flat chunk
  const scored = Object.values(ans).flatMap(x => Object.entries(x.probabilities).map(([n, p]) => [n, p * (0.5 + x.confidence / 2)]));
  scored.sort((x, y) => y[1] - x[1]);
  for (const [name, p] of scored.slice(0, top)) {
    const it = items.find(i => i.name === name);
    console.log(`${name.padEnd(30)} ${(p * 100).toFixed(0).padStart(3)}%  ${it.description.slice(0, 90)}`);
  }
  console.log(`install: tools/hf add <name>`);
}

// ------------------------------------------------------------ lint
async function lint(a) {
  let lines = a.file ? fs.readFileSync(a.file, 'utf8').split('\n') : a._.slice(1);
  lines = lines.map(l => l.trim()).filter(Boolean);
  if (!lines.length) die('lint needs --file or lines');
  const secs = a.secs ? String(a.secs).split(',').map(Number) : [];
  let problems = 0;
  // deterministic check first: 2.5 words a second is the house speaking rate
  lines.forEach((l, i) => {
    const words = l.split(/\s+/).length;
    if (secs[i] && words / secs[i] > 2.7) { problems++; console.log(`${i + 1}: too long for ${secs[i]}s (${words} words, max ${Math.floor(secs[i] * 2.5)})`); }
  });
  const q = {};
  lines.forEach((l, i) => {
    const instructions = (question) => ({ line: l, question });
    q[`pidgin${i}`] = { type: 'noul', instructions: instructions('Does `line` use Nigerian Pidgin, slang, or overly casual phrasing?') };
    q[`clear${i}`] = { type: 'score', instructions: instructions('How easy is `line` for a 60-year-old Nigerian estate resident to understand on first hearing?'),
      criteria: ['Confusing or jargon-heavy', 'Understandable with effort', 'Clear', 'Instantly clear, plain everyday English'] };
    q[`jargon${i}`] = { type: 'noul', instructions: instructions('Does `line` contain technical or financial jargon a non-technical person might not know?') };
  });
  const ans = await ask({ purpose: 'Voice-over and on-screen captions for a BreeUp tutorial video', lines }, q);
  lines.forEach((l, i) => {
    const flags = [];
    if (ans[`pidgin${i}`].noul > 0.5) flags.push('pidgin or slang');
    if (ans[`jargon${i}`].noul > 0.6) flags.push('jargon');
    if (ans[`clear${i}`].score < 0.5) flags.push(`hard to follow (clarity ${(ans[`clear${i}`].score * 100).toFixed(0)}%)`);
    if (flags.length) { problems++; console.log(`${i + 1}: ${flags.join(', ')}  "${l.slice(0, 80)}"`); }
  });
  console.log(problems ? `${problems} problem(s) in ${lines.length} lines` : `ok: ${lines.length} lines`);
  process.exitCode = problems ? 5 : 0;
}

// ------------------------------------------------------------ dupe
async function dupe(a) {
  const lesson = a._.slice(1).join(' ') || die('dupe needs the lesson text');
  const file = path.resolve(ROOT, a.in || 'moodboard/STYLE.md');
  const guide = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const ans = await ask({ guide, lesson }, {
    covered: { type: 'noul', instructions: 'Does `guide` already state the same rule or advice as `lesson`, even in different words?' },
    conflicts: { type: 'noul', instructions: 'Does `lesson` contradict something in `guide`?' },
  });
  const c = ans.covered.noul, x = ans.conflicts.noul;
  console.log(c > 0.6 ? `covered (${(c * 100).toFixed(0)}%): don't add it` : x > 0.6 ? `conflicts (${(x * 100).toFixed(0)}%): ask Josh which wins` : `new (${(100 - c * 100).toFixed(0)}%): add it`);
}

const args = parseArgs(process.argv.slice(2));
const cmds = { pick, lint, dupe };
if (!cmds[args._[0]]) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 15).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(args._[0] ? 1 : 0);
}
await cmds[args._[0]](args);
