import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import LottieFixerClient from './LottieFixerClient';

export const metadata: Metadata = generateToolMetadata('lottie-fixer');

export default function LottieFixerPage() {
  return <LottieFixerClient />;
}
