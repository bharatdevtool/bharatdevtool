// regex-engine.js - Regex testing and matching utilities
// Bharat Dev Tools - Regex Engine Module

// Helper function to log errors to Sentry
function logErrorToSentry(error, context = {}) {
  if (typeof Sentry !== 'undefined' && typeof Sentry.captureException === 'function') {
    try {
      Sentry.captureException(error, {
        tags: {
          operation: 'regex_operation',
          ...context.tags
        },
        extra: {
          errorType: error.name,
          errorMessage: error.message,
          ...context.extra
        }
      });
    } catch (sentryErr) {
      // Fail silently if Sentry is not available
    }
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

/**
 * Escapes special regex characters in a string
 * @param {string} text - The text to escape
 * @returns {string} Escaped regex string
 */
export function escapeRegex(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  try {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  } catch (error) {
    logErrorToSentry(error, {
      tags: { function: 'escapeRegex' },
      extra: { inputLength: text.length }
    });
    return text;
  }
}

/**
 * Unescapes regex characters in a string
 * @param {string} text - The text to unescape
 * @returns {string} Unescaped regex string
 */
export function unescapeRegex(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  try {
    return text.replace(/\\(.)/g, '$1');
  } catch (error) {
    logErrorToSentry(error, {
      tags: { function: 'unescapeRegex' },
      extra: { inputLength: text.length }
    });
    return text;
  }
}

/**
 * Validates if a regex pattern is valid
 * @param {string} pattern - The regex pattern to validate
 * @param {string} flavor - The regex flavor (javascript, python, golang, java, pcre)
 * @param {string} flagsString - Optional flags string for JavaScript validation
 * @returns {object} Validation result with isValid and error message
 */
export function validateRegexPattern(pattern, flavor = 'javascript', flagsString = '') {
  if (!pattern || pattern.trim().length === 0) {
    return { isValid: false, error: 'Pattern is empty' };
  }
  
  try {
    if (flavor === 'javascript') {
      // For JavaScript, try to create RegExp with the actual flags that will be used
      new RegExp(pattern, flagsString);
      return { isValid: true, error: null };
    } else if (flavor === 'python') {
      // Python regex validation (basic check)
      // Try to validate using JavaScript regex as a proxy (most patterns are similar)
      try {
        new RegExp(pattern);
      } catch (e) {
        return { isValid: false, error: `Invalid regex syntax: ${e.message}` };
      }
      // Additional Python-specific checks
      if (pattern.includes('(?P<') && !pattern.match(/\(\?P<[^>]+>/)) {
        return { isValid: false, error: 'Invalid Python named group syntax' };
      }
      return { isValid: true, error: null };
    } else if (flavor === 'golang') {
      // Golang regex validation (basic check)
      // Try to validate using JavaScript regex as a proxy
      try {
        new RegExp(pattern);
      } catch (e) {
        return { isValid: false, error: `Invalid regex syntax: ${e.message}` };
      }
      // Additional Golang-specific checks
      if (pattern.includes('(?P<') && !pattern.match(/\(\?P<[^>]+>/)) {
        return { isValid: false, error: 'Invalid Golang named group syntax' };
      }
      return { isValid: true, error: null };
    } else if (flavor === 'java') {
      // Java regex validation (basic check)
      // Try to validate using JavaScript regex as a proxy
      try {
        new RegExp(pattern);
      } catch (e) {
        return { isValid: false, error: `Invalid regex syntax: ${e.message}` };
      }
      // Additional Java-specific checks
      if (pattern.includes('\\Q') && !pattern.includes('\\E')) {
        return { isValid: false, error: 'Unclosed \\Q...\\E literal escape' };
      }
      return { isValid: true, error: null };
    } else if (flavor === 'pcre') {
      // PCRE regex validation (basic check)
      // Try to validate using JavaScript regex as a proxy
      try {
        new RegExp(pattern);
      } catch (e) {
        return { isValid: false, error: `Invalid regex syntax: ${e.message}` };
      }
      return { isValid: true, error: null };
    }
    
    return { isValid: true, error: null };
  } catch (error) {
    trackValidationError({
      operation: 'validate_regex',
      error_type: error.name,
      error_message: error.message,
      pattern_preview: pattern.substring(0, 100),
      flavor: flavor
    });
    
    return { isValid: false, error: error.message };
  }
}

/**
 * Tests a regex pattern against input text
 * @param {string} pattern - The regex pattern
 * @param {string} text - The text to test against
 * @param {object} flags - Regex flags { caseSensitive, global, multiline }
 * @param {string} flavor - The regex flavor
 * @returns {object} Test result with matches, groups, execution time, etc.
 */
export function testRegex(pattern, text, flags = {}, flavor = 'javascript') {
  const startTime = performance.now();
  
  if (!pattern || pattern.trim().length === 0) {
    return {
      matches: [],
      matchCount: 0,
      groups: [],
      executionTime: 0,
      error: null,
      isValid: false
    };
  }
  
  if (!text) {
    text = '';
  }
  
  // Build flags string first (needed for validation)
  let flagsString = '';
  if (flags.global) flagsString += 'g';
  if (!flags.caseSensitive) flagsString += 'i';
  if (flags.multiline) flagsString += 'm';
  
  try {
    // Validate pattern first (with flags for JavaScript)
    const validation = validateRegexPattern(pattern, flavor, flagsString);
    if (!validation.isValid) {
      return {
        matches: [],
        matchCount: 0,
        groups: [],
        executionTime: performance.now() - startTime,
        error: validation.error,
        isValid: false
      };
    }
    
    // Create regex (only for JavaScript flavor in browser)
    if (flavor === 'javascript') {
      let regex;
      try {
        regex = new RegExp(pattern, flagsString);
      } catch (regexError) {
        // If RegExp creation fails, return error
        return {
          matches: [],
          matchCount: 0,
          groups: [],
          executionTime: performance.now() - startTime,
          error: `Invalid regex pattern: ${regexError.message}`,
          isValid: false
        };
      }
      
      const matches = [];
      const groups = [];
      let matchCount = 0;
      
      if (flags.global) {
        // Get all matches
        let match;
        while ((match = regex.exec(text)) !== null) {
          matchCount++;
          const matchInfo = {
            index: match.index,
            length: match[0].length,
            match: match[0],
            groups: []
          };
          
          // Extract groups
          for (let i = 1; i < match.length; i++) {
            if (match[i] !== undefined) {
              matchInfo.groups.push({
                index: i - 1,
                value: match[i],
                start: match.index + match[0].indexOf(match[i]),
                end: match.index + match[0].indexOf(match[i]) + match[i].length
              });
            }
          }
          
          matches.push(matchInfo);
          
          // Prevent infinite loop on zero-length matches
          if (match[0].length === 0) {
            regex.lastIndex++;
          }
        }
      } else {
        // Single match
        const match = regex.exec(text);
        if (match) {
          matchCount = 1;
          const matchInfo = {
            index: match.index,
            length: match[0].length,
            match: match[0],
            groups: []
          };
          
          for (let i = 1; i < match.length; i++) {
            if (match[i] !== undefined) {
              matchInfo.groups.push({
                index: i - 1,
                value: match[i],
                start: match.index + match[0].indexOf(match[i]),
                end: match.index + match[0].indexOf(match[i]) + match[i].length
              });
            }
          }
          
          matches.push(matchInfo);
        }
      }
      
      const executionTime = performance.now() - startTime;
      
      return {
        matches,
        matchCount,
        groups: matches.flatMap(m => m.groups),
        executionTime,
        error: null,
        isValid: true
      };
    } else {
      // For other flavors, we can only validate syntax, not execute
      // In a real implementation, you might use a library or backend
      // Since we can't execute non-JavaScript regex in the browser,
      // we'll show a note instead of an error
      return {
        matches: [],
        matchCount: 0,
        groups: [],
        executionTime: performance.now() - startTime,
        error: null,
        isValid: true,
        note: `Pattern syntax is valid for ${flavor} flavor, but execution requires backend processing. Switch to JavaScript flavor to test the pattern.`
      };
    }
  } catch (error) {
    const executionTime = performance.now() - startTime;
    
    trackRegexError({
      operation: 'test_regex',
      error_type: error.name,
      error_message: error.message,
      pattern_preview: pattern.substring(0, 100),
      text_length: text.length,
      flavor: flavor
    });
    
    logErrorToSentry(error, {
      tags: { function: 'testRegex' },
      extra: {
        patternLength: pattern.length,
        textLength: text.length,
        flavor: flavor
      }
    });
    
    return {
      matches: [],
      matchCount: 0,
      groups: [],
      executionTime,
      error: error.message,
      isValid: false
    };
  }
}

/**
 * Detects potential catastrophic backtracking patterns
 * @param {string} pattern - The regex pattern to analyze
 * @returns {object} Analysis result with warnings
 */
export function detectCatastrophicBacktracking(pattern) {
  if (!pattern) {
    return { hasWarning: false, warnings: [] };
  }
  
  const warnings = [];
  
  // Check for nested quantifiers
  if (pattern.match(/\([^)]*\+[^)]*\+[^)]*\)/) || 
      pattern.match(/\([^)]*\*[^)]*\*[^)]*\)/) ||
      pattern.match(/\([^)]*\?[^)]*\?[^)]*\)/)) {
    warnings.push('Nested quantifiers detected - may cause catastrophic backtracking');
  }
  
  // Check for .*.* patterns
  if (pattern.match(/\.\*.*\.\*/)) {
    warnings.push('Multiple .* patterns may cause performance issues');
  }
  
  // Check for complex alternations
  const alternationCount = (pattern.match(/\|/g) || []).length;
  if (alternationCount > 10) {
    warnings.push('Many alternations may cause performance issues');
  }
  
  // Check for lookahead/lookbehind complexity
  if ((pattern.match(/\(\?=/g) || []).length > 5 || 
      (pattern.match(/\(\?<=/g) || []).length > 5) {
    warnings.push('Many lookahead/lookbehind assertions may cause performance issues');
  }
  
  return {
    hasWarning: warnings.length > 0,
    warnings
  };
}

/**
 * Formats a regex pattern for better readability
 * @param {string} pattern - The regex pattern to format
 * @returns {string} Formatted regex pattern
 */
export function formatRegexPattern(pattern) {
  if (!pattern) {
    return '';
  }
  
  // Basic formatting: add spaces around operators for readability
  // This is a simple formatter - can be enhanced
  let formatted = pattern
    .replace(/([|])/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return formatted;
}

/**
 * Explains regex pattern in human-readable format
 * @param {string} pattern - The regex pattern to explain
 * @returns {string} Human-readable explanation
 */
export function explainRegexPattern(pattern) {
  if (!pattern) {
    return 'Empty pattern';
  }
  
  const explanations = [];
  
  // Character classes
  if (pattern.includes('\\d')) {
    explanations.push('\\d matches any digit (0-9)');
  }
  if (pattern.includes('\\w')) {
    explanations.push('\\w matches any word character (letter, digit, underscore)');
  }
  if (pattern.includes('\\s')) {
    explanations.push('\\s matches any whitespace character');
  }
  if (pattern.includes('.')) {
    explanations.push('. matches any character except newline');
  }
  
  // Quantifiers
  if (pattern.includes('*')) {
    explanations.push('* matches zero or more of the preceding element');
  }
  if (pattern.includes('+')) {
    explanations.push('+ matches one or more of the preceding element');
  }
  if (pattern.includes('?')) {
    explanations.push('? matches zero or one of the preceding element');
  }
  
  // Anchors
  if (pattern.includes('^')) {
    explanations.push('^ matches the start of the string');
  }
  if (pattern.includes('$')) {
    explanations.push('$ matches the end of the string');
  }
  
  // Groups
  if (pattern.includes('(') && pattern.includes(')')) {
    explanations.push('() creates a capturing group');
  }
  
  // Lookahead/lookbehind
  if (pattern.includes('(?=')) {
    explanations.push('(?=...) is a positive lookahead');
  }
  if (pattern.includes('(?!')) {
    explanations.push('(?!...) is a negative lookahead');
  }
  if (pattern.includes('(?<=')) {
    explanations.push('(?<=...) is a positive lookbehind');
  }
  if (pattern.includes('(?<!')) {
    explanations.push('(?<!...) is a negative lookbehind');
  }
  
  if (explanations.length === 0) {
    return 'Pattern explanation not available';
  }
  
  return explanations.join('\n');
}

