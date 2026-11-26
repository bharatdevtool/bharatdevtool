// /tools-index.json, generated at build time from the tool registry. The static HTML
// pages load it for the ⌘K tool search in public/components/header.js and for the
// homepage filter, so their search always matches src/config/tools.ts.
import { buildToolIndex } from '@/lib/search/toolSearch';

export const dynamic = 'force-static';

export function GET() {
  return new Response(JSON.stringify(buildToolIndex()), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
