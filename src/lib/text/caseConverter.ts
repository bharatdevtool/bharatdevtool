// lib/text/caseConverter.ts

export type CaseType =
  | 'uppercase'
  | 'lowercase'
  | 'titleCase'
  | 'sentenceCase'
  | 'camelCase'
  | 'pascalCase'
  | 'snakeCase'
  | 'kebabCase'
  | 'dotCase'
  | 'constantCase'
  | 'toggleCase';

export function convertCase(text: string, type: CaseType): string {
  switch (type) {
    case 'uppercase': return text.toUpperCase();
    case 'lowercase': return text.toLowerCase();
    case 'titleCase': return text.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    case 'sentenceCase': return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    case 'camelCase': return words(text).map((w, i) => i === 0 ? w.toLowerCase() : capitalize(w)).join('');
    case 'pascalCase': return words(text).map(capitalize).join('');
    case 'snakeCase': return words(text).map((w) => w.toLowerCase()).join('_');
    case 'kebabCase': return words(text).map((w) => w.toLowerCase()).join('-');
    case 'dotCase': return words(text).map((w) => w.toLowerCase()).join('.');
    case 'constantCase': return words(text).map((w) => w.toUpperCase()).join('_');
    case 'toggleCase': return text.split('').map((c) => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join('');
    default: return text;
  }
}

function words(text: string): string[] {
  return text.split(/[\s_\-./]+/).filter(Boolean);
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export const CASE_OPTIONS: { value: CaseType; label: string; example: string }[] = [
  { value: 'uppercase',    label: 'UPPERCASE',    example: 'HELLO WORLD' },
  { value: 'lowercase',    label: 'lowercase',    example: 'hello world' },
  { value: 'titleCase',    label: 'Title Case',   example: 'Hello World' },
  { value: 'sentenceCase', label: 'Sentence case',example: 'Hello world' },
  { value: 'camelCase',    label: 'camelCase',    example: 'helloWorld' },
  { value: 'pascalCase',   label: 'PascalCase',   example: 'HelloWorld' },
  { value: 'snakeCase',    label: 'snake_case',   example: 'hello_world' },
  { value: 'kebabCase',    label: 'kebab-case',   example: 'hello-world' },
  { value: 'dotCase',      label: 'dot.case',     example: 'hello.world' },
  { value: 'constantCase', label: 'CONSTANT_CASE',example: 'HELLO_WORLD' },
  { value: 'toggleCase',   label: 'tOGGLE cASE',  example: 'hELLO wORLD' },
];

