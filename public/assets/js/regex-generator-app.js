// regex-generator-app.js - Regex Generator Application Logic
// Bharat Dev Tools - Regex Generator

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
      page: 'regex_generator',
      timestamp: Date.now()
    });
  }
}

// Application state
let currentPatternType = null;
let generatedPattern = null;
let generatedOptions = null;

// Initialize event listeners
function initEventListeners() {
  // Pattern type buttons
  document.querySelectorAll('.pattern-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      selectPatternType(type);
    });
  });
  
  // Generate button
  document.getElementById('generate-regex-btn').addEventListener('click', generateRegex);
  
  // Copy pattern button
  document.getElementById('copy-pattern-btn').addEventListener('click', copyPattern);
  
  // Download JSON button
  document.getElementById('download-json-btn').addEventListener('click', downloadJSON);
  
  // Auto-generate on option change
  const optionInputs = document.querySelectorAll('#options-panel input, #options-panel select');
  optionInputs.forEach(input => {
    input.addEventListener('change', () => {
      if (currentPatternType) {
        generateRegex();
      }
    });
  });
}

// Select pattern type
function selectPatternType(type) {
  currentPatternType = type;
  
  // Update UI
  document.querySelectorAll('.pattern-type-btn').forEach(btn => {
    if (btn.dataset.type === type) {
      btn.classList.add('border-primary-500');
      btn.classList.remove('border-transparent');
    } else {
      btn.classList.remove('border-primary-500');
      btn.classList.add('border-transparent');
    }
  });
  
  // Show options panel
  const optionsPanel = document.getElementById('options-panel');
  optionsPanel.classList.remove('hidden');
  
  // Update title
  const titles = {
    email: 'Email Regex Generator',
    phone: 'Phone Regex Generator',
    url: 'URL Regex Generator',
    username: 'Username Regex Generator',
    password: 'Password Regex Generator',
    date: 'Date Regex Generator',
    uuid: 'UUID Regex Generator',
    custom: 'Custom Regex Builder'
  };
  document.getElementById('options-title').textContent = titles[type] || 'Configure Pattern';
  
  // Hide all option sections
  document.querySelectorAll('[id$="-options"]').forEach(el => {
    el.classList.add('hidden');
  });
  
  // Show relevant option section
  const optionSection = document.getElementById(`${type}-options`);
  if (optionSection) {
    optionSection.classList.remove('hidden');
  }
  
  // Auto-generate
  generateRegex();
  
  trackRegexEvent('select_pattern_type', {
    pattern_type: type
  });
}

