/** pdf-lib + pdf.js (~250 KB gz) load on demand, and are prefetched when the browser is idle. */
export type Engine = typeof import('@/lib/pdf/engine');

let enginePromise: Promise<Engine> | null = null;

export const engine = (): Promise<Engine> => {
  if (!enginePromise) {
    enginePromise = import('@/lib/pdf/engine');
    enginePromise.catch(() => {
      enginePromise = null;
    });
  }
  return enginePromise;
};
