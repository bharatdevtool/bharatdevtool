// Lightweight PDF helpers and types with no library imports, safe to load with the page.
// The heavy engine (pdf-lib, pdf.js) is loaded on demand via ./engine.

export type PageSize = 'fit' | 'a4' | 'letter';
export type Orientation = 'auto' | 'portrait' | 'landscape';

export interface ImagePageOptions {
  pageSize: PageSize;
  orientation: Orientation;
  /** Margin in PDF points (72 pt = 1 inch). */
  margin: number;
}

export const DEFAULT_IMAGE_OPTIONS: ImagePageOptions = { pageSize: 'a4', orientation: 'auto', margin: 0 };

export type KeepTextLevel = 'light' | 'balanced' | 'strong';

export function normalizeRotation(deg: number): number {
  return ((Math.round(deg / 90) * 90) % 360 + 360) % 360;
}

/** True for the error thrown when a PDF needs a password (works across lazy-loaded modules). */
export function isEncryptedError(err: unknown): err is Error & { wrongPassword?: boolean } {
  return err instanceof Error && (err.name === 'EncryptedPdfError' || err.name === 'PasswordException');
}

export function downloadBytes(bytes: Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
