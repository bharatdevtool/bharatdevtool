import { describe, it, expect } from 'vitest';
import {
  classify,
  tableColumns,
  getAt,
  setAt,
  deleteAt,
  insertAt,
  renameKey,
  parseCellInput,
  cellText,
  sortIndices,
  filterIndices,
  flattenRows,
  escapeCsvField,
  toCSV,
  pathToString,
  lineRangeForPath,
} from '../public/assets/js/json-grid-model.js';

const sample = {
  store: 'Bharat',
  open: true,
  address: { city: 'Pune', pin: 411001 },
  tags: ['a', 'b'],
  users: [
    { id: 1, name: 'Asha', roles: ['admin', 'dev'], meta: { age: 30 } },
    { id: 2, name: 'Ravi', email: 'r@x.in', meta: { age: 25 } },
  ],
  empty: {},
};

describe('classify', () => {
  it('recognises each shape', () => {
    expect(classify(sample)).toBe('object');
    expect(classify(sample.users)).toBe('arrayOfObjects');
    expect(classify(sample.tags)).toBe('arrayOfPrimitives');
    expect(classify([])).toBe('arrayOfPrimitives');
    expect(classify([1, { a: 1 }])).toBe('mixedArray');
    expect(classify([[1], [2]])).toBe('mixedArray');
    expect(classify(null)).toBe('primitive');
    expect(classify('x')).toBe('primitive');
  });
});

describe('tableColumns', () => {
  it('unions keys in first-seen order and flags nested columns', () => {
    expect(tableColumns(sample.users)).toEqual([
      { key: 'id', nested: false },
      { key: 'name', nested: false },
      { key: 'roles', nested: true },
      { key: 'meta', nested: true },
      { key: 'email', nested: false },
    ]);
  });
});

describe('immutable path updates', () => {
  it('getAt reads nested values and returns undefined for missing paths', () => {
    expect(getAt(sample, ['users', 1, 'meta', 'age'])).toBe(25);
    expect(getAt(sample, ['users', 5, 'name'])).toBeUndefined();
    expect(getAt(sample, ['store', 'x'])).toBeUndefined();
  });

  it('setAt changes only the edited branch', () => {
    const next = setAt(sample, ['users', 0, 'meta', 'age'], 31);
    expect(getAt(next, ['users', 0, 'meta', 'age'])).toBe(31);
    expect(sample.users[0].meta.age).toBe(30);
    expect(next.address).toBe(sample.address);
    expect(next.users[1]).toBe(sample.users[1]);
    expect(setAt(sample, [], 5)).toBe(5);
  });

  it('deleteAt removes object keys and splices array items', () => {
    const noEmail = deleteAt(sample, ['users', 1, 'email']);
    expect('email' in noEmail.users[1]).toBe(false);
    expect('email' in sample.users[1]).toBe(true);
    const oneUser = deleteAt(sample, ['users', 0]);
    expect(oneUser.users).toHaveLength(1);
    expect(oneUser.users[0].name).toBe('Ravi');
  });

  it('insertAt inserts into arrays only', () => {
    const next = insertAt(sample, ['tags', 1], 'z');
    expect(next.tags).toEqual(['a', 'z', 'b']);
    expect(sample.tags).toEqual(['a', 'b']);
    expect(() => insertAt(sample, ['address', 'x'], 1)).toThrow();
  });

  it('renameKey keeps key order and refuses duplicates', () => {
    const next = renameKey(sample, ['address'], 'city', 'town');
    expect(Object.keys(next.address)).toEqual(['town', 'pin']);
    expect(() => renameKey(sample, ['address'], 'city', 'pin')).toThrow(/already exists/);
  });
});

describe('cell editing', () => {
  it('keeps strings as strings', () => {
    expect(parseCellInput('007', 'abc')).toBe('007');
    expect(parseCellInput('true', 'abc')).toBe('true');
  });

  it('parses JSON for non-string cells and falls back to text', () => {
    expect(parseCellInput('42', 1)).toBe(42);
    expect(parseCellInput('false', true)).toBe(false);
    expect(parseCellInput('null', 3)).toBeNull();
    expect(parseCellInput('{"a":1}', null)).toEqual({ a: 1 });
    expect(parseCellInput('hello', 1)).toBe('hello');
    expect(parseCellInput('  ', 1)).toBe('');
  });

  it('cellText round-trips non-strings', () => {
    expect(cellText('a')).toBe('a');
    expect(cellText(null)).toBe('null');
    expect(cellText([1, 2])).toBe('[1,2]');
    expect(cellText(undefined)).toBe('');
  });
});

