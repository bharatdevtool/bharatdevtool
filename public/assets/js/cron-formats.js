// cron-formats.js — one parser for the cron dialects developers mix up:
// Linux crontab, GitHub Actions, Kubernetes, Jenkins (H), AWS EventBridge (? and year),
// Spring @Scheduled and Quartz (seconds first), Azure Functions NCRONTAB.
// Validation, plain-English descriptions, next runs in any time zone, and conversion
// of simple schedules between formats. Pure functions (Intl for time zones), no DOM.

export const FORMATS = {
  linux: { label: 'Linux crontab', seconds: false, year: 'no', dow: 'posix', question: false, macros: true, zone: 'UTC' },
  github: { label: 'GitHub Actions', seconds: false, year: 'no', dow: 'posix', question: false, macros: false, zone: 'UTC' },
  kubernetes: { label: 'Kubernetes CronJob', seconds: false, year: 'no', dow: 'posix', question: false, macros: true, zone: 'UTC' },
  jenkins: { label: 'Jenkins', seconds: false, year: 'no', dow: 'posix', question: false, macros: true, hash: true, zone: 'UTC' },
  aws: { label: 'AWS EventBridge', seconds: false, year: 'required', dow: 'quartz', question: 'required', zone: 'UTC' },
  spring: { label: 'Spring @Scheduled', seconds: true, year: 'no', dow: 'posix', question: true, special: true, zone: 'UTC' },
  quartz: { label: 'Quartz', seconds: true, year: 'optional', dow: 'quartz', question: 'required', special: true, zone: 'UTC' },
  azure: { label: 'Azure Functions (NCRONTAB)', seconds: true, year: 'no', dow: 'posix', question: false, zone: 'UTC' },
};
FORMATS.aws.special = true;

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MACROS = { '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *', '@weekly': '0 0 * * 0', '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@hourly': '0 * * * *' };

class CronError extends Error {}
const fail = (msg) => { throw new CronError(msg); };
const range = (a, b, step = 1) => { const out = []; for (let v = a; v <= b; v += step) out.push(v); return out; };

/**
 * Parse one field into { any, values: number[], specials: [] }.
 * kind: sec | min | hour | dom | mon | dow | year
 */
