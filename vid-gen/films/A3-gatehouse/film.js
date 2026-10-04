// A3 A calmer gatehouse (visitor passes). Paid ad for committees and security leads. Data on tools/kit/ad.js.
import { ad } from '/kit/ad.js';

const HITS = [
  [0, 'hook', 'sub', { len: 0.7 }],
  [3, 'whip', 'whoosh', { len: 0.35, from: 600, to: 3200 }],
  [4, 'ring', 'blip', { pitch: 'C6' }],
  [5.6, 'tap', 'click'],
  [6.5, 'whip', 'whoosh', { len: 0.35, from: 3200, to: 600 }],
  [10, 'whip', 'whoosh', { len: 0.35, from: 600, to: 3200 }],
  [12.5, 'end card', 'impact'],
  [13.3, 'button', 'pop', { pitch: 'A5' }],
];

ad({
  hooks: {
    a: 'A calmer gatehouse.',
    b: 'No more calls to confirm visitors.',
    c: "Your guest's pass, sent on WhatsApp.",
  },
  scenes: [
    { t: 0, kind: 'photo', src: 'gate' },
    { t: 3, kind: 'screen', device: 'phone', src: 'assets/screens/res-visitor-pass.jpg', bg: 'gate',
      cam: [[3, [1, 0.5, 0.5]], [3.6, [1.45, 0.45, 0.82]]],
      rings: [{ r: [74, 1150, 632, 260], a: 4, b: 5.3 }, { r: [104, 1446, 384, 70], a: 5.3, b: 6.4, tap: 5.6 }],
      caption: 'Residents create a pass in two taps, and send it on WhatsApp.' },
    { t: 6.5, kind: 'photo', src: 'guest', caption: 'The guard checks it on their phone.' },
    { t: 10, kind: 'photo', src: 'gate', caption: 'Every entry on record. The guard still has the final say.' },
  ],
  end: { t: 12.5, line: 'Set up your estate free', url: 'breeup.com' },
  hits: HITS,
});
