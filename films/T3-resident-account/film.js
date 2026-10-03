// T3 How to set up your resident account. Pure data on the shared tutorial kit (tools/kit/tutorial.js).
// Times are seconds, matched to the voice-over starts in film.json "vo".
import { tutorial } from '/kit/tutorial.js';

const HITS = [
  [0, 'hook photo', 'sub', { len: 0.8 }],
  [5, 'green wipe', 'whoosh', { len: 0.5 }],
  [10.6, 'phone lands', 'thud'],
  [11, 'step 1', 'pop', { pitch: 'A5' }],
  [13.5, 'ring estate name', 'blip', { pitch: 'C6' }],
  [19.1, 'step 2', 'pop', { pitch: 'A5' }],
  [19.6, 'ring phone field', 'type', { len: 0.9, n: 8 }],
  [23.2, 'step 3', 'pop', { pitch: 'A5' }],
  [23.8, 'ring pin', 'type', { len: 0.6, n: 4 }],
  [30.3, 'step 4', 'pop', { pitch: 'A5' }],
  [30.6, 'pin sheet', 'whoosh', { len: 0.35, from: 2400, to: 700 }],
  [32.5, 'new pin', 'type', { len: 0.6, n: 4 }],
  [35.5, 'type again', 'type', { len: 0.6, n: 4 }],
  [35.6, 'avoid chip', 'tick'],
  [39.6, 'save', 'click'],
  [41, 'step 5', 'pop', { pitch: 'A5' }],
  [41.2, 'home', 'whoosh', { len: 0.35, from: 2400, to: 700 }],
  [42, 'ring status', 'blip', { pitch: 'C6' }],
  [45, 'ring pass card', 'blip', { pitch: 'D6' }],
  [47.8, 'tap', 'click'],
  [48.3, 'swell', 'whoosh', { len: 0.6, from: 500, to: 3000 }],
  [49.3, 'tip photo', 'sub', { len: 0.6 }],
  [55.6, 'end card', 'impact'],
  [55.8, 'logo', 'bell', { pitch: 'F6' }],
];

tutorial({
  kicker: 'BREEUP TUTORIAL · RESIDENTS',
  photos: { hook: 'hook', why: 'why', tip: 'tip' },
  hook: { to: 5, gold: 'minutes', lines: { '16x9': ['Set up your resident', 'account in two minutes.'], '9x16': ['Set up your', 'resident account', 'in two minutes.'] } },
  why: { to: 10.6, text: 'No app to download. Just your phone number and a 4-digit PIN.' },
  steps: [
    { t: 11, title: 'Open your link', body: "Tap the sign-in link your estate admin sent. Your estate's name is at the top." },
    { t: 19.1, title: 'Your phone number', body: 'Type it any way you like. Your email works too, if your estate has it.' },
    { t: 23.2, title: 'Temporary PIN', body: 'Enter the 4 digits your estate admin gave you. It only works for your first sign-in.' },
    { t: 30.3, title: 'Choose your PIN', body: 'Pick 4 digits only you know, and type them twice.' },
    { t: 41, title: "You're in", body: 'Home shows what you owe, your latest notices and the visitor pass card.' },
  ],
  phone: {
    to: 49.3,
    screens: { login: 'assets/screens/res-login-pin.jpg', choose: 'assets/screens/res-choose-pin.jpg', home: 'assets/screens/res-home.jpg' },
    seq: [['login', 0], ['choose', 30.6], ['home', 41.2]],
    regions: {
      estate: [30, 50, 520, 110], phone: [40, 704, 700, 84], pin: [40, 872, 508, 112],
      newPin: [42, 1142, 512, 112], again: [42, 1338, 512, 112], save: [42, 1552, 696, 88],
      status: [32, 296, 716, 404], pass: [32, 730, 716, 430],
    },
    cam: [
      [13, [1.6, 0.4, 0.07]], [18.8, [1.4, 0.5, 0.45]], [23, [1.45, 0.4, 0.55]], [30.4, [1, 0.5, 0.5]],
      [32, [1.35, 0.4, 0.72]], [35.3, [1.35, 0.4, 0.82]], [38.3, [1.3, 0.5, 0.9]], [41, [1, 0.5, 0.5]],
      [42, [1.2, 0.5, 0.3]], [45, [1.2, 0.5, 0.55]],
    ],
    rings: [
      { r: 'estate', a: 13.5, b: 17.5 }, { r: 'phone', a: 19.6, b: 22.8 }, { r: 'pin', a: 23.8, b: 29.6 },
      { r: 'newPin', a: 32.5, b: 35.3 }, { r: 'again', a: 35.5, b: 38.3 }, { r: 'save', a: 38.6, b: 40.7, tap: 39.6 },
      { r: 'status', a: 42, b: 44.8 }, { r: 'pass', a: 45, b: 48.4, tap: 47.8 },
    ],
  },
  chips: [{ text: 'Avoid 1234, 1111 or your house number', a: 35.6, b: 40.6 }],
  tip: { to: 55.6, kicker: 'GOOD TO KNOW', title: 'Make it feel like an app.', body: 'In your browser menu, tap Add to Home Screen. It then opens from an icon.' },
  end: { tagline: 'Dues, gate access, approvals and notices in one place.' },
  hits: HITS,
});
