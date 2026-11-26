import type { Metadata } from 'next';
import { generateVariantMetadata } from '@/config/seo';
import PdfToolClient from '@/components/pdf/PdfToolClient';

export const metadata: Metadata = generateVariantMetadata('compress-pdf-500kb');

export default function CompressPdfTo500KBPage() {
  return <PdfToolClient initialTask="compress" variantId="compress-pdf-500kb" preset={{ compressMode: 'target', targetKb: 500 }} />;
}
