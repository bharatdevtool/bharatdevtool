import type { Metadata } from 'next';
import { generateToolMetadata } from '@/config/seo';
import CurlComparisonClient from './CurlComparisonClient';
export const metadata: Metadata = generateToolMetadata('curl-comparison');
export default function CurlComparisonPage() { return <CurlComparisonClient />; }

