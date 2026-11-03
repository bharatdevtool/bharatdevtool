// curl-tester-app.js - cURL Tester Application Logic
// Bharat Dev Tools - cURL Tester & API Debugger

const DEBUG_MODE = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1' ||
                   window.location.search.includes('debug=true');

const Debug = {
  log: (...args) => {
    // Debug logging removed for production
  },
  error: (...args) => {
    // Debug logging removed for production
  }
};

// Track if this is the first parse (for auto-send)
let isFirstParse = true;

// Reset first parse flag when user manually edits
function resetFirstParseFlag() {
  isFirstParse = false;
}

// Get current page name for analytics
function getCurrentPageNameForAnalytics() {
  if (typeof window.getCurrentPageNameForAnalytics === 'function') {
    return window.getCurrentPageNameForAnalytics();
  }
  return 'cURL Tester';
}

// Track analytics events
function trackCurlEvent(eventName, context = {}) {
  if (typeof window.Analytics !== 'undefined') {
    window.Analytics.track(eventName, {
      ...context,
      page: getCurrentPageNameForAnalytics(),
      timestamp: Date.now()
    });
  }
}

function trackCurlError(errorType, context = {}) {
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
  
  trackCurlEvent('curl_error', errorContext);
  
  if (typeof Sentry !== 'undefined') {
    Sentry.captureException(new Error(errorType), {
      tags: { operation: 'curl_tester', error_type: errorType },
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

// Application state
let currentRequest = {
  method: 'GET',
  url: '',
  queryParams: {},
  headers: {},
  authorization: null,
  body: null,
  bodyType: 'raw'
};

let currentResponse = null;
let envVars = {};
let timingData = {
  dns: 0,
  connecting: 0,
  tls: 0,
  sending: 0,
  waiting: 0,
  receiving: 0,
  total: 0
};

// Initialize application
function initApp() {
  loadSavedState();
  initEventListeners();
  initAdvancedToggle();
  initCopyAndAdvancedToggles();
  initRequestConfigTabs();
  initResponseTabs();
  initBodyTypeToggle();
}

// Load saved state from localStorage
function loadSavedState() {
  try {
    const saved = localStorage.getItem('curl_tester_state');
    if (saved) {
      const state = JSON.parse(saved);
      if (state.envVars) {
        envVars = state.envVars;
        renderEnvVars();
      }
    }
  } catch (error) {
    Debug.error('Failed to load saved state:', error);
  }
}

// Save state to localStorage
function saveState() {
  try {
    localStorage.setItem('curl_tester_state', JSON.stringify({
      envVars: envVars
    }));
  } catch (error) {
    Debug.error('Failed to save state:', error);
  }
}

// Initialize event listeners
function initEventListeners() {
  // cURL Input
  document.getElementById('parse-curl-btn').addEventListener('click', parseCurlCommand);
  document.getElementById('clear-curl-btn').addEventListener('click', clearCurlInput);
  
  // Postman-like Interface
  document.getElementById('send-request-btn').addEventListener('click', runRequest);
  document.getElementById('add-header-btn').addEventListener('click', () => {
    addHeaderRow();
    resetFirstParseFlag();
  });
  document.getElementById('add-param-btn').addEventListener('click', () => {
    addParamRow();
    resetFirstParseFlag();
  });
  document.getElementById('request-method').addEventListener('change', () => {
    updateHeadersCount();
    resetFirstParseFlag();
  });
  document.getElementById('request-url').addEventListener('input', () => {
    updateHeadersCount();
    extractQueryParams();
    resetFirstParseFlag();
  });
  document.getElementById('request-body').addEventListener('input', () => {
    updateHeadersCount();
    resetFirstParseFlag();
  });
  
  // Form body type - add initial field
  const formContainer = document.getElementById('form-body-container');
  if (formContainer && formContainer.children.length === 0) {
    addFormField();
  }
  
  // Advanced Options
  document.getElementById('add-env-var-btn').addEventListener('click', () => addEnvVarRow());
  
  // Code generation tabs
  document.querySelectorAll('.code-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      switchCodeTab(lang);
      generateCodeForLanguage(lang);
    });
  });
  document.getElementById('copy-code-btn').addEventListener('click', copyGeneratedCode);
  
  // cURL convenience tools
  document.getElementById('copy-original-curl-btn')?.addEventListener('click', () => copyCurlVariant('original'));
  document.getElementById('copy-compact-curl-btn')?.addEventListener('click', () => copyCurlVariant('compact'));
  document.getElementById('copy-terminal-safe-curl-btn')?.addEventListener('click', () => copyCurlVariant('terminal-safe'));
  document.getElementById('copy-curl-no-headers-btn')?.addEventListener('click', () => copyCurlVariant('no-headers'));
  document.getElementById('copy-curl-no-auth-btn')?.addEventListener('click', () => copyCurlVariant('no-auth'));
  
  // Response search
  document.getElementById('response-search')?.addEventListener('input', searchInResponse);
  document.getElementById('response-format-json-btn')?.addEventListener('click', openResponseInJsonFormatter);
  
  // Request history
  document.getElementById('clear-history-btn')?.addEventListener('click', clearRequestHistory);
  loadRequestHistory();
  
  // Form body add field button
  const addFormFieldBtn = document.getElementById('add-form-field-btn');
  if (addFormFieldBtn) {
    addFormFieldBtn.addEventListener('click', () => addFormField());
  }
  
  // Response Actions
  document.getElementById('copy-response-btn')?.addEventListener('click', copyResponse);
  document.getElementById('copy-headers-btn')?.addEventListener('click', copyHeaders);
  document.getElementById('download-response-btn')?.addEventListener('click', downloadResponse);
  
  // Response format selector
  document.getElementById('response-format')?.addEventListener('change', (e) => {
    const format = e.target.value;
    const bodyContent = document.getElementById('response-body-content');
    if (!currentResponse) return;
    
    if (format === 'json' && typeof currentResponse.body === 'object') {
      bodyContent.innerHTML = highlightJSON(JSON.stringify(currentResponse.body, null, 2));
    } else {
      bodyContent.textContent = currentResponse.bodyText;
    }
  });
  
  // Handle removal buttons
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-header-btn')) {
      removeHeaderRow(e.target.closest('.header-row'));
      updateHeadersCount();
    }
    if (e.target.classList.contains('remove-param-btn')) {
      const row = e.target.closest('.param-row');
      row.remove();
      updateURLFromParams();
    }
    if (e.target.classList.contains('remove-env-var-btn')) {
      removeEnvVarRow(e.target.closest('.env-var-row'));
    }
    if (e.target.classList.contains('remove-form-field-btn')) {
      removeFormField(e.target.closest('.form-field-row'));
    }
  });
  
  // Handle input changes
  document.addEventListener('input', (e) => {
    if (e.target.classList.contains('header-key') || e.target.classList.contains('header-value')) {
      updateHeadersCount();
      updateCurrentRequest();
    }
    if (e.target.classList.contains('param-key') || e.target.classList.contains('param-value')) {
      updateURLFromParams();
      updateCurrentRequest();
    }
    if (e.target.id === 'request-method' || e.target.id === 'request-url' || e.target.id === 'request-body') {
      updateCurrentRequest();
    }
    if (e.target.classList.contains('env-var-key') || e.target.classList.contains('env-var-value')) {
      updateEnvVar(e.target);
    }
    if (e.target.classList.contains('form-field-key') || e.target.classList.contains('form-field-value')) {
      updateFormBody();
      updateCurrentRequest();
    }
  });
}

// Initialize request config tabs
function initRequestConfigTabs() {
  document.querySelectorAll('.request-config-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      switchRequestConfigTab(tabName);
    });
  });
}

function switchRequestConfigTab(tabName) {
  document.querySelectorAll('.request-config-tab').forEach(t => {
    t.classList.remove('active', 'text-primary-600', 'dark:text-primary-400', 'bg-blue-50', 'dark:bg-gray-700/60');
    t.classList.add('text-gray-600', 'dark:text-gray-400');
  });
  
  document.querySelectorAll('.request-config-content').forEach(c => c.classList.add('hidden'));
  
  const activeTab = document.querySelector(`.request-config-tab[data-tab="${tabName}"]`);
  activeTab.classList.add('active', 'text-primary-600', 'dark:text-primary-400', 'bg-blue-50', 'dark:bg-gray-700/60');
  activeTab.classList.remove('text-gray-600', 'dark:text-gray-400');
  
  document.getElementById(`config-${tabName}`).classList.remove('hidden');
}

// Initialize legacy advanced toggle (kept for backward compatibility)
function initAdvancedToggle() {
  const toggle = document.getElementById('advanced-toggle');
  const options = document.getElementById('advanced-options');
  if (!toggle || !options) {
    return;
  }
}

// Initialize Copy + Advanced toggles (mutually exclusive)
function initCopyAndAdvancedToggles() {
  const copyToggle = document.getElementById('copy-toggle');
  const copyOptions = document.getElementById('copy-options');
  const advancedToggle = document.getElementById('advanced-toggle');
  const advancedOptions = document.getElementById('advanced-options');

  if (!copyToggle || !copyOptions || !advancedToggle || !advancedOptions) {
    return;
  }

  function closeCopySection() {
    if (!copyOptions.classList.contains('hidden')) {
      copyOptions.classList.add('hidden');
    }
    const icon = copyToggle.querySelector('span');
    if (icon) {
      icon.textContent = '▼';
    }
  }

  function closeAdvancedSection() {
    if (!advancedOptions.classList.contains('hidden')) {
      advancedOptions.classList.add('hidden');
    }
    const icon = advancedToggle.querySelector('span');
    if (icon) {
      icon.textContent = '▼';
    }
  }

  copyToggle.addEventListener('click', () => {
    const isHidden = copyOptions.classList.contains('hidden');
    if (isHidden) {
      // Open copy, close advanced
      copyOptions.classList.remove('hidden');
      const icon = copyToggle.querySelector('span');
      if (icon) {
        icon.textContent = '▲';
      }
      closeAdvancedSection();
    } else {
      closeCopySection();
    }
  });

  advancedToggle.addEventListener('click', () => {
    const isHidden = advancedOptions.classList.contains('hidden');
    if (isHidden) {
      // Open advanced, close copy
      advancedOptions.classList.remove('hidden');
      const icon = advancedToggle.querySelector('span');
      if (icon) {
        icon.textContent = '▲';
      }
      closeCopySection();
    } else {
      closeAdvancedSection();
    }
  });

  // Wire copy option buttons
  const copyButtons = document.querySelectorAll('.copy-option-btn');
  copyButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.copyType;
      handleCopyOption(type);
    });
  });
}

