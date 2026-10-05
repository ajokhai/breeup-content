// The launch film, as data: short beat-cut shots, big kinetic type, app screens floating over rich backgrounds,
// zoom-ins on the exact control, the real 3D phone, whip cuts and a logo sting. Built for "product launch" videos
// (the look on X), where tutorial.js is built for how-tos. A film's film.js is: import { launch } from '/kit/launch.js'; launch({...}).
//
//   launch({
//     brand: { name: 'Clipwalk', site: 'clipwalk.app' },    colours come from film.json "brand" (green, deep, gold, cream)
//     shots: [
//       { type: 'logo', t: 0, d: 1.6 },
//       { type: 'words', t: 1.6, d: 2, text: 'Your launch video takes', accent: 'minutes' },
//       { type: 'screen', t: 3.6, d: 2.4, img: 's1', device: 'phone' | 'laptop', label: 'Pricing', zoom: [x, y, w, h] },
//       { type: 'big', t: 6, d: 1.6, text: 'Simple.' },
//       { type: 'end', t: 7.6, d: 2.4, line: 'Your app, on video.' },
//     ],
//     screens: { s1: 'assets/screens/01.jpg' },   bg: 'assets/photos/bg'  (optional photo: bg-9x16.jpg / bg-16x9.jpg)
//     hits: [...]   (tools/sfx.mjs)
//   })
// Every shot ends with a whip into the next; times are seconds (beats.json period 1).
import * as M from '/kit/motion.js';
import { phone3d } from '/kit/phone3d.js';

