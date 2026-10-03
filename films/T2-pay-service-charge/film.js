// T2 How to pay your service charge online. Pure function of time; follows docs/shotlist.md.
// Beats (u) on a fixed 96 bpm grid: 0.625 s a beat, 96 beats (60 s). Paced by the voice-over in film.json.
import * as M from './lib/motion.js';

const { W, H, FORMAT, E, prog, lerp, clamp, springU, springKeys, SPRING, wobble, font, layout, text, fill, cover, rrect } = M;

const C = { green: '#1a472a', deep: '#123220', cream: '#f6f4ee', gold: '#c9a84c', ink: '#1c1f1b', mute: '#5d645c', white: '#ffffff' };
const DISPLAY = 'Display', UI = 'UI';
const P = FORMAT.portrait;

const HITS = [
  [0, 'hook photo', 'sub', { len: 0.8 }],
  [0.4, 'title word', 'tick'], [0.9, 'title word', 'tick'], [1.4, 'title word', 'tick'], [1.9, 'title word', 'tick'],
  [6, 'green wipe', 'whoosh', { len: 0.5 }],
  [12, 'intro card', 'bell', { pitch: 'F5' }],
  [16, 'phone lands', 'thud'],
  [16.5, 'step 1', 'pop', { pitch: 'A5' }],
  [19, 'ring phone field', 'blip', { pitch: 'C6' }],
  [21.5, 'ring pin', 'blip', { pitch: 'D6' }],
  [25.5, 'tap sign in', 'click'],
  [27.5, 'screen change', 'whoosh', { len: 0.35, from: 2400, to: 700 }],
  [29, 'step 2', 'pop', { pitch: 'A5' }],
  [30, 'ring bills tab', 'blip', { pitch: 'C6' }],
  [31.5, 'bill card', 'pop', { pitch: 'E5' }],
  [32, 'tap bills', 'click'],
  [33.5, 'ring amount', 'blip', { pitch: 'C6' }],
  [36.5, 'tap pay', 'click'],
  [37.8, 'screen change', 'whoosh', { len: 0.35, from: 2400, to: 700 }],
  [38.5, 'step 3', 'pop', { pitch: 'A5' }],
  [43, 'ring account', 'blip', { pitch: 'C6' }],
  [44.5, 'copy account', 'click'],
  [51.5, 'ring reference', 'blip', { pitch: 'D6' }],
  [52, 'GE', 'tok', { pitch: 'F5' }], [52.5, 'D3', 'tok', { pitch: 'A5' }],
  [56, 'copy reference', 'click'],
  [61, 'screen change', 'whoosh', { len: 0.35, from: 2400, to: 700 }],
  [61.5, 'step 4', 'pop', { pitch: 'A5' }],
  [63.5, 'ring 3 months', 'blip', { pitch: 'C6' }],
  [65.5, 'ring 1 year', 'blip', { pitch: 'D6' }],
  [67, 'save chip', 'bell', { pitch: 'C6' }],
  [71, 'tap pay', 'click'],
  [71.5, 'pay grows', 'whoosh', { len: 0.6, from: 500, to: 3000 }],
  [73, 'tip photo', 'sub', { len: 0.6 }],
  [88, 'end card', 'impact'],
  [88.5, 'logo', 'bell', { pitch: 'F6' }],
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
// lines rise out of a mask, staggered
function riseLines(ctx, lines, x, y, lh, f, color, u, u0, { stagger = 0.35, align = 'left' } = {}) {
  lines.forEach((ln, i) => {
    const k = springU(u, u0 + i * stagger, SPRING.gentle);
    if (k <= 0) return;
    const by = y + i * lh;
    ctx.save(); ctx.beginPath(); ctx.rect(0, by - lh * 0.95, W, lh * 1.25); ctx.clip();
    text(ctx, ln, x, by + (1 - k) * lh * 0.9, f, color, align);
    ctx.restore();
  });
}
function scrim(ctx, y0, y1, a) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, 'rgba(10,22,14,0)'); g.addColorStop(1, `rgba(10,22,14,${a})`);
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, y1 - y0);
}
function drawLogo(ctx, IMG, cx, cy, size, k = 1) {
  if (!IMG.logo || k <= 0) return;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
  ctx.drawImage(IMG.logo, -size / 2, -size / 2, size, size);
  ctx.restore();
}
function pill(ctx, str, x, y, size, bg, fg, k = 1) {
  const f = font(size, 500, UI);
  ctx.font = f; const w = ctx.measureText(str).width + 56, h = size * 1.9;
  ctx.save(); ctx.translate(x + w / 2, y); ctx.scale(k, k);
  rrect(ctx, -w / 2, -h / 2, w, h, h / 2); ctx.fillStyle = bg; ctx.fill();
  text(ctx, str, 0, size * 0.35, f, fg, 'center');
  ctx.restore();
}

