// json-raw.js — keep large integers exact.
// JavaScript numbers lose digits past 2^53 (9007199254740991), so JSON.parse turns
// 12345678901234567890 into 12345678901234567000. Where the browser supports
// JSON.rawJSON and reviver source text (Chrome 114+, Firefox 135+, Safari 18.4+), such
// integers are kept as "raw JSON" values that JSON.stringify writes back digit for digit.

/** True when this browser can keep large integers exact. */
export const PRECISE_NUMBERS = (() => {
  try {
    if (typeof JSON.rawJSON !== 'function' || typeof JSON.isRawJSON !== 'function') return false;
    let source = null;
    JSON.parse('[1]', (k, v, ctx) => {
      if (typeof v === 'number') source = ctx && ctx.source;
      return v;
    });
    return source === '1';
  } catch {
    return false;
  }
})();

/** A large integer kept as its exact source text. */
export function isRaw(v) {
  return PRECISE_NUMBERS && v !== null && typeof v === 'object' && JSON.isRawJSON(v);
}

/** Exact text of a raw number. */
export function rawText(v) {
  return v.rawJSON;
}

/** Raw JSON value for an integer literal, when it is not exactly representable as a JS number. */
export function exactInteger(sourceText) {
  if (!PRECISE_NUMBERS || !/^-?\d+$/.test(sourceText)) return Number(sourceText);
  const n = Number(sourceText);
  return Number.isSafeInteger(n) ? n : JSON.rawJSON(sourceText);
}

const LONG_DIGITS = /\d{16,}/;

/** JSON.parse that keeps integers longer than 15 digits exact (when supported). */
export function parseJSONPrecise(text) {
  if (!PRECISE_NUMBERS || !LONG_DIGITS.test(text)) return JSON.parse(text);
  return JSON.parse(text, (key, value, ctx) =>
    typeof value === 'number' && !Number.isSafeInteger(value) && ctx && /^-?\d+$/.test(ctx.source)
      ? JSON.rawJSON(ctx.source)
      : value,
  );
}

/** Number for comparisons (sorting, filters). Raw integers become BigInt. */
export function toComparable(v) {
  return isRaw(v) ? BigInt(v.rawJSON) : v;
}

/** Deep copy that keeps raw numbers. */
export function cloneValue(v) {
  if (v === null || typeof v !== 'object' || isRaw(v)) return v;
  if (Array.isArray(v)) return v.map(cloneValue);
  const out = {};
  for (const k of Object.keys(v)) {
    Object.defineProperty(out, k, { value: cloneValue(v[k]), enumerable: true, writable: true, configurable: true });
  }
  return out;
}

/** True if a parsed value contains integers that this browser had to round. */
export function hasRoundedIntegers(v) {
  if (typeof v === 'number') return Number.isInteger(v) && !Number.isSafeInteger(v);
  if (v === null || typeof v !== 'object' || isRaw(v)) return false;
  for (const k of Object.keys(v)) if (hasRoundedIntegers(v[k])) return true;
  return false;
}
