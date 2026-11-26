// src/lib/search/toolSearch.ts — Tool search shared by the ⌘K palette (Next.js) and
// the static pages, which load the same index as /tools-index.json.
//
// Rule: every word of the query must appear somewhere in the tool's label, short
// description, category or keywords. public/components/header.js and the homepage
// filter use the same rule on the `text` field of the JSON index.

import { TOOLS, type Tool } from '@/config/tools';

export interface ToolIndexEntry {
  id: string;
  label: string;
  route: string;
  category: string;
  shortDesc: string;
  /** Lowercase text every query word is matched against */
  text: string;
}

export function toolSearchText(tool: Pick<Tool, 'label' | 'shortDesc' | 'category' | 'keywords'>): string {
  return [tool.label, tool.shortDesc, tool.category, ...tool.keywords].join(' ').toLowerCase();
}

export function queryWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/** True when every word of `query` appears in `text` (an empty query matches everything). */
export function matchesQuery(text: string, query: string): boolean {
  return queryWords(query).every((w) => text.includes(w));
}

/**
 * Tools matching `query`, best first: label starts with the query, then label contains
 * every word, then everything else that matches. Registry order breaks ties.
 */
export function searchTools<T extends Pick<Tool, 'label' | 'shortDesc' | 'category' | 'keywords'>>(
  tools: readonly T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...tools];
  const words = queryWords(q);
  const rank = (t: T) => {
    const label = t.label.toLowerCase();
    if (label.startsWith(q)) return 0;
    if (words.every((w) => label.includes(w))) return 1;
    return 2;
  };
  return tools
    .map((t, i) => ({ t, i, text: toolSearchText(t) }))
    .filter((x) => matchesQuery(x.text, q))
    .sort((a, b) => rank(a.t) - rank(b.t) || a.i - b.i)
    .map((x) => x.t);
}

/** The index served at /tools-index.json for the static HTML pages. */
export function buildToolIndex(tools: readonly Tool[] = TOOLS): ToolIndexEntry[] {
  return tools.map((t) => ({
    id: t.id,
    label: t.label,
    route: t.route,
    category: t.category,
    shortDesc: t.shortDesc,
    text: toolSearchText(t),
  }));
}
