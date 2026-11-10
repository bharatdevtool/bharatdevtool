import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import PdfToolClient from '@/components/pdf/PdfToolClient';

export const metadata: Metadata = generateToolMetadata('merge-pdf');

export default function MergePdfPage() {
  return <PdfToolClient initialTask="merge" />;
}
