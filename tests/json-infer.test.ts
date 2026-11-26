import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { convertJsonToTypeScript } from '../public/assets/js/json-infer.js';

// Outputs captured from the original inline code of json-to-typescript.html (before the extraction).
const golden = JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/json-ts-golden.json'), 'utf8'));

describe('json-infer.js (JSON → TypeScript)', () => {
  for (const [name, c] of Object.entries(golden.cases) as [string, { input: unknown; outputs: string[] }][]) {
    it(`matches the original output byte for byte: ${name}`, () => {
      golden.optionSets.forEach((options: unknown, i: number) => {
        expect(convertJsonToTypeScript(JSON.stringify(c.input), options)).toBe(c.outputs[i]);
      });
    });
  }

  it('still throws on invalid JSON', () => {
    expect(() => convertJsonToTypeScript('{bad', { rootName: 'Root' })).toThrow();
  });
});
