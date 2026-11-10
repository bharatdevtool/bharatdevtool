import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import LottieValidatorClient from './LottieValidatorClient';

export const metadata: Metadata = generateToolMetadata('lottie-validator');

export default function LottieValidatorPage() {
  return <LottieValidatorClient />;
}