function parseField(text, kind, fmt, warnings) {
  const lim = { sec: [0, 59], min: [0, 59], hour: [0, 23], dom: [1, 31], mon: [1, 12], dow: fmt.dow === 'quartz' ? [1, 7] : [0, 7], year: [1970, 2199] }[kind];
  const names = kind === 'mon' ? MONTHS : kind === 'dow' ? DAYS : null;
  const label = { sec: 'seconds', min: 'minute', hour: 'hour', dom: 'day-of-month', mon: 'month', dow: 'day-of-week', year: 'year' }[kind];
  const num = (s) => {
    const up = s.toUpperCase();
    if (names && names.includes(up)) return kind === 'mon' ? names.indexOf(up) + 1 : names.indexOf(up) + (fmt.dow === 'quartz' ? 1 : 0);
    if (!/^\d+$/.test(s)) fail(`"${s}" is not a valid ${label} value`);
    const v = Number(s);
    if (v < lim[0] || v > lim[1]) fail(`${label} must be between ${lim[0]} and ${lim[1]} (got ${v})`);
    return v;
  };
  const out = { any: false, values: new Set(), specials: [] };
  if (text === '?') {
    if (!fmt.question || (kind !== 'dom' && kind !== 'dow')) fail(`"?" is only allowed in the day fields of AWS, Quartz and Spring`);
    out.any = true;
    out.question = true;
    return out;
  }
  for (const raw of text.split(',')) {
    let tok = raw;
    if (!tok) fail(`Empty value in the ${label} field`);
    if (/H/.test(tok) && fmt.hash) {
      // Jenkins picks a fixed value from a hash of the job name; previews assume the start of the range.
      const m = tok.match(/^H(?:\((\d+)-(\d+)\))?(?:\/(\d+))?$/);
      if (!m) fail(`"${tok}" is not a valid H expression`);
      const a = m[1] ? num(m[1]) : lim[0];
      const b = m[2] ? num(m[2]) : kind === 'dom' ? 28 : lim[1];
      const step = m[3] ? Number(m[3]) : 0;
      range(a, b, step || b - a + 1).forEach((v) => out.values.add(v));
      if (!warnings.includes('H')) warnings.push('H');
      continue;
    }
    if (fmt.special && kind === 'dom' && /^(L|LW|L-\d+|\d+W)$/i.test(tok)) { out.specials.push(tok.toUpperCase()); continue; }
    if (fmt.special && kind === 'dow' && /^([0-7]|[A-Z]{3})?L$|^([0-7]|[A-Z]{3})#[1-5]$/i.test(tok)) {
      const up = tok.toUpperCase();
      const day = up.replace(/[L#].*$/, '');
      const d = day === '' ? (fmt.dow === 'quartz' ? 7 : 6) : num(day);
      out.specials.push(up.includes('#') ? { nth: Number(up.split('#')[1]), day: toPosixDay(d, fmt) } : { last: toPosixDay(d, fmt) });
      continue;
    }
    let step = 1;
    if (tok.includes('/')) {
      const [base, s] = tok.split('/');
      if (!/^\d+$/.test(s) || Number(s) < 1) fail(`Step "/${s}" in the ${label} field must be a positive number`);
      step = Number(s);
      tok = base;
      if (tok !== '*' && !tok.includes('-')) tok = `${tok}-${kind === 'dow' && fmt.dow !== 'quartz' ? 6 : lim[1]}`;
    }
    if (tok === '*') { if (step === 1) out.any = true; range(lim[0], lim[1], step).forEach((v) => out.values.add(v)); continue; }
    if (tok.includes('-')) {
      const [a, b] = tok.split('-').map(num);
      if (a > b) fail(`Range ${tok} in the ${label} field goes backwards`);
      range(a, b, step).forEach((v) => out.values.add(v));
    } else out.values.add(num(tok));
  }
  return out;
}

function toPosixDay(d, fmt) {
  return fmt.dow === 'quartz' ? d - 1 : d % 7;
}

/** Parse an expression in a format. Returns { fields, texts, warnings, format } or throws CronError. */
export function parseCron(input, format) {
  const fmt = FORMATS[format];
  if (!fmt) fail(`Unknown cron format "${format}"`);
  let expr = String(input || '').trim().replace(/\s+/g, ' ');
  if (format === 'aws') expr = expr.replace(/^cron\((.*)\)$/i, '$1').trim();
  if (!expr) fail('Enter a cron expression');
  if (expr.startsWith('@')) {
    const key = expr.toLowerCase();
    if (key === '@reboot') fail('@reboot runs once when the machine starts, so it has no schedule to preview');
    if (!fmt.macros || !MACROS[key]) fail(`${expr} is not supported in ${fmt.label}`);
    expr = MACROS[key];
  }
  const parts = expr.split(' ');
  const names = [];
  if (fmt.seconds) names.push('sec');
  names.push('min', 'hour', 'dom', 'mon', 'dow');
  if (fmt.year === 'required' || (fmt.year === 'optional' && parts.length === names.length + 1)) names.push('year');
  if (parts.length !== names.length) {
    const want = fmt.year === 'optional' ? `${names.length} or ${names.length + 1}` : `${names.length}`;
    fail(`${fmt.label} needs ${want} fields (${names.join(' ')}), but this has ${parts.length}`);
  }
  const warnings = [];
  const fields = {};
  const texts = {};
  names.forEach((n, i) => { texts[n] = parts[i]; fields[n] = parseField(parts[i], n, fmt, warnings); });
  if (!fmt.seconds) fields.sec = { any: false, values: new Set([0]), specials: [] };
  if (fmt.question === 'required') {
    const q = (fields.dom.question ? 1 : 0) + (fields.dow.question ? 1 : 0);
    if (q !== 1) fail(`${fmt.label} needs "?" in exactly one of the day-of-month and day-of-week fields`);
  }
  // Normalise day-of-week to 0 (Sunday) … 6.
  fields.dow.values = new Set([...fields.dow.values].map((d) => toPosixDay(d, fmt)));
  if (format === 'github') {
    const mins = [...fields.min.values].sort((a, b) => a - b);
    const gaps = mins.map((m, i) => (i ? m - mins[i - 1] : m + 60 - mins[mins.length - 1]));
    if (mins.length > 1 && Math.min(...gaps) < 5) warnings.push('github-interval');
  }
  return { format, fields, texts, warnings };
}

/** Validate without throwing: { ok, error?, warnings }. */
export function validateCron(input, format) {
  try {
    const p = parseCron(input, format);
    return { ok: true, warnings: p.warnings.map(warningText), parsed: p };
  } catch (e) {
    if (e instanceof CronError) return { ok: false, error: e.message, warnings: [] };
    throw e;
  }
}

function warningText(w) {
  if (w === 'H') return 'Jenkins replaces H with a fixed value based on the job name; the times below assume the start of the range.';
  if (w === 'github-interval') return 'GitHub Actions runs scheduled workflows at most once every 5 minutes, and runs can start late when GitHub is busy.';
  return w;
}

// ─── Matching and next runs ───────────────────────────────────────────────────

const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const weekday = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();

function domMatches(f, y, m, d) {
  if (f.any || f.values.has(d)) return true;
  const last = daysIn(y, m);
  return f.specials.some((s) => {
    if (s === 'L') return d === last;
    if (s.startsWith('L-')) return d === last - Number(s.slice(2));
    if (s === 'LW') { let t = last; while (weekday(y, m, t) % 6 === 0) t--; return d === t; }
    if (s.endsWith('W')) {
      let t = Math.min(Number(s.slice(0, -1)), last);
      const wd = weekday(y, m, t);
      if (wd === 6) t = t === 1 ? 3 : t - 1;
      else if (wd === 0) t = t === last ? t - 2 : t + 1;
      return d === t;
    }
    return false;
  });
}

function dowMatches(f, y, m, d) {
  const wd = weekday(y, m, d);
  if (f.any || f.values.has(wd)) return true;
  return f.specials.some((s) => (s.nth ? s.day === wd && Math.ceil(d / 7) === s.nth : s.last === wd && d + 7 > daysIn(y, m)));
}

function dayMatches(p, y, m, d) {
  const { dom, dow } = p.fields;
  const restricted = (f) => !f.any;
  // Classic cron: when both day fields are restricted, either may match. Quartz-style formats use "?".
  if (FORMATS[p.format].dow === 'posix' && p.format !== 'spring' && restricted(dom) && restricted(dow)) return domMatches(dom, y, m, d) || dowMatches(dow, y, m, d);
  return domMatches(dom, y, m, d) && dowMatches(dow, y, m, d);
}

const parts = new Map();
function zoneParts(tz) {
  if (!parts.has(tz)) parts.set(tz, new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }));
  return parts.get(tz);
}

