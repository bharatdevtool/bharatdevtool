// src/lib/lottie/fromUrl.ts — Load a Lottie animation (.json or .lottie) from a URL.
//
// The browser fetches the file directly from where it is hosted; nothing goes
// through our servers. That only works when the host allows cross-site requests
// (CORS), so errors explain what to do instead.

import { extractDotLottie, isDotLottieBuffer } from './dotLottie';
import type { LottieAnimation } from './types';

export const MAX_URL_BYTES = 25 * 1024 * 1024; // same limit as uploads
const TIMEOUT_MS = 20_000;

export interface LottieFromUrl {
  animation: LottieAnimation;
  rawJson: string;
  format: 'json' | 'lottie';
}

export class LottieUrlError extends Error {}

/** A usable http(s) URL, or an error message explaining what's wrong. */
export function checkLottieUrl(input: string): { url: string } | { error: string } {
  const text = input.trim();
  if (!text) return { error: 'Paste the link to a .json or .lottie file.' };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { error: 'That is not a valid link. It should start with https://' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { error: 'Only http:// and https:// links can be loaded.' };
  }
  return { url: url.href };
}

/** Parse fetched bytes: a .lottie archive or Lottie JSON. Throws LottieUrlError with a readable message. */
export function parseLottieBytes(bytes: Uint8Array): LottieFromUrl {
  if (isDotLottieBuffer(bytes)) {
    const res = extractDotLottie(bytes);
    if (!res.success || !res.animation) throw new LottieUrlError(res.error || 'This .lottie file could not be opened.');
    return { animation: res.animation, rawJson: JSON.stringify(res.animation, null, 2), format: 'lottie' };
  }
  const text = new TextDecoder('utf-8').decode(bytes).replace(/^﻿/, '');
  if (/^\s*</.test(text)) {
    throw new LottieUrlError(
      'This link opens a web page, not an animation file. Use the direct link to the .json or .lottie file (on LottieFiles: the "Lottie JSON" or "dotLottie" download link).'
    );
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new LottieUrlError('The file at this link is not valid JSON or .lottie.');
  }
  const anim = data as LottieAnimation;
  if (!anim || typeof anim !== 'object' || Array.isArray(anim) || !Array.isArray(anim.layers)) {
    throw new LottieUrlError('The file at this link is JSON, but not a Lottie animation (it has no "layers").');
  }
  return { animation: anim, rawJson: JSON.stringify(anim, null, 2), format: 'json' };
}

/** Fetch and parse an animation from `input`. Throws LottieUrlError with a readable message. */
export async function loadLottieFromUrl(input: string, fetchImpl: typeof fetch = fetch): Promise<LottieFromUrl> {
  const checked = checkLottieUrl(input);
  if ('error' in checked) throw new LottieUrlError(checked.error);

  // The timeout covers the whole download, not just the response headers.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let res: Response;
    try {
      // No cookies or credentials: only public files.
      res = await fetchImpl(checked.url, { signal: controller.signal, credentials: 'omit', redirect: 'follow' });
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw new LottieUrlError('The link took too long to respond.');
      throw new LottieUrlError(
        'Could not load this link. The site may block other websites from loading its files (CORS), or it is offline. Download the file and use Upload instead.'
      );
    }

    if (!res.ok) throw new LottieUrlError(`The link returned an error (${res.status}). Check that it is public and correct.`);
    const length = Number(res.headers.get('content-length') || 0);
    if (length > MAX_URL_BYTES) throw new LottieUrlError(TOO_LARGE);

    let bytes: Uint8Array;
    try {
      bytes = await readLimited(res, MAX_URL_BYTES);
    } catch (err) {
      if (err instanceof LottieUrlError) throw err;
      if ((err as Error)?.name === 'AbortError') throw new LottieUrlError('The link took too long to respond.');
      throw new LottieUrlError('The download was interrupted. Try again, or download the file and use Upload.');
    }
    return parseLottieBytes(bytes);
  } finally {
    clearTimeout(timer);
  }
}

const TOO_LARGE = 'This file is larger than 25 MB, the browser limit for this tool.';

/** Read the body, stopping as soon as it passes `limit` (servers don't always send Content-Length). */
async function readLimited(res: Response, limit: number): Promise<Uint8Array> {
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > limit) throw new LottieUrlError(TOO_LARGE);
    return buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      void reader.cancel();
      throw new LottieUrlError(TOO_LARGE);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/** The animation link carried in a page URL as #url=… (kept out of analytics, which ignore the hash). */
export function lottieUrlFromHash(hash: string): string | null {
  if (!hash.startsWith('#url=')) return null;
  try {
    return decodeURIComponent(hash.slice(5)) || null;
  } catch {
    return null;
  }
}
