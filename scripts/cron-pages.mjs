// Cron landing pages: one checker, a page per platform format and per common schedule.
//
// public/cron-generator.html is the TEMPLATE: its <!-- cron:… --> regions are filled per page and
// the formats panel is preset through <script id="cronPage">. Expressions for every format are
// computed with public/assets/js/cron-formats.js, so the tables can't drift from the checker.
// Edit the template or this file, then run:  pnpm gen:pages
// tests/cron-pages.test.ts fails if a generated page is out of date.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { esc, jsonBlock, region, addSitemapUrls } from './page-regions.mjs';
import { FORMATS, parseCron, convertCron, describeCron } from '../public/assets/js/cron-formats.js';

export const SITE = 'https://bharatdevtool.com';
export const MAIN_SLUG = 'cron-generator';
const BRAND = 'Bharat Dev Tools';
const OG_IMAGE = `${SITE}/og/cron-generator.png`;
const ORDER = ['linux', 'github', 'kubernetes', 'jenkins', 'aws', 'spring', 'quartz', 'azure'];

// ── Platform pages ──────────────────────────────────────────────────────────
const FORMAT_PAGES = [
  {
    slug: 'aws-cron-expression',
    format: 'aws',
    expr: 'cron(0 9 ? * MON-FRI *)',
    title: 'AWS Cron Expression Generator & Checker',
    description: 'Check AWS EventBridge cron expressions: 6 fields with year, the ? rule, L, W and #. See the next runs in UTC and IST and the plain-English meaning. Free.',
    h1: 'AWS EventBridge Cron Expression Checker',
    lead: 'Paste an EventBridge or CloudWatch Events schedule such as cron(0 9 ? * MON-FRI *) and see exactly when it runs.',
    rules: [
      'Six fields: minutes, hours, day-of-month, month, day-of-week, year, wrapped as cron( ).',
      'Use ? in either day-of-month or day-of-week: AWS rejects a value or * in both.',
      'Day-of-week runs 1 to 7 with 1 = Sunday, or SUN to SAT.',
      'EventBridge rules run in UTC; EventBridge Scheduler can use a time zone.',
      'L (last), W (nearest weekday) and # (nth weekday) are supported.',
    ],
    faqs: [
      ['Why does my AWS cron expression say it is invalid?', 'The most common cause is the ? rule: EventBridge needs ? in either the day-of-month or the day-of-week field. cron(0 9 * * MON-FRI *) fails, cron(0 9 ? * MON-FRI *) works. AWS also needs all six fields, including the year.'],
      ['What time zone do AWS cron expressions use?', 'EventBridge rules always use UTC, so 9 AM IST is cron(30 3 * * ? *). EventBridge Scheduler lets you pick a time zone such as Asia/Kolkata. Switch the checker to IST to see local times.'],
      ['How do I run something on the last day of the month on AWS?', 'Use L in the day-of-month field, for example cron(0 18 L * ? *) runs at 18:00 UTC on the last day of every month.'],
      ['How do I write every 5 minutes for AWS?', 'Use cron(0/5 * * * ? *) or the simpler rate(5 minutes) expression.'],
    ],
  },
  {
    slug: 'spring-cron-expression',
    format: 'spring',
    expr: '0 0 9 * * MON-FRI',
    title: 'Spring @Scheduled Cron Expression Checker',
    description: 'Check Spring @Scheduled cron expressions: 6 fields with seconds first, MON-FRI names, L, W and #. See the next runs in IST and UTC and what it means.',
    h1: 'Spring @Scheduled Cron Expression Checker',
    lead: 'Paste the cron from @Scheduled(cron = "…") and see when Spring will run it.',
    rules: [
      'Six fields: second, minute, hour, day-of-month, month, day-of-week.',
      'The first field is seconds: 0 0 9 * * * is 9 AM, not 9 minutes.',
      'Day-of-week is 0 to 7 (0 and 7 are Sunday) or SUN to SAT.',
      'L, W and # work, and ? can be used in a day field.',
      'Runs in the JVM time zone unless you set zone = "Asia/Kolkata".',
    ],
    faqs: [
      ['Why does my Spring cron run every minute instead of every hour?', 'Spring cron starts with a seconds field. 0 * * * * * runs every minute (at second 0); every hour is 0 0 * * * *. Count six fields from the left: second, minute, hour.'],
      ['How do I convert a Linux cron to Spring?', 'Add a seconds field in front. The Linux cron 0 9 * * 1-5 becomes 0 0 9 * * MON-FRI in Spring. The checker shows the same schedule in every format.'],
      ['How do I set the time zone of a @Scheduled job?', 'Use @Scheduled(cron = "0 0 9 * * *", zone = "Asia/Kolkata"). Without zone the server time zone is used, which is often UTC in the cloud.'],
      ['Is Spring cron the same as Quartz cron?', 'Almost: both start with seconds, but Quartz counts day-of-week from 1 = Sunday and needs ? in one of the day fields, while Spring uses 0 = Sunday and does not need ?.'],
    ],
  },
  {
    slug: 'github-actions-cron',
    format: 'github',
    expr: '30 3 * * 1-5',
    title: 'GitHub Actions Cron Schedule Checker',
    description: 'Check GitHub Actions schedule cron in UTC: see when your workflow really runs in IST, why runs start late, and the 5-minute minimum interval. Free and instant.',
    h1: 'GitHub Actions Cron Schedule Checker',
    lead: 'Paste the cron from on: schedule: in your workflow and see the next runs in UTC and IST.',
    rules: [
      'Five fields: minute, hour, day-of-month, month, day-of-week.',
      'Schedules always run in UTC: 9 AM IST is 30 3 * * *.',
      'The shortest interval is every 5 minutes.',
      'Runs can start late when GitHub is busy, especially at the top of the hour.',
      'Scheduled workflows run on the default branch.',
    ],
    faqs: [
      ['Why does my GitHub Actions cron run at the wrong time?', 'GitHub reads the schedule in UTC. 0 9 * * * runs at 9 AM UTC, which is 2:30 PM IST. For 9 AM IST use 30 3 * * *.'],
      ['Why does my scheduled workflow start late or skip?', 'Scheduled runs are queued and can be delayed during busy periods, most often at the start of an hour. Pick an unusual minute such as 17 instead of 0 to reduce delays.'],
      ['Can a GitHub Actions schedule run every minute?', 'No. The shortest interval is every 5 minutes (*/5 * * * *). The checker warns when an expression asks for more.'],
      ['Does the schedule run on my feature branch?', 'No. Scheduled workflows run on the latest commit of the default branch only.'],
    ],
  },
  {
    slug: 'kubernetes-cronjob-schedule',
    format: 'kubernetes',
    expr: '0 */6 * * *',
    title: 'Kubernetes CronJob Schedule Checker',
    description: 'Check a Kubernetes CronJob schedule: 5-field cron and @hourly macros, the timeZone field, and the next runs in IST and UTC. Free, runs in your browser.',
    h1: 'Kubernetes CronJob Schedule Checker',
    lead: 'Paste the .spec.schedule of your CronJob and see when the Jobs will be created.',
    rules: [
      'Five fields: minute, hour, day-of-month, month, day-of-week.',
      'Macros such as @hourly, @daily and @weekly work.',
      'Set .spec.timeZone (for example Asia/Kolkata) to run in local time; otherwise the controller time zone is used.',
      'Do not put TZ= inside the schedule: newer Kubernetes rejects it.',
      'Missed runs are handled by startingDeadlineSeconds and concurrencyPolicy.',
    ],
    faqs: [
      ['How do I run a Kubernetes CronJob in IST?', 'Add timeZone: "Asia/Kolkata" under spec (stable since Kubernetes 1.27) and write the schedule in local time, for example 0 9 * * *. Without it, the schedule uses the kube-controller-manager time zone, usually UTC.'],
      ['Why did my CronJob not run?', 'Check that the schedule is valid here, that the CronJob is not suspended, and the startingDeadlineSeconds and concurrencyPolicy settings. If the controller was down past the deadline, the run is skipped.'],
      ['Can I use @daily in a CronJob?', 'Yes. Kubernetes accepts @yearly, @monthly, @weekly, @daily and @hourly as well as the 5-field syntax.'],
      ['How do I run a CronJob every 15 minutes?', 'Use */15 * * * *.'],
    ],
  },
  {
    slug: 'jenkins-cron',
    format: 'jenkins',
    expr: 'H/15 * * * *',
    title: 'Jenkins Cron Syntax (H) Checker',
    description: 'Check Jenkins cron syntax for Build periodically and pollSCM: the H hash, H/15 and H(0-29), with the next runs in IST and UTC. Free, runs in your browser.',
    h1: 'Jenkins Cron Syntax Checker',
    lead: 'Paste the schedule from "Build periodically" or triggers { cron(…) } and see when Jenkins will run it.',
    rules: [
      'Five fields: minute, hour, day-of-month, month, day-of-week.',
      'H picks a fixed value from a hash of the job name, so jobs do not all start at once.',
      'H/15 means every 15 minutes at an offset Jenkins chooses; H(0-29) picks within a range.',
      '@hourly, @daily and @midnight also use H.',
      'Times use the Jenkins controller time zone.',
    ],
    faqs: [
      ['What does H mean in a Jenkins cron?', 'H stands for hash. Jenkins replaces it with a fixed number based on the job name, so many jobs with H spread out instead of all starting at minute 0. The same job always gets the same value.'],
      ['What is the difference between H/15 and */15 in Jenkins?', '*/15 runs at minutes 0, 15, 30 and 45 for every job. H/15 also runs every 15 minutes, but each job starts at its own offset, which spreads the load.'],
      ['How do I run a Jenkins job every night?', 'Use H 2 * * * for some minute between 2:00 and 2:59, or @midnight for some time between 00:00 and 02:59.'],
      ['Why does the checker show exact times for H?', 'The real minute depends on the job name, which only Jenkins knows. The preview assumes the start of the range and says so.'],
    ],
  },
  {
    slug: 'azure-functions-cron',
    format: 'azure',
    expr: '0 */5 * * * *',
    title: 'Azure Functions Timer Cron (NCRONTAB)',
    description: 'Check Azure Functions timer trigger schedules: 6-field NCRONTAB with seconds, WEBSITE_TIME_ZONE, and the next runs in IST and UTC. Free, runs in your browser.',
    h1: 'Azure Functions Timer Trigger Cron Checker',
    lead: 'Paste the schedule from your TimerTrigger and see when the function will fire.',
    rules: [
      'Six fields: second, minute, hour, day, month, day-of-week (NCRONTAB).',
      '0 */5 * * * * runs every 5 minutes; 0 0 9 * * * runs at 9 AM.',
      'Day-of-week is 0 to 6 with 0 = Sunday.',
      'Runs in UTC unless WEBSITE_TIME_ZONE (Windows) or TZ (Linux) is set.',
      'A TimeSpan such as 00:05:00 also works on dedicated plans.',
    ],
    faqs: [
      ['Why does my Azure timer trigger cron have six fields?', 'Azure Functions use NCRONTAB, which adds a seconds field at the start. 0 0 9 * * * means 9:00:00 every day; a 5-field Linux cron is rejected.'],
      ['How do I run an Azure Function at 9 AM IST?', 'Either write the schedule in UTC (0 30 3 * * *) or set the app setting WEBSITE_TIME_ZONE to "India Standard Time" on Windows (or TZ to Asia/Kolkata on Linux) and use 0 0 9 * * *.'],
      ['How do I run a timer trigger every 5 minutes?', 'Use 0 */5 * * * *.'],
      ['How do I convert a Linux cron for Azure?', 'Add 0 in front for the seconds: 30 3 * * 1-5 becomes 0 30 3 * * 1-5.'],
    ],
  },
];

