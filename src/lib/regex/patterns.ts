// lib/regex/patterns.ts — Curated regex library (from regex-library.html)

export interface RegexPattern {
  id: string;
  name: string;
  pattern: string;
  flags: string;
  description: string;
  example: string;
  category: string;
}

export const REGEX_PATTERNS: RegexPattern[] = [
  // Email
  { id: 'email', name: 'Email Address', pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$', flags: 'i', description: 'Validates standard email addresses', example: 'user@example.com', category: 'Web' },
  // URLs
  { id: 'url', name: 'URL (http/https)', pattern: 'https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)', flags: 'gi', description: 'Matches http and https URLs', example: 'https://example.com/path?q=1', category: 'Web' },
  // Phone — India
  { id: 'phone-in', name: 'Indian Phone Number', pattern: '^(?:\\+91|0)?[6-9]\\d{9}$', flags: '', description: 'Validates Indian mobile numbers (10 digits, starts 6-9)', example: '+919876543210', category: 'Phone' },
  // Phone — US
  { id: 'phone-us', name: 'US Phone Number', pattern: '^(\\+1)?[2-9]\\d{2}[2-9]\\d{6}$', flags: '', description: 'Validates US phone numbers', example: '+12025551234', category: 'Phone' },
  // IP addresses
  { id: 'ipv4', name: 'IPv4 Address', pattern: '^((25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(25[0-5]|2[0-4]\\d|[01]?\\d\\d?)$', flags: '', description: 'Validates IPv4 addresses', example: '192.168.1.1', category: 'Network' },
  { id: 'ipv6', name: 'IPv6 Address', pattern: '^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$', flags: '', description: 'Validates simple IPv6 addresses', example: '2001:0db8:85a3:0000:0000:8a2e:0370:7334', category: 'Network' },
  // Dates
  { id: 'date-iso', name: 'ISO Date (YYYY-MM-DD)', pattern: '^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$', flags: '', description: 'Validates ISO 8601 date format', example: '2024-01-31', category: 'Date & Time' },
  { id: 'date-dmy', name: 'Date DD/MM/YYYY', pattern: '^(0[1-9]|[12]\\d|3[01])\\/(0[1-9]|1[0-2])\\/\\d{4}$', flags: '', description: 'Validates DD/MM/YYYY date format', example: '31/01/2024', category: 'Date & Time' },
  // Numbers
  { id: 'integer', name: 'Integer', pattern: '^-?\\d+$', flags: '', description: 'Matches positive and negative integers', example: '-42', category: 'Numbers' },
  { id: 'decimal', name: 'Decimal Number', pattern: '^-?\\d+(\\.\\d+)?$', flags: '', description: 'Matches integers and decimal numbers', example: '3.14', category: 'Numbers' },
  // UUID
  { id: 'uuid', name: 'UUID', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', flags: 'i', description: 'Validates UUID v1-v7', example: '550e8400-e29b-41d4-a716-446655440000', category: 'Web' },
  // Hex color
  { id: 'hex-color', name: 'Hex Color', pattern: '^#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$', flags: '', description: 'Validates 3 or 6 digit hex colors', example: '#FF5733', category: 'Web' },
  // Postal — India
  { id: 'pincode-in', name: 'Indian PIN Code', pattern: '^[1-9][0-9]{5}$', flags: '', description: 'Validates 6-digit Indian PIN codes', example: '110001', category: 'India' },
  // Aadhaar
  { id: 'aadhaar', name: 'Aadhaar Number', pattern: '^[2-9]{1}[0-9]{3}\\s[0-9]{4}\\s[0-9]{4}$', flags: '', description: 'Validates Indian Aadhaar number format', example: '2345 6789 0123', category: 'India' },
  // PAN
  { id: 'pan', name: 'PAN Card Number', pattern: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$', flags: '', description: 'Validates Indian PAN card numbers', example: 'ABCDE1234F', category: 'India' },
  // Strong password
  { id: 'strong-password', name: 'Strong Password', pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$', flags: '', description: 'Min 8 chars, uppercase, lowercase, digit, special char', example: 'P@ssw0rd!', category: 'Security' },
  // Slug
  { id: 'slug', name: 'URL Slug', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', flags: '', description: 'Validates URL-friendly slugs', example: 'my-blog-post', category: 'Web' },
  // Hashtag
  { id: 'hashtag', name: 'Hashtag', pattern: '#[a-zA-Z]\\w*', flags: 'g', description: 'Matches hashtags in text', example: '#BharatDevTools', category: 'Social' },
];

export function searchPatterns(query: string): RegexPattern[] {
  const q = query.toLowerCase();
  return REGEX_PATTERNS.filter(
    (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
  );
}

