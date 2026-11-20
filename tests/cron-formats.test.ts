import { describe, it, expect } from 'vitest';
import { parseCron, validateCron, describeCron, nextRuns, convertCron, readCronHash } from '../public/assets/js/cron-formats.js';

const iso = (ms: number) => new Date(ms).toISOString().replace('.000Z', 'Z');
const runs = (expr: string, format: string, tz = 'UTC', from = '2026-11-21T00:00:00Z', count = 3) =>
  nextRuns(parseCron(expr, format), { tz, count, from: Date.parse(from) }).map(iso);
const describe_ = (expr: string, format: string) => describeCron(parseCron(expr, format));

describe('validation per format', () => {
  it('accepts each dialect in its own shape', () => {
    for (const [expr, format] of [
      ['*/5 * * * *', 'linux'],
      ['@daily', 'linux'],
      ['30 3 * * 1-5', 'github'],
      ['@hourly', 'kubernetes'],
      ['H/15 * * * *', 'jenkins'],
      ['cron(0 9 ? * MON-FRI *)', 'aws'],
      ['0 0 12 ? * WED', 'quartz'],
      ['0 0 12 ? * WED 2027', 'quartz'],
      ['0 */15 * * * *', 'spring'],
      ['0 */5 * * * *', 'azure'],
    ]) expect(validateCron(expr, format), `${format}: ${expr}`).toMatchObject({ ok: true });
  });

  it('explains the common mistakes', () => {
    expect(validateCron('0 9 * * MON-FRI *', 'aws').error).toMatch(/"\?" in exactly one/);
    expect(validateCron('0 9 * * *', 'aws').error).toMatch(/needs 6 fields/);
    expect(validateCron('*/5 * * * *', 'spring').error).toMatch(/needs 6 fields/);
    expect(validateCron('@daily', 'github').error).toMatch(/not supported/);
    expect(validateCron('H * * * *', 'linux').error).toMatch(/not a valid minute/);
    expect(validateCron('61 * * * *', 'linux').error).toMatch(/between 0 and 59/);
    expect(validateCron('0 9 ? * *', 'linux').error).toMatch(/only allowed/);
    expect(validateCron('@reboot', 'linux').error).toMatch(/no schedule/);
  });

  it('warns about GitHub Actions running more often than every 5 minutes, and Jenkins H', () => {
    expect(validateCron('* * * * *', 'github').warnings[0]).toMatch(/5 minutes/);
    expect(validateCron('*/5 * * * *', 'github').warnings).toEqual([]);
    expect(validateCron('H/15 * * * *', 'jenkins').warnings[0]).toMatch(/H/);
  });
});

describe('plain English', () => {
  it('describes common schedules', () => {
    expect(describe_('*/5 * * * *', 'linux')).toBe('Every 5 minutes');
    expect(describe_('0 9 * * 1-5', 'linux')).toBe('At 09:00, on weekdays (Monday to Friday)');
    expect(describe_('cron(0 9 ? * MON-FRI *)', 'aws')).toBe('At 09:00, on weekdays (Monday to Friday)');
    expect(describe_('0 0 12 ? * 1', 'quartz')).toBe('At 12:00, on Sunday');
    expect(describe_('0 0 1 * *', 'linux')).toBe('At 00:00, on day 1 of the month');
    expect(describe_('0 */6 * * *', 'linux')).toBe('Every 6 hours at minute 0');
    expect(describe_('0 0 9 ? * 6#3', 'quartz')).toBe('At 09:00, on the 3rd Friday of the month');
    expect(describe_('* * * * *', 'linux')).toBe('Every minute');
  });
});