// ── Common schedules ────────────────────────────────────────────────────────
const SCHEDULES = [
  { slug: 'cron-every-5-minutes', expr: '*/5 * * * *', phrase: 'every 5 minutes', title: 'Cron Every 5 Minutes in Every Format' },
  { slug: 'cron-every-15-minutes', expr: '*/15 * * * *', phrase: 'every 15 minutes', title: 'Cron Every 15 Minutes in Every Format' },
  { slug: 'cron-every-hour', expr: '0 * * * *', phrase: 'every hour', title: 'Cron Every Hour in Every Format' },
  { slug: 'cron-every-6-hours', expr: '0 */6 * * *', phrase: 'every 6 hours', title: 'Cron Every 6 Hours in Every Format' },
  { slug: 'cron-every-day-at-midnight', expr: '0 0 * * *', phrase: 'every day at midnight', title: 'Cron Every Day at Midnight, All Formats' },
  { slug: 'cron-daily-9am-ist', expr: '30 3 * * *', phrase: 'every day at 9 AM IST (03:30 UTC)', title: 'Cron for 9 AM IST Daily (03:30 UTC)', ist: true },
  { slug: 'cron-weekdays-9am', expr: '0 9 * * 1-5', phrase: 'weekdays at 9 AM', title: 'Cron Weekdays at 9 AM in Every Format' },
  { slug: 'cron-every-monday', expr: '0 9 * * 1', phrase: 'every Monday at 9 AM', title: 'Cron Every Monday at 9 AM, All Formats' },
  { slug: 'cron-every-sunday-night', expr: '0 23 * * 0', phrase: 'every Sunday at 11 PM', title: 'Cron Every Sunday Night, All Formats' },
  { slug: 'cron-first-day-of-month', expr: '0 0 1 * *', phrase: 'on the first day of every month', title: 'Cron First Day of the Month, All Formats' },
];

