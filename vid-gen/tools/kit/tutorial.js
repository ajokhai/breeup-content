// The BreeUp tutorial film, as data. A film's film.js is just: import { tutorial } from '/kit/tutorial.js'; tutorial({...}).
// All times are in SECONDS (the film's beats.json is { "period": 1, "offset": 0 }), so they line up with the
// voice-over starts that tools/make.mjs writes into film.json "vo". Looks: green stage with the real phone screen,
// cream caption column, step counter, gold rings on the exact control, photo scenes, green end card.
//
// Config (every scene optional except phone + steps):
//   kicker: 'BREEUP TUTORIAL · RESIDENTS'
//   photos: { hook: 'hook', why: 'why', tip: 'tip' }      -> assets/photos/<name>-<16x9|9x16>.jpg
//   hook:  { to: 4.8, lines: { '16x9': [...], '9x16': [...] }, gold: 'minutes' }
//   why:   { to: 10.3, text: '...' }
//   intro: { to: 12, lines: ["Here's how,", 'in four steps.'] }
//   phone: { device: 'phone' | 'laptop' (desktop screenshots 2160x1350; regions then in those px),
//            screens: { login: 'assets/screens/x.jpg', ... }, seq: [['login', 0], ['home', 27]],
//            regions: { pin: [x, y, w, h] (screenshot px, 780x1688) }, cam: [[t, [zoom, fx, fy]], ...],
//            rings: [{ r: 'pin', a: 21, b: 24, tap: 23 }], to: 49 }
//   steps: [{ t: 11, title: 'Sign in', body: '...' }]       (the counter says STEP n OF steps.length)
//   chips: [{ text: '...', a: 33, b: 38 }]                 (a pill under the step text)
//   codes: [{ text: 'GE-D3', label: 'YOUR UNIT REFERENCE', a: 32, b: 38 }]   (a big stamped code)
//   cards: [{ src: 'portal', parts: [[x, y, w, h], ...], a, b, rings: [{ x, w, a, b, tap }] }]
//          a strip cut from a real (desktop) screenshot, parts placed side by side; ring x/w in strip px
//   tip:   { title: '...', body: '...', kicker: 'GOOD TO KNOW', to: 55.5 }
//   end:   { tagline: 'Dues, gate access, approvals and notices in one place.' }
//   hits:  the same list as `const HITS` in film.js (seconds), for tools/sfx.mjs
import * as M from '/kit/motion.js';

const { W, H, FORMAT, E, prog, lerp, clamp, springU, springKeys, SPRING, wobble, font, layout, text, fill, cover, rrect } = M;
export const C = { green: '#1a472a', deep: '#123220', cream: '#f6f4ee', gold: '#c9a84c', ink: '#1c1f1b', mute: '#5d645c', white: '#ffffff' };
const DISPLAY = 'Display', UI = 'UI';
const P = FORMAT.portrait;

