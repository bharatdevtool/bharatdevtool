import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import PasswordGeneratorClient from './PasswordGeneratorClient';
export const metadata: Metadata = generateToolMetadata('password-generator');
export default function PasswordGeneratorPage() { return <PasswordGeneratorClient />; }

