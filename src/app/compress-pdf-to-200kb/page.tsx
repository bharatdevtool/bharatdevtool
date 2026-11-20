import type { Metadata } from 'next';
import { generateVariantMetadata } from '@/config/seo';
import PdfToolClient from '@/components/pdf/PdfToolClient';

export const metadata: Metadata = generateVariantMetadata('compress-pdf-200kb');

export default function CompressPdfTo200KBPage() {
  return <PdfToolClient initialTask="compress" variantId="compress-pdf-200kb" preset={{ compressMode: 'target', targetKb: 200 }} />;
}
