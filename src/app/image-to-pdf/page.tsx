import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import PdfToolClient from '@/components/pdf/PdfToolClient';

export const metadata: Metadata = generateToolMetadata('image-to-pdf');

export default function ImageToPdfPage() {
  return <PdfToolClient initialTask="jpg-to-pdf" initialToolId="image-to-pdf" />;
}