// ------------------------------------------------------------ layout per format
// 9:16 type follows the rules: body >= 56 px, headings >= 96 px.
const L = FORMAT.pick({
  '16x9': { stage: [0, 0, 1080, 1080], phoneH: 940, cap: { x: 1170, y: 260, w: 650 }, num: 200, title: 84, body: 42, extraY: 860 },
  '9x16': { stage: [0, 880, 1080, 1040], phoneH: 1000, cap: { x: 72, y: 250, w: 936 }, num: 96, title: 96, body: 56, extraY: 730 },
});
const SRC = { w: 780, h: 1688 };
const phoneW = L.phoneH * SRC.w / SRC.h;
const [sx0, sy0, sw0, sh0] = L.stage;
const PH = { x: sx0 + (sw0 - phoneW) / 2, y: P ? sy0 + 46 : sy0 + (sh0 - L.phoneH) / 2, w: phoneW, h: L.phoneH };

// regions on the real phone screenshots (source px, 780x1688)
const R = {
  phone: [40, 704, 700, 84], pin: [40, 872, 508, 112], signin: [40, 1086, 700, 88],
  billsTab: [236, 1578, 118, 96],
  acctCopy: [358, 548, 142, 60], ref: [106, 1110, 196, 86], refCopy: [322, 1122, 140, 60],
  m3: [74, 826, 308, 180], y1: [398, 826, 308, 180], pay: [74, 1090, 236, 72],
};

// camera: [zoom, fx, fy] in screenshot fractions
const CAM = [
  [16, [1, 0.5, 0.5]], [18.5, [1.45, 0.5, 0.52]], [23, [1.35, 0.5, 0.6]], [27.5, [1, 0.5, 0.5]],
  [29.5, [1.7, 0.36, 0.93]], [33, [1, 0.5, 0.5]],
  [39.5, [1.5, 0.5, 0.4]], [48.5, [1.6, 0.5, 0.67]], [59.5, [1, 0.5, 0.5]],
  [62.5, [1.45, 0.5, 0.56]], [69, [1.6, 0.4, 0.66]],
];
const camAt = (u) => springKeys(u, CAM, SPRING.gentle);
// screenshot px -> frame px under the camera at beat u
function toFrame(u, x, y) {
  const [z, fx, fy] = camAt(u);
  const fpx = PH.x + fx * PH.w, fpy = PH.y + fy * PH.h;
  const zk = clamp((z - 1) / 0.5);
  const ax = lerp(fpx, sx0 + sw0 / 2, zk), ay = lerp(fpy, sy0 + sh0 / 2, zk);
  const X = PH.x + x * PH.w / SRC.w, Y = PH.y + y * PH.h / SRC.h;
  return [ax + (X - fpx) * z, ay + (Y - fpy) * z];
}

const RINGS = [
  { r: 'phone', a: 19, b: 21.5 }, { r: 'pin', a: 21.5, b: 24 }, { r: 'signin', a: 24, b: 26.5, tap: 25.5 },
  { r: 'billsTab', a: 30, b: 33, tap: 32 },
  { r: 'acctCopy', a: 43, b: 47, tap: 44.5 }, { r: 'ref', a: 51.5, b: 55 }, { r: 'refCopy', a: 55, b: 59, tap: 56 },
  { r: 'm3', a: 63.5, b: 65.5 }, { r: 'y1', a: 65.5, b: 69.5 }, { r: 'pay', a: 69.5, b: 72, tap: 71 },
];

