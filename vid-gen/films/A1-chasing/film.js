// A1 Still chasing service charge on WhatsApp? Paid ad for estate committees (Marketing/4 Ads plan.md).
// Data on tools/kit/ad.js: muted-first captions, three hook variants, 9:16 / 4:5 / 1:1.
import { ad } from '/kit/ad.js';

const HITS = [
  [0, 'hook', 'sub', { len: 0.7 }],
  [3, 'whip', 'whoosh', { len: 0.35, from: 600, to: 3200 }],
  [4.2, 'ring', 'blip', { pitch: 'C6' }],
  [6.5, 'whip', 'whoosh', { len: 0.35, from: 3200, to: 600 }],
  [7.6, 'ring paid', 'blip', { pitch: 'D6' }],
  [10, 'whip', 'whoosh', { len: 0.35, from: 600, to: 3200 }],
  [12.5, 'end card', 'impact'],
  [13.3, 'button', 'pop', { pitch: 'A5' }],
];

ad({
  hooks: {
    a: 'Still chasing service charge on WhatsApp?',
    b: 'Who has paid this month? No more scrolling the group.',
    c: 'Your treasurer deserves a break.',
  },
  scenes: [
    { t: 0, kind: 'clip', src: 'chasing' },
    { t: 3, kind: 'screen', device: 'laptop', src: 'assets/screens/admin-autobill.jpg', bg: 'chasing', crop: [420, 240, 1000, 800],
      cam: [[3, [1, 0.5, 0.5]], [3.6, [1.25, 0.5, 0.35]]], rings: [{ r: [426, 262, 990, 200], a: 4.2, b: 6.2 }],
      caption: 'Bills go out to every home, on schedule.' },
    { t: 6.5, kind: 'screen', device: 'laptop', src: 'assets/screens/admin-payments.jpg', bg: 'chasing', crop: [880, 540, 1220, 740],
      cam: [[6.5, [1, 0.5, 0.5]], [7.1, [1.3, 0.3, 0.45]]], rings: [{ r: [1130, 600, 150, 400], a: 7.6, b: 9.8 }],
      caption: 'See who has paid at a glance.' },
    { t: 10, kind: 'photo', src: 'relaxed', caption: 'Collect without chasing.' },
  ],
  end: { t: 12.5, line: 'Set up your estate free', url: 'breeup.com' },
  hits: HITS,
});
