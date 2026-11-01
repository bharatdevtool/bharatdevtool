// lib/encoding/base64.ts

export interface Base64Options {
  urlSafe?: boolean;
  stripPadding?: boolean;
  interpretHex?: boolean;
}

export function toUrlSafeBase64(base64: string, stripPadding = false): string {
  let result = base64.replace(/\+/g, '-').replace(/\//g, '_');
  if (stripPadding) {
    result = result.replace(/=/g, '');
  }
  return result;
}

export function fromUrlSafeBase64(urlSafeBase64: string): string {
  let base64 = urlSafeBase64.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const padLength = (4 - (base64.length % 4)) % 4;
  return base64 + '='.repeat(padLength);
}

export function parseHexString(hexString: string): Uint8Array {
  const cleaned = hexString.replace(/[^0-9A-Fa-f]/g, '');
  if (cleaned.length % 2 !== 0) {
    throw new Error('Hex string must have an even number of digits');
  }
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes[i / 2] = parseInt(cleaned.substring(i, i + 2), 16);
  }
  return bytes;
}

export function encodeBase64(text: string, options: Base64Options = {}): string {
  if (!text) return '';

  let binary = '';
  if (options.interpretHex) {
    try {
      const bytes = parseHexString(text);
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
    } catch {
      binary = unescape(encodeURIComponent(text));
    }
  } else {
    binary = unescape(encodeURIComponent(text));
  }

  let base64 = btoa(binary);

  if (options.urlSafe) {
    base64 = toUrlSafeBase64(base64, options.stripPadding);
  } else if (options.stripPadding) {
    base64 = base64.replace(/=/g, '');
  }

  return base64;
}

export function decodeBase64(text: string, options: Base64Options = {}): string {
  if (!text || !text.trim()) return '';

  let cleaned = text.trim().replace(/\s/g, '');
  if (options.urlSafe || cleaned.includes('-') || cleaned.includes('_')) {
    cleaned = fromUrlSafeBase64(cleaned);
  } else {
    const padLength = (4 - (cleaned.length % 4)) % 4;
    cleaned = cleaned + '='.repeat(padLength);
  }

  const binary = atob(cleaned);
  try {
    return decodeURIComponent(escape(binary));
  } catch {
    return binary;
  }
}

export function isValidBase64(text: string): boolean {
  if (!text || !text.trim()) return false;
  try {
    let cleaned = text.trim().replace(/\s/g, '');
    if (cleaned.includes('-') || cleaned.includes('_')) {
      cleaned = fromUrlSafeBase64(cleaned);
    } else {
      const padLength = (4 - (cleaned.length % 4)) % 4;
      cleaned = cleaned + '='.repeat(padLength);
    }
    atob(cleaned);
    return true;
  } catch {
    return false;
  }
}
