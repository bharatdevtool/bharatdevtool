// regex-generator.js - Regex pattern generator based on rules
// Bharat Dev Tools - Regex Generator Module

/**
 * Generates regex pattern for email validation
 * @returns {string} Email regex pattern
 */
export function generateEmailRegex() {
  return '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$';
}

/**
 * Generates regex pattern for phone number validation
 * @param {object} options - Options { country: 'indian' | 'us' | 'international' }
 * @returns {string} Phone regex pattern
 */
export function generatePhoneRegex(options = {}) {
  const { country = 'international' } = options;
  
  if (country === 'indian') {
    // Indian phone: +91-9876543210 or 9876543210
    return '^(\\+91[-]?)?[6-9]\\d{9}$';
  } else if (country === 'us') {
    // US phone: (202) 555-0145 or 202-555-0145
    return '^(\\(?[0-9]{3}\\)?[-.\\s]?[0-9]{3}[-.\\s]?[0-9]{4})$';
  } else {
    // International phone
    return '^(\\+?[1-9]\\d{1,14})$';
  }
}

/**
 * Generates regex pattern for URL validation
 * @returns {string} URL regex pattern
 */
export function generateURLRegex() {
  return '^https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)$';
}

/**
 * Generates regex pattern for username validation
 * @param {object} options - Options { minLength, maxLength, allowUnderscore, allowDash }
 * @returns {string} Username regex pattern
 */
export function generateUsernameRegex(options = {}) {
  const {
    minLength = 3,
    maxLength = 20,
    allowUnderscore = true,
    allowDash = true
  } = options;
  
  let charClass = 'a-zA-Z0-9';
  if (allowUnderscore) charClass += '_';
  if (allowDash) charClass += '-';
  
  return `^[${charClass}]{${minLength},${maxLength}}$`;
}

/**
 * Generates regex pattern for password validation
 * @param {object} options - Options { minLength, maxLength, requireUppercase, requireLowercase, requireDigit, requireSpecial }
 * @returns {string} Password regex pattern
 */
export function generatePasswordRegex(options = {}) {
  const {
    minLength = 8,
    maxLength = 128,
    requireUppercase = true,
    requireLowercase = true,
    requireDigit = true,
    requireSpecial = false
  } = options;
  
  const parts = [];
  
  if (requireUppercase) {
    parts.push('(?=.*[A-Z])');
  }
  if (requireLowercase) {
    parts.push('(?=.*[a-z])');
  }
  if (requireDigit) {
    parts.push('(?=.*\\d)');
  }
  if (requireSpecial) {
    parts.push('(?=.*[@$!%*?&])');
  }
  
  let charClass = 'a-zA-Z0-9';
  if (requireSpecial) {
    charClass += '@$!%*?&';
  }
  
  parts.push(`[${charClass}]{${minLength},${maxLength}}`);
  
  return `^${parts.join('')}$`;
}

/**
 * Generates regex pattern for date validation
 * @param {object} options - Options { format: 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY' }
 * @returns {string} Date regex pattern
 */
export function generateDateRegex(options = {}) {
  const { format = 'YYYY-MM-DD' } = options;
  
  if (format === 'YYYY-MM-DD') {
    return '^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$';
  } else if (format === 'DD/MM/YYYY') {
    return '^(0[1-9]|[12]\\d|3[01])\\/(0[1-9]|1[0-2])\\/\\d{4}$';
  } else if (format === 'MM/DD/YYYY') {
    return '^(0[1-9]|1[0-2])\\/(0[1-9]|[12]\\d|3[01])\\/\\d{4}$';
  }
  
  return '^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$';
}

/**
 * Generates regex pattern for UUID validation
 * @returns {string} UUID regex pattern
 */
export function generateUUIDRegex() {
  return '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
}

/**
 * Generates regex pattern based on custom rules
 * @param {object} rules - Custom rules
 * @returns {string} Generated regex pattern
 */
export function generateCustomRegex(rules) {
  const {
    minLength = 1,
    maxLength = 100,
    includeUppercase = false,
    includeLowercase = false,
    includeDigits = false,
    includeSpecial = false,
    allowedChars = '',
    startAnchor = true,
    endAnchor = true
  } = rules;
  
  const charClasses = [];
  
  if (includeUppercase) {
    charClasses.push('A-Z');
  }
  if (includeLowercase) {
    charClasses.push('a-z');
  }
  if (includeDigits) {
    charClasses.push('0-9');
  }
  if (includeSpecial) {
    charClasses.push('@$!%*?&');
  }
  if (allowedChars) {
    // Escape special regex characters in allowed chars
    const escaped = allowedChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    charClasses.push(escaped);
  }
  
  if (charClasses.length === 0) {
    charClasses.push('.');
  }
  
  const charClass = `[${charClasses.join('')}]`;
  const quantifier = `{${minLength},${maxLength}}`;
  
  let pattern = charClass + quantifier;
  
  if (startAnchor) {
    pattern = '^' + pattern;
  }
  if (endAnchor) {
    pattern = pattern + '$';
  }
  
  return pattern;
}

/**
 * Generates human-readable explanation for a regex pattern
 * @param {string} pattern - The regex pattern
 * @param {string} type - The type of pattern (email, phone, etc.)
 * @param {object} options - Options used to generate the pattern
 * @returns {string} Human-readable explanation
 */
export function explainGeneratedRegex(pattern, type, options = {}) {
  const explanations = {
    email: 'Matches a valid email address format: username@domain.com',
    phone: {
      indian: 'Matches Indian phone numbers: +91-9876543210 or 9876543210',
      us: 'Matches US phone numbers: (202) 555-0145 or 202-555-0145',
      international: 'Matches international phone numbers with country code'
    },
    url: 'Matches valid URLs starting with http:// or https://',
    username: `Matches usernames with ${options.minLength || 3}-${options.maxLength || 20} characters`,
    password: `Matches strong passwords with minimum ${options.minLength || 8} characters${options.requireUppercase ? ', uppercase letters' : ''}${options.requireLowercase ? ', lowercase letters' : ''}${options.requireDigit ? ', digits' : ''}${options.requireSpecial ? ', special characters' : ''}`,
    date: `Matches dates in ${options.format || 'YYYY-MM-DD'} format`,
    uuid: 'Matches UUID format: 8-4-4-4-12 hexadecimal characters',
    custom: 'Custom regex pattern based on specified rules'
  };
  
  if (type === 'phone' && explanations.phone[options.country]) {
    return explanations.phone[options.country];
  }
  
  return explanations[type] || 'Generated regex pattern';
}