// Initialize body type toggle
function initBodyTypeToggle() {
  const rawBtn = document.getElementById('body-type-raw');
  const jsonBtn = document.getElementById('body-type-json');
  const formBtn = document.getElementById('body-type-form');
  const bodyTextarea = document.getElementById('request-body');
  const formContainer = document.getElementById('form-body-container');
  
  rawBtn.addEventListener('click', () => {
    rawBtn.classList.add('active');
    jsonBtn.classList.remove('active');
    formBtn.classList.remove('active');
    bodyTextarea.classList.remove('hidden');
    formContainer.classList.add('hidden');
    currentRequest.bodyType = 'raw';
    updateCurrentRequest();
  });
  
  jsonBtn.addEventListener('click', () => {
    jsonBtn.classList.add('active');
    rawBtn.classList.remove('active');
    formBtn.classList.remove('active');
    bodyTextarea.classList.remove('hidden');
    formContainer.classList.add('hidden');
    currentRequest.bodyType = 'json';
    updateCurrentRequest();
  });
  
  formBtn.addEventListener('click', () => {
    formBtn.classList.add('active');
    rawBtn.classList.remove('active');
    jsonBtn.classList.remove('active');
    bodyTextarea.classList.add('hidden');
    formContainer.classList.remove('hidden');
    currentRequest.bodyType = 'form';
    updateFormBody();
  });
}

// Initialize response tabs
function initResponseTabs() {
  document.querySelectorAll('.response-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      switchResponseTab(tabName);
    });
  });
}

function switchResponseTab(tabName) {
  document.querySelectorAll('.response-tab').forEach(t => {
    t.classList.remove('active', 'text-primary-600', 'dark:text-primary-400', 'bg-blue-50', 'dark:bg-gray-700/60');
    t.classList.add('text-gray-600', 'dark:text-gray-400');
  });
  
  document.querySelectorAll('.response-content').forEach(c => c.classList.add('hidden'));
  
  const activeTab = document.querySelector(`.response-tab[data-tab="${tabName}"]`);
  activeTab.classList.add('active', 'text-primary-600', 'dark:text-primary-400', 'bg-blue-50', 'dark:bg-gray-700/60');
  activeTab.classList.remove('text-gray-600', 'dark:text-gray-400');
  
  document.getElementById(`response-${tabName}`).classList.remove('hidden');
}

// Parse cURL command
function parseCurlCommand() {
  const curlInput = document.getElementById('curl-input').value.trim();
  
  if (!curlInput) {
    showError('Please enter a cURL command');
    trackCurlError('empty_input', {
      input_length: 0
    });
    return;
  }
  
  detectUIFreeze('parse_curl', () => {
    try {
      const parsed = parseCurl(curlInput);
      currentRequest = parsed;
      
      // Populate Postman-like UI
      document.getElementById('request-method').value = parsed.method;
      
      // Keep full URL with query params in the URL field
      const fullUrl = parsed.fullUrl || parsed.url;
      if (parsed.queryParams && Object.keys(parsed.queryParams).length > 0) {
        // Reconstruct full URL with query params
        try {
          const urlObj = new URL(parsed.url);
          Object.entries(parsed.queryParams).forEach(([key, value]) => {
            urlObj.searchParams.set(key, value);
          });
          document.getElementById('request-url').value = urlObj.toString();
        } catch (e) {
          // Fallback: just use the parsed URL
          document.getElementById('request-url').value = fullUrl;
        }
      } else {
        document.getElementById('request-url').value = parsed.url;
      }
      
      document.getElementById('request-body').value = parsed.body || '';
      currentRequest.bodyType = parsed.body ? 'json' : 'raw';
      
      // Extract and populate query params
      extractQueryParams();
      populateQueryParams(parsed.queryParams || {});
      
      // Populate headers
      const headersContainer = document.getElementById('headers-container');
      headersContainer.innerHTML = '';
      Object.entries(parsed.headers || {}).forEach(([key, value]) => {
        addHeaderRow(key, value);
      });
      updateHeadersCount();
      
      // Populate authorization
      populateAuthorization(parsed.headers || {});
      
      // Show Postman-like interface
      document.getElementById('postman-interface').classList.remove('hidden');
      
      // Display curl type detection
      displayCurlType(parsed);
      
      // Auto-generate code for active tab
      const activeTab = document.querySelector('.code-tab-btn.active');
      if (activeTab) {
        generateCodeForLanguage(activeTab.dataset.lang);
      }
      
      trackCurlEvent('parse_curl', { 
        method: parsed.method, 
        hasBody: !!parsed.body,
        input_length: curlInput.length,
        input_preview: curlInput.substring(0, 100)
      });
      
      // Auto-send on first parse
      if (isFirstParse) {
        isFirstParse = false;
        // Small delay to ensure UI is ready
        setTimeout(() => {
          runRequest();
        }, 100);
      }
    } catch (error) {
      showError(`Failed to parse cURL: ${error.message}`);
      trackCurlError('parse_failed', { 
        error_message: error.message,
        input_length: curlInput.length,
        input_preview: curlInput.substring(0, 100)
      });
      throw error;
    }
  }).catch((error) => {
    Debug.error('Parse cURL error:', error);
  });
}

