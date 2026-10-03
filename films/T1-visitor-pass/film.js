// T1 How to send a visitor pass on WhatsApp. Pure function of time; follows docs/shotlist.md.
// Beats (u) on the 96 bpm grid: 0.625 s a beat, 64 beats.
import * as M from './lib/motion.js';

const { W, H, FORMAT, E, prog, lerp, clamp, springU, springKeys, SPRING, wobble, font, layout, glyph, text, fill, cover, rrect } = M;

const C = { green: '#1a472a', deep: '#123220', cream: '#f6f4ee', gold: '#c9a84c', ink: '#1c1f1b', mute: '#5d645c', wa: '#25D366', white: '#ffffff' };
const DISPLAY = 'Display', UI = 'UI';
const P = FORMAT.portrait;

const HITS = [
  [0, 'hook photo', 'sub', { len: 0.8 }],
  [0.5, 'title word', 'tick'], [1, 'title word', 'tick'], [1.5, 'title word', 'tick'], [2, 'title word', 'tick'],
  [3, 'title line 2', 'pop', { pitch: 'C5' }],
  [6, 'green wipe', 'whoosh', { len: 0.5 }],
  [7, 'question', 'tick'],
  [12, 'intro card', 'bell', { pitch: 'F5' }],
  [16, 'phone lands', 'thud'],
  [16.5, 'step 1', 'pop', { pitch: 'A5' }],
  [19, 'ring phone field', 'blip', { pitch: 'C6' }],
  [21, 'ring pin', 'blip', { pitch: 'D6' }],
  [22.5, 'tap sign in', 'click'],
  [24, 'screen change', 'whoosh', { len: 0.35, from: 2400, to: 700 }],
  [24.5, 'step 2', 'pop', { pitch: 'A5' }],
  [27, 'ring card', 'blip', { pitch: 'C6' }],
  [32, 'step 3', 'pop', { pitch: 'A5' }],
  [33, 'ring name', 'type', { len: 0.6, n: 6 }],
  [35, 'ring type', 'blip', { pitch: 'D6' }],
  [35.5, 'chip guest', 'tick'], [36, 'chip delivery', 'tick'], [36.5, 'chip cab', 'tick'], [37, 'chip artisan', 'tick'],
  [38.5, 'create pass', 'click'],
  [40, 'step 4', 'pop', { pitch: 'A5' }],
  [41, 'code S', 'tok', { pitch: 'F5' }], [41.5, 'code B', 'tok', { pitch: 'A5' }], [42, 'code 1279', 'tok', { pitch: 'C6' }],
  [44, 'ring whatsapp', 'blip', { pitch: 'C6' }],
  [45.5, 'tap whatsapp', 'click'],
  [46, 'whatsapp grows', 'whoosh', { len: 0.6, from: 500, to: 3000 }],
  [48, 'gate reveal', 'sub', { len: 0.6 }],
  [52, 'cleared chip', 'bell', { pitch: 'C6' }],
  [56, 'tip card', 'whoosh', { len: 0.4, from: 2600, to: 900 }],
  [60, 'end card', 'impact'],
  [60.5, 'logo', 'bell', { pitch: 'F6' }],
];

// ------------------------------------------------------------ helpers
function wrap(ctx, str, f, maxW) {
  ctx.font = f;
  const out = []; let line = '';
  for (const w of str.split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}
// lines rise out of a mask, staggered; exit drops them out the top
function riseLines(ctx, lines, x, y, lh, f, color, u, u0, { stagger = 0.35, exitU = 1e9, align = 'left' } = {}) {
  lines.forEach((ln, i) => {
    const k = springU(u, u0 + i * stagger, SPRING.gentle);
    if (k <= 0) return;
    const ex = E.inCubic(prog(u, exitU + i * 0.08, exitU + 0.6 + i * 0.08));
    const by = y + i * lh;
    ctx.save(); ctx.beginPath(); ctx.rect(0, by - lh * 0.95, W, lh * 1.25); ctx.clip();
    text(ctx, ln, x, by + (1 - k) * lh * 0.9 - ex * lh, f, color, align);
    ctx.restore();
  });
}
function scrim(ctx, y0, y1, a) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, 'rgba(10,22,14,0)'); g.addColorStop(1, `rgba(10,22,14,${a})`);
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, y1 - y0);
}

