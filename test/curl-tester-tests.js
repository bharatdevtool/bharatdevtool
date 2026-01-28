/**
 * cURL Tester Test Suite
 * 
 * Comprehensive tests for cURL tester functionality including:
 * - cURL command parsing
 * - Request building
 * - Header handling
 * - Body parsing
 * - Edge cases
 */

// cURL Tester Test Class
class CurlTesterTests {
  constructor() {
    this.testsPassed = 0;
    this.testsFailed = 0;
    this.totalTests = 0;
    this.failedTests = [];
  }

  runTest(testName, testFunction) {
    this.totalTests++;
    try {
      const result = testFunction();
      if (result === true) {
        this.testsPassed++;
        console.log(`✅ ${testName}`);
      } else {
        this.testsFailed++;
        this.failedTests.push(testName);
        console.log(`❌ ${testName} - Expected true, got ${result}`);
      }
    } catch (error) {
      this.testsFailed++;
      this.failedTests.push(testName);
      console.log(`❌ ${testName} - Error: ${error.message}`);
    }
  }

  assertEqual(actual, expected, message) {
    if (actual === expected) {
      return true;
    } else {
      throw new Error(`${message} - Expected: ${expected}, Got: ${actual}`);
    }
  }

  assertContains(actual, expected, message) {
    if (actual.includes(expected)) {
      return true;
    } else {
      throw new Error(`${message} - Expected to contain: ${expected}, Got: ${actual}`);
    }
  }