// Generate regex
function generateRegex() {
  if (!currentPatternType || !window.regexGenerator) {
    return;
  }
  
  let pattern = '';
  let options = {};
  let explanation = '';
  
  try {
    switch (currentPatternType) {
      case 'email':
        pattern = window.regexGenerator.generateEmailRegex();
        options = {};
        explanation = window.regexGenerator.explainGeneratedRegex(pattern, 'email', options);
        break;
        
      case 'phone':
        const phoneCountry = document.getElementById('phone-country').value;
        options = { country: phoneCountry };
        pattern = window.regexGenerator.generatePhoneRegex(options);
        explanation = window.regexGenerator.explainGeneratedRegex(pattern, 'phone', options);
        break;
        
      case 'url':
        pattern = window.regexGenerator.generateURLRegex();
        options = {};
        explanation = window.regexGenerator.explainGeneratedRegex(pattern, 'url', options);
        break;
        
      case 'username':
        options = {
          minLength: parseInt(document.getElementById('username-min-length').value) || 3,
          maxLength: parseInt(document.getElementById('username-max-length').value) || 20,
          allowUnderscore: document.getElementById('username-allow-underscore').checked,
          allowDash: document.getElementById('username-allow-dash').checked
        };
        pattern = window.regexGenerator.generateUsernameRegex(options);
        explanation = window.regexGenerator.explainGeneratedRegex(pattern, 'username', options);
        break;
        
      case 'password':
        options = {
          minLength: parseInt(document.getElementById('password-min-length').value) || 8,
          maxLength: parseInt(document.getElementById('password-max-length').value) || 128,
          requireUppercase: document.getElementById('password-require-uppercase').checked,
          requireLowercase: document.getElementById('password-require-lowercase').checked,
          requireDigit: document.getElementById('password-require-digit').checked,
          requireSpecial: document.getElementById('password-require-special').checked
        };
        pattern = window.regexGenerator.generatePasswordRegex(options);
        explanation = window.regexGenerator.explainGeneratedRegex(pattern, 'password', options);
        break;
        
      case 'date':
        const dateFormat = document.getElementById('date-format').value;
        options = { format: dateFormat };
        pattern = window.regexGenerator.generateDateRegex(options);
        explanation = window.regexGenerator.explainGeneratedRegex(pattern, 'date', options);
        break;
        
      case 'uuid':
        pattern = window.regexGenerator.generateUUIDRegex();
        options = {};
        explanation = window.regexGenerator.explainGeneratedRegex(pattern, 'uuid', options);
        break;
        
      case 'custom':
        options = {
          minLength: parseInt(document.getElementById('custom-min-length').value) || 1,
          maxLength: parseInt(document.getElementById('custom-max-length').value) || 100,
          includeUppercase: document.getElementById('custom-include-uppercase').checked,
          includeLowercase: document.getElementById('custom-include-lowercase').checked,
          includeDigits: document.getElementById('custom-include-digits').checked,
          includeSpecial: document.getElementById('custom-include-special').checked,
          allowedChars: document.getElementById('custom-allowed-chars').value || '',
          startAnchor: document.getElementById('custom-start-anchor').checked,
          endAnchor: document.getElementById('custom-end-anchor').checked
        };
        pattern = window.regexGenerator.generateCustomRegex(options);
        explanation = window.regexGenerator.explainGeneratedRegex(pattern, 'custom', options);
        break;
    }
    
    // Display generated regex
    generatedPattern = pattern;
    generatedOptions = { type: currentPatternType, ...options };
    
    document.getElementById('generated-pattern').value = pattern;
    document.getElementById('generated-explanation').textContent = explanation;
    
    // Show generated regex panel
    document.getElementById('generated-regex-panel').classList.remove('hidden');
    
    // Scroll to generated regex
    document.getElementById('generated-regex-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    trackRegexEvent('generate_regex', {
      pattern_type: currentPatternType,
      pattern_length: pattern.length
    });
    
  } catch (error) {
    Debug.error('Failed to generate regex:', error);
    alert('Failed to generate regex. Please check your options.');
  }
}

// Copy pattern to clipboard
function copyPattern() {
  const patternEl = document.getElementById('generated-pattern');
  patternEl.select();
  patternEl.setSelectionRange(0, 99999); // For mobile devices
  
  try {
    document.execCommand('copy');
    
    // Show feedback
    const btn = document.getElementById('copy-pattern-btn');
    const originalText = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('bg-green-600');
    btn.classList.remove('bg-primary-600');
    
    setTimeout(() => {
      btn.textContent = originalText;
      btn.classList.remove('bg-green-600');
      btn.classList.add('bg-primary-600');
    }, 2000);
    
    trackRegexEvent('copy_pattern', {
      pattern_type: currentPatternType
    });
    
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.trackCopyContent({
        page: 'regex_generator',
        content_type: 'regex_pattern'
      });
    }
  } catch (error) {
    Debug.error('Failed to copy:', error);
    alert('Failed to copy pattern. Please select and copy manually.');
  }
}

// Download as JSON
function downloadJSON() {
  if (!generatedPattern) {
    return;
  }
  
  const data = {
    pattern: generatedPattern,
    type: currentPatternType,
    options: generatedOptions,
    generated_at: new Date().toISOString(),
    tool: 'Bharat Dev Tools - Regex Generator'
  };
  
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `regex-${currentPatternType}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  trackRegexEvent('download_json', {
    pattern_type: currentPatternType
  });
}

// Initialize app
function initApp() {
  initEventListeners();
  trackRegexEvent('page_view');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}


