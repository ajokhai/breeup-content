// The BreeUp paid-ad film, as data (the A-series). film.js is: import { ad } from '/kit/ad.js'; ad({...}).
// Made for muted feeds: big burned-in captions carry the message, music and sound effects underneath, no voice.
// All times in SECONDS (beats.json { "period": 1 }). One file renders every shape (9x16, 4x5, 1x1, 16x9) and
// every hook variant (render.mjs --variant a|b|c; film.json "variants": ["a", "b", "c"]).
//
//   hooks:  { a: 'Still chasing service charge on WhatsApp?', b: '...', c: '...' }   shown 0 .. scenes[1].t
//   scenes: [
//     { t: 0, kind: 'photo', src: 'hook' },                     assets/photos/<src>-<9x16|16x9>.jpg (4:5, 1:1 crop the 9:16)
//     { t: 0, kind: 'clip', src: 'hook' },                      assets/clips/<src>-<9x16|16x9>.webm
//     { t: 3, kind: 'screen', src: 'assets/screens/x.jpg', device: 'phone'|'laptop', bg: 'hook',
//       cam: [[3, [1, 0.5, 0.5]], [5, [1.8, 0.5, 0.3]]], rings: [{ r: [x, y, w, h], a: 4, b: 6, tap: 5 }],
//       caption: 'Bills go out on their own.' },
//     { t: 7, kind: 'type', lines: ['Bill ₦25,000.', 'Receive ₦25,000.'], gold: 1, caption: '...' },
//   ]
//   end: { t: 12.5, line: 'Set up your estate free', url: 'breeup.com' }
//   hits: [[t, label, sound, opts]]   for tools/sfx.mjs (also `const HITS` in film.js)
import * as M from '/kit/motion.js';
import { C, wrap, warp } from '/kit/tutorial.js';

const { W, H, FORMAT, E, prog, lerp, clamp, springU, springKeys, SPRING, font, text, fill, cover, rrect } = M;
const DISPLAY = 'Display', UI = 'UI';
const VARIANT = new URLSearchParams(location.search).get('variant') || 'a';
const TALL = H > W;                                      // 9:16, 4:5
const SHAPE = FORMAT.name;                              // 9x16 | 4x5 | 1x1 | 16x9
// caption band and sizes per shape (9:16 keeps clear of the Reels/TikTok UI; 4:5 and 1:1 of feed chrome)
const LAY = {
  '9x16': { capY: 1220, cap: 78, phoneH: 1080, phoneCY: 760, typeSize: 106 },
  '4x5': { capY: 1010, cap: 70, phoneH: 820, phoneCY: 560, typeSize: 96 },
  '1x1': { capY: 860, cap: 62, phoneH: 690, phoneCY: 440, typeSize: 84 },
  '16x9': { capY: 930, cap: 60, phoneH: 760, phoneCY: 470, typeSize: 110 },
}[SHAPE] || { capY: H * 0.8, cap: 64, phoneH: H * 0.6, phoneCY: H * 0.42, typeSize: 100 };
const photoName = (src) => `assets/photos/${src}-${SHAPE === '16x9' ? '16x9' : '9x16'}.jpg`;

function scrim(ctx, y0, a) {
  const g = ctx.createLinearGradient(0, y0, 0, H);
  g.addColorStop(0, 'rgba(10,22,14,0)'); g.addColorStop(1, `rgba(10,22,14,${a})`);
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, H - y0);
}
const blurCache = new Map();
function blurred(img) {
  if (!img) return null;
  if (blurCache.has(img)) return blurCache.get(img);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); x.filter = 'blur(26px) brightness(0.45) saturate(1.1)';
  cover(x, img, -60, -60, W + 120, H + 120);
  blurCache.set(img, c); return c;
}