// ------------------------------------------------------------ S1 hook (u 0..6) + S2 why (6..12)
function sceneHook(ctx, u, IMG) {
  fill(ctx, C.deep);
  const z = 1.12 - 0.06 * prog(u, 0, 7);
  cover(ctx, IMG.hook, 0, 0, W, H, { fx: 0.5, fy: P ? 0.4 : 0.45, zoom: z });
  scrim(ctx, H * 0.35, H, 0.85);
  const s = FORMAT.safe;
  const size = FORMAT.pick({ '16x9': 124, '9x16': 118 });
  const f = font(size, 400, DISPLAY);
  const lines = P ? ['Pay your service', 'charge from', 'your phone.'] : ['Pay your service charge', 'from your phone.'];
  const y0 = P ? H - 440 - (lines.length - 1) * size * 1.02 : H - 150 - size * 1.02;
  let wi = 0;
  lines.forEach((ln, li) => {
    let x = s.x;
    ln.split(' ').forEach((w) => {
      const k = springU(u, 0.3 + wi * 0.4 - (wi === 0 ? 0.3 : 0), SPRING.snappy);
      const Lw = layout(ctx, w, f, -0.01 * size);
      if (k > 0) {
        const by = y0 + li * size * 1.02;
        ctx.save(); ctx.beginPath(); ctx.rect(0, by - size, W, size * 1.3); ctx.clip();
        text(ctx, w, x, by + (1 - k) * size, f, /phone/.test(w) ? C.gold : C.cream, 'left', -0.01 * size);
        ctx.restore();
      }
      x += Lw.width + size * 0.26; wi++;
    });
  });
  const kk = E.outCubic(prog(u, 0, 1));
  text(ctx, 'BREEUP TUTORIAL · RESIDENTS', s.x, y0 - size * 1.05, font(30, 500, UI), `rgba(246,244,238,${0.85 * kk})`, 'left', 3);
}

function sceneWhy(ctx, u, IMG) {
  const wipe = E.inOutCubic(prog(u, 5.6, 6.6));
  const reveal = E.inOutCubic(prog(u, 6.3, 7.3));
  if (wipe < 1) sceneHook(ctx, u, IMG);
  ctx.fillStyle = C.green; ctx.fillRect(0, H * (1 - wipe), W, H);
  if (reveal > 0) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, H * (1 - reveal), W, H); ctx.clip();
    cover(ctx, IMG.why, 0, 0, W, H, { fx: P ? 0.5 : 0.45, fy: 0.4, zoom: 1.05 + 0.05 * prog(u, 6, 12) });
    scrim(ctx, H * 0.4, H, 0.8);
    ctx.restore();
  }
  const s = FORMAT.safe;
  const size = FORMAT.pick({ '16x9': 76, '9x16': 96 });
  const f = font(size, 400, DISPLAY);
  const lines = wrap(ctx, 'Your payment, recorded against your home, with a receipt.', f, P ? s.w : 1300);
  const y = H - (P ? 440 : 130) - (lines.length - 1) * size * 1.1;
  riseLines(ctx, lines, s.x, y, size * 1.1, f, C.cream, u, 7, { stagger: 0.4 });
}

// ------------------------------------------------------------ S3 intro (u 12..16)
function sceneIntro(ctx, u, IMG) {
  const inn = E.inOutCubic(prog(u, 11.4, 12.2));
  if (inn < 1) sceneWhy(ctx, u, IMG);
  const top = H * (1 - inn);
  ctx.fillStyle = C.cream; ctx.fillRect(0, top, W, H);
  ctx.save(); ctx.translate(0, top);
  const ls = FORMAT.pick({ '16x9': 150, '9x16': 190 });
  const cx = P ? W / 2 : W * 0.32, cy = P ? H * 0.38 : H / 2;
  drawLogo(ctx, IMG, cx, cy, ls, springU(u, 12, SPRING.bouncy));
  const size = FORMAT.pick({ '16x9': 92, '9x16': 100 });
  const f = font(size, 400, DISPLAY);
  if (P) riseLines(ctx, ["Here's how,", 'in four steps.'], W / 2, cy + ls * 0.9 + size, size * 1.1, f, C.green, u, 12.6, { align: 'center' });
  else riseLines(ctx, ["Here's how,", 'in four steps.'], cx + ls * 0.75, cy - 10, size * 1.1, f, C.green, u, 12.6);
  ctx.restore();
}