// Parse cURL command string
function parseCurl(curlCommand) {
  const result = {
    method: 'GET',
    url: '',
    queryParams: {},
    headers: {},
    body: null
  };
  
  if (DEBUG_MODE) {
    Debug.log('Parsing cURL:', curlCommand.substring(0, 200));
  }
  
  // Remove 'curl' prefix if present
  let command = curlCommand.trim();
  if (command.toLowerCase().startsWith('curl')) {
    command = command.substring(4).trim();
  }
  
  // Remove common flags that don't affect parsing (--compressed, -v, -s, -i, etc.)
  command = command.replace(/--compressed\s*/gi, '');
  command = command.replace(/-[vsi]\s+/gi, '');
  
  // Extract method (-X or --request)
  const methodMatch = command.match(/-X\s+(\w+)|--request\s+(\w+)/i);
  if (methodMatch) {
    result.method = (methodMatch[1] || methodMatch[2]).toUpperCase();
    if (DEBUG_MODE) {
      Debug.log('Method found:', result.method);
    }
  }
  
  // Extract headers (-H or --header) - store positions to exclude from URL search
  const headerRegex = /-H\s+['"]([^'"]+)['"]|--header\s+['"]([^'"]+)['"]/gi;
  const headerPositions = [];
  let headerMatch;
  while ((headerMatch = headerRegex.exec(command)) !== null) {
    const headerStr = headerMatch[1] || headerMatch[2];
    const colonIndex = headerStr.indexOf(':');
    if (colonIndex > 0) {
      const key = headerStr.substring(0, colonIndex).trim();
      const value = headerStr.substring(colonIndex + 1).trim();
      result.headers[key] = value;
    }
    // Store header position to exclude from URL matching
    headerPositions.push({ start: headerMatch.index, end: headerMatch.index + headerMatch[0].length });
  }
  
  if (DEBUG_MODE) {
    Debug.log('Headers found:', Object.keys(result.headers).length);
  }
  
  // Extract data/body (-d or --data or --data-raw or --data-binary)
  const dataMatch = command.match(/(?:-d|--data(?:-raw|-binary)?)\s+(?:'([^']*)'|"([^"]*)")/i);
  if (dataMatch) {
    result.body = dataMatch[1] !== undefined ? dataMatch[1] : dataMatch[2];
    // If method wasn't specified and body exists, default to POST
    if (!methodMatch) {
      result.method = 'POST';
    }
    if (DEBUG_MODE) {
      Debug.log('Body found:', result.body.substring(0, 50));
    }
  }
  
  // Extract URL - find the LAST URL that's not inside a header value
  // Strategy: Find all URLs, then pick the one that's not part of a header
  const urlRegex = /(https?:\/\/[^\s'"]+)/gi;
  const urlMatches = [];
  let urlMatch;
  
  while ((urlMatch = urlRegex.exec(command)) !== null) {
    const urlStart = urlMatch.index;
    const urlEnd = urlMatch.index + urlMatch[0].length;
    
    // Check if this URL is inside a header value
    let isInHeader = false;
    for (const headerPos of headerPositions) {
      if (urlStart >= headerPos.start && urlEnd <= headerPos.end) {
        isInHeader = true;
        break;
      }
    }
    
    if (!isInHeader) {
      urlMatches.push({
        url: urlMatch[1],
        index: urlMatch.index
      });
    }
  }
  
  // Also try to find quoted URL at the end (common pattern)
  const quotedUrlMatch = command.match(/['"](https?:\/\/[^'"]+)['"]\s*$/);
  if (quotedUrlMatch) {
    urlMatches.push({
      url: quotedUrlMatch[1],
      index: quotedUrlMatch.index
    });
  }
  
  if (urlMatches.length > 0) {
    // Use the LAST URL match (most likely the request URL)
    const lastMatch = urlMatches[urlMatches.length - 1];
    result.url = lastMatch.url;
    if (DEBUG_MODE) {
      Debug.log('URL found:', result.url);
      Debug.log('Total URL matches:', urlMatches.length);
    }
  } else {
    // Fallback: Try to find URL without protocol (last resort)
    const urlMatch2 = command.match(/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s'"]*)/);
    if (urlMatch2) {
      result.url = 'https://' + urlMatch2[1];
      if (DEBUG_MODE) {
        Debug.log('URL found (fallback):', result.url);
      }
    }
  }
  
  if (!result.url) {
    if (DEBUG_MODE) {
      Debug.error('No URL found. Command:', command);
    }
    throw new Error('Could not find URL in cURL command');
  }
  
  // Extract query parameters from URL
  try {
    const urlObj = new URL(result.url);
    urlObj.searchParams.forEach((value, key) => {
      result.queryParams[key] = value;
    });
    // Store full URL with query params for reference
    result.fullUrl = result.url;
    // Keep base URL without query params for easier editing
    result.url = urlObj.origin + urlObj.pathname;
    
    if (DEBUG_MODE) {
      Debug.log('Query params found:', Object.keys(result.queryParams).length);
      Debug.log('Full URL:', result.fullUrl);
      Debug.log('Base URL:', result.url);
    }
  } catch (e) {
    if (DEBUG_MODE) {
      Debug.error('Failed to parse URL:', e, 'URL:', result.url);
    }
    // If URL parsing fails, keep original URL
    result.fullUrl = result.url;
  }
  
  if (DEBUG_MODE) {
    Debug.log('Parse result:', {
      method: result.method,
      url: result.url,
      queryParamsCount: Object.keys(result.queryParams).length,
      headersCount: Object.keys(result.headers).length,
      hasBody: !!result.body
    });
  }
  
  return result;
}

// Extract query params from URL
function extractQueryParams() {
  const url = document.getElementById('request-url').value;
  if (!url) return;
  
  try {
    const urlObj = new URL(url);
    const params = {};
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    currentRequest.queryParams = params;
    populateQueryParams(params);
  } catch (e) {
    Debug.error('Failed to extract query params:', e);
  }
}

// Populate query params in UI
function populateQueryParams(params) {
  const container = document.getElementById('params-container');
  if (!container) return;
  
  container.innerHTML = '';
  Object.entries(params).forEach(([key, value]) => {
    addParamRow(key, value, true);
  });
}

// Add param row
function addParamRow(key = '', value = '', enabled = true) {
  const container = document.getElementById('params-container');
  const row = document.createElement('div');
  row.className = 'param-row flex items-center gap-2';
  row.innerHTML = `
    <input type="checkbox" class="param-enabled" ${enabled ? 'checked' : ''} />
    <input type="text" class="param-key flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" placeholder="Key" value="${escapeHtml(key)}" />
    <input type="text" class="param-value flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" placeholder="Value" value="${escapeHtml(value)}" />
    <button class="remove-param-btn remove-btn" type="button">Remove</button>
  `;
  container.appendChild(row);
  
  // Update URL when params change
  row.querySelector('.param-key').addEventListener('input', updateURLFromParams);
  row.querySelector('.param-value').addEventListener('input', updateURLFromParams);
  row.querySelector('.param-enabled').addEventListener('change', updateURLFromParams);
  row.querySelector('.remove-param-btn').addEventListener('click', () => {
    row.remove();
    updateURLFromParams();
  });
}

// Update URL from query params
function updateURLFromParams() {
  const currentUrl = document.getElementById('request-url').value;
  let baseUrl = currentUrl.split('?')[0];
  
  // If current URL is empty or invalid, use a placeholder
  if (!baseUrl || !baseUrl.startsWith('http')) {
    baseUrl = baseUrl || 'https://example.com';
  }
  
  const params = {};
  
  document.querySelectorAll('.param-row').forEach(row => {
    const enabled = row.querySelector('.param-enabled').checked;
    const key = row.querySelector('.param-key').value.trim();
    const value = row.querySelector('.param-value').value.trim();
    if (enabled && key) {
      params[key] = value;
    }
  });
  
  try {
    const urlObj = new URL(baseUrl);
    // Clear existing params and add new ones
    urlObj.search = '';
    Object.entries(params).forEach(([key, value]) => {
      urlObj.searchParams.set(key, value);
    });
    
    const newUrl = urlObj.toString();
    // Only update if we have a valid URL (not the placeholder)
    if (!baseUrl.includes('example.com') || Object.keys(params).length > 0) {
      document.getElementById('request-url').value = newUrl.replace('https://example.com', '');
    }
    currentRequest.queryParams = params;
  } catch (e) {
    if (DEBUG_MODE) {
      Debug.error('Failed to update URL from params:', e);
    }
    // If URL construction fails, just update the params object
    currentRequest.queryParams = params;
  }
}

// Populate authorization tab
function populateAuthorization(headers) {
  const authDisplay = document.getElementById('authorization-display');
  if (!authDisplay) return;
  
  const authHeaders = ['authorization', 'Authorization', 'AUTHORIZATION'];
  let authHeader = null;
  
  for (const key of Object.keys(headers)) {
    if (authHeaders.includes(key)) {
      authHeader = { key, value: headers[key] };
      break;
    }
  }
  
  if (authHeader) {
    const maskedValue = maskSensitiveHeaderValue(authHeader.value);
    authDisplay.innerHTML = `
      <div class="text-sm">
        <div class="font-semibold text-gray-900 dark:text-white mb-2">${authHeader.key}</div>
        <div class="text-gray-600 dark:text-gray-400 font-mono">${maskedValue}</div>
      </div>
    `;
    currentRequest.authorization = authHeader;
  } else {
    authDisplay.innerHTML = `
      <div class="text-sm text-gray-600 dark:text-gray-400">
        No authorization header detected. Add one in the Headers tab.
      </div>
    `;
    currentRequest.authorization = null;
  }
}

function maskSensitiveHeaderValue(value) {
  if (value.length > 10) {
    return value.substring(0, 4) + '******' + value.substring(value.length - 4);
  }
  return '******';
}

// Update headers count
function updateHeadersCount() {
  const headers = getHeaders();
  const count = Object.keys(headers).length;
  const countEl = document.getElementById('headers-count');
  if (countEl) {
    countEl.textContent = `(${count})`;
  }
}

// displayParsedCurl removed - using Postman-like UI instead

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}


// Clear cURL input
function clearCurlInput() {
  document.getElementById('curl-input').value = '';
  document.getElementById('postman-interface').classList.add('hidden');
  document.getElementById('response-viewer').classList.add('hidden');
  document.getElementById('curl-type-detection').classList.add('hidden');
  trackCurlEvent('clear_curl');
}

// Add header row
function addHeaderRow(key = '', value = '') {
  const container = document.getElementById('headers-container');
  const row = document.createElement('div');
  row.className = 'header-row';
  row.innerHTML = `
    <input type="text" class="header-key px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" placeholder="Header name" value="${escapeHtml(key)}" />
    <input type="text" class="header-value px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" placeholder="Header value" value="${escapeHtml(value)}" />
    <button class="remove-header-btn remove-btn" type="button">Remove</button>
  `;
  container.appendChild(row);
}

// Remove header row
function removeHeaderRow(row) {
  row.remove();
  updateHeadersCount();
  updateCurrentRequest();
}

// updateRequestPreview removed - using Postman-like UI instead
// Update currentRequest state when fields change
function updateCurrentRequest() {
  const method = document.getElementById('request-method').value;
  const url = document.getElementById('request-url').value;
  const headers = getHeaders();
  const body = getRequestBody();
  const queryParams = getQueryParams();
  
  currentRequest = { 
    method, 
    url, 
    headers, 
    body, 
    queryParams,
    bodyType: currentRequest.bodyType 
  };
  
  // Auto-generate code for active tab
  const activeTab = document.querySelector('.code-tab-btn.active');
  if (activeTab && url) {
    generateCodeForLanguage(activeTab.dataset.lang);
  }
}

// Get headers from form
function getHeaders() {
  const headers = {};
  document.querySelectorAll('.header-row').forEach(row => {
    const key = row.querySelector('.header-key').value.trim();
    const value = row.querySelector('.header-value').value.trim();
    if (key && value) {
      headers[key] = value;
    }
  });
  return headers;
}

// Get request body
function getRequestBody() {
  if (currentRequest.bodyType === 'form') {
    const formData = {};
    document.querySelectorAll('.form-field-row').forEach(row => {
      const key = row.querySelector('.form-field-key').value.trim();
      const value = row.querySelector('.form-field-value').value.trim();
      if (key) {
        formData[key] = value;
      }
    });
    return new URLSearchParams(formData).toString();
  }
  return document.getElementById('request-body').value;
}

// Update form body
function updateFormBody() {
  const formData = {};
  document.querySelectorAll('.form-field-row').forEach(row => {
    const key = row.querySelector('.form-field-key').value.trim();
    const value = row.querySelector('.form-field-value').value.trim();
    if (key) {
      formData[key] = value;
    }
  });
  currentRequest.body = new URLSearchParams(formData).toString();
  updateCurrentRequest();
}

// Add form field
function addFormField(key = '', value = '') {
  const container = document.getElementById('form-body-container');
  const addBtn = document.getElementById('add-form-field-btn');
  const row = document.createElement('div');
  row.className = 'form-field-row';
  row.innerHTML = `
    <input type="text" class="form-field-key px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" placeholder="Key" value="${escapeHtml(key)}" />
    <input type="text" class="form-field-value px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" placeholder="Value" value="${escapeHtml(value)}" />
    <button class="remove-form-field-btn remove-btn" type="button">Remove</button>
  `;
  if (addBtn && addBtn.parentNode === container) {
    container.insertBefore(row, addBtn);
  } else {
    container.appendChild(row);
  }
}

// Remove form field
function removeFormField(row) {
  row.remove();
  updateFormBody();
}

// Get query params from UI
function getQueryParams() {
  const params = {};
  document.querySelectorAll('.param-row').forEach(row => {
    const enabled = row.querySelector('.param-enabled').checked;
    const key = row.querySelector('.param-key').value.trim();
    const value = row.querySelector('.param-value').value.trim();
    if (enabled && key) {
      params[key] = value;
    }
  });
  return params;
}

// Build URL with query params
function buildURLWithParams(baseUrl) {
  const params = getQueryParams();
  if (Object.keys(params).length === 0) return baseUrl;
  
  try {
    const urlObj = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      urlObj.searchParams.set(key, value);
    });
    return urlObj.toString();
  } catch (e) {
    return baseUrl;
  }
}

