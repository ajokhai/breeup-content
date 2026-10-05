# Rules for any agent working in `vid-gen/`

> **Scope (Josh, 2026-10-05):** sections 1-3 and "Josh's taste" are **BreeUp's** rules, stored as the BreeUp profile
> (`tools/profiles/breeup.json`) and applied only to BreeUp's videos: this repo's films, and Clipwalk videos whose
> product is BreeUp. Clipwalk videos for any other product use the generic profile (`tools/profiles.mjs`): real-looking
> pictures, no stray text or logos, clear scripts, and good motion. Never push BreeUp's taste (African cast, Nigerian
> voice, no pidgin, "good-looking people only") onto someone else's video. Tools read the profile from
> `--profile <name>` or `CLIPWALK_PROFILE`; make.mjs and the Clipwalk server set it per film.

Run every command from inside `vid-gen/`. Read this whole file before you touch a film, generate a picture or write a shot list. Then read
`README.md` (the slate and the shared look) and `tools/PROMPTS.md` (what has worked for image generation).

**Keep this file current.** When Josh asks for something, corrects something or says what he likes or
dislikes, add it to "Josh's taste" at the bottom, with the date, in the same session. If a new note
contradicts an old one, edit or remove the old one; don't just stack them. His taste changes over time, and
this file is how the next agent finds out.

## 1. The audience is African. Show people and places that look like them.

BreeUp is for residential estates in Nigeria, and later the rest of Africa. Customers should see themselves.

- Every person on screen is Black African, usually Nigerian: residents, guards, EXCOs, treasurers, riders,
  artisans. Mix ages, genders and dress (modern clothes and Ankara, kaftans, gele where it fits).
- **Only good-looking people**, in stock and in generated pictures: attractive, well-groomed, photogenic,
  stylishly dressed, like the cast of a premium lifestyle ad. Still candid and believable, not plastic.
  Reject a picture if the people look tired, scruffy or unappealing, even if everything else is right.
- Places look like real Lagos or Abuja estates: gated compounds, interlocking paving, painted fences,
  razor wire, water tanks, generators, palms, duplexes and bungalows, a gatehouse with a barrier.
- Never use pictures that read as Europe, America or Asia (snow, suburban lawns, brick terraces, US cars
  with US plates, non-African crowds). If a stock picture is "close enough", it isn't.
- Language is plain, clear English. No pidgin or slang (see README).

## 2. Don't reuse the same few site photos. Find or make new pictures.

The website's own photos (`hero.jpg`, `residents.jpg`, `estate_aerial.jpg`, `gatehouse.jpg`) are already on
the site and in T1. Use them sparingly, at most once per film, and never as the hook.

For every shot that needs a person or a place, in this order:
1. **Free stock** (Pexels, Unsplash, Pixabay) if a clip or photo truly fits rule 1. Downloads go in
   `media/stock/`, listed in `media/STOCK.md` with the source URL.
2. **Otherwise, generate it with Gemini** using the shared tool. Don't write your own API code.

   ```bash
   node tools/gemini.mjs image --prompt "..." --out media/generated/<film>/<name>.png --aspect 16:9 --size 2K --n 2
   node tools/gemini.mjs image --prompt "..." --out media/generated/<film>/<name>-9x16.png --aspect 9:16 --size 2K
   node tools/gemini.mjs video --prompt "..." --image media/generated/<film>/<name>-9x16.jpg --aspect 9:16 --out media/generated/<film>/<name>-9x16.mp4
   node tools/gemini.mjs tts   --text "one line" --out films/<film>/audio/vo-1.wav
   node tools/gemini.mjs music --prompt "..." --out films/<film>/audio/music.wav
   ```

   - The key lives in `videos/.env` (never commit it or print it). The tool adds the house photo style
     automatically; describe only the subject, action, place and light. `--raw` turns the house style off.
   - Generate 2 variants (`--n 2`, never more than 3: the tool caps it), look at every one, and keep the best. Reject anything with
     warped hands, extra fingers, melted faces, readable gibberish text, fake logos or a non-African feel.
   - Use `--size 2K` for anything shown full frame at 1080p. Use `4K` when the film pushes in or crops hard.
   - For a recurring character across shots, pass the first good picture as `--ref` so the face stays the same.
   - Every output has a `.json` sidecar with its prompt. Keep the keepers in `media/generated/<film>/`; trials go
     in `media/generated/_trials/` and can be deleted.
   - If a prompt pattern works or fails, write it down in `tools/PROMPTS.md`.
   - Generated images and clips are for mood and people. **Never generate product screens.** Product UI
     always comes from the real screenshots in `subbyems-main/public/images/blog/screens/`.

