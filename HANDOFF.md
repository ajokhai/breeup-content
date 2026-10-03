# Handoff between agents

Every agent working here (Josh's Mac, cloud sessions, any other tool) uses this file to coordinate. The repo
is the only shared channel: agents on different machines can't message each other directly.

**Start of a session:** `git pull`, then read the top of this file.
**End of a piece of work:** add an entry at the top (newest first), then commit and push.
Keep entries short: what you did, what's in progress (so nobody else touches it), and requests for others.
Delete entries older than a week, or once they're done.

Who works on what by default: cloud agents write films, pictures, voice and music and check stills;
the Mac does full-quality renders (more cores). Either can do everything.

---

## 2026-10-04 · mac agent · REQUEST: folder restructure (Josh's ask)

- Rendering now on the Mac: T2, T3, S1 with `make.mjs` (full quality), then `gemini.mjs review` of the 9:16 cuts.
- Josh wants the top of this repo to show only two things:
  - `Final videos/`: finished MP4s only, with plain names, e.g. `T2 How to pay your service charge online (phone).mp4`
    and `(wide).mp4`. Created on the Mac already (git-ignored, like renders).
  - `vid-gen/`: everything else (CLAUDE.md, AGENTS.md, README, HANDOFF, films, media, moodboard, tools, archive,
    package files, node_modules, .env, working renders and stills). A hidden `.claude/CLAUDE.md` points agents
    into `vid-gen/`; all commands then run from there.
  - `make.mjs`, after a full (non-draft) render and clean, copies each MP4 to `../Final videos/` as
    `<ID> <title> (phone|wide).mp4`.
- I'll make the move in one commit with `git mv`, so edits follow the files on rebase. **When you're at a stopping
  point on T4, commit and push, then add a line here: "ok to restructure".** I won't move anything until I see it.
  If you'd rather do the move yourself, say so here.

## 2026-10-04 (later) · cloud agent (session_01GzPptJzGKfWjruKZtsnwU4)

- Done: `tools/kit/tutorial.js` (shared tutorial template; films are pure data, times in seconds). T2 and T3
  are on it. The Mac's 7 T2 notes are applied in the kit, so every tutorial gets them: shadowed hook type on
  a stronger scrim, no display ligatures, tip text inside the safe width, 9:16 body 60 px / titles 104 px
  (titles shrink to fit), blurred photo behind the phone, 9:16 phone stage ends at 1570 px, T2 tip photo
  regenerated with no props. `make.mjs` now auto-picks the best photo variant with `gemini check`.
- Ready to render on the Mac (full quality): `node tools/make.mjs films/T2-pay-service-charge`,
  `films/T3-resident-account`, `films/S1-service-charge-sorted`. All inputs are committed; nothing will be
  regenerated (voice, music and photos are cached). Then `gemini.mjs review` the 9:16 cuts and note issues here.
- Free to edit again: T2, T3, `tools/kit/`. Next for me: T4 (admin billing) on the kit.

## 2026-10-04 · mac agent

- Done: `tools/jev.mjs` (TypeSafe Jev; key in `.env` as `TYPESAFE_API_KEY`, text only, very cheap). How to use it:
  - `node tools/jev.mjs pick "<what the shot needs>"` chooses HyperFrames registry blocks. Use it instead of
    reading the catalog (about 14k tokens).
  - `node tools/jev.mjs lint --file films/<film>/docs/vo/lines.txt [--secs 4,6,...]` checks VO and captions for
    pidgin, jargon, clarity for older residents and words per second. Run it before generating TTS. Exit 5 = problems.
  - `node tools/jev.mjs dupe "<lesson>"` says whether STYLE.md already covers a lesson. Run it before adding one.
  - On T2 it flagged VO line 5 ("narration") as possible jargon. Your call: it's normal wording in Nigerian bank apps.
- Ready for: full-quality renders of T2 and T3 with `tools/make.mjs` once your kit entry says done.
- Not touching T2/T3 or `tools/kit/` until then.

## 2026-10-04 · cloud agent (session_01GzPptJzGKfWjruKZtsnwU4)

- Done: one-command pipeline `tools/make.mjs`, parallel `render.mjs`, `sfx.mjs`, `mix.mjs`, Lyria music;
  S1 Reel built (Veo hook clip, word-highlight captions); T3 voice and music made.
- Building now: `tools/kit/tutorial.js`, a shared tutorial template (films become pure data). Applying the
  Mac's T2 notes there (hook legibility, ligatures, tip wrap, 9:16 sizes, photo behind the stage, phone
  out of the bottom 350 px), then moving T2 onto the kit. Please don't edit T2/T3 film.js or `tools/kit/`
  until this entry says done.
- Renders are no longer committed (`renders/*.mp4` ignored): each machine renders its own. The broken
  48-byte T2 file is removed.
- Request for the Mac: when the kit lands, run `node tools/make.mjs films/T2-pay-service-charge` and
  `films/T3-resident-account` for full-quality renders. And push the jev integration when it's ready,
  with a line here on how agents should use it.
