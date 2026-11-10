import { describe, it, expect } from 'vitest';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { buildPayload, parsePayload, normalizePhone, normalizeUrl, isValidVpa } from '../public/assets/js/qr-payloads.js';
import { checkLink, mainDomain } from '../public/assets/js/qr-link-check.js';
import { renderQrSvg, logoArea, contrastRatio, brightness, PRESETS } from '../public/assets/js/qr-render.js';

/** Real QR matrix for text (same model the browser page uses). */
function matrix(text: string, ecl: 'L' | 'M' | 'Q' | 'H' = 'M') {
  const qr = QRCode.create(text, { errorCorrectionLevel: ecl });
  const size = qr.modules.size;
  return { size, isDark: (r: number, c: number) => Boolean(qr.modules.get(r, c)) };
}

/** Rasterise a matrix (4 px per module, 4-module quiet zone) and decode it with jsQR. */
function decode(m: { size: number; isDark: (r: number, c: number) => boolean }, skip?: (r: number, c: number) => boolean) {
  const scale = 4, q = 4, W = (m.size + 2 * q) * scale;
  const data = new Uint8ClampedArray(W * W * 4).fill(255);
  for (let r = 0; r < m.size; r++) for (let c = 0; c < m.size; c++) {
    if (!m.isDark(r, c) || skip?.(r, c)) continue;
    for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) {
      const o = (((r + q) * scale + y) * W + (c + q) * scale + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = 0;
    }
  }
  return jsQR(data, W, W)?.data ?? null;
}

