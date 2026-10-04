// A2 The estate keeps every naira it bills (trust). Paid ad for committees and treasurers. Data on tools/kit/ad.js.
// Claims only from Marketing/1 Brand and messaging.md "Key messages (all true)".
import { ad } from '/kit/ad.js';

const HITS = [
  [0, 'hook', 'sub', { len: 0.7 }],
  [3, 'whip', 'whoosh', { len: 0.35, from: 600, to: 3200 }],
  [3.2, 'line 1', 'pop', { pitch: 'A5' }], [3.65, 'line 2', 'bell', { pitch: 'C6' }],
  [6.8, 'whip', 'whoosh', { len: 0.35, from: 3200, to: 600 }],
  [7, 'line', 'pop', { pitch: 'A5' }],
  [9.8, 'whip', 'whoosh', { len: 0.35, from: 600, to: 3200 }],
  [10, 'line', 'pop', { pitch: 'A5' }],
  [12.5, 'end card', 'impact'],
  [13.3, 'button', 'pop', { pitch: 'A5' }],
];

ad({
  hooks: {
    a: 'The estate keeps every naira it bills.',
    b: 'Bill ₦25,000. Receive ₦25,000.',
    c: 'Whose account does your levy land in?',
  },
  scenes: [
    { t: 0, kind: 'photo', src: 'trust' },
    { t: 3, kind: 'type', bg: 'trust', lines: ['Bill ₦25,000.', 'Receive ₦25,000.'], gold: 1,
      caption: "A small fee is added for the resident, shown before they pay." },
    { t: 6.8, kind: 'type', bg: 'trust', lines: ["The estate's own", 'account.'], gold: 1,
      caption: 'With our licensed banking partner, paying out to your bank.' },
    { t: 9.8, kind: 'type', bg: 'trust', lines: ['Large payouts can need', 'a second approver.'], gold: 1,
      caption: 'Your people stay in charge.' },
  ],
  end: { t: 12.5, line: 'Set up your estate free', url: 'breeup.com' },
  hits: HITS,
});
