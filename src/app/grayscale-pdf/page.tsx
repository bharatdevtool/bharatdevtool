import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import PdfToolClient from '@/components/pdf/PdfToolClient';

export const metadata: Metadata = generateToolMetadata('grayscale-pdf');

export default function GrayscalePdfPage() {
  return <PdfToolClient initialTask="grayscale" />;
}