/** The schedule in every format (null where it can't be written). */
export function allFormats(expr, format = 'linux') {
  const p = parseCron(expr, format);
  return Object.fromEntries(ORDER.map((f) => [f, f === format ? expr : convertCron(p, f)]));
}

function schedulePage(s) {
  const x = allFormats(s.expr);
  const phrase = s.phrase;
  let description = `Cron expression for ${phrase}: ${x.linux} in Linux crontab, plus the same schedule for AWS, GitHub Actions, Spring, Quartz, Kubernetes and Azure.`;
  if (description.length > 160) description = description.replace(', Kubernetes and Azure', ' and Azure');
  if (description.length < 140) description += ' Free.';
  if (description.length < 140) description = description.replace(' Free.', ' Free checker.');
  return {
    slug: s.slug,
    format: 'linux',
    expr: s.expr,
    title: s.title,
    description,
    h1: `Cron expression for ${phrase}`,
    lead: `${describeCron(parseCron(s.expr, 'linux'))}. Copy the expression for your platform, then check the next runs in IST and UTC below.`,
    table: x,
    faqs: [
      [`What is the cron expression for ${phrase}?`, `In Linux crontab, GitHub Actions and Kubernetes it is ${x.linux}. AWS EventBridge uses ${x.aws}, Spring uses ${x.spring}, Quartz uses ${x.quartz} and Azure Functions uses ${x.azure}.`],
      s.ist
        ? ['Why is 9 AM IST written as 30 3 in cron?', 'IST is 5 hours 30 minutes ahead of UTC, and GitHub Actions, AWS EventBridge rules and most servers read cron in UTC. 9:00 IST is 03:30 UTC, so the cron is 30 3 * * *. If your scheduler lets you set Asia/Kolkata as the time zone, write 0 9 * * * instead.']
        : [`What time zone does "${x.linux}" use?`, `Cron itself has no time zone: it runs in the time zone of whatever reads it. GitHub Actions and AWS EventBridge rules use UTC, so check the next runs in IST and UTC with the checker on this page before you rely on it.`],
      [`Why does the AWS version have a question mark?`, `In ${x.aws}, the ? means "no specific value". AWS EventBridge and Quartz need ? in either the day-of-month or the day-of-week field, while Linux cron uses * in both.`],
      [`Why do the Spring, Quartz and Azure versions have an extra 0?`, `Those formats start with a seconds field. ${x.spring} in Spring means second 0 of the same schedule as ${x.linux} in Linux cron.`],
    ],
  };
}

