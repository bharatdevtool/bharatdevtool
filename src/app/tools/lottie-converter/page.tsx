import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import LottieConverterClient from './LottieConverterClient';

export const metadata: Metadata = generateToolMetadata('lottie-converter');

export default function LottieConverterPage() {
  return <LottieConverterClient />;
}

