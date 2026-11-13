/**
 * IndexNow URL Submission Script for Bharat Dev Tools
 * Submits updated URLs to the IndexNow API (Bing, Yandex, Seznam, Naver)
 * Usage: node scripts/ping-indexnow.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const HOST = 'bharatdevtool.com';
const KEY = 'e8f49a2c1b7d5e0a9f3b8c4d6e2a1f5c';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

// Extract top URLs from sitemap.xml
function getSitemapUrls() {
  const sitemapPath = path.join(__dirname, '..', 'public', 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) {
    return [`https://${HOST}/`];
  }
  const content = fs.readFileSync(sitemapPath, 'utf8');
  const matches = [...content.matchAll(/<loc>(https:\/\/[^<]+)<\/loc>/g)].map(m => m[1]);
  return matches.slice(0, 100); // IndexNow limit per batch is 10,000
}

function pingIndexNow() {
  const urlList = getSitemapUrls();
  const payload = JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList: urlList
  });

  const options = {
    hostname: 'api.indexnow.org',
    port: 443,
    path: '/indexnow',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  console.log(`[IndexNow] Submitting ${urlList.length} URLs to api.indexnow.org...`);

  const req = https.request(options, (res) => {
    console.log(`[IndexNow] Response status: ${res.statusCode} ${res.statusMessage}`);
    res.on('data', (d) => process.stdout.write(d));
    res.on('end', () => console.log('\n[IndexNow] Submission complete.'));
  });

  req.on('error', (e) => {
    console.warn(`[IndexNow] Ping notification skipped or offline: ${e.message}`);
  });

  req.write(payload);
  req.end();
}

if (require.main === module) {
  pingIndexNow();
}

module.exports = { pingIndexNow };

