// history.js: request history and share links for the cURL tester.
// Pure functions (no DOM), unit-tested in tests/curl-history.test.ts.
//
// History lives in this browser only (localStorage). A share link carries the
// request in the URL fragment (#r=...), which browsers never send to any server,
// and it leaves out secrets (auth headers, cookies, API keys, token params).

export const HISTORY_KEY = 'curl_tester_history';
export const HISTORY_LIMIT = 50;
export const MAX_BODY_CHARS = 100_000;
const MAX_URL_CHARS = 8_000;
const MAX_HEADERS = 60;
const MAX_HEADER_VALUE = 8_000;
const MAX_SHARE_CHARS = 60_000;

export const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const BODY_TYPES = ['raw', 'json', 'form'];
const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,100}$/;

const SECRET_HEADER = /^(authorization|proxy-authorization|cookie|x-api-key|api-key|apikey|x-auth-token|x-access-token|x-csrf-token|x-xsrf-token|x-amz-security-token)$|token|secret|password|api[-_]?key/i;
const SECRET_PARAM = /^(access_token|id_token|refresh_token|token|api_key|apikey|key|secret|client_secret|password|pwd|sig|signature|auth|session|sessionid)$/i;

export function isSecretHeader(name) {
  return SECRET_HEADER.test(String(name));
}

/** One history entry: the request exactly as sent (variables not yet filled in) plus the result. */
export function makeHistoryEntry(request, response, now = Date.now()) {
  const body = typeof request.body === 'string' && request.body ? request.body : null;
  const status = response && response.status !== undefined ? response.status : 'Error';
  return {
    id: now,
    timestamp: new Date(now).toISOString(),
    method: METHODS.includes(request.method) ? request.method : 'GET',
    url: String(request.url || ''),
    headers: { ...(request.headers || {}) },
    body: body && body.length <= MAX_BODY_CHARS ? body : null,
    bodyOmitted: !!body && body.length > MAX_BODY_CHARS,
    bodyType: BODY_TYPES.includes(request.bodyType) ? request.bodyType : 'raw',
    status,
    duration: Math.round(Number(response && response.duration) || 0),
    success: typeof status === 'number' && status >= 200 && status < 300,
  };
}

/** Newest first, at most `limit` entries; ids stay unique even for two sends in the same millisecond. */
export function addToHistory(list, entry, limit = HISTORY_LIMIT) {
  const items = Array.isArray(list) ? list : [];
  let id = entry.id;
  while (items.some((h) => h.id === id)) id += 1;
  return [{ ...entry, id }, ...items].slice(0, limit);
}

export function removeFromHistory(list, id) {
  return (Array.isArray(list) ? list : []).filter((h) => h.id !== id);
}

