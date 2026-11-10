// src/lib/lottie/audio.ts — Audio Layer & Asset Detection & Browser HTML5 Audio Synchronization

import type { LottieAnimation } from './types';

/**
 * Checks whether an animation contains audio layers (ty: 6) or audio assets.
 */
export function hasLottieAudio(animation: LottieAnimation): boolean {
  if (!animation || typeof animation !== 'object') return false;

  // 1. Check root layers for ty === 6 (AudioLayer)
  if (Array.isArray(animation.layers) && animation.layers.some((l) => l.ty === 6)) {
    return true;
  }

  // 2. Check precomposition layers for ty === 6
  if (Array.isArray(animation.assets)) {
    const hasPrecompAudio = animation.assets.some((asset) => {
      if (Array.isArray(asset.layers)) {
        return asset.layers.some((l) => l.ty === 6);
      }
      return false;
    });
    if (hasPrecompAudio) return true;

    // 3. Check for audio assets (e.g. data:audio/ or .mp3/.wav/.ogg)
    const hasAudioAsset = animation.assets.some((asset) => {
      if (asset.p) {
        const p = asset.p.toLowerCase();
        return (
          p.startsWith('data:audio/') ||
          p.endsWith('.mp3') ||
          p.endsWith('.wav') ||
          p.endsWith('.ogg') ||
          p.endsWith('.aac') ||
          p.endsWith('.m4a')
        );
      }
      return false;
    });
    if (hasAudioAsset) return true;
  }

  return false;
}

/**
 * Creates an audioFactory function compatible with lottie-web's AudioController.
 * Uses browser-native HTML5 Audio elements without requiring external CDN libraries (like Howler).
 */
export function createBrowserAudioFactory(
  getIsMuted: () => boolean = () => false,
  getVolume: () => number = () => 1
) {
  return function (assetPath: string) {
    if (typeof window === 'undefined') {
      return {
        play: () => {},
        pause: () => {},
        stop: () => {},
        seek: () => {},
        playing: () => false,
        rate: () => {},
        setVolume: () => {},
        volume: () => {},
      };
    }

    let audio: HTMLAudioElement | null = null;
    try {
      audio = new Audio(assetPath);
      audio.volume = getIsMuted() ? 0 : getVolume();
    } catch {
      // Audio creation failed (e.g. unsupported codec)
    }

    return {
      play() {
        if (!audio) return;
        audio.volume = getIsMuted() ? 0 : getVolume();
        audio.play().catch(() => {
          // Handled: browser autoplay restrictions before user gesture
        });
      },
      pause() {
        if (!audio) return;
        audio.pause();
      },
      stop() {
        if (!audio) return;
        audio.pause();
        audio.currentTime = 0;
      },
      seek(seconds: number) {
        if (!audio || !Number.isFinite(seconds)) return;
        audio.currentTime = Math.max(0, seconds);
      },
      playing() {
        return audio ? !audio.paused : false;
      },
      rate(rateValue: number) {
        if (!audio || !Number.isFinite(rateValue) || rateValue <= 0) return;
        audio.playbackRate = rateValue;
      },
      setVolume(val: number) {
        if (!audio) return;
        audio.volume = getIsMuted() ? 0 : Math.max(0, Math.min(1, val));
      },
      volume(val: number) {
        if (!audio) return;
        audio.volume = getIsMuted() ? 0 : Math.max(0, Math.min(1, val));
      },
    };
  };
}

