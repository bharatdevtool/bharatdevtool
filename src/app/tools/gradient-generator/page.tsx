import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import GradientGeneratorClient from './GradientGeneratorClient';

export const metadata: Metadata = generateToolMetadata('gradient-generator');

export default function GradientGeneratorPage() {
  return <GradientGeneratorClient />;
}
