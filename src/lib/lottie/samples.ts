// src/lib/lottie/samples.ts — Curated lightweight standalone Lottie animations for 1-click preview

import type { LottieAnimation } from './types';

export interface LottieSample {
  id: string;
  name: string;
  description: string;
  data: LottieAnimation;
}

/** Sample 1: Smooth Pulsing Geometric Loader */
const PULSE_LOADER: LottieAnimation = {
  v: '5.7.4',
  fr: 60,
  ip: 0,
  op: 120,
  w: 400,
  h: 400,
  nm: 'Geometric Pulse',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'Outer Ring',
      sr: 1,
      ks: {
        o: { a: 1, k: [{ t: 0, s: [30] }, { t: 60, s: [100] }, { t: 120, s: [30] }] },
        r: { a: 1, k: [{ t: 0, s: [0] }, { t: 120, s: [360] }] },
        p: { a: 0, k: [200, 200, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [{ t: 0, s: [80, 80, 100] }, { t: 60, s: [110, 110, 100] }, { t: 120, s: [80, 80, 100] }] },
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            {
              d: 1,
              ty: 'el',
              s: { a: 0, k: [120, 120] },
              p: { a: 0, k: [0, 0] },
              nm: 'Ellipse Path',
            },
            {
              ty: 'st',
              c: { a: 0, k: [0.23, 0.51, 0.96, 1] }, // #3B82F6 Dev Blue
              o: { a: 0, k: 100 },
              w: { a: 0, k: 8 },
              lc: 2,
              lj: 2,
              nm: 'Stroke',
            },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
              nm: 'Transform',
            },
          ],
          nm: 'Group',
        },
      ],
      ip: 0,
      op: 120,
      st: 0,
      bm: 0,
    },
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: 'Center Dot',
      sr: 1,
      ks: {
        o: { a: 1, k: [{ t: 0, s: [100] }, { t: 60, s: [40] }, { t: 120, s: [100] }] },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [200, 200, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [{ t: 0, s: [100, 100, 100] }, { t: 60, s: [60, 60, 100] }, { t: 120, s: [100, 100, 100] }] },
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            {
              d: 1,
              ty: 'el',
              s: { a: 0, k: [40, 40] },
              p: { a: 0, k: [0, 0] },
              nm: 'Ellipse Path',
            },
            {
              ty: 'fl',
              c: { a: 0, k: [0.06, 0.73, 0.51, 1] }, // #10B981 Emerald
              o: { a: 0, k: 100 },
              r: 1,
              nm: 'Fill',
            },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
              nm: 'Transform',
            },
          ],
          nm: 'Group',
        },
      ],
      ip: 0,
      op: 120,
      st: 0,
      bm: 0,
    },
  ],
};

/** Sample 2: Success Checkmark Badge */
const SUCCESS_CHECK: LottieAnimation = {
  v: '5.7.4',
  fr: 60,
  ip: 0,
  op: 90,
  w: 400,
  h: 400,
  nm: 'Success Badge',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'Circle Badge',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [200, 200, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [0, 0, 100] },
            { t: 30, s: [115, 115, 100] },
            { t: 45, s: [100, 100, 100] },
          ],
        },
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            {
              d: 1,
              ty: 'el',
              s: { a: 0, k: [140, 140] },
              p: { a: 0, k: [0, 0] },
              nm: 'Ellipse',
            },
            {
              ty: 'fl',
              c: { a: 0, k: [0.06, 0.73, 0.51, 1] }, // Emerald #10B981
              o: { a: 0, k: 100 },
              r: 1,
              nm: 'Fill',
            },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
              nm: 'Transform',
            },
          ],
          nm: 'Group',
        },
      ],
      ip: 0,
      op: 90,
      st: 0,
      bm: 0,
    },
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: 'Checkmark Mark',
      sr: 1,
      ks: {
        o: {
          a: 1,
          k: [
            { t: 0, s: [0] },
            { t: 25, s: [0] },
            { t: 35, s: [100] },
          ],
        },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [200, 200, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: 25, s: [40, 40, 100] },
            { t: 45, s: [110, 110, 100] },
            { t: 55, s: [100, 100, 100] },
          ],
        },
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            {
              d: 1,
              ty: 'sh',
              ks: {
                a: 0,
                k: {
                  i: [[0, 0], [0, 0], [0, 0]],
                  o: [[0, 0], [0, 0], [0, 0]],
                  v: [[-25, 2], [-8, 20], [28, -18]],
                  c: false,
                },
              },
              nm: 'Path',
            },
            {
              ty: 'st',
              c: { a: 0, k: [1, 1, 1, 1] }, // White
              o: { a: 0, k: 100 },
              w: { a: 0, k: 10 },
              lc: 2,
              lj: 2,
              nm: 'Stroke',
            },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
              nm: 'Transform',
            },
          ],
          nm: 'Check Group',
        },
      ],
      ip: 0,
      op: 90,
      st: 0,
      bm: 0,
    },
  ],
};

/** Sample 3: Morphing Shape Spinner */
const MORPH_SPINNER: LottieAnimation = {
  v: '5.7.4',
  fr: 60,
  ip: 0,
  op: 120,
  w: 400,
  h: 400,
  nm: 'Morphing Square',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'Rotating Square',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: {
          a: 1,
          k: [
            { t: 0, s: [0] },
            { t: 60, s: [180] },
            { t: 120, s: [360] },
          ],
        },
        p: { a: 0, k: [200, 200, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [90, 90, 100] },
            { t: 60, s: [120, 120, 100] },
            { t: 120, s: [90, 90, 100] },
          ],
        },
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            {
              ty: 'rc',
              d: 1,
              s: { a: 0, k: [100, 100] },
              p: { a: 0, k: [0, 0] },
              r: {
                a: 1,
                k: [
                  { t: 0, s: [10] },
                  { t: 60, s: [50] }, // Morph into circle
                  { t: 120, s: [10] },
                ],
              },
              nm: 'Rounded Rect',
            },
            {
              ty: 'st',
              c: { a: 0, k: [0.66, 0.33, 0.98, 1] }, // Purple #A855F7
              o: { a: 0, k: 100 },
              w: { a: 0, k: 8 },
              lc: 2,
              lj: 2,
              nm: 'Stroke',
            },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
              nm: 'Transform',
            },
          ],
          nm: 'Group',
        },
      ],
      ip: 0,
      op: 120,
      st: 0,
      bm: 0,
    },
  ],
};

export const LOTTIE_SAMPLES: LottieSample[] = [
  {
    id: 'pulse-loader',
    name: 'Pulse Loader',
    description: 'Geometric rotating loader with opacity pulse',
    data: PULSE_LOADER,
  },
  {
    id: 'success-badge',
    name: 'Success Badge',
    description: 'Scale bounce with checkmark reveal',
    data: SUCCESS_CHECK,
  },
  {
    id: 'morph-spinner',
    name: 'Morphing Square',
    description: 'Square-to-circle corner radius morph',
    data: MORPH_SPINNER,
  },
];

