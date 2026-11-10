import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import PdfToolClient from '@/components/pdf/PdfToolClient';

export const metadata: Metadata = generateToolMetadata('redact-pdf');

export default function RedactPdfPage() {
  return <PdfToolClient initialTask="redact" />;
}
