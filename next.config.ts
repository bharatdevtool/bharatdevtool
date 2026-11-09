import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

const staticHtmlTools = [
  'about',
  'privacy',
  'feedback',
  'tools',
  'color-picker',
  'gradient-generator',
  'curl-tester',
  'curl-comparison',
  'deeplink',
  'base64',
  'url-encoder',
  'regex-tester',
  'regex-generator',
  'regex-library',
  'qr-decoder',
  'qr-generator-free',
  'simple-qr',
  'uuid-generator',
  'whatsapp-link',
  'password-generator',
  'word-counter',
  'text-case-converter',
  'age-calculator',
];

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
