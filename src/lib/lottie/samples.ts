// src/lib/lottie/samples.ts — Sample animations for the Lottie tools' 1-click preview.
//
// Real .lottie files served from public/samples/lottie/ and fetched only when
// picked, so they are not bundled into every Lottie tool's JavaScript.
// Source: free animations from LottieFiles (Lottie Simple License).

import { extractDotLottie } from './dotLottie';
import type { LottieAnimation } from './types';

export interface LottieSample {
  id: string;
  name: string;
  description: string;
  /** Public URL of the .lottie file. */
  url: string;
}

export const LOTTIE_SAMPLES: LottieSample[] = [
  { id: 'heart-hi', name: 'Heart Hi', description: 'Character waving hello', url: '/samples/lottie/heart-hi.lottie' },
  { id: 'cat-waiting', name: 'Cat Waiting', description: 'Wide banner character loop', url: '/samples/lottie/cat-waiting.lottie' },
  { id: 'birds-in-love', name: 'Birds in Love', description: 'Scene with flying birds', url: '/samples/lottie/birds-in-love.lottie' },
  { id: 'lock-unlock', name: 'Lock / Unlock', description: 'UI icon transition', url: '/samples/lottie/lock-unlock.lottie' },
  { id: 'love-dancing', name: 'Love Dancing', description: 'Uses embedded images', url: '/samples/lottie/love-dancing.lottie' },
];

/**
 * A valid, empty animation: what the tools show until the first sample loads.
 * lottie-web renders it as a blank frame.
 */
export const EMPTY_ANIMATION: LottieAnimation = {
  v: '5.7.4',
  fr: 30,
  ip: 0,
  op: 60,
  w: 400,
  h: 400,
  nm: 'Loading',
  ddd: 0,
  assets: [],
  layers: [],
};

export interface LoadedLottieSample {
  animation: LottieAnimation;
  /** Pretty-printed JSON of the animation (images inlined as data URIs). */
  rawJson: string;
}

/** Turn the bytes of a sample .lottie file into an animation. Throws if it can't be read. */
export function parseLottieSample(bytes: ArrayBuffer | Uint8Array): LoadedLottieSample {
  const res = extractDotLottie(bytes);
  if (!res.success || !res.animation) throw new Error(res.error || 'Could not read the sample animation.');
  return { animation: res.animation, rawJson: JSON.stringify(res.animation, null, 2) };
}

/** Fetch and parse a sample. */
export async function loadLottieSample(sample: LottieSample): Promise<LoadedLottieSample> {
  const res = await fetch(sample.url);
  if (!res.ok) throw new Error(`Could not load the sample (${res.status}).`);
  return parseLottieSample(await res.arrayBuffer());
}
