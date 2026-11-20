import type { Metadata } from 'next';
import { generateVariantMetadata } from '@/config/seo';
import PdfToolClient from '@/components/pdf/PdfToolClient';

export const metadata: Metadata = generateVariantMetadata('compress-pdf-1mb');

export default function CompressPdfTo1MBPage() {
  return <PdfToolClient initialTask="compress" variantId="compress-pdf-1mb" preset={{ compressMode: 'target', targetKb: 1000 }} />;
}
