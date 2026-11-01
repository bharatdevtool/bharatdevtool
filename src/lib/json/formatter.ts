// lib/json/formatter.ts — Pure JSON operations (ported from assets/js/formatter.js)

/** Format (pretty-print) JSON string with configurable indent */
export function formatJSON(text: string, indent: number = 2): string {
  try {
    return JSON.stringify(JSON.parse(text), null, indent);
  } catch (err) {
    throw new Error('Invalid JSON: ' + (err as Error).message);
  }
}

/** Minify JSON string */
export function minifyJSON(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text));
  } catch (err) {
    throw new Error('Invalid JSON: ' + (err as Error).message);
  }
}

/** Check if a string is valid JSON */
export function isValidJSON(text: string): boolean {
  if (!text || !text.trim()) return false;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/** Escape JSON string for embedding in other strings */
export function escapeJSON(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/** Unescape an escaped JSON string */
export function unescapeJSON(text: string): string {
  try {
    return JSON.parse('"' + text.replace(/"/g, '\\"') + '"');
  } catch {
    return text
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
}

function stripComments(input: string): string {
  let result = '';
  let inString = false;
  let stringQuote = '';
  let escaped = false;
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    const next = i + 1 < input.length ? input[i + 1] : '';
    if (inString) {
      result += ch;
      if (!escaped && ch === stringQuote) {
        inString = false;
        stringQuote = '';
      }
      escaped = !escaped && ch === '\\';
      i += 1;
      continue;
    }
    if (ch === '"' || ch === '\'') {
      inString = true;
      stringQuote = ch;
      result += ch;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '/') {
      i += 2;
      while (i < input.length && input[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i + 1 < input.length && !(input[i] === '*' && input[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    result += ch;
    i += 1;
  }
  return result;
}

/** Attempt to repair broken JSON (trailing commas, single quotes, unquoted keys, comments, etc.) */
export function repairJSON(text: string): string {
  let t = String(text ?? '').trim();
  if (!t) return '{}';

  // Check if already valid
  try {
    const obj = JSON.parse(t);
    return JSON.stringify(obj, null, 2);
  } catch {
    // proceed to repair
  }

  t = t.replace(/^\uFEFF/, '');
  t = stripComments(t);

  // Unwrap JSONP or JS assignments
  const jsonpMatch = t.match(/^\s*([\$\w\[\]\.]+)\s*\(\s*([\s\S]*)\)\s*;?\s*$/);
  if (jsonpMatch && jsonpMatch[2]) t = jsonpMatch[2];

  const varMatch = t.match(/^(?:var|let|const)\s+[\w\$]+\s*=\s*([\s\S]+?);?\s*$/);
  if (varMatch) t = varMatch[1];

  const exportMatch = t.match(/^export\s+default\s+([\s\S]+?);?\s*$/);
  if (exportMatch) t = exportMatch[1];

  // If looks like bare property list, wrap in braces
  const trimmed = t.trim();
  if (!/^[{\[]/.test(trimmed) && /[A-Za-z_\$][A-Za-z0-9_\$]*\s*:/.test(trimmed)) {
    t = '{' + trimmed + '}';
  }

  // Remove trailing commas in objects and arrays, and at end of input
  t = t.replace(/,\s*([}\]])/g, '$1');
  t = t.replace(/,\s*$/g, '');

  // Missing commas between objects/arrays/primitives and next key
  t = t.replace(/([}\]])\s*(?=\")/g, '$1, ');
  t = t.replace(/("(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?|true|false|null)\s*(?=\")/g, '$1, ');

  // Quote unquoted keys
  t = t.replace(/(^|[,{\s])([A-Za-z_\$][A-Za-z0-9_\$]*)\s*:/g, '$1"$2":');
  t = t.replace(/:\s*'([^'\n\r]*)'/g, ': "$1"');
  t = t.replace(/'([^']+)'\s*:/g, '"$1":');
  t = t.replace(/\bundefined\b/g, 'null').replace(/\bNaN\b/g, 'null').replace(/-?\bInfinity\b/g, 'null');
  t = t.replace(/;\s*$/, '');

  try {
    const obj = JSON.parse(t);
    return JSON.stringify(obj, null, 2);
  } catch (err) {
    throw new Error('Could not repair JSON: ' + (err as Error).message);
  }
}

export interface JSONValidationResult {
  valid: boolean;
  error?: string;
  line?: number;
  column?: number;
}

/** Validate JSON and return structured result with error location */
export function validateJSON(text: string): JSONValidationResult {
  try {
    JSON.parse(text);
    return { valid: true };
  } catch (err) {
    const msg = (err as Error).message;
    const pos = msg.match(/position (\d+)/);
    if (pos) {
      const charPos = parseInt(pos[1], 10);
      const before = text.slice(0, charPos);
      const line = (before.match(/\n/g) || []).length + 1;
      const column = before.length - before.lastIndexOf('\n');
      return { valid: false, error: msg, line, column };
    }
    return { valid: false, error: msg };
  }
}
