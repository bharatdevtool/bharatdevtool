// json-tools.js — pure helpers for the JSON Formatter (no DOM).
// Error location, loose (JSON5 / JS object) parsing, NDJSON, key sorting,
// indentation, JSONPath queries and share-link encoding.

import { isRaw, exactInteger, parseJSONPrecise, toComparable } from './json-raw.js';

const isContainer = (v) => v !== null && typeof v === 'object' && !isRaw(v);

// ── Error location ─────────────────────────────────────────

/** 1-based line and column of a character offset. */
export function lineColumnAt(text, offset) {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}

/**
 * First syntax error in strict JSON, with its position, or null when the text is valid.
 * Messages are plain English and never quote more than one character of the input.
 * @returns {{ offset: number, line: number, column: number, message: string } | null}
 */
export function findJSONError(text) {
  const n = text.length;
  let i = 0;
  const fail = (message, at = i) => {
    throw { at: Math.min(at, n), message };
  };
  const ws = () => {
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 32 || c === 9 || c === 10 || c === 13) i++;
      else break;
    }
  };
  const describe = (c) => (c === undefined ? 'end of input' : c === '"' ? 'a string' : `"${c}"`);
  // What to say when a value is followed by something other than "," or the closing bracket.
  const afterValue = (close, c) => {
    if (c === '}' || c === ']') return `"${c}" does not match the open "${close === '}' ? '{' : '['}": expected "${close}"`;
    const hint = /["{[\d\-tfn]/.test(c) ? ' Is a comma missing?' : '';
    return `Expected "," or "${close}" after a value, found ${describe(c)}.${hint}`;
  };

  const str = () => {
    const start = i;
    i++; // opening quote
    for (;;) {
      if (i >= n) fail('This string is never closed: a closing " is missing', start);
      const c = text[i];
      if (c === '"') { i++; return; }
      if (c === '\\') {
        const next = text[i + 1];
        if (next !== undefined && '"\\/bfnrt'.includes(next)) { i += 2; continue; }
        if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) { i += 6; continue; }
        fail('Invalid escape sequence: only \\" \\\\ \\/ \\b \\f \\n \\r \\t and \\uXXXX are allowed');
      }
      if (text.charCodeAt(i) < 0x20) {
        fail(c === '\n' ? 'Line break inside a string: write it as \\n' : 'Control character inside a string: escape it, for example \\t');
      }
      i++;
    }
  };

  const NUM = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
  const num = () => {
    NUM.lastIndex = i;
    const m = NUM.exec(text);
    if (!m) fail('Invalid number');
    i += m[0].length;
    const next = text[i];
    if (next !== undefined && /[0-9.eE]/.test(next)) fail('Invalid number: no leading zeros, and digits are needed after "."', i - m[0].length);
  };

  const value = () => {
    ws();
    if (i >= n) fail('Unexpected end of input: a value is missing');
    const c = text[i];
    if (c === '{') return obj();
    if (c === '[') return arr();
    if (c === '"') return str();
    if (c === '-' || (c >= '0' && c <= '9')) return num();
    for (const word of ['true', 'false', 'null']) {
      if (text.startsWith(word, i)) { i += word.length; return; }
    }
    if (c === "'") fail("Strings must use double quotes (\"), not single quotes (')");
    if (c === '}' || c === ']') fail(`Unexpected ${describe(c)}: a value is missing`);
    if (/[A-Za-z_$]/.test(c)) fail('Unknown word: text values must be in double quotes, and only true, false and null are allowed bare');
    fail(`Unexpected ${describe(c)}: expected a value`);
  };

  const obj = () => {
    i++;
    ws();
    if (text[i] === '}') { i++; return; }
    for (;;) {
      ws();
      const c = text[i];
      if (c !== '"') {
        if (c === undefined) fail('Unexpected end of input: a closing } is missing');
        if (c === "'") fail("Property names must use double quotes (\"), not single quotes (')");
        if (/[A-Za-z_$0-9]/.test(c)) fail('Property names must be in double quotes');
        fail(`Unexpected ${describe(c)}: expected a property name in double quotes`);
      }
      str();
      ws();
      if (text[i] !== ':') fail(`Expected ":" after the property name, found ${describe(text[i])}`);
      i++;
      value();
      ws();
      if (text[i] === ',') {
        const comma = i;
        i++;
        ws();
        if (text[i] === '}') fail('Trailing comma: remove the "," before "}"', comma);
        continue;
      }
      if (text[i] === '}') { i++; return; }
      if (i >= n) fail('Unexpected end of input: a closing } is missing');
      fail(afterValue('}', text[i]));
    }
  };

  const arr = () => {
    i++;
    ws();
    if (text[i] === ']') { i++; return; }
    for (;;) {
      value();
      ws();
      if (text[i] === ',') {
        const comma = i;
        i++;
        ws();
        if (text[i] === ']') fail('Trailing comma: remove the "," before "]"', comma);
        continue;
      }
      if (text[i] === ']') { i++; return; }
      if (i >= n) fail('Unexpected end of input: a closing ] is missing');
      fail(afterValue(']', text[i]));
    }
  };

  try {
    if (text.charCodeAt(0) === 0xfeff) i = 1;
    value();
    ws();
    if (i < n) fail('Unexpected text after the end of the JSON. Is there more than one top-level value?');
    return null;
  } catch (e) {
    if (e instanceof RangeError) return null; // nesting too deep for this scanner
    if (!e || typeof e.at !== 'number') throw e;
    return { offset: e.at, ...lineColumnAt(text, e.at), message: e.message };
  }
}