export function wrap(ctx, str, f, maxW) {
  ctx.font = f;
  const out = []; let line = '';
  for (const w of str.split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}
export function riseLines(ctx, lines, x, y, lh, f, color, u, u0, { stagger = 0.22, align = 'left' } = {}) {
  lines.forEach((ln, i) => {
    const k = springU(u, u0 + i * stagger, SPRING.gentle);
    if (k <= 0) return;
    const by = y + i * lh;
    ctx.save(); ctx.beginPath(); ctx.rect(0, by - lh * 0.95, W, lh * 1.25); ctx.clip();
    text(ctx, ln, x, by + (1 - k) * lh * 0.9, f, color, align);
    ctx.restore();
  });
}
export function scrim(ctx, y0, y1, a) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, 'rgba(10,22,14,0)'); g.addColorStop(1, `rgba(10,22,14,${a})`);
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, y1 - y0);
}
// type on photos gets a soft dark shadow so it reads over any part of the picture
function onPhoto(ctx, fn) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 3; fn(); ctx.restore(); }
// a blurred, darkened copy of a photo, made once, for behind the phone stage (rule 4: every scene on a photo)
const blurCache = new Map();
function blurred(img) {
  if (!img) return null;
  if (blurCache.has(img)) return blurCache.get(img);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.filter = 'blur(28px) brightness(0.42) saturate(1.1)';
  cover(x, img, -60, -60, W + 120, H + 120, { fx: 0.5, fy: 0.45 });
  blurCache.set(img, c);
  return c;
}
function logo(ctx, IMG, cx, cy, size, k = 1) {
  if (!IMG.logo || k <= 0) return;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.drawImage(IMG.logo, -size / 2, -size / 2, size, size); ctx.restore();
}
function pill(ctx, str, x, y, size, bg, fg, k = 1, maxW = 1e9) {
  if (k <= 0) return;
  ctx.font = font(size, 500, UI);
  const need = ctx.measureText(str).width + 56;
  if (need > maxW) size = Math.floor(size * (maxW - 56) / (need - 56));
  const f = font(size, 500, UI); ctx.font = f;
  const w = ctx.measureText(str).width + 56, h = size * 1.9;
  ctx.save(); ctx.translate(x + w / 2, y); ctx.scale(k, k);
  rrect(ctx, -w / 2, -h / 2, w, h, h / 2); ctx.fillStyle = bg; ctx.fill();
  text(ctx, str, 0, size * 0.35, f, fg, 'center');
  ctx.restore();
}

// layout per format; 9:16 type follows the rules (body >= 56 px, headings >= 96 px)
// Layout per device and format. phone: real 780x1688 phone screenshots. laptop: real 2160x1350 desktop ones.
const LAYOUTS = { phone: FORMAT.pick({
  '16x9': { stage: [0, 0, 1080, 1080], phoneH: 940, cap: { x: 1170, y: 260, w: 650 }, num: 200, title: 84, body: 42, extraY: 860 },
  '9x16': { stage: [0, 860, 1080, 710], phoneH: 1160, cap: { x: 72, y: 330, w: 936 }, num: 104, title: 104, body: 60, extraY: 690 },
}), laptop: FORMAT.pick({
  '16x9': { stage: [0, 0, 1250, 1080], screenW: 1130, cap: { x: 1320, y: 260, w: 520 }, num: 180, title: 76, body: 40, extraY: 860 },
  '9x16': { stage: [0, 860, 1080, 710], screenW: 1060, cap: { x: 72, y: 330, w: 936 }, num: 104, title: 104, body: 60, extraY: 690 },
}) };
let L, SRC, PH, sx0, sy0, sw0, sh0, LAPTOP = false;
function setDevice(device = 'phone') {
  LAPTOP = device === 'laptop';
  L = LAYOUTS[device];
  SRC = LAPTOP ? { w: 2160, h: 1350 } : { w: 780, h: 1688 };
  [sx0, sy0, sw0, sh0] = L.stage;
  PH = LAPTOP ? { w: L.screenW, h: L.screenW * SRC.h / SRC.w } : { w: L.phoneH * SRC.w / SRC.h, h: L.phoneH };
  PH.x = sx0 + (sw0 - PH.w) / 2;
  PH.y = LAPTOP ? sy0 + (sh0 - PH.h) / 2 - (P ? 0 : 30) : P ? sy0 + 40 : sy0 + (sh0 - L.phoneH) / 2;
}
// 9:16: the stage ends at 1570 px so nothing important sits under the Reels/TikTok UI; the camera centres
// zoomed controls inside it, and the phone's lower edge is cropped at the stage.