## 3. Mobile first. Every film ships portrait and landscape.

Most BreeUp users watch on a phone (WhatsApp status, Reels, Shorts, the blog on mobile).

- Pick formats by what the film is for. Tutorials and explainers ship **9:16 (1080x1920)** and **16:9
  (1920x1080)**; social reels are 9:16 first, plus 16:9 when it has a use (e.g. the website's desktop cut).
  Design and check 9:16 first.
- Don't just crop the landscape cut for 9:16. Lay it out again: stack things vertically, make type bigger,
  put the phone screen large and central.
- Generate pictures at the right aspect for each format (`--aspect 9:16` and `--aspect 16:9`) rather than
  cropping one, unless a single 4K image genuinely covers both.
- Keep text and key action inside the safe area: on 9:16, nothing important in the top 250 px or the bottom
  350 px (that's where Reels, TikTok and WhatsApp put their UI).
- Captions on screen always, even with voice-over: many people watch muted.
- Type sizes on 9:16: body captions at least 56 px, headings at least 96 px at 1080 wide.
- Check every contact sheet at phone size (shrink it to ~360 px wide). If you can't read it there, it's too small.

## 4. Image-heavy, real footage, advanced motion

- Older viewers (EXCO members, landlords) prefer real photos and footage over flat vector designs. Every
  scene sits on a real photo or clip; flat colour backgrounds only for brief type beats.
- Use realistic video: Veo clips (`gemini.mjs video`, start from an approved still) or real stock footage.
- Motion engine: **HyperFrames** (HTML + GSAP, headless render), pinned in `package.json`. Always run it
  through `tools/hf` (sets Node 22+, telemetry off). Before hand-building an effect, search the
  384-item registry: `tools/hf catalog <words>` (useful: vfx-iphone-device, browser-device-stage,
  caption-highlight, share-sheet-carousel, message-thread-reveal, whip-pan, light-leak, logo-outro).
  Read only `/hyperframes-core` for authoring; skip the HyperFrames intent interview (our shot lists replace it).

## 4b. Sound and rendering (works on the Mac and in the cloud)

- Voice-over: one TTS file per line, listed with its start time in `film.json` "vo". Check each clip is about
  2.5 words a second: `gemini-3.8-flash-tts` reads the style instructions aloud, so the tool defaults to
  `gemini-2.5-pro-preview-tts`.
- Music: `gemini.mjs music` (Lyria 3). Describe mood, instruments and tempo in general terms; naming a genre
  too precisely trips its copyright filter ("resembles existing copyrighted works"), so rephrase and retry.
- `node tools/mix.mjs films/<film>` builds `audio/mix.wav` (music ducked under the voice, -14 LUFS) and warns
  about overlapping lines. `node tools/render.mjs films/<film>` renders every format to `renders/` and muxes
  the mix. Use `--still 5,20` for cheap layout checks before a full render.
- Tools must run on both macOS and Linux: no Mac-only commands (sips, afplay) without a fallback.

## 4c. New tutorials are data, not code

Build tutorials on `tools/kit/tutorial.js`: `film.js` is one `tutorial({...})` call (see T3 for a full
example and the kit's header for every option), `beats.json` is `{ "period": 1 }` so all times are seconds.
Write `docs/vo/lines.txt` and the photo prompts in `media/generated/<ID>/shots.json`, run
`node tools/make.mjs films/<film> --only vo` to get each line's start in `film.json` "vo", set the scene
times from those, then `make --check` and look only at the contact sheet. Fix layout in the kit, not in a
film, so every tutorial gets it.

## 4d. Clipwalk (the web app) and walkthrough captures

- `npm run studio` serves Clipwalk on http://localhost:4747 (`tools/studio/`). It only drives the same tools as the
  command line, so anything it does can be done by hand and the other way round. Jobs run one at a time.
- `tools/walk.mjs` captures product screens: Jev (default, cheapest) or Gemini Flash picks each click from a text list of
  the page's controls. Logins come only from WALK_USER / WALK_PASS in the environment; never write them anywhere.
- A capture becomes a tutorial film with `filmFromWalk` in the server: screens, captions, rings and taps come from
  `walk.json`; colours, logo and end card from `tools/studio/workspace.json` (film.json "brand" recolours the kit).
- Real device frames: `tools/kit/devices/` (rendered by `tools/frames.mjs` from the registry's 3D models). The kit
  uses them automatically; `"frame": false` in film.json turns them off.
- The simple app (`tools/studio/index.html`) is a home page (link box + style cards) and a CapCut-style editor. Each
  Clipwalk video keeps its scenes in `films/<film>/clipwalk.json`; the server's `writeFilm()` regenerates film.js,
  film.json and the script from it after every edit, so never hand-edit those three for a Clipwalk video. The owner's
  admin (connections checklist, people and credits, pricing, old step-by-step tools) is `pro.html` at /pro.
- Launch films (`template: 'launch'`) are cut on a beat grid: pace sets the tempo (fast 124, medium 112, slow 100 BPM),
  shots last whole beats, the first screen starts on a bar line and the hero word lands on the drop. film.json "score"
  (`{ bpm, mood, groove, drop, end }`) makes `make.mjs` build the music with `tools/beat.mjs` (free, in time, no API).
  `beat.mjs` is also the fallback whenever Lyria fails (no credit or refused), so a video never ships silent.
- The editor has a Simple strip and an advanced **Timeline** (clips sized by length, trim, drag to move, cut at the
  playhead, the music lane with its beats and drop) with a contextual panel for the selected clip. Clip lengths are
  `len` on each scene in clipwalk.json; opening and ending lengths are `timing: { intro, end }`; a cut or duplicate is a
  new scene with `from: <id>`. `writeFilm`/`writeLaunch` write `spans` (each clip's real start and length) back for it.
  Removed clips wait in `bin` (last 20) so Undo works. "Ask for a change" (`POST /api/films/<f>/ask`, `askEdit()`):
  `jev.mjs edit` classifies the request into the clip's edits; words come only from quotes in the request and seconds
  from the request (Jev never writes text), and requests outside those edits get a plain "can't do that yet".
- Voices: `"provider": "yarn"` in film.json "voice" uses YarnGPT (Nigerian accent, free for now); default is Gemini.
- "Make it like a video I saw": `tools/style.mjs` measures pace (motion + cuts), energy and shape for free; the video
  takes its pace and music feel, never its colours or words.
- A video can have up to three views (e.g. the admin on a laptop, then a resident on a phone): the kit's
  `phone.parts` switches device mid-film. Optional opener: a free stock photo or clip (`tools/stock.mjs`; the workspace's
  "stock hint", "Black African, Nigerian" for BreeUp, is added to every search, so rule 1 still holds).
- Friends pay in credits (1 credit = `credit_usd` in `tools/studio/pricing.json`; `menu` sets what each thing costs).
  Accounts, codes and balances live in `tools/studio/accounts.json` (git-ignored). Credits come off only when a video
  finishes. Anyone not on this computer, including through a tunnel, needs a code and only sees their own videos.
- Clipwalk videos have `"publish": false` in film.json, so they stay in `renders/` and never land in `Final videos/`.
- Prices: `tools/studio/pricing.json` holds API rates and the margin; update rates there when they change.

## 5. TikTok, Reels and Shorts

- Social cuts (series S) are 9:16 only, 15-30 s, hook in the first 1.5 s, captions burned in
  (TikTok-style word highlight), loopable ending, no slow logo intro. Respect the safe area in rule 3.

## 6. Maximum quality, clean files

- Always the highest quality available: images `--size 4K` (the default), Veo `4k` (the default; drop to
  1080p only if the API refuses), renders at 4K masters (`portrait-4k`, `landscape-4k`) with 1080p exports.
- Generator metadata (EXIF, XMP, C2PA) is stripped losslessly from everything the tool writes. Run
  `node tools/gemini.mjs clean <file>` on renders and on anything from elsewhere before publishing.
  SynthID (an invisible pixel watermark) can't be removed and we don't try. Follow each platform's
  rules on disclosing realistic AI-generated people.

## 7. Token efficiency (any agent)

- Don't view full-size images. Use `check` (Gemini QA, one line per picture) and look only at `sheet`
  contact sheets. Generate a whole film's pictures with one `batch` manifest, not one call each.
- Let Gemini watch renders: `node tools/gemini.mjs review <render> --film <folder>` instead of reading frames.
- Use `tools/hf timeline` instead of reading whole composition files.
- Use Jev (`tools/jev.mjs`, TypeSafe, text only, very cheap) for typed decisions instead of reading lists yourself:
  `pick "<what the shot needs>"` chooses HyperFrames blocks (never read the full catalog), `lint --file <lines>`
  checks scripts and captions (pidgin, jargon, clarity, words per second) before any render, and
  `dupe "<lesson>"` checks STYLE.md before you add a lesson. Same exit codes as gemini.mjs, plus 5 = lint problems.
- **Jev first, always (Josh, 2026-10-05).** Any decision about text goes to Jev before Gemini, Claude or your own
  context: choosing copy lines, music mood, template, pace, which stock result, which scene matches which shot, whether
  a prompt or script breaks a rule. Jev costs about $0.04 per million words read; Gemini Flash is ~20x that and Pro
  ~50x. Use Gemini only for what needs eyes (looking at pictures and videos) or to generate media, and gate every paid
  generation behind a Jev check: `make.mjs` runs `jev.mjs vet` on photo prompts before pictures and `jev.mjs lint`
  before voice-over; the walkthrough defaults to the Jev brain. When you build something new, find the Jev step first.

## 8. Learning from references (self-improving)

- Josh drops reference videos or images into `moodboard/inbox/`, or pastes links (YouTube, TikTok, Instagram, X...)
  into `moodboard/inbox/links.txt` as `URL - what he likes`. Run `node tools/gemini.mjs learn` (downloads non-YouTube
  links with yt-dlp; learned links leave links.txt). It writes `moodboard/refs/<name>.md` and rewrites
  `moodboard/STYLE.md`. Read STYLE.md before designing any film; it outranks your own taste, CLAUDE.md outranks it.
- When a `review` lists lessons that recur, add them to STYLE.md or `tools/PROMPTS.md`.

## 9. Credits and errors

`gemini.mjs` exit codes: **2 = out of credits or quota: stop and tell Josh** (don't silently switch models),
3 = bad key, 4 = safety block (rephrase), 1 = other. `node tools/gemini.mjs usage` shows calls per model.

## 9b. Sharing work between machines

This folder is the GitHub repo `ajokhai/breeup-content`. Josh works on his Mac; agents may work in the cloud.
`git pull` before you start and read the top of `HANDOFF.md`; when you finish a piece of work, add an entry there,
commit and push. HANDOFF.md says who is working on what, so two agents never edit the same film at once.
Never commit `.env` (keys) or `node_modules/`. `renders/` (videos and stills) and `tools/usage.log` are local-only:
each machine renders its own; commit the inputs, never a half-written video.

## 10. Keep the folder organized

New people (agents and humans) must understand the `videos` folder without anyone explaining it. The top level is
exactly: `START HERE.md`, `Final videos/`, `Marketing/`, `vid-gen/` (plus hidden `.git`, `.gitignore`, `.claude/`).
- `Final videos/`: finished, cleaned MP4s with plain names (`T2 How to pay your service charge online (phone).mp4`).
  `make.mjs` copies them there after a full render. Nothing else goes in it.
- `Marketing/`: the marketing plans and `Asset list.md`. When you publish a new or changed video, update its row
  in `Marketing/Asset list.md` and add its copy to `Marketing/5 YouTube plan.md` in the same commit.
- `vid-gen/`: everything agents use to make videos.

Inside `vid-gen/`, keep to the map at the top of `README.md`:
- A new film goes in `films/<ID>-<short-name>/` with `docs/shotlist.md`; its generated pictures in
  `media/generated/<ID>/`; working renders and stills in `renders/` (local, git-ignored).
- Delete scratch output before you finish. Move replaced versions to `archive/` instead of leaving `v2` copies.
- If you add a folder or tool, add it to the README map in the same session.

## 11. Quality bar

- Pictures: high res, sharp, true skin tones, no AI tells. Compare against the best image in
  `media/generated/` so far; if a new one is worse, regenerate.
- Follow the film system in `README.md` (fonts, colours, step counter, gold rings, button labels from the app).
- Run the critique loop (contact sheets, scored rounds, `docs/critique.md`) before calling a film done.
- Renders go in `renders/` as `breeup-<id>-<slug>-16x9.mp4` and `-9x16.mp4`.

## Josh's taste (keep updating)

- 2026-10-05: Use Jev aggressively to cut costs in every workflow you build: Jev first for any text decision, paid
  models only for vision and generation, and a Jev gate before anything paid. (Section 7.)
- 2026-10-05: **Never more than 2-3 variants of anything**: hook versions per ad, picture variants per shot, music or
  voice retries. Extra hook versions burnt a lot of credits. Default to 2; use 3 only when testing really needs it.
  `gemini.mjs` and `render.mjs` enforce the cap. Same rule for the marketing plans.
- 2026-10-05: Wants the tooling usable by friends for their own products, not only BreeUp. The app is called
  **Clipwalk** (not BreeUp); BreeUp is just one brand in it. Making a video must be dead simple (link + what to show +
  one button), with optional, skippable follow-up questions; granular controls stay under Advanced. A built-in tour.
  Pricing in credits (one number per video, breakdown hidden). Keep it cheap: Jev first, Gemini only when needed.
- 2026-10-05: Videos can mix devices (admin on a computer, user on a phone), use real device frames, and use stock
  photos and video as well as generated ones.
- 2026-10-03: Wants African and Nigerian faces and places throughout. Stock that feels foreign doesn't count.
- 2026-10-03: Don't be lazy and keep reusing the website's stock images. Generate fresh pictures when stock is thin.
- 2026-10-04: Mobile first. Portrait and landscape are nice to have, not compulsory: choose by the film's purpose.
- 2026-10-03: Wants top-quality, high-res pictures, and the image prompts tuned over time (see `tools/PROMPTS.md`).
- 2026-10-03: Only good-looking people, in stock and generated pictures alike. Attractive, well-groomed, stylish.
- 2026-10-03: Heavy on photos and realistic video; older people prefer that to flat designs.
- 2026-10-03: Advanced motion graphics; reuse good free open-source tools rather than building from scratch.
- 2026-10-03: Make TikToks and Reels too.
- 2026-10-03: Always push for higher image and video quality.
- 2026-10-03: Strip AI metadata from images and video before they go out.
- 2026-10-03: Tools must be token-efficient and work for any agent, not just Claude.
- 2026-10-03: Wants tutorials made for the blog posts and the website.
- 2026-10-03: Doesn't want this work touching the BreeUp app codebase (`subbyems`); it lives in its own repo.
- 2026-10-03: Wants work to sync between his Mac and the cloud through git (pull on the Mac).