// big captions: a phrase at a time, the active word on gold, a dark backing so they read on anything
function caption(ctx, str, t, a, b) {
  if (!str || t < a - 0.05 || t > b) return;
  const size = LAY.cap, f = font(size, 500, UI), maxW = W - 2 * Math.max(72, W * 0.07);
  const lines = wrap(ctx, str, f, maxW), words = str.split(' ');
  const per = (b - a - 0.3) / words.length;
  const pop = E.outBack(prog(t, a - 0.05, a + 0.15), 2), out = E.inCubic(prog(t, b - 0.2, b));
  ctx.save(); ctx.globalAlpha = 1 - out;
  const lh = size * 1.3, y0 = LAY.capY - (lines.length - 1) * lh;
  ctx.translate(W / 2, LAY.capY); ctx.scale(0.88 + 0.12 * pop, 0.88 + 0.12 * pop); ctx.translate(-W / 2, -LAY.capY);
  let wi = 0;
  lines.forEach((ln, li) => {
    ctx.font = f;
    const ws = ln.split(' '), widths = ws.map((w) => ctx.measureText(w).width), gap = size * 0.28;
    const tw = widths.reduce((p, q) => p + q, 0) + gap * (ws.length - 1);
    let x = (W - tw) / 2; const y = y0 + li * lh;
    rrect(ctx, x - 26, y - size * 0.98, tw + 52, size * 1.38, 22); ctx.fillStyle = 'rgba(10,22,14,0.66)'; ctx.fill();
    ws.forEach((w, i) => {
      const on = t >= a + wi * per && t < a + (wi + 1) * per + (wi === words.length - 1 ? 1e9 : 0);
      if (on) { rrect(ctx, x - 12, y - size * 0.84, widths[i] + 24, size * 1.12, 14); ctx.fillStyle = C.gold; ctx.fill(); }
      text(ctx, w, x, y, f, on ? C.ink : C.white);
      x += widths[i] + gap; wi++;
    });
  });
  ctx.restore();
}

