// curl-comparison-app.js - cURL Comparison Application Logic
// Bharat Dev Tools - cURL Comparison Tool

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

// Get current page name for analytics
function getCurrentPageNameForAnalytics() {
  if (typeof window.getCurrentPageNameForAnalytics === 'function') {
    return window.getCurrentPageNameForAnalytics();
  }
  return 'cURL Comparison';
}

// Track analytics events
function trackComparisonEvent(eventName, context = {}) {
  if (typeof window.Analytics !== 'undefined') {
    window.Analytics.track(eventName, {
      ...context,
      page: getCurrentPageNameForAnalytics(),
      timestamp: Date.now()
    });
  }
}

function trackComparisonError(errorType, context = {}) {
  const errorContext = {
    error_type: errorType,
    error_message: context.error_message || '',
    input_length: context.input_length || 0,
    input_preview: context.input_preview || '',
    page: getCurrentPageNameForAnalytics(),
    timestamp: Date.now(),
    user_agent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    ...context
  };
  
  trackComparisonEvent('comparison_error', errorContext);
  
  if (typeof Sentry !== 'undefined') {
    Sentry.captureException(new Error(errorType), {
      tags: { operation: 'curl_comparison', error_type: errorType },
      extra: errorContext
    });
  }
}

// UI Freeze Detection Utility
function detectUIFreeze(operationName, operationFunction) {
  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    let lastCheckTime = startTime;
    let maxFreezeDuration = 0;
    
    function checkFreeze() {
      const currentTime = performance.now();
      const timeSinceLastCheck = currentTime - lastCheckTime;
      
      if (timeSinceLastCheck > 100) {
        const freezeDuration = timeSinceLastCheck;
        maxFreezeDuration = Math.max(maxFreezeDuration, freezeDuration);
        
        if (typeof window.Analytics !== 'undefined') {
          window.Analytics.track('ui_freeze', {
            operation: operationName,
            freeze_duration_ms: freezeDuration,
            page: getCurrentPageNameForAnalytics(),
            timestamp: currentTime,
            severity: freezeDuration > 500 ? 'high' : 'medium'
          });
        }
        
        if (typeof Sentry !== 'undefined') {
          Sentry.addBreadcrumb({
            message: 'UI freeze detected',
            category: 'performance',
            level: 'warning',
            data: {
              operation: operationName,
              freezeDuration: freezeDuration,
              page: getCurrentPageNameForAnalytics()
            }
          });
        }
      }
      
      lastCheckTime = currentTime;
    }
    
    const checkInterval = setInterval(checkFreeze, 50);
    
    try {
      const result = operationFunction();
      
      if (result instanceof Promise) {
        result.then((data) => {
          clearInterval(checkInterval);
          const totalTime = performance.now() - startTime;
          
          if (maxFreezeDuration > 0 && typeof window.Analytics !== 'undefined') {
            window.Analytics.track('operation_complete', {
              operation: operationName,
              total_time_ms: totalTime,
              max_freeze_duration_ms: maxFreezeDuration,
              page: getCurrentPageNameForAnalytics()
            });
          }
          
          resolve(data);
        }).catch((error) => {
          clearInterval(checkInterval);
          reject(error);
        });
      } else {
        clearInterval(checkInterval);
        const totalTime = performance.now() - startTime;
        
        if (maxFreezeDuration > 0 && typeof window.Analytics !== 'undefined') {
          window.Analytics.track('operation_complete', {
            operation: operationName,
            total_time_ms: totalTime,
            max_freeze_duration_ms: maxFreezeDuration,
            page: getCurrentPageNameForAnalytics()
          });
        }
        
        resolve(result);
      }
    } catch (error) {
      clearInterval(checkInterval);
      reject(error);
    }
  });
}

