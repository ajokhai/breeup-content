# Publishing films on the BreeUp website

The website is the `subbyems` repo (GitHub `ajokhai/subbyems`). Pushing to **`main`** deploys **https://breeup.com**
(Vercel, production; it reads the `subbyems_live` database). Branches and PR previews read `subbyems_dev`.

## Where things go

| What | Where in `subbyems` |
|---|---|
| Video files and covers | `public/videos/<name>.mp4`, `<name>-phone.mp4`, `<name>-poster.jpg`, `<name>-phone-poster.jpg` |
| Tutorials and explainers | A `video` block in the post's `body` in `content/blog/posts.js` (just after the first paragraph): `{ type: "video", src, poster, srcPhone?, posterPhone?, title, caption }`. Desktop plays `src`, phones (under 640 px) play `srcPhone`. |
| Homepage hero (H1) | `app/page.js`, `<LoopVideo src="/videos/home-hero.mp4" … sound={false} />` in the hero (desktop only; phones show `hero.jpg`) |
| Homepage "We back them up" (H2) | `app/page.js`, `<LoopVideo src="/videos/home-people.mp4" …/>` (4:5 slot, Sound on button) |
| Product screenshots | `public/images/blog/screens/` (780x1688 phone, 2160x1350 desktop) |

## Steps for a film marked READY FOR SITE

1. Copy each cut from `Final videos/` to `public/videos/` with a short name (keep the name when replacing a
   re-render). Make a cover from a clean frame (the title card, ~3 s in), about 1280 px, JPEG ~70%.
2. New film on a guide: add the `video` block to that post in `content/blog/posts.js`. Re-render of a published
   film: just replace the files.
3. Commit with explicit paths and push to `main`. Wait for the Vercel deploy (commit status "success").
4. **Database step (blog posts only):** posts live in MongoDB, and `posts.js` only seeds an empty database, so run
   `node scripts/publish-blog-videos.mjs live` (and `dev` for previews). It needs `MONGODB_URI` in `.env.local`,
   so Josh (or an agent on his Mac) runs it. Homepage videos need no database step.

## Live as of 2026-10-04

- **Guides** (wide + phone): T1 visitor pass, T2 pay service charge, T3 resident account, T4 bill residents,
  T5 recurring bills, T6 import residents, T7 admins and permissions.
- **Homepage:** H1 hero loop (desktop; H1 phone not made yet), H2 in "We back them up".
- **Not used on the site:** S1 (replaced by H2 on the homepage; social only), A1-A4 (ads).
- **Waiting:** H1 phone cut, L1 launch film (planned for a "Watch the film" button in the hero), E1-E4 explainers
  (their blog posts: whatsapp-group-vs-estate-management-software, collecting-service-charge-without-chasing-residents,
  visitor-passes-on-whatsapp, two-signature-payouts-and-agm-transparency).