// ------------------------------------------------------------ S4-7 phone steps (u 16..73)
const STEPS = [
  { n: '1', u0: 16, title: 'Sign in', body: "Open your estate's link. Sign in with your phone number and 4-digit PIN." },
  { n: '2', u0: 29, title: 'Open Bills', body: "Tap Bills to see what you owe and when it's due." },
  { n: '3', u0: 38.5, title: 'Transfer', body: 'Pay into the estate account from any bank app. Add your unit reference.' },
  { n: '4', u0: 61.5, title: 'Or pay ahead', body: "Pay a few months at once. You won't be billed for them again." },
];

function ringAt(ctx, u, { r, a, b, tap }) {
  if (u < a - 0.05 || u > b + 0.4) return;
  const [x, y, w, h] = R[r];
  const pad = 10;
  const [x0, y0] = toFrame(u, x - pad, y - pad), [x1, y1] = toFrame(u, x + w + pad, y + h + pad);
  const sc = (x1 - x0) / (w + 2 * pad);
  const draw = E.outCubic(prog(u, a, a + 0.8));
  const alpha = 1 - E.inCubic(prog(u, b, b + 0.35));
  const per = 2 * ((x1 - x0) + (y1 - y0));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = Math.max(5, 7 * sc); ctx.strokeStyle = C.gold; ctx.lineCap = 'round';
  ctx.setLineDash([per * draw, per]);
  rrect(ctx, x0, y0, x1 - x0, y1 - y0, 16 * sc); ctx.stroke();
  ctx.setLineDash([]);
  if (tap != null && u >= tap) {
    const tk = prog(u, tap, tap + 0.9);
    ctx.globalAlpha = alpha * (1 - tk) * 0.9; ctx.fillStyle = C.gold;
    ctx.beginPath(); ctx.arc((x0 + x1) / 2, (y0 + y1) / 2, (20 + 70 * E.outCubic(tk)) * sc, 0, M.TAU); ctx.fill();
  }
  ctx.restore();
}

