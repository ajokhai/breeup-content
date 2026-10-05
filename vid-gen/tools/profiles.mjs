// Profiles: a brand's own rules for pictures, voice, scripts and reviews. The generic profile holds only what
// makes any video good (real-looking photos, no stray text or logos, clear scripts). A brand's taste lives in
// tools/profiles/<name>.json and applies only to that brand's videos, e.g. "breeup": African people and places,
// good-looking cast, no pidgin, Nigerian voice.
//
// Which profile: --profile <name>, else CLIPWALK_PROFILE in the environment, else "breeup" (this repo's own films).
// "none" means generic. make.mjs and the Clipwalk server set CLIPWALK_PROFILE for every tool they run.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'profiles');
export const GENERIC = {
  name: 'none',
  photo: ['Photorealistic documentary-style photograph, shot on a full-frame camera with a 35mm or 50mm prime lens,',
    'natural light, true-to-life skin tones with visible texture, no plastic or airbrushed skin.',
    'Candid, unposed moment, nobody looking into the camera. Clean composition with room for text overlay.',
    'No text, no captions, no logos, no watermarks, no brand names on anything, no visible phone screen content.'].join(' '),
  video: 'Cinematic, realistic footage, steady handheld or slow gimbal move, natural light. No text, no logos, no subtitles, no music.',
  editor: 'You are the photo editor for a product video.',
  vision: { african: false, attractive: false },
  voiceStyle: 'warmly and clearly, unhurried',
  context: 'Product launch and how-to videos for apps and websites',
  lint: { slang: 'Does `line` use slang or overly casual phrasing?', audience: 'a busy, non-technical viewer' },
  vet: { african: false, looks: false },
  review: { who: 'a product video', scores: 'hook, readability on a phone, motion quality, pacing, image quality, brand consistency, sound', rules: null },
  stockHint: '', accent: 'international', match: [],
};
export function profileName(argv = process.argv) {
  const i = argv.indexOf('--profile');
  return (i >= 0 ? argv[i + 1] : process.env.CLIPWALK_PROFILE) || 'breeup';
}
export function loadProfile(name = profileName()) {
  if (!name || name === 'none') return GENERIC;
  const f = path.join(DIR, `${path.basename(name)}.json`);
  if (!fs.existsSync(f)) return GENERIC;
  const p = JSON.parse(fs.readFileSync(f, 'utf8'));
  return { ...GENERIC, ...p, vision: { ...GENERIC.vision, ...p.vision }, lint: { ...GENERIC.lint, ...p.lint }, vet: { ...GENERIC.vet, ...p.vet }, review: { ...GENERIC.review, ...p.review } };
}
// the profile a product's video should use: a brand profile whose "match" names its name or site, else generic
export function matchProfile({ name = '', site = '' } = {}) {
  const hay = `${name} ${site}`.toLowerCase();
  for (const f of fs.existsSync(DIR) ? fs.readdirSync(DIR) : []) {
    if (!f.endsWith('.json')) continue;
    const p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
    if ((p.match || []).some((m) => m && hay.includes(String(m).toLowerCase()))) return f.replace(/\.json$/, '');
  }
  return 'none';
}
