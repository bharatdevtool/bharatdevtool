// regex-library-app.js - Regex Library Application Logic
// Bharat Dev Tools - Regex Library

const DEBUG_MODE = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1' ||
                   window.location.search.includes('debug=true');

const Debug = {
  log: (...args) => {
    if (DEBUG_MODE) {
      console.log('[DEBUG]', ...args);
    }
  }
};

// Track analytics events
function trackRegexEvent(eventName, context = {}) {
  if (typeof window.Analytics !== 'undefined') {
    window.Analytics.track(eventName, {
      ...context,
      page: 'regex_library',
      timestamp: Date.now()
    });
  }
}

// Regex patterns library
const REGEX_PATTERNS = [
  {
    name: 'Email Validation',
    pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
    description: 'Validates email addresses. Matches standard email format with username, @ symbol, domain, and TLD.',
    example: 'user@example.com',
    category: 'validation'
  },
  {
    name: 'Strong Password',
    pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$',
    description: 'Validates strong passwords with at least 8 characters, including uppercase, lowercase, digit, and special character.',
    example: 'MyP@ssw0rd',
    category: 'validation'
  },
  {
    name: 'Username',
    pattern: '^[a-zA-Z0-9_-]{3,20}$',
    description: 'Validates usernames with 3-20 characters. Allows letters, numbers, underscores, and hyphens.',
    example: 'user_name123',
    category: 'validation'
  },
  {
    name: 'Indian Phone Number',
    pattern: '^(\\+91[-]?)?[6-9]\\d{9}$',
    description: 'Validates Indian phone numbers. Supports +91 prefix and 10-digit numbers starting with 6-9.',
    example: '+91-9876543210',
    category: 'phone'
  },
  {
    name: 'US Phone Number',
    pattern: '^(\\(?[0-9]{3}\\)?[-.\\s]?[0-9]{3}[-.\\s]?[0-9]{4})$',
    description: 'Validates US phone numbers in various formats: (202) 555-0145, 202-555-0145, 202.555.0145, etc.',
    example: '(202) 555-0145',
    category: 'phone'
  },
  {
    name: 'URL',
    pattern: '^https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)$',
    description: 'Validates URLs starting with http:// or https://. Supports domains, paths, and query parameters.',
    example: 'https://example.com/path?query=value',
    category: 'url'
  },
  {
    name: 'Pincode (India)',
    pattern: '^[1-9][0-9]{5}$',
    description: 'Validates Indian postal codes (pincodes). 6 digits, first digit cannot be 0.',
    example: '110001',
    category: 'validation'
  },
  {
    name: 'Credit Card',
    pattern: '^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})$',
    description: 'Validates credit card numbers. Supports Visa, MasterCard, American Express, and Discover.',
    example: '4532015112830366',
    category: 'validation'
  },
  {
    name: 'PAN Card (India)',
    pattern: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$',
    description: 'Validates Indian PAN (Permanent Account Number) card format: 5 letters, 4 digits, 1 letter.',
    example: 'ABCDE1234F',
    category: 'validation'
  },
  {
    name: 'Aadhaar (India)',
    pattern: '^[2-9]{1}[0-9]{3}\\s[0-9]{4}\\s[0-9]{4}$',
    description: 'Validates Indian Aadhaar number format: 4 digits, space, 4 digits, space, 4 digits. First digit cannot be 0 or 1.',
    example: '2345 6789 0123',
    category: 'validation'
  },
  {
    name: 'Date (YYYY-MM-DD)',
    pattern: '^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$',
    description: 'Validates dates in YYYY-MM-DD format. Ensures valid month (01-12) and day ranges.',
    example: '2024-12-25',
    category: 'date'
  },
  {
    name: 'Date (DD/MM/YYYY)',
    pattern: '^(0[1-9]|[12]\\d|3[01])\\/(0[1-9]|1[0-2])\\/\\d{4}$',
    description: 'Validates dates in DD/MM/YYYY format. Common in many countries.',
    example: '25/12/2024',
    category: 'date'
  },
  {
    name: 'UUID',
    pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    description: 'Validates UUID format: 8-4-4-4-12 hexadecimal characters separated by hyphens.',
    example: '550e8400-e29b-41d4-a716-446655440000',
    category: 'validation'
  },
  {
    name: 'Remove HTML Tags',
    pattern: '<[^>]+>',
    description: 'Matches HTML tags for removal. Use with replace to strip HTML from text.',
    example: '<div>Hello</div>',
    category: 'extraction'
  },
  {
    name: 'Extract Numbers',
    pattern: '\\d+',
    description: 'Matches all numbers in text. Use with global flag to find all occurrences.',
    example: 'Price: $123.45',
    category: 'extraction'
  },
  {
    name: 'Whitespace Trimming',
    pattern: '^\\s+|\\s+$',
    description: 'Matches leading and trailing whitespace. Use with replace to trim strings.',
    example: '  Hello World  ',
    category: 'extraction'
  },
  {
    name: 'IP Address (IPv4)',
    pattern: '^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$',
    description: 'Validates IPv4 addresses. Ensures each octet is between 0-255.',
    example: '192.168.1.1',
    category: 'validation'
  },
  {
    name: 'Hex Color Code',
    pattern: '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$',
    description: 'Validates hexadecimal color codes. Supports both 6-digit and 3-digit formats.',
    example: '#FF5733',
    category: 'validation'
  },
  {
    name: 'Slug (URL-friendly)',
    pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
    description: 'Validates URL-friendly slugs. Lowercase letters, numbers, and hyphens only. No consecutive hyphens.',
    example: 'my-awesome-slug-123',
    category: 'validation'
  },
  {
    name: 'Time (HH:MM)',
    pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$',
    description: 'Validates 24-hour time format. Hours: 00-23, Minutes: 00-59.',
    example: '14:30',
    category: 'validation'
  },
  {
    name: 'Alphanumeric Only',
    pattern: '^[a-zA-Z0-9]+$',
    description: 'Matches strings containing only letters and numbers. No spaces or special characters.',
    example: 'Hello123',
    category: 'validation'
  },
  {
    name: 'Extract Email from Text',
    pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
    description: 'Extracts email addresses from text. Use with global flag to find all emails.',
    example: 'Contact us at support@example.com',
    category: 'extraction'
  }
];

