// lib/encoding/base64.ts

export function encodeBase64(text: string): string {
  return btoa(unescape(encodeURIComponent(text)));
}

export function decodeBase64(text: string): string {
  return decodeURIComponent(escape(atob(text)));
}

export function isValidBase64(text: string): boolean {
  try { atob(text); return true; } catch { return false; }
}

