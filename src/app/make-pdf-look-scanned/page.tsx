import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import LookScannedClient from './LookScannedClient';

export const metadata: Metadata = generateToolMetadata('make-pdf-look-scanned');

export default function MakePdfLookScannedPage() {
  return <LookScannedClient />;
}
