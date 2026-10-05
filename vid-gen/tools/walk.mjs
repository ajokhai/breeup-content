#!/usr/bin/env node
// Product walkthrough capture: an AI drives a real browser through the app and screenshots each screen, for
// tutorials and demos. Screens come out at the sizes the tutorial kit expects (phone 780x1688, laptop 2160x1350),
// with the box of every control it pressed, ready for the kit's gold rings ("regions").
//
//   WALK_USER=... WALK_PASS=... node tools/walk.mjs --url https://breeup.com/login --name pay-by-card \
//        --goal "Sign in as a resident, open Bills and get to the card payment sheet" [--device phone|laptop]
//        [--brain jev|gemini] [--steps 30] [--show] [--see] [--risky]
//
// Output: media/screens/<name>/NN-<screen>.jpg + walk.json (caption, url and regions per screen, every step), and
// cuts/ with UI cut-outs (cards, big numbers, the main button) per screen for launch films (--no-cuts to skip).
// Cheap by design, text only. Two brains:
//   jev (default, cheapest): each step Jev chooses the next control from the page's list. It can type the login
//        and any "quoted text" in the goal; screens are named and captioned from the page's own heading.
//   gemini: Gemini Flash plans each step. Can type any text and writes a tutorial caption per screen
//        (--see adds a small picture of the page when the text view isn't enough).
// Captions are linted by Jev afterwards.
//
// Logins: the model never sees them. It types {{USER}} / {{PASS}} and this tool fills in WALK_USER / WALK_PASS,
// which are only read from the environment, never written to disk or the log.
// Careful by default: it won't press anything that pays, deletes or sends to real people unless --risky.
// It stops (exit 6) at CAPTCHAs, one-time codes or anything else that needs a person.
// Exit codes match gemini.mjs: 2 out of credit · 3 bad key · 1 other · 6 needs a person.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { call } from './gemini.mjs';
import { ask } from './jev.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = (k) => argv.includes(`--${k}`);
const url = opt('url'), goal = opt('goal'), name = opt('name');
if (!url || !goal || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name || '')) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 20).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(1);
}
const brain = opt('brain', 'jev'), device = opt('device', 'phone'), maxSteps = Number(opt('steps', 30)), MODEL = opt('model', 'gemini-flash-latest');
const USER = process.env.WALK_USER || '', PASS = process.env.WALK_PASS || '';
const out = path.join(ROOT, 'media', 'screens', name);
fs.mkdirSync(out, { recursive: true });
const VIEW = device === 'laptop' ? { width: 1080, height: 675 } : { width: 390, height: 844 };
const RISKY = /\b(pay( now)?|pay ₦|confirm payment|delete|remove|deactivate|send (to|reminder|notice)|publish|approve payout|withdraw|transfer)\b/i;

const browser = await chromium.launch({ headless: !flag('show') });
const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2, isMobile: device === 'phone', hasTouch: device === 'phone',
  locale: 'en-NG', timezoneId: 'Africa/Lagos',
  userAgent: device === 'phone' ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' : undefined });
const page = await ctx.newPage();
const settle = async () => { await page.waitForLoadState('domcontentloaded').catch(() => {}); await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {}); await page.waitForTimeout(400); };

