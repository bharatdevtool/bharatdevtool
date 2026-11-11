import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkLottieUrl, loadLottieFromUrl, lottieUrlFromHash, LottieUrlError, MAX_URL_BYTES } from '@/lib/lottie/fromUrl';

const sampleBytes = readFileSync(join(process.cwd(), 'public/samples/lottie/lock-unlock.lottie'));
const lottieJson = JSON.stringify({ v: '5.7.4', fr: 30, ip: 0, op: 30, w: 100, h: 100, layers: [{ ty: 4, ind: 1 }] });

/** A fake fetch that answers every request with `body` and records what was asked. */
function fakeFetch(body: BodyInit | null, init: ResponseInit = {}) {
  const calls: { url: string; opts?: RequestInit }[] = [];
  const impl = (async (url: string, opts?: RequestInit) => {
    calls.push({ url, opts });
    return new Response(body, { status: 200, ...init });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('Lottie from URL', () => {
  it('loads a .json animation without sending cookies', async () => {
    const { impl, calls } = fakeFetch(lottieJson);
    const res = await loadLottieFromUrl('https://example.com/a.json', impl);
    expect(res.format).toBe('json');
    expect(res.animation.w).toBe(100);
    expect(calls[0].opts?.credentials).toBe('omit');
  });

  it('loads a .lottie archive (detected from the bytes, not the file name)', async () => {
    const { impl } = fakeFetch(new Uint8Array(sampleBytes));
    const res = await loadLottieFromUrl('https://cdn.example.com/download?id=42', impl);
    expect(res.format).toBe('lottie');
    expect(res.animation.layers?.length).toBeGreaterThan(0);
  });

  it('explains when the link is a web page instead of a file', async () => {
    const { impl } = fakeFetch('<!doctype html><html><body>LottieFiles</body></html>');
    await expect(loadLottieFromUrl('https://lottiefiles.com/free-animation/x', impl)).rejects.toThrow(/web page, not an animation/);
  });

  it('rejects JSON that is not a Lottie animation', async () => {
    const { impl } = fakeFetch('{"hello":"world"}');
    await expect(loadLottieFromUrl('https://example.com/x.json', impl)).rejects.toThrow(/not a Lottie animation/);
  });

  it('turns network and CORS failures into a readable message', async () => {
    const impl = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    await expect(loadLottieFromUrl('https://example.com/x.json', impl)).rejects.toThrow(/CORS/);
  });

  it('reports HTTP errors and oversized files', async () => {
    await expect(loadLottieFromUrl('https://example.com/x.json', fakeFetch('nope', { status: 404 }).impl)).rejects.toThrow(/404/);
    const big = fakeFetch(lottieJson, { headers: { 'content-length': String(MAX_URL_BYTES + 1) } });
    await expect(loadLottieFromUrl('https://example.com/x.json', big.impl)).rejects.toThrow(/25 MB/);
  });

  it('only accepts http(s) links', async () => {
    expect(checkLottieUrl('javascript:alert(1)')).toHaveProperty('error');
    expect(checkLottieUrl('file:///etc/passwd')).toHaveProperty('error');
    expect(checkLottieUrl('not a url')).toHaveProperty('error');
    expect(checkLottieUrl('  https://example.com/a.json ')).toEqual({ url: 'https://example.com/a.json' });
    await expect(loadLottieFromUrl('ftp://example.com/a.json', fakeFetch(lottieJson).impl)).rejects.toBeInstanceOf(LottieUrlError);
  });

  it('reads shareable #url= links', () => {
    expect(lottieUrlFromHash('#url=' + encodeURIComponent('https://lottie.host/a b.lottie'))).toBe('https://lottie.host/a b.lottie');
    expect(lottieUrlFromHash('#url=https://lottie.host/x.json')).toBe('https://lottie.host/x.json');
    expect(lottieUrlFromHash('#json=abc')).toBeNull();
    expect(lottieUrlFromHash('#url=%E0%A4')).toBeNull(); // malformed encoding
  });
});
