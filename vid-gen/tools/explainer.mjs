#!/usr/bin/env node
// Explainers (E-series) are voice-first: write docs/vo/lines.txt and docs/scenes.json, run
// `node tools/make.mjs films/<film> --only images,vo,music`, then this, which writes film.js on the ad kit with
// each scene starting where its voice line starts (and the end card after the last line). Then sfx, mix, render.
//
//   node tools/explainer.mjs films/E1-whatsapp-group
//
// docs/scenes.json: [{ "line": 1, "kind": "photo", "src": "group", "caption": "..." },
//                    { "line": 3, "kind": "screen", "device": "laptop", "src": "assets/screens/x.jpg",
//                      "crop": [x, y, w, h], "zoom": [fx, fy, z], "ring": [x, y, w, h] , "caption": "..." },
//                    { "line": 5, "kind": "type", "lines": ["...", "..."], "gold": 1, "caption": "..." }]
// "line" is the 1-based voice line the scene starts on; "at": 0.5 starts it that far into the line instead.
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.argv[2] || '');
const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'film.json'), 'utf8'));
const scenes = JSON.parse(fs.readFileSync(path.join(dir, 'docs', 'scenes.json'), 'utf8'));
if (!cfg.vo?.length) { console.error('No voice yet: run make.mjs --only vo first'); process.exit(1); }
const r2 = (x) => Math.round(x * 100) / 100;
const vo = cfg.vo.map(([t, , , d]) => [t, t + d]);
const lastEnd = vo.at(-1)[1];
const endT = r2(lastEnd + 0.8);
cfg.duration = r2(endT + 3.2);
fs.writeFileSync(path.join(dir, 'film.json'), JSON.stringify(cfg, null, 1) + '\n');

const out = [], hits = [[0, 'open', 'sub', { len: 0.7 }]];
scenes.forEach((s, i) => {
  const [a] = vo[s.line - 1];
  const t = i === 0 ? 0 : r2(a + (s.at || 0) * (vo[s.line - 1][1] - a));
  const nextLine = scenes[i + 1] ? vo[scenes[i + 1].line - 1][0] : endT;
  const sc = { t, kind: s.kind };
  if (s.src) sc.src = s.src;
  if (s.kind === 'screen') {
    Object.assign(sc, { device: s.device || 'phone', bg: s.bg || scenes[0].src });
    if (s.crop) sc.crop = s.crop;
    const [fx, fy, z] = s.zoom || [0.5, 0.5, 1.3];
    sc.cam = [[t, [1, 0.5, 0.5]], [r2(t + 0.6), [z, fx, fy]]];
    if (s.ring) { sc.rings = [{ r: s.ring, a: r2(t + 1.2), b: r2(nextLine - 0.4) }]; hits.push([r2(t + 1.2), 'ring', 'blip', { pitch: 'C6' }]); }
  }
  if (s.kind === 'type') { Object.assign(sc, { lines: s.lines, gold: s.gold ?? 1, bg: s.bg || scenes[0].src }); hits.push([r2(t + 0.15), 'type', 'pop', { pitch: 'A5' }]); }
  if (s.caption && i > 0) sc.caption = s.caption;
  if (i > 0) hits.push([t, 'whip', 'whoosh', { len: 0.35, from: i % 2 ? 600 : 3200, to: i % 2 ? 3200 : 600 }]);
  out.push(sc);
});
hits.push([endT, 'end card', 'impact'], [r2(endT + 0.8), 'button', 'pop', { pitch: 'A5' }]);

const js = `// ${cfg.title} (explainer). Written by tools/explainer.mjs from docs/scenes.json and the voice timings in
// film.json; edit scenes.json and re-run it rather than editing this file.
import { ad } from '/kit/ad.js';

const HITS = [
${hits.map((h) => '  ' + JSON.stringify(h)).join(',\n')},
];

ad({
  hooks: { a: ${JSON.stringify(scenes[0].caption || '')} },
  scenes: ${JSON.stringify(out, null, 2).replace(/\n/g, '\n  ')},
  end: { t: ${endT}, line: 'Set up your estate free', url: 'breeup.com' },
  hits: HITS,
});
`;
fs.writeFileSync(path.join(dir, 'film.js'), js);
console.log(`${path.relative(process.cwd(), path.join(dir, 'film.js'))}: ${out.length} scenes, end card at ${endT} s, ${cfg.duration} s`);