// Run request
async function runRequest() {
  const method = document.getElementById('request-method').value;
  let url = document.getElementById('request-url').value;
  const headers = getHeaders();
  const body = getRequestBody();
  
  if (!url) {
    showError('Please enter a URL');
    trackCurlError('missing_url', {
      method: method
    });
    return;
  }
  
  // Build URL with query params
  url = buildURLWithParams(url);
  
  // Check for OPTIONS method warning
  if (method === 'OPTIONS') {
    showErrorExplanation(null, null, 'This is a CORS preflight request, not the actual API call.');
  }
  
  // Show loading state
  const sendBtn = document.getElementById('send-request-btn');
  const originalText = sendBtn.innerHTML;
  sendBtn.innerHTML = '<span class="loading-spinner"></span> Sending...';
  sendBtn.disabled = true;
  
  // Declare performanceObserver outside try-catch for proper cleanup
  let performanceObserver = null;
  
  try {
    await detectUIFreeze('run_request', async () => {
      // Replace environment variables in URL
      const finalUrl = replaceEnvVars(url);
      
      // Prepare fetch options
      const fetchOptions = {
        method: method,
        headers: {}
      };
      
      // Add headers (replace env vars)
      Object.entries(headers).forEach(([key, value]) => {
        fetchOptions.headers[key] = replaceEnvVars(value);
      });
      
      // Add body for methods that support it
      if (['POST', 'PUT', 'PATCH'].includes(method) && body) {
        if (currentRequest.bodyType === 'json') {
          fetchOptions.headers['Content-Type'] = 'application/json';
          try {
            fetchOptions.body = JSON.stringify(JSON.parse(body));
          } catch (e) {
            fetchOptions.body = body;
          }
        } else if (currentRequest.bodyType === 'form') {
          fetchOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
          fetchOptions.body = body;
        } else {
          fetchOptions.body = body;
        }
      }
      
      // Get timeout
      const timeout = parseInt(document.getElementById('request-timeout')?.value || '30000');
      
      // Measure detailed timings
      const timingStart = performance.now();
      const perfEntries = [];
      
      // Use PerformanceObserver if available
      if ('PerformanceObserver' in window) {
        try {
          performanceObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.name === finalUrl || entry.name.includes(new URL(finalUrl).hostname)) {
                perfEntries.push(entry);
              }
            }
          });
          performanceObserver.observe({ entryTypes: ['resource', 'navigation'] });
        } catch (e) {
          Debug.error('PerformanceObserver not supported:', e);
        }
      }
      
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const fetchStartTime = performance.now();
        
        const response = await fetch(finalUrl, {
          ...fetchOptions,
          signal: controller.signal,
          redirect: document.getElementById('disable-redirects')?.checked ? 'manual' : 'follow'
        });
        
        clearTimeout(timeoutId);
        
        const fetchEndTime = performance.now();
        const totalDuration = fetchEndTime - timingStart;
      
        // Calculate timings from Performance API
        const timings = calculateDetailedTimings(perfEntries, totalDuration);
        
        // Get response headers
        const responseHeaders = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });
        
        const contentType = response.headers.get('content-type') || '';
        const isMedia = contentType.startsWith('image/') || contentType.startsWith('video/') || contentType.startsWith('audio/');
        
        let responseBody;
        let responseText;
        let responseSize = 0;
        let mediaData = null;
        
        if (isMedia) {
          // Handle media URLs
          const blobStartTime = performance.now();
          const blob = await response.blob();
          const blobEndTime = performance.now();
          
          responseSize = blob.size;
          mediaData = {
            blob: blob,
            contentType: contentType,
            fetchTime: blobEndTime - fetchStartTime,
            decodeTime: 0
          };
          
          if (contentType.startsWith('image/')) {
            // Handle image
            const decodeStartTime = performance.now();
            const imageUrl = URL.createObjectURL(blob);
            const img = new Image();
            await new Promise((resolve, reject) => {
              img.onload = () => {
                const decodeEndTime = performance.now();
                mediaData.decodeTime = decodeEndTime - decodeStartTime;
                URL.revokeObjectURL(imageUrl);
                resolve();
              };
              img.onerror = reject;
              img.src = imageUrl;
            });
            mediaData.imageUrl = imageUrl;
          } else if (contentType.startsWith('video/')) {
            // Handle video
            const videoUrl = URL.createObjectURL(blob);
            mediaData.videoUrl = videoUrl;
          }
          
          responseBody = null;
          responseText = `[${contentType} - ${formatBytes(responseSize)}]`;
        } else {
          // Handle text/JSON responses
          try {
            responseText = await response.text();
            responseSize = new Blob([responseText]).size;
            
            if (contentType.includes('application/json')) {
              try {
                responseBody = JSON.parse(responseText);
              } catch (e) {
                responseBody = responseText;
              }
            } else {
              responseBody = responseText;
            }
          } catch (e) {
            responseText = 'Unable to read response body';
            responseBody = responseText;
          }
        }
        
        // Calculate header size
        let headerSize = 0;
        Object.entries(responseHeaders).forEach(([key, value]) => {
          headerSize += new Blob([`${key}: ${value}\r\n`]).size;
        });
        
        currentResponse = {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body: responseBody,
          bodyText: responseText,
          duration: Math.round(totalDuration),
          timings: timings,
          bodySize: responseSize,
          headerSize: headerSize,
          totalSize: responseSize + headerSize,
          contentType: contentType,
          isMedia: isMedia,
          mediaData: mediaData
        };
        
        // Cleanup performance observer
        if (performanceObserver) {
          performanceObserver.disconnect();
        }
        
        // Show error explanation if status indicates error
        if (response.status >= 400) {
          showErrorExplanation(null, response.status);
        }
        
        displayResponse(currentResponse);
        displayTimings(timings);
        analyzeRequestAndResponse(fetchOptions, currentResponse);
        
        // Save to history
        saveToHistory(currentRequest, currentResponse);
        
        // Hide error explanation on success
        const explanationEl = document.getElementById('error-explanation');
        if (explanationEl && response.status < 400) {
          explanationEl.classList.add('hidden');
        }
        
        trackCurlEvent('request_success', {
          method: method,
          status: response.status,
          duration: Math.round(totalDuration),
          size: responseSize,
          url_length: url.length,
          has_body: !!body,
          body_length: body ? body.length : 0,
          is_media: isMedia
        });
        
        return currentResponse;
      } finally {
        // Cleanup performance observer in finally block
        if (performanceObserver) {
          performanceObserver.disconnect();
        }
      }
    });
  } catch (error) {
    // Cleanup performance observer on error
    if (performanceObserver) {
      try {
        performanceObserver.disconnect();
      } catch (e) {
        Debug.error('Error disconnecting performance observer:', e);
      }
    }
    
    // Show response viewer with error state
    const viewer = document.getElementById('response-viewer');
    if (viewer) {
      viewer.classList.remove('hidden');
      
      // Update status bar with error
      const statusEl = document.getElementById('response-status');
      if (statusEl) {
        statusEl.className = 'px-3 py-1 rounded-full text-sm font-semibold response-status-error';
        statusEl.textContent = 'Error';
      }
      
      // Show error in body tab
      const bodyContent = document.getElementById('response-body-content');
      if (bodyContent) {
        bodyContent.textContent = `Error: ${error.message || 'Unknown error'}`;
      }
    }
    
    // Detect CORS errors more accurately
    const isCorsError = error.name === 'TypeError' && (
      error.message.includes('CORS') ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('network error') ||
      error.message.includes('Access-Control-Allow-Origin')
    );
    
    if (error.name === 'AbortError') {
      showError('Request timed out');
      showErrorExplanation(error, null, 'Request timed out. The server took too long to respond. Try increasing the timeout or check if the server is accessible.');
      trackCurlError('timeout', { 
        method: method,
        url_length: url.length
      });
    } else if (isCorsError) {
      const corsMessage = `This request cannot be executed from the browser due to CORS (Cross-Origin Resource Sharing) restrictions.

The server (${new URL(url).hostname}) does not allow requests from this origin (${window.location.origin}).

Why this happens:
• Browsers block cross-origin requests for security
• The server needs to include 'Access-Control-Allow-Origin' header
• This is a browser security feature, not a bug

Solutions:
• Use a browser extension that disables CORS (for testing only)
• Test with a public API that supports CORS
• Use server-side tools like Postman or cURL directly
• Contact the API provider to enable CORS for your domain`;
      
      showError('CORS Error: Request blocked by browser');
      showErrorExplanation(error, null, corsMessage);
      
      // Display error in response viewer
      if (bodyContent) {
        bodyContent.innerHTML = `<div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div class="font-semibold text-red-800 dark:text-red-200 mb-2">🚫 CORS Error</div>
          <div class="text-sm text-red-700 dark:text-red-300 space-y-2">
            <p><strong>Error:</strong> ${error.message || 'Failed to fetch'}</p>
            <p><strong>Reason:</strong> The server at <code class="bg-red-100 dark:bg-red-900 px-1 rounded">${new URL(url).hostname}</code> does not allow requests from <code class="bg-red-100 dark:bg-red-900 px-1 rounded">${window.location.origin}</code></p>
            <p><strong>What is CORS?</strong> Cross-Origin Resource Sharing is a browser security feature that blocks requests between different domains unless the server explicitly allows it.</p>
            <p><strong>Solutions:</strong></p>
            <ul class="list-disc list-inside ml-2 space-y-1">
              <li>Use a browser extension to disable CORS (development only)</li>
              <li>Test with a public API that supports CORS</li>
              <li>Use server-side tools like Postman desktop or cURL</li>
              <li>Contact the API provider to enable CORS</li>
            </ul>
          </div>
        </div>`;
      }
      
      trackCurlError('cors_blocked', {
        method: method,
        url: url.substring(0, 100),
        error_message: error.message,
        origin: window.location.origin,
        target_host: new URL(url).hostname
      });
    } else {
      showError(`Request failed: ${error.message || 'Unknown error'}`);
      showErrorExplanation(error, null);
      trackCurlError('request_failed', { 
        error_message: error.message,
        method: method,
        url_length: url.length,
        url_preview: url.substring(0, 100),
        error_name: error.name
      });
    }
    
    // Save failed request to history
    saveToHistory(currentRequest, { status: 'Error', duration: 0, error: error.message });
  } finally {
    sendBtn.innerHTML = originalText;
    sendBtn.disabled = false;
  }
}