const { W, H, FORMAT, E, prog, lerp, clamp, springU, SPRING, font, rrect, cover, hexRgb, mix } = M;
const FILM = await fetch('film.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
const C = { green: '#1f3a5f', deep: '#0f1b2d', cream: '#f7f7f4', gold: '#f5a524', ...(FILM.brand || {}) };
const P = FORMAT.portrait, S = Math.min(W, H) / 1080;   // S: type scale, 1 at 1080
const SANS = 'UI', DISPLAY = 'Display';
const rgba = (hex, a) => { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; };
const lum = (hex) => { const [r, g, b] = hexRgb(hex); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
const WHIP = 0.28;   // seconds of whip at each cut

export function launch(cfg) {
  const shots = cfg.shots, end = shots.at(-1).t + shots.at(-1).d;
  const shotAt = (u) => { let i = 0; shots.forEach((s, k) => { if (u >= s.t) i = k; }); return i; };
  const ink = lum(C.deep) < 0.5 ? '#ffffff' : '#111111';
  let P3 = null, grain = null;

  // background: a slow mesh of brand colours with film grain, or a photo with a slow push
  function background(ctx, u, IMG, tone) {
    if (IMG.bg && tone !== 'light') {
      cover(ctx, IMG.bg, 0, 0, W, H, { zoom: 1.08 + 0.04 * Math.sin(u * 0.2), fx: 0.5 + 0.05 * Math.sin(u * 0.13) });
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, 0, W, H);
    } else if (tone === 'light') {
      ctx.fillStyle = mix(C.cream, '#ffffff', 0.5); ctx.fillRect(0, 0, W, H);
      blob(ctx, W * (0.15 + 0.05 * Math.sin(u * 0.3)), H * 1.05, Math.max(W, H) * 0.7, C.gold, 0.35);
      blob(ctx, W * (0.85 + 0.05 * Math.cos(u * 0.25)), H * 1.1, Math.max(W, H) * 0.7, C.green, 0.45);
    } else {
      ctx.fillStyle = C.deep; ctx.fillRect(0, 0, W, H);
      blob(ctx, W * (0.2 + 0.08 * Math.sin(u * 0.31)), H * (0.25 + 0.06 * Math.cos(u * 0.27)), Math.max(W, H) * 0.75, C.green, 0.95);
      blob(ctx, W * (0.85 + 0.06 * Math.cos(u * 0.22)), H * (0.8 + 0.05 * Math.sin(u * 0.35)), Math.max(W, H) * 0.65, C.gold, 0.55);
      blob(ctx, W * (0.6 + 0.1 * Math.sin(u * 0.17)), H * (0.1), Math.max(W, H) * 0.5, mix(C.green, '#ffffff', 0.35), 0.35);
    }
    if (grain) { ctx.save(); ctx.globalAlpha = 0.06; ctx.globalCompositeOperation = 'overlay'; ctx.drawImage(grain, (u * 997) % 64 - 64, (u * 613) % 64 - 64); ctx.restore(); }
  }
  function blob(ctx, x, y, r, color, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // words that rise in one by one, slightly blurred until they land; one accent word in the highlight colour
  function words(ctx, u, t0, str, { size, y, color, accent, align = 'center', maxW = W * 0.84, maxLines = 3 }) {
    // shrink until the line fits in maxLines (long product descriptions shouldn't become a wall of text)
    for (let n = 0; n < 8; n++) {
      ctx.font = font(size, 600, SANS);
      let lines = 1, lw = 0;
      for (const w of str.split(' ')) { const ww = ctx.measureText(w + ' ').width; if (lw + ww > maxW && lw) { lines++; lw = 0; } lw += ww; }
      if (lines <= maxLines) break;
      size *= 0.88;
    }
    ctx.font = font(size, 600, SANS);
    const ws = str.split(' '), lines = [[]]; let lw = 0;
    for (const w of ws) { const ww = ctx.measureText(w + ' ').width; if (lw + ww > maxW && lines.at(-1).length) { lines.push([]); lw = 0; } lines.at(-1).push(w); lw += ww; }
    let n = 0;
    lines.forEach((ln, li) => {
      const full = ctx.measureText(ln.join(' ')).width;
      let x = align === 'center' ? W / 2 - full / 2 : W * 0.08;
      for (const w of ln) {
        const k = springU(u, t0 + n * 0.07, SPRING.gentle), ww = ctx.measureText(w).width;
        if (k > 0) {
          ctx.save(); ctx.globalAlpha = clamp(k * 1.4);
          if (k < 0.98) ctx.filter = `blur(${(1 - clamp(k)) * 14 * S}px)`;
          const norm = (x) => String(x).replace(/[^\w]/g, '').toLowerCase(), isAccent = accent && norm(w) === norm(accent);
          ctx.fillStyle = isAccent ? C.gold : color;
          ctx.fillText(w, x, y + li * size * 1.12 + (1 - k) * size * 0.6);
          ctx.restore();
        }
        x += ww + ctx.measureText(' ').width; n++;
      }
    });
    return lines.length;
  }
  // a big hero word filled with a brand gradient, landing from slightly larger
  function bigWord(ctx, u, t0, str) {
    const k = springU(u, t0, SPRING.snappy), size = (P ? 300 : 340) * S * (str.length > 8 ? 8 / str.length : 1);
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(1.12 - 0.12 * k, 1.12 - 0.12 * k);
    ctx.globalAlpha = clamp(k * 1.5); if (k < 0.97) ctx.filter = `blur(${(1 - k) * 24 * S}px)`;
    ctx.font = font(size, 700, SANS); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const g = ctx.createLinearGradient(-W * 0.35, 0, W * 0.35, 0);
    g.addColorStop(0, mix(C.gold, '#ffffff', 0.15)); g.addColorStop(0.55, C.gold); g.addColorStop(1, mix(C.green, '#ffffff', 0.4));
    ctx.fillStyle = g; ctx.fillText(str, 0, 0);
    ctx.restore();
  }
  // an app window floating in space: soft shadow, a slight tilt, a slow push; then a zoom-in on one control
  function windowCard(ctx, u, s, IMG) {
    const img = IMG[s.img]; if (!img) return;
    const k = springU(u, s.t, SPRING.gentle), lt = u - s.t;
    const iw = img.naturalWidth, ih = img.naturalHeight, wide = iw > ih * 1.2, maxW = W * (P ? (wide ? 1.7 : 0.9) : 0.64), maxH = H * (P ? (wide ? 0.42 : 0.48) : 0.62);
    const sc = Math.min(maxW / iw, maxH / ih), w = iw * sc, h = ih * sc, bar = 34 * S;
    // the camera keeps moving while a screen holds: a slow push and a drift; on a phone a wide website pans across,
    // larger than the frame, so it stays readable
    const pan = P && wide ? lerp((w - W) / 2 + W * 0.04, -(w - W) / 2 - W * 0.04, E.inOutSine ? E.inOutSine(prog(u, s.t, s.t + s.d)) : prog(u, s.t, s.t + s.d)) : 0;
    const push = 1 + 0.06 * lt, x = W / 2 - w / 2 - lt * W * 0.008 + pan, y = (P ? H * 0.55 : H * 0.57) - (h + bar) / 2;
    ctx.save();
    ctx.translate(W / 2, y + (h + bar) / 2); ctx.scale(push * (0.86 + 0.14 * k), push * (0.86 + 0.14 * k)); ctx.translate(-W / 2, -(y + (h + bar) / 2));
    ctx.transform(1, (1 - k) * 0.06 - 0.012, 0, 1, 0, (1 - k) * H * 0.12);
    ctx.globalAlpha = clamp(k * 1.6);
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 90 * S; ctx.shadowOffsetY = 40 * S;
    rrect(ctx, x, y, w, h + bar, 18 * S); ctx.fillStyle = '#f4f4f5'; ctx.fill(); ctx.shadowColor = 'transparent';
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { ctx.beginPath(); ctx.arc(x + 22 * S + i * 20 * S, y + bar / 2, 6 * S, 0, M.TAU); ctx.fillStyle = c; ctx.fill(); });
    ctx.save(); rrect(ctx, x, y + bar, w, h, 0); ctx.clip(); ctx.drawImage(img, x, y + bar, w, h); ctx.restore();
    ctx.restore();
    if (s.zoom) callout(ctx, u, s, img, { x, y: y + bar, w, h, sc });
  }
  // the control that matters, lifted off the screen and enlarged, with a highlight ring
  function callout(ctx, u, s, img, box) {
    const a = s.zat ?? s.t + s.d * 0.42, k = springU(u, a, SPRING.bouncy); if (k <= 0) return;
    const [zx, zy, zw, zh] = s.zoom, pad = 14, srcW = img.naturalWidth / (box.w / box.sc / box.sc) || 1;
    const fx = box.x + (zx + zw / 2) * box.sc, fy = box.y + (zy + zh / 2) * box.sc;
    const big = Math.min((P ? W * 0.84 : W * 0.5) / (zw + pad * 2), (P ? H * 0.3 : H * 0.42) / (zh + pad * 2), 4.5), cw = (zw + pad * 2) * big, ch = (zh + pad * 2) * big;
    const tx = lerp(fx, W / 2, k), ty = lerp(fy, P ? H * 0.55 : H * 0.58, k), sk = lerp(box.sc / big, 1, k);
    ctx.save(); ctx.translate(tx, ty); ctx.scale(sk, sk);
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 70 * S; ctx.shadowOffsetY = 30 * S;
    rrect(ctx, -cw / 2, -ch / 2, cw, ch, 22 * S); ctx.fillStyle = '#fff'; ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.save(); rrect(ctx, -cw / 2, -ch / 2, cw, ch, 22 * S); ctx.clip();
    ctx.drawImage(img, zx - pad, zy - pad, zw + pad * 2, zh + pad * 2, -cw / 2, -ch / 2, cw, ch); ctx.restore();
    ctx.lineWidth = 6 * S; ctx.strokeStyle = C.gold; rrect(ctx, -cw / 2 - 8 * S, -ch / 2 - 8 * S, cw + 16 * S, ch + 16 * S, 28 * S); ctx.globalAlpha = clamp(k); ctx.stroke();
    ctx.restore();
  }
  // a phone screen: the real 3D phone, turning as it lands
  function phoneShot(ctx, u, s, IMG) {
    const img = IMG[s.img]; if (!img) return;
    const k = springU(u, s.t, SPRING.gentle), lt = u - s.t;
    if (P3) {
      const sc = P3.screen.getContext('2d'), I3 = P3.inset;
      sc.fillStyle = '#050605'; sc.fillRect(0, 0, P3.screen.width, P3.screen.height);
      sc.save(); rrect(sc, I3.x, I3.y, I3.w, I3.h, I3.w * 0.11); sc.clip(); sc.drawImage(img, I3.x, I3.y, I3.w, I3.h); sc.restore();
      const gh = H * (P ? 0.62 : 0.84), gw = gh * P3.screen.width / P3.screen.height;
      const cx = P ? W / 2 : W * 0.5, cy = (P ? H * 0.47 : H / 2) + (1 - k) * H * 0.5;
      const gl = P3.draw({ x: cx - gw / 2, y: cy - gh / 2, w: gw, h: gh }, { yaw: (1 - k) * 0.9 + 0.22 * Math.sin(lt * 0.9 + 0.6) - 0.1, pitch: 0.06 + (1 - k) * 0.2 });
      ctx.save(); ctx.globalAlpha = clamp(k * 2); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 80 * S; ctx.shadowOffsetY = 40 * S; ctx.drawImage(gl, 0, 0); ctx.restore();
    } else {
      const gh = H * (P ? 0.6 : 0.8), gw = gh * img.naturalWidth / img.naturalHeight, x = W / 2 - gw / 2, y = H / 2 - gh / 2 + (1 - k) * H * 0.5;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 80 * S; rrect(ctx, x - 14 * S, y - 14 * S, gw + 28 * S, gh + 28 * S, 60 * S); ctx.fillStyle = '#0b0b0c'; ctx.fill(); ctx.restore();
      ctx.save(); rrect(ctx, x, y, gw, gh, 48 * S); ctx.clip(); ctx.drawImage(img, x, y, gw, gh); ctx.restore();
    }
  }
  function label(ctx, u, s) {
    if (!s.label) return;
    const y = P ? H * 0.2 : H * 0.135;   // above the window (9:16: below the top 250 px the apps cover)
    words(ctx, u, s.t + 0.15, s.label, { size: (P ? 92 : 68) * S, y, color: ink === '#ffffff' ? '#fff' : '#111', accent: s.accent });
  }
  function logoMark(ctx, u, t0, IMG, size, cx, cy) {
    const k = springU(u, t0, SPRING.bouncy); if (k <= 0) return;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.rotate((1 - k) * -0.5);
    if (IMG.logo) {
      ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 40 * S; rrect(ctx, -size / 2, -size / 2, size, size, size * 0.24); ctx.fillStyle = '#fff'; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.save(); rrect(ctx, -size / 2, -size / 2, size, size, size * 0.24); ctx.clip(); ctx.drawImage(IMG.logo, -size * 0.38, -size * 0.38, size * 0.76, size * 0.76); ctx.restore();
    } else {
      rrect(ctx, -size / 2, -size / 2, size, size, size * 0.24); ctx.fillStyle = C.gold; ctx.fill();
      ctx.fillStyle = C.deep; ctx.font = font(size * 0.55, 700, SANS); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((cfg.brand.name || '?')[0], 0, size * 0.03);
    }
    ctx.restore();
  }

  function drawShot(ctx, u, s, IMG) {
    const lt = u - s.t;
    if (s.type === 'logo') {
      background(ctx, u, IMG, 'light');
      const size = 150 * S, k = springU(u, s.t + 0.45, SPRING.gentle), name = cfg.brand.name || '';
      ctx.font = font(110 * S, 700, SANS); const nw = ctx.measureText(name).width;
      const total = size + 30 * S + nw, x0 = W / 2 - lerp(size / 2, total / 2, k);
      logoMark(ctx, u, s.t, IMG, size, x0 + size / 2, H / 2);
      ctx.save(); ctx.beginPath(); ctx.rect(x0 + size + 20 * S, 0, W, H); ctx.clip();
      ctx.globalAlpha = clamp(k * 1.5); ctx.fillStyle = '#111'; ctx.textBaseline = 'middle'; ctx.fillText(name, x0 + size + 30 * S - (1 - k) * 80 * S, H / 2 + 4 * S); ctx.restore();
    } else if (s.type === 'words') {
      background(ctx, u, IMG, 'light');
      words(ctx, u, s.t + 0.05, s.text, { size: (P ? 120 : 110) * S, y: H / 2, color: '#111', accent: s.accent });
    } else if (s.type === 'big') {
      background(ctx, u, IMG, 'dark');
      bigWord(ctx, u, s.t + 0.05, s.text);
    } else if (s.type === 'screen') {
      background(ctx, u, IMG, 'dark');
      label(ctx, u, s);
      if (s.device === 'phone') phoneShot(ctx, u, s, IMG); else windowCard(ctx, u, s, IMG);
    } else if (s.type === 'end') {
      background(ctx, u, IMG, 'light');
      const ls = (P ? 80 : 70) * S, y0 = H * 0.4 + 170 * S;
      logoMark(ctx, u, s.t + 0.1, IMG, 170 * S, W / 2, H * 0.4);
      const n = words(ctx, u, s.t + 0.35, s.line || cfg.brand.name || '', { size: ls, y: y0, color: '#111', maxW: W * (P ? 0.84 : 0.62) });
      if (cfg.brand.site) words(ctx, u, s.t + 0.7, cfg.brand.site, { size: 40 * S, y: y0 + (n - 1) * ls * 1.12 + 80 * S, color: '#666' });
    }
  }

  const images = { ...cfg.screens };
  if (cfg.logo !== false) images.logo = typeof cfg.logo === 'string' ? cfg.logo : 'assets/logo.svg';
  if (cfg.bg) images.bg = `${cfg.bg}-${P ? '9x16' : '16x9'}.jpg`;
  M.film({
    fonts: [font(100, 600, SANS), font(100, 700, SANS), font(100, 400, DISPLAY)], images, hits: cfg.hits || [],
    init: async () => {
      if (shots.some((s) => s.device === 'phone') && FILM.phone3d !== false) P3 = await phone3d(W, H);
      grain = document.createElement('canvas'); grain.width = grain.height = Math.round(W + 128);   // fixed seed: the same grain every render
      const g = grain.getContext('2d'), d = g.createImageData(grain.width, grain.height), rnd = M.mulberry32(7);
      for (let i = 0; i < d.data.length; i += 4) { const v = rnd() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
      g.putImageData(d, 0, 0);
    },
    draw(ctx, u, t, IMG) {
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      const i = shotAt(u), s = shots[i], next = shots[i + 1];
      const out = next ? E.inCubic(prog(u, next.t - WHIP, next.t)) : 0, inn = i ? 1 - E.outCubic(prog(u, s.t, s.t + WHIP)) : 0;
      // whip: the shot leaves left at speed (the motion blur smears it), the next arrives from the right
      ctx.save(); ctx.translate(-out * W * 1.1 + inn * W * 0.9, 0); drawShot(ctx, u, s, IMG); ctx.restore();
      if (out > 0 && next) { ctx.save(); ctx.translate((1 - out) * W * 0.9, 0); drawShot(ctx, Math.max(u, next.t), next, IMG); ctx.restore(); }
      if (u > end - 0.3) { ctx.fillStyle = `rgba(0,0,0,${E.inCubic(prog(u, end - 0.3, end))})`; ctx.fillRect(0, 0, W, H); }
    },
  });
}