export function readHistory(raw) {
  try {
    const list = JSON.parse(raw || '[]');
    return Array.isArray(list) ? list.filter((h) => h && typeof h === 'object' && typeof h.url === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Copy of the request without secrets: drops secret-looking headers and blanks
 * secret-looking query parameters. Returns the names that were removed.
 */
export function stripSecrets(request) {
  const removed = [];
  const headers = {};
  for (const [k, v] of Object.entries(request.headers || {})) {
    if (isSecretHeader(k)) removed.push(k);
    else headers[k] = v;
  }
  let url = String(request.url || '');
  const q = url.indexOf('?');
  if (q !== -1) {
    const hashAt = url.indexOf('#', q);
    const query = url.slice(q + 1, hashAt === -1 ? undefined : hashAt);
    const parts = query.split('&').map((pair) => {
      const eq = pair.indexOf('=');
      const name = eq === -1 ? pair : pair.slice(0, eq);
      let decoded = name;
      try { decoded = decodeURIComponent(name.replace(/\+/g, ' ')); } catch { /* keep raw */ }
      if (eq !== -1 && pair.length > eq + 1 && SECRET_PARAM.test(decoded)) {
        removed.push(decoded);
        return name + '=';
      }
      return pair;
    });
    url = url.slice(0, q + 1) + parts.join('&') + (hashAt === -1 ? '' : url.slice(hashAt));
  }
  return { request: { ...request, headers, url }, removed };
}

/** POSIX shell single-quoting: safe for any text, including quotes. */
export function shellQuote(text) {
  return "'" + String(text).replace(/'/g, "'\\''") + "'";
}

/** A copy-paste-ready bash cURL command for a history entry. */
export function toCurl(request, { multiline = true } = {}) {
  const first = ['curl'];
  if (request.method && request.method !== 'GET') first.push('-X', request.method);
  first.push(shellQuote(request.url));
  const rest = Object.entries(request.headers || {}).map(([k, v]) => '-H ' + shellQuote(k + ': ' + v));
  if (request.body && !['GET', 'HEAD'].includes(request.method)) rest.push('--data-raw ' + shellQuote(request.body));
  return [first.join(' '), ...rest].join(multiline ? ' \\\n  ' : ' ');
}

// ── Share links ────────────────────────────────────────────────────────────
// Format: "z" + base64url(deflate-raw(JSON)) when the browser can compress,
// otherwise "j" + base64url(JSON). Both are always accepted when reading.

function bytesToBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipeBytes(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

function canCompress() {
  try {
    return typeof CompressionStream === 'function' && !!new CompressionStream('deflate-raw');
  } catch {
    return false;
  }
}

/** Encodes a request (already stripped of secrets by the caller) for a share link. */
export async function encodeShare(request) {
  const payload = { v: 1, m: request.method, u: request.url, h: request.headers || {}, b: request.body || null, t: request.bodyType || 'raw' };
  const json = new TextEncoder().encode(JSON.stringify(payload));
  if (canCompress()) return 'z' + bytesToBase64Url(await pipeBytes(json, new CompressionStream('deflate-raw')));
  return 'j' + bytesToBase64Url(json);
}

/** Decodes and strictly validates a share payload. Returns null for anything malformed or oversized. */
export async function decodeShare(encoded) {
  try {
    if (typeof encoded !== 'string' || encoded.length < 2 || encoded.length > MAX_SHARE_CHARS) return null;
    if (!/^[zj][A-Za-z0-9_-]+$/.test(encoded)) return null;
    let bytes = base64UrlToBytes(encoded.slice(1));
    if (encoded[0] === 'z') {
      if (typeof DecompressionStream !== 'function') return null;
      bytes = await pipeBytes(bytes, new DecompressionStream('deflate-raw'));
    }
    if (bytes.length > MAX_BODY_CHARS * 4) return null;
    return validateShared(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

export function validateShared(p) {
  if (!p || typeof p !== 'object' || p.v !== 1) return null;
  if (!METHODS.includes(p.m)) return null;
  if (typeof p.u !== 'string' || !p.u || p.u.length > MAX_URL_CHARS) return null;
  if (!/^(https?:\/\/|\{\{)/i.test(p.u)) return null; // no javascript:, data:, file: …
  if (!p.h || typeof p.h !== 'object' || Array.isArray(p.h)) return null;
  const entries = Object.entries(p.h);
  if (entries.length > MAX_HEADERS) return null;
  const headers = {};
  for (const [k, v] of entries) {
    if (!HEADER_NAME.test(k) || typeof v !== 'string' || v.length > MAX_HEADER_VALUE || /[\r\n]/.test(v)) return null;
    headers[k] = v;
  }
  if (p.b !== null && (typeof p.b !== 'string' || p.b.length > MAX_BODY_CHARS)) return null;
  return { method: p.m, url: p.u, headers, body: p.b, bodyType: BODY_TYPES.includes(p.t) ? p.t : 'raw' };
}

/** The encoded part of "#r=…", or null. */
export function readShareHash(hash) {
  const m = /^#?r=([A-Za-z0-9_-]+)$/.exec(String(hash || ''));
  return m ? m[1] : null;
}