// Calculate detailed timings from Performance API
function calculateDetailedTimings(perfEntries, totalDuration) {
  const timings = {
    dns: 0,
    connecting: 0,
    tls: 0,
    sending: 0,
    waiting: 0,
    receiving: 0,
    total: Math.round(totalDuration)
  };
  
  if (perfEntries.length > 0) {
    const entry = perfEntries[0];
    if (entry.duration) {
      // Use Resource Timing API if available
      if (entry.domainLookupStart && entry.domainLookupEnd) {
        timings.dns = Math.round(entry.domainLookupEnd - entry.domainLookupStart);
      }
      if (entry.connectStart && entry.connectEnd) {
        timings.connecting = Math.round(entry.connectEnd - entry.connectStart);
      }
      if (entry.secureConnectionStart && entry.connectEnd) {
        timings.tls = Math.round(entry.connectEnd - entry.secureConnectionStart);
      }
      if (entry.requestStart && entry.responseStart) {
        timings.waiting = Math.round(entry.responseStart - entry.requestStart);
      }
      if (entry.responseStart && entry.responseEnd) {
        timings.receiving = Math.round(entry.responseEnd - entry.responseStart);
      }
    }
  } else {
    // Estimate timings if Performance API not available
    timings.dns = Math.round(totalDuration * 0.05);
    timings.connecting = Math.round(totalDuration * 0.02);
    timings.tls = Math.round(totalDuration * 0.05);
    timings.sending = Math.round(totalDuration * 0.01);
    timings.waiting = Math.round(totalDuration * 0.75);
    timings.receiving = Math.round(totalDuration * 0.12);
  }
  
  return timings;
}

// Display timings breakdown
function displayTimings(timings) {
  const total = timings.total || 1;
  
  // Calculate cumulative start positions for waterfall visualization
  let cumulativeStart = 0;
  
  // DNS: starts at 0%
  const dnsWidth = (timings.dns / total) * 100;
  document.getElementById('timing-dns').textContent = `${timings.dns} ms`;
  const dnsBar = document.getElementById('timing-dns-bar');
  dnsBar.style.left = `${cumulativeStart}%`;
  dnsBar.style.width = `${dnsWidth}%`;
  cumulativeStart += dnsWidth;
  
  // Connecting: starts after DNS
  const connectingWidth = (timings.connecting / total) * 100;
  document.getElementById('timing-connecting').textContent = `${timings.connecting} ms`;
  const connectingBar = document.getElementById('timing-connecting-bar');
  connectingBar.style.left = `${cumulativeStart}%`;
  connectingBar.style.width = `${connectingWidth}%`;
  cumulativeStart += connectingWidth;
  
  // TLS: starts after DNS + Connecting
  const tlsWidth = (timings.tls / total) * 100;
  document.getElementById('timing-tls').textContent = `${timings.tls} ms`;
  const tlsBar = document.getElementById('timing-tls-bar');
  tlsBar.style.left = `${cumulativeStart}%`;
  tlsBar.style.width = `${tlsWidth}%`;
  cumulativeStart += tlsWidth;
  
  // Sending: starts after DNS + Connecting + TLS
  const sendingWidth = (timings.sending / total) * 100;
  document.getElementById('timing-sending').textContent = `${timings.sending} ms`;
  const sendingBar = document.getElementById('timing-sending-bar');
  sendingBar.style.left = `${cumulativeStart}%`;
  sendingBar.style.width = `${sendingWidth}%`;
  cumulativeStart += sendingWidth;
  
  // Waiting: starts after DNS + Connecting + TLS + Sending
  const waitingWidth = (timings.waiting / total) * 100;
  document.getElementById('timing-waiting').textContent = `${timings.waiting} ms`;
  const waitingBar = document.getElementById('timing-waiting-bar');
  waitingBar.style.left = `${cumulativeStart}%`;
  waitingBar.style.width = `${waitingWidth}%`;
  cumulativeStart += waitingWidth;
  
  // Receiving: starts after DNS + Connecting + TLS + Sending + Waiting
  const receivingWidth = (timings.receiving / total) * 100;
  document.getElementById('timing-receiving').textContent = `${timings.receiving} ms`;
  const receivingBar = document.getElementById('timing-receiving-bar');
  receivingBar.style.left = `${cumulativeStart}%`;
  receivingBar.style.width = `${receivingWidth}%`;
  
  document.getElementById('timing-total').textContent = `${timings.total} ms`;
}

// Display response (Postman-like)
function displayResponse(response) {
  const viewer = document.getElementById('response-viewer');
  viewer.classList.remove('hidden');
  
  // Update status bar
  const statusEl = document.getElementById('response-status');
  if (response.status >= 200 && response.status < 300) {
    statusEl.className = 'px-3 py-1 rounded-full text-sm font-semibold response-status-success';
    statusEl.textContent = `${response.status} ${response.statusText || 'OK'}`;
  } else if (response.status >= 400) {
    statusEl.className = 'px-3 py-1 rounded-full text-sm font-semibold response-status-error';
    statusEl.textContent = `${response.status} ${response.statusText || 'Error'}`;
  } else {
    statusEl.className = 'px-3 py-1 rounded-full text-sm font-semibold response-status-warning';
    statusEl.textContent = `${response.status} ${response.statusText || ''}`;
  }
  
  document.getElementById('response-time').textContent = `${response.duration} ms`;
  document.getElementById('response-size').textContent = formatBytes(response.totalSize || response.bodySize || 0);
  
  // Update headers count
  const headersCount = Object.keys(response.headers || {}).length;
  document.getElementById('response-headers-count').textContent = `(${headersCount})`;
  
  // Handle media responses
  if (response.isMedia && response.mediaData) {
    displayMediaResponse(response);
    return;
  }
  
  // Hide media preview for non-media responses
  document.getElementById('media-preview').classList.add('hidden');
  document.getElementById('image-preview-container').classList.add('hidden');
  document.getElementById('video-preview-container').classList.add('hidden');
  document.getElementById('response-body-content-wrapper').classList.remove('hidden');
  
  // Display body
  const bodyContent = document.getElementById('response-body-content');
  if (typeof response.body === 'object') {
    const jsonString = JSON.stringify(response.body, null, 2);
    bodyContent.setAttribute('data-original', jsonString);
    bodyContent.innerHTML = highlightJSON(jsonString);
  } else {
    bodyContent.textContent = response.bodyText;
    bodyContent.setAttribute('data-original', response.bodyText);
  }
  
  // Display headers (with masking)
  const headersContent = document.getElementById('response-headers-content');
  const maskedHeaders = maskSensitiveHeaders(response.headers);
  headersContent.textContent = JSON.stringify(maskedHeaders, null, 2);
}

// Display media response (images/videos)
function displayMediaResponse(response) {
  const mediaPreview = document.getElementById('media-preview');
  const bodyWrapper = document.getElementById('response-body-content-wrapper');
  
  mediaPreview.classList.remove('hidden');
  bodyWrapper.classList.add('hidden');
  
  if (response.contentType.startsWith('image/')) {
    const imageContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');
    
    imageContainer.classList.remove('hidden');
    document.getElementById('video-preview-container').classList.add('hidden');
    
    imagePreview.src = response.mediaData.imageUrl;
    document.getElementById('media-size').textContent = formatBytes(response.bodySize);
    document.getElementById('media-fetch-time').textContent = `${Math.round(response.mediaData.fetchTime)} ms`;
    document.getElementById('media-decode-time').textContent = `${Math.round(response.mediaData.decodeTime)} ms`;
    document.getElementById('media-content-type').textContent = response.contentType;
  } else if (response.contentType.startsWith('video/')) {
    const videoContainer = document.getElementById('video-preview-container');
    const videoPreview = document.getElementById('video-preview');
    
    videoContainer.classList.remove('hidden');
    document.getElementById('image-preview-container').classList.add('hidden');
    
    videoPreview.src = response.mediaData.videoUrl;
    document.getElementById('video-size').textContent = formatBytes(response.bodySize);
    document.getElementById('video-content-type').textContent = response.contentType;
    document.getElementById('video-load-time').textContent = `${Math.round(response.mediaData.fetchTime)} ms`;
  }
}

// Format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Highlight JSON
function highlightJSON(json) {
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
    let cls = 'json-number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'json-key';
      } else {
        cls = 'json-string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'json-boolean';
    } else if (/null/.test(match)) {
      cls = 'json-null';
    }
    return '<span class="' + cls + '">' + escapeHtml(match) + '</span>';
  });
}

// Analyze request and response for suggestions
function analyzeRequestAndResponse(request, response) {
  const suggestions = [];
  
  // Check for exposed tokens
  Object.entries(request.headers).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('authorization') || lowerKey.includes('token') || lowerKey.includes('api-key')) {
      if (value.length > 20) {
        suggestions.push({
          type: 'warning',
          icon: '⚠️',
          title: 'Authorization token exposed in headers',
          description: 'Consider using environment variables or secure storage for sensitive tokens.'
        });
      }
    }
  });
  
  // Check for Base64 in body
  if (request.body && typeof request.body === 'string') {
    const base64Regex = /^[A-Za-z0-9+/]{20,}={0,2}$/;
    if (base64Regex.test(request.body.trim())) {
      suggestions.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Base64 detected in body',
        description: 'Consider using binary upload for large Base64 data.'
      });
    }
  }
  
  // Check for Content-Type header
  if (['POST', 'PUT', 'PATCH'].includes(request.method) && request.body) {
    const hasContentType = Object.keys(request.headers).some(key => 
      key.toLowerCase() === 'content-type'
    );
    if (!hasContentType) {
      suggestions.push({
        type: 'warning',
        icon: '⚠️',
        title: 'No Content-Type header set',
        description: 'Setting Content-Type helps servers understand your request format.'
      });
    }
  }
  
  // Check payload size
  if (request.body && typeof request.body === 'string') {
    const size = new Blob([request.body]).size;
    if (size > 1024 * 1024) {
      suggestions.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Very large payload (>1MB)',
        description: 'Consider using file upload or chunked transfer for large payloads.'
      });
    }
  }
  
  // Check for sensitive fields
  if (request.body && typeof request.body === 'string') {
    const sensitivePatterns = /(password|token|secret|api[_-]?key|auth[_-]?token)/i;
    if (sensitivePatterns.test(request.body)) {
      suggestions.push({
        type: 'error',
        icon: '🔒',
        title: 'Sensitive fields detected',
        description: 'Ensure sensitive data is properly encrypted and not logged.'
      });
    }
  }
  
  // Check HTTPS usage
  const url = document.getElementById('request-url').value;
  if (url.startsWith('https://')) {
    suggestions.push({
      type: 'success',
      icon: '✅',
      title: 'HTTPS used',
      description: 'Good! Using HTTPS ensures encrypted communication.'
    });
  } else if (url.startsWith('http://')) {
    suggestions.push({
      type: 'error',
      icon: '🔒',
      title: 'HTTP used (not secure)',
      description: 'Consider using HTTPS for secure communication.'
    });
  }
  
  // Check response time
  if (response.duration > 2000) {
    suggestions.push({
      type: 'warning',
      icon: '⚠️',
      title: 'Slow response (>2s)',
      description: `Response took ${response.duration}ms. Consider optimizing the API or using caching.`
    });
  }
  
  displaySuggestions(suggestions);
}