// the page as short text: visible controls with an index, plus the start of the visible text
async function snapshot() {
  return page.evaluate(() => {
    document.querySelectorAll('[data-walk]').forEach((e) => e.removeAttribute('data-walk'));
    const sel = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[role=tab],[role=menuitem],[role=checkbox],[role=switch],[role=option],[onclick],[contenteditable=true]';
    const els = [];
    for (const e of document.querySelectorAll(sel)) {
      const r = e.getBoundingClientRect(), st = getComputedStyle(e);
      if (r.width < 4 || r.height < 4 || st.visibility === 'hidden' || st.display === 'none' || +st.opacity === 0) continue;
      if (r.bottom < -400 || r.top > innerHeight + 1600) continue;
      const lab = e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`);
      const nm = (e.getAttribute('aria-label') || lab?.innerText || e.innerText || e.placeholder || e.title || e.alt || e.name || '').replace(/\s+/g, ' ').trim().slice(0, 70);
      const i = els.length; e.setAttribute('data-walk', i);
      const typable = (e.tagName === 'INPUT' && !/^(button|submit|reset|checkbox|radio|file|image|range|color)$/.test(e.type)) || e.tagName === 'TEXTAREA' || e.isContentEditable;
      els.push({ i, kind: e.tagName.toLowerCase() + (e.type && e.tagName === 'INPUT' ? `:${e.type}` : '') + (e.getAttribute('role') ? `[${e.getAttribute('role')}]` : ''),
        name: nm, value: e.type === 'password' ? (e.value ? '(filled)' : '') : (e.value || '').slice(0, 30), checked: !!e.checked, disabled: !!e.disabled,
        pos: r.top > innerHeight ? 'below' : r.bottom < 0 ? 'above' : '', typable });
      if (els.length >= 140) break;
    }
    const h = [...document.querySelectorAll('h1,h2,[role=heading]')].find((x) => x.getBoundingClientRect().height > 0 && x.innerText.trim());
    return { url: location.href, title: document.title, heading: (h?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      text: document.body.innerText.replace(/\n{2,}/g, '\n').slice(0, 1500), els };
  });
}

// UI cut-outs: on each captured screen, the pieces a launch film can lift out on their own: cards (pricing tiers,
// features), big numbers (prices, stats; they become count-ups) and the main button. Found from the page's own layout
// and styles (free, no AI), cropped as PNGs at screenshot resolution. Saved in cuts/ next to the screens.
async function findCuts(prefix) {
  const found = await page.evaluate(() => {
    document.querySelectorAll('[data-cut]').forEach((e) => e.removeAttribute('data-cut'));
    const vw = innerWidth, vh = innerHeight, txt = (e) => (e.innerText || '').replace(/\s+/g, ' ').trim();
    const inView = (r) => r.left >= 0 && r.top >= 0 && r.right <= vw + 1 && r.bottom <= vh + 1;
    const solid = (c) => !!c && c !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(c);
    const ok = (e, st) => st.visibility !== 'hidden' && st.display !== 'none' && +st.opacity >= 0.6;
    const cards = [], buttons = [], stats = [];
    for (const e of document.querySelectorAll('body *')) {
      if (/^(SCRIPT|STYLE|SVG|PATH|IMG|VIDEO|CANVAS|IFRAME|HTML|BODY)$/i.test(e.tagName)) continue;
      const R = e.getBoundingClientRect(); if (R.width < 40 || R.height < 24 || R.right <= 0 || R.bottom <= 0 || R.left >= vw || R.top >= vh) continue;
      // the part on screen: cards running off the bottom are cropped to what's visible (if most of their top is there)
      const r = { x: Math.max(0, R.left), y: Math.max(0, R.top), width: Math.min(vw, R.right) - Math.max(0, R.left), height: Math.min(vh, R.bottom) - Math.max(0, R.top) };
      const whole = inView(R), mostly = r.width >= R.width - 2 && R.top >= 0 && r.height >= Math.min(R.height * 0.45, vh * 0.4);
      const st = getComputedStyle(e); if (!ok(e, st)) continue;
      const t = txt(e); if (!t) continue;
      const pbg = e.parentElement ? getComputedStyle(e.parentElement).backgroundColor : '';
      const bg = solid(st.backgroundColor) && st.backgroundColor !== pbg, border = parseFloat(st.borderTopWidth) > 0 && solid(st.borderTopColor) && parseFloat(st.borderLeftWidth) > 0;
      const shadow = st.boxShadow !== 'none', radius = parseFloat(st.borderTopLeftRadius) || 0;
      const clickable = /^(BUTTON|A)$/.test(e.tagName) || e.getAttribute('role') === 'button';
      if (whole && clickable && bg && t.length <= 28 && r.height >= 28 && r.height <= 80 && r.width <= vw * 0.5) buttons.push({ e, r, t, radius, area: r.width * r.height });
      // cards come in sets (a row of pricing tiers): siblings of about the same width in a row, each with a heading
      const head = !!e.querySelector('h1,h2,h3,h4,strong,b,[class*=title],[class*=heading]');
      const sib = !!e.parentElement && [...e.parentElement.children].filter((o) => { const q = o.getBoundingClientRect(); return o !== e && Math.abs(q.width - R.width) < 8 && Math.abs(q.top - R.top) < 40; }).length >= 1;
      if (mostly && (bg || border || shadow || (sib && head)) && !clickable && r.width >= vw * 0.16 && r.width <= vw * 0.92 && r.height >= 90 && r.height <= vh * 0.9 && t.length >= 12 && t.length <= 420) {
        cards.push({ e, r, t, radius, area: r.width * r.height, score: (sib ? 3 : 0) + (head ? 1 : 0) + (radius >= 6 ? 1 : 0) + (shadow ? 1 : 0) + (border ? 0.5 : 0) - (r.width * r.height) / (vw * vh) });
      }
      // a big number on its own: "$8", "99.9%", "10,000+", "4.9"
      // prices count at any readable size ("$10 per user/month"); plain numbers only when set big ("99.9%", "10,000+")
      if (whole && e.children.length <= 2 && t.length <= 32 && parseFloat(st.fontSize) >= 14) {
        const m = /^([^\d\s-]{0,4})\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s?([kKmMbB]\+?|%|\+|x|×)?(\s*(?:per\s|\/)\s?[\w \/]{1,20})?$/.exec(t);
        const money = m && /[$€£₦¥₹]/.test(m[1]);
        if (m && (money || (parseFloat(st.fontSize) >= 26 && !m[4]))) {
          let lab = '', p = e.parentElement;
          for (let k = 0; p && k < 3 && !lab; k++, p = p.parentElement) { const pt = txt(p).replace(t, '').trim(); if (pt && pt.length <= 60) lab = pt; }
          stats.push({ e, r, t, radius: 0, area: r.width * r.height, num: { prefix: m[1], value: Number(m[2].replace(/,/g, '')), decimals: (m[2].split('.')[1] || '').length, comma: m[2].includes(','), suffix: m[3] || '', unit: (m[4] || '').trim() }, label: lab, size: parseFloat(st.fontSize) + (money ? 20 : 0) });
        }
      }
    }
    // keep the best few that don't sit inside each other
    const pick = (list, n, by) => {
      const out = [];
      for (const c of list.sort(by)) {
        if (out.some((o) => o.e.contains(c.e) || c.e.contains(o.e) || o.t === c.t)) continue;
        out.push(c); if (out.length >= n) break;
      }
      return out;
    };
    const res = [...pick(cards, 4, (a, b) => b.score - a.score).map((c) => ({ ...c, kind: 'card' })), ...pick(buttons, 1, (a, b) => b.area - a.area).map((c) => ({ ...c, kind: 'button' })),
      ...pick(stats, 3, (a, b) => b.size - a.size).map((c) => ({ ...c, kind: 'stat' }))];
    return res.map((c, i) => { c.e.setAttribute('data-cut', i); return { i, kind: c.kind, text: c.t.slice(0, 200), box: [c.r.x, c.r.y, c.r.width, c.r.height], radius: c.radius, ...(c.num ? { num: c.num, label: c.label } : {}) }; });
  }).catch(() => []);
  const cuts = [];
  if (found.length) fs.mkdirSync(path.join(out, 'cuts'), { recursive: true });
  for (const c of found) {
    const file = `cuts/${prefix}-${c.kind}${c.i + 1}.png`;
    // a clip of the viewport, as captured: the page never scrolls, so cut-outs match the screenshot exactly
    const [x, y, w, h] = c.box;
    try { await page.screenshot({ path: path.join(out, file), clip: { x, y, width: w, height: h }, timeout: 4000 }); }
    catch { continue; }
    const { i, box, ...rest } = c;
    cuts.push({ ...rest, file, box: box.map((v) => Math.round(v * 2)), radius: Math.round(c.radius * 2) });   // screenshot px
  }
  return cuts;
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    seen: { type: 'STRING', description: 'One short sentence: what screen this is.' },
    shot: { type: 'STRING', description: 'If this screen belongs in the walkthrough and has not been captured yet, a short kebab-case name for it (e.g. "bills", "pay-sheet"); else empty.' },
    caption: { type: 'STRING', description: 'If shot: one plain-English sentence a tutorial would say on this screen, using the app\'s own button labels.' },
    action: { type: 'STRING', enum: ['click', 'type', 'select', 'press', 'scroll', 'goto', 'back', 'wait', 'done', 'stuck'] },
    el: { type: 'INTEGER', description: 'Index of the control for click/type/select; -1 otherwise.' },
    text: { type: 'STRING', description: 'type: the text ({{USER}} / {{PASS}} for the login); select: the option; press: a key like Enter; goto: a URL; done/stuck: why.' },
    mark: { type: 'STRING', description: 'Short kebab-case name for the control being used (e.g. "pay-button"), saved as a highlight region.' },
  },
  required: ['seen', 'shot', 'caption', 'action', 'el', 'text', 'mark'],
};
const RULES = `You are capturing screenshots of a web app for a product tutorial video. Reach the goal in as few steps as
possible and capture every distinct screen a viewer needs to follow along (a shot names the CURRENT screen, before your
action). Logins: type {{USER}} and {{PASS}}, never invent credentials. Never pay, delete, or send anything to real
people unless the goal says to. If you see a CAPTCHA, a one-time code, or anything that needs a person, answer "stuck".
Answer "done" as soon as the goal's final screen has been captured. Controls marked "below" need a scroll first.`;

const log = [], shots = [], seen = new Set();
const screenSig = (snap) => `${snap.url}|${snap.els.map((e) => e.name).join('|')}`;
const slug = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32).replace(/-[^-]*$/, (m, i, all) => (all.length >= 32 ? '' : m));
const history = () => log.slice(-8).map((l) => `${l.step}. ${l.action}${l.mark ? ' ' + l.mark : ''}${l.text && l.action !== 'type' ? ' ' + l.text : ''} -> ${l.result}`).join('\n');
const row = (e) => [e.i, e.kind, e.name, e.value, e.checked && 'checked', e.disabled && 'disabled', e.pos].filter((x, k) => k < 3 || x).join(' | ');

async function decideGemini(snap) {
  const parts = [{ text: `${RULES}\n\nGOAL: ${goal}\nDEVICE: ${device}\nCAPTURED SO FAR: ${shots.map((s) => s.name).join(', ') || 'nothing'}\nRECENT STEPS:\n${history() || '(start)'}\n\nPAGE: ${snap.title} · ${snap.url}\nVISIBLE TEXT:\n${snap.text}\n\nCONTROLS (index | kind | name | value | state):\n${snap.els.map(row).join('\n')}` }];
  if (flag('see') || repeats >= 2) {   // a small picture only when asked or when the text view seems not to be enough
    const b = await page.screenshot({ type: 'jpeg', quality: 60, scale: 'css' });
    parts.unshift({ inlineData: { mimeType: 'image/jpeg', data: b.toString('base64') } });
  }
  const res = await call('POST', `models/${MODEL}:generateContent`, { contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.2 } });
  try { return JSON.parse(res.candidates[0].content.parts[0].text); } catch { return null; }
}

// Jev can't write text, so it chooses from typed options: press a control, type the login or a quoted phrase
// from the goal into a field, scroll, go back, done or stuck. One cheap call per step.
async function decideJev(snap) {
  const quotes = [...goal.matchAll(/["“]([^"”]{1,60})["”]/g)].map((m) => m[1]).slice(0, 3);
  const failed = new Set(log.filter((l) => l.result !== 'ok').map((l) => l.key));
  const opts = {}, acts = {};
  const add = (k, desc, act) => { if (!failed.has(k) && Object.keys(opts).length < 246) { opts[k] = desc; acts[k] = act; } };
  for (const e of snap.els) {
    if (e.disabled) continue;
    const where = e.pos ? ` (${e.pos} the visible area)` : '', label = e.name || e.kind;
    if (e.typable) {
      if (/password/.test(e.kind) || /pin|password/i.test(e.name)) add(`p${e.i}`, `Type the password or PIN into "${label}"${e.value ? ' (already filled)' : ''}${where}`, { action: 'type', el: e.i, text: '{{PASS}}' });
      else add(`u${e.i}`, `Type the login (phone number or email) into "${label}"${e.value ? ` (now "${e.value}")` : ''}${where}`, { action: 'type', el: e.i, text: '{{USER}}' });
      quotes.forEach((q, k) => add(`q${k}_${e.i}`, `Type "${q}" into "${label}"${where}`, { action: 'type', el: e.i, text: q }));
    } else add(`c${e.i}`, `Press ${e.kind} "${label}"${e.checked ? ' (checked)' : ''}${where}`, { action: 'click', el: e.i, text: '' });
  }
  const scrolled = log.slice(-2).filter((l) => l.action === 'scroll').length === 2;   // two scrolls in a row: stop scrolling
  if (!scrolled) add('scroll', 'Scroll down to see more of this page', { action: 'scroll', el: -1, text: '' });
  add('back', 'Go back to the previous page', { action: 'back', el: -1, text: '' });
  add('done', "Done: the goal's final screen is showing now", { action: 'done', el: -1, text: 'goal reached' });
  add('stuck', 'Stuck: a CAPTCHA, a one-time code, an error, or something only a person can do', { action: 'stuck', el: -1, text: 'Jev chose stuck' });
  const ans = await ask({ goal, device, captured: shots.map((s) => s.name).join(', ') || 'nothing', recent_steps: history() || '(start)',
    page_title: snap.title, page_heading: snap.heading, page_url: snap.url, visible_text: snap.text.slice(0, 1200) }, {
    next: { type: 'choice', criteria: opts, instructions: 'You are clicking through a web app to capture screenshots for a tutorial: `goal`. ' +
      'Look at `visible_text`, `recent_steps` and `captured`. Which single action moves most directly toward the goal? Fill a login form before ' +
      'pressing its button. Never pay, delete or send anything to real people unless the goal says to.' },
    shot: { type: 'noul', instructions: 'Is the current page (`page_heading`, `visible_text`) a distinct screen that a viewer of a tutorial about `goal` needs to see, and not already listed in `captured`?' },
  });
  // a free nudge: controls named with words from the goal ("pricing", "billing") that haven't been pressed yet
  const STOP = new Set(['the', 'and', 'then', 'open', 'page', 'your', 'with', 'from', 'into', 'that', 'this', 'show', 'capture', 'click', 'tap', 'go', 'to']);
  const goalWords = new Set(goal.toLowerCase().match(/[a-z]{3,}/g)?.filter((w) => !STOP.has(w)) || []);
  const pressed = new Set(log.map((l) => l.key));
  const bonus = (k) => {
    const e = acts[k]?.el >= 0 ? snap.els[acts[k].el] : null;
    if (!e || pressed.has(k) || acts[k].action !== 'click') return 0;
    const w = (e.name.toLowerCase().match(/[a-z]{3,}/g) || []).filter((x) => !STOP.has(x));
    return w.length && w.every((x) => goalWords.has(x)) ? 0.35 : 0;
  };
  const key = Object.entries(ans.next.probabilities).map(([k, pr]) => [k, pr + bonus(k)]).sort((a, b) => b[1] - a[1])[0][0];
  const act = acts[key], e = snap.els[act.el];
  const name = slug(snap.heading || snap.title) || 'screen';
  const take = ans.shot.noul > 0.5 || act.action === 'done';
  return { seen: snap.heading || snap.title, shot: take ? (shots.some((s) => s.name === name) ? `${name}-${shots.length + 1}` : name) : '',
    caption: snap.heading || snap.title, ...act, mark: e ? slug(e.name || e.kind) : '', key };
}

let last = '', repeats = 0, exit = 0;
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
await settle();

for (let step = 1; step <= maxSteps; step++) {
  const snap = await snapshot();
  const d = await (brain === 'gemini' ? decideGemini(snap) : decideJev(snap));
  if (!d) { console.log(`${step}. (unreadable answer, retrying)`); continue; }

  // capture the current screen first, with the box of the control about to be used
  const target = d.el >= 0 ? page.locator(`[data-walk="${d.el}"]`).first() : null;
  if (d.shot) {
    if (target) await target.scrollIntoViewIfNeeded().catch(() => {});
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    const h = crypto.createHash('sha1').update(buf).digest('hex');
    if (!seen.has(h)) {
      seen.add(h);
      const file = `${String(shots.length + 1).padStart(2, '0')}-${d.shot.replace(/[^a-z0-9-]/g, '').slice(0, 40) || 'screen'}.jpg`;
      fs.writeFileSync(path.join(out, file), buf);
      const cuts = flag('no-cuts') ? [] : await findCuts(file.replace(/\.jpg$/, ''));
      shots.push({ name: d.shot, file, caption: d.caption, url: snap.url, regions: {}, ...(cuts.length ? { cuts } : {}), sig: screenSig(snap) });
      console.log(`  shot ${file}: ${d.caption}${cuts.length ? `  (cut-outs: ${cuts.map((c) => c.kind).join(', ')})` : ''}`);
    }
  }
  // what was done on this screen, in tutorial words ("Tap “Pricing”"), only onto the screen it happened on
  if (shots.length && shots.at(-1).sig === screenSig(snap) && d.el >= 0) {
    const e = snap.els[d.el] || {}, nm = (e.name || '').replace(/\s+/g, ' ').slice(0, 40);
    const did = d.action === 'click' ? `Tap “${nm || 'the button'}”` : d.action === 'select' ? `Choose “${d.text}”`
      : d.action === 'type' ? (d.text === '{{PASS}}' ? 'Enter your password' : d.text === '{{USER}}' ? `Enter your ${/phone/i.test(nm) ? 'phone number' : /mail/i.test(nm) ? 'email' : 'login'}` : `Type “${d.text}”`) : '';
    if (did) (shots.at(-1).does ||= []).push(did);
  }
  if (target && d.mark && shots.length && shots.at(-1).sig === screenSig(snap)) {
    const b = await target.boundingBox().catch(() => null);
    if (b) shots.at(-1).regions[d.mark] = [b.x, b.y, b.width, b.height].map((v) => Math.round(v * 2));   // screenshot px
  }

  const label = d.el >= 0 ? snap.els[d.el]?.name || snap.els[d.el]?.kind || '' : '';
  const entry = { step, key: d.key || `${d.action}${d.el}`, seen: d.seen, action: d.action, mark: d.mark, text: /{{(USER|PASS)}}/.test(d.text) ? d.text : d.action === 'type' ? d.text.slice(0, 60) : d.text, result: 'ok' };
  console.log(`${step}. ${d.seen} -> ${d.action}${label ? ` "${label}"` : ''}${d.action === 'type' ? ` ${/{{/.test(d.text) ? d.text : JSON.stringify(d.text.slice(0, 40))}` : d.text && d.action !== 'click' ? ` ${d.text}` : ''}`);
  if (d.action === 'done') { log.push(entry); break; }
  if (d.action === 'stuck') { log.push(entry); console.log(`stopped: needs a person (${d.text})`); exit = 6; break; }
  if (!flag('risky') && d.action === 'click' && RISKY.test(label)) {
    entry.result = `refused: "${label}" could pay, delete or send. Rerun with --risky if that's really wanted.`;
    log.push(entry); console.log(`  ${entry.result}`); break;
  }
  try {
    const fill = (t) => t.replace(/{{USER}}/g, USER).replace(/{{PASS}}/g, PASS);
    if (/{{(USER|PASS)}}/.test(d.text) && !(USER || PASS)) throw new Error('the page needs a login, but no WALK_USER / WALK_PASS were given');
    if (d.action === 'click') await target.click({ timeout: 8000 });
    else if (d.action === 'type') { await target.fill('', { timeout: 8000 }); await target.pressSequentially(fill(d.text), { delay: 20 }); }
    else if (d.action === 'select') await target.selectOption({ label: d.text }).catch(() => target.selectOption(d.text));
    else if (d.action === 'press') await page.keyboard.press(d.text || 'Enter');
    else if (d.action === 'scroll') await page.mouse.wheel(0, VIEW.height * 0.8);
    else if (d.action === 'goto') await page.goto(new URL(d.text, page.url()).href, { waitUntil: 'domcontentloaded' });
    else if (d.action === 'back') await page.goBack();
    else await page.waitForTimeout(1500);
  } catch (e) { entry.result = `failed: ${e.message.split('\n')[0].slice(0, 120)}`; console.log(`  ${entry.result}`); if (/no WALK_USER/.test(e.message)) { log.push(entry); exit = 6; break; } }
  log.push(entry);
  await settle();
  const sig = page.url() + '|' + (await page.evaluate(() => document.body.innerText.length).catch(() => 0));
  repeats = sig === last ? repeats + 1 : 0; last = sig;
  if (repeats >= 4) { console.log('stopped: the page stopped changing'); exit = 1; break; }
  if (step === maxSteps) console.log(`stopped: reached --steps ${maxSteps}`);
}
await browser.close();

fs.writeFileSync(path.join(out, 'walk.json'), JSON.stringify({ url, goal, device, brain, size: [VIEW.width * 2, VIEW.height * 2], at: new Date().toISOString(), shots: shots.map(({ sig, ...s }) => s), steps: log }, null, 1) + '\n');
console.log(`\n${shots.length} screen(s) in media/screens/${name}/ (walk.json has captions and regions)`);
// captions become on-screen text: let Jev (cheap) check them for plain English
if (shots.length) {
  const tmp = path.join(out, '.captions.txt');
  fs.writeFileSync(tmp, shots.map((s) => s.caption).join('\n'));
  try { execFileSync(process.execPath, [path.join(ROOT, 'tools', 'jev.mjs'), 'lint', '--file', tmp], { cwd: ROOT, stdio: 'inherit' }); } catch {}
  fs.rmSync(tmp, { force: true });
}
process.exit(exit);