describe('next runs', () => {
  it('reads the schedule in the chosen time zone (9 AM IST = 03:30 UTC)', () => {
    expect(runs('30 3 * * *', 'linux')).toEqual(['2026-11-21T03:30:00Z', '2026-11-22T03:30:00Z', '2026-11-23T03:30:00Z']);
    expect(runs('0 9 * * *', 'linux', 'Asia/Kolkata')).toEqual(['2026-11-21T03:30:00Z', '2026-11-22T03:30:00Z', '2026-11-23T03:30:00Z']);
  });

  it('follows daylight saving time changes', () => {
    // New York leaves daylight saving time on 1 November 2026.
    expect(runs('0 9 * * *', 'linux', 'America/New_York', '2026-10-31T00:00:00Z')).toEqual(['2026-10-31T13:00:00Z', '2026-11-01T14:00:00Z', '2026-11-02T14:00:00Z']);
  });

  it('handles seconds, weekdays and the L, # and W specials', () => {
    expect(runs('30 0 9 * * *', 'spring', 'UTC', '2026-11-21T00:00:00Z', 1)).toEqual(['2026-11-21T09:00:30Z']);
    expect(runs('0 9 * * 1-5', 'linux', 'UTC', '2026-11-21T00:00:00Z', 2)).toEqual(['2026-11-23T09:00:00Z', '2026-11-24T09:00:00Z']); // 21 Nov is a Saturday
    expect(runs('0 0 12 L * ?', 'quartz', 'UTC', '2026-11-21T00:00:00Z', 2)).toEqual(['2026-11-30T12:00:00Z', '2026-12-31T12:00:00Z']);
    expect(runs('0 0 9 ? * 6#3', 'quartz', 'UTC', '2026-11-21T00:00:00Z', 1)).toEqual(['2026-12-18T09:00:00Z']);
    expect(runs('cron(0 10 ? * 6L *)', 'aws', 'UTC', '2026-11-21T00:00:00Z', 1)).toEqual(['2026-11-27T10:00:00Z']);
    expect(runs('0 0 9 15W * ?', 'quartz', 'UTC', '2026-11-01T00:00:00Z', 1)).toEqual(['2026-11-16T09:00:00Z']); // 15 Nov is a Sunday
  });

  it('treats both restricted day fields as "either" in classic cron', () => {
    expect(runs('0 0 13 * 5', 'linux', 'UTC', '2026-11-01T00:00:00Z', 2)).toEqual(['2026-11-06T00:00:00Z', '2026-11-13T00:00:00Z']);
  });
});

describe('converting between formats', () => {
  it('writes a simple schedule in every format', () => {
    const p = parseCron('0 9 * * 1-5', 'linux');
    expect(convertCron(p, 'github')).toBe('0 9 * * 1-5');
    expect(convertCron(p, 'aws')).toBe('cron(0 9 ? * MON-FRI *)');
    expect(convertCron(p, 'quartz')).toBe('0 0 9 ? * MON-FRI');
    expect(convertCron(p, 'spring')).toBe('0 0 9 * * MON-FRI');
    expect(convertCron(p, 'azure')).toBe('0 0 9 * * 1-5');
    expect(convertCron(parseCron('0 30 9 ? * MON', 'quartz'), 'linux')).toBe('30 9 * * 1');
    expect(convertCron(parseCron('cron(15 10 * * ? *)', 'aws'), 'kubernetes')).toBe('15 10 * * *');
  });

  it('returns null when the schedule cannot be written in the target format', () => {
    expect(convertCron(parseCron('30 0 9 * * *', 'spring'), 'linux')).toBeNull();
    expect(convertCron(parseCron('0 0 12 L * ?', 'quartz'), 'linux')).toBeNull();
    expect(convertCron(parseCron('0 0 13 * 5', 'linux'), 'aws')).toBeNull();
  });
});

describe('URL preset', () => {
  it('reads #expr=…&format=… strictly', () => {
    expect(readCronHash('#format=aws&expr=' + encodeURIComponent('cron(0 9 ? * MON-FRI *)'))).toEqual({ format: 'aws', expr: 'cron(0 9 ? * MON-FRI *)' });
    expect(readCronHash('#format=nope&expr=*')).toBeNull();
    expect(readCronHash('#format=linux&expr=' + encodeURIComponent('<script>'))).toBeNull();
    expect(readCronHash('')).toBeNull();
  });
});