// ── Loose parsing: JSON5 and JavaScript object literals ────

/**
 * Parse JSON5 / JS-object-literal text: comments, single quotes, unquoted keys,
 * trailing commas, hex numbers, +1, .5, NaN/Infinity/undefined (become null).
 * Throws an Error with an `offset` property on failure.
 */
export function parseLoose(text) {
  const n = text.length;
  let i = 0;
  const err = (message) => {
    const e = new Error(message);
    /** @type {any} */ (e).offset = i;
    throw e;
  };
  const skip = () => {
    while (i < n) {
      const c = text[i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\u00A0' || c === '\uFEFF' || c === '\u2028' || c === '\u2029') { i++; continue; }
      if (c === '/' && text[i + 1] === '/') {
        while (i < n && text[i] !== '\n') i++;
        continue;
      }
      if (c === '/' && text[i + 1] === '*') {
        const end = text.indexOf('*/', i + 2);
        if (end === -1) err('This comment is never closed');
        i = end + 2;
        continue;
      }
      break;
    }
  };

  const str = () => {
    const q = text[i++];
    let out = '';
    for (;;) {
      if (i >= n) err('This string is never closed');
      const c = text[i++];
      if (c === q) return out;
      if (c === '\\') {
        const e = text[i++];
        if (e === undefined) err('This string is never closed');
        if (e === '\n') continue;
        if (e === '\r') { if (text[i] === '\n') i++; continue; }
        const simple = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' }[e];
        if (simple !== undefined && !(e === '0' && /\d/.test(text[i] || ''))) { out += simple; continue; }
        if (e === 'x') {
          const h = text.slice(i, i + 2);
          if (!/^[0-9a-fA-F]{2}$/.test(h)) err('Invalid \\x escape');
          out += String.fromCharCode(parseInt(h, 16));
          i += 2;
          continue;
        }
        if (e === 'u') {
          if (text[i] === '{') {
            const end = text.indexOf('}', i);
            const h = text.slice(i + 1, end);
            if (end === -1 || !/^[0-9a-fA-F]{1,6}$/.test(h)) err('Invalid \\u{…} escape');
            out += String.fromCodePoint(parseInt(h, 16));
            i = end + 1;
            continue;
          }
          const h = text.slice(i, i + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(h)) err('Invalid \\u escape');
          out += String.fromCharCode(parseInt(h, 16));
          i += 4;
          continue;
        }
        out += e; // \' \" \\ \/ and any other escaped character
        continue;
      }
      if ((c === '\n' || c === '\r') && q !== '`') err('Line break inside a string');
      out += c;
    }
  };

  const NUM = /[+-]?(?:Infinity|NaN|0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/y;
  const IDENT = /[A-Za-z_$][\w$]*/y;

  const value = () => {
    skip();
    if (i >= n) err('Unexpected end of input');
    const c = text[i];
    if (c === '{') return obj();
    if (c === '[') return arr();
    if (c === '"' || c === "'" || c === '`') return str();
    NUM.lastIndex = i;
    const m = NUM.exec(text);
    if (m) {
      i += m[0].length;
      const raw = m[0];
      const sign = raw[0] === '-' ? -1 : 1;
      const body = raw.replace(/^[+-]/, '');
      if (body === 'NaN' || body === 'Infinity') return null;
      if (/^0x/i.test(body)) return sign * parseInt(body, 16);
      if (/^\d+$/.test(body)) return exactInteger((sign < 0 ? '-' : '') + body);
      return sign * Number(body);
    }
    IDENT.lastIndex = i;
    const w = IDENT.exec(text);
    if (w) {
      i += w[0].length;
      if (w[0] === 'true') return true;
      if (w[0] === 'false') return false;
      if (w[0] === 'null' || w[0] === 'undefined') return null;
      i -= w[0].length;
      err('Unknown word: text values must be in quotes');
    }
    return err('Expected a value');
  };

  const obj = () => {
    i++;
    const out = {};
    for (;;) {
      skip();
      if (text[i] === '}') { i++; return out; }
      let key;
      const c = text[i];
      if (c === '"' || c === "'" || c === '`') key = str();
      else {
        IDENT.lastIndex = i;
        const w = IDENT.exec(text) || /\d+/y.exec(text.slice(i)) ;
        if (!w) err('Expected a property name');
        key = w[0];
        i += key.length;
      }
      skip();
      if (text[i] !== ':') err('Expected ":" after the property name');
      i++;
      Object.defineProperty(out, key, { value: value(), enumerable: true, writable: true, configurable: true });
      skip();
      if (text[i] === ',') { i++; continue; }
      if (text[i] === '}') { i++; return out; }
      err('Expected "," or "}"');
    }
  };

  const arr = () => {
    i++;
    const out = [];
    for (;;) {
      skip();
      if (text[i] === ']') { i++; return out; }
      out.push(value());
      skip();
      if (text[i] === ',') { i++; continue; }
      if (text[i] === ']') { i++; return out; }
      err('Expected "," or "]"');
    }
  };

  const result = value();
  skip();
  if (text[i] === ';') { i++; skip(); }
  if (i < n) err('Unexpected text after the end of the value');
  return result;
}

// ── NDJSON / JSON Lines ────────────────────────────────────

/**
 * Read newline-delimited JSON (one value per line).
 * Returns null when the text does not look like NDJSON (fewer than two lines,
 * or the first line is not an object or array).
 * @returns {null | { values: unknown[] } | { line: number, column: number, message: string }}
 */
export function parseNDJSON(text) {
  const lines = text.split(/\r?\n/);
  const filled = lines.map((raw, idx) => ({ l: raw.trim(), raw, idx })).filter((x) => x.l !== '');
  if (filled.length < 2 || !/^[{[]/.test(filled[0].l)) return null;
  let first;
  try { first = parseJSONPrecise(filled[0].l); } catch { return null; }
  if (!isContainer(first)) return null;
  const values = [first];
  for (const { l, raw, idx } of filled.slice(1)) {
    try {
      values.push(parseJSONPrecise(l));
    } catch {
      const e = findJSONError(raw);
      return { line: idx + 1, column: e ? e.column : 1, message: e ? e.message : 'Not valid JSON' };
    }
  }
  return { values };
}

// ── Output shaping ─────────────────────────────────────────

/** Copy of `value` with every object's keys sorted A→Z (arrays keep their order). */
export function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (!isContainer(value)) return value;
  const out = {};
  for (const k of Object.keys(value).sort()) {
    Object.defineProperty(out, k, { value: sortKeysDeep(value[k]), enumerable: true, writable: true, configurable: true });
  }
  return out;
}

/** JSON text with the chosen indentation: '2', '4' or 'tab'. */
export function stringifyIndented(value, indent = '2') {
  const space = indent === 'tab' ? '\t' : Number(indent) || 2;
  return JSON.stringify(value, null, space);
}

// ── JSONPath ───────────────────────────────────────────────

const MAX_RESULTS = 50000;
const MAX_WALK = 3_000_000; // nodes visited by a ".." search

function tokenizePath(expr) {
  let s = expr.trim();
  if (s === '') throw new Error('Type a path, for example $.users[*].email');
  if (s[0] === '$') s = s.slice(1);
  else if (s[0] !== '.' && s[0] !== '[') s = '.' + s;
  const segs = [];
  let i = 0;
  const ident = /[^.[\]\s]+/y;
  while (i < s.length) {
    if (s.startsWith('..', i)) {
      i += 2;
      if (s[i] === '*') { i++; segs.push({ type: 'descend' }, { type: 'wild' }); continue; }
      if (s[i] === '[') { segs.push({ type: 'descend' }); continue; }
      ident.lastIndex = i;
      const m = ident.exec(s);
      if (!m) throw new Error('Expected a name after ".."');
      i += m[0].length;
      segs.push({ type: 'descend' }, { type: 'names', names: [m[0]] });
      continue;
    }
    if (s[i] === '.') {
      i++;
      if (s[i] === '*') { i++; segs.push({ type: 'wild' }); continue; }
      ident.lastIndex = i;
      const m = ident.exec(s);
      if (!m) throw new Error('Expected a name after "."');
      i += m[0].length;
      segs.push({ type: 'names', names: [m[0]] });
      continue;
    }
    if (s[i] === '[') {
      const end = findBracketEnd(s, i);
      const inner = s.slice(i + 1, end).trim();
      i = end + 1;
      segs.push(parseBracket(inner));
      continue;
    }
    throw new Error(`Unexpected "${s[i]}" in the path`);
  }
  return segs;
}

function findBracketEnd(s, start) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    // A regular expression after =~ may contain unbalanced brackets: skip it like a string.
    else if (c === '/' && /=~\s*$/.test(s.slice(start, i))) quote = '/';
    else if (c === '[' || c === '(') depth++;
    else if (c === ']' || c === ')') {
      depth--;
      if (depth === 0 && c === ']') return i;
    }
  }
  throw new Error('A "[" is never closed');
}

function splitTopLevel(s, sep) {
  const parts = [];
  let quote = null;
  let depth = 0;
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      cur += c;
      if (c === '\\') { cur += s[++i] ?? ''; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    if (c === '(' || c === '[') depth++;
    if (c === ')' || c === ']') depth--;
    if (depth === 0 && s.startsWith(sep, i)) {
      parts.push(cur);
      cur = '';
      i += sep.length - 1;
      continue;
    }
    cur += c;
  }
  parts.push(cur);
  return parts;
}

function parseLiteral(raw) {
  const t = raw.trim();
  if (/^(['"]).*\1$/s.test(t)) return t.slice(1, -1).replace(/\\(.)/g, '$1');
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if (t !== '' && !Number.isNaN(Number(t))) return Number(t);
  throw new Error(`Cannot read the value ${t || '(empty)'} in the filter. Put text in quotes.`);
}

function parseBracket(inner) {
  if (inner === '*') return { type: 'wild' };
  if (inner.startsWith('?')) {
    let expr = inner.slice(1).trim();
    if (expr.startsWith('(') && expr.endsWith(')')) expr = expr.slice(1, -1);
    return { type: 'filter', test: compileFilter(expr) };
  }
  const slice = /^(-?\d*)\s*:\s*(-?\d*)(?:\s*:\s*(-?\d+))?$/.exec(inner);
  if (slice) {
    return {
      type: 'slice',
      start: slice[1] === '' ? null : Number(slice[1]),
      end: slice[2] === '' ? null : Number(slice[2]),
      step: slice[3] === undefined ? 1 : Number(slice[3]),
    };
  }
  const parts = splitTopLevel(inner, ',').map((p) => p.trim());
  if (parts.every((p) => /^-?\d+$/.test(p))) return { type: 'indexes', indexes: parts.map(Number) };
  const names = parts.map((p) => {
    if (/^(['"]).*\1$/s.test(p)) return p.slice(1, -1).replace(/\\(.)/g, '$1');
    throw new Error(`Put names in quotes inside [ ], for example ['${p}']`);
  });
  return { type: 'names', names };
}

function compileFilter(expr) {
  const ors = splitTopLevel(expr, '||').map((orPart) =>
    splitTopLevel(orPart, '&&').map((cond) => compileCondition(cond.trim())),
  );
  return (item) => ors.some((ands) => ands.every((test) => test(item)));
}

function compileCondition(cond) {
  if (cond.startsWith('!')) {
    const inner = compileCondition(cond.slice(1).trim());
    return (item) => !inner(item);
  }
  const m = /^(@[^=!<>~\s]*)\s*(==|!=|<=|>=|<|>|=~)\s*(.+)$/s.exec(cond);
  const lhs = m ? m[1] : cond;
  if (!lhs.startsWith('@')) throw new Error('Filters start with @, for example [?(@.age > 25)]');
  const path = lhs === '@' ? [] : tokenizePath('$' + lhs.slice(1));
  if (path.some((p) => p.type !== 'names' || p.names.length !== 1)) {
    throw new Error('Filters can only use simple paths such as @.a.b');
  }
  const keys = path.map((p) => p.names[0]);
  const get = (item) => {
    let cur = item;
    for (const k of keys) {
      if (!isContainer(cur) || !Object.prototype.hasOwnProperty.call(cur, k)) return undefined;
      cur = cur[k];
    }
    return cur;
  };
  if (!m) return (item) => get(item) !== undefined;
  const op = m[2];
  if (op === '=~') {
    const rm = /^\/(.*)\/([a-z]*)$/s.exec(m[3].trim());
    if (!rm) throw new Error('Use =~ with a regular expression, for example =~ /gmail/i');
    let re;
    try {
      re = new RegExp(rm[1], rm[2]);
    } catch {
      throw new Error('The regular expression after =~ is not valid');
    }
    return (item) => {
      const v = get(item);
      return typeof v === 'string' && re.test(v);
    };
  }
  const rhs = parseLiteral(m[3]);
  return (item) => {
    const v = toComparable(get(item));
    if (v === undefined) return false;
    switch (op) {
      case '==': return v === rhs;
      case '!=': return v !== rhs;
      case '<': return v < rhs;
      case '<=': return v <= rhs;
      case '>': return v > rhs;
      case '>=': return v >= rhs;
      default: return false;
    }
  };
}

function children(node) {
  const { path, value } = node;
  if (Array.isArray(value)) return value.map((v, i) => ({ path: [...path, i], value: v }));
  if (isContainer(value)) return Object.keys(value).map((k) => ({ path: [...path, k], value: value[k] }));
  return [];
}

function descendants(node, out) {
  out.push(node);
  if (out.length > MAX_WALK) throw new Error('The document is too large for a ".." search. Start the path lower down.');
  for (const child of children(node)) descendants(child, out);
  return out;
}

/**
 * Run a JSONPath query. Supports $, .name, ['name'], [n], [-n], [a,b], [start:end:step],
 * *, ..name (recursive) and filters like [?(@.age > 25 && @.email)] with
 * == != < <= > >= and =~ /regex/.
 * @returns {{ path: (string|number)[], value: unknown }[]}
 */
export function queryJSONPath(root, expr) {
  const segs = tokenizePath(expr);
  let nodes = [{ path: [], value: root }];
  for (const seg of segs) {
    const next = [];
    for (const node of nodes) {
      const v = node.value;
      switch (seg.type) {
        case 'descend':
          descendants(node, next);
          break;
        case 'wild':
          next.push(...children(node));
          break;
        case 'names':
          if (isContainer(v) && !Array.isArray(v)) {
            for (const name of seg.names) {
              if (Object.prototype.hasOwnProperty.call(v, name)) next.push({ path: [...node.path, name], value: v[name] });
            }
          } else if (Array.isArray(v)) {
            // Allow .0 as an index
            for (const name of seg.names) {
              if (/^\d+$/.test(name) && Number(name) < v.length) next.push({ path: [...node.path, Number(name)], value: v[Number(name)] });
            }
          }
          break;
        case 'indexes':
          if (Array.isArray(v)) {
            for (const raw of seg.indexes) {
              const idx = raw < 0 ? v.length + raw : raw;
              if (idx >= 0 && idx < v.length) next.push({ path: [...node.path, idx], value: v[idx] });
            }
          }
          break;
        case 'slice':
          if (Array.isArray(v)) {
            const len = v.length;
            const step = seg.step || 1;
            const norm = (x, d) => (x === null ? d : x < 0 ? Math.max(len + x, 0) : Math.min(x, len));
            if (step > 0) {
              for (let k = norm(seg.start, 0); k < norm(seg.end, len); k += step) next.push({ path: [...node.path, k], value: v[k] });
            } else {
              const start = seg.start === null ? len - 1 : norm(seg.start, len - 1);
              const end = seg.end === null ? -1 : norm(seg.end, -1);
              for (let k = Math.min(start, len - 1); k > end; k += step) next.push({ path: [...node.path, k], value: v[k] });
            }
          }
          break;
        case 'filter':
          for (const child of children(node)) if (seg.test(child.value)) next.push(child);
          break;
      }
    }
    // Recursive descent followed by a name lists the parent first; drop duplicates.
    nodes = seg.type === 'descend' ? next : dedupe(next);
    if (nodes.length > MAX_WALK) throw new Error('Too many matches. Narrow the path.');
  }
  const results = dedupe(nodes);
  if (results.length > MAX_RESULTS) {
    const capped = results.slice(0, MAX_RESULTS);
    /** @type {any} */ (capped).truncated = results.length;
    return capped;
  }
  return results;
}

function dedupe(nodes) {
  const seen = new Set();
  const out = [];
  for (const node of nodes) {
    const k = JSON.stringify(node.path);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(node);
  }
  return out;
}

// ── Share links ────────────────────────────────────────────

function toBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

/** Text → compact URL-safe string ("z" + deflate when supported, else "r" + raw). */
export async function encodeShare(text) {
  const bytes = new TextEncoder().encode(text);
  if (typeof CompressionStream !== 'undefined') {
    try {
      return 'z' + toBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
    } catch { /* fall back to raw */ }
  }
  return 'r' + toBase64Url(bytes);
}

/** Reverse of encodeShare. Throws when the link is damaged or unsupported. */
export async function decodeShare(token) {
  const kind = token[0];
  const bytes = fromBase64Url(token.slice(1));
  if (kind === 'r') return new TextDecoder().decode(bytes);
  if (kind === 'z') {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open compressed links');
    return new TextDecoder().decode(await pipe(bytes, new DecompressionStream('deflate-raw')));
  }
  throw new Error('Unknown link format');
}

// ── Folding ────────────────────────────────────────────────

/**
 * Multi-line { } and [ ] ranges in JSON text, found in one pass (strings are skipped).
 * Each range is { depth, from: { line, ch }, to: { line, ch } } with `from` just after
 * the opening bracket and `to` at the closing bracket. depth 0 is the outermost value.
 */
export function bracketRanges(text) {
  const ranges = [];
  const stack = [];
  let line = 0;
  let ch = 0;
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 10) { line++; ch = 0; continue; }
    if (inString) {
      if (c === 92) { i++; ch += 2; continue; } // backslash: skip the escaped character
      if (c === 34) inString = false;
      ch++;
      continue;
    }
    if (c === 34) inString = true;
    else if (c === 123 || c === 91) stack.push({ line, ch });
    else if (c === 125 || c === 93) {
      const open = stack.pop();
      if (open && open.line !== line) {
        ranges.push({ depth: stack.length, from: { line: open.line, ch: open.ch + 1 }, to: { line, ch } });
      }
    }
    ch++;
  }
  return ranges;
}

/**
 * Ranges to fold for "Collapse all": every level below the outermost, shallowest levels
 * first, up to `limit` folds (huge files collapse their top levels only).
 */
export function collapseRanges(text, limit = 5000) {
  const byDepth = [];
  for (const r of bracketRanges(text)) {
    if (r.depth === 0) continue;
    (byDepth[r.depth] ||= []).push(r);
  }
  const picked = [];
  for (let d = 1; d < byDepth.length; d++) {
    const level = byDepth[d] || [];
    if (picked.length && picked.length + level.length > limit) break;
    picked.push(...level);
  }
  // Fold inner ranges before the ones that contain them.
  return picked.sort((a, b) => b.depth - a.depth);
}
