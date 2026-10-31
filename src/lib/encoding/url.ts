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
    u.searchParams.forEach((v, k) => { params[k] = v; });
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

