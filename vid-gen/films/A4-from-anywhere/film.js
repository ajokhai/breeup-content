// A4 See who has paid, from anywhere. Paid ad for landlords, including the diaspora. Data on tools/kit/ad.js.
import { ad } from '/kit/ad.js';

const HITS = [
  [0, 'hook', 'sub', { len: 0.7 }],
  [3.2, 'whip', 'whoosh', { len: 0.35, from: 600, to: 3200 }],
  [4.4, 'ring paid', 'blip', { pitch: 'C6' }],
  [7.5, 'whip', 'whoosh', { len: 0.35, from: 3200, to: 600 }],
  [12.5, 'end card', 'impact'],
  [13.3, 'button', 'pop', { pitch: 'A5' }],
];

ad({
  hooks: {
    a: 'See who has paid, from anywhere.',
    b: 'Own a compound in Nigeria? Watch it from abroad.',
  },
  scenes: [
    { t: 0, kind: 'photo', src: 'abroad' },
    { t: 3.2, kind: 'screen', device: 'laptop', src: 'assets/screens/admin-payments.jpg', bg: 'abroad',
      cam: [[3.2, [1.1, 0.5, 0.5]], [3.8, [1.8, 0.45, 0.6]]], rings: [{ r: [1130, 600, 150, 400], a: 4.4, b: 7.2 }],
      caption: 'Every payment, recorded against each home.' },
    { t: 7.5, kind: 'photo', src: 'compound', caption: 'Rent and charges paid and visible, without being there.' },
  ],
  end: { t: 12.5, line: 'Set up your estate free', url: 'breeup.com' },
  hits: HITS,
});
