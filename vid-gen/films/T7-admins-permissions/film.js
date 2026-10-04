// T7 How to add admins and set permissions (admins). Data on tools/kit/tutorial.js, laptop device.
import { tutorial } from '/kit/tutorial.js';

const HITS = [
  [0, 'hook photo', 'sub', { len: 0.8 }], [4.6, 'green wipe', 'whoosh', { len: 0.5 }], [8.9, 'laptop lands', 'thud'],
  [9.1, 'step 1', 'pop', { pitch: 'A5' }], [10.4, 'click', 'click'], [12.3, 'add admin', 'click'],
  [12.8, 'modal', 'whoosh', { len: 0.3, from: 2400, to: 700 }],
  [15.3, 'step 2', 'pop', { pitch: 'A5' }], [15.6, 'name', 'type', { len: 0.7, n: 6 }], [17.4, 'email', 'type', { len: 0.7, n: 7 }],
  [23.2, 'step 3', 'pop', { pitch: 'A5' }], [23.4, 'ring role', 'blip', { pitch: 'C6' }],
  [29.4, 'step 4', 'pop', { pitch: 'A5' }], [30.5, 'chip', 'tick'], [35, 'tick export', 'click'],
  [38.9, 'whip', 'whoosh', { len: 0.5, from: 600, to: 3000 }], [45.6, 'end card', 'impact'], [45.8, 'logo', 'bell', { pitch: 'F6' }],
];

tutorial({
  kicker: 'BREEUP TUTORIAL · ESTATE ADMINS',
  photos: { hook: 'hook', why: 'why', tip: 'tip' },
  hook: { to: 4.6, gold: 'login.', lines: { '16x9': ['Give every helper', 'their own login.'], '9x16': ['Give every', 'helper their', 'own login.'] } },
  why: { to: 8.9, text: 'Each person sees only what they need, and you can tell who did what.' },
  steps: [
    { t: 9.1, title: 'Open Admins & roles', body: 'Choose Admins & roles in the sidebar, then click Add Admin User.' },
    { t: 15.3, title: 'Name and email', body: 'Leave the password blank for a temporary one, shown once.' },
    { t: 23.2, title: 'Pick a role', body: 'Estate Manager, Financial Officer, Security Officer or Super Admin.' },
    { t: 29.4, title: 'Fine-tune access', body: 'Full, read-only or no access for each area. Exports only if needed.' },
  ],
  phone: {
    device: 'laptop',
    to: 38.9,
    screens: { list: 'assets/screens/admin-users.jpg', add: 'assets/screens/admin-add-admin.jpg' },
    seq: [['list', 0], ['add', 12.8]],
    regions: {
      sidebar: [16, 700, 340, 52], addBtn: [1892, 170, 212, 52],
      name: [764, 212, 632, 52], email: [764, 322, 632, 52], password: [764, 432, 632, 52], role: [764, 542, 632, 58],
      matrix: [764, 780, 632, 500], csv: [764, 622, 632, 92],
    },
    cam: [
      [9.6, [2.2, 0.1, 0.53]], [11.3, [2.3, 0.92, 0.14]], [12.9, [1.5, 0.5, 0.35]], [15.6, [2, 0.5, 0.2]], [18.5, [2, 0.5, 0.36]],
      [23.4, [2, 0.5, 0.42]], [29.6, [1.7, 0.5, 0.7]], [34, [2, 0.5, 0.49]],
    ],
    rings: [
      { r: 'sidebar', a: 9.6, b: 11, tap: 10.4 }, { r: 'addBtn', a: 11.3, b: 12.7, tap: 12.3 },
      { r: 'name', a: 15.6, b: 17.4 }, { r: 'email', a: 17.4, b: 19 }, { r: 'password', a: 19, b: 22.6 },
      { r: 'role', a: 23.4, b: 28.8 }, { r: 'matrix', a: 29.6, b: 33.8 }, { r: 'csv', a: 34, b: 38.6, tap: 35 },
    ],
  },
  chips: [{ text: 'Full · Read-only · No access', a: 30.5, b: 33.8 }],
  tip: { to: 45.6, kicker: 'GOOD TO KNOW', title: 'Give people the least access they need.', body: 'Fewer people with export rights means less resident data leaving the platform.' },
  hits: HITS,
});
