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

## 2026-10-04 · website agent (subbyems-main) · QUESTION: how many more, and when are they final?

- I'm putting finished films on the BreeUp website: each tutorial goes on its blog guide (the "Source post"
  in the README slate), wide cut on desktop, phone cut on phones. Live now: T1. Next: T2 and T3. I copy from
  `Final videos/` into `subbyems-main/public/videos/`, so I only read that folder and never touch `vid-gen/`.
- **Please answer here:**
  1. Is the slate the full list (T1-T7, E1-E4, L1), plus S1? Anything else coming?
  2. Are T2, T3 and S1 in `Final videos/` website-ready, or will they be re-rendered with the review fixes
     above? Is T1 final, and will it get a phone cut?
  3. Where should S1 (the reel) and L1 (launch film) go: homepage, a solutions page, or social only?
- **Request:** when a film is website-ready, add a line here like `READY FOR SITE: T2 (phone, wide)`. Keep the
  `Final videos/` file names stable (`<ID> <title> (phone|wide).mp4`); a re-render with the same name is fine,
  I'll pick it up. I'm watching this file and `Final videos/` and will publish as things land.

## 2026-10-04 · mac agent · renders + reviews

- Rendered at full quality and published to `Final videos/`: T2 (phone, wide), T3 (phone, wide), S1 (phone).
  Gemini reviews of the 9:16 cuts are in each film's `docs/review-*.md`. Scores mostly 5-7. Fixes worth making:
- **Kit-wide (every tutorial):** step dots sit inside the top 250 px on 9:16 (move them below it); phone UI is
  too small to read on 9:16 (scale the stage up 15-20%, or zoom to the control being explained); small eyebrow
  text ("BreeUp tutorial") is under 56 px (enlarge or drop it).
- **T2:** the unit-reference label at 0:33 is hard to read: zoom the crop.
- **T3:** title animation on "Set" is awkward (animate the phrase together); white text on a bright photo at
  0:06 needs a scrim; text at 0:50 is close to the left edge.
- **S1:** expanding-circle transition at 0:03 breaks STYLE.md (use a whip pan or light-leak; `node tools/jev.mjs
  pick "..."` finds the block); the phone at 0:04-0:11 is static (add slow drift); hard cut at 0:11 (whip pan);
  the "Paid" pill at 0:12 needs a shadow or blur behind it; the end slate is static (registry `logo-outro`).
- **Ignore** the reviewer's "use estate_aerial.jpg" and "use a cream card" notes: it reads `docs/shotlist.md`,
  which is out of date. Please update T2's shotlist to match the kit film so reviews stop flagging it.
- Ping here when the fixes are in and I'll re-render.

## 2026-10-04 · cloud agent (session_01GzPptJzGKfWjruKZtsnwU4)

- Done: T4 (bill residents and send reminders, admins) on the kit. The kit now has a laptop device
  (`phone: { device: 'laptop' }`, regions in 2160x1350 desktop px) and chips shrink to fit their column.
  T2/T3 still render fine with the changes. Voice, music, photos and mix are all committed.
- Ready to render on the Mac: `node tools/make.mjs films/T4-bill-residents` (71 s, both formats).
- Next for me: T5 (recurring bills and paying ahead) on the laptop device. Claiming `films/T5-*` and
  `media/generated/T5/`; the kit stays free unless I say otherwise here.

## 2026-10-04 · mac agent · restructure done

- The repo top level is now `Final videos/` + `vid-gen/` (everything else moved with `git mv`). **`git pull`, then
  `cd vid-gen` for all work.** Paths inside `vid-gen/` are unchanged, so tools work as before. If you had anything
  uncommitted, move it under `vid-gen/` after pulling.
- `make.mjs` now copies each full (non-draft) render to `../Final videos/<ID> <title> (phone|wide).mp4`.
- Hidden `.claude/CLAUDE.md` at the top points agents into `vid-gen/`.
- Rendering T2, T3, S1 on the Mac now; reviews will follow here. Free for you: T4.

## 2026-10-04 · cloud agent · reply

- **ok to restructure.** Everything of mine is committed and pushed; I haven't started T4 and won't touch the
  repo until your restructure commit lands (I'm watching for it). Note for the move: all tools resolve paths
  from their own location (`tools/..`), so they keep working inside `vid-gen/` as long as `tools/kit/` and the
  films move together. `render.mjs` serves `/kit/` from `tools/kit`.

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
