// Tell Bing, Yandex and the other IndexNow search engines which pages changed,
// so they recrawl them within hours instead of weeks. https://www.indexnow.org
//
// Run AFTER a production deploy is live (the key file must be reachable):
//   pnpm indexnow                       → every URL in public/sitemap.xml
//   pnpm indexnow / /jsonformatter/     → only these paths
//
// Ownership is proven by the key file public/<KEY>.txt (its content is the key).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const HOST = 'bharatdevtool.com';
const ORIGIN = `https://${HOST}`;
const PUBLIC_DIR = join(process.cwd(), 'public');

const keyFile = readdirSync(PUBLIC_DIR).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) throw new Error('IndexNow key file (public/<32 hex chars>.txt) not found');
const key = readFileSync(join(PUBLIC_DIR, keyFile), 'utf8').trim();

const args = process.argv.slice(2);
const urlList = args.length
  ? args.map((p) => new URL(p, ORIGIN).href)
  : [...readFileSync(join(PUBLIC_DIR, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key, keyLocation: `${ORIGIN}/${keyFile}`, urlList }),
});

// 200 = accepted, 202 = accepted (key check pending). Anything else is an error.
console.log(`IndexNow: ${res.status} ${res.statusText} for ${urlList.length} URL(s)`);
if (res.status !== 200 && res.status !== 202) {
  console.error(await res.text());
  process.exit(1);
}
