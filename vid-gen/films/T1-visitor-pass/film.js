// T1 How to send a visitor pass on WhatsApp (residents). Pure data on the shared tutorial kit.
// Times are seconds, matched to film.json "vo_at". The first version (no voice) is in archive/T1-visitor-pass-v1.
import { tutorial } from '/kit/tutorial.js';

const HITS = [
  [0, 'hook photo', 'sub', { len: 0.8 }],
  [4.6, 'green wipe', 'whoosh', { len: 0.5 }],
  [9.3, 'phone lands', 'thud'],
  [9.6, 'step 1', 'pop', { pitch: 'A5' }],
  [10.8, 'ring phone field', 'type', { len: 0.9, n: 8 }],
  [12.6, 'ring pin', 'type', { len: 0.6, n: 4 }],
  [15.6, 'tap sign in', 'click'],
  [16.8, 'home', 'whoosh', { len: 0.35, from: 2400, to: 700 }],
  [17.1, 'step 2', 'pop', { pitch: 'A5' }],
  [18, 'ring card', 'blip', { pitch: 'C6' }],
  [21.8, 'step 3', 'pop', { pitch: 'A5' }],
  [22.3, 'name', 'type', { len: 0.7, n: 6 }],
  [24.6, 'type chips', 'tick'],
  [27.3, 'create pass', 'click'],
  [28.3, 'step 4', 'pop', { pitch: 'A5' }],
  [28.8, 'code', 'tok', { pitch: 'F5' }],
  [30.3, 'ring whatsapp', 'blip', { pitch: 'C6' }],
  [32.2, 'tap whatsapp', 'click'],
  [32.6, 'swell', 'whoosh', { len: 0.6, from: 500, to: 3000 }],
  [33.6, 'gate photo', 'sub', { len: 0.6 }],
  [43, 'end card', 'impact'],
  [43.2, 'logo', 'bell', { pitch: 'F6' }],
];

tutorial({
  kicker: 'BREEUP TUTORIAL · RESIDENTS',
  photos: { hook: 'hook', why: 'why', tip: 'tip' },
  hook: { to: 4.6, gold: 'minute', lines: { '16x9': ['Send a visitor pass', 'in under a minute.'], '9x16': ['Send a visitor', 'pass in under', 'a minute.'] } },
  why: { to: 9.3, text: 'Guests, deliveries, cabs and artisans, cleared at the gate without a phone call.' },
  steps: [
    { t: 9.6, title: 'Sign in', body: "Open your estate's link. Sign in with your phone number and 4-digit PIN." },
    { t: 17.1, title: 'Find the card', body: 'On your Home page, look for the Visitor gate pass card.' },
    { t: 21.8, title: 'Name and type', body: "Type your visitor's name, choose the type of visit, then tap Create pass." },
    { t: 28.3, title: 'Send it', body: 'Tap Send on WhatsApp. Your visitor gets the code in seconds.' },
  ],
  phone: {
    to: 33.6,
    screens: { login: 'assets/screens/res-login-pin.jpg', home: 'assets/screens/res-home.jpg', pass: 'assets/screens/res-visitor-pass.jpg' },
    seq: [['login', 0], ['home', 16.8], ['pass', 21.6]],
    regions: {
      phone: [40, 704, 700, 84], pin: [40, 872, 508, 112], signin: [40, 1086, 700, 88], card: [32, 730, 716, 430],
      name: [74, 924, 632, 86], type: [74, 1026, 388, 82], create: [478, 1026, 228, 82], code: [74, 1150, 632, 260], wa: [104, 1446, 384, 70],
    },
    cam: [
      [10.6, [1.45, 0.5, 0.52]], [13.5, [1.35, 0.5, 0.6]], [16.8, [1, 0.5, 0.5]], [17.6, [1.5, 0.5, 0.56]],
      [21.6, [1.8, 0.5, 0.6]], [25.5, [1.7, 0.5, 0.62]], [28.3, [1.55, 0.5, 0.75]], [30.5, [1.9, 0.38, 0.87]],
    ],
    rings: [
      { r: 'phone', a: 10.8, b: 12.6 }, { r: 'pin', a: 12.6, b: 14.6 }, { r: 'signin', a: 14.6, b: 16.6, tap: 15.6 },
      { r: 'card', a: 18, b: 21.4 }, { r: 'name', a: 22.3, b: 24.4 }, { r: 'type', a: 24.4, b: 26.6 },
      { r: 'create', a: 26.6, b: 28, tap: 27.3 }, { r: 'code', a: 28.6, b: 30.3 }, { r: 'wa', a: 30.3, b: 33.4, tap: 32.2 },
    ],
  },
  chips: [{ text: 'Guest · Delivery · Cab · Artisan', a: 24.6, b: 27.6 }],
  codes: [{ text: 'SB-1279', label: 'ACCESS CODE', a: 28.8, b: 33.2 }],
  tip: { to: 43, kicker: 'AT THE GATE', title: 'The guard checks the code.', body: 'No calls to confirm. The guard still has the final say.' },
  end: { tagline: 'Visitor passes, dues, notices and records, all in one place.' },
  hits: HITS,
});
