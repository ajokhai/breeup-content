# BreeUp videos

## What's in this folder

| Folder / file | What it is |
|---|---|
| `HANDOFF.md` | Notes between agents (Mac and cloud): who is doing what. Read the top first. |
| `CLAUDE.md` | The rules every agent follows (also `AGENTS.md`). Your taste notes are at the bottom. |
| `films/` | One folder per video, named `<ID>-<short-name>` (e.g. `T2-pay-service-charge`). Each has `docs/` (shot list, reviews), `assets/`, `audio/` and the build files. |
| `renders/` | Finished videos, ready to post: `breeup-<ID>-<name>-9x16.mp4` and `-16x9.mp4`. |
| `media/generated/` | Pictures and clips made with Gemini, one folder per film. `_trials/` is experiments, safe to delete. |
| `media/stock/` | Downloaded free stock photos and footage (list in `media/STOCK.md`). |
| `moodboard/` | Drop reference videos you like into `moodboard/inbox/`. `STYLE.md` is the style guide learned from them. |
| `tools/` | `gemini.mjs` (images, video, voice, music, checks), `mix.mjs` (builds a film's soundtrack), `render.mjs` (turns a film into MP4s), `hf` (HyperFrames motion graphics), `PROMPTS.md` (prompt tips). |
| `archive/` | Old versions. Nothing here is used. |
| `node_modules/`, `package*.json`, `.env` | Software and the API key. Leave these alone. |


Every film is built in code from real BreeUp screens, licensed stock footage of Nigerian and African
people and places, synthesized music and UI sounds. Each film is a folder; renders go to `renders/`.

Language: plain, clear English. No pidgin or slang.
Formats: every film ships as 16:9 (YouTube, the blog) and 9:16 (Shorts, Reels, WhatsApp status).

## Slate

| # | Film | Kind | Audience | Length | Voice | Source post | Status |
|---|------|------|----------|--------|-------|-------------|--------|
| T1 | How to send a visitor pass on WhatsApp | Tutorial | Residents | 40 s | Captions | how-to-send-a-visitor-pass-on-whatsapp | Shot list ready |
| T2 | How to pay your service charge online | Tutorial | Residents | 60 s | VO | how-to-pay-estate-service-charge-online | Rendered (v1), needs review |
| T3 | Set up your resident account (phone and PIN) | Tutorial | Residents | 50 s | VO | how-to-set-up-your-resident-account | Next |
| T4 | Bill residents and send payment reminders | Tutorial | Admins | 50 s | VO | how-to-bill-residents-and-send-reminders | Queued |
| T5 | Recurring bills and paying ahead | Tutorial | Admins | 45 s | Captions | how-to-set-up-automatic-monthly-levies | Queued |
| T6 | Import residents from a spreadsheet | Tutorial | Admins | 40 s | Captions | how-to-import-residents-from-a-spreadsheet | Queued |
| T7 | Add admins and set what they can see | Tutorial | Admins | 40 s | Captions | how-to-add-admins-and-set-permissions | Queued |
| E1 | When the WhatsApp group stops working | Explainer | EXCOs | 60 s | VO | whatsapp-group-vs-estate-management-software | Queued |
| E2 | Collecting service charge without chasing | Explainer | EXCOs, treasurers | 60 s | VO | collecting-service-charge-without-chasing-residents | Queued |
| E3 | A calmer gatehouse | Explainer | EXCOs, security leads | 45 s | VO | visitor-passes-on-whatsapp | Queued |
| E4 | Two-signature payouts and an easier AGM | Explainer | EXCOs | 60 s | VO | two-signature-payouts-and-agm-transparency | Queued |
| L1 | BreeUp launch film | Launch | Everyone | 45 s | VO + music | homepage | Queued |

## Shared look

- Type: Ciscela (display, the site's headings) + Anderson Grotesk (UI, labels, captions).
- Colour: deep green #1a472a, cream #f6f4ee, one accent: gold #c9a84c (the logo's sun).
- Screens: the real Greenview demo estate screenshots in `public/images/blog/screens/`.
- Tutorials: a consistent step counter (1, 2, 3...), a highlight ring on the exact control, and
  captions that use the app's own button labels.
- Stock: Nigerian and African residents, guards, gates, homes and streets only. See `media/STOCK.md`.

## How a film gets made (any machine: your Mac or a cloud agent)

```bash
npm install                                            # once per machine (Mac also: npx playwright install chromium)
node tools/gemini.mjs batch media/generated/T2/shots.json   # pictures (needs GEMINI_API_KEY in .env)
node tools/gemini.mjs tts --text "..." --out films/T2-.../audio/vo-1.wav   # one file per voice-over line
node tools/gemini.mjs music --prompt "..." --out films/T2-.../audio/music.wav
node tools/mix.mjs films/T2-pay-service-charge             # music + voice-over -> audio/mix.wav
node tools/render.mjs films/T2-pay-service-charge --still 10,30   # quick layout check (renders/_stills/)
node tools/render.mjs films/T2-pay-service-charge          # both formats -> renders/
```

Work is shared through GitHub (`ajokhai/breeup-content`): agents commit and push, and you `git pull` on the Mac.

## Voice-over

Voice-over films use Gemini TTS (`gemini.mjs tts`, one file per line, placed by `film.json` "vo"),
or your own recording (a clean, dry take per line) dropped in with the same file names. Scripts are written before recording and timed at about
2.5 words a second.