export function tutorial(cfg) {
  const ph = cfg.phone, steps = cfg.steps;
  setDevice(ph.device);
  const t0 = steps[0].t - 0.4;                       // the phone rises just before step 1
  const tEnd = ph.to;                                // the phone scene ends (green swell) here
  const tipTo = cfg.tip?.to ?? tEnd;
  const cam = [[t0, [1, 0.5, 0.5]], ...(ph.cam || [])];
  const camAt = (u) => springKeys(u, cam, SPRING.gentle);
  const toFrame = (u, x, y) => {
    const [z, fx, fy] = camAt(u);
    const fpx = PH.x + fx * PH.w, fpy = PH.y + fy * PH.h, zk = clamp((z - 1) / 0.5);
    const ax = lerp(fpx, sx0 + sw0 / 2, zk), ay = lerp(fpy, sy0 + sh0 / 2, zk);
    return [ax + (PH.x + x * PH.w / SRC.w - fpx) * z, ay + (PH.y + y * PH.h / SRC.h - fpy) * z];
  };
  let bodyBottom = 0;   // set by drawStep each frame; chips, codes and cards sit below it
  const extraY = () => Math.max(L.extraY, bodyBottom + (P ? 50 : 60));
  const photo = (k) => cfg.photos?.[k] && `assets/photos/${cfg.photos[k]}-${P ? '9x16' : '16x9'}.jpg`;

  // ---------------------------------------------------------- scenes
  function sceneHook(ctx, u, IMG) {
    fill(ctx, C.deep);
    if (IMG.hook) cover(ctx, IMG.hook, 0, 0, W, H, { fx: 0.5, fy: P ? 0.4 : 0.45, zoom: 1.12 - 0.06 * prog(u, 0, cfg.hook.to + 1) });
    scrim(ctx, H * 0.25, H, 0.92);
    const s = FORMAT.safe, size = FORMAT.pick({ '16x9': 124, '9x16': 118 }), f = font(size, 400, DISPLAY);
    const lines = cfg.hook.lines[FORMAT.name] || cfg.hook.lines['16x9'];
    const y0 = P ? H - 540 - (lines.length - 1) * size * 1.02 : H - 150 - (lines.length - 1) * size * 1.02;
    let wi = 0;
    lines.forEach((ln, li) => {
      let x = s.x;
      ln.split(' ').forEach((w) => {
        const k = springU(u, li * 0.35, SPRING.gentle);
        const Lw = layout(ctx, w, f, -0.01 * size);
        if (k > 0) {
          const by = y0 + li * size * 1.02;
          ctx.save(); ctx.beginPath(); ctx.rect(0, by - size, W, size * 1.3); ctx.clip();
          onPhoto(ctx, () => text(ctx, w, x, by + (1 - k) * size, f, cfg.hook.gold && w.includes(cfg.hook.gold) ? C.gold : C.cream, 'left', -0.01 * size));
          ctx.restore();
        }
        x += Lw.width + size * 0.26; wi++;
      });
    });
    const kk = E.outCubic(prog(u, 0, 0.6));
    if (cfg.kicker && !P) text(ctx, cfg.kicker, s.x, y0 - size * 1.05, font(30, 500, UI), `rgba(246,244,238,${0.85 * kk})`, 'left', 3);
  }
  function sceneWhy(ctx, u, IMG) {
    const a = cfg.hook.to;
    const wipe = E.inOutCubic(prog(u, a - 0.25, a + 0.35)), reveal = E.inOutCubic(prog(u, a + 0.2, a + 0.8));
    if (wipe < 1) sceneHook(ctx, u, IMG);
    ctx.fillStyle = C.green; ctx.fillRect(0, H * (1 - wipe), W, H);
    if (reveal > 0 && IMG.why) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, H * (1 - reveal), W, H); ctx.clip();
      cover(ctx, IMG.why, 0, 0, W, H, { fx: 0.5, fy: 0.4, zoom: 1.05 + 0.05 * prog(u, a, cfg.why.to) });
      scrim(ctx, H * 0.15, H, 0.95);
      ctx.restore();
    }
    const s = FORMAT.safe, size = FORMAT.pick({ '16x9': 76, '9x16': 96 }), f = font(size, 400, DISPLAY);
    const lines = wrap(ctx, cfg.why.text, f, P ? s.w : 1300);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 24;
    riseLines(ctx, lines, s.x, H - (P ? 540 : 130) - (lines.length - 1) * size * 1.1, size * 1.1, f, C.cream, u, a + 0.6);
    ctx.restore();
  }
  const prevScene = (u, IMG, ctx) => (cfg.why ? sceneWhy : sceneHook)(ctx, u, IMG);
  const prevTo = () => (cfg.why ? cfg.why.to : cfg.hook.to);
  function sceneIntro(ctx, u, IMG) {
    const a = prevTo(), inn = E.inOutCubic(prog(u, a - 0.4, a + 0.1));
    if (inn < 1) prevScene(u, IMG, ctx);
    const top = H * (1 - inn);
    ctx.fillStyle = C.cream; ctx.fillRect(0, top, W, H);
    ctx.save(); ctx.translate(0, top);
    const ls = FORMAT.pick({ '16x9': 150, '9x16': 190 }), cx = P ? W / 2 : W * 0.32, cy = P ? H * 0.38 : H / 2;
    const lk = springU(u, a, SPRING.gentle);
    ctx.save(); ctx.globalAlpha = Math.min(1, lk); logo(ctx, IMG, cx, cy + (1 - lk) * 60, ls, 1); ctx.restore();
    const size = FORMAT.pick({ '16x9': 92, '9x16': 100 }), f = font(size, 400, DISPLAY);
    if (P) riseLines(ctx, cfg.intro.lines, W / 2, cy + ls * 0.9 + size, size * 1.1, f, C.green, u, a + 0.4, { align: 'center' });
    else riseLines(ctx, cfg.intro.lines, cx + ls * 0.75, cy - 10, size * 1.1, f, C.green, u, a + 0.4);
    ctx.restore();
  }

  function ring(ctx, u, { r, a, b, tap }) {
    if (u < a - 0.05 || u > b + 0.3) return;
    const [x, y, w, h] = ph.regions[r], pad = LAPTOP ? 14 : 10;
    const [x0, y0] = toFrame(u, x - pad, y - pad), [x1, y1] = toFrame(u, x + w + pad, y + h + pad);
    const sc = (x1 - x0) / (w + 2 * pad), per = 2 * ((x1 - x0) + (y1 - y0));
    ctx.save(); ctx.globalAlpha = 1 - E.inCubic(prog(u, b, b + 0.25));
    ctx.lineWidth = Math.max(5, (LAPTOP ? 14 : 7) * sc); ctx.strokeStyle = C.gold; ctx.lineCap = 'round';
    ctx.setLineDash([per * E.outCubic(prog(u, a, a + 0.5)), per]);
    rrect(ctx, x0, y0, x1 - x0, y1 - y0, 16 * sc); ctx.stroke(); ctx.setLineDash([]);
    if (tap != null && u >= tap) {
      const tk = prog(u, tap, tap + 0.6);
      ctx.globalAlpha *= (1 - tk) * 0.9; ctx.fillStyle = C.gold;
      ctx.beginPath(); ctx.arc((x0 + x1) / 2, (y0 + y1) / 2, Math.max(14, (20 + 70 * E.outCubic(tk)) * sc * (LAPTOP ? 2 : 1)), 0, M.TAU); ctx.fill();
    }
    ctx.restore();
  }
  function scenePhone(ctx, u, IMG) {
    const bg = blurred(IMG.stage || IMG.hook);
    if (bg) { ctx.drawImage(bg, 0, 0); ctx.fillStyle = 'rgba(246,244,238,0.88)'; ctx.fillRect(0, 0, W, H); } else fill(ctx, C.cream);
    if (bg) { ctx.save(); ctx.beginPath(); ctx.rect(...L.stage); if (P) ctx.rect(0, sy0 + sh0, W, H - sy0 - sh0); ctx.clip(); ctx.drawImage(bg, 0, 0); ctx.restore(); }
    else { ctx.fillStyle = C.green; ctx.fillRect(...L.stage); }
    if (P && !bg) { ctx.fillStyle = C.deep; ctx.fillRect(0, sy0 + sh0, W, H - sy0 - sh0); }
    const k = springU(u, t0, SPRING.gentle), q = 0.03 * wobble(u - t0 - 0.35, 3.5, 9);
    const [z, fx, fy] = camAt(u);
    const fpx = PH.x + fx * PH.w, fpy = PH.y + fy * PH.h, zk = clamp((z - 1) / 0.5);
    const ax = lerp(fpx, sx0 + sw0 / 2, zk), ay = lerp(fpy, sy0 + sh0 / 2, zk);
    ctx.save(); ctx.beginPath(); ctx.rect(...L.stage); ctx.clip();
    ctx.translate(0, (1 - k) * (sh0 + 200));
    ctx.save(); ctx.translate(ax, ay); ctx.scale(z * (1 + q), z * (1 - q)); ctx.translate(-fpx, -fpy);
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
    if (LAPTOP) {
      rrect(ctx, PH.x - 14, PH.y - 14, PH.w + 28, PH.h + 28, 22); ctx.fillStyle = '#0d0f0d'; ctx.fill();
      ctx.shadowColor = 'transparent';
      rrect(ctx, PH.x - 70, PH.y + PH.h + 14, PH.w + 140, 22, 11); ctx.fillStyle = '#2a2d2a'; ctx.fill();
    } else {
      rrect(ctx, PH.x - 16, PH.y - 16, PH.w + 32, PH.h + 32, 64); ctx.fillStyle = '#0d0f0d'; ctx.fill();
    }
    ctx.shadowColor = 'transparent';
    ctx.save(); rrect(ctx, PH.x, PH.y, PH.w, PH.h, LAPTOP ? 6 : 50); ctx.clip();
    ph.seq.forEach(([key, at], i) => {   // each screen slides up over the last
      const img = IMG[key], s = i === 0 ? 1 : E.inOutCubic(prog(u, at, at + 0.5));
      const nx = ph.seq[i + 1] ? E.inOutCubic(prog(u, ph.seq[i + 1][1], ph.seq[i + 1][1] + 0.5)) : 0;
      if (s > 0 && nx < 1 && img) ctx.drawImage(img, PH.x, PH.y + (1 - s) * PH.h - nx * PH.h * 0.3, PH.w, PH.h);
    });
    ctx.restore(); ctx.restore();
    (ph.rings || []).forEach((r) => ring(ctx, u, r));
    ctx.restore();
    const i = steps.findLastIndex((s) => u >= s.t - 0.2);
    drawStep(ctx, u, Math.max(0, i));
    drawDots(ctx, u);
    (cfg.chips || []).forEach((c) => {
      if (u < c.a || u > c.b + 0.3) return;
      ctx.save(); ctx.globalAlpha = 1 - E.inCubic(prog(u, c.b, c.b + 0.3));
      pill(ctx, c.text, L.cap.x, extraY() + 30, P ? 50 : 36, C.green, C.cream, springU(u, c.a, SPRING.bouncy), L.cap.w);
      ctx.restore();
    });
    (cfg.codes || []).forEach((c) => drawCode(ctx, u, c));
    (cfg.cards || []).forEach((c) => drawCard(ctx, u, c, IMG));
  }
  function drawStep(ctx, u, i) {
    const st = steps[i], c = L.cap, next = steps[i + 1];
    const exitU = next ? next.t - 0.35 : tEnd - 0.8;
    const nk = springU(u, st.t + 0.15, SPRING.bouncy), ex = E.inCubic(prog(u, exitU, exitU + 0.3));
    const bf = font(L.body, 400, UI), bl = wrap(ctx, st.body, bf, c.w), n = String(i + 1);
    ctx.font = font(L.title, 400, DISPLAY);
    const room = P ? c.w - L.title * 0.95 : c.w, tw = ctx.measureText(st.title).width;
    const ts = tw > room ? Math.floor(L.title * room / tw) : L.title;
    bodyBottom = P ? c.y + L.title + 90 + (bl.length - 1) * L.body * 1.35 : c.y + L.num + 200 + (bl.length - 1) * L.body * 1.45;
    ctx.save(); ctx.globalAlpha = 1 - ex;
    if (!P) text(ctx, `STEP ${n} OF ${steps.length}`, c.x, c.y, font(24, 500, UI), C.mute, 'left', 3);
    if (P) {
      const ty = c.y + L.title - 10;
      ctx.save(); ctx.translate(c.x, ty); ctx.scale(nk, nk); text(ctx, n, 0, 0, font(L.num * 1.25, 400, DISPLAY), C.gold); ctx.restore();
      riseLines(ctx, [st.title], c.x + L.title * 0.95, ty, L.title * 1.1, font(ts, 400, DISPLAY), C.green, u, st.t + 0.25);
      riseLines(ctx, bl, c.x, ty + 100, L.body * 1.35, bf, C.ink, u, st.t + 0.5, { stagger: 0.15 });
    } else {
      ctx.save(); ctx.translate(c.x, c.y + L.num * 0.95); ctx.scale(nk, nk); text(ctx, n, 0, 0, font(L.num, 400, DISPLAY), C.gold); ctx.restore();
      riseLines(ctx, [st.title], c.x, c.y + L.num + 110, L.title * 1.1, font(ts, 400, DISPLAY), C.green, u, st.t + 0.25);
      riseLines(ctx, bl, c.x, c.y + L.num + 200, L.body * 1.45, bf, C.ink, u, st.t + 0.5, { stagger: 0.15 });
    }
    ctx.restore();
  }
  function drawDots(ctx, u) {
    const c = L.cap, y = P ? c.y - 30 : c.y - 64, r = P ? 13 : 9, gap = P ? 56 : 46;
    steps.forEach((s, i) => {
      const k = u >= s.t ? springU(u, s.t, SPRING.bouncy) : 0, x = c.x + i * gap + r;
      ctx.fillStyle = 'rgba(26,71,42,0.18)'; ctx.beginPath(); ctx.arc(x, y, r, 0, M.TAU); ctx.fill();
      if (k > 0) { ctx.fillStyle = C.green; ctx.beginPath(); ctx.arc(x, y, r * k, 0, M.TAU); ctx.fill(); }
    });
  }
  function drawCode(ctx, u, c) {
    if (u < c.a || u > c.b + 0.3) return;
    const size = P ? 96 : 110, f = font(size, 500, UI), y = extraY() + 34 + size * 0.9, ex = E.inCubic(prog(u, c.b, c.b + 0.3));
    const k = springU(u, c.a, SPRING.bouncy);
    ctx.save(); ctx.globalAlpha = (1 - ex) * Math.min(1, k * 1.5);
    ctx.font = f; const tw = ctx.measureText(c.text).width;
    ctx.shadowColor = 'rgba(0,0,0,0.22)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
    rrect(ctx, L.cap.x - 24, y - size * 0.95, tw + 48, size * 1.25, 20); ctx.fillStyle = C.white; ctx.fill();
    ctx.restore();
    ctx.save(); ctx.globalAlpha = 1 - ex;
    ctx.beginPath(); ctx.rect(0, y - size, W, size * 1.25); ctx.clip();
    text(ctx, c.text, L.cap.x, y - (1 - k) * size * 0.8, f, C.ink);
    ctx.restore();
    if (c.label) text(ctx, c.label, L.cap.x, y - size - 22, font(P ? 44 : 24, 500, UI), `rgba(201,168,76,${E.outCubic(prog(u, c.a + 0.3, c.a + 0.8)) * (1 - ex)})`, 'left', 3);
  }
  function drawCard(ctx, u, c, IMG) {
    const img = IMG[c.src];
    if (!img || u < c.a - 0.1 || u > c.b + 0.4) return;
    const cap = L.cap, srcW = c.parts.reduce((a, p) => a + p[2], 0), sc = cap.w / srcW, h = c.parts[0][3] * sc;
    const k = springU(u, c.a, SPRING.snappy), ex = E.inCubic(prog(u, c.b, c.b + 0.35));
    const x = cap.x, y = extraY() + (1 - k) * 60;
    ctx.save(); ctx.globalAlpha = Math.min(1, k) * (1 - ex);
    ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
    rrect(ctx, x - 4, y - 4, cap.w + 8, h + 8, 18); ctx.fillStyle = C.white; ctx.fill(); ctx.shadowColor = 'transparent';
    let px = x;
    c.parts.forEach((p) => { ctx.drawImage(img, ...p, px, y, p[2] * sc, h); px += p[2] * sc; });
    (c.rings || []).forEach((r) => {
      if (u < r.a || u > r.b + 0.3) return;
      const rx = x + r.x * sc - 8, rw = r.w * sc + 16, ry = y + 22 * sc, rh = h - 44 * sc, per = 2 * (rw + rh);
      ctx.save(); ctx.globalAlpha *= 1 - E.inCubic(prog(u, r.b, r.b + 0.25));
      ctx.lineWidth = 6; ctx.strokeStyle = C.gold; ctx.setLineDash([per * E.outCubic(prog(u, r.a, r.a + 0.5)), per]);
      rrect(ctx, rx, ry, rw, rh, 12); ctx.stroke(); ctx.setLineDash([]);
      if (r.tap != null && u >= r.tap) {
        const tk = prog(u, r.tap, r.tap + 0.6);
        ctx.globalAlpha *= (1 - tk) * 0.9; ctx.fillStyle = C.gold;
        ctx.beginPath(); ctx.arc(rx + rw / 2, ry + rh / 2, 14 + 50 * E.outCubic(tk), 0, M.TAU); ctx.fill();
      }
      ctx.restore();
    });
    ctx.restore();
  }
  function sceneTip(ctx, u, IMG) {
    const a = tEnd;
    fill(ctx, C.deep);
    ctx.save();
    if (IMG.tip) cover(ctx, IMG.tip, 0, 0, W, H, { fx: 0.5, fy: 0.45, zoom: 1.12 - 0.08 * prog(u, a, tipTo) });
    scrim(ctx, H * 0.2, H, 0.94);
    ctx.restore();
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 24;
    const s = FORMAT.safe, size = FORMAT.pick({ '16x9': 84, '9x16': 96 }), f = font(size, 400, DISPLAY);
    const bf = font(FORMAT.pick({ '16x9': 42, '9x16': 56 }), 400, UI), bh = FORMAT.pick({ '16x9': 60, '9x16': 76 });
    const lines = wrap(ctx, cfg.tip.title, f, P ? s.w : 1200), bl = wrap(ctx, cfg.tip.body, bf, P ? s.w : 1200);
    const y = H - (P ? 440 : 120) - bl.length * bh - (lines.length - 1) * size * 1.1 - 30;
    text(ctx, cfg.tip.kicker || 'GOOD TO KNOW', s.x, y - size - 24, font(P ? 44 : 26, 500, UI), `rgba(201,168,76,${E.outCubic(prog(u, a + 0.8, a + 1.3))})`, 'left', 3);
    riseLines(ctx, lines, s.x, y, size * 1.1, f, C.cream, u, a + 0.9);
    riseLines(ctx, bl, s.x, y + (lines.length - 1) * size * 1.1 + bh + 30, bh, bf, 'rgba(246,244,238,0.92)', u, a + 1.6, { stagger: 0.15 });
    ctx.restore();
  }
  function sceneEnd(ctx, u, IMG) {
    const a = tipTo, k = E.inOutCubic(prog(u, a - 0.3, a + 0.2));
    if (k < 1) (cfg.tip ? sceneTip : scenePhone)(ctx, u, IMG);
    const top = H * (1 - k);
    ctx.fillStyle = C.green; ctx.fillRect(0, top, W, H);
    ctx.save(); ctx.translate(0, top);
    const ls = FORMAT.pick({ '16x9': 190, '9x16': 230 }), wsize = 150, wf = font(wsize, 400, DISPLAY);
    ctx.font = wf; const ww = ctx.measureText('BreeUp').width;
    let lx, ly, wx, wy;
    if (P) { lx = W / 2; ly = H * 0.36; wx = W / 2 - ww / 2; wy = ly + ls / 2 + wsize + 20; }
    else { const tot = ls + 40 + ww; lx = (W - tot) / 2 + ls / 2; ly = H * 0.42; wx = lx + ls / 2 + 40; wy = ly + wsize * 0.33; }
    logo(ctx, IMG, lx, ly, ls, springU(u, a + 0.2, SPRING.bouncy));
    const wk = springU(u, a + 0.4, SPRING.gentle);
    ctx.save(); ctx.beginPath(); ctx.rect(0, wy - wsize, W, wsize * 1.3); ctx.clip();
    text(ctx, 'BreeUp', wx, wy + (1 - wk) * wsize, wf, C.cream); ctx.restore();
    const tf = font(FORMAT.pick({ '16x9': 38, '9x16': 50 }), 400, UI), s = FORMAT.safe, lh = FORMAT.pick({ '16x9': 56, '9x16': 68 });
    const tl = wrap(ctx, cfg.end?.tagline || 'Dues, gate access, approvals and notices in one place.', tf, P ? s.w : 1400);
    const ty = P ? wy + 120 : H * 0.62;
    riseLines(ctx, tl, W / 2, ty, lh, tf, 'rgba(246,244,238,0.85)', u, a + 0.8, { align: 'center', stagger: 0.12 });
    riseLines(ctx, ['breeup.com'], W / 2, ty + tl.length * lh + 70, 70, font(P ? 60 : 52, 500, UI), C.gold, u, a + 1.2, { align: 'center' });
    ctx.restore();
  }

  const images = { logo: 'assets/logo.svg', ...ph.screens };
  for (const k of ['hook', 'why', 'tip']) if (photo(k)) images[k] = photo(k);
  M.film({
    fonts: [font(100, 400, DISPLAY), font(40, 400, UI), font(40, 500, UI)],
    images, hits: cfg.hits || [],
    draw(ctx, u, t, IMG) {
      if (u < cfg.hook.to) sceneHook(ctx, u, IMG);
      else if (cfg.why && u < cfg.why.to) sceneWhy(ctx, u, IMG);
      else if (cfg.intro && u < cfg.intro.to) sceneIntro(ctx, u, IMG);
      else if (u < (cfg.tip ? tEnd - 0.35 : tEnd)) {
        const from = cfg.intro ? cfg.intro.to : prevTo();
        if (u < from + 0.5 && !cfg.intro) {   // no intro card: cream panel wipes up over the photo
          const inn = E.inOutCubic(prog(u, from - 0.4, from + 0.1));
          if (inn < 1) prevScene(u, IMG, ctx);
          ctx.save(); ctx.beginPath(); ctx.rect(0, H * (1 - inn), W, H); ctx.clip(); scenePhone(ctx, u, IMG); ctx.restore();
        } else scenePhone(ctx, u, IMG);
      } else if (cfg.tip && u < tEnd + 0.35) {
        const p = E.inOutCubic(prog(u, tEnd - 0.35, tEnd + 0.35));
        ctx.save(); ctx.translate(-p * W, 0); scenePhone(ctx, u, IMG); ctx.restore();
        ctx.save(); ctx.translate((1 - p) * W, 0); sceneTip(ctx, u, IMG); ctx.restore();
      } else if (cfg.tip && u < tipTo) sceneTip(ctx, u, IMG);
      else sceneEnd(ctx, u, IMG);
    },
  });
}
