// A calmer gatehouse (explainer). Written by tools/explainer.mjs from docs/scenes.json and the voice timings in
// film.json; edit scenes.json and re-run it rather than editing this file.
import { ad } from '/kit/ad.js';

const HITS = [
  [0,"open","sub",{"len":0.7}],
  [12.56,"ring","blip",{"pitch":"C6"}],
  [11.36,"whip","whoosh",{"len":0.35,"from":600,"to":3200}],
  [19.65,"whip","whoosh",{"len":0.35,"from":3200,"to":600}],
  [27.63,"whip","whoosh",{"len":0.35,"from":600,"to":3200}],
  [35.05,"type","pop",{"pitch":"A5"}],
  [34.9,"whip","whoosh",{"len":0.35,"from":3200,"to":600}],
  [38.27,"end card","impact"],
  [39.07,"button","pop",{"pitch":"A5"}],
];

ad({
  hooks: { a: "The gatehouse sets the tone for the estate." },
  scenes: [
    {
      "t": 0,
      "kind": "photo",
      "src": "queue"
    },
    {
      "t": 11.36,
      "kind": "screen",
      "src": "assets/screens/res-visitor-pass.jpg",
      "device": "phone",
      "bg": "queue",
      "cam": [
        [
          11.36,
          [
            1,
            0.5,
            0.5
          ]
        ],
        [
          11.96,
          [
            1.45,
            0.45,
            0.82
          ]
        ]
      ],
      "rings": [
        {
          "r": [
            104,
            1446,
            384,
            70
          ],
          "a": 12.56,
          "b": 19.25
        }
      ],
      "caption": "A pass in two taps, sent on WhatsApp."
    },
    {
      "t": 19.65,
      "kind": "photo",
      "src": "guard",
      "caption": "Every entry timestamped and searchable."
    },
    {
      "t": 27.63,
      "kind": "photo",
      "src": "arrive",
      "caption": "No new hardware. Just the phones you have."
    },
    {
      "t": 34.9,
      "kind": "type",
      "lines": [
        "The guard still has",
        "the final say."
      ],
      "gold": 1,
      "bg": "guard",
      "caption": "Guards stay in control."
    }
  ],
  end: { t: 38.27, line: 'Set up your estate free', url: 'breeup.com' },
  hits: HITS,
});
