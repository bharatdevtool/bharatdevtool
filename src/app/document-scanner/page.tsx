import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import ScannerClient from './ScannerClient';

export const metadata: Metadata = generateToolMetadata('document-scanner');

export default function DocumentScannerPage() {
  return <ScannerClient />;
}
