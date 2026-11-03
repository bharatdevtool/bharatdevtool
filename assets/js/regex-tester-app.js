// regex-tester-app.js - Regex Tester Application Logic
// Bharat Dev Tools - Regex Tester

const DEBUG_MODE = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1' ||
                   window.location.search.includes('debug=true');

const Debug = {
  log: (...args) => {
    if (DEBUG_MODE) {
      console.log('[DEBUG]', ...args);
    }
  },
  error: (...args) => {
    if (DEBUG_MODE) {
      console.error('[DEBUG]', ...args);
    }
  }
};

// Track analytics events
function trackRegexEvent(eventName, context = {}) {
  if (typeof window.Analytics !== 'undefined') {
    window.Analytics.track(eventName, {
      ...context,
      page: 'regex_tester',
      timestamp: Date.now()
    });
  }
}

// Track validation errors
function trackValidationError(context) {
  if (typeof window.Analytics !== 'undefined') {
    window.Analytics.track('validation_error', {
      ...context,
      operation: 'regex_validation',
      user_agent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`
    });
  }
}

// Track regex errors
function trackRegexError(context) {
  if (typeof window.Analytics !== 'undefined') {
    window.Analytics.track('format_error', {
      ...context,
      operation: 'regex_test',
      timestamp: Date.now()
    });
  }
}

// Get current page name for analytics
function getCurrentPageNameForAnalytics() {
  return 'regex_tester';
}

// Test examples data
const TEST_EXAMPLES = {
  email: {
    pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
    text: `valid:
test@mail.com
user.name+tag@gmail.com
x@y.co
invalid:
test@.com
@abc.com`,
    description: 'Email validation test cases'
  },
  phone: {
    pattern: '^(\\+91[-]?)?[6-9]\\d{9}$',
    text: `+91-9876543210
9876543210
(202) 555-0145
+1-202-555-0145`,
    description: 'Phone number test cases'
  },
  logs: {
    pattern: '^(INFO|ERROR|WARN)\\s+(\\d{4}-\\d{2}-\\d{2})\\s+(.+)$',
    text: `INFO 2024-12-22 Request success
ERROR 2024-11-01 Fatal crash
WARN 2025-01-02 Retry again`,
    description: 'Log parsing test cases'
  },
  json: {
    pattern: '"([^"]+)":\\s*"([^"]+)"',
    text: `{
 "user":"rakesh",
 "role":"admin",
 "active":true
}`,
    description: 'JSON key extraction test cases'
  },
  html: {
    pattern: '<([a-z]+)[^>]*>([^<]+)</\\1>',
    text: `<div class="user">Rakesh</div>
<span>India</span>
<p>Hello World</p>`,
    description: 'HTML tag extraction test cases'
  },
  url: {
    pattern: 'https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)',
    text: `https://bharatdevtool.com
http://google.com
www.github.com
https://example.com/path?query=value`,
    description: 'URL matching test cases'
  }
};

// Color palette for match groups
const GROUP_COLORS = [
  'rgba(59, 130, 246, 0.3)', // blue
  'rgba(34, 197, 94, 0.3)',  // green
  'rgba(245, 158, 11, 0.3)', // yellow
  'rgba(239, 68, 68, 0.3)',  // red
  'rgba(168, 85, 247, 0.3)', // purple
  'rgba(236, 72, 153, 0.3)', // pink
];

// Application state
let appState = {
  pattern: '',
  text: '',
  flags: {
    caseSensitive: true,
    global: false,
    multiline: false
  },
  flavor: 'javascript',
  isEscaped: false
};

// Load state from localStorage
function loadState() {
  try {
    const saved = localStorage.getItem('regex-tester-state');
    if (saved) {
      const parsed = JSON.parse(saved);
      appState = { ...appState, ...parsed };
      
      // Restore UI
      document.getElementById('regex-pattern').value = appState.pattern || '';
      document.getElementById('test-input').value = appState.text || '';
      document.getElementById('flag-case-sensitive').checked = appState.flags.caseSensitive;
      document.getElementById('flag-global').checked = appState.flags.global;
      document.getElementById('flag-multiline').checked = appState.flags.multiline;
      document.getElementById('regex-flavor').value = appState.flavor;
    }
  } catch (error) {
    Debug.error('Failed to load state:', error);
  }
}

// Save state to localStorage
function saveState() {
  try {
    localStorage.setItem('regex-tester-state', JSON.stringify(appState));
  } catch (error) {
    Debug.error('Failed to save state:', error);
  }
}

// Highlight matches in text
function highlightMatches(text, matches, groups) {
  if (!matches || matches.length === 0) {
    return escapeHtml(text);
  }
  
  // Sort matches by index (reverse to avoid index shifting)
  const sortedMatches = [...matches].sort((a, b) => b.index - a.index);
  
  let result = escapeHtml(text);
  
  // Highlight groups first (they're inside matches)
  groups.forEach((group, idx) => {
    const color = GROUP_COLORS[group.index % GROUP_COLORS.length];
    const startTag = `<span class="regex-group" style="background-color: ${color};">`;
    const endTag = '</span>';
    
    const before = result.substring(0, group.start);
    const match = escapeHtml(group.value);
    const after = result.substring(group.end);
    
    result = before + startTag + match + endTag + after;
  });
  
  // Highlight matches
  sortedMatches.forEach(match => {
    const startTag = '<span class="regex-match">';
    const endTag = '</span>';
    
    const before = result.substring(0, match.index);
    const matchText = escapeHtml(match.match);
    const after = result.substring(match.index + match.length);
    
    result = before + startTag + matchText + endTag + after;
  });
  
  return result;
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Display results
function displayResults(result) {
  const matchCountEl = document.getElementById('match-count');
  const executionTimeEl = document.getElementById('execution-time');
  const patternValidEl = document.getElementById('pattern-valid');
  const highlightedOutputEl = document.getElementById('highlighted-output');
  const matchDetailsEl = document.getElementById('match-details');
  const errorDisplayEl = document.getElementById('error-display');
  
  // Update stats
  matchCountEl.textContent = result.matchCount || 0;
  executionTimeEl.textContent = `${result.executionTime.toFixed(2)}ms`;
  patternValidEl.textContent = result.isValid ? 'Yes' : 'No';
  patternValidEl.className = result.isValid 
    ? 'text-2xl font-bold text-green-600 dark:text-green-400'
    : 'text-2xl font-bold text-red-600 dark:text-red-400';
  
  // Display error/warning/note
  errorDisplayEl.className = 'hidden';
  if (result.error) {
    errorDisplayEl.className = 'regex-error mb-4';
    errorDisplayEl.innerHTML = `<strong>Error:</strong> ${escapeHtml(result.error)}`;
    errorDisplayEl.classList.remove('hidden');
  } else if (result.note) {
    errorDisplayEl.className = 'regex-warning mb-4';
    errorDisplayEl.innerHTML = `<strong>Note:</strong> ${escapeHtml(result.note)}`;
    errorDisplayEl.classList.remove('hidden');
  }
  
  // Check for performance warnings
  if (window.regexEngine && appState.pattern) {
    const backtrackingCheck = window.regexEngine.detectCatastrophicBacktracking(appState.pattern);
    if (backtrackingCheck.hasWarning) {
      const warningEl = document.createElement('div');
      warningEl.className = 'regex-warning mb-4';
      warningEl.innerHTML = `<strong>Performance Warning:</strong><ul class="list-disc list-inside mt-2">${backtrackingCheck.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul>`;
      errorDisplayEl.parentNode.insertBefore(warningEl, errorDisplayEl.nextSibling);
    }
  }
  
  // Highlight matches
  if (result.matches && result.matches.length > 0) {
    highlightedOutputEl.innerHTML = highlightMatches(appState.text, result.matches, result.groups || []);
  } else {
    highlightedOutputEl.textContent = appState.text || 'No matches found';
  }
  
  // Display match details
  if (result.matches && result.matches.length > 0) {
    let detailsHtml = '<div class="space-y-3">';
    result.matches.forEach((match, idx) => {
      detailsHtml += `
        <div class="match-item p-3 bg-white dark:bg-gray-600 rounded border border-gray-200 dark:border-gray-500">
          <div class="font-semibold text-gray-900 dark:text-white mb-2">
            Match ${idx + 1} (index: ${match.index}, length: ${match.length})
          </div>
          <div class="font-mono text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded mb-2">
            ${escapeHtml(match.match)}
          </div>
          ${match.groups && match.groups.length > 0 ? `
            <div class="text-sm text-gray-600 dark:text-gray-300">
              <strong>Groups:</strong>
              <ul class="list-disc list-inside mt-1">
                ${match.groups.map((group, gidx) => `
                  <li>Group ${group.index + 1}: "${escapeHtml(group.value)}" (${group.start}-${group.end})</li>
                `).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      `;
    });
    detailsHtml += '</div>';
    matchDetailsEl.innerHTML = detailsHtml;
  } else {
    matchDetailsEl.innerHTML = '<p class="text-gray-500 dark:text-gray-400">No matches found</p>';
  }
}

// Test regex
function testRegex() {
  const pattern = document.getElementById('regex-pattern').value;
  const text = document.getElementById('test-input').value;
  const flavorEl = document.getElementById('regex-flavor');
  const flavor = flavorEl ? flavorEl.value : 'javascript';
  
  Debug.log('Testing regex:', { pattern, text, flavor });
  
  appState.pattern = pattern;
  appState.text = text;
  appState.flavor = flavor;
  saveState();
  
  if (!pattern || pattern.trim().length === 0) {
    // Show empty state
    displayResults({
      matches: [],
      matchCount: 0,
      groups: [],
      executionTime: 0,
      error: null,
      isValid: false
    });
    trackValidationError({
      operation: 'test_regex',
      error_type: 'empty_pattern',
      page: getCurrentPageNameForAnalytics()
    });
    return;
  }
  
  trackRegexEvent('test_regex', {
    pattern_length: pattern.length,
    text_length: text.length,
    flavor: flavor
  });
  
  if (window.regexEngine) {
    const flags = {
      caseSensitive: document.getElementById('flag-case-sensitive').checked,
      global: document.getElementById('flag-global').checked,
      multiline: document.getElementById('flag-multiline').checked
    };
    
    appState.flags = flags;
    saveState();
    
    try {
      const result = window.regexEngine.testRegex(pattern, text, flags, flavor);
      Debug.log('Regex test result:', result);
      displayResults(result);
    } catch (error) {
      Debug.error('Error testing regex:', error);
      displayResults({
        matches: [],
        matchCount: 0,
        groups: [],
        executionTime: 0,
        error: `Error: ${error.message}`,
        isValid: false
      });
    }
  } else {
    Debug.error('regexEngine not available');
    displayResults({
      matches: [],
      matchCount: 0,
      groups: [],
      executionTime: 0,
      error: 'Regex engine not loaded. Please refresh the page.',
      isValid: false
    });
  }
}

// Initialize event listeners
function initEventListeners() {
  // Test button
  document.getElementById('test-regex-btn').addEventListener('click', testRegex);
  
  // Auto-test on input change (debounced)
  let testTimeout;
  document.getElementById('regex-pattern').addEventListener('input', () => {
    clearTimeout(testTimeout);
    testTimeout = setTimeout(testRegex, 500);
  });
  
  document.getElementById('test-input').addEventListener('input', () => {
    clearTimeout(testTimeout);
    testTimeout = setTimeout(testRegex, 500);
  });
  
  // Flag toggles
  ['flag-case-sensitive', 'flag-global', 'flag-multiline'].forEach(id => {
    document.getElementById(id).addEventListener('change', testRegex);
  });
  
  // Flavor selector
  document.getElementById('regex-flavor').addEventListener('change', testRegex);
  
  // Escape toggle
  document.getElementById('escape-toggle').addEventListener('click', () => {
    const patternEl = document.getElementById('regex-pattern');
    const currentPattern = patternEl.value;
    
    if (window.regexEngine) {
      if (appState.isEscaped) {
        patternEl.value = window.regexEngine.unescapeRegex(currentPattern);
        appState.isEscaped = false;
      } else {
        patternEl.value = window.regexEngine.escapeRegex(currentPattern);
        appState.isEscaped = true;
      }
      appState.pattern = patternEl.value;
      saveState();
      testRegex();
    }
  });
  
  // Format button
  document.getElementById('format-regex-btn').addEventListener('click', () => {
    const patternEl = document.getElementById('regex-pattern');
    if (window.regexEngine) {
      patternEl.value = window.regexEngine.formatRegexPattern(patternEl.value);
      appState.pattern = patternEl.value;
      saveState();
      testRegex();
    }
  });
  
  // Explain button
  document.getElementById('explain-regex-btn').addEventListener('click', () => {
    const patternEl = document.getElementById('regex-pattern');
    if (window.regexEngine) {
      const explanation = window.regexEngine.explainRegexPattern(patternEl.value);
      alert(explanation);
    }
  });
  
  // Syntax help button
  document.getElementById('syntax-help-btn').addEventListener('click', () => {
    document.getElementById('syntax-help-panel').classList.remove('hidden');
  });
  
  document.getElementById('close-syntax-help').addEventListener('click', () => {
    document.getElementById('syntax-help-panel').classList.add('hidden');
  });
  
  // Test examples button
  document.getElementById('test-examples-btn').addEventListener('click', () => {
    const examples = Object.keys(TEST_EXAMPLES);
    const selected = prompt(`Select example:\n${examples.map((e, i) => `${i + 1}. ${e}`).join('\n')}\n\nEnter number (1-${examples.length}):`);
    
    if (selected) {
      const index = parseInt(selected) - 1;
      if (index >= 0 && index < examples.length) {
        const exampleKey = examples[index];
        const example = TEST_EXAMPLES[exampleKey];
        
        document.getElementById('regex-pattern').value = example.pattern;
        document.getElementById('test-input').value = example.text;
        
        appState.pattern = example.pattern;
        appState.text = example.text;
        saveState();
        
        testRegex();
        
        trackRegexEvent('load_test_example', {
          example_type: exampleKey
        });
      }
    }
  });
  
  // Clear input button
  document.getElementById('clear-input-btn').addEventListener('click', () => {
    document.getElementById('test-input').value = '';
    appState.text = '';
    saveState();
    testRegex();
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to test
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      testRegex();
    }
    
    // Escape to close syntax help
    if (e.key === 'Escape') {
      document.getElementById('syntax-help-panel').classList.add('hidden');
    }
  });
}

// Track validation errors
function trackValidationError(context) {
  if (typeof window.Analytics !== 'undefined') {
    window.Analytics.track('validation_error', {
      ...context,
      user_agent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`
    });
  }
}

// Initialize app
function initApp() {
  loadState();
  initEventListeners();
  
  // Check for URL parameter to pre-fill pattern
  const urlParams = new URLSearchParams(window.location.search);
  const patternParam = urlParams.get('pattern');
  if (patternParam) {
    document.getElementById('regex-pattern').value = decodeURIComponent(patternParam);
    appState.pattern = decodeURIComponent(patternParam);
    saveState();
    testRegex();
  } else if (appState.pattern) {
    // Auto-test if pattern exists in saved state
    testRegex();
  }
  
  trackRegexEvent('page_view');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

