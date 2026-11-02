import type { Metadata } from 'next';
import { TOOLS } from '@/config/tools';
import { generateStaticMetadata } from '@/config/seo';
import ToolsDirectoryClient from './ToolsDirectoryClient';

export const metadata: Metadata = generateStaticMetadata({
  title: 'All Developer Tools — Free & Client-Side',
  description: `${TOOLS.length} professional online developer tools — JSON, QR codes, regex, color, cURL, encoding, and more. 100% private, no sign-up required.`,
  path: '/tools',
});

export default function ToolsPage() {
  return <ToolsDirectoryClient />;
}
