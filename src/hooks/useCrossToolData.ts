'use client';
// hooks/useCrossToolData.ts — Consume a payload handed over by another tool, once, after mount

import { useEffect, useEffectEvent } from 'react';
import { getCrossToolData } from '@/lib/crossToolData';

/**
 * Reads (and consumes) the cross-tool payload addressed to `toolId` after mount and
 * passes it to `onReceive`. Reading after mount keeps server and client markup identical.
 */
export function useCrossToolData<T>(toolId: string, onReceive: (payload: T) => void) {
  const receive = useEffectEvent(onReceive);

  useEffect(() => {
    const payload = getCrossToolData<T>(toolId);
    if (payload !== null) receive(payload);
  }, [toolId]);
}
