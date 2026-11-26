import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { TOOLS } from '@/config/tools';
import { searchTools, buildToolIndex, matchesQuery, type ToolIndexEntry } from '@/lib/search/toolSearch';

const toolSearchJs = readFileSync(path.join(process.cwd(), 'public/components/tool-search.js'), 'utf8');
const headerJs = readFileSync(path.join(process.cwd(), 'public/components/header.js'), 'utf8');
const formatterHtml = readFileSync(path.join(process.cwd(), 'public/jsonformatter/index.html'), 'utf8');

/** The search() function from public/components/tool-search.js, run against a given index. */
function staticSearch(index: ToolIndexEntry[], query: string): ToolIndexEntry[] {
  const match = toolSearchJs.match(/function search\(query\) \{[\s\S]*?\n  \}\n/);
  if (!match) throw new Error('search() not found in tool-search.js');
  return new Function('tools', 'query', `${match[0]}\nreturn search(query);`)(index, query);
}

describe('searchTools', () => {
  it('matches every word anywhere in label, description, category or keywords', () => {
    const ids = searchTools(TOOLS, 'lottie android').map((t) => t.id);
    expect(ids).toContain('lottie-fixer');
    expect(searchTools(TOOLS, 'unable to parse composition')[0]?.id).toBe('lottie-fixer');
    expect(searchTools(TOOLS, 'zzzz-no-such-tool')).toEqual([]);
  });

  it('ranks tools whose name starts with the query first', () => {
    const results = searchTools(TOOLS, 'lottie');
    expect(results[0].label.toLowerCase().startsWith('lottie')).toBe(true);
    const first = searchTools(TOOLS, 'base64')[0];
    expect(first.label.toLowerCase()).toContain('base64');
  });

  it('returns every tool for an empty query', () => {
    expect(searchTools(TOOLS, '   ')).toHaveLength(TOOLS.length);
  });

  it('matchesQuery is case-insensitive per word', () => {
    expect(matchesQuery('compress pdf to 100kb', 'PDF  100KB')).toBe(true);
    expect(matchesQuery('compress pdf', 'pdf jpg')).toBe(false);
  });
});

describe('tools-index.json', () => {
  const index = buildToolIndex();

  it('lists every registered tool with its route and search text', () => {
    expect(index).toHaveLength(TOOLS.length);
    for (const entry of index) {
      expect(entry.route.startsWith('/')).toBe(true);
      expect(entry.text).toBe(entry.text.toLowerCase());
      expect(entry.text).toContain(entry.label.toLowerCase());
    }
  });

  it('the static search gives the same results as the Next.js palette', () => {
    for (const q of ['', 'pdf', 'lottie android', 'qr', 'json format', 'Base64', 'compress 100kb', 'nothing-matches']) {
      expect(staticSearch(index, q).map((t) => t.id), q).toEqual(searchTools(TOOLS, q).map((t) => t.id));
    }
  });

  it('static pages load the search and the index', () => {
    expect(toolSearchJs).toContain("fetch('/tools-index.json'");
    expect(headerJs).toContain("'tool-search.js'");
    // The JSON Formatter has its own header, so it loads the search directly
    expect(formatterHtml).toContain('components/tool-search.js');
    expect(formatterHtml).toContain('components/tool-search.css');
    expect(formatterHtml).toContain('data-bdt-search');
  });
});