// Display suggestions
function displaySuggestions(suggestions) {
  const panel = document.getElementById('suggestions-panel');
  const list = document.getElementById('suggestions-list');
  
  if (suggestions.length === 0) {
    panel.classList.add('hidden');
    return;
  }
  
  panel.classList.remove('hidden');
  list.innerHTML = '';
  
  suggestions.forEach(suggestion => {
    const item = document.createElement('div');
    item.className = `suggestion-item ${suggestion.type}`;
    item.innerHTML = `
      <span class="suggestion-icon">${suggestion.icon}</span>
      <div class="suggestion-content">
        <div class="suggestion-title">${escapeHtml(suggestion.title)}</div>
        <div class="suggestion-description">${escapeHtml(suggestion.description)}</div>
      </div>
    `;
    list.appendChild(item);
  });
}

// Get current request in a normalized shape for cURL generation
function getCurrentCurlRequest() {
  const method = document.getElementById('request-method').value;
  let url = document.getElementById('request-url').value;
  const headers = getHeaders();
  const body = getRequestBody();
  const params = getQueryParams();

  // Build URL with query params
  if (Object.keys(params).length > 0) {
    try {
      const urlObj = new URL(url);
      Object.entries(params).forEach(([key, value]) => {
        urlObj.searchParams.set(key, value);
      });
      url = urlObj.toString();
    } catch (e) {
      Debug.error('Failed to build URL with params:', e);
    }
  }

  return { method, url, headers, body };
}

// cURL generators for different environments
function toCurlBash(request, isSingleLine) {
  const req = request || getCurrentCurlRequest();
  let cmd = `curl -X ${req.method} "${req.url}"`;

  Object.entries(req.headers || {}).forEach(([key, value]) => {
    if (isSingleLine) {
      cmd += ` -H "${key}: ${value}"`;
    } else {
      cmd += ` \\\n  -H "${key}: ${value}"`;
    }
  });

  if (req.body && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    if (isSingleLine) {
      // Escape double quotes for safer single-line usage
      const escaped = String(req.body).replace(/"/g, '\\"');
      cmd += ` -d "${escaped}"`;
    } else {
      cmd += ` \\\n  -d '${req.body}'`;
    }
  }

  return cmd;
}

function toCurlWindows(request) {
  const req = request || getCurrentCurlRequest();
  let cmd = `curl -X ${req.method} "${req.url}"`;

  Object.entries(req.headers || {}).forEach(([key, value]) => {
    cmd += ` ^\n  -H "${key}: ${value}"`;
  });

  if (req.body && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const escaped = String(req.body).replace(/"/g, '\\"');
    cmd += ` ^\n  -d "${escaped}"`;
  }

  return cmd;
}

function toCurlPostman(request) {
  const req = request || getCurrentCurlRequest();
  let cmd = `curl --location '${req.url}'`;

  Object.entries(req.headers || {}).forEach(([key, value]) => {
    cmd += ` \\\n--header '${key}: ${value}'`;
  });

  if (req.body && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    cmd += ` \\\n--data '${req.body}'`;
  }

  return cmd;
}

function toPowerShell(request) {
  const req = request || getCurrentCurlRequest();
  const headerEntries = Object.entries(req.headers || {});
  const headersString = headerEntries
    .map(([key, value]) => `"${key}"="${value}"`)
    .join('; ');

  const body = req.body ? String(req.body) : '';

  return `curl -Method ${req.method} "${req.url}" \`
  -Headers @{ ${headersString} } \`
  -Body '${body}'`;
}

// Build cURL command from current builder state (bash-style)
function buildCurlFromBuilder(isSingleLine) {
  const req = getCurrentCurlRequest();
  return toCurlBash(req, isSingleLine);
}

// Copy as cURL (from Postman-like interface)
function copyAsCurl() {
  const curl = buildCurlFromBuilder(false);
  copyToClipboard(curl);
  showSuccess('cURL command copied to clipboard');
  trackCurlEvent('copy_curl');
}

// Handle copy variants for the Copy dropdown
function handleCopyOption(type) {
  const preview = document.getElementById('copy-preview');
  const label = document.getElementById('copy-preview-label');
  const curlInput = document.getElementById('curl-input');
  
  let text = '';
  let labelText = 'Last copied cURL';
  let variant = type || 'builder';

  const request = getCurrentCurlRequest();

  if (variant === 'bash') {
    text = toCurlBash(request, false);
    labelText = 'Last copied cURL (bash / Linux / Mac)';
  } else if (variant === 'bash-single' || variant === 'compact') {
    text = toCurlBash(request, true);
    labelText = 'Last copied cURL (single-line bash)';
    variant = 'bash-single';
  } else if (variant === 'windows') {
    text = toCurlWindows(request);
    labelText = 'Last copied cURL (Windows CMD)';
  } else if (variant === 'postman') {
    text = toCurlPostman(request);
    labelText = 'Last copied cURL (Postman style)';
  } else if (variant === 'powershell') {
    text = toPowerShell(request);
    labelText = 'Last copied command (PowerShell Invoke-WebRequest)';
  } else if (variant === 'input') {
    text = (curlInput && curlInput.value) ? curlInput.value.trim() : '';
    labelText = 'Last copied cURL (original input)';
  } else {
    // Default: multi-line builder variant
    text = buildCurlFromBuilder(false);
    labelText = 'Last copied cURL (from builder)';
    variant = 'builder';
  }

  if (!text) {
    showError('Nothing to copy. Please paste or build a request first.');
    return;
  }

  copyToClipboard(text);
  if (preview) {
    preview.value = text;
  }
  if (label) {
    label.textContent = labelText;
  }

  showSuccess('cURL command copied to clipboard');
  trackCurlEvent('copy_curl_variant', { variant });
}

// Reset request (clear Postman-like interface)
function resetBuilder() {
  document.getElementById('request-method').value = 'GET';
  document.getElementById('request-url').value = '';
  document.getElementById('request-body').value = '';
  document.getElementById('headers-container').innerHTML = '';
  document.getElementById('params-container').innerHTML = '';
  document.getElementById('form-body-container').innerHTML = '';
  document.getElementById('postman-interface').classList.add('hidden');
  document.getElementById('response-viewer').classList.add('hidden');
  currentRequest = { method: 'GET', url: '', queryParams: {}, headers: {}, body: null, bodyType: 'raw' };
  updateHeadersCount();
  trackCurlEvent('reset_builder');
}

// Environment variables
function addEnvVarRow(key = '', value = '') {
  const container = document.getElementById('env-vars-container');
  const row = document.createElement('div');
  row.className = 'env-var-row header-row';
  row.innerHTML = `
    <input type="text" class="env-var-key px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" placeholder="Variable name" value="${escapeHtml(key)}" />
    <input type="text" class="env-var-value px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" placeholder="Variable value" value="${escapeHtml(value)}" />
    <button class="remove-env-var-btn remove-btn" type="button">Remove</button>
  `;
  container.appendChild(row);
}

function removeEnvVarRow(row) {
  const key = row.querySelector('.env-var-key').value.trim();
  delete envVars[key];
  row.remove();
  saveState();
}

function updateEnvVar(input) {
  const row = input.closest('.env-var-row');
  const key = row.querySelector('.env-var-key').value.trim();
  const value = row.querySelector('.env-var-value').value.trim();
  if (key) {
    envVars[key] = value;
    saveState();
  }
}

function renderEnvVars() {
  const container = document.getElementById('env-vars-container');
  container.innerHTML = '';
  Object.entries(envVars).forEach(([key, value]) => {
    addEnvVarRow(key, value);
  });
}

function replaceEnvVars(text) {
  let result = text;
  Object.entries(envVars).forEach(([key, value]) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    result = result.replace(regex, value);
  });
  return result;
}

// Legacy code generation functions - kept for backward compatibility
// Now using generateCodeForLanguage() instead

// Switch code generation tab
function switchCodeTab(lang) {
  document.querySelectorAll('.code-tab-btn').forEach(btn => {
    if (btn.dataset.lang === lang) {
      btn.classList.add('active', 'border-b-2', 'border-primary-600', 'text-primary-600', 'dark:text-primary-400');
      btn.classList.remove('text-gray-600', 'dark:text-gray-400');
    } else {
      btn.classList.remove('active', 'border-b-2', 'border-primary-600', 'text-primary-600', 'dark:text-primary-400');
      btn.classList.add('text-gray-600', 'dark:text-gray-400');
    }
  });
}

// Generate code for specific language
function generateCodeForLanguage(lang) {
  const method = document.getElementById('request-method').value;
  const url = document.getElementById('request-url').value;
  const headers = getHeaders();
  const body = getRequestBody();
  
  let code = '';
  
  switch (lang) {
    case 'fetch':
      code = generateFetchCodeSnippet(method, url, headers, body);
      break;
    case 'axios':
      code = generateAxiosCodeSnippet(method, url, headers, body);
      break;
    case 'react-native':
      code = generateReactNativeCode(method, url, headers, body);
      break;
    case 'kotlin':
      code = generateKotlinCode(method, url, headers, body);
      break;
    case 'swift':
      code = generateSwiftCode(method, url, headers, body);
      break;
    case 'python':
      code = generatePythonCode(method, url, headers, body);
      break;
    case 'nodejs':
      code = generateNodeJSCode(method, url, headers, body);
      break;
    default:
      code = generateFetchCodeSnippet(method, url, headers, body);
  }
  
  document.getElementById('generated-code').value = code;
  trackCurlEvent('generate_code', { type: lang });
}

function generateFetchCodeSnippet(method, url, headers, body) {
  let code = `fetch('${url}', {\n`;
  code += `  method: '${method}',\n`;
  
  if (Object.keys(headers).length > 0) {
    code += `  headers: {\n`;
    Object.entries(headers).forEach(([key, value]) => {
      code += `    '${key}': '${value}',\n`;
    });
    code += `  },\n`;
  }
  
  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    if (currentRequest.bodyType === 'json') {
      try {
        const jsonBody = JSON.parse(body);
        code += `  body: JSON.stringify(${JSON.stringify(jsonBody, null, 2)}),\n`;
      } catch (e) {
        code += `  body: JSON.stringify(${JSON.stringify(body)}),\n`;
      }
    } else {
      code += `  body: '${body}',\n`;
    }
  }
  
  code += `})\n`;
  code += `  .then(response => response.json())\n`;
  code += `  .then(data => console.log(data))\n`;
  code += `  .catch(error => console.error('Error:', error));`;
  
  return code;
}