export const PAGES = [...FORMAT_PAGES, ...SCHEDULES.map(schedulePage)];
const url = (p) => `${SITE}/${p.slug}.html`;

function seo(p) {
  const full = `${p.title} | ${BRAND}`;
  return `<title>${esc(full)}</title>
  <meta name="description" content="${esc(p.description)}">
  <meta name="robots" content="index, follow">
  <meta name="author" content="${BRAND}">
  <meta name="bdt:variant-of" content="${MAIN_SLUG}">
  <link rel="canonical" href="${url(p)}">

  <!-- Open Graph -->
  <meta property="og:title" content="${esc(full)}">
  <meta property="og:description" content="${esc(p.description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url(p)}">
  <meta property="og:image" content="${OG_IMAGE}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(full)}">
  <meta name="twitter:description" content="${esc(p.description)}">
  <meta name="twitter:image" content="${OG_IMAGE}">`;
}

function jsonld(p) {
  const app = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: p.h1,
    description: p.description,
    url: url(p),
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web Browser',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    creator: { '@type': 'Organization', name: BRAND, url: SITE },
  };
  const crumbs = [
    { name: 'Home', item: `${SITE}/` },
    { name: 'Cron Expression Generator', item: `${SITE}/${MAIN_SLUG}.html` },
    { name: p.h1, item: url(p) },
  ];
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })) };
  const faq = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: p.faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  return [app, breadcrumb, faq].map((o) => `<script type="application/ld+json">\n${jsonBlock(o)}\n  </script>`).join('\n\n  ');
}