// ------------------------------------------------------------ layout per format
const L = FORMAT.pick({
  '16x9': { stage: [0, 0, 1080, 1080], phoneH: 940, cap: { x: 1170, y: 300, w: 650 } },
  '9x16': { stage: [0, 790, 1080, 1130], phoneH: 1040, cap: { x: 72, y: 280, w: 936 } },
});
const SRC = { w: 780, h: 1688 };
const phoneW = L.phoneH * SRC.w / SRC.h;
const [sx0, sy0, sw0, sh0] = L.stage;
const PH = { x: sx0 + (sw0 - phoneW) / 2, y: P ? sy0 + 50 : sy0 + (sh0 - L.phoneH) / 2, w: phoneW, h: L.phoneH };

// regions on the real screenshots (source px, 780x1688)
const R = {
  phone: [40, 704, 700, 84], pin: [40, 872, 508, 112], signin: [40, 1086, 700, 88],
  card: [32, 730, 716, 430],
  name: [74, 924, 632, 86], type: [74, 1026, 388, 82], create: [478, 1026, 228, 82],
  code: [74, 1150, 632, 260], wa: [104, 1446, 384, 70],
};
const s2f = (x, y) => [PH.x + x * PH.w / SRC.w, PH.y + y * PH.h / SRC.h];

// ------------------------------------------------------------ S1 hook  (u 0..6)  + S2 question (6..12)
function sceneHook(ctx, u, IMG) {
  fill(ctx, C.deep);
  const z = 1.12 - 0.05 * prog(u, 0, 7);
  cover(ctx, IMG.gate, 0, 0, W, H, { fx: P ? 0.3 : 0.5, fy: 0.5, zoom: z });
  scrim(ctx, H * 0.35, H, 0.82);
  const s = FORMAT.safe;
  const size = FORMAT.pick({ '16x9': 128, '9x16': 118 });
  const f = font(size, 400, DISPLAY);
  const lines = P ? ['Send a visitor', 'pass in under', 'a minute.'] : ['Send a visitor pass', 'in under a minute.'];
  const y0 = P ? H - 430 - (lines.length - 1) * size * 1.02 - 40 : H - 150 - size * 1.02;
  // word by word on the half beats
  let wi = 0;
  lines.forEach((ln, li) => {
    let x = s.x;
    ln.split(' ').forEach((w) => {
      const u0 = 0.4 + wi * 0.5 - (wi === 0 ? 0.3 : 0);
      const k = springU(u, u0, SPRING.snappy);
      const Lw = layout(ctx, w, f, -0.01 * size);
      if (k > 0) {
        const by = y0 + li * size * 1.02;
        ctx.save(); ctx.beginPath(); ctx.rect(0, by - size, W, size * 1.3); ctx.clip();
        const col = /minute/.test(w) ? C.gold : C.cream;
        text(ctx, w, x, by + (1 - k) * size, f, col, 'left', -0.01 * size);
        ctx.restore();
      }
      x += Lw.width + size * 0.26; wi++;
    });
  });
  // small kicker above
  const kk = E.outCubic(prog(u, 0, 1));
  text(ctx, 'BREEUP TUTORIAL · RESIDENTS', s.x, y0 - size * 1.05, font(FORMAT.pick({ '16x9': 30, '9x16': 30 }), 500, UI), `rgba(246,244,238,${0.85 * kk})`, 'left', 3);
}

function sceneQuestion(ctx, u, IMG) {
  // green band wipes up (6..7), then reveals the family photo from its top edge
  const wipe = E.inOutCubic(prog(u, 5.6, 6.6));
  const reveal = E.inOutCubic(prog(u, 6.3, 7.3));
  sceneHook(ctx, u, IMG);
  const top = H * (1 - wipe);
  ctx.fillStyle = C.green; ctx.fillRect(0, top, W, H);
  if (reveal > 0) {
    const ry = H * (1 - reveal);
    ctx.save(); ctx.beginPath(); ctx.rect(0, ry, W, H); ctx.clip();
    cover(ctx, IMG.family, 0, 0, W, H, { fx: P ? 0.55 : 0.5, fy: P ? 0.6 : 0.62, zoom: 1.05 + 0.04 * prog(u, 6, 12) });
    scrim(ctx, H * 0.4, H, 0.78);
    ctx.restore();
  }
  const s = FORMAT.safe;
  const size = FORMAT.pick({ '16x9': 76, '9x16': 84 });
  const f = font(size, 400, DISPLAY);
  const lines = wrap(ctx, 'Expecting a guest, a delivery or an artisan?', f, P ? s.w : 1300);
  const y = P ? H - 430 - (lines.length - 1) * size * 1.1 : H - 130 - (lines.length - 1) * size * 1.1;
  riseLines(ctx, lines, s.x, y, size * 1.1, f, C.cream, u, 7, { stagger: 0.4 });
}

