// Builds /llms.txt — a plain-Markdown map of the site for AI assistants and AI
// search (https://llmstxt.org) — from the tool registry, so it always lists
// exactly the tools that exist. Served by src/app/llms.txt/route.ts.
import { TOOLS, TOOL_CATEGORIES } from '@/config/tools';
import { SITE } from '@/config/site';

export function buildLlmsTxt(): string {
  const sections = TOOL_CATEGORIES.map((category) => {
    const lines = TOOLS.filter((t) => t.category === category).map(
      (t) => `- [${t.label}](${SITE.url}${t.route}): ${t.description}`,
    );
    return `## ${category}\n\n${lines.join('\n')}`;
  });

  return `# ${SITE.name}

> ${SITE.name} (${SITE.url.replace('https://', '')}) is a free collection of ${TOOLS.length} online tools for PDF, images, JSON, QR codes, developer utilities and Indian calculators. Every tool runs entirely in the user's web browser: files and text are processed on the device and are never uploaded to a server. No sign-up, no usage limits, no watermarks.

Key facts:

- Free to use, with no account, paywall or daily limit.
- Private by design: processing happens client-side in the browser. Only anonymous usage statistics and error reports are collected, never user input or file contents.
- Works in any modern browser on Android, iPhone, Windows, macOS and Linux. Nothing to install.
- Built in India. Includes tools for Indian users, such as resizing photos and signatures to the KB limits of exam and government forms (UPSC, SSC, NEET, JEE, IBPS) and GST and EMI calculators.

${sections.join('\n\n')}

## About

- [All tools](${SITE.url}/): The full tool directory, searchable and grouped by category.
- [About](${SITE.url}/about.html): Who builds Bharat Dev Tools and how it works.
- [Privacy policy](${SITE.url}/privacy.html): Exactly what is and is not collected.
- [Sitemap](${SITE.url}/sitemap.xml): Every page on the site.
`;
}