// Render patterns
function renderPatterns(patterns = REGEX_PATTERNS) {
  const grid = document.getElementById('regex-patterns-grid');
  
  if (patterns.length === 0) {
    grid.innerHTML = '<div class="col-span-full text-center text-gray-500 dark:text-gray-400 py-8">No patterns found</div>';
    return;
  }
  
  grid.innerHTML = patterns.map((pattern, index) => `
    <div class="regex-card bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div class="flex justify-between items-start mb-3">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          ${escapeHtml(pattern.name)}
        </h3>
        <span class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
          ${pattern.category}
        </span>
      </div>
      
      <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">
        ${escapeHtml(pattern.description)}
      </p>
      
      <div class="mb-4">
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          Pattern
        </label>
        <div class="relative">
          <input
            type="text"
            value="${escapeHtml(pattern.pattern)}"
            readonly
            class="pattern-code w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
            id="pattern-${index}"
          />
          <button
            class="copy-pattern-btn absolute right-2 top-2 px-3 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
            data-pattern="${escapeHtml(pattern.pattern)}"
            data-name="${escapeHtml(pattern.name)}"
          >
            Copy
          </button>
        </div>
      </div>
      
      ${pattern.example ? `
        <div class="mb-4">
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Example
          </label>
          <code class="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-900 dark:text-white">
            ${escapeHtml(pattern.example)}
          </code>
        </div>
      ` : ''}
      
      <div class="flex gap-2">
        <a
          href="regex-tester.html?pattern=${encodeURIComponent(pattern.pattern)}"
          class="flex-1 text-center px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          Test
        </a>
      </div>
    </div>
  `).join('');
  
  // Attach copy event listeners
  document.querySelectorAll('.copy-pattern-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pattern = btn.dataset.pattern;
      const name = btn.dataset.name;
      copyPattern(pattern, name, btn);
    });
  });
}

// Copy pattern to clipboard
function copyPattern(pattern, name, button) {
  const textarea = document.createElement('textarea');
  textarea.value = pattern;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  
  try {
    document.execCommand('copy');
    
    // Show feedback
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    button.classList.add('bg-green-600');
    button.classList.remove('bg-primary-600');
    
    setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove('bg-green-600');
      button.classList.add('bg-primary-600');
    }, 2000);
    
    trackRegexEvent('copy_pattern', {
      pattern_name: name
    });
    
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.trackCopyContent({
        page: 'regex_library',
        content_type: 'regex_pattern',
        pattern_name: name
      });
    }
  } catch (error) {
    Debug.log('Failed to copy:', error);
    alert('Failed to copy pattern. Please select and copy manually.');
  } finally {
    document.body.removeChild(textarea);
  }
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Search patterns
function searchPatterns(query) {
  if (!query || query.trim().length === 0) {
    renderPatterns(REGEX_PATTERNS);
    return;
  }
  
  const lowerQuery = query.toLowerCase();
  const filtered = REGEX_PATTERNS.filter(pattern => {
    return pattern.name.toLowerCase().includes(lowerQuery) ||
           pattern.description.toLowerCase().includes(lowerQuery) ||
           pattern.category.toLowerCase().includes(lowerQuery) ||
           pattern.pattern.toLowerCase().includes(lowerQuery);
  });
  
  renderPatterns(filtered);
  
  trackRegexEvent('search_patterns', {
    query_length: query.length,
    results_count: filtered.length
  });
}

// Initialize event listeners
function initEventListeners() {
  // Search input
  const searchInput = document.getElementById('search-input');
  let searchTimeout;
  
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchPatterns(searchInput.value);
    }, 300);
  });
}

// Initialize app
function initApp() {
  renderPatterns();
  initEventListeners();
  trackRegexEvent('page_view');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}


