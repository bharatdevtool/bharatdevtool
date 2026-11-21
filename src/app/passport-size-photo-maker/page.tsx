import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import PassportPhotoClient from './PassportPhotoClient';

export const metadata: Metadata = generateToolMetadata('passport-photo-maker');

export default function PassportPhotoPage() {
  return <PassportPhotoClient />;
}
