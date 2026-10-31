'use client';
// hooks/useLocalStorage.ts — Type-safe localStorage hook

import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) setValue(JSON.parse(stored) as T);
    } catch { /* ignore */ }
  }, [key]);

  const set = (newValue: T) => {
    setValue(newValue);
    try { localStorage.setItem(key, JSON.stringify(newValue)); } catch { /* ignore */ }
  };

  const remove = () => {
    setValue(defaultValue);
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  };

  return [value, set, remove] as const;
}

