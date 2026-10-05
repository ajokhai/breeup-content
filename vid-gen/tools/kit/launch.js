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
//       { type: 'cards', t: 6, d: 2.9, cards: [{ img: 's1c1', radius: 24 }, ...], focus: 1, beat: 0.48, label: 'Plans' },
//       { type: 'stat', t: 9, d: 1.9, num: { prefix: '$', value: 10, decimals: 0, comma: false, suffix: '', unit: 'per user/month' }, label: 'Basic', land: 0.97 },
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
const SANS = 'UI', DISPLAY = 'Display', BRAND = FILM.brandFont ? 'Brand' : SANS;   // Brand: the site's own typeface (fonts/brand.woff2), when it was free to download
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
    const fit = (W * 0.86) / ctx.measureText(str).width; if (fit < 1) ctx.font = font(size * fit, 700, SANS);   // measured, never clipped
    const g = ctx.createLinearGradient(-W * 0.35, 0, W * 0.35, 0);
    // mostly white, warming into the accent: it has to read on the brand's own colour
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, mix(C.gold, '#ffffff', 0.55)); g.addColorStop(1, mix(C.gold, '#ffffff', 0.2));
    ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 40 * S; ctx.shadowOffsetY = 10 * S;
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
    const a = s.zat ?? s.t + s.d * 0.42, k = springU(u, a, SPRING.firm); if (k <= 0) return;
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
  // the logo on a tile: kept in proportion, on a dark tile if the logo itself is light (a white mark on white vanishes)
  let logoLight = false;
  function logoMark(ctx, u, t0, IMG, size, cx, cy) {
    const k = springU(u, t0, SPRING.firm); if (k <= 0) return;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.rotate((1 - k) * -0.5);
    if (IMG.logo && !cfg.wordmark) {
      ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 40 * S; rrect(ctx, -size / 2, -size / 2, size, size, size * 0.24); ctx.fillStyle = logoLight ? '#111214' : '#fff'; ctx.fill(); ctx.shadowColor = 'transparent';
      const L = IMG.logo, ar = (L.naturalWidth || 1) / (L.naturalHeight || 1), lw = ar >= 1 ? size * 0.7 : size * 0.7 * ar, lh = ar >= 1 ? size * 0.7 / ar : size * 0.7;
      ctx.drawImage(L, -lw / 2, -lh / 2, lw, lh);
    } else {
      rrect(ctx, -size / 2, -size / 2, size, size, size * 0.24); ctx.fillStyle = C.gold; ctx.fill();
      ctx.fillStyle = C.deep; ctx.font = font(size * 0.55, 700, SANS); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((cfg.brand.name || '?')[0], 0, size * 0.03);
    }
    ctx.restore();
  }
  // a wordmark (logo that already spells the name): shown on its own, big, on a background it reads on
  function wordmark(ctx, u, t0, IMG, cx, cy, maxW, maxH) {
    const k = springU(u, t0, SPRING.gentle); if (k <= 0 || !IMG.logo) return;
    const L = IMG.logo, ar = (L.naturalWidth || 1) / (L.naturalHeight || 1), w = Math.min(maxW, maxH * ar), h = w / ar;
    ctx.save(); ctx.globalAlpha = clamp(k * 1.5); if (k < 0.97) ctx.filter = `blur(${(1 - k) * 18 * S}px)`;
    ctx.translate(cx, cy + (1 - k) * 40 * S); ctx.drawImage(L, -w / 2, -h / 2, w, h); ctx.restore();
  }
  // a card rebuilt from the site's own HTML (walk.mjs): its text in the brand's font, its icons as SVG, drawn sharp at any
  // size. Lines arrive one after another, the price counts up, the features tick in.
  const ICONS = {};
  // cards cropped tight to their first line get breathing room above and below (once per card)
  function padCard(L) {
    if (L._pad) return L; L._pad = true;
    const top = Math.min(...L.parts.map((p) => p.y)), add = Math.max(0, 24 - top);
    if (add) { L.parts.forEach((p) => { p.y += add; }); L.h += add; }
    const bottom = Math.max(...L.parts.map((p) => p.y + p.h)); if (L.h - bottom < 20) L.h = bottom + 20;
    return L;
  }
  function liveCard(ctx, u, t0, L, cw, ch, { dim = 1 } = {}) {
    const k = cw / L.w, r = Math.max(14 * S, Math.min(40 * S, (L.radius || 12) * k));
    ctx.save();
    rrect(ctx, -cw / 2, -ch / 2, cw, ch, r); ctx.fillStyle = L.bg || '#111'; ctx.fill();
    ctx.lineWidth = 2 * S; ctx.strokeStyle = L.border || 'rgba(255,255,255,0.14)'; ctx.stroke();
    rrect(ctx, -cw / 2, -ch / 2, cw, ch, r); ctx.clip();
    ctx.translate(-cw / 2, -ch / 2);
    const rows = [...new Set(L.parts.map((p) => Math.round(p.y / 6)))].sort((a, b) => a - b);   // reading order by row
    for (const p of L.parts) {
      const row = rows.indexOf(Math.round(p.y / 6)), a = springU(u, t0 + 0.12 + row * 0.07, SPRING.gentle); if (a <= 0) continue;
      ctx.save(); ctx.globalAlpha = clamp(a * 1.6) * dim; ctx.translate(0, (1 - a) * 14 * k);
      if (p.kind === 'icon') { const im = ICONS[p.icon]; if (im) ctx.drawImage(im, p.x * k, p.y * k, p.w * k, p.h * k); }
      else if (p.kind === 'switch') {
        const x = p.x * k, y = p.y * k, w = p.w * k, h = p.h * k; rrect(ctx, x, y, w, h, h / 2); ctx.fillStyle = p.on ? p.color : 'rgba(255,255,255,0.2)'; ctx.fill();
        ctx.beginPath(); ctx.arc(p.on ? x + w - h / 2 : x + h / 2, y + h / 2, h * 0.38, 0, M.TAU); ctx.fillStyle = '#fff'; ctx.fill();
      } else {
        let str = p.text;
        if (p.kind === 'price') {   // count up to the price, keeping its symbol and unit
          const m = /^([^\d\s-]{0,4}\s?)(\d[\d,]*(?:\.\d+)?)(.*)$/.exec(str);
          if (m) { const v = Number(m[2].replace(/,/g, '')), q = E.outCubic(prog(u, t0 + 0.25, t0 + 1.1)), dec = (m[2].split('.')[1] || '').length;
            str = `${m[1]}${m[2].includes(',') ? Math.round(v * q).toLocaleString('en-US') : (v * q).toFixed(dec)}${m[3]}`; }
        }
        ctx.font = font(p.size * k, p.weight || 400, BRAND); ctx.fillStyle = p.color || '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        ctx.fillText(str, p.x * k, (p.y + p.h / 2) * k, Math.max(p.w * k * 1.15, (L.w - p.x - 8) * k));
      }
      ctx.restore();
    }
    ctx.restore();
  }
  // UI cut-outs from the capture (cards: pricing tiers, features). They rise in one per half beat, then the one that
  // matters steps forward with a highlight while the others dim. Portrait: a fan, the focus card in front.
  function cardsShot(ctx, u, s, IMG) {
    const cards = s.cards.map((c) => ({ ...c, im: IMG[c.img], live: c.live && padCard(c.live) })).filter((c) => c.im || c.live), n = cards.length; if (!n) return;
    const beat = s.beat || 0.5, lt = u - s.t, fk = springU(u, s.t + 3 * beat, SPRING.snappy);
    const top = P ? H * 0.3 : H * 0.24, availH = P ? H * 0.5 : H * 0.62, availW = P ? W * 0.74 : W * 0.86;
    // one size for every card, so the set reads as a row of equals
    const ar = Math.max(...cards.map((c) => (c.live ? c.live.h / c.live.w : c.im.naturalHeight / c.im.naturalWidth)));
    let cw = P ? (n > 1 ? W * 0.58 : availW) : Math.min(availW / n - 30 * S, W * 0.3), ch = cw * ar;
    if (ch > availH) { ch = availH; cw = ch / ar; }
    const order = cards.map((c, k) => k).sort((a, b) => (a === s.focus) - (b === s.focus));   // focus drawn last (in front)
    for (const k of order) {
      const c = cards[k], kin = springU(u, s.t + 0.08 + k * beat * 0.5, SPRING.gentle); if (kin <= 0) continue;
      const focus = k === s.focus && n > 1, off = k - (n - 1) / 2;
      // portrait: a fan wide enough that the side cards show a third of themselves either side of the front one
      let x = P ? W / 2 + off * W * 0.27 : W / 2 + off * (cw + 30 * S), y = top + availH / 2 + (P ? Math.abs(off) * H * 0.02 : 0), rot = P ? off * 0.1 : 0, sc = P && !focus ? 0.84 : 1;
      if (focus) { sc *= 1 + 0.08 * fk; y -= 18 * S * fk; if (P) { x = lerp(x, W / 2, fk); rot = lerp(rot, 0, fk); } }
      const dim = n > 1 && !focus ? 1 - 0.45 * fk : 1, drift = Math.sin(lt * 0.8 + k) * 6 * S;
      ctx.save(); ctx.translate(x, y + (1 - kin) * H * 0.35 + drift); ctx.rotate(rot + (1 - kin) * 0.25 * (off || 1)); ctx.scale(sc * (0.85 + 0.15 * kin), sc * (0.85 + 0.15 * kin));
      ctx.globalAlpha = clamp(kin * 1.8);
      if (c.live) {   // rebuilt from the page: sharp, and each line animates
        ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 80 * S; ctx.shadowOffsetY = 34 * S; rrect(ctx, -cw / 2, -ch / 2, cw, ch, 20 * S); ctx.fillStyle = c.live.bg || '#111'; ctx.fill(); ctx.shadowColor = 'transparent';
        liveCard(ctx, u, s.t + 0.08 + k * beat * 0.5, c.live, cw, ch, { dim });
        if (focus && fk > 0) { ctx.globalAlpha = clamp(fk); ctx.lineWidth = 6 * S; ctx.strokeStyle = C.gold; rrect(ctx, -cw / 2 - 9 * S, -ch / 2 - 9 * S, cw + 18 * S, ch + 18 * S, 29 * S); ctx.stroke(); }
        ctx.restore(); continue;
      }
      const r = Math.max(16 * S, Math.min(40 * S, (c.radius || 0) * cw / c.im.naturalWidth));
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 80 * S; ctx.shadowOffsetY = 34 * S;
      rrect(ctx, -cw / 2, -ch / 2, cw, ch, r); ctx.fillStyle = '#111'; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.save(); rrect(ctx, -cw / 2, -ch / 2, cw, ch, r); ctx.clip(); ctx.drawImage(c.im, -cw / 2, -ch / 2, cw, ch);
      if (dim < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - dim})`; ctx.fillRect(-cw / 2, -ch / 2, cw, ch); }
      ctx.restore();
      ctx.lineWidth = 2 * S; ctx.strokeStyle = 'rgba(255,255,255,0.16)'; rrect(ctx, -cw / 2, -ch / 2, cw, ch, r); ctx.stroke();
      if (focus && fk > 0) { ctx.globalAlpha = clamp(fk); ctx.lineWidth = 6 * S; ctx.strokeStyle = C.gold; rrect(ctx, -cw / 2 - 9 * S, -ch / 2 - 9 * S, cw + 18 * S, ch + 18 * S, r + 9 * S); ctx.stroke(); }
      ctx.restore();
    }
  }
  // a number from the app (a price, a stat) counting up and landing on the beat, its name above and its unit below
  function statShot(ctx, u, s) {
    const nm = s.num, land = s.land || 1, p = E.outCubic ? E.outCubic(prog(u, s.t + 0.15, s.t + land)) : prog(u, s.t + 0.15, s.t + land);
    const v = nm.value * p, txt = nm.value === 0 ? 'Free' : `${nm.prefix || ''}${nm.comma ? Math.round(v).toLocaleString('en-US') : v.toFixed(nm.decimals || 0)}${nm.suffix || ''}`;
    if (s.label) words(ctx, u, s.t + 0.05, s.label, { size: (P ? 84 : 70) * S, y: P ? H * 0.32 : H * 0.24, color: 'rgba(255,255,255,0.75)' });
    const kl = springU(u, s.t + land, SPRING.firm), pulse = 1 + 0.06 * Math.max(0, 1 - Math.abs(kl - 1) * 4) * (u > s.t + land ? 1 : 0);
    let size = (P ? 330 : 300) * S; ctx.font = font(size, 700, SANS);
    const full = `${nm.prefix || ''}${nm.comma ? Math.round(nm.value).toLocaleString('en-US') : nm.value.toFixed(nm.decimals || 0)}${nm.suffix || ''}`;
    const wMax = W * 0.86, fw = ctx.measureText(full).width; if (fw > wMax) { size *= wMax / fw; ctx.font = font(size, 700, SANS); }
    ctx.save(); ctx.translate(W / 2, P ? H * 0.5 : H * 0.52); ctx.scale(pulse, pulse);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const g = ctx.createLinearGradient(-W * 0.3, 0, W * 0.3, 0);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, mix(C.gold, '#ffffff', 0.55)); g.addColorStop(1, mix(C.gold, '#ffffff', 0.25));
    ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 40 * S; ctx.shadowOffsetY = 10 * S;
    ctx.globalAlpha = clamp((u - s.t) * 6); ctx.fillStyle = g; ctx.fillText(txt, 0, 0);
    ctx.restore();
    if (nm.unit) words(ctx, u, s.t + land * 0.7, nm.unit, { size: (P ? 64 : 54) * S, y: (P ? H * 0.5 : H * 0.52) + size * 0.62, color: 'rgba(255,255,255,0.7)' });
  }

  function drawShot(ctx, u, s, IMG) {
    const lt = u - s.t;
    // never a frozen frame: type and logo shots keep a slow push after they land (screens and cards drift on their own)
    if (['logo', 'words', 'big', 'end'].includes(s.type)) { const pz = 1 + (s.type === 'big' ? 0.03 : 0.018) * lt; ctx.translate(W / 2, H / 2); ctx.scale(pz, pz); ctx.translate(-W / 2, -H / 2); }
    if (s.type === 'logo') {
      background(ctx, u, IMG, 'light');
      if (cfg.wordmark && IMG.logo) { if (logoLight) background(ctx, u, IMG, 'dark'); wordmark(ctx, u, s.t + 0.1, IMG, W / 2, H / 2, W * (P ? 0.7 : 0.42), H * 0.16); return; }
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
    } else if (s.type === 'cards') {
      background(ctx, u, IMG, 'dark');
      label(ctx, u, s);
      cardsShot(ctx, u, s, IMG);
    } else if (s.type === 'stat') {
      background(ctx, u, IMG, 'dark');
      statShot(ctx, u, s);
    } else if (s.type === 'end') {
      background(ctx, u, IMG, 'light');
      const ls = (P ? 80 : 70) * S, y0 = H * 0.4 + 170 * S;
      const dark = cfg.wordmark && logoLight; if (dark) background(ctx, u, IMG, 'dark');
      if (cfg.wordmark && IMG.logo) wordmark(ctx, u, s.t + 0.1, IMG, W / 2, H * 0.4, W * (P ? 0.6 : 0.34), H * 0.12); else logoMark(ctx, u, s.t + 0.1, IMG, 170 * S, W / 2, H * 0.4);
      const n = words(ctx, u, s.t + 0.35, s.line || cfg.brand.name || '', { size: ls, y: y0, color: dark ? '#fff' : '#111', maxW: W * (P ? 0.84 : 0.62) });
      if (cfg.brand.site) words(ctx, u, s.t + 0.7, cfg.brand.site, { size: 40 * S, y: y0 + (n - 1) * ls * 1.12 + 80 * S, color: dark ? 'rgba(255,255,255,0.6)' : '#666' });
    }
  }

  const images = { ...cfg.screens };
  if (cfg.logo !== false) images.logo = typeof cfg.logo === 'string' ? cfg.logo : 'assets/logo.svg';
  if (cfg.bg) images.bg = `${cfg.bg}-${P ? '9x16' : '16x9'}.jpg`;
  M.film({
    fonts: [font(100, 600, SANS), font(100, 700, SANS), font(100, 400, DISPLAY), ...(BRAND !== SANS ? [font(100, 400, BRAND), font(100, 600, BRAND)] : [])], images, hits: cfg.hits || [],
    init: async () => {
      // the rebuilt cards' icons: SVG text from the page, decoded once
      const svgs = {}; for (const sh of shots) for (const c of sh.cards || []) Object.assign(svgs, c.live?.icons || {});
      await Promise.all(Object.entries(svgs).map(async ([k, svg]) => { const im = new Image(); im.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; try { await im.decode(); ICONS[k] = im; } catch {} }));
      // is the logo light? (then it goes on a dark tile / background)
      try { const im = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = images.logo; }); const c = document.createElement('canvas'); c.width = c.height = 48; const g = c.getContext('2d'); g.drawImage(im, 0, 0, 48, 48 * im.naturalHeight / im.naturalWidth || 48); const d = g.getImageData(0, 0, 48, 48).data; let sum = 0, n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++; } logoLight = n > 0 && sum / n > 190; } catch {}
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
      // beat punches: the camera breathes with the music (a hair on every beat, more on bars after the drop)
      const sc = FILM.score; let punch = 1;
      if (sc?.bpm && u >= (sc.groove ?? 0) && u < (sc.end ?? end)) {
        const b = 60 / sc.bpm, since = (u - (sc.groove ?? 0)) % b, bar = (u - (sc.groove ?? 0)) % (4 * b), after = sc.drop != null && u >= sc.drop;
        punch = 1 + 0.012 * Math.exp(-since / 0.11) + (after ? 0.03 * Math.exp(-bar / 0.18) : 0);
      }
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(punch, punch); ctx.translate(-W / 2, -H / 2);
      ctx.translate(-out * W * 1.1 + inn * W * 0.9, 0); drawShot(ctx, u, s, IMG); ctx.restore();
      if (out > 0 && next) { ctx.save(); ctx.translate((1 - out) * W * 0.9, 0); drawShot(ctx, Math.max(u, next.t), next, IMG); ctx.restore(); }
      if (u > end - 0.3) { ctx.fillStyle = `rgba(0,0,0,${E.inCubic(prog(u, end - 0.3, end))})`; ctx.fillRect(0, 0, W, H); }
    },
  });
}
