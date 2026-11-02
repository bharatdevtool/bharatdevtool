// src/lib/lottie/loader.ts — Lazy-loads an expression-free lottie-web build

import type { LottiePlayer } from 'lottie-web';

/**
 * The default lottie-web build evaluates After Effects expressions embedded in the
 * animation with `eval`, which would let an untrusted file run script on this origin.
 * The "light" builds ship without the expression engine, so only those are used.
 */
export async function loadLottie(renderer: 'svg' | 'canvas' = 'svg'): Promise<LottiePlayer> {
  const mod =
    renderer === 'canvas'
      ? await import('lottie-web/build/player/lottie_light_canvas')
      : await import('lottie-web/build/player/lottie_light');
  return mod.default;
}
