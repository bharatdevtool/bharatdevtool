import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import LottieAnalyzerClient from './LottieAnalyzerClient';

export const metadata: Metadata = generateToolMetadata('lottie-analyzer');

export default function LottieAnalyzerPage() {
  return <LottieAnalyzerClient />;
}