// ------------------------------------------------------------ S3 intro  (u 12..16)
function drawLogo(ctx, IMG, cx, cy, size, k = 1) {
  if (!IMG.logo || k <= 0) return;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
  ctx.drawImage(IMG.logo, -size / 2, -size / 2, size, size);
  ctx.restore();
}
function sceneIntro(ctx, u, IMG) {
  // cream panel slides up over the family shot
  const inn = E.inOutCubic(prog(u, 11.4, 12.2));
  if (inn < 1) sceneQuestion(ctx, u, IMG);
  const top = H * (1 - inn);
  ctx.fillStyle = C.cream; ctx.fillRect(0, top, W, H);
  ctx.save(); ctx.translate(0, top);
  const k = springU(u, 12, SPRING.bouncy);
  const ls = FORMAT.pick({ '16x9': 150, '9x16': 190 });
  const cx = P ? W / 2 : W * 0.32, cy = P ? H * 0.38 : H / 2;
  drawLogo(ctx, IMG, cx, cy, ls, k);
  const size = FORMAT.pick({ '16x9': 92, '9x16': 92 });
  const f = font(size, 400, DISPLAY);
  if (P) riseLines(ctx, ["Here's how,", 'in four steps.'], W / 2, cy + ls * 0.9 + size, size * 1.1, f, C.green, u, 12.6, { align: 'center' });
  else riseLines(ctx, ["Here's how,", 'in four steps.'], cx + ls * 0.75, cy - 10, size * 1.1, f, C.green, u, 12.6);
  ctx.restore();
}

// ------------------------------------------------------------ S4-7 phone steps (u 16..48)
const STEPS = [
  { n: '1', u0: 16, title: 'Sign in', body: "Open your estate's sign-in link and sign in with your phone number and 4-digit PIN." },
  { n: '2', u0: 24, title: 'Find the card', body: 'On your Home page, look for the Visitor gate pass card.' },
  { n: '3', u0: 32, title: 'Name and type', body: "Type your visitor's name, choose the type of visit, then tap Create pass." },
  { n: '4', u0: 40, title: 'Send it', body: 'Tap Send on WhatsApp. Your visitor gets the code in seconds.' },
];
// camera: [zoom, fx, fy] in screenshot fractions
const CAM = [
  [16, [1, 0.5, 0.5]], [18.5, [1.45, 0.5, 0.52]], [22, [1.35, 0.5, 0.6]], [24, [1, 0.5, 0.5]],
  [26.5, [1.5, 0.5, 0.56]], [31, [1.5, 0.5, 0.56]], [32.5, [1.8, 0.5, 0.6]], [37.5, [1.7, 0.5, 0.62]],
  [40, [1.55, 0.5, 0.75]], [43.5, [1.9, 0.38, 0.87]],
];
const RINGS = [
  { r: 'phone', a: 19, b: 21 }, { r: 'pin', a: 21, b: 22.5 }, { r: 'signin', a: 22.5, b: 24, tap: 22.5 },
  { r: 'card', a: 27, b: 32 },
  { r: 'name', a: 33, b: 35 }, { r: 'type', a: 35, b: 38.5 }, { r: 'create', a: 38.5, b: 40, tap: 38.5 },
  { r: 'code', a: 41, b: 44 }, { r: 'wa', a: 44, b: 48, tap: 45.5 },
];

