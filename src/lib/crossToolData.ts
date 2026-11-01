// src/lib/crossToolData.ts — Safe, 100% client-side cross-tool data transfer

const STORAGE_PREFIX = 'bdt_crosstool_';
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour max lifetime

interface CrossToolEnvelope<T> {
  timestamp: number;
  payload: T;
}

/**
 * Stores payload in sessionStorage to pass data seamlessly across tool navigations.
 * Safely handles SSR, quotas, and expiration.
 */
export function setCrossToolData<T>(targetToolId: string, payload: T): boolean {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return false;
  }

  try {
    const envelope: CrossToolEnvelope<T> = {
      timestamp: Date.now(),
      payload,
    };
    window.sessionStorage.setItem(
      `${STORAGE_PREFIX}${targetToolId}`,
      JSON.stringify(envelope)
    );
    return true;
  } catch (err) {
    // QuotaExceededError or private browsing restrictions
    console.warn('Could not store cross-tool data in sessionStorage:', err);
    return false;
  }
}

/**
 * Retrieves and optionally consumes (clears) cross-tool data passed from another tool.
 */
export function getCrossToolData<T>(toolId: string, consume = true): T | null {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return null;
  }

  const key = `${STORAGE_PREFIX}${toolId}`;
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
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.removeItem(`${STORAGE_PREFIX}${toolId}`);
  }
}