/** Wall-clock fields of an instant in a time zone. */
export function wallClock(ms, tz) {
  const o = {};
  for (const p of zoneParts(tz).formatToParts(new Date(ms))) if (p.type !== 'literal') o[p.type] = Number(p.value);
  return { y: o.year, m: o.month, d: o.day, h: o.hour % 24, mi: o.minute, s: o.second };
}

/** Instant for a wall-clock time in a time zone. */
export function fromWallClock(y, m, d, h, mi, s, tz) {
  const guess = Date.UTC(y, m - 1, d, h, mi, s);
  const offset = (t) => { const w = wallClock(t, tz); return Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) - t; };
  let t = guess - offset(guess);
  const o2 = offset(t);
  if (guess - o2 !== t) t = guess - o2;
  return t;
}

/** Next `count` run times (ms) after `from`, with the schedule read in time zone `tz`. */
export function nextRuns(parsed, { tz = 'UTC', count = 5, from = Date.now() } = {}) {
  const p = parsed;
  const f = p.fields;
  const sorted = (s) => [...s.values].sort((a, b) => a - b);
  const secs = sorted(f.sec);
  const mins = sorted(f.min);
  const hours = sorted(f.hour);
  const start = wallClock(from + 1000, tz);
  const out = [];
  let y = start.y, m = start.m, d = start.d;
  for (let day = 0; day < 366 * 8 && out.length < count; day++) {
    const first = day === 0;
    const yearOk = !f.year || f.year.any || f.year.values.has(y);
    if (yearOk && f.mon.values.has(m) && dayMatches(p, y, m, d)) {
      for (const h of hours) {
        if (first && h < start.h) continue;
        for (const mi of mins) {
          if (first && h === start.h && mi < start.mi) continue;
          for (const s of secs) {
            if (first && h === start.h && mi === start.mi && s < start.s) continue;
            const t = fromWallClock(y, m, d, h, mi, s, tz);
            if (t > from) out.push(t);
            if (out.length >= count) return out;
          }
        }
      }
    }
    d++;
    if (d > daysIn(y, m)) { d = 1; m++; if (m > 12) { m = 1; y++; } }
  }
  return out;
}

// ─── Plain English ────────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0');
const list = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const ordinal = (n) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

function stepOf(text) {
  const m = /^(?:\*|0)\/(\d+)$/.exec(text || '');
  return m ? Number(m[1]) : 0;
}

