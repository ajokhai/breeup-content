// S1 Service charge, sorted: a 19 s Reel/TikTok (9:16 only). Pure function of time.
// Hook on a Veo clip, the real Bills screens big and central, word-by-word captions from film.json "vo".
import * as M from './lib/motion.js';

const { W, H, E, prog, lerp, clamp, springU, springKeys, SPRING, font, text, fill, cover, rrect } = M;

const C = { green: '#1a472a', deep: '#123220', cream: '#f6f4ee', gold: '#c9a84c', ink: '#1c1f1b', white: '#ffffff' };
const DISPLAY = 'Display', UI = 'UI';

const HITS = [
  [0, 'hook', 'sub', { len: 0.6 }],
  [6.5, 'whip to phone', 'whoosh', { len: 0.35, from: 600, to: 3200 }],
  [8.4, 'ring bills tab', 'blip', { pitch: 'C6' }],
  [9, 'tap bills', 'click'],
  [9.6, 'screen change', 'whoosh', { len: 0.3, from: 2400, to: 700 }],
  [11, 'ring account', 'blip', { pitch: 'C6' }],
  [12, 'copy', 'click'],
  [13.3, 'ring reference', 'blip', { pitch: 'D6' }],
  [14.2, 'copy', 'click'],
  [15.8, 'bank chip', 'pop', { pitch: 'A5' }],
  [19, 'whip to photo', 'whoosh', { len: 0.35, from: 3200, to: 600 }],
  [21.5, 'receipt chip', 'bell', { pitch: 'C6' }],
  [24, 'end card', 'impact'],
  [24.4, 'logo', 'bell', { pitch: 'F6' }],
];

// ------------------------------------------------------------ captions (TikTok-style word highlight)
// Word times are spread across each voice-over line by length; groups of up to 3 words show at a time.
let CAPS = null;
function captions() {
  if (CAPS) return CAPS;
  CAPS = [];
  for (const [t0, , line, dur] of M.CFG.vo || []) {
    const words = line.split(' ');
    const weight = words.map((w) => w.length + 2), total = weight.reduce((a, b) => a + b, 0);
    let t = t0;
    const timed = words.map((w, i) => { const a = t; t += dur * weight[i] / total; return { w, a, b: t }; });
    for (let i = 0; i < timed.length;) {
      const g = [timed[i++]];
      while (i < timed.length && g.length < 3 && g.map((x) => x.w).join(' ').length + timed[i].w.length < 20) g.push(timed[i++]);
      CAPS.push({ words: g, a: g[0].a, b: g.at(-1).b });
    }
  }
  return CAPS;
}
function drawCaptions(ctx, t, y = 1330) {
  const caps = captions();
  const g = caps.find((c, i) => t >= c.a - 0.05 && t < (caps[i + 1] && caps[i + 1].a - c.b < 0.4 ? caps[i + 1].a - 0.05 : c.b + 0.25));
  if (!g) return;
  const size = 72, f = font(size, 500, UI), gap = size * 0.3;
  ctx.font = f;
  const ws = g.words.map((x) => ctx.measureText(x.w).width);
  const total = ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1);
  let x = (W - total) / 2;
  const pop = E.outBack(prog(t, g.a - 0.05, g.a + 0.1), 2);
  ctx.save(); ctx.translate(W / 2, y); ctx.scale(0.85 + 0.15 * pop, 0.85 + 0.15 * pop); ctx.translate(-W / 2, -y);
  rrect(ctx, x - 28, y - size * 0.98, total + 56, size * 1.42, 26); ctx.fillStyle = 'rgba(10,22,14,0.62)'; ctx.fill();
  g.words.forEach((x0, i) => {
    const on = t >= x0.a && t < x0.b + (i === g.words.length - 1 ? 0.25 : 0);
    if (on) { rrect(ctx, x - 14, y - size * 0.82, ws[i] + 28, size * 1.12, 16); ctx.fillStyle = C.gold; ctx.fill(); }
    ctx.lineWidth = 10; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(10,20,12,0.85)';
    ctx.font = f; ctx.textAlign = 'left';
    if (!on) ctx.strokeText(x0.w, x, y);
    text(ctx, x0.w, x, y, f, on ? C.ink : C.white);
    x += ws[i] + gap;
  });
  ctx.restore();
}

