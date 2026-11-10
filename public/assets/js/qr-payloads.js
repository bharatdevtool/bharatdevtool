// qr-payloads.js — build and read the text inside QR codes (links, Wi-Fi, UPI, contacts…).
// Pure functions: no DOM. Shared by the QR generator and the QR scanner pages.

/** @typedef {'url'|'text'|'wifi'|'upi'|'whatsapp'|'vcard'|'email'|'sms'|'phone'|'location'|'event'} QrType */

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Wi-Fi / MECARD escaping: \ ; , : " get a backslash. @param {string} s */
const escWifi = (s) => String(s).replace(/([\\;,:"])/g, '\\$1');
/** vCard/iCal text escaping. @param {string} s */
const escCard = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
const trim = (s) => String(s ?? '').trim();
const digits = (s) => String(s ?? '').replace(/[^\d]/g, '');

/** Phone number with country code. 10-digit Indian numbers get +91. @param {string} raw */
export function normalizePhone(raw) {
  const s = trim(raw);
  if (!s) return '';
  const d = digits(s);
  if (s.startsWith('+')) return `+${d}`;
  if (d.length === 10) return `+91${d}`;
  if (d.length === 11 && d.startsWith('0')) return `+91${d.slice(1)}`;
  if (d.length === 12 && d.startsWith('91')) return `+${d}`;
  return d ? `+${d}` : '';
}

/** Add https:// to "example.com" style input; leave other schemes alone. @param {string} raw */
export function normalizeUrl(raw) {
  const s = trim(raw);
  if (!s) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;
  return `https://${s}`;
}

/** UPI ID like name@bank. @param {string} vpa */
export const isValidVpa = (vpa) => /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/.test(trim(vpa));

/** iCal date-time from a datetime-local value ("2026-11-10T18:30"), in local time. */
function icalDate(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(trim(v));
  return m ? `${m[1]}${m[2]}${m[3]}T${m[4]}${m[5]}00` : '';
}

// ── Building ─────────────────────────────────────────────────────────────────

/**
 * Text to put in the QR code, or '' when required fields are missing.
 * @param {QrType} type
 * @param {Record<string, string | boolean>} f
 * @returns {string}
 */
export function buildPayload(type, f) {
  switch (type) {
    case 'url':
      return normalizeUrl(f.url);
    case 'text':
      return String(f.text ?? '');
    case 'wifi': {
      const ssid = String(f.ssid ?? '');
      if (!ssid.trim()) return '';
      const sec = f.security === 'nopass' ? 'nopass' : f.security === 'WEP' ? 'WEP' : 'WPA';
      const pw = sec === 'nopass' ? '' : `P:${escWifi(f.password ?? '')};`;
      return `WIFI:T:${sec};S:${escWifi(ssid)};${pw}${f.hidden ? 'H:true;' : ''};`;
    }
    case 'upi': {
      if (!isValidVpa(String(f.vpa ?? ''))) return '';
      const p = [`pa=${encodeURIComponent(trim(f.vpa))}`];
      if (trim(f.name)) p.push(`pn=${encodeURIComponent(trim(f.name))}`);
      const amount = Number(f.amount);
      if (trim(f.amount) && amount > 0) p.push(`am=${amount.toFixed(2)}`);
      p.push('cu=INR');
      if (trim(f.note)) p.push(`tn=${encodeURIComponent(trim(f.note))}`);
      return `upi://pay?${p.join('&')}`;
    }
    case 'whatsapp': {
      const phone = digits(normalizePhone(String(f.phone ?? '')));
      if (!phone) return '';
      const msg = trim(f.message);
      return `https://wa.me/${phone}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`;
    }
    case 'vcard': {
      const first = trim(f.first), last = trim(f.last);
      if (!first && !last && !trim(f.phone) && !trim(f.email)) return '';
      const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${escCard(last)};${escCard(first)};;;`, `FN:${escCard([first, last].filter(Boolean).join(' ') || trim(f.org))}`];
      if (trim(f.org)) lines.push(`ORG:${escCard(trim(f.org))}`);
      if (trim(f.title)) lines.push(`TITLE:${escCard(trim(f.title))}`);
      if (trim(f.phone)) lines.push(`TEL;TYPE=CELL:${normalizePhone(String(f.phone))}`);
      if (trim(f.email)) lines.push(`EMAIL:${trim(f.email)}`);
      if (trim(f.website)) lines.push(`URL:${normalizeUrl(String(f.website))}`);
      if (trim(f.address)) lines.push(`ADR:;;${escCard(trim(f.address))};;;;`);
      lines.push('END:VCARD');
      return lines.join('\r\n'); // CRLF, as the vCard/iCalendar standards require
    }
    case 'email': {
      const to = trim(f.to);
      if (!to) return '';
      const q = [];
      if (trim(f.subject)) q.push(`subject=${encodeURIComponent(trim(f.subject))}`);
      if (trim(f.body)) q.push(`body=${encodeURIComponent(String(f.body))}`);
      return `mailto:${to}${q.length ? `?${q.join('&')}` : ''}`;
    }
    case 'sms': {
      const phone = normalizePhone(String(f.phone ?? ''));
      if (!phone) return '';
      return `SMSTO:${phone}:${String(f.message ?? '')}`;
    }
    case 'phone': {
      const phone = normalizePhone(String(f.phone ?? ''));
      return phone ? `tel:${phone}` : '';
    }
    case 'location': {
      const q = trim(f.place);
      if (!q) return '';
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
    }
    case 'event': {
      const title = trim(f.title);
      const start = icalDate(String(f.start ?? ''));
      if (!title || !start) return '';
      const end = icalDate(String(f.end ?? ''));
      const lines = ['BEGIN:VEVENT', `SUMMARY:${escCard(title)}`, `DTSTART:${start}`];
      if (end) lines.push(`DTEND:${end}`);
      if (trim(f.location)) lines.push(`LOCATION:${escCard(trim(f.location))}`);
      if (trim(f.description)) lines.push(`DESCRIPTION:${escCard(trim(f.description))}`);
      lines.push('END:VEVENT');
      return lines.join('\r\n'); // CRLF, as the vCard/iCalendar standards require
    }
    default:
      return '';
  }
}

// ── Reading (scanner) ────────────────────────────────────────────────────────

/**
 * @typedef {{ label: string, value: string, secret?: boolean, href?: string }} Field
 * @typedef {{ type: string, title: string, fields: Field[], url?: string, vcard?: string }} Parsed
 */

/** Split "A:1;B:2;;" style records, honouring backslash escapes. @param {string} body */
function splitRecord(body) {
  /** @type {Record<string, string>} */
  const out = {};
  let key = '', val = '', inKey = true;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '\\' && i + 1 < body.length) {
      if (inKey) key += body[++i];
      else val += body[++i];
    } else if (inKey && ch === ':') inKey = false;
    else if (!inKey && ch === ';') {
      if (key) out[key.toUpperCase()] = val;
      key = '';
      val = '';
      inKey = true;
    } else if (inKey) key += ch;
    else val += ch;
  }
  if (key && !inKey) out[key.toUpperCase()] = val;
  return out;
}

const unescCard = (s) => String(s).replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

/** Lines of a vCard/vEvent as [NAME, value] (NAME without parameters). @param {string} text */
function cardLines(text) {
  return text
    .replace(/\r?\n[ \t]/g, '') // unfold
    .split(/\r?\n/)
    .map((l) => {
      const i = l.indexOf(':');
      return i < 0 ? null : [l.slice(0, i).split(';')[0].toUpperCase(), unescCard(l.slice(i + 1))];
    })
    .filter(Boolean);
}

const safeDecode = (s) => {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
};

/** What a scanned QR code contains, in plain words. @param {string} text @returns {Parsed} */
export function parsePayload(text) {
  const t = String(text ?? '');
  const lower = t.toLowerCase();

  if (lower.startsWith('wifi:')) {
    const r = splitRecord(t.slice(5));
    const sec = (r.T || '').toUpperCase();
    return {
      type: 'wifi',
      title: 'Wi-Fi network',
      fields: [
        { label: 'Network name', value: r.S || '' },
        ...(r.P ? [{ label: 'Password', value: r.P, secret: true }] : []),
        { label: 'Security', value: sec === 'NOPASS' || !sec ? 'Open (no password)' : sec },
        ...(r.H === 'true' ? [{ label: 'Hidden network', value: 'Yes' }] : []),
      ],
    };
  }

  if (lower.startsWith('upi://')) {
    const q = new URLSearchParams(t.slice(t.indexOf('?') + 1));
    const am = q.get('am');
    return {
      type: 'upi',
      title: 'UPI payment',
      fields: [
        { label: 'Pays to', value: q.get('pn') || '(no name given)' },
        { label: 'UPI ID', value: q.get('pa') || '' },
        ...(am ? [{ label: 'Amount', value: `₹${am}` }] : [{ label: 'Amount', value: 'You enter it' }]),
        ...(q.get('tn') ? [{ label: 'Note', value: q.get('tn') }] : []),
      ],
    };
  }

  if (lower.startsWith('begin:vcard')) {
    const lines = cardLines(t);
    const get = (k) => lines.filter((l) => l[0] === k).map((l) => l[1]);
    const name = get('FN')[0] || get('N')[0]?.split(';').reverse().join(' ').trim() || '';
    return {
      type: 'vcard',
      title: 'Contact',
      vcard: t,
      fields: [
        ...(name ? [{ label: 'Name', value: name }] : []),
        ...get('ORG').map((v) => ({ label: 'Company', value: v })),
        ...get('TITLE').map((v) => ({ label: 'Job title', value: v })),
        ...get('TEL').map((v) => ({ label: 'Phone', value: v, href: `tel:${v}` })),
        ...get('EMAIL').map((v) => ({ label: 'Email', value: v, href: `mailto:${v}` })),
        ...get('URL').map((v) => ({ label: 'Website', value: v })),
        ...get('ADR').map((v) => ({ label: 'Address', value: v.split(';').filter(Boolean).join(', ') })),
      ],
    };
  }

  if (lower.startsWith('mecard:')) {
    const r = splitRecord(t.slice(7));
    const name = (r.N || '').split(',').reverse().join(' ').trim();
    const vcard = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${name}`, r.TEL ? `TEL:${r.TEL}` : '', r.EMAIL ? `EMAIL:${r.EMAIL}` : '', 'END:VCARD'].filter(Boolean).join('\n');
    return {
      type: 'vcard',
      title: 'Contact',
      vcard,
      fields: [
        ...(name ? [{ label: 'Name', value: name }] : []),
        ...(r.TEL ? [{ label: 'Phone', value: r.TEL, href: `tel:${r.TEL}` }] : []),
        ...(r.EMAIL ? [{ label: 'Email', value: r.EMAIL, href: `mailto:${r.EMAIL}` }] : []),
      ],
    };
  }

  if (lower.startsWith('begin:vevent') || lower.startsWith('begin:vcalendar')) {
    const lines = cardLines(t);
    const get = (k) => lines.find((l) => l[0] === k)?.[1] || '';
    const when = (v) => {
      const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/.exec(v);
      return m ? `${m[3]}-${m[2]}-${m[1]}${m[4] ? ` ${m[4]}:${m[5]}` : ''}` : v;
    };
    return {
      type: 'event',
      title: 'Calendar event',
      fields: [
        { label: 'Event', value: get('SUMMARY') },
        { label: 'Starts', value: when(get('DTSTART')) },
        ...(get('DTEND') ? [{ label: 'Ends', value: when(get('DTEND')) }] : []),
        ...(get('LOCATION') ? [{ label: 'Where', value: get('LOCATION') }] : []),
        ...(get('DESCRIPTION') ? [{ label: 'Details', value: get('DESCRIPTION') }] : []),
      ],
    };
  }

  if (lower.startsWith('mailto:')) {
    const [to, query = ''] = t.slice(7).split('?');
    const q = new URLSearchParams(query);
    return {
      type: 'email',
      title: 'Email',
      url: t,
      fields: [
        { label: 'To', value: safeDecode(to) },
        ...(q.get('subject') ? [{ label: 'Subject', value: q.get('subject') }] : []),
        ...(q.get('body') ? [{ label: 'Message', value: q.get('body') }] : []),
      ],
    };
  }

  if (lower.startsWith('matmsg:')) {
    const r = splitRecord(t.slice(7));
    return { type: 'email', title: 'Email', fields: [{ label: 'To', value: r.TO || '' }, ...(r.SUB ? [{ label: 'Subject', value: r.SUB }] : []), ...(r.BODY ? [{ label: 'Message', value: r.BODY }] : [])] };
  }

  if (lower.startsWith('tel:')) {
    const n = t.slice(4);
    return { type: 'phone', title: 'Phone number', url: `tel:${n}`, fields: [{ label: 'Number', value: n, href: `tel:${n}` }] };
  }

  if (lower.startsWith('smsto:') || lower.startsWith('sms:')) {
    const body = t.slice(t.indexOf(':') + 1);
    const [num, ...rest] = body.split(/[:?]/);
    const msg = rest.join(':').replace(/^body=/i, '');
    return { type: 'sms', title: 'Text message', fields: [{ label: 'To', value: num, href: `sms:${num}` }, ...(msg ? [{ label: 'Message', value: safeDecode(msg) }] : [])] };
  }

  if (lower.startsWith('geo:')) {
    const [lat, lng] = t.slice(4).split(/[,?;]/);
    const href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
    return { type: 'location', title: 'Location', url: href, fields: [{ label: 'Coordinates', value: `${lat}, ${lng}` }] };
  }

  if (/^https?:\/\//i.test(t)) {
    let host = '';
    try {
      host = new URL(t).hostname.toLowerCase();
    } catch {
      /* not a valid URL: treated as a link anyway */
    }
    if (host === 'wa.me' || host === 'api.whatsapp.com') {
      const u = new URL(t);
      const msg = u.searchParams.get('text');
      const phone = u.pathname.replace(/\//g, '') || u.searchParams.get('phone') || '';
      return { type: 'whatsapp', title: 'WhatsApp chat', url: t, fields: [...(phone ? [{ label: 'Chat with', value: `+${phone}` }] : []), ...(msg ? [{ label: 'Message', value: msg }] : [])] };
    }
    return { type: 'url', title: 'Website link', url: t, fields: [] };
  }

  return { type: 'text', title: 'Text', fields: [{ label: 'Text', value: t }] };
}
