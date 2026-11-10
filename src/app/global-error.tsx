'use client';

import { useEffect } from 'react';
import { reportError } from '@/lib/monitoring/errorReporting';

/** Last-resort error page when the root layout itself fails; reports the error to Sentry */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#090E17', color: '#F8FAFC', padding: '3rem 1rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ fontSize: '0.875rem', opacity: 0.7 }}>Your data never left your browser.</p>
        <button
          type="button"
          onClick={reset}
          style={{ marginTop: '1rem', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 0, background: '#3B82F6', color: '#fff', cursor: 'pointer' }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
