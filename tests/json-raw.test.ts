import { describe, it, expect } from 'vitest';
import { PRECISE_NUMBERS, parseJSONPrecise, isRaw, cloneValue, hasRoundedIntegers } from '../public/assets/js/json-raw.js';
import { formatJSON, minifyJSON, repairJSON } from '../public/assets/js/formatter.js';
import { parseLoose, parseNDJSON, queryJSONPath, sortKeysDeep, stringifyIndented } from '../public/assets/js/json-tools.js';
import { sortIndices, cellText, toCSV, parseCellInput, setAt, classify } from '../public/assets/js/json-grid-model.js';

const BIG = '12345678901234567890';
const text = `{"id": ${BIG}, "neg": -${BIG}, "small": 42, "float": 0.1, "list": [${BIG}, 1], "s": "${BIG}"}`;

describe.runIf(PRECISE_NUMBERS)('large integers stay exact', () => {
  it('parses and stringifies big integers digit for digit', () => {
    const v = parseJSONPrecise(text);
    expect(isRaw(v.id)).toBe(true);
    expect(v.small).toBe(42);
    expect(v.s).toBe(BIG);
    expect(JSON.stringify(v)).toBe(`{"id":${BIG},"neg":-${BIG},"small":42,"float":0.1,"list":[${BIG},1],"s":"${BIG}"}`);
  });

  it('formats, minifies and repairs without rounding', () => {
    expect(formatJSON(text)).toContain(`"id": ${BIG}`);
    expect(minifyJSON(text)).toContain(`"id":${BIG}`);
    expect(repairJSON(`{id: ${BIG},}`)).toContain(`"id": ${BIG}`);
    expect(JSON.stringify(parseLoose(`{id: ${BIG}, n: -${BIG}}`))).toBe(`{"id":${BIG},"n":-${BIG}}`);
    expect(JSON.stringify((parseNDJSON(`{"a":${BIG}}\n{"a":1}`) as { values: unknown[] }).values)).toBe(`[{"a":${BIG}},{"a":1}]`);
  });

  it('keeps big integers through sort keys, indent, clone and grid edits', () => {
    const v = parseJSONPrecise(text);
    expect(stringifyIndented(sortKeysDeep(v), '2')).toContain(`"id": ${BIG}`);
    expect(JSON.stringify(cloneValue(v))).toBe(JSON.stringify(v));
    expect(JSON.stringify(setAt(v, ['small'], 1))).toContain(`"id":${BIG}`);
    expect(classify(v.list)).toBe('arrayOfPrimitives');
    expect(cellText(v.id)).toBe(BIG);
    expect(JSON.stringify(parseCellInput('98765432109876543210', v.id))).toBe('98765432109876543210');
  });

  it('sorts, filters, queries and exports big integers as numbers', () => {
    const rows = parseJSONPrecise(`[{"n": ${BIG}}, {"n": 5}, {"n": 12345678901234567891}]`);
    expect(sortIndices(rows, 'n')).toEqual([1, 0, 2]);
    expect(toCSV(rows)).toBe(`n\n${BIG}\n5\n12345678901234567891`);
    expect(queryJSONPath(rows, '$[?(@.n > 100)]').map((r) => r.path)).toEqual([[0], [2]]);
    expect(hasRoundedIntegers(rows)).toBe(false);
  });
});

describe('rounding detection', () => {
  it('spots integers past 2^53 in plain parsed values', () => {
    expect(hasRoundedIntegers(JSON.parse(`{"a":[${BIG}]}`))).toBe(true);
    expect(hasRoundedIntegers({ a: 9007199254740991 })).toBe(false);
  });
});
