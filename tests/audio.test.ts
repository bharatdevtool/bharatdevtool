import { describe, it, expect } from 'vitest';
import { hasLottieAudio, createBrowserAudioFactory } from '@/lib/lottie/audio';
import { analyzeLottie } from '@/lib/lottie/analyzer';
import { validateLottie } from '@/lib/lottie/validator';
import type { LottieAnimation } from '@/lib/lottie/types';

describe('Lottie Audio System', () => {
  const baseAnimation: LottieAnimation = {
    v: '5.7.0',
    fr: 60,
    ip: 0,
    op: 60,
    w: 500,
    h: 500,
    layers: [
      { ind: 1, ty: 4, nm: 'Shape Layer', ip: 0, op: 60, ks: {} },
    ],
  };

  describe('hasLottieAudio', () => {
    it('returns false for standard vector animation without sound', () => {
      expect(hasLottieAudio(baseAnimation)).toBe(false);
    });

    it('returns true when root layer contains an audio layer (ty: 6)', () => {
      const animWithAudio: LottieAnimation = {
        ...baseAnimation,
        layers: [
          ...(baseAnimation.layers || []),
          { ind: 2, ty: 6, nm: 'Audio Track', refId: 'audio_1', ip: 0, op: 60, ks: {} },
        ],
      };
      expect(hasLottieAudio(animWithAudio)).toBe(true);
    });

    it('returns true when precomposition asset contains an audio layer', () => {
      const animWithPrecompAudio: LottieAnimation = {
        ...baseAnimation,
        assets: [
          {
            id: 'comp_1',
            layers: [
              { ind: 1, ty: 6, nm: 'Nested Audio', refId: 'audio_nested', ip: 0, op: 60, ks: {} },
            ],
          },
        ],
      };
      expect(hasLottieAudio(animWithPrecompAudio)).toBe(true);
    });

    it('returns true when assets contains audio data URI or audio file reference', () => {
      const animWithAudioAsset: LottieAnimation = {
        ...baseAnimation,
        assets: [
          {
            id: 'snd_click',
            p: 'data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA',
            e: 1,
          },
        ],
      };
      expect(hasLottieAudio(animWithAudioAsset)).toBe(true);

      const animWithExternalAudio: LottieAnimation = {
        ...baseAnimation,
        assets: [
          {
            id: 'snd_bgm',
            u: 'audio/',
            p: 'soundtrack.mp3',
          },
        ],
      };
      expect(hasLottieAudio(animWithExternalAudio)).toBe(true);
    });
  });

  describe('createBrowserAudioFactory', () => {
    it('creates an audio factory object with player methods', () => {
      const isMuted = false;
      const factory = createBrowserAudioFactory(() => isMuted, () => 0.8);
      const player = factory('test-audio.mp3');

      expect(typeof player.play).toBe('function');
      expect(typeof player.pause).toBe('function');
      expect(typeof player.stop).toBe('function');
      expect(typeof player.seek).toBe('function');
      expect(typeof player.rate).toBe('function');
      expect(typeof player.setVolume).toBe('function');
      expect(player.playing()).toBe(false);

      // Safe calls do not throw
      expect(() => {
        player.pause();
        player.stop();
        player.seek(2.5);
        player.rate(1.5);
        player.setVolume(0.5);
      }).not.toThrow();
    });
  });

  describe('analyzeLottie Audio Auditing', () => {
    it('detects and counts audio layers and audio assets', () => {
      const anim: LottieAnimation = {
        ...baseAnimation,
        assets: [
          {
            id: 'audio_1',
            p: 'data:audio/mp3;base64,AQIDBAUGBwgJCgsMDQ4PEA==',
          },
        ],
        layers: [
          { ind: 1, ty: 4, nm: 'Shape Layer', ip: 0, op: 60, ks: {} },
          { ind: 2, ty: 6, nm: 'Sound FX', refId: 'audio_1', ip: 0, op: 60, ks: {} },
        ],
      };

      const result = analyzeLottie(anim, JSON.stringify(anim));
      expect(result.hasAudio).toBe(true);
      expect(result.layerStats.audios).toBe(1);
      expect(result.assets).toHaveLength(1);
      expect(result.assets[0].type).toBe('audio');
      expect(result.assets[0].isEmbedded).toBe(true);
      expect(result.assets[0].byteSize).toBe(16);
    });
  });

  describe('validateLottie Audio Checks', () => {
    it('reports an error when an audio layer has no refId', () => {
      const anim: LottieAnimation = {
        ...baseAnimation,
        layers: [
          { ind: 1, ty: 6, nm: 'Dangling Audio', ip: 0, op: 60, ks: {} },
        ],
      };

      const report = validateLottie(anim);
      expect(report.valid).toBe(false);
      const audioError = report.issues.find((i) => i.id.startsWith('audio-missing-refid'));
      expect(audioError).toBeDefined();
      expect(audioError?.severity).toBe('error');
    });

    it('reports an error when an audio layer references a non-existent asset ID', () => {
      const anim: LottieAnimation = {
        ...baseAnimation,
        assets: [],
        layers: [
          { ind: 1, ty: 6, nm: 'Broken Audio', refId: 'ghost_sound', ip: 0, op: 60, ks: {} },
        ],
      };

      const report = validateLottie(anim);
      expect(report.valid).toBe(false);
      const audioError = report.issues.find((i) => i.id.startsWith('audio-broken-refid'));
      expect(audioError).toBeDefined();
      expect(audioError?.severity).toBe('error');
    });

    it('passes validation when audio layer references an existing asset in assets[]', () => {
      const anim: LottieAnimation = {
        ...baseAnimation,
        assets: [
          {
            id: 'sound_bell',
            p: 'data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA',
          },
        ],
        layers: [
          { ind: 1, ty: 6, nm: 'Bell Sound', refId: 'sound_bell', ip: 0, op: 60, ks: {} },
        ],
      };

      const report = validateLottie(anim);
      const audioErrors = report.issues.filter((i) => i.id.includes('audio-'));
      expect(audioErrors).toHaveLength(0);
    });
  });
});
