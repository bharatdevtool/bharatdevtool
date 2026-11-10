import { describe, it, expect } from 'vitest';
import {
  findJSONError,
  lineColumnAt,
  parseLoose,
  parseNDJSON,
  sortKeysDeep,
  stringifyIndented,
  queryJSONPath,
  encodeShare,
  decodeShare,
  bracketRanges,
  collapseRanges,
} from '../public/assets/js/json-tools.js';

describe('findJSONError', () => {
  it('returns null for valid JSON', () => {
    expect(findJSONError('{"a":[1,2,{"b":null}],"c":"x\\n"}')).toBeNull();
    expect(findJSONError('  42 ')).toBeNull();
    expect(findJSONError('﻿{"a":1}')).toBeNull();
  });

  it('agrees with JSON.parse on what is valid', () => {
    const samples = ['{}', '[]', '{"a":1,}', '[1,]', "{'a':1}", '{a:1}', '01', '1.', '"\\x"', '{"a":1}{"b":2}', '"a\nb"', '[1 2]', 'tru', '-', '{"a" 1}', '{"a":}', ''];
    for (const s of samples) {
      let valid = true;
      try { JSON.parse(s); } catch { valid = false; }
      expect(findJSONError(s) === null, s).toBe(valid);
    }
  });

  it('points at a missing comma with line and column', () => {
    const text = '{\n  "a": 1\n  "b": 2\n}';
    expect(findJSONError(text)).toMatchObject({ line: 3, column: 3 });
    expect(findJSONError(text)!.message).toMatch(/comma missing/);
  });

  it('points at the trailing comma itself', () => {
    expect(findJSONError('[1, 2, ]')).toMatchObject({ line: 1, column: 6 });
    expect(findJSONError('{"a":1,\n}')!.message).toMatch(/Trailing comma/);
  });

  it('explains common mistakes', () => {
    expect(findJSONError("{'a': 1}")!.message).toMatch(/double quotes/);
    expect(findJSONError('{a: 1}')!.message).toMatch(/double quotes/);
    expect(findJSONError('{"a": "x\ny"}')!.message).toMatch(/Line break/);
    expect(findJSONError('{"a": 1')!.message).toMatch(/closing \}/);
    expect(findJSONError('{"a": undefined}')!.message).toMatch(/Unknown word/);
    expect(findJSONError('{"a":1} {"b":2}')!.message).toMatch(/after the end/);
    expect(findJSONError('[1, 2}')!.message).toMatch(/does not match the open "\["/);
    expect(findJSONError('{"a": 1]')!.message).toMatch(/does not match the open "\{"/);
    expect(findJSONError('{"a": 1 x}')!.message).not.toMatch(/comma/);
  });

  it('computes line and column', () => {
    expect(lineColumnAt('ab\ncd', 4)).toEqual({ line: 2, column: 2 });
  });
});

describe('parseLoose (JSON5 and JS objects)', () => {
  it('reads JSON5 features', () => {
    const text = `// config
    {
      unquoted: 'single',
      "double": "x",
      hex: 0xFF, half: .5, plus: +1, trailing: 5.,
      nan: NaN, inf: -Infinity, undef: undefined,
      list: [1, 2, ], /* block */
      multi: 'line \\
continues',
      esc: '\\u0041\\x42\\'',
    }`;
    expect(parseLoose(text)).toEqual({
      unquoted: 'single', double: 'x', hex: 255, half: 0.5, plus: 1, trailing: 5,
      nan: null, inf: null, undef: null, list: [1, 2], multi: 'line continues', esc: "AB'",
    });
  });

  it('keeps __proto__ as a normal key', () => {
    const v = parseLoose('{"__proto__": {"x": 1}}');
    expect(Object.keys(v)).toEqual(['__proto__']);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });

  it('throws with an offset on bad input', () => {
    try {
      parseLoose('{a: 1 b: 2}');
      expect.unreachable();
    } catch (e) {
      expect((e as { offset: number }).offset).toBe(6);
    }
  });
});

describe('parseNDJSON', () => {
  it('reads one value per line', () => {
    expect(parseNDJSON('{"a":1}\n\n{"a":2}\r\n[3]')).toEqual({ values: [{ a: 1 }, { a: 2 }, [3]] });
  });

  it('ignores text that is not NDJSON', () => {
    expect(parseNDJSON('{"a":1}')).toBeNull();
    expect(parseNDJSON('{\n"a": 1\n}')).toBeNull();
    expect(parseNDJSON('1\n2')).toBeNull();
  });

  it('reports the bad line', () => {
    expect(parseNDJSON('{"a":1}\n{"a":2,}')).toMatchObject({ line: 2, column: 7 });
  });
});

describe('sortKeysDeep and stringifyIndented', () => {
  it('sorts nested keys and keeps arrays in order', () => {
    const sorted = sortKeysDeep({ b: 1, a: { d: 1, c: [{ z: 1, y: 2 }] } });
    expect(JSON.stringify(sorted)).toBe('{"a":{"c":[{"y":2,"z":1}],"d":1},"b":1}');
  });

  it('indents with 2, 4 or tab', () => {
    expect(stringifyIndented({ a: 1 }, '4')).toBe('{\n    "a": 1\n}');
    expect(stringifyIndented({ a: 1 }, 'tab')).toBe('{\n\t"a": 1\n}');
    expect(stringifyIndented({ a: 1 })).toBe('{\n  "a": 1\n}');
  });
});

