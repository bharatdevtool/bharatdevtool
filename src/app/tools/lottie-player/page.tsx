import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import LottiePlayerClient from './LottiePlayerClient';

export const metadata: Metadata = generateToolMetadata('lottie-player');

export default function LottiePlayerPage() {
  return <LottiePlayerClient />;
}

