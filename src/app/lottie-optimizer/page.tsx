import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import LottieOptimizerClient from './LottieOptimizerClient';

export const metadata: Metadata = generateToolMetadata('lottie-optimizer');

export default function LottieOptimizerPage() {
  return <LottieOptimizerClient />;
}