  // Parse cURL command (simplified version matching the implementation)
  parseCurl(curlCommand) {
    const result = {
      method: 'GET',
      url: '',
      headers: {},
      body: null
    };
    
    let command = curlCommand.trim();
    if (command.toLowerCase().startsWith('curl')) {
      command = command.substring(4).trim();
    }
    
    const methodMatch = command.match(/-X\s+(\w+)|--request\s+(\w+)/i);
    if (methodMatch) {
      result.method = (methodMatch[1] || methodMatch[2]).toUpperCase();
    }
    
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
    
    const dataMatch = command.match(/-d\s+['"]([^'"]+)['"]|--data\s+['"]([^'"]+)['"]|--data-raw\s+['"]([^'"]+)['"]|--data-binary\s+['"]([^'"]+)['"]/i);
    if (dataMatch) {
      result.body = dataMatch[1] || dataMatch[2] || dataMatch[3] || dataMatch[4];
      if (!methodMatch) {
        result.method = 'POST';
      }
    }
    
    const urlMatch = command.match(/(https?:\/\/[^\s'"]+)/i);
    if (urlMatch) {
      result.url = urlMatch[1];
    } else {
      const urlMatch2 = command.match(/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s'"]*)/);
      if (urlMatch2) {
        result.url = 'https://' + urlMatch2[1];
      }
    }
    
    return result;
  }

  // Run all tests
  runAllTests() {
    console.log('\n🧪 Running cURL Tester Tests...\n');

    // Test 1: Simple GET request
    this.runTest('Parse simple GET request', () => {
      const curl = 'curl https://api.example.com/users';
      const parsed = this.parseCurl(curl);
      return this.assertEqual(parsed.method, 'GET', 'Method should be GET') &&
             this.assertEqual(parsed.url, 'https://api.example.com/users', 'URL should be correct');
    });

    // Test 2: POST request with headers
    this.runTest('Parse POST request with headers', () => {
      const curl = `curl -X POST https://api.example.com/users \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer token123'`;
      const parsed = this.parseCurl(curl);
      return this.assertEqual(parsed.method, 'POST', 'Method should be POST') &&
             this.assertEqual(parsed.url, 'https://api.example.com/users', 'URL should be correct') &&
             this.assertEqual(parsed.headers['Content-Type'], 'application/json', 'Content-Type header should be parsed') &&
             this.assertEqual(parsed.headers['Authorization'], 'Bearer token123', 'Authorization header should be parsed');
    });

    // Test 3: POST request with body
    this.runTest('Parse POST request with body', () => {
      const curl = `curl -X POST https://api.example.com/users \\
  -H 'Content-Type: application/json' \\
  -d '{"name":"John","age":30}'`;
      const parsed = this.parseCurl(curl);
      return this.assertEqual(parsed.method, 'POST', 'Method should be POST') &&
             this.assertEqual(parsed.body, '{"name":"John","age":30}', 'Body should be parsed');
    });

    // Test 4: PUT request
    this.runTest('Parse PUT request', () => {
      const curl = 'curl -X PUT https://api.example.com/users/1 -H "Content-Type: application/json"';
      const parsed = this.parseCurl(curl);
      return this.assertEqual(parsed.method, 'PUT', 'Method should be PUT');
    });

    // Test 5: DELETE request
    this.runTest('Parse DELETE request', () => {
      const curl = 'curl -X DELETE https://api.example.com/users/1';
      const parsed = this.parseCurl(curl);
      return this.assertEqual(parsed.method, 'DELETE', 'Method should be DELETE');
    });

    // Test 6: Request with --request flag
    this.runTest('Parse request with --request flag', () => {
      const curl = 'curl --request PATCH https://api.example.com/users/1';
      const parsed = this.parseCurl(curl);
      return this.assertEqual(parsed.method, 'PATCH', 'Method should be PATCH');
    });

    // Test 7: Request with --data-raw
    this.runTest('Parse request with --data-raw flag', () => {
      const curl = `curl -X POST https://api.example.com/users --data-raw '{"test":"data"}'`;
      const parsed = this.parseCurl(curl);
      return this.assertEqual(parsed.body, '{"test":"data"}', 'Body should be parsed from --data-raw');
    });

    // Test 8: Multiple headers
    this.runTest('Parse request with multiple headers', () => {
      const curl = `curl https://api.example.com/users \\
  -H 'Accept: application/json' \\
  -H 'User-Agent: MyApp/1.0' \\
  -H 'X-API-Key: abc123'`;
      const parsed = this.parseCurl(curl);
      return this.assertEqual(Object.keys(parsed.headers).length, 3, 'Should parse 3 headers') &&
             this.assertEqual(parsed.headers['Accept'], 'application/json', 'Accept header should be parsed') &&
             this.assertEqual(parsed.headers['User-Agent'], 'MyApp/1.0', 'User-Agent header should be parsed') &&
             this.assertEqual(parsed.headers['X-API-Key'], 'abc123', 'X-API-Key header should be parsed');
    });

    // Test 9: URL without protocol
    this.runTest('Parse URL without protocol', () => {
      const curl = 'curl api.example.com/users';
      const parsed = this.parseCurl(curl);
      return this.assertContains(parsed.url, 'api.example.com', 'URL should contain domain');
    });

    // Test 10: Empty cURL command
    this.runTest('Handle empty cURL command', () => {
      const curl = '';
      const parsed = this.parseCurl(curl);
      return this.assertEqual(parsed.method, 'GET', 'Should default to GET') &&
             this.assertEqual(parsed.url, '', 'URL should be empty');
    });

    // Test 11: Body without explicit method (should default to POST)
    this.runTest('Body without method defaults to POST', () => {
      const curl = `curl https://api.example.com/users -d '{"data":"test"}'`;
      const parsed = this.parseCurl(curl);
      return this.assertEqual(parsed.method, 'POST', 'Should default to POST when body is present');
    });

    // Test 12: Complex JSON body
    this.runTest('Parse complex JSON body', () => {
      const curl = `curl -X POST https://api.example.com/users \\
  -H 'Content-Type: application/json' \\
  -d '{"user":{"name":"John","email":"john@example.com"},"metadata":{"source":"web"}}'`;
      const parsed = this.parseCurl(curl);
      return this.assertContains(parsed.body, 'user', 'Body should contain user') &&
             this.assertContains(parsed.body, 'metadata', 'Body should contain metadata');
    });

    // Print summary
    console.log('\n📊 Test Summary:');
    console.log(`Total Tests: ${this.totalTests}`);
    console.log(`✅ Passed: ${this.testsPassed}`);
    console.log(`❌ Failed: ${this.testsFailed}`);
    
    if (this.failedTests.length > 0) {
      console.log('\n❌ Failed Tests:');
      this.failedTests.forEach(test => console.log(`  - ${test}`));
    }

    return {
      total: this.totalTests,
      passed: this.testsPassed,
      failed: this.testsFailed,
      failedTests: this.failedTests
    };
  }
}

// Export for use in test runner
export { CurlTesterTests };
