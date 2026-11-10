import type { Metadata } from 'next';
import OpenSharedClient from './OpenSharedClient';

// Recipient landing page printed on every Share-with-expiry cover PDF. Not a tool page, so not indexed.
export const metadata: Metadata = {
  title: 'Open a Protected PDF', // the root layout adds "| Bharat Dev Tools"
  description: 'Open a PDF someone shared with you using Bharat Dev Tools Share with Expiry. It is decrypted in your browser; nothing is uploaded.',
  robots: { index: false, follow: true },
};

export default function OpenPage() {
  return <OpenSharedClient />;
}
