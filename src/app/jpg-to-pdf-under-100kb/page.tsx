import type { Metadata } from 'next';
import { generateVariantMetadata } from '@/config/seo';
import PdfToolClient from '@/components/pdf/PdfToolClient';

export const metadata: Metadata = generateVariantMetadata('jpg-to-pdf-100kb');

export default function JpgToPdfUnder100KBPage() {
  return <PdfToolClient initialTask="jpg-to-pdf" variantId="jpg-to-pdf-100kb" preset={{ fitUnder: true, targetKb: 100 }} />;
}