// Parse cURL command (reused from curl-tester-app.js)
function parseCurl(curlCommand) {
  const result = {
    method: 'GET',
    url: '',
    headers: {},
    body: null,
    queryParams: {}
  };
  
  // Remove 'curl' prefix if present
  let command = curlCommand.trim();
  if (command.toLowerCase().startsWith('curl')) {
    command = command.substring(4).trim();
  }
  
  // Extract method (-X or --request)
  const methodMatch = command.match(/-X\s+(\w+)|--request\s+(\w+)/i);
  if (methodMatch) {
    result.method = (methodMatch[1] || methodMatch[2]).toUpperCase();
  }
  
  // Extract headers (-H or --header)
  const headerRegex = /-H\s+['"]([^'"]+)['"]|--header\s+['"]([^'"]+)['"]/gi;
  let headerMatch;
  while ((headerMatch = headerRegex.exec(command)) !== null) {
    const headerStr = headerMatch[1] || headerMatch[2];
    const colonIndex = headerStr.indexOf(':');
    if (colonIndex > 0) {
      const key = headerStr.substring(0, colonIndex).trim();
      const value = headerStr.substring(colonIndex + 1).trim();
      result.headers[key] = value;
    }
  }
  
  // Extract data/body (-d or --data or --data-raw or --data-binary)
  const dataMatch = command.match(/-d\s+['"]([^'"]+)['"]|--data\s+['"]([^'"]+)['"]|--data-raw\s+['"]([^'"]+)['"]|--data-binary\s+['"]([^'"]+)['"]/i);
  if (dataMatch) {
    result.body = dataMatch[1] || dataMatch[2] || dataMatch[3] || dataMatch[4];
    // If method wasn't specified and body exists, default to POST
    if (!methodMatch) {
      result.method = 'POST';
    }
  }
  
  // Extract URL (usually the last argument that looks like a URL)
  const urlMatch = command.match(/(https?:\/\/[^\s'"]+)/i);
  if (urlMatch) {
    result.url = urlMatch[1];
  } else {
    // Try to find URL without protocol
    const urlMatch2 = command.match(/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s'"]*)/);
    if (urlMatch2) {
      result.url = 'https://' + urlMatch2[1];
    }
  }
  
  // Extract query parameters from URL
  if (result.url) {
    try {
      const urlObj = new URL(result.url);
      urlObj.searchParams.forEach((value, key) => {
        result.queryParams[key] = value;
      });
    } catch (e) {
      Debug.error('Failed to parse URL:', e);
    }
  }
  
  if (!result.url) {
    throw new Error('Could not find URL in cURL command');
  }
  
  return result;
}

// Application state
let parsedA = null;
let parsedB = null;
let comparisonResult = null;
let isStructuredView = true;
let isSideBySideDiff = false;

// Initialize application
function initApp() {
  initEventListeners();
  initAdvancedToggle();
  initFAQToggle();
}

// Initialize event listeners
function initEventListeners() {
  document.getElementById('compare-btn').addEventListener('click', compareCurlsHandler);
  document.getElementById('reset-btn').addEventListener('click', resetComparisonHandler);
  document.getElementById('swap-btn').addEventListener('click', swapCurlsHandler);
  document.getElementById('clear-a-btn').addEventListener('click', () => clearInput('a'));
  document.getElementById('clear-b-btn').addEventListener('click', () => clearInput('b'));
  document.getElementById('toggle-parsed-view').addEventListener('click', toggleParsedViewHandler);
  document.getElementById('toggle-diff-view').addEventListener('click', toggleDiffViewHandler);
}

// Initialize advanced toggle
function initAdvancedToggle() {
  const toggle = document.getElementById('advanced-toggle');
  const options = document.getElementById('advanced-options');
  
  toggle.addEventListener('click', () => {
    const isHidden = options.classList.contains('hidden');
    options.classList.toggle('hidden');
    toggle.querySelector('span').textContent = isHidden ? '▲' : '▼';
  });
}

// Initialize FAQ toggle
function initFAQToggle() {
  const faqQuestions = document.querySelectorAll('.faq-question');
  
  faqQuestions.forEach(question => {
    question.addEventListener('click', function() {
      const isExpanded = this.getAttribute('aria-expanded') === 'true';
      const faqItem = this.closest('.faq-item');
      const answer = faqItem.querySelector('.faq-answer');
      const icon = this.querySelector('.faq-icon');
      
      // Close all other FAQ items
      faqQuestions.forEach(q => {
        if (q !== this) {
          q.setAttribute('aria-expanded', 'false');
          const item = q.closest('.faq-item');
          const ans = item.querySelector('.faq-answer');
          const ic = q.querySelector('.faq-icon');
          if (item) item.classList.remove('active');
          if (ans) ans.classList.add('hidden');
          if (ic) ic.textContent = '+';
        }
      });
      
      // Toggle current item
      if (isExpanded) {
        this.setAttribute('aria-expanded', 'false');
        if (faqItem) faqItem.classList.remove('active');
        if (answer) answer.classList.add('hidden');
        if (icon) icon.textContent = '+';
      } else {
        this.setAttribute('aria-expanded', 'true');
        if (faqItem) faqItem.classList.add('active');
        if (answer) answer.classList.remove('hidden');
        if (icon) icon.textContent = '−';
      }
    });
  });
}


// Clear input
function clearInput(side) {
  document.getElementById(`curl-${side}-input`).value = '';
  trackComparisonEvent('clear_input', { side });
}

// Swap cURLs handler
function swapCurlsHandler() {
  const inputA = document.getElementById('curl-a-input');
  const inputB = document.getElementById('curl-b-input');
  const temp = inputA.value;
  inputA.value = inputB.value;
  inputB.value = temp;
  trackComparisonEvent('swap_curls');
}

// Toggle parsed view handler
function toggleParsedViewHandler() {
  isStructuredView = !isStructuredView;
  if (parsedA && parsedB) {
    displayParsedView();
  }
}

// Toggle diff view handler
function toggleDiffViewHandler() {
  isSideBySideDiff = !isSideBySideDiff;
  if (comparisonResult) {
    displayDiffResults();
  }
}

// Compare cURLs handler
function compareCurlsHandler() {
  const curlA = document.getElementById('curl-a-input').value.trim();
  const curlB = document.getElementById('curl-b-input').value.trim();
  
  if (!curlA || !curlB) {
    showError('Please enter both cURL commands');
    trackComparisonError('missing_input', {
      has_a: !!curlA,
      has_b: !!curlB
    });
    return;
  }
  
  detectUIFreeze('compare_curls', () => {
    try {
      parsedA = parseCurl(curlA);
      parsedB = parseCurl(curlB);
      
      const options = getAdvancedOptions();
      comparisonResult = compareParsedCurls(parsedA, parsedB, options);
      
      displayParsedView();
      displayDiffResults();
      displaySummary();
      
      document.getElementById('parsed-view-container').classList.remove('hidden');
      document.getElementById('diff-result-container').classList.remove('hidden');
      
      trackComparisonEvent('compare_success', {
        method_a: parsedA.method,
        method_b: parsedB.method,
        has_body_a: !!parsedA.body,
        has_body_b: !!parsedB.body,
        diff_count: comparisonResult.totalDifferences
      });
    } catch (error) {
      showError(`Failed to compare: ${error.message}`);
      trackComparisonError('compare_failed', {
        error_message: error.message,
        input_length_a: curlA.length,
        input_length_b: curlB.length,
        input_preview_a: curlA.substring(0, 100),
        input_preview_b: curlB.substring(0, 100)
      });
    }
  }).catch((error) => {
    Debug.error('Compare error:', error);
  });
}

// Get advanced options
function getAdvancedOptions() {
  return {
    ignoreHeaders: document.getElementById('ignore-headers').value.split(',').map(s => s.trim()).filter(s => s),
    ignoreQueryParams: document.getElementById('ignore-query-params').value.split(',').map(s => s.trim()).filter(s => s),
    ignoreJsonKeys: document.getElementById('ignore-json-keys').value.split(',').map(s => s.trim()).filter(s => s),
    ignoreOrder: document.getElementById('ignore-order').checked,
    trimWhitespace: document.getElementById('trim-whitespace').checked,
    caseInsensitive: document.getElementById('case-insensitive').checked,
    normalizeUrls: document.getElementById('normalize-urls').checked,
    decodeUrlEncoding: document.getElementById('decode-url-encoding').checked
  };
}

// Compare parsed cURLs
function compareParsedCurls(parsedA, parsedB, options) {
  const result = {
    method: compareMethod(parsedA.method, parsedB.method),
    url: compareUrl(parsedA.url, parsedB.url, options),
    headers: compareHeaders(parsedA.headers, parsedB.headers, options),
    queryParams: compareQueryParams(parsedA.queryParams, parsedB.queryParams, options),
    body: compareBody(parsedA.body, parsedB.body, options),
    totalDifferences: 0
  };
  
  // Count total differences
  if (!result.method.same) result.totalDifferences++;
  if (!result.url.same) result.totalDifferences++;
  if (result.headers.differences.length > 0 || result.headers.missing.length > 0 || result.headers.extra.length > 0) {
    result.totalDifferences += result.headers.differences.length + result.headers.missing.length + result.headers.extra.length;
  }
  if (result.queryParams.differences.length > 0 || result.queryParams.missing.length > 0 || result.queryParams.extra.length > 0) {
    result.totalDifferences += result.queryParams.differences.length + result.queryParams.missing.length + result.queryParams.extra.length;
  }
  if (!result.body.same) result.totalDifferences++;
  
  return result;
}

// Compare method
function compareMethod(methodA, methodB) {
  return {
    a: methodA,
    b: methodB,
    same: methodA === methodB
  };
}

// Compare URL
function compareUrl(urlA, urlB, options = {}) {
  let a = urlA;
  let b = urlB;
  
  if (options.normalizeUrls) {
    a = a.replace(/\/$/, '');
    b = b.replace(/\/$/, '');
  }
  
  if (options.decodeUrlEncoding) {
    try {
      a = decodeURIComponent(a);
      b = decodeURIComponent(b);
    } catch (e) {
      Debug.error('Failed to decode URL:', e);
      // Continue with original URLs if decoding fails
    }
  }
  
  return {
    a: urlA,
    b: urlB,
    normalizedA: a,
    normalizedB: b,
    same: a === b
  };
}

// Compare headers
function compareHeaders(headersA, headersB, options = {}) {
  const differences = [];
  const missing = [];
  const extra = [];
  const same = [];
  
  const normalizedA = {};
  const normalizedB = {};
  
  // Ensure options have defaults
  const ignoreHeaders = options.ignoreHeaders || [];
  const caseInsensitive = options.caseInsensitive || false;
  const trimWhitespace = options.trimWhitespace || false;
  
  // Normalize headers
  Object.entries(headersA).forEach(([key, value]) => {
    const normalizedKey = caseInsensitive ? key.toLowerCase() : key;
    if (!ignoreHeaders.includes(normalizedKey) && !ignoreHeaders.includes(key)) {
      normalizedA[normalizedKey] = {
        originalKey: key,
        value: trimWhitespace ? value.trim() : value
      };
    }
  });
  
  Object.entries(headersB).forEach(([key, value]) => {
    const normalizedKey = caseInsensitive ? key.toLowerCase() : key;
    if (!ignoreHeaders.includes(normalizedKey) && !ignoreHeaders.includes(key)) {
      normalizedB[normalizedKey] = {
        originalKey: key,
        value: trimWhitespace ? value.trim() : value
      };
    }
  });
  
  // Compare headers
  const allKeys = new Set([...Object.keys(normalizedA), ...Object.keys(normalizedB)]);
  
  allKeys.forEach(key => {
    const headerA = normalizedA[key];
    const headerB = normalizedB[key];
    
    if (!headerA) {
      extra.push({ key: headerB.originalKey, value: headerB.value });
    } else if (!headerB) {
      missing.push({ key: headerA.originalKey, value: headerA.value });
    } else if (headerA.value !== headerB.value) {
      differences.push({
        key: headerA.originalKey,
        valueA: headerA.value,
        valueB: headerB.value
      });
    } else {
      same.push({ key: headerA.originalKey, value: headerA.value });
    }
  });
  
  return { differences, missing, extra, same };
}

// Compare query parameters
function compareQueryParams(paramsA, paramsB, options = {}) {
  const differences = [];
  const missing = [];
  const extra = [];
  const same = [];
  
  const normalizedA = {};
  const normalizedB = {};
  
  // Ensure options have defaults
  const ignoreQueryParams = options.ignoreQueryParams || [];
  const caseInsensitive = options.caseInsensitive || false;
  const trimWhitespace = options.trimWhitespace || false;
  
  // Normalize params
  Object.entries(paramsA).forEach(([key, value]) => {
    const normalizedKey = caseInsensitive ? key.toLowerCase() : key;
    if (!ignoreQueryParams.includes(normalizedKey) && !ignoreQueryParams.includes(key)) {
      normalizedA[normalizedKey] = {
        originalKey: key,
        value: trimWhitespace ? value.trim() : value
      };
    }
  });
  
  Object.entries(paramsB).forEach(([key, value]) => {
    const normalizedKey = caseInsensitive ? key.toLowerCase() : key;
    if (!ignoreQueryParams.includes(normalizedKey) && !ignoreQueryParams.includes(key)) {
      normalizedB[normalizedKey] = {
        originalKey: key,
        value: trimWhitespace ? value.trim() : value
      };
    }
  });
  
  // Compare params
  const allKeys = new Set([...Object.keys(normalizedA), ...Object.keys(normalizedB)]);
  
  allKeys.forEach(key => {
    const paramA = normalizedA[key];
    const paramB = normalizedB[key];
    
    if (!paramA) {
      extra.push({ key: paramB.originalKey, value: paramB.value });
    } else if (!paramB) {
      missing.push({ key: paramA.originalKey, value: paramA.value });
    } else if (paramA.value !== paramB.value) {
      differences.push({
        key: paramA.originalKey,
        valueA: paramA.value,
        valueB: paramB.value
      });
    } else {
      same.push({ key: paramA.originalKey, value: paramA.value });
    }
  });
  
  return { differences, missing, extra, same };
}

// Compare body
function compareBody(bodyA, bodyB, options = {}) {
  if (!bodyA && !bodyB) {
    return { same: true, type: 'empty' };
  }
  
  if (!bodyA || !bodyB) {
    return {
      same: false,
      type: 'missing',
      a: bodyA || null,
      b: bodyB || null
    };
  }
  
  const trimWhitespace = options.trimWhitespace || false;
  let normalizedA = trimWhitespace ? bodyA.trim() : bodyA;
  let normalizedB = trimWhitespace ? bodyB.trim() : bodyB;
  
  // Try to parse as JSON
  let jsonA = null;
  let jsonB = null;
  
  try {
    jsonA = JSON.parse(normalizedA);
    jsonB = JSON.parse(normalizedB);
  } catch (e) {
    // Not JSON, compare as text
    return {
      same: normalizedA === normalizedB,
      type: 'text',
      a: normalizedA,
      b: normalizedB,
      diff: computeTextDiff(normalizedA, normalizedB)
    };
  }
  
  // Compare as JSON
  const jsonDiff = compareJson(jsonA, jsonB, options);
  
  return {
    same: jsonDiff.same,
    type: 'json',
    a: jsonA,
    b: jsonB,
    diff: jsonDiff
  };
}

// Compare JSON objects
function compareJson(objA, objB, options = {}, path = '') {
  const differences = [];
  const missing = [];
  const extra = [];
  let same = true;
  
  if (typeof objA !== typeof objB) {
    return {
      same: false,
      differences: [{ path, typeA: typeof objA, typeB: typeof objB, valueA: objA, valueB: objB }],
      missing: [],
      extra: []
    };
  }
  
  // Handle null, primitives, and arrays
  if (objA === null || objB === null || typeof objA !== 'object' || Array.isArray(objA) || Array.isArray(objB)) {
    if (JSON.stringify(objA) !== JSON.stringify(objB)) {
      return {
        same: false,
        differences: [{ path, valueA: objA, valueB: objB }],
        missing: [],
        extra: []
      };
    }
    return { same: true, differences: [], missing: [], extra: [] };
  }
  
  // Handle objects (not arrays)
  const ignoreJsonKeys = options.ignoreJsonKeys || [];
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  const allKeys = new Set([...keysA, ...keysB]);
  
  allKeys.forEach(key => {
    const currentPath = path ? `${path}.${key}` : key;
    const shouldIgnore = ignoreJsonKeys.some(ignoreKey => 
      currentPath.includes(ignoreKey) || key === ignoreKey
    );
    
    if (shouldIgnore) {
      return;
    }
    
    if (!(key in objA)) {
      extra.push({ path: currentPath, value: objB[key] });
      same = false;
    } else if (!(key in objB)) {
      missing.push({ path: currentPath, value: objA[key] });
      same = false;
    } else {
      const nestedResult = compareJson(objA[key], objB[key], options, currentPath);
      if (!nestedResult.same) {
        differences.push(...nestedResult.differences);
        missing.push(...nestedResult.missing);
        extra.push(...nestedResult.extra);
        same = false;
      }
    }
  });
  
  return { same, differences, missing, extra };
}

// Compute text diff
function computeTextDiff(textA, textB) {
  const linesA = textA.split('\n');
  const linesB = textB.split('\n');
  const diff = [];
  
  const maxLines = Math.max(linesA.length, linesB.length);
  
  for (let i = 0; i < maxLines; i++) {
    const lineA = linesA[i];
    const lineB = linesB[i];
    
    if (lineA === undefined) {
      diff.push({ type: 'added', line: lineB, lineNum: i + 1 });
    } else if (lineB === undefined) {
      diff.push({ type: 'removed', line: lineA, lineNum: i + 1 });
    } else if (lineA !== lineB) {
      diff.push({ type: 'modified', lineA, lineB, lineNum: i + 1 });
    } else {
      diff.push({ type: 'same', line: lineA, lineNum: i + 1 });
    }
  }
  
  return diff;
}

// Display parsed view
function displayParsedView() {
  if (!parsedA || !parsedB) return;
  
  const displayA = document.getElementById('parsed-a-display');
  const displayB = document.getElementById('parsed-b-display');
  
  if (isStructuredView) {
    displayA.innerHTML = formatParsedCurlStructured(parsedA);
    displayB.innerHTML = formatParsedCurlStructured(parsedB);
  } else {
    displayA.innerHTML = escapeHtml(document.getElementById('curl-a-input').value);
    displayB.innerHTML = escapeHtml(document.getElementById('curl-b-input').value);
  }
}

// Format parsed cURL as structured view
function formatParsedCurlStructured(parsed) {
  let html = '';
  
  html += `<span class="curl-method">${parsed.method}</span> `;
  html += `<span class="curl-url">${escapeHtml(parsed.url)}</span>\n\n`;
  
  if (Object.keys(parsed.headers).length > 0) {
    html += '<span class="curl-header">Headers:</span>\n';
    Object.entries(parsed.headers).forEach(([key, value]) => {
      html += `  <span class="curl-header">${escapeHtml(key)}</span>: ${escapeHtml(value)}\n`;
    });
    html += '\n';
  }
  
  if (Object.keys(parsed.queryParams).length > 0) {
    html += '<span class="curl-query">Query Params:</span>\n';
    Object.entries(parsed.queryParams).forEach(([key, value]) => {
      html += `  <span class="curl-query">${escapeHtml(key)}</span>=${escapeHtml(value)}\n`;
    });
    html += '\n';
  }
  
  if (parsed.body) {
    html += `<span class="curl-body">Body:</span>\n`;
    html += `  ${escapeHtml(parsed.body)}\n`;
  }
  
  return html;
}

// Display summary
function displaySummary() {
  if (!comparisonResult) return;
  
  const summaryPanel = document.getElementById('summary-panel');
  const summaryContent = document.getElementById('summary-content');
  
  if (comparisonResult.totalDifferences === 0) {
    summaryPanel.className = 'mb-6 p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20';
    summaryContent.innerHTML = '<span class="text-green-600 dark:text-green-400 font-semibold">✅ No differences found. Both cURL commands are identical.</span>';
  } else {
    summaryPanel.className = 'mb-6 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50';
    const items = [];
    
    if (!comparisonResult.method.same) {
      items.push('Method differs');
    }
    if (!comparisonResult.url.same) {
      items.push('URL differs');
    }
    if (comparisonResult.headers.differences.length > 0 || comparisonResult.headers.missing.length > 0 || comparisonResult.headers.extra.length > 0) {
      items.push(`${comparisonResult.headers.differences.length + comparisonResult.headers.missing.length + comparisonResult.headers.extra.length} header difference(s)`);
    }
    if (comparisonResult.queryParams.differences.length > 0 || comparisonResult.queryParams.missing.length > 0 || comparisonResult.queryParams.extra.length > 0) {
      items.push(`${comparisonResult.queryParams.differences.length + comparisonResult.queryParams.missing.length + comparisonResult.queryParams.extra.length} query param difference(s)`);
    }
    if (!comparisonResult.body.same) {
      items.push('Body differs');
    }
    
    summaryContent.innerHTML = `<span class="text-red-600 dark:text-red-400 font-semibold">❌ ${escapeHtml(String(comparisonResult.totalDifferences))} difference(s) found:</span><ul class="mt-2 list-disc list-inside text-gray-700 dark:text-gray-300">${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  }
}

// Display diff results
function displayDiffResults() {
  if (!comparisonResult) return;
  
  displayMethodDiff();
  displayUrlDiff();
  displayHeadersDiff();
  displayBodyDiff();
}

// Display method diff
function displayMethodDiff() {
  const section = document.getElementById('method-diff-section');
  const result = comparisonResult.method;
  
  let html = '<h3 class="text-md font-semibold text-gray-900 dark:text-white mb-2">✅ Method</h3>';
  
  if (result.same) {
    html += `<div class="diff-same p-3 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">`;
    html += `<span class="text-green-700 dark:text-green-300">Same: ${escapeHtml(result.a)}</span>`;
    html += `</div>`;
  } else {
    html += `<div class="diff-different p-3 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">`;
    html += `<div class="grid grid-cols-2 gap-4">`;
    html += `<div><strong class="text-gray-700 dark:text-gray-300">A:</strong> <span class="text-red-700 dark:text-red-300">${escapeHtml(result.a)}</span></div>`;
    html += `<div><strong class="text-gray-700 dark:text-gray-300">B:</strong> <span class="text-red-700 dark:text-red-300">${escapeHtml(result.b)}</span></div>`;
    html += `</div></div>`;
  }
  
  section.innerHTML = html;
}

// Display URL diff
function displayUrlDiff() {
  const section = document.getElementById('url-diff-section');
  const result = comparisonResult.url;
  
  let html = '<h3 class="text-md font-semibold text-gray-900 dark:text-white mb-2">🌐 URL</h3>';
  
  if (result.same) {
    html += `<div class="diff-same p-3 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">`;
    html += `<span class="text-green-700 dark:text-green-300">Same: ${escapeHtml(result.a)}</span>`;
    html += `</div>`;
  } else {
    html += `<div class="diff-different p-3 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">`;
    html += `<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">`;
    html += `<div><strong class="text-gray-700 dark:text-gray-300">A:</strong> <span class="text-red-700 dark:text-red-300 font-mono text-sm">${escapeHtml(result.a)}</span></div>`;
    html += `<div><strong class="text-gray-700 dark:text-gray-300">B:</strong> <span class="text-red-700 dark:text-red-300 font-mono text-sm">${escapeHtml(result.b)}</span></div>`;
    html += `</div></div>`;
  }
  
  section.innerHTML = html;
}

// Display headers diff
function displayHeadersDiff() {
  const section = document.getElementById('headers-diff-section');
  const result = comparisonResult.headers;
  
  let html = '<h3 class="text-md font-semibold text-gray-900 dark:text-white mb-2">🧾 Headers</h3>';
  
  if (result.differences.length === 0 && result.missing.length === 0 && result.extra.length === 0) {
    html += `<div class="diff-same p-3 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">`;
    html += `<span class="text-green-700 dark:text-green-300">All headers match</span>`;
    html += `</div>`;
  } else {
    html += `<div class="overflow-x-auto"><table class="min-w-full border-collapse border border-gray-300 dark:border-gray-600">`;
    html += `<thead><tr class="bg-gray-100 dark:bg-gray-700">`;
    html += `<th class="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Header</th>`;
    html += `<th class="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">A</th>`;
    html += `<th class="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">B</th>`;
    html += `<th class="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>`;
    html += `</tr></thead><tbody>`;
    
    // Show same headers
    result.same.forEach(header => {
      html += `<tr>`;
      html += `<td class="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-mono">${escapeHtml(header.key)}</td>`;
      html += `<td class="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm">${escapeHtml(header.value)}</td>`;
      html += `<td class="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm">${escapeHtml(header.value)}</td>`;
      html += `<td class="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center"><span class="text-green-600 dark:text-green-400">✅</span></td>`;
      html += `</tr>`;
    });
    
    // Show differences
    result.differences.forEach(header => {
      html += `<tr class="bg-red-50 dark:bg-red-900/20">`;
      html += `<td class="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-mono">${escapeHtml(header.key)}</td>`;
      html += `<td class="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-red-700 dark:text-red-300">${escapeHtml(header.valueA)}</td>`;
      html += `<td class="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-red-700 dark:text-red-300">${escapeHtml(header.valueB)}</td>`;
      html += `<td class="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center"><span class="text-red-600 dark:text-red-400">❌</span></td>`;
      html += `</tr>`;
    });
    
    // Show missing (only in A)
    result.missing.forEach(header => {
      html += `<tr class="bg-yellow-50 dark:bg-yellow-900/20">`;
      html += `<td class="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-mono">${escapeHtml(header.key)}</td>`;
      html += `<td class="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-yellow-700 dark:text-yellow-300">${escapeHtml(header.value)}</td>`;
      html += `<td class="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-400">—</td>`;
      html += `<td class="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center"><span class="text-yellow-600 dark:text-yellow-400">➖</span></td>`;
      html += `</tr>`;
    });
    
    // Show extra (only in B)
    result.extra.forEach(header => {
      html += `<tr class="bg-blue-50 dark:bg-blue-900/20">`;
      html += `<td class="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-mono">${escapeHtml(header.key)}</td>`;
      html += `<td class="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-400">—</td>`;
      html += `<td class="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-blue-700 dark:text-blue-300">${escapeHtml(header.value)}</td>`;
      html += `<td class="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center"><span class="text-blue-600 dark:text-blue-400">➕</span></td>`;
      html += `</tr>`;
    });
    
    html += `</tbody></table></div>`;
  }
  
  section.innerHTML = html;
}

// Display body diff
function displayBodyDiff() {
  const section = document.getElementById('body-diff-section');
  const result = comparisonResult.body;
  
  let html = '<h3 class="text-md font-semibold text-gray-900 dark:text-white mb-2">📦 Body</h3>';
  
  if (result.type === 'empty') {
    html += `<div class="diff-same p-3 rounded bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">`;
    html += `<span class="text-gray-600 dark:text-gray-400">Both commands have no body</span>`;
    html += `</div>`;
  } else if (result.type === 'missing') {
    html += `<div class="diff-different p-3 rounded bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">`;
    html += `<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">`;
    html += `<div><strong class="text-gray-700 dark:text-gray-300">A:</strong> <span class="text-yellow-700 dark:text-yellow-300">${result.a ? escapeHtml(result.a.substring(0, 100)) + '...' : 'No body'}</span></div>`;
    html += `<div><strong class="text-gray-700 dark:text-gray-300">B:</strong> <span class="text-yellow-700 dark:text-yellow-300">${result.b ? escapeHtml(result.b.substring(0, 100)) + '...' : 'No body'}</span></div>`;
    html += `</div></div>`;
  } else if (result.type === 'json') {
    if (result.same) {
      html += `<div class="diff-same p-3 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">`;
      html += `<span class="text-green-700 dark:text-green-300">JSON bodies are identical</span>`;
      html += `<pre class="mt-2 text-xs overflow-x-auto">${escapeHtml(JSON.stringify(result.a, null, 2))}</pre>`;
      html += `</div>`;
    } else {
      html += `<div class="diff-different p-3 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">`;
      html += `<div class="mb-2 text-sm text-red-700 dark:text-red-300">JSON bodies differ</div>`;
      
      if (result.diff.differences.length > 0) {
        html += `<div class="mb-2"><strong class="text-gray-700 dark:text-gray-300">Changed values:</strong></div>`;
        result.diff.differences.forEach(diff => {
      html += `<div class="text-xs mb-1 ml-4">`;
      html += `<span class="font-mono text-gray-700 dark:text-gray-300">${escapeHtml(diff.path)}</span>: `;
      html += `<span class="text-red-600 dark:text-red-400">${escapeHtml(JSON.stringify(diff.valueA))}</span> → `;
      html += `<span class="text-red-600 dark:text-red-400">${escapeHtml(JSON.stringify(diff.valueB))}</span>`;
      html += `</div>`;
        });
      }
      
      if (result.diff.missing.length > 0) {
        html += `<div class="mb-2"><strong class="text-gray-700 dark:text-gray-300">Missing in B:</strong></div>`;
        result.diff.missing.forEach(missing => {
          html += `<div class="text-xs mb-1 ml-4">`;
          html += `<span class="font-mono text-yellow-600 dark:text-yellow-400">${escapeHtml(missing.path)}</span>: <span class="text-gray-700 dark:text-gray-300">${escapeHtml(JSON.stringify(missing.value))}</span>`;
          html += `</div>`;
        });
      }
      
      if (result.diff.extra.length > 0) {
        html += `<div class="mb-2"><strong class="text-gray-700 dark:text-gray-300">Extra in B:</strong></div>`;
        result.diff.extra.forEach(extra => {
          html += `<div class="text-xs mb-1 ml-4">`;
          html += `<span class="font-mono text-blue-600 dark:text-blue-400">${escapeHtml(extra.path)}</span>: <span class="text-gray-700 dark:text-gray-300">${escapeHtml(JSON.stringify(extra.value))}</span>`;
          html += `</div>`;
        });
      }
      
      html += `</div>`;
    }
  } else {
    // Text diff
    if (result.same) {
      html += `<div class="diff-same p-3 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">`;
      html += `<span class="text-green-700 dark:text-green-300">Bodies are identical</span>`;
      html += `</div>`;
    } else {
      html += `<div class="diff-different p-3 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">`;
      html += `<div class="text-sm text-red-700 dark:text-red-300 mb-2">Bodies differ</div>`;
      html += `<div class="font-mono text-xs space-y-1 max-h-64 overflow-y-auto">`;
      
      result.diff.forEach(line => {
        if (line.type === 'same') {
          html += `<div class="text-gray-600 dark:text-gray-400 font-mono text-xs">${escapeHtml(line.line)}</div>`;
        } else if (line.type === 'removed') {
          html += `<div class="text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 font-mono text-xs py-1 px-2 rounded">- ${escapeHtml(line.line)}</div>`;
        } else if (line.type === 'added') {
          html += `<div class="text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 font-mono text-xs py-1 px-2 rounded">+ ${escapeHtml(line.line)}</div>`;
        } else if (line.type === 'modified') {
          html += `<div class="text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 font-mono text-xs py-1 px-2 rounded mb-1">- ${escapeHtml(line.lineA)}</div>`;
          html += `<div class="text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 font-mono text-xs py-1 px-2 rounded">+ ${escapeHtml(line.lineB)}</div>`;
        }
      });
      
      html += `</div></div>`;
    }
  }
  
  section.innerHTML = html;
}

// Reset comparison handler
function resetComparisonHandler() {
  document.getElementById('curl-a-input').value = '';
  document.getElementById('curl-b-input').value = '';
  document.getElementById('parsed-view-container').classList.add('hidden');
  document.getElementById('diff-result-container').classList.add('hidden');
  parsedA = null;
  parsedB = null;
  comparisonResult = null;
  trackComparisonEvent('reset');
}

// Utility functions
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function showError(message) {
  showNotification(message, 'error');
}

function showSuccess(message) {
  showNotification(message, 'success');
}

function showNotification(message, type) {
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 ${
    type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
  }`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('opacity-0', 'transition-opacity');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
