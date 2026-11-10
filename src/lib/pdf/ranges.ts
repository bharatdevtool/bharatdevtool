// Page-range parsing for Split / Extract. Pure, no DOM.

export type RangeResult = { ok: true; groups: number[][] } | { ok: false; error: string };

/**
 * Parse a 1-based page range list such as "1-3, 5, 8-" into groups of 0-based indexes.
 * Each comma-separated part becomes one group (one output file when splitting).
 * "8-" means page 8 to the last page, "-3" means pages 1 to 3.
 */
export function parsePageRanges(input: string, pageCount: number): RangeResult {
  const text = input.trim();
  if (!text) return { ok: false, error: 'Enter pages, for example 1-3, 5, 8-' };
  if (pageCount < 1) return { ok: false, error: 'There are no pages.' };

  const groups: number[][] = [];
  for (const raw of text.split(',')) {
    const part = raw.trim();
    if (!part) continue;
    const m = /^(\d*)\s*(-?)\s*(\d*)$/.exec(part);
    if (!m || (!m[1] && !m[3])) return { ok: false, error: `"${part}" is not a page or range.` };

    const isRange = m[2] === '-';
    const start = m[1] ? Number(m[1]) : 1;
    const end = isRange ? (m[3] ? Number(m[3]) : pageCount) : start;
    if (!isRange && m[3]) return { ok: false, error: `"${part}" is not a page or range.` };
    if (start < 1 || end < 1) return { ok: false, error: 'Page numbers start at 1.' };
    if (start > pageCount || end > pageCount) {
      return { ok: false, error: `Page ${Math.max(start, end)} does not exist (there ${pageCount === 1 ? 'is 1 page' : `are ${pageCount} pages`}).` };
    }
    if (start > end) return { ok: false, error: `"${part}" goes backwards. Write it as ${end}-${start}.` };

    const group: number[] = [];
    for (let p = start; p <= end; p++) group.push(p - 1);
    groups.push(group);
  }
  if (!groups.length) return { ok: false, error: 'Enter pages, for example 1-3, 5, 8-' };
  return { ok: true, groups };
}

/** Compact label for a sorted list of 0-based indexes, e.g. [0,1,2,4] → "1-3, 5". */
export function formatPageList(indexes: number[]): string {
  const sorted = [...new Set(indexes)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    let end = start;
    while (i + 1 < sorted.length && sorted[i + 1] === end + 1) end = sorted[++i];
    parts.push(start === end ? `${start + 1}` : `${start + 1}-${end + 1}`);
  }
  return parts.join(', ');
}
