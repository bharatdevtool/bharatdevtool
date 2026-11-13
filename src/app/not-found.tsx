import { TOOLS } from '@/config/tools';

export const metadata = {
  title: '404 - Page Not Found | Bharat Dev Tools',
  description: 'The requested tool or page could not be found. Explore our free tools for PDF, images, JSON and QR codes, all running in your browser.',
  robots: {
    index: false,
    follow: true,
  },
};

export default function NotFound() {
  const popularTools = [
    { label: 'JSON Formatter & Validator', href: '/jsonformatter/' },
    { label: 'Resize Image to 20 KB / 50 KB', href: '/resize-image-to-kb.html' },
    { label: 'Android DeepLink Tester', href: '/deeplink.html' },
    { label: 'QR Code Generator', href: '/qr-generator-free.html' },
    { label: 'Merge PDF (In-Browser)', href: '/merge-pdf' },
    { label: 'Timestamp / Epoch Converter', href: '/timestamp-converter.html' },
  ];

  return (
    <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16">
      <div className="max-w-xl w-full bg-card border border-border rounded-2xl p-8 shadow-sm">
        <div className="text-7xl sm:text-8xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
          404
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">Page Not Found</h1>
        <p className="text-muted-foreground text-sm mb-6">
          The tool or link you are looking for doesn&apos;t exist, was moved, or has a typo.
        </p>

        <a
          href="/"
          className="inline-flex items-center justify-center px-6 py-2.5 bg-primary text-primary-foreground font-medium text-sm rounded-lg hover:opacity-90 transition-opacity"
        >
          See all {TOOLS.length} tools
        </a>

        <div className="mt-8 pt-6 border-t border-border">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Popular Free Tools
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
            {popularTools.map((tool) => (
              <a
                key={tool.href}
                href={tool.href}
                className="flex items-center px-3.5 py-2.5 rounded-lg border border-border/60 hover:border-primary/50 hover:bg-muted/50 text-sm font-medium transition-colors"
              >
                <span>{tool.label}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

