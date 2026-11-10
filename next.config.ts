import type { NextConfig } from 'next';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const isProd = process.env.NODE_ENV === 'production';

// Every legacy HTML page in public/ gets a clean URL in dev (/foo -> /foo.html).
// Netlify does the same in production via Pretty URLs.
const staticHtmlTools = readdirSync(join(process.cwd(), 'public'))
  .filter((f) => f.endsWith('.html') && f !== 'index.html')
  .map((f) => f.replace(/\.html$/, ''));

const nextConfig: NextConfig = {
  ...(isProd
    ? { output: 'export' }
    : {
        async rewrites() {
          return [
            { source: '/', destination: '/index.html' },
            { source: '/tools', destination: '/tools.html' },
            { source: '/jsondiff', destination: '/jsondiff/index.html' },
            { source: '/jsonformatter', destination: '/jsonformatter/index.html' },
            ...staticHtmlTools.map((tool) => ({
              source: `/${tool}`,
              destination: `/${tool}.html`,
            })),
          ];
        },
      }),

  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'ik.imagekit.io', pathname: '/bdt/**' },
    ],
  },
};

export default nextConfig;