function ringAt(ctx, u, { r, a, b, tap }) {
  if (u < a - 0.05 || u > b + 0.4) return;
  const [x, y, w, h] = R[r];
  const [X, Y] = s2f(x, y);
  const sc = PH.w / SRC.w;
  const pad = 10 / sc;
  const draw = E.outCubic(prog(u, a, a + 0.8));
  const out = E.inCubic(prog(u, b, b + 0.35));
  const alpha = 1 - out;
  const rx = X - pad * sc, ry = Y - pad * sc, rw = (w + 2 * pad) * sc, rh = (h + 2 * pad) * sc;
  const per = 2 * (rw + rh);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 7 * sc; ctx.strokeStyle = C.gold; ctx.lineCap = 'round';
  ctx.setLineDash([per * draw, per]);
  rrect(ctx, rx, ry, rw, rh, 16 * sc); ctx.stroke();
  ctx.setLineDash([]);
  if (tap != null && u >= tap) {
    const tk = prog(u, tap, tap + 0.9);
    const cx = rx + rw / 2, cy = ry + rh / 2;
    ctx.globalAlpha = alpha * (1 - tk) * 0.9;
    ctx.fillStyle = C.gold;
    ctx.beginPath(); ctx.arc(cx, cy, (20 + 70 * E.outCubic(tk)) * sc, 0, M.TAU); ctx.fill();
  }
  ctx.restore();
}

function scenePhone(ctx, u, IMG) {
  fill(ctx, C.cream);
  // stage panel
  ctx.fillStyle = C.green; ctx.fillRect(...L.stage);
  // phone rises in on 16
  const k = springU(u, 15.6, SPRING.gentle);
  const q = 0.03 * wobble((u - 16.2) * 0.625, 2.2, 6);
  const [z, fx, fy] = springKeys(u, CAM, SPRING.gentle);
  const fpx = PH.x + fx * PH.w, fpy = PH.y + fy * PH.h;
  const cx = sx0 + sw0 / 2, cy = sy0 + sh0 / 2;
  const zk = clamp((z - 1) / 0.5);
  const ax = lerp(fpx, cx, zk), ay = lerp(fpy, cy, zk);
  ctx.save();
  ctx.beginPath(); ctx.rect(...L.stage); ctx.clip();
  ctx.translate(0, (1 - k) * (sh0 + 200));
  ctx.translate(ax, ay); ctx.scale(z * (1 + q), z * (1 - q)); ctx.translate(-fpx, -fpy);
  // bezel
  const bz = 16;
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
  rrect(ctx, PH.x - bz, PH.y - bz, PH.w + 2 * bz, PH.h + 2 * bz, 64); ctx.fillStyle = '#0d0f0d'; ctx.fill();
  ctx.shadowColor = 'transparent';
  // screen: login -> home (slide up at 24) -> visitor pass (slide at 32)
  ctx.save(); rrect(ctx, PH.x, PH.y, PH.w, PH.h, 50); ctx.clip();
  const sA = E.inOutCubic(prog(u, 23.6, 24.4));
  const sB = E.inOutCubic(prog(u, 31.6, 32.3));
  if (sA < 1) ctx.drawImage(IMG.login, PH.x, PH.y - sA * PH.h * 0.3, PH.w, PH.h);
  if (sA > 0 && sB < 1) ctx.drawImage(IMG.home, PH.x, PH.y + (1 - sA) * PH.h, PH.w, PH.h);
  if (sB > 0) {
    // the pass screen continues from Home: same layout, so a short cross push reads as the pass appearing
    ctx.globalAlpha = sB; ctx.drawImage(IMG.pass, PH.x, PH.y, PH.w, PH.h); ctx.globalAlpha = 1;
  }
  ctx.restore();
  RINGS.forEach((r) => ringAt(ctx, u, r));
  ctx.restore();

  // caption column
  const st = STEPS.findLast((s) => u >= s.u0 - 0.3) || STEPS[0];
  drawStep(ctx, u, st);
  drawStepDots(ctx, u);
  if (u >= 35 && u < 40) drawTypeChips(ctx, u);
  if (u >= 40.5) drawCode(ctx, u);
  // WhatsApp green grows from the button (46..48)
  if (u >= 46) {
    const g = E.inCubic(prog(u, 46, 48));
    const [bx, by] = s2f(R.wa[0] + R.wa[2] / 2, R.wa[1] + R.wa[3] / 2);
    const [bz2, bfx, bfy] = springKeys(46, CAM, SPRING.gentle);
    // button centre under the camera
    const fpx2 = PH.x + bfx * PH.w, fpy2 = PH.y + bfy * PH.h;
    const zk2 = clamp((bz2 - 1) / 0.5);
    const ax2 = lerp(fpx2, cx, zk2), ay2 = lerp(fpy2, cy, zk2);
    const X = ax2 + (bx - fpx2) * bz2, Y = ay2 + (by - fpy2) * bz2;
    ctx.fillStyle = C.wa;
    ctx.beginPath(); ctx.arc(X, Y, 30 + g * Math.hypot(W, H) * 1.1, 0, M.TAU); ctx.fill();
  }
}

