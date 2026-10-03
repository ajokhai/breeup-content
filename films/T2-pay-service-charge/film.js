// T2 How to pay your service charge online. Pure data on the shared tutorial kit (tools/kit/tutorial.js).
// Times are seconds, matched to the voice-over starts in film.json "vo".
import { tutorial } from '/kit/tutorial.js';

const HITS = [
  [0, 'hook photo', 'sub', {len: 0.8}],
  [0.25, 'title word', 'tick'],
  [0.56, 'title word', 'tick'],
  [0.88, 'title word', 'tick'],
  [1.19, 'title word', 'tick'],
  [3.75, 'green wipe', 'whoosh', {len: 0.5}],
  [7.5, 'intro card', 'bell', {pitch: 'F5'}],
  [10, 'phone lands', 'thud'],
  [10.31, 'step 1', 'pop', {pitch: 'A5'}],
  [11.88, 'ring phone field', 'blip', {pitch: 'C6'}],
  [13.44, 'ring pin', 'blip', {pitch: 'D6'}],
  [15.94, 'tap sign in', 'click'],
  [17.19, 'screen change', 'whoosh', {len: 0.35, from: 2400, to: 700}],
  [18.13, 'step 2', 'pop', {pitch: 'A5'}],
  [18.75, 'ring bills tab', 'blip', {pitch: 'C6'}],
  [19.69, 'bill card', 'pop', {pitch: 'E5'}],
  [20, 'tap bills', 'click'],
  [20.94, 'ring amount', 'blip', {pitch: 'C6'}],
  [22.81, 'tap pay', 'click'],
  [23.63, 'screen change', 'whoosh', {len: 0.35, from: 2400, to: 700}],
  [24.06, 'step 3', 'pop', {pitch: 'A5'}],
  [26.88, 'ring account', 'blip', {pitch: 'C6'}],
  [27.81, 'copy account', 'click'],
  [32.19, 'ring reference', 'blip', {pitch: 'D6'}],
  [32.5, 'GE', 'tok', {pitch: 'F5'}],
  [32.81, 'D3', 'tok', {pitch: 'A5'}],
  [35, 'copy reference', 'click'],
  [38.13, 'screen change', 'whoosh', {len: 0.35, from: 2400, to: 700}],
  [38.44, 'step 4', 'pop', {pitch: 'A5'}],
  [39.69, 'ring 3 months', 'blip', {pitch: 'C6'}],
  [40.94, 'ring 1 year', 'blip', {pitch: 'D6'}],
  [41.88, 'save chip', 'bell', {pitch: 'C6'}],
  [44.38, 'tap pay', 'click'],
  [44.69, 'pay grows', 'whoosh', {len: 0.6, from: 500, to: 3000}],
  [45.63, 'tip photo', 'sub', {len: 0.6}],
  [55, 'end card', 'impact'],
  [55.31, 'logo', 'bell', {pitch: 'F6'}]

];

tutorial({
  kicker: 'BREEUP TUTORIAL · RESIDENTS',
  photos: { hook: 'hook', why: 'why', tip: 'tip' },
  hook: { to: 3.94, gold: 'phone', lines: { '16x9': ['Pay your service charge', 'from your phone.'], '9x16': ['Pay your service', 'charge from', 'your phone.'] } },
  why: { to: 7.6, text: 'Your payment, recorded against your home, with a receipt.' },
  intro: { to: 10, lines: ["Here's how,", 'in four steps.'] },
  steps: [
    { t: 10, title: 'Sign in', body: "Open your estate's link. Sign in with your phone number and 4-digit PIN." },
    { t: 18.1, title: 'Open Bills', body: "Tap Bills to see what you owe and when it's due." },
    { t: 24.1, title: 'Transfer', body: 'Pay into the estate account from any bank app, with your unit reference.' },
    { t: 38.4, title: 'Or pay ahead', body: "Pay a few months at once. You won't be billed for them again." },
  ],
  phone: {
    to: 45.6,
    screens: { login: 'assets/screens/res-login-pin.jpg', home: 'assets/screens/res-home.jpg', bills: 'assets/screens/res-bills.jpg', ahead: 'assets/screens/res-pay-ahead.jpg', portal: 'assets/screens/portal-bills.jpg' },
    seq: [['login', 0], ['home', 17.2], ['bills', 23.6], ['ahead', 38.1]],
    regions: {
      phone: [40, 704, 700, 84], pin: [40, 872, 508, 112], signin: [40, 1086, 700, 88], billsTab: [236, 1578, 118, 96],
      acctCopy: [358, 548, 142, 60], ref: [106, 1110, 196, 86], refCopy: [322, 1122, 140, 60],
      m3: [74, 826, 308, 180], y1: [398, 826, 308, 180], pay: [74, 1090, 236, 72],
    },
    cam: [
      [11.6, [1.45, 0.5, 0.52]], [14.4, [1.35, 0.5, 0.6]], [17.2, [1, 0.5, 0.5]], [18.4, [1.7, 0.36, 0.93]], [20.6, [1, 0.5, 0.5]],
      [24.7, [1.5, 0.5, 0.4]], [30.3, [1.6, 0.5, 0.67]], [37.2, [1, 0.5, 0.5]], [39.1, [1.45, 0.5, 0.56]], [43.1, [1.6, 0.4, 0.66]],
    ],
    rings: [
      { r: 'phone', a: 11.9, b: 13.4 }, { r: 'pin', a: 13.4, b: 15 }, { r: 'signin', a: 15, b: 16.6, tap: 15.9 },
      { r: 'billsTab', a: 18.75, b: 20.6, tap: 20 },
      { r: 'acctCopy', a: 26.9, b: 29.4, tap: 27.8 }, { r: 'ref', a: 32.2, b: 34.4 }, { r: 'refCopy', a: 34.4, b: 36.9, tap: 35 },
      { r: 'm3', a: 39.7, b: 40.9 }, { r: 'y1', a: 40.9, b: 43.4 }, { r: 'pay', a: 43.4, b: 45, tap: 44.4 },
    ],
  },
  // the real desktop Bills row: "Estate Levy · Overdue · Due 31 Mar 2026" and "₦45,000 Pay" (the empty middle is cut)
  cards: [{ src: 'portal', parts: [[392, 486, 600, 114], [1480, 486, 288, 114]], a: 19.7, b: 23.5,
    rings: [{ x: 620, w: 146, a: 20.9, b: 22.2 }, { x: 776, w: 86, a: 22.2, b: 23.5, tap: 22.8 }] }],
  codes: [{ text: 'GE-D3', label: 'YOUR UNIT REFERENCE', a: 32.5, b: 37.6 }],
  chips: [{ text: '1 year: you save ₦25,000', a: 41.9, b: 44.25 }],
  tip: { to: 55.1, title: 'Estates rarely change their bank account.', body: "If you're asked to pay into a new one, call a committee member first." },
  end: { tagline: 'Dues, gate access, approvals and notices in one place.' },
  hits: HITS,
});
