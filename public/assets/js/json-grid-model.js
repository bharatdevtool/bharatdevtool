// json-grid-model.js — pure data helpers for the JSON Formatter's Grid view.
// No DOM access: the renderer (json-grid-view.js) and the tests both import this.

/** @typedef {(string|number)[]} Path  keys for objects, indexes for arrays */

import { isRaw, rawText, toComparable, parseJSONPrecise } from './json-raw.js';

// Raw numbers (exact large integers) are objects internally but behave as numbers here.
const isContainer = (v) => v !== null && typeof v === 'object' && !isRaw(v);
const isPlainObject = (v) => isContainer(v) && !Array.isArray(v);

/**
 * How a value should be shown in the grid.
 * @returns {'object'|'arrayOfObjects'|'arrayOfPrimitives'|'mixedArray'|'primitive'}
 */
export function classify(value) {
  if (isPlainObject(value)) return 'object';
  if (!Array.isArray(value)) return 'primitive';
  if (value.length === 0) return 'arrayOfPrimitives';
  let objects = 0;
  let containers = 0;
  for (const item of value) {
    if (isPlainObject(item)) objects++;
    if (isContainer(item)) containers++;
  }
  if (objects === value.length) return 'arrayOfObjects';
  if (containers === 0) return 'arrayOfPrimitives';
  return 'mixedArray';
}

/**
 * Union of keys across an array of objects, in first-seen order.
 * `nested` is true when any row holds an object or array under that key.
 * @returns {{ key: string, nested: boolean }[]}
 */
export function tableColumns(rows) {
  const index = new Map();
  const cols = [];
  for (const row of rows) {
    if (!isPlainObject(row)) continue;
    for (const key of Object.keys(row)) {
      let col = index.get(key);
      if (!col) {
        col = { key, nested: false };
        index.set(key, col);
        cols.push(col);
      }
      if (isContainer(row[key])) col.nested = true;
    }
  }
  return cols;
}

/** Value at `path`, or undefined when any step is missing. */
export function getAt(root, path) {
  let cur = root;
  for (const seg of path) {
    if (!isContainer(cur) || !Object.prototype.hasOwnProperty.call(cur, seg)) return undefined;
    cur = cur[seg];
  }
  return cur;
}

function shallowCopy(v) {
  return Array.isArray(v) ? v.slice() : { ...v };
}

/** Set an own property, even for keys like "__proto__" (plain assignment would change the prototype). */
function defineKey(obj, key, value) {
  Object.defineProperty(obj, key, { value, enumerable: true, writable: true, configurable: true });
}

/** Rebuild the containers along `path`, letting `edit` change the last parent copy. */
function updateParent(root, path, edit) {
  if (path.length === 0) throw new Error('Path must not be empty');
  const copyRoot = shallowCopy(root);
  let src = root;
  let dst = copyRoot;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i];
    if (!isContainer(src[seg])) throw new Error('Path does not exist');
    if (Array.isArray(dst)) dst[seg] = shallowCopy(src[seg]);
    else defineKey(dst, seg, shallowCopy(src[seg]));
    src = src[seg];
    dst = dst[seg];
  }
  edit(dst, path[path.length - 1]);
  return copyRoot;
}

/** New root with `value` set at `path`. The input is not mutated. */
export function setAt(root, path, value) {
  if (path.length === 0) return value;
  return updateParent(root, path, (parent, key) => {
    if (Array.isArray(parent)) parent[key] = value;
    else defineKey(parent, key, value);
  });
}

/** New root with the key or array item at `path` removed. */
export function deleteAt(root, path) {
  return updateParent(root, path, (parent, key) => {
    if (Array.isArray(parent)) parent.splice(Number(key), 1);
    else delete parent[key];
  });
}

/** New root with `value` inserted into the array at `path` (path ends in an index). */
export function insertAt(root, path, value) {
  return updateParent(root, path, (parent, index) => {
    if (!Array.isArray(parent)) throw new Error('insertAt needs an array parent');
    parent.splice(Number(index), 0, value);
  });
}

/** New root with object key `oldKey` at `parentPath` renamed, keeping key order. */
export function renameKey(root, parentPath, oldKey, newKey) {
  if (oldKey === newKey) return root;
  const parent = getAt(root, parentPath);
  if (!isPlainObject(parent)) throw new Error('renameKey needs an object parent');
  if (Object.prototype.hasOwnProperty.call(parent, newKey)) throw new Error(`Key "${newKey}" already exists`);
  const renamed = {};
  for (const k of Object.keys(parent)) defineKey(renamed, k === oldKey ? newKey : k, parent[k]);
  return setAt(root, parentPath, renamed);
}

/**
 * Turn what the user typed into a cell back into a JSON value.
 * Editing a string keeps it a string (so "007" or "true" stay text). Otherwise
 * the text is read as JSON (number, boolean, null, object, array) and falls
 * back to a string when it is not valid JSON.
 */
export function parseCellInput(text, previousValue) {
  if (typeof previousValue === 'string') return text;
  const trimmed = text.trim();
  if (trimmed === '') return '';
  try {
    return parseJSONPrecise(trimmed);
  } catch {
    return text;
  }
}

/** Text shown in a cell (and used to edit it). */
export function cellText(value) {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  if (isRaw(value)) return rawText(value);
  return JSON.stringify(value);
}

const TYPE_RANK = { number: 0, string: 1, boolean: 2, null: 3, object: 4, missing: 5 };
function typeOf(v) {
  if (v === undefined) return 'missing';
  if (v === null) return 'null';
  if (isRaw(v)) return 'number';
  if (typeof v === 'object') return 'object';
  return typeof v;
}
const collator = typeof Intl !== 'undefined' ? new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }) : null;