function scrim(ctx, y0, y1, a) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, 'rgba(10,22,14,0)'); g.addColorStop(1, `rgba(10,22,14,${a})`);
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, y1 - y0);
}
function pill(ctx, str, cx, y, size, bg, fg, k) {
  if (k <= 0) return;
  const f = font(size, 500, UI); ctx.font = f;
  const w = ctx.measureText(str).width + 64, h = size * 2;
  ctx.save(); ctx.translate(cx, y); ctx.scale(k, k);
  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
  rrect(ctx, -w / 2, -h / 2, w, h, h / 2); ctx.fillStyle = bg; ctx.fill(); ctx.shadowColor = 'transparent';
  text(ctx, str, 0, size * 0.36, f, fg, 'center');
  ctx.restore();
}

// ------------------------------------------------------------ hook (u 0..6.5): Veo clip
function sceneHook(ctx, u, IMG) {
  fill(ctx, C.deep);
  if (IMG.clip) cover(ctx, IMG.clip, 0, 0, W, H, { fx: 0.5, fy: 0.45 });
  scrim(ctx, H * 0.45, H, 0.7);
}

// ------------------------------------------------------------ phone (u 6.5..19)
const SRC = { w: 780, h: 1688 };
const PH = { h: 1400 }; PH.w = PH.h * SRC.w / SRC.h; PH.x = (W - PH.w) / 2; PH.y = 230;
const R = { billsTab: [236, 1578, 118, 96], acctCopy: [358, 548, 142, 60], refCopy: [322, 1122, 140, 60], acct: [34, 500, 712, 420] };
const CAM = [[6.5, [1, 0.5, 0.5]], [8, [1.5, 0.36, 0.88]], [9.8, [1, 0.5, 0.5]], [10.6, [1.55, 0.45, 0.33]], [13, [1.55, 0.42, 0.68]], [15.6, [1.05, 0.5, 0.45]]];
const camAt = (u) => springKeys(u, CAM, SPRING.snappy);
function toFrame(u, x, y) {
  const [z, fx, fy] = camAt(u);
  const fpx = PH.x + fx * PH.w, fpy = PH.y + fy * PH.h, zk = clamp((z - 1) / 0.5);
  const ax = lerp(fpx, W / 2, zk), ay = lerp(fpy, H * 0.45, zk);
  return [ax + (PH.x + x * PH.w / SRC.w - fpx) * z, ay + (PH.y + y * PH.h / SRC.h - fpy) * z];
}
const RINGS = [{ r: 'billsTab', a: 8.4, b: 9.7, tap: 9 }, { r: 'acctCopy', a: 11, b: 13, tap: 12 }, { r: 'refCopy', a: 13.3, b: 15.4, tap: 14.2 }, { r: 'acct', a: 16, b: 18.8 }];
function ring(ctx, u, { r, a, b, tap }) {
  if (u < a || u > b + 0.4) return;
  const [x, y, w, h] = R[r], pad = 10;
  const [x0, y0] = toFrame(u, x - pad, y - pad), [x1, y1] = toFrame(u, x + w + pad, y + h + pad);
  const per = 2 * ((x1 - x0) + (y1 - y0));
  ctx.save(); ctx.globalAlpha = 1 - E.inCubic(prog(u, b, b + 0.35));
  ctx.lineWidth = 9; ctx.strokeStyle = C.gold; ctx.lineCap = 'round';
  ctx.setLineDash([per * E.outCubic(prog(u, a, a + 0.6)), per]);
  rrect(ctx, x0, y0, x1 - x0, y1 - y0, 20); ctx.stroke(); ctx.setLineDash([]);
  if (tap && u >= tap) {
    const tk = prog(u, tap, tap + 0.8);
    ctx.globalAlpha *= (1 - tk) * 0.9; ctx.fillStyle = C.gold;
    ctx.beginPath(); ctx.arc((x0 + x1) / 2, (y0 + y1) / 2, 24 + 90 * E.outCubic(tk), 0, M.TAU); ctx.fill();
  }
  ctx.restore();
}
function scenePhone(ctx, u, IMG) {
  fill(ctx, C.green);
  // whip in: the phone slides up fast with a little overshoot
  const k = springU(u, 6.3, SPRING.snappy);
  const [z, fx, fy] = camAt(u);
  const fpx = PH.x + fx * PH.w, fpy = PH.y + fy * PH.h, zk = clamp((z - 1) / 0.5);
  const ax = lerp(fpx, W / 2, zk), ay = lerp(fpy, H * 0.45, zk);
  ctx.save();
  ctx.translate(0, (1 - k) * H);
  ctx.save();
  ctx.translate(ax, ay); ctx.scale(z, z); ctx.translate(-fpx, -fpy);
  ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 80; ctx.shadowOffsetY = 30;
  rrect(ctx, PH.x - 18, PH.y - 18, PH.w + 36, PH.h + 36, 70); ctx.fillStyle = '#0d0f0d'; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save(); rrect(ctx, PH.x, PH.y, PH.w, PH.h, 54); ctx.clip();
  const s = E.inOutCubic(prog(u, 9.6, 10.3));
  if (s < 1) ctx.drawImage(IMG.home, PH.x, PH.y - s * PH.h * 0.3, PH.w, PH.h);
  if (s > 0) ctx.drawImage(IMG.bills, PH.x, PH.y + (1 - s) * PH.h, PH.w, PH.h);
  ctx.restore();
  ctx.restore();
  RINGS.forEach((r) => ring(ctx, u, r));
  ctx.restore();
  pill(ctx, 'Any Nigerian bank app', W / 2, 300, 50, C.cream, C.green, springU(u, 15.8, SPRING.bouncy) * (1 - E.inCubic(prog(u, 18.6, 19))));
  // whip out
  const out = E.inCubic(prog(u, 18.6, 19));
  if (out > 0) { ctx.fillStyle = C.deep; ctx.globalAlpha = out; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}

// ------------------------------------------------------------ receipt (u 19..24)
function sceneWhy(ctx, u, IMG) {
  fill(ctx, C.deep);
  cover(ctx, IMG.why, 0, 0, W, H, { fx: 0.5, fy: 0.4, zoom: 1.18 - 0.1 * E.outCubic(prog(u, 19, 24)) });
  scrim(ctx, H * 0.4, H, 0.7);
  const fade = 1 - E.outCubic(prog(u, 19, 19.5));
  if (fade > 0) { ctx.fillStyle = C.deep; ctx.globalAlpha = fade; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  pill(ctx, '✓  Paid · receipt sent', W / 2, 330, 50, C.white, C.green, springU(u, 21.5, SPRING.bouncy));
}

// ------------------------------------------------------------ end (u 24..30)
function sceneEnd(ctx, u, IMG) {
  const k = E.inOutCubic(prog(u, 23.6, 24.2));
  if (k < 1) sceneWhy(ctx, u, IMG);
  ctx.fillStyle = C.green; ctx.fillRect(0, H * (1 - k), W, H);
  ctx.save(); ctx.translate(0, H * (1 - k));
  const lk = springU(u, 24.3, SPRING.bouncy);
  if (IMG.logo && lk > 0) { ctx.save(); ctx.translate(W / 2, 560); ctx.scale(lk, lk); ctx.drawImage(IMG.logo, -110, -110, 220, 220); ctx.restore(); }
  const f = font(124, 400, DISPLAY);
  ['Service charge,', 'sorted.'].forEach((ln, i) => {
    const kk = springU(u, 24.6 + i * 0.4, SPRING.gentle), y = 860 + i * 140;
    ctx.save(); ctx.beginPath(); ctx.rect(0, y - 130, W, 170); ctx.clip();
    text(ctx, ln, W / 2, y + (1 - kk) * 140, f, i ? C.gold : C.cream, 'center');
    ctx.restore();
  });
  const bk = E.outCubic(prog(u, 26, 26.8));
  text(ctx, 'breeup.com', W / 2, 1180, font(64, 500, UI), `rgba(246,244,238,${bk})`, 'center');
  ctx.restore();
}

M.film({
  fonts: [font(100, 400, DISPLAY), font(40, 400, UI), font(40, 500, UI)],
  images: {
    why: 'assets/photos/why-9x16.jpg', logo: 'assets/logo.svg',
    home: 'assets/screens/res-home.jpg', bills: 'assets/screens/res-bills.jpg',
  },
  videos: { clip: 'assets/clips/woman-pays-9x16.webm' },
  hits: HITS,
  draw(ctx, u, t, IMG) {
    if (u < 6.5) sceneHook(ctx, u, IMG);
    else if (u < 19) scenePhone(ctx, u, IMG);
    else if (u < 24) sceneWhy(ctx, u, IMG);
    else sceneEnd(ctx, u, IMG);
    if (u < 24) drawCaptions(ctx, t, u >= 6.5 && u < 19 ? 1500 : 1330);
  },
});
