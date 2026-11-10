import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import PdfToolClient from '@/components/pdf/PdfToolClient';

export const metadata: Metadata = generateToolMetadata('add-page-numbers');

export default function AddPageNumbersPage() {
  return <PdfToolClient initialTask="page-numbers" />;
}
