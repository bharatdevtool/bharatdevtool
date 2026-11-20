import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import OcrClient from './OcrClient';

export const metadata: Metadata = generateToolMetadata('image-to-text');

export default function ImageToTextPage() {
  return <OcrClient />;
}
