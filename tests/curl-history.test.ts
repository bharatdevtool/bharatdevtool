import { describe, it, expect } from 'vitest';
import {
  HISTORY_LIMIT,
  addToHistory,
  decodeShare,
  encodeShare,
  isSecretHeader,
  makeHistoryEntry,
  readHistory,
  readShareHash,
  removeFromHistory,
  shellQuote,
  stripSecrets,
  toCurl,
  validateShared,
} from '../public/assets/js/api/history.js';

const req = {
  method: 'POST',
  url: 'https://api.example.com/v1/users?page=2&access_token=s3cret',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer abc', 'X-Request-Id': '42' },
  body: `{"name":"O'Brien"}`,
  bodyType: 'json',
};

describe('cURL tester history', () => {
  it('keeps the whole request so Load restores headers and body', () => {
    const e = makeHistoryEntry(req, { status: 201, duration: 87.6 }, 1_700_000_000_000);
    expect(e).toMatchObject({ method: 'POST', url: req.url, headers: req.headers, body: req.body, bodyType: 'json', status: 201, duration: 88, success: true });
    expect(makeHistoryEntry(req, { status: 'Error', duration: 0 }).success).toBe(false);
  });

  it('does not keep huge bodies', () => {
    const e = makeHistoryEntry({ ...req, body: 'x'.repeat(100_001) }, { status: 200 });
    expect(e.body).toBeNull();
    expect(e.bodyOmitted).toBe(true);
  });

  it('adds newest first, caps the list, keeps ids unique, deletes one item', () => {
    let list: ReturnType<typeof makeHistoryEntry>[] = [];
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) list = addToHistory(list, makeHistoryEntry(req, { status: 200 }, 1000));
    expect(list).toHaveLength(HISTORY_LIMIT);
    expect(new Set(list.map((h) => h.id)).size).toBe(HISTORY_LIMIT);
    const target = list[3].id;
    const after = removeFromHistory(list, target);
    expect(after).toHaveLength(HISTORY_LIMIT - 1);
    expect(after.some((h) => h.id === target)).toBe(false);
  });

  it('reads old (method + URL only) and broken stored history safely', () => {
    expect(readHistory('not json')).toEqual([]);
    expect(readHistory('{"a":1}')).toEqual([]);
    expect(readHistory('[{"id":1,"method":"GET","url":"https://x.test"},null,5]')).toHaveLength(1);
  });

  it('leaves secrets out of share links', () => {
    expect(isSecretHeader('Authorization')).toBe(true);
    expect(isSecretHeader('x-api-key')).toBe(true);
    expect(isSecretHeader('X-Auth-Token')).toBe(true);
    expect(isSecretHeader('Content-Type')).toBe(false);
    const { request, removed } = stripSecrets(req);
    expect(request.headers).toEqual({ 'Content-Type': 'application/json', 'X-Request-Id': '42' });
    expect(request.url).toBe('https://api.example.com/v1/users?page=2&access_token=');
    expect(removed).toEqual(['Authorization', 'access_token']);
  });

  it('copies as a cURL command that survives quotes', () => {
    expect(shellQuote(`it's`)).toBe(`'it'\\''s'`);
    const curl = toCurl(req, { multiline: false });
    expect(curl).toBe(
      `curl -X POST 'https://api.example.com/v1/users?page=2&access_token=s3cret' -H 'Content-Type: application/json' -H 'Authorization: Bearer abc' -H 'X-Request-Id: 42' --data-raw '{"name":"O'\\''Brien"}'`,
    );
    expect(toCurl({ method: 'GET', url: 'https://x.test', headers: {}, body: 'ignored' })).toBe(`curl 'https://x.test'`);
  });
});

describe('cURL tester share links', () => {
  it('round-trips a request through the #r= fragment', async () => {
    const shared = { method: 'PUT', url: 'https://api.example.com/items/7', headers: { Accept: 'application/json' }, body: '{"ok":true}', bodyType: 'json' };
    const code = await encodeShare(shared);
    expect(code).toMatch(/^[zj][A-Za-z0-9_-]+$/);
    expect(readShareHash(`#r=${code}`)).toBe(code);
    expect(await decodeShare(code)).toEqual(shared);
  });

  it('rejects broken, hostile or oversized links', async () => {
    expect(readShareHash('#foo=1')).toBeNull();
    expect(await decodeShare('zzzz')).toBeNull();
    expect(await decodeShare('j' + 'A'.repeat(70_000))).toBeNull();
    const ok = { v: 1, m: 'GET', u: 'https://x.test', h: {}, b: null, t: 'raw' };
    expect(validateShared(ok)).not.toBeNull();
    expect(validateShared({ ...ok, u: 'javascript:alert(1)' })).toBeNull();
    expect(validateShared({ ...ok, m: 'TRACE' })).toBeNull();
    expect(validateShared({ ...ok, h: { 'Bad Header': 'x' } })).toBeNull();
    expect(validateShared({ ...ok, h: { A: 'x\r\nInjected: 1' } })).toBeNull();
    expect(validateShared({ ...ok, v: 2 })).toBeNull();
    expect(validateShared({ ...ok, u: '{{baseUrl}}/users' })).not.toBeNull();
  });
});
