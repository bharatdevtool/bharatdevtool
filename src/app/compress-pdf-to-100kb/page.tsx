import type { Metadata } from 'next';
import { generateVariantMetadata } from '@/config/seo';
import PdfToolClient from '@/components/pdf/PdfToolClient';

export const metadata: Metadata = generateVariantMetadata('compress-pdf-100kb');

export default function CompressPdfTo100KBPage() {
  return <PdfToolClient initialTask="compress" variantId="compress-pdf-100kb" preset={{ compressMode: 'target', targetKb: 100 }} />;
}
