// lib/json/formatter.ts — Pure JSON operations (ported from assets/js/formatter.js)

/** Format (pretty-print) JSON string with configurable indent */
export function formatJSON(text: string, indent: number = 2): string {
  return JSON.stringify(JSON.parse(text), null, indent);
}

/** Minify JSON string */
export function minifyJSON(text: string): string {
  return JSON.stringify(JSON.parse(text));
}

/** Check if a string is valid JSON */
export function isValidJSON(text: string): boolean {
  try { JSON.parse(text); return true; } catch { return false; }
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
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

/** Attempt to repair broken JSON (trailing commas, single quotes, etc.) */
export function repairJSON(text: string): string {
  let s = text.trim();
  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');
  // Replace single quotes with double quotes (simple heuristic)
  s = s.replace(/'/g, '"');
  // Remove comments (// style)
  s = s.replace(/\/\/[^\n]*/g, '');
  // Parse to validate, throw if still broken
  JSON.parse(s);
  return s;
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
    // Extract line/column from error message if available
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