export function ad(cfg) {
  cfg.scenes.forEach((s) => { s.t = warp(s.t); s.cam?.forEach((q) => { q[0] = warp(q[0]); }); (s.rings || []).forEach((r) => { for (const k of ['a', 'b', 'tap']) if (r[k] != null) r[k] = warp(r[k]); }); });
  cfg.end.t = warp(cfg.end.t);
  (cfg.hits || []).forEach((h) => { h[0] = warp(h[0]); });
  const sc = cfg.scenes, end = cfg.end, dur = M.CFG?.duration;
  const hook = (cfg.hooks && (cfg.hooks[VARIANT] || cfg.hooks.a)) || '';
  const span = (i) => [sc[i].t, i + 1 < sc.length ? sc[i + 1].t : end.t];

  function drawScene(ctx, i, u, IMG) {
    const s = sc[i], [a, b] = span(i);
    if (s.kind === 'photo' || s.kind === 'clip') {
      fill(ctx, C.deep);
      const img = IMG[`s${i}`];
      if (img) cover(ctx, img, 0, 0, W, H, { fx: s.fx ?? 0.5, fy: s.fy ?? 0.42, zoom: (s.kind === 'photo' ? 1.1 - 0.08 * prog(u, a, b) : 1) });
      scrim(ctx, H * 0.35, 0.85);
    } else if (s.kind === 'screen') {
      const bg = blurred(IMG[`bg${i}`]);
      if (bg) ctx.drawImage(bg, 0, 0); else fill(ctx, C.green);
      const lap = s.device === 'laptop', src = IMG[`s${i}`];
      // crop: [x, y, w, h] of the screenshot to show (desktop screens are unreadable whole on a phone)
      const cr = s.crop || [0, 0, lap ? 2160 : 780, lap ? 1350 : 1688], SW = cr[2], SH = cr[3];
      const ph = lap ? { w: Math.min(W * 0.9, LAY.phoneH * SW / SH) } : { h: LAY.phoneH };
      if (lap) ph.h = ph.w * SH / SW; else ph.w = ph.h * SW / SH;
      ph.x = (W - ph.w) / 2; ph.y = LAY.phoneCY - ph.h / 2;
      const camKeys = s.cam || [[a, [1, 0.5, 0.5]]];
      const [z, fx, fy] = springKeys(u, camKeys, SPRING.gentle);
      const fpx = ph.x + fx * ph.w, fpy = ph.y + fy * ph.h, zk = clamp((z - 1) / 0.5);
      let ax = lerp(fpx, W / 2, zk), ay = lerp(fpy, LAY.phoneCY, zk);
      // never pan past the screenshot's edge: when the zoomed screen is wider (taller) than the frame, keep it covering
      const L0 = ax + (ph.x - fpx) * z, R0 = ax + (ph.x + ph.w - fpx) * z, T0 = ay + (ph.y - fpy) * z, B0 = ay + (ph.y + ph.h - fpy) * z;
      if (R0 - L0 >= W) { if (L0 > 0) ax -= L0; else if (R0 < W) ax += W - R0; }
      if (B0 - T0 >= H) { if (T0 > 0) ay -= T0; else if (B0 < H) ay += H - B0; }
      const drift = 6 * Math.sin(u * 0.6);
      ctx.save(); ctx.translate(ax + drift, ay); ctx.scale(z, z); ctx.translate(-fpx, -fpy);
      ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 70; ctx.shadowOffsetY = 26;
      rrect(ctx, ph.x - (lap ? 12 : 16), ph.y - (lap ? 12 : 16), ph.w + (lap ? 24 : 32), ph.h + (lap ? 24 : 32), lap ? 20 : 60);
      ctx.fillStyle = '#0d0f0d'; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.save(); rrect(ctx, ph.x, ph.y, ph.w, ph.h, lap ? 6 : 46); ctx.clip();
      if (src) ctx.drawImage(src, ...cr, ph.x, ph.y, ph.w, ph.h);
      ctx.restore();
      (s.rings || []).forEach((r) => {
        if (u < r.a || u > r.b + 0.3) return;
        const k = ph.w / SW, [x, y, w, h] = [r.r[0] - cr[0], r.r[1] - cr[1], r.r[2], r.r[3]], pad = 12 / k;
        const rx = ph.x + (x - pad) * k, ry = ph.y + (y - pad) * k, rw = (w + 2 * pad) * k, rh = (h + 2 * pad) * k, per = 2 * (rw + rh);
        ctx.save(); ctx.globalAlpha = 1 - E.inCubic(prog(u, r.b, r.b + 0.25));
        ctx.lineWidth = 7 / z; ctx.strokeStyle = C.gold; ctx.lineCap = 'round';
        ctx.setLineDash([per * E.outCubic(prog(u, r.a, r.a + 0.45)), per]);
        rrect(ctx, rx, ry, rw, rh, 12 / z); ctx.stroke(); ctx.setLineDash([]);
        if (r.tap != null && u >= r.tap) {
          const tk = prog(u, r.tap, r.tap + 0.6);
          ctx.globalAlpha *= (1 - tk) * 0.9; ctx.fillStyle = C.gold;
          ctx.beginPath(); ctx.arc(rx + rw / 2, ry + rh / 2, (16 + 60 * E.outCubic(tk)) / z, 0, M.TAU); ctx.fill();
        }
        ctx.restore();
      });
      ctx.restore();
    } else if (s.kind === 'type') {
      const bg = blurred(IMG[`bg${i}`]);
      if (bg) { ctx.drawImage(bg, 0, 0); ctx.fillStyle = 'rgba(18,50,32,0.82)'; ctx.fillRect(0, 0, W, H); } else fill(ctx, C.green);
      const size = LAY.typeSize, f = font(size, 400, DISPLAY), maxW = W * 0.86;
      const all = s.lines.flatMap((ln, li) => wrap(ctx, ln, f, maxW).map((x) => [x, li]));
      const lh = size * 1.12, y0 = (TALL ? H * 0.34 : H * 0.36) - (all.length - 1) * lh / 2;
      all.forEach(([ln, li], j) => {
        const k = springU(u, a + 0.15 + li * 0.45, SPRING.gentle), y = y0 + j * lh;
        ctx.save(); ctx.beginPath(); ctx.rect(0, y - size, W, size * 1.3); ctx.clip();
        text(ctx, ln, W / 2, y + (1 - k) * size, f, li === s.gold ? C.gold : C.cream, 'center');
        ctx.restore();
      });
    }
  }

  function drawEnd(ctx, u, IMG) {
    fill(ctx, C.green);
    const a = end.t, lk = springU(u, a + 0.15, SPRING.gentle);
    const ls = TALL ? 210 : SHAPE === '1x1' ? 170 : 160, cy = TALL ? H * 0.34 : H * 0.3;
    if (IMG.logo) { ctx.save(); ctx.globalAlpha = Math.min(1, lk); const br = 1 + 0.03 * Math.sin((u - a) * 1.8); ctx.translate(W / 2, cy + (1 - lk) * 50); ctx.scale(br, br); ctx.drawImage(IMG.logo, -ls / 2, -ls / 2, ls, ls); ctx.restore(); }
    const size = TALL ? 80 : 70, f = font(size, 400, DISPLAY);
    const lines = wrap(ctx, end.line || 'Set up your estate free', f, W * 0.84);
    const y0 = cy + ls * 0.85 + size;
    lines.forEach((ln, i) => {
      const k = springU(u, a + 0.35 + i * 0.15, SPRING.gentle), y = y0 + i * size * 1.12;
      ctx.save(); ctx.beginPath(); ctx.rect(0, y - size, W, size * 1.3); ctx.clip();
      text(ctx, ln, W / 2, y + (1 - k) * size, f, C.cream, 'center'); ctx.restore();
    });
    // the address as a button, so it reads as the thing to do
    const bk = springU(u, a + 0.8, SPRING.bouncy), bs = TALL ? 64 : 54, bf = font(bs, 500, UI);
    ctx.font = bf; const bw = ctx.measureText(end.url || 'breeup.com').width + 90, bh = bs * 1.9;
    const by = y0 + lines.length * size * 1.12 + bh * 0.6;
    if (bk > 0) {
      ctx.save(); ctx.translate(W / 2, by); ctx.scale(bk, bk);
      rrect(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2); ctx.fillStyle = C.gold; ctx.fill();
      text(ctx, end.url || 'breeup.com', 0, bs * 0.36, bf, C.ink, 'center'); ctx.restore();
    }
  }

  const images = { logo: 'assets/logo.svg' }, videos = {};
  sc.forEach((s, i) => {
    if (s.kind === 'photo') images[`s${i}`] = photoName(s.src);
    if (s.kind === 'clip') videos[`s${i}`] = `assets/clips/${s.src}-${SHAPE === '16x9' ? '16x9' : '9x16'}.webm`;
    if (s.kind === 'screen') images[`s${i}`] = s.src;
    if ((s.kind === 'screen' || s.kind === 'type') && s.bg) images[`bg${i}`] = photoName(s.bg);
  });

  M.film({
    fonts: [font(100, 400, DISPLAY), font(40, 400, UI), font(40, 500, UI)],
    images, videos, hits: cfg.hits || [],
    // a clip plays from its own scene start
    videoTime: Object.fromEntries(sc.map((s, i) => [`s${i}`, (t) => t - s.t]).filter(([k]) => videos[k])),
    draw(ctx, u, t, IMG) {
      const i = sc.findLastIndex((s) => u >= s.t - 0.25);
      const next = sc[i + 1]?.t ?? end.t;
      // whip pan into each scene and into the end card
      const whipAt = [...sc.slice(1).map((s) => s.t), end.t].find((x) => Math.abs(u - x) < 0.25);
      if (whipAt != null) {
        const j = sc.findLastIndex((s) => s.t < whipAt), p = E.inOutCubic(prog(u, whipAt - 0.25, whipAt + 0.25));
        ctx.save(); ctx.translate(-p * W, 0); drawScene(ctx, j, u, IMG); ctx.restore();
        ctx.save(); ctx.translate((1 - p) * W, 0);
        if (whipAt === end.t) drawEnd(ctx, u, IMG); else drawScene(ctx, j + 1, u, IMG);
        ctx.restore();
      } else if (u >= end.t) drawEnd(ctx, u, IMG);
      else drawScene(ctx, Math.max(0, i), u, IMG);
      // captions: the hook on the first scene, then each scene's own line
      if (u < end.t) {
        const k = sc.findLastIndex((s) => u >= s.t);
        const [a, b] = span(Math.max(0, k));
        caption(ctx, k <= 0 ? hook : sc[k].caption, u, a + 0.1, b - 0.15);
      }
    },
  });
}
