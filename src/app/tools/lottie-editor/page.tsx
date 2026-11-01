import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import LottieEditorClient from './LottieEditorClient';

export const metadata: Metadata = generateToolMetadata('lottie-editor');

export default function LottieEditorPage() {
  return <LottieEditorClient />;
}