function scenePhone(ctx, u, IMG) {
  fill(ctx, C.cream);
  ctx.fillStyle = C.green; ctx.fillRect(...L.stage);
  const k = springU(u, 15.6, SPRING.gentle);
  const q = 0.03 * wobble((u - 16.2) * 0.625, 2.2, 6);
  const [z, fx, fy] = camAt(u);
  const fpx = PH.x + fx * PH.w, fpy = PH.y + fy * PH.h;
  const zk = clamp((z - 1) / 0.5);
  const ax = lerp(fpx, sx0 + sw0 / 2, zk), ay = lerp(fpy, sy0 + sh0 / 2, zk);
  ctx.save();
  ctx.beginPath(); ctx.rect(...L.stage); ctx.clip();
  ctx.translate(0, (1 - k) * (sh0 + 200));
  ctx.save();
  ctx.translate(ax, ay); ctx.scale(z * (1 + q), z * (1 - q)); ctx.translate(-fpx, -fpy);
  const bz = 16;
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
  rrect(ctx, PH.x - bz, PH.y - bz, PH.w + 2 * bz, PH.h + 2 * bz, 64); ctx.fillStyle = '#0d0f0d'; ctx.fill();
  ctx.shadowColor = 'transparent';
  // screens: login -> home (27.5) -> bills (37.8) -> pay ahead (61), each slides up over the last
  ctx.save(); rrect(ctx, PH.x, PH.y, PH.w, PH.h, 50); ctx.clip();
  const seq = [[IMG.login, -1], [IMG.home, 27.5], [IMG.bills, 37.8], [IMG.ahead, 61]];
  seq.forEach(([img, at], i) => {
    const s = i === 0 ? 1 : E.inOutCubic(prog(u, at, at + 0.8));
    const next = seq[i + 1] ? E.inOutCubic(prog(u, seq[i + 1][1], seq[i + 1][1] + 0.8)) : 0;
    if (s <= 0 || next >= 1 || !img) return;
    ctx.drawImage(img, PH.x, PH.y + (1 - s) * PH.h - next * PH.h * 0.3, PH.w, PH.h);
  });
  ctx.restore();
  ctx.restore();
  RINGS.forEach((r) => ringAt(ctx, u, r));
  // the Pay button grows to fill the frame (71.5..73), carrying us into the tip
  if (u >= 71.5) {
    const g = E.inCubic(prog(u, 71.5, 73));
    const [X, Y] = toFrame(71.5, R.pay[0] + R.pay[2] / 2, R.pay[1] + R.pay[3] / 2);
    ctx.fillStyle = C.green;
    ctx.beginPath(); ctx.arc(X, Y, 30 + g * Math.hypot(W, H) * 1.2, 0, M.TAU); ctx.fill();
  }
  ctx.restore();

  const st = STEPS.findLast((s) => u >= s.u0 - 0.3) || STEPS[0];
  drawStep(ctx, u, st);
  drawStepDots(ctx, u);
  if (u >= 31 && u < 38.4) drawBillCard(ctx, u, IMG);
  if (u >= 51.5 && u < 61) drawReference(ctx, u);
  if (u >= 66.5 && u < 71.4) drawSave(ctx, u);
  if (u >= 71.5) { ctx.fillStyle = C.green; ctx.globalAlpha = E.inCubic(prog(u, 72, 73)); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}

function drawStep(ctx, u, st) {
  const c = L.cap;
  const next = STEPS[STEPS.indexOf(st) + 1];
  const exitU = next ? next.u0 - 0.6 : 71.2;
  const nk = springU(u, st.u0 + 0.5, SPRING.bouncy);
  const ex = E.inCubic(prog(u, exitU, exitU + 0.5));
  const bf = font(L.body, 400, UI);
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  text(ctx, `STEP ${st.n} OF 4`, c.x, c.y, font(P ? 30 : 24, 500, UI), C.mute, 'left', 3);
  const bl = wrap(ctx, st.body, bf, c.w);
  if (P) {
    const ty = c.y + L.title + 30;
    ctx.save(); ctx.translate(c.x, ty); ctx.scale(nk, nk);
    text(ctx, st.n, 0, 0, font(L.num * 1.25, 400, DISPLAY), C.gold);
    ctx.restore();
    riseLines(ctx, [st.title], c.x + L.title * 0.95, ty, L.title * 1.1, font(L.title, 400, DISPLAY), C.green, u, st.u0 + 0.7);
    riseLines(ctx, bl, c.x, ty + 100, L.body * 1.35, bf, C.ink, u, st.u0 + 1.2, { stagger: 0.25 });
  } else {
    ctx.save(); ctx.translate(c.x, c.y + L.num * 0.95); ctx.scale(nk, nk);
    text(ctx, st.n, 0, 0, font(L.num, 400, DISPLAY), C.gold);
    ctx.restore();
    riseLines(ctx, [st.title], c.x, c.y + L.num + 110, L.title * 1.1, font(L.title, 400, DISPLAY), C.green, u, st.u0 + 0.7);
    riseLines(ctx, bl, c.x, c.y + L.num + 200, L.body * 1.45, bf, C.ink, u, st.u0 + 1.2, { stagger: 0.25 });
  }
  ctx.restore();
}

function drawStepDots(ctx, u) {
  const c = L.cap, y = c.y - 64, r = P ? 11 : 9, gap = P ? 52 : 46;
  for (let i = 0; i < 4; i++) {
    const k = u >= STEPS[i].u0 + 0.3 ? springU(u, STEPS[i].u0 + 0.3, SPRING.bouncy) : 0;
    const x = c.x + i * gap + r;
    ctx.fillStyle = 'rgba(26,71,42,0.18)'; ctx.beginPath(); ctx.arc(x, y, r, 0, M.TAU); ctx.fill();
    if (k > 0) { ctx.fillStyle = C.green; ctx.beginPath(); ctx.arc(x, y, r * k, 0, M.TAU); ctx.fill(); }
  }
}

// The real desktop Bills row, cut from the screenshot: "Estate Levy · Overdue · Due 31 Mar 2026" + "₦45,000 Pay"
// (the middle of the row is empty, so the two ends are placed side by side).
const BILL_L = [392, 486, 600, 114], BILL_R = [1480, 486, 288, 114];
function drawBillCard(ctx, u, IMG) {
  if (!IMG.portal) return;
  const c = L.cap;
  const k = springU(u, 31.5, SPRING.snappy);
  const ex = E.inCubic(prog(u, 37.6, 38.2));
  const s = c.w / (BILL_L[2] + BILL_R[2]), h = BILL_L[3] * s;
  const x = c.x, y = L.extraY + (1 - k) * 60;
  ctx.save();
  ctx.globalAlpha = Math.min(1, k) * (1 - ex);
  ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
  rrect(ctx, x - 4, y - 4, c.w + 8, h + 8, 18); ctx.fillStyle = C.white; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.drawImage(IMG.portal, ...BILL_L, x, y, BILL_L[2] * s, h);
  ctx.drawImage(IMG.portal, ...BILL_R, x + BILL_L[2] * s, y, BILL_R[2] * s, h);
  // rings: the amount (src x 1500..1646), then Pay (1656..1742)
  const box = (sx0, sx1, a, b, tap) => {
    if (u < a || u > b + 0.4) return;
    const rx = x + (BILL_L[2] + sx0 - BILL_R[0]) * s - 8, rw = (sx1 - sx0) * s + 16;
    const ry = y + 22 * s, rh = h - 44 * s;
    const per = 2 * (rw + rh);
    ctx.save(); ctx.globalAlpha *= 1 - E.inCubic(prog(u, b, b + 0.35));
    ctx.lineWidth = 6; ctx.strokeStyle = C.gold; ctx.setLineDash([per * E.outCubic(prog(u, a, a + 0.8)), per]);
    rrect(ctx, rx, ry, rw, rh, 12); ctx.stroke(); ctx.setLineDash([]);
    if (tap && u >= tap) {
      const tk = prog(u, tap, tap + 0.9);
      ctx.globalAlpha *= (1 - tk) * 0.9; ctx.fillStyle = C.gold;
      ctx.beginPath(); ctx.arc(rx + rw / 2, ry + rh / 2, 14 + 50 * E.outCubic(tk), 0, M.TAU); ctx.fill();
    }
    ctx.restore();
  };
  box(1500, 1646, 33.5, 35.5);
  box(1656, 1742, 35.5, 37.6, 36.5);
  ctx.restore();
}

function drawReference(ctx, u) {
  const c = L.cap;
  const size = 110;
  const f = font(size, 500, UI);
  const y = L.extraY + size * 0.9;
  const ex = E.inCubic(prog(u, 60.2, 60.8));
  const code = 'GE-D3';
  ctx.font = f;
  [[0, 2, 52], [2, 5, 52.5]].forEach(([a, b, u0]) => {
    const k = springU(u, u0, SPRING.bouncy);
    if (k <= 0) return;
    const x0 = c.x + ctx.measureText(code.slice(0, a)).width, w = ctx.measureText(code.slice(a, b)).width;
    ctx.save(); ctx.globalAlpha = 1 - ex;
    ctx.beginPath(); ctx.rect(x0 - 2, y - size, w + 4, size * 1.25); ctx.clip();
    text(ctx, code, c.x, y - (1 - k) * size * 0.8, f, C.ink);
    ctx.restore();
  });
  const lk = E.outCubic(prog(u, 53, 53.8));
  if (lk > 0) text(ctx, 'YOUR UNIT REFERENCE', c.x + (P ? 0 : 0), y - size - 18, font(P ? 30 : 24, 500, UI), `rgba(201,168,76,${lk * (1 - ex)})`, 'left', 3);
}

function drawSave(ctx, u) {
  const k = springU(u, 67, SPRING.bouncy);
  const ex = E.inCubic(prog(u, 70.8, 71.3));
  ctx.save(); ctx.globalAlpha = 1 - ex;
  pill(ctx, '1 year: you save ₦25,000', L.cap.x, L.extraY + 40, P ? 50 : 38, C.green, C.cream, k);
  ctx.restore();
}

// ------------------------------------------------------------ S8 tip (73..88)
function sceneTip(ctx, u, IMG) {
  fill(ctx, C.green);
  const r = E.outCubic(prog(u, 72.9, 74.4)) * Math.hypot(W, H) * 0.6;
  ctx.save(); ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, M.TAU); ctx.clip();
  cover(ctx, IMG.tip, 0, 0, W, H, { fx: 0.5, fy: 0.45, zoom: 1.12 - 0.08 * prog(u, 73, 88) });
  scrim(ctx, H * 0.3, H, 0.88);
  ctx.restore();
  const s = FORMAT.safe;
  const size = FORMAT.pick({ '16x9': 84, '9x16': 100 });
  const f = font(size, 400, DISPLAY);
  const bf = font(FORMAT.pick({ '16x9': 42, '9x16': 56 }), 400, UI);
  const lines = wrap(ctx, 'Estates rarely change their bank account.', f, P ? s.w : 1300);
  const bl = wrap(ctx, "If you're asked to pay into a new one, call a committee member first.", bf, P ? s.w : 1300);
  const bh = FORMAT.pick({ '16x9': 60, '9x16': 76 });
  const y = H - (P ? 440 : 120) - bl.length * bh - (lines.length - 1) * size * 1.1 - 30;
  const kk = E.outCubic(prog(u, 74.5, 75.3));
  text(ctx, 'GOOD TO KNOW', s.x, y - size - 24, font(P ? 32 : 26, 500, UI), `rgba(201,168,76,${kk})`, 'left', 3);
  riseLines(ctx, lines, s.x, y, size * 1.1, f, C.cream, u, 74.8, { stagger: 0.4 });
  riseLines(ctx, bl, s.x, y + (lines.length - 1) * size * 1.1 + bh + 30, bh, bf, 'rgba(246,244,238,0.9)', u, 76.5, { stagger: 0.25 });
}

