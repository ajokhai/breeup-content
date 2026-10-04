// T6 How to import residents from a spreadsheet (admins). Data on tools/kit/tutorial.js, laptop device.
import { tutorial } from '/kit/tutorial.js';

const HITS = [
  [0, 'hook photo', 'sub', { len: 0.8 }], [4.8, 'green wipe', 'whoosh', { len: 0.5 }], [9.3, 'laptop lands', 'thud'],
  [9.5, 'step 1', 'pop', { pitch: 'A5' }], [11, 'click', 'click'], [13, 'import csv', 'click'],
  [13.5, 'modal', 'whoosh', { len: 0.3, from: 2400, to: 700 }], [14, 'chip', 'tick'],
  [16.5, 'step 2', 'pop', { pitch: 'A5' }], [17, 'ring summary', 'blip', { pitch: 'C6' }], [20, 'ring ready', 'blip', { pitch: 'D6' }],
  [24, 'step 3', 'pop', { pitch: 'A5' }], [25.6, 'import', 'click'],
  [28, 'step 4', 'pop', { pitch: 'A5' }], [28.4, 'ring note', 'blip', { pitch: 'C6' }],
  [36.3, 'whip', 'whoosh', { len: 0.5, from: 600, to: 3000 }], [42.6, 'end card', 'impact'], [42.8, 'logo', 'bell', { pitch: 'F6' }],
];

tutorial({
  kicker: 'BREEUP TUTORIAL · ESTATE ADMINS',
  photos: { hook: 'hook', why: 'why', tip: 'tip' },
  hook: { to: 4.8, gold: 'spreadsheet.', lines: { '16x9': ['Import residents from', 'a spreadsheet.'], '9x16': ['Import residents', 'from a', 'spreadsheet.'] } },
  why: { to: 9.3, text: 'No retyping. Every household, in one go.' },
  steps: [
    { t: 9.5, title: 'Open Households', body: 'Choose Households in the sidebar, then click Import CSV and pick your file.' },
    { t: 16.5, title: 'Check the preview', body: 'See how many rows are ready, and why any need fixing.' },
    { t: 24, title: 'Import', body: 'Click Import. Your households appear straight away.' },
    { t: 28, title: 'Share the PINs', body: "Each household's temporary PIN is shown once, with a download." },
  ],
  phone: {
    device: 'laptop',
    to: 36.3,
    screens: { list: 'assets/screens/admin-households.jpg', import: 'assets/screens/admin-csv-import.jpg' },
    seq: [['list', 0], ['import', 13.5]],
    regions: {
      sidebar: [16, 276, 340, 52], importBtn: [1754, 180, 146, 44],
      summary: [764, 340, 632, 130], status: [1290, 560, 100, 310], importModal: [998, 1066, 398, 52], note: [764, 898, 632, 140],
    },
    cam: [
      [10, [2.2, 0.1, 0.22]], [12, [2.3, 0.85, 0.15]], [13.6, [1.5, 0.5, 0.45]], [17, [1.9, 0.5, 0.3]], [20, [1.9, 0.55, 0.52]],
      [24.2, [2.1, 0.55, 0.8]], [28.2, [1.9, 0.5, 0.71]],
    ],
    rings: [
      { r: 'sidebar', a: 10.2, b: 11.8, tap: 11 }, { r: 'importBtn', a: 12.2, b: 13.4, tap: 13 },
      { r: 'summary', a: 17, b: 19.8 }, { r: 'status', a: 20, b: 23.6 }, { r: 'importModal', a: 24.4, b: 26.6, tap: 25.6 },
      { r: 'note', a: 28.4, b: 35.8 },
    ],
  },
  chips: [{ text: 'Unit · Name · Phone · Email', a: 14, b: 16.2 }],
  tip: { to: 42.6, kicker: 'GOOD TO KNOW', title: 'Start from the template.', body: 'Download it from Households, paste your data in, then import.' },
  hits: HITS,
});