function drawStep(ctx, u, st) {
  const c = L.cap;
  const exitU = st.u0 + 7.4;
  const nk = springU(u, st.u0 + 0.5, SPRING.bouncy);
  const ex = E.inCubic(prog(u, exitU, exitU + 0.5));
  const nsize = FORMAT.pick({ '16x9': 200, '9x16': 150 });
  const tsize = FORMAT.pick({ '16x9': 84, '9x16': 82 });
  const bsize = FORMAT.pick({ '16x9': 42, '9x16': 44 });
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  // step label
  text(ctx, `STEP ${st.n} OF 4`, c.x, c.y, font(24, 500, UI), C.mute, 'left', 3);
  if (P) {
    // number and title on one line
    const f = font(tsize, 400, DISPLAY);
    ctx.save(); ctx.translate(c.x, c.y + tsize + 30); ctx.scale(nk, nk);
    text(ctx, st.n, 0, 0, font(tsize * 1.25, 400, DISPLAY), C.gold);
    ctx.restore();
    riseLines(ctx, [st.title], c.x + tsize * 0.95, c.y + tsize + 30, tsize * 1.1, f, C.green, u, st.u0 + 0.7);
    const bl = wrap(ctx, st.body, font(bsize, 400, UI), c.w);
    riseLines(ctx, bl, c.x, c.y + tsize + 110, bsize * 1.4, font(bsize, 400, UI), C.ink, u, st.u0 + 1.2, { stagger: 0.25 });
  } else {
    ctx.save(); ctx.translate(c.x, c.y + nsize * 0.95); ctx.scale(nk, nk);
    text(ctx, st.n, 0, 0, font(nsize, 400, DISPLAY), C.gold);
    ctx.restore();
    riseLines(ctx, [st.title], c.x, c.y + nsize + 110, tsize * 1.1, font(tsize, 400, DISPLAY), C.green, u, st.u0 + 0.7);
    const bl = wrap(ctx, st.body, font(bsize, 400, UI), c.w);
    riseLines(ctx, bl, c.x, c.y + nsize + 200, bsize * 1.45, font(bsize, 400, UI), C.ink, u, st.u0 + 1.2, { stagger: 0.25 });
  }
  ctx.restore();
}

function drawStepDots(ctx, u) {
  const c = L.cap;
  const y = c.y - 64;
  for (let i = 0; i < 4; i++) {
    const on = u >= STEPS[i].u0 + 0.3;
    const k = on ? springU(u, STEPS[i].u0 + 0.3, SPRING.bouncy) : 0;
    const x = c.x + i * 46;
    ctx.fillStyle = 'rgba(26,71,42,0.18)';
    ctx.beginPath(); ctx.arc(x + 9, y, 9, 0, M.TAU); ctx.fill();
    if (k > 0) { ctx.fillStyle = C.green; ctx.beginPath(); ctx.arc(x + 9, y, 9 * k, 0, M.TAU); ctx.fill(); }
  }
}

function drawTypeChips(ctx, u) {
  const c = L.cap;
  const names = ['Guest', 'Delivery', 'Cab', 'Artisan'];
  const f = font(FORMAT.pick({ '16x9': 32, '9x16': 34 }), 500, UI);
  const y = P ? c.y + 400 : c.y + 680;
  let x = c.x;
  const ex = E.inCubic(prog(u, 39.3, 39.8));
  names.forEach((n, i) => {
    const k = springU(u, 35.5 + i * 0.5, SPRING.bouncy);
    ctx.font = f; const w = ctx.measureText(n).width + 44;
    if (k > 0) {
      ctx.save(); ctx.globalAlpha = 1 - ex;
      ctx.translate(x + w / 2, y); ctx.scale(k, k);
      rrect(ctx, -w / 2, -32, w, 64, 32); ctx.fillStyle = i === 1 ? C.green : '#e7e4da'; ctx.fill();
      text(ctx, n, 0, 11, f, i === 1 ? C.cream : C.green, 'center');
      ctx.restore();
    }
    x += w + 14;
  });
}

