import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import PdfToolClient from '@/components/pdf/PdfToolClient';

export const metadata: Metadata = generateToolMetadata('pdf-metadata');

export default function PdfMetadataPage() {
  return <PdfToolClient initialTask="metadata" />;
}
