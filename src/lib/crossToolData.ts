// src/lib/crossToolData.ts — Safe, 100% client-side cross-tool data transfer

const STORAGE_PREFIX = 'bdt_crosstool_';
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour max lifetime

interface CrossToolEnvelope<T> {
  timestamp: number;
  payload: T;
}

// In-memory cache ensures that large payloads (such as unzipped .lottie animations with inlined base64 images)
// transfer reliably across Next.js client-side router transitions even when the browser's 5MB sessionStorage
// quota is exceeded.
const inMemoryStore = new Map<string, CrossToolEnvelope<unknown>>();

/**
 * Stores payload in memory and sessionStorage to pass data seamlessly across tool navigations.
 * Safely handles SSR, quotas, and expiration.
 */
export function setCrossToolData<T>(targetToolId: string, payload: T): boolean {
  const envelope: CrossToolEnvelope<T> = {
    timestamp: Date.now(),
    payload,
  };

  // 1. Always store in memory for reliable, instantaneous same-session SPA router navigation
  inMemoryStore.set(targetToolId, envelope as CrossToolEnvelope<unknown>);

  // 2. Only attempt to persist in sessionStorage for lightweight payloads (< 1MB)
  // to avoid freezing the browser main thread with synchronous serialization of massive files
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const jsonStr = JSON.stringify(envelope);
      if (jsonStr.length < 1_000_000) {
        window.sessionStorage.setItem(`${STORAGE_PREFIX}${targetToolId}`, jsonStr);
      }
    } catch {
      // Gracefully ignored: payload exceeds quota or private browsing restrictions
    }
  }

  return true;
}

/**
 * Retrieves and optionally consumes (clears) cross-tool data passed from another tool.
 */
export function getCrossToolData<T>(toolId: string, consume = true): T | null {
  const key = `${STORAGE_PREFIX}${toolId}`;

  // 1. Check in-memory store first
  const memEnvelope = inMemoryStore.get(toolId) as CrossToolEnvelope<T> | undefined;
  if (memEnvelope && typeof memEnvelope === 'object' && typeof memEnvelope.timestamp === 'number') {
    if (Date.now() - memEnvelope.timestamp <= MAX_AGE_MS) {
      if (consume) {
        inMemoryStore.delete(toolId);
        if (typeof window !== 'undefined' && window.sessionStorage) {
          try {
            window.sessionStorage.removeItem(key);
          } catch {
            // Ignore
          }
        }
      }
      return memEnvelope.payload;
    } else {
      inMemoryStore.delete(toolId);
    }
  }

  // 2. Fall back to sessionStorage (e.g. after hard page reload)
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;

    if (consume) {
      window.sessionStorage.removeItem(key);
    }

    const envelope = JSON.parse(raw) as CrossToolEnvelope<T>;
    if (!envelope || typeof envelope !== 'object' || typeof envelope.timestamp !== 'number') {
      return null;
    }

    // Ignore expired data
    if (Date.now() - envelope.timestamp > MAX_AGE_MS) {
      return null;
    }

    return envelope.payload;
  } catch {
    return null;
  }
}

/**
 * Clears any pending cross-tool data for a specific tool.
 */
export function clearCrossToolData(toolId: string): void {
  inMemoryStore.delete(toolId);
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(`${STORAGE_PREFIX}${toolId}`);
    } catch {
      // Ignore
    }
  }
}