function drawCode(ctx, u) {
  const c = L.cap;
  const size = FORMAT.pick({ '16x9': 120, '9x16': 104 });
  const y = P ? c.y + 440 : c.y + 720;
  const f = font(size, 500, UI);
  const code = 'SB-1279';
  ctx.font = f;
  const ex = E.inCubic(prog(u, 47.3, 47.8));
  // three stamps: SB, -, 1279 each revealed by a mask and a small drop
  [[0, 2, 41], [2, 3, 41.5], [3, 7, 42]].forEach(([a, b, u0]) => {
    const k = springU(u, u0, SPRING.bouncy);
    if (k <= 0) return;
    const x0 = c.x + ctx.measureText(code.slice(0, a)).width;
    const w = ctx.measureText(code.slice(a, b)).width;
    ctx.save(); ctx.globalAlpha = 1 - ex;
    ctx.beginPath(); ctx.rect(x0 - 2, y - size, w + 4, size * 1.25); ctx.clip();
    text(ctx, code, c.x, y - (1 - k) * size * 0.8, f, C.ink);
    ctx.restore();
  });
}

// ------------------------------------------------------------ S8 gate (48..56) + S9 tip (56..60)
function sceneGate(ctx, u, IMG) {
  fill(ctx, C.wa);
  const r = E.outCubic(prog(u, 47.75, 49.2)) * Math.hypot(W, H) * 0.6;
  ctx.save(); ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, M.TAU); ctx.clip();
  const z = 1.45 - 0.12 * prog(u, 48, 57);
  cover(ctx, IMG.gate, 0, 0, W, H, { fx: P ? 0.28 : 0.22, fy: 0.62, zoom: z });
  scrim(ctx, H * 0.45, H, 0.8);
  ctx.restore();
  const s = FORMAT.safe;
  const size = FORMAT.pick({ '16x9': 72, '9x16': 78 });
  const f = font(size, 400, DISPLAY);
  const lines = wrap(ctx, 'The guard checks the code. No calls to confirm.', f, P ? s.w : 1100);
  const y = P ? H - 440 - (lines.length - 1) * size * 1.1 : H - 120 - (lines.length - 1) * size * 1.1;
  riseLines(ctx, lines, s.x, y, size * 1.1, f, C.cream, u, 49, { stagger: 0.4 });
  // cleared chip, from the site's own gate pass card
  const k = springU(u, 52, SPRING.bouncy);
  if (k > 0) {
    const cw = 470, ch = 128;
    const cx = P ? W - 72 - cw : W - 96 - cw, cy = P ? 300 : 110;
    ctx.save(); ctx.translate(cx + cw, cy); ctx.scale(k, k); ctx.translate(-cw, 0);
    ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12;
    rrect(ctx, 0, 0, cw, ch, 24); ctx.fillStyle = C.white; ctx.fill(); ctx.shadowColor = 'transparent';
    text(ctx, 'VISITOR PASS · GATE 1', 32, 44, font(22, 500, UI), C.mute, 'left', 2);
    text(ctx, 'SB-1279', 32, 98, font(44, 500, UI), C.ink, 'left', 2);
    rrect(ctx, cw - 170, 62, 140, 46, 23); ctx.fillStyle = '#e3f1e6'; ctx.fill();
    text(ctx, '✓ Cleared', cw - 100, 94, font(24, 500, UI), C.green, 'center');
    ctx.restore();
  }
}
function sceneTip(ctx, u, IMG) {
  const k = E.inOutCubic(prog(u, 55.6, 56.4));
  if (k < 1) sceneGate(ctx, u, IMG);
  const top = H * (1 - k);
  ctx.fillStyle = C.cream; ctx.fillRect(0, top, W, H);
  ctx.save(); ctx.translate(0, top);
  const s = FORMAT.safe;
  const size = FORMAT.pick({ '16x9': 110, '9x16': 96 });
  const f = font(size, 400, DISPLAY);
  const lines = wrap(ctx, 'The guard still has the final say.', f, P ? s.w : 1750);
  const bf = font(FORMAT.pick({ '16x9': 40, '9x16': 42 }), 400, UI);
  const bl = wrap(ctx, "If anything looks wrong at the gate, they'll check with you.", bf, P ? s.w : 1200);
  const y = P ? H * 0.40 : H * 0.42 + (lines.length - 1) * 0;
  text(ctx, 'GOOD TO KNOW', s.x, y - size - 30, font(24, 500, UI), C.gold, 'left', 3);
  riseLines(ctx, lines, s.x, y, size * 1.1, f, C.green, u, 56.3);
  riseLines(ctx, bl, s.x, y + lines.length * size * 1.1 + 50, 60, bf, C.ink, u, 57, { stagger: 0.25 });
  ctx.restore();
}