function generateAxiosCodeSnippet(method, url, headers, body) {
  const methodLower = method.toLowerCase();
  let code = `axios.${methodLower}('${url}'`;
  
  const config = {};
  if (Object.keys(headers).length > 0) {
    config.headers = headers;
  }
  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    if (currentRequest.bodyType === 'json') {
      try {
        config.data = JSON.parse(body);
      } catch (e) {
        config.data = body;
      }
    } else {
      config.data = body;
    }
  }
  
  if (Object.keys(config).length > 0) {
    code += `, ${JSON.stringify(config, null, 2)}`;
  }
  
  code += `)\n`;
  code += `  .then(response => console.log(response.data))\n`;
  code += `  .catch(error => console.error('Error:', error));`;
  
  return code;
}

function generateReactNativeCode(method, url, headers, body) {
  let code = `import { fetch } from 'react-native';\n\n`;
  code += `fetch('${url}', {\n`;
  code += `  method: '${method}',\n`;
  
  if (Object.keys(headers).length > 0) {
    code += `  headers: {\n`;
    Object.entries(headers).forEach(([key, value]) => {
      code += `    '${key}': '${value}',\n`;
    });
    code += `  },\n`;
  }
  
  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    if (currentRequest.bodyType === 'json') {
      try {
        const jsonBody = JSON.parse(body);
        code += `  body: JSON.stringify(${JSON.stringify(jsonBody, null, 2)}),\n`;
      } catch (e) {
        code += `  body: JSON.stringify(${JSON.stringify(body)}),\n`;
      }
    } else {
      code += `  body: '${body}',\n`;
    }
  }
  
  code += `})\n`;
  code += `  .then(response => response.json())\n`;
  code += `  .then(data => console.log(data))\n`;
  code += `  .catch(error => console.error('Error:', error));`;
  
  return code;
}

function generateKotlinCode(method, url, headers, body) {
  let code = `import okhttp3.*\n\n`;
  code += `val client = OkHttpClient()\n\n`;
  
  let requestBody = 'null';
  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    if (currentRequest.bodyType === 'json') {
      requestBody = `RequestBody.create(\n    MediaType.parse("application/json"),\n    """${body}"""\n  )`;
    } else {
      requestBody = `RequestBody.create(\n    MediaType.parse("text/plain"),\n    "${body}"\n  )`;
    }
  }
  
  code += `val request = Request.Builder()\n`;
  code += `  .url("${url}")\n`;
  code += `  .${method.toLowerCase()}(${requestBody})\n`;
  
  Object.entries(headers).forEach(([key, value]) => {
    code += `  .addHeader("${key}", "${value}")\n`;
  });
  
  code += `  .build()\n\n`;
  code += `val response = client.newCall(request).execute()\n`;
  code += `val responseBody = response.body?.string()\n`;
  code += `println(responseBody)`;
  
  return code;
}

function generateSwiftCode(method, url, headers, body) {
  let code = `import Foundation\n\n`;
  code += `let url = URL(string: "${url}")!\n`;
  code += `var request = URLRequest(url: url)\n`;
  code += `request.httpMethod = "${method}"\n\n`;
  
  Object.entries(headers).forEach(([key, value]) => {
    code += `request.setValue("${value}", forHTTPHeaderField: "${key}")\n`;
  });
  
  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    code += `request.httpBody = """${body}""".data(using: .utf8)\n\n`;
  }
  
  code += `let task = URLSession.shared.dataTask(with: request) { data, response, error in\n`;
  code += `  if let error = error {\n`;
  code += `    print("Error: \\(error)")\n`;
  code += `    return\n`;
  code += `  }\n`;
  code += `  if let data = data {\n`;
  code += `    print(String(data: data, encoding: .utf8) ?? "")\n`;
  code += `  }\n`;
  code += `}\n`;
  code += `task.resume()`;
  
  return code;
}

function generatePythonCode(method, url, headers, body) {
  let code = `import requests\n\n`;
  code += `url = "${url}"\n`;
  
  if (Object.keys(headers).length > 0) {
    code += `headers = {\n`;
    Object.entries(headers).forEach(([key, value]) => {
      code += `    "${key}": "${value}",\n`;
    });
    code += `}\n\n`;
  }
  
  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    if (currentRequest.bodyType === 'json') {
      code += `data = ${body}\n\n`;
    } else {
      code += `data = "${body}"\n\n`;
    }
  }
  
  code += `response = requests.${method.toLowerCase()}(url`;
  if (Object.keys(headers).length > 0) {
    code += `, headers=headers`;
  }
  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    if (currentRequest.bodyType === 'json') {
      code += `, json=data`;
    } else {
      code += `, data=data`;
    }
  }
  code += `)\n\n`;
  code += `print(response.json())`;
  
  return code;
}

function generateNodeJSCode(method, url, headers, body) {
  let code = `const https = require('https');\n`;
  code += `const http = require('http');\n\n`;
  code += `const url = new URL('${url}');\n`;
  code += `const isHttps = url.protocol === 'https:';\n`;
  code += `const client = isHttps ? https : http;\n\n`;
  
  const options = {
    hostname: new URL(url).hostname,
    port: new URL(url).port || (isHttps ? 443 : 80),
    path: new URL(url).pathname + new URL(url).search,
    method: method,
    headers: headers
  };
  
  code += `const options = ${JSON.stringify(options, null, 2)};\n\n`;
  
  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    code += `const data = ${JSON.stringify(body)};\n\n`;
    code += `options.headers['Content-Length'] = Buffer.byteLength(data);\n\n`;
  }
  
  code += `const req = client.request(options, (res) => {\n`;
  code += `  let responseData = '';\n`;
  code += `  res.on('data', (chunk) => {\n`;
  code += `    responseData += chunk;\n`;
  code += `  });\n`;
  code += `  res.on('end', () => {\n`;
  code += `    console.log(JSON.parse(responseData));\n`;
  code += `  });\n`;
  code += `});\n\n`;
  
  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    code += `req.write(data);\n`;
  }
  
  code += `req.end();`;
  
  return code;
}

// Copy generated code
function copyGeneratedCode() {
  const code = document.getElementById('generated-code').value;
  if (!code) return;
  copyToClipboard(code);
  showSuccess('Code copied to clipboard');
  trackCurlEvent('copy_generated_code');
}

// Copy response
function copyResponse() {
  if (!currentResponse) return;
  const activeTab = document.querySelector('.response-tab.active')?.dataset.tab || 'body';
  let text = '';
  
  if (activeTab === 'body') {
    if (currentResponse.isMedia) {
      text = `[${currentResponse.contentType} - ${formatBytes(currentResponse.bodySize)}]`;
    } else {
      text = typeof currentResponse.body === 'object' 
        ? JSON.stringify(currentResponse.body, null, 2)
        : currentResponse.bodyText;
    }
  } else if (activeTab === 'headers') {
    text = JSON.stringify(currentResponse.headers, null, 2);
  } else if (activeTab === 'timings') {
    text = JSON.stringify(currentResponse.timings, null, 2);
  } else {
    text = currentResponse.bodyText;
  }
  
  copyToClipboard(text);
  showSuccess('Response copied to clipboard');
  trackCurlEvent('copy_response', { tab: activeTab });
}

// Copy headers
function copyHeaders() {
  if (!currentResponse) return;
  const maskedHeaders = maskSensitiveHeaders(currentResponse.headers);
  const text = JSON.stringify(maskedHeaders, null, 2);
  copyToClipboard(text);
  showSuccess('Headers copied to clipboard');
  trackCurlEvent('copy_headers');
}

// Download response
function downloadResponse() {
  if (!currentResponse) return;
  const activeTab = document.querySelector('.response-tab.active').dataset.tab;
  let content = '';
  let filename = 'response';
  let mimeType = 'text/plain';
  
  if (activeTab === 'body') {
    content = typeof currentResponse.body === 'object' 
      ? JSON.stringify(currentResponse.body, null, 2)
      : currentResponse.bodyText;
    filename = 'response.json';
    mimeType = 'application/json';
  } else if (activeTab === 'headers') {
    content = JSON.stringify(currentResponse.headers, null, 2);
    filename = 'headers.json';
    mimeType = 'application/json';
  } else {
    content = currentResponse.bodyText;
    filename = 'response.txt';
  }
  
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  
  trackCurlEvent('download_response', { type: activeTab });
}

