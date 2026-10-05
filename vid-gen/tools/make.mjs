#!/usr/bin/env node
// One command from script to finished films. Every step is cached, so re-running only redoes what changed.
//
//   node tools/make.mjs films/T3-resident-account            # everything, full-quality render
//   node tools/make.mjs films/T3-resident-account --check    # everything except the final render, plus a
//                                                            # contact sheet of stills (cheap review)
//   node tools/make.mjs films/T3-resident-account --draft    # quick render without motion blur
//   node tools/make.mjs films/T3-resident-account --only vo,mix
//
// Steps: pictures (media/generated/<ID>/shots.json) → voice-over (docs/vo/lines.txt) → place lines →
// music → sound effects → mix → stills sheet → render → strip metadata. Where it runs:
// cloud agents do everything up to --check (and --draft); Josh's Mac does the final render (more cores).
//
// film.json keys the pipeline reads (all optional except duration):
//   "voice": { "style": "...", "voice": "Kore", "model": "...", "gap": 0.35, "trim": true, "provider": "yarn" }
//            provider "yarn" = YarnGPT (tools/yarn.mjs): Nigerian-accented and free; the default is Gemini
//   "vo_at": [0.3, 10.0, ...]   start time per line; missing entries follow the previous line by "gap"
//   "music": "prompt for Lyria"  (regenerated only when the prompt changes)
//   "stills": [2, 10, 30]        times for the --check contact sheet (default: 8 evenly spaced)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (k) => args.includes(`--${k}`);
const oi = args.indexOf('--only');
const only = oi >= 0 ? args[oi + 1].split(',') : null;
const dir = path.resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--only') || '');
const cfgPath = path.join(dir, 'film.json');
if (!fs.existsSync(cfgPath)) { console.error('usage: node tools/make.mjs films/<ID-name> [--check|--draft]'); process.exit(1); }
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const id = path.basename(dir).split('-')[0];
// the brand profile every tool below uses: the film's own, else BreeUp for this repo's films, generic for Clipwalk videos
process.env.CLIPWALK_PROFILE = cfg.profile || (fs.existsSync(path.join(dir, 'clipwalk.json')) ? 'none' : 'breeup');
const want = (s) => !only || only.includes(s);
const tool = (name, ...a) => execFileSync('node', [path.join(ROOT, 'tools', name), ...a], { cwd: ROOT, stdio: 'inherit' });
const len = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);
const step = (s) => console.log(`\n== ${s}`);
const save = () => fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 1) + '\n');

// 1. pictures
const shots = path.join(ROOT, 'media', 'generated', id, 'shots.json');
if (want('images') && fs.existsSync(shots)) {
  // Jev vets the prompts first (fractions of a cent) so no picture is paid for that would be rejected anyway
  step('pictures: Jev checks the prompts first');
  const vet = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'jev.mjs'), 'vet', shots], { cwd: ROOT, encoding: 'utf8' });   // the profile's rules apply
  process.stdout.write(vet.stdout || '');
  if (vet.status === 5 && !flag('force')) { console.error('make: fix those prompts in shots.json (or run again with --force), then re-run. Nothing was spent.'); process.exit(5); }
  if (vet.status && vet.status !== 5) console.warn(`  jev couldn't check the prompts (exit ${vet.status}); generating anyway`);
  step('pictures (only missing ones are generated)');
  const gen = path.dirname(shots);
  const out = execFileSync('node', [path.join(ROOT, 'tools', 'gemini.mjs'), 'batch', shots], { cwd: ROOT }).toString();
  process.stdout.write(out.split('\n').filter((l) => /^(KEEP|REJECT|batch)/.test(l)).join('\n') + '\n');
  // keep the best-scored variant of each picture as <name>-<aspect>.jpg; delete the others (rule 10)
  const score = {};
  for (const m of out.matchAll(/^(KEEP|REJECT)\s+(\d+)\/10 (\S+)/gm)) score[m[3]] = (m[1] === 'KEEP' ? 100 : 0) + Number(m[2]);
  const groups = {};
  for (const f of fs.readdirSync(gen)) { const m = /^(.+-(?:16x9|9x16|1x1))-\d+\.(jpe?g|png)$/.exec(f); if (m) (groups[m[1]] ||= []).push(f); }
  const unscored = Object.values(groups).flat().filter((f) => score[f] == null);
  if (unscored.length) {
    const c = execFileSync('node', [path.join(ROOT, 'tools', 'gemini.mjs'), 'check', ...unscored.map((f) => path.join(gen, f))], { cwd: ROOT }).toString();
    for (const m of c.matchAll(/^(KEEP|REJECT)\s+(\d+)\/10 (\S+)/gm)) score[m[3]] = (m[1] === 'KEEP' ? 100 : 0) + Number(m[2]);
    process.stdout.write(c.split('\n').filter((l) => /^(KEEP|REJECT)/.test(l)).map((l) => l.slice(0, 110)).join('\n') + '\n');
  }
  for (const [base, files] of Object.entries(groups)) {
    const best = files.sort((a, b) => (score[b] ?? 0) - (score[a] ?? 0))[0];
    if ((score[best] ?? 0) < 100) console.warn(`  ${base}: every variant was rejected; keeping the best anyway, check it`);
    fs.renameSync(path.join(gen, best), path.join(gen, `${base}.jpg`));
    if (fs.existsSync(path.join(gen, best + '.json'))) fs.renameSync(path.join(gen, best + '.json'), path.join(gen, `${base}.jpg.json`));
    for (const f of files.slice(1)) for (const x of [f, f + '.json']) fs.rmSync(path.join(gen, x), { force: true });
  }
  // the film uses its own copies in assets/photos
  const dest = path.join(dir, 'assets', 'photos');
  fs.mkdirSync(dest, { recursive: true });
  for (const f of fs.readdirSync(gen)) if (/-(16x9|9x16|1x1)\.jpg$/.test(f) && !fs.existsSync(path.join(dest, f))) fs.copyFileSync(path.join(gen, f), path.join(dest, f));
}

