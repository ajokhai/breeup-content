// When the WhatsApp group stops working (explainer). Written by tools/explainer.mjs from docs/scenes.json and the voice timings in
// film.json; edit scenes.json and re-run it rather than editing this file.
import { ad } from '/kit/ad.js';

const HITS = [
  [0,"open","sub",{"len":0.7}],
  [10.37,"whip","whoosh",{"len":0.35,"from":600,"to":3200}],
  [21.81,"ring","blip",{"pitch":"C6"}],
  [20.61,"whip","whoosh",{"len":0.35,"from":3200,"to":600}],
  [28.18,"whip","whoosh",{"len":0.35,"from":600,"to":3200}],
  [37.13,"type","pop",{"pitch":"A5"}],
  [36.98,"whip","whoosh",{"len":0.35,"from":3200,"to":600}],
  [45.01,"end card","impact"],
  [45.81,"button","pop",{"pitch":"A5"}],
];

ad({
  hooks: { a: "Every estate has a WhatsApp group." },
  scenes: [
    {
      "t": 0,
      "kind": "photo",
      "src": "group"
    },
    {
      "t": 10.37,
      "kind": "clip",
      "src": "chasing",
      "caption": "Payments and notices get lost in the scroll."
    },
    {
      "t": 20.61,
      "kind": "screen",
      "src": "assets/screens/admin-payments.jpg",
      "device": "laptop",
      "bg": "group",
      "crop": [
        880,
        540,
        1220,
        740
      ],
      "cam": [
        [
          20.61,
          [
            1,
            0.5,
            0.5
          ]
        ],
        [
          21.21,
          [
            1.3,
            0.3,
            0.45
          ]
        ]
      ],
      "rings": [
        {
          "r": [
            1130,
            600,
            150,
            400
          ],
          "a": 21.81,
          "b": 27.78
        }
      ],
      "caption": "See who has paid at a glance."
    },
    {
      "t": 28.18,
      "kind": "photo",
      "src": "notice",
      "caption": "Notices that reach the right homes, on record."
    },
    {
      "t": 36.98,
      "kind": "type",
      "lines": [
        "Keep the group for chat.",
        "Keep the record in BreeUp."
      ],
      "gold": 1,
      "bg": "group",
      "caption": "Use both."
    }
  ],
  end: { t: 45.01, line: 'Set up your estate free', url: 'breeup.com' },
  hits: HITS,
});
