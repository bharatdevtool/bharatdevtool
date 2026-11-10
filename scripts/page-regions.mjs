// Helpers for generated landing pages: a template HTML page with marked regions
// (<!-- prefix:name --> … <!-- /prefix:name -->) that each page variant fills in.

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** JSON for an inline <script> block, indented two spaces. */
export const jsonBlock = (o) => JSON.stringify(o, null, 2).replace(/</g, '\\u003c').split('\n').map((l) => `  ${l}`).join('\n');

/** Replace the body of one marked region. */
export function region(html, prefix, name, body) {
  const re = new RegExp(`(<!-- ${prefix}:${name} -->\\n)[\\s\\S]*?(\\n\\s*<!-- /${prefix}:${name} -->)`);
  if (!re.test(html)) throw new Error(`Template is missing the ${prefix}:${name} region`);
  return html.replace(re, (_, a, b) => `${a}${body}${b}`);
}

/** Insert sitemap entries for URLs that are missing, right after `afterUrl`'s entry. */
export function addSitemapUrls(xml, urls, afterUrl, today) {
  const missing = urls.filter((u) => !xml.includes(`<loc>${u}</loc>`));
  if (!missing.length) return xml;
  const anchor = xml.indexOf(`<loc>${afterUrl}</loc>`);
  const at = anchor < 0 ? xml.lastIndexOf('</urlset>') : xml.indexOf('</url>', anchor) + '</url>'.length;
  const entries = missing
    .map((u) => `\n  <url>\n    <loc>${u}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`)
    .join('');
  return xml.slice(0, at) + entries + (anchor < 0 ? '\n' : '') + xml.slice(at);
}
