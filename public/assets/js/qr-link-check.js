// qr-link-check.js — plain-language warnings for a link found in a QR code, before anyone opens it.
// Pure: no network. It can't prove a link is safe; it flags common tricks used in QR scams.

const SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'cutt.ly', 'rb.gy', 'shorturl.at', 'ow.ly', 'buff.ly',
  'rebrand.ly', 'tiny.cc', 's.id', 'lnkd.in', 'shorte.st', 'v.gd', 'qrco.de', 'bl.ink', 'short.io', 'tny.im',
]);
const RISKY_FILES = /\.(apk|exe|msi|dmg|bat|cmd|scr|jar|vbs|ps1)(?:$|[?#])/i;
const BAIT = /\b(kyc|otp|refund|reward|lottery|lucky|prize|cashback|verify|blocked|suspend)/i;

/**
 * @typedef {{ level: 'danger' | 'warn', text: string }} Warning
 * @param {string} raw
 * @returns {{ valid: boolean, host: string, secure: boolean, warnings: Warning[] }}
 */
export function checkLink(raw) {
  /** @type {Warning[]} */
  const warnings = [];
  let u;
  try {
    u = new URL(String(raw).trim());
  } catch {
    return { valid: false, host: '', secure: false, warnings: [{ level: 'danger', text: 'This is not a valid web address.' }] };
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    return { valid: false, host: '', secure: false, warnings: [{ level: 'danger', text: `This is a "${u.protocol.replace(':', '')}" link, not a website. Don't open it unless you know what it does.` }] };
  }
  const host = u.hostname.toLowerCase();
  if (u.username || u.password) warnings.push({ level: 'danger', text: 'The address hides its real destination behind an "@". This is a common phishing trick.' });
  if (host.includes('xn--') || /[^\x00-\x7f]/.test(host)) warnings.push({ level: 'danger', text: 'The website name uses look-alike letters from other alphabets. It may imitate a real site.' });
  if (RISKY_FILES.test(u.pathname)) warnings.push({ level: 'danger', text: 'This link downloads an app or program file. Never install apps from a QR code you don’t fully trust.' });
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[')) warnings.push({ level: 'warn', text: 'The link goes to a bare number address, not a website name. Real businesses rarely do this.' });
  if (SHORTENERS.has(host)) warnings.push({ level: 'warn', text: 'This is a short link: you can’t see where it really goes until you open it.' });
  if (u.protocol === 'http:') warnings.push({ level: 'warn', text: 'The connection is not encrypted (http, not https). Don’t enter passwords or payment details there.' });
  if (BAIT.test(`${host}${u.pathname}${u.search}`)) warnings.push({ level: 'warn', text: 'It mentions KYC, OTP, refunds or prizes. Banks and companies don’t ask for these through QR codes.' });
  if (host.split('.').length > 4) warnings.push({ level: 'warn', text: 'The website name has many parts. Check the end of it: that is the real site.' });
  return { valid: true, host, secure: u.protocol === 'https:', warnings };
}

/** The registrable-looking end of a host ("login.bank.example.co.in" → "example.co.in"), for display. @param {string} host */
export function mainDomain(host) {
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const twoLevel = /^(co|com|net|org|gov|ac|edu|nic|res|gen|firm|ind)$/.test(parts[parts.length - 2]) && parts[parts.length - 1].length === 2;
  return parts.slice(twoLevel ? -3 : -2).join('.');
}