describe('queryJSONPath', () => {
  const doc = {
    store: { name: 'Bharat', 'first name': 'x' },
    users: [
      { id: 1, name: 'Asha', email: 'asha@gmail.com', age: 30, tags: ['a'] },
      { id: 2, name: 'Ravi', age: 25 },
      { id: 3, name: 'Meera', email: 'meera@work.in', age: 41 },
    ],
  };
  const values = (expr: string) => queryJSONPath(doc, expr).map((r) => r.value);

  it('handles names, wildcards and indexes', () => {
    expect(values('$.users[*].name')).toEqual(['Asha', 'Ravi', 'Meera']);
    expect(values('users[0].id')).toEqual([1]);
    expect(values('$.users[-1].name')).toEqual(['Meera']);
    expect(values("$.store['first name']")).toEqual(['x']);
    expect(values('$.users[0,2].id')).toEqual([1, 3]);
    expect(values('$.store.*')).toEqual(['Bharat', 'x']);
    expect(values('$')).toEqual([doc]);
  });

  it('handles slices', () => {
    expect(values('$.users[0:2].id')).toEqual([1, 2]);
    expect(values('$.users[1:].id')).toEqual([2, 3]);
    expect(values('$.users[::-1].id')).toEqual([3, 2, 1]);
  });

  it('handles recursive descent', () => {
    expect(values('$..email')).toEqual(['asha@gmail.com', 'meera@work.in']);
    expect(values('$..name')).toEqual(['Bharat', 'Asha', 'Ravi', 'Meera']);
  });

  it('handles filters', () => {
    expect(values('$.users[?(@.age > 28)].name')).toEqual(['Asha', 'Meera']);
    expect(values('$.users[?(@.email)].id')).toEqual([1, 3]);
    expect(values('$.users[?(!@.email)].id')).toEqual([2]);
    expect(values("$.users[?(@.name == 'Ravi')].id")).toEqual([2]);
    expect(values('$.users[?(@.age < 26 || @.id == 3)].id')).toEqual([2, 3]);
    expect(values('$.users[?(@.age > 20 && @.email =~ /gmail/i)].id')).toEqual([1]);
  });

  it('returns paths for each match', () => {
    expect(queryJSONPath(doc, '$.users[1].name')).toEqual([{ path: ['users', 1, 'name'], value: 'Ravi' }]);
  });

  it('explains bad paths', () => {
    expect(() => queryJSONPath(doc, '$.users[')).toThrow(/never closed/);
    expect(() => queryJSONPath(doc, '$.users[name]')).toThrow(/quotes/);
    expect(() => queryJSONPath(doc, '')).toThrow(/Type a path/);
  });
});

describe('share links', () => {
  it('round-trips text, including non-ASCII', async () => {
    const text = JSON.stringify({ msg: 'नमस्ते ❤️', list: Array.from({ length: 200 }, (_, i) => ({ i })) });
    const token = await encodeShare(text);
    expect(token[0]).toBe('z');
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeLessThan(text.length);
    expect(await decodeShare(token)).toBe(text);
  });

  it('rejects unknown formats', async () => {
    await expect(decodeShare('qabc')).rejects.toThrow(/Unknown/);
  });
});

describe('JSONPath regex filters', () => {
  it('allows brackets inside a regex and explains a broken one', () => {
    const doc = { rows: [{ n: 'a(b' }, { n: 'x[y]' }] };
    expect(queryJSONPath(doc, '$.rows[?(@.n =~ /\\(/)].n').map((r) => r.value)).toEqual(['a(b']);
    expect(queryJSONPath(doc, '$.rows[?(@.n =~ /\\[y]/)].n').map((r) => r.value)).toEqual(['x[y]']);
    expect(() => queryJSONPath(doc, '$.rows[?(@.n =~ /(/)]')).toThrow(/regular expression/);
  });
});

describe('bracketRanges and collapseRanges', () => {
  it('finds multi-line bracket pairs and ignores brackets in strings', () => {
    const text = '{\n  "a": [\n    1\n  ],\n  "s": "{ not [ a bracket \\" }",\n  "b": {\n    "c": {}\n  }\n}';
    const ranges = bracketRanges(text);
    expect(ranges).toEqual([
      { depth: 1, from: { line: 1, ch: 8 }, to: { line: 3, ch: 2 } },
      { depth: 1, from: { line: 5, ch: 8 }, to: { line: 7, ch: 2 } },
      { depth: 0, from: { line: 0, ch: 1 }, to: { line: 8, ch: 0 } },
    ]);
  });

  it('keeps the outermost value open and limits huge files to top levels', () => {
    const doc = JSON.stringify({ rows: Array.from({ length: 50 }, (_, i) => ({ i, tags: [i, i] })) }, null, 2);
    expect(collapseRanges(doc).every((r) => r.depth >= 1)).toBe(true);
    expect(collapseRanges(doc).length).toBe(1 + 50 + 50);
    const limited = collapseRanges(doc, 60);
    expect(limited[0].depth).toBe(2); // inner folds come first
    expect(new Set(limited.map((r) => r.depth))).toEqual(new Set([1, 2]));
    expect(limited.length).toBe(51);
  });
});