// ------------------------------------------------------------ S9 end (88..96)
function sceneEnd(ctx, u, IMG) {
  const k = E.inOutCubic(prog(u, 87.5, 88.2));
  if (k < 1) sceneTip(ctx, u, IMG);
  const top = H * (1 - k);
  ctx.fillStyle = C.green; ctx.fillRect(0, top, W, H);
  ctx.save(); ctx.translate(0, top);
  const ls = FORMAT.pick({ '16x9': 190, '9x16': 230 });
  const wsize = 150, wf = font(wsize, 400, DISPLAY);
  ctx.font = wf; const ww = ctx.measureText('BreeUp').width;
  let lx, ly, wx, wy;
  if (P) { lx = W / 2; ly = H * 0.36; wx = W / 2 - ww / 2; wy = ly + ls / 2 + wsize + 20; }
  else { const tot = ls + 40 + ww; lx = (W - tot) / 2 + ls / 2; ly = H * 0.42; wx = lx + ls / 2 + 40; wy = ly + wsize * 0.33; }
  drawLogo(ctx, IMG, lx, ly, ls, springU(u, 88.3, SPRING.bouncy));
  const wk = springU(u, 88.6, SPRING.gentle);
  ctx.save(); ctx.beginPath(); ctx.rect(0, wy - wsize, W, wsize * 1.3); ctx.clip();
  text(ctx, 'BreeUp', wx, wy + (1 - wk) * wsize, wf, C.cream);
  ctx.restore();
  const tf = font(FORMAT.pick({ '16x9': 38, '9x16': 50 }), 400, UI);
  const s = FORMAT.safe;
  const tl = wrap(ctx, 'Dues, gate access, approvals and notices in one place.', tf, P ? s.w : 1400);
  const lh = FORMAT.pick({ '16x9': 56, '9x16': 68 });
  const ty = P ? wy + 120 : H * 0.62;
  riseLines(ctx, tl, W / 2, ty, lh, tf, 'rgba(246,244,238,0.85)', u, 89.2, { align: 'center', stagger: 0.2 });
  riseLines(ctx, ['breeup.com'], W / 2, ty + tl.length * lh + 70, 70, font(P ? 60 : 52, 500, UI), C.gold, u, 89.8, { align: 'center' });
  ctx.restore();
}

M.film({
  fonts: [font(100, 400, DISPLAY), font(40, 400, UI), font(40, 500, UI)],
  images: {
    hook: `assets/photos/hook-${P ? '9x16' : '16x9'}.jpg`, why: `assets/photos/why-${P ? '9x16' : '16x9'}.jpg`,
    tip: `assets/photos/tip-${P ? '9x16' : '16x9'}.jpg`, logo: 'assets/logo.svg',
    login: 'assets/screens/res-login-pin.jpg', home: 'assets/screens/res-home.jpg', bills: 'assets/screens/res-bills.jpg',
    ahead: 'assets/screens/res-pay-ahead.jpg', portal: 'assets/screens/portal-bills.jpg',
  },
  hits: HITS,
  draw(ctx, u, t, IMG) {
    if (u < 6.3) sceneHook(ctx, u, IMG);
    else if (u < 12.2) sceneWhy(ctx, u, IMG);
    else if (u < 16) sceneIntro(ctx, u, IMG);
    else if (u < 73) scenePhone(ctx, u, IMG);
    else if (u < 88.2) sceneTip(ctx, u, IMG);
    else sceneEnd(ctx, u, IMG);
  },
});