// Utility functions
function copyToClipboard(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
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

/**
 * Open current response body in JSON Formatter tool.
 * Copies the JSON/Raw body into localStorage and opens the formatter in a new tab.
 */
function openResponseInJsonFormatter() {
  try {
    const bodyElement = document.getElementById('response-body-content');
    if (!bodyElement) {
      showError('No response body available to format.');
      return;
    }

    const rawText = bodyElement.textContent || '';
    if (!rawText.trim()) {
      showError('No response body available to format.');
      return;
    }

    // Store in localStorage for the JSON Formatter page to consume
    try {
      localStorage.setItem('json_formatter_input', rawText);
    } catch (storageError) {
      Debug.error('Failed to store JSON for formatter:', storageError);
    }

    // Navigate to JSON Formatter in the SAME tab (same origin)
    const formatterUrl = window.location.origin + '/jsonformatter/index.html';
    window.location.href = formatterUrl;
  } catch (error) {
    Debug.error('Failed to open response in JSON Formatter:', error);
    showError('Could not open JSON in formatter. Please try again.');
  }
}

// cURL Convenience Tools - Copy Variants
function copyCurlVariant(variant) {
  if (!currentRequest || !currentRequest.url) {
    showError('No request to copy');
    return;
  }
  
  const method = currentRequest.method || 'GET';
  const url = currentRequest.url;
  const headers = currentRequest.headers || {};
  const body = currentRequest.body;
  
  let curl = '';
  
  switch (variant) {
    case 'original':
      curl = buildCurlCommand(method, url, headers, body, false);
      break;
    case 'compact':
      curl = buildCurlCommand(method, url, headers, body, true);
      break;
    case 'terminal-safe':
      curl = buildCurlCommand(method, url, headers, body, false, true);
      break;
    case 'no-headers':
      curl = buildCurlCommand(method, url, {}, body, false);
      break;
    case 'no-auth':
      const filteredHeaders = {};
      Object.entries(headers).forEach(([key, value]) => {
        const lowerKey = key.toLowerCase();
        if (!lowerKey.includes('authorization') && !lowerKey.includes('auth') && !lowerKey.includes('token') && !lowerKey.includes('api-key')) {
          filteredHeaders[key] = value;
        }
      });
      curl = buildCurlCommand(method, url, filteredHeaders, body, false);
      break;
  }
  
  copyToClipboard(curl);
  showSuccess(`cURL (${variant}) copied to clipboard`);
  trackCurlEvent('copy_curl_variant', { variant });
}

function buildCurlCommand(method, url, headers, body, compact, terminalSafe) {
  let curl = 'curl';
  if (method !== 'GET') {
    curl += ` -X ${method}`;
  }
  
  if (!compact) {
    curl += ` \\\n  `;
  } else {
    curl += ' ';
  }
  
  curl += terminalSafe ? `"${url}"` : `'${url}'`;
  
  Object.entries(headers).forEach(([key, value]) => {
    if (compact) {
      curl += ` -H '${key}: ${value}'`;
    } else {
      curl += ` \\\n  -H '${key}: ${value}'`;
    }
  });
  
  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    if (compact) {
      curl += ` -d '${body}'`;
    } else {
      curl += ` \\\n  -d '${body}'`;
    }
  }
  
  return curl;
}

// Smart cURL Type Detection
function detectCurlType(parsed) {
  const types = [];
  
  if (parsed.method === 'GET' && !parsed.body) {
    types.push('Simple GET');
  }
  
  if (parsed.headers && Object.keys(parsed.headers).some(key => 
    key.toLowerCase().includes('authorization') || 
    key.toLowerCase().includes('token') ||
    key.toLowerCase().includes('api-key')
  )) {
    types.push('Authenticated');
  }
  
  if (parsed.method === 'OPTIONS') {
    types.push('CORS Preflight');
  }
  
  if (parsed.headers && Object.keys(parsed.headers).some(key => 
    key.toLowerCase() === 'content-type' && 
    parsed.headers[key].toLowerCase().includes('multipart')
  )) {
    types.push('Multipart/form-data');
  }
  
  if (parsed.body && (parsed.body.trim().startsWith('{') || parsed.body.trim().startsWith('['))) {
    types.push('JSON Body');
  }
  
  return types.length > 0 ? types.join(', ') : 'Standard Request';
}

function displayCurlType(parsed) {
  const type = detectCurlType(parsed);
  const detectionEl = document.getElementById('curl-type-detection');
  const messageEl = document.getElementById('curl-type-message');
  
  if (detectionEl && messageEl) {
    detectionEl.classList.remove('hidden');
    
    let message = `Detected: ${type}`;
    if (parsed.method === 'OPTIONS') {
      message += ' ⚠️ This is a CORS preflight request, not the actual API call';
    }
    
    messageEl.textContent = message;
  }
}

// Auto Error Explanation
function showErrorExplanation(error, statusCode, customMessage) {
  const explanationEl = document.getElementById('error-explanation');
  const textEl = document.getElementById('error-explanation-text');
  
  if (!explanationEl || !textEl) return;
  
  let explanation = '';
  
  if (customMessage) {
    explanation = customMessage;
  } else if (statusCode === 401) {
    explanation = 'Authorization header may be missing or invalid. Check your authentication token or credentials.';
  } else if (statusCode === 403) {
    explanation = 'Access forbidden. You may not have permission to access this resource.';
  } else if (statusCode === 404) {
    explanation = 'Resource not found. Check if the URL is correct.';
  } else if (statusCode === 500) {
    explanation = 'Internal server error. The server encountered an unexpected condition.';
  } else if (error && (error.message && (error.message.includes('CORS') || error.message.includes('Failed to fetch') || error.message.includes('Access-Control-Allow-Origin')))) {
    explanation = 'Browser blocked this request due to CORS policy. The API server needs to allow cross-origin requests. This is a browser security feature that prevents requests between different domains unless explicitly allowed by the server.';
  } else if (currentRequest && currentRequest.method === 'OPTIONS') {
    explanation = 'This is a preflight OPTIONS request, not the actual API call. The browser sends this automatically before the real request.';
  } else if (error && error.name === 'AbortError') {
    explanation = 'Request timed out. The server took too long to respond. Try increasing the timeout or check server status.';
  } else if (error) {
    explanation = `Request failed: ${error.message}`;
  }
  
  if (explanation) {
    explanationEl.classList.remove('hidden');
    textEl.textContent = explanation;
  } else {
    explanationEl.classList.add('hidden');
  }
}

// Header Masking
function maskSensitiveHeaders(headers) {
  const sensitiveKeys = ['authorization', 'cookie', 'x-api-key', 'api-key', 'token', 'auth'];
  const masked = {};
  
  Object.entries(headers).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      if (value.length > 10) {
        masked[key] = value.substring(0, 4) + '******' + value.substring(value.length - 4);
      } else {
        masked[key] = '******';
      }
    } else {
      masked[key] = value;
    }
  });
  
  return masked;
}

// Enhanced Performance Metrics
function calculatePerformanceMetrics(response, startTime, endTime) {
  const duration = endTime - startTime;
  const bodySize = new Blob([response.bodyText || '']).size;
  
  let headerSize = 0;
  Object.entries(response.headers || {}).forEach(([key, value]) => {
    headerSize += new Blob([`${key}: ${value}\r\n`]).size;
  });
  
  const totalSize = bodySize + headerSize;
  
  const ttfb = response.ttfb || duration * 0.3;
  
  return {
    duration: Math.round(duration),
    ttfb: Math.round(ttfb),
    bodySize,
    headerSize,
    totalSize
  };
}

// Request History
function saveToHistory(request, response) {
  try {
    const history = JSON.parse(localStorage.getItem('curl_tester_history') || '[]');
    const historyItem = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      method: request.method,
      url: request.url,
      status: response?.status || 'Error',
      duration: response?.duration || 0,
      success: response && response.status >= 200 && response.status < 300
    };
    
    history.unshift(historyItem);
    history.splice(10);
    
    localStorage.setItem('curl_tester_history', JSON.stringify(history));
    loadRequestHistory();
  } catch (error) {
    Debug.error('Failed to save history:', error);
  }
}

function loadRequestHistory() {
  try {
    const history = JSON.parse(localStorage.getItem('curl_tester_history') || '[]');
    const container = document.getElementById('request-history-list');
    const noHistoryMsg = document.getElementById('no-history-message');
    
    if (!container) return;
    
    if (history.length === 0) {
      if (noHistoryMsg) noHistoryMsg.classList.remove('hidden');
      container.innerHTML = '';
      return;
    }
    
    if (noHistoryMsg) noHistoryMsg.classList.add('hidden');
    
    container.innerHTML = history.map(item => `
      <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer" data-id="${item.id}">
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <span class="px-2 py-1 text-xs font-semibold rounded ${item.success ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}">${item.method}</span>
            <span class="text-sm font-medium text-gray-900 dark:text-white">${item.status}</span>
            <span class="text-xs text-gray-500 dark:text-gray-400">${item.duration}ms</span>
          </div>
          <div class="text-xs text-gray-600 dark:text-gray-300 mt-1 truncate">${item.url}</div>
          <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">${new Date(item.timestamp).toLocaleString()}</div>
        </div>
        <button class="load-history-item-btn px-2 py-1 text-xs text-primary-600 dark:text-primary-400 hover:underline" data-id="${item.id}">
          Load
        </button>
      </div>
    `).join('');
    
    container.querySelectorAll('.load-history-item-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        loadHistoryItem(id);
      });
    });
  } catch (error) {
    Debug.error('Failed to load history:', error);
  }
}

function loadHistoryItem(id) {
  try {
    const history = JSON.parse(localStorage.getItem('curl_tester_history') || '[]');
    const item = history.find(h => h.id === id);
    if (!item) return;
    
    document.getElementById('request-method').value = item.method;
    document.getElementById('request-url').value = item.url;
    updateCurrentRequest();
    
    // Generate cURL command and update textarea
    const curlCommand = buildCurlFromBuilder(false);
    document.getElementById('curl-input').value = curlCommand;
    
    trackCurlEvent('load_history_item');
  } catch (error) {
    Debug.error('Failed to load history item:', error);
  }
}

function clearRequestHistory() {
  if (confirm('Clear all request history?')) {
    localStorage.removeItem('curl_tester_history');
    loadRequestHistory();
    trackCurlEvent('clear_history');
  }
}

// Create expandable JSON tree (simplified version)
function createExpandableJSON(obj) {
  const jsonString = JSON.stringify(obj, null, 2);
  return highlightJSON(jsonString);
}

// Search in Response
function searchInResponse() {
  const searchTerm = document.getElementById('response-search').value.toLowerCase();
  const contentEl = document.getElementById('response-body-content');
  
  if (!contentEl || !currentResponse) return;
  
  const originalHTML = contentEl.getAttribute('data-original-html') || contentEl.innerHTML;
  contentEl.setAttribute('data-original-html', originalHTML);
  
  if (!searchTerm) {
    contentEl.innerHTML = originalHTML;
    return;
  }
  
  const textContent = contentEl.textContent || '';
  const lines = textContent.split('\n');
  const highlighted = lines.map(line => {
    if (line.toLowerCase().includes(searchTerm)) {
      return `<mark class="bg-yellow-200 dark:bg-yellow-800">${escapeHtml(line)}</mark>`;
    }
    return escapeHtml(line);
  }).join('\n');
  
  contentEl.innerHTML = highlighted;
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
