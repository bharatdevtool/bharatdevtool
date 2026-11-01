import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Redirects from old HTML URLs to new clean routes
  async redirects() {
    return [
      { source: '/index.html',           destination: '/tools/json-formatter', permanent: true },
      { source: '/jsonformatter',         destination: '/tools/json-formatter', permanent: true },
      { source: '/jsonformatter/',        destination: '/tools/json-formatter', permanent: true },
      { source: '/jsondiff',             destination: '/tools/json-diff',      permanent: true },
      { source: '/jsondiff/',            destination: '/tools/json-diff',      permanent: true },
      { source: '/qr-generator-free.html',destination: '/tools/qr-generator',  permanent: true },
      { source: '/qr-decoder.html',      destination: '/tools/qr-decoder',     permanent: true },
      { source: '/color-picker.html',    destination: '/tools/color-picker',   permanent: true },
      { source: '/gradient-generator.html', destination: '/tools/gradient-generator', permanent: true },
      { source: '/curl-tester.html',     destination: '/tools/curl-tester',    permanent: true },
      { source: '/curl-comparison.html', destination: '/tools/curl-comparison',permanent: true },
      { source: '/deeplink.html',        destination: '/tools/deeplink',       permanent: true },
      { source: '/base64.html',          destination: '/tools/base64',         permanent: true },
      { source: '/url-encoder.html',     destination: '/tools/url-encoder',    permanent: true },
      { source: '/regex-tester.html',    destination: '/tools/regex-tester',   permanent: true },
      { source: '/regex-generator.html', destination: '/tools/regex-generator',permanent: true },
      { source: '/regex-library.html',   destination: '/tools/regex-library',  permanent: true },
      { source: '/word-counter.html',    destination: '/tools/word-counter',   permanent: true },
      { source: '/text-case-converter.html', destination: '/tools/text-case-converter', permanent: true },
      { source: '/password-generator.html', destination: '/tools/password-generator',  permanent: true },
      { source: '/uuid-generator.html',  destination: '/tools/uuid-generator', permanent: true },
      { source: '/whatsapp-link.html',   destination: '/tools/whatsapp-link',  permanent: true },
      { source: '/age-calculator.html',  destination: '/tools/age-calculator', permanent: true },
      { source: '/tools.html',           destination: '/tools',                permanent: true },
      { source: '/tools/lottie-analyzer', destination: '/tools/lottie-player', permanent: true },
      { source: '/about.html',           destination: '/about',                permanent: true },
      { source: '/privacy.html',         destination: '/privacy',              permanent: true },
      { source: '/feedback.html',        destination: '/feedback',             permanent: true },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'ik.imagekit.io', pathname: '/bdt/**' },
    ],
  },
};

export default nextConfig;
