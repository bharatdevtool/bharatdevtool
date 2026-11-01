import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setCrossToolData, getCrossToolData, clearCrossToolData } from '@/lib/crossToolData';

describe('Cross-Tool Data Passing', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    const mockStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      length: 0,
      key: () => null,
    };

    vi.stubGlobal('window', {
      sessionStorage: mockStorage,
    });
  });

  it('stores and retrieves cross-tool payload', () => {
    const payload = { left: '{"a":1}', right: '{"a":2}' };
    const saved = setCrossToolData('json-diff', payload);
    expect(saved).toBe(true);

    const retrieved = getCrossToolData<typeof payload>('json-diff');
    expect(retrieved).toEqual(payload);
  });

  it('consumes (clears) payload upon retrieval by default', () => {
    const payload = { json: '{"test":true}' };
    setCrossToolData('json-formatter', payload);

    const first = getCrossToolData<typeof payload>('json-formatter');
    expect(first).toEqual(payload);

    // Second read should be null since it was consumed
    const second = getCrossToolData<typeof payload>('json-formatter');
    expect(second).toBeNull();
  });

  it('preserves payload when consume is false', () => {
    const payload = { lottieJson: '{"v":"5.7.4"}' };
    setCrossToolData('lottie-player', payload);

    const first = getCrossToolData<typeof payload>('lottie-player', false);
    expect(first).toEqual(payload);

    const second = getCrossToolData<typeof payload>('lottie-player', false);
    expect(second).toEqual(payload);
  });

  it('returns null for non-existent tool data', () => {
    expect(getCrossToolData('unknown-tool')).toBeNull();
  });

  it('clears specific tool data manually', () => {
    setCrossToolData('json-diff', { left: 'a' });
    clearCrossToolData('json-diff');
    expect(getCrossToolData('json-diff')).toBeNull();
  });
});