// ------------------------------------------------------------ S10 end  (60..64)
function sceneEnd(ctx, u, IMG) {
  const k = E.inOutCubic(prog(u, 59.5, 60.2));
  if (k < 1) sceneTip(ctx, u, IMG);
  const top = H * (1 - k);
  ctx.fillStyle = C.green; ctx.fillRect(0, top, W, H);
  ctx.save(); ctx.translate(0, top);
  const lk = springU(u, 60.3, SPRING.bouncy);
  const ls = FORMAT.pick({ '16x9': 190, '9x16': 230 });
  const wsize = FORMAT.pick({ '16x9': 150, '9x16': 150 });
  const wf = font(wsize, 400, DISPLAY);
  ctx.font = wf; const ww = ctx.measureText('BreeUp').width;
  let lx, ly, wx, wy;
  if (P) { lx = W / 2; ly = H * 0.36; wx = W / 2 - ww / 2; wy = ly + ls / 2 + wsize + 20; }
  else { const tot = ls + 40 + ww; lx = (W - tot) / 2 + ls / 2; ly = H * 0.42; wx = lx + ls / 2 + 40; wy = ly + wsize * 0.33; }
  drawLogo(ctx, IMG, lx, ly, ls, lk);
  const wk = springU(u, 60.6, SPRING.gentle);
  ctx.save(); ctx.beginPath(); ctx.rect(0, wy - wsize, W, wsize * 1.3); ctx.clip();
  text(ctx, 'BreeUp', wx, wy + (1 - wk) * wsize, wf, C.cream);
  ctx.restore();
  const tf = font(FORMAT.pick({ '16x9': 38, '9x16': 40 }), 400, UI);
  const s = FORMAT.safe;
  const tl = wrap(ctx, 'Visitor passes, dues reminders, notices and records, all in one place.', tf, P ? s.w : 1400);
  const ty = P ? wy + 110 : H * 0.62;
  riseLines(ctx, tl, W / 2, ty, 56, tf, 'rgba(246,244,238,0.85)', u, 61.2, { align: 'center', stagger: 0.2 });
  riseLines(ctx, ['breeup.com'], W / 2, ty + tl.length * 56 + 70, 70, font(52, 500, UI), C.gold, u, 61.8, { align: 'center' });
  ctx.restore();
}

M.film({
  fonts: [font(100, 400, DISPLAY), font(40, 400, UI), font(40, 500, UI)],
  images: {
    gate: 'assets/photos/gatehouse.jpg', family: 'assets/photos/residents.jpg', logo: 'assets/logo.svg',
    login: 'assets/screens/res-login-pin.jpg', home: 'assets/screens/res-home.jpg', pass: 'assets/screens/res-visitor-pass.jpg',
  },
  hits: HITS,
  draw(ctx, u, t, IMG) {
    if (u < 6.3) sceneHook(ctx, u, IMG);
    else if (u < 12.2) sceneQuestion(ctx, u, IMG);
    else if (u < 16) sceneIntro(ctx, u, IMG);
    else if (u < 47.75) scenePhone(ctx, u, IMG);
    else if (u < 56.4) sceneGate(ctx, u, IMG);
    else if (u < 60.2) sceneTip(ctx, u, IMG);
    else sceneEnd(ctx, u, IMG);
  },
});
