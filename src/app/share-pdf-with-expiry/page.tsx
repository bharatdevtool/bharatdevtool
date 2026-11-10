import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import PdfToolClient from '@/components/pdf/PdfToolClient';

export const metadata: Metadata = generateToolMetadata('secure-share-pdf');

export default function SecureSharePdfPage() {
  return <PdfToolClient initialTask="secure-share" />;
}
