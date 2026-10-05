# Clipwalk: make a product video from a link

Clipwalk clicks through a website or web app for you, keeps a clean screenshot of every step, and turns them into a
narrated how-to video for phones (9:16) and widescreens (16:9).

## Start it

```bash
cd videos/vid-gen
npm install                      # once
npx playwright install chromium  # once
npm run studio
```

Open http://localhost:4747. The first time, a short tour shows you around.

## Make a video

1. **Paste your app's link** in the big box and pick a style (App walkthrough, or Like a video I saw).
2. **Say what to show**, as one task: "Sign in, open Billing and pay by card. Stop before paying."
3. Tick **My app needs a login** if it does, and give a demo account. The password is used once and thrown away.
4. Check the name, logo and colour it found on your site, then **Yes, make it**.

## Change it

Open the video. Tap a clip at the bottom to change its words, move it or remove it. Use **Music**, **Colour** and
**Voice** on the right.

**Timeline (for more control):** switch the bottom strip from Simple to **Timeline**. Clips are sized by their length on
a ruler, with the music underneath (its beat and the drop). Drag a clip's right edge to make it longer or shorter, drag
a clip to move it, click the ruler to move the playhead, and press **Cut** (or S) to split the clip under it. Selecting
a clip opens its own panel: length, words, the tap circle or zoom, cut, duplicate (D), move, remove (Backspace).
Launch films keep every cut on the beat, so lengths snap to it when you update. The preview changes straight away; press **Update video**, then **Download** (phones or computers).

Then a few optional questions, filled in from your website where possible: product name, logo, colour, the line and
link on the end card, the voice, an opening stock photo or video, and **another view** (e.g. the admin on a computer,
then a customer on their phone). Change anything, or press **Skip, just make it**.

The price is shown in credits before you press go. Credits only come off when the video is finished.

## Make it look like your brand

Settings → Brand: product name, colours, logo and the line on the end card. Every new video uses them.

## Change a video

My videos → open one → **Fine-tune**: edit the words, music, timing or colours, then render again (free).

## Credits and friends (for whoever runs Clipwalk)

Settings → People and credits: add a person to get their access code, and add credits when they pay you
(1 credit = $0.10 by default; Pricing → "For you" shows the real costs and suggested credit prices).

To let friends in, start it with `HOST=0.0.0.0 npm run studio` and send `http://<your computer's address>:4747` on
the same Wi-Fi, or run a tunnel such as `cloudflared tunnel --url http://localhost:4747` for anyone, anywhere. Anyone
who isn't on your computer needs their code, only sees their own videos, and can't change settings. Their videos use
their own name and colours, never yours.

## Keys

Settings → API keys. Clipwalk needs a Gemini key (voice, music, reviews) and a TypeSafe key (Jev: the cheap checks
and the cheapest way to click through). A free Pexels key (and optionally Pixabay) adds stock photos and video.
They stay on your computer, in `videos/.env`.

## If it gets stuck

Make the goal shorter, check the link opens, or tick "It needs a login". It stops on CAPTCHAs and one-time codes,
and it won't press anything that pays, deletes or sends unless you allow it.
