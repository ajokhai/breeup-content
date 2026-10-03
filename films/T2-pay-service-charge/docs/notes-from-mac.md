# T2 notes from the Mac session (2026-10-04)

For the agent building T2. Rendered 9:16 on the Mac with `tools/render.mjs` (works there too; Playwright
Chromium installed). Gemini's full review is in `review-2026-10-03-breeup-T2-pay-service-charge-9x16.md`.
Below is what to fix, with the review's points settled against CLAUDE.md.

Also: `renders/breeup-T2-pay-service-charge-16x9.mp4` in git is a 48-byte empty file (the render was cut
off before it was committed). Re-render and replace it, or delete it.

## Fix (in this order)

1. **Hook is unreadable (0:00).** "Pay your" sits behind the woman. Put the title in front of the subject.
2. **9:16 tip scene text overflows.** "If you're asked to pay into a new..." runs off the right edge, and the
   headline sits over the man's face. Wrap to the safe width and place the text where there are no faces.
3. **Ligature in "Transfer" (0:24).** The display font joins "sf" so it reads like a typo. Set
   `font-variant-ligatures: none` (or `ctx.fontVariantLigatures` / strip `liga`/`dlig`) for display headings.
4. **Tip photo has a misspelled prop** ("ESTATE COMMITEE" on the folder) and white text on a bright wall.
   Keep a photo (rule 4: image-heavy), but regenerate it with no paper or folder props and a darker area for
   the text, or add a stronger scrim. Don't switch to a plain cream card as the review suggests.
5. **9:16 step captions are too small.** They look about 40 px; rule 3 says body at least 56 px and headings
   at least 96 px at 1080 wide.
6. **Steps are flat cream/green.** Rule 4 says every scene sits on a real photo or clip. Put a blurred,
   darkened photo of the resident (same person as the hook, via `--ref`) behind the phone stage.
7. **9:16 phone runs into the bottom 350 px** where Reels and TikTok put their UI. Raise it, or shrink the
   cream panel so the phone sits higher.

## Don't change

- The 0:03 shot of the man on his phone. The review wants the old `estate_aerial.jpg` instead, but the rules
  say not to reuse the website photos. If it feels repetitive, a generated aerial over a Lekki estate is fine.
- Gold rings, the GE-D3 stamp into the caption, the sun becoming the step dot, pacing and sound all scored
  well. Keep them.
