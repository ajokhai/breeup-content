# Image prompt notes

What has worked with `tools/gemini.mjs`. Add to this every time you learn something. Newest first.

## Defaults

- Model `gemini-3-pro-image` (best realism). `gemini-3.1-flash-image` is faster and cheaper for drafts.
- `--size 2K` gives 2752x1536 (16:9) or 1536x2752 (9:16), enough for full-frame 1080p with room to push in.
  `--size 4K` gives 5504x3072 (~10 MB). Use it for hard crops and slow zooms.
- Video: `veo-3.1-generate-preview`, 8 s, 1080p. Give it a good still as `--image` for the first frame,
  so the people and place are already approved before you spend a video generation.
- The house style (in `gemini.mjs`) adds the documentary-photo, Nigerian-estate and no-text directions.
  Your prompt only needs the subject, the action, the place and the light.

## Prompt shape that works

> [Who: nationality, age, role, clothes] [doing what, candidly] [where: specific estate detail]
> [light and time of day] [framing note for the format].

Examples that produced keepers (2026-10-03 trials, `media/generated/_trials/`):

- "A Nigerian woman in her thirties sits on a cushioned chair in her living room in a Lekki estate home,
  typing on her smartphone and smiling slightly. Afternoon light from a window." Both variants usable:
  warm, believable, with water tank and razor wire outside the window.
- "Vertical phone-format photo. A Nigerian man in his late twenties ... stands on the front porch of a
  duplex in a gated estate, reading his phone. Subject in the middle third of the frame, sky and roofline
  above him, paving below, leaving clear space at top and bottom." This gives a good 9:16 frame with room
  for captions above and below.
- "Five members of a residents' association executive committee, Nigerian men and women aged 35 to 65,
  meet around a table in an estate clubhouse ..." Excellent: varied ages, gele, generator outside.

## Known problems and fixes

- **Number plates and car badges** came out as readable gibberish ("DUIFAYO") with a Toyota badge. The house
  style now asks for plates out of frame or too soft to read. Check every car shot anyway.
- Ask for "nobody looking into the camera" (already in the house style), or people pose like ad models.
- For 9:16, say "vertical phone-format photo" and describe where the subject sits in the frame and where the
  empty space is, or the subject fills the frame and there's nowhere for captions.
- The model sometimes adds a warm, HDR-ish grade. If it looks too golden, add "neutral daylight white
  balance, overcast soft light".
