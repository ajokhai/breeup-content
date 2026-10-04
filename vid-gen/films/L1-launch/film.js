// L1 BreeUp launch film: ~45 s brand film for the website ("Watch the film") and the YouTube channel trailer.
// Data on tools/kit/ad.js, with voice-over (film.json "vo"); each scene's caption is its spoken line.
// Scene starts follow the voice-over starts: after `make --only vo`, set each t to its line's start minus ~0.2 s.
import { ad } from '/kit/ad.js';

const HITS = [
  [0, 'open', 'sub', { len: 1.2 }],
  [3.1, 'whip', 'whoosh', { len: 0.35, from: 600, to: 3200 }],
  [6.7, 'whip', 'whoosh', { len: 0.35, from: 3200, to: 600 }],
  [7.2, 'question', 'tick'], [8.6, 'question', 'tick'], [10.2, 'question', 'tick'],
  [12.7, 'answer', 'impact'],
  [14.7, 'whip', 'whoosh', { len: 0.35, from: 600, to: 3200 }],
  [16.5, 'ring paid', 'blip', { pitch: 'C6' }],
  [21.1, 'whip', 'whoosh', { len: 0.35, from: 3200, to: 600 }],
  [22.6, 'tap create pass', 'click'],
  [24.2, 'tap whatsapp', 'click'],
  [26.8, 'whip', 'whoosh', { len: 0.35, from: 600, to: 3200 }],
  [32.4, 'whip', 'whoosh', { len: 0.35, from: 3200, to: 600 }],
  [32.8, 'naira', 'bell', { pitch: 'C6' }],
  [36.5, 'whip', 'whoosh', { len: 0.35, from: 600, to: 3200 }],
  [39.5, 'end card', 'impact'],
  [39.8, 'logo', 'bell', { pitch: 'F6' }],
];

ad({
  hooks: { a: 'Every estate has a group chat.' },
  scenes: [
    { t: 0, kind: 'photo', src: 'chat' },
    { t: 3.1, kind: 'photo', src: 'aerial', caption: 'And every group chat asks the same questions.' },
    { t: 6.7, kind: 'type', bg: 'chat', lines: ['Who has paid?', 'Who is at the gate?', 'Did everyone see the notice?'], caption: '' },
    { t: 12.7, kind: 'type', bg: 'aerial', lines: ['BreeUp answers', 'all three.'], gold: 1, caption: '' },
    { t: 14.7, kind: 'screen', device: 'laptop', src: 'assets/screens/admin-payments.jpg', bg: 'pay',
      cam: [[14.7, [1.1, 0.5, 0.5]], [15.6, [1.8, 0.45, 0.6]]], rings: [{ r: [1130, 590, 150, 670], a: 16.5, b: 20.6 }],
      caption: 'Residents pay by card or transfer in a minute, and every payment lands against their home.' },
    { t: 21.1, kind: 'screen', device: 'phone', src: 'assets/screens/res-visitor-pass.jpg', bg: 'gate',
      cam: [[21.1, [1, 0.5, 0.5]], [22, [1.5, 0.5, 0.68]]],
      rings: [{ r: [479, 1028, 227, 80], a: 22, b: 23.4, tap: 22.6 }, { r: [104, 1446, 384, 71], a: 23.6, b: 26.4, tap: 24.2 }],
      caption: 'Visitors get a pass on WhatsApp, and the guard checks it in seconds.' },
    { t: 26.8, kind: 'photo', src: 'agm', caption: 'Notices reach the right homes, and the records are ready for the AGM.' },
    { t: 32.4, kind: 'type', bg: 'why', lines: ['The estate keeps', 'every naira.'], gold: 1, caption: '' },
    { t: 36.5, kind: 'photo', src: 'why', caption: 'BreeUp. Estate management for Nigerian communities.' },
  ],
  end: { t: 39.5, line: 'Set up your estate free', url: 'breeup.com' },
  hits: HITS,
});
