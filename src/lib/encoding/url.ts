// lib/encoding/url.ts

export function encodeURL(text: string): string {
  return encodeURIComponent(text);
}

export function decodeURL(text: string): string {
  return decodeURIComponent(text);
}

export interface ParsedURL {
  protocol: string;
  host: string;
  pathname: string;
  search: string;
  hash: string;
  params: Record<string, string>;
}

export function parseURL(url: string): ParsedURL | null {
  try {
    const u = new URL(url);
    const params: Record<string, string> = {};
    u.searchParams.forEach((v, k) => {
      params[k] = v;
    });
    return {
      protocol: u.protocol,
      host: u.host,
      pathname: u.pathname,
      search: u.search,
      hash: u.hash,
      params,
    };
  } catch {
    return null;
  }
}

export interface ParsedDeepLink {
  scheme: string;
  host: string;
  path: string;
  query: Record<string, string>;
  fragment: string;
  raw: string;
}

export function isValidDeepLink(url: string): boolean {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return false;
  }

  // Check for control characters or newlines
  if (/[\x00-\x1F\x7F]/.test(url)) {
    return false;
  }

  try {
    new URL(url);
    return true;
  } catch {
    // Check if it's a valid app scheme (custom://...)
    const appSchemeRegex = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s]+$/;
    return appSchemeRegex.test(url);
  }
}

export function parseDeepLink(url: string): ParsedDeepLink | null {
  if (!url || !url.trim() || !isValidDeepLink(url)) {
    return null;
  }

  try {
    const normalized = url.includes('://') ? url : url.replace(':', '://');
    const parsed = new URL(normalized);
    const query: Record<string, string> = {};
    parsed.searchParams.forEach((value, key) => {
      query[key] = value;
    });
    return {
      scheme: parsed.protocol.replace(':', ''),
      host: parsed.hostname,
      path: parsed.pathname,
      query,
      fragment: parsed.hash.replace('#', ''),
      raw: url,
    };
  } catch {
    return null;
  }
}