/** Plain-English description of a parsed expression. */
export function describeCron(p) {
  const { fields: f, texts: t } = p;
  const vals = (k) => [...f[k].values].sort((a, b) => a - b);
  const secs = vals('sec');
  let time;
  if (f.min.any && f.hour.any) time = secs.length === 1 && secs[0] === 0 ? 'Every minute' : `Every ${stepOf(t.sec) ? stepOf(t.sec) + ' seconds' : 'second'}`;
  else if (stepOf(t.min) && f.hour.any) time = `Every ${stepOf(t.min)} minutes`;
  else if (f.hour.any && vals('min').length === 1) time = `At minute ${vals('min')[0]} of every hour`;
  else if (stepOf(t.hour) && vals('min').length === 1) time = `Every ${stepOf(t.hour)} hours at minute ${vals('min')[0]}`;
  else if (vals('min').length * vals('hour').length <= 4) {
    const sec = secs.length === 1 && secs[0] ? `:${pad(secs[0])}` : '';
    time = `At ${list(vals('hour').flatMap((h) => vals('min').map((mi) => `${pad(h)}:${pad(mi)}${sec}`)))}`;
  } else time = `At minute ${list(vals('min').map(String))} past hour ${list(vals('hour').map(String))}`;

  const parts = [time];
  const dowV = vals('dow');
  const dayText = [];
  if (!f.dow.any) {
    if (dowV.join() === '1,2,3,4,5') dayText.push('on weekdays (Monday to Friday)');
    else if (dowV.join() === '0,6') dayText.push('on weekends');
    else if (dowV.length) dayText.push(`on ${list(dowV.map((d) => DAY_NAMES[d]))}`);
    for (const s of f.dow.specials) dayText.push(s.nth ? `on the ${ordinal(s.nth)} ${DAY_NAMES[s.day]} of the month` : `on the last ${DAY_NAMES[s.last]} of the month`);
  }
  if (!f.dom.any) {
    const dv = vals('dom');
    if (dv.length) dayText.push(`on day ${list(dv.map(String))} of the month`);
    for (const s of f.dom.specials) dayText.push(s === 'L' ? 'on the last day of the month' : s === 'LW' ? 'on the last weekday of the month' : s.startsWith('L-') ? `${s.slice(2)} days before the end of the month` : `on the weekday nearest day ${s.slice(0, -1)}`);
  }
  if (dayText.length) parts.push(dayText.join(' or '));
  if (!f.mon.any && f.mon.values.size < 12) parts.push(`in ${list(vals('mon').map((m) => MONTH_NAMES[m - 1]))}`);
  if (f.year && !f.year.any) parts.push(`in ${list(vals('year').map(String))}`);
  return parts.join(', ');
}

// ─── Converting simple schedules between formats ─────────────────────────────

/** Day-of-week text with numbers turned into SUN…SAT (safe in every format that takes names). */
function dowToNames(text, fmt) {
  return text.replace(/(^|[,\-])(\d)(?=$|[,\-/])/g, (_, sep, n) => sep + DAYS[toPosixDay(Number(n), fmt)]);
}
function namesToPosix(text) {
  return text.replace(/\b(SUN|MON|TUE|WED|THU|FRI|SAT)\b/gi, (n) => String(DAYS.indexOf(n.toUpperCase())));
}

/**
 * The same schedule written in another format, or null when it can't be expressed there
 * (seconds in a minute-based format, L/W/#/H specials, both day fields restricted for AWS/Quartz).
 */
export function convertCron(parsed, target) {
  const src = FORMATS[parsed.format];
  const fmt = FORMATS[target];
  const t = parsed.texts;
  if (!fmt) return null;
  if (Object.values(t).some((x) => /[LW#H]/i.test(x.replace(/\b(SUN|MON|TUE|WED|THU|FRI|SAT|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b/gi, '')))) return null;
  const sec = src.seconds ? t.sec : '0';
  if (!fmt.seconds && sec !== '0') return null;
  if (t.year && t.year !== '*' && fmt.year === 'no') return null;
  let dom = t.dom === '?' ? '*' : t.dom;
  let dow = t.dow === '?' ? '*' : dowToNames(t.dow, src);
  if (fmt.question === 'required') {
    if (dom !== '*' && dow !== '*') return null;
    if (dow !== '*') dom = '?';
    else dow = '?';
  }
  if (fmt.dow === 'posix' && target !== 'spring') dow = namesToPosix(dow);
  const core = [t.min, t.hour, dom, t.mon, dow];
  if (fmt.seconds) core.unshift(sec);
  if (target === 'aws') return `cron(${[...core, t.year || '*'].join(' ')})`;
  if (target === 'quartz' && t.year && t.year !== '*') core.push(t.year);
  return core.join(' ');
}

/** Read a "#expr=…&format=…" hash strictly (only known formats, only cron characters). */
export function readCronHash(hash) {
  const q = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  const format = q.get('format');
  const expr = q.get('expr');
  if (!format || !FORMATS[format] || !expr) return null;
  if (expr.length > 120 || !/^[0-9A-Za-z*?,/\-#() @]+$/.test(expr)) return null;
  return { format, expr };
}
