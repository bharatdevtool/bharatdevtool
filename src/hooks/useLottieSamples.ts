'use client';
// hooks/useLottieSamples.ts — Load the Lottie tools' sample animations (fetched .lottie files).

import { useCallback, useEffect, useRef, useState } from 'react';
import { LOTTIE_SAMPLES, loadLottieSample, type LoadedLottieSample, type LottieSample } from '@/lib/lottie/samples';

/**
 * Picks samples and loads the first one on mount.
 *
 * Loading is asynchronous, so anything else that puts an animation in the tool
 * (an upload, a hand-off from another tool, pasted JSON) must call
 * `markUserContent()`: a sample that is still loading is then dropped instead of
 * overwriting the user's animation, and the first sample is not loaded at all.
 */
export function useLottieSamples(onLoaded: (sample: LottieSample, loaded: LoadedLottieSample) => void, onError?: (message: string) => void) {
  const [activeSampleId, setActiveSampleId] = useState<string>(LOTTIE_SAMPLES[0].id);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const seq = useRef(0);
  const userContent = useRef(false);
  const callbacks = useRef({ onLoaded, onError });
  useEffect(() => {
    callbacks.current = { onLoaded, onError };
  });

  const selectSample = useCallback((id: string) => {
    const sample = LOTTIE_SAMPLES.find((s) => s.id === id);
    if (!sample) return;
    const mine = ++seq.current;
    setActiveSampleId(id);
    setLoadingId(id);
    loadLottieSample(sample).then(
      (loaded) => {
        if (mine !== seq.current) return; // something newer was loaded meanwhile
        setLoadingId(null);
        callbacks.current.onLoaded(sample, loaded);
      },
      (err: Error) => {
        if (mine !== seq.current) return;
        setLoadingId(null);
        callbacks.current.onError?.(err.message);
      },
    );
  }, []);

  /** Something other than a sample was loaded: forget the sample selection. */
  const markUserContent = useCallback(() => {
    userContent.current = true;
    seq.current++;
    setActiveSampleId('');
    setLoadingId(null);
  }, []);

  // First sample on mount, after cross-tool hand-offs had their chance (they run in an earlier effect).
  useEffect(() => {
    if (!userContent.current) selectSample(LOTTIE_SAMPLES[0].id);
  }, [selectSample]);

  return { samples: LOTTIE_SAMPLES, activeSampleId, loadingId, selectSample, markUserContent };
}