function compareValues(a, b) {
  const ta = typeOf(a);
  const tb = typeOf(b);
  if (ta !== tb) return TYPE_RANK[ta] - TYPE_RANK[tb];
  if (ta === 'number') {
    const x = toComparable(a);
    const y = toComparable(b);
    return x < y ? -1 : x > y ? 1 : 0;
  }
  if (ta === 'string') return collator ? collator.compare(a, b) : (a < b ? -1 : a > b ? 1 : 0);
  if (ta === 'boolean') return Number(a) - Number(b);
  if (ta === 'object') return JSON.stringify(a).length - JSON.stringify(b).length;
  return 0;
}

/**
 * Row indexes of `rows` sorted by column `key` (or by the value itself when
 * key is null, for arrays of primitives). Stable. Missing values always sort last.
 * @param {'asc'|'desc'} dir
 * @returns {number[]}
 */
export function sortIndices(rows, key, dir = 'asc') {
  const sign = dir === 'desc' ? -1 : 1;
  const pick = (row) => (key === null ? row : isPlainObject(row) ? row[key] : undefined);
  return rows
    .map((row, i) => ({ v: pick(row), i }))
    .sort((x, y) => {
      const xMissing = x.v === undefined;
      const yMissing = y.v === undefined;
      if (xMissing !== yMissing) return xMissing ? 1 : -1;
      return sign * compareValues(x.v, y.v) || x.i - y.i;
    })
    .map((e) => e.i);
}

/**
 * Indexes (taken from `indices`) of the rows whose value contains `query`,
 * case-insensitive. With key === null the whole row is searched.
 */
export function filterIndices(rows, indices, key, query) {
  const q = String(query).trim().toLowerCase();
  if (!q) return indices;
  return indices.filter((i) => {
    const row = rows[i];
    const v = key === null ? row : isPlainObject(row) ? row[key] : undefined;
    return v !== undefined && cellText(v).toLowerCase().includes(q);
  });
}

/**
 * Flatten each row to one level with dotted keys: {a:{b:1}, c:[2]} → {"a.b":1, "c.0":2}.
 * Empty objects and arrays are kept as values.
 * @returns {{ columns: string[], rows: Record<string, unknown>[] }}
 */
export function flattenRows(rows) {
  const columns = [];
  const seen = new Set();
  const out = rows.map((row) => {
    const flat = {};
    const walk = (v, prefix) => {
      if (isContainer(v) && Object.keys(v).length > 0) {
        for (const k of Object.keys(v)) walk(v[k], prefix ? `${prefix}.${k}` : String(k));
      } else {
        const key = prefix || 'value';
        flat[key] = v;
        if (!seen.has(key)) { seen.add(key); columns.push(key); }
      }
    };
    walk(row, '');
    return flat;
  });
  return { columns, rows: out };
}

/** One CSV field: quoted only when it holds a quote, the delimiter or a line break. */
export function escapeCsvField(value, delimiter = ',') {
  const str = value === null || value === undefined ? '' : isRaw(value) ? rawText(value) : isContainer(value) ? JSON.stringify(value) : String(value);
  const needsQuotes = str.includes('"') || str.includes(delimiter) || str.includes('\n') || str.includes('\r');
  if (!needsQuotes) return str;
  return '"' + str.replace(/"/g, '""') + '"';
}

/**
 * CSV for an array of objects. Columns default to the union of keys; nested
 * values are written as JSON. Arrays of primitives become a single "value" column.
 */
export function toCSV(rows, columns, { delimiter = ',', includeHeader = true } = {}) {
  const cols = columns || (classify(rows) === 'arrayOfObjects' ? tableColumns(rows).map((c) => c.key) : null);
  const lines = [];
  if (!cols) {
    if (includeHeader) lines.push('value');
    for (const v of rows) lines.push(escapeCsvField(v, delimiter));
    return lines.join('\n');
  }
  if (includeHeader) lines.push(cols.map((k) => escapeCsvField(k, delimiter)).join(delimiter));
  for (const row of rows) {
    lines.push(cols.map((k) => escapeCsvField(isPlainObject(row) ? row[k] : undefined, delimiter)).join(delimiter));
  }
  return lines.join('\n');
}

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
/** JSONPath-style label: ["users", 0, "first name"] → $.users[0]["first name"] */
export function pathToString(path) {
  let s = '$';
  for (const seg of path) {
    if (typeof seg === 'number') s += `[${seg}]`;
    else if (IDENT.test(seg)) s += `.${seg}`;
    else s += `[${JSON.stringify(seg)}]`;
  }
  return s;
}

/** Number of lines `value` takes in JSON.stringify(value, null, 2). */
export function lineCount(value) {
  if (!isContainer(value)) return 1;
  const keys = Object.keys(value);
  if (keys.length === 0) return 1;
  let n = 2;
  for (const k of keys) n += lineCount(value[k]);
  return n;
}

/**
 * 0-based line range of the value at `path` inside JSON.stringify(root, null, 2),
 * which is exactly what the Formatter's output editor holds. Null if the path is missing.
 * @returns {{ from: number, to: number } | null}
 */
export function lineRangeForPath(root, path) {
  let line = 0;
  let cur = root;
  for (const seg of path) {
    if (!isContainer(cur)) return null;
    const keys = Object.keys(cur);
    const target = String(seg);
    if (!keys.includes(target)) return null;
    line += 1; // opening brace or bracket
    for (const k of keys) {
      if (k === target) break;
      line += lineCount(cur[k]);
    }
    cur = cur[seg];
  }
  return { from: line, to: line + lineCount(cur) - 1 };
}