// 2. voice-over: one file per line, regenerated only when the line or the voice settings change
const linesFile = path.join(dir, 'docs', 'vo', 'lines.txt');
const v = cfg.voice || {};
if (want('vo') && fs.existsSync(linesFile)) {
  step('voice-over');
  const lines = fs.readFileSync(linesFile, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
  // the key uses the spoken form, so a pronunciation fix (tools/pronounce.json) re-voices only the lines it changes
  const pron = fs.existsSync(path.join(ROOT, 'tools', 'pronounce.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'pronounce.json'), 'utf8')) : {};
  const spoken = (l) => Object.entries(pron).reduce((t, [w, say]) => t.replace(new RegExp(`\\b${w}\\b`, 'g'), say), l);
  const key = (l) => hash(JSON.stringify([spoken(l), v.style, v.voice, v.model, ...(v.provider ? [v.provider] : [])]));
  lines.forEach((line, i) => {
    const out = path.join(dir, 'audio', `vo-${i + 1}.wav`), side = out + '.json';
    const cached = fs.existsSync(out) && fs.existsSync(side) && JSON.parse(fs.readFileSync(side, 'utf8')).key === key(line);
    if (cached) return;
    if (v.provider === 'yarn') tool('yarn.mjs', 'tts', '--text', line, '--out', out, ...(v.voice ? ['--voice', v.voice] : []));   // Nigerian accent, free
    else tool('gemini.mjs', 'tts', '--text', line, '--out', out, ...(v.style ? ['--style', v.style] : []),
      ...(v.voice ? ['--voice', v.voice] : []), ...(v.model ? ['--model', v.model] : []));
    if (v.trim !== false) {   // cut leading and trailing silence so lines sit where they're placed
      const t = out + '.trim.wav';
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', out, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,apad=pad_dur=0.08', t]);
      fs.renameSync(t, out);
    }
    const meta = JSON.parse(fs.readFileSync(side, 'utf8'));
    fs.writeFileSync(side, JSON.stringify({ ...meta, key: key(line) }, null, 1));
    const wps = line.split(/\s+/).length / len(out);
    if (wps < 1.7) console.warn(`  vo-${i + 1}: ${wps.toFixed(1)} words/s, too slow; the model may be reading the style aloud. Check it.`);
  });
  // drop stale files from removed lines
  for (const f of fs.readdirSync(path.join(dir, 'audio'))) {
    const m = /^vo-(\d+)\.wav(\.json)?$/.exec(f);
    if (m && Number(m[1]) > lines.length) fs.rmSync(path.join(dir, 'audio', f));
  }
  // 3. place the lines
  const gap = v.gap ?? 0.35, at = cfg.vo_at || [];
  // a line that would run into the next fixed start is sped up a little (at most 15%, pitch kept)
  lines.forEach((_, i) => {
    if (at[i] == null || at[i + 1] == null) return;
    const f = path.join(dir, 'audio', `vo-${i + 1}.wav`), d = len(f), room = at[i + 1] - at[i] - 0.15;
    if (d <= room) return;
    const k = d / room;
    if (k > 1.15) { console.log(`  vo-${i + 1}: ${d.toFixed(1)} s doesn't fit ${room.toFixed(1)} s; the timeline will stretch instead`); return; }
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-af', `atempo=${k.toFixed(4)}`, f + '.fit.wav']);
    fs.renameSync(f + '.fit.wav', f);
    console.log(`  vo-${i + 1}: sped up ${((k - 1) * 100).toFixed(0)}% to fit before the next line`);
  });
  // Lines start at their vo_at time, or later if the previous line runs long. When a line has to start late,
  // the film's timeline stretches from there: "retime" maps authored times to real times, and the kits and
  // sfx.mjs apply it, so scenes, rings and sounds stay in step with the voice without hand edits.
  const authored = cfg.duration_authored ?? cfg.duration;
  let t = 0; const knots = [];
  cfg.vo = lines.map((line, i) => {
    const f = `audio/vo-${i + 1}.wav`, d = len(path.join(dir, f));
    let start = at[i] ?? (i ? t + gap : 0.3);
    if (at[i] != null && i && start < t + 0.15) start = t + 0.15;
    if (at[i] != null) knots.push([at[i], Number(start.toFixed(2))]);
    t = start + d;
    return [Number(start.toFixed(2)), f, line, Number(d.toFixed(3))];
  });
  const shift = knots.length ? knots.at(-1)[1] - knots.at(-1)[0] : 0;
  if (knots.some(([a, b]) => b - a > 0.01)) {
    cfg.duration_authored = authored;
    cfg.retime = [[0, 0], ...knots, [authored, Number((authored + shift).toFixed(2))]];
    cfg.duration = Number((authored + shift).toFixed(2));
    console.log(`  retimed: the film stretches ${shift.toFixed(1)} s to fit the voice (${authored} -> ${cfg.duration} s)`);
  } else { delete cfg.retime; if (cfg.duration_authored) { cfg.duration = cfg.duration_authored; delete cfg.duration_authored; } }
  if (t + 1.5 > cfg.duration) console.warn(`  the voice-over ends at ${t.toFixed(1)} s; duration is ${cfg.duration} s`);
  save();
}

// 4. music, regenerated only when the prompt changes. A "score" (launch films) is made in code on the film's beat grid
// (tools/beat.mjs: free, instant, in time). A Lyria prompt that fails (no credit, refused) falls back to the same.
const beatBed = (mood, bpm) => { try { tool('beat.mjs', dir, ...(mood ? ['--mood', mood] : []), ...(bpm ? ['--bpm', String(bpm)] : [])); return true; } catch { return false; } };
if (want('music') && cfg.score) {
  const out = path.join(dir, 'audio', 'music.wav'), side = out + '.json', key = `beat:${JSON.stringify(cfg.score)}`;
  const same = fs.existsSync(out) && fs.existsSync(side) && JSON.parse(fs.readFileSync(side, 'utf8')).prompt === key && JSON.parse(fs.readFileSync(side, 'utf8')).duration === cfg.duration;
  if (!same) { step('music (made in code)'); tool('beat.mjs', dir); }
} else if (want('music') && cfg.music) {
  const out = path.join(dir, 'audio', 'music.wav'), side = out + '.json';
  const same = fs.existsSync(out) && fs.existsSync(side) && JSON.parse(fs.readFileSync(side, 'utf8')).prompt === cfg.music;
  // the fallback bed matches the prompt's feel and tempo
  const fallback = () => beatBed(/calm|relaxed|soft/i.test(cfg.music) ? 'calm' : /african|afro/i.test(cfg.music) ? 'afro' : /upbeat|energetic|bright/i.test(cfg.music) ? 'upbeat' : 'pro', Number((/(\d{2,3})\s*BPM/i.exec(cfg.music) || [])[1]) || 0);
  if (!same) {
    step('music');
    try { tool('gemini.mjs', 'music', '--prompt', cfg.music, '--out', out); }
    catch (e) {
      if (e.status === 2 || e.status === 3) console.warn(`  Gemini music unavailable (out of credit or no key): ${fallback() ? 'made a free beat in code instead' : 'continuing with sound effects only'}`);
      else try { // Lyria's copyright filter: one retry with a broader framing
        tool('gemini.mjs', 'music', '--prompt', `An original composition. ${cfg.music}`, '--out', out);
        fs.writeFileSync(side, JSON.stringify({ ...JSON.parse(fs.readFileSync(side, 'utf8')), prompt: cfg.music }, null, 1));
      } catch (e2) { console.warn(`  no Lyria music this time (${e2.status === 2 ? 'out of credit' : 'the music model refused'}): ${fallback() ? 'made a free beat in code instead' : 'continuing with sound effects only'}`); }
    }
  }
}

// 5-6. sound effects and the mix
if (want('sfx') && /const HITS = \[/.test(fs.readFileSync(path.join(dir, 'film.js'), 'utf8'))) { step('sound effects'); tool('sfx.mjs', dir); }
if (want('mix')) { step('mix'); tool('mix.mjs', dir); }

// 7. stills sheet (the cheap review) or the render
const formats = cfg.formats || ['16x9', '9x16'];
if (flag('check') || (only && only.includes('stills'))) {
  step('stills');
  const times = cfg.stills || [...Array(8)].map((_, i) => +((i + 0.5) * cfg.duration / 8).toFixed(2));
  tool('render.mjs', dir, '--still', times.join(','));
} else if (want('render')) {
  step(flag('draft') ? 'draft render' : 'render (full quality)');
  tool('render.mjs', dir, ...(flag('draft') ? ['--draft'] : []));
  // 8. strip metadata from the finished files
  const vs = cfg.variants || [null];
  const outs = vs.flatMap((v) => formats.map((f) => path.join(ROOT, 'renders', `breeup-${path.basename(dir)}${v ? `-${v}` : ''}-${f}.mp4`))).filter(fs.existsSync);
  // frame 0 = the poster (cfg.poster, seconds): X, Slack and WhatsApp show the first frame as the preview
  if (!flag('draft') && cfg.poster != null) for (const f of outs) {
    const png = f.replace(/\.mp4$/, '.poster.png'), tmp = f.replace(/\.mp4$/, '.tmp.mp4');
    try {
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(cfg.poster), '-i', f, '-frames:v', '1', png]);
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', f, '-i', png, '-filter_complex', "[0:v][1:v]overlay=0:0:enable='eq(n,0)'[v]", '-map', '[v]', '-map', '0:a?', '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', tmp]);
      fs.renameSync(tmp, f); fs.rmSync(png, { force: true });
    } catch (e) { console.warn(`  poster frame skipped for ${path.basename(f)}: ${e.message.split('\n')[0]}`); fs.rmSync(tmp, { force: true }); }
  }
  if (outs.length) tool('gemini.mjs', 'clean', ...outs);
  // free motion QA (frozen stretches, one-frame flashes) and review sheets; reports, never blocks
  if (!flag('draft')) for (const f of outs) { try { tool('qa.mjs', f); } catch { /* flagged: printed above */ } }
  // 9. publish: full renders get a plain name in ../Final videos/, the only folder Josh looks at
  if (!flag('draft') && outs.length && cfg.publish !== false) {   // Clipwalk videos set publish: false and stay in renders/
    const final = path.join(ROOT, '..', 'Final videos');
    fs.mkdirSync(final, { recursive: true });
    const id = path.basename(dir).split('-')[0];
    const shape = { '9x16': 'phone', '16x9': 'wide', '1x1': 'square', '4x5': '4x5' };
    for (const f of outs) {
      const [, v, fmt] = f.match(/(?:-([a-z]))?-(\d+x\d+)\.mp4$/);
      const name = `${id} ${cfg.title.replace(/[\\/:*?"<>|]/g, '')} (${v ? `hook ${v}, ` : ''}${shape[fmt] || fmt}).mp4`;
      fs.copyFileSync(f, path.join(final, name));
      console.log(`  published: Final videos/${name}`);
    }
  }
}
console.log('\nmake: done');