const CLOCK =
  '<svg class="bdt-i" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;vertical-align:-0.125em;flex-shrink:0"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/><path d="M6.38 18.7 4 21"/><path d="M17.64 18.67 20 21"/></svg>';

function details(p) {
  if (p.table) {
    const rows = ORDER.map((f) => `          <tr><th class="text-left pr-4 py-1 font-medium text-gray-600 dark:text-gray-400">${esc(FORMATS[f].label)}</th><td class="py-1">${p.table[f] ? `<code class="font-mono text-gray-900 dark:text-gray-100">${esc(p.table[f])}</code>` : '<span class="text-gray-400">not available</span>'}</td></tr>`).join('\n');
    return `    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
      <h2 class="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">${esc(p.h1)} in every format</h2>
      <div class="overflow-x-auto"><table class="text-sm">
        <tbody>
${rows}
        </tbody>
      </table></div>
      <p class="mt-3 text-sm text-gray-500 dark:text-gray-400">See the next runs in IST and UTC in the <a href="#formats" class="text-blue-600 dark:text-blue-400 underline">checker below</a>.</p>
    </div>`;
  }
  return `    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
      <h2 class="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">${esc(FORMATS[p.format].label)} cron rules</h2>
      <ul class="list-disc pl-5 space-y-1 text-sm text-gray-700 dark:text-gray-300">
${p.rules.map((r) => `        <li>${esc(r)}</li>`).join('\n')}
      </ul>
      <p class="mt-3 text-sm text-gray-500 dark:text-gray-400">Example: <code class="font-mono">${esc(p.expr)}</code> (${esc(describeCron(parseCron(p.expr, p.format)))}). <a href="#formats" class="text-blue-600 dark:text-blue-400 underline">Check your own expression</a>.</p>
    </div>`;
}

function hero(p) {
  return `<h1 class="sr-only">${esc(p.h1)}</h1>

    <!-- Hero -->
    <div class="text-center mb-10 animate-fade-in">
      <h2 class="text-4xl font-bold text-gray-900 dark:text-white mb-3">
        ${CLOCK} ${esc(p.h1)}
      </h2>
      <p class="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
        ${esc(p.lead)}
      </p>
    </div>
${details(p)}
    <script type="application/json" id="cronPage">${JSON.stringify({ format: p.format, expr: p.expr })}</script>`;
}

function faq(p) {
  return `<section class="faq-section" id="faq">
      <div class="faq-container">
        <h2 class="section-title">Frequently Asked Questions</h2>
        <div class="faq-list">
${p.faqs
  .map(
    ([q, a]) => `          <div class="faq-item">
            <button class="faq-question" aria-expanded="false">
              <span>${esc(q)}</span>
              <span class="faq-icon">+</span>
            </button>
            <div class="faq-answer">
              <p>${esc(a)}</p>
            </div>
          </div>`,
  )
  .join('\n\n')}
        </div>
      </div>
    </section>`;
}

/** Render one page from the template HTML. */
export function renderPage(template, p) {
  let html = template;
  html = region(html, 'cron', 'seo', '  ' + seo(p));
  html = region(html, 'cron', 'jsonld', '  ' + jsonld(p));
  html = region(html, 'cron', 'hero', '    ' + hero(p));
  html = region(html, 'cron', 'faq', '    ' + faq(p));
  return html;
}

export function withSitemapEntries(xml, today) {
  return addSitemapUrls(xml, PAGES.map(url), `${SITE}/${MAIN_SLUG}.html`, today);
}

// ── CLI ─────────────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const PUBLIC = join(process.cwd(), 'public');
  const template = readFileSync(join(PUBLIC, `${MAIN_SLUG}.html`), 'utf8');
  for (const p of PAGES) writeFileSync(join(PUBLIC, `${p.slug}.html`), renderPage(template, p));
  const sitemapPath = join(PUBLIC, 'sitemap.xml');
  writeFileSync(sitemapPath, withSitemapEntries(readFileSync(sitemapPath, 'utf8'), new Date().toISOString().slice(0, 10)));
  console.log(`Wrote ${PAGES.length} cron pages and updated the sitemap.`);
}