describe('sort and filter', () => {
  const rows = [{ v: 'b10' }, { v: 3 }, {}, { v: 'b9' }, { v: 1 }, { v: null }];

  it('sorts numbers before strings, uses natural order, and puts missing last', () => {
    expect(sortIndices(rows, 'v', 'asc')).toEqual([4, 1, 3, 0, 5, 2]);
  });

  it('keeps missing values last when descending', () => {
    expect(sortIndices(rows, 'v', 'desc')).toEqual([5, 0, 3, 1, 4, 2]);
  });

  it('is stable for equal values', () => {
    expect(sortIndices([{ a: 1 }, { a: 1 }, { a: 0 }], 'a')).toEqual([2, 0, 1]);
  });

  it('sorts arrays of primitives with key null', () => {
    expect(sortIndices([3, 1, 2], null)).toEqual([1, 2, 0]);
  });

  it('filters case-insensitively by column or whole row', () => {
    const all = [0, 1];
    expect(filterIndices(sample.users, all, 'name', 'ASH')).toEqual([0]);
    expect(filterIndices(sample.users, all, null, 'x.in')).toEqual([1]);
    expect(filterIndices(sample.users, all, 'email', '')).toEqual(all);
  });
});

describe('flatten and CSV', () => {
  it('flattens nested values to dotted columns', () => {
    const { columns, rows } = flattenRows(sample.users);
    expect(columns).toEqual(['id', 'name', 'roles.0', 'roles.1', 'meta.age', 'email']);
    expect(rows[1]).toEqual({ id: 2, name: 'Ravi', email: 'r@x.in', 'meta.age': 25 });
  });

  it('escapes CSV fields only when needed', () => {
    expect(escapeCsvField('plain')).toBe('plain');
    expect(escapeCsvField('a,b')).toBe('"a,b"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField('line\nbreak')).toBe('"line\nbreak"');
    expect(escapeCsvField(null)).toBe('');
  });

  it('writes CSV with the key union and nested values as JSON', () => {
    expect(toCSV(sample.users)).toBe(
      'id,name,roles,meta,email\n' +
        '1,Asha,"[""admin"",""dev""]","{""age"":30}",\n' +
        '2,Ravi,,"{""age"":25}",r@x.in',
    );
    expect(toCSV(['a', 'b'])).toBe('value\na\nb');
  });
});

describe('paths and line ranges', () => {
  it('formats JSONPath labels', () => {
    expect(pathToString([])).toBe('$');
    expect(pathToString(['users', 0, 'meta', 'age'])).toBe('$.users[0].meta.age');
    expect(pathToString(['first name', 1])).toBe('$["first name"][1]');
  });

  it('matches the lines in JSON.stringify(root, null, 2)', () => {
    const lines = JSON.stringify(sample, null, 2).split('\n');
    const at = (path: (string | number)[]) => {
      const r = lineRangeForPath(sample, path);
      return r && lines.slice(r.from, r.to + 1).map((l) => l.trim());
    };
    expect(lineRangeForPath(sample, [])).toEqual({ from: 0, to: lines.length - 1 });
    expect(at(['store'])).toEqual(['"store": "Bharat",']);
    expect(at(['address', 'pin'])).toEqual(['"pin": 411001']);
    expect(at(['users', 1, 'email'])).toEqual(['"email": "r@x.in",']);
    expect(at(['users', 0, 'roles'])).toEqual(['"roles": [', '"admin",', '"dev"', '],']);
    expect(at(['empty'])).toEqual(['"empty": {}']);
    expect(lineRangeForPath(sample, ['nope'])).toBeNull();
  });
});

describe('special keys', () => {
  it('keeps "__proto__" as an ordinary key when setting and renaming', () => {
    const doc = JSON.parse('{"__proto__": {"a": 1}, "b": 2}');
    const edited = setAt(doc, ['__proto__', 'a'], 5);
    expect(Object.keys(edited)).toEqual(['__proto__', 'b']);
    expect(getAt(edited, ['__proto__', 'a'])).toBe(5);
    const renamed = renameKey(doc, [], 'b', '__proto__x');
    expect(Object.keys(renamed)).toEqual(['__proto__', '__proto__x']);
    const toProto = renameKey({ x: 1 }, [], 'x', '__proto__');
    expect(Object.keys(toProto)).toEqual(['__proto__']);
    expect(Object.getPrototypeOf(toProto)).toBe(Object.prototype);
  });
});
