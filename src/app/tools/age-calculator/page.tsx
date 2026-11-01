import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import AgeCalculatorClient from './AgeCalculatorClient';
export const metadata: Metadata = generateToolMetadata('age-calculator');
export default function AgeCalculatorPage() { return <AgeCalculatorClient />; }