describe('QR payloads', () => {
  it('normalises phones, links and UPI IDs', () => {
    expect(normalizePhone('98765 43210')).toBe('+919876543210');
    expect(normalizePhone('09876543210')).toBe('+919876543210');
    expect(normalizePhone('+1 (415) 555-0100')).toBe('+14155550100');
    expect(normalizeUrl('example.com/a')).toBe('https://example.com/a');
    expect(normalizeUrl('mailto:a@b.c')).toBe('mailto:a@b.c');
    expect(isValidVpa('rahul.kumar@okhdfcbank')).toBe(true);
    expect(isValidVpa('rahul@')).toBe(false);
  });

  it('builds the standard formats', () => {
    expect(buildPayload('wifi', { ssid: 'Home;5G', password: 'p@ss:"1"', security: 'WPA' })).toBe('WIFI:T:WPA;S:Home\\;5G;P:p@ss\\:\\"1\\";;');
    expect(buildPayload('wifi', { ssid: 'Cafe', security: 'nopass', hidden: true })).toBe('WIFI:T:nopass;S:Cafe;H:true;;');
    expect(buildPayload('upi', { vpa: 'shop@okaxis', name: 'Sharma Store', amount: '250', note: 'Bill 12' })).toBe('upi://pay?pa=shop%40okaxis&pn=Sharma%20Store&am=250.00&cu=INR&tn=Bill%2012');
    expect(buildPayload('upi', { vpa: 'not-a-vpa' })).toBe('');
    expect(buildPayload('whatsapp', { phone: '9876543210', message: 'Hi there' })).toBe('https://wa.me/919876543210?text=Hi%20there');
    expect(buildPayload('email', { to: 'a@b.com', subject: 'Hello & bye' })).toBe('mailto:a@b.com?subject=Hello%20%26%20bye');
    expect(buildPayload('sms', { phone: '9876543210', message: 'OK' })).toBe('SMSTO:+919876543210:OK');
    expect(buildPayload('phone', { phone: '9876543210' })).toBe('tel:+919876543210');
    expect(buildPayload('location', { place: 'India Gate, Delhi' })).toBe('https://www.google.com/maps/search/?api=1&query=India%20Gate%2C%20Delhi');
    expect(buildPayload('event', { title: 'Demo; day', start: '2026-12-01T10:00', end: '2026-12-01T11:30' })).toBe('BEGIN:VEVENT\r\nSUMMARY:Demo\\; day\r\nDTSTART:20261201T100000\r\nDTEND:20261201T113000\r\nEND:VEVENT');
    expect(buildPayload('url', { url: '' })).toBe('');
  });

  it('round-trips every type through a real QR code and reads it back in plain words', () => {
    const cases: [Parameters<typeof buildPayload>[0], Record<string, string | boolean>, string, [string, string][]][] = [
      ['wifi', { ssid: 'Home;5G', password: 'se,cr:et', security: 'WPA' }, 'wifi', [['Network name', 'Home;5G'], ['Password', 'se,cr:et']]],
      ['upi', { vpa: 'shop@okaxis', name: 'Sharma Store', amount: '99.5' }, 'upi', [['Pays to', 'Sharma Store'], ['UPI ID', 'shop@okaxis'], ['Amount', '₹99.50']]],
      ['vcard', { first: 'Asha', last: 'Rao', phone: '9876543210', email: 'asha@example.com', org: 'Rao, Sons & Co' }, 'vcard', [['Name', 'Asha Rao'], ['Company', 'Rao, Sons & Co'], ['Phone', '+919876543210']]],
      ['whatsapp', { phone: '9876543210', message: 'नमस्ते' }, 'whatsapp', [['Chat with', '+919876543210'], ['Message', 'नमस्ते']]],
      ['email', { to: 'a@b.com', subject: 'Hi' }, 'email', [['To', 'a@b.com'], ['Subject', 'Hi']]],
      ['sms', { phone: '9876543210', message: 'Call me' }, 'sms', [['To', '+919876543210'], ['Message', 'Call me']]],
      ['phone', { phone: '9876543210' }, 'phone', [['Number', '+919876543210']]],
      ['event', { title: 'Launch', start: '2026-12-01T10:00' }, 'event', [['Event', 'Launch'], ['Starts', '01-12-2026 10:00']]],
      ['text', { text: 'Hello दुनिया' }, 'text', [['Text', 'Hello दुनिया']]],
    ];
    for (const [type, fields, parsedType, expected] of cases) {
      const payload = buildPayload(type, fields);
      const scanned = decode(matrix(payload));
      expect(scanned, type).toBe(payload);
      const parsed = parsePayload(scanned!);
      expect(parsed.type, type).toBe(parsedType);
      for (const [label, value] of expected) expect(parsed.fields.find((x) => x.label === label)?.value, `${type}/${label}`).toBe(value);
    }
  });

  it('writes vCards with CRLF line endings, as phones expect', () => {
    const card = buildPayload('vcard', { first: 'Asha', last: 'Rao', phone: '9876543210' });
    expect(card.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n')).toBe(true);
    expect(card.split('\r\n').every((l) => !l.includes('\n'))).toBe(true);
  });

  it('reads links, MECARDs and geo codes', () => {
    expect(parsePayload('https://example.com').type).toBe('url');
    expect(parsePayload('MECARD:N:Rao,Asha;TEL:+911234;;').fields[0]).toEqual({ label: 'Name', value: 'Asha Rao' });
    expect(parsePayload('geo:28.61,77.23').url).toContain('28.61%2C77.23');
    expect(parsePayload('WIFI:S:Cafe;T:nopass;;').fields.find((x) => x.label === 'Security')?.value).toBe('Open (no password)');
  });
});

describe('link safety', () => {
  const levels = (u: string) => checkLink(u).warnings.map((w) => w.level);
  it('passes an ordinary https link', () => {
    expect(checkLink('https://www.irctc.co.in/nget/train-search')).toMatchObject({ valid: true, secure: true, warnings: [] });
  });
  it('flags common QR-scam tricks', () => {
    expect(levels('https://google.com@evil.example/')).toContain('danger');
    expect(levels('https://xn--pypal-4ve.com/')).toContain('danger');
    expect(levels('https://files.example.com/update.apk')).toContain('danger');
    expect(levels('http://192.168.1.10/login')).toEqual(['warn', 'warn']);
    expect(levels('https://bit.ly/3abc')).toEqual(['warn']);
    expect(levels('https://example.com/kyc-update')).toEqual(['warn']);
    expect(checkLink('javascript:alert(1)').valid).toBe(false);
    expect(checkLink('not a url').valid).toBe(false);
  });
  it('shows the real site name', () => {
    expect(mainDomain('login.sbi.co.in')).toBe('sbi.co.in');
    expect(mainDomain('secure.paytm-help.example.com')).toBe('example.com');
    expect(mainDomain('example.com')).toBe('example.com');
  });
});

describe('QR rendering', () => {
  const m = matrix('https://bharatdevtool.com/qr-generator-free.html', 'H');

  it('draws every style as valid SVG with the eyes drawn separately', () => {
    for (const [name, preset] of Object.entries(PRESETS)) {
      const { svg, width, height } = renderQrSvg(m, preset);
      expect(svg, name).toMatch(/^<svg [^>]*viewBox="0 0 \d+(\.\d+)? \d+(\.\d+)?"/);
      expect(width, name).toBe(m.size + 8);
      expect(height, name).toBe(m.size + 8);
      expect(svg, name).toContain('fill-rule="evenodd"');
      if (preset.gradient !== 'none') expect(svg, name).toMatch(/url\(#qrFill\d+\)/);
    }
  });

  it('gives each SVG its own gradient id, so several on one page don\'t clash', () => {
    const a = renderQrSvg(m, PRESETS.ocean).svg.match(/id="(qrFill\d+)"/)![1];
    const b = renderQrSvg(m, PRESETS.ocean).svg.match(/id="(qrFill\d+)"/)![1];
    expect(a).not.toBe(b);
  });

  it('clears a small centre hole for the logo, which a high error-correction code survives', () => {
    const { svg, cleared } = renderQrSvg(m, { logo: 'data:image/png;base64,AAAA', logoSize: 0.22 });
    expect(svg).toContain('<image href="data:image/png;base64,AAAA"');
    expect(cleared).toBeGreaterThan(0);
    const hole = logoArea(m.size, { logo: 'x', logoSize: 0.22 } as never)!;
    expect(hole.size % 2).toBe(1);
    const inHole = (r: number, c: number) => r >= hole.start && r < hole.start + hole.size && c >= hole.start && c < hole.start + hole.size;
    expect(decode(m, inHole)).toBe('https://bharatdevtool.com/qr-generator-free.html');
  });

  it('adds a frame with the label, escaped', () => {
    const { svg, height, width } = renderQrSvg(m, { frame: 'card', frameText: 'SCAN <ME> & PAY' });
    expect(height).toBeGreaterThan(width);
    expect(svg).toContain('SCAN &lt;ME&gt; &amp; PAY');
  });

  it('measures contrast and brightness', () => {
    expect(Math.round(contrastRatio('#000000', '#ffffff'))).toBe(21);
    expect(contrastRatio('#777777', '#888888')).toBeLessThan(1.5);
    expect(brightness('#ffffff')).toBe(1);
    expect(brightness('#000000')).toBe(0);
  });
});
