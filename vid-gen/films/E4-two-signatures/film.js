// Two-signature payouts and an easier AGM (explainer). Written by tools/explainer.mjs from docs/scenes.json and the voice timings in
// film.json; edit scenes.json and re-run it rather than editing this file.
import { ad } from '/kit/ad.js';

const HITS = [
  [0,"open","sub",{"len":0.7}],
  [8.2,"type","pop",{"pitch":"A5"}],
  [8.05,"whip","whoosh",{"len":0.35,"from":600,"to":3200}],
  [18.21,"type","pop",{"pitch":"A5"}],
  [18.06,"whip","whoosh",{"len":0.35,"from":3200,"to":600}],
  [29.17,"ring","blip",{"pitch":"C6"}],
  [27.97,"whip","whoosh",{"len":0.35,"from":600,"to":3200}],
  [38.12,"whip","whoosh",{"len":0.35,"from":3200,"to":600}],
  [43.84,"end card","impact"],
  [44.64,"button","pop",{"pitch":"A5"}],
];

ad({
  hooks: { a: "Where did the money go?" },
  scenes: [
    {
      "t": 0,
      "kind": "photo",
      "src": "tense"
    },
    {
      "t": 8.05,
      "kind": "type",
      "lines": [
        "The estate's own account.",
        "Every naira it bills."
      ],
      "gold": 1,
      "bg": "tense",
      "caption": "With our licensed banking partner."
    },
    {
      "t": 18.06,
      "kind": "type",
      "lines": [
        "Large payouts can need",
        "a second approver."
      ],
      "gold": 1,
      "bg": "tense",
      "caption": "No one person moves estate funds alone."
    },
    {
      "t": 27.97,
      "kind": "screen",
      "src": "assets/screens/admin-payments.jpg",
      "device": "laptop",
      "bg": "calm",
      "crop": [
        420,
        540,
        1220,
        740
      ],
      "cam": [
        [
          27.97,
          [
            1,
            0.5,
            0.5
          ]
        ],
        [
          28.57,
          [
            1.2,
            0.5,
            0.45
          ]
        ]
      ],
      "rings": [
        {
          "r": [
            430,
            780,
            1100,
            72
          ],
          "a": 29.17,
          "b": 37.72
        }
      ],
      "caption": "AGM-ready, from records you already keep."
    },
    {
      "t": 38.12,
      "kind": "photo",
      "src": "calm",
      "caption": "Your executives make the calls."
    }
  ],
  end: { t: 43.84, line: 'Set up your estate free', url: 'breeup.com' },
  hits: HITS,
});
