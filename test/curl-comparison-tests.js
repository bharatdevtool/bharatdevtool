// curl-comparison-tests.js - Test suite for cURL Comparison Tool

export class CurlComparisonTests {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  // Parse cURL command (simplified version matching the implementation)
  parseCurl(curlCommand) {
    const result = {
      method: 'GET',
      url: '',
      headers: {},
      body: null,
      queryParams: {}
    };
    
    // Normalize the command: remove backslash-newline sequences and normalize whitespace
    // JavaScript template literals already remove backslash-newline, but we need to handle
    // any remaining newlines and normalize whitespace
    let command = curlCommand.trim()
      .replace(/\\\s*\n\s*/g, ' ')  // Remove backslash-newline sequences (if any remain)
      .replace(/\n/g, ' ')          // Replace any remaining newlines with spaces
      .replace(/\s+/g, ' ')          // Normalize multiple spaces/newlines to single space
      .trim();
    
    if (command.toLowerCase().startsWith('curl')) {
      command = command.substring(4).trim();
    }
    
    // Remove common flags that don't affect parsing
    command = command.replace(/--compressed\s*/gi, '');
    command = command.replace(/-[vsi]\s+/gi, '');
    
    const methodMatch = command.match(/-X\s+(\w+)|--request\s+(\w+)/i);
    if (methodMatch) {
      result.method = (methodMatch[1] || methodMatch[2]).toUpperCase();
    }
    
    // Extract headers - handle both single and double quotes, and allow flexible spacing
    // Use a more robust regex that handles quotes inside the value
    const headerRegex = /-H\s+(['"])((?:(?!\1)[^\\]|\\.)*)\1|--header\s+(['"])((?:(?!\3)[^\\]|\\.)*)\3/gi;
    let headerMatch;
    while ((headerMatch = headerRegex.exec(command)) !== null) {
      const headerStr = headerMatch[2] || headerMatch[4];
      const colonIndex = headerStr.indexOf(':');
      if (colonIndex > 0) {
        const key = headerStr.substring(0, colonIndex).trim();
        const value = headerStr.substring(colonIndex + 1).trim();
        result.headers[key] = value;
      }
    }
    
    // Extract data/body - handle all variants with flexible spacing
    // Use a more robust regex that handles quotes inside the JSON/body
    const dataRegex = /(-d|--data|--data-raw|--data-binary)\s+(['"])((?:(?!\2)[^\\]|\\.)*)\2/i;
    const dataMatch = command.match(dataRegex);
    if (dataMatch) {
      result.body = dataMatch[3];
      if (!methodMatch) {
        result.method = 'POST';
      }
    }
    
    // Extract URL - find the last URL that's not inside quotes from headers/data
    const urlRegex = /(https?:\/\/[^\s'"]+)/gi;
    const urlMatches = [];
    let urlMatch;
    while ((urlMatch = urlRegex.exec(command)) !== null) {
      urlMatches.push({
        url: urlMatch[1],
        index: urlMatch.index
      });
    }
    
    if (urlMatches.length > 0) {
      // Use the last URL match (most likely the request URL)
      result.url = urlMatches[urlMatches.length - 1].url;
    } else {
      // Fallback: Try to find URL without protocol
      const urlMatch2 = command.match(/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s'"]*)/);
      if (urlMatch2) {
        result.url = 'https://' + urlMatch2[1];
      }
    }
    
    if (result.url) {
      try {
        const urlObj = new URL(result.url);
        urlObj.searchParams.forEach((value, key) => {
          result.queryParams[key] = value;
        });
      } catch (e) {
        // Ignore URL parsing errors in tests
      }
    }
    
    return result;
  }

  // Compare method
  compareMethod(methodA, methodB) {
    return {
      a: methodA,
      b: methodB,
      same: methodA === methodB
    };
  }

  // Compare headers
  compareHeaders(headersA, headersB, options = {}) {
    const differences = [];
    const missing = [];
    const extra = [];
    const same = [];
    
    const normalizedA = {};
    const normalizedB = {};
    
    Object.entries(headersA).forEach(([key, value]) => {
      const normalizedKey = options.caseInsensitive ? key.toLowerCase() : key;
      if (!options.ignoreHeaders || !options.ignoreHeaders.includes(normalizedKey) && !options.ignoreHeaders.includes(key)) {
        normalizedA[normalizedKey] = {
          originalKey: key,
          value: options.trimWhitespace ? value.trim() : value
        };
      }
    });
    
    Object.entries(headersB).forEach(([key, value]) => {
      const normalizedKey = options.caseInsensitive ? key.toLowerCase() : key;
      if (!options.ignoreHeaders || !options.ignoreHeaders.includes(normalizedKey) && !options.ignoreHeaders.includes(key)) {
        normalizedB[normalizedKey] = {
          originalKey: key,
          value: options.trimWhitespace ? value.trim() : value
        };
      }
    });
    
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
  compareQueryParams(paramsA, paramsB, options = {}) {
    const differences = [];
    const missing = [];
    const extra = [];
    const same = [];
    
    const normalizedA = {};
    const normalizedB = {};
    
    const ignoreQueryParams = options.ignoreQueryParams || [];
    const caseInsensitive = options.caseInsensitive || false;
    const trimWhitespace = options.trimWhitespace || false;
    
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

  // Compare JSON
  compareJson(objA, objB, options = {}, path = '') {
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
    
    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);
    const allKeys = new Set([...keysA, ...keysB]);
    
    allKeys.forEach(key => {
      const currentPath = path ? `${path}.${key}` : key;
      const shouldIgnore = options.ignoreJsonKeys && options.ignoreJsonKeys.some(ignoreKey => 
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
        const nestedResult = this.compareJson(objA[key], objB[key], options, currentPath);
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

  // Run all tests
  runAllTests() {
    const output = [];
    output.push('\n🧪 Running cURL Comparison Tests...\n');
    
    // Override console.log to capture output
    const originalLog = console.log;
    const self = this;
    console.log = function(...args) {
      const message = args.join(' ');
      output.push(message);
      originalLog.apply(console, args);
    };

    // Test 1: Parse basic cURL command
    this.test('Parse basic GET cURL', () => {
      const curl = 'curl https://api.example.com/users';
      const parsed = this.parseCurl(curl);
      return parsed.method === 'GET' && parsed.url === 'https://api.example.com/users';
    });

    // Test 2: Parse POST with headers and body
    this.test('Parse POST with headers and body', () => {
      const curl = `curl -X POST https://api.example.com/users \\
  -H 'Content-Type: application/json' \\
  -d '{"name":"John"}'`;
      const parsed = this.parseCurl(curl);
      return parsed.method === 'POST' &&
             parsed.url === 'https://api.example.com/users' &&
             parsed.headers['Content-Type'] === 'application/json' &&
             parsed.body === '{"name":"John"}';
    });

    // Test 3: Parse query parameters
    this.test('Parse URL with query parameters', () => {
      const curl = 'curl https://api.example.com/users?page=1&limit=10';
      const parsed = this.parseCurl(curl);
      return parsed.queryParams.page === '1' && parsed.queryParams.limit === '10';
    });

    // Test 4: Compare identical methods
    this.test('Compare identical methods', () => {
      const result = this.compareMethod('POST', 'POST');
      return result.same === true && result.a === 'POST' && result.b === 'POST';
    });

    // Test 5: Compare different methods
    this.test('Compare different methods', () => {
      const result = this.compareMethod('GET', 'POST');
      return result.same === false && result.a === 'GET' && result.b === 'POST';
    });

    // Test 6: Compare identical headers
    this.test('Compare identical headers', () => {
      const headersA = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
      const headersB = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
      const result = this.compareHeaders(headersA, headersB);
      return result.differences.length === 0 &&
             result.missing.length === 0 &&
             result.extra.length === 0 &&
             result.same.length === 2;
    });

    // Test 7: Compare headers with differences
    this.test('Compare headers with value differences', () => {
      const headersA = { 'Authorization': 'Bearer token123' };
      const headersB = { 'Authorization': 'Bearer token456' };
      const result = this.compareHeaders(headersA, headersB);
      return result.differences.length === 1 &&
             result.differences[0].key === 'Authorization' &&
             result.differences[0].valueA === 'Bearer token123' &&
             result.differences[0].valueB === 'Bearer token456';
    });

    // Test 8: Compare headers with missing keys
    this.test('Compare headers with missing keys', () => {
      const headersA = { 'Content-Type': 'application/json', 'X-Custom': 'value' };
      const headersB = { 'Content-Type': 'application/json' };
      const result = this.compareHeaders(headersA, headersB);
      return result.missing.length === 1 &&
             result.missing[0].key === 'X-Custom' &&
             result.same.length === 1;
    });

    // Test 9: Compare headers with extra keys
    this.test('Compare headers with extra keys', () => {
      const headersA = { 'Content-Type': 'application/json' };
      const headersB = { 'Content-Type': 'application/json', 'X-Custom': 'value' };
      const result = this.compareHeaders(headersA, headersB);
      return result.extra.length === 1 &&
             result.extra[0].key === 'X-Custom' &&
             result.same.length === 1;
    });

    // Test 10: Compare headers with ignore option
    this.test('Compare headers with ignore option', () => {
      const headersA = { 'Authorization': 'Bearer token123', 'Content-Type': 'application/json' };
      const headersB = { 'Authorization': 'Bearer token456', 'Content-Type': 'application/json' };
      const result = this.compareHeaders(headersA, headersB, { ignoreHeaders: ['Authorization'] });
      return result.differences.length === 0 &&
             result.same.length === 1 &&
             result.same[0].key === 'Content-Type';
    });

    // Test 11: Compare identical JSON objects
    this.test('Compare identical JSON objects', () => {
      const objA = { name: 'John', age: 30 };
      const objB = { name: 'John', age: 30 };
      const result = this.compareJson(objA, objB);
      return result.same === true &&
             result.differences.length === 0 &&
             result.missing.length === 0 &&
             result.extra.length === 0;
    });

    // Test 12: Compare JSON with different values
    this.test('Compare JSON with different values', () => {
      const objA = { name: 'John', age: 30 };
      const objB = { name: 'Jane', age: 30 };
      const result = this.compareJson(objA, objB);
      return result.same === false &&
             result.differences.length === 1 &&
             result.differences[0].path === 'name';
    });

    // Test 13: Compare JSON with missing keys
    this.test('Compare JSON with missing keys', () => {
      const objA = { name: 'John', age: 30, email: 'john@example.com' };
      const objB = { name: 'John', age: 30 };
      const result = this.compareJson(objA, objB);
      return result.same === false &&
             result.missing.length === 1 &&
             result.missing[0].path === 'email';
    });

    // Test 14: Compare JSON with nested objects
    this.test('Compare JSON with nested objects', () => {
      const objA = { user: { name: 'John', age: 30 } };
      const objB = { user: { name: 'Jane', age: 30 } };
      const result = this.compareJson(objA, objB);
      return result.same === false &&
             result.differences.length === 1 &&
             result.differences[0].path === 'user.name';
    });

    // Test 15: Compare JSON with ignore option
    this.test('Compare JSON with ignore option', () => {
      const objA = { name: 'John', id: 1, createdAt: '2024-01-01' };
      const objB = { name: 'John', id: 2, createdAt: '2024-01-02' };
      const result = this.compareJson(objA, objB, { ignoreJsonKeys: ['id', 'createdAt'] });
      return result.same === true &&
             result.differences.length === 0;
    });

    // Test 16: Compare case-insensitive headers
    this.test('Compare headers case-insensitive', () => {
      const headersA = { 'Content-Type': 'application/json' };
      const headersB = { 'content-type': 'application/json' };
      const result = this.compareHeaders(headersA, headersB, { caseInsensitive: true });
      return result.same.length === 1;
    });

    // Test 17: Compare headers with trim whitespace
    this.test('Compare headers with trim whitespace', () => {
      const headersA = { 'Content-Type': 'application/json ' };
      const headersB = { 'Content-Type': ' application/json' };
      const result = this.compareHeaders(headersA, headersB, { trimWhitespace: true });
      return result.same.length === 1;
    });

    // Test 18: Parse multi-line cURL
    this.test('Parse multi-line cURL command', () => {
      const curl = `curl -X POST https://api.example.com/users \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer token' \\
  -d '{"name":"John"}'`;
      const parsed = this.parseCurl(curl);
      return parsed.method === 'POST' &&
             parsed.headers['Content-Type'] === 'application/json' &&
             parsed.headers['Authorization'] === 'Bearer token' &&
             parsed.body === '{"name":"John"}';
    });

    // Test 19: Parse cURL with --request flag
    this.test('Parse cURL with --request flag', () => {
      const curl = 'curl --request PUT https://api.example.com/users/1';
      const parsed = this.parseCurl(curl);
      return parsed.method === 'PUT';
    });

    // Test 20: Parse cURL with --data-raw flag
    this.test('Parse cURL with --data-raw flag', () => {
      const curl = `curl -X POST https://api.example.com/users --data-raw '{"name":"John"}'`;
      const parsed = this.parseCurl(curl);
      return parsed.method === 'POST' && parsed.body === '{"name":"John"}';
    });

    // Test 21: Compare URLs with different query params
    this.test('Compare URLs with different query params', () => {
      const urlA = 'https://api.example.com/users?page=1&limit=10';
      const urlB = 'https://api.example.com/users?page=2&limit=10';
      const parsedA = this.parseCurl(`curl ${urlA}`);
      const parsedB = this.parseCurl(`curl ${urlB}`);
      return parsedA.queryParams.page === '1' && 
             parsedB.queryParams.page === '2' &&
             parsedA.queryParams.limit === parsedB.queryParams.limit;
    });

    // Test 22: Compare empty bodies
    this.test('Compare empty bodies', () => {
      const objA = {};
      const objB = {};
      const result = this.compareJson(objA, objB);
      return result.same === true && result.differences.length === 0;
    });

    // Test 23: Compare arrays
    this.test('Compare arrays with different values', () => {
      const arrA = [1, 2, 3];
      const arrB = [1, 2, 4];
      const result = this.compareJson(arrA, arrB);
      return result.same === false && result.differences.length > 0;
    });

    // Test 24: Compare arrays with same values
    this.test('Compare arrays with same values', () => {
      const arrA = [1, 2, 3];
      const arrB = [1, 2, 3];
      const result = this.compareJson(arrA, arrB);
      return result.same === true && result.differences.length === 0;
    });

    // Test 25: Compare nested JSON with arrays
    this.test('Compare nested JSON with arrays', () => {
      const objA = { users: [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }] };
      const objB = { users: [{ id: 1, name: 'John' }, { id: 2, name: 'Bob' }] };
      const result = this.compareJson(objA, objB);
      return result.same === false && result.differences.length > 0;
    });

    // Test 26: Compare headers with empty objects
    this.test('Compare empty headers', () => {
      const headersA = {};
      const headersB = {};
      const result = this.compareHeaders(headersA, headersB);
      return result.differences.length === 0 &&
             result.missing.length === 0 &&
             result.extra.length === 0 &&
             result.same.length === 0;
    });

    // Test 27: Compare query params with empty objects
    this.test('Compare empty query params', () => {
      const paramsA = {};
      const paramsB = {};
      const result = this.compareQueryParams(paramsA, paramsB);
      return result.differences.length === 0 &&
             result.missing.length === 0 &&
             result.extra.length === 0 &&
             result.same.length === 0;
    });

    // Test 28: Compare JSON with null values
    this.test('Compare JSON with null values', () => {
      const objA = { name: 'John', value: null };
      const objB = { name: 'John', value: null };
      const result = this.compareJson(objA, objB);
      return result.same === true;
    });

    // Test 29: Compare JSON with different null handling
    this.test('Compare JSON with null vs undefined', () => {
      const objA = { name: 'John', value: null };
      const objB = { name: 'John' };
      const result = this.compareJson(objA, objB);
      return result.same === false;
    });

    // Test 30: Compare headers with multiple same headers
    this.test('Compare headers with multiple same headers', () => {
      const headersA = { 
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Custom': 'value1'
      };
      const headersB = { 
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Custom': 'value1'
      };
      const result = this.compareHeaders(headersA, headersB);
      return result.same.length === 3 &&
             result.differences.length === 0 &&
             result.missing.length === 0 &&
             result.extra.length === 0;
    });

    // Print results
    const resultsOutput = `\n✅ Passed: ${this.passed}\n❌ Failed: ${this.failed}\n📊 Total: ${this.passed + this.failed}\n`;
    output.push(resultsOutput);
    console.log(resultsOutput);
    
    // Restore console.log
    console.log = originalLog;

    return {
      passed: this.passed,
      failed: this.failed,
      total: this.passed + this.failed,
      output: output.join('\n')
    };
  }

  test(name, testFunction) {
    try {
      const result = testFunction();
      if (result === true) {
        this.passed++;
        const message = `✅ ${name}`;
        console.log(message);
      } else {
        this.failed++;
        const message = `❌ ${name} - Expected true, got ${result}`;
        console.log(message);
      }
    } catch (error) {
      this.failed++;
      const message = `❌ ${name} - Error: ${error.message}`;
      console.log(message);
    }
  }
}
