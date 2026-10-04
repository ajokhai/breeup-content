// H2 Homepage people loop (website's "We back them up" section): 4:5, muted-first, seamless 18 s loop.
// Three beats: the guard, the treasurer, the resident. Data on tools/kit/ad.js; the last scene is the first
// scene again, so the final frame flows back into frame one. No end card (end.t is past the duration).
import { ad } from '/kit/ad.js';

const HITS = [
  [6, 'whip', 'whoosh', { len: 0.35, from: 600, to: 3200, gain: 0.6 }],
  [7.3, 'ring paid', 'blip', { pitch: 'C6', gain: 0.6 }],
  [12, 'whip', 'whoosh', { len: 0.35, from: 3200, to: 600, gain: 0.6 }],
  [17.75, 'whip', 'whoosh', { len: 0.35, from: 600, to: 3200, gain: 0.6 }],
];

ad({
  hooks: { a: 'Guards check passes on their phone.' },
  scenes: [
    { t: 0, kind: 'photo', src: 'guard' },
    { t: 6, kind: 'screen', device: 'laptop', src: 'assets/screens/admin-payments.jpg', bg: 'guard',
      cam: [[6, [1.1, 0.5, 0.5]], [6.6, [1.9, 0.56, 0.42]]], rings: [{ r: [1130, 600, 150, 110], a: 7.3, b: 11.6 }],
      caption: 'Treasurers see who has paid.' },
    { t: 12, kind: 'photo', src: 'resident', caption: 'Residents get a receipt.' },
    { t: 17.75, kind: 'photo', src: 'guard' },
  ],
  end: { t: 19 },
  hits: HITS,
});
