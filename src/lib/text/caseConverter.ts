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
  | 'toggleCase'
  | 'alternatingCase'
  | 'slugCase';

export function tokenise(t: string): string[] {
  return t
    .trim()
    .replace(/[_\-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s,./\\:;()[\]{}<>!?@#$%^&*+=|"'`~]+/)
    .filter(Boolean);
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function convertCase(text: string, type: CaseType): string {
  if (!text) return '';

  switch (type) {
    case 'uppercase':
      return text.toUpperCase();

    case 'lowercase':
      return text.toLowerCase();

    case 'titleCase':
      return text.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

    case 'sentenceCase':
      return text.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, (m) => m.toUpperCase());

    case 'camelCase': {
      const wList = tokenise(text);
      if (wList.length === 0) return '';
      return wList[0].toLowerCase() + wList.slice(1).map(capitalize).join('');
    }

    case 'pascalCase': {
      const wList = tokenise(text);
      return wList.map(capitalize).join('');
    }

    case 'snakeCase': {
      const wList = tokenise(text);
      return wList.map((w) => w.toLowerCase()).join('_');
    }

    case 'kebabCase': {
      const wList = tokenise(text);
      return wList.map((w) => w.toLowerCase()).join('-');
    }

    case 'dotCase': {
      const wList = tokenise(text);
      return wList.map((w) => w.toLowerCase()).join('.');
    }

    case 'constantCase': {
      const wList = tokenise(text);
      return wList.map((w) => w.toUpperCase()).join('_');
    }

    case 'toggleCase':
      return text
        .split('')
        .map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()))
        .join('');

    case 'alternatingCase': {
      let toggle = false;
      return text.replace(/[a-zA-Z]/g, (ch) => {
        const r = toggle ? ch.toUpperCase() : ch.toLowerCase();
        toggle = !toggle;
        return r;
      });
    }

    case 'slugCase':
      return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/[\s_]+/g, '-')
        .replace(/-{2,}/g, '-');

    default:
      return text;
  }
}

export const CASE_OPTIONS: { value: CaseType; label: string; example: string }[] = [
  { value: 'uppercase', label: 'UPPERCASE', example: 'HELLO WORLD' },
  { value: 'lowercase', label: 'lowercase', example: 'hello world' },
  { value: 'titleCase', label: 'Title Case', example: 'Hello World' },
  { value: 'sentenceCase', label: 'Sentence case', example: 'Hello world' },
  { value: 'camelCase', label: 'camelCase', example: 'helloWorld' },
  { value: 'pascalCase', label: 'PascalCase', example: 'HelloWorld' },
  { value: 'snakeCase', label: 'snake_case', example: 'hello_world' },
  { value: 'kebabCase', label: 'kebab-case', example: 'hello-world' },
  { value: 'dotCase', label: 'dot.case', example: 'hello.world' },
  { value: 'constantCase', label: 'CONSTANT_CASE', example: 'HELLO_WORLD' },
  { value: 'toggleCase', label: 'tOGGLE cASE', example: 'hELLO wORLD' },
  { value: 'alternatingCase', label: 'aLtErNaTiNg cAsE', example: 'hElLo wOrLd' },
  { value: 'slugCase', label: 'url-slug', example: 'hello-world' },
];
