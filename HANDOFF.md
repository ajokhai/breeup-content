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
